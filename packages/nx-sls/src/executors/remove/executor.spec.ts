import { ExecutorContext } from '@nrwl/devkit';

import executor from './executor';
import { BuildExecutorSchema } from './schema';

const options: BuildExecutorSchema = {
    outputPath: '',
    platform: 'node',
    target: 'node14',
    tsConfig: ''
};

const context: ExecutorContext = {
    root: '',
    cwd: '',
    isVerbose: false,
    workspace: {
        npmScope: '*',
        projects: {},
        version: 2
    }
};

describe('Remove Executor', () => {
    it('can run', async () => {
        const output = await executor(options, context);
        expect(output.success).toBe(true);
    });
});
