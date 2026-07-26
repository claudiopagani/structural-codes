import { createWriteStream } from "node:fs";
import { mkdir, readFile, rename, stat, unlink } from "node:fs/promises";
import { Readable } from "node:stream";
import type { ReadableStream } from "node:stream/web";
import { pipeline } from "node:stream/promises";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { sha256OfFile } from "../src/lib/hash.ts";
import { sourceRegistryV2Schema } from "../src/schema/source-registry-v2.schema.ts";

const repoRoot = fileURLToPath(new URL("../", import.meta.url));
const registryFile = join(repoRoot, "sources", "registry", "sources.v2.json");

function argument(name: string): string | undefined {
    const index = process.argv.indexOf(name);
    return index === -1 ? undefined : process.argv[index + 1];
}

const sourceId = argument("--source");
const allowDownload = process.argv.includes("--download");
if (sourceId === undefined) {
    console.error("Uso: acquire-source-v2 --source <sourceId> [--download]");
    process.exit(2);
}

const registry = sourceRegistryV2Schema.parse(
    JSON.parse(await readFile(registryFile, "utf8")) as unknown,
);
const manifestation = registry.works
    .flatMap((work) => work.manifestations)
    .find((item) => item.sourceId === sourceId);
if (manifestation === undefined) {
    throw new Error(`Fonte non registrata: ${sourceId}`);
}
const source = manifestation;

const target = resolve(repoRoot, source.localFile);
const allowedRoot = resolve(repoRoot, "raw-sources") + sep;
if (!target.startsWith(allowedRoot)) {
    throw new Error(`percorso fonte fuori da raw-sources/: ${source.localFile}`);
}

async function verifyLocal(): Promise<boolean> {
    try {
        const metadata = await stat(target);
        const hash = await sha256OfFile(target);
        if (metadata.size !== source.bytes || hash !== source.sha256) {
            console.error(`ERRORE: fonte locale presente ma non conforme: ${source.localFile}`);
            console.error(`  bytes attesi/trovati: ${source.bytes}/${metadata.size}`);
            console.error(`  hash atteso: ${source.sha256}`);
            console.error(`  hash trovato: ${hash}`);
            process.exitCode = 1;
            return false;
        }
        console.log(`Fonte locale verificata: ${sourceId} (${metadata.size} byte, ${hash})`);
        return true;
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        return false;
    }
}

if (await verifyLocal()) process.exit(0);
if (!allowDownload) {
    console.error(`Fonte assente: ${source.localFile}`);
    console.error("Modalità offline: aggiungere --download per acquisire dalla URL ufficiale.");
    process.exit(2);
}

await mkdir(dirname(target), { recursive: true });
const temporary = `${target}.part-${process.pid}`;
try {
    const response = await fetch(source.officialUrl, {
        headers: { "user-agent": "strutture-normativa-source-acquirer/0.1" },
        redirect: "follow",
    });
    if (!response.ok || response.body === null) {
        throw new Error(`download fallito: HTTP ${response.status}`);
    }
    await pipeline(
        Readable.fromWeb(response.body as ReadableStream),
        createWriteStream(temporary, { flags: "wx" }),
    );
    const downloaded = await stat(temporary);
    const hash = await sha256OfFile(temporary);
    if (downloaded.size !== source.bytes || hash !== source.sha256) {
        throw new Error(
            `download non conforme: bytes ${downloaded.size}/${source.bytes}, hash ${hash}/${source.sha256}`,
        );
    }
    await rename(temporary, target);
    console.log(`Fonte acquisita e verificata: ${source.localFile}`);
} catch (error) {
    await unlink(temporary).catch(() => undefined);
    throw error;
}
