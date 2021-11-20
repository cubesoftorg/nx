import * as path from 'path';

import {
    addDependenciesToPackageJson,
    addProjectConfiguration,
    formatFiles,
    generateFiles,
    getWorkspaceLayout,
    names,
    offsetFromRoot,
    Tree
} from '@nrwl/devkit';

import { awsLambdaTypesVersion, serverlessOfflineVersion, serverlessVersion } from '../../utils/versions';
import { NxSlsGeneratorSchema } from './schema';

interface NormalizedSchema extends NxSlsGeneratorSchema {
    projectName: string;
    projectRoot: string;
    projectDirectory: string;
    parsedTags: string[];
    region: string;
}

function normalizeOptions(
    tree: Tree,
    options: NxSlsGeneratorSchema
): NormalizedSchema {
    const name = names(options.name).fileName;
    const projectDirectory = options.directory
        ? `${names(options.directory).fileName}/${name}`
        : name;
    const projectName = projectDirectory.replace(new RegExp('/', 'g'), '-');
    const projectRoot = `${
        getWorkspaceLayout(tree).appsDir
    }/${projectDirectory}`;
    const parsedTags = options.tags
        ? options.tags.split(',').map((s) => s.trim())
        : [];

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
    generateFiles(
        tree,
        path.join(__dirname, 'files'),
        options.projectRoot,
        templateOptions
    );
}

// Add package dependencies
function addDependencies(tree: Tree) {
    const dependencies: Record<string, string> = {};
    const devDependencies: Record<string, string> = {
        serverless: serverlessVersion,
        serverlessOffline: serverlessOfflineVersion,
        '@types/aws-lambda': awsLambdaTypesVersion
    };
    return addDependenciesToPackageJson(tree, dependencies, devDependencies);
}

export default async function (tree: Tree, options: NxSlsGeneratorSchema) {
    const normalizedOptions = normalizeOptions(tree, options);
    addProjectConfiguration(tree, normalizedOptions.projectName, {
        root: normalizedOptions.projectRoot,
        projectType: 'application',
        sourceRoot: `${normalizedOptions.projectRoot}/src`,
        targets: {
            build: {
                executor: '@cubesoft/nx-sls:build'
            }
        },
        tags: normalizedOptions.parsedTags
    });
    addFiles(tree, normalizedOptions);
    await formatFiles(tree);
    await addDependencies(tree);
}
