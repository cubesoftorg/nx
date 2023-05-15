import { writeFile } from 'fs/promises';
import { join } from 'path';

import { build } from '@cubesoft/nx-shared/src/utils/build/build';
import { copyStaticAssets } from '@cubesoft/nx-shared/src/utils/build/copy-assets';
import { resolveDependencies } from '@cubesoft/nx-shared/src/utils/build/dependencies';
import { deleteDirectory, readJsonFile } from '@cubesoft/nx-shared/src/utils/build/file-utils';
import { packageInternal } from '@cubesoft/nx-shared/src/utils/build/package-internal.esbuild';
import { getAbsoluteAppRoot, getAbsoluteOutputRoot } from '@cubesoft/nx-shared/src/utils/nx/utils';
import { ExecutorContext, parseTargetString, runExecutor, workspaceRoot } from '@nx/devkit';

import { BuildExecutorSchema } from './schema';

export default async function executor(options: BuildExecutorSchema, context: ExecutorContext) {
    const appRoot = getAbsoluteAppRoot(context);
    const outputRoot = getAbsoluteOutputRoot(context);
    const packageJson = await readJsonFile(join(workspaceRoot, 'package.json'));

    const mainFile = join(appRoot, 'src/main.ts');
    const apiFile = join(appRoot, 'src/app/api/preload.ts');
    const tsConfig = join(appRoot, 'tsconfig.app.json');

    await deleteDirectory(outputRoot);

    await build(
        context,
        [mainFile, apiFile],
        outputRoot,
        tsConfig,
        { plugins: [await packageInternal(context, tsConfig)] },
        false,
        {
            '{{__BUILD_VERSION__}}': packageJson.version
        }
    );
    await resolveDependencies(context.projectName, outputRoot, tsConfig, outputRoot);
    await writeFile(join(outputRoot, 'index.js'), `const main = require('./main.js');`);

    if (options.assets) {
        // Get absolute asset paths for relative paths specified in options.assets
        const assets = options.assets.map((a) => join(context.root, a));
        await copyStaticAssets(assets, outputRoot);
    }

    const { project, target, configuration } = parseTargetString(
        `${options.frontendProject}:build:${context.configurationName ?? ''}`,
        context.projectGraph
    );
    for await (const output of await runExecutor(
        { project, target, configuration },
        {
            baseHref: './'
        },
        context
    )) {
        if (!output.success) {
            throw new Error('Executor failed.');
        }
    }

    return {
        success: true,
        frontendProject: options.frontendProject
    };
}
