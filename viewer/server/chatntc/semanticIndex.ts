import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { CorpusUnit } from "../../shared/corpusData.js";

export const CHATNTC_SEMANTIC_INDEX_FORMAT_VERSION = 2 as const;
export const CHATNTC_SEMANTIC_UNIT_TEXT_FORMAT = "chatntc-unit-chunk-text-v1" as const;
export const CHATNTC_SEMANTIC_VECTOR_FILE = "vectors.f32" as const;
export const CHATNTC_SEMANTIC_METADATA_FILE = "index.json" as const;
export const CHATNTC_SEMANTIC_CHUNKING_ALGORITHM = "block-aware-v1" as const;
export const CHATNTC_SEMANTIC_TOKENIZER_MODEL = "BAAI/bge-m3" as const;
export const CHATNTC_SEMANTIC_TOKENIZER_REVISION = "5617a9f61b028005a4858fdac845db406aefb181" as const;

export const CHATNTC_SEMANTIC_CHUNKING_DEFAULTS = Object.freeze({
  maxChunkTokens: 1000,
  overlapTokens: 150,
});

type EmbeddingParameter = string | number | boolean | null;

export interface ChatNTCEmbeddingDescription {
  embeddingProvider: string;
  embeddingModel: string;
  modelVersion: string | null;
  modelDigest: string | null;
  dimensions?: number;
  parameters: Readonly<Record<string, EmbeddingParameter>>;
}

export interface ChatNTCEmbeddingRequestOptions {
  signal?: AbortSignal;
  inputType?: "query" | "document";
}

export interface ChatNTCSemanticTokenizer {
  encode(text: string, options?: { add_special_tokens?: boolean }): { ids: number[] };
  decode(ids: number[], options?: { skip_special_tokens?: boolean }): string;
}

export interface ChatNTCSemanticChunkingPolicy {
  maxChunkTokens: number;
  overlapTokens: number;
}

export interface ChatNTCSemanticChunk {
  chunkId: string;
  unitId: string;
  document: CorpusUnit["document"];
  numbering: string;
  title: string;
  chunkIndex: number;
  chunkCount: number;
  tokenCount: number;
  text: string;
}

export interface ChatNTCSemanticChunkMetadata {
  row: number;
  chunkId: string;
  unitId: string;
  chunkIndex: number;
  chunkCount: number;
  tokenCount: number;
}

/** Provider-neutral boundary shared by offline indexing and server-side query embedding. */
export interface ChatNTCEmbeddingProvider {
  describe(options?: ChatNTCEmbeddingRequestOptions): Promise<ChatNTCEmbeddingDescription>;
  embed(texts: readonly string[], options?: ChatNTCEmbeddingRequestOptions): Promise<readonly (readonly number[])[]>;
}

export interface ChatNTCSemanticIndexMetadata {
  formatVersion: typeof CHATNTC_SEMANTIC_INDEX_FORMAT_VERSION;
  embeddingProvider: string;
  embeddingModel: string;
  modelVersion: string | null;
  modelDigest: string | null;
  dimensions: number;
  normalization: "l2";
  corpusFingerprint: string;
  unitCount: number;
  chunkCount: number;
  unitTextFormat: typeof CHATNTC_SEMANTIC_UNIT_TEXT_FORMAT;
  chunking: {
    algorithm: typeof CHATNTC_SEMANTIC_CHUNKING_ALGORITHM;
    maxChunkTokens: number;
    overlapTokens: number;
  };
  tokenizerModel: typeof CHATNTC_SEMANTIC_TOKENIZER_MODEL;
  tokenizerRevision: typeof CHATNTC_SEMANTIC_TOKENIZER_REVISION;
  inputFingerprint: string;
  parameters: Record<string, EmbeddingParameter>;
  vectors: {
    file: typeof CHATNTC_SEMANTIC_VECTOR_FILE;
    encoding: "float32-le";
    byteLength: number;
    sha256: string;
  };
  unitIds: string[];
  chunks: ChatNTCSemanticChunkMetadata[];
}

