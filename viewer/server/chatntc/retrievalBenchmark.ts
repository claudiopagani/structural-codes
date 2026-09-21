import type { DocumentId } from "../../shared/corpusData.js";

export type RetrievalBenchmarkOrigin = "historical" | "synthetic-paraphrase";
export type RetrievalGroundTruthStatus = "reviewed" | "provisional" | "unresolved";
export type RetrievalBenchmarkCategory = "exact-reference" | "lexical-direct" | "semantic-paraphrase"
  | "ntc-circolare" | "interpretative" | "no-direct-reference";
export type RetrievalStrategy = "lexical" | "semantic" | "hybrid";

export interface RetrievalBenchmarkExpected {
  requiredUnitIds: string[];
  acceptableUnitIds: string[];
  document: DocumentId | null;
  noDirectNormativeTarget: boolean;
}

export interface RetrievalBenchmarkCase {
  id: string;
  query: string;
  origin: RetrievalBenchmarkOrigin;
  categories: RetrievalBenchmarkCategory[];
  expected: RetrievalBenchmarkExpected;
  groundTruthStatus: RetrievalGroundTruthStatus;
  notes: string;
}

export interface RetrievalBenchmarkDataset {
  formatVersion: 1;
  name: string;
  description: string;
  cases: RetrievalBenchmarkCase[];
}

export interface RankingMetrics {
  hitAt1: boolean | null;
  hitAt3: boolean | null;
  recallAt5: number | null;
  recallAt10: number | null;
  mrr: number | null;
  firstRequiredRank: number | null;
  requiredInTop5: number;
  requiredInTop10: number;
  acceptablePresent: boolean;
  firstAcceptableRank: number | null;
}

export interface BenchmarkRankingHit {
  unitId: string;
  rank: number;
  score: number;
  match?: string;
  similarity?: number;
  rrfScore?: number;
  lexicalRank?: number | null;
  semanticRank?: number | null;
}

export interface RetrievalBenchmarkCaseResult {
  id: string;
  query: string;
  origin: RetrievalBenchmarkOrigin;
  categories: RetrievalBenchmarkCategory[];
  groundTruthStatus: RetrievalGroundTruthStatus;
  groundTruth: RetrievalBenchmarkExpected & { notes: string };
  rankings: Record<RetrievalStrategy, BenchmarkRankingHit[]>;
  metrics: Record<RetrievalStrategy, RankingMetrics>;
  overlap: { lexicalSemanticCount: number; lexicalSemanticRatio: number; top10Count: number };
  rankDeltaHybridVsLexical: number | null;
  latenciesMs: { lexical: number; queryEmbedding: number; semanticVectorSearch: number; semanticTotal: number;
    rrf: number; hybridTotal: number };
}

export interface AggregateMetrics {
  queryCount: number;
  hitAt1: number | null;
  hitAt3: number | null;
  recallAt5: number | null;
  recallAt10: number | null;
  mrr: number | null;
}

export interface LatencySummary {
  count: number;
  median: number | null;
  p90: number | null;
  p95: number | null;
  max: number | null;
}

export interface RetrievalBenchmarkResults {
  formatVersion: 1;
  metadata: Record<string, unknown>;
  dataset: { name: string; fingerprintSha256: string; totalCases: number; historicalCases: number;
    syntheticParaphraseCases: number; statusCounts: Record<RetrievalGroundTruthStatus, number> };
  cases: RetrievalBenchmarkCaseResult[];
  aggregates: {
    primaryHistorical: Record<RetrievalStrategy, AggregateMetrics>;
    allEvaluable: Record<RetrievalStrategy, AggregateMetrics>;
    byCategory: Record<string, Record<RetrievalStrategy, AggregateMetrics>>;
    byOrigin: Record<string, Record<RetrievalStrategy, AggregateMetrics>>;
    exactReferenceSuccessRate: Record<RetrievalStrategy, number | null>;
    rankComparison: { improved: number; worsened: number; unchanged: number };
    latencyMs: Record<string, LatencySummary>;
  };
}

const statuses = new Set<RetrievalGroundTruthStatus>(["reviewed", "provisional", "unresolved"]);
const origins = new Set<RetrievalBenchmarkOrigin>(["historical", "synthetic-paraphrase"]);
const categories = new Set<RetrievalBenchmarkCategory>(["exact-reference", "lexical-direct", "semantic-paraphrase",
  "ntc-circolare", "interpretative", "no-direct-reference"]);
