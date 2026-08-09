/* eslint-disable @typescript-eslint/no-explicit-any */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";

const unitDirectory = fileURLToPath(new URL("../corpus/units/ntc2018/", import.meta.url));
const assetDirectory = fileURLToPath(new URL("../corpus/assets/ntc2018/", import.meta.url));
const chapterFile = /^6(?:\.\d+)*\.json$/u;

async function loadChapterUnits(): Promise<any[]> {
    const names = (await readdir(unitDirectory)).filter((name) => chapterFile.test(name));
    return Promise.all(names.map(async (name) => JSON.parse(await readFile(`${unitDirectory}/${name}`, "utf8"))));
}
function sha256(value: string): string { return createHash("sha256").update(value, "utf8").digest("hex"); }
function numberCompare(left: string, right: string): number {
    const a = left.split(".").map(Number); const b = right.split(".").map(Number);
    for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
        const delta = (a[index] ?? -1) - (b[index] ?? -1);
        if (delta !== 0) return delta;
    }
    return 0;
}

test("NTC capitolo 6: unità e gerarchia complete", async () => {
    const units = await loadChapterUnits();
    const numbers = units.map((unit) => unit.numbering.official).sort(numberCompare);
    assert.equal(numbers.length, 95);
    assert.equal(numbers[0], "6");
    assert.equal(numbers.at(-1), "6.12.1");
    const numberSet = new Set(numbers);
    for (const unit of units) {
        const parts = unit.numbering.official.split(".");
        const parent = parts.slice(0, -1).join(".");
        if (parent) assert.equal(numberSet.has(parent), true, unit.id);
        assert.equal(unit.workflow.status, "extracted", unit.id);
        assert.equal(unit.workflow.openIssues.some((issue: any) => issue.severity === "blocking"), true, unit.id);
    }
});

test("NTC capitolo 6: hash, evidence e blocchi sono coerenti", async () => {
    const units = await loadChapterUnits();
    for (const unit of units) {
        const blockIds = new Set<string>();
        for (const block of unit.blocks) {
            assert.equal(blockIds.has(block.blockId), false, `${unit.id}: ${block.blockId}`);
            blockIds.add(block.blockId);
            assert.equal(block.evidence.sourceId, "gu-so8-2018-ntc", unit.id);
            if (block.text) {
                assert.equal(block.evidence.rawSha256, sha256(block.text.raw), `${unit.id}: raw`);
                assert.equal(block.evidence.normalizedSha256, sha256(block.text.normalized), `${unit.id}: normalized`);
            }
        }
    }
});

test("NTC capitolo 6: asset unici, dichiarati e nel punto del flusso", async () => {
    const manifests = await Promise.all(["6-step1.json", "6-step2.json", "6-step3.json"].map(async (name) => JSON.parse(await readFile(`${assetDirectory}/${name}`, "utf8"))));
    const assets = new Map<string, any>();
    for (const manifest of manifests) for (const asset of [...(manifest.formulas ?? []), ...(manifest.tables ?? [])]) assets.set(asset.id, asset);
    const units = await loadChapterUnits();
    const references: string[] = [];
    for (const unit of units) for (const block of unit.blocks) {
        if (!block.assetId) continue;
        references.push(block.assetId);
        const asset = assets.get(block.assetId);
        assert.ok(asset, `${unit.id}: asset mancante`);
        assert.equal(asset.unitId, unit.id, `${unit.id}: proprietario asset`);
        assert.equal(asset.pdfPage, block.evidence.pdfPage, `${unit.id}: pagina asset`);
    }
    assert.equal(new Set(references).size, references.length);
    assert.equal(assets.size, 29);
    assert.equal(manifests.every((manifest) => manifest.status === "transcribed-unreviewed"), true);
});

test("NTC capitolo 6: elenchi, formule e prosecuzioni di pagina sono preservati", async () => {
    const units = await loadChapterUnits();
    const byNumber = new Map(units.map((unit) => [unit.numbering.official, unit]));
    const unit62 = byNumber.get("6.2");
    assert.equal(unit62.blocks.filter((block: any) => block.kind === "list-item").length, 6);
    const unit6522 = byNumber.get("6.5.2.2");
    assert.equal(unit6522.blocks.filter((block: any) => block.kind === "list-item").length, 3);
    const unit662 = byNumber.get("6.6.2");
    assert.deepEqual(unit662.assets.formulaIds.map((id: string) => id.split(":").at(-1)), ["6.6.1", "6.6.2"]);
    const unit6862 = byNumber.get("6.8.6.2");
    assert.deepEqual(unit6862.blocks.slice(-2).map((block: any) => block.evidence.pdfPage), [207, 207]);
    assert.equal(byNumber.get("6.12").blocks.filter((block: any) => block.kind === "list-item").length, 9);
    for (const unit of units) for (const block of unit.blocks) if (block.text) {
        assert.doesNotMatch(block.text.normalized, /\u0119|\u0134|66\.\d|V ERIFICHE|T IP I|terrenostruttura/u, unit.id);
    }
});
