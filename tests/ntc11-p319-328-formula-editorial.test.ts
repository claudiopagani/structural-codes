import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../", import.meta.url));
const numbers = [
    "11.2.10.7", "11.2.11", "11.2.12", "11.3", "11.3.1", "11.3.1.1", "11.3.1.2",
    "11.3.1.3", "11.3.1.4", "11.3.1.5", "11.3.1.6", "11.3.1.7", "11.3.2",
    "11.3.2.1", "11.3.2.2", "11.3.2.3", "11.3.2.4", "11.3.2.5", "11.3.2.5.1",
    "11.3.2.6", "11.3.2.7", "11.3.2.8", "11.3.2.8.1", "11.3.2.8.2", "11.3.2.9",
    "11.3.2.10", "11.3.2.10.1", "11.3.2.10.1.1", "11.3.2.10.1.2",
    "11.3.2.10.1.3", "11.3.2.10.1.4", "11.3.2.10.2", "11.3.2.10.3",
];

// Canonical JSON records intentionally contain heterogeneous block shapes.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function json(relativePath: string): Promise<any> {
    return JSON.parse(await readFile(join(repoRoot, relativePath), "utf8"));
}

test("NTC pagine 319–328 conserva le quattro formule ufficiali", async () => {
    const manifest = await json("corpus/assets/ntc2018/11-step2.json");
    const formulas = manifest.formulas.filter(
        (formula: { pdfPage: number }) => formula.pdfPage >= 319 && formula.pdfPage <= 328,
    );
    assert.deepEqual(
        formulas.map((formula: { officialNumber: string; latex: string }) => [formula.officialNumber, formula.latex]),
        [
            ["11.3.1", "\\frac{\\varnothing_{\\min}}{\\varnothing_{\\max}}\\ge0{,}6"],
            ["11.3.2", "C_{eq}=C+\\frac{Mn}{6}+\\frac{Cr+Mo+V}{5}+\\frac{Ni+Cu}{15}"],
            ["11.3.3", "\\bar{x}-ks\\ge C_v"],
            ["11.3.4", "\\bar{x}+ks\\le C_v"],
        ],
    );
});

test("NTC pagine 319–328 struttura integralmente le otto tabelle", async () => {
    const manifest = await json("corpus/assets/ntc2018/11-step2.json");
    const tables = manifest.tables.filter(
        (table: { pdfPage: number }) => table.pdfPage >= 319 && table.pdfPage <= 328,
    );
    assert.deepEqual(
        tables.map((table: { officialNumber: string; columnCount: number; headers: unknown[]; rows: unknown[] }) =>
            [table.officialNumber, table.columnCount, table.headers.length, table.rows.length]),
        [
            ["11.3.Ia", 2, 0, 2], ["11.3.Ib", 3, 1, 10], ["11.3.Ic", 3, 1, 6],
            ["11.3.II", 4, 1, 6], ["11.3.III", 3, 1, 1], ["11.3.IV", 4, 1, 16],
            ["11.3.V", 4, 1, 16], ["11.3.VI a", 3, 1, 8],
        ],
    );
    type TableAsset = { officialNumber: string; rows: Array<Array<{ text: string; latex?: string }>> };
    const byNumber = new Map<string, TableAsset>(tables.map((table: TableAsset) => [table.officialNumber, table]));
    const getTable = (number: string): TableAsset => {
        const table = byNumber.get(number);
        assert.ok(table, `tabella mancante: ${number}`);
        return table;
    };
    assert.deepEqual(getTable("11.3.Ia").rows[0]?.map((cell) => cell.text), ["fy nom", "450 N/mm²"]);
    assert.deepEqual(getTable("11.3.II").rows.at(-1)?.map((cell) => cell.text), ["Carbonio equivalente", "Ceq", "0,52", "0,50"]);
    assert.deepEqual(getTable("11.3.IV").rows.at(-1)?.map((cell) => cell.text), ["20", "2,21", "--", "1,64"]);
    assert.deepEqual(getTable("11.3.V").rows.at(-1)?.map((cell) => cell.text), ["20", "1,77", "–", "1,282"]);
    assert.equal(getTable("11.3.VI a").rows.at(-1)?.[1]?.latex?.includes("\\varnothing\\ge12"), true);
    assert.doesNotMatch(JSON.stringify(tables), /TABELLA_DA_VERIFICARE|[ǈΚǂǃ]/u);
});

test("NTC pagine 319–328 conserva gli inline completi e rimuove i residui OCR", async () => {
    const units = await Promise.all(numbers.map((number) => json(`corpus/units/ntc2018/${number}.json`)));
    const blocks = units.flatMap((unit) => unit.blocks.filter(
        (block: { evidence: { pdfPage: number } }) => block.evidence.pdfPage >= 319 && block.evidence.pdfPage <= 328,
    ));
    const normalized = blocks.map((block: { text?: { normalized?: string } }) => block.text?.normalized ?? "").join(" ");
    const inlineLatex = blocks.flatMap(
        (block: { text?: { inline?: Array<{ kind: string; latex?: string }> } }) =>
            block.text?.inline?.filter((segment) => segment.kind === "math").map((segment) => segment.latex) ?? [],
    );
    for (const latex of [
        "t=\\infty", "f_{R1k}", "f_{R3k}", "60^{+15}_{-0}\\;\\mathrm{min}",
        "100\\pm10\\;{}^\\circ\\mathrm{C}", "7{,}85\\;\\mathrm{kg/dm^3}",
        "6\\;\\mathrm{mm}\\le\\varnothing\\le16\\;\\mathrm{mm}", "C_{eq}",
        "f_{t7\\%}", "A_{gt}", "(f_y/f_{y\\,\\mathrm{nom}})_k", "n=75",
    ]) assert.ok(inlineLatex.includes(latex), `inline mancante: ${latex}`);
    assert.doesNotMatch(normalized, /(?:t = ǈ|coeĜciente|f R[13]k|ǃ|ǂ|Κ|N\/mm2|n k n K|Analisi di prodotto Analisi di colata)/u);
});

test("NTC pagine 319–328 colloca ogni asset una sola volta", async () => {
    const units = await Promise.all(numbers.map((number) => json(`corpus/units/ntc2018/${number}.json`)));
    const references = units.flatMap((unit) => unit.blocks.filter(
        (block: { assetId?: string; evidence: { pdfPage: number } }) =>
            block.assetId && block.evidence.pdfPage >= 319 && block.evidence.pdfPage <= 328,
    ).map((block: { assetId: string }) => block.assetId));
    assert.equal(references.length, 12);
    assert.equal(new Set(references).size, references.length);
});
