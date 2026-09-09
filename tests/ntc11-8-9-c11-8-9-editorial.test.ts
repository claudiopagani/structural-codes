import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

type Block = { kind: string; listMarker?: string; text?: { normalized: string; inline?: Array<{ kind: string; value: string }> } };
type Unit = { blocks: Block[] };
const read = async (file: string) => JSON.parse(await readFile(join(process.cwd(), "corpus", "units", file), "utf8")) as Unit;

test("NTC 11.8–11.9 conserva rientri, corsivi e segmenti matematici", async () => {
  const methods = await read("ntc2018/11.8.1.json");
  assert.ok([6, 7, 8].every((index) => methods.blocks[index]?.kind === "list-item" && methods.blocks[index]?.listMarker === "dash"));
  assert.ok(methods.blocks[6]?.text?.inline?.some((segment) => segment.kind === "em" && segment.value === "Metodo 1"));
  const letters = await read("ntc2018/11.8.5.json");
  assert.ok([4, 5, 6, 7, 8, 9, 13, 14, 15, 16, 17].every((index) => letters.blocks[index]?.kind === "list-item" && letters.blocks[index]?.listMarker === "none"));
  const elastic = await read("ntc2018/11.9.7.json");
  assert.ok(!elastic.blocks[7]?.text?.inline?.some((segment) => segment.kind === "math" && segment.value === "d"));
});

test("C11.8–C11.9 conserva i trattini e il corsivo verificati", async () => {
  const prefab = await read("circ2019/c11.8.1.json");
  assert.ok([2, 3, 4, 5].every((index) => prefab.blocks[index]?.kind === "list-item" && prefab.blocks[index]?.listMarker === "dash"));
  assert.ok(prefab.blocks[3]?.text?.inline?.some((segment) => segment.kind === "em" && segment.value === "alternativamente"));
  const linear = await read("circ2019/c11.9.4.json");
  assert.ok([7, 8, 9].every((index) => linear.blocks[index]?.kind === "list-item" && linear.blocks[index]?.listMarker === "dash"));
  assert.ok(linear.blocks[7]?.text?.normalized.startsWith("d è"));
});
