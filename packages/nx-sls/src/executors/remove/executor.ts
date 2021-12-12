import { resolve } from 'path';

import { ExecutorContext } from '@nrwl/devkit';

import { Serverless, ServerlessCommand } from '../../utils/serverless/serverless';
import { RemoveExecutorSchema } from './schema';

export default async function removeExecutor(options: RemoveExecutorSchema, context: ExecutorContext) {
    try {
        await remove(options, context);
    } catch (error) {
        throw new Error(error);
    }

    return {
        success: true
    };
}

async function remove(options: RemoveExecutorSchema, context: ExecutorContext) {
    const serverless = new Serverless({
        workspaceRoot: context.root,
        cwd: resolve(context.root, options.outputPath)
    });
    return serverless.run(ServerlessCommand.Remove);
}
