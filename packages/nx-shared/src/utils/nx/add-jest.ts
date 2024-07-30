import { GeneratorCallback, Tree } from '@nx/devkit';
import { jestInitGenerator } from '@nx/jest';
import { JestInitSchema } from '@nx/jest/src/generators/init/schema';

export async function addJest(tree: Tree, options: JestInitSchema): Promise<GeneratorCallback> {
    return jestInitGenerator(tree, {
        ...options
    });
}
