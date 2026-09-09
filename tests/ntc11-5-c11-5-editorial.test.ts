import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

type Unit = { blocks: Array<{ text?: { normalized: string; inline?: Array<{ kind: string; value: string }> } }> };

async function block(document: string, index: number) {
  const unit = JSON.parse(await readFile(join(process.cwd(), "corpus", "units", document), "utf8")) as Unit;
  return unit.blocks[index]?.text;
}

test("11.5 conserva in corsivo i titoli delle Linee guida", async () => {
  const first = await block(join("ntc2018", "11.5.1.json"), 2);
  const second = await block(join("ntc2018", "11.5.2.json"), 2);
  assert.ok(first?.inline?.some((segment) => segment.kind === "em" && segment.value === "Linea guida per la certificazione dell’idoneità tecnica dei sistemi di precompressione a cavi post-tesi"));
  assert.ok(second?.inline?.some((segment) => segment.kind === "em" && segment.value === "Linea Guida per il rilascio della certificazione di idoneità tecnica all’impiego di tiranti per uso geotecnico di tipo attivo"));
});

test("C11.5 conserva il corsivo di CPR e lo spazio ufficiale dopo EAD", async () => {
  const text = await block(join("circ2019", "c11.5.1.json"), 3);
  assert.equal(text?.normalized.includes("(EAD) fino"), true);
  assert.ok(text?.inline?.some((segment) => segment.kind === "em" && segment.value === "CPR"));
});
