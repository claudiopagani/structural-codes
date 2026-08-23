"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import { BlockContent } from "../CorpusViewer";
import {
  documentForMode,
  loadChunk,
  loadDocumentIndex,
  loadManifest,
  loadRelations,
  type CorpusChunk,
  type CorpusManifest,
  type CorpusUnit,
  type DocumentIndex,
  type RelationEdge,
  type UnitSummary,
  type ViewerMode,
} from "../corpusData";

const modeOptions: Array<{ id: ViewerMode; label: string }> = [
  { id: "ntc", label: "NTC 2018" },
  { id: "circ", label: "Circolare 7/2019" },
  { id: "combined", label: "NTC 2018 + Circolare" },
];

function depth(unit: UnitSummary | CorpusUnit) {
  return unit.hierarchy.ancestorIds.length;
}

function comparableTitle(value: string) {
  return value.normalize("NFKC").replace(/\s+/gu, " ").trim().toLocaleLowerCase("it");
}

function isRepeatedUnitTitle(unit: CorpusUnit, block: CorpusUnit["blocks"][number]) {
  if (block.kind !== "heading" || !block.text) return false;
  const renderedHeading = comparableTitle(block.text.normalized);
  return renderedHeading === comparableTitle(unit.title) || renderedHeading === comparableTitle(`${unit.numbering.official} ${unit.title}`);
}

function evidencePages(unit: CorpusUnit, chunk: CorpusChunk) {
  const pages = unit.blocks.flatMap((block) => {
    if (block.evidence?.pdfPage) return [block.evidence.pdfPage];
    if (!block.assetId) return [];
    const asset = chunk.assets.formulas[block.assetId] ?? chunk.assets.tables[block.assetId] ?? chunk.assets.figures[block.assetId];
    return asset?.pdfPage ? [asset.pdfPage] : [];
  });
  return [...new Set(pages)].sort((left, right) => left - right);
}

interface RelatedRecord {
  edge: RelationEdge;
  unit: CorpusUnit;
  chunk: CorpusChunk;
}

