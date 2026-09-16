import "server-only";
import {
  CHATNTC_DIRECTIVES, CHATNTC_RESPONSE_JSON_SCHEMA, citationForEvidence, isChatNTCResponse,
  retrieveChatNTCEvidence, validateChatNTCResponse, ChatNTCContextError,
  type ChatNTCEvidencePackage, type ChatNTCProvider,
  type ChatNTCRepository, type ChatNTCResponse, type ChatNTCRetrievalOptions,
} from "../../shared/chatntc/index.js";
import { ChatNTCServerError } from "./errors.js";
import type { ChatRequest, ChatResult } from "../../shared/chatntc-ui/transport.js";

export type ChatNTCRequest = ChatRequest;
export type ChatNTCResult = ChatResult;

/** Detect absence of usable primary content, not semantic sufficiency or human approval. */
function hasPrimaryContent(evidence: ChatNTCEvidencePackage): boolean {
  return evidence.primaryUnits.some((unit) => unit.blocks.some((block) => block.origin === "official"
    && ((block.kind !== "heading" && Boolean(block.text?.normalized.trim()))
      || block.asset?.kind === "formula" || block.asset?.kind === "table")));
}

export async function runChatNTC(request: ChatNTCRequest, dependencies: {
  repository: ChatNTCRepository;
  provider: () => ChatNTCProvider;
  retrievalOptions?: ChatNTCRetrievalOptions;
  signal?: AbortSignal;
}): Promise<ChatNTCResult> {
  const { repository, signal } = dependencies;
  if (signal?.aborted) throw new ChatNTCServerError("REQUEST_ABORTED");
  let evidence: ChatNTCEvidencePackage;
  try {
    evidence = await retrieveChatNTCEvidence(repository, request.question, { ...dependencies.retrievalOptions, ...(request.context ? { context: request.context } : {}) });
  } catch (error) {
    if (error instanceof ChatNTCContextError) throw new ChatNTCServerError("INVALID_CONTEXT");
    throw new ChatNTCServerError("RETRIEVAL_FAILED");
  }
  if (signal?.aborted) throw new ChatNTCServerError("REQUEST_ABORTED");
  let candidate: unknown;
  let providerId: string | null = null;
  let model: string | null = null;
  if (!hasPrimaryContent(evidence)) {
    candidate = {
      formatVersion: 1, evidencePackageId: evidence.packageId,
      answer: "Non dispongo di evidence normativa sufficiente per rispondere. Specifica il riferimento o riformula la domanda.",
      classification: "no-direct-reference", claims: [], usedEvidenceIds: [],
      warnings: ["Il retrieval non ha selezionato contenuto normativo primario utilizzabile."],
      needsMoreEvidence: true, externalResearchSuggested: false,
    } satisfies ChatNTCResponse;
  } else {
    const provider = dependencies.provider();
    providerId = provider.id;
    model = provider.model ?? null;
    try {
      candidate = await provider.generate({
        messages: [...(request.history ?? []).map(({ role, content }) => ({ role, content })), { role: "user", content: request.question }],
        // The validator retains the application's original package even if an adapter mutates its input.
        evidence: structuredClone(evidence), directives: structuredClone(CHATNTC_DIRECTIVES),
        outputSchema: structuredClone(CHATNTC_RESPONSE_JSON_SCHEMA), signal,
      });
    } catch (error) {
      if (error instanceof ChatNTCServerError) throw error;
      throw new ChatNTCServerError("PROVIDER_ERROR");
    }
  }
  if (signal?.aborted) throw new ChatNTCServerError("REQUEST_ABORTED");
  // Mandatory for ALL results, including abstentions and alternative/mock providers.
  let validation;
  try { validation = await validateChatNTCResponse(candidate, evidence, repository); }
  catch { throw new ChatNTCServerError("VALIDATION_FAILED"); }
  if (!validation.valid) {
    throw new ChatNTCServerError(validation.issues.some((issue) => issue.code === "invalid-response-shape")
      ? "INVALID_RESPONSE_SCHEMA" : "CITATION_VALIDATION_FAILED");
  }
  if (!isChatNTCResponse(candidate)) throw new ChatNTCServerError("INVALID_RESPONSE_SCHEMA");
  return {
    ok: true, response: candidate,
    citations: candidate.usedEvidenceIds.map((id) => citationForEvidence(evidence, id)),
    evidence: { packageId: evidence.packageId, structuralCodesVersion: evidence.corpus.version, corpusFingerprint: evidence.corpus.fingerprint,
      artifactFingerprint: evidence.corpus.artifactFingerprint, policyVersion: evidence.policyVersion,
      reduced: evidence.retrieval.reduced, warnings: evidence.warnings },
    generation: { provider: providerId, model, outcome: candidate.classification === "no-direct-reference" ? "abstained" : "generated" },
    validation: { valid: true, scope: "integrity-provenance-claim-coverage" },
  };
}
