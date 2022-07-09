# nx-cdk

## Getting started

### Prerequisite

This module is based on Nx, you will need to set up an Nx workspace before you can use nx-cdk.

```shell
npx create-nx-workspace
```

### Installation

```shell
npm i -D @cubesoft/nx-cdk
```

### Creating a nx-cdk project

```shell
nx g @cubesoft/nx-cdk:nx-cdk <name> [--dry-run]
```

### Bootstrap an AWS account

Setup the `env: { account: 'XXXXXXXXXXXX', region: 'us-east-1' }` property in `<project>/src/app.ts` and run the command below.

```shell
nx bootstrap <project> [--profile <profilename>] # optionally provide an AWS profile name
```

### Deploying the CDK Stack to AWS

Run the command below to deploy the cdk stack to AWS.

```shell
nx deploy <project> [--profile <profilename>] # optionally provide an AWS profile name
```

### Destroying a CDK Stack and remove it from AWS

Run the command below to destroy the cdk stack on AWS.

```shell
nx destroy <project> [--profile <profilename>] # optionally provide an AWS profile name
```

## Running unit tests

Run `nx test <project>` to execute the unit tests via [Jest](https://jestjs.io).
