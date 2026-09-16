/* eslint-disable @typescript-eslint/no-explicit-any */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../", import.meta.url));

// I manifest degli asset hanno forme eterogenee.
async function json(relativePath: string): Promise<any> {
  return JSON.parse(await readFile(join(repoRoot, relativePath), "utf8"));
}

function sha256(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function assertAllCellsCentered(table: any) {
  for (const row of [...table.headers, ...table.rows]) {
    for (const cell of row) assert.equal(cell.align, "center", `${table.officialNumber}: ${cell.text}`);
  }
}

test("NTC 4.2.IX, XVI-XIX hanno il testo centrato e XIV centra la seconda colonna", async () => {
  const [step4b, step5, step6] = await Promise.all([
    json("corpus/assets/ntc2018/4.2-step4b.json"),
    json("corpus/assets/ntc2018/4.2-step5.json"),
    json("corpus/assets/ntc2018/4.2-step6.json"),
  ]);
  for (const number of ["4.2.IX (a)", "4.2.IX (b)"]) {
    const table = step4b.tables.find((candidate: any) => candidate.officialNumber === number);
    assertAllCellsCentered(table);
  }
  for (const number of ["4.2.XVI", "4.2.XVII", "4.2.XVIII"]) {
    const table = step5.tables.find((candidate: any) => candidate.officialNumber === number);
    assertAllCellsCentered(table);
  }
  assertAllCellsCentered(step6.tables.find((candidate: any) => candidate.officialNumber === "4.2.XIX"));

  const xiv = step5.tables.find((candidate: any) => candidate.officialNumber === "4.2.XIV");
  assert.equal(xiv.rows[6][0].text, "Resistenza a scorrimento: per SLE");
  for (const row of xiv.rows) if (row[1]) assert.equal(row[1].align, "center");
});

test("NTC 4.2.X usa i diagrammi raster ufficiali nelle otto celle", async () => {
  const manifest = await json("corpus/assets/ntc2018/4.2-step4c.json");
  const table = manifest.tables.find((candidate: any) => candidate.officialNumber === "4.2.X");
  assert.equal(table.notes.length, 0);
  assertAllCellsCentered(table);
  assert.equal(table.rows.length, 8);
  for (const [index, row] of table.rows.entries()) {
    assert.equal(row[0].text, "");
    assert.match(row[0].image.imagePath, new RegExp(`table4\\.2\\.x-diagram-${index + 1}\\.png$`, "u"));
    const imagePath = join(repoRoot, "corpus", "assets", row[0].image.imagePath);
    const bytes = await readFile(imagePath);
    assert.equal(createHash("sha256").update(bytes).digest("hex"), row[0].image.sha256, row[0].image.imagePath);
  }
  assert.equal(table.rows[0][1].text, "1,0");
  assert.equal(table.rows[7][1].text, "0,82");
});

test("NTC 4.2.III-V conserva a capo, matematica inline e griglia della fonte", async () => {
  const manifest = await json("corpus/assets/ntc2018/4.2-step3.json");
  const tableIII = manifest.tables.find((candidate: any) => candidate.officialNumber === "4.2.III");
  const tableIV = manifest.tables.find((candidate: any) => candidate.officialNumber === "4.2.IV");
  const tableV = manifest.tables.find((candidate: any) => candidate.officialNumber === "4.2.V");

  assert.equal(tableIII.rows[0][0].text, "Distribuzione\ndelle tensioni\nnelle parti\n(compressione\npositiva)");
  assert.ok(tableIII.rows[2][3].inline.some((segment: any) => segment.kind === "math" && segment.latex.includes("\\alpha")));
  assert.ok(tableIII.rows[4][3].inline.some((segment: any) => segment.kind === "math" && segment.latex.includes("\\psi")));
  assert.equal(tableIII.notesInline[0][1].latex, "\\psi\\le-1");
  assert.equal(tableIII.notesInline[0][3].latex, "\\sigma\\le f_{yk}");

  assert.equal(tableIV.rows[0][0].text, "Distribuzione delle\ntensioni nelle parti\n(compressione positiva)");
  assert.equal(tableV.headers[2][0].header, false);
  assert.equal(tableV.headers[2][0].strong, undefined);
  assert.match(tableV.headers[2][0].text, /\nNon si applica agli/u);
  assert.equal(tableV.headers[3][0].colSpan, 1);
  assert.equal(tableV.headers[3][1].colSpan, 6);
  assert.equal(tableV.rows[0][0].colSpan, 1);
  assert.equal(tableV.rows[4][0].colSpan, 1);
  assert.equal(tableV.rows[4][1].colSpan, 6);
  assert.equal(tableV.rows[7][0].colSpan, 1);
  assert.equal(tableV.rows[7][1].colSpan, 6);
  assert.ok(tableV.rows[7][1].inline.some((segment: any) => segment.kind === "math" && segment.latex.includes("90\\varepsilon^2")));
  assert.deepEqual(tableV.rows[8].slice(0, 2).map((cell: any) => cell.text), ["ε = √(235/fyk)", "fyk"]);
  assert.equal(tableV.rows[8][0].colSpan, undefined);
});

test("NTC 4.2.XII-XIII conservano le intestazioni unite e le frazioni centrate", async () => {
  const manifest = await json("corpus/assets/ntc2018/4.2-step4d.json");
  const expectations = new Map([
    ["4.2.XII", ["Limiti superiori per gli spostamenti verticali", "\\dfrac{\\delta_{max}}{L}", "\\dfrac{\\delta_2}{L}"]],
    ["4.2.XIII", ["Limiti superiori per gli spostamenti orizzontali", "\\dfrac{\\delta}{h}", "\\dfrac{\\Delta}{H}"]],
  ]);
  for (const table of manifest.tables) {
    const [title, firstLatex, secondLatex] = expectations.get(table.officialNumber) ?? [];
    assert.equal(table.headers.length, 2, table.officialNumber);
    assert.equal(table.headers[0][0].rowSpan, 2, table.officialNumber);
    assert.equal(table.headers[0][1].colSpan, 2, table.officialNumber);
    assert.equal(table.headers[0][1].text, title, table.officialNumber);
    assert.equal(table.headers[1][0].latex, firstLatex, table.officialNumber);
    assert.equal(table.headers[1][1].latex, secondLatex, table.officialNumber);
    assert.equal(table.headers[1][0].align, "center", table.officialNumber);
    assert.equal(table.headers[1][1].align, "center", table.officialNumber);
    for (const row of table.rows) for (const cell of row.slice(-2)) assert.equal(cell.align, "center", table.officialNumber);
  }
});

test("NTC 4.2.8 separa il marcatore dei due punti elenco dal testo descrittivo", async () => {
  const unit = await json("corpus/units/ntc2018/4.2.8.json");
  const items = unit.blocks.filter((block: any) => ["l1", "l2"].some((suffix) => block.blockId.endsWith(`#block-${suffix}`)));
  assert.equal(items.length, 2);
  for (const item of items) {
    assert.equal(item.kind, "list-item");
    assert.equal(item.listMarker, "dash");
    assert.match(item.text.raw, /^\s*–/u);
    assert.doesNotMatch(item.text.normalized, /^\s*–/u);
    assert.equal(item.text.inline[0].value, item.text.normalized);
    assert.equal(item.evidence.normalizedSha256, sha256(item.text.normalized));
  }
});
