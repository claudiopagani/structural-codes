import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../", import.meta.url));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function json(relativePath: string): Promise<any> {
    return JSON.parse(await readFile(join(repoRoot, relativePath), "utf8"));
}

test("Circolare C4.3 conserva le unità effettivamente presenti nello step", async () => {
    const numbers = [
        "c4.3", "c4.3.1", "c4.3.2", "c4.3.2.1", "c4.3.4", "c4.3.4.2",
        "c4.3.4.3", "c4.3.4.3.1", "c4.3.4.3.1.1", "c4.3.4.3.1.2",
        "c4.3.4.3.3", "c4.3.4.3.5", "c4.3.4.3.6", "c4.3.6", "c4.3.6.2",
    ];
    const units = await Promise.all(
        numbers.map((number) => json(`corpus/units/circ2019/${number}.json`)),
    );
    assert.deepEqual(units.map((unit) => unit.numbering.official), numbers.map((number) => number.toUpperCase()));
    assert.equal(units[0].kind, "section");
    assert.equal(units[0].hierarchy.parentId, "urn:structural-codes:it:unit:circ2019:c4");
    assert.equal(units[1].hierarchy.parentId, units[0].id);
    assert.ok(units[1].blocks[0].text.raw.includes("\u0002"));
});

test("C4.3 mantiene ordine asset, formule numerate e matematica inline", async () => {
    const unit = await json("corpus/units/circ2019/c4.3.4.3.3.json");
    const assets = await json("corpus/assets/circ2019/C4.3-step1.json");
    assert.deepEqual(
        unit.blocks.filter((block: { kind: string }) => block.kind === "formula-ref").map((block: { assetId: string }) => block.assetId),
        [
            "urn:structural-codes:it:asset:formula:circ2019:4.3.3",
            "urn:structural-codes:it:asset:formula:circ2019:4.3.4",
            "urn:structural-codes:it:asset:formula:circ2019:4.3.5",
            "urn:structural-codes:it:asset:formula:circ2019:4.3.6",
        ],
    );
    assert.equal(assets.formulas.length, 13);
    assert.equal(assets.tables.length, 2);
    assert.equal(assets.figures.length, 9);
    assert.equal(assets.formulas[1].latex, "\\frac{F_l^2}{P_{l,Rd}^2}+\\frac{F_t^2}{P_{t,Rd}^2}\\le1,0");
    const byNumber = new Map<string, string>(assets.formulas.map(
        (formula: { officialNumber: string; latex: string }) =>
            [formula.officialNumber, formula.latex] as [string, string],
    ));
    assert.match(byNumber.get("C4.3.1") ?? "", /\\cdot\\eta/u);
    assert.match(byNumber.get("C4.3.5") ?? "", /\\eta\\times F_\{cf\}/u);
    assert.match(byNumber.get("C4.3.7") ?? "", /\\Delta x\\cdot h_f/u);
    assert.match(byNumber.get("C4.3.10") ?? "", /\\chi_\{LT\}\\cdot M_\{Rd\}/u);
    assert.match(byNumber.get("C4.3.13") ?? "", /E_a\\cdot t_w\^3/u);
    const inline = unit.blocks.find((block: { text?: { inline?: Array<{ kind: string }> } }) =>
        block.text?.inline?.some((segment) => segment.kind === "math"));
    assert.ok(inline);
});

test("I crop delle figure C4.3 hanno hash coerenti con il manifest", async () => {
    const assets = await json("corpus/assets/circ2019/C4.3-step1.json");
    for (const figure of assets.figures) {
        const bytes = await readFile(join(repoRoot, "corpus/assets", figure.imagePath));
        const digest = createHash("sha256").update(bytes).digest("hex");
        assert.equal(digest, figure.sha256, figure.id);
    }
});
