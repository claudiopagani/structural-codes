import assert from "node:assert/strict";
import test from "node:test";
import {
  BgeM3HttpEmbeddingProvider,
  DEFAULT_BGE_M3_HTTP_BASE_URL,
  DEFAULT_BGE_M3_HTTP_BATCH_SIZE,
  DEFAULT_BGE_M3_HTTP_TIMEOUT_MS,
} from "../.local/chatntc-semantic-tool/server/chatntc/bgeM3HttpEmbedding.js";

const dimensions = 1024;
const unitVector = () => [1, ...Array(dimensions - 1).fill(0)];
const health = (overrides = {}) => ({
  status: "ok",
  ready: true,
  provider: "FlagEmbedding",
  model: "BAAI/bge-m3",
  device: "cuda:0",
  dimensions,
  maxLength: 1024,
  fp16: true,
  normalized: true,
  cudaAvailable: true,
  gpuName: "hardware must not enter metadata",
  runtime: { flagEmbedding: "1.4.2", torch: "2.7.1+cu126", cuda: "12.6" },
  ...overrides,
});
const embeddingResponse = (count, overrides = {}) => ({
  model: "BAAI/bge-m3",
  dimensions,
  normalized: true,
  count,
  embeddings: Array.from({ length: count }, unitVector),
  ...overrides,
});
const jsonResponse = (value, init) => new Response(JSON.stringify(value), {
  headers: { "content-type": "application/json" },
  ...init,
});

function service(fetchEmbed = () => embeddingResponse(1), healthValue = health()) {
  const requests = [];
  const fetchImpl = async (url, init = {}) => {
    const path = new URL(url).pathname;
    requests.push({ path, init });
    if (path.endsWith("/health")) return jsonResponse(healthValue);
    const body = JSON.parse(init.body);
    return jsonResponse(fetchEmbed(body));
  };
  return { requests, fetchImpl };
}

test("health valido produce describe stabile e viene letto una sola volta", async () => {
  const { requests, fetchImpl } = service();
  const provider = new BgeM3HttpEmbeddingProvider({ baseUrl: "http://embedding.test:8091", fetchImpl });

  const first = await provider.describe();
  const second = await provider.describe();

  assert.deepEqual(first, {
    embeddingProvider: "flagembedding-http",
    embeddingModel: "BAAI/bge-m3",
    modelVersion: null,
    modelDigest: null,
    dimensions,
    parameters: {
      denseOnly: true,
      normalization: "l2",
      maxLength: 1024,
      fp16: true,
      inputTypes: "query,document",
      flagEmbeddingVersion: "1.4.2",
    },
  });
  assert.equal(second, first);
  assert.equal(requests.filter(({ path }) => path.endsWith("/health")).length, 1);
  assert.doesNotMatch(JSON.stringify(first), /GPU|cuda|device|embedding\.test/u);
  assert.equal(DEFAULT_BGE_M3_HTTP_BASE_URL, "http://127.0.0.1:8091");
  assert.equal(DEFAULT_BGE_M3_HTTP_TIMEOUT_MS, 120_000);
  assert.equal(DEFAULT_BGE_M3_HTTP_BATCH_SIZE, 32);
});

test("query e document inviano inputType distinti e ricevono 1024 dimensioni", async () => {
  const { requests, fetchImpl } = service((body) => embeddingResponse(body.texts.length));
  const provider = new BgeM3HttpEmbeddingProvider({ fetchImpl });

  const query = await provider.embed(["domanda"], { inputType: "query" });
  const documents = await provider.embed(["documento uno", "documento due"], { inputType: "document" });

  assert.equal(query[0].length, dimensions);
  assert.equal(documents.length, 2);
  const bodies = requests.filter(({ path }) => path.endsWith("/embed")).map(({ init }) => JSON.parse(init.body));
  assert.deepEqual(bodies, [
    { texts: ["domanda"], inputType: "query" },
    { texts: ["documento uno", "documento due"], inputType: "document" },
  ]);
});

test("batch multipli rispettano batchSize e il default è document", async () => {
  const { requests, fetchImpl } = service((body) => embeddingResponse(body.texts.length));
  const provider = new BgeM3HttpEmbeddingProvider({ batchSize: 2, fetchImpl });

  const vectors = await provider.embed(["uno", "due", "tre", "quattro", "cinque"]);

  assert.equal(vectors.length, 5);
  const bodies = requests.filter(({ path }) => path.endsWith("/embed")).map(({ init }) => JSON.parse(init.body));
  assert.deepEqual(bodies.map(({ texts }) => texts.length), [2, 2, 1]);
  assert.ok(bodies.every(({ inputType }) => inputType === "document"));
});

