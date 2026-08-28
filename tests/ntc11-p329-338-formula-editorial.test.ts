import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../", import.meta.url));
const numbers = [
    "11.3.2.10.3", "11.3.2.10.4", "11.3.2.11", "11.3.2.11.1", "11.3.2.11.1.1",
    "11.3.2.11.1.2", "11.3.2.11.2", "11.3.2.12", "11.3.3", "11.3.3.1",
    "11.3.3.2", "11.3.3.3", "11.3.3.4", "11.3.3.5", "11.3.3.5.1", "11.3.3.5.2",
    "11.3.3.5.2.1", "11.3.3.5.2.2", "11.3.3.5.2.3", "11.3.3.5.2.4", "11.3.3.5.3",
];

// Canonical JSON records intentionally contain heterogeneous block shapes.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function json(relativePath: string): Promise<any> {
    return JSON.parse(await readFile(join(repoRoot, relativePath), "utf8"));
}

test("NTC pagine 329–338 usa il simbolo di diametro nelle due formule ufficiali", async () => {
    const manifest = await json("corpus/assets/ntc2018/11-step2.json");
    const formulas = manifest.formulas.filter(
        (formula: { pdfPage: number }) => formula.pdfPage >= 329 && formula.pdfPage <= 338,
    );
    assert.deepEqual(
        formulas.map((formula: { officialNumber: string; latex: string }) => [formula.officialNumber, formula.latex]),
        [
            ["11.3.5", "\\tau_m\\ge0{,}098(80-1{,}2\\varnothing)"],
            ["11.3.6", "\\tau_r\\ge0{,}098(130-1{,}9\\varnothing)"],
        ],
    );
    assert.doesNotMatch(JSON.stringify(formulas), /\\phi/u);
});

test("NTC pagine 329–338 struttura integralmente le sette tabelle", async () => {
    const manifest = await json("corpus/assets/ntc2018/11-step2.json");
    const tables = manifest.tables.filter(
        (table: { pdfPage: number }) => table.pdfPage >= 329 && table.pdfPage <= 338,
    );
    assert.deepEqual(
        tables.map((table: { officialNumber: string; columnCount: number; headers: unknown[]; rows: unknown[] }) =>
            [table.officialNumber, table.columnCount, table.headers.length, table.rows.length]),
        [
            ["11.3.VI b", 4, 1, 3], ["11.3.VII a", 3, 1, 7], ["11.3.VII b", 3, 1, 7],
            ["11.3.VIII", 5, 1, 5], ["11.3.IX", 2, 1, 2], ["11.3.X", 5, 1, 5],
            ["11.3.XI", 3, 0, 4],
        ],
    );
    type TableAsset = { officialNumber: string; rows: Array<Array<{ text: string; latex?: string; rowSpan?: number; colSpan?: number }>> };
    const byNumber = new Map<string, TableAsset>(tables.map((table: TableAsset) => [table.officialNumber, table]));
    const getTable = (number: string): TableAsset => {
        const table = byNumber.get(number);
        assert.ok(table, `tabella mancante: ${number}`);
        return table;
    };
    assert.deepEqual(getTable("11.3.VI b").rows.at(-1)?.map((cell) => cell.text), ["per Ø > 12 mm", "fr oppure fp ≥", "0.056", "0.059"]);
    assert.equal(getTable("11.3.VII b").rows.at(-1)?.[1]?.latex?.includes("\\varnothing"), true);
    assert.deepEqual(getTable("11.3.VIII").rows[0]?.slice(1).map((cell) => cell.text), ["≥ 1000", "≥ 1570", "≥ 1860", "≥ 1820"]);
    assert.equal(getTable("11.3.X").rows[0]?.[0]?.rowSpan, 3);
    assert.equal(getTable("11.3.XI").rows[0]?.[1]?.colSpan, 2);
    assert.doesNotMatch(JSON.stringify(tables), /TABELLA_DA_VERIFICARE|(?:ǈ|Κ|ǂ|ǃ|΅|҆|Θ)/u);
});

test("NTC pagine 329–338 conserva gli inline completi e rimuove i residui OCR", async () => {
    const units = await Promise.all(numbers.map((number) => json(`corpus/units/ntc2018/${number}.json`)));
    const blocks = units.flatMap((unit) => unit.blocks.filter(
        (block: { evidence: { pdfPage: number } }) => block.evidence.pdfPage >= 329 && block.evidence.pdfPage <= 338,
    ));
    const normalized = blocks.map((block: { text?: { normalized?: string } }) => block.text?.normalized ?? "").join(" ");
    const inlineLatex = blocks.flatMap(
        (block: { text?: { inline?: Array<{ kind: string; latex?: string }> } }) =>
            block.text?.inline?.filter((segment) => segment.kind === "math").map((segment) => segment.latex) ?? [],
    );
    for (const latex of [
        "\\tau_m", "12\\le\\varnothing\\le18\\;\\mathrm{mm}", "n=80", "x_k=\\bar{x}-ks",
        "\\rho_{1000}", "f_{p(0{,}1)}/f_{pt}", "T=20^\\circ\\mathrm{C}\\pm1^\\circ\\mathrm{C}",
        "\\sigma_1", "\\sigma_2", "\\varnothing\\ge8\\;\\mathrm{mm}", "12{,}5\\;\\mathrm{mm}",
    ]) assert.ok(inlineLatex.includes(latex), `inline mancante: ${latex}`);
    assert.doesNotMatch(normalized, /(?:ǂ|ǃ|΅|҆|Θ)|\b(?:U1000|Vspi|V1|V2)\b|\bf p|\bA gt|\bE p/u);
});

test("NTC pagine 329–338 colloca ogni asset una sola volta", async () => {
    const units = await Promise.all(numbers.map((number) => json(`corpus/units/ntc2018/${number}.json`)));
    const references = units.flatMap((unit) => unit.blocks.filter(
        (block: { assetId?: string; evidence: { pdfPage: number } }) =>
            block.assetId && block.evidence.pdfPage >= 329 && block.evidence.pdfPage <= 338,
    ).map((block: { assetId: string }) => block.assetId));
    assert.equal(references.length, 9);
    assert.equal(new Set(references).size, references.length);
});
