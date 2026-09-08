/* eslint-disable @typescript-eslint/no-explicit-any */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));

async function json(path: string) {
    return JSON.parse(await readFile(join(root, path), "utf8"));
}

function block(unit: any, prefix: string) {
    const value = unit.blocks.find((candidate: any) => candidate.text?.normalized.startsWith(prefix));
    assert.ok(value, prefix);
    return value;
}

function segment(blockValue: any, kind: string, value: string) {
    return blockValue.text.inline.some((candidate: any) => candidate.kind === kind && candidate.value === value);
}

test("NTC 7 PDF 211-219 conserva enfasi e liste ufficiali", async () => {
    const n70 = await json("corpus/units/ntc2018/7.0.json");
    assert.equal(segment(block(n70, "- si utilizza"), "em", "“progettazione per comportamento strutturale non dissipativo”"), true);
    assert.ok(n70.blocks.filter((value: any) => value.kind === "list-item").every((value: any) => value.listMarker === "dash"));

    const n71 = await json("corpus/units/ntc2018/7.1.json");
    assert.equal(segment(block(n71, "- capacità"), "strong", "capacità di un elemento strutturale o di una struttura"), true);

    const n722 = await json("corpus/units/ntc2018/7.2.2.json");
    assert.equal(segment(block(n722, "Per comportamento strutturale non dissipativo"), "strong", "comportamento strutturale non dissipativo"), true);
    assert.deepEqual(
        n722.blocks.filter((value: any) => value.kind === "list-item").map((value: any) => value.listMarker),
        ["none", "none", "dash", "dash", "dash", "dash", "dash", "bullet", "bullet"],
    );

    const n725 = await json("corpus/units/ntc2018/7.2.5.json");
    assert.deepEqual(
        n725.blocks.filter((value: any) => value.kind === "list-item").map((value: any) => value.listMarker),
        ["dash", "dash", "dash", "bullet", "bullet", "bullet", "bullet", "bullet"],
    );
});

test("NTC 7 PDF 211-219 conserva quantità e caption in LaTeX", async () => {
    const n725 = await json("corpus/units/ntc2018/7.2.5.json");
    assert.equal(segment(block(n725, "Travi o piastre"), "math", "≤ 1,00 m"), true);
    const n726 = await json("corpus/units/ntc2018/7.2.6.json");
    assert.equal(segment(block(n726, "A meno di specifiche"), "math", "40 mm"), true);
    assert.equal(segment(block(n726, "A meno di specifiche"), "math", "50 mm"), true);

    const assets = await json("corpus/assets/ntc2018/7-step1.json");
    const table72 = assets.tables.find((value: any) => value.officialNumber === "7.2.I");
    assert.deepEqual(table72.captionInline.map((value: any) => value.kind), ["em", "math", "em"]);
    const table73 = assets.tables.find((value: any) => value.officialNumber === "7.3.I");
    assert.deepEqual(table73.captionInline.map((value: any) => value.kind), ["em", "math", "em"]);
});

test("NTC 7.3 non introduce la virgola duplicata", async () => {
    const unit = await json("corpus/units/ntc2018/7.3.json");
    assert.equal(block(unit, "- per l’analisi non lineare").text.normalized.includes(",,"), false);
});
