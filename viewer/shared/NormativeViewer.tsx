"use client";

import { memo, useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
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
  viewerDocumentSummary,
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
import { AlignedLabelList, BlockContent, groupAlignedLabelBlocks, hasAlphabeticListMarker, hasAlphaRatioListLayout, hasInferredAlphaRatioListMarker, hasLeadingEmphasisLabel, hasLeadingMath, hasNoListMarker, hasOfficialListMarker, hasSimpleDashMarker, hasTrailingMath, hasTrailingStrong, indentLevelClass, isRepeatedUnitTitle, listLevelClass, listMarkerClass, renderInlineSegments } from "./CorpusContent";
import { useViewerSearch } from "./searchClient";
import { createCrossReferenceLookup, resolveCrossReference } from "./crossReferences.js";
import { ReferencePreview, type ReferencePreviewData } from "./ReferenceTools";
import { targetFromUrl, urlForViewerTarget, type ViewerTarget } from "./permalinks";
import { isChunkNearRenderedWindow, navigationChunkWindow, progressiveChunkTargetsForVisibleUnit } from "./chunkNavigation.js";
import { mobileIndexExpansion } from "./indexExpansion.js";
import { buildGlobalScrubberEntries, createGlobalScrubberDragSession, globalScrubberAnnotationRatios, globalScrubberKeyboardIndex, globalScrubberRatioForId, resolveGlobalScrubberActiveId } from "./globalScrubber.js";
import { AnnotationContextMenu, AnnotationEditor, AnnotationMarginMarker, type AnnotationEditorState, type AnnotationMenuState, type AnnotationPanelController, type AnnotationPosition, type AnnotationTargetMetadata } from "./annotations/AnnotationUi";
import { annotationPositionRanks, annotationsForTarget, annotationTargetFromElement, automaticAnnotationLabel, clusterAnnotationMarkers, createLongPressSession, type AnnotationMarker } from "./annotations/annotationTargets";
import { annotationTargetKey } from "./annotations/schema";
import type { AnnotationStore, UserAnnotation } from "./annotations/types";
import { BookmarkIcon, CloseIcon, DashboardIcon, HamburgerIcon, HistoryBackIcon, HistoryForwardIcon, MoonIcon, SearchIcon, StickyNoteIcon, SunIcon } from "./UiIcons.js";

const modeOptions: Array<{ id: ViewerMode; label: string }> = [
  { id: "ntc", label: "Solo NTC 2018" },
  { id: "circ", label: "Solo Circolare 7/2019" },
  { id: "combined", label: "NTC 2018 + Circolare 7/2019" },
];
const ModeSegmentedControl = memo(function ModeSegmentedControl({ mode, onChange }: { mode: ViewerMode; onChange: (nextMode: ViewerMode) => void }) {
  const tooltipBaseId = useId();
  return <div className="scv-mode-switch" role="group" aria-label="Modalità documento">
    {modeOptions.map((option) => {
      const tooltipId = `${tooltipBaseId}-${option.id}`;
      return <button type="button" key={option.id} className={`scv-mode-button ${mode === option.id ? "active" : ""}`} onClick={() => onChange(option.id)} aria-label={option.label} aria-describedby={tooltipId} aria-pressed={mode === option.id}>
        <span className="scv-mode-label">{option.id === "ntc" ? <>NTC<br />2018</> : option.id === "circ" ? <>CIRC.<br />2019</> : <>NTC<br />CIRC.</>}</span>
        <span id={tooltipId} className="scv-control-tooltip scv-mode-tooltip" role="tooltip">{option.label}</span>
      </button>;
    })}
  </div>;
});

function scvBlockClass(block: CorpusUnit["blocks"][number], sourceUnitId?: string) {
  const catenaryLabel = sourceUnitId?.endsWith(":5.2.2.9.1") && block.kind === "list-item" && block.listMarker === "none";
  const alphaRatioLayout = hasAlphaRatioListLayout(block, sourceUnitId);
  const inferredAlphaRatioMarker = hasInferredAlphaRatioListMarker(block, sourceUnitId);
  const officialMarker = hasOfficialListMarker(block) || inferredAlphaRatioMarker;
  const levelClass = listLevelClass(block) || (alphaRatioLayout ? "list-item-level-1" : "");
  return `scv-block scv-block-${block.kind} ${officialMarker ? "list-item-with-official-marker" : ""} ${hasAlphabeticListMarker(block) ? "list-item-with-alphabetic-marker" : ""} ${hasSimpleDashMarker(block) && !inferredAlphaRatioMarker ? "list-item-with-simple-dash" : ""} ${hasNoListMarker(block) ? "list-item-without-marker" : ""} ${listMarkerClass(block)} ${levelClass} ${indentLevelClass(block)} ${hasLeadingMath(block) ? "list-item-with-leading-symbol" : ""} ${hasLeadingEmphasisLabel(block) ? "block-with-leading-label" : ""} ${hasTrailingStrong(block) ? "list-item-with-trailing-siglum" : ""} ${hasTrailingMath(block) ? "list-item-with-trailing-symbol" : ""} ${catenaryLabel ? "list-item-with-catenary-label" : ""} ${alphaRatioLayout ? "list-item-with-alpha-ratio" : ""}`;
}

function blockAssetKind(block: CorpusUnit["blocks"][number], assets: CorpusChunk["assets"]) {
  if (!block.assetId) return undefined;
  if (assets.formulas[block.assetId]) return "formula";
  if (assets.tables[block.assetId]) return "table";
  if (assets.figures[block.assetId]) return "figure";
  return undefined;
}

const ScvBlockFlow = memo(function ScvBlockFlow({ blocks, assets, assetsBaseUrl, sourceUnitId, sourceDocument, notesByTarget, onOpenAnnotation }: { blocks: CorpusUnit["blocks"]; assets: CorpusChunk["assets"]; assetsBaseUrl: string; sourceUnitId: string; sourceDocument: DocumentId; notesByTarget: Map<string, UserAnnotation[]>; onOpenAnnotation: (annotation: UserAnnotation, position?: AnnotationPosition) => void }) {
  return <div className="scv-unit-blocks">{groupAlignedLabelBlocks(blocks).map((group) => group.kind === "label-list"
    ? <AlignedLabelList blocks={group.blocks} assets={assets} assetsBaseUrl={assetsBaseUrl} sourceUnitId={sourceUnitId} sourceDocument={sourceDocument} renderAccessory={(block) => <AnnotationMarginMarker notes={notesByTarget.get(annotationTargetKey({ kind: "block", unitId: sourceUnitId, blockId: block.blockId })) ?? []} onOpen={onOpenAnnotation} />} key={group.blocks[0].blockId} />
    : <div tabIndex={0} className={scvBlockClass(group.block, sourceUnitId)} data-scv-citation-target={group.block.assetId ? "asset" : "block"} data-scv-source-unit-id={sourceUnitId} data-scv-block-id={group.block.blockId} data-scv-asset-id={group.block.assetId} data-scv-asset-kind={blockAssetKind(group.block, assets)} key={group.block.blockId}><BlockContent block={group.block} assets={assets} assetsBaseUrl={assetsBaseUrl} sourceUnitId={sourceUnitId} sourceDocument={sourceDocument} /><AnnotationMarginMarker notes={notesByTarget.get(annotationTargetKey(group.block.assetId ? { kind: "asset", unitId: sourceUnitId, assetId: group.block.assetId, assetKind: blockAssetKind(group.block, assets) } : { kind: "block", unitId: sourceUnitId, blockId: group.block.blockId })) ?? []} onOpen={onOpenAnnotation} /></div>)}</div>;
});

export interface AuxiliaryPanelContext {
  mode: ViewerMode;
  documentId: DocumentId;
  manifest: CorpusManifest;
  chunk: CorpusChunk | null;
  pageBounds: { from: number; to: number };
  /** Optional additions preserve consumers that construct the original PDF context. */
  currentUnit?: { documentId: DocumentId; unitId: string; numbering: string } | null;
  selectedTarget?: ViewerTarget | null;
  navigateTo?: (target: ViewerTarget) => Promise<void>;
  hrefForTarget?: (target: ViewerTarget) => string;
  close?: () => void;
  annotations?: AnnotationPanelController;
}

export type AuxiliaryPanel = ReactNode | ((context: AuxiliaryPanelContext) => ReactNode);

function AuxiliaryContent({ panel, context }: { panel: AuxiliaryPanel; context: AuxiliaryPanelContext }) {
  return typeof panel === "function" ? panel(context) : panel;
}

export interface NormativeViewerProps {
  defaultMode?: ViewerMode;
  dataBaseUrl?: string;
  assetsBaseUrl?: string;
  auxiliaryPanel?: AuxiliaryPanel;
  auxiliaryPanelLabel?: string;
  auxiliaryPanelButtonText?: string;
  auxiliaryPanelDefaultVisible?: boolean;
  auxiliaryPanelDesktopDefaultVisible?: boolean;
  /** Defaults to the legacy single-document modes. */
  auxiliaryPanelModes?: readonly ViewerMode[];
  /** Opt in to retaining transient tool state while hidden. Default preserves lazy mounting. */
  auxiliaryPanelKeepMounted?: boolean;
  searchMaxResults?: number;
  className?: string;
  annotationStore?: AnnotationStore;
}

interface RelatedRecord { edge: RelationEdge; unit: CorpusUnit; chunk: CorpusChunk; }
interface UnitRecord { summary: UnitSummary; unit: CorpusUnit; chunk: CorpusChunk; }
interface NavigationEntry {
  summary: UnitSummary;
  source: DocumentId;
  baseNumber: string;
  displayNumber: string;
  level: number;
  parentId: string | null;
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
interface PermalinkNotice {
  message: string;
  left: number;
  top: number;
  placement: "above" | "below";
  status: "success" | "error";
}
interface ViewerHistoryEntry { session: string; index: number; scrollTop: number; }

function viewerHistoryEntry(state: unknown): ViewerHistoryEntry | null {
  if (!state || typeof state !== "object" || !("scvNavigation" in state)) return null;
  const entry = state.scvNavigation;
  return entry && typeof entry === "object" && "session" in entry && "index" in entry && "scrollTop" in entry
    && typeof entry.session === "string" && typeof entry.index === "number" && typeof entry.scrollTop === "number" ? entry as ViewerHistoryEntry : null;
}

function withViewerHistoryEntry(state: unknown, entry: ViewerHistoryEntry) {
  return { ...(state && typeof state === "object" ? state : {}), scvNavigation: entry };
}

const chunkUnitMaps = new WeakMap<CorpusChunk, Map<string, CorpusUnit>>();
const emptyRelatedRecords: RelatedRecord[] = [];
const emptyNavigationEntries: NavigationEntry[] = [];

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
  const rootTop = root.getBoundingClientRect().top;
  const overlays = Array.from(root.parentElement?.querySelectorAll<HTMLElement>(".scv-mobile-search, .scv-mobile-context") ?? [])
    .filter((element) => {
      const style = window.getComputedStyle(element);
      return style.display !== "none" && style.visibility !== "hidden" && element.getClientRects().length > 0;
    });
  const offset = Math.max(18, ...overlays.map((element) => element.getBoundingClientRect().bottom - rootTop + 10));
  root.scrollTo({ top: Math.max(0, top - offset), behavior: "auto" });
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

function updateDeepLink(mode: ViewerMode, target: ViewerTarget, defaultMode: ViewerMode, action: "push" | "replace" = "replace", state = window.history.state) {
  const url = urlForViewerTarget(window.location.href, mode, defaultMode, target);
  window.history[`${action}State`](state, "", url);
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

function viewerTargetForSearchResult(result: SearchResult): ViewerTarget {
  if (result.assetId) return { kind: "asset", unitId: result.id, assetId: result.assetId, assetKind: result.assetKind };
  if (result.blockId) return { kind: "block", unitId: result.id, blockId: result.blockId };
  return { kind: "unit", unitId: result.id };
}

function sameViewerTarget(left: ViewerTarget | null, right: ViewerTarget) {
  if (!left || left.kind !== right.kind || left.unitId !== right.unitId) return false;
  if (left.kind === "block" && right.kind === "block") return left.blockId === right.blockId;
  if (left.kind === "asset" && right.kind === "asset") return left.assetId === right.assetId;
  return left.kind === "unit" && right.kind === "unit";
}

function referenceLabel(reference: ResolvedCrossReference) {
  const document = reference.unit.document === "ntc2018" ? "NTC 2018" : "Circolare 7/2019";
  if (!reference.asset) return `${document} · § ${reference.unit.numbering}`;
  const prefix = reference.asset.kind === "formula" ? "Formula" : reference.asset.kind === "table" ? "Tab." : "Fig.";
  return `${document} · ${prefix} ${reference.asset.officialNumber}`;
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
  const relatedSourceIds = new Set(relations.map((edge) => edge.sourceUnitId));
  const fallbackSummaries = circIndex.units.filter((summary) => !relatedSourceIds.has(summary.id));
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

function navigationEntry(summary: UnitSummary, source = summary.document, parentId = summary.hierarchy.parentId): NavigationEntry {
  const rawNumber = summary.numbering.official;
  const displayNumber = source === "circ2019" && !/^C/iu.test(rawNumber) ? `C${rawNumber}` : rawNumber;
  const baseNumber = baseNumbering(displayNumber);
  const level = Math.max(0, baseNumber.split(".").length - 1);
  return { summary, source, baseNumber, displayNumber, level, parentId, parentBaseNumber: parentNumbering(baseNumber) };
}

function sameRelatedRecords(left: RelatedRecord[], right: RelatedRecord[]) {
  return left.length === right.length && left.every((record, index) => record.edge.relationId === right[index]?.edge.relationId && record.unit === right[index]?.unit);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

function unitTitleContent(unit: CorpusUnit) {
  const titleBlock = unit.blocks.find((block) => block.blockId === unit.titleBlockId);
  const inline = titleBlock?.text?.inline;
  if (!inline) return unit.title;
  const officialNumber = unit.numbering.official;
  const prefix = new RegExp(`^${escapeRegExp(officialNumber)}\\s*`, "u");
  const titleInline = inline.map((segment, index) => index === 0 && typeof segment.value === "string" ? { ...segment, value: segment.value.replace(prefix, "") } : segment);
  return renderInlineSegments(titleInline);
}

const MemoizedUnit = memo(function MemoizedUnit({ record, mode, relatedRecords, assetsBaseUrl, notesByTarget, onOpenAnnotation }: { record: UnitRecord; mode: ViewerMode; relatedRecords: RelatedRecord[]; assetsBaseUrl: string; notesByTarget: Map<string, UserAnnotation[]>; onOpenAnnotation: (annotation: UserAnnotation, position?: AnnotationPosition) => void }) {
  const { unit, chunk } = record;
  const isChapter = depth(unit) === 0;
  const isCircularFallback = mode === "combined" && unit.document === "circ2019";
  const visibleRelated = mode === "combined" ? relatedRecords.filter(({ unit: relatedUnit }) => hasUnitContent(relatedUnit)) : emptyRelatedRecords;
  return <section tabIndex={0} className={`scv-unit scv-unit-depth-${Math.min(depth(unit), 4)}${isCircularFallback ? " scv-circular-fallback" : ""}`} data-provenance={isCircularFallback ? "Circolare 7/2019" : undefined} data-scv-text-unit={unit.id} data-scv-citation-target="unit" data-scv-source-unit-id={unit.id} data-scv-chunk-path={record.summary.chunkPath}>
    {isChapter ? <h2 className="scv-chapter-heading"><span className="scv-chapter-badge"><span className="scv-chapter-badge-label">Capitolo</span><strong>{unit.numbering.official}.</strong></span><span className="scv-chapter-rule" aria-hidden="true" /><span className="scv-chapter-title"><button type="button" className="scv-permalink-trigger" data-scv-copy-link aria-label={`Copia link al capitolo ${unit.numbering.official}`}>{unit.title}</button></span></h2> : <h2><span className="scv-unit-number">{unit.numbering.official}</span><span className="scv-unit-title"><button type="button" className="scv-permalink-trigger" data-scv-copy-link aria-label={`Copia link al paragrafo ${unit.numbering.official}`}>{unitTitleContent(unit)}</button></span></h2>}
    <AnnotationMarginMarker notes={notesByTarget.get(annotationTargetKey({ kind: "unit", unitId: unit.id })) ?? []} onOpen={onOpenAnnotation} />
    <ScvBlockFlow blocks={unit.blocks.filter((block) => !isRepeatedUnitTitle(unit, block))} assets={chunk.assets} assetsBaseUrl={assetsBaseUrl} sourceUnitId={unit.id} sourceDocument={unit.document} notesByTarget={notesByTarget} onOpenAnnotation={onOpenAnnotation} />
    {visibleRelated.map(({ edge, unit: relatedUnit, chunk: relatedChunk }) => <section tabIndex={0} className="scv-related-unit" data-provenance="Circolare 7/2019" data-scv-related-unit={relatedUnit.id} data-scv-citation-target="unit" data-scv-source-unit-id={relatedUnit.id} key={edge.relationId}><header><h3><span className="scv-related-number">{relatedUnit.numbering.official}</span><span className="scv-related-title"><button type="button" className="scv-permalink-trigger" data-scv-copy-link aria-label={`Copia link al paragrafo ${relatedUnit.numbering.official}`}>{relatedUnit.title}</button></span></h3></header><AnnotationMarginMarker notes={notesByTarget.get(annotationTargetKey({ kind: "unit", unitId: relatedUnit.id })) ?? []} onOpen={onOpenAnnotation} /><ScvBlockFlow blocks={relatedUnit.blocks.filter((block) => !isRepeatedUnitTitle(relatedUnit, block))} assets={relatedChunk.assets} assetsBaseUrl={assetsBaseUrl} sourceUnitId={relatedUnit.id} sourceDocument={relatedUnit.document} notesByTarget={notesByTarget} onOpenAnnotation={onOpenAnnotation} /></section>)}
  </section>;
}, (previous, next) => previous.record.unit === next.record.unit && previous.record.chunk === next.record.chunk && previous.mode === next.mode && previous.assetsBaseUrl === next.assetsBaseUrl && previous.notesByTarget === next.notesByTarget && previous.onOpenAnnotation === next.onOpenAnnotation && sameRelatedRecords(previous.relatedRecords, next.relatedRecords));

const DocumentContent = memo(function DocumentContent({ records, relatedByTarget, mode, assetsBaseUrl, documentLabel, documentUnits, documentChunks, hasPrevious, hasNext, notesByTarget, onOpenAnnotation }: {
  records: UnitRecord[];
  relatedByTarget: Map<string, RelatedRecord[]>;
  mode: ViewerMode;
  assetsBaseUrl: string;
  documentLabel: string;
  documentUnits: number;
  documentChunks: number;
  hasPrevious: boolean;
  hasNext: boolean;
  notesByTarget: Map<string, UserAnnotation[]>;
  onOpenAnnotation: (annotation: UserAnnotation, position?: AnnotationPosition) => void;
}) {
  if (records.length === 0) return <LoadingPanel label="Caricamento dei contenuti…" />;
  const version = records[0].chunk.structuralCodesVersion;
  return <div className="scv-text-flow">
    {hasPrevious && <div className="scv-progressive-edge" aria-hidden="true" />}
    <p className="scv-chunk-note">{documentLabel} · {documentUnits} unità · {documentChunks} chunk · structural-codes {version}</p>
    {records.map((record) => <MemoizedUnit record={record} mode={mode} relatedRecords={relatedByTarget.get(record.unit.id) ?? emptyRelatedRecords} assetsBaseUrl={assetsBaseUrl} notesByTarget={notesByTarget} onOpenAnnotation={onOpenAnnotation} key={record.unit.id} />)}
    {hasNext ? <div className="scv-progressive-edge" aria-hidden="true" /> : <div className="scv-end-note">Fine del documento.</div>}
  </div>;
});

interface GlobalScrollEntry {
  id: string;
  label: string;
  title: string;
  index: number;
  ratio: number;
  level: number;
  baseNumber: string;
}

const GlobalDocumentScrubber = memo(function GlobalDocumentScrubber({ rootRef, entries, activeId, onSelect, annotationMarkers, onAnnotationSelect }: {
  rootRef: RefObject<HTMLElement | null>;
  entries: GlobalScrollEntry[];
  activeId: string | null;
  onSelect: (id: string) => void;
  annotationMarkers: AnnotationMarker[];
  onAnnotationSelect: (annotation: UserAnnotation, position?: AnnotationPosition) => void;
}) {
  const [interaction, setInteraction] = useState<"idle" | "scrolling" | "hover" | "focus" | "dragging">("idle");
  const [previewEntry, setPreviewEntry] = useState<GlobalScrollEntry | null>(null);
  const [openCluster, setOpenCluster] = useState<string | null>(null);
  const openClusterTriggerRef = useRef<HTMLButtonElement | null>(null);
  const openClusterMenuRef = useRef<HTMLDivElement | null>(null);
  const hideTimerRef = useRef<number | null>(null);
  const pointerFrameRef = useRef<number | null>(null);
  const pendingPointerYRef = useRef<number | null>(null);
  const dragRef = useRef<{ pointerId: number; trackTop: number; trackHeight: number; session: ReturnType<typeof createGlobalScrubberDragSession> } | null>(null);
  const activeEntry = entries.find((entry) => entry.id === activeId) ?? null;
  const activeIndex = activeEntry?.index ?? 0;
  const ratio = interaction === "dragging" && previewEntry ? previewEntry.ratio : globalScrubberRatioForId(entries, activeId, activeEntry?.ratio ?? 0);
  const visible = interaction !== "idle";
  const annotationClusters = useMemo(() => clusterAnnotationMarkers(annotationMarkers), [annotationMarkers]);

  const clearHideTimer = useCallback(() => {
    if (hideTimerRef.current !== null) window.clearTimeout(hideTimerRef.current);
    hideTimerRef.current = null;
  }, []);
  const hideLater = useCallback(() => {
    clearHideTimer();
    hideTimerRef.current = window.setTimeout(() => setInteraction((current) => current === "scrolling" ? "idle" : current), 1000);
  }, [clearHideTimer]);
  const showTransient = useCallback(() => {
    setInteraction((current) => current === "dragging" || current === "hover" || current === "focus" ? current : "scrolling");
    hideLater();
  }, [hideLater]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const onScroll = () => showTransient();
    root.addEventListener("scroll", onScroll, { passive: true });
    return () => root.removeEventListener("scroll", onScroll);
  }, [rootRef, showTransient]);

  useEffect(() => () => {
    clearHideTimer();
    if (pointerFrameRef.current !== null) window.cancelAnimationFrame(pointerFrameRef.current);
  }, [clearHideTimer]);

  useEffect(() => {
    if (!openCluster) return;
    const closeOnOutsidePointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (openClusterTriggerRef.current?.contains(target) || openClusterMenuRef.current?.contains(target)) return;
      setOpenCluster(null);
    };
    document.addEventListener("pointerdown", closeOnOutsidePointer, true);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePointer, true);
  }, [openCluster]);

  if (entries.length < 2 || !activeEntry) return null;
  const previewPointer = (clientY: number) => {
    const drag = dragRef.current;
    if (!drag) return null;
    const entry = drag.session.preview((clientY - drag.trackTop) / Math.max(1, drag.trackHeight)) as GlobalScrollEntry | null;
    if (entry) setPreviewEntry(entry);
    return entry;
  };
  const startDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!event.isPrimary || event.button !== 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { pointerId: event.pointerId, trackTop: rect.top, trackHeight: rect.height, session: createGlobalScrubberDragSession(entries, (entry: GlobalScrollEntry) => onSelect(entry.id)) };
    previewPointer(event.clientY);
    setInteraction("dragging");
    clearHideTimer();
    event.preventDefault();
  };
  const moveDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    pendingPointerYRef.current = event.clientY;
    if (pointerFrameRef.current !== null) return;
    pointerFrameRef.current = window.requestAnimationFrame(() => {
      pointerFrameRef.current = null;
      if (pendingPointerYRef.current !== null) previewPointer(pendingPointerYRef.current);
    });
  };
  const stopDrag = (event: React.PointerEvent<HTMLDivElement>, commit: boolean) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (pointerFrameRef.current !== null) {
      window.cancelAnimationFrame(pointerFrameRef.current);
      pointerFrameRef.current = null;
    }
    previewPointer(event.clientY);
    if (commit) drag.session.commit();
    else drag.session.cancel();
    dragRef.current = null;
    pendingPointerYRef.current = null;
    setInteraction("scrolling");
    hideLater();
  };
  const onKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (!["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const target = entries[globalScrubberKeyboardIndex(activeIndex < 0 ? 0 : activeIndex, event.key, entries.length)];
    if (target) {
      setPreviewEntry(target);
      onSelect(target.id);
    }
  };
  const overlayEntry = previewEntry ?? activeEntry;
  const displayedEntry = interaction === "dragging" && previewEntry ? previewEntry : activeEntry;
  const valueText = displayedEntry ? `§ ${displayedEntry.label} — ${displayedEntry.title}` : "Posizione nel documento";
  return <div className={`scv-scroll-rail ${visible ? "is-visible" : "is-idle"} is-${interaction}`} aria-label="Navigazione globale del documento" style={{ "--scv-scrubber-ratio": ratio } as React.CSSProperties}
    onMouseEnter={() => { clearHideTimer(); setInteraction((current) => current === "dragging" ? current : "hover"); }}
    onMouseLeave={() => { if (interaction !== "dragging" && interaction !== "focus") { setInteraction("scrolling"); hideLater(); } }}
    onFocusCapture={() => { clearHideTimer(); setInteraction("focus"); }}
    onBlurCapture={() => { setInteraction("scrolling"); hideLater(); }}>
    <div className="scv-scroll-track" role="presentation" onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={(event) => stopDrag(event, true)} onPointerCancel={(event) => stopDrag(event, false)}>
      {annotationClusters.map((cluster) => {
        const id = cluster.markers.map(({ annotation }) => annotation.id).join(":");
        const single = cluster.markers.length === 1 ? cluster.markers[0].annotation : null;
        const type = single?.type ?? "cluster";
        const typeCounts = cluster.markers.reduce((counts, { annotation }) => {
          counts[annotation.type] += 1;
          return counts;
        }, { bookmark: 0, note: 0 });
        const clusterTypes = (Object.keys(typeCounts) as Array<keyof typeof typeCounts>).filter((annotationType) => typeCounts[annotationType] > 0);
        const clusterSummary = [typeCounts.bookmark ? `${typeCounts.bookmark} segnalibri` : "", typeCounts.note ? `${typeCounts.note} note` : ""].filter(Boolean).join(" e ");
        const label = single ? `${single.type === "bookmark" ? "Segnalibro" : "Nota"}: § ${single.numbering} — ${single.title}` : `${cluster.markers.length} annotazioni vicine: ${clusterSummary}`;
        return <span className="scv-annotation-scrubber-group" style={{ "--scv-annotation-ratio": cluster.ratio } as React.CSSProperties} key={id}>
          <button ref={!single && openCluster === id ? openClusterTriggerRef : null} type="button" className={`scv-annotation-scrubber-marker is-${type}`} aria-label={label} title={label} onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); if (single) { const bounds = event.currentTarget.getBoundingClientRect(); onAnnotationSelect(single, { x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2 }); } else setOpenCluster((current) => current === id ? null : id); }}><span aria-hidden="true">{single ? type === "bookmark" ? <BookmarkIcon className="scv-annotation-scrubber-icon" /> : type === "note" ? <StickyNoteIcon className="scv-annotation-scrubber-icon" /> : null : <><span className="scv-annotation-scrubber-types">{clusterTypes.map((annotationType) => annotationType === "bookmark" ? <BookmarkIcon key={annotationType} className="scv-annotation-scrubber-icon" /> : <StickyNoteIcon key={annotationType} className="scv-annotation-scrubber-icon" />)}</span><span className="scv-annotation-scrubber-count">{cluster.markers.length}</span></>}</span></button>
          {!single && openCluster === id && <div ref={openClusterMenuRef} className="scv-annotation-cluster-popover" role="menu" aria-label="Annotazioni vicine">{cluster.markers.map(({ annotation }) => <button type="button" role="menuitem" key={annotation.id} onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); const bounds = event.currentTarget.getBoundingClientRect(); setOpenCluster(null); onAnnotationSelect(annotation, { x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2 }); }}><b aria-hidden="true">{annotation.type === "bookmark" ? <BookmarkIcon className="scv-annotation-cluster-icon" /> : <StickyNoteIcon className="scv-annotation-cluster-icon" />}</b><span>{annotation.type === "bookmark" ? "Segnalibro" : "Nota"} · § {annotation.numbering}</span></button>)}</div>}
        </span>;
      })}
      <button type="button" className="scv-scroll-thumb" role="slider" aria-label="Posizione nel documento" aria-valuemin={1} aria-valuemax={entries.length} aria-valuenow={(displayedEntry?.index ?? 0) + 1} aria-valuetext={valueText}
        onKeyDown={onKeyDown} />
    </div>
    {interaction === "dragging" && overlayEntry && <output className="scv-scroll-overlay" aria-live="off"><strong>§ {overlayEntry.label}</strong><span>{overlayEntry.title}</span></output>}
  </div>;
});

