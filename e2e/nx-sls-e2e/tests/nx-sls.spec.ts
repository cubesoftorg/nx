import { checkFilesExist, ensureNxProject, readFile, readJson, runNxCommandAsync, uniq } from '@nrwl/nx-plugin/testing';

describe('nx-sls e2e', () => {
    it('should create nx-sls', async () => {
        const plugin = uniq('nx-sls');
        ensureNxProject('@cubesoft/nx-sls', 'dist/packages/nx-sls');
        await runNxCommandAsync(`generate @cubesoft/nx-sls:nx-sls ${plugin} --region us-east-1`);
        expect(() => checkFilesExist(`apps/${plugin}/serverless.yml`)).not.toThrow();
    }, 120000);

    describe('--directory', () => {
        it('should create src in the specified directory', async () => {
            const plugin = uniq('nx-sls');
            ensureNxProject('@cubesoft/nx-sls', 'dist/packages/nx-sls');
            await runNxCommandAsync(`generate @cubesoft/nx-sls:nx-sls ${plugin} --region us-east-1 --directory subdir`);
            expect(() => checkFilesExist(`apps/subdir/${plugin}/src/handlers/handler.ts`)).not.toThrow();
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

    describe('commands', () => {
        it('should build nx-sls', async () => {
            const plugin = uniq('nx-sls');
            ensureNxProject('@cubesoft/nx-sls', 'dist/packages/nx-sls');
            await runNxCommandAsync(`generate @cubesoft/nx-sls:nx-sls ${plugin} --region us-east-1`);
            await runNxCommandAsync(`build ${plugin}`);
            expect(() => checkFilesExist(`dist/apps/${plugin}/src/handlers/handler.js`)).not.toThrow();
        }, 120000);

        it('should build nx-sls with production configuration', async () => {
            const plugin = uniq('nx-sls');
            ensureNxProject('@cubesoft/nx-sls', 'dist/packages/nx-sls');
            await runNxCommandAsync(`generate @cubesoft/nx-sls:nx-sls ${plugin} --region us-east-1`);
            await runNxCommandAsync(`build ${plugin} --configuration=production`);
            expect(readFile(`node_modules/.cache/${plugin}/src/environments/environment.ts`)).toContain(
                'production: true'
            );
        }, 120000);

        it('should deploy nx-sls', async () => {
            const plugin = uniq('nx-sls');
            ensureNxProject('@cubesoft/nx-sls', 'dist/packages/nx-sls');
            await runNxCommandAsync(`generate @cubesoft/nx-sls:nx-sls ${plugin} --region us-east-1`);
            await runNxCommandAsync(`deploy ${plugin}`);
            expect(() => checkFilesExist(`dist/apps/${plugin}/src/handlers/handler.js`)).not.toThrow();
            expect(() => checkFilesExist(`dist/apps/${plugin}/.serverless/serverless-state.json`)).not.toThrow();
            await runNxCommandAsync(`remove ${plugin}`);
        }, 600000);
    });
});
