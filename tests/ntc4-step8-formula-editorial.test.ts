import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = fileURLToPath(new URL("../", import.meta.url));
const formulaId = (number: string) => "urn:structural-codes:it:asset:formula:ntc2018:" + number;
const tableId = (number: string) => "urn:structural-codes:it:asset:table:ntc2018:" + number;

const expectedFormulas = new Map<string, string>([
    ["4.2.5", "\\frac{N_{Ed}}{N_{t,Rd}}\\le1"],
    ["4.2.6", "N_{pl,Rd}=\\frac{A f_{yk}}{\\gamma_{M0}}"],
    ["4.2.7", "N_{u,Rd}=\\frac{0{,}9\\cdot A_{net}\\cdot f_{tk}}{\\gamma_{M2}}"],
    ["4.2.8", "N_{pl,Rd}\\le N_{u,Rd}"],
    ["4.2.9", "\\frac{N_{Ed}}{N_{c,Rd}}\\le1"],
    ["4.2.10", "\\begin{aligned}N_{c,Rd}&=\\frac{A f_{yk}}{\\gamma_{M0}}&&\\text{per le sezioni di classe 1, 2 e 3}\\\\N_{c,Rd}&=\\frac{A_{eff}f_{yk}}{\\gamma_{M0}}&&\\text{per le sezioni di classe 4}\\end{aligned}"],
    ["4.2.11", "\\frac{M_{Ed}}{M_{c,Rd}}\\le1"],
    ["4.2.12", "M_{c,Rd}=M_{pl,Rd}=\\frac{W_{pl}\\cdot f_{yk}}{\\gamma_{M0}}\\quad\\text{per le sezioni di classe 1 e 2}"],
    ["4.2.13", "M_{c,Rd}=M_{el,Rd}=\\frac{W_{el,min}\\cdot f_{yk}}{\\gamma_{M0}}\\quad\\text{per le sezioni di classe 3}"],
    ["4.2.14", "M_{c,Rd}=\\frac{W_{eff,min}\\cdot f_{yk}}{\\gamma_{M0}}\\quad\\text{per le sezioni di classe 4}"],
    ["4.2.15", "\\frac{0{,}9\\cdot A_{f,net}\\cdot f_{tk}}{\\gamma_{M2}}\\ge\\frac{A_f\\cdot f_{yk}}{\\gamma_{M0}}"],
    ["4.2.16", "\\frac{V_{Ed}}{V_{c,Rd}}\\le1"],
    ["4.2.17", "V_{c,Rd}=\\frac{A_v\\cdot f_{yk}}{\\sqrt{3}\\cdot\\gamma_{M0}}"],
    ["4.2.18", "A_v=A-2bt_f+(t_w+2r)t_f"],
    ["4.2.19", "A_v=A-2bt_f+(t_w+r)t_f"],
    ["4.2.20", "A_v=A-\\sum(h_w\\cdot t_w)"],
    ["4.2.21", "A_v=0{,}9(A-bt_f)"],
    ["4.2.22", "A_v=\\frac{Ah}{b+h}\\quad\\text{quando il carico è parallelo all’altezza del profilo};\\qquad A_v=\\frac{Ab}{b+h}\\quad\\text{quando il carico è parallelo alla base del profilo}"],
    ["4.2.23", "A_v=\\frac{2A}{\\pi}"],
    ["4.2.24", "V_{c,Rd,red}=V_{c,Rd}\\sqrt{1-\\frac{\\tau_{t,Ed}}{1{,}25\\cdot f_{yk}/(\\sqrt{3}\\cdot\\gamma_{M0})}}"],
    ["4.2.25", "V_{c,Rd,red}=\\left[1-\\frac{\\tau_{t,Ed}}{f_{yk}/(\\sqrt{3}\\cdot\\gamma_{M0})}\\right]V_{c,Rd}"],
    ["4.2.26", "\\frac{\\tau_{t,Ed}}{f_{yk}/(\\sqrt{3}\\cdot\\gamma_{M0})}\\le1{,}0"],
    ["4.2.27", "\\frac{h_w}{t}>\\frac{72}{\\eta}\\sqrt{\\frac{235}{f_{yk}}}"],
    ["4.2.28", "\\frac{T_{Ed}}{T_{Rd}}\\le1{,}0"],
    ["4.2.29", "T_{Ed}=T_{t,Ed}+T_{w,Ed}"],
    ["4.2.30", "V_{Ed}\\le0{,}5\\,V_{c,Rd}"],
    ["4.2.31", "\\rho=\\left[\\frac{2V_{Ed}}{V_{c,Rd}}-1\\right]^2"],
    ["4.2.32", "M_{y,V,Rd}=\\frac{\\left[W_{pl,y}-\\frac{\\rho A_w^2}{4t_w}\\right]\\cdot f_{yk}}{\\gamma_{M0}}\\le M_{y,c,Rd}"],
    ["4.2.33", "M_{N,y,Rd}=M_{pl,y,Rd}\\frac{1-n}{1-0{,}5a}\\le M_{pl,y,Rd}"],
    ["4.2.34", "M_{N,z,Rd}=M_{pl,z,Rd}\\quad\\text{per }n\\le a"],
    ["4.2.35", "M_{N,z,Rd}=M_{pl,z,Rd}\\left[1-\\left(\\frac{n-a}{1-a}\\right)^2\\right]\\quad\\text{per }n>a"],
    ["4.2.36", "n=\\frac{N_{Ed}}{N_{pl,Rd}}"],
    ["4.2.37", "a=\\frac{A-2bt_f}{A}\\le0{,}5"],
    ["4.2.38", "\\left(\\frac{M_{y,Ed}}{M_{N,y,Rd}}\\right)^2+\\left(\\frac{M_{z,Ed}}{M_{N,z,Rd}}\\right)^{5n}\\le1"],
    ["4.2.39", "\\frac{M_{y,Ed}}{M_{N,y,Rd}}+\\frac{M_{z,Ed}}{M_{N,z,Rd}}\\le1"],
    ["4.2.40", "\\rho=\\left[\\frac{2V_{Ed}}{V_{c,Rd}}-1\\right]^2"],
    ["4.2.41", "\\frac{N_{Ed}}{N_{b,Rd}}\\le1"],
    ["4.2.42", "N_{b,Rd}=\\frac{\\chi A f_{yk}}{\\gamma_{M1}}\\quad\\text{per le sezioni di classe 1, 2 e 3}"],
    ["4.2.43", "N_{b,Rd}=\\frac{\\chi A_{eff}f_{yk}}{\\gamma_{M1}}\\quad\\text{per le sezioni di classe 4}"],
    ["4.2.44", "\\chi=\\frac{1}{\\Phi+\\sqrt{\\Phi^2-\\bar{\\lambda}^2}}\\le1"],
    ["4.2.45", "\\bar{\\lambda}=\\sqrt{\\frac{A\\cdot f_{yk}}{N_{cr}}}\\quad\\text{per le sezioni di classe 1, 2 e 3}"],
    ["4.2.46", "\\bar{\\lambda}=\\sqrt{\\frac{A_{eff}\\cdot f_{yk}}{N_{cr}}}\\quad\\text{per le sezioni di classe 4}"],
    ["4.2.47", "\\lambda=\\frac{l_0}{i}"],
    ["4.2.48", "\\frac{M_{Ed}}{M_{b,Rd}}\\le1"],
    ["4.2.49", "M_{b,Rd}=\\frac{\\chi_{LT}\\cdot W_y\\cdot f_{yk}}{\\gamma_{M1}}"],
    ["4.2.50", "\\chi_{LT}=\\frac{1}{f}\\cdot\\frac{1}{\\Phi_{LT}+\\sqrt{\\Phi_{LT}^2-\\beta\\cdot\\bar{\\lambda}_{LT}^2}}\\le K\\chi"],
    ["4.2.51", "\\bar{\\lambda}_{LT}=\\sqrt{\\frac{W_y\\cdot f_{yk}}{M_{cr}}}"],
    ["4.2.52", "f=1-0{,}5(1-k_c)[1-2{,}0(\\bar{\\lambda}_{LT}-0{,}8)^2]"],
    ["4.2.53", "K\\chi=\\min\\left(1,\\frac{1}{f\\cdot\\bar{\\lambda}_{LT}^2}\\right)"],
    ["4.2.54", "\\Delta_d\\le\\frac{\\Delta_R}{\\gamma_{Mf}}"],
    ["4.2.55", "\\Delta\\sigma_{max,d}=\\gamma_{Mf}\\cdot\\Delta\\sigma_{max}\\le\\Delta\\sigma_D"],
    ["4.2.56", "\\Delta\\tau_{max,d}=\\gamma_{Mf}\\cdot\\Delta\\tau_{max}\\le\\Delta\\tau_D=\\Delta\\tau_L"],
    ["4.2.57", "D=\\sum_i\\frac{n_i}{N_i}\\le1{,}0"],
    ["4.2.58", "T_{Ed}=T_{min}"],
    ["4.2.59", "T_{Ed}=T_{min}+15\\ ^\\circ\\mathrm{C}"],
    ["4.2.60", "\\delta_{tot}=\\delta_1+\\delta_2"],
].map(([number, latex]) => [formulaId(number!), latex!] as const));

