/* eslint-disable @typescript-eslint/no-explicit-any */
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = fileURLToPath(new URL("../", import.meta.url));
const formulaId = (suffix: string) => `urn:structural-codes:it:asset:formula:ntc2018:${suffix}`;

async function json(path: string) {
    return JSON.parse(await readFile(join(root, path), "utf8"));
}

async function allUnits() {
    const names = (await readdir(join(root, "corpus/units/ntc2018"))).filter((name) => name.endsWith(".json"));
    return Promise.all(names.map((name) => json(`corpus/units/ntc2018/${name}`)));
}

async function stepAssets() {
    const manifests = await Promise.all([
        json("corpus/assets/ntc2018/7-step1.json"),
        json("corpus/assets/ntc2018/7-step2.json"),
    ]);
    const inStep = (asset: { pdfPage: number }) => asset.pdfPage >= 212 && asset.pdfPage <= 221;
    return {
        formulas: manifests.flatMap((manifest) => manifest.formulas ?? []).filter(inStep),
        tables: manifests.flatMap((manifest) => manifest.tables ?? []).filter(inStep),
        figures: manifests.flatMap((manifest) => manifest.figures ?? []).filter(inStep),
    };
}

const expectedFormulas = new Map<string, string>([
    [formulaId("7.2.2-delta"), "\\Delta=d_{Es}+d_{Eg}"],
    [formulaId("7.2.3-7.2.1"), "F_a=\\frac{S_a\\cdot W_a}{q_a}"],
    [formulaId("7.2.5-axial-a"), "\\pm 0{,}2\\,N_{Sd}\\,a_{max}/g"],
    [formulaId("7.2.5-axial-b"), "\\pm 0{,}3\\,N_{Sd}\\,a_{max}/g"],
    [formulaId("7.2.5-axial-c"), "\\pm 0{,}4\\,N_{Sd}\\,a_{max}/g"],
    [formulaId("7.2.5-axial-d"), "\\pm 0{,}6\\,N_{Sd}\\,a_{max}/g"],
    [formulaId("7.3.1-7.3.1"), "q_{\\lim}=q_0\\cdot K_R"],
    [formulaId("7.3.1-kw"), "k_w=\\begin{cases}1{,}00 & \\text{per strutture a telaio e miste equivalenti a telai}\\\\0{,}5\\le\\frac{1+\\alpha_0}{3}\\le1 & \\text{per strutture a pareti, miste equivalenti a pareti, torsionalmente deformabili}\\end{cases}"],
    [formulaId("7.3.1-7.3.2"), "1\\le q_{ND}=\\frac{2}{3}q_{\\mathrm{CD\"B\"}}\\le1{,}5"],
    [formulaId("7.3.1-7.3.3"), "\\theta=\\frac{P\\cdot d_{Er}}{V\\cdot h}"],
]);

test("NTC pagine 212–221 conserva tutte le dieci formule verificate", async () => {
    const { formulas } = await stepAssets();
    assert.equal(formulas.length, 10);
    assert.deepEqual(new Set(formulas.map((formula: { id: string }) => formula.id)), new Set(expectedFormulas.keys()));
    for (const formula of formulas as Array<{ id: string; latex: string }>) {
        assert.equal(formula.latex, expectedFormulas.get(formula.id), formula.id);
    }
});

test("NTC pagine 212–221 conserva espressioni inline complete e non converte acronimi", async () => {
    const units = await allUnits();
    const inStep = (page: number | undefined) => (page ?? 0) >= 212 && (page ?? 0) <= 221;
    const stepUnits = units.filter((unit) => unit.blocks.some((block: any) => inStep(block.evidence?.pdfPage)));
    assert.equal(stepUnits.length, 11);

    const math = new Map<string, string>();
    for (const unit of stepUnits) for (const block of unit.blocks) {
        if (!block.text?.inline || !inStep(block.evidence?.pdfPage)) continue;
        assert.equal(block.text.inline.map((segment: { value: string }) => segment.value).join(""), block.text.normalized, block.blockId);
        for (const segment of block.text.inline.filter((candidate: any) => candidate.kind === "math")) {
            assert.ok(!["SLV", "SLD", "SLE", "SLU", "SLO", "SLC"].includes(segment.value), `${block.blockId}: ${segment.value} è un acronimo discorsivo`);
            math.set(`${unit.numbering.official}:${block.blockId.split("#").at(-1)}:${segment.value}`, segment.latex);
        }
    }

    assert.equal(math.get("7.0:block-p2:a_g S ≤ 0,075g"), "a_g S\\le0{,}075g");
    assert.equal(math.get("7.0:block-li1:F_h = 0,10 W λ"), "F_h=0{,}10W\\lambda");
    assert.equal(math.get("7.2.1:block-p7:2a_gS/g ≤ 1"), "2a_gS/g\\le1");
    assert.equal(math.get("7.2.4:block-p3:2F_a/S"), "2F_a/S");
    assert.equal(math.get("7.2.4:block-p5:T ≥ 0,1s"), "T\\ge0{,}1\\,\\mathrm{s}");
    assert.equal(math.get("7.2.5:block-p13:Nsd"), "N_{Sd}");
    assert.equal(math.get("7.2.5:block-p14:a_max = a_g S"), "a_{max}=a_g S");
    assert.equal(math.get("7.3.1:block-p15:P"), "P");
});

