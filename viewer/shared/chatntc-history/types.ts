import type { ChatNTCRetrievalContext, ChatNTCResponse } from "../chatntc/types.js";
import type { ChatResult } from "../chatntc-ui/transport.js";

export const CHAT_HISTORY_SCHEMA_VERSION = 2 as const;
export interface ChatHistoryUserMessage {
  id: string; role: "user"; content: string; timestamp: string;
  context?: ChatNTCRetrievalContext;
  status: "pending" | "complete" | "error" | "cancelled";
  error?: string;
}
/** A compact historical snapshot of a server-validated result, not fresh normative evidence. */
export interface ChatHistoryAssistantMessage {
  id: string; role: "assistant"; turnId: string; content: string; timestamp: string;
  answer: Omit<ChatNTCResponse, "answer">;
  provenance: {
    provider: string | null; model: string | null;
    structuralCodesVersion: string | null; corpusFingerprint: string; artifactFingerprint: string;
    policyVersion: string; outcome: ChatResult["generation"]["outcome"];
    validation: ChatResult["validation"];
  };
  evidenceWarnings: ChatResult["evidence"]["warnings"];
  evidenceReduced: boolean;
}
export type ChatHistoryMessage = ChatHistoryUserMessage | ChatHistoryAssistantMessage;
export interface ChatConversation {
  id: string; schemaVersion: typeof CHAT_HISTORY_SCHEMA_VERSION; revision: number;
  title: string; createdAt: string; updatedAt: string; messages: ChatHistoryMessage[];
}
export type ChatConversationSummary = Omit<ChatConversation, "messages"> & { messageCount: number };
export interface ChatHistoryStore {
  listConversations(): Promise<ChatConversationSummary[]>;
  getConversation(id: string): Promise<ChatConversation | null>;
  createConversation(input: { title: string; messages?: ChatHistoryMessage[] }): Promise<ChatConversation>;
  /** Compare-and-swap: stale revisions must fail instead of overwriting another tab's work. */
  updateConversation(id: string, patch: { title?: string; messages?: ChatHistoryMessage[] }, expectedRevision: number): Promise<ChatConversation>;
  deleteConversation(id: string, expectedRevision: number): Promise<void>;
  /** The confirmed snapshot prevents clearing conversations created/edited in another tab meanwhile. */
  deleteAllConversations(expected: { id: string; revision: number }[]): Promise<void>;
  getActiveConversationId(): Promise<string | null>;
  setActiveConversationId(id: string | null): Promise<void>;
}

/** Reserved portable format. Import requires an explicit policy for untrusted historical provenance. */
export interface ChatHistoryArchive {
  format: "chatntc-history"; formatVersion: 1; exportedAt: string; conversations: ChatConversation[];
}
export interface ChatHistoryTransfer {
  exportHistory(): Promise<ChatHistoryArchive>;
  importHistory(archive: ChatHistoryArchive, options: { collision: "reject" }): Promise<void>;
}
// TODO: implement transfer separately with UI preview, size limits and provenance labels for imports.

export class ChatHistoryError extends Error {
  constructor(readonly code: "UNAVAILABLE" | "BLOCKED" | "UPGRADE_FAILED" | "CORRUPT" | "WRITE_FAILED" | "CONFLICT" | "INVALID_DATA") {
    const messages = {
      UNAVAILABLE: "La cronologia locale non è disponibile in questo browser.",
      BLOCKED: "Chiudi le altre schede del viewer e riprova per aggiornare la cronologia.",
      UPGRADE_FAILED: "Aggiornamento della cronologia non riuscito. I dati esistenti non sono stati cancellati.",
      CORRUPT: "La cronologia contiene dati non leggibili. I dati sono stati conservati; nessun ripristino automatico è stato eseguito.",
      WRITE_FAILED: "Salvataggio locale non riuscito. Mantieni aperta questa pagina e riprova.",
      CONFLICT: "La conversazione è cambiata in un'altra scheda. I dati locali non sono stati sovrascritti.",
      INVALID_DATA: "I dati della conversazione non rispettano il formato della cronologia.",
    };
    super(messages[code]); this.name = "ChatHistoryError";
  }
}

export function titleFromQuestion(question: string): string {
  const text = question.replace(/\s+/gu, " ").trim();
  const chars = Array.from(text);
  return chars.length > 72 ? `${chars.slice(0, 71).join("")}…` : text || "Nuova chat";
}
