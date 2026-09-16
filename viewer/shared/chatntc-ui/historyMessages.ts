import type { ChatHistoryMessage } from "../chatntc-history/types.js";
import type { ChatNTCTurn } from "./ChatNTCPanel.js";

/** Explicit projection: transport extensions/configuration never flow into storage by spreading result. */
export function historyMessages(turns: ChatNTCTurn[]): ChatHistoryMessage[] {
  return turns.flatMap((turn): ChatHistoryMessage[] => {
    const user: ChatHistoryMessage = {
      id: turn.id, role: "user", content: turn.question, timestamp: turn.timestamp, status: turn.status,
      ...(turn.context ? { context: { documentId: turn.context.documentId, unitId: turn.context.unitId, numbering: turn.context.numbering,
        ...(turn.context.blockId ? { blockId: turn.context.blockId } : {}), ...(turn.context.assetId ? { assetId: turn.context.assetId } : {}) } } : {}),
      ...(turn.error ? { error: turn.error } : {}),
    };
    if (!turn.result) return [user];
    const { response, evidence, generation } = turn.result;
    return [user, {
      id: `${turn.id}:answer`, turnId: turn.id, role: "assistant", content: response.answer, timestamp: turn.answeredAt ?? turn.timestamp,
      answer: { formatVersion: response.formatVersion, evidencePackageId: response.evidencePackageId, classification: response.classification,
        claims: response.claims.map((claim) => ({ id: claim.id, text: claim.text, classification: claim.classification,
          citations: claim.citations.map((c) => ({ evidenceId: c.evidenceId, document: c.document, unitId: c.unitId, numbering: c.numbering,
            ...(c.blockId ? { blockId: c.blockId } : {}), ...(c.assetId ? { assetId: c.assetId } : {}), ...(c.assetNumber !== undefined ? { assetNumber: c.assetNumber } : {}) })) })),
        usedEvidenceIds: [...response.usedEvidenceIds], warnings: [...response.warnings], needsMoreEvidence: response.needsMoreEvidence,
        externalResearchSuggested: response.externalResearchSuggested },
      provenance: { provider: generation.provider, model: generation.model ?? null, structuralCodesVersion: evidence.structuralCodesVersion ?? null,
        corpusFingerprint: evidence.corpusFingerprint, artifactFingerprint: evidence.artifactFingerprint, policyVersion: evidence.policyVersion,
        outcome: generation.outcome, validation: { valid: turn.result.validation.valid, scope: turn.result.validation.scope } },
      evidenceReduced: evidence.reduced, evidenceWarnings: evidence.warnings.map((w) => ({ code: w.code, ...(w.unitId ? { unitId: w.unitId } : {}) })),
    }];
  });
}

export function turnsFromHistory(messages: ChatHistoryMessage[]): ChatNTCTurn[] {
  return messages.flatMap((message, index): ChatNTCTurn[] => {
    if (message.role !== "user") return [];
    const assistant = messages[index + 1];
    const turn: ChatNTCTurn = { id: message.id, question: message.content, timestamp: message.timestamp, context: message.context,
      // Reload never restarts an interrupted request or represents it as still running.
      status: message.status === "pending" ? "cancelled" : message.status, error: message.error };
    if (assistant?.role === "assistant") {
      const p = assistant.provenance;
      const citations = new Map(assistant.answer.claims.flatMap((claim) => claim.citations).map((c) => [c.evidenceId, c]));
      turn.answeredAt = assistant.timestamp;
      turn.result = { ok: true, response: { ...assistant.answer, answer: assistant.content },
        citations: assistant.answer.usedEvidenceIds.map((id) => citations.get(id)!),
        evidence: { packageId: assistant.answer.evidencePackageId, corpusFingerprint: p.corpusFingerprint, artifactFingerprint: p.artifactFingerprint,
          ...(p.structuralCodesVersion ? { structuralCodesVersion: p.structuralCodesVersion } : {}), policyVersion: p.policyVersion, reduced: assistant.evidenceReduced, warnings: assistant.evidenceWarnings },
        generation: { provider: p.provider, model: p.model, outcome: p.outcome }, validation: p.validation };
    }
    return [turn];
  });
}
