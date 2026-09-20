import assert from "node:assert/strict";
import test from "node:test";
import {
  CHATNTC_HYBRID_RETRIEVAL_DEFAULTS, fuseChatNTCRankings,
} from "../.chatntc-test/server/chatntc/rankFusion.js";

const lexical = (unitId, score, match = "text") => ({ unitId, score, match });
const semantic = (unitId, semanticRank, similarity) => ({ unitId, document: "ntc2018",
  numbering: unitId, semanticRank, similarity });

test("RRF fonde risultati comuni, lexical-only e semantic-only usando esclusivamente i rank", () => {
  const result = fuseChatNTCRankings({
    lexicalHits: [lexical("a", 0.0001, "title"), lexical("b", 999_999, "phrase"), lexical("c", -500)],
    semanticHits: [semantic("b", 1, -0.9), semantic("d", 2, 1), semantic("a", 3, 0.99)],
    limit: 4,
  });
  assert.deepEqual(result.ranking.map((hit) => hit.unitId), ["b", "a", "d", "c"]);
  assert.deepEqual(result.ranking.map((hit) => hit.sourceMembership), [
    ["lexical", "semantic"], ["lexical", "semantic"], ["semantic"], ["lexical"],
  ]);
  assert.equal(result.ranking[0].fusedScore,
    1 / (CHATNTC_HYBRID_RETRIEVAL_DEFAULTS.rrfK + 2) + 1 / (CHATNTC_HYBRID_RETRIEVAL_DEFAULTS.rrfK + 1));
  assert.deepEqual(result.ranking[0], {
    unitId: "b", fusedRank: 1, fusedScore: result.ranking[0].fusedScore,
    lexicalRank: 2, semanticRank: 1, lexicalScore: 999_999, semanticScore: -0.9,
    sourceMembership: ["lexical", "semantic"],
  });
  assert.equal(result.hits.find((hit) => hit.unitId === "a").match, "title");
  assert.equal(result.hits.find((hit) => hit.unitId === "d").match, "text");
});

test("RRF deduplica per unitId e conserva il rank migliore di ciascuna sorgente", () => {
  const result = fuseChatNTCRankings({
    lexicalHits: [lexical("a", 10), lexical("a", 1000), lexical("b", 9)],
    semanticHits: [semantic("a", 3, 0.3), semantic("a", 1, 0.8), semantic("b", 2, 0.7)],
    limit: 5,
  });
  assert.deepEqual(result.ranking.map((hit) => hit.unitId), ["a", "b"]);
  assert.equal(result.ranking[0].lexicalRank, 1);
  assert.equal(result.ranking[0].semanticRank, 1);
  assert.equal(result.ranking[0].lexicalScore, 10);
  assert.equal(result.ranking[0].semanticScore, 0.8);
});

test("tie-break: lexical membership, lexical rank, semantic rank e unitId sono stabili", () => {
  const lexicalPreferred = fuseChatNTCRankings({ lexicalHits: [lexical("z", 1)],
    semanticHits: [semantic("a", 1, 1)], limit: 2 });
  assert.deepEqual(lexicalPreferred.ranking.map((hit) => hit.unitId), ["z", "a"]);
  assert.ok(lexicalPreferred.hits[0].score > lexicalPreferred.hits[1].score,
    "il tie-break deve sopravvivere al sorter legacy basato sullo score");

  const reciprocalTie = fuseChatNTCRankings({ lexicalHits: [lexical("z", 1), lexical("a", 1)],
    semanticHits: [semantic("a", 1, 1), semantic("z", 2, 1)], limit: 2 });
  assert.deepEqual(reciprocalTie.ranking.map((hit) => hit.unitId), ["z", "a"]);

  const unitIdTie = fuseChatNTCRankings({ lexicalHits: [],
    semanticHits: [semantic("z", 1, 1), semantic("a", 1, 1)], limit: 2 });
  assert.deepEqual(unitIdTie.ranking.map((hit) => hit.unitId), ["a", "z"]);
});

test("raw lexical score e cosine similarity non influenzano ordine o fused score", () => {
  const fuse = (lexicalScores, semanticScores) => fuseChatNTCRankings({
    lexicalHits: [lexical("a", lexicalScores[0]), lexical("b", lexicalScores[1])],
    semanticHits: [semantic("b", 1, semanticScores[0]), semantic("a", 2, semanticScores[1])], limit: 2,
  }).ranking.map(({ unitId, fusedScore, lexicalRank, semanticRank }) => ({ unitId, fusedScore, lexicalRank, semanticRank }));
  assert.deepEqual(fuse([Number.MAX_VALUE, -1], [-1, 1]), fuse([-999, Number.MAX_VALUE], [1, -1]));
});

test("liste singole e limite finale preservano il ranking della sorgente", () => {
  const lexicalOnly = fuseChatNTCRankings({ lexicalHits: [lexical("a", 3), lexical("b", 2), lexical("c", 1)],
    semanticHits: [], limit: 2 });
  assert.deepEqual(lexicalOnly.ranking.map((hit) => hit.unitId), ["a", "b"]);
  const semanticOnly = fuseChatNTCRankings({ lexicalHits: [],
    semanticHits: [semantic("c", 3, 1), semantic("a", 1, 0), semantic("b", 2, -1)], limit: 2 });
  assert.deepEqual(semanticOnly.ranking.map((hit) => hit.unitId), ["a", "b"]);
});
