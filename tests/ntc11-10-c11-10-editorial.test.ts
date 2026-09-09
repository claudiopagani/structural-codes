import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

type Block = { kind: string; listMarker?: string; text?: { normalized: string; inline?: Array<{ kind: string; value: string }> } };
type Unit = { blocks: Block[] };
const read = async (file: string) => JSON.parse(await readFile(join(process.cwd(), "corpus", "units", file), "utf8")) as Unit;

test("NTC 11.10 mantiene voci con trattino e non spezza parole in matematica", async () => {
  const checks = await read("ntc2018/11.10.3.1.1.json");
  assert.ok([3, 4].every((index) => checks.blocks[index]?.kind === "list-item" && checks.blocks[index]?.listMarker === "dash"));
  assert.ok(!checks.blocks[1]?.text?.inline?.some((segment) => segment.kind === "math" && segment.value === "n"));
  const shear = await read("ntc2018/11.10.3.2.1.json");
  assert.equal(shear.blocks[1]?.text?.inline?.filter((segment) => segment.kind === "math" && segment.value === "n").length, 0);
  assert.ok(shear.blocks[1]?.text?.inline?.some((segment) => segment.kind === "math" && segment.value === "(n ≥ 6)"));
});

test("C11.10 conserva in corsivo i sottotitoli descrittivi", async () => {
  const vertical = await read("circ2019/c11.10.1.1.1.1.json");
  assert.equal(vertical.blocks[0]?.text?.inline?.[1]?.kind, "em");
  const orthogonal = await read("circ2019/c11.10.1.1.1.2.json");
  assert.equal(orthogonal.blocks[0]?.text?.inline?.[1]?.kind, "em");
});
