import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
    sourceRegistryV2Schema,
    sourceVerificationManifestSchema,
    type SourceRegistryV2,
    type SourceVerificationManifest,
} from "../src/schema/source-registry-v2.schema.ts";
import { sha256OfFile } from "../src/lib/hash.ts";

const repoRoot = fileURLToPath(new URL("../", import.meta.url));
const registryFile = join(repoRoot, "sources", "registry", "sources.v2.json");
const manifestFile = join(
    repoRoot,
    "sources",
    "manifests",
    "verification-2026-07-26.json",
);
const online = process.argv.includes("--online");
let errors = 0;

function reportError(message: string): void {
    errors += 1;
    console.error(`  ERRORE: ${message}`);
}

async function readValidatedFiles(): Promise<{
    registry: SourceRegistryV2;
    manifest: SourceVerificationManifest;
}> {
    const [registryRaw, manifestRaw] = await Promise.all([
        readFile(registryFile, "utf8"),
        readFile(manifestFile, "utf8"),
    ]);

    if (registryRaw.includes("[DA_VERIFICARE") || manifestRaw.includes("[DA_VERIFICARE")) {
        throw new Error("placeholder [DA_VERIFICARE] non ammesso nel registro v2 o nel manifest");
    }

    const registry = sourceRegistryV2Schema.parse(JSON.parse(registryRaw) as unknown);
    const manifest = sourceVerificationManifestSchema.parse(JSON.parse(manifestRaw) as unknown);
    return { registry, manifest };
}

async function pdfPageCount(filePath: string): Promise<number> {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const data = new Uint8Array(await readFile(filePath));
    const document = await pdfjs.getDocument({ data, useSystemFonts: true }).promise;
    const pages = document.numPages;
    await document.destroy();
    return pages;
}

async function remoteDigest(url: string): Promise<{ bytes: number; sha256: string }> {
    const response = await fetch(url);
    if (!response.ok || response.body === null) {
        throw new Error(`HTTP ${response.status} per ${url}`);
    }

    const hash = createHash("sha256");
    let bytes = 0;
    for await (const chunk of response.body) {
        hash.update(chunk);
        bytes += chunk.byteLength;
    }
    return { bytes, sha256: hash.digest("hex") };
}

console.log(
    `validate-sources-v2: verifica registro, manifest e file locali${online ? " + fonti remote" : ""}...`,
);

let registry: SourceRegistryV2;
let manifest: SourceVerificationManifest;
try {
    ({ registry, manifest } = await readValidatedFiles());
} catch (error) {
    reportError(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
    throw error;
}

const manifestByRecordId = new Map(
    manifest.records.map((record) => [record.recordId, record] as const),
);
if (manifestByRecordId.size !== manifest.records.length) {
    reportError("recordId duplicati nel manifest di verifica");
}

const manifestations = registry.works.flatMap((work) => work.manifestations);
for (const manifestation of manifestations) {
    const absolutePath = join(repoRoot, manifestation.localFile);
    const record = manifestByRecordId.get(manifestation.verification.manifestRecordId);
    if (record === undefined) {
        reportError(
            `${manifestation.sourceId}: manifestRecordId ${manifestation.verification.manifestRecordId} inesistente`,
        );
    } else {
        if (record.sourceId !== manifestation.sourceId) {
            reportError(`${manifestation.sourceId}: sourceId incoerente nel manifest`);
        }
        if (
            record.remoteSha256 !== manifestation.sha256 ||
            record.localSha256 !== manifestation.sha256
        ) {
            reportError(`${manifestation.sourceId}: hash incoerente tra registro e manifest`);
        }
        if (
            record.remoteBytes !== manifestation.bytes ||
            record.localBytes !== manifestation.bytes
        ) {
            reportError(`${manifestation.sourceId}: byte count incoerente tra registro e manifest`);
        }
        if (
            record.officialUrl !== manifestation.officialUrl ||
            record.localFile !== manifestation.localFile
        ) {
            reportError(`${manifestation.sourceId}: percorsi incoerenti tra registro e manifest`);
        }
    }

    try {
        const [metadata, localSha256, pages] = await Promise.all([
            stat(absolutePath),
            sha256OfFile(absolutePath),
            pdfPageCount(absolutePath),
        ]);
        if (metadata.size !== manifestation.bytes) {
            reportError(
                `${manifestation.sourceId}: ${metadata.size} byte locali, attesi ${manifestation.bytes}`,
            );
        }
        if (localSha256 !== manifestation.sha256) {
            reportError(`${manifestation.sourceId}: SHA-256 locale diverso dal registro`);
        }
        if (pages !== manifestation.pageCount) {
            reportError(
                `${manifestation.sourceId}: ${pages} pagine locali, attese ${manifestation.pageCount}`,
            );
        }
    } catch (error) {
        reportError(
            `${manifestation.sourceId}: file locale non verificabile: ${
                error instanceof Error ? error.message : String(error)
            }`,
        );
    }

    if (online) {
        try {
            const remote = await remoteDigest(manifestation.officialUrl);
            if (
                remote.bytes !== manifestation.bytes ||
                remote.sha256 !== manifestation.sha256
            ) {
                reportError(`${manifestation.sourceId}: fonte remota diversa dal registro`);
            }
        } catch (error) {
            reportError(
                `${manifestation.sourceId}: verifica remota fallita: ${
                    error instanceof Error ? error.message : String(error)
                }`,
            );
        }
    }
}

for (const record of manifest.records) {
    if (!manifestations.some((item) => item.sourceId === record.sourceId)) {
        reportError(`${record.recordId}: record orfano per sourceId ${record.sourceId}`);
    }
}

console.log(
    `validate-sources-v2: ${registry.works.length} work, ${manifestations.length} manifestazioni, ${errors} errori`,
);
if (errors > 0) process.exitCode = 1;
