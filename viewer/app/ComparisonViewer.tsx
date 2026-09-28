"use client";

import { NormativeViewer, type AuxiliaryPanelContext } from "../shared/NormativeViewer";
import { useEffect, useMemo, useState } from "react";
import { ViewerToolsDock } from "./ViewerToolsDock";
import { LocalChatTransport } from "./chatntc/LocalChatTransport";
import { IndexedDbChatHistoryStore } from "../shared/chatntc-history/indexedDb";
import { LocalAIConfiguration, isLoopback } from "./chatntc/LocalAIConfiguration";
import { AISettings } from "./chatntc/AISettings";
import { IndexedDbAnnotationStore } from "../shared/annotations/indexedDb";

const localPdfEnabled =
  process.env.NODE_ENV !== "production" || process.env.NEXT_PUBLIC_VIEWER_DEBUG_PDF === "true";

export function ComparisonViewer({ chatEnabled = false }: { chatEnabled?: boolean }) {
  const [local, setLocal] = useState(false);
  const configuration = useMemo(() => new LocalAIConfiguration(), []);
  useEffect(() => {
    if (!chatEnabled || !isLoopback(window.location.hostname)) return;
    try { configuration.restore(window.localStorage); } catch { /* Optional preferences. */ }
    // One hydration pass is required: the server cannot know the browser's loopback origin or preferences.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLocal(true);
    return () => configuration.clearKey();
  }, [chatEnabled, configuration]);
  const enabled = chatEnabled && local;
  const transport = useMemo(() => enabled ? new LocalChatTransport(fetch, configuration) : undefined, [enabled, configuration]);
  const historyStore = useMemo(() => chatEnabled ? new IndexedDbChatHistoryStore() : undefined, [chatEnabled]);
  const annotationStore = useMemo(() => new IndexedDbAnnotationStore(), []);
  const hasTools = true;
  return <NormativeViewer
    defaultMode="combined"
    auxiliaryPanel={hasTools ? ((context: AuxiliaryPanelContext) => <ViewerToolsDock context={context} chatTransport={transport} chatHistoryStore={historyStore} chatSettings={<AISettings configuration={configuration} embedded />} pdfEnabled={localPdfEnabled} />) : undefined}
    auxiliaryPanelLabel={enabled ? "ChatNTC e strumenti" : "Note e strumenti"}
    auxiliaryPanelButtonText={enabled ? "AI" : "Note"}
    auxiliaryPanelModes={["ntc", "circ", "combined"]}
    auxiliaryPanelKeepMounted={enabled}
    auxiliaryPanelDefaultVisible={false}
    auxiliaryPanelDesktopDefaultVisible={enabled}
    annotationStore={annotationStore}
  />;
}
