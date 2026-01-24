import { ExecutorContext } from '@nx/devkit';

import { Cargo } from '../../utils/cargo';
import { getAbsoluteAppRoot } from '../../utils/nx/utils';
import { parseArgs } from '../../utils/parse-args';
import { LintExecutorSchema } from './schema';

export default async function runExecutor(options: LintExecutorSchema, context: ExecutorContext) {
    try {
        await lint(options, context);
        return {
            success: true
        };
    } catch (error) {
        return {
            success: false
        };
    }
}

async function lint(options: LintExecutorSchema, context: ExecutorContext) {
    const cargo = new Cargo({
        workspaceRoot: context.root,
        cwd: getAbsoluteAppRoot(context)
    });
    return cargo.run('clippy', parseArgs(options, context));
}
