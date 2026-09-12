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

test("NTC 5: pagine 172-181 preservano marker ed evidenziazione interna", async () => {
  const braking = await read<Unit>("corpus/units/ntc2018/5.2.2.3.3.json");
  assert.ok(braking.blocks.slice(10, 14).every((block) => block.listMarker === "dash"));
  const temperature = await read<Unit>("corpus/units/ntc2018/5.2.2.4.2.json");
  assert.equal(temperature.blocks[3]?.text?.inline?.[0]?.kind, "em");
  const catenary = await read<Unit>("corpus/units/ntc2018/5.2.2.9.1.json");
  assert.ok(catenary.blocks.slice(3, 6).every((block) => block.listMarker === "none"));
});

test("NTC 5: didascalie delle pagine 172-181 mantengono i titoli in corsivo", async () => {
  const manifest = await read<Manifest>("corpus/assets/ntc2018/5.1-step3.json");
  const scoped = [...(manifest.tables ?? []), ...(manifest.figures ?? [])].filter((asset) => asset.pdfPage >= 172 && asset.pdfPage <= 181);
  assert.ok(scoped.length > 0 && scoped.every((asset) => asset.captionInline?.some((segment) => segment.kind === "em")));
});
