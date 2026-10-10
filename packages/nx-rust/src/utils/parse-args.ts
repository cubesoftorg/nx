import { ExecutorContext } from '@nx/devkit';
import { resolve } from 'path';

import { getDefaultTargetDir } from './nx/utils';
import type { BuildExecutorSchema } from '../executors/build/schema';

/**
 * Parse executor options into command line arguments
 * @param options Executor options
 * @param context Executor context
 * @returns Object containing toolchain and args array
 */
export function parseArgs(
    options: BuildExecutorSchema,
    context: ExecutorContext
): { toolchain?: string; args: string[] } {
    const args: string[] = [];
    const toolchain = options.toolchain;

    // Handle target
    if (options.target) {
        args.push(`--target=${options.target}`);
    }

    // Handle profile
    if (options.profile) {
        args.push(`--profile=${options.profile}`);
    }

    // Handle release flag
    if (options.release) {
        args.push('--release');
    }

    // Handle target-dir (use default if not specified)
    const targetDir = options.targetDir || getDefaultTargetDir(context);
    const absoluteTargetDir = resolve(context.root, targetDir);
    args.push(`--target-dir=${absoluteTargetDir}`);

    // Handle features
    if (options.features) {
        if (Array.isArray(options.features)) {
            args.push(`--features=${options.features.join(',')}`);
        } else {
            args.push(`--features=${options.features}`);
        }
    }

    // Handle all-features
    if (options.allFeatures) {
        args.push('--all-features');
    }

    // Handle additional args
    if (options.args) {
        const additional = cargoArgs(options.args);
        // Nx caches targetDir. Letting an extra Cargo flag redirect it produces empty cache entries.
        const cargoOptions = additional.slice(0, additional.indexOf('--') < 0 ? undefined : additional.indexOf('--'));
        if (cargoOptions.some((arg) => arg === '--target-dir' || arg.startsWith('--target-dir='))) {
            throw new Error(
                'Use the targetDir executor option instead of --target-dir in args so Nx can cache Cargo outputs.'
            );
        }
        args.push(...additional);
    }

    return { toolchain, args };
}

/** Split a CLI string without invoking a shell; arrays preserve argument boundaries exactly. */
export function cargoArgs(value?: string | string[]): string[] {
    if (Array.isArray(value)) return value;
    if (!value) return [];
    const result: string[] = [];
    let token = '';
    let quote = '';
    let started = false;
    for (let index = 0; index < value.length; index++) {
        const char = value[index];
        if (char === '\\' && quote !== "'") {
            if (index + 1 >= value.length) throw new Error('Trailing escape in Cargo args.');
            token += value[++index];
            started = true;
        } else if (quote) {
            if (char === quote) quote = '';
            else token += char;
        } else if (char === '"' || char === "'") {
            quote = char;
            started = true;
        } else if (/\s/.test(char)) {
            if (started) result.push(token);
            token = '';
            started = false;
        } else {
            token += char;
            started = true;
        }
    }
    if (quote) throw new Error('Unterminated quote in Cargo args.');
    if (started) result.push(token);
    return result;
}
