"use client";

import { lazy, Suspense, useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { viewerTargetForCitation } from "../chatntc/evidence.js";
import type { ChatNTCClassification, ChatNTCReference, ChatNTCRetrievalContext, ChatNTCWarning } from "../chatntc/types.js";
import type { ChatNTCMessage } from "../chatntc/provider.js";
import type { ViewerTarget } from "../permalinks.js";
import { ChatTransportError, type ChatResult, type ChatTransport } from "./transport.js";
import { ChatNTCLoadingSkeleton } from "./ChatNTCLoadingSkeleton.js";
import { NewChatIcon } from "./ChatNTCIcons.js";

const loadChatNTCMarkdown = () => import("./ChatNTCMarkdown.js");
const LazyChatNTCMarkdown = lazy(() => loadChatNTCMarkdown().then((module) => ({ default: module.ChatNTCMarkdown })));

export const CHATNTC_CLASSIFICATION_LABELS: Record<ChatNTCClassification, string> = {
  "direct-reference": "Riferimento diretto", "combined-reference": "Riferimento combinato",
  interpretation: "Interpretazione", "no-direct-reference": "Nessun riferimento diretto", "external-source": "Fonte esterna",
};
const warningLabels: Record<ChatNTCWarning["code"], string> = {
  "no-evidence": "Non è stato trovato contenuto normativo sufficiente.",
  "evidence-reduced": "Fonti parziali: è stata selezionata una parte del contenuto disponibile.",
  "figure-metadata-only": "Per le figure sono disponibili soltanto i metadati.",
  "unresolved-reference": "Un riferimento della domanda non è stato risolto.",
};

const answerText = (response: ChatResult["response"]) => response.formatVersion === 3
  ? response.answerMarkdown : response.answer;

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
    const answer = answerText(turn.result.response);
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
function citationLabel(citation: ChatNTCReference) {
  const label = contextLabel({ ...citation, documentId: citation.document });
  const target = viewerTargetForCitation(citation);
  if (target.kind === "asset") {
    if (target.assetKind === "formula") return citation.assetNumber ? `Formula [${citation.assetNumber}]` : "Formula non numerata";
    if (target.assetKind === "table") return citation.assetNumber ? `Tab.${citation.assetNumber}` : "Tabella non numerata";
    if (target.assetKind === "figure") return citation.assetNumber ? `Fig. ${citation.assetNumber}` : "Figura non numerata";
    return `${label} · asset`;
  }
  return target.kind === "block" ? `${label} · passaggio` : label;
}
const citationKey = (citation: ChatNTCReference) => [citation.unitId, citation.blockId ?? "", citation.assetId ?? ""].join("|");

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
  showNewChatAction?: boolean;
  disabled?: boolean;
  currentCorpusFingerprint?: string;
}

const chatDisclaimer = "ChatNTC è un sistema di IA e può commettere errori. Verifica sempre le fonti normative. Non sostituisce il giudizio professionale.";

function SendIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13M13 6l6 6-6 6" /></svg>;
}

