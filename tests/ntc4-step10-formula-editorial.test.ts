import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = fileURLToPath(new URL("../", import.meta.url));
const formulaId = (number: string) => "urn:structural-codes:it:asset:formula:ntc2018:" + number;

const expectedFormulas = new Map<string, string>([
    [formulaId("4.3.3"), "b_{\\mathrm{eff}}=b_0+\\beta_1b_{e-1}+\\beta_2b_{e-2}"],
    [formulaId("4.3.3-beta"), "\\beta_i=\\left(0{,}55+0{,}025\\cdot\\frac{L_e}{b_{\\mathrm{eff},i}}\\right)\\le1{,}0"],
    [formulaId("4.3.4"), "\\alpha_{\\mathrm{cr}}\\ge10"],
    [formulaId("4.3.5"), "\\bar{\\lambda}\\le0{,}5\\cdot\\sqrt{\\frac{N_{\\mathrm{pl,Rk}}}{N_{\\mathrm{Ed}}}}"],
    [formulaId("4.3.6"), "f_d=\\frac{f_k}{\\gamma_M}"],
    [formulaId("4.3.7"), "\\begin{aligned}\\eta&\\ge\\max\\left\\{\\left[1-\\left(\\frac{355}{f_{yk}}\\right)\\cdot\\left(1{,}0-0{,}04\\cdot L_e\\right)\\right];0{,}4\\right\\}&&\\text{per }L_e\\le25\\,\\mathrm{m}\\\\\\eta&\\ge1&&\\text{per }L_e>25\\,\\mathrm{m}\\end{aligned}"],
    [formulaId("4.3.8"), "\\begin{aligned}\\eta&\\ge\\max\\left\\{\\left[1-\\left(\\frac{355}{f_{yk}}\\right)\\cdot\\left(0{,}75-0{,}03\\cdot L_e\\right)\\right];0{,}4\\right\\}&&\\text{per }L_e\\le25\\,\\mathrm{m}\\\\\\eta&\\ge1&&\\text{per }L_e>25\\,\\mathrm{m}\\end{aligned}"],
    [formulaId("4.3.9"), "P_{Rd,a}=0{,}8f_{tk}\\left(\\pi d^2/4\\right)/\\gamma_V"],
    [formulaId("4.3.10"), "P_{Rd,c}=0{,}29\\alpha d^2\\left(f_{ck}E_{cm}\\right)^{0{,}5}/\\gamma_V"],
    [formulaId("4.3.11.a"), "\\alpha=0{,}2\\left(h_{sc}/d+1\\right)\\quad\\text{per }3\\le h_{sc}/d\\le4,"],
    [formulaId("4.3.11.b"), "\\alpha=1{,}0\\quad\\text{per }h_{sc}/d>4."],
    [formulaId("4.3.13"), "k_l=0{,}6\\cdot b_0\\cdot\\left(h_{sc}-h_p\\right)/h_p^2\\le1{,}0"],
    [formulaId("4.3.14"), "k_t=0{,}7\\cdot b_0\\cdot\\left(h_{sc}-h_p\\right)/h_p^2/\\sqrt{n_r}"],
    [formulaId("4.3.15"), "\\delta=\\frac{A_a\\cdot f_{yk}}{\\gamma_A}\\cdot\\frac{1}{N_{pl,Rd}}"],
    [formulaId("4.3.16"), "(EJ)_{\\mathrm{eff}}=E_aJ_a+E_sJ_s+k_eE_{c,\\mathrm{eff}}\\cdot J_c"],
    [formulaId("4.3.17"), "E_{c,\\mathrm{eff}}=E_{cm}\\frac{1}{1+(N_{G,Ed}/N_{Ed})\\varphi}"],
    [formulaId("4.3.18"), "\\bar{\\lambda}=\\sqrt{\\frac{N_{pl,Rk}}{N_{cr}}}"],
    [formulaId("4.3.19"), "N_{pl,Rk}=A_a\\cdot f_{yk}+0{,}85\\cdot A_c\\cdot f_{ck}+A_s\\cdot f_{sk}"],
    [formulaId("4.3.20"), "(EJ)_{\\mathrm{eff,II}}=k_0\\cdot\\left(E_aJ_a+E_sJ_s+k_{e,II}E_{cm}\\cdot J_c\\right)"],
    [formulaId("4.3.21"), "N_{pl,Rd}=\\frac{A_a\\cdot f_{yk}}{\\gamma_A}+\\frac{A_c\\cdot0{,}85\\cdot f_{ck}}{\\gamma_C}+\\frac{A_s\\cdot f_{sk}}{\\gamma_S}"],
    [formulaId("4.3.22"), "N_{pl,Rd}=\\eta_a\\cdot\\frac{A_a\\cdot f_{yk}}{\\gamma_A}+\\frac{A_c\\cdot f_{ck}}{\\gamma_C}\\left(1+\\eta_c\\cdot\\frac{t}{d}\\cdot\\frac{f_{yk}}{f_{ck}}\\right)+\\frac{A_s\\cdot f_{sk}}{\\gamma_S}"],
    [formulaId("4.3.23"), "\\eta_a=\\begin{cases}0{,}25\\left(3+2\\cdot\\bar{\\lambda}\\right)\\le1{,}0&e=0\\\\0{,}25\\left(3+2\\cdot\\bar{\\lambda}\\right)+10\\cdot\\left(0{,}25-0{,}5\\cdot\\bar{\\lambda}\\right)\\cdot\\frac{e}{d}&0<e/d\\le0{,}1\\\\1{,}0&e>0{,}1\\end{cases}"],
    [formulaId("4.3.24"), "\\eta_c=\\begin{cases}\\left(4{,}9-18{,}5\\bar{\\lambda}+17\\cdot\\bar{\\lambda}^2\\right)\\ge0&e=0\\\\\\left(4{,}9-18{,}5\\bar{\\lambda}+17\\cdot\\bar{\\lambda}^2\\right)\\cdot\\left(1-10\\frac{e}{d}\\right)&0<e/d\\le0{,}1\\\\0&e>0{,}1\\end{cases}"],
    [formulaId("4.3.25"), "N_{pm,Rd}=0{,}85\\cdot\\frac{f_{ck}}{\\gamma_C}\\cdot A_c"],
    [formulaId("4.3.26"), "M_{pl,Rd}(N_{Ed})=\\mu_d\\cdot M_{pl,Rd}"],
    [formulaId("4.3.27"), "\\begin{aligned}\\frac{M_{y,Ed}}{\\mu_{dy}\\cdot M_{pl,y,Rd}}&\\le\\alpha_{M,y}&&\\frac{M_{z,Ed}}{\\mu_{dz}\\cdot M_{pl,z,Rd}}\\le\\alpha_{M,z}\\\\\\frac{M_{y,Ed}}{\\mu_{dy}\\cdot M_{pl,y,Rd}}+\\frac{M_{z,Ed}}{\\mu_{dz}\\cdot M_{pl,z,Rd}}&\\le1{,}0\\end{aligned}"],
    [formulaId("4.3.28"), "\\begin{aligned}V_{a,Ed}&=V_{Ed}\\cdot\\frac{M_{pl,a,Rd}}{M_{pl,Rd}}\\\\V_{c,Ed}&=V_{Ed}-V_{a,Ed}\\end{aligned}"],
    [formulaId("4.3.29"), "N_{b,Rd}=\\chi\\cdot N_{pl,Rd}"],
    [formulaId("4.3.30"), "\\chi=\\frac{1}{\\Phi+\\sqrt{\\Phi^2-\\bar{\\lambda}^2}}\\le1.0"],
    [formulaId("4.3.31"), "\\frac{d}{t}\\le90\\cdot\\frac{235}{f_y}\\qquad\\text{per colonne circolari cave riempite;}"],
    [formulaId("4.3.32"), "\\frac{d}{t}\\le52\\cdot\\sqrt{\\frac{235}{f_y}}\\qquad\\text{per colonne rettangolari cave riempite;}"],
]);

