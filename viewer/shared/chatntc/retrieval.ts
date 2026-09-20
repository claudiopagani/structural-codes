import { findCrossReferences } from "../crossReferences.js";
import { tokenizeSearchText } from "../searchEngine.js";
import { CHATNTC_DEFAULT_RETRIEVAL, CHATNTC_EPISTEMIC_POLICY } from "./policy.js";
import { evidencePackageId, projectEvidenceBlock, projectEvidenceUnit, stableJson } from "./evidence.js";
import type { ChatNTCEvidencePackage, ChatNTCEvidenceUnit, ChatNTCHit, ChatNTCRelation,
  ChatNTCRepository, ChatNTCRetrievalOptions, ChatNTCUnitRecord, ChatNTCWarning } from "./types.js";

const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
export class ChatNTCContextError extends Error {
  constructor() { super("ChatNTC: contesto non corrispondente al corpus."); this.name = "ChatNTCContextError"; }
}
interface Candidate {
  unitId: string;
  score: number;
  reasons: ChatNTCEvidenceUnit["reasons"];
  targetBlocks: Map<string, string | undefined>;
}

function optionsFor(input: ChatNTCRetrievalOptions): ChatNTCEvidencePackage["retrieval"]["options"] {
  const configured = { ...input };
  delete configured.queryContext;
  delete configured.requiredReferences;
  const options = { ...CHATNTC_DEFAULT_RETRIEVAL, ...configured };
  for (const key of ["maxPrimaryUnits", "maxRelatedUnits", "maxChildrenPerUnit", "maxEvidenceCharacters", "maxUnitCharacters"] as const) {
    const minimum = key === "maxRelatedUnits" || key === "maxChildrenPerUnit" ? 0 : 1;
    const maximum = key.endsWith("Characters") ? 1_000_000 : 50;
    if (!Number.isSafeInteger(options[key]) || options[key] < minimum || options[key] > maximum) throw new Error(`ChatNTC: opzione non valida: ${key}`);
  }
  for (const key of ["includeParents", "includeCrossReferences", "includeExplicitRelations", "includeProposedRelations"] as const) {
    if (typeof options[key] !== "boolean") throw new Error(`ChatNTC: opzione non valida: ${key}`);
  }
  if (options.document && options.document !== "ntc2018" && options.document !== "circ2019") throw new Error("ChatNTC: documento non valido.");
  return options;
}

function selectUnit(record: ChatNTCUnitRecord, candidate: Candidate, question: string, budget: number): ChatNTCEvidenceUnit | null {
  const projected = record.unit.blocks.map((block) => projectEvidenceBlock(block, record));
  const base = { ...projectEvidenceUnit(record), reasons: candidate.reasons };
  const build = (positions: number[]): ChatNTCEvidenceUnit => ({ ...base,
    blocks: [...positions].sort((a, b) => a - b).map((position) => projected[position]),
    selection: { complete: positions.length === projected.length, omittedBlocks: projected.length - positions.length } });
  const full = build(projected.map((_, position) => position));
  if (JSON.stringify(full).length <= budget) return full;
  const terms = new Set<string>(tokenizeSearchText(question));
  const priority = projected.map((block, position) => {
    const tokens = tokenizeSearchText(block.text?.normalized ?? "");
    const termScore = new Set(tokens.filter((term: string) => terms.has(term))).size;
    return { position, score: candidate.targetBlocks.has(block.blockId) ? 1_000_000
      : termScore * 100 + (block.kind === "heading" ? 1 : 0) };
  }).sort((a, b) => b.score - a.score || a.position - b.position);
  const positions: number[] = [];
  for (const { position } of priority) {
    // Whole blocks/assets only. A large table is omitted, never cut into misleading cells.
    if (JSON.stringify(build([...positions, position])).length <= budget) positions.push(position);
  }
  return positions.length ? build(positions) : null;
}

function relationScore(relation: ChatNTCRelation): number {
  if (relation.kind === "explicit-relation") return relation.reviewStatus === "confirmed" ? 900 : 800;
  if (relation.kind === "cross-reference") return relation.direction === "incoming" ? 600 : 700;
  return relation.kind === "parent" ? 500 : 400;
}

