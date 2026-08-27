import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { isEditorialTableNote, visibleTableNotes } from "../app/tableNotes.mjs";

async function render(pathname) {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-${pathname}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(new Request(`http://localhost${pathname}`, { headers: { accept: "text/html" } }), { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } }, { waitUntil() {}, passThroughOnException() {} });
}

test("espone la UI canonica comparata con ricerca e impostazioni", async () => {
  const response = await render("/consultazione");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /scv-root/);
  assert.match(html, /scv-index-grid/);
  assert.match(html, /Cerca nella normativa…/);
  assert.match(html, /Impostazioni consultazione/);
  assert.match(html, /Corpus JSON/);
  assert.match(html, /PDF ufficiale/);
  assert.doesNotMatch(html, /comparison-shell/);
});

test("conserva il viewer analitico precedente", async () => {
  const response = await render("/");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Corpus normativo verificabile/);
  assert.match(html, /Lettura comparata/);
});

test("rifiuta richieste PDF per documenti non registrati", async () => {
  const response = await render("/api/source-pdf?document=altro");
  assert.equal(response.status, 400);
});

test("la selezione dall'indice usa il DOM globale e preserva il deep-link", async () => {
  const source = await readFile(new URL("../shared/NormativeViewer.tsx", import.meta.url), "utf8");
  assert.match(source, /function selectUnit\(unit: UnitSummary\)/);
  assert.match(source, /window\.document\.querySelector/);
  assert.match(source, /data-index-unit=/);
  assert.match(source, /updateDeepLink\(mode, unit\.id, defaultMode\)/);
  assert.doesNotMatch(source, /const document = documentForMode/);
});

test("combined è il default e le relazioni restano esplicite", async () => {
  const source = await readFile(new URL("../shared/NormativeViewer.tsx", import.meta.url), "utf8");
  assert.match(source, /defaultMode = "combined"/);
  assert.match(source, /loadRelations\(manifest, dataBaseUrl\)/);
  assert.match(source, /sourceUnitId === resultId/);
  assert.doesNotMatch(source, /Collegamento editoriale da revisionare/);
  assert.doesNotMatch(source, /Provenienza: Circolare 7\/2019/);
  assert.match(source, /<h3><span>\{relatedUnit\.numbering\.official\}<\/span>\{relatedUnit\.title\}<\/h3>/);
  assert.doesNotMatch(source, /<span>Circolare 7\/2019 —/);
  assert.match(source, /setRelatedByTarget\(new Map\(\)\)/);
  assert.match(source, /const renderAuxiliary: ReactNode = !manifest/);
});

test("l’indice segue capitolo, paragrafo e sottoparagrafo e la lettura aggrega la continuità", async () => {
  const source = await readFile(new URL("../shared/NormativeViewer.tsx", import.meta.url), "utf8");
  assert.match(source, /unit\.hierarchy\.parentId === activeChapterId/);
  assert.match(source, /unit\.hierarchy\.parentId === activeParagraphId/);
  assert.match(source, /const detailsAnchor = activeSubparagraphId \?\? activeParagraphId/);
  assert.match(source, /maxContinuousChapterBytes/);
  assert.match(source, /scopeRecords\.map\(renderRecord\)/);
  assert.match(source, /scope\.mode === "chapter"/);
  assert.match(source, /Fine della continuità caricata/);
});

test("ricerca, settings e lazy loading sono nel layer shared", async () => {
  const source = await readFile(new URL("../shared/NormativeViewer.tsx", import.meta.url), "utf8");
  assert.match(source, /placeholder="Cerca nella normativa…"/);
  assert.match(source, /aria-label="Impostazioni consultazione"/);
  assert.match(source, /deferredQuery\.length < 2/);
  assert.match(source, /loadSearchIndex\(manifest, dataBaseUrl\)/);
  assert.match(source, /role="dialog"/);
  assert.match(source, /event\.key === "Escape"/);
  assert.match(source, /setQuery\(""\)/);
  assert.match(source, /unit\.document !== "ntc2018"/);
  assert.match(source, /unit\.document !== "circ2019"/);
});

test("il PDF resta solo nel wrapper locale e viene caricato on demand", async () => {
  const [shared, local] = await Promise.all([
    readFile(new URL("../shared/NormativeViewer.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/consultazione/OfficialPdfPanel.tsx", import.meta.url), "utf8"),
  ]);
  assert.doesNotMatch(shared, /pdfjs-dist|source-pdf/);
  assert.match(local, /import\("pdfjs-dist"\)/);
  assert.match(local, /if \(!requested\) return;/);
  assert.match(local, /source-pdf\?document=/);
});

test("renderer condiviso conserva formule, tabelle, figure lazy e numerazione", async () => {
  const [component, styles] = await Promise.all([
    readFile(new URL("../shared/CorpusContent.tsx", import.meta.url), "utf8"),
    readFile(new URL("../shared/styles.css", import.meta.url), "utf8"),
  ]);
  assert.match(component, /className="formula-row"/);
  assert.match(component, /className="formula-number"/);
  assert.match(component, /formula-scroll-long/);
  assert.match(component, /table-scroll-compact/);
  assert.match(component, /hasOfficialListMarker/);
  assert.match(component, /loading="lazy"/);
  assert.match(styles, /--scv-primary:\s*#3c52a3/iu);
  assert.match(styles, /font-family:\s*"Tinos"/);
  assert.match(styles, /font-variant-numeric:\s*lining-nums/);
  assert.match(styles, /\.scv-root \.formula-number/);
  assert.match(styles, /\.scv-root \.formula-scroll\.formula-scroll-long/);
  assert.match(styles, /list-item-with-official-marker/);
  assert.doesNotMatch(styles, /\.scv-root\s*\{[^}]*Georgia/isu);
});

test("le note editoriali delle tabelle restano escluse dalla lettura", () => {
  const editorial = ["Trascritta dal render ufficiale; revisione umana cella per cella ancora obbligatoria.", "[TABELLA_DA_VERIFICARE] Struttura e valori richiedono verifica manuale."];
  const normative = ["(*) Ponti pedonali", "I valori campiti in grigio rappresentano l’azione dominante."];
  assert.equal(editorial.every(isEditorialTableNote), true);
  assert.deepEqual(visibleTableNotes([...editorial, ...normative]), normative);
});
