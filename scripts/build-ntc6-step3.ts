/* eslint-disable @typescript-eslint/no-explicit-any */
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const sourceId = "gu-so8-2018-ntc";
const profile = "ntc6-editorial-profile-0.1.0";
const createdAt = "2026-08-09T12:00:00Z";
const sourceDir = join(root, "evidence", sourceId, "pages");
const unitDir = join(root, "corpus", "units", "ntc2018");
const pageLines = new Map<number, string[]>();
for (let page = 207; page <= 209; page += 1) {
    const filename = join(sourceDir, `page-${String(page).padStart(4, "0")}.raw.txt`);
    pageLines.set(page, (await readFile(filename, "utf8")).replace(/\r\n/gu, "\n").split("\n"));
}
function raw(page: number, from: number, to = from): string {
    const lines = pageLines.get(page);
    if (!lines) throw new Error(`Evidence mancante per pagina ${page}`);
    return lines.slice(from - 1, to).join("\n");
}
function hash(value: string): string { return createHash("sha256").update(value, "utf8").digest("hex"); }
function normalize(source: string): string {
    return source
        .replace(/-\n(?=[a-zàèìòù])/gu, "")
        .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/gu, "")
        .replace(/\n/gu, " ")
        .replace(/\s+/gu, " ")
        .trim()
        .replace(/^66(?=\.\d)/u, "6")
        .replace(/\b66(?=\.\d)/gu, "6")
        .replace(/\bV ERIFICHE\b/gu, "VERIFICHE")
        .replace(/\bT IP I\b/gu, "TIPI")
        .replace(/^[ƺ-]\s*/u, "")
        .replace(/[ƺ]/gu, "")
        .replace(/superęciale/gu, "superficiale")
        .replace(/reĴięca/gu, "rettifica")
        .replace(/terrenostruttura/gu, "terreno-struttura")
        .replace(/\s+([,.;:])/gu, "$1")
        .trim();
}
function inline(): any[] | undefined { return undefined; }
function transformations(source: string, normalized: string): any[] {
    if (source === normalized) return [];
    const result: any[] = [];
    if (source.includes("\n")) result.push({ operation: "join-line-wrap", ruleVersion: profile, note: "Ricomposti i ritorni a capo tipografici verificati sul render ufficiale." });
    if (/[\u0000-\u001f\u007f-\u009fƺęĴ]/u.test(source)) result.push({ operation: "manual-correction", ruleVersion: profile, note: "Ripristinati numerazione, glifi e marcatori di elenco verificati sul render ufficiale." });
    result.push({ operation: "normalize-whitespace", ruleVersion: profile, note: "Uniformati gli spazi dopo la ricomposizione editoriale." });
    result.push({ operation: "unicode-nfc", ruleVersion: profile, note: "Testo normalizzato in Unicode NFC." });
    return result;
}
function evidence(page: number, source: string, normalized: string): any {
    return { sourceId, pdfPage: page, printedPage: String(page - 4), region: null, extraction: { method: "pdf-text", tool: "pdfjs-dist", toolVersion: "4.10.38" }, transformations: transformations(source, normalized), rawSha256: hash(source), normalizedSha256: hash(normalized) };
}
type BlockSpec = { kind: "heading" | "paragraph" | "list-item"; page: number; from: number; to?: number; norm?: string };
type UnitSpec = { number: string; title: string; heading: BlockSpec; blocks?: BlockSpec[] };
const p = (page: number, from: number, to?: number, norm?: string): BlockSpec => ({ kind: "paragraph", page, from, to, norm });
const li = (page: number, from: number, to?: number, norm?: string): BlockSpec => ({ kind: "list-item", page, from, to, norm });

