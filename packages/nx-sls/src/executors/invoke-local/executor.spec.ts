import { ExecutorContext } from '@nrwl/devkit';

import executor from './executor';
import { InvokeLocalExecutorSchema } from './schema';

const options: InvokeLocalExecutorSchema = {
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
