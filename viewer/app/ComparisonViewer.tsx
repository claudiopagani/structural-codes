"use client";

import { NormativeViewer, type AuxiliaryPanelContext } from "../shared/NormativeViewer";
import { useEffect, useMemo, useState } from "react";
import { ViewerToolsDock } from "./ViewerToolsDock";
import { LocalChatTransport } from "./chatntc/LocalChatTransport";
import { IndexedDbChatHistoryStore } from "../shared/chatntc-history/indexedDb";
import { LocalAIConfiguration, isLoopback } from "./chatntc/LocalAIConfiguration";
import { AISettings } from "./chatntc/AISettings";

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
  const hasTools = enabled || localPdfEnabled;
  return <NormativeViewer
    defaultMode="combined"
    auxiliaryPanel={hasTools ? ((context: AuxiliaryPanelContext) => <ViewerToolsDock context={context} chatTransport={transport} chatHistoryStore={historyStore} chatSettings={<AISettings configuration={configuration} />} pdfEnabled={localPdfEnabled} />) : undefined}
    auxiliaryPanelLabel={enabled ? "ChatNTC e strumenti" : "PDF ufficiale"}
    auxiliaryPanelModes={enabled ? ["ntc", "circ", "combined"] : undefined}
    auxiliaryPanelKeepMounted={enabled}
    auxiliaryPanelDefaultVisible={localPdfEnabled}
  />;
}
