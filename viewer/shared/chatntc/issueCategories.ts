import type { ChatNTCValidationIssue } from "./types.js";

const bookkeeping = new Set([
  "untracked-reference", "duplicate-citation", "duplicate-used-evidence", "used-evidence-mismatch",
  "uncovered-claim", "uncovered-answer", "insufficient-combined-evidence", "interpretation-not-declared",
  "partial-needs-evidence", "answered-needs-evidence",
]);

export function chatNTCIssueCategory(code: string): ChatNTCValidationIssue["category"] {
  if (code === "unselected-canonical-reference") return "discovery";
  if (bookkeeping.has(code)) return "bookkeeping";
  return "integrity";
}
