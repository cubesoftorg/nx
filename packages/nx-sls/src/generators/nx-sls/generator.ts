import * as path from 'path';

import {
    addDependenciesToPackageJson,
    addProjectConfiguration,
    formatFiles,
    generateFiles,
    GeneratorCallback,
    getWorkspaceLayout,
    names,
    offsetFromRoot,
    Tree
} from '@nrwl/devkit';
import { runTasksInSerial } from '@nrwl/workspace/src/utilities/run-tasks-in-serial';

import {
    awsLambdaTypesVersion,
    esbuildVersion,
    fastGlobVersion,
    serverlessOfflineVersion,
    serverlessVersion
} from '../../utils/versions';
import { addJestPlugin } from './lib/add-jest-plugin';
import { addLinterPlugin } from './lib/add-linter-plugin';
import { NxSlsGeneratorSchema } from './schema';

interface NormalizedSchema extends NxSlsGeneratorSchema {
    projectName: string;
    projectRoot: string;
    projectDirectory: string;
    parsedTags: string[];
    region: string;
}

function normalizeOptions(tree: Tree, options: NxSlsGeneratorSchema): NormalizedSchema {
    const name = names(options.name).fileName;
    const projectDirectory = options.directory ? `${names(options.directory).fileName}/${name}` : name;
    const projectName = projectDirectory.replace(new RegExp('/', 'g'), '-');
    const projectRoot = `${getWorkspaceLayout(tree).appsDir}/${projectDirectory}`;
    const parsedTags = options.tags ? options.tags.split(',').map((s) => s.trim()) : [];
    const unitTestRunner = options.unitTestRunner ?? 'jest';

    return {
        ...options,
        projectName,
        projectRoot,
        projectDirectory,
        parsedTags,
        unitTestRunner
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

// Add package dependencies
function addDependencies(tree: Tree) {
    const dependencies: Record<string, string> = {};
    const devDependencies: Record<string, string> = {
        '@types/aws-lambda': awsLambdaTypesVersion,
        esbuild: esbuildVersion,
        'fast-glob': fastGlobVersion,
        serverless: serverlessVersion,
        'serverless-offline': serverlessOfflineVersion
    };
    return addDependenciesToPackageJson(tree, dependencies, devDependencies);
}

export default async function (tree: Tree, options: NxSlsGeneratorSchema) {
    const tasks: GeneratorCallback[] = [];
    const normalizedOptions = normalizeOptions(tree, options);
    addProjectConfiguration(tree, normalizedOptions.projectName, {
        root: normalizedOptions.projectRoot,
        projectType: 'application',
        sourceRoot: `${normalizedOptions.projectRoot}/src`,
        targets: {
            build: {
                executor: '@cubesoft/nx-sls:build',
                options: {
                    outputPath: `dist/${normalizedOptions.projectRoot}`,
                    tsConfig: `${normalizedOptions.projectRoot}/tsconfig.app.json`,
                    platform: 'node',
                    target: 'node14'
                }
            },
            deploy: {
                executor: '@cubesoft/nx-sls:deploy',
                options: {
                    outputPath: `dist/${normalizedOptions.projectRoot}`
                }
            },
            remove: {
                executor: '@cubesoft/nx-sls:remove',
                options: {
                    outputPath: `dist/${normalizedOptions.projectRoot}`
                }
            }
        },
        tags: normalizedOptions.parsedTags
    });
    addFiles(tree, normalizedOptions);
    await formatFiles(tree);
    if (!options.unitTestRunner || options.unitTestRunner === 'jest') {
        tasks.push(addJestPlugin(tree));
    }
    tasks.push(addLinterPlugin(tree));
    tasks.push(addDependencies(tree));
    return runTasksInSerial(...tasks);
}
