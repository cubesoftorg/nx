import * as path from 'path';

import { addJest } from '@cubesoft/nx-shared/src/utils/nx/add-jest';
import { addLinter } from '@cubesoft/nx-shared/src/utils/nx/add-linter';
import {
    GeneratorCallback,
    Tree,
    addDependenciesToPackageJson,
    addProjectConfiguration,
    formatFiles,
    generateFiles,
    getWorkspaceLayout,
    names,
    offsetFromRoot
} from '@nx/devkit';
import { runTasksInSerial } from '@nx/workspace/src/utilities/run-tasks-in-serial';

import { ApplicationGeneratorSchema } from './schema';

interface NormalizedSchema extends ApplicationGeneratorSchema {
    projectName: string;
    projectRoot: string;
    projectDirectory: string;
    parsedTags: string[];
}

function normalizeOptions(tree: Tree, options: ApplicationGeneratorSchema): NormalizedSchema {
    const name = names(options.name).fileName;
    const projectDirectory = options.directory ? `${names(options.directory).fileName}/${name}` : name;
    const projectName = projectDirectory.replace(new RegExp('/', 'g'), '-');
    const projectRoot = `${getWorkspaceLayout(tree).appsDir}/${projectDirectory}`;
    const parsedTags = options.tags ? options.tags.split(',').map((s) => s.trim()) : [];

    return {
        ...options,
        projectName,
        projectRoot,
        projectDirectory,
        parsedTags
    };
}

function addFiles(tree: Tree, options: NormalizedSchema) {
    const templateOptions = {
        ...options,
        ...names(options.name),
        offsetFromRoot: offsetFromRoot(options.projectRoot),
        template: ''
    };
    generateFiles(tree, path.join(__dirname, 'files'), options.projectRoot, templateOptions);
}

export default async function (tree: Tree, options: ApplicationGeneratorSchema) {
    const tasks: GeneratorCallback[] = [];
    const normalizedOptions = normalizeOptions(tree, options);
    addProjectConfiguration(tree, normalizedOptions.projectName, {
        root: normalizedOptions.projectRoot,
        projectType: 'application',
        sourceRoot: `${normalizedOptions.projectRoot}/src`,
        targets: {
            build: {
                executor: '@cubesoft/nx-electron:build',
                options: {
                    frontendProject: normalizedOptions.frontendProject
                },
                configurations: {
                    development: {},
                    production: {
                        fileReplacements: [
                            {
                                replace: `${normalizedOptions.projectRoot}/src/environments/environment.ts`,
                                with: `${normalizedOptions.projectRoot}/src/environments/environment.prod.ts`
                            }
                        ]
                    }
                },
                defaultConfiguration: 'production'
            },
            make: {
                executor: '@cubesoft/nx-electron:make',
                options: {}
            }
        },
        tags: normalizedOptions.parsedTags
    });
    addFiles(tree, normalizedOptions);
    tasks.push(await addLinter(tree, { project: normalizedOptions.projectName, skipFormat: true }));
    tasks.push(await addJest(tree, { project: normalizedOptions.projectName, skipFormat: true }));
    tasks.push(addDependencies(tree));
    await formatFiles(tree);
    return runTasksInSerial(...tasks);
}

function addDependencies(tree: Tree) {
    const dependencies: Record<string, string> = {};
    const devDependencies: Record<string, string> = {
        depcheck: '^1.4.3',
        typescript: '^4.9.0',
        tslib: '^2.3.0',
        electron: '^23.1.0'
    };
    return addDependenciesToPackageJson(tree, dependencies, devDependencies);
}
