import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

type Inline = { kind: "text" | "em" | "math"; value: string; latex?: string };
type Evidence = { rawSha256: string; normalizedSha256: string; transformations: Array<{ operation: string; ruleVersion: string; note: string }>; [key: string]: unknown };
type Block = { blockId: string; kind: string; listMarker?: "dash" | "none"; listLevel?: number; text?: { raw: string; normalized: string; inline?: Inline[]; normalizationVersion?: string }; evidence?: Evidence; [key: string]: unknown };
type Unit = { blocks: Block[] };
type Manifest = { tables: Array<{ officialNumber: string | null; caption: string | null; captionInline?: Inline[] }> };

const root = fileURLToPath(new URL("../", import.meta.url));
const profile = "ntc11-3-step1-c11-3-editorial-formatting-0.1.0";
const dashNote = "Il trattino tipografico della fonte è rappresentato dal marcatore strutturale; il testo della voce conserva soltanto la descrizione.";
const labelNote = "La label ufficiale è mantenuta nel testo e resa senza un marcatore aggiuntivo, per allineare la descrizione.";
const italicNote = "Ripristinato il corsivo verificato nel render della fonte ufficiale.";

function sha256(value: string) { return createHash("sha256").update(value, "utf8").digest("hex"); }
function record(block: Block, note: string) {
  assert.ok(block.text && block.evidence, `Evidence assente: ${block.blockId}`);
  block.evidence.normalizedSha256 = sha256(block.text.normalized);
  if (!block.evidence.transformations.some((entry) => entry.ruleVersion === profile && entry.note === note)) block.evidence.transformations.push({ operation: "manual-correction", ruleVersion: profile, note });
}
function inline(block: Block): Inline[] {
  assert.ok(block.text, `Testo assente: ${block.blockId}`);
  const value = block.text.inline ? structuredClone(block.text.inline) : [{ kind: "text" as const, value: block.text.normalized }];
  assert.equal(value.map((segment) => segment.value).join(""), block.text.normalized, `Inline incoerente: ${block.blockId}`);
  return value;
}
function dash(block: Block) {
  assert.ok(block.text, `Testo assente: ${block.blockId}`);
  block.kind = "list-item";
  block.text.normalized = block.text.normalized.replace(/^[–—-]\s+/u, "");
  block.text.inline = inline(block);
  block.listMarker = "dash";
  delete block.listLevel;
  record(block, dashNote);
}
function label(block: Block, value: string) {
  assert.ok(block.text, `Testo assente: ${block.blockId}`);
  block.kind = "list-item";
  if (!block.text.normalized.startsWith(value)) block.text.normalized = `${value} ${block.text.normalized}`;
  block.text.inline = [{ kind: "text", value: block.text.normalized }];
  block.listMarker = "none";
  delete block.listLevel;
  record(block, labelNote);
}
function em(block: Block, phrases: string[]) {
  assert.ok(block.text, `Testo assente: ${block.blockId}`);
  const marks = phrases.map((phrase) => {
    const index = block.text!.normalized.indexOf(phrase);
    assert.notEqual(index, -1, `Corsivo assente: ${phrase}`);
    return { index, end: index + phrase.length };
  }).sort((a, b) => a.index - b.index);
  assert.ok(marks.every((mark, index) => index === 0 || marks[index - 1]!.end <= mark.index), `Corsivi sovrapposti: ${block.blockId}`);
  const result: Inline[] = [];
  let offset = 0;
  for (const segment of inline(block)) {
    const end = offset + segment.value.length;
    if (segment.kind === "math") { assert.ok(!marks.some((mark) => mark.index < end && mark.end > offset), `Corsivo attraversa matematica: ${block.blockId}`); result.push(segment); offset = end; continue; }
    const cuts = [offset, end, ...marks.flatMap((mark) => [mark.index, mark.end]).filter((cut) => cut > offset && cut < end)].sort((a, b) => a - b);
    for (let index = 0; index < cuts.length - 1; index += 1) {
      const start = cuts[index]!; const stop = cuts[index + 1]!; const value = block.text.normalized.slice(start, stop);
      if (value) result.push({ kind: marks.some((mark) => mark.index <= start && mark.end >= stop) ? "em" : "text", value });
    }
    offset = end;
  }
  block.text.inline = result;
  record(block, italicNote);
}
function emQuotes(block: Block) {
  assert.ok(block.text);
  const ranges: Array<{ start: number; end: number }> = [];
  let offset = 0;
  for (const segment of inline(block)) { if (segment.kind === "math") ranges.push({ start: offset, end: offset + segment.value.length }); offset += segment.value.length; }
  const quotes = [...block.text.normalized.matchAll(/“[^”]+”/gu)].filter((match) => !ranges.some((range) => match.index! < range.end && match.index! + match[0].length > range.start)).map((match) => match[0]);
  if (quotes.length) em(block, quotes);
}
async function unit(document: "ntc2018" | "circ2019", name: string, edit: (record: Unit) => void) {
  const path = join(root, "corpus", "units", document, `${name}.json`); const record = JSON.parse(await readFile(path, "utf8")) as Unit; edit(record); await writeFile(path, `${JSON.stringify(record, null, 2)}\n`, "utf8");
}
async function manifest(edit: (record: Manifest) => void) {
  const path = join(root, "corpus", "assets", "ntc2018", "11-step2.json"); const record = JSON.parse(await readFile(path, "utf8")) as Manifest; edit(record); await writeFile(path, `${JSON.stringify(record, null, 2)}\n`, "utf8");
}
function caption(record: Manifest, number: string) {
  const table = record.tables.find((entry) => entry.officialNumber === number); assert.ok(table?.caption);
  const descriptor = table.caption.replace(/^\s*Tab(?:ella|\.)\s*[^–—-]+\s*[–—-]\s*/iu, ""); assert.notEqual(descriptor, table.caption);
  table.captionInline = [{ kind: "text", value: table.caption.slice(0, table.caption.length - descriptor.length) }, { kind: "em", value: descriptor }];
}

