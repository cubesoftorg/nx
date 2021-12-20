import { ExecutorContext } from '@nrwl/devkit';

import executor from './executor';
import { OfflineExecutorSchema } from './schema';

const options: OfflineExecutorSchema = {
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

describe('Deploy Executor', () => {
    it('can run', async () => {
        const output = await executor(options, context);
        expect(output.success).toBe(true);
    });
});
