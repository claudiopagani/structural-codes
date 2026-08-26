/* eslint-disable @typescript-eslint/no-explicit-any */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = fileURLToPath(new URL("../", import.meta.url));
const formulaId = (suffix: string) =>
    `urn:structural-codes:it:asset:formula:ntc2018:${suffix}`;

async function json(path: string) {
    return JSON.parse(await readFile(join(root, path), "utf8"));
}

async function allUnits() {
    const names = (await readdir(join(root, "corpus/units/ntc2018"))).filter(
        (name) => name.endsWith(".json"),
    );
    return Promise.all(
        names.map((name) => json(`corpus/units/ntc2018/${name}`)),
    );
}

async function stepAssets() {
    const manifests = await Promise.all([
        json("corpus/assets/ntc2018/7.4-step1.json"),
        json("corpus/assets/ntc2018/7.4-step2.json"),
        json("corpus/assets/ntc2018/7.4-step3.json"),
    ]);
    const inStep = (asset: { pdfPage: number }) =>
        asset.pdfPage >= 232 && asset.pdfPage <= 241;
    return {
        formulas: manifests
            .flatMap((manifest) => manifest.formulas ?? [])
            .filter(inStep),
        tables: manifests
            .flatMap((manifest) => manifest.tables ?? [])
            .filter(inStep),
        figures: manifests
            .flatMap((manifest) => manifest.figures ?? [])
            .filter(inStep),
    };
}

