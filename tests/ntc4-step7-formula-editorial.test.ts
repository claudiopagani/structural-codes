import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = fileURLToPath(new URL("../", import.meta.url));
const formulaId = (number: string) => "urn:structural-codes:it:asset:formula:ntc2018:" + number;
const expectedFormulas = new Map<string, string>([
    [formulaId("4.1.50:4.1.11.1"), "N_{Ed}\\le N_{Rd}=f_{cd}b x"],
    [formulaId("4.1.11.1:shear"), "V_{Ed}\\le V_{Rd}=f_{cvd}b x/1{,}5"],
    [formulaId("4.1.11.1:shear-strength"), "\\begin{aligned}f_{cvd}&=\\sqrt{f_{ct1d}^{2}+\\sigma_c f_{ct1d}}&&\\text{per }\\sigma_c\\le\\sigma_{clim}\\\\f_{cvd}&=\\sqrt{f_{ct1d}^{2}+\\sigma_c f_{ct1d}-\\delta^{2}/4}&&\\text{per }\\sigma_c>\\sigma_{clim}\\end{aligned}"],
    [formulaId("4.1.11.1:shear-parameters"), "\\begin{aligned}\\sigma_c&=N_{Ed}/(b x)\\\\\\delta&=\\sigma_c-\\sigma_{clim}\\\\\\sigma_{clim}&=f_{cd}-2\\sqrt{f_{ct1d}^{2}+f_{cd}f_{ct1d}}\\end{aligned}"],
    [formulaId("4.1.11.1:tensile-strength"), "f_{ct1d}=0{,}85f_{ctd}"],
    [formulaId("4.1.50:4.1.12.1"), "f_{lctd}=0{,}85f_{lctk}/\\gamma_c"],
    [formulaId("4.2.0"), "C_{\\vartheta}=\\vartheta_r/\\vartheta_y-1"],
    [formulaId("4.2.1"), "\\begin{aligned}\\alpha_{cr}&=\\frac{F_{cr}}{F_{Ed}}\\ge10&&\\text{per l’analisi elastica}\\\\\\alpha_{cr}&=\\frac{F_{cr}}{F_{Ed}}\\ge15&&\\text{per l’analisi plastica}\\end{aligned}"],
    [formulaId("4.2.2"), "H_{Ed}\\ge0{,}15\\cdot Q_{Ed}"],
    [formulaId("4.2.3"), "R_d=\\frac{R_k}{\\gamma_M}"],
    [formulaId("4.2.4"), "\\sigma_{x,Ed}^2+\\sigma_{z,Ed}^2-\\sigma_{x,Ed}\\sigma_{z,Ed}+3\\tau_{Ed}^2\\le\\left(\\frac{f_{yk}}{\\gamma_{M0}}\\right)^2"],
]);

