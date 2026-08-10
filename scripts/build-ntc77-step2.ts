/* eslint-disable @typescript-eslint/no-explicit-any */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../", import.meta.url));
const sourceId = "gu-so8-2018-ntc";
const profile = "ntc77-78-editorial-profile-0.1.0";
const actor = { actorId: "generator:ntc77-78:step2", kind: "script", toolVersion: profile };
const createdAt = "2026-08-10T00:00:00Z";
const unitDir = join(repoRoot, "corpus", "units", "ntc2018");
const assetDir = join(repoRoot, "corpus", "assets", "ntc2018");

const pages = new Map<number, string[]>();
for (const page of [259, 260, 261, 262, 263, 264, 265, 266, 267, 268, 269, 270, 271, 272, 273, 274, 275, 276, 277, 278, 279, 280, 281, 282, 283, 284, 285, 286, 287, 288, 289, 290, 291, 292, 293]) {
    pages.set(page, (await readFile(join(repoRoot, "evidence", sourceId, "pages", `page-${String(page).padStart(4, "0")}.raw.txt`), "utf8"))
        .replace(/\r\n/gu, "\n").split("\n"));
}

type Part = [page: number, from: number, to?: number];
type MathTerm = { value: string; latex: string };
type Region = { coordinateSystem: "pdf-points-top-left"; x: number; y: number; width: number; height: number } | null;

function raw(parts: Part[]): string {
    return parts.map(([page, from, to = from]) => (pages.get(page) ?? []).slice(from - 1, to).join("\n")).join("\n");
}

function clean(value: string): string {
    return value.replace(/\n/gu, " ").replace(/\s+/gu, " ").trim();
}

function fix(value: string): string {
    const replacements: [string, string][] = [
        ["Ã ", "à"], ["Ã¨", "è"], ["Ã¬", "ì"], ["Ã²", "ò"], ["Ã¹", "ù"], ["Ã©", "é"],
        ["Ã€", "À"], ["Ãˆ", "È"], ["ÃŒ", "Ì"], ["Ã’", "Ò"], ["Ã™", "Ù"],
        ["â€™", "’"], ["â€œ", "“"], ["â€", "”"], ["â€“", "–"], ["â€”", "—"],
        ["Â§", "§"], ["Â°", "°"], ["Â±", "±"], ["Ç‚", "≤"], ["Çƒ", "≥"], ["Ç”", "≠"],
        ["È‰", "·"], ["Ä±", "−"], ["Î±", "α"], ["Î³", "γ"], ["Îµ", "ε"], ["Î»", "λ"],
    ];
    let result = value;
    for (const [from, to] of [["â€™", "’"], ["â€œ", "“"], ["â€", "”"], ["â€“", "–"], ["â€”", "—"], ["â€¦", "…"], ["Ã ", "à"], ["Ã¨", "è"], ["Ã¬", "ì"], ["Ã²", "ò"], ["Ã¹", "ù"], ["Ã©", "é"], ["Î±", "α"], ["Î²", "β"], ["Î³", "γ"], ["Îµ", "ε"], ["Î»", "λ"], ["Î½", "ν"], ["Î´", "δ"], ["Î”", "Δ"], ["Â§", "§"], ["Â°", "°"], ["Â±", "±"], ["Â·", "·"], ["Â²", "²"]] as [string, string][]) result = result.replaceAll(from, to);
    for (const [from, to] of replacements) result = result.replaceAll(from, to);
    return result;
}

function sha256(value: string): string {
    return createHash("sha256").update(value, "utf8").digest("hex");
}

function transformations(source: string, normalized: string, manual = false): any[] {
    const result: any[] = [];
    if (source.includes("\n")) result.push({ operation: "join-line-wrap", ruleVersion: profile, note: "Ricomposti i ritorni a capo tipografici verificati sul render ufficiale." });
    if (manual || normalized !== clean(source)) result.push({ operation: "manual-correction", ruleVersion: profile, note: "Ripristinati numerazione, glifi, simboli e matematica verificati sul render ufficiale." });
    if (source !== normalized) result.push({ operation: "normalize-whitespace", ruleVersion: profile, note: "Uniformati gli spazi dopo la ricomposizione." });
    if (source !== normalized) result.push({ operation: "unicode-nfc", ruleVersion: profile, note: "Testo normalizzato in Unicode NFC." });
    return result;
}

function evidence(page: number, source: string, normalized: string, manual = false, region: Region = null): any {
    return {
        sourceId,
        pdfPage: page,
        printedPage: String(page - 4),
        region,
        extraction: manual ? { method: "manual-transcription", tool: "codex-source-transcription", toolVersion: profile } : { method: "pdf-text", tool: "pdfjs-dist", toolVersion: "4.10.38" },
        transformations: transformations(source, normalized, manual),
        rawSha256: sha256(source),
        normalizedSha256: sha256(normalized),
    };
}

function inlineSegments(text: string, terms: MathTerm[] = []): any[] {
    const unique = [...new Map(terms.map((term) => [term.value, term])).values()].sort((a, b) => b.value.length - a.value.length);
    if (unique.length === 0) return [{ kind: "text", value: text }];
    const result: any[] = [];
    let cursor = 0;
    while (cursor < text.length) {
        let found: { index: number; term: MathTerm } | undefined;
        for (const term of unique) {
            const index = text.indexOf(term.value, cursor);
            if (index >= 0 && (!found || index < found.index)) found = { index, term };
        }
        if (!found) { result.push({ kind: "text", value: text.slice(cursor) }); break; }
        if (found.index > cursor) result.push({ kind: "text", value: text.slice(cursor, found.index) });
        result.push({ kind: "math", value: found.term.value, latex: found.term.latex });
        cursor = found.index + found.term.value.length;
    }
    return result.filter((item) => item.value.length > 0);
}

function uid(number: string): string { return `urn:structural-codes:it:unit:ntc2018:${number}`; }
function fid(id: string): string { return `urn:structural-codes:it:asset:formula:ntc2018:${id}`; }
function tid(id: string): string { return `urn:structural-codes:it:asset:table:ntc2018:${id}`; }
function figid(id: string): string { return "urn:structural-codes:it:asset:figure:ntc2018:" + id; }
function parent(number: string): string | null { const parts = number.split("."); return parts.length === 1 ? null : uid(parts.slice(0, -1).join(".")); }
function ancestors(number: string): string[] { const parts = number.split("."); return parts.slice(1).map((_, index) => uid(parts.slice(0, index + 1).join("."))); }
function kind(number: string): string { const depth = number.split(".").length; return depth === 1 ? "chapter" : depth === 2 ? "section" : depth === 3 ? "paragraph" : "subparagraph"; }
function part(page: number, from: number, to?: number): Part { return [page, from, to]; }

function textBlock(number: string, suffix: string, blockKind: "heading" | "paragraph" | "list-item", parts: Part[], normalized?: string, math: MathTerm[] = [], manual = false): any {
    const source = raw(parts);
    const value = normalized ?? fix(clean(source));
    return {
        blockId: `${uid(number)}#block-${suffix}`,
        kind: blockKind,
        origin: "official",
        text: { raw: source, normalized: value, normalizationVersion: profile, inline: inlineSegments(value, math) },
        evidence: evidence(parts[0]![0], source, value, manual),
    };
}

function formulaBlock(number: string, id: string, page: number, officialNumber: string | null): any {
    const label = officialNumber ? `[${officialNumber}]` : `[formula-${id}]`;
    return { blockId: `${uid(number)}#block-formula-${id.replaceAll(".", "-")}`, kind: "formula-ref", origin: "official", assetId: fid(id), evidence: evidence(page, label, label, true) };
}

function tableBlock(number: string, id: string, page: number, officialNumber: string): any {
    const label = `Tab. ${officialNumber}`;
    return { blockId: `${uid(number)}#block-table-${id.replaceAll(".", "-")}`, kind: "table-ref", origin: "official", assetId: tid(id), evidence: evidence(page, label, label, true) };
}

function figureBlock(number: string, id: string, page: number, officialNumber: string, region: Region): any {
    const label = "Fig. " + officialNumber;
    return { blockId: uid(number) + "#block-figure-" + id.replaceAll(".", "-"), kind: "figure-ref", origin: "official", assetId: figid(id), evidence: evidence(page, label, label, true, region) };
}

function cell(text: string, latex?: string, extra: Record<string, number> = {}): any { return { text, ...(latex ? { latex } : {}), ...extra }; }

function makeUnit(number: string, title: string, blocks: any[], formulas: string[] = [], tables: string[] = []): any {
    return {
        $schema: "urn:structural-codes:schema:canonical-unit:v2",
        schemaVersion: "2.0.0-alpha.2",
        recordType: "canonical-unit",
        id: uid(number), workId: "it-mit:dm:2018-01-17:ntc2018", expressionId: "it-mit:dm:2018-01-17:ntc2018:original-it",
        kind: kind(number), numbering: { official: number, sortKey: number.split(".").map((part) => part.padStart(3, "0")).join(".") },
        title, titleBlockId: `${uid(number)}#block-heading`, hierarchy: { parentId: parent(number), ancestorIds: ancestors(number), position: Number(number.split(".").at(-1)) },
        validity: { from: "2018-03-22", to: null, status: "in-force", asOf: "2026-08-10" },
        blocks, citations: [], relations: [], assets: { formulaIds: formulas.map(fid), tableIds: tables.map(tid), figureIds: [] },
        workflow: { status: "extracted", createdBy: actor, createdAt, reviews: [], openIssues: [
            { issueId: `ntc2018-${number.replaceAll(".", "-")}-source-review`, type: "normalization-review", severity: "blocking", note: "Trascrizione confrontata con il render ufficiale dello step; resta obbligatoria la revisione umana indipendente." },
            ...tables.map((table) => ({ issueId: `ntc2018-${table}-review`, type: "asset-review", severity: "blocking", note: "Tabella strutturata dal render ufficiale e da verificare umanamente cella per cella." })),
        ] },
    };
}

const q0: MathTerm = { value: "q_0", latex: "q_0" };
const quq1: MathTerm = { value: "α_u/α_1", latex: "\\alpha_u/\\alpha_1" };
const ags: MathTerm = { value: "a_{gS}", latex: "a_{gS}" };
const q: MathTerm = { value: "q", latex: "q" };
const kr: MathTerm = { value: "K_R", latex: "K_R" };
const sa: MathTerm = { value: "S_a", latex: "S_a" };

const units: any[] = [];
function add(number: string, title: string, headingParts: Part[], blocks: any[], formulas: string[] = [], tables: string[] = []) {
    units.push(makeUnit(number, title, [textBlock(number, "heading", "heading", headingParts, `${number} ${title}`, [], true), ...blocks], formulas, tables));
}

const title = (...args: [string, number, number, string]): Part[] => [part(args[1], args[2])];
const p = (number: string, suffix: string, page: number, from: number, to?: number, normalized?: string, math: MathTerm[] = []) => textBlock(number, suffix, "paragraph", [part(page, from, to)], normalized, math);
const li = (number: string, suffix: string, page: number, from: number, to?: number, normalized?: string, math: MathTerm[] = []) => textBlock(number, suffix, "list-item", [part(page, from, to)], normalized, math);
const hblock = (number: string, suffix: string, page: number, from: number, normalized: string) => textBlock(number, suffix, "heading", [part(page, from)], normalized, [], true);
const mp = (number: string, suffix: string, parts: Part[], normalized: string, math: MathTerm[] = []) => textBlock(number, suffix, "paragraph", parts, normalized, math);
// 7.7 continuation and wood structures, PDF pp.259-261.
const wood77_2 = JSON.parse(await readFile(join(unitDir, "7.7.2.json"), "utf8"));
const wood77_2Blocks = [
    p("7.7.2", "editorial-006", 259, 3),
    p("7.7.2", "editorial-007", 259, 4, 5),
    li("7.7.2", "editorial-008", 259, 6, 7),
    li("7.7.2", "editorial-009", 259, 8),
    li("7.7.2", "editorial-010", 259, 9, 10),
    p("7.7.2", "editorial-011", 259, 11),
    li("7.7.2", "editorial-012", 259, 12),
    li("7.7.2", "editorial-013", 259, 13, 14),
];
const appendedBlockIds = new Set(wood77_2Blocks.map((block: any) => block.blockId));
wood77_2.blocks = wood77_2.blocks.filter((block: any) => !appendedBlockIds.has(block.blockId));
wood77_2.blocks.push(...wood77_2Blocks);
await writeFile(join(unitDir, "7.7.2.json"), `${JSON.stringify(wood77_2, null, 2)}\n`, "utf8");

add("7.7.3", "TIPOLOGIE STRUTTURALI E FATTORI DI COMPORTAMENTO", title("7.7.3", 259, 15, "7.7.3 TIPOLOGIE STRUTTURALI E FATTORI DI COMPORTAMENTO"), [
    p("7.7.3", "p1", 259, 16, 18),
    p("7.7.3", "p2", 259, 19, 24, undefined, [q0]),
    p("7.7.3", "p3", 259, 25, 30, undefined, [q0]),
    p("7.7.3", "p4", 259, 30, 30, "."),
]);
add("7.7.3.1", "PRECISAZIONI", title("7.7.3.1", 259, 31, "7.7.3.1 PRECISAZIONI"), [
    p("7.7.3.1", "p1", 259, 32, 34),
    p("7.7.3.1", "p2", 259, 35, 36),
    li("7.7.3.1", "a", 259, 37, 38, undefined, [{ value: "d", latex: "d" }]),
    li("7.7.3.1", "b", 259, 39, 40, undefined, [{ value: "d", latex: "d" }]),
    p("7.7.3.1", "p3", 259, 41, 43, undefined, [{ value: "d", latex: "d" }]),
    p("7.7.3.1", "p4", 259, 44, 48),
]);
add("7.7.4", "ANALISI STRUTTURALE", title("7.7.4", 259, 49, "7.7.4 ANALISI STRUTTURALE"), [
    p("7.7.4", "p1", 259, 50), p("7.7.4", "p2", 259, 51, 52), p("7.7.4", "p3", 259, 53, 54),
    li("7.7.4", "a", 259, 55, 56), li("7.7.4", "b", 259, 57), p("7.7.4", "p4", 259, 58, 59),
]);
add("7.7.5", "DISPOSIZIONI COSTRUTTIVE", title("7.7.5", 260, 3, "7.7.5 DISPOSIZIONI COSTRUTTIVE"), []);
add("7.7.5.1", "GENERALITÀ", title("7.7.5.1", 260, 4, "7.7.5.1 GENERALITÀ"), [p("7.7.5.1", "p1", 260, 5, 7), p("7.7.5.1", "p2", 260, 8, 9)]);
add("7.7.5.2", "DISPOSIZIONI COSTRUTTIVE PER I COLLEGAMENTI", title("7.7.5.2", 260, 10, "7.7.5.2 DISPOSIZIONI COSTRUTTIVE PER I COLLEGAMENTI"), [p("7.7.5.2", "p1", 260, 11, 13), p("7.7.5.2", "p2", 260, 14)]);
add("7.7.5.3", "DISPOSIZIONI COSTRUTTIVE PER GLI IMPALCATI", title("7.7.5.3", 260, 15, "7.7.5.3 DISPOSIZIONI COSTRUTTIVE PER GLI IMPALCATI"), [
    p("7.7.5.3", "p1", 260, 16), li("7.7.5.3", "a", 260, 17, 19), li("7.7.5.3", "b", 260, 20, 21), li("7.7.5.3", "c", 260, 22),
    p("7.7.5.3", "p2", 260, 23, 26), p("7.7.5.3", "p3", 260, 27, 28), p("7.7.5.3", "p4", 260, 29, 31),
]);
add("7.7.6", "VERIFICHE DI SICUREZZA", title("7.7.6", 260, 32, "7.7.6 VERIFICHE DI SICUREZZA"), [
    p("7.7.6", "p1", 260, 33, 34), p("7.7.6", "p2", 260, 35, 37), li("7.7.6", "a", 260, 38), li("7.7.6", "b", 260, 39),
    p("7.7.6", "p3", 260, 40, 41), p("7.7.6", "p4", 260, 42, 43), p("7.7.6", "p5", 260, 44, 47),
]);
add("7.7.7", "REGOLE DI DETTAGLIO", title("7.7.7", 260, 48, "7.7.7 REGOLE DI DETTAGLIO"), []);
add("7.7.7.1", "DISPOSIZIONI COSTRUTTIVE PER I COLLEGAMENTI", title("7.7.7.1", 260, 49, "7.7.7.1 DISPOSIZIONI COSTRUTTIVE PER I COLLEGAMENTI"), [
    p("7.7.7.1", "p1", 260, 50, 51), p("7.7.7.1", "p2", 260, 52, 53), p("7.7.7.1", "p3", 261, 3, 6),
]);
add("7.7.7.2", "DISPOSIZIONI COSTRUTTIVE PER GLI IMPALCATI", title("7.7.7.2", 261, 7, "7.7.7.2 DISPOSIZIONI COSTRUTTIVE PER GLI IMPALCATI"), [
    p("7.7.7.2", "p1", 261, 8, 9, undefined, [{ value: "h/b", latex: "h/b" }]), p("7.7.7.2", "p2", 261, 10, 11, undefined, [{ value: "a_{gS}", latex: "a_{gS}" }]),
]);