const unitIdPattern = /^urn:structural-codes:it:unit:(ntc2018|circ2019):[^\s]+$/u;

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function parseRetrievalBenchmarkDataset(value: unknown): RetrievalBenchmarkDataset {
  if (!object(value) || value.formatVersion !== 1 || typeof value.name !== "string" || !value.name.trim()
    || typeof value.description !== "string" || !Array.isArray(value.cases) || !value.cases.length) {
    throw new Error("Dataset benchmark retrieval non valido.");
  }
  const ids = new Set<string>();
  const cases = value.cases.map((entry, index) => {
    if (!object(entry) || typeof entry.id !== "string" || !entry.id.trim() || ids.has(entry.id)
      || typeof entry.query !== "string" || !entry.query.trim() || !origins.has(entry.origin as RetrievalBenchmarkOrigin)
      || !Array.isArray(entry.categories) || !entry.categories.length
      || entry.categories.some((category) => !categories.has(category as RetrievalBenchmarkCategory))
      || new Set(entry.categories).size !== entry.categories.length || !object(entry.expected)
      || !Array.isArray(entry.expected.requiredUnitIds) || !Array.isArray(entry.expected.acceptableUnitIds)
      || entry.expected.document !== null && entry.expected.document !== "ntc2018" && entry.expected.document !== "circ2019"
      || typeof entry.expected.noDirectNormativeTarget !== "boolean"
      || !statuses.has(entry.groundTruthStatus as RetrievalGroundTruthStatus) || typeof entry.notes !== "string") {
      throw new Error(`Caso benchmark retrieval non valido in posizione ${index}.`);
    }
    const required = entry.expected.requiredUnitIds;
    const acceptable = entry.expected.acceptableUnitIds;
    if ([...required, ...acceptable].some((unitId) => typeof unitId !== "string" || !unitIdPattern.test(unitId))
      || new Set(required).size !== required.length || new Set(acceptable).size !== acceptable.length
      || required.some((unitId) => acceptable.includes(unitId))
      || entry.expected.noDirectNormativeTarget && required.length > 0
      || !entry.expected.noDirectNormativeTarget && required.length === 0) {
      throw new Error(`Ground truth non valido per ${entry.id}.`);
    }
    ids.add(entry.id);
    return {
      id: entry.id, query: entry.query, origin: entry.origin, categories: [...entry.categories],
      expected: { requiredUnitIds: [...required], acceptableUnitIds: [...acceptable],
        document: entry.expected.document, noDirectNormativeTarget: entry.expected.noDirectNormativeTarget },
      groundTruthStatus: entry.groundTruthStatus, notes: entry.notes,
    } as RetrievalBenchmarkCase;
  });
  return { formatVersion: 1, name: value.name, description: value.description, cases };
}

function rankOf(ids: readonly string[], relevant: ReadonlySet<string>): number | null {
  const position = ids.findIndex((unitId) => relevant.has(unitId));
  return position < 0 ? null : position + 1;
}

export function calculateRankingMetrics(rankedUnitIds: readonly string[], expected: RetrievalBenchmarkExpected): RankingMetrics {
  const required = new Set(expected.requiredUnitIds);
  const acceptable = new Set(expected.acceptableUnitIds);
  const firstRequiredRank = rankOf(rankedUnitIds, required);
  const firstAcceptableRank = rankOf(rankedUnitIds, acceptable);
  const countAt = (limit: number) => rankedUnitIds.slice(0, limit).filter((unitId) => required.has(unitId)).length;
  const requiredInTop5 = countAt(5);
  const requiredInTop10 = countAt(10);
  const evaluable = !expected.noDirectNormativeTarget && required.size > 0;
  return {
    hitAt1: evaluable ? firstRequiredRank === 1 : null,
    hitAt3: evaluable ? firstRequiredRank !== null && firstRequiredRank <= 3 : null,
    recallAt5: evaluable ? requiredInTop5 / required.size : null,
    recallAt10: evaluable ? requiredInTop10 / required.size : null,
    mrr: evaluable ? firstRequiredRank === null ? 0 : 1 / firstRequiredRank : null,
    firstRequiredRank, requiredInTop5, requiredInTop10,
    acceptablePresent: firstAcceptableRank !== null, firstAcceptableRank,
  };
}

const mean = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;

export function aggregateStrategyMetrics(results: readonly RetrievalBenchmarkCaseResult[], strategy: RetrievalStrategy): AggregateMetrics {
  const metrics = results.filter((result) => result.groundTruthStatus !== "unresolved"
    && !result.groundTruth.noDirectNormativeTarget && result.groundTruth.requiredUnitIds.length > 0)
    .map((result) => result.metrics[strategy]);
  return {
    queryCount: metrics.length,
    hitAt1: mean(metrics.map((metric) => Number(metric.hitAt1))),
    hitAt3: mean(metrics.map((metric) => Number(metric.hitAt3))),
    recallAt5: mean(metrics.map((metric) => metric.recallAt5 ?? 0)),
    recallAt10: mean(metrics.map((metric) => metric.recallAt10 ?? 0)),
    mrr: mean(metrics.map((metric) => metric.mrr ?? 0)),
  };
}