await unit("ntc2018", "11.3.1.1", (record) => {
  if (record.blocks[2]!.blockId.endsWith("a")) {
    const version = record.blocks[5]!.text!.normalizationVersion;
    for (const block of record.blocks.slice(2, 5)) block.text!.normalizationVersion = version;
    em(record.blocks[5]!, ["Lotto di produzione"]); return;
  }
  const merged = record.blocks[2]!; assert.ok(merged.text && merged.evidence);
  const parts = merged.text.normalized.split("ȭ ").filter(Boolean); const raw = merged.text.raw.split("\n").map((part) => part.replace(/^ȭ\s*/u, ""));
  assert.equal(parts.length, 3); assert.equal(raw.length, 3);
  const entries = parts.map((value, index) => ({ ...structuredClone(merged), blockId: `${merged.blockId}${String.fromCharCode(97 + index)}`, kind: "list-item", listMarker: "dash" as const, text: { raw: raw[index]!, normalized: value.trim(), normalizationVersion: merged.text!.normalizationVersion }, evidence: { ...structuredClone(merged.evidence), rawSha256: sha256(raw[index]!), normalizedSha256: sha256(value.trim()), transformations: [{ operation: "manual-correction", ruleVersion: profile, note: "Separate le tre forme di controllo, stampate come elenco nella fonte ufficiale." }] } }));
  record.blocks.splice(2, 1, ...entries); em(record.blocks[5]!, ["Lotto di produzione"]);
});
await unit("ntc2018", "11.3.1.2", (record) => { for (let index = 6; index <= 16; index += 1) label(record.blocks[index]!, `${index - 5})`); for (let index = 21; index <= 24; index += 1) dash(record.blocks[index]!); });
await unit("ntc2018", "11.3.1.3", (record) => { for (let index = 2; index <= 5; index += 1) label(record.blocks[index]!, `${index - 1})`); });
await unit("ntc2018", "11.3.1.6", (record) => { for (let index = 4; index <= 11; index += 1) dash(record.blocks[index]!); });
await unit("ntc2018", "11.3.1.7", (record) => { for (const [index, value] of [[17, "a)"], [18, "b)"], [19, "c)"]] as const) label(record.blocks[index]!, value); });
await unit("ntc2018", "11.3.2.4", (record) => { for (const index of [4, 5]) dash(record.blocks[index]!); });
for (const [name, phrase] of [["11.3.2.10.1.1", "Generalità"], ["11.3.2.10.1.2", "Prove di qualificazione"], ["11.3.2.10.1.3", "Procedura di valutazione"], ["11.3.2.10.1.4", "Prove periodiche di verifica della qualità"]] as const) await unit("ntc2018", name, (record) => em(record.blocks[0]!, [phrase]));
await unit("ntc2018", "11.3.2.10.1.3", (record) => em(record.blocks[1]!, ["Valutazione dei risultati"]));
await manifest((record) => { for (const number of ["11.3.II", "11.3.IV", "11.3.V"]) caption(record, number); });

for (const name of ["c11.3.1.5", "c11.3.1.7", "c11.3.2.5", "c11.3.2.8.2", "c11.3.2.10.3", "c11.3.4.5"]) await unit("circ2019", name, (record) => { for (const block of record.blocks) if (block.text) emQuotes(block); });
await unit("circ2019", "c11.3.1.1", (record) => { for (const index of [2, 3, 4]) dash(record.blocks[index]!); em(record.blocks[2]!, ["lotti di produzione"]); em(record.blocks[3]!, ["forniture"]); em(record.blocks[4]!, ["lotti di spedizione"]); });
await unit("circ2019", "c11.3.1.2", (record) => { for (const index of [2, 3]) dash(record.blocks[index]!); });
await unit("circ2019", "c11.3.1.5", (record) => { label(record.blocks[2]!, "A)"); for (const index of [3, 4, 5, 7, 8, 9]) dash(record.blocks[index]!); label(record.blocks[6]!, "B)"); });
await unit("circ2019", "c11.3.1.7", (record) => { for (let index = 4; index <= 14; index += 1) dash(record.blocks[index]!); em(record.blocks[3]!, ["Linee Guida per la messa in opera del calcestruzzo strutturale"]); emQuotes(record.blocks[8]!); });
await unit("circ2019", "c11.3.2.1", (record) => { for (const index of [6, 7, 8]) dash(record.blocks[index]!); });
await unit("circ2019", "c11.3.2.4", (record) => { for (const index of [2, 3]) dash(record.blocks[index]!); });
await unit("circ2019", "c11.3.2.10.4", (record) => { for (const index of [4, 7]) dash(record.blocks[index]!); em(record.blocks[1]!, ["Beam-test"]); em(record.blocks[2]!, ["Beam-test"]); emQuotes(record.blocks[7]!); });
await unit("circ2019", "c11.3.4.6", (record) => { for (const index of [3, 4, 5]) dash(record.blocks[index]!); });
await unit("circ2019", "c11.3.4.10", (record) => { for (const index of [4, 5, 6, 7]) dash(record.blocks[index]!); });
await unit("circ2019", "c11.3.3.5.2.1", (record) => em(record.blocks[0]!, ["Prove di qualificazione"]));
await unit("circ2019", "c11.3.4.1", (record) => em(record.blocks[0]!, ["GENERALITÀ"]));
await unit("circ2019", "c11.3.4.11.2.1", (record) => em(record.blocks[0]!, ["Centri di produzione di lamiere grecate e profilati formati a freddo"]));