// 7.8 general rules, PDF pp.261-265.
add("7.8", "COSTRUZIONI DI MURATURA", title("7.8", 261, 12, "7.8 COSTRUZIONI DI MURATURA"), []);
add("7.8.1", "REGOLE GENERALI", title("7.8.1", 261, 13, "7.8.1 REGOLE GENERALI"), []);
add("7.8.1.1", "PREMESSA", title("7.8.1.1", 261, 14, "7.8.1.1 PREMESSA"), [
    p("7.8.1.1", "p1", 261, 15, 17), p("7.8.1.1", "p2", 261, 18, 19), p("7.8.1.1", "p3", 261, 20, 22),
    p("7.8.1.1", "p4", 261, 23, 24), p("7.8.1.1", "p5", 261, 25, 26),
]);
add("7.8.1.2", "MATERIALI", title("7.8.1.2", 261, 27, "7.8.1.2 MATERIALI"), [
    p("7.8.1.2", "p1", 261, 28, 31, "Gli elementi da utilizzare per costruzioni di muratura portante devono essere tali da evitare rotture fragili. A tal fine gli elementi devono possedere i requisiti indicati nel § 4.5.2 e, fatta eccezione per le costruzioni caratterizzate, allo SLV, da a_{gS} ≤ 0,075g, rispettare le seguenti ulteriori indicazioni:", [ags]),
    li("7.8.1.2", "a", 261, 32), li("7.8.1.2", "b", 261, 33, 34), li("7.8.1.2", "c", 261, 35, 37, undefined, [{ value: "f_{bk}", latex: "f_{bk}" }, { value: "f_b", latex: "f_b" }]),
    li("7.8.1.2", "d", 261, 38, 40, "– resistenza caratteristica a rottura nella direzione perpendicolare a quella portante ossia nel piano di sviluppo della parete (f_{bk}), calcolata nello stesso modo, non inferiore a 1,5 MPa.", [{ value: "f_{bk}", latex: "f_{bk}" }]),
    p("7.8.1.2", "p2", 261, 41), p("7.8.1.2", "p3", 261, 42, 44), p("7.8.1.2", "p4", 261, 45, 47, "L’uso di giunti sottili (spessore compreso tra 0,5 mm e 3 mm) è consentito esclusivamente per edifici caratterizzati allo SLV, da a_{gS} ≤ 0,15 g, con le seguenti limitazioni:", [ags]),
    li("7.8.1.2", "a2", 261, 48, 50, "– altezza massima, misurata in asse allo spessore della muratura: 10,5 m se a_{gS} ≤ 0,075 g; 7 m se 0,075 g < a_{gS} ≤ 0,15 g;", [ags]),
    li("7.8.1.2", "b2", 261, 51, 53, "– numero dei piani in muratura da quota campagna: ≤ 3 per a_{gS} ≤ 0,075g; ≤ 2 per 0,075g < a_{gS} ≤ 0,15g.", [ags]),
    p("7.8.1.2", "p5", 261, 54, 57, "L’uso di giunti verticali non riempiti è consentito esclusivamente per edifici caratterizzati, allo SLV, da a_{gS} ≤ 0,075g, costituiti da un numero di piani in muratura da quota campagna non maggiore di due e altezza massima, misurata in asse allo spessore della muratura di 7 m.", [ags]),
    p("7.8.1.2", "p6", 262, 3), li("7.8.1.2", "c2", 262, 4), li("7.8.1.2", "d2", 262, 5), li("7.8.1.2", "e2", 262, 6),
    p("7.8.1.2", "p7", 262, 7), p("7.8.1.2", "p8", 262, 8, 10, "È consentito utilizzare la muratura di pietra non squadrata o la muratura listata solo per costruzioni caratterizzate, allo SLV, da a_{gS} ≤ 0,075g.", [ags]),
]);
add("7.8.1.3", "MODALITÀ COSTRUTTIVE E FATTORI DI COMPORTAMENTO", title("7.8.1.3", 262, 11, "7.8.1.3 MODALITÀ COSTRUTTIVE E FATTORI DI COMPORTAMENTO"), [
    p("7.8.1.3", "p1", 262, 12, 14, undefined, [q0]),
    p("7.8.1.3", "p2", 262, 15, 17, "Nel caso della muratura armata, valori compresi tra 2,0 α_u/α_1 e 2,5 α_u/α_1 possono essere applicati in funzione del sistema costruttivo prescelto, senza verificare quale sia il meccanismo di collasso della costruzione. Il valore 3,0 α_u/α_1 può essere utilizzato solo applicando i principi della progettazione in capacità descritti al § 7.8.1.7.", [quq1]),
    p("7.8.1.3", "p3", 262, 18, 20, "Si assume sempre q = q_0 · K_R, attribuendo a K_R i valori indicati nel § 7.3.1.", [q, q0, kr]),
    p("7.8.1.3", "p4", 262, 21), p("7.8.1.3", "p5", 262, 22, 23, undefined, [{ value: "α_1", latex: "\\alpha_1" }]), p("7.8.1.3", "p6", 262, 24, 25, undefined, [{ value: "α_u", latex: "\\alpha_u" }]),
    p("7.8.1.3", "p7", 262, 26, 27, undefined, [quq1]), p("7.8.1.3", "p8", 262, 28),
    li("7.8.1.3", "a", 262, 29, undefined, undefined, [quq1]), li("7.8.1.3", "b", 262, 30, undefined, "– costruzioni di muratura armata α_u/α_1 = 1,5", [quq1]),
    li("7.8.1.3", "c", 262, 31, undefined, undefined, [quq1]), li("7.8.1.3", "d", 262, 32, undefined, "– costruzioni di muratura confinata α_u/α_1 = 1,6", [quq1]),
    li("7.8.1.3", "e", 262, 33, undefined, undefined, [quq1]),
]);
add("7.8.1.4", "CRITERI DI PROGETTO E REQUISITI GEOMETRICI", title("7.8.1.4", 262, 34, "7.8.1.4 CRITERI DI PROGETTO E REQUISITI GEOMETRICI"), [
    p("7.8.1.4", "p1", 262, 35, 38), p("7.8.1.4", "p2", 262, 39, 41),
    p("7.8.1.4", "p3", 262, 42, 44, "La geometria delle pareti resistenti al sisma deve rispettare i requisiti indicati nella Tab. 7.8.I, in cui t indica lo spessore della parete al netto dell’intonaco, h_0 l’altezza di libera inflessione della parete come definito al § 4.5.6.2, h’ l’altezza massima delle aperture adiacenti alla parete, l la lunghezza della parete.", [{ value: "h_0", latex: "h_0" }, { value: "h’", latex: "h'" }, { value: "l", latex: "l" }]),
    tableBlock("7.8.1.4", "7.8.i", 262, "7.8.I"),
], [], ["7.8.i"]);
add("7.8.1.5", "METODI DI ANALISI", title("7.8.1.5", 263, 3, "7.8.1.5 METODI DI ANALISI"), []);
add("7.8.1.5.1", "Generalità", title("7.8.1.5.1", 263, 4, "7.8.1.5.1 Generalità"), [p("7.8.1.5.1", "p1", 263, 5)]);
const f780 = "7.8.1.5.2-7.8.0";
const fSa = "7.8.1.5.2-sa";
add("7.8.1.5.2", "Analisi lineare statica", title("7.8.1.5.2", 263, 6, "7.8.1.5.2 Analisi lineare statica"), [
    p("7.8.1.5.2", "p1", 263, 7), p("7.8.1.5.2", "p2", 263, 8, 10), p("7.8.1.5.2", "p3", 263, 11, 12), p("7.8.1.5.2", "p4", 263, 13, 21),
    p("7.8.1.5.2", "p5", 263, 22, 24, undefined, [{ value: "ΔV", latex: "\\Delta V" }]),
    formulaBlock("7.8.1.5.2", f780, 263, "7.8.0"),
    p("7.8.1.5.2", "p6", 263, 26, 29, "dove V è il taglio nel pannello e V_piano è il taglio totale al piano nella direzione parallela al pannello. Tale ridistribuzione non è ammessa nel caso in cui il rapporto α_u/α_1 necessario per il calcolo del fattore comportamento q sia stato ottenuto dal progettista direttamente da un’analisi non lineare. Viceversa, se nella determinazione di α_u/α_1 ci si è avvalsi dei valori prudenziali suggeriti al § 7.8.1.3, la ridistribuzione è ammessa.", [quq1, q]),
    p("7.8.1.5.2", "p7", 263, 30, 32, undefined, [{ value: "V_piano", latex: "V_{piano}" }]),
    p("7.8.1.5.2", "p8", 263, 33, 42, undefined, [sa]),
    formulaBlock("7.8.1.5.2", fSa, 263, null),
    p("7.8.1.5.2", "p9", 263, 45, 52, undefined, [{ value: "α", latex: "\\alpha" }, { value: "a_g", latex: "a_g" }, { value: "S", latex: "S" }, { value: "Z", latex: "Z" }, { value: "H", latex: "H" }]),
    p("7.8.1.5.2", "p10", 263, 53, 54),
], [f780, fSa]);
add("7.8.1.5.3", "Analisi dinamica modale", title("7.8.1.5.3", 263, 55, "7.8.1.5.3 Analisi dinamica modale"), [p("7.8.1.5.3", "p1", 263, 56, 57)]);
add("7.8.1.5.4", "Analisi statica non lineare", title("7.8.1.5.4", 264, 5, "7.8.1.5.4 Analisi statica non lineare"), [p("7.8.1.5.4", "p1", 264, 6, 10), p("7.8.1.5.4", "p2", 264, 11, 15)]);
add("7.8.1.5.5", "Analisi dinamica non lineare", title("7.8.1.5.5", 264, 16, "7.8.1.5.5 Analisi dinamica non lineare"), [p("7.8.1.5.5", "p1", 264, 17, 18)]);
add("7.8.1.6", "VERIFICHE DI SICUREZZA", title("7.8.1.6", 264, 19, "7.8.1.6 VERIFICHE DI SICUREZZA"), [
    p("7.8.1.6", "p1", 264, 20, 24), p("7.8.1.6", "p2", 264, 25, 26), p("7.8.1.6", "p3", 264, 27, 28), p("7.8.1.6", "p4", 264, 29, 33), p("7.8.1.6", "p5", 264, 34, 37), p("7.8.1.6", "p6", 264, 38, 39),
]);
add("7.8.1.7", "PRINCIPI DI PROGETTAZIONE IN CAPACITÀ", title("7.8.1.7", 264, 40, "7.8.1.7 PRINCIPI DI PROGETTAZIONE IN CAPACITÀ"), [p("7.8.1.7", "p1", 264, 41), p("7.8.1.7", "p2", 264, 42, 45, undefined, [{ value: "γ_{Rd}", latex: "\\gamma_{Rd}" }])]);
add("7.8.1.8", "FONDAZIONI", title("7.8.1.8", 264, 46, "7.8.1.8 FONDAZIONI"), [p("7.8.1.8", "p1", 264, 47, 48), p("7.8.1.8", "p2", 264, 49, 51)]);
const f781 = "7.8.1.9-7.8.1";
add("7.8.1.9", "COSTRUZIONI SEMPLICI", title("7.8.1.9", 264, 52, "7.8.1.9 COSTRUZIONI SEMPLICI"), [
    p("7.8.1.9", "p1", 264, 53, 55),
    p("7.8.1.9", "p2", 265, 3, 5, "Per le costruzioni semplici per cui, allo SLV, a_{gS} ≤ 0,35g non è obbligatorio eseguire alcuna analisi e verifica di sicurezza, ma è richiesto il soddisfacimento delle seguenti condizioni integrative:", [ags]),
    li("7.8.1.9", "a", 265, 6, 11), li("7.8.1.9", "b", 265, 12, 13), li("7.8.1.9", "c", 265, 14, 16),
    tableBlock("7.8.1.9", "7.8.ii", 265, "7.8.II"), p("7.8.1.9", "p3", 265, 33, 34), p("7.8.1.9", "p4", 265, 35),
    formulaBlock("7.8.1.9", f781, 265, "7.8.1"),
    p("7.8.1.9", "p5", 265, 44, 46, undefined, [{ value: "N", latex: "N" }, { value: "γ_G", latex: "\\gamma_G" }, { value: "γ_Q", latex: "\\gamma_Q" }, { value: "A", latex: "A" }, { value: "f_k", latex: "f_k" }]),
    p("7.8.1.9", "p6", 265, 47, 48),
], [f781], ["7.8.ii"]);
add("7.8.2", "COSTRUZIONI DI MURATURA ORDINARIA", title("7.8.2", 265, 49, "7.8.2 COSTRUZIONI DI MURATURA ORDINARIA"), []);
add("7.8.2.1", "CRITERI DI PROGETTO", title("7.8.2.1", 265, 50, "7.8.2.1 CRITERI DI PROGETTO"), [p("7.8.2.1", "p1", 265, 51, 56)]);
const f782 = "7.8.2.2.1-7.8.2";
const f783 = "7.8.2.2.2-7.8.3";
const f784 = "7.8.2.2.4-7.8.4";
const f785 = "7.8.2.2.4-7.8.5";
const f786 = "7.8.2.2.4-7.8.6";
const f787 = "7.8.3.2.2-7.8.7";
const f788 = "7.8.3.2.2-7.8.8";
const f789 = "7.8.3.2.2-7.8.9";
const f7810 = "7.8.3.2.2-7.8.10";
add("7.8.2.2", "VERIFICHE DI SICUREZZA", title("7.8.2.2", 265, 57, "7.8.2.2 VERIFICHE DI SICUREZZA"), []);
add("7.8.2.2.1", "Pressoflessione nel piano", title("7.8.2.2.1", 265, 58, "7.8.2.2.1 Pressoflessione nel piano"), [
    p("7.8.2.2.1", "p1", 265, 59, 62, "La verifica a pressoflessione di una sezione di un elemento strutturale si esegue confrontando il momento agente di progetto con il momento ultimo resistente calcolato assumendo la muratura non reagente a trazione e un’opportuna distribuzione non lineare delle compressioni. Nel caso di una sezione rettangolare e diagramma delle compressioni rettangolare con valore della resistenza pari a 0,85 f_d, tale momento ultimo può essere calcolato come:", [{ value: "f_d", latex: "f_d" }]),
    formulaBlock("7.8.2.2.1", f782, 265, "7.8.2"), p("7.8.2.2.1", "p2", 265, 84, 85, undefined, [{ value: "M_u", latex: "M_u" }]),
], [f782]);

const masonry721 = JSON.parse(await readFile(join(unitDir, "7.8.2.2.1.json"), "utf8"));
const masonry721Blocks = [
    p("7.8.2.2.1", "editorial-003", 266, 3, 4, "l è la lunghezza complessiva della parete (comprensiva della zona tesa);"),
    p("7.8.2.2.1", "editorial-004", 266, 4, 4, "t è lo spessore della zona compressa della parete;"),
    p("7.8.2.2.1", "editorial-005", 266, 5, 6, "σ_0 è la tensione normale media, riferita all’area totale della sezione, σ_0 = N/(l·t), con N forza assiale agente positiva se di compressione); se N è di trazione, M_u = 0", [
        { value: "σ_0", latex: "\\sigma_0" }, { value: "σ_0 = N/(l·t)", latex: "\\sigma_0=\\frac{N}{l\\,t}" }, { value: "N", latex: "N" }, { value: "M_u", latex: "M_u" },
    ]),
    p("7.8.2.2.1", "editorial-006", 266, 7, 7, "f_d = f_k / γ_M è la resistenza a compressione di progetto della muratura.", [{ value: "f_d = f_k / γ_M", latex: "f_d=\\frac{f_k}{\\gamma_M}" }]),
    p("7.8.2.2.1", "editorial-007", 266, 8, 10, "In caso di analisi statica non lineare, la capacità a pressoflessione può essere calcolata ponendo f_d pari al valore medio della capacità a compressione della muratura e lo spostamento ultimo allo SLC, a meno di moti rigidi del pannello, può essere assunto pari all’1,0% dell’altezza del pannello.", [{ value: "f_d", latex: "f_d" }]),
];
const masonry721BlockIds = new Set(masonry721Blocks.map((block: any) => block.blockId));
masonry721.blocks = masonry721.blocks.filter((block: any) => !masonry721BlockIds.has(block.blockId));
masonry721.blocks.push(...masonry721Blocks);
await writeFile(join(unitDir, "7.8.2.2.1.json"), JSON.stringify(masonry721, null, 2) + "\n", "utf8");

