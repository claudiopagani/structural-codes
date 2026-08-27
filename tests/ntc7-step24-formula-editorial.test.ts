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

async function stepAssets() {
    const manifest = await json("corpus/assets/ntc2018/7.7-78-step2.json");
    const inStep = (asset: { pdfPage: number }) =>
        asset.pdfPage >= 262 && asset.pdfPage <= 266;
    return {
        formulas: (manifest.formulas ?? []).filter(inStep),
        tables: (manifest.tables ?? []).filter(inStep),
        figures: (manifest.figures ?? []).filter(inStep),
    };
}

const expected = new Map<string, string>([
    [fid("7.8.1.5.2-7.8.0"), "|\\Delta V|\\le\\max\\{0{,}25|V|,\\;0{,}1|V_{piano}|\\}"],
    [fid("7.8.1.5.2-sa"), "S_a=\\alpha\\cdot S\\cdot\\left[1.5\\cdot\\left(1+Z/H\\right)-0.5\\right]\\ge\\alpha\\cdot S"],
    [fid("7.8.1.9-7.8.1"), "\\sigma=\\frac{N}{A}\\le0{,}25\\frac{f_k}{\\gamma_M}"],
    [fid("7.8.2.2.1-7.8.2"), "M_u=\\left(l^2\\cdot t\\cdot\\frac{\\sigma_0}{2}\\right)\\left(1-\\frac{\\sigma_0}{0{,}85f_d}\\right)"],
    [fid("7.8.2.2.2-7.8.3"), "V_t=l'\\cdot t\\cdot f_{vd}"],
    [fid("7.8.2.2.4-7.8.4"), "V_t=h\\cdot t\\cdot f_{vd0}"],
    [fid("7.8.2.2.4-7.8.5"), "M_u=H_p\\cdot\\frac{h}{2}\\cdot\\left[1-\\frac{H_p}{\\left(0{,}85\\cdot f_{bd}\\cdot h\\cdot t\\right)}\\right]"],
    [fid("7.8.2.2.4-7.8.6"), "V_p=2M_{fu}/l"],
]);

test("NTC pagine 262–266 conserva le otto formule in display", async () => {
    const { formulas, tables, figures } = await stepAssets();
    assert.equal(formulas.length, 8);
    assert.equal(tables.length, 2);
    assert.equal(figures.length, 0);
    assert.deepEqual(
        new Set(formulas.map((formula: any) => formula.id)),
        new Set(expected.keys()),
    );
    for (const formula of formulas) {
        assert.equal(formula.latex, expected.get(formula.id), formula.id);
    }
    assert.equal(
        formulas.find((formula: any) => formula.id === fid("7.8.1.5.2-sa"))
            .officialNumber,
        null,
    );
    assert.equal(
        formulas.find((formula: any) => formula.id.endsWith("7.8.2.2.4-7.8.6"))
            .latex.includes("\\frac"),
        false,
        "la [7.8.6] usa la barra obliqua ufficiale, non una frazione impilata",
    );
});

test("NTC pagine 262–266 conserva formule inline complete e confini dei simboli", async () => {
    const units = await allUnits();
    const inStep = (page: number | undefined) =>
        (page ?? 0) >= 262 && (page ?? 0) <= 266;
    const stepUnits = units.filter((unit) =>
        unit.blocks.some((block: any) => inStep(block.evidence?.pdfPage)),
    );
    assert.equal(stepUnits.length, 20);

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
            assert.doesNotMatch(block.text.normalized, /[΅ΏǊ·]/u, block.blockId);
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
        "a_g S\\le0{,}075g",
        "q=q_0\\cdot K_R",
        "q_0",
        "2{,}0\\,\\alpha_u/\\alpha_1",
        "3{,}0\\,\\alpha_u/\\alpha_1",
        "\\lambda=1{,}0",
        "\\Delta V",
        "q_a=3",
        "(S_a/q_a)",
        "Z=0",
        "a_g S\\le0{,}35g",
        "\\gamma_G=\\gamma_Q=1",
        "\\gamma_{Rd}",
        "0.85f_d",
        "\\sigma_0=N/(l\\cdot t)",
        "f_d=f_k/\\gamma_M",
        "1{,}0\\%",
        "\\sigma_n=N/(l'\\cdot t)",
        "f_{yd}=f_{yk}/\\gamma_M",
        "f_{vd0}=f_{vk0}/\\gamma_M",
        "f_{hd}=f_{hk}/\\gamma_M",
        "0{,}5\\%",
    ]) {
        assert.ok(latex.has(required), required);
    }
    assert.ok(!latex.has("a_{gS}"));
    assert.ok(![...latex].some((value) => value.includes("a_{gS}")));
});

