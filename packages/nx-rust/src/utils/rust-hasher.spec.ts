// @vitest-environment node
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import { execFileSync } from 'child_process';
import { sync as spawnSync } from 'cross-spawn';

import { HasherContext, Task } from '@nx/devkit';

import { createDependencies } from '../plugins/create-dependencies';
import { hashRustTaskAt } from './rust-hasher';
import { readRustWorkspace } from './rust-workspace';

vi.mock('cross-spawn', async (importOriginal) => {
    const actual = await importOriginal<typeof import('cross-spawn')>();
    return { ...actual, sync: vi.fn(actual.sync) };
});

const crate = (name: string, rest = '') => `[package]\nname = "${name}"\nversion = "0.1.0"\nedition = "2021"\n${rest}`;
let root: string;
let context: HasherContext;
let task: Task;

function write(file: string, content: string) {
    mkdirSync(dirname(join(root, file)), { recursive: true });
    writeFileSync(join(root, file), content);
}

beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'nx-rust-hash-'));
    write('Cargo.toml', '[workspace]\nresolver = "2"\nmembers = ["apps/app", "libs/*"]\n');
    write('apps/app/Cargo.toml', crate('app', '[dependencies]\nshared = { path = "../../libs/shared" }\n'));
    write('apps/app/src/main.rs', 'fn main() { println!("{}", shared::value()); }\n');
    write('libs/shared/Cargo.toml', crate('shared', '[dependencies]\ntransitive = { path = "../transitive" }\n'));
    write('libs/shared/src/lib.rs', 'pub fn value() -> u8 { transitive::value() }\n');
    write('libs/transitive/Cargo.toml', crate('transitive'));
    write('libs/transitive/src/lib.rs', 'pub fn value() -> u8 { 1 }\n');
    write('libs/unused/Cargo.toml', crate('unused'));
    write('libs/unused/src/lib.rs', 'pub fn unused() {}\n');
    write(
        'apps/app/project.json',
        JSON.stringify({ name: 'app', targets: { build: { executor: '@cubesoft/nx-rust:build' } } })
    );
    const target = { executor: '@cubesoft/nx-rust:build', options: { targetDir: 'dist/app' } };
    context = {
        hasher: {
            hashTask: vi.fn(() => {
                throw new Error('Node hasher must not be called');
            })
        } as unknown as HasherContext['hasher'],
        projectGraph: {
            nodes: {
                app: {
                    name: 'app',
                    type: 'app',
                    data: {
                        root: 'apps/app',
                        targets: {
                            build: target,
                            test: { ...target, executor: '@cubesoft/nx-rust:test' },
                            lint: { ...target, executor: '@cubesoft/nx-rust:lint' }
                        }
                    }
                }
            },
            externalNodes: {},
            dependencies: { app: [] }
        },
        projectsConfigurations: { version: 2, projects: { app: { root: 'apps/app' } } },
        nxJsonConfiguration: {
            namedInputs: {
                default: ['{projectRoot}/**/*', 'sharedGlobals'],
                production: ['default'],
                sharedGlobals: ['{workspaceRoot}/package.json']
            },
            targetDefaults: { build: { inputs: ['production', '^production'] } }
        },
        taskGraph: { roots: [], tasks: {}, dependencies: {}, continuousDependencies: {} }
    };
    task = {
        id: 'app:build',
        target: { project: 'app', target: 'build' },
        overrides: {},
        outputs: ['dist/app'],
        parallelism: true
    };
});

afterEach(() => rmSync(root, { recursive: true, force: true }));

const hash = () => hashRustTaskAt(root, task, context).then((result) => result.value);

