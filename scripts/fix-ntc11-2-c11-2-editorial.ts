import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

type Inline = { kind: "text" | "em" | "math"; value: string; latex?: string };
type Transformation = { operation: string; ruleVersion: string; note: string };
type Evidence = { sourceId: string; pdfPage: number; printedPage: string; rawSha256: string; normalizedSha256: string; transformations: Transformation[] };
type Block = { blockId: string; kind: string; listMarker?: "dash" | "none"; listLevel?: number; text?: { raw: string; normalized: string; inline?: Inline[] }; evidence?: Evidence };
type Unit = { blocks: Block[] };
type Manifest = { tables: Array<{ officialNumber: string | null; caption: string | null; captionInline?: Inline[] }> };
type Emphasis = string | { value: string; occurrence: number };

const root = fileURLToPath(new URL("../", import.meta.url));
const profile = "ntc11-2-c11-2-editorial-formatting-0.1.0";
const dashNote = "Il trattino tipografico della fonte è rappresentato dal marcatore strutturale; il testo della voce conserva soltanto la descrizione.";
const labelNote = "La label ufficiale è mantenuta nel testo e resa senza un marcatore aggiuntivo, per allineare la descrizione.";
const italicNote = "Ripristinato il corsivo verificato nel render della fonte ufficiale.";

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function recordEvidence(block: Block, note: string): void {
  assert.ok(block.text && block.evidence, `Evidence assente: ${block.blockId}`);
  block.evidence.normalizedSha256 = sha256(block.text.normalized);
  if (!block.evidence.transformations.some((entry) => entry.operation === "manual-correction" && entry.ruleVersion === profile && entry.note === note)) {
    block.evidence.transformations.push({ operation: "manual-correction", ruleVersion: profile, note });
  }
}

function sourceInline(block: Block): Inline[] {
  assert.ok(block.text, `Testo assente: ${block.blockId}`);
  const inline = block.text.inline ? structuredClone(block.text.inline) : [{ kind: "text" as const, value: block.text.normalized }];
  assert.equal(inline.map((segment) => segment.value).join(""), block.text.normalized, `Inline incoerente: ${block.blockId}`);
  return inline;
}

function setDash(block: Block): void {
  assert.ok(block.text, `Testo assente: ${block.blockId}`);
  block.kind = "list-item";
  if (/^[–—-]\s+/u.test(block.text.normalized)) block.text.normalized = block.text.normalized.replace(/^[–—-]\s+/u, "");
  const inline = sourceInline(block);
  block.text.inline = inline;
  block.listMarker = "dash";
  delete block.listLevel;
  recordEvidence(block, dashNote);
}

function setLabel(block: Block, label: string): void {
  assert.ok(block.text, `Testo assente: ${block.blockId}`);
  block.kind = "list-item";
  if (!block.text.normalized.startsWith(label)) block.text.normalized = `${label} ${block.text.normalized}`;
  block.text.inline = [{ kind: "text", value: block.text.normalized }];
  block.listMarker = "none";
  delete block.listLevel;
  recordEvidence(block, labelNote);
}

function italicize(block: Block, phrases: Emphasis[]): void {
  assert.ok(block.text, `Testo assente: ${block.blockId}`);
  const positions = phrases.map((emphasis) => {
    const phrase = typeof emphasis === "string" ? emphasis : emphasis.value;
    let index = -1;
    const occurrence = typeof emphasis === "string" ? 1 : emphasis.occurrence;
    for (let current = 0; current < occurrence; current += 1) index = block.text!.normalized.indexOf(phrase, index + 1);
    assert.notEqual(index, -1, `Frase assente per il corsivo: ${phrase}`);
    return { phrase, index, end: index + phrase.length };
  }).sort((left, right) => left.index - right.index);
  assert.ok(positions.every((entry, index) => index === 0 || positions[index - 1]!.end <= entry.index), `Corsivi sovrapposti: ${block.blockId}`);
  const inline: Inline[] = [];
  let offset = 0;
  for (const segment of sourceInline(block)) {
    const end = offset + segment.value.length;
    if (segment.kind === "math") {
      assert.ok(!positions.some((entry) => entry.index < end && entry.end > offset), `Corsivo attraversa matematica: ${block.blockId}`);
      inline.push(segment);
      offset = end;
      continue;
    }
    const cuts = [offset, end, ...positions.flatMap((entry) => [entry.index, entry.end]).filter((cut) => cut > offset && cut < end)].sort((a, b) => a - b);
    for (let index = 0; index < cuts.length - 1; index += 1) {
      const start = cuts[index]!;
      const stop = cuts[index + 1]!;
      const value = block.text.normalized.slice(start, stop);
      if (value) inline.push({ kind: positions.some((entry) => entry.index <= start && entry.end >= stop) ? "em" : "text", value });
    }
    offset = end;
  }
  block.text.inline = inline;
  recordEvidence(block, italicNote);
}

