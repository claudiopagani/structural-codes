/* eslint-disable @typescript-eslint/no-explicit-any */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const unitsDir = join(root, "corpus", "units", "circ2019");
const assetsDir = join(root, "corpus", "assets", "circ2019");
type Inline = { kind: string; value: string; latex?: string };
type Block = any;
type Unit = any;

function loadUnit(name: string): Unit {
  return JSON.parse(readFileSync(join(unitsDir, `${name}.json`), "utf8"));
}

function saveUnit(name: string, unit: Unit) {
  writeFileSync(join(unitsDir, `${name}.json`), `${JSON.stringify(unit, null, 2)}\n`);
}

function loadAssets(name: string): any {
  return JSON.parse(readFileSync(join(assetsDir, `${name}.json`), "utf8"));
}

function saveAssets(name: string, assets: any) {
  writeFileSync(join(assetsDir, `${name}.json`), `${JSON.stringify(assets, null, 2)}\n`);
}

function sha(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function noteEdit(block: Block, note: string) {
  const evidence = block.evidence;
  if (!evidence) return;
  evidence.transformations ??= [];
  for (const transformation of evidence.transformations) {
    transformation.ruleVersion ??= "circ7-latest-editorial-0.1.0";
  }
  if (!evidence.transformations.some((item: any) => item.note === note)) {
    evidence.transformations.push({ operation: "manual-correction", ruleVersion: "circ7-latest-editorial-0.1.0", note });
  }
  evidence.rawSha256 = sha(block.text?.raw ?? "");
  evidence.normalizedSha256 = sha(block.text?.normalized ?? "");
}

function textBlock(unit: Unit, index: number) {
  const block = unit.blocks[index];
  if (!block?.text) throw new Error(`Missing text block ${unit.id} #${index}`);
  return block;
}

function setInline(block: Block, inline: Inline[], note: string) {
  block.text.inline = inline;
  noteEdit(block, note);
}

function setText(block: Block, normalized: string, note: string, inline?: Inline[]) {
  block.text.raw = normalized;
  block.text.normalized = normalized;
  if (inline) block.text.inline = inline;
  else delete block.text.inline;
  noteEdit(block, note);
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function splitMath(value: string, tokens: string[]): Inline[] {
  const escaped = tokens
    .slice()
    .sort((a, b) => b.length - a.length)
    .map((token) => token.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"));
  const pattern = new RegExp(`(${escaped.join("|")})`, "gu");
  const parts = value.split(pattern).filter((part) => part.length > 0);
  return parts.map((part) => {
    const token = tokens.find((candidate) => candidate === part);
    if (!token) return { kind: "text", value: part };
    const latex = token
      .replaceAll("ξ_1", "\\xi_1")
      .replaceAll("ξ_2", "\\xi_2")
      .replaceAll("T_1", "T_1")
      .replaceAll("T_2", "T_2")
      .replaceAll("ξ", "\\xi")
      .replaceAll("q", "q");
    return { kind: "math", value: token, latex };
  });
}

function noteParagraphs(block: Block, paragraphs: Array<{ normalized: string; listMarker?: "numbered" | "bullet" | "dash"; listLevel?: number }>, note: string) {
  block.text.paragraphs = paragraphs;
  noteEdit(block, note);
}

function numberedParagraphs(value: string, hasTrailingParagraph = false) {
  const first = value.indexOf("1)");
  if (first < 0) throw new Error("Numbered list start not found");
  const second = value.indexOf("2)", first + 2);
  const third = value.indexOf("3)", second + 2);
  if (second < 0 || third < 0) throw new Error("Numbered list marker not found");
  const intro = value.slice(0, first).trim();
  const item1 = value.slice(first + 2, second).trim();
  const item2 = value.slice(second + 2, third).trim();
  let item3 = value.slice(third + 2).trim();
  const paragraphs: Array<{ normalized: string; listMarker?: "numbered" | "bullet" | "dash" }> = [{ normalized: intro }];
  if (hasTrailingParagraph) {
    const tailStart = item3.indexOf(" L’analisi modale consiste");
    if (tailStart < 0) throw new Error("Trailing paragraph boundary not found");
    const tail = item3.slice(tailStart + 1).trim();
    item3 = item3.slice(0, tailStart).trim();
    paragraphs.push(
      { normalized: item1, listMarker: "numbered" },
      { normalized: item2, listMarker: "numbered" },
      { normalized: item3, listMarker: "numbered" },
      { normalized: tail },
    );
  } else {
    paragraphs.push(
      { normalized: item1, listMarker: "numbered" },
      { normalized: item2, listMarker: "numbered" },
      { normalized: item3, listMarker: "numbered" },
    );
  }
  return paragraphs;
}

// C7.2.3: internal headings, aligned definitions, and the mathematical n.
{
  const unit = loadUnit("c7.2.3");
  for (const index of [11, 31, 57]) {
    const block = textBlock(unit, index);
    setInline(block, [{ kind: "strong-em", value: block.text.normalized }], "C7.2.3 internal heading rendered bold italic");
  }
  const where = textBlock(unit, 38);
  where.kind = "paragraph";
  noteEdit(where, "C7.2.3 dove after [C7.2.7] is ordinary text, not a bold heading");
  const ab = textBlock(unit, 41);
  ab.text.inline = [
    { kind: "math", value: "a e b", latex: "a\\;\\mathrm{e}\\;b" },
    ...splitMath(ab.text.normalized.slice("a e b".length), ["0,8", "1,1"]),
  ];
  noteEdit(ab, "C7.2.3 grouped labels a e b aligned with the following descriptions");
  const n = textBlock(unit, 55);
  setInline(n, [
    { kind: "text", value: "dove " },
    { kind: "math", value: "n", latex: "n" },
    { kind: "text", value: " è il numero di piani." },
  ], "C7.2.10 n rendered as inline mathematics");
  saveUnit("c7.2.3", unit);
}

// C7.2.6: q in the footnote is a mathematical symbol.
{
  const unit = loadUnit("c7.2.6");
  const block = textBlock(unit, 7);
  setInline(block, splitMath(block.text.normalized, ["q"]), "C7.2.6 footnote q rendered as inline mathematics");
  saveUnit("c7.2.6", unit);
}

// Notes with numbered and dash lists retain the printed paragraph hierarchy.
{
  const unit = loadUnit("c7.3.3.1");
  const block = unit.blocks.find((candidate: Block) => candidate.kind === "footnote");
  noteParagraphs(block, numberedParagraphs(block.text.normalized, true), "C7.3.3.1 footnote numbered list reconstructed");
  saveUnit("c7.3.3.1", unit);
}
{
  const unit = loadUnit("c7.3.3.2");
  const block = unit.blocks.find((candidate: Block) => candidate.kind === "footnote");
  noteParagraphs(block, numberedParagraphs(block.text.normalized), "C7.3.3.2 footnote numbered list reconstructed");
  saveUnit("c7.3.3.2", unit);
}
{
  const unit = loadUnit("c7.3.6.1");
  const block = unit.blocks.find((candidate: Block) => candidate.kind === "footnote");
  const value = block.text.normalized;
  const first = value.indexOf("rigidezza,");
  const second = value.indexOf(" resistenza,", first);
  const third = value.indexOf(" duttilità,", second);
  const tail = value.indexOf(" Relativamente all’ultimo", third);
  if (first < 0 || second < 0 || third < 0 || tail < 0) throw new Error("C7.3.6.1 footnote list boundaries not found");
  noteParagraphs(block, [
    { normalized: value.slice(0, first).trim() },
    { normalized: value.slice(first, second).trim(), listMarker: "dash" },
    { normalized: value.slice(second + 1, third).trim(), listMarker: "dash" },
    { normalized: value.slice(third + 1, tail).trim(), listMarker: "dash" },
    { normalized: value.slice(tail + 1).trim() },
  ], "C7.3.6.1 footnote dash list reconstructed");
  saveUnit("c7.3.6.1", unit);
}

// C7.3.4.2 and C7.4 use the requested bold treatments.
{
  const unit = loadUnit("c7.3.4.2");
  for (const index of [11, 12]) {
    const block = textBlock(unit, index);
    block.text.inline[0] = { kind: "strong", value: block.text.inline[0].value };
    noteEdit(block, "C7.3.4.2 Metodo A/B list labels rendered bold");
  }
  saveUnit("c7.3.4.2", unit);
}
{
  const unit = loadUnit("c7.4");
  for (const index of [2, 3]) {
    const block = textBlock(unit, index);
    const phrase = block.text.inline.find((segment: Inline) => segment.kind === "em" || segment.kind === "strong-em");
    if (!phrase) throw new Error(`C7.4 emphasis not found in block ${index}`);
    phrase.kind = "strong-em";
    noteEdit(block, "C7.4 requested phrases rendered bold italic");
  }
  saveUnit("c7.4", unit);
}

// C7.3.2a–b caption: formula symbols are KaTeX segments.
{
  const assets = loadAssets("7.3");
  const figure = Object.values(assets.figures).find((candidate: any) => candidate.officialNumber === "C7.3.2") as any;
  if (!figure) throw new Error("Figure C7.3.2 not found");
  figure.captionInline = [
    { kind: "strong", value: "Figure C7.3.2a–b" },
    { kind: "text", value: " – " },
    { kind: "em", value: "Spostamento di riferimento per " },
    { kind: "math", value: "T ≥ T_C", latex: "T\\ge T_C" },
    { kind: "em", value: " e " },
    { kind: "math", value: "T < T_C", latex: "T<T_C" },
  ];
  saveAssets("7.3", assets);
}

// Keep the long C7.3.I description column under control while retaining a scrollable table.
{
  const assets = loadAssets("7.3");
  const table = Object.values(assets.tables).find((candidate: any) => candidate.officialNumber === "C7.3.I") as any;
  if (!table) throw new Error("Table C7.3.I not found");
  table.columnWidths = [5, 5, 5, 18, 7, 7, 7, 7, 7, 7, 7, 7, 11];
  saveAssets("7.3", assets);
}

// C7.8.1.5.4: the two dash items are nested below the SLC item.
{
  const unit = loadUnit("c7.8.1.5.4");
  const outer = textBlock(unit, 2);
  outer.kind = "list-item";
  outer.listMarker = "none";
  outer.listLevel = 0;
  noteEdit(outer, "C7.8.1.5.4 SLC parent item reconstructed for nested list");
  for (const index of [3, 4]) {
    const block = textBlock(unit, index);
    block.listLevel = 1;
    block.indentLevel = 1;
    noteEdit(block, "C7.8.1.5.4 dash item nested below SLC");
  }
  saveUnit("c7.8.1.5.4", unit);
}

// C7.10.1: restore the opening paragraph and its source footnote.
{
  const unit = loadUnit("c7.10.1");
  if (!unit.blocks.some((block: Block) => block.blockId.endsWith("#block-editorial-000"))) {
    const template = clone(unit.blocks[1]);
    const normalized = "L’isolamento sismico rientra tra le strategie di protezione usualmente raggruppate sotto la denominazione di “controllo passivo delle vibrazioni”. Di queste l’“isolamento sismico” e la “dissipazione d’energia” sono quelle più comunemente utilizzate. Entrambe le famiglie di protezione sono correntemente usate per la protezione delle costruzioni, sia nuove che esistenti, e sono efficaci in ragione del modo in cui ne modificano il comportamento dinamico. La prima è essenzialmente finalizzata a limitare l’energia in ingresso (11) attraverso isolatori collocati tra la porzione di costruzione da proteggere e quella solidale al terreno, la seconda consente di dissipare parte dell’energia in ingresso, attraverso meccanismi di dissipazione controllata, utilizzando appositi dispositivi collocati all’interno della struttura o colleganti strutture contigue.";
    const marker = normalized.indexOf("(11)");
    template.blockId = `${unit.id}#block-editorial-000`;
    template.text.raw = normalized;
    template.text.normalized = normalized;
    template.text.inline = [
      { kind: "text", value: normalized.slice(0, marker) },
      { kind: "math", value: "(11)", latex: "^{(11)}" },
      { kind: "text", value: normalized.slice(marker + 4) },
    ];
    template.evidence.pdfPage = 235;
    template.evidence.transformations = [{ operation: "manual-correction", ruleVersion: "circ7-latest-editorial-0.1.0", note: "C7.10.1 opening paragraph restored from official page 235" }];
    template.evidence.rawSha256 = sha(normalized);
    template.evidence.normalizedSha256 = sha(normalized);
    unit.blocks.splice(1, 0, template);
    const footnote = clone(template);
    const footnoteText = "Per energia in ingresso si intende l’energia trasmessa alla costruzione da un’azione generica e nel caso del terremoto dal movimento sismico del terreno. Tale energia si manifesta come deformazioni e movimento della costruzione.";
    footnote.blockId = `${unit.id}#block-footnote-011`;
    footnote.kind = "footnote";
    footnote.text.raw = `11${footnoteText}`;
    footnote.text.normalized = `11${footnoteText}`;
    footnote.text.inline = [
      { kind: "math", value: "11", latex: "^{11}" },
      { kind: "text", value: footnoteText },
    ];
    footnote.text.paragraphs = undefined;
    footnote.evidence.transformations = [{ operation: "manual-correction", ruleVersion: "circ7-latest-editorial-0.1.0", note: "C7.10.1 footnote 11 restored from official page 235" }];
    footnote.evidence.rawSha256 = sha(footnote.text.raw);
    footnote.evidence.normalizedSha256 = sha(footnote.text.normalized);
    unit.blocks.splice(2, 0, footnote);
  }
  saveUnit("c7.10.1", unit);
}

// C7.10.4.3 starts only after the seven paragraphs that close C7.10.4.2.
{
  const previous = loadUnit("c7.10.4.2");
  const current = loadUnit("c7.10.4.3");
  if (current.blocks.length > 3) {
    const moved = current.blocks.slice(1, 8).map((block: Block, index: number) => {
      const copy = clone(block);
      copy.blockId = `${previous.id}#block-moved-c7-10-4-3-${String(index + 1).padStart(3, "0")}`;
      noteEdit(copy, "C7.10.4.2 continuation moved before the C7.10.4.3 heading");
      return copy;
    });
    previous.blocks.push(...moved);
    current.blocks = [current.blocks[0], ...current.blocks.slice(8)];
    saveUnit("c7.10.4.2", previous);
  }
  if (!current.blocks.some((block: Block) => block.text?.normalized?.startsWith("La rigidità strutturale"))) {
    const template = clone(previous.blocks[1]);
    const additions = ([
      ["block-editorial-001", "La rigidità strutturale dei piani immediatamente al di sotto e al di sopra del sistema di isolamento va intesa nel piano orizzontale, ed è finalizzata a garantire una distribuzione regolare degli sforzi tra i diversi isolatori, anche in caso di funzionamenti difformi da quelli previsti, ed a distribuire correttamente le forze degli eventuali dispositivi ausiliari (che sono in genere in numero limitato) tra gli elementi strutturali che debbono assorbirli."],
      ["block-editorial-002", "Il ruolo dei diaframmi rigidi orizzontalmente è tanto più importante quanto meno uniforme è la trasmissione degli sforzi orizzontali tra la sovrastruttura e la sottostruttura."],
    ] as Array<[string, string]>).map(([suffix, value]) => {
      const block = clone(template);
      block.blockId = `${current.id}#${suffix}`;
      block.text.raw = value;
      block.text.normalized = value;
      delete block.text.inline;
      block.evidence.pdfPage = 240;
      block.evidence.transformations = [{ operation: "manual-correction", ruleVersion: "circ7-latest-editorial-0.1.0", note: "C7.10.4.3 paragraphs restored after the heading from official page 240" }];
      block.evidence.rawSha256 = sha(value);
      block.evidence.normalizedSha256 = sha(value);
      return block;
    });
    current.blocks.push(...additions);
  }
  saveUnit("c7.10.4.3", current);
}

// C7.10.5.3: restore the introductory list of analysis methods.
{
  const unit = loadUnit("c7.10.5.3");
  if (!unit.blocks.some((block: Block) => block.text?.normalized === "statica lineare")) {
    const template = clone(unit.blocks[1]);
    const additions = ([
      ["block-editorial-000", "In relazione alle caratteristiche dell’edificio e del sistema di isolamento possono essere utilizzati i seguenti metodi di analisi:", "paragraph"],
      ["block-editorial-000-a", "statica lineare", "list-item"],
      ["block-editorial-000-b", "dinamica lineare", "list-item"],
      ["block-editorial-000-c", "dinamica non lineare", "list-item"],
    ] as Array<[string, string, string]>).map(([suffix, value, kind]) => {
      const block = clone(template);
      block.blockId = `${unit.id}#${suffix}`;
      block.kind = kind;
      block.text.raw = value;
      block.text.normalized = value;
      delete block.text.inline;
      if (kind === "list-item") block.listMarker = "dash";
      else delete block.listMarker;
      block.evidence.transformations = [{ operation: "manual-correction", ruleVersion: "circ7-latest-editorial-0.1.0", note: "C7.10.5.3 opening analysis-method list restored from official page 241" }];
      block.evidence.rawSha256 = sha(value);
      block.evidence.normalizedSha256 = sha(value);
      return block;
    });
    unit.blocks.splice(1, 0, ...additions);
  }
  saveUnit("c7.10.5.3", unit);
}

// C7.10.5.3.1: M and K_esi form an aligned labeled list.
{
  const unit = loadUnit("c7.10.5.3.1");
  const mass = textBlock(unit, 4);
  mass.kind = "list-item";
  mass.listMarker = "none";
  mass.text.inline = [
    { kind: "math", value: "M", latex: "M" },
    { kind: "text", value: " è la massa totale della sovrastruttura;" },
  ];
  noteEdit(mass, "C7.10.5.3.1 M rendered as aligned labeled-list label");
  const stiffness = textBlock(unit, 5);
  stiffness.kind = "list-item";
  stiffness.listMarker = "none";
  noteEdit(stiffness, "C7.10.5.3.1 K_esi rendered as aligned labeled-list label");
  saveUnit("c7.10.5.3.1", unit);
}

// C7.10.5.3.2: the list after [C7.10.7] is an unnumbered dash list.
{
  const unit = loadUnit("c7.10.5.3.2");
  const first = textBlock(unit, 8);
  const second = textBlock(unit, 9);
  const firstText = "Assumere T_1 circa pari a quello della struttura a base fissa e T_2 circa pari a quello della struttura isolata (in caso di modello 3D si hanno tre periodi di isolamento);";
  const secondText = "Assumere T_1 e T_2 estremi dell’intervallo di periodi in cui si situano i tre periodi di isolamento del modello 3D.";
  for (const [block, value] of [[first, firstText], [second, secondText]] as const) {
    block.listMarker = "dash";
    setText(block, value, "C7.10.5.3.2 post-[C7.10.7] list rendered as unnumbered dash list", splitMath(value, ["T_1", "T_2"]));
  }
  saveUnit("c7.10.5.3.2", unit);
}

// C7.2.4 is intentionally displayed 25% larger in the viewer.
{
  const assets = loadAssets("7.2");
  const figure = Object.values(assets.figures).find((candidate: any) => candidate.officialNumber === "C7.2.4") as any;
  if (figure) {
    figure.displayScale = 1.25;
    saveAssets("7.2", assets);
  }
}

// Keep every transformation introduced by this pass compliant with the evidence schema.
for (const name of [
  "c7.2.3", "c7.2.6", "c7.3.3.1", "c7.3.3.2", "c7.3.4.2", "c7.3.6.1", "c7.4",
  "c7.8.1.5.4", "c7.10.1", "c7.10.4.2", "c7.10.4.3", "c7.10.5.3", "c7.10.5.3.1", "c7.10.5.3.2",
]) {
  const unit = loadUnit(name);
  let changed = false;
  for (const block of unit.blocks) {
    for (const transformation of block.evidence?.transformations ?? []) {
      if (!transformation.ruleVersion) {
        transformation.ruleVersion = "circ7-latest-editorial-0.1.0";
        changed = true;
      }
    }
  }
  if (changed) saveUnit(name, unit);
}

console.log("Applied latest NTC/Circolare editorial corrections for §7.11 and C7.");
