"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import {
  BlockContent,
  type CorpusData,
  type CorpusUnit,
  type DocumentId,
} from "../CorpusViewer";

interface UnitAnchor {
  unit: CorpusUnit;
  page: number;
  scalar: number;
}

const documentOrder: DocumentId[] = ["ntc2018", "circ2019"];

function depth(unit: CorpusUnit) {
  return unit.hierarchy.ancestorIds.length;
}

function comparableTitle(value: string) {
  return value
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("it");
}

function isRepeatedUnitTitle(
  unit: CorpusUnit,
  block: CorpusUnit["blocks"][number],
) {
  if (block.kind !== "heading" || !block.text) return false;
  const renderedHeading = comparableTitle(block.text.normalized);
  const title = comparableTitle(unit.title);
  const numberedTitle = comparableTitle(
    `${unit.numbering.official} ${unit.title}`,
  );
  return renderedHeading === title || renderedHeading === numberedTitle;
}

function evidencePages(unit: CorpusUnit, data: CorpusData) {
  const pages = unit.blocks.flatMap((block) => {
    if (block.evidence?.pdfPage) return [block.evidence.pdfPage];
    if (!block.assetId) return [];
    const asset =
      data.assets.formulas[block.assetId] ??
      data.assets.tables[block.assetId] ??
      data.assets.figures[block.assetId];
    return asset?.pdfPage ? [asset.pdfPage] : [];
  });
  return [...new Set(pages)].sort((left, right) => left - right);
}