export interface ChatNTCSemanticIndexExpectation {
  corpusFingerprint: string;
  unitIds: readonly string[];
  inputFingerprint?: string;
}

export interface LoadedChatNTCSemanticIndex {
  metadata: ChatNTCSemanticIndexMetadata;
  vectors: Float32Array;
  vectorForChunk(chunkId: string): Float32Array | null;
}

const sha256 = (value: string | Uint8Array) => createHash("sha256").update(value).digest("hex");
const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);
const fingerprint = (value: unknown) => typeof value === "string" && /^[a-f0-9]{64}$/u.test(value);
const fail = (message: string): never => { throw new Error(`ChatNTC semantic index: ${message}`); };

function exactKeys(value: Record<string, unknown>, required: readonly string[], optional: readonly string[] = []) {
  const allowed = new Set([...required, ...optional]);
  if (required.some((key) => !(key in value)) || Object.keys(value).some((key) => !allowed.has(key))) fail("metadata non conformi.");
}

function normalizedParameters(value: unknown): Record<string, EmbeddingParameter> {
  if (!object(value)) return fail("parametri embedding mancanti.");
  const entries = Object.entries(value).sort(([left], [right]) => left.localeCompare(right, "en"));
  if (entries.some(([key, item]) => !key || !["string", "number", "boolean"].includes(typeof item) && item !== null
    || typeof item === "number" && !Number.isFinite(item))) return fail("parametri embedding non validi.");
  return Object.fromEntries(entries) as Record<string, EmbeddingParameter>;
}

export function semanticTextForUnit(unit: CorpusUnit): string {
  const body = semanticBodyForUnit(unit);
  return [
    `document: ${unit.document}`,
    `numbering: ${unit.numbering.official}`,
    `title: ${unit.title.trim()}`,
    "text:",
    body,
  ].join("\n");
}

function semanticBodyForUnit(unit: CorpusUnit): string {
  return unit.blocks.flatMap((block) => block.blockId !== unit.titleBlockId && block.text?.normalized.trim()
    ? [block.text.normalized.trim()] : []).join("\n\n");
}

export function semanticTextForChunk(chunk: Pick<ChatNTCSemanticChunk, "document" | "numbering" | "title" | "chunkIndex" | "chunkCount" | "text">): string {
  const header = [
    `document: ${chunk.document}`,
    `numbering: ${chunk.numbering}`,
    `title: ${chunk.title.trim()}`,
    ...(chunk.chunkCount > 1 ? [`chunk: ${chunk.chunkIndex + 1}/${chunk.chunkCount}`] : []),
  ];
  return [...header, "text:", chunk.text].join("\n");
}

function validateChunkingPolicy(policy: ChatNTCSemanticChunkingPolicy): ChatNTCSemanticChunkingPolicy {
  if (!Number.isSafeInteger(policy.maxChunkTokens) || policy.maxChunkTokens < 1
    || !Number.isSafeInteger(policy.overlapTokens) || policy.overlapTokens < 0
    || policy.overlapTokens >= policy.maxChunkTokens) {
    throw new Error("Policy chunking semantic non valida.");
  }
  return { maxChunkTokens: policy.maxChunkTokens, overlapTokens: policy.overlapTokens };
}

function tokenCountForText(tokenizer: ChatNTCSemanticTokenizer, text: string, addSpecialTokens = true): number {
  return tokenizer.encode(text, { add_special_tokens: addSpecialTokens }).ids.length;
}

interface SemanticPiece {
  blockIndex: number;
  ids: number[];
  split: boolean;
}

function pieceText(tokenizer: ChatNTCSemanticTokenizer, pieces: readonly SemanticPiece[]): string {
  return pieces.map((piece, index) => {
    const previous = pieces[index - 1];
    const separator = previous && previous.blockIndex === piece.blockIndex ? "" : index ? "\n\n" : "";
    return `${separator}${tokenizer.decode(piece.ids, { skip_special_tokens: false })}`;
  }).join("");
}

