import type {
  AssetBundle, CorpusBlock, CorpusManifest, CorpusUnit, DocumentId,
  FigureAsset, FormulaAsset, TableAsset, SearchMatchKind,
} from "../corpusData.js";

export type ChatNTCClassification =
  | "direct-reference" | "combined-reference" | "interpretation"
  | "no-direct-reference" | "external-source";
export type ChatNTCAnswerStatus = "answered" | "partial" | "abstained";

export interface ChatNTCCorpusIdentity {
  sourceOfTruth: "structural-codes";
  version: string;
  schemaVersion: string;
  assetSchemaVersion: string;
  fingerprint: string;
  artifactFingerprint: string;
  status: string;
  disclaimer: string;
  documents: Record<DocumentId, Pick<CorpusManifest["documents"][DocumentId],
    "shortLabel" | "sourceId" | "sourceUrl" | "sourceSha256" | "publicationUrl">>;
}

export interface ChatNTCTarget {
  unitId: string;
  blockId?: string;
  assetId?: string;
}

export interface ChatNTCRetrievalContext extends ChatNTCTarget {
  documentId: DocumentId;
  numbering: string;
}

export interface ChatNTCHit extends ChatNTCTarget {
  score: number;
  match: "exact-reference" | SearchMatchKind;
}

export interface ChatNTCRelation extends ChatNTCTarget {
  kind: "parent" | "child" | "explicit-relation" | "cross-reference";
  fromUnitId: string;
  sourceBlockId?: string;
  direction?: "outgoing" | "incoming";
  relationId?: string;
  relationType?: string;
  basis?: string;
  reviewStatus?: string;
  evidenceBlockIds?: string[];
}

/** A repository instance represents one immutable corpus snapshot. */
export interface ChatNTCRepository {
  identity(): Promise<ChatNTCCorpusIdentity>;
  /** null = not exact syntax; [] = recognized reference, absent from this snapshot. */
  resolveExact(query: string, document?: DocumentId): Promise<ChatNTCHit[] | null>;
  search(query: string, limit: number, document?: DocumentId): Promise<ChatNTCHit[]>;
  getUnit(unitId: string): Promise<ChatNTCUnitRecord | null>;
  related(unitId: string): Promise<ChatNTCRelation[]>;
}

export interface ChatNTCUnitRecord {
  unit: CorpusUnit;
  assets: AssetBundle;
  provenance: { chunkPath: string; chunkFingerprint: string };
}

export type ChatNTCEvidenceAsset =
  | { kind: "formula"; data: FormulaAsset }
  | { kind: "table"; data: TableAsset }
  | { kind: "figure"; data: FigureAsset; contentAvailability: "metadata-only" };

export interface ChatNTCEvidenceBlock {
  /** Canonical block ID, stable across retrievals of the same snapshot. */
  evidenceId: string;
  blockId: string;
  kind: string;
  origin: string;
  listMarker?: CorpusBlock["listMarker"];
  listLevel?: number;
  indentLevel?: number;
  text?: Pick<NonNullable<CorpusBlock["text"]>, "normalized" | "inline">;
  assetId?: string;
  asset?: ChatNTCEvidenceAsset;
  provenance?: Pick<NonNullable<CorpusBlock["evidence"]>,
    "sourceId" | "pdfPage" | "printedPage" | "region" | "normalizedSha256">;
}

export interface ChatNTCEvidenceHierarchyEntry {
  numbering: string;
  title: string;
}

export interface ChatNTCEvidenceUnit {
  /** Unit citations refer only to the selected blocks, never omitted content. */
  evidenceId: string;
  unitId: string;
  document: DocumentId;
  numbering: string;
  title: string;
  /** Canonical ancestors from the document root through the immediate parent. */
  hierarchy: ChatNTCEvidenceHierarchyEntry[];
  editorial: CorpusUnit["review"];
  validity: CorpusUnit["validity"];
  provenance: ChatNTCUnitRecord["provenance"];
  reasons: Array<{ kind: "exact-reference" | "full-text" | "viewer-context"; score: number } | ChatNTCRelation>;
  blocks: ChatNTCEvidenceBlock[];
  selection: { complete: boolean; omittedBlocks: number };
}

export interface ChatNTCRetrievalOptions {
  /** Additional candidate, verified against the repository. Does not filter search. */
  context?: ChatNTCRetrievalContext;
  document?: DocumentId;
  maxPrimaryUnits?: number;
  maxRelatedUnits?: number;
  maxChildrenPerUnit?: number;
  /** UTF-16 selection length, including established unit metadata and assets but excluding additive hierarchy scope. Not tokens. */
  maxEvidenceCharacters?: number;
  maxUnitCharacters?: number;
  includeParents?: boolean;
  includeCrossReferences?: boolean;
  includeExplicitRelations?: boolean;
  includeProposedRelations?: boolean;
  /** Previous USER messages only. They guide ranking but never become normative evidence. */
  queryContext?: readonly string[];
  /** Canonical textual references requested by the validator for one bounded expansion. */
  requiredReferences?: readonly string[];
}

