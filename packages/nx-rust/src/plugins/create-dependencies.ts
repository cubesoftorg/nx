import { isAbsolute, join, posix, relative, sep } from 'path';

import {
    CreateDependencies,
    CreateDependenciesContext,
    DependencyType,
    ProjectConfiguration,
    RawProjectGraphDependency,
    logger,
    normalizePath
} from '@nx/devkit';

import { CargoPackage, readCargoMetadata } from '../utils/cargo-metadata';

const MANIFEST = 'Cargo.toml';

let warnedCargoMissing = false;

/**
 * Adds a project graph edge for every Cargo path dependency from a crate in one Nx project to a crate in another, so
 * that `nx affected`, `^` inputs and `^` task dependencies follow the crates that depend on a changed one.
 *
 * - Normal, build and dev dependencies all count, including optional and target-specific ones.
 * - A crate belongs to the deepest project root containing it, the rule Nx uses to assign files to projects. A
 *   nested crate that is not a project of its own, such as a `migration` crate, counts as part of the project
 *   around it.
 * - Every cargo workspace is read once, found from the `Cargo.toml` at the workspace root and at each project root.
 *   A crate excluded from the root workspace and given a `[workspace]` of its own is read on its own.
 * - An edge is `static`, with the dependent crate's `Cargo.toml` as its source file, so it belongs to the file that
 *   declares it.
 *
 * Without cargo on PATH this logs a warning and adds no edges, rather than failing every Nx command on a machine
 * that never builds Rust.
 */
export const createDependencies: CreateDependencies = (_options, context) => {
    const manifests = findManifests(context);
    const projectOf = projectResolver(context.projects);

    const packages = new Map<string, CargoPackage>();
    const read = new Set<string>();
    for (const seed of workspaceSeeds(manifests, context.projects)) {
        if (read.has(seed)) {
            continue;
        }
        const metadata = readCargoMetadata(join(context.workspaceRoot, seed));
        if (!metadata) {
            warnCargoMissing();
            return [];
        }
        read.add(seed);
        for (const cargoPackage of metadata.packages) {
            const manifest = workspacePath(context.workspaceRoot, cargoPackage.manifest_path);
            if (manifest !== null && !packages.has(manifest)) {
                packages.set(manifest, cargoPackage);
                read.add(manifest);
            }
        }
    }

    const dependencies: RawProjectGraphDependency[] = [];
    const added = new Set<string>();
    for (const [manifest, cargoPackage] of packages) {
        const source = projectOf(posix.dirname(manifest));
        if (source === undefined) {
            continue;
        }
        // A static dependency must name a file Nx assigns to its source project. A manifest Nx does not track
        // (ignored, say) still declares the dependency, so it becomes implicit rather than being dropped.
        const tracked = manifests.get(manifest) === source;

        for (const dependency of cargoPackage.dependencies) {
            if (dependency.path === undefined) {
                continue;
            }
            const directory = workspacePath(context.workspaceRoot, dependency.path);
            const target = directory === null ? undefined : projectOf(directory);
            if (target === undefined || target === source) {
                continue;
            }

            const key = tracked ? `${manifest}\0${target}` : `${source}\0${target}`;
            if (added.has(key)) {
                continue;
            }
            added.add(key);
            dependencies.push(
                tracked
                    ? { source, target, sourceFile: manifest, type: DependencyType.static }
                    : { source, target, type: DependencyType.implicit }
            );
        }
    }
    return dependencies;
};

/** Every `Cargo.toml` Nx tracks, mapped to the project it belongs to, or `null` for a file outside every project. */
function findManifests(context: CreateDependenciesContext): Map<string, string | null> {
    const manifests = new Map<string, string | null>();
    for (const [project, files] of Object.entries(context.fileMap.projectFileMap)) {
        for (const { file } of files) {
            if (isManifest(file)) {
                manifests.set(file, project);
            }
        }
    }
    for (const { file } of context.fileMap.nonProjectFiles) {
        if (isManifest(file)) {
            manifests.set(file, null);
        }
    }
    return manifests;
}

function isManifest(file: string): boolean {
    return file === MANIFEST || file.endsWith(`/${MANIFEST}`);
}

/** The manifests to start reading workspaces from: the workspace root's, then each project root's, shallowest first. */
function workspaceSeeds(
    manifests: Map<string, string | null>,
    projects: Record<string, ProjectConfiguration>
): string[] {
    const roots = new Set(['.', ...Object.values(projects).map((project) => normalizeRoot(project.root))]);
    return [...manifests.keys()]
        .filter((manifest) => roots.has(posix.dirname(manifest)))
        .sort((a, b) => a.split('/').length - b.split('/').length || a.localeCompare(b));
}

/** Finds the project owning a workspace-relative directory: the one with the deepest root containing it. */
function projectResolver(projects: Record<string, ProjectConfiguration>): (directory: string) => string | undefined {
    const byRoot = new Map<string, string>();
    for (const [name, project] of Object.entries(projects)) {
        byRoot.set(normalizeRoot(project.root), name);
    }
    return (directory) => {
        for (let current = directory; ; current = posix.dirname(current)) {
            const project = byRoot.get(current);
            if (project !== undefined || current === '.') {
                return project;
            }
        }
    };
}

function normalizeRoot(root: string): string {
    const normalized = normalizePath(root).replace(/^\.\//, '').replace(/\/+$/, '');
    return normalized === '' ? '.' : normalized;
}

/**
 * Converts an absolute path reported by cargo to a workspace-relative one with forward slashes, or `null` when it
 * lies outside the workspace.
 *
 * A plain `relative` is enough: cargo builds the paths it reports from the manifest path it was given, without
 * resolving symlinks, and that path starts with the workspace root.
 */
function workspacePath(workspaceRoot: string, absolutePath: string): string | null {
    const path = relative(workspaceRoot, absolutePath);
    if (path === '') {
        return '.';
    }
    if (isAbsolute(path) || path === '..' || path.startsWith(`..${sep}`)) {
        return null;
    }
    return normalizePath(path);
}

function warnCargoMissing() {
    if (warnedCargoMissing) {
        return;
    }
    warnedCargoMissing = true;
    logger.warn(
        '@cubesoft/nx-rust: cargo is not on PATH, so the project graph has no edges between Rust crates, and ' +
            '`nx affected` will not select the crates that depend on a changed one.'
    );
}
