import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { performance } from "node:perf_hooks";
import { loadChatNTCCorpus } from "./load-chatntc-corpus.js";
import { findCrossReferences } from "../shared/crossReferences.js";
import type { ChatNTCHit } from "../shared/chatntc/index.js";
import { createLocalArtifactRepository } from "../server/chatntc/localRepository.js";
import {
  assertChatNTCEmbeddingCompatibility, createChatNTCEmbeddingProvider, parseChatNTCEmbeddingProvider,
} from "../server/chatntc/embeddingProviderFactory.js";
import { CHATNTC_HYBRID_RETRIEVAL_DEFAULTS, fuseChatNTCRankings } from "../server/chatntc/rankFusion.js";
import { createChatNTCSemanticIndexLoader, createChatNTCSemanticRetriever } from "../server/chatntc/semanticRetriever.js";
import type { ChatNTCEmbeddingProvider } from "../server/chatntc/semanticIndex.js";
import {
  aggregateLatencies, aggregateStrategyMetrics, calculateRankingMetrics, compareFirstRelevantRanks,
  generateGroundTruthReview, generateRetrievalBenchmarkReport, parseRetrievalBenchmarkDataset,
  type BenchmarkRankingHit, type RetrievalBenchmarkCaseResult, type RetrievalBenchmarkResults,
  type RetrievalStrategy,
} from "../server/chatntc/retrievalBenchmark.js";

const viewerRoot = resolve(process.cwd());
const args = process.argv.slice(2);
const option = (name: string) => {
  const position = args.indexOf(`--${name}`);
  if (position < 0) return undefined;
  const value = args[position + 1];
  if (!value || value.startsWith("--")) throw new Error(`--${name} richiede un valore.`);
  return value;
};
const numberOption = (name: string) => {
  const value = option(name);
  if (value === undefined) return undefined;
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 1) throw new Error(`--${name} non valido.`);
  return number;
};
if (args.includes("--help")) {
  console.log("Uso: npm --prefix viewer run chatntc:retrieval:benchmark -- [--index DIR] [--output DIR] [--provider <ollama|flagembedding-http>] [--embedding-url URL] [--timeout-ms N] [--batch-size N] [--ollama-url URL]");
  process.exit(0);
}

const datasetFile = join(viewerRoot, "benchmarks", "chatntc-retrieval-cases.json");
const dataDirectory = join(viewerRoot, "public", "data", "codes");
const indexDirectory = resolve(option("index") ?? join(viewerRoot, ".local", "chatntc-semantic"));
const outputDirectory = resolve(option("output") ?? join(viewerRoot, ".local", "chatntc-retrieval-benchmark"));
const localRoot = join(viewerRoot, ".local");
const outputRelative = relative(localRoot, outputDirectory);
if (!outputRelative || isAbsolute(outputRelative) || outputRelative === ".." || outputRelative.startsWith(`..${sep}`)) {
  throw new Error("La destinazione del benchmark deve essere una sottodirectory di viewer/.local/.");
}

const sha256 = (value: string | Uint8Array) => createHash("sha256").update(value).digest("hex");
const datasetRaw = await readFile(datasetFile, "utf8");
const dataset = parseRetrievalBenchmarkDataset(JSON.parse(datasetRaw) as unknown);
const { manifest, units } = await loadChatNTCCorpus(dataDirectory);
const unitIds = new Set(units.map((unit) => unit.id));
for (const entry of dataset.cases) {
  for (const unitId of [...entry.expected.requiredUnitIds, ...entry.expected.acceptableUnitIds]) {
    if (!unitIds.has(unitId)) throw new Error(`Ground truth ${entry.id}: unità non presente nel corpus: ${unitId}`);
  }
}
await mkdir(outputDirectory, { recursive: true });
const unitLabels = new Map(units.map((unit) => [unit.id,
  { numbering: unit.numbering.official, title: unit.title }]));
await writeFile(join(outputDirectory, "ground-truth-review.md"), generateGroundTruthReview(dataset, unitLabels), "utf8");

