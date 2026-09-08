import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

type Inline = { kind: string; value: string };
type Block = { kind: string; listMarker?: string; text?: { inline?: Inline[] } };
type Unit = { blocks: Block[] };
type Asset = { officialNumber: string; caption: string; captionInline?: Inline[] };

const root = process.cwd();
async function unit(name: string): Promise<Unit> {
    return JSON.parse(await readFile(join(root, "corpus", "units", "circ2019", `${name}.json`), "utf8")) as Unit;
}

test("C4.3 conserva il tipo effettivo degli elenchi", async () => {
    const safety = await unit("c4.3.1");
    assert.deepEqual(safety.blocks.filter((block) => block.kind === "list-item").map((block) => block.listMarker), ["none", "none"]);
    const stability = await unit("c4.3.4.3.6");
    assert.equal(stability.blocks.filter((block) => block.kind === "list-item").every((block) => block.listMarker === "none"), true);
    const slabs = await unit("c4.3.6.2");
    assert.equal(slabs.blocks.filter((block) => block.kind === "list-item").every((block) => block.listMarker === "dash"), true);
});

test("C4.3 conserva i due sottotitoli in corsivo", async () => {
    for (const name of ["c4.3.4.3.1.1", "c4.3.4.3.1.2"]) {
        const value = await unit(name);
        assert.ok(value.blocks.find((block) => block.kind === "heading")?.text?.inline?.every((segment) => segment.kind === "em"));
    }
});

test("Le didascalie C4.3 separano etichetta in grassetto e testo in corsivo", async () => {
    const manifest = JSON.parse(await readFile(join(root, "corpus", "assets", "circ2019", "C4.3-step1.json"), "utf8")) as { figures: Asset[]; tables: Asset[] };
    for (const asset of [...manifest.figures, ...manifest.tables]) {
        assert.ok(asset.captionInline, `captionInline assente per ${asset.officialNumber}`);
        assert.equal(asset.captionInline.map(({ value }) => value).join(""), asset.caption);
        assert.equal(asset.captionInline[0]?.kind, "strong");
        assert.ok(asset.captionInline.slice(1).every((segment) => segment.kind === "em"));
    }
});
