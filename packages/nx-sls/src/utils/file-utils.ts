import { promises as fs } from 'fs';
import { dirname } from 'path';

export async function copyFile(src: string, dest: string) {
    await createDirectory(dirname(dest));
    return fs.copyFile(src, dest);
}

export async function createDirectory(dir: string) {
    return fs.mkdir(dir, { recursive: true });
}
