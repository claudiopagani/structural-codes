/* eslint-disable @typescript-eslint/no-explicit-any */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const json = async (path: string) => JSON.parse(await readFile(new URL(path, root), "utf8"));

test("Circolare C7 conserva la gerarchia delle note e degli elenchi dell'ultimo passaggio", async () => {
  const dynamic = await json("corpus/units/circ2019/c7.3.3.1.json");
  const staticAnalysis = await json("corpus/units/circ2019/c7.3.3.2.json");
  const footnotes = [dynamic, staticAnalysis].map((unit) => unit.blocks.find((block: any) => block.kind === "footnote").text.paragraphs);
  assert.deepEqual(footnotes.map((paragraphs: any[]) => paragraphs.filter((paragraph) => paragraph.listMarker === "numbered").length), [3, 3]);

  const nested = await json("corpus/units/circ2019/c7.8.1.5.4.json");
  assert.deepEqual(nested.blocks.slice(2, 5).map((block: any) => [block.kind, block.listMarker, block.listLevel]), [
    ["list-item", "none", 0],
    ["list-item", "dash", 1],
    ["list-item", "dash", 1],
  ]);
});

test("Circolare C7 ripristina i contenuti e la resa degli asset richiesti", async () => {
  const purpose = await json("corpus/units/circ2019/c7.10.1.json");
  assert.match(purpose.blocks[1].text.normalized, /^L’isolamento sismico rientra/iu);
  assert.equal(purpose.blocks[2].kind, "footnote");

  const previous = await json("corpus/units/circ2019/c7.10.4.2.json");
  const current = await json("corpus/units/circ2019/c7.10.4.3.json");
  assert.match(previous.blocks.at(-1).text.normalized, /^È opportuna una buona ridondanza/iu);
  assert.match(current.blocks[1].text.normalized, /^La rigidità strutturale/iu);

  const methods = await json("corpus/units/circ2019/c7.10.5.3.json");
  assert.deepEqual(methods.blocks.slice(2, 5).map((block: any) => [block.text.normalized, block.listMarker]), [
    ["statica lineare", "dash"],
    ["dinamica lineare", "dash"],
    ["dinamica non lineare", "dash"],
  ]);

  const assets72 = await json("corpus/assets/circ2019/7.2.json");
  const figure72 = Object.values(assets72.figures as Record<string, { officialNumber?: string; displayScale?: number }>).find((figure) => figure.officialNumber === "C7.2.4");
  assert.equal(figure72?.displayScale, 1.25);
  const assets73 = await json("corpus/assets/circ2019/7.3.json");
  const figure73 = Object.values(assets73.figures as Record<string, { officialNumber?: string; captionInline?: Array<{ kind: string; latex?: string }> }>).find((figure) => figure.officialNumber === "C7.3.2");
  const caption = figure73?.captionInline ?? [];
  assert.deepEqual(caption.filter((part: any) => part.kind === "math").map((part: any) => part.latex), ["T\\ge T_C", "T<T_C"]);
  const table73 = Object.values(assets73.tables as Record<string, { officialNumber?: string; columnWidths?: number[] }>).find((table) => table.officialNumber === "C7.3.I");
  assert.equal(table73?.columnWidths?.length, 13);
});

test("Circolare C7.2-C7.4 centra le tabelle, conserva i simboli e allinea le definizioni", async () => {
  const assets72 = await json("corpus/assets/circ2019/7.2.json");
  const table72 = Object.values(assets72.tables as Record<string, any>).find((table) => table.officialNumber === "C7.2.II");
  assert.ok([...table72.headers, ...table72.rows].flat().every((cell: any) => cell.align === "center"));

  const assets73 = await json("corpus/assets/circ2019/7.3.json");
  const table73 = Object.values(assets73.tables as Record<string, any>).find((table) => table.officialNumber === "C7.3.I");
  const tableCells = [...table73.headers, ...table73.rows].flat();
  assert.ok(tableCells.every((cell: any) => cell.align === "center"));
  const dutHeader = table73.headers[1].find((cell: any) => cell.text.startsWith("DUT"));
  assert.equal(dutHeader?.text, "DUT\n(SPO)");
  assert.equal(dutHeader?.inline?.[1]?.value, "\n(");
  assert.deepEqual(table73.headers[1].at(-1).text, "III\nIV");
  assert.ok(tableCells.some((cell: any) => cell.inline?.some((part: any) => part.latex === "\\mathrm{SLU}")));
  assert.ok(tableCells.some((cell: any) => cell.inline?.some((part: any) => part.latex === "\\S 7.3.6.1")));

  const note = (await json("corpus/units/circ2019/c7.3.3.2.json")).blocks.find((block: any) => block.kind === "footnote").text.paragraphs;
  assert.deepEqual(note.filter((paragraph: any) => paragraph.listMarker === "numbered").map((paragraph: any) => paragraph.normalized.startsWith("invece")), [true, false, false]);

  const unit = await json("corpus/units/circ2019/c7.4.3.1.json");
  assert.deepEqual(unit.blocks.slice(7, 10).map((block: any) => [block.kind, block.listMarker, block.text.normalized]), [
    ["paragraph", undefined, "dove:"],
    ["list-item", "none", "K_θ è la rigidezza torsionale di piano rispetto al centro di rigidezza;"],
    ["list-item", "none", "K è la maggiore tra le rigidezze di piano."],
  ]);
  assert.deepEqual(unit.blocks.slice(14, 17).map((block: any) => [block.kind, block.listMarker, block.text.normalized]), [
    ["paragraph", undefined, "dove:"],
    ["list-item", "none", "T è il periodo traslazionale disaccoppiato;"],
    ["list-item", "none", "T_θ è il periodo torsionale disaccoppiato."],
  ]);
});
