import { join, posix } from 'path';

import {
    CreateDependencies,
    CreateDependenciesContext,
    DependencyType,
    ProjectConfiguration,
    RawProjectGraphDependency
} from '@nx/devkit';

import { warnCargoMissing } from '../utils/cargo-metadata';
import { normalizeRoot, workspacePath } from '../utils/paths';
import { localDependencies, readRustWorkspace } from '../utils/rust-workspace';

const MANIFEST = 'Cargo.toml';

/**
 * Adds a project graph edge for every Cargo path dependency from a crate in one Nx project to a crate in another, so
 * that `nx affected`, `^` inputs and `^` task dependencies follow the crates that depend on a changed one.
 *
 * - Normal, build and dev dependencies all count, including optional and target-specific ones.
 * - A crate belongs to the deepest project root containing it, the rule Nx uses to assign files to projects. A
 *   nested crate that is not a project of its own, such as a `migration` crate, counts as part of the project
 *   around it.
 * - Every tracked manifest can seed discovery, including excluded crates and crates without Nx projects.
 *   Local patches and dependencies reached through cached registry metadata count too.
 * - Edges are implicit and recomputed, so inherited dependencies and patches can change independently of
 *   the member manifest without retaining stale static edges in Nx's file cache.
 *
 * Without cargo on PATH this logs a warning and adds no edges, rather than failing every Nx command on a machine
 * that never builds Rust.
 */
export const createDependencies: CreateDependencies = (_options, context) => {
    const manifests = findManifests(context);
    const projectOf = projectResolver(context.projects);

    const workspace = readRustWorkspace(
        [...manifests.keys()]
            .sort((a, b) => a.split('/').length - b.split('/').length || a.localeCompare(b))
            .map((manifest) => join(context.workspaceRoot, manifest))
    );
    if (workspace === null) {
        warnCargoMissing('the project graph has no edges between Rust crates.');
        return [];
    }
    const dependencies: RawProjectGraphDependency[] = [];
    const added = new Set<string>();
    for (const [manifest, pkg] of workspace.packages) {
        const path = workspacePath(context.workspaceRoot, manifest);
        const source = path === null ? undefined : projectOf(posix.dirname(path));
        if (source === undefined) continue;
        const pending = localDependencies(pkg, workspace);
        const visited = new Set<string>();
        while (pending.length > 0) {
            const dependency = pending.pop()!;
            if (visited.has(dependency)) continue;
            visited.add(dependency);
            const directory = workspacePath(context.workspaceRoot, posix.dirname(dependency));
            const target = directory === null ? undefined : projectOf(directory);
            if (target && target !== source) {
                const key = `${source}\0${target}`;
                if (!added.has(key)) {
                    added.add(key);
                    // Nx caches static edges by the member manifest alone. Inherited workspace
                    // dependencies and patches can change without that file changing; recompute them.
                    dependencies.push({ source, target, type: DependencyType.implicit });
                }
            } else {
                // Bridge through crates with no Nx project (or crates inside the same project).
                const next = workspace.packages.get(dependency);
                if (next) pending.push(...localDependencies(next, workspace));
            }
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
