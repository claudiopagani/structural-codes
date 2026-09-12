import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

type Segment = { kind: string };
type Block = { kind: string; listMarker?: string; text?: { inline?: Segment[] } };
type Unit = { blocks: Block[] };
type Asset = { captionInline?: Segment[] };
type Manifest = { tables: Asset[]; figures: Asset[] };
const read = async <T>(file: string) => JSON.parse(await readFile(join(process.cwd(), file), "utf8")) as T;

test("capitolo 5 conserva i marker, il corsivo e la matematica inline verificati", async () => {
  const ntc = await read<Unit>("corpus/units/ntc2018/5.1.3.3.3.json");
  assert.ok(ntc.blocks.slice(2, 8).every((block) => block.text?.inline?.[0]?.kind === "em"));
  const circ = await read<Unit>("corpus/units/circ2019/c5.1.2.3.json");
  assert.ok(circ.blocks.filter((block) => block.kind === "list-item").every((block) => block.listMarker === "dash"));
  const rail = await read<Unit>("corpus/units/circ2019/c5.2.2.5.json");
  assert.ok(rail.blocks.slice(2, 7).every((block) => block.text?.inline?.some((segment) => segment.kind === "math")));
});

test("le caption del primo step mantengono numero e titolo in corsivo", async () => {
  const assets = await read<Manifest>("corpus/assets/ntc2018/5.1-step1.json");
  assert.ok([...assets.tables, ...assets.figures].every((asset) => asset.captionInline?.some((segment) => segment.kind === "em")));
});
