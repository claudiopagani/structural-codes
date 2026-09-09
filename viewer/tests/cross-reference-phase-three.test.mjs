import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import test from "node:test";
import { createCrossReferenceLookup, findCrossReferences, resolveCrossReference } from "../shared/crossReferences.js";

const viewerSourceUrl = new URL("../shared/NormativeViewer.tsx", import.meta.url);
const contentSourceUrl = new URL("../shared/CorpusContent.tsx", import.meta.url);
const toolsSourceUrl = new URL("../shared/ReferenceTools.tsx", import.meta.url);

async function dataJson(path) {
  return JSON.parse(await readFile(new URL(`../public${path}`, import.meta.url), "utf8"));
}

test("riconosce riferimenti a unità, formule, tabelle e figure senza sovrapposizioni", () => {
  const references = findCrossReferences("Vedere §7.3.3.3, C7.3.3.2, Tab. 7.3.III, Fig. 7.3.1 e formula [7.3.4].");
  assert.deepEqual(references.map(({ kind, number, documentHint }) => ({ kind, number, documentHint })), [
    { kind: "unit", number: "7.3.3.3", documentHint: null },
    { kind: "unit", number: "7.3.3.2", documentHint: "circ2019" },
    { kind: "table", number: "7.3.III", documentHint: null },
    { kind: "figure", number: "7.3.1", documentHint: null },
    { kind: "formula", number: "7.3.4", documentHint: null },
  ]);
  assert.deepEqual(findCrossReferences("Confrontare §3.2 e C7.3, ma non il valore 3.2.").map(({ number, documentHint }) => ({ number, documentHint })), [
    { number: "3.2", documentHint: null },
    { number: "7.3", documentHint: "circ2019" },
  ]);
});

test("l'indice derivato risolve target e backlink senza caricare chunk", async () => {
  const manifest = await dataJson("/data/codes/manifest.json");
  const index = await dataJson(manifest.crossReferenceIndexPath);
  const lookup = createCrossReferenceLookup(index);
  assert.equal(index.formatVersion, 1);
  assert.equal(index.units.length, 1745);
  assert.ok(index.assets.length > 100);
  assert.ok(index.backlinks.length > 500);
  assert.ok((await stat(new URL(`../public${manifest.crossReferenceIndexPath}`, import.meta.url))).size < 1_100_000);
  const unit = resolveCrossReference(lookup, { kind: "unit", number: "7.3.3.3", documentHint: null }, "ntc2018");
  assert.equal(unit?.unit.numbering, "7.3.3.3");
  assert.ok([...lookup.backlinksByTarget.keys()].some((key) => key.startsWith("unit:")));
  const asset = index.assets[0];
  const resolvedAsset = resolveCrossReference(lookup, { kind: asset.kind, number: asset.officialNumber.replace(/^C/iu, ""), documentHint: asset.officialNumber.startsWith("C") ? "circ2019" : null }, lookup.unitById.get(asset.unitId).document);
  assert.equal(resolvedAsset?.asset?.id, asset.id);
});

