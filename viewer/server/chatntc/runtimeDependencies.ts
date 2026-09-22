import "server-only";
import type { ChatNTCShadowDiagnostics } from "./retrievalCoordinator.js";
import { configuredChatNTCSemanticRuntime } from "./semanticRuntime.js";

function reportSemanticDiagnostics(diagnostics: ChatNTCShadowDiagnostics) {
  console.info("[chatntc:semantic]", JSON.stringify({
    mode: diagnostics.mode,
    semanticStatus: diagnostics.semanticStatus,
    semanticHits: diagnostics.semanticHits.length,
    fusedHits: diagnostics.fusedHits.length,
    rrfK: diagnostics.rrfK,
    rankingApplied: diagnostics.rankingApplied,
    usedLexicalFallback: diagnostics.usedLexicalFallback,
    ...(diagnostics.fallbackReason ? { fallbackReason: diagnostics.fallbackReason } : {}),
    ...(diagnostics.failure ? { failure: diagnostics.failure } : {}),
  }));
}

/** One process-wide semantic runtime, shared by the ChatNTC and readiness routes. */
export const chatNTCSemanticRuntime = configuredChatNTCSemanticRuntime(process.env, {
  onDiagnostics: reportSemanticDiagnostics,
});