export async function retrieveChatNTCEvidence(repository: ChatNTCRepository, question: string, input: ChatNTCRetrievalOptions = {}): Promise<ChatNTCEvidencePackage> {
  if (typeof question !== "string" || !question.trim()) throw new Error("ChatNTC: domanda vuota.");
  if (input.queryContext && (!Array.isArray(input.queryContext) || input.queryContext.some((item) => typeof item !== "string" || !item.trim()))) throw new Error("ChatNTC: contesto query non valido.");
  if (input.requiredReferences && (!Array.isArray(input.requiredReferences) || input.requiredReferences.length > 12
    || input.requiredReferences.some((item) => typeof item !== "string" || !item.trim() || item.length > 120))) throw new Error("ChatNTC: riferimenti richiesti non validi.");
  const options = optionsFor(input);
  const queryContext = [...(input.queryContext ?? [])].slice(-3);
  const retrievalQuery = [question, ...queryContext].join("\n");
  const corpus = await repository.identity();
  const warnings: ChatNTCWarning[] = [];
  let reduced = false;
  const exact = await repository.resolveExact(question, options.document);
  let hits: ChatNTCHit[] = exact ?? [];
  const explicitUnitIds = new Set((exact ?? []).map((hit) => hit.unitId));
  if (exact?.length === 0) warnings.push({ code: "unresolved-reference" });
  if (exact === null) {
    const references = findCrossReferences(question);
    if (references.length > 12) reduced = true;
    for (const reference of references.slice(0, 12)) {
      const resolved = await repository.resolveExact(reference.text, options.document);
      if (resolved?.length === 0) warnings.push({ code: "unresolved-reference" });
      for (const hit of resolved ?? []) explicitUnitIds.add(hit.unitId);
      hits.push(...(resolved ?? []));
    }
    for (const contextualReference of findCrossReferences(queryContext.join("\n")).slice(0, 12)) {
      hits.push(...(await repository.resolveExact(contextualReference.text, options.document) ?? []));
    }
    // Existing full-text ranking is authoritative for text hits; no new search index.
    hits.push(...await repository.search(retrievalQuery, Math.min(50, options.maxPrimaryUnits + 4), options.document));
  }
  for (const reference of input.requiredReferences ?? []) {
    const resolved = await repository.resolveExact(reference, options.document);
    if (resolved?.length === 0) warnings.push({ code: "unresolved-reference" });
    for (const hit of resolved ?? []) explicitUnitIds.add(hit.unitId);
    hits.push(...(resolved ?? []));
  }
  hits = [...hits].sort((a, b) => b.score - a.score || compare(a.unitId, b.unitId) || compare(a.blockId ?? "", b.blockId ?? ""));
  const primaryCandidates = new Map<string, Candidate>();
  if (options.context) {
    const context = options.context;
    explicitUnitIds.add(context.unitId);
    const record = await repository.getUnit(context.unitId);
    const block = record?.unit.blocks.find((item) => context.blockId ? item.blockId === context.blockId : context.assetId && item.assetId === context.assetId);
    if (!record || record.unit.document !== context.documentId || record.unit.numbering.official !== context.numbering
      || (options.document && context.documentId !== options.document)
      || (context.blockId && !block) || (context.assetId && block?.assetId !== context.assetId)) throw new ChatNTCContextError();
    // Reserve one bounded primary slot for the explicit user hint; search above still runs unchanged.
    primaryCandidates.set(context.unitId, { unitId: context.unitId, score: 0,
      reasons: [{ kind: "viewer-context", score: 0 }], targetBlocks: new Map(block ? [[block.blockId, block.assetId]] : []) });
  }
  for (const hit of hits) {
    const candidate = primaryCandidates.get(hit.unitId) ?? { unitId: hit.unitId, score: hit.score, reasons: [], targetBlocks: new Map<string, string | undefined>() };
    const reason = { kind: hit.match === "exact-reference" || hit.match === "number-exact" ? "exact-reference" as const : "full-text" as const, score: hit.score };
    if (!candidate.reasons.some((item) => stableJson(item) === stableJson(reason))) candidate.reasons.push(reason);
    if (hit.assetId && !hit.blockId) throw new Error("ChatNTC: target asset senza blocco proprietario.");
    if (hit.blockId) candidate.targetBlocks.set(hit.blockId, hit.assetId);
    primaryCandidates.set(hit.unitId, candidate);
  }
  if (primaryCandidates.size > options.maxPrimaryUnits) reduced = true;
  let remaining = options.maxEvidenceCharacters;
  const primaryUnits: ChatNTCEvidenceUnit[] = [];
  const relatedUnits: ChatNTCEvidenceUnit[] = [];
  async function collect(candidate: Candidate, output: ChatNTCEvidenceUnit[]) {
    const record = await repository.getUnit(candidate.unitId);
    if (!record) throw new Error(`ChatNTC: target dell'indice assente: ${candidate.unitId}`);
    if (options.document && record.unit.document !== options.document) return;
    for (const [blockId, assetId] of candidate.targetBlocks) {
      const block = record.unit.blocks.find((entry) => entry.blockId === blockId);
      if (!block || (assetId && block.assetId !== assetId)) throw new Error(`ChatNTC: target del rimando incoerente con il corpus: ${blockId}`);
    }
    const selected = selectUnit(record, candidate, question, Math.min(remaining, options.maxUnitCharacters));
    if (!selected) { reduced = true; return; }
    if (!selected.selection.complete) reduced = true;
    remaining -= JSON.stringify(selected).length;
    output.push(selected);
  }
  const rankedPrimary = [...primaryCandidates.values()].sort((a, b) =>
    Number(explicitUnitIds.has(b.unitId)) - Number(explicitUnitIds.has(a.unitId))
    || b.score - a.score || compare(a.unitId, b.unitId));
  const explicitCount = rankedPrimary.filter((candidate) => explicitUnitIds.has(candidate.unitId)).length;
  for (const candidate of rankedPrimary.slice(0, Math.max(options.maxPrimaryUnits, explicitCount))) await collect(candidate, primaryUnits);

  const relatedCandidates = new Map<string, Candidate>();
  const primaryIds = new Set(primaryUnits.map((unit) => unit.unitId));
  for (const primary of options.maxRelatedUnits > 0 ? primaryUnits : []) {
    let children = 0;
    const usefulChildren = primary.reasons.some((reason) => reason.kind === "exact-reference" || reason.kind === "viewer-context") || primary.blocks.every((block) => block.kind === "heading");
    const links = [...await repository.related(primary.unitId)]
      .sort((a, b) => relationScore(b) - relationScore(a) || compare(stableJson(a), stableJson(b)));
    for (const relation of links) {
      if (primaryIds.has(relation.unitId)) continue;
      // Canonical URNs encode the document; filter before consuming relation/child slots.
      if (options.document && !relation.unitId.startsWith(`urn:structural-codes:it:unit:${options.document}:`)) continue;
      if (relation.kind === "parent" && !options.includeParents) continue;
      if (relation.kind === "child") {
        if (!usefulChildren || options.maxChildrenPerUnit === 0) continue;
        if (children++ >= options.maxChildrenPerUnit) { reduced = true; continue; }
      }
      if (relation.kind === "cross-reference" && !options.includeCrossReferences) continue;
      if (relation.kind === "explicit-relation" && (!options.includeExplicitRelations || relation.reviewStatus === "rejected"
        || (relation.reviewStatus !== "confirmed" && !options.includeProposedRelations))) continue;
      const candidate = relatedCandidates.get(relation.unitId) ?? { unitId: relation.unitId, score: relationScore(relation), reasons: [], targetBlocks: new Map<string, string | undefined>() };
      if (!candidate.reasons.some((reason) => stableJson(reason) === stableJson(relation))) candidate.reasons.push(relation);
      candidate.score = Math.max(candidate.score, relationScore(relation));
      if (relation.blockId) candidate.targetBlocks.set(relation.blockId, relation.assetId);
      relatedCandidates.set(relation.unitId, candidate);
    }
  }
  const ranked = [...relatedCandidates.values()].sort((a, b) => b.score - a.score || compare(a.unitId, b.unitId));
  if (ranked.length > options.maxRelatedUnits) reduced = true;
  for (const candidate of ranked.slice(0, options.maxRelatedUnits)) await collect(candidate, relatedUnits);
  for (const unit of [...primaryUnits, ...relatedUnits]) {
    if (unit.blocks.some((block) => block.asset?.kind === "figure")) warnings.push({ code: "figure-metadata-only", unitId: unit.unitId });
  }
  if (!primaryUnits.length) warnings.push({ code: "no-evidence" });
  if (reduced) warnings.push({ code: "evidence-reduced" });
  const value: Omit<ChatNTCEvidencePackage, "packageId"> = {
    formatVersion: 1, policyVersion: CHATNTC_EPISTEMIC_POLICY.version, question, corpus, primaryUnits, relatedUnits,
    retrieval: { options, query: retrievalQuery, evidenceCharacters: options.maxEvidenceCharacters - remaining, reduced },
    warnings: [...new Map(warnings.map((warning) => [stableJson(warning), warning])).values()],
  };
  // Detach the returned package from cached corpus objects; consumers cannot mutate the corpus through it.
  return JSON.parse(JSON.stringify({ ...value, packageId: await evidencePackageId(value) })) as ChatNTCEvidencePackage;
}