function chunkText(unit: CorpusUnit, tokenizer: ChatNTCSemanticTokenizer, pieces: readonly SemanticPiece[], index: number, count: number): string {
  return semanticTextForChunk({ document: unit.document, numbering: unit.numbering.official, title: unit.title,
    chunkIndex: index, chunkCount: count, text: pieceText(tokenizer, pieces) });
}

function fitsChunk(unit: CorpusUnit, tokenizer: ChatNTCSemanticTokenizer, pieces: readonly SemanticPiece[], policy: ChatNTCSemanticChunkingPolicy): boolean {
  return tokenCountForText(tokenizer, chunkText(unit, tokenizer, pieces, 0, 999_999)) <= policy.maxChunkTokens;
}

function longestFittingPrefix(unit: CorpusUnit, tokenizer: ChatNTCSemanticTokenizer, ids: readonly number[], policy: ChatNTCSemanticChunkingPolicy): number {
  let low = 1;
  let high = ids.length;
  let best = 0;
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    if (fitsChunk(unit, tokenizer, [{ blockIndex: 0, ids: [...ids.slice(0, middle)], split: true }], policy)) {
      best = middle; low = middle + 1;
    } else high = middle - 1;
  }
  return best;
}

function overlapPieces(tokenizer: ChatNTCSemanticTokenizer, consumed: readonly SemanticPiece[], policy: ChatNTCSemanticChunkingPolicy): SemanticPiece[] {
  if (!consumed.length || policy.overlapTokens === 0) return [];
  const bodyTokenCount = (pieces: readonly SemanticPiece[]) => tokenCountForText(tokenizer, pieceText(tokenizer, pieces), false);
  let selected: SemanticPiece[] = [];
  for (let index = consumed.length - 1; index >= 0; index--) {
    const candidate = [consumed[index], ...selected];
    if (bodyTokenCount(candidate) <= policy.overlapTokens) selected = candidate;
    else break;
  }
  if (selected.length) return selected.map((piece) => ({ ...piece, ids: [...piece.ids] }));
  const last = consumed[consumed.length - 1];
  if (!last.split) return [];
  let low = 1;
  let high = last.ids.length;
  let best = 0;
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    const suffix = last.ids.slice(last.ids.length - middle);
    if (bodyTokenCount([{ ...last, ids: [...suffix] }]) <= policy.overlapTokens) {
      best = middle; low = middle + 1;
    } else high = middle - 1;
  }
  return best ? [{ ...last, ids: [...last.ids.slice(last.ids.length - best)] }] : [];
}

