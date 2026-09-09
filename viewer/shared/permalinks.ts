import type { ViewerMode } from "./corpusData";

export type ViewerTarget =
  | { kind: "unit"; unitId: string }
  | { kind: "block"; unitId: string; blockId: string }
  | { kind: "asset"; unitId: string; assetId: string; assetKind?: "formula" | "table" | "figure" };

export function targetFromUrl(url: URL): ViewerTarget | null {
  const unitId = url.searchParams.get("unit");
  if (!unitId) return null;
  const assetId = url.searchParams.get("asset");
  if (assetId) {
    const kind = url.searchParams.get("assetKind");
    const assetKind = kind === "formula" || kind === "table" || kind === "figure" ? kind : undefined;
    return { kind: "asset", unitId, assetId, assetKind };
  }
  const blockId = url.searchParams.get("block");
  return blockId ? { kind: "block", unitId, blockId } : { kind: "unit", unitId };
}

export function urlForViewerTarget(currentUrl: string | URL, mode: ViewerMode, defaultMode: ViewerMode, target: ViewerTarget) {
  const url = new URL(currentUrl);
  if (mode === defaultMode) url.searchParams.delete("mode");
  else url.searchParams.set("mode", mode);
  url.searchParams.set("unit", target.unitId);
  url.searchParams.delete("block");
  url.searchParams.delete("asset");
  url.searchParams.delete("assetKind");
  if (target.kind === "block") url.searchParams.set("block", target.blockId);
  if (target.kind === "asset") {
    url.searchParams.set("asset", target.assetId);
    if (target.assetKind) url.searchParams.set("assetKind", target.assetKind);
  }
  return url;
}

export function citationForTarget({ documentLabel, unitNumber, targetLabel, permalink }: { documentLabel: string; unitNumber: string; targetLabel?: string | null; permalink: string }) {
  return `${documentLabel}, § ${unitNumber}${targetLabel ? `, ${targetLabel}` : ""} — ${permalink}`;
}