test("NTC pagine 212–221 conserva le tre tabelle matematiche e le celle unite", async () => {
    const { tables, figures } = await stepAssets();
    assert.equal(figures.length, 0);
    assert.deepEqual(tables.map((table: any) => table.officialNumber), ["7.2.I", "7.3.I", "7.3.II"]);

    const byNumber = new Map(tables.map((table: any) => [table.officialNumber, table]));
    const table72 = byNumber.get("7.2.I");
    assert.equal(table72.headers[0][3].latex, "\\gamma_{Rd}");
    const steel = table72.rows.find((row: any[]) => row[0]?.text === "Acciaio");
    const composite = table72.rows.find((row: any[]) => row[0]?.text === "Composta acciaio-calcestruzzo");
    const masonry = table72.rows.find((row: any[]) => row[0]?.text === "Muratura armata con progettazione in capacità");
    assert.equal(steel[0].rowSpan, 2);
    assert.equal(composite[0].rowSpan, 2);
    assert.match(steel[1].latex, /\\gamma_\{ov\}/u);
    assert.equal(masonry[3].text, "1,50");
    assert.equal(masonry[3].colSpan, 2);
    assert.equal(masonry.length, 4);

    const table73 = byNumber.get("7.3.I");
    assert.equal(table73.rows[0][2].text, "q = 1.0\n§ 3.2.3.4");
    assert.equal(table73.rows[0][2].latex, "\\begin{gathered}q=1.0\\\\\\S\\,3.2.3.4\\end{gathered}");
    assert.equal(table73.rows[1][1].latex, "\\begin{gathered}q\\le1{,}5\\\\\\S\\,3.2.3.5\\end{gathered}");
    assert.equal(table73.rows[2][2].latex, "\\begin{gathered}q\\ge1{,}5\\\\\\S\\,3.2.3.5\\end{gathered}");

    const table73ii = byNumber.get("7.3.II");
    assert.equal(table73ii.headers[0][1].latex, "q_0");
    assert.equal(table73ii.rows.find((row: any[]) => row[0]?.text === "Costruzioni di muratura ordinaria")[1].colSpan, 2);
});

test("NTC pagine 212–221 colloca formule e tabelle una sola volta nel flusso", async () => {
    const units = await allUnits();
    const references = units.flatMap((unit) => unit.blocks).filter((block: any) => block.assetId).map((block: any) => block.assetId);
    for (const id of expectedFormulas.keys()) assert.equal(references.filter((candidate: string) => candidate === id).length, 1, id);

    const refs = (number: string) => units.find((unit) => unit.numbering.official === number).blocks
        .filter((block: any) => block.kind.endsWith("-ref"))
        .map((block: any) => block.assetId.split(":").at(-1));
    assert.deepEqual(refs("7.2.2"), ["7.2.i", "7.2.2-delta"]);
    assert.deepEqual(refs("7.2.3"), ["7.2.3-7.2.1"]);
    assert.deepEqual(refs("7.2.5"), ["7.2.5-axial-a", "7.2.5-axial-b", "7.2.5-axial-c", "7.2.5-axial-d"]);
    assert.deepEqual(refs("7.3"), ["7.3.i"]);
    assert.deepEqual(refs("7.3.1"), ["7.3.1-7.3.1", "7.3.ii", "7.3.1-kw", "7.3.1-7.3.2", "7.3.1-7.3.3"]);
});
