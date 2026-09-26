import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  buildSearchIndexPayload,
  createSearchEngine,
  highlightedSnippet,
  normalizeSearchText,
  parseNormativeReference,
  tokenizeSearchText,
} from "../shared/searchEngine.js";

const viewerSourceUrl = new URL("../shared/NormativeViewer.tsx", import.meta.url);
const stylesUrl = new URL("../shared/styles.css", import.meta.url);
const clientSourceUrl = new URL("../shared/searchClient.ts", import.meta.url);
const workerSourceUrl = new URL("../shared/searchWorker.js", import.meta.url);

async function dataJson(path) {
  return JSON.parse(await readFile(new URL(`../public${path}`, import.meta.url), "utf8"));
}

async function engine() {
  return createSearchEngine(await dataJson("/data/codes/search-index.json"));
}

function fixtureUnit({ id, numbering, title, segments, document = "ntc2018" }) {
  return {
    id,
    document,
    numbering,
    title,
    titleBlockId: `${id}#heading`,
    chunkPath: `/fixture/${id}.json`,
    segments: [
      ...segments.map((segment, index) => ({ blockId: `${id}#p${index + 1}`, ...segment })),
    ],
  };
}

test("l’indice v4 contiene segmenti, target asset, riferimenti e posting list compatti", async () => {
  const index = await dataJson("/data/codes/search-index.json");
  assert.equal(index.formatVersion, 4);
  assert.match(index.normalization, /block and asset targets/iu);
  assert.equal(index.units.length, 1745);
  assert.ok(Object.keys(index.postings).length > 11_000);
  assert.ok(index.postings.sismica.length > 0);
  assert.ok(index.references["7.3.6.1"][0] >= 0);
  assert.equal(index.units[index.references["7.3.6.1"][0]].numbering, "7.3.6.1");
  assert.ok(index.assetReferences["formula:7.3.8"].length > 0);
  assert.ok(index.assetReferences["table:2.4.ii"].length > 0);
  assert.equal(index.units.every((unit) => unit.titleNormalized === normalizeSearchText(unit.title)), true);
  assert.equal(index.units.every((unit) => Array.isArray(unit.segments) && !("text" in unit)), true);
});

test("i riferimenti normativi esatti mantengono il lookup O(1) e rispettano il documento", async () => {
  const search = await engine();
  for (const query of ["7.3.6.1", "§7.3.6.1"]) {
    const results = search.search({ query, mode: "ntc", limit: 12 });
    assert.equal(results[0]?.numbering, "7.3.6.1");
    assert.equal(results[0]?.matchKind, "number-exact");
    assert.equal(results[0]?.blockId, undefined);
  }
  assert.deepEqual(parseNormativeReference("C7.3.6.1"), { numbering: "7.3.6.1", documentHint: "circ2019" });
  assert.equal(search.search({ query: "C7.3.6.1", mode: "circ", limit: 12 })[0]?.numbering, "C7.3.6.1");
  assert.equal(search.search({ query: "C7.3.6.1", mode: "ntc", limit: 12 }).length, 0);
  assert.equal(search.search({ query: "99.99.99", mode: "combined", limit: 12 }).length, 0);
});

test("le query miste combinano prefisso normativo e parole chiave", async () => {
  const search = await engine();
  const cases = [
    ["7.2.3 elementi secondari", /^7\.2\.3$/u],
    ["7.3.6 rigidezza", /^7\.3\.6/u],
    ["C8.7 muratura", /^C8\.7/u],
    ["muratura analisi non lineare", /^(?:C?8\.7|7\.8)/u],
    ["deformazione ultima calcestruzzo", /^(?:4\.1|7\.4|C8\.7)/u],
    ["coefficiente sottofondo", /^C6\.5/u],
    ["pareti accoppiate", /^7\.4/u],
  ];
  for (const [query, expected] of cases) {
    const results = search.search({ query, mode: "combined", limit: 10 });
    assert.ok(results.length > 0, query);
    assert.match(results[0].numbering, expected, query);
    assert.ok(results[0].blockId || results[0].assetId || ["title", "number-keyword"].includes(results[0].matchKind), query);
  }
  assert.equal(search.search({ query: "7.2.3 elementi secondari", mode: "combined", limit: 5 })[0].matchKind, "number-keyword");
});

