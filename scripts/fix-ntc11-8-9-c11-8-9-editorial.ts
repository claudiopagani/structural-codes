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
const profile = "ntc11-8-9-c11-8-9-editorial-formatting-0.1.0";
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
function labelled(block: Block) {
  block.kind = "list-item";
  block.listMarker = "none";
}
function emphasize(block: Block, phrase: string) {
  const text = block.text!;
  if (text.inline?.some((segment) => segment.kind === "math")) throw new Error(`Segmento matematico inatteso nel blocco da enfatizzare: ${phrase}`);
  const index = text.normalized.indexOf(phrase);
  if (index < 0) throw new Error(`Testo atteso assente: ${phrase}`);
  const before = text.normalized.slice(0, index);
  const after = text.normalized.slice(index + phrase.length);
  text.inline = [
    ...(before ? [{ kind: "text", value: before }] : []),
    { kind: "em", value: phrase },
    ...(after ? [{ kind: "text", value: after }] : []),
  ];
}
function removeEmbeddedMath(block: Block, index: number) {
  const inline = block.text!.inline!;
  const left = inline[index - 1];
  const current = inline[index];
  const right = inline[index + 1];
  if (left?.kind !== "text" || current?.kind !== "math" || current.value !== "d" || right?.kind !== "text") throw new Error("Segmentazione matematica attesa non trovata.");
  left.value += current.value + right.value;
  inline.splice(index, 2);
}

await edit(join(root, "corpus/units/ntc2018/11.8.1.json"), (unit) => {
  for (const index of [6, 7, 8]) {
    const block = unit.blocks[index]!;
    dash(block);
    emphasize(block, `Metodo ${index - 5}`);
    note(block, "Ripristinati trattino, rientro e corsivo dell’etichetta di metodo, verificati nel render della fonte ufficiale.");
  }
});
await edit(join(root, "corpus/units/ntc2018/11.8.2.json"), (unit) => {
  for (const index of [2, 3, 4, 5, 6]) {
    const block = unit.blocks[index]!;
    labelled(block);
    note(block, "Ripristinata la voce alfabetica con rientro della fonte ufficiale.");
  }
});
await edit(join(root, "corpus/units/ntc2018/11.8.5.json"), (unit) => {
  for (const index of [4, 5, 6, 7, 8, 9, 13, 14, 15, 16, 17]) {
    const block = unit.blocks[index]!;
    labelled(block);
    note(block, "Ripristinata la voce alfabetica con rientro della fonte ufficiale.");
  }
  for (const index of [19, 20]) {
    const block = unit.blocks[index]!;
    dash(block);
    note(block, "Ripristinata la voce con trattino e il relativo rientro, verificati nel render della fonte ufficiale.");
  }
});
await edit(join(root, "corpus/units/ntc2018/11.9.1.json"), (unit) => {
  for (const [index, phrase] of [[3, "Dispositivi di vincolo del tipo “a fusibile”"], [4, "Dispositivi (dinamici) di vincolo provvisorio"], [5, "Dispositivi a comportamento lineare o “Lineari”"], [6, "Dispositivi a comportamento non lineare o “Non Lineari”"], [7, "Dispositivi a comportamento viscoso o “Viscosi”"], [8, "“Isolatori”"], [10, "Isolatori elastomerici"], [11, "Isolatori a scorrimento"]] as const) {
    const block = unit.blocks[index]!;
    emphasize(block, phrase);
    note(block, "Ripristinato il corsivo della denominazione tecnica, verificato nel render della fonte ufficiale.");
  }
});
await edit(join(root, "corpus/units/ntc2018/11.9.3.json"), (unit) => {
  for (const index of [5, 6, 7]) {
    const block = unit.blocks[index]!;
    dash(block);
    note(block, "Ripristinata la voce con trattino e il relativo rientro, verificati nel render della fonte ufficiale.");
  }
});
await edit(join(root, "corpus/units/ntc2018/11.9.7.json"), (unit) => {
  const block = unit.blocks[7]!;
  removeEmbeddedMath(block, 5);
  note(block, "Rimosso il falso segmento matematico interno alla parola «corrispondente», verificando il render della fonte ufficiale.");
});
await edit(join(root, "corpus/units/circ2019/c11.8.1.json"), (unit) => {
  for (const index of [2, 3, 4, 5]) {
    const block = unit.blocks[index]!;
    dash(block);
    note(block, "Ripristinata la voce con trattino e il relativo rientro, verificati nel render della fonte ufficiale.");
  }
  for (const [index, phrase] of [[3, "alternativamente"], [4, "Certificato di Valutazione Tecnica"], [10, "sistema di controllo della produzione"], [11, "stabilimenti di produzione occasionale"]] as const) {
    const block = unit.blocks[index]!;
    emphasize(block, phrase);
    note(block, "Ripristinato il corsivo verificato nel render della fonte ufficiale.");
  }
});
await edit(join(root, "corpus/units/circ2019/c11.9.4.json"), (unit) => {
  for (const index of [7, 8, 9]) {
    const block = unit.blocks[index]!;
    dash(block);
    note(block, "Ripristinata la voce con trattino e il relativo rientro, verificati nel render della fonte ufficiale.");
  }
});
