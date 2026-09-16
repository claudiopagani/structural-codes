import "server-only";
import type { ChatNTCGenerationInput } from "../../shared/chatntc/index.js";
import { JsonProviderAdapter, object, malformed, prompt, type AdapterConfig } from "./protocol.js";
export const DEEPSEEK_CHAT_ENDPOINT = "https://api.deepseek.com/chat/completions";
export const DEEPSEEK_MODELS = ["deepseek-flash", "deepseek-v4-pro"] as const;
export const DEFAULT_DEEPSEEK_MODEL = "deepseek-flash";
export type DeepSeekConfig = AdapterConfig;
export class DeepSeekAdapter extends JsonProviderAdapter {
  protected readonly endpoint = DEEPSEEK_CHAT_ENDPOINT;
  constructor(config: AdapterConfig, fetchImpl: typeof fetch = fetch) { super("deepseek", config, fetchImpl); }
  protected headers(key: string) { return { authorization: `Bearer ${key}` }; }
  protected encode(input: ChatNTCGenerationInput, retry: boolean) {
    const content = prompt(input, retry);
    return { model: this.model, messages: [{ role: "system", content: content.system }, ...content.messages],
      ...(this.mode === "json-object" ? { thinking: { type: "disabled" }, response_format: { type: "json_object" }, temperature: 0 } : {}),
      stream: false, max_tokens: 8192 };
  }
  protected decode(envelope: unknown): string {
    const choices = object(envelope) && Array.isArray(envelope.choices) ? envelope.choices : [];
    const choice: unknown = choices[0];
    if (choices.length !== 1 || !object(choice) || choice.finish_reason !== "stop" || !object(choice.message)
      || choice.message.role !== "assistant" || choice.message.tool_calls != null || typeof choice.message.content !== "string" || !choice.message.content.trim()) return malformed();
    return choice.message.content;
  }
}
