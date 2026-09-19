import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

type Cell = { text: string; latex?: string; align?: string; colSpan?: number; rowSpan?: number };
type Inline = { kind: string; latex?: string };
type Table = { officialNumber: string; columnCount: number; columnWidths?: number[]; headers: Cell[][]; rows: Cell[][]; captionInline?: Inline[] };
type Unit = { blocks: Array<{ kind: string; text?: { normalized: string; inline?: Array<{ kind: string; value: string; latex?: string }> } }> };
const root = process.cwd();

async function manifest(): Promise<{ tables: Table[] }> {
    return JSON.parse(await readFile(join(root, "corpus", "assets", "ntc2018", "11-step2.json"), "utf8")) as { tables: Table[] };
}
function get(tables: Table[], number: string): Table {
    const result = tables.find((table) => table.officialNumber === number);
    assert.ok(result, number);
    return result;
}

test("NTC 11.3 separa descrizione e formula nelle Tabelle Ib, Ic e VIII", async () => {
    const tables = (await manifest()).tables;
    for (const number of ["11.3.Ib", "11.3.Ic"]) {
        const table = get(tables, number);
        assert.equal(table.columnCount, 4, number);
        assert.deepEqual(table.columnWidths, [52, 17, 18, 13], number);
        assert.equal(table.headers[0]?.[0]?.colSpan, 2, number);
        assert.equal(table.rows[0]?.[0]?.align, "left", number);
        assert.equal(table.rows[0]?.[1]?.align, "right", number);
    }
    assert.equal(get(tables, "11.3.II").rows[0]?.[0]?.align, "left");
    assert.equal(get(tables, "11.3.II").rows[0]?.[1]?.align, "center");
    assert.ok(get(tables, "11.3.IV").captionInline?.some((segment) => segment.kind === "math" && segment.latex === "f_y"));
    assert.ok(get(tables, "11.3.V").captionInline?.some((segment) => segment.kind === "math" && segment.latex === "A_{gt}"));
    assert.ok(get(tables, "11.3.VI b").rows.every((row) => row[1]?.align === "right"));
    for (const number of ["11.3.VII a", "11.3.VII b"]) assert.ok(get(tables, number).rows.flat().every((cell) => cell.align === "center"), number);
    const tableVIII = get(tables, "11.3.VIII");
    assert.equal(tableVIII.columnCount, 6);
    assert.deepEqual(tableVIII.columnWidths, [44, 20, 9, 9, 9, 9]);
    assert.equal(tableVIII.headers[0]?.[0]?.colSpan, 2);
    assert.equal(tableVIII.rows[0]?.[0]?.align, "left");
    assert.equal(tableVIII.rows[0]?.[1]?.align, "right");
    assert.ok(get(tables, "11.3.X").headers[0]?.every((cell) => cell.text.includes("\n")));
    assert.ok(get(tables, "11.3.XI").captionInline?.some((segment) => segment.kind === "math" && segment.latex === "\\sigma_2"));
    assert.equal(get(tables, "11.3.XII").rows.length, 8);
    assert.equal(get(tables, "11.3.XII").rows[0]?.[0]?.rowSpan, 5);
    assert.ok(get(tables, "11.3.XIII.b").rows.flat().every((cell) => cell.align === "center"));
});

test("NTC 11.3 conserva i simboli completi dei label dell’elenco", async () => {
    const unit = JSON.parse(await readFile(join(root, "corpus", "units", "ntc2018", "11.3.3.2.json"), "utf8")) as Unit;
    const labels = unit.blocks.filter((block) => block.kind === "list-item").map((block) => block.text?.inline?.[0]);
    assert.deepEqual(labels.slice(0, 2).map((segment) => segment?.value), ["Ø, A, M", "fptk, fpyk, fp(1)k, fp(0,1)k"]);
    assert.deepEqual(labels.slice(0, 2).map((segment) => segment?.latex), ["\\varnothing,\\ A,\\ M", "f_{ptk},\\ f_{pyk},\\ f_{p(1)k},\\ f_{p(0{,}1)k}"]);
});
