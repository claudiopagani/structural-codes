import assert from "node:assert/strict";
import test from "node:test";
import {
  aggregateLatencies, aggregateStrategyMetrics, calculateRankingMetrics, compareFirstRelevantRanks,
  generateGroundTruthReview, generateRetrievalBenchmarkReport, parseRetrievalBenchmarkDataset,
} from "../.chatntc-test/server/chatntc/retrievalBenchmark.js";

const expected = (requiredUnitIds, acceptableUnitIds = [], noDirectNormativeTarget = false) => ({
  requiredUnitIds, acceptableUnitIds, document: null, noDirectNormativeTarget,
});

test("Hit@K, Recall@K e MRR usano correttamente ground truth multiplo", () => {
  const metrics = calculateRankingMetrics(["a", "x", "b", "y", "z", "c"], expected(["a", "b", "c"], ["x"]));
  assert.equal(metrics.hitAt1, true);
  assert.equal(metrics.hitAt3, true);
  assert.equal(metrics.recallAt5, 2 / 3);
  assert.equal(metrics.recallAt10, 1);
  assert.equal(metrics.mrr, 1);
  assert.equal(metrics.firstRequiredRank, 1);
  assert.equal(metrics.requiredInTop5, 2);
  assert.equal(metrics.requiredInTop10, 3);
  assert.equal(metrics.acceptablePresent, true);
  assert.equal(metrics.firstAcceptableRank, 2);

  const missedFirst = calculateRankingMetrics(["x", "b"], expected(["a", "b"]));
  assert.equal(missedFirst.hitAt1, false);
  assert.equal(missedFirst.mrr, 1 / 2);
  assert.equal(missedFirst.recallAt5, 1 / 2);
});

test("i casi no-direct-reference non producono recall artificiale", () => {
  const metrics = calculateRankingMetrics(["context"], expected([], ["context"], true));
  assert.equal(metrics.hitAt1, null);
  assert.equal(metrics.hitAt3, null);
  assert.equal(metrics.recallAt5, null);
  assert.equal(metrics.recallAt10, null);
  assert.equal(metrics.mrr, null);
  assert.equal(metrics.acceptablePresent, true);
});

const result = ({ id, status = "reviewed", category = "semantic-paraphrase", origin = "historical",
  noDirect = false, lexicalRank = 2, semanticRank = 1, hybridRank = 1, recall5 = 1 }) => {
  const metric = (firstRequiredRank, recallAt5) => ({ hitAt1: firstRequiredRank === 1, hitAt3: firstRequiredRank <= 3,
    recallAt5, recallAt10: recallAt5, mrr: 1 / firstRequiredRank, firstRequiredRank,
    requiredInTop5: recallAt5, requiredInTop10: recallAt5, acceptablePresent: false, firstAcceptableRank: null });
  const nullMetric = { hitAt1: null, hitAt3: null, recallAt5: null, recallAt10: null, mrr: null,
    firstRequiredRank: null, requiredInTop5: 0, requiredInTop10: 0, acceptablePresent: true, firstAcceptableRank: 1 };
  const groundTruth = { ...expected(noDirect ? [] : ["u"], noDirect ? ["context"] : [], noDirect), notes: "fixture" };
  return { id, query: `query ${id}`, origin, categories: [category], groundTruthStatus: status, groundTruth,
    rankings: { lexical: [], semantic: [], hybrid: [] },
    metrics: noDirect ? { lexical: nullMetric, semantic: nullMetric, hybrid: nullMetric } : {
      lexical: metric(lexicalRank, recall5), semantic: metric(semanticRank, recall5), hybrid: metric(hybridRank, recall5),
    }, overlap: { lexicalSemanticCount: 0, lexicalSemanticRatio: 0, top10Count: 0 },
    rankDeltaHybridVsLexical: noDirect ? null : hybridRank - lexicalRank,
    latenciesMs: { lexical: 1, queryEmbedding: 2, semanticVectorSearch: 3, semanticTotal: 5, rrf: 0.1, hybridTotal: 6.1 } };
};

