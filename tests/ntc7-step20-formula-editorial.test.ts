/* eslint-disable @typescript-eslint/no-explicit-any */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
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
        json("corpus/assets/ntc2018/7-step2.json"),
        json("corpus/assets/ntc2018/7-step3.json"),
        json("corpus/assets/ntc2018/7.4-step1.json"),
    ]);
    const inStep = (asset: { pdfPage: number }) => asset.pdfPage >= 222 && asset.pdfPage <= 231;
    return {
        formulas: manifests.flatMap((manifest) => manifest.formulas ?? []).filter(inStep),
        tables: manifests.flatMap((manifest) => manifest.tables ?? []).filter(inStep),
        figures: manifests.flatMap((manifest) => manifest.figures ?? []).filter(inStep),
    };
}

const expectedFormulas = new Map<string, string>([
    [formulaId("7.3.3.1-7.3.4"), "E=\\sqrt{\\sum_j\\sum_i\\rho_{ij}\\cdot E_i\\cdot E_j}"],
    [formulaId("7.3.3.1-7.3.5a"), "\\rho_{ij}=\\frac{8\\sqrt{\\xi_i\\cdot\\xi_j}\\cdot(\\beta_{ij}\\cdot\\xi_i+\\xi_j)\\cdot\\beta_{ij}^{3/2}}{(1-\\beta_{ij}^2)^2+4\\cdot\\xi_i\\cdot\\xi_j\\cdot\\beta_{ij}(1+\\beta_{ij}^2)+4\\cdot(\\xi_i^2+\\xi_j^2)\\cdot\\beta_{ij}^2}"],
    [formulaId("7.3.3.1-7.3.5b"), "\\rho_{ij}=\\frac{8\\xi^2\\beta_{ij}^{3/2}}{(1+\\beta_{ij})\\cdot\\left[(1-\\beta_{ij})^2+4\\xi^2\\beta_{ij}\\right]}"],
    [formulaId("7.3.3.2-7.3.6"), "T_1=2\\sqrt{d}"],
    [formulaId("7.3.3.2-7.3.7"), "F_i=F_h\\cdot z_i\\cdot\\frac{W_i}{\\sum_j z_j W_j}"],
    [formulaId("7.3.3.3-7.3.8"), "d_E=\\pm\\mu_d\\cdot d_{Ee}"],
    [formulaId("7.3.3.3-7.3.9"), "\\mu_d=\\begin{cases}q & \\text{se }T_1\\ge T_C\\\\1+(q-1)\\cdot\\frac{T_C}{T_1} & \\text{se }T_1<T_C\\end{cases}"],
    [formulaId("7.3.5-7.3.10"), "1{,}00\\cdot E_x+0{,}30\\cdot E_y+0{,}30\\cdot E_z"],
    [formulaId("7.3.6.1-7.3.11a"), "q\\,d_r\\le0{,}0050\\cdot h"],
    [formulaId("7.3.6.1-7.3.11b"), "q\\,d_r\\le0{,}0075\\cdot h"],
    [formulaId("7.3.6.1-7.3.12"), "q\\,d_r\\le d_{rp}\\le0{,}0100\\cdot h"],
    [formulaId("7.3.6.1-7.3.13"), "q\\,d_r\\le0{,}0020\\cdot h"],
    [formulaId("7.3.6.1-7.3.14"), "q\\,d_r\\le0{,}0030\\cdot h"],
    [formulaId("7.3.6.1-7.3.15"), "q\\,d_r<0{,}0025\\cdot h"],
    [formulaId("7.4.1"), "V_{R1}=\\left(2-\\left|\\frac{V_{Ed,min}}{V_{Ed,max}}\\right|\\right)\\cdot f_{ctd}\\cdot b_w\\cdot d"],
    [formulaId("7.4.2"), "V_{Ed,max}\\le\\frac{A_s\\cdot f_{yd}}{\\sqrt{2}}"],
    [formulaId("7.4.3"), "\\mu_\\phi=\\begin{cases}1{,}2\\cdot\\left(2q_0-1\\right)&\\text{per }T_1\\ge T_C\\\\1{,}2\\cdot\\left[1+2\\left(q_0-1\\right)\\dfrac{T_C}{T_1}\\right]&\\text{per }T_1<T_C\\end{cases}"],
    [formulaId("7.4.4"), "\\sum M_{c,Rd}\\ge\\gamma_{Rd}\\cdot\\sum M_{b,Rd}"],
    [formulaId("7.4.5"), "V_{Ed}l_p=\\gamma_{Rd}\\left(M_{i,d}^{s}+M_{i,d}^{i}\\right)"],
    [formulaId("7.4.5:mi-d"), "M_{i,d}=M_{c,Rd}\\cdot\\min\\left(1,\\frac{\\sum M_{b,Rd}}{\\sum M_{c,Rd}}\\right)"],
]);

