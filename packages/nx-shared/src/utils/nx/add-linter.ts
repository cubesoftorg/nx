import { GeneratorCallback, NX_VERSION, Tree, addDependenciesToPackageJson } from '@nx/devkit';
import { lintProjectGenerator } from '@nx/linter';
import { Linter } from '@nx/linter/src/generators/utils/linter';
import { runTasksInSerial } from '@nx/workspace/src/utilities/run-tasks-in-serial';

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
                '@nx/linter': NX_VERSION
            }
        ),
        await lintProjectGenerator(tree, {
            ...options
        })
    );
}
