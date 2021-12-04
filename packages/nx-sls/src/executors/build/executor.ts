import { build as esbuild } from 'esbuild';
import glob from 'fast-glob';
import { resolve } from 'path';

import { ExecutorContext } from '@nrwl/devkit';

import { copyFile } from '../../utils/file-utils';
import { getAbsoluteAppRoot, getAppSrcRoot } from '../../utils/nx/utils';
import { BuildExecutorSchema } from './schema';

export default async function buildExecuter(options: BuildExecutorSchema, context: ExecutorContext) {
    try {
        await copyAssets(options, context);
        await build(options, context);
    } catch (error) {
        throw new Error(error);
    }

    return {
        success: true
    };
}

async function build(options: BuildExecutorSchema, context: ExecutorContext) {
    const entryPoints = (await glob(`${getAppSrcRoot(context)}/handlers/**/*.ts`)).map((entry) =>
        resolve(context.root, entry)
    );

    return esbuild({
        entryPoints,
        bundle: true,
        format: 'cjs',
        legalComments: 'none',
        minify: true,
        platform: options.platform,
        target: options.target,
        outdir: resolve(context.root, options.outputPath, 'src/handlers/'),
        tsconfig: resolve(context.root, options.tsConfig)
    });
}

async function copyAssets(options: BuildExecutorSchema, context: ExecutorContext) {
    return copyFile(
        `${getAbsoluteAppRoot(context)}/serverless.yml`,
        `${resolve(context.root, options.outputPath)}/serverless.yml`
    );
}
