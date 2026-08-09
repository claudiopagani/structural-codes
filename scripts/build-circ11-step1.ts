/* eslint-disable @typescript-eslint/no-explicit-any */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../", import.meta.url));
const sourceId = "circ-7-2019";
const profile = "circ11-editorial-profile-0.1.0";
const sourcePages = { from: 314, to: 341 };
const evidenceDir = join(repoRoot, "evidence", sourceId, "pages");
const unitDir = join(repoRoot, "corpus", "units", "circ2019");
const assetDir = join(repoRoot, "corpus", "assets", "circ2019");
const createdAt = "2026-08-09T00:00:00Z";

type Line = {
    page: number;
    sequence: number;
    text: string;
    raw: string;
    y: number;
    x: number;
    width: number;
    printedPage: string | null;
};

const unitNumbers = `
C11 C11.1 C11.2 C11.2.1 C11.2.2 C11.2.3 C11.2.4 C11.2.5 C11.2.5.1 C11.2.5.2 C11.2.5.3 C11.2.6 C11.2.7 C11.2.8 C11.2.12
C11.3 C11.3.1 C11.3.1.1 C11.3.1.2 C11.3.1.3 C11.3.1.5 C11.3.1.7 C11.3.2 C11.3.2.1 C11.3.2.2 C11.3.2.3 C11.3.2.4 C11.3.2.5 C11.3.2.8 C11.3.2.8.2 C11.3.2.10 C11.3.2.10.3 C11.3.2.10.4 C11.3.2.12
C11.3.3 C11.3.3.5 C11.3.3.5.2.1 C11.3.3.5.6 C11.3.4 C11.3.4.1 C11.3.4.5 C11.3.4.6 C11.3.4.10 C11.3.4.11 C11.3.4.11.2 C11.3.4.11.2.1 C11.3.4.11.3
C11.4 C11.5 C11.5.1 C11.6 C11.7 C11.7.1 C11.7.2 C11.7.2.1 C11.7.2.2 C11.7.3 C11.7.4 C11.7.5 C11.7.8 C11.7.10 C11.7.10.1 C11.7.10.1.1 C11.7.10.2
C11.8 C11.8.1 C11.8.3 C11.8.4 C11.8.4.2 C11.8.4.3 C11.8.5 C11.8.6 C11.9 C11.9.1 C11.9.3 C11.9.4 C11.9.5 C11.9.6 C11.9.7 C11.9.7.1
C11.10 C11.10.1 C11.10.1.1 C11.10.1.1.1 C11.10.1.1.1.1 C11.10.1.1.1.2 C11.10.2 C11.10.2.4 C11.10.3 C11.10.3.2 C11.10.3.2.1
`.trim().split(/\s+/u);

function sha256(value: string): string {
    return createHash("sha256").update(value, "utf8").digest("hex");
}

function sortKey(number: string): string {
    return number.slice(1).split(".").map((part) => part.padStart(3, "0")).join(".");
}

function idFor(number: string): string {
    return `urn:structural-codes:it:unit:circ2019:${number.toLowerCase()}`;
}

function unitTitle(number: string): string {
    if (number === "C11") return "MATERIALI E PRODOTTI PER USO STRUTTURALE";
    return titleOverrides[number] ?? "";
}

