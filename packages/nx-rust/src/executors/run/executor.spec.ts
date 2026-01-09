import { ExecutorContext } from '@nx/devkit';

import executor from './executor';

const options = {};
const context: ExecutorContext = {
    root: '',
    cwd: process.cwd(),
    isVerbose: false,
    projectName: 'test',
    projectsConfigurations: {
        version: 2,
        projects: {
            test: {
                root: 'apps/test'
            }
        }
    }
};

describe('Run Executor', () => {
    it('can run', async () => {
        const output = await executor(options, context);
        expect(output.success).toBe(true);
    });
});
