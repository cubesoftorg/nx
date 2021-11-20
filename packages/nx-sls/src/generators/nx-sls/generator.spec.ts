import { readJson, readProjectConfiguration, Tree } from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';

import generator from './generator';
import { NxSlsGeneratorSchema } from './schema';

describe('nx-sls generator', () => {
    let appTree: Tree;
    const options: NxSlsGeneratorSchema = { name: 'test', region: 'us-east-1' };

    beforeEach(() => {
        appTree = createTreeWithEmptyWorkspace();
    });

    it('should run successfully', async () => {
        await generator(appTree, options);
        const config = readProjectConfiguration(appTree, 'test');
        expect(config).toBeDefined();
    });

    it('should add dependencies / devDependencies', async () => {
        await generator(appTree, options);
        const { devDependencies } = readJson(appTree, 'package.json');
        expect(devDependencies['serverless']).toBeDefined();
        expect(devDependencies['serverlessOffline']).toBeDefined();
        expect(devDependencies['@types/aws-lambda']).toBeDefined();
    });
});
