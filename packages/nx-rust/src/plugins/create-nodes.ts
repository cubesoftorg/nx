import { existsSync, readFileSync } from 'fs';
import { basename, join, posix, resolve } from 'path';

import {
    CreateNodesResultV2,
    CreateNodesV2,
    ProjectConfiguration,
    TargetConfiguration,
    normalizePath
} from '@nx/devkit';

import { CargoMetadata, CargoPackage, warnCargoMissing } from '../utils/cargo-metadata';
import { defaultTargetDir } from '../utils/nx/utils';
import { workspacePath } from '../utils/paths';
import { RUST_ENV, rustFilePatterns } from '../utils/rust-inputs';
import { RustCacheOptions } from '../utils/rust-hasher';
import { dependencyClosure, readRustWorkspace, RustWorkspace } from '../utils/rust-workspace';

const MANIFEST = 'Cargo.toml';

/** The cargo commands this plugin has an executor for, and the target each one is called after by default. */
const COMMANDS = ['build', 'test', 'lint', 'run'] as const;

type CargoCommandName = (typeof COMMANDS)[number];

const EXECUTORS: Record<CargoCommandName, string> = {
    build: '@cubesoft/nx-rust:build',
    test: '@cubesoft/nx-rust:test',
    lint: '@cubesoft/nx-rust:lint',
    run: '@cubesoft/nx-rust:run'
};

const DESCRIPTIONS: Record<CargoCommandName, string> = {
    build: 'Builds the crate with cargo build.',
    test: 'Runs the crate’s tests with cargo test.',
    lint: 'Lints the crate with cargo clippy.',
    run: 'Runs the crate’s binary with cargo run.'
};

export interface RustPluginOptions extends RustCacheOptions {
    buildTargetName?: string;
    testTargetName?: string;
    lintTargetName?: string;
    runTargetName?: string;
}

/**
 * Makes the Rust targets of every project cacheable, with the inputs that decide what a crate compiles to and the
 * artifacts cargo produces as outputs, so that an unchanged crate is restored from the Nx cache instead of being
 * rebuilt.
 *
 * Targets are added to projects Nx already knows, that is a directory holding a `Cargo.toml` next to a
 * `project.json` or a `package.json`. The plugin never turns a crate into a project of its own, so a nested crate
 * such as `apps/api/migration` keeps belonging to the project around it, the same rule `createDependencies` uses.
 *
 * For each such project it adds:
 *
 * - caching for every target the project already declares with one of this plugin's executors, whatever that
 *   target is called, so that a `build-release` target is covered as well as `build`;
 * - a `build`, `test`, `lint` and, for a crate with a binary, `run` target for an actual Cargo package that
 *   declares none of its own. A target name already taken by another executor is left alone. Virtual workspaces
 *   receive caching settings only for explicitly declared Rust targets.
 *
 * Every target it adds carries a `targetDir` option, the same directory the executors default to. Cargo writes
 * there and the outputs are read from there, so the two cannot drift apart when a project overrides it.
 */
export const createNodesV2: CreateNodesV2<RustPluginOptions> = [
    `**/${MANIFEST}`,
    (manifests, options, context) => {
        const roots = projectManifests(context.workspaceRoot, manifests);
        if (roots.length === 0) {
            return [];
        }

        const workspaces = readRustWorkspace(roots.map((manifest) => join(context.workspaceRoot, manifest)));
        if (workspaces === null) {
            warnCargoMissing(
                'Rust targets are not cacheable, and every crate is rebuilt from scratch even when nothing it ' +
                    'depends on has changed.'
            );
            return [];
        }

        const results: CreateNodesResultV2 = [];
        for (const manifest of roots) {
            const metadata = workspaces.metadata.get(join(context.workspaceRoot, manifest));
            if (metadata === undefined) {
                continue;
            }
            const root = posix.dirname(manifest);
            const project = projectFor(context.workspaceRoot, root, manifest, metadata, workspaces, options);
            if (project !== null) {
                results.push([manifest, { projects: { [root]: project } }]);
            }
        }
        return results;
    }
];

/** The manifests that sit at the root of a project Nx already knows, shallowest first. */
function projectManifests(workspaceRoot: string, manifests: readonly string[]): string[] {
    return manifests
        .map((manifest) => normalizePath(manifest))
        .filter((manifest) => {
            const root = join(workspaceRoot, posix.dirname(manifest));
            return existsSync(join(root, 'project.json')) || existsSync(join(root, 'package.json'));
        })
        .sort((a, b) => a.split('/').length - b.split('/').length || a.localeCompare(b));
}

