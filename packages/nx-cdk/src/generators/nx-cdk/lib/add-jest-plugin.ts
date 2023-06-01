import { GeneratorCallback, Tree, addDependenciesToPackageJson } from '@nx/devkit';
import { jestInitGenerator } from '@nx/jest';

import { hasNxPackage, readNxVersion } from './util';

export async function addJestPlugin(tree: Tree): Promise<GeneratorCallback> {
    const tasks: GeneratorCallback[] = [];
    const hasNrwlJestDependency: boolean = hasNxPackage(tree, '@nx/jest');

    if (!hasNrwlJestDependency) {
        const nxVersion = readNxVersion(tree);
        const installTask = addDependenciesToPackageJson(tree, {}, { '@nx/jest': nxVersion });
        tasks.push(installTask);
    }

    return jestInitGenerator(tree, {});
}