function italicizeQuotes(block: Block): void {
  assert.ok(block.text, `Testo assente: ${block.blockId}`);
  const inline = sourceInline(block);
  let offset = 0;
  const mathematicalRanges = inline.flatMap((segment) => {
    const range = segment.kind === "math" ? [{ start: offset, end: offset + segment.value.length }] : [];
    offset += segment.value.length;
    return range;
  });
  const quotes = [...block.text.normalized.matchAll(/“[^”]+”/gu)]
    .filter((match) => !mathematicalRanges.some((range) => match.index! < range.end && match.index! + match[0].length > range.start))
    .map((match) => match[0]);
  if (quotes.length > 0) italicize(block, quotes);
}

function setCaptionInline(manifest: Manifest, officialNumber: string): void {
  const table = manifest.tables.find((entry) => entry.officialNumber === officialNumber);
  assert.ok(table?.caption, `Didascalia assente: ${officialNumber}`);
  const descriptor = table.caption.replace(/^\s*Tab(?:ella|\.)\s*[^–—-]+\s*[–—-]\s*/iu, "");
  assert.notEqual(descriptor, table.caption, `Etichetta non separabile: ${officialNumber}`);
  table.captionInline = [{ kind: "text", value: table.caption.slice(0, table.caption.length - descriptor.length) }, { kind: "em", value: descriptor }];
}

async function updateUnit(document: "ntc2018" | "circ2019", name: string, edit: (unit: Unit) => void): Promise<void> {
  const path = join(root, "corpus", "units", document, `${name}.json`);
  const unit = JSON.parse(await readFile(path, "utf8")) as Unit;
  edit(unit);
  await writeFile(path, `${JSON.stringify(unit, null, 2)}\n`, "utf8");
}

