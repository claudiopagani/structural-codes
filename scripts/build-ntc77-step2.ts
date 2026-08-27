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
for (const page of [259, 260, 261, 262, 263, 264, 265, 266, 267, 268, 269, 270, 271, 272, 273, 274, 275, 276, 277, 278, 279, 280, 281, 282, 283, 284, 285, 286, 287, 288, 289, 290, 291, 292, 293, 294, 295, 296, 297, 298, 299]) {
    pages.set(page, (await readFile(join(repoRoot, "evidence", sourceId, "pages", `page-${String(page).padStart(4, "0")}.raw.txt`), "utf8"))
        .replace(/\r\n/gu, "\n").split("\n"));
}

type Part = [page: number, from: number, to?: number];
type MathTerm = { value: string; latex: string; wholeWord?: boolean };
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
            let index = text.indexOf(term.value, cursor);
            while (index >= 0 && term.wholeWord) {
                const before = text[index - 1];
                const after = text[index + term.value.length];
                const isWord = (character: string | undefined) => character !== undefined && /[\p{L}\p{N}_]/u.test(character);
                if (!isWord(before) && !isWord(after)) break;
                index = text.indexOf(term.value, index + 1);
            }
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
function percentCell(text: string): any { return cell(text, text.replace(",", "{,}").replace("%", "\\%")); }
function accelerationLimitCell(text: string): any { return cell(text, text.replace("≤", "\\le").replace(",", "{,}")); }

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
const kr: MathTerm = { value: "K_R", latex: "K_R" };
const sa: MathTerm = { value: "S_a", latex: "S_a" };
const diameter: MathTerm = { value: "d", latex: "d", wholeWord: true };
const quantity = (value: string, latex: string): MathTerm => ({ value, latex });
const variable = (value: string, latex = value): MathTerm => ({ value, latex, wholeWord: true });

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
    li("7.7.2", "editorial-008", 259, 6, 7, undefined, [quantity("13 mm", "13\\,\\mathrm{mm}")]),
    li("7.7.2", "editorial-009", 259, 8, undefined, undefined, [quantity("9 mm", "9\\,\\mathrm{mm}")]),
    li("7.7.2", "editorial-010", 259, 9, 10, undefined, [quantity("12 mm", "12\\,\\mathrm{mm}"), quantity("15 mm", "15\\,\\mathrm{mm}")]),
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
    p("7.7.3", "p2", 259, 19, 24, "Nel caso di strutture con comportamento dissipativo, è obbligo del Progettista giustificare la scelta dei valori assunti nei calcoli per il fattore q_0, sulla base della capacità dissipativa del sistema strutturale nonché dei criteri di dimensionamento dei collegamenti, che devono essere in grado di garantire una adeguata capacità, prevenendo rotture fragili mediante una puntuale applicazione dei principi della progettazione in capacità.", [q0]),
    p("7.7.3", "p3", 259, 25, 29, "Nella Tab. 7.3.II sono riportati, per ciascuna classe di duttilità, alcuni esempi di strutture con i valori massimi del fattore di comportamento q_0. Nel caso in cui il controventamento della struttura sia affidato a materiali diversi (calcestruzzo armato, acciaio), si deve fare riferimento ai pertinenti paragrafi della presente norma.", [q0]),
    p("7.7.3", "p4", 259, 30, 30, "."),
]);
units.at(-1).workflow.openIssues.push({
    issueId: "ntc2018-7-7-3-source-anomaly-standalone-period",
    type: "normalization-review",
    severity: "warning",
    note: "La fonte ufficiale stampa un punto isolato tra l’ultimo capoverso del § 7.7.3 e il § 7.7.3.1; il segno è conservato in un blocco distinto e richiede conferma editoriale umana.",
});
add("7.7.3.1", "PRECISAZIONI", title("7.7.3.1", 259, 31, "7.7.3.1 PRECISAZIONI"), [
    p("7.7.3.1", "p1", 259, 32, 34, undefined, [quantity("4", "4"), quantity("6", "6"), quantity("20%", "20\\%")]),
    p("7.7.3.1", "p2", 259, 35, 36),
    li("7.7.3.1", "a", 259, 37, 38, undefined, [diameter, quantity("12 mm", "12\\,\\mathrm{mm}"), quantity("10d", "10d")]),
    li("7.7.3.1", "b", 259, 39, 40, undefined, [diameter, quantity("3,1 mm", "3{,}1\\,\\mathrm{mm}"), quantity("4d", "4d")]),
    p("7.7.3.1", "p3", 259, 41, 43, undefined, [quantity("8d", "8d"), quantity("3d", "3d")]),
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
    p("7.7.6", "p3", 260, 40, 41, undefined, [quantity("1,3", "1{,}3")]), p("7.7.6", "p4", 260, 42, 43), p("7.7.6", "p5", 260, 44, 47, undefined, [quantity("20%", "20\\%")]),
]);
add("7.7.7", "REGOLE DI DETTAGLIO", title("7.7.7", 260, 48, "7.7.7 REGOLE DI DETTAGLIO"), []);
add("7.7.7.1", "DISPOSIZIONI COSTRUTTIVE PER I COLLEGAMENTI", title("7.7.7.1", 260, 49, "7.7.7.1 DISPOSIZIONI COSTRUTTIVE PER I COLLEGAMENTI"), [
    p("7.7.7.1", "p1", 260, 50, 51), p("7.7.7.1", "p2", 260, 52, 53, undefined, [diameter, quantity("16 mm", "16\\,\\mathrm{mm}")]), p("7.7.7.1", "p3", 261, 3, 6),
]);
add("7.7.7.2", "DISPOSIZIONI COSTRUTTIVE PER GLI IMPALCATI", title("7.7.7.2", 261, 7, "7.7.7.2 DISPOSIZIONI COSTRUTTIVE PER GLI IMPALCATI"), [
    p("7.7.7.2", "p1", 261, 8, 9, "In assenza di elementi di controvento trasversali intermedi lungo la trave, il rapporto altezza/spessore per una trave a sezione rettangolare deve rispettare la condizione h/b ≤ 4.", [quantity("h/b ≤ 4", "h/b\\le4")]),
    p("7.7.7.2", "p2", 261, 10, 11, "In siti caratterizzati da un valore a_g S ≥ 0,2 g, particolare attenzione deve essere posta alla spaziatura degli elementi di fissaggio in zone di discontinuità.", [quantity("a_g S ≥ 0,2 g", "a_g S\\ge0{,}2g")]),
]);

// 7.8 general rules, PDF pp.261-265.
add("7.8", "COSTRUZIONI DI MURATURA", title("7.8", 261, 12, "7.8 COSTRUZIONI DI MURATURA"), []);
add("7.8.1", "REGOLE GENERALI", title("7.8.1", 261, 13, "7.8.1 REGOLE GENERALI"), []);
add("7.8.1.1", "PREMESSA", title("7.8.1.1", 261, 14, "7.8.1.1 PREMESSA"), [
    p("7.8.1.1", "p1", 261, 15, 17), p("7.8.1.1", "p2", 261, 18, 19), p("7.8.1.1", "p3", 261, 20, 22),
    p("7.8.1.1", "p4", 261, 23, 24), p("7.8.1.1", "p5", 261, 25, 26, undefined, [quantity("20%", "20\\%"), quantity("2", "2")]),
]);
add("7.8.1.2", "MATERIALI", title("7.8.1.2", 261, 27, "7.8.1.2 MATERIALI"), [
    p("7.8.1.2", "p1", 261, 28, 31, "Gli elementi da utilizzare per costruzioni di muratura portante devono essere tali da evitare rotture fragili. A tal fine gli elementi devono possedere i requisiti indicati nel § 4.5.2 e, fatta eccezione per le costruzioni caratterizzate, allo SLV, da a_g S ≤ 0,075g, rispettare le seguenti ulteriori indicazioni:", [quantity("a_g S ≤ 0,075g", "a_g S\\le0{,}075g")]),
    li("7.8.1.2", "a", 261, 32, undefined, undefined, [quantity("45%", "45\\%")]), li("7.8.1.2", "b", 261, 33, 34),
    li("7.8.1.2", "c", 261, 35, 37, "– resistenza caratteristica a rottura nella direzione portante (f_{bk}), calcolata sull’area al lordo delle forature, non inferiore a 5 MPa o, in alternativa, resistenza media normalizzata nella direzione portante (f_b) non inferiore a 6 MPa;", [quantity("f_{bk}", "f_{bk}"), quantity("5 MPa", "5\\,\\mathrm{MPa}"), quantity("f_b", "f_b"), quantity("6 MPa", "6\\,\\mathrm{MPa}")]),
    li("7.8.1.2", "d", 261, 38, 40, "– resistenza caratteristica a rottura nella direzione perpendicolare a quella portante ossia nel piano di sviluppo della parete (f̄_{bk}), calcolata nello stesso modo, non inferiore a 1,5 MPa.", [quantity("f̄_{bk}", "\\bar{f}_{bk}"), quantity("1,5 MPa", "1{,}5\\,\\mathrm{MPa}")]),
    p("7.8.1.2", "p2", 261, 41, undefined, undefined, [quantity("5 MPa", "5\\,\\mathrm{MPa}")]), p("7.8.1.2", "p3", 261, 42, 44, undefined, [quantity("40%", "40\\%")]),
    p("7.8.1.2", "p4", 261, 45, 47, "L’uso di giunti sottili (spessore compreso tra 0,5 mm e 3 mm) è consentito esclusivamente per edifici caratterizzati allo SLV, da a_g S ≤ 0,15 g, con le seguenti limitazioni:", [quantity("0,5 mm", "0{,}5\\,\\mathrm{mm}"), quantity("3 mm", "3\\,\\mathrm{mm}"), quantity("a_g S ≤ 0,15 g", "a_g S\\le0{,}15g")]),
    li("7.8.1.2", "a2", 261, 48, 50, "– altezza massima, misurata in asse allo spessore della muratura: 10,5 m se a_g S ≤ 0,075 g; 7 m se 0,075 g < a_g S ≤ 0,15 g;", [quantity("10,5 m", "10{,}5\\,\\mathrm{m}"), quantity("a_g S ≤ 0,075 g", "a_g S\\le0{,}075g"), quantity("7 m", "7\\,\\mathrm{m}"), quantity("0,075 g < a_g S ≤ 0,15 g", "0{,}075g<a_g S\\le0{,}15g")]),
    li("7.8.1.2", "b2", 261, 51, 53, "– numero dei piani in muratura da quota campagna: ≤ 3 per a_g S ≤ 0,075g; ≤ 2 per 0,075g < a_g S ≤ 0,15g.", [quantity("≤ 3", "\\le3"), quantity("a_g S ≤ 0,075g", "a_g S\\le0{,}075g"), quantity("≤ 2", "\\le2"), quantity("0,075g < a_g S ≤ 0,15g", "0{,}075g<a_g S\\le0{,}15g")]),
    p("7.8.1.2", "p5", 261, 54, 57, "L’uso di giunti verticali non riempiti è consentito esclusivamente per edifici caratterizzati, allo SLV, da a_g S ≤ 0,075g, costituiti da un numero di piani in muratura da quota campagna non maggiore di due e altezza massima, misurata in asse allo spessore della muratura di 7 m.", [quantity("a_g S ≤ 0,075g", "a_g S\\le0{,}075g"), quantity("7 m", "7\\,\\mathrm{m}")]),
    p("7.8.1.2", "p6", 262, 3),
    li("7.8.1.2", "c2", 262, 4, undefined, undefined, [quantity("7 mm", "7\\,\\mathrm{mm}")]),
    li("7.8.1.2", "d2", 262, 5, undefined, undefined, [quantity("10 mm", "10\\,\\mathrm{mm}")]),
    li("7.8.1.2", "e2", 262, 6, undefined, undefined, [quantity("55%", "55\\%")]),
    p("7.8.1.2", "p7", 262, 7),
    p("7.8.1.2", "p8", 262, 8, 10, "È consentito utilizzare la muratura di pietra non squadrata o la muratura listata solo per costruzioni caratterizzate, allo SLV, da a_g S ≤ 0,075g.", [quantity("a_g S ≤ 0,075g", "a_g S\\le0{,}075g")]),
]);
add("7.8.1.3", "MODALITÀ COSTRUTTIVE E FATTORI DI COMPORTAMENTO", title("7.8.1.3", 262, 11, "7.8.1.3 MODALITÀ COSTRUTTIVE E FATTORI DI COMPORTAMENTO"), [
    p("7.8.1.3", "p1", 262, 12, 14, "In funzione del tipo di tecnica costruttiva utilizzata, la costruzione può essere considerata di muratura ordinaria, di muratura armata o di muratura confinata. I valori massimi del valore di base q_0 del fattore di comportamento con cui individuare lo spettro di progetto (vedi § 3.2.3.5) da utilizzare nelle analisi lineari, sono indicati in Tab. 7.3.II.", [q0]),
    p("7.8.1.3", "p2", 262, 15, 17, "Nel caso della muratura armata, valori compresi tra 2,0 α_u/α_1 e 2,5 α_u/α_1 possono essere applicati in funzione del sistema costruttivo prescelto, senza verificare quale sia il meccanismo di collasso della costruzione. Il valore 3,0 α_u/α_1 può essere utilizzato solo applicando i principi della progettazione in capacità descritti al § 7.8.1.7.", [quantity("2,0 α_u/α_1", "2{,}0\\,\\alpha_u/\\alpha_1"), quantity("2,5 α_u/α_1", "2{,}5\\,\\alpha_u/\\alpha_1"), quantity("3,0 α_u/α_1", "3{,}0\\,\\alpha_u/\\alpha_1")]),
    p("7.8.1.3", "p3", 262, 18, 20, "Si assume sempre q = q_0 · K_R, attribuendo a K_R i valori indicati nel § 7.3.1.", [quantity("q = q_0 · K_R", "q=q_0\\cdot K_R"), kr]),
    p("7.8.1.3", "p4", 262, 21, undefined, "I coefficienti α_1 e α_u sono definiti come segue:", [quantity("α_1", "\\alpha_1"), quantity("α_u", "\\alpha_u")]),
    p("7.8.1.3", "p5", 262, 22, 23, "α_1 è il moltiplicatore della forza sismica orizzontale per il quale, mantenendo costanti le altre azioni, il primo pannello murario raggiunge la sua resistenza ultima (a taglio o a pressoflessione);", [quantity("α_1", "\\alpha_1")]),
    p("7.8.1.3", "p6", 262, 24, 25, "α_u è il 90% del moltiplicatore della forza sismica orizzontale per il quale, mantenendo costanti le altre azioni, la costruzione raggiunge la massima forza resistente.", [quantity("α_u", "\\alpha_u"), quantity("90%", "90\\%")]),
    p("7.8.1.3", "p7", 262, 26, 27, "Il valore di α_u/α_1 può essere calcolato per mezzo di un’analisi statica non lineare (§ 7.3.4.2) e non può in ogni caso essere assunto superiore a 2,5.", [quq1, quantity("2,5", "2{,}5")]),
    p("7.8.1.3", "p8", 262, 28, undefined, "Qualora non si proceda a un’analisi non lineare, possono essere adottati i seguenti valori di α_u/α_1:", [quq1]),
    li("7.8.1.3", "a", 262, 29, undefined, "– costruzioni di muratura ordinaria α_u/α_1 = 1,7", [quantity("α_u/α_1 = 1,7", "\\alpha_u/\\alpha_1=1{,}7")]),
    li("7.8.1.3", "b", 262, 30, undefined, "– costruzioni di muratura armata α_u/α_1 = 1,5", [quantity("α_u/α_1 = 1,5", "\\alpha_u/\\alpha_1=1{,}5")]),
    li("7.8.1.3", "c", 262, 31, undefined, "– costruzioni di muratura armata progettate con la progettazione in capacità α_u/α_1 = 1,3", [quantity("α_u/α_1 = 1,3", "\\alpha_u/\\alpha_1=1{,}3")]),
    li("7.8.1.3", "d", 262, 32, undefined, "– costruzioni di muratura confinata α_u/α_1 = 1,6", [quantity("α_u/α_1 = 1,6", "\\alpha_u/\\alpha_1=1{,}6")]),
    li("7.8.1.3", "e", 262, 33, undefined, "– costruzioni di muratura confinata progettate con la progettazione in capacità α_u/α_1 = 1,3.", [quantity("α_u/α_1 = 1,3", "\\alpha_u/\\alpha_1=1{,}3")]),
]);
add("7.8.1.4", "CRITERI DI PROGETTO E REQUISITI GEOMETRICI", title("7.8.1.4", 262, 34, "7.8.1.4 CRITERI DI PROGETTO E REQUISITI GEOMETRICI"), [
    p("7.8.1.4", "p1", 262, 35, 38), p("7.8.1.4", "p2", 262, 39, 41, undefined, [quantity("5 m", "5\\,\\mathrm{m}")]),
    p("7.8.1.4", "p3", 262, 42, 44, "La geometria delle pareti resistenti al sisma deve rispettare i requisiti indicati nella Tab. 7.8.I, in cui t indica lo spessore della parete al netto dell’intonaco, h_0 l’altezza di libera inflessione della parete come definito al § 4.5.6.2, h’ l’altezza massima delle aperture adiacenti alla parete, l la lunghezza della parete.", [variable("t"), quantity("h_0", "h_0"), quantity("h’", "h'"), variable("l")]),
    tableBlock("7.8.1.4", "7.8.i", 262, "7.8.I"),
], [], ["7.8.i"]);
add("7.8.1.5", "METODI DI ANALISI", title("7.8.1.5", 263, 3, "7.8.1.5 METODI DI ANALISI"), []);
add("7.8.1.5.1", "Generalità", title("7.8.1.5.1", 263, 4, "7.8.1.5.1 Generalità"), [p("7.8.1.5.1", "p1", 263, 5)]);
const f780 = "7.8.1.5.2-7.8.0";
const fSa = "7.8.1.5.2-sa";
add("7.8.1.5.2", "Analisi lineare statica", title("7.8.1.5.2", 263, 6, "7.8.1.5.2 Analisi lineare statica"), [
    p("7.8.1.5.2", "p1", 263, 7, undefined, "È applicabile nei casi previsti al § 7.3.3.2, anche per le costruzioni irregolari in altezza, purché si ponga λ = 1,0.", [quantity("λ = 1,0", "\\lambda=1{,}0")]), p("7.8.1.5.2", "p2", 263, 8, 10), p("7.8.1.5.2", "p3", 263, 11, 12), p("7.8.1.5.2", "p4", 263, 13, 21),
    p("7.8.1.5.2", "p5", 263, 22, 24, "Nel caso di solai rigidi, la distribuzione delle forze di taglio nei diversi pannelli ottenuta dall’analisi lineare può essere modificata con una ridistribuzione limitata, facendo sì che l’equilibrio globale di piano sia rispettato (il modulo e la posizione della forza risultante di piano restino invariati) e a condizione che la variazione del taglio in ciascun pannello, ΔV, soddisfi la relazione", [quantity("ΔV", "\\Delta V")]),
    formulaBlock("7.8.1.5.2", f780, 263, "7.8.0"),
    p("7.8.1.5.2", "p6", 263, 26, 29, "dove V è il taglio nel pannello e V_piano è il taglio totale al piano nella direzione parallela al pannello. Tale ridistribuzione non è ammessa nel caso in cui il rapporto α_u/α_1 necessario per il calcolo del fattore comportamento q sia stato ottenuto dal progettista direttamente da un’analisi non lineare. Viceversa, se nella determinazione di α_u/α_1 ci si è avvalsi dei valori prudenziali suggeriti al § 7.8.1.3, la ridistribuzione è ammessa.", [variable("V"), quantity("V_piano", "V_{piano}"), quq1, variable("q")]),
    p("7.8.1.5.2", "p7", 263, 30, 32, "Nel caso di solai deformabili la ridistribuzione può essere eseguita solamente tra pannelli complanari collegati da cordoli o incatenamenti oppure appartenenti alla stessa parete. In tal caso, nel calcolo dei limiti per la ridistribuzione, V_piano è da intendersi come la somma dei tagli nei pannelli complanari oppure appartenenti alla stessa parete.", [quantity("V_piano", "V_{piano}")]),
    p("7.8.1.5.2", "p8", 263, 33, 42, "Le verifiche fuori piano possono essere eseguite separatamente, e possono essere adottate le forze equivalenti indicate al § 7.2.3 per gli elementi non strutturali, assumendo q_a = 3. Più precisamente l’azione sismica ortogonale alla parete può essere rappresentata da una forza orizzontale distribuita, pari a (S_a/q_a) volte il peso della parete nonché da forze orizzontali concentrate pari a (S_a/q_a) volte il peso trasmesso dagli orizzontamenti che si appoggiano sulla parete, qualora queste forze non siano efficacemente trasmesse a muri trasversali disposti parallelamente alla direzione del sisma. Per le pareti resistenti al sisma, che rispettano i limiti di Tab. 7.8.II, si può assumere per S_a la seguente espressione:", [quantity("q_a = 3", "q_a=3"), quantity("(S_a/q_a)", "(S_a/q_a)"), sa]),
    formulaBlock("7.8.1.5.2", fSa, 263, null),
    p("7.8.1.5.2", "p9", 263, 45, 52, "dove: α è il rapporto tra accelerazione massima del terreno a_g su sottosuolo tipo A per lo stato limite in esame (vedi § 3.2.1) e l’accelerazione di gravità g; S è il coefficiente che tiene conto della categoria di sottosuolo e delle condizioni topografiche secondo quanto riportato nel § 3.2.3.2.1; Z è la quota del baricentro dell’elemento non strutturale misurata a partire dal piano di fondazione (vedi § 3.2.2); H è l’altezza della costruzione misurata a partire dal piano di fondazione; Per le strutture con isolamento sismico si assume sempre Z=0.", [quantity("α", "\\alpha"), quantity("a_g", "a_g"), variable("g"), variable("S"), variable("Z"), variable("H"), quantity("Z=0", "Z=0")]),
    p("7.8.1.5.2", "p10", 263, 53, 54),
], [f780, fSa]);
add("7.8.1.5.3", "Analisi dinamica modale", title("7.8.1.5.3", 263, 55, "7.8.1.5.3 Analisi dinamica modale"), [p("7.8.1.5.3", "p1", 263, 56, 57)]);
add("7.8.1.5.4", "Analisi statica non lineare", title("7.8.1.5.4", 264, 5, "7.8.1.5.4 Analisi statica non lineare"), [p("7.8.1.5.4", "p1", 264, 6, 10, undefined, [quantity("75%", "75\\%"), quantity("60%", "60\\%")]), p("7.8.1.5.4", "p2", 264, 11, 15)]);
add("7.8.1.5.5", "Analisi dinamica non lineare", title("7.8.1.5.5", 264, 16, "7.8.1.5.5 Analisi dinamica non lineare"), [p("7.8.1.5.5", "p1", 264, 17, 18)]);
add("7.8.1.6", "VERIFICHE DI SICUREZZA", title("7.8.1.6", 264, 19, "7.8.1.6 VERIFICHE DI SICUREZZA"), [
    p("7.8.1.6", "p1", 264, 20, 24), p("7.8.1.6", "p2", 264, 25, 26), p("7.8.1.6", "p3", 264, 27, 28), p("7.8.1.6", "p4", 264, 29, 33, undefined, [quantity("0,7", "0{,}7")]), p("7.8.1.6", "p5", 264, 34, 37, undefined, [quantity("4,0", "4{,}0")]), p("7.8.1.6", "p6", 264, 38, 39),
]);
add("7.8.1.7", "PRINCIPI DI PROGETTAZIONE IN CAPACITÀ", title("7.8.1.7", 264, 40, "7.8.1.7 PRINCIPI DI PROGETTAZIONE IN CAPACITÀ"), [
    p("7.8.1.7", "p1", 264, 41),
    p("7.8.1.7", "p2", 264, 42, 45, "Per ogni pannello murario, il principio fondamentale è finalizzato ad evitare il collasso per taglio, assicurandosi che sia preceduto dal collasso per flessione. Tale principio è rispettato quando ciascun pannello murario è verificato a flessione rispetto alle azioni agenti ed è verificato a taglio rispetto alle azioni risultanti dalla resistenza a collasso per flessione, amplificate del fattore γ_Rd di cui alla Tab. 7.2.I.", [quantity("γ_Rd", "\\gamma_{Rd}")]),
]);
add("7.8.1.8", "FONDAZIONI", title("7.8.1.8", 264, 46, "7.8.1.8 FONDAZIONI"), [p("7.8.1.8", "p1", 264, 47, 48), p("7.8.1.8", "p2", 264, 49, 51)]);
const f781 = "7.8.1.9-7.8.1";
add("7.8.1.9", "COSTRUZIONI SEMPLICI", title("7.8.1.9", 264, 52, "7.8.1.9 COSTRUZIONI SEMPLICI"), [
    mp("7.8.1.9", "p1", [part(264, 53, 55), part(265, 3, 5)], "Si definiscono “costruzioni semplici” quelle che rispettano le condizioni di cui al § 4.5.6.4 integrate con le caratteristiche descritte nel seguito, oltre a quelle di regolarità in pianta e in elevazione definite al § 7.2.1 e quelle definite ai successivi § 7.8.6.1, 7.8.6.2 e 7.8.6.3, rispettivamente per le costruzioni di muratura ordinaria, di muratura armata e di muratura confinata. Per le costruzioni semplici per cui, allo SLV, a_g S ≤ 0,35g non è obbligatorio eseguire alcuna analisi e verifica di sicurezza, ma è richiesto il soddisfacimento delle seguenti condizioni integrative:", [quantity("a_g S ≤ 0,35g", "a_g S\\le0{,}35g")]),
    li("7.8.1.9", "a", 265, 6, 11, undefined, [quantity("50%", "50\\%"), quantity("75%", "75\\%")]),
    li("7.8.1.9", "b", 265, 12, 13, undefined, [quantity("7 m", "7\\,\\mathrm{m}"), quantity("9 m", "9\\,\\mathrm{m}")]),
    li("7.8.1.9", "c", 265, 14, 16),
    tableBlock("7.8.1.9", "7.8.ii", 265, "7.8.II"), p("7.8.1.9", "p3", 265, 33, 34, undefined, [quantity("3", "3"), quantity("4", "4")]), p("7.8.1.9", "p4", 265, 35),
    formulaBlock("7.8.1.9", f781, 265, "7.8.1"),
    p("7.8.1.9", "p5", 265, 44, 46, "in cui N è il carico verticale totale alla base di ciascun piano dell’edificio corrispondente alla somma dei carichi permanenti e variabili (valutati ponendo γ_G = γ_Q = 1), A è l’area totale dei muri portanti allo stesso piano e f_k è la resistenza caratteristica a compressione in direzione verticale della muratura.", [variable("N"), quantity("γ_G = γ_Q = 1", "\\gamma_G=\\gamma_Q=1"), variable("A"), quantity("f_k", "f_k")]),
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
    p("7.8.2.2.1", "p1", 265, 59, 62, "La verifica a pressoflessione di una sezione di un elemento strutturale si esegue confrontando il momento agente di progetto con il momento ultimo resistente calcolato assumendo la muratura non reagente a trazione e un’opportuna distribuzione non lineare delle compressioni. Nel caso di una sezione rettangolare e diagramma delle compressioni rettangolare con valore della resistenza pari a 0.85 f_d, tale momento ultimo può essere calcolato come:", [quantity("0.85 f_d", "0.85f_d")]),
    formulaBlock("7.8.2.2.1", f782, 265, "7.8.2"),
    p("7.8.2.2.1", "p2", 265, 84, 84, "dove:"),
    p("7.8.2.2.1", "p3", 265, 85, 85, "M_u è il momento corrispondente al collasso per pressoflessione;", [quantity("M_u", "M_u")]),
], [f782]);

