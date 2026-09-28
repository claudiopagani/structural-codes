import "server-only";
import {
  CHATNTC_DIRECTIVES, CHATNTC_RESPONSE_JSON_SCHEMA, canonicalizeChatNTCResponse,
  isChatNTCProviderOutput, retrieveChatNTCEvidence, validateChatNTCResponse, ChatNTCContextError,
  type ChatNTCCanonicalizationResult, type ChatNTCEvidencePackage, type ChatNTCProcessingStage,
  type ChatNTCProvider, type ChatNTCProviderOutput, type ChatNTCRepository, type ChatNTCRetrievalOptions,
  type ChatNTCValidationIssue, type ChatNTCVerifiedReference,
} from "../../shared/chatntc/index.js";
import type { ChatNTCResolvedTextualReference } from "../../shared/chatntc/canonicalization.js";
import { ChatNTCServerError } from "./errors.js";
import { retrieveChatNTCEvidenceForMode, type ChatNTCSemanticRetrievalConfiguration } from "./retrievalCoordinator.js";
import type { ChatRequest, ChatResult } from "../../shared/chatntc-ui/transport.js";

export type ChatNTCRequest = ChatRequest;
export type ChatNTCResult = ChatResult;

const REFERENCE_EXPANSION_LIMITS = Object.freeze({
  maxReferences: 12,
  additionalPrimaryUnits: 12,
  additionalEvidenceCharacters: 12_000,
});