add("7.8.2.2.2", "Taglio", title("7.8.2.2.2", 266, 11, "7.8.2.2.2 Taglio"), [
    p("7.8.2.2.2", "p1", 266, 12, 12, "La capacità a taglio di ciascun elemento strutturale è valutata per mezzo della relazione seguente:"),
    formulaBlock("7.8.2.2.2", f783, 266, "7.8.3"),
    p("7.8.2.2.2", "p2", 266, 14, 14, "dove:"),
    p("7.8.2.2.2", "p3", 266, 15, 16, "l' è la lunghezza della parte compressa della parete ottenuta sulla base di un diagramma lineare delle compressioni ed in assenza di resistenza a trazione;", [{ value: "l'", latex: "l'" }]),
    p("7.8.2.2.2", "p4", 266, 17, 17, "t è lo spessore della parete;", [{ value: "t", latex: "t" }]),
    p("7.8.2.2.2", "p5", 266, 18, 19, "f_{yd} = f_{yk} / γ_M è definito al § 4.5.6.1 e al § 11.3.3, calcolando la tensione normale media (indicata con σ_n nei paragrafi citati) sulla parte compressa della sezione (σ_n = N/(l'·t)).", [
        { value: "f_{yd} = f_{yk} / γ_M", latex: "f_{yd}=\\frac{f_{yk}}{\\gamma_M}" }, { value: "σ_n", latex: "\\sigma_n" }, { value: "σ_n = N/(l'·t)", latex: "\\sigma_n=\\frac{N}{l'\\,t}" },
    ]),
    p("7.8.2.2.2", "p6", 266, 20, 22, "In caso di analisi statica non lineare, la resistenza a taglio può essere calcolata ponendo f_{yd} = f_{vm0} + 0,4 σ_n ≤ f_{y,lim} con f_{vm0} resistenza media a taglio della muratura (in assenza di determinazione diretta si può porre f_{vm0} = f_{vk0}/0,7 e f_{y,lim} = f_{yk,lim}/0,7), e lo spostamento ultimo allo SLC, a meno di moti rigidi del pannello, può essere assunto pari allo 0,5% dell’altezza del pannello.", [
        { value: "f_{yd} = f_{vm0} + 0,4 σ_n ≤ f_{y,lim}", latex: "f_{yd}=f_{vm0}+0{,}4\\,\\sigma_n\\le f_{y,lim}" }, { value: "f_{vm0} = f_{vk0}/0,7", latex: "f_{vm0}=f_{vk0}/0{,}7" }, { value: "f_{y,lim} = f_{yk,lim}/0,7", latex: "f_{y,lim}=f_{yk,lim}/0{,}7" },
    ]),
], [f783]);
add("7.8.2.2.3", "Pressoflessione fuori piano", title("7.8.2.2.3", 266, 23, "7.8.2.2.3 Pressoflessione fuori piano"), [
    p("7.8.2.2.3", "p1", 266, 24, 26, "Il valore del momento di collasso per azioni perpendicolari al piano della parete è calcolato assumendo un diagramma delle compressioni rettangolare, un valore della resistenza pari a 0,85 f_d e trascurando la resistenza a trazione della muratura. Per la verifica si può fare utile riferimento al 7.8.2.2.1.", [{ value: "0,85 f_d", latex: "0{,}85f_d" }]),
]);
add("7.8.2.2.4", "Travi in muratura", title("7.8.2.2.4", 266, 27, "7.8.2.2.4 Travi in muratura"), [
    p("7.8.2.2.4", "p1", 266, 28, 32, "La verifica di travi di accoppiamento in muratura ordinaria, in presenza di azione assiale orizzontale nota, viene effettuata in analogia a quanto previsto per i pannelli murari verticali. Qualora l’azione assiale non sia nota dal modello di calcolo (ad es. quando l’analisi è svolta su modelli a telaio con l’ipotesi di solai infinitamente rigidi nel piano), ma siano presenti, in prossimità della trave in muratura, elementi orizzontali dotati di resistenza a trazione (catene, cordoli), i valori delle resistenze possono essere assunti non superiori ai valori di seguito riportati ed associati ai meccanismi di rottura per taglio o per pressoflessione."),
    p("7.8.2.2.4", "p2", 266, 33, 34, "La capacità a taglio V_t di travi di accoppiamento in muratura ordinaria in presenza di un cordolo di piano o di un architrave resistente a flessione efficacemente ammorsato alle estremità, può essere calcolata in modo semplificato come", [{ value: "V_t", latex: "V_t" }]),
    formulaBlock("7.8.2.2.4", f784, 266, "7.8.4"),
    p("7.8.2.2.4", "p3", 266, 36, 36, "dove:"),
    p("7.8.2.2.4", "p4", 266, 37, 37, "h è l’altezza della sezione della trave", [{ value: "h", latex: "h" }]),
    p("7.8.2.2.4", "p5", 266, 38, 39, "f_{vd0} = f_{vk0} / γ_M è la resistenza di progetto a taglio in assenza di compressione; nel caso di analisi statica non lineare può essere posta pari al valore medio (f_{vd0} = f_{vm0}).", [
        { value: "f_{vd0} = f_{vk0} / γ_M", latex: "f_{vd0}=\\frac{f_{vk0}}{\\gamma_M}" }, { value: "f_{vd0} = f_{vm0}", latex: "f_{vd0}=f_{vm0}" },
    ]),
    p("7.8.2.2.4", "p6", 266, 40, 41, "La capacità massima a flessione, associata al meccanismo di pressoflessione, sempre in presenza di elementi orizzontali resistenti a trazione in grado di equilibrare una compressione orizzontale nelle travi in muratura, può essere valutata come"),
    formulaBlock("7.8.2.2.4", f785, 266, "7.8.5"),
    p("7.8.2.2.4", "p7", 266, 58, 58, "dove"),
    p("7.8.2.2.4", "p8", 266, 59, 59, "H_p è il minimo tra la capacità a trazione dell’elemento teso disposto orizzontalmente ed il valore 0,4 f_{hd} h t", [{ value: "H_p", latex: "H_p" }, { value: "0,4 f_{hd} h t", latex: "0{,}4f_{hd}ht" }]),
    p("7.8.2.2.4", "p9", 266, 60, 61, "f_{hd} = f_{hk} / γ_M è la resistenza di progetto a compressione della muratura in direzione orizzontale (nel piano della parete). Nel caso di analisi statica non lineare essa può essere posta uguale al valore medio (f_{hd} = f_{hm}).", [
        { value: "f_{hd} = f_{hk} / γ_M", latex: "f_{hd}=\\frac{f_{hk}}{\\gamma_M}" }, { value: "f_{hd} = f_{hm}", latex: "f_{hd}=f_{hm}" },
    ]),
    p("7.8.2.2.4", "p10", 266, 62, 62, "La capacità a taglio, associata a tale meccanismo, può essere calcolata come:"),
    formulaBlock("7.8.2.2.4", f786, 266, "7.8.6"),
    p("7.8.2.2.4", "p11", 266, 64, 64, "dove l è la luce libera della trave in muratura.", [{ value: "l", latex: "l" }]),
    p("7.8.2.2.4", "p12", 266, 65, 65, "Il valore della capacità a taglio per l’elemento trave in muratura ordinaria è assunto pari al minimo tra V_t e V_p.", [{ value: "V_t", latex: "V_t" }, { value: "V_p", latex: "V_p" }]),
], [f784, f785, f786]);

add("7.8.3", "COSTRUZIONI DI MURATURA ARMATA", title("7.8.3", 267, 3, "7.8.3 COSTRUZIONI DI MURATURA ARMATA"), []);
add("7.8.3.1", "CRITERI DI PROGETTO", title("7.8.3.1", 267, 4, "7.8.3.1 CRITERI DI PROGETTO"), [
    p("7.8.3.1", "p1", 267, 5, 6, "L’insieme strutturale risultante deve essere in grado di reagire alle azioni esterne orizzontali con un comportamento di tipo globale, al quale contribuisce soltanto la resistenza delle pareti nel loro piano."),
]);
add("7.8.3.2", "VERIFICHE DI SICUREZZA", title("7.8.3.2", 267, 7, "7.8.3.2 VERIFICHE DI SICUREZZA"), []);
add("7.8.3.2.1", "Pressoflessione nel piano", title("7.8.3.2.1", 267, 8, "7.8.3.2.1 Pressoflessione nel piano"), [
    p("7.8.3.2.1", "p1", 267, 9, 11, "Per la verifica di sezioni pressoinflesse può essere assunto un diagramma delle compressioni rettangolare, con profondità pari a 0,8 la profondità dell’asse neutro e tensione pari a 0,85 f_d. Le deformazioni massime da considerare sono pari a ε_m = 0,0035 per la muratura compressa e ε_s = 0,01 per l’acciaio teso.", [{ value: "0,85 f_d", latex: "0{,}85f_d" }, { value: "ε_m = 0,0035", latex: "\\varepsilon_m=0{,}0035" }, { value: "ε_s = 0,01", latex: "\\varepsilon_s=0{,}01" }]),
    p("7.8.3.2.1", "p2", 267, 12, 13, "In caso di analisi statica non lineare si adottano come valori di progetto le resistenze medie dei materiali e lo spostamento ultimo può essere assunto pari all’1,6% dell’altezza del pannello."),
]);
add("7.8.3.2.2", "Taglio", title("7.8.3.2.2", 267, 14, "7.8.3.2.2 Taglio"), [
    p("7.8.3.2.2", "p1", 267, 15, 19, "La resistenza a taglio (V_t) è calcolata come somma dei contributi della muratura (V_{t,M}) e dell’armatura (V_{t,S}), secondo le relazioni seguenti:", [{ value: "V_t", latex: "V_t" }, { value: "V_{t,M}", latex: "V_{t,M}" }, { value: "V_{t,S}", latex: "V_{t,S}" }]),
    formulaBlock("7.8.3.2.2", f787, 267, "7.8.7"),
    formulaBlock("7.8.3.2.2", f788, 267, "7.8.8"),
    p("7.8.3.2.2", "p2", 267, 22, 22, "dove:"),
    p("7.8.3.2.2", "p3", 267, 23, 23, "d è la distanza tra il lembo compresso e il baricentro dell’armatura tesa;", [{ value: "d", latex: "d" }]),
    p("7.8.3.2.2", "p4", 267, 24, 24, "t è lo spessore della parete;", [{ value: "t", latex: "t" }]),
    p("7.8.3.2.2", "p5", 267, 25, 26, "f_{yd} = f_{yk} / γ_M è definito al § 4.5.6.1 calcolando la tensione normale media (indicata con σ_n nel paragrafo citato) sulla sezione lorda di larghezza d (σ_n = P/dt).", [
        { value: "f_{yd} = f_{yk} / γ_M", latex: "f_{yd}=\\frac{f_{yk}}{\\gamma_M}" }, { value: "σ_n", latex: "\\sigma_n" }, { value: "σ_n = P/dt", latex: "\\sigma_n=\\frac{P}{d\\,t}" },
    ]),
    formulaBlock("7.8.3.2.2", f789, 267, "7.8.9"),
    p("7.8.3.2.2", "p7", 267, 28, 28, "dove:"),
    p("7.8.3.2.2", "p8", 267, 29, 29, "d è la distanza tra il lembo compresso e il baricentro dell’armatura tesa;", [{ value: "d", latex: "d" }]),
    p("7.8.3.2.2", "p9", 267, 30, 31, "A_{sw} è l’area dell’armatura a taglio disposta in direzione parallela alla forza di taglio, con passo s misurato ortogonalmente alla direzione della forza di taglio;", [{ value: "A_{sw}", latex: "A_{sw}" }, { value: "s", latex: "s" }]),
    p("7.8.3.2.2", "p10", 267, 32, 32, "f_{yd} è la tensione di snervamento di progetto dell’acciaio;", [{ value: "f_{yd}", latex: "f_{yd}" }]),
    p("7.8.3.2.2", "p11", 267, 33, 33, "s è la distanza tra i livelli di armatura.", [{ value: "s", latex: "s" }]),
    p("7.8.3.2.2", "p12", 267, 34, 34, "Deve essere altresì verificato che il taglio agente non superi il seguente valore:"),
    formulaBlock("7.8.3.2.2", f7810, 267, "7.8.10"),
    p("7.8.3.2.2", "p13", 267, 36, 36, "dove:"),
    p("7.8.3.2.2", "p14", 267, 37, 37, "t è lo spessore della parete", [{ value: "t", latex: "t" }]),
    p("7.8.3.2.2", "p15", 267, 38, 38, "f_d è la resistenza a compressione di progetto della muratura.", [{ value: "f_d", latex: "f_d" }]),
    p("7.8.3.2.2", "p16", 267, 39, 40, "In caso di analisi statica non lineare si adottano come valori di progetto le resistenze medie dei materiali e lo spostamento ultimo può essere assunto pari allo 0,8% dell’altezza del pannello."),
], [f787, f788, f789, f7810]);
add("7.8.3.2.3", "Pressoflessione fuori piano", title("7.8.3.2.3", 267, 41, "7.8.3.2.3 Pressoflessione fuori piano"), [
    p("7.8.3.2.3", "p1", 267, 42, 43, "Nel caso di azioni agenti perpendicolarmente al piano della parete, la verifica si esegue adottando, per muratura e acciaio, il diagramma delle compressioni e i valori di deformazione limite utilizzati per la verifica nel piano."),
]);
add("7.8.4", "COSTRUZIONI DI MURATURA CONFINATA", title("7.8.4", 267, 44, "7.8.4 COSTRUZIONI DI MURATURA CONFINATA"), [
    p("7.8.4", "p1", 267, 45, 47, "La progettazione e la realizzazione di costruzioni di muratura confinata deve essere eseguita in accordo con i criteri e le regole date nella UNI EN 1998-1, con le precisazioni riportate negli Annessi tecnici nazionali agli Eurocodici ed applicando le regole di dettaglio di cui al § 7.8.6.3."),
]);

add("7.8.5", "STRUTTURE MISTE", title("7.8.5", 267, 48, "7.8.5 STRUTTURE MISTE"), [
    mp("7.8.5", "p1", [part(267, 49, 53), part(268, 3, 4)], "Nell’ambito delle costruzioni di muratura è consentito utilizzare strutture di diversa tecnologia per sopportare i carichi verticali, purché la resistenza all’azione sismica sia integralmente affidata agli elementi di identica tecnologia. Nel caso in cui si affidi integralmente la resistenza alle pareti in muratura, per esse devono essere rispettate le prescrizioni di cui ai punti precedenti. Nel caso si affidi integralmente la resistenza alle strutture di altra tecnologia (ad esempio pareti in c.a.), devono essere seguite le regole di progettazione riportate nei relativi capitoli della presente norma. In casi in cui si ritenesse necessario considerare la collaborazione delle pareti in muratura e dei sistemi di diversa tecnologia nella resistenza al sisma, quest’ultima deve essere verificata utilizzando i metodi di analisi non lineare."),
    p("7.8.5", "p2", 268, 5, 7, "I collegamenti fra elementi di tecnologia diversa devono essere espressamente verificati. Particolare attenzione deve essere prestata alla verifica dell’efficace trasmissione dei carichi verticali. Inoltre è necessario verificare la compatibilità delle deformazioni per tutte le parti strutturali."),
    p("7.8.5", "p3", 268, 8, 9, "È consentito altresì realizzare costruzioni costituite da struttura muraria nella parte inferiore e sormontate da un piano con struttura in calcestruzzo armato o acciaio o legno o altra tecnologia, alle seguenti condizioni:"),
    li("7.8.5", "a", 268, 10, 12, "i limiti all’altezza delle costruzioni previsti per le strutture in muratura si intendono comprensivi delle parti in muratura e di quelle in altra tecnologia;"),
    li("7.8.5", "b", 268, 13, 13, "la parte superiore di diversa tecnologia sia efficacemente ancorata al cordolo di coronamento della parte muraria;"),
    li("7.8.5", "c", 268, 14, 17, "nel caso di metodo di analisi lineare, l’uso dell’analisi statica (nei limiti di applicabilità riportati al § 7.8.1.5.2) è consentito a condizione di utilizzare una distribuzione di forze compatibile con la prima forma modale elastica in ciascuna direzione, calcolata con metodi sufficientemente accurati che tengano conto della distribuzione irregolare di rigidezza in elevazione. A tal fine, in assenza di metodi più accurati, la prima forma modale può essere stimata dagli spostamenti ottenuti applicando staticamente alla costruzione la distribuzione di forze definita nel § 7.3.3.2;"),
    li("7.8.5", "d", 268, 18, 19, "nel caso di analisi statica non lineare, si utilizzino le distribuzioni di forze orizzontali previste al § 7.3.4.2, dove la prima forma modale elastica è stata calcolata con metodi sufficientemente accurati."),
    li("7.8.5", "e", 268, 20, 22, "nel caso di analisi lineare, per la verifica della parte in muratura si utilizzi il fattore di comportamento q prescritto al § 7.8.1.3; per la verifica della parte superiore di altra tecnologia si utilizzi il fattore di comportamento adatto alla tipologia costruttiva e alla configurazione (regolarità) della parte superiore, comunque non superiore a 2,5;"),
    li("7.8.5", "f", 268, 23, 24, "tutti i collegamenti fra la parte di diversa tecnologia e la parte in muratura siano localmente verificati in base alle forze trasmesse calcolate nell’analisi, maggiorate del 30%."),
]);
add("7.8.6", "REGOLE DI DETTAGLIO", title("7.8.6", 268, 25, "7.8.6 REGOLE DI DETTAGLIO"), []);
add("7.8.6.1", "COSTRUZIONI DI MURATURA ORDINARIA", title("7.8.6.1", 268, 26, "7.8.6.1 COSTRUZIONI DI MURATURA ORDINARIA"), [
    p("7.8.6.1", "p1", 268, 27, 27),
    p("7.8.6.1", "p2", 268, 28, 33, "I cordoli devono avere altezza minima pari all’altezza del solaio e larghezza almeno pari a quella del muro; è consentito un arretramento massimo non superiore a 60 mm e a 0,25 t dal filo esterno per murature di spessore t fino a 300 mm. Per murature di spessore t superiore, l’arretramento può essere maggiore di 60 mm, ma non superiore a 0,2 t. L’area dell’armatura corrente non deve essere inferiore a 8 cm², le staffe devono avere diametro non inferiore a 6 mm ed interasse non superiore a 250 mm. Travi metalliche o prefabbricate costituenti i solai devono essere prolungate nel cordolo per almeno la metà della sua larghezza e comunque per non meno di 120 mm ed adeguatamente ancorate ad esso.", [{ value: "t", latex: "t" }]),
    p("7.8.6.1", "p3", 268, 34, 37),
    p("7.8.6.1", "p4", 268, 38, 38),
]);
add("7.8.6.2", "COSTRUZIONI DI MURATURA ARMATA", title("7.8.6.2", 268, 39, "7.8.6.2 COSTRUZIONI DI MURATURA ARMATA"), [
    p("7.8.6.2", "p1", 268, 40, 41),
    p("7.8.6.2", "p2", 268, 42, 42),
    p("7.8.6.2", "p3", 268, 43, 45),
    p("7.8.6.2", "p4", 268, 46, 47),
    p("7.8.6.2", "p5", 268, 48, 49),
    p("7.8.6.2", "p6", 268, 50, 51),
]);
add("7.8.6.3", "COSTRUZIONI DI MURATURA CONFINATA", title("7.8.6.3", 268, 52, "7.8.6.3 COSTRUZIONI DI MURATURA CONFINATA"), [
    p("7.8.6.3", "p1", 268, 53, 53),
    li("7.8.6.3", "a", 268, 54, 55, "gli elementi di confinamento orizzontale e verticali dovranno essere collegati fra loro e ancorati agli elementi del sistema strutturale principale;"),
    li("7.8.6.3", "b", 269, 3, 4, "per garantire un collegamento efficace fra gli elementi di confinamento e la muratura, il calcestruzzo degli elementi di confinamento dovrà essere gettato dopo la realizzazione della muratura;"),
    li("7.8.6.3", "c", 269, 5, 7, "la minima dimensione trasversale degli elementi di confinamento orizzontali e verticali non dovrà essere inferiore a 150 mm. Nelle pareti a doppio foglio lo spessore degli elementi di confinamento deve garantire la connessione dei due fogli ed il loro confinamento;"),
    li("7.8.6.3", "d", 269, 8, 8, "gli elementi di confinamento verticali dovranno essere posizionati:"),
    li("7.8.6.3", "d-a", 269, 9, 9, "lungo i bordi liberi di ogni parete strutturale;"),
    li("7.8.6.3", "d-b", 269, 10, 10, "su entrambi i lati delle aperture aventi area maggiore di 1,5 m²;"),
    li("7.8.6.3", "d-c", 269, 11, 11, "all’interno delle pareti con passo non maggiore di 5 m;"),
    li("7.8.6.3", "d-d", 269, 12, 13, "alle intersezioni delle pareti strutturali, in tutti i casi in cui gli elementi di confinamento più vicini siano ad una distanza superiore a 1,5 m;"),
    li("7.8.6.3", "e", 269, 14, 15, "gli elementi di confinamento orizzontali dovranno essere posizionati nel piano della parete ad ogni piano e, in ogni caso, ad un passo non maggiore di 4 m;"),
    li("7.8.6.3", "f", 269, 16, 17, "l’armatura longitudinale degli elementi di confinamento deve avere un’area non inferiore a 300 mm² o all’1% della sezione dell’elemento di confinamento;"),
    li("7.8.6.3", "g", 269, 18, 18, "le staffe dovranno avere diametro non inferiore a 5 mm e passo non maggiore di 15 cm;"),
    li("7.8.6.3", "h", 269, 19, 19, "le lunghezze di sovrapposizione delle barre longitudinali non dovranno essere minori di 60 diametri."),
]);

