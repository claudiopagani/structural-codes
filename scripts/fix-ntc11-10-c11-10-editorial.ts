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
const profile = "ntc11-10-c11-10-editorial-formatting-0.1.0";
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
  if (block.evidence && !block.evidence.transformations.some((entry) => entry.ruleVersion === profile)) {
    block.evidence.transformations.push({ operation: "manual-correction", ruleVersion: profile, note: text });
  }
}
function dash(block: Block) {
  const text = block.text!;
  block.kind = "list-item";
  block.listMarker = "dash";
  text.normalized = text.normalized.replace(/^[–-]\s*/, "");
  if (text.inline?.[0]?.kind === "text") {
    text.inline[0].value = text.inline[0].value.replace(/^[–-]\s*/, "");
    if (!text.inline[0].value) text.inline.shift();
  }
}
function removeEmbeddedMath(block: Block, index: number) {
  const inline = block.text!.inline!;
  const left = inline[index - 1];
  const current = inline[index];
  const right = inline[index + 1];
  if (left?.kind !== "text" || current?.kind !== "math" || current.value !== "n" || right?.kind !== "text") throw new Error("Segmentazione matematica attesa non trovata.");
  left.value += current.value + right.value;
  inline.splice(index, 2);
}
function italicHeading(block: Block, prefix: string) {
  const text = block.text!;
  if (!text.normalized.startsWith(prefix)) throw new Error(`Intestazione attesa assente: ${prefix}`);
  text.inline = [{ kind: "text", value: prefix }, { kind: "em", value: text.normalized.slice(prefix.length) }];
}

await edit(join(root, "corpus/units/ntc2018/11.10.1.1.1.json"), (unit) => {
  const block = unit.blocks[1]!;
  removeEmbeddedMath(block, 5);
  note(block, "Rimosso il falso segmento matematico interno alla parola «elementi», verificando il render della fonte ufficiale.");
});
await edit(join(root, "corpus/units/ntc2018/11.10.3.1.1.json"), (unit) => {
  const first = unit.blocks[1]!;
  removeEmbeddedMath(first, 1);
  note(first, "Rimosso il falso segmento matematico interno alla parola «resistenza», verificando il render della fonte ufficiale.");
  for (const index of [3, 4]) {
    const block = unit.blocks[index]!;
    dash(block);
    note(block, "Ripristinata la voce con trattino e il relativo rientro, verificati nel render della fonte ufficiale.");
  }
});
await edit(join(root, "corpus/units/ntc2018/11.10.3.2.1.json"), (unit) => {
  const block = unit.blocks[1]!;
  removeEmbeddedMath(block, 1);
  removeEmbeddedMath(block, 3);
  note(block, "Rimossi i falsi segmenti matematici interni alle parole «resistenza» e «seguendo», verificando il render della fonte ufficiale.");
});
await edit(join(root, "corpus/units/ntc2018/11.10.3.4.json"), (unit) => {
  for (const index of [3, 5]) {
    const block = unit.blocks[index]!;
    dash(block);
    note(block, "Ripristinata la voce con trattino e il relativo rientro, verificati nel render della fonte ufficiale.");
  }
});
for (const [file, prefix] of [["c11.10.1.1.1.1.json", "C11.10.1.1.1.1 "], ["c11.10.1.1.1.2.json", "C11.10.1.1.1.2 "]] as const) {
  await edit(join(root, "corpus/units/circ2019", file), (unit) => {
    const block = unit.blocks[0]!;
    italicHeading(block, prefix);
    note(block, "Ripristinato il corsivo del sottotitolo non numerico, verificato nel render della fonte ufficiale.");
  });
}
