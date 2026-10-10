// @vitest-environment node
import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';

import {
    CreateNodesContextV2,
    CreateNodesResultV2,
    ProjectConfiguration,
    TargetConfiguration,
    logger
} from '@nx/devkit';
import { getOutputsForTargetAndConfiguration } from 'nx/src/tasks-runner/utils';

import { readCargoMetadata } from '../utils/cargo-metadata';
import { RustPluginOptions, createNodesV2 } from './create-nodes';

vi.mock('../utils/cargo-metadata', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../utils/cargo-metadata')>();
    return { ...actual, readCargoMetadata: vi.fn(actual.readCargoMetadata) };
});

// These tests run the real cargo, which must be on PATH: targets built from mocked metadata would only prove the
// plugin agrees with its own reading of cargo's output.

const crate = (name: string, manifest = '') =>
    `[package]\nname = "${name}"\nversion = "0.1.0"\nedition = "2021"\n${manifest}`;

const project = (configuration: Partial<ProjectConfiguration>) => JSON.stringify(configuration);

const FILES: Record<string, string> = {
    'Cargo.toml': '[workspace]\nresolver = "2"\nmembers = ["apps/app", "apps/app/migration", "libs/*"]\n',
    'package.json': JSON.stringify({ name: '@test/source', private: true, nx: { includedScripts: [] } }),

    // A binary application with no targets of its own.
    'apps/app/Cargo.toml': crate('app', '[dependencies]\nshared = { path = "../../libs/shared" }\n'),
    'apps/app/src/main.rs': 'fn main() {}\n',
    'apps/app/project.json': project({ name: 'app', projectType: 'application' }),

    // A crate nested in a project without being a project of its own.
    'apps/app/migration/Cargo.toml': crate('migration'),
    'apps/app/migration/src/lib.rs': '',

    // A library, whose name cargo spells with an underscore.
    'libs/shared/Cargo.toml': crate('my-shared'),
    'libs/shared/src/lib.rs': '',
    'libs/shared/project.json': project({ name: 'shared', projectType: 'library' }),

    // A library built as a C dynamic library, with a binary of its own.
    'libs/plugin-host/Cargo.toml': crate('plugin_host', '[lib]\ncrate-type = ["cdylib", "rlib"]\n'),
    'libs/plugin-host/src/lib.rs': '',
    'libs/plugin-host/src/bin/host.rs': 'fn main() {}\n',
    'libs/plugin-host/project.json': project({ name: 'plugin-host', projectType: 'library' }),

    // A project that declares its own targets: two with this plugin's executors, one with somebody else's.
    'libs/declared/Cargo.toml': crate('declared'),
    'libs/declared/src/lib.rs': '',
    'libs/declared/project.json': project({
        name: 'declared',
        projectType: 'library',
        targets: {
            compile: { executor: '@cubesoft/nx-rust:build' },
            'compile-release': { executor: '@cubesoft/nx-rust:build', options: { release: true } },
            lint: { executor: 'nx:run-commands', options: { command: 'echo lint' } }
        }
    }),

    // A project Nx knows through its package.json.
    'libs/packaged/Cargo.toml': crate('packaged'),
    'libs/packaged/src/lib.rs': '',
    'libs/packaged/package.json': JSON.stringify({ name: 'packaged', version: '0.0.1' }),

    // A directory with a crate but no project: Nx has nothing to add targets to.
    'crates/orphan/Cargo.toml': crate('orphan', '[workspace]\n'),
    'crates/orphan/src/lib.rs': ''
};

let sandbox: string;
let workspace: string;

beforeAll(() => {
    sandbox = mkdtempSync(join(tmpdir(), 'nx-rust-nodes-'));
    workspace = join(sandbox, 'workspace');
    writeFiles(workspace, FILES);
});

afterAll(() => {
    rmSync(sandbox, { recursive: true, force: true });
});

beforeEach(() => {
    vi.mocked(readCargoMetadata).mockClear();
});

