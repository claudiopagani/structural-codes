"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  documentForMode,
  loadChunk,
  loadDocumentIndex,
  loadManifest,
  loadRelations,
  loadSearchIndex,
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
import { BlockContent, hasOfficialListMarker, hasTrailingMath, hasTrailingStrong, isRepeatedUnitTitle } from "./CorpusContent";

const modeOptions: Array<{ id: ViewerMode; label: string }> = [
  { id: "combined", label: "NTC 2018 + Circolare 7/2019" },
  { id: "ntc", label: "Solo NTC 2018" },
  { id: "circ", label: "Solo Circolare 7/2019" },
];
const hierarchyLabels = ["Capitoli", "Paragrafi", "Sottoparagrafi", "Dettagli"];
const maxContinuousChapterBytes = 2_500_000;
const maxContinuousChapterUnits = 220;

export interface AuxiliaryPanelContext {
  mode: ViewerMode;
  documentId: DocumentId;
  manifest: CorpusManifest;
  chunk: CorpusChunk | null;
  pageBounds: { from: number; to: number };
}

export type AuxiliaryPanel = ReactNode | ((context: AuxiliaryPanelContext) => ReactNode);

export interface NormativeViewerProps {
  defaultMode?: ViewerMode;
  dataBaseUrl?: string;
  assetsBaseUrl?: string;
  auxiliaryPanel?: AuxiliaryPanel;
  auxiliaryPanelLabel?: string;
  auxiliaryPanelDefaultVisible?: boolean;
  analyticalHref?: string | ((mode: ViewerMode, unitId: string | null) => string);
  className?: string;
}

interface RelatedRecord { edge: RelationEdge; unit: CorpusUnit; chunk: CorpusChunk; }
interface UnitRecord { summary: UnitSummary; unit: CorpusUnit; chunk: CorpusChunk; }

function depth(unit: UnitSummary | CorpusUnit) {
  return unit.hierarchy.ancestorIds.length;
}

function ancestorIdAtDepth(unit: UnitSummary | CorpusUnit, targetDepth: number) {
  return depth(unit) === targetDepth ? unit.id : unit.hierarchy.ancestorIds[targetDepth] ?? null;
}

function containsUnit(unit: UnitSummary, ancestorId: string) {
  return unit.id === ancestorId || unit.hierarchy.ancestorIds.includes(ancestorId);
}

function normalizedQuery(value: string) {
  return value.normalize("NFKC").trim().toLocaleLowerCase("it");
}

