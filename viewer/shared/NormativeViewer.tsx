"use client";

import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import {
  adjacentChunkPaths,
  createDocumentLookup,
  documentForMode,
  initialUnitForIndex,
  loadChunk,
  loadDocumentIndex,
  loadManifest,
  loadRelations,
  loadSearchIndex,
  type CorpusChunk,
  type CorpusManifest,
  type CorpusUnit,
  type DocumentId,
  type DocumentIndex,
  type DocumentLookup,
  type RelationEdge,
  type SearchIndex,
  type UnitSummary,
  type ViewerMode,
} from "./corpusData";
import { AlignedLabelList, BlockContent, groupAlignedLabelBlocks, hasAlphabeticListMarker, hasLeadingEmphasisLabel, hasLeadingMath, hasNoListMarker, hasOfficialListMarker, hasSimpleDashMarker, hasTrailingMath, hasTrailingStrong, indentLevelClass, isRepeatedUnitTitle, listLevelClass, listMarkerClass } from "./CorpusContent";

const modeOptions: Array<{ id: ViewerMode; label: string }> = [
  { id: "ntc", label: "Solo NTC 2018" },
  { id: "circ", label: "Solo Circolare 7/2019" },
  { id: "combined", label: "NTC 2018 + Circolare 7/2019" },
];
const hierarchyLabels = ["Capitoli", "Paragrafi", "Sottoparagrafi"];

const ModeSegmentedControl = memo(function ModeSegmentedControl({ mode, onChange }: { mode: ViewerMode; onChange: (nextMode: ViewerMode) => void }) {
  return <div className="scv-mode-switch" role="group" aria-label="Modalità documento">
    {modeOptions.map((option) => <button type="button" key={option.id} className={`scv-mode-button ${mode === option.id ? "active" : ""}`} onClick={() => onChange(option.id)} aria-label={option.label} aria-pressed={mode === option.id} title={option.label}><span>{option.id === "ntc" ? <>NTC<br />2018</> : option.id === "circ" ? <>CIRC.<br />2019</> : <>NTC<br />CIRC.</>}</span></button>)}
  </div>;
});

function scvBlockClass(block: CorpusUnit["blocks"][number]) {
  return `scv-block scv-block-${block.kind} ${hasOfficialListMarker(block) ? "list-item-with-official-marker" : ""} ${hasAlphabeticListMarker(block) ? "list-item-with-alphabetic-marker" : ""} ${hasSimpleDashMarker(block) ? "list-item-with-simple-dash" : ""} ${hasNoListMarker(block) ? "list-item-without-marker" : ""} ${listMarkerClass(block)} ${listLevelClass(block)} ${indentLevelClass(block)} ${hasLeadingMath(block) ? "list-item-with-leading-symbol" : ""} ${hasLeadingEmphasisLabel(block) ? "block-with-leading-label" : ""} ${hasTrailingStrong(block) ? "list-item-with-trailing-siglum" : ""} ${hasTrailingMath(block) ? "list-item-with-trailing-symbol" : ""}`;
}

const ScvBlockFlow = memo(function ScvBlockFlow({ blocks, assets, assetsBaseUrl }: { blocks: CorpusUnit["blocks"]; assets: CorpusChunk["assets"]; assetsBaseUrl: string }) {
  return <div className="scv-unit-blocks">{groupAlignedLabelBlocks(blocks).map((group) => group.kind === "label-list"
    ? <AlignedLabelList blocks={group.blocks} assets={assets} assetsBaseUrl={assetsBaseUrl} key={group.blocks[0].blockId} />
    : <div className={scvBlockClass(group.block)} key={group.block.blockId}><BlockContent block={group.block} assets={assets} assetsBaseUrl={assetsBaseUrl} /></div>)}</div>;
});

export interface AuxiliaryPanelContext {
  mode: ViewerMode;
  documentId: DocumentId;
  manifest: CorpusManifest;
  chunk: CorpusChunk | null;
  pageBounds: { from: number; to: number };
}

export type AuxiliaryPanel = ReactNode | ((context: AuxiliaryPanelContext) => ReactNode);

export interface NormativeViewerProps {
  defaultMode?: ViewerMode;
  dataBaseUrl?: string;
  assetsBaseUrl?: string;
  auxiliaryPanel?: AuxiliaryPanel;
  auxiliaryPanelLabel?: string;
  auxiliaryPanelDefaultVisible?: boolean;
  className?: string;
}

interface RelatedRecord { edge: RelationEdge; unit: CorpusUnit; chunk: CorpusChunk; }
interface UnitRecord { summary: UnitSummary; unit: CorpusUnit; chunk: CorpusChunk; }
interface NavigationEntry {
  summary: UnitSummary;
  source: DocumentId;
  baseNumber: string;
  displayNumber: string;
  level: number;
  parentBaseNumber: string | null;
}
interface CombinedPlan {
  fallbackSummaries: UnitSummary[];
  circPathsByPrimaryPath: Map<string, Set<string>>;
  primaryAnchorByFallbackId: Map<string, UnitSummary>;
}

const chunkUnitMaps = new WeakMap<CorpusChunk, Map<string, CorpusUnit>>();
const emptyRelatedRecords: RelatedRecord[] = [];

function unitsForChunk(chunk: CorpusChunk) {
  let map = chunkUnitMaps.get(chunk);
  if (!map) {
    map = new Map(chunk.units.map((unit) => [unit.id, unit]));
    chunkUnitMaps.set(chunk, map);
  }
  return map;
}

function depth(unit: UnitSummary | CorpusUnit) {
  return unit.hierarchy.ancestorIds.length;
}

function hasUnitContent(unit: CorpusUnit) {
  return unit.blocks.some((block) => {
    if (block.kind === "heading" || block.blockId === unit.titleBlockId) return false;
    return Boolean(block.assetId || block.text?.normalized?.trim());
  });
}

function baseNumbering(value: string) {
  return value.replace(/^C/iu, "");
}

function compareNumbering(left: UnitSummary | CorpusUnit, right: UnitSummary | CorpusUnit) {
  return left.numbering.sortKey.localeCompare(right.numbering.sortKey, "it", { numeric: true });
}

function compareBaseNumbering(left: UnitSummary, right: UnitSummary) {
  return baseNumbering(left.numbering.official).localeCompare(baseNumbering(right.numbering.official), "it", { numeric: true });
}

function parentNumbering(value: string) {
  const parts = value.split(".");
  parts.pop();
  return parts.join(".") || null;
}

function normalizedQuery(value: string) {
  return value.normalize("NFKC").trim().toLocaleLowerCase("it");
}

function findTextUnit(root: HTMLElement | null, unitId: string) {
  return root?.querySelector<HTMLElement>(`[data-scv-text-unit="${CSS.escape(unitId)}"]`) ?? null;
}

