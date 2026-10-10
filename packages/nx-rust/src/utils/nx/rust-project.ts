import { ProjectConfiguration, TargetConfiguration, Tree, readNxJson, updateNxJson } from '@nx/devkit';

import { defaultTargetDir } from './utils';

export function registerRustPlugin(tree: Tree): void {
    const nx = readNxJson(tree) ?? {};
    const plugin = '@cubesoft/nx-rust/plugin';
    if (!nx.plugins?.some((entry) => (typeof entry === 'string' ? entry : entry.plugin) === plugin)) {
        updateNxJson(tree, { ...nx, plugins: [...(nx.plugins ?? []), plugin] });
    }
}

/** Explicit generator settings take precedence over generic Node target defaults. */
export function rustTarget(
    project: string,
    type: ProjectConfiguration['projectType'],
    command: string
): TargetConfiguration {
    return {
        executor: `@cubesoft/nx-rust:${command}`,
        cache: command !== 'run',
        ...(command === 'run' ? {} : { outputs: ['{options.targetDir}'], dependsOn: [] }),
        options: { targetDir: defaultTargetDir(project, type, command) }
    };
}
