/* eslint-disable @next/next/no-img-element */
import katex from "katex";
import type { AssetBundle, CorpusBlock, InlineSegment, TableCell, CorpusUnit } from "./corpusData";
import { visibleTableCaption, visibleTableNumberSuffix } from "./tableCaptions.mjs";

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
  /\bprima della pubblicazione\b/iu,
];

function visibleTableNotes(notes: string[]) {
  return notes.filter((note) => !editorialTableNotePatterns.some((pattern) => pattern.test(note)));
}

function tableColumnCount(headers: TableCell[][], rows: TableCell[][]) {
  return Math.max(0, ...[...headers, ...rows].map((row) => row.reduce((count, cell) => count + (cell.colSpan ?? 1), 0)));
}

function tableAssetClass(officialNumber: string | null) {
  const suffix = officialNumber?.toLowerCase().replace(/[^a-z0-9]+/gu, "-").replace(/^-|-$/gu, "");
  return suffix ? `table-asset-${suffix}` : "";
}

function latexMarkup(latex: string, displayMode: boolean) {
  return { __html: katex.renderToString(latex, { displayMode, throwOnError: false, strict: "warn", output: "html" }) };
}

function MathCell({ cell }: { cell: TableCell }) {
  if (cell.inline) return <>{renderInlineSegments(cell.inline)}</>;
  if (!cell.latex) return cell.text;
  return <span className="table-math" dangerouslySetInnerHTML={latexMarkup(cell.latex, false)} />;
}

function tableCellClass(cell: TableCell) {
  return [
    cell.strong ? "table-cell-strong" : "",
    cell.align ? `table-cell-align-${cell.align}` : "",
    cell.noWrap ? "table-cell-no-wrap" : "",
    cell.text.includes("\n") ? "table-cell-multiline" : "",
  ].filter(Boolean).join(" ") || undefined;
}

export function hasOfficialListMarker(block: CorpusBlock) {
  return block.kind === "list-item" && /^\s*(?:[–—-]|\(?[a-z0-9]+[.)])/iu.test(block.text?.normalized ?? "");
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

export function hasLeadingMath(block: CorpusBlock) {
  const inline = block.text?.inline;
  return block.kind === "list-item" && block.listMarker === "none" && inline?.[0]?.kind === "math";
}

export function hasLeadingEmphasisLabel(block: CorpusBlock) {
  const inline = block.text?.inline;
  return (block.kind === "paragraph" || block.kind === "list-item") && inline?.[0]?.kind === "em" && /^\s*:/u.test(inline[1]?.kind === "text" ? inline[1].value : "");
}

export function leadingLabelKind(block: CorpusBlock, showRaw = false): "math" | "emphasis" | null {
  if (showRaw) return null;
  if (hasLeadingMath(block)) return "math";
  if (hasLeadingEmphasisLabel(block)) return "emphasis";
  return null;
}

export type CorpusBlockGroup =
  | { kind: "label-list"; blocks: CorpusBlock[]; startIndex: number }
  | { kind: "block"; block: CorpusBlock; index: number };

export function groupAlignedLabelBlocks(blocks: CorpusBlock[], showRaw = false): CorpusBlockGroup[] {
  const groups: CorpusBlockGroup[] = [];
  let index = 0;
  while (index < blocks.length) {
    const labelKind = leadingLabelKind(blocks[index], showRaw);
    if (!labelKind) {
      groups.push({ kind: "block", block: blocks[index], index });
      index += 1;
      continue;
    }
    const startIndex = index;
    const labelBlocks = [blocks[index]];
    index += 1;
    while (index < blocks.length && leadingLabelKind(blocks[index], showRaw) === labelKind) {
      labelBlocks.push(blocks[index]);
      index += 1;
    }
    groups.push({ kind: "label-list", blocks: labelBlocks, startIndex });
  }
  return groups;
}

export function hasTrailingStrong(block: CorpusBlock) {
  const inline = block.text?.inline;
  return block.kind === "list-item" && inline !== undefined && inline.length > 0 && inline.at(-1)?.kind === "strong";
}

export function hasTrailingMath(block: CorpusBlock) {
  const inline = block.text?.inline;
  return block.kind === "list-item" && inline !== undefined && inline.length === 2 && inline.at(-1)?.kind === "math";
}

export interface BlockContentProps {
  block: CorpusBlock;
  assets: AssetBundle | null;
  showRaw?: boolean;
  assetsBaseUrl?: string;
  aligned?: boolean;
}

type InlineSegments = InlineSegment[];

function renderInlineSegments(inline: InlineSegments) {
  const nodes: Array<React.ReactNode> = [];
  inline.forEach((segment, index) => {
    if (segment.kind === "math") {
      nodes.push(<span className="inline-math" title={segment.value} key={`${segment.value}-${index}`} dangerouslySetInnerHTML={latexMarkup(segment.latex, false)} />);
      return;
    }
    if (segment.kind === "em") {
      nodes.push(<em key={`em-${index}`}>{segment.value}</em>);
      return;
    }
    if (segment.kind === "strong") {
      nodes.push(<strong key={`strong-${index}`}>{segment.value}</strong>);
      return;
    }
    const previous = inline[index - 1];
    const leading = segment.value.match(/^[,.;:!?»)\]—-]+/u)?.[0] ?? "";
    if (leading && previous?.kind === "math") {
      nodes[nodes.length - 1] = <span className="inline-keep-punct" key={`keep-${index}`}>{nodes[nodes.length - 1]}{leading}</span>;
      const rest = segment.value.slice(leading.length);
      if (rest) nodes.push(<span key={`text-${index}`}>{rest}</span>);
      return;
    }
    nodes.push(<span key={`text-${index}`}>{segment.value}</span>);
  });
  return nodes;
}

