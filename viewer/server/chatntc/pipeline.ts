import "server-only";
import {
  CHATNTC_DIRECTIVES, CHATNTC_RESPONSE_JSON_SCHEMA, canonicalizeChatNTCResponse,
  isChatNTCProviderOutput, retrieveChatNTCEvidence, validateChatNTCResponse, ChatNTCContextError,
  type ChatNTCEvidencePackage, type ChatNTCProcessingStage,
  type ChatNTCProvider, type ChatNTCProviderOutput, type ChatNTCRepository, type ChatNTCRetrievalOptions,
  type ChatNTCValidationIssue,
} from "../../shared/chatntc/index.js";
import { findCrossReferences } from "../../shared/crossReferences.js";
import { ChatNTCServerError } from "./errors.js";
import type { ChatRequest, ChatResult } from "../../shared/chatntc-ui/transport.js";

export type ChatNTCRequest = ChatRequest;
export type ChatNTCResult = ChatResult;

export async function runChatNTC(request: ChatNTCRequest, dependencies: {
  repository: ChatNTCRepository;
  provider: () => ChatNTCProvider;
  retrievalOptions?: ChatNTCRetrievalOptions;
  signal?: AbortSignal;
}): Promise<ChatNTCResult> {
  const { repository, signal } = dependencies;
  if (signal?.aborted) throw new ChatNTCServerError("REQUEST_ABORTED");
  const queryContext = (request.history ?? []).filter((message) => message.role === "user").slice(-3).map((message) => message.content);
  const retrievalInput = { ...dependencies.retrievalOptions, queryContext, ...(request.context ? { context: request.context } : {}) };
  let evidence = await retrieve(request.question, retrievalInput);
  if (signal?.aborted) throw new ChatNTCServerError("REQUEST_ABORTED");

  const provider = dependencies.provider();
  const messages = [...(request.history ?? []).map(({ role, content }) => ({ role, content })),
    { role: "user" as const, content: request.question }];
  let candidate = await generate(provider, evidence);
  if (candidate.evidencePackageId !== evidence.packageId) hardReject([{ code: "wrong-package",
    path: "response.evidencePackageId", message: "Risposta associata a un altro contesto normativo.", category: "integrity" }]);
  let canonical = await canonicalize(candidate, evidence);
  let stage: ChatNTCProcessingStage = canonical.normalized ? "NORMALIZED" : "GENERATED";
  let expanded = false;
  let repaired = false;

  if (discoveryReferences(canonical.issues).length) {
    evidence = await expand(canonical.issues);
    candidate = { ...candidate, evidencePackageId: evidence.packageId };
    expanded = true;
    canonical = await canonicalize(candidate, evidence);
    stage = "EXPANDED";
  }

  if (repairableIssues(canonical.issues).length) {
    repaired = true;
    candidate = await generate(provider, evidence, {
      issues: repairableIssues(canonical.issues).map(repairIssue), previousOutput: candidate,
    });
    if (candidate.evidencePackageId !== evidence.packageId) hardReject([{ code: "wrong-package",
      path: "response.evidencePackageId", message: "Repair associato a un altro contesto normativo.", category: "integrity" }]);
    canonical = await canonicalize(candidate, evidence);
    stage = "REPAIRED";
    if (!expanded && discoveryReferences(canonical.issues).length) {
      evidence = await expand(canonical.issues);
      candidate = { ...candidate, evidencePackageId: evidence.packageId };
      expanded = true;
      canonical = await canonicalize(candidate, evidence);
      stage = "EXPANDED";
    }
  }

  if (canonical.issues.length) {
    const sanitized = sanitizeReferences(candidate, canonical.issues);
    if (!sanitized || (repaired && sanitized.answerMarkdown === candidate.answerMarkdown
      && sanitized.references.length === candidate.references.length)) hardReject(canonical.issues);
    candidate = sanitized;
    canonical = await canonicalize(candidate, evidence);
    stage = "PARTIALLY_SANITIZED";
  }
  if (canonical.issues.length) hardReject(canonical.issues);

  let validation;
  try { validation = await validateChatNTCResponse(canonical.response, evidence, repository); }
  catch { throw new ChatNTCServerError("VALIDATION_FAILED"); }
  if (!validation.valid) hardReject(validation.issues);

  return {
    ok: true, response: canonical.response, citations: canonical.response.verifiedReferences,
    evidence: { packageId: evidence.packageId, structuralCodesVersion: evidence.corpus.version,
      corpusFingerprint: evidence.corpus.fingerprint, artifactFingerprint: evidence.corpus.artifactFingerprint,
      policyVersion: evidence.policyVersion, reduced: evidence.retrieval.reduced, warnings: evidence.warnings },
    generation: { provider: provider.id, model: provider.model ?? null,
      outcome: canonical.response.status === "abstained" ? "abstained" : "generated" },
    validation: { valid: true, scope: "integrity-provenance-reference-resolution", stage },
  };

  async function retrieve(question: string, options: ChatNTCRetrievalOptions) {
    try { return await retrieveChatNTCEvidence(repository, question, options); }
    catch (error) {
      if (error instanceof ChatNTCContextError) throw new ChatNTCServerError("INVALID_CONTEXT");
      throw new ChatNTCServerError("RETRIEVAL_FAILED");
    }
  }

  async function expand(issues: ChatNTCValidationIssue[]) {
    const references = discoveryReferences(issues);
    if (references.length > 12) hardReject(issues);
    if (signal?.aborted) throw new ChatNTCServerError("REQUEST_ABORTED");
    return retrieve(request.question, { ...retrievalInput, requiredReferences: references });
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

function discoveryReferences(issues: ChatNTCValidationIssue[]): string[] {
  return [...new Set(issues.filter((issue) => issue.category === "discovery")
    .map((issue) => issue.reference).filter((value): value is string => Boolean(value)))];
}

function repairableIssues(issues: ChatNTCValidationIssue[]): ChatNTCValidationIssue[] {
  return issues.filter((issue) => ["unresolved-reference", "ambiguous-reference"].includes(issue.code));
}

function repairIssue(issue: ChatNTCValidationIssue): Pick<ChatNTCValidationIssue, "code" | "path" | "message" | "reference"> {
  return { code: issue.code, path: issue.path, message: issue.message, ...(issue.reference ? { reference: issue.reference } : {}) };
}

/** Remove only clauses/lines that contain a reference still unverifiable after the single repair. */
function sanitizeReferences(output: ChatNTCProviderOutput, issues: ChatNTCValidationIssue[]): ChatNTCProviderOutput | null {
  const invalid = [...new Set(issues.map((issue) => issue.reference).filter((value): value is string => Boolean(value)))];
  if (!invalid.length) return null;
  const containsInvalid = (value: string) => invalid.some((reference) => value.toLocaleLowerCase("it")
    .includes(reference.toLocaleLowerCase("it")));
  const answerMarkdown = output.answerMarkdown.split(/\n/u).map((line) => line
    .split(/(?<=[.!?])\s+/u).filter((sentence) => !containsInvalid(sentence)).join(" ").trim())
    .filter((line, position, lines) => line || (position > 0 && position < lines.length - 1))
    .join("\n").replace(/\n{3,}/gu, "\n\n").trim();
  if (!answerMarkdown) return null;
  const references = output.references.filter((value) => !containsInvalid(value)
    && !findCrossReferences(value).some((reference) => containsInvalid(reference.text)));
  return { ...output, answerMarkdown, references };
}

function hardReject(issues: ChatNTCValidationIssue[]): never {
  throw new ChatNTCServerError(issues.some((issue) => issue.code === "invalid-response-shape")
    ? "INVALID_RESPONSE_SCHEMA" : "CITATION_VALIDATION_FAILED", issues);
}
