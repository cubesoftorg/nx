// @vitest-environment node
import { mkdirSync, mkdtempSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';

import {
    CreateDependenciesContext,
    DependencyType,
    FileData,
    RawProjectGraphDependency,
    logger,
    validateDependency
} from '@nx/devkit';

import { readCargoMetadata } from '../utils/cargo-metadata';
import { createDependencies } from './create-dependencies';

vi.mock('../utils/cargo-metadata', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../utils/cargo-metadata')>();
    return { ...actual, readCargoMetadata: vi.fn(actual.readCargoMetadata) };
});

// These tests run the real cargo, which must be on PATH: a graph built from mocked metadata would only prove the
// plugin agrees with its own reading of cargo's output.

const PROJECTS = {
    app: 'apps/app',
    agent: 'apps/agent',
    shared: 'libs/shared',
    helpers: 'libs/helpers',
    codegen: 'libs/codegen',
    db: 'libs/db',
    'platform-win': 'libs/platform-win',
    scripts: 'tools/scripts'
};

const crate = (name: string, manifest = '') =>
    `[package]\nname = "${name}"\nversion = "0.1.0"\nedition = "2021"\n${manifest}`;

const FILES: Record<string, string> = {
    'Cargo.toml':
        '[workspace]\nresolver = "2"\n' +
        'members = ["apps/app", "apps/app/migration", "crates/orphan", "libs/*"]\n' +
        'exclude = ["apps/agent"]\n',
    'apps/app/Cargo.toml': crate(
        'app',
        '[dependencies]\nshared = { path = "../../libs/shared" }\nmigration = { path = "migration" }\nlog = "0.4"\n' +
            '[build-dependencies]\ncodegen = { path = "../../libs/codegen" }\n' +
            '[dev-dependencies]\nhelpers = { path = "../../libs/helpers" }\n'
    ),
    'apps/app/src/main.rs': 'fn main() {}\n',
    // A crate nested in a project without being a project of its own.
    'apps/app/migration/Cargo.toml': crate('migration', '[dependencies]\ndb = { path = "../../../libs/db" }\n'),
    'apps/app/migration/src/lib.rs': '',
    // Excluded from the root workspace, with a workspace of its own.
    'apps/agent/Cargo.toml': crate('agent', '[workspace]\n[dependencies]\nshared = { path = "../../libs/shared" }\n'),
    'apps/agent/src/main.rs': 'fn main() {}\n',
    // A workspace member no project contains.
    'crates/orphan/Cargo.toml': crate('orphan', '[dependencies]\nhelpers = { path = "../../libs/helpers" }\n'),
    'crates/orphan/src/lib.rs': '',
    'libs/shared/Cargo.toml': crate(
        'shared',
        '[dependencies]\nhelpers = { path = "../helpers" }\n' +
            "[target.'cfg(windows)'.dependencies]\n" +
            'platform-win = { path = "../platform-win", optional = true }\n'
    ),
    'libs/shared/src/lib.rs': '',
    'libs/helpers/Cargo.toml': crate('helpers', '[dependencies]\noutside = { path = "../../../outside" }\n'),
    'libs/helpers/src/lib.rs': '',
    'libs/codegen/Cargo.toml': crate('codegen'),
    'libs/codegen/src/lib.rs': '',
    'libs/db/Cargo.toml': crate('db'),
    'libs/db/src/lib.rs': '',
    'libs/platform-win/Cargo.toml': crate('platform-win'),
    'libs/platform-win/src/lib.rs': '',
    'tools/scripts/run.sh': '#!/bin/sh\n'
};

const EDGES: RawProjectGraphDependency[] = [
    { source: 'agent', target: 'shared', type: DependencyType.implicit },
    { source: 'app', target: 'codegen', type: DependencyType.implicit },
    { source: 'app', target: 'db', type: DependencyType.implicit },
    { source: 'app', target: 'helpers', type: DependencyType.implicit },
    { source: 'app', target: 'shared', type: DependencyType.implicit },
    { source: 'shared', target: 'helpers', type: DependencyType.implicit },
    { source: 'shared', target: 'platform-win', type: DependencyType.implicit }
];

let sandbox: string;
let workspace: string;

beforeAll(() => {
    sandbox = mkdtempSync(join(tmpdir(), 'nx-rust-graph-'));
    workspace = join(sandbox, 'workspace');
    writeFiles(workspace, FILES);
    // A path dependency leaving the workspace, which no project can own.
    writeFiles(join(sandbox, 'outside'), { 'Cargo.toml': crate('outside'), 'src/lib.rs': '' });
});

afterAll(() => {
    rmSync(sandbox, { recursive: true, force: true });
});

beforeEach(() => {
    vi.mocked(readCargoMetadata).mockClear();
});

