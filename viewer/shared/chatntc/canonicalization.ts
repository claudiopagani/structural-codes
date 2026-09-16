import { findCrossReferences } from "../crossReferences.js";
import { citationForEvidence, evidenceUnits, stableJson } from "./evidence.js";
import { chatNTCIssueCategory } from "./issueCategories.js";
import type {
  ChatNTCCanonicalizationResult, ChatNTCCitation, ChatNTCClaim, ChatNTCClassification, ChatNTCEvidencePackage,
  ChatNTCProviderOutput, ChatNTCRepository, ChatNTCTarget, ChatNTCValidationIssue,
} from "./types.js";

/**
 * Converts minimal provider bookkeeping into the rich public response.
 * It only associates explicit, unambiguous references with already-selected evidence.
 */
export async function canonicalizeChatNTCResponse(output: ChatNTCProviderOutput, evidence: ChatNTCEvidencePackage,
  repository: ChatNTCRepository): Promise<ChatNTCCanonicalizationResult> {
  const issueMap = new Map<string, ChatNTCValidationIssue>();
  const selected = evidenceUnits(evidence);
  const evidenceIds = new Set(selected.flatMap((unit) => [unit.evidenceId, ...unit.blocks.map((block) => block.evidenceId)]));
  const answerEvidenceIds = new Set<string>();
  let normalized = false;

  function add(code: string, path: string, message: string, details: Pick<ChatNTCValidationIssue, "reference" | "targets"> = {}) {
    const issue = { code, path, message, category: chatNTCIssueCategory(code), ...details };
    const targetKey = stableJson(details.targets ?? []);
    issueMap.set(`${code}\u0000${path}\u0000${details.reference ?? ""}\u0000${targetKey}`, issue);
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

  async function associateMentions(value: string, path: string, destination: Set<string>) {
    const seen = new Set<string>();
    for (const reference of findCrossReferences(value)) {
      const targets = await repository.resolveExact(reference.text);
      const canonicalTargets = (targets ?? []).map(({ unitId, blockId, assetId }) => ({ unitId,
        ...(blockId ? { blockId } : {}), ...(assetId ? { assetId } : {}) }));
      const mentionKey = `${reference.kind}:${reference.number}:${stableJson(canonicalTargets)}`;
      if (seen.has(mentionKey)) { normalized = true; continue; }
      seen.add(mentionKey);
      if (!targets?.length) {
        add("unresolved-reference", path, `Riferimento normativo non risolvibile: ${reference.text}`, { reference: reference.text });
        continue;
      }
      const ids = selectedIdsForTargets(canonicalTargets);
      if (ids.length === 0) {
        add("unselected-canonical-reference", path, `Riferimento canonico reale non incluso nell'evidence: ${reference.text}`,
          { reference: reference.text, targets: canonicalTargets });
      } else if (ids.length === 1) {
        if (!destination.has(ids[0])) normalized = true;
        destination.add(ids[0]);
      } else {
        add("ambiguous-reference", path, `Riferimento canonico ambiguo: ${reference.text}`,
          { reference: reference.text, targets: canonicalTargets });
      }
    }
  }

  const claims: ChatNTCClaim[] = [];
  for (const [position, claim] of output.claims.entries()) {
    const path = `response.claims[${position}]`;
    const ids = new Set<string>();
    for (const evidenceId of claim.evidenceIds) {
      if (!evidenceIds.has(evidenceId)) add("evidence-not-selected", `${path}.evidenceIds`, "Evidence ID non incluso nel pacchetto.");
      else if (ids.has(evidenceId)) normalized = true;
      else ids.add(evidenceId);
    }
    await associateMentions(claim.text, path, ids);
    const citations: ChatNTCCitation[] = [...ids].map((id) => citationForEvidence(evidence, id));
    claims.push({ id: claim.id, text: claim.text, classification: claim.classification, citations });
  }
  await associateMentions(output.answer, "response.answer", answerEvidenceIds);
  const usedEvidenceIds = [...new Set([...claims.flatMap((claim) => claim.citations.map((citation) => citation.evidenceId)), ...answerEvidenceIds])];
  const classification = canonicalClassification(output.status, output.classification, claims.map((claim) => claim.classification), usedEvidenceIds.length);
  if (classification !== output.classification) normalized = true;
  return {
    response: {
      formatVersion: 2, evidencePackageId: output.evidencePackageId, answer: output.answer, classification, status: output.status,
      claims, usedEvidenceIds, warnings: output.warnings, needsMoreEvidence: output.needsMoreEvidence,
      externalResearchSuggested: output.externalResearchSuggested,
    },
    issues: [...issueMap.values()], normalized,
  };
}

function canonicalClassification(status: ChatNTCProviderOutput["status"], declared: ChatNTCClassification,
  claims: ChatNTCClassification[], usedCount: number): ChatNTCClassification {
  if (status === "abstained") return "no-direct-reference";
  if (claims.includes("interpretation")) return "interpretation";
  if (claims.includes("combined-reference") || usedCount > 1) return "combined-reference";
  if (claims.includes("no-direct-reference")) return "no-direct-reference";
  if (claims.includes("direct-reference")) return "direct-reference";
  return declared;
}
