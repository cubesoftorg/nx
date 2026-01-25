import { ExecutorContext } from '@nx/devkit';

import { Cdk, CdkCommand } from '../../utils/cdk';
import { getAbsoluteAppRoot } from '../../utils/nx/utils';
import { parseArgs } from '../../utils/parse-args';
import { GcExecutorSchema } from './schema';

export default async function runExecutor(options: GcExecutorSchema, context: ExecutorContext) {
    await gc(options, context);

    return {
        success: true
    };
}

async function gc(options: GcExecutorSchema, context: ExecutorContext) {
    const cdk = new Cdk({
        workspaceRoot: context.root,
        cwd: getAbsoluteAppRoot(context)
    });
    return cdk.run(CdkCommand.Gc, parseArgs(options));
}
