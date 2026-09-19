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

test("NTC 11.2.2 separa i titoli corsivi dalle descrizioni", async () => {
    const unit = await json("corpus/units/ntc2018/11.2.2.json");
    for (const [suffix, title] of [["003", "Valutazione preliminare"], ["004", "Controllo di produzione"], ["005", "Controllo di accettazione"], ["006", "Prove complementari"]] as const) {
        const heading = unit.blocks.find((block: any) => block.blockId.endsWith(`#block-${suffix}`));
        const description = unit.blocks.find((block: any) => block.blockId.endsWith(`#block-${suffix}-description`));
        assert.equal(heading.kind, "heading");
        assert.deepEqual(heading.text.inline, [{ kind: "em", value: title }]);
        assert.equal(description.kind, "paragraph");
        assert.ok(description.text.normalized.length > 0);
        assert.ok(unit.blocks.indexOf(description) === unit.blocks.indexOf(heading) + 1);
    }
});

test("NTC 11.3 mantiene celle e annidamenti richiesti", async () => {
    const manifest = await json("corpus/assets/ntc2018/11-step2.json");
    const ib = table(manifest, "11.3.Ib");
    assert.equal(ib.rows[2][0].colSpan, 2);
    assert.equal(ib.rows[2][0].rowSpan, 2);
    assert.equal(ib.rows[3].length, 1);
    assert.equal(ib.rows[3][0].latex, "<1{,}35");
    assert.equal(ib.rows[4][0].text, "");
    assert.equal(ib.rows[4][1].align, "right");
    assert.equal(ib.rows[8][0].colSpan, 2);
    assert.equal(ib.rows[9][0].colSpan, 2);
    const via = table(manifest, "11.3.VI a");
    assert.match(via.rows.at(-1)[1].latex, /\\begin\{aligned\}/u);
    assert.match(via.rows.at(-1)[1].latex, /&\\ge0\.035/u);
    const x = table(manifest, "11.3.X");
    assert.ok([...x.headers, ...x.rows].flat().every((cell: any) => cell.align === "center"));
    const xii = table(manifest, "11.3.XII");
    assert.deepEqual(xii.columnWidths, [25, 17, 18, 18, 22]);
    assert.equal(xii.rows[0][0].text, "Materiale Base:\nSpessore minimo delle membrature");
    assert.ok(xii.rows[1][0].text.includes("\n"));

    const unit = await json("corpus/units/ntc2018/11.3.3.2.json");
    for (const suffix of ["009", "010", "011", "012"]) {
        const block = unit.blocks.find((candidate: any) => candidate.blockId.endsWith(`#block-${suffix}`));
        assert.equal(block.listMarker, "none");
        assert.equal(block.listLevel, 1);
        assert.equal(block.indentLevel, 1);
    }
});

test("NTC 11.9.1 annida l’introduzione dell’elenco degli isolatori", async () => {
    const unit = await json("corpus/units/ntc2018/11.9.1.json");
    const introduction = unit.blocks.find((block: any) => block.text?.normalized?.startsWith("In generale, ai fini della presente norma"));
    assert.equal(introduction.kind, "list-item");
    assert.equal(introduction.listMarker, "none");
    assert.equal(introduction.listLevel, 1);
    assert.ok(unit.blocks.filter((block: any) => block.text?.normalized?.startsWith("Isolatori ")).every((block: any) => block.listLevel === 1));
});

test("Circolare C11 spezza le norme di riferimento e allinea a sinistra la qualità degli acciai", async () => {
    const manifest = await json("corpus/assets/circ2019/C11-step2.json");
    const asset = table(manifest, "C11.3.4.11.2.I");
    assert.ok(asset.rows[0][1].text.includes("\n"));
    assert.ok(asset.rows[4][1].text.includes("\n"));
    assert.ok(asset.rows[8][1].text.includes("\n"));
    for (const rowIndex of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]) {
        const qualityCell = rowIndex % 4 === 0 ? asset.rows[rowIndex][2] : asset.rows[rowIndex][0];
        assert.equal(qualityCell.align, "left", `riga ${rowIndex + 1}`);
    }
});

test("il CSS mantiene continua la separazione di 11.3.Ib sulle celle unite", async () => {
    const styles = await readFile(join(root, "viewer/shared/styles.css"), "utf8");
    assert.match(styles, /table-asset-11-3-ib tbody td:nth-child\(1\):not\(\[colspan\]\)/u);
});
