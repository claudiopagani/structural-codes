import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { generateSemanticIndex, semanticInputFingerprint } from "../.chatntc-test/server/chatntc/semanticIndex.js";
import {
  ChatNTCSemanticRetrievalError, createChatNTCSemanticIndexLoader, createChatNTCSemanticRetriever,
} from "../.chatntc-test/server/chatntc/semanticRetriever.js";

const corpusFingerprint = "c".repeat(64);
const description = {
  embeddingProvider: "fixture", embeddingModel: "fixture-model", modelVersion: "1.0.0",
  modelDigest: "d".repeat(64), dimensions: 3, parameters: { precision: "float32", prompt: "query-v1" },
};
const unit = (number, document = "ntc2018") => {
  const id = `urn:structural-codes:it:unit:${document}:${number.toLowerCase()}`;
  return { id, document, kind: "paragraph", numbering: { official: number, sortKey: number }, title: `Titolo ${number}`,
    titleBlockId: `${id}#heading`, hierarchy: { parentId: null, ancestorIds: [], position: 1 },
    validity: { from: null, to: null, status: "unknown", asOf: "2026-01-01" }, relations: [], review: { status: "draft" },
    blocks: [{ blockId: `${id}#heading`, kind: "heading", origin: "official",
      text: { raw: "Titolo", normalized: `Titolo ${number}`, normalizationVersion: "fixture" } },
    { blockId: `${id}#p1`, kind: "paragraph", origin: "official",
      text: { raw: "Testo", normalized: `Testo ${number}`, normalizationVersion: "fixture" } }],
  };
};
const units = [unit("1.1"), unit("1.2", "circ2019"), unit("1.3")];
const vectors = [[1, 0, 0], [0, 1, 0], [1, 0, 0]];
const summaries = units.map((entry) => ({ unitId: entry.id, document: entry.document, numbering: entry.numbering.official }));
const expected = { corpusFingerprint, unitIds: units.map((entry) => entry.id), inputFingerprint: semanticInputFingerprint(units) };

