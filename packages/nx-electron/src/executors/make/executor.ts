import { build } from 'electron-builder';
import { join } from 'path';

import { copyDirectory, deleteDirectory } from '@cubesoft/nx-shared/src/utils/build/file-utils';
import { getAbsoluteOutputRoot } from '@cubesoft/nx-shared/src/utils/nx/utils';
import { ExecutorContext, parseTargetString, readJsonFile, runExecutor, workspaceRoot } from '@nx/devkit';

import { MakeExecutorSchema } from './schema';

export default async function executor(options: MakeExecutorSchema, context: ExecutorContext) {
    const outputRoot = getAbsoluteOutputRoot(context);

    await deleteDirectory(join(workspaceRoot, `dist/executables/${context.projectName}`));

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

    const packageJson = readJsonFile(join(workspaceRoot, 'package.json'));
    const electronVersion =
        packageJson.devDependencies.electron.match(/(?<version>[\d]+\.[\d]+\.[\d]+)/)?.groups?.version ?? undefined;

    const buildOptions = context.target?.configurations?.[context.configurationName]?.buildOptions ?? {};
    const config = context.target?.configurations?.[context.configurationName]?.config ?? {};

    await build({
        ...buildOptions,
        projectDir: outputRoot,
        config: {
            electronVersion,
            asar: true,
            compression: 'store',
            ...config,
            directories: { output: join(workspaceRoot, `dist/executables/${context.projectName}`) }
        }
    });

    return {
        success: true
    };
}
