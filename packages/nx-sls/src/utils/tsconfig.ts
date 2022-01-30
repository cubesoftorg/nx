import { basename, resolve } from 'path';
import { ParsedCommandLine, parseConfigFileTextToJson, parseJsonConfigFileContent, sys } from 'typescript';

import { exists, readFile } from './file-utils';

export async function getTsConfigPaths(appRoot: string): Promise<string[]> {
    const tsConfig = await parseTsConfig(resolve(appRoot, 'tsconfig.app.json'));
    return Object.keys(tsConfig?.compilerOptions?.paths || {}).map(val => {
        //For e.g. shared libraries /* is required in tsconfig file, but the module itself ends without /
        if (val.endsWith('/*')) {
            return val.replace('/*', '**');
        }
        return val;
    });
}

export async function parseTsConfig(tsConfigPath: string): Promise<ParsedCommandLine> {
    if (!(await exists(tsConfigPath))) {
        throw new Error(`Failed to open ${tsConfigPath}`);
    }
    const json = parseConfigFileTextToJson(tsConfigPath, (await readFile(tsConfigPath)).toString());
    return parseJsonConfigFileContent(json.config, sys, basename(tsConfigPath), {}, tsConfigPath);
}
