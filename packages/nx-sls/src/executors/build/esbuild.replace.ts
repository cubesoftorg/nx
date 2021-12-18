import { ExecutorContext } from '@nrwl/devkit';
import { promises as fs } from 'fs';
import { resolve } from 'path';

import { BuildExecutorSchema } from './schema';

interface FileReplacement {
    replace: string;
    with: string;
}

export function esbuildReplaceFilePlugin(options: BuildExecutorSchema, context: ExecutorContext) {
    const fileReplacements = context.target?.configurations?.[context.configurationName]
        ?.fileReplacements as FileReplacement[];
    return {
        name: 'replace-files',
        setup: (build) => {
            build.onLoad({ filter: /.*/ }, async (args) => {
                const fileReplacement = fileReplacements?.find((f) => resolve(context.root, f.replace) === args.path);
                if (fileReplacement) {
                    return {
                        contents: await fs.readFile(resolve(context.root, fileReplacement.with), { encoding: 'utf8' }),
                        loader: 'ts'
                    };
                } else {
                    return {
                        contents: await fs.readFile(args.path, { encoding: 'utf8' }),
                        loader: 'ts'
                    };
                }
            });
        }
    };
}
