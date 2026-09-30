"use client";

import { useId, useState, type KeyboardEvent } from "react";
import type { AuxiliaryPanelContext } from "../shared/NormativeViewer";
import { OfficialPdfPanel } from "./OfficialPdfPanel";
import { AnnotationsPanel } from "../shared/annotations/AnnotationUi";
import { CloseIcon, ScriptIcon, StarIcon } from "../shared/UiIcons";

export function ViewerToolsDock({ context, pdfEnabled }: {
  context: AuxiliaryPanelContext;
  pdfEnabled: boolean;
}) {
  const id = useId();
  const tabs = [
    ...(context.annotations ? [{ id: "annotations", label: "Annotazioni" }] : []),
    ...(pdfEnabled ? [{ id: "pdf", label: "PDF ufficiale" }] : []),
  ];
  const [selected, setSelected] = useState("annotations");
  const active = tabs.some((tab) => tab.id === selected) ? selected : tabs[0]?.id;
  function tabKey(event: KeyboardEvent<HTMLButtonElement>, position: number) {
    let next = position;
    if (event.key === "ArrowRight") next = (position + 1) % tabs.length;
    else if (event.key === "ArrowLeft") next = (position + tabs.length - 1) % tabs.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = tabs.length - 1;
    else return;
    event.preventDefault();
    setSelected(tabs[next].id);
    event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
  }
  if (!tabs.length) return null;
  return <div className="scv-tools-dock">
    <header className="scv-tools-header"><div className="scv-tools-tabs" role="tablist" aria-label="Strumenti normativi">{tabs.map((tab, index) => <button className="scv-tools-tab" type="button" key={tab.id} id={`${id}-${tab.id}-tab`} role="tab" aria-controls={`${id}-${tab.id}-panel`} aria-selected={active === tab.id} tabIndex={active === tab.id ? 0 : -1} onClick={() => setSelected(tab.id)} onKeyDown={(event) => tabKey(event, index)}>{tab.id === "annotations" ? <StarIcon /> : <ScriptIcon />}{tab.label}</button>)}</div><button className="scv-tools-close" type="button" aria-label="Chiudi strumenti" onClick={context.close}><CloseIcon className="scv-tools-close-icon" /></button></header>
    {context.annotations && <div id={`${id}-annotations-panel`} role="tabpanel" aria-labelledby={`${id}-annotations-tab`} hidden={active !== "annotations"} className="scv-tool-content"><AnnotationsPanel controller={context.annotations} /></div>}
    {pdfEnabled && <div id={`${id}-pdf-panel`} role="tabpanel" aria-labelledby={`${id}-pdf-tab`} hidden={active !== "pdf"} className="scv-tool-content"><OfficialPdfPanel key={context.documentId} context={context} /></div>}
  </div>;
}
