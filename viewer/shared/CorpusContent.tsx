/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState } from "react";
import katex from "katex";
import type { AssetBundle, CorpusBlock, DocumentId, InlineSegment, TableAsset, TableCell, TextParagraph, CorpusUnit } from "./corpusData";
import { findCrossReferences } from "./crossReferences.js";
import { visibleTableCaption, visibleTableCaptionInline, visibleTableNumberSuffix } from "./tableCaptions.mjs";

const editorialTableNotePatterns = [
  /^\s*\[(?:TABELLA|ASSET)_[^\]]+\]/iu,
  /\bevidence\b/iu,
  /\b(?:revisione|review) (?:umana|visuale)\b/iu,
  /\bverifica (?:manuale|umana|visuale)\b/iu,
  /\bconfronto cella per cella\b/iu,
  /\btrascritt[aoe]\b/iu,
  /\btrascrizione\b/iu,
  /\brender\b/iu,
  /\bpagin[ae] PDF\b/iu,
  /\bgriglia ricostruita automaticamente\b/iu,
  /\bmodello corrente\b/iu,
  /\bschema corrente\b/iu,
  /\bdescrizion[ei] (?:testuali|strutturat[ae])\b/iu,
  /\bissue bloccante\b/iu,
];

function visibleTableNotes(table: TableAsset) {
  return table.notes
    .map((text, index) => ({ text, inline: table.notesInline?.[index] }))
    .filter(({ text }) => !editorialTableNotePatterns.some((pattern) => pattern.test(text)));
}

function tableColumnCount(headers: TableCell[][], rows: TableCell[][]) {
  return Math.max(0, ...[...headers, ...rows].map((row) => row.reduce((count, cell) => count + (cell.colSpan ?? 1), 0)));
}

function tableAssetClass(officialNumber: string | null, assetId?: string) {
  const suffix = officialNumber?.toLowerCase().replace(/[^a-z0-9]+/gu, "-").replace(/^-|-$/gu, "");
  const classes = suffix ? [`table-asset-${suffix}`] : [];
  if (assetId?.endsWith(":c5.delta-t0")) classes.push("table-asset-c5-delta-t0");
  return classes.join(" ");
}

function figureAssetClass(officialNumber: string | null) {
  const suffix = officialNumber?.toLowerCase().replace(/[^a-z0-9]+/gu, "-").replace(/^-|-$/gu, "");
  return suffix ? `figure-asset-${suffix}` : "";
}

const latexMarkupCache = new Map<string, { __html: string }>();

function latexMarkup(latex: string, displayMode: boolean) {
  const key = `${displayMode ? "display" : "inline"}:${latex}`;
  const cached = latexMarkupCache.get(key);
  if (cached) return cached;
  const markup = { __html: katex.renderToString(latex, { displayMode, throwOnError: false, strict: "warn", output: "html" }) };
  latexMarkupCache.set(key, markup);
  return markup;
}

type CopyStatus = "idle" | "copied" | "error";

function copyableImageClipboard() {
  return typeof navigator !== "undefined"
    && typeof navigator.clipboard?.write === "function"
    && typeof ClipboardItem !== "undefined";
}

async function writeImageToClipboard(blob: Blob | PromiseLike<Blob>) {
  if (!copyableImageClipboard()) throw new Error("Il browser non supporta la copia di immagini negli appunti.");
  // Pass the promise directly so Clipboard.write is called while the click
  // still has transient user activation; awaiting the rasterization first can
  // make Chromium reject the write with NotAllowedError.
  await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
}

async function figureImageBlob(image: HTMLImageElement) {
  const response = await fetch(image.currentSrc || image.src);
  if (!response.ok) throw new Error(`Impossibile caricare l'immagine (${response.status}).`);
  const blob = await response.blob();
  if (!blob.type.startsWith("image/")) throw new Error("La risorsa non è un'immagine.");
  return blob;
}

function CopyFigureIcon({ status }: { status: CopyStatus }) {
  if (status === "copied") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6.5 12.5 3.4 3.4 7.6-8" /></svg>;
  if (status === "error") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 7.5v6" /><path d="M12 17.2v.3" /><circle cx="12" cy="12" r="9" /></svg>;
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7.5 6V5.5A2.5 2.5 0 0 1 10 3h7.5A2.5 2.5 0 0 1 20 5.5V13a2.5 2.5 0 0 1-2.5 2.5H17" /><rect x="4" y="7" width="13" height="13" rx="2.5" /><circle cx="13" cy="11" r="1.25" /><path d="m6.5 17 3.25-3.5 2.4 2.45 1.55-1.55 1.8 2.1" /></svg>;
}

