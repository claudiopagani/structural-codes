import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = fileURLToPath(new URL("../", import.meta.url));
const unitIds = ["3.2.1", "3.2.2", "3.2.3.2.1", "3.2.3.2.2", "3.2.3.2.3", "3.2.3.3", "3.2.3.5"];
type Formula = { officialNumber: string; latex: string };
type Inline = { value: string; latex?: string };
type TableInline = { kind: string; value: string; latex?: string };
type TableCell = { text: string; latex?: string; inline?: TableInline[]; strong?: boolean; colSpan?: number; rowSpan?: number; align?: string; noWrap?: boolean };
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

test("NTC § 3.2 trascrive i tre parametri come elenco senza simboli puntati", async () => {
    const unit = await json("corpus/units/ntc2018/3.2.json");
    const definitions = unit.blocks.slice(4, 7);
    assert.deepEqual(definitions.map((block: { kind: string; listMarker?: string }) => [block.kind, block.listMarker]), [
        ["list-item", "none"],
        ["list-item", "none"],
        ["list-item", "none"],
    ]);
    assert.deepEqual(definitions.map((block: { text: { normalized: string; inline?: Array<{ value: string; latex?: string }> } }) => block.text.normalized), [
        "a_g accelerazione orizzontale massima al sito;",
        "F_0 valore massimo del fattore di amplificazione dello spettro in accelerazione orizzontale;",
        "T_C^* valore di riferimento per la determinazione del periodo di inizio del tratto a velocità costante dello spettro in accelerazione orizzontale.",
    ]);
    assert.deepEqual(definitions.flatMap((block: { text: { inline?: Inline[] } }) => block.text.inline ?? []).flatMap((segment: Inline) => segment.latex ? [segment.latex] : []), ["a_g", "F_0", "T_C^*"]);
    assert.equal(unit.blocks[7].text.normalized.includes("a_g, F_0 e T_C^*"), true);
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

test("NTC 3.2 conserva grassetti, elenco delle definizioni e corsivi matematici nelle tabelle", async () => {
    const manifest = await json("corpus/assets/ntc2018/core-tables.json");
    const tableI = manifest.tables.find((table: { officialNumber: string }) => table.officialNumber === "3.2.I") as { headers: TableCell[][]; rows: TableCell[][]; captionInline?: TableInline[] };
    const tableII = manifest.tables.find((table: { officialNumber: string }) => table.officialNumber === "3.2.II") as { rows: TableCell[][] };
    const tableIII = manifest.tables.find((table: { officialNumber: string }) => table.officialNumber === "3.2.III") as { rows: TableCell[][] };
    assert.equal(tableI.headers[0]![0]!.colSpan, undefined);
    assert.equal(tableI.headers[0]![1]!.colSpan, 2);
    const sloColumn = tableI.rows.flat().filter((cell) => ["SLO", "SLD", "SLV", "SLC"].includes(cell.text));
    assert.equal(sloColumn.every((cell) => cell.align === "center" && cell.noWrap === true), true);
    assert.equal(tableII.rows.every((row) => row[1]?.inline?.[0]?.kind === "em" && row[1]?.inline?.[1]?.kind === "text"), true);
    assert.equal(tableI.captionInline?.find((segment) => segment.kind === "math")?.latex, "P_{VR}");
    const captionMath = (officialNumber: string) => (manifest.tables.find((table: { officialNumber: string }) => table.officialNumber === officialNumber) as { captionInline?: TableInline[] }).captionInline?.find((segment) => segment.kind === "math")?.latex;
    assert.equal(captionMath("2.4.I"), "V_N");
    assert.equal(captionMath("2.4.II"), "C_U");
    assert.equal(captionMath("3.2.IV"), "S_S");
    assert.equal(captionMath("3.2.V"), "S_T");
    assert.deepEqual(
        (manifest.tables.find((table: { officialNumber: string }) => table.officialNumber === "3.2.VII") as { captionInline?: TableInline[] }).captionInline?.filter((segment) => segment.kind === "math").map((segment) => segment.latex),
        ["T_E", "T_F"],
    );
    assert.equal(tableII.rows.every((row) => row[1]?.inline?.length === 2), true);
    assert.deepEqual(tableII.rows.map((row) => row[1]?.inline?.[0]?.value), [
        "Ammassi rocciosi affioranti o terreni molto rigidi",
        "Rocce tenere e depositi di terreni a grana grossa molto addensati o terreni a grana fina molto consistenti",
        "Depositi di terreni a grana grossa mediamente addensati o terreni a grana fina mediamente consistenti",
        "Depositi di terreni a grana grossa scarsamente addensati o di terreni a grana fina scarsamente consistenti",
        "Terreni con caratteristiche e valori di velocità equivalente riconducibili a quelle definite per le categorie C o D",
    ]);
    const topographicMath = tableIII.rows.flat().map((cell) => cell.inline?.find((segment) => segment.kind === "math")).filter(Boolean) as TableInline[];
    assert.equal(topographicMath.length, 4);
    assert.equal(topographicMath.every((segment) => segment.value.includes("i") && segment.latex?.includes("i")), true);

    const unit321 = await json("corpus/units/ntc2018/3.2.1.json");
    const labels = unit321.blocks.filter((block: { kind: string }) => block.kind === "list-item").map((block: { text: { inline?: Array<{ kind: string }> } }) => block.text.inline?.[0]?.kind);
    assert.deepEqual(labels, ["strong", "strong", "strong", "strong"]);

    const unit322 = await json("corpus/units/ntc2018/3.2.2.json");
    const definitionItems = unit322.blocks.filter((block: { blockId: string }) => /#block-editorial-00[7-9]|#block-editorial-010$/u.test(block.blockId));
    assert.deepEqual(definitionItems.map((block: { kind: string; listMarker?: string }) => [block.kind, block.listMarker]), [
        ["list-item", "none"], ["list-item", "none"], ["list-item", "none"], ["list-item", "none"],
    ]);

    for (const officialNumber of ["3.2.IV", "3.2.V", "3.2.VI", "3.2.VII"]) {
        const table = manifest.tables.find((candidate: { officialNumber: string }) => candidate.officialNumber === officialNumber) as { headers: TableCell[][]; rows: TableCell[][] };
        assert.equal([...table.headers.flat(), ...table.rows.flat()].every((cell) => cell.align === "center"), true, officialNumber);
    }
    const tableVI = manifest.tables.find((candidate: { officialNumber: string }) => candidate.officialNumber === "3.2.VI") as { rows: TableCell[][] };
    const tableVII = manifest.tables.find((candidate: { officialNumber: string }) => candidate.officialNumber === "3.2.VII") as { rows: TableCell[][] };
    const tableIV = manifest.tables.find((candidate: { officialNumber: string }) => candidate.officialNumber === "3.2.IV") as { rows: TableCell[][] };
    assert.equal(tableIV.rows.every((row) => row[0]?.strong === true), true);
    assert.equal(tableVI.rows[0]![0]!.strong, true);
    assert.equal(tableVII.rows.every((row) => row[0]?.strong === true), true);

    const unit32321 = await json("corpus/units/ntc2018/3.2.3.2.1.json");
    const stratigraphic = unit32321.blocks.filter((block: { blockId: string }) => /#block-editorial-02[23]$/u.test(block.blockId));
    assert.deepEqual(stratigraphic.flatMap((block: { text: { inline?: Array<{ kind: string; value: string }> } }) => block.text.inline?.filter((segment) => segment.kind === "strong").map((segment) => segment.value) ?? []), ["A", "B", "C", "D", "E", "A"]);

    const beforeStratigraphic = unit32321.blocks.find((block: { blockId: string }) => block.blockId.endsWith("#block-editorial-020"));
    assert.equal(beforeStratigraphic?.text.inline?.some((segment: { kind: string; value: string }) => segment.kind === "strong" && segment.value === "A"), true);

    const unit3234 = await json("corpus/units/ntc2018/3.2.3.4.json");
    assert.equal(unit3234.blocks[1]!.text.inline?.some((segment: { kind: string; latex?: string }) => segment.kind === "math" && segment.latex === "S_d(T)"), true);
});

test("NTC § 3.2.3.5 conserva il titolo completo e la matematica inline", async () => {
    const unit = await json("corpus/units/ntc2018/3.2.3.5.json");
    const expectedTitle = "SPETTRI DI RISPOSTA DI PROGETTO PER GLI STATI LIMITE DI DANNO (SLD), DI SALVAGUARDIA DELLA VITA (SLV) E DI PREVENZIONE DEL COLLASSO (SLC)";
    assert.equal(unit.title, expectedTitle);
    assert.equal(unit.blocks[0].text.normalized, `3.2.3.5 ${expectedTitle}`);
    const math = unit.blocks.slice(1).flatMap((block: { text: { inline?: Array<{ kind: string; latex?: string }> } }) => block.text.inline ?? []).filter((segment: { kind: string }) => segment.kind === "math");
    assert.equal(math.some((segment: { latex?: string }) => segment.latex === "S_d(T)"), true);
    assert.equal(math.some((segment: { latex?: string }) => segment.latex === "q"), true);
    assert.equal(math.some((segment: { latex?: string }) => segment.latex === "S_d(T)\\ge0{,}2a_g"), true);
    for (const block of unit.blocks.slice(1)) {
        assert.equal(block.text.inline.map((segment: { value: string }) => segment.value).join(""), block.text.normalized);
    }
});

test("NTC 3.2.3.6 rende ξ, intervalli, periodi e percentuali come matematica inline", async () => {
    const unit = await json("corpus/units/ntc2018/3.2.3.6.json");
    const blocks = unit.blocks.filter((block: { text?: { inline?: unknown[] } }) => block.text?.inline);
    for (const block of blocks) {
        assert.equal(block.text.inline.map((segment: { value: string }) => segment.value).join(""), block.text.normalized);
    }
    const latex = blocks.flatMap((block: { text: { inline: Array<{ kind: string; latex?: string }> } }) => block.text.inline)
        .filter((segment: { kind: string }) => segment.kind === "math")
        .map((segment: { latex: string }) => segment.latex);
    for (const expected of ["a_g", "S_S", "\\xi", "0{,}15\\,\\mathrm{s}\\div2{,}0\\,\\mathrm{s}", "T_{is}", "30\\%"] ) {
        assert.equal(latex.includes(expected), true, expected);
    }
    assert.doesNotMatch(blocks.map((block: { text: { normalized: string } }) => block.text.normalized).join(" "), /Β|0,15s/);
});
