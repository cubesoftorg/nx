// @vitest-environment node
import { EventEmitter } from 'events';

import { spawn } from 'cross-spawn';

import { runCommand } from './run-command';

vi.mock('cross-spawn', () => ({ spawn: vi.fn() }));

describe('runCommand', () => {
    it.each([
        [0, null, true],
        [1, null, false],
        [null, 'SIGTERM', false]
    ])('handles exit %s and signal %s without caching failed work', async (code, signal, success) => {
        const child = new EventEmitter();
        vi.mocked(spawn).mockReturnValue(child as ReturnType<typeof spawn>);
        const result = runCommand('cargo', ['test']);
        child.emit('close', code, signal);
        if (success) await expect(result).resolves.toBeUndefined();
        else await expect(result).rejects.toThrow(/cargo failed/);
    });

    it('rejects spawn errors', async () => {
        const child = new EventEmitter();
        vi.mocked(spawn).mockReturnValue(child as ReturnType<typeof spawn>);
        const result = runCommand('cargo', ['build']);
        child.emit('error', new Error('ENOENT'));
        await expect(result).rejects.toThrow('ENOENT');
    });
});
