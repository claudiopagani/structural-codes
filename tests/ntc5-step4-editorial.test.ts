import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
type Segment = { kind: string }; type Block = { listMarker?: string; text?: { inline?: Segment[] } }; type Unit = { blocks: Block[] }; type Asset = { pdfPage: number; captionInline?: Segment[] }; type Manifest = { tables?: Asset[]; figures?: Asset[] };
const read = async <T>(file: string) => JSON.parse(await readFile(join(process.cwd(), file), "utf8")) as T;
test("NTC 5: chiusura del capitolo conserva liste e sottotitoli", async () => {
  const dynamic = await read<Unit>("corpus/units/ntc2018/5.2.2.2.3.json");
  assert.ok([3, 4, 27, 28].every((index) => dynamic.blocks[index]?.listMarker === "dash"));
  assert.ok([18, 20].every((index) => dynamic.blocks[index]?.listMarker === "none"));
  const sle = await read<Unit>("corpus/units/ntc2018/5.2.3.2.2.1.json");
  assert.ok([1, 4, 13].every((index) => sle.blocks[index]?.text?.inline?.[0]?.kind === "em"));
});
test("NTC 5: le didascalie finali mantengono i titoli in corsivo", async () => {
  const manifest = await read<Manifest>("corpus/assets/ntc2018/5.1-step4.json"); const scoped = [...(manifest.tables ?? []), ...(manifest.figures ?? [])].filter((asset) => asset.pdfPage >= 182 && asset.pdfPage <= 185);
  assert.ok(scoped.length > 0 && scoped.every((asset) => asset.captionInline?.some((segment) => segment.kind === "em")));
});
