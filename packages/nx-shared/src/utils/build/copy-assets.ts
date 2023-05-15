import { join } from 'path';

import { copyDirectory, copyFile, exists, lstat } from './file-utils';

export async function copyStaticAssets(assets: string[], outputRoot: string) {
    for (const asset of assets) {
        if (await exists(asset)) {
            const stats = await lstat(asset);
            if (stats.isFile()) {
                await copyFile(asset, outputRoot);
            }
            if (stats.isDirectory()) {
                const dir = asset.split('/').pop();
                await copyDirectory(asset, join(outputRoot, dir));
            }
        }
    }
}
