"use client";

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from "react";
import type { DocumentId } from "../corpusData.js";
import type { ViewerTarget } from "../permalinks.js";
import { sortAnnotations } from "./annotationTargets.js";
import type { AnnotationExport, AnnotationImportResult, AnnotationType, UserAnnotation } from "./types.js";

export interface AnnotationTargetMetadata {
  documentId: DocumentId;
  numbering: string;
  title: string;
  automaticLabel: string;
}

export interface AnnotationMenuState {
  target: ViewerTarget;
  metadata: AnnotationTargetMetadata;
  x: number;
  y: number;
  bookmark?: UserAnnotation;
}

export interface AnnotationEditorState {
  type: AnnotationType;
  target: ViewerTarget;
  metadata: AnnotationTargetMetadata;
  annotation?: UserAnnotation;
  x?: number;
  y?: number;
}

export function AnnotationContextMenu({ state, onBookmark, onNote, onClose }: {
  state: AnnotationMenuState;
  onBookmark: () => void;
  onNote: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ left: state.x, top: state.y });
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const bounds = element.getBoundingClientRect();
    setPosition({ left: Math.max(8, Math.min(state.x, window.innerWidth - bounds.width - 8)), top: Math.max(8, Math.min(state.y, window.innerHeight - bounds.height - 8)) });
    element.querySelector<HTMLButtonElement>("button")?.focus({ preventScroll: true });
  }, [state.x, state.y]);
  useEffect(() => {
    const pointer = (event: PointerEvent) => { if (!ref.current?.contains(event.target as Node)) onClose(); };
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); onClose(); }
      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
      event.preventDefault();
      const buttons = [...(ref.current?.querySelectorAll<HTMLButtonElement>("button") ?? [])];
      const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
      buttons[(index + (event.key === "ArrowDown" ? 1 : -1) + buttons.length) % buttons.length]?.focus();
    };
    document.addEventListener("pointerdown", pointer, true);
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("pointerdown", pointer, true); document.removeEventListener("keydown", key); };
  }, [onClose]);
  return <div ref={ref} className="scv-annotation-menu" role="menu" aria-label="Azioni annotazione" style={{ left: position.left, top: position.top }}>
    <button type="button" role="menuitem" onClick={onBookmark}>{state.bookmark ? "Modifica segnalibro" : "Aggiungi segnalibro"}</button>
    <button type="button" role="menuitem" onClick={onNote}>Aggiungi nota</button>
  </div>;
}

