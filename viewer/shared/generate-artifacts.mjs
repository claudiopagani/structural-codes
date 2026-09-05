#!/usr/bin/env node
import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const documentOrder = ["ntc2018", "circ2019"];
const maxInitialChunkBytes = 1_500_000;
const documentLabels = {
  ntc2018: { shortLabel: "NTC 2018", label: "Norme Tecniche per le Costruzioni" },
  circ2019: { shortLabel: "Circolare 7/2019", label: "Istruzioni per l’applicazione delle NTC 2018" },
};

function sha256(value) { return createHash("sha256").update(value).digest("hex"); }
async function json(file) { return JSON.parse(await readFile(file, "utf8")); }
async function writeJson(file, value) {
  await mkdir(dirname(file), { recursive: true });
  const serialized = `${JSON.stringify(value)}\n`;
  await writeFile(file, serialized, "utf8");
  return { bytes: Buffer.byteLength(serialized), sha256: sha256(serialized) };
}
function assertOutputDirectory(outputDirectory, sourceRoot) {
  const output = resolve(outputDirectory);
  if (output === resolve(sourceRoot)) throw new Error(`output generator coincide con il package sorgente: ${output}`);
  if (output === resolve(dirname(sourceRoot))) throw new Error(`output generator troppo ampio: ${output}`);
}
async function sourceRootFor(sourcePackage) {
  const packageUrl = await import.meta.resolve(`${sourcePackage}/package.json`);
  return dirname(fileURLToPath(packageUrl));
}
async function loadUnits(corpusRoot, document) {
  const directory = join(corpusRoot, document);
  const files = (await readdir(directory)).filter((file) => file.endsWith(".json")).sort((left, right) => left.localeCompare(right, "it", { numeric: true }));
  const units = await Promise.all(files.map((file) => json(join(directory, file))));
  return units.sort((left, right) => left.numbering.sortKey.localeCompare(right.numbering.sortKey, "it", { numeric: true }));
}
function baseChunkKey(unit, depth = 2) {
  const components = unit.numbering.official.replace(/^C/iu, "").split(".");
  return components.slice(0, Math.min(depth, components.length)).join(".");
}
function assignChunkKeys(units) {
  const initial = new Map();
  for (const unit of units) {
    const key = baseChunkKey(unit);
    const group = initial.get(key) ?? [];
    group.push(unit);
    initial.set(key, group);
  }
  const assigned = new Map();
  for (const [key, group] of initial) {
    if (Buffer.byteLength(JSON.stringify(group)) <= maxInitialChunkBytes) {
      for (const unit of group) assigned.set(unit.id, key);
      continue;
    }
    for (const unit of group) {
      const refined = baseChunkKey(unit, 3);
      assigned.set(unit.id, refined === key ? `${key}.root` : refined);
    }
  }
  return assigned;
}
function publicUnit(document, unit) { return { ...unit, document }; }
function unitSummary(document, unit, chunkPath) {
  const openIssues = unit.workflow.openIssues ?? [];
  return { id: unit.id, document, kind: unit.kind, numbering: unit.numbering, title: unit.title, hierarchy: unit.hierarchy, validity: unit.validity, workflowStatus: unit.workflow.status, openIssueCount: openIssues.length, blockingIssueCount: openIssues.filter(({ severity }) => severity === "blocking").length, chunkPath };
}

