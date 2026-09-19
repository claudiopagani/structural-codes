import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

type Inline = { kind: "text" | "em" | "strong" | "strong-em" | "math"; value: string; latex?: string };
type Evidence = { sourceId: string; pdfPage: number; printedPage: string | null; region: unknown; extraction: Record<string, unknown>; transformations: Array<Record<string, unknown>>; rawSha256: string; normalizedSha256: string };
type Block = { blockId: string; kind: string; origin: "official"; listMarker?: "bullet" | "dash" | "none"; listLevel?: number; text?: { raw: string; normalized: string; normalizationVersion: string; inline?: Inline[] }; assetId?: string; evidence?: Evidence };
type Unit = { blocks: Block[] };
type Cell = { text: string; latex?: string; inline?: Inline[]; align?: "left" | "center" | "right"; colSpan?: number; rowSpan?: number; shade?: "gray"; subrowIndent?: boolean; [key: string]: unknown };
type Table = { officialNumber: string; headers: Cell[][]; rows: Cell[][]; columnWidths?: number[] };
type Manifest = { tables: Table[] };

const root = fileURLToPath(new URL("../", import.meta.url));
const unitsDir = join(root, "corpus", "units", "ntc2018");
const profile = "ntc7-latest-editorial-0.1.0";

function ok(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
function hash(value: string): string { return createHash("sha256").update(value).digest("hex"); }
function unitPath(number: string): string { return join(unitsDir, `${number}.json`); }
async function readUnit(number: string): Promise<Unit> { return JSON.parse(await readFile(unitPath(number), "utf8")) as Unit; }
async function writeUnit(number: string, unit: Unit): Promise<void> { await writeFile(unitPath(number), `${JSON.stringify(unit, null, 2)}\n`, "utf8"); }

function heading(unit: Unit, title: string): void {
    const value = unit.blocks.find((candidate) => candidate.kind === "heading" && candidate.text?.normalized === title);
    ok(value?.text, `Titolo mancante: ${title}`);
    value.text.inline = [{ kind: "strong-em", value: title }];
}

function inlineLabel(value: string, latex: string, description: string): Inline[] {
    return [{ kind: "math", value, latex }, { kind: "text", value: description }];
}

function splitDefinitions(base: Block, definitions: Array<{ suffix: string; value: string; latex: string }>, note: string): Block[] {
    const prefix = base.blockId.split("#")[0];
    const baseSuffix = base.blockId.split("#")[1];
    ok(prefix && baseSuffix && base.text, "Blocco base invalido per elenco labeled");
    const evidence = (normalized: string): Evidence | undefined => base.evidence ? {
        ...base.evidence,
        transformations: [...base.evidence.transformations, { operation: "manual-correction", ruleVersion: profile, note }],
        rawSha256: hash(normalized),
        normalizedSha256: hash(normalized),
    } : undefined;
    const intro: Block = {
        blockId: `${prefix}#${baseSuffix}`,
        kind: "paragraph",
        origin: "official",
        text: { raw: "dove:", normalized: "dove:", normalizationVersion: base.text.normalizationVersion, inline: [{ kind: "text", value: "dove:" }] },
        evidence: evidence("dove:"),
    };
    return [intro, ...definitions.map(({ suffix, value, latex }) => ({
        blockId: `${prefix}#${baseSuffix}-${suffix}`,
        kind: "list-item",
        origin: "official" as const,
        listMarker: "none" as const,
        text: { raw: value, normalized: value, normalizationVersion: base.text!.normalizationVersion, inline: inlineLabel(value.slice(0, value.indexOf(" = ")), latex, value.slice(value.indexOf(" = "))) },
        evidence: evidence(value),
    }))];
}

function setHeadingStyles(unit: Unit, titles: string[]): void { for (const title of titles) heading(unit, title); }
function everyCell(table: Table, callback: (cell: Cell, index: number) => void): void {
    for (const row of [...table.headers, ...table.rows]) row.forEach(callback);
}

const step2Path = join(root, "corpus", "assets", "ntc2018", "7-step2.json");
const step2 = JSON.parse(await readFile(step2Path, "utf8")) as Manifest;
const table73ii = step2.tables.find((table) => table.officialNumber === "7.3.II");
ok(table73ii, "Tab. 7.3.II mancante");
const bridgeRows = table73ii.rows.slice(-3);
const bridgeTitles = ["Pile in calcestruzzo armato", "Pile in acciaio:", "Spalle"];
bridgeRows.forEach((row, index) => {
    const first = row[0];
    ok(first, `Riga Ponti ${index} mancante`);
    const title = bridgeTitles[index]!;
    const remainder = first.text.slice(title.length);
    ok(first.text.startsWith(title), `Titolo Ponti inatteso: ${first.text}`);
    first.align = "left";
    first.subrowIndent = true;
    first.inline = [{ kind: "strong", value: title }, { kind: "text", value: remainder }];
});

const step6Path = join(root, "corpus", "assets", "ntc2018", "7.6-step1.json");
const step6 = JSON.parse(await readFile(step6Path, "utf8")) as Manifest;
const table76i = step6.tables.find((table) => table.officialNumber === "7.6.I");
ok(table76i, "Tab. 7.6.I mancante");
for (const row of [...table76i.headers, ...table76i.rows]) for (const index of [1, 2]) if (row[index]) row[index]!.align = "center";
const table76iii = step6.tables.find((table) => table.officialNumber === "7.6.III");
ok(table76iii, "Tab. 7.6.III mancante");
for (const row of [...table76iii.headers, ...table76iii.rows]) {
    if (row[0]) row[0]!.align = "center";
    if (row[1]) row[1]!.align = "center";
    if (row[2]) row[2]!.align = "left";
}
const table76iiiLast = table76iii.rows[2]?.[2];
ok(table76iiiLast, "Cella finale Tab. 7.6.III mancante");
table76iiiLast.text = "Per M^-: 0\nPer M^+: 0,025 L";
table76iiiLast.latex = "\\begin{gathered}\\text{Per }M^-:0\\\\\\text{Per }M^+:0{,}025L\\end{gathered}";

const step78Path = join(root, "corpus", "assets", "ntc2018", "7.7-78-step2.json");
const step78 = JSON.parse(await readFile(step78Path, "utf8")) as Manifest;
const table78ii = step78.tables.find((table) => table.officialNumber === "7.8.II");
ok(table78ii, "Tab. 7.8.II mancante");
table78ii.columnWidths = [10, 6, 9, 9, 9, 9, 9, 9, 9, 9, 12];
for (const row of [...table78ii.headers, ...table78ii.rows]) for (const cell of row) cell.align = "center";
for (const row of table78ii.rows) {
    const first = row[0];
    if (!first || !["Muratura ordinaria", "Muratura armata"].includes(first.text)) continue;
    const [kind, material] = first.text.split(" ");
    first.text = `${kind}\n${material}`;
    first.latex = `\\begin{gathered}\\text{${kind}}\\\\\\text{${material}}\\end{gathered}`;
}

const table117 = step78.tables.find((table) => table.officialNumber === "7.11.I");
ok(table117, "Tab. 7.11.I mancante");
everyCell(table117, (cell) => { cell.align = "center"; });
for (const number of ["7.11.II", "7.11.III"]) {
    const table = step78.tables.find((candidate) => candidate.officialNumber === number);
    ok(table, `Tab. ${number} mancante`);
    for (const row of [...table.headers, ...table.rows]) { if (row[0]) row[0]!.align = "left"; if (row[1]) row[1]!.align = "center"; }
}
await writeFile(step2Path, `${JSON.stringify(step2, null, 2)}\n`, "utf8");
await writeFile(step6Path, `${JSON.stringify(step6, null, 2)}\n`, "utf8");
await writeFile(step78Path, `${JSON.stringify(step78, null, 2)}\n`, "utf8");

const n731 = await readUnit("7.3.1");
heading(n731, "Effetti delle non linearità geometriche");
await writeUnit("7.3.1", n731);

const walls = await readUnit("7.4.4.5.1");
setHeadingStyles(walls, ["Presso-flessione", "Taglio", "Verifica a taglio-compressione del calcestruzzo dell’anima", "Verifica a taglio-trazione dell’armatura dell’anima", "Verifica a scorrimento nelle zone dissipative"]);
await writeUnit("7.4.4.5.1", walls);

for (const number of ["7.4.6.2.1", "7.4.6.2.2", "7.4.6.2.4"]) {
    const unit = await readUnit(number);
    setHeadingStyles(unit, ["Armature longitudinali", "Armature trasversali", "Armature inclinate", "Dettagli costruttivi per la duttilità"].filter((title) => unit.blocks.some((candidate) => candidate.kind === "heading" && candidate.text?.normalized === title)));
    await writeUnit(number, unit);
}

const columns = await readUnit("7.4.6.2.2");
const formulaIndex = columns.blocks.findIndex((candidate) => candidate.assetId?.endsWith(":7.4.28:staffe-minime"));
ok(formulaIndex >= 0, "Formula delle staffe minime assente");
if (!columns.blocks.some((candidate) => candidate.text?.normalized.startsWith("dove d_{bl,max}"))) {
    const base = columns.blocks[formulaIndex]!;
    const evidenceBase = base.evidence ?? columns.blocks[formulaIndex - 1]?.evidence ?? columns.blocks[formulaIndex + 1]?.evidence;
    ok(evidenceBase, "Evidence formula staffe minime assente");
    const normalized = "dove d_{bl,max} è il diametro massimo delle barre longitudinali, f_{yd,l} e f_{yd,st} sono, rispettivamente, la tensione di snervamento di progetto delle barre longitudinali e delle staffe.";
    columns.blocks.splice(formulaIndex + 1, 0, {
        blockId: `${base.blockId.split("#")[0]}#block-editorial-012a`,
        kind: "paragraph",
        origin: "official",
        text: { raw: normalized, normalized, normalizationVersion: columns.blocks[formulaIndex - 1]?.text?.normalizationVersion ?? profile, inline: [
            { kind: "text", value: "dove " },
            { kind: "math", value: "d_{bl,max}", latex: "d_{bl,\\max}" },
            { kind: "text", value: " è il diametro massimo delle barre longitudinali, " },
            { kind: "math", value: "f_{yd,l}", latex: "f_{yd,l}" },
            { kind: "text", value: " e " },
            { kind: "math", value: "f_{yd,st}", latex: "f_{yd,st}" },
            { kind: "text", value: " sono, rispettivamente, la tensione di snervamento di progetto delle barre longitudinali e delle staffe." },
        ] },
        evidence: { ...evidenceBase, transformations: [...evidenceBase.transformations, { operation: "manual-correction", ruleVersion: profile, note: "Reintegrata la descrizione di d_{bl,max}, f_{yd,l} e f_{yd,st} verificata nel PDF ufficiale." }], rawSha256: hash(normalized), normalizedSha256: hash(normalized) },
    });
}
await writeUnit("7.4.6.2.2", columns);

const steelTypes = await readUnit("7.5.2.1");
for (const value of steelTypes.blocks) {
    if (value.kind !== "list-item" || !value.text) continue;
    if (/^b[1-3]\)/u.test(value.text.normalized)) value.listLevel = 1;
    if (/^(?:a\)|b\)|c\)|d\)|e\)|f\))/u.test(value.text.normalized) && value.listLevel === 1) delete value.listLevel;
}
await writeUnit("7.5.2.1", steelTypes);

