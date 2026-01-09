import { ExecutorContext } from '@nx/devkit';

import { Cargo, CargoCommand } from '../../utils/cargo';
import { getAbsoluteAppRoot } from '../../utils/nx/utils';
import { parseArgs } from '../../utils/parse-args';
import { RunExecutorSchema } from './schema';

export default async function runExecutor(options: RunExecutorSchema, context: ExecutorContext) {
    try {
        await run(options, context);
        return {
            success: true
        };
    } catch (error) {
        return {
            success: false
        };
    }
}

async function run(options: RunExecutorSchema, context: ExecutorContext) {
    const cargo = new Cargo({
        workspaceRoot: context.root,
        cwd: getAbsoluteAppRoot(context)
    });
    return cargo.run(CargoCommand.Run, parseArgs(options));
}
