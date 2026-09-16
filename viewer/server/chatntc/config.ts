import "server-only";
import { DeepSeekAdapter } from "./deepseek.js";
import { OpenAIAdapter } from "./openai.js";
import { AnthropicAdapter } from "./anthropic.js";
import { GeminiAdapter } from "./gemini.js";
import { isProviderId, validModel, type ProviderSelection } from "../../app/chatntc/providerRegistry.js";
import { ChatNTCServerError } from "./errors.js";
import type { ChatNTCProvider } from "../../shared/chatntc/index.js";

export type ChatNTCEnvironment = Readonly<Record<string, string | undefined>>;

export function chatNTCEnabled(env: ChatNTCEnvironment): boolean {
  return env.CHATNTC_ENABLED === "true"
    && (env.NODE_ENV === "development" || env.NODE_ENV === "test" || env.CHATNTC_DEBUG === "true");
}

/** The only environment-to-provider boundary. Nothing here is imported by the core. */
export function configuredProvider(env: ChatNTCEnvironment, fetchImpl: typeof fetch = fetch, selection?: ProviderSelection, apiKey?: string): ChatNTCProvider {
  const id = selection?.provider ?? env.CHATNTC_PROVIDER;
  if (!isProviderId(id)) throw new ChatNTCServerError("PROVIDER_NOT_CONFIGURED");
  if (selection && !validModel(selection.model)) throw new ChatNTCServerError("INVALID_PROVIDER_CONFIG");
  const prefix = `CHATNTC_${id.toUpperCase()}`;
  const timeout = env.CHATNTC_TIMEOUT_MS ?? env[`${prefix}_TIMEOUT_MS`];
  const adapters = { deepseek: DeepSeekAdapter, openai: OpenAIAdapter, anthropic: AnthropicAdapter, gemini: GeminiAdapter };
  return new adapters[id]({ apiKey: apiKey ?? env[`${prefix}_API_KEY`] ?? "",
    model: selection?.model ?? (env[`${prefix}_MODEL`] || undefined), timeoutMs: timeout ? Number(timeout) : undefined }, fetchImpl);
}
