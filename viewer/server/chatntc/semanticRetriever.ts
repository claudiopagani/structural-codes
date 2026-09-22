import "server-only";
import { resolve } from "node:path";
import type { DocumentId } from "../../shared/corpusData.js";
import {
  readSemanticIndex,
  type ChatNTCEmbeddingDescription,
  type ChatNTCEmbeddingProvider,
  type ChatNTCSemanticIndexExpectation,
  type LoadedChatNTCSemanticIndex,
} from "./semanticIndex.js";

export type ChatNTCSemanticFailureKind = "configuration" | "integrity" | "runtime" | "cancelled";

export class ChatNTCSemanticRetrievalError extends Error {
  constructor(readonly kind: ChatNTCSemanticFailureKind, readonly code: string, options?: ErrorOptions) {
    super(`ChatNTC semantic retrieval: ${code}`, options);
    this.name = "ChatNTCSemanticRetrievalError";
  }
}

export interface ChatNTCSemanticUnitSummary {
  unitId: string;
  document: DocumentId;
  numbering: string;
}

export interface ChatNTCSemanticHit {
  unitId: string;
  document: DocumentId;
  numbering: string;
  semanticRank: number;
  similarity: number;
  winningChunkId: string;
  winningChunkIndex: number;
}

export interface ChatNTCSemanticRetrievalResult {
  hits: readonly ChatNTCSemanticHit[];
}

export interface ChatNTCSemanticIndexLoader {
  readonly key: string;
  load(): Promise<LoadedChatNTCSemanticIndex>;
  invalidate(): void;
}

function aborted(signal?: AbortSignal): never | void {
  if (signal?.aborted) throw new ChatNTCSemanticRetrievalError("cancelled", "QUERY_CANCELLED", { cause: signal.reason });
}

function stableObject(value: Readonly<Record<string, string | number | boolean | null>>) {
  return JSON.stringify(Object.entries(value).sort(([left], [right]) => left.localeCompare(right, "en")));
}

function compatible(description: ChatNTCEmbeddingDescription, index: LoadedChatNTCSemanticIndex) {
  const metadata = index.metadata;
  if (description.embeddingProvider.trim() !== metadata.embeddingProvider
    || description.embeddingModel.trim() !== metadata.embeddingModel) {
    throw new ChatNTCSemanticRetrievalError("configuration", "MODEL_IDENTITY_MISMATCH");
  }
  if (metadata.modelVersion !== (description.modelVersion?.trim() || null)) {
    throw new ChatNTCSemanticRetrievalError("configuration", "MODEL_VERSION_MISMATCH");
  }
  if (metadata.modelDigest !== (description.modelDigest?.trim() || null)) {
    throw new ChatNTCSemanticRetrievalError("configuration", "MODEL_DIGEST_MISMATCH");
  }
  if (description.dimensions !== undefined && description.dimensions !== metadata.dimensions) {
    throw new ChatNTCSemanticRetrievalError("configuration", "MODEL_DIMENSIONS_MISMATCH");
  }
  if (stableObject(description.parameters) !== stableObject(metadata.parameters)) {
    throw new ChatNTCSemanticRetrievalError("configuration", "MODEL_PARAMETERS_MISMATCH");
  }
  if (metadata.normalization !== "l2") {
    throw new ChatNTCSemanticRetrievalError("configuration", "NORMALIZATION_MISMATCH");
  }
}

function normalizeQuery(vector: readonly number[], dimensions: number) {
  if (vector.length !== dimensions) throw new ChatNTCSemanticRetrievalError("configuration", "QUERY_DIMENSIONS_MISMATCH");
  let normSquared = 0;
  for (const value of vector) {
    if (!Number.isFinite(value)) throw new ChatNTCSemanticRetrievalError("runtime", "QUERY_VECTOR_INVALID");
    normSquared += value * value;
  }
  const norm = Math.sqrt(normSquared);
  if (!Number.isFinite(norm) || norm === 0) throw new ChatNTCSemanticRetrievalError("runtime", "QUERY_VECTOR_INVALID");
  return Float32Array.from(vector, (value) => value / norm);
}

function classify(error: unknown, fallbackKind: ChatNTCSemanticFailureKind, fallbackCode: string) {
  if (error instanceof ChatNTCSemanticRetrievalError) return error;
  if (error instanceof DOMException && error.name === "AbortError") {
    return new ChatNTCSemanticRetrievalError("cancelled", "QUERY_CANCELLED", { cause: error });
  }
  return new ChatNTCSemanticRetrievalError(fallbackKind, fallbackCode, { cause: error });
}

/**
 * The reader from STEP 2 remains authoritative. This closure caches one fully
 * validated snapshot; a changed path/config creates a new key, while callers
 * can explicitly invalidate the current snapshot.
 */