add("7.9", "PONTI", title("7.9", 269, 20, "7.9 PONTI"), []);
add("7.9.1", "CAMPO DI APPLICAZIONE", title("7.9.1", 269, 21, "7.9.1 CAMPO DI APPLICAZIONE"), [
    p("7.9.1", "p1", 269, 22, 23),
    p("7.9.1", "p2", 269, 24, 26),
    p("7.9.1", "p3", 269, 27, 28),
]);
add("7.9.2", "CRITERI GENERALI DI PROGETTAZIONE", title("7.9.2", 269, 29, "7.9.2 CRITERI GENERALI DI PROGETTAZIONE"), [
    p("7.9.2", "p1", 269, 30, 34),
    p("7.9.2", "p2", 269, 35, 37),
    p("7.9.2", "p3", 269, 38, 41),
    p("7.9.2", "p4", 269, 42, 46),
    p("7.9.2", "p5", 269, 47, 50),
    p("7.9.2", "p6", 269, 51, 53),
    p("7.9.2", "p7", 269, 54, 57),
]);

const f791 = "7.9.2.1-7.9.1";
const f792 = "7.9.2.1-7.9.2";
const f793 = "7.9.4-7.9.3";
const f794 = "7.9.4.1-7.9.4";
const f795 = "7.9.4.1-7.9.5";
const f796 = "7.9.4.1-7.9.6";
const f797 = "7.9.5-7.9.7";
const f798 = "7.9.5.1.1-7.9.8";
const f799 = "7.9.5.1.1-7.9.9";
const f7910a = "7.9.5.1.1-7.9.10a";
const f7910b = "7.9.5.1.1-7.9.10b";
const f7911 = "7.9.5.1.1-7.9.11";
const f7912 = "7.9.5.2.1-7.9.12";
const f7915 = "7.9.6.1.1-7.9.15";
const f7916 = "7.9.6.1.1-7.9.16";
const f7917 = "7.9.6.1.1-7.9.17";
const f7918 = "7.9.6.1.1-7.9.18";
const f7919 = "7.9.6.1.1-7.9.19";
const f7920 = "7.9.6.1.1-7.9.20";
const f7921 = "7.9.6.1.1-7.9.21";
const f7922 = "7.9.6.1.2-7.9.22";
const f7923 = "7.9.6.1.2-7.9.23";
const fig791 = "7.9.3-fig7.9.1";
const f7101 = "7.10.5.3.1-7.10.1";
const f7102 = "7.10.5.3.1-7.10.2";
const f7103 = "7.10.5.3.1-7.10.3";
const f7104 = "7.10.5.3.1-7.10.4";
const f7105 = "7.10.5.3.1-7.10.5";
const f7111 = "7.11.2-7.11.1";
const f7112 = "7.11.2-7.11.2";
const f7113 = "7.11.3.5.2-7.11.3";
const f7114 = "7.11.3.5.2-7.11.4";
const f7115 = "7.11.3.5.2-7.11.5";
const fig7111 = "7.11.3.4.2-fig7.11.1";
const f7116 = "7.11.6.2.1-7.11.6";
const f7117 = "7.11.6.2.1-7.11.7";
const f7118 = "7.11.6.2.1-7.11.8";
const f7119 = "7.11.6.3.1-7.11.9";
const f71110 = "7.11.6.3.1-7.11.10";
const f71111 = "7.11.6.3.1-7.11.11";
const f71112 = "7.11.6.4-7.11.12";
const fig7112 = "7.11.6.3.2-fig7.11.2";
const fig7113 = "7.11.6.3.2-fig7.11.3";

add("7.9.2.1", "VALORI DEL FATTORE DI COMPORTAMENTO", title("7.9.2.1", 270, 3, "7.9.2.1 VALORI DEL FATTORE DI COMPORTAMENTO"), [
    p("7.9.2.1", "p1", 270, 4, 4, "Nel caso di comportamento strutturale non dissipativo, per le due componenti orizzontali dell’azione sismica, q_0 è assunto pari a 1,0.", [{ value: "q_0", latex: "q_0" }]),
    p("7.9.2.1", "p2", 270, 5, 10, "Nel caso di comportamento strutturale dissipativo, per le due componenti orizzontali dell’azione sismica, i valori massimi del valore di base q_0 del fattore di comportamento sono riportati in Tab. 7.3.II; in essa: λ(α)=1, se α ≥ 3, λ(α)=(α/3)^0,5, se 3 > α ≥ 1, essendo α = L/H, dove L è la distanza della sezione di cerniera plastica dalla sezione di momento nullo ed H è la dimensione della sezione nel piano di inflessione della cerniera plastica.", [{ value: "q_0", latex: "q_0" }, { value: "λ(α)=1", latex: "\\lambda(\\alpha)=1" }, { value: "λ(α)=(α/3)^0,5", latex: "\\lambda(\\alpha)=(\\alpha/3)^{0{,}5}" }, { value: "α = L/H", latex: "\\alpha=L/H" }]),
    p("7.9.2.1", "p3", 270, 11, 15, "Per gli elementi duttili di calcestruzzo armato i valori di q_0 della Tab. 7.3.II valgono solo se la sollecitazione di compressione normalizzata ν_k, ottenuta dividendo lo sforzo di progetto N_Ed per la resistenza a compressione semplice della sezione (ν_k = N_Ed/A_c f_ck), non eccede il valore 0,3.", [{ value: "q_0", latex: "q_0" }, { value: "ν_k", latex: "\\nu_k" }, { value: "N_Ed", latex: "N_{Ed}" }, { value: "A_c f_ck", latex: "A_c f_{ck}" }]),
    p("7.9.2.1", "p4", 270, 16, 16, "La sollecitazione di compressione normalizzata non può superare il valore ν_k = 0,6.", [{ value: "ν_k = 0,6", latex: "\\nu_k=0{,}6" }]),
    p("7.9.2.1", "p5a", 270, 17, 17, "Per valori di ν_k intermedi tra 0,3 e 0,6, il valore di q_0 è dato da:", [{ value: "ν_k", latex: "\\nu_k" }, { value: "q_0", latex: "q_0" }]),
    formulaBlock("7.9.2.1", f791, 270, "7.9.1"),
    p("7.9.2.1", "p5b", 270, 29, 29, "essendo q_0 il valore applicabile per ν_k ≤ 0,3.", [{ value: "q_0", latex: "q_0" }, { value: "ν_k ≤ 0,3", latex: "\\nu_k\\le0{,}3" }]),
    p("7.9.2.1", "p6", 270, 30, 33),
    p("7.9.2.1", "p7", 270, 34, 35),
    p("7.9.2.1", "p8", 270, 36, 37),
    p("7.9.2.1", "p9", 270, 38, 40, "Il requisito di regolarità, quindi l’applicabilità di un valore K_R = 1, può essere verificato a posteriori mediante il seguente procedimento:", [{ value: "K_R = 1", latex: "K_R=1" }]),
    li("7.9.2.1", "a", 270, 41, 48, "per ciascun elemento duttile si calcoli il rapporto: r_i = q_0 M_Ed,i/M_Rd,i, dove M_Ed,i è il momento alla base dell’elemento duttile i-esimo prodotto dalla combinazione sismica di progetto, M_Rd,i è il corrispondente momento resistente;", [{ value: "r_i = q_0 M_Ed,i/M_Rd,i", latex: "r_i=q_0M_{Ed,i}/M_{Rd,i}" }]),
    li("7.9.2.1", "b", 270, 49, 50, "la geometria del ponte si considera “regolare” se il rapporto tra il massimo ed il minimo dei rapporti r_i, calcolati per le pile facenti parte del sistema resistente al sisma nella direzione considerata, risulta inferiore a 2 (r̃ = r_i,max/r_i,min < 2).", [{ value: "r̃ = r_i,max/r_i,min < 2", latex: "\\tilde r=r_{i,\\max}/r_{i,\\min}<2" }]),
    p("7.9.2.1", "p10a", 270, 51, 51, "Nel caso risulti r̃ ≥ 2, l’analisi deve essere ripetuta utilizzando il seguente valore ridotto di K_R:", [{ value: "r̃ ≥ 2", latex: "\\tilde r\\ge2" }, { value: "K_R", latex: "K_R" }]),
    formulaBlock("7.9.2.1", f792, 270, "7.9.2"),
    p("7.9.2.1", "p10b", 270, 53, 54, "e comunque assumendo sempre q = q_0 K_R ≥ 1.", [{ value: "q = q_0 K_R ≥ 1", latex: "q=q_0K_R\\ge1" }]),
    p("7.9.2.1", "p11", 270, 55, 56),
    p("7.9.2.1", "p12", 270, 57, 59),
], [f791, f792]);

add("7.9.3", "MODELLO STRUTTURALE", title("7.9.3", 270, 60, "7.9.3 MODELLO STRUTTURALE"), [
    p("7.9.3", "p1", 270, 61, 66, "Il modello strutturale deve poter descrivere tutti i gradi di libertà significativi caratterizzanti la risposta dinamica e riprodurre fedelmente le caratteristiche di inerzia e di rigidezza della struttura, e di vincolo degli impalcati. Quando l’impalcato abbia angolo di obliquità φ > 20° (vedi Fig. 7.9.1) o sia particolarmente largo rispetto alla lunghezza (rapporto tra larghezza B e lunghezza L, B/L > 2,0) particolare attenzione deve essere dedicata ai moti rigidi del ponte intorno all’asse verticale, in particolare per le travi continue avendo cura che il meccanismo resistente non sia affidato alla torsione di una pila unica e per le travi appoggiate prevedendo una opportuna disposizione degli apparecchi di appoggio.", [{ value: "φ > 20°", latex: "\\varphi>20^\\circ" }, { value: "B/L > 2,0", latex: "B/L>2{,}0" }]),
    figureBlock("7.9.3", fig791, 270, "7.9.1", { coordinateSystem: "pdf-points-top-left", x: 245, y: 630, width: 190, height: 110 }),
]);
units.at(-1)!.assets.figureIds = [figid(fig791)];

add("7.9.3.1", "INTERAZIONE TERRENO-STRUTTURA E ANALISI DI RISPOSTA SISMICA LOCALE", title("7.9.3.1", 271, 7, "7.9.3.1 INTERAZIONE TERRENO-STRUTTURA E ANALISI DI RISPOSTA SISMICA LOCALE"), [
    p("7.9.3.1", "p1", 271, 8, 11),
    p("7.9.3.1", "p2", 271, 12, 15),
    p("7.9.3.1", "p3", 271, 16, 17),
    p("7.9.3.1", "p4", 271, 18, 19),
]);
add("7.9.4", "ANALISI STRUTTURALE", title("7.9.4", 271, 20, "7.9.4 ANALISI STRUTTURALE"), [
    p("7.9.4", "p1", 271, 21, 23),
    formulaBlock("7.9.4", f793, 271, "7.9.3"),
    p("7.9.4", "p2", 271, 25, 27, "dove d_Ed è lo spostamento valutato nella situazione sismica di progetto in accordo con quanto specificato nel § 7.3.3.3 ed N_Ed è la forza assiale di progetto.", [{ value: "d_Ed", latex: "d_{Ed}" }, { value: "N_Ed", latex: "N_{Ed}" }]),
], [f793]);
add("7.9.4.1", "ANALISI STATICA LINEARE", title("7.9.4.1", 271, 28, "7.9.4.1 ANALISI STATICA LINEARE"), [
    p("7.9.4.1", "p1", 271, 29, 29),
    li("7.9.4.1", "a", 271, 30, 31),
    li("7.9.4.1", "b", 271, 32, 33),
    li("7.9.4.1", "c", 271, 34, 36),
    p("7.9.4.1", "p2", 271, 37, 38),
    p("7.9.4.1", "p3", 271, 39, 40),
    li("7.9.4.1", "d", 271, 41, 42),
    li("7.9.4.1", "e", 271, 43, 43),
    p("7.9.4.1", "p4", 271, 44, 47),
    formulaBlock("7.9.4.1", f794, 271, "7.9.4"),
    p("7.9.4.1", "p5", 271, 49, 49, "nella quale K è la rigidezza laterale del modello considerato, ossia della singola pila nel caso a), complessiva delle pile nel caso b).", [{ value: "K", latex: "K" }]),
    p("7.9.4.1", "p6", 271, 50, 50),
    formulaBlock("7.9.4.1", f795, 271, "7.9.5"),
    p("7.9.4.1", "p7", 271, 62, 66, "nella quale: T_1 è il periodo proprio fondamentale del ponte nella direzione trasversale; g è l’accelerazione di gravità; d_i è lo spostamento del grado di libertà i quando la struttura è soggetta ad un sistema di forze statiche trasversali f_i = G_i; G_i è il peso della massa concentrata nel grado di libertà i.", [{ value: "T_1", latex: "T_1" }, { value: "g", latex: "g" }, { value: "d_i", latex: "d_i" }, { value: "f_i = G_i", latex: "f_i=G_i" }, { value: "G_i", latex: "G_i" }]),
    p("7.9.4.1", "p8", 272, 3, 3),
    formulaBlock("7.9.4.1", f796, 272, "7.9.6"),
], [f794, f795, f796]);

add("7.9.5", "DIMENSIONAMENTO E VERIFICA DEGLI ELEMENTI STRUTTURALI", title("7.9.5", 272, 14, "7.9.5 DIMENSIONAMENTO E VERIFICA DEGLI ELEMENTI STRUTTURALI"), [
    p("7.9.5", "p1", 272, 15, 18),
    formulaBlock("7.9.5", f797, 272, "7.9.7"),
    p("7.9.5", "p2", 272, 20, 22, "nella quale q è il valore del fattore di comportamento utilizzato nel calcolo. Nel caso di sezioni in calcestruzzo armato, qualora il rapporto ν_k tra la forza assiale e la resistenza a compressione della sezione di calcestruzzo eccede 0,1, il fattore di sovraresistenza va moltiplicato per 1 + 2(ν_k − 0,1)².", [{ value: "q", latex: "q" }, { value: "ν_k", latex: "\\nu_k" }]),
    p("7.9.5", "p3", 272, 23, 24),
    p("7.9.5", "p4", 272, 25, 28),
    p("7.9.5", "p5", 272, 29, 31),
], [f797]);
add("7.9.5.1", "PILE", title("7.9.5.1", 272, 32, "7.9.5.1 PILE"), [
    p("7.9.5.1", "p1", 272, 33, 34),
]);
add("7.9.5.1.1", "Verifiche di resistenza (RES)", title("7.9.5.1.1", 272, 35, "7.9.5.1.1 Verifiche di resistenza (RES)"), [
    p("7.9.5.1.1", "p1", 272, 36, 36),
    hblock("7.9.5.1.1", "subheading-pressoflessione", 272, 37, "Presso-flessione"),
    p("7.9.5.1.1", "p2", 272, 38, 41),
    p("7.9.5.1.1", "p3", 272, 42, 42),
    formulaBlock("7.9.5.1.1", f798, 272, "7.9.8"),
    p("7.9.5.1.1", "p4", 272, 44, 44, "nella quale:"),
    p("7.9.5.1.1", "p5", 272, 45, 47, "M_Ed è la domanda flessionale (accompagnata dalla domanda flessionale in direzione ortogonale assunta come ad essa contemporanea) derivante dall’analisi.", [{ value: "M_Ed", latex: "M_{Ed}" }]),
    p("7.9.5.1.1", "p6", 272, 48, 50, "M_Rd è la capacità flessionale, calcolata sul relativo dominio di resistenza allo SLU in corrispondenza della sollecitazione assiale agente.", [{ value: "M_Rd", latex: "M_{Rd}" }]),
    p("7.9.5.1.1", "p7", 272, 51, 51),
    formulaBlock("7.9.5.1.1", f799, 272, "7.9.9"),
    p("7.9.5.1.1", "p8", 272, 53, 56, "nella quale M_prc è la domanda flessionale (accompagnata dalla domanda flessionale in direzione ortogonale assunta come ad essa contemporanea) calcolata come descritto al § 7.9.5 e M_yd è la capacità flessionale corrispondente alla curvatura convenzionale di prima plasticizzazione di cui al § 7.4.4.1.2, in corrispondenza della sollecitazione assiale agente.", [{ value: "M_prc", latex: "M_{prc}" }, { value: "M_yd", latex: "M_{yd}" }]),
    p("7.9.5.1.1", "p9", 272, 57, 59, "Qualora, al di fuori delle zone dissipative delle pile, la domanda flessionale M_prc superi il valore M_Rd delle zone dissipative stesse, si adotta quest’ultimo al posto di M_prc.", [{ value: "M_prc", latex: "M_{prc}" }, { value: "M_Rd", latex: "M_{Rd}" }]),
    hblock("7.9.5.1.1", "subheading-taglio", 273, 3, "Taglio"),
    p("7.9.5.1.1", "p10", 273, 4, 7, "Ai fini della progettazione in capacità, per ciascuna direzione di applicazione del sisma, la domanda a taglio V_Ed si ottiene imponendo l’equilibrio tra le capacità a flessione delle sezioni di estremità della pila M_s,prc e M_i,prc e il taglio V_prc applicato nelle stesse sezioni, secondo le espressioni:", [{ value: "V_Ed", latex: "V_{Ed}" }, { value: "M_s,prc", latex: "M_{s,prc}" }, { value: "M_i,prc", latex: "M_{i,prc}" }, { value: "V_prc", latex: "V_{prc}" }]),
    formulaBlock("7.9.5.1.1", f7910a, 273, "7.9.10a"),
    formulaBlock("7.9.5.1.1", f7910b, 273, "7.9.10b"),
    p("7.9.5.1.1", "p11", 273, 12, 15, "dove l_p è la distanza tra le due sezioni di estremità della pila (nel caso di pila incastrata solamente alla base è la distanza tra la sezione di incastro e la sezione di momento nullo) e γ_Bd è calcolato sulla base del rapporto tra il taglio derivante dall’analisi V_E e il taglio V_prc mediante la formula seguente:", [{ value: "l_p", latex: "l_p" }, { value: "γ_Bd", latex: "\\gamma_{Bd}" }, { value: "V_E", latex: "V_E" }, { value: "V_prc", latex: "V_{prc}" }]),
    formulaBlock("7.9.5.1.1", f7911, 273, "7.9.11"),
    p("7.9.5.1.1", "p12", 273, 17, 18),
    p("7.9.5.1.1", "p13", 273, 19, 20),
    p("7.9.5.1.1", "p14", 273, 21, 22),
    p("7.9.5.1.1", "p15", 273, 23, 23, "Per elementi tozzi, con α < 2,0 (vedi § 7.9.2.1), deve essere eseguita anche la verifica a scorrimento.", [{ value: "α < 2,0", latex: "\\alpha<2{,}0" }]),
], [f798, f799, f7910a, f7910b, f7911]);
add("7.9.5.1.2", "Verifiche di duttilità (DUT)", title("7.9.5.1.2", 273, 24, "7.9.5.1.2 Verifiche di duttilità (DUT)"), [
    p("7.9.5.1.2", "p1", 273, 25, 26),
    p("7.9.5.1.2", "p2", 273, 27, 28),
]);
add("7.9.5.2", "IMPALCATO", title("7.9.5.2", 273, 29, "7.9.5.2 IMPALCATO"), [
    p("7.9.5.2", "p1", 273, 30, 33),
]);
add("7.9.5.2.1", "Verifiche di resistenza (RES)", title("7.9.5.2.1", 273, 34, "7.9.5.2.1 Verifiche di resistenza (RES)"), [
    p("7.9.5.2.1", "p1", 273, 35, 35),
    p("7.9.5.2.1", "p2", 273, 36, 37),
    p("7.9.5.2.1", "p3", 273, 38, 40),
    p("7.9.5.2.1", "p4", 273, 41, 41),
    formulaBlock("7.9.5.2.1", f7912, 273, "7.9.12"),
    p("7.9.5.2.1", "p5", 273, 51, 53, "nella quale V_E,i è il valore dello sforzo di taglio ottenuto dall’analisi, M_E,i il corrispondente momento flettente alla base della pila, ed M_Rd,i l’effettivo momento resistente alla base della pila.", [{ value: "V_E,i", latex: "V_{E,i}" }, { value: "M_E,i", latex: "M_{E,i}" }, { value: "M_Rd,i", latex: "M_{Rd,i}" }]),
    p("7.9.5.2.1", "p6", 273, 54, 55, "Se la pila trasmette anche momenti all’impalcato, i valori da assumere per la verifica di quest’ultimo sono dati dai valori dei momenti resistenti delle membrature che li trasmettono, moltiplicati per il fattore di sovraresistenza γ_Rd.", [{ value: "γ_Rd", latex: "\\gamma_{Rd}" }]),
    p("7.9.5.2.1", "p7", 273, 56, 57),
    p("7.9.5.2.1", "p8", 273, 58, 59),
], [f7912]);