function percentile(sorted: readonly number[], probability: number): number | null {
  if (!sorted.length) return null;
  if (sorted.length === 1) return sorted[0];
  const position = (sorted.length - 1) * probability;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  const weight = position - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

export function aggregateLatencies(values: readonly number[]): LatencySummary {
  const sorted = values.filter(Number.isFinite).map((value) => Math.max(0, value)).sort((left, right) => left - right);
  return { count: sorted.length, median: percentile(sorted, 0.5), p90: percentile(sorted, 0.9),
    p95: percentile(sorted, 0.95), max: sorted.length ? sorted[sorted.length - 1] : null };
}

export function compareFirstRelevantRanks(results: readonly RetrievalBenchmarkCaseResult[], missingRank: number) {
  let improved = 0; let worsened = 0; let unchanged = 0;
  for (const result of results) {
    if (result.groundTruthStatus === "unresolved" || result.groundTruth.noDirectNormativeTarget
      || !result.groundTruth.requiredUnitIds.length) continue;
    const lexical = result.metrics.lexical.firstRequiredRank ?? missingRank;
    const hybrid = result.metrics.hybrid.firstRequiredRank ?? missingRank;
    if (hybrid < lexical) improved += 1;
    else if (hybrid > lexical) worsened += 1;
    else unchanged += 1;
  }
  return { improved, worsened, unchanged };
}

const percent = (value: number | null) => value === null ? "n/a" : `${(value * 100).toFixed(1)}%`;
const milliseconds = (value: number | null) => value === null ? "n/a" : value.toFixed(2);
const rank = (value: number | null) => value === null ? "—" : String(value);

export function generateRetrievalBenchmarkReport(results: RetrievalBenchmarkResults): string {
  const primary = results.aggregates.primaryHistorical;
  const comparison = results.aggregates.rankComparison;
  const recall5Delta = (primary.hybrid.recallAt5 ?? 0) - (primary.lexical.recallAt5 ?? 0);
  const recall10Delta = (primary.hybrid.recallAt10 ?? 0) - (primary.lexical.recallAt10 ?? 0);
  const categoryRows = Object.entries(results.aggregates.byCategory).map(([category, strategies]) => ({ category,
    count: strategies.lexical.queryCount,
    delta: (strategies.hybrid.recallAt5 ?? 0) - (strategies.lexical.recallAt5 ?? 0) }))
    .sort((left, right) => right.delta - left.delta || left.category.localeCompare(right.category, "en"));
  const changed = results.cases.filter((result) => result.rankDeltaHybridVsLexical !== null
    && result.rankDeltaHybridVsLexical !== 0).sort((left, right) =>
    (left.rankDeltaHybridVsLexical ?? 0) - (right.rankDeltaHybridVsLexical ?? 0));
  const review = results.cases.filter((result) => result.groundTruthStatus !== "reviewed"
    || result.groundTruth.noDirectNormativeTarget || result.metrics.hybrid.firstRequiredRank === null);
  const latency = results.aggregates.latencyMs;
  const lines = [
    "# ChatNTC retrieval benchmark",
    "",
    `Generato: ${String(results.metadata.timestamp)}`,
    `Dataset: ${results.dataset.totalCases} casi (${results.dataset.historicalCases} historical, ${results.dataset.syntheticParaphraseCases} synthetic-paraphrase).`,
    "",
    "## Sintesi primaria — query historical",
    "",
    "I casi `unresolved` e quelli senza target normativo diretto sono esclusi da Hit, Recall e MRR.",
    "",
    "| strategia | casi | Hit@1 | Hit@3 | Recall@5 | Recall@10 | MRR |",
    "|---|---:|---:|---:|---:|---:|---:|",
    ...(["lexical", "semantic", "hybrid"] as const).map((strategy) => {
      const item = primary[strategy];
      return `| ${strategy} | ${item.queryCount} | ${percent(item.hitAt1)} | ${percent(item.hitAt3)} | ${percent(item.recallAt5)} | ${percent(item.recallAt10)} | ${item.mrr?.toFixed(3) ?? "n/a"} |`;
    }),
    "",
    "## Risposte quantitative",
    "",
    `1. Delta Recall@5 hybrid − lexical: ${(recall5Delta * 100).toFixed(1)} punti percentuali.`,
    `2. Delta Recall@10 hybrid − lexical: ${(recall10Delta * 100).toFixed(1)} punti percentuali.`,
    `3. Query migliorate per posizione della prima unità required: ${comparison.improved}.`,
    `4. Query peggiorate: ${comparison.worsened}.`,
    `5. Query invariate: ${comparison.unchanged}.`,
    `6. Miglior delta Recall@5 per categoria: ${categoryRows[0]?.category ?? "n/a"} (${categoryRows[0] ? (categoryRows[0].delta * 100).toFixed(1) : "n/a"} punti, ${categoryRows[0]?.count ?? 0} casi).`,
    `7. Regressioni di rank elencate nella tabella seguente: ${changed.filter((item) => (item.rankDeltaHybridVsLexical ?? 0) > 0).length}.`,
    `8. Exact-reference success rate hybrid: ${percent(results.aggregates.exactReferenceSuccessRate.hybrid)} (lexical ${percent(results.aggregates.exactReferenceSuccessRate.lexical)}).`,
    `9. Costo mediano query embedding: ${milliseconds(latency.queryEmbedding?.median ?? null)} ms; semantic vector search: ${milliseconds(latency.semanticVectorSearch?.median ?? null)} ms; hybrid totale: ${milliseconds(latency.hybridTotal?.median ?? null)} ms.`,
    `10. Query segnalate per review manuale: ${review.length}.`,
    "",
    "Il delta di rank è `rank hybrid − rank lexical`: un valore negativo indica un miglioramento. Un risultato assente nei primi candidati è indicato con —.",
    "",
    "| query | lexical first relevant rank | semantic first relevant rank | hybrid first relevant rank | delta hybrid-vs-lexical |",
    "|---|---:|---:|---:|---:|",
    ...changed.map((item) => `| ${item.query.replaceAll("|", "\\|")} | ${rank(item.metrics.lexical.firstRequiredRank)} | ${rank(item.metrics.semantic.firstRequiredRank)} | ${rank(item.metrics.hybrid.firstRequiredRank)} | ${item.rankDeltaHybridVsLexical ?? "—"} |`),
    "",
    "## Analisi per categoria",
    "",
    "| categoria | casi valutabili | lexical Recall@5 | semantic Recall@5 | hybrid Recall@5 | delta hybrid-lexical |",
    "|---|---:|---:|---:|---:|---:|",
    ...categoryRows.map(({ category, count, delta }) => {
      const strategies = results.aggregates.byCategory[category];
      return `| ${category} | ${count} | ${percent(strategies.lexical.recallAt5)} | ${percent(strategies.semantic.recallAt5)} | ${percent(strategies.hybrid.recallAt5)} | ${(delta * 100).toFixed(1)} pp |`;
    }),
    "",
    "## Latenza",
    "",
    "| fase | median ms | P90 ms | P95 ms | max ms |",
    "|---|---:|---:|---:|---:|",
    ...Object.entries(latency).map(([name, item]) => `| ${name} | ${milliseconds(item.median)} | ${milliseconds(item.p90)} | ${milliseconds(item.p95)} | ${milliseconds(item.max)} |`),
    "",
    "## Query da rivedere manualmente",
    "",
    ...(review.length ? review.map((item) => `- **${item.id}** — ${item.groundTruthStatus}${item.groundTruth.noDirectNormativeTarget ? ", no-direct-reference" : ""}: ${item.query}`) : ["Nessuna."]),
    "",
    "## Configurazione riproducibile",
    "",
    "```json",
    JSON.stringify(results.metadata, null, 2),
    "```",
    "",
  ];
  return lines.join("\n");
}

export function generateGroundTruthReview(dataset: RetrievalBenchmarkDataset,
  units: ReadonlyMap<string, { numbering: string; title: string }>): string {
  const reference = (unitId: string) => {
    const unit = units.get(unitId);
    return unit ? `${unit.numbering} — ${unit.title} (${unitId})` : `[UNITÀ MANCANTE] ${unitId}`;
  };
  return [
    "# ChatNTC retrieval benchmark — ground truth review",
    "",
    "Questo report è locale. I casi `unresolved` non partecipano alle metriche aggregate di recall.",
    "",
    ...dataset.cases.flatMap((entry) => [
      `## ${entry.id}`,
      "",
      `- Query: ${entry.query}`,
      `- Origine: ${entry.origin}`,
      `- Categorie: ${entry.categories.join(", ")}`,
      `- Stato: ${entry.groundTruthStatus}`,
      `- Target normativo diretto: ${entry.expected.noDirectNormativeTarget ? "no" : "sì"}`,
      `- Documento: ${entry.expected.document ?? "NTC + Circolare / non vincolato"}`,
      "- Required units:",
      ...(entry.expected.requiredUnitIds.length ? entry.expected.requiredUnitIds.map((unitId) => `  - ${reference(unitId)}`) : ["  - Nessuna."]),
      "- Acceptable units:",
      ...(entry.expected.acceptableUnitIds.length ? entry.expected.acceptableUnitIds.map((unitId) => `  - ${reference(unitId)}`) : ["  - Nessuna."]),
      `- Motivazione: ${entry.notes}`,
      "",
    ]),
  ].join("\n");
}