describe('Rust task hashing', () => {
    it.each(['build', 'test', 'lint'])(
        'keeps %s cached across Node changes and unrelated Rust sources',
        async (target) => {
            task.target.target = target;
            const original = await hash();
            write('package.json', JSON.stringify({ dependencies: { react: '99.0.0' } }));
            write('pnpm-lock.yaml', 'node dependency changes\n');
            write('apps/app/package.json', JSON.stringify({ name: 'app', dependencies: { lodash: '99.0.0' } }));
            write('tsconfig.base.json', JSON.stringify({ compilerOptions: { strict: true } }));
            write('apps/app/src/index.ts', 'console.log("unrelated Node code");');
            write('apps/app/README.md', 'Documentation changed');
            write('libs/unused/src/lib.rs', 'pub fn unused() { println!("changed"); }');
            write('libs/shared/package.json', '{"dependencies":{"react":"99"}}');
            context.projectGraph.externalNodes = {
                'npm:react': {
                    name: 'npm:react',
                    type: 'npm',
                    data: { packageName: 'react', version: '99', hash: 'updated' }
                }
            };
            context.nxJsonConfiguration.namedInputs!['sharedGlobals'] = ['{workspaceRoot}/tsconfig.base.json'];
            write('nx.json', JSON.stringify(context.nxJsonConfiguration));
            expect(await hash()).toBe(original);
        }
    );

    it.each([
        ['apps/app/src/main.rs', 'fn main() {}'],
        ['libs/shared/src/lib.rs', 'pub fn value() -> u8 { 2 }'],
        ['libs/transitive/src/lib.rs', 'pub fn value() -> u8 { 3 }'],
        ['apps/app/build.rs', 'fn main() {}'],
        ['apps/app/tests/test.rs', '#[test] fn test() {}'],
        ['Cargo.lock', '# lockfile changed'],
        ['apps/.cargo/config.toml', '[build]\nrustflags = ["--cfg", "ci"]'],
        ['apps/app/clippy.toml', 'too-many-arguments-threshold = 5']
    ])('invalidates when %s changes', async (file, content) => {
        const original = await hash();
        write(file, content);
        expect(await hash()).not.toBe(original);
    });

    it('invalidates changes to inherited workspace dependencies and discovers their new sources', async () => {
        write('apps/app/Cargo.toml', crate('app', '[dependencies]\nshared.workspace = true\n'));
        write(
            'Cargo.toml',
            '[workspace]\nresolver = "2"\nmembers = ["apps/app", "libs/*"]\n[workspace.dependencies]\nshared = { path = "libs/shared" }\n'
        );
        const original = await hash();
        write(
            'Cargo.toml',
            '[workspace]\nresolver = "2"\nmembers = ["apps/app", "libs/*"]\n[workspace.dependencies]\nshared = { package = "unused", path = "libs/unused" }\n'
        );
        expect(await hash()).not.toBe(original);
        const remapped = await hash();
        write('libs/unused/src/lib.rs', 'pub fn value() {}');
        expect(await hash()).not.toBe(remapped);
        const current = await hash();
        write('libs/shared/src/lib.rs', 'pub fn unused_now() {}');
        expect(await hash()).toBe(current);
    });

    it('follows literal embedded resources and extra build-script inputs/environment', async () => {
        write('apps/app/src/main.rs', 'fn main() { let _ = include_str!("../assets/message.txt"); }');
        write('apps/app/assets/message.txt', 'before');
        context.projectGraph.nodes['app'].data.targets!['build'].options = {
            targetDir: 'dist/app',
            additionalInputs: ['{projectRoot}/native/**/*.c'],
            cacheEnv: ['NX_RUST_TEST_INPUT']
        };
        const original = await hash();
        write('apps/app/assets/message.txt', 'after');
        expect(await hash()).not.toBe(original);
        const embedded = await hash();
        write('apps/app/native/ffi.c', 'int value = 1;');
        expect(await hash()).not.toBe(embedded);
        const native = await hash();
        const previous = process.env['NX_RUST_TEST_INPUT'];
        try {
            process.env['NX_RUST_TEST_INPUT'] = 'changed';
            expect(await hash()).not.toBe(native);
        } finally {
            if (previous === undefined) delete process.env['NX_RUST_TEST_INPUT'];
            else process.env['NX_RUST_TEST_INPUT'] = previous;
        }
    });

    it('honors explicit Nx inputs and selected configuration/options without hashing other targets', async () => {
        write(
            'apps/app/project.json',
            JSON.stringify({ targets: { build: { inputs: ['{projectRoot}/fixtures/**/*'] } } })
        );
        const original = await hash();
        write('apps/app/fixtures/input.json', '{"value":2}');
        expect(await hash()).not.toBe(original);
        const fixtures = await hash();
        task.overrides = { release: true, features: ['extra'] };
        expect(await hash()).not.toBe(fixtures);
        const release = await hash();
        context.projectGraph.nodes['app'].data.targets!['lint'].options = { allFeatures: true };
        context.projectGraph.nodes['app'].data.targets!['build'].configurations = { unused: { release: false } };
        expect(await hash()).toBe(release);
    });

    it('never hashes Cargo outputs, even if generated files have a Rust extension', async () => {
        const original = await hash();
        write('dist/app/debug/build/generated.rs', '// generated output');
        write('apps/app/target/debug/build/generated.rs', '// generated output');
        write('apps/app/node_modules/dependency/generated.rs', '// Node package');
        expect(await hash()).toBe(original);
    });

    it('excludes all configured target directories from sources for a Rust project at the workspace root', async () => {
        write('Cargo.toml', crate('root', '[workspace]\nresolver = "2"\nmembers = ["apps/app", "libs/*"]\n'));
        write('src/lib.rs', '');
        context.projectGraph.nodes['app'].data.root = '.';
        context.projectGraph.nodes['app'].data.targets!['lint'].options = { targetDir: 'lint-artifacts' };
        const original = await hash();
        write('dist/another-project/build/generated.rs', '// build artifacts');
        write('lint-artifacts/debug/build/generated.rs', '// lint artifacts');
        expect(await hash()).toBe(original);
    });

    it('detects local patches and bridges dependencies through crates without Nx projects', async () => {
        write(
            'Cargo.toml',
            '[workspace]\nresolver = "2"\nmembers = ["apps/app", "libs/*", "crates/bridge"]\n[patch.crates-io]\npatched = { path = "libs/patched" }\n'
        );
        write(
            'apps/app/Cargo.toml',
            crate('app', '[dependencies]\nbridge = { path = "../../crates/bridge" }\npatched = "0.1"\n')
        );
        write(
            'crates/bridge/Cargo.toml',
            crate('bridge', '[dependencies]\ntransitive = { path = "../../libs/transitive" }\n')
        );
        write('crates/bridge/src/lib.rs', '');
        write('libs/patched/Cargo.toml', crate('patched'));
        write('libs/patched/src/lib.rs', 'pub fn value() {}');
        const original = await hash();
        write('libs/patched/src/lib.rs', 'pub fn changed() {}');
        expect(await hash()).not.toBe(original);
        const workspace = readRustWorkspace([join(root, 'Cargo.toml')]);
        expect(workspace?.patches.get(root)?.get('patched')).toContain(join(root, 'libs/patched/Cargo.toml'));
        const dependencies = await createDependencies(undefined, {
            projects: {
                app: { root: 'apps/app' },
                transitive: { root: 'libs/transitive' },
                patched: { root: 'libs/patched' }
            },
            workspaceRoot: root,
            nxJsonConfiguration: {},
            externalNodes: {},
            fileMap: {
                projectFileMap: { app: [{ file: 'apps/app/Cargo.toml', hash: '' }] },
                nonProjectFiles: [{ file: 'Cargo.toml', hash: '' }]
            },
            filesToProcess: { projectFileMap: {}, nonProjectFiles: [] }
        });
        expect(dependencies).toEqual(
            expect.arrayContaining([
                { source: 'app', target: 'transitive', type: 'implicit' },
                { source: 'app', target: 'patched', type: 'implicit' }
            ])
        );
        // Graph discovery must not resolve registries or write a lockfile.
        expect(() => readFileSync(join(root, 'Cargo.lock'))).toThrow();
    });

    it('hashes indirect local patches conservatively when registry sources are unavailable', async () => {
        write(
            'Cargo.toml',
            '[workspace]\nresolver = "2"\nmembers = ["apps/app", "libs/*"]\n[patch.crates-io]\ntransitive = { path = "libs/transitive" }\n'
        );
        write('apps/app/Cargo.toml', crate('app', '[dependencies]\nregistry-parent = "0.1"\n'));
        const original = await hash();
        write('libs/transitive/src/lib.rs', 'pub fn value() -> u8 { 10 }');
        expect(await hash()).not.toBe(original);
    });

    it('uses locked offline resolution to discover a local patch through a registry crate, and hashes vendored sources', async () => {
        write(
            'Cargo.toml',
            '[workspace]\nresolver = "2"\nmembers = ["apps/app", "libs/*"]\n[patch.crates-io]\ntransitive = { path = "libs/transitive" }\n'
        );
        write('apps/app/Cargo.toml', crate('app', '[dependencies]\nregistry-parent = "0.1"\n'));
        write(
            '.cargo/config.toml',
            '[source.crates-io]\nreplace-with = "vendored"\n[source.vendored]\ndirectory = "vendor"\n'
        );
        write('vendor/registry-parent/Cargo.toml', crate('registry-parent', '[dependencies]\ntransitive = "0.1"\n'));
        write('vendor/registry-parent/src/lib.rs', 'pub fn value() -> u8 { transitive::value() }');
        write('vendor/registry-parent/.cargo-checksum.json', '{"files":{},"package":null}');
        execFileSync('cargo', ['generate-lockfile', '--offline'], { cwd: root, stdio: 'pipe' });
        const workspace = readRustWorkspace([join(root, 'apps/app/Cargo.toml')]);
        expect(workspace?.resolvedDependencies.get(join(root, 'apps/app/Cargo.toml'))).toContain(
            join(root, 'libs/transitive/Cargo.toml')
        );
        const original = await hash();
        write('vendor/registry-parent/src/lib.rs', 'pub fn value() -> u8 { 20 }');
        expect(await hash()).not.toBe(original);
    });

    it('hashes the actual selected toolchain version, even when its name does not change', async () => {
        const run = vi.mocked(spawnSync).getMockImplementation()!;
        let version = 'rustc nightly version 1';
        try {
            vi.mocked(spawnSync).mockImplementation((command, args, options) => {
                if (args?.includes('-vV') || args?.includes('--version')) {
                    return {
                        status: 0,
                        stdout: command === 'rustc' ? version : 'cargo nightly',
                        stderr: '',
                        signal: null,
                        pid: 0,
                        output: []
                    };
                }
                return run(command, args, options);
            });
            task.overrides = { toolchain: 'nightly' };
            const original = await hash();
            expect(spawnSync).toHaveBeenCalledWith(
                'rustc',
                ['+nightly', '-vV'],
                expect.objectContaining({ cwd: join(root, 'apps/app') })
            );
            version = 'rustc nightly version 2';
            expect(await hash()).not.toBe(original);
        } finally {
            vi.mocked(spawnSync).mockImplementation(run);
        }
    });
});
