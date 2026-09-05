"use client";

import { useRouter } from "next/navigation";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { AlignedLabelList, BlockContent, groupAlignedLabelBlocks, hasLeadingEmphasisLabel, hasLeadingMath, hasNoListMarker, hasOfficialListMarker, hasTrailingMath, isRepeatedUnitTitle, listLevelClass, listMarkerClass } from "../shared/CorpusContent";
import {
  documentForMode,
  loadChunk,
  loadDocumentIndex,
  loadManifest,
  loadRelations,
  loadSearchIndex,
  type AssetBundle,
  type CorpusChunk,
  type CorpusManifest,
  type CorpusUnit,
  type DocumentId,
  type DocumentIndex,
  type RelationEdge,
  type SearchIndex,
  type UnitSummary,
  type ViewerMode,
} from "./corpusData";

export type {
  AssetBundle,
  CorpusBlock,
  CorpusChunk,
  CorpusManifest,
  CorpusUnit,
  DocumentId,
  RelationEdge,
  UnitSummary,
  ViewerMode,
} from "./corpusData";

type ViewId = "corpus" | "roadmap";

const modeOptions: Array<{ id: ViewerMode; label: string }> = [
  { id: "ntc", label: "NTC 2018" },
  { id: "circ", label: "Circolare 7/2019" },
  { id: "combined", label: "NTC 2018 + Circolare" },
];

const labels = {
  extracted: "Estratto",
  "source-checked": "Controllato sulla fonte",
  "double-reviewed": "Doppia revisione",
  published: "Pubblicato nel corpus",
  superseded: "Superato",
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
  blocking: "bloccante",
  warning: "warning",
  info: "informativa",
  clarifies: "chiarisce",
  other: "Estrazione",
} as const;

function displayLabel(value: string) {
  return labels[value as keyof typeof labels] ?? value;
}

function unitDepth(unit: UnitSummary) {
  return Math.min(unit.hierarchy.ancestorIds.length, 4);
}

function idSuffix(id: string) {
  return id.split(":").at(-1) ?? id;
}

function normalizedQuery(value: string) {
  return value.normalize("NFKC").trim().toLocaleLowerCase("it");
}

function updateDeepLink(mode: ViewerMode, unitId: string) {
  const url = new URL(window.location.href);
  url.searchParams.set("mode", mode);
  url.searchParams.set("unit", unitId);
  url.searchParams.delete("document");
  window.history.replaceState(null, "", url);
}

interface RelatedUnit {
  unit: CorpusUnit;
  chunk: CorpusChunk;
  edge: RelationEdge;
}

