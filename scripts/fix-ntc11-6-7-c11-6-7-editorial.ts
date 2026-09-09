import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

type Segment = { kind: string; value: string; latex?: string };
type Block = {
  kind: string;
  listMarker?: string;
  text?: { raw: string; normalized: string; inline?: Segment[] };
  evidence?: { rawSha256: string; normalizedSha256: string; transformations: Array<{ operation: string; ruleVersion: string; note: string }> };
};
type Unit = { blocks: Block[] };
const root = fileURLToPath(new URL("../", import.meta.url));
const profile = "ntc11-6-7-c11-6-7-editorial-formatting-0.1.0";
const hash = (value: string) => createHash("sha256").update(value, "utf8").digest("hex");

async function edit(path: string, apply: (unit: Unit) => void) {
  const unit = JSON.parse(await readFile(path, "utf8")) as Unit;
  apply(unit);
  for (const block of unit.blocks) {
    if (block.text && block.evidence) {
      block.evidence.rawSha256 = hash(block.text.raw);
      block.evidence.normalizedSha256 = hash(block.text.normalized);
    }
  }
  await writeFile(path, `${JSON.stringify(unit, null, 2)}\n`, "utf8");
}
function note(block: Block, text: string) {
  if (block.evidence && !block.evidence.transformations.some((entry) => entry.ruleVersion === profile)) block.evidence.transformations.push({ operation: "manual-correction", ruleVersion: profile, note: text });
}
function emphasize(block: Block, phrase: string) {
  const text = block.text!; const index = text.normalized.indexOf(phrase);
  if (index < 0) throw new Error(`Testo atteso assente: ${phrase}`);
  text.inline = [{ kind: "text", value: text.normalized.slice(0, index) }, { kind: "em", value: phrase }, { kind: "text", value: text.normalized.slice(index + phrase.length) }];
}
function dash(block: Block) {
  block.kind = "list-item"; block.listMarker = "dash";
  const text = block.text!;
  if (!text.normalized.startsWith("- ")) {
    text.normalized = `- ${text.normalized}`;
    if (text.inline) text.inline = [{ kind: "text", value: "- " }, ...text.inline];
  }
}

await edit(join(root, "corpus/units/ntc2018/11.7.1.json"), (unit) => { emphasize(unit.blocks[1]!, "Linee Guida per l’impiego di prodotti , materiali e manufatti innovativi in legno per uso strutturale"); note(unit.blocks[1]!, "Ripristinato il corsivo del titolo citato, verificato nel render della fonte ufficiale."); });
for (const file of ["11.7.9.1.json", "11.7.9.2.json", "11.7.10.1.json", "11.7.10.1.2.json"]) await edit(join(root, "corpus/units/ntc2018", file), (unit) => unit.blocks.filter((block) => block.kind === "list-item" && block.text?.normalized.startsWith("- ")).forEach((block) => { block.listMarker = "dash"; note(block, "Esplicitato il marcatore con trattino verificato nel render della fonte ufficiale."); }));
await edit(join(root, "corpus/units/circ2019/c11.7.4.json"), (unit) => { const block = unit.blocks[2]!; delete block.text!.inline; note(block, "Rimosso il falso segmento matematico interno alla parola «Armonizzata», verificando il render della fonte ufficiale."); });
await edit(join(root, "corpus/units/circ2019/c11.7.5.json"), (unit) => { emphasize(unit.blocks[1]!, "Linee Guida per l’Impiego di prodotti, materiali e manufatti innovativi in legno per uso strutturale"); note(unit.blocks[1]!, "Ripristinato il corsivo del titolo citato, verificato nel render della fonte ufficiale."); });
for (const [file, indexes] of [["c11.7.10.1.json", [4, 5, 8, 9, 10]], ["c11.7.10.2.json", [2, 3, 5, 6, 7]]] as const) await edit(join(root, "corpus/units/circ2019", file), (unit) => indexes.forEach((index) => { const block = unit.blocks[index]!; dash(block); note(block, "Ripristinata la voce con trattino e il relativo rientro, verificati nel render della fonte ufficiale."); }));