async function json(path: string) {
    return JSON.parse(await readFile(join(root, path), "utf8"));
}

async function stepAssets() {
    const names = (await readdir(join(root, "corpus/assets/ntc2018"))).filter((name) => name.endsWith(".json"));
    const manifests = await Promise.all(names.map((name) => json("corpus/assets/ntc2018/" + name)));
    return {
        formulas: manifests.flatMap((manifest) => manifest.formulas ?? []).filter((formula: { pdfPage: number }) => formula.pdfPage >= 102 && formula.pdfPage <= 111),
        tables: manifests.flatMap((manifest) => manifest.tables ?? []).filter((table: { pdfPage: number }) => table.pdfPage >= 102 && table.pdfPage <= 111),
        figures: manifests.flatMap((manifest) => manifest.figures ?? []).filter((figure: { pdfPage: number }) => figure.pdfPage >= 102 && figure.pdfPage <= 111),
    };
}

test("NTC pagine 102–111 conserva esattamente le cinquantasei formule numerate", async () => {
    const { formulas } = await stepAssets();
    assert.equal(formulas.length, 56);
    assert.deepEqual(new Set(formulas.map((formula: { id: string }) => formula.id)), new Set(expectedFormulas.keys()));
    for (const formula of formulas as Array<{ id: string; latex: string }>) assert.equal(formula.latex, expectedFormulas.get(formula.id), formula.id);
});