function useVisibleUnitObserver(rootRef: RefObject<HTMLElement | null>, records: UnitRecord[], onVisible: (unitId: string) => void) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root || records.length === 0) return;
    const elements = [...root.querySelectorAll<HTMLElement>("[data-scv-text-unit]")];
    if (elements.length === 0) return;
    const orderedIds = elements.flatMap((element) => element.dataset.scvTextUnit ? [element.dataset.scvTextUnit] : []);
    const nearEnd = () => root.scrollTop + root.clientHeight >= root.scrollHeight - Math.max(24, root.clientHeight * 0.5);
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
        const candidate = nearEnd() ? positions[positions.length - 1] : positions[Math.max(0, low - 1)];
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
    const onScroll = () => {
      if (!nearEnd()) return;
      const lastId = orderedIds[orderedIds.length - 1];
      if (lastId) onVisible(lastId);
    };
    root.addEventListener("scroll", onScroll, { passive: true });
    for (const element of elements) observer.observe(element);
    return () => {
      root.removeEventListener("scroll", onScroll);
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

const SearchBox = memo(function SearchBox({ className = "", query, onQueryChange, searchReady, searchStatus, searchSource, searchDurationMs, searchResults, onSearchSubmit, onSearchResult, onRequestClose, searchRef }: {
  className?: string;
  query: string;
  onQueryChange: (query: string) => void;
  searchReady: boolean;
  searchStatus: "idle" | "loading" | "ready" | "error";
  searchSource: "exact" | "worker";
  searchDurationMs: number | null;
  searchResults: SearchResult[];
  onSearchSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onSearchResult: (result: SearchResult) => void;
  onRequestClose: () => void;
  searchRef: RefObject<HTMLInputElement | null>;
}) {
  const searchResultsRef = useRef<HTMLDivElement>(null);
  const [searchEditing, setSearchEditing] = useState(false);
  const searchResultsId = useId();
  const focusSearchResult = (position: number) => {
    const results = [...(searchResultsRef.current?.querySelectorAll<HTMLButtonElement>(".scv-search-result") ?? [])];
    if (results.length === 0) return;
    results[(position + results.length) % results.length]?.focus();
  };
  const searchResultKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, position: number) => {
    if (event.key === "ArrowDown") { event.preventDefault(); focusSearchResult(position + 1); }
    else if (event.key === "ArrowUp") {
      event.preventDefault();
      if (position === 0) searchRef.current?.focus();
      else focusSearchResult(position - 1);
    }
    else if (event.key === "Home") { event.preventDefault(); focusSearchResult(0); }
    else if (event.key === "End") { event.preventDefault(); focusSearchResult(searchResults.length - 1); }
    else if (event.key === "Escape") { event.preventDefault(); onQueryChange(""); searchRef.current?.focus(); }
  };

  return <div className={`scv-search-box ${className} ${searchEditing ? "is-editing" : ""}`} onBlur={(event) => {
    if (!event.currentTarget.contains(event.relatedTarget)) setSearchEditing(false);
  }}>
    <form className="scv-search-form" role="search" onMouseDown={(event) => {
      if (!(event.target as HTMLElement).closest("button")) searchRef.current?.focus();
    }} onSubmit={(event) => {
      onSearchSubmit(event);
      if (searchResults.length > 0) setSearchEditing(false);
    }}>
      <span className="scv-search-icon"><SearchIcon /></span>
      <input ref={searchRef} type="search" role="combobox" aria-autocomplete="list" value={query} onChange={(event) => onQueryChange(event.target.value)} onKeyDown={(event) => {
        if (event.key === "Escape" && query) { event.preventDefault(); onQueryChange(""); }
        else if (event.key === "ArrowDown" && searchResults.length > 0) { event.preventDefault(); focusSearchResult(0); }
      }} onFocus={() => setSearchEditing(true)} placeholder={searchEditing ? "" : "Cerca nella normativa…"} aria-label="Cerca nella normativa" aria-controls={searchResultsId} aria-expanded={searchEditing && searchReady} />
      {searchEditing && query && <button type="button" className="scv-clear-search" onClick={() => onQueryChange("")} aria-label="Cancella ricerca"><CloseIcon /></button>}
      {!searchEditing && !query && <kbd>/</kbd>}
    </form>
    {searchEditing && searchReady && <div id={searchResultsId} ref={searchResultsRef} className="scv-search-results" role="listbox" aria-label="Risultati ricerca" aria-busy={searchStatus === "loading"} data-scv-search-source={searchSource} data-scv-search-duration-ms={searchDurationMs ?? undefined}>
      {searchStatus === "loading" ? <p className="scv-search-status">Ricerca in corso…</p> : searchStatus === "error" ? <p className="scv-search-status">Ricerca non disponibile.</p> : searchResults.length === 0 ? <p className="scv-search-status">Nessun risultato nella modalità corrente.</p> : searchResults.map((result, index) => <button type="button" role="option" aria-selected={false} className="scv-search-result" data-search-match={result.matchKind} key={`${result.id}:${result.blockId ?? ""}:${result.assetId ?? ""}`} onKeyDown={(event) => searchResultKeyDown(event, index)} onClick={() => { setSearchEditing(false); onSearchResult(result); onRequestClose(); }}><span>{result.document === "ntc2018" ? "NTC 2018" : "Circolare 7/2019"} · {result.numbering}{result.assetKind ? ` · ${result.assetKind === "formula" ? "Formula" : result.assetKind === "table" ? "Tabella" : "Figura"}` : ""}</span><strong>{result.title}</strong><small><HighlightedSnippet result={result} /></small></button>)}
    </div>}
  </div>;
});

