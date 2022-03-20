import { readFileSync } from 'fs';
import * as path from 'path';
import { resolve } from 'path';

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
    awsCdkLibVersion,
    awsCdkVersion,
    constructsVersion,
    sourceMapSupportVersion,
    tsJestVersion
} from '../../utils/versions';
import { addJestPlugin } from './lib/add-jest-plugin';
import { addLinterPlugin } from './lib/add-linter-plugin';
import { NxCdkGeneratorSchema } from './schema';

interface NormalizedSchema extends NxCdkGeneratorSchema {
    projectName: string;
    projectRoot: string;
    projectDirectory: string;
    parsedTags: string[];
}

function normalizeOptions(tree: Tree, options: NxCdkGeneratorSchema): NormalizedSchema {
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

export default async function (tree: Tree, options: NxCdkGeneratorSchema) {
    const tasks: GeneratorCallback[] = [];
    const normalizedOptions = normalizeOptions(tree, options);
    addProjectConfiguration(tree, normalizedOptions.projectName, {
        root: normalizedOptions.projectRoot,
        projectType: 'application',
        sourceRoot: `${normalizedOptions.projectRoot}/src`,
        targets: {
            bootstrap: {
                executor: '@cubesoft/nx-cdk:bootstrap'
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
    await ignoreCdkOut(tree);
    await formatFiles(tree);
    return runTasksInSerial(...tasks);
}

function addDependencies(tree: Tree) {
    const dependencies: Record<string, string> = {};
    const devDependencies: Record<string, string> = {
        'aws-cdk': awsCdkVersion,
        'aws-cdk-lib': awsCdkLibVersion,
        constructs: constructsVersion,
        'source-map-support': sourceMapSupportVersion,
        'ts-jest': tsJestVersion
    };
    return addDependenciesToPackageJson(tree, dependencies, devDependencies);
}

async function ignoreCdkOut(tree: Tree) {
    const ignores = readFileSync(resolve(tree.root, '.gitignore'), { encoding: 'utf8' }).split('\n');
    if (!ignores.includes('cdk.out')) {
        ignores.push('# AWS CDK', 'cdk.out', '');
    }
    tree.write('./.gitignore', ignores.join('\n'));
}
