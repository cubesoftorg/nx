import depcheck from 'depcheck';
import { resolve } from 'path';

import { readJsonFile, writeJsonFile } from './file-utils';
import { getTsConfigPaths } from './tsconfig';

interface PackageJsonDependencies {
    [packageName: string]: string;
}

export async function resolveDependencies(
    name: string,
    rootDir: string,
    appRootDir: string,
    outDir: string
): Promise<{
    dependencies: PackageJsonDependencies;
    devDependencies: PackageJsonDependencies;
}> {
    // Resolve all necessary npm packages and versions and write a new package.json file
    const packageJson = await readJsonFile(resolve(rootDir, 'package.json'));
    const outPackageJson = resolve(outDir, 'package.json');
    // Resolve tsconfig paths and dropping "/*" endings to enable proper matching in depcheck
    const tsConfigPaths = [...(await getTsConfigPaths(appRootDir)).map((path) => path.replace('/*', ''))];
    const result = await depcheck(outDir, {
        package: { dependencies: {}, devDependencies: {} },
        ignoreBinPackage: true,
        ignoreMatches: tsConfigPaths,
        specials: []
    });
    const dependencies: PackageJsonDependencies = Object.keys(result.missing)
        .filter((m) => Object.keys(packageJson.dependencies).includes(m))
        .sort()
        .map((d) => ({ [d]: packageJson.dependencies[d] }))
        .reduce((prev, curr) => ({ ...prev, ...curr }), {});
    const devDependencies: PackageJsonDependencies = Object.keys(result.missing)
        .filter((m) => !Object.keys(packageJson.dependencies).includes(m))
        .sort()
        .map((d) => ({ [d]: packageJson.dependencies[d] }))
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
