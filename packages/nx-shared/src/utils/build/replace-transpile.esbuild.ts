import { promises as fs } from 'fs';
import { resolve } from 'path';
import { transpileModule } from 'typescript';

import { ExecutorContext } from '@nx/devkit';

import { getAbsoluteAppRoot } from '../nx/utils';
import { parseTsConfig } from './tsconfig';

interface FileReplacement {
    replace: string;
    with: string;
}

export function replaceTranspileEsbuildPlugin(context: ExecutorContext, replaceValues: Record<string, string> = {}) {
    const appRoot = getAbsoluteAppRoot(context);

    return {
        name: 'replace-transpile-files',
        setup: (build) => {
            build.onLoad({ filter: /\.ts$/ }, async (args) => {
                // look in the project.json file for file replacement build configurations
                const fileReplacements = context.target?.configurations?.[
                    context.configurationName || context.target?.defaultConfiguration
                ]?.fileReplacements as FileReplacement[];
                const fileReplacement = fileReplacements?.find((f) => resolve(context.root, f.replace) === args.path);
                if (fileReplacement) {
                    const filepath = resolve(context.root, fileReplacement.with);
                    const contents = replaceTemplateVariables(
                        transpileModule(await fs.readFile(filepath, { encoding: 'utf8' }), {
                            compilerOptions: (await parseTsConfig(resolve(appRoot, 'tsconfig.app.json')))?.options || {}
                        }).outputText,
                        replaceValues
                    );
                    return {
                        contents,
                        loader: 'ts'
                    };
                } else {
                    const contents = replaceTemplateVariables(
                        transpileModule(await fs.readFile(args.path, { encoding: 'utf8' }), {
                            compilerOptions: (await parseTsConfig(resolve(appRoot, 'tsconfig.app.json')))?.options || {}
                        }).outputText,
                        replaceValues
                    );
                    return {
                        contents,
                        loader: 'ts'
                    };
                }
            });
        }
    };
}

function replaceTemplateVariables(text: string, replaceValues: Record<string, string>): string {
    for (const value of Object.keys(replaceValues)) {
        text = text.replaceAll(value, replaceValues[value]);
    }
    return text;
}
