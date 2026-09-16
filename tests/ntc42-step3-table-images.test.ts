import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = fileURLToPath(new URL("../", import.meta.url));

type CellImage = {
    imagePath: string;
    alt: string;
    sha256: string;
    region: { coordinateSystem: string; x: number; y: number; width: number; height: number };
};
type Cell = { text: string; align?: string; image?: CellImage; colSpan?: number; rowSpan?: number };
type Table = { officialNumber: string; columnCount: number; headers: Cell[][]; rows: Cell[][]; notes: string[] };

async function manifest() {
    return JSON.parse(await readFile(join(root, "corpus", "assets", "ntc2018", "4.2-step3.json"), "utf8")) as { tables: Table[] };
}

test("le tabelle 4.2.III-V contengono tutti i crop ufficiali nelle celle", async () => {
    const { tables } = await manifest();
    const expectedCounts = new Map([["4.2.III", 7], ["4.2.IV", 7], ["4.2.V", 3]]);
    const paths = new Set<string>();

    for (const [number, count] of expectedCounts) {
        const table = tables.find((candidate) => candidate.officialNumber === number);
        assert.ok(table, number);
        const imageCells = [...table.headers, ...table.rows].flat().filter((cell) => cell.image);
        assert.equal(imageCells.length, count, number);
        assert.ok(imageCells.every((cell) => cell.align === "center"), `${number}: immagini non centrate`);

        for (const { image } of imageCells) {
            assert.ok(image);
            assert.equal(image.region.coordinateSystem, "pdf-points-top-left");
            assert.ok(image.alt.length > 0);
            assert.ok(!paths.has(image.imagePath), `crop duplicato: ${image.imagePath}`);
            paths.add(image.imagePath);
            const bytes = await readFile(join(root, "corpus", "assets", image.imagePath));
            assert.equal(createHash("sha256").update(bytes).digest("hex"), image.sha256, image.imagePath);
        }
    }

    assert.equal(paths.size, 17);
});

test("la struttura e gli allineamenti centrati delle tabelle 4.2.III-V sono espliciti", async () => {
    const { tables } = await manifest();
    for (const number of ["4.2.III", "4.2.IV", "4.2.V"]) {
        const table = tables.find((candidate) => candidate.officialNumber === number);
        assert.ok(table, number);
        assert.equal(table.columnCount, 7, number);
        assert.ok([...table.headers, ...table.rows].flat().filter((cell) => cell.text === "Classe" || /^\d(?:,\d+)?$/u.test(cell.text)).every((cell) => cell.align === "center"), number);
        assert.ok(!table.notes.some((note) => /schemi grafici.*manc/u.test(note)), number);
    }
});
