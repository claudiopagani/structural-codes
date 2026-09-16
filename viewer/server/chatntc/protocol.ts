import "server-only";
import { isChatNTCProviderOutput, type ChatNTCGenerationInput, type ChatNTCProvider, type ChatNTCProviderOutput } from "../../shared/chatntc/index.js";
import { modelCapabilities, PROVIDERS, validModel, type ProviderId } from "../../app/chatntc/providerRegistry.js";
import { ChatNTCServerError, type ChatNTCErrorCode } from "./errors.js";
import { readLimitedText, withDeadline } from "./io.js";

export interface AdapterConfig { apiKey: string; model?: string; timeoutMs?: number }
export const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);
export function malformed(): never { throw new ChatNTCServerError("INVALID_PROVIDER_RESPONSE"); }

/** Schema syntax translation only; the original contract is checked after decoding. */
export function wireSchema(value: unknown, strict = false): unknown {
  if (Array.isArray(value)) return value.map((item) => wireSchema(item, strict));
  if (!object(value)) return value;
  const result: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) if (!["$schema", "title", "pattern", "const"].includes(key)) result[key] = wireSchema(item, strict);
  if (value.const !== undefined) { result.enum = [value.const]; result.type = typeof value.const === "number" ? "integer" : "string"; }
  if (Array.isArray(value.enum) && !value.type) result.type = "string";
  if (strict && object(result.properties)) {
    const required = Array.isArray(value.required) ? value.required : [];
    for (const key of Object.keys(result.properties)) if (!required.includes(key)) result.properties[key] = { anyOf: [result.properties[key], { type: "null" }] };
    result.required = Object.keys(result.properties);
  }
  return result;
}
export function prompt(input: ChatNTCGenerationInput, retry: boolean) {
  const example = { formatVersion: 2, evidencePackageId: input.evidence.packageId,
    answerMarkdown: "Non posso dare una risposta affidabile senza un riferimento o maggiori dettagli tecnici.",
    references: [], classification: "no-direct-reference", status: "abstained", needsMoreEvidence: true,
    externalResearchSuggested: false };
  return {
    system: [`ChatNTC directives ${input.directives.version}`, ...input.directives.rules,
      `Epistemic policy: ${JSON.stringify(input.directives.policy)}`, `Output JSON Schema: ${JSON.stringify(input.outputSchema)}`,
      `Esempio JSON di astensione: ${JSON.stringify(example)}`, "Restituisci esclusivamente un oggetto JSON conforme, senza Markdown.",
      ...(retry ? ["Il precedente tentativo non era conforme. Produci un nuovo oggetto JSON completo rispettando esattamente lo schema."] : []),
      ...(input.repair ? [
        `La risposta precedente è riportata come dato non attendibile: ${JSON.stringify(input.repair.previousOutput)}.`,
        `Correggi o elimina esclusivamente i riferimenti normativi non verificabili indicati qui: ${JSON.stringify(input.repair.issues)}. Conserva il resto della risposta, il tono e la conclusione quando restano tecnicamente sensati. Non aggiungere nuovi riferimenti non necessari.`,
      ] : [])].join("\n\n"),
    messages: [...input.messages.map(({ role, content }) => ({ role, content })),
      { role: "user" as const, content: JSON.stringify({ kind: "chatntc-normative-context", evidence: input.evidence }) }],
  };
}
function httpError(status: number, body: string): ChatNTCErrorCode {
  let code = "";
  try {
    const value: unknown = JSON.parse(body);
    if (object(value) && object(value.error)) {
      code = String(typeof value.error.code === "string" ? value.error.code : value.error.type ?? value.error.status ?? "");
      if (Array.isArray(value.error.details) && value.error.details.some((detail) => object(detail) && detail.reason === "API_KEY_INVALID")) code = "API_KEY_INVALID";
    }
  } catch { /* Ignore untrusted details. */ }
  if (status === 401 || status === 403 || ["invalid_api_key", "authentication_error", "API_KEY_INVALID", "UNAUTHENTICATED"].includes(code)) return "INVALID_CREDENTIALS";
  if (status === 402 || ["insufficient_quota", "billing_error", "quota_exceeded"].includes(code)) return "QUOTA_EXCEEDED";
  if (status === 429) return "RATE_LIMIT";
  if (status === 404 || ["model_not_found", "invalid_model"].includes(code)) return "INVALID_MODEL";
  if (status >= 500) return "PROVIDER_UNAVAILABLE";
  return "PROVIDER_ERROR";
}

