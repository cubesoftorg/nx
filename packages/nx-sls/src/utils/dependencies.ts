import depcheck from 'depcheck';
import { existsSync } from 'fs';
import { resolve } from 'path';

import { ExecutorContext, readJsonFile, writeJsonFile } from '@nrwl/devkit';

import { BuildExecutorSchema } from '../executors/build/schema';
import { getAbsoluteAppRoot, getAbsoluteOutputRoot } from './nx/utils';
import { getTsConfigPaths } from './tsconfig';

interface PackageJsonDependencies {
    [packageName: string]: string;
}

export async function resolveDependencies(
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
    // Resolve tsconfig paths and dropping "/*" endings to enable proper matching in depcheck
    const tsConfigPaths = [...(await getTsConfigPaths(appRoot)).map((path) => path.replace('/*', ''))];
    const result = await depcheck(appRoot, {
        package: { dependencies: {}, devDependencies: {} },
        ignoreBinPackage: true,
        ignoreMatches: tsConfigPaths,
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

export function resolvePackageJsonEntry(projectRoot: string, packageName: string): PackageJsonDependencies {
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