describe('createNodesV2', () => {
    it('does not infer whole-workspace targets for a virtual Cargo workspace root', async () => {
        const results = await createNodes(workspace);

        expect(results.find(([manifest]) => manifest === 'Cargo.toml')).toBeUndefined();
        const app = await targetsFor(workspace, 'apps/app');
        expect(Object.keys(app).sort()).toEqual(['build', 'lint', 'run', 'test']);
        expect(app['test'].inputs).toContain('{workspaceRoot}/Cargo.lock');
        expect(app['build'].inputs).toContain('{workspaceRoot}/libs/shared/**/*.rs');
    });

    it('does not infer targets for nested virtual workspaces either', async () => {
        const nested = join(sandbox, 'virtual-nested');
        writeFiles(nested, {
            'apps/group/Cargo.toml': '[workspace]\nresolver = "2"\nmembers = ["worker"]\n',
            'apps/group/project.json': project({ name: 'group' }),
            'apps/group/worker/Cargo.toml': crate('worker'),
            'apps/group/worker/src/main.rs': 'fn main() {}\n',
            'apps/group/worker/project.json': project({ name: 'worker', projectType: 'application' })
        });

        const results = await createNodes(nested);
        expect(results.map(([manifest]) => manifest)).toEqual(['apps/group/worker/Cargo.toml']);
        const worker = await targetsFor(nested, 'apps/group/worker');
        expect(Object.keys(worker).sort()).toEqual(['build', 'lint', 'run', 'test']);
        expect(worker['test'].inputs).toContain('{workspaceRoot}/apps/group/Cargo.lock');
    });

    it('infers targets when the workspace root is also an actual Cargo package', async () => {
        const packaged = join(sandbox, 'packaged-root');
        writeFiles(packaged, {
            ...FILES,
            'Cargo.toml': crate('root-package') + FILES['Cargo.toml'],
            'src/main.rs': 'fn main() {}\n'
        });

        const results = await createNodes(packaged);
        const targets = results.find(([manifest]) => manifest === 'Cargo.toml')?.[1].projects?.['.']?.targets;
        expect(Object.keys(targets ?? {}).sort()).toEqual(['build', 'lint', 'run', 'test']);
        expect(targets?.['build']).toMatchObject({ executor: '@cubesoft/nx-rust:build', cache: true });
        expect(targets?.['test'].inputs).toContain('{workspaceRoot}/Cargo.lock');
    });

    it('caches explicit whole-workspace Rust targets without inferring more targets', async () => {
        const explicit = join(sandbox, 'explicit-root');
        writeFiles(explicit, {
            ...FILES,
            'package.json': JSON.stringify({
                name: '@test/source',
                nx: {
                    targets: {
                        'workspace-build': { executor: '@cubesoft/nx-rust:build', options: { args: ['--workspace'] } },
                        'workspace-test': { executor: '@cubesoft/nx-rust:test' },
                        'workspace-lint': { executor: '@cubesoft/nx-rust:lint' },
                        'workspace-run': { executor: '@cubesoft/nx-rust:run' }
                    }
                }
            })
        });

        const results = await createNodes(explicit);
        const targets = results.find(([manifest]) => manifest === 'Cargo.toml')?.[1].projects?.['.']?.targets;
        expect(Object.keys(targets ?? {}).sort()).toEqual([
            'workspace-build',
            'workspace-lint',
            'workspace-run',
            'workspace-test'
        ]);
        for (const name of ['workspace-build', 'workspace-test', 'workspace-lint']) {
            expect(targets?.[name]).toMatchObject({ cache: true, outputs: ['{options.targetDir}'] });
            expect(targets?.[name].inputs).toContain('{workspaceRoot}/apps/app/**/*.rs');
            expect(targets?.[name].inputs).toContain('{workspaceRoot}/libs/shared/**/*.rs');
            expect(targets?.[name]).not.toHaveProperty('executor');
        }
        expect(targets?.['workspace-run']).toMatchObject({ cache: false });
    });

    it('adds the conventional targets to a project that declares none', async () => {
        const app = await targetsFor(workspace, 'apps/app');

        expect(Object.keys(app).sort()).toEqual(['build', 'lint', 'run', 'test']);
        expect(app['build']).toMatchObject({
            executor: '@cubesoft/nx-rust:build',
            cache: true,
            options: { targetDir: 'dist/apps/app/build' }
        });
        expect(app['test']).toMatchObject({
            executor: '@cubesoft/nx-rust:test',
            cache: true,
            outputs: ['{options.targetDir}']
        });
        expect(app['lint']).toMatchObject({
            executor: '@cubesoft/nx-rust:lint',
            cache: true,
            outputs: ['{options.targetDir}']
        });
    });

    it('does not add a run target to a crate with no binary, and never caches one', async () => {
        const shared = await targetsFor(workspace, 'libs/shared');
        const app = await targetsFor(workspace, 'apps/app');

        expect(Object.keys(shared).sort()).toEqual(['build', 'lint', 'test']);
        expect(app['run']).toMatchObject({ executor: '@cubesoft/nx-rust:run', cache: false });
        expect(app['run']).not.toHaveProperty('outputs');
    });

    it('takes the target directory from the project type, as the executors do', async () => {
        const shared = await targetsFor(workspace, 'libs/shared');
        const packaged = await targetsFor(workspace, 'libs/packaged');

        expect(shared['build'].options).toEqual({ targetDir: 'dist/libs/shared/build' });
        expect(packaged['build'].options).toEqual({ targetDir: 'dist/libs/packaged/build' });
    });

    it('caches the targets a project declares itself, whatever they are called', async () => {
        const declared = await targetsFor(workspace, 'libs/declared');

        expect(Object.keys(declared).sort()).toEqual(['compile', 'compile-release', 'test']);
        expect(declared['compile']).toMatchObject({ cache: true });
        expect(declared['compile-release']).toMatchObject({ cache: true });
        // The executor stays the project's own, and a target belonging to another executor is left alone.
        expect(declared['compile']).not.toHaveProperty('executor');
        expect(declared['lint']).toBeUndefined();
    });

    it('caches the complete Cargo directory for builds, tests and lint', async () => {
        const app = await targetsFor(workspace, 'apps/app');
        for (const name of ['build', 'test', 'lint']) {
            expect(app[name].outputs).toEqual(['{options.targetDir}']);
        }
    });

    it('resolves outputs using the actual target directory, including CLI overrides', async () => {
        const app = await targetsFor(workspace, 'apps/app');
        const node = { name: 'app', type: 'app' as const, data: { root: 'apps/app', targets: app } };
        expect(getOutputsForTargetAndConfiguration({ project: 'app', target: 'build' }, {}, node)).toEqual([
            'dist/apps/app/build'
        ]);
        expect(
            getOutputsForTargetAndConfiguration({ project: 'app', target: 'build' }, { targetDir: 'target' }, node)
        ).toEqual(['target']);
    });

    it('uses Cargo sources and local dependencies without Node named inputs', async () => {
        const app = await targetsFor(workspace, 'apps/app');
        expect(app['build'].inputs).toEqual(
            expect.arrayContaining([
                '{workspaceRoot}/apps/app/**/*.rs',
                '{workspaceRoot}/libs/shared/**/*.rs',
                '{workspaceRoot}/Cargo.toml',
                '{workspaceRoot}/Cargo.lock',
                '{workspaceRoot}/apps/.cargo/config.toml',
                '{workspaceRoot}/apps/app/.cargo/config.toml',
                '{workspaceRoot}/rust-toolchain.toml',
                { externalDependencies: [] },
                { env: 'RUSTFLAGS' }
            ])
        );
        expect(app['build'].inputs).not.toContain('default');
        expect(app['build'].inputs).not.toContain('^default');
        expect(app['test'].inputs).toEqual(app['build'].inputs);
    });

    it('also takes the files of a cargo workspace of its own as inputs', async () => {
        const nested = join(sandbox, 'nested');
        writeFiles(nested, {
            'apps/agent/Cargo.toml': crate('agent', '[workspace]\n'),
            'apps/agent/src/main.rs': 'fn main() {}\n',
            'apps/agent/project.json': project({ name: 'agent', projectType: 'application' })
        });

        const agent = await targetsFor(nested, 'apps/agent');

        expect(agent['build'].inputs).toContain('{workspaceRoot}/apps/agent/Cargo.lock');
        expect(agent['build'].inputs).toContain('{workspaceRoot}/apps/agent/.cargo/config.toml');
        expect(agent['build'].inputs).not.toContain('{workspaceRoot}/Cargo.lock');
    });

    it('adds nothing to a crate that is not a project of its own', async () => {
        const results = await createNodes(workspace);

        expect(results.map(([manifest]) => manifest).sort()).toEqual([
            'apps/app/Cargo.toml',
            'libs/declared/Cargo.toml',
            'libs/packaged/Cargo.toml',
            'libs/plugin-host/Cargo.toml',
            'libs/shared/Cargo.toml'
        ]);
    });

    it('reads each cargo workspace once', async () => {
        await createNodes(workspace);

        expect(vi.mocked(readCargoMetadata).mock.calls).toEqual([[join(workspace, 'Cargo.toml')]]);
    });

    it('names targets as the plugin options ask', async () => {
        const app = await targetsFor(workspace, 'apps/app', { buildTargetName: 'cargo-build', runTargetName: 'go' });

        expect(Object.keys(app).sort()).toEqual(['cargo-build', 'go', 'lint', 'test']);
    });

    it('does not run cargo in a workspace with no Rust project', async () => {
        const empty = join(sandbox, 'no-rust');
        writeFiles(empty, { 'tools/scripts/run.sh': '#!/bin/sh\n' });

        expect(await createNodes(empty)).toEqual([]);
        expect(readCargoMetadata).not.toHaveBeenCalled();
    });

    it('warns once and adds no targets when cargo is not installed', async () => {
        const warn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
        const path = process.env['PATH'];
        process.env['PATH'] = join(sandbox, 'empty-path');
        try {
            expect(await createNodes(workspace)).toEqual([]);
            expect(await createNodes(workspace)).toEqual([]);
            expect(warn).toHaveBeenCalledTimes(1);
            expect(warn.mock.calls[0][0]).toMatch(/cargo is not on PATH/);
        } finally {
            process.env['PATH'] = path;
            warn.mockRestore();
        }
    });
});

