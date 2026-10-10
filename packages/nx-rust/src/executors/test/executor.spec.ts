// @vitest-environment node
import { ExecutorContext, logger } from '@nx/devkit';
import { resolve } from 'path';

import { runCommand } from '../../utils/run-command';
import executor from './executor';

vi.mock('../../utils/run-command', () => ({ runCommand: vi.fn() }));

const context: ExecutorContext = {
    root: '/workspace',
    cwd: '/workspace',
    isVerbose: false,
    projectName: 'test',
    targetName: 'test',
    nxJsonConfiguration: {},
    projectGraph: { nodes: {}, dependencies: {} },
    projectsConfigurations: { version: 2, projects: { test: { root: 'apps/test', projectType: 'application' } } }
};

beforeEach(() => {
    vi.mocked(runCommand).mockReset();
    vi.spyOn(logger, 'error').mockImplementation(() => undefined);
});
afterEach(() => vi.restoreAllMocks());

describe('test executor', () => {
    it('runs Cargo in the crate directory with the declared output directory and flags', async () => {
        vi.mocked(runCommand).mockResolvedValue();
        expect(
            await executor(
                {
                    toolchain: 'nightly',
                    targetDir: 'dist/custom',
                    release: true,
                    features: ['a', 'b'],
                    args: ['--locked']
                },
                context
            )
        ).toEqual({ success: true });
        expect(runCommand).toHaveBeenCalledWith(
            'cargo',
            [
                '+nightly',
                'test',
                '--release',
                `--target-dir=${resolve('/workspace', 'dist/custom')}`,
                '--features=a,b',
                '--locked'
            ],
            { cwd: resolve('/workspace', 'apps/test'), stdio: 'inherit' }
        );
    });

    it('uses the workspace toolchain and project output directory by default', async () => {
        vi.mocked(runCommand).mockResolvedValue();
        expect(await executor({}, context)).toEqual({ success: true });
        expect(runCommand).toHaveBeenCalledWith(
            'cargo',
            ['test', `--target-dir=${resolve('/workspace', 'dist/apps/test/test')}`],
            expect.anything()
        );
    });

    it('reports Cargo failures so Nx cannot cache unsuccessful work', async () => {
        vi.mocked(runCommand).mockRejectedValue(new Error('cargo failed'));
        expect(await executor({}, context)).toEqual({ success: false });
    });
});
