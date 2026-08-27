/* eslint-disable @typescript-eslint/no-explicit-any */
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = fileURLToPath(new URL("../", import.meta.url));
const fid = (suffix: string) =>
    "urn:structural-codes:it:asset:formula:ntc2018:" + suffix;
const figid = (suffix: string) =>
    "urn:structural-codes:it:asset:figure:ntc2018:" + suffix;

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
    [fid("7.11.6.2.1-7.11.6"), "k_h=\\beta_m\\cdot\\frac{a_{max}}{g}"],
    [fid("7.11.6.2.1-7.11.7"), "k_v=\\pm0{,}5\\cdot k_h"],
    [fid("7.11.6.2.1-7.11.8"), "a_{max}=S\\cdot a_g=(S_S\\cdot S_T)\\cdot a_g"],
    [fid("7.11.6.2.1-unnumbered-1"), "\\begin{aligned}\\beta_m&=0.38&&\\text{ nelle verifiche allo stato limite ultimo (SLV)}\\\\\\beta_m&=0.47&&\\text{ nelle verifiche allo stato limite di esercizio (SLD).}\\end{aligned}"],
    [fid("7.11.6.3.1-7.11.9"), "a_h=k_h\\cdot g=\\alpha\\cdot\\beta\\cdot a_{max}"],
    [fid("7.11.6.3.1-7.11.10"), "a_{max}=S\\cdot a_g=(S_S\\cdot S_T)\\cdot a_g"],
    [fid("7.11.6.3.1-7.11.11"), "u_s\\le0{,}005\\cdot H"],
    [fid("7.11.6.4-7.11.12"), "L_e=L_s\\left(1+1{,}5\\cdot\\frac{a_{max}}{g}\\right)"],
]);

const stepIds = [
    "7.11.4", "7.11.5", "7.11.5.1", "7.11.5.2", "7.11.5.3",
    "7.11.5.3.1", "7.11.5.3.2", "7.11.6", "7.11.6.1", "7.11.6.2",
    "7.11.6.2.1", "7.11.6.2.2", "7.11.6.3", "7.11.6.3.1",
    "7.11.6.3.2", "7.11.6.4", "7.11.6.4.1",
];

test("NTC pagine 287–292 conserva sette formule numerate e un gruppo non numerato", async () => {
    const manifest = await json("corpus/assets/ntc2018/7.7-78-step2.json");
    const inStep = (asset: { pdfPage: number }) =>
        asset.pdfPage >= 287 && asset.pdfPage <= 292;
    const formulas = manifest.formulas.filter(inStep);
    assert.equal(formulas.length, 8);
    assert.equal(manifest.tables.filter(inStep).length, 2);
    assert.equal(manifest.figures.filter(inStep).length, 2);
    assert.deepEqual(
        new Set(formulas.map((formula: any) => formula.id)),
        new Set(expected.keys()),
    );
    for (const formula of formulas) {
        assert.equal(formula.latex, expected.get(formula.id), formula.id);
    }
    assert.equal(
        formulas.find((formula: any) => formula.id === fid("7.11.6.2.1-unnumbered-1")).officialNumber,
        null,
    );
});

test("NTC formule 7.11.6–7.11.12 conserva prodotti, pedici e frazioni", () => {
    assert.match(expected.get(fid("7.11.6.2.1-7.11.6")) ?? "", /\\beta_m\\cdot\\frac/u);
    assert.match(expected.get(fid("7.11.6.2.1-7.11.8")) ?? "", /S_S\\cdot S_T/u);
    assert.match(expected.get(fid("7.11.6.3.1-7.11.9")) ?? "", /\\alpha\\cdot\\beta/u);
    assert.match(expected.get(fid("7.11.6.3.1-7.11.11")) ?? "", /0\{,\}005\\cdot H/u);
    assert.match(expected.get(fid("7.11.6.4-7.11.12")) ?? "", /1\{,\}5\\cdot\\frac/u);
});