let rawMetadata: string;
try {
  rawMetadata = await readFile(join(indexDirectory, "index.json"), "utf8");
} catch (error) {
  throw new Error(`Benchmark ChatNTC interrotto: indice semantic non disponibile in ${indexDirectory}. `
    + "Generarlo o ripristinarlo prima della run; non è stato eseguito alcun fallback lexical-only.", { cause: error });
}
const indexMetadata = JSON.parse(rawMetadata) as Record<string, unknown>;
if (typeof indexMetadata.embeddingProvider !== "string" || typeof indexMetadata.embeddingModel !== "string" || typeof indexMetadata.dimensions !== "number"
  || !indexMetadata.parameters || typeof indexMetadata.parameters !== "object") {
  throw new Error("Benchmark ChatNTC interrotto: metadata dell'indice semantic non validi.");
}
const parameters = indexMetadata.parameters as Record<string, unknown>;
const numCtx = typeof parameters.numCtx === "number" ? parameters.numCtx : undefined;
const requestedDimensions = typeof parameters.requestedDimensions === "number" ? parameters.requestedDimensions : undefined;
const indexProvider = parseChatNTCEmbeddingProvider(indexMetadata.embeddingProvider, "ollama");
const providerName = parseChatNTCEmbeddingProvider(option("provider"), indexProvider);
const provider = createChatNTCEmbeddingProvider({ provider: providerName, model: indexMetadata.embeddingModel,
  baseUrl: providerName === "ollama" ? option("ollama-url") : option("embedding-url"),
  timeoutMs: numberOption("timeout-ms"), batchSize: numberOption("batch-size"),
  dimensions: requestedDimensions, numCtx });
let lastEmbeddingMs = 0;
const timedProvider: ChatNTCEmbeddingProvider = {
  describe: (options) => provider.describe(options),
  async embed(texts, options) {
    const started = performance.now();
    try { return await provider.embed(texts, options); }
    finally { lastEmbeddingMs = performance.now() - started; }
  },
};
const summaries = units.map((unit) => ({ unitId: unit.id, document: unit.document,
  numbering: unit.numbering.official }));
const loader = createChatNTCSemanticIndexLoader({ directory: indexDirectory,
  expected: { corpusFingerprint: manifest.corpusFingerprintSha256, unitIds: units.map((unit) => unit.id) } });
let loadedIndex;
try {
  const liveDescription = await provider.describe();
  loadedIndex = await loader.load();
  assertChatNTCEmbeddingCompatibility(liveDescription, loadedIndex.metadata);
} catch (error) {
  const detail = error instanceof Error ? error.message : String(error);
  throw new Error(`Benchmark ChatNTC interrotto durante il preflight semantic/${providerName}: ${detail}. `
    + "Non è stato eseguito alcun fallback lexical-only.", { cause: error });
}
const retriever = createChatNTCSemanticRetriever({ provider: timedProvider, indexLoader: loader, units: summaries });
const repository = createLocalArtifactRepository(dataDirectory);
const corpusIdentity = await repository.identity();
// Warm-up dei soli artifact/caches locali e delle descrizioni già validate; nessuna query del dataset viene alterata.
await Promise.all([repository.resolveExact("0.0"), repository.search("__chatntc_benchmark_warmup__", 1)]);

function primaryRanking(explicitHits: readonly ChatNTCHit[], rankedHits: readonly ChatNTCHit[]) {
  const explicitUnitIds = new Set(explicitHits.map((hit) => hit.unitId));
  const hits = [...explicitHits, ...rankedHits];
  hits.sort((left, right) => Number(explicitUnitIds.has(right.unitId)) - Number(explicitUnitIds.has(left.unitId))
    || right.score - left.score || left.unitId.localeCompare(right.unitId, "en"));
  const seen = new Set<string>();
  return hits.filter((hit) => !seen.has(hit.unitId) && Boolean(seen.add(hit.unitId)))
    .slice(0, CHATNTC_HYBRID_RETRIEVAL_DEFAULTS.fusedCandidateCount);
}

async function lexicalCandidates(query: string) {
  const exact = await repository.resolveExact(query);
  if (exact !== null) return { exact, explicitHits: exact, searchHits: [] as ChatNTCHit[], ranking: exact };
  const explicitHits: ChatNTCHit[] = [];
  for (const reference of findCrossReferences(query).slice(0, 12)) {
    const resolved = await repository.resolveExact(reference.text);
    explicitHits.push(...resolved ?? []);
  }
  const searchHits = await repository.search(query, CHATNTC_HYBRID_RETRIEVAL_DEFAULTS.lexicalCandidateCount);
  return { exact: null, explicitHits, searchHits, ranking: primaryRanking(explicitHits, searchHits) };
}

