import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = fileURLToPath(new URL("../", import.meta.url));
const formulaId = (number: string) => "urn:structural-codes:it:asset:formula:ntc2018:" + number;

const expectedFormulas = new Map<string, string>([
    [formulaId("4.2.61"), "M=k\\cdot d\\cdot F_{p,c}=k\\cdot d\\cdot0{,}7\\cdot A_{res}\\cdot f_{tbk}"],
    [formulaId("4.2.62"), "F_{p,Cd}=0{,}7\\cdot\\frac{f_{tbk}\\cdot A_{res}}{\\gamma_{M7}}"],
    [formulaId("4.2.63"), "F_{v,Rd}=0{,}6\\,f_{tbk}A_{res}/\\gamma_{M2}"],
    [formulaId("4.2.64"), "F_{v,Rd}=0{,}5\\,f_{tbk}A_{res}/\\gamma_{M2}"],
    [formulaId("4.2.65"), "F_{v,Rd}=0{,}6\\,f_{trk}A_0/\\gamma_{M2}"],
    [formulaId("4.2.66"), "F_{v,Rd}=0{,}6\\,f_{tbk}A/\\gamma_{M2}"],
    [formulaId("4.2.67"), "F_{b,Rd}=k\\,\\alpha\\,f_{tk}d t/\\gamma_{M2}"],
    [formulaId("4.2.68"), "F_{t,Rd}=0{,}9\\,f_{tbk}A_{res}/\\gamma_{M2}"],
    [formulaId("4.2.69"), "F_{t,Rd}=0{,}6\\,f_{trk}A_{res}/\\gamma_{M2}"],
    [formulaId("4.2.70"), "B_{p,Rd}=0{,}6\\,\\pi d_m t_p f_{tk}/\\gamma_{M2}"],
    [formulaId("4.2.71"), "\\frac{F_{v,Ed}}{F_{v,Rd}}+\\frac{F_{t,Ed}}{1{,}4F_{t,Rd}}\\le 1"],
    [formulaId("4.2.72"), "F_{s,Rd}=n\\,\\mu\\,F_{p,Cd}/\\gamma_{M3}"],
    [formulaId("4.2.73"), "F_{s,Rd}=n\\,\\mu\\left(F_{p,Cd}-0{,}8F_{t,Ed}\\right)/\\gamma_{M3}"],
    [formulaId("4.2.74"), "F_{s,Rd,eser}=n\\,\\mu\\left(F_{p,Cd}-0{,}8F_{t,Ed,eser}\\right)/\\gamma_{M3}"],
    [formulaId("4.2.75"), "F_{v,Rd}=0{,}6\\,f_{upk}A/\\gamma_{M2}"],
    [formulaId("4.2.76"), "F_{b,Rd}=1{,}5 t d f_y/\\gamma_{M0}"],
    [formulaId("4.2.77"), "M_{Rd}=1{,}5 W_{el}f_{ypk}/\\gamma_{M0}"],
    [formulaId("4.2.78"), "F_{b,Rd,ser}=0{,}6 t d f_y/\\gamma_{M6,ser}>F_{b,Ed,ser}"],
    [formulaId("4.2.79"), "M_{Rd,ser}=0{,}8 W_{el}f_{ypk}/\\gamma_{M6,ser}>M_{Ed,ser}"],
    [formulaId("4.2.80"), "\\sigma_{h,Ed}=0{,}591\\sqrt{\\frac{E\\cdot F_{Ed,ser}\\cdot(d_0-d)}{d^2\\cdot t}}"],
    [formulaId("4.2.81"), "\\begin{aligned}\\left[\\sigma_{\\perp}^{2}+3\\left(\\tau_{\\perp}^{2}+\\tau_{\\parallel}^{2}\\right)\\right]^{0{,}5}&\\le f_{tk}/(\\beta\\gamma_{M2})\\\\\\sigma_{\\perp}&\\le0{,}9f_{tk}/\\gamma_{M2}\\end{aligned}"],
    [formulaId("4.2.82"), "F_{w,Ed}/F_{w,Rd}\\le1"],
    [formulaId("4.2.83"), "F_{w,Rd}=a f_{tk}/(\\sqrt{3}\\beta\\gamma_{M2})"],
    [formulaId("4.2.84"), "\\sqrt{n_{\\perp}^{2}+t_{\\perp}^{2}+t_{\\parallel}^{2}}\\le\\beta_1\\cdot f_{yk}"],
    [formulaId("4.2.85"), "|n_{\\perp}|+|t_{\\perp}|\\le\\beta_2\\cdot f_{yk}"],
    [formulaId("4.3.1.a"), "A_s\\ge\\rho_s\\cdot A_c"],
    [formulaId("4.3.1.b"), "\\rho_s=\\delta\\frac{f_{yk}}{235}\\frac{f_{ctm}}{f_{sk}}\\sqrt{\\frac{1}{1+\\frac{h_c}{2z_0}}}+0{,}3\\le\\delta\\frac{f_{yk}}{235}\\frac{f_{ctm}}{f_{sk}}"],
    [formulaId("4.3.2"), "b_{\\mathrm{eff}}=b_0+b_{e1}+b_{e2},"],
]);

