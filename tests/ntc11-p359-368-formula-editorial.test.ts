import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../", import.meta.url));
const numbers = [
    "11.9.1", "11.9.2", "11.9.3", "11.9.4", "11.9.4.1", "11.9.5", "11.9.5.1",
    "11.9.6", "11.9.6.1", "11.9.7", "11.9.7.1", "11.9.8", "11.9.8.1", "11.9.9",
    "11.9.9.1", "11.9.10", "11.9.10.1", "11.10", "11.10.1", "11.10.1.1",
    "11.10.1.1.1", "11.10.2", "11.10.2.1", "11.10.2.2", "11.10.2.3", "11.10.2.4",
    "11.10.3", "11.10.3.1", "11.10.3.1.1", "11.10.3.1.2", "11.10.3.2",
    "11.10.3.2.1", "11.10.3.2.2",
];

// Canonical JSON records intentionally contain heterogeneous block shapes.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function json(relativePath: string): Promise<any> {
    return JSON.parse(await readFile(join(repoRoot, relativePath), "utf8"));
}

test("NTC pagine 359–368 conserva tutte le dodici formule display", async () => {
    const manifest = await json("corpus/assets/ntc2018/11-step2.json");
    const formulas = manifest.formulas.filter(
        (formula: { pdfPage: number }) => formula.pdfPage >= 359 && formula.pdfPage <= 368,
    );
    assert.deepEqual(
        formulas.map((formula: { officialNumber: string; latex: string }) => [formula.officialNumber, formula.latex]),
        [
            ["11.9.1", "\\xi_e<15\\%"],
            ["11.9.2", "\\left|K_e-K_{in}\\right|/K_{in}<20\\%"],
            ["11.9.3", "\\left|K_{e,(i)}-K_{e,(3)}\\right|/K_{e,(3)}\\le10\\%"],
            ["11.9.4", "\\left|\\xi_{e,(i)}-\\xi_{e,(3)}\\right|/\\xi_{e,(3)}\\le10\\%"],
            ["11.9.5", "\\left|K_{2,(i)}-K_{2,(3)}\\right|/K_{2,(3)}\\le10\\%"],
            ["11.9.6", "\\left|\\xi_{e,(i)}-\\xi_{e,(3)}\\right|/\\xi_{e,(3)}\\le10\\%"],
            ["11.9.7", "\\left|E_{d,(i)}-E_{d,(3)}\\right|/E_{d,(3)}\\le10\\%"],
            ["11.9.8", "\\gamma_v=(1+t_d)\\cdot(1{,}5)^\\alpha"],
            ["11.9.9", "\\left|f_{(i)}-f_{(3)}\\right|/f_{(3)}\\le0{,}25"],
            ["11.10.1", "\\frac{f_1+f_2+\\cdots+f_n}{n}\\ge f_{bm}"],
            ["11.10.2", "f_1\\ge0{,}80f_{bm}"],
            ["11.10.3", "f_{bk}=0{,}75f_{bm}"],
        ],
    );
});

test("NTC pagine 359–368 struttura integralmente le dodici tabelle", async () => {
    const manifest = await json("corpus/assets/ntc2018/11-step2.json");
    const tables = manifest.tables.filter(
        (table: { pdfPage: number }) => table.pdfPage >= 359 && table.pdfPage <= 368,
    );
    assert.deepEqual(tables.map((table: { officialNumber: string }) => table.officialNumber), [
        "11.9.I", "11.9.II", "11.9.III", "11.9.IV", "11.10.I", "11.10.II",
        "11.10.III", "11.10.IV", "11.10.V", "11.10.VI", "11.10.VII", "11.10.VIII",
    ]);
    assert.deepEqual(tables.map((table: { columnCount: number; headers: unknown[]; rows: unknown[] }) => [
        table.columnCount, table.headers.length, table.rows.length,
    ]), [
        [5, 1, 2], [5, 1, 3], [5, 1, 2], [5, 1, 3], [3, 1, 2], [7, 1, 1],
        [3, 1, 1], [3, 1, 1], [7, 2, 6], [5, 2, 9], [5, 2, 9], [4, 2, 3],
    ]);
    const tableI = tables.find((table: { officialNumber: string }) => table.officialNumber === "11.10.I");
    assert.equal(tableI.rows[0][0].rowSpan, 2);
    const tableV = tables.find((table: { officialNumber: string }) => table.officialNumber === "11.10.V");
    assert.deepEqual(tableV.rows[2].map((cell: { text: string }) => cell.text), ["M 2,5", "Bastarda", "1", "-", "2", "9", "-"]);
    const tableVII = tables.find((table: { officialNumber: string }) => table.officialNumber === "11.10.VII");
    assert.equal(tableVII.rows.at(-1)[0].latex, "\\ge40{,}0");
    const tableVIII = tables.find((table: { officialNumber: string }) => table.officialNumber === "11.10.VIII");
    assert.equal(tableVIII.headers[0][1].colSpan, 3);
    assert.equal(tableVIII.rows[0][2].latex, "0{,}30^{*}");
    assert.match(tableVIII.notes[0], /5\.0 N\/mm²/u);
    assert.doesNotMatch(JSON.stringify(tables), /TABELLA_DA_VERIFICARE|[ǃǂΒ΅·ȡ]/u);
});

