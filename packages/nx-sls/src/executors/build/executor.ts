import depcheck from '@cubesoft/depcheck';
import { ExecutorContext, readJsonFile, writeJsonFile } from '@nrwl/devkit';
// TODO: Use official depcheck again once fixed
// import depcheck from 'depcheck';
import { build as esbuild } from 'esbuild';
import glob from 'fast-glob';
import { existsSync } from 'fs';
import { platform } from 'os';
import { resolve } from 'path';

import { copyFile } from '../../utils/file-utils';
import { getAbsoluteAppRoot, getAbsoluteOutputRoot } from '../../utils/nx/utils';
import { runCommand } from '../../utils/run-command';
import { parseTsConfig } from '../../utils/tsconfig';
import { replaceTranspileEsbuildPlugin } from './replace-transpile.esbuild';
import { BuildExecutorSchema } from './schema';

interface PackageJsonDependencies {
    [packageName: string]: string;
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

    // Get all serverless handler as entry points for esbuild
    const entryPoints = await glob(`${appRoot}/src/handlers/**/*.ts`);

    // Copy all non typescript files from /src
    for (const file of await glob(`${appRoot}/src/**/!(*.ts)`, { dot: true })) {
        copyFile(file, file.replace(appRoot, outputRoot));
    }

    const { dependencies, devDependencies } = await resolveDependencies(options, context);

    // Build all serverless handler files via esbuild
    await esbuild({
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
        plugins: [replaceTranspileEsbuildPlugin(options, context)]
    });

    // Install packages to generate a package-lock.json file
    await runCommand(platform() === 'win32' ? 'npm.cmd' : 'npm', ['install', '--production'], {
        cwd: resolve(outputRoot)
    });

    await copyFile(resolve(appRoot, 'serverless.yml'), resolve(outputRoot, 'serverless.yml'));

    return {
        success: true
    };
}

async function resolveDependencies(
    options: BuildExecutorSchema,
    context: ExecutorContext
): Promise<{
    dependencies: PackageJsonDependencies;
    devDependencies: PackageJsonDependencies;
}> {
    const appRoot = getAbsoluteAppRoot(context);
    const outputRoot = getAbsoluteOutputRoot(context);
    // Resolve all necessary npm packages and versions and write a new package.json file
    const packageJson = readJsonFile(resolve(context.root, 'package.json'));
    const outPackageJson = resolve(outputRoot, 'package.json');
    const result = await depcheck(appRoot, {
        package: { dependencies: {}, devDependencies: {} },
        ignoreBinPackage: true,
        ignoreMatches: [...(await getTsConfigPaths(appRoot))],
        specials: []
    });
    const dependencies = [
        ...result.dependencies,
        ...Object.keys(result.missing).filter((m) => Object.keys(packageJson.dependencies).includes(m))
    ]
        .sort()
        .reduce((prev, curr) => {
            return { ...prev, ...resolvePackageJsonEntry(context.root, curr) };
        }, {});
    const devDependencies = [
        ...result.devDependencies,
        ...Object.keys(result.missing).filter((m) => !Object.keys(packageJson.dependencies).includes(m))
    ]
        .sort()
        .reduce((prev, curr) => {
            return { ...prev, ...resolvePackageJsonEntry(context.root, curr) };
        }, {});
    writeJsonFile(outPackageJson, {
        name: context.projectName,
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

async function getTsConfigPaths(appRoot: string): Promise<string[]> {
    const tsConfig = await parseTsConfig(resolve(appRoot, 'tsconfig.app.json'));
    return Object.keys(tsConfig?.options?.paths || {});
}
