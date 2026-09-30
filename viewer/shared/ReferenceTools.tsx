import { memo } from "react";
import type { DocumentId, RelationEdge, TextualBacklink } from "./corpusData";
import { CloseIcon } from "./UiIcons.js";

export interface TextualBacklinkView {
  backlink: TextualBacklink;
  document: DocumentId;
  numbering: string;
  title: string;
}
export interface EditorialBacklinkView {
  edge: RelationEdge;
  label: string;
  title: string;
}

export interface ReferencePreviewData {
  label: string;
  title: string;
  snippet: string;
  left: number;
  top: number;
  loading?: boolean;
  interactive?: boolean;
  available?: boolean;
}

export const ReferencePreview = memo(function ReferencePreview({ preview, onOpen, onClose }: {
  preview: ReferencePreviewData | null;
  onOpen?: () => void;
  onClose?: () => void;
}) {
  if (!preview) return null;
  return <aside className={`scv-reference-preview ${preview.interactive ? "is-interactive" : ""}`} role={preview.interactive ? "dialog" : "tooltip"} aria-label={preview.interactive ? "Anteprima riferimento normativo" : undefined} style={{ left: preview.left, top: preview.top }} data-scv-reference-preview>
    <span>{preview.label}</span>
    <strong>{preview.title}</strong>
    <small>{preview.loading ? "Caricamento anteprima…" : preview.snippet}</small>
    {preview.interactive && <div className="scv-reference-preview-actions">
      <button type="button" onClick={onClose}>Chiudi</button>
      <button type="button" disabled={preview.loading || preview.available === false} onClick={onOpen}>Apri riferimento</button>
    </div>}
  </aside>;
});

export const CitationActions = memo(function CitationActions({ contextLabel, formula, status, onCopyText, onCopyLink, onCopyCitation, onCopyLatex, backlinksOpen, backlinkCount, backlinksId, onToggleBacklinks }: {
  contextLabel: string;
  formula: boolean;
  status: string | null;
  onCopyText: () => void;
  onCopyLink: () => void;
  onCopyCitation: () => void;
  onCopyLatex: () => void;
  backlinksOpen: boolean;
  backlinkCount: number | null;
  backlinksId: string;
  onToggleBacklinks: () => void;
}) {
  return <div className="scv-citation-actions" aria-label="Strumenti di citazione" data-scv-citation-actions>
    <span className="scv-citation-context" title={contextLabel}>{status ?? contextLabel}</span>
    <button type="button" onClick={onCopyText}>Copia testo</button>
    <button type="button" onClick={onCopyLink}>Copia link</button>
    <button type="button" onClick={onCopyCitation}>Copia citazione</button>
    {formula && <button type="button" onClick={onCopyLatex}>Copia LaTeX</button>}
    <button type="button" className={backlinksOpen ? "active" : ""} aria-controls={backlinksId} aria-expanded={backlinksOpen} onClick={onToggleBacklinks}>Richiami{backlinkCount === null ? "" : ` ${backlinkCount}`}</button>
  </div>;
});

export const BacklinkPanel = memo(function BacklinkPanel({ id, loading, textual, editorial, onNavigateTextual, onNavigateEditorial, onClose }: {
  id: string;
  loading: boolean;
  textual: TextualBacklinkView[];
  editorial: EditorialBacklinkView[];
  onNavigateTextual: (backlink: TextualBacklink) => void;
  onNavigateEditorial: (edge: RelationEdge) => void;
  onClose: () => void;
}) {
  return <aside id={id} className="scv-backlink-panel" aria-label="Riferimenti in entrata" data-scv-backlink-panel>
    <header><strong>Richiami al contenuto corrente</strong><button type="button" onClick={onClose} aria-label="Chiudi richiami"><CloseIcon /></button></header>
    {loading ? <p>Caricamento riferimenti…</p> : <>
      <section><h3>Riferimenti testuali</h3>{textual.length === 0 ? <p>Nessun richiamo testuale indicizzato.</p> : <ul>{textual.map(({ backlink, document, numbering, title }) => <li key={`${backlink.sourceUnitId}:${backlink.sourceBlockId}`}><button type="button" onClick={() => onNavigateTextual(backlink)}><span>{document === "ntc2018" ? "NTC 2018" : "Circolare 7/2019"} · {numbering}</span><strong>{title}</strong></button></li>)}</ul>}</section>
      <section><h3>Relazioni editoriali NTC ↔ Circolare</h3>{editorial.length === 0 ? <p>Nessuna relazione editoriale per questa unità.</p> : <ul>{editorial.map(({ edge, label, title }) => <li key={edge.relationId}><button type="button" onClick={() => onNavigateEditorial(edge)}><span>{edge.type} · {label}</span><strong>{title}</strong></button></li>)}</ul>}</section>
    </>}
  </aside>;
});
