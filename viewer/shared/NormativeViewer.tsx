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
import { AlignedLabelList, BlockContent, groupAlignedLabelBlocks, hasAlphabeticListMarker, hasLeadingEmphasisLabel, hasLeadingMath, hasNoListMarker, hasOfficialListMarker, hasSimpleDashMarker, hasTrailingMath, hasTrailingStrong, indentLevelClass, isRepeatedUnitTitle, listLevelClass, listMarkerClass } from "./CorpusContent";

const modeOptions: Array<{ id: ViewerMode; label: string }> = [
  { id: "ntc", label: "Solo NTC 2018" },
  { id: "circ", label: "Solo Circolare 7/2019" },
  { id: "combined", label: "NTC 2018 + Circolare 7/2019" },
];
const hierarchyLabels = ["Capitoli", "Paragrafi", "Sottoparagrafi"];

function scvBlockClass(block: CorpusUnit["blocks"][number]) {
  return `scv-block scv-block-${block.kind} ${hasOfficialListMarker(block) ? "list-item-with-official-marker" : ""} ${hasAlphabeticListMarker(block) ? "list-item-with-alphabetic-marker" : ""} ${hasSimpleDashMarker(block) ? "list-item-with-simple-dash" : ""} ${hasNoListMarker(block) ? "list-item-without-marker" : ""} ${listMarkerClass(block)} ${listLevelClass(block)} ${indentLevelClass(block)} ${hasLeadingMath(block) ? "list-item-with-leading-symbol" : ""} ${hasLeadingEmphasisLabel(block) ? "block-with-leading-label" : ""} ${hasTrailingStrong(block) ? "list-item-with-trailing-siglum" : ""} ${hasTrailingMath(block) ? "list-item-with-trailing-symbol" : ""}`;
}

