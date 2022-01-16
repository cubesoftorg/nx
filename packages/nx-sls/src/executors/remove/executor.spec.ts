import { ExecutorContext } from '@nrwl/devkit';

import executor from './executor';
import { RemoveExecutorSchema } from './schema';

const options: RemoveExecutorSchema = {
    outputPath: ''
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
