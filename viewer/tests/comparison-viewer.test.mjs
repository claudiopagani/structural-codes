import assert from "node:assert/strict";
import test from "node:test";
import { readdir, readFile } from "node:fs/promises";
import { visibleTableCaption, visibleTableNumberSuffix } from "../shared/tableCaptions.mjs";

async function render(pathname) {
  const serverUrl = new URL("../dist/server/index.js", import.meta.url);
  serverUrl.searchParams.set("test", `${process.pid}-${Date.now()}-${pathname}`);
  const { default: handler } = await import(serverUrl.href);
  return handler(new Request(`http://localhost${pathname}`, { headers: { accept: "text/html" } }));
}

test("la route principale espone solo il viewer comparato", async () => {
  const response = await render("/");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /scv-root/);
  assert.match(html, /scv-index-grid/);
  assert.match(html, /Cerca nella normativa…/);
  assert.match(html, /Impostazioni consultazione/);
  assert.match(html, /scv-mode-button/);
  assert.doesNotMatch(html, /CorpusViewer|Piano di chiusura|Lettura comparata|comparison-shell/);
});

test("rifiuta richieste PDF per documenti non registrati", async () => {
  const response = await render("/api/source-pdf?document=altro");
  assert.equal(response.status, 400);
});

test("il build web non serve il PDF ufficiale", async () => {
  const response = await render("/api/source-pdf?document=ntc2018");
  assert.equal(response.status, 404);
});

test("la selezione dall'indice usa il pannello testo e preserva il deep-link", async () => {
  const source = await readFile(new URL("../shared/NormativeViewer.tsx", import.meta.url), "utf8");
  assert.match(source, /function selectUnit\(unit: UnitSummary\)/);
  assert.match(source, /textPaneRef\.current\?\.querySelector/);
  assert.match(source, /data-index-unit=/);
  assert.match(source, /updateDeepLink\(mode, unit\.id, defaultMode\)/);
  assert.match(source, /scrollRequestRef\.current = unit\.id/);
  assert.doesNotMatch(source, /window\.document\.querySelector/);
});

