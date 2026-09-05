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
    [formulaId("4.1.2.3.4.2:phi-yd"), "\\phi_{yd}=\\frac{M_{Rd}}{M'_{yd}}\\cdot\\phi'_{yd}"],
    [formulaId("4.1.22"), "V_{Rd}\\ge V_{Ed}"],
    [formulaId("4.1.23"), "V_{Rd}=\\max\\{[0{,}18\\cdot k\\cdot(100\\cdot\\rho_l\\cdot f_{ck})^{1/3}/\\gamma_c+0{,}15\\cdot\\sigma_{cp}]b_w\\cdot d\\ ;\\ (\\nu_{\\min}+0{,}15\\cdot\\sigma_{cp})\\cdot b_wd\\}"],
    [formulaId("4.1.24"), "V_{Rd}=0{,}7\\cdot b_w\\cdot d\\,(f_{ctd}^2+\\sigma_{cp}\\cdot f_{ctd})^{1/2}"],
    [formulaId("4.1.25"), "1\\le\\operatorname{ctg}\\theta\\le2{,}5"],
    [formulaId("4.1.26"), "V_{Rd}\\ge V_{Ed}"],
    [formulaId("4.1.27"), "V_{Rsd}=0{,}9\\cdot d\\cdot\\frac{A_{sw}}{s}\\cdot f_{yd}\\cdot(\\operatorname{ctg}\\alpha+\\operatorname{ctg}\\theta)\\cdot\\sin\\alpha"],
    [formulaId("4.1.28"), "V_{Rcd}=0{,}9\\cdot d\\cdot b_w\\cdot\\alpha_c\\cdot\\nu\\cdot f_{cd}(\\operatorname{ctg}\\alpha+\\operatorname{ctg}\\theta)/(1+\\operatorname{ctg}^2\\theta)"],
    [formulaId("4.1.29"), "V_{Rd}=\\min(V_{Rsd},V_{Rcd})"],
    [formulaId("4.1.30"), "a_l=(0{,}9\\cdot d\\cdot\\operatorname{ctg}\\theta)/2"],
    [formulaId("4.1.2.3.5.2:alpha-c"), "\\alpha_c=\\begin{cases}1 & \\text{per membrature non compresse}\\\\1+\\sigma_{cp}/f_{cd} & \\text{per }0\\le\\sigma_{cp}<0{,}25f_{cd}\\\\1{,}25 & \\text{per }0{,}25f_{cd}\\le\\sigma_{cp}\\le0{,}5f_{cd}\\\\2{,}5(1-\\sigma_{cp}/f_{cd}) & \\text{per }0{,}5f_{cd}<\\sigma_{cp}<f_{cd}\\end{cases}"],
    [formulaId("4.1.31"), "V_{Ed}=V_d+V_{md}+V_{pd}"],
    [formulaId("4.1.32"), "V_{Ed}\\le A_s\\cdot f_{yd}\\cdot\\sin\\alpha"],
    [formulaId("4.1.33"), "V_{Ed}\\le 0{,}5\\,b_w\\,d\\,\\nu\\,f_{cd}"],
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

test("NTC pagine 82–91 conserva esattamente tutte le 36 formule display", async () => {
    const manifest = await json("corpus/assets/ntc2018/4.1.json");
    const formulas = manifest.formulas.filter((formula: { pdfPage: number }) => formula.pdfPage >= 82 && formula.pdfPage <= 91);
    assert.equal(formulas.length, 36);
    assert.equal(formulas.filter((formula: { officialNumber: string | null }) => formula.officialNumber === null).length, 3);
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
    assert.equal(table.hideLabel, true);
    assert.equal([...table.headers, ...table.rows].flat().every((cell: { align?: string }) => cell.align === "center"), true);
});

test("NTC §4.1.2.3.4.2 conserva gli elenchi labeled, i rientri e la relazione NRcd inline", async () => {
    const unit = await json("corpus/units/ntc2018/4.1.2.3.4.2.json");
    const block = (suffix: string) => unit.blocks.find((candidate: { blockId: string }) => candidate.blockId.endsWith(`#block-${suffix}`));
    const firstList = ["editorial-006-1", "editorial-006-2", "editorial-006-3", "editorial-006-4", "editorial-006-5"].map(block);
    const secondList = ["editorial-010-1", "editorial-010-2"].map(block);
    for (const item of [...firstList, ...secondList]) {
        assert.equal(item.kind, "list-item");
        assert.equal(item.listMarker, "none");
        assert.equal(item.text.inline[0].kind, "math");
    }
    assert.equal(block("editorial-006").text.normalized, "dove");
    assert.equal(block("editorial-010").text.normalized, "dove");
    assert.equal(block("editorial-014").kind, "paragraph");
    assert.equal(block("editorial-014").assetId, undefined);
    assert.equal(block("editorial-014").text.inline[1].latex, "N_{Rcd}=A_c\\cdot f_{cd}");
    assert.equal(block("editorial-015-1").listMarker, "dash");
    assert.equal(block("editorial-015-1").indentLevel, undefined);
    assert.equal(block("editorial-016").indentLevel, 1);
    assert.equal(block("editorial-017").indentLevel, 1);
    assert.equal(block("editorial-018").listMarker, "dash");
    assert.equal(block("editorial-018").indentLevel, undefined);
    const phiList = ["editorial-021-1", "editorial-021-2", "editorial-021-3"].map(block);
    for (const item of phiList) {
        assert.equal(item.kind, "list-item");
        assert.equal(item.listMarker, "none");
        assert.equal(item.text.inline[0].kind, "math");
    }
});