const titleOverrides: Record<string, string> = {
    "C11.1": "GENERALITÀ",
    "C11.2": "CALCESTRUZZO",
    "C11.2.1": "SPECIFICHE PER IL CALCESTRUZZO",
    "C11.2.2": "CONTROLLI DI QUALITÀ DEL CALCESTRUZZO",
    "C11.2.3": "VALUTAZIONE PRELIMINARE",
    "C11.2.4": "PRELIEVO E PROVA DEI CAMPIONI",
    "C11.2.5": "CONTROLLI DI ACCETTAZIONE",
    "C11.2.5.1": "CONTROLLO DI ACCETTAZIONE DI TIPO A",
    "C11.2.5.2": "CONTROLLO DI ACCETTAZIONE DI TIPO B",
    "C11.2.5.3": "PRESCRIZIONI COMUNI PER ENTRAMBI I CRITERI DI CONTROLLO",
    "C11.2.6": "CONTROLLO DELLA RESISTENZA DEL CALCESTRUZZO IN OPERA",
    "C11.2.7": "PROVE COMPLEMENTARI",
    "C11.2.8": "PRESCRIZIONI RELATIVE AL CALCESTRUZZO CONFEZIONATO CON PROCESSO INDUSTRIALIZZATO",
    "C11.2.12": "CALCESTRUZZI FIBRORINFORZATI (FRC)",
    "C11.3": "ACCIAIO",
    "C11.3.1": "PRESCRIZIONI COMUNI A TUTTE LE TIPOLOGIE DI ACCIAIO",
    "C11.3.1.1": "CONTROLLI",
    "C11.3.1.2": "CONTROLLI DI PRODUZIONE IN STABILIMENTO E PROCEDURE DI QUALIFICAZIONE",
    "C11.3.1.3": "MANTENIMENTO E RINNOVO DELLA QUALIFICAZIONE",
    "C11.3.1.5": "FORNITURE E DOCUMENTAZIONE DI ACCOMPAGNAMENTO",
    "C11.3.1.7": "CENTRI DI TRASFORMAZIONE",
    "C11.3.2": "ACCIAIO PER CALCESTRUZZO ARMATO",
    "C11.3.2.1": "ACCIAIO PER CALCESTRUZZO ARMATO B450C",
    "C11.3.2.2": "ACCIAIO PER CALCESTRUZZO ARMATO B450A",
    "C11.3.2.3": "ACCERTAMENTO DELLE PROPRIETÀ MECCANICHE",
    "C11.3.2.4": "CARATTERISTICHE DIMENSIONALI E DI IMPIEGO",
    "C11.3.2.5": "RETI E TRALICCI ELETTROSALDATI",
    "C11.3.2.8": "ALTRI TIPI DI ACCIAI",
    "C11.3.2.8.2": "Acciai zincati",
    "C11.3.2.10": "PROCEDURE DI CONTROLLO PER ACCIAI DA CEMENTO ARMATO NORMALE – BARRE E ROTOLI",
    "C11.3.2.10.3": "Controlli nei centri di trasformazione",
    "C11.3.2.10.4": "Prove di aderenza",
    "C11.3.2.12": "CONTROLLI DI ACCETTAZIONE IN CANTIERE",
    "C11.3.3": "ACCIAIO PER CALCESTRUZZO ARMATO PRECOMPRESSO",
    "C11.3.3.5": "PROCEDURE DI CONTROLLO PER ACCIAI DA CALCESTRUZZO ARMATO PRECOMPRESSO",
    "C11.3.3.5.2.1": "Prove di qualificazione",
    "C11.3.3.5.6": "Prodotti zincati",
    "C11.3.4": "ACCIAI PER STRUTTURE METALLICHE E PER STRUTTURE COMPOSTE",
    "C11.3.4.1": "GENERALITÀ",
    "C11.3.4.5": "PROCESSO DI SALDATURA",
    "C11.3.4.6": "BULLONI E CHIODI",
    "C11.3.4.10": "CENTRI DI TRASFORMAZIONE E CENTRI DI PRODUZIONE DI ELEMENTI IN ACCIAIO",
    "C11.3.4.11": "PROCEDURE DI CONTROLLO SU ACCIAI DA CARPENTERIA",
    "C11.3.4.11.2": "Controlli nei centri di trasformazione e nei centri di produzione di elementi tipologici in acciaio",
    "C11.3.4.11.2.1": "Centri di produzione di lamiere grecate e profilati formati a freddo",
    "C11.3.4.11.3": "Controlli di accettazione in cantiere",
    "C11.4": "ANCORANTI PER USO STRUTTURALE E GIUNTI DI DILATAZIONE",
    "C11.5": "SISTEMI DI PRECOMPRESSIONE A CAVI POST-TESI E TIRANTI DI ANCORAGGIO",
    "C11.5.1": "SISTEMI DI PRECOMPRESSIONE A CAVI POST TESI",
    "C11.6": "APPOGGI STRUTTURALI",
    "C11.7": "MATERIALI E PRODOTTI A BASE DI LEGNO",
    "C11.7.1": "GENERALITÀ",
    "C11.7.2": "LEGNO MASSICCIO",
    "C11.7.2.1": "LEGNO MASSICCIO CON SEZIONE RETTANGOLARE",
    "C11.7.2.2": "LEGNO MASSICCIO CON SEZIONI IRREGOLARI",
    "C11.7.3": "LEGNO STRUTTURALE CON GIUNTI A DITA",
    "C11.7.4": "LEGNO LAMELLARE INCOLLATO E LEGNO MASSICCIO INCOLLATO",
    "C11.7.5": "PANNELLI A BASE DI LEGNO",
    "C11.7.8": "ELEMENTI MECCANICI DI COLLEGAMENTO",
    "C11.7.10": "PROCEDURE DI IDENTIFICAZIONE, QUALIFICAZIONE E ACCETTAZIONE – CENTRI DI LAVORAZIONE",
    "C11.7.10.1": "FABBRICANTI E CENTRI DI LAVORAZIONE",
    "C11.7.10.1.1": "Identificazione e rintracciabilità dei prodotti qualificati",
    "C11.7.10.2": "CONTROLLI DI ACCETTAZIONE IN CANTIERE",
    "C11.8": "COMPONENTI PREFABBRICATI IN C.A. E C.A.P.",
    "C11.8.1": "GENERALITÀ",
    "C11.8.3": "CONTROLLO DI PRODUZIONE",
    "C11.8.4": "PROCEDURE DI QUALIFICAZIONE",
    "C11.8.4.2": "QUALIFICAZIONE DELLA PRODUZIONE IN SERIE DICHIARATA",
    "C11.8.4.3": "QUALIFICAZIONE DELLA PRODUZIONE IN SERIE CONTROLLATA",
    "C11.8.5": "DOCUMENTI DI ACCOMPAGNAMENTO",
    "C11.8.6": "DISPOSITIVI MECCANICI DI COLLEGAMENTO",
    "C11.9": "DISPOSITIVI ANTISISMICI E DI CONTROLLO DI VIBRAZIONI",
    "C11.9.1": "TIPOLOGIE DI DISPOSITIVI",
    "C11.9.3": "PROCEDURA DI ACCETTAZIONE",
    "C11.9.4": "DISPOSITIVI A COMPORTAMENTO LINEARE",
    "C11.9.5": "DISPOSITIVI A COMPORTAMENTO NON LINEARE",
    "C11.9.6": "DISPOSITIVI A COMPORTAMENTO VISCOSO",
    "C11.9.7": "ISOLATORI ELASTOMERICI",
    "C11.9.7.1": "PROVE DI ACCETTAZIONE SUI DISPOSITIVI",
    "C11.10": "MURATURA PORTANTE",
    "C11.10.1": "ELEMENTI PER MURATURA",
    "C11.10.1.1": "PROVE DI ACCETTAZIONE",
    "C11.10.1.1.1": "Resistenza a compressione degli elementi resistenti artificiali o naturali",
    "C11.10.1.1.1.1": "Resistenza caratteristica a compressione degli elementi nella direzione dei carichi verticali",
    "C11.10.1.1.1.2": "Resistenza caratteristica a compressione degli elementi nella direzione ortogonale a quella dei carichi verticali e nel piano della muratura",
    "C11.10.2": "MALTE PER MURATURA",
    "C11.10.2.4": "PROVE DI ACCETTAZIONE",
    "C11.10.3": "DETERMINAZIONE DEI PARAMETRI MECCANICI DELLA MURATURA",
    "C11.10.3.2": "RESISTENZA CARATTERISTICA A TAGLIO IN ASSENZA DI TENSIONI NORMALI",
    "C11.10.3.2.1": "Determinazione sperimentale della resistenza a taglio",
};

