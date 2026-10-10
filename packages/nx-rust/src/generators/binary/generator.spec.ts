import { Tree, readNxJson, readProjectConfiguration } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';

import generator from './generator';
import { BinaryGeneratorSchema } from './schema';

describe('binary generator', () => {
    let tree: Tree;
    const options: BinaryGeneratorSchema = { name: 'test' };

    beforeEach(() => {
        tree = createTreeWithEmptyWorkspace();
    });

    it('should run successfully', async () => {
        await generator(tree, options);
        const config = readProjectConfiguration(tree, 'test');
        expect(config).toBeDefined();
        expect(readNxJson(tree)?.plugins).toContain('@cubesoft/nx-rust/plugin');
        for (const name of ['build', 'test', 'lint']) {
            expect(config.targets?.[name]).toMatchObject({
                cache: true,
                outputs: ['{options.targetDir}'],
                dependsOn: [],
                options: { targetDir: `dist/apps/test/${name}` }
            });
        }
    });
});
