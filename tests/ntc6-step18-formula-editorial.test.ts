/* eslint-disable @typescript-eslint/no-explicit-any */
import assert from "node:assert/strict";
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
        json("corpus/assets/ntc2018/6-step2.json"),
        json("corpus/assets/ntc2018/6-step3.json"),
    ]);
    const inStep = (asset: { pdfPage: number }) => asset.pdfPage >= 202 && asset.pdfPage <= 211;
    return {
        formulas: manifests.flatMap((manifest) => manifest.formulas ?? []).filter(inStep),
        tables: manifests.flatMap((manifest) => manifest.tables ?? []).filter(inStep),
        figures: manifests.flatMap((manifest) => manifest.figures ?? []).filter(inStep),
    };
}

const expectedFormulas = new Map<string, string>([
    [formulaId("6.6.1"), "R_{ak}=\\operatorname{Min}\\left\\{\\frac{(R_{a,m})_{\\mathrm{medio}}}{\\xi_{a1}};\\frac{(R_{a,m})_{\\mathrm{min}}}{\\xi_{a2}}\\right\\}"],
    [formulaId("6.6.2"), "R_{ak}=\\operatorname{Min}\\left\\{\\frac{(R_{a,c})_{\\mathrm{medio}}}{\\xi_{a3}};\\frac{(R_{a,c})_{\\mathrm{min}}}{\\xi_{a4}}\\right\\}"],
]);

test("NTC pagine 202–211 conserva le due formule Min degli ancoraggi", async () => {
    const { formulas } = await stepAssets();
    assert.equal(formulas.length, 2);
    assert.deepEqual(new Set(formulas.map((formula: { id: string }) => formula.id)), new Set(expectedFormulas.keys()));
    for (const formula of formulas as Array<{ id: string; latex: string }>) {
        assert.equal(formula.latex, expectedFormulas.get(formula.id), formula.id);
        assert.doesNotMatch(formula.latex, /\\mathrm\{Min\}|\\min(?:\b|_)/u, formula.id);
    }
});

test("NTC pagine 202–211 segmenta quantità e combinazioni senza acronimi discorsivi", async () => {
    const units = await allUnits();
    const inStep = (page: number | undefined) => (page ?? 0) >= 202 && (page ?? 0) <= 211;
    const stepUnits = units.filter((unit) => unit.blocks.some((block: any) => inStep(block.evidence?.pdfPage)));
    assert.equal(stepUnits.length, 43);

    for (const unit of stepUnits) for (const block of unit.blocks) {
        if (!block.text?.inline || !inStep(block.evidence?.pdfPage)) continue;
        assert.equal(block.text.inline.map((segment: { value: string }) => segment.value).join(""), block.text.normalized, block.blockId);
        const mathValues = block.text.inline.filter((segment: { kind: string }) => segment.kind === "math").map((segment: { value: string }) => segment.value);
        for (const acronym of ["GEO", "STR", "UPL", "HYD"]) assert.ok(!mathValues.includes(acronym), `${block.blockId}: ${acronym} è un acronimo discorsivo`);
    }

    const math = async (number: string) => {
        const unit = await json(`corpus/units/ntc2018/${number}.json`);
        return unit.blocks.flatMap((block: any) => block.text?.inline ?? []).filter((segment: any) => segment.kind === "math");
    };
    assert.ok((await math("6.6.2")).some((segment: any) => segment.value === "A1+M1+R3" && segment.latex === "\\mathrm{A1+M1+R3}"));
    assert.ok((await math("6.6.2")).some((segment: any) => segment.value === "γR" && segment.latex === "\\gamma_R"));
    assert.ok((await math("6.7.5")).some((segment: any) => segment.value === "A1+M1+R1" && segment.latex === "\\mathrm{A1+M1+R1}"));
    assert.ok((await math("6.7.5")).some((segment: any) => segment.value === "A2+M2+R2" && segment.latex === "\\mathrm{A2+M2+R2}"));
    assert.ok((await math("6.7.5")).some((segment: any) => segment.value === "R2" && segment.latex === "\\mathrm{R2}"));
    assert.ok((await math("6.8.2")).some((segment: any) => segment.value === "A2+M2+R2" && segment.latex === "\\mathrm{A2+M2+R2}"));
});

test("NTC pagine 202–211 conserva quattro tabelle matematiche verificate", async () => {
    const { tables, figures } = await stepAssets();
    assert.equal(figures.length, 0);
    assert.deepEqual(tables.map((table: any) => table.officialNumber), ["6.6.I", "6.6.II", "6.6.III", "6.8.I"]);

    const byNumber = new Map(tables.map((table: any) => [table.officialNumber, table]));
    assert.deepEqual(byNumber.get("6.6.I").rows.map((row: any[]) => row[1].latex), ["\\gamma_R", "\\gamma_R"]);
    assert.equal(byNumber.get("6.6.II").headers[0][3].latex, ">2");
    assert.deepEqual(byNumber.get("6.6.II").rows.map((row: any[]) => row[0].latex), ["\\xi_{a1}", "\\xi_{a2}"]);
    assert.equal(byNumber.get("6.6.III").headers[0][5].latex, "\\ge5");
    assert.deepEqual(byNumber.get("6.6.III").rows.map((row: any[]) => row[0].latex), ["\\xi_{a3}", "\\xi_{a4}"]);
    assert.equal(byNumber.get("6.8.I").headers[0][1].latex, "\\mathrm{R2}");
    assert.equal(byNumber.get("6.8.I").rows[0][0].latex, "\\gamma_R");
});

test("NTC pagine 202–211 colloca formule e tabelle una sola volta nel flusso", async () => {
    const units = await allUnits();
    const references = units.flatMap((unit) => unit.blocks).filter((block: any) => block.assetId).map((block: any) => block.assetId);
    for (const id of expectedFormulas.keys()) assert.equal(references.filter((candidate: string) => candidate === id).length, 1, id);

    const refs = (number: string) => units.find((unit) => unit.numbering.official === number).blocks
        .filter((block: any) => block.kind.endsWith("-ref"))
        .map((block: any) => block.assetId.split(":").at(-1));
    assert.deepEqual(refs("6.6.2"), ["6.6.i", "6.6.1", "6.6.2", "6.6.ii", "6.6.iii"]);
    assert.deepEqual(refs("6.8.2"), ["6.8.i"]);
});
