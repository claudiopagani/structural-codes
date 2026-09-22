import "server-only";
import type { ChatNTCSemanticRuntime } from "./semanticRuntime.js";

export interface ChatNTCHealth {
  status: "ok" | "error";
  ready: boolean;
  service: "chatntc";
  semantic: {
    mode: ChatNTCSemanticRuntime["mode"];
    ready: boolean;
    provider: ChatNTCSemanticRuntime["provider"];
  };
  error?: string;
}

export async function readChatNTCHealth(runtime: ChatNTCSemanticRuntime): Promise<ChatNTCHealth> {
  try {
    await runtime.initialize();
    return {
      status: "ok",
      ready: true,
      service: "chatntc",
      semantic: { mode: runtime.mode, ready: true, provider: runtime.provider },
    };
  } catch (error) {
    return {
      status: "error",
      ready: false,
      service: "chatntc",
      semantic: { mode: runtime.mode, ready: false, provider: runtime.provider },
      error: error instanceof Error ? error.message : "Preflight semantic non riuscito.",
    };
  }
}
