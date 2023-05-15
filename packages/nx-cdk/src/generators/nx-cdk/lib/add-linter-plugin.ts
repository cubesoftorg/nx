import { GeneratorCallback, Tree, addDependenciesToPackageJson } from '@nx/devkit';

import { hasNxPackage, readNxVersion } from './util';

export function addLinterPlugin(tree: Tree): GeneratorCallback {
    const hasNrwlLinterDependency: boolean = hasNxPackage(tree, '@nx/linter');

    if (!hasNrwlLinterDependency) {
        const nxVersion = readNxVersion(tree);
        return addDependenciesToPackageJson(
            tree,
            {},
            {
                '@nx/linter': nxVersion
            }
        );
    } else {
        // eslint-disable-next-line @typescript-eslint/no-empty-function
        return () => {};
    }
}
