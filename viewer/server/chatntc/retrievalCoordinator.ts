import "server-only";
import {
  retrieveChatNTCEvidence,
  type ChatNTCEvidencePackage, type ChatNTCHit, type ChatNTCRepository, type ChatNTCRetrievalOptions,
} from "../../shared/chatntc/index.js";
import {
  ChatNTCSemanticRetrievalError,
  type ChatNTCSemanticFailureKind,
  type ChatNTCSemanticHit,
  type ChatNTCSemanticRetrievalResult,
} from "./semanticRetriever.js";

export type ChatNTCSemanticRetrievalMode = "off" | "shadow" | "on";

export interface ChatNTCSemanticRetrievalInput {
  query: string;
  limit: number;
  document?: ChatNTCRetrievalOptions["document"];
  signal?: AbortSignal;
}

/**
 * Optional server-side semantic lookup. Its ranking stays separate from the
 * authoritative lexical candidates until a later fusion step.
 */
export interface ChatNTCSemanticRetriever {
  retrieve(input: ChatNTCSemanticRetrievalInput): Promise<ChatNTCSemanticRetrievalResult>;
}

export interface ChatNTCShadowCommonHit {
  unitId: string;
  lexicalRank: number;
  semanticRank: number;
  rankDelta: number;
}

export interface ChatNTCShadowDiagnostics {
  mode: Exclude<ChatNTCSemanticRetrievalMode, "off">;
  lexicalHits: ReadonlyArray<{ unitId: string; lexicalRank: number; score: number; match: ChatNTCHit["match"] }>;
  semanticHits: readonly ChatNTCSemanticHit[];
  overlapCount: number;
  /** Common hits divided by the smaller non-empty result set. */
  overlapRatio: number;
  commonHits: readonly ChatNTCShadowCommonHit[];
  semanticStatus: "ok" | "error";
  failure?: { kind: ChatNTCSemanticFailureKind; code: string };
}

export interface ChatNTCSemanticRetrievalConfiguration {
  mode: ChatNTCSemanticRetrievalMode;
  retriever?: ChatNTCSemanticRetriever;
  /** Controlled server-side sink; diagnostics are never added to user output. */
  onDiagnostics?: (diagnostics: ChatNTCShadowDiagnostics) => void | Promise<void>;
}

function lexicalDiagnostics(hits: readonly ChatNTCHit[]) {
  const seen = new Set<string>();
  return hits.flatMap((hit) => {
    if (seen.has(hit.unitId)) return [];
    seen.add(hit.unitId);
    return [{ unitId: hit.unitId, lexicalRank: seen.size, score: hit.score, match: hit.match }];
  });
}

function successfulDiagnostics(mode: "shadow" | "on", lexicalHits: readonly ChatNTCHit[], semanticHits: readonly ChatNTCSemanticHit[]): ChatNTCShadowDiagnostics {
  const lexical = lexicalDiagnostics(lexicalHits);
  const semanticRanks = new Map(semanticHits.map((hit) => [hit.unitId, hit.semanticRank]));
  const commonHits = lexical.flatMap((hit) => {
    const semanticRank = semanticRanks.get(hit.unitId);
    return semanticRank === undefined ? [] : [{ unitId: hit.unitId, lexicalRank: hit.lexicalRank,
      semanticRank, rankDelta: semanticRank - hit.lexicalRank }];
  });
  const denominator = Math.min(lexical.length, semanticHits.length);
  return { mode, lexicalHits: lexical, semanticHits, overlapCount: commonHits.length,
    overlapRatio: denominator ? commonHits.length / denominator : 0, commonHits, semanticStatus: "ok" };
}

function failedDiagnostics(mode: "shadow" | "on", lexicalHits: readonly ChatNTCHit[], error: unknown): ChatNTCShadowDiagnostics {
  const failure = error instanceof ChatNTCSemanticRetrievalError
    ? { kind: error.kind, code: error.code }
    : error instanceof DOMException && error.name === "AbortError"
      ? { kind: "cancelled" as const, code: "QUERY_CANCELLED" }
      : { kind: "runtime" as const, code: "SEMANTIC_RETRIEVAL_FAILED" };
  return { mode, lexicalHits: lexicalDiagnostics(lexicalHits), semanticHits: [], overlapCount: 0,
    overlapRatio: 0, commonHits: [], semanticStatus: "error", failure };
}

async function report(configuration: ChatNTCSemanticRetrievalConfiguration, diagnostics: ChatNTCShadowDiagnostics) {
  try { await configuration.onDiagnostics?.(diagnostics); } catch { /* A diagnostic sink never affects retrieval. */ }
}

/** Keep the legacy path literal for local/off and for every unconfigured mode. */
export async function retrieveChatNTCEvidenceForMode(
  repository: ChatNTCRepository,
  question: string,
  options: ChatNTCRetrievalOptions,
  configuration: ChatNTCSemanticRetrievalConfiguration = { mode: "off" },
  signal?: AbortSignal,
): Promise<ChatNTCEvidencePackage> {
  const retriever = configuration.retriever;
  if (configuration.mode === "off" || !retriever) return await retrieveChatNTCEvidence(repository, question, options);
  const activeMode = configuration.mode === "shadow" ? "shadow" : "on";

  const candidateRepository: ChatNTCRepository = {
    identity: () => repository.identity(),
    resolveExact: (query, document) => repository.resolveExact(query, document),
    getUnit: (unitId) => repository.getUnit(unitId),
    related: (unitId) => repository.related(unitId),
    async search(query, limit, document) {
      const lexicalHits = await repository.search(query, limit, document);
      const semanticInput: ChatNTCSemanticRetrievalInput = { query, limit,
        ...(document ? { document } : {}), ...(signal ? { signal } : {}) };
      try {
        const semantic = await Promise.resolve().then(() => retriever.retrieve(semanticInput));
        await report(configuration, successfulDiagnostics(activeMode, lexicalHits, semantic.hits));
      } catch (error) {
        await report(configuration, failedDiagnostics(activeMode, lexicalHits, error));
      }
      // STEP 3 is observational: shadow and on both keep the canonical lexical ranking.
      return lexicalHits;
    },
  };
  return await retrieveChatNTCEvidence(candidateRepository, question, options);
}
