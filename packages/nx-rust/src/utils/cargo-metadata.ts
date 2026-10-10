import { logger } from '@nx/devkit';
import { sync as spawnSync } from 'cross-spawn';
import { dirname } from 'path';

/** The part of `cargo metadata --format-version 1` output the plugin reads. */
export interface CargoMetadata {
    packages: CargoPackage[];
    workspace_root: string;
    resolve?: { nodes: { id: string; dependencies: string[] }[] } | null;
}

export interface CargoPackage {
    name: string;
    id?: string;
    source?: string | null;
    /** Absolute path of the package's `Cargo.toml`. */
    manifest_path: string;
    dependencies: CargoDependency[];
    targets: CargoTarget[];
}

/**
 * Enrich the local graph with dependencies reached through registry/git crates when the existing
 * lockfile and cached registry sources allow it. Never fetch the network or change Cargo.lock.
 * A cold/offline cache or conflicting all-features resolution simply keeps the no-deps graph.
 */
export function readResolvedCargoMetadata(manifestPath: string): CargoMetadata | null {
    const result = spawnSync(
        'cargo',
        [
            'metadata',
            '--format-version=1',
            '--all-features',
            '--locked',
            '--offline',
            `--manifest-path=${manifestPath}`
        ],
        { cwd: dirname(manifestPath), encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, windowsHide: true }
    );
    return result.error || result.status !== 0 ? null : (JSON.parse(result.stdout) as CargoMetadata);
}

export interface CargoDependency {
    name: string;
    /** `null` for a normal dependency. */
    kind: 'dev' | 'build' | null;
    /** Absolute directory of a path dependency. Absent for registry and git dependencies. */
    path?: string;
}

/** A build target of a package: a binary, a library, an example, a test or a benchmark. */
export interface CargoTarget {
    /** `bin`, `lib`, `rlib`, `cdylib`, `staticlib`, `proc-macro`, `example`, `test`, `bench` or `custom-build`. */
    kind: string[];
    crate_types: string[];
    /** Absolute source entry point, including custom lib/bin/build-script paths. */
    src_path?: string;
    name: string;
}

/**
 * Reads the members of the cargo workspace `manifestPath` belongs to, with the dependencies each member's manifest
 * declares and the targets it builds.
 *
 * `--no-deps` skips dependency resolution, which the plugin does not need: a path dependency is declared in the
 * manifest. It also means cargo never reads `Cargo.lock`, the registry or the network, so a stale lockfile or an
 * offline machine cannot fail the project graph, and an optional dependency no enabled feature activates is still
 * listed.
 *
 * @returns `null` when cargo is not installed.
 * @throws When cargo is installed but cannot read the workspace.
 */
export function readCargoMetadata(manifestPath: string): CargoMetadata | null {
    // cwd is the crate's directory, as for a cargo command run by hand there: cargo picks up the
    // `.cargo/config.toml` and `rust-toolchain.toml` nearest to it.
    const result = spawnSync(
        'cargo',
        ['metadata', '--format-version=1', '--no-deps', `--manifest-path=${manifestPath}`],
        {
            cwd: dirname(manifestPath),
            encoding: 'utf8',
            maxBuffer: 256 * 1024 * 1024,
            windowsHide: true
        }
    );

    if (result.error) {
        if ((result.error as NodeJS.ErrnoException).code === 'ENOENT') {
            return null;
        }
        throw new Error(`Could not run \`cargo metadata\` for ${manifestPath}: ${result.error.message}`);
    }
    if (result.status !== 0) {
        const exit = result.status === null ? `signal ${result.signal}` : `exit code ${result.status}`;
        throw new Error(`\`cargo metadata\` failed for ${manifestPath} (${exit}):\n${result.stderr}`);
    }
    return JSON.parse(result.stdout) as CargoMetadata;
}

let warnedCargoMissing = false;

/**
 * Warns once per process that cargo is missing. Both plugin hooks degrade rather than fail, so that Nx keeps
 * working on a machine that never builds Rust, but the reason has to be visible.
 */
export function warnCargoMissing(consequence: string) {
    if (warnedCargoMissing) {
        return;
    }
    warnedCargoMissing = true;
    logger.warn(`@cubesoft/nx-rust: cargo is not on PATH, so ${consequence}`);
}
