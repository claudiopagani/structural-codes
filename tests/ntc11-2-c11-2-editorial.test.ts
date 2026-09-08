import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

type Inline = { kind: string; value: string; latex?: string };
type Block = { kind: string; listMarker?: string; text?: { normalized: string; inline?: Inline[] } };
type Unit = { blocks: Block[] };
type Manifest = { tables: Array<{ officialNumber: string | null; caption: string | null; captionInline?: Inline[] }> };
const root = process.cwd();

async function unit(document: "ntc2018" | "circ2019", name: string): Promise<Unit> {
  return JSON.parse(await readFile(join(root, "corpus", "units", document, `${name}.json`), "utf8")) as Unit;
}
async function manifest(document: "ntc2018" | "circ2019", name: string): Promise<Manifest> {
  return JSON.parse(await readFile(join(root, "corpus", "assets", document, name), "utf8")) as Manifest;
}
function hasEm(record: Unit, phrase: string): boolean {
  return record.blocks.some((block) => block.text?.inline?.some((segment) => segment.kind === "em" && segment.value === phrase));
}

test("NTC 11.2 conserva gli elenchi e i corsivi editoriali", async () => {
  const [acceptance, common, traction, quality, industrial, durability] = await Promise.all([
    unit("ntc2018", "11.2.5"), unit("ntc2018", "11.2.5.3"), unit("ntc2018", "11.2.10.2"), unit("ntc2018", "11.2.2"), unit("ntc2018", "11.2.8"), unit("ntc2018", "11.2.11"),
  ]);
  assert.equal(acceptance.blocks.filter((block) => block.kind === "list-item" && block.listMarker === "dash").length, 2);
  assert.equal(common.blocks.filter((block) => block.kind === "list-item" && block.listMarker === "dash").length, 11);
  assert.equal(traction.blocks.filter((block) => block.kind === "list-item" && block.listMarker === "dash").length, 3);
  assert.ok([...acceptance.blocks, ...common.blocks, ...traction.blocks].filter((block) => block.listMarker === "dash").every((block) => !block.text?.normalized.startsWith("–")));
  for (const phrase of ["Valutazione preliminare", "Controllo di produzione", "Prove complementari"]) assert.ok(hasEm(quality, phrase), phrase);
  assert.equal(industrial.blocks.filter((block) => block.text?.inline?.some((segment) => segment.kind === "em" && segment.value === "Linee Guida per la produzione, il trasporto ed il controllo del calcestruzzo preconfezionato")).length, 2);
  for (const phrase of ["Linee Guida sul calcestruzzo strutturale", "Linee Guida per la messa in opera del calcestruzzo strutturale"]) assert.ok(hasEm(durability, phrase), phrase);
});

test("C11.2 conserva marker, label, corsivi e matematica inline", async () => {
  const [acceptance, typeA, typeB, common, inSitu, industrial, frc] = await Promise.all([
    unit("circ2019", "c11.2.5"), unit("circ2019", "c11.2.5.1"), unit("circ2019", "c11.2.5.2"), unit("circ2019", "c11.2.5.3"), unit("circ2019", "c11.2.6"), unit("circ2019", "c11.2.8"), unit("circ2019", "c11.2.12"),
  ]);
  assert.equal(typeA.blocks.filter((block) => block.listMarker === "dash").length, 3);
  assert.deepEqual(typeB.blocks.slice(8, 13).map((block) => block.text?.normalized.slice(0, 2)), ["1)", "2)", "3)", "4)", "5)"]);
  assert.ok(common.blocks.filter((block) => block.listMarker === "dash").length >= 17);
  assert.equal(inSitu.blocks[18]?.kind, "list-item");
  assert.ok(inSitu.blocks[18]?.text?.inline?.some((segment) => segment.kind === "math" && segment.latex === "f_{\\mathrm{carota}} * F_d = R_{c,is}"));
  assert.equal(industrial.blocks.filter((block) => block.listMarker === "dash").length, 2);
  for (const phrase of ["“miscela omogenea”", "“ai sensi del §11.2.5.3 del D.M. 17.01.2018 le prove di compressione vanno integrate da quelle riferite al controllo della resistenza del calcestruzzo in opera”", "“fibrorinforzato”"]) assert.ok([acceptance, typeA, typeB, common, inSitu, industrial, frc].some((record) => hasEm(record, phrase)), phrase);
});

test("Le caption delle tabelle 11.2 mantengono label forte e descrizione corsiva", async () => {
  const [ntcStep1, ntcStep2, circStep2] = await Promise.all([manifest("ntc2018", "11-step1.json"), manifest("ntc2018", "11-step2.json"), manifest("circ2019", "C11-step2.json")]);
  for (const number of ["11.2.IV", "11.2.Va", "11.2.Vb", "11.2.VI", "11.2.VII", "C11.2.6.I"]) {
    const table = [...ntcStep1.tables, ...ntcStep2.tables, ...circStep2.tables].find((entry) => entry.officialNumber === number);
    assert.ok(table?.captionInline?.some((segment) => segment.kind === "em"), number);
  }
});