function projectFor(
    workspaceRoot: string,
    root: string,
    manifest: string,
    metadata: CargoMetadata,
    workspace: RustWorkspace,
    options: RustPluginOptions | undefined
): Partial<ProjectConfiguration> | null {
    const packages = packagesAt(workspaceRoot, root, manifest, metadata);
    if (packages.length === 0) {
        return null;
    }

    const declared = readProject(workspaceRoot, root);
    const shared = {
        targetDir: defaultTargetDir(declared.name, declared.projectType),
        inputs: inputsFor(workspaceRoot, dependencyClosure(packages, workspace), workspace),
        additionalInputs: options?.additionalInputs,
        cacheEnv: options?.cacheEnv
    };

    const targets: Record<string, TargetConfiguration> = {};
    const covered = new Set<CargoCommandName>();
    // Caching for the targets the project declares itself, whatever they are called.
    for (const [name, target] of Object.entries(declared.targets)) {
        const command = commandOf(target.executor);
        if (command !== undefined) {
            targets[name] = targetFor(command, shared, name);
            covered.add(command);
        }
    }
    // A virtual workspace aggregates its members but is not itself a crate. Whole-workspace commands require
    // explicit targets so they cannot duplicate or bypass each member's own test/build configuration.
    const isPackage = packages.some(
        (cargoPackage) => workspacePath(workspaceRoot, cargoPackage.manifest_path) === manifest
    );
    for (const command of COMMANDS) {
        const name = targetName(command, options);
        if (!isPackage || covered.has(command) || declared.targets[name] !== undefined) {
            continue;
        }
        if (
            command === 'run' &&
            !packages.some((cargoPackage) => cargoPackage.targets.some((target) => target.kind.includes('bin')))
        ) {
            continue;
        }
        targets[name] = { executor: EXECUTORS[command], ...targetFor(command, shared, name) };
    }

    return Object.keys(targets).length === 0 ? null : { targets };
}

/**
 * The packages a cargo command run at the project root builds: the one this manifest declares, or every member
 * under the project root when the manifest is a virtual one, holding only a `[workspace]`.
 */
function packagesAt(workspaceRoot: string, root: string, manifest: string, metadata: CargoMetadata): CargoPackage[] {
    const members = metadata.packages.map(
        (cargoPackage) => [workspacePath(workspaceRoot, cargoPackage.manifest_path), cargoPackage] as const
    );
    const own = members.find(([path]) => path === manifest);
    if (own !== undefined) {
        return [own[1]];
    }
    return members
        .filter(([path]) => path !== null && (root === '.' || path.startsWith(`${root}/`)))
        .map(([, cargoPackage]) => cargoPackage);
}

interface DeclaredProject {
    name: string;
    projectType: ProjectConfiguration['projectType'];
    targets: Record<string, TargetConfiguration>;
}

/**
 * What the project already says about itself. The name and type decide the default target directory, which has to
 * match the one the executors compute, and the targets decide which ones this plugin adds.
 */
function readProject(workspaceRoot: string, root: string): DeclaredProject {
    const directory = join(workspaceRoot, root);
    const projectJson = readJson<ProjectConfiguration>(join(directory, 'project.json'));
    const packageJson = readJson<{ name?: string; nx?: Partial<ProjectConfiguration> }>(
        join(directory, 'package.json')
    );
    return {
        name: projectJson?.name ?? packageJson?.nx?.name ?? packageJson?.name ?? basename(resolve(directory)),
        projectType: projectJson?.projectType ?? packageJson?.nx?.projectType,
        targets: { ...packageJson?.nx?.targets, ...projectJson?.targets }
    };
}

function readJson<T>(path: string): T | undefined {
    try {
        return JSON.parse(readFileSync(path, 'utf8')) as T;
    } catch {
        // A missing file is the normal case, and a malformed one is reported by Nx itself when it reads the
        // project. Either way it says nothing about the project, so the plugin falls back to the defaults.
        return undefined;
    }
}

function commandOf(executor: string | undefined): CargoCommandName | undefined {
    return COMMANDS.find((command) => executor === EXECUTORS[command]);
}

function targetName(command: CargoCommandName, options: RustPluginOptions | undefined): string {
    return options?.[`${command}TargetName`] ?? command;
}

interface SharedTargetConfiguration {
    targetDir: string;
    inputs: TargetConfiguration['inputs'];
    additionalInputs?: string[];
    cacheEnv?: string[];
}

function targetFor(command: CargoCommandName, shared: SharedTargetConfiguration, name: string): TargetConfiguration {
    const metadata = { technologies: ['rust'], description: DESCRIPTIONS[command] };
    // Cache restores replace output directories. Separate tasks must not overwrite a directory that
    // another task is currently compiling into, including two named build targets for one crate.
    const targetDir = `${shared.targetDir}/${name}`;
    // Running a binary is a side effect, not an artifact, and replaying the recorded output of an earlier run
    // instead of running it would be wrong.
    if (command === 'run') {
        return { cache: false, options: { targetDir }, metadata };
    }
    return {
        cache: true,
        inputs: shared.inputs,
        // Restore Cargo fingerprints, dependency artifacts and generated build-script outputs as well
        // as binaries. Test and clippy artifacts accelerate subsequent tasks and changed builds.
        outputs: ['{options.targetDir}'],
        options: {
            targetDir,
            ...(shared.additionalInputs ? { additionalInputs: shared.additionalInputs } : {}),
            ...(shared.cacheEnv ? { cacheEnv: shared.cacheEnv } : {})
        },
        metadata
    };
}

/** Rust-only inputs, independent of the workspace's Node namedInputs and npm dependencies. */
function inputsFor(
    workspaceRoot: string,
    packages: CargoPackage[],
    workspace: RustWorkspace
): TargetConfiguration['inputs'] {
    const files = rustFilePatterns(packages, workspace).flatMap((file) => {
        const path = workspacePath(workspaceRoot, file);
        return path === null ? [] : [`{workspaceRoot}/${path}`];
    });
    return [...files, { externalDependencies: [] }, ...RUST_ENV.map((env) => ({ env }))];
}
