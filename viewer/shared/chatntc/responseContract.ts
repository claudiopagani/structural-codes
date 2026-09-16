import type { ChatNTCCitation, ChatNTCProviderOutput, ChatNTCResponse } from "./types.js";

const classifications = ["direct-reference", "combined-reference", "interpretation", "no-direct-reference", "external-source"] as const;
const nonEmptyString = { type: "string", pattern: "\\S" } as const;

/** Minimal provider wire schema. Canonical citation metadata is reconstructed server-side. */
export const CHATNTC_RESPONSE_JSON_SCHEMA = {
  $schema: "http://json-schema.org/draft-07/schema#",
  title: "ChatNTCProviderOutput v1",
  type: "object", additionalProperties: false,
  required: ["formatVersion", "evidencePackageId", "answer", "classification", "status", "claims", "warnings", "needsMoreEvidence", "externalResearchSuggested"],
  properties: {
    formatVersion: { const: 1 }, evidencePackageId: nonEmptyString, answer: nonEmptyString,
    classification: { enum: classifications },
    status: { enum: ["answered", "partial", "abstained"] },
    claims: { type: "array", items: {
      type: "object", additionalProperties: false,
      required: ["id", "text", "classification", "evidenceIds"],
      properties: {
        id: nonEmptyString, text: nonEmptyString, classification: { enum: classifications },
        evidenceIds: { type: "array", items: nonEmptyString },
      },
    } },
    warnings: { type: "array", items: nonEmptyString },
    needsMoreEvidence: { type: "boolean" }, externalResearchSuggested: { type: "boolean" },
  },
} as const;

const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);
const text = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;
const strings = (value: unknown): value is string[] => Array.isArray(value) && value.every(text);
const keys = (value: Record<string, unknown>, allowed: string[]) => Object.keys(value).every((key) => allowed.includes(key));
const classification = (value: unknown) => typeof value === "string" && (classifications as readonly string[]).includes(value);

export function isChatNTCProviderOutput(value: unknown): value is ChatNTCProviderOutput {
  return object(value) && keys(value, ["formatVersion", "evidencePackageId", "answer", "classification", "status", "claims", "warnings", "needsMoreEvidence", "externalResearchSuggested"])
    && value.formatVersion === 1 && text(value.evidencePackageId) && text(value.answer)
    && classification(value.classification) && ["answered", "partial", "abstained"].includes(String(value.status))
    && strings(value.warnings) && typeof value.needsMoreEvidence === "boolean" && typeof value.externalResearchSuggested === "boolean"
    && Array.isArray(value.claims) && value.claims.every((claim) => object(claim)
      && keys(claim, ["id", "text", "classification", "evidenceIds"]) && text(claim.id) && text(claim.text)
      && classification(claim.classification) && strings(claim.evidenceIds));
}

function isCitation(value: unknown): value is ChatNTCCitation {
  return object(value) && keys(value, ["evidenceId", "unitId", "document", "numbering", "blockId", "assetId", "assetNumber"])
    && text(value.evidenceId) && text(value.unitId) && text(value.numbering)
    && (value.document === "ntc2018" || value.document === "circ2019")
    && (value.blockId === undefined || text(value.blockId))
    && (value.assetId === undefined || text(value.assetId))
    && (value.assetNumber === undefined || value.assetNumber === null || text(value.assetNumber));
}

/** Same structural check used in STEP 1, now reusable by adapters without running retrieval. */
export function isChatNTCResponse(value: unknown): value is ChatNTCResponse {
  return object(value) && keys(value, ["formatVersion", "evidencePackageId", "answer", "classification", "status", "claims", "usedEvidenceIds", "warnings", "needsMoreEvidence", "externalResearchSuggested"])
    && (value.formatVersion === 1 ? value.status === undefined
      : value.formatVersion === 2 && ["answered", "partial", "abstained"].includes(String(value.status)))
    && text(value.evidencePackageId) && text(value.answer)
    && classification(value.classification) && strings(value.usedEvidenceIds) && strings(value.warnings)
    && typeof value.needsMoreEvidence === "boolean" && typeof value.externalResearchSuggested === "boolean"
    && Array.isArray(value.claims) && value.claims.every((claim) => object(claim)
      && keys(claim, ["id", "text", "classification", "citations"]) && text(claim.id) && text(claim.text)
      && classification(claim.classification) && Array.isArray(claim.citations) && claim.citations.every(isCitation));
}
