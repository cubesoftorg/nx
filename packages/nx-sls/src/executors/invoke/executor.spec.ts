import { ExecutorContext } from '@nrwl/devkit';

import executor from './executor';
import { InvokeExecutorSchema } from './schema';

const options: InvokeExecutorSchema = {
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

describe('Invoke Executor', () => {
    it('can run', async () => {
        const output = await executor(options, context);
        expect(output.success).toBe(true);
    });
});
