import { getAppRoot } from '@cubesoft/nx-shared/utils/nx/utils';
import { ExecutorContext } from '@nrwl/devkit';

import { BuildExecutorSchema } from './schema';

export default async function runExecutor(options: BuildExecutorSchema, context: ExecutorContext) {
    console.log('Executor ran for Build', options);
    getAppRoot(context);
    return {
        success: true
    };
}
