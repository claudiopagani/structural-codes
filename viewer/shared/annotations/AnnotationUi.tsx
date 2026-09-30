"use client";

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from "react";
import type { DocumentId } from "../corpusData.js";
import type { ViewerTarget } from "../permalinks.js";
import { sortAnnotations } from "./annotationTargets.js";
import type { AnnotationExport, AnnotationImportResult, AnnotationType, UserAnnotation } from "./types.js";
import { BookmarkIcon, CloseIcon, DownloadCircleIcon, FloppyDiskIcon, LinkChainIcon, PencilIcon, RecycleBinIcon, StickyNoteIcon, UploadCircleIcon } from "../UiIcons.js";

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

export interface AnnotationPosition {
  x: number;
  y: number;
}

export function AnnotationContextMenu({ state, darkMode, onCopyLink, onBookmark, onNote, onClose }: {
  state: AnnotationMenuState;
  darkMode: boolean;
  onCopyLink: (target: ViewerTarget) => void;
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
    <button type="button" role="menuitem" onClick={() => { onCopyLink(state.target); onClose(); }}><LinkChainIcon variant={darkMode ? "dark" : "default"} />Copia link</button>
    <button type="button" role="menuitem" onClick={onBookmark}><BookmarkIcon />{state.bookmark ? "Modifica segnalibro" : "Aggiungi segnalibro"}</button>
    <button type="button" role="menuitem" onClick={onNote}><StickyNoteIcon />Aggiungi nota</button>
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
  const editorRef = useRef<HTMLDivElement>(null);
  const fieldRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const [position, setPosition] = useState({ left: 12, top: 12 });
  const [value, setValue] = useState(state.type === "bookmark" ? state.annotation?.label ?? state.metadata.automaticLabel : state.annotation?.text ?? "");
  useLayoutEffect(() => {
    const element = editorRef.current;
    if (!element) return;
    const placeEditor = () => {
      const bounds = element.getBoundingClientRect();
      const root = element.closest<HTMLElement>(".scv-root");
      const auxiliary = root?.querySelector<HTMLElement>(".scv-auxiliary-pane");
      const auxiliaryVisible = window.matchMedia("(min-width: 992px)").matches
        && auxiliary
        && auxiliary.getAttribute("aria-hidden") !== "true"
        && window.getComputedStyle(auxiliary).visibility !== "hidden";
      const rightEdge = auxiliaryVisible ? Math.min(window.innerWidth - 12, auxiliary!.getBoundingClientRect().left - 12) : window.innerWidth - 12;
      const maxLeft = Math.max(12, rightEdge - bounds.width);
      const anchorX = state.x ?? (12 + rightEdge) / 2;
      const anchorY = state.y ?? window.innerHeight / 2;
      const left = Math.max(12, Math.min(anchorX - bounds.width / 2, maxLeft));
      const top = Math.max(12, Math.min(anchorY - bounds.height / 2, window.innerHeight - bounds.height - 12));
      setPosition((current) => current.left === left && current.top === top ? current : { left, top });
    };
    placeEditor();
    window.addEventListener("resize", placeEditor);
    return () => window.removeEventListener("resize", placeEditor);
  }, [state]);
  useEffect(() => { fieldRef.current?.focus({ preventScroll: true }); }, []);
  useEffect(() => {
    const key = (event: KeyboardEvent) => { if (event.key === "Escape") { event.preventDefault(); onClose(); } };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [onClose]);
  const submit = (event: FormEvent) => { event.preventDefault(); onSave(value); };
  const style = { "--scv-annotation-editor-x": `${position.left}px`, "--scv-annotation-editor-y": `${position.top}px` } as CSSProperties;
  return <div ref={editorRef} className="scv-annotation-editor" role="dialog" aria-modal="true" aria-labelledby={titleId} style={style}>
    <form onSubmit={submit}>
      <header><div><strong id={titleId}>{state.type === "bookmark" ? (state.annotation ? "Modifica segnalibro" : "Nuovo segnalibro") : (state.annotation ? "Modifica nota" : "Nuova nota")}</strong><span>§ {state.metadata.numbering} — {state.metadata.title}</span></div><button type="button" className="scv-annotation-close" aria-label="Chiudi editor" onClick={onClose}><CloseIcon /></button></header>
      <label htmlFor={fieldId}>{state.type === "bookmark" ? "Descrizione" : "Nota"}</label>
      {state.type === "bookmark"
        ? <input ref={fieldRef as React.RefObject<HTMLInputElement>} id={fieldId} value={value} maxLength={500} placeholder={state.metadata.automaticLabel} onChange={(event) => setValue(event.target.value)} />
        : <textarea ref={fieldRef as React.RefObject<HTMLTextAreaElement>} id={fieldId} value={value} maxLength={100000} rows={6} onChange={(event) => setValue(event.target.value)} />}
      {error && <p className="scv-annotation-error" role="alert">{error}</p>}
      <footer>{onDelete && <button type="button" className="is-danger scv-icon-action" disabled={busy} onClick={onDelete}><RecycleBinIcon variant="danger" />Elimina</button>}<span /><button type="button" disabled={busy} onClick={onClose}>Chiudi</button><button type="submit" className="is-primary scv-icon-action" disabled={busy || (state.type === "note" && !value.trim())}><FloppyDiskIcon variant="light" />Salva</button></footer>
    </form>
  </div>;
}

export function AnnotationMarginMarker({ notes, onOpen }: { notes: UserAnnotation[]; onOpen: (annotation: UserAnnotation, position?: AnnotationPosition) => void }) {
  if (notes.length === 0) return null;
  return <button type="button" className="scv-note-margin-marker" aria-label={notes.length === 1 ? (notes[0].type === "bookmark" ? "Apri segnalibro" : "Apri nota") : `Apri ${notes.length} annotazioni`} title={notes.length === 1 ? (notes[0].type === "bookmark" ? "Segnalibro" : "Nota") : `${notes.length} annotazioni`} onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); const bounds = event.currentTarget.getBoundingClientRect(); onOpen(notes[0], { x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2 }); }}><span aria-hidden="true">{notes[0].type === "bookmark" ? <BookmarkIcon className="scv-note-margin-icon is-bookmark" /> : <StickyNoteIcon className="scv-note-margin-icon is-note" />}</span>{notes.length > 1 && <b>{notes.length}</b>}</button>;
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
  return <section className="scv-annotations-panel" aria-label="Annotazioni e segnalibri">
    <div className="scv-annotations-tabs" role="tablist" aria-label="Tipo annotazione">
      {(["note", "bookmark"] as const).map((type) => <button type="button" role="tab" id={id + "-" + type + "-tab"} aria-controls={id + "-list"} aria-selected={tab === type} tabIndex={tab === type ? 0 : -1} key={type} onClick={() => setTab(type)}>{type === "note" ? <StickyNoteIcon variant={tab === type ? "light" : "default"} /> : <BookmarkIcon variant={tab === type ? "light" : "default"} />}{type === "note" ? "Note" : "Segnalibri"}</button>)}
    </div>
    <div className="scv-annotations-controls">
      <label className="scv-annotations-sort"><span>Ordina per:</span><select value={order} onChange={(event) => setOrder(event.target.value as typeof order)}><option value="position">Posizione</option><option value="recent">Più recenti</option><option value="oldest">Meno recenti</option></select></label>
      <label className="scv-annotations-filter"><input type="checkbox" checked={currentOnly} onChange={(event) => setCurrentOnly(event.target.checked)} /> Documento corrente</label>
    </div>
    {notice && <p className="scv-annotation-notice" role="status">{notice}</p>}
    {controller.error && <p className="scv-annotation-error" role="alert">{controller.error}</p>}
    <div id={`${id}-list`} role="tabpanel" aria-labelledby={`${id}-${tab}-tab`} className="scv-annotations-list">
      {controller.loading ? <p>Caricamento annotazioni…</p> : items.length === 0 ? <p>Nessuna {tab === "note" ? "nota" : "segnalibro"}.</p> : <ul>{items.map((annotation) => <li key={annotation.id}>
        <button type="button" className="scv-annotation-main" onClick={() => controller.navigate(annotation)}><strong>{annotationHeading(annotation)}</strong><span>{annotation.title}</span>{annotation.type === "note" && <small>{annotation.text}</small>}{annotation.type === "bookmark" && annotation.label && <small>{annotation.label}</small>}<time dateTime={annotation.updatedAt}>{new Intl.DateTimeFormat("it-IT", { dateStyle: "medium" }).format(new Date(annotation.updatedAt))}</time></button>
        <div><button type="button" className="scv-icon-action" aria-label={`Modifica ${annotation.type === "note" ? "nota" : "segnalibro"}`} onClick={() => controller.edit(annotation)}><PencilIcon />Modifica</button><button type="button" className="scv-icon-action is-danger" aria-label={`Elimina ${annotation.type === "note" ? "nota" : "segnalibro"}`} onClick={() => { if (window.confirm("Eliminare questa annotazione?")) void controller.remove(annotation); }}><RecycleBinIcon variant="danger" />Elimina</button></div>
      </li>)}</ul>}
    </div>
    <footer className="scv-annotations-actions" aria-label="Importa ed esporta annotazioni">
      <button type="button" className="scv-icon-action" onClick={() => fileRef.current?.click()}><UploadCircleIcon />Importa</button>
      <button type="button" className="scv-icon-action" onClick={() => void exportFile()}><DownloadCircleIcon />Esporta</button>
      <input ref={fileRef} className="scv-visually-hidden" type="file" accept="application/json,.json" onChange={(event) => void importFile(event.target.files?.[0])} />
    </footer>
  </section>;
}
