/* eslint-disable @typescript-eslint/no-explicit-any */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const json = async (path: string) => JSON.parse(await readFile(new URL(`../${path}`, import.meta.url), "utf8"));
const table = (manifest: any, number: string) => manifest.tables.find((value: any) => value.officialNumber === number);

test("NTC 7 user latest: i ponti della Tab. 7.3.II sono righe reali", async () => {
    const manifest = await json("corpus/assets/ntc2018/7-step2.json");
    const value = table(manifest, "7.3.II");
    assert.deepEqual(value.columnWidths, [24, 36, 20, 20]);
    assert.deepEqual(value.headers[0].map((cell: any) => cell.colSpan), [2, 2]);
    assert.equal(value.headers[1][0].colSpan, 2);
    const bridge = value.rows.slice(-8);
    assert.deepEqual(bridge.map((row: any[]) => row[0]?.text ?? row[0]?.text), [
        "Pile in calcestruzzo armato",
        "Elementi di sostegno inclinati inflessi",
        "Pile in acciaio:",
        "Elementi di sostegno inclinati inflessi",
        "Pile con controventi concentrici",
        "Pile con controventi eccentrici",
        "Spalle",
        "Se si muovono col terreno",
    ]);
    assert.deepEqual([bridge[0][0].rowSpan, bridge[2][0].rowSpan, bridge[6][0].rowSpan], [2, 4, 2]);
    assert.deepEqual(bridge.map((row: any[]) => row.slice(-2).map((cell: any) => cell.text)), [
        ["3,5 λ", "1,5"], ["2,1 λ", "1,2"], ["3,5", "1,5"], ["2,0", "1,2"],
        ["2,5", "1,5"], ["3,5", "-"], ["1,5", "1,5"], ["1,0", "1,0"],
    ]);
});

test("NTC 7 user latest: titoli 7.5.2.1 e intestazioni 7.5.I", async () => {
    const steel = await json("corpus/units/ntc2018/7.5.2.1.json");
    const titles = [
        "Strutture intelaiate",
        "Strutture con controventi concentrici",
        "Strutture con controventi eccentrici",
        "Strutture a mensola o a pendolo inverso",
        "Strutture intelaiate con controventi concentrici",
        "Strutture intelaiate con tamponature",
    ];
    for (const title of titles) {
        const block = steel.blocks.find((value: any) => value.text?.normalized.includes(`${title}:`));
        assert.ok(block, title);
        assert.deepEqual(block.text.inline.find((value: any) => value.value === title), { kind: "strong", value: title });
    }
    assert.deepEqual(steel.blocks.filter((value: any) => /^b[1-3]\)/u.test(value.text?.normalized ?? "")).map((value: any) => value.listLevel), [1, 1, 1]);
    const manifest = await json("corpus/assets/ntc2018/7.5-step1.json");
    const header = table(manifest, "7.5.I").headers[0];
    assert.deepEqual(header.map((cell: any) => cell.text), ["Classe di\nduttilità", "Valore di base q_0 del fattore di\ncomportamento", "Classe di sezione\ntrasversale richiesta"]);
});

test("NTC 7 user latest: 7.5.2.2 mantiene l’elenco con α_u/α_1 a destra", async () => {
    const unit = await json("corpus/units/ntc2018/7.5.2.2.json");
    const items = unit.blocks.filter((value: any) => value.kind === "list-item");
    assert.equal(items.length, 5);
    assert.equal(items.every((value: any) => value.listMarker === "dash" && value.listLevel === 1), true);
    assert.equal(items.every((value: any) => value.text.inline.at(-1).kind === "math"), true);
    assert.equal(items.every((value: any) => value.text.inline.at(-1).latex.startsWith("\\alpha_u/\\alpha_1=")), true);
});

test("NTC 7 user latest: liste labeled dopo [7.5.6] e [7.5.9] conservano tutti i simboli", async () => {
    for (const file of ["7.5.4.1.json", "7.5.4.2.json"]) {
        const unit = await json(`corpus/units/ntc2018/${file}`);
        const labels = unit.blocks.filter((value: any) => value.kind === "list-item" && value.listMarker === "none");
        assert.ok(labels.length >= 3, file);
        assert.ok(labels.some((value: any) => value.text.inline.filter((segment: any) => segment.kind === "math").length >= 3), file);
    }
});

test("NTC 7 user latest: Tab. 7.6.II e III e Tab. 7.8.II", async () => {
    const six = await json("corpus/assets/ntc2018/7.6-step1.json");
    const t62 = table(six, "7.6.II");
    assert.match(t62.headers[0][1].text, /\n\(x\/d\)limite$/u);
    assert.match(t62.headers[0][2].text, /\n\(x\/d\)limite$/u);
    const t63 = table(six, "7.6.III");
    assert.equal([...t63.headers, ...t63.rows].every((row: any[]) => !row[2] || row[2].align === "left"), true);
    const seven = await json("corpus/assets/ntc2018/7.7-78-step2.json");
    const t82 = table(seven, "7.8.II");
    assert.equal(t82.headers[0][0].text, "Accelerazione di picco\ndel terreno a_g S (1)");
    assert.match(t82.headers[0][0].latex, /Accelerazione di picco.*del terreno/su);
});

test("NTC 7 user latest: rimuove il punto isolato prima di 7.7.3.1", async () => {
    const unit = await json("corpus/units/ntc2018/7.7.3.json");
    assert.equal(unit.blocks.some((value: any) => value.text?.normalized === "."), false);
    assert.equal(unit.review.status, "verified");
});