test("le aggregazioni escludono unresolved e no-direct e restano separabili per categoria", () => {
  const fixtures = [result({ id: "a" }), result({ id: "b", status: "provisional", lexicalRank: 4, hybridRank: 2 }),
    result({ id: "c", status: "unresolved" }), result({ id: "d", noDirect: true, category: "no-direct-reference" })];
  const aggregate = aggregateStrategyMetrics(fixtures, "hybrid");
  assert.equal(aggregate.queryCount, 2);
  assert.equal(aggregate.hitAt1, 0.5);
  assert.equal(aggregate.recallAt5, 1);
  assert.deepEqual(compareFirstRelevantRanks(fixtures, 51), { improved: 2, worsened: 0, unchanged: 0 });
  const noDirect = aggregateStrategyMetrics(fixtures.filter((entry) => entry.categories.includes("no-direct-reference")), "hybrid");
  assert.equal(noDirect.queryCount, 0);
  assert.equal(noDirect.recallAt5, null);
});

test("la latenza espone median, P90, P95 e max in modo deterministico", () => {
  const summary = aggregateLatencies([1, 2, 3, 4]);
  assert.equal(summary.count, 4);
  assert.equal(summary.median, 2.5);
  assert.ok(Math.abs(summary.p90 - 3.7) < 1e-12);
  assert.ok(Math.abs(summary.p95 - 3.85) < 1e-12);
  assert.equal(summary.max, 4);
});

test("validazione dataset e ground-truth review preservano status e riferimenti", () => {
  const unitId = "urn:structural-codes:it:unit:ntc2018:1.1";
  const dataset = parseRetrievalBenchmarkDataset({ formatVersion: 1, name: "fixture", description: "fixture", cases: [{
    id: "case-1", query: "1.1", origin: "historical", categories: ["exact-reference"],
    expected: { requiredUnitIds: [unitId], acceptableUnitIds: [], document: "ntc2018", noDirectNormativeTarget: false },
    groundTruthStatus: "reviewed", notes: "riferimento diretto",
  }] });
  const report = generateGroundTruthReview(dataset, new Map([[unitId, { numbering: "1.1", title: "Titolo" }]]));
  assert.match(report, /1\.1 — Titolo/u);
  assert.match(report, /Stato: reviewed/u);
});

test("il report comparativo include metriche, delta, latenze e query da rivedere", () => {
  const cases = [result({ id: "better", lexicalRank: 3, hybridRank: 1 }),
    result({ id: "review", status: "provisional", lexicalRank: 1, hybridRank: 2 })];
  const aggregate = (strategy) => aggregateStrategyMetrics(cases, strategy);
  const latency = aggregateLatencies([1, 2]);
  const report = generateRetrievalBenchmarkReport({ formatVersion: 1, metadata: { timestamp: "2026-01-01T00:00:00.000Z" },
    dataset: { name: "fixture", fingerprintSha256: "f".repeat(64), totalCases: 2, historicalCases: 2,
      syntheticParaphraseCases: 0, statusCounts: { reviewed: 1, provisional: 1, unresolved: 0 } }, cases,
    aggregates: { primaryHistorical: { lexical: aggregate("lexical"), semantic: aggregate("semantic"), hybrid: aggregate("hybrid") },
      allEvaluable: { lexical: aggregate("lexical"), semantic: aggregate("semantic"), hybrid: aggregate("hybrid") },
      byCategory: { "semantic-paraphrase": { lexical: aggregate("lexical"), semantic: aggregate("semantic"), hybrid: aggregate("hybrid") } },
      byOrigin: { historical: { lexical: aggregate("lexical"), semantic: aggregate("semantic"), hybrid: aggregate("hybrid") } },
      exactReferenceSuccessRate: { lexical: 1, semantic: 0.5, hybrid: 1 },
      rankComparison: { improved: 1, worsened: 1, unchanged: 0 },
      latencyMs: { lexical: latency, queryEmbedding: latency, semanticVectorSearch: latency,
        semanticTotal: latency, rrf: latency, hybridTotal: latency } } });
  assert.match(report, /Delta Recall@5/u);
  assert.match(report, /better/u);
  assert.match(report, /query embedding/u);
  assert.match(report, /review manuale/u);
});
