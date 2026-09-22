import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  assertChatNTCEmbeddingCompatibility, createChatNTCEmbeddingProvider, parseChatNTCEmbeddingProvider,
} from "../.local/chatntc-semantic-tool/server/chatntc/embeddingProviderFactory.js";
import { DEFAULT_OLLAMA_NUM_CTX, OllamaEmbeddingProvider } from "../.local/chatntc-semantic-tool/server/chatntc/ollamaEmbedding.js";
import {
  CHATNTC_SEMANTIC_CHUNKING_DEFAULTS, CHATNTC_SEMANTIC_TOKENIZER_MODEL, CHATNTC_SEMANTIC_TOKENIZER_REVISION,
  chunkSemanticUnits, generateSemanticIndex, readSemanticIndex, semanticInputFingerprint, semanticTextForChunk, semanticTextForUnit, validateSemanticIndex,
} from "../.local/chatntc-semantic-tool/server/chatntc/semanticIndex.js";

const viewerRoot = fileURLToPath(new URL("../", import.meta.url));
const corpusFingerprint = "a".repeat(64);
const unit = (number, text, document = "ntc2018") => {
  const id = `urn:structural-codes:it:unit:${document}:${number.toLowerCase()}`;
  return { id, document, kind: "paragraph", numbering: { official: number, sortKey: number }, title: `Titolo ${number}`,
    titleBlockId: `${id}#heading`, hierarchy: { parentId: null, ancestorIds: [], position: 1 },
    validity: { from: null, to: null, status: "unknown", asOf: "2026-01-01" }, relations: [], review: { status: "draft" },
    blocks: [
      { blockId: `${id}#heading`, kind: "heading", origin: "official", text: { raw: "Titolo raw", normalized: `Titolo ${number}`, normalizationVersion: "fixture" } },
      { blockId: `${id}#p1`, kind: "paragraph", origin: "official", text: { raw: text, normalized: text, normalizationVersion: "fixture" } },
      { blockId: `${id}#asset`, kind: "formula-ref", origin: "official", assetId: "fixture-asset" },
    ] };
};
const units = [unit("1.1", "Testo normalizzato utile."), unit("C1.2", "Secondo capoverso.", "circ2019")];
const fixtureTokenizer = {
  encode(text, options = {}) {
    const ids = Array.from(text, (character) => character.codePointAt(0));
    return { ids: options.add_special_tokens === false ? ids : [0, ...ids, 2] };
  },
  decode(ids) { return String.fromCodePoint(...ids); },
};
const chunks = chunkSemanticUnits(units, fixtureTokenizer, CHATNTC_SEMANTIC_CHUNKING_DEFAULTS);
const expected = { corpusFingerprint, unitIds: units.map((entry) => entry.id),
  inputFingerprint: semanticInputFingerprint(chunks, { policy: CHATNTC_SEMANTIC_CHUNKING_DEFAULTS,
    tokenizerModel: CHATNTC_SEMANTIC_TOKENIZER_MODEL, tokenizerRevision: CHATNTC_SEMANTIC_TOKENIZER_REVISION }) };

async function fixtureIndex() {
  const directory = await mkdtemp(join(tmpdir(), "chatntc-semantic-"));
  const provider = {
    async describe() { return { embeddingProvider: "fixture", embeddingModel: "fixture-embedding", modelVersion: "1",
      modelDigest: null, dimensions: 3, parameters: { fixture: true } }; },
    async embed(texts) { return texts.map((_, index) => index % 2 ? [0, 3, 4] : [1, 2, 2]); },
  };
  const metadata = await generateSemanticIndex({ chunks, unitIds: units.map((entry) => entry.id), corpusFingerprint,
    chunking: CHATNTC_SEMANTIC_CHUNKING_DEFAULTS, tokenizerModel: CHATNTC_SEMANTIC_TOKENIZER_MODEL,
    tokenizerRevision: CHATNTC_SEMANTIC_TOKENIZER_REVISION, provider, outputDirectory: directory, batchSize: 1 });
  return { directory, metadata };
}

test("testo embedding per unità è deterministico e usa solo campi canonici dichiarati", () => {
  assert.equal(semanticTextForUnit(units[0]), [
    "document: ntc2018", "numbering: 1.1", "title: Titolo 1.1", "text:", "Testo normalizzato utile.",
  ].join("\n"));
  assert.equal(semanticTextForUnit(units[0]), semanticTextForUnit(structuredClone(units[0])));
  assert.doesNotMatch(semanticTextForUnit(units[0]), /Titolo raw|fixture-asset/u);
});

