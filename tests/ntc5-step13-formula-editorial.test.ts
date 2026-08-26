import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = fileURLToPath(new URL("../", import.meta.url));
const formulaId = (number: string) => `urn:structural-codes:it:asset:formula:ntc2018:${number}`;

const expectedFormulas = new Map<string, string>([
    [formulaId("5.1.1"), "q_{L,a}=128{,}95\\left(\\frac{1}{L}\\right)^{0{,}25}\\;[\\mathrm{KN/m}]"],
    [formulaId("5.1.2"), "q_{L,b}=88{,}71\\left(\\frac{1}{L}\\right)^{0{,}38}\\;[\\mathrm{KN/m}]"],
    [formulaId("5.1.3"), "q_{L,c}=77{,}12\\left(\\frac{1}{L}\\right)^{0{,}38}\\;[\\mathrm{KN/m}]"],
    [formulaId("5.1.4"), "180\\,\\mathrm{kN}\\le q_3=0{,}6(2Q_{1k})+0{,}10q_{1k}\\cdot w_1\\cdot L\\le900\\,\\mathrm{kN}"],
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
    const inStep = (asset: { pdfPage: number }) => asset.pdfPage >= 152 && asset.pdfPage <= 161;
    return {
        formulas: manifests.flatMap((manifest) => manifest.formulas ?? []).filter(inStep),
        tables: manifests.flatMap((manifest) => manifest.tables ?? []).filter(inStep),
        figures: manifests.flatMap((manifest) => manifest.figures ?? []).filter(inStep),
    };
}

test("NTC pagine 152–161 conserva esattamente le quattro formule display", async () => {
    const { formulas } = await stepAssets();
    assert.equal(formulas.length, 4);
    assert.deepEqual(new Set(formulas.map((formula: { id: string }) => formula.id)), new Set(expectedFormulas.keys()));
    for (const formula of formulas as Array<{ id: string; latex: string }>) assert.equal(formula.latex, expectedFormulas.get(formula.id), formula.id);
});

test("NTC pagine 152–161 colloca ogni formula una volta e conserva gli inline completi", async () => {
    const units = await allUnits();
    const refs = units.flatMap((unit) => unit.blocks).filter((block: { kind: string }) => block.kind === "formula-ref").map((block: { assetId: string }) => block.assetId);
    for (const id of expectedFormulas.keys()) assert.equal(refs.filter((candidate: string) => candidate === id).length, 1, id);

    const inStep = (page: number | undefined) => (page ?? 0) >= 152 && (page ?? 0) <= 161;
    const stepUnits = units.filter((unit) => unit.blocks.some((block: { evidence?: { pdfPage?: number } }) => inStep(block.evidence?.pdfPage)));
    assert.equal(stepUnits.length, 29);
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

    const loadModels = await json("corpus/units/ntc2018/5.1.3.3.3.json");
    const definition = loadModels.blocks.find((block: { text?: { normalized?: string } }) => block.text?.normalized === "essendo L la lunghezza della zona caricata in m.");
    assert.deepEqual(definition.text.inline.filter((segment: { kind: string }) => segment.kind === "math").map((segment: { latex: string }) => segment.latex), ["L", "\\mathrm{m}"]);

    const braking = await json("corpus/units/ntc2018/5.1.3.5.json");
    const width = braking.blocks.find((block: { text?: { normalized?: string } }) => block.text?.normalized?.startsWith("essendo w1"));
    assert.deepEqual(width.text.inline.filter((segment: { kind: string }) => segment.kind === "math").map((segment: { latex: string }) => segment.latex), ["w_1", "L"]);

    const centrifugal = await json("corpus/units/ntc2018/5.1.3.6.json");
    const relation = centrifugal.blocks.find((block: { text?: { normalized?: string } }) => block.text?.normalized?.includes("Qv = Σi 2Qik"));
    assert.equal(relation.text.inline.find((segment: { value: string }) => segment.value === "Qv = Σi 2Qik").latex, "Q_v=\\sum_i2Q_{ik}");

    const wind = await json("corpus/units/ntc2018/5.1.3.7.json");
    assert.ok(!wind.blocks.flatMap((block: { text?: { inline?: Array<{ kind: string; value: string }> } }) => block.text?.inline ?? []).some((segment: { kind: string; value: string }) => segment.kind === "math" && segment.value === "L"));
});

test("NTC pagine 152–161 conserva le sei tabelle e la loro matematica", async () => {
    const { tables } = await stepAssets();
    assert.deepEqual(tables.map((table: { officialNumber: string }) => table.officialNumber).sort(), ["5.1.I", "5.1.II", "5.1.III", "5.1.IV", "5.1.V", "5.1.VI"].sort());

    const lanes = tables.find((table: { officialNumber: string }) => table.officialNumber === "5.1.I");
    assert.deepEqual(lanes.rows.map((row: Array<{ latex: string }>) => row.map((cell) => cell.latex)), [
        ["w<5{,}40\\,\\mathrm{m}", "n_l=1", "3{,}00", "(w-3{,}00)"],
        ["5{,}4\\le w<6{,}0\\,\\mathrm{m}", "n_l=2", "w/2", "0"],
        ["6{,}0\\,\\mathrm{m}\\le w", "n_l=\\operatorname{Int}(w/3)", "3{,}00", "w-(3{,}00\\times n_l)"],
    ]);

    const loads = tables.find((table: { officialNumber: string }) => table.officialNumber === "5.1.II");
    assert.deepEqual(loads.headers[0].slice(1).map((cell: { latex: string }) => cell.latex), ["\\text{Carico asse }Q_{ik}\\;[\\mathrm{kN}]", "q_{ik}\\;[\\mathrm{kN/m^2}]"]);

    const centrifugal = tables.find((table: { officialNumber: string }) => table.officialNumber === "5.1.III");
    assert.deepEqual(centrifugal.rows.map((row: Array<{ latex: string }>) => row.map((cell) => cell.latex)), [["R<200", "0{,}2Q_v"], ["200\\le R\\le1500", "40Q_v/R"], ["1500\\le R", "0"]]);

    const partial = tables.find((table: { officialNumber: string }) => table.officialNumber === "5.1.V");
    assert.equal(partial.headers[0][3].latex, "\\mathrm{EQU}^{(1)}");
    assert.equal(partial.rows[0][2].latex, "\\gamma_{G1}\\text{ e }\\gamma_{G3}");
    assert.equal(partial.rows[8][2].latex, "\\gamma_{\\varepsilon1}");

    const combinations = tables.find((table: { officialNumber: string }) => table.officialNumber === "5.1.VI");
    assert.deepEqual(combinations.headers[0].slice(2).map((cell: { latex: string }) => cell.latex), ["\\text{Coefficiente }\\psi_0\\text{ di combinazione}", "\\text{Coefficiente }\\psi_1\\text{ (valori frequenti)}", "\\text{Coefficiente }\\psi_2\\text{ (valori quasi permanenti)}"]);
});

test("NTC pagine 152–161 usa i quattro crop ufficiali con hash verificabile", async () => {
    const { figures } = await stepAssets();
    assert.deepEqual(figures.map((figure: { officialNumber: string }) => figure.officialNumber).sort(), ["5.1.1", "5.1.2", "5.1.3.a", "5.1.3.b"].sort());
    for (const figure of figures as Array<{ imagePath: string; sha256: string }>) {
        const bytes = await readFile(join(root, "corpus/assets", figure.imagePath));
        assert.equal(createHash("sha256").update(bytes).digest("hex"), figure.sha256);
    }
});
