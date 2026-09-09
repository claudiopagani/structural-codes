import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createSearchEngine, normalizeSearchText, parseNormativeReference } from "../shared/searchEngine.js";

const viewerSourceUrl = new URL("../shared/NormativeViewer.tsx", import.meta.url);
const clientSourceUrl = new URL("../shared/searchClient.ts", import.meta.url);
const workerSourceUrl = new URL("../shared/searchWorker.js", import.meta.url);

async function dataJson(path) {
  return JSON.parse(await readFile(new URL(`../public${path}`, import.meta.url), "utf8"));
}

async function engine() {
  return createSearchEngine(await dataJson("/data/codes/search-index.json"));
}

test("l'indice contiene normalizzazione build-time, riferimenti e posting list", async () => {
  const index = await dataJson("/data/codes/search-index.json");
  assert.equal(index.formatVersion, 3);
  assert.match(index.normalization, /build time/iu);
  assert.equal(index.units.length, 1745);
  assert.ok(Object.keys(index.postings).length > 10_000);
  assert.ok(index.postings.sismica.length > 0);
  assert.ok(index.references["7.3.3.3"][0] >= 0);
  assert.equal(index.units[index.references["7.3.3.3"][0]].numbering, "7.3.3.3");
  assert.equal(index.units.every((unit) => unit.titleNormalized === normalizeSearchText(unit.title)), true);
});

test("i riferimenti normativi esatti usano il lookup O(1)", async () => {
  const search = await engine();
  for (const query of ["7.3.3.3", "§7.3.3.3"]) {
    const results = search.search({ query, mode: "ntc", limit: 12 });
    assert.equal(results[0]?.numbering, "7.3.3.3");
    assert.equal(results[0]?.matchKind, "number-exact");
  }
  assert.deepEqual(parseNormativeReference("C7.3.3.3"), { numbering: "7.3.3.3", documentHint: "circ2019" });
  assert.equal(search.search({ query: "C7.3.3.2", mode: "circ", limit: 12 })[0]?.numbering, "C7.3.3.2");
  assert.equal(search.search({ query: "C7.3.3.2", mode: "ntc", limit: 12 }).length, 0);
});

test("la ricerca testuale restituisce snippet con highlight", async () => {
  const results = (await engine()).search({ query: "azione sismica", mode: "combined", limit: 12 });
  assert.ok(results.length > 0);
  assert.ok(results.some((result) => result.numbering === "3.2.3"));
  for (const result of results) {
    assert.ok(result.snippet.length > 0);
    assert.ok(result.highlights.length > 0);
    for (const [from, to] of result.highlights) {
      assert.ok(from >= 0 && to > from && to <= result.snippet.length);
      assert.match(normalizeSearchText(result.snippet.slice(from, to)), /azione|sismica/u);
    }
  }
});

test("il ranking applica numero esatto, titolo, frase e testo", async () => {
  const search = await engine();
  const exact = search.search({ query: "8", mode: "ntc", limit: 5 });
  assert.equal(exact[0]?.matchKind, "number-exact");
  const ranked = search.search({ query: "costruzioni esistenti", mode: "combined", limit: 20 });
  assert.equal(ranked[0]?.numbering, "8");
  assert.equal(ranked[0]?.matchKind, "title");
  const priorities = { "number-exact": 4, title: 3, phrase: 2, text: 1 };
  for (let index = 1; index < ranked.length; index += 1) {
    assert.ok(priorities[ranked[index - 1].matchKind] >= priorities[ranked[index].matchKind]);
  }
});

test("i filtri NTC, Circolare e combinata restano corretti dopo cambio modalità", async () => {
  const search = await engine();
  const query = "azione sismica";
  const ntc = search.search({ query, mode: "ntc", limit: 50 });
  const circ = search.search({ query, mode: "circ", limit: 50 });
  const combined = search.search({ query, mode: "combined", limit: 50 });
  assert.equal(ntc.every((result) => result.document === "ntc2018"), true);
  assert.equal(circ.every((result) => result.document === "circ2019"), true);
  assert.ok(combined.some((result) => result.document === "ntc2018"));
  assert.ok(combined.some((result) => result.document === "circ2019"));
  assert.deepEqual(search.search({ query, mode: "ntc", limit: 5 }).map(({ document }) => document), Array(5).fill("ntc2018"));
});

test("il massimo risultati è rispettato e configurabile", async () => {
  const search = await engine();
  assert.equal(search.search({ query: "struttura", mode: "combined", limit: 3 }).length, 3);
  assert.equal(search.search({ query: "struttura", mode: "combined", limit: 500 }).length <= 50, true);
  const viewerSource = await readFile(viewerSourceUrl, "utf8");
  assert.match(viewerSource, /searchMaxResults = 12/);
  assert.match(viewerSource, /maxResults: searchMaxResults/);
});

test("la full-text search è isolata dal main thread e l'indice resta lazy", async () => {
  const [viewerSource, clientSource, workerSource] = await Promise.all([
    readFile(viewerSourceUrl, "utf8"),
    readFile(clientSourceUrl, "utf8"),
    readFile(workerSourceUrl, "utf8"),
  ]);
  assert.match(clientSource, /new Worker\(new URL\("\.\/searchWorker\.js"/);
  assert.match(clientSource, /debounceMs = 80/);
  assert.match(workerSource, /fetch\(indexUrl\)/);
  assert.match(workerSource, /createSearchEngine/);
  assert.doesNotMatch(viewerSource, /searchIndex\.units\.filter|loadSearchIndex/);
  assert.match(clientSource, /exactResults !== null/);
  assert.match(clientSource, /debouncedQuery\.trim\(\)\.length < 2/);
  assert.ok(await readFile(new URL("../package-dist/searchWorker.js", import.meta.url), "utf8"));
});
