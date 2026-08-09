import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../", import.meta.url));

// Canonical JSON records intentionally contain heterogeneous block shapes.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function json(relativePath: string): Promise<any> {
    return JSON.parse(await readFile(join(repoRoot, relativePath), "utf8"));
}

const numbers = ["c9", "c9.1", "c9.2", "c9.2.1", "c9.2.2", "c9.2.3", "c9.2.4"];

test("Circolare C9 contiene le sette unità attese nella gerarchia ufficiale", async () => {
    const units = await Promise.all(
        numbers.map((number) => json(`corpus/units/circ2019/${number}.json`)),
    );
    assert.deepEqual(
        units.map((unit) => unit.numbering.official),
        ["C9", "C9.1", "C9.2", "C9.2.1", "C9.2.2", "C9.2.3", "C9.2.4"],
    );
    assert.equal(units[0].kind, "chapter");
    assert.equal(units[0].hierarchy.parentId, null);
    assert.equal(units[0].hierarchy.position, 9);
    assert.equal(units[1].hierarchy.parentId, units[0].id);
    assert.equal(units[2].hierarchy.parentId, units[0].id);
    assert.deepEqual(
        units.slice(3).map((unit) => unit.hierarchy.parentId),
        [units[2].id, units[2].id, units[2].id, units[2].id],
    );
    assert.deepEqual(
        units.slice(3).map((unit) => unit.hierarchy.position),
        [1, 2, 3, 4],
    );
});

test("Circolare C9 conserva testo significativo, elenchi e matematica inline", async () => {
    const unit91 = await json("corpus/units/circ2019/c9.1.json");
    const unit92 = await json("corpus/units/circ2019/c9.2.json");
    const unit922 = await json("corpus/units/circ2019/c9.2.2.json");
    const unit923 = await json("corpus/units/circ2019/c9.2.3.json");
    const unit924 = await json("corpus/units/circ2019/c9.2.4.json");

    const text91 = unit91.blocks
        .filter((block: { text?: { normalized: string } }) => block.text)
        .map((block: { text: { normalized: string } }) => block.text.normalized)
        .join(" ");
    assert.match(text91, /Il Capitolo 9 delle NTC detta le disposizioni/u);
    assert.match(text91, /Certificato riportante la motivata non collaudabilità/u);
    assert.match(text91, /risolvere- da parte del Committente/u);
    assert.match(unit92.blocks.map((block: { text: { normalized: string } }) => block.text.normalized).join(" "), /corrispondenza fra comportamento teorico e sperimentale/u);
    assert.match(unit924.blocks[1].text.normalized, /completa separazione tra sottostruttura e sovrastruttura/u);

    assert.deepEqual(
        unit91.blocks
            .filter((block: { kind: string }) => block.kind === "list-item")
            .map((block: { text: { normalized: string } }) =>
                block.text.normalized.slice(0, block.text.normalized.indexOf(" ")),
            ),
        ["-", "-", "a)", "b)", "c)", "-", "-", "-", "-", "d)", "-", "-", "-", "e)", "f)", "g)", "h)", "i)", "-", "-", "-", "-", "-", "-", "-", "-", "-"],
    );

    const mathSegments = [unit922, unit923].flatMap((unit) =>
        unit.blocks.flatMap(
            (block: { text?: { inline?: Array<{ kind: string; value: string; latex?: string }> } }) =>
                block.text?.inline?.filter((segment) => segment.kind === "math") ?? [],
        ),
    );
    assert.deepEqual(mathSegments, [
        { kind: "math", value: "15%", latex: "15\\%" },
        { kind: "math", value: "1/5", latex: "\\frac{1}{5}" },
        { kind: "math", value: "15%", latex: "15\\%" },
        { kind: "math", value: "1/5", latex: "\\frac{1}{5}" },
    ]);
});

test("Circolare C9 non dichiara asset inattesi o duplicati e non invade C10", async () => {
    const units = await Promise.all(
        numbers.map((number) => json(`corpus/units/circ2019/${number}.json`)),
    );
    const assetIds = units.flatMap((unit) => [
        ...unit.assets.formulaIds,
        ...unit.assets.tableIds,
        ...unit.assets.figureIds,
    ]);
    assert.deepEqual(assetIds, []);
    assert.equal(new Set(assetIds).size, assetIds.length);
    assert.doesNotMatch(JSON.stringify(units), /CAPITOLO C10|REDAZIONE DEI PROGETTI STRUTTURALI/u);
});
