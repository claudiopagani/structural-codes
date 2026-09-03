import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

const root = join(import.meta.dirname, "..");

type TableCell = { text: string; latex?: string; colSpan?: number; rowSpan?: number; align?: string };
type Table = { officialNumber: string; headers: TableCell[][]; rows: TableCell[][] };

async function json<T>(path: string): Promise<T> {
    return JSON.parse(await readFile(join(root, path), "utf8")) as T;
}

test("NTC Tabelle 2.4.I–2.6.I conservano gli allineamenti richiesti", async () => {
    const manifest = await json<{ tables: Table[] }>("corpus/assets/ntc2018/core-tables.json");
    const table = (officialNumber: string) => {
        const match = manifest.tables.find((candidate) => candidate.officialNumber === officialNumber);
        assert.ok(match, officialNumber);
        return match;
    };

    const table241 = table("2.4.I");
    assert.equal(table241.headers[0]![1]!.text, "Valori minimi\ndi VN (anni)");
    assert.equal(table241.headers[0]![1]!.latex, "\\text{Valori minimi}\\\\\\text{di }V_N\\text{ (anni)}");
    assert.equal(table241.headers[0]![1]!.align, "center");
    assert.equal(table241.rows.every((row) => row[2]?.align === "center"), true);

    const table242 = table("2.4.II");
    assert.equal(table242.headers[0]!.every((cell, index) => cell.align === (index === 0 ? "left" : "center")), true);
    assert.equal(table242.rows[0]!.every((cell, index) => cell.align === (index === 0 ? "left" : "center")), true);

    const table251 = table("2.5.I");
    assert.equal(table251.headers[0]!.slice(1).every((cell) => cell.align === "center"), true);
    assert.equal(table251.rows.every((row) => row.slice(1).every((cell) => cell.align === "center")), true);

    const table261 = table("2.6.I");
    assert.equal(table261.headers[0]!.every((cell, index) => cell.align === (index === 0 ? "left" : "center")), true);
    assert.equal(table261.rows.flat().every((cell) => cell.align === "left" || cell.align === "center"), true);
    assert.equal(table261.rows.flat().filter((cell) => cell.align === "left" && cell.text.length > 0).every((cell) => /^(?:Carichi|Azioni)/u.test(cell.text)), true);
});

test("NTC 2.6.1 rappresenta senza trattini l’elenco dei simboli dopo la Tab. 2.6.I", async () => {
    const unit = await json<{ blocks: Array<{ blockId: string; kind: string; listMarker?: string; text?: { inline?: Array<{ kind: string }> } }> }>("corpus/units/ntc2018/2.6.1.json");
    const blocks = unit.blocks.filter((block) => /#block-editorial-01[5-7]$/u.test(block.blockId));
    assert.equal(blocks.length, 3);
    assert.equal(blocks.every((block) => block.kind === "list-item" && block.listMarker === "none"), true);
    assert.equal(blocks.every((block) => block.text?.inline?.[0]?.kind === "math"), true);
});

test("NTC 2.4.2 conserva le etichette Classe come colonna riutilizzabile", async () => {
    const unit = await json<{ blocks: Array<{ kind: string; text?: { inline?: Array<{ kind: string; value: string }> } }> }>("corpus/units/ntc2018/2.4.2.json");
    const classes = unit.blocks.filter((block) => block.text?.inline?.[0]?.kind === "em");
    assert.deepEqual(classes.map((block) => block.text?.inline?.[0]?.value), ["Classe I", "Classe II", "Classe III", "Classe IV"]);
    assert.equal(classes.every((block) => /^\s*:/u.test(block.text?.inline?.[1]?.value ?? "")), true);
});

test("NTC Tab. 2.6.I rende apicale la nota di G2", async () => {
    const manifest = await json<{ tables: Table[] }>("corpus/assets/ntc2018/core-tables.json");
    const table261 = manifest.tables.find((candidate) => candidate.officialNumber === "2.6.I");
    assert.ok(table261);
    const g2Cell = table261.rows[2]?.[0];
    assert.equal(g2Cell?.text, "Carichi permanenti non strutturali G2(1)");
    assert.match(g2Cell?.latex ?? "", /G_2\^\{\(1\)\}/u);
});
