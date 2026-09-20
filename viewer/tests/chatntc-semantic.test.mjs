import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { OllamaEmbeddingProvider } from "../.local/chatntc-semantic-tool/server/chatntc/ollamaEmbedding.js";
import {
  generateSemanticIndex, readSemanticIndex, semanticInputFingerprint, semanticTextForUnit, validateSemanticIndex,
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
const expected = { corpusFingerprint, unitIds: units.map((entry) => entry.id), inputFingerprint: semanticInputFingerprint(units) };

async function fixtureIndex() {
  const directory = await mkdtemp(join(tmpdir(), "chatntc-semantic-"));
  const provider = {
    async describe() { return { embeddingProvider: "fixture", embeddingModel: "fixture-embedding", modelVersion: "1",
      modelDigest: null, dimensions: 3, parameters: { fixture: true } }; },
    async embed(texts) { return texts.map((_, index) => index % 2 ? [0, 3, 4] : [1, 2, 2]); },
  };
  const metadata = await generateSemanticIndex({ units, corpusFingerprint, provider, outputDirectory: directory, batchSize: 1 });
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
  assert.equal(metadata.formatVersion, 1);
  assert.equal(metadata.dimensions, 3);
  assert.equal(metadata.unitCount, 2);
  assert.equal(metadata.normalization, "l2");
  assert.equal(metadata.vectors.byteLength, 2 * 3 * Float32Array.BYTES_PER_ELEMENT);
  const loaded = await readSemanticIndex(directory, expected);
  assert.deepEqual([...loaded.vectorFor(units[0].id)], [1 / 3, 2 / 3, 2 / 3].map(Math.fround));
  assert.equal(loaded.vectorFor("missing"), null);
  assert.ok(Math.abs(Math.hypot(...loaded.vectorFor(units[1].id)) - 1) < 1e-6);
});

test("validazione rifiuta fingerprint, duplicati, unità ignote, indice incompleto e dimensioni incoerenti", async (t) => {
  const { directory, metadata } = await fixtureIndex();
  t.after(() => rm(directory, { recursive: true, force: true }));
  const bytes = await readFile(join(directory, "vectors.f32"));
  assert.throws(() => validateSemanticIndex(metadata, bytes, { ...expected, corpusFingerprint: "b".repeat(64) }), /corpus fingerprint/u);
  assert.throws(() => validateSemanticIndex({ ...metadata, unitIds: [units[0].id, units[0].id] }, bytes, expected), /duplicato/u);
  assert.throws(() => validateSemanticIndex({ ...metadata, unitIds: [units[0].id, "unknown"] }, bytes, expected), /inesistente/u);
  assert.throws(() => validateSemanticIndex({ ...metadata, unitCount: 1, unitIds: [units[0].id] }, bytes, expected), /incompleto/u);
  assert.throws(() => validateSemanticIndex({ ...metadata, dimensions: 4 }, bytes, expected), /dimensione binaria/u);
  assert.throws(() => validateSemanticIndex({ ...metadata, embeddingModel: "" }, bytes, expected), /modello embedding/u);
  assert.throws(() => validateSemanticIndex({ ...metadata, parameters: undefined }, bytes, expected), /parametri embedding/u);
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
  await assert.rejects(generateSemanticIndex({ units, corpusFingerprint, outputDirectory: directory,
    provider: { describe: description, embed: async () => [[1, 2]] } }), /numero di embedding|dimensione vettore/u);
  await assert.rejects(generateSemanticIndex({ units, corpusFingerprint, outputDirectory: directory,
    provider: { describe: description, embed: async (texts) => texts.map(() => [1, 2]) } }), /dimensione vettore/u);
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
  assert.deepEqual(await adapter.embed(["fixture text"]), [[1, 2, 3]]);
  assert.equal(requests[0].url, "http://127.0.0.1:11434/api/tags");
  assert.equal(requests[1].url, "http://127.0.0.1:11434/api/embed");
  assert.deepEqual(JSON.parse(requests[1].init.body), { model: "fixture:1", input: ["fixture text"], truncate: false, dimensions: 3 });
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