function ScvBlockFlow({ blocks, assets, assetsBaseUrl }: { blocks: CorpusUnit["blocks"]; assets: CorpusChunk["assets"]; assetsBaseUrl: string }) {
  return <div className="scv-unit-blocks">{groupAlignedLabelBlocks(blocks).map((group) => group.kind === "label-list"
    ? <AlignedLabelList blocks={group.blocks} assets={assets} assetsBaseUrl={assetsBaseUrl} key={group.blocks[0].blockId} />
    : <div className={scvBlockClass(group.block)} key={group.block.blockId}><BlockContent block={group.block} assets={assets} assetsBaseUrl={assetsBaseUrl} /></div>)}</div>;
}

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
  className,
}: NormativeViewerProps) {
  const [manifest, setManifest] = useState<CorpusManifest | null>(null);
  const [index, setIndex] = useState<DocumentIndex | null>(null);
  const [documentRecords, setDocumentRecords] = useState<UnitRecord[]>([]);
  const [loadedDocumentKey, setLoadedDocumentKey] = useState("");
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
  const scrollRequestRef = useRef<string | null>(null);
  const activeIdRef = useRef<string | null>(null);
  const textPaneRef = useRef<HTMLElement>(null);
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
      const initial = requested ?? loaded.units.find((unit) => depth(unit) === 0) ?? loaded.units[0];
      if (initial) {
        requestedIdRef.current = initial.id;
        scrollRequestRef.current = initial.id;
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

  const documentChunkPaths = useMemo(
    () => manifest?.chunks.filter((entry) => entry.document === documentId).map((entry) => entry.path) ?? [],
    [documentId, manifest],
  );
  const documentKey = `${documentId}:${index?.units.length ?? 0}:${documentChunkPaths.join("|")}`;
  const documentLoading = Boolean(index) && (documentRecords.length === 0 || loadedDocumentKey !== documentKey);

  useEffect(() => {
    if (!index || documentChunkPaths.length === 0) return;
    let cancelled = false;
    Promise.all(documentChunkPaths.map(async (path) => [path, await loadChunk(path, dataBaseUrl)] as const)).then((loadedChunks) => {
      if (cancelled) return;
      const chunks = new Map(loadedChunks);
      const records = index.units.flatMap((summary) => {
        const loadedChunk = chunks.get(summary.chunkPath);
        const unit = loadedChunk?.units.find((candidate) => candidate.id === summary.id);
        return loadedChunk && unit ? [{ summary, unit, chunk: loadedChunk }] : [];
      });
      setDocumentRecords(records);
      setLoadedDocumentKey(documentKey);
    }).catch(() => {
      if (!cancelled) setLoadError(true);
    });
    return () => { cancelled = true; };
  }, [dataBaseUrl, documentChunkPaths, documentKey, index]);

  const activeRecord = documentRecords.find(({ unit }) => unit.id === activeUnitId) ?? null;
  const chunk = activeRecord?.chunk ?? null;

  useEffect(() => {
    if (!manifest || mode !== "combined") return;
    let cancelled = false;
    loadRelations(manifest, dataBaseUrl).then(({ relations: loadedRelations }) => {
      if (!cancelled) setRelations(loadedRelations);
    }).catch(() => setLoadError(true));
    return () => { cancelled = true; };
  }, [dataBaseUrl, manifest, mode]);

  useEffect(() => {
    if (mode !== "combined" || documentRecords.length === 0 || relations.length === 0) return;
    let cancelled = false;
    const targetIds = new Set(documentRecords.map(({ unit }) => unit.id));
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
  }, [dataBaseUrl, documentRecords, mode, relations]);

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

  const chapters = index?.units.filter((unit) => depth(unit) === 0) ?? [];
  const paragraphs = activeChapterId ? index?.units.filter((unit) => depth(unit) === 1 && unit.hierarchy.parentId === activeChapterId) ?? [] : [];
  const subparagraphs = activeParagraphId ? index?.units.filter((unit) => depth(unit) === 2 && unit.hierarchy.parentId === activeParagraphId) ?? [] : [];
  const hierarchy: UnitSummary[][] = [chapters, paragraphs, subparagraphs];

  const activePages = activeRecord ? evidencePages(activeRecord.unit, activeRecord.chunk) : [];
  const pageBounds = activePages.length > 0 ? { from: Math.min(...activePages), to: Math.max(...activePages) } : { from: 1, to: 1 };

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
    scrollRequestRef.current = unit.id;
    setActiveUnitId(unit.id);
    updateDeepLink(mode, unit.id, defaultMode);
    if (activeUnitId === unit.id && documentRecords.length > 0) {
      requestAnimationFrame(() => textPaneRef.current?.querySelector(`[data-scv-text-unit="${CSS.escape(unit.id)}"]`)?.scrollIntoView({ block: "start" }));
    }
  }

  useEffect(() => {
    if (!scrollRequestRef.current || documentLoading || documentRecords.length === 0) return;
    const targetId = scrollRequestRef.current;
    const target = textPaneRef.current?.querySelector(`[data-scv-text-unit="${CSS.escape(targetId)}"]`);
    if (!target) return;
    scrollRequestRef.current = null;
    requestAnimationFrame(() => target.scrollIntoView({ block: "start" }));
  }, [activeUnitId, documentLoading, documentRecords]);

  useEffect(() => {
    activeIdRef.current = activeUnitId;
  }, [activeUnitId]);

  useEffect(() => {
    const root = textPaneRef.current;
    if (!root || documentLoading || documentRecords.length === 0) return;
    const elements = [...root.querySelectorAll<HTMLElement>("[data-scv-text-unit]")];
    if (elements.length === 0) return;
    let frame: number | null = null;
    const updateFromScroll = () => {
      frame = null;
      const rootRect = root.getBoundingClientRect();
      const marker = rootRect.top + Math.min(rootRect.height * 0.28, 220);
      let candidate: HTMLElement | null = null;
      for (const element of elements) {
        const elementRect = element.getBoundingClientRect();
        if (elementRect.top <= marker && elementRect.bottom > rootRect.top) candidate = element;
        else if (elementRect.top > marker) break;
      }
      const nextId = candidate?.dataset.scvTextUnit;
      if (!nextId || nextId === activeIdRef.current) return;
      activeIdRef.current = nextId;
      requestedIdRef.current = nextId;
      setActiveUnitId(nextId);
      updateDeepLink(mode, nextId, defaultMode);
    };
    const onScroll = () => {
      if (frame === null) frame = requestAnimationFrame(updateFromScroll);
    };
    root.addEventListener("scroll", onScroll, { passive: true });
    frame = requestAnimationFrame(updateFromScroll);
    return () => {
      root.removeEventListener("scroll", onScroll);
      if (frame !== null) cancelAnimationFrame(frame);
    };
  }, [defaultMode, documentLoading, documentRecords, mode]);

  function changeMode(nextMode: ViewerMode, preferredUnitId: string | null = null) {
    const keepCurrent = activeSummary && (nextMode === "combined" ? activeSummary.document === "ntc2018" : activeSummary.document === documentForMode(nextMode));
    requestedIdRef.current = preferredUnitId ?? (keepCurrent ? activeSummary?.id ?? null : null);
    setMode(nextMode);
    setIndex(null);
    setDocumentRecords([]);
    setLoadedDocumentKey("");
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
  const documentNote = documentId === "ntc2018"
    ? `Documento continuo · NTC 2018 · ${documentRecords.length} unità · ${documentChunkPaths.length} chunk`
    : `Documento continuo · Circolare 7/2019 · ${documentRecords.length} unità · ${documentChunkPaths.length} chunk`;

  function renderRecord({ unit, chunk: unitChunk }: UnitRecord) {
    const isChapter = depth(unit) === 0;

    return <section className={`scv-unit scv-unit-depth-${Math.min(depth(unit), 4)}`} data-scv-text-unit={unit.id} key={unit.id}>
      {isChapter ? <h2 className="scv-chapter-heading"><span className="scv-chapter-badge"><span className="scv-chapter-badge-label">Capitolo</span><strong>{unit.numbering.official}.</strong></span><span className="scv-chapter-rule" aria-hidden="true" /><span className="scv-chapter-title">{unit.title}</span></h2> : <h2><span className="scv-unit-number">{unit.numbering.official}</span><span className="scv-unit-title">{unit.title}</span></h2>}
      <ScvBlockFlow blocks={unit.blocks.filter((block) => !isRepeatedUnitTitle(unit, block))} assets={unitChunk.assets} assetsBaseUrl={assetsBaseUrl} />
      {mode === "combined" && (relatedByTarget.get(unit.id) ?? []).map(({ edge, unit: relatedUnit, chunk: relatedChunk }) => <section className="scv-related-unit" data-provenance="Circolare 7/2019" key={edge.relationId}><header><h3><span className="scv-related-number">{relatedUnit.numbering.official}</span><span className="scv-related-title">{relatedUnit.title}</span></h3></header><ScvBlockFlow blocks={relatedUnit.blocks.filter((block) => !isRepeatedUnitTitle(relatedUnit, block))} assets={relatedChunk.assets} assetsBaseUrl={assetsBaseUrl} /></section>)}
    </section>;
  }

  if (loadError) return <main className="scv-fatal"><strong>Il corpus non è disponibile.</strong><span>Rigenera gli artefatti del viewer e ricarica la pagina.</span></main>;

  return <div className={`scv-root ${auxiliaryVisible ? "scv-has-auxiliary" : ""} ${className ?? ""}`}>
    <aside className="scv-index-pane" aria-label="Indice gerarchico">
      <div className="scv-search-toolbar">
        <div className="scv-mode-controls" aria-label="Modalità documento">
          <button ref={settingsButtonRef} type="button" className="scv-settings-button" onClick={() => setSettingsOpen(true)} aria-label="Impostazioni consultazione" aria-haspopup="dialog"><span aria-hidden="true">⚙</span></button>
          {modeOptions.map((option) => <button type="button" key={option.id} className={`scv-mode-button ${mode === option.id ? "active" : ""}`} onClick={() => changeMode(option.id)} aria-label={option.label} aria-pressed={mode === option.id} title={option.label}><span>{option.id === "ntc" ? "NTC" : option.id === "circ" ? "Circ." : "Integrata"}</span></button>)}
        </div>
        <div className="scv-search-box">
          <form className="scv-search-form" role="search" onSubmit={submitSearch}>
            <span aria-hidden="true">⌕</span>
            <input ref={searchRef} type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cerca nella normativa…" aria-label="Cerca nella normativa" />
            {query && <button type="button" className="scv-clear-search" onClick={() => setQuery("")} aria-label="Cancella ricerca">×</button>}
            <kbd>/</kbd>
          </form>
          {deferredQuery.length >= 2 && <div className="scv-search-results" role="listbox" aria-label="Risultati ricerca">
            {!searchIndex ? <p className="scv-search-status">Caricamento indice di ricerca…</p> : searchResults.length === 0 ? <p className="scv-search-status">Nessun risultato nella modalità corrente.</p> : searchResults.map((result) => <button type="button" role="option" aria-selected={false} className="scv-search-result" key={result.id} onClick={() => selectSearchResult(result)}><span>{result.document === "ntc2018" ? "NTC 2018" : "Circolare 7/2019"} · {result.numbering}</span><strong>{result.title}</strong><small>{snippet(result.text || result.title)}</small></button>)}
          </div>}
        </div>
      </div>
      <div className="scv-index-grid">
        {hierarchy.map((level, levelIndex) => {
          const activeLevelId = [activeChapterId, activeParagraphId, activeSubparagraphId][levelIndex];
          return <section className="scv-index-cell" key={levelIndex}><header><span>{hierarchyLabels[levelIndex]}</span><b>{level.length}</b></header><div className="scv-index-list">{!index ? <LoadingRows /> : level.length === 0 ? <p className="scv-index-empty">Seleziona il livello superiore.</p> : level.map((unit) => <button type="button" key={unit.id} data-index-unit={unit.id} className={activeLevelId === unit.id ? "active" : ""} onClick={() => selectUnit(unit)} title={`${unit.numbering.official} ${unit.title}`} aria-current={activeLevelId === unit.id ? "page" : undefined}><strong>{unit.numbering.official}</strong><span>{unit.title}</span></button>)}</div></section>;
        })}
      </div>
    </aside>

    <article ref={textPaneRef} className="scv-text-pane" aria-label="Corpus JSON">
      {documentLoading || documentRecords.length === 0 ? <LoadingPanel label="Caricamento del documento completo…" /> : <div className="scv-text-flow"><p className="scv-chunk-note">{documentNote} · structural-codes {documentRecords[0].chunk.structuralCodesVersion}</p>
        {documentRecords.map(renderRecord)}
        <div className="scv-end-note">Fine del documento.</div>
      </div>}
    </article>

    {auxiliaryVisible && renderAuxiliary && <aside className="scv-auxiliary-pane" aria-label={auxiliaryPanelLabel}>{renderAuxiliary}</aside>}

    {settingsOpen && <div className="scv-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSettingsOpen(false); }}><section className="scv-dialog" role="dialog" aria-modal="true" aria-labelledby="scv-settings-title"><header><h2 id="scv-settings-title">Impostazioni consultazione</h2><button ref={dialogCloseRef} type="button" onClick={() => setSettingsOpen(false)} aria-label="Chiudi impostazioni">×</button></header><label className="scv-auxiliary-toggle"><input type="checkbox" checked={auxiliaryVisible} disabled={!hasAuxiliary} onChange={(event) => setAuxiliaryVisible(event.target.checked)} />Mostra PDF ufficiale</label></section></div>}
  </div>;
}

function LoadingRows() {
  return <div className="scv-loading-rows" aria-label="Caricamento">{Array.from({ length: 7 }, (_, index) => <span key={index} />)}</div>;
}

function LoadingPanel({ label }: { label: string }) {
  return <div className="scv-loading"><span /><strong>{label}</strong></div>;
}

export { modeOptions };
