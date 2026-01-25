import { resolve } from 'path';

import { runCommand } from './run-command';

export enum CdkCommand {
    Bootstrap = 'bootstrap',
    Deploy = 'deploy',
    Destroy = 'destroy',
    Diff = 'diff',
    Gc = 'gc --unstable=gc',
    Ls = 'ls',
    Synth = 'synth'
}

export interface CdkConfig {
    workspaceRoot: string;
    cwd: string;
}

export class Cdk {
    private readonly config: CdkConfig;

    constructor(config: CdkConfig) {
        this.config = config;
    }

    async run(command: CdkCommand, args: string[] = []) {
        return runCommand(
            resolve(this.config.workspaceRoot, 'node_modules', '.bin', 'cdk'),
            [...command.split(' '), ...args],
            {
                cwd: this.config.cwd,
                stdio: 'inherit'
            }
        );
    }
}