async function json(path: string) {
    return JSON.parse(await readFile(join(root, path), "utf8"));
}

async function stepAssets() {
    const names = (await readdir(join(root, "corpus/assets/ntc2018"))).filter((name) => name.endsWith(".json"));
    const manifests = await Promise.all(names.map((name) => json("corpus/assets/ntc2018/" + name)));
    return {
        formulas: manifests.flatMap((manifest) => manifest.formulas ?? []).filter((formula: { pdfPage: number }) => formula.pdfPage >= 112 && formula.pdfPage <= 121),
        tables: manifests.flatMap((manifest) => manifest.tables ?? []).filter((table: { pdfPage: number }) => table.pdfPage >= 112 && table.pdfPage <= 121),
        figures: manifests.flatMap((manifest) => manifest.figures ?? []).filter((figure: { pdfPage: number }) => figure.pdfPage >= 112 && figure.pdfPage <= 121),
    };
}

test("NTC pagine 112–121 conserva esattamente le ventotto formule numerate", async () => {
    const { formulas } = await stepAssets();
    assert.equal(formulas.length, 28);
    assert.deepEqual(new Set(formulas.map((formula: { id: string }) => formula.id)), new Set(expectedFormulas.keys()));
    for (const formula of formulas as Array<{ id: string; latex: string }>) assert.equal(formula.latex, expectedFormulas.get(formula.id), formula.id);
});

test("NTC pagine 112–121 colloca ogni formula una volta e conserva gli inline completi", async () => {
    const names = (await readdir(join(root, "corpus/units/ntc2018"))).filter((name) => name.endsWith(".json"));
    const units = await Promise.all(names.map((name) => json("corpus/units/ntc2018/" + name)));
    const refs = units.flatMap((unit) => unit.blocks).filter((block: { kind: string }) => block.kind === "formula-ref").map((block: { assetId: string }) => block.assetId);
    for (const id of expectedFormulas.keys()) assert.equal(refs.filter((candidate: string) => candidate === id).length, 1, id);

    const stepUnits = units.filter((unit) => unit.blocks.some((block: { evidence?: { pdfPage?: number } }) => (block.evidence?.pdfPage ?? 0) >= 112 && (block.evidence?.pdfPage ?? 0) <= 121));
    assert.equal(stepUnits.length, 36);
    for (const unit of stepUnits) {
        for (const block of unit.blocks) {
            if (!block.text?.inline || block.evidence?.pdfPage < 112 || block.evidence?.pdfPage > 121) continue;
            assert.equal(block.text.inline.map((segment: { value: string }) => segment.value).join(""), block.text.normalized, block.blockId);
            for (const segment of block.text.inline) {
                if (segment.kind !== "math") continue;
                assert.ok(!segment.latex.includes("\\\\"), `${block.blockId}: doppio escape LaTeX`);
            }
        }
    }

    const bolts = await json("corpus/units/ntc2018/4.2.8.1.1.json");
    const friction = bolts.blocks.filter((block: { blockId: string }) => block.blockId.includes("friction-mu-"));
    assert.deepEqual(friction.map((block: { text: { normalized: string } }) => block.text.normalized.slice(0, 7)), ["μ = 0,5", "μ = 0,4", "– super", "μ = 0,3", "μ = 0,2"]);
    assert.deepEqual(friction.flatMap((block: { text: { inline: Array<{ kind: string; latex?: string }> } }) => block.text.inline.filter((segment) => segment.kind === "math").map((segment) => segment.latex)), ["\\mu=0{,}5", "\\mu=0{,}4", "\\mu\\mathrm{m}", "\\mu=0{,}3", "\\mu=0{,}2"]);
    assert.ok(bolts.blocks.some((block: { blockId: string }) => block.blockId.endsWith("block-p22-alpha-edge")));
    assert.ok(bolts.blocks.some((block: { blockId: string }) => block.blockId.endsWith("block-p22-k-inner")));
});

