import { CommonSpawnOptions } from 'child_process';
import { spawn } from 'cross-spawn';

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
        const child = spawn(command, args, {
            ...options
        });
        // Wait until output streams have closed. A killed process has no exit code and must never
        // be reported as successful (Nx would cache a failed build/test/lint).
        child.on('close', (code, signal) => {
            if (code === 0) {
                resolvePromise();
            } else {
                rejectPromise(new Error(`${command} failed (${signal ? `signal ${signal}` : `exit code ${code}`}).`));
            }
        });
        child.on('error', rejectPromise);
    });
}