export function chunkSemanticUnit(unit: CorpusUnit, tokenizer: ChatNTCSemanticTokenizer,
  requestedPolicy: ChatNTCSemanticChunkingPolicy = CHATNTC_SEMANTIC_CHUNKING_DEFAULTS): ChatNTCSemanticChunk[] {
  const policy = validateChunkingPolicy(requestedPolicy);
  if (tokenCountForText(tokenizer, semanticTextForUnit(unit)) <= policy.maxChunkTokens) {
    const chunk = { chunkId: `${unit.id}#chunk-1`, unitId: unit.id, document: unit.document, numbering: unit.numbering.official,
      title: unit.title, chunkIndex: 0, chunkCount: 1, text: semanticBodyForUnit(unit), tokenCount: 0 };
    return [{ ...chunk, tokenCount: tokenCountForText(tokenizer, semanticTextForChunk(chunk)) }];
  }

  const blocks = unit.blocks.flatMap((block, blockIndex) => block.blockId !== unit.titleBlockId && block.text?.normalized.trim()
    ? [{ blockIndex, ids: tokenizer.encode(block.text.normalized.trim(), { add_special_tokens: false }).ids }] : []);
  const pieces: SemanticPiece[] = [];
  for (const block of blocks) {
    if (fitsChunk(unit, tokenizer, [{ blockIndex: block.blockIndex, ids: [...block.ids], split: false }], policy)) {
      pieces.push({ blockIndex: block.blockIndex, ids: [...block.ids], split: false });
      continue;
    }
    let offset = 0;
    while (offset < block.ids.length) {
      const length = longestFittingPrefix(unit, tokenizer, block.ids.slice(offset), policy);
      if (!length) throw new Error(`Blocco non divisibile entro maxChunkTokens per unità ${unit.id}.`);
      pieces.push({ blockIndex: block.blockIndex, ids: [...block.ids.slice(offset, offset + length)], split: true });
      offset += length;
    }
  }

  const grouped: SemanticPiece[][] = [];
  let cursor = 0;
  let carry: SemanticPiece[] = [];
  while (cursor < pieces.length) {
    let selected = [...carry];
    const carryLength = selected.length;
    const start = cursor;
    while (cursor < pieces.length && fitsChunk(unit, tokenizer, [...selected, pieces[cursor]], policy)) {
      selected.push(pieces[cursor]); cursor += 1;
    }
    if (cursor === start) {
      selected = []; carry = [];
      while (cursor < pieces.length && fitsChunk(unit, tokenizer, [...selected, pieces[cursor]], policy)) {
        selected.push(pieces[cursor]); cursor += 1;
      }
    }
    if (cursor === start) throw new Error(`Chunk semantic vuoto per unità ${unit.id}.`);
    grouped.push(selected);
    carry = overlapPieces(tokenizer, selected.slice(carryLength), policy);
  }

  const chunkCount = grouped.length;
  return grouped.map((selected, chunkIndex) => {
    const base = { chunkId: `${unit.id}#chunk-${chunkIndex + 1}`, unitId: unit.id, document: unit.document,
      numbering: unit.numbering.official, title: unit.title, chunkIndex, chunkCount, text: pieceText(tokenizer, selected), tokenCount: 0 };
    return { ...base, tokenCount: tokenCountForText(tokenizer, semanticTextForChunk(base)) };
  });
}

export function chunkSemanticUnits(units: readonly CorpusUnit[], tokenizer: ChatNTCSemanticTokenizer,
  policy: ChatNTCSemanticChunkingPolicy = CHATNTC_SEMANTIC_CHUNKING_DEFAULTS): ChatNTCSemanticChunk[] {
  return units.flatMap((unit) => chunkSemanticUnit(unit, tokenizer, policy));
}

export function semanticInputFingerprint(chunks: readonly ChatNTCSemanticChunk[], input: {
  policy: ChatNTCSemanticChunkingPolicy;
  tokenizerModel: string;
  tokenizerRevision: string;
}): string {
  const policy = validateChunkingPolicy(input.policy);
  return sha256(JSON.stringify({ format: CHATNTC_SEMANTIC_UNIT_TEXT_FORMAT, algorithm: CHATNTC_SEMANTIC_CHUNKING_ALGORITHM,
    policy, tokenizerModel: input.tokenizerModel, tokenizerRevision: input.tokenizerRevision,
    chunks: chunks.map((chunk) => [chunk.chunkId, chunk.unitId, chunk.document, chunk.numbering, chunk.title,
      chunk.chunkIndex, chunk.chunkCount, chunk.tokenCount, semanticTextForChunk(chunk)]) }));
}

function normalizeVector(vector: readonly number[], dimensions: number): Float32Array {
  if (vector.length !== dimensions) return fail("dimensione vettore incoerente.");
  if (vector.some((value) => !Number.isFinite(value))) return fail("vettore con valori non finiti.");
  const norm = Math.sqrt(vector.reduce((total, value) => total + value * value, 0));
  if (!Number.isFinite(norm) || norm === 0) return fail("vettore nullo o non normalizzabile.");
  return Float32Array.from(vector, (value) => value / norm);
}

function encodeVectors(vectors: readonly Float32Array[], dimensions: number): Uint8Array {
  const bytes = new Uint8Array(vectors.length * dimensions * Float32Array.BYTES_PER_ELEMENT);
  const view = new DataView(bytes.buffer);
  let offset = 0;
  for (const vector of vectors) for (const value of vector) {
    view.setFloat32(offset, value, true);
    offset += Float32Array.BYTES_PER_ELEMENT;
  }
  return bytes;
}

