"use client";

import { useEffect, useId, useRef, useState } from "react";
import { viewerTargetForCitation } from "../chatntc/evidence.js";
import type { ChatNTCCitation, ChatNTCClassification, ChatNTCRetrievalContext, ChatNTCWarning } from "../chatntc/types.js";
import type { ChatNTCMessage } from "../chatntc/provider.js";
import type { ViewerTarget } from "../permalinks.js";
import { ChatTransportError, type ChatResult, type ChatTransport } from "./transport.js";

export const CHATNTC_CLASSIFICATION_LABELS: Record<ChatNTCClassification, string> = {
  "direct-reference": "Riferimento diretto", "combined-reference": "Riferimento combinato",
  interpretation: "Interpretazione", "no-direct-reference": "Nessun riferimento diretto", "external-source": "Fonte esterna",
};
const warningLabels: Record<ChatNTCWarning["code"], string> = {
  "no-evidence": "Non è stato trovato contenuto normativo sufficiente.",
  "evidence-reduced": "Evidence parziale: è stata selezionata una parte del contenuto disponibile.",
  "unreviewed-evidence": "Fonti non ancora revisionate integralmente.",
  "blocking-issues": "Sono presenti questioni editoriali aperte nelle fonti.",
  "proposed-relation": "Una relazione tra fonti è proposta e attende conferma.",
  "figure-metadata-only": "Per le figure sono disponibili soltanto i metadati.",
  "unresolved-reference": "Un riferimento della domanda non è stato risolto.",
};

export interface ChatNTCTurn {
  id: string; question: string; timestamp: string; answeredAt?: string; context?: ChatNTCRetrievalContext; result?: ChatResult;
  status: "pending" | "complete" | "error" | "cancelled"; error?: string;
}

/** Complete recent pairs only: never truncate a normative statement to fit history. */
function recentHistory(turns: ChatNTCTurn[]): ChatNTCMessage[] {
  const pairs: ChatNTCMessage[][] = [];
  let length = 0;
  for (const turn of [...turns].reverse()) {
    if (!turn.result || turn.status !== "complete") continue;
    const question = turn.context ? `${turn.question}\nContesto: ${contextLabel(turn.context)}.` : turn.question;
    const answer = turn.result.response.answer;
    if (question.length > 2000 || answer.length > 2000 || length + question.length + answer.length > 8000) break;
    pairs.unshift([{ role: "user", content: question }, { role: "assistant", content: answer }]);
    length += question.length + answer.length;
    if (pairs.length === 3) break;
  }
  return pairs.flat();
}

function contextLabel(context: ChatNTCRetrievalContext) {
  return `${context.documentId === "ntc2018" ? "NTC 2018" : "Circolare 7/2019"} §${context.numbering}`;
}
function citationLabel(citation: ChatNTCCitation) {
  const label = contextLabel({ ...citation, documentId: citation.document });
  const target = viewerTargetForCitation(citation);
  if (target.kind === "asset") return `${label} · ${target.assetKind === "formula" ? "Formula" : target.assetKind === "table" ? "Tabella" : target.assetKind === "figure" ? "Figura" : "Asset"}${citation.assetNumber ? ` ${citation.assetNumber}` : " non numerato"}`;
  return target.kind === "block" ? `${label} · passaggio` : label;
}

export interface ChatNTCPanelProps {
  transport: ChatTransport;
  context?: ChatNTCRetrievalContext | null;
  onNavigate: (target: ViewerTarget) => void | Promise<void>;
  hrefForTarget: (target: ViewerTarget) => string;
  /** Optional controlled lifecycle, independent of any storage implementation. Remount to switch sessions. */
  initialTurns?: ChatNTCTurn[];
  onTurnsChange?: (turns: ChatNTCTurn[]) => void;
  onNewChat?: () => void;
  historyEnabled?: boolean;
  disabled?: boolean;
  currentCorpusFingerprint?: string;
}