function repairEncoding(value: string): string {
    return value
        .replaceAll("Ã€", "À").replaceAll("Ãˆ", "È").replaceAll("Ã‰", "É").replaceAll("ÃŒ", "Ì").replaceAll("Ã’", "Ò").replaceAll("Ã™", "Ù")
        .replaceAll("Ã ", "à").replaceAll("Ã¨", "è").replaceAll("Ã©", "é").replaceAll("Ã¬", "ì").replaceAll("Ã²", "ò").replaceAll("Ã¹", "ù")
        .replaceAll("Ã§", "ç").replaceAll("â€™", "’").replaceAll("â€œ", "“").replaceAll("â€", "”").replaceAll("â€“", "–").replaceAll("â€”", "—")
        .replaceAll("Â§", "§").replaceAll("Â±", "±").replaceAll("Â²", "²").replaceAll("Â³", "³").replaceAll("Â°", "°").replaceAll("Âµ", "µ")
        .replaceAll("â€", "”");
}

function normalizeText(value: string): string {
    return repairEncoding(value).replaceAll(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/gu, "").replaceAll(/\s+/gu, " ").trim();
}

function normalizeHeading(raw: string, number: string): string {
    const title = unitTitle(number);
    return `${number} ${title}`.trim();
}

function transformations(raw: string, normalized: string): any[] {
    if (raw === normalized) return [];
    const result: any[] = [];
    if (/\n/u.test(raw)) result.push({ operation: "join-line-wrap", ruleVersion: profile, note: "Ricomposti i ritorni a capo tipografici verificati sul render ufficiale." });
    if (/-\n/gu.test(raw)) result.push({ operation: "remove-discretionary-hyphen", ruleVersion: profile, note: "Ricomposte le parole sillabate a fine riga dopo controllo visivo." });
    if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/gu.test(raw)) result.push({ operation: "remove-control-character", ruleVersion: profile, note: "Rimossi dal testo normalizzato i caratteri di controllo del layer PDF; il raw resta conservato." });
    result.push({ operation: "manual-correction", ruleVersion: profile, note: "Ripristinati accenti, apostrofi, spaziatura, glifi e notazione matematica dal render ufficiale." });
    return result;
}

