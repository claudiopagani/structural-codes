/* eslint-disable @typescript-eslint/no-explicit-any */
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../", import.meta.url));
const unitDir = join(repoRoot, "corpus", "units", "circ2019");

async function json(relativePath: string): Promise<any> {
    return JSON.parse(await readFile(join(repoRoot, relativePath), "utf8"));
}

async function c11Units(): Promise<any[]> {
    const names = (await readdir(unitDir)).filter((name) => name.startsWith("c11") && name.endsWith(".json"));
    return Promise.all(names.map((name) => readFile(join(unitDir, name), "utf8").then(JSON.parse)));
}

test("Circolare C11 contiene le 91 unità del perimetro PDF 314–341", async () => {
    const units = await c11Units();
    assert.equal(units.length, 91);
    const pages = units.flatMap((unit) => unit.blocks.map((block: any) => block.evidence.pdfPage));
    assert.equal(Math.min(...pages), 314);
    assert.equal(Math.max(...pages), 341);
    assert.equal(units.find((unit) => unit.numbering.official === "C11").kind, "chapter");
    assert.equal(units.find((unit) => unit.numbering.official === "C11.9.4").title, "DISPOSITIVI A COMPORTAMENTO LINEARE");
    assert.equal(units.find((unit) => unit.numbering.official === "C11.10.1.1.1.2").title, "Resistenza caratteristica a compressione degli elementi nella direzione ortogonale a quella dei carichi verticali e nel piano della muratura");
    assert.equal(units.some((unit) => unit.numbering.official === "C11.2.9"), false);
    for (const unit of units) {
        for (const block of unit.blocks) {
            if (block.text?.normalized) assert.doesNotMatch(block.text.normalized, /[\u0000-\u001F\u007F]/u);
        }
    }
});

test("Circolare C11 mantiene asset unici e riferimenti nella posizione editoriale", async () => {
    const units = await c11Units();
    const assetIds = units.flatMap((unit) => [
        ...unit.assets.formulaIds,
        ...unit.assets.tableIds,
        ...unit.assets.figureIds,
    ]);
    assert.equal(new Set(assetIds).size, assetIds.length);
    const step1 = await json("corpus/assets/circ2019/C11-step1.json");
    const step2 = await json("corpus/assets/circ2019/C11-step2.json");
    assert.equal(step1.formulas.length, 0);
    assert.equal(step2.formulas.length, 23);
    assert.equal(step2.tables.length, 2);
    assert.equal(step2.figures.length, 2);
    assert.equal(step2.tables[1].unitId, "urn:structural-codes:it:unit:circ2019:c11.3.4.11.2.1");
    assert.equal(units.find((unit) => unit.numbering.official === "C11.2.6").blocks.some((block: any) => block.kind === "table-ref"), true);
    assert.equal(units.find((unit) => unit.numbering.official === "C11.3.2.10.4").blocks.filter((block: any) => block.kind === "figure-ref").length, 2);
    assert.deepEqual(new Set(step2.formulas.concat(step2.tables, step2.figures).map((asset: any) => asset.id)), new Set(assetIds));
});

test("Circolare C11 pagine 324–333 conserva grandezze dell’acciaio e il gruppo di limitazioni", async () => {
    const step2 = await json("corpus/assets/circ2019/C11-step2.json");
    const limits = step2.formulas.find((asset: any) => asset.id.endsWith("c11.3.4.11.2.1.a"));
    assert.equal(limits.pdfPage, 332);
    assert.match(limits.latex, /t\\le8\\,\\mathrm\{mm\}/u);
    assert.match(limits.latex, /r\/t\\ge1\{,\}5/u);

    const numbers = ["c11.2.8", "c11.2.12", "c11.3.1.7", "c11.3.2.1", "c11.3.2.3", "c11.3.2.12", "c11.3.3.5.2.1", "c11.3.4.11.2.1"];
    const units = await Promise.all(numbers.map((number) => json(`corpus/units/circ2019/${number}.json`)));
    const latex = (unit: any): string[] => unit.blocks.flatMap((block: any) => block.text?.inline?.filter((segment: any) => segment.kind === "math").map((segment: any) => segment.latex) ?? []);
    const byNumber = new Map(units.map((unit) => [unit.numbering.official, unit]));

    assert.ok(latex(byNumber.get("C11.2.8")).includes("1{.}500\\,\\mathrm{m^3}"));
    assert.ok(latex(byNumber.get("C11.2.12")).includes("0.3\\%"));
    assert.ok(latex(byNumber.get("C11.3.2.1")).includes("\\left(f_t/f_y\\right)_k"));
    assert.ok(latex(byNumber.get("C11.3.2.3")).includes("100\\pm10\\,{}^\\circ\\mathrm{C}"));
    assert.ok(latex(byNumber.get("C11.3.2.12")).includes("0.94\\ \\left(f_{y,\\min}\\ge425\\,\\mathrm{N/mm^2}\\right)"));
    assert.ok(latex(byNumber.get("C11.3.3.5.2.1")).includes("r,\\,L,\\,D\\ \\text{e}\\ t"));
    assert.deepEqual(byNumber.get("C11.3.4.11.2.1").blocks.filter((block: any) => block.kind === "formula-ref").map((block: any) => block.assetId), [limits.id]);
});

