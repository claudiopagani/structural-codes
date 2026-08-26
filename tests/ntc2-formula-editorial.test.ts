import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

const repoRoot = join(import.meta.dirname, "..");

type InlineSegment = { kind: "text"; value: string } | { kind: "math"; value: string; latex: string };
type Block = { blockId: string; kind: string; assetId?: string; text?: { inline?: InlineSegment[] } };
type Unit = { blocks: Block[] };
type Formula = { officialNumber: string | null; latex: string };
type FormulaManifest = { formulas: Formula[] };

async function json<T>(path: string): Promise<T> {
    return JSON.parse(await readFile(join(repoRoot, path), "utf8")) as T;
}

test("NTC capitoli 1-2: le dieci formule display sono collegate una sola volta", async () => {
    const units = await Promise.all([
        "1", "1.1", "2", "2.1", "2.2", "2.2.1", "2.2.2", "2.2.3", "2.2.4", "2.2.5", "2.2.6",
        "2.3", "2.4", "2.4.1", "2.4.2", "2.4.3", "2.5", "2.5.1", "2.5.1.1", "2.5.1.2",
        "2.5.1.3", "2.5.2", "2.5.3", "2.6", "2.6.1", "2.6.2",
    ].map((number) => json<Unit>(`corpus/units/ntc2018/${number}.json`)));
    const refs = units.flatMap((unit) => unit.blocks.filter((block) => block.kind === "formula-ref"));

    assert.equal(refs.length, 10);
    assert.equal(new Set(refs.map((block) => block.assetId)).size, 10);
});

test("NTC 2.5.1-2.5.7 conserva i punti di moltiplicazione della fonte", async () => {
    const manifest = await json<FormulaManifest>("corpus/assets/ntc2018/core-editorial.json");
    const formulas = new Map(manifest.formulas.map((formula) => [formula.officialNumber, formula.latex]));

    assert.deepEqual(
        [...formulas.entries()].filter(([number]) => /^2\.5\./u.test(String(number))),
        [
            ["2.5.1", "\\gamma_{G1}\\cdot G_1+\\gamma_{G2}\\cdot G_2+\\gamma_P\\cdot P+\\gamma_{Q1}\\cdot Q_{k1}+\\gamma_{Q2}\\cdot\\psi_{02}\\cdot Q_{k2}+\\gamma_{Q3}\\cdot\\psi_{03}\\cdot Q_{k3}+\\ldots"],
            ["2.5.2", "G_1+G_2+P+Q_{k1}+\\psi_{02}\\cdot Q_{k2}+\\psi_{03}\\cdot Q_{k3}+\\ldots"],
            ["2.5.3", "G_1+G_2+P+\\psi_{11}\\cdot Q_{k1}+\\psi_{22}\\cdot Q_{k2}+\\psi_{23}\\cdot Q_{k3}+\\ldots"],
            ["2.5.4", "G_1+G_2+P+\\psi_{21}\\cdot Q_{k1}+\\psi_{22}\\cdot Q_{k2}+\\psi_{23}\\cdot Q_{k3}+\\ldots"],
            ["2.5.5", "E+G_1+G_2+P+\\psi_{21}\\cdot Q_{k1}+\\psi_{22}\\cdot Q_{k2}+\\ldots"],
            ["2.5.6", "G_1+G_2+P+A_d+\\psi_{21}\\cdot Q_{k1}+\\psi_{22}\\cdot Q_{k2}+\\ldots"],
            ["2.5.7", "G_1+G_2+\\sum_j\\psi_{2j}\\cdot Q_{kj}"],
        ],
    );
});

test("NTC 2 rende come segmenti matematici completi le espressioni inline corrette", async () => {
    const unit23 = await json<Unit>("corpus/units/ntc2018/2.3.json");
    const unit252 = await json<Unit>("corpus/units/ntc2018/2.5.2.json");
    const block = (unit: Unit, suffix: string) => {
        const match = unit.blocks.find((candidate) => candidate.blockId.endsWith(suffix));
        assert.ok(match?.text?.inline);
        return match;
    };

    assert.deepEqual(
        block(unit23, "#block-editorial-005").text?.inline?.filter((segment) => segment.kind === "math").map((segment) => segment.latex),
        ["X_d", "X_d = X_k/\\gamma_M", "\\gamma_{M}"],
    );
    assert.deepEqual(
        block(unit23, "#block-editorial-006").text?.inline?.filter((segment) => segment.kind === "math").map((segment) => segment.latex),
        ["F_d", "F_k", "F_d = \\gamma_F F_k", "\\gamma_F", "\\psi_0 F_k", "\\psi_0 \\le 1"],
    );
    assert.deepEqual(
        ["005", "006", "007"].map((suffix) => block(unit252, `#block-editorial-${suffix}`).text?.inline?.find((segment) => segment.kind === "math")?.latex),
        ["\\psi_{2j}\\cdot Q_{kj}", "\\psi_{1j}\\cdot Q_{kj}", "\\psi_{0j}\\cdot Q_{kj}"],
    );
});
