import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const unitDirectory = fileURLToPath(new URL("../corpus/units/circ2019/", import.meta.url));
const readUnit = async (number: string) => JSON.parse(await readFile(join(unitDirectory, `${number.toLowerCase()}.json`), "utf8"));

test("Circ C7 rasterizzato conserva il testo trascritto e gli asset verificati", async () => {
    const numbers = ["C7", "C7.1", "C7.2", "C7.2.1", "C7.2.2", "C7.2.3", "C7.2.6", "C7.3", "C7.3.1", "C7.3.3", "C7.3.3.1", "C7.3.3.2", "C7.3.4", "C7.3.4.1", "C7.3.4.2", "C7.3.5", "C7.3.6", "C7.3.6.1", "C7.3.6.2"];
    const units = await Promise.all(numbers.map(readUnit));
    assert.equal(units.length, 19);
    for (const unit of units) {
        assert.equal(unit.workflow.status, "extracted", unit.id);
        assert.equal(unit.workflow.openIssues.some((issue: { type: string; severity: string }) => issue.type === "missing-region" && issue.severity === "blocking"), true, unit.id);
    }
    const c723 = units.find((unit) => unit.numbering.official === "C7.2.3");
    assert.ok(c723);
    assert.equal(c723.blocks.filter((block: { kind: string }) => block.kind === "formula-ref").length, 11);
    assert.deepEqual(c723.assets, {
        formulaIds: [
            "urn:structural-codes:it:asset:formula:circ2019:c7.2.1",
            "urn:structural-codes:it:asset:formula:circ2019:c7.2.2",
            "urn:structural-codes:it:asset:formula:circ2019:c7.2.3",
            "urn:structural-codes:it:asset:formula:circ2019:c7.2.4",
            "urn:structural-codes:it:asset:formula:circ2019:c7.2.5",
            "urn:structural-codes:it:asset:formula:circ2019:c7.2.6",
            "urn:structural-codes:it:asset:formula:circ2019:c7.2.7",
            "urn:structural-codes:it:asset:formula:circ2019:c7.2.8",
            "urn:structural-codes:it:asset:formula:circ2019:c7.2.9",
            "urn:structural-codes:it:asset:formula:circ2019:c7.2.10",
            "urn:structural-codes:it:asset:formula:circ2019:c7.2.11",
        ],
        tableIds: [
            "urn:structural-codes:it:asset:table:circ2019:c7.2.i",
            "urn:structural-codes:it:asset:table:circ2019:c7.2.ii",
        ],
        figureIds: [
            "urn:structural-codes:it:asset:figure:circ2019:c7.2.3",
            "urn:structural-codes:it:asset:figure:circ2019:c7.2.4",
        ],
    });
    const c7361 = units.find((unit) => unit.numbering.official === "C7.3.6.1");
    const c7362 = units.find((unit) => unit.numbering.official === "C7.3.6.2");
    assert.ok(c7361 && c7361.blocks.length > 1);
    assert.ok(c7362 && c7362.blocks.length > 1);
});

test("Circ C8 esplicita la radice e la continuazione tabellare p.299", async () => {
    const root = await readUnit("C8");
    assert.equal(root.blocks[0].evidence.pdfPage, 253);
    const c8763 = await readUnit("C8.7.6.3");
    assert.equal(c8763.workflow.openIssues.some((issue: { issueId: string; note: string }) => issue.issueId === "circ2019-c8-7-6-3-page-299" && issue.note.includes("PDF 299")), true);
});
