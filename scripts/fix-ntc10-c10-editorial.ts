import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

type Inline = { kind: "text" | "em"; value: string } | { kind: "math"; value: string; latex: string };
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
const profile = "ntc10-c10-editorial-formatting-0.1.0";
const dashNote = "Il trattino tipografico della fonte è rappresentato dal marcatore strutturale; il testo della voce conserva soltanto la descrizione.";
const labelNote = "La label ufficiale è mantenuta nel testo e resa senza un marcatore aggiuntivo, per allineare la descrizione.";
const italicNote = "Ripristinato il corsivo verificato nel render della fonte ufficiale.";

function sha256(value: string): string {
    return createHash("sha256").update(value, "utf8").digest("hex");
}

function recordEvidence(block: Block, note: string): void {
    assert.ok(block.text && block.evidence, `Evidence assente: ${block.blockId}`);
    block.evidence.normalizedSha256 = sha256(block.text.normalized);
    if (!block.evidence.transformations.some((entry) => entry.operation === "manual-correction" && entry.ruleVersion === profile && entry.note === note)) {
        block.evidence.transformations.push({ operation: "manual-correction", ruleVersion: profile, note });
    }
}

function setDash(block: Block, level = 0): void {
    assert.ok(block.text, `Testo assente: ${block.blockId}`);
    if (/^-\s+/u.test(block.text.normalized)) {
        block.text.normalized = block.text.normalized.replace(/^-\s+/u, "");
        block.text.inline = [{ kind: "text", value: block.text.normalized }];
        recordEvidence(block, dashNote);
    }
    assert.ok(block.text.normalized.length > 0, `Voce vuota: ${block.blockId}`);
    block.listMarker = "dash";
    if (level > 0) block.listLevel = level;
    else delete block.listLevel;
}

function setLabel(block: Block, level = 0): void {
    assert.ok(block.text && /^\s*(?:[a-z]+\.\d+\)|[a-z]+\)|\d+\))/iu.test(block.text.normalized), `Label inattesa: ${block.blockId}`);
    block.listMarker = "none";
    if (level > 0) block.listLevel = level;
    else delete block.listLevel;
    recordEvidence(block, labelNote);
}

function italicize(block: Block, phrases: string[]): void {
    assert.ok(block.text, `Testo assente: ${block.blockId}`);
    const positions = phrases.map((phrase) => {
        const index = block.text!.normalized.indexOf(phrase);
        assert.notEqual(index, -1, `Frase assente per il corsivo: ${phrase}`);
        return { phrase, index, end: index + phrase.length };
    }).sort((left, right) => left.index - right.index);
    assert.ok(positions.every((entry, index) => index === 0 || positions[index - 1]!.end <= entry.index), `Corsivi sovrapposti: ${block.blockId}`);
    const inline: Inline[] = [];
    let cursor = 0;
    for (const entry of positions) {
        if (cursor < entry.index) inline.push({ kind: "text", value: block.text.normalized.slice(cursor, entry.index) });
        inline.push({ kind: "em", value: entry.phrase });
        cursor = entry.end;
    }
    if (cursor < block.text.normalized.length) inline.push({ kind: "text", value: block.text.normalized.slice(cursor) });
    block.text.inline = inline;
    recordEvidence(block, italicNote);
}

function listItems(unit: Unit): Block[] {
    return unit.blocks.filter((block) => block.kind === "list-item");
}

async function updateUnit(document: "ntc2018" | "circ2019", name: string, edit: (unit: Unit) => void): Promise<void> {
    const path = join(root, "corpus", "units", document, `${name}.json`);
    const unit = JSON.parse(await readFile(path, "utf8")) as Unit;
    edit(unit);
    await writeFile(path, `${JSON.stringify(unit, null, 2)}\n`, "utf8");
}

await updateUnit("ntc2018", "10.1", (unit) => {
    const items = listItems(unit);
    assert.equal(items.length, 5);
    items.forEach((item) => setDash(item));
});

await updateUnit("ntc2018", "10.2.1", (unit) => {
    const items = listItems(unit);
    assert.equal(items.length, 11);
    items.forEach((item) => setDash(item));
    for (const index of [2, 7, 9, 22, 24]) italicize(unit.blocks[index]!, [unit.blocks[index]!.text!.normalized]);
});

await updateUnit("circ2019", "c10.1", (unit) => {
    const items = listItems(unit);
    const dashItems = items.filter((item) => /^-\s+/u.test(item.text?.normalized ?? "") || item.listMarker === "dash");
    const labels = items.filter((item) => /^\d+\)/u.test(item.text?.normalized ?? ""));
    assert.equal(dashItems.length, 20);
    assert.equal(labels.length, 8);
    dashItems.forEach((item) => setDash(item));
    labels.forEach((item) => setLabel(item));
    italicize(unit.blocks[5]!, [
        "“assicurare la perfetta stabilità e sicurezza delle strutture e di evitare qualsiasi pericolo per la pubblica incolumità”",
        "“la necessità di variazioni in corso di esecuzione”",
    ]);
    for (const index of [15, 21, 25, 36, 45, 48]) italicize(unit.blocks[index]!, [unit.blocks[index]!.text!.normalized]);
    italicize(unit.blocks[52]!, ["“pericolosità sismica di base”"]);
});

await updateUnit("circ2019", "c10.2.1", (unit) => {
    const items = listItems(unit);
    assert.equal(items.length, 14);
    const firstLevel = items.filter((item) => /^[ab]\)/u.test(item.text?.normalized ?? ""));
    const secondLevel = items.filter((item) => /^[ab]\.\d+\)/u.test(item.text?.normalized ?? ""));
    const dashItems = items.filter((item) => /^-\s+/u.test(item.text?.normalized ?? "") || item.listMarker === "dash");
    assert.equal(firstLevel.length, 2);
    assert.equal(secondLevel.length, 9);
    assert.equal(dashItems.length, 3);
    firstLevel.forEach((item) => setLabel(item));
    secondLevel.forEach((item) => setLabel(item, 1));
    dashItems.forEach((item) => setDash(item, 2));
});