export function CorpusViewer() {
  const router = useRouter();
  const [manifest, setManifest] = useState<CorpusManifest | null>(null);
  const [index, setIndex] = useState<DocumentIndex | null>(null);
  const [chunk, setChunk] = useState<CorpusChunk | null>(null);
  const [related, setRelated] = useState<RelatedUnit[]>([]);
  const [searchIndex, setSearchIndex] = useState<SearchIndex | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [view, setView] = useState<ViewId>("corpus");
  const [mode, setMode] = useState<ViewerMode>("ntc");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [issueOnly, setIssueOnly] = useState(false);
  const [showRaw, setShowRaw] = useState(false);
  const [mobilePanel, setMobilePanel] = useState<"index" | "article" | "evidence">("article");
  const searchRef = useRef<HTMLInputElement>(null);
  const requestedIdRef = useRef<string | null>(null);
  const deferredQuery = useDeferredValue(normalizedQuery(query));

  useEffect(() => {
    loadManifest()
      .then((loaded) => {
        const url = new URL(window.location.href);
        const requestedMode = url.searchParams.get("mode");
        if (modeOptions.some((option) => option.id === requestedMode)) {
          setMode(requestedMode as ViewerMode);
        }
        requestedIdRef.current = url.searchParams.get("unit");
        setSelectedId(requestedIdRef.current);
        setManifest(loaded);
      })
      .catch(() => setLoadError(true));
  }, []);

  useEffect(() => {
    if (!manifest) return;
    let cancelled = false;
    const documentId = documentForMode(mode);
    loadDocumentIndex(manifest, documentId)
      .then((loaded) => {
        if (cancelled) return;
        setIndex(loaded);
        const requested = loaded.units.find(
          (unit) => unit.id === requestedIdRef.current,
        );
        const initial =
          requested ??
          loaded.units.find((unit) => unit.numbering.official === (documentId === "ntc2018" ? "4.1" : "C4.1")) ??
          loaded.units[0];
        if (initial) {
          requestedIdRef.current = initial.id;
          setSelectedId(initial.id);
          updateDeepLink(mode, initial.id);
        }
      })
      .catch(() => setLoadError(true));
    return () => {
      cancelled = true;
    };
  }, [manifest, mode]);

  const selectedSummary =
    index?.units.find((unit) => unit.id === selectedId) ?? null;

  const selectedChunkPath = selectedSummary?.chunkPath ?? null;

  useEffect(() => {
    if (!selectedChunkPath) return;
    let cancelled = false;
    loadChunk(selectedChunkPath)
      .then((loaded) => {
        if (!cancelled) setChunk(loaded);
      })
      .catch(() => setLoadError(true));
    return () => {
      cancelled = true;
    };
  }, [selectedChunkPath]);

  const selectedUnit =
    chunk?.units.find((unit) => unit.id === selectedId) ?? null;

  const selectedUnitId = selectedUnit?.id ?? null;

  useEffect(() => {
    if (!manifest || mode !== "combined" || !selectedUnitId) return;
    let cancelled = false;
    loadRelations(manifest)
      .then(async ({ relations }) => {
        const incoming = relations.filter(
          (relation) => relation.targetUnitId === selectedUnitId,
        );
        const chunks = new Map(
          await Promise.all(
            [...new Set(incoming.map((relation) => relation.sourceChunkPath))].map(
              async (path) => [path, await loadChunk(path)] as const,
            ),
          ),
        );
        const resolved = incoming
          .map((edge) => {
            const sourceChunk = chunks.get(edge.sourceChunkPath);
            const unit = sourceChunk?.units.find(
              (candidate) => candidate.id === edge.sourceUnitId,
            );
            return sourceChunk && unit ? { edge, unit, chunk: sourceChunk } : null;
          })
          .filter((entry): entry is RelatedUnit => entry !== null)
          .sort((left, right) =>
            left.unit.numbering.sortKey.localeCompare(
              right.unit.numbering.sortKey,
              "it",
              { numeric: true },
            ),
          );
        if (!cancelled) setRelated(resolved);
      })
      .catch(() => setLoadError(true));
    return () => {
      cancelled = true;
    };
  }, [manifest, mode, selectedUnitId]);

  useEffect(() => {
    if (!manifest || deferredQuery.length < 2 || searchIndex) return;
    loadSearchIndex(manifest).then(setSearchIndex).catch(() => setLoadError(true));
  }, [deferredQuery, manifest, searchIndex]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "/" && document.activeElement?.tagName.toLowerCase() !== "input") {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const matchingSearchIds = useMemo(() => {
    if (!searchIndex || !deferredQuery) return null;
    return new Set(
      searchIndex.units
        .filter((unit) =>
          `${unit.numbering} ${unit.title} ${unit.text}`
            .normalize("NFKC")
            .toLocaleLowerCase("it")
            .includes(deferredQuery),
        )
        .map((unit) => unit.id),
    );
  }, [deferredQuery, searchIndex]);

  const units = useMemo(() => {
    if (!index) return [];
    return index.units.filter((unit) => {
      if (issueOnly && unit.openIssueCount === 0) return false;
      if (!deferredQuery) return true;
      if (matchingSearchIds) return matchingSearchIds.has(unit.id);
      return `${unit.numbering.official} ${unit.title}`
        .normalize("NFKC")
        .toLocaleLowerCase("it")
        .includes(deferredQuery);
    });
  }, [deferredQuery, index, issueOnly, matchingSearchIds]);

  function selectUnit(unit: UnitSummary) {
    requestedIdRef.current = unit.id;
    setSelectedId(unit.id);
    setRelated([]);
    setMobilePanel("article");
    updateDeepLink(mode, unit.id);
  }

  function changeMode(nextMode: ViewerMode) {
    setMode(nextMode);
    setIndex(null);
    setChunk(null);
    setRelated([]);
    setQuery("");
    const currentDocument = selectedSummary?.document;
    if (
      (nextMode === "circ" && currentDocument !== "circ2019") ||
      (nextMode !== "circ" && currentDocument !== "ntc2018")
    ) {
      requestedIdRef.current = null;
      setSelectedId(null);
    }
  }

  function openSection41() {
    setView("corpus");
    setMode("ntc");
    const section = index?.units.find(
      (unit) => unit.document === "ntc2018" && unit.numbering.official === "4.1",
    );
    if (section) selectUnit(section);
  }

  if (loadError) {
    return (
      <main className="fatal-state">
        <span className="eyebrow">Structural Codes</span>
        <h1>Il corpus non è stato caricato.</h1>
        <p>Rigenera gli artefatti del visualizzatore e ricarica la pagina.</p>
      </main>
    );
  }

  const selectedDocument = selectedUnit
    ? manifest?.documents[selectedUnit.document]
    : null;

  return (
    <main className="app-shell">
      <header className="topbar">
        <button className="brand" type="button" onClick={() => setView("corpus")} aria-label="Apri il corpus">
          <span className="brand-mark" aria-hidden="true">SC</span>
          <span><strong>Structural Codes</strong><small>Corpus normativo verificabile</small></span>
        </button>
        <nav className="view-switcher" aria-label="Sezioni principali">
          <button type="button" className={view === "corpus" ? "active" : ""} onClick={() => setView("corpus")}>Corpus</button>
          <button type="button" className={view === "roadmap" ? "active" : ""} onClick={() => setView("roadmap")}>Piano di chiusura</button>
          <button type="button" onClick={() => router.push(`/consultazione?mode=${mode}${selectedId ? `&unit=${encodeURIComponent(selectedId)}` : ""}`)}>Lettura comparata</button>
        </nav>
        <div className="status-cluster"><span className="status-dot" aria-hidden="true" /><span>Prerelease alpha · corpus non validato</span></div>
      </header>

      {view === "roadmap" ? (
        <Roadmap manifest={manifest} onOpenSection={openSection41} />
      ) : (
        <>
          <section className="release-disclaimer" role="note">
            <strong>Trascrizione strutturata in review.</strong> La pubblicazione npm non equivale a validazione normativa. Verifica sempre la fonte ufficiale.
          </section>
          <section className="corpus-toolbar">
            <div className="document-tabs viewer-mode-tabs" aria-label="Modalità di consultazione">
              {modeOptions.map((option) => (
                <button type="button" key={option.id} className={mode === option.id ? "active" : ""} onClick={() => changeMode(option.id)} aria-pressed={mode === option.id}>
                  {option.label}
                  <span>{option.id === "circ" ? manifest?.documents.circ2019.units ?? "—" : manifest?.documents.ntc2018.units ?? "—"}</span>
                </button>
              ))}
            </div>
            <label className="search-field">
              <span aria-hidden="true">⌕</span>
              <input ref={searchRef} type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cerca numero, titolo o testo…" aria-label="Cerca nel corpus" />
              <kbd>/</kbd>
            </label>
            <label className="issue-filter"><input type="checkbox" checked={issueOnly} onChange={(event) => setIssueOnly(event.target.checked)} /><span>Con issue</span></label>
          </section>

          <nav className="mobile-tabs" aria-label="Pannelli del visualizzatore">
            {(["index", "article", "evidence"] as const).map((panel) => (
              <button key={panel} type="button" className={mobilePanel === panel ? "active" : ""} onClick={() => setMobilePanel(panel)}>
                {panel === "index" ? "Indice" : panel === "article" ? "Testo" : "Evidence"}
              </button>
            ))}
          </nav>

          <div className="viewer-grid">
            <aside className={`unit-index mobile-${mobilePanel === "index" ? "show" : "hide"}`}>
              <div className="panel-heading"><span>Indice canonico</span><strong>{units.length}</strong></div>
              <div className="unit-list">
                {!index ? <LoadingRows /> : units.length === 0 ? <div className="empty-state">Nessuna unità corrisponde ai filtri.</div> : units.map((unit) => (
                  <button type="button" className={`unit-row ${selectedId === unit.id ? "active" : ""}`} key={unit.id} style={{ "--depth": unitDepth(unit) } as CSSProperties} onClick={() => selectUnit(unit)} aria-current={selectedId === unit.id ? "page" : undefined}>
                    <span className="unit-number">{unit.numbering.official}</span>
                    <span className="unit-title">{unit.title}</span>
                    {unit.blockingIssueCount > 0 && <span className="issue-count" title={`${unit.blockingIssueCount} issue bloccanti`}>{unit.blockingIssueCount}</span>}
                  </button>
                ))}
              </div>
            </aside>

            <article className={`article-pane mobile-${mobilePanel === "article" ? "show" : "hide"}`}>
              {selectedUnit && chunk ? (
                <>
                  <UnitHeader unit={selectedUnit} documentLabel={selectedDocument?.shortLabel ?? ""} showRaw={showRaw} onToggleRaw={() => setShowRaw((current) => !current)} />
                  <UnitBlocks unit={selectedUnit} assets={chunk.assets} showRaw={showRaw} />
                  {mode === "combined" && (
                    <div className="combined-circular-flow" aria-label="Contenuti correlati della Circolare 7/2019">
                      {related.map(({ unit, chunk: relatedChunk, edge }) => (
                        <section className="combined-circular-unit" data-provenance="Circolare 7/2019" key={`${edge.relationId}-${unit.id}`}>
                          <header>
                            <span>Circolare 7/2019 — {unit.numbering.official}</span>
                            <h2>{unit.title}</h2>
                            {edge.review.status !== "confirmed" && <small className="relation-review-state">Collegamento editoriale da revisionare</small>}
                          </header>
                          <UnitBlocks unit={unit} assets={relatedChunk.assets} showRaw={showRaw} compact />
                          <footer>Provenienza: Circolare 7/2019 · relazione esplicita {displayLabel(edge.type)} · stato {edge.review.status}</footer>
                        </section>
                      ))}
                      {related.length === 0 && <p className="combined-empty">Nessuna relazione esplicita Circolare → NTC è registrata per questa unità. I suggerimenti basati sulla numerazione non vengono mostrati come collegamenti canonici.</p>}
                    </div>
                  )}
                </>
              ) : (
                <div className="article-loading"><span className="eyebrow">Caricamento del chunk</span><h1>Preparazione del testo normativo…</h1></div>
              )}
            </article>

            <aside className={`evidence-pane mobile-${mobilePanel === "evidence" ? "show" : "hide"}`}>
              {selectedUnit && selectedDocument && manifest ? (
                <>
                  <section className="rail-section">
                    <div className="panel-heading"><span>Tracciabilità</span><span className="verified-chip">fonte ufficiale</span></div>
                    <dl className="trace-list">
                      <div><dt>Documento</dt><dd>{selectedDocument.shortLabel}</dd></div>
                      <div><dt>Unit ID</dt><dd title={selectedUnit.id}>{idSuffix(selectedUnit.id)}</dd></div>
                      <div><dt>Pagine PDF</dt><dd>{[...new Set(selectedUnit.blocks.flatMap((block) => block.evidence?.pdfPage ? [block.evidence.pdfPage] : []))].join(", ") || "—"}</dd></div>
                      <div><dt>Workflow</dt><dd>{displayLabel(selectedUnit.workflow.status)}</dd></div>
                    </dl>
                    <div className="source-actions">
                      <a href={selectedDocument.publicationUrl} target="_blank" rel="noreferrer">Scheda Gazzetta ↗</a>
                      <a href={selectedDocument.sourceUrl} target="_blank" rel="noreferrer">PDF ufficiale ↗</a>
                    </div>
                  </section>
                  <section className="rail-section">
                    <div className="panel-heading"><span>Issue aperte</span><strong>{selectedUnit.workflow.openIssues.length}</strong></div>
                    <div className="issue-list">
                      {selectedUnit.workflow.openIssues.map((issue) => (
                        <div className={`issue-card severity-${issue.severity}`} key={issue.issueId}><span>{displayLabel(issue.type)} · {displayLabel(issue.severity)}</span><p>{issue.note}</p></div>
                      ))}
                      {selectedUnit.workflow.openIssues.length === 0 && <p className="rail-empty">Nessuna issue registrata; ciò non equivale a review completata.</p>}
                    </div>
                  </section>
                  {selectedUnit.relations.length > 0 && (
                    <section className="rail-section">
                      <div className="panel-heading"><span>Relazioni esplicite</span><strong>{selectedUnit.relations.length}</strong></div>
                      <div className="relation-list">
                        {selectedUnit.relations.map((relation) => (
                          <button type="button" key={relation.relationId} onClick={() => {
                            const targetDocument: DocumentId = relation.targetUnitId.includes(":circ2019:") ? "circ2019" : "ntc2018";
                            requestedIdRef.current = relation.targetUnitId;
                            setMode(targetDocument === "circ2019" ? "circ" : "ntc");
                            setSelectedId(relation.targetUnitId);
                            updateDeepLink(targetDocument === "circ2019" ? "circ" : "ntc", relation.targetUnitId);
                          }}>
                            <span>{displayLabel(relation.type)} · {relation.review.status}</span><strong>{idSuffix(relation.targetUnitId)}</strong><p>{relation.rationale}</p>
                          </button>
                        ))}
                      </div>
                    </section>
                  )}
                  <section className="rail-section hash-section">
                    <div className="panel-heading"><span>Integrità artefatto</span></div>
                    <p>structural-codes {manifest.structuralCodesVersion} · schema {manifest.schemaVersion}</p>
                    <code>{manifest.generatedArtifactFingerprintSha256}</code>
                    <p>Fingerprint corpus canonico</p>
                    <code>{manifest.corpusFingerprintSha256}</code>
                  </section>
                </>
              ) : <LoadingRows />}
            </aside>
          </div>
        </>
      )}
    </main>
  );
}

function UnitHeader({ unit, documentLabel, showRaw, onToggleRaw }: { unit: CorpusUnit; documentLabel: string; showRaw: boolean; onToggleRaw: () => void }) {
  return (
    <header className="article-header">
      <div className="article-kicker"><span>{documentLabel}</span><i aria-hidden="true">/</i><span>{displayLabel(unit.kind)}</span></div>
      <div className="article-title-row"><span className="article-number">{unit.numbering.official}</span><h1>{unit.title}</h1></div>
      <div className="article-meta">
        <span className="state-pill">{displayLabel(unit.workflow.status)}</span>
        <span>{unit.blocks.length} {unit.blocks.length === 1 ? "blocco" : "blocchi"}</span>
        <span>aggiornato al {unit.validity.asOf}</span>
        <button type="button" className="text-button" onClick={onToggleRaw}>{showRaw ? "Mostra normalizzato" : "Mostra raw"}</button>
      </div>
    </header>
  );
}

function legacyBlockClass(block: CorpusUnit["blocks"][number], showRaw: boolean) {
  return `text-block ${block.kind === "heading" ? "heading-block" : ""} ${block.kind === "list-item" ? "list-item-block" : ""} ${listMarkerClass(block)} ${listLevelClass(block)} ${hasOfficialListMarker(block) ? "list-item-with-official-marker" : ""} ${hasNoListMarker(block) ? "list-item-without-marker" : ""} ${hasLeadingMath(block) && !showRaw ? "list-item-with-leading-symbol" : ""} ${hasLeadingEmphasisLabel(block) && !showRaw ? "block-with-leading-label" : ""} ${hasTrailingMath(block) && !showRaw ? "list-item-with-trailing-symbol" : ""} ${block.assetId ? "asset-block" : ""}`;
}

function UnitBlocks({ unit, assets, showRaw, compact = false }: { unit: CorpusUnit; assets: AssetBundle; showRaw: boolean; compact?: boolean }) {
  const blocks = unit.blocks.filter((block) => !isRepeatedUnitTitle(unit, block));
  return (
    <div className={`normative-copy ${compact ? "normative-copy-compact" : ""}`}>
      {groupAlignedLabelBlocks(blocks, showRaw).map((group) => group.kind === "label-list"
        ? <AlignedLabelList blocks={group.blocks} assets={assets} variant="legacy" startIndex={group.startIndex} key={group.blocks[0].blockId} />
        : <section className={legacyBlockClass(group.block, showRaw)} key={group.block.blockId}>
            <div className="block-gutter"><span>{String(group.index + 1).padStart(2, "0")}</span>{group.block.evidence && <span title="Pagina PDF">p.{group.block.evidence.pdfPage}</span>}</div>
            <div>
              <span className="block-kind">{displayLabel(group.block.kind)}</span>
              <BlockContent block={group.block} assets={assets} showRaw={showRaw} />
              {group.block.evidence?.transformations && group.block.evidence.transformations.length > 0 && (
                <details className="transformations"><summary>{group.block.evidence.transformations.length} trasformazioni tracciate</summary><ul>
                  {group.block.evidence.transformations.map((transformation, transformationIndex) => (
                    <li key={`${transformation.operation}-${transformationIndex}`}><strong>{transformation.operation}</strong>{transformation.note}</li>
                  ))}
                </ul></details>
              )}
            </div>
          </section>)}
    </div>
  );
}

function Roadmap({ manifest, onOpenSection }: { manifest: CorpusManifest | null; onOpenSection: () => void }) {
  const stats = manifest?.stats;
  return (
    <div className="roadmap-view">
      <section className="roadmap-hero"><div><span className="eyebrow">Dall’estrazione alla validazione progressiva</span><h1>Il package è distribuibile. Il corpus resta in review.</h1><p>La prerelease rende dati, schema e provenance ispezionabili senza attribuire al corpus uno stato editoriale che non ha. Ogni avanzamento resta registrato per unità.</p></div><div className="completion-ring" aria-label={`${stats?.reviewedUnits ?? 0} unità revisionate`}><strong>{stats?.reviewedUnits ?? 0}</strong><span>unità revisionate</span></div></section>
      <section className="metric-strip"><div><strong>{stats?.units ?? "—"}</strong><span>unità estratte</span></div><div><strong>{stats?.blocks ?? "—"}</strong><span>blocchi con provenance</span></div><div><strong>{stats?.assetUnits ?? "—"}</strong><span>unità con asset</span></div><div><strong>{stats?.proposedRelations ?? "—"}</strong><span>relazioni proposte</span></div></section>
      <section className="roadmap-content"><div><div className="section-title"><span>Workflow machine-readable</span><p>Gli stati non sono scorciatoie legali.</p></div><div className="stage-list">
        {[
          ["01", "Estratto", `${stats?.units ?? 0} unità`, "Trascrizione strutturata con evidence; non ancora verificata integralmente sulla fonte."],
          ["02", "Source-checked", `${stats?.reviewedUnits ?? 0} completate`, "Confronto umano del record con il render ufficiale e issue risolte o dichiarate."],
          ["03", "Double-reviewed", "review indipendente", "Secondo atto di revisione qualificata, distinto dal controllo iniziale."],
          ["04", "Published / superseded", "stato editoriale", "Ingresso nel perimetro dichiarato o conservazione storica della versione superata."],
        ].map(([number, title, metric, description]) => <article className="stage-card" key={number}><span className="stage-index">{number}</span><div><div className="stage-title"><h2>{title}</h2><span>progressivo</span></div><p>{description}</p></div><strong>{metric}</strong></article>)}
      </div></div><aside className="definition-card"><span className="eyebrow">Community review</span><h2>Cosa rende accettabile una correzione</h2><ul><li>Confronto puntuale con la fonte ufficiale registrata.</li><li>Evidence, trasformazioni e hash aggiornati insieme.</li><li>Asset verificati nella posizione editoriale corretta.</li><li>Relazioni Circolare–NTC esplicite e revisionabili.</li><li>Test editoriali e release gate verdi.</li></ul><button type="button" onClick={onOpenSection}>Apri il § 4.1 <span aria-hidden="true">→</span></button><small>La release npm e la validazione del corpus restano concetti separati.</small></aside></section>
    </div>
  );
}

function LoadingRows() {
  return <div className="loading-rows" aria-label="Caricamento">{Array.from({ length: 8 }, (_, index) => <span key={index} />)}</div>;
}
