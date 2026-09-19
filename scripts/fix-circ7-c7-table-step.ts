/* eslint-disable @typescript-eslint/no-explicit-any */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const unitsDir = join(root, "corpus", "units", "circ2019");
const assetsDir = join(root, "corpus", "assets", "circ2019");

function loadUnit(name: string) {
  return JSON.parse(readFileSync(join(unitsDir, `${name}.json`), "utf8"));
}

function saveUnit(name: string, unit: any) {
  writeFileSync(join(unitsDir, `${name}.json`), `${JSON.stringify(unit, null, 2)}\n`);
}

function loadAssets(name: string) {
  return JSON.parse(readFileSync(join(assetsDir, `${name}.json`), "utf8"));
}

function saveAssets(name: string, assets: any) {
  writeFileSync(join(assetsDir, `${name}.json`), `${JSON.stringify(assets, null, 2)}\n`);
}

function sha(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function noteEdit(block: any, note: string) {
  if (!block.evidence) return;
  block.evidence.transformations ??= [];
  if (!block.evidence.transformations.some((item: any) => item.note === note)) {
    block.evidence.transformations.push({ operation: "manual-correction", ruleVersion: "circ7-c7-table-step-0.1.0", note });
  }
  block.evidence.rawSha256 = sha(block.text.raw);
  block.evidence.normalizedSha256 = sha(block.text.normalized);
}

function setCellAlignment(table: any, align: "center") {
  for (const row of [...(table.headers ?? []), ...(table.rows ?? []), ...(table.footerRows ?? [])]) {
    for (const cell of row) cell.align = align;
  }
}

function tableInline(value: string) {
  const tokenPattern = /(§\s*\d+(?:\.\d+)+|\b(?:SLE|SLO|SLD|SLU|SLV|SLC|DUT|SPO)\b)/gu;
  const parts: Array<{ kind: "text" | "math"; value: string; latex?: string }> = [];
  let offset = 0;
  for (const match of value.matchAll(tokenPattern)) {
    const start = match.index ?? 0;
    if (start > offset) parts.push({ kind: "text", value: value.slice(offset, start) });
    const token = match[0];
    if (token.trimStart().startsWith("§")) {
      parts.push({ kind: "math", value: token, latex: `\\S ${token.replace(/^§\s*/u, "")}` });
    } else {
      parts.push({ kind: "math", value: token, latex: `\\mathrm{${token}}` });
    }
    offset = start + token.length;
  }
  if (offset < value.length) parts.push({ kind: "text", value: value.slice(offset) });
  return parts.length > 0 ? parts : undefined;
}

function setDefinitionBlock(block: any, label: string, description: string, latex: string, note: string) {
  block.kind = "list-item";
  block.listMarker = "none";
  block.listLevel = 0;
  block.text.raw = `${label}${description}`;
  block.text.normalized = `${label}${description}`;
  block.text.inline = [
    { kind: "math", value: label, latex },
    { kind: "text", value: description },
  ];
  noteEdit(block, note);
}

function splitDefinitions(unit: any, formulaIndex: number, labelDefs: Array<[string, string, string]>, note: string) {
  const dove = unit.blocks[formulaIndex + 1];
  if (!dove?.text?.normalized.startsWith("dove:")) throw new Error(`${unit.numbering.official}: missing dove block`);
  const alreadySplit = labelDefs.every(([label], index) => {
    const candidate = unit.blocks[formulaIndex + 2 + index];
    return candidate?.kind === "list-item" && candidate.listMarker === "none" && candidate.text?.normalized?.startsWith(label);
  });
  if (alreadySplit) return;
  const first = dove;
  const evidenceTemplate = JSON.parse(JSON.stringify(first));
  first.kind = "paragraph";
  delete first.listMarker;
  delete first.listLevel;
  first.text.raw = "dove:";
  first.text.normalized = "dove:";
  first.text.inline = [{ kind: "text", value: "dove:" }];
  noteEdit(first, `${note}: dove paragraph separated`);
  const definitions = labelDefs.map(([label, description, latex], index) => {
    const block = JSON.parse(JSON.stringify(evidenceTemplate));
    block.blockId = `${first.blockId}-label-${index + 1}`;
    setDefinitionBlock(block, label, description, latex, `${note}: labeled definition aligned`);
    return block;
  });
  unit.blocks.splice(formulaIndex + 1, 1, first, ...definitions);
}

// C7.2.II: the complete table is centered, including the period conditions.
{
  const assets = loadAssets("7.2");
  const table = Object.values(assets.tables).find((candidate: any) => candidate.officialNumber === "C7.2.II") as any;
  if (!table) throw new Error("Table C7.2.II not found");
  setCellAlignment(table, "center");
  saveAssets("7.2", assets);
}

// C7.3.3.2: numbered footnote items start at 1, not at the paragraph index.
// The renderer now derives the fallback marker from the numbered-list sequence.

// C7.3.I: preserve the wide source table, center all cells, and render state-limit
// abbreviations and paragraph references as inline mathematics.
{
  const assets = loadAssets("7.3");
  const table = Object.values(assets.tables).find((candidate: any) => candidate.officialNumber === "C7.3.I") as any;
  if (!table) throw new Error("Table C7.3.I not found");
  setCellAlignment(table, "center");
  for (const row of [...(table.headers ?? []), ...(table.rows ?? [])]) {
    for (const cell of row) {
      const inline = tableInline(cell.text);
      if (inline) cell.inline = inline;
    }
  }
  const dutHeader = table.headers?.[1]?.find((cell: any) => cell.text === "DUT (SPO)");
  if (!dutHeader) throw new Error("C7.3.I DUT (SPO) header not found");
  dutHeader.text = "DUT\n(SPO)";
  dutHeader.inline = [
    { kind: "math", value: "DUT", latex: "\\mathrm{DUT}" },
    { kind: "text", value: "\n(" },
    { kind: "math", value: "SPO", latex: "\\mathrm{SPO}" },
    { kind: "text", value: ")" },
  ];
  const classHeader = table.headers?.[1]?.at(-1);
  if (!classHeader) throw new Error("C7.3.I class III/IV header not found");
  classHeader.text = "III\nIV";
  classHeader.inline = [
    { kind: "math", value: "III", latex: "\\mathrm{III}" },
    { kind: "text", value: "\n" },
    { kind: "math", value: "IV", latex: "\\mathrm{IV}" },
  ];
  table.columnWidths = [5, 5, 5, 18, 7, 7, 7, 7, 7, 7, 7, 7, 11];
  saveAssets("7.3", assets);
}

// C7.4.3.1: the definitions following [C7.4.1] and [C7.4.2] are aligned labeled lists.
{
  const unit = loadUnit("c7.4.3.1");
  splitDefinitions(unit, unit.blocks.findIndex((block: any) => block.assetId?.endsWith(":c7.4.1")), [
    ["K_θ", " è la rigidezza torsionale di piano rispetto al centro di rigidezza;", "K_\\theta"],
    ["K", " è la maggiore tra le rigidezze di piano.", "K"],
  ], "C7.4.1 labeled list");
  splitDefinitions(unit, unit.blocks.findIndex((block: any) => block.assetId?.endsWith(":c7.4.2")), [
    ["T", " è il periodo traslazionale disaccoppiato;", "T"],
    ["T_θ", " è il periodo torsionale disaccoppiato.", "T_\\theta"],
  ], "C7.4.2 labeled list");
  saveUnit("c7.4.3.1", unit);
}