const behavior = await readUnit("7.5.2.2");
for (const value of behavior.blocks) if (value.kind === "list-item") { value.listMarker = "dash"; value.listLevel = 0; }
await writeUnit("7.5.2.2", behavior);

const eccentric = await readUnit("7.5.6");
const gamma = eccentric.blocks.find((value) => value.text?.normalized.startsWith("γ_{ov} è il coefficiente"));
if (gamma) {
    gamma.kind = "list-item";
    gamma.listMarker = "none";
    gamma.text!.inline = inlineLabel("γ_{ov}", "\\gamma_{ov}", gamma.text!.normalized.slice("γ_{ov}".length));
}
await writeUnit("7.5.6", eccentric);

const masonry = await readUnit("7.8.1.3");
for (const value of masonry.blocks) if (value.kind === "list-item" && value.listMarker === "dash") value.listLevel = 0;
await writeUnit("7.8.1.3", masonry);

const wallUnitPath = unitPath("7.11.6.2.1");
const wallUnit = JSON.parse(await readFile(wallUnitPath, "utf8")) as Unit;
const formula117Index = wallUnit.blocks.findIndex((candidate) => candidate.assetId?.endsWith("-7.11.7"));
ok(formula117Index >= 0, "Formula [7.11.7] assente");
const after117 = wallUnit.blocks[formula117Index + 1];
if (after117?.text?.normalized.startsWith("dove β_m")) {
    wallUnit.blocks.splice(formula117Index + 1, 1, ...splitDefinitions(after117, [
        { suffix: "beta-m", value: "β_m = coefficiente di riduzione dell’accelerazione massima attesa al sito;", latex: "\\beta_m" },
        { suffix: "a-max", value: "a_max = accelerazione orizzontale massima attesa al sito;", latex: "a_{max}" },
        { suffix: "g", value: "g = accelerazione di gravità.", latex: "g" },
    ], "Ricostruito l’elenco labeled dopo la formula [7.11.7] sul render ufficiale."));
}
await writeFile(wallUnitPath, `${JSON.stringify(wallUnit, null, 2)}\n`, "utf8");

console.log("fix-ntc7-latest-step12: tabelle, titoli ed elenchi aggiornati");
