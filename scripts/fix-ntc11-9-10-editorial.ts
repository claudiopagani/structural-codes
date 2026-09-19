import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

/* eslint-disable @typescript-eslint/no-explicit-any */
const repoRoot = fileURLToPath(new URL("../", import.meta.url));
const unitDir = join(repoRoot, "corpus", "units", "ntc2018");
type AnyRecord = Record<string, any>;

async function readUnit(number: string): Promise<AnyRecord> {
    return JSON.parse(await readFile(join(unitDir, `${number}.json`), "utf8")) as AnyRecord;
}

async function writeUnit(number: string, unit: AnyRecord): Promise<void> {
    await writeFile(join(unitDir, `${number}.json`), `${JSON.stringify(unit, null, 2)}\n`, "utf8");
}

function hash(value: string): string {
    return createHash("sha256").update(value).digest("hex");
}

function addTransformation(block: AnyRecord, note: string): void {
    block.evidence ??= {};
    block.evidence.transformations ??= [];
    block.evidence.transformations = block.evidence.transformations.filter((transformation: AnyRecord, index: number, all: AnyRecord[]) => all.findIndex((candidate) => candidate.note === transformation.note) === index);
    if (block.evidence.transformations.some((transformation: AnyRecord) => transformation.note === note)) return;
    block.evidence.transformations.push({ operation: "manual-correction", ruleVersion: "ntc11-editorial-formatting-0.2.0", note });
}

function updateText(block: AnyRecord, raw: string, normalized: string, inline: AnyRecord[]): void {
    block.text.raw = raw;
    block.text.normalized = normalized;
    block.text.inline = inline;
    if (block.evidence) {
        block.evidence.rawSha256 = hash(raw);
        block.evidence.normalizedSha256 = hash(normalized);
    }
}

function splitListBlock(block: AnyRecord, splitAt: string, childSuffix: string, categoryLevel: number, note: string): AnyRecord {
    const source = block.text;
    const normalizedIndex = source.normalized.indexOf(splitAt);
    const rawIndex = source.raw.indexOf(splitAt);
    if (normalizedIndex < 0 || rawIndex < 0) throw new Error(`Separatore non trovato nel blocco ${block.blockId}`);
    const categoryNormalized = source.normalized.slice(0, normalizedIndex).trim();
    const childNormalized = source.normalized.slice(normalizedIndex).trim();
    const categoryRaw = source.raw.slice(0, rawIndex).trimEnd();
    const childRaw = source.raw.slice(rawIndex).trimStart();
    const originalInline = source.inline as AnyRecord[];
    const labelIndex = originalInline.findIndex((segment) => segment.kind === "em" && String(segment.value).startsWith(splitAt));
    if (labelIndex < 0) throw new Error(`Etichetta non trovata nel blocco ${block.blockId}`);
    const categoryInline = originalInline.slice(0, labelIndex).map((segment) => ({ ...segment }));
    const childInline = originalInline.slice(labelIndex).map((segment) => ({ ...segment }));
    updateText(block, categoryRaw, categoryNormalized, categoryInline);
    block.kind = "list-item";
    block.listMarker = "bullet";
    block.listLevel = categoryLevel;
    addTransformation(block, note);
    const child = JSON.parse(JSON.stringify(block)) as AnyRecord;
    child.blockId = block.blockId.replace(/#block-([0-9]+)$/u, `#block-$1-${childSuffix}`);
    updateText(child, childRaw, childNormalized, childInline);
    child.listLevel = categoryLevel + 1;
    addTransformation(child, note);
    return child;
}

const listUnit = await readUnit("11.9.1");
for (const block of listUnit.blocks) {
    if (block.blockId.endsWith("#block-002") || block.blockId.endsWith("#block-003") || block.blockId.endsWith("#block-004") || block.blockId.endsWith("#block-006") || block.blockId.endsWith("#block-008") || block.blockId.endsWith("#block-010") || block.blockId.endsWith("#block-011") || block.blockId.endsWith("#block-012")) {
        block.kind = "list-item";
        block.listMarker = "bullet";
        block.listLevel = block.blockId.endsWith("#block-002") || block.blockId.endsWith("#block-008") || block.blockId.endsWith("#block-012") ? 0 : 1;
        addTransformation(block, "Ricostruito l’elenco puntato con il livello di annidamento verificato nel render ufficiale.");
    }
}
const movement = listUnit.blocks.find((block: AnyRecord) => block.blockId.endsWith("#block-005"));
const velocity = listUnit.blocks.find((block: AnyRecord) => block.blockId.endsWith("#block-007"));
if (!movement || !velocity) throw new Error("Categorie 11.9.1 non trovate");
if (movement.text.normalized.includes("Dispositivi a comportamento lineare")) {
    const movementChild = splitListBlock(movement, "Dispositivi a comportamento lineare", "lineare", 0, "Separata la categoria principale dalla voce innestata dell’elenco.");
    const movementIndex = listUnit.blocks.indexOf(movement);
    listUnit.blocks.splice(movementIndex + 1, 0, movementChild);
} else if (movement.text.inline?.length) {
    movement.text.inline.at(-1).value = movement.text.inline.at(-1).value.trimEnd();
}
if (velocity.text.normalized.includes("Dispositivi a comportamento viscoso")) {
    const velocityChild = splitListBlock(velocity, "Dispositivi a comportamento viscoso", "viscoso", 0, "Separata la categoria principale dalla voce innestata dell’elenco.");
    const velocityIndex = listUnit.blocks.indexOf(velocity);
    listUnit.blocks.splice(velocityIndex + 1, 0, velocityChild);
} else if (velocity.text.inline?.length) {
    velocity.text.inline.at(-1).value = velocity.text.inline.at(-1).value.trimEnd();
}
await writeUnit("11.9.1", listUnit);

const labelUnit = await readUnit("11.9.5");
const labels = new Map<number, [string, string]>([
    [6, ["del", "d_{el}"]], [7, ["Fel", "F_{el}"]], [8, ["d1", "d_1"]],
    [9, ["F1", "F_1"]], [10, ["d2", "d_2"]], [11, ["F2", "F_2"]],
]);
for (const [index, [value, latex]] of labels) {
    const block = labelUnit.blocks[index];
    const normalized = block.text.normalized;
    const equals = normalized.indexOf("=");
    if (equals < 0) throw new Error(`Separatore = non trovato nel blocco ${block.blockId}`);
    block.kind = "list-item";
    block.listMarker = "none";
    block.listLevel = 0;
    block.text.inline = [
        { kind: "math", value, latex },
        { kind: "text", value: normalized.slice(Math.max(0, equals - 1)) },
    ];
    addTransformation(block, "Ricostruito l’elenco labeled con la descrizione allineata dopo il segno di uguaglianza.");
}
await writeUnit("11.9.5", labelUnit);

console.log("fix-ntc11-9-10-editorial: elenchi 11.9.1 e 11.9.5 aggiornati");
