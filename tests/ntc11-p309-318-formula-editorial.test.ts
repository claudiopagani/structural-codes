import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../", import.meta.url));
const numbers = [
    "11", "11.1", "11.2", "11.2.1", "11.2.2", "11.2.3", "11.2.4", "11.2.5",
    "11.2.5.1", "11.2.5.2", "11.2.5.3", "11.2.6", "11.2.7", "11.2.8", "11.2.9",
    "11.2.9.1", "11.2.9.2", "11.2.9.3", "11.2.9.4", "11.2.9.5", "11.2.9.6",
    "11.2.10", "11.2.10.1", "11.2.10.2", "11.2.10.3", "11.2.10.4", "11.2.10.5",
    "11.2.10.6", "11.2.10.7",
];

// Canonical JSON records intentionally contain heterogeneous block shapes.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function json(relativePath: string): Promise<any> {
    return JSON.parse(await readFile(join(repoRoot, relativePath), "utf8"));
}

test("NTC pagine 309–318 conserva le undici formule ufficiali", async () => {
    const step1 = await json("corpus/assets/ntc2018/11-step1.json");
    const step2 = await json("corpus/assets/ntc2018/11-step2.json");
    const formulas = [...step1.formulas, ...step2.formulas].filter(
        (formula: { pdfPage: number }) => formula.pdfPage >= 309 && formula.pdfPage <= 318,
    );

    assert.deepEqual(
        formulas.map((formula: { officialNumber: string; latex: string }) => [formula.officialNumber, formula.latex]),
        [
            ["11.2.1", "f_{ck}=0{,}83\\cdot R_{ck}"],
            ["11.2.2", "f_{cm}=f_{ck}+8\\;[\\mathrm{N/mm^2}]"],
            ["11.2.3a", "f_{ctm}=0{,}30\\cdot f_{ck}^{2/3}\\qquad\\text{per classi }\\le\\mathrm{C50/60}"],
            ["11.2.3b", "f_{ctm}=2{,}12\\cdot\\ln\\left[1+\\frac{f_{cm}}{10}\\right]\\qquad\\text{per classi }>\\mathrm{C50/60}"],
            ["11.2.4", "f_{cfm}=1{,}2\\,f_{ctm}"],
            ["11.2.5", "E_{cm}=22{.}000\\cdot\\left[\\frac{f_{cm}}{10}\\right]^{0{,}3}\\;[\\mathrm{N/mm^2}]"],
            ["11.2.6", "\\varepsilon_{cs}=\\varepsilon_{cd}+\\varepsilon_{ca}"],
            ["11.2.7", "\\varepsilon_{cd,\\infty}=k_h\\varepsilon_{c0}"],
            ["11.2.8", "\\varepsilon_{cd}(t)=\\beta_{ds}(t-t_s)\\cdot\\varepsilon_{cd,\\infty}"],
            ["11.2.9", "\\beta_{ds}(t-t_s)=\\frac{t-t_s}{(t-t_s)+0{,}04h_0^{3/2}}"],
            ["11.2.10", "\\varepsilon_{ca,\\infty}=-2{,}5\\cdot(f_{ck}-10)\\cdot10^{-6}"],
        ],
    );
});

test("NTC pagine 309–318 struttura integralmente le otto tabelle", async () => {
    const step1 = await json("corpus/assets/ntc2018/11-step1.json");
    const step2 = await json("corpus/assets/ntc2018/11-step2.json");
    const tables = [...step1.tables, ...step2.tables].filter(
        (table: { pdfPage: number }) => table.pdfPage >= 309 && table.pdfPage <= 318,
    );

    assert.deepEqual(
        tables.map((table: { officialNumber: string; columnCount: number; rows: unknown[] }) => [table.officialNumber, table.columnCount, table.rows.length]),
        [
            ["11.2.I", 2, 3], ["11.2.II", 3, 1], ["11.2.III", 3, 6], ["11.2.IV", 1, 6],
            ["11.2.Va", 7, 4], ["11.2.Vb", 2, 4], ["11.2.VI", 5, 5], ["11.2.VII", 5, 5],
        ],
    );
    const tableVa = tables.find((table: { officialNumber: string }) => table.officialNumber === "11.2.Va");
    const tableVb = tables.find((table: { officialNumber: string }) => table.officialNumber === "11.2.Vb");
    const tableVI = tables.find((table: { officialNumber: string }) => table.officialNumber === "11.2.VI");
    assert.deepEqual(tableVa.rows[0].map((cell: { text: string }) => cell.text), ["20", "-0,62", "-0,58", "-0,49", "-0,30", "-0,17", "+0,00"]);
    assert.deepEqual(tableVb.rows.at(-1).map((cell: { text: string }) => cell.text), ["≥ 500", "0,70"]);
    assert.deepEqual(tableVI.rows.at(-1).map((cell: { text: string }) => cell.text), ["≥ 60 giorni", "2,0", "1,8", "1,7", "1,6"]);
    assert.doesNotMatch(JSON.stringify(tables), /TABELLA_DA_VERIFICARE|[ǈΚǂǃ]/u);
});

test("NTC pagine 309–318 conserva gli inline completi e rimuove i residui OCR", async () => {
    const units = await Promise.all(numbers.map((number) => json(`corpus/units/ntc2018/${number}.json`)));
    const scopedBlocks = units.flatMap((unit) => unit.blocks.filter(
        (block: { evidence: { pdfPage: number } }) => block.evidence.pdfPage >= 309 && block.evidence.pdfPage <= 318,
    ));
    const normalized = scopedBlocks.map((block: { text?: { normalized?: string } }) => block.text?.normalized ?? "").join(" ");
    const inlineLatex = scopedBlocks.flatMap(
        (block: { text?: { inline?: Array<{ kind: string; latex?: string }> } }) =>
            block.text?.inline?.filter((segment) => segment.kind === "math").map((segment) => segment.latex) ?? [],
    );

    for (const latex of [
        "s/R_m", "R_{ckis}", "f_{ckis}", "85\\%", "0{,}7f_{ctm}", "1{,}3f_{ctm}",
        "0{,}40f_{cm}", "10\\times10^{-6}\\;{}^\\circ\\mathrm{C}^{-1}", "2A_c/u",
        "\\varepsilon_{ca,\\infty}", "\\phi(\\infty,t_0)",
    ]) assert.ok(inlineLatex.includes(latex), `inline mancante: ${latex}`);
    assert.doesNotMatch(normalized, /(?:s\/R m|f ckj|εca,ǈ|Κ \(|ǂ|ǃ|N\/mm2|10 x 10-6)/u);
    assert.doesNotMatch(normalized, /(?:Umidità Relativa \(in %\) 20 40|t 0 h0)/u);
});

test("NTC pagine 309–318 colloca ogni asset una sola volta", async () => {
    const units = await Promise.all(numbers.map((number) => json(`corpus/units/ntc2018/${number}.json`)));
    const references = units.flatMap((unit) => unit.blocks.map((block: { assetId?: string }) => block.assetId).filter(Boolean));
    const declared = units.flatMap((unit) => [
        ...unit.assets.formulaIds,
        ...unit.assets.tableIds,
        ...unit.assets.figureIds,
    ]);
    assert.equal(references.length, 19);
    assert.deepEqual(new Set(references), new Set(declared));
    assert.equal(new Set(references).size, references.length);
});