function CopyFigureButton() {
  const [status, setStatus] = useState<CopyStatus>("idle");
  const resetTimer = useRef<number | null>(null);
  useEffect(() => () => {
    if (resetTimer.current !== null) window.clearTimeout(resetTimer.current);
  }, []);

  async function copyFigure(event: React.MouseEvent<HTMLButtonElement>) {
    const asset = event.currentTarget.closest<HTMLElement>(".scv-copyable-asset");
    const target = asset?.querySelector<HTMLImageElement>("img");
    if (!target) return;
    try {
      await writeImageToClipboard(figureImageBlob(target));
      setStatus("copied");
      if (resetTimer.current !== null) window.clearTimeout(resetTimer.current);
      resetTimer.current = window.setTimeout(() => setStatus("idle"), 1700);
    } catch {
      setStatus("error");
      if (resetTimer.current !== null) window.clearTimeout(resetTimer.current);
      resetTimer.current = window.setTimeout(() => setStatus("idle"), 2200);
    }
  }

  const feedback = status === "copied" ? "Immagine copiata negli appunti" : status === "error" ? "Copia non disponibile" : "Copia immagine";
  return <button type="button" className={`scv-copy-asset scv-copy-asset-${status}`} onClick={(event) => void copyFigure(event)} aria-label={feedback} title={feedback}><CopyFigureIcon status={status} /></button>;
}

function MathCell({ cell, assetsBaseUrl }: { cell: TableCell; assetsBaseUrl: string }) {
  const content = cell.inline
    ? renderInlineSegments(cell.inline)
    : cell.latex
      ? <span className="table-math" dangerouslySetInnerHTML={latexMarkup(cell.latex, false)} />
      : cell.text;
  if (!cell.image) return <>{content}</>;
  const width = Math.max(1, Math.round(cell.image.region.width * 3));
  const height = Math.max(1, Math.round(cell.image.region.height * 3));
  return <div className="table-cell-content">{content && <div>{content}</div>}<img className="table-cell-image" loading="lazy" src={`${assetsBaseUrl.replace(/\/+$/u, "")}/${cell.image.imagePath}`} alt={cell.image.alt} width={width} height={height} /></div>;
}

function tableCellClass(cell: TableCell) {
  return [
    cell.strong ? "table-cell-strong" : "",
    cell.align ? `table-cell-align-${cell.align}` : "",
    cell.noWrap ? "table-cell-no-wrap" : "",
    cell.verticalText ? "table-cell-vertical" : "",
    cell.shade ? `table-cell-shade-${cell.shade}` : "",
    cell.spacer ? "table-cell-spacer" : "",
    cell.subrowIndent ? "table-cell-subrow-indent" : "",
    cell.subrowLabel ? "table-cell-subrow-label" : "",
    cell.text.includes("\n") ? "table-cell-multiline" : "",
  ].filter(Boolean).join(" ") || undefined;
}

export function leadingMathLabelEnd(inline: InlineSegment[]): number {
  if (inline[0]?.kind !== "math") return 0;
  let end = 1;
  for (let index = 1; index < inline.length; index += 1) {
    const segment = inline[index]!;
    if (segment.kind === "math") {
      end = index + 1;
      continue;
    }
    if (segment.kind === "text" && /^(?:[\s,]+|[\s,]*(?:e|ed)[\s,]*)$/u.test(segment.value)) {
      end = index + 1;
      continue;
    }
    if (segment.kind === "text" && /^\s*(?:sono|è)\b/u.test(segment.value)) break;
    break;
  }
  return end;
}

export function hasOfficialListMarker(block: CorpusBlock) {
  return block.kind === "list-item" && /^\s*(?:[–—-]|\(?[a-z0-9]+[.)])\s+/iu.test(block.text?.normalized ?? "");
}

const alphaRatioListUnitSuffixes = [":7.4.3.2", ":7.5.2.2", ":7.8.1.3"] as const;

export function hasAlphaRatioListLayout(block: CorpusBlock, sourceUnitId?: string) {
  if (!sourceUnitId || !alphaRatioListUnitSuffixes.some((suffix) => sourceUnitId.endsWith(suffix))) return false;
  return block.kind === "list-item" && Boolean(block.text?.inline?.some((segment) => segment.kind === "math" && /\\alpha_u\s*\/\s*\\alpha_1/u.test(segment.latex ?? "")));
}

