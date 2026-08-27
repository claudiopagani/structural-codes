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
    [fid("7.11.2-7.11.1"), "\\tau_f=c'+(\\sigma'_n-\\Delta u)\\tan(\\phi')"],
    [fid("7.11.2-7.11.2"), "\\tau_f=c_{u,c}"],
    [fid("7.11.3.5.2-7.11.3"), "k_h=\\beta_s\\cdot\\frac{a_{max}}{g}"],
    [fid("7.11.3.5.2-7.11.4"), "k_v=\\pm0{,}5\\cdot k_h"],
    [fid("7.11.3.5.2-7.11.5"), "a_{max}=S\\cdot a_g=(S_S\\cdot S_T)\\cdot a_g"],
    [fid("7.11.4-unnumbered-1"), "\\begin{aligned}\\beta_s&=0.38&&\\text{ nelle verifiche dello stato limite ultimo (SLV)}\\\\\\beta_s&=0.47&&\\text{ nelle verifiche dello stato limite di esercizio (SLD).}\\end{aligned}"],
]);

const stepIds = [
    "7.10.6.2.1", "7.10.6.2.2", "7.10.7", "7.10.8", "7.11", "7.11.1",
    "7.11.2", "7.11.3", "7.11.3.1", "7.11.3.2", "7.11.3.3",
    "7.11.3.4", "7.11.3.4.1", "7.11.3.4.2", "7.11.3.4.3",
    "7.11.3.5", "7.11.3.5.1", "7.11.3.5.2", "7.11.4",
];

test("NTC pagine 282–286 conserva cinque formule numerate e un gruppo non numerato", async () => {
    const manifest = await json("corpus/assets/ntc2018/7.7-78-step2.json");
    const inStep = (asset: { pdfPage: number }) =>
        asset.pdfPage >= 282 && asset.pdfPage <= 286;
    const formulas = (manifest.formulas ?? []).filter(inStep);
    assert.equal(formulas.length, 6);
    assert.equal((manifest.tables ?? []).filter(inStep).length, 1);
    assert.equal((manifest.figures ?? []).filter(inStep).length, 1);
    assert.deepEqual(
        new Set(formulas.map((formula: any) => formula.id)),
        new Set(expected.keys()),
    );
    for (const formula of formulas) {
        assert.equal(formula.latex, expected.get(formula.id), formula.id);
    }
    const unnumbered = formulas.find((formula: any) =>
        formula.id === fid("7.11.4-unnumbered-1"),
    );
    assert.equal(unnumbered.officialNumber, null);
});

