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
        json("corpus/assets/ntc2018/6-step1.json"),
        json("corpus/assets/ntc2018/6-step2.json"),
    ]);
    const inStep = (asset: { pdfPage: number }) => asset.pdfPage >= 192 && asset.pdfPage <= 201;
    return {
        formulas: manifests.flatMap((manifest) => manifest.formulas ?? []).filter(inStep),
        tables: manifests.flatMap((manifest) => manifest.tables ?? []).filter(inStep),
        figures: manifests.flatMap((manifest) => manifest.figures ?? []).filter(inStep),
    };
}

const expectedFormulas = new Map<string, string>([
    [formulaId("6.4.1"), "R_{c,k}=\\operatorname{Min}\\left\\{\\frac{(R_{c,m})_{\\mathrm{media}}}{\\xi_1};\\frac{(R_{c,m})_{\\mathrm{min}}}{\\xi_2}\\right\\}"],
    [formulaId("6.4.2"), "R_{t,k}=\\operatorname{Min}\\left\\{\\frac{(R_{t,m})_{\\mathrm{media}}}{\\xi_1};\\frac{(R_{t,m})_{\\mathrm{min}}}{\\xi_2}\\right\\}"],
    [formulaId("6.4.3"), "R_{c,k}=\\operatorname{Min}\\left\\{\\frac{(R_{c,cal})_{\\mathrm{media}}}{\\xi_3};\\frac{(R_{c,cal})_{\\mathrm{min}}}{\\xi_4}\\right\\}"],
    [formulaId("6.4.4"), "R_{t,k}=\\operatorname{Min}\\left\\{\\frac{(R_{t,cal})_{\\mathrm{media}}}{\\xi_3};\\frac{(R_{t,cal})_{\\mathrm{min}}}{\\xi_4}\\right\\}"],
    [formulaId("6.4.5"), "R_{c,k}=\\operatorname{Min}\\left\\{\\frac{(R_{c,m})_{\\mathrm{media}}}{\\xi_5};\\frac{(R_{c,m})_{\\mathrm{min}}}{\\xi_6}\\right\\}"],
]);

test("NTC pagine 192–201 conserva le cinque formule Min maiuscole", async () => {
    const { formulas } = await stepAssets();
    assert.equal(formulas.length, 5);
    assert.deepEqual(new Set(formulas.map((formula: { id: string }) => formula.id)), new Set(expectedFormulas.keys()));
    for (const formula of formulas as Array<{ id: string; latex: string }>) {
        assert.equal(formula.latex, expectedFormulas.get(formula.id), formula.id);
        assert.doesNotMatch(formula.latex, /\\min(?:\b|_)/u, formula.id);
    }
});

test("NTC pagine 192–201 segmenta gli inline completi senza preposizioni o titoli falsi", async () => {
    const units = await allUnits();
    const inStep = (page: number | undefined) => (page ?? 0) >= 192 && (page ?? 0) <= 201;
    const stepUnits = units.filter((unit) => unit.blocks.some((block: any) => inStep(block.evidence?.pdfPage)));
    assert.equal(stepUnits.length, 39);

    for (const unit of stepUnits) for (const block of unit.blocks) {
        if (!block.text?.inline || !inStep(block.evidence?.pdfPage)) continue;
        assert.equal(block.text.inline.map((segment: { value: string }) => segment.value).join(""), block.text.normalized, block.blockId);
        const mathValues = block.text.inline.filter((segment: { kind: string }) => segment.kind === "math").map((segment: { value: string }) => segment.value);
        assert.ok(!mathValues.includes("ad"), `${block.blockId}: preposizione ad marcata come matematica`);
        if (block.kind === "heading") {
            assert.ok(!mathValues.includes("GEO"), `${block.blockId}: GEO dentro GEOMETRICO`);
            assert.ok(!mathValues.includes("STR"), `${block.blockId}: STR dentro COSTRUTTIVI`);
        }
    }

    const math = async (number: string) => {
        const unit = await json(`corpus/units/ntc2018/${number}.json`);
        return unit.blocks.flatMap((block: any) => block.text?.inline ?? []).filter((segment: any) => segment.kind === "math");
    };
    assert.ok((await math("6.3.4")).some((segment: any) => segment.latex === "\\tau_f"));
    assert.ok((await math("6.4.3.1.1")).some((segment: any) => segment.value === "ξ" && segment.latex === "\\xi"));
    assert.ok((await math("6.4.3.7.1")).some((segment: any) => segment.value === "d ≥ 80 cm" && segment.latex === "d\\ge 80\\,\\mathrm{cm}"));
    assert.ok((await math("6.4.3.7.2")).some((segment: any) => segment.value === "5 + n/500" && segment.latex === "5+\\frac{n}{500}"));
    assert.ok((await math("6.5.2.2")).some((segment: any) => segment.value === "k < 10^{-6} m/s" && segment.latex === "k<10^{-6}\\,\\mathrm{m/s}"));
    assert.ok((await math("6.5.3.1.2")).some((segment: any) => segment.value === "δ > φ′/2" && segment.latex === "\\delta>\\varphi'/2"));
});

