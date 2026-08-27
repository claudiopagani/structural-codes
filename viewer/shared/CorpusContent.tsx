/* eslint-disable @next/next/no-img-element */
import katex from "katex";
import type { AssetBundle, CorpusBlock, TableCell, CorpusUnit } from "./corpusData";

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

function latexMarkup(latex: string, displayMode: boolean) {
  return { __html: katex.renderToString(latex, { displayMode, throwOnError: false, strict: "warn", output: "html" }) };
}

function MathCell({ cell }: { cell: TableCell }) {
  if (!cell.latex) return cell.text;
  return <span className="table-math" dangerouslySetInnerHTML={latexMarkup(cell.latex, false)} />;
}

export function hasOfficialListMarker(block: CorpusBlock) {
  return block.kind === "list-item" && /^\s*(?:[–—-]|\(?[a-z0-9]+[.)])/iu.test(block.text?.normalized ?? "");
}

export function hasTrailingStrong(block: CorpusBlock) {
  const inline = block.text?.inline;
  return block.kind === "list-item" && inline !== undefined && inline.length > 0 && inline.at(-1)?.kind === "strong";
}

export interface BlockContentProps {
  block: CorpusBlock;
  assets: AssetBundle | null;
  showRaw?: boolean;
  assetsBaseUrl?: string;
}

export function BlockContent({ block, assets, showRaw = false, assetsBaseUrl = "/assets" }: BlockContentProps) {
  if (block.text) {
    if (showRaw || !block.text.inline) return <p>{showRaw ? block.text.raw : block.text.normalized}</p>;
    return <p>{block.text.inline.map((segment, index) => segment.kind === "math" ? (
      <span className="inline-math" title={segment.value} key={`${segment.value}-${index}`} dangerouslySetInnerHTML={latexMarkup(segment.latex, false)} />
    ) : segment.kind === "em" ? <em key={`em-${index}`}>{segment.value}</em> : segment.kind === "strong" ? <strong key={`strong-${index}`}>{segment.value}</strong> : <span key={`text-${index}`}>{segment.value}</span>)}</p>;
  }
  if (!block.assetId || !assets) return <p className="asset-missing">Asset non disponibile.</p>;
  const formula = assets.formulas[block.assetId];
  if (formula) return (
    <figure className="formula-asset"><div className="formula-row"><div className={`formula-scroll ${formula.latex.length > 52 ? "formula-scroll-long" : ""}`} dangerouslySetInnerHTML={latexMarkup(formula.latex, true)} />{formula.officialNumber && <span className="formula-number">[{formula.officialNumber}]</span>}</div>{!formula.officialNumber && <figcaption><span>Formula non numerata</span></figcaption>}</figure>
  );
  const table = assets.tables[block.assetId];
  if (table) {
    const notes = visibleTableNotes(table.notes);
    const compactTable = tableColumnCount(table.headers, table.rows) <= 4;
    return (
      <figure className="table-asset">
        <figcaption><strong>{table.officialNumber ? `Tab. ${table.officialNumber}` : "Tabella non numerata"}</strong>{table.caption && <span> — {table.caption}</span>}</figcaption>
        <div className={`table-scroll ${compactTable ? "table-scroll-compact" : ""}`}><table><thead>{table.headers.map((row, rowIndex) => <tr key={`head-${rowIndex}`}>{row.map((cell, cellIndex) => <th colSpan={cell.colSpan} rowSpan={cell.rowSpan} key={`head-${rowIndex}-${cellIndex}`}><MathCell cell={cell} /></th>)}</tr>)}</thead><tbody>{table.rows.map((row, rowIndex) => <tr key={`body-${rowIndex}`}>{row.map((cell, cellIndex) => <td colSpan={cell.colSpan} rowSpan={cell.rowSpan} key={`body-${rowIndex}-${cellIndex}`}><MathCell cell={cell} /></td>)}</tr>)}</tbody></table></div>
        {notes.length > 0 && <ul className="table-notes">{notes.map((note) => <li key={note}>{note}</li>)}</ul>}
      </figure>
    );
  }
  const figure = assets.figures[block.assetId];
  if (figure) {
    const width = Math.max(1, Math.round(figure.region?.width ?? 800));
    const height = Math.max(1, Math.round(figure.region?.height ?? 600));
    return <figure className="figure-asset"><img loading="lazy" src={`${assetsBaseUrl.replace(/\/+$/u, "")}/${figure.imagePath}`} alt={figure.alt} width={width} height={height} /><figcaption><span>{figure.caption}</span></figcaption></figure>;
  }
  return <p className="asset-missing">Asset non risolto: {block.assetId}</p>;
}

function comparableTitle(value: string) {
  return value.normalize("NFKC").replace(/\s+/gu, " ").trim().toLocaleLowerCase("it");
}

export function isRepeatedUnitTitle(unit: CorpusUnit, block: CorpusUnit["blocks"][number]) {
  if (block.kind !== "heading" || !block.text) return false;
  const renderedHeading = comparableTitle(block.text.normalized);
  return renderedHeading === comparableTitle(unit.title) || renderedHeading === comparableTitle(`${unit.numbering.official} ${unit.title}`);
}

export function UnitBlocks({ unit, assets, showRaw = false, compact = false, assetsBaseUrl = "/assets" }: { unit: CorpusUnit; assets: AssetBundle; showRaw?: boolean; compact?: boolean; assetsBaseUrl?: string }) {
  return <div className={`normative-copy ${compact ? "normative-copy-compact" : ""}`}>
    {unit.blocks.map((block, index) => <section className={`text-block ${block.kind === "heading" ? "heading-block" : ""} ${block.kind === "list-item" ? "list-item-block" : ""} ${hasOfficialListMarker(block) ? "list-item-with-official-marker" : ""} ${hasTrailingStrong(block) ? "list-item-with-trailing-siglum" : ""} ${block.assetId ? "asset-block" : ""}`} key={block.blockId}>
      <div className="block-gutter"><span>{String(index + 1).padStart(2, "0")}</span>{block.evidence && <span title="Pagina PDF">p.{block.evidence.pdfPage}</span>}</div>
      <div><span className="block-kind">{block.kind}</span><BlockContent block={block} assets={assets} showRaw={showRaw} assetsBaseUrl={assetsBaseUrl} />
        {block.evidence?.transformations && block.evidence.transformations.length > 0 && <details className="transformations"><summary>{block.evidence.transformations.length} trasformazioni tracciate</summary><ul>{block.evidence.transformations.map((transformation, transformationIndex) => <li key={`${transformation.operation}-${transformationIndex}`}><strong>{transformation.operation}</strong>{transformation.note}</li>)}</ul></details>}
      </div>
    </section>)}
  </div>;
}
