import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

/* eslint-disable @typescript-eslint/no-explicit-any */
const root = process.cwd();
async function json(path: string): Promise<any> {
    return JSON.parse(await readFile(join(root, path), "utf8"));
}
function table(manifest: any, number: string): any {
    const result = manifest.tables.find((candidate: any) => candidate.officialNumber === number);
    assert.ok(result, number);
    return result;
}

test("NTC 11.7, 11.9 e 11.10 conserva colonne, allineamenti e formule delle note", async () => {
    const manifest = await json("corpus/assets/ntc2018/11-step2.json");
    const t117 = table(manifest, "11.7.I");
    assert.equal(t117.columnCount, 8);
    assert.deepEqual(t117.columnWidths, [19, 11, 3, 22, 11, 3, 21, 10]);
    assert.equal(t117.headers[0][1].spacer, true);
    assert.equal(t117.headers[0][3].spacer, true);
    assert.ok(t117.notesInline[1].some((segment: any) => segment.kind === "math" && segment.latex === "\\mathrm{mean}"));
    assert.ok(t117.notesInline[1].some((segment: any) => segment.kind === "math" && segment.latex === "m"));
    for (const number of ["11.9.I", "11.9.II", "11.9.III", "11.9.IV", "11.10.III", "11.10.IV", "11.10.V", "11.10.VI", "11.10.VII"]) {
        assert.ok(table(manifest, number).headers.concat(table(manifest, number).rows).flat().every((cell: any) => cell.align === "center"), number);
    }
    assert.equal(table(manifest, "11.10.I").columnWidths[0], 45);
    assert.ok(table(manifest, "11.10.I").rows[0][0].text.includes("\n"));
    assert.ok(table(manifest, "11.10.II").notesInline[0].some((segment: any) => segment.kind === "math" && segment.latex === "d"));
    assert.equal(table(manifest, "11.10.VIII").columnWidths[2], 16);
    assert.equal(table(manifest, "11.10.VIII").headers[1][1].text.split("\n").length, 3);
    assert.ok(table(manifest, "11.10.VIII").notesInline[0].some((segment: any) => segment.latex === "f_{bk}"));
});

test("NTC 11.9.1 e 11.9.5 conserva i livelli degli elenchi", async () => {
    const list = await json("corpus/units/ntc2018/11.9.1.json");
    const listItems = list.blocks.filter((block: any) => block.kind === "list-item");
    assert.ok(listItems.some((block: any) => block.text.normalized.startsWith("DISPOSITIVI DI VINCOLO TEMPORANEO") && block.listLevel === 0));
    assert.ok(listItems.some((block: any) => block.text.normalized.startsWith("Dispositivi di vincolo del tipo") && block.listLevel === 1));
    assert.ok(listItems.some((block: any) => block.text.normalized.startsWith("Dispositivi a comportamento viscoso") && block.listLevel === 1));
    assert.ok(listItems.some((block: any) => block.text.normalized.startsWith("Isolatori elastomerici") && block.listLevel === 1));
    const labeled = await json("corpus/units/ntc2018/11.9.5.json");
    for (const label of ["d_{el}", "F_{el}", "d_1", "F_1", "d_2", "F_2"]) {
        assert.ok(labeled.blocks.some((block: any) => block.kind === "list-item" && block.listMarker === "none" && block.text.inline?.[0]?.latex === label), label);
    }
});

test("Circolare C11 conserva apici, livelli, ordine delle figure e tabelle", async () => {
    const manifest = await json("corpus/assets/circ2019/C11-step2.json");
    for (const number of ["C11.2.6.I"]) {
        const asset = table(manifest, number);
        assert.ok(asset.headers.concat(asset.rows).flat().every((cell: any) => cell.align === "center"));
    }
    const c111 = await json("corpus/units/circ2019/c11.1.json");
    const reference = c111.blocks.find((block: any) => block.blockId.endsWith("#block-029"));
    const footnote = c111.blocks.find((block: any) => block.kind === "footnote");
    assert.equal(reference.text.inline.find((segment: any) => segment.kind === "math")?.latex, "^{1}");
    assert.equal(footnote.text.inline[0].latex, "^{1}");
    const nested = await json("corpus/units/circ2019/c11.3.1.5.json");
    assert.ok(nested.blocks.filter((block: any) => block.kind === "list-item" && block.listMarker === "dash").every((block: any) => block.listLevel === 1));
    const figures = await json("corpus/units/circ2019/c11.3.2.10.4.json");
    const figureBlocks = figures.blocks.filter((block: any) => block.kind === "figure-ref");
    const secondBulletIndex = figures.blocks.findIndex((block: any) => block.text?.normalized?.startsWith("nelle barre di acciaio dentellate"));
    assert.ok(secondBulletIndex < figures.blocks.findIndex((block: any) => block.assetId?.endsWith("c11.3.2.10.4.b")));
    assert.deepEqual(figureBlocks.map((block: any) => block.assetId), [
        "urn:structural-codes:it:asset:figure:circ2019:c11.3.2.10.4.a",
        "urn:structural-codes:it:asset:figure:circ2019:c11.3.2.10.4.b",
    ]);
    const figureAssets = manifest.figures.filter((figure: any) => figure.id.includes("c11.3.2.10.4"));
    assert.ok(figureAssets.every((figure: any) => figure.caption === null));
    const cropped = figureAssets.find((figure: any) => figure.id.endsWith("c11.3.2.10.4.b"));
    assert.equal(cropped.region.height, 60);
    const c1134112 = table(manifest, "C11.3.4.11.2.I");
    assert.deepEqual(c1134112.columnWidths, [31, 15, 24, 15, 15]);
    assert.ok(c1134112.rows.flat().filter((cell: any) => cell.align === "center").every((cell: any) => cell.align === "center"));
    assert.equal(c1134112.rows[0][2].align, "left");
});
