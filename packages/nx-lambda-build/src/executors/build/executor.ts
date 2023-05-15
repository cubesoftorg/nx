import archiver from 'archiver';
import { spawnSync } from 'child_process';
import { BuildOptions } from 'esbuild';
import { createWriteStream } from 'fs';
import { join } from 'path';

import { build as esbuild } from '@cubesoft/nx-shared/src/utils/build/build';
import { resolveDependencies } from '@cubesoft/nx-shared/src/utils/build/dependencies';
import { packageInternal } from '@cubesoft/nx-shared/src/utils/build/package-internal.esbuild';
import { getAbsoluteAppRoot, getAbsoluteOutputRoot } from '@cubesoft/nx-shared/src/utils/nx/utils';
import { ExecutorContext, names, readJsonFile } from '@nx/devkit';

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
        const outdir = join(outputRoot, names(entryPoint).fileName);
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
            outdir,
            tsConfig,
            { ...esbuildOptions, plugins: [await packageInternal(context, tsConfig)] },
            bundleNodeModules
        );
        await resolveDependencies(names(entryPoint).fileName, outdir, tsConfig, outdir);
        if (options.installModules) {
            const args = ['install', '--production'];
            if (options.architecture) {
                args.push(`--arch=${options.architecture}`);
            }
            if (options.platform) {
                args.push(`--platform= ${options.platform}`);
            }
            spawnSync('npm', args, { cwd: outdir });
        }
        await new Promise<void>((resolve, reject) => {
            const output = createWriteStream(join(outdir, `handler.zip`));
            const archive = archiver('zip', {
                zlib: { level: 6 }
            });
            archive.on('error', (error) => {
                reject(error);
            });
            output.on('error', (error) => {
                reject(error);
            });
            output.on('close', () => {
                resolve();
            });
            archive.pipe(output);
            archive.glob('**', { dot: true, cwd: outdir });
            archive.finalize();
        });
    }
}