async function fixture(t) {
  const directory = await mkdtemp(join(tmpdir(), "chatntc-semantic-retrieval-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  let offset = 0;
  await generateSemanticIndex({ units, corpusFingerprint, outputDirectory: directory, batchSize: 2, provider: {
    async describe() { return description; },
    async embed(texts) { return texts.map(() => vectors[offset++]); },
  } });
  const loader = createChatNTCSemanticIndexLoader({ directory, expected });
  return { directory, loader };
}

const provider = (queryVector = [1, 0, 0], overrides = {}) => ({
  async describe() { return { ...description, ...(overrides.description ?? {}) }; },
  async embed(_texts, options) {
    if (overrides.embed) return overrides.embed(options);
    return [queryVector];
  },
});

const expectCode = (promise, code, kind) => assert.rejects(promise, (error) => {
  assert.ok(error instanceof ChatNTCSemanticRetrievalError);
  assert.equal(error.code, code);
  assert.equal(error.kind, kind);
  return true;
});

test("cosine lineare, top-K, filtro documento e tie-break canonico sono deterministici", async (t) => {
  const { loader } = await fixture(t);
  const retriever = createChatNTCSemanticRetriever({ provider: provider(), indexLoader: loader, units: summaries });
  const result = await retriever.retrieve({ query: "azione", limit: 3 });
  assert.deepEqual(result.hits.map((hit) => hit.unitId), [units[0].id, units[2].id, units[1].id]);
  assert.deepEqual(result.hits.map((hit) => hit.semanticRank), [1, 2, 3]);
  assert.ok(Math.abs(result.hits[0].similarity - 1) < 1e-6);
  assert.ok(Math.abs(result.hits[2].similarity) < 1e-6);
  const filtered = await retriever.retrieve({ query: "azione", limit: 3, document: "circ2019" });
  assert.deepEqual(filtered.hits.map((hit) => [hit.document, hit.numbering]), [["circ2019", "1.2"]]);
});

test("query embedding con dimensioni errate è rifiutato", async (t) => {
  const { loader } = await fixture(t);
  const retriever = createChatNTCSemanticRetriever({ provider: provider([1, 0]), indexLoader: loader, units: summaries });
  await expectCode(retriever.retrieve({ query: "azione", limit: 2 }), "QUERY_DIMENSIONS_MISMATCH", "configuration");
});

test("model identity, digest/version e parametri devono coincidere con l'indice", async (t) => {
  const { loader } = await fixture(t);
  for (const [changed, code] of [
    [{ embeddingModel: "altro" }, "MODEL_IDENTITY_MISMATCH"],
    [{ modelVersion: "2.0.0" }, "MODEL_VERSION_MISMATCH"],
    [{ modelDigest: "e".repeat(64) }, "MODEL_DIGEST_MISMATCH"],
    [{ dimensions: 2 }, "MODEL_DIMENSIONS_MISMATCH"],
    [{ parameters: { precision: "float16", prompt: "query-v1" } }, "MODEL_PARAMETERS_MISMATCH"],
  ]) {
    const retriever = createChatNTCSemanticRetriever({ provider: provider([1, 0, 0], { description: changed }),
      indexLoader: loader, units: summaries });
    await expectCode(retriever.retrieve({ query: "azione", limit: 2 }), code, "configuration");
  }
});

test("corpus fingerprint mismatch e indice binario corrotto sono errori di integrità", async (t) => {
  const { directory } = await fixture(t);
  const badFingerprint = createChatNTCSemanticIndexLoader({ directory,
    expected: { ...expected, corpusFingerprint: "f".repeat(64) } });
  await expectCode(badFingerprint.load(), "SEMANTIC_INDEX_INVALID", "integrity");
  const bytes = new Uint8Array(await readFile(join(directory, "vectors.f32")));
  bytes[0] ^= 1;
  await writeFile(join(directory, "vectors.f32"), bytes);
  const corrupted = createChatNTCSemanticIndexLoader({ directory, expected });
  await expectCode(corrupted.load(), "SEMANTIC_INDEX_INVALID", "integrity");
});

test("provider failure è classificata runtime e AbortSignal raggiunge embed", async (t) => {
  const { loader } = await fixture(t);
  const failed = createChatNTCSemanticRetriever({ provider: provider([1, 0, 0], {
    embed: async () => { throw new Error("provider offline"); },
  }), indexLoader: loader, units: summaries });
  await expectCode(failed.retrieve({ query: "azione", limit: 2 }), "QUERY_EMBEDDING_FAILED", "runtime");

  const controller = new AbortController();
  const cancelled = createChatNTCSemanticRetriever({ provider: provider([1, 0, 0], {
    embed: (options) => new Promise((_resolve, reject) => {
      assert.equal(options.signal, controller.signal);
      options.signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")), { once: true });
      controller.abort();
    }),
  }), indexLoader: loader, units: summaries });
  await expectCode(cancelled.retrieve({ query: "azione", limit: 2, signal: controller.signal }), "QUERY_CANCELLED", "cancelled");
});

test("loader riusa la snapshot validata, invalidate forza la rilettura e indice assente è esplicito", async (t) => {
  const { directory, loader } = await fixture(t);
  const first = await loader.load();
  await writeFile(join(directory, "vectors.f32"), new Uint8Array(0));
  assert.equal(await loader.load(), first);
  loader.invalidate();
  await expectCode(loader.load(), "SEMANTIC_INDEX_INVALID", "integrity");

  const missingDirectory = await mkdtemp(join(tmpdir(), "chatntc-semantic-missing-"));
  t.after(() => rm(missingDirectory, { recursive: true, force: true }));
  const missing = createChatNTCSemanticIndexLoader({ directory: missingDirectory, expected });
  await expectCode(missing.load(), "SEMANTIC_INDEX_UNAVAILABLE", "configuration");
});
