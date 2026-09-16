/* eslint-disable @typescript-eslint/no-explicit-any */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));

async function json(relativePath: string): Promise<any> {
    return JSON.parse(await readFile(join(root, relativePath), "utf8"));
}

async function assertImageHash(image: any) {
    const bytes = await readFile(join(root, "corpus", "assets", image.imagePath));
    assert.equal(createHash("sha256").update(bytes).digest("hex"), image.sha256, image.imagePath);
}

function logicalColumns(rows: any[][]) {
    const occupied: number[] = [];
    return rows.map((row) => {
        const result: Array<{ column: number; cell: any }> = [];
        let column = 0;
        for (const cell of row) {
            while ((occupied[column] ?? 0) > 0) column += 1;
            result.push({ column, cell });
            const colSpan = cell.colSpan ?? 1;
            const rowSpan = cell.rowSpan ?? 1;
            if (rowSpan > 1) {
                for (let offset = 0; offset < colSpan; offset += 1) occupied[column + offset] = rowSpan;
            }
            column += colSpan;
        }
        for (let index = 0; index < occupied.length; index += 1) {
            if ((occupied[index] ?? 0) > 0) occupied[index] = (occupied[index] ?? 0) - 1;
        }
        return result;
    });
}

test("Tab. 4.2.VIII conserva griglia, testi verticali, coppie allineate e crop ufficiali", async () => {
    const manifest = await json("corpus/assets/ntc2018/4.2-step4b.json");
    const table = manifest.tables.find((candidate: any) => candidate.officialNumber === "4.2.VIII");
    assert.ok(table);
    assert.equal(table.columnCount, 7);
    assert.deepEqual(table.columnWidths, [6, 33, 4, 24, 13, 10, 10]);
    assert.equal(table.headers[0][0].text, "Sezione trasversale");
    assert.equal(table.headers[0][3].text, "Curva di instabilità");
    assert.equal(table.headers[0][3].colSpan, 2);

    const verticalLabels = table.rows.flat().filter((cell: any) => cell.verticalText);
    assert.deepEqual(verticalLabels.map((cell: any) => cell.text), [
        "Sezioni laminate",
        "h/b > 1,2",
        "h/b ≤ 1,2",
        "Sezioni ad I saldate",
        "Sezioni cave",
        "Sezioni scatolari saldate",
        "Sezioni piene, ad U e T",
        "Sezioni ad L",
    ]);

    for (const cell of table.rows.flat()) {
        if (/^(?:y-y|[a-d](?:_0)?)(?:\n|$)/u.test(cell.text)) {
            assert.ok(cell.latex, `manca il LaTeX per ${cell.text}`);
        }
    }

    const images = table.rows.flat().flatMap((cell: any) => cell.image ? [cell.image] : []);
    assert.equal(images.length, 6);
    assert.equal(new Set(images.map((image: any) => image.imagePath)).size, 6);
    await Promise.all(images.map(assertImageHash));
});

test("C4.2.IX conserva una sola testata e la riga-titolo interna", async () => {
    const manifest = await json("corpus/assets/circ2019/C4.2-step2d.json");
    const table = manifest.tables.find((candidate: any) => candidate.officialNumber === "C4.2.IX");
    assert.ok(table);
    assert.equal(table.headers.length, 1);
    assert.deepEqual(table.headers[0].map((cell: any) => [cell.text, cell.colSpan]), [
        ["Distribuzione delle tensioni", 3],
        ["Larghezza efficace del pannello", 3],
    ]);
    assert.deepEqual(table.rows[4].map((cell: any) => [cell.text, cell.colSpan, cell.strong]), [
        ["Distribuzione delle tensioni", 3, true],
        ["Larghezza efficace del pannello", 3, true],
    ]);
});

test("C4.2.XII.a-XVII mette ogni dettaglio nella seconda colonna visiva e usa KaTeX", async () => {
    const manifest = await json("corpus/assets/circ2019/C4.2-step2o.json");
    const expectedRows = new Map([
        ["C4.2.XII.a", 3], ["C4.2.XII.b", 1], ["C4.2.XII.c", 1], ["C4.2.XII.d", 7],
        ["C4.2.XIII", 8], ["C4.2.XIV", 9], ["C4.2.XV", 7], ["C4.2.XVI.a", 6],
        ["C4.2.XVI.b", 1], ["C4.2.XVII", 7],
    ]);
    const images: any[] = [];

    for (const [number, rowCount] of expectedRows) {
        const table = manifest.tables.find((candidate: any) => candidate.officialNumber === number);
        assert.ok(table, number);
        assert.deepEqual(table.columnWidths, [8, 38, 26, 28], number);
        assert.equal(table.rows.length, rowCount, number);
        for (const logicalRow of logicalColumns(table.rows)) {
            const imageCells = logicalRow.filter(({ cell }) => cell.image);
            assert.equal(imageCells.length, 1, `${number}: numero immagini nella riga`);
            const imageCell = imageCells[0];
            assert.ok(imageCell);
            assert.equal(imageCell.column, 1, `${number}: il crop non è nella seconda colonna visiva`);
            images.push(imageCell.cell.image);
        }
        for (const cell of [...table.headers, ...table.rows].flat()) {
            if (/[Δτσαφℓ₁₂]/u.test(cell.text)) {
                assert.ok(cell.latex || cell.inline, `${number}: simbolo non reso in KaTeX in «${cell.text}»`);
            }
        }
    }

    assert.equal(images.length, 50);
    assert.equal(new Set(images.map((image) => image.imagePath)).size, 50);
    await Promise.all(images.map(assertImageHash));
});

test("C4.2.XIX e C4.2.XX hanno crop puliti in prima colonna e tutte le celle centrate", async () => {
    const [step2t, step2x] = await Promise.all([
        json("corpus/assets/circ2019/C4.2-step2t.json"),
        json("corpus/assets/circ2019/C4.2-step2x.json"),
    ]);
    const tables = [
        step2t.tables.find((candidate: any) => candidate.officialNumber === "C4.2.XIX"),
        step2x.tables.find((candidate: any) => candidate.officialNumber === "C4.2.XX"),
    ];
    assert.deepEqual(tables[0].columnWidths, [72, 28]);
    assert.deepEqual(tables[1].columnWidths, [62, 16, 22]);

    for (const table of tables) {
        assert.ok(table);
        for (const cell of [...table.headers, ...table.rows].flat()) assert.equal(cell.align, "center", `${table.officialNumber}: ${cell.text}`);
        for (const row of table.rows) {
            assert.ok(row[0].image, `${table.officialNumber}: crop assente in prima colonna`);
            assert.equal(row.slice(1).some((cell: any) => cell.image), false, `${table.officialNumber}: crop fuori dalla prima colonna`);
            await assertImageHash(row[0].image);
        }
    }
});
