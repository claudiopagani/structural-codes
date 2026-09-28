import assert from "node:assert/strict";
import test from "node:test";
import {
  buildGlobalScrubberEntries,
  createGlobalScrubberDragSession,
  globalScrubberEntryAtRatio,
  globalScrubberKeyboardIndex,
  globalScrubberRatioForId,
  resolveGlobalScrubberActiveId,
} from "../shared/globalScrubber.js";

function entries(count, prefix = "ntc") {
  return buildGlobalScrubberEntries(Array.from({ length: count }, (_, index) => ({
    id: `${prefix}:${index + 1}`,
    label: String(index + 1),
    title: `Unità ${index + 1}`,
    baseNumber: String(index + 1),
    level: index % 10 === 0 ? 0 : 1,
  })));
}

test("la scala globale usa tutte le unità logiche e non le sole tre montate", () => {
  const globalEntries = entries(100);
  const mountedIds = new Set([globalEntries[48].id, globalEntries[49].id, globalEntries[50].id]);
  assert.equal(mountedIds.size, 3);
  assert.equal(globalEntries.length, 100);
  assert.equal(globalScrubberRatioForId(globalEntries, globalEntries[0].id), 0);
  assert.ok(Math.abs(globalScrubberRatioForId(globalEntries, globalEntries[50].id) - (50 / 99)) < 0.0001);
});

test("il mapping ratio seleziona quartili ed estremi dell'indice", () => {
  const globalEntries = entries(101);
  assert.equal(globalScrubberEntryAtRatio(globalEntries, 0)?.id, "ntc:1");
  assert.equal(globalScrubberEntryAtRatio(globalEntries, 0.5)?.id, "ntc:51");
  assert.equal(globalScrubberEntryAtRatio(globalEntries, 0.75)?.id, "ntc:76");
  assert.equal(globalScrubberEntryAtRatio(globalEntries, 1)?.id, "ntc:101");
});

test("lo scrubber espone soltanto capitoli, paragrafi e sottoparagrafi", () => {
  const globalEntries = buildGlobalScrubberEntries([
    { id: "level:0", label: "7", title: "Capitolo", baseNumber: "7", level: 0 },
    { id: "level:1", label: "7.3", title: "Paragrafo", baseNumber: "7.3", level: 1 },
    { id: "level:2", label: "7.3.6", title: "Sottoparagrafo", baseNumber: "7.3.6", level: 2 },
    { id: "level:3", label: "7.3.6.1", title: "Livello profondo", baseNumber: "7.3.6.1", level: 3 },
  ], 2);
  assert.deepEqual(globalEntries.map((entry) => entry.id), ["level:0", "level:1", "level:2"]);
  assert.deepEqual(globalEntries.map((entry) => entry.ratio), [0, 0.5, 1]);
  assert.equal(resolveGlobalScrubberActiveId(globalEntries, "level:3", "7.3.6.1"), "level:2");
});

test("un ID Circolare correlato usa la posizione primaria e un ID ignoto non azzera il ratio", () => {
  const globalEntries = buildGlobalScrubberEntries([
    { id: "ntc:8.7", label: "8.7", title: "Unità 8.7", baseNumber: "8.7", level: 1 },
    { id: "ntc:9.1", label: "9.1", title: "Unità 9.1", baseNumber: "9.1", level: 1 },
    { id: "ntc:9.2", label: "9.2", title: "Unità 9.2", baseNumber: "9.2", level: 1 },
  ]);
  assert.equal(resolveGlobalScrubberActiveId(globalEntries, "circ:C9.1", "9.1"), "ntc:9.1");
  const previousRatio = globalScrubberRatioForId(globalEntries, "ntc:9.1");
  assert.equal(globalScrubberRatioForId(globalEntries, "id-transitorio-non-mappato", previousRatio), previousRatio);
});

test("il drag aggiorna solo il target in memoria e fa un unico commit finale", () => {
  const globalEntries = entries(100);
  const jumps = [];
  const drag = createGlobalScrubberDragSession(globalEntries, (entry) => jumps.push(entry.id));
  drag.preview(0.1);
  drag.preview(0.5);
  const finalPreview = drag.preview(0.9);
  assert.deepEqual(jumps, []);
  assert.equal(finalPreview?.id, "ntc:90");
  drag.commit();
  drag.commit();
  assert.deepEqual(jumps, ["ntc:90"]);
});