function scrollTextUnit(root: HTMLElement | null, unitId: string) {
  const target = findTextUnit(root, unitId);
  if (!root || !target) return false;
  root.scrollTo({ top: Math.max(0, target.offsetTop - 14), behavior: "auto" });
  return true;
}

function updateDeepLink(mode: ViewerMode, unitId: string, defaultMode: ViewerMode) {
  const url = new URL(window.location.href);
  if (mode === defaultMode) url.searchParams.delete("mode");
  else url.searchParams.set("mode", mode);
  url.searchParams.set("unit", unitId);
  window.history.replaceState(null, "", url);
}

function evidencePages(unit: CorpusUnit, chunk: CorpusChunk) {
  const pages = unit.blocks.flatMap((block) => {
    if (block.evidence?.pdfPage) return [block.evidence.pdfPage];
    if (!block.assetId) return [];
    const asset = chunk.assets.formulas[block.assetId] ?? chunk.assets.tables[block.assetId] ?? chunk.assets.figures[block.assetId];
    return asset?.pdfPage ? [asset.pdfPage] : [];
  });
  return [...new Set(pages)].sort((left, right) => left - right);
}

function snippet(value: string) {
  const compact = value.replace(/\s+/gu, " ").trim();
  return compact.length > 145 ? `${compact.slice(0, 142)}…` : compact;
}

function relationTargets(resultId: string, relations: RelationEdge[]) {
  return relations
    .filter((edge) => edge.sourceUnitId === resultId)
    .sort((left, right) => left.targetUnitId.localeCompare(right.targetUnitId, "it", { numeric: true }));
}

function recordsForPaths(index: DocumentIndex | null, lookup: DocumentLookup | null, paths: Set<string>, chunks: Map<string, CorpusChunk>) {
  if (!index || !lookup) return [];
  const records: UnitRecord[] = [];
  for (const path of lookup.chunkPaths) {
    if (!paths.has(path)) continue;
    const chunk = chunks.get(path);
    if (!chunk) continue;
    const units = unitsForChunk(chunk);
    for (const summary of lookup.unitsByChunkPath.get(path) ?? []) {
      const unit = units.get(summary.id);
      if (unit) records.push({ summary, unit, chunk });
    }
  }
  return records;
}

function buildCombinedPlan(primaryIndex: DocumentIndex | null, circIndex: DocumentIndex | null, relations: RelationEdge[]): CombinedPlan {
  const empty: CombinedPlan = { fallbackSummaries: [], circPathsByPrimaryPath: new Map(), primaryAnchorByFallbackId: new Map() };
  if (!primaryIndex || !circIndex) return empty;
  const primaryNumbers = new Set(primaryIndex.units.map((summary) => baseNumbering(summary.numbering.official)));
  const relatedSourceIds = new Set(relations.map((edge) => edge.sourceUnitId));
  const fallbackSummaries = circIndex.units.filter((summary) => !primaryNumbers.has(baseNumbering(summary.numbering.official)) && !relatedSourceIds.has(summary.id));
  const primary = [...primaryIndex.units].sort(compareBaseNumbering);
  const circPathsByPrimaryPath = new Map<string, Set<string>>();
  const primaryAnchorByFallbackId = new Map<string, UnitSummary>();
  for (const fallback of fallbackSummaries) {
    let low = 0;
    let high = primary.length;
    while (low < high) {
      const middle = (low + high) >>> 1;
      if (compareBaseNumbering(primary[middle], fallback) <= 0) low = middle + 1;
      else high = middle;
    }
    const anchor = primary[Math.max(0, low - 1)] ?? primary[0];
    if (!anchor) continue;
    primaryAnchorByFallbackId.set(fallback.id, anchor);
    const paths = circPathsByPrimaryPath.get(anchor.chunkPath) ?? new Set<string>();
    paths.add(fallback.chunkPath);
    circPathsByPrimaryPath.set(anchor.chunkPath, paths);
  }
  return { fallbackSummaries, circPathsByPrimaryPath, primaryAnchorByFallbackId };
}

function navigationEntry(summary: UnitSummary, source = summary.document): NavigationEntry {
  const rawNumber = summary.numbering.official;
  const displayNumber = source === "circ2019" && !/^C/iu.test(rawNumber) ? `C${rawNumber}` : rawNumber;
  const baseNumber = baseNumbering(displayNumber);
  return { summary, source, baseNumber, displayNumber, level: depth(summary), parentBaseNumber: parentNumbering(baseNumber) };
}

function sameRelatedRecords(left: RelatedRecord[], right: RelatedRecord[]) {
  return left.length === right.length && left.every((record, index) => record.edge.relationId === right[index]?.edge.relationId && record.unit === right[index]?.unit);
}

const MemoizedUnit = memo(function MemoizedUnit({ record, mode, relatedRecords, assetsBaseUrl }: { record: UnitRecord; mode: ViewerMode; relatedRecords: RelatedRecord[]; assetsBaseUrl: string }) {
  const { unit, chunk } = record;
  const isChapter = depth(unit) === 0;
  const visibleRelated = mode === "combined" ? relatedRecords.filter(({ unit: relatedUnit }) => hasUnitContent(relatedUnit)) : emptyRelatedRecords;
  const keepNtcChapterMarker = mode === "combined" && unit.document === "ntc2018" && isChapter;
  if (mode === "combined" && !hasUnitContent(unit) && visibleRelated.length === 0 && !keepNtcChapterMarker) {
    return <span className="scv-structural-anchor" data-scv-text-unit={unit.id} data-scv-chunk-path={record.summary.chunkPath} aria-hidden="true" />;
  }
  return <section className={`scv-unit scv-unit-depth-${Math.min(depth(unit), 4)}`} data-scv-text-unit={unit.id} data-scv-chunk-path={record.summary.chunkPath}>
    {isChapter ? <h2 className="scv-chapter-heading"><span className="scv-chapter-badge"><span className="scv-chapter-badge-label">Capitolo</span><strong>{unit.numbering.official}.</strong></span><span className="scv-chapter-rule" aria-hidden="true" /><span className="scv-chapter-title">{unit.title}</span></h2> : <h2><span className="scv-unit-number">{unit.numbering.official}</span><span className="scv-unit-title">{unit.title}</span></h2>}
    <ScvBlockFlow blocks={unit.blocks.filter((block) => !isRepeatedUnitTitle(unit, block))} assets={chunk.assets} assetsBaseUrl={assetsBaseUrl} />
    {visibleRelated.map(({ edge, unit: relatedUnit, chunk: relatedChunk }) => <section className="scv-related-unit" data-provenance="Circolare 7/2019" key={edge.relationId}><header><h3><span className="scv-related-number">{relatedUnit.numbering.official}</span><span className="scv-related-title">{relatedUnit.title}</span></h3></header><ScvBlockFlow blocks={relatedUnit.blocks.filter((block) => !isRepeatedUnitTitle(relatedUnit, block))} assets={relatedChunk.assets} assetsBaseUrl={assetsBaseUrl} /></section>)}
  </section>;
}, (previous, next) => previous.record.unit === next.record.unit && previous.record.chunk === next.record.chunk && previous.mode === next.mode && previous.assetsBaseUrl === next.assetsBaseUrl && sameRelatedRecords(previous.relatedRecords, next.relatedRecords));

