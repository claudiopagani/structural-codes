import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../", import.meta.url));
const unitIds = [
    "c3.3.8.1.2",
    "c3.3.8.1.3",
    "c3.3.8.1.4",
    "c3.3.8.1.5",
    "c3.3.8.1.6",
    "c3.3.8.1.7",
    "c3.3.8.2",
    "c3.3.8.2.1",
    "c3.3.8.2.2",
    "c3.3.8.2.3",
];

// The canonical fixtures have intentionally heterogeneous block and asset shapes.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function json(relativePath: string): Promise<any> {
    return JSON.parse(await readFile(join(repoRoot, relativePath), "utf8"));
}

test("C3 step 2 usa ventuno ritagli ufficiali integri", async () => {
    const manifest = await json(
        "corpus/assets/circ2019/core-figure-placeholders.json",
    );
    const numbers = new Set(
        Array.from({ length: 21 }, (_, index) => `C3.3.${index + 5}`),
    );
    const figures = manifest.figures.filter(
        ({ officialNumber }: { officialNumber: string }) =>
            numbers.has(officialNumber),
    );

    assert.equal(figures.length, 21);
    for (const figure of figures) {
        assert.doesNotMatch(figure.imagePath, /placeholder/u);
        const image = await readFile(
            join(repoRoot, "corpus", "assets", figure.imagePath),
        );
        assert.equal(
            createHash("sha256").update(image).digest("hex"),
            figure.sha256,
            figure.officialNumber,
        );
    }
});

test("C3 step 2 ricostruisce le quindici tabelle ufficiali", async () => {
    const manifest = await json("corpus/assets/circ2019/core-tables.json");
    const numbers = [
        "C3.3.III",
        "C3.3.IV",
        "C3.3.V",
        "C3.3.VI",
        "C3.3.VII",
        "C3.3.VIII",
        "C3.3.IX",
        "C3.3.X",
        "C3.3.XI",
        "C3.3.XII",
        "C3.3.XIII",
        "C3.3.XIV",
        "C3.3.XV",
        "C3.3.XVI",
        "C3.3.XVII",
    ];
    const tables = numbers.map((number) =>
        manifest.tables.find(
            ({ officialNumber }: { officialNumber: string }) =>
                officialNumber === number,
        ),
    );

    assert.ok(tables.every(Boolean));
    assert.equal(tables[0].rows[0][1].latex, "c_{pe,A}=-0{,}80");
    assert.equal(tables[1].rows.length, 10);
    assert.equal(tables[11].rows[5][0].text, "+0,5");
    assert.match(tables[13].rows[0][2].latex, /\|\\alpha\|/u);
    assert.deepEqual(
        tables[14].rows.map(
            (row: Array<{ text: string }>) => row.map(({ text }) => text),
        ),
        [
            ["1", "Primo campo", "1,0", "0,8"],
            ["2", "Secondo campo", "0,9", "0,7"],
            ["3", "Altri campi", "0,7", "0,7"],
        ],
    );
});

test("C3 step 2 conserva l'ordine editoriale di testo, figure e tabelle", async () => {
    const expected = new Map([
        [
            "c3.3.8.1.2",
            "heading|paragraph|fig:c3.3.5|tab:c3.3.iii|paragraph|paragraph|fig:c3.3.6|tab:c3.3.iv",
        ],
        [
            "c3.3.8.1.3",
            "heading|paragraph|fig:c3.3.7|fig:c3.3.8|tab:c3.3.v|paragraph|fig:c3.3.9|tab:c3.3.vi|paragraph|fig:c3.3.10|tab:c3.3.vii|tab:c3.3.viii",
        ],
        [
            "c3.3.8.2.1",
            "heading|paragraph|fig:c3.3.21|tab:c3.3.xv|paragraph|fig:c3.3.22|paragraph",
        ],
        [
            "c3.3.8.2.3",
            "heading|paragraph|fig:c3.3.25|tab:c3.3.xvii",
        ],
    ]);

    for (const [unitId, sequence] of expected) {
        const unit = await json(`corpus/units/circ2019/${unitId}.json`);
        const actual = unit.blocks
            .map(({ kind, assetId }: { kind: string; assetId?: string }) => {
                if (kind === "figure-ref") {
                    return `fig:${assetId?.split(":").at(-1)}`;
                }
                if (kind === "table-ref") {
                    return `tab:${assetId?.split(":").at(-1)}`;
                }
                return kind;
            })
            .join("|");
        assert.equal(actual, sequence, unitId);
    }
});

