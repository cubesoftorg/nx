import { GeneratorCallback, Tree } from '@nx/devkit';
import { jestProjectGenerator } from '@nx/jest';
import { JestProjectSchema } from '@nx/jest/src/generators/jest-project/schema';

export async function addJest(tree: Tree, options: JestProjectSchema): Promise<GeneratorCallback> {
    return jestProjectGenerator(tree, {
        setupFile: 'none',
        skipSerializers: true,
        testEnvironment: 'node',
        skipFormat: true,
        ...options
    });
}
