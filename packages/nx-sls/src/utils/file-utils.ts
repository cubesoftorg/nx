import { constants, PathLike, promises as fs } from 'fs';
import { dirname, join } from 'path';

export async function copyFile(src: string, dest: string) {
    await createDirectory(dirname(dest));
    return fs.copyFile(src, dest);
}

export async function createDirectory(dir: PathLike) {
    return fs.mkdir(dir, { recursive: true });
}

export async function readDirectory(dir: PathLike) {
    return fs.readdir(dir);
}

export async function exists(path: PathLike): Promise<boolean> {
    try {
        await fs.access(path, constants.F_OK);
        return true;
    } catch {
        return false;
    }
}

export async function lstat(path: PathLike) {
    return fs.lstat(path);
}

export async function symlink(src: PathLike, dest: PathLike) {
    return fs.symlink(await readlink(src), dest);
}

export async function readlink(path: PathLike) {
    return fs.readlink(path);
}

export async function copyDirectory(src: PathLike, dest: PathLike) {
    if (!(await exists(dest))) {
        createDirectory(dest);
    }

    const entries = await readDirectory(src);

    for (const entry of entries) {
        const srcPath = join(src.toString(), entry);
        const destPath = join(dest.toString(), entry);
        const stat = await lstat(srcPath);

        if (stat.isFile()) {
            await copyFile(srcPath, destPath);
        } else if (stat.isDirectory()) {
            await copyDirectory(srcPath, destPath);
        } else if (stat.isSymbolicLink()) {
            await symlink(srcPath, destPath);
        }
    }
}

export async function deleteDirectory(path: PathLike) {
    if (await exists(path)) {
        return fs.rmdir(path, { recursive: true });
    }
    return;
}
