import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

type Unit = { blocks: Array<{ kind: string; listMarker?: string; text?: { normalized: string } }> };

test("NTC 12 conserva le sette voci con trattino strutturato", async () => {
  const unit = JSON.parse(await readFile(join(process.cwd(), "corpus/units/ntc2018/12.json"), "utf8")) as Unit;
  const entries = [2, 3, 4, 6, 7, 8, 9].map((index) => unit.blocks[index]);
  assert.equal(entries.length, 7);
  assert.ok(entries.every((block) => block?.kind === "list-item" && block.listMarker === "dash"));
  assert.ok(entries.every((block) => block?.text?.normalized && !block.text.normalized.startsWith("- ")));
});