test("NTC §4.1.2.3 conserva gli elenchi labeled dopo le formule di taglio, torsione e stabilità", async () => {
    const unit = async (number: string) => json("corpus/units/ntc2018/" + number + ".json");
    const checkList = async (number: string, suffixes: string[]) => {
        const record = await unit(number);
        for (const suffix of suffixes) {
            const item = record.blocks.find((candidate: { blockId: string }) => candidate.blockId.endsWith("#block-" + suffix));
            assert.equal(item.kind, "list-item", `${number}:${suffix}`);
            assert.equal(item.listMarker, "none", `${number}:${suffix}`);
            assert.equal(item.text.inline[0].kind, "math", `${number}:${suffix}`);
        }
    };
    await checkList("4.1.2.3.5.1", ["editorial-006-1", "editorial-006-2", "editorial-006-3", "editorial-008-1", "editorial-008-2", "editorial-008-3", "editorial-008-4"]);
    await checkList("4.1.2.3.5.2", ["editorial-012", "editorial-013", "editorial-014", "editorial-015"]);
    await checkList("4.1.2.3.5.3", ["editorial-005", "editorial-006", "editorial-007"]);
    await checkList("4.1.2.3.6", ["editorial-011-1", "editorial-011-2", "editorial-011-3", "editorial-011-4", "editorial-011-5"]);
    await checkList("4.1.2.3.9.2", ["editorial-016", "editorial-017", "editorial-018", "editorial-019", "editorial-020"]);
    await checkList("4.1.2.3.9.3", ["editorial-010", "editorial-011", "editorial-012", "editorial-013", "editorial-014"]);
    const noShear = await unit("4.1.2.3.5.1");
    assert.equal(noShear.blocks.some((candidate: { assetId?: string }) => candidate.assetId?.endsWith("4.1.2.3.5.1:parameters")), false);
    const shear = await unit("4.1.2.3.5.2");
    const alphaIntro = shear.blocks.find((candidate: { blockId: string }) => candidate.blockId.endsWith("editorial-015-alpha-c-intro"));
    assert.equal(alphaIntro.text.inline[0].latex, "\\alpha_c");
    const torsion = await unit("4.1.2.3.6");
    assert.equal(torsion.blocks.find((candidate: { blockId: string }) => candidate.blockId.endsWith("editorial-008-1")).text.normalized, "Con riferimento alle staffe trasversali la resistenza di progetto si calcola con");
    assert.equal(torsion.blocks.find((candidate: { blockId: string }) => candidate.blockId.endsWith("editorial-009-1")).text.normalized, "Con riferimento all’armatura longitudinale la resistenza di progetto si calcola con");
    const special = await unit("4.1.2.3.7");
    assert.equal(special.blocks.find((candidate: { blockId: string }) => candidate.blockId.endsWith("editorial-006-1")).kind, "paragraph");
    assert.equal(special.blocks.find((candidate: { blockId: string }) => candidate.blockId.endsWith("editorial-006-2")).kind, "paragraph");
});

test("NTC §4.1.6.1 e §4.1.8.1.4 separano gli elenchi labeled e annidati", async () => {
    const unit = async (number: string) => json("corpus/units/ntc2018/" + number + ".json");
    const checkList = async (number: string, suffixes: string[]) => {
        const record = await unit(number);
        for (const suffix of suffixes) {
            const item = record.blocks.find((candidate: { blockId: string }) => candidate.blockId.endsWith("#block-" + suffix));
            assert.equal(item.kind, "list-item", `${number}:${suffix}`);
            assert.equal(item.listMarker, "none", `${number}:${suffix}`);
            assert.equal(item.text.inline[0].kind, "math", `${number}:${suffix}`);
        }
    };
    await checkList("4.1.6.1.1", ["editorial-004", "editorial-005", "editorial-006", "editorial-007"]);
    await checkList("4.1.6.1.2", ["editorial-004", "editorial-004-1", "editorial-004-2"]);

    const prestress = await unit("4.1.8.1.4");
    const outer = ["editorial-007-1", "editorial-007-2", "editorial-007-3", "editorial-007-4"].map((suffix) => prestress.blocks.find((candidate: { blockId: string }) => candidate.blockId.endsWith("#block-" + suffix)));
    for (const item of outer) {
        assert.equal(item.kind, "list-item");
        assert.equal(item.listMarker, "none");
        assert.equal(item.text.inline[0].kind, "math");
    }
    for (const suffix of ["editorial-008", "editorial-009", "editorial-010"]) {
        const item = prestress.blocks.find((candidate: { blockId: string }) => candidate.blockId.endsWith("#block-" + suffix));
        assert.equal(item.kind, "list-item", suffix);
        assert.equal(item.listMarker, "none", suffix);
        assert.equal(item.indentLevel, 1, suffix);
    }
    const formulaIndex = prestress.blocks.findIndex((candidate: { assetId?: string }) => candidate.assetId === formulaId("4.1.48"));
    const doveIndex = prestress.blocks.findIndex((candidate: { blockId: string }) => candidate.blockId.endsWith("#block-editorial-007"));
    const firstDefinitionIndex = prestress.blocks.findIndex((candidate: { blockId: string }) => candidate.blockId.endsWith("#block-editorial-007-1"));
    assert.equal(prestress.blocks[doveIndex].text.normalized, "dove");
    assert.equal(doveIndex, formulaIndex + 1);
    assert.equal(firstDefinitionIndex, doveIndex + 1);
    assert.equal(prestress.blocks.find((candidate: { blockId: string }) => candidate.blockId.endsWith("#block-editorial-007-4")).text.inline[0].latex, "c\\le3");
});
