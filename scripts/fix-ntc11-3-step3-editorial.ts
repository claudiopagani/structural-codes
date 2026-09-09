import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

type Inline = { kind: "text" | "em" | "math"; value: string; latex?: string };
type Evidence = { rawSha256: string; normalizedSha256: string; transformations: Array<{ operation: string; ruleVersion: string; note: string }> };
type Block = { blockId: string; kind: string; listMarker?: "dash" | "none"; listLevel?: number; text?: { raw: string; normalized: string; inline?: Inline[]; normalizationVersion?: string }; evidence?: Evidence };
type Unit = { blocks: Block[] };

const root = fileURLToPath(new URL("../", import.meta.url));
const profile = "ntc11-3-step3-editorial-formatting-0.1.0";
const dashNote = "Il trattino tipografico della fonte è rappresentato dal marcatore strutturale; il testo della voce conserva soltanto la descrizione.";
const italicNote = "Ripristinato il corsivo verificato nel render della fonte ufficiale.";
function sha256(value: string) { return createHash("sha256").update(value, "utf8").digest("hex"); }
function content(block: Block) { assert.ok(block.text, `Testo assente: ${block.blockId}`); return block.text; }
function audit(block: Block, note: string) {
  assert.ok(block.evidence); const value = content(block); block.evidence.rawSha256 = sha256(value.raw); block.evidence.normalizedSha256 = sha256(value.normalized);
  if (!block.evidence.transformations.some((entry) => entry.ruleVersion === profile && entry.note === note)) block.evidence.transformations.push({ operation: "manual-correction", ruleVersion: profile, note });
}
function inline(block: Block): Inline[] { const value = content(block); const result = value.inline ? structuredClone(value.inline) : [{ kind: "text" as const, value: value.normalized }]; assert.equal(result.map((segment) => segment.value).join(""), value.normalized, `Inline incoerente: ${block.blockId}`); return result; }
function sliceInline(value: Inline[], start: number, end?: number) { const result: Inline[] = []; let offset = 0; for (const segment of value) { const stop = offset + segment.value.length; const from = Math.max(start, offset); const to = Math.min(end ?? stop, stop); if (from < to) result.push({ ...segment, value: segment.value.slice(from - offset, to - offset) }); offset = stop; } return result; }
function dash(block: Block) { if (block.listMarker === "dash") return; const value = content(block); const marker = value.normalized.match(/^[–—-]\s+/u); assert.ok(marker, `Trattino assente: ${block.blockId}`); const old = inline(block); value.normalized = value.normalized.slice(marker[0].length); value.inline = sliceInline(old, marker[0].length); block.kind = "list-item"; block.listMarker = "dash"; delete block.listLevel; audit(block, dashNote); }
function emEntire(block: Block) { const value = content(block); value.inline = inline(block).map((segment) => segment.kind === "math" ? segment : { kind: "em", value: segment.value }); audit(block, italicNote); }
function em(block: Block, phrase: string) {
  const value = content(block); const start = value.normalized.indexOf(phrase); assert.notEqual(start, -1, `Corsivo assente: ${phrase}`); const end = start + phrase.length; const result: Inline[] = []; let offset = 0;
  for (const segment of inline(block)) { const stop = offset + segment.value.length; if (segment.kind === "math") { assert.ok(end <= offset || start >= stop, `Corsivo attraversa matematica: ${block.blockId}`); result.push(segment); } else { const cuts = [offset, stop, start, end].filter((cut) => cut >= offset && cut <= stop).sort((a, b) => a - b); for (let index = 0; index < cuts.length - 1; index += 1) { const from = cuts[index]!; const to = cuts[index + 1]!; if (from < to) result.push({ kind: from >= start && to <= end ? "em" : "text", value: value.normalized.slice(from, to) }); } } offset = stop; }
  value.inline = result; audit(block, italicNote);
}
async function unit(name: string, edit: (record: Unit) => void) { const path = join(root, "corpus", "units", "ntc2018", `${name}.json`); const record = JSON.parse(await readFile(path, "utf8")) as Unit; edit(record); await writeFile(path, `${JSON.stringify(record, null, 2)}\n`, "utf8"); }
function splitListContinuation(record: Unit, continuation: string) {
  const index = record.blocks.findIndex((block) => (block.listMarker === "dash" || /^[–—-]\s+/u.test(block.text?.normalized ?? "")) && block.text?.normalized.includes(continuation)); if (index === -1) return;
  const item = record.blocks[index]!; const value = content(item); const old = inline(item); const markerLength = item.listMarker === "dash" ? 0 : value.normalized.match(/^[–—-]\s+/u)?.[0].length; assert.ok(markerLength !== undefined); const pivot = value.normalized.indexOf(continuation); assert.ok(pivot > markerLength); const rawLines = value.raw.split("\n"); const itemRaw = rawLines.shift()!.replace(/^[–—-]\s*/u, ""); const paragraphRaw = rawLines.join("\n");
  const paragraph = structuredClone(item); paragraph.blockId = `${item.blockId}-continuation`; paragraph.kind = "paragraph"; delete paragraph.listMarker; delete paragraph.listLevel; paragraph.text = { raw: paragraphRaw, normalized: value.normalized.slice(pivot), inline: sliceInline(old, pivot), normalizationVersion: value.normalizationVersion }; paragraph.evidence = { ...structuredClone(item.evidence!), rawSha256: sha256(paragraphRaw), normalizedSha256: sha256(paragraph.text.normalized), transformations: [{ operation: "manual-correction", ruleVersion: profile, note: "Separato il capoverso successivo alla seconda voce dell’elenco." }] };
  value.raw = itemRaw; value.normalized = value.normalized.slice(markerLength, pivot).trimEnd(); value.inline = sliceInline(old, markerLength, pivot).map((segment, i, values) => i === values.length - 1 && segment.kind !== "math" ? { ...segment, value: segment.value.trimEnd() } : segment); item.kind = "list-item"; item.listMarker = "dash"; delete item.listLevel; audit(item, dashNote); record.blocks.splice(index + 1, 0, paragraph);
}