const DocumentContent = memo(function DocumentContent({ records, relatedByTarget, mode, assetsBaseUrl, documentLabel, documentUnits, documentChunks, hasPrevious, hasNext }: {
  records: UnitRecord[];
  relatedByTarget: Map<string, RelatedRecord[]>;
  mode: ViewerMode;
  assetsBaseUrl: string;
  documentLabel: string;
  documentUnits: number;
  documentChunks: number;
  hasPrevious: boolean;
  hasNext: boolean;
}) {
  if (records.length === 0) return <LoadingPanel label="Caricamento dei contenuti…" />;
  const version = records[0].chunk.structuralCodesVersion;
  return <div className="scv-text-flow">
    {hasPrevious && <div className="scv-progressive-edge" aria-hidden="true" />}
    <p className="scv-chunk-note">Documento continuo · {documentLabel} · {documentUnits} unità · {documentChunks} chunk · structural-codes {version}</p>
    {records.map((record) => <MemoizedUnit record={record} mode={mode} relatedRecords={relatedByTarget.get(record.unit.id) ?? emptyRelatedRecords} assetsBaseUrl={assetsBaseUrl} key={record.unit.id} />)}
    {hasNext ? <div className="scv-progressive-edge" aria-hidden="true" /> : <div className="scv-end-note">Fine del documento.</div>}
  </div>;
});

interface ScrollMarker { id: string; label: string; level: "chapter" | "paragraph"; }
interface PositionedScrollMarker extends ScrollMarker { top: number; }
interface ScrollGeometry { scrollHeight: number; clientHeight: number; markers: PositionedScrollMarker[]; }

const DocumentScrollbar = memo(function DocumentScrollbar({ rootRef, markers, activeId, onSelect }: {
  rootRef: RefObject<HTMLElement | null>;
  markers: ScrollMarker[];
  activeId: string | null;
  onSelect: (id: string) => void;
}) {
  const [geometry, setGeometry] = useState<ScrollGeometry>({ scrollHeight: 1, clientHeight: 1, markers: [] });
  const geometryRef = useRef(geometry);
  const thumbRef = useRef<HTMLSpanElement>(null);
  const dragRef = useRef<{ pointerId: number; startY: number; startTop: number; trackHeight: number } | null>(null);
  const updateThumb = useCallback(() => {
    const root = rootRef.current;
    const thumb = thumbRef.current;
    if (!root || !thumb) return;
    const current = geometryRef.current;
    const scrollRange = Math.max(1, current.scrollHeight - current.clientHeight);
    const thumbHeight = Math.max(9, Math.min(100, (current.clientHeight / current.scrollHeight) * 100));
    const thumbTop = Math.min(100 - thumbHeight, (root.scrollTop / scrollRange) * (100 - thumbHeight));
    thumb.style.height = `${thumbHeight}%`;
    thumb.style.top = `${thumbTop}%`;
  }, [rootRef]);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    let frame: number | null = null;
    const measureGeometry = () => {
      frame = null;
      const elements = new Map([...root.querySelectorAll<HTMLElement>("[data-scv-text-unit]")].map((element) => [element.dataset.scvTextUnit, element]));
      const next: ScrollGeometry = {
        scrollHeight: Math.max(1, root.scrollHeight),
        clientHeight: Math.max(1, root.clientHeight),
        markers: markers.flatMap((marker) => {
          const element = elements.get(marker.id);
          return element ? [{ ...marker, top: Math.max(0, element.offsetTop) }] : [];
        }),
      };
      geometryRef.current = next;
      setGeometry(next);
      updateThumb();
    };
    const scheduleGeometry = () => { if (frame === null) frame = window.requestAnimationFrame(measureGeometry); };
    measureGeometry();
    window.addEventListener("resize", scheduleGeometry);
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(scheduleGeometry);
    observer?.observe(root);
    const flow = root.querySelector<HTMLElement>(".scv-text-flow");
    if (flow) observer?.observe(flow);
    return () => {
      window.removeEventListener("resize", scheduleGeometry);
      observer?.disconnect();
      if (frame !== null) window.cancelAnimationFrame(frame);
    };
  }, [markers, rootRef, updateThumb]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    let frame: number | null = null;
    const onScroll = () => {
      if (frame !== null) return;
      frame = window.requestAnimationFrame(() => { frame = null; updateThumb(); });
    };
    root.addEventListener("scroll", onScroll, { passive: true });
    updateThumb();
    return () => {
      root.removeEventListener("scroll", onScroll);
      if (frame !== null) window.cancelAnimationFrame(frame);
    };
  }, [rootRef, updateThumb]);

  if (markers.length === 0 || geometry.scrollHeight <= geometry.clientHeight) return null;
  const scrollRange = Math.max(1, geometry.scrollHeight - geometry.clientHeight);
  const thumbHeight = Math.max(9, Math.min(100, (geometry.clientHeight / geometry.scrollHeight) * 100));
  const jumpTo = (event: React.MouseEvent<HTMLDivElement>) => {
    const root = rootRef.current;
    if (!root) return;
    const trackRect = event.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (event.clientY - trackRect.top) / trackRect.height));
    root.scrollTop = ratio * scrollRange;
  };
  const startDrag = (event: React.PointerEvent<HTMLSpanElement>) => {
    const root = rootRef.current;
    if (!root) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { pointerId: event.pointerId, startY: event.clientY, startTop: root.scrollTop, trackHeight: event.currentTarget.parentElement?.getBoundingClientRect().height ?? 1 };
    event.preventDefault();
  };
  const moveDrag = (event: React.PointerEvent<HTMLSpanElement>) => {
    const root = rootRef.current;
    const drag = dragRef.current;
    if (!root || !drag || drag.pointerId !== event.pointerId) return;
    const thumbHeightPx = drag.trackHeight * (thumbHeight / 100);
    root.scrollTop = Math.max(0, Math.min(scrollRange, drag.startTop + ((event.clientY - drag.startY) * scrollRange) / Math.max(1, drag.trackHeight - thumbHeightPx)));
  };
  const stopDrag = (event: React.PointerEvent<HTMLSpanElement>) => { if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null; };
  return <div className="scv-scroll-rail" aria-label="Navigazione documento">
    <div className="scv-scroll-track" role="presentation" onClick={jumpTo}>
      <span ref={thumbRef} className="scv-scroll-thumb" onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={stopDrag} onPointerCancel={stopDrag} onClick={(event) => event.stopPropagation()} />
    </div>
    {geometry.markers.map((marker) => <button type="button" key={marker.id} className={`scv-scroll-marker ${marker.level} ${marker.id === activeId ? "active" : ""}`} style={{ top: `${Math.min(100, (marker.top / geometry.scrollHeight) * 100)}%` }} onClick={() => onSelect(marker.id)} aria-label={`Vai a ${marker.label}`} title={marker.label}><span className="scv-scroll-marker-label">{marker.label}</span></button>)}
  </div>;
});

