import { ExecutorContext } from '@nx/devkit';

import { Cdk, CdkCommand } from '../../utils/cdk';
import { getAbsoluteAppRoot } from '../../utils/nx/utils';
import { parseArgs } from '../../utils/parse-args';
import { DestroyExecutorSchema } from './schema';

export default async function runExecutor(options: DestroyExecutorSchema, context: ExecutorContext) {
    await destroy(options, context);

    return {
        success: true
    };
}

async function destroy(options: DestroyExecutorSchema, context: ExecutorContext) {
    const serverless = new Cdk({
        workspaceRoot: context.root,
        cwd: getAbsoluteAppRoot(context)
    });
    return serverless.run(CdkCommand.Destroy, parseArgs(options));
}