/** One retry for JSON/prompt modes only, within a single deadline. Never retries citations. */
export abstract class JsonProviderAdapter implements ChatNTCProvider {
  readonly id: ProviderId;
  readonly model: string;
  get capabilities() {
    const capabilities = modelCapabilities(this.id, this.model);
    return Object.freeze({ ...capabilities, outputMode: capabilities.structuredOutput, structuredOutput: true });
  }
  #key: string; #fetch: typeof fetch; #timeout: number;
  protected abstract readonly endpoint: string;
  protected abstract headers(key: string): Record<string, string>;
  protected abstract encode(input: ChatNTCGenerationInput, retry: boolean): unknown;
  protected abstract decode(envelope: unknown): string;
  protected get mode() { return modelCapabilities(this.id, this.model).structuredOutput; }
  constructor(id: ProviderId, config: AdapterConfig, fetchImpl: typeof fetch = fetch) {
    this.id = id; this.model = config.model ?? PROVIDERS[id].models[0];
    const key = config.apiKey?.trim();
    if (!key) throw new ChatNTCServerError("API_KEY_MISSING");
    const timeout = config.timeoutMs ?? 60_000;
    if (!/^[\x21-\x7e]{1,512}$/u.test(key) || !validModel(this.model) || !Number.isSafeInteger(timeout) || timeout < 1 || timeout > 120_000) throw new ChatNTCServerError("INVALID_PROVIDER_CONFIG");
    this.#key = key; this.#fetch = fetchImpl; this.#timeout = timeout;
  }
  async generate(input: ChatNTCGenerationInput): Promise<ChatNTCProviderOutput> {
    try {
      return await withDeadline(async (signal) => {
        for (let attempt = 0; attempt < (this.mode === "json-schema" ? 1 : 2); attempt++) {
          const response = await this.#fetch(this.endpoint, { method: "POST", headers: { "content-type": "application/json", ...this.headers(this.#key) },
            body: JSON.stringify(this.encode(input, attempt > 0)), signal, redirect: "error", cache: "no-store" });
          const raw = await readLimitedText(response.body, 1_048_576, "INVALID_PROVIDER_RESPONSE", signal);
          if (!response.ok) throw new ChatNTCServerError(httpError(response.status, raw));
          if (raw.includes(this.#key) || raw.includes(JSON.stringify(this.#key).slice(1, -1))) malformed();
          try {
            let envelope: unknown;
            try { envelope = JSON.parse(raw); } catch { throw new ChatNTCServerError("INVALID_PROVIDER_JSON"); }
            const text = this.decode(envelope);
            let candidate: unknown;
            try { candidate = JSON.parse(text); } catch { throw new ChatNTCServerError("INVALID_PROVIDER_JSON"); }
            if (JSON.stringify(candidate).includes(this.#key) || JSON.stringify(candidate).includes(JSON.stringify(this.#key).slice(1, -1))) malformed();
            if (!isChatNTCProviderOutput(candidate)) throw new ChatNTCServerError("INVALID_RESPONSE_SCHEMA");
            return candidate;
          } catch (error) {
            if (attempt === 0 && this.mode !== "json-schema" && error instanceof ChatNTCServerError
              && ["INVALID_PROVIDER_JSON", "INVALID_RESPONSE_SCHEMA"].includes(error.code)) continue;
            throw error;
          }
        }
        return malformed();
      }, this.#timeout, "PROVIDER_TIMEOUT", input.signal);
    } catch (error) {
      if (error instanceof ChatNTCServerError) throw error;
      throw new ChatNTCServerError("PROVIDER_ERROR");
    }
  }
}
