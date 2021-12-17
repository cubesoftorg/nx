import { ExecutorContext, readJsonFile, writeJsonFile } from '@nrwl/devkit';
import depcheck from 'depcheck';
import { build as esbuild } from 'esbuild';
import glob from 'fast-glob';
import { existsSync } from 'fs';
import { basename, resolve } from 'path';

import { copyDirectory, copyFile, deleteDirectory } from '../../utils/file-utils';
import { getAbsoluteAppRoot, getAbsoluteBuildRoot, getAppSrcRoot } from '../../utils/nx/utils';
import { runCommand } from '../../utils/run-command';
import { BuildExecutorSchema } from './schema';

interface PackageJsonDependencies {
    [packageName: string]: string;
}

interface FileReplacement {
    replace: string;
    with: string;
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
    const buildRoot = getAbsoluteBuildRoot(context);
    await deleteDirectory(buildRoot);
    await copyDirectory(getAbsoluteAppRoot(context), buildRoot);
    await handleFileReplacements(options, context);
    // Get all serverless handler as entry points for esbuild
    const entryPoints = (await glob(`${buildRoot}/src/handlers/**/*.ts`)).map((entry) => resolve(buildRoot, entry));

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
        outdir: resolve(context.root, options.outputPath, 'src/handlers/'),
        tsconfig: resolve(buildRoot, options.tsConfig)
    });

    // Install packages to generate a package-lock.json file
    await runCommand('npm', ['install', '--production'], {
        cwd: resolve(context.root, options.outputPath)
    });

    await copyFile(resolve(buildRoot, 'serverless.yml'), resolve(context.root, options.outputPath, 'serverless.yml'));

    return {
        success: true
    };
}

async function handleFileReplacements(options: BuildExecutorSchema, context: ExecutorContext) {
    const fileReplacements = context.target?.configurations?.[context.configurationName]
        ?.fileReplacements as FileReplacement[];
    if (fileReplacements) {
        for (const fileReplacement of fileReplacements) {
            await copyFile(
                resolve(context.root, fileReplacement.with),
                resolve(
                    context.root,
                    fileReplacement.replace.replace(
                        getAppSrcRoot(context),
                        resolve(getAbsoluteBuildRoot(context), 'src')
                    )
                )
            );
        }
    }
}

async function resolveDependencies(
    options: BuildExecutorSchema,
    context: ExecutorContext
): Promise<{
    dependencies: PackageJsonDependencies;
    devDependencies: PackageJsonDependencies;
}> {
    const buildRoot = getAbsoluteBuildRoot(context);
    // Resolve all necessary npm packages and versions and write a new package.json file
    const packageJson = readJsonFile(resolve(context.root, 'package.json'));
    const buildPackageJson = resolve(buildRoot, 'package.json');
    const outPackageJson = resolve(context.root, options.outputPath, 'package.json');
    writeJsonFile(buildPackageJson, {
        name: packageJson.name,
        version: packageJson.version,
        dependencies: {},
        devDependencies: {}
    });
    const result = await depcheck(resolve(buildRoot), {});
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
    writeJsonFile(outPackageJson, {
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
