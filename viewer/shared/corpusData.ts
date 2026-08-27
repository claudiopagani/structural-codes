export type DocumentId = "ntc2018" | "circ2019";
export type ViewerMode = "ntc" | "circ" | "combined";

export interface Evidence {
  sourceId: string;
  pdfPage: number;
  printedPage: string | null;
  region: { x: number; y: number; width: number; height: number };
  transformations?: Array<{ operation: string; note: string }>;
  rawSha256: string;
  normalizedSha256: string;
}

export interface CorpusBlock {
  blockId: string;
  kind: string;
  origin: string;
  text?: {
    raw: string;
    normalized: string;
    normalizationVersion: string;
    inline?: Array<
      | { kind: "text"; value: string }
      | { kind: "em"; value: string }
      | { kind: "strong"; value: string }
      | { kind: "math"; value: string; latex: string }
    >;
  };
  assetId?: string;
  evidence?: Evidence;
}

export interface FormulaAsset { id: string; officialNumber: string | null; pdfPage: number; latex: string; }
export interface TableCell { text: string; latex?: string; colSpan?: number; rowSpan?: number; }
export interface TableAsset {
  id: string;
  officialNumber: string | null;
  pdfPage: number;
  caption: string | null;
  headers: TableCell[][];
  rows: TableCell[][];
  notes: string[];
}
export interface FigureAsset {
  id: string;
  officialNumber: string;
  pdfPage: number;
  caption: string;
  alt: string;
  imagePath: string;
  region?: { width: number; height: number };
}
export interface AssetBundle {
  formulas: Record<string, FormulaAsset>;
  tables: Record<string, TableAsset>;
  figures: Record<string, FigureAsset>;
}
export interface OpenIssue { issueId: string; type: string; severity: "blocking" | "warning" | "info"; note: string; }
export interface Relation { relationId: string; type: string; targetUnitId: string; basis: string; rationale: string; review: { status: string }; }
export interface CorpusUnit {
  id: string;
  document: DocumentId;
  kind: string;
  numbering: { official: string; sortKey: string };
  title: string;
  hierarchy: { parentId: string | null; ancestorIds: string[]; position: number };
  validity: { from: string | null; to: string | null; status: string; asOf: string };
  blocks: CorpusBlock[];
  relations: Relation[];
  workflow: { status: string; openIssues: OpenIssue[] };
}
export interface UnitSummary {
  id: string;
  document: DocumentId;
  kind: string;
  numbering: { official: string; sortKey: string };
  title: string;
  hierarchy: CorpusUnit["hierarchy"];
  validity: CorpusUnit["validity"];
  workflowStatus: string;
  openIssueCount: number;
  blockingIssueCount: number;
  chunkPath: string;
}
export interface DocumentMetadata {
  shortLabel: string;
  label: string;
  indexPath: string;
  units: number;
  blocks: number;
  sourceId: string;
  sourceUrl: string;
  publicationUrl: string;
  localSourcePath: string;
  sourceSha256: string;
  pages: { from: number; to: number };
}
export interface CorpusManifest {
  formatVersion: 2;
  generatedAt: string;
  structuralCodesVersion: string;
  schemaVersion: string;
  assetSchemaVersion: string;
  status: string;
  disclaimer: string;
  corpusFingerprintSha256: string;
  generatedArtifactFingerprintSha256: string;
  stats: {
    units: number;
    blocks: number;
    explicitRelations: number;
    proposedRelations: number;
    suggestedRelationDiagnostics: number;
    reviewedUnits: number;
    assetUnits: number;
    formulas: number;
    tables: number;
    figures: number;
    chunks: number;
  };
  documents: Record<DocumentId, DocumentMetadata>;
  relationsPath: string;
  relationDiagnosticsPath: string;
  searchIndexPath: string;
  chunks: Array<{
    path: string;
    document: DocumentId;
    key: string;
    units: number;
    bytes: number;
    sha256: string;
    contentFingerprintSha256: string;
  }>;
}
export interface DocumentIndex { formatVersion: 2; structuralCodesVersion: string; document: DocumentId; units: UnitSummary[]; }
export interface CorpusChunk {
  formatVersion: 2;
  structuralCodesVersion: string;
  schemaVersion: string;
  document: DocumentId;
  key: string;
  contentFingerprintSha256: string;
  units: CorpusUnit[];
  assets: AssetBundle;
}
export interface RelationEdge extends Relation {
  sourceUnitId: string;
  sourceDocument: DocumentId;
  sourceChunkPath: string;
  targetChunkPath: string | null;
}
export interface RelationsIndex { formatVersion: 2; sourceOfTruth: "explicit-corpus-relations"; inferredRelationsIncluded: false; relations: RelationEdge[]; }
export interface SearchIndex {
  formatVersion: 2;
  units: Array<{ id: string; document: DocumentId; numbering: string; title: string; chunkPath: string; text: string }>;
}

const jsonCache = new Map<string, Promise<unknown>>();

function basePath(dataBaseUrl: string) {
  return dataBaseUrl.replace(/\/+$/u, "");
}

export function resolveDataPath(path: string, dataBaseUrl = "/data/codes") {
  if (dataBaseUrl === "/data/codes" || dataBaseUrl === "") return path;
  return `${basePath(dataBaseUrl)}/${path.replace(/^\/data\/codes\/?/u, "")}`;
}

async function fetchJson<T>(path: string): Promise<T> {
  let pending = jsonCache.get(path);
  if (!pending) {
    pending = fetch(path).then(async (response) => {
      if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
      return response.json();
    });
    jsonCache.set(path, pending);
  }
  return pending as Promise<T>;
}

export function documentForMode(mode: ViewerMode): DocumentId {
  return mode === "circ" ? "circ2019" : "ntc2018";
}
export function loadManifest(dataBaseUrl = "/data/codes") {
  return fetchJson<CorpusManifest>(resolveDataPath("/data/codes/manifest.json", dataBaseUrl));
}
export function loadDocumentIndex(manifest: CorpusManifest, document: DocumentId, dataBaseUrl = "/data/codes") {
  return fetchJson<DocumentIndex>(resolveDataPath(manifest.documents[document].indexPath, dataBaseUrl));
}
export function loadChunk(path: string, dataBaseUrl = "/data/codes") {
  return fetchJson<CorpusChunk>(resolveDataPath(path, dataBaseUrl));
}
export function loadRelations(manifest: CorpusManifest, dataBaseUrl = "/data/codes") {
  return fetchJson<RelationsIndex>(resolveDataPath(manifest.relationsPath, dataBaseUrl));
}
export function loadSearchIndex(manifest: CorpusManifest, dataBaseUrl = "/data/codes") {
  return fetchJson<SearchIndex>(resolveDataPath(manifest.searchIndexPath, dataBaseUrl));
}