export function ComparisonViewer() {
  const [manifest, setManifest] = useState<CorpusManifest | null>(null);
  const [index, setIndex] = useState<DocumentIndex | null>(null);
  const [chunk, setChunk] = useState<CorpusChunk | null>(null);
  const [mode, setMode] = useState<ViewerMode>("ntc");
  const [activeUnitId, setActiveUnitId] = useState<string | null>(null);
  const [relatedByTarget, setRelatedByTarget] = useState<Map<string, RelatedRecord[]>>(new Map());
  const [loadError, setLoadError] = useState(false);
  const [pdfRequested, setPdfRequested] = useState(false);
  const [pdfDocument, setPdfDocument] = useState<PDFDocumentProxy | null>(null);
  const [pdfError, setPdfError] = useState(false);
  const requestedIdRef = useRef<string | null>(null);

  useEffect(() => {
    loadManifest().then((loaded) => {
      const url = new URL(window.location.href);
      const requestedMode = url.searchParams.get("mode");
      if (modeOptions.some((option) => option.id === requestedMode)) setMode(requestedMode as ViewerMode);
      requestedIdRef.current = url.searchParams.get("unit");
      setActiveUnitId(requestedIdRef.current);
      setManifest(loaded);
    }).catch(() => setLoadError(true));
  }, []);

  useEffect(() => {
    if (!manifest) return;
    let cancelled = false;
    const document = documentForMode(mode);
    loadDocumentIndex(manifest, document).then((loaded) => {
      if (cancelled) return;
      setIndex(loaded);
      const requested = loaded.units.find(
        (unit) => unit.id === requestedIdRef.current,
      );
      const initial = requested ?? loaded.units.find((unit) => unit.numbering.official === (document === "ntc2018" ? "4.1" : "C4.1")) ?? loaded.units[0];
      if (initial) {
        requestedIdRef.current = initial.id;
        setActiveUnitId(initial.id);
        const url = new URL(window.location.href);
        url.searchParams.set("mode", mode);
        url.searchParams.set("unit", initial.id);
        window.history.replaceState(null, "", url);
      }
    }).catch(() => setLoadError(true));
    return () => { cancelled = true; };
  }, [manifest, mode]);

  const activeSummary = index?.units.find((unit) => unit.id === activeUnitId) ?? null;
  const activeChunkPath = activeSummary?.chunkPath ?? null;

  useEffect(() => {
    if (!activeChunkPath) return;
    let cancelled = false;
    loadChunk(activeChunkPath).then((loaded) => {
      if (!cancelled) setChunk(loaded);
    }).catch(() => setLoadError(true));
    return () => { cancelled = true; };
  }, [activeChunkPath]);

  useEffect(() => {
    if (!manifest || !chunk || mode !== "combined") return;
    let cancelled = false;
    loadRelations(manifest).then(async ({ relations }) => {
      const targetIds = new Set(chunk.units.map((unit) => unit.id));
      const incoming = relations.filter((edge) => targetIds.has(edge.targetUnitId));
      const relatedChunks = new Map(
        await Promise.all([...new Set(incoming.map((edge) => edge.sourceChunkPath))].map(async (path) => [path, await loadChunk(path)] as const)),
      );
      const grouped = new Map<string, RelatedRecord[]>();
      for (const edge of incoming) {
        const sourceChunk = relatedChunks.get(edge.sourceChunkPath);
        const unit = sourceChunk?.units.find((candidate) => candidate.id === edge.sourceUnitId);
        if (!sourceChunk || !unit) continue;
        const group = grouped.get(edge.targetUnitId) ?? [];
        group.push({ edge, unit, chunk: sourceChunk });
        grouped.set(edge.targetUnitId, group);
      }
      for (const group of grouped.values()) {
        group.sort((left, right) => left.unit.numbering.sortKey.localeCompare(right.unit.numbering.sortKey, "it", { numeric: true }));
      }
      if (!cancelled) setRelatedByTarget(grouped);
    }).catch(() => setLoadError(true));
    return () => { cancelled = true; };
  }, [chunk, manifest, mode]);

  useEffect(() => {
    if (!manifest || !pdfRequested) return;
    let cancelled = false;
    let loadingTask: { promise: Promise<PDFDocumentProxy>; destroy(): Promise<void> } | null = null;
    let loaded: PDFDocumentProxy | null = null;
    const document = documentForMode(mode);
    void import("pdfjs-dist").then((pdfjs) => {
      if (cancelled) return null;
      pdfjs.GlobalWorkerOptions.workerSrc = "/vendor/pdf.worker.min.mjs";
      loadingTask = pdfjs.getDocument({ url: `/api/source-pdf?document=${document}`, rangeChunkSize: 262_144 });
      return loadingTask.promise;
    }).then((result) => {
      if (!cancelled && result) {
        loaded = result;
        setPdfDocument(result);
      }
    }).catch(() => { if (!cancelled) setPdfError(true); });
    return () => {
      cancelled = true;
      if (loaded) void loaded.destroy();
      else void loadingTask?.destroy();
    };
  }, [manifest, mode, pdfRequested]);

  const hierarchy = useMemo(() => {
    if (!index) return [];
    const active = index.units.find((unit) => unit.id === activeUnitId);
    const path = new Set(active ? [...active.hierarchy.ancestorIds, active.id] : []);
    return [0, 1, 2, 3].map((level) => index.units.filter((unit) => depth(unit) === level && (level < 2 || path.has(unit.id) || unit.hierarchy.parentId === active?.hierarchy.parentId)));
  }, [activeUnitId, index]);

  const pageBounds = useMemo(() => {
    if (!chunk) return { from: 1, to: 1 };
    const pages = chunk.units.flatMap((unit) => evidencePages(unit, chunk));
    return pages.length > 0 ? { from: Math.min(...pages), to: Math.max(...pages) } : { from: 1, to: 1 };
  }, [chunk]);

  function selectUnit(unit: UnitSummary) {
    requestedIdRef.current = unit.id;
    setActiveUnitId(unit.id);
    const url = new URL(window.location.href);
    url.searchParams.set("mode", mode);
    url.searchParams.set("unit", unit.id);
    window.history.replaceState(null, "", url);
    requestAnimationFrame(() => document.querySelector(`[data-text-unit="${CSS.escape(unit.id)}"]`)?.scrollIntoView({ block: "start" }));
  }

  function changeMode(nextMode: ViewerMode) {
    setMode(nextMode);
    setIndex(null);
    setChunk(null);
    setRelatedByTarget(new Map());
    setPdfRequested(false);
    setPdfDocument(null);
    setPdfError(false);
    if ((nextMode === "circ") !== (activeSummary?.document === "circ2019")) {
      requestedIdRef.current = null;
      setActiveUnitId(null);
    }
  }

  if (loadError) return <main className="comparison-fatal"><strong>Il corpus non è disponibile.</strong><span>Rigenera gli artefatti del viewer e ricarica la pagina.</span></main>;

  const document = documentForMode(mode);
  const source = manifest?.documents[document];

  return (
    <main className="comparison-shell">
      <aside className="comparison-index" aria-label="Indice gerarchico">
        <nav className="comparison-document-switch" aria-label="Modalità di consultazione">
          {modeOptions.map((option) => <button type="button" key={option.id} className={mode === option.id ? "active" : ""} onClick={() => changeMode(option.id)} aria-pressed={mode === option.id}>{option.label}</button>)}
          <Link href={`/?mode=${mode}${activeUnitId ? `&unit=${encodeURIComponent(activeUnitId)}` : ""}`} title="Apri il viewer analitico" aria-label="Apri il viewer analitico">↗</Link>
        </nav>
        <div className="comparison-index-grid">
          {hierarchy.map((level, levelIndex) => <section className="comparison-index-cell" key={levelIndex}><header><span>{["Capitoli", "Paragrafi", "Sottoparagrafi", "Dettagli"][levelIndex]}</span><b>{level.length}</b></header><div className="comparison-index-list">{level.map((unit) => <button type="button" key={unit.id} data-index-unit={unit.id} className={activeUnitId === unit.id ? "active" : ""} onClick={() => selectUnit(unit)} title={`${unit.numbering.official} ${unit.title}`}><strong>{unit.numbering.official}</strong><span>{unit.title}</span></button>)}</div></section>)}
        </div>
      </aside>

      <article className="comparison-text-pane" aria-label="Testo trascritto continuo">
        {!chunk ? <LoadingPanel label="Caricamento del chunk…" /> : <div className="comparison-text-flow">
          <p className="comparison-chunk-note">Chunk {chunk.key} · {chunk.units.length} unità · structural-codes {chunk.structuralCodesVersion}</p>
          {chunk.units.map((unit) => <section className={`comparison-unit comparison-unit-depth-${Math.min(depth(unit), 4)}`} data-text-unit={unit.id} key={unit.id}>
            <h2><span>{unit.numbering.official}</span>{unit.title}</h2>
            <div className="comparison-unit-blocks">{unit.blocks.filter((block) => !isRepeatedUnitTitle(unit, block)).map((block) => <div className={`comparison-block comparison-block-${block.kind}`} key={block.blockId}><BlockContent block={block} assets={chunk.assets} showRaw={false} /></div>)}</div>
            {mode === "combined" && (relatedByTarget.get(unit.id) ?? []).map(({ edge, unit: relatedUnit, chunk: relatedChunk }) => <section className="combined-circular-unit comparison-related-unit" data-provenance="Circolare 7/2019" key={edge.relationId}><header><span>Circolare 7/2019 — {relatedUnit.numbering.official}</span><h3>{relatedUnit.title}</h3>{edge.review.status !== "confirmed" && <small className="relation-review-state">Collegamento editoriale da revisionare</small>}</header><div className="comparison-unit-blocks">{relatedUnit.blocks.filter((block) => !isRepeatedUnitTitle(relatedUnit, block)).map((block) => <div className={`comparison-block comparison-block-${block.kind}`} key={block.blockId}><BlockContent block={block} assets={relatedChunk.assets} showRaw={false} /></div>)}</div><footer>Provenienza: Circolare 7/2019 · relazione esplicita · {edge.review.status}</footer></section>)}
          </section>)}
          <div className="comparison-end-note">Fine del chunk caricato.</div>
        </div>}
      </article>

      <aside className="comparison-pdf-pane" aria-label="PDF ufficiale">
        <div className="comparison-pdf-status"><strong>{source?.shortLabel ?? "PDF ufficiale"}</strong><span>pagine del chunk {pageBounds.from}–{pageBounds.to}</span>{source && <a href={source.sourceUrl} target="_blank" rel="noreferrer">originale ↗</a>}</div>
        {!pdfRequested ? <div className="comparison-pdf-consent"><strong>Fonte ufficiale su richiesta</strong><p>PDF.js e il PDF non vengono caricati finché non avvii il confronto.</p><button type="button" onClick={() => setPdfRequested(true)}>Apri PDF ufficiale</button></div> : pdfError ? <div className="comparison-pdf-error"><strong>Anteprima PDF non disponibile.</strong><span>Usa il collegamento alla fonte ufficiale.</span></div> : !pdfDocument ? <LoadingPanel label="Apertura del PDF ufficiale…" /> : <div className="comparison-pdf-pages">{Array.from({ length: pageBounds.to - pageBounds.from + 1 }, (_, index) => pageBounds.from + index).map((page) => <PdfPage document={pdfDocument} pageNumber={page} key={`${document}-${page}`} />)}</div>}
      </aside>
    </main>
  );
}

