import { findCrossReferences } from "../crossReferences.js";
import { citationForEvidence, evidencePackageId, evidenceUnits, projectEvidenceBlock, projectEvidenceUnit, stableJson } from "./evidence.js";
import { CHATNTC_EPISTEMIC_POLICY } from "./policy.js";
import { isChatNTCResponse } from "./responseContract.js";
import type { ChatNTCCitation, ChatNTCEvidencePackage, ChatNTCRepository,
  ChatNTCUnitRecord, ChatNTCValidationIssue, ChatNTCValidationResult } from "./types.js";

/**
 * The package is supplied by the application, never by the provider. Provider output is unknown.
 * Integrity and declared claim coverage only: success does NOT establish semantic support.
 * Repository I/O failures reject the promise, never turn into successful validation.
 */
export async function validateChatNTCResponse(response: unknown, evidence: ChatNTCEvidencePackage, repository: ChatNTCRepository): Promise<ChatNTCValidationResult> {
  const issues: ChatNTCValidationIssue[] = [];
  const add = (code: string, path: string, message: string) => issues.push({ code, path, message });
  const finish = () => ({ valid: issues.length === 0, issues });
  if (!isChatNTCResponse(response)) {
    add("invalid-response-shape", "response", "La risposta non rispetta il contratto ChatNTC v1.");
    return finish();
  }
  const { packageId, ...packageBody } = evidence;
  if (evidence.formatVersion !== 1 || evidence.policyVersion !== CHATNTC_EPISTEMIC_POLICY.version) add("unsupported-package", "evidence", "Formato o policy non supportati.");
  if (packageId !== await evidencePackageId(packageBody)) add("package-integrity", "evidence.packageId", "Il contenuto del pacchetto è cambiato.");
  if (response.evidencePackageId !== packageId) add("wrong-package", "response.evidencePackageId", "Risposta associata a un altro Evidence Package.");
  if (stableJson(evidence.corpus) !== stableJson(await repository.identity())) add("corpus-mismatch", "evidence.corpus", "Il repository non corrisponde allo snapshot del pacchetto.");

  const records = new Map<string, Promise<ChatNTCUnitRecord | null>>();
  const getUnit = (id: string) => {
    let pending = records.get(id);
    if (!pending) { pending = repository.getUnit(id); records.set(id, pending); }
    return pending;
  };
  const evidenceIds = new Set<string>();
  const assets = new Set<string>();
  const selected = evidenceUnits(evidence);
  for (const [position, unit] of selected.entries()) {
    const path = `evidence.units[${position}]`;
    if (evidenceIds.has(unit.evidenceId)) add("duplicate-evidence", path, "Evidence ID duplicato.");
    evidenceIds.add(unit.evidenceId);
    const record = await getUnit(unit.unitId);
    if (!record) { add("unknown-unit", path, "Unità assente dal corpus."); continue; }
    const metadata = { ...unit } as Partial<typeof unit>;
    delete metadata.reasons;
    delete metadata.blocks;
    delete metadata.selection;
    if (stableJson(metadata) !== stableJson(projectEvidenceUnit(record))) add("evidence-metadata-mismatch", path, "Identità, stato editoriale o provenienza non corrispondono al corpus.");
    if (!record.unit.id.startsWith(`urn:structural-codes:it:unit:${record.unit.document}:`)) add("canonical-document-mismatch", path, "Il documento non corrisponde all'ID canonico.");
    if (!unit.blocks.length) add("empty-evidence", path, "Una unità senza blocchi selezionati non è evidence.");
    let previousPosition = -1;
    for (const block of unit.blocks) {
      if (evidenceIds.has(block.evidenceId)) add("duplicate-evidence", path, "Evidence ID duplicato.");
      evidenceIds.add(block.evidenceId);
      const blockPosition = record.unit.blocks.findIndex((candidate) => candidate.blockId === block.blockId);
      const source = record.unit.blocks[blockPosition];
      if (!source) add("unknown-block", path, "Blocco assente dall'unità canonica.");
      else {
        if (blockPosition <= previousPosition) add("evidence-order", path, "Ordine o unicità dei blocchi non corrispondenti al corpus.");
        previousPosition = blockPosition;
        if (stableJson(block) !== stableJson(projectEvidenceBlock(source, record))) add("evidence-content-mismatch", path, "Contenuto o provenienza del blocco non corrispondenti al corpus.");
      }
      if (block.assetId) {
        if (assets.has(block.assetId)) add("duplicate-asset", path, "Asset ripetuto nel pacchetto.");
        assets.add(block.assetId);
      }
    }
    if (unit.selection.omittedBlocks !== record.unit.blocks.length - unit.blocks.length
      || unit.selection.complete !== (unit.selection.omittedBlocks === 0)) add("selection-mismatch", path, "Copertura dei blocchi dichiarata non corretta.");
  }
  const characters = selected.reduce((sum, unit) => sum + JSON.stringify(unit).length, 0);
  if (characters !== evidence.retrieval.evidenceCharacters || characters > evidence.retrieval.options.maxEvidenceCharacters) add("evidence-budget", "evidence.retrieval", "Budget evidence incoerente.");

  const used = new Set<string>();
  const validCitations: ChatNTCCitation[] = [];
  const claimIds = new Set<string>();
  for (const [claimPosition, claim] of response.claims.entries()) {
    const path = `response.claims[${claimPosition}]`;
    if (claimIds.has(claim.id)) add("duplicate-claim", path, "Claim ID duplicato.");
    claimIds.add(claim.id);
    if (claim.classification === "external-source") add("external-source-disabled", path, "Le fonti esterne non sono abilitate in questa fase.");
    if (claim.classification === "no-direct-reference") {
      if (claim.citations.length) add("abstention-with-citations", path, "Un claim privo di riferimento diretto non può dichiarare citazioni normative.");
    } else if (!claim.citations.length) add("uncovered-claim", path, "Il claim richiede almeno una citazione di evidence selezionata.");
    if (claim.classification === "combined-reference" && new Set(claim.citations.map((citation) => citation.evidenceId)).size < 2) add("insufficient-combined-evidence", path, "Un claim combinato richiede almeno due evidence distinte.");
    if (response.classification === "no-direct-reference" && claim.classification !== "no-direct-reference") add("classification-mismatch", path, "Una risposta di astensione non può contenere claim normativi.");
    if (claim.classification === "interpretation" && response.classification !== "interpretation") add("interpretation-not-declared", path, "La risposta deve dichiarare la presenza di interpretazioni.");
    const claimEvidence = new Set<string>();
    const validForClaim: ChatNTCCitation[] = [];
    for (const [citationPosition, citation] of claim.citations.entries()) {
      const citationPath = `${path}.citations[${citationPosition}]`;
      const initialIssues = issues.length;
      if (claimEvidence.has(citation.evidenceId)) add("duplicate-citation", citationPath, "Evidence ripetuta nello stesso claim.");
      claimEvidence.add(citation.evidenceId);
      used.add(citation.evidenceId);
      const record = await getUnit(citation.unitId);
      if (!record) add("unknown-unit", citationPath, "Unità citata assente dal corpus.");
      else {
        if (citation.document !== record.unit.document || citation.numbering !== record.unit.numbering.official) add("citation-identity-mismatch", citationPath, "Documento o numbering non corrispondono all'ID canonico.");
        const block = citation.blockId ? record.unit.blocks.find((entry) => entry.blockId === citation.blockId) : undefined;
        if (citation.blockId && !block) add("unknown-block", citationPath, "Blocco citato assente dall'unità.");
        if (citation.assetId) {
          const asset = record.assets.formulas[citation.assetId] ?? record.assets.tables[citation.assetId] ?? record.assets.figures[citation.assetId];
          if (!asset || !record.unit.blocks.some((entry) => entry.assetId === citation.assetId)) add("unknown-asset", citationPath, "Asset citato assente dall'unità.");
          if (!block || block.assetId !== citation.assetId) add("asset-block-mismatch", citationPath, "Asset e blocco citati non corrispondono.");
          if (asset && citation.assetNumber !== asset.officialNumber) add("asset-number-mismatch", citationPath, "Numero ufficiale dell'asset non corrispondente.");
        } else if (citation.assetNumber !== undefined) add("asset-number-without-asset", citationPath, "Numero asset privo di assetId.");
      }
      if (!evidenceIds.has(citation.evidenceId)) add("evidence-not-selected", citationPath, "Evidence non inclusa nel pacchetto.");
      else if (stableJson(citation) !== stableJson(citationForEvidence(evidence, citation.evidenceId))) add("citation-target-mismatch", citationPath, "La citazione non coincide con il target dell'evidence selezionata.");
      if (issues.length === initialIssues) { validCitations.push(citation); validForClaim.push(citation); }
    }
    await checkMentions(claim.text, validForClaim, path);
  }
  if (new Set(response.usedEvidenceIds).size !== response.usedEvidenceIds.length) add("duplicate-used-evidence", "response.usedEvidenceIds", "Evidence ID utilizzati duplicati.");
  if (stableJson([...used].sort()) !== stableJson([...response.usedEvidenceIds].sort())) add("used-evidence-mismatch", "response.usedEvidenceIds", "Gli ID utilizzati devono coincidere con le citazioni dei claim.");
  if (response.classification === "external-source") add("external-source-disabled", "response.classification", "Le fonti esterne non sono abilitate in questa fase.");
  if (response.classification === "no-direct-reference") {
    if (used.size) add("abstention-with-citations", "response", "L'astensione non può dichiarare citazioni normative.");
    if (!response.needsMoreEvidence) add("abstention-needs-evidence", "response.needsMoreEvidence", "L'astensione deve indicare evidence insufficiente.");
  } else if (!response.claims.length || !used.size) add("uncovered-answer", "response.claims", "La risposta deve dichiarare claim e citazioni.");
  if (response.classification === "combined-reference" && used.size < 2) add("insufficient-combined-evidence", "response", "Una risposta combinata richiede almeno due evidence distinte.");
  await checkMentions(response.answer, validCitations, "response.answer");
  return finish();

  async function checkMentions(value: string, citations: ChatNTCCitation[], path: string) {
    // Lexical accounting only. It cannot decide whether these sources prove the sentence.
    for (const reference of findCrossReferences(value)) {
      const targets = await repository.resolveExact(reference.text);
      const covered = targets?.some((target) => citations.some((citation) => citation.unitId === target.unitId
        && (!target.assetId || citation.assetId === target.assetId)));
      if (!covered) add("untracked-reference", path, `Riferimento testuale senza citazione valida: ${reference.text}`);
    }
  }
}
