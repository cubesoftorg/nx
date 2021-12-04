import depcheck from 'depcheck';
import { build as esbuild } from 'esbuild';
import glob from 'fast-glob';
import { resolve } from 'path';

import { ExecutorContext, readJsonFile, writeJsonFile } from '@nrwl/devkit';

import { copyFile } from '../../utils/file-utils';
import { getAbsoluteAppRoot, getAppSrcRoot } from '../../utils/nx/utils';
import { runCommand } from '../../utils/run-command';
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
    // Get all serverless handler as entry points for esbuild
    const entryPoints = (await glob(`${getAppSrcRoot(context)}/handlers/**/*.ts`)).map((entry) =>
        resolve(context.root, entry)
    );

    // Resolve all necessary npm packages and versions and write a new package.json file
    const packageJson = readJsonFile(resolve(context.root, 'package.json'));
    const buildPackageJson = resolve(context.root, options.outputPath, 'package.json');
    writeJsonFile(buildPackageJson, {
        name: packageJson.name,
        version: packageJson.version,
        dependencies: {},
        devDependencies: {}
    });
    const result = await depcheck(resolve(context.root, options.outputPath), {});
    const dependencies = [
        ...result.dependencies,
        ...Object.keys(result.missing).filter((m) => Object.keys(packageJson.dependencies).includes(m))
    ].reduce((prev, curr) => {
        prev[curr] = getPackageVersion(context.root, curr);
        return { ...prev };
    }, {});
    const devDependencies = [
        ...result.devDependencies,
        ...Object.keys(result.missing).filter((m) => Object.keys(packageJson.devDependencies).includes(m))
    ].reduce((prev, curr) => {
        prev[curr] = getPackageVersion(context.root, curr);
        return { ...prev };
    }, {});
    writeJsonFile(buildPackageJson, {
        name: packageJson.name,
        version: packageJson.version,
        dependencies,
        devDependencies
    });

    // Install packages to generate a package-lock.json file
    await runCommand('npm', ['install', '--production'], {
        cwd: resolve(context.root, options.outputPath)
    });

    // Build all serverless handler files via esbuild
    return esbuild({
        entryPoints,
        bundle: true,
        format: 'cjs',
        legalComments: 'none',
        minify: true,
        platform: options.platform,
        target: options.target,
        external: [...result.dependencies, ...result.devDependencies],
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

function getPackageVersion(projectRoot: string, packageName: string): string {
    return readJsonFile(resolve(projectRoot, 'node_modules', packageName, 'package.json')).version;
}