const expectedTableLatex = new Map<string, string[]>([
    ["4.2.I", ["t\\le40\\,\\mathrm{mm}", "40\\,\\mathrm{mm}<t\\le80\\,\\mathrm{mm}", "f_{yk}\\,[\\mathrm{N/mm^2}]", "f_{tk}\\,[\\mathrm{N/mm^2}]", "f_{yk}\\,[\\mathrm{N/mm^2}]", "f_{tk}\\,[\\mathrm{N/mm^2}]"]],
    ["4.2.II", ["t\\le40\\,\\mathrm{mm}", "40\\,\\mathrm{mm}<t\\le80\\,\\mathrm{mm}", "f_{yk}\\,[\\mathrm{N/mm^2}]", "f_{tk}\\,[\\mathrm{N/mm^2}]", "f_{yk}\\,[\\mathrm{N/mm^2}]", "f_{tk}\\,[\\mathrm{N/mm^2}]"]],
    ["4.2.III", ["c/t\\le72\\varepsilon", "c/t\\le33\\varepsilon", "\\text{quando }\\alpha>0{,}5:\\ c/t\\le\\frac{396\\varepsilon}{13\\alpha-1};\\quad\\text{quando }\\alpha\\le0{,}5:\\ c/t\\le\\frac{36\\varepsilon}{\\alpha}", "c/t\\le83\\varepsilon", "c/t\\le38\\varepsilon", "\\text{quando }\\alpha>0{,}5:\\ c/t\\le\\frac{456\\varepsilon}{13\\alpha-1};\\quad\\text{quando }\\alpha\\le0{,}5:\\ c/t\\le\\frac{41{,}5\\varepsilon}{\\alpha}", "c/t\\le124\\varepsilon", "c/t\\le42\\varepsilon", "\\text{quando }\\psi>-1:\\ c/t\\le\\frac{42\\varepsilon}{0{,}67+0{,}33\\psi};\\quad\\text{quando }\\psi\\le-1:\\ c/t\\le62\\varepsilon(1-\\psi)\\sqrt{-\\psi}", "\\varepsilon=\\sqrt{235/f_{yk}}", "f_{yk}", "\\varepsilon"]],
    ["4.2.IV", ["c/t\\le9\\varepsilon", "c/t\\le\\frac{9\\varepsilon}{\\alpha}", "c/t\\le\\frac{9\\varepsilon}{\\alpha\\sqrt{\\alpha}}", "c/t\\le10\\varepsilon", "c/t\\le\\frac{10\\varepsilon}{\\alpha}", "c/t\\le\\frac{10\\varepsilon}{\\alpha\\sqrt{\\alpha}}", "c/t\\le14\\varepsilon", "c/t\\le21\\varepsilon\\sqrt{k_e}\\quad\\text{Per }k_e\\text{ vedere EN 1993-1-5}", "\\varepsilon=\\sqrt{235/f_{yk}}", "f_{yk}", "\\varepsilon"]],
    ["4.2.V", ["h/t\\le15\\varepsilon;\\quad\\frac{b+h}{2t}\\le11{,}5\\varepsilon", "d/t\\le50\\varepsilon^2", "d/t\\le70\\varepsilon^2", "d/t\\le90\\varepsilon^2\\quad(\\text{Per }d/t>90\\varepsilon^2\\text{ vedere EN 1993-1-6})", "\\varepsilon=\\sqrt{235/f_{yk}}", "f_{yk}\\quad235\\quad275\\quad355\\quad420\\quad460", "\\varepsilon\\quad1{,}00\\quad0{,}92\\quad0{,}81\\quad0{,}75\\quad0{,}71;\\quad\\varepsilon^2\\quad1{,}00\\quad0{,}85\\quad0{,}66\\quad0{,}56\\quad0{,}51"]],
    ["4.2.VI", []],
    ["4.2.VII", ["\\gamma_{M0}=1{,}05", "\\gamma_{M1}=1{,}05", "\\gamma_{M1}=1{,}10", "\\gamma_{M2}=1{,}25"]],
]);

async function json(path: string) {
    return JSON.parse(await readFile(join(root, path), "utf8"));
}

test("NTC pagine 92–101 conserva esattamente gli undici gruppi formula ufficiali", async () => {
    const assetNames = (await readdir(join(root, "corpus/assets/ntc2018"))).filter((name) => name.endsWith(".json"));
    const manifests = await Promise.all(assetNames.map((name) => json("corpus/assets/ntc2018/" + name)));
    const formulas = manifests.flatMap((manifest) => manifest.formulas ?? []).filter((formula: { pdfPage: number }) => formula.pdfPage >= 92 && formula.pdfPage <= 101);
    assert.equal(formulas.length, 11);
    assert.deepEqual(new Set(formulas.map((formula: { id: string }) => formula.id)), new Set(expectedFormulas.keys()));
    for (const formula of formulas as Array<{ id: string; latex: string }>) assert.equal(formula.latex, expectedFormulas.get(formula.id), formula.id);
});

test("NTC pagine 92–101 colloca ogni formula una sola volta e separa i gruppi a taglio", async () => {
    const names = (await readdir(join(root, "corpus/units/ntc2018"))).filter((name) => name.endsWith(".json"));
    const units = await Promise.all(names.map((name) => json("corpus/units/ntc2018/" + name)));
    const ids = units.flatMap((unit) => unit.blocks).filter((block: { kind: string }) => block.kind === "formula-ref").map((block: { assetId: string }) => block.assetId);
    for (const id of expectedFormulas.keys()) assert.equal(ids.filter((candidate: string) => candidate === id).length, 1, id);

    const shear = await json("corpus/units/ntc2018/4.1.11.1.json");
    assert.deepEqual(shear.blocks.slice(5, 12).map((block: { kind: string; text?: { normalized: string } }) => block.kind === "formula-ref" ? "formula-ref" : block.text?.normalized), ["formula-ref", "con", "formula-ref", "dove", "formula-ref", "dove", "formula-ref"]);
    assert.deepEqual(shear.assets.formulaIds, [formulaId("4.1.50:4.1.11.1"), formulaId("4.1.11.1:shear"), formulaId("4.1.11.1:shear-strength"), formulaId("4.1.11.1:shear-parameters"), formulaId("4.1.11.1:tensile-strength")]);
});

