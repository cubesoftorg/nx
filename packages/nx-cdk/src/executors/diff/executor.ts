import { ExecutorContext } from '@nrwl/devkit';

import { Cdk, CdkCommand } from '../../utils/cdk';
import { getAbsoluteAppRoot } from '../../utils/nx/utils';
import { parseArgs } from '../../utils/parse-args';
import { DiffExecutorSchema } from './schema';

export default async function runExecutor(options: DiffExecutorSchema, context: ExecutorContext) {
    await diff(options, context);

    return {
        success: true
    };
}

async function diff(options: DiffExecutorSchema, context: ExecutorContext) {
    const serverless = new Cdk({
        workspaceRoot: context.root,
        cwd: getAbsoluteAppRoot(context)
    });
    return serverless.run(CdkCommand.Diff, parseArgs(options));
}
