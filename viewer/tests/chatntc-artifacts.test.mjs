import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createArtifactRepository, createViewerArtifactRepository } from "structural-codes-viewer/chatntc/viewer-artifacts";
import { citationForEvidence, retrieveChatNTCEvidence, validateChatNTCResponse } from "structural-codes-viewer/chatntc";

const read = async (path) => JSON.parse(await readFile(new URL(`../public${path}`, import.meta.url), "utf8"));
const loader = {
  manifest: () => read("/data/codes/manifest.json"),
  documentIndex: (manifest, document) => read(manifest.documents[document].indexPath),
  chunk: read,
  searchIndex: (manifest) => read(manifest.searchIndexPath),
  crossReferenceIndex: (manifest) => read(manifest.crossReferenceIndexPath),
  relations: (manifest) => read(manifest.relationsPath),
};

test("artefatti reali: exact NTC/Circolare, full-text e provenienza del pacchetto", async () => {
  const repository = createArtifactRepository(loader);
  for (const [query, document, numbering] of [["§7.3.6.1", "ntc2018", "7.3.6.1"], ["C7.3.6.1", "circ2019", "C7.3.6.1"]]) {
    const evidence = await retrieveChatNTCEvidence(repository, query, { maxRelatedUnits: 0 });
    const unit = evidence.primaryUnits[0];
    assert.equal(unit.document, document);
    assert.equal(unit.numbering, numbering);
    assert.ok(unit.blocks.length);
    assert.match(evidence.corpus.fingerprint, /^[a-f0-9]{64}$/);
    assert.match(evidence.corpus.documents[document].sourceSha256, /^[a-f0-9]{64}$/);
    const response = { formatVersion: 1, evidencePackageId: evidence.packageId, answer: "Riferimento individuato.", classification: "direct-reference", claims: [{ id: "lookup", text: "Riferimento individuato.", classification: "direct-reference", citations: [citationForEvidence(evidence, unit.evidenceId)] }], usedEvidenceIds: [unit.evidenceId], warnings: [], needsMoreEvidence: false, externalResearchSuggested: false };
    assert.deepEqual(await validateChatNTCResponse(response, evidence, repository), { valid: true, issues: [] });
  }
  const fullText = await retrieveChatNTCEvidence(repository, "azione sismica", { maxPrimaryUnits: 5, maxRelatedUnits: 0 });
  assert.ok(fullText.primaryUnits.length);
  assert.ok(fullText.primaryUnits.some((unit) => unit.reasons.some((reason) => reason.kind === "full-text")));
});

test("artefatti reali: asset indicizzati e relazioni esplicite, nessuna uguaglianza numerica inferita", async () => {
  const repository = createArtifactRepository(loader);
  const manifest = await loader.manifest();
  const crossReferences = await loader.crossReferenceIndex(manifest);
  for (const kind of ["formula", "table", "figure"]) {
    const asset = crossReferences.assets.find((entry) => entry.kind === kind);
    const query = `${kind === "table" ? "Tab." : kind === "figure" ? "Fig." : "formula"} ${asset.officialNumber}`;
    assert.equal((await repository.resolveExact(query))[0].assetId, asset.id);
  }
  const relations = await loader.relations(manifest);
  const edge = relations.relations.find((entry) => entry.review.status !== "rejected");
  const target = crossReferences.units.find((unit) => unit.id === edge.targetUnitId);
  const evidence = await retrieveChatNTCEvidence(repository, target.numbering, { maxUnitCharacters: 30_000, maxEvidenceCharacters: 100_000 });
  const related = evidence.relatedUnits.find((unit) => unit.unitId === edge.sourceUnitId);
  assert.ok(related);
  assert.ok(related.reasons.some((reason) => reason.relationId === edge.relationId && reason.reviewStatus === edge.review.status));
  const links = await repository.related("urn:structural-codes:it:unit:ntc2018:7.3.6.1");
  assert.equal(links.some((link) => link.kind === "explicit-relation" && link.unitId === "urn:structural-codes:it:unit:circ2019:c7.3.6.1"), false);
  assert.ok(links.some((link) => link.kind === "cross-reference"));
});

test("artefatti reali: formula 7.3.8 è risolvibile anche senza backlink", async () => {
  const repository = createArtifactRepository(loader);
  for (const query of ["[7.3.8]", "formula [7.3.8]"]) {
    const targets = await repository.resolveExact(query);
    assert.equal(targets.length, 1);
    assert.equal(targets[0].unitId, "urn:structural-codes:it:unit:ntc2018:7.3.3.3");
    assert.equal(targets[0].assetId, "urn:structural-codes:it:asset:formula:ntc2018:7.3.3.3-7.3.8");
  }
});

test("adapter viewer usa loader/cache esistenti; exact lookup non scarica full-text né chunk", async (t) => {
  const paths = [];
  t.mock.method(globalThis, "fetch", async (url) => {
    const path = new URL(url).pathname;
    paths.push(path);
    return { ok: true, json: () => read(path) };
  });
  const repository = createViewerArtifactRepository("https://chatntc-cache.test/data/codes");
  await repository.resolveExact("7.3.6.1");
  await repository.resolveExact("§7.3.6.1");
  const second = createViewerArtifactRepository("https://chatntc-cache.test/data/codes");
  await second.resolveExact("7.3.6.1");
  assert.equal(paths.filter((path) => path === "/data/codes/manifest.json").length, 1);
  assert.equal(paths.filter((path) => path === "/data/codes/ntc2018/index.json").length, 1);
  assert.equal(paths.some((path) => path.includes("chunks") || path.includes("search-index")), false);
});

test("entry point compilato è riusabile da Node e non importa React, DOM, HTTP o provider", async () => {
  const seen = new Set();
  async function visit(url) {
    if (seen.has(url.href)) return;
    seen.add(url.href);
    const code = await readFile(url, "utf8");
    assert.doesNotMatch(code, /from\s+["'](?:react|react-dom|openai|@anthropic-ai|@google\/)/);
    assert.doesNotMatch(code, /\b(?:fetch\(|window\.|document\.|localStorage\.|sessionStorage\.)/);
    for (const match of code.matchAll(/(?:from\s+|import\s*)["'](\.[^"']+)["']/g)) await visit(new URL(match[1], url));
  }
  await visit(new URL("../package-dist/chatntc/index.js", import.meta.url));
  assert.ok(seen.size >= 7);
  assert.equal([...seen].some((path) => path.endsWith("viewerArtifacts.js") || path.endsWith("corpusData.js")), false);
  const pkg = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  for (const key of ["./chatntc", "./chatntc/viewer-artifacts"]) {
    assert.ok((await readFile(new URL(`../${pkg.exports[key].types}`, import.meta.url), "utf8")).length);
  }
});