const expectedFormulas = new Map<string, string>([
    [formulaId("7.4.6"), "V_{jbd}=\\gamma_{Rd}\\cdot\\left(A_{s1}+A_{s2}\\right)\\cdot f_{yd}-V_C\\qquad\\text{per nodi interni}"],
    [formulaId("7.4.7"), "V_{jbd}=\\gamma_{Rd}\\cdot A_{s1}\\cdot f_{yd}-V_C\\qquad\\text{per nodi esterni}"],
    [formulaId("7.4.8"), "V_{jbd}\\le\\eta\\cdot f_{cd}\\cdot b_j\\cdot h_{jc}\\cdot\\sqrt{1-\\frac{\\nu_d}{\\eta}}"],
    [formulaId("7.4.9"), "\\eta=\\alpha_j\\cdot\\left(1-\\frac{f_{ck}}{250}\\right)\\qquad\\text{con }f_{ck}\\text{ espresso in MPa}"],
    [formulaId("7.4.10"), "\\frac{A_{sh}\\cdot f_{ywd}}{b_j\\cdot h_{jw}}\\ge\\frac{\\left[V_{jbd}/\\left(b_j\\cdot h_{jc}\\right)\\right]^2}{f_{ctd}+\\nu_d\\cdot f_{cd}}-f_{ctd}"],
    [formulaId("7.4.11"), "A_{sh}\\cdot f_{ywd}\\ge\\gamma_{Rd}\\cdot\\left(A_{s1}+A_{s2}\\right)\\cdot f_{yd}\\cdot\\left(1-0{,}8\\nu_d\\right)\\qquad\\text{per nodi interni}"],
    [formulaId("7.4.12"), "A_{sh}\\cdot f_{ywd}\\ge\\gamma_{Rd}\\cdot A_{s2}\\cdot f_{yd}\\cdot\\left(1-0{,}8\\nu_d\\right)\\qquad\\text{per nodi esterni}"],
    [formulaId("7.4.13"), "h_{cr}=\\max\\left(l_w,\\frac{h_w}{6}\\right)\\quad\\text{purché}\\quad h_{cr}\\le\\begin{cases}2\\cdot l_w\\\\h_s&\\text{per }n\\le6\\text{ piani}\\\\2\\cdot h_s&\\text{per }n\\ge7\\text{ piani}\\end{cases}"],
    [formulaId("7.4.14"), "1{,}5\\le q\\cdot\\sqrt{\\left(\\frac{\\gamma_{Rd}}{q}\\cdot\\frac{M_{Rd}}{M_{Ed}}\\right)^2+0{,}1\\cdot\\left(\\frac{S_e(T_C)}{S_e(T_1)}\\right)^2}\\le q\\quad\\text{per pareti snelle}"],
    [formulaId("7.4.15"), "\\gamma_{Rd}\\cdot\\frac{M_{Rd}}{M_{Ed}}\\le q\\quad\\text{per pareti tozze}"],
    [formulaId("7.4.16"), "V_{Ed}\\le V_{Rd,c}+0{,}75\\cdot\\rho_h\\cdot f_{yd,h}\\cdot b_w\\cdot\\alpha_s\\cdot l_w"],
    [formulaId("7.4.17"), "\\rho_h\\cdot f_{yd,h}\\cdot b_w\\cdot z\\le\\rho_v\\cdot f_{yd,v}\\cdot b_w\\cdot z+\\min N_{Ed}"],
    [formulaId("7.4.18"), "V_{Ed}\\le V_{Rd,S}"],
    [formulaId("7.4.19"), "V_{Rd,S}=V_{dd}+V_{id}+V_{fd}"],
    [formulaId("7.4.20"), "V_{dd}=\\min\\begin{cases}1{,}3\\cdot\\sum A_{sj}\\cdot\\sqrt{f_{cd}\\cdot f_{yd}}\\\\0{,}25\\cdot f_{yd}\\cdot\\sum A_{sj}\\end{cases}"],
    [formulaId("7.4.21"), "V_{id}=f_{yd}\\cdot\\sum A_{si}\\cdot\\cos(\\phi_i)"],
    [formulaId("7.4.22"), "V_{fd}=\\min\\begin{cases}\\mu_f\\cdot\\left[\\left(\\sum A_{sj}\\cdot f_{yd}+N_{Ed}\\right)\\cdot\\xi+M_{Ed}/z\\right]\\\\0{,}5\\cdot\\eta\\cdot f_{cd}\\cdot\\xi\\cdot l_w\\cdot b_{wo}\\end{cases}"],
    [formulaId("7.4.23"), "V_{Ed}\\le f_{ctd}\\cdot b\\cdot d"],
    [formulaId("7.4.24"), "V_{iE}\\le2\\cdot A_s\\cdot f_{yd}\\cdot\\operatorname{sen}(\\phi)"],
    [formulaId("7.4.26"), "\\frac{1{,}4}{f_{yk}}<\\rho<\\rho_{comp}+\\frac{3{,}5}{f_{yk}}"],
    [formulaId("7.4.27"), "\\alpha_{bL}=\\begin{cases}\\dfrac{7{,}5\\cdot f_{ctm}}{\\gamma_{Rd}\\cdot f_{yd}}\\cdot\\dfrac{1+0{,}8\\nu_d}{1+0{,}75\\kappa_D\\cdot\\rho_{comp}/\\rho}&\\text{per nodi interni}\\\\\\dfrac{7{,}5\\cdot f_{ctm}}{\\gamma_{Rd}\\cdot f_{yd}}\\cdot\\left(1+0{,}8\\nu_d\\right)&\\text{per nodi esterni}\\end{cases}"],
    [formulaId("7.4.28"), "1\\%\\le\\rho\\le4\\%"],
    [formulaId("7.4.28:staffe-minime"), "\\max\\left[6\\,\\mathrm{mm};\\;0{,}4\\cdot d_{bl,max}\\cdot\\sqrt{\\frac{f_{yd,l}}{f_{yd,st}}}\\right]\\quad\\text{per CD “A”, e }6\\,\\mathrm{mm}\\quad\\text{per CD “B”}"],
]);

test("NTC pagine 232–241 conserva i ventitré blocchi formula ufficiali", async () => {
    const { formulas } = await stepAssets();
    assert.equal(formulas.length, 23);
    assert.deepEqual(
        new Set(formulas.map((formula: { id: string }) => formula.id)),
        new Set(expectedFormulas.keys()),
    );
    for (const formula of formulas as Array<{ id: string; latex: string }>) {
        assert.equal(formula.latex, expectedFormulas.get(formula.id), formula.id);
    }
    assert.ok(!formulas.some(({ officialNumber }: any) => officialNumber === "7.4.25"));
});

