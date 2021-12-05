import depcheck from 'depcheck';
import { build as esbuild } from 'esbuild';
import glob from 'fast-glob';
import { existsSync } from 'fs';
import { basename, resolve } from 'path';

import { ExecutorContext, readJsonFile, writeJsonFile } from '@nrwl/devkit';

import { copyFile } from '../../utils/file-utils';
import { getAbsoluteAppRoot, getAppSrcRoot } from '../../utils/nx/utils';
import { runCommand } from '../../utils/run-command';
import { BuildExecutorSchema } from './schema';

interface PackageJsonDependencies {
    [packageName: string]: string;
}

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

    for (const file of entryPoints) {
        copyFile(file, resolve(context.root, options.outputPath, '.tmp', basename(file)));
    }

    // Install packages to generate a package-lock.json file
    await runCommand('npm', ['install', '--production'], {
        cwd: resolve(context.root, options.outputPath)
    });

    const { dependencies, devDependencies } = await resolveDependencies(options, context);

    // Build all serverless handler files via esbuild
    return esbuild({
        entryPoints,
        bundle: true,
        format: 'cjs',
        legalComments: 'none',
        minify: true,
        platform: options.platform,
        target: options.target,
        external: [...Object.keys(dependencies), ...Object.keys(devDependencies)],
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

async function resolveDependencies(
    options: BuildExecutorSchema,
    context: ExecutorContext
): Promise<{
    dependencies: PackageJsonDependencies;
    devDependencies: PackageJsonDependencies;
}> {
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
        return { ...prev, ...resolvePackageJsonEntry(context.root, curr) };
    }, {});
    const devDependencies = [
        ...result.devDependencies,
        ...Object.keys(result.missing).filter((m) => !Object.keys(packageJson.dependencies).includes(m))
    ].reduce((prev, curr) => {
        return { ...prev, ...resolvePackageJsonEntry(context.root, curr) };
    }, {});
    writeJsonFile(buildPackageJson, {
        name: packageJson.name,
        version: packageJson.version,
        dependencies,
        devDependencies
    });
    return { dependencies, devDependencies };
}

function resolvePackageJsonEntry(projectRoot: string, packageName: string): PackageJsonDependencies {
    if (existsSync(resolve(projectRoot, 'node_modules', packageName, 'package.json'))) {
        // Try to resolve dependency from package
        return {
            [packageName]: readJsonFile(resolve(projectRoot, 'node_modules', packageName, 'package.json')).version
        };
    }
    if (existsSync(resolve(projectRoot, 'node_modules', '@types', packageName, 'package.json'))) {
        // Try to resolve dependency from type package
        return {
            ['@types/' + packageName]: readJsonFile(
                resolve(projectRoot, 'node_modules', '@types', packageName, 'package.json')
            ).version
        };
    }
    return { [packageName]: '*' };
}
