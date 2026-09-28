import type { UnitSummary } from "../corpusData.js";
import type { ViewerTarget } from "../permalinks.js";
import type { UserAnnotation } from "./types.js";
import { annotationTargetKey } from "./schema.js";

export interface AnnotationMarker {
  annotation: UserAnnotation;
  ratio: number;
}

export interface AnnotationMarkerCluster {
  ratio: number;
  markers: AnnotationMarker[];
}

export function annotationTargetFromElement(element: Element | null): ViewerTarget | null {
  const candidate = element?.closest<HTMLElement>("[data-scv-citation-target]");
  if (!candidate) return null;
  const unitId = candidate.dataset.scvSourceUnitId;
  if (!unitId) return null;
  if (candidate.dataset.scvAssetId) {
    const assetKind = candidate.dataset.scvAssetKind;
    return { kind: "asset", unitId, assetId: candidate.dataset.scvAssetId,
      ...(assetKind === "formula" || assetKind === "table" || assetKind === "figure" ? { assetKind } : {}) };
  }
  if (candidate.dataset.scvBlockId) return { kind: "block", unitId, blockId: candidate.dataset.scvBlockId };
  return { kind: "unit", unitId };
}

export function automaticAnnotationLabel(target: ViewerTarget, numbering: string, title: string, officialAssetNumber?: string | null): string {
  if (target.kind === "asset") {
    const number = officialAssetNumber || numbering;
    if (target.assetKind === "formula") return `Formula [${number}]`;
    if (target.assetKind === "table") return `Tab. ${number}`;
    if (target.assetKind === "figure") return `Fig. ${number}`;
  }
  return `§ ${numbering}${title ? ` — ${title}` : ""}`;
}

export function annotationsForTarget(annotations: UserAnnotation[], target: ViewerTarget, type?: UserAnnotation["type"]): UserAnnotation[] {
  const key = annotationTargetKey(target);
  return annotations.filter((annotation) => (!type || annotation.type === type) && annotationTargetKey(annotation.target) === key);
}

export function annotationPositionRanks(indexes: Iterable<{ document: "ntc2018" | "circ2019"; units: UnitSummary[] }>): Map<string, number> {
  const documents = [...indexes].sort((left, right) => (left.document === right.document ? 0 : left.document === "ntc2018" ? -1 : 1));
  const ranks = new Map<string, number>();
  let rank = 0;
  for (const document of documents) {
    for (const unit of [...document.units].sort((left, right) => left.numbering.sortKey.localeCompare(right.numbering.sortKey, "it", { numeric: true }))) ranks.set(unit.id, rank++);
  }
  return ranks;
}

export function sortAnnotations(annotations: UserAnnotation[], order: "position" | "recent" | "oldest", ranks = new Map<string, number>()): UserAnnotation[] {
  return [...annotations].sort((left, right) => {
    if (order === "recent") return right.updatedAt.localeCompare(left.updatedAt) || left.id.localeCompare(right.id);
    if (order === "oldest") return left.updatedAt.localeCompare(right.updatedAt) || left.id.localeCompare(right.id);
    const rank = (ranks.get(left.target.unitId) ?? Number.MAX_SAFE_INTEGER) - (ranks.get(right.target.unitId) ?? Number.MAX_SAFE_INTEGER);
    return rank || annotationTargetKey(left.target).localeCompare(annotationTargetKey(right.target), "it", { numeric: true }) || left.createdAt.localeCompare(right.createdAt);
  });
}

export function clusterAnnotationMarkers(markers: AnnotationMarker[], thresholdRatio = 0.012): AnnotationMarkerCluster[] {
  const sorted = [...markers].sort((left, right) => left.ratio - right.ratio || left.annotation.id.localeCompare(right.annotation.id));
  const clusters: AnnotationMarkerCluster[] = [];
  for (const marker of sorted) {
    const previous = clusters.at(-1);
    if (previous && marker.ratio - previous.ratio <= thresholdRatio) {
      previous.markers.push(marker);
      previous.ratio = previous.markers.reduce((sum, item) => sum + item.ratio, 0) / previous.markers.length;
    } else clusters.push({ ratio: marker.ratio, markers: [marker] });
  }
  return clusters.flatMap((cluster) => cluster.markers.length === 2 && new Set(cluster.markers.map(({ annotation }) => annotation.type)).size === 2
    ? cluster.markers.map((marker) => ({ ratio: marker.ratio, markers: [marker] }))
    : [cluster]);
}

export function createLongPressSession(onLongPress: (point: { x: number; y: number }) => void, options: { delay?: number; movement?: number; setTimer?: typeof setTimeout; clearTimer?: typeof clearTimeout } = {}) {
  const delay = options.delay ?? 550;
  const movement = options.movement ?? 10;
  const setTimer = options.setTimer ?? setTimeout;
  const clearTimer = options.clearTimer ?? clearTimeout;
  let start: { x: number; y: number } | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const cancel = () => { if (timer !== null) clearTimer(timer); timer = null; start = null; };
  return {
    start(point: { x: number; y: number }) {
      cancel(); start = point;
      timer = setTimer(() => { const active = start; cancel(); if (active) onLongPress(active); }, delay);
    },
    move(point: { x: number; y: number }) {
      if (start && Math.hypot(point.x - start.x, point.y - start.y) > movement) cancel();
    },
    cancel,
  };
}