add("7.9.5.3", "APPARECCHI DI APPOGGIO E ZONE DI SOVRAPPOSIZIONE", title("7.9.5.3", 273, 60, "7.9.5.3 APPARECCHI DI APPOGGIO E ZONE DI SOVRAPPOSIZIONE"), []);
add("7.9.5.3.1", "Apparecchi d’appoggio o di vincolo fissi", title("7.9.5.3.1", 273, 61, "7.9.5.3.1 Apparecchi d’appoggio o di vincolo fissi"), [
    mp("7.9.5.3.1", "p1", [part(273, 62, 63), part(274, 3, 5)], "Gli apparecchi d’appoggio o di vincolo fissi devono essere dimensionati con i criteri della progettazione in capacità. Essi devono quindi essere in grado di trasmettere, mantenendo la piena funzionalità, forze orizzontali tali da produrre, nella zona o nelle zone dissipative alla base della pila, un momento flettente pari a γ_Rd M_Rd, dove M_Rd è il momento resistente della zona o delle zone dissipative. Questa verifica può essere eseguita in modo indipendente per le due direzioni dell’azione sismica.", [{ value: "γ_Rd M_Rd", latex: "\\gamma_{Rd}M_{Rd}" }]),
    p("7.9.5.3.1", "p2", 274, 6, 7),
]);
add("7.9.5.3.2", "Apparecchi d’appoggio mobili", title("7.9.5.3.2", 274, 8, "7.9.5.3.2 Apparecchi d’appoggio mobili"), [
    p("7.9.5.3.2", "p1", 274, 9, 10),
]);
add("7.9.5.3.3", "Dispositivi di fine corsa", title("7.9.5.3.3", 274, 11, "7.9.5.3.3 Dispositivi di fine corsa"), [
    p("7.9.5.3.3", "p1", 274, 12, 14),
    p("7.9.5.3.3", "p2", 274, 15, 16),
    p("7.9.5.3.3", "p3", 274, 17, 23, "In tali casi, in mancanza di verifica analitica in campo dinamico dell’interazione impalcato-pila o spalla e delle sollecitazioni indotte nei dispositivi, questi ultimi possono venire dimensionati per resistere ad una forza pari ad α · Q, in cui α = 1,5 · S · a_g/g è l’accelerazione normalizzata di progetto valutata allo SLC, S, a_g e g sono definiti al § 3.2.3.2.1 e Q è il peso della parte di impalcato collegato ad una pila od alle spalle, oppure, nel caso di due parti di impalcato collegate tra loro, il minore dei pesi di ciascuna delle due parti.", [{ value: "α · Q", latex: "\\alpha Q" }, { value: "α = 1,5 · S · a_g/g", latex: "\\alpha=1{,}5Sa_g/g" }]),
]);
add("7.9.5.3.4", "Zone di sovrapposizione", title("7.9.5.3.4", 274, 24, "7.9.5.3.4 Zone di sovrapposizione"), [
    p("7.9.5.3.4", "p1", 274, 25, 28),
]);
add("7.9.5.4", "SPALLE", title("7.9.5.4", 274, 29, "7.9.5.4 SPALLE"), [
    p("7.9.5.4", "p1", 274, 30, 35),
]);
add("7.9.5.4.1", "Collegamento mediante apparecchi d’appoggio mobili", title("7.9.5.4.1", 274, 36, "7.9.5.4.1 Collegamento mediante apparecchi d’appoggio mobili"), [
    p("7.9.5.4.1", "p1", 274, 37, 38),
    p("7.9.5.4.1", "p2", 274, 39, 39),
    li("7.9.5.4.1", "a", 274, 40, 41),
    li("7.9.5.4.1", "b", 274, 42, 44, "le forze d’inerzia agenti sulla massa della spalla e del terreno presenti sulla sua fondazione, cui va applicata un’accelerazione pari ad a_g S.", [{ value: "a_g S", latex: "a_gS" }]),
]);
add("7.9.5.4.2", "Collegamento mediante apparecchi d’appoggio fissi", title("7.9.5.4.2", 274, 45, "7.9.5.4.2 Collegamento mediante apparecchi d’appoggio fissi"), [
    p("7.9.5.4.2", "p1", 274, 46, 51, "Questo tipo di collegamento è adottato in maniera generalizzata per la direzione trasversale ed in genere su una delle due spalle per la direzione longitudinale. In entrambi i casi le spalle e il ponte formano un sistema accoppiato ed è quindi necessario utilizzare un modello strutturale che consenta di analizzare gli effetti di interazione tra il terreno, la spalla e la parte di ponte accoppiata. L’interazione terreno-spalla può in molti casi essere trascurata (a favore di stabilità) quando l’azione sismica agisce in direzione trasversale al ponte, ossia nel piano della spalla. In questi casi l’azione sismica può essere assunta pari all’accelerazione a_g S.", [{ value: "a_g S", latex: "a_gS" }]),
    mp("7.9.5.4.2", "p2", [part(274, 52, 57), part(275, 3, 6)], "Nel senso longitudinale il modello deve comprendere, in generale, la deformabilità del terreno retrostante e quella del terreno di fondazione. Qualora non venga effettuata l’analisi d’interazione di cui sopra, le forze d’inerzia agenti sulla massa della spalla, del terreno presente sulla sua fondazione e dell’impalcato saranno calcolate in base all’accelerazione valutata con lo spettro di progetto in corrispondenza del periodo T_B. Nel caso in cui il sistema costituito dalla spalla, dal terreno presente sulla sua fondazione e dall’impalcato sia considerabile come infinitamente rigido (periodo proprio inferiore a 0,05 s) le forze d’inerzia direttamente applicate ad esso possono essere assunte pari al prodotto delle masse per l’accelerazione del terreno a_g S. Nel caso in cui la spalla sostenga un terreno rigido naturale per più dell’80% dell’altezza, si può considerare che essa si muova con il suolo. In questo caso le forze d’inerzia di progetto possono essere determinate considerando un’accelerazione pari ad a_g S.", [{ value: "T_B", latex: "T_B" }, { value: "a_g S", latex: "a_gS" }]),
]);

add("7.9.6", "DETTAGLI COSTRUTTIVI PER ELEMENTI DI CALCESTRUZZO ARMATO", title("7.9.6", 275, 7, "7.9.6 DETTAGLI COSTRUTTIVI PER ELEMENTI DI CALCESTRUZZO ARMATO"), []);
add("7.9.6.1", "PILE", title("7.9.6.1", 275, 8, "7.9.6.1 PILE"), [
    p("7.9.6.1", "p1", 275, 9, 12),
    p("7.9.6.1", "p2", 275, 13, 20),
]);
add("7.9.6.1.1", "Armature per il confinamento del nucleo di calcestruzzo", title("7.9.6.1.1", 275, 21, "7.9.6.1.1 Armature per il confinamento del nucleo di calcestruzzo"), [
    p("7.9.6.1.1", "p1", 275, 22, 27, "Le armature per il confinamento del nucleo di calcestruzzo non sono necessarie nei casi seguenti: se la sollecitazione di compressione normalizzata risulta ν_k ≤ 0,08; nel caso di sezioni delle pile in parete sottile a doppio T o cave, mono o multicellulari, purché risulti ν_k ≤ 0,2; nel caso di sezioni delle pile progettate in CD”A” o in CD”B” ove è possibile raggiungere una duttilità in curvatura non inferiore, rispettivamente, a μ_φ = 13 o a μ_φ = 7, senza che la deformazione di compressione massima nel calcestruzzo superi il valore 0,0035.", [{ value: "ν_k ≤ 0,08", latex: "\\nu_k\\le0{,}08" }, { value: "ν_k ≤ 0,2", latex: "\\nu_k\\le0{,}2" }, { value: "μ_φ = 13", latex: "\\mu_\\varphi=13" }, { value: "μ_φ = 7", latex: "\\mu_\\varphi=7" }]),
    p("7.9.6.1.1", "p2", 275, 28, 29, "La percentuale meccanica minima di armatura trasversale per il confinamento costituita da tiranti o staffe di forma rettangolare ω_{wd,r} è data da:", [{ value: "ω_{wd,r}", latex: "\\omega_{wd,r}" }]),
    formulaBlock("7.9.6.1.1", f7915, 275, "7.9.15"),
    p("7.9.6.1.1", "p3", 275, 31, 31, "con:"),
    formulaBlock("7.9.6.1.1", f7916, 275, "7.9.16"),
    p("7.9.6.1.1", "p4", 275, 44, 44),
    li("7.9.6.1.1", "def-ac", 275, 45, 46, "A_c è l’area totale di calcestruzzo della sezione.", [{ value: "A_c", latex: "A_c" }]),
    li("7.9.6.1.1", "def-acc", 275, 47, 48, "A_cc è l’area del nucleo confinato della sezione.", [{ value: "A_cc", latex: "A_{cc}" }]),
    li("7.9.6.1.1", "def-nuk", 275, 49, 49, "ν_k è stato precedentemente definito.", [{ value: "ν_k", latex: "\\nu_k" }]),
    li("7.9.6.1.1", "def-alpha", 275, 50, 50, "α vale 0,37 per le pile progettate in CD”A” e 0,28 per le pile progettate in CD”B”.", [{ value: "α", latex: "\\alpha" }]),
    li("7.9.6.1.1", "def-wmin", 275, 51, 51, "ω_{w,min} vale 0,18 per le pile progettate in CD”A” e 0,12 per le pile progettate in CD”B”.", [{ value: "ω_{w,min}", latex: "\\omega_{w,min}" }]),
    li("7.9.6.1.1", "def-rhol", 275, 52, 52, "ρ_L è la percentuale geometrica di armatura longitudinale.", [{ value: "ρ_L", latex: "\\rho_L" }]),
    p("7.9.6.1.1", "p5", 275, 53, 53),
    formulaBlock("7.9.6.1.1", f7917, 275, "7.9.17"),
    p("7.9.6.1.1", "p6", 275, 55, 55),
    hblock("7.9.6.1.1", "subheading-rectangular", 275, 56, "sezioni rettangolari"),
    formulaBlock("7.9.6.1.1", f7918, 275, "7.9.18"),
    p("7.9.6.1.1", "p7", 275, 65, 65, "in cui:"),
    li("7.9.6.1.1", "def-asw", 275, 66, 67, "A_sw è l’area complessiva dei bracci delle staffe chiuse e dei tiranti in una direzione.", [{ value: "A_sw", latex: "A_{sw}" }]),
    li("7.9.6.1.1", "def-s", 275, 68, 68, "s è l’interasse verticale delle armature di confinamento = S_L.", [{ value: "s", latex: "s" }, { value: "S_L", latex: "S_L" }]),
    hblock("7.9.6.1.1", "subheading-circular", 276, 5, "sezioni circolari"),
    formulaBlock("7.9.6.1.1", f7919, 276, "7.9.19"),
    p("7.9.6.1.1", "p9", 276, 16, 16, "in cui"),
    li("7.9.6.1.1", "def-asp", 276, 17, 18, "A_sp, D_sp = area della sezione delle barre circonferenziali e diametro della circonferenza;", [{ value: "A_sp", latex: "A_{sp}" }, { value: "D_sp", latex: "D_{sp}" }]),
    li("7.9.6.1.1", "def-s2", 276, 19, 19, "s è l’interasse verticale delle armature di confinamento = S_L.", [{ value: "s", latex: "s" }, { value: "S_L", latex: "S_L" }]),
    p("7.9.6.1.1", "p10", 276, 20, 23, "Il passo dell’armatura trasversale di confinamento lungo l’asse verticale della pila S_L deve rispettare le seguenti condizioni:", [{ value: "S_L", latex: "S_L" }]),
    formulaBlock("7.9.6.1.1", f7920, 276, "7.9.20"),
    p("7.9.6.1.1", "p11", 276, 23, 23),
    p("7.9.6.1.1", "p12", 276, 24, 24, "In direzione trasversale la distanza S_T nel piano orizzontale tra due bracci di staffa rettangolare o tra due tiranti deve risultare:", [{ value: "S_T", latex: "S_T" }]),
    formulaBlock("7.9.6.1.1", f7921, 276, "7.9.21"),
    p("7.9.6.1.1", "p13", 276, 35, 36),
], [f7915, f7916, f7917, f7918, f7919, f7920, f7921]);
add("7.9.6.1.2", "Armature per contrastare l’instabilità delle barre verticali compresse", title("7.9.6.1.2", 276, 37, "7.9.6.1.2 Armature per contrastare l’instabilità delle barre verticali compresse"), [
    p("7.9.6.1.2", "p1", 276, 38, 38),
    p("7.9.6.1.2", "p2", 276, 39, 42, "Il passo dell’armatura trasversale per contrastare l’instabilità delle barre verticali compresse lungo l’asse verticale della pila S_L deve rispettare la seguente condizione:", [{ value: "S_L", latex: "S_L" }]),
    formulaBlock("7.9.6.1.2", f7922, 276, "7.9.22"),
    p("7.9.6.1.2", "p3", 276, 42, 42),
    p("7.9.6.1.2", "p4", 276, 43, 47),
    p("7.9.6.1.2", "p5", 276, 48, 51, "In direzione trasversale la distanza S_T nel piano orizzontale tra due bracci di staffa o tiranti deve risultare inferiore o uguale a 200 mm. Il quantitativo minimo di tiranti o bracci trasversali necessari a limitare i fenomeni d’instabilità delle barre longitudinali lungo i bordi rettilinei è fornito dalla relazione seguente:", [{ value: "S_T", latex: "S_T" }]),
    formulaBlock("7.9.6.1.2", f7923, 276, "7.9.23"),
    p("7.9.6.1.2", "p6", 276, 63, 63, "In cui:"),
    p("7.9.6.1.2", "p7", 276, 64, 64, "A_T ed S_T sono rispettivamente l’area di un braccio di staffa o tirante (in mm²) e la distanza misurata in direzione trasversale fra i bracci dei tiranti (m).", [{ value: "A_T", latex: "A_T" }, { value: "S_T", latex: "S_T" }]),
    p("7.9.6.1.2", "p8", 276, 65, 67, "ΣA_s è la somma delle aree delle barre verticali (in mm²) di competenza di un braccio di staffa o tirante.", [{ value: "ΣA_s", latex: "\\sum A_s" }]),
    p("7.9.6.1.2", "p9", 276, 68, 71, "f_{yk,s} e f_{yk,t} sono rispettivamente le tensioni di snervamento dell’acciaio dell’armatura verticale e delle staffe o tiranti.", [{ value: "f_{yk,s}", latex: "f_{yk,s}" }, { value: "f_{yk,t}", latex: "f_{yk,t}" }]),
], [f7922, f7923]);
add("7.9.6.1.3", "Dettagli costruttivi per le zone dissipative", title("7.9.6.1.3", 276, 72, "7.9.6.1.3 Dettagli costruttivi per le zone dissipative"), [
    p("7.9.6.1.3", "p1", 276, 73, 74, "La lunghezza, misurata lungo l’asse verticale, della zona dissipativa di una pila progettata in CD”A” ove risulti ν_k ≤ 0,3 è pari alla maggiore delle due:", [{ value: "ν_k ≤ 0,3", latex: "\\nu_k\\le0{,}3" }]),
    li("7.9.6.1.3", "a", 276, 75, 75),
    li("7.9.6.1.3", "b", 276, 76, 78, "la distanza tra la sezione di momento massimo e la sezione in cui il momento si riduce del 20%. Il diagramma dei momenti flettenti su cui computare il decremento del 20% è quello in cui il valore massimo del momento vale M_prc.", [{ value: "M_prc", latex: "M_{prc}" }]),
    p("7.9.6.1.3", "p2", 276, 79, 81, "Per 0,3 ≤ ν_k ≤ 0,6 tale valore deve essere incrementato del 50%. Per un’ulteriore estensione di lunghezza pari alla precedente si dispone solo l’armatura di confinamento gradualmente decrescente, in misura non inferiore in totale a metà di quella necessaria nel primo tratto.", [{ value: "0,3 ≤ ν_k ≤ 0,6", latex: "0{,}3\\le\\nu_k\\le0{,}6" }]),
    p("7.9.6.1.3", "p3", 277, 3, 4, "La lunghezza, misurata lungo l’asse verticale, della zona dissipativa di una pila progettata in CD”B” è pari alla distanza tra la sezione di momento massimo e la sezione ove risulti M_Rd ≤ 1,3 M_Ed. Tale distanza può essere nulla.", [{ value: "M_Rd ≤ 1,3 M_Ed", latex: "M_{Rd}\\le1{,}3M_{Ed}" }]),
    p("7.9.6.1.3", "p4", 277, 5, 6),
    p("7.9.6.1.3", "p5", 277, 7, 7),
    p("7.9.6.1.3", "p6", 277, 8, 9),
    p("7.9.6.1.3", "p7", 277, 10, 11),
    p("7.9.6.1.3", "p8", 277, 12, 14),
]);
add("7.9.6.2", "IMPALCATO, FONDAZIONI E SPALLE", title("7.9.6.2", 277, 15, "7.9.6.2 IMPALCATO, FONDAZIONI E SPALLE"), [
    p("7.9.6.2", "p1", 277, 16, 17),
]);

