import { execSync } from 'child_process';
import { createHash } from 'crypto';
import { existsSync, readFileSync } from 'fs';
import { dirname, join, relative, resolve } from 'path';
import { sync as spawnSync } from 'cross-spawn';
import { glob } from 'fast-glob';

import { CustomHasher, HasherContext, Task, TargetConfiguration, normalizePath, workspaceRoot } from '@nx/devkit';
import { expandSingleProjectInputs, getInputs, getNamedInputs } from 'nx/src/hasher/task-hasher';

import type { BuildExecutorSchema } from '../executors/build/schema';
import { defaultTargetDir } from './nx/utils';
import { cargoArgs } from './parse-args';
import { workspacePath } from './paths';
import { RUST_ENV, rustFilePatterns } from './rust-inputs';
import { dependencyClosure, readCachedRustWorkspace } from './rust-workspace';

export interface RustCacheOptions {
    /** Extra resources consumed by build scripts, include macros or tests, using Nx file patterns. */
    additionalInputs?: string[];
    /** Extra environment variables consumed by build scripts or tests. */
    cacheEnv?: string[];
}

const digest = (content: string | Buffer) => createHash('sha256').update(content).digest('hex');
const executorVersion = (JSON.parse(readFileSync(join(__dirname, '../../package.json'), 'utf8')) as { version: string })
    .version;
const stableJson = (value: unknown): string =>
    JSON.stringify(value, (_key, entry) =>
        entry && typeof entry === 'object' && !Array.isArray(entry)
            ? Object.fromEntries(Object.entries(entry).sort(([a], [b]) => a.localeCompare(b)))
            : entry
    );

/**
 * Hash the Cargo ecosystem directly. Delegating to Nx's default hasher would unconditionally add
 * nx.json, TypeScript configuration and (for third-party executors) every npm dependency.
 * Explicit project/executor-specific inputs are additive; generic Node target defaults are ignored.
 */
export const hashRustTask: CustomHasher = async (task, context) => hashRustTaskAt(workspaceRoot, task, context);