test("formule e tabelle sono risolte per numero e contenuto con target preciso", async () => {
  const search = await engine();
  for (const query of ["7.3.8", "[7.3.8]", "formula 7.3.8"]) {
    const result = search.search({ query, mode: "combined", limit: 5 })[0];
    assert.equal(result?.matchKind, "asset-exact", query);
    assert.equal(result?.assetKind, "formula", query);
    assert.match(result?.assetId ?? "", /7\.3\.3\.3-7\.3\.8$/u, query);
    assert.match(result?.blockId ?? "", /formula-7-3-3-3-7-3-8$/u, query);
  }
  for (const query of ["2.4.II", "Tab. 2.4.II", "tabella 2.4.II"]) {
    const result = search.search({ query, mode: "combined", limit: 5 })[0];
    assert.equal(result?.assetKind, "table", query);
    assert.match(result?.assetId ?? "", /table:ntc2018:2\.4\.ii$/u, query);
  }
  for (const query of ["Tab. 7.2.I", "tabella 7.2.I"]) {
    const result = search.search({ query, mode: "combined", limit: 5 })[0];
    assert.equal(result?.assetKind, "table", query);
    assert.match(result?.assetId ?? "", /table:ntc2018:7\.2\.i$/u, query);
  }
  const tableContent = search.search({ query: "classe d'uso", mode: "combined", limit: 20 });
  assert.ok(tableContent.some((result) => result.assetId?.endsWith(":table:ntc2018:2.4.ii")));
  const formulaKeyword = search.search({ query: "formula spostamento", mode: "combined", limit: 5 });
  assert.ok(formulaKeyword.length > 0 && formulaKeyword.every((result) => result.assetKind === "formula"));
});

test("ranking: titolo, frase, prossimità e completezza dei termini hanno priorità deterministica", () => {
  const units = [
    fixtureUnit({ id: "title", numbering: "1", title: "Resistenza del calcestruzzo", segments: [{ text: "testo generico" }] }),
    fixtureUnit({ id: "body", numbering: "2", title: "Verifiche", segments: [{ text: "La resistenza del calcestruzzo è verificata." }] }),
    fixtureUnit({ id: "phrase", numbering: "3", title: "Analisi", segments: [{ text: "analisi non lineare della muratura" }] }),
    fixtureUnit({ id: "near", numbering: "4", title: "Analisi", segments: [{ text: "muratura con analisi non lineare" }] }),
    fixtureUnit({ id: "far", numbering: "5", title: "Analisi", segments: [{ text: `muratura ${"termine ".repeat(35)} analisi non lineare` }] }),
    fixtureUnit({ id: "split", numbering: "6", title: "Analisi", segments: [{ text: "muratura" }, { text: "analisi non lineare" }] }),
    fixtureUnit({ id: "partial", numbering: "7", title: "Analisi", segments: [{ text: "muratura soltanto" }] }),
  ];
  const search = createSearchEngine(buildSearchIndexPayload(units));
  assert.equal(search.search({ query: "resistenza del calcestruzzo", limit: 10 })[0].id, "title");
  const phraseResults = search.search({ query: "analisi non lineare della muratura", limit: 10 });
  assert.equal(phraseResults[0].id, "phrase");
  assert.equal(phraseResults[0].matchKind, "phrase");
  const proximityResults = search.search({ query: "muratura analisi non lineare", limit: 10 });
  assert.ok(proximityResults.findIndex((result) => result.id === "near") < proximityResults.findIndex((result) => result.id === "far"));
  assert.ok(proximityResults.findIndex((result) => result.id === "near") < proximityResults.findIndex((result) => result.id === "split"));
  assert.equal(proximityResults.some((result) => result.id === "partial"), false, "quando esistono match completi i match incompleti non entrano nel pool");
});

