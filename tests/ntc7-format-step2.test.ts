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
    assert.deepEqual(n731.blocks.filter((value: any) => value.kind === "list-item").map((value: any) => value.listMarker), ["bullet", "bullet", "bullet"]);

    const n7342 = await json("corpus/units/ntc2018/7.3.4.2.json");
    assert.deepEqual(n7342.blocks.filter((value: any) => value.kind === "list-item").map((value: any) => value.listMarker), ["dash", "none", "none", "dash", "none", "none", "none"]);
    assert.equal(has(block(n7342, "Gruppo 1"), "em", "Gruppo 1 - Distribuzioni principali:"), true);

    const n7431 = await json("corpus/units/ntc2018/7.4.3.1.json");
    assert.equal(n7431.blocks.filter((value: any) => value.kind === "list-item").every((value: any) => value.listMarker === "dash"), true);
    assert.equal(has(block(n7431, "strutture miste"), "strong", "strutture miste equivalenti a telai"), true);
});

test("NTC 7 PDF 220-229 conserva caption composte", async () => {
    const step2 = await json("corpus/assets/ntc2018/7-step2.json");
    assert.deepEqual(step2.tables[0].captionInline.map((value: any) => value.kind), ["em", "math", "em"]);
    const step3 = await json("corpus/assets/ntc2018/7-step3.json");
    assert.deepEqual(step3.tables[0].captionInline.map((value: any) => value.kind), ["em"]);
    const concrete = await json("corpus/assets/ntc2018/7.4-step1.json");
    assert.deepEqual(concrete.figures[0].captionInline.map((value: any) => value.kind), ["strong", "em"]);
});