test("NTC formule 7.11.1–7.11.5 conserva indici, prodotti e frazione", () => {
    assert.match(expected.get(fid("7.11.2-7.11.1")) ?? "", /\\sigma'_n-\\Delta u/u);
    assert.match(expected.get(fid("7.11.2-7.11.2")) ?? "", /c_\{u,c\}/u);
    assert.match(expected.get(fid("7.11.3.5.2-7.11.3")) ?? "", /\\beta_s\\cdot\\frac/u);
    assert.match(expected.get(fid("7.11.3.5.2-7.11.4")) ?? "", /0\{,\}5\\cdot k_h/u);
    assert.match(expected.get(fid("7.11.3.5.2-7.11.5")) ?? "", /S_S\\cdot S_T/u);
});

test("NTC pagine 282–286 conserva matematica inline senza residui OCR", async () => {
    const units = await Promise.all(
        stepIds.map((id) => json("corpus/units/ntc2018/" + id + ".json")),
    );
    const latex = new Set<string>();
    for (const unit of units) {
        for (const block of unit.blocks) {
            if (!block.text?.inline) continue;
            assert.equal(
                block.text.inline.map((segment: any) => segment.value).join(""),
                block.text.normalized,
                block.blockId,
            );
            if (block.evidence?.pdfPage >= 282 && block.evidence?.pdfPage <= 286) {
                assert.doesNotMatch(
                    block.text.normalized,
                    /[ȕȉΆΗǊΠǂǃȟ]/u,
                    block.blockId,
                );
                assert.doesNotMatch(
                    block.text.normalized,
                    /\b(?:JR|amax|Fh|Fv|kh|kv|Uc|qc1N)\b/u,
                    block.blockId,
                );
            }
            for (const segment of block.text.inline) {
                if (segment.kind === "math") latex.add(segment.latex);
            }
        }
    }
    for (const required of [
        "d_2", "50\\%", "\\gamma_R", "\\sigma'_n", "\\Delta u", "c'",
        "\\phi'", "c_{u,c}", "a_{max}=S_S\\cdot a_g", "S_T",
        "15^\\circ", "30\\,\\mathrm{m}", "(N_1)_{60}>30", "q_{c1N}>180",
        "100\\,\\mathrm{kPa}", "U_C<3{,}5", "U_C>3{,}5",
        "F_h=k_h\\cdot W", "F_v=k_v\\cdot W", "\\beta_s",
        "a_{max}>0{,}15\\cdot g", "\\gamma_R=1.2",
    ]) {
        assert.ok(latex.has(required), required);
    }
});

test("NTC pagine 282–286 conserva capoversi e ordine degli asset", async () => {
    const requirements = await json("corpus/units/ntc2018/7.11.1.json");
    assert.deepEqual(
        requirements.blocks.filter((block: any) => block.kind === "paragraph")
            .map((block: any) => block.blockId.split("#block-")[1]),
        ["p1", "p2", "p3"],
    );

    const liquefaction = await json("corpus/units/ntc2018/7.11.3.4.2.json");
    assert.equal(liquefaction.blocks.some((block: any) => block.blockId.endsWith("#block-p2")), false);
    assert.equal(liquefaction.blocks.filter((block: any) => block.kind === "figure-ref").length, 1);

    const slopes = await json("corpus/units/ntc2018/7.11.3.5.2.json");
    const slopeKinds = slopes.blocks.map((block: any) =>
        block.kind === "formula-ref" ? block.assetId : block.blockId.split("#block-")[1],
    );
    assert.ok(slopeKinds.indexOf(fid("7.11.3.5.2-7.11.3")) < slopeKinds.indexOf(fid("7.11.3.5.2-7.11.4")));
    assert.ok(slopeKinds.indexOf(fid("7.11.3.5.2-7.11.4")) < slopeKinds.indexOf("p2"));
    assert.ok(slopeKinds.indexOf("p3") < slopeKinds.indexOf(fid("7.11.3.5.2-7.11.5")));

    const excavations = await json("corpus/units/ntc2018/7.11.4.json");
    assert.equal(excavations.title, "FRONTI DI SCAVO E RILEVATI");
    assert.equal(excavations.assets.formulaIds[0], fid("7.11.4-unnumbered-1"));
});

test("NTC tabella 7.11.I conserva intestazioni e valori ufficiali", async () => {
    const manifest = await json("corpus/assets/ntc2018/7.7-78-step2.json");
    const table = manifest.tables.find((asset: any) => asset.officialNumber === "7.11.I");
    assert.equal(table.columnCount, 3);
    assert.equal(table.headers.length, 3);
    assert.deepEqual(table.headers[0], [
        { text: "", rowSpan: 3 },
        { text: "Categoria di sottosuolo", colSpan: 2 },
    ]);
    assert.deepEqual(table.headers[1].map((cell: any) => cell.text), ["A", "B, C, D, E"]);
    assert.deepEqual(table.headers[2].map((cell: any) => cell.latex), ["\\beta_s", "\\beta_s"]);
    assert.deepEqual(
        table.rows.map((row: any[]) => row.map((cell: any) => cell.text)),
        [
            ["0,2 < a_g (g) ≤ 0,4", "0,30", "0,28"],
            ["0,1 < a_g (g) ≤ 0,2", "0,27", "0,24"],
            ["a_g (g) ≤ 0,1", "0,20", "0,20"],
        ],
    );
});

test("NTC pagine 282–286 colloca ogni formula una sola volta", async () => {
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
