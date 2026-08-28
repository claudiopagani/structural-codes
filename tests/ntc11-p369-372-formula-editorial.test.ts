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

test("NTC pagina 369 conserva le sei formule con il separatore decimale ufficiale", async () => {
    const manifest = await json("corpus/assets/ntc2018/11-step2.json");
    const formulas = manifest.formulas.filter((formula: { pdfPage: number }) => formula.pdfPage === 369);
    assert.deepEqual(
        formulas.map((formula: { officialNumber: string; latex: string }) => [formula.officialNumber, formula.latex]),
        [
            ["11.10.4", "f_{vk}=f_{vk0}+0{,}4\\sigma_n"],
            ["11.10.5", "f_{vk}\\le f_{vk,\\lim}"],
            ["11.10.6", "f_{vk,\\lim}=0{,}065f_b"],
            ["11.10.7", "f_{vk,\\lim}=0{,}10f_b"],
            ["11.10.8", "E=1000f_k"],
            ["11.10.9", "G=0.4E"],
        ],
    );
});

test("NTC pagina 369 conserva inline completi e le due descrizioni dei moduli", async () => {
    const units = await Promise.all(["11.10.3.2.2", "11.10.3.3", "11.10.3.4"].map(
        (number) => json(`corpus/units/ntc2018/${number}.json`),
    ));
    const pageBlocks = units.flatMap((unit) => unit.blocks).filter(
        (block: { evidence: { pdfPage: number } }) => block.evidence.pdfPage === 369,
    );
    const inlineLatex = pageBlocks.flatMap(
        (block: { text?: { inline?: Array<{ kind: string; latex?: string }> } }) =>
            block.text?.inline?.filter((segment) => segment.kind === "math").map((segment) => segment.latex) ?? [],
    );
    for (const latex of ["f_{vk0}", "f_{vk}", "\\sigma_n", "f_{vk,\\lim}", "0{,}2f_b", "f_b", "f_{vk,\\lim}=0{,}045f_b", "n", "(n\\ge6)"]) {
        assert.ok(inlineLatex.includes(latex), `inline mancante: ${latex}`);
    }
    const elasticity = units.find((unit) => unit.numbering.official === "11.10.3.4");
    assert.deepEqual(
        elasticity.blocks.slice(-4).map((block: { kind: string; text?: { normalized: string }; assetId?: string }) =>
            block.kind === "formula-ref" ? [block.kind, block.assetId] : [block.kind, block.text?.normalized]),
        [
            ["list-item", "– modulo di elasticità normale secante"],
            ["formula-ref", "urn:structural-codes:it:asset:formula:ntc2018:11.10.8"],
            ["list-item", "– modulo di elasticità tangenziale secante"],
            ["formula-ref", "urn:structural-codes:it:asset:formula:ntc2018:11.10.9"],
        ],
    );
    const normalized = pageBlocks.map((block: { text?: { normalized?: string } }) => block.text?.normalized ?? "").join(" ");
    assert.doesNotMatch(normalized, /[ǃǂΒ΅·ȡ]|\bfvk\s+,|\bVn\b/u);
});

test("NTC pagina 369 colloca ogni formula una sola volta", async () => {
    const units = await Promise.all(["11.10.3.2.2", "11.10.3.3", "11.10.3.4"].map(
        (number) => json(`corpus/units/ntc2018/${number}.json`),
    ));
    const refs = units.flatMap((unit) => unit.blocks).filter(
        (block: { kind: string; evidence: { pdfPage: number } }) => block.kind === "formula-ref" && block.evidence.pdfPage === 369,
    );
    assert.equal(refs.length, 6);
    assert.equal(new Set(refs.map((block: { assetId: string }) => block.assetId)).size, 6);
});

test("NTC capitolo 12 conserva titolo, sette voci e nessun asset matematico", async () => {
    const chapter = await json("corpus/units/ntc2018/12.json");
    assert.equal(chapter.title, "RIFERIMENTI TECNICI");
    assert.deepEqual([...new Set(chapter.blocks.map((block: { evidence: { pdfPage: number } }) => block.evidence.pdfPage))], [371, 372]);
    assert.equal(chapter.blocks.filter((block: { kind: string }) => block.kind === "list-item").length, 7);
    assert.deepEqual(chapter.assets, { formulaIds: [], tableIds: [], figureIds: [] });
    assert.equal(chapter.blocks.some((block: { assetId?: string }) => block.assetId !== undefined), false);
    assert.equal(chapter.blocks.flatMap((block: { text?: { inline?: unknown[] } }) => block.text?.inline ?? []).length, 0);
});
