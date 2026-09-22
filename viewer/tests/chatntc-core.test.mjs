import assert from "node:assert/strict";
import test from "node:test";
import { createArtifactRepository } from "structural-codes-viewer/chatntc/viewer-artifacts";
import { CHATNTC_EPISTEMIC_POLICY, canonicalizeChatNTCResponse, citationForEvidence, retrieveChatNTCEvidence, validateChatNTCResponse, viewerTargetForCitation } from "structural-codes-viewer/chatntc";
import { buildSearchIndexPayload } from "../shared/searchEngine.js";
import { buildCrossReferenceIndexPayload } from "../shared/crossReferences.js";
import { evidencePackageId } from "../package-dist/chatntc/evidence.js";
import { urlForViewerTarget, targetFromUrl } from "../package-dist/permalinks.js";

// Entirely synthetic software fixtures, not transcriptions or normative assertions.
const id = (number, document = "ntc2018") => `urn:structural-codes:it:unit:${document}:${number.toLowerCase()}`;
const NTC = id("7.3.6.1");
const CIRC = id("C7.3.6.1", "circ2019");
const OTHER = id("8.1.1");
const PARENT = id("7.3.6");
const CHILD = id("7.3.6.1.1");
const aid = (kind) => `urn:structural-codes:it:asset:${kind}:ntc2018:fixture`;
const source = { sourceId: "fixture-source", sourceUrl: "https://example.test/fixture.pdf", sourceSha256: "a".repeat(64), publicationUrl: "https://example.test/fixture", shortLabel: "Fixture" };