function renderLeadingLabelContent(block: CorpusBlock) {
  const inline = block.text?.inline;
  if (!inline) return null;
  if (hasLeadingEmphasisLabel(block)) {
    const label = inline[0];
    const description = inline.slice(1).map((segment, index) => index === 0 && segment.kind === "text" ? { ...segment, value: segment.value.replace(/^\s*:\s*/u, "") } : segment);
    return <><span className="leading-label">{label.kind === "em" ? <><em>{label.value}</em>:</> : label.value}</span><span className="leading-label-description">{renderInlineSegments(description)}</span></>;
  }
  if (hasLeadingMath(block)) {
    const [label, ...description] = inline;
    return <><span className="leading-math-label">{renderInlineSegments([label])}</span><span className="leading-math-description">{renderInlineSegments(description)}</span></>;
  }
  return null;
}

export function BlockContent({ block, assets, showRaw = false, assetsBaseUrl = "/assets", aligned = false }: BlockContentProps) {
  if (block.text) {
    if (showRaw || !block.text.inline) return <p>{showRaw ? block.text.raw : block.text.normalized}</p>;
    const inline = block.text.inline;
    const leadingLabelContent = renderLeadingLabelContent(block);
    if (leadingLabelContent) return aligned ? <>{leadingLabelContent}</> : <p>{leadingLabelContent}</p>;
    return <p>{renderInlineSegments(inline)}</p>;
  }
  if (!block.assetId || !assets) return <p className="asset-missing">Asset non disponibile.</p>;
  const formula = assets.formulas[block.assetId];
  if (formula) return (
    <figure className="formula-asset"><div className="formula-row"><div className="formula-scroll" dangerouslySetInnerHTML={latexMarkup(formula.latex, true)} />{formula.officialNumber && <span className="formula-number">[{formula.officialNumber}]</span>}</div></figure>
  );
  const table = assets.tables[block.assetId];
  if (table) {
    const notes = visibleTableNotes(table.notes);
    const caption = visibleTableCaption(table.officialNumber, table.caption);
    const numberSuffix = visibleTableNumberSuffix(table.officialNumber, table.caption);
    const compactTable = tableColumnCount(table.headers, table.rows) <= 4;
    return (
      <figure className={`table-asset ${tableAssetClass(table.officialNumber)}`}>
        <figcaption><strong>{table.officialNumber ? `Tab. ${table.officialNumber}${numberSuffix}` : "Tabella non numerata"}</strong>{caption && <span> — {table.captionInline ? renderInlineSegments(table.captionInline) : caption}</span>}</figcaption>
        <div className={`table-scroll ${compactTable ? "table-scroll-compact" : ""}`}><table><thead>{table.headers.map((row, rowIndex) => <tr key={`head-${rowIndex}`}>{row.map((cell, cellIndex) => <th colSpan={cell.colSpan} rowSpan={cell.rowSpan} className={tableCellClass(cell)} key={`head-${rowIndex}-${cellIndex}`}><MathCell cell={cell} /></th>)}</tr>)}</thead><tbody>{table.rows.map((row, rowIndex) => <tr key={`body-${rowIndex}`}>{row.map((cell, cellIndex) => <td colSpan={cell.colSpan} rowSpan={cell.rowSpan} className={tableCellClass(cell)} key={`body-${rowIndex}-${cellIndex}`}><MathCell cell={cell} /></td>)}</tr>)}</tbody></table></div>
        {notes.length > 0 && <ul className="table-notes">{notes.map((note) => <li key={note}>{note}</li>)}</ul>}
      </figure>
    );
  }
  const figure = assets.figures[block.assetId];
  if (figure) {
    const width = Math.max(1, Math.round(figure.region?.width ?? 800));
    const height = Math.max(1, Math.round(figure.region?.height ?? 600));
    return <figure className="figure-asset"><img loading="lazy" src={`${assetsBaseUrl.replace(/\/+$/u, "")}/${figure.imagePath}`} alt={figure.alt} width={width} height={height} /><figcaption><span>{figure.captionInline ? renderInlineSegments(figure.captionInline) : figure.caption}</span></figcaption></figure>;
  }
  return <p className="asset-missing">Asset non risolto: {block.assetId}</p>;
}

