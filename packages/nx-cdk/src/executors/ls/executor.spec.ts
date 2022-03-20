import { LsExecutorSchema } from './schema';
import executor from './executor';

const options: LsExecutorSchema = {};

describe('Ls Executor', () => {
  it('can run', async () => {
    const output = await executor(options);
    expect(output.success).toBe(true);
  });
});