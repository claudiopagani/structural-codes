import "server-only";
import type { ChatNTCGenerationInput } from "../../shared/chatntc/index.js";
import { JsonProviderAdapter, object, malformed, prompt, type AdapterConfig } from "./protocol.js";

export const OPENROUTER_CHAT_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
export type OpenRouterConfig = AdapterConfig;

/**
 * Single fixed endpoint. OpenRouter exposes an OpenAI-compatible chat
 * completions API; the catalog changes weekly, so every model (listed or
 * manually typed "vendor/model" ID) runs in "prompt-json" mode with the
 * bounded retry and the shared citation validation.
 */
export class OpenRouterAdapter extends JsonProviderAdapter {
  protected readonly endpoint = OPENROUTER_CHAT_ENDPOINT;
  constructor(config: AdapterConfig, fetchImpl: typeof fetch = fetch) { super("openrouter", config, fetchImpl); }
  protected headers(key: string) { return { authorization: `Bearer ${key}` }; }
  protected encode(input: ChatNTCGenerationInput, retry: boolean) {
    const content = prompt(input, retry);
    return { model: this.model, messages: [{ role: "system", content: content.system }, ...content.messages],
      stream: false, max_tokens: 8192, temperature: 0 };
  }
  protected decode(envelope: unknown): string {
    const choices = object(envelope) && Array.isArray(envelope.choices) ? envelope.choices : [];
    const choice: unknown = choices[0];
    if (choices.length !== 1 || !object(choice) || choice.finish_reason !== "stop" || !object(choice.message)
      || choice.message.role !== "assistant" || choice.message.tool_calls != null || typeof choice.message.content !== "string" || !choice.message.content.trim()) return malformed();
    return choice.message.content;
  }
}
