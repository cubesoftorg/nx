import { ExecutorContext } from '@nx/devkit';
import { resolve } from 'path';

export function getAbsoluteAppRoot(context: ExecutorContext): string {
    const projectConfig = context.projectsConfigurations!.projects[context.projectName!];
    return resolve(context.root, projectConfig.root);
}
