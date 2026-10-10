// @vitest-environment node
import { ExecutorContext } from '@nx/devkit';

import { cargoArgs, parseArgs } from './parse-args';

describe('Cargo argument parsing', () => {
    it('splits strings and quoted arguments without interpreting shell expressions', () => {
        expect(cargoArgs('--locked --features "one two" -- $(echo test)')).toEqual([
            '--locked',
            '--features',
            'one two',
            '--',
            '$(echo',
            'test)'
        ]);
        expect(cargoArgs(['--features', 'one two'])).toEqual(['--features', 'one two']);
        expect(() => cargoArgs('--features "one')).toThrow(/Unterminated quote/);
    });

    it('prevents Cargo flags from redirecting outputs away from the Nx cache directory', () => {
        const context = { root: '/workspace' } as ExecutorContext;
        expect(() => parseArgs({ targetDir: 'dist/app', args: '--target-dir elsewhere' }, context)).toThrow(
            /targetDir executor option/
        );
        expect(
            parseArgs({ targetDir: 'dist/app', args: ['--', '--target-dir', 'application-option'] }, context).args
        ).toContain('application-option');
    });
});
