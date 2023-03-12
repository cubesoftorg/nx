import { CliOptions, Configuration } from 'electron-builder';

export interface MakeExecutorSchema {
    buildOptions: CliOptions;
    config: Configuration;
}
