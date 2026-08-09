import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../", import.meta.url));
const unitDir = join(repoRoot, "corpus", "units", "ntc2018");

// Canonical JSON records intentionally contain heterogeneous block shapes.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function json(relativePath: string): Promise<any> {
    return JSON.parse(await readFile(join(repoRoot, relativePath), "utf8"));
}

test("NTC 11 contiene tutte le 193 unità dell'intervallo PDF 309–369", async () => {
    const names = (await readdir(unitDir)).filter((name) => name.startsWith("11") && name.endsWith(".json"));
    assert.equal(names.length, 193);
    const units = await Promise.all(names.map((name) => readFile(join(unitDir, name), "utf8").then(JSON.parse)));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pages = units.flatMap((unit) => unit.blocks.map((block: any) => block.evidence.pdfPage));
    assert.equal(Math.min(...pages), 309);
    assert.equal(Math.max(...pages), 369);
    assert.equal(units.find((unit) => unit.numbering.official === "11").kind, "chapter");
    assert.equal(units.find((unit) => unit.numbering.official === "11.3.2.12").title, "CONTROLLI DI ACCETTAZIONE IN CANTIERE");
    assert.equal(units.find((unit) => unit.numbering.official === "11.3.3.5.2.3").title, "Determinazione delle proprietà e tolleranze");
    for (const unit of units) assert.doesNotMatch(unit.title, /\b[B-DF-HJ-NP-TV-Z] (?=[A-Z])/u);
});

test("NTC 11 mantiene asset unici e testi normalizzati senza caratteri di controllo", async () => {
    const names = (await readdir(unitDir)).filter((name) => name.startsWith("11") && name.endsWith(".json"));
    const units = await Promise.all(names.map((name) => readFile(join(unitDir, name), "utf8").then(JSON.parse)));
    const assetIds = units.flatMap((unit) => [
        ...unit.assets.formulaIds,
        ...unit.assets.tableIds,
        ...unit.assets.figureIds,
    ]);
    assert.equal(new Set(assetIds).size, assetIds.length);
    for (const unit of units) {
        for (const block of unit.blocks) {
            if (block.text?.normalized) assert.doesNotMatch(block.text.normalized, /[\u0000-\u001F\u007F]/u);
        }
    }
    const step1 = await json("corpus/assets/ntc2018/11-step1.json");
    const step2 = await json("corpus/assets/ntc2018/11-step2.json");
    const manifestIds = [
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...step1.formulas.map((asset: any) => asset.id),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...step1.tables.map((asset: any) => asset.id),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...step2.formulas.map((asset: any) => asset.id),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...step2.tables.map((asset: any) => asset.id),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...step2.figures.map((asset: any) => asset.id),
    ];
    assert.equal(step2.formulas.length, 30);
    assert.equal(step2.tables.length, 36);
    assert.equal(step2.figures.length, 2);
    assert.deepEqual(new Set(manifestIds), new Set(assetIds));
});
