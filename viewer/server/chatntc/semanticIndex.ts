import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { CorpusUnit } from "../../shared/corpusData.js";

export const CHATNTC_SEMANTIC_INDEX_FORMAT_VERSION = 1 as const;
export const CHATNTC_SEMANTIC_UNIT_TEXT_FORMAT = "chatntc-unit-text-v1" as const;
export const CHATNTC_SEMANTIC_VECTOR_FILE = "vectors.f32" as const;
export const CHATNTC_SEMANTIC_METADATA_FILE = "index.json" as const;

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
  unitTextFormat: typeof CHATNTC_SEMANTIC_UNIT_TEXT_FORMAT;
  inputFingerprint: string;
  parameters: Record<string, EmbeddingParameter>;
  vectors: {
    file: typeof CHATNTC_SEMANTIC_VECTOR_FILE;
    encoding: "float32-le";
    byteLength: number;
    sha256: string;
  };
  unitIds: string[];
}

export interface ChatNTCSemanticIndexExpectation {
  corpusFingerprint: string;
  unitIds: readonly string[];
  inputFingerprint?: string;
}

export interface LoadedChatNTCSemanticIndex {
  metadata: ChatNTCSemanticIndexMetadata;
  vectors: Float32Array;
  vectorFor(unitId: string): Float32Array | null;
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
  const body = unit.blocks.flatMap((block) => block.blockId !== unit.titleBlockId && block.text?.normalized.trim()
    ? [block.text.normalized.trim()] : []).join("\n\n");
  return [
    `document: ${unit.document}`,
    `numbering: ${unit.numbering.official}`,
    `title: ${unit.title.trim()}`,
    "text:",
    body,
  ].join("\n");
}

export function semanticInputFingerprint(units: readonly CorpusUnit[]): string {
  return sha256(JSON.stringify(units.map((unit) => [unit.id, semanticTextForUnit(unit)])));
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
    "normalization", "corpusFingerprint", "unitCount", "unitTextFormat", "inputFingerprint", "parameters", "vectors", "unitIds"]);
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
  if (value.unitTextFormat !== CHATNTC_SEMANTIC_UNIT_TEXT_FORMAT) return fail("formato testo unità non supportato.");
  const parameters = normalizedParameters(value.parameters);
  if (!object(value.vectors)) return fail("descriptor vettori mancante.");
  exactKeys(value.vectors, ["file", "encoding", "byteLength", "sha256"]);
  if (value.vectors.file !== CHATNTC_SEMANTIC_VECTOR_FILE || value.vectors.encoding !== "float32-le"
    || !Number.isSafeInteger(value.vectors.byteLength) || Number(value.vectors.byteLength) < 1
    || !fingerprint(value.vectors.sha256)) return fail("descriptor vettori non valido.");
  if (!Array.isArray(value.unitIds) || value.unitIds.some((unitId) => typeof unitId !== "string" || !unitId)) return fail("unitIds non validi.");
  return { ...value, dimensions: Number(value.dimensions), unitCount: Number(value.unitCount), parameters,
    vectors: { ...value.vectors, byteLength: Number(value.vectors.byteLength) }, unitIds: [...value.unitIds] } as ChatNTCSemanticIndexMetadata;
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
  const expectedBytes = metadata.unitCount * metadata.dimensions * Float32Array.BYTES_PER_ELEMENT;
  if (metadata.vectors.byteLength !== expectedBytes || vectorBytes.byteLength !== expectedBytes) fail("dimensione binaria incoerente.");
  if (sha256(vectorBytes) !== metadata.vectors.sha256) fail("hash dei vettori non corrispondente.");
  const vectors = decodeVectors(vectorBytes);
  for (let row = 0; row < metadata.unitCount; row++) {
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
  units: readonly CorpusUnit[];
  corpusFingerprint: string;
  provider: ChatNTCEmbeddingProvider;
  outputDirectory: string;
  batchSize?: number;
}): Promise<ChatNTCSemanticIndexMetadata> {
  const { units, corpusFingerprint, provider, outputDirectory } = input;
  const batchSize = input.batchSize ?? 8;
  if (!units.length || new Set(units.map((unit) => unit.id)).size !== units.length) fail("unità sorgente assenti o duplicate.");
  if (!fingerprint(corpusFingerprint)) fail("corpus fingerprint non valido.");
  if (!Number.isSafeInteger(batchSize) || batchSize < 1 || batchSize > 128) fail("batch size non valido.");
  const description = await provider.describe();
  if (!description.embeddingProvider?.trim() || !description.embeddingModel?.trim()) fail("provider o modello embedding non dichiarato.");
  const parameters = normalizedParameters(description.parameters);
  const texts = units.map(semanticTextForUnit);
  const vectors: Float32Array[] = [];
  let dimensions = description.dimensions;
  if (dimensions !== undefined && (!Number.isSafeInteger(dimensions) || dimensions < 1)) fail("dimensions dichiarate non valide.");
  for (let offset = 0; offset < texts.length; offset += batchSize) {
    const batch = texts.slice(offset, offset + batchSize);
    const embedded = await provider.embed(batch);
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
    dimensions, normalization: "l2", corpusFingerprint, unitCount: units.length,
    unitTextFormat: CHATNTC_SEMANTIC_UNIT_TEXT_FORMAT, inputFingerprint: semanticInputFingerprint(units), parameters,
    vectors: { file: CHATNTC_SEMANTIC_VECTOR_FILE, encoding: "float32-le", byteLength: bytes.byteLength, sha256: sha256(bytes) },
    unitIds: units.map((unit) => unit.id),
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
  const rows = new Map(metadata.unitIds.map((unitId, row) => [unitId, row]));
  return { metadata, vectors, vectorFor(unitId) {
    const row = rows.get(unitId);
    return row === undefined ? null : vectors.slice(row * metadata.dimensions, (row + 1) * metadata.dimensions);
  } };
}
