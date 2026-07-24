/**
 * extract-source: estrae il testo di un PDF sorgente pagina per pagina.
 *
 * Strategia:
 * - se `pdftotext` (poppler) e' disponibile, usa quello con -layout
 *   (qualita' superiore per documenti normativi);
 * - altrimenti fallback su pdfjs-dist (pure JS).
 *
 * Output in extracted/<sourceId>/:
 *   pages/page-0001.txt ...   testo grezzo per pagina
 *   full-text.txt             testo completo
 *   manifest.json             hash, pagine, bytes, data, strumento usato
 *
 * Uso:
 *   node --experimental-strip-types scripts/extract-source.ts --source <sourceId> [--pages 1-50]
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { sha256OfFile, sha256OfText } from "../src/lib/hash.ts";
import { sourceRegistrySchema } from "../src/schema/source.schema.ts";
import { SOURCES_FILE, RAW_SOURCES_DIR, EXTRACTED_DIR, readJsonFile } from "./lib/walk-content.ts";

const execFileAsync = promisify(execFile);

function parseArgs(argv: string[]): { sourceId: string; pageRange: { from: number; to: number } | null } {
    const sourceIdx = argv.indexOf("--source");
    if (sourceIdx === -1 || argv[sourceIdx + 1] === undefined) {
        console.error("Uso: extract-source --source <sourceId> [--pages 1-50]");
        process.exit(2);
    }
    let pageRange: { from: number; to: number } | null = null;
    const pagesIdx = argv.indexOf("--pages");
    if (pagesIdx !== -1 && argv[pagesIdx + 1] !== undefined) {
        const m = /^(\d+)-(\d+)$/.exec(argv[pagesIdx + 1]!);
        if (m) pageRange = { from: Number(m[1]), to: Number(m[2]) };
    }
    return { sourceId: argv[sourceIdx + 1]!, pageRange };
}

async function hasPdftotext(): Promise<boolean> {
    try {
        await execFileAsync("pdftotext", ["-v"]);
        return true;
    } catch {
        return false;
    }
}

async function extractWithPdftotext(pdfPath: string, outTxt: string): Promise<string> {
    await execFileAsync("pdftotext", ["-layout", pdfPath, outTxt]);
    return readFile(outTxt, "utf8");
}

async function extractWithPdfjs(pdfPath: string): Promise<string[]> {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const data = new Uint8Array(await readFile(pdfPath));
    const doc = await pdfjs.getDocument({ data, useSystemFonts: true }).promise;
    const pages: string[] = [];
    for (let p = 1; p <= doc.numPages; p += 1) {
        const page = await doc.getPage(p);
        const content = await page.getTextContent();
        let text = "";
        let lastY: number | null = null;
        for (const item of content.items) {
            if ("str" in item) {
                const y = (item.transform as number[])[5] ?? 0;
                if (lastY !== null && Math.abs(y - lastY) > 2) text += "\n";
                text += item.str;
                lastY = y;
            }
        }
        pages.push(text);
    }
    await doc.destroy();
    return pages;
}

const { sourceId, pageRange } = parseArgs(process.argv);

const registryRaw = await readJsonFile(SOURCES_FILE);
const registry = sourceRegistrySchema.parse(registryRaw);
const source = registry.sources.find((s) => s.sourceId === sourceId);
if (!source) {
    console.error(`Fonte "${sourceId}" non registrata. Esegui prima acquire-source.`);
    process.exit(2);
}

const pdfPath = join(RAW_SOURCES_DIR, "..", source.localFile);
const outDir = join(EXTRACTED_DIR, sourceId);
const pagesDir = join(outDir, "pages");
await mkdir(pagesDir, { recursive: true });

// Verifica integrita' del PDF rispetto al registro
const currentHash = await sha256OfFile(pdfPath);
if (currentHash !== source.pdfSha256) {
    console.error(`ERRORE: hash PDF non coerente con il registro!`);
    console.error(`  registro: ${source.pdfSha256}`);
    console.error(`  attuale:  ${currentHash}`);
    console.error("Possibile sostituzione silenziosa della fonte. Bloccato.");
    process.exit(1);
}

console.log(`Estrazione di ${source.localFile} (hash verificato)...`);
const usePoppler = await hasPdftotext();
const tool = usePoppler ? "pdftotext -layout" : "pdfjs-dist (fallback)";
console.log(`Strumento: ${tool}`);

let pageTexts: string[];
if (usePoppler) {
    const tmpOut = join(outDir, "_full-poppler.txt");
    const full = await extractWithPdftotext(pdfPath, tmpOut);
    // pdftotext separa le pagine con \f (form feed)
    pageTexts = full.split("\f");
} else {
    pageTexts = await extractWithPdfjs(pdfPath);
}

const totalPages = pageTexts.length;
const from = pageRange?.from ?? 1;
const to = Math.min(pageRange?.to ?? totalPages, totalPages);

let written = 0;
for (let p = from; p <= to; p += 1) {
    const text = pageTexts[p - 1] ?? "";
    const name = `page-${String(p).padStart(4, "0")}.txt`;
    await writeFile(join(pagesDir, name), text, "utf8");
    written += 1;
}

const fullText = pageTexts.join("\n\n===== PAGINA =====\n\n");
await writeFile(join(outDir, "full-text.txt"), fullText, "utf8");

const manifest = {
    sourceId,
    extractedAt: new Date().toISOString(),
    tool,
    pdfSha256: currentHash,
    totalPages,
    pagesWritten: { from, to, count: written },
    textBytes: Buffer.byteLength(fullText, "utf8"),
    fullTextSha256: sha256OfText(fullText),
};
await writeFile(join(outDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

console.log(`Estratte ${written}/${totalPages} pagine in ${outDir}`);
console.log(`Testo totale: ${(manifest.textBytes / 1e6).toFixed(2)} MB`);
console.log(`Manifest: ${join(outDir, "manifest.json")}`);