const results: RetrievalBenchmarkCaseResult[] = [];
for (const [position, entry] of dataset.cases.entries()) {
  const lexicalStarted = performance.now();
  const lexical = await lexicalCandidates(entry.query);
  const lexicalMs = performance.now() - lexicalStarted;
  lastEmbeddingMs = 0;
  const semanticStarted = performance.now();
  const semantic = await retriever.retrieve({ query: entry.query,
    limit: CHATNTC_HYBRID_RETRIEVAL_DEFAULTS.semanticCandidateCount });
  const semanticTotalMs = performance.now() - semanticStarted;
  const queryEmbeddingMs = lastEmbeddingMs;
  const semanticVectorSearchMs = Math.max(0, semanticTotalMs - queryEmbeddingMs);
  let rrfMs = 0;
  let hybridHits: ChatNTCHit[];
  let fusionRanking = [] as ReturnType<typeof fuseChatNTCRankings>["ranking"];
  if (lexical.exact !== null) {
    hybridHits = lexical.exact;
  } else {
    const rrfStarted = performance.now();
    const fusion = fuseChatNTCRankings({ lexicalHits: lexical.searchHits, semanticHits: semantic.hits,
      limit: CHATNTC_HYBRID_RETRIEVAL_DEFAULTS.fusedCandidateCount,
      k: CHATNTC_HYBRID_RETRIEVAL_DEFAULTS.rrfK });
    rrfMs = performance.now() - rrfStarted;
    fusionRanking = fusion.ranking;
    hybridHits = primaryRanking(lexical.explicitHits, fusion.hits);
  }
  const hybridTotalMs = lexical.exact !== null ? lexicalMs : lexicalMs + semanticTotalMs + rrfMs;

  const lexicalRankingHits: BenchmarkRankingHit[] = lexical.ranking.map((hit, index) => ({ unitId: hit.unitId,
    rank: index + 1, score: hit.score, match: hit.match }));
  const semanticRankingHits: BenchmarkRankingHit[] = semantic.hits.map((hit) => ({ unitId: hit.unitId,
    rank: hit.semanticRank, score: hit.similarity, similarity: hit.similarity, semanticRank: hit.semanticRank }));
  const fusionByUnit = new Map(fusionRanking.map((hit) => [hit.unitId, hit]));
  const hybridRankingHits: BenchmarkRankingHit[] = hybridHits.map((hit, index) => {
    const fused = fusionByUnit.get(hit.unitId);
    return { unitId: hit.unitId, rank: index + 1, score: hit.score, match: hit.match,
      ...(fused ? { rrfScore: fused.fusedScore, lexicalRank: fused.lexicalRank,
        semanticRank: fused.semanticRank } : {}) };
  });
  const rankings = { lexical: lexicalRankingHits, semantic: semanticRankingHits, hybrid: hybridRankingHits };
  const metrics = Object.fromEntries((Object.keys(rankings) as RetrievalStrategy[]).map((strategy) =>
    [strategy, calculateRankingMetrics(rankings[strategy].map((hit) => hit.unitId), entry.expected)])) as RetrievalBenchmarkCaseResult["metrics"];
  const lexicalIds = new Set(lexicalRankingHits.map((hit) => hit.unitId));
  const semanticIds = new Set(semanticRankingHits.map((hit) => hit.unitId));
  const overlapCount = [...lexicalIds].filter((unitId) => semanticIds.has(unitId)).length;
  const overlapDenominator = Math.min(lexicalIds.size, semanticIds.size);
  const lexicalTop10 = new Set(lexicalRankingHits.slice(0, 10).map((hit) => hit.unitId));
  const semanticTop10 = new Set(semanticRankingHits.slice(0, 10).map((hit) => hit.unitId));
  const top10Count = [...lexicalTop10].filter((unitId) => semanticTop10.has(unitId)).length;
  const evaluable = entry.groundTruthStatus !== "unresolved" && !entry.expected.noDirectNormativeTarget;
  const lexicalRank = metrics.lexical.firstRequiredRank ?? CHATNTC_HYBRID_RETRIEVAL_DEFAULTS.fusedCandidateCount + 1;
  const hybridRank = metrics.hybrid.firstRequiredRank ?? CHATNTC_HYBRID_RETRIEVAL_DEFAULTS.fusedCandidateCount + 1;
  results.push({ id: entry.id, query: entry.query, origin: entry.origin, categories: entry.categories,
    groundTruthStatus: entry.groundTruthStatus, groundTruth: { ...entry.expected, notes: entry.notes }, rankings, metrics,
    overlap: { lexicalSemanticCount: overlapCount,
      lexicalSemanticRatio: overlapDenominator ? overlapCount / overlapDenominator : 0, top10Count },
    rankDeltaHybridVsLexical: evaluable && (metrics.lexical.firstRequiredRank !== null
      || metrics.hybrid.firstRequiredRank !== null) ? hybridRank - lexicalRank : null,
    latenciesMs: { lexical: lexicalMs, queryEmbedding: queryEmbeddingMs,
      semanticVectorSearch: semanticVectorSearchMs, semanticTotal: semanticTotalMs, rrf: rrfMs,
      hybridTotal: hybridTotalMs } });
  console.log(`[${position + 1}/${dataset.cases.length}] ${entry.id}`);
}

const strategies: RetrievalStrategy[] = ["lexical", "semantic", "hybrid"];
const aggregate = (selected: RetrievalBenchmarkCaseResult[]) => Object.fromEntries(strategies.map((strategy) =>
  [strategy, aggregateStrategyMetrics(selected, strategy)])) as Record<RetrievalStrategy, ReturnType<typeof aggregateStrategyMetrics>>;
