<div align="center">

# @cubesoft/nx-rust

Rust executors and generators for Nx.

</div>

<hr></br>

# Features

`@cubesoft/nx-rust` provides a set of power ups on [Nx](https://nx.dev) for developing [Rust](https://www.rust-lang.org/) applications and libraries in a monorepo environment.

- **Generators**: Provides generators for creating Rust binaries and libraries in your Nx workspace.
- **Executors**: Provides executors for building, testing, linting, and running Rust projects using Cargo.
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

All Nx Rust executors automatically use a default target directory of `dist/apps/<project-name>` for applications and `dist/libs/<project-name>` for libraries. This keeps your build artifacts organized within your Nx workspace's dist folder. You can override this default by specifying the `targetDir` option in your project.json or when running commands.

### Building

```bash
nx build <project-name>
```

**Options:**

- `--toolchain=stable|beta|nightly`: Specify Rust toolchain (default: stable)
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

## Executor Options Reference

All executors support the following optional properties:

| Option        | Type                              | Description                   | Default                                  |
| ------------- | --------------------------------- | ----------------------------- | ---------------------------------------- |
| `toolchain`   | `'stable' \| 'beta' \| 'nightly'` | Rust toolchain to use         | `stable`                                 |
| `target`      | `string`                          | Build target triple           | -                                        |
| `profile`     | `string`                          | Build profile name            | -                                        |
| `release`     | `boolean`                         | Build in release mode         | `false`                                  |
| `targetDir`   | `string`                          | Directory for build artifacts | `dist/apps/<name>` or `dist/libs/<name>` |
| `features`    | `string \| string[]`              | Features to activate          | -                                        |
| `allFeatures` | `boolean`                         | Activate all features         | `false`                                  |
| `args`        | `string \| string[]`              | Additional cargo arguments    | -                                        |

**Note:** The `targetDir` option allows you to override the default output directory. If not specified, build artifacts will be placed in `dist/apps/<project-name>` for applications or `dist/libs/<project-name>` for libraries.

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
