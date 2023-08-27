import executor from './executor';
import { ServeExecutorSchema } from './schema';

const options: ServeExecutorSchema = {};

describe('Serve Executor', () => {
    it('can run', async () => {
        const output = await executor(options);
        expect(output.success).toBe(true);
    });
});