const categoryNames = [...new Set(dataset.cases.flatMap((entry) => entry.categories))].sort();
const originNames = [...new Set(dataset.cases.map((entry) => entry.origin))].sort();
const exact = results.filter((result) => result.categories.includes("exact-reference")
  && result.groundTruthStatus !== "unresolved" && result.groundTruth.requiredUnitIds.length > 0);
const exactRate = (strategy: RetrievalStrategy) => exact.length
  ? exact.filter((result) => result.metrics[strategy].hitAt1).length / exact.length : null;
const latencyKeys = ["lexical", "queryEmbedding", "semanticVectorSearch", "semanticTotal", "rrf", "hybridTotal"] as const;
const benchmark: RetrievalBenchmarkResults = {
  formatVersion: 1,
  metadata: {
    timestamp: new Date().toISOString(),
    embeddingProvider: loadedIndex.metadata.embeddingProvider,
    embeddingModel: loadedIndex.metadata.embeddingModel,
    modelVersion: loadedIndex.metadata.modelVersion,
    modelDigest: loadedIndex.metadata.modelDigest,
    dimensions: loadedIndex.metadata.dimensions,
    tokenizerModel: loadedIndex.metadata.tokenizerModel,
    tokenizerRevision: loadedIndex.metadata.tokenizerRevision,
    corpusFingerprint: loadedIndex.metadata.corpusFingerprint,
    generatedArtifactFingerprint: corpusIdentity.artifactFingerprint,
    semanticInputFingerprint: loadedIndex.metadata.inputFingerprint,
    semanticMetadataSha256: sha256(rawMetadata),
    semanticVectorsSha256: loadedIndex.metadata.vectors.sha256,
    semanticIndexUnitCount: loadedIndex.metadata.unitCount,
    semanticIndexChunkCount: loadedIndex.metadata.chunkCount,
    chunking: loadedIndex.metadata.chunking,
    rrf: { k: CHATNTC_HYBRID_RETRIEVAL_DEFAULTS.rrfK,
      lexicalCandidateCount: CHATNTC_HYBRID_RETRIEVAL_DEFAULTS.lexicalCandidateCount,
      semanticCandidateCount: CHATNTC_HYBRID_RETRIEVAL_DEFAULTS.semanticCandidateCount,
      fusedCandidateCount: CHATNTC_HYBRID_RETRIEVAL_DEFAULTS.fusedCandidateCount },
    queryEmbeddingLatencyMeasurement: `${providerName} provider.embed wall time`,
    semanticVectorSearchLatencyMeasurement: "semantic retrieve wall time minus query embedding wall time",
    warmup: "local repository indexes and semantic index/provider metadata preloaded before measurements",
    generativeLlmCalls: 0,
  },
  dataset: { name: dataset.name, fingerprintSha256: sha256(datasetRaw), totalCases: dataset.cases.length,
    historicalCases: dataset.cases.filter((entry) => entry.origin === "historical").length,
    syntheticParaphraseCases: dataset.cases.filter((entry) => entry.origin === "synthetic-paraphrase").length,
    statusCounts: { reviewed: dataset.cases.filter((entry) => entry.groundTruthStatus === "reviewed").length,
      provisional: dataset.cases.filter((entry) => entry.groundTruthStatus === "provisional").length,
      unresolved: dataset.cases.filter((entry) => entry.groundTruthStatus === "unresolved").length } },
  cases: results,
  aggregates: {
    primaryHistorical: aggregate(results.filter((result) => result.origin === "historical")),
    allEvaluable: aggregate(results),
    byCategory: Object.fromEntries(categoryNames.map((category) => [category,
      aggregate(results.filter((result) => result.categories.includes(category)))])),
    byOrigin: Object.fromEntries(originNames.map((origin) => [origin,
      aggregate(results.filter((result) => result.origin === origin))])),
    exactReferenceSuccessRate: Object.fromEntries(strategies.map((strategy) => [strategy, exactRate(strategy)])) as
      Record<RetrievalStrategy, number | null>,
    rankComparison: compareFirstRelevantRanks(results, CHATNTC_HYBRID_RETRIEVAL_DEFAULTS.fusedCandidateCount + 1),
    latencyMs: Object.fromEntries(latencyKeys.map((key) => [key,
      aggregateLatencies(results.map((result) => result.latenciesMs[key]))])),
  },
};
await writeFile(join(outputDirectory, "results.json"), `${JSON.stringify(benchmark, null, 2)}\n`, "utf8");
await writeFile(join(outputDirectory, "report.md"), generateRetrievalBenchmarkReport(benchmark), "utf8");
console.log(`Benchmark completato: ${dataset.cases.length} query; output in ${outputDirectory}`);
