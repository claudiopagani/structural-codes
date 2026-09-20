import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();
const unitsDir = join(root, "corpus", "units", "circ2019");
const assetsPath = join(root, "corpus", "assets", "circ2019", "C8.5-step2.json");
const profile = "circ8-c85-step2-editorial-0.1.0";

type InlineKind = "text" | "math" | "em" | "underline" | "strong-em" | "strong";
type Inline = { kind: InlineKind; value: string; latex?: string };
type Evidence = { transformations?: Array<{ operation: string; ruleVersion: string; note: string }>; rawSha256?: string; normalizedSha256?: string };
type Text = { raw?: string; normalized: string; inline?: Inline[]; normalizationVersion?: string };
type Block = { blockId?: string; kind: string; text?: Text; evidence?: Evidence; assetId?: string; listMarker?: "numbered" | "bullet" | "dash" | "none"; listLevel?: number; indentLevel?: number };
type Unit = { blocks: Block[] };
type Cell = { text: string; latex?: string; inline?: Inline[]; rowSpan?: number; colSpan?: number; align?: "left" | "center" | "right"; strong?: boolean; verticalText?: boolean };
type Table = { officialNumber: string; columnCount: number; columnWidths?: number[]; headers: Cell[][]; rows: Cell[][]; notes: string[]; notesInline?: Inline[][] };
type AssetManifest = { tables: Table[] };

async function readJson<T>(path: string): Promise<T> {
    return JSON.parse(await readFile(path, "utf8")) as T;
}