test("linkificazione, preview e navigazione lazy restano fuori dal documento memoizzato", async () => {
  const [viewer, content, tools] = await Promise.all([readFile(viewerSourceUrl, "utf8"), readFile(contentSourceUrl, "utf8"), readFile(toolsSourceUrl, "utf8")]);
  assert.match(content, /findCrossReferences\(value\)/);
  assert.match(content, /className="scv-cross-reference"/);
  assert.match(viewer, /onPointerOver=\{handleDocumentPointerOver\}/);
  assert.match(viewer, /<ReferencePreview preview=\{referencePreview\}/);
  assert.match(tools, /data-scv-reference-preview/);
  assert.match(viewer, /scrollViewerTarget\(textPaneRef\.current, target\)/);
  assert.match(viewer, /await revealSummary\(summary/);
  assert.match(viewer, /loadDocumentIndex\(manifest, targetDocument, dataBaseUrl\)/);
  const documentComponent = viewer.slice(viewer.indexOf("const DocumentContent = memo"), viewer.indexOf("interface ScrollMarker"));
  assert.doesNotMatch(documentComponent, /activeUnitId|citationSelection|referencePreview/);
});

test("backlink testuali e relazioni editoriali sono caricati e mostrati separatamente", async () => {
  const [viewer, tools] = await Promise.all([
    readFile(viewerSourceUrl, "utf8"),
    readFile(new URL("../shared/ReferenceTools.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(viewer, /Promise\.all\(\[ensureCrossReferenceIndex\(\), ensureRelations\(\)\]\)/);
  assert.match(viewer, /backlinksByTarget\.get\(`unit:\$\{activeUnitId\}`\)/);
  assert.match(tools, /Riferimenti testuali/);
  assert.match(tools, /Relazioni editoriali NTC ↔ Circolare/);
});

test("permalink granulari e citazioni sono stabili", async () => {
  const { citationForTarget, targetFromUrl, urlForViewerTarget } = await import("../package-dist/permalinks.js");
  const unitId = "urn:structural-codes:it:unit:ntc2018:7.3.3.3";
  const block = { kind: "block", unitId, blockId: "ntc2018-7.3.3.3-p1" };
  const blockUrl = urlForViewerTarget("https://example.test/viewer?mode=circ", "ntc", "combined", block);
  assert.deepEqual(targetFromUrl(blockUrl), block);
  for (const assetKind of ["formula", "table", "figure"]) {
    const asset = { kind: "asset", unitId, assetId: `${assetKind}:7.3.1`, assetKind };
    const assetUrl = urlForViewerTarget(blockUrl, "combined", "combined", asset);
    assert.deepEqual(targetFromUrl(assetUrl), asset);
    assert.equal(assetUrl.searchParams.has("mode"), false);
  }
  const formulaUrl = urlForViewerTarget(blockUrl, "combined", "combined", { kind: "asset", unitId, assetId: "formula:7.3.1", assetKind: "formula" });
  assert.match(citationForTarget({ documentLabel: "NTC 2018", unitNumber: "7.3.3.3", targetLabel: "Formula 7.3.1", permalink: formulaUrl.href }), /NTC 2018, § 7\.3\.3\.3, Formula 7\.3\.1 — https:/u);
});

test("history, clipboard e modalità usano il percorso di navigazione condiviso", async () => {
  const [viewer, tools] = await Promise.all([readFile(viewerSourceUrl, "utf8"), readFile(toolsSourceUrl, "utf8")]);
  assert.match(viewer, /window\.history\[`\$\{action\}State`\]/);
  assert.match(viewer, /window\.addEventListener\("popstate", onPopState\)/);
  assert.match(viewer, /navigateViewerTarget\(viewerTargetForReference\(reference\), "push"\)/);
  assert.match(viewer, /navigator\.clipboard\?\.writeText/);
  assert.match(tools, /Copia LaTeX/);
  assert.match(viewer, /mode === "combined" \|\| documentForMode\(mode\) === targetDocument/);
  assert.match(viewer, /targetDocument === "ntc2018" \? "ntc" : "circ"/);
});

test("l'indice cross-reference resta lazy e indipendente dal worker di ricerca", async () => {
  const viewer = await readFile(viewerSourceUrl, "utf8");
  const startup = viewer.slice(viewer.indexOf("loadManifest(dataBaseUrl)"), viewer.indexOf("const ensureRelations"));
  assert.doesNotMatch(startup, /loadCrossReferenceIndex/);
  assert.match(viewer, /const ensureCrossReferenceIndex = useCallback/);
  assert.match(viewer, /resolveReferenceElement/);
  assert.match(viewer, /toggleBacklinks/);
  assert.match(await readFile(new URL("../shared/searchWorker.js", import.meta.url), "utf8"), /createSearchEngine/);
});
