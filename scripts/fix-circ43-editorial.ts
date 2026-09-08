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

function heading(unit: Unit): Block & { text: NonNullable<Block["text"]> } {
    const value = unit.blocks.find((block) => block.kind === "heading");
    assert.ok(value?.text, "Heading assente");
    return value as Block & { text: NonNullable<Block["text"]> };
}

function captionInline(asset: CaptionAsset): Inline[] {
    const label = asset.caption.match(/^(?:Figura|Tabella) C4\.3\.(?:\d+|I{1,3})(?:\.)?/)?.[0];
    assert.ok(label, `Etichetta inattesa: ${asset.officialNumber}`);
    const inline: Inline[] = [{ kind: "strong", value: label }];
    const tail = asset.caption.slice(label.length);
    if (tail) inline.push({ kind: "em", value: tail });
    assert.equal(inline.map(({ value }) => value).join(""), asset.caption);
    return inline;
}

await updateUnit("c4.3.1", (unit) => {
    for (const block of unit.blocks.filter((block) => block.kind === "list-item")) block.listMarker = "none";
});

await updateUnit("c4.3.4.3.1.1", (unit) => {
    const value = heading(unit);
    value.text.inline = [{ kind: "em", value: value.text.normalized }];
});

await updateUnit("c4.3.4.3.1.2", (unit) => {
    const value = heading(unit);
    value.text.inline = [{ kind: "em", value: value.text.normalized }];
});

await updateUnit("c4.3.4.3.6", (unit) => {
    for (const block of unit.blocks.filter((block) => block.kind === "list-item")) block.listMarker = "none";
});

await updateUnit("c4.3.6.2", (unit) => {
    for (const block of unit.blocks.filter((block) => block.kind === "list-item")) block.listMarker = "dash";
});

const assetPath = join(root, "corpus", "assets", "circ2019", "C4.3-step1.json");
const manifest = JSON.parse(await readFile(assetPath, "utf8")) as { figures: CaptionAsset[]; tables: CaptionAsset[] };
for (const asset of [...manifest.figures, ...manifest.tables]) asset.captionInline = captionInline(asset);
await writeFile(assetPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
