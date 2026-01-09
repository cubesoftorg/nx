export interface TestExecutorSchema {
    toolchain?: 'stable' | 'beta' | 'nightly';
    target?: string;
    profile?: string;
    release?: boolean;
    targetDir?: string;
    features?: string | string[];
    allFeatures?: boolean;
    args?: string | string[];
}
