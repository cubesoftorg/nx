import depcheck from 'depcheck';
import { join, resolve } from 'path';

import { workspaceRoot } from '@nrwl/devkit';

import { readJsonFile, writeJsonFile } from './file-utils';
import { getTsConfigPaths } from './tsconfig';

interface PackageJsonDependencies {
    [packageName: string]: string;
}

export async function resolveDependencies(
    name: string,
    scanDir: string,
    tsConfig: string,
    outDir: string,
    ignorePackages: string[] = []
): Promise<{
    dependencies: PackageJsonDependencies;
    devDependencies: PackageJsonDependencies;
}> {
    // Resolve all necessary npm packages and versions and write a new package.json file
    const packageJson = await readJsonFile(join(workspaceRoot, 'package.json'));
    const outPackageJson = resolve(outDir, 'package.json');
    // Resolve tsconfig paths and dropping "/*" endings to enable proper matching in depcheck
    const tsConfigPaths = [...(await getTsConfigPaths(tsConfig)).map((path) => path.replace('/*', ''))];
    const result = await depcheck(scanDir, {
        package: { dependencies: {}, devDependencies: {} },
        ignoreBinPackage: true,
        specials: []
    });
    const dependencies: PackageJsonDependencies = Object.keys(result.using)
        .filter(
            (m) =>
                Object.keys(packageJson.dependencies).includes(m) &&
                !ignorePackages.includes(m) &&
                !tsConfigPaths.includes(m)
        )
        .sort()
        .map((d) => ({ [d]: packageJson.dependencies[d] }))
        .reduce((prev, curr) => ({ ...prev, ...curr }), {});
    const devDependencies: PackageJsonDependencies = Object.keys(result.using)
        .filter(
            (m) =>
                !Object.keys(packageJson.dependencies).includes(m) &&
                !ignorePackages.includes(m) &&
                !tsConfigPaths.includes(m)
        )
        .sort()
        .map((d) => ({ [d]: packageJson.dependencies[d] ?? packageJson.devDependencies[d] ?? '*' }))
        .reduce((prev, curr) => ({ ...prev, ...curr }), {});
    await writeJsonFile(outPackageJson, {
        name,
        version: packageJson.version,
        dependencies,
        devDependencies,
        overrides: packageJson.overrides ?? {}
    });
    return { dependencies, devDependencies };
}
