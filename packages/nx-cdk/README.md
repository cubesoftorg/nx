<div align="center">

# @cubesoft/nx-cdk

AWS CDK executors and generators for Nx.

</div>

<hr></br>

# Features

`@cubesoft/nx-cdk` provides a set of power ups on [Nx](https://nx.dev) for developing [AWS CDK](https://aws.amazon.com/cdk/) applications in a monorepo environment.

- **Generators**: Provides generators for creating AWS CDK projects in your Nx workspace.
- **Executors**: Provides executors for bootstrapping, deploying, destroying, and managing AWS CDK stacks.
- **AWS Integration**: Seamlessly integrates with AWS accounts using profiles and environment configuration.
- **Stack Management**: Full lifecycle management of CloudFormation stacks through CDK.
- **Diff Support**: Preview infrastructure changes before deployment.
- **Garbage Collection**: Clean up unused CDK resources (experimental feature).
- **Integrated Workflow**: Seamlessly integrates AWS CDK development into your Nx workspace alongside other technologies.

# Getting Started

## Prerequisite

This module is based on Nx, you will need to [set up an Nx workspace](https://nx.dev/getting-started/intro) before you can use `@cubesoft/nx-cdk`.

```bash
npx create-nx-workspace@latest
```

You also need to have the [AWS CLI](https://aws.amazon.com/cli/) configured on your system with appropriate credentials.

## Installation

```bash
npm install -D @cubesoft/nx-cdk
```

## Creating CDK Projects

### Creating a CDK Application

```bash
nx g @cubesoft/nx-cdk:nx-cdk <app-name>
```

This will create a new AWS CDK application in `apps/<app-name>` with:

- A CDK application structure
- TypeScript configuration
- Pre-configured Nx targets for bootstrap, deploy, destroy, diff, synth, ls, and gc

### Generator Options

The generator supports the following options:

- `--directory=<dir>`: Place the project in a specific directory
- `--tags=<tags>`: Add tags to the project (comma-separated)
- `--dry-run`: Preview the changes without creating files

Example:

```bash
nx g @cubesoft/nx-cdk:nx-cdk my-infrastructure --directory=apps/aws --tags=cdk,infrastructure
```

## Working with CDK Projects

### Configuring AWS Environment

Before deploying, configure the AWS environment in your CDK app file (typically `src/app.ts`):

```typescript
const app = new cdk.App();
new MyStack(app, 'MyStack', {
    env: { account: 'XXXXXXXXXXXX', region: 'us-east-1' }
});
```

### Bootstrapping

Bootstrap your AWS account for CDK deployments (required once per account/region):

```bash
nx bootstrap <project-name>
```

**Options:**

- `--profile="<profile>"`: Use a specific AWS profile from your credentials
- Additional AWS CDK bootstrap arguments can be passed

Example:

```bash
nx bootstrap my-infrastructure --profile=production
```

### Deploying

Deploy your CDK stack to AWS:

```bash
nx deploy <project-name>
```

**Options:**

- `--profile="<profile>"`: Use a specific AWS profile
- Additional AWS CDK deploy arguments can be passed (e.g., `--require-approval never`)

Example:

```bash
nx deploy my-infrastructure --profile=production
nx deploy my-infrastructure --require-approval never
```

### Synthesizing

Generate CloudFormation templates from your CDK code:

```bash
nx synth <project-name>
```

**Options:**

- `--profile="<profile>"`: Use a specific AWS profile
- Additional AWS CDK synth arguments can be passed

Example:

```bash
nx synth my-infrastructure
```

### Viewing Differences

Preview infrastructure changes before deployment:

```bash
nx diff <project-name>
```

**Options:**

- `--profile="<profile>"`: Use a specific AWS profile
- Additional AWS CDK diff arguments can be passed

Example:

```bash
nx diff my-infrastructure --profile=production
```

### Listing Stacks

List all CDK stacks in your application:

```bash
nx ls <project-name>
```

**Options:**

- `--profile="<profile>"`: Use a specific AWS profile
- Additional AWS CDK ls arguments can be passed

Example:

```bash
nx ls my-infrastructure
```

### Garbage Collection (Experimental)

Clean up unused CDK resources (requires `--unstable=gc` flag):

```bash
nx gc <project-name>
```

**Options:**

- `--profile="<profile>"`: Use a specific AWS profile
- Additional AWS CDK gc arguments can be passed

> **Note:** This feature is experimental and automatically includes the `--unstable=gc` flag required by AWS CDK.

Example:

```bash
nx gc my-infrastructure --profile=production
```

### Destroying

Remove your CDK stack from AWS:

```bash
nx destroy <project-name>
```

**Options:**

- `--profile="<profile>"`: Use a specific AWS profile
- Additional AWS CDK destroy arguments can be passed

Example:

```bash
nx destroy my-infrastructure --profile=production
```

## Executor Options Reference

All executors support passing AWS profile and additional CDK-specific arguments. Common options include:

| Option    | Type     | Description                                 | Default |
| --------- | -------- | ------------------------------------------- | ------- |
| `profile` | `string` | AWS profile name from your credentials file | -       |

Additional arguments can be passed directly and will be forwarded to the respective CDK command.

## Minimal Project Structure

After creating a CDK project, your workspace will look like this:

```treeview
<workspace-name>/
├── apps/
│   └── my-cdk-app/
│       ├── src/
│       │   ├── app.ts
│       │   └── stacks/
│       ├── cdk.json
│       ├── tsconfig.json
│       └── project.json
├── nx.json
└── package.json
```

## Testing

Run unit tests for your CDK project:

```bash
nx test <project-name>
```

This will execute the unit tests via [Jest](https://jestjs.io).
