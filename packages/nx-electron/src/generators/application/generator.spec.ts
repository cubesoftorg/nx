import { Tree, readProjectConfiguration } from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';

import generator from './generator';
import { ApplicationGeneratorSchema } from './schema';

describe('application generator', () => {
    let appTree: Tree;
    const options: ApplicationGeneratorSchema = { name: 'test', frontendProject: 'test' };

    beforeEach(() => {
        appTree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    });

    it('should run successfully', async () => {
        await generator(appTree, options);
        const config = readProjectConfiguration(appTree, 'test');
        expect(config).toBeDefined();
    });
});
