import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const unitDirectory = fileURLToPath(new URL("../corpus/units/circ2019/", import.meta.url));
const readUnit = async (number: string) => JSON.parse(await readFile(join(unitDirectory, `${number.toLowerCase()}.json`), "utf8"));

test("Circ C7 rasterizzato conserva intestazioni verificate e issue bloccanti", async () => {
    const numbers = ["C7", "C7.1", "C7.2", "C7.2.1", "C7.2.2", "C7.2.3", "C7.2.6", "C7.3", "C7.3.1", "C7.3.3", "C7.3.3.1", "C7.3.3.2", "C7.3.4", "C7.3.4.1", "C7.3.4.2", "C7.3.5", "C7.3.6"];
    const units = await Promise.all(numbers.map(readUnit));
    assert.equal(units.length, 17);
    for (const unit of units) {
        assert.equal(unit.workflow.status, "extracted", unit.id);
        assert.equal(unit.workflow.openIssues.some((issue: { type: string; severity: string }) => issue.type === "ambiguous-source" && issue.severity === "blocking"), true, unit.id);
    }
    const c723 = units.find((unit) => unit.numbering.official === "C7.2.3");
    assert.ok(c723);
    assert.equal(c723.blocks.filter((block: { kind: string }) => block.kind === "heading").length, 6);
    assert.deepEqual(c723.assets, { formulaIds: [], tableIds: [], figureIds: [] });
});

test("Circ C8 esplicita la radice e la continuazione tabellare p.299", async () => {
    const root = await readUnit("C8");
    assert.equal(root.blocks[0].evidence.pdfPage, 253);
    const c8763 = await readUnit("C8.7.6.3");
    assert.equal(c8763.workflow.openIssues.some((issue: { issueId: string; note: string }) => issue.issueId === "circ2019-c8-7-6-3-page-299" && issue.note.includes("PDF 299")), true);
});
