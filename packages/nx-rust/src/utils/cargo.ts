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

    async run(command: CargoCommand | string, parsedArgs: { toolchain?: string; args: string[] }) {
        const commandParts = command.split(' ');
        const cargoArgs: string[] = [];

        // Add toolchain using +toolchain syntax if specified
        if (parsedArgs.toolchain) {
            cargoArgs.push(`+${parsedArgs.toolchain}`);
        }

        cargoArgs.push(...commandParts, ...parsedArgs.args);

        return runCommand(
            'cargo',
            cargoArgs,
            {
                cwd: this.config.cwd,
                stdio: 'inherit'
            }
        );
    }
}
