import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

type Unit = { blocks: Array<{ text?: { normalized: string; inline?: Array<{ kind: string; value: string }> } }> };

test("C11.4 conserva il corsivo di CPR senza alterare il testo ufficiale", async () => {
  const unit = JSON.parse(await readFile(join(process.cwd(), "corpus", "units", "circ2019", "c11.4.json"), "utf8")) as Unit;
  const block = unit.blocks[2]?.text;
  assert.equal(block?.normalized.includes("(EAD)fino"), true);
  assert.ok(block?.inline?.some((segment) => segment.kind === "em" && segment.value === "CPR"));
});