test("NTC pagine 287–292 conserva titoli, capoversi e ordine degli asset", async () => {
    const titles = new Map([
        ["7.11.5", "FONDAZIONI"],
        ["7.11.5.1", "REGOLE GENERALI DI PROGETTAZIONE"],
        ["7.11.5.2", "INDAGINI E MODELLO GEOTECNICO"],
        ["7.11.5.3", "VERIFICHE ALLO STATO LIMITE ULTIMO (SLV) E ALLO STATO LIMITE DI ESERCIZIO (SLD)"],
        ["7.11.5.3.1", "Fondazioni superficiali"],
    ]);
    for (const [id, title] of titles) {
        assert.equal((await json(`corpus/units/ntc2018/${id}.json`)).title, title);
    }

    const rules = await json("corpus/units/ntc2018/7.11.5.1.json");
    assert.deepEqual(rules.blocks.map((block: any) => block.kind), [
        "heading", "paragraph", "list-item", "list-item", "paragraph", "paragraph",
    ]);

    const wall = await json("corpus/units/ntc2018/7.11.6.2.1.json");
    const wallKinds = wall.blocks.map((block: any) =>
        block.kind === "formula-ref" ? block.assetId : block.blockId.split("#block-")[1],
    );
    assert.ok(wallKinds.indexOf("p8") < wallKinds.indexOf(fid("7.11.6.2.1-unnumbered-1")));
    assert.ok(wallKinds.indexOf(fid("7.11.6.2.1-unnumbered-1")) < wallKinds.indexOf("p9"));

    const checks = await json("corpus/units/ntc2018/7.11.6.3.2.json");
    assert.deepEqual(checks.assets.figureIds, [
        figid("7.11.6.3.2-fig7.11.2"), figid("7.11.6.3.2-fig7.11.3"),
    ]);
    assert.deepEqual(checks.blocks.slice(-2).map((block: any) => block.assetId), checks.assets.figureIds);
    const methods = await json("corpus/units/ntc2018/7.11.6.3.1.json");
    assert.deepEqual(methods.assets.figureIds, []);
});

test("NTC pagine 287–292 conserva matematica inline senza residui OCR", async () => {
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
            if (block.evidence.pdfPage >= 287 && block.evidence.pdfPage <= 292) {
                assert.doesNotMatch(block.text.normalized, /[ȕȉΆ΅ǂΠΈĚ]/u, block.blockId);
                assert.doesNotMatch(block.text.normalized, /\b(?:JR|amax|kh|kv|ag|us|Vs|Em)\b/u, block.blockId);
            }
            for (const segment of block.text.inline) {
                if (segment.kind === "math") latex.add(segment.latex);
            }
        }
    }
    for (const required of [
        "\\gamma_R", "50\\%", "a_g>0{,}25g", "\\beta_m", "a_{max}",
        "S_S", "S_T", "\\alpha\\le1", "\\beta\\le1", "a_v=0", "V_s",
        "u_s=0", "\\alpha\\cdot\\beta\\le0{,}2", "\\delta>\\phi'/2",
        "L_s", "L_e",
    ]) {
        assert.ok(latex.has(required), required);
    }
});

test("NTC Tabelle 7.11.II–III conserva valori e simboli ufficiali", async () => {
    const manifest = await json("corpus/assets/ntc2018/7.7-78-step2.json");
    const tables = new Map<string, any>(manifest.tables.map((table: any) => [table.officialNumber, table]));
    assert.deepEqual(tables.get("7.11.II").rows.map((row: any[]) => row.map((cell: any) => cell.text)), [
        ["Carico limite", "2.3"], ["Scorrimento", "1.1"],
        ["Resistenza sulle superfici laterali", "1.3"],
    ]);
    assert.deepEqual(tables.get("7.11.III").rows.map((row: any[]) => row.map((cell: any) => cell.text)), [
        ["Carico limite", "1.2"], ["Scorrimento", "1.0"], ["Ribaltamento", "1.0"],
        ["Resistenza del terreno a valle", "1.2"],
    ]);
    for (const number of ["7.11.II", "7.11.III"]) {
        assert.equal(tables.get(number).headers[0][1].latex, "\\gamma_R");
    }
});

test("NTC pagine 287–292 colloca formule e figure una sola volta", async () => {
    const units = await allUnits();
    const references = units.flatMap((unit) => unit.blocks)
        .filter((block: any) => block.assetId)
        .map((block: any) => block.assetId);
    for (const id of [...expected.keys(), figid("7.11.6.3.2-fig7.11.2"), figid("7.11.6.3.2-fig7.11.3")]) {
        assert.equal(references.filter((candidate: string) => candidate === id).length, 1, id);
    }
});
