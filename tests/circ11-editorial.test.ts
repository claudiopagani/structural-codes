/* eslint-disable @typescript-eslint/no-explicit-any */
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../", import.meta.url));
const unitDir = join(repoRoot, "corpus", "units", "circ2019");

async function json(relativePath: string): Promise<any> {
    return JSON.parse(await readFile(join(repoRoot, relativePath), "utf8"));
}

async function c11Units(): Promise<any[]> {
    const names = (await readdir(unitDir)).filter((name) => name.startsWith("c11") && name.endsWith(".json"));
    return Promise.all(names.map((name) => readFile(join(unitDir, name), "utf8").then(JSON.parse)));
}

test("Circolare C11 contiene le 91 unità del perimetro PDF 314–341", async () => {
    const units = await c11Units();
    assert.equal(units.length, 91);
    const pages = units.flatMap((unit) => unit.blocks.map((block: any) => block.evidence.pdfPage));
    assert.equal(Math.min(...pages), 314);
    assert.equal(Math.max(...pages), 341);
    assert.equal(units.find((unit) => unit.numbering.official === "C11").kind, "chapter");
    assert.equal(units.find((unit) => unit.numbering.official === "C11.9.4").title, "DISPOSITIVI A COMPORTAMENTO LINEARE");
    assert.equal(units.find((unit) => unit.numbering.official === "C11.10.1.1.1.2").title, "Resistenza caratteristica a compressione degli elementi nella direzione ortogonale a quella dei carichi verticali e nel piano della muratura");
    assert.equal(units.some((unit) => unit.numbering.official === "C11.2.9"), false);
    for (const unit of units) {
        for (const block of unit.blocks) {
            if (block.text?.normalized) assert.doesNotMatch(block.text.normalized, /[\u0000-\u001F\u007F]/u);
        }
    }
});

test("Circolare C11 mantiene asset unici e riferimenti nella posizione editoriale", async () => {
    const units = await c11Units();
    const assetIds = units.flatMap((unit) => [
        ...unit.assets.formulaIds,
        ...unit.assets.tableIds,
        ...unit.assets.figureIds,
    ]);
    assert.equal(new Set(assetIds).size, assetIds.length);
    const step1 = await json("corpus/assets/circ2019/C11-step1.json");
    const step2 = await json("corpus/assets/circ2019/C11-step2.json");
    assert.equal(step1.formulas.length, 0);
    assert.equal(step2.formulas.length, 20);
    assert.equal(step2.tables.length, 2);
    assert.equal(step2.figures.length, 2);
    assert.equal(step2.tables[1].unitId, "urn:structural-codes:it:unit:circ2019:c11.3.4.11.2.1");
    assert.equal(units.find((unit) => unit.numbering.official === "C11.2.6").blocks.some((block: any) => block.kind === "table-ref"), true);
    assert.equal(units.find((unit) => unit.numbering.official === "C11.3.2.10.4").blocks.filter((block: any) => block.kind === "figure-ref").length, 2);
    assert.deepEqual(new Set(step2.formulas.concat(step2.tables, step2.figures).map((asset: any) => asset.id)), new Set(assetIds));
});