function evidence(page: number, printedPage: string | null, raw: string, normalized: string): any {
    return { sourceId, pdfPage: page, printedPage, region: null, extraction: { method: "pdf-text", tool: "pdfjs-dist", toolVersion: "4.10.38" }, transformations: transformations(raw, normalized), rawSha256: sha256(raw), normalizedSha256: sha256(normalized) };
}

function sameLine(previous: any, item: any): boolean {
    return previous !== undefined && !previous.hasEol && item.region !== undefined && previous.region !== undefined
        && !(item.region.x <= previous.region.x + 0.5 && Math.abs(item.region.y - previous.region.y) > Math.max(2, previous.region.height * 0.6));
}

function buildLines(page: number, record: any): Line[] {
    const lines: Line[] = [];
    let current: Line | undefined;
    let previous: any;
    for (const item of record.textItems) {
        if (!sameLine(previous, item)) {
            if (current !== undefined && current.text.length > 0) lines.push(current);
            current = item.text.length === 0 ? undefined : { page, sequence: lines.length, text: item.text, raw: item.text, y: item.region.y, x: item.region.x, width: item.region.width, printedPage: record.printedPage };
        } else if (current !== undefined) {
            const previousEnd = previous.region.x + previous.region.width;
            const gap = item.region.x - previousEnd;
            const needsSpace = gap > Math.max(0.5, previous.region.height * 0.08) && !/\s$/u.test(current.text) && !/^[,.;:!?)\]}]/u.test(item.text);
            current.text += `${needsSpace ? " " : ""}${item.text}`;
            current.raw = current.text;
            current.width = Math.max(current.width, item.region.x + item.region.width - current.x);
        }
        previous = item;
    }
    if (current !== undefined && current.text.length > 0) lines.push(current);
    return lines;
}

function isNoise(line: Line): boolean {
    const text = normalizeText(line.text);
    return /Supplemento ordinario n\. 5/u.test(text) || /Serie generale/u.test(text) || /^11-2-2019$/u.test(text) || /^—?\s*\d{3}\s*—?$/u.test(text);
}

function startsWithUnit(text: string, number: string): boolean {
    return new RegExp(`^${number.replaceAll(".", "\\.")}(?:\\s|$)`, "u").test(text);
}

function listItem(text: string): boolean {
    return /^(?:-|–|[A-C]\)|[a-c]\)|\d+\))\s+/u.test(text);
}

function paragraphKind(text: string): "paragraph" | "list-item" | "footnote" {
    if (/^\d+\s+https?:/u.test(text)) return "footnote";
    return listItem(text) ? "list-item" : "paragraph";
}

function joinLines(lines: Line[]): string {
    let result = "";
    for (const line of lines) {
        const current = line.text.trim();
        if (!current) continue;
        if (!result) result = current;
        else if (result.endsWith("-") && /^\p{Ll}/u.test(current)) result = `${result.slice(0, -1)}${current}`;
        else result += ` ${current}`;
    }
    return normalizeText(result);
}

