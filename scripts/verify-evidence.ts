import { readFile } from "node:fs/promises";
import { basename, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { sha256OfText } from "../src/lib/hash.ts";
import { sourceRegistryV2Schema } from "../src/schema/source-registry-v2.schema.ts";
import { sha256OfCanonicalJson } from "./lib/evidence.ts";
import { walkFiles } from "./lib/walk-content.ts";

interface ManifestPage {
    pdfPage: number;
    pageRecordSha256: string;
    rawTextSha256: string;
    textItemCount: number;
}

interface EvidenceManifest {
    sourceId: string;
    sourceSha256: string;
    pages: ManifestPage[];
    contentFingerprint: string;
}

interface EvidencePage {
    pipelineVersion: string;
    sourceId: string;
    sourceSha256: string;
    pdfPage: number;
    printedPage: string | null;
    textItems: unknown[];
    rawText: string;
    rawTextSha256: string;
    textItemsSha256: string;
    pageRecordSha256: string;
}

const repoRoot = fileURLToPath(new URL("../", import.meta.url));
const evidenceDir = join(repoRoot, "evidence");
const requireLocalEvidence = process.argv.includes("--require-local");
const requireFixtureSamples = process.argv.includes("--require-samples");
const registry = sourceRegistryV2Schema.parse(
    JSON.parse(
        await readFile(
            join(repoRoot, "sources", "registry", "sources.v2.json"),
            "utf8",
        ),
    ) as unknown,
);
const sampleFixture = JSON.parse(
    await readFile(
        join(
            repoRoot,
            "fixtures",
            "evidence",
            "official-page-samples.v1.json",
        ),
        "utf8",
    ),
) as {
    pipelineVersion: string;
    samples: Array<{
        sourceId: string;
        pdfPage: number;
        printedPage: string | null;
        pageRecordSha256: string;
        rawTextSha256: string;
    }>;
};
const samples = new Map(
    sampleFixture.samples.map(
        (sample) => [`${sample.sourceId}:${sample.pdfPage}`, sample] as const,
    ),
);
const sources = new Map(
    registry.works.flatMap((work) =>
        work.manifestations.map((source) => [source.sourceId, source] as const),
    ),
);

let errors = 0;
let manifestsChecked = 0;
let pagesChecked = 0;
let samplesChecked = 0;
const checkedSampleKeys = new Set<string>();
const manifestFiles = (await walkFiles(evidenceDir, ".json")).filter(
    (file) =>
        basename(file.absolutePath) === "manifest.json" &&
        relative(evidenceDir, file.absolutePath).split(/[\\/]/u).length === 2,
);

function report(message: string): void {
    errors += 1;
    console.error(`  ERRORE: ${message}`);
}

for (const file of manifestFiles) {
    manifestsChecked += 1;
    const manifest = JSON.parse(
        await readFile(file.absolutePath, "utf8"),
    ) as EvidenceManifest;
    const source = sources.get(manifest.sourceId);
    if (source === undefined) {
        report(`${file.relativePath}: sourceId non registrato`);
        continue;
    }
    if (manifest.sourceSha256 !== source.sha256) {
        report(`${file.relativePath}: sourceSha256 difforme dal registro`);
    }
    const { contentFingerprint, ...manifestWithoutFingerprint } = manifest;
    if (
        sha256OfCanonicalJson(manifestWithoutFingerprint) !== contentFingerprint
    ) {
        report(`${file.relativePath}: contentFingerprint non coerente`);
    }

    const sourceDir = join(evidenceDir, manifest.sourceId);
    for (const expected of manifest.pages) {
        pagesChecked += 1;
        const base = `page-${String(expected.pdfPage).padStart(4, "0")}`;
        const pageFile = join(sourceDir, "pages", `${base}.json`);
        const rawFile = join(sourceDir, "pages", `${base}.raw.txt`);
        let page: EvidencePage;
        let rawFileText: string;
        try {
            [page, rawFileText] = await Promise.all([
                readFile(pageFile, "utf8").then(
                    (raw) => JSON.parse(raw) as EvidencePage,
                ),
                readFile(rawFile, "utf8"),
            ]);
        } catch {
            report(`${manifest.sourceId} pagina ${expected.pdfPage}: file mancanti`);
            continue;
        }

        if (
            page.sourceId !== manifest.sourceId ||
            page.sourceSha256 !== source.sha256 ||
            page.pdfPage !== expected.pdfPage
        ) {
            report(`${manifest.sourceId} pagina ${expected.pdfPage}: identità difforme`);
        }
        if (
            page.textItems.length !== expected.textItemCount ||
            sha256OfCanonicalJson(page.textItems) !== page.textItemsSha256
        ) {
            report(`${manifest.sourceId} pagina ${expected.pdfPage}: textItems difformi`);
        }
        if (
            rawFileText !== page.rawText ||
            sha256OfText(page.rawText) !== page.rawTextSha256 ||
            page.rawTextSha256 !== expected.rawTextSha256
        ) {
            report(`${manifest.sourceId} pagina ${expected.pdfPage}: testo raw difforme`);
        }
        const { pageRecordSha256, ...pageWithoutHash } = page;
        if (
            sha256OfCanonicalJson(pageWithoutHash) !== pageRecordSha256 ||
            pageRecordSha256 !== expected.pageRecordSha256
        ) {
            report(`${manifest.sourceId} pagina ${expected.pdfPage}: hash record difforme`);
        }
        const sample = samples.get(`${manifest.sourceId}:${expected.pdfPage}`);
        if (sample !== undefined) {
            samplesChecked += 1;
            checkedSampleKeys.add(`${manifest.sourceId}:${expected.pdfPage}`);
            if (
                page.pipelineVersion !== sampleFixture.pipelineVersion ||
                page.printedPage !== sample.printedPage ||
                page.pageRecordSha256 !== sample.pageRecordSha256 ||
                page.rawTextSha256 !== sample.rawTextSha256
            ) {
                report(
                    `${manifest.sourceId} pagina ${expected.pdfPage}: regressione rispetto alla fixture ufficiale`,
                );
            }
        }
    }
}

if (requireLocalEvidence && manifestsChecked === 0) {
    report("nessun manifest evidence locale disponibile per il gate di release");
}
if (requireFixtureSamples) {
    for (const key of samples.keys()) {
        if (!checkedSampleKeys.has(key)) {
            report(`fixture ufficiale non coperta dall'evidence locale: ${key}`);
        }
    }
}

console.log(
    `verify-evidence: ${manifestsChecked} manifest, ${pagesChecked} pagine, ${samplesChecked} fixture ufficiali, ${errors} errori`,
);
if (errors > 0) process.exitCode = 1;
