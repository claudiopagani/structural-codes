import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";

export interface ChatNTCMarkdownProps {
  markdown: string;
}

/**
 * Controlled Markdown surface for model output.
 * Raw HTML is deliberately skipped; URLs retain react-markdown's safe transform.
 */
export function ChatNTCMarkdown({ markdown }: ChatNTCMarkdownProps) {
  return <div className="scv-chat-markdown">
    <ReactMarkdown
      skipHtml
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[[rehypeKatex, { throwOnError: false, strict: "warn", trust: false }]]}
    >{markdown}</ReactMarkdown>
  </div>;
}
