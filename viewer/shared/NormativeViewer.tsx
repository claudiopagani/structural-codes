"use client";

import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import {
  adjacentChunkPaths,
  createDocumentLookup,
  documentForMode,
  initialUnitForIndex,
  loadChunk,
  loadCrossReferenceIndex,
  loadDocumentIndex,
  loadManifest,
  loadRelations,
  type CorpusChunk,
  type CorpusManifest,
  type CorpusUnit,
  type CrossReferenceAsset,
  type CrossReferenceIndex,
  type CrossReferenceKind,
  type CrossReferenceUnit,
  type DocumentId,
  type DocumentIndex,
  type DocumentLookup,
  type RelationEdge,
  type SearchResult,
  type TextualBacklink,
  type UnitSummary,
  type ViewerMode,
} from "./corpusData";
import { AlignedLabelList, BlockContent, groupAlignedLabelBlocks, hasAlphabeticListMarker, hasLeadingEmphasisLabel, hasLeadingMath, hasNoListMarker, hasOfficialListMarker, hasSimpleDashMarker, hasTrailingMath, hasTrailingStrong, indentLevelClass, isRepeatedUnitTitle, listLevelClass, listMarkerClass } from "./CorpusContent";
import { useViewerSearch } from "./searchClient";
import { createCrossReferenceLookup, resolveCrossReference } from "./crossReferences.js";
import { BacklinkPanel, CitationActions, ReferencePreview, type ReferencePreviewData } from "./ReferenceTools";
import { citationForTarget, targetFromUrl, urlForViewerTarget, type ViewerTarget } from "./permalinks";
import { isChunkNearRenderedWindow, navigationChunkWindow } from "./chunkNavigation.js";

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

function blockAssetKind(block: CorpusUnit["blocks"][number], assets: CorpusChunk["assets"]) {
  if (!block.assetId) return undefined;
  if (assets.formulas[block.assetId]) return "formula";
  if (assets.tables[block.assetId]) return "table";
  if (assets.figures[block.assetId]) return "figure";
  return undefined;
}

