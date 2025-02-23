import { resolve } from 'path';

import { ExecutorContext } from '@nx/devkit';

export function getAppRoot(context: ExecutorContext): string | undefined {
    if (!context.projectName) {
        throw new Error('Project name is undefined');
    }
    return context.projectGraph?.nodes?.[context?.projectName]?.data?.root;
}

export function getAbsoluteAppRoot(context: ExecutorContext): string | undefined {
    const appRoot = getAppRoot(context);
    if (!appRoot) {
        throw new Error('App root is undefined');
    }
    if (!context.projectName) {
        throw new Error('Project name is undefined');
    }
    return resolve(context.root, appRoot);
}