test("NTC pagine 92–101 conserva tutte le celle matematiche delle sette tabelle", async () => {
    const assetNames = (await readdir(join(root, "corpus/assets/ntc2018"))).filter((name) => name.endsWith(".json"));
    const manifests = await Promise.all(assetNames.map((name) => json("corpus/assets/ntc2018/" + name)));
    const tables = manifests.flatMap((manifest) => manifest.tables ?? []).filter((table: { pdfPage: number }) => table.pdfPage >= 92 && table.pdfPage <= 101);
    assert.deepEqual(tables.map((table: { officialNumber: string }) => table.officialNumber).sort(), [...expectedTableLatex.keys()].sort());
    for (const table of tables) {
        const latex = [...table.headers, ...table.rows].flat().filter((cell: { latex?: string }) => cell.latex).map((cell: { latex: string }) => cell.latex);
        assert.deepEqual(latex, expectedTableLatex.get(table.officialNumber), table.officialNumber);
    }
    const first = tables.find((table: { officialNumber: string }) => table.officialNumber === "4.2.I");
    const second = tables.find((table: { officialNumber: string }) => table.officialNumber === "4.2.II");
    assert.ok(first);
    assert.ok(second);
    assert.equal(first.rows.length, 19);
    const s460 = first.rows.find((row: Array<{ text: string }>) => row[0]?.text === "S460 Q/QL/QL1");
    assert.ok(s460);
    assert.deepEqual(s460.map((cell: { text: string }) => cell.text), ["S460 Q/QL/QL1", "460", "570", "440", "580"]);
    assert.equal(second.rows.length, 19);
    const last = second.rows.at(-1);
    assert.ok(last);
    assert.deepEqual(last.map((cell: { text: string }) => cell.text), ["S460 NH/NHL", "460", "550", "", ""]);
});

test("NTC pagine 92–101 usa segmenti matematici completi e il glifo vartheta ufficiale", async () => {
    const units = ["4.1.9.1", "4.1.10", "4.1.10.1", "4.1.10.2.2", "4.1.10.3", "4.1.10.5.1", "4.1.11.1", "4.1.12", "4.1.12.1", "4.1.13", "4.2.1.1", "4.2.1.4", "4.2.3.1", "4.2.3.4", "4.2.3.5", "4.2.4.1.1", "4.2.4.1.2"];
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
    const classification = await json("corpus/units/ntc2018/4.2.3.1.json");
    assert.equal(classification.blocks.find((block: { blockId: string }) => block.blockId.endsWith("editorial-001")).text.inline[1].latex, "C_{\\vartheta}");
    assert.equal(classification.blocks.find((block: { blockId: string }) => block.blockId.endsWith("editorial-003")).text.inline[1].latex, "\\vartheta_r");
});

test("NTC §4.1.10.2 ricompone la continuazione della seconda voce", async () => {
    const unit = await json("corpus/units/ntc2018/4.1.10.2.json");
    const second = unit.blocks.find((block: { blockId: string }) => block.blockId.endsWith("#block-editorial-003"));
    assert.equal(second.kind, "list-item");
    assert.equal(second.text.normalized, "i componenti per i quali è stata rilasciata la certificazione di idoneità ai sensi degli articoli 1 e 7 della legge 2 febbraio 1974 n. 64;");
    assert.equal(second.text.raw.endsWith("n.\n64;"), true);
    assert.equal(unit.blocks.some((block: { blockId: string }) => block.blockId.endsWith("#block-editorial-004")), false);
});

test("NTC §4.1.10.1 separa serie controllata dal paragrafo successivo", async () => {
    const unit = await json("corpus/units/ntc2018/4.1.10.1.json");
    const controlledSeries = unit.blocks.find((block: { blockId: string }) => block.blockId.endsWith("#block-editorial-003"));
    const paragraph = unit.blocks.find((block: { blockId: string }) => block.blockId.endsWith("#block-editorial-003-1"));
    assert.equal(controlledSeries.kind, "list-item");
    assert.equal(controlledSeries.text.normalized, "serie controllata");
    assert.equal(paragraph.kind, "paragraph");
    assert.equal(paragraph.text.normalized.startsWith("I componenti per i quali non sia applicabile"), true);
    assert.equal(unit.blocks.indexOf(paragraph), unit.blocks.indexOf(controlledSeries) + 1);
});
