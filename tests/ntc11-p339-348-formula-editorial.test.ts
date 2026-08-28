import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../", import.meta.url));
const numbers = [
    "11.3.3.5.3", "11.3.3.5.4", "11.3.3.5.5", "11.3.3.5.7", "11.3.4.1", "11.3.4.2",
    "11.3.4.5", "11.3.4.6.1", "11.3.4.6.2", "11.3.4.7", "11.3.4.9", "11.3.4.11.1.1",
    "11.3.4.11.1.2", "11.3.4.11.1.3", "11.3.4.11.1.4", "11.3.4.11.2.1",
    "11.3.4.11.2.3", "11.3.4.11.2.4", "11.3.4.11.3",
];

// Canonical JSON records intentionally contain heterogeneous block shapes.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function json(relativePath: string): Promise<any> {
    return JSON.parse(await readFile(join(repoRoot, relativePath), "utf8"));
}

test("NTC pagine 339–348 non contiene formule in display", async () => {
    const manifest = await json("corpus/assets/ntc2018/11-step2.json");
    assert.deepEqual(
        manifest.formulas.filter((formula: { pdfPage: number }) => formula.pdfPage >= 339 && formula.pdfPage <= 348),
        [],
    );
});

test("NTC pagina 342 struttura integralmente le quattro tabelle", async () => {
    const manifest = await json("corpus/assets/ntc2018/11-step2.json");
    const tables = manifest.tables.filter((table: { pdfPage: number }) => table.pdfPage === 342);
    assert.deepEqual(
        tables.map((table: { officialNumber: string; columnCount: number; headers: unknown[]; rows: unknown[] }) =>
            [table.officialNumber, table.columnCount, table.headers.length, table.rows.length]),
        [
            ["11.3.XII", 5, 2, 3], ["11.3.XIII.a", 4, 2, 7],
            ["11.3.XIII.b", 8, 1, 2], ["11.3.XIV", 7, 2, 3],
        ],
    );
    type Cell = { text: string; latex?: string; rowSpan?: number; colSpan?: number };
    type TableAsset = { officialNumber: string; headers: Cell[][]; rows: Cell[][]; notes: string[] };
    const byNumber = new Map<string, TableAsset>(tables.map((table: TableAsset) => [table.officialNumber, table]));
    const getTable = (number: string): TableAsset => {
        const table = byNumber.get(number);
        assert.ok(table, `tabella mancante: ${number}`);
        return table;
    };
    assert.equal(getTable("11.3.XII").headers[0]?.[1]?.colSpan, 3);
    assert.match(getTable("11.3.XII").notes[0] ?? "", /^Nota 1\)/u);
    assert.equal(getTable("11.3.XIII.a").rows[0]?.[1]?.rowSpan, 2);
    assert.deepEqual(getTable("11.3.XIII.b").rows[0]?.slice(1).map((cell) => cell.text), ["240", "320", "300", "400", "480", "640", "900"]);
    assert.equal(getTable("11.3.XIV").rows[0]?.[5]?.rowSpan, 3);
    assert.doesNotMatch(JSON.stringify(tables), /TABELLA_DA_VERIFICARE|(?:ǂ|ǃ|·|Θ)/u);
});

test("NTC pagine 339–348 conserva gli inline completi e rimuove i residui OCR", async () => {
    const units = await Promise.all(numbers.map((number) => json(`corpus/units/ntc2018/${number}.json`)));
    const blocks = units.flatMap((unit) => unit.blocks.filter(
        (block: { evidence: { pdfPage: number } }) => block.evidence.pdfPage >= 339 && block.evidence.pdfPage <= 348,
    ));
    const normalized = blocks.map((block: { text?: { normalized?: string } }) => block.text?.normalized ?? "").join(" ");
    const inlineLatex = blocks.flatMap(
        (block: { text?: { inline?: Array<{ kind: string; latex?: string }> } }) =>
            block.text?.inline?.filter((segment) => segment.kind === "math").map((segment) => segment.latex) ?? [],
    );
    for (const latex of [
        "f_{p(0{,}1)}", "F_{p(0{,}1)}", "s\\le4\\;\\mathrm{mm}", "350\\;\\mathrm{HV30}",
        "L_0=5{,}65\\sqrt{A_0}", "f_t/f_y\\ge1{,}2", "\\gamma_{ov}", "\\tau_{u,Rd}",
        "2\\;\\mathrm{prelievi\\ ogni}\\;10\\;\\mathrm{t}", "3\\;\\mathrm{campioni\\ ogni}\\;1500\\;\\mathrm{pezzi}",
    ]) assert.ok(inlineLatex.includes(latex), `inline mancante: ${latex}`);
    assert.doesNotMatch(normalized, /(?:ǂ|ǃ|·)|Θu\.Rd|\bf\s+(?:pt|py|p\(|y\b|t\b)|\bA\s+(?:gt|0\b)|\bE\s+p\b/u);
});

test("NTC pagine 339–348 colloca ogni asset una sola volta", async () => {
    const units = await Promise.all(numbers.map((number) => json(`corpus/units/ntc2018/${number}.json`)));
    const references = units.flatMap((unit) => unit.blocks.filter(
        (block: { assetId?: string; evidence: { pdfPage: number } }) =>
            block.assetId && block.evidence.pdfPage >= 339 && block.evidence.pdfPage <= 348,
    ).map((block: { assetId: string }) => block.assetId));
    assert.equal(references.length, 4);
    assert.equal(new Set(references).size, references.length);
});