export function AnnotationEditor({ state, busy, error, onSave, onDelete, onClose }: {
  state: AnnotationEditorState;
  busy: boolean;
  error: string | null;
  onSave: (value: string) => void;
  onDelete: (() => void) | null;
  onClose: () => void;
}) {
  const titleId = useId();
  const fieldId = useId();
  const fieldRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const [value, setValue] = useState(state.type === "bookmark" ? state.annotation?.label ?? state.metadata.automaticLabel : state.annotation?.text ?? "");
  useEffect(() => { fieldRef.current?.focus({ preventScroll: true }); }, []);
  useEffect(() => {
    const key = (event: KeyboardEvent) => { if (event.key === "Escape") { event.preventDefault(); onClose(); } };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [onClose]);
  const submit = (event: FormEvent) => { event.preventDefault(); onSave(value); };
  const style = { "--scv-annotation-editor-x": `${state.x ?? window.innerWidth - 32}px`, "--scv-annotation-editor-y": `${state.y ?? 112}px` } as CSSProperties;
  return <div className="scv-annotation-editor" role="dialog" aria-modal="true" aria-labelledby={titleId} style={style}>
    <form onSubmit={submit}>
      <header><div><strong id={titleId}>{state.type === "bookmark" ? (state.annotation ? "Modifica segnalibro" : "Nuovo segnalibro") : (state.annotation ? "Modifica nota" : "Nuova nota")}</strong><span>§ {state.metadata.numbering} — {state.metadata.title}</span></div><button type="button" className="scv-annotation-close" aria-label="Chiudi editor" onClick={onClose}>×</button></header>
      <label htmlFor={fieldId}>{state.type === "bookmark" ? "Descrizione" : "Nota"}</label>
      {state.type === "bookmark"
        ? <input ref={fieldRef as React.RefObject<HTMLInputElement>} id={fieldId} value={value} maxLength={500} placeholder={state.metadata.automaticLabel} onChange={(event) => setValue(event.target.value)} />
        : <textarea ref={fieldRef as React.RefObject<HTMLTextAreaElement>} id={fieldId} value={value} maxLength={100000} rows={6} onChange={(event) => setValue(event.target.value)} />}
      {error && <p className="scv-annotation-error" role="alert">{error}</p>}
      <footer>{onDelete && <button type="button" className="is-danger" disabled={busy} onClick={onDelete}>Elimina</button>}<span /><button type="button" disabled={busy} onClick={onClose}>Chiudi</button><button type="submit" className="is-primary" disabled={busy || (state.type === "note" && !value.trim())}>Salva</button></footer>
    </form>
  </div>;
}

export function AnnotationMarginMarker({ notes, onOpen }: { notes: UserAnnotation[]; onOpen: (annotation: UserAnnotation) => void }) {
  if (notes.length === 0) return null;
  return <button type="button" className="scv-note-margin-marker" aria-label={notes.length === 1 ? "Apri nota" : `Apri ${notes.length} note`} title={notes.length === 1 ? "Nota" : `${notes.length} note`} onClick={(event) => { event.stopPropagation(); onOpen(notes[0]); }}><span aria-hidden="true" />{notes.length > 1 && <b>{notes.length}</b>}</button>;
}

export interface AnnotationPanelController {
  items: UserAnnotation[];
  loading: boolean;
  error: string | null;
  currentDocumentId: DocumentId;
  positionRanks: Map<string, number>;
  navigate(annotation: UserAnnotation): void;
  edit(annotation: UserAnnotation): void;
  remove(annotation: UserAnnotation): Promise<void>;
  exportAnnotations(): Promise<AnnotationExport>;
  importAnnotations(value: unknown): Promise<AnnotationImportResult>;
}

function annotationHeading(annotation: UserAnnotation) {
  if (annotation.target.kind !== "asset") return `§ ${annotation.numbering}`;
  const prefix = annotation.target.assetKind === "formula" ? "Formula" : annotation.target.assetKind === "table" ? "Tab." : annotation.target.assetKind === "figure" ? "Fig." : "Asset";
  if (annotation.type === "bookmark" && annotation.label) return annotation.label;
  return `${prefix} · § ${annotation.numbering}`;
}

export function AnnotationsPanel({ controller }: { controller: AnnotationPanelController }) {
  const id = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<AnnotationType>("note");
  const [order, setOrder] = useState<"position" | "recent" | "oldest">("position");
  const [currentOnly, setCurrentOnly] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const items = useMemo(() => sortAnnotations(controller.items.filter((annotation) => annotation.type === tab && (!currentOnly || annotation.documentId === controller.currentDocumentId)), order, controller.positionRanks), [controller.currentDocumentId, controller.items, controller.positionRanks, currentOnly, order, tab]);
  const exportFile = async () => {
    try {
      const payload = await controller.exportAnnotations();
      const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }));
      const anchor = document.createElement("a"); anchor.href = url; anchor.download = `structural-codes-annotations-${new Date().toISOString().slice(0, 10)}.json`; anchor.click();
      URL.revokeObjectURL(url); setNotice("Esportazione completata.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Esportazione non riuscita."); }
  };
  const importFile = async (file?: File) => {
    if (!file) return;
    try {
      const result = await controller.importAnnotations(JSON.parse(await file.text()));
      setNotice(`${result.imported} importate · ${result.ignored} ignorate`);
    } catch (error) { setNotice(error instanceof Error ? error.message : "File di importazione non valido."); }
    finally { if (fileRef.current) fileRef.current.value = ""; }
  };
  return <section className="scv-annotations-panel" aria-label="Note e segnalibri">
    <div className="scv-annotations-tabs" role="tablist" aria-label="Tipo annotazione">
      {(["note", "bookmark"] as const).map((type) => <button type="button" role="tab" id={`${id}-${type}-tab`} aria-controls={`${id}-list`} aria-selected={tab === type} tabIndex={tab === type ? 0 : -1} key={type} onClick={() => setTab(type)}>{type === "note" ? "Note" : "Segnalibri"}</button>)}
    </div>
    <div className="scv-annotations-controls">
      <label>Ordina per:<select value={order} onChange={(event) => setOrder(event.target.value as typeof order)}><option value="position">Posizione</option><option value="recent">Più recenti</option><option value="oldest">Meno recenti</option></select></label>
      <label className="scv-annotations-filter"><input type="checkbox" checked={currentOnly} onChange={(event) => setCurrentOnly(event.target.checked)} /> Documento corrente</label>
      <div><button type="button" onClick={() => void exportFile()}>Esporta</button><button type="button" onClick={() => fileRef.current?.click()}>Importa</button><input ref={fileRef} className="scv-visually-hidden" type="file" accept="application/json,.json" onChange={(event) => void importFile(event.target.files?.[0])} /></div>
    </div>
    {notice && <p className="scv-annotation-notice" role="status">{notice}</p>}
    {controller.error && <p className="scv-annotation-error" role="alert">{controller.error}</p>}
    <div id={`${id}-list`} role="tabpanel" aria-labelledby={`${id}-${tab}-tab`} className="scv-annotations-list">
      {controller.loading ? <p>Caricamento annotazioni…</p> : items.length === 0 ? <p>Nessuna {tab === "note" ? "nota" : "segnalibro"}.</p> : <ul>{items.map((annotation) => <li key={annotation.id}>
        <button type="button" className="scv-annotation-main" onClick={() => controller.navigate(annotation)}><strong>{annotationHeading(annotation)}</strong><span>{annotation.title}</span>{annotation.type === "note" && <small>{annotation.text}</small>}{annotation.type === "bookmark" && annotation.label && <small>{annotation.label}</small>}<time dateTime={annotation.updatedAt}>{new Intl.DateTimeFormat("it-IT", { dateStyle: "medium" }).format(new Date(annotation.updatedAt))}</time></button>
        <div><button type="button" aria-label={`Modifica ${annotation.type === "note" ? "nota" : "segnalibro"}`} onClick={() => controller.edit(annotation)}>Modifica</button><button type="button" aria-label={`Elimina ${annotation.type === "note" ? "nota" : "segnalibro"}`} onClick={() => { if (window.confirm("Eliminare questa annotazione?")) void controller.remove(annotation); }}>Elimina</button></div>
      </li>)}</ul>}
    </div>
  </section>;
}