function decodeVectors(bytes: Uint8Array): Float32Array {
  const values = new Float32Array(bytes.byteLength / Float32Array.BYTES_PER_ELEMENT);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (let index = 0; index < values.length; index++) values[index] = view.getFloat32(index * Float32Array.BYTES_PER_ELEMENT, true);
  return values;
}

function parseMetadata(value: unknown): ChatNTCSemanticIndexMetadata {
  if (!object(value)) return fail("index.json non è un oggetto.");
  exactKeys(value, ["formatVersion", "embeddingProvider", "embeddingModel", "modelVersion", "modelDigest", "dimensions",
    "normalization", "corpusFingerprint", "unitCount", "chunkCount", "unitTextFormat", "chunking", "tokenizerModel",
    "tokenizerRevision", "inputFingerprint", "parameters", "vectors", "unitIds", "chunks"]);
  if (value.formatVersion !== CHATNTC_SEMANTIC_INDEX_FORMAT_VERSION) return fail("formatVersion non supportata.");
  if (typeof value.embeddingProvider !== "string" || !value.embeddingProvider.trim()
    || typeof value.embeddingModel !== "string" || !value.embeddingModel.trim()) return fail("modello embedding non dichiarato.");
  for (const key of ["modelVersion", "modelDigest"] as const) {
    if (value[key] !== null && (typeof value[key] !== "string" || !value[key].trim())) return fail(`${key} non valido.`);
  }
  if (!Number.isSafeInteger(value.dimensions) || Number(value.dimensions) < 1) return fail("dimensions non valide.");
  if (value.normalization !== "l2") return fail("normalizzazione non supportata.");
  if (!fingerprint(value.corpusFingerprint) || !fingerprint(value.inputFingerprint)) return fail("fingerprint non valido.");
  if (!Number.isSafeInteger(value.unitCount) || Number(value.unitCount) < 1) return fail("unitCount non valido.");
  if (!Number.isSafeInteger(value.chunkCount) || Number(value.chunkCount) < 1) return fail("chunkCount non valido.");
  if (value.unitTextFormat !== CHATNTC_SEMANTIC_UNIT_TEXT_FORMAT) return fail("formato testo unità non supportato.");
  if (typeof value.tokenizerModel !== "string" || value.tokenizerModel !== CHATNTC_SEMANTIC_TOKENIZER_MODEL
    || typeof value.tokenizerRevision !== "string" || value.tokenizerRevision !== CHATNTC_SEMANTIC_TOKENIZER_REVISION) {
    return fail("tokenizer semantic non supportato.");
  }
  if (!object(value.chunking)) return fail("policy chunking mancante.");
  exactKeys(value.chunking, ["algorithm", "maxChunkTokens", "overlapTokens"]);
  if (value.chunking.algorithm !== CHATNTC_SEMANTIC_CHUNKING_ALGORITHM
    || !Number.isSafeInteger(value.chunking.maxChunkTokens) || Number(value.chunking.maxChunkTokens) < 1
    || !Number.isSafeInteger(value.chunking.overlapTokens) || Number(value.chunking.overlapTokens) < 0
    || Number(value.chunking.overlapTokens) >= Number(value.chunking.maxChunkTokens)) return fail("policy chunking non valida.");
  const parameters = normalizedParameters(value.parameters);
  if (!object(value.vectors)) return fail("descriptor vettori mancante.");
  exactKeys(value.vectors, ["file", "encoding", "byteLength", "sha256"]);
  if (value.vectors.file !== CHATNTC_SEMANTIC_VECTOR_FILE || value.vectors.encoding !== "float32-le"
    || !Number.isSafeInteger(value.vectors.byteLength) || Number(value.vectors.byteLength) < 1
    || !fingerprint(value.vectors.sha256)) return fail("descriptor vettori non valido.");
  if (!Array.isArray(value.unitIds) || value.unitIds.some((unitId) => typeof unitId !== "string" || !unitId)) return fail("unitIds non validi.");
  if (!Array.isArray(value.chunks) || value.chunks.length !== Number(value.chunkCount)) return fail("chunks non validi.");
  const chunks = value.chunks.map((chunk) => {
    if (!object(chunk)) return fail("descriptor chunk non valido.");
    exactKeys(chunk, ["row", "chunkId", "unitId", "chunkIndex", "chunkCount", "tokenCount"]);
    if (!Number.isSafeInteger(chunk.row) || Number(chunk.row) < 0 || typeof chunk.chunkId !== "string" || !chunk.chunkId
      || typeof chunk.unitId !== "string" || !chunk.unitId || !Number.isSafeInteger(chunk.chunkIndex) || Number(chunk.chunkIndex) < 0
      || !Number.isSafeInteger(chunk.chunkCount) || Number(chunk.chunkCount) < 1 || !Number.isSafeInteger(chunk.tokenCount) || Number(chunk.tokenCount) < 1) {
      return fail("descriptor chunk non valido.");
    }
    return { row: Number(chunk.row), chunkId: chunk.chunkId, unitId: chunk.unitId, chunkIndex: Number(chunk.chunkIndex),
      chunkCount: Number(chunk.chunkCount), tokenCount: Number(chunk.tokenCount) };
  });
  return { ...value, dimensions: Number(value.dimensions), unitCount: Number(value.unitCount), chunkCount: Number(value.chunkCount), parameters,
    chunking: { algorithm: value.chunking.algorithm, maxChunkTokens: Number(value.chunking.maxChunkTokens), overlapTokens: Number(value.chunking.overlapTokens) },
    vectors: { ...value.vectors, byteLength: Number(value.vectors.byteLength) }, unitIds: [...value.unitIds], chunks } as ChatNTCSemanticIndexMetadata;
}

