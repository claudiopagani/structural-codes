/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState } from "react";
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

type CopyAssetKind = "formula" | "figure";
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

function stylesheetText() {
  return [...document.styleSheets].flatMap((sheet) => {
    try {
      return [...sheet.cssRules].map((rule) => rule.cssText);
    } catch {
      return [];
    }
  }).join("\n");
}

function escapeXml(value: string) {
  return value.replace(/&/gu, "&amp;").replace(/"/gu, "&quot;").replace(/</gu, "&lt;").replace(/>/gu, "&gt;");
}

function formulaSvg(element: HTMLElement) {
  const bounds = element.getBoundingClientRect();
  const width = Math.max(1, Math.ceil(element.scrollWidth || bounds.width));
  const height = Math.max(1, Math.ceil(element.scrollHeight || bounds.height));
  const computed = getComputedStyle(element);
  const color = escapeXml(computed.color || "#202733");
  const fontSize = escapeXml(computed.fontSize || "15px");
  // CSS lives inside XML text in the foreignObject. Escaping it is essential:
  // a media query or generated rule containing '<' otherwise makes the SVG
  // invalid and the browser reports the copy operation as a generic error.
  const rules = stylesheetText().replace(/&/gu, "&amp;").replace(/</gu, "&lt;").replace(/>/gu, "&gt;");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><foreignObject width="100%" height="100%"><div xmlns="http://www.w3.org/1999/xhtml" class="scv-root scv-copy-formula" style="display:flex;align-items:center;justify-content:center;width:${width}px;height:${height}px;overflow:visible;color:${color};font-size:${fontSize};background:#fff;"><style>${rules}</style><div class="formula-scroll">${element.innerHTML}</div></div></foreignObject></svg>`;
}

async function formulaImageBlob(element: HTMLElement) {
  const svg = formulaSvg(element);
  const source = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  try {
    const image = new Image();
    image.decoding = "async";
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Impossibile rasterizzare la formula."));
      image.src = source;
    });
    const scale = Math.min(3, Math.max(1, window.devicePixelRatio || 1));
    const width = Math.max(1, Math.ceil(element.scrollWidth || element.getBoundingClientRect().width));
    const height = Math.max(1, Math.ceil(element.scrollHeight || element.getBoundingClientRect().height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(width * scale);
    canvas.height = Math.ceil(height * scale);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas non disponibile.");
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Impossibile creare l'immagine della formula.")), "image/png");
    });
  } finally {
    URL.revokeObjectURL(source);
  }
}

async function writeFormulaToClipboard(element: HTMLElement) {
  const svg = formulaSvg(element);
  if (!copyableImageClipboard()) throw new Error("Il browser non supporta la copia di immagini negli appunti.");
  try {
    // SVG is already an image and avoids the foreignObject -> canvas step in browsers
    // that deliberately block rasterization of HTML embedded in SVG.
    await navigator.clipboard.write([new ClipboardItem({
      "image/svg+xml": new Blob([svg], { type: "image/svg+xml" }),
    })]);
    return;
  } catch {
    // Fall through to PNG for clipboard consumers that do not accept SVG.
  }
  // Keep the promise inside ClipboardItem: Chromium can reject a write if the
  // rasterization is awaited before Clipboard.write consumes the click gesture.
  await writeImageToClipboard(formulaImageBlob(element));
}

async function copyFormulaMarkupAsImage(svg: string) {
  const container = document.createElement("div");
  const image = document.createElement("img");
  const selection = window.getSelection();
  const previousRange = selection?.rangeCount ? selection.getRangeAt(0).cloneRange() : null;
  container.contentEditable = "true";
  container.style.cssText = "position:fixed;left:-10000px;top:-10000px;width:max-content;height:max-content;opacity:0.01;";
  image.alt = "Formula";
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  container.append(image);
  document.body.append(container);
  try {
    await new Promise<void>((resolve, reject) => {
      if (image.complete) {
        resolve();
        return;
      }
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Impossibile preparare la formula per la copia."));
    });
    container.focus();
    const range = document.createRange();
    range.selectNode(image);
    selection?.removeAllRanges();
    selection?.addRange(range);
    const copied = document.execCommand("copy");
    if (!copied) throw new Error("Il browser non ha consentito la copia alternativa della formula.");
  } finally {
    selection?.removeAllRanges();
    if (previousRange) selection?.addRange(previousRange);
    container.remove();
  }
}

function CopyAssetButton({ kind }: { kind: CopyAssetKind }) {
  const [status, setStatus] = useState<CopyStatus>("idle");
  const resetTimer = useRef<number | null>(null);
  useEffect(() => () => {
    if (resetTimer.current !== null) window.clearTimeout(resetTimer.current);
  }, []);

  async function copyAsset(event: React.MouseEvent<HTMLButtonElement>) {
    const asset = event.currentTarget.closest<HTMLElement>(".scv-copyable-asset");
    const target = kind === "figure" ? asset?.querySelector<HTMLImageElement>("img") : asset?.querySelector<HTMLElement>(".formula-scroll");
    if (!target) return;
    try {
      try {
        if (kind === "figure") await writeImageToClipboard(figureImageBlob(target as HTMLImageElement));
        else await writeFormulaToClipboard(target);
      } catch (error) {
        if (kind !== "formula") throw error;
        await copyFormulaMarkupAsImage(formulaSvg(target));
      }
      setStatus("copied");
      if (resetTimer.current !== null) window.clearTimeout(resetTimer.current);
      resetTimer.current = window.setTimeout(() => setStatus("idle"), 1700);
    } catch {
      setStatus("error");
      if (resetTimer.current !== null) window.clearTimeout(resetTimer.current);
      resetTimer.current = window.setTimeout(() => setStatus("idle"), 2200);
    }
  }

  const label = kind === "figure" ? "Copia immagine" : "Copia formula come immagine";
  return <button type="button" className={`scv-copy-asset scv-copy-asset-${status}`} onClick={(event) => void copyAsset(event)} aria-label={label} title={label}>{status === "copied" ? "✓" : status === "error" ? "!" : "⧉"}</button>;
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

export function hasAlphabeticListMarker(block: CorpusBlock) {
  return block.kind === "list-item" && /^\s*\(?[a-z]+[.)]/iu.test(block.text?.normalized ?? "");
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

export function hasLeadingEmphasisLabel(block: CorpusBlock) {
  const inline = block.text?.inline;
  return (
    (block.kind === "paragraph" || (block.kind === "list-item" && block.listMarker === "none")) &&
    inline?.[0]?.kind === "em" &&
    /^\s*:/u.test(inline[1]?.kind === "text" ? inline[1].value : "")
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
    index += 1;
    while (index < blocks.length && leadingLabelKind(blocks[index]) === labelKind) {
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
  return block.kind === "list-item" && inline !== undefined && inline.length === 2 && inline.at(-1)?.kind === "math";
}

export interface BlockContentProps {
  block: CorpusBlock;
  assets: AssetBundle | null;
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

function renderAlphabeticListContent(block: CorpusBlock) {
  if (!hasAlphabeticListMarker(block)) return null;
  const inline = block.text?.inline;
  const normalized = block.text?.normalized;
  const first = inline?.[0];
  const source = first?.kind === "text" ? first.value : normalized;
  if (!source) return null;
  const match = source.match(/^(\s*\(?[a-z]+[.)])\s*/iu);
  if (!match) return null;
  if (!inline || first?.kind !== "text") {
    return <><span className="list-marker-label">{match[1]}</span><span className="list-description">{normalized?.slice(match[0].length)}</span></>;
  }
  const description = [{ ...first, value: first.value.slice(match[0].length) }, ...inline.slice(1)];
  return <><span className="list-marker-label">{match[1]}</span><span className="list-description">{renderInlineSegments(description)}</span></>;
}

export function BlockContent({ block, assets, assetsBaseUrl = "/assets", aligned = false }: BlockContentProps) {
  if (block.text) {
    const alphabeticListContent = renderAlphabeticListContent(block);
    if (alphabeticListContent) return <p>{alphabeticListContent}</p>;
    if (!block.text.inline) return <p>{block.text.normalized}</p>;
    const inline = block.text.inline;
    const leadingLabelContent = renderLeadingLabelContent(block);
    if (leadingLabelContent) return aligned ? <>{leadingLabelContent}</> : <p>{leadingLabelContent}</p>;
    return <p>{renderInlineSegments(inline)}</p>;
  }
  if (!block.assetId || !assets) return <p className="asset-missing">Asset non disponibile.</p>;
  const formula = assets.formulas[block.assetId];
  if (formula) return (
    <figure className="formula-asset scv-copyable-asset"><div className="formula-row"><div className="formula-scroll" dangerouslySetInnerHTML={latexMarkup(formula.latex, true)} />{formula.officialNumber && <span className="formula-number">[{formula.officialNumber}]</span>}</div><CopyAssetButton kind="formula" /></figure>
  );
  const table = assets.tables[block.assetId];
  if (table) {
    const notes = visibleTableNotes(table.notes);
    const caption = visibleTableCaption(table.officialNumber, table.caption);
    const numberSuffix = visibleTableNumberSuffix(table.officialNumber, table.caption);
    const label = table.officialNumber ? `Tab. ${table.officialNumber}${numberSuffix}` : table.hideLabel ? null : "Tabella non numerata";
    const compactTable = tableColumnCount(table.headers, table.rows) <= 4;
    return (
      <figure className={`table-asset ${tableAssetClass(table.officialNumber)}`}>
        {(label || caption) && <figcaption>{label && <strong>{label}</strong>}{caption && <span>{label ? " — " : ""}{table.captionInline ? renderInlineSegments(table.captionInline) : caption}</span>}</figcaption>}
        <div className={`table-scroll ${compactTable ? "table-scroll-compact" : ""}`}><table><thead>{table.headers.map((row, rowIndex) => <tr key={`head-${rowIndex}`}>{row.map((cell, cellIndex) => <th colSpan={cell.colSpan} rowSpan={cell.rowSpan} className={tableCellClass(cell)} key={`head-${rowIndex}-${cellIndex}`}><MathCell cell={cell} /></th>)}</tr>)}</thead><tbody>{table.rows.map((row, rowIndex) => <tr key={`body-${rowIndex}`}>{row.map((cell, cellIndex) => <td colSpan={cell.colSpan} rowSpan={cell.rowSpan} className={tableCellClass(cell)} key={`body-${rowIndex}-${cellIndex}`}><MathCell cell={cell} /></td>)}</tr>)}</tbody></table></div>
        {notes.length > 0 && <ul className="table-notes">{notes.map((note) => <li key={note}>{note}</li>)}</ul>}
      </figure>
    );
  }
  const figure = assets.figures[block.assetId];
  if (figure) {
    const width = Math.max(1, Math.round(figure.region?.width ?? 800));
    const height = Math.max(1, Math.round(figure.region?.height ?? 600));
    return <figure className="figure-asset scv-copyable-asset"><img loading="lazy" src={`${assetsBaseUrl.replace(/\/+$/u, "")}/${figure.imagePath}`} alt={figure.alt} width={width} height={height} /><figcaption><span>{figure.captionInline ? renderInlineSegments(figure.captionInline) : figure.caption}</span></figcaption><CopyAssetButton kind="figure" /></figure>;
  }
  return <p className="asset-missing">Asset non risolto: {block.assetId}</p>;
}

export function AlignedLabelList({ blocks, assets, assetsBaseUrl = "/assets" }: { blocks: CorpusBlock[]; assets: AssetBundle | null; assetsBaseUrl?: string }) {
  const rootClass = "scv-label-list";
  return <div className={rootClass}>
    {blocks.map((block) => <div className={`${rootClass}-row`} key={block.blockId}>
      <div className={`${rootClass}-content`}>
        <BlockContent block={block} assets={assets} assetsBaseUrl={assetsBaseUrl} aligned />
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
