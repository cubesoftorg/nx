import { build } from 'electron-builder';
import { join } from 'path';

import { copyDirectory } from '@cubesoft/nx-shared/src/utils/build/file-utils';
import { getAbsoluteOutputRoot } from '@cubesoft/nx-shared/src/utils/nx/utils';
import { ExecutorContext, parseTargetString, runExecutor, workspaceRoot } from '@nrwl/devkit';

import { MakeExecutorSchema } from './schema';

export default async function executor(options: MakeExecutorSchema, context: ExecutorContext) {
    const outputRoot = getAbsoluteOutputRoot(context);

    const { project, target, configuration } = parseTargetString(
        `${context.projectName}:build:${context.configurationName ?? ''}`,
        context.projectGraph
    );
    const output = (await (await runExecutor({ project, target, configuration }, {}, context)).next()).value;

    if (!output.success) {
        throw new Error('Executor failed.');
    }

    // Copy frontend build into app folder
    await copyDirectory(
        join(workspaceRoot, `dist/apps/${output.frontendProject}`),
        join(outputRoot, output.frontendProject)
    );

    await build({ ...options.buildOptions, projectDir: outputRoot, config: {} });

    return {
        success: true
    };
}
