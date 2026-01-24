import { ExecutorContext } from '@nx/devkit';

import { Cargo, CargoCommand } from '../../utils/cargo';
import { getAbsoluteAppRoot } from '../../utils/nx/utils';
import { parseArgs } from '../../utils/parse-args';
import { TestExecutorSchema } from './schema';

export default async function runExecutor(options: TestExecutorSchema, context: ExecutorContext) {
    try {
        await test(options, context);
        return {
            success: true
        };
    } catch (error) {
        return {
            success: false
        };
    }
}

async function test(options: TestExecutorSchema, context: ExecutorContext) {
    const cargo = new Cargo({
        workspaceRoot: context.root,
        cwd: getAbsoluteAppRoot(context)
    });
    return cargo.run(CargoCommand.Test, parseArgs(options, context));
}
