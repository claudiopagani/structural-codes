import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

type Inline = { kind: string; value: string; latex?: string };
type Block = { kind: string; listMarker?: string; text?: { normalized: string; inline?: Inline[] } };
type Unit = { blocks: Block[] };
type Manifest = { tables: Array<{ officialNumber: string | null; captionInline?: Inline[] }> };
const root = process.cwd();
async function unit(document: "ntc2018" | "circ2019", name: string): Promise<Unit> { return JSON.parse(await readFile(join(root, "corpus", "units", document, `${name}.json`), "utf8")) as Unit; }
async function manifest(): Promise<Manifest> { return JSON.parse(await readFile(join(root, "corpus", "assets", "ntc2018", "11-step2.json"), "utf8")) as Manifest; }
function hasEm(record: Unit, phrase: string) { return record.blocks.some((block) => block.text?.inline?.some((segment) => segment.kind === "em" && segment.value === phrase)); }

test("NTC 11.3 step 1 conserva le forme di controllo, liste e corsivi", async () => {
  const [controls, qualification, renewal, certificates, transformation, procedure] = await Promise.all([
    unit("ntc2018", "11.3.1.1"), unit("ntc2018", "11.3.1.2"), unit("ntc2018", "11.3.1.3"), unit("ntc2018", "11.3.1.6"), unit("ntc2018", "11.3.1.7"), unit("ntc2018", "11.3.2.10.1.3"),
  ]);
  assert.equal(controls.blocks.filter((block) => block.listMarker === "dash").length, 3);
  assert.ok(hasEm(controls, "Lotto di produzione"));
  assert.equal(qualification.blocks.slice(6, 17).filter((block) => block.listMarker === "none").length, 11);
  assert.equal(qualification.blocks.slice(21, 25).filter((block) => block.listMarker === "dash").length, 4);
  assert.equal(renewal.blocks.slice(2, 6).filter((block) => block.listMarker === "none").length, 4);
  assert.equal(certificates.blocks.slice(4, 12).filter((block) => block.listMarker === "dash").length, 8);
  assert.equal(transformation.blocks.slice(17, 20).filter((block) => block.listMarker === "none").length, 3);
  assert.ok(hasEm(procedure, "Valutazione dei risultati"));
});

test("C11.3 conserva elenchi, corsivi e matematica inline", async () => {
  const [controls, supplies, centres, b450c, adhesion, bolts, workshops] = await Promise.all([
    unit("circ2019", "c11.3.1.1"), unit("circ2019", "c11.3.1.5"), unit("circ2019", "c11.3.1.7"), unit("circ2019", "c11.3.2.1"), unit("circ2019", "c11.3.2.10.4"), unit("circ2019", "c11.3.4.6"), unit("circ2019", "c11.3.4.10"),
  ]);
  assert.equal(controls.blocks.slice(2, 5).filter((block) => block.listMarker === "dash").length, 3);
  assert.ok(hasEm(controls, "lotti di produzione"));
  assert.equal(supplies.blocks.slice(3, 10).filter((block) => block.listMarker === "dash").length, 6);
  assert.deepEqual([supplies.blocks[2]?.text?.normalized.slice(0, 2), supplies.blocks[6]?.text?.normalized.slice(0, 2)], ["A)", "B)"]);
  assert.equal(centres.blocks.slice(4, 15).filter((block) => block.listMarker === "dash").length, 11);
  assert.equal(b450c.blocks.slice(6, 9).filter((block) => block.listMarker === "dash").length, 3);
  assert.ok(b450c.blocks[6]?.text?.inline?.some((segment) => segment.kind === "math" && segment.latex === "\\left(f_y/f_{y,\\mathrm{nom}}\\right)_k"));
  assert.equal(adhesion.blocks.filter((block) => block.listMarker === "dash").length, 2);
  assert.ok(hasEm(adhesion, "Beam-test"));
  assert.equal(bolts.blocks.slice(3, 6).filter((block) => block.listMarker === "dash").length, 3);
  assert.equal(workshops.blocks.slice(4, 8).filter((block) => block.listMarker === "dash").length, 4);
});

test("Le caption NTC 11.3 separano label e descrizione", async () => {
  const assets = await manifest();
  for (const number of ["11.3.II", "11.3.IV", "11.3.V"]) assert.ok(assets.tables.find((table) => table.officialNumber === number)?.captionInline?.some((segment) => segment.kind === "em"), number);
});
