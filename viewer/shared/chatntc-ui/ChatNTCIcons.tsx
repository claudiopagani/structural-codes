interface IconProps { className?: string }

export function NewChatIcon({ className = "scv-chat-control-icon" }: IconProps) {
  return <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
    <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h8" />
    <path d="M14 3v5h5M13 17.5l5.2-5.2 2 2-5.2 5.2-3 .7.8-2.7Z" />
  </svg>;
}

export function HistoryIcon({ className = "scv-chat-control-icon" }: IconProps) {
  return <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
    <path d="M3 12a9 9 0 1 0 3-6.7" />
    <path d="M3 3v6h6M12 7v5l3 2" />
  </svg>;
}

export function SettingsIcon({ className = "scv-chat-control-icon" }: IconProps) {
  return <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
    <path d="M10 2h4l.6 2.6c.6.2 1.2.5 1.7 1l2.5-.8 2 3.4-1.9 1.8c.1.7.1 1.3 0 2l1.9 1.8-2 3.4-2.5-.8c-.5.4-1.1.8-1.7 1L14 21h-4l-.6-2.6c-.6-.2-1.2-.6-1.7-1l-2.5.8-2-3.4L5.1 13c-.1-.7-.1-1.3 0-2L3.2 9.2l2-3.4 2.5.8c.5-.5 1.1-.8 1.7-1L10 2Z" />
    <circle cx="12" cy="11.5" r="2.7" />
  </svg>;
}

export function TrashIcon({ className = "scv-chat-delete-icon" }: IconProps) {
  return <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
    <path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5" />
  </svg>;
}

export function ApplySettingsIcon({ className = "scv-ai-action-icon" }: IconProps) {
  return <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="12" cy="12" r="8.5" />
    <path d="m8.2 12.2 2.4 2.4 5.4-5.4" />
  </svg>;
}

export function CloseIcon({ className = "scv-tools-close-icon" }: IconProps) {
  return <svg className={className} viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>;
}