function fixture() {
  const units = [];
  function unit(number, text, parentId = null, document = "ntc2018") {
    const unitId = id(number, document);
    const parent = parentId ? units.find((candidate) => candidate.id === parentId) : null;
    const ancestorIds = parent ? [...parent.hierarchy.ancestorIds, parentId] : parentId ? [parentId] : [];
    const block = (suffix, value, kind = "paragraph") => ({
      blockId: `${unitId}#block-${suffix}`, kind, origin: "official",
      text: { raw: `RAW ${value}`, normalized: value, normalizationVersion: "fixture-v1" },
      evidence: { sourceId: source.sourceId, pdfPage: 1, printedPage: "1", region: null, normalizedSha256: "b".repeat(64), rawSha256: "c".repeat(64) },
    });
    const entry = { id: unitId, document, kind: "paragraph", title: `Fixture ${number}`,
      numbering: { official: number, sortKey: number.replace(/^C/, "").split(".").map((n) => n.padStart(3, "0")).join(".") },
      titleBlockId: `${unitId}#block-heading`, hierarchy: { parentId, ancestorIds, position: 1 },
      validity: { from: null, to: null, status: "unknown", asOf: "2026-01-01" },
      blocks: [block("heading", `Fixture ${number}`, "heading"), ...(text ? [block("p1", text)] : [])], relations: [],
      review: { status: "verified" } };
    units.push(entry);
    return entry;
  }
  unit("7.3.6", "");
  const ntc = unit("7.3.6.1", "Fixture resistenza laterale, vedere §8.1.1; Tab. 7.3.I, formula [7.3.1], Fig. 7.3.1.", PARENT);
  ntc.blocks[1].text.inline = [{ kind: "text", value: "Fixture " }, { kind: "math", value: "fcd", latex: "f_{cd}" }];
  unit("7.3.6.1.1", "Fixture figlio.", NTC);
  unit("8.1.1", "Fixture rimando.");
  const circ = unit("C7.3.6.1", "Fixture commento.", null, "circ2019");
  unit("C8.1.1", "Fixture stessa numerazione, senza relazione.", null, "circ2019");
  circ.relations.push({ relationId: `${CIRC}#relation-001`, type: "clarifies", targetUnitId: NTC, basis: "textual", evidenceBlockIds: [circ.blocks[1].blockId], rationale: "Fixture esplicita", review: { status: "proposed" } });
  const assets = {
    formulas: { [aid("formula")]: { id: aid("formula"), unitId: NTC, officialNumber: "7.3.1", pdfPage: 1, latex: "x = y" } },
    tables: { [aid("table")]: { id: aid("table"), unitId: NTC, officialNumber: "7.3.I", pdfPage: 1, caption: "Fixture tabella", columnCount: 2, headers: [[{ text: "Fixture", colSpan: 2 }]], rows: [[{ text: "x", latex: "x_1", rowSpan: 2 }, { text: "1" }], [{ text: "2" }]], notes: ["Fixture nota"] } },
    figures: { [aid("figure")]: { id: aid("figure"), unitId: NTC, officialNumber: "7.3.1", pdfPage: 1, caption: "Fixture figura", alt: "Fixture", imagePath: "figures/ntc2018/fixture.png", sha256: "d".repeat(64) } },
  };
  for (const kind of ["formula", "table", "figure"]) ntc.blocks.push({ blockId: `${NTC}#block-${kind}`, kind: `${kind}-ref`, origin: "official", assetId: aid(kind) });
  const path = (document) => `/data/codes/${document}/chunks/fixture.json`;
  const indexes = Object.fromEntries(["ntc2018", "circ2019"].map((document) => [document, { formatVersion: 2, document, units: units.filter((u) => u.document === document).map((u) => ({ ...u, chunkPath: path(document) })) }]));
  const manifest = { formatVersion: 2, structuralCodesVersion: "fixture-v1", schemaVersion: "fixture-unit-v1", assetSchemaVersion: "fixture-asset-v1", status: "fixture", disclaimer: "Synthetic fixture; not normative.", corpusFingerprintSha256: "a".repeat(64), generatedArtifactFingerprintSha256: "b".repeat(64), documents: { ntc2018: source, circ2019: source }, chunks: ["ntc2018", "circ2019"].map((document) => ({ path: path(document), contentFingerprintSha256: "c".repeat(64) })) };
  const calls = [];
  const loader = {
    manifest: async () => manifest,
    documentIndex: async (_manifest, document) => { calls.push(`index:${document}`); return indexes[document]; },
    chunk: async (chunkPath) => { calls.push(`chunk:${chunkPath}`); const document = chunkPath.includes("circ2019") ? "circ2019" : "ntc2018"; return { formatVersion: 2, document, units: units.filter((u) => u.document === document), assets, contentFingerprintSha256: "c".repeat(64) }; },
    searchIndex: async () => { calls.push("search"); return buildSearchIndexPayload(units.map((u) => ({ id: u.id, document: u.document, numbering: u.numbering.official, title: u.title, chunkPath: path(u.document), text: u.blocks.map((b) => b.text?.normalized ?? "").join(" ") }))); },
    crossReferenceIndex: async () => { calls.push("cross-references"); return buildCrossReferenceIndexPayload({ units, assetCollections: Object.fromEntries(Object.entries(assets).map(([key, value]) => [key, Object.values(value)])) }); },
    relations: async () => ({ formatVersion: 2, sourceOfTruth: "explicit-corpus-relations", inferredRelationsIncluded: false, relations: units.flatMap((u) => u.relations.map((r) => ({ ...r, sourceUnitId: u.id, sourceDocument: u.document }))) }),
  };
  return { repository: createArtifactRepository(loader), calls, units, assets, manifest, loader };
}

const isolated = { maxRelatedUnits: 0, maxUnitCharacters: 40_000 };
function responseFor(evidence, evidenceId = evidence.primaryUnits[0]?.evidenceId) {
  return { formatVersion: 1, evidencePackageId: evidence.packageId, answer: "Risposta fixture.", classification: "direct-reference",
    claims: [{ id: "claim-1", text: "Claim fixture.", classification: "direct-reference", citations: [citationForEvidence(evidence, evidenceId)] }],
    usedEvidenceIds: [evidenceId], warnings: [], needsMoreEvidence: false, externalResearchSuggested: false };
}
function abstention(evidence) {
  return { formatVersion: 1, evidencePackageId: evidence.packageId, answer: "Evidence insufficiente per rispondere.", classification: "no-direct-reference", claims: [], usedEvidenceIds: [], warnings: [], needsMoreEvidence: true, externalResearchSuggested: true };
}
async function context(query = "7.3.6.1", options = isolated) {
  const fixtureData = fixture();
  const evidence = await retrieveChatNTCEvidence(fixtureData.repository, query, options);
  return { ...fixtureData, evidence, response: responseFor(evidence) };
}
const has = (result, code) => { assert.equal(result.valid, false, JSON.stringify(result)); assert.ok(result.issues.some((issue) => issue.code === code), JSON.stringify(result)); };

