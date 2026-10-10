import { normalizePath } from '@nx/devkit';
import { isAbsolute, relative, sep } from 'path';

/**
 * Converts an absolute path reported by cargo to a workspace-relative one with forward slashes, or `null` when it
 * lies outside the workspace.
 *
 * A plain `relative` is enough: cargo builds the paths it reports from the manifest path it was given, without
 * resolving symlinks, and that path starts with the workspace root.
 */
export function workspacePath(workspaceRoot: string, absolutePath: string): string | null {
    const path = relative(workspaceRoot, absolutePath);
    if (path === '') {
        return '.';
    }
    if (isAbsolute(path) || path === '..' || path.startsWith(`..${sep}`)) {
        return null;
    }
    return normalizePath(path);
}

/** Normalizes a project root the way Nx does, so that the workspace root is always `.`. */
export function normalizeRoot(root: string): string {
    const normalized = normalizePath(root).replace(/^\.\//, '').replace(/\/+$/, '');
    return normalized === '' ? '.' : normalized;
}