function useVisibleUnitObserver(rootRef: RefObject<HTMLElement | null>, records: UnitRecord[], onVisible: (unitId: string) => void) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root || records.length === 0) return;
    const elements = [...root.querySelectorAll<HTMLElement>("[data-scv-text-unit]")];
    if (elements.length === 0) return;
    const orderedIds = elements.flatMap((element) => element.dataset.scvTextUnit ? [element.dataset.scvTextUnit] : []);
    if (typeof IntersectionObserver === "undefined") {
      const positions = elements.map((element) => ({ id: element.dataset.scvTextUnit ?? "", top: element.offsetTop }));
      let frame: number | null = null;
      const update = () => {
        frame = null;
        const marker = root.scrollTop + Math.min(root.clientHeight * 0.28, 220);
        let low = 0;
        let high = positions.length;
        while (low < high) {
          const middle = (low + high) >>> 1;
          if (positions[middle].top <= marker) low = middle + 1;
          else high = middle;
        }
        const candidate = positions[Math.max(0, low - 1)];
        if (candidate?.id) onVisible(candidate.id);
      };
      const onScroll = () => { if (frame === null) frame = window.requestAnimationFrame(update); };
      root.addEventListener("scroll", onScroll, { passive: true });
      update();
      return () => {
        root.removeEventListener("scroll", onScroll);
        if (frame !== null) window.cancelAnimationFrame(frame);
      };
    }
    const visible = new Set<string>();
    let frame: number | null = null;
    const commit = () => {
      frame = null;
      for (let index = orderedIds.length - 1; index >= 0; index -= 1) {
        if (visible.has(orderedIds[index])) { onVisible(orderedIds[index]); return; }
      }
    };
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const id = (entry.target as HTMLElement).dataset.scvTextUnit;
        if (!id) continue;
        if (entry.isIntersecting) visible.add(id);
        else visible.delete(id);
      }
      if (frame === null) frame = window.requestAnimationFrame(commit);
    }, { root, rootMargin: "0px 0px -72% 0px", threshold: 0.01 });
    for (const element of elements) observer.observe(element);
    return () => {
      observer.disconnect();
      if (frame !== null) window.cancelAnimationFrame(frame);
    };
  }, [onVisible, records, rootRef]);
}

const NavigationPane = memo(function NavigationPane({ mode, onModeChange, hierarchy, activeLevelIds, indexReady, query, onQueryChange, deferredQuery, searchIndex, searchResults, onSearchSubmit, onSearchResult, onSelectUnit, searchRef, settingsButtonRef, onOpenSettings }: {
  mode: ViewerMode;
  onModeChange: (mode: ViewerMode) => void;
  hierarchy: NavigationEntry[][];
  activeLevelIds: Array<string | null>;
  indexReady: boolean;
  query: string;
  onQueryChange: (query: string) => void;
  deferredQuery: string;
  searchIndex: SearchIndex | null;
  searchResults: SearchIndex["units"];
  onSearchSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onSearchResult: (result: SearchIndex["units"][number]) => void;
  onSelectUnit: (unit: UnitSummary) => void;
  searchRef: RefObject<HTMLInputElement | null>;
  settingsButtonRef: RefObject<HTMLButtonElement | null>;
  onOpenSettings: () => void;
}) {
  return <aside className="scv-index-pane" aria-label="Indice gerarchico">
    <div className="scv-search-toolbar">
      <div className="scv-search-box">
        <form className="scv-search-form" role="search" onSubmit={onSearchSubmit}>
          <span aria-hidden="true">⌕</span>
          <input ref={searchRef} type="search" value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="Cerca nella normativa…" aria-label="Cerca nella normativa" />
          {query && <button type="button" className="scv-clear-search" onClick={() => onQueryChange("")} aria-label="Cancella ricerca">×</button>}
          <kbd>/</kbd>
        </form>
        {deferredQuery.length >= 2 && <div className="scv-search-results" role="listbox" aria-label="Risultati ricerca">
          {!searchIndex ? <p className="scv-search-status">Caricamento indice di ricerca…</p> : searchResults.length === 0 ? <p className="scv-search-status">Nessun risultato nella modalità corrente.</p> : searchResults.map((result) => <button type="button" role="option" aria-selected={false} className="scv-search-result" key={result.id} onClick={() => onSearchResult(result)}><span>{result.document === "ntc2018" ? "NTC 2018" : "Circolare 7/2019"} · {result.numbering}</span><strong>{result.title}</strong><small>{snippet(result.text || result.title)}</small></button>)}
        </div>}
      </div>
      <ModeSegmentedControl mode={mode} onChange={onModeChange} />
      <button ref={settingsButtonRef} type="button" className="scv-settings-button" onClick={onOpenSettings} aria-label="Impostazioni consultazione" aria-haspopup="dialog"><span aria-hidden="true">⚙</span></button>
    </div>
    <div className="scv-index-grid">
      {hierarchy.map((level, levelIndex) => {
        const activeLevelId = activeLevelIds[levelIndex];
        return <section className="scv-index-cell" key={levelIndex}><header><span>{hierarchyLabels[levelIndex]}</span><b>{level.length}</b></header><div className="scv-index-list">{!indexReady ? <LoadingRows /> : level.length === 0 ? <p className="scv-index-empty">Seleziona il livello superiore.</p> : level.map((entry) => <button type="button" key={entry.summary.id} data-index-unit={entry.summary.id} className={activeLevelId === entry.summary.id ? "active" : ""} onClick={() => onSelectUnit(entry.summary)} title={`${entry.displayNumber} ${entry.summary.title}`} aria-current={activeLevelId === entry.summary.id ? "page" : undefined}><strong>{entry.displayNumber}</strong><span>{entry.summary.title}</span></button>)}</div></section>;
      })}
    </div>
  </aside>;
});

