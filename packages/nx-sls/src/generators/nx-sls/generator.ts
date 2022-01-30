import { join } from 'path';

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
} from '@nrwl/devkit';
import { jestProjectGenerator } from '@nrwl/jest';
import { Linter, lintProjectGenerator } from '@nrwl/linter';
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
    generateFiles(tree, join(__dirname, 'files'), options.projectRoot, templateOptions);
}

// Add package dependencies
function addDependencies(tree: Tree) {
    const dependencies: Record<string, string> = {};
    const devDependencies: Record<string, string> = {
        '@types/aws-lambda': awsLambdaTypesVersion,
        '@cubesoft/depcheck': '0.0.1',
        // TODO: Use official depcheck again once fixed
        // depcheck: depcheckVersion,
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
                    tsConfig: `tsconfig.app.json`,
                    platform: 'node',
                    target: 'node14'
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
                }
            },
            deploy: {
                executor: '@cubesoft/nx-sls:deploy',
                options: {
                    outputPath: `dist/${normalizedOptions.projectRoot}`
                }
            },
            invoke: {
                executor: '@cubesoft/nx-sls:invoke',
                options: {
                    outputPath: `dist/${normalizedOptions.projectRoot}`
                }
            },
            'invoke-local': {
                executor: '@cubesoft/nx-sls:invoke-local',
                options: {
                    outputPath: `dist/${normalizedOptions.projectRoot}`
                }
            },
            offline: {
                executor: '@cubesoft/nx-sls:offline',
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

    tasks.push(addJestPlugin(tree));
    tasks.push(addLinterPlugin(tree));
    tasks.push(addDependencies(tree));
    await lintProjectGenerator(tree, { project: options.name, skipFormat: true, linter: Linter.EsLint });
    await jestProjectGenerator(tree, {
        project: options.name,
        setupFile: 'none',
        skipSerializers: true,
        testEnvironment: 'node'
    });
    await formatFiles(tree);
    return runTasksInSerial(...tasks);
}
