/* eslint-disable @typescript-eslint/no-explicit-any */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const json = async (path: string) => JSON.parse(await readFile(new URL(`../${path}`, import.meta.url), "utf8"));
const table = (manifest: any, number: string) => manifest.tables.find((value: any) => value.officialNumber === number);

test("NTC 7 user latest: 7.5.2.2 mantiene trattino, testo inline e α_u/α_1 a destra", async () => {
    const unit = await json("corpus/units/ntc2018/7.5.2.2.json");
    const items = unit.blocks.filter((value: any) => value.kind === "list-item");
    assert.equal(items.length, 5);
    assert.equal(items.every((value: any) => value.listMarker === "dash" && value.listLevel === 1), true);
    assert.equal(items.every((value: any) => value.text.normalized.startsWith("- ")), true);
    assert.equal(items.every((value: any) => value.text.inline[0].kind === "text" && value.text.inline[0].value.startsWith("- ")), true);
    assert.equal(items.every((value: any) => value.text.inline.at(-1).kind === "math"), true);
    assert.equal(items.every((value: any) => value.text.inline.at(-1).latex.startsWith("\\alpha_u/\\alpha_1=")), true);
});

test("NTC 7 user latest: Tab. 7.5.I ha tutti i testi centrati", async () => {
    const manifest = await json("corpus/assets/ntc2018/7.5-step1.json");
    const value = table(manifest, "7.5.I");
    assert.equal([...value.headers, ...value.rows].flat().every((cell: any) => cell.align === "center"), true);
});

test("NTC 7 user latest: Tab. 7.8.II identifica le intestazioni ≤…g", async () => {
    const styles = await readFile(new URL("../viewer/shared/styles.css", import.meta.url), "utf8");
    assert.match(styles, /\.table-asset-7-8-ii thead tr:first-child th:nth-child\(n \+ 2\) \{ font-size: var\(--scv-font-size-12-5\); \}/u);
    assert.match(styles, /\.scv-root \.table-asset-7-5-i th, \.scv-root \.table-asset-7-5-i td \{ text-align: center; \}/u);
});