async function createNodes(workspaceRoot: string, options?: RustPluginOptions): Promise<CreateNodesResultV2> {
    const manifests = listFiles(workspaceRoot).filter((file) => file.endsWith('Cargo.toml'));
    const context: CreateNodesContextV2 = { nxJsonConfiguration: {}, workspaceRoot };
    return createNodesV2[1](manifests, options, context);
}

/** The targets the plugin adds to the project at `root`. */
async function targetsFor(
    workspaceRoot: string,
    root: string,
    options?: RustPluginOptions
): Promise<Record<string, TargetConfiguration>> {
    const results = await createNodes(workspaceRoot, options);
    const [, result] = results.find(([manifest]) => manifest === `${root}/Cargo.toml`) ?? [];
    expect(result, `no project created for ${root}`).toBeDefined();
    return result?.projects?.[root]?.targets ?? {};
}

function writeFiles(root: string, files: Record<string, string>) {
    for (const [file, content] of Object.entries(files)) {
        mkdirSync(dirname(join(root, file)), { recursive: true });
        writeFileSync(join(root, file), content);
    }
}

function listFiles(root: string, directory = ''): string[] {
    return readdirSync(join(root, directory), { withFileTypes: true }).flatMap((entry) => {
        const path = directory ? `${directory}/${entry.name}` : entry.name;
        return entry.isDirectory() ? listFiles(root, path) : [path];
    });
}