test("Circolare C11 pagine 334–341 conserva display, inline e rimuove il rumore di fine documento", async () => {
    const step2 = await json("corpus/assets/circ2019/C11-step2.json");
    const formula = (suffix: string): any => step2.formulas.find((asset: any) => asset.id.endsWith(suffix));
    assert.equal(formula("c11.9.4.a").latex, "\\xi_e=\\frac{E_d}{2\\pi F\\,d}=\\frac{E_d}{2\\pi K_e\\,d^2}");
    assert.match(formula("c11.9.7.e").latex, /\\min\\left\[/u);
    assert.match(formula("c11.9.7.j").latex, /a\^2=\(\\alpha_x/u);
    assert.match(formula("c11.9.7.n").latex, /\\operatorname\{Max\}/u);
    assert.equal(formula("c11.10.1.1.1.1.c").latex, "\\delta=\\frac{s}{f_{bm}}\\quad=\\text{coefficiente di variazione};");

    const numbers = ["c11.7.10.2", "c11.9.4", "c11.9.5", "c11.9.6", "c11.9.7", "c11.9.7.1", "c11.10.1.1.1.1", "c11.10.1.1.1.2", "c11.10.3.2.1"];
    const units = await Promise.all(numbers.map((number) => json(`corpus/units/circ2019/${number}.json`)));
    const byNumber = new Map(units.map((unit) => [unit.numbering.official, unit]));
    const latex = (unit: any): string[] => unit.blocks.flatMap((block: any) => block.text?.inline?.filter((segment: any) => segment.kind === "math").map((segment: any) => segment.latex) ?? []);

    assert.equal(latex(byNumber.get("C11.7.10.2")).filter((value) => value.endsWith("\\%")).length, 4);
    assert.ok(latex(byNumber.get("C11.9.4")).includes("K_{in}"));
    assert.ok(latex(byNumber.get("C11.9.5")).includes("K_{2(i)}"));
    assert.ok(latex(byNumber.get("C11.9.6")).includes("\\pm2^\\circ"));
    assert.ok(latex(byNumber.get("C11.9.7")).includes("t_s\\ge2\\,\\mathrm{mm}"));
    assert.ok(latex(byNumber.get("C11.9.7")).includes("2000\\,\\mathrm{MPa}"));
    assert.ok(latex(byNumber.get("C11.9.7.1")).includes("G_{din}"));
    assert.ok(latex(byNumber.get("C11.10.1.1.1.1")).includes("\\delta>0.2"));
    assert.equal(byNumber.get("C11.10.1.1.1.1").blocks.some((block: any) => block.text?.normalized?.startsWith("= coefficiente di variazione")), false);
    assert.ok(latex(byNumber.get("C11.10.1.1.1.2")).includes("\\overline{f}_{bk}"));
    assert.equal(byNumber.get("C11.10.3.2.1").blocks.length, 2);
    assert.equal(byNumber.get("C11.10.3.2.1").blocks[1].text.normalized.endsWith(" G della muratura."), true);
});

test("Circolare C11 pagine 314–323 conserva formule e grandezze del calcestruzzo", async () => {
    const step2 = await json("corpus/assets/circ2019/C11-step2.json");
    const typeA = step2.formulas.find((asset: any) => asset.id.endsWith("c11.2.5.1.a"));
    const typeB = step2.formulas.find((asset: any) => asset.id.endsWith("c11.2.5.2.a"));
    assert.equal(typeA.latex, "\\begin{aligned}\\text{1)}\\quad &R_{c,\\min}\\ge R_{ck}-3{,}5\\\\\\text{2)}\\quad &R_{cm28}\\ge R_{ck}+3{,}5\\end{aligned}");
    assert.equal(typeB.latex, "\\begin{aligned}\\text{1)}\\quad &R_{c,\\min}\\ge R_{ck}-3{,}5\\\\\\text{2)}\\quad &R_{cm28}\\ge R_{ck}+1{,}48 * s\\end{aligned}");

    const c1121 = await json("corpus/units/circ2019/c11.2.1.json");
    const c1124 = await json("corpus/units/circ2019/c11.2.4.json");
    const c11251 = await json("corpus/units/circ2019/c11.2.5.1.json");
    const c11252 = await json("corpus/units/circ2019/c11.2.5.2.json");
    const c1126 = await json("corpus/units/circ2019/c11.2.6.json");
    const latex = (unit: any): string[] => unit.blocks.flatMap((block: any) => block.text?.inline?.filter((segment: any) => segment.kind === "math").map((segment: any) => segment.latex) ?? []);

    assert.deepEqual(c11251.blocks.filter((block: any) => block.kind === "formula-ref").map((block: any) => block.assetId), [typeA.id]);
    assert.deepEqual(c11252.blocks.filter((block: any) => block.kind === "formula-ref").map((block: any) => block.assetId), [typeB.id]);
    assert.ok(latex(c1121).includes("f_{ck}"));
    assert.equal(latex(c1124).filter((value) => value === "20\\%").length, 2);
    assert.ok(latex(c11252).includes("s/R_m"));
    assert.ok(latex(c1126).includes("f_{\\mathrm{carota}} * F_d = R_{c,is}"));
    assert.ok(latex(c1126).includes("f_{ck,is}"));
    assert.ok(latex(c1126).includes("85\\%"));

    for (const unit of [c1121, c1124, c11251, c11252, c1126]) {
        for (const block of unit.blocks) {
            assert.doesNotMatch(block.text?.normalized ?? "", /Àck|f ck|R m|m 3/u);
        }
    }
});
