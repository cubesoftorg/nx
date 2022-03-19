import { resolve } from 'path';

import { runCommand } from '../run-command';

export enum ServerlessCommand {
    Deploy = 'deploy',
    Offline = 'offline',
    Remove = 'remove',
    Invoke = 'invoke',
    InvokeLocal = 'invoke local'
}

export interface ServerlessConfig {
    workspaceRoot: string;
    cwd: string;
}

export class Serverless {
    private readonly config: ServerlessConfig;

    constructor(config: ServerlessConfig) {
        this.config = config;
    }

    async run(command: ServerlessCommand, args: string[] = []) {
        return runCommand(
            resolve(this.config.workspaceRoot, 'node_modules', '.bin', 'sls'),
            [...command.split(' '), ...args],
            {
                cwd: this.config.cwd,
                stdio: 'inherit'
            }
        );
    }
}
