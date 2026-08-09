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

const numbers = ["c10", "c10.1", "c10.2", "c10.2.1", "c10.2.2"];

test("Circolare C10 contiene le cinque unità attese nella gerarchia ufficiale", async () => {
    const units = await Promise.all(
        numbers.map((number) => json(`corpus/units/circ2019/${number}.json`)),
    );
    assert.deepEqual(
        units.map((unit) => unit.numbering.official),
        ["C10", "C10.1", "C10.2", "C10.2.1", "C10.2.2"],
    );
    assert.equal(units[0].kind, "chapter");
    assert.equal(units[0].hierarchy.parentId, null);
    assert.equal(units[0].hierarchy.position, 10);
    assert.equal(units[1].hierarchy.parentId, units[0].id);
    assert.equal(units[2].hierarchy.parentId, units[0].id);
    assert.deepEqual(
        units.slice(3).map((unit) => unit.hierarchy.parentId),
        [units[2].id, units[2].id],
    );
    assert.deepEqual(
        units.slice(3).map((unit) => unit.hierarchy.position),
        [1, 2],
    );
});

test("Circolare C10 conserva testo introduttivo, sottotitoli, elenchi e matematica inline", async () => {
    const unit10 = await json("corpus/units/circ2019/c10.json");
    const unit101 = await json("corpus/units/circ2019/c10.1.json");
    const unit1021 = await json("corpus/units/circ2019/c10.2.1.json");

    assert.match(
        unit10.blocks.map((block: { text: { normalized: string } }) => block.text.normalized).join(" "),
        /Le norme di cui al Capitolo 10 delle NTC, disciplinando/u,
    );
    assert.deepEqual(
        unit101.blocks.filter((block: { kind: string }) => block.kind === "heading").map(
            (block: { text: { normalized: string } }) => block.text.normalized,
        ),
        [
            "C10.1 CARATTERISTICHE GENERALI",
            "Relazione di calcolo strutturale",
            "Relazione sui materiali",
            "Elaborati grafici",
            "Particolari costruttivi",
            "Piano di manutenzione della parte strutturale dell’opera",
            "Relazioni specialistiche",
        ],
    );
    assert.deepEqual(
        unit101.blocks.filter((block: { kind: string }) => block.kind === "list-item").map(
            (block: { text: { normalized: string } }) => block.text.normalized.slice(0, block.text.normalized.indexOf(" ")),
        ),
        [
            "-", "-", "-", "1)", "2)", "3)", "4)", "5)",
            ...Array.from({ length: 17 }, () => "-"),
            "1)", "2)", "3)",
        ],
    );
    assert.deepEqual(
        unit1021.blocks.filter((block: { kind: string }) => block.kind === "list-item").map(
            (block: { text: { normalized: string } }) => block.text.normalized.slice(0, block.text.normalized.indexOf(" ")),
        ),
        ["a)", "a.1)", "a.2)", "a.3)", "a.4)", "a.5)", "b)", "b.1)", "b.2)", "-", "-", "-", "b.3)", "b.4)"],
    );

    const inline = unit101.blocks[30].text.inline;
    assert.deepEqual(inline, [
        { kind: "text", value: "In particolare, gli elaborati grafici di insieme (carpenterie, profili e sezioni) da redigere in scala non inferiore ad " },
        { kind: "math", value: "1:50", latex: "1{:}50" },
        { kind: "text", value: ", e gli elaborati grafici di dettaglio da redigere in scala non inferiore ad " },
        { kind: "math", value: "1:10", latex: "1{:}10" },
        { kind: "text", value: ", devono contenere fra l'altro:" },
    ]);
});

test("Circolare C10 non dichiara asset inattesi o duplicati", async () => {
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
});