test("exact NTC, §, Circolare e asset usano lookup esistenti senza full-text", async () => {
  const { repository, calls } = fixture();
  for (const query of ["7.3.6.1", "§7.3.6.1"]) assert.equal((await repository.resolveExact(query))[0].unitId, NTC);
  assert.equal((await repository.resolveExact("C7.3.6.1"))[0].unitId, CIRC);
  assert.deepEqual(await repository.resolveExact("C7.3.6.1", "ntc2018"), []);
  for (const [query, kind] of [["Tab. 7.3.I", "table"], ["formula [7.3.1]", "formula"], ["Fig. 7.3.1", "figure"]]) {
    const target = (await repository.resolveExact(query))[0];
    assert.equal(target.assetId, aid(kind));
    assert.equal(target.blockId, `${NTC}#block-${kind}`);
    const evidence = await retrieveChatNTCEvidence(repository, query, isolated);
    assert.ok(evidence.primaryUnits[0].blocks.some((block) => block.assetId === aid(kind)));
  }
  assert.equal((await repository.resolveExact("Tab.7.3.I"))[0].assetId, aid("table"));
  assert.equal(calls.includes("search"), false);
  assert.equal(calls.some((call) => call.includes("circ2019/chunks")), false);
});

test("full-text e riferimenti dentro una domanda riusano il motore", async () => {
  const { repository, calls } = fixture();
  const evidence = await retrieveChatNTCEvidence(repository, "resistenza laterale", isolated);
  assert.equal(evidence.primaryUnits[0].unitId, NTC);
  assert.equal(evidence.primaryUnits[0].reasons[0].kind, "full-text");
  assert.equal(calls.filter((call) => call === "search").length, 1);
  const embedded = await retrieveChatNTCEvidence(repository, "Consulta §7.3.6.1 e C7.3.6.1", isolated);
  assert.deepEqual(new Set(embedded.primaryUnits.slice(0, 2).map((unit) => unit.unitId)), new Set([NTC, CIRC]));
});

test("espansione NTC↔Circolare esplicita con stato proposed e opt-out", async () => {
  const { repository } = fixture();
  const evidence = await retrieveChatNTCEvidence(repository, "7.3.6.1");
  const circ = evidence.relatedUnits.find((unit) => unit.unitId === CIRC);
  assert.equal(circ.reasons[0].kind, "explicit-relation");
  assert.equal(circ.reasons[0].reviewStatus, "proposed");
  assert.equal(evidence.warnings.some((warning) => warning.code === "proposed-relation"), false);
  const reverse = await retrieveChatNTCEvidence(repository, "C7.3.6.1");
  assert.ok(reverse.relatedUnits.some((unit) => unit.unitId === NTC && unit.reasons.some((reason) => reason.kind === "explicit-relation")));
  const confirmedOnly = await retrieveChatNTCEvidence(repository, "7.3.6.1", { includeProposedRelations: false });
  assert.equal(confirmedOnly.relatedUnits.some((unit) => unit.unitId === CIRC), false);
  const unrelated = await retrieveChatNTCEvidence(repository, "8.1.1");
  assert.equal(unrelated.relatedUnits.some((unit) => unit.unitId === id("C8.1.1", "circ2019")), false);
});

test("espansione parent, children e rimandi conserva la provenienza senza cicli", async () => {
  const { repository } = fixture();
  const evidence = await retrieveChatNTCEvidence(repository, "7.3.6.1");
  for (const [unitId, kind] of [[PARENT, "parent"], [CHILD, "child"], [OTHER, "cross-reference"]]) {
    assert.ok(evidence.relatedUnits.some((unit) => unit.unitId === unitId && unit.reasons.some((reason) => reason.kind === kind)));
  }
  const reference = evidence.relatedUnits.find((unit) => unit.unitId === OTHER).reasons[0];
  assert.equal(reference.sourceBlockId, `${NTC}#block-p1`);
  assert.equal(new Set([...evidence.primaryUnits, ...evidence.relatedUnits].map((unit) => unit.unitId)).size, 5);
});

