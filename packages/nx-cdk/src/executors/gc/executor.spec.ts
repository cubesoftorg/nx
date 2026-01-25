import executor from './executor';
import { GcExecutorSchema } from './schema';

const options: GcExecutorSchema = {};

describe('GC Executor', () => {
    it('can run', async () => {
        const output = await executor(options);
        expect(output.success).toBe(true);
    });
});
