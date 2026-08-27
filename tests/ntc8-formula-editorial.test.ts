/* eslint-disable @typescript-eslint/no-explicit-any */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = fileURLToPath(new URL("../", import.meta.url));
const unitIds = [
    "8", "8.1", "8.2", "8.3", "8.4", "8.4.1", "8.4.2", "8.4.3",
    "8.5", "8.5.1", "8.5.2", "8.5.3", "8.5.4", "8.5.5", "8.6",
    "8.7", "8.7.1", "8.7.2", "8.7.3", "8.7.4", "8.7.5",
];

async function unit(number: string) {
    return JSON.parse(await readFile(join(root, "corpus/units/ntc2018", `${number}.json`), "utf8"));
}

const sha256 = (value: string) => createHash("sha256").update(value, "utf8").digest("hex");

test("NTC capitolo 8 non inventa formule display, tabelle o figure", async () => {
    for (const number of unitIds) {
        const record = await unit(number);
        assert.deepEqual(record.assets, { formulaIds: [], tableIds: [], figureIds: [] }, number);
        assert.equal(record.blocks.some((block: any) => /^(?:formula|table|figure)-ref$/u.test(block.kind)), false, number);
    }
});

test("NTC capitolo 8 conserva zeta e gamma nella matematica inline ufficiale", async () => {
    const records = await Promise.all(unitIds.map(unit));
    const segments = records.flatMap((record) => record.blocks)
        .flatMap((block: any) => block.text?.inline ?? [])
        .filter((segment: any) => segment.kind === "math");
    const latex = segments.map((segment: any) => segment.latex);
    assert.equal(latex.filter((value: string) => value === "\\zeta_E").length, 4);
    assert.ok(latex.includes("\\zeta_{v,i}"));
    assert.ok(latex.includes("\\zeta_E=1{,}0"));
    assert.ok(latex.includes("\\zeta_E\\ge1{,}0"));
    assert.ok(latex.includes("\\zeta_E\\ge0{,}80"));
    assert.ok(latex.includes("\\gamma_G"));
    assert.ok(latex.includes("10\\%"));
    assert.ok(latex.includes("50\\%"));
    assert.equal(latex.some((value: string) => /\\xi|\\zeta_\{V/u.test(value)), false);
});

test("NTC capitolo 8 conserva i marcatori degli elenchi della fonte", async () => {
    const knowledge = await unit("8.5.4");
    assert.deepEqual(
        knowledge.blocks.filter((block: any) => block.kind === "list-item").map((block: any) => block.text.normalized),
        ["- LC1;", "- LC2;", "- LC3."],
    );
    for (const number of ["8.7.3", "8.7.4"]) {
        const record = await unit(number);
        for (const block of record.blocks.filter((candidate: any) => candidate.kind === "list-item")) {
            assert.match(block.text.normalized, /^– /u, block.blockId);
        }
    }
    const deliverables = await unit("8.7.5");
    assert.deepEqual(
        deliverables.blocks.filter((block: any) => block.kind === "list-item").map((block: any) => block.text.normalized.slice(0, 2)),
        ["a)", "b)", "c)", "d)", "e)", "f)"],
    );
});

test("NTC capitolo 8 mantiene evidence, hash e continuità delle pagine", async () => {
    const records = await Promise.all(unitIds.map(unit));
    const pages = new Set<number>();
    for (const record of records) {
        for (const block of record.blocks) {
            if (!block.text) continue;
            pages.add(block.evidence.pdfPage);
            if (block.text.inline) {
                assert.equal(block.text.inline.map((segment: any) => segment.value).join(""), block.text.normalized, block.blockId);
            }
            assert.equal(block.evidence.rawSha256, sha256(block.text.raw), block.blockId);
            assert.equal(block.evidence.normalizedSha256, sha256(block.text.normalized), block.blockId);
        }
    }
    assert.deepEqual([...pages].sort((a, b) => a - b), [293, 294, 295, 296, 297, 298, 299]);
    const chapter = await unit("8");
    assert.equal(chapter.blocks[0].text.raw, "CAPITOLO 8.\nCOSTRUZIONI ESISTENTI");
});
