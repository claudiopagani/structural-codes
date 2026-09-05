"use client";

import { NormativeViewer, type AuxiliaryPanelContext } from "../shared/NormativeViewer";
import { OfficialPdfPanel } from "./OfficialPdfPanel";

const localPdfEnabled =
  process.env.NODE_ENV !== "production" || process.env.NEXT_PUBLIC_VIEWER_DEBUG_PDF === "true";

export function ComparisonViewer() {
  return <NormativeViewer
    defaultMode="combined"
    auxiliaryPanel={localPdfEnabled ? ((context: AuxiliaryPanelContext) => <OfficialPdfPanel key={context.documentId} context={context} />) : undefined}
    auxiliaryPanelDefaultVisible={localPdfEnabled}
  />;
}
