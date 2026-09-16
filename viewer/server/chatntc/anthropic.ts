import "server-only";
import type { ChatNTCGenerationInput } from "../../shared/chatntc/index.js";
import { JsonProviderAdapter, object, malformed, prompt, wireSchema, type AdapterConfig } from "./protocol.js";
export class AnthropicAdapter extends JsonProviderAdapter {
  protected readonly endpoint = "https://api.anthropic.com/v1/messages";
  constructor(config: AdapterConfig, fetchImpl: typeof fetch = fetch) { super("anthropic", config, fetchImpl); }
  protected headers(key: string) { return { "x-api-key": key, "anthropic-version": "2023-06-01" }; }
  protected encode(input: ChatNTCGenerationInput, retry: boolean) {
    const content = prompt(input, retry);
    return { model: this.model, system: content.system, messages: content.messages, max_tokens: 16384, stream: false,
      ...(this.mode === "json-schema" ? { output_config: { format: { type: "json_schema", schema: wireSchema(input.outputSchema) } } } : {}) };
  }
  protected decode(envelope: unknown): string {
    if (!object(envelope) || envelope.type !== "message" || envelope.role !== "assistant" || envelope.stop_reason !== "end_turn" || !Array.isArray(envelope.content)) return malformed();
    const texts: string[] = [];
    for (const item of envelope.content) {
      if (!object(item)) return malformed();
      if (["thinking", "redacted_thinking"].includes(String(item.type))) continue;
      if (item.type !== "text" || typeof item.text !== "string") return malformed();
      texts.push(item.text);
    }
    return texts.length ? texts.join("") : malformed();
  }
}
