import assert from "node:assert/strict";
import test from "node:test";
import { readdir, readFile } from "node:fs/promises";
import { isEditorialTableNote, visibleTableNotes } from "../app/tableNotes.mjs";
import { visibleTableCaption, visibleTableNumberSuffix } from "../shared/tableCaptions.mjs";

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

test("la selezione dall'indice usa il pannello testo e preserva il deep-link", async () => {
  const source = await readFile(new URL("../shared/NormativeViewer.tsx", import.meta.url), "utf8");
  assert.match(source, /function selectUnit\(unit: UnitSummary\)/);
  assert.match(source, /textPaneRef\.current\?\.querySelector/);
  assert.match(source, /data-index-unit=/);
  assert.match(source, /updateDeepLink\(mode, unit\.id, defaultMode\)/);
  assert.match(source, /scrollRequestRef\.current = unit\.id/);
  assert.doesNotMatch(source, /window\.document\.querySelector/);
});

test("combined è il default e le relazioni restano esplicite", async () => {
  const source = await readFile(new URL("../shared/NormativeViewer.tsx", import.meta.url), "utf8");
  assert.match(source, /defaultMode = "combined"/);
  assert.match(source, /loadRelations\(manifest, dataBaseUrl\)/);
  assert.match(source, /sourceUnitId === resultId/);
  assert.doesNotMatch(source, /Collegamento editoriale da revisionare/);
  assert.doesNotMatch(source, /Provenienza: Circolare 7\/2019/);
  assert.match(source, /<h3><span className="scv-related-number">\{relatedUnit\.numbering\.official\}<\/span><span className="scv-related-title">\{relatedUnit\.title\}<\/span><\/h3>/);
  assert.doesNotMatch(source, /<span>Circolare 7\/2019 —/);
  assert.match(source, /setRelatedByTarget\(new Map\(\)\)/);
  assert.match(source, /const renderAuxiliary: ReactNode = !manifest/);
});

