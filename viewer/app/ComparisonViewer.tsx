"use client";

import { useMemo } from "react";
import { NormativeViewer, type AuxiliaryPanelContext } from "../shared/NormativeViewer";
import { IndexedDbAnnotationStore } from "../shared/annotations/indexedDb";
import { ViewerToolsDock } from "./ViewerToolsDock";

const localPdfEnabled =
  process.env.NODE_ENV !== "production" || process.env.NEXT_PUBLIC_VIEWER_DEBUG_PDF === "true";

export function ComparisonViewer() {
  const annotationStore = useMemo(() => new IndexedDbAnnotationStore(), []);
  return <NormativeViewer
    defaultMode="combined"
    auxiliaryPanel={(context: AuxiliaryPanelContext) => <ViewerToolsDock context={context} pdfEnabled={localPdfEnabled} />}
    auxiliaryPanelLabel="Note e strumenti"
    auxiliaryPanelButtonText="Note"
    auxiliaryPanelModes={["ntc", "circ", "combined"]}
    auxiliaryPanelDefaultVisible={false}
    auxiliaryPanelDesktopDefaultVisible={false}
    annotationStore={annotationStore}
  />;
}