export interface ChatNTCWarning {
  code: "no-evidence" | "evidence-reduced" | "figure-metadata-only" | "unresolved-reference";
  unitId?: string;
}

export interface ChatNTCEvidencePackage {
  formatVersion: 1;
  packageId: string;
  policyVersion: "chatntc-epistemic-v2";
  question: string;
  corpus: ChatNTCCorpusIdentity;
  primaryUnits: ChatNTCEvidenceUnit[];
  relatedUnits: ChatNTCEvidenceUnit[];
  retrieval: {
    options: Required<Omit<ChatNTCRetrievalOptions, "document" | "context" | "queryContext" | "requiredReferences">>
      & Pick<ChatNTCRetrievalOptions, "document" | "context">;
    /** Deterministic retrieval query. Conversation text here is context, never evidence. */
    query: string;
    evidenceCharacters: number;
    reduced: boolean;
  };
  warnings: ChatNTCWarning[];
}

export interface ChatNTCCitation extends ChatNTCTarget {
  evidenceId: string;
  document: DocumentId;
  /** Official unit numbering; an asset's number is a separate field. */
  numbering: string;
  assetNumber?: string | null;
}

/**
 * Canonical post-hoc reference. Unlike a legacy citation, it is independent from the
 * Evidence Package selected before generation and therefore never invents an evidenceId.
 */
export interface ChatNTCVerifiedReference extends ChatNTCTarget {
  document: DocumentId;
  /** Official unit numbering; an asset's number is a separate field. */
  numbering: string;
  kind: "unit" | "block" | "formula" | "table" | "figure";
  assetNumber?: string | null;
}

export type ChatNTCReference = ChatNTCCitation | ChatNTCVerifiedReference;
export type ChatNTCReferenceWarning = "some-references-omitted" | "no-references-verified";

export interface ChatNTCClaim {
  id: string;
  text: string;
  classification: ChatNTCClassification;
  citations: ChatNTCCitation[];
}

/** Minimal provider wire output. References are textual; canonical metadata is server-owned. */
export interface ChatNTCProviderOutput {
  formatVersion: 2;
  evidencePackageId: string;
  answerMarkdown: string;
  references: string[];
  /**
   * Conservative, response-level description of the epistemic basis of the central conclusion.
   * It is not proof that references semantically entail the answer; the provider must express
   * mixed normative, interpretative and engineering content clearly in answerMarkdown.
   * A claim array is intentionally not part of the current provider contract.
   */
  classification: ChatNTCClassification;
  status: ChatNTCAnswerStatus;
  needsMoreEvidence: boolean;
  externalResearchSuggested: boolean;
}

/** Historical public response retained for saved v1/v2 conversations. */
export interface ChatNTCLegacyResponseBody {
  evidencePackageId: string;
  answer: string;
  classification: ChatNTCClassification;
  claims: ChatNTCClaim[];
  usedEvidenceIds: string[];
  warnings: string[];
  needsMoreEvidence: boolean;
  externalResearchSuggested: boolean;
}

/** v1 remains readable for saved history; providers generate the semantically explicit v2. */
export type ChatNTCLegacyResponse = ChatNTCLegacyResponseBody & (
  | { formatVersion: 1; status?: never }
  | { formatVersion: 2; status: ChatNTCAnswerStatus }
);

/** Rich response produced by the server and consumed by current UI clients. */
export interface CanonicalChatNTCResponse {
  formatVersion: 3;
  evidencePackageId: string;
  answerMarkdown: string;
  classification: ChatNTCClassification;
  status: ChatNTCAnswerStatus;
  verifiedReferences: ChatNTCVerifiedReference[];
  referenceWarning?: ChatNTCReferenceWarning;
  warnings: string[];
  needsMoreEvidence: boolean;
  externalResearchSuggested: boolean;
}

export type ChatNTCResponse = ChatNTCLegacyResponse | CanonicalChatNTCResponse;
export type ChatNTCProcessingStage = "GENERATED" | "NORMALIZED" | "REFERENCES_RESOLVED" | "EXPANDED" | "REPAIRED"
  | "PARTIALLY_SANITIZED" | "DEGRADED" | "HARD_REJECTED";

export interface ChatNTCValidationIssue {
  code: string; path: string; message: string;
  category: "integrity" | "bookkeeping" | "discovery";
  reference?: string;
  targets?: ChatNTCTarget[];
}
export interface ChatNTCValidationResult { valid: boolean; issues: ChatNTCValidationIssue[]; }

export interface ChatNTCCanonicalizationResult {
  response: CanonicalChatNTCResponse;
  issues: ChatNTCValidationIssue[];
  normalized: boolean;
}