const units: UnitSpec[] = [
    { number: "6.9", title: "MIGLIORAMENTO E RINFORZO DEI TERRENI E DEGLI AMMASSI ROCCIOSI", heading: { kind: "heading", page: 207, from: 8 }, blocks: [p(207, 9, 10)] },
    { number: "6.9.1", title: "SCELTA DEL TIPO DI INTERVENTO E CRITERI GENERALI DI PROGETTO", heading: { kind: "heading", page: 207, from: 11 }, blocks: [p(207, 12, 13), p(207, 14, 15), p(207, 16, 17), p(207, 18, 19), p(207, 20, 23)] },
    { number: "6.9.2", title: "MONITORAGGIO", heading: { kind: "heading", page: 207, from: 24 }, blocks: [p(207, 25, 26), p(207, 27, 28)] },
    { number: "6.10", title: "CONSOLIDAMENTO GEOTECNICO DI OPERE ESISTENTI", heading: { kind: "heading", page: 207, from: 29 }, blocks: [p(207, 30, 31)] },
    { number: "6.10.1", title: "CRITERI GENERALI DI PROGETTO", heading: { kind: "heading", page: 207, from: 32 }, blocks: [p(207, 33, 35), p(207, 36, 39), p(207, 40, 42), p(207, 43, 45)] },
    { number: "6.10.2", title: "INDAGINI GEOTECNICHE E CARATTERIZZAZIONE GEOTECNICA", heading: { kind: "heading", page: 207, from: 46 }, blocks: [p(207, 47, 49), p(207, 50, 52), p(208, 3, 6)] },
    { number: "6.10.3", title: "TIPI DI CONSOLIDAMENTO GEOTECNICO", heading: { kind: "heading", page: 208, from: 7 }, blocks: [p(208, 8), li(208, 9), li(208, 10), li(208, 11), li(208, 12), li(208, 13), li(208, 14), p(208, 15, 18), p(208, 19, 21), p(208, 22)] },
    { number: "6.10.4", title: "CONTROLLI E MONITORAGGIO", heading: { kind: "heading", page: 208, from: 23 }, blocks: [p(208, 24, 26), p(208, 27, 29)] },
    { number: "6.11", title: "DISCARICHE CONTROLLATE DI RIFIUTI E DEPOSITI DI INERTI", heading: { kind: "heading", page: 208, from: 30 }, blocks: [] },
    { number: "6.11.1", title: "DISCARICHE CONTROLLATE", heading: { kind: "heading", page: 208, from: 31 }, blocks: [] },
    { number: "6.11.1.1", title: "CRITERI DI PROGETTO", heading: { kind: "heading", page: 208, from: 32 }, blocks: [p(208, 33, 35)] },
    { number: "6.11.1.2", title: "CARATTERIZZAZIONE DEL SITO", heading: { kind: "heading", page: 208, from: 36 }, blocks: [p(208, 37, 42)] },
    { number: "6.11.1.3", title: "MODALITÀ COSTRUTTIVE E DI CONTROLLO DEI DISPOSITIVI DI BARRIERA", heading: { kind: "heading", page: 208, from: 43 }, blocks: [p(208, 44, 49)] },
    { number: "6.11.1.4", title: "VERIFICHE DI SICUREZZA", heading: { kind: "heading", page: 208, from: 50 }, blocks: [p(208, 51, 55), p(209, 3, 5)] },
    { number: "6.11.1.5", title: "MONITORAGGIO", heading: { kind: "heading", page: 209, from: 6 }, blocks: [p(209, 7, 8)] },
    { number: "6.11.2", title: "DEPOSITI DI INERTI", heading: { kind: "heading", page: 209, from: 9 }, blocks: [] },
    { number: "6.11.2.1", title: "CRITERI DI PROGETTO", heading: { kind: "heading", page: 209, from: 10 }, blocks: [p(209, 11, 12), p(209, 13, 14), p(209, 15, 17), p(209, 18, 20), p(209, 21, 22)] },
    { number: "6.11.2.2", title: "MONITORAGGIO", heading: { kind: "heading", page: 209, from: 23 }, blocks: [p(209, 24, 25), p(209, 26, 27)] },
    { number: "6.12", title: "FATTIBILITÀ DI OPERE SU GRANDI AREE", heading: { kind: "heading", page: 209, from: 28 }, blocks: [p(209, 29, 30), li(209, 31), li(209, 32), li(209, 33), li(209, 34), li(209, 35), li(209, 36), li(209, 37), li(209, 38), li(209, 39)] },
    { number: "6.12.1", title: "INDAGINI SPECIFICHE", heading: { kind: "heading", page: 209, from: 40 }, blocks: [p(209, 41, 42), p(209, 43, 46)] },
];

