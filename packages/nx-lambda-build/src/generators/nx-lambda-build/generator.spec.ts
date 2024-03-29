import { Tree, readProjectConfiguration } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';

import generator from './generator';
import { NxLambdaBuildGeneratorSchema } from './schema';

describe('nx-lambda-build generator', () => {
    let appTree: Tree;
    const options: NxLambdaBuildGeneratorSchema = { name: 'test' };

    beforeEach(() => {
        appTree = createTreeWithEmptyWorkspace();
    });

    it('should run successfully', async () => {
        await generator(appTree, options);
        const config = readProjectConfiguration(appTree, 'test');
        expect(config).toBeDefined();
    });
});
