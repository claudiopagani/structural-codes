import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

type Inline = { kind: "text" | "em"; value: string };
type Block = {
  text?: { raw: string; normalized: string; inline?: Inline[] };
  evidence?: {
    rawSha256: string;
    normalizedSha256: string;
    transformations: Array<{ operation: string; ruleVersion: string; note: string }>;
  };
};
type Unit = { blocks: Block[] };

const root = fileURLToPath(new URL("../", import.meta.url));
const profile = "ntc11-5-c11-5-editorial-formatting-0.1.0";
const sha256 = (value: string) => createHash("sha256").update(value, "utf8").digest("hex");

async function segmentEmphasis(
  path: string,
  blockIndex: number,
  phrase: string,
  note: string,
): Promise<void> {
  const unit = JSON.parse(await readFile(path, "utf8")) as Unit;
  const block = unit.blocks[blockIndex];
  assert.ok(block?.text && block.evidence, `Blocco atteso assente: ${path}#${blockIndex}`);
  const index = block.text.normalized.indexOf(phrase);
  assert.notEqual(index, -1, `Testo corsivo atteso assente: ${phrase}`);
  const before = block.text.normalized.slice(0, index);
  const after = block.text.normalized.slice(index + phrase.length);
  block.text.inline = [
    { kind: "text", value: before },
    { kind: "em", value: phrase },
    { kind: "text", value: after },
  ];
  block.evidence.rawSha256 = sha256(block.text.raw);
  block.evidence.normalizedSha256 = sha256(block.text.normalized);
  if (!block.evidence.transformations.some((entry) => entry.ruleVersion === profile)) {
    block.evidence.transformations.push({ operation: "manual-correction", ruleVersion: profile, note });
  }
  await writeFile(path, `${JSON.stringify(unit, null, 2)}\n`, "utf8");
}

await segmentEmphasis(
  join(root, "corpus", "units", "ntc2018", "11.5.1.json"),
  2,
  "Linea guida per la certificazione dell’idoneità tecnica dei sistemi di precompressione a cavi post-tesi",
  "Ripristinato il corsivo del titolo della Linea guida verificato nel render della fonte ufficiale.",
);
await segmentEmphasis(
  join(root, "corpus", "units", "ntc2018", "11.5.2.json"),
  2,
  "Linea Guida per il rilascio della certificazione di idoneità tecnica all’impiego di tiranti per uso geotecnico di tipo attivo",
  "Ripristinato il corsivo del titolo della Linea Guida verificato nel render della fonte ufficiale.",
);
await segmentEmphasis(
  join(root, "corpus", "units", "circ2019", "c11.5.1.json"),
  3,
  "CPR",
  "Ripristinato il corsivo di CPR verificato nel render della fonte ufficiale.",
);
