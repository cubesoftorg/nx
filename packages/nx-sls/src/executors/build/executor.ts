import glob from 'fast-glob';
import { platform } from 'os';
import { resolve } from 'path';

import { copyFile, deleteDirectory } from '@cubesoft/utils/common/file-utils';
import { runCommand } from '@cubesoft/utils/common/run-command';
import { getAbsoluteAppRoot, getAbsoluteOutputRoot } from '@cubesoft/utils/nx/utils';
import { ExecutorContext } from '@nrwl/devkit';

import { resolveDependencies } from '../../utils/dependencies';
import { esbuild } from '../../utils/esbuild';
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

    const { dependencies, devDependencies } = await resolveDependencies(options, context);

    // Build all serverless handler files via esbuild
    await esbuild(
        {
            entryPoints,
            bundle: true,
            format: 'cjs',
            legalComments: 'none',
            minify: true,
            platform: options.platform,
            target: options.target,
            external: [...Object.keys(dependencies), ...Object.keys(devDependencies)],
            outdir: resolve(outputRoot, 'src/handlers/'),
            tsconfig: resolve(appRoot, options.tsConfig),
            watch: options.watch ?? false
        },
        context
    );

    // Install packages to generate a package-lock.json file
    await runCommand(platform() === 'win32' ? 'npm.cmd' : 'npm', ['install', '--production'], {
        cwd: resolve(outputRoot)
    });

    await copyFile(resolve(appRoot, 'serverless.yml'), resolve(outputRoot, 'serverless.yml'));
}