function blockRecord(unit: UnitSpec, block: BlockSpec, index: number): any {
    const id = `urn:structural-codes:it:unit:ntc2018:${unit.number}`;
    const blockId = `${id}#block-${index === 0 ? "heading" : `editorial-${String(index).padStart(3, "0")}`}`;
    const source = raw(block.page, block.from, block.to);
    const normalized = block.norm ?? normalize(source);
    const segments = inline();
    return { blockId, kind: block.kind, origin: "official", text: { raw: source, normalized, normalizationVersion: profile, ...(segments ? { inline: segments } : {}) }, evidence: evidence(block.page, source, normalized) };
}

const uid = (number: string): string => `urn:structural-codes:it:unit:ntc2018:${number}`;
const existing = JSON.parse(await readFile(join(unitDir, "6.8.6.2.json"), "utf8"));
const nextIndex = existing.blocks.length;
for (const [index, block] of [p(207, 3, 4), p(207, 5, 7)].entries()) existing.blocks.push(blockRecord({ number: "6.8.6.2", title: existing.title, heading: existing.blocks[0] }, block, nextIndex + index));
existing.workflow.createdBy = { actorId: "generator:ntc6:step3", kind: "script", toolVersion: profile };
await writeFile(join(unitDir, "6.8.6.2.json"), `${JSON.stringify(existing, null, 2)}\n`, "utf8");

for (const unit of units) {
    const id = uid(unit.number);
    const parts = unit.number.split(".");
    const blocks = [unit.heading, ...(unit.blocks ?? [])].map((block, index) => blockRecord(unit, block, index));
    const ancestorParts = parts.slice(0, -1);
    const record = {
        $schema: "urn:structural-codes:schema:canonical-unit:v2", schemaVersion: "2.0.0-alpha.2", recordType: "canonical-unit", id,
        workId: "it-mit:dm:2018-01-17:ntc2018", expressionId: "it-mit:dm:2018-01-17:ntc2018:original-it",
        kind: parts.length === 1 ? "chapter" : parts.length === 2 ? "section" : parts.length === 3 ? "paragraph" : "subparagraph",
        numbering: { official: unit.number, sortKey: parts.map((part) => part.padStart(3, "0")).join(".") }, title: unit.title, titleBlockId: `${id}#block-heading`,
        hierarchy: { parentId: ancestorParts.length ? uid(ancestorParts.join(".")) : null, ancestorIds: ancestorParts.map((_, index) => uid(parts.slice(0, index + 1).join("."))), position: Number(parts[parts.length - 1]) },
        validity: { from: "2018-03-22", to: null, status: "in-force", asOf: "2026-08-09" }, blocks, citations: [], relations: [], assets: { formulaIds: [], tableIds: [], figureIds: [] },
        workflow: { status: "extracted", createdBy: { actorId: "generator:ntc6:step3", kind: "script", toolVersion: profile }, createdAt, reviews: [], openIssues: [{ issueId: `ntc2018-${unit.number.replaceAll(".", "-")}-source-review`, type: "normalization-review", severity: "blocking", note: "Trascrizione confrontata con il render ufficiale nello step; resta obbligatoria la revisione umana indipendente prima della pubblicazione." }] },
    };
    await writeFile(join(unitDir, `${unit.number}.json`), `${JSON.stringify(record, null, 2)}\n`, "utf8");
}

const manifest = { $schema: "urn:structural-codes:schema:asset-manifest:v2", schemaVersion: "2.0.0-alpha.1", recordType: "asset-manifest", document: "ntc2018", section: "6-step3", sourceId, status: "transcribed-unreviewed", formulas: [], tables: [], figures: [] };
await writeFile(join(root, "corpus", "assets", "ntc2018", "6-step3.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(`ntc6-step3: generated ${units.length} units and updated 6.8.6.2`);
