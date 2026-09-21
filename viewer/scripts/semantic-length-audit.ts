import { mkdir, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, sep } from "node:path";
import type { CorpusUnit, DocumentId } from "../shared/corpusData.js";
import { semanticTextForUnit } from "../server/chatntc/semanticIndex.js";
import type { BgeM3Tokenizer, BgeM3TokenizerMetadata } from "./bge-m3-tokenizer.js";
import { tokenCount } from "./bge-m3-tokenizer.js";

export const BGE_M3_CONTEXT_WINDOW = 8192;
export const TOKEN_THRESHOLDS = [512, 1000, 1500, 2000, 3000, 4000, 6000, 8000, 8192] as const;

export interface UnitLengthMetric {
  unitId: string;
  document: DocumentId;
  numbering: string;
  title: string;
  characterCount: number;
  wordCount: number;
  tokenCount: number;
  textBlockCount: number;
  longestTextBlockTokenCount: number;
}

export interface NumericStats {
  min: number;
  max: number;
  mean: number;
  median: number;
  p75: number;
  p90: number;
  p95: number;
  p99: number;
}

export interface ThresholdCount {
  threshold: number;
  count: number;
  percentage: number;
}

export interface SemanticLengthAuditReport {
  schemaVersion: "chatntc-semantic-length-audit-v1";
  generatedAt: string;
  tokenizer: BgeM3TokenizerMetadata;
  semanticText: { function: "semanticTextForUnit"; format: "chatntc-unit-text-v1"; specialTokensIncluded: true };
  corpus: { fingerprint: string; unitCount: number };
  summary: { unitCount: number; characters: NumericStats; tokens: NumericStats; blocks: NumericStats };
  thresholds: ThresholdCount[];
  documents: Record<DocumentId, { unitCount: number; tokens: NumericStats; thresholds: ThresholdCount[] }>;
  units: UnitLengthMetric[];
}

const round = (value: number) => Math.round(value * 100) / 100;

export function percentile(values: readonly number[], quantile: number): number {
  if (!values.length || quantile < 0 || quantile > 1) throw new Error("Percentile non valido.");
  const sorted = [...values].sort((left, right) => left - right);
  const position = (sorted.length - 1) * quantile;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  return round(sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower));
}

export function numericStats(values: readonly number[]): NumericStats {
  if (!values.length) throw new Error("Statistiche vuote.");
  const sorted = [...values].sort((left, right) => left - right);
  return {
    min: sorted[0], max: sorted[sorted.length - 1], mean: round(sorted.reduce((sum, value) => sum + value, 0) / sorted.length),
    median: percentile(sorted, 0.5), p75: percentile(sorted, 0.75), p90: percentile(sorted, 0.9),
    p95: percentile(sorted, 0.95), p99: percentile(sorted, 0.99),
  };
}

export function thresholdCounts(values: readonly number[], thresholds: readonly number[] = TOKEN_THRESHOLDS): ThresholdCount[] {
  if (!values.length) throw new Error("Soglie senza valori.");
  return thresholds.map((threshold) => {
    const count = values.filter((value) => value > threshold).length;
    return { threshold, count, percentage: round((count / values.length) * 100) };
  });
}

function semanticTextBlocks(unit: CorpusUnit): string[] {
  return unit.blocks.flatMap((block) => block.blockId !== unit.titleBlockId && block.text?.normalized.trim()
    ? [block.text.normalized.trim()] : []);
}

function wordCount(text: string): number {
  return text.trim() ? text.trim().split(/\s+/u).length : 0;
}

export function metricForUnit(unit: CorpusUnit, tokenizer: BgeM3Tokenizer): UnitLengthMetric {
  const text = semanticTextForUnit(unit);
  const blocks = semanticTextBlocks(unit);
  return {
    unitId: unit.id, document: unit.document, numbering: unit.numbering.official, title: unit.title,
    characterCount: Array.from(text).length, wordCount: wordCount(text), tokenCount: tokenCount(tokenizer, text, true),
    textBlockCount: blocks.length,
    longestTextBlockTokenCount: blocks.length ? Math.max(...blocks.map((block) => tokenCount(tokenizer, block, false))) : 0,
  };
}

export function sortLongestUnits(units: readonly UnitLengthMetric[]): UnitLengthMetric[] {
  return [...units].sort((left, right) => right.tokenCount - left.tokenCount
    || right.characterCount - left.characterCount || left.unitId.localeCompare(right.unitId, "en"));
}

export function createSemanticLengthAuditReport(input: {
  units: readonly CorpusUnit[];
  corpusFingerprint: string;
  tokenizerMetadata: BgeM3TokenizerMetadata;
  tokenizer: BgeM3Tokenizer;
  generatedAt?: string;
}): SemanticLengthAuditReport {
  const metrics = input.units.map((unit) => metricForUnit(unit, input.tokenizer));
  const tokenValues = metrics.map((unit) => unit.tokenCount);
  const document = (documentId: DocumentId) => {
    const values = metrics.filter((unit) => unit.document === documentId).map((unit) => unit.tokenCount);
    return { unitCount: values.length, tokens: numericStats(values), thresholds: thresholdCounts(values) };
  };
  return {
    schemaVersion: "chatntc-semantic-length-audit-v1", generatedAt: input.generatedAt ?? new Date().toISOString(),
    tokenizer: input.tokenizerMetadata,
    semanticText: { function: "semanticTextForUnit", format: "chatntc-unit-text-v1", specialTokensIncluded: true },
    corpus: { fingerprint: input.corpusFingerprint, unitCount: metrics.length },
    summary: { unitCount: metrics.length, characters: numericStats(metrics.map((unit) => unit.characterCount)),
      tokens: numericStats(tokenValues), blocks: numericStats(metrics.map((unit) => unit.textBlockCount)) },
    thresholds: thresholdCounts(tokenValues), documents: { ntc2018: document("ntc2018"), circ2019: document("circ2019") },
    units: metrics,
  };
}

export async function writeSemanticLengthAuditReport(file: string, report: SemanticLengthAuditReport): Promise<void> {
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(report, null, 2)}\n`, "utf8");
}

export function assertLocalOutput(viewerRoot: string, outputFile: string): void {
  const localRelative = relative(join(viewerRoot, ".local"), outputFile);
  if (!localRelative || isAbsolute(localRelative) || localRelative === ".." || localRelative.startsWith(`..${sep}`)) {
    throw new Error("La destinazione deve essere una sottodirectory di viewer/.local/.");
  }
}

export function formatTopUnit(unit: UnitLengthMetric, rank: number): string {
  return `${rank}. ${unit.document} ${unit.numbering} | ${unit.unitId} | ${unit.title} | `
    + `${unit.tokenCount} token | ${unit.characterCount} caratteri | ${unit.textBlockCount} blocchi`;
}
