import { useEffect, useMemo, useRef, useState } from "react";
import {
  parseNormativeReference,
  resolveDataPath,
  type CorpusManifest,
  type DocumentLookup,
  type SearchResult,
  type UnitSummary,
  type ViewerMode,
} from "./corpusData";

type SearchStatus = "idle" | "loading" | "ready" | "error";

interface WorkerResultsMessage {
  type: "results";
  requestId: number;
  query: string;
  mode: ViewerMode;
  results: SearchResult[];
  durationMs: number;
}

interface WorkerErrorMessage {
  type: "error";
  requestId: number;
  message: string;
}

function resultForSummary(summary: UnitSummary): SearchResult {
  const prefix = summary.numbering.official;
  return {
    id: summary.id,
    document: summary.document,
    numbering: prefix,
    title: summary.title,
    chunkPath: summary.chunkPath,
    snippet: `${prefix} — ${summary.title}`,
    highlights: [[0, prefix.length]],
    score: 4_000_000,
    matchKind: "number-exact",
  };
}

export function resolveExactSearch(query: string, mode: ViewerMode, lookup: DocumentLookup | null, circLookup: DocumentLookup | null) {
  const reference = parseNormativeReference(query);
  if (!reference) return null;
  let summary: UnitSummary | undefined;
  if (reference.documentHint === "circ2019") {
    if (mode !== "ntc") summary = circLookup?.unitByNumbering.get(reference.numbering);
  } else if (mode === "circ") summary = circLookup?.unitByNumbering.get(reference.numbering);
  else summary = lookup?.unitByNumbering.get(reference.numbering) ?? (mode === "combined" ? circLookup?.unitByNumbering.get(reference.numbering) : undefined);
  return summary ? [resultForSummary(summary)] : [];
}

function useDebouncedValue(value: string, delayMs: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [delayMs, value]);
  return debounced;
}

export function useViewerSearch({ query, mode, manifest, dataBaseUrl, lookup, circLookup, maxResults, debounceMs = 80 }: {
  query: string;
  mode: ViewerMode;
  manifest: CorpusManifest | null;
  dataBaseUrl: string;
  lookup: DocumentLookup | null;
  circLookup: DocumentLookup | null;
  maxResults: number;
  debounceMs?: number;
}) {
  const maximum = Math.max(1, Math.min(50, maxResults));
  const debouncedQuery = useDebouncedValue(query, debounceMs);
  const exactResults = useMemo(() => resolveExactSearch(query, mode, lookup, circLookup), [circLookup, lookup, mode, query]);
  const [workerResponse, setWorkerResponse] = useState<{ query: string; mode: ViewerMode; status: SearchStatus; results: SearchResult[]; durationMs: number | null; errorMessage?: string } | null>(null);
  const [indexRequested, setIndexRequested] = useState(false);
  const workerRef = useRef<Worker | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => () => workerRef.current?.terminate(), []);

  useEffect(() => {
    if (!manifest || exactResults !== null || debouncedQuery.trim().length < 2) {
      requestIdRef.current += 1;
      return;
    }
    const scheduleFailure = (errorMessage: string) => {
      const timer = window.setTimeout(() => {
        setWorkerResponse({ query: debouncedQuery, mode, status: "error", results: [], durationMs: null, errorMessage });
      }, 0);
      return () => window.clearTimeout(timer);
    };
    let worker = workerRef.current;
    if (!worker) {
      if (typeof Worker === "undefined") {
        return scheduleFailure("Web Worker non disponibile in questo browser.");
      }
      try {
        worker = new Worker(new URL("./searchWorker.js", import.meta.url), { type: "module", name: "structural-codes-search" });
      } catch {
        return scheduleFailure("Avvio del Web Worker non riuscito.");
      }
      workerRef.current = worker;
    }
    const requestId = ++requestIdRef.current;
    const activeWorker = worker;
    const onMessage = ({ data }: MessageEvent<WorkerResultsMessage | WorkerErrorMessage>) => {
      if (data.requestId !== requestIdRef.current || data.requestId !== requestId) return;
      setIndexRequested(true);
      if (data.type === "error") {
        setWorkerResponse({ query: debouncedQuery, mode, status: "error", results: [], durationMs: null, errorMessage: data.message });
        return;
      }
      setWorkerResponse({ query: data.query, mode: data.mode, status: "ready", results: data.results, durationMs: data.durationMs });
    };
    const onError = () => {
      if (requestId !== requestIdRef.current) return;
      activeWorker.terminate();
      if (workerRef.current === activeWorker) workerRef.current = null;
      setIndexRequested(true);
      setWorkerResponse({ query: debouncedQuery, mode, status: "error", results: [], durationMs: null, errorMessage: "Avvio del Web Worker non riuscito." });
    };
    activeWorker.addEventListener("message", onMessage);
    activeWorker.addEventListener("error", onError);
    let postFailureCleanup: (() => void) | null = null;
    try {
      activeWorker.postMessage({
        type: "search",
        requestId,
        indexUrl: new URL(resolveDataPath(manifest.searchIndexPath, dataBaseUrl), window.location.href).href,
        query: debouncedQuery,
        mode,
        limit: maximum,
      });
    } catch {
      activeWorker.terminate();
      if (workerRef.current === activeWorker) workerRef.current = null;
      postFailureCleanup = scheduleFailure("Invio della ricerca al Web Worker non riuscito.");
    }
    return () => {
      postFailureCleanup?.();
      activeWorker.removeEventListener("message", onMessage);
      activeWorker.removeEventListener("error", onError);
    };
  }, [dataBaseUrl, debouncedQuery, exactResults, manifest, maximum, mode]);

  const normalizedInputLength = query.trim().length;
  const querySettled = debouncedQuery === query;
  const fullTextCurrent = querySettled && workerResponse?.query === debouncedQuery && workerResponse.mode === mode;
  return {
    queryReady: normalizedInputLength >= 2,
    results: exactResults ?? (fullTextCurrent ? workerResponse.results : []),
    status: exactResults !== null ? "ready" as const : normalizedInputLength < 2 ? "idle" as const : fullTextCurrent ? workerResponse.status : "loading" as const,
    source: exactResults !== null ? "exact" as const : "worker" as const,
    durationMs: exactResults !== null ? 0 : fullTextCurrent ? workerResponse.durationMs : null,
    errorMessage: exactResults === null && fullTextCurrent ? workerResponse.errorMessage : undefined,
    indexRequested,
  };
}
