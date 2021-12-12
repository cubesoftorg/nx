import { resolve } from 'path';

import { ExecutorContext } from '@nrwl/devkit';

export function getAppRoot(context: ExecutorContext) {
    return context.workspace.projects[context.projectName].root;
}

export function getAbsoluteAppRoot(context: ExecutorContext) {
    return resolve(context.root, context.workspace.projects[context.projectName].root);
}

export function getAppSrcRoot(context: ExecutorContext) {
    return context.workspace.projects[context.projectName].sourceRoot;
}

export function getAbsoluteBuildRoot(context: ExecutorContext) {
    return resolve(context.root, 'node_modules', '.cache', context.projectName);
}
