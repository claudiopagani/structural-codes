import "server-only";
import {
  CHATNTC_DIRECTIVES, CHATNTC_RESPONSE_JSON_SCHEMA, canonicalizeChatNTCResponse,
  isChatNTCProviderOutput, validateChatNTCResponse, ChatNTCContextError,
  type ChatNTCEvidencePackage, type ChatNTCProcessingStage,
  type ChatNTCProvider, type ChatNTCProviderOutput, type ChatNTCRepository, type ChatNTCRetrievalOptions,
  type ChatNTCValidationIssue,
} from "../../shared/chatntc/index.js";
import { findCrossReferences } from "../../shared/crossReferences.js";
import { ChatNTCServerError } from "./errors.js";
import { retrieveChatNTCEvidenceForMode, type ChatNTCSemanticRetrievalConfiguration } from "./retrievalCoordinator.js";
import type { ChatRequest, ChatResult } from "../../shared/chatntc-ui/transport.js";

export type ChatNTCRequest = ChatRequest;
export type ChatNTCResult = ChatResult;

export async function runChatNTC(request: ChatNTCRequest, dependencies: {
  repository: ChatNTCRepository;
  provider: () => ChatNTCProvider;
  retrievalOptions?: ChatNTCRetrievalOptions;
  semanticRetrieval?: ChatNTCSemanticRetrievalConfiguration;
  signal?: AbortSignal;
}): Promise<ChatNTCResult> {
  const { repository, signal } = dependencies;
  if (signal?.aborted) throw new ChatNTCServerError("REQUEST_ABORTED");
  const queryContext = (request.history ?? []).filter((message) => message.role === "user").slice(-3).map((message) => message.content);
  const retrievalInput = { ...dependencies.retrievalOptions, queryContext, ...(request.context ? { context: request.context } : {}) };
  const evidence = await retrieve(request.question, retrievalInput);
  if (signal?.aborted) throw new ChatNTCServerError("REQUEST_ABORTED");

  const provider = dependencies.provider();
  const messages = [...(request.history ?? []).map(({ role, content }) => ({ role, content })),
    { role: "user" as const, content: request.question }];
  let candidate = await generate(provider, evidence);
  const diagnostics: ChatNTCValidationIssue[] = [];
  if (candidate.evidencePackageId !== evidence.packageId) {
    diagnostics.push({ code: "wrong-package", path: "response.evidencePackageId",
      message: "Identificativo del contesto normalizzato dal server.", category: "bookkeeping" });
    candidate = { ...candidate, evidencePackageId: evidence.packageId };
  }
  let canonical = await canonicalize(candidate, evidence);
  let stage: ChatNTCProcessingStage = canonical.response.verifiedReferences.length
    ? "REFERENCES_RESOLVED" : canonical.normalized ? "NORMALIZED" : "GENERATED";

  if (repairableIssues(canonical.issues).length) {
    diagnostics.push(...canonical.issues);
    candidate = await generate(provider, evidence, {
      issues: repairableIssues(canonical.issues).map(repairIssue), previousOutput: candidate,
    });
    if (candidate.evidencePackageId !== evidence.packageId) {
      diagnostics.push({ code: "wrong-package", path: "response.evidencePackageId",
        message: "Identificativo del contesto del repair normalizzato dal server.", category: "bookkeeping" });
      candidate = { ...candidate, evidencePackageId: evidence.packageId };
    }
    canonical = await canonicalize(candidate, evidence);
    stage = "REPAIRED";
  }

  let referenceWarning: "some-references-omitted" | "no-references-verified" | undefined;
  if (canonical.issues.length) {
    diagnostics.push(...canonical.issues);
    const sanitized = sanitizeReferences(candidate, canonical.issues);
    candidate = sanitized.output;
    diagnostics.push(...canonical.issues.map((issue) => ({ ...issue, code: "stripped-reference",
      message: `Riferimento omesso dopo la verifica: ${issue.reference ?? "non disponibile"}` })));
    canonical = await canonicalize(candidate, evidence);
    stage = canonical.response.verifiedReferences.length ? "PARTIALLY_SANITIZED" : "DEGRADED";
    referenceWarning = canonical.response.verifiedReferences.length
      ? "some-references-omitted" : "no-references-verified";
  }
  if (canonical.issues.length) {
    diagnostics.push(...canonical.issues);
    candidate = degradeWithoutReferences(candidate, canonical.issues, evidence.packageId);
    canonical = await canonicalize(candidate, evidence);
    stage = "DEGRADED";
    referenceWarning = "no-references-verified";
  }
  if (referenceWarning) canonical.response.referenceWarning = referenceWarning;

  let validation;
  try { validation = await validateChatNTCResponse(canonical.response, evidence, repository); }
  catch { throw new ChatNTCServerError("VALIDATION_FAILED"); }
  if (!validation.valid) throw new ChatNTCServerError("VALIDATION_FAILED");

  return {
    ok: true, response: canonical.response, citations: canonical.response.verifiedReferences,
    evidence: { packageId: evidence.packageId, structuralCodesVersion: evidence.corpus.version,
      corpusFingerprint: evidence.corpus.fingerprint, artifactFingerprint: evidence.corpus.artifactFingerprint,
      policyVersion: evidence.policyVersion, reduced: evidence.retrieval.reduced, warnings: evidence.warnings },
    generation: { provider: provider.id, model: provider.model ?? null,
      outcome: canonical.response.status === "abstained" ? "abstained" : "generated" },
    validation: { valid: true, scope: "integrity-provenance-reference-resolution", stage,
      ...(diagnostics.length ? { diagnostics } : {}) },
  };

  async function retrieve(question: string, options: ChatNTCRetrievalOptions) {
    try { return await retrieveChatNTCEvidenceForMode(repository, question, options, dependencies.semanticRetrieval, signal); }
    catch (error) {
      if (error instanceof ChatNTCContextError) throw new ChatNTCServerError("INVALID_CONTEXT");
      throw new ChatNTCServerError("RETRIEVAL_FAILED");
    }
  }

  async function generate(activeProvider: ChatNTCProvider, activeEvidence: ChatNTCEvidencePackage,
    repair?: { issues: ReturnType<typeof repairIssue>[]; previousOutput: ChatNTCProviderOutput }) {
    if (signal?.aborted) throw new ChatNTCServerError("REQUEST_ABORTED");
    try {
      const output = await activeProvider.generate({ messages, evidence: structuredClone(activeEvidence),
        directives: structuredClone(CHATNTC_DIRECTIVES), outputSchema: structuredClone(CHATNTC_RESPONSE_JSON_SCHEMA),
        ...(repair ? { repair } : {}), signal });
      if (!isChatNTCProviderOutput(output)) throw new ChatNTCServerError("INVALID_RESPONSE_SCHEMA");
      return output;
    } catch (error) {
      if (error instanceof ChatNTCServerError) throw error;
      throw new ChatNTCServerError("PROVIDER_ERROR");
    }
  }

  async function canonicalize(output: ChatNTCProviderOutput, activeEvidence: ChatNTCEvidencePackage) {
    try { return await canonicalizeChatNTCResponse(output, activeEvidence, repository); }
    catch { throw new ChatNTCServerError("VALIDATION_FAILED"); }
  }
}

