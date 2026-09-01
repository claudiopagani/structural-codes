import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../", import.meta.url));

// I record canonici contengono forme eterogenee di blocco.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function json(relativePath: string): Promise<any> {
    return JSON.parse(await readFile(join(repoRoot, relativePath), "utf8"));
}

const numbers = [
    "c4.4",
    ...Array.from({ length: 16 }, (_, index) => "c4.4." + String(index + 1)),
    "c4.4.8.1",
    "c4.4.8.2",
    "c4.4.8.1.1",
    "c4.4.8.1.2",
    "c4.4.8.1.4",
    "c4.4.8.1.9",
    "c4.4.16.1",
    "c4.4.16.2",
    "c4.4.16.3",
];

test("Circolare C4.4 contiene le 26 unità nella gerarchia ufficiale", async () => {
    const units = await Promise.all(
        numbers.map((number) => json("corpus/units/circ2019/" + number + ".json")),
    );
    assert.deepEqual(
        units.map((unit) => unit.numbering.official),
        [
            "C4.4", "C4.4.1", "C4.4.2", "C4.4.3", "C4.4.4", "C4.4.5",
            "C4.4.6", "C4.4.7", "C4.4.8", "C4.4.9", "C4.4.10", "C4.4.11",
            "C4.4.12", "C4.4.13", "C4.4.14", "C4.4.15", "C4.4.16",
            "C4.4.8.1", "C4.4.8.2", "C4.4.8.1.1", "C4.4.8.1.2",
            "C4.4.8.1.4", "C4.4.8.1.9", "C4.4.16.1", "C4.4.16.2", "C4.4.16.3",
        ],
    );
    assert.equal(units[0].kind, "section");
    assert.equal(units[0].hierarchy.parentId, "urn:structural-codes:it:unit:circ2019:c4");
    assert.equal(units[7].hierarchy.parentId, units[0].id);
    assert.equal(units[17].hierarchy.parentId, units[8].id);
    assert.equal(units[25].hierarchy.parentId, units[16].id);
});

test("C4.4 conserva la sequenza di prosa, formule, figura e matematica inline", async () => {
    const unit = await json("corpus/units/circ2019/c4.4.7.json");
    const assets = await json("corpus/assets/circ2019/C4.4-step1.json");
    assert.deepEqual(
        unit.blocks
            .filter((block: { kind: string }) => ["formula-ref", "figure-ref"].includes(block.kind))
            .map((block: { kind: string; assetId: string }) => [block.kind, block.assetId]),
        [
            ["formula-ref", "urn:structural-codes:it:asset:formula:circ2019:c4.4.1"],
            ["formula-ref", "urn:structural-codes:it:asset:formula:circ2019:c4.4.2"],
            ["figure-ref", "urn:structural-codes:it:asset:figure:circ2019:c4.4.1"],
            ["formula-ref", "urn:structural-codes:it:asset:formula:circ2019:c4.4.3"],
        ],
    );
    assert.equal(assets.formulas.length, 3);
    assert.equal(assets.figures.length, 1);
    assert.equal(assets.tables.length, 0);
    assert.deepEqual(
        assets.formulas.map((formula: { officialNumber: string; latex: string }) => [formula.officialNumber, formula.latex]),
        [
            ["C4.4.1", "u_{fin}=u_{inst}+u_{dif}"],
            ["C4.4.2", "u_{net}=u_1+u_2-u_0"],
            ["C4.4.3", "u_{tot,fin}=u_{1,inst}(1+k_{def})+u_{21,inst}(1+\\psi_{21}k_{def})+\\sum(i=2\\ldots n)[u_{2i,inst}(\\psi_{0i}+\\psi_{2i}k_{def})]"],
        ],
    );
    assert.deepEqual(unit.blocks[1].text.inline.slice(1, 2), [
        { kind: "math", value: "uinst", latex: "u_{inst}" },
    ]);
});

test("C4.4.15 conserva raw corrotto, ricostruzione visiva e issue bloccante", async () => {
    const unit = await json("corpus/units/circ2019/c4.4.15.json");
    const block = unit.blocks.find(
        (candidate: { text?: { normalized: string } }) =>
            candidate.text?.normalized.includes("d ≤ 6 mm"),
    );
    assert.ok(block);
    assert.match(block.text.raw, /[\u0000-\u001f]/u);
    assert.match(block.text.normalized, /d ≤ 6 mm.*d>6 mm/u);
    assert.ok(
        unit.workflow.openIssues.some(
            (issue: { issueId: string }) => issue.issueId.endsWith("-raw-glyph-corruption"),
        ),
    );
});
