import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../", import.meta.url));

// The fixtures are heterogeneous canonical records and are narrowed per test.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function json(relativePath: string): Promise<any> {
    return JSON.parse(await readFile(join(repoRoot, relativePath), "utf8"));
}

test("C3 step 1 usa dieci ritagli ufficiali integri", async () => {
    const manifest = await json(
        "corpus/assets/circ2019/core-figure-placeholders.json",
    );
    const numbers = new Set([
        "C3.2.1a",
        "C3.2.1b",
        "C3.2.1c",
        "C3.2.2",
        "C3.2.3",
        "C3.2.4",
        "C3.3.1",
        "C3.3.2",
        "C3.3.3",
        "C3.3.4",
    ]);
    const figures = manifest.figures.filter(
        ({ officialNumber }: { officialNumber: string }) =>
            numbers.has(officialNumber),
    );

    assert.equal(figures.length, 10);
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

test("C3 step 1 contiene le otto formule verificate", async () => {
    const manifest = await json("corpus/assets/circ2019/core-editorial.json");
    const formulas = manifest.formulas.filter(
        ({ officialNumber }: { officialNumber: string }) =>
            /^(?:C\.3\.2\.[1-3]|C3\.(?:2\.[45]|3\.[1-3]))$/u.test(
                officialNumber,
            ),
    );
    const byNumber = new Map<string, string>(
        formulas.map(
            ({ officialNumber, latex }: { officialNumber: string; latex: string }) =>
                [officialNumber, latex] as [string, string],
        ),
    );

    assert.equal(formulas.length, 8);
    assert.equal(
        byNumber.get("C.3.2.1"),
        "T_R=-\\frac{V_R}{\\ln(1-P_{VR})}=-\\frac{C_UV_N}{\\ln(1-P_{VR})}",
    );
    assert.match(byNumber.get("C.3.2.3") ?? "", /P\^\*_\{VR\}/u);
    assert.match(byNumber.get("C3.2.4") ?? "", /\\sum_\{j=1\}\^\{N\}/u);
    assert.match(byNumber.get("C3.2.5") ?? "", /\\rho_\{X,Y\}/u);
    assert.equal(
        byNumber.get("C3.3.3"),
        "c_{pe,A}=c_{pe,1}-\\left(c_{pe,1}-c_{pe,10}\\right)\\log_{10}(A)",
    );
});

test("C3 step 1 ricostruisce le quattro tabelle e le celle estese", async () => {
    const manifest = await json("corpus/assets/circ2019/core-tables.json");
    const numbers = ["C.3.2.I", "C.3.2.II", "C3.3.I", "C3.3.II"];
    const tables = numbers.map((number) =>
        manifest.tables.find(
            ({ officialNumber }: { officialNumber: string }) =>
                officialNumber === number,
        ),
    );

    assert.ok(tables.every(Boolean));
    assert.deepEqual(
        tables.map(({ columnCount }: { columnCount: number }) => columnCount),
        [3, 8, 3, 11],
    );
    assert.deepEqual(
        tables.map(({ rows }: { rows: unknown[] }) => rows.length),
        [4, 4, 2, 3],
    );
    assert.equal(tables[0].rows[0][0].rowSpan, 2);
    assert.equal(tables[1].headers[0][0].colSpan, 2);
    assert.equal(tables[3].rows[0][5].colSpan, 2);
    assert.equal(tables[3].rows[2][7].text, "+1,0");
});

test("C3 step 1 conserva capoversi ed elenchi logici", async () => {
    const expectations = new Map([
        ["c3.2.2", 2],
        ["c3.2.3.1", 3],
        ["c3.2.3.6", 3],
        ["c3.3.8", 3],
        ["c3.3.8.1.1.1", 2],
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

    const c321 = await json("corpus/units/circ2019/c3.2.1.json");
    const c33111 = await json("corpus/units/circ2019/c3.3.8.1.1.1.json");
    assert.ok(
        c321.blocks.some(
            ({ text }: { text?: { normalized: string } }) =>
                text?.normalized.startsWith("Ottenuti i valori di TR"),
        ),
    );
    assert.equal(
        c33111.blocks.filter(
            ({ kind }: { kind: string }) => kind === "figure-ref",
        ).length,
        1,
    );
});

test("C3 step 1 rende in LaTeX grandezze, pedici e disuguaglianze inline", async () => {
    const unitIds = [
        "c3.2",
        "c3.2.1",
        "c3.2.2",
        "c3.2.3",
        "c3.2.3.2.1",
        "c3.2.3.6",
        "c3.3.8",
        "c3.3.8.1.1.1",
    ];
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
        "P_{VR}",
        "P^*_{VR}",
        "V_{S,eq}",
        "T_C^*",
        "F_0\\cdot a_g",
        "\\eta=1",
        "\\xi=28\\%",
        "\\sqrt{2}",
        "\\bar z_e=h",
        "b<h\\le5d",
        "c_{pe,10}",
    ]) {
        assert.ok(latex.includes(expected), expected);
    }
});

test("ogni asset revisionato di C3 step 1 compare una sola volta", async () => {
    const directory = join(repoRoot, "corpus", "units", "circ2019");
    const files = (await readdir(directory)).filter(
        (name) => name.startsWith("c3.") && name.endsWith(".json"),
    );
    const reviewedNumbers = {
        formula: /:formula:circ2019:c3\.(?:2\.[1-5]|3\.[1-3])$/u,
        table: /:table:circ2019:c3\.(?:2\.(?:i|ii)|3\.(?:i|ii))$/u,
        figure:
            /:figure:circ2019:c3\.(?:2\.(?:1[abc]|[234])|3\.[1234])$/u,
    };
    const counts = new Map<string, number>();

    for (const file of files) {
        const unit = await json(join("corpus", "units", "circ2019", file));
        for (const { assetId } of unit.blocks) {
            if (!assetId) continue;
            if (!Object.values(reviewedNumbers).some((pattern) => pattern.test(assetId))) {
                continue;
            }
            counts.set(assetId, (counts.get(assetId) ?? 0) + 1);
        }
    }

    assert.equal(
        [...counts].filter(([id]) => id.includes(":formula:")).length,
        8,
    );
    assert.equal(
        [...counts].filter(([id]) => id.includes(":table:")).length,
        4,
    );
    assert.equal(
        [...counts].filter(([id]) => id.includes(":figure:")).length,
        10,
    );
    for (const [assetId, count] of counts) {
        assert.equal(count, 1, assetId);
    }
});

test("C3 step 1 non conserva rumore del layer PDF", async () => {
    const files = [
        "c3.1",
        "c3.1.3",
        "c3.1.4",
        "c3.1.4.1",
        "c3.1.4.2",
        "c3.1.4.3",
        "c3.2",
        "c3.2.1",
        "c3.2.2",
        "c3.2.3",
        "c3.2.3.1",
        "c3.2.3.2",
        "c3.2.3.2.1",
        "c3.2.3.6",
        "c3.3",
        "c3.3.1",
        "c3.3.2",
        "c3.3.3",
        "c3.3.4",
        "c3.3.5",
        "c3.3.6",
        "c3.3.7",
        "c3.3.8",
        "c3.3.8.1",
        "c3.3.8.1.1",
        "c3.3.8.1.1.1",
        "c3.3.8.1.1.2",
    ].map((id) => `${id}.json`);
    const text = (
        await Promise.all(
            files.map(async (file) => {
                const unit = await json(
                    join("corpus", "units", "circ2019", file),
                );
                return unit.blocks
                    .flatMap(
                        ({ text }: { text?: { normalized: string } }) =>
                            text?.normalized ?? [],
                    )
                    .join("\n");
            }),
        )
    ).join("\n");

    assert.doesNotMatch(text, /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/u);
    assert.doesNotMatch(text, /\(cid:/u);
    assert.doesNotMatch(text, /periododi/u);
    assert.doesNotMatch(text, /C3\.3\.3\.8\.1/u);
    assert.doesNotMatch(text, /\bAe B\b/u);
    assert.doesNotMatch(text, /\bXe Y\b/u);
});
