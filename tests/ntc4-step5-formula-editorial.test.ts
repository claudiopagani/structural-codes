import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = fileURLToPath(new URL("../", import.meta.url));
const formulaId = (number: string) => "urn:structural-codes:it:asset:formula:ntc2018:" + number;
type TableCell = { text: string; latex?: string; colSpan?: number; rowSpan?: number };
type Table = { officialNumber: string; caption: string; headers: TableCell[][]; rows: TableCell[][] };
const expected = new Map<string, string>([
    [formulaId("4.1.1"), "\\delta\\ge0{,}44+1{,}25\\cdot(0{,}6+0{,}0014/\\varepsilon_{cu})x/d\\qquad\\text{per }f_{ck}\\le50\\,\\mathrm{MPa}"],
    [formulaId("4.1.2"), "\\delta\\ge0{,}54+1{,}25\\cdot(0{,}6+0{,}0014/\\varepsilon_{cu})x/d\\qquad\\text{per }f_{ck}>50\\,\\mathrm{MPa}"],
    [formulaId("4.1.3"), "f_{cd}=\\alpha_{cc}f_{ck}/\\gamma_c"],
    [formulaId("4.1.4"), "f_{ctd}=f_{ctk}/\\gamma_c"],
    [formulaId("4.1.5"), "f_{yd}=f_{yk}/\\gamma_s"],
    [formulaId("4.1.6"), "f_{bd}=f_{bk}/\\gamma_c"],
    [formulaId("4.1.7"), "f_{bk}=2{,}25\\cdot\\eta_1\\cdot\\eta_2\\cdot f_{ctk}"],
    [formulaId("4.1.2.1.2.1:material-parameters-up-to-c50-60"), "\\begin{aligned}\\varepsilon_{c2}&=0{,}20\\% & \\varepsilon_{cu}&=0{,}35\\% \\\\ \\varepsilon_{c3}&=0{,}175\\% & \\varepsilon_{c4}&=0{,}07\\%\\end{aligned}"],
    [formulaId("4.1.2.1.2.1:material-parameters-over-c50-60"), "\\begin{aligned}\\varepsilon_{c2}&=0{,}20\\%+0{,}0085\\%(f_{ck}-50)^{0{,}53} & \\varepsilon_{cu}&=0{,}26\\%+3{,}5\\%[(90-f_{ck})/100]^4 \\\\ \\varepsilon_{c3}&=0{,}175\\%+0{,}055\\%[(f_{ck}-50)/40] & \\varepsilon_{c4}&=0{,}2\\cdot\\varepsilon_{cu}\\end{aligned}"],
    [formulaId("4.1.8"), "f_{ck,c}=f_{ck}\\cdot(1{,}0+5{,}0\\cdot\\sigma_2/f_{ck})\\qquad\\text{per }\\sigma_2\\le0{,}05f_{ck}"],
    [formulaId("4.1.9"), "f_{ck,c}=f_{ck}\\cdot(1{,}125+2{,}5\\cdot\\sigma_2/f_{ck})\\qquad\\text{per }\\sigma_2>0{,}05f_{ck}"],
    [formulaId("4.1.10"), "\\varepsilon_{c2,c}=\\varepsilon_{c2}\\cdot(f_{ck,c}/f_{ck})^2"],
    [formulaId("4.1.11"), "\\varepsilon_{cu2,c}=\\varepsilon_{cu}+0{,}2\\cdot\\sigma_2/f_{ck}"],
    [formulaId("4.1.12"), "f_{cd,c}=\\alpha_{cc}\\cdot f_{ck,c}/\\gamma_c"],
    [formulaId("4.1.12.a"), "\\sigma_2=\\alpha\\cdot\\sigma_l"],
    [formulaId("4.1.12.b"), "\\sigma_{l,x}=\\frac{A_{st,x}\\cdot f_{yk,st}}{b_y\\cdot s};\\qquad\\sigma_{l,y}=\\frac{A_{st,y}\\cdot f_{yk,st}}{b_x\\cdot s}"],
    [formulaId("4.1.12.c"), "\\sigma_l=\\sqrt{\\sigma_{l,x}\\cdot\\sigma_{l,y}}"],
    [formulaId("4.1.12.d"), "\\sigma_l=\\frac{2A_{st}\\cdot f_{yk,st}}{D_0\\cdot s}"],
    [formulaId("4.1.12.e"), "\\alpha=\\alpha_n\\cdot\\alpha_s"],
    [formulaId("4.1.12.f"), "\\alpha_n=1-\\sum_n b_i^2/(6\\cdot b_x\\cdot b_y)"],
    [formulaId("4.1.12.g"), "\\alpha_s=[1-s/(2\\cdot b_x)]\\cdot[1-s/(2\\cdot b_y)]"],
    [formulaId("4.1.12.h"), "\\alpha_n=1"],
    [formulaId("4.1.12.i"), "\\alpha_s=[1-s/(2\\cdot D_0)]^\\beta"],
    [formulaId("4.1.13"), "\\sigma_t=\\frac{f_{ctm}}{1{,}2}"],
    [formulaId("4.1.2.2.4:crack-widths"), "w_1=0{,}2\\,\\mathrm{mm}\\qquad w_2=0{,}3\\,\\mathrm{mm}\\qquad w_3=0{,}4\\,\\mathrm{mm}"],
    [formulaId("4.1.14"), "w_k=1{,}7\\,\\varepsilon_{sm}\\Delta_{sm}"],
    [formulaId("4.1.15"), "\\sigma_{c,\\max}\\le0{,}60f_{ck}\\qquad\\text{per combinazione caratteristica}"],
    [formulaId("4.1.16"), "\\sigma_{c,\\max}\\le0{,}45f_{ck}\\qquad\\text{per combinazione quasi permanente}"],
    [formulaId("4.1.17"), "\\sigma_{s,\\max}\\le0{,}8f_{yk}"],
]);

