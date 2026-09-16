export const CHATNTC_EPISTEMIC_POLICY = Object.freeze({
  version: "chatntc-epistemic-v1" as const,
  normativeSource: "structural-codes" as const,
  officialPdfIsEditorialAuthority: true,
  modelMemoryIsNormativeSource: false,
  preserveDocumentDistinction: true,
  interpretationIsPrescription: false,
  abstentionOnInsufficientEvidence: true,
  inventedCitationsAllowed: false,
  citationScope: "selected-evidence-only" as const,
  validationScope: "integrity-provenance-claim-coverage" as const,
  semanticEntailmentVerified: false,
  externalSourcesEnabled: false,
});

export const CHATNTC_DEFAULT_RETRIEVAL = Object.freeze({
  maxPrimaryUnits: 5,
  maxRelatedUnits: 5,
  maxChildrenPerUnit: 2,
  maxEvidenceCharacters: 48_000,
  maxUnitCharacters: 9_000,
  includeParents: true,
  includeCrossReferences: true,
  includeExplicitRelations: true,
  includeProposedRelations: true,
});
