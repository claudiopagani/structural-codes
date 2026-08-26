import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = fileURLToPath(new URL("../", import.meta.url));
const formulaId = (number: string) => `urn:structural-codes:it:asset:formula:ntc2018:${number}`;

const expectedFormulas = new Map<string, string>([
    [formulaId("4.3.33"), "\\frac{b}{t_f}\\le44\\cdot\\sqrt{\\frac{235}{f_y}}\\qquad\\text{per sezioni parzialmente rivestite;}"],
    [formulaId("4.3.34"), "c\\ge\\max\\left\\{40\\,\\mathrm{mm};\\frac{b}{6}\\right\\}\\qquad\\text{per sezioni completamente rivestite;}"],
    [formulaId("4.3.35"), "M_{Ed}\\le\\alpha_M\\cdot M_{pl,Rd}(N_{Ed})"],
    [formulaId("4.3.36"), "k=\\frac{\\beta}{1-\\frac{N_{Ed}}{N_{cr}}}\\ge1{,}0"],
    [formulaId("4.3.37"), "\\beta=0{,}66+0{,}44\\cdot\\frac{M_{min}}{M_{max}}\\ge0{,}44"],
    [formulaId("4.3.38"), "b_m=b_p+2(h_c+h_f)"],
    [formulaId("4.4.1"), "X_d=\\frac{k_{\\mathrm{mod}}X_k}{\\gamma_M}"],
    [formulaId("4.4.2"), "\\sigma_{t,0,d}\\le f_{t,0,d}"],
    [formulaId("4.4.3"), "\\sigma_{c,0,d}\\le f_{c,0,d}"],
    [formulaId("4.4.4"), "\\sigma_{c,90,d}\\le f_{c,90,d}"],
    [formulaId("4.4.5a"), "\\frac{\\sigma_{m,y,d}}{f_{m,y,d}}+k_m\\frac{\\sigma_{m,z,d}}{f_{m,z,d}}\\le1"],
    [formulaId("4.4.5b"), "k_m\\frac{\\sigma_{m,y,d}}{f_{m,y,d}}+\\frac{\\sigma_{m,z,d}}{f_{m,z,d}}\\le1"],
    [formulaId("4.4.6a"), "\\frac{\\sigma_{t,0,d}}{f_{t,0,d}}+\\frac{\\sigma_{m,y,d}}{f_{m,y,d}}+k_m\\frac{\\sigma_{m,z,d}}{f_{m,z,d}}\\le1"],
    [formulaId("4.4.6b"), "\\frac{\\sigma_{t,0,d}}{f_{t,0,d}}+k_m\\frac{\\sigma_{m,y,d}}{f_{m,y,d}}+\\frac{\\sigma_{m,z,d}}{f_{m,z,d}}\\le1"],
    [formulaId("4.4.7a"), "\\left(\\frac{\\sigma_{c,0,d}}{f_{c,0,d}}\\right)^2+\\frac{\\sigma_{m,y,d}}{f_{m,y,d}}+k_m\\frac{\\sigma_{m,z,d}}{f_{m,z,d}}\\le1"],
    [formulaId("4.4.7b"), "\\left(\\frac{\\sigma_{c,0,d}}{f_{c,0,d}}\\right)^2+k_m\\frac{\\sigma_{m,y,d}}{f_{m,y,d}}+\\frac{\\sigma_{m,z,d}}{f_{m,z,d}}\\le1"],
    [formulaId("4.4.8"), "\\tau_d\\le f_{v,d},"],
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
    const inStep = (asset: { pdfPage: number }) => asset.pdfPage >= 132 && asset.pdfPage <= 141;
    return {
        formulas: manifests.flatMap((manifest) => manifest.formulas ?? []).filter(inStep),
        tables: manifests.flatMap((manifest) => manifest.tables ?? []).filter(inStep),
        figures: manifests.flatMap((manifest) => manifest.figures ?? []).filter(inStep),
    };
}

test("NTC pagine 132–141 conserva esattamente le diciassette formule display", async () => {
    const { formulas } = await stepAssets();
    assert.equal(formulas.length, 17);
    assert.deepEqual(new Set(formulas.map((formula: { id: string }) => formula.id)), new Set(expectedFormulas.keys()));
    for (const formula of formulas as Array<{ id: string; latex: string }>) assert.equal(formula.latex, expectedFormulas.get(formula.id), formula.id);
});

test("NTC pagine 132–141 colloca ogni formula una volta e conserva gli inline", async () => {
    const units = await allUnits();
    const refs = units.flatMap((unit) => unit.blocks).filter((block: { kind: string }) => block.kind === "formula-ref").map((block: { assetId: string }) => block.assetId);
    for (const id of expectedFormulas.keys()) assert.equal(refs.filter((candidate: string) => candidate === id).length, 1, id);

    const inStep = (page: number | undefined) => (page ?? 0) >= 132 && (page ?? 0) <= 141;
    const stepUnits = units.filter((unit) => unit.blocks.some((block: { evidence?: { pdfPage?: number } }) => inStep(block.evidence?.pdfPage)));
    assert.equal(stepUnits.length, 43);
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

    const composite = await json("corpus/units/ntc2018/4.3.6.2.json");
    const tau = composite.blocks.find((block: { blockId: string }) => block.blockId.endsWith("block-p-002"));
    assert.equal(tau.text.inline.find((segment: { kind: string }) => segment.kind === "math").latex, "\\tau_{u,Rd}");
    const deformation = await json("corpus/units/ntc2018/4.3.6.3.2.json");
    assert.deepEqual(deformation.blocks[1].text.inline.filter((segment: { kind: string }) => segment.kind === "math").map((segment: { latex: string }) => segment.latex), ["0{,}5\\,\\mathrm{mm}", "1{,}2", "30\\%", "\\tau_{u,Rd}"]);
    const bending = await json("corpus/units/ntc2018/4.4.8.1.6.json");
    assert.deepEqual(bending.blocks.filter((block: { kind: string }) => block.kind === "list-item").flatMap((block: { text: { inline: Array<{ kind: string; latex: string }> } }) => block.text.inline.filter((segment) => segment.kind === "math").map((segment) => segment.latex)), ["k_m=0{,}7", "k_m=1{,}0"]);
});

test("NTC pagine 132–141 conserva le cinque tabelle e la matematica nelle intestazioni", async () => {
    const { tables } = await stepAssets();
    assert.deepEqual(tables.map((table: { officialNumber: string }) => table.officialNumber).sort(), ["4.4.I", "4.4.II", "4.4.III", "4.4.IV", "4.4.V"].sort());
    const partial = tables.find((table: { officialNumber: string }) => table.officialNumber === "4.4.III");
    assert.ok(partial);
    assert.deepEqual(partial.headers[0].slice(1).map((cell: { latex: string }) => cell.latex), ["\\gamma_M", "\\gamma_M"]);
    const kmod = tables.find((table: { officialNumber: string }) => table.officialNumber === "4.4.IV");
    assert.equal(kmod.columnCount, 9);
    assert.equal(kmod.headers[0][3].colSpan, 5);
    const kdef = tables.find((table: { officialNumber: string }) => table.officialNumber === "4.4.V");
    assert.equal(kdef.columnCount, 6);
    assert.equal(kdef.headers[0][2].colSpan, 3);
});

test("NTC pagine 132–141 usa i cinque crop ufficiali con hash verificabile", async () => {
    const { figures } = await stepAssets();
    assert.deepEqual(figures.map((figure: { officialNumber: string }) => figure.officialNumber).sort(), ["4.3.9", "4.3.10", "4.3.11", "4.3.12", "4.4.1"].sort());
    for (const figure of figures as Array<{ imagePath: string; sha256: string }>) {
        const bytes = await readFile(join(root, "corpus/assets", figure.imagePath));
        assert.equal(createHash("sha256").update(bytes).digest("hex"), figure.sha256);
    }
});