test("NTC pagine 102–111 colloca ogni formula una sola volta e conserva gli inline", async () => {
    const { formulas, tables, figures } = await stepAssets();
    const unitIds = new Set(
        [...formulas, ...tables, ...figures]
            .map((asset: { unitId: string }) => asset.unitId.split(":").at(-1))
            .filter((number): number is string => number !== undefined),
    );
    const unitNames = (await readdir(join(root, "corpus/units/ntc2018"))).filter((name) => name.endsWith(".json"));
    const allUnits = await Promise.all(unitNames.map((name) => json("corpus/units/ntc2018/" + name)));
    const references = allUnits.flatMap((unit) => unit.blocks).filter((block: { kind: string }) => block.kind === "formula-ref").map((block: { assetId: string }) => block.assetId);
    for (const id of expectedFormulas.keys()) assert.equal(references.filter((candidate: string) => candidate === id).length, 1, id);

    for (const number of unitIds) {
        const unit = await json("corpus/units/ntc2018/" + number + ".json");
        for (const block of unit.blocks) {
            if (!block.text?.inline) continue;
            assert.equal(block.text.inline.map((segment: { value: string }) => segment.value).join(""), block.text.normalized, block.blockId);
            for (const segment of block.text.inline) {
                if (segment.kind !== "math") continue;
                assert.ok(!segment.latex.includes("\\\\"), `${block.blockId}: doppio backslash iniziale o interno`);
            }
        }
    }

    const shear = await json("corpus/units/ntc2018/4.2.4.1.2.4.json");
    const torsion = shear.blocks.find((block: { blockId: string }) => block.blockId.endsWith("editorial-013"));
    assert.equal(torsion.text.inline.find((segment: { kind: string }) => segment.kind === "math").latex, "\\tau_{t,Ed}");
    const compressed = await json("corpus/units/ntc2018/4.2.4.1.3.1.json");
    assert.equal(compressed.blocks.find((block: { blockId: string }) => block.blockId.endsWith("block-p7")).text.inline[1].latex, "\\Phi=0{,}5\\left[1+\\alpha(\\bar{\\lambda}-0{,}2)+\\bar{\\lambda}^2\\right]");
    const beams = await json("corpus/units/ntc2018/4.2.4.1.3.2.json");
    assert.ok(beams.blocks.find((block: { blockId: string }) => block.blockId.endsWith("block-p11")).text.inline.some((segment: { latex?: string }) => segment.latex === "K\\chi=1"));
});

