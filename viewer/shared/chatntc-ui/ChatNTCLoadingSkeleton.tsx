export function ChatNTCLoadingSkeleton() {
  return <div className="scv-chat-loading" role="status" aria-live="polite">
    <span className="scv-chat-loading-label">Sto consultando la normativa…</span>
    <span className="scv-chat-loading-lines" aria-hidden="true">
      <i /><i /><i /><i />
    </span>
  </div>;
}