test("C3 step 2 conserva capoversi ed elenchi logici", async () => {
    const expectations = new Map([
        ["c3.3.8.1.6", 4],
        ["c3.3.8.1.7", 5],
        ["c3.3.8.2", 2],
    ]);

    for (const [unitId, expected] of expectations) {
        const unit = await json(`corpus/units/circ2019/${unitId}.json`);
        assert.equal(
            unit.blocks.filter(
                ({ kind }: { kind: string }) => kind === "list-item",
            ).length,
            expected,
            unitId,
        );
    }
});

test("C3 step 2 rende in LaTeX grandezze, angoli e formule inline", async () => {
    const units = await Promise.all(
        unitIds.map((id) => json(`corpus/units/circ2019/${id}.json`)),
    );
    const latex = units.flatMap((unit) =>
        unit.blocks.flatMap(
            ({ text }: { text?: { inline?: Array<{ latex?: string }> } }) =>
                text?.inline?.flatMap((segment) => segment.latex ?? []) ?? [],
        ),
    );

    for (const expected of [
        "-5^\\circ",
        "+5^\\circ",
        "\\bar z_e",
        "\\Theta=0^\\circ",
        "5^\\circ\\le\\alpha\\le45^\\circ",
        "c_{pe,A}",
        "c_{pe,B}",
        "c_{pe,C}",
        "\\bar z_e=h+\\frac{f}{2}",
        "\\frac{h}{d}\\ge0{,}5",
        "\\frac{f}{d}",
        "\\frac{f}{d}\\le0{,}05",
        "\\phi=0",
        "\\phi=1",
        "F=q_p(z)L^2c_F",
    ]) {
        assert.ok(latex.includes(expected), expected);
    }
});

test("ogni asset revisionato di C3 step 2 compare una sola volta", async () => {
    const directory = join(repoRoot, "corpus", "units", "circ2019");
    const files = (await readdir(directory)).filter(
        (name) => name.startsWith("c3.") && name.endsWith(".json"),
    );
    const reviewed = /:(?:figure:circ2019:c3\.3\.(?:[5-9]|1\d|2[0-5])|table:circ2019:c3\.3\.(?:iii|iv|v|vi|vii|viii|ix|x|xi|xii|xiii|xiv|xv|xvi|xvii))$/u;
    const counts = new Map<string, number>();

    for (const file of files) {
        const unit = await json(join("corpus", "units", "circ2019", file));
        for (const { assetId } of unit.blocks) {
            if (!assetId || !reviewed.test(assetId)) continue;
            counts.set(assetId, (counts.get(assetId) ?? 0) + 1);
        }
    }

    assert.equal(
        [...counts].filter(([id]) => id.includes(":figure:")).length,
        21,
    );
    assert.equal(
        [...counts].filter(([id]) => id.includes(":table:")).length,
        15,
    );
    for (const [assetId, count] of counts) {
        assert.equal(count, 1, assetId);
    }
});

test("C3 step 2 non conserva rumore del layer PDF", async () => {
    const units = await Promise.all(
        unitIds.map((id) => json(`corpus/units/circ2019/${id}.json`)),
    );
    const text = units
        .flatMap((unit) =>
            unit.blocks.flatMap(
                ({ text }: { text?: { normalized: string } }) =>
                    text?.normalized ?? [],
            ),
        )
        .join("\n");

    assert.doesNotMatch(text, /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/u);
    assert.doesNotMatch(text, /\(cid:/u);
    assert.doesNotMatch(text, /[ÃâÎÏ]/u);
    assert.doesNotMatch(text, /\b(?:coper|pres|dire|inclina)-\s/u);
});