test("un drag annullato non produce navigazione", () => {
  const jumps = [];
  const drag = createGlobalScrubberDragSession(entries(10), (entry) => jumps.push(entry.id));
  drag.preview(0.8);
  drag.cancel();
  drag.commit();
  assert.deepEqual(jumps, []);
});

test("la tastiera risolve frecce, pagine, Home ed End", () => {
  assert.equal(globalScrubberKeyboardIndex(50, "ArrowUp", 100), 49);
  assert.equal(globalScrubberKeyboardIndex(50, "ArrowDown", 100), 51);
  assert.equal(globalScrubberKeyboardIndex(50, "PageUp", 100), 40);
  assert.equal(globalScrubberKeyboardIndex(50, "PageDown", 100), 60);
  assert.equal(globalScrubberKeyboardIndex(50, "Home", 100), 0);
  assert.equal(globalScrubberKeyboardIndex(50, "End", 100), 99);
});

test("la scala combinata dipende dalle navigation entries, non dalle Circolari inline montate", () => {
  const primaryNavigationEntries = entries(100, "primary");
  const inlineCircularUnits = entries(400, "inline-circ");
  assert.equal(inlineCircularUnits.length, 400);
  assert.equal(primaryNavigationEntries.length, 100);
  assert.ok(Math.abs(globalScrubberRatioForId(primaryNavigationEntries, "primary:50") - (49 / 99)) < 0.0001);
  assert.equal(globalScrubberRatioForId(primaryNavigationEntries, "inline-circ:200"), 0);
});

test("il componente resta sopra il caricamento lazy e supporta reduced motion", async () => {
  const [{ readFile }, { default: path }] = await Promise.all([import("node:fs/promises"), import("node:path")]);
  const viewerRoot = path.resolve(import.meta.dirname, "..");
  const [source, styles] = await Promise.all([
    readFile(path.join(viewerRoot, "shared", "NormativeViewer.tsx"), "utf8"),
    readFile(path.join(viewerRoot, "shared", "styles.css"), "utf8"),
  ]);
  const start = source.indexOf("const GlobalDocumentScrubber = memo");
  const end = source.indexOf("function useVisibleUnitObserver", start);
  const scrubber = source.slice(start, end);
  assert.doesNotMatch(scrubber, /loadChunk|mountPrimaryChunk|mountPrimaryWindow|revealSummary/);
  assert.doesNotMatch(scrubber, /scrollHeight|clientHeight/);
  assert.match(source, /entries=\{scrubberEntries\}/);
  assert.match(source, /activeId=\{scrubberActiveId\}/);
  assert.match(source, /resolveGlobalScrubberActiveId\(scrubberEntries, activeUnitId/);
  assert.match(source, /buildGlobalScrubberEntries\(navigationEntries\.map/);
  assert.match(source, /baseNumber, level \}\)\), 2\)/);
  assert.match(scrubber, /scv-scroll-track[^>]+onPointerDown=\{startDrag\}[^>]+onPointerMove=\{moveDrag\}[^>]+onPointerUp=\{\(event\) => stopDrag\(event, true\)\}/);
  assert.doesNotMatch(scrubber, /previewTrackPress|onClick=\{jumpTo\}|scv-scroll-marker/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(styles, /transition-duration: \.01ms !important/);
  assert.match(styles, /\.scv-scroll-rail[^}]+width: 44px/);
  assert.match(styles, /\.scv-scroll-track::before[^}]+width: 12px/);
  assert.match(styles, /\.scv-scroll-track::after[^}]+radial-gradient\(circle at center, #858b95 0 1\.25px, transparent 2px\)[^}]+background-size: 12px 24px/);
  assert.match(styles, /\.scv-scroll-thumb::before[^}]+width: 10px[^}]+height: 34px[^}]+background: var\(--scv-primary\)/);
  assert.match(styles, /\.scv-scroll-rail\.is-idle[^}]+opacity: 0/);
  assert.match(styles, /\.scv-root\.scv-has-auxiliary \.scv-scroll-rail \{ right: var\(--scv-auxiliary-width\); \}/);
  assert.doesNotMatch(styles, /\.scv-scroll-marker/);
});
