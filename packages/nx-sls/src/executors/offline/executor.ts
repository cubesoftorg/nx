import { resolve } from 'path';

import { ExecutorContext, logger, readTargetOptions, runExecutor } from '@nrwl/devkit';

import { parseArgs } from '../../utils/parse-args';
import { Serverless, ServerlessCommand } from '../../utils/serverless/serverless';
import { BuildExecutorSchema } from '../build/schema';
import { OfflineExecutorSchema } from './schema';

export default async function offlineExecutor(options: OfflineExecutorSchema, context: ExecutorContext) {
    try {
        for await (const event of await runExecutor(
            { project: context.projectName, target: 'build' },
            {
                ...readTargetOptions<BuildExecutorSchema>({ project: context.projectName, target: 'build' }, context),
                watch: true
            } as BuildExecutorSchema,
            context
        )) {
            if (!event.success) {
                logger.error('There was an error with the build. See above.');
            }
        }

        await offline(options, context);
    } catch (error) {
        throw new Error(error);
    }

    return {
        success: true
    };
}

async function offline(options: OfflineExecutorSchema, context: ExecutorContext) {
    const serverless = new Serverless({
        workspaceRoot: context.root,
        cwd: resolve(context.root, options.outputPath)
    });
    return serverless.run(ServerlessCommand.Offline, parseArgs(options));
}
