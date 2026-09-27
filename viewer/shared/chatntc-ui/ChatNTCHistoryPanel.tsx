"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { ChatHistoryError, titleFromQuestion, type ChatConversation, type ChatConversationSummary, type ChatHistoryStore } from "../chatntc-history/types.js";
import { ChatNTCPanel, type ChatNTCPanelProps, type ChatNTCTurn } from "./ChatNTCPanel.js";
import { historyMessages, turnsFromHistory } from "./historyMessages.js";
import { HistoryIcon, NewChatIcon, SettingsIcon, TrashIcon } from "./ChatNTCIcons.js";

export interface ChatNTCHistoryPanelProps extends Omit<ChatNTCPanelProps, "initialTurns" | "onTurnsChange" | "onNewChat" | "historyEnabled" | "disabled"> {
  historyStore: ChatHistoryStore;
  settings?: ReactNode;
}
const errorMessage = (error: unknown) => error instanceof ChatHistoryError ? error.message : "La cronologia non è disponibile. I dati non sono stati cancellati.";

/** This component knows only ChatHistoryStore. No IndexedDB, provider, HTTP or key configuration. */
export function ChatNTCHistoryPanel({ historyStore: store, settings, ...panelProps }: ChatNTCHistoryPanelProps) {
  const [rows, setRows] = useState<ChatConversationSummary[]>([]);
  const [session, setSession] = useState<{ key: number; conversation: ChatConversation | null } | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [expanded, setExpanded] = useState<"history" | "settings" | null>(null);
  const [rename, setRename] = useState<string | null>(null);
  const [activeTitle, setActiveTitle] = useState("Nuova chat");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);
  const [hasSnapshot, setHasSnapshot] = useState(false);
  const [conflict, setConflict] = useState(false);
  const historyId = useId();
  const settingsId = useId();
  const current = useRef<ChatConversation | null>(null);
  const latest = useRef<ChatNTCTurn[] | null>(null);
  const queue = useRef(Promise.resolve());
  const failed = useRef(false);
  const writes = useRef(0);
  const mounted = useRef(false);
  const sequence = useRef(0);
  const historyButton = useRef<HTMLButtonElement>(null);
  const settingsButton = useRef<HTMLButtonElement>(null);
  const renameButton = useRef<HTMLButtonElement>(null);
  const renaming = useRef(false);
  const renameCancelled = useRef(false);

  useEffect(() => {
    mounted.current = true;
    let cancelled = false;
    void (async () => {
      try {
        const list = await store.listConversations();
        const id = await store.getActiveConversationId();
        const conversation = id ? await store.getConversation(id) : null;
        if (id && !conversation) throw new ChatHistoryError("CONFLICT");
        if (cancelled) return;
        current.current = conversation;
        setActiveId(conversation?.id ?? null);
        setRows(list); setSession({ key: ++sequence.current, conversation }); setActiveTitle(conversation?.title ?? "Nuova chat");
      } catch (reason) { if (!cancelled) { failed.current = true; setSaveFailed(true); setError(errorMessage(reason)); } }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; mounted.current = false; };
  }, [store]);

  // Browser unload confirmation only while a save is outstanding or failed; no telemetry.
  useEffect(() => {
    if (!saving && !(saveFailed && hasSnapshot)) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [saving, saveFailed, hasSnapshot]);

  function save(turns: ChatNTCTurn[]) {
    latest.current = structuredClone(turns);
    setHasSnapshot(true);
    const messages = historyMessages(turns);
    writes.current++; setSaving(true); setGenerating(turns.some((turn) => turn.status === "pending"));
    queue.current = queue.current.then(async () => {
      if (failed.current) return;
      try {
        const previous = current.current;
        const title = previous?.messages.length ? previous.title : titleFromQuestion(turns[0]?.question ?? "");
        const saved = previous
          ? await store.updateConversation(previous.id, { title, messages }, previous.revision)
          : await store.createConversation({ title, messages });
        current.current = saved;
        await store.setActiveConversationId(saved.id);
        const list = await store.listConversations();
        if (mounted.current) { setRows(list); setActiveTitle(saved.title); setActiveId(saved.id); }
      } catch (reason) { failed.current = true; if (mounted.current) { setSaveFailed(true); setConflict(reason instanceof ChatHistoryError && reason.code === "CONFLICT"); setError(errorMessage(reason)); } }
    }).finally(() => { writes.current--; if (mounted.current) setSaving(writes.current > 0); });
  }

  async function act(operation: () => Promise<void>) {
    setLoading(true);
    await queue.current;
    if (failed.current) { setLoading(false); return; }
    try { await operation(); }
    catch (reason) { setError(errorMessage(reason)); }
    finally { setLoading(false); }
  }
  function select(conversation: ChatConversation | null) {
    current.current = conversation; latest.current = null;
    setActiveId(conversation?.id ?? null); setHasSnapshot(false);
    setSession({ key: ++sequence.current, conversation }); setActiveTitle(conversation?.title ?? "Nuova chat");
    setGenerating(false); setExpanded(null); setRename(null); setError("");
  }
  function closeAccordion(kind: "history" | "settings") {
    setExpanded(null);
    window.requestAnimationFrame(() => (kind === "history" ? historyButton : settingsButton).current?.focus());
  }
  function cancelRename() {
    renameCancelled.current = true;
    setRename(null);
    window.requestAnimationFrame(() => renameButton.current?.focus());
  }
  async function commitRename() {
    if (renameCancelled.current) { renameCancelled.current = false; return; }
    if (renaming.current) return;
    const title = rename?.trim() ?? "";
    const previous = current.current;
    if (!previous || !title) { cancelRename(); return; }
    if (title === activeTitle) { cancelRename(); return; }
    renaming.current = true;
    await act(async () => {
      const updated = await store.updateConversation(previous.id, { title }, previous.revision);
      current.current = updated; setActiveTitle(updated.title); setRows(await store.listConversations()); setRename(null);
    });
    renaming.current = false;
    window.requestAnimationFrame(() => renameButton.current?.focus());
  }
  const locked = loading || saving || saveFailed;
  const historyOpen = expanded === "history";
  const settingsOpen = expanded === "settings";
  const visibleStatus = loading ? "Apertura…" : saving ? "Salvataggio…" : error ? "Cronologia da verificare" : "";
  return <div className="scv-chat-history-shell" data-history-state={loading ? "loading" : saving ? "saving" : error ? "error" : "idle"}>
    <div className="scv-chat-history-actions">
      <button className="scv-chat-strip-button" type="button" disabled={locked || generating} onClick={() => void act(async () => { await store.setActiveConversationId(null); select(null); })}><NewChatIcon />Nuova chat</button>
      <button ref={historyButton} className="scv-chat-strip-button" type="button" aria-controls={historyId} aria-expanded={historyOpen} onClick={() => {
        setExpanded(historyOpen ? null : "history");
        if (!historyOpen) void store.listConversations().then(setRows).catch((reason) => setError(errorMessage(reason)));
      }}><HistoryIcon />Cronologia chat</button>
      {settings && <button ref={settingsButton} className="scv-chat-strip-button" type="button" aria-controls={settingsId} aria-expanded={settingsOpen} onClick={() => setExpanded(settingsOpen ? null : "settings")}><SettingsIcon />Impostazioni AI</button>}
      {visibleStatus && <span role="status">{visibleStatus}</span>}
    </div>
    {error && <div className="scv-chat-history-error" role="alert"><p>{error}</p>
      {hasSnapshot && saveFailed && <><p>Le modifiche restano visibili in questa pagina. Non chiuderla finché non sono salvate.</p><button type="button" disabled={saving} onClick={() => { failed.current = false; setSaveFailed(false); setError(""); save(latest.current!); }}>Riprova salvataggio</button>
        {conflict && <button type="button" disabled={saving || generating} onClick={() => { current.current = null; failed.current = false; setSaveFailed(false); setConflict(false); setError(""); save(latest.current!); }}>Salva come nuova conversazione</button>}</>}
      {!session && <button type="button" onClick={() => window.location.reload()}>Riprova apertura</button>}
    </div>}
    <div id={historyId} className="scv-chat-history-accordion" data-expanded={historyOpen} aria-hidden={!historyOpen} inert={!historyOpen} onKeyDown={(event) => {
      if (event.key === "Escape") { event.preventDefault(); closeAccordion("history"); }
    }}><section className="scv-chat-history-list" aria-label="Cronologia conversazioni">
      {rows.length === 0 ? <p>Nessuna conversazione salvata.</p> : <ul>{rows.map((row) => <li key={row.id}>
        <button type="button" disabled={locked || generating} aria-current={activeId === row.id ? "true" : undefined} onClick={() => void act(async () => {
          const conversation = await store.getConversation(row.id);
          if (!conversation) throw new ChatHistoryError("CONFLICT");
          await store.setActiveConversationId(row.id); select(conversation);
        })}><span>{row.title}</span><time dateTime={row.updatedAt}>{new Date(row.updatedAt).toLocaleDateString("it-IT")}</time></button>
        <button className="scv-chat-history-delete" type="button" aria-label={`Elimina ${row.title}`} title={`Elimina ${row.title}`} disabled={locked || generating} onClick={() => void act(async () => {
          await store.deleteConversation(row.id, row.revision);
          if (current.current?.id === row.id) select(null);
          setRows(await store.listConversations());
        })}><TrashIcon /></button>
      </li>)}</ul>}
    </section></div>
    {settings && <div id={settingsId} className="scv-chat-settings-accordion" data-expanded={settingsOpen} aria-hidden={!settingsOpen} inert={!settingsOpen} onKeyDown={(event) => {
      if (event.key === "Escape") { event.preventDefault(); closeAccordion("settings"); }
    }}><section className="scv-chat-settings-content" aria-label="Impostazioni AI">{settings}</section></div>}
    {session && <>
      <div className="scv-chat-history-title">
        {rename !== null ? <form onSubmit={(event) => { event.preventDefault(); void commitRename(); }}><input aria-label="Titolo conversazione" maxLength={144} value={rename} onChange={(event) => setRename(event.target.value)} onBlur={() => void commitRename()} onKeyDown={(event) => {
          if (event.key === "Enter") { event.preventDefault(); void commitRename(); }
          else if (event.key === "Escape") { event.preventDefault(); cancelRename(); }
        }} autoFocus /></form>
          : <><strong>{activeTitle}</strong><button ref={renameButton} className="scv-chat-rename-button" type="button" aria-label="Rinomina conversazione" title="Rinomina conversazione" disabled={locked || generating || !activeId} onClick={() => { renameCancelled.current = false; setRename(activeTitle); }}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 16-.8 4 4-.8L18.4 8 16 5.6 4 16Z"/><path d="m14.8 6.8 2.4 2.4"/></svg></button></>}
      </div>
      <div className="scv-chat-history-content"><ChatNTCPanel key={session.key} {...panelProps} initialTurns={turnsFromHistory(session.conversation?.messages ?? [])}
        historyEnabled showNewChatAction={false} disabled={locked} onTurnsChange={save} onNewChat={() => void act(async () => { await store.setActiveConversationId(null); select(null); })} /></div>
    </>}
  </div>;
}