test("breadcrumb canonico è presente per primary e related fino al parent immediato", async () => {
  const { repository } = fixture();
  const evidence = await retrieveChatNTCEvidence(repository, "7.3.6.1");
  assert.deepEqual(evidence.primaryUnits[0].hierarchy,
    [{ numbering: "7.3.6", title: "Fixture 7.3.6" }]);
  const child = evidence.relatedUnits.find((unit) => unit.unitId === CHILD);
  assert.deepEqual(child.hierarchy, [
    { numbering: "7.3.6", title: "Fixture 7.3.6" },
    { numbering: "7.3.6.1", title: "Fixture 7.3.6.1" },
  ]);
  assert.ok([...evidence.primaryUnits, ...evidence.relatedUnits]
    .every((unit) => Array.isArray(unit.hierarchy)));
});

test("il filtro documento si applica prima del limite alle unità correlate", async () => {
  const { repository } = fixture();
  const evidence = await retrieveChatNTCEvidence(repository, "7.3.6.1", { document: "ntc2018", maxRelatedUnits: 1 });
  assert.equal(evidence.relatedUnits.length, 1);
  assert.equal(evidence.relatedUnits[0].unitId, OTHER);
  assert.equal(evidence.relatedUnits[0].document, "ntc2018");
});

test("un target di asset incoerente nell'indice interrompe il retrieval", async () => {
  const { repository } = fixture();
  const wrongIndex = { ...repository, resolveExact: async () => [{ unitId: NTC, blockId: `${NTC}#block-p1`, assetId: aid("table"), score: 4_000_000, match: "exact-reference" }] };
  await assert.rejects(retrieveChatNTCEvidence(wrongIndex, "Tab. 7.3.I", isolated), /target del rimando incoerente/);
});

test("pacchetto deterministico anche con ordine dei candidati invertito e cache fredda", async () => {
  const { repository } = fixture();
  const first = await retrieveChatNTCEvidence(repository, "7.3.6.1");
  const second = await retrieveChatNTCEvidence(repository, "7.3.6.1");
  const cold = fixture().repository;
  const reversed = { ...cold, related: async (unitId) => (await cold.related(unitId)).reverse() };
  assert.deepEqual(first, second);
  assert.deepEqual(first, await retrieveChatNTCEvidence(reversed, "7.3.6.1"));
  assert.match(first.packageId, /^chatntc:v1:[a-f0-9]{64}$/);
  assert.notEqual(first.packageId, (await retrieveChatNTCEvidence(repository, "§7.3.6.1")).packageId);
});

test("evidence preserva matematica, celle unite, hash, review e separa metadati figura", async () => {
  const { evidence, units } = await context();
  const unit = evidence.primaryUnits[0];
  assert.deepEqual(unit.blocks[1].text.inline, units.find((u) => u.id === NTC).blocks[1].text.inline);
  assert.equal(unit.blocks.find((block) => block.asset?.kind === "formula").asset.data.latex, "x = y");
  const table = unit.blocks.find((block) => block.asset?.kind === "table").asset.data;
  assert.equal(table.headers[0][0].colSpan, 2);
  assert.equal(table.rows[0][0].rowSpan, 2);
  const figure = unit.blocks.find((block) => block.asset?.kind === "figure").asset;
  assert.equal(figure.contentAvailability, "metadata-only");
  assert.equal(figure.data.sha256, "d".repeat(64));
  assert.equal(unit.editorial.status, "verified");
  assert.doesNotMatch(JSON.stringify(evidence), /private fixture|"raw"|rawSha256|createdBy|reviewer/);
  unit.blocks[1].text.inline[1].latex = "changed";
  assert.equal(units.find((u) => u.id === NTC).blocks[1].text.inline[1].latex, "f_{cd}");
});