function PdfPage({ document, pageNumber }: { document: PDFDocumentProxy; pageNumber: number }) {
  const frameRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [shouldRender, setShouldRender] = useState(false);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) setShouldRender(true); }, { rootMargin: "1400px 0px" });
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !shouldRender || width <= 0) return;
    let cancelled = false;
    let task: RenderTask | null = null;
    void document.getPage(pageNumber).then((page) => {
      if (cancelled) return;
      const base = page.getViewport({ scale: 1 });
      const ratio = Math.min(window.devicePixelRatio || 1, 1.75);
      const viewport = page.getViewport({ scale: (width / base.width) * ratio });
      const context = canvas.getContext("2d", { alpha: false });
      if (!context) return;
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      canvas.style.width = `${Math.floor(viewport.width / ratio)}px`;
      canvas.style.height = `${Math.floor(viewport.height / ratio)}px`;
      task = page.render({ canvas, canvasContext: context, viewport } as Parameters<typeof page.render>[0]);
      return task.promise;
    }).catch(() => undefined);
    return () => { cancelled = true; task?.cancel(); };
  }, [document, pageNumber, shouldRender, width]);

  return <section className="comparison-pdf-page" data-pdf-page={pageNumber} ref={frameRef}><span>{pageNumber}</span><canvas ref={canvasRef} aria-label={`Pagina PDF ${pageNumber}`} /></section>;
}

function LoadingPanel({ label }: { label: string }) {
  return <div className="comparison-loading"><span /><strong>{label}</strong></div>;
}
