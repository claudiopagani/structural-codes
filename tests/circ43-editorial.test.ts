import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

type Inline = { kind: string; value: string; latex?: string };
type Block = { kind: string; listMarker?: string; text?: { inline?: Inline[] } };
type Unit = { blocks: Block[] };
type Asset = { officialNumber: string; caption: string; captionInline?: Inline[] };
type TableCell = {
    text: string;
    align?: string;
    inline?: Inline[];
    image?: {
        imagePath: string;
        alt: string;
        sha256: string;
        region: { coordinateSystem: string; x: number; y: number; width: number; height: number };
    };
};
type TableAsset = Asset & { headers: TableCell[][]; rows: TableCell[][]; columnWidths?: number[]; notes?: string[] };

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

test("Tabella C4.3.I riproduce il crop ufficiale e le quattro classi", async () => {
    const manifest = JSON.parse(await readFile(join(root, "corpus", "assets", "circ2019", "C4.3-step1.json"), "utf8")) as { tables: TableAsset[] };
    const table = manifest.tables.find(({ officialNumber }) => officialNumber === "C4.3.I");
    assert.ok(table);
    assert.deepEqual(table.headers, []);
    assert.deepEqual(table.columnWidths, [48, 52]);
    assert.deepEqual(table.notes, []);
    assert.equal(table.rows.length, 1);
    assert.equal(table.rows[0]?.length, 2);

    const [diagram, classes] = table.rows[0];
    assert.ok(diagram);
    assert.ok(classes);
    assert.equal(diagram.align, "center");
    assert.deepEqual(diagram.image?.region, {
        coordinateSystem: "pdf-points-top-left",
        x: 75,
        y: 538,
        width: 130,
        height: 122,
    });
    assert.equal(diagram.image?.imagePath, "figures/circ2019/table-c4.3.i-schemes.png");
    assert.equal(diagram.image?.sha256, "2881dd5c622bf7a5f6018accbb4e9c732b0f56d16f880c7c1aeef66efe1565be");
    const image = await readFile(join(root, "corpus", "assets", diagram.image?.imagePath ?? ""));
    assert.equal(createHash("sha256").update(image).digest("hex"), diagram.image?.sha256);

    assert.equal(classes.align, "left");
    assert.equal(classes.inline?.map(({ value }) => value).join(""), classes.text);
    assert.deepEqual(classes.inline?.filter(({ kind }) => kind === "math").map(({ latex }) => latex), [
        "\\frac{c}{t}\\le9\\,\\varepsilon",
        "9\\,\\varepsilon<\\frac{c}{t}\\le14\\,\\varepsilon",
        "14\\,\\varepsilon<\\frac{c}{t}\\le20\\,\\varepsilon",
        "\\frac{c}{t}>20\\,\\varepsilon",
    ]);
    for (const label of ["Classe 1:", "Classe 2:", "Classe 3:", "Classe 4:"]) assert.match(classes.text, new RegExp(label));

    await unit("c4.3.2.1");
});
