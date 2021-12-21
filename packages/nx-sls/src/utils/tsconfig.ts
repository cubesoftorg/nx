import { basename } from 'path';
import { ParsedCommandLine, parseConfigFileTextToJson, parseJsonConfigFileContent, sys } from 'typescript';

import { exists, readFile } from './file-utils';

export async function parseTsConfig(tsConfigPath: string): Promise<ParsedCommandLine> {
    if (!(await exists(tsConfigPath))) {
        throw new Error(`Failed to open ${tsConfigPath}`);
    }
    const json = parseConfigFileTextToJson(tsConfigPath, (await readFile(tsConfigPath)).toString());
    return parseJsonConfigFileContent(json.config, sys, basename(tsConfigPath), {}, tsConfigPath);
}