test("NTC pagine 222–231 conserva esattamente le venti formule ufficiali", async () => {
    const { formulas } = await stepAssets();
    assert.equal(formulas.length, 20);
    assert.deepEqual(new Set(formulas.map((formula: { id: string }) => formula.id)), new Set(expectedFormulas.keys()));
    for (const formula of formulas as Array<{ id: string; latex: string }>) {
        assert.equal(formula.latex, expectedFormulas.get(formula.id), formula.id);
    }
});

test("NTC pagine 222–231 usa inline completi senza acronimi o lettere discorsive", async () => {
    const units = await allUnits();
    const inStep = (page: number | undefined) => (page ?? 0) >= 222 && (page ?? 0) <= 231;
    const stepUnits = units.filter((unit) => unit.blocks.some((block: any) => inStep(block.evidence?.pdfPage)));
    assert.equal(stepUnits.length, 30);

    const mathByUnit = new Map<string, Array<{ value: string; latex: string }>>();
    for (const unit of stepUnits) for (const block of unit.blocks) {
        if (!block.text?.inline || !inStep(block.evidence?.pdfPage)) continue;
        assert.equal(block.text.inline.map((segment: any) => segment.value).join(""), block.text.normalized, block.blockId);
        const math = block.text.inline.filter((segment: any) => segment.kind === "math");
        for (const segment of math) {
            assert.ok(!["SL", "SLE", "SLU", "SLO", "SLD", "SLV", "SLC", "CU"].includes(segment.value), `${block.blockId}: ${segment.value} è un acronimo discorsivo`);
        }
        const values = mathByUnit.get(unit.numbering.official) ?? [];
        values.push(...math);
        mathByUnit.set(unit.numbering.official, values);
    }

    const has = (unit: string, value: string, latex: string) => mathByUnit.get(unit)?.some((segment) => segment.value === value && segment.latex === latex);
    assert.ok(has("7.3.1", "d_{Er}", "d_{Er}"));
    assert.ok(has("7.3.3.2", "T_1 < 2T_C", "T_1<2T_C"));
    assert.ok(has("7.3.3.3", "μ_d ≤ 5q − 4", "\\mu_d\\le5q-4"));
    assert.ok(has("7.3.6.1", "2/3", "\\frac{2}{3}"));
    assert.ok(has("7.3.6.1", "0,005 h", "0{,}005h"));
    assert.ok(has("7.3.6.1", "q ≤ 1,5", "q\\le1{,}5"));
    assert.ok(has("7.4.3.1", "r²/lₛ² ≥ 1", "\\frac{r^2}{l_s^2}\\ge 1"));
    assert.ok(has("7.4.3.1", "lₛ² = (L² + B²)/12", "l_s^2=\\frac{L^2+B^2}{12}"));
    for (const ratio of ["1,0", "1,1", "1,2", "1,3"]) assert.ok(mathByUnit.get("7.4.3.2")?.some((segment) => segment.value === `αᵤ/α₁ = ${ratio}`));
    assert.ok(has("7.4.4.1.1", "ctgθ = 1", "\\operatorname{ctg}\\theta=1"));
    assert.ok(has("7.4.4.1.2", "μ_φ = 2μ_d - 1", "\\mu_\\phi=2\\mu_d-1"));

    const beamUnit = units.find((unit) => unit.numbering.official === "7.4.4.1.1");
    const beamDefinition = beamUnit.blocks.find((block: any) => block.blockId.endsWith("editorial-018"));
    assert.deepEqual(beamDefinition.text.inline.filter((segment: any) => segment.kind === "math").map((segment: any) => segment.value), ["b_w", "d", "+45°", "-45°"]);
    for (const number of ["7.3.3.1", "7.3.3.2"]) {
        const values = mathByUnit.get(number)?.map((segment) => segment.value) ?? [];
        assert.ok(!values.includes("i") && !values.includes("j"), `${number}: i/j discorsivi non devono diventare segmenti matematici isolati`);
    }
});

