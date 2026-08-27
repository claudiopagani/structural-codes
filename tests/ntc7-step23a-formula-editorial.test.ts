/* eslint-disable @typescript-eslint/no-explicit-any */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
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
    const manifest = await json("corpus/assets/ntc2018/7.6-step1.json");
    const inStep = (asset: { pdfPage: number }) =>
        asset.pdfPage >= 252 && asset.pdfPage <= 257;
    return {
        formulas: (manifest.formulas ?? []).filter(inStep),
        tables: (manifest.tables ?? []).filter(inStep),
        figures: (manifest.figures ?? []).filter(inStep),
    };
}

const expected = new Map<string, string>([
    [fid("7.6.1"), "R_{j,d}\\ge R_{U,Rd}"],
    [fid("7.6.2"), "V_{wp,Rd}=0{,}8\\left(V_{wp,s,Rd}+V_{wp,c,Rd}\\right)"],
    [fid("7.6.3"), "N_{Ed}/N_{pl,Rd}\\le0{,}3"],
    [fid("7.6.4"), "b_{eff}=b_{e1}+b_{e2}+b_c"],
    [fid("7.6.5"), "x/d<\\varepsilon_{cu}/\\left(\\varepsilon_{cu}+\\varepsilon_a\\right)"],
    [fid("7.6.6"), "I_{eq}=0{,}6\\cdot I_1+0{,}4\\cdot I_2"],
    [fid("7.6.7"), "\\left(E\\cdot I\\right)_C=0{,}9\\cdot\\left(E\\cdot I_a+r\\cdot E_{cm}\\cdot I_c+E\\cdot I_s\\right)"],
    [fid("7.6.8"), "\\sum M_{C,pl,Rd}\\ge\\gamma_{Rd}\\cdot\\sum M_{b,pl,Rd}"],
]);

test("NTC pagine 252–257 conserva le otto formule in display", async () => {
    const { formulas } = await stepAssets();
    assert.equal(formulas.length, 8);
    assert.deepEqual(
        new Set(formulas.map((formula: any) => formula.id)),
        new Set(expected.keys()),
    );
    for (const formula of formulas) {
        assert.equal(formula.latex, expected.get(formula.id), formula.id);
        assert.notEqual(formula.officialNumber, null, formula.id);
    }
    assert.ok(
        !formulas.some((formula: any) =>
            formula.id.includes("7.6.4.3:mu-local")),
        "μ = q_u/q_y è inline nel PDF e non deve essere duplicata come asset",
    );
});

test("NTC pagine 252–257 conserva formule inline complete e confini dei simboli", async () => {
    const units = await allUnits();
    const inStep = (page: number | undefined) =>
        (page ?? 0) >= 252 && (page ?? 0) <= 257;
    const stepUnits = units.filter((unit) =>
        unit.blocks.some((block: any) => inStep(block.evidence?.pdfPage)),
    );
    assert.equal(stepUnits.length, 24);

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
            for (let index = 0; index < segments.length; index += 1) {
                const segment = segments[index];
                if (segment.kind !== "math") continue;
                latex.add(segment.latex);
                if (!/^[A-Za-z]$/u.test(segment.value)) continue;
                const before = segments[index - 1]?.value?.at(-1);
                const after = segments[index + 1]?.value?.at(0);
                assert.ok(before === undefined || !/[\p{L}\p{N}_]/u.test(before));
                assert.ok(after === undefined || !/[\p{L}\p{N}_]/u.test(after));
            }
        }
    }

    for (const required of [
        "q_0",
        "n=E_a/E_{cm}=7",
        "E_{Sd}<E_{pl,Rd}",
        "E_{U,Rd}=1{,}1\\gamma_{ov}E_{pl,Rd}",
        "40\\%",
        "\\mu=q_u/q_y",
        "15\\%",
        "N/N_f",
        "x/d",
        "s_l/c\\le0{,}5",
        "0{,}5<s_l/c<1{,}0",
        "(f_{ydf}/f_{ydw})^{0{,}5}",
        "\\gamma_{Rd}",
        "2b_{eff}",
        "0.5",
    ]) {
        assert.ok(latex.has(required), required);
    }
});

test("NTC pagine 252–257 conserva quattro tabelle e due crop ufficiali", async () => {
    const { tables, figures } = await stepAssets();
    assert.deepEqual(
        tables.map((table: any) => table.officialNumber),
        ["7.6.I", "7.6.II", "7.6.III", "7.6.IV"],
    );
    assert.deepEqual(
        tables[0].rows.map((row: any[]) => row.slice(1).map((cell) => cell.text)),
        [["14 ε", "9 ε"], ["38 ε", "24 ε"], ["85 ε²", "80 ε²"]],
    );
    assert.ok(tables[0].notes.includes("ε = (235/f_yk)^0,5"));
    assert.deepEqual(
        tables[3].rows.slice(-2).map((row: any[]) => row[3].latex),
        ["b_{magg}/2+0{,}7h_c/2", "b_{magg}/2\\le0{,}05L"],
    );

    assert.deepEqual(
        figures.map((figure: any) => figure.officialNumber),
        ["7.6.1", "7.6.2"],
    );
    assert.equal(figures[0].caption, "Fig. 7.6.1 - Rapporti dimensionali");
    for (const figure of figures) {
        const bytes = await readFile(join(root, "corpus/assets", figure.imagePath));
        assert.equal(
            createHash("sha256").update(bytes).digest("hex"),
            figure.sha256,
            figure.imagePath,
        );
    }
});

test("NTC pagine 252–257 colloca ogni asset una volta e registra la q ufficiale", async () => {
    const units = await allUnits();
    const references = units
        .flatMap((unit) => unit.blocks)
        .filter((block: any) => block.assetId)
        .map((block: any) => block.assetId);
    const { tables, figures } = await stepAssets();
    for (const id of [
        ...expected.keys(),
        ...tables.map((table: any) => table.id),
        ...figures.map((figure: any) => figure.id),
    ]) {
        assert.equal(
            references.filter((candidate: string) => candidate === id).length,
            1,
            id,
        );
    }

    const unit = await json("corpus/units/ntc2018/7.6.4.3.json");
    assert.ok(
        unit.workflow.openIssues.some(
            (issue: any) =>
                issue.issueId === "ntc2018-7-6-4-3-source-anomaly-q" &&
                issue.severity === "warning",
        ),
    );
    const qBlock = unit.blocks.find(
        (block: any) =>
            block.text?.normalized ===
            "La duttilità locale è definita come segue: μ = q_u/q_y.",
    );
    assert.deepEqual(
        qBlock.text.inline.filter((segment: any) => segment.kind === "math"),
        [{ kind: "math", value: "μ = q_u/q_y", latex: "\\mu=q_u/q_y" }],
    );
});
