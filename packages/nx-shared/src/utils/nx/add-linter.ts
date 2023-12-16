import '@nrwl/workspace';
import { GeneratorCallback, NX_VERSION, Tree, addDependenciesToPackageJson, runTasksInSerial } from '@nx/devkit';
import { Linter, lintProjectGenerator } from '@nx/eslint';

interface LintProjectOptions {
    project: string;
    linter?: Linter;
    eslintFilePatterns?: string[];
    tsConfigPaths?: string[];
    skipFormat: boolean;
    setParserOptionsProject?: boolean;
    skipPackageJson?: boolean;
    unitTestRunner?: string;
    rootProject?: boolean;
}

export async function addLinter(tree: Tree, options: LintProjectOptions): Promise<GeneratorCallback> {
    return runTasksInSerial(
        addDependenciesToPackageJson(
            tree,
            {},
            {
                '@nx/eslint': NX_VERSION
            }
        ),
        await lintProjectGenerator(tree, {
            ...options
        })
    );
}