async function json(path: string) {
    return JSON.parse(await readFile(join(root, path), "utf8"));
}

test("NTC pagine 72–81 conserva esattamente tutte le 29 formule display", async () => {
    const manifest = await json("corpus/assets/ntc2018/4.1.json");
    const formulas = manifest.formulas.filter((formula: { pdfPage: number }) => formula.pdfPage >= 72 && formula.pdfPage <= 81);
    assert.equal(formulas.length, 29);
    assert.deepEqual(new Set(formulas.map((formula: { id: string }) => formula.id)), new Set(expected.keys()));
    for (const formula of formulas as Array<{ id: string; latex: string }>) {
        assert.equal(formula.latex, expected.get(formula.id), formula.id);
    }
});

test("NTC pagine 72–81 colloca ogni formula una sola volta nel corpus", async () => {
    const names = (await readdir(join(root, "corpus/units/ntc2018"))).filter((name) => name.endsWith(".json"));
    const units = await Promise.all(names.map((name) => json("corpus/units/ntc2018/" + name)));
    const ids = units.flatMap((unit) => unit.blocks)
        .filter((block: { kind: string }) => block.kind === "formula-ref")
        .map((block: { assetId: string }) => block.assetId);
    for (const id of expected.keys()) assert.equal(ids.filter((candidate: string) => candidate === id).length, 1, id);
});