export function hasInferredAlphaRatioListMarker(block: CorpusBlock, sourceUnitId?: string) {
  return hasAlphaRatioListLayout(block, sourceUnitId) && !hasOfficialListMarker(block);
}

function alphaRatioInlineWithMarker(block: CorpusBlock, sourceUnitId?: string) {
  const inline = block.text?.inline;
  if (!inline || !hasInferredAlphaRatioListMarker(block, sourceUnitId)) return inline;
  return [{ kind: "text" as const, value: "- " }, ...inline];
}

export function hasAlphabeticListMarker(block: CorpusBlock) {
  return block.kind === "list-item" && /^\s*(?:[a-z]+\.\d+\)|\(?[a-z]+[.)]|\d+[.)])\s+/iu.test(block.text?.normalized ?? "");
}

export function hasSimpleDashMarker(block: CorpusBlock) {
  if (block.kind !== "list-item" || block.listMarker === "none" || block.listMarker === "bullet") return false;
  return Boolean(block.text?.normalized?.trim())
    && !hasTrailingStrong(block)
    && !hasTrailingMath(block)
    && (block.listMarker === "dash" || !hasOfficialListMarker(block));
}

export function hasNoListMarker(block: CorpusBlock) {
  return block.kind === "list-item" && block.listMarker === "none";
}

export function listMarkerClass(block: CorpusBlock) {
  return block.kind === "list-item" && block.listMarker === "bullet" ? "list-item-with-bullet" : "";
}

export function listLevelClass(block: CorpusBlock) {
  return block.kind === "list-item" && (block.listLevel ?? 0) > 0 ? `list-item-level-${block.listLevel}` : "";
}

export function indentLevelClass(block: CorpusBlock) {
  return block.indentLevel && block.indentLevel > 0 ? `block-indent-${block.indentLevel}` : "";
}

export function hasLeadingMath(block: CorpusBlock) {
  const inline = block.text?.inline;
  return block.kind === "list-item" && block.listMarker === "none" && inline?.[0]?.kind === "math";
}

export function hasAlignedListContinuation(block: CorpusBlock) {
  return block.kind === "list-item"
    && block.listMarker === "none"
    && /^\s*[–—-]\s+/u.test(block.text?.normalized ?? "");
}

export function hasLeadingEmphasisLabel(block: CorpusBlock) {
  const inline = block.text?.inline;
  const label = inline?.[0];
  const following = inline?.[1];
  if (block.kind === "list-item" && block.listMarker === "none" && label?.kind === "strong" && inline !== undefined && inline.length > 1) return true;
  return (
    (block.kind === "paragraph" || (block.kind === "list-item" && block.listMarker === "none")) &&
    (label?.kind === "em" || label?.kind === "underline") &&
    (/:\s*$/u.test(label.value) || /^\s*:/u.test(following?.kind === "text" ? following.value : ""))
  );
}

export function leadingLabelKind(block: CorpusBlock): "math" | "emphasis" | null {
  if (hasLeadingMath(block)) return "math";
  if (hasLeadingEmphasisLabel(block)) return "emphasis";
  return null;
}

export type CorpusBlockGroup =
  | { kind: "label-list"; blocks: CorpusBlock[] }
  | { kind: "block"; block: CorpusBlock; index: number };

export function groupAlignedLabelBlocks(blocks: CorpusBlock[]): CorpusBlockGroup[] {
  const groups: CorpusBlockGroup[] = [];
  let index = 0;
  while (index < blocks.length) {
    const labelKind = leadingLabelKind(blocks[index]);
    if (!labelKind) {
      groups.push({ kind: "block", block: blocks[index], index });
      index += 1;
      continue;
    }
    const labelBlocks = [blocks[index]];
    const indentLevel = blocks[index].indentLevel ?? 0;
    index += 1;
    while (
      index < blocks.length
      && (blocks[index].indentLevel ?? 0) === indentLevel
      && (leadingLabelKind(blocks[index]) === labelKind || (labelKind === "math" && hasAlignedListContinuation(blocks[index])))
    ) {
      labelBlocks.push(blocks[index]);
      index += 1;
    }
    groups.push({ kind: "label-list", blocks: labelBlocks });
  }
  return groups;
}

