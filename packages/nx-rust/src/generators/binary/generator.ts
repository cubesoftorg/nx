import * as path from 'path';

import {
    Tree,
    addProjectConfiguration,
    formatFiles,
    generateFiles,
    getWorkspaceLayout,
    names,
    offsetFromRoot
} from '@nx/devkit';

import { ignoreRustTarget } from '../../utils/gitignore';
import { BinaryGeneratorSchema } from './schema';

interface NormalizedSchema extends BinaryGeneratorSchema {
    projectName: string;
    projectRoot: string;
    projectDirectory: string;
    parsedTags: string[];
}

function normalizeOptions(tree: Tree, options: BinaryGeneratorSchema): NormalizedSchema {
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

export default async function (tree: Tree, options: BinaryGeneratorSchema) {
    const normalizedOptions = normalizeOptions(tree, options);
    addProjectConfiguration(tree, normalizedOptions.projectName, {
        root: normalizedOptions.projectRoot,
        projectType: 'application',
        sourceRoot: `${normalizedOptions.projectRoot}/src`,
        targets: {
            build: {
                executor: '@cubesoft/nx-rust:build'
            },
            test: {
                executor: '@cubesoft/nx-rust:test'
            },
            lint: {
                executor: '@cubesoft/nx-rust:lint'
            },
            run: {
                executor: '@cubesoft/nx-rust:run'
            }
        },
        tags: normalizedOptions.parsedTags
    });
    addFiles(tree, normalizedOptions);
    ignoreRustTarget(tree);
    await formatFiles(tree);
}
