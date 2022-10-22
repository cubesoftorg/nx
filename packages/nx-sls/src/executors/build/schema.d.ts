import { Platform } from 'esbuild';

export interface BuildExecutorSchema {
    outputPath: string;
    tsConfig: string;
    platform: Platform;
    target: string;
    watch?: boolean;
    installPackages?: boolean;
}
