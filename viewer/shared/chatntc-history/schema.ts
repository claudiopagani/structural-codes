import { isChatNTCResponse } from "../chatntc/responseContract.js";
import { ChatHistoryError, type ChatConversation } from "./types.js";

const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const text = (value: unknown): value is string => typeof value === "string" && value.length > 0;
const nullableText = (value: unknown) => value === null || text(value);
const date = (value: unknown) => text(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
const keys = (value: Record<string, unknown>, allowed: string[]) => Object.keys(value).every((key) => allowed.includes(key));
const optionalText = (value: unknown) => value === undefined || text(value);

/** Closed fields at every boundary prevent accidentally persisting config, keys or whole evidence. */
export function readConversation(value: unknown): ChatConversation {
  value = adaptLegacyV3References(value);
  function invalid(): never { throw new ChatHistoryError("INVALID_DATA"); }
  if (!object(value) || !keys(value, ["id", "schemaVersion", "revision", "title", "createdAt", "updatedAt", "messages"])
    || value.schemaVersion !== 2 || !text(value.id) || !text(value.title) || value.title.length > 144
    || !Number.isSafeInteger(value.revision) || (value.revision as number) < 1
    || !date(value.createdAt) || !date(value.updatedAt) || String(value.updatedAt) < String(value.createdAt)
    || !Array.isArray(value.messages)) return invalid();
  const ids = new Set<string>();
  for (let i = 0; i < value.messages.length; i++) {
    const message: unknown = value.messages[i];
    if (!object(message) || !text(message.id) || ids.has(message.id) || !text(message.content) || !date(message.timestamp)) return invalid();
    ids.add(message.id);
    if (message.role === "user") {
      if (!keys(message, ["id", "role", "content", "timestamp", "context", "status", "error"])
        || !["pending", "complete", "error", "cancelled"].includes(String(message.status)) || !optionalText(message.error)) return invalid();
      const context = message.context;
      if (context !== undefined && (!object(context) || !keys(context, ["documentId", "unitId", "numbering", "blockId", "assetId"])
        || !["ntc2018", "circ2019"].includes(String(context.documentId)) || !text(context.unitId) || !text(context.numbering)
        || !optionalText(context.blockId) || !optionalText(context.assetId))) return invalid();
      if (message.status === "complete" && value.messages[i + 1]?.role !== "assistant") return invalid();
    } else if (message.role === "assistant") {
      const previous = value.messages[i - 1];
      const hydrated = object(message.answer) && message.answer.formatVersion === 3
        ? { ...message.answer, answerMarkdown: message.content }
        : object(message.answer) ? { ...message.answer, answer: message.content } : null;
      if (!keys(message, ["id", "role", "turnId", "content", "timestamp", "answer", "provenance", "evidenceWarnings", "evidenceReduced"])
        || previous?.role !== "user" || previous.id !== message.turnId || previous.status !== "complete"
        || !object(message.answer) || "answer" in message.answer || "answerMarkdown" in message.answer
        || !hydrated || !isChatNTCResponse(hydrated)) return invalid();
      // The core response guard rejects unknown fields in claims and citations as well.
      const p = message.provenance;
      if (!object(p) || !keys(p, ["provider", "model", "structuralCodesVersion", "corpusFingerprint", "artifactFingerprint", "policyVersion", "outcome", "validation"])
        || !nullableText(p.provider) || !nullableText(p.model) || !nullableText(p.structuralCodesVersion)
        || !text(p.corpusFingerprint) || !text(p.artifactFingerprint) || !text(p.policyVersion)
        || !["generated", "abstained"].includes(String(p.outcome)) || !object(p.validation)
        || !keys(p.validation, ["valid", "scope", "stage"]) || p.validation.valid !== true
        || !["integrity-provenance-claim-coverage", "integrity-provenance-reference-resolution"].includes(String(p.validation.scope))
        || (p.validation.stage !== undefined && !["GENERATED", "NORMALIZED", "REFERENCES_RESOLVED", "EXPANDED", "REPAIRED", "PARTIALLY_SANITIZED", "DEGRADED", "HARD_REJECTED"].includes(String(p.validation.stage)))
        || typeof message.evidenceReduced !== "boolean" || !Array.isArray(message.evidenceWarnings)
        || !message.evidenceWarnings.every((w) => object(w) && keys(w, ["code", "unitId"]) && text(w.code) && optionalText(w.unitId))) return invalid();
      if (!isChatNTCResponse(hydrated)) return invalid();
      if (hydrated.formatVersion !== 3) {
        const cited = new Set(hydrated.claims.flatMap((claim) => claim.citations.map((citation) => citation.evidenceId)));
        if (cited.size !== hydrated.usedEvidenceIds.length || hydrated.usedEvidenceIds.some((id) => !cited.has(id))) return invalid();
      }
    } else return invalid();
  }
  return structuredClone(value) as unknown as ChatConversation;
}

/** Read early v3 snapshots whose verified references still reused the retrieval citation shape. */
function adaptLegacyV3References(value: unknown): unknown {
  if (!object(value) || !Array.isArray(value.messages)) return value;
  const clone = structuredClone(value);
  if (!object(clone) || !Array.isArray(clone.messages)) return value;
  for (const message of clone.messages) {
    if (!object(message) || message.role !== "assistant" || !object(message.answer)
      || message.answer.formatVersion !== 3 || !Array.isArray(message.answer.verifiedReferences)) continue;
    message.answer.verifiedReferences = message.answer.verifiedReferences.map((reference) => {
      if (!object(reference) || typeof reference.evidenceId !== "string" || reference.kind !== undefined) return reference;
      const current = { ...reference };
      delete current.evidenceId;
      const assetId = typeof current.assetId === "string" ? current.assetId : "";
      const kind = assetId.includes(":asset:formula:") ? "formula" : assetId.includes(":asset:table:") ? "table"
        : assetId.includes(":asset:figure:") ? "figure" : typeof current.blockId === "string" ? "block" : "unit";
      return { ...current, kind };
    });
  }
  return clone;
}

/** Fixture/legacy v1 had the same messages and timestamps but no optimistic revision. */
export function migrateConversationV1(value: unknown): ChatConversation {
  if (!object(value) || value.schemaVersion !== 1 || "revision" in value) throw new ChatHistoryError("INVALID_DATA");
  return readConversation({ ...value, schemaVersion: 2, revision: 1 });
}
