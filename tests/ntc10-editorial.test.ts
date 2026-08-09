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

const numbers = ["10", "10.1", "10.2", "10.2.1", "10.2.2"];

test("NTC 10 contiene le cinque unità attese nella gerarchia ufficiale", async () => {
    const units = await Promise.all(
        numbers.map((number) => json(`corpus/units/ntc2018/${number}.json`)),
    );
    assert.deepEqual(
        units.map((unit) => unit.numbering.official),
        numbers,
    );
    assert.equal(units[0].kind, "chapter");
    assert.equal(units[0].hierarchy.parentId, null);
    assert.equal(units[0].hierarchy.position, 10);
    assert.deepEqual(
        units.slice(1).map((unit) => unit.hierarchy.parentId),
        [units[0].id, units[0].id, units[2].id, units[2].id],
    );
    assert.deepEqual(
        units.slice(1).map((unit) => unit.hierarchy.position),
        [1, 2, 1, 2],
    );
});

test("NTC 10 conserva sottotitoli, elenchi e continuità fra le pagine", async () => {
    const unit101 = await json("corpus/units/ntc2018/10.1.json");
    const unit1021 = await json("corpus/units/ntc2018/10.2.1.json");
    const unit1022 = await json("corpus/units/ntc2018/10.2.2.json");

    const text1021 = unit1021.blocks
        .filter((block: { text?: { normalized: string } }) => block.text)
        .map((block: { text: { normalized: string } }) => block.text.normalized)
        .join(" ");
    assert.match(text1021, /Tipo di analisi svolta/u);
    assert.match(text1021, /Origine e Caratteristiche dei Codici di Calcolo/u);
    assert.match(text1021, /Giudizio motivato di accettabilità dei risultati\./u);
    assert.match(text1021, /descrizione dei materiali adottati e loro caratteristiche meccaniche;/u);
    assert.match(text1021, /valutazioni semplificate, etc\./u);
    assert.match(
        unit1022.blocks[1].text.normalized,
        /controllo incrociato sui risultati delle elaborazioni\./u,
    );

    assert.equal(
        unit101.blocks.filter((block: { kind: string }) => block.kind === "list-item").length,
        5,
    );
    assert.equal(
        unit1021.blocks.filter((block: { kind: string }) => block.kind === "list-item").length,
        11,
    );
    assert.equal(
        unit1021.blocks.filter((block: { evidence: { pdfPage: number } }) => block.evidence.pdfPage === 307).length,
        13,
    );
});

test("NTC 10 non dichiara asset inattesi o duplicati", async () => {
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
});
