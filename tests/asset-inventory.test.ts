import assert from "node:assert/strict";
import test from "node:test";
import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = fileURLToPath(new URL("../", import.meta.url));
const assetRoot = join(repositoryRoot, "corpus", "assets");

async function walk(directory: string): Promise<string[]> {
    const entries = await readdir(directory, { withFileTypes: true });
    const nested = await Promise.all(
        entries.map(async (entry) => {
            const path = join(directory, entry.name);
            return entry.isDirectory() ? walk(path) : [path];
        }),
    );
    return nested.flat();
}

test("ogni PNG canonico è dichiarato da un manifest figura", async () => {
    const files = await walk(assetRoot);
    const manifestFiles = files.filter((file) => file.endsWith(".json"));
    const manifestPaths = new Set<string>();

    for (const file of manifestFiles) {
        const manifest = JSON.parse(await readFile(file, "utf8")) as {
            figures: Array<{ imagePath: string }>;
        };
        for (const figure of manifest.figures) manifestPaths.add(figure.imagePath);
    }

    const imagePaths = files
        .filter((file) => file.endsWith(".png"))
        .map((file) => relative(assetRoot, file).replaceAll("\\", "/"));

    assert.equal(imagePaths.length, manifestPaths.size);
    assert.deepEqual(
        imagePaths.filter((imagePath) => !manifestPaths.has(imagePath)),
        [],
    );
});
