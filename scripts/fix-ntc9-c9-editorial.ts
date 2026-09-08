import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

type Inline =
    | { kind: "text" | "em" | "strong"; value: string }
    | { kind: "math"; value: string; latex: string };
type Block = {
    blockId: string;
    kind: string;
    listMarker?: "dash" | "none";
    listLevel?: number;
    text?: { normalized: string; inline?: Inline[] };
    evidence?: {
        normalizedSha256: string;
        transformations: Array<{ operation: string; ruleVersion: string; note: string }>;
    };
};
type Unit = { blocks: Block[] };

const root = fileURLToPath(new URL("../", import.meta.url));
const profile = "ntc9-c9-editorial-formatting-0.1.0";
const dashNote = "Il trattino tipografico della fonte è rappresentato dal marcatore strutturale; il testo della voce conserva soltanto la descrizione.";
const italicNote = "Ripristinato il corsivo verificato nel render della fonte ufficiale.";

function sha256(value: string): string {
    return createHash("sha256").update(value, "utf8").digest("hex");
}

function saveEditorialEvidence(block: Block, note: string): void {
    assert.ok(block.text && block.evidence, `Evidence assente: ${block.blockId}`);
    block.evidence.normalizedSha256 = sha256(block.text.normalized);
    if (!block.evidence.transformations.some((entry) => entry.operation === "manual-correction" && entry.ruleVersion === profile && entry.note === note)) {
        block.evidence.transformations.push({ operation: "manual-correction", ruleVersion: profile, note });
    }
}

function setDash(item: Block, level: number): void {
    assert.ok(item.text, `Testo assente: ${item.blockId}`);
    const before = item.text.normalized;
    if (/^-\s+/u.test(before)) {
        item.text.normalized = before.replace(/^-\s+/u, "");
        item.text.inline = [{ kind: "text", value: item.text.normalized }];
        saveEditorialEvidence(item, dashNote);
    }
    assert.ok(item.text.normalized.length > 0, `Voce vuota: ${item.blockId}`);
    item.listMarker = "dash";
    if (level > 0) item.listLevel = level;
    else delete item.listLevel;
}

function setAlphabetic(item: Block): void {
    assert.ok(item.text && /^\s*[a-z]\)/iu.test(item.text.normalized), `Etichetta alfabetica inattesa: ${item.blockId}`);
    item.listMarker = "none";
    delete item.listLevel;
}

function italicize(item: Block, phrase: string): void {
    assert.ok(item.text, `Testo assente per il corsivo: ${phrase}`);
    const index = item.text.normalized.indexOf(phrase);
    assert.notEqual(index, -1, `Frase assente per il corsivo: ${phrase}`);
    const end = index + phrase.length;
    item.text.inline = [
        ...(index > 0 ? [{ kind: "text" as const, value: item.text.normalized.slice(0, index) }] : []),
        { kind: "em" as const, value: phrase },
        ...(end < item.text.normalized.length ? [{ kind: "text" as const, value: item.text.normalized.slice(end) }] : []),
    ];
    saveEditorialEvidence(item, italicNote);
}

async function updateUnit(document: "ntc2018" | "circ2019", name: string, edit: (unit: Unit) => void): Promise<void> {
    const path = join(root, "corpus", "units", document, `${name}.json`);
    const unit = JSON.parse(await readFile(path, "utf8")) as Unit;
    edit(unit);
    await writeFile(path, `${JSON.stringify(unit, null, 2)}\n`, "utf8");
}

function formatLists(unit: Unit, expectedDashCount: number, nestedDashIndexes: number[]): Block[] {
    const items = unit.blocks.filter((block) => block.kind === "list-item");
    const dashItems = items.filter((block) => /^-\s+/u.test(block.text?.normalized ?? "") || block.listMarker === "dash");
    const alphabeticItems = items.filter((block) => /^\s*[a-z]\)/iu.test(block.text?.normalized ?? ""));
    assert.equal(dashItems.length, expectedDashCount, "Numero di voci con trattino inatteso");
    assert.equal(dashItems.length + alphabeticItems.length, items.length, "Voce di elenco priva di marcatore ufficiale");
    const nested = new Set(nestedDashIndexes);
    dashItems.forEach((item, index) => setDash(item, nested.has(index) ? 1 : 0));
    alphabeticItems.forEach(setAlphabetic);
    return dashItems;
}

await updateUnit("ntc2018", "9.1", (unit) => {
    formatLists(unit, 5, [0, 1, 2, 3, 4]);
});
await updateUnit("ntc2018", "9.2", (unit) => {
    formatLists(unit, 4, []);
});

await updateUnit("circ2019", "c9.1", (unit) => {
    const dashItems = formatLists(unit, 18, [2, 3, 4, 5, 6, 7, 8]);
    italicize(dashItems[9]!, "prove di carico");
    italicize(dashItems[10]!, "prove sui materiali messi in opera");
    italicize(dashItems[11]!, "monitoraggio programmato");
});
await updateUnit("circ2019", "c9.2", (unit) => {
    formatLists(unit, 7, []);
});
