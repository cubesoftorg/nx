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
import { registerRustPlugin, rustTarget } from '../../utils/nx/rust-project';
import { LibraryGeneratorSchema } from './schema';

interface NormalizedSchema extends LibraryGeneratorSchema {
    projectName: string;
    projectRoot: string;
    projectDirectory: string;
    parsedTags: string[];
}

function normalizeOptions(tree: Tree, options: LibraryGeneratorSchema): NormalizedSchema {
    const name = names(options.name).fileName;
    const projectDirectory = options.directory ? `${names(options.directory).fileName}/${name}` : name;
    const projectName = projectDirectory.replace(new RegExp('/', 'g'), '-');
    const projectRoot = `${getWorkspaceLayout(tree).libsDir}/${projectDirectory}`;
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

export default async function (tree: Tree, options: LibraryGeneratorSchema) {
    const normalizedOptions = normalizeOptions(tree, options);
    addProjectConfiguration(tree, normalizedOptions.projectName, {
        root: normalizedOptions.projectRoot,
        projectType: 'library',
        sourceRoot: `${normalizedOptions.projectRoot}/src`,
        targets: {
            build: rustTarget(normalizedOptions.projectName, 'library', 'build'),
            test: rustTarget(normalizedOptions.projectName, 'library', 'test'),
            lint: rustTarget(normalizedOptions.projectName, 'library', 'lint')
        },
        tags: normalizedOptions.parsedTags
    });
    addFiles(tree, normalizedOptions);
    ignoreRustTarget(tree);
    registerRustPlugin(tree);
    await formatFiles(tree);
}
