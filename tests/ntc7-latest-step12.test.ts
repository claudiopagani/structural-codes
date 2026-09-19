/* eslint-disable @typescript-eslint/no-explicit-any */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const json = async (path: string) => JSON.parse(await readFile(new URL(`../${path}`, import.meta.url), "utf8"));
const table = (manifest: any, number: string) => manifest.tables.find((value: any) => value.officialNumber === number);
const heading = (unit: any, title: string) => unit.blocks.find((value: any) => value.kind === "heading" && value.text?.normalized === title);

test("NTC 7 latest: Tab. 7.3.II conserva righe reali dei ponti e titoli evidenziati", async () => {
    const manifest = await json("corpus/assets/ntc2018/7-step2.json");
    const bridge = table(manifest, "7.3.II").rows.slice(-8);
    assert.deepEqual(bridge.filter((row: any[]) => row[0].inline).map((row: any[]) => row[0].inline[0]), [
        { kind: "strong", value: "Pile in calcestruzzo armato" },
        { kind: "strong", value: "Pile in acciaio:" },
        { kind: "strong", value: "Spalle" },
    ]);
    assert.deepEqual(bridge.filter((row: any[]) => row[0].rowSpan).map((row: any[]) => row[0].rowSpan), [2, 4, 2]);
    const unit = await json("corpus/units/ntc2018/7.3.1.json");
    assert.deepEqual(heading(unit, "Effetti delle non linearità geometriche").text.inline, [{ kind: "strong-em", value: "Effetti delle non linearità geometriche" }]);
});

test("NTC 7 latest: titoli delle pareti e delle regole di dettaglio in grassetto corsivo", async () => {
    const walls = await json("corpus/units/ntc2018/7.4.4.5.1.json");
    for (const title of ["Taglio", "Verifica a taglio-compressione del calcestruzzo dell’anima", "Verifica a taglio-trazione dell’armatura dell’anima"]) assert.deepEqual(heading(walls, title).text.inline, [{ kind: "strong-em", value: title }]);
    for (const id of ["7.4.6.2.1", "7.4.6.2.2", "7.4.6.2.4"]) {
        const unit = await json(`corpus/units/ntc2018/${id}.json`);
        assert.equal(unit.blocks.filter((value: any) => value.kind === "heading" && !value.text.normalized.startsWith("7.")).every((value: any) => value.text.inline[0].kind === "strong-em"), true, id);
    }
});

test("NTC 7 latest: elenco d_bl,max e nesting dell’acciaio", async () => {
    const columns = await json("corpus/units/ntc2018/7.4.6.2.2.json");
    const description = columns.blocks.find((value: any) => value.text?.normalized.startsWith("dove d_{bl,max}"));
    assert.deepEqual(description.text.inline.filter((value: any) => value.kind === "math").map((value: any) => value.latex), ["d_{bl,\\max}", "f_{yd,l}", "f_{yd,st}"]);
    const steel = await json("corpus/units/ntc2018/7.5.2.1.json");
    assert.deepEqual(steel.blocks.filter((value: any) => /^b[1-3]\)/u.test(value.text?.normalized ?? "")).map((value: any) => value.listLevel), [1, 1, 1]);
    const eccentric = await json("corpus/units/ntc2018/7.5.6.json");
    assert.deepEqual(eccentric.blocks.find((value: any) => value.text?.normalized.startsWith("γ_{ov} è il coefficiente")).kind, "list-item");
});

test("NTC 7 latest: allineamenti e righe delle tabelle", async () => {
    const six = await json("corpus/assets/ntc2018/7.6-step1.json");
    const t61 = table(six, "7.6.I");
    assert.equal([...t61.headers, ...t61.rows].every((row: any[]) => [1, 2].every((index) => row[index]?.align === "center")), true);
    const t63 = table(six, "7.6.III");
    assert.equal(t63.rows[2][2].text, "Per M^-: 0\nPer M^+: 0,025 L");
    assert.equal([...t63.headers, ...t63.rows].every((row: any[]) => row[0]?.align === "center" && row[1]?.align === "center" && (!row[2] || row[2].align === "left")), true);
    const seven = await json("corpus/assets/ntc2018/7.7-78-step2.json");
    const t82 = table(seven, "7.8.II");
    assert.deepEqual(t82.columnWidths, [10, 6, 8.4, 8.4, 8.4, 8.4, 8.4, 8.4, 8.4, 8.4, 8.4, 8.4]);
    assert.equal([...t82.headers, ...t82.rows].every((row: any[]) => row.every((cell: any) => cell.align === "center")), true);
    assert.match(t82.rows[0][0].text, /^Muratura\nordinaria$/u);
    const t11 = table(seven, "7.11.I");
    assert.equal([...t11.headers, ...t11.rows].every((row: any[]) => row.every((cell: any) => cell.align === "center")), true);
    for (const number of ["7.11.II", "7.11.III"]) { const t = table(seven, number); assert.equal([...t.headers, ...t.rows].every((row: any[]) => row[0]?.align === "left" && row[1]?.align === "center"), true); }
});

test("NTC 7 latest: gli elenchi labeled dopo [7.11.7] sono strutturati", async () => {
    const unit = await json("corpus/units/ntc2018/7.11.6.2.1.json");
    const index = unit.blocks.findIndex((value: any) => value.assetId?.endsWith("-7.11.7"));
    assert.deepEqual(unit.blocks.slice(index + 1, index + 5).map((value: any) => [value.kind, value.listMarker, value.text.normalized]), [
        ["paragraph", undefined, "dove:"],
        ["list-item", "none", "β_m = coefficiente di riduzione dell’accelerazione massima attesa al sito;"],
        ["list-item", "none", "a_max = accelerazione orizzontale massima attesa al sito;"],
        ["list-item", "none", "g = accelerazione di gravità."],
    ]);
});
