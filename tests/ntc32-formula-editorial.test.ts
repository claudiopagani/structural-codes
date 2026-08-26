import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = fileURLToPath(new URL("../", import.meta.url));
const unitIds = ["3.2.1", "3.2.2", "3.2.3.2.1", "3.2.3.2.2", "3.2.3.2.3", "3.2.3.3"];
type Formula = { officialNumber: string; latex: string };
const formulaId = (number: string) => `urn:structural-codes:it:asset:formula:ntc2018:${number}`;
const tableId = (number: string) => `urn:structural-codes:it:asset:table:ntc2018:${number.toLowerCase()}`;

async function json(path: string) {
    return JSON.parse(await readFile(join(root, path), "utf8"));
}

test("NTC 3.2 conserva tutti i display numerati [3.2.0]–[3.2.12]", async () => {
    const manifest = await json("corpus/assets/ntc2018/core-editorial.json");
    const formulas = manifest.formulas.filter((formula: { officialNumber: string | null }) => /^3\.2\.(?:[0-9]|1[0-2])$/.test(formula.officialNumber ?? "")) as Formula[];
    assert.deepEqual(formulas.map((formula: { officialNumber: string }) => formula.officialNumber), [
        "3.2.0", "3.2.1", "3.2.2", "3.2.3", "3.2.4", "3.2.5", "3.2.6", "3.2.7", "3.2.8", "3.2.9", "3.2.10", "3.2.11", "3.2.12",
    ]);
    const byNumber = new Map<string, Formula>(formulas.map((formula) => [formula.officialNumber, formula]));
    assert.equal(byNumber.get("3.2.2")!.latex, "\\begin{aligned}0\\le T<T_B\\quad&S_e(T)=a_g\\cdot S\\cdot\\eta\\cdot F_o\\cdot\\left[\\frac{T}{T_B}+\\frac{1}{\\eta\\cdot F_o}\\left(1-\\frac{T}{T_B}\\right)\\right]\\\\T_B\\le T<T_C\\quad&S_e(T)=a_g\\cdot S\\cdot\\eta\\cdot F_o\\\\T_C\\le T<T_D\\quad&S_e(T)=a_g\\cdot S\\cdot\\eta\\cdot F_o\\cdot\\left(\\frac{T_C}{T}\\right)\\\\T_D\\le T\\quad&S_e(T)=a_g\\cdot S\\cdot\\eta\\cdot F_o\\cdot\\left(\\frac{T_C\\cdot T_D}{T^2}\\right)\\end{aligned}");
    assert.equal(byNumber.get("3.2.8")!.latex.includes("\\frac{1}{\\eta\\cdot F_o}"), true);
    assert.equal(byNumber.get("3.2.9")!.latex, "F_v=1{,}35\\cdot F_o\\cdot\\left(\\frac{a_g}{g}\\right)^{0{,}5}");
    assert.equal(byNumber.get("3.2.10")!.latex.includes("\\times"), true);
    assert.equal(byNumber.get("3.2.11")!.latex.includes("T_E<T\\le T_F"), true);
    assert.equal(byNumber.get("3.2.12")!.latex, "\\begin{aligned}d_g&=0{,}025\\cdot a_g\\cdot S\\cdot T_C\\cdot T_D\\\\v_g&=0{,}16\\cdot a_g\\cdot S\\cdot T_C\\end{aligned}");
});

test("NTC 3.2 colloca ogni formula una sola volta e rimuove il testo estratto corrotto", async () => {
    const units = await Promise.all(unitIds.map((id) => json(`corpus/units/ntc2018/${id}.json`)));
    const refs = units.flatMap((unit) => unit.blocks.filter((block: { kind: string }) => block.kind === "formula-ref"));
    const ids = refs.map((block: { assetId: string }) => block.assetId);
    for (let number = 0; number <= 12; number += 1) {
        assert.equal(ids.filter((id: string) => id === formulaId(`3.2.${number}`)).length, 1, `formula 3.2.${number}`);
    }
    for (const unit of units) {
        for (const block of unit.blocks) {
            if (!block.text?.normalized) continue;
            assert.doesNotMatch(block.text.normalized, />3\.2\.|[ªº¬¼¨¸©¹]|\(cid:/);
            if (block.text.inline) {
                assert.equal(block.text.inline.map((segment: { value: string }) => segment.value).join(""), block.text.normalized);
            }
        }
    }
    const horizontal = units.find((unit) => unit.numbering.official === "3.2.3.2.1");
    assert.deepEqual(
        horizontal.blocks.filter((block: { kind: string }) => block.kind === "formula-ref").map((block: { assetId: string }) => block.assetId),
        ["3.2.2", "3.2.3", "3.2.4", "3.2.5", "3.2.6", "3.2.7"].map(formulaId),
    );
});

test("NTC Tabelle 3.2.I–VII conservano struttura e matematica ufficiali", async () => {
    const manifest = await json("corpus/assets/ntc2018/core-tables.json");
    const tables = manifest.tables.filter((table: { officialNumber: string | null }) => /^3\.2\.(?:I|II|III|IV|V|VI|VII)$/.test(table.officialNumber ?? ""));
    assert.deepEqual(tables.map((table: { officialNumber: string }) => table.officialNumber), ["3.2.I", "3.2.II", "3.2.III", "3.2.IV", "3.2.V", "3.2.VI", "3.2.VII"]);
    const tableIV = tables.find((table: { officialNumber: string }) => table.officialNumber === "3.2.IV");
    assert.equal(tableIV.columnCount, 3);
    assert.equal(tableIV.rows.length, 5);
    assert.equal(tableIV.headers[0][1].latex, "S_S");
    assert.equal(tableIV.rows[1][1].latex, "1{,}00\\le1{,}40-0{,}40\\cdot F_o\\cdot\\frac{a_g}{g}\\le1{,}20");
    assert.equal(tableIV.rows[4][2].latex, "1{,}15\\cdot(T_C^*)^{-0{,}40}");
    const unit322 = await json("corpus/units/ntc2018/3.2.2.json");
    assert.deepEqual(unit322.assets.tableIds, [tableId("3.2.II"), tableId("3.2.III")]);
    const unit32321 = await json("corpus/units/ntc2018/3.2.3.2.1.json");
    assert.deepEqual(unit32321.assets.tableIds, [tableId("3.2.IV"), tableId("3.2.V")]);
});
