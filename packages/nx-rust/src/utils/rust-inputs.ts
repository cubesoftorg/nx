import { dirname, join } from 'path';

import { normalizePath } from '@nx/devkit';

import { CargoPackage } from './cargo-metadata';
import { cargoConfigFiles, cargoDirectories, RustWorkspace } from './rust-workspace';

/** Crate sources; build.rs, integration tests, examples and benches are all Rust sources too. */
export function rustFilePatterns(packages: CargoPackage[], workspace: RustWorkspace): string[] {
    const patterns = new Set<string>();
    for (const pkg of packages) {
        const root = dirname(pkg.manifest_path);
        const metadata = workspace.metadata.get(pkg.manifest_path)!;
        patterns.add(join(root, '**/*.rs'));
        for (const file of ['Cargo.toml', 'Cargo.lock', 'clippy.toml', '.clippy.toml']) {
            patterns.add(join(root, file));
        }
        for (const file of ['Cargo.toml', 'Cargo.lock']) {
            patterns.add(join(metadata.workspace_root, file));
        }
        for (const directory of workspace.sourceDirectories.get(metadata.workspace_root) ?? []) {
            // Directory sources are mutable even when Cargo.lock's version/checksum stays the same.
            patterns.add(join(directory, '**/*'));
        }
        for (const file of cargoConfigFiles(root)) {
            patterns.add(file);
        }
        for (const directory of cargoDirectories(root)) {
            patterns.add(join(directory, 'rust-toolchain'));
            patterns.add(join(directory, 'rust-toolchain.toml'));
            patterns.add(join(directory, 'clippy.toml'));
            patterns.add(join(directory, '.clippy.toml'));
        }
        // Cargo supports source paths outside src/, including build scripts outside the crate directory.
        for (const target of pkg.targets) {
            if (target.src_path) {
                patterns.add(target.src_path);
            }
        }
    }
    return [...patterns].map(normalizePath).sort();
}

export const RUST_ENV = [
    'RUSTFLAGS',
    'RUSTDOCFLAGS',
    'CARGO_ENCODED_RUSTFLAGS',
    'RUSTUP_TOOLCHAIN',
    'RUSTC',
    'RUSTDOC',
    'RUSTC_WRAPPER',
    'RUSTC_WORKSPACE_WRAPPER',
    'RUSTC_BOOTSTRAP',
    'CARGO_INCREMENTAL',
    'SOURCE_DATE_EPOCH',
    'CC',
    'CXX',
    'AR',
    'CFLAGS',
    'CXXFLAGS',
    'LDFLAGS',
    'PKG_CONFIG_PATH',
    'PKG_CONFIG_LIBDIR',
    'PKG_CONFIG_SYSROOT_DIR'
];