export function validateSemanticIndex(metadataValue: unknown, vectorBytes: Uint8Array,
  expected: ChatNTCSemanticIndexExpectation): ChatNTCSemanticIndexMetadata {
  const metadata = parseMetadata(metadataValue);
  if (metadata.corpusFingerprint !== expected.corpusFingerprint) fail("corpus fingerprint non corrispondente.");
  if (expected.inputFingerprint && metadata.inputFingerprint !== expected.inputFingerprint) fail("input fingerprint non corrispondente.");
  if (metadata.unitIds.length !== metadata.unitCount) fail("unitCount incoerente.");
  const indexed = new Set(metadata.unitIds);
  if (indexed.size !== metadata.unitIds.length) fail("unitId duplicato.");
  const known = new Set(expected.unitIds);
  if (known.size !== expected.unitIds.length) fail("elenco unità attese duplicato.");
  if (metadata.unitIds.some((unitId) => !known.has(unitId))) fail("unitId inesistente nel corpus.");
  if (expected.unitIds.some((unitId) => !indexed.has(unitId)) || indexed.size !== known.size) fail("indice incompleto.");
  const chunkRows = new Set<number>();
  const chunkIds = new Set<string>();
  const chunkIndexes = new Map<string, Set<number>>();
  for (const [position, chunk] of metadata.chunks.entries()) {
    if (chunk.row !== position || chunkRows.has(chunk.row) || chunkIds.has(chunk.chunkId) || !known.has(chunk.unitId)
      || chunk.chunkIndex >= chunk.chunkCount) fail("descriptor chunk incoerente.");
    chunkRows.add(chunk.row); chunkIds.add(chunk.chunkId);
    const indexes = chunkIndexes.get(chunk.unitId) ?? new Set<number>();
    if (indexes.has(chunk.chunkIndex)) fail("indice chunk duplicato.");
    indexes.add(chunk.chunkIndex); chunkIndexes.set(chunk.unitId, indexes);
  }
  if (chunkRows.size !== metadata.chunkCount || chunkIds.size !== metadata.chunkCount || chunkIndexes.size !== metadata.unitCount
    || [...chunkIndexes.entries()].some(([unitId, indexes]) => {
      const expectedCount = metadata.chunks.find((chunk) => chunk.unitId === unitId)?.chunkCount;
      return expectedCount === undefined || indexes.size !== expectedCount || [...Array(expectedCount).keys()].some((index) => !indexes.has(index));
    })) fail("inventario chunk incompleto.");
  const expectedBytes = metadata.chunkCount * metadata.dimensions * Float32Array.BYTES_PER_ELEMENT;
  if (metadata.vectors.byteLength !== expectedBytes || vectorBytes.byteLength !== expectedBytes) fail("dimensione binaria incoerente.");
  if (sha256(vectorBytes) !== metadata.vectors.sha256) fail("hash dei vettori non corrispondente.");
  const vectors = decodeVectors(vectorBytes);
  for (let row = 0; row < metadata.chunkCount; row++) {
    let normSquared = 0;
    for (let column = 0; column < metadata.dimensions; column++) {
      const value = vectors[row * metadata.dimensions + column];
      if (!Number.isFinite(value)) fail("vettore con valori non finiti.");
      normSquared += value * value;
    }
    if (Math.abs(Math.sqrt(normSquared) - 1) > 1e-5) fail("vettore non normalizzato L2.");
  }
  return metadata;
}

