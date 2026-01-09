import { Tree } from '@nx/devkit';

export function ignoreRustTarget(tree: Tree) {
    const gitignorePath = '.gitignore';
    let gitignoreContent = '';

    if (tree.exists(gitignorePath)) {
        gitignoreContent = tree.read(gitignorePath, 'utf-8') || '';
    }

    const lines = gitignoreContent.split('\n');
    const hasRustSection = lines.some((line) => line.includes('# Rust'));
    const hasTargetIgnore = lines.some((line) => line.trim() === '**/target' || line.trim() === 'target/');

    if (!hasTargetIgnore) {
        const newLines = [...lines];
        if (!hasRustSection) {
            // Remove trailing empty lines
            while (newLines.length > 0 && newLines[newLines.length - 1].trim() === '') {
                newLines.pop();
            }
            newLines.push('', '# Rust', '**/target', '');
        } else {
            // Add target to existing Rust section
            const rustIndex = newLines.findIndex((line) => line.includes('# Rust'));
            newLines.splice(rustIndex + 1, 0, '**/target');
        }
        tree.write(gitignorePath, newLines.join('\n'));
    }
}