describe('createDependencies', () => {
    it('adds an edge for every path dependency between projects, of every kind', async () => {
        const context = contextFor(workspace, PROJECTS);

        const dependencies = await createDependencies(undefined, context);

        expect(sorted(dependencies)).toEqual(EDGES);
        for (const dependency of dependencies) {
            expect(() => validateDependency(dependency, context)).not.toThrow();
        }
    });

    it('reads each cargo workspace once', async () => {
        await createDependencies(undefined, contextFor(workspace, PROJECTS));

        expect(vi.mocked(readCargoMetadata).mock.calls).toEqual([
            [join(workspace, 'Cargo.toml')],
            [join(workspace, 'apps/agent/Cargo.toml')],
            [join(sandbox, 'outside/Cargo.toml')]
        ]);
    });

    it('gives a crate outside every other project to the root project', async () => {
        const dependencies = await createDependencies(undefined, contextFor(workspace, { ...PROJECTS, root: '.' }));

        expect(sorted(dependencies)).toContainEqual({
            source: 'root',
            target: 'helpers',
            type: DependencyType.implicit
        });
    });

    it('makes the edge implicit when Nx does not track the manifest declaring it', async () => {
        const context = contextFor(workspace, PROJECTS);
        const appFiles = context.fileMap.projectFileMap['app'];
        appFiles.splice(
            appFiles.findIndex(({ file }) => file === 'apps/app/migration/Cargo.toml'),
            1
        );

        const dependencies = await createDependencies(undefined, context);

        expect(sorted(dependencies)).toContainEqual({ source: 'app', target: 'db', type: DependencyType.implicit });
        expect(dependencies.filter((dependency) => dependency.target === 'db')).toHaveLength(1);
        for (const dependency of dependencies) {
            expect(() => validateDependency(dependency, context)).not.toThrow();
        }
    });

    it('resolves crates when the workspace root is reached through a symlink', async () => {
        const link = join(sandbox, 'linked-workspace');
        symlinkSync(workspace, link, 'junction');

        const dependencies = await createDependencies(undefined, contextFor(link, PROJECTS));

        expect(sorted(dependencies)).toEqual(EDGES);
    });

    it('does not run cargo in a workspace with no Cargo.toml', async () => {
        const empty = join(sandbox, 'no-rust');
        writeFiles(empty, { 'tools/scripts/run.sh': '#!/bin/sh\n' });

        expect(await createDependencies(undefined, contextFor(empty, { scripts: 'tools/scripts' }))).toEqual([]);
        expect(readCargoMetadata).not.toHaveBeenCalled();
    });

    it('fails when cargo cannot read a workspace', async () => {
        const broken = join(sandbox, 'broken');
        writeFiles(broken, {
            'Cargo.toml': '[workspace]\nmembers = ["libs/missing"]\n',
            'libs/helpers/Cargo.toml': crate('helpers'),
            'libs/helpers/src/lib.rs': ''
        });

        const context = contextFor(broken, { helpers: 'libs/helpers' });

        await expect(Promise.resolve().then(() => createDependencies(undefined, context))).rejects.toThrow(
            /`cargo metadata` failed for .*Cargo\.toml/
        );
    });

    it('warns once and adds no edges when cargo is not installed', async () => {
        const warn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
        const path = process.env['PATH'];
        process.env['PATH'] = join(sandbox, 'empty-path');
        try {
            const context = contextFor(workspace, PROJECTS);

            expect(await createDependencies(undefined, context)).toEqual([]);
            expect(await createDependencies(undefined, context)).toEqual([]);
            expect(warn).toHaveBeenCalledTimes(1);
            expect(warn.mock.calls[0][0]).toMatch(/cargo is not on PATH/);
        } finally {
            process.env['PATH'] = path;
            warn.mockRestore();
        }
    });
});

function writeFiles(root: string, files: Record<string, string>) {
    for (const [file, content] of Object.entries(files)) {
        mkdirSync(dirname(join(root, file)), { recursive: true });
        writeFileSync(join(root, file), content);
    }
}

/** A context whose file map assigns each file to the deepest project root containing it, as Nx does. */
function contextFor(workspaceRoot: string, projects: Record<string, string>): CreateDependenciesContext {
    const roots = Object.entries(projects).sort(([, a], [, b]) => b.length - a.length);
    const projectFileMap: Record<string, FileData[]> = Object.fromEntries(
        Object.keys(projects).map((name) => [name, []])
    );
    const nonProjectFiles: FileData[] = [];
    for (const file of listFiles(workspaceRoot)) {
        const owner = roots.find(([, root]) => root === '.' || file.startsWith(`${root}/`));
        (owner ? projectFileMap[owner[0]] : nonProjectFiles).push({ file, hash: '' });
    }
    const fileMap = { projectFileMap, nonProjectFiles };
    return {
        externalNodes: {},
        projects: Object.fromEntries(Object.entries(projects).map(([name, root]) => [name, { name, root }])),
        nxJsonConfiguration: {},
        workspaceRoot,
        fileMap,
        filesToProcess: fileMap
    };
}

function listFiles(root: string, directory = ''): string[] {
    return readdirSync(join(root, directory), { withFileTypes: true }).flatMap((entry) => {
        const path = directory ? `${directory}/${entry.name}` : entry.name;
        return entry.isDirectory() ? listFiles(root, path) : [path];
    });
}

function sorted(dependencies: RawProjectGraphDependency[]): RawProjectGraphDependency[] {
    const key = (dependency: RawProjectGraphDependency) =>
        [dependency.source, dependency.target, 'sourceFile' in dependency ? dependency.sourceFile : ''].join('\0');
    return [...dependencies].sort((a, b) => key(a).localeCompare(key(b)));
}
