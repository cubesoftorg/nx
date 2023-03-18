import glob from 'fast-glob';
import { platform } from 'os';
import { resolve } from 'path';

import { packageInternal } from '@cubesoft/nx-shared/src/utils/build/package-internal.esbuild';
import { ExecutorContext } from '@nrwl/devkit';

import { resolveDependencies } from '../../utils/dependencies';
import { esbuild } from '../../utils/esbuild';
import { copyFile, deleteDirectory } from '../../utils/file-utils';
import { getAbsoluteAppRoot, getAbsoluteOutputRoot } from '../../utils/nx/utils';
import { runCommand } from '../../utils/run-command';
import { BuildExecutorSchema } from './schema';

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

    await deleteDirectory(outputRoot);

    // Get all serverless handler as entry points for esbuild
    const entryPoints = await glob(`${appRoot}/src/handlers/**/*.ts`);

    // Copy all non typescript files from /src
    for (const file of await glob(`${appRoot}/src/**/!(*.ts)`, { dot: true })) {
        copyFile(file, file.replace(appRoot, outputRoot));
    }

    resolveDependencies(options, context);

    // Build all serverless handler files via esbuild
    await esbuild(
        {
            entryPoints,
            bundle: true,
            format: 'cjs',
            legalComments: 'none',
            minify: true,
            platform: options.platform ?? 'node',
            target: options.target ?? 'node16',
            outdir: resolve(outputRoot, 'src/handlers/'),
            tsconfig: resolve(appRoot, options.tsConfig),
            packages: 'external',
            plugins: [await packageInternal(context, resolve(appRoot, options.tsConfig))]
        },
        context
    );

    // Install packages to generate a package-lock.json file
    if (options.installPackages !== false) {
        await runCommand(platform() === 'win32' ? 'npm.cmd' : 'npm', ['install', '--production'], {
            cwd: resolve(outputRoot)
        });
    }

    await copyFile(resolve(appRoot, 'serverless.yml'), resolve(outputRoot, 'serverless.yml'));
}
