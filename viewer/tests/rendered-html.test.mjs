import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

async function dataJson(path) {
  return JSON.parse(
    await readFile(new URL(`../public${path}`, import.meta.url), "utf8"),
  );
}

test("renderizza le tre modalità e distingue release da validazione", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/iu);
  const html = await response.text();
  assert.match(html, /<title>Structural Codes — Corpus normativo verificabile<\/title>/iu);
  assert.match(html, /NTC 2018 \+ Circolare/);
  assert.match(html, /Circolare 7\/2019/);
  assert.match(html, /Prerelease alpha · corpus non validato/);
  assert.match(html, /pubblicazione npm non equivale a validazione normativa/iu);
  assert.match(html, /Piano di chiusura/);
  assert.doesNotMatch(html, /Accetta il blocco|Richiede correzione/);
});

test("gli artefatti lazy coincidono con corpus, asset e relazioni canonici", async () => {
  const manifest = await dataJson("/data/codes/manifest.json");
  assert.equal(manifest.formatVersion, 2);
  assert.equal(manifest.structuralCodesVersion, "0.1.0-alpha.1");
  assert.equal(manifest.schemaVersion, "2.0.0-alpha.2");
  assert.equal(manifest.stats.units, 1745);
  assert.equal(manifest.stats.blocks, 10951);
  assert.equal(manifest.stats.explicitRelations, 302);
  assert.equal(manifest.stats.suggestedRelationDiagnostics, 233);
  assert.equal(manifest.stats.reviewedUnits, 104);
  assert.equal(manifest.stats.assetUnits, 436);
  assert.equal(manifest.stats.formulas, 889);
  assert.equal(manifest.stats.tables, 219);
  assert.equal(manifest.stats.figures, 205);
  assert.ok(Buffer.byteLength(JSON.stringify(manifest)) < 75_000);

  const indexes = await Promise.all([
    dataJson(manifest.documents.ntc2018.indexPath),
    dataJson(manifest.documents.circ2019.indexPath),
  ]);
  assert.deepEqual(indexes.map(({ units }) => units.length), [1055, 690]);
  const summaries = indexes.flatMap(({ units }) => units);
  const chunkPaths = [...new Set(summaries.map(({ chunkPath }) => chunkPath))];
  assert.equal(chunkPaths.length, manifest.stats.chunks);

  const chunks = new Map(
    await Promise.all(
      chunkPaths.map(async (path) => {
        const bytes = await readFile(new URL(`../public${path}`, import.meta.url));
        assert.ok(bytes.length <= 1_500_000, `${path} supera la soglia di chunk`);
        return [path, JSON.parse(bytes.toString("utf8"))];
      }),
    ),
  );
  for (const summary of summaries) {
    const chunk = chunks.get(summary.chunkPath);
    assert.ok(chunk?.units.some((unit) => unit.id === summary.id));
  }
  const units = [...chunks.values()].flatMap(({ units }) => units);
  assert.equal(units.length, 1745);
  assert.equal(
    units.every((unit) => unit.workflow.status === "extracted" || unit.workflow.status === "source-checked"),
    true,
  );
  const expectedReviewedUnitIds = [
      "urn:structural-codes:it:unit:ntc2018:1",
      "urn:structural-codes:it:unit:ntc2018:1.1",
      "urn:structural-codes:it:unit:ntc2018:2",
      "urn:structural-codes:it:unit:ntc2018:2.1",
      "urn:structural-codes:it:unit:ntc2018:2.2",
      "urn:structural-codes:it:unit:ntc2018:2.2.1",
      "urn:structural-codes:it:unit:ntc2018:2.2.2",
      "urn:structural-codes:it:unit:ntc2018:2.2.3",
      "urn:structural-codes:it:unit:ntc2018:2.2.4",
      "urn:structural-codes:it:unit:ntc2018:2.2.5",
      "urn:structural-codes:it:unit:ntc2018:2.2.6",
      "urn:structural-codes:it:unit:ntc2018:2.3",
      "urn:structural-codes:it:unit:ntc2018:2.4",
      "urn:structural-codes:it:unit:ntc2018:2.4.1",
      "urn:structural-codes:it:unit:ntc2018:2.4.2",
      "urn:structural-codes:it:unit:ntc2018:2.4.3",
      "urn:structural-codes:it:unit:ntc2018:2.5",
      "urn:structural-codes:it:unit:ntc2018:2.5.1",
      "urn:structural-codes:it:unit:ntc2018:2.5.1.1",
      "urn:structural-codes:it:unit:ntc2018:2.5.1.2",
      "urn:structural-codes:it:unit:ntc2018:2.5.1.3",
      "urn:structural-codes:it:unit:ntc2018:2.5.2",
      "urn:structural-codes:it:unit:ntc2018:2.5.3",
      "urn:structural-codes:it:unit:ntc2018:2.6",
      "urn:structural-codes:it:unit:ntc2018:2.6.1",
      "urn:structural-codes:it:unit:ntc2018:2.6.2",
      "urn:structural-codes:it:unit:ntc2018:4.1",
    ].concat(units.filter((unit) => unit.id.startsWith("urn:structural-codes:it:unit:ntc2018:3")).map((unit) => unit.id));
  assert.equal(expectedReviewedUnitIds.length, 104);
  assert.deepEqual(
    units.filter((unit) => unit.workflow.status === "source-checked").map((unit) => unit.id).sort(),
    expectedReviewedUnitIds.sort(),
  );

  const assets = { formulas: new Map(), tables: new Map(), figures: new Map() };
  for (const chunk of chunks.values()) {
    for (const kind of Object.keys(assets)) {
      for (const asset of Object.values(chunk.assets[kind])) assets[kind].set(asset.id, asset);
    }
  }
  assert.deepEqual(
    Object.fromEntries(Object.entries(assets).map(([kind, values]) => [kind, values.size])),
    { formulas: 889, tables: 219, figures: 205 },
  );

  const relations = await dataJson(manifest.relationsPath);
  assert.equal(relations.sourceOfTruth, "explicit-corpus-relations");
  assert.equal(relations.inferredRelationsIncluded, false);
  assert.equal(relations.relations.length, 302);
  assert.equal(relations.relations.every(({ review }) => review.status === "proposed"), true);
  const unitIds = new Set(units.map(({ id }) => id));
  assert.equal(relations.relations.every(({ sourceUnitId, targetUnitId }) => unitIds.has(sourceUnitId) && unitIds.has(targetUnitId)), true);

  const diagnostics = await dataJson(manifest.relationDiagnosticsPath);
  assert.equal(diagnostics.suggestions.length, 233);
  assert.equal(diagnostics.suggestions.every(({ status }) => status === "diagnostic-only-not-canonical"), true);

  for (const figure of assets.figures.values()) {
    const image = await readFile(new URL(`../public/assets/${figure.imagePath}`, import.meta.url));
    assert.equal(createHash("sha256").update(image).digest("hex"), figure.sha256);
  }

  await assert.rejects(readFile(new URL("../public/data/corpus.json", import.meta.url)));
});