export function hasTrailingStrong(block: CorpusBlock) {
  const inline = block.text?.inline;
  return block.kind === "list-item" && inline !== undefined && inline.length > 0 && inline.at(-1)?.kind === "strong";
}

export function hasTrailingMath(block: CorpusBlock) {
  const inline = block.text?.inline;
  if (block.kind !== "list-item" || !inline || inline.length < 2 || inline[0]?.kind === "math" || inline[1]?.kind !== "math") return false;
  return inline.slice(2).every((segment) => segment.kind === "text" && /^[\s,.;:!?»)\]]*$/u.test(segment.value));
}

export interface BlockContentProps {
  block: CorpusBlock;
  assets: AssetBundle | null;
  assetsBaseUrl?: string;
  aligned?: boolean;
  sourceUnitId?: string;
  sourceDocument?: DocumentId;
}

type InlineSegments = InlineSegment[];
interface ReferenceContext { sourceUnitId: string; sourceDocument: DocumentId; }

function renderReferenceText(value: string, context: ReferenceContext | null, keyPrefix: string) {
  if (!context) return value;
  const references = findCrossReferences(value);
  if (references.length === 0) return value;
  const nodes: Array<React.ReactNode> = [];
  let offset = 0;
  for (const reference of references) {
    if (reference.start > offset) nodes.push(value.slice(offset, reference.start));
    nodes.push(<button
      type="button"
      className="scv-cross-reference"
      data-scv-reference-kind={reference.kind}
      data-scv-reference-number={reference.number}
      data-scv-reference-document={reference.documentHint ?? ""}
      data-scv-source-unit-id={context.sourceUnitId}
      data-scv-source-document={context.sourceDocument}
      key={`${keyPrefix}:${reference.start}:${reference.end}`}
    >{value.slice(reference.start, reference.end)}</button>);
    offset = reference.end;
  }
  if (offset < value.length) nodes.push(value.slice(offset));
  return nodes;
}

export function renderInlineSegments(inline: InlineSegments, context: ReferenceContext | null = null) {
  const nodes: Array<React.ReactNode> = [];
  inline.forEach((segment, index) => {
    if (segment.kind === "math") {
      nodes.push(<span className="inline-math" title={segment.value} key={`${segment.value}-${index}`} dangerouslySetInnerHTML={latexMarkup(segment.latex, false)} />);
      return;
    }
    if (segment.kind === "em") {
      nodes.push(<em key={`em-${index}`}>{renderReferenceText(segment.value, context, `em-${index}`)}</em>);
      return;
    }
    if (segment.kind === "underline") {
      nodes.push(<u key={`underline-${index}`}>{renderReferenceText(segment.value, context, `underline-${index}`)}</u>);
      return;
    }
    if (segment.kind === "em-underline") {
      nodes.push(<em key={`em-underline-${index}`}><u>{renderReferenceText(segment.value, context, `em-underline-${index}`)}</u></em>);
      return;
    }
    if (segment.kind === "strong-em") {
      nodes.push(<strong key={`strong-em-${index}`}><em>{renderReferenceText(segment.value, context, `strong-em-${index}`)}</em></strong>);
      return;
    }
    if (segment.kind === "strong-underline") {
      nodes.push(<strong key={`strong-underline-${index}`}><u>{renderReferenceText(segment.value, context, `strong-underline-${index}`)}</u></strong>);
      return;
    }
    if (segment.kind === "strong") {
      nodes.push(<strong key={`strong-${index}`}>{renderReferenceText(segment.value, context, `strong-${index}`)}</strong>);
      return;
    }
    const previous = inline[index - 1];
    const leading = segment.value.match(/^[,.;:!?»)\]—-]+/u)?.[0] ?? "";
    if (leading && previous?.kind === "math") {
      nodes[nodes.length - 1] = <span className="inline-keep-punct" key={`keep-${index}`}>{nodes[nodes.length - 1]}{leading}</span>;
      const rest = segment.value.slice(leading.length);
      if (rest) nodes.push(<span key={`text-${index}`}>{renderReferenceText(rest, context, `text-${index}`)}</span>);
      return;
    }
    nodes.push(<span key={`text-${index}`}>{renderReferenceText(segment.value, context, `text-${index}`)}</span>);
  });
  return nodes;
}

