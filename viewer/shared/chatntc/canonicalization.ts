import { findCrossReferences } from "../crossReferences.js";
import { citationForEvidence, evidenceUnits, stableJson } from "./evidence.js";
import { chatNTCIssueCategory } from "./issueCategories.js";
import type {
  ChatNTCCanonicalizationResult, ChatNTCCitation, ChatNTCClassification, ChatNTCEvidencePackage,
  ChatNTCProviderOutput, ChatNTCRepository, ChatNTCTarget, ChatNTCValidationIssue,
} from "./types.js";

interface TextualReference { text: string; path: string }

/**
 * Converts a small provider response into the rich public response. Explicit references in
 * prose and in references[] are resolved against the repository; provider metadata is never trusted.
 */
export async function canonicalizeChatNTCResponse(output: ChatNTCProviderOutput, evidence: ChatNTCEvidencePackage,
  repository: ChatNTCRepository): Promise<ChatNTCCanonicalizationResult> {
  const issueMap = new Map<string, ChatNTCValidationIssue>();
  const selected = evidenceUnits(evidence);
  const citations = new Map<string, ChatNTCCitation>();
  let normalized = false;

  function add(code: string, path: string, message: string, details: Pick<ChatNTCValidationIssue, "reference" | "targets"> = {}) {
    const issue = { code, path, message, category: chatNTCIssueCategory(code), ...details };
    const key = `${code}\u0000${path}\u0000${details.reference ?? ""}\u0000${stableJson(details.targets ?? [])}`;
    issueMap.set(key, issue);
  }

  function selectedIdsForTargets(targets: ChatNTCTarget[]): string[] {
    const ids = new Set<string>();
    for (const target of targets) for (const unit of selected) {
      if (unit.unitId !== target.unitId) continue;
      if (!target.blockId && !target.assetId) ids.add(unit.evidenceId);
      for (const block of unit.blocks) {
        if (target.assetId ? block.assetId === target.assetId && (!target.blockId || block.blockId === target.blockId)
          : target.blockId && block.blockId === target.blockId) ids.add(block.evidenceId);
      }
    }
    return [...ids];
  }

  for (const reference of textualReferences(output)) {
    const targets = await repository.resolveExact(reference.text);
    const canonicalTargets = (targets ?? []).map(({ unitId, blockId, assetId }) => ({ unitId,
      ...(blockId ? { blockId } : {}), ...(assetId ? { assetId } : {}) }));
    if (!targets?.length) {
      add("unresolved-reference", reference.path, `Riferimento normativo non risolvibile: ${reference.text}`,
        { reference: reference.text });
      continue;
    }
    if (targets.length > 1) {
      add("ambiguous-reference", reference.path, `Riferimento normativo ambiguo: ${reference.text}`,
        { reference: reference.text, targets: canonicalTargets });
      continue;
    }
    const ids = selectedIdsForTargets(canonicalTargets);
    if (ids.length === 0) {
      add("unselected-canonical-reference", reference.path,
        `Riferimento canonico reale non incluso nel contesto iniziale: ${reference.text}`,
        { reference: reference.text, targets: canonicalTargets });
      continue;
    }
    if (ids.length > 1) {
      add("ambiguous-reference", reference.path, `Riferimento associato a più passaggi canonici: ${reference.text}`,
        { reference: reference.text, targets: canonicalTargets });
      continue;
    }
    const citation = citationForEvidence(evidence, ids[0]);
    const key = stableJson({ unitId: citation.unitId, blockId: citation.blockId, assetId: citation.assetId });
    if (citations.has(key)) normalized = true;
    else citations.set(key, citation);
  }

  const verifiedReferences = [...citations.values()];
  const classification = canonicalClassification(output.status, output.classification, verifiedReferences.length);
  const needsMoreEvidence = output.status !== "answered";
  const answerMarkdown = normalizeVisibleAnswer(output.answerMarkdown);
  if (classification !== output.classification || needsMoreEvidence !== output.needsMoreEvidence
    || answerMarkdown !== output.answerMarkdown) normalized = true;
  return {
    response: {
      formatVersion: 3, evidencePackageId: output.evidencePackageId, answerMarkdown,
      classification, status: output.status, verifiedReferences, warnings: [], needsMoreEvidence,
      externalResearchSuggested: output.externalResearchSuggested,
    },
    issues: [...issueMap.values()], normalized,
  };
}

function normalizeVisibleAnswer(value: string): string {
  return value
    .replace(/Evidence Package/giu, "fonti normative")
    .replace(/selected evidence/giu, "fonti selezionate")
    .replace(/claim coverage/giu, "copertura delle fonti")
    .replace(/source-checked|double-reviewed/giu, "stato editoriale")
    .replace(/corpus fingerprint/giu, "versione delle fonti")
    .replace(/\b(?:unitId|blockId|assetId|retrieval|validator|package|block)\b/giu, "dato interno")
    .replace(/\bevidence\b/giu, "fonti")
    .replace(/blocchi omessi dal budget/giu, "contenuto non incluso")
    .replace(/[ \t]{2,}/gu, " ")
    .trim();
}

function textualReferences(output: ChatNTCProviderOutput): TextualReference[] {
  const values: TextualReference[] = findCrossReferences(output.answerMarkdown)
    .map((reference) => ({ text: reference.text, path: "response.answerMarkdown" }));
  for (const [position, declared] of output.references.entries()) {
    const found = findCrossReferences(declared);
    if (found.length) values.push(...found.map((reference) => ({ text: reference.text, path: `response.references[${position}]` })));
    else values.push({ text: declared, path: `response.references[${position}]` });
  }
  const seen = new Set<string>();
  return values.filter((reference) => {
    const key = `${reference.path.startsWith("response.answer") ? "answer" : "declared"}\u0000${reference.text.trim().toUpperCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function canonicalClassification(status: ChatNTCProviderOutput["status"], declared: ChatNTCClassification,
  referenceCount: number): ChatNTCClassification {
  if (status === "abstained" || referenceCount === 0) return "no-direct-reference";
  if (declared === "interpretation" || declared === "no-direct-reference") return declared;
  if (referenceCount > 1) return "combined-reference";
  return "direct-reference";
}
