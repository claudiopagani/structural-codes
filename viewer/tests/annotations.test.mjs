import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { IDBFactory } from "fake-indexeddb";
import { JSDOM } from "jsdom";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { IndexedDbAnnotationStore, annotationPositionRanks, annotationTargetFromElement, automaticAnnotationLabel, clusterAnnotationMarkers, createLongPressSession, sortAnnotations } from "../package-dist/annotations/index.js";
import { AnnotationContextMenu } from "../package-dist/annotations/AnnotationUi.js";

const timestamp = "2026-09-28T10:00:00.000Z";
const unitTarget = { kind: "unit", unitId: "urn:structural-codes:it:unit:ntc2018:7.3.6.1" };
const blockTarget = { kind: "block", unitId: unitTarget.unitId, blockId: "block-1" };
const formulaTarget = { kind: "asset", unitId: unitTarget.unitId, assetId: "formula-1", assetKind: "formula" };
const base = { documentId: "ntc2018", numbering: "7.3.6.1", title: "Elementi strutturali" };

function setup(t, options = {}) {
  const indexedDB = options.indexedDB ?? new IDBFactory();
  let id = 0;
  const settings = { indexedDB, name: `annotations-${Date.now()}-${Math.random()}`, now: () => new Date(timestamp), id: () => `annotation-${++id}`, ...options };
  const store = new IndexedDbAnnotationStore(settings);
  t.after(() => store.close());
  return { store, indexedDB, settings };
}

test("IndexedDB create, update, delete, list and persistence across store instances", async (t) => {
  const { store, settings } = setup(t);
  const bookmark = await store.createAnnotation({ type: "bookmark", target: unitTarget, ...base, label: "Preferito" });
  const noteA = await store.createAnnotation({ type: "note", target: blockTarget, ...base, text: "Prima nota" });
  const noteB = await store.createAnnotation({ type: "note", target: blockTarget, ...base, text: "Seconda nota" });
  assert.notEqual(noteA.id, noteB.id, "più note possono coesistere sullo stesso target");
  const updated = await store.updateAnnotation(noteA.id, { text: "Nota modificata" });
  assert.equal(updated.text, "Nota modificata");
  assert.ok(updated.updatedAt > noteA.updatedAt);
  await store.close();
  const reloaded = new IndexedDbAnnotationStore(settings); t.after(() => reloaded.close());
  assert.deepEqual(new Set((await reloaded.listAnnotations()).map(({ id }) => id)), new Set([bookmark.id, noteA.id, noteB.id]));
  await reloaded.deleteAnnotation(noteB.id);
  assert.equal((await reloaded.listAnnotations()).some(({ id }) => id === noteB.id), false);
});

test("bookmark description is optional, automatic label is deterministic and equivalent targets do not duplicate", async (t) => {
  const { store } = setup(t);
  assert.equal(automaticAnnotationLabel(unitTarget, base.numbering, base.title), "§ 7.3.6.1 — Elementi strutturali");
  assert.equal(automaticAnnotationLabel(formulaTarget, base.numbering, base.title, "7.3.8"), "Formula [7.3.8]");
  assert.equal(automaticAnnotationLabel({ ...formulaTarget, assetKind: "table" }, base.numbering, base.title, "7.2.I"), "Tab. 7.2.I");
  assert.equal(automaticAnnotationLabel({ ...formulaTarget, assetKind: "figure" }, base.numbering, base.title, "4.1.2"), "Fig. 4.1.2");
  const first = await store.createAnnotation({ type: "bookmark", target: unitTarget, ...base });
  const duplicate = await store.createAnnotation({ type: "bookmark", target: structuredClone(unitTarget), ...base, label: "Altro" });
  assert.equal(duplicate.id, first.id);
  assert.equal((await store.listAnnotations()).length, 1);
});

