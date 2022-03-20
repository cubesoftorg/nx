import { DiffExecutorSchema } from './schema';
import executor from './executor';

const options: DiffExecutorSchema = {};

describe('Diff Executor', () => {
  it('can run', async () => {
    const output = await executor(options);
    expect(output.success).toBe(true);
  });
});