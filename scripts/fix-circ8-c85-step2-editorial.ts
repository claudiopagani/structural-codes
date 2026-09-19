import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();
const unitsDir = join(root, "corpus", "units", "circ2019");
const assetsPath = join(root, "corpus", "assets", "circ2019", "C8.5-step2.json");
const profile = "circ8-c85-step2-editorial-0.1.0";

type InlineKind = "text" | "math" | "em" | "underline" | "strong-em" | "strong";
type Inline = { kind: InlineKind; value: string; latex?: string };
type Evidence = { transformations?: Array<{ operation: string; ruleVersion: string; note: string }>; normalizedSha256?: string };
type Text = { normalized: string; inline?: Inline[]; normalizationVersion?: string };
type Block = { kind: string; text?: Text; evidence?: Evidence; assetId?: string; listMarker?: "numbered" | "bullet" | "dash" | "none"; listLevel?: number };
type Unit = { blocks: Block[] };
type Cell = { text: string; latex?: string; inline?: Inline[]; rowSpan?: number; colSpan?: number; align?: "left" | "center" | "right"; strong?: boolean; verticalText?: boolean };
type Table = { officialNumber: string; columnCount: number; columnWidths?: number[]; headers: Cell[][]; rows: Cell[][]; notes: string[] };
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

const c8542 = units.get("c8.5.4.2.json")!;
for (const prefix of ["LC1:", "LC2:", "LC3:"]) {
    const block = c8542.blocks.find((item) => item.text?.normalized.startsWith(prefix));
    if (!block) throw new Error(`C8.5.4.2: titolo non trovato: ${prefix}`);
    stylePrefix(block, prefix, "strong-em");
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
