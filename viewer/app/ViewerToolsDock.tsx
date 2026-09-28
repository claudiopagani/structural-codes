"use client";

import { useId, useState, type KeyboardEvent, type ReactNode } from "react";
import type { AuxiliaryPanelContext } from "../shared/NormativeViewer";
import { ChatNTCPanel } from "../shared/chatntc-ui/ChatNTCPanel";
import { ChatNTCHistoryPanel } from "../shared/chatntc-ui/ChatNTCHistoryPanel";
import { CloseIcon } from "../shared/chatntc-ui/ChatNTCIcons";
import type { ChatHistoryStore } from "../shared/chatntc-history/types";
import type { ChatTransport } from "../shared/chatntc-ui/transport";
import { OfficialPdfPanel } from "./OfficialPdfPanel";
import { AnnotationsPanel } from "../shared/annotations/AnnotationUi";

export function ViewerToolsDock({ context, chatTransport, chatHistoryStore, pdfEnabled, chatSettings }: {
  context: AuxiliaryPanelContext; chatTransport?: ChatTransport; chatHistoryStore?: ChatHistoryStore; pdfEnabled: boolean;
  chatSettings?: ReactNode;
}) {
  const id = useId();
  const tabs = [...(chatTransport ? [{ id: "chat", label: "ChatNTC" }] : []), ...(context.annotations ? [{ id: "annotations", label: "Note" }] : []), ...(pdfEnabled ? [{ id: "pdf", label: "PDF ufficiale" }] : [])];
  const [selected, setSelected] = useState(chatTransport ? "chat" : context.annotations ? "annotations" : "pdf");
  const active = tabs.some((tab) => tab.id === selected) ? selected : tabs[0]?.id;
  function tabKey(event: KeyboardEvent<HTMLButtonElement>, position: number) {
    let next = position;
    if (event.key === "ArrowRight") next = (position + 1) % tabs.length;
    else if (event.key === "ArrowLeft") next = (position + tabs.length - 1) % tabs.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = tabs.length - 1;
    else return;
    event.preventDefault(); setSelected(tabs[next].id);
    event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
  }
  if (!tabs.length) return null;
  const chatPanelProps = chatTransport ? { currentCorpusFingerprint: context.manifest.corpusFingerprintSha256, transport: chatTransport, context: context.currentUnit ? {
    documentId: context.currentUnit.documentId, unitId: context.currentUnit.unitId, numbering: context.currentUnit.numbering,
    ...(context.selectedTarget?.kind === "block" ? { blockId: context.selectedTarget.blockId } : {}),
    ...(context.selectedTarget?.kind === "asset" ? { assetId: context.selectedTarget.assetId } : {}),
  } : null, onNavigate: (target: Parameters<NonNullable<typeof context.navigateTo>>[0]) => context.navigateTo?.(target),
  hrefForTarget: (target: Parameters<NonNullable<typeof context.hrefForTarget>>[0]) => context.hrefForTarget?.(target) ?? "#" } : null;
  return <div className="scv-tools-dock">
    <header className="scv-tools-header"><div role="tablist" aria-label="Strumenti normativi">{tabs.map((tab, index) => <button type="button" key={tab.id} id={`${id}-${tab.id}-tab`} role="tab" aria-controls={`${id}-${tab.id}-panel`} aria-selected={active === tab.id} tabIndex={active === tab.id ? 0 : -1} onClick={() => setSelected(tab.id)} onKeyDown={(event) => tabKey(event, index)}>{tab.label}</button>)}</div><button className="scv-tools-close" type="button" aria-label="Chiudi strumenti" onClick={context.close}><CloseIcon /></button></header>
    {chatPanelProps && <div id={`${id}-chat-panel`} role="tabpanel" aria-labelledby={`${id}-chat-tab`} hidden={active !== "chat"} className="scv-tool-content">{chatHistoryStore
      ? <ChatNTCHistoryPanel {...chatPanelProps} historyStore={chatHistoryStore} settings={chatSettings} />
      : <ChatNTCPanel {...chatPanelProps} />}</div>}
    {context.annotations && <div id={`${id}-annotations-panel`} role="tabpanel" aria-labelledby={`${id}-annotations-tab`} hidden={active !== "annotations"} className="scv-tool-content"><AnnotationsPanel controller={context.annotations} /></div>}
    {pdfEnabled && <div id={`${id}-pdf-panel`} role="tabpanel" aria-labelledby={`${id}-pdf-tab`} hidden={active !== "pdf"} className="scv-tool-content"><OfficialPdfPanel key={context.documentId} context={context} /></div>}
  </div>;
}
