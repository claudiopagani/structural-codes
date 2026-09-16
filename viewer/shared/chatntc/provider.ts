import type { CHATNTC_EPISTEMIC_POLICY } from "./policy.js";
import type { CHATNTC_RESPONSE_JSON_SCHEMA } from "./responseContract.js";
import type { ChatNTCEvidencePackage, ChatNTCResponse, ChatNTCValidationIssue } from "./types.js";

/** Transient contextual messages only; no storage or provider-specific roles. */
export interface ChatNTCMessage { role: "user" | "assistant"; content: string; }

export interface ChatNTCDirectives {
  version: string;
  policy: typeof CHATNTC_EPISTEMIC_POLICY;
  rules: readonly string[];
}

export interface ChatNTCGenerationInput {
  /** History followed by the current question. History is never normative evidence. */
  messages: readonly ChatNTCMessage[];
  evidence: ChatNTCEvidencePackage;
  directives: ChatNTCDirectives;
  outputSchema: typeof CHATNTC_RESPONSE_JSON_SCHEMA;
  /** One bounded validation repair. It contains no previous answer text. */
  repair?: { issues: Pick<ChatNTCValidationIssue, "code" | "path" | "message" | "reference">[] };
  signal?: AbortSignal;
}

/** No SDK types or credentials. Output is structurally parsed, NOT citation-validated yet. */
export interface ChatNTCProvider {
  readonly id: string;
  /** Public generation metadata; never provider configuration or credentials. */
  readonly model?: string;
  readonly capabilities: { structuredOutput: boolean; streaming: boolean;
    outputMode?: "json-schema" | "json-object" | "prompt-json"; cancellation?: boolean; toolCalling?: boolean; reasoning?: string };
  generate(input: ChatNTCGenerationInput): Promise<ChatNTCResponse>;
}
