<div align="center">

# @cubesoft/nx-rust

Rust executors and generators for Nx.

</div>

<hr></br>

# Features

`@cubesoft/nx-rust` provides a set of power ups on [Nx](https://nx.dev) for developing [Rust](https://www.rust-lang.org/) applications and libraries in a monorepo environment.

- **Generators**: Provides generators for creating Rust binaries and libraries in your Nx workspace.
- **Executors**: Provides executors for building, testing, linting, and running Rust projects using Cargo.
- **Project Graph**: Adds a dependency between projects for every Cargo path dependency, so `nx affected` selects the crates that depend on a changed one.
- **Caching**: Makes the Rust targets of every project cacheable, with the inputs that decide what a crate compiles to and the artifacts cargo produces as outputs, so an unchanged crate is restored instead of rebuilt.
- **Toolchain Support**: Supports stable, beta, and nightly Rust toolchains.
- **Target Support**: Build for different targets (e.g., aarch64-apple-darwin, x86_64-unknown-linux-gnu).
- **Profile Support**: Use custom build profiles for different optimization levels.
- **Features Management**: Easily enable specific Cargo features or all features.
- **Integrated Workflow**: Seamlessly integrates Rust development into your Nx workspace alongside other technologies.

# Getting Started

## Prerequisite

This module is based on Nx, you will need to [set up an Nx workspace](https://nx.dev/getting-started/intro) before you can use `nx-rust`.

```bash
npx create-nx-workspace@latest
```

You also need to have [Rust and Cargo](https://www.rust-lang.org/tools/install) installed on your system:

**macOS/Linux:**

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

**Windows (using Chocolatey):**

```bash
choco install rust
```

## Installation

```bash
npm install -D @cubesoft/nx-rust
```

## Creating Rust Projects

### Creating a Rust Binary Application

```bash
nx g @cubesoft/nx-rust:binary <app-name>
```

This will create a new Rust binary application in `apps/<app-name>` with:

- A `Cargo.toml` manifest file
- A `src/main.rs` entry point
- Pre-configured Nx targets for build, test, lint, and run

### Creating a Rust Library

```bash
nx g @cubesoft/nx-rust:library <lib-name>
```

This will create a new Rust library in `libs/<lib-name>` with:

- A `Cargo.toml` manifest file
- A `src/lib.rs` entry point with example code and tests
- Pre-configured Nx targets for build, test, and lint

### Generator Options

Both generators support the following options:

- `--directory=<dir>`: Place the project in a specific directory
- `--tags=<tags>`: Add tags to the project (comma-separated)

Example:

```bash
nx g @cubesoft/nx-rust:binary my-app --directory=apps/rust --tags=rust,cli
```

## Working with Rust Projects

All Nx Rust executors automatically use a target directory of `dist/apps/<project-name>/<target-name>` for applications and `dist/libs/<project-name>/<target-name>` for libraries. Each Nx target has its own directory, so concurrent cache restores cannot overwrite another target's Cargo artifacts. You can override this default by specifying the `targetDir` option in your project.json or when running commands.

### Building

```bash
nx build <project-name>
```

**Options:**

- `--toolchain=stable|beta|nightly`: Specify Rust toolchain (otherwise Cargo/rustup selects the workspace toolchain)
- `--target="<target>"`: Build for specific target (e.g., aarch64-apple-darwin)
- `--profile="<profile>"`: Use specific build profile
- `--release`: Build in release mode
- `--target-dir="<dir>"`: Directory for build artifacts
- `--features="<features>"`: Comma-separated list of features to activate
- `--all-features`: Activate all available features
- `--args="<args>"`: Additional arguments to pass to cargo build

Example:

```bash
nx build my-app --release --features="cli,logging"
nx build my-app --target="x86_64-unknown-linux-musl" --release
nx build my-app --toolchain=nightly --all-features
```

### Testing

```bash
nx test <project-name>
```

Supports all the same options as the build executor.

Example:

```bash
nx test my-lib --all-features
```

### Linting

```bash
nx lint <project-name>
```

Runs `cargo clippy` to lint your Rust code. Supports all the same options as the build executor.

Example:

```bash
nx lint my-app --toolchain=nightly
```

### Running (Binary Projects Only)

```bash
nx run <project-name>
```

Executes your Rust binary using `cargo run`. Supports all the same options as the build executor.

Example:

```bash
nx run my-app --release -- --custom-arg value
```

> **Note:** Arguments after `--` are passed to your application, not to cargo.

## Project Graph and Rust Caching

Newly generated Rust projects register the plugin automatically. For existing projects, register it in `nx.json`:

```json
{
    "plugins": ["@cubesoft/nx-rust/plugin"]
}
```

The plugin adds build, test and lint targets to existing Nx projects whose `Cargo.toml` declares a Cargo package and sits beside their `project.json` or `package.json`. It also supplies caching settings for declared targets using these executors, including custom names such as `build-release`. Binary crates get an uncached run target. Explicit project settings take precedence over inferred settings.

A virtual Cargo workspace (a manifest with `[workspace]` and no `[package]`) receives no automatically inferred targets, including at the Nx workspace root. Its manifests, lockfiles and dependencies still contribute to member crates' inputs and dependency discovery. To run whole-workspace Cargo commands, explicitly declare targets using the Rust executors; the plugin supplies their caching settings without adding other targets. Roots declaring both `[package]` and `[workspace]` still receive the usual crate targets.

### Cargo dependencies

Dependency discovery uses `cargo metadata --format-version=1 --no-deps`. It follows normal, build, dev, optional and target-specific path dependencies, including inherited workspace dependencies, local `[patch]` / `[replace]` entries and Cargo config path overrides. When a lockfile and cached registry/git sources are available, a second `cargo metadata --all-features --locked --offline` pass also finds local patches reached through registry crates. Discovery never fetches dependencies or writes a lockfile. With a cold registry cache, direct local graph edges remain available; indirect local patch candidates are conservatively hashed, and can be declared as `implicitDependencies` if they must also participate in `nx affected` before dependency sources are available.

Local crates outside workspace membership are read recursively. The deepest Nx project containing a crate owns it; nested crates do not become new Nx projects. Dependencies through crates without Nx projects are followed until another Nx project is reached. Project graph edges are implicit and recomputed, so changing an inherited dependency or patch in the workspace manifest updates `nx affected` without `nx reset`.

Cargo must be on `PATH`. Graph inference warns and skips Rust projects if it is missing; executing or hashing a Rust task requires Cargo.

### Rust-only hashes

Build, test and lint use a custom task hasher. It hashes the Cargo dependency closure directly, rather than inheriting Nx's automatic npm, TypeScript and workspace configuration hashes.

The default hash includes:

- Rust sources, manifests, build scripts, integration tests, examples and benches in the selected crates and their transitive local dependencies.
- The relevant Cargo workspace manifests and lockfiles.
- Cargo configuration, toolchain files and Clippy configuration, including ancestor directories and Cargo home configuration. Configured directory sources (vendored crates) are hashed too.
- Literal `include!`, `include_str!`, `include_bytes!` resources and `#[path]` modules.
- The selected rustc version (including host/commit information), Cargo version, host platform, Rust/compiler flags, Cargo target/profile settings and common native build environment variables.
- The current executor, selected configuration and effective Rust executor options, including CLI overrides.

Ordinary changes to `package.json`, Node lockfiles, JavaScript, TypeScript configuration, Node target defaults or workspace named inputs do not invalidate these hashes. An unrelated Rust crate's sources also do not invalidate a task. A shared Cargo manifest or lockfile change intentionally invalidates its workspace's tasks.

Rust metadata is reused between task hashes and refreshed when Cargo manifests or configuration change. Optional and target-specific local dependencies and local patch candidates are included conservatively, so enabling different features cannot yield a stale cache hit. `--workspace` / `--package` selections in `args` conservatively hash the workspace's local crates.

### Build scripts, fixtures and custom inputs

Arbitrary build scripts and tests can consume files and environment variables Cargo metadata cannot describe. Declare these resources explicitly. This is also needed for nonliteral include paths, native libraries, and resources or configuration supplied through custom Cargo flags:

```json
{
    "targets": {
        "build": {
            "executor": "@cubesoft/nx-rust:build",
            "options": {
                "additionalInputs": [
                    "{projectRoot}/native/**/*",
                    "{projectRoot}/schemas/**/*",
                    "{workspaceRoot}/vendor/**/*"
                ],
                "cacheEnv": ["MY_BUILD_SETTING"],
                "args": ["--locked"]
            }
        }
    }
}
```

You can also set `additionalInputs` and `cacheEnv` globally in the Rust plugin options. Relative additional file patterns are workspace-relative. Explicit `inputs` in `project.json`, `package.json.nx.targets` or executor-specific `targetDefaults` are additive and honored, including named file inputs, runtime commands and environment variables. Referencing Node files explicitly will make them affect the hash. Advanced Nx project/output inputs opt into Nx's standard hash as well.

### Cached outputs and CI

Build, test and lint cache the entire configured `targetDir`: binaries, libraries, test executables, Clippy metadata, dependency artifacts, fingerprints, incremental state and build-script outputs. Cache hits restore these artifacts and terminal output; Cargo does not run again for unchanged tasks. Restored intermediates can also help subsequent Cargo invocations, although Cargo may rebuild local crates when source timestamps or absolute build-script paths differ on a new runner.

Default directories are isolated per Nx target, such as `dist/apps/api/build` and `dist/apps/api/test`. Configure `targetDir` to change them; use this executor option instead of passing `--target-dir` in `args`. Tasks explicitly sharing a directory must run sequentially to avoid overlapping cache restores. Sharing a directory can reuse compilation work between build, test and lint when they run sequentially.

For CI:

- Commit `Cargo.lock` and use `args: ["--locked"]` for reproducible dependency versions.
- Pin a toolchain with `rust-toolchain.toml`, or set `toolchain` explicitly. The selected toolchain's actual version is always hashed.
- Use an Nx remote cache to share artifacts between workers. Full Cargo directories trade larger cache uploads for reusable compiler artifacts.
- Cargo already builds its Rust dependency closure. Avoid an additional `^build` for these targets, which compiles libraries again into separate directories.

Generic Nx target defaults can override plugin inference. Keep Rust defaults executor-specific, especially if the workspace has Node `build` defaults:

```json
{
    "targetDefaults": {
        "@cubesoft/nx-rust:build": {
            "cache": true,
            "dependsOn": [],
            "outputs": ["{options.targetDir}"]
        },
        "@cubesoft/nx-rust:test": {
            "cache": true,
            "outputs": ["{options.targetDir}"]
        },
        "@cubesoft/nx-rust:lint": {
            "cache": true,
            "outputs": ["{options.targetDir}"]
        }
    }
}
```

Generated projects set their cache/output settings explicitly. Run `nx show project <name>` to inspect merged target settings. Changes to Rust executor options or explicit Rust inputs still invalidate the cache even if those settings are stored in `nx.json` or `package.json`.

### Plugin options

```json
{
    "plugins": [
        {
            "plugin": "@cubesoft/nx-rust/plugin",
            "options": {
                "buildTargetName": "build",
                "testTargetName": "test",
                "lintTargetName": "lint",
                "runTargetName": "run",
                "additionalInputs": ["{workspaceRoot}/rust-resources/**/*"],
                "cacheEnv": ["MY_BUILD_SETTING"]
            }
        }
    ]
}
```

## Executor Options Reference

All executors support the following optional properties:

| Option             | Type                              | Description                                   | Default                                                    |
| ------------------ | --------------------------------- | --------------------------------------------- | ---------------------------------------------------------- |
| `toolchain`        | `'stable' \| 'beta' \| 'nightly'` | Rust toolchain to use                         | Cargo/rustup workspace selection                           |
| `target`           | `string`                          | Build target triple                           | -                                                          |
| `profile`          | `string`                          | Build profile name                            | -                                                          |
| `release`          | `boolean`                         | Build in release mode                         | `false`                                                    |
| `targetDir`        | `string`                          | Directory for build artifacts                 | `dist/apps/<name>/<target>` or `dist/libs/<name>/<target>` |
| `features`         | `string \| string[]`              | Features to activate                          | -                                                          |
| `allFeatures`      | `boolean`                         | Activate all features                         | `false`                                                    |
| `args`             | `string \| string[]`              | Additional cargo arguments                    | -                                                          |
| `additionalInputs` | `string[]`                        | Extra build-script resources or test fixtures | -                                                          |
| `cacheEnv`         | `string[]`                        | Extra build-script/test environment variables | -                                                          |

**Note:** The `targetDir` option allows you to override the default output directory. If not specified, build artifacts will be placed in `dist/apps/<project-name>/<target-name>` for applications or `dist/libs/<project-name>/<target-name>` for libraries.

## Minimal Project Structure

After creating Rust projects, your workspace will look like this:

```treeview
<workspace-name>/
├── apps/
│   └── my-rust-app/
│       ├── Cargo.toml
│       ├── README.md
│       └── src/
│           └── main.rs
├── libs/
│   └── my-rust-lib/
│       ├── Cargo.toml
│       ├── README.md
│       └── src/
│           └── lib.rs
├── nx.json
├── package.json
└── tsconfig.json
```

## Support

If you're having any problem, please raise an issue on GitHub and we'll be happy to help.

## Attribution

This project is built on top of the [Nx](https://nx.dev) platform and uses [Cargo](https://doc.rust-lang.org/cargo/) under the hood for all Rust operations.