const sourcePath = join(root, "corpus", "units", "ntc2018", "11.3.3.5.5.json");
const misplaced = (JSON.parse(await readFile(sourcePath, "utf8")) as Unit).blocks.slice(3, 7);
await unit("11.3.3.5.5", (record) => { if (record.blocks.length > 3) record.blocks.splice(3); });
await unit("11.3.3.5.6", (record) => {
  const prefix = record.blocks[0]!.blockId.replace(/#block-[a-z0-9-]+$/u, "");
  if (record.blocks.length === 1) {
    for (const [index, candidate] of misplaced.entries()) {
      const block = structuredClone(candidate); block.blockId = `${prefix}#block-${String(index + 1).padStart(3, "0")}`;
      audit(block, "Ricollocato il capoverso nell’unità ufficiale §11.3.3.5.6, eliminando la duplicazione dall’unità precedente."); record.blocks.push(block);
    }
  }
  for (let index = 1; index < record.blocks.length; index += 1) record.blocks[index]!.blockId = `${prefix}#block-${String(index).padStart(3, "0")}`;
});

await unit("11.3.3.5.3", (record) => { for (const index of [6, 7, 8, 13, 14]) dash(record.blocks[index]!); });
await unit("11.3.4.1", (record) => { for (const index of [6, 7, 8]) dash(record.blocks[index]!); });
await unit("11.3.4.2", (record) => { for (const index of [3, 4, 5, 6, 8, 9, 10, 12, 14, 15, 16, 17]) dash(record.blocks[index]!); });
await unit("11.3.4.7", (record) => { dash(record.blocks[2]!); splitListContinuation(record, "Quando i connettori vengono uniti"); });
await unit("11.3.4.9", (record) => { for (const index of [3, 4, 5]) dash(record.blocks[index]!); });
await unit("11.3.4.10", (record) => {
  for (const index of [2, 3, 5, 6, 7, 8, 9]) dash(record.blocks[index]!);
  for (const [index, phrase] of [[2, "Centri di trasformazione per carpenteria metallica"], [3, "Centri di produzione di elementi in acciaio"], [5, "centri di prelavorazione o di servizio"], [6, "officine di produzione di carpenteria metallica"], [7, "centri di produzione di prodotti formati a freddo e lamiere grecate"], [8, "le officine per la produzione di bulloni e chiodi"], [9, "le officine di produzione di elementi strutturali"]] as const) em(record.blocks[index]!, phrase);
});
for (const name of ["11.3.4.11.1.1", "11.3.4.11.1.2", "11.3.4.11.1.3", "11.3.4.11.1.4", "11.3.4.11.1.5", "11.3.4.11.2.1", "11.3.4.11.2.2", "11.3.4.11.2.3", "11.3.4.11.2.4"]) await unit(name, (record) => emEntire(record.blocks[0]!));
await unit("11.3.4.11.3", (record) => {
  for (const index of [7, 8, 9, 10]) dash(record.blocks[index]!);
  for (const [index, phrase] of [[7, "Elementi di Carpenteria Metallica"], [8, "Lamiere grecate e profili formati a freddo"], [9, "Bulloni e chiodi"], [10, "Giunzioni meccaniche"]] as const) em(record.blocks[index]!, phrase);
});
