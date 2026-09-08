import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

type Inline = { kind: string; value: string; latex?: string };
type Block = { kind: string; listMarker?: string; text?: { normalized: string; inline?: Inline[] } };
type Unit = { blocks: Block[] };
type Manifest = { tables: Array<{ officialNumber: string | null; captionInline?: Inline[] }> };
const root = process.cwd();
async function unit(name: string): Promise<Unit> { return JSON.parse(await readFile(join(root, "corpus", "units", "ntc2018", `${name}.json`), "utf8")) as Unit; }

test("NTC 11.3 step 2 conserva elenchi, label e sottotitoli in corsivo", async () => {
  const [products, values, qualification, tolerances] = await Promise.all([unit("11.3.3.1"), unit("11.3.3.2"), unit("11.3.3.5.2.1"), unit("11.3.3.5.2.3")]);
  assert.equal(products.blocks.slice(2, 6).filter((block) => block.listMarker === "none").length, 4);
  assert.ok(products.blocks[2]?.text?.inline?.some((segment) => segment.kind === "em" && segment.value === "Filo"));
  assert.equal(products.blocks.filter((block) => block.listMarker === "dash").length, 4);
  assert.equal(values.blocks.slice(7, 19).filter((block) => block.listMarker === "none").length, 12);
  assert.equal(qualification.blocks.filter((block) => block.listMarker === "dash").length, 10);
  assert.ok(tolerances.blocks.filter((block) => block.text?.normalized === "Rettilineità").every((block) => block.text?.inline?.some((segment) => segment.kind === "em")));
  assert.equal(tolerances.blocks.filter((block) => block.text?.normalized === "Il campione deve essere sollecitato per un tratto non inferiore a 100 cm; in conseguenza la lunghezza del saggio deve essere convenientemente incrementata per tener conto della lunghezza dei dispositivi di afferraggio. Nella zona sollecitata il campione non deve subire alcuna lavorazione, deformazione meccanica o pulitura.").length, 1);
});

test("Le caption NTC 11.3 delle tabelle VII, X e XI distinguono label e descrizione", async () => {
  const assets = JSON.parse(await readFile(join(root, "corpus", "assets", "ntc2018", "11-step2.json"), "utf8")) as Manifest;
  for (const number of ["11.3.VII a", "11.3.VII b", "11.3.X", "11.3.XI"]) assert.ok(assets.tables.find((table) => table.officialNumber === number)?.captionInline?.some((segment) => segment.kind === "em"), number);
});
