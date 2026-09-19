import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

type Inline = { kind: "text" | "math"; value: string; latex?: string };
type Evidence = {
    sourceId: string;
    pdfPage: number;
    printedPage: string | null;
    region: unknown;
    extraction: Record<string, unknown>;
    transformations: Array<Record<string, unknown>>;
    rawSha256: string;
    normalizedSha256: string;
};
type Block = {
    blockId: string;
    kind: string;
    origin: "official";
    listMarker?: "bullet" | "dash" | "none";
    text?: { raw: string; normalized: string; normalizationVersion: string; inline?: Inline[] };
    assetId?: string;
    evidence?: Evidence;
};
type Unit = { blocks: Block[] };
type Cell = { text: string; latex?: string; inline?: Inline[]; align?: "left" | "center" | "right"; [key: string]: unknown };
type Table = { officialNumber: string; headers: Cell[][]; rows: Cell[][] };
type Manifest = { tables: Table[] };

const root = fileURLToPath(new URL("../", import.meta.url));
const unitPath = join(root, "corpus", "units", "ntc2018", "7.11.3.5.2.json");
const assetPath = join(root, "corpus", "assets", "ntc2018", "7.7-78-step2.json");
const profile = "ntc7-11-labeled-lists-0.1.0";

function hash(value: string): string {
    return createHash("sha256").update(value).digest("hex");
}

function evidenceFor(base: Evidence, raw: string, normalized: string, note: string): Evidence {
    return {
        ...base,
        transformations: [...base.transformations, { operation: "manual-correction", ruleVersion: profile, note }],
        rawSha256: hash(raw),
        normalizedSha256: hash(normalized),
    };
}

function textBlock(base: Block, suffix: string, kind: "paragraph" | "list-item", normalized: string, inline: Inline[], listMarker?: "none"): Block {
    const raw = normalized;
    return {
        blockId: `${base.blockId.split("#")[0]}#${suffix}`,
        kind,
        origin: "official",
        ...(listMarker ? { listMarker } : {}),
        text: { raw, normalized, normalizationVersion: base.text?.normalizationVersion ?? profile, inline },
        evidence: base.evidence ? evidenceFor(base.evidence, raw, normalized, "Ricostruito l’elenco labeled dopo le formule [7.11.4] e [7.11.5] sul render ufficiale.") : undefined,
    };
}

function splitDefinition(base: Block, definitions: Array<{ suffix: string; value: string; latex: string }>): Block[] {
    const baseSuffix = base.blockId.split("#")[1];
    if (!baseSuffix) throw new Error("Block suffix mancante per l’elenco labeled");
    const intro = textBlock(base, baseSuffix, "paragraph", "dove", [{ kind: "text", value: "dove" }]);
    const items = definitions.map(({ suffix, value, latex }) => {
        const separator = value.indexOf(" = ");
        const label = separator >= 0 ? value.slice(0, separator) : value;
        const rest = separator >= 0 ? value.slice(separator) : "";
        return textBlock(base, `${base.blockId.split("#")[1]}-${suffix}`, "list-item", value, [
            { kind: "math", value: label, latex },
            { kind: "text", value: rest },
        ], "none");
    });
    return [intro, ...items];
}

function alignRows(table: Table, rows: number[]): void {
    for (const rowIndex of rows) for (const cell of table.rows[rowIndex] ?? []) cell.align = "center";
}

function alignHeaderRows(table: Table, rows: number[]): void {
    for (const rowIndex of rows) for (const cell of table.headers[rowIndex] ?? []) cell.align = "center";
}

const unit = JSON.parse(await readFile(unitPath, "utf8")) as Unit;
const formula114Index = unit.blocks.findIndex((block) => block.assetId?.endsWith("-7.11.4"));
const formula115Index = unit.blocks.findIndex((block) => block.assetId?.endsWith("-7.11.5"));
if (formula114Index < 0 || formula115Index < 0) throw new Error("Formule [7.11.4] e [7.11.5] non trovate");

const after114 = unit.blocks[formula114Index + 1];
if (after114?.text?.normalized.startsWith("dove β_s")) {
    unit.blocks.splice(formula114Index + 1, 1, ...splitDefinition(after114, [
        { suffix: "beta-s", value: "β_s = coefficiente di riduzione dell’accelerazione massima attesa al sito;", latex: "\\beta_s" },
        { suffix: "a-max", value: "a_max = accelerazione orizzontale massima attesa al sito;", latex: "a_{max}" },
        { suffix: "g", value: "g = accelerazione di gravità.", latex: "g" },
    ]));
}

const refreshed115Index = unit.blocks.findIndex((block) => block.assetId?.endsWith("-7.11.5"));
const after115 = unit.blocks[refreshed115Index + 1];
if (after115?.text?.normalized.startsWith("dove S =")) {
    unit.blocks.splice(refreshed115Index + 1, 1, ...splitDefinition(after115, [
        { suffix: "s", value: "S = coefficiente che comprende l’effetto dell’amplificazione stratigrafica (S_S) e dell’amplificazione topografica (S_T), di cui al § 3.2.3.2;", latex: "S" },
        { suffix: "a-g", value: "a_g = accelerazione orizzontale massima attesa su sito di riferimento rigido.", latex: "a_g" },
    ]));
}

for (const [oldSuffix, newSuffix] of [["block-p2-intro", "block-p2"], ["block-p4-intro", "block-p4"]] as const) {
    const block = unit.blocks.find((candidate) => candidate.blockId.endsWith(`#${oldSuffix}`));
    const unitPrefix = block?.blockId.split("#")[0];
    if (block && unitPrefix) block.blockId = `${unitPrefix}#${newSuffix}`;
}

const manifest = JSON.parse(await readFile(assetPath, "utf8")) as Manifest;
for (const table of manifest.tables.filter((candidate) => ["7.11.I", "7.11.II", "7.11.III"].includes(candidate.officialNumber))) {
    if (table.officialNumber === "7.11.I") {
        alignHeaderRows(table, [1, 2]);
        alignRows(table, [1, 2]);
    } else {
        alignRows(table, [1]);
    }
}

await writeFile(unitPath, `${JSON.stringify(unit, null, 2)}\n`, "utf8");
await writeFile(assetPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
