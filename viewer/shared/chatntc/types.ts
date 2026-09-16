import type {
  AssetBundle, CorpusBlock, CorpusManifest, CorpusUnit, DocumentId,
  FigureAsset, FormulaAsset, TableAsset, SearchMatchKind,
} from "../corpusData.js";

export type ChatNTCClassification =
  | "direct-reference" | "combined-reference" | "interpretation"
  | "no-direct-reference" | "external-source";

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

export interface ChatNTCEvidenceUnit {
  /** Unit citations refer only to the selected blocks, never omitted content. */
  evidenceId: string;
  unitId: string;
  document: DocumentId;
  numbering: string;
  title: string;
  editorial: CorpusUnit["workflow"];
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
  /** UTF-16 length of serialized evidence units, including metadata and assets. Not tokens. */
  maxEvidenceCharacters?: number;
  maxUnitCharacters?: number;
  includeParents?: boolean;
  includeCrossReferences?: boolean;
  includeExplicitRelations?: boolean;
  includeProposedRelations?: boolean;
}

export interface ChatNTCWarning {
  code: "no-evidence" | "evidence-reduced" | "unreviewed-evidence" | "blocking-issues"
    | "proposed-relation" | "figure-metadata-only" | "unresolved-reference";
  unitId?: string;
}

export interface ChatNTCEvidencePackage {
  formatVersion: 1;
  packageId: string;
  policyVersion: "chatntc-epistemic-v1";
  question: string;
  corpus: ChatNTCCorpusIdentity;
  primaryUnits: ChatNTCEvidenceUnit[];
  relatedUnits: ChatNTCEvidenceUnit[];
  retrieval: {
    options: Required<Omit<ChatNTCRetrievalOptions, "document" | "context">> & Pick<ChatNTCRetrievalOptions, "document" | "context">;
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

export interface ChatNTCClaim {
  id: string;
  text: string;
  classification: ChatNTCClassification;
  citations: ChatNTCCitation[];
}

/** Future provider output. No SDK types, URLs supplied by a model, or HTTP envelopes. */
export interface ChatNTCResponse {
  formatVersion: 1;
  evidencePackageId: string;
  answer: string;
  classification: ChatNTCClassification;
  claims: ChatNTCClaim[];
  usedEvidenceIds: string[];
  warnings: string[];
  needsMoreEvidence: boolean;
  externalResearchSuggested: boolean;
}

export interface ChatNTCValidationIssue { code: string; path: string; message: string; }
export interface ChatNTCValidationResult { valid: boolean; issues: ChatNTCValidationIssue[]; }