function scheduleIdle(callback: () => void) {
  const idleWindow = window as typeof window & { requestIdleCallback?: (task: () => void, options?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void };
  if (idleWindow.requestIdleCallback) {
    const id = idleWindow.requestIdleCallback(callback, { timeout: 1800 });
    return () => idleWindow.cancelIdleCallback?.(id);
  }
  const id = window.setTimeout(callback, 250);
  return () => window.clearTimeout(id);
}

export function NormativeViewer({ defaultMode = "combined", dataBaseUrl = "/data/codes", assetsBaseUrl = "/assets", auxiliaryPanel, auxiliaryPanelLabel = "PDF ufficiale", auxiliaryPanelDefaultVisible = false, className }: NormativeViewerProps) {
  const [manifest, setManifest] = useState<CorpusManifest | null>(null);
  const [indexes, setIndexes] = useState<Map<DocumentId, DocumentIndex>>(new Map());
  const [loadedChunks, setLoadedChunks] = useState<Map<string, CorpusChunk>>(new Map());
  const [renderedChunkPaths, setRenderedChunkPaths] = useState<Set<string>>(new Set());
  const [requestedCircPaths, setRequestedCircPaths] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState<ViewerMode>(defaultMode);
  const [modeRevision, setModeRevision] = useState(0);
  const [activeUnitId, setActiveUnitId] = useState<string | null>(null);
  const [relations, setRelations] = useState<RelationEdge[]>([]);
  const [relationsLoaded, setRelationsLoaded] = useState(false);
  const [searchIndex, setSearchIndex] = useState<SearchIndex | null>(null);
  const [query, setQuery] = useState("");
  const [loadError, setLoadError] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [darkMode, setDarkMode] = useState<boolean | null>(null);
  const [auxiliaryVisible, setAuxiliaryVisible] = useState(Boolean(auxiliaryPanel && auxiliaryPanelDefaultVisible));
  const searchRef = useRef<HTMLInputElement>(null);
  const settingsButtonRef = useRef<HTMLButtonElement>(null);
  const dialogCloseRef = useRef<HTMLButtonElement>(null);
  const requestedIdRef = useRef<string | null>(null);
  const scrollRequestRef = useRef<string | null>(null);
  const activeIdRef = useRef<string | null>(null);
  const manualTargetRef = useRef<{ id: string; expires: number } | null>(null);
  const mountGenerationRef = useRef(0);
  const renderedChunkPathsRef = useRef<Set<string>>(new Set());
  const pendingScrollAnchorRef = useRef<{ id: string; top: number; generation: number } | null>(null);
  const initializedContextRef = useRef("");
  const textPaneRef = useRef<HTMLElement>(null);
  const documentId = documentForMode(mode);
  const documentIdRef = useRef(documentId);
  const deferredQuery = normalizedQuery(query);
  const hasAuxiliary = Boolean(auxiliaryPanel);
  const auxiliaryAvailable = hasAuxiliary && mode !== "combined";

  useEffect(() => {
    documentIdRef.current = documentId;
  }, [documentId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try { setDarkMode(window.localStorage.getItem("scv-theme") === "dark"); }
      catch { setDarkMode(false); }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (darkMode === null) return;
    try { window.localStorage.setItem("scv-theme", darkMode ? "dark" : "light"); }
    catch { /* Storage can be unavailable in private or embedded browsing contexts. */ }
  }, [darkMode]);

  useEffect(() => {
    let cancelled = false;
    loadManifest(dataBaseUrl).then((loaded) => {
      if (cancelled) return;
      setIndexes(new Map());
      setLoadedChunks(new Map());
      setRenderedChunkPaths(new Set());
      renderedChunkPathsRef.current = new Set();
      setRequestedCircPaths(new Set());
      setRelations([]);
      setRelationsLoaded(false);
      setSearchIndex(null);
      const url = new URL(window.location.href);
      const requestedMode = url.searchParams.get("mode");
      if (modeOptions.some((option) => option.id === requestedMode)) setMode(requestedMode as ViewerMode);
      requestedIdRef.current = url.searchParams.get("unit");
      setActiveUnitId(requestedIdRef.current);
      setManifest(loaded);
    }).catch(() => { if (!cancelled) setLoadError(true); });
    return () => { cancelled = true; };
  }, [dataBaseUrl]);

  useEffect(() => {
    if (!manifest || indexes.has(documentId)) return;
    let cancelled = false;
    loadDocumentIndex(manifest, documentId, dataBaseUrl).then((loaded) => {
      if (!cancelled) setIndexes((current) => new Map(current).set(documentId, loaded));
    }).catch(() => { if (!cancelled) setLoadError(true); });
    return () => { cancelled = true; };
  }, [dataBaseUrl, documentId, indexes, manifest]);

  useEffect(() => {
    if (!manifest || mode !== "combined" || indexes.has("circ2019")) return;
    let cancelled = false;
    loadDocumentIndex(manifest, "circ2019", dataBaseUrl).then((loaded) => {
      if (!cancelled) setIndexes((current) => new Map(current).set("circ2019", loaded));
    }).catch(() => { if (!cancelled) setLoadError(true); });
    return () => { cancelled = true; };
  }, [dataBaseUrl, indexes, manifest, mode]);

  useEffect(() => {
    if (!manifest || mode !== "combined" || relationsLoaded) return;
    let cancelled = false;
    loadRelations(manifest, dataBaseUrl).then(({ relations: loadedRelations }) => {
      if (!cancelled) { setRelations(loadedRelations); setRelationsLoaded(true); }
    }).catch(() => { if (!cancelled) setLoadError(true); });
    return () => { cancelled = true; };
  }, [dataBaseUrl, manifest, mode, relationsLoaded]);

  const index = indexes.get(documentId) ?? null;
  const circIndex = indexes.get("circ2019") ?? null;
  const lookup = useMemo(() => index ? createDocumentLookup(index) : null, [index]);
  const circLookup = useMemo(() => circIndex ? createDocumentLookup(circIndex) : null, [circIndex]);
  const combinedPlan = useMemo(() => buildCombinedPlan(mode === "combined" ? index : null, mode === "combined" ? circIndex : null, relations), [circIndex, index, mode, relations]);
  const primaryRenderedPaths = useMemo(() => new Set(lookup?.chunkPaths.filter((path) => renderedChunkPaths.has(path)) ?? []), [lookup, renderedChunkPaths]);

  const rememberChunk = useCallback(async (path: string) => {
    const chunk = await loadChunk(path, dataBaseUrl);
    setLoadedChunks((current) => current.get(path) === chunk ? current : new Map(current).set(path, chunk));
    return chunk;
  }, [dataBaseUrl]);

  const mountPrimaryChunk = useCallback(async (path: string, replace: boolean, preserveAnchor = false) => {
    const generation = replace ? ++mountGenerationRef.current : mountGenerationRef.current;
    const chunk = await rememberChunk(path);
    if (generation !== mountGenerationRef.current || chunk.document !== documentIdRef.current) return;
    const current = renderedChunkPathsRef.current;
    if (!replace && current.has(path)) return;
    if (preserveAnchor) {
      const root = textPaneRef.current;
      const anchorId = activeIdRef.current;
      const anchor = anchorId ? findTextUnit(root, anchorId) : null;
      if (root && anchor && anchorId) {
        pendingScrollAnchorRef.current = { id: anchorId, top: anchor.getBoundingClientRect().top - root.getBoundingClientRect().top, generation };
      }
    }
    const next = replace ? new Set([path]) : new Set(current).add(path);
    renderedChunkPathsRef.current = next;
    setRenderedChunkPaths(next);
  }, [rememberChunk]);

  const requiredCombinedCircPaths = useMemo(() => {
    const paths = new Set(requestedCircPaths);
    if (mode !== "combined") return paths;
    for (const primaryPath of primaryRenderedPaths) {
      for (const path of combinedPlan.circPathsByPrimaryPath.get(primaryPath) ?? []) paths.add(path);
    }
    for (const edge of relations) {
      const target = lookup?.unitById.get(edge.targetUnitId);
      if (target && primaryRenderedPaths.has(target.chunkPath)) paths.add(edge.sourceChunkPath);
    }
    return paths;
  }, [combinedPlan.circPathsByPrimaryPath, lookup, mode, primaryRenderedPaths, relations, requestedCircPaths]);

  useEffect(() => {
    if (mode !== "combined") return;
    const missing = [...requiredCombinedCircPaths].filter((path) => !loadedChunks.has(path));
    if (missing.length === 0) return;
    let cancelled = false;
    Promise.all(missing.map((path) => loadChunk(path, dataBaseUrl))).then((chunks) => {
      if (cancelled) return;
      setLoadedChunks((current) => {
        const next = new Map(current);
        missing.forEach((path, position) => next.set(path, chunks[position]));
        return next;
      });
    }).catch(() => { if (!cancelled) setLoadError(true); });
    return () => { cancelled = true; };
  }, [dataBaseUrl, loadedChunks, mode, requiredCombinedCircPaths]);

  const documentRecords = useMemo(() => recordsForPaths(index, lookup, primaryRenderedPaths, loadedChunks), [index, loadedChunks, lookup, primaryRenderedPaths]);
  const fallbackIds = useMemo(() => new Set(combinedPlan.fallbackSummaries.map((summary) => summary.id)), [combinedPlan.fallbackSummaries]);
  const circRecords = useMemo(() => {
    if (mode !== "combined" || !circIndex || !circLookup) return [];
    return recordsForPaths(circIndex, circLookup, requiredCombinedCircPaths, loadedChunks).filter(({ unit }) => fallbackIds.has(unit.id) && hasUnitContent(unit));
  }, [circIndex, circLookup, fallbackIds, loadedChunks, mode, requiredCombinedCircPaths]);
  const relatedByTarget = useMemo(() => {
    const grouped = new Map<string, RelatedRecord[]>();
    if (mode !== "combined") return grouped;
    for (const edge of relations) {
      const target = lookup?.unitById.get(edge.targetUnitId);
      if (!target || !primaryRenderedPaths.has(target.chunkPath)) continue;
      const sourceChunk = loadedChunks.get(edge.sourceChunkPath);
      const unit = sourceChunk ? unitsForChunk(sourceChunk).get(edge.sourceUnitId) : null;
      if (!sourceChunk || !unit) continue;
      const group = grouped.get(edge.targetUnitId) ?? [];
      group.push({ edge, unit, chunk: sourceChunk });
      grouped.set(edge.targetUnitId, group);
    }
    for (const group of grouped.values()) group.sort((left, right) => compareNumbering(left.unit, right.unit));
    return grouped;
  }, [loadedChunks, lookup, mode, primaryRenderedPaths, relations]);
  const renderRecords = useMemo(() => [...documentRecords, ...circRecords].sort((left, right) => compareBaseNumbering(left.summary, right.summary)), [circRecords, documentRecords]);

  const navigationEntries = useMemo(() => {
    if (!index) return [];
    const summaries = mode === "combined" ? [...index.units, ...combinedPlan.fallbackSummaries] : index.units;
    return summaries.map((summary) => navigationEntry(summary)).sort((left, right) => compareBaseNumbering(left.summary, right.summary));
  }, [combinedPlan.fallbackSummaries, index, mode]);
  const entryById = useMemo(() => new Map(navigationEntries.map((entry) => [entry.summary.id, entry])), [navigationEntries]);
  const recordById = useMemo(() => new Map(renderRecords.map((record) => [record.unit.id, record])), [renderRecords]);

  const revealSummary = useCallback(async (summary: UnitSummary, replace = false) => {
    scrollRequestRef.current = summary.id;
    if (summary.document === documentIdRef.current) {
      await mountPrimaryChunk(summary.chunkPath, replace);
      return;
    }
    if (mode !== "combined" || !lookup) return;
    const explicitTarget = relationTargets(summary.id, relations)[0];
    if (explicitTarget) {
      const target = lookup.unitById.get(explicitTarget.targetUnitId);
      if (target) { scrollRequestRef.current = target.id; await mountPrimaryChunk(target.chunkPath, replace); }
      return;
    }
    const anchor = combinedPlan.primaryAnchorByFallbackId.get(summary.id);
    if (!anchor) return;
    setRequestedCircPaths((current) => replace ? new Set([summary.chunkPath]) : new Set(current).add(summary.chunkPath));
    await Promise.all([rememberChunk(summary.chunkPath), mountPrimaryChunk(anchor.chunkPath, replace)]);
  }, [combinedPlan.primaryAnchorByFallbackId, lookup, mode, mountPrimaryChunk, relations, rememberChunk]);

  useEffect(() => {
    if (!index || !lookup) return;
    const contextKey = `${mode}:${modeRevision}:${index.document}`;
    if (initializedContextRef.current === contextKey) return;
    const requestedId = requestedIdRef.current;
    let initial = requestedId ? lookup.unitById.get(requestedId) ?? null : null;
    if (!initial && mode === "combined" && requestedId?.includes(":circ2019:")) {
      if (!circLookup || !relationsLoaded) return;
      const requestedCirc = circLookup.unitById.get(requestedId) ?? null;
      const explicitTarget = requestedCirc ? relationTargets(requestedCirc.id, relations)[0] : null;
      initial = explicitTarget ? lookup.unitById.get(explicitTarget.targetUnitId) ?? null : requestedCirc;
    }
    initial ??= initialUnitForIndex(index, requestedId);
    if (!initial) return;
    initializedContextRef.current = contextKey;
    requestedIdRef.current = initial.id;
    activeIdRef.current = initial.id;
    setActiveUnitId(initial.id);
    updateDeepLink(mode, initial.id, defaultMode);
    void revealSummary(initial, primaryRenderedPaths.size === 0 || initial.document !== documentId);
  }, [circLookup, defaultMode, documentId, index, lookup, mode, modeRevision, primaryRenderedPaths.size, relations, relationsLoaded, revealSummary]);

  useEffect(() => {
    if (!lookup || primaryRenderedPaths.size === 0) return;
    const rendered = lookup.chunkPaths.filter((path) => primaryRenderedPaths.has(path));
    const candidates = new Set<string>();
    const previous = rendered[0] ? adjacentChunkPaths(lookup, rendered[0]).previous : null;
    const next = rendered.at(-1) ? adjacentChunkPaths(lookup, rendered.at(-1)!).next : null;
    if (previous) candidates.add(previous);
    if (next) candidates.add(next);
    if (candidates.size === 0) return;
    return scheduleIdle(() => { for (const path of candidates) void loadChunk(path, dataBaseUrl).catch(() => undefined); });
  }, [dataBaseUrl, lookup, primaryRenderedPaths]);

  useLayoutEffect(() => {
    const root = textPaneRef.current;
    const pendingAnchor = pendingScrollAnchorRef.current;
    if (root && pendingAnchor && pendingAnchor.generation === mountGenerationRef.current) {
      const anchor = findTextUnit(root, pendingAnchor.id);
      if (anchor) {
        const nextTop = anchor.getBoundingClientRect().top - root.getBoundingClientRect().top;
        root.scrollTop += nextTop - pendingAnchor.top;
      }
      pendingScrollAnchorRef.current = null;
    }
    const targetId = scrollRequestRef.current;
    if (!targetId || renderRecords.length === 0) return;
    if (!scrollTextUnit(root, targetId)) return;
    scrollRequestRef.current = null;
    manualTargetRef.current = { id: targetId, expires: performance.now() + 500 };
  }, [renderRecords]);

  const navigationRef = useRef({ entryById, lookup, mode, relations });
  useEffect(() => {
    navigationRef.current = { entryById, lookup, mode, relations };
  }, [entryById, lookup, mode, relations]);

  const loadAdjacentAtUnit = useCallback((unitId: string) => {
    const current = navigationRef.current;
    const summary = current.lookup?.unitById.get(unitId);
    if (!summary || !current.lookup) return;
    const chunkUnits = current.lookup.unitsByChunkPath.get(summary.chunkPath) ?? [];
    const position = chunkUnits.findIndex((unit) => unit.id === summary.id);
    const adjacent = adjacentChunkPaths(current.lookup, summary.chunkPath);
    if (position <= 1 && adjacent.previous) void mountPrimaryChunk(adjacent.previous, false, true).catch(() => setLoadError(true));
    if (position >= chunkUnits.length - 2 && adjacent.next) void mountPrimaryChunk(adjacent.next, false).catch(() => setLoadError(true));
  }, [mountPrimaryChunk]);

  const onVisibleUnit = useCallback((nextId: string) => {
    const guard = manualTargetRef.current;
    if (guard && performance.now() < guard.expires && guard.id !== nextId) return;
    if (guard?.id === nextId || (guard && performance.now() >= guard.expires)) manualTargetRef.current = null;
    if (nextId !== activeIdRef.current) {
      activeIdRef.current = nextId;
      requestedIdRef.current = nextId;
      setActiveUnitId(nextId);
      updateDeepLink(navigationRef.current.mode, nextId, defaultMode);
    }
    loadAdjacentAtUnit(nextId);
  }, [defaultMode, loadAdjacentAtUnit]);

  useVisibleUnitObserver(textPaneRef, renderRecords, onVisibleUnit);

  const selectUnit = useCallback((unit: UnitSummary) => {
    requestedIdRef.current = unit.id;
    manualTargetRef.current = { id: unit.id, expires: performance.now() + 500 };
    const present = scrollTextUnit(textPaneRef.current, unit.id);
    activeIdRef.current = unit.id;
    setActiveUnitId(unit.id);
    updateDeepLink(navigationRef.current.mode, unit.id, defaultMode);
    if (present) return;
    const currentLookup = navigationRef.current.lookup;
    const targetPosition = currentLookup?.chunkIndexByPath.get(unit.chunkPath);
    const mountedPositions = currentLookup?.chunkPaths.flatMap((path, position) => primaryRenderedPaths.has(path) ? [position] : []) ?? [];
    const nearMountedWindow = targetPosition !== undefined && mountedPositions.length > 0 && targetPosition >= Math.min(...mountedPositions) - 1 && targetPosition <= Math.max(...mountedPositions) + 1;
    void revealSummary(unit, !nearMountedWindow).catch(() => setLoadError(true));
  }, [defaultMode, primaryRenderedPaths, revealSummary]);

  const selectScrollMarker = useCallback((unitId: string) => {
    const entry = navigationRef.current.entryById.get(unitId);
    if (entry) selectUnit(entry.summary);
  }, [selectUnit]);

  const activeEntry = entryById.get(activeUnitId ?? "") ?? null;
  const activeSummary = activeEntry?.summary ?? null;
  const activeNumberParts = activeEntry?.baseNumber.split(".") ?? [];
  const activeChapterNumber = activeNumberParts[0] ?? null;
  const activeParagraphNumber = activeNumberParts.length >= 2 ? activeNumberParts.slice(0, 2).join(".") : null;
  const activeSubparagraphNumber = activeNumberParts.length >= 3 ? activeNumberParts.slice(0, 3).join(".") : null;
  const chapters = useMemo(() => navigationEntries.filter(({ level }) => level === 0), [navigationEntries]);
  const paragraphs = useMemo(() => activeChapterNumber ? navigationEntries.filter(({ level, parentBaseNumber }) => level === 1 && parentBaseNumber === activeChapterNumber) : [], [activeChapterNumber, navigationEntries]);
  const subparagraphs = useMemo(() => activeParagraphNumber ? navigationEntries.filter(({ level, parentBaseNumber }) => level === 2 && parentBaseNumber === activeParagraphNumber) : [], [activeParagraphNumber, navigationEntries]);
  const hierarchy = useMemo(() => [chapters, paragraphs, subparagraphs], [chapters, paragraphs, subparagraphs]);
  const activeLevelIds = useMemo(() => [
    chapters.find(({ baseNumber }) => baseNumber === activeChapterNumber)?.summary.id ?? null,
    paragraphs.find(({ baseNumber }) => baseNumber === activeParagraphNumber)?.summary.id ?? null,
    subparagraphs.find(({ baseNumber }) => baseNumber === activeSubparagraphNumber)?.summary.id ?? null,
  ], [activeChapterNumber, activeParagraphNumber, activeSubparagraphNumber, chapters, paragraphs, subparagraphs]);
  const scrollbarMarkers = useMemo(() => navigationEntries.flatMap(({ summary, displayNumber, level }) => level > 1 ? [] : [{ id: summary.id, label: displayNumber, level: level === 0 ? "chapter" as const : "paragraph" as const }]), [navigationEntries]);

  const activeRecord = recordById.get(activeUnitId ?? "") ?? null;
  const chunk = activeRecord?.chunk ?? null;
  const activePages = activeRecord ? evidencePages(activeRecord.unit, activeRecord.chunk) : [];
  const pageBounds = activePages.length > 0 ? { from: Math.min(...activePages), to: Math.max(...activePages) } : { from: 1, to: 1 };
  const searchResults = useMemo(() => {
    if (!searchIndex || deferredQuery.length < 2) return [];
    return searchIndex.units.filter((unit) => {
      if (mode === "ntc" && unit.document !== "ntc2018") return false;
      if (mode === "circ" && unit.document !== "circ2019") return false;
      return `${unit.numbering} ${unit.title} ${unit.text}`.normalize("NFKC").toLocaleLowerCase("it").includes(deferredQuery);
    }).slice(0, 12);
  }, [deferredQuery, mode, searchIndex]);

  const changeMode = useCallback((nextMode: ViewerMode, preferredUnitId: string | null = null) => {
    if (nextMode === mode) return;
    const keepCurrent = activeSummary && (nextMode === "combined" || activeSummary.document === documentForMode(nextMode));
    requestedIdRef.current = preferredUnitId ?? (keepCurrent ? activeSummary?.id ?? null : null);
    initializedContextRef.current = "";
    setRequestedCircPaths(new Set());
    setModeRevision((revision) => revision + 1);
    setMode(nextMode);
    setSettingsOpen(false);
  }, [activeSummary, mode]);

  useEffect(() => {
    if (!manifest || deferredQuery.length < 2 || searchIndex) return;
    loadSearchIndex(manifest, dataBaseUrl).then(setSearchIndex).catch(() => setLoadError(true));
  }, [dataBaseUrl, deferredQuery, manifest, searchIndex]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "/" && window.document.activeElement?.tagName.toLowerCase() !== "input") { event.preventDefault(); searchRef.current?.focus(); }
      if (event.key === "Escape" && settingsOpen) setSettingsOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [settingsOpen]);

  useEffect(() => {
    if (settingsOpen) dialogCloseRef.current?.focus();
    else settingsButtonRef.current?.focus();
  }, [settingsOpen]);

  const selectSearchResult = useCallback((result: SearchIndex["units"][number]) => {
    setQuery("");
    const entry = navigationRef.current.entryById.get(result.id);
    if (entry) { selectUnit(entry.summary); return; }
    const primarySummary = navigationRef.current.lookup?.unitById.get(result.id);
    if (primarySummary) { selectUnit(primarySummary); return; }
    if (navigationRef.current.mode === "combined") {
      const explicit = relationTargets(result.id, navigationRef.current.relations)[0];
      const target = explicit ? navigationRef.current.lookup?.unitById.get(explicit.targetUnitId) : null;
      if (target) { selectUnit(target); return; }
    }
    changeMode("circ", result.id);
  }, [changeMode, selectUnit]);

  const submitSearch = useCallback((event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (searchResults[0]) selectSearchResult(searchResults[0]);
  }, [searchResults, selectSearchResult]);

  const primaryPathPositions = lookup?.chunkPaths.flatMap((path, position) => primaryRenderedPaths.has(path) ? [position] : []) ?? [];
  const hasPrevious = primaryPathPositions.length > 0 && Math.min(...primaryPathPositions) > 0;
  const hasNext = Boolean(lookup && primaryPathPositions.length > 0 && Math.max(...primaryPathPositions) < lookup.chunkPaths.length - 1);
  const documentLoading = !index || documentRecords.length === 0;
  const renderAuxiliary: ReactNode = !manifest || !auxiliaryAvailable ? null : typeof auxiliaryPanel === "function" ? auxiliaryPanel({ mode, documentId, manifest, chunk, pageBounds }) : auxiliaryPanel;

  if (loadError) return <main className="scv-fatal"><strong>Il corpus non è disponibile.</strong><span>Rigenera gli artefatti del viewer e ricarica la pagina.</span></main>;

  return <div className={`scv-root ${darkMode ? "scv-dark" : ""} ${auxiliaryVisible && auxiliaryAvailable ? "scv-has-auxiliary" : ""} ${className ?? ""}`} data-scv-mounted-chunks={primaryRenderedPaths.size} data-scv-loaded-related-chunks={mode === "combined" ? requiredCombinedCircPaths.size : 0}>
    <NavigationPane mode={mode} onModeChange={changeMode} hierarchy={hierarchy} activeLevelIds={activeLevelIds} indexReady={Boolean(index)} query={query} onQueryChange={setQuery} deferredQuery={deferredQuery} searchIndex={searchIndex} searchResults={searchResults} onSearchSubmit={submitSearch} onSearchResult={selectSearchResult} onSelectUnit={selectUnit} searchRef={searchRef} settingsButtonRef={settingsButtonRef} onOpenSettings={() => setSettingsOpen(true)} />
    <div className="scv-text-pane-shell">
      <article ref={textPaneRef} className="scv-text-pane" aria-label="Corpus JSON">
        {documentLoading || !index || !lookup ? <LoadingPanel label="Caricamento del documento…" /> : <DocumentContent records={renderRecords} relatedByTarget={relatedByTarget} mode={mode} assetsBaseUrl={assetsBaseUrl} documentLabel={documentId === "ntc2018" ? "NTC 2018" : "Circolare 7/2019"} documentUnits={index.units.length} documentChunks={lookup.chunkPaths.length} hasPrevious={hasPrevious} hasNext={hasNext} />}
      </article>
      <DocumentScrollbar rootRef={textPaneRef} markers={scrollbarMarkers} activeId={activeUnitId} onSelect={selectScrollMarker} />
    </div>
    {auxiliaryVisible && auxiliaryAvailable && renderAuxiliary && <aside className="scv-auxiliary-pane" aria-label={auxiliaryPanelLabel}>{renderAuxiliary}</aside>}
    {settingsOpen && <div className="scv-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSettingsOpen(false); }}><section className="scv-dialog" role="dialog" aria-modal="true" aria-labelledby="scv-settings-title"><header><h2 id="scv-settings-title">Impostazioni consultazione</h2><button ref={dialogCloseRef} type="button" onClick={() => setSettingsOpen(false)} aria-label="Chiudi impostazioni">×</button></header><label className="scv-theme-toggle"><input type="checkbox" checked={Boolean(darkMode)} onChange={(event) => setDarkMode(event.target.checked)} />Modalità scura</label><label className="scv-auxiliary-toggle"><input type="checkbox" checked={auxiliaryVisible && auxiliaryAvailable} disabled={!auxiliaryAvailable} onChange={(event) => setAuxiliaryVisible(event.target.checked)} />Mostra PDF ufficiale</label></section></div>}
  </div>;
}

function LoadingRows() {
  return <div className="scv-loading-rows" aria-label="Caricamento">{Array.from({ length: 7 }, (_, index) => <span key={index} />)}</div>;
}

function LoadingPanel({ label }: { label: string }) {
  return <div className="scv-loading"><span /><strong>{label}</strong></div>;
}

export { modeOptions };
