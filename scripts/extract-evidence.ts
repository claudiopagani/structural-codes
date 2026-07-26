import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { sha256OfFile, sha256OfText } from "../src/lib/hash.ts";
import { sourceRegistryV2Schema } from "../src/schema/source-registry-v2.schema.ts";
import {
    EVIDENCE_PIPELINE_VERSION,
    detectEvidenceAnomalies,
    detectPrintedPage,
    parsePageRange,
    reconstructRawText,
    roundCoordinate,
    sha256OfCanonicalJson,
    type EvidenceTextItem,
} from "./lib/evidence.ts";

const repoRoot = fileURLToPath(new URL("../", import.meta.url));
const registryFile = join(repoRoot, "sources", "registry", "sources.v2.json");
const evidenceRoot = join(repoRoot, "evidence");

function argument(name: string): string | undefined {
    const index = process.argv.indexOf(name);
    return index === -1 ? undefined : process.argv[index + 1];
}

async function writeJson(path: string, value: unknown): Promise<void> {
    await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

const sourceId = argument("--source");
if (sourceId === undefined) {
    console.error("Uso: extract-evidence --source <sourceId> [--pages 1-10]");
    process.exit(2);
}
const pageRange = parsePageRange(argument("--pages"));

const registry = sourceRegistryV2Schema.parse(
    JSON.parse(await readFile(registryFile, "utf8")) as unknown,
);
const manifestation = registry.works
    .flatMap((work) => work.manifestations)
    .find((item) => item.sourceId === sourceId);
if (manifestation === undefined) {
    console.error(`Fonte non registrata: ${sourceId}`);
    process.exit(2);
}

const pdfPath = resolve(repoRoot, manifestation.localFile);
const allowedRoot = resolve(repoRoot, "raw-sources") + sep;
if (!pdfPath.startsWith(allowedRoot)) {
    throw new Error(`percorso fonte fuori da raw-sources/: ${manifestation.localFile}`);
}
const localHash = await sha256OfFile(pdfPath);
if (localHash !== manifestation.sha256) {
    throw new Error(`hash locale difforme per ${sourceId}: ${localHash}`);
}

const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
const data = new Uint8Array(await readFile(pdfPath));
const document = await pdfjs.getDocument({
    data,
    useSystemFonts: false,
    disableFontFace: true,
}).promise;
if (document.numPages !== manifestation.pageCount) {
    throw new Error(
        `numero pagine difforme per ${sourceId}: ${document.numPages}/${manifestation.pageCount}`,
    );
}

const from = pageRange?.from ?? 1;
const to = pageRange?.to ?? document.numPages;
if (to > document.numPages) {
    throw new Error(`pagina ${to} oltre il limite ${document.numPages}`);
}

const outDir = join(evidenceRoot, sourceId);
const pagesDir = join(outDir, "pages");
await mkdir(pagesDir, { recursive: true });
const manifestPages: Array<{
    pdfPage: number;
    printedPage: string | null;
    pageRecordSha256: string;
    rawTextSha256: string;
    textItemCount: number;
}> = [];

for (let pageNumber = from; pageNumber <= to; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent({
        disableNormalization: true,
        includeMarkedContent: false,
    });
    const textItems: EvidenceTextItem[] = [];
    const localFontNames = new Map<string, string>();
    for (const item of content.items) {
        if (!("str" in item)) continue;
        if (!localFontNames.has(item.fontName)) {
            localFontNames.set(
                item.fontName,
                `font-${String(localFontNames.size + 1).padStart(3, "0")}`,
            );
        }
        const transform = item.transform as [
            number,
            number,
            number,
            number,
            number,
            number,
        ];
        const transformed = pdfjs.Util.transform(viewport.transform, transform);
        const height = Math.hypot(transformed[2], transformed[3]);
        const angleDegrees =
            (Math.atan2(transformed[1], transformed[0]) * 180) / Math.PI;
        textItems.push({
            sequence: textItems.length,
            text: item.str,
            direction: item.dir,
            fontName: localFontNames.get(item.fontName)!,
            hasEol: item.hasEOL,
            transform: transform.map(roundCoordinate) as EvidenceTextItem["transform"],
            region: {
                coordinateSystem: "pdf-points-top-left",
                x: roundCoordinate(transformed[4]),
                y: roundCoordinate(transformed[5] - height),
                width: roundCoordinate(item.width),
                height: roundCoordinate(height),
            },
            angleDegrees: roundCoordinate(angleDegrees),
        });
    }
    const rawText = reconstructRawText(textItems);
    const recordWithoutHash = {
        evidenceVersion: 1,
        pipelineVersion: EVIDENCE_PIPELINE_VERSION,
        sourceId,
        sourceSha256: localHash,
        pdfPage: pageNumber,
        printedPage: detectPrintedPage(rawText),
        page: {
            coordinateSystem: "pdf-points-top-left",
            width: roundCoordinate(viewport.width),
            height: roundCoordinate(viewport.height),
            rotation: viewport.rotation,
        },
        extraction: {
            method: "pdf-text-items",
            tool: "pdfjs-dist",
            toolVersion: pdfjs.version,
            parameters: {
                disableNormalization: true,
                includeMarkedContent: false,
                useSystemFonts: false,
                disableFontFace: true,
            },
        },
        textItems,
        rawText,
        rawTextSha256: sha256OfText(rawText),
        textItemsSha256: sha256OfCanonicalJson(textItems),
        anomalies: detectEvidenceAnomalies(textItems, rawText, viewport.height),
    };
    const record = {
        ...recordWithoutHash,
        pageRecordSha256: sha256OfCanonicalJson(recordWithoutHash),
    };
    const pageName = `page-${String(pageNumber).padStart(4, "0")}`;
    await Promise.all([
        writeJson(join(pagesDir, `${pageName}.json`), record),
        writeFile(join(pagesDir, `${pageName}.raw.txt`), rawText, "utf8"),
    ]);
    manifestPages.push({
        pdfPage: pageNumber,
        printedPage: record.printedPage,
        pageRecordSha256: record.pageRecordSha256,
        rawTextSha256: record.rawTextSha256,
        textItemCount: textItems.length,
    });
    console.log(`Evidence pagina ${pageNumber}/${document.numPages}`);
}
await document.destroy();

const manifestWithoutHash = {
    evidenceManifestVersion: 1,
    pipelineVersion: EVIDENCE_PIPELINE_VERSION,
    sourceId,
    sourceSha256: localHash,
    sourceBytes: manifestation.bytes,
    sourcePageCount: manifestation.pageCount,
    extraction: {
        tool: "pdfjs-dist",
        toolVersion: pdfjs.version,
        requestedPages: { from, to },
    },
    pages: manifestPages,
};
const manifest = {
    ...manifestWithoutHash,
    contentFingerprint: sha256OfCanonicalJson(manifestWithoutHash),
};
await Promise.all([
    writeJson(join(outDir, "manifest.json"), manifest),
    writeJson(join(outDir, "last-run.json"), {
        recordedAt: new Date().toISOString(),
        nodeVersion: process.version,
        platform: process.platform,
        architecture: process.arch,
        command: {
            sourceId,
            pages: { from, to },
        },
        contentFingerprint: manifest.contentFingerprint,
    }),
]);
console.log(`Manifest deterministico: ${manifest.contentFingerprint}`);
console.log(`Output: ${outDir}`);