test("NTC pagine 232–241 usa inline completi senza q discorsive", async () => {
    const units = await allUnits();
    const inStep = (page: number | undefined) =>
        (page ?? 0) >= 232 && (page ?? 0) <= 241;
    const stepUnits = units.filter((unit) =>
        unit.blocks.some((block: any) => inStep(block.evidence?.pdfPage)),
    );
    assert.equal(stepUnits.length, 22);

    const math = new Map<string, string>();
    const qContexts: string[] = [];
    for (const unit of stepUnits) {
        for (const block of unit.blocks) {
            if (!block.text?.inline || !inStep(block.evidence?.pdfPage)) continue;
            assert.equal(
                block.text.inline.map((segment: any) => segment.value).join(""),
                block.text.normalized,
                block.blockId,
            );
            assert.doesNotMatch(block.text.normalized, /[\u0000-\u001f\u007f-\u009f]/u);
            for (const segment of block.text.inline.filter(
                (candidate: any) => candidate.kind === "math",
            )) {
                math.set(
                    `${unit.numbering.official}:${block.blockId.split("#").at(-1)}:${segment.value}`,
                    segment.latex,
                );
                if (segment.value === "q") qContexts.push(block.text.normalized);
            }
        }
    }

    assert.equal(qContexts.length, 3);
    for (const context of qContexts) {
        assert.match(context, /(^|[^\p{L}\p{N}_])q([^\p{L}\p{N}_]|$)/u);
    }
    assert.equal(math.get("7.4.4.5:block-editorial-001:l_w/b_w > 4"), "\\frac{l_w}{b_w}>4");
    assert.equal(math.get("7.4.4.5.1:block-editorial-033:α_s = M_Ed/(V_Ed·l_w)"), "\\alpha_s=\\frac{M_{Ed}}{V_{Ed}\\cdot l_w}");
    assert.equal(math.get("7.4.4.5.1:block-editorial-047:V_id>V_Ed/2"), "V_{id}>V_{Ed}/2");
    assert.equal(math.get("7.4.4.5.2:block-editorial-001:M_Ed/M_Rd"), "M_{Ed}/M_{Rd}");
    assert.equal(math.get("7.4.4.5.2:block-editorial-006:l_c ≥ max(0,20·l_w, 1,5·b_w)"), "l_c\\ge\\max(0{,}20\\cdot l_w,1{,}5\\cdot b_w)");
    assert.equal(math.get("7.4.4.6:block-editorial-008:φ"), "\\phi");
    assert.equal(math.get("7.4.5.1:block-editorial-005:q_0"), "q_0");
    assert.equal(math.get("7.4.5.1:block-editorial-007:μ_s"), "\\mu_s");
    assert.equal(math.get("7.4.6.2.1:block-editorial-017:κ_D"), "\\kappa_D");
    assert.equal(math.get("7.4.6.2.2:block-editorial-016:6"), "6");
});

test("NTC pagine 232–241 conserva i quattro crop ufficiali e nessuna tabella", async () => {
    const { tables, figures } = await stepAssets();
    assert.equal(tables.length, 0);
    assert.deepEqual(
        figures.map((figure: any) => figure.officialNumber),
        ["7.4.3", "7.4.4", "7.4.5", "7.4.6"],
    );
    for (const figure of figures as Array<{ imagePath: string; sha256: string }>) {
        const bytes = await readFile(join(root, "corpus/assets", figure.imagePath));
        assert.equal(
            createHash("sha256").update(bytes).digest("hex"),
            figure.sha256,
            figure.imagePath,
        );
    }
});

test("NTC pagine 232–241 colloca ogni asset una sola volta nel flusso", async () => {
    const units = await allUnits();
    const references = units
        .flatMap((unit) => unit.blocks)
        .filter((block: any) => block.assetId)
        .map((block: any) => block.assetId);
    for (const id of expectedFormulas.keys()) {
        assert.equal(references.filter((candidate: string) => candidate === id).length, 1, id);
    }
    for (const number of ["7.4.3", "7.4.4", "7.4.5", "7.4.6"]) {
        const id = `urn:structural-codes:it:asset:figure:ntc2018:${number}`;
        assert.equal(references.filter((candidate: string) => candidate === id).length, 1, id);
    }
});