function splitInlinePrefix(inline: InlineSegments, prefix: string) {
  let remaining = prefix;
  const marker: InlineSegments = [];
  const description: InlineSegments = [];
  for (const segment of inline) {
    if (!remaining) {
      description.push(segment);
      continue;
    }
    if (segment.kind === "math") return null;
    let consumed = 0;
    while (consumed < segment.value.length && consumed < remaining.length && segment.value[consumed] === remaining[consumed]) consumed += 1;
    if (consumed === 0) return null;
    if (consumed < segment.value.length) {
      if (consumed !== remaining.length) return null;
      marker.push({ ...segment, value: segment.value.slice(0, consumed) });
      const rest = segment.value.slice(consumed);
      if (rest) description.push({ ...segment, value: rest });
      remaining = "";
      continue;
    }
    marker.push(segment);
    remaining = remaining.slice(consumed);
  }
  return remaining ? null : { marker, description };
}

function renderLeadingLabelContent(block: CorpusBlock, context: ReferenceContext | null, aligned: boolean) {
  const inline = block.text?.inline;
  if (!inline) return null;
  if (aligned && hasAlignedListContinuation(block)) {
    return <><span className="leading-label-empty" aria-hidden="true" /><span className="leading-label-description">{renderInlineSegments(inline, context)}</span></>;
  }
  if (hasLeadingEmphasisLabel(block)) {
    const label = inline[0];
    const labelHasColon = /:\s*$/u.test(label.value);
    const description = inline.slice(1).map((segment, index) => index === 0 && segment.kind === "text" ? { ...segment, value: segment.value.replace(labelHasColon ? /^\s*/u : /^\s*:\s*/u, "") } : segment);
    return <><span className="leading-label">{label.kind === "strong" ? <strong>{label.value}</strong> : label.kind === "em" ? <><em>{label.value}</em>{labelHasColon ? null : ":"}</> : label.kind === "underline" ? <><u>{label.value}</u>{labelHasColon ? null : ":"}</> : label.value}</span><span className="leading-label-description">{renderInlineSegments(description, context)}</span></>;
  }
  if (hasLeadingMath(block)) {
    const labelEnd = leadingMathLabelEnd(inline);
    const label = inline.slice(0, labelEnd);
    const description = inline.slice(labelEnd).map((segment, index) => index === 0 && segment.kind === "text" ? { ...segment, value: segment.value.replace(/^\s+/u, "") } : segment);
    return <><span className="leading-math-label">{renderInlineSegments(label, context)}</span><span className="leading-math-description">{renderInlineSegments(description, context)}</span></>;
  }
  return null;
}

function renderAlphabeticListContent(block: CorpusBlock, context: ReferenceContext | null) {
  if (!hasAlphabeticListMarker(block)) return null;
  const inline = block.text?.inline;
  const normalized = block.text?.normalized;
  const source = normalized;
  if (!source) return null;
  const match = source.match(/^(\s*(?:[a-z]+\.\d+\)|\(?[a-z]+[.)]|\d+[.)])\s+)/iu);
  if (!match) return null;
  if (!inline) {
    return <><span className="list-marker-label">{match[1]}</span><span className="list-description">{normalized.slice(match[0].length)}</span></>;
  }
  const split = splitInlinePrefix(inline, match[1]);
  if (!split) return <><span className="list-marker-label">{match[1]}</span><span className="list-description">{renderInlineSegments(inline, context)}</span></>;
  return <><span className="list-marker-label">{renderInlineSegments(split.marker, context)}</span><span className="list-description">{renderInlineSegments(split.description, context)}</span></>;
}

