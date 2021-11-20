import { checkFilesExist, ensureNxProject, readJson, runNxCommandAsync, uniq } from '@nrwl/nx-plugin/testing';

describe('nx-sls e2e', () => {
    it('should create nx-sls', async () => {
        const plugin = uniq('nx-sls');
        ensureNxProject('@cubesoft/nx-sls', 'dist/packages/nx-sls');
        await runNxCommandAsync(
            `generate @cubesoft/nx-sls:nx-sls ${plugin} --region us-east-1`
        );

        const result = await runNxCommandAsync(`build ${plugin}`);
        expect(result.stdout).toContain('Executor ran');
    }, 120000);

    describe('--directory', () => {
        it('should create src in the specified directory', async () => {
            const plugin = uniq('nx-sls');
            ensureNxProject('@cubesoft/nx-sls', 'dist/packages/nx-sls');
            await runNxCommandAsync(
                `generate @cubesoft/nx-sls:nx-sls ${plugin} --region us-east-1 --directory subdir`
            );
            expect(() =>
                checkFilesExist(`apps/subdir/${plugin}/src/handlers/handler.ts`)
            ).not.toThrow();
        }, 120000);
    });

    describe('--tags', () => {
        it('should add tags to the project', async () => {
            const plugin = uniq('nx-sls');
            ensureNxProject('@cubesoft/nx-sls', 'dist/packages/nx-sls');
            await runNxCommandAsync(
                `generate @cubesoft/nx-sls:nx-sls ${plugin} --region us-east-1 --tags e2etag,e2ePackage`
            );
            const project = readJson(`apps/${plugin}/project.json`);
            expect(project.tags).toEqual(['e2etag', 'e2ePackage']);
        }, 120000);
    });
});
