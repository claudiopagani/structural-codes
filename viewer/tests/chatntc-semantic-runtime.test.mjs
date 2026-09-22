import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  CHATNTC_SEMANTIC_CHUNKING_DEFAULTS,
  CHATNTC_SEMANTIC_TOKENIZER_MODEL,
  CHATNTC_SEMANTIC_TOKENIZER_REVISION,
  generateSemanticIndex,
} from "../.chatntc-test/server/chatntc/semanticIndex.js";
import {
  ChatNTCSemanticConfigurationError,
  configuredChatNTCSemanticRuntime,
} from "../.chatntc-test/server/chatntc/semanticRuntime.js";
import { readChatNTCHealth } from "../.chatntc-test/server/chatntc/health.js";

const corpusFingerprint = "f".repeat(64);
const ids = [
  "urn:structural-codes:it:unit:ntc2018:1",
  "urn:structural-codes:it:unit:circ2019:c1",
];
const parameters = {
  denseOnly: true,
  normalization: "l2",
  maxLength: 1024,
  fp16: true,
  inputTypes: "query,document",
  flagEmbeddingVersion: "1.4.2",
};
const description = {
  embeddingProvider: "flagembedding-http",
  embeddingModel: "BAAI/bge-m3",
  modelVersion: null,
  modelDigest: null,
  dimensions: 1024,
  parameters,
};
const vector = (position) => Array.from({ length: 1024 }, (_, index) => Number(index === position));

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), "chatntc-semantic-runtime-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const dataDirectory = join(root, "data");
  const indexDirectory = join(root, "semantic");
  await mkdir(join(dataDirectory, "ntc2018"), { recursive: true });
  await mkdir(join(dataDirectory, "circ2019"), { recursive: true });
  await writeFile(join(dataDirectory, "manifest.json"), JSON.stringify({
    corpusFingerprintSha256: corpusFingerprint,
    stats: { units: 2 },
  }));
  const summary = (id, document, official) => ({ id, document, numbering: { official } });
  await writeFile(join(dataDirectory, "ntc2018", "index.json"), JSON.stringify({
    formatVersion: 2, document: "ntc2018", units: [summary(ids[0], "ntc2018", "1")],
  }));
  await writeFile(join(dataDirectory, "circ2019", "index.json"), JSON.stringify({
    formatVersion: 2, document: "circ2019", units: [summary(ids[1], "circ2019", "C1")],
  }));
  const chunks = ids.map((unitId, index) => ({
    chunkId: `${unitId}#chunk-1`, unitId, document: index ? "circ2019" : "ntc2018",
    numbering: index ? "C1" : "1", title: "Fixture", chunkIndex: 0, chunkCount: 1,
    tokenCount: 1, text: `fixture ${index}`,
  }));
  let offset = 0;
  await generateSemanticIndex({
    chunks, unitIds: ids, corpusFingerprint, outputDirectory: indexDirectory,
    chunking: CHATNTC_SEMANTIC_CHUNKING_DEFAULTS,
    tokenizerModel: CHATNTC_SEMANTIC_TOKENIZER_MODEL,
    tokenizerRevision: CHATNTC_SEMANTIC_TOKENIZER_REVISION,
    provider: {
      async describe() { return description; },
      async embed(texts, options) {
        assert.equal(options.inputType, "document");
        return texts.map(() => vector(offset++));
      },
    },
  });
  return { root, dataDirectory, indexDirectory };
}

test("default e off non inizializzano provider, indice o servizio HTTP", () => {
  let providerCalls = 0;
  const providerFactory = () => { providerCalls += 1; throw new Error("non deve essere chiamato"); };
  const defaults = configuredChatNTCSemanticRuntime({}, { providerFactory });
  assert.equal(defaults.mode, "off");
  assert.equal(defaults.provider, null);
  assert.deepEqual(defaults.configuration, { mode: "off" });
  const explicit = configuredChatNTCSemanticRuntime({
    CHATNTC_SEMANTIC_MODE: "off",
    CHATNTC_EMBEDDING_PROVIDER: "sconosciuto",
    CHATNTC_EMBEDDING_URL: "not-a-url",
    CHATNTC_SEMANTIC_INDEX_PATH: "Z:/indice/inesistente",
  }, { providerFactory });
  assert.equal(explicit.mode, "off");
  assert.equal(providerCalls, 0);
});

test("health espone readiness off e rende esplicito un preflight semantic fallito", async () => {
  const off = configuredChatNTCSemanticRuntime({});
  assert.deepEqual(await readChatNTCHealth(off), {
    status: "ok",
    ready: true,
    service: "chatntc",
    semantic: { mode: "off", ready: true, provider: null },
  });
  const failure = await readChatNTCHealth({
    mode: "on",
    provider: "flagembedding-http",
    indexDirectory: "fixture",
    configuration: { mode: "on" },
    async initialize() { throw new Error("fixture preflight failure"); },
  });
  assert.equal(failure.status, "error");
  assert.equal(failure.ready, false);
  assert.equal(failure.semantic.mode, "on");
  assert.equal(failure.semantic.provider, "flagembedding-http");
  assert.match(failure.error, /fixture preflight failure/u);
});

