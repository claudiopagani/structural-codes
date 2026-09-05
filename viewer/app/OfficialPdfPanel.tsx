"use client";

import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import type { AuxiliaryPanelContext } from "../shared/NormativeViewer";

export function OfficialPdfPanel({ context }: { context: AuxiliaryPanelContext }) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [requested, setRequested] = useState(false);
  const [pdfDocument, setPdfDocument] = useState<PDFDocumentProxy | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!requested) return;
    let cancelled = false;
    let loadingTask: { promise: Promise<PDFDocumentProxy>; destroy(): Promise<void> } | null = null;
    void import("pdfjs-dist").then((pdfjs) => {
      if (cancelled) return null;
      pdfjs.GlobalWorkerOptions.workerSrc = "/vendor/pdf.worker.min.mjs";
      loadingTask = pdfjs.getDocument({ url: `/api/source-pdf?document=${context.documentId}`, rangeChunkSize: 262_144 });
      return loadingTask.promise;
    }).then((result) => {
      if (!cancelled && result) {
        setPdfDocument(result);
      }
    }).catch(() => { if (!cancelled) setError(true); });
    return () => {
      cancelled = true;
      void loadingTask?.destroy();
    };
  }, [context.documentId, requested]);

  useEffect(() => {
    if (!requested || !pdfDocument) return;
    panelRef.current?.querySelector<HTMLElement>(`[data-pdf-page="${context.pageBounds.from}"]`)
      ?.scrollIntoView({ block: "start" });
  }, [context.pageBounds.from, context.pageBounds.to, pdfDocument, requested]);

  const source = context.manifest.documents[context.documentId];
  return <div className="scv-pdf-panel" ref={panelRef}>
    <div className="scv-pdf-status"><strong>{source.shortLabel}</strong><span>pagine {context.pageBounds.from}–{context.pageBounds.to}</span><a href={source.sourceUrl} target="_blank" rel="noreferrer">originale ↗</a></div>
    {!requested ? <div className="scv-pdf-consent"><strong>Fonte ufficiale su richiesta</strong><p>PDF.js e il PDF non vengono caricati finché non avvii il confronto.</p><button type="button" onClick={() => setRequested(true)}>Apri PDF ufficiale</button></div> : error ? <div className="scv-pdf-error"><strong>Anteprima PDF non disponibile.</strong><span>Usa il collegamento alla fonte ufficiale.</span></div> : !pdfDocument ? <LoadingPanel label="Apertura del PDF ufficiale…" /> : <div className="scv-pdf-pages">{Array.from({ length: context.pageBounds.to - context.pageBounds.from + 1 }, (_, index) => context.pageBounds.from + index).map((page) => <PdfPage pdfDocument={pdfDocument} pageNumber={page} key={`${context.documentId}-${page}`} />)}</div>}
  </div>;
}

function PdfPage({ pdfDocument, pageNumber }: { pdfDocument: PDFDocumentProxy; pageNumber: number }) {
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
    void pdfDocument.getPage(pageNumber).then((page) => {
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
  }, [pageNumber, pdfDocument, shouldRender, width]);

  return <section className="scv-pdf-page" data-pdf-page={pageNumber} ref={frameRef}><span>{pageNumber}</span><canvas ref={canvasRef} aria-label={`Pagina PDF ${pageNumber}`} /></section>;
}

function LoadingPanel({ label }: { label: string }) {
  return <div className="scv-loading"><span /><strong>{label}</strong></div>;
}
