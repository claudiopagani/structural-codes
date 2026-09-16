import type { ChatNTCCitation, ChatNTCEvidencePackage, ChatNTCResponse, ChatNTCRetrievalContext } from "../chatntc/types.js";
import type { ChatNTCMessage } from "../chatntc/provider.js";

/** Transient input. Context contains identifiers only, never a browser-supplied corpus chunk. */
export interface ChatRequest {
  question: string;
  history?: ChatNTCMessage[];
  context?: ChatNTCRetrievalContext;
}

/** A transport must return only results accepted by the server Citation Validator. */
export interface ChatResult {
  ok: true;
  response: ChatNTCResponse;
  citations: ChatNTCCitation[];
  evidence: {
    packageId: string; corpusFingerprint: string; artifactFingerprint: string;
    /** Optional only for transports predating history; persisted as null when unavailable. */
    structuralCodesVersion?: string;
    policyVersion: string; reduced: boolean; warnings: ChatNTCEvidencePackage["warnings"];
  };
  generation: { provider: string | null; model?: string | null; outcome: "generated" | "abstained" };
  validation: { valid: true; scope: "integrity-provenance-claim-coverage" };
}

export interface ChatTransport {
  readonly capabilities: { readonly cancellation: boolean; readonly streaming: false };
  send(request: ChatRequest, options?: { signal?: AbortSignal }): Promise<ChatResult>;
}

/** Only deliberate, user-facing transport messages may be displayed by the panel. */
export class ChatTransportError extends Error {
  constructor(readonly code: string, message: string) { super(message); this.name = "ChatTransportError"; }
}
