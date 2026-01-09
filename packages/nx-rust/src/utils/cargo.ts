import { runCommand } from './run-command';

export enum CargoCommand {
    Build = 'build',
    Test = 'test',
    Run = 'run'
}

export interface CargoConfig {
    workspaceRoot: string;
    cwd: string;
}

export class Cargo {
    private readonly config: CargoConfig;

    constructor(config: CargoConfig) {
        this.config = config;
    }

    async run(command: CargoCommand | string, args: string[] = []) {
        return runCommand(
            'cargo',
            [...command.split(' '), ...args],
            {
                cwd: this.config.cwd,
                stdio: 'inherit'
            }
        );
    }
}
