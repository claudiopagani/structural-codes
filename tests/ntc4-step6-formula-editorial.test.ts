import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = fileURLToPath(new URL("../", import.meta.url));
const formulaId = (number: string) => "urn:structural-codes:it:asset:formula:ntc2018:" + number;
const expected = new Map<string, string>([
    [formulaId("4.1.18a"), "M_{Rd}=M_{Rd}(N_{Ed})\\ge M_{Ed}"],
    [formulaId("4.1.18b"), "\\mu_\\phi=\\mu_\\phi(N_{Ed})\\ge\\mu_{Ed}"],
    [formulaId("4.1.19"), "\\left(\\frac{M_{Eyd}}{M_{Ryd}}\\right)^\\alpha+\\left(\\frac{M_{Ezd}}{M_{Rzd}}\\right)^\\alpha\\le1"],
    [formulaId("4.1.20"), "\\nu=N_{Ed}/N_{Rcd}"],
    [formulaId("4.1.21"), "\\omega_t=A_t\\cdot f_{yd}/N_{Rcd}"],
    [formulaId("4.1.2.3.4.2:n-rcd"), "N_{Rcd}=A_c\\cdot f_{cd}"],
    [formulaId("4.1.2.3.4.2:phi-yd"), "\\phi_{yd}=\\frac{M_{Rd}}{M'_{yd}}\\cdot\\phi'_{yd}"],
    [formulaId("4.1.22"), "V_{Rd}\\ge V_{Ed}"],
    [formulaId("4.1.23"), "V_{Rd}=\\max\\{[0{,}18\\cdot k\\cdot(100\\cdot\\rho_l\\cdot f_{ck})^{1/3}/\\gamma_c+0{,}15\\cdot\\sigma_{cp}]b_w\\cdot d\\ ;\\ (\\nu_{\\min}+0{,}15\\cdot\\sigma_{cp})\\cdot b_wd\\}"],
    [formulaId("4.1.24"), "V_{Rd}=0{,}7\\cdot b_w\\cdot d\\,(f_{ctd}^2+\\sigma_{cp}\\cdot f_{ctd})^{1/2}"],
    [formulaId("4.1.2.3.5.1:parameters"), "k=1+(200/d)^{1/2}\\le2,\\qquad \\nu_{\\min}=0{,}035k^{3/2}f_{ck}^{1/2}"],
    [formulaId("4.1.25"), "1\\le\\operatorname{ctg}\\theta\\le2{,}5"],
    [formulaId("4.1.26"), "V_{Rd}\\ge V_{Ed}"],
    [formulaId("4.1.27"), "V_{Rsd}=0{,}9\\cdot d\\cdot\\frac{A_{sw}}{s}\\cdot f_{yd}\\cdot(\\operatorname{ctg}\\alpha+\\operatorname{ctg}\\theta)\\cdot\\sin\\alpha"],
    [formulaId("4.1.28"), "V_{Rcd}=0{,}9\\cdot d\\cdot b_w\\cdot\\alpha_c\\cdot\\nu\\cdot f_{cd}(\\operatorname{ctg}\\alpha+\\operatorname{ctg}\\theta)/(1+\\operatorname{ctg}^2\\theta)"],
    [formulaId("4.1.29"), "V_{Rd}=\\min(V_{Rsd},V_{Rcd})"],
    [formulaId("4.1.30"), "a_l=(0{,}9\\cdot d\\cdot\\operatorname{ctg}\\theta)/2"],
    [formulaId("4.1.2.3.5.2:alpha-c"), "\\alpha_c=\\begin{cases}1 & \\text{per membrature non compresse}\\\\1+\\sigma_{cp}/f_{cd} & \\text{per }0\\le\\sigma_{cp}<0{,}25f_{cd}\\\\1{,}25 & \\text{per }0{,}25f_{cd}\\le\\sigma_{cp}\\le0{,}5f_{cd}\\\\2{,}5(1-\\sigma_{cp}/f_{cd}) & \\text{per }0{,}5f_{cd}<\\sigma_{cp}<f_{cd}\\end{cases}"],
    [formulaId("4.1.31"), "V_{Ed}=V_d+V_{md}+V_{pd}"],
    [formulaId("4.1.32"), "V_{Ed}\\le A_s\\cdot f_{yd}\\cdot\\sin\\alpha"],
    [formulaId("4.1.33"), "V_{Ed}\\le0{,}5b_wd\\nu f_{cd}"],
    [formulaId("4.1.34"), "T_{Rd}\\ge T_{Ed}"],
    [formulaId("4.1.35"), "T_{Rcd}=2\\cdot A\\cdot t\\cdot f'_{cd}\\cdot\\operatorname{ctg}\\theta/(1+\\operatorname{ctg}^2\\theta)"],
    [formulaId("4.1.36"), "T_{Rsd}=2\\cdot A\\cdot\\frac{A_s}{s}\\cdot f_{yd}\\cdot\\operatorname{ctg}\\theta"],
    [formulaId("4.1.37"), "T_{Rld}=2\\cdot A\\cdot\\frac{\\sum A_l}{u_m}\\cdot f_{yd}/\\operatorname{ctg}\\theta"],
    [formulaId("4.1.38"), "1\\le\\operatorname{ctg}\\theta\\le2{,}5"],
    [formulaId("4.1.39"), "T_{Rd}=\\min(T_{Rcd},T_{Rsd},T_{Rld})"],
    [formulaId("4.1.40"), "\\frac{T_{Ed}}{T_{Rcd}}+\\frac{V_{Ed}}{V_{Rcd}}\\le1"],
    [formulaId("4.1.2.3.6:reinforcement-ratios"), "\\operatorname{ctg}\\theta=(a_l/a_s)^{1/2},\\qquad a_l=\\sum A_l/u_m,\\qquad a_s=A_s/s"],
    [formulaId("4.1.41"), "\\lambda_{\\lim}=\\frac{25}{\\sqrt{\\nu}}"],
    [formulaId("4.1.42"), "\\lambda=l_0/i"],
    [formulaId("4.1.43"), "P_{Ed}\\le0{,}31\\frac{n}{n+1{,}6}\\frac{\\sum(E_{cd}I_c)}{L^2}"],
    [formulaId("4.1.44"), "EI=\\frac{0{,}3}{1+0{,}5\\phi}E_{cd}I_c"],
    [formulaId("4.1.45"), "A_{s,\\min}=0{,}26\\frac{f_{ctm}}{f_{yk}}b_t\\cdot d\\quad\\text{e comunque non minore di }0{,}0013\\cdot b_t\\cdot d"],
    [formulaId("4.1.46"), "A_{s,\\min}=(0{,}10N_{Ed}/f_{yd})\\quad\\text{e comunque non minore di }0{,}003A_c"],
    [formulaId("4.1.47"), "\\sigma_c<0{,}60f_{ckj}"],
    [formulaId("4.1.48"), "\\sigma_c<c\\,f_{cd}"],
    [formulaId("4.1.49"), "\\begin{aligned}\\sigma_{spi}&<0{,}85f_{p(0{,}1)k}\\qquad \\sigma_{spi}<0{,}75f_{ptk} &&\\text{per armatura post-tesa}\\\\\\sigma_{spi}&<0{,}90f_{p(0{,}1)k}\\qquad \\sigma_{spi}<0{,}80f_{ptk} &&\\text{per armatura pre-tesa}\\end{aligned}"],
]);

