import { ExecutorContext } from '@nx/devkit';

import { Cdk, CdkCommand } from '../../utils/cdk';
import { getAbsoluteAppRoot } from '../../utils/nx/utils';
import { parseArgs } from '../../utils/parse-args';
import { SynthExecutorSchema } from './schema';

export default async function runExecutor(options: SynthExecutorSchema, context: ExecutorContext) {
    await synth(options, context);

    return {
        success: true
    };
}

async function synth(options: SynthExecutorSchema, context: ExecutorContext) {
    const serverless = new Cdk({
        workspaceRoot: context.root,
        cwd: getAbsoluteAppRoot(context)
    });
    return serverless.run(CdkCommand.Synth, parseArgs(options));
}