const masonry721 = units.at(-1);
const masonry721Blocks = [
    p("7.8.2.2.1", "p4", 266, 3, 3, "l è la lunghezza complessiva della parete (comprensiva della zona tesa);", [variable("l")]),
    p("7.8.2.2.1", "p5", 266, 4, 4, "t è lo spessore della zona compressa della parete;", [variable("t")]),
    p("7.8.2.2.1", "p6", 266, 5, 6, "σ_0 è la tensione normale media, riferita all’area totale della sezione, σ_0 = N/(l·t), con N forza assiale agente positiva se di compressione); se N è di trazione, M_u = 0", [
        quantity("σ_0", "\\sigma_0"), quantity("σ_0 = N/(l·t)", "\\sigma_0=N/(l\\cdot t)"), variable("N"), quantity("M_u = 0", "M_u=0"),
    ]),
    p("7.8.2.2.1", "p7", 266, 7, 7, "f_d = f_k / γ_M è la resistenza a compressione di progetto della muratura.", [quantity("f_d = f_k / γ_M", "f_d=f_k/\\gamma_M")]),
    p("7.8.2.2.1", "p8", 266, 8, 10, "In caso di analisi statica non lineare, la capacità a pressoflessione può essere calcolata ponendo f_d pari al valore medio della capacità a compressione della muratura e lo spostamento ultimo allo SLC, a meno di moti rigidi del pannello, può essere assunto pari all’1,0% dell’altezza del pannello.", [quantity("f_d", "f_d"), quantity("1,0%", "1{,}0\\%")]),
];
masonry721.blocks.push(...masonry721Blocks);

