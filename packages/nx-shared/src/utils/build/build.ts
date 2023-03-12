import { BuildOptions, build as esbuild } from 'esbuild';

import { ExecutorContext } from '@nrwl/devkit';

import { replaceTranspileEsbuildPlugin } from './replace-transpile.esbuild';

export async function build(
    context: ExecutorContext,
    entryPoints: string[],
    outdir: string,
    tsconfig: string,
    options: BuildOptions = {},
    bundleNodeModules = false,
    replaceValues: Record<string, string> = {}
) {
    return esbuild({
        ...{
            entryPoints,
            bundle: true,
            format: 'cjs',
            legalComments: 'none',
            minify: true,
            platform: options?.platform ?? 'node',
            target: options?.target ?? 'node16',
            outdir,
            tsconfig,
            // This option is added for bundling all node_modules to minimize size
            // of the resulting lambda output e.g. for use with Lambda@Edge
            packages: bundleNodeModules ? undefined : 'external'
        },
        ...options,
        plugins: [...(options?.plugins ?? []), replaceTranspileEsbuildPlugin(context, replaceValues)]
    });
}