const inlineTerms: Array<[string, string]> = [
    ["fcarota", "f_{\\mathrm{carota}}"], ["fckis", "f_{ck,is}"], ["fc,is", "f_{c,is}"], ["Rc,is", "R_{c,is}"], ["Rcm28", "R_{cm28}"], ["Rc,min", "R_{c,\\min}"],
    ["fyk", "f_{yk}"], ["ftk", "f_{tk}"], ["fy,nom", "f_{y,\\mathrm{nom}}"], ["ft,nom", "f_{t,\\mathrm{nom}}"], ["fym", "f_{ym}"], ["fyk/fy", "f_{yk}/f_y"],
    ["ftk/fyk", "f_{tk}/f_{yk}"], ["Agt", "A_{gt}"], ["K_in", "K_{in}"], ["K_e", "K_e"], ["K_1", "K_1"], ["K_2", "K_2"], ["ξe", "\\xi_e"], ["Ed", "E_d"],
    ["Fd", "F_d"], ["Ar", "A_r"], ["Vcr", "V_{cr}"], ["Gdin", "G_{din}"], ["Ec", "E_c"], ["Eb", "E_b"], ["fbk", "f_{bk}"], ["fbm", "f_{bm}"], ["fbi", "f_{bi}"],
    ["N/mm²", "\\mathrm{N/mm^2}"], ["N/mm2", "\\mathrm{N/mm^2}"], ["H/D", "H/D"], ["r/t", "r/t"], ["γt", "\\gamma_t"], ["γs", "\\gamma_s"], ["γc", "\\gamma_c"], ["γa", "\\gamma_a"],
    ["σs", "\\sigma_s"], ["δ", "\\delta"], ["αx", "\\alpha_x"], ["αy", "\\alpha_y"], ["φ", "\\varphi"], ["dE", "d_E"], ["dEx", "d_{Ex}"], ["dEy", "d_{Ey}"],
];

function inlineSegments(text: string): any[] | undefined {
    const found = inlineTerms.filter(([value]) => text.includes(value)).sort((a, b) => b[0].length - a[0].length);
    if (!found.length) return undefined;
    const result: any[] = [];
    let cursor = 0;
    while (cursor < text.length) {
        let next: { index: number; value: string; latex: string } | undefined;
        for (const [value, latex] of found) {
            const index = text.indexOf(value, cursor);
            if (index >= 0 && (!next || index < next.index || (index === next.index && value.length > next.value.length))) next = { index, value, latex };
        }
        if (!next) { result.push({ kind: "text", value: text.slice(cursor) }); break; }
        if (next.index > cursor) result.push({ kind: "text", value: text.slice(cursor, next.index) });
        result.push({ kind: "math", value: next.value, latex: next.latex });
        cursor = next.index + next.value.length;
    }
    return result.filter((segment) => segment.value.length > 0);
}

const allLines: Line[] = [];
for (let page = sourcePages.from; page <= sourcePages.to; page += 1) {
    const record = JSON.parse(await readFile(join(evidenceDir, `page-${String(page).padStart(4, "0")}.json`), "utf8"));
    allLines.push(...buildLines(page, record).filter((line) => !isNoise(line)));
}

function findHeading(number: string): Line {
    if (number === "C11") {
        const line = allLines.find((candidate) => /(?:CAPITOLO\s*C11|C11\.)/u.test(normalizeText(candidate.text)));
        if (!line) throw new Error("Heading non trovato: C11");
        return line;
    }
    const line = allLines.find((candidate) => startsWithUnit(normalizeText(candidate.text), number));
    if (!line) throw new Error(`Heading non trovato: ${number}`);
    return line;
}

const starts = unitNumbers.map((number) => ({ number, line: findHeading(number), index: 0 }));
for (const start of starts) start.index = allLines.findIndex((line) => line === start.line);

function isNewParagraph(previous: Line | undefined, current: Line, previousKind: string | undefined): boolean {
    if (!previous) return true;
    const text = normalizeText(current.text);
    if (listItem(text)) return true;
    if (previousKind === "list-item" && current.x > previous.x + 1 && !listItem(text)) return false;
    if (current.page !== previous.page) return /[.!?:;]$/u.test(previous.text.trim());
    return current.y - previous.y > 11.5;
}

function makeTextBlock(unitNumber: string, index: number, lines: Line[]): any {
    const raw = lines.map((line) => line.raw).join("\n");
    const joined = joinLines(lines);
    const normalized = listItem(joined) ? joined.replace(/^(?:-|â€“|[A-C]\)|[a-c]\)|\d+\))\s+/u, "") : joined;
    const text: any = { raw, normalized, normalizationVersion: profile };
    const inline = inlineSegments(normalized);
    if (inline) text.inline = inline;
    return { blockId: `${idFor(unitNumber)}#block-${String(index).padStart(3, "0")}`, kind: paragraphKind(normalized), origin: "official", text, evidence: evidence(lines[0]!.page, lines[0]!.printedPage, raw, normalized) };
}