test("genera, valida e legge metadata JSON più matrice Float32 compatta", async (t) => {
  const { directory, metadata } = await fixtureIndex();
  t.after(() => rm(directory, { recursive: true, force: true }));
  assert.equal(metadata.formatVersion, 2);
  assert.equal(metadata.dimensions, 3);
  assert.equal(metadata.unitCount, 2);
  assert.equal(metadata.chunkCount, 2);
  assert.equal(metadata.normalization, "l2");
  assert.equal(metadata.vectors.byteLength, 2 * 3 * Float32Array.BYTES_PER_ELEMENT);
  const loaded = await readSemanticIndex(directory, expected);
  assert.deepEqual([...loaded.vectorForChunk(chunks[0].chunkId)], [1 / 3, 2 / 3, 2 / 3].map(Math.fround));
  assert.equal(loaded.vectorForChunk("missing"), null);
  assert.ok(Math.abs(Math.hypot(...loaded.vectorForChunk(chunks[1].chunkId)) - 1) < 1e-6);
});

test("validazione rifiuta fingerprint, duplicati, unità ignote, indice incompleto e dimensioni incoerenti", async (t) => {
  const { directory, metadata } = await fixtureIndex();
  t.after(() => rm(directory, { recursive: true, force: true }));
  const bytes = await readFile(join(directory, "vectors.f32"));
  assert.throws(() => validateSemanticIndex(metadata, bytes, { ...expected, corpusFingerprint: "b".repeat(64) }), /corpus fingerprint/u);
  assert.throws(() => validateSemanticIndex({ ...metadata, unitIds: [units[0].id, units[0].id] }, bytes, expected), /duplicato/u);
  assert.throws(() => validateSemanticIndex({ ...metadata, chunks: metadata.chunks.map((chunk, index) => index ? { ...chunk, unitId: "unknown" } : chunk) }, bytes, expected), /coerente|incompleto/u);
  assert.throws(() => validateSemanticIndex({ ...metadata, unitCount: 1, unitIds: [units[0].id] }, bytes, expected), /incompleto|unitCount/u);
  assert.throws(() => validateSemanticIndex({ ...metadata, dimensions: 4 }, bytes, expected), /dimensione binaria/u);
  assert.throws(() => validateSemanticIndex({ ...metadata, embeddingModel: "" }, bytes, expected), /modello embedding/u);
  assert.throws(() => validateSemanticIndex({ ...metadata, parameters: undefined }, bytes, expected), /parametri embedding/u);
  assert.throws(() => validateSemanticIndex({ ...metadata, formatVersion: 1 }, bytes, expected), /formatVersion non supportata/u);
});

test("validazione rifiuta hash alterato, NaN e vettori non normalizzati", async (t) => {
  const { directory, metadata } = await fixtureIndex();
  t.after(() => rm(directory, { recursive: true, force: true }));
  const bytes = new Uint8Array(await readFile(join(directory, "vectors.f32")));
  const altered = bytes.slice(); altered[0] ^= 1;
  assert.throws(() => validateSemanticIndex(metadata, altered, expected), /hash/u);
  for (const [name, mutate, pattern] of [
    ["NaN", (view) => view.setFloat32(0, Number.NaN, true), /non finiti/u],
    ["norma", (view) => view.setFloat32(0, 10, true), /non normalizzato/u],
  ]) {
    const invalid = bytes.slice(); mutate(new DataView(invalid.buffer));
    const vectors = { ...metadata.vectors, sha256: createHash("sha256").update(invalid).digest("hex") };
    assert.throws(() => validateSemanticIndex({ ...metadata, vectors }, invalid, expected), pattern, name);
  }
});

test("generatore rifiuta batch e dimensioni incoerenti dal provider", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "chatntc-semantic-invalid-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const description = async () => ({ embeddingProvider: "fixture", embeddingModel: "fixture", modelVersion: null,
    modelDigest: null, dimensions: 3, parameters: {} });
  const input = { chunks, unitIds: units.map((entry) => entry.id), corpusFingerprint, outputDirectory: directory,
    chunking: CHATNTC_SEMANTIC_CHUNKING_DEFAULTS, tokenizerModel: CHATNTC_SEMANTIC_TOKENIZER_MODEL,
    tokenizerRevision: CHATNTC_SEMANTIC_TOKENIZER_REVISION };
  await assert.rejects(generateSemanticIndex({ ...input, provider: { describe: description, embed: async () => [[1, 2]] } }), /numero di embedding|dimensione vettore/u);
  await assert.rejects(generateSemanticIndex({ ...input, provider: { describe: description, embed: async (texts) => texts.map(() => [1, 2]) } }), /dimensione vettore/u);
});