test("store rejects unavailable storage, invalid patches and corrupt records without localStorage fallback", async () => {
  const unavailable = new IndexedDbAnnotationStore({ indexedDB: { open() { throw new Error("private detail"); } } });
  await assert.rejects(unavailable.listAnnotations(), (error) => error.code === "UNAVAILABLE" && !error.message.includes("private"));
  const indexedDB = new IDBFactory();
  const store = new IndexedDbAnnotationStore({ indexedDB, name: "corrupt-annotations" });
  const note = await store.createAnnotation({ type: "note", target: unitTarget, ...base, text: "Test" });
  await assert.rejects(store.updateAnnotation(note.id, { label: "vietato" }), { code: "INVALID_DATA" });
  await assert.rejects(store.deleteAnnotation("missing"), { code: "CONFLICT" });
  await store.close();
  const db = await new Promise((resolve, reject) => { const request = indexedDB.open("corrupt-annotations"); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
  await new Promise((resolve, reject) => { const tx = db.transaction("annotations", "readwrite"); tx.objectStore("annotations").add({ id: "broken" }); tx.oncomplete = resolve; tx.onabort = () => reject(tx.error); });
  db.close();
  await assert.rejects(store.listAnnotations(), { code: "CORRUPT" });
});

test("versioned export/import round trip validates schema and handles malformed, duplicate and colliding ids", async (t) => {
  const { store } = setup(t);
  const note = await store.createAnnotation({ type: "note", target: blockTarget, ...base, text: "Contenuto <script>non eseguibile</script>" });
  const bookmark = await store.createAnnotation({ type: "bookmark", target: formulaTarget, ...base, label: "Formula [7.3.8]" });
  const exported = await store.exportAnnotations();
  assert.equal(exported.schemaVersion, 1);
  assert.equal(exported.annotations.length, 2);
  const fresh = setup(t).store;
  assert.deepEqual(await fresh.importAnnotations(exported), { imported: 2, ignored: 0 });
  assert.deepEqual(await fresh.importAnnotations(exported), { imported: 0, ignored: 2 });
  const collision = structuredClone(exported);
  collision.annotations = [{ ...note, text: "contenuto diverso" }, { malformed: true }, { ...bookmark, id: "new-bookmark" }];
  const result = await fresh.importAnnotations(collision);
  assert.deepEqual(result, { imported: 1, ignored: 2 });
  assert.equal((await fresh.listAnnotations()).filter(({ type }) => type === "note").length, 2);
  await assert.rejects(fresh.importAnnotations({ schemaVersion: 999, annotations: [] }), { code: "INVALID_DATA" });
});

test("canonical DOM target resolution covers unit, block, formula, table and figure with asset priority", () => {
  const dom = new JSDOM(`<section data-scv-citation-target="unit" data-scv-source-unit-id="u"><div data-scv-citation-target="block" data-scv-source-unit-id="u" data-scv-block-id="b"><div data-scv-citation-target="asset" data-scv-source-unit-id="u" data-scv-block-id="b" data-scv-asset-id="table" data-scv-asset-kind="table"><span id="inside"></span></div></div><div data-scv-citation-target="asset" data-scv-source-unit-id="u" data-scv-asset-id="formula" data-scv-asset-kind="formula"></div><div data-scv-citation-target="asset" data-scv-source-unit-id="u" data-scv-asset-id="figure" data-scv-asset-kind="figure"></div></section>`);
  const document = dom.window.document;
  assert.deepEqual(annotationTargetFromElement(document.querySelector("#inside")), { kind: "asset", unitId: "u", assetId: "table", assetKind: "table" });
  assert.deepEqual(annotationTargetFromElement(document.querySelector("[data-scv-block-id='b']")), { kind: "block", unitId: "u", blockId: "b" });
  assert.deepEqual(annotationTargetFromElement(document.querySelector("[data-scv-asset-id='formula']")), { kind: "asset", unitId: "u", assetId: "formula", assetKind: "formula" });
  assert.deepEqual(annotationTargetFromElement(document.querySelector("[data-scv-asset-id='figure']")), { kind: "asset", unitId: "u", assetId: "figure", assetKind: "figure" });
  assert.deepEqual(annotationTargetFromElement(document.querySelector("section")), { kind: "unit", unitId: "u" });
});

test("sorting uses normative sortKey/document order and dates; scrubber markers aggregate only nearby ratios", () => {
  const ranks = annotationPositionRanks([
    { document: "circ2019", units: [{ id: "c2", numbering: { sortKey: "10" } }] },
    { document: "ntc2018", units: [{ id: "n10", numbering: { sortKey: "10" } }, { id: "n2", numbering: { sortKey: "2" } }] },
  ]);
  const annotations = [
    { id: "a", schemaVersion: 1, type: "note", target: { kind: "unit", unitId: "n10" }, ...base, text: "A", createdAt: timestamp, updatedAt: "2026-09-28T11:00:00.000Z" },
    { id: "b", schemaVersion: 1, type: "note", target: { kind: "unit", unitId: "n2" }, ...base, text: "B", createdAt: timestamp, updatedAt: "2026-09-28T09:00:00.000Z" },
    { id: "c", schemaVersion: 1, type: "note", target: { kind: "unit", unitId: "c2" }, documentId: "circ2019", numbering: "C10", title: "C", text: "C", createdAt: timestamp, updatedAt: "2026-09-28T12:00:00.000Z" },
  ];
  assert.deepEqual(sortAnnotations(annotations, "position", ranks).map(({ id }) => id), ["b", "a", "c"]);
  assert.deepEqual(sortAnnotations(annotations, "recent", ranks).map(({ id }) => id), ["c", "a", "b"]);
  assert.deepEqual(sortAnnotations(annotations, "oldest", ranks).map(({ id }) => id), ["b", "a", "c"]);
  const bookmarkMarker = { ...annotations[1], type: "bookmark", label: "B", text: undefined };
  const clusters = clusterAnnotationMarkers([
    { annotation: annotations[0], ratio: .1 }, { annotation: bookmarkMarker, ratio: .105 },
    { annotation: annotations[0], ratio: .5 }, { annotation: annotations[1], ratio: .503 }, { annotation: annotations[2], ratio: .505 },
  ], .01);
  assert.deepEqual(clusters.map(({ markers }) => markers.length), [1, 1, 3], "bookmark e nota restano distinti quando sono soltanto due; gruppi più densi vengono aggregati");
});

test("long press fires after delay, while movement/scroll cancels without affecting a normal tap", () => {
  let callback;
  let fired = 0;
  const session = createLongPressSession(() => { fired += 1; }, { delay: 550, setTimer(fn) { callback = fn; return 1; }, clearTimer() { callback = undefined; } });
  session.start({ x: 10, y: 10 }); session.move({ x: 13, y: 13 }); callback(); assert.equal(fired, 1);
  session.start({ x: 10, y: 10 }); session.move({ x: 30, y: 30 }); assert.equal(callback, undefined); assert.equal(fired, 1);
  session.start({ x: 10, y: 10 }); session.cancel(); assert.equal(callback, undefined);
});

test("context menu is keyboard usable and closes with Escape or outside pointer", async () => {
  const dom = new JSDOM("<!doctype html><div id='root'></div><button id='outside'>Fuori</button>", { url: "https://example.test" });
  const previous = { window: globalThis.window, document: globalThis.document, HTMLElement: globalThis.HTMLElement, Node: globalThis.Node, IS_REACT_ACT_ENVIRONMENT: globalThis.IS_REACT_ACT_ENVIRONMENT };
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, IS_REACT_ACT_ENVIRONMENT: true });
  const root = createRoot(dom.window.document.querySelector("#root"));
  const menuState = { target: unitTarget, metadata: { ...base, automaticLabel: "§ 7.3.6.1 — Elementi strutturali" }, x: 10, y: 10 };
  function Harness() {
    const [open, setOpen] = React.useState(true);
    return open ? React.createElement(AnnotationContextMenu, { state: menuState, darkMode: true, onCopyLink(target) { assert.deepEqual(target, unitTarget); }, onBookmark() {}, onNote() {}, onClose: () => setOpen(false) }) : null;
  }
  try {
    await act(() => root.render(React.createElement(Harness, { key: "escape" })));
    assert.equal(dom.window.document.querySelectorAll("[role='menu']").length, 1);
    await act(() => dom.window.document.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
    assert.equal(dom.window.document.querySelectorAll("[role='menu']").length, 0);
    await act(() => root.render(React.createElement(Harness, { key: "outside" })));
    await act(() => dom.window.document.querySelector("#outside").dispatchEvent(new dom.window.MouseEvent("pointerdown", { bubbles: true })));
    assert.equal(dom.window.document.querySelectorAll("[role='menu']").length, 0);
    await act(() => root.render(React.createElement(Harness, { key: "copy" })));
    const copyLink = dom.window.document.querySelector("[role='menu'] button");
    assert.equal(copyLink.textContent, "Copia link");
    assert.equal(copyLink.querySelector("svg").getAttribute("data-variant"), "dark");
    await act(() => copyLink.click());
    assert.equal(dom.window.document.querySelectorAll("[role='menu']").length, 0);
  } finally {
    await act(() => root.unmount()); dom.window.close(); Object.assign(globalThis, previous);
  }
});

test("viewer wires right click, Escape/outside close, annotation navigation and does not load chunks for marker derivation", async () => {
  const [viewer, ui, styles] = await Promise.all([
    readFile(new URL("../shared/NormativeViewer.tsx", import.meta.url), "utf8"),
    readFile(new URL("../shared/annotations/AnnotationUi.tsx", import.meta.url), "utf8"),
    readFile(new URL("../shared/styles.css", import.meta.url), "utf8"),
  ]);
  const icons = await readFile(new URL("../shared/UiIcons.tsx", import.meta.url), "utf8");
  assert.match(viewer, /onContextMenu=\{handleDocumentContextMenu\}/);
  assert.match(viewer, /createLongPressSession/);
  assert.match(viewer, /onPointerMove=\{handleDocumentPointerMove\}/);
  assert.match(ui, /document\.addEventListener\("pointerdown", pointer, true\)/);
  assert.match(ui, /event\.key === "Escape"/);
  assert.match(viewer, /navigateViewerTarget\(annotation\.target, "push"\)/);
  assert.match(viewer, /if \(auxiliaryVisible && window\.matchMedia\("\(max-width: 991\.98px\)"\)\.matches\) closeAuxiliary\(\)/);
  assert.match(viewer, /navigate: \(annotation\) => \{ void navigateFromAnnotation\(annotation\)\.catch\(\(\) => reportChunkLoadFailure\(\)\); \}/);
  assert.match(viewer, /clusterTypes\.map\(\(annotationType\).*StickyNoteIcon/s);
  assert.match(viewer, /setOpenCluster\(\(current\) => current === id \? null : id\)/);
  assert.match(viewer, /role="menuitem" key=\{annotation\.id\}[^]*onAnnotationSelect\(annotation, \{ x: bounds\.left \+ bounds\.width \/ 2, y: bounds\.top \+ bounds\.height \/ 2 \}\)/);
  assert.match(styles, /\.scv-auxiliary-pane \{[^}]+border-left: 1px solid var\(--scv-line\)/);
  assert.match(viewer, /type === "bookmark" \? <BookmarkIcon className="scv-annotation-scrubber-icon" \/> : type === "note" \? <StickyNoteIcon className="scv-annotation-scrubber-icon" \/>/);
  assert.match(ui, /<LinkChainIcon variant=\{darkMode \? "dark" : "default"\} \/>Copia link/);
  assert.match(icons, /name="collegamento-catena"/);
  assert.match(icons, /id=\{id \+ "-anelli-collegamento"\}/);
  assert.match(viewer, /onCopyLink=\{\(target\) => copyTargetPermalink\(target, findViewerTarget\(textPaneRef\.current, target\)\)\}/);
  assert.match(ui, /notes\[0\]\.type === "bookmark" \? <BookmarkIcon className="scv-note-margin-icon is-bookmark" \/> : <StickyNoteIcon className="scv-note-margin-icon is-note" \/>/);
  assert.match(ui, /onPointerDown=\{\(event\) => event\.stopPropagation\(\)\} onClick=\{\(event\) => \{ event\.stopPropagation\(\); const bounds = event\.currentTarget\.getBoundingClientRect\(\); onOpen\(notes\[0\], \{ x: bounds\.left \+ bounds\.width \/ 2, y: bounds\.top \+ bounds\.height \/ 2 \}\); \}\}/);
  assert.match(ui, /const auxiliaryVisible = window\.matchMedia\("\(min-width: 992px\)"\)\.matches[\s\S]*getBoundingClientRect\(\)\.left - 12/);
  assert.match(ui, /anchorX - bounds\.width \/ 2/);
  assert.match(viewer, /openAnnotation\(annotation, position\)/);
  assert.match(styles, /\.scv-annotation-editor \{ position: fixed; z-index: 91; top: var\(--scv-annotation-editor-y, 12px\); left: var\(--scv-annotation-editor-x, 12px\);[^}]+max-height: calc\(100dvh - 24px\)/);
  assert.match(styles, /\.scv-annotation-scrubber-marker:not\(\.is-cluster\) > span \{[^}]+display: grid[^}]+width: 18px[^}]+height: 18px[^}]+place-items: center/);
  assert.match(styles, /\.scv-annotation-scrubber-icon \{ width: 16px; height: 16px; \}/);
  assert.match(styles, /\.scv-scroll-rail:not\(\.is-idle\) \.scv-annotation-scrubber-group \{[^}]*opacity: 1; visibility: visible/);
  assert.match(styles, /\.scv-annotation-scrubber-marker\.is-cluster \.scv-annotation-scrubber-icon \{ width: 11px; height: 11px; \}/);
  assert.match(styles, /button:not\(\.is-danger\):not\(\.scv-annotation-scrubber-marker\):not\(\.scv-note-margin-marker\)/);
  assert.match(styles, /\.scv-root \.scv-note-margin-icon\.is-bookmark \[fill="#8fbffa"\],[^]*fill: var\(--scv-bookmark\);/);
  assert.match(styles, /\.scv-root \.scv-annotation-scrubber-marker\.is-note \.scv-annotation-scrubber-icon \[fill="#8fbffa"\],[^]*fill: var\(--scv-note\);/);
  assert.match(styles, /\.scv-root button\.scv-annotation-scrubber-marker\.is-bookmark:is\(:hover, :focus-visible, :active\) \.scv-annotation-scrubber-icon \[fill="#8fbffa"\],[^]*fill: var\(--scv-bookmark-hover\);/);
  assert.match(styles, /\.scv-root button\.scv-note-margin-marker:is\(:hover, :focus-visible, :active\) \.scv-note-margin-icon\.is-note \[fill="#8fbffa"\],[^]*fill: var\(--scv-note-hover\);/);
  assert.match(styles, /@media \(max-width: 991\.98px\) \{[^]*\.scv-root \.scv-note-margin-marker \{ z-index: 9; right: -30px; background: transparent; border: 0; box-shadow: none; \}/);
  assert.match(styles, /@media \(max-width: 767\.98px\) \{[^]*\.scv-root \.scv-note-margin-marker \{ right: -26px; \}/);
  const markerDerivation = viewer.slice(viewer.indexOf("const annotationMarkers"), viewer.indexOf("const selectAnnotationMarker"));
  assert.doesNotMatch(markerDerivation, /loadChunk|rememberChunk|mountPrimary/);
});

test("le azioni Importa/Esporta chiudono il pannello e i comandi delle card sono centrati", async () => {
  const [ui, styles] = await Promise.all([
    readFile(new URL("../shared/annotations/AnnotationUi.tsx", import.meta.url), "utf8"),
    readFile(new URL("../shared/styles.css", import.meta.url), "utf8"),
  ]);
  assert.match(ui, /className="scv-annotations-sort"><span>Ordina per:<\/span><select/);
  assert.match(ui, /className="scv-annotations-filter"><input type="checkbox"/);
  const actionsStart = ui.indexOf('<footer className="scv-annotations-actions"');
  const actions = ui.slice(actionsStart, ui.indexOf("</footer>", actionsStart));
  assert.ok(actions.indexOf(">Importa</button>") < actions.indexOf(">Esporta</button>"));
  assert.match(styles, /\.scv-annotations-panel \{ display: flex; flex-direction: column/);
  assert.match(styles, /\.scv-annotations-controls \{ display: flex;[^}]*flex-wrap: wrap/);
  assert.match(styles, /\.scv-annotations-actions \{[^}]*border-top: 1px solid var\(--scv-line\)/);
  assert.match(styles, /\.scv-annotations-list li > div \{[^}]*align-self: center/);
  assert.match(styles, /\.scv-annotations-panel button\.is-danger \{ background: #fafafa; \}/);
});

test("le icone circolari di importazione ed esportazione usano ID italiani e colori chiari sui fondi scuri", async () => {
  const [icons, ui, styles] = await Promise.all([
    readFile(new URL("../shared/UiIcons.tsx", import.meta.url), "utf8"),
    readFile(new URL("../shared/annotations/AnnotationUi.tsx", import.meta.url), "utf8"),
    readFile(new URL("../shared/styles.css", import.meta.url), "utf8"),
  ]);
  assert.match(ui, /<UploadCircleIcon \/>Importa/);
  assert.match(ui, /<DownloadCircleIcon \/>Esporta/);
  assert.match(icons, /name="importa-cerchio"/);
  assert.match(icons, /name="esporta-cerchio"/);
  assert.match(icons, /-freccia-importazione/);
  assert.match(icons, /-freccia-esportazione/);
  assert.match(styles, /\.scv-icon\[data-variant="light"\] \[fill="#8fbffa"\] \{ fill: #f9fbff; \}/);
  assert.match(styles, /\.scv-icon\[data-variant="light"\] \[fill="#2859c5"\] \{ fill: #ccdcf5; \}/);
});