test("NTC pagine 192–201 conserva sette tabelle verificate cella per cella", async () => {
    const { tables, figures } = await stepAssets();
    assert.equal(figures.length, 0);
    assert.deepEqual(tables.map((table: any) => table.officialNumber), ["6.4.I", "6.4.II", "6.4.III", "6.4.IV", "6.4.V", "6.4.VI", "6.5.I"]);

    const byNumber = new Map(tables.map((table: any) => [table.officialNumber, table]));
    assert.equal(byNumber.get("6.4.I").headers[1][1].latex, "(\\mathrm{R3})");
    assert.equal(byNumber.get("6.4.II").headers[1][1].latex, "\\gamma_R");
    assert.deepEqual(byNumber.get("6.4.II").rows.map((row: any[]) => row[1].latex), ["\\gamma_b", "\\gamma_s", "\\gamma", "\\gamma_{st}"]);
    assert.equal(byNumber.get("6.4.III").headers[0][5].latex, "\\ge5");
    assert.equal(byNumber.get("6.4.IV").headers[0][7].latex, "\\ge10");
    assert.deepEqual(byNumber.get("6.4.V").headers[0].slice(1).map((cell: any) => cell.latex), ["\\ge2", "\\ge5", "\\ge10", "\\ge15", "\\ge20"]);
    assert.equal(byNumber.get("6.4.VI").rows[0][0].latex, "\\gamma_T=1{,}3");
    assert.deepEqual(byNumber.get("6.5.I").rows.map((row: any[]) => row[1].latex), ["\\gamma_R=1{,}4", "\\gamma_R=1{,}1", "\\gamma_R=1{,}15", "\\gamma_R=1{,}4"]);
});

test("NTC pagine 192–201 colloca ogni formula e tabella una sola volta nel flusso", async () => {
    const units = await allUnits();
    const references = units.flatMap((unit) => unit.blocks).filter((block: any) => block.assetId).map((block: any) => block.assetId);
    for (const id of expectedFormulas.keys()) assert.equal(references.filter((candidate: string) => candidate === id).length, 1, id);

    const refs = (number: string) => units.find((unit) => unit.numbering.official === number).blocks
        .filter((block: any) => block.kind.endsWith("-ref"))
        .map((block: any) => block.assetId.split(":").at(-1));
    assert.deepEqual(refs("6.4.2.1"), ["6.4.i"]);
    assert.deepEqual(refs("6.4.3.1.1"), ["6.4.ii", "6.4.1", "6.4.2", "6.4.iii", "6.4.3", "6.4.4", "6.4.iv", "6.4.5", "6.4.v"]);
    assert.deepEqual(refs("6.4.3.1.2"), ["6.4.vi"]);
    assert.deepEqual(refs("6.5.3.1.1"), ["6.5.i"]);
});
