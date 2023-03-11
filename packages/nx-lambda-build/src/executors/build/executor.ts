import { BuildOptions } from 'esbuild';
import { join } from 'path';

import { ExecutorContext, names, readJsonFile } from '@nrwl/devkit';

import { build as esbuild } from '../../utils/build/build';
import { resolveDependencies } from '../../utils/build/dependencies';
import { deleteDirectory } from '../../utils/file-utils';
import { getAbsoluteAppRoot, getAbsoluteOutputRoot } from '../../utils/nx/utils';
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
    const rootDir = context.root;
    const appRoot = getAbsoluteAppRoot(context);
    const outputRoot = getAbsoluteOutputRoot(context);

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
            join(appRoot, 'tsconfig.app.json'),
            esbuildOptions,
            bundleNodeModules
        );
        await resolveDependencies(
            names(entryPoint).fileName,
            rootDir,
            appRoot,
            join(outputRoot, names(entryPoint).fileName)
        );
    }
}
