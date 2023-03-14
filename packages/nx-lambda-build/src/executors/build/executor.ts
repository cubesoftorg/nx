import { BuildOptions } from 'esbuild';
import { join } from 'path';

import { build as esbuild } from '@cubesoft/nx-shared/src/utils/build/build';
import { resolveDependencies } from '@cubesoft/nx-shared/src/utils/build/dependencies';
import { packageInternal } from '@cubesoft/nx-shared/src/utils/build/package-internal.esbuild';
import { getAbsoluteAppRoot, getAbsoluteOutputRoot } from '@cubesoft/nx-shared/src/utils/nx/utils';
import { ExecutorContext, names, readJsonFile } from '@nrwl/devkit';

import { deleteDirectory } from '../../utils/file-utils';
import { BuildExecutorSchema } from './schema';

interface EntrypointConfig {
    src: string;
    esbuildOptions?: BuildOptions;
    bundleNodeModules?: boolean;
}

export default async function buildExecuter(options: BuildExecutorSchema, context: ExecutorContext) {
    try {
        await build(options, context);
    } catch (error) {
        throw new Error(error);
    }

    return {
        success: true
    };
}

async function build(options: BuildExecutorSchema, context: ExecutorContext) {
    const appRoot = getAbsoluteAppRoot(context);
    const outputRoot = getAbsoluteOutputRoot(context);
    const tsConfig = join(appRoot, 'tsconfig.app.json');

    await deleteDirectory(outputRoot);

    // Get all handlers as entry points for esbuild
    const entryPoints = readJsonFile<{ entrypoints: Record<string, string | EntrypointConfig> }>(
        join(appRoot, 'handlers.json')
    ).entrypoints;

    for (const entryPoint of Object.keys(entryPoints)) {
        const src =
            typeof entryPoints[entryPoint] === 'string'
                ? (entryPoints[entryPoint] as string)
                : (entryPoints[entryPoint] as EntrypointConfig).src;
        const esbuildOptions =
            typeof entryPoints[entryPoint] === 'string'
                ? {}
                : (entryPoints[entryPoint] as EntrypointConfig).esbuildOptions;
        const bundleNodeModules =
            typeof entryPoints[entryPoint] === 'string'
                ? false
                : (entryPoints[entryPoint] as EntrypointConfig).bundleNodeModules;

        await esbuild(
            context,
            [join(appRoot, src)],
            join(outputRoot, names(entryPoint).fileName),
            tsConfig,
            { ...esbuildOptions, plugins: [await packageInternal(context, tsConfig)] },
            bundleNodeModules
        );
        await resolveDependencies(
            names(entryPoint).fileName,
            join(outputRoot, names(entryPoint).fileName),
            tsConfig,
            join(outputRoot, names(entryPoint).fileName)
        );
    }
}
