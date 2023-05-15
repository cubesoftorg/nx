import { resolve } from 'path';

import { ExecutorContext } from '@nx/devkit';

export function getAppRoot(context: ExecutorContext) {
    if (!context.projectName) {
        throw new Error('Project name is undefined');
    }
    return context.workspace.projects[context.projectName].root;
}

export function getAbsoluteAppRoot(context: ExecutorContext) {
    if (!context.projectName) {
        throw new Error('Project name is undefined');
    }
    return resolve(context.root, context.workspace.projects[context.projectName].root);
}

export function getAppSrcRoot(context: ExecutorContext) {
    if (!context.projectName) {
        throw new Error('Project name is undefined');
    }
    return context.workspace.projects[context.projectName].sourceRoot;
}

export function getAbsoluteOutputRoot(context: ExecutorContext) {
    return resolve(context.root, 'dist', getAppRoot(context));
}