async function json(path: string) {
    return JSON.parse(await readFile(join(root, path), "utf8"));
}

async function stepAssets() {
    const names = (await readdir(join(root, "corpus/assets/ntc2018"))).filter((name) => name.endsWith(".json"));
    const manifests = await Promise.all(names.map((name) => json("corpus/assets/ntc2018/" + name)));
    return {
        formulas: manifests.flatMap((manifest) => manifest.formulas ?? []).filter((formula: { pdfPage: number }) => formula.pdfPage >= 122 && formula.pdfPage <= 131),
        tables: manifests.flatMap((manifest) => manifest.tables ?? []).filter((table: { pdfPage: number }) => table.pdfPage >= 122 && table.pdfPage <= 131),
        figures: manifests.flatMap((manifest) => manifest.figures ?? []).filter((figure: { pdfPage: number }) => figure.pdfPage >= 122 && figure.pdfPage <= 131),
    };
}

test("NTC pagine 122–131 conserva esattamente le trentuno formule display", async () => {
    const { formulas } = await stepAssets();
    assert.equal(formulas.length, 31);
    assert.deepEqual(new Set(formulas.map((formula: { id: string }) => formula.id)), new Set(expectedFormulas.keys()));
    for (const formula of formulas as Array<{ id: string; latex: string }>) assert.equal(formula.latex, expectedFormulas.get(formula.id), formula.id);
    assert.ok(!formulas.some((formula: { id: string }) => formula.id === formulaId("4.3.30-phi")));
});

