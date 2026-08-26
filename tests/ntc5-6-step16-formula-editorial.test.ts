import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = fileURLToPath(new URL("../", import.meta.url));
const formulaId = (suffix: string) => `urn:structural-codes:it:asset:formula:ntc2018:${suffix}`;

const expectedFormulas = new Map<string, string>([
    [formulaId("5.2.11"), "R=\\frac{L^2}{8\\,\\delta_h}"],
    [formulaId("6.2.4.1:equ"), "E_{inst,d}\\le E_{stb,d}"],
    [formulaId("6.2.1"), "E_d\\le R_d"],
    [formulaId("6.2.2a"), "E_d=E\\left[\\gamma_F F_k;\\frac{X_k}{\\gamma_M};a_d\\right]"],
    [formulaId("6.2.2b"), "E_d=\\gamma_E\\cdot E\\left[F_k;\\frac{X_k}{\\gamma_M};a_d\\right]"],
    [formulaId("6.2.3"), "R_d=\\frac{1}{\\gamma_R}R\\left[\\gamma_F F_k;\\frac{X_k}{\\gamma_M};a_d\\right]"],
    [formulaId("6.2.4"), "V_{inst,d}\\le G_{stb,d}+R_d"],
    [formulaId("6.2.5"), "V_{inst,d}=G_{inst,d}+Q_{inst,d}"],
    [formulaId("6.2.7"), "E_d\\le C_d"],
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
    const inStep = (asset: { pdfPage: number }) => asset.pdfPage >= 182 && asset.pdfPage <= 191;
    return {
        formulas: manifests.flatMap((manifest) => manifest.formulas ?? []).filter(inStep),
        tables: manifests.flatMap((manifest) => manifest.tables ?? []).filter(inStep),
        figures: manifests.flatMap((manifest) => manifest.figures ?? []).filter(inStep),
    };
}

test("NTC pagine 182–191 conserva nove gruppi display e il prodotto di [6.2.2b]", async () => {
    const { formulas } = await stepAssets();
    assert.equal(formulas.length, 9);
    assert.deepEqual(new Set(formulas.map((formula: { id: string }) => formula.id)), new Set(expectedFormulas.keys()));
    for (const formula of formulas as Array<{ id: string; latex: string }>) {
        assert.equal(formula.latex, expectedFormulas.get(formula.id), formula.id);
    }

    const numbered = formulas.filter((formula: { officialNumber: string | null }) => formula.officialNumber !== null);
    assert.equal(numbered.length, 8);
    assert.ok(numbered.some((formula: { officialNumber: string }) => formula.officialNumber === "6.2.5"));
    assert.ok(!numbered.some((formula: { officialNumber: string }) => formula.officialNumber === "6.2.6"));
    assert.ok(numbered.some((formula: { officialNumber: string }) => formula.officialNumber === "6.2.7"));
});

test("NTC pagine 182–191 colloca formule, tabelle e figura nell’ordine visivo ufficiale", async () => {
    const units = await allUnits();
    const refs = units.flatMap((unit) => unit.blocks).filter((block: { kind: string }) => block.kind === "formula-ref").map((block: { assetId: string }) => block.assetId);
    for (const id of expectedFormulas.keys()) assert.equal(refs.filter((candidate: string) => candidate === id).length, 1, id);

    const suffixes = (number: string) => {
        const unit = units.find((candidate) => candidate.numbering.official === number);
        return unit.blocks.filter((block: { kind: string }) => block.kind.endsWith("-ref")).map((block: { assetId: string }) => block.assetId.split(":").at(-1));
    };
    assert.deepEqual(suffixes("5.2.3.1.3"), ["5.2.iv"]);
    assert.deepEqual(suffixes("5.2.3.2.1"), ["5.2.v", "5.2.vi"]);
    assert.deepEqual(suffixes("5.2.3.2.2"), ["5.2.vii"]);
    assert.deepEqual(suffixes("5.2.3.2.2.1"), ["5.2.14", "5.2.viii", "5.2.11"]);
    assert.deepEqual(suffixes("6.2.4.2"), ["6.2.4", "6.2.5", "6.2.iii"]);

    const inStep = (page: number | undefined) => (page ?? 0) >= 182 && (page ?? 0) <= 191;
    const stepUnits = units.filter((unit) => unit.blocks.some((block: { evidence?: { pdfPage?: number } }) => inStep(block.evidence?.pdfPage)));
    assert.equal(stepUnits.length, 25);
});

test("NTC pagine 182–191 segmenta gli inline completi senza falsi positivi", async () => {
    const units = await allUnits();
    const inStep = (page: number | undefined) => (page ?? 0) >= 182 && (page ?? 0) <= 191;
    const stepUnits = units.filter((unit) => unit.blocks.some((block: { evidence?: { pdfPage?: number } }) => inStep(block.evidence?.pdfPage)));

    for (const unit of stepUnits) {
        for (const block of unit.blocks) {
            if (!block.text?.inline || !inStep(block.evidence?.pdfPage)) continue;
            assert.equal(block.text.inline.map((segment: { value: string }) => segment.value).join(""), block.text.normalized, block.blockId);
            for (const segment of block.text.inline) {
                if (segment.kind !== "math") continue;
                assert.ok(!/\d,(?=\d)/u.test(segment.latex), `${block.blockId}: virgola decimale non protetta`);
                assert.doesNotMatch(segment.value, /(?:adottat|adeguat|grado)/u, `${block.blockId}: falso positivo della variabile a_d`);
                assert.notEqual(segment.value, "V", `${block.blockId}: falso positivo nei numeri romani delle tabelle`);
            }
        }
    }

    const rail = await json("corpus/units/ntc2018/5.2.3.2.2.1.json");
    const railMath = rail.blocks.flatMap((block: { text?: { inline?: Array<{ kind: string; value: string; latex: string }> } }) => block.text?.inline ?? []).filter((segment: { kind: string }) => segment.kind === "math");
    assert.ok(railMath.some((segment: { value: string; latex: string }) => segment.value === "120 < V ≤ 200 km/h" && segment.latex === "120<V\\le 200\\ \\mathrm{km/h}"));
    assert.ok(railMath.some((segment: { value: string; latex: string }) => segment.value === "t ≤ 3,0 mm/3m" && segment.latex === "t\\le 3{,}0\\ \\mathrm{mm}/3\\mathrm{m}"));

    const resistance = await json("corpus/units/ntc2018/6.2.4.1.2.json");
    const rock = resistance.blocks.find((block: { text?: { normalized?: string } }) => block.text?.normalized?.startsWith("Per gli ammassi rocciosi"));
    assert.ok(rock);
    assert.deepEqual(rock.text.inline.filter((segment: { kind: string }) => segment.kind === "math").map((segment: { latex: string }) => segment.latex), ["\\tau_R", "\\gamma_{\\tau_R}=1{,}0", "\\gamma_{\\tau_R}=1{,}25"]);
});

test("NTC pagine 182–191 conserva otto tabelle matematiche e il crop ufficiale", async () => {
    const { tables, figures } = await stepAssets();
    assert.deepEqual(tables.map((table: { officialNumber: string }) => table.officialNumber).sort(), ["5.2.IV", "5.2.V", "5.2.VI", "5.2.VII", "5.2.VIII", "6.2.I", "6.2.II", "6.2.III"].sort());

    const coefficients = tables.find((table: { officialNumber: string }) => table.officialNumber === "5.2.V");
    assert.equal(coefficients.rows[8][2].latex, "\\gamma_{Qi}");
    const combinations = tables.find((table: { officialNumber: string }) => table.officialNumber === "5.2.VI");
    assert.equal(combinations.headers[0][1].latex, "\\Psi_0");
    assert.equal(combinations.rows[6][0].latex, "\\text{Azioni del vento }F_{Wk}");
    const curvature = tables.find((table: { officialNumber: string }) => table.officialNumber === "5.2.VIII");
    assert.equal(curvature.rows[1][0].latex, "120<V\\le200");
    const soil = tables.find((table: { officialNumber: string }) => table.officialNumber === "6.2.II");
    assert.equal(soil.rows[0][1].latex, "\\tan\\varphi'_k");

    assert.equal(figures.length, 1);
    assert.equal(figures[0].officialNumber, "5.2.14");
    const bytes = await readFile(join(root, "corpus/assets", figures[0].imagePath));
    assert.equal(createHash("sha256").update(bytes).digest("hex"), figures[0].sha256);
});