add("7.10", "COSTRUZIONI CON ISOLAMENTO E/O DISSIPAZIONE", title("7.10", 277, 18, "7.10 COSTRUZIONI CON ISOLAMENTO E/O DISSIPAZIONE"), []);
add("7.10.1", "SCOPO", title("7.10.1", 277, 19, "7.10.1 SCOPO"), [
    p("7.10.1", "p1", 277, 20, 22),
    p("7.10.1", "p2", 277, 23, 24),
    li("7.10.1", "a", 277, 25, 25),
    li("7.10.1", "b", 277, 26, 26),
    p("7.10.1", "p3", 277, 27, 28),
    p("7.10.1", "p4", 277, 29, 30),
]);
add("7.10.2", "REQUISITI GENERALI E CRITERI PER IL LORO SODDISFACIMENTO", title("7.10.2", 277, 31, "7.10.2 REQUISITI GENERALI E CRITERI PER IL LORO SODDISFACIMENTO"), [
    p("7.10.2", "p1", 277, 32, 33),
    li("7.10.2", "a", 277, 34, 35),
    li("7.10.2", "b", 277, 36, 36),
    li("7.10.2", "c", 277, 37, 37),
    li("7.10.2", "d", 277, 38, 38),
    p("7.10.2", "p2", 277, 39, 40),
    p("7.10.2", "p3", 277, 41, 41),
    li("7.10.2", "e", 277, 42, 44),
    li("7.10.2", "f", 277, 45, 45),
    p("7.10.2", "p4", 277, 46, 49),
    p("7.10.2", "p5", 277, 50, 51),
]);
add("7.10.3", "CARATTERISTICHE E CRITERI DI ACCETTAZIONE DEI DISPOSITIVI", title("7.10.3", 277, 52, "7.10.3 CARATTERISTICHE E CRITERI DI ACCETTAZIONE DEI DISPOSITIVI"), [
    p("7.10.3", "p1", 277, 53, 54),
]);

add("7.10.4", "INDICAZIONI PROGETTUALI", title("7.10.4", 278, 3, "7.10.4 INDICAZIONI PROGETTUALI"), []);
add("7.10.4.1", "INDICAZIONI RIGUARDANTI I DISPOSITIVI", title("7.10.4.1", 278, 4, "7.10.4.1 INDICAZIONI RIGUARDANTI I DISPOSITIVI"), [
    p("7.10.4.1", "p1", 278, 5, 9),
    p("7.10.4.1", "p2", 278, 10, 12),
]);
add("7.10.4.2", "CONTROLLO DI MOVIMENTI INDESIDERATI", title("7.10.4.2", 278, 13, "7.10.4.2 CONTROLLO DI MOVIMENTI INDESIDERATI"), [
    p("7.10.4.2", "p1", 278, 14, 19),
    p("7.10.4.2", "p2", 278, 20, 22),
    p("7.10.4.2", "p3", 278, 23, 28, "Per evitare o limitare azioni di trazione nei dispositivi, gli interassi della maglia strutturale devono essere scelti in modo tale che il carico verticale V di progetto agente sul singolo isolatore sotto le azioni sismiche e quelle concomitanti risulti essere di compressione o, al più, nullo (V ≥ 0). Nel caso in cui dall’analisi risultasse V < 0, occorre che la tensione di trazione sia in modulo inferiore al minore tra 2G (G modulo di taglio del materiale elastomerico) e 1 MPa, negli isolatori elastomerici, oppure, per i dispositivi di altro tipo, dimostrare, attraverso adeguate prove sperimentali, che il dispositivo è in grado di sostenere tale condizione, oppure predisporre opportuni vincoli in grado di assorbire integralmente la trazione.", [{ value: "V ≥ 0", latex: "V\\ge0" }, { value: "V < 0", latex: "V<0" }, { value: "2G", latex: "2G" }]),
]);
add("7.10.4.3", "CONTROLLO DEGLI SPOSTAMENTI SISMICI DIFFERENZIALI DEL TERRENO", title("7.10.4.3", 278, 29, "7.10.4.3 CONTROLLO DEGLI SPOSTAMENTI SISMICI DIFFERENZIALI DEL TERRENO"), [
    p("7.10.4.3", "p1", 278, 30, 33),
    p("7.10.4.3", "p2", 278, 34, 39),
]);
add("7.10.4.4", "CONTROLLO DEGLI SPOSTAMENTI RELATIVI AL TERRENO E ALLE COSTRUZIONI CIRCOSTANTI", title("7.10.4.4", 278, 40, "7.10.4.4 CONTROLLO DEGLI SPOSTAMENTI RELATIVI AL TERRENO E ALLE COSTRUZIONI CIRCOSTANTI"), [
    p("7.10.4.4", "p1", 278, 41, 44),
    p("7.10.4.4", "p2", 278, 45, 46),
]);
add("7.10.5", "MODELLAZIONE E ANALISI STRUTTURALE", title("7.10.5", 278, 47, "7.10.5 MODELLAZIONE E ANALISI STRUTTURALE"), []);
add("7.10.5.1", "PROPRIETÀ DEL SISTEMA DI ISOLAMENTO", title("7.10.5.1", 278, 48, "7.10.5.1 PROPRIETÀ DEL SISTEMA DI ISOLAMENTO"), [
    p("7.10.5.1", "p1", 278, 49, 51),
    li("7.10.5.1", "a", 278, 52, 52),
    li("7.10.5.1", "b", 278, 53, 53),
    li("7.10.5.1", "c", 278, 54, 54),
    li("7.10.5.1", "d", 278, 55, 55),
    li("7.10.5.1", "e", 279, 3, 3),
    li("7.10.5.1", "f", 279, 4, 4),
    p("7.10.5.1", "p2", 279, 5, 6),
    p("7.10.5.1", "p3", 279, 7, 9),
    p("7.10.5.1", "p4", 279, 10, 11),
]);
add("7.10.5.2", "MODELLAZIONE", title("7.10.5.2", 279, 12, "7.10.5.2 MODELLAZIONE"), [
    p("7.10.5.2", "p1", 279, 13, 17, "La sovrastruttura e la sottostruttura devono essere modellate come sistemi a comportamento elastico lineare aventi rigidezza corrispondente al comportamento strutturale non dissipativo. Il sistema di isolamento può essere modellato, in relazione alle sue caratteristiche meccaniche, come avente comportamento visco-elastico lineare oppure con legame costitutivo non lineare. La deformabilità verticale degli isolatori dovrà essere messa in conto quando il rapporto tra la rigidezza verticale del sistema di isolamento K_V e la rigidezza equivalente orizzontale K_esi è inferiore a 800.", [{ value: "K_V", latex: "K_V" }, { value: "K_esi", latex: "K_{esi}" }]),
    p("7.10.5.2", "p2", 279, 18, 26),
    p("7.10.5.2", "p3", 279, 27, 29),
    p("7.10.5.2", "p4", 279, 30, 31),
    li("7.10.5.2", "a", 279, 32, 33),
    li("7.10.5.2", "b", 279, 34, 34),
    li("7.10.5.2", "c", 279, 35, 37),
    li("7.10.5.2", "d", 279, 38, 41),
    p("7.10.5.2", "p5", 279, 42, 44),
    p("7.10.5.2", "p6", 279, 45, 46),
]);
add("7.10.5.3", "ANALISI", title("7.10.5.3", 279, 47, "7.10.5.3 ANALISI"), [
    p("7.10.5.3", "p1", 279, 48, 49),
]);
add("7.10.5.3.1", "Analisi lineare statica", title("7.10.5.3.1", 279, 50, "7.10.5.3.1 Analisi lineare statica"), [
    p("7.10.5.3.1", "p1", 279, 51, 52),
    li("7.10.5.3.1", "a", 279, 53, 53),
    li("7.10.5.3.1", "b", 279, 54, 56),
    li("7.10.5.3.1", "c", 279, 57, 60),
    li("7.10.5.3.1", "d", 279, 61, 62, "il periodo in direzione verticale T_V, calcolato come T_V = 2π√(M/K_V), è inferiore a 0,1 s;", [{ value: "T_V", latex: "T_V" }, { value: "K_V", latex: "K_V" }]),
    li("7.10.5.3.1", "e", 279, 62, 62),
    li("7.10.5.3.1", "f", 280, 3, 3),
    p("7.10.5.3.1", "p2", 280, 4, 4),
    li("7.10.5.3.1", "g", 280, 5, 6),
    li("7.10.5.3.1", "h", 280, 7, 7),
    li("7.10.5.3.1", "i", 280, 8, 10),
    p("7.10.5.3.1", "p3", 280, 11, 11),
    li("7.10.5.3.1", "j", 280, 12, 14),
    li("7.10.5.3.1", "k", 280, 15, 16),
    li("7.10.5.3.1", "l", 280, 17, 18),
    p("7.10.5.3.1", "p4", 280, 19, 21),
    p("7.10.5.3.1", "p5", 280, 22, 24),
    formulaBlock("7.10.5.3.1", f7101, 280, "7.10.1"),
    p("7.10.5.3.1", "p6", 280, 26, 30),
    p("7.10.5.3.1", "p7", 280, 31, 33),
    formulaBlock("7.10.5.3.1", f7102, 280, "7.10.2"),
    p("7.10.5.3.1", "p8", 280, 39, 40),
    formulaBlock("7.10.5.3.1", f7103, 280, "7.10.3"),
    p("7.10.5.3.1", "p9", 280, 42, 45),
    formulaBlock("7.10.5.3.1", f7104, 280, "7.10.4"),
    p("7.10.5.3.1", "p10", 280, 59, 66),
    formulaBlock("7.10.5.3.1", f7105, 280, "7.10.5"),
    p("7.10.5.3.1", "p11", 280, 82, 86),
], [f7101, f7102, f7103, f7104, f7105]);
add("7.10.5.3.2", "Analisi lineare dinamica", title("7.10.5.3.2", 280, 87, "7.10.5.3.2 Analisi lineare dinamica"), [
    mp("7.10.5.3.2", "p1", [part(280, 88, 89), part(281, 3, 8)], "Per le costruzioni con isolamento alla base l’analisi dinamica lineare è ammessa quando risulta possibile modellare elasticamente il comportamento del sistema di isolamento, nel rispetto delle condizioni di cui al § 7.10.5.2. Per il sistema complessivo, formato dalla sottostruttura, dal sistema d’isolamento e dalla sovrastruttura, si assume un comportamento elastico lineare. Qualora il sistema di isolamento non sia immediatamente al di sopra delle fondazioni, il modello deve comprendere sia la sovrastruttura sia la sottostruttura, a meno che la sottostruttura non sia assimilabile ad una struttura scatolare rigida come definita al § 7.2.1. L’analisi può essere svolta mediante analisi modale con spettro di risposta o mediante integrazione al passo delle equazioni del moto, eventualmente previo disaccoppiamento modale, considerando un numero di modi tale da portare in conto anche un’aliquota significativa della massa della sottostruttura, se inclusa nel modello."),
    p("7.10.5.3.2", "p2", 281, 9, 18),
    p("7.10.5.3.2", "p3", 281, 19, 22),
]);
add("7.10.6", "VERIFICHE", title("7.10.6", 281, 23, "7.10.6 VERIFICHE"), []);
add("7.10.6.1", "VERIFICHE DEGLI STATI LIMITE DI ESERCIZIO", title("7.10.6.1", 281, 24, "7.10.6.1 VERIFICHE DEGLI STATI LIMITE DI ESERCIZIO"), [
    p("7.10.6.1", "p1", 281, 25, 26),
    p("7.10.6.1", "p2", 281, 27, 28),
    p("7.10.6.1", "p3", 281, 29, 32),
    p("7.10.6.1", "p4", 281, 33, 35),
]);
add("7.10.6.2", "VERIFICHE DEGLI STATI LIMITE ULTIMI", title("7.10.6.2", 281, 36, "7.10.6.2 VERIFICHE DEGLI STATI LIMITE ULTIMI"), [
    p("7.10.6.2", "p1", 281, 37, 38),
]);
add("7.10.6.2.1", "Verifiche dello SLV", title("7.10.6.2.1", 281, 39, "7.10.6.2.1 Verifiche dello SLV"), [
    p("7.10.6.2.1", "p1", 281, 40, 50, "La capacità della sottostruttura e della sovrastruttura deve essere valutata adottando i valori di γ_M utilizzati per le costruzioni non isolate. Gli elementi della sottostruttura devono essere verificati rispetto alle sollecitazioni ottenute direttamente dall’analisi quando il modello include anche la sottostruttura. In caso contrario, essi devono essere verificati rispetto alle sollecitazioni prodotte dalle forze trasmesse dal sistema d’isolamento combinate con le sollecitazioni prodotte dalle accelerazioni di risposta direttamente applicate alla sottostruttura. Nel caso in cui la sottostruttura possa essere assunta infinitamente rigida (periodo proprio inferiore a 0,05 s) le forze d’inerzia direttamente applicate ad essa possono essere assunte pari al prodotto delle masse della sottostruttura per l’accelerazione del terreno a_g S. La combinazione delle sollecitazioni deve essere eseguita adottando le regole riportate in § 7.3.5, tenendo in conto gli effetti pseudo-statici indotti dagli spostamenti relativi prodotti dalla variabilità spaziale del moto unicamente nei casi previsti ai §§ 3.2.4.1 e 3.2.4.2.", [{ value: "γ_M", latex: "\\gamma_M" }, { value: "a_g S", latex: "a_gS" }]),
    p("7.10.6.2.1", "p2", 281, 51, 53),
    p("7.10.6.2.1", "p3", 281, 54, 59),
    p("7.10.6.2.1", "p4", 282, 3, 4),
]);
add("7.10.6.2.2", "Verifiche dello SLC", title("7.10.6.2.2", 282, 5, "7.10.6.2.2 Verifiche dello SLC"), [
    p("7.10.6.2.2", "p1", 282, 6, 9),
    p("7.10.6.2.2", "p2", 282, 10, 12),
    p("7.10.6.2.2", "p3", 282, 13, 14),
    p("7.10.6.2.2", "p4", 282, 15, 17),
]);
add("7.10.7", "ASPETTI COSTRUTTIVI, MANUTENZIONE, SOSTITUIBILITÀ", title("7.10.7", 282, 18, "7.10.7 ASPETTI COSTRUTTIVI, MANUTENZIONE, SOSTITUIBILITÀ"), [
    p("7.10.7", "p1", 282, 19, 23),
    p("7.10.7", "p2", 282, 24, 26),
    p("7.10.7", "p3", 282, 27, 30),
    p("7.10.7", "p4", 282, 31, 34),
    p("7.10.7", "p5", 282, 35, 37),
    p("7.10.7", "p6", 282, 38, 39),
]);
add("7.10.8", "ACCORGIMENTI SPECIFICI IN FASE DI COLLAUDO", title("7.10.8", 282, 40, "7.10.8 ACCORGIMENTI SPECIFICI IN FASE DI COLLAUDO"), [
    p("7.10.8", "p1", 282, 41, 44),
    p("7.10.8", "p2", 282, 45, 46),
]);
add("7.11", "OPERE E SISTEMI GEOTECNICI", title("7.11", 282, 47, "7.11 OPERE E SISTEMI GEOTECNICI"), [
    p("7.11", "p1", 282, 48, 50),
    p("7.11", "p2", 282, 51, 52),
]);
add("7.11.1", "REQUISITI NEI CONFRONTI DEGLI STATI LIMITE", title("7.11.1", 283, 3, "7.11.1 REQUISITI NEI CONFRONTI DEGLI STATI LIMITE"), [
    p("7.11.1", "p1", 283, 4, 10),
]);
add("7.11.2", "CARATTERIZZAZIONE GEOTECNICA AI FINI SISMICI", title("7.11.2", 283, 11, "7.11.2 CARATTERIZZAZIONE GEOTECNICA AI FINI SISMICI"), [
    p("7.11.2", "p1", 283, 12, 16),
    p("7.11.2", "p2", 283, 17, 18),
    p("7.11.2", "p3", 283, 19, 22),
    p("7.11.2", "p4", 283, 23, 24),
    p("7.11.2", "p5", 283, 25, 27),
    p("7.11.2", "p6", 283, 28, 29, "Nei terreni saturi si assumono generalmente condizioni di drenaggio impedito. In tal caso, nelle analisi condotte in termini di tensioni efficaci, la resistenza al taglio è esprimibile mediante la relazione"),
    formulaBlock("7.11.2", f7111, 283, "7.11.1"),
    p("7.11.2", "p7", 283, 31, 32),
    p("7.11.2", "p8", 283, 33, 34, "Nei terreni a grana fina, le analisi possono essere condotte in termini di tensioni totali esprimendo la resistenza al taglio mediante la resistenza non drenata, valutata in condizioni di sollecitazione ciclica"),
    formulaBlock("7.11.2", f7112, 283, "7.11.2"),
    p("7.11.2", "p9", 283, 36, 36),
], [f7111, f7112]);
add("7.11.3", "RISPOSTA SISMICA E STABILITÀ DEL SITO", title("7.11.3", 283, 37, "7.11.3 RISPOSTA SISMICA E STABILITÀ DEL SITO"), []);
add("7.11.3.1", "RISPOSTA SISMICA LOCALE", title("7.11.3.1", 283, 38, "7.11.3.1 RISPOSTA SISMICA LOCALE"), [
    p("7.11.3.1", "p1", 283, 39, 42),
    p("7.11.3.1", "p2", 283, 43, 44),
    p("7.11.3.1", "p3", 283, 45, 47),
]);
add("7.11.3.2", "FATTORI DI AMPLIFICAZIONE STRATIGRAFICA", title("7.11.3.2", 283, 48, "7.11.3.2 FATTORI DI AMPLIFICAZIONE STRATIGRAFICA"), [
    p("7.11.3.2", "p1", 283, 49, 53, "In condizioni stratigrafiche e morfologiche schematizzabili con un modello mono-dimensionale e per profili stratigrafici riconducibili alle categorie di cui alla Tab. 3.2.II, il moto sismico alla superficie di un sito è definibile mediante l’accelerazione massima a_max attesa in superficie ed una forma spettrale ancorata ad essa. Il valore di a_max può essere ricavato dalla relazione a_max = S_S a_g dove a_g è l’accelerazione massima su sito di riferimento rigido ed S_S è il coefficiente di amplificazione stratigrafica.", [{ value: "a_max", latex: "a_{max}" }, { value: "a_max = S_S a_g", latex: "a_{max}=S_Sa_g" }]),
]);