add("7.8.2.2.2", "Taglio", title("7.8.2.2.2", 266, 11, "7.8.2.2.2 Taglio"), [
    p("7.8.2.2.2", "p1", 266, 12, 12, "La capacità a taglio di ciascun elemento strutturale è valutata per mezzo della relazione seguente:"),
    formulaBlock("7.8.2.2.2", f783, 266, "7.8.3"),
    p("7.8.2.2.2", "p2", 266, 14, 14, "dove:"),
    p("7.8.2.2.2", "p3", 266, 15, 16, "l' è la lunghezza della parte compressa della parete ottenuta sulla base di un diagramma lineare delle compressioni ed in assenza di resistenza a trazione;", [quantity("l'", "l'")]),
    p("7.8.2.2.2", "p4", 266, 17, 17, "t è lo spessore della parete;", [variable("t")]),
    p("7.8.2.2.2", "p5", 266, 18, 19, "f_{yd} = f_{yk} / γ_M è definito al § 4.5.6.1 e al § 11.3.3, calcolando la tensione normale media (indicata con σ_n nei paragrafi citati) sulla parte compressa della sezione (σ_n = N/(l'·t)).", [
        { value: "f_{yd} = f_{yk} / γ_M", latex: "f_{yd}=f_{yk}/\\gamma_M" }, { value: "σ_n", latex: "\\sigma_n" }, { value: "σ_n = N/(l'·t)", latex: "\\sigma_n=N/(l'\\cdot t)" },
    ]),
    p("7.8.2.2.2", "p6", 266, 20, 22, "In caso di analisi statica non lineare, la resistenza a taglio può essere calcolata ponendo f_{yd} = f_{vm0} + 0,4 σ_n ≤ f_{y,lim} con f_{vm0} resistenza media a taglio della muratura (in assenza di determinazione diretta si può porre f_{vm0} = f_{vk0}/0,7 e f_{y,lim} = f_{yk,lim}/0,7), e lo spostamento ultimo allo SLC, a meno di moti rigidi del pannello, può essere assunto pari allo 0,5% dell’altezza del pannello.", [
        { value: "f_{yd} = f_{vm0} + 0,4 σ_n ≤ f_{y,lim}", latex: "f_{yd}=f_{vm0}+0{,}4\\,\\sigma_n\\le f_{y,lim}" }, { value: "f_{vm0} = f_{vk0}/0,7", latex: "f_{vm0}=f_{vk0}/0{,}7" }, { value: "f_{y,lim} = f_{yk,lim}/0,7", latex: "f_{y,lim}=f_{yk,lim}/0{,}7" }, quantity("0,5%", "0{,}5\\%"),
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
    p("7.8.2.2.4", "p4", 266, 37, 37, "h è l’altezza della sezione della trave", [variable("h")]),
    p("7.8.2.2.4", "p5", 266, 38, 39, "f_{vd0} = f_{vk0} / γ_M è la resistenza di progetto a taglio in assenza di compressione; nel caso di analisi statica non lineare può essere posta pari al valore medio (f_{vd0} = f_{vm0}).", [
        { value: "f_{vd0} = f_{vk0} / γ_M", latex: "f_{vd0}=f_{vk0}/\\gamma_M" }, { value: "f_{vd0} = f_{vm0}", latex: "f_{vd0}=f_{vm0}" },
    ]),
    p("7.8.2.2.4", "p6", 266, 40, 41, "La capacità massima a flessione, associata al meccanismo di pressoflessione, sempre in presenza di elementi orizzontali resistenti a trazione in grado di equilibrare una compressione orizzontale nelle travi in muratura, può essere valutata come"),
    formulaBlock("7.8.2.2.4", f785, 266, "7.8.5"),
    p("7.8.2.2.4", "p7", 266, 58, 58, "dove"),
    p("7.8.2.2.4", "p8", 266, 59, 59, "H_p è il minimo tra la capacità a trazione dell’elemento teso disposto orizzontalmente ed il valore 0,4 f_{hd} h t", [{ value: "H_p", latex: "H_p" }, { value: "0,4 f_{hd} h t", latex: "0{,}4f_{hd}ht" }]),
    p("7.8.2.2.4", "p9", 266, 60, 61, "f_{hd} = f_{hk} / γ_M è la resistenza di progetto a compressione della muratura in direzione orizzontale (nel piano della parete). Nel caso di analisi statica non lineare essa può essere posta uguale al valore medio (f_{hd} = f_{hm}).", [
        { value: "f_{hd} = f_{hk} / γ_M", latex: "f_{hd}=f_{hk}/\\gamma_M" }, { value: "f_{hd} = f_{hm}", latex: "f_{hd}=f_{hm}" },
    ]),
    p("7.8.2.2.4", "p10", 266, 62, 62, "La capacità a taglio, associata a tale meccanismo, può essere calcolata come:"),
    formulaBlock("7.8.2.2.4", f786, 266, "7.8.6"),
    p("7.8.2.2.4", "p11", 266, 64, 64, "dove l è la luce libera della trave in muratura.", [variable("l")]),
    p("7.8.2.2.4", "p12", 266, 65, 65, "Il valore della capacità a taglio per l’elemento trave in muratura ordinaria è assunto pari al minimo tra V_t e V_p.", [{ value: "V_t", latex: "V_t" }, { value: "V_p", latex: "V_p" }]),
], [f784, f785, f786]);

add("7.8.3", "COSTRUZIONI DI MURATURA ARMATA", title("7.8.3", 267, 3, "7.8.3 COSTRUZIONI DI MURATURA ARMATA"), []);
add("7.8.3.1", "CRITERI DI PROGETTO", title("7.8.3.1", 267, 4, "7.8.3.1 CRITERI DI PROGETTO"), [
    p("7.8.3.1", "p1", 267, 5, 6, "L’insieme strutturale risultante deve essere in grado di reagire alle azioni esterne orizzontali con un comportamento di tipo globale, al quale contribuisce soltanto la resistenza delle pareti nel loro piano."),
]);
add("7.8.3.2", "VERIFICHE DI SICUREZZA", title("7.8.3.2", 267, 7, "7.8.3.2 VERIFICHE DI SICUREZZA"), []);
add("7.8.3.2.1", "Pressoflessione nel piano", title("7.8.3.2.1", 267, 8, "7.8.3.2.1 Pressoflessione nel piano"), [
    p("7.8.3.2.1", "p1", 267, 9, 11, "Per la verifica di sezioni pressoinflesse può essere assunto un diagramma delle compressioni rettangolare, con profondità pari a 0,8 la profondità dell’asse neutro e tensione pari a 0,85 f_d. Le deformazioni massime da considerare sono pari a ε_m = 0,0035 per la muratura compressa e ε_s = 0,01 per l’acciaio teso.", [quantity("0,8", "0{,}8"), quantity("0,85 f_d", "0{,}85f_d"), quantity("ε_m = 0,0035", "\\varepsilon_m=0{,}0035"), quantity("ε_s = 0,01", "\\varepsilon_s=0{,}01")]),
    p("7.8.3.2.1", "p2", 267, 12, 13, "In caso di analisi statica non lineare si adottano come valori di progetto le resistenze medie dei materiali e lo spostamento ultimo può essere assunto pari all’1,6% dell’altezza del pannello.", [quantity("1,6%", "1{,}6\\%")]),
]);
add("7.8.3.2.2", "Taglio", title("7.8.3.2.2", 267, 14, "7.8.3.2.2 Taglio"), [
    p("7.8.3.2.2", "p1", 267, 15, 19, "La resistenza a taglio (V_t) è calcolata come somma dei contributi della muratura (V_{t,M}) e dell’armatura (V_{t,S}), secondo le relazioni seguenti:", [{ value: "V_t", latex: "V_t" }, { value: "V_{t,M}", latex: "V_{t,M}" }, { value: "V_{t,S}", latex: "V_{t,S}" }]),
    formulaBlock("7.8.3.2.2", f787, 267, "7.8.7"),
    formulaBlock("7.8.3.2.2", f788, 267, "7.8.8"),
    p("7.8.3.2.2", "p2", 267, 22, 22, "dove:"),
    p("7.8.3.2.2", "p3", 267, 23, 23, "d è la distanza tra il lembo compresso e il baricentro dell’armatura tesa;", [variable("d")]),
    p("7.8.3.2.2", "p4", 267, 24, 24, "t è lo spessore della parete;", [variable("t")]),
    p("7.8.3.2.2", "p5", 267, 25, 26, "f_{yd} = f_{yk} / γ_M è definito al § 4.5.6.1 calcolando la tensione normale media (indicata con σ_n nel paragrafo citato) sulla sezione lorda di larghezza d (σ_n = P/dt).", [
        quantity("f_{yd} = f_{yk} / γ_M", "f_{yd}=f_{yk}/\\gamma_M"), quantity("σ_n", "\\sigma_n"), quantity("σ_n = P/dt", "\\sigma_n=P/dt"),
    ]),
    formulaBlock("7.8.3.2.2", f789, 267, "7.8.9"),
    p("7.8.3.2.2", "p7", 267, 28, 28, "dove:"),
    p("7.8.3.2.2", "p8", 267, 29, 29, "d è la distanza tra il lembo compresso e il baricentro dell’armatura tesa;", [variable("d")]),
    p("7.8.3.2.2", "p9", 267, 30, 31, "A_{sw} è l’area dell’armatura a taglio disposta in direzione parallela alla forza di taglio, con passo s misurato ortogonalmente alla direzione della forza di taglio;", [quantity("A_{sw}", "A_{sw}"), variable("s")]),
    p("7.8.3.2.2", "p10", 267, 32, 32, "f_{yd} è la tensione di snervamento di progetto dell’acciaio;", [quantity("f_{yd}", "f_{yd}")]),
    p("7.8.3.2.2", "p11", 267, 33, 33, "s è la distanza tra i livelli di armatura.", [variable("s")]),
    p("7.8.3.2.2", "p12", 267, 34, 34, "Deve essere altresì verificato che il taglio agente non superi il seguente valore:"),
    formulaBlock("7.8.3.2.2", f7810, 267, "7.8.10"),
    p("7.8.3.2.2", "p13", 267, 36, 36, "dove:"),
    p("7.8.3.2.2", "p14", 267, 37, 37, "t è lo spessore della parete", [variable("t")]),
    p("7.8.3.2.2", "p15", 267, 38, 38, "f_d è la resistenza a compressione di progetto della muratura.", [quantity("f_d", "f_d")]),
    p("7.8.3.2.2", "p16", 267, 39, 40, "In caso di analisi statica non lineare si adottano come valori di progetto le resistenze medie dei materiali e lo spostamento ultimo può essere assunto pari allo 0,8% dell’altezza del pannello.", [quantity("0,8%", "0{,}8\\%")]),
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
    li("7.8.5", "e", 268, 20, 22, "nel caso di analisi lineare, per la verifica della parte in muratura si utilizzi il fattore di comportamento q prescritto al § 7.8.1.3; per la verifica della parte superiore di altra tecnologia si utilizzi il fattore di comportamento adatto alla tipologia costruttiva e alla configurazione (regolarità) della parte superiore, comunque non superiore a 2,5;", [variable("q"), quantity("2,5", "2{,}5")]),
    li("7.8.5", "f", 268, 23, 24, "tutti i collegamenti fra la parte di diversa tecnologia e la parte in muratura siano localmente verificati in base alle forze trasmesse calcolate nell’analisi, maggiorate del 30%.", [quantity("30%", "30\\%")]),
]);
add("7.8.6", "REGOLE DI DETTAGLIO", title("7.8.6", 268, 25, "7.8.6 REGOLE DI DETTAGLIO"), []);
add("7.8.6.1", "COSTRUZIONI DI MURATURA ORDINARIA", title("7.8.6.1", 268, 26, "7.8.6.1 COSTRUZIONI DI MURATURA ORDINARIA"), [
    p("7.8.6.1", "p1", 268, 27, 27),
    p("7.8.6.1", "p2", 268, 28, 33, "I cordoli devono avere altezza minima pari all’altezza del solaio e larghezza almeno pari a quella del muro; è consentito un arretramento massimo non superiore a 60 mm e a 0,25 t dal filo esterno per murature di spessore t fino a 300 mm. Per murature di spessore t superiore, l’arretramento può essere maggiore di 60 mm, ma non superiore a 0,2 t. L’area dell’armatura corrente non deve essere inferiore a 8 cm², le staffe devono avere diametro non inferiore a 6 mm ed interasse non superiore a 250 mm. Travi metalliche o prefabbricate costituenti i solai devono essere prolungate nel cordolo per almeno la metà della sua larghezza e comunque per non meno di 120 mm ed adeguatamente ancorate ad esso.", [
        quantity("60 mm", "60\\,\\mathrm{mm}"), quantity("0,25 t", "0{,}25\\cdot t"), variable("t"), quantity("300 mm", "300\\,\\mathrm{mm}"), quantity("0,2 t", "0{,}2\\cdot t"), quantity("8 cm²", "8\\,\\mathrm{cm}^2"), quantity("6 mm", "6\\,\\mathrm{mm}"), quantity("250 mm", "250\\,\\mathrm{mm}"), quantity("120 mm", "120\\,\\mathrm{mm}"),
    ]),
    p("7.8.6.1", "p3", 268, 34, 37, undefined, [quantity("1 m", "1\\,\\mathrm{m}")]),
    p("7.8.6.1", "p4", 268, 38, 38),
]);
add("7.8.6.2", "COSTRUZIONI DI MURATURA ARMATA", title("7.8.6.2", 268, 39, "7.8.6.2 COSTRUZIONI DI MURATURA ARMATA"), [
    p("7.8.6.2", "p1", 268, 40, 41),
    p("7.8.6.2", "p2", 268, 42, 42),
    p("7.8.6.2", "p3", 268, 43, 45),
    p("7.8.6.2", "p4", 268, 46, 47, undefined, [quantity("0,04%", "0{,}04\\%"), quantity("0,5%", "0{,}5\\%")]),
    p("7.8.6.2", "p5", 268, 48, 49),
    p("7.8.6.2", "p6", 268, 50, 51, undefined, [quantity("1 m", "1\\,\\mathrm{m}")]),
]);
add("7.8.6.3", "COSTRUZIONI DI MURATURA CONFINATA", title("7.8.6.3", 268, 52, "7.8.6.3 COSTRUZIONI DI MURATURA CONFINATA"), [
    p("7.8.6.3", "p1", 268, 53, 53),
    li("7.8.6.3", "a", 268, 54, 55, "gli elementi di confinamento orizzontale e verticali dovranno essere collegati fra loro e ancorati agli elementi del sistema strutturale principale;"),
    li("7.8.6.3", "b", 269, 3, 4, "per garantire un collegamento efficace fra gli elementi di confinamento e la muratura, il calcestruzzo degli elementi di confinamento dovrà essere gettato dopo la realizzazione della muratura;"),
    li("7.8.6.3", "c", 269, 5, 7, "la minima dimensione trasversale degli elementi di confinamento orizzontali e verticali non dovrà essere inferiore a 150 mm. Nelle pareti a doppio foglio lo spessore degli elementi di confinamento deve garantire la connessione dei due fogli ed il loro confinamento;", [quantity("150 mm", "150\\,\\mathrm{mm}")]),
    li("7.8.6.3", "d", 269, 8, 8, "gli elementi di confinamento verticali dovranno essere posizionati:"),
    li("7.8.6.3", "d-a", 269, 9, 9, "lungo i bordi liberi di ogni parete strutturale;"),
    li("7.8.6.3", "d-b", 269, 10, 10, "su entrambi i lati delle aperture aventi area maggiore di 1,5 m²;", [quantity("1,5 m²", "1{,}5\\,\\mathrm{m}^2")]),
    li("7.8.6.3", "d-c", 269, 11, 11, "all’interno delle pareti con passo non maggiore di 5 m;", [quantity("5 m", "5\\,\\mathrm{m}")]),
    li("7.8.6.3", "d-d", 269, 12, 13, "alle intersezioni delle pareti strutturali, in tutti i casi in cui gli elementi di confinamento più vicini siano ad una distanza superiore a 1,5 m;", [quantity("1,5 m", "1{,}5\\,\\mathrm{m}")]),
    li("7.8.6.3", "e", 269, 14, 15, "gli elementi di confinamento orizzontali dovranno essere posizionati nel piano della parete ad ogni piano e, in ogni caso, ad un passo non maggiore di 4 m;", [quantity("4 m", "4\\,\\mathrm{m}")]),
    li("7.8.6.3", "f", 269, 16, 17, "l’armatura longitudinale degli elementi di confinamento deve avere un’area non inferiore a 300 mm² o all’1% della sezione dell’elemento di confinamento;", [quantity("300 mm²", "300\\,\\mathrm{mm}^2"), quantity("1%", "1\\%")]),
    li("7.8.6.3", "g", 269, 18, 18, "le staffe dovranno avere diametro non inferiore a 5 mm e passo non maggiore di 15 cm;", [quantity("5 mm", "5\\,\\mathrm{mm}"), quantity("15 cm", "15\\,\\mathrm{cm}")]),
    li("7.8.6.3", "h", 269, 19, 19, "le lunghezze di sovrapposizione delle barre longitudinali non dovranno essere minori di 60 diametri.", [quantity("60 diametri", "60\\,\\text{diametri}")]),
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
    p("7.9.2", "p3", 269, 38, 41, undefined, [quantity("1,5", "1{,}5"), quantity("10 diametri", "10\\,\\text{diametri}")]),
    p("7.9.2", "p4", 269, 42, 46, undefined, [quantity("0,35%", "0{,}35\\%")]),
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
const f7114u = "7.11.4-unnumbered-1";
const fig7111 = "7.11.3.4.2-fig7.11.1";
const f7116 = "7.11.6.2.1-7.11.6";
const f7117 = "7.11.6.2.1-7.11.7";
const f7118 = "7.11.6.2.1-7.11.8";
const f7118u = "7.11.6.2.1-unnumbered-1";
const f7119 = "7.11.6.3.1-7.11.9";
const f71110 = "7.11.6.3.1-7.11.10";
const f71111 = "7.11.6.3.1-7.11.11";
const f71112 = "7.11.6.4-7.11.12";
const fig7112 = "7.11.6.3.2-fig7.11.2";
const fig7113 = "7.11.6.3.2-fig7.11.3";

add("7.9.2.1", "VALORI DEL FATTORE DI COMPORTAMENTO", title("7.9.2.1", 270, 3, "7.9.2.1 VALORI DEL FATTORE DI COMPORTAMENTO"), [
    p("7.9.2.1", "p1", 270, 4, 4, "Nel caso di comportamento strutturale non dissipativo, per le due componenti orizzontali dell’azione sismica, q_0 è assunto pari a 1,0.", [quantity("q_0", "q_0"), quantity("1,0", "1{,}0")]),
    p("7.9.2.1", "p2", 270, 5, 10, "Nel caso di comportamento strutturale dissipativo, per le due componenti orizzontali dell’azione sismica, i valori massimi del valore di base q_0 del fattore di comportamento sono riportati in Tab. 7.3.II; in essa: λ(α)=1, se α ≥ 3, λ(α)=(α/3)^0,5, se 3 > α ≥ 1, essendo α = L/H, dove L è la distanza della sezione di cerniera plastica dalla sezione di momento nullo ed H è la dimensione della sezione nel piano di inflessione della cerniera plastica.", [
        quantity("q_0", "q_0"), quantity("λ(α)=1", "\\lambda(\\alpha)=1"), quantity("α ≥ 3", "\\alpha\\ge3"), quantity("λ(α)=(α/3)^0,5", "\\lambda(\\alpha)=(\\alpha/3)^{0{,}5}"), quantity("3 > α ≥ 1", "3>\\alpha\\ge1"), quantity("α = L/H", "\\alpha=L/H"), variable("L"), variable("H"),
    ]),
    p("7.9.2.1", "p3", 270, 11, 15, "Per gli elementi duttili di calcestruzzo armato i valori di q_0 della Tab. 7.3.II valgono solo se la sollecitazione di compressione normalizzata ν_k, ottenuta dividendo lo sforzo di progetto N_Ed per la resistenza a compressione semplice della sezione (ν_k = N_Ed/A_c f_ck), non eccede il valore 0,3.", [
        quantity("q_0", "q_0"), quantity("ν_k", "\\nu_k"), quantity("N_Ed", "N_{Ed}"), quantity("ν_k = N_Ed/A_c f_ck", "\\nu_k=N_{Ed}/A_c f_{ck}"), quantity("0,3", "0{,}3"),
    ]),
    p("7.9.2.1", "p4", 270, 16, 16, "La sollecitazione di compressione normalizzata non può superare il valore ν_k = 0,6.", [{ value: "ν_k = 0,6", latex: "\\nu_k=0{,}6" }]),
    p("7.9.2.1", "p5a", 270, 17, 17, "Per valori di ν_k intermedi tra 0,3 e 0,6, il valore di q_0 è dato da:", [quantity("ν_k", "\\nu_k"), quantity("0,3", "0{,}3"), quantity("0,6", "0{,}6"), quantity("q_0", "q_0")]),
    formulaBlock("7.9.2.1", f791, 270, "7.9.1"),
    p("7.9.2.1", "p5b", 270, 29, 29, "essendo q_0 il valore applicabile per ν_k ≤ 0,3.", [{ value: "q_0", latex: "q_0" }, { value: "ν_k ≤ 0,3", latex: "\\nu_k\\le0{,}3" }]),
    p("7.9.2.1", "p6", 270, 30, 33, "Nella tabella 7.3.II sono riportate anche le strutture che si muovono con il terreno. Esse non subiscono amplificazione dell’accelerazione del suolo poiché sono caratterizzate da periodi naturali di vibrazione in direzione orizzontale molto bassi (T ≤ 0,03 s). Appartengono a questa categoria anche le spalle connesse all’impalcato mediante collegamenti flessibili o appoggi mobili.", [quantity("T ≤ 0,03 s", "T\\le0{,}03\\,\\mathrm{s}")]),
    p("7.9.2.1", "p7", 270, 34, 35, "Per ciascuna delle due direzioni principali, i valori massimi q_0 del fattore di comportamento sono da applicare, nel caso di ponti isostatici, alle singole pile, nel caso di ponti a travata continua, all’intera opera.", [quantity("q_0", "q_0")]),
    p("7.9.2.1", "p8", 270, 36, 37),
    p("7.9.2.1", "p9", 270, 38, 40, "Il requisito di regolarità, quindi l’applicabilità di un valore K_R = 1, può essere verificato a posteriori mediante il seguente procedimento:", [{ value: "K_R = 1", latex: "K_R=1" }]),
    li("7.9.2.1", "a", 270, 41, 48, "per ciascun elemento duttile si calcoli il rapporto: r_i = q_0 M_Ed,i/M_Rd,i, dove M_Ed,i è il momento alla base dell’elemento duttile i-esimo prodotto dalla combinazione sismica di progetto, M_Rd,i è il corrispondente momento resistente;", [quantity("r_i = q_0 M_Ed,i/M_Rd,i", "r_i=q_0M_{Ed,i}/M_{Rd,i}"), quantity("M_Ed,i", "M_{Ed,i}"), quantity("M_Rd,i", "M_{Rd,i}")]),
    li("7.9.2.1", "b", 270, 49, 50, "la geometria del ponte si considera “regolare” se il rapporto tra il massimo ed il minimo dei rapporti r_i, calcolati per le pile facenti parte del sistema resistente al sisma nella direzione considerata, risulta inferiore a 2 (r̃ = r_i,max/r_i,min < 2).", [quantity("r_i", "r_i"), quantity("r̃ = r_i,max/r_i,min < 2", "\\tilde r=r_{i,\\max}/r_{i,\\min}<2")]),
    p("7.9.2.1", "p10a", 270, 51, 51, "Nel caso risulti r̃ ≥ 2, l’analisi deve essere ripetuta utilizzando il seguente valore ridotto di K_R:", [{ value: "r̃ ≥ 2", latex: "\\tilde r\\ge2" }, { value: "K_R", latex: "K_R" }]),
    formulaBlock("7.9.2.1", f792, 270, "7.9.2"),
    p("7.9.2.1", "p10b", 270, 53, 54, "e comunque assumendo sempre q = q_0 K_R ≥ 1.", [{ value: "q = q_0 K_R ≥ 1", latex: "q=q_0K_R\\ge1" }]),
    p("7.9.2.1", "p11", 270, 55, 56, "Ai fini della determinazione di r_max e r_min nella direzione orizzontale considerata si possono escludere le pile la cui resistenza a taglio non ecceda il 20% della resistenza sismica totale diviso il numero degli elementi resistenti.", [quantity("r_max", "r_{\\max}"), quantity("r_min", "r_{\\min}"), quantity("20%", "20\\%")]),
    p("7.9.2.1", "p12", 270, 57, 59, "Per ponti a geometria irregolare (ad esempio con angolo di obliquità maggiore di 45°, con raggio di curvatura molto ridotto, ecc.) si adotta un fattore di comportamento q pari a 1,5. Valori maggiori di 1,5, e comunque non superiori a 3,5, possono essere adottati solo qualora le richieste di duttilità siano verificate mediante analisi non lineare.", [quantity("45°", "45^\\circ"), variable("q"), quantity("1,5", "1{,}5"), quantity("3,5", "3{,}5")]),
], [f791, f792]);

add("7.9.3", "MODELLO STRUTTURALE", title("7.9.3", 270, 60, "7.9.3 MODELLO STRUTTURALE"), [
    p("7.9.3", "p1", 270, 61, 66, "Il modello strutturale deve poter descrivere tutti i gradi di libertà significativi caratterizzanti la risposta dinamica e riprodurre fedelmente le caratteristiche di inerzia e di rigidezza della struttura, e di vincolo degli impalcati. Quando l’impalcato abbia angolo di obliquità φ > 20° (vedi Fig. 7.9.1) o sia particolarmente largo rispetto alla lunghezza (rapporto tra larghezza B e lunghezza L, B/L > 2,0) particolare attenzione deve essere dedicata ai moti rigidi del ponte intorno all’asse verticale, in particolare per le travi continue avendo cura che il meccanismo resistente non sia affidato alla torsione di una pila unica e per le travi appoggiate prevedendo una opportuna disposizione degli apparecchi di appoggio.", [quantity("φ > 20°", "\\varphi>20^\\circ"), variable("B"), variable("L"), quantity("B/L > 2,0", "B/L>2{,}0")]),
    figureBlock("7.9.3", fig791, 270, "7.9.1", { coordinateSystem: "pdf-points-top-left", x: 245, y: 630, width: 190, height: 110 }),
]);
const bridgeModel = units.at(-1)!;
bridgeModel.blocks.push(
    p("7.9.3", "p2", 271, 3, 4, "La rigidezza degli elementi in calcestruzzo armato deve essere valutata tenendo conto del loro effettivo stato di fessurazione, che è in generale diverso per l’impalcato (spesso interamente reagente) e per le pile."),
    p("7.9.3", "p3", 271, 5, 6, "In assenza di più accurate determinazioni, l’eccentricità accidentale di cui al § 7.2.6 è riferita all’impalcato e può essere assunta pari a 0,03 volte la dimensione dell’impalcato stesso, misurata perpendicolarmente alla direzione dell’azione sismica.", [quantity("0,03", "0{,}03")]),
);
bridgeModel.assets.figureIds = [figid(fig791)];

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
    li("7.9.4.1", "a", 271, 30, 31, undefined, [quantity("1/5", "1/5")]),
    li("7.9.4.1", "b", 271, 32, 33, undefined, [quantity("1/5", "1/5")]),
    li("7.9.4.1", "c", 271, 34, 36, undefined, [quantity("5%", "5\\%")]),
    p("7.9.4.1", "p2", 271, 37, 38),
    p("7.9.4.1", "p3", 271, 39, 40, "Nei casi (a) e (b) la massa M, da considerare concentrata in corrispondenza dell’impalcato ed in base alla quale valutare la forza F equivalente all’azione sismica, vale rispettivamente:", [variable("M"), variable("F")]),
    li("7.9.4.1", "d", 271, 41, 42, "– la massa di impalcato afferente alla pila, più la massa della metà del terzo superiore della pila più la massa del pulvino., nel caso a);"),
    li("7.9.4.1", "e", 271, 43, 43, "– l’intera massa dell’impalcato, più la massa del terzo superiore di tutte le pile più la massa di tutti i pulvini, nel caso b)."),
    p("7.9.4.1", "p4", 271, 44, 47, "Il periodo fondamentale T_1 in corrispondenza del quale valutare la risposta spettrale in accelerazione S_d(T_1) è dato in entrambi i casi dall’espressione:", [quantity("T_1", "T_1"), quantity("S_d(T_1)", "S_d(T_1)")]),
    formulaBlock("7.9.4.1", f794, 271, "7.9.4"),
    p("7.9.4.1", "p5", 271, 49, 49, "nella quale K è la rigidezza laterale del modello considerato, ossia della singola pila nel caso a), complessiva delle pile nel caso b).", [variable("K")]),
    p("7.9.4.1", "p6", 271, 50, 50),
    formulaBlock("7.9.4.1", f795, 271, "7.9.5"),
    p("7.9.4.1", "p7", 271, 62, 66, "nella quale: T_1 è il periodo proprio fondamentale del ponte nella direzione trasversale; g è l’accelerazione di gravità; d_i è lo spostamento del grado di libertà i quando la struttura è soggetta ad un sistema di forze statiche trasversali f_i = G_i; G_i è il peso della massa concentrata nel grado di libertà i.", [quantity("T_1", "T_1"), variable("g"), quantity("d_i", "d_i"), variable("i"), quantity("f_i = G_i", "f_i=G_i"), quantity("G_i", "G_i")]),
    p("7.9.4.1", "p8", 272, 3, 3),
    formulaBlock("7.9.4.1", f796, 272, "7.9.6"),
], [f794, f795, f796]);

add("7.9.5", "DIMENSIONAMENTO E VERIFICA DEGLI ELEMENTI STRUTTURALI", title("7.9.5", 272, 14, "7.9.5 DIMENSIONAMENTO E VERIFICA DEGLI ELEMENTI STRUTTURALI"), [
    p("7.9.5", "p1", 272, 15, 18, "Le indicazioni successive si applicano agli elementi strutturali delle strutture in elevazione. Per essi si effettuano verifiche di resistenza e verifiche di duttilità nei modi indicati nel § 7.3.6.1. I fattori di sovraresistenza γ_Rd da utilizzare nelle singole verifiche, secondo le regole della progettazione in capacità, sono calcolati mediante l’espressione:", [quantity("γ_Rd", "\\gamma_{Rd}")]),
    formulaBlock("7.9.5", f797, 272, "7.9.7"),
    p("7.9.5", "p2", 272, 20, 22, "nella quale q è il valore del fattore di comportamento utilizzato nel calcolo. Nel caso di sezioni in calcestruzzo armato, qualora il rapporto ν_k tra la forza assiale e la resistenza a compressione della sezione di calcestruzzo eccede 0,1, il fattore di sovraresistenza va moltiplicato per 1 + 2(ν_k − 0,1)².", [variable("q"), quantity("ν_k", "\\nu_k"), quantity("0,1", "0{,}1"), quantity("1 + 2(ν_k − 0,1)²", "1+2(\\nu_k-0{,}1)^2")]),
    p("7.9.5", "p3", 272, 23, 24, "Le sollecitazioni calcolate a partire dalle capacità flessionali amplificate, incrementate dell’effetto dei carichi permanenti distribuiti sugli elementi, ottenute con il criterio della progettazione in capacità, si indicano con l’indice “prc”, ad es. F_prc.", [quantity("F_prc", "F_{prc}")]),
    p("7.9.5", "p4", 272, 25, 28, "Per le strutture di fondazione vale quanto indicato nel § 7.2.5. Alle azioni sismiche, cui la spalla o la pila devono resistere come strutture a sé stanti, sono da aggiungere le forze parassite trasmesse per attrito dagli appoggi mobili o elastomerici che non assolvono la funzione di isolamento ai sensi del § 7.10, che devono essere maggiorate di un fattore pari a 1,30.", [quantity("1,30", "1{,}30")]),
    p("7.9.5", "p5", 272, 29, 31),
], [f797]);
add("7.9.5.1", "PILE", title("7.9.5.1", 272, 32, "7.9.5.1 PILE"), [
    p("7.9.5.1", "p1", 272, 33, 34),
]);
add("7.9.5.1.1", "Verifiche di resistenza (RES)", title("7.9.5.1.1", 272, 35, "7.9.5.1.1 Verifiche di resistenza (RES)"), [
    p("7.9.5.1.1", "p1", 272, 36, 36),
    hblock("7.9.5.1.1", "subheading-pressoflessione", 272, 37, "Presso-flessione"),
    p("7.9.5.1.1", "p2", 272, 38, 41, undefined, [quantity("55%", "55\\%"), quantity("65%", "65\\%")]),
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
    p("7.9.5.1.1", "p12", 273, 17, 18, undefined, [variable("z"), quantity("0,9d", "0{,}9d"), quantity("0,75d", "0{,}75d"), quantity("0,60d", "0{,}60d")]),
    p("7.9.5.1.1", "p13", 273, 19, 20, undefined, [quantity("45°", "45^\\circ")]),
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
    p("7.9.5.2.1", "p4", 273, 41, 41, undefined, [variable("i")]),
    formulaBlock("7.9.5.2.1", f7912, 273, "7.9.12"),
    p("7.9.5.2.1", "p5", 273, 51, 53, "nella quale V_E,i è il valore dello sforzo di taglio ottenuto dall’analisi, M_E,i il corrispondente momento flettente alla base della pila, ed M_Rd,i l’effettivo momento resistente alla base della pila.", [{ value: "V_E,i", latex: "V_{E,i}" }, { value: "M_E,i", latex: "M_{E,i}" }, { value: "M_Rd,i", latex: "M_{Rd,i}" }]),
    p("7.9.5.2.1", "p6", 273, 54, 55, "Se la pila trasmette anche momenti all’impalcato, i valori da assumere per la verifica di quest’ultimo sono dati dai valori dei momenti resistenti delle membrature che li trasmettono, moltiplicati per il fattore di sovraresistenza γ_Rd.", [{ value: "γ_Rd", latex: "\\gamma_{Rd}" }]),
    p("7.9.5.2.1", "p7", 273, 56, 57),
    p("7.9.5.2.1", "p8", 273, 58, 59, undefined, [quantity("q = 1", "q=1")]),
], [f7912]);

add("7.9.5.3", "APPARECCHI DI APPOGGIO E ZONE DI SOVRAPPOSIZIONE", title("7.9.5.3", 273, 60, "7.9.5.3 APPARECCHI DI APPOGGIO E ZONE DI SOVRAPPOSIZIONE"), []);
add("7.9.5.3.1", "Apparecchi d’appoggio o di vincolo fissi", title("7.9.5.3.1", 273, 61, "7.9.5.3.1 Apparecchi d’appoggio o di vincolo fissi"), [
    mp("7.9.5.3.1", "p1", [part(273, 62, 63), part(274, 3, 5)], "Gli apparecchi d’appoggio o di vincolo fissi devono essere dimensionati con i criteri della progettazione in capacità. Essi devono quindi essere in grado di trasmettere, mantenendo la piena funzionalità, forze orizzontali tali da produrre, nella zona o nelle zone dissipative alla base della pila, un momento flettente pari a γ_Rd · M_Rd, dove M_Rd è il momento resistente della zona o delle zone dissipative. Questa verifica può essere eseguita in modo indipendente per le due direzioni dell’azione sismica.", [quantity("γ_Rd · M_Rd", "\\gamma_{Rd}\\cdot M_{Rd}"), quantity("M_Rd", "M_{Rd}")]),
    p("7.9.5.3.1", "p2", 274, 6, 7, undefined, [quantity("q = 1", "q=1")]),
]);
add("7.9.5.3.2", "Apparecchi d’appoggio mobili", title("7.9.5.3.2", 274, 8, "7.9.5.3.2 Apparecchi d’appoggio mobili"), [
    p("7.9.5.3.2", "p1", 274, 9, 10),
]);
add("7.9.5.3.3", "Dispositivi di fine corsa", title("7.9.5.3.3", 274, 11, "7.9.5.3.3 Dispositivi di fine corsa"), [
    p("7.9.5.3.3", "p1", 274, 12, 14),
    p("7.9.5.3.3", "p2", 274, 15, 16),
    p("7.9.5.3.3", "p3", 274, 17, 23, "In tali casi, in mancanza di verifica analitica in campo dinamico dell’interazione impalcato-pila o spalla e delle sollecitazioni indotte nei dispositivi, questi ultimi possono venire dimensionati per resistere ad una forza pari ad α · Q, in cui α = 1,5 · S · a_g/g è l’accelerazione normalizzata di progetto valutata allo SLC, S, a_g e g sono definiti al § 3.2.3.2.1 e Q è il peso della parte di impalcato collegato ad una pila od alle spalle, oppure, nel caso di due parti di impalcato collegate tra loro, il minore dei pesi di ciascuna delle due parti.", [quantity("α · Q", "\\alpha\\cdot Q"), quantity("α = 1,5 · S · a_g/g", "\\alpha=1{,}5\\cdot S\\cdot a_g/g"), variable("S"), quantity("a_g", "a_g"), variable("g"), variable("Q")]),
]);
add("7.9.5.3.4", "Zone di sovrapposizione", title("7.9.5.3.4", 274, 24, "7.9.5.3.4 Zone di sovrapposizione"), [
    p("7.9.5.3.4", "p1", 274, 25, 28, undefined, [quantity("400 mm", "400\\,\\mathrm{mm}")]),
]);
add("7.9.5.4", "SPALLE", title("7.9.5.4", 274, 29, "7.9.5.4 SPALLE"), [
    p("7.9.5.4", "p1", 274, 30, 35),
]);
add("7.9.5.4.1", "Collegamento mediante apparecchi d’appoggio mobili", title("7.9.5.4.1", 274, 36, "7.9.5.4.1 Collegamento mediante apparecchi d’appoggio mobili"), [
    p("7.9.5.4.1", "p1", 274, 37, 38),
    p("7.9.5.4.1", "p2", 274, 39, 39),
    li("7.9.5.4.1", "a", 274, 40, 41),
    li("7.9.5.4.1", "b", 274, 42, 44, "– le forze d’inerzia agenti sulla massa della spalla e del terreno presenti sulla sua fondazione, cui va applicata un’accelerazione pari ad a_g · S.", [quantity("a_g · S", "a_g\\cdot S")]),
]);
add("7.9.5.4.2", "Collegamento mediante apparecchi d’appoggio fissi", title("7.9.5.4.2", 274, 45, "7.9.5.4.2 Collegamento mediante apparecchi d’appoggio fissi"), [
    p("7.9.5.4.2", "p1", 274, 46, 51, "Questo tipo di collegamento è adottato in maniera generalizzata per la direzione trasversale ed in genere su una delle due spalle per la direzione longitudinale. In entrambi i casi le spalle e il ponte formano un sistema accoppiato ed è quindi necessario utilizzare un modello strutturale che consenta di analizzare gli effetti di interazione tra il terreno, la spalla e la parte di ponte accoppiata. L’interazione terreno-spalla può in molti casi essere trascurata (a favore di stabilità) quando l’azione sismica agisce in direzione trasversale al ponte, ossia nel piano della spalla. In questi casi l’azione sismica può essere assunta pari all’accelerazione a_g · S.", [quantity("a_g · S", "a_g\\cdot S")]),
    mp("7.9.5.4.2", "p2", [part(274, 52, 57), part(275, 3, 6)], "Nel senso longitudinale il modello deve comprendere, in generale, la deformabilità del terreno retrostante e quella del terreno di fondazione. Qualora non venga effettuata l’analisi d’interazione di cui sopra, le forze d’inerzia agenti sulla massa della spalla, del terreno presente sulla sua fondazione e dell’impalcato saranno calcolate in base all’accelerazione valutata con lo spettro di progetto in corrispondenza del periodo T_B. Nel caso in cui il sistema costituito dalla spalla, dal terreno presente sulla sua fondazione e dall’impalcato sia considerabile come infinitamente rigido (periodo proprio inferiore a 0,05 s) le forze d’inerzia direttamente applicate ad esso possono essere assunte pari al prodotto delle masse per l’accelerazione del terreno a_g · S. Nel caso in cui la spalla sostenga un terreno rigido naturale per più dell’80% dell’altezza, si può considerare che essa si muova con il suolo. In questo caso le forze d’inerzia di progetto possono essere determinate considerando un’accelerazione pari ad a_g · S.", [quantity("T_B", "T_B"), quantity("0,05 s", "0{,}05\\,\\mathrm{s}"), quantity("a_g · S", "a_g\\cdot S"), quantity("80%", "80\\%")]),
]);

add("7.9.6", "DETTAGLI COSTRUTTIVI PER ELEMENTI DI CALCESTRUZZO ARMATO", title("7.9.6", 275, 7, "7.9.6 DETTAGLI COSTRUTTIVI PER ELEMENTI DI CALCESTRUZZO ARMATO"), []);
add("7.9.6.1", "PILE", title("7.9.6.1", 275, 8, "7.9.6.1 PILE"), [
    p("7.9.6.1", "p1", 275, 9, 10),
    li("7.9.6.1", "a", 275, 11, 11),
    li("7.9.6.1", "b", 275, 12, 12),
    p("7.9.6.1", "p2", 275, 13, 16),
    li("7.9.6.1", "c", 275, 17, 17),
    li("7.9.6.1", "d", 275, 18, 18),
    li("7.9.6.1", "e", 275, 19, 19),
    p("7.9.6.1", "p3", 275, 20, 20),
]);
add("7.9.6.1.1", "Armature per il confinamento del nucleo di calcestruzzo", title("7.9.6.1.1", 275, 21, "7.9.6.1.1 Armature per il confinamento del nucleo di calcestruzzo"), [
    p("7.9.6.1.1", "p1", 275, 22, 22),
    li("7.9.6.1.1", "a", 275, 23, 23, "- se la sollecitazione di compressione normalizzata risulta ν_k ≤ 0,08;", [quantity("ν_k ≤ 0,08", "\\nu_k\\le0{,}08")]),
    li("7.9.6.1.1", "b", 275, 24, 24, "- nel caso di sezioni delle pile in parete sottile a doppio T o cave, mono o multicellulari, purché risulti ν_k ≤ 0,2;", [quantity("ν_k ≤ 0,2", "\\nu_k\\le0{,}2")]),
    li("7.9.6.1.1", "c", 275, 25, 27, "- nel caso di sezioni delle pile progettate in CD”A” o in CD”B” ove è possibile raggiungere una duttilità in curvatura non inferiore, rispettivamente, a μ_φ = 13 o a μ_φ = 7, senza che la deformazione di compressione massima nel calcestruzzo superi il valore 0,0035.", [quantity("μ_φ = 13", "\\mu_\\varphi=13"), quantity("μ_φ = 7", "\\mu_\\varphi=7"), quantity("0,0035", "0{,}0035")]),
    p("7.9.6.1.1", "p2", 275, 28, 29, "La percentuale meccanica minima di armatura trasversale per il confinamento costituita da tiranti o staffe di forma rettangolare ω_{wd,r} è data da:", [{ value: "ω_{wd,r}", latex: "\\omega_{wd,r}" }]),
    formulaBlock("7.9.6.1.1", f7915, 275, "7.9.15"),
    p("7.9.6.1.1", "p3", 275, 31, 31, "con:"),
    formulaBlock("7.9.6.1.1", f7916, 275, "7.9.16"),
    p("7.9.6.1.1", "p4", 275, 44, 44),
    li("7.9.6.1.1", "def-ac", 275, 45, 46, "A_c è l’area totale di calcestruzzo della sezione.", [{ value: "A_c", latex: "A_c" }]),
    li("7.9.6.1.1", "def-acc", 275, 47, 48, "A_cc è l’area del nucleo confinato della sezione.", [{ value: "A_cc", latex: "A_{cc}" }]),
    li("7.9.6.1.1", "def-nuk", 275, 49, 49, "ν_k è stato precedentemente definito.", [{ value: "ν_k", latex: "\\nu_k" }]),
    li("7.9.6.1.1", "def-alpha", 275, 50, 50, "α vale 0,37 per le pile progettate in CD”A” e 0,28 per le pile progettate in CD”B”.", [quantity("α", "\\alpha"), quantity("0,37", "0{,}37"), quantity("0,28", "0{,}28")]),
    li("7.9.6.1.1", "def-wmin", 275, 51, 51, "ω_{w,min} vale 0,18 per le pile progettate in CD”A” e 0,12 per le pile progettate in CD”B”.", [quantity("ω_{w,min}", "\\omega_{w,min}"), quantity("0,18", "0{,}18"), quantity("0,12", "0{,}12")]),
    li("7.9.6.1.1", "def-rhol", 275, 52, 52, "ρ_L è la percentuale geometrica di armatura longitudinale.", [{ value: "ρ_L", latex: "\\rho_L" }]),
    p("7.9.6.1.1", "p5", 275, 53, 53),
    formulaBlock("7.9.6.1.1", f7917, 275, "7.9.17"),
    p("7.9.6.1.1", "p6", 275, 55, 55),
    hblock("7.9.6.1.1", "subheading-rectangular", 275, 56, "sezioni rettangolari"),
    formulaBlock("7.9.6.1.1", f7918, 275, "7.9.18"),
    p("7.9.6.1.1", "p7", 275, 65, 65, "in cui:"),
    li("7.9.6.1.1", "def-asw", 275, 66, 67, "A_sw è l’area complessiva dei bracci delle staffe chiuse e dei tiranti in una direzione.", [{ value: "A_sw", latex: "A_{sw}" }]),
    li("7.9.6.1.1", "def-s", 275, 68, 68, "s è l’interasse verticale delle armature di confinamento = S_L.", [variable("s"), quantity("S_L", "S_L")]),
    li("7.9.6.1.1", "def-b", 276, 3, 4, "b è la dimensione nel piano orizzontale del nucleo confinato di calcestruzzo misurata in direzione ortogonale a quella dei bracci delle staffe.", [variable("b")]),
    hblock("7.9.6.1.1", "subheading-circular", 276, 5, "sezioni circolari"),
    formulaBlock("7.9.6.1.1", f7919, 276, "7.9.19"),
    p("7.9.6.1.1", "p9", 276, 16, 16, "in cui"),
    li("7.9.6.1.1", "def-asp", 276, 17, 18, "A_sp, D_sp = area della sezione delle barre circonferenziali e diametro della circonferenza;", [{ value: "A_sp", latex: "A_{sp}" }, { value: "D_sp", latex: "D_{sp}" }]),
    li("7.9.6.1.1", "def-s2", 276, 19, 19, "s è l’interasse verticale delle armature di confinamento = S_L.", [variable("s"), quantity("S_L", "S_L")]),
    p("7.9.6.1.1", "p10", 276, 20, 23, "Il passo dell’armatura trasversale di confinamento lungo l’asse verticale della pila S_L deve rispettare le seguenti condizioni:", [{ value: "S_L", latex: "S_L" }]),
    formulaBlock("7.9.6.1.1", f7920, 276, "7.9.20"),
    p("7.9.6.1.1", "p11", 276, 23, 23, "in cui d_bL è il diametro delle armature longitudinali e b* è la dimensione minore del nucleo confinato di calcestruzzo.", [quantity("d_bL", "d_{bL}"), quantity("b*", "b^*")]),
    p("7.9.6.1.1", "p12", 276, 24, 24, "In direzione trasversale la distanza S_T nel piano orizzontale tra due bracci di staffa rettangolare o tra due tiranti deve risultare:", [{ value: "S_T", latex: "S_T" }]),
    formulaBlock("7.9.6.1.1", f7921, 276, "7.9.21"),
    p("7.9.6.1.1", "p13", 276, 35, 36, undefined, [quantity("0,0035/2", "0{,}0035/2")]),
], [f7915, f7916, f7917, f7918, f7919, f7920, f7921]);
add("7.9.6.1.2", "Armature per contrastare l’instabilità delle barre verticali compresse", title("7.9.6.1.2", 276, 37, "7.9.6.1.2 Armature per contrastare l’instabilità delle barre verticali compresse"), [
    p("7.9.6.1.2", "p1", 276, 38, 38),
    p("7.9.6.1.2", "p2", 276, 39, 40, "Il passo dell’armatura trasversale per contrastare l’instabilità delle barre verticali compresse lungo l’asse verticale della pila S_L deve rispettare la seguente condizione:", [quantity("S_L", "S_L")]),
    formulaBlock("7.9.6.1.2", f7922, 276, "7.9.22"),
    p("7.9.6.1.2", "p3", 276, 42, 42),
    p("7.9.6.1.2", "p4", 276, 43, 43),
    li("7.9.6.1.2", "a", 276, 44, 45),
    li("7.9.6.1.2", "b", 276, 46, 47),
    p("7.9.6.1.2", "p5", 276, 48, 51, "In direzione trasversale la distanza S_T nel piano orizzontale tra due bracci di staffa o tiranti deve risultare inferiore o uguale a 200 mm. Il quantitativo minimo di tiranti o bracci trasversali necessari a limitare i fenomeni d’instabilità delle barre longitudinali lungo i bordi rettilinei è fornito dalla relazione seguente:", [quantity("S_T", "S_T"), quantity("200 mm", "200\\,\\mathrm{mm}")]),
    formulaBlock("7.9.6.1.2", f7923, 276, "7.9.23"),
    p("7.9.6.1.2", "p6", 276, 63, 63, "In cui:"),
    li("7.9.6.1.2", "p7", 276, 64, 67, "- A_T ed S_T sono rispettivamente l’area di un braccio di staffa o tirante (in mm²) e la distanza misurata in direzione trasversale fra i bracci dei tiranti (m).", [quantity("A_T", "A_T"), quantity("S_T", "S_T"), quantity("mm²", "\\mathrm{mm}^2"), quantity("(m)", "(\\mathrm{m})")]),
    li("7.9.6.1.2", "p8", 276, 68, 69, "- Σ A_s è la somma delle aree delle barre verticali (in mm²) di competenza di un braccio di staffa o tirante.", [quantity("Σ A_s", "\\sum A_s"), quantity("mm²", "\\mathrm{mm}^2")]),
    li("7.9.6.1.2", "p9", 276, 70, 71, "- f_{yk,s} e f_{yk,t} sono rispettivamente le tensioni di snervamento dell’acciaio dell’armatura verticale e delle staffe o tiranti.", [quantity("f_{yk,s}", "f_{yk,s}"), quantity("f_{yk,t}", "f_{yk,t}")]),
], [f7922, f7923]);
add("7.9.6.1.3", "Dettagli costruttivi per le zone dissipative", title("7.9.6.1.3", 276, 72, "7.9.6.1.3 Dettagli costruttivi per le zone dissipative"), [
    p("7.9.6.1.3", "p1", 276, 73, 74, "La lunghezza, misurata lungo l’asse verticale, della zona dissipativa di una pila progettata in CD”A” ove risulti ν_k ≤ 0,3 è pari alla maggiore delle due:", [{ value: "ν_k ≤ 0,3", latex: "\\nu_k\\le0{,}3" }]),
    li("7.9.6.1.3", "a", 276, 75, 75),
    li("7.9.6.1.3", "b", 276, 76, 78, "- la distanza tra la sezione di momento massimo e la sezione in cui il momento si riduce del 20%. Il diagramma dei momenti flettenti su cui computare il decremento del 20% è quello in cui il valore massimo del momento vale M_prc.", [quantity("20%", "20\\%"), quantity("M_prc", "M_{prc}")]),
    p("7.9.6.1.3", "p2a", 276, 79, 79, "Per 0,3 ≤ ν_k ≤ 0,6 tale valore deve essere incrementato del 50%.", [quantity("0,3 ≤ ν_k ≤ 0,6", "0{,}3\\le\\nu_k\\le0{,}6"), quantity("50%", "50\\%")]),
    p("7.9.6.1.3", "p2b", 276, 80, 81),
    p("7.9.6.1.3", "p3", 277, 3, 4, "La lunghezza, misurata lungo l’asse verticale, della zona dissipativa di una pila progettata in CD”B” è pari alla distanza tra la sezione di momento massimo e la sezione ove risulti M_Rd ≤ 1,3 M_Ed. Tale distanza può essere nulla.", [{ value: "M_Rd ≤ 1,3 M_Ed", latex: "M_{Rd}\\le1{,}3M_{Ed}" }]),
    p("7.9.6.1.3", "p4", 277, 5, 6, undefined, [quantity("135°", "135^\\circ")]),
    p("7.9.6.1.3", "p5", 277, 7, 7),
    p("7.9.6.1.3", "p6", 277, 8, 9, "Nel caso di sezioni ove risulti ν_k ≤ 0,30 è possibile impiegare tiranti con piegature a 135° su una estremità e a 90° sull’altra estremità, purché siano alternati i versi di posa.", [quantity("ν_k ≤ 0,30", "\\nu_k\\le0{,}30"), quantity("135°", "135^\\circ"), quantity("90°", "90^\\circ")]),
    p("7.9.6.1.3", "p7", 277, 10, 11, undefined, [quantity("135°", "135^\\circ")]),
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
    p("7.10.2", "p4", 277, 46, 49, "La sovrastruttura e la sottostruttura si devono mantenere in campo sostanzialmente elastico. Per questo la struttura può essere progettata con riferimento ai particolari costruttivi richiesti per le costruzioni caratterizzate, allo SLV, da a_g S ≤ 0,075g, con deroga, per le strutture in c.a., a quanto previsto al § 7.4.6 e al § 7.9.6.", [quantity("a_g S ≤ 0,075g", "a_gS\\le0{,}075g")]),
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
    p("7.10.4.2", "p3", 278, 23, 28, "Per evitare o limitare azioni di trazione nei dispositivi, gli interassi della maglia strutturale devono essere scelti in modo tale che il carico verticale “V” di progetto agente sul singolo isolatore sotto le azioni sismiche e quelle concomitanti risulti essere di compressione o, al più, nullo (V ≥ 0). Nel caso in cui dall’analisi risultasse V < 0, occorre che la tensione di trazione sia in modulo inferiore al minore tra 2G (G modulo di taglio del materiale elastomerico) e 1 MPa, negli isolatori elastomerici, oppure, per i dispositivi di altro tipo, dimostrare, attraverso adeguate prove sperimentali, che il dispositivo è in grado di sostenere tale condizione, oppure predisporre opportuni vincoli in grado di assorbire integralmente la trazione.", [quantity("V ≥ 0", "V\\ge0"), quantity("V < 0", "V<0"), quantity("2G", "2G"), quantity("1 MPa", "1\\,\\mathrm{MPa}"), variable("V"), variable("G")]),
]);
add("7.10.4.3", "CONTROLLO DEGLI SPOSTAMENTI SISMICI DIFFERENZIALI DEL TERRENO", title("7.10.4.3", 278, 29, "7.10.4.3 CONTROLLO DEGLI SPOSTAMENTI SISMICI DIFFERENZIALI DEL TERRENO"), [
    p("7.10.4.3", "p1", 278, 30, 33),
    p("7.10.4.3", "p2", 278, 34, 39, undefined, [quantity("1/20", "1/20")]),
]);
add("7.10.4.4", "CONTROLLO DEGLI SPOSTAMENTI RELATIVI AL TERRENO E ALLE COSTRUZIONI CIRCOSTANTI", title("7.10.4.4", 278, 40, "7.10.4.4 CONTROLLO DEGLI SPOSTAMENTI RELATIVI AL TERRENO E ALLE COSTRUZIONI CIRCOSTANTI"), [
    p("7.10.4.4", "p1", 278, 41, 44),
    p("7.10.4.4", "p2", 278, 45, 46),
]);
add("7.10.5", "MODELLAZIONE E ANALISI STRUTTURALE", title("7.10.5", 278, 47, "7.10.5 MODELLAZIONE E ANALISI STRUTTURALE"), []);
add("7.10.5.1", "PROPRIETÀ DEL SISTEMA DI ISOLAMENTO", title("7.10.5.1", 278, 48, "7.10.5.1 PROPRIETÀ DEL SISTEMA DI ISOLAMENTO"), [
    p("7.10.5.1", "p1", 278, 49, 51, "Le proprietà meccaniche del sistema di isolamento da adottare nelle analisi di progetto, derivanti dalla combinazione delle proprietà meccaniche dei singoli dispositivi che lo costituiscono, sono le più sfavorevoli che si possono verificare durante il periodo di riferimento V_R considerato. Esse devono tener conto, ove pertinente, di:", [quantity("V_R", "V_R")]),
    li("7.10.5.1", "a", 278, 52, 52),
    li("7.10.5.1", "b", 278, 53, 53),
    li("7.10.5.1", "c", 278, 54, 54, undefined, [quantity("±30%", "\\pm30\\%")]),
    li("7.10.5.1", "d", 278, 55, 55),
    li("7.10.5.1", "e", 279, 3, 3),
    li("7.10.5.1", "f", 279, 4, 4),
    p("7.10.5.1", "p2", 279, 5, 6),
    p("7.10.5.1", "p3", 279, 7, 9),
    p("7.10.5.1", "p4", 279, 10, 11, undefined, [quantity("20%", "20\\%")]),
]);
add("7.10.5.2", "MODELLAZIONE", title("7.10.5.2", 279, 12, "7.10.5.2 MODELLAZIONE"), [
    p("7.10.5.2", "p1", 279, 13, 17, "La sovrastruttura e la sottostruttura devono essere modellate come sistemi a comportamento elastico lineare aventi rigidezza corrispondente al comportamento strutturale non dissipativo. Il sistema di isolamento può essere modellato, in relazione alle sue caratteristiche meccaniche, come avente comportamento visco-elastico lineare oppure con legame costitutivo non lineare. La deformabilità verticale degli isolatori dovrà essere messa in conto quando il rapporto tra la rigidezza verticale del sistema di isolamento K_V e la rigidezza equivalente orizzontale K_esi è inferiore a 800.", [quantity("K_V", "K_V"), quantity("K_esi", "K_{esi}"), quantity("800", "800")]),
    p("7.10.5.2", "p2", 279, 18, 26, "Se è utilizzato un modello lineare, si deve adottare una rigidezza equivalente riferita allo spostamento totale di progetto per lo stato limite in esame di ciascun dispositivo facente parte del sistema di isolamento. La rigidezza totale equivalente del sistema di isolamento, K_esi, è pari alla somma delle rigidezze equivalenti dei singoli dispositivi. L’energia dissipata dal sistema d’isolamento deve essere espressa in termini di coefficiente di smorzamento viscoso equivalente del sistema d’isolamento ξ_esi, valutato con riferimento all’energia dissipata dal sistema di isolamento in cicli con frequenza nell’intervallo delle frequenze naturali dei modi considerati. Per i modi superiori della struttura, al di fuori di tale intervallo, il rapporto di smorzamento del modello completo deve essere quello della sovrastruttura nella condizione di base fissa.", [quantity("K_esi", "K_{esi}"), quantity("ξ_esi", "\\xi_{esi}")]),
    p("7.10.5.2", "p3", 279, 27, 29, undefined, [quantity("5%", "5\\%")]),
    p("7.10.5.2", "p4", 279, 30, 31),
    li("7.10.5.2", "a", 279, 32, 33, undefined, [quantity("50%", "50\\%"), quantity("20%", "20\\%")]),
    li("7.10.5.2", "b", 279, 34, 34, undefined, [quantity("30%", "30\\%")]),
    li("7.10.5.2", "c", 279, 35, 37, undefined, [quantity("10%", "10\\%"), quantity("±30%", "\\pm30\\%")]),
    li("7.10.5.2", "d", 279, 38, 41, "d) l’incremento della forza nel sistema d’isolamento per spostamenti tra 0,5 d_dc e d_dc, essendo d_dc lo spostamento del centro di rigidezza dovuto all’azione sismica, è almeno pari al 2,5% del peso totale della sovrastruttura.", [quantity("0,5 d_dc", "0{,}5d_{dc}"), quantity("d_dc", "d_{dc}"), quantity("2,5%", "2{,}5\\%")]),
    p("7.10.5.2", "p5", 279, 42, 44),
    p("7.10.5.2", "p6", 279, 45, 46),
]);
add("7.10.5.3", "ANALISI", title("7.10.5.3", 279, 47, "7.10.5.3 ANALISI"), [
    p("7.10.5.3", "p1", 279, 48, 49),
]);
add("7.10.5.3.1", "Analisi lineare statica", title("7.10.5.3.1", 279, 50, "7.10.5.3.1 Analisi lineare statica"), [
    p("7.10.5.3.1", "p1", 279, 51, 52),
    li("7.10.5.3.1", "a", 279, 53, 53),
    li("7.10.5.3.1", "b", 279, 54, 56, "b) il periodo equivalente T_is della costruzione isolata ha un valore compreso fra 3 · T_bf e 3,0 s, in cui T_bf è il periodo della sovrastruttura assunta a base fissa, stimato con un’espressione approssimata;", [quantity("T_is", "T_{is}"), quantity("3 · T_bf", "3\\cdot T_{bf}"), quantity("3,0 s", "3{,}0\\,\\mathrm{s}"), quantity("T_bf", "T_{bf}")]),
    li("7.10.5.3.1", "c", 279, 57, 60, "c) la rigidezza verticale del sistema di isolamento K_V è almeno 800 volte più grande della rigidezza equivalente orizzontale del sistema di isolamento K_esi;", [quantity("K_V", "K_V"), quantity("800", "800"), quantity("K_esi", "K_{esi}")]),
    li("7.10.5.3.1", "d", 279, 61, 61, "d) il periodo in direzione verticale T_V, calcolato come T_V = 2π√(M/K_V), è inferiore a 0,1 s;", [quantity("T_V = 2π√(M/K_V)", "T_V=2\\pi\\sqrt{M/K_V}"), quantity("T_V", "T_V"), quantity("0,1 s", "0{,}1\\,\\mathrm{s}")]),
    li("7.10.5.3.1", "e", 279, 62, 62),
    li("7.10.5.3.1", "f", 280, 3, 3),
    p("7.10.5.3.1", "p2", 280, 4, 4),
    li("7.10.5.3.1", "g", 280, 5, 5, "– la sovrastruttura ha altezza non maggiore di 20 m e non più di 5 piani", [quantity("20 m", "20\\,\\mathrm{m}"), quantity("5", "5")]),
    li("7.10.5.3.1", "h", 280, 6, 6, "– la sottostruttura può essere considerata infinitamente rigida, per cui il suo periodo proprio è non maggiore di 0,05s.", [quantity("0,05s", "0{,}05\\,\\mathrm{s}")]),
    li("7.10.5.3.1", "i", 280, 7, 7, "– la dimensione maggiore in pianta della sovrastruttura è inferiore a 50 m;", [quantity("50 m", "50\\,\\mathrm{m}")]),
    li("7.10.5.3.1", "i2", 280, 8, 10, "– in ciascuna delle direzioni principali orizzontali, l’eccentricità totale tra il centro di rigidezza del sistema di isolamento e la proiezione verticale del centro di massa non è superiore al 3% della dimensione della sovrastruttura trasversale alla direzione orizzontale considerata.", [quantity("3%", "3\\%")]),
    p("7.10.5.3.1", "p3", 280, 11, 11),
    li("7.10.5.3.1", "j", 280, 12, 14, undefined, [quantity("2", "2"), quantity("150 m", "150\\,\\mathrm{m}")]),
    li("7.10.5.3.1", "k", 280, 15, 15, undefined, [quantity("1/5", "1/5")]),
    li("7.10.5.3.1", "l", 280, 16, 16, undefined, [quantity("20 m", "20\\,\\mathrm{m}")]),
    li("7.10.5.3.1", "m", 280, 17, 18, undefined, [quantity("5%", "5\\%")]),
    p("7.10.5.3.1", "p4", 280, 19, 21),
    p("7.10.5.3.1", "p5", 280, 22, 23),
    formulaBlock("7.10.5.3.1", f7101, 280, "7.10.1"),
    p("7.10.5.3.1", "p6", 280, 26, 30, "dove S_e(T_is, ξ_esi) è l’accelerazione spettrale definita nel § 3.2.3 per la categoria di suolo di fondazione appropriata e K_esi,min,min è la rigidezza equivalente minima in relazione alla variabilità delle proprietà meccaniche del sistema di isolamento, per effetto dei fattori definiti nel § 7.10.5.1.", [quantity("S_e(T_is, ξ_esi)", "S_e(T_{is},\\xi_{esi})"), quantity("K_esi,min", "K_{esi,min}")]),
    p("7.10.5.3.1", "p7", 280, 31, 33, "Lo spostamento del centro di rigidezza dovuto all’azione sismica d_dc deve essere calcolato, in ciascuna direzione orizzontale, mediante la seguente espressione:", [quantity("d_dc", "d_{dc}")]),
    formulaBlock("7.10.5.3.1", f7102, 280, "7.10.2"),
    p("7.10.5.3.1", "p8", 280, 39, 40),
    formulaBlock("7.10.5.3.1", f7103, 280, "7.10.3"),
    p("7.10.5.3.1", "p9a", 280, 42, 42, "in cui m_j è la massa del livello j-esimo.", [quantity("m_j", "m_j")]),
    p("7.10.5.3.1", "p9b", 280, 43, 45, "Gli effetti della torsione d’insieme della sovrastruttura sui singoli dispositivi di isolamento possono essere messi in conto amplificando in ciascuna direzione gli spostamenti e le forze precedentemente definiti mediante i fattori δ_xi e δ_yi da applicare, rispettivamente, alle azioni in direzione x e y:", [quantity("δ_xi", "\\delta_{xi}"), quantity("δ_yi", "\\delta_{yi}"), variable("x"), variable("y")]),
    formulaBlock("7.10.5.3.1", f7104, 280, "7.10.4"),
    p("7.10.5.3.1", "p10a", 280, 59, 59, "in cui:"),
    p("7.10.5.3.1", "p10b", 280, 60, 62, "(x_i, x_i) sono le coordinate del dispositivo rispetto al centro di rigidezza;", [quantity("(x_i, x_i)", "(x_i,x_i)")]),
    p("7.10.5.3.1", "p10c", 280, 63, 65, "e_tot,x e_tot,y è l’eccentricità totale nella direzione x, y;", [quantity("e_tot,x", "e_{tot,x}"), quantity("e_tot,y", "e_{tot,y}"), variable("x"), variable("y")]),
    p("7.10.5.3.1", "p10d", 280, 66, 66, "r_x r_y sono le componenti, in direzione x e y del raggio torsionale del sistema di isolamento, date dalle seguenti espressioni:", [quantity("r_x", "r_x"), quantity("r_y", "r_y"), variable("x"), variable("y")]),
    formulaBlock("7.10.5.3.1", f7105, 280, "7.10.5"),
    p("7.10.5.3.1", "p11a", 280, 82, 85, "K_xi, K_xi sono le rigidezze equivalenti del dispositivo i-esimo rispettivamente nelle direzioni x e y.", [quantity("K_xi", "K_{xi}"), variable("x"), variable("y")]),
    p("7.10.5.3.1", "p11b", 280, 86, 86),
], [f7101, f7102, f7103, f7104, f7105]);
units.at(-1)!.workflow.openIssues.push(
    {
        issueId: "ntc2018-7-10-5-3-1-source-anomaly-k-esi-min",
        type: "other",
        severity: "warning",
        note: "La fonte ufficiale stampa K_esi,min seguito da un ulteriore ‘,min’ nella definizione dopo la formula [7.10.1]; il possibile refuso è conservato nel testo normalizzato e richiede decisione editoriale umana.",
    },
    {
        issueId: "ntc2018-7-10-5-3-1-source-anomaly-d-de",
        type: "other",
        severity: "warning",
        note: "La frase introduttiva della formula [7.10.2] usa d_dc, mentre la formula ufficiale stampa chiaramente d_de; entrambe le grafie sono conservate e l’incoerenza richiede decisione editoriale umana.",
    },
    {
        issueId: "ntc2018-7-10-5-3-1-source-anomaly-duplicated-x",
        type: "other",
        severity: "warning",
        note: "Le definizioni sotto [7.10.4]–[7.10.5] stampano (x_i, x_i) e K_xi, K_xi, mentre le formule usano anche y_i e K_yi; le duplicazioni sono conservate come possibili refusi della fonte e richiedono decisione editoriale umana.",
    },
);
add("7.10.5.3.2", "Analisi lineare dinamica", title("7.10.5.3.2", 280, 87, "7.10.5.3.2 Analisi lineare dinamica"), [
    mp("7.10.5.3.2", "p1", [part(280, 88, 89), part(281, 3, 8)], "Per le costruzioni con isolamento alla base l’analisi dinamica lineare è ammessa quando risulta possibile modellare elasticamente il comportamento del sistema di isolamento, nel rispetto delle condizioni di cui al § 7.10.5.2. Per il sistema complessivo, formato dalla sottostruttura, dal sistema d’isolamento e dalla sovrastruttura, si assume un comportamento elastico lineare. Qualora il sistema di isolamento non sia immediatamente al di sopra delle fondazioni, il modello deve comprendere sia la sovrastruttura sia la sottostruttura, a meno che la sottostruttura non sia assimilabile ad una struttura scatolare rigida come definita al § 7.2.1. L’analisi può essere svolta mediante analisi modale con spettro di risposta o mediante integrazione al passo delle equazioni del moto, eventualmente previo disaccoppiamento modale, considerando un numero di modi tale da portare in conto anche un’aliquota significativa della massa della sottostruttura, se inclusa nel modello."),
    p("7.10.5.3.2", "p2a", 281, 9, 15, "Nel caso si adotti l’analisi modale con spettro di risposta, questa deve essere svolta secondo quanto specificato in § 7.3.3.1, salvo diverse indicazioni fornite nel presente paragrafo. Le due componenti orizzontali dell’azione sismica si considerano in generale agenti simultaneamente, adottando, ai fini della combinazione degli effetti, le regole riportate in § 7.3.3.1. La componente verticale deve essere messa in conto nei casi previsti in § 7.2.2 e, in ogni caso, quando il rapporto tra la rigidezza verticale del sistema di isolamento K_V e la rigidezza equivalente orizzontale K_esi risulti inferiore a 800. In tali casi si avrà cura che la massa eccitata dai modi in direzione verticale considerati nell’analisi sia significativa.", [quantity("K_V", "K_V"), quantity("K_esi", "K_{esi}"), quantity("800", "800")]),
    p("7.10.5.3.2", "p2b", 281, 16, 18, "Lo spettro elastico definito in § 3.2.3.2 va ridotto per tutto il campo di periodi T ≥ 0,8 T_is, assumendo per il coefficiente riduttivo η il valore corrispondente al coefficiente di smorzamento viscoso equivalente ξ_esi del sistema di isolamento.", [quantity("T ≥ 0,8 T_is", "T\\ge0{,}8T_{is}"), quantity("η", "\\eta"), quantity("ξ_esi", "\\xi_{esi}")]),
    p("7.10.5.3.2", "p3", 281, 19, 22, "Nel caso di analisi lineare con integrazione al passo, la messa in conto del corretto valore del coefficiente di smorzamento viscoso equivalente ξ si ottiene, quando si opera sulle singole equazioni modali disaccoppiate, assegnando a ciascuna equazione il corrispondente valore modale di ξ o, quando si opera sul sistema completo, definendo in maniera appropriata la matrice di smorzamento del sistema.", [quantity("ξ", "\\xi")]),
]);
add("7.10.6", "VERIFICHE", title("7.10.6", 281, 23, "7.10.6 VERIFICHE"), []);
add("7.10.6.1", "VERIFICHE DEGLI STATI LIMITE DI ESERCIZIO", title("7.10.6.1", 281, 24, "7.10.6.1 VERIFICHE DEGLI STATI LIMITE DI ESERCIZIO"), [
    p("7.10.6.1", "p1", 281, 25, 26),
    p("7.10.6.1", "p2", 281, 27, 28, undefined, [quantity("2/3", "2/3")]),
    p("7.10.6.1", "p3", 281, 29, 32),
    p("7.10.6.1", "p4", 281, 33, 35),
]);
add("7.10.6.2", "VERIFICHE DEGLI STATI LIMITE ULTIMI", title("7.10.6.2", 281, 36, "7.10.6.2 VERIFICHE DEGLI STATI LIMITE ULTIMI"), [
    p("7.10.6.2", "p1", 281, 37, 38),
]);
add("7.10.6.2.1", "Verifiche dello SLV", title("7.10.6.2.1", 281, 39, "7.10.6.2.1 Verifiche dello SLV"), [
    p("7.10.6.2.1", "p1a", 281, 40, 41, "La capacità della sottostruttura e della sovrastruttura deve essere valutata adottando i valori di γ_M utilizzati per le costruzioni non isolate.", [quantity("γ_M", "\\gamma_M")]),
    p("7.10.6.2.1", "p1b", 281, 42, 50, "Gli elementi della sottostruttura devono essere verificati rispetto alle sollecitazioni ottenute direttamente dall’analisi quando il modello include anche la sottostruttura. In caso contrario, essi devono essere verificati rispetto alle sollecitazioni prodotte dalle forze trasmesse dal sistema d’isolamento combinate con le sollecitazioni prodotte dalle accelerazioni di risposta direttamente applicate alla sottostruttura. Nel caso in cui la sottostruttura possa essere assunta infinitamente rigida (periodo proprio inferiore a 0,05s) le forze d’inerzia direttamente applicate ad essa possono essere assunte pari al prodotto delle masse della sottostruttura per l’accelerazione del terreno a_g S. La combinazione delle sollecitazioni deve essere eseguita adottando le regole riportate in § 7.3.5, tenendo in conto gli effetti pseudo-statici indotti dagli spostamenti relativi prodotti dalla variabilità spaziale del moto unicamente nei casi previsti ai §§ 3.2.4.1 e 3.2.4.2.", [quantity("0,05s", "0{,}05\\,\\mathrm{s}"), quantity("a_g S", "a_gS")]),
    p("7.10.6.2.1", "p2", 281, 51, 53, "La domanda sugli elementi strutturali della sovrastruttura e della sottostruttura e sul terreno deve essere valutata, nel caso di analisi lineare, considerando un fattore di comportamento q ≤ 1,50 nel caso degli edifici e q = 1 nel caso dei ponti ed adottando le regole di combinazione di cui al § 2.5.3.", [quantity("q ≤ 1,50", "q\\le1{,}50"), quantity("q = 1", "q=1")]),
    p("7.10.6.2.1", "p3", 281, 54, 59, undefined, [quantity("1,5", "1{,}5")]),
    p("7.10.6.2.1", "p4", 282, 3, 4),
]);
add("7.10.6.2.2", "Verifiche dello SLC", title("7.10.6.2.2", 282, 5, "7.10.6.2.2 Verifiche dello SLC"), [
    p("7.10.6.2.2", "p1", 282, 6, 9, "I dispositivi del sistema d’isolamento devono essere in grado di sostenere, senza rotture, gli spostamenti d_2, valutati per una azione sismica riferita allo SLC. Nel caso di sistemi a comportamento non lineare, allo spostamento ottenuto con l’azione sismica detta occorre aggiungere il maggiore tra lo spostamento residuo allo SLD e il 50% dello spostamento corrispondente all’annullamento della forza, seguendo il ramo di scarico a partire dal punto di massimo spostamento raggiunto allo SLD.", [quantity("d_2", "d_2"), quantity("50%", "50\\%")]),
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
    p("7.11.1", "p1", 283, 4, 5),
    p("7.11.1", "p2", 283, 6, 7),
    p("7.11.1", "p3", 283, 8, 10, "Le verifiche degli stati limite ultimi in presenza di azioni sismiche devono essere eseguite ponendo pari a 1 i coefficienti parziali sulle azioni e sui parametri geotecnici e impiegando le resistenze di progetto, con i coefficienti parziali γ_R indicati nel presente Capitolo 7, oppure con i γ_R indicati nel Capitolo 6 laddove non espressamente specificato.", [quantity("1", "1"), quantity("γ_R", "\\gamma_R")]),
]);
add("7.11.2", "CARATTERIZZAZIONE GEOTECNICA AI FINI SISMICI", title("7.11.2", 283, 11, "7.11.2 CARATTERIZZAZIONE GEOTECNICA AI FINI SISMICI"), [
    p("7.11.2", "p1", 283, 12, 13),
    p("7.11.2", "p1b", 283, 14, 16),
    p("7.11.2", "p2", 283, 17, 18),
    p("7.11.2", "p3", 283, 19, 22),
    p("7.11.2", "p4", 283, 23, 24),
    p("7.11.2", "p5", 283, 25, 27),
    p("7.11.2", "p6", 283, 28, 29, "Nei terreni saturi si assumono generalmente condizioni di drenaggio impedito. In tal caso, nelle analisi condotte in termini di tensioni efficaci, la resistenza al taglio è esprimibile mediante la relazione"),
    formulaBlock("7.11.2", f7111, 283, "7.11.1"),
    p("7.11.2", "p7", 283, 31, 32, "Dove σ'_n è la tensione efficace iniziale normale alla giacitura di rottura, Δu è l’eventuale sovrappressione interstiziale generata dal sisma e i parametri c’ e φ’ tengono conto della degradazione dei terreni per effetto della storia ciclica di sollecitazione.", [quantity("σ'_n", "\\sigma'_n"), quantity("Δu", "\\Delta u"), quantity("c’", "c'"), quantity("φ’", "\\phi'")]),
    p("7.11.2", "p8", 283, 33, 34, "Nei terreni a grana fina, le analisi possono essere condotte in termini di tensioni totali esprimendo la resistenza al taglio mediante la resistenza non drenata, valutata in condizioni di sollecitazione ciclica"),
    formulaBlock("7.11.2", f7112, 283, "7.11.2"),
    p("7.11.2", "p9", 283, 36, 36, "dove c_{u,c} include gli effetti di degradazione dei terreni.", [quantity("c_{u,c}", "c_{u,c}")]),
], [f7111, f7112]);
add("7.11.3", "RISPOSTA SISMICA E STABILITÀ DEL SITO", title("7.11.3", 283, 37, "7.11.3 RISPOSTA SISMICA E STABILITÀ DEL SITO"), []);
add("7.11.3.1", "RISPOSTA SISMICA LOCALE", title("7.11.3.1", 283, 38, "7.11.3.1 RISPOSTA SISMICA LOCALE"), [
    p("7.11.3.1", "p1", 283, 39, 42),
    p("7.11.3.1", "p2", 283, 43, 44),
    p("7.11.3.1", "p3", 283, 45, 47),
]);
add("7.11.3.2", "FATTORI DI AMPLIFICAZIONE STRATIGRAFICA", title("7.11.3.2", 283, 48, "7.11.3.2 FATTORI DI AMPLIFICAZIONE STRATIGRAFICA"), [
    p("7.11.3.2", "p1", 283, 49, 53, "In condizioni stratigrafiche e morfologiche schematizzabili con un modello mono-dimensionale e per profili stratigrafici riconducibili alle categorie di cui alla Tab. 3.2.II, il moto sismico alla superficie di un sito è definibile mediante l’accelerazione massima a_max attesa in superficie ed una forma spettrale ancorata ad essa. Il valore di a_max può essere ricavato dalla relazione a_max = S_S · a_g dove a_g è l’accelerazione massima su sito di riferimento rigido ed S_S è il coefficiente di amplificazione stratigrafica.", [quantity("a_max = S_S · a_g", "a_{max}=S_S\\cdot a_g"), quantity("a_max", "a_{max}"), quantity("a_g", "a_g"), quantity("S_S", "S_S")]),
]);

add("7.11.3.3", "FATTORI DI AMPLIFICAZIONE TOPOGRAFICA", title("7.11.3.3", 284, 3, "7.11.3.3 FATTORI DI AMPLIFICAZIONE TOPOGRAFICA"), [
    p("7.11.3.3", "p1", 284, 4, 8, "Per condizioni topografiche riconducibili alle categorie di cui alla Tab. 3.2.III, la valutazione dell’amplificazione topografica può essere effettuata utilizzando il coefficiente di amplificazione topografica S_T. Il parametro S_T deve essere applicato nel caso di configurazioni geometriche prevalentemente bidimensionali, creste o dorsali allungate, di altezza superiore a 30 m. Gli effetti topografici possono essere trascurati per pendii con inclinazione media inferiore a 15°, altrimenti si applicano i criteri indicati nel § 3.2.2.", [quantity("S_T", "S_T"), quantity("30 m", "30\\,\\mathrm{m}"), quantity("15°", "15^\\circ")]),
]);
add("7.11.3.4", "STABILITÀ NEI CONFRONTI DELLA LIQUEFAZIONE", title("7.11.3.4", 284, 9, "7.11.3.4 STABILITÀ NEI CONFRONTI DELLA LIQUEFAZIONE"), []);
add("7.11.3.4.1", "Generalità", title("7.11.3.4.1", 284, 10, "7.11.3.4.1 Generalità"), [
    p("7.11.3.4.1", "p1", 284, 11, 13),
    p("7.11.3.4.1", "p2", 284, 14, 16),
    p("7.11.3.4.1", "p3", 284, 17, 18),
]);
add("7.11.3.4.2", "Esclusione della verifica a liquefazione", title("7.11.3.4.2", 284, 19, "7.11.3.4.2 Esclusione della verifica a liquefazione"), [
    p("7.11.3.4.2", "p1", 284, 20),
    li("7.11.3.4.2", "1", 284, 21, undefined, undefined, [quantity("0,1g", "0{,}1g")]),
    li("7.11.3.4.2", "2", 284, 22, 23, undefined, [quantity("15 m", "15\\,\\mathrm{m}")]),
    li("7.11.3.4.2", "3", 284, 24, 27, "3. depositi costituiti da sabbie pulite con resistenza penetrometrica normalizzata (N_1)_{60} > 30 oppure q_{c1N} > 180 dove (N_1)_{60} è il valore della resistenza determinata in prove penetrometriche dinamiche (Standard Penetration Test) normalizzata ad una tensione efficace verticale di 100 kPa e q_{c1N} è il valore della resistenza determinata in prove penetrometriche statiche (Cone Penetration Test) normalizzata ad una tensione efficace verticale di 100 kPa;", [quantity("(N_1)_{60} > 30", "(N_1)_{60}>30"), quantity("q_{c1N} > 180", "q_{c1N}>180"), quantity("(N_1)_{60}", "(N_1)_{60}"), quantity("q_{c1N}", "q_{c1N}"), quantity("100 kPa", "100\\,\\mathrm{kPa}")]),
    li("7.11.3.4.2", "4", 284, 28, 29, "4. distribuzione granulometrica esterna alle zone indicate nella Fig. 7.11.1(a) nel caso di terreni con coefficiente di uniformità U_C < 3,5 e in Fig. 7.11.1(b) nel caso di terreni con coefficiente di uniformità U_C > 3,5.", [quantity("U_C < 3,5", "U_C<3{,}5"), quantity("U_C > 3,5", "U_C>3{,}5")]),
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
    p("7.11.3.5.1", "p1", 285, 21, 22),
    p("7.11.3.5.1", "p2", 285, 23, 26, undefined, [quantity("15°", "15^\\circ"), quantity("30 m", "30\\,\\mathrm{m}")]),
    p("7.11.3.5.1", "p3", 285, 27, 29, "In generale l’amplificazione tende a decrescere sotto la superficie del pendio. Pertanto, gli effetti topografici tendono a essere massimi lungo le creste di dorsali e rilievi, ma si riducono sensibilmente in frane con superfici di scorrimento profonde. In tali situazioni, nelle analisi pseudostatiche gli effetti di amplificazione topografica possono essere trascurati (S_T = 1).", [quantity("S_T = 1", "S_T=1")]),
]);
add("7.11.3.5.2", "Metodi di analisi", title("7.11.3.5.2", 285, 30, "7.11.3.5.2 Metodi di analisi"), [
    p("7.11.3.5.2", "p1a", 285, 31, 32),
    p("7.11.3.5.2", "p1b", 285, 33, 41, "Nelle analisi, si deve tenere conto dei comportamenti di tipo fragile, che si manifestano nei terreni a grana fina sovraconsolidati e nei terreni a grana grossa addensati con una riduzione della resistenza al taglio al crescere delle deformazioni. Inoltre, si deve tener conto dei possibili incrementi di pressione interstiziale indotti in condizioni sismiche nei terreni saturi. Nei metodi pseudostatici l’azione sismica è rappresentata da un’azione statica equivalente, costante nello spazio e nel tempo, proporzionale al peso W del volume di terreno potenzialmente instabile. Tale forza dipende dalle caratteristiche del moto sismico atteso nel volume di terreno potenzialmente instabile e dalla capacità di tale volume di subire spostamenti senza significative riduzioni di resistenza. Nelle verifiche allo stato limite ultimo, in mancanza di studi specifici, le componenti orizzontale e verticale di tale forza possono esprimersi come F_h = k_h · W ed F_v = k_v · W, con k_h e k_v rispettivamente pari ai coefficienti sismici orizzontale e verticale:", [variable("W"), quantity("F_h = k_h · W", "F_h=k_h\\cdot W"), quantity("F_v = k_v · W", "F_v=k_v\\cdot W"), quantity("k_h", "k_h"), quantity("k_v", "k_v")]),
    formulaBlock("7.11.3.5.2", f7113, 285, "7.11.3"),
    formulaBlock("7.11.3.5.2", f7114, 285, "7.11.4"),
    p("7.11.3.5.2", "p2", 285, 47, 50, "dove β_s = coefficiente di riduzione dell’accelerazione massima attesa al sito; a_max = accelerazione orizzontale massima attesa al sito; g = accelerazione di gravità.", [quantity("β_s", "\\beta_s"), quantity("a_max", "a_{max}"), variable("g")]),
    p("7.11.3.5.2", "p3", 285, 51, 52),
    formulaBlock("7.11.3.5.2", f7115, 285, "7.11.5"),
    p("7.11.3.5.2", "p4", 285, 54, 59, "dove S = coefficiente che comprende l’effetto dell’amplificazione stratigrafica (S_S) e dell’amplificazione topografica (S_T), di cui al § 3.2.3.2; a_g = accelerazione orizzontale massima attesa su sito di riferimento rigido.", [variable("S"), quantity("S_S", "S_S"), quantity("S_T", "S_T"), quantity("a_g", "a_g")]),
    p("7.11.3.5.2", "p5a", 286, 3, 4, "I valori di β_s sono riportati nella Tab. 7.11.I al variare della categoria di sottosuolo e dell’accelerazione orizzontale massima attesa su sito di riferimento rigido.", [quantity("β_s", "\\beta_s")]),
    p("7.11.3.5.2", "p5b", 286, 5, 7),
    p("7.11.3.5.2", "p5c", 286, 8, 10, "In terreni saturi e in siti con accelerazione orizzontale massima attesa a_max > 0,15 · g, nell’analisi statica delle condizioni successive al sisma si deve tenere conto della possibile riduzione della resistenza al taglio per incremento delle pressioni interstiziali o per decadimento delle caratteristiche di resistenza indotti dalle azioni sismiche.", [quantity("a_max > 0,15 · g", "a_{max}>0{,}15\\cdot g")]),
    p("7.11.3.5.2", "p5d", 286, 11, 14),
    tableBlock("7.11.3.5.2", "7.11.i", 286, "7.11.I"),
    p("7.11.3.5.2", "p6a", 286, 24, 27),
    p("7.11.3.5.2", "p6b", 286, 28, 32, undefined, [quantity("7", "7")]),
    p("7.11.3.5.2", "p6c", 286, 33, 37),
    p("7.11.3.5.2", "p6d", 286, 38, 42),
], [f7113, f7114, f7115], ["7.11.i"]);
add("7.11.4", "FRONTI DI SCAVO E RILEVATI", title("7.11.4", 286, 43, "7.11.4 FRONTI DI SCAVO E RILEVATI"), [
    p("7.11.4", "p1a", 286, 44, 45),
    p("7.11.4", "p1b", 286, 46, 49, undefined, [variable("W")]),
    p("7.11.4", "p1c", 286, 50, 52, "In mancanza di studi specifici, le componenti orizzontale e verticale della forza statica equivalente possono esprimersi come F_h = k_h · W ed F_v = k_v · W, con k_h e k_v rispettivamente pari ai coefficienti sismici orizzontale e verticale definiti nel § 7.11.3.5.2 e adottando i seguenti valori del coefficiente di riduzione dell’accelerazione massima attesa al sito:", [quantity("F_h = k_h · W", "F_h=k_h\\cdot W"), quantity("F_v = k_v · W", "F_v=k_v\\cdot W"), quantity("k_h", "k_h"), quantity("k_v", "k_v")]),
    formulaBlock("7.11.4", f7114u, 286, null),
    p("7.11.4", "p1d", 286, 55, 58, "Nelle verifiche di sicurezza si deve controllare che la resistenza del sistema sia maggiore delle azioni (condizione [6.2.1]) impiegando lo stesso approccio di cui al § 6.8.2 per le opere di materiali sciolti e fronti di scavo, ponendo pari all’unità i coefficienti parziali sulle azioni e sui parametri geotecnici (§ 7.11.1) e impiegando le resistenze di progetto calcolate con un coefficiente parziale pari a γ_R = 1.2. Si deve inoltre tener conto della presenza di manufatti interagenti con l’opera.", [quantity("γ_R = 1.2", "\\gamma_R=1.2")]),
    p("7.11.4", "p2", 287, 3, 10),
], [f7114u]);
add("7.11.5", "FONDAZIONI", title("7.11.5", 287, 11, "7.11.5 FONDAZIONI"), []);
add("7.11.5.1", "REGOLE GENERALI DI PROGETTAZIONE", title("7.11.5.1", 287, 12, "7.11.5.1 REGOLE GENERALI DI PROGETTAZIONE"), [
    p("7.11.5.1", "p1", 287, 13, 14),
    li("7.11.5.1", "1", 287, 15),
    li("7.11.5.1", "2", 287, 16, 17),
    p("7.11.5.1", "p2", 287, 18, 19),
    p("7.11.5.1", "p3", 287, 20, 21),
]);
add("7.11.5.2", "INDAGINI E MODELLO GEOTECNICO", title("7.11.5.2", 287, 22, "7.11.5.2 INDAGINI E MODELLO GEOTECNICO"), [
    p("7.11.5.2", "p1", 287, 23, 25),
]);
add("7.11.5.3", "VERIFICHE ALLO STATO LIMITE ULTIMO (SLV) E ALLO STATO LIMITE DI ESERCIZIO (SLD)", title("7.11.5.3", 287, 26, "7.11.5.3 VERIFICHE ALLO STATO LIMITE ULTIMO (SLV) E ALLO STATO LIMITE DI ESERCIZIO (SLD)"), [
    p("7.11.5.3", "p1", 287, 27, 30),
    p("7.11.5.3", "p2", 287, 31, 32),
]);
add("7.11.5.3.1", "Fondazioni superficiali", title("7.11.5.3.1", 287, 33, "7.11.5.3.1 Fondazioni superficiali"), [
    p("7.11.5.3.1", "p1", 287, 34, 38),
    hblock("7.11.5.3.1", "h-slu-carico-limite", 287, 39, "Stato Limite Ultimo (SLV) per carico limite"),
    p("7.11.5.3.1", "p2", 287, 40, 45, "Le azioni derivano dall’analisi della struttura in elevazione come specificato al § 7.2.5. Le resistenze sono i corrispondenti valori limite che producono il collasso del complesso fondazione-terreno; esse sono valutabili mediante l’estensione di procedure classiche al caso di azione sismica, tenendo conto dell’effetto dell’inclinazione e dell’eccentricità delle azioni in fondazione. Il corrispondente valore di progetto si ottiene applicando il coefficiente γ_R di Tabella 7.11.II. Se, nel calcolo del carico limite, si considera esplicitamente l’effetto delle azioni inerziali sul volume di terreno significativo, il coefficiente γ_R può essere ridotto a 1.8.", [quantity("γ_R", "\\gamma_R"), quantity("1.8", "1.8")]),
    hblock("7.11.5.3.1", "h-slu-scorrimento", 287, 46, "Stato Limite Ultimo (SLV) per scorrimento sul piano di posa"),
    p("7.11.5.3.1", "p3", 287, 47, 54, "Per azione si intende il valore della forza agente parallelamente al piano di scorrimento, per resistenza si intende la risultante delle tensioni tangenziali limite sullo stesso piano, sommata, in casi particolari, alla risultante delle tensioni limite agenti sulle superfici laterali della fondazione. Specificamente, si può tener conto della resistenza lungo le superfici laterali nel caso di contatto diretto fondazione-terreno in scavi a sezione obbligata o di contatto diretto fondazione-calcestruzzo o fondazione-acciaio in scavi sostenuti da paratie o palancole. In tali casi, il progettista deve indicare l’aliquota della resistenza lungo le superfici laterali che intende portare in conto, da giustificare con considerazioni relative alle caratteristiche meccaniche dei terreni e ai criteri costruttivi dell’opera. Ai fini della verifica allo scorrimento, si può considerare la resistenza passiva solo nel caso di effettiva permanenza di tale contributo, portando in conto un’aliquota non superiore al 50%.", [quantity("50%", "50\\%")]),
    tableBlock("7.11.5.3.1", "7.11.ii", 288, "7.11.II"),
    hblock("7.11.5.3.1", "h-sld", 288, 9, "Stato Limite di Esercizio (SLD)"),
    p("7.11.5.3.1", "p4", 288, 10, 13, "A meno dell’impiego di specifiche analisi dinamiche, in grado di fornire la risposta deformativa del sistema fondazione-terreno, la verifica nei confronti dello stato limite di danno può essere ritenuta soddisfatta impiegando le azioni corrispondenti allo SLD e determinando il carico limite di progetto con il coefficiente γ_R riportato nella Tabella 7.11.II.", [quantity("γ_R", "\\gamma_R")]),
], [], ["7.11.ii"]);
add("7.11.5.3.2", "Fondazioni su pali", title("7.11.5.3.2", 288, 14, "7.11.5.3.2 Fondazioni su pali"), [
    hblock("7.11.5.3.2", "h-slu", 288, 15, "Stati limite ultimi (SLV)"),
    p("7.11.5.3.2", "p1", 288, 16),
    p("7.11.5.3.2", "p2", 288, 17),
    li("7.11.5.3.2", "a", 288, 18, 18, "– raggiungimento della resistenza a carico limite verticale del complesso pali-terreno;"),
    li("7.11.5.3.2", "b", 288, 19, 19, "– raggiungimento della resistenza a carico limite orizzontale del complesso pali-terreno;"),
    li("7.11.5.3.2", "c", 288, 20, 20, "– liquefazione del terreno di fondazione;"),
    li("7.11.5.3.2", "d", 288, 21, 22, "– spostamenti o rotazioni eccessive che possano indurre il raggiungimento di uno stato limite ultimo nella struttura in elevazione;"),
    li("7.11.5.3.2", "e", 288, 23, 23, "– rottura di uno degli elementi strutturali della palificata (pali o struttura di collegamento)."),
    p("7.11.5.3.2", "p3", 288, 24, 25),
    p("7.11.5.3.2", "p4", 288, 26, 27),
    p("7.11.5.3.2", "p5", 288, 28, 31, "Nei casi in cui gli effetti di interazione cinematica siano considerati importanti, devono essere motivate le assunzioni di calcolo adottate e i criteri di sovrapposizione o meno di tali effetti con quelli inerziali. È opportuno che la valutazione degli effetti dovuti all’interazione cinematica sia effettuata per le costruzioni di Classe d’uso III e IV, per sottosuoli tipo D o peggiori, per valori di a_g > 0,25g e in presenza di elevati contrasti di rigidezza al contatto tra strati contigui di terreno.", [quantity("a_g > 0,25g", "a_g>0{,}25g")]),
    p("7.11.5.3.2", "p6", 288, 32, 34),
    p("7.11.5.3.2", "p7", 288, 35, 37),
    p("7.11.5.3.2", "p8", 288, 38, 44),
    hblock("7.11.5.3.2", "h-sld", 288, 45, "Stato Limite di Esercizio (SLD)"),
    p("7.11.5.3.2", "p9", 288, 46, 49, "A meno dell’impiego di specifiche analisi dinamiche, in grado di fornire la risposta deformativa del sistema fondazione-terreno, la verifica nei confronti dello stato limite di danno può essere ritenuta soddisfatta impiegando le azioni corrispondenti allo SLD e determinando il carico limite di progetto con il coefficiente γ_R riportato nella Tabella 6.4.II.", [quantity("γ_R", "\\gamma_R")]),
]);
add("7.11.6", "OPERE DI SOSTEGNO", title("7.11.6", 288, 50, "7.11.6 OPERE DI SOSTEGNO"), []);
add("7.11.6.1", "REQUISITI GENERALI", title("7.11.6.1", 288, 51, "7.11.6.1 REQUISITI GENERALI"), [
    p("7.11.6.1", "p1", 288, 52),
    p("7.11.6.1", "p2", 288, 53, 54),
    p("7.11.6.1", "p3", 288, 55, 56),
    p("7.11.6.1", "p4", 288, 57),
    p("7.11.6.1", "p5", 288, 58),
    li("7.11.6.1", "a", 289, 3, 3, "– effetti inerziali nel terreno, nelle strutture di sostegno e negli eventuali carichi aggiuntivi presenti;"),
    li("7.11.6.1", "b", 289, 4, 4, "– comportamento anelastico e non lineare del terreno;"),
    li("7.11.6.1", "c", 289, 5, 5, "– effetto della distribuzione delle pressioni interstiziali, se presenti, sulle azioni scambiate fra il terreno e l’opera di sostegno;"),
    li("7.11.6.1", "d", 289, 6, 6, "– condizioni di drenaggio;"),
    li("7.11.6.1", "e", 289, 7, 7, "– influenza degli spostamenti dell’opera sulla mobilitazione delle condizioni di equilibrio limite."),
    p("7.11.6.1", "p6", 289, 8, 9),
    p("7.11.6.1", "p7", 289, 10, 11),
    p("7.11.6.1", "p8", 289, 12),
    p("7.11.6.1", "p9", 289, 13, 15),
    p("7.11.6.1", "p10", 289, 16, 17),
]);
add("7.11.6.2", "MURI DI SOSTEGNO", title("7.11.6.2", 289, 18, "7.11.6.2 MURI DI SOSTEGNO"), [
    p("7.11.6.2", "p1", 289, 19, 20),
]);
add("7.11.6.2.1", "Metodi di analisi", title("7.11.6.2.1", 289, 21, "7.11.6.2.1 Metodi di analisi"), [
    p("7.11.6.2.1", "p1", 289, 22, 23),
    p("7.11.6.2.1", "p2", 289, 24, 26),
    p("7.11.6.2.1", "p3", 289, 27, 28),
    p("7.11.6.2.1", "p4", 289, 29, 29, "Nelle verifiche, i valori dei coefficienti sismici orizzontale k_h e verticale k_v possono essere valutati mediante le espressioni", [quantity("k_h", "k_h"), quantity("k_v", "k_v")]),
    formulaBlock("7.11.6.2.1", f7116, 289, "7.11.6"),
    formulaBlock("7.11.6.2.1", f7117, 289, "7.11.7"),
    p("7.11.6.2.1", "p5", 289, 35, 38, "dove β_m = coefficiente di riduzione dell’accelerazione massima attesa al sito; a_max = accelerazione orizzontale massima attesa al sito; g = accelerazione di gravità.", [quantity("β_m", "\\beta_m"), quantity("a_max", "a_{max}"), variable("g")]),
    p("7.11.6.2.1", "p6", 289, 39),
    formulaBlock("7.11.6.2.1", f7118, 289, "7.11.8"),
    p("7.11.6.2.1", "p7", 289, 41, 46, "dove S = coefficiente che comprende l’effetto dell’amplificazione stratigrafica (S_S) e dell’amplificazione topografica (S_T), di cui al § 3.2.3.2; a_g = accelerazione orizzontale massima attesa su sito di riferimento rigido.", [variable("S"), quantity("S_S", "S_S"), quantity("S_T", "S_T"), quantity("a_g", "a_g")]),
    p("7.11.6.2.1", "p8", 289, 47),
    formulaBlock("7.11.6.2.1", f7118u, 289, null),
    p("7.11.6.2.1", "p9", 289, 50, 52, "Per muri non liberi di subire spostamenti relativi rispetto al terreno, il coefficiente β_m assume valore unitario. I valori del coefficiente β_m possono essere incrementati in ragione di particolari caratteristiche prestazionali del muro, prendendo a riferimento il diagramma di Figura 7.11.3 di cui al successivo § 7.11.6.3.2.", [quantity("β_m", "\\beta_m")]),
    p("7.11.6.2.1", "p10", 289, 53, 55),
    p("7.11.6.2.1", "p11", 289, 56, 57, "Lo stato limite di ribaltamento deve essere trattato impiegando coefficienti parziali unitari sulle azioni e sui parametri geotecnici (§ 7.11.1) e utilizzando valori di β_m incrementati del 50% rispetto a quelli innanzi indicati e comunque non superiori all’unità.", [quantity("β_m", "\\beta_m"), quantity("50%", "50\\%")]),
], [f7116, f7117, f7118, f7118u]);
add("7.11.6.2.2", "Verifiche di sicurezza", title("7.11.6.2.2", 290, 3, "7.11.6.2.2 Verifiche di sicurezza"), [
    p("7.11.6.2.2", "p1", 290, 4, 7),
    p("7.11.6.2.2", "p2", 290, 8, 10, "Nelle verifiche di sicurezza si deve controllare che la resistenza del sistema sia maggiore delle azioni nel rispetto della condizione [6.2.1], ponendo pari all’unità i coefficienti parziali sulle azioni e sui parametri geotecnici (§ 7.11.1) e impiegando le resistenze di progetto con i coefficienti parziali γ_R indicati nella tabella 7.11.III.", [quantity("γ_R", "\\gamma_R")]),
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
    p("7.11.6.3.1", "p1", 290, 33),
    p("7.11.6.3.1", "p2", 290, 34, 36, "Le componenti orizzontale e verticale a_h e a_v dell’accelerazione equivalente devono essere ricavate in funzione delle proprietà del moto sismico atteso nel volume di terreno significativo per l’opera e della capacità dell’opera di subire spostamenti senza significative riduzioni di resistenza.", [quantity("a_h", "a_h"), quantity("a_v", "a_v")]),
    p("7.11.6.3.1", "p3", 290, 37, 38, "In mancanza di studi specifici, a_h può essere legata all’accelerazione di picco a_max attesa nel volume di terreno significativo per l’opera mediante la relazione:", [quantity("a_h", "a_h"), quantity("a_max", "a_{max}")]),
    formulaBlock("7.11.6.3.1", f7119, 290, "7.11.9"),
    p("7.11.6.3.1", "p4", 290, 40, 42, "dove g è l’accelerazione di gravità, k_h è il coefficiente sismico in direzione orizzontale, α ≤ 1 è un coefficiente che tiene conto della deformabilità dei terreni interagenti con l’opera e β ≤ 1 è un coefficiente funzione della capacità dell’opera di subire spostamenti senza cadute di resistenza.", [variable("g"), quantity("k_h", "k_h"), quantity("α ≤ 1", "\\alpha\\le1"), quantity("β ≤ 1", "\\beta\\le1")]),
    p("7.11.6.3.1", "p5", 290, 43, 43, "Per le paratie si può porre a_v = 0.", [quantity("a_v = 0", "a_v=0")]),
    p("7.11.6.3.1", "p6", 290, 44, 44, "L’accelerazione di picco a_max è valutata mediante un’analisi di risposta sismica locale, oppure come", [quantity("a_max", "a_{max}")]),
    formulaBlock("7.11.6.3.1", f71110, 290, "7.11.10"),
    p("7.11.6.3.1", "p7", 290, 46, 48, "dove S è il coefficiente che comprende l’effetto dell’amplificazione stratigrafica (S_S) e dell’amplificazione topografica (S_T), di cui al § 3.2.3.2, ed a_g è l’accelerazione orizzontale massima attesa su sito di riferimento rigido.", [variable("S"), quantity("S_S", "S_S"), quantity("S_T", "S_T"), quantity("a_g", "a_g")]),
    p("7.11.6.3.1", "p8", 290, 49, 50, "Il valore del coefficiente α può essere ricavato a partire dall’altezza complessiva H della paratia e dalla categoria di sottosuolo mediante il diagramma di Fig. 7.11.2.", [quantity("α", "\\alpha"), variable("H")]),
    p("7.11.6.3.1", "p9", 290, 51, 52, "Per il sottosuolo di categoria E si utilizzano le curve dei sottosuoli C o D in dipendenza dei valori assunti dalla velocità equivalente V_s.", [quantity("V_s", "V_s")]),
    p("7.11.6.3.1", "p10", 290, 53, 53, "Per la valutazione della spinta nelle condizioni di equilibrio limite passivo deve porsi α = 1.", [quantity("α = 1", "\\alpha=1")]),
    p("7.11.6.3.1", "p11", 291, 3, 5, "Il valore del coefficiente β può essere ricavato dal diagramma di Fig. 7.11.3, in funzione del massimo spostamento permanente u_s che l’opera può tollerare, verificando l’effettivo sviluppo di meccanismi duttili nel sistema. In assenza di tale verifica, il coefficiente β vale 1.", [quantity("β", "\\beta"), quantity("u_s", "u_s")]),
    p("7.11.6.3.1", "p12", 291, 6, 6, "Per u_s = 0 è β = 1. Deve comunque risultare:", [quantity("u_s = 0", "u_s=0"), quantity("β = 1", "\\beta=1")]),
    formulaBlock("7.11.6.3.1", f71111, 291, "7.11.11"),
    p("7.11.6.3.1", "p13", 291, 8, 8, "Se α · β ≤ 0,2 deve assumersi k_h = 0,2 · a_max/g.", [quantity("α · β ≤ 0,2", "\\alpha\\cdot\\beta\\le0{,}2"), quantity("k_h = 0,2 · a_max/g", "k_h=0{,}2\\cdot a_{max}/g")]),
    p("7.11.6.3.1", "p14", 291, 9),
    p("7.11.6.3.1", "p15", 291, 10, 11, "Per valori dell’angolo di resistenza al taglio tra terreno e parete δ > φ’/2, ai fini della valutazione della resistenza passiva è necessario tener conto della non planarità delle superfici di scorrimento.", [quantity("δ > φ’/2", "\\delta>\\phi'/2")]),
], [f7119, f71110, f71111]);
add("7.11.6.3.2", "Verifiche di sicurezza", title("7.11.6.3.2", 291, 12, "7.11.6.3.2 Verifiche di sicurezza"), [
    p("7.11.6.3.2", "p1", 291, 13, 15),
    p("7.11.6.3.2", "p2", 291, 16, 17),
    p("7.11.6.3.2", "p3", 291, 18, 19),
    figureBlock("7.11.6.3.2", fig7112, 291, "7.11.2", { coordinateSystem: "pdf-points-top-left", x: 180, y: 325, width: 250, height: 190 }),
    figureBlock("7.11.6.3.2", fig7113, 291, "7.11.3", { coordinateSystem: "pdf-points-top-left", x: 180, y: 518, width: 250, height: 217 }),
]);
units.at(-1)!.assets.figureIds = [figid(fig7112), figid(fig7113)];
add("7.11.6.4", "SISTEMI DI VINCOLO", title("7.11.6.4", 292, 3, "7.11.6.4 SISTEMI DI VINCOLO"), [
    p("7.11.6.4", "p1", 292, 4, 6, "Gli elementi di contrasto sollecitati a compressione (puntoni) devono essere dimensionati in maniera che l’instabilità geometrica si produca per forze assiali maggiori di quelle che provocano il raggiungimento della resistenza a compressione del materiale di cui sono composti. In caso contrario si deve porre β = 1.", [quantity("β = 1", "\\beta=1")]),
    p("7.11.6.4", "p2", 292, 7, 10, "Nel caso di strutture ancorate, ai fini del posizionamento della fondazione dell’ancoraggio si deve tenere presente che, per effetto del sisma, la potenziale superficie di scorrimento dei cunei di spinta presenta un’inclinazione sull’orizzontale minore di quella relativa al caso statico. Detta L_s la lunghezza libera dell’ancoraggio in condizioni statiche, la corrispondente lunghezza libera in condizioni sismiche L_e può essere ottenuta mediante la relazione:", [quantity("L_s", "L_s"), quantity("L_e", "L_e")]),
    formulaBlock("7.11.6.4", f71112, 292, "7.11.12"),
    p("7.11.6.4", "p3", 292, 20, 20, "dove a_max è l’accelerazione orizzontale massima attesa al sito.", [quantity("a_max", "a_{max}")]),
    p("7.11.6.4", "p4", 292, 21, 22),
    p("7.11.6.4", "p5", 292, 23, 24),
], [f71112]);
add("7.11.6.4.1", "Verifiche di sicurezza", title("7.11.6.4.1", 292, 25, "7.11.6.4.1 Verifiche di sicurezza"), [
    p("7.11.6.4.1", "p1", 292, 26, 28),
]);
add("8", "COSTRUZIONI ESISTENTI", [part(293, 3, 4)], []);

// Chapter 8 has no display assets. Repair the authoritative inline notation and
// retain the official list markers while preserving the already verified block
// boundaries and raw evidence of the baseline transcription.
function refreshExistingBlock(unit: any, suffix: string, normalized: string, math: MathTerm[] = []): void {
    const block = unit.blocks.find((candidate: any) => candidate.blockId.endsWith(`#block-${suffix}`));
    if (!block?.text) throw new Error(`Blocco ${unit.numbering.official}#${suffix} non trovato`);
    block.text.normalized = normalized;
    block.text.normalizationVersion = profile;
    block.text.inline = inlineSegments(normalized, math);
    block.evidence.extraction = { method: "manual-transcription", tool: "codex-source-transcription", toolVersion: profile };
    block.evidence.transformations = transformations(block.text.raw, normalized, true);
    block.evidence.rawSha256 = sha256(block.text.raw);
    block.evidence.normalizedSha256 = sha256(normalized);
}

function preserveOfficialMarker(unit: any, suffix: string, marker: "-" | "–"): void {
    const block = unit.blocks.find((candidate: any) => candidate.blockId.endsWith(`#block-${suffix}`));
    if (!block?.text) throw new Error(`Blocco ${unit.numbering.official}#${suffix} non trovato`);
    const normalized = block.text.normalized.startsWith(`${marker} `) ? block.text.normalized : `${marker} ${block.text.normalized}`;
    refreshExistingBlock(unit, suffix, normalized);
}

const chapter8Units = new Map<string, any>();
for (const number of ["8.3", "8.4.2", "8.4.3", "8.5.4", "8.5.5", "8.7.3", "8.7.4"]) {
    chapter8Units.set(number, JSON.parse(await readFile(join(unitDir, `${number}.json`), "utf8")));
}

const unit83 = chapter8Units.get("8.3");
refreshExistingBlock(
    unit83,
    "editorial-022",
    unit83.blocks.find((block: any) => block.blockId.endsWith("#block-editorial-022")).text.normalized.replaceAll("ξ_E", "ζ_E"),
    [quantity("ζ_E", "\\zeta_E")],
);
refreshExistingBlock(
    unit83,
    "editorial-023",
    unit83.blocks.find((block: any) => block.blockId.endsWith("#block-editorial-023")).text.normalized.replaceAll("ζ_{V,i}", "ζ_{v,i}"),
    [quantity("ζ_{v,i}", "\\zeta_{v,i}")],
);

const unit842 = chapter8Units.get("8.4.2");
refreshExistingBlock(
    unit842,
    "editorial-002",
    unit842.blocks.find((block: any) => block.blockId.endsWith("#block-editorial-002")).text.normalized.replaceAll("ξ_E", "ζ_E"),
    [quantity("ζ_E", "\\zeta_E"), quantity("0,6", "0{,}6"), quantity("0,1", "0{,}1")],
);
refreshExistingBlock(
    unit842,
    "editorial-003",
    unit842.blocks.find((block: any) => block.blockId.endsWith("#block-editorial-003")).text.normalized.replaceAll("ξ_E", "ζ_E"),
    [quantity("ζ_E = 1,0", "\\zeta_E=1{,}0")],
);

const unit843 = chapter8Units.get("8.4.3");
refreshExistingBlock(unit843, "editorial-004", unit843.blocks.find((block: any) => block.blockId.endsWith("#block-editorial-004")).text.normalized, [quantity("10%", "10\\%")]);
refreshExistingBlock(unit843, "editorial-005", unit843.blocks.find((block: any) => block.blockId.endsWith("#block-editorial-005")).text.normalized, [quantity("50%", "50\\%")]);
refreshExistingBlock(
    unit843,
    "editorial-008",
    unit843.blocks.find((block: any) => block.blockId.endsWith("#block-editorial-008")).text.normalized.replaceAll("ξ_E", "ζ_E"),
    [quantity("ζ_E ≥ 1,0", "\\zeta_E\\ge1{,}0"), quantity("ζ_E ≥ 0,80", "\\zeta_E\\ge0{,}80")],
);

const unit854 = chapter8Units.get("8.5.4");
for (const suffix of ["list-001", "list-002", "list-003"]) preserveOfficialMarker(unit854, suffix, "-");

const unit855 = chapter8Units.get("8.5.5");
refreshExistingBlock(
    unit855,
    "editorial-002",
    unit855.blocks.find((block: any) => block.blockId.endsWith("#block-editorial-002")).text.normalized,
    [quantity("γ_G", "\\gamma_G")],
);

const unit873 = chapter8Units.get("8.7.3");
for (const suffix of ["list-001", "list-002", "list-003"]) preserveOfficialMarker(unit873, suffix, "–");

const unit874 = chapter8Units.get("8.7.4");
for (let index = 1; index <= 23; index += 1) preserveOfficialMarker(unit874, `list-${String(index).padStart(3, "0")}`, "–");

units.push(...chapter8Units.values());

const formulas = [
    { id: fid(f7116), unitId: uid("7.11.6.2.1"), officialNumber: "7.11.6", pdfPage: 289, latex: "k_h=\\beta_m\\cdot\\frac{a_{max}}{g}" },
    { id: fid(f7117), unitId: uid("7.11.6.2.1"), officialNumber: "7.11.7", pdfPage: 289, latex: "k_v=\\pm0{,}5\\cdot k_h" },
    { id: fid(f7118), unitId: uid("7.11.6.2.1"), officialNumber: "7.11.8", pdfPage: 289, latex: "a_{max}=S\\cdot a_g=(S_S\\cdot S_T)\\cdot a_g" },
    { id: fid(f7118u), unitId: uid("7.11.6.2.1"), officialNumber: null, pdfPage: 289, latex: "\\begin{aligned}\\beta_m&=0.38&&\\text{ nelle verifiche allo stato limite ultimo (SLV)}\\\\\\beta_m&=0.47&&\\text{ nelle verifiche allo stato limite di esercizio (SLD).}\\end{aligned}" },
    { id: fid(f7119), unitId: uid("7.11.6.3.1"), officialNumber: "7.11.9", pdfPage: 290, latex: "a_h=k_h\\cdot g=\\alpha\\cdot\\beta\\cdot a_{max}" },
    { id: fid(f71110), unitId: uid("7.11.6.3.1"), officialNumber: "7.11.10", pdfPage: 290, latex: "a_{max}=S\\cdot a_g=(S_S\\cdot S_T)\\cdot a_g" },
    { id: fid(f71111), unitId: uid("7.11.6.3.1"), officialNumber: "7.11.11", pdfPage: 291, latex: "u_s\\le0{,}005\\cdot H" },
    { id: fid(f71112), unitId: uid("7.11.6.4"), officialNumber: "7.11.12", pdfPage: 292, latex: "L_e=L_s\\left(1+1{,}5\\cdot\\frac{a_{max}}{g}\\right)" },
    { id: fid(f7101), unitId: uid("7.10.5.3.1"), officialNumber: "7.10.1", pdfPage: 280, latex: "F=M\\cdot S_e(T_{is},\\xi_{esi})" },
    { id: fid(f7102), unitId: uid("7.10.5.3.1"), officialNumber: "7.10.2", pdfPage: 280, latex: "d_{de}=\\frac{M\\cdot S_e(T_{is},\\xi_{esi})}{K_{esi,min}}" },
    { id: fid(f7103), unitId: uid("7.10.5.3.1"), officialNumber: "7.10.3", pdfPage: 280, latex: "f_j=m_j\\cdot S_e(T_{is},\\xi_{esi})" },
    { id: fid(f7104), unitId: uid("7.10.5.3.1"), officialNumber: "7.10.4", pdfPage: 280, latex: "\\delta_{xi}=1+\\frac{e_{tot,y}}{r_y^2}y_i\\qquad \\delta_{yi}=1+\\frac{e_{tot,x}}{r_x^2}x_i" },
    { id: fid(f7105), unitId: uid("7.10.5.3.1"), officialNumber: "7.10.5", pdfPage: 280, latex: "\\begin{aligned}r_x^2&=\\sum(x_i^2\\cdot K_{yi}+y_i^2\\cdot K_{xi})/\\sum K_{yi}\\\\r_y^2&=\\sum(x_i^2\\cdot K_{yi}+y_i^2\\cdot K_{xi})/\\sum K_{xi}\\end{aligned}" },
    { id: fid(f7111), unitId: uid("7.11.2"), officialNumber: "7.11.1", pdfPage: 283, latex: "\\tau_f=c'+(\\sigma'_n-\\Delta u)\\tan(\\phi')" },
    { id: fid(f7112), unitId: uid("7.11.2"), officialNumber: "7.11.2", pdfPage: 283, latex: "\\tau_f=c_{u,c}" },
    { id: fid(f7113), unitId: uid("7.11.3.5.2"), officialNumber: "7.11.3", pdfPage: 285, latex: "k_h=\\beta_s\\cdot\\frac{a_{max}}{g}" },
    { id: fid(f7114), unitId: uid("7.11.3.5.2"), officialNumber: "7.11.4", pdfPage: 285, latex: "k_v=\\pm0{,}5\\cdot k_h" },
    { id: fid(f7115), unitId: uid("7.11.3.5.2"), officialNumber: "7.11.5", pdfPage: 285, latex: "a_{max}=S\\cdot a_g=(S_S\\cdot S_T)\\cdot a_g" },
    { id: fid(f7114u), unitId: uid("7.11.4"), officialNumber: null, pdfPage: 286, latex: "\\begin{aligned}\\beta_s&=0.38&&\\text{ nelle verifiche dello stato limite ultimo (SLV)}\\\\\\beta_s&=0.47&&\\text{ nelle verifiche dello stato limite di esercizio (SLD).}\\end{aligned}" },
    { id: fid(f791), unitId: uid("7.9.2.1"), officialNumber: "7.9.1", pdfPage: 270, latex: "q_0(\\nu_k)=q_0-\\left[\\frac{\\nu_k}{0{,}3}-1\\right]\\cdot(q_0-1)" },
    { id: fid(f792), unitId: uid("7.9.2.1"), officialNumber: "7.9.2", pdfPage: 270, latex: "K_R=2/\\tilde r" },
    { id: fid(f793), unitId: uid("7.9.4"), officialNumber: "7.9.3", pdfPage: 271, latex: "\\Delta M=d_{Ed}\\cdot N_{Ed}" },
    { id: fid(f794), unitId: uid("7.9.4.1"), officialNumber: "7.9.4", pdfPage: 271, latex: "T_1=2\\pi\\sqrt{M/K}" },
    { id: fid(f795), unitId: uid("7.9.4.1"), officialNumber: "7.9.5", pdfPage: 271, latex: "F_i=\\frac{4\\pi^2}{T_1^2}\\frac{S_d(T_1)}{g^2}\\cdot d_i\\cdot G_i" },
    { id: fid(f796), unitId: uid("7.9.4.1"), officialNumber: "7.9.6", pdfPage: 272, latex: "T_1=2\\pi\\sqrt{\\frac{\\sum G_i\\cdot d_i^2}{g\\cdot\\sum G_i\\cdot d_i}}" },
    { id: fid(f797), unitId: uid("7.9.5"), officialNumber: "7.9.7", pdfPage: 272, latex: "\\gamma_{Rd}=0{,}7+0{,}2q\\ge1" },
    { id: fid(f798), unitId: uid("7.9.5.1.1"), officialNumber: "7.9.8", pdfPage: 272, latex: "M_{Ed}\\le M_{Rd}" },
    { id: fid(f799), unitId: uid("7.9.5.1.1"), officialNumber: "7.9.9", pdfPage: 272, latex: "M_{prc}\\le M_{yd}" },
    { id: fid(f7910a), unitId: uid("7.9.5.1.1"), officialNumber: "7.9.10a", pdfPage: 273, latex: "V_{Ed}=\\gamma_{Bd}\\cdot V_{prc}" },
    { id: fid(f7910b), unitId: uid("7.9.5.1.1"), officialNumber: "7.9.10b", pdfPage: 273, latex: "V_{prc}=(M_{s,prc}+M_{i,prc})/l_p" },
    { id: fid(f7911), unitId: uid("7.9.5.1.1"), officialNumber: "7.9.11", pdfPage: 273, latex: "1{,}00\\le\\gamma_{Bd}=2{,}25-q\\cdot(V_E/V_{prc}-1)\\le1{,}25" },
    { id: fid(f7912), unitId: uid("7.9.5.2.1"), officialNumber: "7.9.12", pdfPage: 273, latex: "V_{Ed,i}=V_{E,i}\\cdot\\frac{\\gamma_{Rd}\\cdot M_{Rd,i}}{M_{E,i}}\\le V_{E,i}\\cdot q" },
    { id: fid(f7915), unitId: uid("7.9.6.1.1"), officialNumber: "7.9.15", pdfPage: 275, latex: "\\omega_{wd,r}\\ge\\max(\\omega_{w,req};\\;0{,}67\\cdot\\omega_{w,min})" },
    { id: fid(f7916), unitId: uid("7.9.6.1.1"), officialNumber: "7.9.16", pdfPage: 275, latex: "\\omega_{w,req}=\\frac{A_c}{A_{cc}}\\cdot\\lambda\\cdot\\nu_k+0{,}13\\cdot\\frac{f_{yd}}{f_{cd}}(\\rho_L-0{,}01)" },
    { id: fid(f7917), unitId: uid("7.9.6.1.1"), officialNumber: "7.9.17", pdfPage: 275, latex: "\\omega_{wd,c}\\ge\\max(1{,}4\\cdot\\omega_{w,req};\\;\\omega_{w,min})" },
    { id: fid(f7918), unitId: uid("7.9.6.1.1"), officialNumber: "7.9.18", pdfPage: 275, latex: "\\omega_{wd,r}=\\frac{A_{sw}}{s\\cdot b}\\cdot\\frac{f_{yd}}{f_{cd}}" },
    { id: fid(f7919), unitId: uid("7.9.6.1.1"), officialNumber: "7.9.19", pdfPage: 276, latex: "\\omega_{wd,c}=\\frac{4A_{sp}}{D_{sp}\\cdot s}\\cdot\\frac{f_{yd}}{f_{cd}}" },
    { id: fid(f7920), unitId: uid("7.9.6.1.1"), officialNumber: "7.9.20", pdfPage: 276, latex: "S_L\\le\\min(6\\cdot d_{bL};\\;1{,}5\\cdot b^*)" },
    { id: fid(f7921), unitId: uid("7.9.6.1.1"), officialNumber: "7.9.21", pdfPage: 276, latex: "S_L\\le\\min(\\frac{1}{3}\\cdot b^*;\\;200\\,\\mathrm{mm})" },
    { id: fid(f7922), unitId: uid("7.9.6.1.2"), officialNumber: "7.9.22", pdfPage: 276, latex: "S_L\\le6\\cdot d_{bL}" },
    { id: fid(f7923), unitId: uid("7.9.6.1.2"), officialNumber: "7.9.23", pdfPage: 276, latex: "\\frac{A_T}{S_T}=\\sum A_s\\cdot f_{yk,s}\\cdot\\frac{1}{1{,}6\\cdot f_{yk,t}}" },
    { id: fid(f783), unitId: uid("7.8.2.2.2"), officialNumber: "7.8.3", pdfPage: 266, latex: "V_t=l'\\cdot t\\cdot f_{vd}" },
    { id: fid(f784), unitId: uid("7.8.2.2.4"), officialNumber: "7.8.4", pdfPage: 266, latex: "V_t=h\\cdot t\\cdot f_{vd0}" },
    { id: fid(f785), unitId: uid("7.8.2.2.4"), officialNumber: "7.8.5", pdfPage: 266, latex: "M_u=H_p\\cdot\\frac{h}{2}\\cdot\\left[1-\\frac{H_p}{\\left(0{,}85\\cdot f_{bd}\\cdot h\\cdot t\\right)}\\right]" },
    { id: fid(f786), unitId: uid("7.8.2.2.4"), officialNumber: "7.8.6", pdfPage: 266, latex: "V_p=2M_{fu}/l" },
    { id: fid(f787), unitId: uid("7.8.3.2.2"), officialNumber: "7.8.7", pdfPage: 267, latex: "V_t=V_{t,M}+V_{t,S}" },
    { id: fid(f788), unitId: uid("7.8.3.2.2"), officialNumber: "7.8.8", pdfPage: 267, latex: "V_{t,M}=d\\cdot t\\cdot f_{vd}" },
    { id: fid(f789), unitId: uid("7.8.3.2.2"), officialNumber: "7.8.9", pdfPage: 267, latex: "V_{t,S}=(0{,}6\\cdot d\\cdot A_{sw}\\cdot f_{vd})/s" },
    { id: fid(f7810), unitId: uid("7.8.3.2.2"), officialNumber: "7.8.10", pdfPage: 267, latex: "V_{t,c}=0{,}3\\cdot f_d\\cdot t\\cdot d" },
    { id: fid(f780), unitId: uid("7.8.1.5.2"), officialNumber: "7.8.0", pdfPage: 263, latex: "|\\Delta V|\\le\\max\\{0{,}25|V|,\\;0{,}1|V_{piano}|\\}" },
    { id: fid(fSa), unitId: uid("7.8.1.5.2"), officialNumber: null, pdfPage: 263, latex: "S_a=\\alpha\\,S\\left[1{,}5\\left(1+\\frac{Z}{H}\right)-0{,}5\right]\\ge\\alpha\\,S" },
    { id: fid(f781), unitId: uid("7.8.1.9"), officialNumber: "7.8.1", pdfPage: 265, latex: "\\sigma=\\frac{N}{A}\\le0{,}25\\frac{f_k}{\\gamma_M}" },
    { id: fid(f782), unitId: uid("7.8.2.2.1"), officialNumber: "7.8.2", pdfPage: 265, latex: "M_u=\\left(l^2\\cdot t\\cdot\\frac{\\sigma_0}{2}\\right)\\left(1-\\frac{\\sigma_0}{0{,}85f_d}\\right)" },
];
const saFormula = formulas.find((formula) => formula.id === fid(fSa));
if (saFormula) saFormula.latex = "S_a=\\alpha\\cdot S\\cdot\\left[1.5\\cdot\\left(1+Z/H\\right)-0.5\\right]\\ge\\alpha\\cdot S";

const tables = [
    {
        id: tid("7.11.ii"), unitId: uid("7.11.5.3.1"), officialNumber: "7.11.II", pdfPage: 288,
        caption: "Coefficienti parziali γ_R per le verifiche degli stati limite (SLV) delle fondazioni superficiali con azioni sismiche", columnCount: 2,
        headers: [[cell("Verifica"), cell("Coefficiente parziale γ_R", "\\gamma_R")]],
        rows: [[cell("Carico limite"), cell("2.3")], [cell("Scorrimento"), cell("1.1")], [cell("Resistenza sulle superfici laterali"), cell("1.3")]], notes: [],
    },
    {
        id: tid("7.11.iii"), unitId: uid("7.11.6.2.2"), officialNumber: "7.11.III", pdfPage: 290,
        caption: "Coefficienti parziali γ_R per le verifiche degli stati limite (SLV) dei muri di sostegno", columnCount: 2,
        headers: [[cell("Verifica"), cell("Coefficiente parziale γ_R", "\\gamma_R")]],
        rows: [[cell("Carico limite"), cell("1.2")], [cell("Scorrimento"), cell("1.0")], [cell("Ribaltamento"), cell("1.0")], [cell("Resistenza del terreno a valle"), cell("1.2")]], notes: [],
    },
    {
        id: tid("7.11.i"), unitId: uid("7.11.3.5.2"), officialNumber: "7.11.I", pdfPage: 286,
        caption: "Coefficienti di riduzione dell’accelerazione massima attesa al sito", columnCount: 3,
        headers: [
            [cell("", undefined, { rowSpan: 3 }), cell("Categoria di sottosuolo", undefined, { colSpan: 2 })],
            [cell("A"), cell("B, C, D, E")],
            [cell("β_s", "\\beta_s"), cell("β_s", "\\beta_s")],
        ],
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
            [cell("Muratura ordinaria, realizzata con elementi in pietra squadrata"), cell("300 mm", "300\\,\\mathrm{mm}"), cell("10", "10"), cell("0,5", "0{,}5")],
            [cell("Muratura ordinaria, realizzata con elementi artificiali"), cell("240 mm", "240\\,\\mathrm{mm}"), cell("12", "12"), cell("0,4", "0{,}4")],
            [cell("Muratura armata, realizzata con elementi artificiali"), cell("240 mm", "240\\,\\mathrm{mm}"), cell("15", "15"), cell("Qualsiasi")],
            [cell("Muratura confinata"), cell("240 mm", "240\\,\\mathrm{mm}"), cell("15", "15"), cell("0,3", "0{,}3")],
            [cell(
                "Muratura ordinaria, realizzata con elementi in pietra squadrata, in siti caratterizzati, allo SLV, da a_g S ≤ 0.15g",
                "\\begin{gathered}\\text{Muratura ordinaria, realizzata con elementi in pietra squadrata,}\\\\\\text{in siti caratterizzati, allo SLV, da }a_g S\\le0.15g\\end{gathered}",
            ), cell("240 mm", "240\\,\\mathrm{mm}"), cell("12", "12"), cell("0,3", "0{,}3")],
            [cell(
                "Muratura realizzata con elementi artificiali semipieni, in siti caratterizzati, allo SLV, da a_g S ≤ 0.075 g",
                "\\begin{gathered}\\text{Muratura realizzata con elementi artificiali semipieni,}\\\\\\text{in siti caratterizzati, allo SLV, da }a_g S\\le0.075\\,g\\end{gathered}",
            ), cell("200 mm", "200\\,\\mathrm{mm}"), cell("20", "20"), cell("0,3", "0{,}3")],
            [cell(
                "Muratura realizzata con elementi artificiali pieni, in siti caratterizzati, allo SLV, da a_g S ≤ 0.075 g",
                "\\begin{gathered}\\text{Muratura realizzata con elementi artificiali pieni,}\\\\\\text{in siti caratterizzati, allo SLV, da }a_g S\\le0.075\\,g\\end{gathered}",
            ), cell("150 mm", "150\\,\\mathrm{mm}"), cell("20", "20"), cell("0,3", "0{,}3")],
        ], notes: [],
    },
    {
        id: tid("7.8.ii"), unitId: uid("7.8.1.9"), officialNumber: "7.8.II", pdfPage: 265,
        caption: "Area pareti resistenti in ciascuna direzione ortogonale per costruzioni semplici", columnCount: 12,
        headers: [
            [cell("Accelerazione di picco del terreno a_g S (1)", "\\text{Accelerazione di picco del terreno }a_g S^{(1)}", { colSpan: 2 }), ...["≤0,07g", "≤0,10g", "≤0,15g", "≤0,20g", "≤0,25g", "≤0,30g", "≤0,35g", "≤0,40g", "≤0,45g", "≤0,50g"].map(accelerationLimitCell)],
            [cell("Tipo di struttura"), cell("Numero piani"), ...Array.from({ length: 10 }, () => cell(""))],
        ],
        rows: [
            [cell("Muratura ordinaria", undefined, { rowSpan: 3 }), cell("1", "1"), ...["3,5%", "3,5%", "4,0%", "4,5%", "5,5%", "6,0%", "6,0%", "6,0%", "6,0%", "6,5%"].map(percentCell)],
            [cell("2", "2"), ...["4,0%", "4,0%", "4,5%", "5,0%", "6,0%", "6,5%", "6,5%", "6,5%", "6,5%", "7,0%"].map(percentCell)],
            [cell("3", "3"), ...["4,5%", "4,5%", "5,0%", "6,0%", "6,5%", "7,0%", "7,0%"].map(percentCell), cell(""), cell(""), cell("")],
            [cell("Muratura armata", undefined, { rowSpan: 4 }), cell("1", "1"), ...["2,5%", "3,0%", "3,0%", "3,0%", "3,5%", "3,5%", "4,0%", "4,0%", "4,5%", "4,5%"].map(percentCell)],
            [cell("2", "2"), ...["3,0%", "3,5%", "3,5%", "3,5%", "4,0%", "4,0%", "4,5%", "5,0%", "5,0%", "5,0%"].map(percentCell)],
            [cell("3", "3"), ...["3,5%", "4,0%", "4,0%", "4,0%", "4,5%", "5,0%", "5,5%", "5,5%", "6,0%", "6,0%"].map(percentCell)],
            [cell("4", "4"), ...["4,0%", "4,5%", "4,5%", "5,0%", "5,5%", "5,5%", "5,5%", "6,0%", "6,5%", "6,5%"].map(percentCell)],
        ],
        notes: ["(1) S_T si applica solo nel caso di strutture di Classe d’uso III e IV (v. § 2.4.2)"],
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
        id: figid(fig7112), unitId: uid("7.11.6.3.2"), officialNumber: "7.11.2", pdfPage: 291,
        caption: "Fig. 7.11.2 – Diagramma per la valutazione del coefficiente di deformabilità α",
        alt: "Diagramma per la valutazione del coefficiente di deformabilità α.",
        imagePath: "figures/ntc2018/fig7.11.2.png",
        region: { coordinateSystem: "pdf-points-top-left", x: 180, y: 325, width: 250, height: 190 },
        sha256: "3abc7dcd9944fd739b0c1f9ae96f10e5bc14e5ac4c264f97eb600209e99eb622",
    }, {
        id: figid(fig7113), unitId: uid("7.11.6.3.2"), officialNumber: "7.11.3", pdfPage: 291,
        caption: "Fig. 7.11.3 – Diagramma per la valutazione del coefficiente di spostamento β",
        alt: "Diagramma per la valutazione del coefficiente di spostamento β.",
        imagePath: "figures/ntc2018/fig7.11.3.png",
        region: { coordinateSystem: "pdf-points-top-left", x: 180, y: 518, width: 250, height: 217 },
        sha256: "de038750e9528e1a645d751fbc7dfbe417889381c08dc4c6c64d704e7e8e376c",
    }],
};
await writeFile(join(assetDir, "7.7-78-step2.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(`ntc77-78-step2: generated ${units.length} new units, ${formulas.length} formulas, ${tables.length} tables; extended 7.7.2`);