test("budget conta anche metadati e asset, omette blocchi interi e dichiara riduzioni", async () => {
  const { repository, evidence } = await context();
  const limit = Math.floor(evidence.retrieval.evidenceCharacters * 0.7);
  const reduced = await retrieveChatNTCEvidence(repository, "Tab. 7.3.I", { ...isolated, maxUnitCharacters: limit, maxEvidenceCharacters: limit });
  assert.ok(reduced.retrieval.evidenceCharacters <= limit);
  assert.equal(reduced.retrieval.reduced, true);
  assert.ok(reduced.primaryUnits[0].blocks.some((block) => block.assetId === aid("table")));
  const selectionCharacters = [...reduced.primaryUnits, ...reduced.relatedUnits]
    .reduce((sum, unit) => { const budgeted = { ...unit }; Reflect.deleteProperty(budgeted, "hierarchy"); return sum + JSON.stringify(budgeted).length; }, 0);
  assert.equal(reduced.retrieval.evidenceCharacters, selectionCharacters);
  for (const block of reduced.primaryUnits[0].blocks) assert.deepEqual(block, evidence.primaryUnits[0].blocks.find((full) => full.blockId === block.blockId));
  assert.equal((await validateChatNTCResponse(responseFor(reduced), reduced, repository)).valid, true);
  const empty = await retrieveChatNTCEvidence(repository, "7.3.6.1", { maxEvidenceCharacters: 1 });
  assert.equal(empty.primaryUnits.length, 0);
  assert.equal(empty.relatedUnits.length, 0);
  assert.ok(empty.warnings.some((warning) => warning.code === "no-evidence"));
});

test("citazioni valide di unità, blocco, formula, tabella e figura; permalink condiviso", async () => {
  const { evidence, repository } = await context();
  for (const evidenceId of [NTC, ...evidence.primaryUnits[0].blocks.map((block) => block.evidenceId)]) {
    const response = responseFor(evidence, evidenceId);
    assert.deepEqual(await validateChatNTCResponse(response, evidence, repository), { valid: true, issues: [] });
    const target = viewerTargetForCitation(response.claims[0].citations[0]);
    assert.deepEqual(targetFromUrl(urlForViewerTarget("https://example.test/viewer", "ntc", "combined", target)), target);
  }
});

for (const [name, mutate, code] of [
  ["unità inesistente", (r) => { r.claims[0].citations[0].unitId = id("7.99.4"); r.claims[0].citations[0].numbering = "7.99.4"; }, "unknown-unit"],
  ["unità esistente esclusa dall'evidence", (r) => { r.claims[0].citations[0] = { evidenceId: OTHER, unitId: OTHER, document: "ntc2018", numbering: "8.1.1" }; r.usedEvidenceIds = [OTHER]; }, "evidence-not-selected"],
  ["blockId inesistente", (r) => { r.claims[0].citations[0].blockId = `${NTC}#block-missing`; }, "unknown-block"],
  ["assetId inesistente", (r) => { r.claims[0].citations[0].assetId = "missing"; }, "unknown-asset"],
  ["documento errato", (r) => { r.claims[0].citations[0].document = "circ2019"; }, "citation-identity-mismatch"],
  ["numbering errato", (r) => { r.claims[0].citations[0].numbering = "7.99.4"; }, "citation-identity-mismatch"],
  ["target diverso per la stessa evidence", (r) => { r.claims[0].citations[0].unitId = OTHER; r.claims[0].citations[0].numbering = "8.1.1"; }, "citation-target-mismatch"],
  ["duplicazione incoerente", (r) => { r.claims[0].citations.push({ ...r.claims[0].citations[0], document: "circ2019" }); }, "duplicate-citation"],
  ["evidence utilizzate non corrispondenti", (r) => { r.usedEvidenceIds = []; }, "used-evidence-mismatch"],
  ["claim senza citazioni", (r) => { r.claims[0].citations = []; r.usedEvidenceIds = []; }, "uncovered-claim"],
  ["claim duplicato", (r) => { r.claims.push(structuredClone(r.claims[0])); }, "duplicate-claim"],
  ["pacchetto diverso", (r) => { r.evidencePackageId = "wrong"; }, "wrong-package"],
  ["citazione inventata solo nella prosa", (r) => { r.answer = "NTC 2018 §7.99.4"; }, "unresolved-reference"],
  ["interpretazione non dichiarata", (r) => { r.claims[0].classification = "interpretation"; }, "interpretation-not-declared"],
  ["fonte esterna non supportata", (r) => { r.classification = "external-source"; }, "external-source-disabled"],
]) test(`validator rifiuta ${name}`, async () => {
  const { evidence, repository, response } = await context();
  mutate(response);
  has(await validateChatNTCResponse(response, evidence, repository), code);
});

