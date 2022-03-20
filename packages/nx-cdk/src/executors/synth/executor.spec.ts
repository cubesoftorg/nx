import { SynthExecutorSchema } from './schema';
import executor from './executor';

const options: SynthExecutorSchema = {};

describe('Synth Executor', () => {
  it('can run', async () => {
    const output = await executor(options);
    expect(output.success).toBe(true);
  });
});