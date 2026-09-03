import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = fileURLToPath(new URL("../", import.meta.url));

type TableInline = { kind: string; value: string; latex?: string };
type TableCell = { text: string; latex?: string; inline?: TableInline[]; colSpan?: number; align?: string; noWrap?: boolean };

test("NTC Tabella 3.1.II conserva la griglia completa e la continuazione di pagina", async () => {
    const manifest = JSON.parse(await readFile(join(root, "corpus/assets/ntc2018/core-tables.json"), "utf8"));
    const table = manifest.tables.find((candidate: { officialNumber: string }) => candidate.officialNumber === "3.1.II");
    assert.ok(table);
    assert.equal(table.columnCount, 5);
    assert.equal(table.headers.length, 1);
    assert.equal(table.headers[0].length, 5);
    assert.equal(table.rows.length, 30);
    assert.deepEqual(
        table.rows.filter((row: Array<{ rowSpan?: number }>) => row[0]?.rowSpan).map((row: Array<{ rowSpan?: number }>) => row[0]!.rowSpan),
        [3, 4, 8, 2, 4, 3, 4, 2, 4],
    );
    const cells = table.rows.flat().map((cell: { text: string }) => cell.text);
    for (const expected of ["Cat. B2 Uffici aperti al pubblico", "Cat. C5. Aree suscettibili di grandi affollamenti, quali edifici per eventi pubblici, sale da concerto, palazzetti per lo sport e relative tribune, gradinate e piattaforme ferroviarie.", "Cat. E1 Aree per accumulo di merci e relative aree d’accesso, quali biblioteche, archivi, magazzini, depositi, laboratori manifatturieri", "Secondo categoria d’uso servita, con le seguenti limitazioni", "da valutarsi caso per caso e comunque non minori di", "2 x 50,00", "1,00**"]) {
        assert.equal(cells.includes(expected), true, expected);
    }
    const strongCells = table.rows.flat().filter((cell: { strong?: boolean }) => cell.strong).map((cell: { text: string }) => cell.text);
    for (const expected of ["Ambienti ad uso residenziale", "Uffici", "Ambienti suscettibili di affollamento", "Ambienti ad uso commerciale", "Aree per immagazzinamento e uso commerciale ed uso industriale", "Rimesse e aree per traffico di veicoli (esclusi i ponti)", "Coperture"]) {
        assert.equal(strongCells.includes(expected), true, expected);
    }
    assert.equal(table.headers[0].some((cell: { text: string }) => cell.text.includes("[kN/m²]")), true);
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

test("NTC Tabelle 3.1.I–II conservano gli allineamenti editoriali delle celle", async () => {
    const manifest = JSON.parse(await readFile(join(root, "corpus/assets/ntc2018/core-tables.json"), "utf8"));
    const tableI = manifest.tables.find((candidate: { officialNumber: string }) => candidate.officialNumber === "3.1.I") as { headers: TableCell[][]; rows: TableCell[][] };
    const tableII = manifest.tables.find((candidate: { officialNumber: string }) => candidate.officialNumber === "3.1.II") as { headers: TableCell[][]; rows: TableCell[][] };
    assert.ok(tableI);
    assert.ok(tableII);
    assert.equal(tableI.headers[0]![1]!.align, "center");
    assert.equal(tableI.rows.flat().filter((cell) => /^\d/u.test(cell.text)).every((cell) => cell.align === "center"), true);

    assert.equal(tableII.headers[0]!.slice(2).every((cell) => cell.align === "center"), true);
    for (const category of ["A", "B", "C", "D", "E", "F-G", "H-I-K"]) {
        const cell = tableII.rows.flat().find((candidate) => candidate.text === category);
        assert.ok(cell, category);
        assert.equal(cell.align, "center", category);
        assert.equal(cell.noWrap, true, category);
    }
    assert.equal(tableII.rows.flat().filter((cell) => cell.latex).every((cell) => cell.align === "center"), true);
    assert.equal(tableII.rows.flat().filter((cell) => cell.colSpan === 3).every((cell) => cell.align === "center"), true);
    assert.equal(tableII.rows.flat().filter((cell) => /\*{1,2}$/u.test(cell.text)).every((cell) => cell.latex?.includes("^{")), true);
});

test("NTC §3.3 conserva elenchi di definizioni, tabelle centrate e matematica nelle didascalie", async () => {
    const assets = JSON.parse(await readFile(join(root, "corpus/assets/ntc2018/core-tables.json"), "utf8"));
    const tableI = assets.tables.find((candidate: { officialNumber: string }) => candidate.officialNumber === "3.3.I") as { headers: TableCell[][]; rows: TableCell[][]; captionInline?: TableInline[] };
    const tableII = assets.tables.find((candidate: { officialNumber: string }) => candidate.officialNumber === "3.3.II") as { headers: TableCell[][]; rows: TableCell[][] };
    const tableIII = assets.tables.find((candidate: { officialNumber: string }) => candidate.officialNumber === "3.3.III") as { headers: TableCell[][]; rows: TableCell[][] };
    assert.ok(tableI);
    assert.ok(tableII);
    assert.ok(tableIII);

    assert.deepEqual(
        tableI.captionInline?.filter((segment) => segment.kind === "math").map((segment) => segment.latex),
        ["v_{b,0}", "a_0", "k_s"],
    );
    for (const row of [...tableI.headers, ...tableI.rows]) {
        for (const index of [0, 2, 3, 4]) assert.equal(row[index]?.align, "center");
    }
    assert.equal([...tableII.headers, ...tableII.rows].flat().every((cell) => cell.align === "center"), true);
    assert.equal([...tableIII.headers, ...tableIII.rows.slice(0, 4)].every((row) => row[0]?.align === "center"), true);
    const noteRow = tableIII.rows.find((row) => row[0]?.colSpan === 2);
    assert.ok(noteRow);
    assert.equal(noteRow[0]!.inline?.some((segment) => segment.latex === "1\\,\\mathrm{km}"), true);

    const expectedLabels: Record<string, string[]> = {
        "3.3.1": ["V_{b,0}", "c_a", "a_0,\\,k_s", "a_s"],
        "3.3.2": ["v_b", "c_r"],
        "3.3.4": ["q_r", "c_e", "c_p", "c_d"],
        "3.3.5": ["q_r", "c_e", "c_f"],
        "3.3.6": ["v_r", "\\rho"],
        "3.3.7": ["k_r,\\,z_0,\\,z_{min}", "c_t"],
    };
    for (const [unitId, labels] of Object.entries(expectedLabels)) {
        const unit = JSON.parse(await readFile(join(root, `corpus/units/ntc2018/${unitId}.json`), "utf8"));
        const definitions = unit.blocks.filter((block: { kind: string; listMarker?: string }) => block.kind === "list-item" && block.listMarker === "none");
        assert.deepEqual(definitions.map((block: { text: { inline?: TableInline[] } }) => block.text.inline?.[0]?.latex), labels, unitId);
        assert.equal(definitions.every((block: { text: { normalized: string; inline?: TableInline[] } }) => block.text.inline?.map((segment) => segment.value).join("") === block.text.normalized), true, unitId);
    }

    const figures = JSON.parse(await readFile(join(root, "corpus/assets/ntc2018/core-figure-placeholders.json"), "utf8"));
    const figure = figures.figures.find((candidate: { officialNumber: string }) => candidate.officialNumber === "3.3.3") as { captionInline?: TableInline[] };
    assert.deepEqual(figure.captionInline?.filter((segment) => segment.kind === "math").map((segment) => segment.latex), ["c_e", "c_t=1"]);
});
