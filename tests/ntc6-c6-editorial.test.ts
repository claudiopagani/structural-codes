import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
type Block = { kind: string; listMarker?: string }; type Unit = { blocks: Block[] };
const unit = async (file: string) => JSON.parse(await readFile(join(process.cwd(), file), "utf8")) as Unit;
test("NTC 6 e C6 conservano i marker editoriali verificati", async () => {
  const ntc = await unit("corpus/units/ntc2018/6.4.2.1.json");
  assert.deepEqual(ntc.blocks.slice(5, 11).map((block) => block.listMarker), ["bullet", "dash", "dash", "dash", "bullet", "dash"]);
  const final = await unit("corpus/units/ntc2018/6.12.json");
  assert.ok(final.blocks.slice(2).every((block) => block.listMarker === "none"));
  const circ = await unit("corpus/units/circ2019/c6.2.2.5.json");
  assert.ok(circ.blocks.filter((block) => block.kind === "list-item").every((block) => block.listMarker === "dash"));
});
