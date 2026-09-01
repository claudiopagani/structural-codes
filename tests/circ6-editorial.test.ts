/* eslint-disable @typescript-eslint/no-explicit-any */
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const unitDir = join(root, "corpus", "units", "circ2019");
const unitFile = /^c6(?:\.\d+)*\.json$/u;

async function loadUnits(): Promise<any[]> {
    const names = (await readdir(unitDir)).filter((name) => unitFile.test(name)).sort();
    return Promise.all(names.map(async (name) => JSON.parse(await readFile(join(unitDir, name), "utf8"))));
}

test("Circolare capitolo 6: unità, gerarchia e stato editoriale", async () => {
    const units = await loadUnits();
    const numbers = units.map((unit) => unit.numbering.official);
    assert.equal(numbers.length, 55);
    assert.equal(numbers.includes("C6"), true);
    assert.equal(numbers.includes("C6.12.2.1"), true);
    const numberSet = new Set(numbers);
    for (const unit of units) {
        const parts = unit.numbering.official.slice(1).split(".");
        const parent = parts.length > 1 ? `C${parts.slice(0, -1).join(".")}` : null;
        if (parent) assert.equal(numberSet.has(parent), true, unit.id);
        assert.equal(unit.workflow.status, "extracted", unit.id);
        assert.equal(unit.workflow.openIssues.some((issue: any) => issue.severity === "blocking"), true, unit.id);
    }
});

test("Circolare capitolo 6: tabella C6.2.I strutturata e collocata", async () => {
    const unit = JSON.parse(await readFile(join(unitDir, "c6.2.2.1.json"), "utf8"));
    const tableBlock = unit.blocks.find((block: any) => block.kind === "table-ref");
    assert.equal(tableBlock.assetId, "urn:structural-codes:it:asset:table:circ2019:c6.2.i");
    assert.deepEqual(unit.assets.tableIds, [tableBlock.assetId]);

    const manifest = JSON.parse(await readFile(join(root, "corpus", "assets", "circ2019", "C6-step1.json"), "utf8"));
    const table = manifest.tables.find((asset: any) => asset.id === tableBlock.assetId);
    assert.ok(table);
    assert.equal(table.pdfPage, 179);
    assert.equal(table.columnCount, 3);
    assert.equal(table.rows.length, 13);
    assert.equal(table.rows[1][0].rowSpan, 3);
    assert.equal(table.rows[5][0].rowSpan, 2);
    assert.equal(table.rows[7][0].rowSpan, 3);
    assert.equal(table.rows[10][0].rowSpan, 3);
    assert.deepEqual(manifest.formulas, []);
    assert.deepEqual(manifest.figures, []);
});

test("Circolare capitolo 6: capoversi, elenchi e matematica inline", async () => {
    const c641 = JSON.parse(await readFile(join(unitDir, "c6.4.1.json"), "utf8"));
    const c642 = JSON.parse(await readFile(join(unitDir, "c6.4.2.json"), "utf8"));
    const c65312 = JSON.parse(await readFile(join(unitDir, "c6.5.3.1.2.json"), "utf8"));
    const c6811 = JSON.parse(await readFile(join(unitDir, "c6.8.1.1.json"), "utf8"));

    assert.equal(c641.blocks.some((block: any) => block.evidence.pdfPage === 187 && block.kind === "list-item"), true);
    assert.equal(c641.blocks.some((block: any) => block.text?.inline?.some((segment: any) => segment.latex === "b\\div 2b")), true);
    assert.equal(c642.blocks[1].kind, "heading");
    assert.match(c642.blocks[1].text.normalized, /Criteri di progetto/u);
    assert.equal(c65312.blocks.some((block: any) => block.text?.inline?.some((segment: any) => segment.latex === "E_d\\le R_d")), true);
    assert.equal(c65312.blocks.some((block: any) => block.text?.inline?.some((segment: any) => segment.latex === "\\gamma_{\\varphi'}")), true);
    assert.equal(c6811.blocks.some((block: any) => block.text?.inline?.some((segment: any) => segment.latex === "15\\,\\mu\\mathrm{m}")), true);
    const c6862 = JSON.parse(await readFile(join(unitDir, "c6.8.6.2.json"), "utf8"));
    assert.equal(c6862.blocks.some((block: any) => block.text?.inline?.some((segment: any) => segment.value === "Rd/Ed" && segment.latex === "Rd/Ed")), true);
    assert.equal(c6862.blocks.some((block: any) => block.text?.inline?.some((segment: any) => /R_d|E_d/u.test(segment.latex ?? ""))), false);
    assert.equal(c641.workflow.openIssues.some((issue: any) => issue.type === "missing-region"), true);
});

test("Circolare capitolo 6: lo step 2 non introduce asset display", async () => {
    const manifest = JSON.parse(await readFile(join(root, "corpus", "assets", "circ2019", "C6-step2.json"), "utf8"));
    assert.deepEqual(manifest.formulas, []);
    assert.deepEqual(manifest.tables, []);
    assert.deepEqual(manifest.figures, []);
});

test("Circolare C6 conserva le combinazioni A/M/R senza pedici inventati", async () => {
    const units = await Promise.all([
        "c6.2.4.1.json", "c6.4.2.1.json", "c6.5.3.1.1.json",
        "c6.5.3.1.2.json", "c6.6.2.json",
    ].map(async (name) => JSON.parse(await readFile(join(unitDir, name), "utf8"))));
    const segments = units.flatMap((unit: any) => unit.blocks)
        .flatMap((block: any) => block.text?.inline ?? [])
        .filter((segment: any) => segment.kind === "math")
        .map((segment: any) => [segment.value, segment.latex]);
    assert.equal(segments.some(([value, latex]: string[]) => value === "A2+M2+R2" && latex === "A2+M2+R2"), true);
    assert.equal(segments.some(([value, latex]: string[]) => value === "A1+M1+R1" && latex === "A1+M1+R1"), true);
    assert.equal(segments.some(([value, latex]: string[]) => value === "A1+M1+R3" && latex === "A1+M1+R3"), true);
    assert.equal(segments.some((segment: string[]) => /A_[12]|M_[12]|R_[12]/u.test(segment[1] ?? "")), false);
});

test("Circolare C6 conserva il punto decimale ufficiale in 0.5b÷b", async () => {
    const unit = JSON.parse(await readFile(join(unitDir, "c6.4.1.json"), "utf8"));
    const segment = unit.blocks.flatMap((block: any) => block.text?.inline ?? [])
        .find((candidate: any) => candidate.value === "0.5b÷b");
    assert.equal(segment?.latex, "0.5b\\div b");
});
