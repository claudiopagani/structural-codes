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
  assert.match(source, /<>NTC<br \/>2018<\/>/);
  assert.match(source, /<>CIRC\.<br \/>2019<\/>/);
  assert.match(source, /<>NTC<br \/>CIRC\.<\/>/);
  assert.match(source, /function ModeSegmentedControl\(/);
  assert.match(source, /className="scv-mode-switch" role="group"/);
  assert.match(source, /<ModeSegmentedControl mode=\{mode\} onChange=\{changeMode\} \/>/);
  assert.match(source, /Mostra PDF ufficiale/);
  assert.match(source, /const auxiliaryAvailable = hasAuxiliary && mode !== "combined"/);
  assert.match(source, /disabled={!auxiliaryAvailable}/);
  assert.doesNotMatch(source, /type="radio"|analyticalHref|Apri viewer analitico/);
});

test("combined carica solo relazioni esplicite della Circolare", async () => {
  const source = await readFile(new URL("../shared/NormativeViewer.tsx", import.meta.url), "utf8");
  assert.match(source, /loadRelations\(manifest, dataBaseUrl\)/);
  assert.match(source, /sourceUnitId === resultId/);
  assert.match(source, /setRelatedByTarget\(new Map\(\)\)/);
  assert.match(source, /<h3><span className="scv-related-number">\{relatedUnit\.numbering\.official\}<\/span><span className="scv-related-title">\{relatedUnit\.title\}<\/span><\/h3>/);
  assert.match(source, /function hasUnitContent\(unit: CorpusUnit\)/);
  assert.match(source, /if \(mode === "combined" && !hasUnitContent\(unit\) && relatedRecords\.length === 0\) return null/);
  assert.match(source, /filter\(\(\{ unit: relatedUnit \}\) => hasUnitContent\(relatedUnit\)\)/);
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
  assert.match(shared, /const auxiliaryAvailable = hasAuxiliary && mode !== "combined"/);
  assert.match(shared, /auxiliaryVisible && auxiliaryAvailable && renderAuxiliary/);
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
  assert.match(styles, /grid-template-columns: minmax\(0, 1fr\) auto var\(--scv-toolbar-button-size\)/);
  assert.match(styles, /--scv-index-width: clamp\(360px, 37vw, 480px\)/);
  assert.match(styles, /grid-template-columns: var\(--scv-index-width\) minmax\(0, 1fr\)/);
  assert.match(styles, /grid-template-columns: var\(--scv-index-width\) minmax\(0, 1fr\) minmax\(320px, \.8fr\)/);
  assert.match(styles, /\.scv-text-flow \{ width: min\(100%, 860px\);[^}]*padding: 23px 36px 55vh/);
  assert.match(styles, /aspect-ratio: 1/);
  assert.match(styles, /\.scv-root \.scv-settings-button, \.scv-root \.scv-mode-button \{[^}]*font-weight: 900[^}]*background: var\(--scv-primary-soft\)/);
  assert.match(styles, /\.scv-root \.scv-mode-switch \.scv-mode-button \{[^}]*font-family: "Segoe UI"[^}]*font-size: 8px[^}]*font-weight: 700/);
  assert.match(styles, /\.scv-root \.scv-mode-button span \{[^}]*transform: scaleY\(1\.35\)/);
  assert.match(styles, /\.scv-root \.scv-settings-button \{[^}]*font-size: 16px/);
  assert.match(styles, /\.scv-root \.inline-math \{[^}]*font-size: 1\.04em/);
  assert.match(styles, /\.scv-root \.inline-math \.katex \{[^}]*font-size: 1em/);
  assert.match(styles, /\.scv-root \.figure-asset img \{[^}]*width: min\(100%, 760px\)[^}]*height: auto[^}]*max-height: min\(600px, 70vh\)/);
  assert.doesNotMatch(styles, /legacy-base-font-size|comparison-shell/);
});

test("i blocchi Circolare composti solo dal titolo non entrano nel comparato", async () => {
  const unitsDirectory = new URL("../../corpus/units/circ2019/", import.meta.url);
  const [c3, c31] = await Promise.all(["c3.json", "c3.1.json"].map(async (file) => JSON.parse(await readFile(new URL(file, unitsDirectory), "utf8"))));
  assert.ok(c3.blocks.every((block) => block.kind === "heading"));
  assert.ok(c31.blocks.every((block) => block.kind === "heading"));
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