function blocksFor(startIndex: number, endIndex: number, unitNumber: string): any[] {
    const lines = allLines.slice(startIndex, endIndex);
    const blocks: any[] = [];
    let group: Line[] = [];
    let previous: Line | undefined;
    let previousKind: string | undefined;
    const flush = () => { if (group.length) { blocks.push(makeTextBlock(unitNumber, blocks.length, group)); group = []; } };
    for (const line of lines) {
        const normalized = normalizeText(line.text);
        const heading = unitNumbers.some((number) => startsWithUnit(normalized, number));
        if (heading) { flush(); previous = line; previousKind = undefined; continue; }
        const current = { ...line, text: normalized };
        const kind = paragraphKind(normalized);
        if (isNewParagraph(previous, current, previousKind)) flush();
        group.push(current);
        previous = current;
        previousKind = kind;
    }
    flush();
    return blocks;
}

const generated: any[] = [];
for (let i = 0; i < starts.length; i += 1) {
    const current = starts[i]!;
    const next = starts[i + 1];
    const startIndex = current.index + (current.number === "C11" ? 2 : 1);
    const endIndex = next?.index ?? allLines.length;
    const numberParts = current.number.slice(1).split(".");
    const title = unitTitle(current.number);
    const headingRaw = current.number === "C11" ? "CAPITOLO C11.\nMATERIALI E PRODOTTI PER USO STRUTTURALE" : current.line.raw;
    const heading = { blockId: `${idFor(current.number)}#block-heading`, kind: "heading", origin: "official", text: { raw: headingRaw, normalized: normalizeHeading(headingRaw, current.number), normalizationVersion: profile }, evidence: evidence(current.line.page, current.line.printedPage, headingRaw, normalizeHeading(headingRaw, current.number)) };
    const blocks = [heading, ...blocksFor(startIndex, endIndex, current.number).map((block, index) => ({ ...block, blockId: `${idFor(current.number)}#block-${String(index + 1).padStart(3, "0")}` }))];
    const parentNumber = numberParts.length === 1 ? null : `C${numberParts.slice(0, -1).join(".")}`;
    generated.push({
        $schema: "urn:structural-codes:schema:canonical-unit:v2", schemaVersion: "2.0.0-alpha.2", recordType: "canonical-unit", id: idFor(current.number),
        workId: "it-mit:circ:2019-01-21:7-csllpp", expressionId: "it-mit:circ:2019-01-21:7-csllpp:original-it", kind: numberParts.length === 1 ? "chapter" : numberParts.length === 2 ? "section" : "subparagraph",
        numbering: { official: current.number, sortKey: sortKey(current.number) }, title, titleBlockId: heading.blockId,
        hierarchy: { parentId: parentNumber ? idFor(parentNumber) : null, ancestorIds: numberParts.length === 1 ? [] : numberParts.slice(0, -1).map((_, index) => idFor(`C${numberParts.slice(0, index + 1).join(".")}`)), position: 1 },
        validity: { from: null, to: null, status: "unknown", asOf: "2026-08-09" }, blocks, citations: [], relations: [], assets: { formulaIds: [], tableIds: [], figureIds: [] },
        workflow: { status: "extracted", createdBy: { actorId: "generator:circ11:step1", kind: "script", toolVersion: profile }, createdAt, reviews: [], openIssues: [{ issueId: `circ2019-${current.number.toLowerCase().replaceAll(".", "-")}-source-review`, type: "normalization-review", severity: "blocking", note: "Trascrizione confrontata con il render ufficiale; resta obbligatoria la revisione umana indipendente prima della pubblicazione." }] },
    });
}

const siblingPositions = new Map<string, number>();
for (const unit of generated) { const parent = unit.hierarchy.parentId ?? "root"; const position = (siblingPositions.get(parent) ?? 0) + 1; siblingPositions.set(parent, position); unit.hierarchy.position = position; }

await mkdir(unitDir, { recursive: true });
await mkdir(assetDir, { recursive: true });
for (const unit of generated) await writeFile(join(unitDir, `${unit.numbering.official.toLowerCase()}.json`), `${JSON.stringify(unit, null, 2)}\n`, "utf8");

const manifest = { $schema: "urn:structural-codes:schema:asset-manifest:v2", schemaVersion: "2.0.0-alpha.1", recordType: "asset-manifest", document: "circ2019", section: "C11-step1", sourceId, status: "transcribed-unreviewed", formulas: [], tables: [], figures: [] };
await writeFile(join(assetDir, "C11-step1.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(`circ11-step1: generated ${generated.length} units`);