test("exact asset e riferimento battono la full-text", () => {
  const id = "fixture";
  const unit = fixtureUnit({ id, numbering: "7.3.8", title: "Formula citata nel titolo", segments: [
    { text: "Formula 7.3.8", assetId: "formula-fixture", assetKind: "formula", officialNumber: "7.3.8" },
    { text: "testo formula 7.3.8" },
  ] });
  const search = createSearchEngine(buildSearchIndexPayload([unit]));
  assert.equal(search.search({ query: "7.3.8" })[0].matchKind, "number-exact");
  assert.equal(search.search({ query: "[7.3.8]" })[0].matchKind, "asset-exact");
});

test("snippet, apostrofi Unicode e offset di highlight restano coerenti", async () => {
  const snippet = highlightedSnippet("La classe d’uso determina il coefficiente.", normalizeSearchText("classe d'uso"), tokenizeSearchText("classe d'uso"));
  assert.ok(snippet.highlights.length >= 3);
  for (const [from, to] of snippet.highlights) {
    assert.ok(from >= 0 && to > from && to <= snippet.snippet.length);
    assert.match(normalizeSearchText(snippet.snippet.slice(from, to)), /classe|d|uso/u);
  }
  const results = (await engine()).search({ query: "azione sismica", mode: "combined", limit: 12 });
  assert.ok(results.length > 0);
  for (const result of results) {
    assert.ok(result.snippet.length > 0);
    assert.ok(result.highlights.length > 0);
    assert.ok(result.blockId || result.assetId || result.matchKind === "title");
    for (const [from, to] of result.highlights) assert.ok(from >= 0 && to > from && to <= result.snippet.length);
  }
});

test("i filtri, il limite risultati, la live search e il worker restano invariati", async () => {
  const search = await engine();
  const query = "azione sismica";
  const ntc = search.search({ query, mode: "ntc", limit: 50 });
  const circ = search.search({ query, mode: "circ", limit: 50 });
  const combined = search.search({ query, mode: "combined", limit: 50 });
  assert.equal(ntc.every((result) => result.document === "ntc2018"), true);
  assert.equal(circ.every((result) => result.document === "circ2019"), true);
  assert.ok(combined.some((result) => result.document === "ntc2018"));
  assert.ok(combined.some((result) => result.document === "circ2019"));
  assert.equal(search.search({ query: "struttura", mode: "combined", limit: 3 }).length, 3);
  assert.equal(search.search({ query: "struttura", mode: "combined", limit: 500 }).length <= 50, true);
  const [viewerSource, clientSource, workerSource, styles] = await Promise.all([
    readFile(viewerSourceUrl, "utf8"), readFile(clientSourceUrl, "utf8"), readFile(workerSourceUrl, "utf8"), readFile(stylesUrl, "utf8"),
  ]);
  assert.match(viewerSource, /searchMaxResults = 12/);
  assert.match(clientSource, /new Worker\(new URL\("\.\/searchWorker\.js"/);
  assert.match(clientSource, /debounceMs = 80/);
  assert.match(workerSource, /fetch\(indexUrl\)/);
  assert.match(workerSource, /createSearchEngine/);
  assert.doesNotMatch(viewerSource, /searchIndex\.units\.filter|loadSearchIndex/);
  assert.match(clientSource, /exactResults !== null/);
  assert.match(clientSource, /debouncedQuery\.trim\(\)\.length < 2/);
  assert.ok(await readFile(new URL("../package-dist/searchWorker.js", import.meta.url), "utf8"));
  assert.match(viewerSource, /viewerTargetForSearchResult/);
  assert.match(viewerSource, /pendingSearchHighlightRef/);
  assert.match(viewerSource, /navigateViewerTarget\(target, "push"\)/);
  assert.match(styles, /prefers-reduced-motion: no-preference/);
  assert.match(styles, /\.scv-search-target/);
});
