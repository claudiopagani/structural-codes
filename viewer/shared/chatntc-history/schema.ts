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
      if (!keys(message, ["id", "role", "turnId", "content", "timestamp", "answer", "provenance", "evidenceWarnings", "evidenceReduced"])
        || previous?.role !== "user" || previous.id !== message.turnId || previous.status !== "complete"
        || !object(message.answer) || "answer" in message.answer || !isChatNTCResponse({ ...message.answer, answer: message.content })) return invalid();
      // The core response guard rejects unknown fields in claims and citations as well.
      const p = message.provenance;
      if (!object(p) || !keys(p, ["provider", "model", "structuralCodesVersion", "corpusFingerprint", "artifactFingerprint", "policyVersion", "outcome", "validation"])
        || !nullableText(p.provider) || !nullableText(p.model) || !nullableText(p.structuralCodesVersion)
        || !text(p.corpusFingerprint) || !text(p.artifactFingerprint) || !text(p.policyVersion)
        || !["generated", "abstained"].includes(String(p.outcome)) || !object(p.validation)
        || !keys(p.validation, ["valid", "scope"]) || p.validation.valid !== true || p.validation.scope !== "integrity-provenance-claim-coverage"
        || typeof message.evidenceReduced !== "boolean" || !Array.isArray(message.evidenceWarnings)
        || !message.evidenceWarnings.every((w) => object(w) && keys(w, ["code", "unitId"]) && text(w.code) && optionalText(w.unitId))) return invalid();
      const answer = { ...message.answer, answer: message.content };
      if (!isChatNTCResponse(answer)) return invalid();
      const cited = new Set(answer.claims.flatMap((claim) => claim.citations.map((citation) => citation.evidenceId)));
      if (cited.size !== answer.usedEvidenceIds.length || answer.usedEvidenceIds.some((id) => !cited.has(id))) return invalid();
    } else return invalid();
  }
  return structuredClone(value) as unknown as ChatConversation;
}

/** Fixture/legacy v1 had the same messages and timestamps but no optimistic revision. */
export function migrateConversationV1(value: unknown): ChatConversation {
  if (!object(value) || value.schemaVersion !== 1 || "revision" in value) throw new ChatHistoryError("INVALID_DATA");
  return readConversation({ ...value, schemaVersion: 2, revision: 1 });
}