test("timeout interrompe la richiesta con diagnostica controllata", async () => {
  const fetchImpl = async (_url, init) => new Promise((_resolve, reject) => {
    init.signal.addEventListener("abort", () => reject(init.signal.reason), { once: true });
  });
  const provider = new BgeM3HttpEmbeddingProvider({ timeoutMs: 5, fetchImpl });

  await assert.rejects(provider.describe(), /Timeout BGE-M3 HTTP dopo 5 ms/u);
});

test("AbortSignal cancella embedding senza fallback", async () => {
  const fetchImpl = async (url, init = {}) => {
    if (new URL(url).pathname.endsWith("/health")) return jsonResponse(health());
    return new Promise((_resolve, reject) => {
      init.signal.addEventListener("abort", () => reject(init.signal.reason), { once: true });
    });
  };
  const provider = new BgeM3HttpEmbeddingProvider({ fetchImpl });
  await provider.describe();
  const controller = new AbortController();
  const pending = provider.embed(["contenuto riservato"], { inputType: "query", signal: controller.signal });
  controller.abort(new Error("annullato dal test"));

  await assert.rejects(pending, /annullato dal test/u);
});

for (const status of [400, 503]) {
  test(`HTTP ${status} non espone il testo inviato`, async () => {
    const secret = "TESTO-SEGRETO-NON-DEVE-COMPARIRE";
    const fetchImpl = async (url) => new URL(url).pathname.endsWith("/health")
      ? jsonResponse(health())
      : jsonResponse({ detail: secret }, { status });
    const provider = new BgeM3HttpEmbeddingProvider({ fetchImpl });

    await assert.rejects(provider.embed([secret], { inputType: "query" }), (error) => {
      assert.match(error.message, new RegExp(`HTTP ${status}`, "u"));
      assert.doesNotMatch(error.message, new RegExp(secret, "u"));
      return true;
    });
  });
}

for (const [name, override, pattern] of [
  ["health non ready", { ready: false }, /non pronto/u],
  ["modello errato", { model: "altro/modello" }, /Modello .* inatteso/u],
  ["dimensioni errate", { dimensions: 768 }, /Dimensioni .* inattese/u],
]) {
  test(name, async () => {
    const { fetchImpl } = service(undefined, health(override));
    const provider = new BgeM3HttpEmbeddingProvider({ fetchImpl });
    await assert.rejects(provider.describe(), pattern);
  });
}

test("rifiuta numero di embeddings e dimensioni vettore incoerenti", async () => {
  const missing = service(() => embeddingResponse(1));
  await assert.rejects(
    new BgeM3HttpEmbeddingProvider({ fetchImpl: missing.fetchImpl }).embed(["uno", "due"]),
    /Risposta embedding .* non valida/u,
  );

  const wrongDimensions = service(() => embeddingResponse(1, { embeddings: [[1, 0, 0]] }));
  await assert.rejects(
    new BgeM3HttpEmbeddingProvider({ fetchImpl: wrongDimensions.fetchImpl }).embed(["uno"]),
    /Vettore .* non valido/u,
  );
});

test("rifiuta valori non numerici, NaN/Infinity JSON e risposta JSON invalida", async () => {
  const nonNumeric = service(() => embeddingResponse(1, { embeddings: [["x", ...Array(dimensions - 1).fill(0)]] }));
  await assert.rejects(
    new BgeM3HttpEmbeddingProvider({ fetchImpl: nonNumeric.fetchImpl }).embed(["uno"]),
    /Vettore .* non valido/u,
  );

  const infiniteFetch = async (url) => new URL(url).pathname.endsWith("/health")
    ? jsonResponse(health())
    : new Response(`{"model":"BAAI/bge-m3","dimensions":1024,"normalized":true,"count":1,"embeddings":[[1e309,${Array(dimensions - 1).fill(0).join(",")}]]}`);
  await assert.rejects(
    new BgeM3HttpEmbeddingProvider({ fetchImpl: infiniteFetch }).embed(["uno"]),
    /Vettore .* non valido/u,
  );

  const invalidJsonFetch = async (url) => new URL(url).pathname.endsWith("/health")
    ? jsonResponse(health())
    : new Response("{not-json");
  await assert.rejects(
    new BgeM3HttpEmbeddingProvider({ fetchImpl: invalidJsonFetch }).embed(["uno"]),
    /Risposta BGE-M3 HTTP non valida/u,
  );
});