test("l’indice segue lo scroll e la lettura mantiene l’intero documento in continuità", async () => {
  const [source, styles] = await Promise.all([
    readFile(new URL("../shared/NormativeViewer.tsx", import.meta.url), "utf8"),
    readFile(new URL("../shared/styles.css", import.meta.url), "utf8"),
  ]);
  assert.match(source, /unit\.hierarchy\.parentId === activeChapterId/);
  assert.match(source, /unit\.hierarchy\.parentId === activeParagraphId/);
  assert.match(source, /const documentChunkPaths = useMemo/);
  assert.match(source, /Promise\.all\(documentChunkPaths\.map/);
  assert.match(source, /root\.addEventListener\("scroll"/);
  assert.match(source, /setActiveUnitId\(nextId\)/);
  assert.match(source, /documentRecords\.map\(renderRecord\)/);
  assert.match(source, /const activeLevelId = \[activeChapterId, activeParagraphId, activeSubparagraphId\]/);
  assert.match(source, /scv-chapter-heading/);
  assert.match(source, /scv-chapter-badge-label/);
  assert.match(source, /Fine del documento/);
  assert.match(styles, /\.scv-index-grid \{[^}]*grid-template-columns: minmax\(0, 1fr\);[^}]*grid-template-rows: repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(styles, /\.scv-index-list \{[^}]*overflow: auto/);
  assert.match(styles, /\.scv-chapter-heading/);
  assert.match(styles, /\.scv-unit-depth-1 h2 \{[^}]*font-size: var\(--scv-font-size-18\)/);
  assert.match(styles, /\.scv-unit-depth-2 h2 \{[^}]*padding-left: 0;[^}]*border-left: 0;[^}]*font-size: var\(--scv-font-size-14\)/);
  assert.match(styles, /\.scv-block p \{[^}]*text-align: justify/);
  assert.match(styles, /\.scv-root \.table-asset table \{[^}]*font-family: "Tinos", serif;[^}]*font-size: var\(--scv-base-font-size\)/);
  assert.match(styles, /\.scv-root \.table-asset table \.table-math \.katex \{[^}]*font-size: 1em/);
  assert.match(styles, /\.scv-root \.table-asset figcaption \{[^}]*font-family: "Tinos", serif;[^}]*font-size: var\(--scv-font-size-12\)/);
  assert.match(styles, /\.scv-root \.figure-asset figcaption \{[^}]*font-family: "Tinos", serif;[^}]*font-size: var\(--scv-font-size-12\)/);
  assert.match(styles, /\.scv-root \.table-notes \{[^}]*font-family: "Tinos", serif;[^}]*font-size: var\(--scv-font-size-12\)/);
  assert.doesNotMatch(source, /Dettagli/);
  assert.doesNotMatch(source, /maxContinuousChapter/);
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
  const [component, styles, legacyStyles, sharedViewer, legacyViewer] = await Promise.all([
    readFile(new URL("../shared/CorpusContent.tsx", import.meta.url), "utf8"),
    readFile(new URL("../shared/styles.css", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../shared/NormativeViewer.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/CorpusViewer.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(component, /className="formula-row"/);
  assert.match(component, /className="formula-number"/);
  assert.match(component, /className="formula-scroll"/);
  assert.doesNotMatch(component, /Formula non numerata/);
  assert.match(component, /visibleTableCaption\(table\.officialNumber, table\.caption\)/);
  assert.match(component, /visibleTableNumberSuffix\(table\.officialNumber, table\.caption\)/);
  assert.match(component, /tableAssetClass/);
  assert.match(component, /table\.captionInline \? renderInlineSegments\(table\.captionInline\) : caption/);
  assert.match(component, /inline\.length === 2 && inline\.at\(-1\)\?\.kind === "math"/);
  assert.match(component, /\(label \|\| caption\) && <figcaption>/);
  assert.match(component, /table-scroll-compact/);
  assert.match(component, /hasOfficialListMarker/);
  assert.match(component, /hasAlphabeticListMarker/);
  assert.match(component, /hasSimpleDashMarker/);
  assert.match(component, /!hasTrailingStrong\(block\)/);
  assert.match(component, /!hasTrailingMath\(block\)/);
  assert.match(component, /hasLeadingEmphasisLabel/);
  assert.match(component, /block-with-leading-label/);
  assert.match(component, /leading-label-description/);
  assert.match(component, /cell\.inline/);
  assert.match(component, /loading="lazy"/);
  assert.match(styles, /--scv-primary:\s*#3c52a3/iu);
  assert.match(styles, /font-family:\s*"Tinos"/);
  assert.match(styles, /font-variant-numeric:\s*lining-nums/);
  assert.match(styles, /\.scv-root \.formula-number/);
  assert.match(styles, /\.scv-root \.formula-scroll \{[^}]*font-size:\s*calc\(var\(--scv-base-font-size\)/);
  assert.match(styles, /\.scv-root \.formula-scroll \.katex-display \{[^}]*margin:\s*\.5em 0/);
  assert.match(legacyStyles, /\.formula-scroll \{[^}]*font-size:\s*calc\(var\(--legacy-base-font-size\)/);
  assert.match(legacyStyles, /\.formula-scroll \.katex-display \{[^}]*margin:\s*0\.5em 0/);
  assert.match(legacyStyles, /\.text-block p \{[^}]*text-align: justify/);
  assert.match(legacyStyles, /\.table-asset table \.table-math \.katex \{[^}]*font-size: 1em/);
  assert.match(component, /leadingLabelKind/);
  assert.match(component, /groupAlignedLabelBlocks/);
  assert.match(sharedViewer, /<AlignedLabelList/);
  assert.match(sharedViewer, /hasAlphabeticListMarker/);
  assert.match(sharedViewer, /hasSimpleDashMarker/);
  assert.match(sharedViewer, /scv-unit-title/);
  assert.match(sharedViewer, /scv-related-title/);
  assert.match(legacyViewer, /<AlignedLabelList/);
  assert.match(legacyViewer, /hasAlphabeticListMarker/);
  assert.match(legacyViewer, /hasSimpleDashMarker/);
  assert.match(legacyViewer, /hasTrailingStrong/);
  assert.match(styles, /list-item-with-official-marker/);
  assert.match(styles, /list-item-with-alphabetic-marker/);
  assert.match(styles, /list-item-with-simple-dash/);
  assert.match(styles, /\.scv-unit h2 \{[^}]*grid-template-columns:\s*max-content minmax\(0, 1fr\)/);
  assert.match(styles, /\.scv-unit h2 > \.scv-unit-title \{[^}]*min-width:\s*0/);
  assert.match(styles, /\.scv-related-unit > header h3 \{[^}]*grid-template-columns:\s*max-content minmax\(0, 1fr\)/);
  assert.match(styles, /text-indent:\s*calc\(-1 \* var\(--scv-list-marker-width\)\)/);
  assert.match(styles, /list-item-with-alphabetic-marker p \.inline-math/);
  assert.match(styles, /list-item-with-leading-symbol p > \.inline-math:first-child/);
  assert.match(styles, /\.scv-label-list \{[^}]*grid-template-columns:\s*max-content minmax\(0, 1fr\)/);
  assert.match(component, /block\.kind === "list-item" && block\.listMarker === "none"/);
  assert.match(styles, /\.scv-label-list-row, \.scv-label-list-content \{[^}]*display:\s*contents/);
  assert.match(styles, /leading-math-description/);
  assert.match(styles, /list-item-with-bullet/);
  assert.match(styles, /list-item-level-1/);
  assert.match(styles, /table-cell-multiline/);
  assert.match(styles, /table-asset-3-5-iv table \{[^}]*table-layout:\s*fixed/);
  assert.match(styles, /table-asset-3-5-iv th:first-child[^}]*width:\s*6\.25em/);
  assert.match(styles, /block-with-leading-label p \{[^}]*grid-template-columns: max-content minmax\(0, 1fr\)/);
  assert.match(legacyStyles, /list-item-with-leading-symbol p > \.inline-math:first-child/);
  assert.match(legacyStyles, /\.label-list \{[^}]*grid-template-columns:\s*54px max-content minmax\(0, 1fr\)/);
  assert.match(legacyStyles, /\.label-list-row, \.label-list-content \{[^}]*display:\s*contents/);
  assert.match(legacyStyles, /leading-math-description/);
  assert.match(legacyStyles, /list-item-with-bullet/);
  assert.match(legacyStyles, /list-item-with-alphabetic-marker/);
  assert.match(legacyStyles, /list-item-with-simple-dash/);
  assert.match(legacyStyles, /\.article-title-row \{[^}]*grid-template-columns:\s*max-content minmax\(0, 1fr\)/);
  assert.match(legacyStyles, /text-indent:\s*calc\(-1 \* var\(--legacy-list-marker-width\)\)/);
  assert.match(legacyStyles, /list-item-with-alphabetic-marker p \.inline-math/);
  assert.match(legacyStyles, /list-item-level-1/);
  assert.match(legacyStyles, /text-block\.block-with-leading-label p \{[^}]*grid-template-columns: max-content minmax\(0, 1fr\)/);
  assert.match(legacyStyles, /table-asset-3-5-iv table \{[^}]*table-layout:\s*fixed/);
  assert.match(legacyStyles, /table-asset-3-5-iv th:first-child,[^}]*table-asset-3-5-iv td:first-child[^}]*width:\s*6\.25em/s);
  assert.doesNotMatch(styles, /grid-template-columns:\s*6\.5em/);
  assert.doesNotMatch(legacyStyles, /grid-template-columns:\s*6\.5em/);
  assert.doesNotMatch(styles, /\.scv-root\s*\{[^}]*Georgia/isu);
});

test("gli elenchi alfabetici separano il label dalla descrizione e gli elenchi innestati usano il livello", async () => {
  const [unit, component, styles, legacyStyles] = await Promise.all([
    readFile(new URL("../../corpus/units/ntc2018/2.5.1.3.json", import.meta.url), "utf8").then(JSON.parse),
    readFile(new URL("../shared/CorpusContent.tsx", import.meta.url), "utf8"),
    readFile(new URL("../shared/styles.css", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  const items = unit.blocks.filter((block) => block.kind === "list-item");
  assert.match(component, /renderAlphabeticListContent/);
  assert.match(component, /list-marker-label/);
  assert.match(component, /list-description/);
  assert.match(component, /if \(!block\.text\.inline\) return <p>\{block\.text\.normalized\}<\/p>/);
  assert.equal(items.filter((block) => block.listLevel === 0).length, 4);
  assert.equal(items.filter((block) => block.listMarker === "dash" && block.listLevel === 1).length, 11);
  assert.match(styles, /\.scv-block-list-item\.list-item-with-alphabetic-marker p \{[\s\S]*?display:\s*grid[\s\S]*?grid-template-columns:\s*max-content minmax\(0, 1fr\)/);
  assert.match(legacyStyles, /\.list-item-block\.list-item-with-alphabetic-marker p \{[\s\S]*?display:\s*grid[\s\S]*?grid-template-columns:\s*max-content minmax\(0, 1fr\)/);
  assert.match(styles, /\.scv-block-list-item\.list-item-with-alphabetic-marker p \{[\s\S]*?column-gap:\s*0\.35em/);
  assert.match(legacyStyles, /\.list-item-block\.list-item-with-alphabetic-marker p \{[\s\S]*?column-gap:\s*0\.35em/);
  assert.match(styles, /\.scv-block-list-item\.list-item-with-simple-dash\.list-item-level-1,[\s\S]*?padding-left:\s*var\(--scv-list-marker-width\)/);
  assert.match(legacyStyles, /\.list-item-block\.list-item-with-simple-dash\.list-item-level-1,[\s\S]*?padding-left:\s*var\(--legacy-list-marker-width\)/);
});

test("i renderer escludono il blocco titolo strutturale senza perdere i sottotitoli", async () => {
  const [content, sharedViewer, legacyViewer, dataTypes] = await Promise.all([
    readFile(new URL("../shared/CorpusContent.tsx", import.meta.url), "utf8"),
    readFile(new URL("../shared/NormativeViewer.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/CorpusViewer.tsx", import.meta.url), "utf8"),
    readFile(new URL("../shared/corpusData.ts", import.meta.url), "utf8"),
  ]);
  assert.match(dataTypes, /titleBlockId\?: string/);
  assert.match(content, /unit\.titleBlockId && block\.blockId === unit\.titleBlockId/);
  assert.match(sharedViewer, /unit\.blocks\.filter\(\(block\) => !isRepeatedUnitTitle\(unit, block\)\)/);
  assert.match(legacyViewer, /isRepeatedUnitTitle/);
  assert.match(legacyViewer, /unit\.blocks\.filter\(\(block\) => !isRepeatedUnitTitle\(unit, block\)\)/);
});

test("C4, C6 e C7 dichiarano il blocco titolo strutturale in testa a ogni unità", async () => {
  const unitsDirectory = new URL("../../corpus/units/circ2019/", import.meta.url);
  const files = (await readdir(unitsDirectory)).filter((file) => file.endsWith(".json"));
  const units = await Promise.all(files.map(async (file) => JSON.parse(await readFile(new URL(file, unitsDirectory), "utf8"))));
  const selected = units.filter((unit) => /^(C4|C6|C7)(?:\.|$)/.test(unit.numbering.official));
  assert.equal(selected.length, 372);
  assert.ok(selected.every((unit) => unit.titleBlockId));
  assert.ok(selected.every((unit) => unit.blocks[0]?.blockId === unit.titleBlockId));
});

test("la scala tipografica del contenuto deriva dalla dimensione base", async () => {
  const [sharedStyles, legacyStyles] = await Promise.all([
    readFile(new URL("../shared/styles.css", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.match(sharedStyles, /\.scv-root \{[^}]*--scv-base-font-size:\s*15px/isu);
  assert.match(sharedStyles, /--scv-font-size-12:\s*calc\(var\(--scv-base-font-size\)/);
  assert.match(sharedStyles, /\.scv-block p \{[^}]*font-size:\s*var\(--scv-base-font-size\)/);
  assert.match(sharedStyles, /\.scv-root \.formula-scroll \{[^}]*font-size:\s*calc\(var\(--scv-base-font-size\)/);
  assert.match(sharedStyles, /\.scv-root \.table-asset table \{[^}]*font-size:\s*var\(--scv-base-font-size\)/);
  assert.match(legacyStyles, /\.normative-copy \{[^}]*--legacy-base-font-size:\s*20px/isu);
  assert.match(legacyStyles, /\.text-block p \{[^}]*font-size:\s*var\(--legacy-base-font-size\)/);
  assert.match(legacyStyles, /\.table-asset table \{[^}]*font-size:\s*var\(--legacy-font-size-12\)/);
  assert.match(legacyStyles, /\.figure-asset figcaption \{[^}]*font-size:\s*var\(--legacy-font-size-11\)/);
});

test("riconosce le didascalie costituite dal solo numero ufficiale", () => {
  assert.equal(visibleTableCaption("C11.3.4.11.2.I", "Tabella C11.3.4.11.2.I"), "");
  assert.equal(visibleTableCaption("11.3.VI b", "Tab. 11.3.VI b)"), "");
  assert.equal(
    visibleTableCaption("C2.4.I", "Tabella C2.4.I – Intervalli di valori attribuiti a VR"),
    "Intervalli di valori attribuiti a VR",
  );
  assert.equal(visibleTableNumberSuffix("11.3.VI b", "Tab. 11.3.VI b)"), ")");
  assert.equal(visibleTableNumberSuffix("C11.3.4.11.2.I", "Tabella C11.3.4.11.2.I"), "");
});

test("le note editoriali delle tabelle restano escluse dalla lettura", () => {
  const editorial = ["Trascritta dal render ufficiale; revisione umana cella per cella ancora obbligatoria.", "[TABELLA_DA_VERIFICARE] Struttura e valori richiedono verifica manuale."];
  const normative = ["(*) Ponti pedonali", "I valori campiti in grigio rappresentano l’azione dominante."];
  assert.equal(editorial.every(isEditorialTableNote), true);
  assert.deepEqual(visibleTableNotes([...editorial, ...normative]), normative);
});
