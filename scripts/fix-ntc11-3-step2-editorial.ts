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
const profile = "ntc11-3-step2-editorial-formatting-0.1.0";
const dashNote = "Il trattino tipografico della fonte è rappresentato dal marcatore strutturale; il testo della voce conserva soltanto la descrizione.";
const alignedNote = "Le voci affiancate della fonte sono rese come elenco senza marcatore, per allineare la descrizione.";
const italicNote = "Ripristinato il corsivo verificato nel render della fonte ufficiale.";
const subtitleNote = "Separato il sottotitolo in corsivo dal capoverso seguente, come nella fonte ufficiale.";

function sha256(value: string) { return createHash("sha256").update(value, "utf8").digest("hex"); }
function text(block: Block) { assert.ok(block.text, `Testo assente: ${block.blockId}`); return block.text; }
function evidence(block: Block) { assert.ok(block.evidence, `Evidence assente: ${block.blockId}`); return block.evidence; }
function audit(block: Block, note: string) {
  const content = text(block); const audit = evidence(block);
  audit.rawSha256 = sha256(content.raw);
  audit.normalizedSha256 = sha256(content.normalized);
  if (!audit.transformations.some((entry) => entry.ruleVersion === profile && entry.note === note)) audit.transformations.push({ operation: "manual-correction", ruleVersion: profile, note });
}
function inline(block: Block): Inline[] {
  const content = text(block); const value = content.inline ? structuredClone(content.inline) : [{ kind: "text" as const, value: content.normalized }];
  assert.equal(value.map((segment) => segment.value).join(""), content.normalized, `Inline incoerente: ${block.blockId}`);
  return value;
}
function sliceInline(value: Inline[], start: number, end?: number) {
  const result: Inline[] = []; let offset = 0;
  for (const segment of value) {
    const segmentEnd = offset + segment.value.length; const from = Math.max(start, offset); const to = Math.min(end ?? segmentEnd, segmentEnd);
    if (from < to) result.push({ ...segment, value: segment.value.slice(from - offset, to - offset) });
    offset = segmentEnd;
  }
  return result;
}
function dash(block: Block) {
  if (block.listMarker === "dash") return;
  const content = text(block); const old = content.normalized; const match = old.match(/^[–—-]\s+/u); assert.ok(match, `Trattino assente: ${block.blockId}`);
  const segments = inline(block); content.normalized = old.slice(match[0].length); content.inline = sliceInline(segments, match[0].length);
  block.kind = "list-item"; block.listMarker = "dash"; delete block.listLevel; audit(block, dashNote);
}
function aligned(block: Block) { if (block.listMarker === "none") return; block.kind = "list-item"; block.listMarker = "none"; delete block.listLevel; audit(block, alignedNote); }
function emEntire(block: Block) { const content = text(block); content.inline = inline(block).map((segment) => segment.kind === "math" ? segment : { kind: "em", value: segment.value }); audit(block, italicNote); }
function em(block: Block, phrase: string) {
  const content = text(block); const start = content.normalized.indexOf(phrase); assert.notEqual(start, -1, `Corsivo assente: ${phrase}`); const end = start + phrase.length;
  const result: Inline[] = []; let offset = 0;
  for (const segment of inline(block)) {
    const segmentEnd = offset + segment.value.length;
    if (segment.kind === "math") { assert.ok(end <= offset || start >= segmentEnd, `Corsivo attraversa matematica: ${block.blockId}`); result.push(segment); }
    else {
      const cuts = [offset, segmentEnd, start, end].filter((cut) => cut >= offset && cut <= segmentEnd).sort((a, b) => a - b);
      for (let index = 0; index < cuts.length - 1; index += 1) { const from = cuts[index]!; const to = cuts[index + 1]!; if (from < to) result.push({ kind: from >= start && to <= end ? "em" : "text", value: content.normalized.slice(from, to) }); }
    }
    offset = segmentEnd;
  }
  content.inline = result; audit(block, italicNote);
}
function splitSubtitle(recordUnit: Unit, phrase: string) {
  const index = recordUnit.blocks.findIndex((block) => block.text?.normalized.startsWith(`${phrase} `));
  if (index === -1) return;
  const body = recordUnit.blocks[index]!; const content = text(body); const oldInline = inline(body); const boundary = phrase.length;
  const normalized = content.normalized.slice(boundary).trimStart(); const normalizedOffset = content.normalized.length - normalized.length;
  const rawLines = content.raw.split("\n"); const rawTitle = rawLines.shift()!; const raw = rawLines.join("\n");
  const heading = structuredClone(body); heading.blockId = `${body.blockId}-subtitle`; heading.kind = "paragraph"; delete heading.listMarker; delete heading.listLevel;
  heading.text = { raw: rawTitle, normalized: phrase, inline: sliceInline(oldInline, 0, boundary), normalizationVersion: content.normalizationVersion };
  heading.evidence = { ...structuredClone(evidence(body)), rawSha256: sha256(rawTitle), normalizedSha256: sha256(phrase), transformations: [{ operation: "manual-correction", ruleVersion: profile, note: subtitleNote }] };
  content.raw = raw; content.normalized = normalized; content.inline = sliceInline(oldInline, normalizedOffset); audit(body, subtitleNote);
  emEntire(heading); recordUnit.blocks.splice(index, 0, heading);
}
function splitFinalRelaxationItem(recordUnit: Unit) {
  const index = recordUnit.blocks.findIndex((block) => block.text?.normalized.startsWith("- Per tutti i prodotti: a quanto stabilito in tabella 11.3.IX Il campione"));
  if (index === -1) return;
  const item = recordUnit.blocks[index]!; const content = text(item); const oldInline = inline(item); const start = 2; const pivot = content.normalized.indexOf(" Il campione"); assert.ok(pivot > start);
  const bodyNormalized = content.normalized.slice(pivot + 1); const rawLines = content.raw.split("\n"); const firstRaw = rawLines.shift()!.replace(/^-\s*/u, ""); const bodyRaw = rawLines.join("\n");
  const paragraph = structuredClone(item); paragraph.blockId = `${item.blockId}-continuation`; paragraph.kind = "paragraph"; delete paragraph.listMarker; delete paragraph.listLevel;
  paragraph.text = { raw: bodyRaw, normalized: bodyNormalized, inline: sliceInline(oldInline, pivot + 1), normalizationVersion: content.normalizationVersion };
  paragraph.evidence = { ...structuredClone(evidence(item)), rawSha256: sha256(bodyRaw), normalizedSha256: sha256(bodyNormalized), transformations: [{ operation: "manual-correction", ruleVersion: profile, note: "Separato il capoverso successivo alla terza voce dell’elenco." }] };
  content.raw = firstRaw; content.normalized = content.normalized.slice(start, pivot); content.inline = sliceInline(oldInline, start, pivot); item.kind = "list-item"; item.listMarker = "dash"; delete item.listLevel; audit(item, dashNote);
  recordUnit.blocks.splice(index + 1, 0, paragraph);
}
async function unit(name: string, edit: (record: Unit) => void) { const path = join(root, "corpus", "units", "ntc2018", `${name}.json`); const record = JSON.parse(await readFile(path, "utf8")) as Unit; edit(record); await writeFile(path, `${JSON.stringify(record, null, 2)}\n`, "utf8"); }
async function manifest(edit: (record: Manifest) => void) { const path = join(root, "corpus", "assets", "ntc2018", "11-step2.json"); const record = JSON.parse(await readFile(path, "utf8")) as Manifest; edit(record); await writeFile(path, `${JSON.stringify(record, null, 2)}\n`, "utf8"); }
function caption(record: Manifest, number: string) { const table = record.tables.find((entry) => entry.officialNumber === number); assert.ok(table?.caption); const descriptor = table.caption.replace(/^\s*Tab(?:ella|\.)\s*[^–—-]+\s*[–—-]\s*/iu, ""); assert.notEqual(descriptor, table.caption); table.captionInline = [{ kind: "text", value: table.caption.slice(0, table.caption.length - descriptor.length) }, { kind: "em", value: descriptor }]; }