async function updateManifest(document: "ntc2018" | "circ2019", name: string, edit: (manifest: Manifest) => void): Promise<void> {
  const path = join(root, "corpus", "assets", document, name);
  const manifest = JSON.parse(await readFile(path, "utf8")) as Manifest;
  edit(manifest);
  await writeFile(path, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}

await updateUnit("ntc2018", "11.2.1", (unit) => italicize(unit.blocks[2]!, ["Linee Guida per la messa in opera del calcestruzzo strutturale", "Linee Guida per la valutazione delle caratteristiche del calcestruzzo in opera"]));
await updateUnit("ntc2018", "11.2.2", (unit) => {
  for (const [index, phrase] of [[3, "Valutazione preliminare"], [4, "Controllo di produzione"], [5, "Controllo di accettazione"], [6, "Prove complementari"]] as const) italicize(unit.blocks[index]!, [phrase]);
});
await updateUnit("ntc2018", "11.2.5", (unit) => { for (const index of [2, 3]) setDash(unit.blocks[index]!); });
await updateUnit("ntc2018", "11.2.5.3", (unit) => { for (let index = 8; index <= 18; index += 1) setDash(unit.blocks[index]!); });
await updateUnit("ntc2018", "11.2.6", (unit) => {
  for (const index of [3, 4, 5, 6]) setLabel(unit.blocks[index]!, unit.blocks[index]!.text!.normalized.slice(0, 2));
  italicize(unit.blocks[9]!, ["Linee Guida per la messa in opera del calcestruzzo strutturale e per la valutazione delle caratteristiche meccaniche del calcestruzzo"]);
});
await updateUnit("ntc2018", "11.2.8", (unit) => {
  for (const index of [4, 7]) italicize(unit.blocks[index]!, ["Linee Guida per la produzione, il trasporto ed il controllo del calcestruzzo preconfezionato"]);
});
await updateUnit("ntc2018", "11.2.10.2", (unit) => { for (const index of [2, 3, 4]) setDash(unit.blocks[index]!); });
await updateUnit("ntc2018", "11.2.11", (unit) => italicize(unit.blocks[2]!, ["Linee Guida sul calcestruzzo strutturale", "Linee Guida per la messa in opera del calcestruzzo strutturale", "Linee Guida per la valutazione delle caratteristiche del calcestruzzo in opera"]));

for (const name of ["c11.2.2", "c11.2.4", "c11.2.5", "c11.2.5.3", "c11.2.8"]) {
  await updateUnit("circ2019", name, (unit) => { for (const block of unit.blocks) if (block.text) italicizeQuotes(block); });
}
await updateUnit("circ2019", "c11.2.12", (unit) => {
  italicizeQuotes(unit.blocks[1]!);
  italicize(unit.blocks[2]!, ["“Istruzioni per la progettazione, l’esecuzione ed il controllo di strutture di calcestruzzo fibrorinforzato”", "“per impieghi strutturali deve essere garantito un dosaggio minimo di fibre”", "“non inferiore allo ", " in volume”"]);
  italicizeQuotes(unit.blocks[3]!);
});
await updateUnit("circ2019", "c11.2.5.1", (unit) => { for (const index of [5, 6, 7]) setDash(unit.blocks[index]!); });
await updateUnit("circ2019", "c11.2.5.2", (unit) => { for (const [index, label] of [[8, "1)"], [9, "2)"], [10, "3)"], [11, "4)"], [12, "5)"]] as const) setLabel(unit.blocks[index]!, label); });
await updateUnit("circ2019", "c11.2.5.3", (unit) => {
  for (const index of [2, 3, 4, 5, 6, 7, 8, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25]) setDash(unit.blocks[index]!);
});
await updateUnit("circ2019", "c11.2.6", (unit) => {
  italicize(unit.blocks[3]!, ["Linee guida per la valutazione delle caratteristiche del calcestruzzo in opera"]);
  for (const index of [5, 6, 7, 8, 9, 10, 11, 18, 19]) setDash(unit.blocks[index]!);
  italicize(unit.blocks[13]!, ["Linee Guida per la valutazione delle caratteristiche del calcestruzzo in opera"]);
  italicize(unit.blocks[14]!, ["Linee Guida per la valutazione delle caratteristiche del calcestruzzo in opera", { value: "Linee Guida", occurrence: 2 }]);
});
await updateUnit("circ2019", "c11.2.8", (unit) => {
  italicize(unit.blocks[3]!, ["Istruzioni operative per il rilascio dell’autorizzazione agli Organismi di certificazione del Controllo del processo di fabbrica FPC del calcestruzzo prodotto con processo industrializzato, ai sensi del §11.2.8 delle Norme Tecniche per le Costruzioni di cui al D.M. 14.01.2008"]);
  for (const index of [7, 8]) setDash(unit.blocks[index]!);
});

await updateManifest("ntc2018", "11-step1.json", (manifest) => setCaptionInline(manifest, "11.2.IV"));
await updateManifest("ntc2018", "11-step2.json", (manifest) => { for (const number of ["11.2.Va", "11.2.Vb", "11.2.VI", "11.2.VII"]) setCaptionInline(manifest, number); });
await updateManifest("circ2019", "C11-step2.json", (manifest) => {
  const table = manifest.tables.find((entry) => entry.officialNumber === "C11.2.6.I");
  assert.ok(table?.caption);
  table.captionInline = [{ kind: "em", value: table.caption }];
});