test("NTC pagine 359–368 conserva inline completi e rimuove il rumore OCR", async () => {
    const units = await Promise.all(numbers.map((number) => json(`corpus/units/ntc2018/${number}.json`)));
    const blocks = units.flatMap((unit) => unit.blocks.filter(
        (block: { evidence: { pdfPage: number } }) => block.evidence.pdfPage >= 359 && block.evidence.pdfPage <= 368,
    ));
    const normalized = blocks.map((block: { text?: { normalized?: string } }) => block.text?.normalized ?? "").join(" ");
    const inlineLatex = blocks.flatMap(
        (block: { text?: { inline?: Array<{ kind: string; latex?: string }> } }) =>
            block.text?.inline?.filter((segment) => segment.kind === "math").map((segment) => segment.latex) ?? [],
    );
    for (const latex of [
        "K_{in}", "K_2=(F_2-F_1)/(d_2-d_1)", "\\xi_e=E_d/(2\\pi F_2d_2)",
        "v^\\alpha", "S_1=A'/L", "\\xi_e=E_d/(2\\pi Fd)", "0{,}5d_{dc}",
        "\\pm50\\;\\mathrm{mm}", "\\gamma_M", "f_1,f_2,\\ldots,f_n", "f_m<2{,}5\\;\\mathrm{N/mm^2}",
        "f_{bk}=0{,}8f_{bm}", "f_{vk0}",
    ]) assert.ok(inlineLatex.includes(latex), `inline mancante: ${latex}`);
    assert.doesNotMatch(inlineLatex.join(" "), /[àèéìòùÀÈÉÌÒÙ]/u);
    assert.match(normalized, /Controllo di Produzione in Fabbrica \(Factory Production Control tests\)/u);
    assert.doesNotMatch(normalized, /[ǃǂΒ΅·ȡ]|2Δ|\b(?:K|F|E|d|f) [0-9]\b|\bf k\b|\bfvk0\s+,/u);
});

test("NTC pagine 359–368 conserva i due crop ufficiali e colloca 26 asset una volta", async () => {
    const manifest = await json("corpus/assets/ntc2018/11-step2.json");
    const figures = manifest.figures.filter(
        (figure: { pdfPage: number }) => figure.pdfPage >= 359 && figure.pdfPage <= 368,
    );
    assert.deepEqual(figures.map((figure: { officialNumber: string; sha256: string }) => [figure.officialNumber, figure.sha256]), [
        ["11.9.1", "f6e4e3af58a3b4da28e046de2a856d1d5fac4c7aa3a4665058b8159953df8dbd"],
        ["11.9.2", "e71c5ba99d4710abd0d59d218532c60a0fa21ff661f347ac6c9363ca20f2fa30"],
    ]);
    const units = await Promise.all(numbers.map((number) => json(`corpus/units/ntc2018/${number}.json`)));
    const references = units.flatMap((unit) => unit.blocks.filter(
        (block: { assetId?: string; evidence: { pdfPage: number } }) =>
            block.assetId && block.evidence.pdfPage >= 359 && block.evidence.pdfPage <= 368,
    ).map((block: { assetId: string }) => block.assetId));
    assert.equal(references.length, 26);
    assert.equal(new Set(references).size, references.length);
});