test("il comparato espone le tre modalità nel toolbar e non nel pannello impostazioni", async () => {
  const source = await readFile(new URL("../shared/NormativeViewer.tsx", import.meta.url), "utf8");
  assert.match(source, /defaultMode = "combined"/);
  assert.match(source, /className=\{`scv-mode-button/);
  assert.match(source, /aria-pressed=\{mode === option\.id\}/);
  assert.match(source, /Solo NTC 2018/);
  assert.match(source, /Solo Circolare 7\/2019/);
  assert.match(source, /NTC 2018 \+ Circolare 7\/2019/);
  assert.match(source, /Mostra PDF ufficiale/);
  assert.match(source, /disabled={!hasAuxiliary}/);
  assert.doesNotMatch(source, /type="radio"|analyticalHref|Apri viewer analitico/);
});

test("combined carica solo relazioni esplicite della Circolare", async () => {
  const source = await readFile(new URL("../shared/NormativeViewer.tsx", import.meta.url), "utf8");
  assert.match(source, /loadRelations\(manifest, dataBaseUrl\)/);
  assert.match(source, /sourceUnitId === resultId/);
  assert.match(source, /setRelatedByTarget\(new Map\(\)\)/);
  assert.match(source, /<h3><span className="scv-related-number">\{relatedUnit\.numbering\.official\}<\/span><span className="scv-related-title">\{relatedUnit\.title\}<\/span><\/h3>/);
  assert.doesNotMatch(source, /Collegamento editoriale da revisionare|Provenienza: Circolare 7\/2019|same-numbering/);
});

test("l'indice segue lo scroll e il testo resta un flusso continuo", async () => {
  const [source, styles] = await Promise.all([
    readFile(new URL("../shared/NormativeViewer.tsx", import.meta.url), "utf8"),
    readFile(new URL("../shared/styles.css", import.meta.url), "utf8"),
  ]);
  assert.match(source, /const documentChunkPaths = useMemo/);
  assert.match(source, /Promise\.all\(documentChunkPaths\.map/);
  assert.match(source, /root\.addEventListener\("scroll"/);
  assert.match(source, /setActiveUnitId\(nextId\)/);
  assert.match(source, /documentRecords\.map\(renderRecord\)/);
  assert.match(source, /const activeLevelId = \[activeChapterId, activeParagraphId, activeSubparagraphId\]/);
  assert.match(styles, /\.scv-index-grid \{[^}]*grid-template-columns: minmax\(0, 1fr\);[^}]*grid-template-rows: repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(styles, /\.scv-index-list \{[^}]*overflow: auto/);
  assert.match(styles, /\.scv-chapter-heading/);
  assert.match(styles, /\.scv-block p \{[^}]*text-align: justify/);
  assert.match(source, /Fine del documento/);
});

test("il PDF resta locale/debug, viene caricato on demand e segue la pagina evidence", async () => {
  const [shared, wrapper, official, comparison] = await Promise.all([
    readFile(new URL("../shared/NormativeViewer.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/OfficialPdfPanel.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/source-pdf/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/ComparisonViewer.tsx", import.meta.url), "utf8"),
  ]);
  assert.doesNotMatch(shared, /pdfjs-dist|source-pdf/);
  assert.match(wrapper, /import\("pdfjs-dist"\)/);
  assert.match(wrapper, /if \(!requested\) return;/);
  assert.match(wrapper, /source-pdf\?document=/);
  assert.match(wrapper, /scrollIntoView\(\{ block: "start" \}\)/);
  assert.match(wrapper, /data-pdf-page=\{pageNumber\}/);
  assert.match(official, /request\.headers\.get\("range"\)/);
  assert.match(official, /Documento non valido/);
  assert.match(comparison, /process\.env\.NODE_ENV !== "production"/);
  assert.match(comparison, /NEXT_PUBLIC_VIEWER_DEBUG_PDF/);
});

test("il renderer unico conserva formule, tabelle, figure ed elenchi strutturati", async () => {
  const [component, styles] = await Promise.all([
    readFile(new URL("../shared/CorpusContent.tsx", import.meta.url), "utf8"),
    readFile(new URL("../shared/styles.css", import.meta.url), "utf8"),
  ]);
  assert.match(component, /className="formula-row"/);
  assert.match(component, /className="formula-number"/);
  assert.match(component, /className="formula-scroll"/);
  assert.match(component, /visibleTableCaption\(table\.officialNumber, table\.caption\)/);
  assert.match(component, /visibleTableNumberSuffix\(table\.officialNumber, table\.caption\)/);
  assert.match(component, /tableAssetClass/);
  assert.match(component, /hasAlphabeticListMarker/);
  assert.match(component, /groupAlignedLabelBlocks/);
  assert.match(component, /loading="lazy"/);
  assert.doesNotMatch(component, /variant: "scv" \| "legacy"|UnitBlocks|normative-copy/);
  assert.match(styles, /--scv-primary:\s*#3c52a3/iu);
  assert.match(styles, /font-family:\s*"Tinos"/);
  assert.match(styles, /\.scv-root \.formula-number/);
  assert.match(styles, /\.scv-root \.table-asset table/);
  assert.match(styles, /\.scv-root \.figure-asset figcaption/);
  assert.doesNotMatch(styles, /legacy-base-font-size|comparison-shell/);
});

test("le unità Circolare C4, C6 e C7 dichiarano il titolo strutturale", async () => {
  const unitsDirectory = new URL("../../corpus/units/circ2019/", import.meta.url);
  const files = (await readdir(unitsDirectory)).filter((file) => file.endsWith(".json"));
  const units = await Promise.all(files.map(async (file) => JSON.parse(await readFile(new URL(file, unitsDirectory), "utf8"))));
  const selected = units.filter((unit) => /^(C4|C6|C7)(?:\.|$)/.test(unit.numbering.official));
  assert.equal(selected.length, 372);
  assert.ok(selected.every((unit) => unit.titleBlockId));
  assert.ok(selected.every((unit) => unit.blocks[0]?.blockId === unit.titleBlockId));
});

test("le didascalie mantengono la numerazione ufficiale senza duplicarla", () => {
  assert.equal(visibleTableCaption("C11.3.4.11.2.I", "Tabella C11.3.4.11.2.I"), "");
  assert.equal(visibleTableCaption("11.3.VI b", "Tab. 11.3.VI b)"), "");
  assert.equal(visibleTableCaption("C2.4.I", "Tabella C2.4.I – Intervalli di valori attribuiti a VR"), "Intervalli di valori attribuiti a VR");
  assert.equal(visibleTableNumberSuffix("11.3.VI b", "Tab. 11.3.VI b)"), ")");
  assert.equal(visibleTableNumberSuffix("C11.3.4.11.2.I", "Tabella C11.3.4.11.2.I"), "");
});