const NavigationPane = memo(function NavigationPane({ id, mode, onModeChange, hierarchy, activeLevelIds, sidebarMode, sidebarSession, indexReady, query, onQueryChange, searchReady, searchStatus, searchSource, searchDurationMs, searchResults, onSearchSubmit, onSearchResult, onSelectUnit, onRequestClose, onHistoryBack, onHistoryForward, canHistoryBack, canHistoryForward, searchRef, darkMode, onToggleTheme }: {
  id: string;
  mode: ViewerMode;
  onModeChange: (mode: ViewerMode) => void;
  hierarchy: NavigationEntry[][];
  activeLevelIds: Array<string | null>;
  sidebarMode: boolean;
  sidebarSession: number;
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
  onRequestClose: () => void;
  onHistoryBack: () => void;
  onHistoryForward: () => void;
  canHistoryBack: boolean;
  canHistoryForward: boolean;
  searchRef: RefObject<HTMLInputElement | null>;
  darkMode: boolean;
  onToggleTheme: () => void;
}) {
  const indexListRef = useRef<HTMLDivElement>(null);
  const [sidebarExpanded, setSidebarExpanded] = useState<{ session: number; chapterId: string | null; paragraphId: string | null }>({ session: -1, chapterId: null, paragraphId: null });
  const lastSidebarEntryRef = useRef<{ session: number; id: string } | null>(null);
  const themeTooltipId = useId();
  const chapters = hierarchy[0] ?? [];
  const paragraphs = hierarchy[1] ?? emptyNavigationEntries;
  const subparagraphs = hierarchy[2] ?? emptyNavigationEntries;
  const numberCharsByLevel = hierarchy.map((entries) => entries.reduce((longest, entry) => Math.max(longest, [...entry.displayNumber].length), 1));
  const activeChapterId = activeLevelIds[0] ?? null;
  const activeParagraphId = activeLevelIds[1] ?? null;
  const activeSubparagraphId = activeLevelIds[2] ?? null;
  const mobileExpansion = mobileIndexExpansion(activeLevelIds, sidebarExpanded, sidebarSession);
  const paragraphsByChapter = useMemo(() => {
    const grouped = new Map<string, NavigationEntry[]>();
    for (const entry of paragraphs) {
      const group = grouped.get(entry.parentId ?? "") ?? [];
      group.push(entry);
      grouped.set(entry.parentId ?? "", group);
    }
    return grouped;
  }, [paragraphs]);
  const subparagraphsByParagraph = useMemo(() => {
    const grouped = new Map<string, NavigationEntry[]>();
    for (const entry of subparagraphs) {
      const group = grouped.get(entry.parentId ?? "") ?? [];
      group.push(entry);
      grouped.set(entry.parentId ?? "", group);
    }
    return grouped;
  }, [subparagraphs]);

  useEffect(() => {
    const targetId = activeSubparagraphId ?? activeParagraphId ?? activeChapterId;
    if (!targetId) return;
    const timeout = window.setTimeout(() => {
      const target = indexListRef.current?.querySelector<HTMLElement>(`[data-index-unit="${CSS.escape(targetId)}"]`);
      if (!target) return;
      const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      target.scrollIntoView({ block: "nearest", behavior: reducedMotion ? "auto" : "smooth" });
    }, 360);
    return () => window.clearTimeout(timeout);
  }, [activeChapterId, activeParagraphId, activeSubparagraphId]);

  const renderEntryButton = (entry: NavigationEntry, level: number, active: boolean, tabIndex: number, expanded?: boolean) => <button type="button" data-index-unit={entry.summary.id} className={`scv-index-entry scv-index-level-${level} ${active ? "active" : ""}`} onClick={() => {
    if (sidebarMode && expanded !== undefined) {
      if (lastSidebarEntryRef.current?.session !== sidebarSession || lastSidebarEntryRef.current.id !== entry.summary.id) {
        lastSidebarEntryRef.current = { session: sidebarSession, id: entry.summary.id };
        setSidebarExpanded((current) => level === 0
          ? { session: sidebarSession, chapterId: entry.summary.id, paragraphId: null }
          : { session: sidebarSession, chapterId: entry.parentId ?? current.chapterId, paragraphId: entry.summary.id });
        return;
      }
    }
    lastSidebarEntryRef.current = null;
    onSelectUnit(entry.summary);
    onRequestClose();
  }} title={`${entry.displayNumber} ${entry.summary.title}`} aria-current={active ? "page" : undefined} aria-expanded={expanded} tabIndex={tabIndex}><strong style={{ width: `calc(${numberCharsByLevel[level]}ch + 12px)` }}>{entry.displayNumber}</strong><span>{entry.summary.title}</span></button>;

  return <aside id={id} className="scv-index-pane" aria-label="Indice gerarchico" onClickCapture={(event) => {
    if (!(event.target as HTMLElement).closest("[data-index-unit]")) lastSidebarEntryRef.current = null;
  }}>
    <div className="scv-search-toolbar">
      <div className="scv-history-controls" role="group" aria-label="Cronologia di navigazione">
        <button type="button" aria-label="Indietro" disabled={!canHistoryBack} onClick={onHistoryBack}><HistoryBackIcon className="scv-history-icon" /></button>
        <button type="button" aria-label="Avanti" disabled={!canHistoryForward} onClick={onHistoryForward}><HistoryForwardIcon className="scv-history-icon" /></button>
      </div>
      <SearchBox query={query} onQueryChange={onQueryChange} searchReady={searchReady} searchStatus={searchStatus} searchSource={searchSource} searchDurationMs={searchDurationMs} searchResults={searchResults} onSearchSubmit={onSearchSubmit} onSearchResult={onSearchResult} onRequestClose={onRequestClose} searchRef={searchRef} />
      <div className="scv-index-controls"><div className="scv-index-controls-inner">
      <ModeSegmentedControl mode={mode} onChange={onModeChange} />
      <button type="button" className="scv-theme-button" onClick={onToggleTheme} aria-label={darkMode ? "Attiva modalità giorno" : "Attiva modalità notte"} aria-describedby={themeTooltipId} aria-pressed={darkMode}>
        <span className="scv-theme-icon" aria-hidden="true">{darkMode
          ? <SunIcon />
          : <MoonIcon />}
        </span>
        <span id={themeTooltipId} className="scv-control-tooltip" role="tooltip">{darkMode ? "Attiva modalità giorno" : "Attiva modalità notte"}</span>
      </button>
      </div></div>
      <button type="button" className="scv-mobile-index-close" onClick={onRequestClose} aria-label="Chiudi indice"><CloseIcon /></button>
    </div>
    <div className="scv-index-grid">
      <section className="scv-index-cell"><header><span>Indice</span></header><div className="scv-index-list" ref={indexListRef}>{!indexReady ? <LoadingRows /> : chapters.length === 0 ? <p className="scv-index-empty">L’indice non è disponibile.</p> : <ul className="scv-index-tree">
        {chapters.map((chapter) => {
          const chapterParagraphs = paragraphsByChapter.get(chapter.summary.id) ?? [];
          const chapterActive = activeChapterId === chapter.summary.id;
          const chapterOpen = sidebarMode ? mobileExpansion.chapterId === chapter.summary.id : chapterActive;
          return <li className={`scv-index-tree-item scv-index-tree-item-level-0 ${chapterOpen ? "is-open" : ""}`} key={chapter.summary.id}>
            {renderEntryButton(chapter, 0, chapterActive, 0, chapterParagraphs.length > 0 ? chapterOpen : undefined)}
            {chapterParagraphs.length > 0 && <div className={`scv-index-children ${chapterOpen ? "is-open" : ""}`} aria-hidden={!chapterOpen}><div className="scv-index-children-inner"><ul className="scv-index-children-list scv-index-paragraph-list">
              {chapterParagraphs.map((paragraph) => {
                const paragraphSubparagraphs = subparagraphsByParagraph.get(paragraph.summary.id) ?? [];
                const paragraphActive = activeParagraphId === paragraph.summary.id;
                const paragraphOpen = chapterOpen && (sidebarMode ? mobileExpansion.paragraphId === paragraph.summary.id : paragraphActive);
                return <li className={`scv-index-tree-item scv-index-tree-item-level-1 ${paragraphOpen ? "is-open" : ""}`} key={paragraph.summary.id}>
                  {renderEntryButton(paragraph, 1, paragraphActive, chapterOpen ? 0 : -1, paragraphSubparagraphs.length > 0 ? paragraphOpen : undefined)}
                  {paragraphSubparagraphs.length > 0 && <div className={`scv-index-children ${paragraphOpen ? "is-open" : ""}`} aria-hidden={!paragraphOpen}><div className="scv-index-children-inner"><ul className="scv-index-children-list scv-index-subparagraph-list">
                    {paragraphSubparagraphs.map((subparagraph) => <li className="scv-index-tree-item scv-index-tree-item-level-2" key={subparagraph.summary.id}>{renderEntryButton(subparagraph, 2, activeSubparagraphId === subparagraph.summary.id, paragraphOpen ? 0 : -1)}</li>)}
                  </ul></div></div>}
                </li>;
              })}
            </ul></div></div>}
          </li>;
        })}
      </ul>}</div></section>
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

export function NormativeViewer({ defaultMode = "combined", dataBaseUrl = "/data/codes", assetsBaseUrl = "/assets", auxiliaryPanel, auxiliaryPanelLabel = "PDF ufficiale", auxiliaryPanelButtonText = "Apri", auxiliaryPanelDefaultVisible = false, auxiliaryPanelDesktopDefaultVisible = false, auxiliaryPanelModes, auxiliaryPanelKeepMounted = false, searchMaxResults = 12, className, annotationStore }: NormativeViewerProps) {
  const [manifest, setManifest] = useState<CorpusManifest | null>(null);
  const [indexes, setIndexes] = useState<Map<DocumentId, DocumentIndex>>(new Map());
  const [loadedChunks, setLoadedChunks] = useState<Map<string, CorpusChunk>>(new Map());
  const [renderedChunkPaths, setRenderedChunkPaths] = useState<Set<string>>(new Set());
  const [requestedCircPaths, setRequestedCircPaths] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState<ViewerMode>(defaultMode);
  const [modeRevision, setModeRevision] = useState(0);
  const [activeUnitId, setActiveUnitId] = useState<string | null>(null);
  const [historyPosition, setHistoryPosition] = useState({ index: 0, max: 0 });
  const [relations, setRelations] = useState<RelationEdge[]>([]);
  const [relationsLoaded, setRelationsLoaded] = useState(false);
  const [crossReferenceIndex, setCrossReferenceIndex] = useState<CrossReferenceIndex | null>(null);
  const [referencePreview, setReferencePreview] = useState<ReferencePreviewData | null>(null);
  const [citationSelection, setCitationSelection] = useState<CitationSelection | null>(null);
  const [permalinkNotice, setPermalinkNotice] = useState<PermalinkNotice | null>(null);
  const [query, setQuery] = useState("");
  const [loadError, setLoadError] = useState(false);
  const [contentLoadNotice, setContentLoadNotice] = useState<string | null>(null);
  const [mobileIndexOpen, setMobileIndexOpen] = useState(false);
  const [mobileIndexSession, setMobileIndexSession] = useState(0);
  const [darkMode, setDarkMode] = useState<boolean | null>(null);
  const [auxiliaryVisible, setAuxiliaryVisible] = useState(false);
  const [auxiliaryMounted, setAuxiliaryMounted] = useState(auxiliaryPanelKeepMounted);
  const [auxiliaryEntered, setAuxiliaryEntered] = useState(false);
  const [annotations, setAnnotations] = useState<UserAnnotation[]>([]);
  const [annotationsLoading, setAnnotationsLoading] = useState(Boolean(annotationStore));
  const [annotationError, setAnnotationError] = useState<string | null>(null);
  const [annotationMenu, setAnnotationMenu] = useState<AnnotationMenuState | null>(null);
  const [annotationEditor, setAnnotationEditor] = useState<AnnotationEditorState | null>(null);
  const [annotationBusy, setAnnotationBusy] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const mobileSearchRef = useRef<HTMLInputElement>(null);
  const mobileIndexButtonRef = useRef<HTMLButtonElement>(null);
  const auxiliaryButtonRef = useRef<HTMLButtonElement>(null);
  const auxiliaryPaneRef = useRef<HTMLElement>(null);
  const auxiliaryId = useId();
  const navigationId = useId();
  const requestedIdRef = useRef<string | null>(null);
  const requestedTargetRef = useRef<ViewerTarget | null>(null);
  const scrollRequestRef = useRef<ViewerTarget | null>(null);
  const activeIdRef = useRef<string | null>(null);
  const manualTargetRef = useRef<{ id: string; expires: number } | null>(null);
  const navigationGenerationRef = useRef(0);
  const renderedChunkPathsRef = useRef<Set<string>>(new Set());
  const pendingScrollAnchorRef = useRef<{ id: string; top: number; generation: number } | null>(null);
  const initializedContextRef = useRef("");
  const initializedOnceRef = useRef(false);
  const historyNavigationRef = useRef(false);
  const historySessionRef = useRef(crypto.randomUUID());
  const historyPositionRef = useRef({ index: 0, max: 0 });
  const pendingHistoryScrollRef = useRef<number | null>(null);
  const crossReferencePromiseRef = useRef<Promise<CrossReferenceIndex> | null>(null);
  const relationsPromiseRef = useRef<Promise<RelationEdge[]> | null>(null);
  const permalinkNoticeTimerRef = useRef<number | null>(null);
  const searchHighlightTimerRef = useRef<number | null>(null);
  const pendingSearchHighlightRef = useRef<ViewerTarget | null>(null);
  const referencePreviewRequestRef = useRef(0);
  const touchReferenceRef = useRef<HTMLElement | null>(null);
  const lastPointerTypeRef = useRef("");
  const suppressAnnotationClickRef = useRef(false);
  const longPressRef = useRef<{ pointerId: number; session: ReturnType<typeof createLongPressSession> } | null>(null);
  const textPaneRef = useRef<HTMLElement>(null);
  const documentId = documentForMode(mode);
  const documentIdRef = useRef(documentId);
  const hasAuxiliary = Boolean(auxiliaryPanel);
  const auxiliaryAvailable = hasAuxiliary && (auxiliaryPanelModes ? auxiliaryPanelModes.includes(mode) : mode !== "combined");

  useEffect(() => {
    window.history.replaceState(withViewerHistoryEntry(window.history.state, { session: historySessionRef.current, index: 0, scrollTop: textPaneRef.current?.scrollTop ?? 0 }), "", window.location.href);
  }, []);

  const saveHistoryScroll = useCallback(() => {
    const entry = viewerHistoryEntry(window.history.state);
    if (entry?.session !== historySessionRef.current) return;
    window.history.replaceState(withViewerHistoryEntry(window.history.state, { ...entry, scrollTop: textPaneRef.current?.scrollTop ?? 0 }), "", window.location.href);
  }, []);

  const pushViewerHistory = useCallback((nextMode: ViewerMode, target: ViewerTarget) => {
    const url = urlForViewerTarget(window.location.href, nextMode, defaultMode, target);
    if (url.href === window.location.href) return;
    saveHistoryScroll();
    const index = historyPositionRef.current.index + 1;
    const position = { index, max: index };
    historyPositionRef.current = position;
    setHistoryPosition(position);
    updateDeepLink(nextMode, target, defaultMode, "push", withViewerHistoryEntry(window.history.state, { session: historySessionRef.current, index, scrollTop: 0 }));
  }, [defaultMode, saveHistoryScroll]);

  useEffect(() => {
    const tablet = window.matchMedia("(min-width: 992px)");
    const desktop = window.matchMedia("(min-width: 1400px)");
    const syncLayout = () => {
      setAuxiliaryVisible(Boolean(hasAuxiliary && (desktop.matches ? auxiliaryPanelDesktopDefaultVisible || auxiliaryPanelDefaultVisible : false)));
      setMobileIndexOpen(false);
    };
    syncLayout();
    tablet.addEventListener("change", syncLayout);
    desktop.addEventListener("change", syncLayout);
    return () => {
      tablet.removeEventListener("change", syncLayout);
      desktop.removeEventListener("change", syncLayout);
    };
  }, [hasAuxiliary, auxiliaryPanelDefaultVisible, auxiliaryPanelDesktopDefaultVisible]);

  useEffect(() => {
    let mountFrame: number | null = null;
    let enterFrame: number | null = null;
    let unmountTimer: number | null = null;
    const canRenderPanel = Boolean(manifest && auxiliaryAvailable);

    if (canRenderPanel && (auxiliaryVisible || auxiliaryPanelKeepMounted)) {
      if (!auxiliaryMounted) {
        mountFrame = window.requestAnimationFrame(() => {
          setAuxiliaryMounted(true);
          if (auxiliaryVisible) enterFrame = window.requestAnimationFrame(() => setAuxiliaryEntered(true));
        });
      } else enterFrame = window.requestAnimationFrame(() => setAuxiliaryEntered(auxiliaryVisible));
    } else {
      mountFrame = window.requestAnimationFrame(() => {
        setAuxiliaryEntered(false);
        if (!canRenderPanel && auxiliaryMounted) setAuxiliaryMounted(false);
      });
      if (canRenderPanel && auxiliaryMounted && !auxiliaryPanelKeepMounted) unmountTimer = window.setTimeout(() => setAuxiliaryMounted(false), 520);
    }

    return () => {
      if (mountFrame !== null) window.cancelAnimationFrame(mountFrame);
      if (enterFrame !== null) window.cancelAnimationFrame(enterFrame);
      if (unmountTimer !== null) window.clearTimeout(unmountTimer);
    };
  }, [auxiliaryAvailable, auxiliaryMounted, auxiliaryPanelKeepMounted, auxiliaryVisible, manifest]);

  const flashSearchTarget = useCallback((target: ViewerTarget) => {
    const root = textPaneRef.current;
    const element = findViewerTarget(root, target);
    if (!element) return false;
    root?.querySelector<HTMLElement>(".scv-search-target")?.classList.remove("scv-search-target");
    element.classList.add("scv-search-target");
    if (searchHighlightTimerRef.current !== null) window.clearTimeout(searchHighlightTimerRef.current);
    searchHighlightTimerRef.current = window.setTimeout(() => {
      element.classList.remove("scv-search-target");
      searchHighlightTimerRef.current = null;
    }, 2200);
    return true;
  }, []);

  useEffect(() => () => {
    if (searchHighlightTimerRef.current !== null) window.clearTimeout(searchHighlightTimerRef.current);
    if (permalinkNoticeTimerRef.current !== null) window.clearTimeout(permalinkNoticeTimerRef.current);
  }, []);

  const reportChunkLoadFailure = useCallback((message = "Una parte del documento non è disponibile. Puoi continuare a consultare i contenuti già caricati.") => {
    if (renderedChunkPathsRef.current.size === 0) setLoadError(true);
    else setContentLoadNotice(message);
  }, []);

  useEffect(() => {
    documentIdRef.current = documentId;
  }, [documentId]);

  useEffect(() => {
    if (!annotationStore) return;
    let cancelled = false;
    annotationStore.listAnnotations().then((items) => {
      if (!cancelled) { setAnnotations(items); setAnnotationError(null); }
    }).catch((error: unknown) => {
      if (!cancelled) setAnnotationError(error instanceof Error ? error.message : "Annotazioni locali non disponibili.");
    }).finally(() => { if (!cancelled) setAnnotationsLoading(false); });
    return () => { cancelled = true; };
  }, [annotationStore]);

  const notesByTarget = useMemo(() => {
    const grouped = new Map<string, UserAnnotation[]>();
    for (const annotation of annotations) {
      if (annotation.type !== "note") continue;
      const key = annotationTargetKey(annotation.target);
      const group = grouped.get(key) ?? [];
      group.push(annotation); grouped.set(key, group);
    }
    return grouped;
  }, [annotations]);

  const openAnnotation = useCallback((annotation: UserAnnotation, position?: AnnotationPosition) => {
    setAnnotationMenu(null);
    setAnnotationError(null);
    setAnnotationEditor({ type: annotation.type, target: annotation.target, annotation, metadata: {
      documentId: annotation.documentId, numbering: annotation.numbering, title: annotation.title,
      automaticLabel: annotation.label ?? automaticAnnotationLabel(annotation.target, annotation.numbering, annotation.title),
    }, x: position?.x, y: position?.y });
  }, []);

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
      pendingSearchHighlightRef.current = requestedTargetRef.current;
      setCitationSelection(requestedTargetRef.current);
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
  const readingSummary = useMemo(() => manifest ? viewerDocumentSummary(manifest, mode) : null, [manifest, mode]);
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
    if (mode !== "combined" || !index || !circIndex || !circLookup) return [];
    const primaryBases = new Set(index.units.map((summary) => baseNumbering(summary.numbering.official)));
    return recordsForPaths(circIndex, circLookup, requiredCombinedCircPaths, loadedChunks).filter(({ unit }) => fallbackIds.has(unit.id) && (hasUnitContent(unit) || !primaryBases.has(baseNumbering(unit.numbering.official))));
  }, [circIndex, circLookup, fallbackIds, index, loadedChunks, mode, requiredCombinedCircPaths]);
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
    const primaryBases = new Set(index.units.map((summary) => baseNumbering(summary.numbering.official)));
    const summaries = mode === "combined"
      ? [...index.units, ...combinedPlan.fallbackSummaries].filter((summary) => summary.document !== "circ2019" || !primaryBases.has(baseNumbering(summary.numbering.official)))
      : index.units;
    const entries = summaries.map((summary) => navigationEntry(summary));
    if (mode !== "combined") return entries.sort((left, right) => compareBaseNumbering(left.summary, right.summary));
    const entryIdByBase = new Map(entries.map((entry) => [entry.baseNumber, entry.summary.id]));
    return entries.map((entry) => {
      const parentBase = parentNumbering(entry.baseNumber);
      const parentId = parentBase ? entryIdByBase.get(parentBase) ?? null : null;
      return entry.parentId === parentId ? entry : { ...entry, parentId };
    }).sort((left, right) => compareBaseNumbering(left.summary, right.summary));
  }, [combinedPlan.fallbackSummaries, index, mode]);
  const entryById = useMemo(() => new Map(navigationEntries.map((entry) => [entry.summary.id, entry])), [navigationEntries]);
  const recordById = useMemo(() => new Map(renderRecords.map((record) => [record.unit.id, record])), [renderRecords]);
  const summaryById = useMemo(() => new Map([...indexes.values()].flatMap((documentIndex) => documentIndex.units).map((summary) => [summary.id, summary])), [indexes]);
  const annotationRanks = useMemo(() => annotationPositionRanks(indexes.values()), [indexes]);

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
    if (!historyNavigationRef.current) {
      if (initializedOnceRef.current) pushViewerHistory(mode, requestedTarget);
      else updateDeepLink(mode, requestedTarget, defaultMode);
    }
    initializedOnceRef.current = true;
    historyNavigationRef.current = false;
    const generation = ++navigationGenerationRef.current;
    pendingScrollAnchorRef.current = null;
    void revealSummary(revealInitial, primaryRenderedPaths.size === 0 || revealInitial.document !== documentId, generation).catch(() => reportChunkLoadFailure());
  }, [circLookup, defaultMode, documentId, index, lookup, mode, modeRevision, primaryRenderedPaths.size, pushViewerHistory, relations, relationsLoaded, reportChunkLoadFailure, revealSummary]);

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
    if (pendingHistoryScrollRef.current !== null && root) {
      root.scrollTop = pendingHistoryScrollRef.current;
      pendingHistoryScrollRef.current = null;
    }
    if (sameViewerTarget(pendingSearchHighlightRef.current, target) && flashSearchTarget(target)) pendingSearchHighlightRef.current = null;
    manualTargetRef.current = { id: target.unitId, expires: performance.now() + 500 };
  }, [auxiliaryAvailable, auxiliaryVisible, defaultMode, flashSearchTarget, mode, relatedByTarget, renderRecords]);

  const navigationRef = useRef({ entryById, lookup, mode, relations, primaryAnchorByFallbackId: combinedPlan.primaryAnchorByFallbackId });
  useEffect(() => {
    navigationRef.current = { entryById, lookup, mode, relations, primaryAnchorByFallbackId: combinedPlan.primaryAnchorByFallbackId };
  }, [combinedPlan.primaryAnchorByFallbackId, entryById, lookup, mode, relations]);

  const loadAdjacentAtUnit = useCallback((unitId: string) => {
    const current = navigationRef.current;
    const adjacent = progressiveChunkTargetsForVisibleUnit(current.lookup, unitId, current.primaryAnchorByFallbackId);
    if (adjacent.previous) void mountPrimaryChunk(adjacent.previous, false, true).catch(() => reportChunkLoadFailure("Il chunk precedente non è disponibile; il resto del documento rimane consultabile."));
    if (adjacent.next) void mountPrimaryChunk(adjacent.next, false).catch(() => reportChunkLoadFailure("Il chunk successivo non è disponibile; il resto del documento rimane consultabile."));
  }, [mountPrimaryChunk, reportChunkLoadFailure]);

  const onVisibleUnit = useCallback((nextId: string) => {
    const guard = manualTargetRef.current;
    if (guard && performance.now() < guard.expires && guard.id !== nextId) return;
    if (guard?.id === nextId || (guard && performance.now() >= guard.expires)) manualTargetRef.current = null;
    if (nextId !== activeIdRef.current) {
      setCitationSelection(null);
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
    const target = { kind: "unit" as const, unitId: unit.id };
    setCitationSelection(null);
    setMobileIndexOpen(false);
    const generation = ++navigationGenerationRef.current;
    pendingScrollAnchorRef.current = null;
    setContentLoadNotice(null);
    requestedIdRef.current = unit.id;
    requestedTargetRef.current = target;
    pendingSearchHighlightRef.current = target;
    manualTargetRef.current = { id: unit.id, expires: performance.now() + 500 };
    pushViewerHistory(navigationRef.current.mode, target);
    const present = scrollTextUnit(textPaneRef.current, unit.id);
    activeIdRef.current = unit.id;
    setActiveUnitId(unit.id);
    if (present) { if (flashSearchTarget(target)) pendingSearchHighlightRef.current = null; return; }
    const currentLookup = navigationRef.current.lookup;
    const nearMountedWindow = currentLookup ? isChunkNearRenderedWindow(currentLookup, unit.chunkPath, primaryRenderedPaths) : false;
    void revealSummary(unit, !nearMountedWindow, generation).catch(() => reportChunkLoadFailure());
  }, [flashSearchTarget, primaryRenderedPaths, pushViewerHistory, reportChunkLoadFailure, revealSummary]);

  const navigateViewerTarget = useCallback(async (target: ViewerTarget, action: "push" | "replace" | "none" = "push", forcedMode?: ViewerMode) => {
    setCitationSelection(target);
    setMobileIndexOpen(false);
    pendingSearchHighlightRef.current = target;
    const generation = ++navigationGenerationRef.current;
    pendingScrollAnchorRef.current = null;
    setContentLoadNotice(null);
    const targetDocument = documentFromUnitId(target.unitId);
    const nextMode = forcedMode ?? (mode === "combined" || documentForMode(mode) === targetDocument ? mode : targetDocument === "ntc2018" ? "ntc" : "circ");
    requestedIdRef.current = target.unitId;
    requestedTargetRef.current = target;
    scrollRequestRef.current = target;
    manualTargetRef.current = { id: target.unitId, expires: performance.now() + 700 };
    if (action === "push") pushViewerHistory(nextMode, target);
    else if (action === "replace") updateDeepLink(nextMode, target, defaultMode);
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
    if (scrollViewerTarget(textPaneRef.current, target)) {
      if (pendingHistoryScrollRef.current !== null && textPaneRef.current) {
        textPaneRef.current.scrollTop = pendingHistoryScrollRef.current;
        pendingHistoryScrollRef.current = null;
      }
      if (sameViewerTarget(pendingSearchHighlightRef.current, target) && flashSearchTarget(target)) pendingSearchHighlightRef.current = null;
      return;
    }
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
  }, [dataBaseUrl, defaultMode, flashSearchTarget, indexes, manifest, mode, primaryRenderedPaths, pushViewerHistory, relations, revealSummary]);

  useEffect(() => {
    const onPopState = (event: PopStateEvent) => {
      const url = new URL(window.location.href);
      const target = targetFromUrl(url);
      if (!target) return;
      const entry = viewerHistoryEntry(event.state);
      if (entry?.session === historySessionRef.current) {
        const position = { index: entry.index, max: historyPositionRef.current.max };
        historyPositionRef.current = position;
        setHistoryPosition(position);
        pendingHistoryScrollRef.current = entry.scrollTop;
      } else {
        pendingHistoryScrollRef.current = null;
        historyPositionRef.current = { index: 0, max: 0 };
        setHistoryPosition({ index: 0, max: 0 });
      }
      const requestedMode = url.searchParams.get("mode");
      const nextMode = modeOptions.some((option) => option.id === requestedMode) ? requestedMode as ViewerMode : defaultMode;
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

  const clearReferencePreview = useCallback(() => {
    referencePreviewRequestRef.current += 1;
    setReferencePreview(null);
    touchReferenceRef.current = null;
  }, []);

  const showReferencePreview = useCallback((element: HTMLElement, interactive = false) => {
    const requestId = ++referencePreviewRequestRef.current;
    const bounds = element.getBoundingClientRect();
    const left = Math.max(12, Math.min(window.innerWidth - 332, bounds.left));
    const spaceBelow = Math.max(0, window.innerHeight - bounds.bottom - 19);
    const spaceAbove = Math.max(0, bounds.top - 19);
    const placement: "above" | "below" = spaceBelow >= spaceAbove ? "below" : "above";
    const maxHeight = Math.min(280, Math.max(48, placement === "below" ? spaceBelow : spaceAbove));
    const top = placement === "below" ? bounds.bottom + 7 : bounds.top - 7;
    const position = { left, top, placement, maxHeight };
    setReferencePreview({ label: element.textContent ?? "Riferimento", title: "", snippet: "", ...position, loading: true, interactive });
    void resolveReferenceElement(element).then((reference) => {
      if (requestId !== referencePreviewRequestRef.current) return;
      if (!reference) {
        element.dataset.scvReferenceResolved = "false";
        setReferencePreview({ label: element.textContent ?? "Riferimento", title: "Target non disponibile", snippet: "Il riferimento non è stato reso cliccabile perché non è risolto dall’indice derivato.", ...position, interactive, available: false });
        return;
      }
      element.dataset.scvReferenceResolved = "true";
      setReferencePreview({ label: referenceLabel(reference), title: reference.asset?.title || reference.unit.title, snippet: reference.asset?.snippet || reference.unit.snippet, ...position, interactive, available: true });
    }).catch(() => {
      if (requestId === referencePreviewRequestRef.current) setReferencePreview(null);
    });
  }, [resolveReferenceElement]);

  const activateReference = useCallback((element: HTMLElement) => {
    clearReferencePreview();
    void resolveReferenceElement(element).then((reference) => {
      if (!reference) return;
      return navigateViewerTarget(viewerTargetForReference(reference), "push");
    }).catch(() => {});
  }, [clearReferencePreview, navigateViewerTarget, resolveReferenceElement]);

  const showPermalinkNotice = useCallback((element: HTMLElement, message: string, status: PermalinkNotice["status"]) => {
    const bounds = element.getBoundingClientRect();
    const placement = bounds.top >= 54 ? "above" : "below";
    setPermalinkNotice({
      message,
      left: Math.max(116, Math.min(window.innerWidth - 116, bounds.left + bounds.width / 2)),
      top: placement === "above" ? bounds.top : bounds.bottom,
      placement,
      status,
    });
    if (permalinkNoticeTimerRef.current !== null) window.clearTimeout(permalinkNoticeTimerRef.current);
    permalinkNoticeTimerRef.current = window.setTimeout(() => {
      setPermalinkNotice(null);
      permalinkNoticeTimerRef.current = null;
    }, status === "success" ? 1800 : 2400);
  }, []);

  const copyTargetPermalink = useCallback((target: ViewerTarget, element: HTMLElement | null) => {
    const targetDocument = documentFromUnitId(target.unitId);
    const linkMode = mode === "combined" || documentForMode(mode) === targetDocument ? mode : targetDocument === "ntc2018" ? "ntc" : "circ";
    const permalink = urlForViewerTarget(window.location.href, linkMode, defaultMode, target).href;
    setCitationSelection(target);
    void writeTextClipboard(permalink)
      .then(() => { if (element) showPermalinkNotice(element, "Link copiato negli appunti", "success"); })
      .catch(() => { if (element) showPermalinkNotice(element, "Copia del link non disponibile", "error"); });
  }, [defaultMode, mode, showPermalinkNotice]);

  const copyElementPermalink = useCallback((element: HTMLElement) => {
    const citationElement = element.closest<HTMLElement>("[data-scv-citation-target]");
    const target = citationElement ? citationSelectionFromElement(citationElement) : null;
    if (target) copyTargetPermalink(target, element);
  }, [copyTargetPermalink]);

  const metadataForAnnotationTarget = useCallback((target: ViewerTarget): AnnotationTargetMetadata | null => {
    const summary = summaryById.get(target.unitId);
    if (!summary) return null;
    let officialAssetNumber: string | null | undefined;
    if (target.kind === "asset") {
      for (const loaded of loadedChunks.values()) {
        const asset = loaded.assets.formulas[target.assetId] ?? loaded.assets.tables[target.assetId] ?? loaded.assets.figures[target.assetId];
        if (asset) { officialAssetNumber = asset.officialNumber; break; }
      }
    }
    return { documentId: summary.document, numbering: summary.numbering.official, title: summary.title,
      automaticLabel: automaticAnnotationLabel(target, summary.numbering.official, summary.title, officialAssetNumber) };
  }, [loadedChunks, summaryById]);

  const showAnnotationMenu = useCallback((target: ViewerTarget, point: { x: number; y: number }) => {
    const metadata = metadataForAnnotationTarget(target);
    if (!metadata || !annotationStore) return false;
    setCitationSelection(target);
    setAnnotationEditor(null);
    setAnnotationMenu({ target, metadata, x: point.x, y: point.y, bookmark: annotationsForTarget(annotations, target, "bookmark")[0] });
    return true;
  }, [annotationStore, annotations, metadataForAnnotationTarget]);

  const handleDocumentContextMenu = useCallback((event: React.MouseEvent<HTMLElement>) => {
    const target = annotationTargetFromElement(event.target instanceof Element ? event.target : null);
    if (target && showAnnotationMenu(target, { x: event.clientX, y: event.clientY })) event.preventDefault();
  }, [showAnnotationMenu]);

  const handleDocumentKeyDown = useCallback((event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key !== "ContextMenu" && !(event.shiftKey && event.key === "F10")) return;
    const element = event.target instanceof Element ? event.target : null;
    const target = annotationTargetFromElement(element);
    const anchor = element?.closest<HTMLElement>("[data-scv-citation-target]")?.getBoundingClientRect();
    if (target && anchor && showAnnotationMenu(target, { x: anchor.left + Math.min(32, anchor.width / 2), y: anchor.top + Math.min(32, anchor.height / 2) })) event.preventDefault();
  }, [showAnnotationMenu]);

  const handleDocumentClick = useCallback((event: React.MouseEvent<HTMLElement>) => {
    if (suppressAnnotationClickRef.current) { suppressAnnotationClickRef.current = false; event.preventDefault(); event.stopPropagation(); return; }
    const permalinkElement = event.target instanceof Element ? event.target.closest<HTMLElement>("[data-scv-copy-link]") : null;
    if (permalinkElement) {
      event.preventDefault();
      copyElementPermalink(permalinkElement);
      return;
    }
    const element = event.target instanceof Element ? event.target.closest<HTMLElement>(".scv-cross-reference") : null;
    if (element) {
      if (lastPointerTypeRef.current === "touch" && touchReferenceRef.current !== element) {
        event.preventDefault();
        touchReferenceRef.current = element;
        showReferencePreview(element, true);
        return;
      }
      activateReference(element);
      return;
    }
    const citationElement = event.target instanceof Element ? event.target.closest<HTMLElement>("[data-scv-citation-target]") : null;
    if (citationElement) setCitationSelection(citationSelectionFromElement(citationElement));
  }, [activateReference, copyElementPermalink, showReferencePreview]);

  const handleDocumentPointerDown = useCallback((event: React.PointerEvent<HTMLElement>) => {
    lastPointerTypeRef.current = event.pointerType;
    longPressRef.current?.session.cancel();
    longPressRef.current = null;
    if (event.pointerType !== "touch" || !event.isPrimary || event.button !== 0 || !annotationStore) return;
    const element = event.target instanceof Element ? event.target : null;
    if (element?.closest(".scv-cross-reference, button, a, input, textarea, select")) return;
    const target = annotationTargetFromElement(element);
    if (!target) return;
    const session = createLongPressSession((point) => {
      if (showAnnotationMenu(target, point)) suppressAnnotationClickRef.current = true;
      longPressRef.current = null;
    });
    longPressRef.current = { pointerId: event.pointerId, session };
    session.start({ x: event.clientX, y: event.clientY });
  }, [annotationStore, showAnnotationMenu]);

  const handleDocumentPointerMove = useCallback((event: React.PointerEvent<HTMLElement>) => {
    const active = longPressRef.current;
    if (active?.pointerId === event.pointerId) active.session.move({ x: event.clientX, y: event.clientY });
  }, []);

  const cancelDocumentLongPress = useCallback((event: React.PointerEvent<HTMLElement>) => {
    const active = longPressRef.current;
    if (active?.pointerId !== event.pointerId) return;
    active.session.cancel(); longPressRef.current = null;
  }, []);

  const handleDocumentPointerOver = useCallback((event: React.PointerEvent<HTMLElement>) => {
    if (event.pointerType === "touch") return;
    const element = event.target instanceof Element ? event.target.closest<HTMLElement>(".scv-cross-reference") : null;
    if (element && !element.contains(event.relatedTarget as Node | null)) showReferencePreview(element);
  }, [showReferencePreview]);

  const handleDocumentPointerOut = useCallback((event: React.PointerEvent<HTMLElement>) => {
    if (event.pointerType === "touch" || referencePreview?.interactive) return;
    const element = event.target instanceof Element ? event.target.closest<HTMLElement>(".scv-cross-reference") : null;
    if (element && !element.contains(event.relatedTarget as Node | null) && document.activeElement !== element) clearReferencePreview();
  }, [clearReferencePreview, referencePreview?.interactive]);

  const handleDocumentFocus = useCallback((event: React.FocusEvent<HTMLElement>) => {
    const element = event.target instanceof Element ? event.target.closest<HTMLElement>(".scv-cross-reference") : null;
    if (element) showReferencePreview(element);
  }, [showReferencePreview]);

  const handleDocumentBlur = useCallback((event: React.FocusEvent<HTMLElement>) => {
    if (event.target instanceof Element && event.target.matches(".scv-cross-reference") && !referencePreview?.interactive) clearReferencePreview();
  }, [clearReferencePreview, referencePreview?.interactive]);

  const openPreviewReference = useCallback(() => {
    const element = touchReferenceRef.current;
    if (element) activateReference(element);
  }, [activateReference]);

  const selectScrollMarker = useCallback((unitId: string) => {
    const entry = navigationRef.current.entryById.get(unitId);
    if (entry) selectUnit(entry.summary);
  }, [selectUnit]);

  const activeSummary = lookup?.unitById.get(activeUnitId ?? "") ?? circLookup?.unitById.get(activeUnitId ?? "") ?? entryById.get(activeUnitId ?? "")?.summary ?? null;
  const contextSummary = activeSummary && baseNumbering(activeSummary.numbering.official).split(".").length > 3
    ? activeSummary.hierarchy.ancestorIds.map((id) => summaryById.get(id)).find((summary) => summary && baseNumbering(summary.numbering.official).split(".").length === 3) ?? null
    : activeSummary;
  const chapters = useMemo(() => navigationEntries.filter(({ level }) => level === 0), [navigationEntries]);
  const paragraphs = useMemo(() => navigationEntries.filter(({ level }) => level === 1), [navigationEntries]);
  const subparagraphs = useMemo(() => navigationEntries.filter(({ level }) => level === 2), [navigationEntries]);
  const hierarchy = useMemo(() => [chapters, paragraphs, subparagraphs], [chapters, paragraphs, subparagraphs]);
  const activeLevelIds = useMemo(() => {
    if (!activeSummary) return [null, null, null];
    const activeBaseParts = baseNumbering(activeSummary.numbering.official).split(".");
    return [chapters, paragraphs, subparagraphs].map((levelEntries, level) => {
      const baseNumber = activeBaseParts.slice(0, level + 1).join(".");
      return levelEntries.find((entry) => entry.baseNumber === baseNumber)?.summary.id ?? null;
    });
  }, [activeSummary, chapters, paragraphs, subparagraphs]);
  const scrubberEntries = useMemo(() => buildGlobalScrubberEntries(navigationEntries.map(({ summary, displayNumber, baseNumber, level }) => ({ id: summary.id, label: displayNumber, title: summary.title, baseNumber, level })), 2) as GlobalScrollEntry[], [navigationEntries]);
  const scrubberActiveId = resolveGlobalScrubberActiveId(scrubberEntries, activeUnitId, activeSummary ? baseNumbering(activeSummary.numbering.official) : null);
  const annotationRatios = useMemo(() => globalScrubberAnnotationRatios(navigationEntries.map(({ summary }) => ({ id: summary.id })), scrubberEntries) as Map<string, number>, [navigationEntries, scrubberEntries]);
  const annotationMarkers = useMemo(() => {
    const scrubberById = new Map(scrubberEntries.map((entry) => [entry.id, entry]));
    const ratioByBase = new Map(navigationEntries.map((entry) => [entry.baseNumber, annotationRatios.get(entry.summary.id)]));
    return annotations.flatMap((annotation): AnnotationMarker[] => {
      if (mode !== "combined" && annotation.documentId !== documentId) return [];
      let ratio = annotationRatios.get(annotation.target.unitId);
      const summary = summaryById.get(annotation.target.unitId);
      if (ratio === undefined && mode === "combined" && summary?.document === "circ2019") {
        const relatedId = relationTargets(summary.id, relations)[0]?.targetUnitId;
        ratio = relatedId ? annotationRatios.get(relatedId) : undefined;
      }
      const baseNumber = baseNumbering(summary?.numbering.official ?? annotation.numbering);
      if (ratio === undefined && mode === "combined" && annotation.documentId === "circ2019") ratio = ratioByBase.get(baseNumber);
      if (ratio === undefined && summary) {
        const ancestorId = resolveGlobalScrubberActiveId(scrubberEntries, summary.id, baseNumber);
        ratio = ancestorId ? scrubberById.get(ancestorId)?.ratio : undefined;
      }
      return ratio === undefined ? [] : [{ annotation, ratio }];
    });
  }, [annotationRatios, annotations, documentId, mode, navigationEntries, relations, scrubberEntries, summaryById]);

  const closeAuxiliary = useCallback(() => {
    scrollRequestRef.current = requestedTargetRef.current;
    setAuxiliaryVisible(false); auxiliaryButtonRef.current?.focus();
  }, []);
  const navigateFromAnnotation = useCallback((annotation: UserAnnotation) => {
    if (auxiliaryVisible && window.matchMedia("(max-width: 991.98px)").matches) closeAuxiliary();
    return navigateViewerTarget(annotation.target, "push");
  }, [auxiliaryVisible, closeAuxiliary, navigateViewerTarget]);
  const selectAnnotationMarker = useCallback((annotation: UserAnnotation, position?: AnnotationPosition) => {
    void navigateFromAnnotation(annotation).then(() => { if (annotation.type === "note") openAnnotation(annotation, position); }).catch(() => reportChunkLoadFailure());
  }, [navigateFromAnnotation, openAnnotation, reportChunkLoadFailure]);

  const activeRecord = recordById.get(activeUnitId ?? "") ?? null;
  const chunk = activeRecord?.chunk ?? null;
  const activePages = activeRecord ? evidencePages(activeRecord.unit, activeRecord.chunk) : [];
  const pageBounds = activePages.length > 0 ? { from: Math.min(...activePages), to: Math.max(...activePages) } : { from: 1, to: 1 };
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
    clearReferencePreview();
    setModeRevision((revision) => revision + 1);
    setMode(nextMode);
  }, [activeSummary, clearReferencePreview, mode]);

  const closeMobileIndex = useCallback(() => {
    setMobileIndexOpen(false);
    if (window.matchMedia("(max-width: 991.98px)").matches) window.requestAnimationFrame(() => mobileIndexButtonRef.current?.focus());
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const editing = (event.target instanceof HTMLElement && event.target.closest("input, textarea, select, [contenteditable='true']"))
        || window.document.activeElement?.closest("input, textarea, select, [contenteditable='true']");
      if (event.key === "/" && !editing) {
        event.preventDefault();
        if (window.matchMedia("(max-width: 1399.98px)").matches) setAuxiliaryVisible(false);
        const mobile = window.matchMedia("(max-width: 991.98px)").matches;
        if (mobile && mobileIndexOpen) closeMobileIndex();
        window.requestAnimationFrame(() => (mobile ? mobileSearchRef.current : searchRef.current)?.focus());
      }
      if (event.key === "Escape") {
        if (referencePreview?.interactive) clearReferencePreview();
        else if (mobileIndexOpen) closeMobileIndex();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [clearReferencePreview, closeMobileIndex, mobileIndexOpen, referencePreview?.interactive]);

  const selectSearchResult = useCallback((result: SearchResult) => {
    const target = viewerTargetForSearchResult(result);
    void navigateViewerTarget(target, "push").catch(() => reportChunkLoadFailure());
  }, [navigateViewerTarget, reportChunkLoadFailure]);

  const submitSearch = useCallback((event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (search.results[0]) selectSearchResult(search.results[0]);
  }, [search.results, selectSearchResult]);

  const primaryPathPositions = lookup?.chunkPaths.flatMap((path, position) => primaryRenderedPaths.has(path) ? [position] : []) ?? [];
  const hasPrevious = primaryPathPositions.length > 0 && Math.min(...primaryPathPositions) > 0;
  const hasNext = Boolean(lookup && primaryPathPositions.length > 0 && Math.max(...primaryPathPositions) < lookup.chunkPaths.length - 1);
  const documentLoading = !index || documentRecords.length === 0;
  const auxiliaryUnit = (citationSelection ? summaryById.get(citationSelection.unitId) : null) ?? activeSummary;
  const saveAnnotationEditor = useCallback(async (value: string) => {
    if (!annotationStore || !annotationEditor) return;
    setAnnotationBusy(true); setAnnotationError(null);
    try {
      const trimmed = value.trim();
      const saved = annotationEditor.annotation
        ? await annotationStore.updateAnnotation(annotationEditor.annotation.id, annotationEditor.type === "bookmark" ? { label: trimmed || annotationEditor.metadata.automaticLabel } : { text: trimmed })
        : await annotationStore.createAnnotation({ type: annotationEditor.type, target: annotationEditor.target, documentId: annotationEditor.metadata.documentId,
          numbering: annotationEditor.metadata.numbering, title: annotationEditor.metadata.title,
          ...(annotationEditor.type === "bookmark" ? { label: trimmed || annotationEditor.metadata.automaticLabel } : { text: trimmed }) });
      setAnnotations((current) => [...current.filter((annotation) => annotation.id !== saved.id && !(saved.type === "bookmark" && annotation.type === "bookmark" && annotationTargetKey(annotation.target) === annotationTargetKey(saved.target))), saved]);
      setAnnotationEditor(null);
    } catch (error) { setAnnotationError(error instanceof Error ? error.message : "Salvataggio non riuscito."); }
    finally { setAnnotationBusy(false); }
  }, [annotationEditor, annotationStore]);

  const removeAnnotation = useCallback(async (annotation: UserAnnotation) => {
    if (!annotationStore) return;
    setAnnotationBusy(true); setAnnotationError(null);
    try { await annotationStore.deleteAnnotation(annotation.id); setAnnotations((current) => current.filter((item) => item.id !== annotation.id)); setAnnotationEditor((current) => current?.annotation?.id === annotation.id ? null : current); }
    catch (error) { setAnnotationError(error instanceof Error ? error.message : "Eliminazione non riuscita."); }
    finally { setAnnotationBusy(false); }
  }, [annotationStore]);

  const annotationController = useMemo<AnnotationPanelController | undefined>(() => annotationStore ? {
    items: annotations, loading: annotationsLoading, error: annotationError, currentDocumentId: documentId, positionRanks: annotationRanks,
    navigate: (annotation) => { void navigateFromAnnotation(annotation).catch(() => reportChunkLoadFailure()); },
    edit: openAnnotation,
    remove: removeAnnotation,
    exportAnnotations: () => annotationStore.exportAnnotations(),
    importAnnotations: async (value) => { const result = await annotationStore.importAnnotations(value); setAnnotations(await annotationStore.listAnnotations()); setAnnotationError(null); return result; },
  } : undefined, [annotationError, annotationRanks, annotationStore, annotations, annotationsLoading, documentId, navigateFromAnnotation, openAnnotation, removeAnnotation, reportChunkLoadFailure]);
  const renderAuxiliary: ReactNode = !manifest || !auxiliaryAvailable ? null : <AuxiliaryContent panel={auxiliaryPanel} context={{ mode, documentId, manifest, chunk, pageBounds,
    currentUnit: auxiliaryUnit ? { documentId: auxiliaryUnit.document, unitId: auxiliaryUnit.id, numbering: auxiliaryUnit.numbering.official } : null,
    selectedTarget: citationSelection?.unitId === auxiliaryUnit?.id ? citationSelection : null,
    navigateTo: navigateViewerTarget,
    hrefForTarget: (target) => urlForViewerTarget(window.location.href, mode === "combined" || documentForMode(mode) === documentFromUnitId(target.unitId) ? mode : documentFromUnitId(target.unitId) === "ntc2018" ? "ntc" : "circ", defaultMode, target).href,
    close: closeAuxiliary,
    annotations: annotationController,
  }} />;

  if (loadError) return <main className="scv-fatal"><strong>Il corpus non è disponibile.</strong><span>Rigenera gli artefatti del viewer e ricarica la pagina.</span></main>;

  return <div className={`scv-root ${darkMode ? "scv-dark" : ""} ${auxiliaryAvailable ? "scv-auxiliary-available" : ""} ${auxiliaryVisible && auxiliaryAvailable ? "scv-has-auxiliary" : ""} ${auxiliaryEntered && auxiliaryAvailable ? "scv-auxiliary-entered" : ""} ${mobileIndexOpen ? "scv-mobile-index-open" : ""} ${className ?? ""}`} data-scv-mounted-chunks={primaryRenderedPaths.size} data-scv-loaded-related-chunks={mode === "combined" ? requiredCombinedCircPaths.size : 0} data-scv-search-index-requested={search.indexRequested} data-scv-cross-reference-index-requested={Boolean(crossReferenceIndex)} data-scv-search-error={search.errorMessage}>
    <NavigationPane id={navigationId} mode={mode} onModeChange={changeMode} hierarchy={hierarchy} activeLevelIds={activeLevelIds} sidebarMode={mobileIndexOpen} sidebarSession={mobileIndexSession} indexReady={Boolean(index)} query={query} onQueryChange={setQuery} searchReady={search.queryReady} searchStatus={search.status} searchSource={search.source} searchDurationMs={search.durationMs} searchResults={search.results} onSearchSubmit={submitSearch} onSearchResult={selectSearchResult} onSelectUnit={selectUnit} onRequestClose={closeMobileIndex} onHistoryBack={() => { saveHistoryScroll(); window.history.back(); }} onHistoryForward={() => { saveHistoryScroll(); window.history.forward(); }} canHistoryBack={historyPosition.index > 0} canHistoryForward={historyPosition.index < historyPosition.max} searchRef={searchRef} darkMode={Boolean(darkMode)} onToggleTheme={() => setDarkMode((current) => !current)} />
    <div className="scv-text-pane-shell">
      <button ref={mobileIndexButtonRef} type="button" className="scv-mobile-index-toggle" aria-controls={navigationId} aria-expanded={mobileIndexOpen} onClick={() => {
        setMobileIndexSession((session) => session + 1);
        setMobileIndexOpen(true);
        window.requestAnimationFrame(() => document.getElementById(navigationId)?.querySelector<HTMLButtonElement>(".scv-mode-button[aria-pressed='true']")?.focus({ preventScroll: true }));
      }}><HamburgerIcon /><span className="scv-visually-hidden">Apri indice</span></button>
      {contextSummary && <div className="scv-mobile-context" title={`${contextSummary.numbering.official} ${contextSummary.title}`} aria-label={`Unità attiva: ${contextSummary.numbering.official} ${contextSummary.title}`}><strong>{contextSummary.numbering.official}</strong><span>{contextSummary.title}</span></div>}
      <SearchBox className="scv-mobile-search" query={query} onQueryChange={setQuery} searchReady={search.queryReady} searchStatus={search.status} searchSource={search.source} searchDurationMs={search.durationMs} searchResults={search.results} onSearchSubmit={submitSearch} onSearchResult={selectSearchResult} onRequestClose={closeMobileIndex} searchRef={mobileSearchRef} />
      {auxiliaryAvailable && <button type="button" className="scv-tools-toggle" ref={auxiliaryButtonRef} disabled={!manifest} aria-controls={auxiliaryId} aria-expanded={auxiliaryVisible} onClick={() => {
        if (auxiliaryVisible) closeAuxiliary();
        else {
          scrollRequestRef.current = requestedTargetRef.current;
          setMobileIndexOpen(false);
          setAuxiliaryVisible(true);
          window.requestAnimationFrame(() => {
            auxiliaryPaneRef.current?.querySelector<HTMLButtonElement>("button")?.focus({ preventScroll: true });
          });
        }
      }} aria-label={`Apri ${auxiliaryPanelLabel}`}><DashboardIcon /><span className="scv-visually-hidden">{auxiliaryPanelButtonText}</span></button>}
      {contentLoadNotice && <p className="scv-content-notice" role="status">{contentLoadNotice}</p>}
      <article ref={textPaneRef} className="scv-text-pane" aria-label="Corpus JSON" onClick={handleDocumentClick} onContextMenu={handleDocumentContextMenu} onKeyDown={handleDocumentKeyDown} onPointerDown={handleDocumentPointerDown} onPointerMove={handleDocumentPointerMove} onPointerUp={cancelDocumentLongPress} onPointerCancel={cancelDocumentLongPress} onPointerOver={handleDocumentPointerOver} onPointerOut={handleDocumentPointerOut} onFocus={handleDocumentFocus} onBlur={handleDocumentBlur}>
        {documentLoading || !index || !lookup || !readingSummary ? <LoadingPanel label="Caricamento del documento…" /> : <DocumentContent records={renderRecords} relatedByTarget={relatedByTarget} mode={mode} assetsBaseUrl={assetsBaseUrl} documentLabel={readingSummary.label} documentUnits={readingSummary.units} documentChunks={readingSummary.chunks} hasPrevious={hasPrevious} hasNext={hasNext} notesByTarget={notesByTarget} onOpenAnnotation={openAnnotation} />}
      </article>
      <GlobalDocumentScrubber rootRef={textPaneRef} entries={scrubberEntries} activeId={scrubberActiveId} onSelect={selectScrollMarker} annotationMarkers={annotationMarkers} onAnnotationSelect={selectAnnotationMarker} />
    </div>
    <ReferencePreview preview={referencePreview} onOpen={openPreviewReference} onClose={clearReferencePreview} />
    {permalinkNotice && <span className={`scv-permalink-notice is-${permalinkNotice.placement} is-${permalinkNotice.status}`} style={{ left: permalinkNotice.left, top: permalinkNotice.top }} role="status">{permalinkNotice.message}</span>}
    {annotationMenu && <AnnotationContextMenu state={annotationMenu} darkMode={Boolean(darkMode)} onCopyLink={(target) => copyTargetPermalink(target, findViewerTarget(textPaneRef.current, target))} onClose={() => setAnnotationMenu(null)} onBookmark={() => { setAnnotationEditor({ type: "bookmark", target: annotationMenu.target, metadata: annotationMenu.metadata, annotation: annotationMenu.bookmark, x: annotationMenu.x, y: annotationMenu.y }); setAnnotationMenu(null); }} onNote={() => { setAnnotationEditor({ type: "note", target: annotationMenu.target, metadata: annotationMenu.metadata, x: annotationMenu.x, y: annotationMenu.y }); setAnnotationMenu(null); }} />}
    {annotationEditor && <AnnotationEditor state={annotationEditor} busy={annotationBusy} error={annotationError} onSave={(value) => void saveAnnotationEditor(value)} onDelete={annotationEditor.annotation ? () => void removeAnnotation(annotationEditor.annotation!) : null} onClose={() => { setAnnotationEditor(null); setAnnotationError(null); }} />}
    {auxiliaryMounted && auxiliaryAvailable && renderAuxiliary && <aside ref={auxiliaryPaneRef} id={auxiliaryId} inert={!auxiliaryVisible ? true : undefined} aria-hidden={!auxiliaryVisible} className="scv-auxiliary-pane" aria-label={auxiliaryPanelLabel}>{renderAuxiliary}</aside>}
  </div>;
}

function LoadingRows() {
  return <div className="scv-loading-rows" aria-label="Caricamento">{Array.from({ length: 7 }, (_, index) => <span key={index} />)}</div>;
}

function LoadingPanel({ label }: { label: string }) {
  return <div className="scv-loading"><span /><strong>{label}</strong></div>;
}

export { modeOptions };