test("asset citato deve coincidere con blocco e numero ufficiale", async () => {
  const { evidence, repository } = await context();
  const response = responseFor(evidence, `${NTC}#block-table`);
  response.claims[0].citations[0].blockId = `${NTC}#block-formula`;
  response.claims[0].citations[0].assetNumber = "7.99.I";
  const result = await validateChatNTCResponse(response, evidence, repository);
  has(result, "asset-block-mismatch");
  has(result, "asset-number-mismatch");
});

test("blocco esistente ma omesso dal budget non diventa citabile tramite la sua unità", async () => {
  const { repository, evidence: full } = await context();
  const evidence = await retrieveChatNTCEvidence(repository, "7.3.6.1", { ...isolated, maxUnitCharacters: 2500 });
  const omitted = full.primaryUnits[0].blocks.find((block) => !evidence.primaryUnits[0].blocks.some((b) => b.blockId === block.blockId));
  assert.ok(omitted);
  const response = responseFor(evidence);
  response.claims[0].citations[0] = citationForEvidence(full, omitted.evidenceId);
  response.usedEvidenceIds = [omitted.evidenceId];
  has(await validateChatNTCResponse(response, evidence, repository), "evidence-not-selected");
});

test("astensione senza false citazioni; evidence e ricerca esterna possono essere richieste", async () => {
  const { repository } = fixture();
  const evidence = await retrieveChatNTCEvidence(repository, "7.99.4");
  assert.equal(evidence.primaryUnits.length, 0);
  const response = abstention(evidence);
  assert.deepEqual(await validateChatNTCResponse(response, evidence, repository), { valid: true, issues: [] });
  response.answer = "NTC 2018 §7.99.4";
  has(await validateChatNTCResponse(response, evidence, repository), "unresolved-reference");
  const valid = await context();
  const falseAbstention = { ...valid.response, classification: "no-direct-reference", needsMoreEvidence: true };
  has(await validateChatNTCResponse(falseAbstention, valid.evidence, valid.repository), "abstention-with-citations");
});

test("combined-reference e interpretation sono contratti distinti", async () => {
  const { evidence, repository, response } = await context();
  response.classification = "combined-reference";
  response.claims[0].classification = "combined-reference";
  has(await validateChatNTCResponse(response, evidence, repository), "insufficient-combined-evidence");
  response.claims[0].citations.push(citationForEvidence(evidence, `${NTC}#block-p1`));
  response.usedEvidenceIds.push(`${NTC}#block-p1`);
  assert.equal((await validateChatNTCResponse(response, evidence, repository)).valid, true);
  response.classification = "interpretation";
  response.claims[0].classification = "interpretation";
  assert.equal((await validateChatNTCResponse(response, evidence, repository)).valid, true);
  assert.equal(CHATNTC_EPISTEMIC_POLICY.modelMemoryIsNormativeSource, false);
  assert.equal(CHATNTC_EPISTEMIC_POLICY.interpretationIsPrescription, false);
});

test("no-direct-reference descrive la natura della conclusione e non forza l'astensione", async () => {
  const { evidence, repository } = await context();
  const citation = citationForEvidence(evidence, evidence.primaryUnits[0].evidenceId);
  const response = {
    formatVersion: 2, evidencePackageId: evidence.packageId,
    answer: "La norma non formula direttamente la conclusione; dal quadro disponibile si ricava una lettura progettuale.",
    classification: "no-direct-reference", status: "answered",
    claims: [{ id: "claim-1", text: "Conclusione interpretativa basata sul quadro disponibile.", classification: "no-direct-reference", citations: [citation] }],
    usedEvidenceIds: [citation.evidenceId], warnings: [], needsMoreEvidence: false, externalResearchSuggested: false,
  };
  assert.deepEqual(await validateChatNTCResponse(response, evidence, repository), { valid: true, issues: [] });
});

