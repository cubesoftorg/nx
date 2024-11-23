import { resolve } from 'path';

import { ExecutorContext } from '@nx/devkit';

export function getAppRoot(context: ExecutorContext): string | undefined {
    if (!context.projectName) {
        throw new Error('Project name is undefined');
    }
    return context.projectGraph?.nodes?.[context?.projectName]?.data?.root;
}

export function getAbsoluteAppRoot(context: ExecutorContext) {
    if (!context.projectName) {
        throw new Error('Project name is undefined');
    }
    return resolve(context.root, getAppRoot(context));
}