function updateDeepLink(mode: ViewerMode, unitId: string, defaultMode: ViewerMode) {
  const url = new URL(window.location.href);
  if (mode === defaultMode) url.searchParams.delete("mode");
  else url.searchParams.set("mode", mode);
  url.searchParams.set("unit", unitId);
  window.history.replaceState(null, "", url);
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

function snippet(value: string) {
  const compact = value.replace(/\s+/gu, " ").trim();
  return compact.length > 145 ? `${compact.slice(0, 142)}…` : compact;
}

function relationTargets(resultId: string, relations: RelationEdge[]) {
  return relations
    .filter((edge) => edge.sourceUnitId === resultId)
    .sort((left, right) => left.targetUnitId.localeCompare(right.targetUnitId, "it", { numeric: true }));
}

export function NormativeViewer({
  defaultMode = "combined",
  dataBaseUrl = "/data/codes",
  assetsBaseUrl = "/assets",
  auxiliaryPanel,
  auxiliaryPanelLabel = "PDF ufficiale",
  auxiliaryPanelDefaultVisible = false,
  analyticalHref,
  className,
}: NormativeViewerProps) {
  const [manifest, setManifest] = useState<CorpusManifest | null>(null);
  const [index, setIndex] = useState<DocumentIndex | null>(null);
  const [chunk, setChunk] = useState<CorpusChunk | null>(null);
  const [scopeRecords, setScopeRecords] = useState<UnitRecord[]>([]);
  const [loadedScopeKey, setLoadedScopeKey] = useState("");
  const [mode, setMode] = useState<ViewerMode>(defaultMode);
  const [activeUnitId, setActiveUnitId] = useState<string | null>(null);
  const [relations, setRelations] = useState<RelationEdge[]>([]);
  const [relatedByTarget, setRelatedByTarget] = useState<Map<string, RelatedRecord[]>>(new Map());
  const [searchIndex, setSearchIndex] = useState<SearchIndex | null>(null);
  const [query, setQuery] = useState("");
  const [loadError, setLoadError] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [auxiliaryVisible, setAuxiliaryVisible] = useState(Boolean(auxiliaryPanel && auxiliaryPanelDefaultVisible));
  const searchRef = useRef<HTMLInputElement>(null);
  const settingsButtonRef = useRef<HTMLButtonElement>(null);
  const dialogCloseRef = useRef<HTMLButtonElement>(null);
  const requestedIdRef = useRef<string | null>(null);
  const deferredQuery = normalizedQuery(query);
  const hasAuxiliary = Boolean(auxiliaryPanel);

  useEffect(() => {
    loadManifest(dataBaseUrl).then((loaded) => {
      const url = new URL(window.location.href);
      const requestedMode = url.searchParams.get("mode");
      if (modeOptions.some((option) => option.id === requestedMode)) setMode(requestedMode as ViewerMode);
      requestedIdRef.current = url.searchParams.get("unit");
      setActiveUnitId(requestedIdRef.current);
      setManifest(loaded);
    }).catch(() => setLoadError(true));
  }, [dataBaseUrl]);

  const documentId = documentForMode(mode);

  useEffect(() => {
    if (!manifest) return;
    let cancelled = false;
    loadDocumentIndex(manifest, documentId, dataBaseUrl).then((loaded) => {
      if (cancelled) return;
      setIndex(loaded);
      const requested = loaded.units.find((unit) => unit.id === requestedIdRef.current);
      const initial = requested ?? loaded.units.find((unit) => unit.numbering.official === (documentId === "ntc2018" ? "4.1" : "C4.1")) ?? loaded.units[0];
      if (initial) {
        requestedIdRef.current = initial.id;
        setActiveUnitId(initial.id);
        updateDeepLink(mode, initial.id, defaultMode);
      }
    }).catch(() => setLoadError(true));
    return () => { cancelled = true; };
  }, [dataBaseUrl, defaultMode, documentId, manifest, mode]);

  const activeSummary = index?.units.find((unit) => unit.id === activeUnitId) ?? null;

  const activeChapterId = activeSummary ? ancestorIdAtDepth(activeSummary, 0) : null;
  const activeParagraphId = activeSummary && depth(activeSummary) >= 1 ? ancestorIdAtDepth(activeSummary, 1) : null;
  const activeSubparagraphId = activeSummary && depth(activeSummary) >= 2 ? ancestorIdAtDepth(activeSummary, 2) : null;

  const scope = useMemo(() => {
    if (!index || !activeSummary || !activeChapterId) {
      return { mode: "paragraph" as const, summaries: [] as UnitSummary[], chapterId: null as string | null, paragraphId: null as string | null };
    }
    const chapterSummaries = index.units.filter((unit) => containsUnit(unit, activeChapterId));
    const chunkBytes = new Map((manifest?.chunks ?? []).map((entry) => [entry.path, entry.bytes]));
    const chapterBytes = [...new Set(chapterSummaries.map((unit) => unit.chunkPath))].reduce((total, path) => total + (chunkBytes.get(path) ?? 0), 0);
    const chapterCanBeContinuous = chapterSummaries.length <= maxContinuousChapterUnits && chapterBytes <= maxContinuousChapterBytes;
    if (depth(activeSummary) === 0 && chapterCanBeContinuous) {
      return { mode: "chapter" as const, summaries: chapterSummaries, chapterId: activeChapterId, paragraphId: null };
    }
    if (depth(activeSummary) === 0) {
      const paragraphSummaries = index.units.filter((unit) => unit.hierarchy.parentId === activeChapterId && depth(unit) === 1);
      const chapter = index.units.find((unit) => unit.id === activeChapterId);
      return { mode: "paragraph" as const, summaries: [chapter, ...paragraphSummaries].filter(Boolean) as UnitSummary[], chapterId: activeChapterId, paragraphId: null };
    }
    const paragraphId = activeParagraphId ?? activeChapterId;
    return { mode: "paragraph" as const, summaries: index.units.filter((unit) => containsUnit(unit, paragraphId)), chapterId: activeChapterId, paragraphId };
  }, [activeChapterId, activeParagraphId, activeSummary, index, manifest]);

  const scopePaths = useMemo(() => [...new Set(scope.summaries.map((unit) => unit.chunkPath))], [scope.summaries]);
  const scopeKey = useMemo(() => scope.summaries.map((unit) => unit.id).join("|"), [scope.summaries]);
  const scopeLoading = scope.summaries.length > 0 && loadedScopeKey !== scopeKey;

  useEffect(() => {
    if (!activeSummary) return;
    let cancelled = false;
    loadChunk(activeSummary.chunkPath, dataBaseUrl).then((loaded) => {
      if (!cancelled) setChunk(loaded);
    }).catch(() => setLoadError(true));
    return () => { cancelled = true; };
  }, [activeSummary, dataBaseUrl]);

  useEffect(() => {
    if (!scope.summaries.length) return;
    let cancelled = false;
    Promise.all(scopePaths.map(async (path) => [path, await loadChunk(path, dataBaseUrl)] as const)).then((loadedChunks) => {
      if (cancelled) return;
      const chunks = new Map(loadedChunks);
      const records = scope.summaries.flatMap((summary) => {
        const loadedChunk = chunks.get(summary.chunkPath);
        const unit = loadedChunk?.units.find((candidate) => candidate.id === summary.id);
        return loadedChunk && unit ? [{ summary, unit, chunk: loadedChunk }] : [];
      });
      setScopeRecords(records);
      setLoadedScopeKey(scopeKey);
    }).catch(() => {
      if (!cancelled) {
        setLoadError(true);
      }
    });
    return () => { cancelled = true; };
  }, [dataBaseUrl, scope.summaries, scopeKey, scopePaths]);

  useEffect(() => {
    if (!manifest || mode !== "combined") return;
    let cancelled = false;
    loadRelations(manifest, dataBaseUrl).then(({ relations: loadedRelations }) => {
      if (!cancelled) setRelations(loadedRelations);
    }).catch(() => setLoadError(true));
    return () => { cancelled = true; };
  }, [dataBaseUrl, manifest, mode]);

  useEffect(() => {
    if (mode !== "combined" || scopeRecords.length === 0 || relations.length === 0) return;
    let cancelled = false;
    const targetIds = new Set(scopeRecords.map(({ unit }) => unit.id));
    const incoming = relations.filter((edge) => targetIds.has(edge.targetUnitId));
    Promise.all([...new Set(incoming.map((edge) => edge.sourceChunkPath))].map(async (path) => [path, await loadChunk(path, dataBaseUrl)] as const)).then((loadedChunks) => {
      if (cancelled) return;
      const relatedChunks = new Map(loadedChunks);
      const grouped = new Map<string, RelatedRecord[]>();
      for (const edge of incoming) {
        const sourceChunk = relatedChunks.get(edge.sourceChunkPath);
        const unit = sourceChunk?.units.find((candidate) => candidate.id === edge.sourceUnitId);
        if (!sourceChunk || !unit) continue;
        const group = grouped.get(edge.targetUnitId) ?? [];
        group.push({ edge, unit, chunk: sourceChunk });
        grouped.set(edge.targetUnitId, group);
      }
      for (const group of grouped.values()) group.sort((left, right) => left.unit.numbering.sortKey.localeCompare(right.unit.numbering.sortKey, "it", { numeric: true }));
      setRelatedByTarget(grouped);
    }).catch(() => { if (!cancelled) setLoadError(true); });
    return () => { cancelled = true; };
  }, [dataBaseUrl, mode, relations, scopeRecords]);

  useEffect(() => {
    if (!manifest || deferredQuery.length < 2 || searchIndex) return;
    loadSearchIndex(manifest, dataBaseUrl).then(setSearchIndex).catch(() => setLoadError(true));
  }, [dataBaseUrl, deferredQuery, manifest, searchIndex]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "/" && window.document.activeElement?.tagName.toLowerCase() !== "input") {
        event.preventDefault();
        searchRef.current?.focus();
      }
      if (event.key === "Escape" && settingsOpen) setSettingsOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [settingsOpen]);

  useEffect(() => {
    if (settingsOpen) dialogCloseRef.current?.focus();
    else settingsButtonRef.current?.focus();
  }, [settingsOpen]);

  const hierarchy = useMemo(() => {
    if (!index) return [[], [], [], []] as UnitSummary[][];
    const chapters = index.units.filter((unit) => depth(unit) === 0);
    const paragraphs = activeChapterId ? index.units.filter((unit) => depth(unit) === 1 && unit.hierarchy.parentId === activeChapterId) : [];
    const subparagraphs = activeParagraphId ? index.units.filter((unit) => depth(unit) === 2 && unit.hierarchy.parentId === activeParagraphId) : [];
    const detailsAnchor = activeSubparagraphId ?? activeParagraphId;
    const details = detailsAnchor ? index.units.filter((unit) => depth(unit) >= 3 && unit.hierarchy.ancestorIds.includes(detailsAnchor)) : [];
    return [chapters, paragraphs, subparagraphs, details];
  }, [activeChapterId, activeParagraphId, activeSubparagraphId, index]);

  const pageBounds = useMemo(() => {
    if (!scopeRecords.length) return { from: 1, to: 1 };
    const pages = scopeRecords.flatMap(({ unit, chunk: loadedChunk }) => evidencePages(unit, loadedChunk));
    return pages.length > 0 ? { from: Math.min(...pages), to: Math.max(...pages) } : { from: 1, to: 1 };
  }, [scopeRecords]);

  const searchResults = useMemo(() => {
    if (!searchIndex || deferredQuery.length < 2) return [];
    return searchIndex.units.filter((unit) => {
      if (mode === "ntc" && unit.document !== "ntc2018") return false;
      if (mode === "circ" && unit.document !== "circ2019") return false;
      return `${unit.numbering} ${unit.title} ${unit.text}`.normalize("NFKC").toLocaleLowerCase("it").includes(deferredQuery);
    }).slice(0, 12);
  }, [deferredQuery, mode, searchIndex]);

  function selectUnit(unit: UnitSummary) {
    requestedIdRef.current = unit.id;
    setActiveUnitId(unit.id);
    updateDeepLink(mode, unit.id, defaultMode);
  }

  useEffect(() => {
    if (scopeLoading || !activeUnitId || scopeRecords.length === 0) return;
    requestAnimationFrame(() => window.document.querySelector(`[data-scv-text-unit="${CSS.escape(activeUnitId)}"]`)?.scrollIntoView({ block: "start" }));
  }, [activeUnitId, scopeLoading, scopeRecords]);

  function changeMode(nextMode: ViewerMode, preferredUnitId: string | null = null) {
    const keepCurrent = activeSummary && (nextMode === "combined" ? activeSummary.document === "ntc2018" : activeSummary.document === documentForMode(nextMode));
    requestedIdRef.current = preferredUnitId ?? (keepCurrent ? activeSummary?.id ?? null : null);
    setMode(nextMode);
    setIndex(null);
    setChunk(null);
    setScopeRecords([]);
    setRelatedByTarget(new Map());
    setSettingsOpen(false);
  }

  function selectSearchResult(result: SearchIndex["units"][number]) {
    setQuery("");
    if (result.document === "ntc2018" && index) {
      const summary = index.units.find((unit) => unit.id === result.id);
      if (summary) selectUnit(summary);
      return;
    }
    const explicit = mode === "combined" ? relationTargets(result.id, relations)[0] : null;
    if (explicit && index) {
      const summary = index.units.find((unit) => unit.id === explicit.targetUnitId);
      if (summary) selectUnit(summary);
      return;
    }
    if (mode === "combined") changeMode("circ", result.id);
  }

  function submitSearch(event: { preventDefault(): void }) {
    event.preventDefault();
    if (searchResults[0]) selectSearchResult(searchResults[0]);
  }

  const renderAuxiliary: ReactNode = !manifest
    ? null
    : typeof auxiliaryPanel === "function"
      ? auxiliaryPanel({ mode, documentId, manifest, chunk, pageBounds })
      : auxiliaryPanel;
  const analyticalUrl = analyticalHref ? (typeof analyticalHref === "function" ? analyticalHref(mode, activeUnitId) : analyticalHref) : null;
  const scopeNote = scope.mode === "chapter"
    ? `Continuità capitolo ${activeSummary?.numbering.official ?? ""} · ${scope.summaries.length} unità · ${scopePaths.length} chunk`
    : scope.paragraphId
      ? `Continuità paragrafo ${index?.units.find((unit) => unit.id === scope.paragraphId)?.numbering.official ?? ""} · ${scope.summaries.length} unità · ${scopePaths.length} chunk`
      : `Capitolo ${activeSummary?.numbering.official ?? ""} · continuità ridotta ai paragrafi per la dimensione del capitolo`;

  function renderRecord({ unit, chunk: unitChunk }: UnitRecord) {
    return <section className={`scv-unit scv-unit-depth-${Math.min(depth(unit), 4)}`} data-scv-text-unit={unit.id} key={unit.id}>
      <h2><span>{unit.numbering.official}</span>{unit.title}</h2>
      <div className="scv-unit-blocks">{unit.blocks.filter((block) => !isRepeatedUnitTitle(unit, block)).map((block) => <div className={`scv-block scv-block-${block.kind} ${hasOfficialListMarker(block) ? "list-item-with-official-marker" : ""} ${hasTrailingStrong(block) ? "list-item-with-trailing-siglum" : ""} ${hasTrailingMath(block) ? "list-item-with-trailing-symbol" : ""}`} key={block.blockId}><BlockContent block={block} assets={unitChunk.assets} assetsBaseUrl={assetsBaseUrl} /></div>)}</div>
      {mode === "combined" && (relatedByTarget.get(unit.id) ?? []).map(({ edge, unit: relatedUnit, chunk: relatedChunk }) => <section className="scv-related-unit" data-provenance="Circolare 7/2019" key={edge.relationId}><header><h3><span>{relatedUnit.numbering.official}</span>{relatedUnit.title}</h3></header><div className="scv-unit-blocks">{relatedUnit.blocks.filter((block) => !isRepeatedUnitTitle(relatedUnit, block)).map((block) => <div className={`scv-block scv-block-${block.kind} ${hasOfficialListMarker(block) ? "list-item-with-official-marker" : ""} ${hasTrailingStrong(block) ? "list-item-with-trailing-siglum" : ""} ${hasTrailingMath(block) ? "list-item-with-trailing-symbol" : ""}`} key={block.blockId}><BlockContent block={block} assets={relatedChunk.assets} assetsBaseUrl={assetsBaseUrl} /></div>)}</div></section>)}
    </section>;
  }

  if (loadError) return <main className="scv-fatal"><strong>Il corpus non è disponibile.</strong><span>Rigenera gli artefatti del viewer e ricarica la pagina.</span></main>;

  return <div className={`scv-root ${auxiliaryVisible ? "scv-has-auxiliary" : ""} ${className ?? ""}`}>
    <aside className="scv-index-pane" aria-label="Indice gerarchico">
      <div className="scv-search-toolbar">
        <form className="scv-search-form" role="search" onSubmit={submitSearch}>
          <span aria-hidden="true">⌕</span>
          <input ref={searchRef} type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cerca nella normativa…" aria-label="Cerca nella normativa" />
          {query && <button type="button" className="scv-clear-search" onClick={() => setQuery("")} aria-label="Cancella ricerca">×</button>}
          <kbd>/</kbd>
        </form>
        <button ref={settingsButtonRef} type="button" className="scv-settings-button" onClick={() => setSettingsOpen(true)} aria-label="Impostazioni consultazione" aria-haspopup="dialog"><span aria-hidden="true">⚙</span></button>
        {deferredQuery.length >= 2 && <div className="scv-search-results" role="listbox" aria-label="Risultati ricerca">
          {!searchIndex ? <p className="scv-search-status">Caricamento indice di ricerca…</p> : searchResults.length === 0 ? <p className="scv-search-status">Nessun risultato nella modalità corrente.</p> : searchResults.map((result) => <button type="button" role="option" aria-selected={false} className="scv-search-result" key={result.id} onClick={() => selectSearchResult(result)}><span>{result.document === "ntc2018" ? "NTC 2018" : "Circolare 7/2019"} · {result.numbering}</span><strong>{result.title}</strong><small>{snippet(result.text || result.title)}</small></button>)}
        </div>}
      </div>
      <div className="scv-index-grid">
        {hierarchy.map((level, levelIndex) => <section className="scv-index-cell" key={levelIndex}><header><span>{hierarchyLabels[levelIndex]}</span><b>{level.length}</b></header><div className="scv-index-list">{!index ? <LoadingRows /> : level.map((unit) => <button type="button" key={unit.id} data-index-unit={unit.id} className={activeUnitId === unit.id ? "active" : ""} onClick={() => selectUnit(unit)} title={`${unit.numbering.official} ${unit.title}`} aria-current={activeUnitId === unit.id ? "page" : undefined}><strong>{unit.numbering.official}</strong><span>{unit.title}</span></button>)}</div></section>)}
      </div>
    </aside>

    <article className="scv-text-pane" aria-label="Corpus JSON">
      {scopeLoading || scope.summaries.length === 0 || scopeRecords.length === 0 ? <LoadingPanel label="Caricamento della continuità normativa…" /> : <div className="scv-text-flow"><p className="scv-chunk-note">{scopeNote} · structural-codes {scopeRecords[0].chunk.structuralCodesVersion}</p>
        {scopeRecords.map(renderRecord)}
        <div className="scv-end-note">Fine della continuità caricata.</div>
      </div>}
    </article>

    {auxiliaryVisible && renderAuxiliary && <aside className="scv-auxiliary-pane" aria-label={auxiliaryPanelLabel}>{renderAuxiliary}</aside>}

    {settingsOpen && <div className="scv-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSettingsOpen(false); }}><section className="scv-dialog" role="dialog" aria-modal="true" aria-labelledby="scv-settings-title"><header><h2 id="scv-settings-title">Impostazioni consultazione</h2><button ref={dialogCloseRef} type="button" onClick={() => setSettingsOpen(false)} aria-label="Chiudi impostazioni">×</button></header><fieldset><legend>Visualizzazione</legend>{modeOptions.map((option) => <label key={option.id}><input type="radio" name="scv-mode" value={option.id} checked={mode === option.id} onChange={() => changeMode(option.id)} />{option.label}</label>)}</fieldset>{hasAuxiliary && <label className="scv-auxiliary-toggle"><input type="checkbox" checked={auxiliaryVisible} onChange={(event) => setAuxiliaryVisible(event.target.checked)} />Mostra {auxiliaryPanelLabel.toLowerCase()}</label>}{analyticalUrl && <a className="scv-analytical-link" href={analyticalUrl}>Apri viewer analitico</a>}</section></div>}
  </div>;
}

function LoadingRows() {
  return <div className="scv-loading-rows" aria-label="Caricamento">{Array.from({ length: 7 }, (_, index) => <span key={index} />)}</div>;
}

function LoadingPanel({ label }: { label: string }) {
  return <div className="scv-loading"><span /><strong>{label}</strong></div>;
}

export { modeOptions };