test("generatore invia tutti i chunk al provider come document", async (t) => {
  const outputDirectory = await mkdtemp(join(tmpdir(), "chatntc-semantic-document-mode-"));
  t.after(() => rm(outputDirectory, { recursive: true, force: true }));
  const inputTypes = [];
  await generateSemanticIndex({ chunks, unitIds: units.map((entry) => entry.id), corpusFingerprint,
    outputDirectory, chunking: CHATNTC_SEMANTIC_CHUNKING_DEFAULTS,
    tokenizerModel: CHATNTC_SEMANTIC_TOKENIZER_MODEL, tokenizerRevision: CHATNTC_SEMANTIC_TOKENIZER_REVISION,
    batchSize: 1, provider: {
      async describe() { return { embeddingProvider: "flagembedding-http", embeddingModel: "BAAI/bge-m3",
        modelVersion: null, modelDigest: null, dimensions: 3, parameters: { mocked: true } }; },
      async embed(texts, options) {
        inputTypes.push(options?.inputType);
        return texts.map(() => [1, 0, 0]);
      },
    } });
  assert.deepEqual(inputTypes, Array(chunks.length).fill("document"));
});

test("factory tooling seleziona Ollama o FlagEmbedding e verifica i metadata", async () => {
  assert.equal(parseChatNTCEmbeddingProvider(undefined, "ollama"), "ollama");
  assert.throws(() => parseChatNTCEmbeddingProvider("sconosciuto", "ollama"), /non supportato/u);

  const ollama = createChatNTCEmbeddingProvider({ provider: "ollama", model: "fixture:1", fetchImpl: async () =>
    Response.json({ models: [{ name: "fixture:1", digest: "d".repeat(64) }] }) });
  const ollamaDescription = await ollama.describe();
  assert.equal(ollamaDescription.embeddingProvider, "ollama");

  const flag = createChatNTCEmbeddingProvider({ provider: "flagembedding-http", fetchImpl: async () => Response.json({
    status: "ok", ready: true, provider: "FlagEmbedding", model: "BAAI/bge-m3", dimensions: 1024,
    maxLength: 1024, fp16: true, normalized: true, runtime: { flagEmbedding: "1.4.2" },
  }) });
  const flagDescription = await flag.describe();
  assert.equal(flagDescription.embeddingProvider, "flagembedding-http");
  const identity = { embeddingProvider: "flagembedding-http", embeddingModel: "BAAI/bge-m3",
    modelVersion: null, modelDigest: null, dimensions: 1024, normalization: "l2",
    parameters: flagDescription.parameters };
  assert.doesNotThrow(() => assertChatNTCEmbeddingCompatibility(flagDescription, identity));
  assert.throws(() => assertChatNTCEmbeddingCompatibility(ollamaDescription, identity), /non compatibile/u);
});

test("adapter Ollama usa tags per il digest e /api/embed senza troncamento", async () => {
  const requests = [];
  const adapter = new OllamaEmbeddingProvider({ model: "fixture:1", dimensions: 3, fetchImpl: async (url, init = {}) => {
    requests.push({ url: String(url), init });
    if (String(url).endsWith("/api/tags")) return Response.json({ models: [{ name: "fixture:1", model: "fixture:1", digest: "d".repeat(64) }] });
    return Response.json({ model: "fixture:1", embeddings: [[1, 2, 3]] });
  } });
  const description = await adapter.describe();
  assert.equal(description.modelDigest, "d".repeat(64));
  assert.deepEqual(description.parameters, { numCtx: DEFAULT_OLLAMA_NUM_CTX, truncate: false, requestedDimensions: 3 });
  assert.deepEqual(await adapter.embed(["fixture text"]), [[1, 2, 3]]);
  assert.equal(requests[0].url, "http://127.0.0.1:11434/api/tags");
  assert.equal(requests[1].url, "http://127.0.0.1:11434/api/embed");
  assert.deepEqual(JSON.parse(requests[1].init.body), { model: "fixture:1", input: ["fixture text"], truncate: false,
    options: { num_ctx: DEFAULT_OLLAMA_NUM_CTX }, dimensions: 3 });
});

