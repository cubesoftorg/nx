import { GeneratorCallback, Tree } from '@nrwl/devkit';
import { jestProjectGenerator } from '@nrwl/jest';
import { JestProjectSchema } from '@nrwl/jest/src/generators/jest-project/schema';

export async function addJest(tree: Tree, options: JestProjectSchema): Promise<GeneratorCallback> {
    return jestProjectGenerator(tree, {
        setupFile: 'none',
        skipSerializers: true,
        testEnvironment: 'node',
        skipFormat: true,
        ...options
    });
}
