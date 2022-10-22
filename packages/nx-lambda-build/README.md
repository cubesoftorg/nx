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

### Creating a nx-cdk project

```shell
nx g @cubesoft/nx-lambda-build:nx-lambda-build <name> [--dry-run]
```

### Build a lambda handler

Run the command below to build your lambda handler and generate a `package.json` file with all used packages.

```shell
nx build <project> [--configuration <configuration name>] # Provide a specific build configuration
```

### Add a new lambda handler

Run the command below to add a new lambda handler. This will automatically add the required entrypoint in the `handlers.json` file for you.

```shell
nx g @cubesoft/nx-lambda-build:handler <path> [--dry-run]
```
