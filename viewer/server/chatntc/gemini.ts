import "server-only";
import type { ChatNTCGenerationInput } from "../../shared/chatntc/index.js";
import { JsonProviderAdapter, object, malformed, prompt, wireSchema, type AdapterConfig } from "./protocol.js";
export class GeminiAdapter extends JsonProviderAdapter {
  protected get endpoint() { return `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(this.model)}:generateContent`; }
  constructor(config: AdapterConfig, fetchImpl: typeof fetch = fetch) { super("gemini", config, fetchImpl); }
  protected headers(key: string) { return { "x-goog-api-key": key }; }
  protected encode(input: ChatNTCGenerationInput, retry: boolean) {
    const content = prompt(input, retry);
    return { systemInstruction: { parts: [{ text: content.system }] },
      contents: content.messages.map((message) => ({ role: message.role === "assistant" ? "model" : "user", parts: [{ text: message.content }] })),
      generationConfig: { maxOutputTokens: 16384, candidateCount: 1,
        ...(this.mode === "json-schema" ? { responseFormat: { text: { mimeType: "application/json", schema: wireSchema(input.outputSchema) } } } : {}) } };
  }
  protected decode(envelope: unknown): string {
    const candidates = object(envelope) && Array.isArray(envelope.candidates) ? envelope.candidates : [];
    const candidate: unknown = candidates[0];
    if (candidates.length !== 1 || !object(candidate) || candidate.finishReason !== "STOP" || !object(candidate.content) || !Array.isArray(candidate.content.parts)) return malformed();
    const texts: string[] = [];
    for (const part of candidate.content.parts) {
      if (!object(part) || part.functionCall !== undefined) return malformed();
      if (part.thought === true) continue;
      if (typeof part.text !== "string") return malformed();
      texts.push(part.text);
    }
    return texts.length ? texts.join("") : malformed();
  }
}
