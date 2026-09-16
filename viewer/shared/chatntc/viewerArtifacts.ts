import {
  createDocumentLookup, loadChunk, loadCrossReferenceIndex, loadDocumentIndex,
  loadManifest, loadRelations, loadSearchIndex, parseNormativeReference,
  type CorpusChunk, type CorpusManifest, type CrossReferenceIndex,
  type DocumentId, type DocumentIndex, type RelationsIndex, type SearchIndex,
} from "../corpusData.js";
import { createSearchEngine } from "../searchEngine.js";
import { createCrossReferenceLookup, findCrossReferences, resolveCrossReference } from "../crossReferences.js";
import type { ChatNTCCorpusIdentity, ChatNTCHit, ChatNTCRelation, ChatNTCRepository } from "./types.js";

/** Injectable artifact access. Tests can supply files or memory without an HTTP server. */
export interface ChatNTCArtifactLoader {
  manifest(): Promise<CorpusManifest>;
  documentIndex(manifest: CorpusManifest, document: DocumentId): Promise<DocumentIndex>;
  chunk(path: string): Promise<CorpusChunk>;
  searchIndex(manifest: CorpusManifest): Promise<SearchIndex>;
  crossReferenceIndex(manifest: CorpusManifest): Promise<CrossReferenceIndex>;
  relations(manifest: CorpusManifest): Promise<RelationsIndex>;
}

function lazy<T>(read: () => Promise<T>) {
  let pending: Promise<T> | undefined;
  return () => {
    if (!pending) pending = read().catch((error: unknown) => { pending = undefined; throw error; });
    return pending;
  };
}