export async function generateSemanticIndex(input: {
  chunks: readonly ChatNTCSemanticChunk[];
  unitIds: readonly string[];
  corpusFingerprint: string;
  provider: ChatNTCEmbeddingProvider;
  outputDirectory: string;
  chunking: ChatNTCSemanticChunkingPolicy;
  tokenizerModel?: typeof CHATNTC_SEMANTIC_TOKENIZER_MODEL;
  tokenizerRevision?: typeof CHATNTC_SEMANTIC_TOKENIZER_REVISION;
  batchSize?: number;
}): Promise<ChatNTCSemanticIndexMetadata> {
  const { chunks, unitIds, corpusFingerprint, provider, outputDirectory } = input;
  const batchSize = input.batchSize ?? 8;
  if (!chunks.length || new Set(chunks.map((chunk) => chunk.chunkId)).size !== chunks.length) fail("chunk sorgente assenti o duplicati.");
  if (!unitIds.length || new Set(unitIds).size !== unitIds.length || chunks.some((chunk) => !unitIds.includes(chunk.unitId))) fail("inventario unità sorgente non valido.");
  if (!fingerprint(corpusFingerprint)) fail("corpus fingerprint non valido.");
  if (!Number.isSafeInteger(batchSize) || batchSize < 1 || batchSize > 128) fail("batch size non valido.");
  const chunking = validateChunkingPolicy(input.chunking);
  const tokenizerModel = input.tokenizerModel ?? CHATNTC_SEMANTIC_TOKENIZER_MODEL;
  const tokenizerRevision = input.tokenizerRevision ?? CHATNTC_SEMANTIC_TOKENIZER_REVISION;
  if (tokenizerModel !== CHATNTC_SEMANTIC_TOKENIZER_MODEL || tokenizerRevision !== CHATNTC_SEMANTIC_TOKENIZER_REVISION) fail("tokenizer semantic non supportato.");
  const description = await provider.describe();
  if (!description.embeddingProvider?.trim() || !description.embeddingModel?.trim()) fail("provider o modello embedding non dichiarato.");
  const parameters = normalizedParameters(description.parameters);
  const texts = chunks.map((chunk) => semanticTextForChunk(chunk));
  const vectors: Float32Array[] = [];
  let dimensions = description.dimensions;
  if (dimensions !== undefined && (!Number.isSafeInteger(dimensions) || dimensions < 1)) fail("dimensions dichiarate non valide.");
  for (let offset = 0; offset < texts.length; offset += batchSize) {
    const batch = texts.slice(offset, offset + batchSize);
    let embedded: readonly (readonly number[])[];
    try {
      embedded = await provider.embed(batch, { inputType: "document" });
    } catch (error) {
      const context = chunks.slice(offset, offset + batch.length).map((chunk, index) =>
        `${chunk.unitId} [document=${chunk.document}, numbering=${chunk.numbering}, characters=${Array.from(batch[index]).length}]`).join("; ");
      const reason = error instanceof Error ? error.message : String(error);
      throw new Error(`Embedding batch fallito (offset=${offset}, size=${batch.length}, units=${context}): ${reason}`, { cause: error });
    }
    if (embedded.length !== batch.length) fail("numero di embedding incoerente.");
    for (const vector of embedded) {
      dimensions ??= vector.length;
      vectors.push(normalizeVector(vector, dimensions));
    }
  }
  if (!dimensions) return fail("nessun embedding generato.");
  const bytes = encodeVectors(vectors, dimensions);
  const metadata: ChatNTCSemanticIndexMetadata = {
    formatVersion: CHATNTC_SEMANTIC_INDEX_FORMAT_VERSION,
    embeddingProvider: description.embeddingProvider.trim(), embeddingModel: description.embeddingModel.trim(),
    modelVersion: description.modelVersion?.trim() || null, modelDigest: description.modelDigest?.trim() || null,
    dimensions, normalization: "l2", corpusFingerprint, unitCount: unitIds.length, chunkCount: chunks.length,
    unitTextFormat: CHATNTC_SEMANTIC_UNIT_TEXT_FORMAT,
    chunking: { algorithm: CHATNTC_SEMANTIC_CHUNKING_ALGORITHM, ...chunking },
    tokenizerModel, tokenizerRevision,
    inputFingerprint: semanticInputFingerprint(chunks, { policy: chunking, tokenizerModel, tokenizerRevision }), parameters,
    vectors: { file: CHATNTC_SEMANTIC_VECTOR_FILE, encoding: "float32-le", byteLength: bytes.byteLength, sha256: sha256(bytes) },
    unitIds: [...unitIds],
    chunks: chunks.map((chunk, row) => ({ row, chunkId: chunk.chunkId, unitId: chunk.unitId, chunkIndex: chunk.chunkIndex,
      chunkCount: chunk.chunkCount, tokenCount: chunk.tokenCount })),
  };
  validateSemanticIndex(metadata, bytes, { corpusFingerprint, unitIds: metadata.unitIds, inputFingerprint: metadata.inputFingerprint });
  await mkdir(outputDirectory, { recursive: true });
  await writeFile(join(outputDirectory, CHATNTC_SEMANTIC_VECTOR_FILE), bytes);
  await writeFile(join(outputDirectory, CHATNTC_SEMANTIC_METADATA_FILE), `${JSON.stringify(metadata)}\n`, "utf8");
  return metadata;
}