test("NTC pagine 122–131 colloca ogni formula una volta e conserva gli inline completi", async () => {
    const names = (await readdir(join(root, "corpus/units/ntc2018"))).filter((name) => name.endsWith(".json"));
    const units = await Promise.all(names.map((name) => json("corpus/units/ntc2018/" + name)));
    const refs = units.flatMap((unit) => unit.blocks).filter((block: { kind: string }) => block.kind === "formula-ref").map((block: { assetId: string }) => block.assetId);
    for (const id of expectedFormulas.keys()) assert.equal(refs.filter((candidate: string) => candidate === id).length, 1, id);

    const stepUnits = units.filter((unit) => unit.blocks.some((block: { evidence?: { pdfPage?: number } }) => (block.evidence?.pdfPage ?? 0) >= 122 && (block.evidence?.pdfPage ?? 0) <= 131));
    assert.equal(stepUnits.length, 34);
    for (const unit of stepUnits) {
        for (const block of unit.blocks) {
            if (!block.text?.inline || block.evidence?.pdfPage < 122 || block.evidence?.pdfPage > 131) continue;
            assert.equal(block.text.inline.map((segment: { value: string }) => segment.value).join(""), block.text.normalized, block.blockId);
            for (const segment of block.text.inline) {
                if (segment.kind !== "math") continue;
                assert.ok(!segment.latex.includes("\\\\"), `${block.blockId}: doppio escape LaTeX`);
            }
        }
    }

    const stability = await json("corpus/units/ntc2018/4.3.5.4.1.json");
    const phi = stability.blocks.find((block: { blockId: string }) => block.blockId.endsWith("block-p-003"));
    assert.deepEqual(phi.text.inline.filter((segment: { kind: string }) => segment.kind === "math").map((segment: { latex: string }) => segment.latex), [
        "\\Phi=0.5\\left[1+\\alpha\\left(\\bar{\\lambda}-0.2\\right)+\\bar{\\lambda}^2\\right]",
        "\\alpha",
    ]);
    const confinement = await json("corpus/units/ntc2018/4.3.5.3.1.json");
    assert.ok(confinement.blocks.some((block: { blockId: string }) => block.blockId.endsWith("block-editorial-001")));
    const definitions = await json("corpus/units/ntc2018/4.3.5.2.json");
    assert.equal(definitions.blocks.filter((block: { blockId: string }) => block.blockId.includes("definition-")).length, 4);
});

test("NTC pagine 122–131 conserva struttura e matematica delle due tabelle", async () => {
    const { tables } = await stepAssets();
    assert.deepEqual(tables.map((table: { officialNumber: string }) => table.officialNumber).sort(), ["4.3.II", "4.3.III"]);
    const ii = tables.find((table: { officialNumber: string }) => table.officialNumber === "4.3.II");
    assert.ok(ii);
    assert.equal(ii.headers.length, 1);
    assert.deepEqual(ii.rows.map((row: Array<{ text: string }>) => row.map((cell) => cell.text)), [
        ["Nr=1", "≤1,0", "0,85", "0,75"],
        [">1,0", "1,00", "0,75"],
        ["Nr=2", "≤1,0", "0,70", "0,60"],
        [">1,0", "0,80", "0,60"],
    ]);
    assert.equal(ii.rows[0][0].rowSpan, 2);
    assert.equal(ii.rows[2][0].rowSpan, 2);

    const iii = tables.find((table: { officialNumber: string }) => table.officialNumber === "4.3.III");
    assert.ok(iii);
    assert.equal(iii.rows[0][0].rowSpan, 2);
    assert.equal(iii.rows[2][0].rowSpan, 2);
    assert.equal(iii.rows[4][0].rowSpan, 3);
    assert.ok(iii.rows[6][1].latex.includes("\\rho_s=A_s/A_c"));
});

test("NTC pagine 122–131 usa gli otto crop ufficiali con hash verificabile", async () => {
    const { figures } = await stepAssets();
    assert.equal(figures.length, 8);
    assert.deepEqual(figures.map((figure: { officialNumber: string }) => figure.officialNumber).sort(), ["4.3.2", "4.3.3", "4.3.4(a)", "4.3.4(b)", "4.3.5", "4.3.6", "4.3.7", "4.3.8"].sort());
    for (const figure of figures as Array<{ imagePath: string; sha256: string }>) {
        const bytes = await readFile(join(root, "corpus/assets", figure.imagePath));
        assert.equal(createHash("sha256").update(bytes).digest("hex"), figure.sha256);
    }
});
