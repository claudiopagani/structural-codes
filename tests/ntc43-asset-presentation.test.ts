import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = fileURLToPath(new URL("../", import.meta.url));

type Inline = { kind: string; value: string; latex?: string };
type CellImage = { imagePath: string; sha256: string; region: { x: number; y: number; width: number; height: number } };
type Cell = { text: string; align?: string; rowSpan?: number; image?: CellImage };

async function json(path: string) {
    return JSON.parse(await readFile(join(root, path), "utf8"));
}

async function assets() {
    const manifests = await Promise.all([1, 2, 3, 4].map((step) => json(`corpus/assets/ntc2018/4.3-step${step}.json`)));
    return {
        figures: manifests.flatMap((manifest) => manifest.figures ?? []),
        tables: manifests.flatMap((manifest) => manifest.tables ?? []),
    };
}

test("NTC 4.3 mostra numero, titolo e matematica KaTeX nelle tredici caption di figura", async () => {
    const { figures } = await assets();
    assert.equal(figures.length, 13);
    for (const figure of figures as Array<{ officialNumber: string; caption: string; captionInline: Inline[] }>) {
        assert.ok(figure.caption.includes(figure.officialNumber), figure.officialNumber);
        assert.equal(figure.captionInline[0]?.kind, "strong", figure.officialNumber);
        assert.equal(figure.captionInline.map(({ value }) => value).join(""), figure.caption, figure.officialNumber);
        assert.ok(figure.captionInline.some(({ kind }) => kind === "em"), figure.officialNumber);
    }

    const mathByFigure = new Map(figures.map((figure: { officialNumber: string; captionInline: Inline[] }) => [
        figure.officialNumber,
        figure.captionInline.filter(({ kind }) => kind === "math").map(({ latex }) => latex),
    ]));
    assert.deepEqual(mathByFigure.get("4.3.1"), ["b_{\\mathrm{eff}}", "b_{ei}"]);
    assert.deepEqual(mathByFigure.get("4.3.2"), ["b_{\\mathrm{eff}}", "L_e"]);
    assert.deepEqual(mathByFigure.get("4.3.8"), ["N-M"]);
});

test("NTC Tab. 4.3.I e II applicano gli allineamenti editoriali richiesti", async () => {
    const { tables } = await assets();
    const tableI = tables.find(({ officialNumber }: { officialNumber: string }) => officialNumber === "4.3.I");
    const tableII = tables.find(({ officialNumber }: { officialNumber: string }) => officialNumber === "4.3.II");
    assert.ok(tableI);
    assert.ok(tableII);

    for (const row of [...tableI.headers, ...tableI.rows] as Cell[][]) {
        assert.equal(row[0]?.align, "left");
        assert.ok(row.slice(1).every(({ align }) => align === "center"));
    }
    assert.ok(([...tableII.headers, ...tableII.rows] as Cell[][]).flat().every(({ align }) => align === "center"));
    assert.deepEqual(tableII.captionInline.filter(({ kind }: Inline) => kind === "math").map(({ latex }: Inline) => latex), ["k_t"]);
});

test("NTC Tab. 4.3.III usa tre crop ufficiali verificabili nella prima colonna", async () => {
    const { tables } = await assets();
    const table = tables.find(({ officialNumber }: { officialNumber: string }) => officialNumber === "4.3.III");
    assert.ok(table);

    const imageCells = [table.rows[0][0], table.rows[2][0], table.rows[4][0]] as Cell[];
    assert.deepEqual(imageCells.map(({ text, rowSpan }) => [text, rowSpan]), [["(a)", 2], ["(b)", 2], ["(c)", 3]]);
    assert.deepEqual(imageCells.map(({ image }) => image?.region), [
        { coordinateSystem: "pdf-points-top-left", x: 80, y: 378, width: 94, height: 53 },
        { coordinateSystem: "pdf-points-top-left", x: 80, y: 449, width: 94, height: 51 },
        { coordinateSystem: "pdf-points-top-left", x: 80, y: 513, width: 94, height: 68 },
    ]);
    for (const cell of imageCells) {
        assert.equal(cell.align, "center");
        assert.ok(cell.image);
        const bytes = await readFile(join(root, "corpus/assets", cell.image.imagePath));
        assert.equal(createHash("sha256").update(bytes).digest("hex"), cell.image.sha256);
    }

    const styles = await readFile(join(root, "viewer/shared/styles.css"), "utf8");
    assert.match(styles, /\.table-asset-4-3-iii tbody td:first-child \.table-cell-content \{ flex-direction: column-reverse; \}/u);
});