add("7.11.3.3", "FATTORI DI AMPLIFICAZIONE TOPOGRAFICA", title("7.11.3.3", 284, 3, "7.11.3.3 FATTORI DI AMPLIFICAZIONE TOPOGRAFICA"), [
    p("7.11.3.3", "p1", 284, 4, 8),
]);
add("7.11.3.4", "STABILITÀ NEI CONFRONTI DELLA LIQUEFAZIONE", title("7.11.3.4", 284, 9, "7.11.3.4 STABILITÀ NEI CONFRONTI DELLA LIQUEFAZIONE"), []);
add("7.11.3.4.1", "Generalità", title("7.11.3.4.1", 284, 10, "7.11.3.4.1 Generalità"), [
    p("7.11.3.4.1", "p1", 284, 11, 18),
]);
add("7.11.3.4.2", "Esclusione della verifica a liquefazione", title("7.11.3.4.2", 284, 19, "7.11.3.4.2 Esclusione della verifica a liquefazione"), [
    p("7.11.3.4.2", "p1", 284, 20),
    li("7.11.3.4.2", "1", 284, 21),
    li("7.11.3.4.2", "2", 284, 22, 23),
    li("7.11.3.4.2", "3", 284, 24, 27),
    li("7.11.3.4.2", "4", 284, 28, 29),
    p("7.11.3.4.2", "p2", 284, 30, 31),
    figureBlock("7.11.3.4.2", fig7111, 284, "7.11.1", { coordinateSystem: "pdf-points-top-left", x: 150, y: 440, width: 300, height: 290 }),
    p("7.11.3.4.2", "p3", 285, 3, 4),
]);
units.at(-1)!.assets.figureIds = [figid(fig7111)];
add("7.11.3.4.3", "Metodi di analisi", title("7.11.3.4.3", 285, 5, "7.11.3.4.3 Metodi di analisi"), [
    p("7.11.3.4.3", "p1", 285, 6, 8),
    p("7.11.3.4.3", "p2", 285, 9, 13),
    p("7.11.3.4.3", "p3", 285, 14),
]);
add("7.11.3.5", "STABILITÀ DEI PENDII", title("7.11.3.5", 285, 15, "7.11.3.5 STABILITÀ DEI PENDII"), [
    p("7.11.3.5", "p1", 285, 16, 19),
]);
add("7.11.3.5.1", "Generalità", title("7.11.3.5.1", 285, 20, "7.11.3.5.1 Generalità"), [
    p("7.11.3.5.1", "p1", 285, 21, 29),
]);
add("7.11.3.5.2", "Metodi di analisi", title("7.11.3.5.2", 285, 30, "7.11.3.5.2 Metodi di analisi"), [
    p("7.11.3.5.2", "p1", 285, 31, 40),
    formulaBlock("7.11.3.5.2", f7113, 285, "7.11.3"),
    p("7.11.3.5.2", "p2", 285, 42, 46),
    p("7.11.3.5.2", "p3", 285, 47, 50),
    formulaBlock("7.11.3.5.2", f7114, 285, "7.11.4"),
    p("7.11.3.5.2", "p4", 285, 51, 54),
    formulaBlock("7.11.3.5.2", f7115, 285, "7.11.5"),
    p("7.11.3.5.2", "p5", 285, 54, 59),
    p("7.11.3.5.2", "p6", 286, 3, 14),
    tableBlock("7.11.3.5.2", "7.11.i", 286, "7.11.I"),
    p("7.11.3.5.2", "p7", 286, 24, 42),
], [f7113, f7114, f7115], ["7.11.i"]);
add("7.11.4", "FONDAZIONI", title("7.11.4", 286, 43, "7.11.4 FONDAZIONI"), [
    p("7.11.4", "p1", 286, 44, 58),
    p("7.11.4", "p2", 287, 3, 10),
]);
add("7.11.5", "VERIFICHE NEI CONFRONTI DEGLI STATI LIMITE ULTIMI (SLU)", title("7.11.5", 287, 11, "7.11.5 VERIFICHE NEI CONFRONTI DEGLI STATI LIMITE ULTIMI (SLU)"), []);
add("7.11.5.1", "Verifiche nei confronti degli stati limite ultimi di tipo geotecnico (GEO)", title("7.11.5.1", 287, 12, "7.11.5.1 Verifiche nei confronti degli stati limite ultimi di tipo geotecnico (GEO)"), [
    p("7.11.5.1", "p1", 287, 13, 14),
    li("7.11.5.1", "1", 287, 15, 17),
    li("7.11.5.1", "2", 287, 18, 21),
]);
add("7.11.5.2", "Verifiche nei confronti degli stati limite ultimi di tipo strutturale (STR)", title("7.11.5.2", 287, 22, "7.11.5.2 Verifiche nei confronti degli stati limite ultimi di tipo strutturale (STR)"), [
    p("7.11.5.2", "p1", 287, 23, 25),
]);
add("7.11.5.3", "Verifiche nei confronti degli stati limite ultimi di tipo strutturale (STR) e di esercizio (EQU)", title("7.11.5.3", 287, 26, "7.11.5.3 Verifiche nei confronti degli stati limite ultimi di tipo strutturale (STR) e di esercizio (EQU)"), [
    p("7.11.5.3", "p1", 287, 27, 32),
]);
add("7.11.5.3.1", "Verifiche nei confronti dello stato limite ultimo (SLV)", title("7.11.5.3.1", 287, 33, "7.11.5.3.1 Verifiche nei confronti dello stato limite ultimo (SLV)"), [
    p("7.11.5.3.1", "p1", 287, 34, 38),
    hblock("7.11.5.3.1", "h-slu-carico-limite", 287, 39, "Stato Limite Ultimo (SLV) per carico limite"),
    p("7.11.5.3.1", "p2", 287, 40, 45),
    hblock("7.11.5.3.1", "h-slu-scorrimento", 287, 46, "Stato Limite Ultimo (SLV) per scorrimento sul piano di posa"),
    p("7.11.5.3.1", "p3", 287, 47, 54),
    tableBlock("7.11.5.3.1", "7.11.ii", 288, "7.11.II"),
    hblock("7.11.5.3.1", "h-sld", 288, 9, "Stato Limite di Esercizio (SLD)"),
    p("7.11.5.3.1", "p4", 288, 10, 13),
], [], ["7.11.ii"]);
add("7.11.5.3.2", "Fondazioni su pali", title("7.11.5.3.2", 288, 14, "7.11.5.3.2 Fondazioni su pali"), [
    hblock("7.11.5.3.2", "h-slu", 288, 15, "Stati limite ultimi (SLV)"),
    p("7.11.5.3.2", "p1", 288, 16),
    p("7.11.5.3.2", "p2", 288, 17),
    li("7.11.5.3.2", "a", 288, 18, 18, "raggiungimento della resistenza a carico limite verticale del complesso pali-terreno;"),
    li("7.11.5.3.2", "b", 288, 19, 19, "raggiungimento della resistenza a carico limite orizzontale del complesso pali-terreno;"),
    li("7.11.5.3.2", "c", 288, 20, 20, "liquefazione del terreno di fondazione;"),
    li("7.11.5.3.2", "d", 288, 21, 22, "spostamenti o rotazioni eccessive che possano indurre il raggiungimento di uno stato limite ultimo nella struttura in elevazione;"),
    li("7.11.5.3.2", "e", 288, 23, 23, "rottura di uno degli elementi strutturali della palificata (pali o struttura di collegamento)."),
    p("7.11.5.3.2", "p3", 288, 24, 25),
    p("7.11.5.3.2", "p4", 288, 26, 27),
    p("7.11.5.3.2", "p5", 288, 28, 31),
    p("7.11.5.3.2", "p6", 288, 32, 34),
    p("7.11.5.3.2", "p7", 288, 35, 37),
    p("7.11.5.3.2", "p8", 288, 38, 44),
    hblock("7.11.5.3.2", "h-sld", 288, 45, "Stato Limite di Esercizio (SLD)"),
    p("7.11.5.3.2", "p9", 288, 46, 49),
]);
add("7.11.6", "OPERE DI SOSTEGNO", title("7.11.6", 288, 50, "7.11.6 OPERE DI SOSTEGNO"), []);
add("7.11.6.1", "REQUISITI GENERALI", title("7.11.6.1", 288, 51, "7.11.6.1 REQUISITI GENERALI"), [
    p("7.11.6.1", "p1", 288, 52, 57),
    p("7.11.6.1", "p2", 288, 58),
    li("7.11.6.1", "a", 289, 3, 3, "effetti inerziali nel terreno, nelle strutture di sostegno e negli eventuali carichi aggiuntivi presenti;"),
    li("7.11.6.1", "b", 289, 4, 4, "comportamento anelastico e non lineare del terreno;"),
    li("7.11.6.1", "c", 289, 5, 5, "effetto della distribuzione delle pressioni interstiziali, se presenti, sulle azioni scambiate fra il terreno e l’opera di sostegno;"),
    li("7.11.6.1", "d", 289, 6, 6, "condizioni di drenaggio;"),
    li("7.11.6.1", "e", 289, 7, 7, "influenza degli spostamenti dell’opera sulla mobilitazione delle condizioni di equilibrio limite."),
    p("7.11.6.1", "p3", 289, 8, 12),
    p("7.11.6.1", "p4", 289, 13, 17),
]);
add("7.11.6.2", "MURI DI SOSTEGNO", title("7.11.6.2", 289, 18, "7.11.6.2 MURI DI SOSTEGNO"), [
    p("7.11.6.2", "p1", 289, 19, 20),
]);
add("7.11.6.2.1", "Metodi di analisi", title("7.11.6.2.1", 289, 21, "7.11.6.2.1 Metodi di analisi"), [
    p("7.11.6.2.1", "p1", 289, 22, 29),
    formulaBlock("7.11.6.2.1", f7116, 289, "7.11.6"),
    formulaBlock("7.11.6.2.1", f7117, 289, "7.11.7"),
    p("7.11.6.2.1", "p2", 289, 35, 38),
    formulaBlock("7.11.6.2.1", f7118, 289, "7.11.8"),
    p("7.11.6.2.1", "p3", 289, 41, 46),
    p("7.11.6.2.1", "p4", 289, 47, 49),
    p("7.11.6.2.1", "p5", 289, 50, 52),
    p("7.11.6.2.1", "p6", 289, 53, 55),
    p("7.11.6.2.1", "p7", 289, 56, 57),
], [f7116, f7117, f7118]);
add("7.11.6.2.2", "Verifiche di sicurezza", title("7.11.6.2.2", 290, 3, "7.11.6.2.2 Verifiche di sicurezza"), [
    p("7.11.6.2.2", "p1", 290, 4, 7),
    p("7.11.6.2.2", "p2", 290, 8, 10),
    tableBlock("7.11.6.2.2", "7.11.iii", 290, "7.11.III"),
    p("7.11.6.2.2", "p3", 290, 18, 19),
    p("7.11.6.2.2", "p4", 290, 20),
    p("7.11.6.2.2", "p5", 290, 21, 25),
    p("7.11.6.2.2", "p6", 290, 26, 28),
], [], ["7.11.iii"]);
add("7.11.6.3", "PARATIE", title("7.11.6.3", 290, 29, "7.11.6.3 PARATIE"), [
    p("7.11.6.3", "p1", 290, 30, 31),
]);
add("7.11.6.3.1", "Metodi pseudo-statici", title("7.11.6.3.1", 290, 32, "7.11.6.3.1 Metodi pseudo-statici"), [
    p("7.11.6.3.1", "p1", 290, 33, 38),
    formulaBlock("7.11.6.3.1", f7119, 290, "7.11.9"),
    p("7.11.6.3.1", "p2", 290, 40, 43),
    p("7.11.6.3.1", "p3", 290, 44),
    formulaBlock("7.11.6.3.1", f71110, 290, "7.11.10"),
    p("7.11.6.3.1", "p4", 290, 46, 48),
    p("7.11.6.3.1", "p5", 290, 49, 53),
    p("7.11.6.3.1", "p6", 291, 3, 6),
    formulaBlock("7.11.6.3.1", f71111, 291, "7.11.11"),
    p("7.11.6.3.1", "p7", 291, 8, 11),
    figureBlock("7.11.6.3.1", fig7112, 291, "7.11.2", { coordinateSystem: "pdf-points-top-left", x: 180, y: 325, width: 250, height: 190 }),
    figureBlock("7.11.6.3.1", fig7113, 291, "7.11.3", { coordinateSystem: "pdf-points-top-left", x: 180, y: 518, width: 250, height: 217 }),
], [f7119, f71110, f71111]);
units.at(-1)!.assets.figureIds = [figid(fig7112), figid(fig7113)];
add("7.11.6.3.2", "Verifiche di sicurezza", title("7.11.6.3.2", 291, 12, "7.11.6.3.2 Verifiche di sicurezza"), [
    p("7.11.6.3.2", "p1", 291, 13, 19),
]);
add("7.11.6.4", "SISTEMI DI VINCOLO", title("7.11.6.4", 292, 3, "7.11.6.4 SISTEMI DI VINCOLO"), [
    p("7.11.6.4", "p1", 292, 4, 10),
    formulaBlock("7.11.6.4", f71112, 292, "7.11.12"),
    p("7.11.6.4", "p2", 292, 20, 24),
], [f71112]);
add("7.11.6.4.1", "Verifiche di sicurezza", title("7.11.6.4.1", 292, 25, "7.11.6.4.1 Verifiche di sicurezza"), [
    p("7.11.6.4.1", "p1", 292, 26, 28),
]);
add("8", "COSTRUZIONI ESISTENTI", title("8", 293, 3, "CAPITOLO 8. COSTRUZIONI ESISTENTI"), []);

