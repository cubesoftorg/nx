# @cubesoft/nx-electron

## Getting started

### Prerequisite

This module is based on Nx, you will need to set up an Nx workspace before you can use @cubesoft/nx-electron.

```shell
npx create-nx-workspace
```

### Installation

```shell
npm i -D @cubesoft/nx-electron
```

### Creating a nx-electron project

```shell
nx g @cubesoft/nx-electron:application <name> <frontendProject> [--dry-run]
```

### Build the app

Run the command below to build your app and generate a `package.json` file with all used packages.

```shell
nx build <project> [--configuration <configuration name>] # Provide a specific build configuration
```
