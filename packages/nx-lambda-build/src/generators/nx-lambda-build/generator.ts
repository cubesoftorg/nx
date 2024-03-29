import * as path from 'path';

import {
    GeneratorCallback,
    Tree,
    addDependenciesToPackageJson,
    addProjectConfiguration,
    formatFiles,
    generateFiles,
    getWorkspaceLayout,
    names,
    offsetFromRoot,
    runTasksInSerial
} from '@nx/devkit';
import { Linter, lintProjectGenerator } from '@nx/eslint';
import { jestInitGenerator } from '@nx/jest';

import { depcheckVersion, typesAwsLambdaVersion } from '../../utils/versions';
import { NxLambdaBuildGeneratorSchema } from './schema';

interface NormalizedSchema extends NxLambdaBuildGeneratorSchema {
    projectName: string;
    projectRoot: string;
    projectDirectory: string;
    parsedTags: string[];
}

function normalizeOptions(tree: Tree, options: NxLambdaBuildGeneratorSchema): NormalizedSchema {
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

export default async function (tree: Tree, options: NxLambdaBuildGeneratorSchema) {
    const tasks: GeneratorCallback[] = [];
    const normalizedOptions = normalizeOptions(tree, options);
    addProjectConfiguration(tree, normalizedOptions.projectName, {
        root: normalizedOptions.projectRoot,
        projectType: 'application',
        sourceRoot: `${normalizedOptions.projectRoot}/src`,
        targets: {
            build: {
                executor: '@cubesoft/nx-lambda-build:build',
                options: {
                    target: 'node16'
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
            }
        },
        tags: normalizedOptions.parsedTags
    });
    addFiles(tree, normalizedOptions);
    tasks.push(addDependencies(tree));
    tasks.push(await lintProjectGenerator(tree, { project: options.name, skipFormat: true, linter: Linter.EsLint }));
    tasks.push(
        await jestInitGenerator(tree, {
            testEnvironment: 'node'
        })
    );
    await formatFiles(tree);
    return runTasksInSerial(...tasks);
}

function addDependencies(tree: Tree) {
    const dependencies: Record<string, string> = {};
    const devDependencies: Record<string, string> = {
        '@types/aws-lambda': typesAwsLambdaVersion,
        depcheck: depcheckVersion
    };
    return addDependenciesToPackageJson(tree, dependencies, devDependencies);
}