export function createArtifactRepository(loader: ChatNTCArtifactLoader): ChatNTCRepository {
  const manifest = lazy(async () => {
    const value = await loader.manifest();
    if (value.formatVersion !== 2 || !value.corpusFingerprintSha256 || !value.generatedArtifactFingerprintSha256) {
      throw new Error("ChatNTC: manifest senza formato/fingerprint supportati.");
    }
    return value;
  });
  const indexes = (document: DocumentId) => lazy(async () => {
    const value = await loader.documentIndex(await manifest(), document);
    if (value.formatVersion !== 2 || value.document !== document) throw new Error("ChatNTC: indice documento incoerente.");
    return { index: value, lookup: createDocumentLookup(value) };
  });
  const documents = { ntc2018: indexes("ntc2018"), circ2019: indexes("circ2019") };
  const search = lazy(async () => createSearchEngine(await loader.searchIndex(await manifest())));
  const crossReferences = lazy(async () => {
    const value = await loader.crossReferenceIndex(await manifest());
    if (value.formatVersion !== 1) throw new Error("ChatNTC: indice rimandi non supportato.");
    return createCrossReferenceLookup(value);
  });
  const relations = lazy(async () => {
    const value = await loader.relations(await manifest());
    if (value.formatVersion !== 2 || value.sourceOfTruth !== "explicit-corpus-relations" || value.inferredRelationsIncluded !== false) {
      throw new Error("ChatNTC: le relazioni devono provenire dal corpus esplicito.");
    }
    return value.relations;
  });
  async function summary(unitId: string) {
    for (const document of ["ntc2018", "circ2019"] as const) {
      const found = (await documents[document]()).lookup.unitById.get(unitId);
      if (found) return found;
    }
    return null;
  }

  const repository: ChatNTCRepository = {
    async identity() {
      const value = await manifest();
      const documentSources = {} as ChatNTCCorpusIdentity["documents"];
      for (const document of ["ntc2018", "circ2019"] as const) {
        const { shortLabel, sourceId, sourceUrl, sourceSha256, publicationUrl } = value.documents[document];
        documentSources[document] = { shortLabel, sourceId, sourceUrl, sourceSha256, publicationUrl };
      }
      return {
        sourceOfTruth: "structural-codes", version: value.structuralCodesVersion,
        schemaVersion: value.schemaVersion, assetSchemaVersion: value.assetSchemaVersion,
        fingerprint: value.corpusFingerprintSha256, artifactFingerprint: value.generatedArtifactFingerprintSha256,
        status: value.status, disclaimer: value.disclaimer, documents: documentSources,
      };
    },
    async resolveExact(query, document) {
      const reference = parseNormativeReference(query);
      if (reference) {
        if (document && reference.documentHint && document !== reference.documentHint) return [];
        const selected = reference.documentHint ?? document ?? "ntc2018";
        const found = (await documents[selected]()).lookup.unitByNumbering.get(reference.numbering);
        return found ? [{ unitId: found.id, score: 4_000_000, match: "exact-reference" }] : [];
      }
      const trimmed = query.trim();
      const references = findCrossReferences(trimmed);
      const asset = references.find((item) => item.kind !== "unit" && item.start === 0 && item.end === trimmed.length);
      if (!asset) return null;
      if (document && asset.documentHint && document !== asset.documentHint) return [];
      const found = resolveCrossReference(await crossReferences(), asset, document ?? "ntc2018");
      if (!found?.asset || (document && found.unit.document !== document)
        || (asset.documentHint && found.unit.document !== asset.documentHint)) return [];
      return [{ unitId: found.unit.id, blockId: found.asset.blockId, assetId: found.asset.id, score: 4_000_000, match: "exact-reference" }];
    },
    async search(query, limit, document) {
      const engine = await search();
      const hits = engine.search({ query, limit, mode: document === "ntc2018" ? "ntc" : document === "circ2019" ? "circ" : "combined" });
      return hits.map((hit) => ({ unitId: hit.id, score: hit.score, match: hit.matchKind })) as ChatNTCHit[];
    },
    async getUnit(unitId) {
      const found = await summary(unitId);
      if (!found) return null;
      const chunk = await loader.chunk(found.chunkPath);
      const expected = (await manifest()).chunks.find((entry) => entry.path === found.chunkPath);
      if (chunk.formatVersion !== 2 || chunk.document !== found.document
        || !expected || chunk.contentFingerprintSha256 !== expected.contentFingerprintSha256) {
        throw new Error(`ChatNTC: chunk non coerente con il manifest: ${found.chunkPath}`);
      }
      const matchingUnits = chunk.units.filter((entry) => entry.id === unitId);
      const unit = matchingUnits[0];
      if (matchingUnits.length !== 1 || unit.document !== found.document || unit.numbering.official !== found.numbering.official) {
        throw new Error(`ChatNTC: unità non coerente con l'indice: ${unitId}`);
      }
      return { unit, assets: chunk.assets, provenance: { chunkPath: found.chunkPath, chunkFingerprint: chunk.contentFingerprintSha256 } };
    },
    async related(unitId) {
      const record = await repository.getUnit(unitId);
      if (!record) return [];
      const { unit } = record;
      const [index, edges, lookup] = await Promise.all([documents[unit.document](), relations(), crossReferences()]);
      const result: ChatNTCRelation[] = [];
      if (unit.hierarchy.parentId) result.push({ kind: "parent", fromUnitId: unit.id, unitId: unit.hierarchy.parentId });
      for (const child of index.index.units.filter((entry) => entry.hierarchy.parentId === unit.id)) {
        result.push({ kind: "child", fromUnitId: unit.id, unitId: child.id });
      }
      for (const edge of edges) {
        if (edge.review.status === "rejected") continue;
        if (edge.sourceUnitId !== unit.id && edge.targetUnitId !== unit.id) continue;
        result.push({
          kind: "explicit-relation", fromUnitId: unit.id,
          unitId: edge.sourceUnitId === unit.id ? edge.targetUnitId : edge.sourceUnitId,
          direction: edge.sourceUnitId === unit.id ? "outgoing" : "incoming",
          relationId: edge.relationId, relationType: edge.type, basis: edge.basis,
          reviewStatus: edge.review.status, evidenceBlockIds: edge.evidenceBlockIds,
        });
      }
      // Reuse the viewer's recognizer/resolver, including asset references omitted from backlinks.
      for (const block of unit.blocks) {
        if (!block.text || block.blockId === unit.titleBlockId) continue;
        for (const reference of findCrossReferences(block.text.normalized)) {
          const found = resolveCrossReference(lookup, reference, unit.document);
          if (!found || (reference.documentHint && found.unit.document !== reference.documentHint)) continue;
          if (found.unit.id === unit.id) continue; // Its linked assets are already collected with the unit.
          result.push({ kind: "cross-reference", fromUnitId: unit.id, sourceBlockId: block.blockId,
            direction: "outgoing", unitId: found.unit.id,
            ...(found.asset ? { blockId: found.asset.blockId, assetId: found.asset.id } : {}) });
        }
      }
      for (const backlink of lookup.backlinksByTarget.get(`unit:${unit.id}`) ?? []) {
        result.push({ kind: "cross-reference", fromUnitId: unit.id, direction: "incoming",
          unitId: backlink.sourceUnitId, blockId: backlink.sourceBlockId, sourceBlockId: backlink.sourceBlockId });
      }
      return result;
    },
  };
  return repository;
}

/** Thin default transport adapter; all fetching and JSON caching stay in corpusData. */
export function createViewerArtifactRepository(dataBaseUrl = "/data/codes"): ChatNTCRepository {
  return createArtifactRepository({
    manifest: () => loadManifest(dataBaseUrl),
    documentIndex: (manifest, document) => loadDocumentIndex(manifest, document, dataBaseUrl),
    chunk: (path) => loadChunk(path, dataBaseUrl),
    searchIndex: (manifest) => loadSearchIndex(manifest, dataBaseUrl),
    crossReferenceIndex: (manifest) => loadCrossReferenceIndex(manifest, dataBaseUrl),
    relations: (manifest) => loadRelations(manifest, dataBaseUrl),
  });
}
