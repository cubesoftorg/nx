import { GeneratorCallback, NX_VERSION, Tree, addDependenciesToPackageJson } from '@nrwl/devkit';
import { lintProjectGenerator } from '@nrwl/linter';
import { Linter } from '@nrwl/linter/src/generators/utils/linter';
import { runTasksInSerial } from '@nrwl/workspace/src/utilities/run-tasks-in-serial';

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
                '@nrwl/linter': NX_VERSION
            }
        ),
        await lintProjectGenerator(tree, {
            ...options
        })
    );
}