export async function readSemanticIndex(directory: string,
  expected: ChatNTCSemanticIndexExpectation): Promise<LoadedChatNTCSemanticIndex> {
  let raw: string;
  try { raw = await readFile(join(directory, CHATNTC_SEMANTIC_METADATA_FILE), "utf8"); }
  catch { return fail("index.json non leggibile."); }
  let value: unknown;
  try { value = JSON.parse(raw); } catch { return fail("index.json non è JSON valido."); }
  const untrusted = object(value) && object(value.vectors) ? value.vectors.file : null;
  if (untrusted !== CHATNTC_SEMANTIC_VECTOR_FILE) fail("nome file vettori non valido.");
  let bytes: Uint8Array;
  try { bytes = await readFile(join(directory, CHATNTC_SEMANTIC_VECTOR_FILE)); }
  catch { return fail("vectors.f32 non leggibile."); }
  const metadata = validateSemanticIndex(value, bytes, expected);
  const vectors = decodeVectors(bytes);
  const rows = new Map(metadata.chunks.map((chunk) => [chunk.chunkId, chunk.row]));
  return { metadata, vectors, vectorForChunk(chunkId) {
    const row = rows.get(chunkId);
    return row === undefined ? null : vectors.slice(row * metadata.dimensions, (row + 1) * metadata.dimensions);
  } };
}
