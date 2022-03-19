import { resolve } from 'path';

import { parseArgs } from '@cubesoft/utils/common/parse-args';
import { ExecutorContext, logger, readTargetOptions, runExecutor } from '@nrwl/devkit';

import { Serverless, ServerlessCommand } from '../../utils/serverless/serverless';
import { BuildExecutorSchema } from '../build/schema';
import { InvokeExecutorSchema } from './schema';

export default async function offlineExecutor(options: InvokeExecutorSchema, context: ExecutorContext) {
    try {
        for await (const event of await runExecutor(
            { project: context.projectName, target: 'build' },
            readTargetOptions<BuildExecutorSchema>({ project: context.projectName, target: 'build' }, context),
            context
        )) {
            if (!event.success) {
                logger.error('There was an error with the build. See above.');
            }
        }

        await invoke(options, context);
    } catch (error) {
        throw new Error(error);
    }

    return {
        success: true
    };
}

async function invoke(options: InvokeExecutorSchema, context: ExecutorContext) {
    const serverless = new Serverless({
        workspaceRoot: context.root,
        cwd: resolve(context.root, options.outputPath)
    });
    return serverless.run(ServerlessCommand.Invoke, parseArgs(options));
}