function repairableIssues(issues: ChatNTCValidationIssue[]): ChatNTCValidationIssue[] {
  return issues.filter((issue) => ["unresolved-reference", "ambiguous-reference", "canonical-reference-missing"].includes(issue.code));
}

function repairIssue(issue: ChatNTCValidationIssue): Pick<ChatNTCValidationIssue, "code" | "path" | "message" | "reference"> {
  return { code: issue.code, path: issue.path, message: issue.message, ...(issue.reference ? { reference: issue.reference } : {}) };
}

/** Remove only clauses/lines that contain a reference still unverifiable after the single repair. */
function sanitizeReferences(output: ChatNTCProviderOutput, issues: ChatNTCValidationIssue[]): { output: ChatNTCProviderOutput } {
  const invalid = [...new Set(issues.map((issue) => issue.reference).filter((value): value is string => Boolean(value)))];
  if (!invalid.length) return { output: { ...output, references: [], status: "partial", needsMoreEvidence: true } };
  const containsInvalid = (value: string) => invalid.some((reference) => value.toLocaleLowerCase("it")
    .includes(reference.toLocaleLowerCase("it")));
  let answerMarkdown = output.answerMarkdown.split(/\n/u).map((line) => line
    .split(/(?<=[.!?])\s+/u).filter((sentence) => !containsInvalid(sentence)).join(" ").trim())
    .filter((line, position, lines) => line || (position > 0 && position < lines.length - 1))
    .join("\n").replace(/\n{3,}/gu, "\n\n").trim();
  if (!answerMarkdown) answerMarkdown = GENERIC_REFERENCE_FALLBACK;
  const references = output.references.filter((value) => !containsInvalid(value)
    && !findCrossReferences(value).some((reference) => containsInvalid(reference.text)));
  return { output: { ...output, answerMarkdown, references,
    ...(references.length || findCrossReferences(answerMarkdown).length ? {} : {
      classification: "no-direct-reference" as const,
      status: answerMarkdown === output.answerMarkdown ? output.status : "partial" as const,
      needsMoreEvidence: answerMarkdown === output.answerMarkdown ? output.needsMoreEvidence : true,
    }) } };
}

const GENERIC_REFERENCE_FALLBACK = "Non è stato possibile verificare l'attribuzione normativa specifica contenuta nella risposta generata.";

/** Final reference degradation keeps every reference-free technical sentence already recovered. */
function degradeWithoutReferences(output: ChatNTCProviderOutput, issues: ChatNTCValidationIssue[],
  evidencePackageId: string): ChatNTCProviderOutput {
  const sanitized = sanitizeReferences(output, issues).output;
  const answerMarkdown = sanitized.answerMarkdown.split(/\n/u).map((line) => line
    .split(/(?<=[.!?])\s+/u).filter((sentence) => findCrossReferences(sentence).length === 0).join(" ").trim())
    .filter((line, position, lines) => line || (position > 0 && position < lines.length - 1))
    .join("\n").replace(/\n{3,}/gu, "\n\n").trim() || GENERIC_REFERENCE_FALLBACK;
  return { ...sanitized, evidencePackageId, answerMarkdown, references: [],
    classification: "no-direct-reference", status: "partial", needsMoreEvidence: true };
}
