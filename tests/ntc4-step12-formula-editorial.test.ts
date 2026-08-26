import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = fileURLToPath(new URL("../", import.meta.url));
const formulaId = (number: string) => `urn:structural-codes:it:asset:formula:ntc2018:${number}`;

const expectedFormulas = new Map<string, string>([
    [formulaId("4.4.9"), "\\tau_{\\mathrm{tor},d}\\le k_{\\mathrm{sh}}f_{v,d}"],
    [formulaId("4.4.10"), "\\frac{\\tau_{\\mathrm{tor},d}}{k_{\\mathrm{sh}}f_{v,d}}+\\left(\\frac{\\tau_d}{f_{v,d}}\\right)^2\\le1"],
    [formulaId("4.4.11"), "\\frac{\\sigma_{m,d}}{k_{\\mathrm{crit},m}f_{m,d}}\\le1"],
    [formulaId("4.4.12"), "k_{\\mathrm{crit},m}=\\begin{cases}1&\\text{per }\\lambda_{\\mathrm{rel},m}\\le0{,}75\\\\1{,}56-0{,}75\\lambda_{\\mathrm{rel},m}&\\text{per }0{,}75<\\lambda_{\\mathrm{rel},m}\\le1{,}4\\\\1/\\lambda_{\\mathrm{rel},m}^{2}&\\text{per }1{,}4<\\lambda_{\\mathrm{rel},m}\\end{cases}"],
    [formulaId("4.4.13"), "\\frac{\\sigma_{c,0,d}}{k_{\\mathrm{crit},c}f_{c,0,d}}\\le1"],
    [formulaId("4.4.14"), "\\lambda_{\\mathrm{rel},c}=\\sqrt{\\frac{f_{c,0,k}}{\\sigma_{c,\\mathrm{crit}}}}=\\frac{\\lambda}{\\pi}\\sqrt{\\frac{f_{c,0,k}}{E_{0{,}05}}}"],
    [formulaId("4.4.15"), "k_{\\mathrm{crit},c}=\\frac{1}{k+\\sqrt{k^2-\\lambda_{\\mathrm{rel},c}^{2}}}"],
    [formulaId("4.4.16"), "k=0{,}5\\left(1+\\beta_c(\\lambda_{\\mathrm{rel},c}-0{,}3)+\\lambda_{\\mathrm{rel},c}^{2}\\right)"],
    [formulaId("4.5.1"), "\\lambda=h_0/t"],
    [formulaId("4.5.2"), "f_d=f_k/\\gamma_M"],
    [formulaId("4.5.3"), "f_{vd}=f_{vk}/\\gamma_M"],
    [formulaId("4.5.4"), "f_{d,\\mathrm{rid}}=\\Phi\\cdot f_d"],
    [formulaId("4.5.5"), "h_0=\\rho h"],
    [formulaId("4.5.6"), "m=6e/t"],
    [formulaId("4.5.7"), "e_{s1}=\\frac{N_1d_1}{N_1+\\sum N_2};\\quad e_{s2}=\\frac{\\sum N_2d_2}{N_1+\\sum N_2}"],
    [formulaId("4.5.8"), "e_a=h/200"],
    [formulaId("4.5.9"), "e_v=M_v/N"],
    [formulaId("4.5.10"), "e_1=\\lvert e_s\\rvert+e_a;\\quad e_2=\\frac{e_1}{2}+\\lvert e_v\\rvert"],
    [formulaId("4.5.11"), "e_1\\le0{,}33t;\\quad e_2\\le0{,}33t"],
    [formulaId("4.5.12"), "\\sigma=N/(0{,}65A)\\le f_k/\\gamma_M"],
]);

async function json(path: string) {
    return JSON.parse(await readFile(join(root, path), "utf8"));
}

async function allUnits() {
    const names = (await readdir(join(root, "corpus/units/ntc2018"))).filter((name) => name.endsWith(".json"));
    return Promise.all(names.map((name) => json(`corpus/units/ntc2018/${name}`)));
}

async function stepAssets() {
    const names = (await readdir(join(root, "corpus/assets/ntc2018"))).filter((name) => name.endsWith(".json"));
    const manifests = await Promise.all(names.map((name) => json(`corpus/assets/ntc2018/${name}`)));
    const inStep = (asset: { pdfPage: number }) => asset.pdfPage >= 142 && asset.pdfPage <= 151;
    return {
        formulas: manifests.flatMap((manifest) => manifest.formulas ?? []).filter(inStep),
        tables: manifests.flatMap((manifest) => manifest.tables ?? []).filter(inStep),
        figures: manifests.flatMap((manifest) => manifest.figures ?? []).filter(inStep),
    };
}

test("NTC pagine 142–151 conserva esattamente le venti formule display", async () => {
    const { formulas } = await stepAssets();
    assert.equal(formulas.length, 20);
    assert.deepEqual(new Set(formulas.map((formula: { id: string }) => formula.id)), new Set(expectedFormulas.keys()));
    for (const formula of formulas as Array<{ id: string; latex: string }>) assert.equal(formula.latex, expectedFormulas.get(formula.id), formula.id);
});

