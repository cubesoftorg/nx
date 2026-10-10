import { ExecutorContext, ProjectConfiguration } from '@nx/devkit';
import { resolve } from 'path';

export function getAbsoluteAppRoot(context: ExecutorContext): string {
    const projectConfig = context.projectsConfigurations!.projects[context.projectName!];
    return resolve(context.root, projectConfig.root);
}

export function getDefaultTargetDir(context: ExecutorContext): string {
    const projectConfig = context.projectsConfigurations!.projects[context.projectName!];
    return defaultTargetDir(context.projectName!, projectConfig.projectType, context.targetName);
}

/**
 * One Cargo directory per Nx target under `dist`, so parallel cache restores do not mix artifacts.
 *
 * `createNodes` sets this as the target's `targetDir` option, so that a target's Nx outputs and the directory cargo
 * writes to cannot drift apart. It stays the executor's fallback for a target the plugin did not infer.
 */
export function defaultTargetDir(
    projectName: string,
    projectType: ProjectConfiguration['projectType'],
    targetName?: string
): string {
    // Determine if project is in apps or libs based on project type
    const folder = projectType === 'application' ? 'apps' : 'libs';

    return `dist/${folder}/${projectName}${targetName ? `/${targetName}` : ''}`;
}
