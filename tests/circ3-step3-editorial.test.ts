import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../", import.meta.url));

// The canonical fixtures intentionally contain heterogeneous block shapes.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function json(relativePath: string): Promise<any> {
    return JSON.parse(await readFile(join(repoRoot, relativePath), "utf8"));
}

test("C3 step 3 usa dieci ritagli ufficiali integri", async () => {
    const manifest = await json(
        "corpus/assets/circ2019/core-figure-placeholders.json",
    );
    const numbers = [
        "C3.3.26",
        "C3.3.27",
        "C3.3.28",
        "C3.4.1",
        "C3.4.2",
        "C3.4.3",
        "C3.4.4",
        "C3.4.5",
        "C3.4.6",
        "C3.4.7",
    ];

    for (const number of numbers) {
        const figure = manifest.figures.find(
            ({ officialNumber }: { officialNumber: string }) =>
                officialNumber === number,
        );
        assert.ok(figure, number);
        assert.doesNotMatch(figure.imagePath, /placeholder/u);
        const image = await readFile(
            join(repoRoot, "corpus", "assets", figure.imagePath),
        );
        assert.equal(
            createHash("sha256").update(image).digest("hex"),
            figure.sha256,
            number,
        );
    }
});

test("C3 step 3 trascrive tutte le formule display", async () => {
    const manifest = await json("corpus/assets/circ2019/core-editorial.json");
    const byId = new Map(
        manifest.formulas.map(
            (formula: { id: string; latex: string }) => [
                formula.id.split(":").at(-1),
                formula.latex,
            ],
        ),
    );

    assert.equal(
        byId.get("c3.3.8.7.unnumbered-1"),
        "c_p=\\begin{cases}2{,}4&\\text{per torri con elementi tubolari a sezione circolare}\\\\2{,}8&\\text{per torri con elementi aventi sezione di forma diversa dalla circolare}\\end{cases}",
    );
    assert.equal(
        byId.get("c3.4.1"),
        "q_{sn}=q_{sk}\\left\\{\\frac{1-v\\dfrac{\\sqrt{6}}{\\pi}\\left[\\ln\\left(-\\ln(1-P_n)\\right)+0{,}57722\\right]}{1-2{,}5923v}\\right\\}",
    );
    assert.equal(
        byId.get("c3.4.5"),
        "\\mu_w=\\frac{b_1+b_2}{2h}\\le\\frac{\\gamma h}{q_{sk}}",
    );
    assert.equal(byId.get("c3.4.6"), "q_{se}=\\frac{kq_s^2}{\\gamma}");
    assert.equal(byId.get("c3.4.7"), "F_s=q_s b\\sin\\alpha");

    for (const number of [
        "c3.3.4",
        "c3.3.5",
        "c3.3.6",
        "c3.3.7",
        "c3.3.8",
        "c3.3.9",
        "c3.3.10",
        "c3.3.11",
        "c3.3.12",
        "c3.4.1",
        "c3.4.2",
        "c3.4.3",
        "c3.4.4",
        "c3.4.5",
        "c3.4.6",
        "c3.4.7",
    ]) {
        assert.ok(byId.has(number), number);
    }
});

test("C3 step 3 ricostruisce le tre tabelle ufficiali", async () => {
    const manifest = await json("corpus/assets/circ2019/core-tables.json");
    type TableCell = { text: string; latex?: string };
    type TableAsset = { officialNumber: string; rows: TableCell[][] };
    const byNumber = new Map<string, TableAsset>(
        manifest.tables.map(
            (table: TableAsset) => [
                table.officialNumber,
                table,
            ],
        ),
    );
    const tableXVIII = byNumber.get("C3.3.XVIII");
    const tableXIX = byNumber.get("C3.3.XIX");
    const tableC34I = byNumber.get("C3.4.I");
    assert.ok(tableXVIII);
    assert.ok(tableXIX);
    assert.ok(tableC34I);

    assert.deepEqual(
        tableXVIII.rows.map((row: TableCell[]) =>
            row.map(({ text }) => text),
        ),
        [
            ["5·10⁵", "-2,2", "-0,4", "85", "135"],
            ["2·10⁶", "-1,9", "-0,7", "80", "120"],
            ["10⁷", "-1,5", "-0,8", "75", "105"],
        ],
    );
    assert.deepEqual(
        tableXIX.rows.map((row: TableCell[]) => row.at(-1)?.text),
        ["0,01", "0,02", "0,04"],
    );
    assert.equal(
        tableC34I.rows[1]?.[1]?.latex,
        "0{,}8+0{,}8\\alpha/30",
    );
});

test("ogni asset di C3 step 3 compare una sola volta", async () => {
    const directory = join(repoRoot, "corpus", "units", "circ2019");
    const files = (await readdir(directory)).filter(
        (name) => name.startsWith("c3.") && name.endsWith(".json"),
    );
    const reviewed =
        /:(?:figure:circ2019:(?:c3\.3\.2[6-8]|c3\.4\.[1-7])|table:circ2019:(?:c3\.3\.(?:xviii|xix)|c3\.4\.i)|formula:circ2019:(?:c3\.3\.(?:[4-9]|1[0-2])|c3\.3\.8\.7\.unnumbered-1|c3\.4\.[1-7]|c3\.4\.3\.3\.(?:1\.unnumbered-1|2\.unnumbered-[12]|4\.unnumbered-[12])))$/u;
    const counts = new Map<string, number>();

    for (const file of files) {
        const unit = await json(join("corpus", "units", "circ2019", file));
        for (const { assetId } of unit.blocks) {
            if (!assetId || !reviewed.test(assetId)) continue;
            counts.set(assetId, (counts.get(assetId) ?? 0) + 1);
        }
    }

    assert.equal([...counts].filter(([id]) => id.includes(":figure:")).length, 10);
    assert.equal([...counts].filter(([id]) => id.includes(":table:")).length, 3);
    assert.equal(
        [...counts].filter(([id]) => id.includes(":formula:")).length,
        22,
    );
    for (const [assetId, count] of counts) assert.equal(count, 1, assetId);
});

test("C3 step 3 non conserva rumore nel testo normalizzato", async () => {
    const unitIds = [
        "c3.3.8.3",
        "c3.3.8.4",
        "c3.3.8.5",
        "c3.3.8.6.1",
        "c3.3.8.6.2",
        "c3.3.8.7",
        "c3.3.8.8",
        "c3.3.11",
        "c3.4.1",
        "c3.4.2",
        "c3.4.3",
        "c3.4.3.1",
        "c3.4.3.2",
        "c3.4.3.3",
        "c3.4.3.3.1",
        "c3.4.3.3.2",
        "c3.4.3.3.4",
        "c3.4.3.3.5",
        "c3.4.3.3.6",
    ];
    const units = await Promise.all(
        unitIds.map((id) => json(`corpus/units/circ2019/${id}.json`)),
    );
    const normalized = units
        .flatMap((unit) =>
            unit.blocks.flatMap(
                ({ text }: { text?: { normalized?: string } }) =>
                    text?.normalized ?? [],
            ),
        )
        .join("\n");

    assert.doesNotMatch(
        normalized,
        /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/u,
    );
    assert.doesNotMatch(normalized, /[ᡩᡱᡦ㍥㐢㎘‡]/u);
    assert.doesNotMatch(normalized, /(?:"C3\.|#[ \n])/u);
});
