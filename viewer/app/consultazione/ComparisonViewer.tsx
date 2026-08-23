"use client";

import { NormativeViewer, type AuxiliaryPanelContext } from "../../shared/NormativeViewer";
import { OfficialPdfPanel } from "./OfficialPdfPanel";

export function ComparisonViewer() {
  return <NormativeViewer
    defaultMode="combined"
    auxiliaryPanelDefaultVisible
    auxiliaryPanel={(context: AuxiliaryPanelContext) => <OfficialPdfPanel key={context.documentId} context={context} />}
    analyticalHref={(mode, unitId) => `/?mode=${mode}${unitId ? `&unit=${encodeURIComponent(unitId)}` : ""}`}
  />;
}