const formulas = [
    { id: fid(f7116), unitId: uid("7.11.6.2.1"), officialNumber: "7.11.6", pdfPage: 289, latex: "k_h=\\beta_m\\frac{a_{max}}{g}" },
    { id: fid(f7117), unitId: uid("7.11.6.2.1"), officialNumber: "7.11.7", pdfPage: 289, latex: "k_v=\\pm0{,}5\\,k_h" },
    { id: fid(f7118), unitId: uid("7.11.6.2.1"), officialNumber: "7.11.8", pdfPage: 289, latex: "a_{max}=S\\,a_g=(S_S\\,S_T)\\,a_g" },
    { id: fid(f7119), unitId: uid("7.11.6.3.1"), officialNumber: "7.11.9", pdfPage: 290, latex: "a_h=k_h\\,g=\\alpha\\,\\beta\\,a_{max}" },
    { id: fid(f71110), unitId: uid("7.11.6.3.1"), officialNumber: "7.11.10", pdfPage: 290, latex: "a_{max}=S\\,a_g=(S_S\\,S_T)\\,a_g" },
    { id: fid(f71111), unitId: uid("7.11.6.3.1"), officialNumber: "7.11.11", pdfPage: 291, latex: "u_s\\le0{,}005\\,H" },
    { id: fid(f71112), unitId: uid("7.11.6.4"), officialNumber: "7.11.12", pdfPage: 292, latex: "L_e=L_s\\left(1+1{,}5\\frac{a_{max}}{g}\\right)" },
    { id: fid(f7101), unitId: uid("7.10.5.3.1"), officialNumber: "7.10.1", pdfPage: 280, latex: "F=M\\,S_e(T_{is},\\xi_{esi})" },
    { id: fid(f7102), unitId: uid("7.10.5.3.1"), officialNumber: "7.10.2", pdfPage: 280, latex: "d_{dc}=\\frac{M\\,S_e(T_{is},\\xi_{esi})}{K_{esi,min}}" },
    { id: fid(f7103), unitId: uid("7.10.5.3.1"), officialNumber: "7.10.3", pdfPage: 280, latex: "f_j=m_j\\,S_e(T_{is},\\xi_{esi})" },
    { id: fid(f7104), unitId: uid("7.10.5.3.1"), officialNumber: "7.10.4", pdfPage: 280, latex: "\\delta_{xi}=1+\\frac{e_{tot,y}}{r_y^2}y_i,\\quad \\delta_{yi}=1+\\frac{e_{tot,x}}{r_x^2}x_i" },
    { id: fid(f7105), unitId: uid("7.10.5.3.1"), officialNumber: "7.10.5", pdfPage: 280, latex: "r_x^2=\\frac{\\sum(x_i^2\\,K_{yi}+y_i^2\\,K_{xi})}{\\sum K_{yi}},\\quad r_y^2=\\frac{\\sum(x_i^2\\,K_{yi}+y_i^2\\,K_{xi})}{\\sum K_{xi}}" },
    { id: fid(f7111), unitId: uid("7.11.2"), officialNumber: "7.11.1", pdfPage: 283, latex: "\\tau_f=c' +(\\sigma'_n-\\Delta u)\\tan(\\phi')" },
    { id: fid(f7112), unitId: uid("7.11.2"), officialNumber: "7.11.2", pdfPage: 283, latex: "\\tau_f=c_{u,c}" },
    { id: fid(f7113), unitId: uid("7.11.3.5.2"), officialNumber: "7.11.3", pdfPage: 285, latex: "k_h=\\beta_s\\frac{a_{max}}{g}" },
    { id: fid(f7114), unitId: uid("7.11.3.5.2"), officialNumber: "7.11.4", pdfPage: 285, latex: "k_v=\\pm0{,}5\\,k_h" },
    { id: fid(f7115), unitId: uid("7.11.3.5.2"), officialNumber: "7.11.5", pdfPage: 285, latex: "a_{max}=S\\,a_g=(S_S\\,S_T)\\,a_g" },
    { id: fid(f791), unitId: uid("7.9.2.1"), officialNumber: "7.9.1", pdfPage: 270, latex: "q_0(\\nu_k)=q_0-\\left[\\frac{\\nu_k}{0{,}3}-1\\right](q_0-1)" },
    { id: fid(f792), unitId: uid("7.9.2.1"), officialNumber: "7.9.2", pdfPage: 270, latex: "K_R=\\frac{2}{\\tilde r}" },
    { id: fid(f793), unitId: uid("7.9.4"), officialNumber: "7.9.3", pdfPage: 271, latex: "\\Delta M=d_{Ed}\\,N_{Ed}" },
    { id: fid(f794), unitId: uid("7.9.4.1"), officialNumber: "7.9.4", pdfPage: 271, latex: "T_1=2\\pi\\sqrt{\\frac{M}{K}}" },
    { id: fid(f795), unitId: uid("7.9.4.1"), officialNumber: "7.9.5", pdfPage: 271, latex: "F_i=\\frac{4\\pi^2}{T_1^2}\\frac{S_d(T_1)}{g^2}\\,d_i\\,G_i" },
    { id: fid(f796), unitId: uid("7.9.4.1"), officialNumber: "7.9.6", pdfPage: 272, latex: "T_1=2\\pi\\sqrt{\\frac{\\sum_iG_i\\,d_i^2}{g\\sum_iG_i\\,d_i}}" },
    { id: fid(f797), unitId: uid("7.9.5"), officialNumber: "7.9.7", pdfPage: 272, latex: "\\gamma_{Rd}=0{,}7+0{,}2q\\ge1" },
    { id: fid(f798), unitId: uid("7.9.5.1.1"), officialNumber: "7.9.8", pdfPage: 272, latex: "M_{Ed}\\le M_{Rd}" },
    { id: fid(f799), unitId: uid("7.9.5.1.1"), officialNumber: "7.9.9", pdfPage: 272, latex: "M_{prc}\\le M_{yd}" },
    { id: fid(f7910a), unitId: uid("7.9.5.1.1"), officialNumber: "7.9.10a", pdfPage: 273, latex: "V_{Ed}=\\gamma_{Bd}\\,V_{prc}" },
    { id: fid(f7910b), unitId: uid("7.9.5.1.1"), officialNumber: "7.9.10b", pdfPage: 273, latex: "V_{prc}=\\frac{M_{s,prc}+M_{i,prc}}{l_p}" },
    { id: fid(f7911), unitId: uid("7.9.5.1.1"), officialNumber: "7.9.11", pdfPage: 273, latex: "1{,}00\\le\\gamma_{Bd}=2{,}25-q\\left(\\frac{V_E}{V_{prc}}-1\\right)\\le1{,}25" },
    { id: fid(f7912), unitId: uid("7.9.5.2.1"), officialNumber: "7.9.12", pdfPage: 273, latex: "V_{Ed,i}=V_{E,i}\\,\\frac{\\gamma_{Rd}M_{Rd,i}}{M_{E,i}}\\le V_{E,i}\\,q" },
    { id: fid(f7915), unitId: uid("7.9.6.1.1"), officialNumber: "7.9.15", pdfPage: 275, latex: "\\omega_{wd,r}\\ge\\max\\{\\omega_{w,req};\\;0{,}67\\,\\omega_{w,min}\\}" },
    { id: fid(f7916), unitId: uid("7.9.6.1.1"), officialNumber: "7.9.16", pdfPage: 275, latex: "\\omega_{w,req}=\\frac{A_c}{A_{cc}}\\,\\lambda\\,\\nu_k+0{,}13\\,\\frac{f_{yd}}{f_{cd}}(\\rho_L-0{,}01)" },
    { id: fid(f7917), unitId: uid("7.9.6.1.1"), officialNumber: "7.9.17", pdfPage: 275, latex: "\\omega_{wd,c}\\ge\\max\\{1{,}4\\,\\omega_{w,req};\\;\\omega_{w,min}\\}" },
    { id: fid(f7918), unitId: uid("7.9.6.1.1"), officialNumber: "7.9.18", pdfPage: 275, latex: "\\omega_{wd,r}=\\frac{A_{sw}}{s\\,b}\\,\\frac{f_{yd}}{f_{cd}}" },
    { id: fid(f7919), unitId: uid("7.9.6.1.1"), officialNumber: "7.9.19", pdfPage: 276, latex: "\\omega_{wd,c}=\\frac{4A_{sp}}{D_{sp}\\,s}\\,\\frac{f_{yd}}{f_{cd}}" },
    { id: fid(f7920), unitId: uid("7.9.6.1.1"), officialNumber: "7.9.20", pdfPage: 276, latex: "S_L\\le\\min\\{6d_{bL};\\;1{,}5b^*\\}" },
    { id: fid(f7921), unitId: uid("7.9.6.1.1"), officialNumber: "7.9.21", pdfPage: 276, latex: "S_L\\le\\min\\{\\frac{1}{3}b^*;\\;200\\,\\mathrm{mm}\\}" },
    { id: fid(f7922), unitId: uid("7.9.6.1.2"), officialNumber: "7.9.22", pdfPage: 276, latex: "S_L\\le6d_{bL}" },
    { id: fid(f7923), unitId: uid("7.9.6.1.2"), officialNumber: "7.9.23", pdfPage: 276, latex: "\\frac{A_T}{S_T}\\ge\\sum A_s\\,\\frac{f_{yk,s}}{1{,}6f_{yk,t}}" },
    { id: fid(f783), unitId: uid("7.8.2.2.2"), officialNumber: "7.8.3", pdfPage: 266, latex: "V_t=l'\\,t\\,f_{vd}" },
    { id: fid(f784), unitId: uid("7.8.2.2.4"), officialNumber: "7.8.4", pdfPage: 266, latex: "V_t=h\\,t\\,f_{vd0}" },
    { id: fid(f785), unitId: uid("7.8.2.2.4"), officialNumber: "7.8.5", pdfPage: 266, latex: "M_u=H_p\\,\\frac{h}{2}\\left[1-\\frac{H_p}{0{,}85\\,f_{bd}\\,h\\,t}\\right]" },
    { id: fid(f786), unitId: uid("7.8.2.2.4"), officialNumber: "7.8.6", pdfPage: 266, latex: "V_p=\\frac{2M_{fu}}{l}" },
    { id: fid(f787), unitId: uid("7.8.3.2.2"), officialNumber: "7.8.7", pdfPage: 267, latex: "V_t=V_{t,M}+V_{t,S}" },
    { id: fid(f788), unitId: uid("7.8.3.2.2"), officialNumber: "7.8.8", pdfPage: 267, latex: "V_{t,M}=d\\,t\\,f_{vd}" },
    { id: fid(f789), unitId: uid("7.8.3.2.2"), officialNumber: "7.8.9", pdfPage: 267, latex: "V_{t,S}=\\frac{0{,}6\\,d\\,A_{sw}\\,f_{vd}}{s}" },
    { id: fid(f7810), unitId: uid("7.8.3.2.2"), officialNumber: "7.8.10", pdfPage: 267, latex: "V_{t,c}=0{,}3\\,f_d\\,t\\,d" },
    { id: fid(f780), unitId: uid("7.8.1.5.2"), officialNumber: "7.8.0", pdfPage: 263, latex: "|\\Delta V|\\le\\max\\{0{,}25|V|,\\;0{,}1|V_{piano}|\\}" },
    { id: fid(fSa), unitId: uid("7.8.1.5.2"), officialNumber: null, pdfPage: 263, latex: "S_a=\\alpha\\,S\\left[1{,}5\\left(1+\\frac{Z}{H}\right)-0{,}5\right]\\ge\\alpha\\,S" },
    { id: fid(f781), unitId: uid("7.8.1.9"), officialNumber: "7.8.1", pdfPage: 265, latex: "\\sigma=\\frac{N}{A}\\le0{,}25\\frac{f_k}{\\gamma_M}" },
    { id: fid(f782), unitId: uid("7.8.2.2.1"), officialNumber: "7.8.2", pdfPage: 265, latex: "M_u=\\left(l^2\\,t\\,\\frac{\\sigma_0}{2}\right)\\left(1-\\frac{\\sigma_0}{0{,}85f_d}\right)" },
];

const tables = [
    {
        id: tid("7.11.ii"), unitId: uid("7.11.5.3.1"), officialNumber: "7.11.II", pdfPage: 288,
        caption: "Coefficienti parziali γ_R per le verifiche degli stati limite (SLV) delle fondazioni superficiali con azioni sismiche", columnCount: 2,
        headers: [[cell("Verifica"), cell("Coefficiente parziale γ_R", "\\gamma_R")]],
        rows: [[cell("Carico limite"), cell("2,3")], [cell("Scorrimento"), cell("1,1")], [cell("Resistenza sulle superfici laterali"), cell("1,3")]], notes: [],
    },
    {
        id: tid("7.11.iii"), unitId: uid("7.11.6.2.2"), officialNumber: "7.11.III", pdfPage: 290,
        caption: "Coefficienti parziali γ_R per le verifiche degli stati limite (SLV) dei muri di sostegno", columnCount: 2,
        headers: [[cell("Verifica"), cell("Coefficiente parziale γ_R", "\\gamma_R")]],
        rows: [[cell("Carico limite"), cell("1,2")], [cell("Scorrimento"), cell("1,0")], [cell("Ribaltamento"), cell("1,0")], [cell("Resistenza del terreno a valle"), cell("1,2")]], notes: [],
    },
    {
        id: tid("7.11.i"), unitId: uid("7.11.3.5.2"), officialNumber: "7.11.I", pdfPage: 286,
        caption: "Coefficienti di riduzione dell’accelerazione massima attesa al sito", columnCount: 3,
        headers: [[cell("Categoria di sottosuolo", undefined, { rowSpan: 2 }), cell("A"), cell("B, C, D, E")], [cell("β_s", "\\beta_s"), cell("β_s", "\\beta_s")]],
        rows: [
            [cell("0,2 < a_g (g) ≤ 0,4", "0{,}2<a_g(g)\\le0{,}4"), cell("0,30"), cell("0,28")],
            [cell("0,1 < a_g (g) ≤ 0,2", "0{,}1<a_g(g)\\le0{,}2"), cell("0,27"), cell("0,24")],
            [cell("a_g (g) ≤ 0,1", "a_g(g)\\le0{,}1"), cell("0,20"), cell("0,20")],
        ], notes: [],
    },
    {
        id: tid("7.8.i"), unitId: uid("7.8.1.4"), officialNumber: "7.8.I", pdfPage: 262,
        caption: "Requisiti geometrici delle pareti resistenti al sisma", columnCount: 4,
        headers: [[cell("Tipologie costruttive", undefined, { rowSpan: 1 }), cell("t_{min}", "t_{\\min}"), cell("(λ=h_0/t)_{max}", "(\\lambda=h_0/t)_{\\max}"), cell("(l/h’)_{min}", "(l/h')_{\\min}")]],
        rows: [
            [cell("Muratura ordinaria, realizzata con elementi in pietra squadrata"), cell("300 mm"), cell("10"), cell("0,5")],
            [cell("Muratura ordinaria, realizzata con elementi artificiali"), cell("240 mm"), cell("12"), cell("0,4")],
            [cell("Muratura armata, realizzata con elementi artificiali"), cell("240 mm"), cell("15"), cell("Qualsiasi")],
            [cell("Muratura confinata"), cell("240 mm"), cell("15"), cell("0,3")],
            [cell("Muratura ordinaria, realizzata con elementi in pietra squadrata, in siti caratterizzati, allo SLV, da a_{gS} ≤ 0,15g", "a_{gS}\\le0{,}15g"), cell("240 mm"), cell("12"), cell("0,3")],
            [cell("Muratura realizzata con elementi artificiali semipieni, in siti caratterizzati, allo SLV, da a_{gS} ≤ 0,075 g", "a_{gS}\\le0{,}075g"), cell("200 mm"), cell("20"), cell("0,3")],
            [cell("Muratura realizzata con elementi artificiali pieni, in siti caratterizzati, allo SLV, da a_{gS} ≤ 0,075 g", "a_{gS}\\le0{,}075g"), cell("150 mm"), cell("20"), cell("0,3")],
        ], notes: [],
    },
    {
        id: tid("7.8.ii"), unitId: uid("7.8.1.9"), officialNumber: "7.8.II", pdfPage: 265,
        caption: "Area pareti resistenti in ciascuna direzione ortogonale per costruzioni semplici", columnCount: 12,
        headers: [
            [cell("Accelerazione di picco del terreno a_{gS}(¹)", "a_{gS}^{(1)}", { colSpan: 2 }), ...["≤0,07g", "≤0,10g", "≤0,15g", "≤0,20g", "≤0,25g", "≤0,30g", "≤0,35g", "≤0,40g", "≤0,45g", "≤0,50g"].map((x) => cell(x))],
            [cell("Tipo di struttura"), cell("Numero piani"), ...Array.from({ length: 10 }, () => cell(""))],
        ],
        rows: [
            [cell("Muratura ordinaria", undefined, { rowSpan: 3 }), cell("1"), ...["3,5%", "3,5%", "4,0%", "4,5%", "5,5%", "6,0%", "6,0%", "6,0%", "6,0%", "6,5%"].map((x) => cell(x))],
            [cell("2"), ...["4,0%", "4,0%", "4,5%", "5,0%", "6,0%", "6,5%", "6,5%", "6,5%", "6,5%", "7,0%"].map((x) => cell(x))],
            [cell("3"), ...["4,5%", "4,5%", "5,0%", "6,0%", "6,5%", "7,0%", "7,0%", "", "", ""].map((x) => cell(x))],
            [cell("Muratura armata", undefined, { rowSpan: 4 }), cell("1"), ...["2,5%", "3,0%", "3,0%", "3,0%", "3,5%", "3,5%", "4,0%", "4,0%", "4,5%", "4,5%"].map((x) => cell(x))],
            [cell("2"), ...["3,0%", "3,5%", "3,5%", "3,5%", "4,0%", "4,0%", "4,5%", "5,0%", "5,0%", "5,0%"].map((x) => cell(x))],
            [cell("3"), ...["3,5%", "4,0%", "4,0%", "4,0%", "4,5%", "5,0%", "5,5%", "5,5%", "6,0%", "6,0%"].map((x) => cell(x))],
            [cell("4"), ...["4,0%", "4,5%", "4,5%", "5,0%", "5,5%", "5,5%", "5,5%", "6,0%", "6,5%", "6,5%"].map((x) => cell(x))],
        ],
        notes: ["(¹) S_T si applica solo nel caso di strutture di Classe d’uso III e IV (v. § 2.4.2)"],
    },
];

await mkdir(unitDir, { recursive: true });
for (const unit of units) await writeFile(join(unitDir, `${unit.numbering.official}.json`), `${JSON.stringify(unit, null, 2)}\n`, "utf8");
await mkdir(assetDir, { recursive: true });
for (const formula of formulas) formula.latex = formula.latex.replaceAll("\r", "\\r");
const manifest = {
    $schema: "urn:structural-codes:schema:asset-manifest:v2", schemaVersion: "2.0.0-alpha.1", recordType: "asset-manifest", document: "ntc2018", section: "7.7-78-step2", sourceId,
    status: "transcribed-unreviewed", formulas, tables, figures: [{
        id: figid(fig791), unitId: uid("7.9.3"), officialNumber: "7.9.1", pdfPage: 270,
        caption: "Fig. 7.9.1 – Ponte obliquo", alt: "Schema di ponte obliquo con lunghezza L, larghezza B e angolo φ.",
        imagePath: "figures/ntc2018/fig7.9.1.png",
        region: { coordinateSystem: "pdf-points-top-left", x: 245, y: 630, width: 190, height: 110 },
        sha256: "0fb5b71ba18555f941b134bbd4bb5db2534dd683c01e920516d3073780ea9185",
    }, {
        id: figid(fig7111), unitId: uid("7.11.3.4.2"), officialNumber: "7.11.1", pdfPage: 284,
        caption: "Fig. 7.11.1 – Fusi granulometrici di terreni suscettibili di liquefazione",
        alt: "Fusi granulometrici di terreni suscettibili di liquefazione.",
        imagePath: "figures/ntc2018/fig7.11.1.png",
        region: { coordinateSystem: "pdf-points-top-left", x: 150, y: 440, width: 300, height: 290 },
        sha256: "2942290e3be003936575e650da1d4d3e31fa97dba2307426c5ae3fe516734a75",
    }, {
        id: figid(fig7112), unitId: uid("7.11.6.3.1"), officialNumber: "7.11.2", pdfPage: 291,
        caption: "Fig. 7.11.2 – Diagramma per la valutazione del coefficiente di deformabilità α",
        alt: "Diagramma per la valutazione del coefficiente di deformabilità α.",
        imagePath: "figures/ntc2018/fig7.11.2.png",
        region: { coordinateSystem: "pdf-points-top-left", x: 180, y: 325, width: 250, height: 190 },
        sha256: "3abc7dcd9944fd739b0c1f9ae96f10e5bc14e5ac4c264f97eb600209e99eb622",
    }, {
        id: figid(fig7113), unitId: uid("7.11.6.3.1"), officialNumber: "7.11.3", pdfPage: 291,
        caption: "Fig. 7.11.3 – Diagramma per la valutazione del coefficiente di spostamento β",
        alt: "Diagramma per la valutazione del coefficiente di spostamento β.",
        imagePath: "figures/ntc2018/fig7.11.3.png",
        region: { coordinateSystem: "pdf-points-top-left", x: 180, y: 518, width: 250, height: 217 },
        sha256: "de038750e9528e1a645d751fbc7dfbe417889381c08dc4c6c64d704e7e8e376c",
    }],
};
await writeFile(join(assetDir, "7.7-78-step2.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(`ntc77-78-step2: generated ${units.length} new units, ${formulas.length} formulas, ${tables.length} tables; extended 7.7.2`);
