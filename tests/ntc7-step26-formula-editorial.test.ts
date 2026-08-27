/* eslint-disable @typescript-eslint/no-explicit-any */
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = fileURLToPath(new URL("../", import.meta.url));
const fid = (suffix: string) =>
    "urn:structural-codes:it:asset:formula:ntc2018:" + suffix;

async function json(path: string) {
    return JSON.parse(await readFile(join(root, path), "utf8"));
}

async function allUnits() {
    const names = (await readdir(join(root, "corpus/units/ntc2018"))).filter(
        (name) => name.endsWith(".json"),
    );
    return Promise.all(
        names.map((name) => json("corpus/units/ntc2018/" + name)),
    );
}

const expected = new Map<string, string>([
    [fid("7.9.4.1-7.9.6"), "T_1=2\\pi\\sqrt{\\frac{\\sum G_i\\cdot d_i^2}{g\\cdot\\sum G_i\\cdot d_i}}"],
    [fid("7.9.5-7.9.7"), "\\gamma_{Rd}=0{,}7+0{,}2q\\ge1"],
    [fid("7.9.5.1.1-7.9.8"), "M_{Ed}\\le M_{Rd}"],
    [fid("7.9.5.1.1-7.9.9"), "M_{prc}\\le M_{yd}"],
    [fid("7.9.5.1.1-7.9.10a"), "V_{Ed}=\\gamma_{Bd}\\cdot V_{prc}"],
    [fid("7.9.5.1.1-7.9.10b"), "V_{prc}=(M_{s,prc}+M_{i,prc})/l_p"],
    [fid("7.9.5.1.1-7.9.11"), "1{,}00\\le\\gamma_{Bd}=2{,}25-q\\cdot(V_E/V_{prc}-1)\\le1{,}25"],
    [fid("7.9.5.2.1-7.9.12"), "V_{Ed,i}=V_{E,i}\\cdot\\frac{\\gamma_{Rd}\\cdot M_{Rd,i}}{M_{E,i}}\\le V_{E,i}\\cdot q"],
]);

test("NTC pagine 272–274 conserva le otto formule display ufficiali", async () => {
    const manifest = await json("corpus/assets/ntc2018/7.7-78-step2.json");
    const inStep = (asset: { pdfPage: number }) =>
        asset.pdfPage >= 272 && asset.pdfPage <= 274;
    const formulas = (manifest.formulas ?? []).filter(inStep);
    assert.equal(formulas.length, 8);
    assert.equal((manifest.tables ?? []).filter(inStep).length, 0);
    assert.equal((manifest.figures ?? []).filter(inStep).length, 0);
    assert.deepEqual(
        new Set(formulas.map((formula: any) => formula.id)),
        new Set(expected.keys()),
    );
    for (const formula of formulas) {
        assert.equal(formula.latex, expected.get(formula.id), formula.id);
        assert.notEqual(formula.officialNumber, null, formula.id);
    }
});

test("NTC pagine 272–273 distingue barre oblique, frazioni e prodotti ufficiali", () => {
    assert.ok(!expected.get(fid("7.9.4.1-7.9.6"))?.includes("\\sum_i"));
    assert.ok(!expected.get(fid("7.9.5.1.1-7.9.10b"))?.includes("\\frac"));
    assert.ok(!expected.get(fid("7.9.5.1.1-7.9.11"))?.includes("\\frac"));
    assert.ok(expected.get(fid("7.9.5.2.1-7.9.12"))?.includes("\\frac"));
    for (const suffix of ["7.9.5.1.1-7.9.10a", "7.9.5.1.1-7.9.11", "7.9.5.2.1-7.9.12"]) {
        assert.ok(expected.get(fid(suffix))?.includes("\\cdot"), suffix);
    }
});

