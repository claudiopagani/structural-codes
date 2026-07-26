"use client";

import {
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { CSSProperties } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";

export type DocumentId = "ntc2018" | "circ2019";
type ViewId = "corpus" | "roadmap";

export interface Evidence {
  sourceId: string;
  pdfPage: number;
  printedPage: string | null;
  region: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  transformations?: Array<{
    operation: string;
    note: string;
  }>;
  rawSha256: string;
  normalizedSha256: string;
}

export interface CorpusBlock {
  blockId: string;
  kind: string;
  origin: string;
  text?: {
    raw: string;
    normalized: string;
    normalizationVersion: string;
    inline?: Array<
      | {
          kind: "text";
          value: string;
        }
      | {
          kind: "math";
          value: string;
          latex: string;
        }
    >;
  };
  assetId?: string;
  evidence?: Evidence;
}

interface FormulaAsset {
  id: string;
  officialNumber: string | null;
  pdfPage: number;
  latex: string;
}

interface TableCell {
  text: string;
  latex?: string;
  colSpan?: number;
  rowSpan?: number;
}

interface TableAsset {
  id: string;
  officialNumber: string | null;
  pdfPage: number;
  caption: string | null;
  headers: TableCell[][];
  rows: TableCell[][];
  notes: string[];
}

interface FigureAsset {
  id: string;
  officialNumber: string;
  pdfPage: number;
  caption: string;
  alt: string;
  imagePath: string;
}

interface OpenIssue {
  issueId: string;
  type: string;
  severity: "blocking" | "warning" | "info";
  note: string;
}

interface Relation {
  relationId: string;
  type: string;
  targetUnitId: string;
  basis: string;
  rationale: string;
  review: {
    status: string;
  };
}

export interface CorpusUnit {
  id: string;
  document: DocumentId;
  kind: string;
  numbering: {
    official: string;
    sortKey: string;
  };
  title: string;
  hierarchy: {
    parentId: string | null;
    ancestorIds: string[];
    position: number;
  };
  validity: {
    from: string | null;
    to: string | null;
    status: string;
    asOf: string;
  };
  blocks: CorpusBlock[];
  relations: Relation[];
  workflow: {
    status: string;
    openIssues: OpenIssue[];
  };
}

export interface CorpusData {
  generatedAt: string;
  fingerprintSha256: string;
  status: string;
  disclaimer: string;
  stats: {
    units: number;
    blocks: number;
    proposedRelations: number;
    sourceReviewCompleted: number;
    assetCandidateUnits: number;
  };
  documents: Record<
    DocumentId,
    {
      shortLabel: string;
      label: string;
      sourceUrl: string;
      publicationUrl: string;
      localSourcePath: string;
      units: number;
      blocks: number;
      pages: { from: number; to: number };
    }
  >;
  assets: {
    status: string;
    formulas: Record<string, FormulaAsset>;
    tables: Record<string, TableAsset>;
    figures: Record<string, FigureAsset>;
  };
  units: CorpusUnit[];
}

const labels = {
  extracted: "Estratto",
  chapter: "Capitolo",
  section: "Sezione",
  subsection: "Sottosezione",
  paragraph: "Paragrafo",
  "list-item": "Voce elenco",
  subparagraph: "Sottoparagrafo",
  heading: "Titolo",
  "formula-ref": "Formula",
  "table-ref": "Tabella",
  "figure-ref": "Figura",
  "normalization-review": "Verifica fonte",
  "asset-review": "Asset",
  other: "Estrazione",
} as const;

const closureStages = [
  {
    index: "01",
    title: "Confermare il testo",
    metric: "0 / 333",
    description:
      "Confronto integrale di ogni blocco con il render ufficiale, con firma della review di fonte.",
    state: "prossimo",
  },
  {
    index: "02",
    title: "Separare gli asset",
    metric: "0 / 122",
    description:
      "Formule, tabelle e figure diventano entità autonome con regione, trascrizione e hash.",
    state: "aperto",
  },
  {
    index: "03",
    title: "Validare i collegamenti",
    metric: "0 / 89",
    description:
      "Le relazioni Circolare → NTC passano da proposta editoriale a collegamento revisionato.",
    state: "aperto",
  },
  {
    index: "04",
    title: "Seconda revisione",
    metric: "0 / 333",
    description:
      "Una review normativa indipendente verifica struttura, significato tecnico e completezza.",
    state: "bloccato",
  },
  {
    index: "05",
    title: "Recuperare C7",
    metric: "56 pagine",
    description:
      "OCR tracciato della Circolare C7, confronto visuale rafforzato e allineamento con NTC 7.",
    state: "pipeline dedicata",
  },
  {
    index: "06",
    title: "Pubblicare il lotto",
    metric: "release 0.1",
    description:
      "Solo unità senza issue bloccanti, con doppia review e gate di rilascio verde.",
    state: "bloccato",
  },
] as const;

function displayLabel(value: string) {
  return labels[value as keyof typeof labels] ?? value;
}

function unitDepth(unit: CorpusUnit) {
  return Math.min(unit.hierarchy.ancestorIds.length, 4);
}

function idSuffix(id: string) {
  return id.split(":").at(-1) ?? id;
}

function searchHaystack(unit: CorpusUnit) {
  return [
    unit.numbering.official,
    unit.title,
    ...unit.blocks.map((block) => block.text?.normalized ?? ""),
  ]
    .join(" ")
    .toLocaleLowerCase("it");
}

export function CorpusViewer() {
  const [data, setData] = useState<CorpusData | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [view, setView] = useState<ViewId>("corpus");
  const [activeDocument, setActiveDocument] =
    useState<DocumentId>("ntc2018");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [issueOnly, setIssueOnly] = useState(false);
  const [showRaw, setShowRaw] = useState(false);
  const [mobilePanel, setMobilePanel] = useState<"index" | "article" | "evidence">(
    "article",
  );
  const searchRef = useRef<HTMLInputElement>(null);
  const deferredQuery = useDeferredValue(query.trim().toLocaleLowerCase("it"));

  useEffect(() => {
    fetch("/data/corpus.json")
      .then((response) => {
        if (!response.ok) throw new Error("Corpus non disponibile");
        return response.json() as Promise<CorpusData>;
      })
      .then((corpus) => {
        setData(corpus);
        const requested = new URL(window.location.href).searchParams.get("unit");
        const initial =
          corpus.units.find((unit) => unit.id === requested) ??
          corpus.units.find(
            (unit) =>
              unit.document === "ntc2018" &&
              unit.numbering.official === "4.1",
          ) ??
          corpus.units[0];
        if (initial) {
          setSelectedId(initial.id);
          setActiveDocument(initial.document);
        }
      })
      .catch(() => setLoadError(true));
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.key === "/" &&
        document.activeElement?.tagName.toLowerCase() !== "input"
      ) {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const units = useMemo(() => {
    if (!data) return [];
    return data.units.filter((unit) => {
      if (unit.document !== activeDocument) return false;
      if (issueOnly && unit.workflow.openIssues.length === 0) return false;
      if (!deferredQuery) return true;
      return searchHaystack(unit).includes(deferredQuery);
    });
  }, [activeDocument, data, deferredQuery, issueOnly]);

  const selectedUnit =
    data?.units.find((unit) => unit.id === selectedId) ?? units[0] ?? null;
  const selectedDocument = selectedUnit
    ? data?.documents[selectedUnit.document]
    : null;

  function selectUnit(unit: CorpusUnit) {
    setSelectedId(unit.id);
    setActiveDocument(unit.document);
    setMobilePanel("article");
    const url = new URL(window.location.href);
    url.searchParams.set("unit", unit.id);
    window.history.replaceState(null, "", url);
  }

  function changeDocument(document: DocumentId) {
    setActiveDocument(document);
    const firstUnit = data?.units.find((unit) => unit.document === document);
    if (firstUnit) selectUnit(firstUnit);
  }

  function openSection41() {
    const section = data?.units.find(
      (unit) =>
        unit.document === "ntc2018" && unit.numbering.official === "4.1",
    );
    if (section) selectUnit(section);
    setView("corpus");
  }

  if (loadError) {
    return (
      <main className="fatal-state">
        <span className="eyebrow">Structural Codes</span>
        <h1>Il corpus non è stato caricato.</h1>
        <p>Rigenera i dati del visualizzatore e ricarica la pagina.</p>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <button
          className="brand"
          type="button"
          onClick={() => setView("corpus")}
          aria-label="Apri il corpus"
        >
          <span className="brand-mark" aria-hidden="true">
            SC
          </span>
          <span>
            <strong>Structural Codes</strong>
            <small>Corpus normativo verificabile</small>
          </span>
        </button>

        <nav className="view-switcher" aria-label="Sezioni principali">
          <button
            type="button"
            className={view === "corpus" ? "active" : ""}
            onClick={() => setView("corpus")}
          >
            Corpus
          </button>
          <button
            type="button"
            className={view === "roadmap" ? "active" : ""}
            onClick={() => setView("roadmap")}
          >
            Piano di chiusura
          </button>
        </nav>

        <div className="status-cluster">
          <span className="status-dot" aria-hidden="true" />
          <span>Estratto · non pubblicabile</span>
        </div>
      </header>

      {view === "roadmap" ? (
        <Roadmap data={data} onOpenSection={openSection41} />
      ) : (
        <>
          <section className="corpus-toolbar">
            <div className="document-tabs" aria-label="Documento">
              {(["ntc2018", "circ2019"] as const).map((document) => (
                <button
                  type="button"
                  key={document}
                  className={activeDocument === document ? "active" : ""}
                  onClick={() => changeDocument(document)}
                >
                  {data?.documents[document].shortLabel ?? displayLabel(document)}
                  <span>{data?.documents[document].units ?? "—"}</span>
                </button>
              ))}
            </div>
            <label className="search-field">
              <span aria-hidden="true">⌕</span>
              <input
                ref={searchRef}
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Cerca numero, titolo o testo…"
                aria-label="Cerca nel corpus"
              />
              <kbd>/</kbd>
            </label>
            <label className="issue-filter">
              <input
                type="checkbox"
                checked={issueOnly}
                onChange={(event) => setIssueOnly(event.target.checked)}
              />
              <span>Con issue</span>
            </label>
          </section>

          <nav
            className="mobile-tabs"
            aria-label="Pannelli del visualizzatore"
          >
            {(["index", "article", "evidence"] as const).map((panel) => (
              <button
                key={panel}
                type="button"
                className={mobilePanel === panel ? "active" : ""}
                onClick={() => setMobilePanel(panel)}
              >
                {panel === "index"
                  ? "Indice"
                  : panel === "article"
                    ? "Testo"
                    : "Evidence"}
              </button>
            ))}
          </nav>

          <div className="viewer-grid">
            <aside
              className={`unit-index mobile-${mobilePanel === "index" ? "show" : "hide"}`}
            >
              <div className="panel-heading">
                <span>Indice canonico</span>
                <strong>{units.length}</strong>
              </div>
              <div className="unit-list">
                {!data ? (
                  <LoadingRows />
                ) : units.length === 0 ? (
                  <div className="empty-state">
                    Nessuna unità corrisponde ai filtri.
                  </div>
                ) : (
                  units.map((unit) => {
                    const blocking = unit.workflow.openIssues.filter(
                      (issue) => issue.severity === "blocking",
                    ).length;
                    return (
                      <button
                        type="button"
                        className={`unit-row ${selectedUnit?.id === unit.id ? "active" : ""}`}
                        key={unit.id}
                        style={
                          {
                            "--depth": unitDepth(unit),
                          } as CSSProperties
                        }
                        onClick={() => selectUnit(unit)}
                        aria-current={
                          selectedUnit?.id === unit.id ? "page" : undefined
                        }
                      >
                        <span className="unit-number">
                          {unit.numbering.official}
                        </span>
                        <span className="unit-title">{unit.title}</span>
                        {blocking > 0 && (
                          <span
                            className="issue-count"
                            title={`${blocking} issue bloccanti`}
                          >
                            {blocking}
                          </span>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </aside>

            <article
              className={`article-pane mobile-${mobilePanel === "article" ? "show" : "hide"}`}
            >
              {selectedUnit ? (
                <>
                  <header className="article-header">
                    <div className="article-kicker">
                      <span>{selectedDocument?.shortLabel}</span>
                      <i aria-hidden="true">/</i>
                      <span>{displayLabel(selectedUnit.kind)}</span>
                    </div>
                    <div className="article-title-row">
                      <span className="article-number">
                        {selectedUnit.numbering.official}
                      </span>
                      <h1>{selectedUnit.title}</h1>
                    </div>
                    <div className="article-meta">
                      <span className="state-pill">
                        {displayLabel(selectedUnit.workflow.status)}
                      </span>
                      <span>
                        {selectedUnit.blocks.length}{" "}
                        {selectedUnit.blocks.length === 1 ? "blocco" : "blocchi"}
                      </span>
                      <span>
                        aggiornato al {selectedUnit.validity.asOf}
                      </span>
                      <button
                        type="button"
                        className="text-button"
                        onClick={() => setShowRaw((current) => !current)}
                      >
                        {showRaw ? "Mostra normalizzato" : "Mostra raw"}
                      </button>
                    </div>
                  </header>

                  <div className="normative-copy">
                    {selectedUnit.blocks.map((block, index) => (
                      <section
                        className={`text-block ${block.kind === "heading" ? "heading-block" : ""} ${block.kind === "list-item" ? "list-item-block" : ""} ${block.assetId ? "asset-block" : ""}`}
                        key={block.blockId}
                      >
                        <div className="block-gutter">
                          <span>{String(index + 1).padStart(2, "0")}</span>
                          {block.evidence && (
                            <span title="Pagina PDF">
                              p.{block.evidence.pdfPage}
                            </span>
                          )}
                        </div>
                        <div>
                          <span className="block-kind">
                            {displayLabel(block.kind)}
                          </span>
                          <BlockContent
                            block={block}
                            data={data}
                            showRaw={showRaw}
                          />
                          {block.evidence?.transformations &&
                            block.evidence.transformations.length > 0 && (
                              <details className="transformations">
                                <summary>
                                  {block.evidence.transformations.length}{" "}
                                  trasformazioni tracciate
                                </summary>
                                <ul>
                                  {block.evidence.transformations.map(
                                    (transformation, transformationIndex) => (
                                      <li
                                        key={`${transformation.operation}-${transformationIndex}`}
                                      >
                                        <strong>
                                          {transformation.operation}
                                        </strong>
                                        {transformation.note}
                                      </li>
                                    ),
                                  )}
                                </ul>
                              </details>
                            )}
                        </div>
                      </section>
                    ))}
                  </div>
                </>
              ) : (
                <div className="article-loading">
                  <span className="eyebrow">Caricamento</span>
                  <h1>Preparazione del testo normativo…</h1>
                </div>
              )}
            </article>

            <aside
              className={`evidence-pane mobile-${mobilePanel === "evidence" ? "show" : "hide"}`}
            >
              {selectedUnit && selectedDocument ? (
                <>
                  <section className="rail-section">
                    <div className="panel-heading">
                      <span>Tracciabilità</span>
                      <span className="verified-chip">fonte ufficiale</span>
                    </div>
                    <dl className="trace-list">
                      <div>
                        <dt>Documento</dt>
                        <dd>{selectedDocument.shortLabel}</dd>
                      </div>
                      <div>
                        <dt>Unit ID</dt>
                        <dd title={selectedUnit.id}>
                          {idSuffix(selectedUnit.id)}
                        </dd>
                      </div>
                      <div>
                        <dt>Pagine PDF</dt>
                        <dd>
                          {[
                            ...new Set(
                              selectedUnit.blocks
                                .map((block) => block.evidence?.pdfPage)
                                .filter(Boolean),
                            ),
                          ].join(", ") || "—"}
                        </dd>
                      </div>
                      <div>
                        <dt>Stato</dt>
                        <dd>{displayLabel(selectedUnit.workflow.status)}</dd>
                      </div>
                    </dl>
                    <div className="source-actions">
                      <a
                        href={selectedDocument.publicationUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Scheda Gazzetta ↗
                      </a>
                      <a
                        href={selectedDocument.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        PDF ufficiale ↗
                      </a>
                    </div>
                  </section>

                  <section className="rail-section">
                    <div className="panel-heading">
                      <span>Issue aperte</span>
                      <strong>{selectedUnit.workflow.openIssues.length}</strong>
                    </div>
                    <div className="issue-list">
                      {selectedUnit.workflow.openIssues.map((issue) => (
                        <div
                          className={`issue-card severity-${issue.severity}`}
                          key={issue.issueId}
                        >
                          <span>
                            {displayLabel(issue.type)} ·{" "}
                            {displayLabel(issue.severity)}
                          </span>
                          <p>{issue.note}</p>
                        </div>
                      ))}
                    </div>
                  </section>

                  {selectedUnit.relations.length > 0 && (
                    <section className="rail-section">
                      <div className="panel-heading">
                        <span>Relazioni</span>
                        <strong>{selectedUnit.relations.length}</strong>
                      </div>
                      <div className="relation-list">
                        {selectedUnit.relations.map((relation) => (
                          <button
                            type="button"
                            key={relation.relationId}
                            onClick={() => {
                              const target = data?.units.find(
                                (unit) => unit.id === relation.targetUnitId,
                              );
                              if (target) selectUnit(target);
                            }}
                          >
                            <span>
                              {displayLabel(relation.type)} ·{" "}
                              {relation.review.status}
                            </span>
                            <strong>{idSuffix(relation.targetUnitId)}</strong>
                            <p>{relation.rationale}</p>
                          </button>
                        ))}
                      </div>
                    </section>
                  )}

                  <section className="rail-section hash-section">
                    <div className="panel-heading">
                      <span>Integrità</span>
                    </div>
                    <p>Fingerprint del lotto</p>
                    <code>{data?.fingerprintSha256}</code>
                  </section>
                </>
              ) : (
                <LoadingRows />
              )}
            </aside>
          </div>
        </>
      )}
    </main>
  );
}

function latexMarkup(latex: string, displayMode: boolean) {
  return {
    __html: katex.renderToString(latex, {
      displayMode,
      throwOnError: false,
      strict: "warn",
      output: "html",
    }),
  };
}

function MathCell({ cell }: { cell: TableCell }) {
  if (!cell.latex) return cell.text;
  return (
    <span
      className="table-math"
      dangerouslySetInnerHTML={latexMarkup(cell.latex, false)}
    />
  );
}

function BlockContent({
  block,
  data,
  showRaw,
}: {
  block: CorpusBlock;
  data: CorpusData | null;
  showRaw: boolean;
}) {
  if (block.text) {
    if (showRaw || !block.text.inline) {
      return <p>{showRaw ? block.text.raw : block.text.normalized}</p>;
    }
    return (
      <p>
        {block.text.inline.map((segment, index) =>
          segment.kind === "math" ? (
            <span
              className="inline-math"
              // The canonical normalized value remains available in the title.
              title={segment.value}
              key={`${segment.value}-${index}`}
              dangerouslySetInnerHTML={latexMarkup(segment.latex, false)}
            />
          ) : (
            <span key={`text-${index}`}>{segment.value}</span>
          ),
        )}
      </p>
    );
  }

  if (!block.assetId || !data) {
    return <p className="asset-missing">Asset non disponibile.</p>;
  }

  const formula = data.assets.formulas[block.assetId];
  if (formula) {
    return (
      <figure className="formula-asset">
        <div
          className="formula-scroll"
          dangerouslySetInnerHTML={latexMarkup(formula.latex, true)}
        />
        <figcaption>
          <span>
            {formula.officialNumber
              ? `[${formula.officialNumber}]`
              : "Formula non numerata"}
          </span>
          <em>trascrizione da verificare</em>
        </figcaption>
      </figure>
    );
  }

  const table = data.assets.tables[block.assetId];
  if (table) {
    return (
      <figure className="table-asset">
        <figcaption>
          <strong>
            {table.officialNumber
              ? `Tab. ${table.officialNumber}`
              : "Tabella non numerata"}
          </strong>
          {table.caption && <span> — {table.caption}</span>}
          <em>trascrizione da verificare</em>
        </figcaption>
        <div className="table-scroll">
          <table>
            <thead>
              {table.headers.map((row, rowIndex) => (
                <tr key={`head-${rowIndex}`}>
                  {row.map((cell, cellIndex) => (
                    <th
                      colSpan={cell.colSpan}
                      rowSpan={cell.rowSpan}
                      key={`head-${rowIndex}-${cellIndex}`}
                    >
                      <MathCell cell={cell} />
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.rows.map((row, rowIndex) => (
                <tr key={`body-${rowIndex}`}>
                  {row.map((cell, cellIndex) => (
                    <td
                      colSpan={cell.colSpan}
                      rowSpan={cell.rowSpan}
                      key={`body-${rowIndex}-${cellIndex}`}
                    >
                      <MathCell cell={cell} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {table.notes.length > 0 && (
          <ul className="table-notes">
            {table.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        )}
      </figure>
    );
  }

  const figure = data.assets.figures[block.assetId];
  if (figure) {
    return (
      <figure className="figure-asset">
        <img src={`/assets/${figure.imagePath}`} alt={figure.alt} />
        <figcaption>
          <span>{figure.caption}</span>
          <em>ritaglio della fonte ufficiale</em>
        </figcaption>
      </figure>
    );
  }

  return <p className="asset-missing">Asset non risolto: {block.assetId}</p>;
}

function Roadmap({
  data,
  onOpenSection,
}: {
  data: CorpusData | null;
  onOpenSection: () => void;
}) {
  return (
    <div className="roadmap-view">
      <section className="roadmap-hero">
        <div>
          <span className="eyebrow">Dall’estrazione alla pubblicazione</span>
          <h1>La struttura c’è. Ora va resa autorevole.</h1>
          <p>
            Il lotto prioritario è completo come estrazione canonica, ma la
            conclusione editoriale richiede review umane, asset verificati e
            relazioni confermate. Questa è la sequenza che impedisce di
            trasformare un corpus plausibile in una falsa fonte normativa.
          </p>
        </div>
        <div className="completion-ring" aria-label="Avanzamento strutturale 46%">
          <strong>46%</strong>
          <span>struttura editoriale</span>
        </div>
      </section>

      <section className="metric-strip">
        <div>
          <strong>{data?.stats.units ?? "333"}</strong>
          <span>unità estratte</span>
        </div>
        <div>
          <strong>{data?.stats.blocks ?? "700"}</strong>
          <span>blocchi con evidence</span>
        </div>
        <div>
          <strong>{data?.stats.assetCandidateUnits ?? "122"}</strong>
          <span>unità con asset</span>
        </div>
        <div>
          <strong>{data?.stats.proposedRelations ?? "89"}</strong>
          <span>relazioni proposte</span>
        </div>
      </section>

      <section className="roadmap-content">
        <div>
          <div className="section-title">
            <span>Sequenza operativa</span>
            <p>Ogni passaggio sblocca il successivo.</p>
          </div>
          <div className="stage-list">
            {closureStages.map((stage) => (
              <article className="stage-card" key={stage.index}>
                <span className="stage-index">{stage.index}</span>
                <div>
                  <div className="stage-title">
                    <h2>{stage.title}</h2>
                    <span>{stage.state}</span>
                  </div>
                  <p>{stage.description}</p>
                </div>
                <strong>{stage.metric}</strong>
              </article>
            ))}
          </div>
        </div>

        <aside className="definition-card">
          <span className="eyebrow">Definition of done</span>
          <h2>Quando possiamo dire “concluso”</h2>
          <ul>
            <li>333 unità source-checked sul render ufficiale.</li>
            <li>Formule, tabelle e figure senza placeholder o ambiguità.</li>
            <li>Relazioni Circolare–NTC confermate da review.</li>
            <li>Due atti di revisione umana per ogni unità pubblicata.</li>
            <li>Capitolo 7 acquisito con OCR tracciato e controllato.</li>
            <li>Release guard verde e snapshot immutabile.</li>
          </ul>
          <button type="button" onClick={onOpenSection}>
            Apri il § 4.1
            <span aria-hidden="true">→</span>
          </button>
          <small>
            Priorità consigliata: § 4.1 NTC e C4.1, poi capitoli 1–3, infine
            capitolo 7.
          </small>
        </aside>
      </section>
    </div>
  );
}

function LoadingRows() {
  return (
    <div className="loading-rows" aria-label="Caricamento">
      {Array.from({ length: 8 }, (_, index) => (
        <span key={index} />
      ))}
    </div>
  );
}
