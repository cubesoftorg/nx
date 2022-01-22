import { BuildOptions, build } from 'esbuild';

import { ExecutorContext } from '@nrwl/devkit';

import { replaceTranspileEsbuildPlugin } from './replace-transpile.esbuild';

export async function esbuild(options: BuildOptions, context: ExecutorContext) {
    return build({ ...options, plugins: [...(options.plugins ?? []), replaceTranspileEsbuildPlugin(context)] });
}
