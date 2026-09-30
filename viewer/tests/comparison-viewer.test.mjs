import assert from "node:assert/strict";
import test from "node:test";
import { readdir, readFile } from "node:fs/promises";
import { groupAlignedLabelBlocks, hasAlphaRatioListLayout, hasInferredAlphaRatioListMarker, hasLeadingEmphasisLabel, hasTrailingMath, leadingMathLabelEnd } from "../package-dist/CorpusContent.js";
import { visibleTableCaption, visibleTableNumberSuffix } from "../shared/tableCaptions.mjs";

async function render(pathname) {
  const serverUrl = new URL("../dist/server/index.js", import.meta.url);
  serverUrl.searchParams.set("test", `${process.pid}-${Date.now()}-${pathname}`);
  const { default: handler } = await import(serverUrl.href);
  return handler(new Request(`http://localhost${pathname}`, { headers: { accept: "text/html" } }));
}

function schemaLoadBlock(number) {
  return {
    blockId: `schema-${number}`,
    kind: "list-item",
    listMarker: "none",
    text: {
      normalized: `Schema di Carico ${number}: descrizione`,
      inline: [
        { kind: "em", value: `Schema di Carico ${number}:` },
        { kind: "text", value: " descrizione" },
      ],
    },
  };
}

function strongLabelBlock(label) {
  return {
    blockId: `strong-${label}`,
    kind: "list-item",
    listMarker: "none",
    listLevel: 0,
    text: {
      normalized: `${label} descrizione`,
      inline: [
        { kind: "strong", value: label },
        { kind: "text", value: " descrizione" },
      ],
    },
  };
}

test("multi-symbol math labels keep the complete label aligned", () => {
  const inline = [
    { kind: "math", value: "M_{Ed}", latex: "M_{Ed}" },
    { kind: "text", value: ", " },
    { kind: "math", value: "N_{Ed}", latex: "N_{Ed}" },
    { kind: "text", value: " e " },
    { kind: "math", value: "V_{Ed}", latex: "V_{Ed}" },
    { kind: "text", value: " sono i valori della domanda;" },
  ];
  assert.equal(leadingMathLabelEnd(inline), 5);
});

test("le formule terminali degli elenchi usano un layout strutturale", async () => {
  const unit = JSON.parse(await readFile(new URL("../../corpus/units/circ2019/c7.6.8.json", import.meta.url), "utf8"));
  const items = unit.blocks.filter((block) => block.kind === "list-item");
  assert.equal(items.length, 2);
  assert.equal(items.every(hasTrailingMath), true);
  assert.equal(hasTrailingMath({
    kind: "list-item",
    text: { normalized: "testo x;", inline: [
      { kind: "text", value: "testo " },
      { kind: "math", value: "x", latex: "x" },
      { kind: "text", value: ";" },
    ] },
  }), true);
  assert.equal(hasTrailingMath({
    kind: "list-item",
    text: { normalized: "testo x seguito", inline: [
      { kind: "text", value: "testo " },
      { kind: "math", value: "x", latex: "x" },
      { kind: "text", value: " seguito" },
    ] },
  }), false);
});

test("le voci αu/α1 mantengono il marker ufficiale anche con chunk legacy", () => {
  const block = {
    kind: "list-item",
    text: {
      normalized: "edifici a un piano α_u/α_1 = 1,1",
      inline: [
        { kind: "text", value: "edifici a un piano " },
        { kind: "math", value: "α_u/α_1 = 1,1", latex: "\\alpha_u/\\alpha_1=1{,}1" },
      ],
    },
  };
  assert.equal(hasAlphaRatioListLayout(block, "urn:structural-codes:it:unit:ntc2018:7.5.2.2"), true);
  assert.equal(hasInferredAlphaRatioListMarker(block, "urn:structural-codes:it:unit:ntc2018:7.5.2.2"), true);
});

test("allinea le descrizioni degli schemi di carico dopo l'etichetta", () => {
  const blocks = [1, 2, 3, 4, 5, 6].map(schemaLoadBlock);
  assert.equal(hasLeadingEmphasisLabel(blocks[0]), true);
  const [group] = groupAlignedLabelBlocks(blocks);
  assert.equal(group.kind, "label-list");
  assert.equal(group.blocks.length, 6);
});

test("allinea le descrizioni delle liste con etichetta in grassetto", () => {
  const blocks = ["EQU", "STR", "GEO"].map(strongLabelBlock);
  assert.equal(hasLeadingEmphasisLabel(blocks[0]), true);
  const [group] = groupAlignedLabelBlocks(blocks);
  assert.equal(group.kind, "label-list");
  assert.equal(group.blocks.length, 3);
});