test("NTC pagine 262–266 struttura integralmente le tabelle 7.8.I e 7.8.II", async () => {
    const { tables } = await stepAssets();
    assert.deepEqual(
        tables.map((table: any) => table.officialNumber),
        ["7.8.I", "7.8.II"],
    );

    const [geometry, areas] = tables;
    assert.equal(geometry.columnCount, 4);
    assert.equal(geometry.rows.length, 7);
    assert.deepEqual(
        geometry.rows.map((row: any[]) => row.slice(1).map((entry) => entry.text)),
        [
            ["300 mm", "10", "0,5"],
            ["240 mm", "12", "0,4"],
            ["240 mm", "15", "Qualsiasi"],
            ["240 mm", "15", "0,3"],
            ["240 mm", "12", "0,3"],
            ["200 mm", "20", "0,3"],
            ["150 mm", "20", "0,3"],
        ],
    );
    assert.deepEqual(
        geometry.rows.slice(-3).map((row: any[]) => row[0].text.match(/0\.\d+\s?g/u)?.[0]),
        ["0.15g", "0.075 g", "0.075 g"],
    );
    for (const entry of geometry.rows.slice(-3).map((row: any[]) => row[0])) {
        assert.ok(entry.latex.startsWith("\\begin{gathered}\\text{"));
        assert.ok(entry.latex.includes("a_g S\\le"));
        assert.ok(entry.latex.includes("\\end{gathered}"));
    }

    assert.equal(areas.columnCount, 12);
    assert.equal(areas.headers[0][0].colSpan, 2);
    assert.equal(
        areas.headers[0][0].latex,
        "\\text{Accelerazione di picco del terreno }a_g S^{(1)}",
    );
    assert.deepEqual(
        areas.headers[0].slice(1).map((entry: any) => entry.latex),
        ["\\le0{,}07g", "\\le0{,}10g", "\\le0{,}15g", "\\le0{,}20g", "\\le0{,}25g", "\\le0{,}30g", "\\le0{,}35g", "\\le0{,}40g", "\\le0{,}45g", "\\le0{,}50g"],
    );
    assert.equal(areas.rows[0][0].rowSpan, 3);
    assert.equal(areas.rows[3][0].rowSpan, 4);
    assert.deepEqual(
        areas.rows[0].slice(2).map((entry: any) => entry.text),
        ["3,5%", "3,5%", "4,0%", "4,5%", "5,5%", "6,0%", "6,0%", "6,0%", "6,0%", "6,5%"],
    );
    assert.deepEqual(
        areas.rows[2].slice(-3).map((entry: any) => entry.text),
        ["", "", ""],
    );
    for (const row of areas.rows) {
        for (const entry of row) {
            if (!entry.text.endsWith("%")) continue;
            assert.equal(entry.latex, entry.text.replace(",", "{,}").replace("%", "\\%"));
        }
    }
});

test("NTC pagine 264–266 conserva continuità editoriale e definizioni mancanti", async () => {
    const simple = await json("corpus/units/ntc2018/7.8.1.9.json");
    const opening = simple.blocks.find((block: any) => block.blockId.endsWith("#block-p1"));
    assert.equal(
        simple.blocks.filter((block: any) =>
            block.text?.normalized?.includes("Si definiscono “costruzioni semplici”"),
        ).length,
        1,
    );
    assert.match(opening.text.raw, /Per le costruzioni\s+semplici/u);
    assert.ok(opening.text.normalized.includes("a_g S ≤ 0,35g"));

    const bending = await json("corpus/units/ntc2018/7.8.2.2.1.json");
    assert.equal(bending.blocks.length, 10);
    assert.deepEqual(
        bending.blocks.map((block: any) => block.blockId.split("#").at(-1)),
        ["block-heading", "block-p1", "block-formula-7-8-2-2-1-7-8-2", "block-p2", "block-p3", "block-p4", "block-p5", "block-p6", "block-p7", "block-p8"],
    );
    assert.deepEqual(
        bending.blocks.slice(5).map((block: any) => block.evidence.pdfPage),
        [266, 266, 266, 266, 266],
    );
    assert.equal(bending.blocks[3].text.normalized, "dove:");
    assert.ok(bending.blocks[7].text.normalized.includes("σ_0 = N/(l·t)"));
    assert.equal(bending.blocks[8].text.normalized, "f_d = f_k / γ_M è la resistenza a compressione di progetto della muratura.");
});

test("NTC pagine 262–266 colloca ogni formula e tabella una sola volta", async () => {
    const units = await allUnits();
    const references = units
        .flatMap((unit) => unit.blocks)
        .filter((block: any) => block.assetId)
        .map((block: any) => block.assetId);
    const { tables } = await stepAssets();
    for (const id of [
        ...expected.keys(),
        ...tables.map((table: any) => table.id),
    ]) {
        assert.equal(
            references.filter((candidate: string) => candidate === id).length,
            1,
            id,
        );
    }
});
