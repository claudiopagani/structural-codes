import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

type Block = { kind: string; listMarker?: string; text?: { normalized: string; inline?: Array<{ kind: string; value: string }> } };
type Unit = { blocks: Block[] };
const root = process.cwd();
async function unit(name: string): Promise<Unit> { return JSON.parse(await readFile(join(root, "corpus", "units", "ntc2018", `${name}.json`), "utf8")) as Unit; }
function em(record: Unit, phrase: string) { return record.blocks.some((block) => block.text?.inline?.some((segment) => segment.kind === "em" && segment.value === phrase)); }

test("NTC 11.3 step 3 conserva gli elenchi della carpenteria e le relative label", async () => {
  const [control, laminated, centres, acceptance] = await Promise.all([unit("11.3.3.5.3"), unit("11.3.4.2"), unit("11.3.4.10"), unit("11.3.4.11.3")]);
  assert.equal(control.blocks.filter((block) => block.listMarker === "dash").length, 5);
  assert.equal(laminated.blocks.filter((block) => block.listMarker === "dash").length, 12);
  assert.equal(centres.blocks.filter((block) => block.listMarker === "dash").length, 7);
  assert.ok(em(centres, "centri di prelavorazione o di servizio"));
  assert.equal(acceptance.blocks.filter((block) => block.listMarker === "dash").length, 4);
  assert.ok(em(acceptance, "Lamiere grecate e profili formati a freddo"));
});

test("NTC 11.3 ricolloca i prodotti zincati e separa la prosa dall’elenco", async () => {
  const [preceding, zinc, studs, qualifications] = await Promise.all([unit("11.3.3.5.5"), unit("11.3.3.5.6"), unit("11.3.4.7"), unit("11.3.4.11.1.2")]);
  assert.equal(preceding.blocks.length, 3);
  assert.equal(zinc.blocks.length, 5);
  assert.equal(studs.blocks.filter((block) => block.listMarker === "dash").length, 2);
  assert.ok(studs.blocks.some((block) => block.kind === "paragraph" && block.text?.normalized.startsWith("Quando i connettori vengono uniti")));
  assert.ok(qualifications.blocks[0]?.text?.inline?.some((segment) => segment.kind === "em" && segment.value.includes("Prove di qualificazione")));
});