test("mantiene upright l'unità m nella didascalia della Fig. 5.1.2", async () => {
  const manifest = JSON.parse(await readFile(new URL("../../corpus/assets/ntc2018/5.1-step1.json", import.meta.url), "utf8"));
  const figure = manifest.figures.find(({ officialNumber }) => officialNumber === "5.1.2");
  assert.deepEqual(figure?.captionInline, [
    { kind: "text", value: "Fig. 5.1.2 - " },
    { kind: "em", value: "Schemi di carico 1 – 5 (dimensioni in " },
    { kind: "math", value: "m", latex: "\\mathrm{m}" },
    { kind: "em", value: ")" },
  ]);
});

test("rende in KaTeX i simboli q dei titoli 5.1.3.3–5.1.3.11", async () => {
  for (let index = 1; index <= 9; index += 1) {
    const number = `5.1.3.${index + 2}`;
    const unit = JSON.parse(await readFile(new URL(`../../corpus/units/ntc2018/${number}.json`, import.meta.url), "utf8"));
    const math = unit.blocks[0]?.text?.inline?.at(-1);
    assert.deepEqual(math, { kind: "math", value: `q${index}`, latex: `q_{${index}}` });
  }
});

test("mantiene i crop corretti delle figure e il layout editoriale delle tabelle NTC 5.1", async () => {
  const [step1, step2] = await Promise.all([
    readFile(new URL("../../corpus/assets/ntc2018/5.1-step1.json", import.meta.url), "utf8").then(JSON.parse),
    readFile(new URL("../../corpus/assets/ntc2018/5.1-step2.json", import.meta.url), "utf8").then(JSON.parse),
  ]);
  const figure = step1.figures.find(({ officialNumber }) => officialNumber === "5.1.3.b");
  assert.deepEqual(figure?.region, { coordinateSystem: "pdf-points-top-left", x: 335, y: 455, width: 125, height: 80 });
  const table = step1.tables.find(({ officialNumber }) => officialNumber === "5.1.IV");
  assert.deepEqual(table?.columnWidths, [11, 15, 11, 14, 13, 13, 23]);
  assert.equal(table?.rows[0][1].shade, "gray");
  assert.equal(table?.rows[5][2].shade, "gray");
  const tableVII = step2.tables.find(({ officialNumber }) => officialNumber === "5.1.VII");
  assert.deepEqual(tableVII?.columnWidths, [26, 24, 30, 20]);
});

test("rende apici e simboli Ψ nelle note delle tabelle NTC 5.2", async () => {
  const [step3, step4] = await Promise.all([
    readFile(new URL("../../corpus/assets/ntc2018/5.1-step3.json", import.meta.url), "utf8").then(JSON.parse),
    readFile(new URL("../../corpus/assets/ntc2018/5.1-step4.json", import.meta.url), "utf8").then(JSON.parse),
  ]);
  const tableIII = step3.tables.find(({ officialNumber }) => officialNumber === "5.2.III");
  const tableIV = step4.tables.find(({ officialNumber }) => officialNumber === "5.2.IV");
  const tableV = step4.tables.find(({ officialNumber }) => officialNumber === "5.2.V");
  const tableVI = step4.tables.find(({ officialNumber }) => officialNumber === "5.2.VI");
  const tableVII = step4.tables.find(({ officialNumber }) => officialNumber === "5.2.VII");
  assert.equal(tableIII?.notesInline[0][0].latex, "^{(1)}");
  assert.equal(tableIV?.notesInline[0][0].latex, "^{(1)}");
  assert.equal(tableV?.notesInline[0][0].latex, "^{(1)}");
  assert.equal(tableVI?.notesInline[1].some(({ latex }) => latex === "\\psi_0"), true);
  assert.equal(tableVII?.notesInline[2].some(({ latex }) => latex === "\\psi_0"), true);
});

