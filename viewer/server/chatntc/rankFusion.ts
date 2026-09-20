import "server-only";
import type { ChatNTCHit } from "../../shared/chatntc/index.js";
import type { ChatNTCSemanticHit } from "./semanticRetriever.js";

export const CHATNTC_HYBRID_RETRIEVAL_DEFAULTS = Object.freeze({
  lexicalCandidateCount: 50,
  semanticCandidateCount: 50,
  fusedCandidateCount: 50,
  rrfK: 60,
});

export interface ChatNTCFusedRankingHit {
  unitId: string;
  fusedRank: number;
  fusedScore: number;
  lexicalRank: number | null;
  semanticRank: number | null;
  lexicalScore: number | null;
  semanticScore: number | null;
  sourceMembership: readonly ("lexical" | "semantic")[];
}

export interface ChatNTCRankFusionResult {
  hits: readonly ChatNTCHit[];
  ranking: readonly ChatNTCFusedRankingHit[];
}

interface FusionCandidate {
  unitId: string;
  lexicalHit?: ChatNTCHit;
  lexicalRank?: number;
  semanticHit?: ChatNTCSemanticHit;
  semanticRank?: number;
  fusedScore: number;
}

const compare = (left: string, right: string) => left < right ? -1 : left > right ? 1 : 0;

/** Rank-only RRF. Raw lexical/cosine scores are retained for diagnostics, never compared. */
export function fuseChatNTCRankings(input: {
  lexicalHits: readonly ChatNTCHit[];
  semanticHits: readonly ChatNTCSemanticHit[];
  limit: number;
  k?: number;
}): ChatNTCRankFusionResult {
  const k = input.k ?? CHATNTC_HYBRID_RETRIEVAL_DEFAULTS.rrfK;
  if (!Number.isSafeInteger(input.limit) || input.limit < 0) throw new Error("ChatNTC RRF: limit non valido.");
  if (!Number.isFinite(k) || k <= 0) throw new Error("ChatNTC RRF: k non valido.");
  const candidates = new Map<string, FusionCandidate>();
  const lexicalSeen = new Set<string>();
  let lexicalRank = 0;
  for (const hit of input.lexicalHits) {
    if (lexicalSeen.has(hit.unitId)) continue;
    lexicalSeen.add(hit.unitId);
    lexicalRank += 1;
    candidates.set(hit.unitId, { unitId: hit.unitId, lexicalHit: hit, lexicalRank,
      fusedScore: 1 / (k + lexicalRank) });
  }
  const semantic = [...input.semanticHits].sort((left, right) => left.semanticRank - right.semanticRank
    || compare(left.unitId, right.unitId));
  const semanticSeen = new Set<string>();
  for (const hit of semantic) {
    if (!Number.isSafeInteger(hit.semanticRank) || hit.semanticRank < 1) throw new Error("ChatNTC RRF: semantic rank non valido.");
    if (semanticSeen.has(hit.unitId)) continue;
    semanticSeen.add(hit.unitId);
    const candidate = candidates.get(hit.unitId) ?? { unitId: hit.unitId, fusedScore: 0 };
    candidate.semanticHit = hit;
    candidate.semanticRank = hit.semanticRank;
    candidate.fusedScore += 1 / (k + hit.semanticRank);
    candidates.set(hit.unitId, candidate);
  }
  const ranked = [...candidates.values()].sort((left, right) => right.fusedScore - left.fusedScore
    || Number(Boolean(right.lexicalHit)) - Number(Boolean(left.lexicalHit))
    || (left.lexicalRank ?? Number.POSITIVE_INFINITY) - (right.lexicalRank ?? Number.POSITIVE_INFINITY)
    || (left.semanticRank ?? Number.POSITIVE_INFINITY) - (right.semanticRank ?? Number.POSITIVE_INFINITY)
    || compare(left.unitId, right.unitId)).slice(0, input.limit);
  const transportScores = ranked.map((candidate) => candidate.fusedScore);
  for (let start = 0; start < ranked.length;) {
    let end = start + 1;
    while (end < ranked.length && ranked[end].fusedScore === ranked[start].fusedScore) end += 1;
    if (end - start > 1) {
      const step = Number.EPSILON * Math.max(1, Math.abs(ranked[start].fusedScore));
      for (let position = start; position < end; position++) transportScores[position] += step * (end - position);
    }
    start = end;
  }
  return {
    // Machine-scale tie encoding lets the unchanged legacy sorter preserve the documented RRF tie-break.
    hits: ranked.map((candidate, position) => candidate.lexicalHit
      ? { ...candidate.lexicalHit, score: transportScores[position] }
      : { unitId: candidate.unitId, score: transportScores[position], match: "text" }),
    ranking: ranked.map((candidate, position) => ({
      unitId: candidate.unitId,
      fusedRank: position + 1,
      fusedScore: candidate.fusedScore,
      lexicalRank: candidate.lexicalRank ?? null,
      semanticRank: candidate.semanticRank ?? null,
      lexicalScore: candidate.lexicalHit?.score ?? null,
      semanticScore: candidate.semanticHit?.similarity ?? null,
      sourceMembership: [
        ...(candidate.lexicalHit ? ["lexical" as const] : []),
        ...(candidate.semanticHit ? ["semantic" as const] : []),
      ],
    })),
  };
}