test("NTC pagine 272–274 conserva matematica inline completa e confini dei simboli", async () => {
    const units = await allUnits();
    const inStep = (page: number | undefined) =>
        (page ?? 0) >= 272 && (page ?? 0) <= 274;
    const stepUnits = units.filter((unit) =>
        unit.blocks.some((block: any) => inStep(block.evidence?.pdfPage)),
    );
    assert.equal(stepUnits.length, 15);

    const latex = new Set<string>();
    for (const unit of stepUnits) {
        for (const block of unit.blocks) {
            if (!inStep(block.evidence?.pdfPage) || !block.text?.inline) continue;
            const segments = block.text.inline;
            assert.equal(
                segments.map((segment: any) => segment.value).join(""),
                block.text.normalized,
                block.blockId,
            );
            assert.doesNotMatch(block.text.normalized, /[΅·ǂǃȉΑƺʌ¦]/u, block.blockId);
            for (let index = 0; index < segments.length; index += 1) {
                const segment = segments[index];
                if (segment.kind !== "math") continue;
                latex.add(segment.latex);
                if (!/^[A-Za-z]$/u.test(segment.value)) continue;
                const before = segments[index - 1]?.value?.at(-1);
                const after = segments[index + 1]?.value?.at(0);
                assert.ok(
                    before === undefined || !/[\p{L}\p{N}_]/u.test(before),
                    block.blockId,
                );
                assert.ok(
                    after === undefined || !/[\p{L}\p{N}_]/u.test(after),
                    block.blockId,
                );
            }
        }
    }

    for (const required of [
        "\\gamma_{Rd}",
        "0{,}1",
        "1+2(\\nu_k-0{,}1)^2",
        "F_{prc}",
        "1{,}30",
        "55\\%",
        "65\\%",
        "0{,}9d",
        "0{,}75d",
        "0{,}60d",
        "45^\\circ",
        "\\alpha<2{,}0",
        "q=1",
        "\\gamma_{Rd}\\cdot M_{Rd}",
        "\\alpha\\cdot Q",
        "\\alpha=1{,}5\\cdot S\\cdot a_g/g",
        "400\\,\\mathrm{mm}",
        "a_g\\cdot S",
    ]) {
        assert.ok(latex.has(required), required);
    }
});

test("NTC pagina 272 non converte lettere discorsive in matematica", async () => {
    const unit = await json("corpus/units/ntc2018/7.9.5.json");
    const block = unit.blocks.find((candidate: any) =>
        candidate.blockId.endsWith("#block-p2"),
    );
    assert.deepEqual(
        block.text.inline
            .filter((segment: any) => segment.kind === "math")
            .map((segment: any) => segment.latex),
        ["q", "\\nu_k", "0{,}1", "1+2(\\nu_k-0{,}1)^2"],
    );
});

test("NTC pagina 274 ripristina prodotti e unità di misura inline", async () => {
    const endStops = await json("corpus/units/ntc2018/7.9.5.3.3.json");
    const overlap = await json("corpus/units/ntc2018/7.9.5.3.4.json");
    const mobile = await json("corpus/units/ntc2018/7.9.5.4.1.json");
    const fixed = await json("corpus/units/ntc2018/7.9.5.4.2.json");
    assert.ok(endStops.blocks.at(-1).text.normalized.includes("α = 1,5 · S · a_g/g"));
    assert.ok(overlap.blocks.at(-1).text.inline.some((segment: any) => segment.latex === "400\\,\\mathrm{mm}"));
    assert.ok(mobile.blocks.at(-1).text.normalized.startsWith("– le forze"));
    assert.ok(fixed.blocks.find((block: any) => block.blockId.endsWith("#block-p1")).text.normalized.includes("a_g · S"));
});

test("NTC pagine 272–274 colloca ogni formula una sola volta", async () => {
    const units = await allUnits();
    const references = units
        .flatMap((unit) => unit.blocks)
        .filter((block: any) => block.assetId)
        .map((block: any) => block.assetId);
    for (const id of expected.keys()) {
        assert.equal(
            references.filter((candidate: string) => candidate === id).length,
            1,
            id,
        );
    }
});
