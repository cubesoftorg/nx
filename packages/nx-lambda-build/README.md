# nx-lambda-build

## Getting started

### Prerequisite

This module is based on Nx, you will need to set up an Nx workspace before you can use nx-cdk.

```shell
npx create-nx-workspace
```

### Installation

```shell
npm i -D @cubesoft/nx-lambda-build
```

### Creating a nx-lambda-build project

```shell
nx g @cubesoft/nx-lambda-build:nx-lambda-build <name> [--dry-run]
```

### Build a lambda handler

Run the command below to build your lambda handler and generate a `package.json` file with all used packages.

```shell
nx build <project> [--configuration <configuration name>] # Provide a specific build configuration
```

### Project options

```json
"targets": {
    "build": {
        "executor": "@cubesoft/nx-lambda-build:build",
        "options": {
            "target": "node16",
            "architecture": "arm64",
            "platform": "linux",
            "installModules": true
        }
    }
}
```

`target`: esbuild build target
`architecture`: esbuild target architecture
`platform`: npm install platform
`installModules`: whether node_modules should be installed and bundled with the handler zip package

### Add a new lambda handler (currently not working)

Run the command below to add a new lambda handler. This will automatically add the required entrypoint in the `handlers.json` file for you.

```shell
nx g @cubesoft/nx-lambda-build:handler <path> [--dry-run]
```
