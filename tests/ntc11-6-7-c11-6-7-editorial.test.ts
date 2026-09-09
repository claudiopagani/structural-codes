import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

type Unit = { blocks: Array<{ kind: string; listMarker?: string; text?: { normalized: string; inline?: Array<{ kind: string; value: string }> } }> };
const read = async (file: string) => JSON.parse(await readFile(join(process.cwd(), "corpus", "units", file), "utf8")) as Unit;

test("11.7 conserva corsivo citato e marcatori degli elenchi", async () => {
  const first = await read("ntc2018/11.7.1.json");
  assert.ok(first.blocks[1]?.text?.inline?.some((segment) => segment.kind === "em" && segment.value.startsWith("Linee Guida")));
  const list = await read("ntc2018/11.7.9.1.json");
  assert.ok(list.blocks.slice(2, 10).every((block) => block.kind === "list-item" && block.listMarker === "dash"));
});

test("C11.7 ripristina liste, corsivo e testo non matematico", async () => {
  const laminated = await read("circ2019/c11.7.4.json");
  assert.equal(laminated.blocks[2]?.text?.inline, undefined);
  const panels = await read("circ2019/c11.7.5.json");
  assert.ok(panels.blocks[1]?.text?.inline?.some((segment) => segment.kind === "em" && segment.value.startsWith("Linee Guida")));
  const controls = await read("circ2019/c11.7.10.2.json");
  assert.ok([2, 3, 5, 6, 7].every((index) => controls.blocks[index]?.kind === "list-item" && controls.blocks[index]?.listMarker === "dash"));
});
