import { RustCacheOptions } from '../../utils/rust-hasher';

export interface RunExecutorSchema extends RustCacheOptions {
    toolchain?: 'stable' | 'beta' | 'nightly';
    target?: string;
    profile?: string;
    release?: boolean;
    targetDir?: string;
    features?: string | string[];
    allFeatures?: boolean;
    args?: string | string[];
}