export function createChatNTCSemanticIndexLoader(input: {
  directory: string;
  expected: ChatNTCSemanticIndexExpectation;
}): ChatNTCSemanticIndexLoader {
  const directory = resolve(input.directory);
  const expected = { ...input.expected, unitIds: [...input.expected.unitIds] };
  const key = JSON.stringify([directory, expected.corpusFingerprint, expected.inputFingerprint ?? null, expected.unitIds]);
  let cached: Promise<LoadedChatNTCSemanticIndex> | undefined;
  return {
    key,
    load() {
      cached ??= readSemanticIndex(directory, expected).catch((error) => {
        cached = undefined;
        const unavailable = error instanceof Error && /index\.json non leggibile/u.test(error.message);
        throw classify(error, unavailable ? "configuration" : "integrity",
          unavailable ? "SEMANTIC_INDEX_UNAVAILABLE" : "SEMANTIC_INDEX_INVALID");
      });
      return cached;
    },
    invalidate() { cached = undefined; },
  };
}

export function createChatNTCSemanticRetriever(input: {
  provider: ChatNTCEmbeddingProvider;
  indexLoader: ChatNTCSemanticIndexLoader;
  units: readonly ChatNTCSemanticUnitSummary[];
}) {
  const summaries = new Map(input.units.map((unit) => [unit.unitId, { ...unit }]));
  if (summaries.size !== input.units.length) throw new ChatNTCSemanticRetrievalError("configuration", "UNIT_CATALOG_DUPLICATE");
  return {
    async retrieve(request: { query: string; limit: number; document?: DocumentId; signal?: AbortSignal }): Promise<ChatNTCSemanticRetrievalResult> {
      if (!request.query.trim() || !Number.isSafeInteger(request.limit) || request.limit < 1) {
        throw new ChatNTCSemanticRetrievalError("configuration", "SEMANTIC_QUERY_INVALID");
      }
      aborted(request.signal);
      const index = await input.indexLoader.load();
      aborted(request.signal);
      if (index.metadata.unitIds.some((unitId) => !summaries.has(unitId)) || summaries.size !== index.metadata.unitCount) {
        throw new ChatNTCSemanticRetrievalError("configuration", "UNIT_CATALOG_MISMATCH");
      }
      let description: ChatNTCEmbeddingDescription;
      try { description = await input.provider.describe({ signal: request.signal }); }
      catch (error) {
        aborted(request.signal);
        throw classify(error, "runtime", "EMBEDDING_PROVIDER_UNAVAILABLE");
      }
      aborted(request.signal);
      compatible(description, index);
      let embedded: readonly (readonly number[])[];
      try { embedded = await input.provider.embed([request.query], { signal: request.signal, inputType: "query" }); }
      catch (error) {
        aborted(request.signal);
        throw classify(error, "runtime", "QUERY_EMBEDDING_FAILED");
      }
      aborted(request.signal);
      if (embedded.length !== 1) throw new ChatNTCSemanticRetrievalError("runtime", "QUERY_EMBEDDING_INVALID");
      const query = normalizeQuery(embedded[0], index.metadata.dimensions);
      const candidates = new Map<string, { row: number; unit: ChatNTCSemanticUnitSummary; similarity: number; chunkId: string; chunkIndex: number }>();
      for (let row = 0; row < index.metadata.chunkCount; row++) {
        if ((row & 127) === 0) aborted(request.signal);
        const chunk = index.metadata.chunks[row];
        const unit = summaries.get(chunk.unitId);
        if (!unit) throw new ChatNTCSemanticRetrievalError("configuration", "UNIT_CATALOG_MISMATCH");
        if (request.document && unit.document !== request.document) continue;
        let similarity = 0;
        const offset = row * index.metadata.dimensions;
        // Corpus and query vectors are L2-normalized, so dot product equals cosine similarity.
        for (let column = 0; column < index.metadata.dimensions; column++) {
          similarity += query[column] * index.vectors[offset + column];
        }
        similarity = Math.max(-1, Math.min(1, similarity));
        const previous = candidates.get(unit.unitId);
        if (!previous || similarity > previous.similarity || similarity === previous.similarity && row < previous.row) {
          candidates.set(unit.unitId, { row, unit, similarity, chunkId: chunk.chunkId, chunkIndex: chunk.chunkIndex });
        }
      }
      const ranked = [...candidates.values()];
      ranked.sort((left, right) => right.similarity - left.similarity || left.row - right.row
        || left.unit.unitId.localeCompare(right.unit.unitId, "en"));
      return { hits: ranked.slice(0, request.limit).map(({ unit, similarity, chunkId, chunkIndex }, position) => ({
        ...unit, semanticRank: position + 1, similarity, winningChunkId: chunkId, winningChunkIndex: chunkIndex,
      })) };
    },
  };
}