const stepUnits = [
    "4.1.2.3.10", "4.1.2.3.4.2", "4.1.2.3.5.1", "4.1.2.3.5.2", "4.1.2.3.5.3",
    "4.1.2.3.5.4", "4.1.2.3.6", "4.1.2.3.7", "4.1.2.3.9.1", "4.1.2.3.9.2",
    "4.1.2.3.9.3", "4.1.4", "4.1.6.1.1", "4.1.6.1.2", "4.1.6.1.4", "4.1.8.1.1",
    "4.1.8.1.4", "4.1.8.1.5", "4.1.8.2.2", "4.1.8.3",
];

async function json(path: string) {
    return JSON.parse(await readFile(join(root, path), "utf8"));
}

test("NTC pagine 82–91 conserva esattamente tutte le 38 formule display", async () => {
    const manifest = await json("corpus/assets/ntc2018/4.1.json");
    const formulas = manifest.formulas.filter((formula: { pdfPage: number }) => formula.pdfPage >= 82 && formula.pdfPage <= 91);
    assert.equal(formulas.length, 38);
    assert.equal(formulas.filter((formula: { officialNumber: string | null }) => formula.officialNumber === null).length, 5);
    assert.deepEqual(new Set(formulas.map((formula: { id: string }) => formula.id)), new Set(expected.keys()));
    for (const formula of formulas as Array<{ id: string; latex: string }>) {
        assert.equal(formula.latex, expected.get(formula.id), formula.id);
    }
});