test("NTC pagine 72–81 usa segmenti matematici completi e non marca lettere discorsive", async () => {
    const units = ["4.1", "4.1.1", "4.1.1.1", "4.1.2.1.1.1", "4.1.2.1.1.2", "4.1.2.1.1.3", "4.1.2.1.1.4", "4.1.2.1.2.1", "4.1.2.1.2.2", "4.1.2.2.2", "4.1.2.2.4", "4.1.2.2.4.5"];
    for (const number of units) {
        const unit = await json("corpus/units/ntc2018/" + number + ".json");
        for (const block of unit.blocks) {
            if (!block.text?.inline) continue;
            assert.equal(block.text.inline.map((segment: { value: string }) => segment.value).join(""), block.text.normalized, block.blockId);
            for (const segment of block.text.inline) {
                if (segment.kind !== "math") continue;
                assert.notEqual(segment.value, "/", block.blockId);
                assert.notEqual(segment.value, "=", block.blockId);
            }
        }
    }
    const bond = await json("corpus/units/ntc2018/4.1.2.1.1.4.json");
    assert.equal(bond.blocks.filter((block: { kind: string }) => block.kind === "formula-ref").length, 2);
    assert.equal(bond.blocks.at(-1).text.normalized.startsWith("La lunghezza di ancoraggio"), true);
    const steel = await json("corpus/units/ntc2018/4.1.2.1.2.2.json");
    assert.equal(steel.blocks[1].text.inline[1].latex, "\\varepsilon_{ud}=0{,}9\\varepsilon_{uk}");
    assert.equal(steel.blocks[1].text.inline[7].latex, "k=(f_t/f_y)_k");
    const analysis = await json("corpus/units/ntc2018/4.1.1.1.json");
    assert.equal(analysis.blocks.find((block: { blockId: string }) => block.blockId.endsWith("editorial-005")).text.inline, undefined);
    const deformation = await json("corpus/units/ntc2018/4.1.2.2.2.json");
    assert.equal(deformation.blocks[1].text.inline, undefined);

    const compression = await json("corpus/units/ntc2018/4.1.2.1.1.1.json");
    const fck = compression.blocks.find((block: { blockId: string }) => block.blockId.endsWith("editorial-006"));
    assert.deepEqual(fck.text.inline.filter((segment: { kind: string }) => segment.kind === "math"), [
        { kind: "math", value: "fck", latex: "f_{ck}" },
    ]);

    const tension = await json("corpus/units/ntc2018/4.1.2.1.1.2.json");
    const fctk = tension.blocks.find((block: { blockId: string }) => block.blockId.endsWith("editorial-005"));
    const reduction = tension.blocks.find((block: { blockId: string }) => block.blockId.endsWith("editorial-007"));
    assert.deepEqual(fctk.text.inline.filter((segment: { kind: string }) => segment.kind === "math"), [
        { kind: "math", value: "fctk", latex: "f_{ctk}" },
    ]);
    assert.deepEqual(reduction.text.inline.filter((segment: { kind: string }) => segment.kind === "math"), [
        { kind: "math", value: "0,80fctd", latex: "0{,}80f_{ctd}" },
    ]);
    assert.equal(compression.blocks.some((block: { text?: { normalized: string } }) => /f ck/u.test(block.text?.normalized ?? "")), false);
    assert.equal(tension.blocks.some((block: { text?: { normalized: string } }) => /f ctk/u.test(block.text?.normalized ?? "")), false);
});

test("NTC Tabelle 4.1.I–IV conserva titoli, griglie e matematica delle celle", async () => {
    const manifest = await json("corpus/assets/ntc2018/4.1.json");
    const tables = manifest.tables.filter((table: { officialNumber: string | null }) => typeof table.officialNumber === "string" && ["4.1.I", "4.1.II", "4.1.III", "4.1.IV"].includes(table.officialNumber)) as Table[];
    assert.deepEqual(tables.map((table: { officialNumber: string }) => table.officialNumber), ["4.1.I", "4.1.II", "4.1.III", "4.1.IV"]);
    const byNumber = new Map<string, Table>(tables.map((table) => [table.officialNumber, table]));
    const get = (number: string): Table => {
        const table = byNumber.get(number);
        assert.ok(table);
        return table;
    };
    assert.equal(get("4.1.I").rows.length, 15);
    assert.equal(get("4.1.II").caption, "Impiego delle diverse classi di resistenza");
    assert.equal(get("4.1.II").headers[0]![1]!.text, "Classe di resistenza minima");
    assert.equal(get("4.1.III").caption, "Descrizione delle condizioni ambientali");
    assert.equal(get("4.1.IV").headers[0]![3]!.colSpan, 4);
    assert.equal(get("4.1.IV").headers[2]![1]!.latex, "w_k");
    assert.equal(get("4.1.IV").rows[0]![4]!.latex, "\\le w_2");
    assert.equal(get("4.1.IV").rows[5]!.at(-1)!.latex, "\\le w_1");
});
