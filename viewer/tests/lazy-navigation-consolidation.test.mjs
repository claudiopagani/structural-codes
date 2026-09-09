import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { isChunkNearRenderedWindow, navigationChunkPaths, navigationChunkWindow } from "../shared/chunkNavigation.js";

const viewerSourceUrl = new URL("../shared/NormativeViewer.tsx", import.meta.url);

function lookupFor(paths) {
  return { chunkPaths: paths, chunkIndexByPath: new Map(paths.map((path, index) => [path, index])) };
}

test("un salto distante monta una finestra previous + target + next senza uscire dai bordi", () => {
  const lookup = lookupFor(["/c0.json", "/c1.json", "/c2.json", "/c3.json", "/c4.json"]);
  assert.deepEqual(navigationChunkWindow(lookup, "/c2.json"), { previous: "/c1.json", target: "/c2.json", next: "/c3.json" });
  assert.deepEqual(navigationChunkPaths(lookup, "/c0.json"), ["/c0.json", "/c1.json"]);
  assert.deepEqual(navigationChunkPaths(lookup, "/c4.json"), ["/c3.json", "/c4.json"]);
  assert.equal(isChunkNearRenderedWindow(lookup, "/c2.json", new Set(["/c1.json"])), true);
  assert.equal(isChunkNearRenderedWindow(lookup, "/c2.json", new Set(["/c0.json", "/c4.json"])), false);
});

test("il target viene montato prima dei vicini e prepend/append preservano target e anchor", async () => {
  const source = await readFile(viewerSourceUrl, "utf8");
  const start = source.indexOf("const mountPrimaryWindow = useCallback");
  const end = source.indexOf("const requiredCombinedCircPaths", start);
  const mounting = source.slice(start, end);
  assert.ok(mounting.indexOf("await mountPrimaryChunk(summary.chunkPath, replace, false, generation)") < mounting.indexOf("if (window.previous)"));
  assert.match(mounting, /mountPrimaryChunk\(window\.previous, false, true, generation\)/);
  assert.match(mounting, /mountPrimaryChunk\(window\.next, false, false, generation\)/);
  assert.match(source, /if \(preserveAnchor\) preserveActiveScrollAnchor\(generation\)/);
  assert.match(source, /if \(generation === navigationGenerationRef\.current\) preserveActiveScrollAnchor\(generation\)/);
  assert.match(source, /root\.scrollTop \+= nextTop - pendingAnchor\.top/);
  assert.match(source, /pendingAnchor\.generation === navigationGenerationRef\.current/);
  assert.match(source, /root\.scrollTop \+ target\.getBoundingClientRect\(\)\.top - root\.getBoundingClientRect\(\)\.top/);
});

test("il prefetch segue il chunk attivo e non dilata automaticamente la finestra montata", async () => {
  const source = await readFile(viewerSourceUrl, "utf8");
  const prefetch = source.slice(source.indexOf("if (!lookup || !activeUnitId) return;"), source.indexOf("useLayoutEffect", source.indexOf("if (!lookup || !activeUnitId) return;")));
  assert.match(prefetch, /lookup\.unitById\.get\(activeUnitId\)/);
  assert.match(prefetch, /adjacentChunkPaths\(lookup, active\.chunkPath\)/);
  assert.doesNotMatch(prefetch, /rendered\[0\]|rendered\.at/);
});

test("navigazioni rapide invalidano mount e anchor asincroni precedenti", async () => {
  const source = await readFile(viewerSourceUrl, "utf8");
  assert.match(source, /const generation = \+\+navigationGenerationRef\.current/);
  assert.match(source, /generation !== navigationGenerationRef\.current/);
  assert.match(source, /pendingScrollAnchorRef\.current = null/);
  assert.doesNotMatch(source, /const generation = replace \? \+\+/);
});

test("indice, ricerca, cross-reference e history convergono sullo stesso caricamento a finestra", async () => {
  const source = await readFile(viewerSourceUrl, "utf8");
  assert.match(source, /revealSummary\(unit, !nearMountedWindow, generation\)/);
  assert.match(source, /selectSearchResult/);
  assert.match(source, /navigateViewerTarget\(viewerTargetForReference\(reference\), "push"\)/);
  assert.match(source, /navigateViewerTarget\(target, "none", nextMode\)/);
  assert.match(source, /mountPrimaryWindow\(summary, replace, generation\)/);
  assert.match(source, /mountPrimaryWindow\(target, replace, generation\)/);
  assert.match(source, /mountPrimaryWindow\(anchor, replace, generation\)/);
  assert.match(source, /matchingPrimarySummary\(requestedCirc, lookup\)/);
  assert.match(source, /scrollRequestRef\.current = \{ kind: "unit", unitId: matchingPrimary\.id \}/);
});

test("finestre sovrapposte non causano doppi fetch nella cache di sessione", async () => {
  const { loadChunk } = await import("../package-dist/corpusData.js");
  const lookup = lookupFor(["/c0.json", "/c1.json", "/c2.json", "/c3.json", "/c4.json"]);
  const originalFetch = globalThis.fetch;
  const requests = new Map();
  globalThis.fetch = async (path) => {
    requests.set(path, (requests.get(path) ?? 0) + 1);
    return new Response(JSON.stringify({ formatVersion: 2, document: "ntc2018", units: [], assets: {} }), { status: 200 });
  };
  try {
    const prefix = `/consolidation-${process.pid}-${Date.now()}`;
    const paths = lookup.chunkPaths.map((path) => `${prefix}${path}`);
    const scopedLookup = lookupFor(paths);
    await Promise.all([
      ...navigationChunkPaths(scopedLookup, paths[2]).map((path) => loadChunk(path, "")),
      ...navigationChunkPaths(scopedLookup, paths[3]).map((path) => loadChunk(path, "")),
    ]);
    assert.equal(requests.size, 4);
    assert.deepEqual([...requests.values()], [1, 1, 1, 1]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("errori locali, permalink malformati e Worker assente degradano senza abbattere il viewer", async () => {
  const [viewer, searchClient] = await Promise.all([
    readFile(viewerSourceUrl, "utf8"),
    readFile(new URL("../shared/searchClient.ts", import.meta.url), "utf8"),
  ]);
  assert.match(viewer, /renderedChunkPathsRef\.current\.size === 0/);
  assert.match(viewer, /Il chunk precedente non è disponibile; il target resta consultabile/);
  assert.match(viewer, /Il target richiesto non esiste nel documento corrente/);
  assert.match(viewer, /Il blocco o asset richiesto non esiste/);
  assert.doesNotMatch(viewer, /mountPrimaryChunk\(adjacent\.previous, false, true\)\.catch\(\(\) => setLoadError/);
  assert.match(searchClient, /typeof Worker === "undefined"/);
  assert.match(searchClient, /try \{\s*worker = new Worker/s);
  assert.match(searchClient, /activeWorker\.terminate\(\)/);
  const { targetFromUrl } = await import("../package-dist/permalinks.js");
  assert.equal(targetFromUrl(new URL("https://example.test/?asset=missing")), null);
  assert.deepEqual(targetFromUrl(new URL("https://example.test/?unit=known&asset=missing&assetKind=invalid")), { kind: "asset", unitId: "known", assetId: "missing", assetKind: undefined });
});
