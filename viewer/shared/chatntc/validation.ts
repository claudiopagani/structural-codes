import { findCrossReferences } from "../crossReferences.js";
import { citationForEvidence, evidencePackageId, evidenceUnits, projectEvidenceBlock, projectEvidenceUnit, stableJson } from "./evidence.js";
import { CHATNTC_EPISTEMIC_POLICY } from "./policy.js";
import { chatNTCIssueCategory } from "./issueCategories.js";
import { isChatNTCResponse } from "./responseContract.js";
import type { ChatNTCCitation, ChatNTCEvidencePackage, ChatNTCRepository,
  ChatNTCUnitRecord, ChatNTCValidationIssue, ChatNTCValidationResult } from "./types.js";

/**
 * The package is supplied by the application, never by the provider. Provider output is unknown.
 * Integrity and declared claim coverage only: success does NOT establish semantic support.
 * Repository I/O failures reject the promise, never turn into successful validation.
 */
export async function validateChatNTCResponse(response: unknown, evidence: ChatNTCEvidencePackage, repository: ChatNTCRepository): Promise<ChatNTCValidationResult> {
  const issueMap = new Map<string, ChatNTCValidationIssue>();
  const issues: ChatNTCValidationIssue[] = [];
  const add = (code: string, path: string, message: string, details: Pick<ChatNTCValidationIssue, "reference" | "targets"> = {}) => {
    const issue = { code, path, message, category: chatNTCIssueCategory(code), ...details };
    const key = `${code}\u0000${path}\u0000${details.reference ?? ""}\u0000${stableJson(details.targets ?? [])}`;
    if (!issueMap.has(key)) { issueMap.set(key, issue); issues.push(issue); }
  };
  const finish = () => ({ valid: issues.length === 0, issues });
  if (!isChatNTCResponse(response)) {
    add("invalid-response-shape", "response", "La risposta non rispetta il contratto ChatNTC v1/v2.");
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
    if (!claim.citations.length) add("uncovered-claim", path, "Il claim richiede almeno una citazione di evidence selezionata.");
    if (claim.classification === "combined-reference" && new Set(claim.citations.map((citation) => citation.evidenceId)).size < 2) add("insufficient-combined-evidence", path, "Un claim combinato richiede almeno due evidence distinte.");
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
  const declaredUsed = new Set(response.usedEvidenceIds);
  for (const evidenceId of declaredUsed) {
    if (!evidenceIds.has(evidenceId)) add("evidence-not-selected", "response.usedEvidenceIds", "Evidence dichiarata come utilizzata ma non inclusa nel pacchetto.");
  }
  if ([...used].some((evidenceId) => !declaredUsed.has(evidenceId))) add("used-evidence-mismatch", "response.usedEvidenceIds", "Gli ID utilizzati devono includere tutte le citazioni dei claim.");
  if (response.classification === "external-source") add("external-source-disabled", "response.classification", "Le fonti esterne non sono abilitate in questa fase.");
  const status = response.formatVersion === 2 ? response.status
    : response.classification === "no-direct-reference" ? "abstained" : response.needsMoreEvidence ? "partial" : "answered";
  if (status === "abstained") {
    if (response.classification !== "no-direct-reference") add("abstention-classification", "response.classification", "L'astensione deve usare no-direct-reference.");
    if (used.size || response.claims.length) add("abstention-with-citations", "response", "L'astensione non può dichiarare claim o citazioni normative.");
    if (!response.needsMoreEvidence) add("abstention-needs-evidence", "response.needsMoreEvidence", "L'astensione deve indicare evidence insufficiente.");
  } else {
    if (!response.claims.length || !used.size) add("uncovered-answer", "response.claims", "Una risposta utile deve dichiarare claim e citazioni.");
    if (status === "partial" && !response.needsMoreEvidence) add("partial-needs-evidence", "response.needsMoreEvidence", "Una risposta parziale deve dichiarare la necessità di altra evidence.");
    if (status === "answered" && response.needsMoreEvidence) add("answered-needs-evidence", "response.needsMoreEvidence", "Una risposta completa non può dichiarare evidence insufficiente.");
  }
  if (response.classification === "combined-reference" && declaredUsed.size < 2) add("insufficient-combined-evidence", "response", "Una risposta combinata richiede almeno due evidence distinte.");
  const answerCitations = response.usedEvidenceIds.filter((id) => evidenceIds.has(id)).map((id) => citationForEvidence(evidence, id));
  const answerMentionIds = await checkMentions(response.answer, answerCitations, "response.answer");
  const accountedIds = new Set([...used, ...answerMentionIds]);
  if ([...declaredUsed].some((evidenceId) => !accountedIds.has(evidenceId))) add("used-evidence-mismatch", "response.usedEvidenceIds", "Gli ID utilizzati devono derivare dai claim o da riferimenti espliciti nella risposta.");
  return finish();

  async function checkMentions(value: string, citations: ChatNTCCitation[], path: string) {
    // Lexical accounting only. It cannot decide whether these sources prove the sentence.
    const matchedIds = new Set<string>();
    const seen = new Set<string>();
    for (const reference of findCrossReferences(value)) {
      const targets = await repository.resolveExact(reference.text);
      const targetDetails = (targets ?? []).map(({ unitId, blockId, assetId }) => ({ unitId, ...(blockId ? { blockId } : {}), ...(assetId ? { assetId } : {}) }));
      const mentionKey = `${reference.kind}:${reference.number}:${stableJson(targetDetails)}`;
      if (seen.has(mentionKey)) continue;
      seen.add(mentionKey);
      if (!targets?.length) {
        add("unresolved-reference", path, `Riferimento normativo non risolvibile: ${reference.text}`, { reference: reference.text });
        continue;
      }
      const matching = citations.filter((citation) => targets.some((target) => citation.unitId === target.unitId
        && (!target.blockId || citation.blockId === target.blockId)
        && (!target.assetId || citation.assetId === target.assetId)));
      for (const citation of matching) matchedIds.add(citation.evidenceId);
      const covered = matching.length > 0;
      if (!covered) {
        const selectedCitations = [...evidenceIds].map((id) => citationForEvidence(evidence, id));
        const selectedTarget = targets.some((target) => selectedCitations.some((citation) => citation.unitId === target.unitId
          && (!target.blockId || citation.blockId === target.blockId)
          && (!target.assetId || citation.assetId === target.assetId)));
        const code = selectedTarget ? "untracked-reference" : "unselected-canonical-reference";
        add(code, path, code === "untracked-reference"
          ? `Riferimento testuale senza citazione associata: ${reference.text}`
          : `Riferimento canonico reale non incluso nell'evidence: ${reference.text}`,
        { reference: reference.text, targets: targetDetails });
      }
    }
    return matchedIds;
  }
}
