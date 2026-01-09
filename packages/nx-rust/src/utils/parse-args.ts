/**
 * Parse executor options into command line arguments
 * @param options Executor options
 * @returns Object containing toolchain and args array
 */
export function parseArgs(options: any): { toolchain?: string; args: string[] } {
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

    // Handle target-dir
    if (options.targetDir) {
        args.push(`--target-dir=${options.targetDir}`);
    }

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
        if (Array.isArray(options.args)) {
            args.push(...options.args);
        } else {
            args.push(options.args);
        }
    }

    return { toolchain, args };
}