test("shadow e on costruiscono e validano le dipendenze semantic con provider mockato", async (t) => {
  const { dataDirectory, indexDirectory } = await fixture(t);
  for (const activeMode of ["shadow", "on"]) {
    let providerCalls = 0;
    const inputTypes = [];
    const runtime = configuredChatNTCSemanticRuntime({
      CHATNTC_SEMANTIC_MODE: activeMode,
      CHATNTC_EMBEDDING_PROVIDER: "flagembedding-http",
      CHATNTC_EMBEDDING_URL: "http://127.0.0.1:8091",
      CHATNTC_SEMANTIC_INDEX_PATH: indexDirectory,
    }, { dataDirectory, providerFactory(options) {
      providerCalls += 1;
      assert.equal(options.provider, "flagembedding-http");
      return {
        async describe() { return description; },
        async embed(_texts, options) { inputTypes.push(options.inputType); return [vector(0)]; },
      };
    } });
    assert.equal(runtime.mode, activeMode);
    assert.equal(runtime.provider, "flagembedding-http");
    assert.equal(providerCalls, 1);
    const configuration = await runtime.initialize();
    const result = await configuration.retriever.retrieve({ query: "fixture", limit: 2 });
    assert.deepEqual(result.hits.map((hit) => hit.unitId), ids);
    assert.deepEqual(inputTypes, ["query"]);
  }
});

test("configurazioni attive invalide falliscono prima del retrieval", async (t) => {
  assert.throws(() => configuredChatNTCSemanticRuntime({ CHATNTC_SEMANTIC_MODE: "invalid" }),
    ChatNTCSemanticConfigurationError);
  assert.throws(() => configuredChatNTCSemanticRuntime({ CHATNTC_SEMANTIC_MODE: "on" }),
    /CHATNTC_SEMANTIC_INDEX_PATH/u);
  const { dataDirectory, indexDirectory } = await fixture(t);
  assert.throws(() => configuredChatNTCSemanticRuntime({
    CHATNTC_SEMANTIC_MODE: "on",
    CHATNTC_EMBEDDING_PROVIDER: "sconosciuto",
    CHATNTC_SEMANTIC_INDEX_PATH: indexDirectory,
  }, { dataDirectory }), /CHATNTC_EMBEDDING_PROVIDER/u);
  assert.throws(() => configuredChatNTCSemanticRuntime({
    CHATNTC_SEMANTIC_MODE: "on",
    CHATNTC_EMBEDDING_PROVIDER: "ollama",
    CHATNTC_EMBEDDING_MODEL: "bge-m3:latest",
    CHATNTC_SEMANTIC_INDEX_PATH: indexDirectory,
  }, { dataDirectory }), /provider indice .* incompatibile/u);
  assert.throws(() => configuredChatNTCSemanticRuntime({
    CHATNTC_SEMANTIC_MODE: "on",
    CHATNTC_SEMANTIC_INDEX_PATH: indexDirectory,
    CHATNTC_EMBEDDING_URL: "not-a-url",
  }, { dataDirectory }), /provider embedding non inizializzabile/u);
});

test("Ollama resta disponibile soltanto tramite selezione esplicita e indice compatibile", async (t) => {
  const { dataDirectory, indexDirectory } = await fixture(t);
  const metadataFile = join(indexDirectory, "index.json");
  const metadata = JSON.parse(await readFile(metadataFile, "utf8"));
  metadata.embeddingProvider = "ollama";
  metadata.embeddingModel = "fixture:latest";
  metadata.modelDigest = "d".repeat(64);
  metadata.parameters = { numCtx: 8192, requestedDimensions: null, truncate: false };
  await writeFile(metadataFile, JSON.stringify(metadata));
  let selectedProvider;
  const runtime = configuredChatNTCSemanticRuntime({
    CHATNTC_SEMANTIC_MODE: "shadow",
    CHATNTC_EMBEDDING_PROVIDER: "ollama",
    CHATNTC_EMBEDDING_MODEL: "fixture:latest",
    CHATNTC_SEMANTIC_INDEX_PATH: indexDirectory,
  }, { dataDirectory, providerFactory(options) {
    selectedProvider = options.provider;
    return {
      async describe() { return { embeddingProvider: "ollama", embeddingModel: "fixture:latest",
        modelVersion: null, modelDigest: "d".repeat(64), dimensions: 1024,
        parameters: { numCtx: 8192, requestedDimensions: null, truncate: false } }; },
      async embed() { return [vector(0)]; },
    };
  } });
  await runtime.initialize();
  assert.equal(selectedProvider, "ollama");
  assert.equal(runtime.provider, "ollama");
});