test("NTC pagine 82–91 colloca ogni formula una sola volta nel corpus", async () => {
    const names = (await readdir(join(root, "corpus/units/ntc2018"))).filter((name) => name.endsWith(".json"));
    const units = await Promise.all(names.map((name) => json("corpus/units/ntc2018/" + name)));
    const ids = units.flatMap((unit) => unit.blocks)
        .filter((block: { kind: string }) => block.kind === "formula-ref")
        .map((block: { assetId: string }) => block.assetId);
    for (const id of expected.keys()) assert.equal(ids.filter((candidate: string) => candidate === id).length, 1, id);
});

test("NTC pagine 82–91 usa segmenti matematici completi e conserva il testo normalizzato", async () => {
    for (const number of stepUnits) {
        const unit = await json("corpus/units/ntc2018/" + number + ".json");
        for (const block of unit.blocks) {
            if (!block.text?.inline) continue;
            assert.equal(block.text.inline.map((segment: { value: string }) => segment.value).join(""), block.text.normalized, block.blockId);
            for (const segment of block.text.inline) {
                if (segment.kind !== "math") continue;
                assert.notEqual(segment.value, "/", block.blockId);
                assert.notEqual(segment.value, "=", block.blockId);
            }
        }
    }
    const stability = await json("corpus/units/ntc2018/4.1.2.3.9.2.json");
    assert.equal(stability.blocks.find((block: { blockId: string }) => block.blockId.endsWith("editorial-008")).text.normalized.includes("La snellezza è calcolata"), true);
    assert.equal(stability.blocks.find((block: { blockId: string }) => block.blockId.endsWith("editorial-008")).text.normalized.match(/La snellezza è calcolata/g)?.length, 1);
    const shear = await json("corpus/units/ntc2018/4.1.2.3.5.2.json");
    assert.equal(shear.blocks.find((block: { blockId: string }) => block.blockId.endsWith("editorial-015")).text.inline[2].latex, "\\nu=0{,}5");
});

test("NTC tabella non numerata dei coefficienti alpha conserva intestazioni e valori verificati", async () => {
    const manifest = await json("corpus/assets/ntc2018/4.1.json");
    const table = manifest.tables.find((candidate: { id: string }) => candidate.id.endsWith("4.1.2.3.4.2:alpha"));
    assert.ok(table);
    assert.equal(table.pdfPage, 82);
    assert.deepEqual(table.headers[0].map((cell: { text: string }) => cell.text), ["Nₑd/Nᵣcd", "0,1", "0,7", "1,0"]);
    assert.deepEqual(table.rows[0].map((cell: { text: string }) => cell.text), ["α", "1,0", "1,5", "2,0"]);
    assert.equal(table.headers[0][0].latex, "N_{Ed}/N_{Rcd}");
    assert.equal(table.rows[0][0].latex, "\\alpha");
});