export function BlockContent({ block, assets, assetsBaseUrl = "/assets", aligned = false, sourceUnitId, sourceDocument }: BlockContentProps) {
  const referenceContext = sourceUnitId && sourceDocument ? { sourceUnitId, sourceDocument } : null;
  if (block.text) {
    const numberedNoteCounters = new Map<number, number>();
    const renderNoteParagraph = (paragraph: TextParagraph, index: number) => {
      const content = paragraph.inline
        ? renderInlineSegments(paragraph.inline, referenceContext)
        : renderReferenceText(paragraph.normalized, referenceContext, `${block.blockId}-paragraph-${index}`);
      if (!paragraph.listMarker) {
        numberedNoteCounters.clear();
        return <p key={`${block.blockId}-paragraph-${index}`}>{content}</p>;
      }
      const match = paragraph.normalized.match(/^\s*(\d+[.)])\s+/u);
      let marker = "–";
      if (paragraph.listMarker === "numbered") {
        const level = paragraph.listLevel ?? 0;
        const nextNumber = (numberedNoteCounters.get(level) ?? 0) + 1;
        numberedNoteCounters.set(level, nextNumber);
        marker = match?.[1] ?? `${nextNumber}.`;
      } else if (paragraph.listMarker === "bullet") {
        numberedNoteCounters.clear();
        marker = "•";
      } else {
        numberedNoteCounters.clear();
      }
      const description = match && !paragraph.inline ? renderReferenceText(paragraph.normalized.slice(match[0].length), referenceContext, `${block.blockId}-paragraph-${index}-description`) : content;
      return <div className="scv-note-list-item" data-list-level={paragraph.listLevel ?? 0} key={`${block.blockId}-paragraph-${index}`}><span className="scv-note-list-marker" aria-hidden="true">{marker}</span><span className="scv-note-list-description">{description}</span></div>;
    };
    const textBlock = (content: React.ReactNode) => block.kind === "footnote"
      ? <div className="scv-note-content"><span className="scv-note-rule" aria-hidden="true" />{block.text?.paragraphs ? block.text.paragraphs.map(renderNoteParagraph) : <p>{content}</p>}<span className="scv-note-rule" aria-hidden="true" /></div>
      : <p>{content}</p>;
    const alphabeticListContent = renderAlphabeticListContent(block, referenceContext);
    if (alphabeticListContent) return textBlock(alphabeticListContent);
    if (!block.text.inline) return textBlock(renderReferenceText(block.text.normalized, referenceContext, block.blockId));
    const inline = alphaRatioInlineWithMarker(block, sourceUnitId) ?? block.text.inline;
    const leadingLabelContent = renderLeadingLabelContent(block, referenceContext, aligned);
    if (leadingLabelContent) return aligned ? <>{leadingLabelContent}</> : textBlock(leadingLabelContent);
    return textBlock(renderInlineSegments(inline, referenceContext));
  }
  if (!block.assetId || !assets) return <p className="asset-missing">Asset non disponibile.</p>;
  const formula = assets.formulas[block.assetId];
  if (formula) return (
    <figure className="formula-asset"><div className="formula-row"><div className="formula-scroll" dangerouslySetInnerHTML={latexMarkup(formula.latex, true)} />{formula.officialNumber && <span className="formula-number"><button type="button" className="scv-permalink-trigger" data-scv-copy-link aria-label={`Copia link alla formula ${formula.officialNumber}`}>[{formula.officialNumber}]</button></span>}</div></figure>
  );
  const table = assets.tables[block.assetId];
  if (table) {
    const notes = visibleTableNotes(table);
    const caption = visibleTableCaption(table.officialNumber, table.caption);
    const captionInline = visibleTableCaptionInline(table.officialNumber, table.caption, table.captionInline);
    const numberSuffix = visibleTableNumberSuffix(table.officialNumber, table.caption);
    const label = table.officialNumber ? `Tab. ${table.officialNumber}${numberSuffix}` : table.hideLabel ? null : "Tabella non numerata";
    const compactTable = Math.max(tableColumnCount(table.headers, table.rows), tableColumnCount([], table.footerRows ?? [])) <= 4;
    const renderRows = (rows: TableCell[][], keyPrefix: string) => rows.map((row, rowIndex) => <tr key={`${keyPrefix}-${rowIndex}`}>{row.map((cell, cellIndex) => { const CellTag = cell.header === true ? "th" : "td"; return <CellTag colSpan={cell.colSpan} rowSpan={cell.rowSpan} className={tableCellClass(cell)} key={`${keyPrefix}-${rowIndex}-${cellIndex}`}><MathCell cell={cell} assetsBaseUrl={assetsBaseUrl} /></CellTag>; })}</tr>);
    return (
      <figure className={`table-asset ${tableAssetClass(table.officialNumber, table.id)}`}>
        {(label || caption) && <figcaption><button type="button" className="scv-permalink-trigger scv-caption-permalink" data-scv-copy-link aria-label={`Copia link alla tabella${table.officialNumber ? ` ${table.officialNumber}` : ""}`}>{label && <strong>{label}</strong>}{caption && <span>{label ? " — " : ""}{captionInline ? renderInlineSegments(captionInline) : caption}</span>}</button></figcaption>}
        <div className={`table-scroll ${compactTable ? "table-scroll-compact" : ""}`}><table>{table.columnWidths && <colgroup>{table.columnWidths.map((width, index) => <col style={{ width: `${width}%` }} key={`column-${index}`} />)}</colgroup>}<thead>{table.headers.map((row, rowIndex) => <tr key={`head-${rowIndex}`}>{row.map((cell, cellIndex) => { const CellTag = cell.header === false ? "td" : "th"; return <CellTag colSpan={cell.colSpan} rowSpan={cell.rowSpan} className={tableCellClass(cell)} key={`head-${rowIndex}-${cellIndex}`}><MathCell cell={cell} assetsBaseUrl={assetsBaseUrl} /></CellTag>; })}</tr>)}</thead><tbody>{renderRows(table.rows, "body")}</tbody></table>{table.footerRows && <table className="table-independent-footer">{table.footerColumnWidths && <colgroup>{table.footerColumnWidths.map((width, index) => <col style={{ width: `${width}%` }} key={`footer-column-${index}`} />)}</colgroup>}<tbody>{renderRows(table.footerRows, "footer")}</tbody></table>}</div>
        {notes.length > 0 && <div className="table-notes"><span className="scv-note-rule" aria-hidden="true" />{notes.map(({ text, inline }) => <p key={text}>{inline ? renderInlineSegments(inline) : text}</p>)}<span className="scv-note-rule" aria-hidden="true" /></div>}
      </figure>
    );
  }
  const figure = assets.figures[block.assetId];
  if (figure) {
    const width = Math.max(1, Math.round(figure.region?.width ?? 800));
    const height = Math.max(1, Math.round(figure.region?.height ?? 600));
    const displayScale = figure.displayScale ?? 1;
    const imageStyle = displayScale === 1 ? undefined : { width: `${displayScale * 100}%`, maxWidth: "none" };
    return <figure className={`figure-asset ${figureAssetClass(figure.officialNumber)} scv-copyable-asset`}><img loading="lazy" src={`${assetsBaseUrl.replace(/\/+$/u, "")}/${figure.imagePath}`} alt={figure.alt} width={width} height={height} style={imageStyle} />{figure.caption && <figcaption><button type="button" className="scv-permalink-trigger scv-caption-permalink" data-scv-copy-link aria-label={`Copia link alla figura${figure.officialNumber ? ` ${figure.officialNumber}` : ""}`}>{figure.captionInline ? renderInlineSegments(figure.captionInline) : figure.caption}</button></figcaption>}<CopyFigureButton /></figure>;
  }
  return <p className="asset-missing">Asset non risolto: {block.assetId}</p>;
}

