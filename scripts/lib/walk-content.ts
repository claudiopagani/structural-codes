import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

export const REPO_ROOT = fileURLToPath(new URL("../../", import.meta.url));
export const CONTENT_DIR = join(REPO_ROOT, "content");
export const ASSETS_DIR = join(REPO_ROOT, "assets");
export const MAPPINGS_DIR = join(REPO_ROOT, "mappings");
export const SOURCES_FILE = join(REPO_ROOT, "sources", "sources.json");
export const RAW_SOURCES_DIR = join(REPO_ROOT, "raw-sources");
export const EXTRACTED_DIR = join(REPO_ROOT, "extracted");

export interface FoundFile {
    absolutePath: string;
    relativePath: string;
}

/** Trova ricorsivamente i file con una data estensione sotto una directory. */
export async function walkFiles(dir: string, extension: string): Promise<FoundFile[]> {
    const found: FoundFile[] = [];
    async function visit(current: string): Promise<void> {
        let entries;
        try {
            entries = await readdir(current, { withFileTypes: true });
        } catch {
            return; // directory inesistente: nessun file
        }
        for (const entry of entries) {
            const full = join(current, entry.name);
            if (entry.isDirectory()) {
                await visit(full);
            } else if (entry.isFile() && entry.name.endsWith(extension)) {
                found.push({ absolutePath: full, relativePath: relative(REPO_ROOT, full) });
            }
        }
    }
    await visit(dir);
    return found.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
}

export async function readJsonFile(filePath: string): Promise<unknown> {
    const raw = await readFile(filePath, "utf8");
    return JSON.parse(raw);
}
