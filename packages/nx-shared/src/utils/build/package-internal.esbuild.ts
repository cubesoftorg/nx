import { Plugin } from 'esbuild';
import { nodeModuleNameResolver, sys } from 'typescript';

import { ExecutorContext } from '@nrwl/devkit';

import { getCompilerOptions, getTsConfigPaths } from './tsconfig';

// esbuild 0.17.0 detects all packages as external including tsconfig paths
// See https://github.com/evanw/esbuild/issues/619
export async function packageInternal(context: ExecutorContext, tsConfig: string): Promise<Plugin> {
    const tsConfigPaths = [...(await getTsConfigPaths(tsConfig)).map((path) => path.replace('/*', ''))];

    let filter = '';
    for (const path of tsConfigPaths) {
        filter += `${filter.length ? '|' : ''}(^${path.replaceAll('/', '\\/')})`;
    }

    return {
        name: 'package-internal',
        setup: (build) => {
            build.onResolve({ filter: new RegExp(filter) }, async (args) => {
                const compilerOptions = await getCompilerOptions(tsConfig);
                const { resolvedModule } = nodeModuleNameResolver(args.path, args.importer, compilerOptions, sys);
                const { resolvedFileName } = resolvedModule;
                if (!resolvedFileName || resolvedFileName.endsWith('.d.ts')) {
                    return null;
                }
                return { path: sys.resolvePath(resolvedFileName), external: false };
            });
        }
    };
}