test("status abstained resta riservato a evidence insufficiente", async () => {
  const { repository } = fixture();
  const evidence = await retrieveChatNTCEvidence(repository, "7.99.4");
  const response = { formatVersion: 2, evidencePackageId: evidence.packageId, answer: "Evidence insufficiente.",
    classification: "no-direct-reference", status: "abstained", claims: [], usedEvidenceIds: [], warnings: [],
    needsMoreEvidence: true, externalResearchSuggested: false };
  assert.deepEqual(await validateChatNTCResponse(response, evidence, repository), { valid: true, issues: [] });
});

test("mention canonica fuori evidence legacy non blocca, mentre un riferimento inesistente resta diagnosticato", async () => {
  const { evidence, repository, response } = await context();
  response.answer = "Si coordina con §8.1.1.";
  let result = await validateChatNTCResponse(response, evidence, repository);
  assert.equal(result.valid, true, JSON.stringify(result));
  response.answer = "Si coordina con §7.99.4.";
  result = await validateChatNTCResponse(response, evidence, repository);
  has(result, "unresolved-reference");
});

test("tutti i riferimenti espliciti correnti precedono ranking e budget delle unità full-text", async () => {
  const { repository } = fixture();
  const evidence = await retrieveChatNTCEvidence(repository, "Confronta §7.3.6.1 e §8.1.1", { ...isolated, maxPrimaryUnits: 1 });
  assert.deepEqual(new Set(evidence.primaryUnits.map((unit) => unit.unitId)), new Set([NTC, OTHER]));
});

function providerOutput(evidence, overrides = {}) {
  return { formatVersion: 2, evidencePackageId: evidence.packageId, answerMarkdown: "Risposta fixture.", references: [],
    classification: "direct-reference", status: "answered", needsMoreEvidence: false, externalResearchSuggested: false, ...overrides };
}

test("canonicalizzazione associa riferimenti espliciti già selezionati senza metadata duplicati", async () => {
  const { evidence, repository } = await context("Consulta §7.3.6.1 e §8.1.1", { ...isolated, maxPrimaryUnits: 2 });
  const output = providerOutput(evidence, { answerMarkdown: "Ai sensi del §7.3.6.1 e del §8.1.1 si ricava la conclusione.",
    references: ["NTC 2018 §7.3.6.1", "NTC 2018 §8.1.1"] });
  const canonical = await canonicalizeChatNTCResponse(output, evidence, repository);
  assert.deepEqual(canonical.issues, []);
  assert.equal(canonical.normalized, true);
  assert.equal(canonical.response.classification, "combined-reference");
  assert.deepEqual(new Set(canonical.response.verifiedReferences.map((reference) => reference.unitId)), new Set([NTC, OTHER]));
  assert.ok(canonical.response.verifiedReferences.every((reference) => !("evidenceId" in reference)));
  assert.deepEqual(await validateChatNTCResponse(canonical.response, evidence, repository), { valid: true, issues: [] });
});

test("canonicalizzazione deriva metadata senza claims o usedEvidenceIds", async () => {
  const { evidence, repository } = await context();
  const output = providerOutput(evidence, { classification: "interpretation",
    answerMarkdown: "Dal §7.3.6.1 si propone una lettura progettuale." });
  const canonical = await canonicalizeChatNTCResponse(output, evidence, repository);
  assert.equal(canonical.response.classification, "interpretation");
  assert.deepEqual(canonical.response.verifiedReferences.map((reference) => reference.unitId), [NTC]);
  assert.equal((await validateChatNTCResponse(canonical.response, evidence, repository)).valid, true);
});