export function AlignedLabelList({ blocks, assets, assetsBaseUrl = "/assets", variant = "scv", startIndex = 0 }: { blocks: CorpusBlock[]; assets: AssetBundle | null; assetsBaseUrl?: string; variant?: "scv" | "legacy"; startIndex?: number }) {
  const rootClass = variant === "legacy" ? "label-list" : "scv-label-list";
  return <div className={rootClass}>
    {blocks.map((block, index) => <div className={`${rootClass}-row`} key={block.blockId}>
      {variant === "legacy" && <div className="block-gutter"><span>{String(startIndex + index + 1).padStart(2, "0")}</span>{block.evidence && <span title="Pagina PDF">p.{block.evidence.pdfPage}</span>}</div>}
      <div className={`${rootClass}-content`}>
        {variant === "legacy" && <span className="block-kind">{block.kind}</span>}
        <BlockContent block={block} assets={assets} assetsBaseUrl={assetsBaseUrl} aligned />
        {variant === "legacy" && block.evidence?.transformations && block.evidence.transformations.length > 0 && <details className="transformations"><summary>{block.evidence.transformations.length} trasformazioni tracciate</summary><ul>{block.evidence.transformations.map((transformation, transformationIndex) => <li key={`${transformation.operation}-${transformationIndex}`}><strong>{transformation.operation}</strong>{transformation.note}</li>)}</ul></details>}
      </div>
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

export function UnitBlocks({ unit, assets, showRaw = false, compact = false, assetsBaseUrl = "/assets" }: { unit: CorpusUnit; assets: AssetBundle; showRaw?: boolean; compact?: boolean; assetsBaseUrl?: string }) {
  const blocks = unit.blocks;
  return <div className={`normative-copy ${compact ? "normative-copy-compact" : ""}`}>
    {groupAlignedLabelBlocks(blocks, showRaw).map((group) => group.kind === "label-list"
      ? <AlignedLabelList blocks={group.blocks} assets={assets} assetsBaseUrl={assetsBaseUrl} variant="legacy" startIndex={group.startIndex} key={group.blocks[0].blockId} />
      : <section className={`text-block ${group.block.kind === "heading" ? "heading-block" : ""} ${group.block.kind === "list-item" ? "list-item-block" : ""} ${hasOfficialListMarker(group.block) ? "list-item-with-official-marker" : ""} ${hasNoListMarker(group.block) ? "list-item-without-marker" : ""} ${hasLeadingMath(group.block) && !showRaw ? "list-item-with-leading-symbol" : ""} ${hasLeadingEmphasisLabel(group.block) && !showRaw ? "block-with-leading-label" : ""} ${hasTrailingStrong(group.block) ? "list-item-with-trailing-siglum" : ""} ${hasTrailingMath(group.block) && !showRaw ? "list-item-with-trailing-symbol" : ""} ${group.block.assetId ? "asset-block" : ""}`} key={group.block.blockId}>
        <div className="block-gutter"><span>{String(group.index + 1).padStart(2, "0")}</span>{group.block.evidence && <span title="Pagina PDF">p.{group.block.evidence.pdfPage}</span>}</div>
        <div><span className="block-kind">{group.block.kind}</span><BlockContent block={group.block} assets={assets} showRaw={showRaw} assetsBaseUrl={assetsBaseUrl} />
          {group.block.evidence?.transformations && group.block.evidence.transformations.length > 0 && <details className="transformations"><summary>{group.block.evidence.transformations.length} trasformazioni tracciate</summary><ul>{group.block.evidence.transformations.map((transformation, transformationIndex) => <li key={`${transformation.operation}-${transformationIndex}`}><strong>{transformation.operation}</strong>{transformation.note}</li>)}</ul></details>}
        </div>
      </section>)}
  </div>;
}