test("la route principale espone solo il viewer comparato", async () => {
  const response = await render("/");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /scv-root/);
  assert.match(html, /scv-index-grid/);
  assert.match(html, /Cerca nella normativa…/);
  assert.match(html, /Attiva modalità notte/);
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
  assert.match(source, /const selectUnit = useCallback\(\(unit: UnitSummary\)/);
  assert.match(source, /function scrollTextUnit\(root: HTMLElement \| null, unitId: string\)/);
  assert.match(source, /root\.scrollTo\(\{ top:/);
  assert.match(source, /scrollTextUnit\(textPaneRef\.current, unit\.id\)/);
  assert.match(source, /data-index-unit=/);
  assert.match(source, /updateDeepLink\(navigationRef\.current\.mode, requestedTargetRef\.current, defaultMode\)/);
  assert.match(source, /scrollRequestRef\.current = requestedTargetRef\.current/);
  assert.doesNotMatch(source, /window\.document\.querySelector/);
});

test("il comparato espone le tre modalità e il tema direttamente nel toolbar", async () => {
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
  assert.match(source, /<ModeSegmentedControl mode=\{mode\} onChange=\{onModeChange\} \/>/);
  assert.match(source, /const \[darkMode, setDarkMode\] = useState<boolean \| null>\(null\)/);
  assert.match(source, /localStorage\.getItem\("scv-theme"\)/);
  assert.match(source, /className=\{`scv-root \$\{darkMode \? "scv-dark"/);
  assert.match(source, /className="scv-theme-button"/);
  assert.match(source, /darkMode \? "Attiva modalità giorno" : "Attiva modalità notte"/);
  assert.match(source, /aria-pressed=\{darkMode\}/);
  assert.match(source, /className="scv-control-tooltip" role="tooltip"/);
  assert.doesNotMatch(source, /⚙|Impostazioni consultazione|scv-settings-button/);
  assert.match(source, /auxiliaryPanelModes \? auxiliaryPanelModes.includes\(mode\) : mode !== "combined"/);
  assert.doesNotMatch(source, /type="radio"|analyticalHref|Apri viewer analitico/);
});

test("su mobile ricerca e comandi occupano la testata corretta, su desktop la barra resta invariata", async () => {
  const [source, styles] = await Promise.all([
    readFile(new URL("../shared/NormativeViewer.tsx", import.meta.url), "utf8"),
    readFile(new URL("../shared/styles.css", import.meta.url), "utf8"),
  ]);
  assert.match(source, /const mobileSearchRef = useRef<HTMLInputElement>\(null\)/);
  assert.match(source, /<SearchBox className="scv-mobile-search"[^]*onSearchResult=\{selectSearchResult\}/);
  assert.ok(source.indexOf('className="scv-mobile-index-toggle"') < source.indexOf('className="scv-mobile-search"'));
  assert.ok(source.indexOf('className="scv-mobile-search"') < source.indexOf('className="scv-tools-toggle"'));
  assert.match(source, /className="scv-index-controls"/);
  assert.doesNotMatch(source, /scv-index-settings-toggle|SettingsIcon/);
  assert.match(source, /querySelectorAll<HTMLElement>\("\.scv-mobile-search, \.scv-mobile-context"\)/);
  assert.match(source, /getBoundingClientRect\(\)\.bottom - rootTop \+ 10/);
  assert.match(styles, /\.scv-search-toolbar \{[^}]*align-items: center/);
  assert.match(styles, /\.scv-history-controls \{[^}]*align-items: center/);
  assert.match(styles, /\.scv-history-controls button \{[^}]*display: grid[^}]*place-items: center/);
  const mobileStyles = styles.slice(styles.indexOf("/* Mobile first:"), styles.indexOf("@media (max-width: 767.98px)"));
  assert.match(mobileStyles, /\.scv-search-toolbar > \.scv-search-box:not\(\.scv-mobile-search\) \{ display: none; \}/);
  assert.match(mobileStyles, /\.scv-mode-switch \{ grid-column: 2; grid-row: 1; width: 100%; min-width: 0; justify-content: center; \}/);
  assert.match(mobileStyles, /\.scv-root \.scv-theme-button \{ grid-column: 3; grid-row: 1; \}/);
  assert.match(mobileStyles, /\.scv-root \.scv-mobile-index-close \{ grid-column: 4; grid-row: 1/);
  assert.match(mobileStyles, /\.scv-mobile-search \{[^}]*right: 8px; left: 60px; display: block/);
  const desktopStart = styles.indexOf("@media (min-width: 992px)");
  const desktopStyles = styles.slice(desktopStart, styles.indexOf("@media (min-width: 1400px)", desktopStart));
  assert.match(desktopStyles, /\.scv-search-box \{ grid-column: auto; grid-row: auto; \}/);
  assert.match(desktopStyles, /\.scv-search-toolbar > \.scv-search-box:not\(\.scv-mobile-search\) \{ display: block; \}/);
  assert.match(desktopStyles, /\.scv-mobile-search \{ display: none; \}/);
  assert.match(desktopStyles, /\.scv-index-controls, \.scv-index-controls-inner \{ display: contents/);
});

test("combined usa le NTC come base e conserva tutti i contenuti Circolare", async () => {
  const source = await readFile(new URL("../shared/NormativeViewer.tsx", import.meta.url), "utf8");
  assert.match(source, /loadRelations\(manifest, dataBaseUrl\)/);
  assert.match(source, /loadDocumentIndex\(manifest, "circ2019", dataBaseUrl\)/);
  assert.match(source, /const circRecords = useMemo/);
  assert.match(source, /function baseNumbering\(value: string\)/);
  assert.match(source, /const fallbackSummaries = circIndex\.units\.filter\(\(summary\) => !relatedSourceIds\.has\(summary\.id\)\)/);
  assert.doesNotMatch(source, /primaryNumbers/);
  assert.match(source, /sourceUnitId === resultId/);
  assert.match(source, /const relatedByTarget = useMemo/);
  assert.match(source, /<span className="scv-related-title"><button type="button" className="scv-permalink-trigger" data-scv-copy-link[^>]*>\{relatedUnit\.title\}<\/button><\/span>/);
  assert.match(source, /function hasUnitContent\(unit: CorpusUnit\)/);
  assert.match(source, /filter\(\(\{ unit: relatedUnit \}\) => hasUnitContent\(relatedUnit\)\)/);
  assert.match(source, /hasUnitContent\(unit\) \|\| !primaryBases\.has\(baseNumbering\(unit\.numbering\.official\)\)/);
  assert.match(source, /isCircularFallback = mode === "combined" && unit\.document === "circ2019"/);
  assert.match(source, /scv-circular-fallback/);
  assert.match(source, /data-provenance=\{isCircularFallback \? "Circolare 7\/2019" : undefined\}/);
  assert.doesNotMatch(source, /Collegamento editoriale da revisionare|Provenienza: Circolare 7\/2019|same-numbering/);
});

test("il comparato conserva i titoli Circolare senza controparte NTC e li colloca nell'albero numerico", async () => {
  const source = await readFile(new URL("../shared/NormativeViewer.tsx", import.meta.url), "utf8");
  assert.match(source, /const level = Math\.max\(0, baseNumber\.split\("\."\)\.length - 1\)/);
  assert.match(source, /const primaryBases = new Set\(index\.units\.map\(\(summary\) => baseNumbering\(summary\.numbering\.official\)\)\)/);
  assert.match(source, /baseNumbering\(unit\.numbering\.official\)\)\)/);
  assert.doesNotMatch(source, /scv-structural-anchor/);
});

test("i fallback Circolare mantengono lo sfondo di provenienza anche senza relazione esplicita", async () => {
  const styles = await readFile(new URL("../shared/styles.css", import.meta.url), "utf8");
  assert.match(styles, /\.scv-related-unit, \.scv-circular-fallback \{[^}]*background: var\(--scv-circular\)/);
  assert.match(styles, /\.scv-root\.scv-dark \.scv-related-unit, \.scv-root\.scv-dark \.scv-circular-fallback/);
});

test("le schede principali della sidebar si allineano come linguette sulla riga del pannello", async () => {
  const [source, styles] = await Promise.all([
    readFile(new URL("../app/ViewerToolsDock.tsx", import.meta.url), "utf8"),
    readFile(new URL("../shared/styles.css", import.meta.url), "utf8"),
  ]);
  assert.match(source, /className="scv-tools-tabs" role="tablist"/);
  assert.match(source, /className="scv-tools-tab"[^>]*role="tab"/);
  assert.match(source, /tab\.id === "annotations" \? <StarIcon \/> : <ScriptIcon \/>/);
  assert.match(styles, /\.scv-tools-tabs \{[^}]*align-items: flex-end/);
  assert.match(styles, /\.scv-tools-header \.scv-tools-tab \{[^}]*align-items: center[^}]*gap: 8px[^}]*font-size: 15px/);
  assert.match(styles, /\.scv-tools-header \.scv-tools-tab\[aria-selected="true"\] \{[^}]*background: var\(--scv-panel\)[^}]*border-bottom-color: var\(--scv-panel\)/);
});

test("la sidebar destra scorre anche in chiusura e la scrollbar lascia libero il pulsante dashboard", async () => {
  const [source, styles] = await Promise.all([
    readFile(new URL("../shared/NormativeViewer.tsx", import.meta.url), "utf8"),
    readFile(new URL("../shared/styles.css", import.meta.url), "utf8"),
  ]);
  assert.match(source, /const \[auxiliaryMounted, setAuxiliaryMounted\]/);
  assert.match(source, /requestAnimationFrame\(\(\) => setAuxiliaryEntered\(true\)\)/);
  assert.match(source, /setTimeout\(\(\) => setAuxiliaryMounted\(false\), 520\)/);
  assert.match(source, /auxiliaryMounted && auxiliaryAvailable && renderAuxiliary/);
  assert.match(styles, /\.scv-root\.scv-auxiliary-entered \.scv-auxiliary-pane/);
  assert.match(styles, /\.scv-root\.scv-auxiliary-available:not\(\.scv-has-auxiliary\) \.scv-scroll-rail \{ top: 62px; \}/);
});

test("l'indice e lo scrubber globale seguono lo scroll del flusso continuo", async () => {
  const [source, styles] = await Promise.all([
    readFile(new URL("../shared/NormativeViewer.tsx", import.meta.url), "utf8"),
    readFile(new URL("../shared/styles.css", import.meta.url), "utf8"),
  ]);
  assert.match(source, /const primaryRenderedPaths = useMemo/);
  assert.doesNotMatch(source, /Promise\.all\(documentChunkPaths\.map|manifest\?\.chunks\.filter/);
  assert.match(source, /new IntersectionObserver/);
  assert.match(source, /root\.addEventListener\("scroll"/);
  assert.match(source, /setActiveUnitId\(nextId\)/);
  assert.match(source, /records\.map\(\(record\) => <MemoizedUnit/);
  assert.match(source, /const paragraphsByChapter = useMemo/);
  assert.match(source, /const subparagraphsByParagraph = useMemo/);
  assert.match(source, /parentId: string \| null/);
  assert.match(source, /grouped\.get\(entry\.parentId \?\? ""\)/);
  assert.match(source, /const primaryBases = new Set\(index\.units\.map/);
  assert.match(source, /summary\.document !== "circ2019" \|\| !primaryBases\.has\(baseNumbering\(summary\.numbering\.official\)\)/);
  assert.match(source, /const entryIdByBase = new Map\(entries\.map/);
  assert.match(source, /const parentId = parentBase \? entryIdByBase\.get\(parentBase\) \?\? null : null/);
  assert.match(source, /const activeBaseParts = baseNumbering\(activeSummary\.numbering\.official\)\.split\("\."\)/);
  assert.match(source, /levelEntries\.find\(\(entry\) => entry\.baseNumber === baseNumber\)/);
  assert.match(source, /className="scv-index-tree"/);
  assert.match(source, /className=\{`scv-index-children \$\{chapterOpen \? "is-open" : ""\}`\}/);
  assert.match(source, /className="scv-index-children-list scv-index-paragraph-list"/);
  assert.match(source, /className="scv-index-children-list scv-index-subparagraph-list"/);
  assert.match(source, /target\.scrollIntoView\(\{ block: "nearest", behavior: reducedMotion \? "auto" : "smooth" \}\)/);
  assert.match(source, /const GlobalDocumentScrubber = memo/);
  assert.match(source, /const scrubberEntries = useMemo/);
  assert.doesNotMatch(source, /scv-scroll-marker/);
  assert.match(styles, /\.scv-scroll-track::after[^}]+background-repeat: repeat-y[^}]+background-size: 12px 24px/);
  assert.match(source, /<GlobalDocumentScrubber rootRef=\{textPaneRef\}/);
  assert.match(source, /className="scv-text-pane-shell"/);
  assert.match(source, /const navigationEntries = useMemo/);
  assert.match(styles, /\.scv-index-grid \{[^}]*display: block/);
  assert.match(styles, /\.scv-index-list \{[^}]*overflow: auto/);
  assert.match(styles, /\.scv-index-level-0 \{[^}]*--scv-index-indent: 0px/);
  assert.match(styles, /\.scv-index-level-1 \{[^}]*--scv-index-indent: 0px/);
  assert.match(styles, /\.scv-index-level-2 \{[^}]*--scv-index-indent: 0px/);
  assert.match(styles, /\.scv-index-level-0 \{[^}]*--scv-index-active-bg: var\(--scv-button-emphasis-bg\)[^}]*--scv-index-active-ink: #fff/);
  assert.match(styles, /\.scv-index-level-1 \{[^}]*--scv-index-active-bg: var\(--scv-button-emphasis-bg\)[^}]*--scv-index-active-ink: #fff/);
  assert.match(styles, /\.scv-index-level-2 \{[^}]*--scv-index-active-bg: var\(--scv-button-emphasis-bg\)[^}]*--scv-index-active-ink: #fff/);
  assert.match(styles, /\.scv-index-list button\.active strong, \.scv-index-list button\.active span \{[^}]*color: var\(--scv-index-active-ink\)/);
  assert.match(styles, /\.scv-index-list button \{[^}]*width: calc\(100% - 4px\)[^}]*margin: 2px 2px 2px 0/);
  assert.match(styles, /\.scv-index-list button\.active \{[^}]*background: var\(--scv-index-active-bg\)/);
  assert.match(styles, /--scv-button-emphasis-bg: #4f74bf/);
  assert.match(styles, /button:not\(\.is-danger\):not\(\.scv-annotation-scrubber-marker\):not\(\.scv-note-margin-marker\):not\(\.scv-tools-tab\)[^]*color: #fff;[^]*background: var\(--scv-button-emphasis-bg\);[^]*border-color: transparent/);
  assert.doesNotMatch(styles, /--scv-button-emphasis-border|border: 1px solid var\(--scv-button-emphasis-border\)/);
  assert.match(styles, /\.scv-search-result:is\(:hover, :focus-visible\) small \{ color: #fff; \}/);
  assert.match(styles, /\.scv-tools-header \.scv-tools-tab\[aria-selected="true"\]:hover \{ background: var\(--scv-panel\); \}/);
  assert.match(styles, /\.scv-index-children \{[^}]*grid-template-rows: 0fr[^}]*transition:/);
  assert.match(styles, /\.scv-index-children\.is-open \{[^}]*grid-template-rows: 1fr/);
  assert.match(styles, /\.scv-index-children-list \{[^}]*border-left: 2px solid var\(--scv-button-emphasis-bg\)/);
  assert.match(styles, /\.scv-index-paragraph-list \{[^}]*padding-left: 4px[^}]*border-left: 2px solid var\(--scv-button-emphasis-bg\)/);
  assert.match(styles, /\.scv-index-subparagraph-list \{[^}]*margin-left: 8px[^}]*padding-left: 4px[^}]*border-left: 2px solid var\(--scv-button-emphasis-bg\)/);
  assert.match(styles, /\.scv-index-subparagraph-list \.scv-index-entry \{[^}]*--scv-index-indent: 0px/);
  assert.doesNotMatch(styles, /\.scv-index-subparagraph-list::before/);
  assert.match(styles, /\.scv-scroll-rail/);
  assert.match(styles, /\.scv-scroll-overlay/);
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
  assert.match(shared, /auxiliaryPanelModes \? auxiliaryPanelModes.includes\(mode\) : mode !== "combined"/);
  assert.match(shared, /hidden=\{!auxiliaryVisible\}/);
  assert.match(official, /request\.headers\.get\("range"\)/);
  assert.match(official, /Documento non valido/);
  assert.match(comparison, /process\.env\.NODE_ENV !== "production"/);
  assert.match(comparison, /NEXT_PUBLIC_VIEWER_DEBUG_PDF/);
});

test("il renderer unico conserva formule, tabelle, figure ed elenchi strutturati", async () => {
  const [component, styles, viewer] = await Promise.all([
    readFile(new URL("../shared/CorpusContent.tsx", import.meta.url), "utf8"),
    readFile(new URL("../shared/styles.css", import.meta.url), "utf8"),
    readFile(new URL("../shared/NormativeViewer.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(component, /className="formula-row"/);
  assert.match(component, /className="formula-number"/);
  assert.match(component, /className="formula-scroll"/);
  assert.match(component, /function CopyFigureButton\(/);
  assert.match(component, /function CopyFigureIcon\(/);
  assert.match(component, /new ClipboardItem/);
  assert.doesNotMatch(component, /formulaImageBlob|copyFormulaMarkupAsImage|writeFormulaToClipboard/);
  assert.match(component, /clipboard\.write/);
  assert.match(component, /className="formula-asset"/);
  assert.doesNotMatch(component, /className="formula-asset scv-copyable-asset"/);
  assert.match(component, /className=\{`figure-asset \$\{figureAssetClass\(figure\.officialNumber\)\} scv-copyable-asset`\}/);
  assert.match(component, /visibleTableCaption\(table\.officialNumber, table\.caption\)/);
  assert.match(component, /visibleTableNumberSuffix\(table\.officialNumber, table\.caption\)/);
  assert.match(component, /tableAssetClass/);
  assert.match(component, /figureAssetClass/);
  assert.match(component, /<div className="table-notes">/);
  assert.match(component, /className="scv-note-content"/);
  assert.match(component, /className="scv-note-rule"/);
  assert.match(component, /block\.text\?\.paragraphs/);
  assert.doesNotMatch(component, /<ul className="table-notes">/);
  assert.match(component, /hasAlphabeticListMarker/);
  assert.match(component, /\[a-z0-9\]\+\[\.\)\]\)\\s\+/u);
  assert.match(component, /function splitInlinePrefix\(/);
  assert.match(component, /const split = splitInlinePrefix\(inline, match\[1\]\)/);
  assert.match(component, /renderInlineSegments\(split\.description, context\)/);
  assert.match(component, /groupAlignedLabelBlocks/);
  assert.match(component, /function hasAlignedListContinuation\(/);
  assert.match(component, /hasAlignedListContinuation\(blocks\[index\]\)/);
  assert.match(component, /\(blocks\[index\]\.indentLevel \?\? 0\) === indentLevel/);
  assert.match(component, /block-indent-\$\{indentLevel\}/);
  assert.match(component, /<u key=\{`underline-\$\{index\}`\}>\{renderReferenceText\(segment\.value/);
  assert.match(component, /<em key=\{`em-underline-\$\{index\}`\}><u>\{renderReferenceText\(segment\.value/);
  assert.match(component, /<strong key=\{`strong-em-\$\{index\}`\}><em>\{renderReferenceText\(segment\.value/);
  assert.match(component, /loading="lazy"/);
  assert.doesNotMatch(component, /variant: "scv" \| "legacy"|UnitBlocks|normative-copy/);
  assert.match(styles, /--scv-primary:\s*#3c52a3/iu);
  assert.match(styles, /font-family:\s*"Tinos"/);
  assert.match(styles, /\.scv-root \.formula-number/);
  assert.match(styles, /\.scv-root \.table-asset table/);
  assert.match(styles, /\.scv-root \.table-asset th \.katex \{ color: #fff; \}/);
  assert.match(styles, /\.scv-root \.table-asset th \{[^}]*background: var\(--scv-button-emphasis-bg\)/);
  assert.match(styles, /\.scv-root \.table-asset td \{ background: #fbfcff; \}/);
  assert.match(styles, /\.scv-root \.table-asset tbody tr:nth-child\(even\) td \{ background: #f1f3f9; \}/);
  assert.match(styles, /--scv-night-surface: #1e2c40;/);
  assert.match(styles, /--scv-night-raised: #25364d;/);
  assert.match(styles, /\.scv-root\.scv-dark \.table-asset td \{ background: var\(--scv-night-surface\); \}/);
  assert.match(styles, /\.scv-root\.scv-dark \.table-asset tbody tr:nth-child\(even\) td \{ background: var\(--scv-night-raised\); \}/);
  assert.match(styles, /\.scv-root \.table-asset table \{[^}]*color: #2a3039/);
  assert.match(styles, /\.scv-root \.table-asset-c4-1-iv thead tr:nth-child\(2\) th:nth-child\(n \+ 4\) \{ font-size: var\(--scv-font-size-12-5\); \}/);
  assert.match(styles, /\.scv-root \.table-asset-7-8-ii thead tr:first-child th:nth-child\(n \+ 2\) \{ font-size: var\(--scv-font-size-12-5\); \}/);
  assert.match(styles, /\.scv-root \.table-asset-7-5-i th, \.scv-root \.table-asset-7-5-i td \{ text-align: center; \}/);
  assert.doesNotMatch(styles, /\.scv-root \.table-asset-c4-1-vi tbody tr:first-child td/);
  assert.match(styles, /\.scv-label-list\.block-indent-1 \{ margin-left: 2\.5rem; \}/);
  assert.match(styles, /\.scv-label-list-content > \.leading-label-empty \{ grid-column: 1; \}/);
  assert.match(styles, /\.scv-block-list-item\.list-item-without-marker\.list-item-level-1 \{[^}]*padding-left: calc\(2 \* var\(--scv-list-marker-width\)\)/);
  assert.match(styles, /\.scv-block-list-item\.list-item-with-simple-dash\.list-item-level-2 \{[^}]*padding-left: calc\(11px \+ var\(--scv-list-marker-width\)\)/);
  assert.match(styles, /\.scv-root \.table-notes \{[^}]*padding: 0/);
  assert.match(styles, /\.scv-root \.scv-note-content > p \{[^}]*text-align: justify/);
  assert.match(styles, /\.scv-root \.table-notes > p \{[^}]*margin: 0 0 8px[^}]*text-align: justify/);
  assert.match(styles, /\.scv-block-list-item\.list-item-with-trailing-symbol p \{[^}]*grid-template-columns: 14px minmax\(0, 1fr\) max-content/);
  assert.match(styles, /\.scv-block-list-item\.list-item-with-trailing-symbol p > \.inline-keep-punct \{[^}]*align-self: end/);
  assert.match(styles, /\.scv-block-list-item\.list-item-with-trailing-symbol\.list-item-without-marker p \{[^}]*grid-template-columns: minmax\(0, 1fr\) max-content/);
  assert.doesNotMatch(styles, /list-item-with-trailing-symbol-tabbed|grid-template-columns: 14px 26em max-content/);
  assert.match(styles, /\.scv-root \.scv-note-rule \{[^}]*width: 33\.333%[^}]*background: #202733/);
  assert.match(styles, /\.scv-root\.scv-dark \.scv-note-content, \.scv-root\.scv-dark \.scv-note-content > p,\s*\.scv-root\.scv-dark \.scv-note-list-item, \.scv-root\.scv-dark \.scv-note-list-marker,\s*\.scv-root\.scv-dark \.scv-note-list-description \{[^}]*color: var\(--scv-night-ink\)/);
  assert.match(styles, /\.scv-root \.figure-asset figcaption/);
  assert.match(styles, /grid-template-columns: auto minmax\(0, 1fr\) auto var\(--scv-toolbar-button-size\)/);
  assert.match(styles, /--scv-index-width: clamp\(380px, 28vw, 480px\)/);
  assert.match(styles, /height: 100dvh;\s*overflow: clip;/);
  assert.match(styles, /\.scv-text-pane-shell \{[^}]*overflow: hidden; \}/);
  assert.match(styles, /@media \(min-width: 992px\) \{\s*\.scv-root \{ grid-template-columns: var\(--scv-index-width\) minmax\(0, 1fr\)/);
  assert.match(styles, /@media \(min-width: 992px\) \{[^]*\.scv-text-pane-shell \{ transition: transform \.5s/);
  assert.match(viewer, /auxiliaryPaneRef\.current\?\.querySelector<HTMLButtonElement>\("button"\)\?\.focus\(\{ preventScroll: true \}\)/);
  assert.match(styles, /\.scv-root\.scv-has-auxiliary \.scv-text-pane-shell \{ transform: translateX\(calc\(-1 \* var\(--scv-index-width\)\)\)/);
  assert.match(styles, /@media \(min-width: 1400px\) \{[^]*\.scv-root\.scv-has-auxiliary \.scv-text-pane-shell \{ transform: none/);
  assert.match(viewer, /auxiliaryAvailable \? "scv-auxiliary-available" : ""/);
  assert.match(styles, /\.scv-root\.scv-auxiliary-available \.scv-text-flow \{ width: min\(860px, calc\(100% - var\(--scv-auxiliary-width\)\)\); transition: transform/);
  assert.match(styles, /\.scv-root\.scv-auxiliary-available\.scv-has-auxiliary \.scv-text-flow \{ transform: translateX\(calc\(-\.5 \* var\(--scv-auxiliary-width\)\)\)/);
  assert.doesNotMatch(styles, /\.scv-root\.scv-has-auxiliary \{ grid-template-columns:/);
  assert.match(styles, /\.scv-text-flow \{ width: min\(100%, 860px\);[^}]*padding: 23px 58px 55vh/);
  assert.match(styles, /aspect-ratio: 1/);
  assert.match(styles, /\.scv-root \.scv-theme-button, \.scv-root \.scv-mode-button \{[^}]*height: var\(--scv-toolbar-button-size\)[^}]*background: #fafafa/);
  assert.match(styles, /\.scv-root \.scv-mode-switch \.scv-mode-button \{[^}]*font-family: "Segoe UI"[^}]*font-size: 8px[^}]*font-weight: 700/);
  assert.match(styles, /\.scv-root \.scv-mode-button \.scv-mode-label \{[^}]*transform: scaleY\(1\.35\)/);
  assert.match(styles, /\.scv-search-box \{[^}]*height: var\(--scv-toolbar-button-size\)/);
  assert.match(styles, /\.scv-theme-button:hover \.scv-theme-icon[^}]*transform: rotate\(-12deg\) scale\(1\.08\)/);
  assert.match(styles, /\.scv-theme-button:hover \.scv-control-tooltip[^}]*opacity: 1/);
  assert.match(styles, /\.scv-copyable-asset:hover \.scv-copy-asset/);
  assert.match(styles, /\.scv-root\.scv-dark/);
  assert.match(styles, /\.scv-root \.inline-math \{[^}]*display: inline-block[^}]*font-size: 1\.04em[^}]*vertical-align: baseline/);
  assert.doesNotMatch(styles, /\.scv-root \.inline-math \{[^}]*(?:overflow|vertical-align: middle)/);
  assert.match(styles, /\.scv-root \.inline-math \.katex \{[^}]*font-size: 1em/);
  assert.match(styles, /\.scv-root \.figure-asset img \{[^}]*width: min\(100%, 760px\)[^}]*height: auto[^}]*max-height: min\(600px, 70vh\)/);
  assert.match(styles, /\.scv-root \.figure-asset-c3-3-28 img \{[^}]*width: min\(50%, 380px\)/);
  assert.doesNotMatch(styles, /legacy-base-font-size|comparison-shell/);
});

test("nel comparato i blocchi Circolare composti solo dal titolo non entrano, quelli NTC restano visibili", async () => {
  const unitsDirectory = new URL("../../corpus/units/circ2019/", import.meta.url);
  const [c3, c31] = await Promise.all(["c3.json", "c3.1.json"].map(async (file) => JSON.parse(await readFile(new URL(file, unitsDirectory), "utf8"))));
  assert.ok(c3.blocks.every((block) => block.kind === "heading"));
  assert.ok(c31.blocks.every((block) => block.kind === "heading"));
  const ntcUnit = JSON.parse(await readFile(new URL("../../corpus/units/ntc2018/4.1.2.json", import.meta.url), "utf8"));
  assert.ok(ntcUnit.blocks.every((block) => block.kind === "heading"));
});

test("il corpo del testo torna giustificato dal breakpoint md", async () => {
  const styles = await readFile(new URL("../shared/styles.css", import.meta.url), "utf8");
  const md = styles.indexOf("@media (min-width: 768px)");
  const lg = styles.indexOf("@media (min-width: 992px)", md);
  assert.ok(md > styles.indexOf(".scv-block p, .scv-root .scv-note-content > p"));
  assert.ok(lg > md);
  assert.match(styles.slice(md, lg), /\.scv-block p, [^{]+\{ text-align: justify; \}/);
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
