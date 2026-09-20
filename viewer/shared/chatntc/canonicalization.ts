import { findCrossReferences } from "../crossReferences.js";
import { stableJson } from "./evidence.js";
import { chatNTCIssueCategory } from "./issueCategories.js";
import type {
  ChatNTCCanonicalizationResult, ChatNTCClassification, ChatNTCEvidencePackage,
  ChatNTCProviderOutput, ChatNTCRepository, ChatNTCTarget, ChatNTCValidationIssue, ChatNTCVerifiedReference,
} from "./types.js";

interface TextualReference { text: string; path: string }

/**
 * Converts a small provider response into the rich public response. Explicit references in
 * prose and in references[] are resolved against the repository; provider metadata is never trusted.
 */
export async function canonicalizeChatNTCResponse(output: ChatNTCProviderOutput, evidence: ChatNTCEvidencePackage,
  repository: ChatNTCRepository): Promise<ChatNTCCanonicalizationResult> {
  const issueMap = new Map<string, ChatNTCValidationIssue>();
  const citations = new Map<string, ChatNTCVerifiedReference>();
  let normalized = false;

  function add(code: string, path: string, message: string, details: Pick<ChatNTCValidationIssue, "reference" | "targets"> = {}) {
    const issue = { code, path, message, category: chatNTCIssueCategory(code), ...details };
    const key = `${code}\u0000${path}\u0000${details.reference ?? ""}\u0000${stableJson(details.targets ?? [])}`;
    issueMap.set(key, issue);
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
    const citation = await verifiedReferenceForTarget(repository, canonicalTargets[0]);
    if (!citation) {
      add("canonical-reference-missing", reference.path, `Target canonico non caricabile: ${reference.text}`,
        { reference: reference.text, targets: canonicalTargets });
      continue;
    }
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

async function verifiedReferenceForTarget(repository: ChatNTCRepository,
  target: ChatNTCTarget): Promise<ChatNTCVerifiedReference | null> {
  const record = await repository.getUnit(target.unitId);
  if (!record) return null;
  const block = target.blockId
    ? record.unit.blocks.find((candidate) => candidate.blockId === target.blockId)
    : target.assetId ? record.unit.blocks.find((candidate) => candidate.assetId === target.assetId) : undefined;
  if ((target.blockId || target.assetId) && !block) return null;
  if (target.assetId) {
    const collections = [
      ["formula", record.assets.formulas[target.assetId]],
      ["table", record.assets.tables[target.assetId]],
      ["figure", record.assets.figures[target.assetId]],
    ] as const;
    const found = collections.find(([, asset]) => Boolean(asset));
    if (!found || block?.assetId !== target.assetId) return null;
    return { unitId: target.unitId, blockId: block.blockId, assetId: target.assetId,
      document: record.unit.document, numbering: record.unit.numbering.official,
      kind: found[0], assetNumber: found[1]!.officialNumber };
  }
  return { unitId: target.unitId, ...(block ? { blockId: block.blockId } : {}),
    document: record.unit.document, numbering: record.unit.numbering.official, kind: block ? "block" : "unit" };
}

function normalizeVisibleAnswer(value: string): string {
  return value
    .replace(/Evidence Package/giu, "fonti normative")
    .replace(/selected evidence/giu, "fonti selezionate")
    .replace(/claim coverage/giu, "copertura delle fonti")
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