export async function generateArtifacts({ sourcePackage = "structural-codes", outputDirectory = join(process.cwd(), "public", "data", "codes"), assetOutputDirectory = join(process.cwd(), "public", "assets") } = {}) {
  const sourceRoot = await sourceRootFor(sourcePackage);
  assertOutputDirectory(outputDirectory, sourceRoot);
  assertOutputDirectory(assetOutputDirectory, sourceRoot);
  const corpusRoot = join(sourceRoot, "corpus", "units");
  const corpusManifestFile = join(sourceRoot, "corpus", "manifest.json");
  const assetManifestDirectory = join(sourceRoot, "corpus", "assets");
  const sourceRegistryFile = join(sourceRoot, "sources", "registry", "sources.v2.json");
  const packageFile = join(sourceRoot, "package.json");
  const figureOutput = assetOutputDirectory;
  const [corpusManifest, sourceRegistry, packageManifest] = await Promise.all([json(corpusManifestFile), json(sourceRegistryFile), json(packageFile)]);
  const assetManifestFiles = (await readdir(assetManifestDirectory, { recursive: true })).filter((file) => file.endsWith(".json")).sort((left, right) => left.localeCompare(right, "it", { numeric: true }));
  const assetManifests = await Promise.all(assetManifestFiles.map((file) => json(join(assetManifestDirectory, file))));
  const assetCollections = { formulas: assetManifests.flatMap(({ formulas }) => formulas), tables: assetManifests.flatMap(({ tables }) => tables), figures: assetManifests.flatMap(({ figures }) => figures) };
  const assetsById = Object.fromEntries(Object.entries(assetCollections).map(([kind, assets]) => [kind, new Map(assets.map((asset) => [asset.id, asset]))]));
  const unitsByDocument = Object.fromEntries(await Promise.all(documentOrder.map(async (document) => [document, await loadUnits(corpusRoot, document)])));
  const allUnits = documentOrder.flatMap((document) => unitsByDocument[document].map((unit) => publicUnit(document, unit)));
  await Promise.all([rm(outputDirectory, { recursive: true, force: true }), rm(figureOutput, { recursive: true, force: true })]);
  const chunkPathByUnit = new Map();
  const documentIndexes = {};
  const chunkInventory = [];
  for (const document of documentOrder) {
    const units = unitsByDocument[document];
    const keys = assignChunkKeys(units);
    const groups = new Map();
    for (const unit of units) {
      const key = keys.get(unit.id);
      const chunkPath = `/data/codes/${document}/chunks/${key}.json`;
      chunkPathByUnit.set(unit.id, chunkPath);
      const group = groups.get(key) ?? [];
      group.push(unit);
      groups.set(key, group);
    }
    for (const [key, group] of [...groups].sort(([left], [right]) => left.localeCompare(right, "it", { numeric: true }))) {
      const assetIds = new Set(group.flatMap((unit) => [...unit.assets.formulaIds, ...unit.assets.tableIds, ...unit.assets.figureIds, ...unit.blocks.flatMap((block) => block.assetId ? [block.assetId] : [])]));
      const assets = Object.fromEntries(Object.entries(assetsById).map(([kind, lookup]) => [kind, Object.fromEntries([...assetIds].map((id) => lookup.get(id)).filter(Boolean).map((asset) => [asset.id, asset]))]));
      const unitPayload = group.map((unit) => publicUnit(document, unit));
      const contentFingerprintSha256 = sha256(JSON.stringify({ unitPayload, assets }));
      const chunk = { formatVersion: 2, structuralCodesVersion: packageManifest.version, schemaVersion: group[0]?.schemaVersion ?? null, document, key, contentFingerprintSha256, units: unitPayload, assets };
      const chunkFile = join(outputDirectory, document, "chunks", `${key}.json`);
      const written = await writeJson(chunkFile, chunk);
      chunkInventory.push({ path: `/data/codes/${relative(outputDirectory, chunkFile).replaceAll("\\", "/")}`, document, key, units: group.length, bytes: written.bytes, sha256: written.sha256, contentFingerprintSha256 });
    }
    const summaries = units.map((unit) => unitSummary(document, unit, chunkPathByUnit.get(unit.id)));
    const indexPayload = { formatVersion: 2, structuralCodesVersion: packageManifest.version, document, units: summaries };
    const indexFile = join(outputDirectory, document, "index.json");
    const written = await writeJson(indexFile, indexPayload);
    documentIndexes[document] = { ...documentLabels[document], indexPath: `/data/codes/${document}/index.json`, indexFingerprintSha256: written.sha256, units: summaries.length };
  }
  const relations = allUnits.flatMap((unit) => unit.relations.map((relation) => ({ sourceUnitId: unit.id, sourceDocument: unit.document, sourceChunkPath: chunkPathByUnit.get(unit.id), targetUnitId: relation.targetUnitId, targetChunkPath: chunkPathByUnit.get(relation.targetUnitId) ?? null, ...relation })));
  const relationsWritten = await writeJson(join(outputDirectory, "relations.json"), { formatVersion: 2, sourceOfTruth: "explicit-corpus-relations", inferredRelationsIncluded: false, relations });
  const ntcByNumber = new Map(unitsByDocument.ntc2018.map((unit) => [unit.numbering.official, unit]));
  const diagnostics = unitsByDocument.circ2019.flatMap((unit) => { const candidate = ntcByNumber.get(unit.numbering.official.replace(/^C/iu, "")); if (!candidate || unit.relations.some((relation) => relation.targetUnitId === candidate.id)) return []; return [{ kind: "suggested-relation", status: "diagnostic-only-not-canonical", reason: "same-numbering", sourceUnitId: unit.id, targetUnitId: candidate.id, sourceChunkPath: chunkPathByUnit.get(unit.id), targetChunkPath: chunkPathByUnit.get(candidate.id) }]; });
  const diagnosticsWritten = await writeJson(join(outputDirectory, "relation-diagnostics.json"), { formatVersion: 2, warning: "Suggerimenti diagnostici non revisionati: non sono usati dalla vista combinata.", suggestions: diagnostics });
  const searchWritten = await writeJson(join(outputDirectory, "search-index.json"), { formatVersion: 2, normalization: "NFKC lowercase it-IT at query time", units: allUnits.map((unit) => ({ id: unit.id, document: unit.document, numbering: unit.numbering.official, title: unit.title, chunkPath: chunkPathByUnit.get(unit.id), text: unit.blocks.flatMap((block) => block.text?.normalized ? [block.text.normalized] : []).join(" ") })) });
  const manifestationBySourceId = new Map(sourceRegistry.works.flatMap((work) => work.manifestations.map((manifestation) => [manifestation.sourceId, { manifestation, work }])));
  for (const document of documentOrder) {
    const manifestDocument = corpusManifest.documents[document];
    const source = manifestationBySourceId.get(manifestDocument.sourceId);
    if (!source) throw new Error(`sourceId non risolto: ${manifestDocument.sourceId}`);
    Object.assign(documentIndexes[document], { sourceId: manifestDocument.sourceId, sourceUrl: source.manifestation.officialUrl, publicationUrl: source.work.publication.eliUri, localSourcePath: source.manifestation.localFile, sourceSha256: source.manifestation.sha256, pages: manifestDocument.pages, blocks: unitsByDocument[document].reduce((total, unit) => total + unit.blocks.filter((block) => block.text).length, 0) });
  }
  const reviewedStatuses = new Set(["source-checked", "double-reviewed", "published", "superseded"]);
  const corpusFingerprintSha256 = sha256(JSON.stringify({ corpusManifest, unitsByDocument, assetManifests }));
  const artifactFingerprintSha256 = sha256(JSON.stringify({ chunkInventory, indexes: documentIndexes, relations: relationsWritten.sha256, diagnostics: diagnosticsWritten.sha256, search: searchWritten.sha256 }));
  const manifest = { formatVersion: 2, generatedAt: corpusManifest.asOf, structuralCodesVersion: packageManifest.version, schemaVersion: allUnits[0]?.schemaVersion ?? null, assetSchemaVersion: assetManifests[0]?.schemaVersion ?? null, status: corpusManifest.status, disclaimer: corpusManifest.disclaimer, corpusFingerprintSha256, generatedArtifactFingerprintSha256: artifactFingerprintSha256, stats: { units: allUnits.length, blocks: allUnits.reduce((total, unit) => total + unit.blocks.filter((block) => block.text).length, 0), explicitRelations: relations.length, proposedRelations: relations.filter((relation) => relation.review.status === "proposed").length, suggestedRelationDiagnostics: diagnostics.length, reviewedUnits: allUnits.filter((unit) => reviewedStatuses.has(unit.workflow.status)).length, assetUnits: allUnits.filter((unit) => unit.assets.formulaIds.length > 0 || unit.assets.tableIds.length > 0 || unit.assets.figureIds.length > 0).length, formulas: assetCollections.formulas.length, tables: assetCollections.tables.length, figures: assetCollections.figures.length, chunks: chunkInventory.length }, documents: documentIndexes, relationsPath: "/data/codes/relations.json", relationDiagnosticsPath: "/data/codes/relation-diagnostics.json", searchIndexPath: "/data/codes/search-index.json", chunks: chunkInventory };
  const manifestWritten = await writeJson(join(outputDirectory, "manifest.json"), manifest);
  let copiedFigureBytes = 0;
  for (const figure of assetCollections.figures) {
    const source = join(sourceRoot, "corpus", "assets", figure.imagePath);
    const destination = join(figureOutput, figure.imagePath);
    await mkdir(dirname(destination), { recursive: true });
    await copyFile(source, destination);
    copiedFigureBytes += (await stat(source)).size;
  }
  return { manifest, artifactFingerprintSha256, units: allUnits.length, chunks: chunkInventory.length, relations: relations.length, diagnostics: diagnostics.length, manifestBytes: manifestWritten.bytes, figureBytes: copiedFigureBytes };
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const args = new Map(process.argv.slice(2).flatMap((argument, index, values) => argument.startsWith("--") && values[index + 1] && !values[index + 1].startsWith("--") ? [[argument.slice(2), values[index + 1]]] : []));
  const result = await generateArtifacts({ sourcePackage: args.get("source") ?? "structural-codes", outputDirectory: args.get("output") ?? join(process.cwd(), "public", "data", "codes"), assetOutputDirectory: args.get("assets") ?? join(process.cwd(), "public", "assets") });
  console.log(`generate-artifacts: ${result.units} unità in ${result.chunks} chunk; ${result.relations} relazioni esplicite; artifact sha256 ${result.artifactFingerprintSha256}`);
}
