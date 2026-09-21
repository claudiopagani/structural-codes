import type { ChatNTCEmbeddingDescription, ChatNTCEmbeddingProvider, ChatNTCEmbeddingRequestOptions } from "./semanticIndex.js";

const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);
const OLLAMA_ERROR_DETAIL_MAX_LENGTH = 400;
export const DEFAULT_OLLAMA_NUM_CTX = 8192;
const MAX_OLLAMA_NUM_CTX = 131_072;

function safeErrorDetail(value: string): string {
  const normalized = value.trim().replace(/[\u0000-\u001F\u007F]+/gu, " ").replace(/\s+/gu, " ");
  return normalized.length > OLLAMA_ERROR_DETAIL_MAX_LENGTH
    ? `${normalized.slice(0, OLLAMA_ERROR_DETAIL_MAX_LENGTH - 1)}…`
    : normalized;
}

export interface OllamaEmbeddingOptions {
  model: string;
  baseUrl?: string;
  dimensions?: number;
  numCtx?: number;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

/** Development-only adapter for Ollama's HTTP API; no Ollama package dependency. */
export class OllamaEmbeddingProvider implements ChatNTCEmbeddingProvider {
  readonly #model: string;
  readonly #baseUrl: URL;
  readonly #dimensions?: number;
  readonly #numCtx: number;
  readonly #timeoutMs: number;
  readonly #fetch: typeof fetch;
  #description?: ChatNTCEmbeddingDescription;

  constructor(options: OllamaEmbeddingOptions) {
    if (!options.model?.trim() || options.model.length > 200) throw new Error("Modello Ollama non valido.");
    const baseUrl = new URL(options.baseUrl ?? "http://127.0.0.1:11434");
    if (!["http:", "https:"].includes(baseUrl.protocol) || baseUrl.username || baseUrl.password || baseUrl.search || baseUrl.hash) {
      throw new Error("Base URL Ollama non valida.");
    }
    const timeoutMs = options.timeoutMs ?? 120_000;
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 600_000) throw new Error("Timeout Ollama non valido.");
    if (options.dimensions !== undefined && (!Number.isSafeInteger(options.dimensions) || options.dimensions < 1)) {
      throw new Error("Dimensioni Ollama non valide.");
    }
    const numCtx = options.numCtx ?? DEFAULT_OLLAMA_NUM_CTX;
    if (!Number.isSafeInteger(numCtx) || numCtx < 1 || numCtx > MAX_OLLAMA_NUM_CTX) throw new Error("numCtx Ollama non valido.");
    this.#model = options.model.trim(); this.#baseUrl = baseUrl; this.#dimensions = options.dimensions; this.#numCtx = numCtx;
    this.#timeoutMs = timeoutMs; this.#fetch = options.fetchImpl ?? fetch;
  }

  async #json(path: string, init?: RequestInit, parentSignal?: AbortSignal): Promise<unknown> {
    const timeoutSignal = AbortSignal.timeout(this.#timeoutMs);
    const signal = parentSignal ? AbortSignal.any([parentSignal, timeoutSignal]) : timeoutSignal;
    const response = await this.#fetch(new URL(path, this.#baseUrl), { ...init, signal, redirect: "error", cache: "no-store" });
    const text = await response.text();
    if (!response.ok) {
      try {
        const value: unknown = JSON.parse(text);
        const detail = object(value) && typeof value.error === "string" ? safeErrorDetail(value.error) : "";
        throw new Error(`Ollama non disponibile (HTTP ${response.status})${detail ? `: ${detail}` : "."}`);
      } catch (error) {
        if (error instanceof Error && error.message.startsWith("Ollama non disponibile (HTTP ")) throw error;
        throw new Error(`Ollama non disponibile (HTTP ${response.status}).`);
      }
    }
    if (text.length > 32_000_000) throw new Error("Risposta Ollama oltre il limite.");
    try { return JSON.parse(text); } catch { throw new Error("Risposta Ollama non valida."); }
  }

  async describe(options: ChatNTCEmbeddingRequestOptions = {}): Promise<ChatNTCEmbeddingDescription> {
    if (options.signal?.aborted) throw options.signal.reason;
    if (this.#description) return this.#description;
    const value = await this.#json("/api/tags", undefined, options.signal);
    if (!object(value) || !Array.isArray(value.models)) throw new Error("Catalogo modelli Ollama non valido.");
    const model = value.models.find((item) => object(item) && (item.name === this.#model || item.model === this.#model));
    if (!object(model)) throw new Error(`Modello Ollama non installato: ${this.#model}`);
    const digest = typeof model.digest === "string" && model.digest.trim() ? model.digest.trim() : null;
    return this.#description = { embeddingProvider: "ollama", embeddingModel: this.#model, modelVersion: null, modelDigest: digest,
      ...(this.#dimensions ? { dimensions: this.#dimensions } : {}),
      parameters: { numCtx: this.#numCtx, truncate: false, requestedDimensions: this.#dimensions ?? null } };
  }

  async embed(texts: readonly string[], options: ChatNTCEmbeddingRequestOptions = {}): Promise<readonly (readonly number[])[]> {
    if (!texts.length || texts.some((text) => typeof text !== "string" || !text)) throw new Error("Input embedding Ollama non valido.");
    const value = await this.#json("/api/embed", { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ model: this.#model, input: texts, truncate: false,
        options: { num_ctx: this.#numCtx }, ...(this.#dimensions ? { dimensions: this.#dimensions } : {}) }) }, options.signal);
    if (!object(value) || !Array.isArray(value.embeddings)
      || value.embeddings.some((vector) => !Array.isArray(vector) || vector.some((item) => typeof item !== "number"))) {
      throw new Error("Embedding Ollama non validi.");
    }
    return value.embeddings as number[][];
  }
}