test("NTC pagine 142–151 colloca ogni formula una volta e conserva gli inline", async () => {
    const units = await allUnits();
    const refs = units.flatMap((unit) => unit.blocks).filter((block: { kind: string }) => block.kind === "formula-ref").map((block: { assetId: string }) => block.assetId);
    for (const id of expectedFormulas.keys()) assert.equal(refs.filter((candidate: string) => candidate === id).length, 1, id);

    const inStep = (page: number | undefined) => (page ?? 0) >= 142 && (page ?? 0) <= 151;
    const stepUnits = units.filter((unit) => unit.blocks.some((block: { evidence?: { pdfPage?: number } }) => inStep(block.evidence?.pdfPage)));
    assert.equal(stepUnits.length, 37);
    for (const unit of stepUnits) {
        for (const block of unit.blocks) {
            if (!block.text?.inline || !inStep(block.evidence?.pdfPage)) continue;
            assert.equal(block.text.inline.map((segment: { value: string }) => segment.value).join(""), block.text.normalized, block.blockId);
            for (const segment of block.text.inline) {
                if (segment.kind !== "math") continue;
                assert.ok(!segment.latex.includes("\\\\"), `${block.blockId}: doppio escape LaTeX`);
                assert.ok(!/\d,(?=\d)/u.test(segment.latex), `${block.blockId}: virgola decimale non protetta`);
            }
        }
    }

    const torsion = await json("corpus/units/ntc2018/4.4.8.1.10.json");
    assert.deepEqual(torsion.blocks.filter((block: { kind: string }) => block.kind === "list-item").flatMap((block: { text: { inline: Array<{ kind: string; latex: string }> } }) => block.text.inline.filter((segment) => segment.kind === "math").map((segment) => segment.latex)), ["k_{\\mathrm{sh}}=1{,}2", "k_{\\mathrm{sh}}=1+0{,}15h/b\\le2", "b", "h", "b\\le h", "k_{\\mathrm{sh}}=1"]);

    const stabilityBeam = await json("corpus/units/ntc2018/4.4.8.2.1.json");
    const lambdaBeam = stabilityBeam.blocks.find((block: { text?: { normalized?: string } }) => block.text?.normalized?.startsWith("λrel,m ="));
    assert.equal(lambdaBeam.text.inline.find((segment: { kind: string }) => segment.kind === "math").latex, "\\lambda_{\\mathrm{rel},m}=\\sqrt{f_{m,k}/\\sigma_{m,\\mathrm{crit}}}");

    const stabilityColumn = await json("corpus/units/ntc2018/4.4.8.2.2.json");
    const inlineLatex = stabilityColumn.blocks.flatMap((block: { text?: { inline?: Array<{ kind: string; latex: string }> } }) => block.text?.inline ?? []).filter((segment: { kind: string }) => segment.kind === "math").map((segment: { latex: string }) => segment.latex);
    assert.ok(inlineLatex.includes("\\lambda_{\\mathrm{rel},c}\\le0{,}3"));
    assert.ok(inlineLatex.includes("k_{\\mathrm{crit},c}=1"));
    assert.ok(inlineLatex.includes("\\beta_c=0{,}2"));
    assert.ok(inlineLatex.includes("\\beta_c=0{,}1"));

    const holes = await json("corpus/units/ntc2018/4.5.2.2.1.json");
    const holeLatex = holes.blocks.flatMap((block: { text?: { inline?: Array<{ kind: string; latex: string }> } }) => block.text?.inline ?? []).filter((segment: { kind: string }) => segment.kind === "math").map((segment: { latex: string }) => segment.latex);
    assert.ok(holeLatex.includes("\\varphi=100F/A"));
    assert.ok(holeLatex.includes("\\varphi"));
    assert.ok(!holeLatex.some((latex: string) => latex.includes("\\Pi")));
});

test("NTC pagine 142–151 conserva le cinque tabelle strutturate e nessuna figura", async () => {
    const { tables, figures } = await stepAssets();
    assert.deepEqual(tables.map((table: { officialNumber: string }) => table.officialNumber).sort(), ["4.5.Ia", "4.5.Ib", "4.5.II", "4.5.III", "4.5.IV"].sort());
    assert.equal(figures.length, 0);
    assert.deepEqual(tables.map((table: { columnCount: number }) => table.columnCount), [3, 4, 3, 6, 2]);

    const tableIa = tables.find((table: { officialNumber: string }) => table.officialNumber === "4.5.Ia");
    assert.deepEqual(tableIa.rows.map((row: Array<{ latex: string }>) => row[1]!.latex), ["\\varphi\\le15\\%", "15\\%<\\varphi\\le45\\%", "45\\%<\\varphi\\le55\\%"]);
    assert.deepEqual(tableIa.rows.map((row: Array<{ latex: string }>) => row[2]!.latex), ["f\\le9\\,\\mathrm{cm}^2", "f\\le12\\,\\mathrm{cm}^2", "f\\le15\\,\\mathrm{cm}^2"]);

    const tableIII = tables.find((table: { officialNumber: string }) => table.officialNumber === "4.5.III");
    assert.equal(tableIII.headers[0][1].colSpan, 5);
    const tableIV = tables.find((table: { officialNumber: string }) => table.officialNumber === "4.5.IV");
    assert.equal(tableIV.rows.at(-1)[1].latex, "1/[1+(h/a)^2]");
});
