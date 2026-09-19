/* eslint-disable @typescript-eslint/no-explicit-any */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const json = async (path: string) => JSON.parse(await readFile(new URL(`../${path}`, import.meta.url), "utf8"));

test("NTC 7 user latest: §7.5.2.2 ripete il pattern annidato di §7.4.3.2", async () => {
    const reference = await json("corpus/units/ntc2018/7.4.3.2.json");
    const target = await json("corpus/units/ntc2018/7.5.2.2.json");
    const referenceItems = reference.blocks.filter((value: any) => value.kind === "list-item" && value.listMarker === "dash");
    const targetItems = target.blocks.filter((value: any) => value.kind === "list-item");
    assert.equal(referenceItems.every((value: any) => value.listLevel === 1), true);
    assert.equal(targetItems.every((value: any) => value.listMarker === "dash" && value.listLevel === 1), true);
    assert.equal(targetItems.every((value: any) => value.text.inline[0].kind === "text" && value.text.inline[0].value.startsWith("- ")), true);
    assert.equal(targetItems.every((value: any) => value.text.inline.at(-1).kind === "math" && value.text.inline.at(-1).latex.startsWith("\\alpha_u/\\alpha_1=")), true);
});

test("NTC 7 user latest: Tab. 7.8.II ha colonne 3–12 di larghezza identica", async () => {
    const manifest = await json("corpus/assets/ntc2018/7.7-78-step2.json");
    const table = manifest.tables.find((value: any) => value.officialNumber === "7.8.II");
    assert.deepEqual(table.columnWidths, [10, 6, 8.4, 8.4, 8.4, 8.4, 8.4, 8.4, 8.4, 8.4, 8.4, 8.4]);
    assert.equal(new Set(table.columnWidths.slice(2)).size, 1);
});
