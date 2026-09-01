import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../", import.meta.url));

// Fixtures editoriali eterogenee: ogni test restringe poi la forma usata.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function json(relativePath: string): Promise<any> {
    return JSON.parse(await readFile(join(repoRoot, relativePath), "utf8"));
}

test("C1 conserva i capoversi reali e ricostruisce gli elenchi", async () => {
    const c11 = await json("corpus/units/circ2019/c1.1.json");
    const c12 = await json("corpus/units/circ2019/c1.2.json");
    const c11Lists = c11.blocks.filter(
        ({ kind }: { kind: string }) => kind === "list-item",
    );
    const c12Lists = c12.blocks.filter(
        ({ kind }: { kind: string }) => kind === "list-item",
    );

    assert.equal(c11Lists.length, 4);
    assert.match(c11Lists[0].text.normalized, /certo non può essere normata;$/u);
    assert.equal(
        c11Lists[3].text.normalized,
        "b) raggiungimento di una condizione di cinematismo;",
    );
    assert.equal(c12Lists.length, 23);
    assert.equal(c12Lists[0].text.normalized, "Premessa");
    assert.equal(c12Lists[12].text.normalized, "12. Riferimenti tecnici");
    assert.ok(
        c12.blocks.some(
            ({ kind, text }: { kind: string; text?: { normalized: string } }) =>
                kind === "paragraph" && text?.normalized === "In particolare:",
        ),
    );
});

test("C1 usa LaTeX inline per tutte le espressioni matematiche", async () => {
    const c11 = await json("corpus/units/circ2019/c1.1.json");
    const math = c11.blocks.flatMap(
        ({ text }: { text?: { inline?: Array<{ latex?: string }> } }) =>
            text?.inline?.flatMap((segment) => segment.latex ?? []) ?? [],
    );

    assert.deepEqual(math, [
        "2^\\circ",
        "0{,}5\\text{-}2{,}0",
        "30\\%",
        "\\zeta_E",
        "\\zeta_{V,i}",
    ]);
    assert.ok(!math.includes("/"));
});

test("C2.1 è un ritaglio ufficiale integro e collocato nel testo", async () => {
    const figures = await json(
        "corpus/assets/circ2019/core-figure-placeholders.json",
    );
    const figure = figures.figures.find(
        ({ officialNumber }: { officialNumber: string }) =>
            officialNumber === "C2.1",
    );
    assert.ok(figure);
    assert.doesNotMatch(figure.imagePath, /placeholder/u);
    const image = await readFile(
        join(repoRoot, "corpus", "assets", figure.imagePath),
    );
    assert.equal(
        createHash("sha256").update(image).digest("hex"),
        figure.sha256,
    );

    const unit = await json("corpus/units/circ2019/c2.4.1.json");
    const figureIndex = unit.blocks.findIndex(
        ({ assetId }: { assetId?: string }) => assetId === figure.id,
    );
    assert.ok(figureIndex > 1);
    assert.match(
        unit.blocks[figureIndex - 1].text.normalized,
        /manutenzione straordinaria\.$/u,
    );
    assert.match(
        unit.blocks[figureIndex + 1].text.normalized,
        /^Va anche segnalato/u,
    );
});

test("C2.4.I è ritrascritta con valori e simboli matematici esatti", async () => {
    const tables = await json("corpus/assets/circ2019/core-tables.json");
    const table = tables.tables.find(
        ({ officialNumber }: { officialNumber: string }) =>
            officialNumber === "C2.4.I",
    );
    assert.ok(table);
    assert.equal(table.columnCount, 5);
    assert.equal(table.rows.length, 3);
    assert.deepEqual(
        table.rows.map((row: Array<{ text: string }>) =>
            row.map(({ text }) => text),
        ),
        [
            ["≤ 10", "35", "35", "35", "35"],
            ["≥ 50", "≥ 35", "≥ 50", "≥ 75", "≥ 100"],
            ["≥ 100", "≥ 70", "≥ 100", "≥ 150", "≥ 200"],
        ],
    );

    const unit = await json("corpus/units/circ2019/c2.4.3.json");
    assert.equal(
        unit.blocks.filter(
            ({ assetId }: { assetId?: string }) => assetId === table.id,
        ).length,
        1,
    );
});

test("C2 rende in LaTeX tutte le grandezze inline nell'ordine ufficiale", async () => {
    const c241 = await json("corpus/units/circ2019/c2.4.1.json");
    const c243 = await json("corpus/units/circ2019/c2.4.3.json");
    const c25 = await json("corpus/units/circ2019/c2.5.json");
    const latex = [c241, c243, c25].flatMap((unit) =>
        unit.blocks.flatMap(
            ({ text }: { text?: { inline?: Array<{ latex?: string }> } }) =>
                text?.inline?.flatMap((segment) => segment.latex ?? []) ?? [],
        ),
    );

    assert.deepEqual(latex, [
        "V_N",
        "V_N",
        "V_N",
        "\\gamma_F",
        "V_N",
        "V_N",
        "V_N \\ge 50",
        "V_N \\ge 100",
        "V_R",
        "V_N",
        "C_U",
        "V_R = V_N \\cdot C_U",
        "P_{VR}",
        "T_R",
        "V_R",
        "V_N",
        "V_N",
        "V_R",
        "C_U",
        "C_U > 2",
        "C_U = 2{,}5",
        "C_U = 2",
        "G_k",
        "Q_{kj}",
        "G_2",
        "G_2",
        "G_2",
        "\\gamma_F",
    ]);
    assert.ok(!latex.includes("/"));
});
