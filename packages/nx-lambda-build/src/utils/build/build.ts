import { BuildOptions, build as esbuild } from 'esbuild';
import { nodeExternalsPlugin } from 'esbuild-node-externals';

import { ExecutorContext } from '@nrwl/devkit';

import { replaceTranspileEsbuildPlugin } from './replace-transpile.esbuild';

export async function build(
    context: ExecutorContext,
    entryPoints: string[],
    outdir: string,
    tsconfig: string,
    options?: BuildOptions
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
            watch: options?.watch ?? false
        },
        ...options,
        plugins: [...(options?.plugins ?? []), replaceTranspileEsbuildPlugin(context), nodeExternalsPlugin()]
    });
}
