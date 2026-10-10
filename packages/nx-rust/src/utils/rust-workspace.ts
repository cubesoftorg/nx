import { existsSync, readFileSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { parse } from 'smol-toml';

import { CargoMetadata, CargoPackage, readCargoMetadata, readResolvedCargoMetadata } from './cargo-metadata';

/** Cargo's configuration search order, from the working directory upwards. */
export function cargoDirectories(directory: string): string[] {
    const directories: string[] = [];
    for (let current = resolve(directory); ; current = dirname(current)) {
        directories.push(current);
        if (dirname(current) === current) {
            return directories;
        }
    }
}

export function cargoConfigFiles(directory: string, cargoHome = process.env['CARGO_HOME']): string[] {
    const files = cargoDirectories(directory).flatMap((root) => [
        join(root, '.cargo/config'),
        join(root, '.cargo/config.toml')
    ]);
    const home = cargoHome ?? (process.env['HOME'] ? join(process.env['HOME'], '.cargo') : undefined);
    if (home) {
        files.push(join(home, 'config'), join(home, 'config.toml'));
    }
    return [...new Set(files)];
}

export interface RustWorkspace {
    packages: Map<string, CargoPackage>;
    metadata: Map<string, CargoMetadata>;
    /** Local candidates for patched packages, including optional/target-specific patches. */
    patches: Map<string, Map<string, Set<string>>>;
    /** Local dependencies reached through registry/git crates in a locked, offline resolution. */
    resolvedDependencies: Map<string, string[]>;
    sourceDirectories: Map<string, Set<string>>;
    resolutionInputs: Set<string>;
}

/**
 * Read local Cargo packages without fetching the network or writing a lockfile.
 * Unlike a single --no-deps call, this follows path dependencies outside the workspace's members and
 * local [patch], [replace] and Cargo config path overrides. Keeping all candidates is conservative:
 * Cargo may choose different optional dependencies/patch versions with different executor flags.
 * With an existing lockfile, cached registry/git metadata can enrich the graph using --locked --offline.
 */
export function readRustWorkspace(manifests: string[]): RustWorkspace | null {
    const workspace: RustWorkspace = {
        packages: new Map(),
        metadata: new Map(),
        patches: new Map(),
        resolvedDependencies: new Map(),
        sourceDirectories: new Map(),
        resolutionInputs: new Set()
    };
    const pending = [...manifests.map((manifest) => resolve(manifest))];
    const visited = new Set<string>();
    const configRead = new Set<string>();
    const resolvedRoots = new Set<string>();
    const addPatch = (cargoRoot: string, name: string, directory: string) => {
        const manifest = join(directory, 'Cargo.toml');
        const patches = workspace.patches.get(cargoRoot) ?? new Map<string, Set<string>>();
        const candidates = patches.get(name) ?? new Set<string>();
        candidates.add(manifest);
        patches.set(name, candidates);
        workspace.patches.set(cargoRoot, patches);
        pending.push(manifest);
    };

    while (pending.length > 0) {
        const manifest = pending.shift()!;
        if (visited.has(manifest)) {
            continue;
        }
        visited.add(manifest);
        const metadata = readCargoMetadata(manifest);
        if (metadata === null) {
            return null;
        }
        workspace.metadata.set(manifest, metadata);
        for (const pkg of metadata.packages) {
            const path = resolve(pkg.manifest_path);
            workspace.packages.set(path, pkg);
            workspace.metadata.set(path, metadata);
            visited.add(path);
            for (const dependency of pkg.dependencies) {
                if (dependency.path) {
                    pending.push(join(dependency.path, 'Cargo.toml'));
                }
            }
        }

        const rootManifest = join(metadata.workspace_root, 'Cargo.toml');
        if (!resolvedRoots.has(rootManifest) && existsSync(join(metadata.workspace_root, 'Cargo.lock'))) {
            resolvedRoots.add(rootManifest);
            const resolved = readResolvedCargoMetadata(manifest);
            if (resolved?.resolve) {
                for (const pkg of resolved.packages) workspace.resolutionInputs.add(pkg.manifest_path);
                const byId = new Map(resolved.packages.map((pkg) => [pkg.id, pkg]));
                const dependencies = new Map(resolved.resolve.nodes.map((node) => [node.id, node.dependencies]));
                for (const pkg of resolved.packages.filter((pkg) => pkg.source === null)) {
                    pending.push(pkg.manifest_path);
                    const local = new Set<string>();
                    const seen = new Set<string>();
                    const queue = [...(dependencies.get(pkg.id!) ?? [])];
                    while (queue.length > 0) {
                        const id = queue.pop()!;
                        if (seen.has(id)) continue;
                        seen.add(id);
                        const dependency = byId.get(id);
                        if (dependency?.source === null) local.add(dependency.manifest_path);
                        else queue.push(...(dependencies.get(id) ?? []));
                    }
                    workspace.resolvedDependencies.set(pkg.manifest_path, [
                        ...new Set([...(workspace.resolvedDependencies.get(pkg.manifest_path) ?? []), ...local])
                    ]);
                }
            }
        }
        for (const file of [rootManifest, ...cargoConfigFiles(dirname(manifest))]) {
            const configKey = `${metadata.workspace_root}\0${file}`;
            if (configRead.has(configKey) || !existsSync(file)) {
                continue;
            }
            configRead.add(configKey);
            const config = parse(readFileSync(file, 'utf8'));
            // Relative paths in .cargo/config are relative to the directory containing .cargo.
            const base = file === rootManifest ? dirname(file) : dirname(dirname(file));
            for (const source of Object.values((config['source'] ?? {}) as Record<string, { directory?: string }>)) {
                if (source.directory) {
                    const directories = workspace.sourceDirectories.get(metadata.workspace_root) ?? new Set<string>();
                    directories.add(resolve(base, source.directory));
                    workspace.sourceDirectories.set(metadata.workspace_root, directories);
                }
            }
            const tables = [
                ...Object.values((config['patch'] ?? {}) as Record<string, Record<string, unknown>>),
                (config['replace'] ?? {}) as Record<string, unknown>
            ];
            for (const table of tables) {
                for (const [name, value] of Object.entries(table)) {
                    if (typeof value === 'object' && value !== null && 'path' in value) {
                        const entry = value as { path: string; package?: string };
                        addPatch(
                            metadata.workspace_root,
                            entry.package ?? name.split(':')[0],
                            resolve(base, entry.path)
                        );
                    }
                }
            }
            for (const directory of (config['paths'] ?? []) as string[]) {
                const path = resolve(base, directory);
                const pkg = parse(readFileSync(join(path, 'Cargo.toml'), 'utf8'))['package'] as { name: string };
                addPatch(metadata.workspace_root, pkg.name, path);
            }
        }
    }
    return workspace;
}

/** All potential local dependencies, including optional, build, dev and patched dependencies. */
export function localDependencies(pkg: CargoPackage, workspace: RustWorkspace): string[] {
    const manifests = new Set<string>(workspace.resolvedDependencies.get(pkg.manifest_path) ?? []);
    for (const dependency of pkg.dependencies) {
        if (dependency.path) {
            manifests.add(join(dependency.path, 'Cargo.toml'));
        } else {
            const cargoRoot = workspace.metadata.get(pkg.manifest_path)!.workspace_root;
            for (const manifest of workspace.patches.get(cargoRoot)?.get(dependency.name) ?? []) {
                manifests.add(manifest);
            }
        }
    }
    return [...manifests];
}

export function dependencyClosure(packages: CargoPackage[], workspace: RustWorkspace): CargoPackage[] {
    const result = new Map<string, CargoPackage>();
    const pending = [...packages];
    while (pending.length > 0) {
        const pkg = pending.pop()!;
        const manifest = resolve(pkg.manifest_path);
        if (result.has(manifest)) {
            continue;
        }
        result.set(manifest, pkg);
        for (const dependency of localDependencies(pkg, workspace)) {
            const target = workspace.packages.get(dependency);
            if (target) {
                pending.push(target);
            }
        }
        if (
            !workspace.resolvedDependencies.has(pkg.manifest_path) &&
            pkg.dependencies.some((dependency) => !dependency.path)
        ) {
            // Without cached registry sources, a registry dependency may itself use any local patch.
            // Hash those candidates conservatively rather than reuse an artifact with stale patched code.
            const cargoRoot = workspace.metadata.get(pkg.manifest_path)!.workspace_root;
            for (const candidates of workspace.patches.get(cargoRoot)?.values() ?? []) {
                for (const manifest of candidates) {
                    const candidate = workspace.packages.get(manifest);
                    if (candidate) pending.push(candidate);
                }
            }
        }
    }
    return [...result.values()];
}

const cachedWorkspaces = new Map<string, { workspace: RustWorkspace; snapshot: Map<string, string | null> }>();

/** Reuse metadata between build/test/lint hashes; refresh when any manifest or Cargo config changes. */
export function readCachedRustWorkspace(manifest: string): RustWorkspace | null {
    const path = resolve(manifest);
    const key = `${path}\0${process.env['CARGO_HOME'] ?? ''}\0${process.env['RUSTUP_TOOLCHAIN'] ?? ''}`;
    const cached = cachedWorkspaces.get(key);
    const contents = (file: string) => (existsSync(file) ? readFileSync(file, 'utf8') : null);
    if (cached && [...cached.snapshot].every(([file, previous]) => contents(file) === previous)) {
        return cached.workspace;
    }
    const workspace = readRustWorkspace([path]);
    if (workspace === null) return null;
    const files = new Set<string>(workspace.resolutionInputs);
    for (const [path, metadata] of workspace.metadata) {
        files.add(path);
        files.add(join(metadata.workspace_root, 'Cargo.toml'));
        files.add(join(metadata.workspace_root, 'Cargo.lock'));
        for (const config of cargoConfigFiles(dirname(path))) files.add(config);
    }
    // Bound the process cache: Nx may keep a plugin process alive across many workspaces.
    if (cachedWorkspaces.size >= 32) cachedWorkspaces.delete(cachedWorkspaces.keys().next().value!);
    cachedWorkspaces.set(key, { workspace, snapshot: new Map([...files].map((file) => [file, contents(file)])) });
    return workspace;
}