const ScvBlockFlow = memo(function ScvBlockFlow({ blocks, assets, assetsBaseUrl, sourceUnitId, sourceDocument }: { blocks: CorpusUnit["blocks"]; assets: CorpusChunk["assets"]; assetsBaseUrl: string; sourceUnitId: string; sourceDocument: DocumentId }) {
  return <div className="scv-unit-blocks">{groupAlignedLabelBlocks(blocks).map((group) => group.kind === "label-list"
    ? <AlignedLabelList blocks={group.blocks} assets={assets} assetsBaseUrl={assetsBaseUrl} sourceUnitId={sourceUnitId} sourceDocument={sourceDocument} key={group.blocks[0].blockId} />
    : <div className={scvBlockClass(group.block)} data-scv-citation-target={group.block.assetId ? "asset" : "block"} data-scv-source-unit-id={sourceUnitId} data-scv-block-id={group.block.blockId} data-scv-asset-id={group.block.assetId} data-scv-asset-kind={blockAssetKind(group.block, assets)} key={group.block.blockId}><BlockContent block={group.block} assets={assets} assetsBaseUrl={assetsBaseUrl} sourceUnitId={sourceUnitId} sourceDocument={sourceDocument} /></div>)}</div>;
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
  searchMaxResults?: number;
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
interface CrossReferenceLookup {
  unitById: Map<string, CrossReferenceUnit>;
  unitByDocumentAndNumber: Map<string, CrossReferenceUnit>;
  assetById: Map<string, CrossReferenceAsset>;
  assetByDocumentKindAndNumber: Map<string, CrossReferenceAsset>;
  backlinksByTarget: Map<string, TextualBacklink[]>;
}
interface ReferenceDescriptor {
  kind: CrossReferenceKind;
  number: string;
  documentHint: DocumentId | null;
  sourceUnitId: string;
  sourceDocument: DocumentId;
}
type CitationSelection = ViewerTarget;
interface ResolvedCrossReference {
  targetType: CrossReferenceKind;
  unit: CrossReferenceUnit;
  asset?: CrossReferenceAsset;
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

function findTextUnit(root: HTMLElement | null, unitId: string) {
  return root?.querySelector<HTMLElement>(`[data-scv-text-unit="${CSS.escape(unitId)}"]`) ?? null;
}

function scrollElementIntoPane(root: HTMLElement, target: HTMLElement) {
  const top = root.scrollTop + target.getBoundingClientRect().top - root.getBoundingClientRect().top;
  root.scrollTo({ top: Math.max(0, top - 14), behavior: "auto" });
}

function scrollTextUnit(root: HTMLElement | null, unitId: string) {
  const target = findTextUnit(root, unitId);
  if (!root || !target) return false;
  scrollElementIntoPane(root, target);
  return true;
}

function findViewerTarget(root: HTMLElement | null, target: ViewerTarget) {
  if (!root) return null;
  const unitId = CSS.escape(target.unitId);
  if (target.kind === "unit") return root.querySelector<HTMLElement>(`[data-scv-text-unit="${unitId}"], [data-scv-related-unit="${unitId}"]`);
  if (target.kind === "block") return root.querySelector<HTMLElement>(`[data-scv-source-unit-id="${unitId}"][data-scv-block-id="${CSS.escape(target.blockId)}"]`);
  return root.querySelector<HTMLElement>(`[data-scv-source-unit-id="${unitId}"][data-scv-asset-id="${CSS.escape(target.assetId)}"]`);
}

function scrollViewerTarget(root: HTMLElement | null, target: ViewerTarget) {
  const element = findViewerTarget(root, target);
  if (!root || !element) return false;
  scrollElementIntoPane(root, element);
  return true;
}

function updateDeepLink(mode: ViewerMode, target: ViewerTarget, defaultMode: ViewerMode, action: "push" | "replace" = "replace") {
  const url = urlForViewerTarget(window.location.href, mode, defaultMode, target);
  window.history[`${action}State`](null, "", url);
}

function documentFromUnitId(unitId: string): DocumentId {
  return unitId.includes(":circ2019:") ? "circ2019" : "ntc2018";
}

function referenceDescriptor(element: HTMLElement): ReferenceDescriptor | null {
  const kind = element.dataset.scvReferenceKind as CrossReferenceKind | undefined;
  const number = element.dataset.scvReferenceNumber;
  const sourceUnitId = element.dataset.scvSourceUnitId;
  const sourceDocument = element.dataset.scvSourceDocument as DocumentId | undefined;
  if (!kind || !number || !sourceUnitId || !sourceDocument) return null;
  const hint = element.dataset.scvReferenceDocument;
  return { kind, number, sourceUnitId, sourceDocument, documentHint: hint === "ntc2018" || hint === "circ2019" ? hint : null };
}

function citationSelectionFromElement(element: HTMLElement): CitationSelection | null {
  const kind = element.dataset.scvCitationTarget;
  const unitId = element.dataset.scvSourceUnitId;
  if (!unitId) return null;
  if (kind === "asset" && element.dataset.scvAssetId) {
    const assetKind = element.dataset.scvAssetKind;
    return { kind: "asset", unitId, assetId: element.dataset.scvAssetId, assetKind: assetKind === "formula" || assetKind === "table" || assetKind === "figure" ? assetKind : undefined };
  }
  if (kind === "block" && element.dataset.scvBlockId) return { kind: "block", unitId, blockId: element.dataset.scvBlockId };
  if (kind === "unit") return { kind: "unit", unitId };
  return null;
}

function viewerTargetForReference(reference: ResolvedCrossReference): ViewerTarget {
  if (!reference.asset) return { kind: "unit", unitId: reference.unit.id };
  return { kind: "asset", unitId: reference.unit.id, assetId: reference.asset.id, assetKind: reference.asset.kind };
}

function referenceLabel(reference: ResolvedCrossReference) {
  const document = reference.unit.document === "ntc2018" ? "NTC 2018" : "Circolare 7/2019";
  if (!reference.asset) return `${document} · § ${reference.unit.numbering}`;
  const prefix = reference.asset.kind === "formula" ? "Formula" : reference.asset.kind === "table" ? "Tab." : "Fig.";
  return `${document} · ${prefix} ${reference.asset.officialNumber}`;
}

async function writeTextClipboard(value: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }
  const input = document.createElement("textarea");
  input.value = value;
  input.style.cssText = "position:fixed;left:-10000px;top:-10000px";
  document.body.append(input);
  try {
    input.select();
    if (!document.execCommand("copy")) throw new Error("Copia non consentita.");
  } finally {
    input.remove();
  }
}

function copyableText(element: HTMLElement | null) {
  if (!element) return "";
  const clone = element.cloneNode(true) as HTMLElement;
  clone.querySelectorAll("button").forEach((button) => button.replaceWith(button.textContent ?? ""));
  return (clone.innerText || clone.textContent || "").replace(/\s+/gu, " ").trim();
}

function displayUnitNumber(unit: UnitSummary | CrossReferenceUnit) {
  return typeof unit.numbering === "string" ? unit.numbering : unit.numbering.official;
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

function relationTargets(resultId: string, relations: RelationEdge[]) {
  return relations
    .filter((edge) => edge.sourceUnitId === resultId)
    .sort((left, right) => left.targetUnitId.localeCompare(right.targetUnitId, "it", { numeric: true }));
}

function matchingPrimarySummary(summary: UnitSummary, lookup: DocumentLookup) {
  return lookup.unitByNumbering.get(baseNumbering(summary.numbering.official)) ?? null;
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
  return <section className={`scv-unit scv-unit-depth-${Math.min(depth(unit), 4)}`} data-scv-text-unit={unit.id} data-scv-citation-target="unit" data-scv-source-unit-id={unit.id} data-scv-chunk-path={record.summary.chunkPath}>
    {isChapter ? <h2 className="scv-chapter-heading"><span className="scv-chapter-badge"><span className="scv-chapter-badge-label">Capitolo</span><strong>{unit.numbering.official}.</strong></span><span className="scv-chapter-rule" aria-hidden="true" /><span className="scv-chapter-title">{unit.title}</span></h2> : <h2><span className="scv-unit-number">{unit.numbering.official}</span><span className="scv-unit-title">{unit.title}</span></h2>}
    <ScvBlockFlow blocks={unit.blocks.filter((block) => !isRepeatedUnitTitle(unit, block))} assets={chunk.assets} assetsBaseUrl={assetsBaseUrl} sourceUnitId={unit.id} sourceDocument={unit.document} />
    {visibleRelated.map(({ edge, unit: relatedUnit, chunk: relatedChunk }) => <section className="scv-related-unit" data-provenance="Circolare 7/2019" data-scv-related-unit={relatedUnit.id} data-scv-citation-target="unit" data-scv-source-unit-id={relatedUnit.id} key={edge.relationId}><header><h3><span className="scv-related-number">{relatedUnit.numbering.official}</span><span className="scv-related-title">{relatedUnit.title}</span></h3></header><ScvBlockFlow blocks={relatedUnit.blocks.filter((block) => !isRepeatedUnitTitle(relatedUnit, block))} assets={relatedChunk.assets} assetsBaseUrl={assetsBaseUrl} sourceUnitId={relatedUnit.id} sourceDocument={relatedUnit.document} /></section>)}
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

function HighlightedSnippet({ result }: { result: SearchResult }) {
  const parts: ReactNode[] = [];
  let offset = 0;
  for (const [start, end] of result.highlights) {
    const from = Math.max(offset, Math.min(result.snippet.length, start));
    const to = Math.max(from, Math.min(result.snippet.length, end));
    if (from > offset) parts.push(result.snippet.slice(offset, from));
    if (to > from) parts.push(<mark key={`${from}:${to}`}>{result.snippet.slice(from, to)}</mark>);
    offset = to;
  }
  if (offset < result.snippet.length) parts.push(result.snippet.slice(offset));
  return <>{parts}</>;
}

const NavigationPane = memo(function NavigationPane({ mode, onModeChange, hierarchy, activeLevelIds, indexReady, query, onQueryChange, searchReady, searchStatus, searchSource, searchDurationMs, searchResults, onSearchSubmit, onSearchResult, onSelectUnit, searchRef, settingsButtonRef, onOpenSettings }: {
  mode: ViewerMode;
  onModeChange: (mode: ViewerMode) => void;
  hierarchy: NavigationEntry[][];
  activeLevelIds: Array<string | null>;
  indexReady: boolean;
  query: string;
  onQueryChange: (query: string) => void;
  searchReady: boolean;
  searchStatus: "idle" | "loading" | "ready" | "error";
  searchSource: "exact" | "worker";
  searchDurationMs: number | null;
  searchResults: SearchResult[];
  onSearchSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onSearchResult: (result: SearchResult) => void;
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
        {searchReady && <div className="scv-search-results" role="listbox" aria-label="Risultati ricerca" aria-busy={searchStatus === "loading"} data-scv-search-source={searchSource} data-scv-search-duration-ms={searchDurationMs ?? undefined}>
          {searchStatus === "loading" ? <p className="scv-search-status">Ricerca in corso…</p> : searchStatus === "error" ? <p className="scv-search-status">Ricerca non disponibile.</p> : searchResults.length === 0 ? <p className="scv-search-status">Nessun risultato nella modalità corrente.</p> : searchResults.map((result) => <button type="button" role="option" aria-selected={false} className="scv-search-result" data-search-match={result.matchKind} key={result.id} onClick={() => onSearchResult(result)}><span>{result.document === "ntc2018" ? "NTC 2018" : "Circolare 7/2019"} · {result.numbering}</span><strong>{result.title}</strong><small><HighlightedSnippet result={result} /></small></button>)}
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

export function NormativeViewer({ defaultMode = "combined", dataBaseUrl = "/data/codes", assetsBaseUrl = "/assets", auxiliaryPanel, auxiliaryPanelLabel = "PDF ufficiale", auxiliaryPanelDefaultVisible = false, searchMaxResults = 12, className }: NormativeViewerProps) {
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
  const [crossReferenceIndex, setCrossReferenceIndex] = useState<CrossReferenceIndex | null>(null);
  const [referencePreview, setReferencePreview] = useState<ReferencePreviewData | null>(null);
  const [citationSelection, setCitationSelection] = useState<CitationSelection | null>(null);
  const [clipboardStatus, setClipboardStatus] = useState<string | null>(null);
  const [backlinksOpen, setBacklinksOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [loadError, setLoadError] = useState(false);
  const [contentLoadNotice, setContentLoadNotice] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [darkMode, setDarkMode] = useState<boolean | null>(null);
  const [auxiliaryVisible, setAuxiliaryVisible] = useState(Boolean(auxiliaryPanel && auxiliaryPanelDefaultVisible));
  const searchRef = useRef<HTMLInputElement>(null);
  const settingsButtonRef = useRef<HTMLButtonElement>(null);
  const dialogCloseRef = useRef<HTMLButtonElement>(null);
  const requestedIdRef = useRef<string | null>(null);
  const requestedTargetRef = useRef<ViewerTarget | null>(null);
  const scrollRequestRef = useRef<ViewerTarget | null>(null);
  const activeIdRef = useRef<string | null>(null);
  const manualTargetRef = useRef<{ id: string; expires: number } | null>(null);
  const navigationGenerationRef = useRef(0);
  const renderedChunkPathsRef = useRef<Set<string>>(new Set());
  const pendingScrollAnchorRef = useRef<{ id: string; top: number; generation: number } | null>(null);
  const initializedContextRef = useRef("");
  const historyNavigationRef = useRef(false);
  const crossReferencePromiseRef = useRef<Promise<CrossReferenceIndex> | null>(null);
  const relationsPromiseRef = useRef<Promise<RelationEdge[]> | null>(null);
  const clipboardTimerRef = useRef<number | null>(null);
  const textPaneRef = useRef<HTMLElement>(null);
  const documentId = documentForMode(mode);
  const documentIdRef = useRef(documentId);
  const hasAuxiliary = Boolean(auxiliaryPanel);
  const auxiliaryAvailable = hasAuxiliary && mode !== "combined";

  const reportChunkLoadFailure = useCallback((message = "Una parte del documento non è disponibile. Puoi continuare a consultare i contenuti già caricati.") => {
    if (renderedChunkPathsRef.current.size === 0) setLoadError(true);
    else setContentLoadNotice(message);
  }, []);

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
      relationsPromiseRef.current = null;
      setCrossReferenceIndex(null);
      crossReferencePromiseRef.current = null;
      setContentLoadNotice(null);
      const url = new URL(window.location.href);
      const requestedMode = url.searchParams.get("mode");
      if (modeOptions.some((option) => option.id === requestedMode)) setMode(requestedMode as ViewerMode);
      requestedTargetRef.current = targetFromUrl(url);
      requestedIdRef.current = requestedTargetRef.current?.unitId ?? null;
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
    }).catch(() => { if (!cancelled) setContentLoadNotice("L’indice della Circolare non è disponibile; la lettura NTC resta utilizzabile."); });
    return () => { cancelled = true; };
  }, [dataBaseUrl, indexes, manifest, mode]);

  const ensureRelations = useCallback(async () => {
    if (relationsLoaded) return relations;
    if (!manifest) return [];
    let pending = relationsPromiseRef.current;
    if (!pending) {
      pending = loadRelations(manifest, dataBaseUrl).then(({ relations: loadedRelations }) => {
        setRelations(loadedRelations);
        setRelationsLoaded(true);
        return loadedRelations;
      });
      relationsPromiseRef.current = pending;
      pending.catch(() => { if (relationsPromiseRef.current === pending) relationsPromiseRef.current = null; });
    }
    return pending;
  }, [dataBaseUrl, manifest, relations, relationsLoaded]);

  useEffect(() => {
    if (mode !== "combined" || relationsLoaded) return;
    void ensureRelations().catch(() => setContentLoadNotice("Le relazioni NTC–Circolare non sono temporaneamente disponibili."));
  }, [ensureRelations, mode, relationsLoaded]);

  const ensureCrossReferenceIndex = useCallback(async () => {
    if (crossReferenceIndex) return crossReferenceIndex;
    if (!manifest) throw new Error("Manifest non ancora disponibile.");
    let pending = crossReferencePromiseRef.current;
    if (!pending) {
      pending = loadCrossReferenceIndex(manifest, dataBaseUrl).then((loaded) => {
        setCrossReferenceIndex(loaded);
        return loaded;
      });
      crossReferencePromiseRef.current = pending;
      pending.catch(() => { if (crossReferencePromiseRef.current === pending) crossReferencePromiseRef.current = null; });
    }
    return pending;
  }, [crossReferenceIndex, dataBaseUrl, manifest]);

  const index = indexes.get(documentId) ?? null;
  const circIndex = indexes.get("circ2019") ?? null;
  const lookup = useMemo(() => index ? createDocumentLookup(index) : null, [index]);
  const circLookup = useMemo(() => circIndex ? createDocumentLookup(circIndex) : null, [circIndex]);
  const crossReferenceLookup = useMemo(() => crossReferenceIndex ? createCrossReferenceLookup(crossReferenceIndex) as CrossReferenceLookup : null, [crossReferenceIndex]);
  const search = useViewerSearch({ query, mode, manifest, dataBaseUrl, lookup, circLookup, maxResults: searchMaxResults });
  const combinedPlan = useMemo(() => buildCombinedPlan(mode === "combined" ? index : null, mode === "combined" ? circIndex : null, relations), [circIndex, index, mode, relations]);
  const primaryRenderedPaths = useMemo(() => new Set(lookup?.chunkPaths.filter((path) => renderedChunkPaths.has(path)) ?? []), [lookup, renderedChunkPaths]);

  const rememberChunk = useCallback(async (path: string) => {
    const chunk = await loadChunk(path, dataBaseUrl);
    setLoadedChunks((current) => current.get(path) === chunk ? current : new Map(current).set(path, chunk));
    return chunk;
  }, [dataBaseUrl]);

  const preserveActiveScrollAnchor = useCallback((generation: number) => {
    const root = textPaneRef.current;
    const anchorId = activeIdRef.current;
    const anchor = anchorId ? findTextUnit(root, anchorId) : null;
    if (!root || !anchor || !anchorId) return;
    pendingScrollAnchorRef.current = {
      id: anchorId,
      top: anchor.getBoundingClientRect().top - root.getBoundingClientRect().top,
      generation,
    };
  }, []);

  const mountPrimaryChunk = useCallback(async (path: string, replace: boolean, preserveAnchor = false, generation = navigationGenerationRef.current) => {
    const chunk = await rememberChunk(path);
    if (generation !== navigationGenerationRef.current || chunk.document !== documentIdRef.current) return;
    const current = renderedChunkPathsRef.current;
    if (!replace && current.has(path)) return;
    if (preserveAnchor) preserveActiveScrollAnchor(generation);
    const next = replace ? new Set([path]) : new Set(current).add(path);
    renderedChunkPathsRef.current = next;
    setRenderedChunkPaths(next);
  }, [preserveActiveScrollAnchor, rememberChunk]);

  const mountPrimaryWindow = useCallback(async (summary: UnitSummary, replace: boolean, generation: number) => {
    await mountPrimaryChunk(summary.chunkPath, replace, false, generation);
    if (!replace || generation !== navigationGenerationRef.current) return;
    if (!lookup) return;
    const window = navigationChunkWindow(lookup, summary.chunkPath);
    if (window.previous) void mountPrimaryChunk(window.previous, false, true, generation).catch(() => reportChunkLoadFailure("Il chunk precedente non è disponibile; il target resta consultabile."));
    if (window.next) void mountPrimaryChunk(window.next, false, false, generation).catch(() => reportChunkLoadFailure("Il chunk successivo non è disponibile; il target resta consultabile."));
  }, [lookup, mountPrimaryChunk, reportChunkLoadFailure]);

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
    const generation = navigationGenerationRef.current;
    Promise.all(missing.map((path) => loadChunk(path, dataBaseUrl))).then((chunks) => {
      if (cancelled) return;
      if (generation === navigationGenerationRef.current) preserveActiveScrollAnchor(generation);
      setLoadedChunks((current) => {
        const next = new Map(current);
        missing.forEach((path, position) => next.set(path, chunks[position]));
        return next;
      });
    }).catch(() => { if (!cancelled) setContentLoadNotice("Alcuni contenuti correlati della Circolare non sono disponibili."); });
    return () => { cancelled = true; };
  }, [dataBaseUrl, loadedChunks, mode, preserveActiveScrollAnchor, requiredCombinedCircPaths]);

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

  const revealSummary = useCallback(async (summary: UnitSummary, replace = false, generation = navigationGenerationRef.current) => {
    if (generation !== navigationGenerationRef.current) return;
    scrollRequestRef.current = requestedTargetRef.current?.unitId === summary.id ? requestedTargetRef.current : { kind: "unit", unitId: summary.id };
    if (summary.document === documentIdRef.current) {
      await mountPrimaryWindow(summary, replace, generation);
      return;
    }
    if (mode !== "combined" || !lookup) return;
    const explicitTarget = relationTargets(summary.id, relations)[0];
    if (explicitTarget) {
      const target = lookup.unitById.get(explicitTarget.targetUnitId);
      if (target) {
        setRequestedCircPaths((current) => replace ? new Set([summary.chunkPath]) : new Set(current).add(summary.chunkPath));
        await Promise.all([rememberChunk(summary.chunkPath), mountPrimaryWindow(target, replace, generation)]);
      }
      return;
    }
    const matchingPrimary = matchingPrimarySummary(summary, lookup);
    if (matchingPrimary) {
      scrollRequestRef.current = { kind: "unit", unitId: matchingPrimary.id };
      await mountPrimaryWindow(matchingPrimary, replace, generation);
      return;
    }
    const anchor = combinedPlan.primaryAnchorByFallbackId.get(summary.id);
    if (!anchor) return;
    setRequestedCircPaths((current) => replace ? new Set([summary.chunkPath]) : new Set(current).add(summary.chunkPath));
    await Promise.all([rememberChunk(summary.chunkPath), mountPrimaryWindow(anchor, replace, generation)]);
  }, [combinedPlan.primaryAnchorByFallbackId, lookup, mode, mountPrimaryWindow, relations, rememberChunk]);

  useEffect(() => {
    if (!index || !lookup) return;
    const contextKey = `${mode}:${modeRevision}:${index.document}`;
    if (initializedContextRef.current === contextKey) return;
    const requestedId = requestedIdRef.current;
    let initial = requestedId ? lookup.unitById.get(requestedId) ?? null : null;
    let revealInitial = initial;
    if (!initial && mode === "combined" && requestedId?.includes(":circ2019:")) {
      if (!circLookup || !relationsLoaded) return;
      const requestedCirc = circLookup.unitById.get(requestedId) ?? null;
      const explicitTarget = requestedCirc ? relationTargets(requestedCirc.id, relations)[0] : null;
      const explicitPrimary = explicitTarget ? lookup.unitById.get(explicitTarget.targetUnitId) ?? null : null;
      const matchingPrimary = requestedCirc ? matchingPrimarySummary(requestedCirc, lookup) : null;
      initial = explicitPrimary ?? matchingPrimary ?? requestedCirc;
      revealInitial = explicitPrimary || !matchingPrimary ? requestedCirc : matchingPrimary;
    }
    initial ??= initialUnitForIndex(index, requestedId);
    revealInitial ??= initial;
    if (!initial || !revealInitial) return;
    initializedContextRef.current = contextKey;
    requestedIdRef.current = initial.id;
    activeIdRef.current = initial.id;
    setActiveUnitId(initial.id);
    const requestedTarget = requestedTargetRef.current?.unitId === revealInitial.id ? requestedTargetRef.current : { kind: "unit" as const, unitId: initial.id };
    if (!historyNavigationRef.current) updateDeepLink(mode, requestedTarget, defaultMode);
    historyNavigationRef.current = false;
    const generation = ++navigationGenerationRef.current;
    pendingScrollAnchorRef.current = null;
    void revealSummary(revealInitial, primaryRenderedPaths.size === 0 || revealInitial.document !== documentId, generation).catch(() => reportChunkLoadFailure());
  }, [circLookup, defaultMode, documentId, index, lookup, mode, modeRevision, primaryRenderedPaths.size, relations, relationsLoaded, reportChunkLoadFailure, revealSummary]);

  useEffect(() => {
    if (!lookup || !activeUnitId) return;
    const active = lookup.unitById.get(activeUnitId);
    if (!active) return;
    const candidates = new Set<string>();
    const { previous, next } = adjacentChunkPaths(lookup, active.chunkPath);
    if (previous) candidates.add(previous);
    if (next) candidates.add(next);
    if (candidates.size === 0) return;
    return scheduleIdle(() => { for (const path of candidates) void loadChunk(path, dataBaseUrl).catch(() => undefined); });
  }, [activeUnitId, dataBaseUrl, lookup]);

  useLayoutEffect(() => {
    const root = textPaneRef.current;
    const pendingAnchor = pendingScrollAnchorRef.current;
    if (root && pendingAnchor && pendingAnchor.generation === navigationGenerationRef.current) {
      const anchor = findTextUnit(root, pendingAnchor.id);
      if (anchor) {
        const nextTop = anchor.getBoundingClientRect().top - root.getBoundingClientRect().top;
        root.scrollTop += nextTop - pendingAnchor.top;
      }
      pendingScrollAnchorRef.current = null;
    }
    const target = scrollRequestRef.current;
    if (!target || renderRecords.length === 0) return;
    if (!scrollViewerTarget(root, target)) {
      if (target.kind === "unit") return;
      const unitTarget = { kind: "unit" as const, unitId: target.unitId };
      if (!scrollViewerTarget(root, unitTarget)) return;
      scrollRequestRef.current = null;
      requestedTargetRef.current = unitTarget;
      updateDeepLink(mode, unitTarget, defaultMode);
      setContentLoadNotice("Il blocco o asset richiesto non esiste; è stata aperta l’unità normativa corrispondente.");
      return;
    }
    scrollRequestRef.current = null;
    manualTargetRef.current = { id: target.unitId, expires: performance.now() + 500 };
  }, [defaultMode, mode, relatedByTarget, renderRecords]);

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
    if (position <= 1 && adjacent.previous) void mountPrimaryChunk(adjacent.previous, false, true).catch(() => reportChunkLoadFailure("Il chunk precedente non è disponibile; il resto del documento rimane consultabile."));
    if (position >= chunkUnits.length - 2 && adjacent.next) void mountPrimaryChunk(adjacent.next, false).catch(() => reportChunkLoadFailure("Il chunk successivo non è disponibile; il resto del documento rimane consultabile."));
  }, [mountPrimaryChunk, reportChunkLoadFailure]);

  const onVisibleUnit = useCallback((nextId: string) => {
    const guard = manualTargetRef.current;
    if (guard && performance.now() < guard.expires && guard.id !== nextId) return;
    if (guard?.id === nextId || (guard && performance.now() >= guard.expires)) manualTargetRef.current = null;
    if (nextId !== activeIdRef.current) {
      activeIdRef.current = nextId;
      requestedIdRef.current = nextId;
      requestedTargetRef.current = { kind: "unit", unitId: nextId };
      setActiveUnitId(nextId);
      updateDeepLink(navigationRef.current.mode, requestedTargetRef.current, defaultMode);
    }
    loadAdjacentAtUnit(nextId);
  }, [defaultMode, loadAdjacentAtUnit]);

  useVisibleUnitObserver(textPaneRef, renderRecords, onVisibleUnit);

  const selectUnit = useCallback((unit: UnitSummary) => {
    const generation = ++navigationGenerationRef.current;
    pendingScrollAnchorRef.current = null;
    setContentLoadNotice(null);
    requestedIdRef.current = unit.id;
    requestedTargetRef.current = { kind: "unit", unitId: unit.id };
    manualTargetRef.current = { id: unit.id, expires: performance.now() + 500 };
    const present = scrollTextUnit(textPaneRef.current, unit.id);
    activeIdRef.current = unit.id;
    setActiveUnitId(unit.id);
    updateDeepLink(navigationRef.current.mode, requestedTargetRef.current, defaultMode);
    if (present) return;
    const currentLookup = navigationRef.current.lookup;
    const nearMountedWindow = currentLookup ? isChunkNearRenderedWindow(currentLookup, unit.chunkPath, primaryRenderedPaths) : false;
    void revealSummary(unit, !nearMountedWindow, generation).catch(() => reportChunkLoadFailure());
  }, [defaultMode, primaryRenderedPaths, reportChunkLoadFailure, revealSummary]);

  const navigateViewerTarget = useCallback(async (target: ViewerTarget, action: "push" | "replace" | "none" = "push", forcedMode?: ViewerMode) => {
    const generation = ++navigationGenerationRef.current;
    pendingScrollAnchorRef.current = null;
    setContentLoadNotice(null);
    const targetDocument = documentFromUnitId(target.unitId);
    const nextMode = forcedMode ?? (mode === "combined" || documentForMode(mode) === targetDocument ? mode : targetDocument === "ntc2018" ? "ntc" : "circ");
    requestedIdRef.current = target.unitId;
    requestedTargetRef.current = target;
    scrollRequestRef.current = target;
    manualTargetRef.current = { id: target.unitId, expires: performance.now() + 700 };
    if (action !== "none") updateDeepLink(nextMode, target, defaultMode, action);
    if (nextMode !== mode) {
      historyNavigationRef.current = true;
      initializedContextRef.current = "";
      setRequestedCircPaths(new Set());
      setModeRevision((revision) => revision + 1);
      setMode(nextMode);
      return;
    }
    if (targetDocument === documentIdRef.current) {
      activeIdRef.current = target.unitId;
      setActiveUnitId(target.unitId);
    }
    if (scrollViewerTarget(textPaneRef.current, target)) return;
    if (!manifest) return;
    let targetIndex = indexes.get(targetDocument);
    if (!targetIndex) {
      targetIndex = await loadDocumentIndex(manifest, targetDocument, dataBaseUrl);
      if (generation !== navigationGenerationRef.current) return;
      setIndexes((current) => current.has(targetDocument) ? current : new Map(current).set(targetDocument, targetIndex!));
    }
    const summary = targetIndex.units.find((unit) => unit.id === target.unitId);
    if (!summary) {
      const fallbackId = activeIdRef.current;
      if (fallbackId) updateDeepLink(mode, { kind: "unit", unitId: fallbackId }, defaultMode);
      setContentLoadNotice("Il target richiesto non esiste nel documento corrente.");
      return;
    }
    let activeId = summary.id;
    if (mode === "combined" && summary.document === "circ2019") {
      const explicit = relationTargets(summary.id, relations)[0];
      activeId = explicit?.targetUnitId ?? summary.id;
    }
    activeIdRef.current = activeId;
    setActiveUnitId(activeId);
    const currentLookup = navigationRef.current.lookup;
    const nearMountedWindow = summary.document === documentIdRef.current && currentLookup ? isChunkNearRenderedWindow(currentLookup, summary.chunkPath, primaryRenderedPaths) : false;
    if (generation !== navigationGenerationRef.current) return;
    await revealSummary(summary, summary.document === documentIdRef.current && !nearMountedWindow, generation);
  }, [dataBaseUrl, defaultMode, indexes, manifest, mode, primaryRenderedPaths, relations, revealSummary]);

  useEffect(() => {
    const onPopState = () => {
      const url = new URL(window.location.href);
      const target = targetFromUrl(url);
      if (!target) return;
      const requestedMode = url.searchParams.get("mode");
      const nextMode = modeOptions.some((option) => option.id === requestedMode) ? requestedMode as ViewerMode : defaultMode;
      historyNavigationRef.current = true;
      void navigateViewerTarget(target, "none", nextMode).catch(() => reportChunkLoadFailure());
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [defaultMode, navigateViewerTarget, reportChunkLoadFailure]);

  const resolveReferenceElement = useCallback(async (element: HTMLElement) => {
    const descriptor = referenceDescriptor(element);
    if (!descriptor) return null;
    const loaded = await ensureCrossReferenceIndex();
    const referenceLookup = crossReferenceLookup ?? createCrossReferenceLookup(loaded) as CrossReferenceLookup;
    return resolveCrossReference(referenceLookup, descriptor, descriptor.sourceDocument) as ResolvedCrossReference | null;
  }, [crossReferenceLookup, ensureCrossReferenceIndex]);

  const showReferencePreview = useCallback((element: HTMLElement) => {
    const bounds = element.getBoundingClientRect();
    const left = Math.max(12, Math.min(window.innerWidth - 332, bounds.left));
    const top = Math.min(window.innerHeight - 150, bounds.bottom + 7);
    setReferencePreview({ label: element.textContent ?? "Riferimento", title: "", snippet: "", left, top, loading: true });
    void resolveReferenceElement(element).then((reference) => {
      if (!reference) {
        element.dataset.scvReferenceResolved = "false";
        setReferencePreview({ label: element.textContent ?? "Riferimento", title: "Target non disponibile", snippet: "Il riferimento non è stato reso cliccabile perché non è risolto dall’indice derivato.", left, top });
        return;
      }
      element.dataset.scvReferenceResolved = "true";
      setReferencePreview({ label: referenceLabel(reference), title: reference.asset?.title || reference.unit.title, snippet: reference.asset?.snippet || reference.unit.snippet, left, top });
    }).catch(() => setReferencePreview(null));
  }, [resolveReferenceElement]);

  const activateReference = useCallback((element: HTMLElement) => {
    void resolveReferenceElement(element).then((reference) => {
      if (!reference) return;
      setReferencePreview(null);
      return navigateViewerTarget(viewerTargetForReference(reference), "push");
    }).catch(() => setReferencePreview(null));
  }, [navigateViewerTarget, resolveReferenceElement]);

  const handleDocumentClick = useCallback((event: React.MouseEvent<HTMLElement>) => {
    const element = event.target instanceof Element ? event.target.closest<HTMLElement>(".scv-cross-reference") : null;
    if (element) {
      activateReference(element);
      return;
    }
    const citationElement = event.target instanceof Element ? event.target.closest<HTMLElement>("[data-scv-citation-target]") : null;
    if (citationElement) setCitationSelection(citationSelectionFromElement(citationElement));
  }, [activateReference]);

  const handleDocumentPointerOver = useCallback((event: React.PointerEvent<HTMLElement>) => {
    const element = event.target instanceof Element ? event.target.closest<HTMLElement>(".scv-cross-reference") : null;
    if (element && !element.contains(event.relatedTarget as Node | null)) showReferencePreview(element);
  }, [showReferencePreview]);

  const handleDocumentPointerOut = useCallback((event: React.PointerEvent<HTMLElement>) => {
    const element = event.target instanceof Element ? event.target.closest<HTMLElement>(".scv-cross-reference") : null;
    if (element && !element.contains(event.relatedTarget as Node | null) && document.activeElement !== element) setReferencePreview(null);
  }, []);

  const handleDocumentFocus = useCallback((event: React.FocusEvent<HTMLElement>) => {
    const element = event.target instanceof Element ? event.target.closest<HTMLElement>(".scv-cross-reference") : null;
    if (element) showReferencePreview(element);
  }, [showReferencePreview]);

  const handleDocumentBlur = useCallback((event: React.FocusEvent<HTMLElement>) => {
    if (event.target instanceof Element && event.target.matches(".scv-cross-reference")) setReferencePreview(null);
  }, []);

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
  const summaryById = useMemo(() => new Map([...indexes.values()].flatMap((documentIndex) => documentIndex.units).map((summary) => [summary.id, summary])), [indexes]);
  const citationTarget = useMemo<ViewerTarget | null>(() => citationSelection ?? (activeUnitId ? { kind: "unit", unitId: activeUnitId } : null), [activeUnitId, citationSelection]);
  const loadedCitationAsset = useMemo(() => {
    if (citationTarget?.kind !== "asset") return null;
    for (const loaded of loadedChunks.values()) {
      const asset = loaded.assets.formulas[citationTarget.assetId] ?? loaded.assets.tables[citationTarget.assetId] ?? loaded.assets.figures[citationTarget.assetId];
      if (asset) return asset;
    }
    return null;
  }, [citationTarget, loadedChunks]);
  const citationUnit = citationTarget ? summaryById.get(citationTarget.unitId) ?? crossReferenceLookup?.unitById.get(citationTarget.unitId) ?? null : null;
  const citationAsset = citationTarget?.kind === "asset" ? crossReferenceLookup?.assetById.get(citationTarget.assetId) ?? null : null;
  const loadedCitationAssetNumber = loadedCitationAsset && "officialNumber" in loadedCitationAsset ? loadedCitationAsset.officialNumber : null;
  const citationAssetLabel = citationTarget?.kind === "asset"
    ? `${citationTarget.assetKind === "formula" ? "Formula" : citationTarget.assetKind === "table" ? "Tab." : "Fig."} ${citationAsset?.officialNumber ?? loadedCitationAssetNumber ?? citationTarget.assetId}`
    : citationTarget?.kind === "block" ? `blocco ${citationTarget.blockId}` : null;
  const citationContextLabel = citationUnit ? `${citationUnit.document === "ntc2018" ? "NTC 2018" : "Circolare 7/2019"} · ${citationAssetLabel ?? `§ ${displayUnitNumber(citationUnit)}`}` : "Contenuto corrente";
  const citationLatex = citationTarget?.kind === "asset" && citationTarget.assetKind === "formula" && loadedCitationAsset && "latex" in loadedCitationAsset ? loadedCitationAsset.latex : null;
  const textualBacklinkRecords = activeUnitId && crossReferenceLookup ? crossReferenceLookup.backlinksByTarget.get(`unit:${activeUnitId}`) ?? [] : [];
  const textualBacklinks = textualBacklinkRecords.flatMap((backlink) => {
    const source = summaryById.get(backlink.sourceUnitId) ?? crossReferenceLookup?.unitById.get(backlink.sourceUnitId);
    return source ? [{ backlink, document: source.document, numbering: displayUnitNumber(source), title: source.title }] : [];
  });
  const editorialBacklinkRecords = activeUnitId ? relations.filter((edge) => edge.sourceUnitId === activeUnitId || edge.targetUnitId === activeUnitId) : [];
  const editorialBacklinks = editorialBacklinkRecords.flatMap((edge) => {
    const otherId = edge.sourceUnitId === activeUnitId ? edge.targetUnitId : edge.sourceUnitId;
    const other = summaryById.get(otherId) ?? crossReferenceLookup?.unitById.get(otherId);
    return other ? [{ edge, label: `${other.document === "ntc2018" ? "NTC 2018" : "Circolare 7/2019"} ${displayUnitNumber(other)}`, title: other.title }] : [];
  });

  const reportClipboardStatus = useCallback((message: string) => {
    setClipboardStatus(message);
    if (clipboardTimerRef.current !== null) window.clearTimeout(clipboardTimerRef.current);
    clipboardTimerRef.current = window.setTimeout(() => setClipboardStatus(null), 1700);
  }, []);

  useEffect(() => () => {
    if (clipboardTimerRef.current !== null) window.clearTimeout(clipboardTimerRef.current);
  }, []);

  const copyCitationValue = useCallback((kind: "text" | "link" | "citation" | "latex") => {
    if (!citationTarget || !citationUnit) return;
    const permalink = urlForViewerTarget(window.location.href, mode, defaultMode, citationTarget).href;
    const documentLabel = citationUnit.document === "ntc2018" ? "NTC 2018" : "Circolare 7/2019";
    const unitNumber = displayUnitNumber(citationUnit);
    const element = findViewerTarget(textPaneRef.current, citationTarget);
    const value = kind === "text" ? copyableText(element)
      : kind === "link" ? permalink
      : kind === "latex" ? citationLatex ?? ""
      : citationForTarget({ documentLabel, unitNumber, targetLabel: citationAssetLabel, permalink });
    if (!value) return;
    void writeTextClipboard(value).then(() => reportClipboardStatus("Copiato negli appunti")).catch(() => reportClipboardStatus("Copia non disponibile"));
  }, [citationAssetLabel, citationLatex, citationTarget, citationUnit, defaultMode, mode, reportClipboardStatus]);

  const toggleBacklinks = useCallback(() => {
    const opening = !backlinksOpen;
    setBacklinksOpen(opening);
    if (opening) void Promise.all([ensureCrossReferenceIndex(), ensureRelations()]).catch(() => setBacklinksOpen(false));
  }, [backlinksOpen, ensureCrossReferenceIndex, ensureRelations]);

  const selectTextualBacklink = useCallback((backlink: TextualBacklink) => {
    setBacklinksOpen(false);
    void navigateViewerTarget({ kind: "block", unitId: backlink.sourceUnitId, blockId: backlink.sourceBlockId }, "push").catch(() => reportChunkLoadFailure());
  }, [navigateViewerTarget, reportChunkLoadFailure]);

  const selectEditorialBacklink = useCallback((edge: RelationEdge) => {
    if (!activeUnitId) return;
    setBacklinksOpen(false);
    const unitId = edge.sourceUnitId === activeUnitId ? edge.targetUnitId : edge.sourceUnitId;
    void navigateViewerTarget({ kind: "unit", unitId }, "push").catch(() => reportChunkLoadFailure());
  }, [activeUnitId, navigateViewerTarget, reportChunkLoadFailure]);
  const changeMode = useCallback((nextMode: ViewerMode, preferredUnitId: string | null = null) => {
    if (nextMode === mode) return;
    navigationGenerationRef.current += 1;
    pendingScrollAnchorRef.current = null;
    setContentLoadNotice(null);
    const keepCurrent = activeSummary && (nextMode === "combined" || activeSummary.document === documentForMode(nextMode));
    requestedIdRef.current = preferredUnitId ?? (keepCurrent ? activeSummary?.id ?? null : null);
    requestedTargetRef.current = requestedIdRef.current ? { kind: "unit", unitId: requestedIdRef.current } : null;
    initializedContextRef.current = "";
    setRequestedCircPaths(new Set());
    setCitationSelection(null);
    setBacklinksOpen(false);
    setReferencePreview(null);
    setModeRevision((revision) => revision + 1);
    setMode(nextMode);
    setSettingsOpen(false);
  }, [activeSummary, mode]);

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

  const selectSearchResult = useCallback((result: SearchResult) => {
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
    if (search.results[0]) selectSearchResult(search.results[0]);
  }, [search.results, selectSearchResult]);

  const primaryPathPositions = lookup?.chunkPaths.flatMap((path, position) => primaryRenderedPaths.has(path) ? [position] : []) ?? [];
  const hasPrevious = primaryPathPositions.length > 0 && Math.min(...primaryPathPositions) > 0;
  const hasNext = Boolean(lookup && primaryPathPositions.length > 0 && Math.max(...primaryPathPositions) < lookup.chunkPaths.length - 1);
  const documentLoading = !index || documentRecords.length === 0;
  const renderAuxiliary: ReactNode = !manifest || !auxiliaryAvailable ? null : typeof auxiliaryPanel === "function" ? auxiliaryPanel({ mode, documentId, manifest, chunk, pageBounds }) : auxiliaryPanel;

  if (loadError) return <main className="scv-fatal"><strong>Il corpus non è disponibile.</strong><span>Rigenera gli artefatti del viewer e ricarica la pagina.</span></main>;

  return <div className={`scv-root ${darkMode ? "scv-dark" : ""} ${auxiliaryVisible && auxiliaryAvailable ? "scv-has-auxiliary" : ""} ${className ?? ""}`} data-scv-mounted-chunks={primaryRenderedPaths.size} data-scv-loaded-related-chunks={mode === "combined" ? requiredCombinedCircPaths.size : 0} data-scv-search-index-requested={search.indexRequested} data-scv-cross-reference-index-requested={Boolean(crossReferenceIndex)} data-scv-search-error={search.errorMessage}>
    <NavigationPane mode={mode} onModeChange={changeMode} hierarchy={hierarchy} activeLevelIds={activeLevelIds} indexReady={Boolean(index)} query={query} onQueryChange={setQuery} searchReady={search.queryReady} searchStatus={search.status} searchSource={search.source} searchDurationMs={search.durationMs} searchResults={search.results} onSearchSubmit={submitSearch} onSearchResult={selectSearchResult} onSelectUnit={selectUnit} searchRef={searchRef} settingsButtonRef={settingsButtonRef} onOpenSettings={() => setSettingsOpen(true)} />
    <div className="scv-text-pane-shell">
      {citationTarget && <CitationActions contextLabel={citationContextLabel} formula={Boolean(citationLatex)} status={clipboardStatus} onCopyText={() => copyCitationValue("text")} onCopyLink={() => copyCitationValue("link")} onCopyCitation={() => copyCitationValue("citation")} onCopyLatex={() => copyCitationValue("latex")} backlinksOpen={backlinksOpen} backlinkCount={crossReferenceLookup ? textualBacklinks.length + editorialBacklinks.length : null} onToggleBacklinks={toggleBacklinks} />}
      {backlinksOpen && <BacklinkPanel loading={!crossReferenceLookup || !relationsLoaded} textual={textualBacklinks} editorial={editorialBacklinks} onNavigateTextual={selectTextualBacklink} onNavigateEditorial={selectEditorialBacklink} onClose={() => setBacklinksOpen(false)} />}
      {contentLoadNotice && <p className="scv-content-notice" role="status">{contentLoadNotice}</p>}
      <article ref={textPaneRef} className="scv-text-pane" aria-label="Corpus JSON" onClick={handleDocumentClick} onPointerOver={handleDocumentPointerOver} onPointerOut={handleDocumentPointerOut} onFocus={handleDocumentFocus} onBlur={handleDocumentBlur}>
        {documentLoading || !index || !lookup ? <LoadingPanel label="Caricamento del documento…" /> : <DocumentContent records={renderRecords} relatedByTarget={relatedByTarget} mode={mode} assetsBaseUrl={assetsBaseUrl} documentLabel={documentId === "ntc2018" ? "NTC 2018" : "Circolare 7/2019"} documentUnits={index.units.length} documentChunks={lookup.chunkPaths.length} hasPrevious={hasPrevious} hasNext={hasNext} />}
      </article>
      <DocumentScrollbar rootRef={textPaneRef} markers={scrollbarMarkers} activeId={activeUnitId} onSelect={selectScrollMarker} />
    </div>
    <ReferencePreview preview={referencePreview} />
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