test("NTC pagine 222–231 conserva tabella 7.3.III e i due crop ufficiali", async () => {
    const { tables, figures } = await stepAssets();
    assert.equal(tables.length, 1);
    assert.equal(tables[0].officialNumber, "7.3.III");
    assert.equal(tables[0].columnCount, 9);
    assert.deepEqual(tables[0].headers[0].map((cell: any) => [cell.text, cell.colSpan ?? 1, cell.rowSpan ?? 1]), [
        ["STATI LIMITE", 2, 2], ["CU I", 1, 1], ["CU II", 3, 1], ["CU III e IV", 3, 1],
    ]);
    assert.deepEqual(tables[0].rows.map((row: any[]) => row.map((cell) => cell.text)), [
        ["SLE", "SLO", "", "", "", "", "RIG", "", "FUN"],
        ["SLD", "RIG", "RIG", "", "", "RES", "", ""],
        ["SLU", "SLV", "RES", "RES", "STA", "STA", "RES", "STA", "STA"],
        ["SLC", "", "DUT(**)", "", "", "DUT(**)", "", ""],
    ]);

    assert.deepEqual(figures.map((figure: any) => figure.officialNumber), ["7.4.1", "7.4.2"]);
    for (const figure of figures as Array<{ imagePath: string; sha256: string }>) {
        const bytes = await readFile(join(root, "corpus/assets", figure.imagePath));
        assert.equal(createHash("sha256").update(bytes).digest("hex"), figure.sha256, figure.imagePath);
    }
});

test("NTC pagine 222–231 colloca ogni asset una sola volta nel flusso", async () => {
    const units = await allUnits();
    const references = units.flatMap((unit) => unit.blocks).filter((block: any) => block.assetId).map((block: any) => block.assetId);
    for (const id of expectedFormulas.keys()) assert.equal(references.filter((candidate: string) => candidate === id).length, 1, id);

    const refs = (number: string) => units.find((unit) => unit.numbering.official === number).blocks
        .filter((block: any) => block.kind.endsWith("-ref"))
        .map((block: any) => block.assetId.replace(/^urn:structural-codes:it:asset:[^:]+:ntc2018:/u, ""));
    assert.deepEqual(refs("7.3.3.1"), ["7.3.3.1-7.3.4", "7.3.3.1-7.3.5a", "7.3.3.1-7.3.5b"]);
    assert.deepEqual(refs("7.3.3.2"), ["7.3.3.2-7.3.6", "7.3.3.2-7.3.7"]);
    assert.deepEqual(refs("7.3.3.3"), ["7.3.3.3-7.3.8", "7.3.3.3-7.3.9"]);
    assert.deepEqual(refs("7.3.5"), ["7.3.5-7.3.10"]);
    assert.deepEqual(refs("7.3.6"), ["7.3.iii"]);
    assert.deepEqual(refs("7.3.6.1"), ["7.3.6.1-7.3.11a", "7.3.6.1-7.3.11b", "7.3.6.1-7.3.12", "7.3.6.1-7.3.13", "7.3.6.1-7.3.14", "7.3.6.1-7.3.15"]);
    assert.deepEqual(refs("7.4.4.1.1"), ["7.4.1", "7.4.1", "7.4.2"]);
    assert.deepEqual(refs("7.4.4.1.2"), ["7.4.3"]);
    assert.deepEqual(refs("7.4.4.2.1"), ["7.4.4", "7.4.2", "7.4.5", "7.4.5:mi-d"]);
});
