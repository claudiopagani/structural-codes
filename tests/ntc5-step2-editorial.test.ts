import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

type Segment = { kind: string };
type Block = { kind: string; listMarker?: string; text?: { inline?: Segment[] } };
type Unit = { blocks: Block[] };
type Asset = { pdfPage: number; captionInline?: Segment[] };
type Manifest = { tables?: Asset[]; figures?: Asset[] };
const read = async <T>(file: string) => JSON.parse(await readFile(join(process.cwd(), file), "utf8")) as T;

test("NTC 5: pagine 162-171 conservano marker, corsivo e matematica inline", async () => {
  const seismic = await read<Unit>("corpus/units/ntc2018/5.1.6.3.json");
  assert.ok(seismic.blocks.filter((block) => block.kind === "list-item").every((block) => block.listMarker === "dash"));
  const railway = await read<Unit>("corpus/units/ntc2018/5.2.2.2.1.1.json");
  assert.ok(railway.blocks.slice(3, 5).every((block) => block.listMarker === "dash" && block.text?.inline?.some((segment) => segment.kind === "math")));
  const distribution = await read<Unit>("corpus/units/ntc2018/5.2.2.2.1.4.json");
  assert.ok([1, 4, 10].every((index) => distribution.blocks[index]?.text?.inline?.some((segment) => segment.kind === "em")));
});

test("NTC 5: didascalie delle pagine 162-171 mantengono il titolo in corsivo", async () => {
  const assets = await read<Manifest>("corpus/assets/ntc2018/5.1-step2.json");
  const inScope = [...(assets.tables ?? []), ...(assets.figures ?? [])].filter((asset) => asset.pdfPage >= 162 && asset.pdfPage <= 171);
  assert.ok(inScope.length > 0 && inScope.every((asset) => asset.captionInline?.some((segment) => segment.kind === "em")));
});
