import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

type Inline = { kind: "text" | "em" | "strong" | "math"; value: string; latex?: string };
type Block = { kind: string; listMarker?: "dash" | "none"; text?: { normalized: string; inline?: Inline[] } };
type Unit = { blocks: Block[] };
type CaptionAsset = { officialNumber: string; caption: string; captionInline?: Inline[] };

const root = fileURLToPath(new URL("../", import.meta.url));
const units = join(root, "corpus", "units", "circ2019");

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

function captionInline(asset: CaptionAsset): Inline[] {
    const label = asset.caption.match(/^Figura C4\.4\.\d+/)?.[0];
    assert.ok(label, `Etichetta inattesa: ${asset.officialNumber}`);
    const inline: Inline[] = [{ kind: "strong", value: label }];
    const tail = asset.caption.slice(label.length);
    if (tail) inline.push({ kind: "em", value: tail });
    assert.equal(inline.map(({ value }) => value).join(""), asset.caption);
    return inline;
}

for (const name of [
    "c4.4.5",
    "c4.4.7",
    "c4.4.8.1.9",
    "c4.4.12",
    "c4.4.14",
    "c4.4.15",
    "c4.4.16.1",
    "c4.4.16.2"
]) {
    await updateUnit(name, (unit) => {
        for (const block of listItems(unit)) block.listMarker = "dash";
    });
}

await updateUnit("c4.4.16", (unit) => {
    for (const block of listItems(unit)) block.listMarker = "none";
});

await updateUnit("c4.4.7", (unit) => {
    const latexByValue = new Map([
        ["u0", "u_0"],
        ["u1", "u_1"],
        ["u2", "u_2"]
    ]);
    for (const block of listItems(unit)) {
        if (!block.text) continue;
        const [value] = block.text.normalized.split(" ");
        if (!value) continue;
        const latex = latexByValue.get(value);
        if (!latex) continue;
        const tail = block.text.normalized.slice(value.length);
        block.text.inline = [{ kind: "math", value, latex }, { kind: "text", value: tail }];
    }
});

const assetPath = join(root, "corpus", "assets", "circ2019", "C4.4-step1.json");
const manifest = JSON.parse(await readFile(assetPath, "utf8")) as { figures: CaptionAsset[] };
assert.equal(manifest.figures.length, 1, "Figura C4.4 attesa");
for (const asset of manifest.figures) asset.captionInline = captionInline(asset);
await writeFile(assetPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