test("canonicalizzazione segnala riferimenti inventati", async () => {
  const { evidence, repository } = await context();
  for (const output of [
    providerOutput(evidence, { answerMarkdown: "Riferimento §7.99.4." }),
    providerOutput(evidence, { answerMarkdown: "Riferimento formula [7.99.99]." }),
  ]) {
    const canonical = await canonicalizeChatNTCResponse(output, evidence, repository);
    assert.ok(canonical.issues.some((issue) => issue.category === "integrity"), JSON.stringify(canonical));
  }
});

test("canonicalizzazione deduplica occorrenze e citation canoniche ripetute", async () => {
  const { evidence, repository } = await context();
  const output = providerOutput(evidence, { answerMarkdown: "§7.3.6.1 si coordina con §7.3.6.1.",
    references: ["§7.3.6.1", "§7.3.6.1"] });
  const canonical = await canonicalizeChatNTCResponse(output, evidence, repository);
  assert.deepEqual(canonical.issues, []);
  assert.deepEqual(canonical.response.verifiedReferences.map((reference) => reference.unitId), [NTC]);
});

test("risposta progettuale generale è valida senza claims né riferimenti normativi", async () => {
  const { evidence, repository } = await context();
  const canonical = await canonicalizeChatNTCResponse(providerOutput(evidence, {
    answerMarkdown: "Dal punto di vista progettuale conviene controllare la sensibilità del modello.",
    classification: "no-direct-reference",
  }), evidence, repository);
  assert.deepEqual(canonical.response.verifiedReferences, []);
  assert.deepEqual(await validateChatNTCResponse(canonical.response, evidence, repository), { valid: true, issues: [] });
});

test("pacchetto alterato viene confrontato con corpus e fingerprint", async () => {
  const { evidence, repository, response } = await context();
  evidence.primaryUnits[0].blocks[1].text.normalized = "tampered";
  has(await validateChatNTCResponse(response, evidence, repository), "package-integrity");
  const body = { ...evidence };
  delete body.packageId;
  evidence.packageId = await evidencePackageId(body);
  response.evidencePackageId = evidence.packageId;
  has(await validateChatNTCResponse(response, evidence, repository), "evidence-content-mismatch");
  evidence.primaryUnits[0].hierarchy[0].title = "Scope alterato";
  const hierarchyBody = { ...evidence };
  delete hierarchyBody.packageId;
  evidence.packageId = await evidencePackageId(hierarchyBody);
  response.evidencePackageId = evidence.packageId;
  has(await validateChatNTCResponse(response, evidence, repository), "evidence-metadata-mismatch");
  const wrongSnapshot = { ...repository, identity: async () => ({ ...await repository.identity(), fingerprint: "wrong" }) };
  has(await validateChatNTCResponse(response, evidence, wrongSnapshot), "corpus-mismatch");
});

test("validator accetta solo output strutturati e propaga errori del repository", async () => {
  const { evidence, repository, response } = await context();
  for (const value of [null, [], "text", {}, { ...response, claims: [null] }, { ...response, needsMoreEvidence: "false" }]) has(await validateChatNTCResponse(value, evidence, repository), "invalid-response-shape");
  await assert.rejects(validateChatNTCResponse(response, evidence, { ...repository, getUnit: async () => { throw new Error("offline"); } }), /offline/);
  await assert.rejects(retrieveChatNTCEvidence(repository, "7.3.6.1", { maxUnitCharacters: NaN }), /opzione/);
});

test("adapter rifiuta manifest incoerenti, relazioni inferite e asset mancanti", async () => {
  const { loader, repository, assets, manifest } = fixture();
  const bad = createArtifactRepository({ ...loader, relations: async () => ({ formatVersion: 2, sourceOfTruth: "diagnostics", inferredRelationsIncluded: true, relations: [] }) });
  await assert.rejects(bad.related(NTC), /esplicito/);
  delete assets.formulas[aid("formula")];
  await assert.rejects(retrieveChatNTCEvidence(repository, "7.3.6.1"), /asset assente/);
  manifest.chunks[0].contentFingerprintSha256 = "wrong";
  await assert.rejects(repository.getUnit(NTC), /chunk non coerente/);
});
