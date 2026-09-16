import type { ComponentPropsWithoutRef } from "react";
import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import { findCrossReferences } from "../crossReferences.js";
import { viewerTargetForCitation } from "../chatntc/evidence.js";
import type { ChatNTCReference } from "../chatntc/types.js";
import type { ViewerTarget } from "../permalinks.js";

export interface ChatNTCMarkdownProps {
  markdown: string;
  references?: readonly ChatNTCReference[];
  hrefForTarget?: (target: ViewerTarget) => string;
  onNavigate?: (target: ViewerTarget) => void | Promise<void>;
  onNavigationError?: () => void;
}

interface MarkdownNode {
  type: string;
  value?: string;
  url?: string;
  children?: MarkdownNode[];
  data?: { hProperties?: Record<string, unknown> };
}

interface FoundReference {
  start: number;
  end: number;
  kind: "unit" | "formula" | "table" | "figure";
  number: string;
  documentHint: "ntc2018" | "circ2019" | null;
}

interface ReferenceLink {
  reference: ChatNTCReference;
  target: ViewerTarget;
  href: string;
}

const skippedNodeTypes = new Set(["code", "inlineCode", "inlineMath", "link", "linkReference", "math"]);
const normalizedNumber = (value: string) => value.replace(/^C\.?/iu, "").replace(/[.\s]+$/gu, "").toUpperCase();

function referenceKind(reference: ChatNTCReference) {
  if ("kind" in reference) return reference.kind;
  if (reference.assetId?.includes(":formula:")) return "formula";
  if (reference.assetId?.includes(":table:")) return "table";
  if (reference.assetId?.includes(":figure:")) return "figure";
  return reference.blockId ? "block" : "unit";
}

function documentMention(value: string, start: number) {
  const prefix = value.slice(Math.max(0, start - 28), start);
  if (/(?:Circolare(?:\s+7\/2019)?|Circ\.)\s*$/iu.test(prefix)) return "circ2019";
  if (/NTC(?:\s+2018)?\s*$/iu.test(prefix)) return "ntc2018";
  return null;
}

function matchingLink(found: FoundReference, value: string, links: readonly ReferenceLink[]) {
  const document = found.documentHint ?? documentMention(value, found.start);
  let candidates = links.filter(({ reference }) => {
    const kind = referenceKind(reference);
    const sameKind = found.kind === "unit" ? kind === "unit" || kind === "block" : kind === found.kind;
    const number = found.kind === "unit" ? reference.numbering : reference.assetNumber;
    return sameKind && typeof number === "string" && normalizedNumber(number) === found.number
      && (!document || reference.document === document);
  });
  if (found.kind === "unit" && candidates.some(({ reference }) => referenceKind(reference) === "unit")) {
    candidates = candidates.filter(({ reference }) => referenceKind(reference) === "unit");
  }
  const targets = new Set(candidates.map(({ target }) => JSON.stringify(target)));
  return targets.size === 1 ? candidates[0] : undefined;
}

function linkifyText(node: MarkdownNode, links: readonly ReferenceLink[]) {
  const value = node.value ?? "";
  const replacements = (findCrossReferences(value) as FoundReference[])
    .map((found) => ({ found, link: matchingLink(found, value, links) }))
    .filter((item): item is { found: FoundReference; link: ReferenceLink } => Boolean(item.link));
  if (!replacements.length) return [node];
  const nodes: MarkdownNode[] = [];
  let cursor = 0;
  for (const { found, link } of replacements) {
    if (found.start > cursor) nodes.push({ type: "text", value: value.slice(cursor, found.start) });
    nodes.push({ type: "link", url: link.href, data: { hProperties: { className: "scv-chat-reference-link" } },
      children: [{ type: "text", value: value.slice(found.start, found.end) }] });
    cursor = found.end;
  }
  if (cursor < value.length) nodes.push({ type: "text", value: value.slice(cursor) });
  return nodes;
}

function remarkVerifiedReferences({ links }: { links: readonly ReferenceLink[] }) {
  return (tree: MarkdownNode) => {
    function visit(node: MarkdownNode) {
      if (!node.children || skippedNodeTypes.has(node.type)) return;
      node.children = node.children.flatMap((child) => child.type === "text" ? linkifyText(child, links) : (visit(child), [child]));
    }
    visit(tree);
  };
}

/**
 * Controlled Markdown surface for model output.
 * Raw HTML is deliberately skipped; URLs retain react-markdown's safe transform.
 */
export function ChatNTCMarkdown({ markdown, references = [], hrefForTarget, onNavigate, onNavigationError }: ChatNTCMarkdownProps) {
  const links = hrefForTarget ? references.map((reference) => {
    const target = viewerTargetForCitation(reference);
    return { reference, target, href: hrefForTarget(target) };
  }) : [];
  const targetByHref = new Map(links.map((link) => [link.href, link.target]));
  const components = {
    a({ href, ...props }: ComponentPropsWithoutRef<"a">) {
      const target = href ? targetByHref.get(href) : undefined;
      return <a {...props} href={href} onClick={target && onNavigate ? (event) => {
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        void Promise.resolve().then(() => onNavigate(target)).catch(() => onNavigationError?.());
      } : undefined} />;
    },
  };
  return <div className="scv-chat-markdown">
    <ReactMarkdown
      skipHtml
      components={components}
      remarkPlugins={[remarkGfm, remarkMath, [remarkVerifiedReferences, { links }]]}
      rehypePlugins={[[rehypeKatex, { throwOnError: false, strict: "warn", trust: false }]]}
    >{markdown}</ReactMarkdown>
  </div>;
}
