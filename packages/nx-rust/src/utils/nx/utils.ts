import { ExecutorContext } from '@nx/devkit';
import { resolve } from 'path';

export function getAbsoluteAppRoot(context: ExecutorContext): string {
    const projectConfig = context.projectsConfigurations!.projects[context.projectName!];
    return resolve(context.root, projectConfig.root);
}

export function getDefaultTargetDir(context: ExecutorContext): string {
    const projectConfig = context.projectsConfigurations!.projects[context.projectName!];
    const projectType = projectConfig.projectType;
    const projectName = context.projectName!;

    // Determine if project is in apps or libs based on project type
    const folder = projectType === 'application' ? 'apps' : 'libs';

    return `dist/${folder}/${projectName}`;
}
