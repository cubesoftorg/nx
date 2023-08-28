import { ChildProcess, spawn } from 'child_process';
import onExit from 'death';
import { BuildOptions, BuildResult, Plugin, context as esBuildContext } from 'esbuild';
import { writeFile } from 'fs/promises';
import { platform } from 'os';
import { join } from 'path';

import { copyStaticAssets } from '@cubesoft/nx-shared/src/utils/build/copy-assets';
import { resolveDependencies } from '@cubesoft/nx-shared/src/utils/build/dependencies';
import { packageInternal } from '@cubesoft/nx-shared/src/utils/build/package-internal.esbuild';
import { replaceTranspileEsbuildPlugin } from '@cubesoft/nx-shared/src/utils/build/replace-transpile.esbuild';
import { getAbsoluteAppRoot, getAbsoluteOutputRoot } from '@cubesoft/nx-shared/src/utils/nx/utils';
import { ExecutorContext, readJsonFile, workspaceRoot } from '@nx/devkit';

import { ServeExecutorSchema } from './schema';

export default async function runExecutor(options: ServeExecutorSchema, context: ExecutorContext) {
    const appRoot = getAbsoluteAppRoot(context);
    const outputRoot = getAbsoluteOutputRoot(context);
    const packageJson = await readJsonFile(join(workspaceRoot, 'package.json'));

    const mainFile = join(appRoot, 'src/main.ts');
    const apiFile = join(appRoot, 'src/app/api/preload.ts');
    const tsConfig = join(appRoot, 'tsconfig.app.json');

    const buildOptions = context.target?.configurations?.[context.configurationName]?.buildOptions ?? {};
    const config = context.target?.configurations?.[context.configurationName]?.config ?? {};

    await writeFile(join(outputRoot, 'index.js'), `const main = require('./main.js');`);

    const electronProcess = spawnElectron(workspaceRoot, getAbsoluteOutputRoot(context));

    const watchPlugin: Plugin = {
        name: 'watch-plugin',
        setup(build) {
            build.onEnd(async (result: BuildResult) => {
                if (result.errors.length > 0) {
                    console.error(result.errors);
                }
                await resolveDependencies(context.projectName, outputRoot, tsConfig, outputRoot);

                if (buildOptions.assets) {
                    // Get absolute asset paths for relative paths specified in options.assets
                    const assets = buildOptions.assets.map((a) => join(context.root, a));
                    await copyStaticAssets(assets, outputRoot);
                }
                electronProcess.restart();
            });
        }
    };

    const buildContext = await esBuildContext({
        ...({
            entryPoints: [mainFile, apiFile],
            bundle: true,
            format: 'cjs',
            legalComments: 'none',
            minify: true,
            platform: buildOptions?.platform ?? 'node',
            target: buildOptions?.target ?? 'node16',
            outdir: outputRoot,
            tsconfig: tsConfig,
            // This option is added for bundling all node_modules to minimize size
            // of the resulting lambda output e.g. for use with Lambda@Edge
            packages: 'external'
        } as Partial<BuildOptions>),
        ...options,
        plugins: [
            ...(buildOptions?.plugins ?? []),
            await packageInternal(context, tsConfig),
            replaceTranspileEsbuildPlugin(context, {
                '{{__BUILD_VERSION__}}': packageJson.version,
                '{{__DEVELOPMENT_MODE__}}': 'true'
            }),
            watchPlugin
        ]
    });

    buildContext.watch();

    await new Promise((res) => {
        onExit(res);
    });

    await buildContext.dispose();
    electronProcess.kill();

    return {
        success: true
    };
}

function spawnElectron(root: string, path: string): { process: ChildProcess; restart: () => void; kill: () => void } {
    let proc: ChildProcess;
    const executable = join(root, `node_modules/.bin/electron${platform() === 'win32' ? '.cmd' : ''}`);
    const restart = () => {
        proc.on('close', () => {
            proc = spawn(executable, [path]);
            console.log(`Restarting: pid ${proc.pid}`);
            proc.on('error', (error) => console.log(error));
        });
        proc.kill();
    };
    proc = spawn(executable, [path]);
    proc.on('error', (error) => console.log(error));

    return {
        process: proc,
        restart: () => {
            restart();
        },
        kill: () => {
            proc.kill();
        }
    };
}