function buildAnchors(units: CorpusUnit[], data: CorpusData) {
  const withPages = units.map((unit) => ({
    unit,
    page: evidencePages(unit, data)[0] ?? null,
  }));

  let followingPage: number | null = null;
  for (let index = withPages.length - 1; index >= 0; index -= 1) {
    followingPage = withPages[index].page ?? followingPage;
    withPages[index].page = followingPage;
  }

  let precedingPage = withPages.find((entry) => entry.page !== null)?.page ?? 1;
  for (const entry of withPages) {
    entry.page ??= precedingPage;
    precedingPage = entry.page;
  }

  const groups = new Map<number, typeof withPages>();
  for (const entry of withPages) {
    const page = entry.page ?? 1;
    const group = groups.get(page) ?? [];
    group.push(entry);
    groups.set(page, group);
  }

  return withPages.map(({ unit, page }) => {
    const resolvedPage = page ?? 1;
    const group = groups.get(resolvedPage) ?? [];
    const position = Math.max(
      0,
      group.findIndex((entry) => entry.unit.id === unit.id),
    );
    return {
      unit,
      page: resolvedPage,
      scalar: resolvedPage + (position + 0.12) / Math.max(group.length, 1),
    } satisfies UnitAnchor;
  });
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function pageFromScalar(scalar: number) {
  return Math.max(1, Math.floor(scalar));
}

function findAnchorIndex(anchors: UnitAnchor[], scalar: number) {
  let low = 0;
  let high = anchors.length - 1;
  let result = 0;

  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    if (anchors[middle].scalar <= scalar) {
      result = middle;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }

  return result;
}

export function ComparisonViewer() {
  const [data, setData] = useState<CorpusData | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [activeDocument, setActiveDocument] =
    useState<DocumentId>("ntc2018");
  const [activeUnitId, setActiveUnitId] = useState<string | null>(null);
  const [pdfDocument, setPdfDocument] = useState<PDFDocumentProxy | null>(null);
  const [pdfError, setPdfError] = useState(false);
  const [pdfScroller, setPdfScroller] = useState<HTMLDivElement | null>(null);
  const [visiblePdfPage, setVisiblePdfPage] = useState<number | null>(null);
  const textPaneRef = useRef<HTMLDivElement>(null);
  const pdfPaneRef = useRef<HTMLDivElement>(null);
  const lockRef = useRef<{ target: "text" | "pdf"; until: number } | null>(
    null,
  );
  const initialUnitRef = useRef<string | null>(null);

  useEffect(() => {
    fetch("/data/corpus.json")
      .then((response) => {
        if (!response.ok) throw new Error("Corpus non disponibile");
        return response.json() as Promise<CorpusData>;
      })
      .then((corpus) => {
        const url = new URL(window.location.href);
        const requestedUnit = url.searchParams.get("unit");
        const requestedDocument = url.searchParams.get("document");
        const requested = corpus.units.find((unit) => unit.id === requestedUnit);
        const document = requested
          ? requested.document
          : documentOrder.includes(requestedDocument as DocumentId)
            ? (requestedDocument as DocumentId)
            : "ntc2018";
        const first =
          requested ?? corpus.units.find((unit) => unit.document === document);

        initialUnitRef.current = first?.id ?? null;
        setActiveDocument(document);
        setActiveUnitId(first?.id ?? null);
        setData(corpus);
      })
      .catch(() => setLoadError(true));
  }, []);

  const units = useMemo(
    () =>
      data?.units.filter((unit) => unit.document === activeDocument) ?? [],
    [activeDocument, data],
  );
  const anchors = useMemo(
    () => (data ? buildAnchors(units, data) : []),
    [data, units],
  );
  const anchorById = useMemo(
    () => new Map(anchors.map((anchor) => [anchor.unit.id, anchor])),
    [anchors],
  );
  const activeUnit =
    units.find((unit) => unit.id === activeUnitId) ?? units[0] ?? null;
  const activePathIds = useMemo(
    () =>
      new Set(
        activeUnit
          ? [...activeUnit.hierarchy.ancestorIds, activeUnit.id]
          : [],
      ),
    [activeUnit],
  );

  const hierarchy = useMemo(() => {
    const chapters = units.filter((unit) => depth(unit) === 0);
    const chapter =
      [...(activeUnit?.hierarchy.ancestorIds ?? []), activeUnit?.id]
        .map((id) => units.find((unit) => unit.id === id))
        .find((unit) => unit && depth(unit) === 0) ?? chapters[0];
    const sections = chapter
      ? units.filter((unit) => unit.hierarchy.parentId === chapter.id)
      : [];
    const section =
      [...(activeUnit?.hierarchy.ancestorIds ?? []), activeUnit?.id]
        .map((id) => units.find((unit) => unit.id === id))
        .find((unit) => unit && depth(unit) === 1) ?? sections[0];
    const subsections = section
      ? units.filter((unit) => unit.hierarchy.parentId === section.id)
      : [];
    const subsection =
      [...(activeUnit?.hierarchy.ancestorIds ?? []), activeUnit?.id]
        .map((id) => units.find((unit) => unit.id === id))
        .find((unit) => unit && depth(unit) === 2) ?? subsections[0];
    const details = subsection
      ? units.filter(
          (unit) =>
            depth(unit) >= 3 &&
            (unit.hierarchy.parentId === subsection.id ||
              unit.hierarchy.ancestorIds.includes(subsection.id)),
        )
      : [];

    return [chapters, sections, subsections, details];
  }, [activeUnit, units]);

  const pageBounds = useMemo(() => {
    if (anchors.length === 0) return { from: 1, to: 1 };
    return {
      from: Math.min(...anchors.map((anchor) => anchor.page)),
      to: Math.max(...anchors.map((anchor) => anchor.page)),
    };
  }, [anchors]);

  const setPdfRef = useCallback((node: HTMLDivElement | null) => {
    pdfPaneRef.current = node;
    setPdfScroller(node);
  }, []);

  useEffect(() => {
    if (!data) return;
    let cancelled = false;
    let loadingTask: {
      promise: Promise<PDFDocumentProxy>;
      destroy(): Promise<void>;
    } | null = null;
    let loadedDocument: PDFDocumentProxy | null = null;

    void import("pdfjs-dist")
      .then((pdfjs) => {
        if (cancelled) return null;
        pdfjs.GlobalWorkerOptions.workerSrc = "/vendor/pdf.worker.min.mjs";
        loadingTask = pdfjs.getDocument({
          url: `/api/source-pdf?document=${activeDocument}`,
          rangeChunkSize: 262_144,
        });
        return loadingTask.promise;
      })
      .then((document) => {
        if (!cancelled && document) {
          loadedDocument = document;
          setPdfDocument(document);
        }
      })
      .catch(() => {
        if (!cancelled) setPdfError(true);
      });

    return () => {
      cancelled = true;
      if (loadedDocument) {
        void loadedDocument.destroy();
      } else {
        void loadingTask?.destroy();
      }
    };
  }, [activeDocument, data]);

  const scrollPdfToScalar = useCallback((scalar: number) => {
    const pane = pdfPaneRef.current;
    if (!pane) return;
    const page = pageFromScalar(scalar);
    const element = pane.querySelector<HTMLElement>(`[data-pdf-page="${page}"]`);
    if (!element) return;
    const fraction = clamp(scalar - page, 0, 0.96);
    lockRef.current = { target: "pdf", until: performance.now() + 90 };
    pane.scrollTop = Math.max(
      0,
      element.offsetTop + element.offsetHeight * fraction - pane.clientHeight * 0.16,
    );
    setVisiblePdfPage(page);
  }, []);

  const scrollTextToAnchor = useCallback(
    (index: number, progress = 0) => {
      const pane = textPaneRef.current;
      const anchor = anchors[index];
      if (!pane || !anchor) return;
      const element = pane.querySelector<HTMLElement>(
        `[data-text-unit="${anchor.unit.id}"]`,
      );
      if (!element) return;
      lockRef.current = { target: "text", until: performance.now() + 90 };
      pane.scrollTop = Math.max(
        0,
        element.offsetTop + element.offsetHeight * progress - pane.clientHeight * 0.12,
      );
      setActiveUnitId(anchor.unit.id);
    },
    [anchors],
  );

  const selectUnit = useCallback(
    (unit: CorpusUnit, updateUrl = true) => {
      const anchor = anchorById.get(unit.id);
      if (!anchor) return;
      setActiveUnitId(unit.id);
      scrollTextToAnchor(anchors.indexOf(anchor));
      scrollPdfToScalar(anchor.scalar);
      if (updateUrl) {
        const url = new URL(window.location.href);
        url.searchParams.set("document", unit.document);
        url.searchParams.set("unit", unit.id);
        window.history.replaceState(null, "", url);
      }
    },
    [anchorById, anchors, scrollPdfToScalar, scrollTextToAnchor],
  );

  useEffect(() => {
    if (!data || anchors.length === 0) return;
    const requested = initialUnitRef.current;
    const unit = units.find((candidate) => candidate.id === requested) ?? units[0];
    initialUnitRef.current = null;
    const frame = requestAnimationFrame(() => selectUnit(unit, false));
    return () => cancelAnimationFrame(frame);
  }, [anchors.length, data, selectUnit, units]);

  useEffect(() => {
    if (!activeUnitId) return;
    const activeButtons = document.querySelectorAll<HTMLElement>(
      `[data-index-unit="${activeUnitId}"]`,
    );
    activeButtons.forEach((button) =>
      button.scrollIntoView({ block: "nearest", inline: "nearest" }),
    );
  }, [activeUnitId]);

  const onTextScroll = useCallback(() => {
    const pane = textPaneRef.current;
    if (!pane || anchors.length === 0) return;
    if (
      lockRef.current?.target === "text" &&
      performance.now() < lockRef.current.until
    ) {
      return;
    }

    const position = pane.scrollTop + pane.clientHeight * 0.16;
    const elements = Array.from(
      pane.querySelectorAll<HTMLElement>("[data-text-unit]"),
    );
    let index = 0;
    for (let cursor = 0; cursor < elements.length; cursor += 1) {
      if (elements[cursor].offsetTop > position) break;
      index = cursor;
    }
    const element = elements[index];
    if (!element) return;
    const progress = clamp(
      (position - element.offsetTop) / Math.max(element.offsetHeight, 1),
      0,
      1,
    );
    const current = anchors[index];
    const next = anchors[index + 1];
    const scalar = current.scalar +
      progress * ((next?.scalar ?? current.scalar + 0.8) - current.scalar);

    setActiveUnitId(current.unit.id);
    scrollPdfToScalar(scalar);
  }, [anchors, scrollPdfToScalar]);

  const onPdfScroll = useCallback(() => {
    const pane = pdfPaneRef.current;
    if (!pane || anchors.length === 0) return;
    if (
      lockRef.current?.target === "pdf" &&
      performance.now() < lockRef.current.until
    ) {
      return;
    }

    const position = pane.scrollTop + pane.clientHeight * 0.16;
    const pages = Array.from(
      pane.querySelectorAll<HTMLElement>("[data-pdf-page]"),
    );
    let pageElement = pages[0];
    for (const candidate of pages) {
      if (candidate.offsetTop > position) break;
      pageElement = candidate;
    }
    if (!pageElement) return;
    const page = Number(pageElement.dataset.pdfPage);
    const fraction = clamp(
      (position - pageElement.offsetTop) / Math.max(pageElement.offsetHeight, 1),
      0,
      0.99,
    );
    const scalar = page + fraction;
    const index = findAnchorIndex(anchors, scalar);
    const current = anchors[index];
    const next = anchors[index + 1];
    const progress = next
      ? clamp((scalar - current.scalar) / (next.scalar - current.scalar), 0, 1)
      : 0;

    setVisiblePdfPage(page);
    scrollTextToAnchor(index, progress);
  }, [anchors, scrollTextToAnchor]);

  function changeDocument(document: DocumentId) {
    if (document === activeDocument || !data) return;
    const first = data.units.find((unit) => unit.document === document);
    initialUnitRef.current = first?.id ?? null;
    setActiveDocument(document);
    setActiveUnitId(first?.id ?? null);
    setPdfDocument(null);
    setPdfError(false);
    const url = new URL(window.location.href);
    url.searchParams.set("document", document);
    if (first) url.searchParams.set("unit", first.id);
    window.history.replaceState(null, "", url);
  }

  if (loadError) {
    return (
      <main className="comparison-fatal">
        <strong>Il corpus non è disponibile.</strong>
        <span>Rigenera i dati del viewer e ricarica la pagina.</span>
      </main>
    );
  }

  return (
    <main className="comparison-shell">
      <aside className="comparison-index" aria-label="Indice gerarchico">
        <nav className="comparison-document-switch" aria-label="Documento">
          {documentOrder.map((document) => (
            <button
              type="button"
              key={document}
              className={activeDocument === document ? "active" : ""}
              onClick={() => changeDocument(document)}
            >
              {document === "ntc2018" ? "Solo NTC" : "Solo Circolare"}
            </button>
          ))}
          <Link href="/" title="Apri il viewer analitico" aria-label="Apri il viewer analitico">
            ↗
          </Link>
        </nav>

        <div className="comparison-index-grid">
          {hierarchy.map((level, levelIndex) => (
            <section className="comparison-index-cell" key={levelIndex}>
              <header>
                <span>
                  {levelIndex === 0
                    ? "Capitoli"
                    : levelIndex === 1
                      ? "Paragrafi"
                      : levelIndex === 2
                        ? "Sottoparagrafi"
                        : "Sottosottoparagrafi"}
                </span>
                <b>{level.length}</b>
              </header>
              <div className="comparison-index-list">
                {level.map((unit) => (
                  <button
                    type="button"
                    key={unit.id}
                    data-index-unit={unit.id}
                    className={
                      activeUnitId === unit.id
                        ? "active"
                        : activePathIds.has(unit.id)
                          ? "in-path"
                          : ""
                    }
                    onClick={() => selectUnit(unit)}
                    title={`${unit.numbering.official} ${unit.title}`}
                  >
                    <strong>{unit.numbering.official}</strong>
                    <span>{unit.title}</span>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      </aside>

      <article
        className="comparison-text-pane"
        ref={textPaneRef}
        onScroll={onTextScroll}
        aria-label="Testo trascritto continuo"
      >
        {!data ? (
          <LoadingPanel label="Caricamento del testo…" />
        ) : (
          <div className="comparison-text-flow">
            {units.map((unit) => (
              <section
                className={`comparison-unit comparison-unit-depth-${Math.min(depth(unit), 4)}`}
                data-text-unit={unit.id}
                data-pdf-page={anchorById.get(unit.id)?.page}
                key={unit.id}
              >
                <h2>
                  <span>{unit.numbering.official}</span>
                  {unit.title}
                </h2>
                <div className="comparison-unit-blocks">
                  {unit.blocks
                    .filter((block) => !isRepeatedUnitTitle(unit, block))
                    .map((block) => (
                      <div
                        className={`comparison-block comparison-block-${block.kind}`}
                        key={block.blockId}
                      >
                        <BlockContent block={block} data={data} showRaw={false} />
                      </div>
                    ))}
                </div>
              </section>
            ))}
            <div className="comparison-end-note">Fine del documento trascritto.</div>
          </div>
        )}
      </article>

      <aside
        className="comparison-pdf-pane"
        ref={setPdfRef}
        onScroll={onPdfScroll}
        aria-label="PDF ufficiale"
      >
        <div className="comparison-pdf-status" aria-live="polite">
          <strong>{data?.documents[activeDocument].shortLabel ?? "PDF"}</strong>
          <span>
            pagina {visiblePdfPage ?? pageBounds.from} / {pdfDocument?.numPages ?? "…"}
          </span>
          {data && (
            <a
              href={data.documents[activeDocument].sourceUrl}
              target="_blank"
              rel="noreferrer"
            >
              originale ↗
            </a>
          )}
        </div>
        {pdfError ? (
          <div className="comparison-pdf-error">
            <strong>Anteprima PDF non disponibile.</strong>
            <span>Puoi comunque aprire la fonte ufficiale dal collegamento qui sopra.</span>
          </div>
        ) : !pdfDocument ? (
          <LoadingPanel label="Apertura del PDF ufficiale…" />
        ) : (
          <div className="comparison-pdf-pages">
            {Array.from(
              { length: pageBounds.to - pageBounds.from + 1 },
              (_, index) => pageBounds.from + index,
            ).map((page) => (
              <PdfPage
                document={pdfDocument}
                pageNumber={page}
                root={pdfScroller}
                key={`${activeDocument}-${page}`}
              />
            ))}
          </div>
        )}
      </aside>
    </main>
  );
}

function PdfPage({
  document,
  pageNumber,
  root,
}: {
  document: PDFDocumentProxy;
  pageNumber: number;
  root: HTMLDivElement | null;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [shouldRender, setShouldRender] = useState(false);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame || !root) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setShouldRender(true);
      },
      { root, rootMargin: "1400px 0px" },
    );
    observer.observe(frame);
    return () => observer.disconnect();
  }, [root]);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const observer = new ResizeObserver(([entry]) => {
      setWidth(Math.floor(entry.contentRect.width));
    });
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !shouldRender || width <= 0) return;
    let cancelled = false;
    let renderTask: RenderTask | null = null;

    void document.getPage(pageNumber).then((page) => {
      if (cancelled) return;
      const baseViewport = page.getViewport({ scale: 1 });
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.75);
      const cssScale = width / baseViewport.width;
      const viewport = page.getViewport({ scale: cssScale * pixelRatio });
      const context = canvas.getContext("2d", { alpha: false });
      if (!context) return;
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      canvas.style.width = `${Math.floor(viewport.width / pixelRatio)}px`;
      canvas.style.height = `${Math.floor(viewport.height / pixelRatio)}px`;
      renderTask = page.render({
        canvas,
        canvasContext: context,
        viewport,
      } as Parameters<typeof page.render>[0]);
      return renderTask.promise;
    }).catch(() => undefined);

    return () => {
      cancelled = true;
      renderTask?.cancel();
    };
  }, [document, pageNumber, shouldRender, width]);

  return (
    <section
      className="comparison-pdf-page"
      data-pdf-page={pageNumber}
      ref={frameRef}
    >
      <span>{pageNumber}</span>
      <canvas ref={canvasRef} aria-label={`Pagina PDF ${pageNumber}`} />
    </section>
  );
}

function LoadingPanel({ label }: { label: string }) {
  return (
    <div className="comparison-loading">
      <span />
      <strong>{label}</strong>
    </div>
  );
}
