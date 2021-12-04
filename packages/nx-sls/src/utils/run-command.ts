import { CommonSpawnOptions, spawn } from 'child_process';

/**
 * Execute command in a new process, with command-line arguments and options
 *
 * @param command Command to execute
 * @param args List of command arguments
 * @param options Command execution options
 * @returns
 */
export async function runCommand(command: string, args: readonly string[] = [], options: CommonSpawnOptions = {}) {
    return new Promise<void>((resolvePromise, rejectPromise) => {
        const process = spawn(command, args, {
            ...options
        });
        process.on('exit', (code) => {
            code > 0 ? rejectPromise(code) : resolvePromise();
        });
        process.on('error', rejectPromise);
    });
}
