import { ExecutorContext } from '@nx/devkit';

import { Cdk, CdkCommand } from '../../utils/cdk';
import { getAbsoluteAppRoot } from '../../utils/nx/utils';
import { parseArgs } from '../../utils/parse-args';
import { BootstrapExecutorSchema } from './schema';

export default async function runExecutor(options: BootstrapExecutorSchema, context: ExecutorContext) {
    await bootstrap(options, context);

    return {
        success: true
    };
}

async function bootstrap(options: BootstrapExecutorSchema, context: ExecutorContext) {
    const serverless = new Cdk({
        workspaceRoot: context.root,
        cwd: getAbsoluteAppRoot(context)
    });
    return serverless.run(CdkCommand.Bootstrap, parseArgs(options));
}
