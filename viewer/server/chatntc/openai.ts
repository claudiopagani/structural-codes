import "server-only";
import type { ChatNTCGenerationInput } from "../../shared/chatntc/index.js";
import { JsonProviderAdapter, object, malformed, prompt, wireSchema, type AdapterConfig } from "./protocol.js";
export class OpenAIAdapter extends JsonProviderAdapter {
  protected readonly endpoint = "https://api.openai.com/v1/responses";
  constructor(config: AdapterConfig, fetchImpl: typeof fetch = fetch) { super("openai", config, fetchImpl); }
  protected headers(key: string) { return { authorization: `Bearer ${key}` }; }
  protected encode(input: ChatNTCGenerationInput, retry: boolean) {
    const content = prompt(input, retry);
    return { model: this.model, store: false, stream: false, max_output_tokens: 16384,
      input: [{ role: "system", content: content.system }, ...content.messages],
      ...(this.mode === "json-schema" ? { text: { format: { type: "json_schema", name: "chatntc_response", strict: true, schema: wireSchema(input.outputSchema, true) } } } : {}) };
  }
  protected decode(envelope: unknown): string {
    if (!object(envelope) || envelope.status !== "completed" || !Array.isArray(envelope.output)) return malformed();
    const texts: string[] = [];
    for (const item of envelope.output) {
      if (!object(item)) return malformed();
      if (item.type === "reasoning") continue;
      if (item.type !== "message" || item.role !== "assistant" || !Array.isArray(item.content)) return malformed();
      for (const part of item.content) { if (!object(part) || part.type !== "output_text" || typeof part.text !== "string") return malformed(); texts.push(part.text); }
    }
    return texts.length ? texts.join("") : malformed();
  }
}
