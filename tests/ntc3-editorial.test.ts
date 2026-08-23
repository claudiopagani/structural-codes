import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = fileURLToPath(new URL("../", import.meta.url));

test("NTC Tabella 3.1.II conserva la griglia completa e la continuazione di pagina", async () => {
    const manifest = JSON.parse(await readFile(join(root, "corpus/assets/ntc2018/core-tables.json"), "utf8"));
    const table = manifest.tables.find((candidate: { officialNumber: string }) => candidate.officialNumber === "3.1.II");
    assert.ok(table);
    assert.equal(table.columnCount, 5);
    assert.equal(table.headers.length, 2);
    assert.equal(table.rows.length, 28);
    assert.deepEqual(
        table.rows.filter((row: Array<{ rowSpan?: number }>) => row[0]?.rowSpan).map((row: Array<{ rowSpan?: number }>) => row[0]!.rowSpan),
        [3, 4, 7, 4, 3, 3, 4],
    );
    const cells = table.rows.flat().map((cell: { text: string }) => cell.text);
    for (const expected of ["Cat. B2 Uffici aperti al pubblico", "Cat. C5. Aree suscettibili di grandi affollamenti, quali edifici per eventi pubblici, sale da concerto, palazzetti per lo sport e relative tribune, gradinate e piattaforme ferroviarie.", "Cat. E1 Aree per accumulo di merci e relative aree d’accesso, quali biblioteche, archivi, magazzini, depositi, laboratori manifatturieri", "2 x 50,00", "1,00**"]) {
        assert.equal(cells.includes(expected), true, expected);
    }
    assert.equal(table.notes.some((note: string) => note.includes("pagina PDF 48")), true);
    const unit = JSON.parse(await readFile(join(root, "corpus/units/ntc2018/3.1.4.json"), "utf8"));
    assert.equal(unit.assets.tableIds.includes(table.id), true);
    assert.equal(unit.blocks[4].kind, "list-item");
    assert.equal(unit.blocks[4].text.normalized, "carichi orizzontali lineari Hk");
    assert.equal(unit.blocks[5].kind, "paragraph");
    assert.equal(unit.blocks[5].text.normalized.startsWith("I valori nominali"), true);
    assert.equal(unit.blocks[6].kind, "table-ref");
    assert.equal(unit.blocks.some((block: { text?: { normalized?: string } }) => block.text?.normalized?.includes("B Uffici")), false);
});
