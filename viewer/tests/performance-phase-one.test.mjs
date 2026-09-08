import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const viewerSourceUrl = new URL("../shared/NormativeViewer.tsx", import.meta.url);

async function dataJson(path) {
  return JSON.parse(await readFile(new URL(`../public${path}`, import.meta.url), "utf8"));
}

test("il deep link risolve direttamente il chunk iniziale in NTC e Circolare", async () => {
  const { createDocumentLookup, initialUnitForIndex } = await import("../package-dist/corpusData.js");
  const [ntc, circ] = await Promise.all([
    dataJson("/data/codes/ntc2018/index.json"),
    dataJson("/data/codes/circ2019/index.json"),
  ]);
  for (const [index, targetPosition] of [[ntc, 640], [circ, 410]]) {
    const target = index.units[targetPosition];
    const initial = initialUnitForIndex(index, target.id);
    const lookup = createDocumentLookup(index);
    assert.equal(initial.id, target.id);
    assert.equal(lookup.unitById.get(target.id)?.chunkPath, target.chunkPath);
    assert.deepEqual(lookup.unitsByChunkPath.get(target.chunkPath)?.some((unit) => unit.id === target.id), true);
  }
});

test("la cache JSON condivide richiesta e parsing dello stesso chunk", async () => {
  const { cachedJsonPaths, loadChunk } = await import("../package-dist/corpusData.js");
  const originalFetch = globalThis.fetch;
  let requests = 0;
  globalThis.fetch = async () => {
    requests += 1;
    return new Response(JSON.stringify({ formatVersion: 2, document: "ntc2018", units: [], assets: {} }), { status: 200 });
  };
  try {
    const path = `/performance-test/${process.pid}-${Date.now()}.json`;
    const [first, second] = await Promise.all([loadChunk(path, ""), loadChunk(path, "")]);
    assert.equal(first, second);
    assert.equal(requests, 1);
    assert.ok(cachedJsonPaths().includes(path));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("click già montato precede lo stato React, mentre un target assente carica il suo chunk", async () => {
  const source = await readFile(viewerSourceUrl, "utf8");
  const selectStart = source.indexOf("const selectUnit = useCallback");
  const selectEnd = source.indexOf("const selectScrollMarker", selectStart);
  const selection = source.slice(selectStart, selectEnd);
  assert.ok(selection.indexOf("scrollTextUnit(textPaneRef.current, unit.id)") < selection.indexOf("setActiveUnitId(unit.id)"));
  assert.match(selection, /if \(present\) return;/);
  assert.match(selection, /revealSummary\(unit, !nearMountedWindow\)/);
  assert.match(source, /await mountPrimaryChunk\(summary\.chunkPath, replace\)/);
  assert.match(source, /loadChunk\(path, dataBaseUrl\)/);
  assert.match(source, /const generation = replace \? \+\+mountGenerationRef\.current : mountGenerationRef\.current/);
  assert.match(source, /generation !== mountGenerationRef\.current/);
  assert.match(source, /pendingScrollAnchorRef/);
  assert.match(source, /mountPrimaryChunk\(adjacent\.previous, false, true\)/);
});

test("lo startup non costruisce né scarica la lista completa dei chunk", async () => {
  const source = await readFile(viewerSourceUrl, "utf8");
  assert.doesNotMatch(source, /documentChunkPaths|circChunkPaths|manifest\?\.chunks\.filter/);
  assert.doesNotMatch(source, /Promise\.all\([^)]*(?:documentChunkPaths|circChunkPaths)/s);
  assert.match(source, /initialUnitForIndex/);
  assert.match(source, /mountPrimaryChunk\(summary\.chunkPath/);
  assert.match(source, /scheduleIdle/);
  assert.match(source, /adjacentChunkPaths/);
});

test("il documento memoizzato è indipendente dall'unità attiva e lo scroll usa observer", async () => {
  const source = await readFile(viewerSourceUrl, "utf8");
  const documentStart = source.indexOf("const DocumentContent = memo");
  const documentEnd = source.indexOf("interface ScrollMarker", documentStart);
  const documentComponent = source.slice(documentStart, documentEnd);
  assert.doesNotMatch(documentComponent, /activeUnitId|activeId/);
  assert.match(source, /const MemoizedUnit = memo/);
  assert.match(source, /new IntersectionObserver/);
  assert.match(source, /const positions = elements\.map/);
  assert.match(source, /while \(low < high\)/);
});

test("la scrollbar separa geometria marker e aggiornamento dinamico del thumb", async () => {
  const source = await readFile(viewerSourceUrl, "utf8");
  assert.match(source, /const measureGeometry = \(\) =>/);
  assert.match(source, /const updateThumb = useCallback/);
  assert.match(source, /thumb\.style\.top/);
  const scrollHandler = source.slice(source.indexOf("const onScroll = () =>", source.indexOf("const DocumentScrollbar")), source.indexOf("if \(markers.length", source.indexOf("const DocumentScrollbar")));
  assert.doesNotMatch(scrollHandler, /setGeometry|getBoundingClientRect|querySelectorAll/);
});

test("NTC, Circolare e combinata mantengono navigazione e caricamento circoscritto", async () => {
  const source = await readFile(viewerSourceUrl, "utf8");
  assert.match(source, /documentForMode\(mode\)/);
  assert.match(source, /nextMode === "combined" \|\| activeSummary\.document === documentForMode\(nextMode\)/);
  assert.match(source, /const requiredCombinedCircPaths = useMemo/);
  assert.match(source, /primaryRenderedPaths\.has\(target\.chunkPath\)/);
  assert.match(source, /paths\.add\(edge\.sourceChunkPath\)/);
  assert.match(source, /circPathsByPrimaryPath\.get\(primaryPath\)/);
  assert.doesNotMatch(source, /setLoadedChunks\(new Map\(\)\)[\s\S]{0,300}setMode\(nextMode\)/);
});
