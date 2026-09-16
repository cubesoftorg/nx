import { sync as spawnSync } from 'cross-spawn';
import { dirname } from 'path';

/** The part of `cargo metadata --format-version 1` output the project graph reads. */
export interface CargoMetadata {
    packages: CargoPackage[];
    workspace_root: string;
}

export interface CargoPackage {
    name: string;
    /** Absolute path of the package's `Cargo.toml`. */
    manifest_path: string;
    dependencies: CargoDependency[];
}

export interface CargoDependency {
    name: string;
    /** `null` for a normal dependency. */
    kind: 'dev' | 'build' | null;
    /** Absolute directory of a path dependency. Absent for registry and git dependencies. */
    path?: string;
}

/**
 * Reads the members of the cargo workspace `manifestPath` belongs to, with the dependencies each member's manifest
 * declares.
 *
 * `--no-deps` skips dependency resolution, which the project graph does not need: a path dependency is declared in
 * the manifest. It also means cargo never reads `Cargo.lock`, the registry or the network, so a stale lockfile or an
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