export function ChatNTCPanel({ transport, onNavigate, hrefForTarget, initialTurns = [], onTurnsChange, onNewChat, historyEnabled = false, showNewChatAction = true, disabled = false, currentCorpusFingerprint }: ChatNTCPanelProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const turnRefs = useRef(new Map<string, HTMLDivElement>());
  const scrollActionRef = useRef<{ kind: "reveal"; id: string } | { kind: "preserve"; top: number } | null>(null);
  const pendingRef = useRef<{ id: string; controller: AbortController } | null>(null);
  const [turns, setTurns] = useState<ChatNTCTurn[]>(initialTurns);
  const turnsRef = useRef(initialTurns);
  const [freshAnswerIds, setFreshAnswerIds] = useState<ReadonlySet<string>>(() => new Set());
  const [dismissedReferenceWarnings, setDismissedReferenceWarnings] = useState<ReadonlySet<string>>(() => new Set());
  const [draft, setDraft] = useState("");
  const [notice, setNotice] = useState("");
  const busy = turns.some((turn) => turn.status === "pending");

  const resizeInput = useCallback(() => {
    const input = inputRef.current;
    if (!input) return;
    const styles = window.getComputedStyle(input);
    const minimum = Number.parseFloat(styles.minHeight) || 44;
    const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
    const maximum = Math.max(minimum, Math.min(viewportHeight * .33, 240));
    const previous = input.getBoundingClientRect().height;
    input.style.height = "auto";
    const desired = Math.min(Math.max(input.scrollHeight, minimum), maximum);
    input.style.overflowY = input.scrollHeight > maximum ? "auto" : "hidden";
    if (previous > 0 && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      input.style.height = `${previous}px`;
      void input.offsetHeight;
    }
    input.style.height = `${desired}px`;
  }, []);

  useEffect(() => () => { pendingRef.current?.controller.abort(); pendingRef.current = null; }, []);
  useEffect(() => {
    window.addEventListener("resize", resizeInput);
    window.visualViewport?.addEventListener("resize", resizeInput);
    const composer = inputRef.current?.parentElement;
    let previousWidth = composer?.getBoundingClientRect().width;
    const observer = composer && typeof ResizeObserver !== "undefined" ? new ResizeObserver(([entry]) => {
      const width = entry.contentRect.width;
      if (width !== previousWidth) { previousWidth = width; resizeInput(); }
    }) : null;
    if (composer) observer?.observe(composer);
    return () => {
      window.removeEventListener("resize", resizeInput);
      window.visualViewport?.removeEventListener("resize", resizeInput);
      observer?.disconnect();
    };
  }, [resizeInput]);
  useLayoutEffect(resizeInput, [draft, resizeInput]);
  useLayoutEffect(() => {
    const action = scrollActionRef.current;
    const log = logRef.current;
    if (!action || !log) return;
    scrollActionRef.current = null;
    if (action.kind === "preserve") {
      log.scrollTop = action.top;
      return;
    }
    const question = turnRefs.current.get(action.id)?.querySelector<HTMLElement>(".scv-chat-question");
    if (!question) return;
    const logRect = log.getBoundingClientRect();
    const questionRect = question.getBoundingClientRect();
    const inset = 8;
    if (questionRect.top < logRect.top + inset || questionRect.bottom > logRect.bottom - inset) {
      log.scrollTo({ top: Math.max(0, log.scrollTop + questionRect.top - logRect.top - inset), behavior: "auto" });
    }
  }, [turns]);

  function updateTurns(update: (current: ChatNTCTurn[]) => ChatNTCTurn[]) {
    const next = update(turnsRef.current);
    turnsRef.current = next; setTurns(next); onTurnsChange?.(next);
  }

  function stop() {
    const pending = pendingRef.current;
    if (!pending) return;
    pendingRef.current = null;
    pending.controller.abort();
    scrollActionRef.current = { kind: "preserve", top: logRef.current?.scrollTop ?? 0 };
    updateTurns((current) => current.map((turn) => turn.id === pending.id ? { ...turn, status: "cancelled" } : turn));
    setNotice("Richiesta interrotta.");
    inputRef.current?.focus();
  }
  function newChat() {
    if (onNewChat) { stop(); onNewChat(); return; }
    pendingRef.current?.controller.abort();
    pendingRef.current = null;
    updateTurns(() => []); setFreshAnswerIds(new Set()); setDismissedReferenceWarnings(new Set()); setDraft(""); setNotice("Nuova chat pronta.");
    inputRef.current?.focus();
  }
  async function send() {
    const question = draft.trim();
    if (disabled || !question || pendingRef.current) return;
    const id = crypto.randomUUID();
    const controller = new AbortController();
    pendingRef.current = { id, controller };
    const history = recentHistory(turns);
    void loadChatNTCMarkdown();
    scrollActionRef.current = { kind: "reveal", id };
    updateTurns((current) => [...current, { id, question, timestamp: new Date().toISOString(), status: "pending" }]);
    setDraft(""); setNotice("");
    try {
      const result = await transport.send({ question, history }, { signal: controller.signal });
      if (pendingRef.current?.id !== id) return;
      scrollActionRef.current = { kind: "preserve", top: logRef.current?.scrollTop ?? 0 };
      setFreshAnswerIds((current) => new Set(current).add(id));
      updateTurns((current) => current.map((turn) => turn.id === id ? { ...turn, result, answeredAt: new Date().toISOString(), status: "complete" } : turn));
      setNotice("Risposta disponibile.");
    } catch (error) {
      if (pendingRef.current?.id !== id) return;
      const message = error instanceof ChatTransportError ? error.message : "Impossibile completare la richiesta. Puoi riprovare.";
      scrollActionRef.current = { kind: "preserve", top: logRef.current?.scrollTop ?? 0 };
      updateTurns((current) => current.map((turn) => turn.id === id ? { ...turn, error: message, status: "error" } : turn));
      setDraft((current) => current || question);
    } finally {
      if (pendingRef.current?.id === id) pendingRef.current = null;
    }
  }

  return <section className={`scv-chat${showNewChatAction ? " scv-chat-has-actions" : ""}`} aria-label="ChatNTC">
    {showNewChatAction && <div className="scv-chat-actions"><button type="button" disabled={disabled} onClick={newChat}><NewChatIcon />Nuova chat</button></div>}
    <div className="scv-chat-messages" role="log" aria-label="Messaggi ChatNTC" aria-live="polite" aria-relevant="additions text" ref={logRef}>
      {turns.length === 0 && <p className="scv-chat-empty">Fai una domanda sulle NTC 2018 o sulla Circolare 7/2019.</p>}
      {turns.map((turn) => <div className="scv-chat-turn" data-chat-turn-id={turn.id} key={turn.id} ref={(element) => {
        if (element) turnRefs.current.set(turn.id, element); else turnRefs.current.delete(turn.id);
      }}>
        <article className="scv-chat-question" aria-label="Domanda utente">{turn.context && <small>{contextLabel(turn.context)}</small>}<p>{turn.question}</p></article>
        {turn.status === "pending" && <ChatNTCLoadingSkeleton />}
        {turn.status === "cancelled" && <p className="scv-chat-meta">Richiesta interrotta.</p>}
        {turn.error && <p className="scv-chat-error" role="alert">{turn.error}</p>}
        {turn.result && <article className={`scv-chat-answer${freshAnswerIds.has(turn.id) ? " scv-chat-answer-enter" : ""}`} data-entrance={freshAnswerIds.has(turn.id) ? "new" : "history"} aria-label="Risposta ChatNTC">
          <span className="scv-chat-classification" data-classification={turn.result.response.classification}>{CHATNTC_CLASSIFICATION_LABELS[turn.result.response.classification]}</span>
          <Suspense fallback={<div className="scv-chat-markdown scv-chat-markdown-loader" aria-hidden="true" />}>
            <LazyChatNTCMarkdown markdown={answerText(turn.result.response)} references={turn.result.citations}
              hrefForTarget={hrefForTarget} onNavigate={onNavigate}
              onNavigationError={() => setNotice("Non è stato possibile aprire il riferimento.")} />
          </Suspense>
          {turn.result.response.formatVersion === 3 && turn.result.response.referenceWarning
            && !dismissedReferenceWarnings.has(turn.id) && <div className="scv-chat-reference-warning" role="status">
            <span>{turn.result.response.referenceWarning === "some-references-omitted"
              ? "Risposta disponibile; alcuni riferimenti sono stati omessi perché non verificabili."
              : "Non sono stati verificati riferimenti normativi specifici."}</span>
            <button type="button" aria-label="Chiudi avviso sui riferimenti" onClick={() => setDismissedReferenceWarnings((current) => {
              const next = new Set(current); next.add(turn.id); return next;
            })}>×</button>
          </div>}
          {currentCorpusFingerprint && turn.result.evidence.corpusFingerprint !== currentCorpusFingerprint && <p className="scv-chat-corpus-warning">Questa risposta è stata generata con una versione diversa del corpus.</p>}
          {historyEnabled && <details className="scv-chat-warnings"><summary>Versione e provenienza della risposta</summary><dl className="scv-chat-provenance">
            <dt>Generata il</dt><dd>{turn.answeredAt ? new Date(turn.answeredAt).toLocaleString("it-IT") : "Data non disponibile"}</dd>
            <dt>Provider / modello</dt><dd>{turn.result.generation.provider ?? "Astensione locale"} / {turn.result.generation.model ?? "Non disponibile"}</dd>
            <dt>structural-codes</dt><dd>{turn.result.evidence.structuralCodesVersion ?? "Versione non disponibile"}</dd>
            <dt>Fingerprint corpus</dt><dd>{turn.result.evidence.corpusFingerprint}</dd>
          </dl></details>}
          {turn.result.citations.length > 0 && <nav className="scv-chat-citations" aria-label="Riferimenti normativi verificati"><strong>Riferimenti verificati</strong><ul>{turn.result.citations.map((citation) => {
            const target = viewerTargetForCitation(citation);
            return <li key={citationKey(citation)}><a href={hrefForTarget(target)} onClick={(event) => {
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
      <div className="scv-chat-composer-bar">
        <textarea id={inputId} ref={inputRef} rows={1} maxLength={4000} value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Scrivi una domanda…" onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing && event.keyCode !== 229) { event.preventDefault(); void send(); }
        }} aria-label="Scrivi una domanda" />
        {busy ? <button className="scv-chat-action-button" type="button" aria-label="Interrompi risposta" disabled={!transport.capabilities.cancellation} onClick={stop}><span className="scv-chat-stop-icon" aria-hidden="true" /></button>
          : <button className="scv-chat-action-button" type="submit" aria-label="Invia domanda" disabled={disabled || !draft.trim()}><SendIcon /></button>}
      </div>
      <p className="scv-chat-disclaimer">{chatDisclaimer}</p>
      <span className="scv-chat-live" role="status">{notice}</span>
    </form>
  </section>;
}
