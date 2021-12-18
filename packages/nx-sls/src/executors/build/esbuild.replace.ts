import { ExecutorContext } from '@nrwl/devkit';
import { promises as fs } from 'fs';
import { extname, resolve } from 'path';

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
                    const filepath = resolve(context.root, fileReplacement.with);
                    return {
                        contents: await fs.readFile(filepath, { encoding: 'utf8' }),
                        loader: getLoader(filepath)
                    };
                } else {
                    return {
                        contents: await fs.readFile(args.path, { encoding: 'utf8' }),
                        loader: getLoader(args.path)
                    };
                }
            });
        }
    };
}

function getLoader(filename: string): string {
    switch (extname(filename)) {
        case '.js':
            return 'js';
        case '.ts':
            return 'ts';
        case '.css':
            return 'css';
        case '.json':
            return 'json';
        case '.tsx':
            return 'tsx';
        case '.jsx':
            return 'jsx';
        case '.txt':
            return 'text';
    }
}