for (const name of ["11.3.2.11.1.1", "11.3.2.11.1.2", "11.3.3.5.2.1", "11.3.3.5.2.2", "11.3.3.5.2.3", "11.3.3.5.2.4"]) await unit(name, (record) => emEntire(record.blocks[0]!));
await unit("11.3.3.1", (record) => {
  for (const [index, word] of [[2, "Filo"], [3, "Barra"], [4, "Treccia"], [5, "Trefolo"]] as const) { aligned(record.blocks[index]!); em(record.blocks[index]!, word); }
  for (const index of [8, 9, 13, 14]) dash(record.blocks[index]!);
});
await unit("11.3.3.2", (record) => { for (let index = 7; index <= 18; index += 1) aligned(record.blocks[index]!); });
await unit("11.3.3.5.2.1", (record) => { for (const index of [9, 10, 11, 12, 13, 16, 17, 18, 19, 20]) dash(record.blocks[index]!); });
await unit("11.3.3.5.2.3", (record) => {
  for (const phrase of ["Diametro (Ø), area della sezione trasversale (A) e massa per unità di lunghezza (M)", "Rettilineità", "Passo di avvolgimento (p)", "Diametro dei fili delle trecce e dei trefoli", "Dimensioni delle impronte nei prodotti improntati.", "Coefficiente di strizione (Z)", "Tensione al carico massimo (fpt)", "Tensione di scostamento dalla proporzionalità allo 0.1% (fp(0,1))", "Modulo di elasticità (Ep)", "Tensione all’1% di deformazione totale (fp(1))", "Limiti del rapporto tra le tensioni fp(0,1), fpy, fp(1) e la tensione al carico massimo fpt", "Allungamento totale percentuale sotto carico massimo (Agt)", "Prova di piegamento alternato (N)", "Prova di piegamento (α)", "Resistenza a fatica (L)", "Prove di rilassamento a temperatura ordinaria (ρ)"]) splitSubtitle(record, phrase);
  for (const phrase of ["Ovalità", "Tensione di snervamento (fpy)", "Prove per la determinazione del coefficiente medio D di riduzione del carico massimo (trazione deviata)."]){ const block = record.blocks.find((candidate) => candidate.text?.normalized === phrase); assert.ok(block, phrase); emEntire(block); }
  for (const block of record.blocks.filter((candidate) => candidate.text?.normalized.startsWith("- Per treccia,") || candidate.text?.normalized.startsWith("- Per barre:"))) dash(block);
  splitFinalRelaxationItem(record);
  for (const block of record.blocks) {
    const note = block.evidence?.transformations.find((entry) => entry.ruleVersion === profile)?.note;
    if (note) audit(block, note);
  }
});
await manifest((record) => { for (const number of ["11.3.VII a", "11.3.VII b", "11.3.X", "11.3.XI"]) caption(record, number); });
