import { ExecutorContext } from '@nrwl/devkit';
import { promises as fs } from 'fs';
import { resolve } from 'path';
import { transpileModule } from 'typescript';

import { getAbsoluteAppRoot } from '../../utils/nx/utils';
import { parseTsConfig } from '../../utils/tsconfig';
import { BuildExecutorSchema } from './schema';

interface FileReplacement {
    replace: string;
    with: string;
}

export function replaceTranspileEsbuildPlugin(options: BuildExecutorSchema, context: ExecutorContext) {
    return {
        name: 'replace-transpile-files',
        setup: (build) => {
            build.onLoad({ filter: /\.ts$/ }, async (args) => {
                const appRoot = getAbsoluteAppRoot(context);
                const fileReplacements = context.target?.configurations?.[context.configurationName]
                    ?.fileReplacements as FileReplacement[];
                const fileReplacement = fileReplacements?.find((f) => resolve(context.root, f.replace) === args.path);
                if (fileReplacement) {
                    const filepath = resolve(context.root, fileReplacement.with);
                    return {
                        contents: transpileModule(await fs.readFile(filepath, { encoding: 'utf8' }), {
                            compilerOptions: (await parseTsConfig(resolve(appRoot, 'tsconfig.app.json')))?.options || {}
                        }).outputText,
                        loader: 'ts'
                    };
                } else {
                    return {
                        contents: transpileModule(await fs.readFile(args.path, { encoding: 'utf8' }), {
                            compilerOptions: (await parseTsConfig(resolve(appRoot, 'tsconfig.app.json')))?.options || {}
                        }).outputText,
                        loader: 'ts'
                    };
                }
            });
        }
    };
}