async function writeJson(path: string, value: unknown): Promise<void> {
    await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function addTransformation(block: Block, note: string): void {
    if (!block.evidence) return;
    block.evidence.transformations ??= [];
    if (!block.evidence.transformations.some((item) => item.ruleVersion === profile && item.note === note)) {
        block.evidence.transformations.push({ operation: "manual-correction", ruleVersion: profile, note });
    }
}

function updateNormalizedHash(block: Block): void {
    if (!block.text || !block.evidence) return;
    block.evidence.normalizedSha256 = createHash("sha256").update(block.text.normalized, "utf8").digest("hex");
}

function updateRawHash(block: Block): void {
    if (!block.text?.raw || !block.evidence) return;
    block.evidence.rawSha256 = createHash("sha256").update(block.text.raw, "utf8").digest("hex");
}

function stylePrefix(block: Block, prefix: string, kind: "strong-em" | "em" | "underline"): void {
    if (!block.text) throw new Error(`Blocco senza testo per il prefisso ${prefix}`);
    const source = block.text.inline ?? [{ kind: "text" as const, value: block.text.normalized }];
    const plain = source.map((segment) => segment.value).join("");
    if (!plain.startsWith(prefix)) throw new Error(`Prefisso non trovato: ${prefix}`);
    let remaining = prefix.length;
    const result: Inline[] = [];
    for (const segment of source) {
        if (remaining === 0) {
            result.push(segment);
        } else if (segment.value.length <= remaining) {
            result.push({ kind, value: segment.value });
            remaining -= segment.value.length;
        } else {
            result.push({ kind, value: segment.value.slice(0, remaining) });
            result.push({ ...segment, value: segment.value.slice(remaining) });
            remaining = 0;
        }
    }
    if (remaining !== 0) throw new Error(`Prefisso troncato: ${prefix}`);
    block.text.inline = result;
    block.text.normalizationVersion = profile;
    updateNormalizedHash(block);
    addTransformation(block, `Applicata la resa tipografica verificata del titolo iniziale: ${prefix}`);
}

function styleOccurrences(block: Block, tokens: string[], kind: "strong-em" | "em"): void {
    if (!block.text) throw new Error("Blocco senza testo per l’enfasi");
    let segments = block.text.inline ?? [{ kind: "text" as const, value: block.text.normalized }];
    let changed = false;
    for (const token of [...tokens].sort((a, b) => b.length - a.length)) {
        const nextSegments: Inline[] = [];
        for (const segment of segments) {
            if (segment.kind !== "text" || !segment.value.includes(token)) {
                nextSegments.push(segment);
                continue;
            }
            let cursor = 0;
            while (true) {
                const at = segment.value.indexOf(token, cursor);
                if (at < 0) break;
                if (at > cursor) nextSegments.push({ kind: "text", value: segment.value.slice(cursor, at) });
                nextSegments.push({ kind, value: token });
                cursor = at + token.length;
                changed = true;
            }
            if (cursor < segment.value.length) nextSegments.push({ kind: "text", value: segment.value.slice(cursor) });
        }
        segments = nextSegments;
    }
    if (!changed) return;
    block.text.inline = segments;
    block.text.normalizationVersion = profile;
    updateNormalizedHash(block);
    addTransformation(block, `Applicata la resa in ${kind === "strong-em" ? "grassetto corsivo" : "corsivo"} delle parole chiave verificata sul PDF ufficiale.`);
}

function splitLc3Nested(unit: Unit, block: Block): void {
    if (!block.text || block.kind !== "list-item" || block.listLevel !== 0) return;
    if (unit.blocks.some((candidate) => candidate.blockId === `${block.blockId}-nested`)) return;
    const prefix = "LC3:";
    const plain = block.text.normalized;
    if (!plain.startsWith(prefix)) throw new Error(`Blocco LC3 non riconosciuto: ${plain}`);
    const nestedText = plain.slice(prefix.length).trimStart();
    const nested: Block = JSON.parse(JSON.stringify(block)) as Block;
    nested.blockId = `${block.blockId ?? "c8.5.4.1-lc3"}-nested`;
    nested.kind = "list-item";
    nested.listMarker = "none";
    nested.listLevel = 1;
    nested.indentLevel = 1;
    nested.text = {
        raw: nestedText,
        normalized: nestedText,
        inline: block.text.inline?.[0]?.value === prefix
            ? block.text.inline.slice(1).map((segment, index) => index === 0 ? { ...segment, value: segment.value.replace(/^\s+/u, "") } : segment)
            : [{ kind: "text", value: nestedText }],
        normalizationVersion: profile,
    };
    block.text.raw = prefix;
    block.text.normalized = prefix;
    block.text.inline = [{ kind: "strong-em", value: prefix }];
    block.text.normalizationVersion = profile;
    updateRawHash(block);
    updateNormalizedHash(block);
    updateRawHash(nested);
    updateNormalizedHash(nested);
    addTransformation(block, "Separata la voce LC3 dal paragrafo annidato secondo il rientro verificato sul PDF ufficiale.");
    addTransformation(nested, "Inserito il paragrafo descrittivo LC3 come elemento annidato, includendo il rientro delle formule successive.");
    const index = unit.blocks.indexOf(block);
    unit.blocks.splice(index + 1, 0, nested);
}

function setTableAlignments(table: Table, firstColumn: "left" | "center" = "center"): void {
    table.headers.forEach((row) => row.forEach((cell) => { cell.align = "center"; }));
    table.rows.forEach((row) => row.forEach((cell, index) => { cell.align = index === 0 ? firstColumn : "center"; }));
}

function removeDashAfterLabel(block: Block, label: string): void {
    if (!block.text) throw new Error(`Blocco senza testo per ${label}`);
    const marker = `${label} -`;
    if (block.text.normalized.includes(marker)) {
        block.text.normalized = block.text.normalized.replace(marker, `${label} `);
        if (block.text.inline) {
            block.text.inline = block.text.inline.map((segment) => ({
                ...segment,
                value: segment.value.replace(marker, `${label} `),
            }));
        }
    }
    block.text.normalizationVersion = profile;
    updateNormalizedHash(block);
    addTransformation(block, `Separato il marcatore dell’elenco annidato dal titolo ${label}.`);
}

function removeLeadingDash(block: Block): void {
    if (!block.text) throw new Error("Blocco senza testo per il trattino");
    if (!/^\s*-\s*/u.test(block.text.normalized)) throw new Error("Trattino iniziale non trovato");
    block.text.normalized = block.text.normalized.replace(/^\s*-\s*/u, "");
    block.text.inline = block.text.inline?.map((segment, index) => index === 0 ? { ...segment, value: segment.value.replace(/^\s*-\s*/u, "") } : segment);
    block.text.normalizationVersion = profile;
    updateNormalizedHash(block);
    addTransformation(block, "Separato il marcatore dash dell’elenco annidato dal testo della voce.");
}

const unitFiles = ["c8.5.3.2.json", "c8.5.3.3.json", "c8.5.4.json", "c8.5.4.1.json", "c8.5.4.2.json", "c8.5.5.1.json"];
const units = new Map<string, Unit>();
for (const file of unitFiles) units.set(file, await readJson<Unit>(join(unitsDir, file)));

for (const file of ["c8.5.3.2.json", "c8.5.3.3.json"]) {
    const unit = units.get(file)!;
    for (const prefix of ["Calcestruzzo:", "Acciaio:", "Unioni di elementi d’acciaio:", "Prove limitate:", "Prove estese:", "Prove esaustive:"]) {
        const block = unit.blocks.find((item) => item.text?.normalized.startsWith(prefix));
        if (block) stylePrefix(block, prefix, "strong-em");
    }
}

const c854 = units.get("c8.5.4.json")!;
for (const prefix of ["LC1:", "LC2:", "LC3:"]) {
    const block = c854.blocks.find((item) => item.text?.normalized.startsWith(prefix));
    if (!block) throw new Error(`C8.5.4: titolo non trovato: ${prefix}`);
    stylePrefix(block, prefix, "strong-em");
}
for (const block of c854.blocks) {
    if (block.text) styleOccurrences(block, ["indagini limitate", "prove limitate", "indagine estesa", "indagini estese", "prove estese", "indagine esaustiva", "indagini esaustive", "prove esaustive"], "strong-em");
}

const c8541 = units.get("c8.5.4.1.json")!;
for (const block of c8541.blocks) {
    if (block.text) {
        delete (block.text as Text & { listMarker?: unknown }).listMarker;
        delete (block.text as Text & { listLevel?: unknown }).listLevel;
    }
}
const lc1 = c8541.blocks.find((item) => item.text?.normalized.startsWith("LC1:"));
const lc2 = c8541.blocks.find((item) => item.text?.normalized.startsWith("LC2:"));
const lc3 = c8541.blocks.find((item) => item.text?.normalized.startsWith("LC3:"));
if (!lc1 || !lc2 || !lc3) throw new Error("C8.5.4.1: voci LC1–LC3 non trovate");
for (const [label, block] of [["LC1:", lc1], ["LC2:", lc2], ["LC3:", lc3]] as const) {
    removeDashAfterLabel(block, label);
    block.kind = "list-item";
    block.listMarker = "none";
    block.listLevel = 0;
    stylePrefix(block, label, "strong-em");
}
for (const block of c8541.blocks) {
    if (block.text?.normalized.startsWith("-") || block.text?.normalized.startsWith("Moduli elastici:")) {
        block.kind = "list-item";
        block.listMarker = "dash";
        block.listLevel = 1;
        if (block.text.normalized.startsWith("-")) removeLeadingDash(block);
    }
}
splitLc3Nested(c8541, lc3);
const lc3NestedIndex = c8541.blocks.findIndex((item) => item.blockId?.endsWith("-nested"));
if (lc3NestedIndex < 0) throw new Error("C8.5.4.1: paragrafo LC3 annidato non trovato");
updateRawHash(c8541.blocks[lc3NestedIndex - 1]!);
updateRawHash(c8541.blocks[lc3NestedIndex]!);
for (let index = lc3NestedIndex + 1; index < c8541.blocks.length; index += 1) {
    const block = c8541.blocks[index]!;
    if (block.kind === "table-ref" || block.kind === "footnote") break;
    if (block.kind === "formula-ref") {
        delete block.listLevel;
        block.indentLevel = 1;
    } else {
        block.listLevel = 1;
        delete block.indentLevel;
    }
    addTransformation(block, "Allineato al rientro dell’elemento LC3 annidato, comprese le formule e la relativa descrizione.");
}

const c8542 = units.get("c8.5.4.2.json")!;
for (const prefix of ["LC1:", "LC2:", "LC3:"]) {
    const block = c8542.blocks.find((item) => item.text?.normalized.startsWith(prefix));
    if (!block) throw new Error(`C8.5.4.2: titolo non trovato: ${prefix}`);
    stylePrefix(block, prefix, "strong-em");
}
for (const block of c8542.blocks) {
    if (block.text) styleOccurrences(block, ["indagini limitate", "prove limitate", "indagine estesa", "indagini estese", "prove estese", "indagine esaustiva", "indagini esaustive", "prove esaustive"], "strong-em");
}

const c8551 = units.get("c8.5.5.1.json")!;
for (const block of c8551.blocks.filter((item) => item.kind === "list-item")) {
    delete (block.text as Text & { listMarker?: unknown }).listMarker;
    delete (block.text as Text & { listLevel?: unknown }).listLevel;
    block.listMarker = "none";
    block.listLevel = 0;
    block.text!.normalizationVersion = profile;
    addTransformation(block, "Resa come elenco labeled con descrizione allineata al label matematico.");
}
const underlined = c8551.blocks.find((item) => item.text?.normalized.startsWith("in cui "));
if (!underlined?.text) throw new Error("C8.5.5.1: frase da sottolineare non trovata");
underlined.text.inline = [
    { kind: "text", value: "in cui " },
    { kind: "math", value: "α_u", latex: "\\alpha_u" },
    { kind: "text", value: " e " },
    { kind: "math", value: "α_1", latex: "\\alpha_1" },
    { kind: "text", value: " sono definiti al § 7.8.1.3 delle NTC. " },
    { kind: "underline", value: "In assenza di più precise valutazioni, non può essere assunto un rapporto " },
    { kind: "math", value: "α_u/α_1", latex: "\\underline{\\alpha_u/\\alpha_1}" },
    { kind: "underline", value: " superiore a 1,5." },
];
underlined.text.normalizationVersion = profile;
updateNormalizedHash(underlined as Block);
addTransformation(underlined, "Sottolineata la limitazione sul rapporto α_u/α_1 verificata sul render ufficiale.");

const assets = await readJson<AssetManifest>(assetsPath);
const tableIII = assets.tables.find((table) => table.officialNumber === "C8.5.III");
const tableIV = assets.tables.find((table) => table.officialNumber === "C8.5.IV");
const tableV = assets.tables.find((table) => table.officialNumber === "C8.5.V");
const tableVI = assets.tables.find((table) => table.officialNumber === "C8.5.VI");
if (!tableIII || !tableIV || !tableV || !tableVI) throw new Error("Tabelle C8.5.III–VI non trovate");

setTableAlignments(tableIII, "left");
tableIII.columnWidths = [62, 19, 19];
const tableFootnoteBlocks = c8541.blocks.filter((block) => block.kind === "footnote" && /^\(\*{1,2}\)/u.test(block.text?.normalized ?? ""));
if (tableFootnoteBlocks.length > 0) {
    if (tableFootnoteBlocks.length !== 2) throw new Error("C8.5.III: note (*) e (**) non trovate fuori dalla tabella");
    tableIII.notes = tableFootnoteBlocks.map((block) => block.text!.normalized);
    tableIII.notesInline = tableFootnoteBlocks.map((block) => {
        const inline = block.text!.inline ?? [{ kind: "text" as const, value: block.text!.normalized }];
        const marker = inline[0]?.value.match(/^\(\*{1,2}\)/u)?.[0];
        if (!marker) return inline;
        return [
            { kind: "math" as const, value: marker, latex: `^{${marker}}` },
            ...(inline[0]!.value.length > marker.length ? [{ ...inline[0]!, value: inline[0]!.value.slice(marker.length) }] : []),
            ...inline.slice(1),
        ];
    });
    for (const block of tableFootnoteBlocks) {
        const index = c8541.blocks.indexOf(block);
        if (index >= 0) c8541.blocks.splice(index, 1);
    }
}
for (const row of tableIII.rows) {
    row.forEach((cell, index) => { cell.align = row.length === tableIII.columnCount && index === 0 ? "left" : "center"; });
}
const starredParameter = tableIII.rows.flat().find((cell) => cell.text === "f (*)");
if (!starredParameter) throw new Error("C8.5.III: parametro f con nota (*) non trovato");
starredParameter.inline = [{ kind: "math", value: "f", latex: "f" }, { kind: "math", value: "(*)", latex: "^{(*)}" }];

tableIV.headers[0]![0]!.text = "Livello di\nconoscenza";
tableIV.headers[0]![1]!.text = "Geometrie\n(carpenterie)";
tableIV.columnWidths = [15, 18, 19, 19, 18, 11];
setTableAlignments(tableIV, "center");

function superscriptNotes(cell: Cell, parts: Array<[string, string?]>): void {
    cell.inline = parts.map(([value, latex]) => latex ? { kind: "math" as const, value, latex } : { kind: "text" as const, value });
}

for (const table of [tableV, tableVI]) {
    setTableAlignments(table, "center");
    superscriptNotes(table.headers[0]![1]!, [[table.headers[0]![1]!.text.replace("(a)", ""), undefined], ["(a)", "^{(a)}"]]);
    superscriptNotes(table.headers[0]![2]!, [[table.headers[0]![2]!.text.replace(/\s*\([b-d]\)/gu, ""), undefined], ["(b)", "^{(b)}"], ["(c)", "^{(c)}"], ["(d)", "^{(d)}"]]);
}

for (const unit of units.values()) {
    for (const block of unit.blocks) updateNormalizedHash(block);
}
for (const [file, unit] of units) await writeJson(join(unitsDir, file), unit);
await writeJson(assetsPath, assets);
console.log("fix-circ8-c85-step2-editorial: C8.5.3.2–C8.5.5.1 e Tabelle C8.5.III–VI aggiornati");