test("NTC pagine 112–121 conserva struttura e matematica delle sette tabelle", async () => {
    const { tables } = await stepAssets();
    assert.deepEqual(tables.map((table: { officialNumber: string }) => table.officialNumber).sort(), ["4.2.XIV", "4.2.XV", "4.2.XVI", "4.2.XVII", "4.2.XVIII", "4.2.XIX", "4.3.I"].sort());
    const xiv = tables.find((table: { officialNumber: string }) => table.officialNumber === "4.2.XIV");
    assert.ok(xiv);
    assert.deepEqual(xiv.headers, []);
    assert.equal(xiv.rows[0]?.[1]?.rowSpan, 5);
    assert.equal(xiv.rows[0]?.[1]?.latex, "\\gamma_{M2}=1{,}25");
    const xv = tables.find((table: { officialNumber: string }) => table.officialNumber === "4.2.XV");
    assert.ok(xv);
    assert.deepEqual(xv.headers, []);
    assert.equal(xv.rows[1]?.[1]?.latex.includes("k_i"), true);
    for (const number of ["4.2.XVI", "4.2.XVII"]) {
        const table = tables.find((candidate: { officialNumber: string }) => candidate.officialNumber === number);
        assert.ok(table);
        assert.equal(table.headers.length, 2);
        assert.equal(table.headers[0]?.[0]?.colSpan, 7);
        assert.equal(table.rows.length, 10);
    }
    const xviii = tables.find((table: { officialNumber: string }) => table.officialNumber === "4.2.XVIII");
    assert.ok(xviii);
    assert.equal(xviii.headers.length, 2);
    assert.equal(xviii.headers[0]?.[2]?.colSpan, 3);
    assert.equal(xviii.rows[4]?.[2]?.latex, "\\min(28t;400\\,\\mathrm{mm})");
    const xix = tables.find((table: { officialNumber: string }) => table.officialNumber === "4.2.XIX");
    assert.ok(xix);
    assert.deepEqual(xix.rows.map((row: Array<{ text: string }>) => row.map((cell) => cell.text)), [["β1", "0,85", "0,70", "0,62"], ["β2", "1,0", "0,85", "0,75"]]);
});

test("NTC pagine 114–121 usa i quattro crop ufficiali con hash verificabile", async () => {
    const { figures } = await stepAssets();
    const expected = new Map([
        ["4.2.5", "ba5ae85d0891692f10f89cfc42dcf87bbadd9c4f4f7905be874a0b143a26652b"],
        ["4.2.6", "98945fd5029ab66de03768940c6d3c4ae808dea757cdcd0f8bcc5b9ce9d4b55f"],
        ["4.2.7", "b7973db1ca9eb6e796638fe9c2b46272db9e82b54db5bd44b1d2318c1040b968"],
        ["4.3.1", "faddd29969857ee12c13e9fa1135c5054c07f720a5da828ba65fcc1fc6357435"],
    ]);
    assert.deepEqual(figures.map((figure: { officialNumber: string }) => figure.officialNumber).sort(), [...expected.keys()].sort());
    for (const figure of figures as Array<{ officialNumber: string; imagePath: string; sha256: string }>) {
        assert.equal(figure.sha256, expected.get(figure.officialNumber));
        const bytes = await readFile(join(root, "corpus/assets", figure.imagePath));
        assert.equal(createHash("sha256").update(bytes).digest("hex"), figure.sha256);
    }
});