export function ChatNTCPanel({ transport, context, onNavigate, hrefForTarget, initialTurns = [], onTurnsChange, onNewChat, historyEnabled = false, disabled = false, currentCorpusFingerprint }: ChatNTCPanelProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const pendingRef = useRef<{ id: string; controller: AbortController } | null>(null);
  const [turns, setTurns] = useState<ChatNTCTurn[]>(initialTurns);
  const turnsRef = useRef(initialTurns);
  const [draft, setDraft] = useState("");
  const [useContext, setUseContext] = useState(false);
  const [notice, setNotice] = useState("");
  const busy = turns.some((turn) => turn.status === "pending");

  useEffect(() => () => { pendingRef.current?.controller.abort(); pendingRef.current = null; }, []);
  useEffect(() => { const log = logRef.current; if (log) log.scrollTop = log.scrollHeight; }, [turns]);

  function updateTurns(update: (current: ChatNTCTurn[]) => ChatNTCTurn[]) {
    const next = update(turnsRef.current);
    turnsRef.current = next; setTurns(next); onTurnsChange?.(next);
  }

  function stop() {
    const pending = pendingRef.current;
    if (!pending) return;
    pendingRef.current = null;
    pending.controller.abort();
    updateTurns((current) => current.map((turn) => turn.id === pending.id ? { ...turn, status: "cancelled" } : turn));
    setNotice("Richiesta interrotta.");
    inputRef.current?.focus();
  }
  function newChat() {
    if (onNewChat) { stop(); onNewChat(); return; }
    pendingRef.current?.controller.abort();
    pendingRef.current = null;
    updateTurns(() => []); setDraft(""); setUseContext(false); setNotice("Nuova chat pronta.");
    inputRef.current?.focus();
  }
  async function send() {
    const question = draft.trim();
    if (disabled || !question || pendingRef.current || (useContext && !context)) return;
    const id = crypto.randomUUID();
    const controller = new AbortController();
    pendingRef.current = { id, controller };
    const selected = useContext && context ? { ...context } : undefined;
    const history = recentHistory(turns);
    updateTurns((current) => [...current, { id, question, timestamp: new Date().toISOString(), context: selected, status: "pending" }]);
    setDraft(""); setNotice("");
    try {
      const result = await transport.send({ question, history, ...(selected ? { context: selected } : {}) }, { signal: controller.signal });
      if (pendingRef.current?.id !== id) return;
      updateTurns((current) => current.map((turn) => turn.id === id ? { ...turn, result, answeredAt: new Date().toISOString(), status: "complete" } : turn));
      setNotice("Risposta disponibile.");
    } catch (error) {
      if (pendingRef.current?.id !== id) return;
      const message = error instanceof ChatTransportError ? error.message : "Impossibile completare la richiesta. Puoi riprovare.";
      updateTurns((current) => current.map((turn) => turn.id === id ? { ...turn, error: message, status: "error" } : turn));
      setDraft((current) => current || question);
    } finally {
      if (pendingRef.current?.id === id) pendingRef.current = null;
    }
  }

  return <section className="scv-chat" aria-label="ChatNTC">
    <header className="scv-chat-header"><div><h2>ChatNTC</h2><p>Domande sul corpus normativo</p></div><button type="button" disabled={disabled} onClick={newChat}>Nuova chat</button></header>
    <div className="scv-chat-messages" role="log" aria-label="Messaggi ChatNTC" aria-live="polite" aria-relevant="additions text" ref={logRef}>
      {turns.length === 0 && <div className="scv-chat-empty"><strong>Da quale riferimento partiamo?</strong><p>Fai una domanda su NTC e Circolare, oppure usa il paragrafo aperto nel viewer.</p><small>Le risposte distinguono fonti e interpretazioni. {historyEnabled ? "La cronologia è salvata solo in questo browser." : "La chat resta solo in questa pagina."}</small></div>}
      {turns.map((turn) => <div className="scv-chat-turn" key={turn.id}>
        <article className="scv-chat-question" aria-label="La tua domanda"><small>Tu{turn.context ? ` · ${contextLabel(turn.context)}` : " · domanda generica"}</small><p>{turn.question}</p></article>
        {turn.status === "pending" && <p className="scv-chat-pending">Ricerca delle fonti e preparazione della risposta…</p>}
        {turn.status === "cancelled" && <p className="scv-chat-meta">Richiesta interrotta.</p>}
        {turn.error && <p className="scv-chat-error" role="alert">{turn.error}</p>}
        {turn.result && <article className="scv-chat-answer" aria-label="Risposta ChatNTC">
          <span className="scv-chat-classification" data-classification={turn.result.response.classification}>{CHATNTC_CLASSIFICATION_LABELS[turn.result.response.classification]}</span>
          <p>{turn.result.response.answer}</p>
          {currentCorpusFingerprint && turn.result.evidence.corpusFingerprint !== currentCorpusFingerprint && <p className="scv-chat-corpus-warning">Questa risposta è stata generata con una versione diversa del corpus.</p>}
          {historyEnabled && <details className="scv-chat-warnings"><summary>Versione e provenienza della risposta</summary><dl className="scv-chat-provenance">
            <dt>Generata il</dt><dd>{turn.answeredAt ? new Date(turn.answeredAt).toLocaleString("it-IT") : "Data non disponibile"}</dd>
            <dt>Provider / modello</dt><dd>{turn.result.generation.provider ?? "Astensione locale"} / {turn.result.generation.model ?? "Non disponibile"}</dd>
            <dt>structural-codes</dt><dd>{turn.result.evidence.structuralCodesVersion ?? "Versione non disponibile"}</dd>
            <dt>Fingerprint corpus</dt><dd>{turn.result.evidence.corpusFingerprint}</dd>
          </dl></details>}
          {turn.result.citations.length > 0 && <nav className="scv-chat-citations" aria-label="Citazioni normative"><strong>Fonti della risposta</strong><ul>{turn.result.citations.map((citation) => {
            const target = viewerTargetForCitation(citation);
            return <li key={citation.evidenceId}><a href={hrefForTarget(target)} onClick={(event) => {
              if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
              event.preventDefault();
              void Promise.resolve().then(() => onNavigate(target)).catch(() => setNotice("Non è stato possibile aprire il riferimento."));
            }}>{citationLabel(citation)}</a></li>;
          })}</ul></nav>}
          {turn.result.response.needsMoreEvidence && <p className="scv-chat-meta">Servono altre fonti o un riferimento più preciso per completare la risposta.</p>}
          {turn.result.response.externalResearchSuggested && <p className="scv-chat-meta">Potrebbero servire fonti esterne; la ricerca esterna non è disponibile.</p>}
          {(turn.result.response.warnings.length > 0 || turn.result.evidence.warnings.length > 0) && <details className="scv-chat-warnings"><summary>Limiti e stato delle fonti</summary><ul>{[...new Set([...turn.result.response.warnings, ...turn.result.evidence.warnings.map((warning) => warningLabels[warning.code] ?? "È presente un avviso sulle fonti.")])].map((warning) => <li key={warning}>{warning}</li>)}</ul></details>}
        </article>}
      </div>)}
    </div>
    <form className="scv-chat-composer" onSubmit={(event) => { event.preventDefault(); void send(); }}>
      <div className="scv-chat-context"><label><input type="checkbox" checked={useContext} disabled={!context || busy} onChange={(event) => setUseContext(event.target.checked)} />Usa il paragrafo corrente</label><span>{context ? contextLabel(context) : "Seleziona un paragrafo nel viewer"}{context?.assetId ? " · asset selezionato" : context?.blockId ? " · passaggio selezionato" : ""}</span></div>
      <button type="button" className="scv-chat-suggestion" disabled={!context || busy} onClick={() => { setUseContext(true); setDraft("Spiegami questo paragrafo"); inputRef.current?.focus(); }}>Spiegami questo paragrafo</button>
      <label htmlFor={inputId}>La tua domanda</label>
      <textarea id={inputId} ref={inputRef} rows={3} maxLength={4000} value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Scrivi una domanda o un riferimento…" onKeyDown={(event) => {
        if ((event.ctrlKey || event.metaKey) && event.key === "Enter" && !event.nativeEvent.isComposing) { event.preventDefault(); void send(); }
      }} aria-describedby={`${inputId}-hint`} />
      <div className="scv-chat-send"><small id={`${inputId}-hint`}>Ctrl/⌘ + Invio per inviare</small>{busy && transport.capabilities.cancellation ? <button type="button" onClick={stop}>Interrompi</button> : <button type="submit" disabled={disabled || busy || !draft.trim() || (useContext && !context)}>{busy ? "In attesa…" : "Invia"}</button>}</div>
      <span className="scv-chat-live" role="status">{notice}</span>
    </form>
  </section>;
}
