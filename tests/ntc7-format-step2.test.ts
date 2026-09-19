/* eslint-disable @typescript-eslint/no-explicit-any */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const json = async (path: string) => JSON.parse(await readFile(join(root, path), "utf8"));
const block = (unit: any, prefix: string) => unit.blocks.find((value: any) => value.text?.normalized.startsWith(prefix));
const has = (value: any, kind: string, text: string) => value.text.inline.some((part: any) => part.kind === kind && part.value === text);

test("NTC 7 PDF 220-229 conserva marcatori ed enfasi", async () => {
    const n731 = await json("corpus/units/ntc2018/7.3.1.json");
    assert.equal(has(block(n731, "Valori del fattore"), "em", "Valori del fattore di comportamento q"), true);
    assert.deepEqual(n731.blocks.filter((value: any) => value.kind === "list-item" && value.listMarker === "bullet").map((value: any) => value.listMarker), ["bullet", "bullet", "bullet"]);

    const n7342 = await json("corpus/units/ntc2018/7.3.4.2.json");
    assert.deepEqual(n7342.blocks.filter((value: any) => value.kind === "list-item").map((value: any) => value.listMarker), ["dash", "none", "none", "dash", "none", "none", "none"]);
    assert.deepEqual(n7342.blocks.filter((value: any) => value.listLevel === 1).map((value: any) => value.text.normalized.slice(0, 32)), [
        "distribuzione proporzionale alle",
        "distribuzione corrispondente a u",
    ]);
    assert.equal(has(block(n7342, "Gruppo 1"), "em", "Gruppo 1 - Distribuzioni principali:"), true);

    const n7431 = await json("corpus/units/ntc2018/7.4.3.1.json");
    assert.deepEqual(n7431.blocks.filter((value: any) => value.kind === "list-item").map((value: any) => value.listMarker), ["dash", "dash", "dash", "dash", "dash", "dash", "none", "none"]);
    assert.equal(has(block(n7431, "strutture miste"), "strong", "strutture miste equivalenti a telai"), true);
    assert.deepEqual(n7431.blocks.filter((value: any) => value.listLevel === 1).map((value: any) => value.text.inline[0].value), ["r²", "lₛ²"]);

    const n7432 = await json("corpus/units/ntc2018/7.4.3.2.json");
    assert.equal(n7432.blocks.filter((value: any) => value.listLevel === 1).length, 6);
    assert.equal(n7432.blocks.filter((value: any) => value.listLevel === 1).every((value: any) => value.text.inline.at(-1).kind === "math"), true);

    assert.deepEqual(n731.blocks.filter((value: any) => value.kind === "list-item").slice(0, 6).map((value: any) => value.text.inline[0].value), ["q_0", "K_R", "P", "d_{Er}", "V", "h"]);
    const n7332 = await json("corpus/units/ntc2018/7.3.3.2.json");
    assert.deepEqual(n7332.blocks.filter((value: any) => value.kind === "list-item").map((value: any) => value.text.inline[0].value), ["F_h = S_d(T_1) W λ/g", "F_i", "W_i", "z_i", "S_d(T_1)", "W", "λ", "g"]);
    const n7361 = await json("corpus/units/ntc2018/7.3.6.1.json");
    assert.deepEqual(n7361.blocks.filter((value: any) => value.kind === "list-item" && value.listMarker === "none").slice(-2).map((value: any) => value.text.inline[0].value), ["d_r", "h"]);
});

test("NTC 7 PDF 220-229 conserva caption composte", async () => {
    const step2 = await json("corpus/assets/ntc2018/7-step2.json");
    assert.deepEqual(step2.tables[0].captionInline.map((value: any) => value.kind), ["em", "math", "em"]);
    const step3 = await json("corpus/assets/ntc2018/7-step3.json");
    assert.deepEqual(step3.tables[0].captionInline.map((value: any) => value.kind), ["em"]);
    const concrete = await json("corpus/assets/ntc2018/7.4-step1.json");
    assert.deepEqual(concrete.figures[0].captionInline.map((value: any) => value.kind), ["strong", "em"]);

    const table73ii = step2.tables.find((value: any) => value.officialNumber === "7.3.II");
    assert.equal(table73ii.rows.filter((row: any[]) => row.length === 1 && row[0].colSpan === 4).every((row: any[]) => row[0].shade === "gray"), true);
    assert.equal(table73ii.rows.slice(-8).every((row: any[]) => row.slice(-2).every((cell: any) => cell.align === "center")), true);
    const table73iii = step3.tables.find((value: any) => value.officialNumber === "7.3.III");
    assert.equal([...table73iii.headers.flat(), ...table73iii.rows.flat()].every((value: any) => value.align === "center"), true);
});
