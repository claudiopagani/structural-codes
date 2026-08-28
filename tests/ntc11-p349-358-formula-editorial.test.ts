import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../", import.meta.url));
const numbers = [
    "11.6", "11.7", "11.7.1", "11.7.1.1", "11.7.2", "11.7.3", "11.7.4", "11.7.5",
    "11.7.6", "11.7.7", "11.7.7.1", "11.7.7.2", "11.7.8", "11.7.9", "11.7.9.1",
    "11.7.9.2", "11.7.10", "11.7.10.1", "11.7.10.1.1", "11.7.10.1.2", "11.7.10.2",
    "11.8", "11.8.1", "11.8.2", "11.8.3", "11.8.3.1", "11.8.3.2", "11.8.3.3",
    "11.8.3.4", "11.8.4", "11.8.4.1", "11.8.4.2", "11.8.4.3", "11.8.4.4",
    "11.8.5", "11.8.6", "11.9",
];

// Canonical JSON records intentionally contain heterogeneous block shapes.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function json(relativePath: string): Promise<any> {
    return JSON.parse(await readFile(join(repoRoot, relativePath), "utf8"));
}

test("NTC pagina 350 conserva parentesi quadre e separatore delle due formule", async () => {
    const manifest = await json("corpus/assets/ntc2018/11-step2.json");
    const formulas = manifest.formulas.filter(
        (formula: { pdfPage: number }) => formula.pdfPage >= 349 && formula.pdfPage <= 358,
    );
    assert.deepEqual(
        formulas.map((formula: { officialNumber: string; latex: string }) => [formula.officialNumber, formula.latex]),
        [
            ["11.7.1", "k_h=\\min\\left\\{\\left[\\left(\\frac{150}{h}\\right)^{0{,}2};1{,}3\\right]\\right\\}"],
            ["11.7.2", "k_h=\\min\\left\\{\\left[\\left(\\frac{600}{h}\\right)^{0{,}1};1{,}1\\right]\\right\\}"],
        ],
    );
});

test("NTC tabella 11.7.I conserva le tre coppie di colonne", async () => {
    const manifest = await json("corpus/assets/ntc2018/11-step2.json");
    const table = manifest.tables.find((asset: { officialNumber: string }) => asset.officialNumber === "11.7.I");
    assert.ok(table);
    assert.deepEqual([table.columnCount, table.headers.length, table.rows.length], [6, 1, 6]);
    assert.deepEqual(table.headers[0].map((cell: { text: string; colSpan?: number }) => [cell.text, cell.colSpan]), [
        ["Resistenze caratteristiche", 2], ["Moduli elastici", 2], ["Massa volumica", 2],
    ]);
    assert.deepEqual(table.rows[0].map((cell: { text: string }) => cell.text), [
        "Flessione", "fm,k", "Modulo elastico parallelo medio **", "E0,mean", "Massa volumica caratteristica", "ρk",
    ]);
    assert.equal(table.rows[1][5].latex, "\\rho_{\\mathrm{mean}}");
    assert.equal(table.notes.filter((note: string) => note.startsWith("*")).length, 2);
    assert.doesNotMatch(JSON.stringify(table), /TABELLA_DA_VERIFICARE|\b(?:Uk|Umean)\b/u);
});

test("NTC pagine 349–358 conserva inline completi e rimuove il rumore OCR", async () => {
    const units = await Promise.all(numbers.map((number) => json(`corpus/units/ntc2018/${number}.json`)));
    const blocks = units.flatMap((unit) => unit.blocks.filter(
        (block: { evidence: { pdfPage: number } }) => block.evidence.pdfPage >= 349 && block.evidence.pdfPage <= 358,
    ));
    const normalized = blocks.map((block: { text?: { normalized?: string } }) => block.text?.normalized ?? "").join(" ");
    const inlineLatex = blocks.flatMap(
        (block: { text?: { inline?: Array<{ kind: string; latex?: string }> } }) =>
            block.text?.inline?.filter((segment) => segment.kind === "math").map((segment) => segment.latex) ?? [],
    );
    for (const latex of [
        "20\\pm2\\;{}^\\circ\\mathrm{C}", "f_{m,k}", "f_{t,0,k}", "k_h", "80\\;\\mathrm{mm}",
        "5\\%", "3\\;\\mathrm{campioni\\ ogni}\\;90\\;\\mathrm{t}", "8\\;\\mathrm{kN}",
        "-15\\;{}^\\circ\\mathrm{C}", "\\gamma_x\\cdot d_{bd}", "d_{pd}",
    ]) assert.ok(inlineLatex.includes(latex), `inline mancante: ${latex}`);
    assert.doesNotMatch(normalized, /(?:°¿|°¾|°½|°¯|°®|ȉ)|\bJx\b|\bd bd\b|\b(?:Uk|Umean)\b/u);
});

test("NTC pagine 349–358 colloca i tre asset una sola volta", async () => {
    const units = await Promise.all(numbers.map((number) => json(`corpus/units/ntc2018/${number}.json`)));
    const references = units.flatMap((unit) => unit.blocks.filter(
        (block: { assetId?: string; evidence: { pdfPage: number } }) =>
            block.assetId && block.evidence.pdfPage >= 349 && block.evidence.pdfPage <= 358,
    ).map((block: { assetId: string }) => block.assetId));
    assert.equal(references.length, 3);
    assert.equal(new Set(references).size, references.length);
});