export function AlignedLabelList({ blocks, assets, assetsBaseUrl = "/assets", sourceUnitId, sourceDocument, renderAccessory }: { blocks: CorpusBlock[]; assets: AssetBundle | null; assetsBaseUrl?: string; sourceUnitId?: string; sourceDocument?: DocumentId; renderAccessory?: (block: CorpusBlock) => React.ReactNode }) {
  const rootClass = "scv-label-list";
  const indentLevel = blocks[0]?.indentLevel ?? 0;
  return <div className={`${rootClass} ${indentLevel > 0 ? `block-indent-${indentLevel}` : ""}`}>
    {blocks.map((block) => <div tabIndex={0} className={`${rootClass}-row`} data-scv-citation-target="block" data-scv-source-unit-id={sourceUnitId} data-scv-block-id={block.blockId} key={block.blockId}>
      <div className={`${rootClass}-content`}>
        <BlockContent block={block} assets={assets} assetsBaseUrl={assetsBaseUrl} sourceUnitId={sourceUnitId} sourceDocument={sourceDocument} aligned />
      </div>
      {renderAccessory?.(block)}
    </div>)}
  </div>;
}

function comparableTitle(value: string) {
  return value.normalize("NFKC").replace(/\s+/gu, " ").trim().toLocaleLowerCase("it");
}

export function isRepeatedUnitTitle(unit: CorpusUnit, block: CorpusUnit["blocks"][number]) {
  if (unit.titleBlockId && block.blockId === unit.titleBlockId) return true;
  if (block.kind !== "heading" || !block.text) return false;
  const renderedHeading = comparableTitle(block.text.normalized);
  return renderedHeading === comparableTitle(unit.title) || renderedHeading === comparableTitle(`${unit.numbering.official} ${unit.title}`);
}
