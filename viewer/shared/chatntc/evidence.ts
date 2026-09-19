import type { CorpusBlock, TableCell } from "../corpusData.js";
import type { ChatNTCCitation, ChatNTCEvidenceBlock, ChatNTCEvidencePackage, ChatNTCEvidenceUnit, ChatNTCReference, ChatNTCUnitRecord } from "./types.js";
import type { ViewerTarget } from "../permalinks.js";

/** Sorted object keys, preserved array/source order, no clock or randomness. */
export function stableJson(value: unknown): string {
  return JSON.stringify(value, (_key, item: unknown) => {
    if (item && typeof item === "object" && !Array.isArray(item)) {
      return Object.fromEntries(Object.entries(item).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0));
    }
    return item;
  });
}

export async function evidencePackageId(value: Omit<ChatNTCEvidencePackage, "packageId">): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(stableJson(value)));
  return `chatntc:v1:${Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

function cell(value: TableCell): TableCell {
  const { text, latex, inline, image, colSpan, rowSpan, strong, align, noWrap, verticalText, shade, spacer } = value;
  return { text, latex, inline, image, colSpan, rowSpan, strong, align, noWrap, verticalText, shade, spacer };
}

/** Project explicitly: never send raw extraction, creation actors or reviewer identities. */
export function projectEvidenceBlock(block: CorpusBlock, record: ChatNTCUnitRecord): ChatNTCEvidenceBlock {
  const result: ChatNTCEvidenceBlock = {
    evidenceId: block.blockId, blockId: block.blockId, kind: block.kind, origin: block.origin,
    ...(block.listMarker ? { listMarker: block.listMarker } : {}),
    ...(block.listLevel !== undefined ? { listLevel: block.listLevel } : {}),
    ...(block.indentLevel !== undefined ? { indentLevel: block.indentLevel } : {}),
  };
  if (block.text) result.text = { normalized: block.text.normalized, ...(block.text.inline ? { inline: block.text.inline } : {}) };
  if (block.evidence) {
    const { sourceId, pdfPage, printedPage, region, normalizedSha256 } = block.evidence;
    result.provenance = { sourceId, pdfPage, printedPage, region, normalizedSha256 };
  }
  if (block.assetId) {
    const formula = record.assets.formulas[block.assetId];
    const table = record.assets.tables[block.assetId];
    const figure = record.assets.figures[block.assetId];
    const matches = [formula, table, figure].filter(Boolean);
    if (matches.length !== 1 || matches[0].id !== block.assetId
      || (matches[0].unitId && matches[0].unitId !== record.unit.id)) {
      throw new Error(`ChatNTC: asset assente, duplicato o con proprietario incoerente: ${block.assetId}`);
    }
    result.assetId = block.assetId;
    if (formula) {
      const { id, officialNumber, pdfPage, latex } = formula;
      result.asset = { kind: "formula", data: { id, officialNumber, pdfPage, latex } };
    } else if (table) {
      const { id, officialNumber, pdfPage, caption, columnCount, columnWidths, footerColumnCount, footerColumnWidths, captionInline, notes, notesInline } = table;
      result.asset = { kind: "table", data: { id, officialNumber, pdfPage, caption, columnCount, columnWidths, footerColumnCount, footerColumnWidths, captionInline,
        headers: table.headers.map((row) => row.map(cell)), rows: table.rows.map((row) => row.map(cell)), footerRows: table.footerRows?.map((row) => row.map(cell)), notes, notesInline } };
    } else {
      const { id, officialNumber, pdfPage, caption, captionInline, alt, imagePath, sha256 } = figure;
      result.asset = { kind: "figure", contentAvailability: "metadata-only",
        data: { id, officialNumber, pdfPage, caption, captionInline, alt, imagePath, sha256 } };
    }
  }
  return result;
}

export function projectEvidenceUnit(record: ChatNTCUnitRecord): Omit<ChatNTCEvidenceUnit, "reasons" | "blocks" | "selection"> {
  const { unit } = record;
  return {
    evidenceId: unit.id, unitId: unit.id, document: unit.document, numbering: unit.numbering.official,
    title: unit.title, validity: { ...unit.validity }, provenance: { ...record.provenance },
    editorial: {
      status: unit.workflow.status,
      ...(unit.workflow.reviews ? { reviews: unit.workflow.reviews.map(({ reviewId, type, reviewedAt, result }) => ({ reviewId, type, reviewedAt, result })) } : {}),
      openIssues: unit.workflow.openIssues.map(({ issueId, type, severity, note }) => ({ issueId, type, severity, note })),
    },
  };
}

export function evidenceUnits(evidence: ChatNTCEvidencePackage): ChatNTCEvidenceUnit[] {
  return [...evidence.primaryUnits, ...evidence.relatedUnits];
}

/** Build citations from trusted selected evidence; never ask a provider to compose an URN. */
export function citationForEvidence(evidence: ChatNTCEvidencePackage, evidenceId: string): ChatNTCCitation {
  for (const unit of evidenceUnits(evidence)) {
    const base = { evidenceId, unitId: unit.unitId, document: unit.document, numbering: unit.numbering };
    if (unit.evidenceId === evidenceId) return base;
    const block = unit.blocks.find((item) => item.evidenceId === evidenceId);
    if (block) return { ...base, blockId: block.blockId,
      ...(block.asset ? { assetId: block.assetId, assetNumber: block.asset.data.officialNumber } : {}) };
  }
  throw new Error(`ChatNTC: evidence non selezionata: ${evidenceId}`);
}

/** Reuses the viewer's target contract; URL generation remains the consumer's responsibility. */
export function viewerTargetForCitation(citation: ChatNTCReference): ViewerTarget {
  if (citation.assetId) {
    const assetKind = (["formula", "table", "figure"] as const)
      .find((kind) => citation.assetId?.startsWith(`urn:structural-codes:it:asset:${kind}:`));
    return { kind: "asset", unitId: citation.unitId, assetId: citation.assetId, assetKind };
  }
  if (citation.blockId) return { kind: "block", unitId: citation.unitId, blockId: citation.blockId };
  return { kind: "unit", unitId: citation.unitId };
}
