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

const numbers = ["9", "9.1", "9.2", "9.2.1", "9.2.2", "9.2.3"];

test("NTC 9 contiene le sei unità attese nella gerarchia ufficiale", async () => {
    const units = await Promise.all(
        numbers.map((number) => json(`corpus/units/ntc2018/${number}.json`)),
    );
    assert.deepEqual(
        units.map((unit) => unit.numbering.official),
        numbers,
    );
    assert.equal(units[0].kind, "chapter");
    assert.equal(units[0].hierarchy.parentId, null);
    assert.equal(units[0].hierarchy.position, 9);
    assert.equal(units[1].hierarchy.parentId, units[0].id);
    assert.equal(units[2].hierarchy.parentId, units[0].id);
    assert.deepEqual(
        units.slice(3).map((unit) => unit.hierarchy.parentId),
        [units[2].id, units[2].id, units[2].id],
    );
    assert.deepEqual(
        units.slice(3).map((unit) => unit.hierarchy.position),
        [1, 2, 3],
    );
});

test("NTC 9 conserva testo significativo, elenchi e matematica inline", async () => {
    const unit91 = await json("corpus/units/ntc2018/9.1.json");
    const unit922 = await json("corpus/units/ntc2018/9.2.2.json");
    const unit923 = await json("corpus/units/ntc2018/9.2.3.json");

    const text91 = unit91.blocks
        .filter((block: { text?: { normalized: string } }) => block.text)
        .map((block: { text: { normalized: string } }) => block.text.normalized)
        .join(" ");
    assert.match(text91, /Il collaudo statico, inteso come procedura/u);
    assert.match(text91, /certificato di collaudo/u);
    assert.match(text91, /registro delle non-conformità/u);

    assert.deepEqual(
        unit91.blocks
            .filter((block: { kind: string }) => block.kind === "list-item")
            .map((block: { text: { normalized: string } }) =>
                block.text.normalized.slice(0, block.text.normalized.indexOf(" ")),
            ),
        [
            "a)",
            "b)",
            "c)",
            "-",
            "-",
            "d)",
            "e)",
            "f)",
            "g)",
            "h)",
            "i)",
            "-",
            "-",
            "-",
        ],
    );

    for (const unit of [unit922, unit923]) {
        const mathSegments = unit.blocks.flatMap(
            (block: { text?: { inline?: Array<{ kind: string; value: string; latex?: string }> } }) =>
                block.text?.inline?.filter((segment) => segment.kind === "math") ?? [],
        );
        assert.deepEqual(mathSegments, [{ kind: "math", value: "15%", latex: "15\\%" }]);
    }
});

test("NTC 9 non dichiara asset inattesi o duplicati e non invade il Capitolo 10", async () => {
    const units = await Promise.all(
        numbers.map((number) => json(`corpus/units/ntc2018/${number}.json`)),
    );
    const assetIds = units.flatMap((unit) => [
        ...unit.assets.formulaIds,
        ...unit.assets.tableIds,
        ...unit.assets.figureIds,
    ]);
    assert.deepEqual(assetIds, []);
    assert.equal(new Set(assetIds).size, assetIds.length);
    assert.doesNotMatch(JSON.stringify(units), /CAPITOLO 10|REDAZIONE DEI PROGETTI STRUTTURALI/u);
});
