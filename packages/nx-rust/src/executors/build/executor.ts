import { ExecutorContext, logger } from '@nx/devkit';

import { Cargo, CargoCommand } from '../../utils/cargo';
import { getAbsoluteAppRoot } from '../../utils/nx/utils';
import { parseArgs } from '../../utils/parse-args';
import { BuildExecutorSchema } from './schema';

export default async function runExecutor(options: BuildExecutorSchema, context: ExecutorContext) {
    try {
        await build(options, context);
        return {
            success: true
        };
    } catch (error) {
        logger.error(error instanceof Error ? error.message : String(error));
        return {
            success: false
        };
    }
}

async function build(options: BuildExecutorSchema, context: ExecutorContext) {
    const cargo = new Cargo({
        workspaceRoot: context.root,
        cwd: getAbsoluteAppRoot(context)
    });
    return cargo.run(CargoCommand.Build, parseArgs(options, context));
}