export async function hashRustTaskAt(root: string, task: Task, context: HasherContext) {
    const project = context.projectGraph.nodes[task.target.project].data;
    const target = project.targets![task.target.target];
    const overrides = { ...task.overrides };
    delete overrides['__overrides_unparsed__'];
    const configured = {
        targetDir: defaultTargetDir(task.target.project, project.projectType, task.target.target),
        ...target.options,
        ...target.configurations?.[task.target.configuration ?? ''],
        ...overrides
    };
    // Generic Node target defaults can inject options the Cargo executors do not consume.
    const optionNames = [
        'toolchain',
        'target',
        'profile',
        'release',
        'targetDir',
        'features',
        'allFeatures',
        'args',
        'additionalInputs',
        'cacheEnv'
    ];
    const options: BuildExecutorSchema & { targetDir: string } = {
        targetDir: configured.targetDir,
        ...Object.fromEntries(Object.entries(configured).filter(([name]) => optionNames.includes(name)))
    };
    const cwd = resolve(root, project.root);
    const allArgs = cargoArgs(options.args);
    const separator = allArgs.indexOf('--');
    const args = separator < 0 ? allArgs : allArgs.slice(0, separator);
    const argument = (name: string) => {
        const index = args.findIndex((arg) => arg === name || arg.startsWith(`${name}=`));
        return index < 0
            ? undefined
            : args[index].startsWith(`${name}=`)
              ? args[index].slice(name.length + 1)
              : args[index + 1];
    };
    const manifest = resolve(cwd, argument('--manifest-path') ?? 'Cargo.toml');
    const workspace = readCachedRustWorkspace(manifest);
    if (workspace === null) {
        throw new Error('@cubesoft/nx-rust: cargo must be installed to hash Rust tasks.');
    }
    const selectingWorkspace = args.some(
        (arg) =>
            arg === '--workspace' ||
            arg === '--package' ||
            arg === '-p' ||
            arg.startsWith('--package=') ||
            /^-p.+/.test(arg)
    );
    const own = [...workspace.packages.values()].filter((pkg) => {
        if (selectingWorkspace) return true;
        if (argument('--manifest-path')) {
            return workspace.packages.has(manifest)
                ? pkg.manifest_path === manifest
                : workspace.metadata.get(manifest)!.packages.includes(pkg);
        }
        return workspacePath(cwd, pkg.manifest_path) !== null;
    });
    const packages = dependencyClosure(own, workspace);
    const env = (context as HasherContext & { env?: NodeJS.ProcessEnv }).env ?? process.env;
    const nodes: Record<string, string> = {};
    const runtime: Record<string, string> = {};
    const command = digest(
        stableJson({
            version: 1,
            executorVersion,
            executor: target.executor,
            target: task.target,
            options,
            outputs: task.outputs,
            platform: process.platform,
            arch: process.arch
        })
    );

    // Do not hash CARGO_HOME/RUSTUP_HOME: their locations differ between CI workers. The actual
    // compiler versions and Cargo home configuration contents are hashed instead.
    const envNames = new Set([
        ...RUST_ENV,
        ...(options.cacheEnv ?? []),
        ...Object.keys(env).filter(
            (name) =>
                !['CARGO_TARGET_DIR', 'CARGO_BUILD_TARGET_DIR', 'CARGO_BUILD_JOBS'].includes(name) &&
                /^(CARGO_(BUILD_|TARGET_|PROFILE_|FEATURE_|ENCODED_|RUST)|CC_|CXX_|AR_|CFLAGS_|CXXFLAGS_|LDFLAGS_|PKG_CONFIG_)/.test(
                    name
                )
        )
    ]);
    for (const name of [...envNames].sort()) {
        runtime[`env:${name}`] = digest(stableJson(env[name] ?? null));
    }
    for (const [program, args] of [
        [env['RUSTC'] || 'rustc', ['-vV']],
        ['cargo', ['--version']]
    ] as const) {
        const argv = options.toolchain && !(program === env['RUSTC']) ? [`+${options.toolchain}`, ...args] : [...args];
        const toolEnv = options.toolchain ? { ...env, RUSTUP_TOOLCHAIN: options.toolchain } : env;
        const result = spawnSync(program, argv, { cwd, env: toolEnv, encoding: 'utf8', windowsHide: true });
        if (result.error || result.status !== 0) {
            throw new Error(
                `Could not hash Rust toolchain: ${program} ${argv.join(' ')}: ${result.error?.message ?? result.stderr}`
            );
        }
        runtime[`${program} ${argv.join(' ')}`] = digest(result.stdout);
    }

    const outputDirectories = Object.values(context.projectGraph.nodes).flatMap((node) =>
        Object.entries(node.data.targets ?? {}).flatMap(([name, target]) => {
            if (!target.executor?.startsWith('@cubesoft/nx-rust:')) return [];
            return [
                target.options?.targetDir ?? defaultTargetDir(node.name, node.data.projectType, name),
                ...Object.values(target.configurations ?? {}).flatMap((configuration) =>
                    configuration.targetDir ? [configuration.targetDir] : []
                )
            ];
        })
    );
    const ignored = [
        '**/node_modules/**',
        '**/.git/**',
        '**/target/**',
        ...[join(root, 'dist'), options.targetDir, ...outputDirectories].map(
            (directory) => normalizePath(resolve(root, directory)) + '/**'
        )
    ];
    const addFiles = async (patterns: string[], base = cwd, ignore = ignored) => {
        const expanded = patterns.map((pattern) =>
            pattern.split('{workspaceRoot}').join(normalizePath(root)).split('{projectRoot}').join(normalizePath(base))
        );
        const files = await glob(expanded, {
            cwd: root,
            absolute: true,
            dot: true,
            onlyFiles: true,
            unique: true,
            ignore
        });
        for (const file of files.sort()) {
            const cargoHome = resolve(env['CARGO_HOME'] ?? join(env['HOME'] ?? root, '.cargo'));
            const key = file.startsWith(cargoHome + '/')
                ? `<cargo-home>/${normalizePath(relative(cargoHome, file))}`
                : normalizePath(relative(root, file));
            nodes[key] = digest(readFileSync(file));
        }
        return files;
    };
    const files = await addFiles(rustFilePatterns(packages, workspace));
    // Literal include_str!/include_bytes!/include! resources and #[path] modules often sit outside src.
    const includes = [...files.filter((file) => file.endsWith('.rs'))];
    const visited = new Set<string>();
    while (includes.length > 0) {
        const file = includes.pop()!;
        if (visited.has(file)) continue;
        visited.add(file);
        const text = readFileSync(file, 'utf8');
        const pattern = /(?:include(?:_str|_bytes)?!\s*\(\s*|#\s*\[\s*path\s*=\s*)"([^"\n]+)"/g;
        for (const match of text.matchAll(pattern)) {
            const input = resolve(dirname(file), match[1]);
            if (existsSync(input)) {
                nodes[normalizePath(relative(root, input))] = digest(readFileSync(input));
                if (input.endsWith('.rs')) includes.push(input);
            }
        }
    }
    await addFiles(options.additionalInputs ?? []);

    // Honor explicit Nx inputs without inheriting unrelated workspace namedInputs/targetDefaults.
    const declared = readDeclaredTarget(root, project.root, task.target.target);
    const defaults = context.nxJsonConfiguration.targetDefaults?.[target.executor ?? ''];
    const extra = declared?.inputs ?? defaults?.inputs ?? [];
    if (extra.length > 0) {
        const graph = { ...context.projectGraph, nodes: { ...context.projectGraph.nodes } };
        graph.nodes[task.target.project] = {
            ...graph.nodes[task.target.project],
            data: { ...project, targets: { ...project.targets, [task.target.target]: { ...target, inputs: extra } } }
        };
        const inputs = getInputs(task, graph, context.nxJsonConfiguration);
        const hashInputs = async (self: ReturnType<typeof getInputs>['selfInputs'], projectRoot: string) => {
            await addFiles(
                self.flatMap((input) => ('fileset' in input ? [input.fileset] : [])),
                projectRoot
            );
            for (const input of self) {
                if ('env' in input) runtime[`env:${input.env}`] = digest(stableJson(env[input.env] ?? null));
                if ('runtime' in input) runtime[input.runtime] = digest(execSync(input.runtime, { cwd: root, env }));
                if ('externalDependencies' in input) {
                    for (const name of input.externalDependencies) {
                        const external = graph.externalNodes?.[name] ?? graph.externalNodes?.[`npm:${name}`];
                        if (!external) throw new Error(`Unknown external dependency input: ${name}`);
                        nodes[`external:${name}`] = digest(stableJson(external.data));
                    }
                }
            }
        };
        await hashInputs(inputs.selfInputs, cwd);
        const dependencies = new Set<string>();
        const visit = (name: string) => {
            for (const dependency of graph.dependencies[name] ?? []) {
                if (graph.nodes[dependency.target] && !dependencies.has(dependency.target)) {
                    dependencies.add(dependency.target);
                    visit(dependency.target);
                }
            }
        };
        visit(task.target.project);
        for (const name of [...dependencies].sort()) {
            const node = graph.nodes[name];
            for (const input of inputs.depsInputs) {
                await hashInputs(
                    expandSingleProjectInputs(
                        [input.input],
                        getNamedInputs(context.nxJsonConfiguration, node)
                    ) as ReturnType<typeof getInputs>['selfInputs'],
                    resolve(root, node.data.root)
                );
            }
        }
        // Advanced project/output inputs need Nx's semantics. Explicitly opting into these inputs also
        // opts into the standard Nx hash; the ordinary Rust targets never take this branch.
        if (inputs.projectInputs.length > 0 || inputs.depsOutputs.length > 0) {
            nodes['explicit-nx-inputs'] = (await context.hasher.hashTask(task, context.taskGraph, env)).value;
        }
    }
    return { value: digest(stableJson({ command, nodes, runtime })), details: { command, nodes, runtime } };
}

function readDeclaredTarget(root: string, projectRoot: string, name: string): TargetConfiguration | undefined {
    const directory = join(root, projectRoot);
    const read = (file: string) => (existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {});
    return (
        read(join(directory, 'project.json')).targets?.[name] ??
        read(join(directory, 'package.json')).nx?.targets?.[name]
    );
}

export default hashRustTask;