test("adapter Ollama propaga numCtx esplicito e rifiuta valori non validi", async () => {
  const requests = [];
  const adapter = new OllamaEmbeddingProvider({ model: "fixture:1", numCtx: 4096, fetchImpl: async (url, init = {}) => {
    requests.push({ url: String(url), init });
    if (String(url).endsWith("/api/tags")) return Response.json({ models: [{ name: "fixture:1" }] });
    return Response.json({ embeddings: [[1, 2, 3]] });
  } });
  const description = await adapter.describe();
  assert.equal(description.parameters.numCtx, 4096);
  await adapter.embed(["fixture text"]);
  assert.equal(JSON.parse(requests[1].init.body).options.num_ctx, 4096);
  for (const value of [0, -1, 1.5, 131_073]) {
    assert.throws(() => new OllamaEmbeddingProvider({ model: "fixture:1", numCtx: value }), /numCtx Ollama non valido/u);
  }
});

test("adapter Ollama conserva status e dettaglio error JSON con limite e senza body", async () => {
  const detail = "input length exceeds context length";
  const adapter = new OllamaEmbeddingProvider({ model: "fixture:1", fetchImpl: async () =>
    Response.json({ error: detail }, { status: 400 }) });
  await assert.rejects(adapter.embed(["testo breve"]), (error) => {
    assert.equal(error.message, `Ollama non disponibile (HTTP 400): ${detail}`);
    assert.doesNotMatch(error.message, /testo breve/u);
    return true;
  });

  const oversized = "secret-request-content-" + "x".repeat(10_000);
  const bounded = new OllamaEmbeddingProvider({ model: "fixture:1", fetchImpl: async () =>
    Response.json({ error: oversized }, { status: 400 }) });
  await assert.rejects(bounded.embed(["contenuto non diagnostico"]), (error) => {
    assert.ok(error.message.length < 500);
    assert.doesNotMatch(error.message, /contenuto non diagnostico/u);
    assert.match(error.message, /secret-request-content/u);
    return true;
  });

  const nonJson = new OllamaEmbeddingProvider({ model: "fixture:1", fetchImpl: async () =>
    new Response("bad request", { status: 400, headers: { "content-type": "text/plain" } }) });
  await assert.rejects(nonJson.embed(["testo breve"]), (error) => {
    assert.equal(error.message, "Ollama non disponibile (HTTP 400).");
    return true;
  });
});

test("fallimento embedding include il contesto controllato del batch senza il testo", async (t) => {
  const expectedTextLength = semanticTextForChunk(chunks[0]).length;
  const outputDirectory = await mkdtemp(join(tmpdir(), "chatntc-semantic-failed-"));
  t.after(() => rm(outputDirectory, { recursive: true, force: true }));
  const provider = {
    async describe() { return { embeddingProvider: "fixture", embeddingModel: "fixture-embedding", modelVersion: null, modelDigest: null, dimensions: 3, parameters: {} }; },
    async embed() { throw new Error("Ollama non disponibile (HTTP 400): input length exceeds context length"); },
  };
  await assert.rejects(generateSemanticIndex({ chunks, unitIds: units.map((entry) => entry.id), corpusFingerprint, provider, outputDirectory,
    chunking: CHATNTC_SEMANTIC_CHUNKING_DEFAULTS, tokenizerModel: CHATNTC_SEMANTIC_TOKENIZER_MODEL,
    tokenizerRevision: CHATNTC_SEMANTIC_TOKENIZER_REVISION, batchSize: 1 }), (error) => {
    assert.match(error.message, new RegExp(`Embedding batch fallito .*offset=0.*size=1.*${units[0].id}.*document=ntc2018.*numbering=1\\.1.*characters=${expectedTextLength}`));
    assert.match(error.message, /input length exceeds context length/u);
    assert.doesNotMatch(error.message, /Testo normalizzato utile/u);
    return true;
  });
});

test("il generatore compilato risolve viewerRoot dal working directory del package", async (t) => {
  const outputDirectory = await mkdtemp(join(viewerRoot, ".local", "chatntc-root-test-"));
  t.after(() => rm(outputDirectory, { recursive: true, force: true }));
  const generator = join(viewerRoot, ".local", "chatntc-semantic-tool", "scripts", "generate-chatntc-semantic-index.js");
  const result = spawnSync(process.execPath, [generator, "--validate-only", "--output", outputDirectory], {
    cwd: viewerRoot,
    encoding: "utf8",
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /ChatNTC semantic index: index\.json non leggibile/u);
  assert.doesNotMatch(result.stderr, /chatntc-semantic-tool[\\/]public[\\/]data[\\/]codes[\\/]manifest\.json/u);
});
