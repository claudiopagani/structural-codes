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
    <circle cx="12" cy="12" r="5.4" />
    <circle cx="12" cy="12" r="2.1" />
    <path d="M12 6.6V3M12 21v-3.6M7.3 9.3 4.2 7.5m15.6 9-3.1-1.8M7.3 14.7l-3.1 1.8m15.6-9-3.1 1.8" />
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
