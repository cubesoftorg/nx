import { ExecutorContext } from '@nx/devkit';

import { Cdk, CdkCommand } from '../../utils/cdk';
import { getAbsoluteAppRoot } from '../../utils/nx/utils';
import { parseArgs } from '../../utils/parse-args';
import { LsExecutorSchema } from './schema';

export default async function runExecutor(options: LsExecutorSchema, context: ExecutorContext) {
    await ls(options, context);

    return {
        success: true
    };
}

async function ls(options: LsExecutorSchema, context: ExecutorContext) {
    const serverless = new Cdk({
        workspaceRoot: context.root,
        cwd: getAbsoluteAppRoot(context)
    });
    return serverless.run(CdkCommand.Ls, parseArgs(options));
}
