import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

type Inline = { kind: "text" | "em" | "strong" | "math"; value: string; latex?: string };
type Evidence = { normalizedSha256: string; transformations: Array<{ operation: string; ruleVersion: string; note: string }> };
type Block = { kind: string; listMarker?: "dash" | "none"; text?: { normalized: string; inline?: Inline[] }; evidence?: Evidence };
type Unit = { blocks: Block[] };
type CaptionAsset = { caption: string; captionInline?: Inline[] };

const root = fileURLToPath(new URL("../", import.meta.url));
const units = join(root, "corpus", "units", "ntc2018");
const ruleVersion = "ntc45-editorial-profile-0.1.0";

function digest(value: string): string {
    return createHash("sha256").update(value).digest("hex");
}

function recordEditorialChange(block: Block, note: string): void {
    assert.ok(block.text && block.evidence, "Blocco editoriale senza testo o evidence");
    block.evidence.normalizedSha256 = digest(block.text.normalized);
    if (!block.evidence.transformations.some((transformation) => transformation.operation === "manual-correction" && transformation.ruleVersion === ruleVersion && transformation.note === note)) {
        block.evidence.transformations.push({ operation: "manual-correction", ruleVersion, note });
    }
}

async function updateUnit(name: string, edit: (unit: Unit) => void): Promise<void> {
    const path = join(units, `${name}.json`);
    const unit = JSON.parse(await readFile(path, "utf8")) as Unit;
    edit(unit);
    await writeFile(path, `${JSON.stringify(unit, null, 2)}\n`, "utf8");
}

function listItems(unit: Unit): Block[] {
    const items = unit.blocks.filter((block) => block.kind === "list-item");
    assert.ok(items.length > 0, "Elenco atteso ma assente");
    return items;
}

function markDashItems(unit: Unit): void {
    for (const block of listItems(unit).filter((candidate) => candidate.text?.normalized.startsWith("– "))) {
        assert.ok(block.text?.inline?.[0]?.kind === "text", "Voce con trattino inattesa");
        assert.ok(block.text.normalized.startsWith("– "), "Trattino ufficiale atteso");
        block.listMarker = "dash";
        block.text.normalized = block.text.normalized.slice(2);
        block.text.inline[0].value = block.text.inline[0].value.replace(/^–\s+/, "");
        recordEditorialChange(block, "Il trattino visibile della fonte è rappresentato dal marcatore strutturale, senza duplicarlo nel testo della voce.");
    }
}

function markNoneItems(unit: Unit): void {
    for (const block of listItems(unit)) block.listMarker = "none";
}

function applyItalic(block: Block, phrase: string): void {
    assert.ok(block.text, `Blocco assente per il corsivo: ${phrase}`);
    const inline = block.text.inline ?? [{ kind: "text" as const, value: block.text.normalized }];
    if (inline.some((segment) => segment.kind === "em" && segment.value === phrase)) return;
    const matchingIndex = inline.findIndex((segment) => segment.kind === "text" && segment.value.includes(phrase));
    assert.notEqual(matchingIndex, -1, `Frase assente per il corsivo: ${phrase}`);
    const matching = inline[matchingIndex];
    assert.ok(matching && matching.kind === "text", `Segmento testuale assente per il corsivo: ${phrase}`);
    const start = matching.value.indexOf(phrase);
    const replacement: Inline[] = [];
    if (start > 0) replacement.push({ kind: "text", value: matching.value.slice(0, start) });
    replacement.push({ kind: "em", value: phrase });
    if (start + phrase.length < matching.value.length) replacement.push({ kind: "text", value: matching.value.slice(start + phrase.length) });
    block.text.inline = [...inline.slice(0, matchingIndex), ...replacement, ...inline.slice(matchingIndex + 1)];
    recordEditorialChange(block, "Ripristinato il corsivo verificato nel render della fonte ufficiale.");
}

for (const name of ["4.5.4", "4.5.5", "4.5.6.1", "4.5.6.2"]) {
    await updateUnit(name, markDashItems);
}
for (const name of ["4.5.2.2.1", "4.5.6.4"]) {
    await updateUnit(name, markNoneItems);
}

await updateUnit("4.5.2.3", (unit) => {
    const naturalElements = unit.blocks.find((candidate) => candidate.text?.normalized.startsWith("Nel caso di elementi naturali"));
    assert.ok(naturalElements?.text, "Paragrafo sugli elementi naturali assente");
    if (!naturalElements.text.inline?.some((segment) => segment.kind === "math" && segment.latex === "1{,}6\\,\\mathrm{m}")) {
        const separator = "1,6 m";
        const position = naturalElements.text.normalized.indexOf(separator);
        assert.notEqual(position, -1, "Interasse di 1,6 m assente");
        naturalElements.text.inline = [
            { kind: "text", value: naturalElements.text.normalized.slice(0, position) },
            { kind: "math", value: separator, latex: "1{,}6\\,\\mathrm{m}" },
            { kind: "text", value: naturalElements.text.normalized.slice(position + separator.length) }
        ];
    }
    const applyItalics = (phrases: string[]): void => {
        const block = unit.blocks.find((candidate) => candidate.text?.normalized.includes(phrases[0] ?? ""));
        assert.ok(block?.text, `Paragrafo sulle murature assente: ${phrases[0]}`);
        for (const phrase of phrases) {
            applyItalic(block, phrase);
        }
        recordEditorialChange(block, "Ripristinati i termini in corsivo del paragrafo sulle tipologie di muratura.");
    };
    applyItalics(["a singolo paramento", "a paramento doppio"]);
    applyItalics(["pietra squadrata", "pietra non squadrata", "muratura listata"]);
});
await updateUnit("4.5.4", (unit) => {
    const scatolare = unit.blocks.find((block) => block.text?.normalized.includes("comportamento d’insieme “scatolare”"));
    assert.ok(scatolare, "Paragrafo scatolare atteso");
    applyItalic(scatolare, "scatolare");
    const slendernessBlock = unit.blocks.find((block) => block.text?.normalized.startsWith("I fenomeni del secondo ordine"));
    assert.ok(slendernessBlock, "Paragrafo snellezza atteso");
    applyItalic(slendernessBlock, "snellezza convenzionale");
});
await updateUnit("4.5.6.2", (unit) => {
    for (const block of listItems(unit).filter((candidate) => candidate.listMarker !== "dash")) block.listMarker = "none";
    const coefficient = unit.blocks.find((block) => block.text?.normalized.startsWith("Nella lunghezza"));
    assert.ok(coefficient, "Definizione del coefficiente attesa");
    if (!coefficient.text?.inline?.some((segment) => segment.kind === "math" && segment.latex === "m")) {
        assert.ok(coefficient.text, "Testo della definizione del coefficiente assente");
        coefficient.text.inline = [
            { kind: "text", value: "Nella lunghezza " },
            { kind: "math", value: "l", latex: "l" },
            { kind: "text", value: " del muro di irrigidimento si intende compresa anche metà dello spessore del muro irrigidito. Il coefficiente di eccentricità " },
            { kind: "math", value: "m", latex: "m" },
            { kind: "text", value: " è definito dalla relazione:" }
        ];
    }
    applyItalic(coefficient, "coefficiente di eccentricità");
});

const assetPath = join(root, "corpus", "assets", "ntc2018", "4.5.json");
const manifest = JSON.parse(await readFile(assetPath, "utf8")) as { tables: CaptionAsset[] };
assert.equal(manifest.tables.length, 5, "Cinque tabelle NTC 4.5 attese");
for (const table of manifest.tables) table.captionInline = [{ kind: "em", value: table.caption }];
await writeFile(assetPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
