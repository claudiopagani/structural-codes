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
    assert.deepEqual(table.columnWidths, [6, 31, 4, 23, 14, 11, 11]);
    assert.equal(table.footerColumnCount, 6);
    assert.deepEqual(table.footerColumnWidths, [28, 14.4, 14.4, 14.4, 14.4, 14.4]);
    assert.equal(table.footerRows.length, 2);
    assert.deepEqual(table.footerRows.map((row: any[]) => row.reduce((sum, cell) => sum + (cell.colSpan ?? 1), 0)), [6, 6]);
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
    assert.deepEqual(table.rows[4].map((cell: any) => [cell.text, cell.colSpan, cell.strong, cell.header]), [
        ["Distribuzione delle tensioni", 3, true, true],
        ["Larghezza efficace del pannello", 3, true, true],
    ]);
    assert.deepEqual(table.rows[6][0].image.region, {
        coordinateSystem: "pdf-points-top-left", x: 95, y: 329, width: 150, height: 67,
    });
    await assertImageHash(table.rows[6][0].image);
});

test("Tab. 4.2.III-V conserva celle immagine normali, righe-titolo e piede indipendente", async () => {
    const manifest = await json("corpus/assets/ntc2018/4.2-step3.json");
    const byNumber = new Map(manifest.tables.map((table: any) => [table.officialNumber, table]));
    const tableIII: any = byNumber.get("4.2.III");
    const tableIV: any = byNumber.get("4.2.IV");
    const tableV: any = byNumber.get("4.2.V");
    assert.ok(tableIII && tableIV && tableV);

    assert.equal(tableIII.headers[0][0].header, false);
    assert.equal(tableIII.rows.length, 5);
    assert.equal(tableIII.footerColumnCount, 7);
    assert.deepEqual(tableIII.footerColumnWidths, [16, 14, 14, 14, 14, 14, 14]);
    assert.match(tableIII.footerRows[0][0].latex, /\\sqrt\{\\frac\{235\}\{f_\{yk\}\}\}/u);
    for (const rowIndex of [1, 2, 4]) {
        assert.equal(tableIII.rows[rowIndex][3].text.split("\n").length, 2);
        assert.ok(tableIII.rows[rowIndex][3].inline.some((segment: any) => segment.kind === "text" && segment.value.startsWith("\nquando ")));
    }

    assert.equal(tableIV.headers[1][0].header, false);
    assert.deepEqual(tableIV.headers[2].map((cell: any) => [cell.text, cell.colSpan]), [["Profilati laminati a caldo e sezioni saldate", 7]]);
    assert.equal(tableV.headers[1][0].header, false);
    assert.equal(tableV.rows[2][0].header, true);
    assert.equal(tableV.rows[4][0].header, true);
    assert.equal(tableV.rows[4][1].header, true);
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
        if (["C4.2.XII.a", "C4.2.XII.c", "C4.2.XII.d", "C4.2.XIII"].includes(number)) {
            for (const cell of table.rows.flat()) {
                assert.equal(Boolean(cell.latex?.includes("\\text{")), false, `${number}: prosa lunga non spezzabile in KaTeX`);
            }
        }
    }

    assert.equal(images.length, 50);
    assert.equal(new Set(images.map((image) => image.imagePath)).size, 50);
    for (const image of images.filter((image) => /table-c4\.2-xii-d-/u.test(image.imagePath))) assert.equal(image.region.width, 108);
    for (const image of images.filter((image) => /table-c4\.2-xvii-/u.test(image.imagePath))) assert.equal(image.region.width, 110);
    await Promise.all(images.map(assertImageHash));
});

test("Tab. 4.2.XVI-XVII rende il momento di serraggio M con KaTeX", async () => {
    const manifest = await json("corpus/assets/ntc2018/4.2-step5.json");
    for (const number of ["4.2.XVI", "4.2.XVII"]) {
        const table = manifest.tables.find((candidate: any) => candidate.officialNumber === number);
        assert.ok(table, number);
        const math = table.headers[0][0].inline?.find((segment: any) => segment.kind === "math");
        assert.equal(math?.value, "M [N m]");
        assert.equal(math?.latex, "M\\,[\\mathrm{N\\,m}]");
    }
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