test("NTC pagine 102–111 conserva struttura e matematica delle sette tabelle", async () => {
    const { tables } = await stepAssets();
    assert.deepEqual(tables.map((table: { officialNumber: string }) => table.officialNumber).sort(), ["4.2.VIII", "4.2.IX (a)", "4.2.IX (b)", "4.2.X", "4.2.XI", "4.2.XII", "4.2.XIII"].sort());

    const eighth = tables.find((table: { officialNumber: string }) => table.officialNumber === "4.2.VIII");
    assert.ok(eighth);
    assert.deepEqual(eighth.rows.slice(0, 4).map((row: Array<{ text: string }>) => row[1]?.text), ["h/b > 1,2; tf ≤ 40 mm", "h/b > 1,2; 40 mm < tf ≤ 100 mm", "h/b ≤ 1,2; tf ≤ 100 mm", "h/b ≤ 1,2; tf > 100 mm"]);
    assert.ok(eighth.rows.some((row: Array<{ text: string }>) => row[0]?.text === "Sezioni piene, ad U e T"));
    assert.ok(eighth.rows.some((row: Array<{ latex?: string }>) => row[1]?.latex === "a>0{,}5t_f;\\ b/t_f<30;\\ h/t_w<30"));

    const tenth = tables.find((table: { officialNumber: string }) => table.officialNumber === "4.2.X");
    assert.ok(tenth);
    assert.equal(tenth.rows.length, 8);
    assert.deepEqual(tenth.rows.slice(2).map((row: Array<{ text: string }>) => row[1]?.text), ["0,94", "0,90", "0,91", "0,86", "0,77", "0,82"]);
    const eleventh = tables.find((table: { officialNumber: string }) => table.officialNumber === "4.2.XI");
    assert.ok(eleventh);
    assert.deepEqual(eleventh.rows.flatMap((row: Array<{ latex?: string }>) => row.filter((cell) => cell.latex).map((cell) => cell.latex)), ["\\gamma_{Mf}=1{,}00", "\\gamma_{Mf}=1{,}15", "\\gamma_{Mf}=1{,}15", "\\gamma_{Mf}=1{,}35"]);
    for (const number of ["4.2.XII", "4.2.XIII"]) {
        const table = tables.find((candidate: { officialNumber: string }) => candidate.officialNumber === number);
        assert.ok(table);
        assert.ok([...table.headers, ...table.rows].flat().some((cell: { latex?: string }) => cell.latex?.startsWith("\\frac")), number);
    }
});

test("NTC 4.2.4.1.4 mantiene l’ordine PDF e i due capoversi omessi", async () => {
    const fatigue = await json("corpus/units/ntc2018/4.2.4.1.4.json");
    const sequence = fatigue.blocks.map((block: { assetId?: string; blockId: string }) => block.assetId ?? block.blockId.split("#").at(-1));
    assert.ok(sequence.indexOf(tableId("4.2.x")) < sequence.indexOf("block-p4"));
    assert.ok(sequence.indexOf("block-fatigue-curve") < sequence.indexOf(tableId("4.2.xi")));
    assert.ok(sequence.indexOf("block-fatigue-reference") < sequence.indexOf(tableId("4.2.xi")));
    assert.ok(sequence.indexOf(tableId("4.2.xi")) < sequence.indexOf(formulaId("4.2.55")));
    assert.match(fatigue.blocks.find((block: { blockId: string }) => block.blockId.endsWith("block-fatigue-curve")).text.normalized, /curva caratteristica, detta curva S-N/);
    assert.match(fatigue.blocks.find((block: { blockId: string }) => block.blockId.endsWith("block-fatigue-reference")).text.normalized, /UNI EN1993-1-9/);
});

test("NTC pagine 110–111 usa i due crop ufficiali con hash verificabile", async () => {
    const { figures } = await stepAssets();
    const expected = new Map([
        ["4.2.3", "ce801e5da49414dccea38fccb24c8b0e201713ba0e08a22f9f2441ae35133e50"],
        ["4.2.4", "19818cd8d7daa70248d700d929acc85d74e63aca8bcb7c01ad95b9a468eb966e"],
    ]);
    assert.deepEqual(figures.map((figure: { officialNumber: string }) => figure.officialNumber).sort(), [...expected.keys()].sort());
    for (const figure of figures as Array<{ officialNumber: string; imagePath: string; sha256: string }>) {
        assert.equal(figure.sha256, expected.get(figure.officialNumber));
        const bytes = await readFile(join(root, "corpus/assets", figure.imagePath));
        assert.equal(createHash("sha256").update(bytes).digest("hex"), figure.sha256);
    }
});