interface CanonicalizedOutput {
  result: ChatNTCCanonicalizationResult;
  references: ChatNTCResolvedTextualReference[];
}

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
  const initialEvidence = await retrieve(request.question, retrievalInput);
  let activeEvidence = initialEvidence;
  if (signal?.aborted) throw new ChatNTCServerError("REQUEST_ABORTED");

  const provider = dependencies.provider();
  const messages = [...(request.history ?? []).map(({ role, content }) => ({ role, content })),
    { role: "user" as const, content: request.question }];
  let candidate = await generate(provider, activeEvidence);
  const diagnostics: ChatNTCValidationIssue[] = [];
  candidate = normalizePackage(candidate, activeEvidence, "Identificativo del contesto normalizzato dal server.");
  let canonicalized = await canonicalize(candidate, activeEvidence);
  let canonical = canonicalized.result;
  let stage: ChatNTCProcessingStage = canonical.response.verifiedReferences.length
    ? "REFERENCES_RESOLVED" : canonical.normalized ? "NORMALIZED" : "GENERATED";

  const initialExternalReferences = referencesOutsideEvidence(canonicalized.references, activeEvidence);
  if (initialExternalReferences.length) {
    diagnostics.push(...discoveryDiagnostics(initialExternalReferences));
    const requested = uniqueTargets(initialExternalReferences).slice(0, REFERENCE_EXPANSION_LIMITS.maxReferences);
    const expanded = await expandEvidence(requested.map((reference) => reference.text));
    if (expanded && requested.some((reference) => referenceIsInEvidence(reference.target, expanded))) {
      activeEvidence = expanded;
      candidate = await generate(provider, activeEvidence);
      candidate = normalizePackage(candidate, activeEvidence,
        "Identificativo del contesto ampliato normalizzato dal server.");
      canonicalized = await canonicalize(candidate, activeEvidence);
      canonical = canonicalized.result;
      stage = "EXPANDED";
    }
  }

  let activeIssues = await responseIssues(canonicalized, activeEvidence);
  if (activeIssues.length) {
    diagnostics.push(...activeIssues);
    candidate = await generate(provider, activeEvidence, {
      mode: "repair", issues: activeIssues.map(repairIssue), previousOutput: candidate,
    });
    candidate = normalizePackage(candidate, activeEvidence,
      "Identificativo del contesto del repair normalizzato dal server.");
    canonicalized = await canonicalize(candidate, activeEvidence);
    canonical = canonicalized.result;
    activeIssues = await responseIssues(canonicalized, activeEvidence);
    stage = "REPAIRED";
  }

  if (activeIssues.length) {
    diagnostics.push(...activeIssues);
    candidate = await generate(provider, activeEvidence, {
      mode: "conservative", issues: activeIssues.map(repairIssue), previousOutput: candidate,
    });
    candidate = normalizePackage(candidate, activeEvidence,
      "Identificativo del contesto della rigenerazione finale normalizzato dal server.");
    canonicalized = await canonicalize(candidate, activeEvidence);
    canonical = canonicalized.result;
    activeIssues = await responseIssues(canonicalized, activeEvidence);
    stage = "CONSERVATIVE_REGENERATED";
  }
  if (activeIssues.length) throw new ChatNTCServerError("UNVERIFIABLE_RESPONSE");

  let validation;
  try { validation = await validateChatNTCResponse(canonical.response, activeEvidence, repository); }
  catch { throw new ChatNTCServerError("VALIDATION_FAILED"); }
  if (!validation.valid) throw new ChatNTCServerError("UNVERIFIABLE_RESPONSE");
  // The provider is the sole author of the final visible text.
  if (canonical.response.answerMarkdown !== candidate.answerMarkdown) throw new ChatNTCServerError("VALIDATION_FAILED");

  return {
    ok: true, response: canonical.response, citations: canonical.response.verifiedReferences,
    evidence: { packageId: activeEvidence.packageId, structuralCodesVersion: activeEvidence.corpus.version,
      corpusFingerprint: activeEvidence.corpus.fingerprint, artifactFingerprint: activeEvidence.corpus.artifactFingerprint,
      policyVersion: activeEvidence.policyVersion, reduced: activeEvidence.retrieval.reduced, warnings: activeEvidence.warnings },
    generation: { provider: provider.id, model: provider.model ?? null, aiGenerated: true,
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

  async function expandEvidence(requiredReferences: readonly string[]): Promise<ChatNTCEvidencePackage | null> {
    const options = initialEvidence.retrieval.options;
    try {
      return await retrieveChatNTCEvidence(repository, request.question, {
        ...retrievalInput,
        requiredReferences,
        maxPrimaryUnits: Math.min(50, options.maxPrimaryUnits + REFERENCE_EXPANSION_LIMITS.additionalPrimaryUnits),
        maxEvidenceCharacters: Math.min(1_000_000,
          options.maxEvidenceCharacters + REFERENCE_EXPANSION_LIMITS.additionalEvidenceCharacters),
      });
    } catch {
      if (signal?.aborted) throw new ChatNTCServerError("REQUEST_ABORTED");
      diagnostics.push({ code: "evidence-expansion-failed", path: "response.references",
        message: "Espansione canonica limitata non completata.", category: "discovery" });
      return null;
    }
  }

  async function generate(activeProvider: ChatNTCProvider, activeEvidence: ChatNTCEvidencePackage,
    repair?: { mode: "repair" | "conservative"; issues: ReturnType<typeof repairIssue>[];
      previousOutput: ChatNTCProviderOutput }) {
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

  async function canonicalize(output: ChatNTCProviderOutput, evidenceForGeneration: ChatNTCEvidencePackage) {
    const references: ChatNTCResolvedTextualReference[] = [];
    try {
      const result = await canonicalizeChatNTCResponse(output, evidenceForGeneration, repository,
        (reference) => references.push(reference));
      return { result, references };
    }
    catch { throw new ChatNTCServerError("VALIDATION_FAILED"); }
  }

  async function responseIssues(output: CanonicalizedOutput, evidenceForGeneration: ChatNTCEvidencePackage) {
    const issues = allReferenceIssues(output, evidenceForGeneration);
    let validation;
    try { validation = await validateChatNTCResponse(output.result.response, evidenceForGeneration, repository); }
    catch { throw new ChatNTCServerError("VALIDATION_FAILED"); }
    // Evidence/corpus integrity is independent of the generated response and cannot be repaired by an LLM.
    if (validation.issues.some((issue) => !issue.path.startsWith("response")))
      throw new ChatNTCServerError("VALIDATION_FAILED");
    const seen = new Set(issues.map((issue) => `${issue.code}\u0000${issue.path}\u0000${issue.reference ?? ""}`));
    for (const issue of validation.issues) {
      const key = `${issue.code}\u0000${issue.path}\u0000${issue.reference ?? ""}`;
      if (!seen.has(key)) { issues.push(issue); seen.add(key); }
    }
    return issues;
  }

  function normalizePackage(output: ChatNTCProviderOutput, evidenceForGeneration: ChatNTCEvidencePackage,
    message: string): ChatNTCProviderOutput {
    if (output.evidencePackageId === evidenceForGeneration.packageId) return output;
    diagnostics.push({ code: "wrong-package", path: "response.evidencePackageId", message, category: "bookkeeping" });
    return { ...output, evidencePackageId: evidenceForGeneration.packageId };
  }
}

function targetKey(reference: ChatNTCVerifiedReference): string {
  return `${reference.unitId}\u0000${reference.blockId ?? ""}\u0000${reference.assetId ?? ""}`;
}

function uniqueTargets(references: readonly ChatNTCResolvedTextualReference[]): ChatNTCResolvedTextualReference[] {
  const seen = new Set<string>();
  return references.filter((reference) => {
    const key = targetKey(reference.target);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function referenceIsInEvidence(reference: ChatNTCVerifiedReference, evidence: ChatNTCEvidencePackage): boolean {
  const unit = [...evidence.primaryUnits, ...evidence.relatedUnits]
    .find((candidate) => candidate.unitId === reference.unitId);
  if (!unit) return false;
  if (reference.assetId) return unit.blocks.some((block) => block.assetId === reference.assetId
    && (!reference.blockId || block.blockId === reference.blockId));
  if (reference.blockId) return unit.blocks.some((block) => block.blockId === reference.blockId);
  return true;
}

function referencesOutsideEvidence(references: readonly ChatNTCResolvedTextualReference[],
  evidence: ChatNTCEvidencePackage): ChatNTCResolvedTextualReference[] {
  return references.filter((reference) => !referenceIsInEvidence(reference.target, evidence));
}

function discoveryDiagnostics(references: readonly ChatNTCResolvedTextualReference[]): ChatNTCValidationIssue[] {
  return uniqueTargets(references).map((reference) => ({
    code: "post-hoc-reference-discovered", path: reference.path,
    message: "Riferimento canonico rilevato fuori dal contesto della prima generazione.",
    category: "discovery", reference: reference.text,
    targets: [{ unitId: reference.target.unitId, ...(reference.target.blockId ? { blockId: reference.target.blockId } : {}),
      ...(reference.target.assetId ? { assetId: reference.target.assetId } : {}) }],
  }));
}

function outsideEvidenceIssues(references: readonly ChatNTCResolvedTextualReference[],
  evidence: ChatNTCEvidencePackage): ChatNTCValidationIssue[] {
  return referencesOutsideEvidence(references, evidence).map((reference) => ({
    code: "reference-outside-generation-evidence", path: reference.path,
    message: `Riferimento risolto canonicamente ma non presente nel contesto letto dal provider: ${reference.text}`,
    category: "integrity", reference: reference.text,
    targets: [{ unitId: reference.target.unitId, ...(reference.target.blockId ? { blockId: reference.target.blockId } : {}),
      ...(reference.target.assetId ? { assetId: reference.target.assetId } : {}) }],
  }));
}

function allReferenceIssues(canonicalized: CanonicalizedOutput,
  evidence: ChatNTCEvidencePackage): ChatNTCValidationIssue[] {
  return [...canonicalized.result.issues, ...outsideEvidenceIssues(canonicalized.references, evidence)];
}

function repairIssue(issue: ChatNTCValidationIssue): Pick<ChatNTCValidationIssue, "code" | "path" | "message" | "reference"> {
  return { code: issue.code, path: issue.path, message: issue.message, ...(issue.reference ? { reference: issue.reference } : {}) };
}
