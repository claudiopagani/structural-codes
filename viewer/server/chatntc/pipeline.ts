import "server-only";
import {
  CHATNTC_DIRECTIVES, CHATNTC_RESPONSE_JSON_SCHEMA, canonicalizeChatNTCResponse, citationForEvidence,
  isChatNTCProviderOutput, isChatNTCResponse,
  retrieveChatNTCEvidence, validateChatNTCResponse, ChatNTCContextError,
  type ChatNTCEvidencePackage, type ChatNTCProvider, type ChatNTCProviderOutput,
  type ChatNTCRepository, type ChatNTCResponse, type ChatNTCRetrievalOptions, type ChatNTCValidationIssue,
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
  const queryContext = (request.history ?? []).filter((message) => message.role === "user").slice(-3).map((message) => message.content);
  const retrievalInput = { ...dependencies.retrievalOptions, queryContext, ...(request.context ? { context: request.context } : {}) };
  try {
    evidence = await retrieveChatNTCEvidence(repository, request.question, retrievalInput);
  } catch (error) {
    if (error instanceof ChatNTCContextError) throw new ChatNTCServerError("INVALID_CONTEXT");
    throw new ChatNTCServerError("RETRIEVAL_FAILED");
  }
  if (signal?.aborted) throw new ChatNTCServerError("REQUEST_ABORTED");
  let candidate: unknown;
  let activeProvider: ChatNTCProvider | null = null;
  let providerId: string | null = null;
  let model: string | null = null;
  if (!hasPrimaryContent(evidence)) {
    candidate = {
      formatVersion: 2, evidencePackageId: evidence.packageId,
      answer: "Non dispongo di evidence normativa sufficiente per rispondere. Specifica il riferimento o riformula la domanda.",
      classification: "no-direct-reference", status: "abstained", claims: [], usedEvidenceIds: [],
      warnings: ["Il retrieval non ha selezionato contenuto normativo primario utilizzabile."],
      needsMoreEvidence: true, externalResearchSuggested: false,
    } satisfies ChatNTCResponse;
  } else {
    const provider = dependencies.provider();
    activeProvider = provider;
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
  let canonical: ChatNTCResponse;
  let validation;
  let accounting: "normalized" | "expanded-and-regenerated" = "normalized";
  if (providerId === null) {
    if (!isChatNTCResponse(candidate)) throw new ChatNTCServerError("INVALID_RESPONSE_SCHEMA");
    canonical = candidate;
    try { validation = await validateChatNTCResponse(canonical, evidence, repository); }
    catch { throw new ChatNTCServerError("VALIDATION_FAILED"); }
  } else {
    if (!isChatNTCProviderOutput(candidate)) throw new ChatNTCServerError("INVALID_RESPONSE_SCHEMA");
    ({ canonical, validation } = await canonicalizeAndValidate(candidate, evidence));
  }
  if (!validation.valid) {
    const expansionReferences = validation.issues.filter((issue) => issue.category === "discovery")
      .map((issue) => issue.reference).filter((value): value is string => Boolean(value));
    const hasOnlyBookkeeping = validation.issues.length > 0 && validation.issues.every((issue) => issue.category === "bookkeeping");
    const canRegenerate = providerId !== null && (expansionReferences.length > 0 || hasOnlyBookkeeping)
      && new Set(expansionReferences).size <= 12;
    if (canRegenerate) {
      if (signal?.aborted) throw new ChatNTCServerError("REQUEST_ABORTED");
      const references = [...new Set(expansionReferences)];
      if (references.length) {
        try { evidence = await retrieveChatNTCEvidence(repository, request.question, { ...retrievalInput, requiredReferences: references }); }
        catch { throw new ChatNTCServerError("RETRIEVAL_FAILED"); }
      }
      if (!activeProvider) throw new ChatNTCServerError("INTERNAL_ERROR");
      try {
        candidate = await activeProvider.generate({
          messages: [...(request.history ?? []).map(({ role, content }) => ({ role, content })), { role: "user", content: request.question }],
          evidence: structuredClone(evidence), directives: structuredClone(CHATNTC_DIRECTIVES),
          outputSchema: structuredClone(CHATNTC_RESPONSE_JSON_SCHEMA), signal,
          repair: { issues: validation.issues.map(repairIssue) },
        });
      } catch (error) {
        if (error instanceof ChatNTCServerError) throw error;
        throw new ChatNTCServerError("PROVIDER_ERROR");
      }
      if (!isChatNTCProviderOutput(candidate)) throw new ChatNTCServerError("INVALID_RESPONSE_SCHEMA");
      ({ canonical, validation } = await canonicalizeAndValidate(candidate, evidence));
      accounting = references.length ? "expanded-and-regenerated" : "normalized";
    }
    if (!validation.valid) throw new ChatNTCServerError(validation.issues.some((issue) => issue.code === "invalid-response-shape")
      ? "INVALID_RESPONSE_SCHEMA" : "CITATION_VALIDATION_FAILED", validation.issues);
  }
  return {
    ok: true, response: canonical,
    citations: canonical.usedEvidenceIds.map((id) => citationForEvidence(evidence, id)),
    evidence: { packageId: evidence.packageId, structuralCodesVersion: evidence.corpus.version, corpusFingerprint: evidence.corpus.fingerprint,
      artifactFingerprint: evidence.corpus.artifactFingerprint, policyVersion: evidence.policyVersion,
      reduced: evidence.retrieval.reduced, warnings: evidence.warnings },
    generation: { provider: providerId, model, outcome: (canonical.formatVersion === 2 ? canonical.status === "abstained"
      : canonical.classification === "no-direct-reference") ? "abstained" : "generated" },
    validation: { valid: true, scope: "integrity-provenance-claim-coverage", accounting },
  };

  async function canonicalizeAndValidate(output: ChatNTCProviderOutput, activeEvidence: ChatNTCEvidencePackage) {
    let normalized;
    try { normalized = await canonicalizeChatNTCResponse(output, activeEvidence, repository); }
    catch { throw new ChatNTCServerError("VALIDATION_FAILED"); }
    let checked;
    try { checked = await validateChatNTCResponse(normalized.response, activeEvidence, repository); }
    catch { throw new ChatNTCServerError("VALIDATION_FAILED"); }
    const issues = deduplicateIssues([...normalized.issues, ...checked.issues]);
    return { canonical: normalized.response, validation: { valid: issues.length === 0, issues } };
  }
}

function repairIssue(issue: ChatNTCValidationIssue): Pick<ChatNTCValidationIssue, "code" | "path" | "message" | "reference"> {
  return { code: issue.code, path: issue.path, message: issue.message, ...(issue.reference ? { reference: issue.reference } : {}) };
}

function deduplicateIssues(issues: ChatNTCValidationIssue[]): ChatNTCValidationIssue[] {
  const seen = new Set<string>();
  return issues.filter((issue) => {
    const key = `${issue.code}\u0000${issue.path}\u0000${issue.reference ?? ""}\u0000${JSON.stringify(issue.targets ?? [])}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
