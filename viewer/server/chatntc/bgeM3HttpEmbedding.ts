import type {
  ChatNTCEmbeddingDescription,
  ChatNTCEmbeddingProvider,
  ChatNTCEmbeddingRequestOptions,
} from "./semanticIndex.js";

const EXPECTED_PROVIDER = "FlagEmbedding";
const EXPECTED_MODEL = "BAAI/bge-m3";
const EXPECTED_DIMENSIONS = 1024;
const EXPECTED_MAX_LENGTH = 1024;
const MAX_RESPONSE_CHARACTERS = 32_000_000;
const MAX_BATCH_SIZE = 128;
const MAX_TIMEOUT_MS = 600_000;

export const DEFAULT_BGE_M3_HTTP_BASE_URL = "http://127.0.0.1:8091";
export const DEFAULT_BGE_M3_HTTP_TIMEOUT_MS = 120_000;
export const DEFAULT_BGE_M3_HTTP_BATCH_SIZE = 32;

type FetchImplementation = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

interface BgeM3Health {
  provider: typeof EXPECTED_PROVIDER;
  model: typeof EXPECTED_MODEL;
  dimensions: typeof EXPECTED_DIMENSIONS;
  maxLength: typeof EXPECTED_MAX_LENGTH;
  fp16: true;
  normalized: true;
  flagEmbeddingVersion: string | null;
}

export interface BgeM3HttpEmbeddingOptions {
  baseUrl?: string;
  timeoutMs?: number;
  batchSize?: number;
  fetchImpl?: FetchImplementation;
}

const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

function configuredInteger(explicit: number | undefined, environmentName: string, fallback: number): number {
  if (explicit !== undefined) return explicit;
  const environmentValue = process.env[environmentName];
  if (environmentValue === undefined || !environmentValue.trim()) return fallback;
  return Number(environmentValue);
}

function abortReason(signal: AbortSignal): unknown {
  return signal.reason ?? new DOMException("Operazione annullata.", "AbortError");
}

async function waitWithSignal<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise;
  if (signal.aborted) throw abortReason(signal);
  return new Promise<T>((resolve, reject) => {
    const aborted = () => reject(abortReason(signal));
    signal.addEventListener("abort", aborted, { once: true });
    promise.then(
      (value) => { signal.removeEventListener("abort", aborted); resolve(value); },
      (error: unknown) => { signal.removeEventListener("abort", aborted); reject(error); },
    );
  });
}

function normalizedBaseUrl(value: string): URL {
  let url: URL;
  try { url = new URL(value); } catch { throw new Error("Base URL BGE-M3 HTTP non valida."); }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new Error("Base URL BGE-M3 HTTP non valida.");
  }
  if (!url.pathname.endsWith("/")) url.pathname += "/";
  return url;
}

function runtimeVersion(value: Record<string, unknown>): string | null {
  if (!object(value.runtime)) return null;
  const version = value.runtime.flagEmbedding;
  return typeof version === "string" && version.trim() ? version.trim() : null;
}

function parseHealth(value: unknown): BgeM3Health {
  if (!object(value)) throw new Error("Health BGE-M3 HTTP non valido.");
  if (value.ready !== true || value.status !== "ok") throw new Error("Servizio BGE-M3 HTTP non pronto.");
  if (value.provider !== EXPECTED_PROVIDER) throw new Error("Provider BGE-M3 HTTP inatteso.");
  if (value.model !== EXPECTED_MODEL) throw new Error("Modello BGE-M3 HTTP inatteso.");
  if (value.dimensions !== EXPECTED_DIMENSIONS) throw new Error("Dimensioni BGE-M3 HTTP inattese.");
  if (value.normalized !== true) throw new Error("Normalizzazione BGE-M3 HTTP non compatibile.");
  if (value.maxLength !== EXPECTED_MAX_LENGTH) throw new Error("Max length BGE-M3 HTTP non compatibile.");
  if (value.fp16 !== true) throw new Error("Precisione BGE-M3 HTTP non compatibile.");
  return {
    provider: EXPECTED_PROVIDER,
    model: EXPECTED_MODEL,
    dimensions: EXPECTED_DIMENSIONS,
    maxLength: EXPECTED_MAX_LENGTH,
    fp16: true,
    normalized: true,
    flagEmbeddingVersion: runtimeVersion(value),
  };
}

function validateVectors(value: unknown, expectedCount: number): number[][] {
  if (!object(value) || value.model !== EXPECTED_MODEL || value.dimensions !== EXPECTED_DIMENSIONS
    || value.normalized !== true || value.count !== expectedCount || !Array.isArray(value.embeddings)
    || value.embeddings.length !== expectedCount) {
    throw new Error("Risposta embedding BGE-M3 HTTP non valida.");
  }
  return value.embeddings.map((candidate) => {
    if (!Array.isArray(candidate) || candidate.length !== EXPECTED_DIMENSIONS
      || candidate.some((item) => typeof item !== "number" || !Number.isFinite(item))) {
      throw new Error("Vettore BGE-M3 HTTP non valido.");
    }
    return candidate as number[];
  });
}

/** Server-side adapter for the local FlagEmbedding BGE-M3 HTTP service. */
export class BgeM3HttpEmbeddingProvider implements ChatNTCEmbeddingProvider {
  readonly #baseUrl: URL;
  readonly #timeoutMs: number;
  readonly #batchSize: number;
  readonly #fetch: FetchImplementation;
  #descriptionPromise?: Promise<ChatNTCEmbeddingDescription>;

  constructor(options: BgeM3HttpEmbeddingOptions = {}) {
    this.#baseUrl = normalizedBaseUrl(options.baseUrl
      ?? process.env.CHATNTC_EMBEDDING_URL
      ?? DEFAULT_BGE_M3_HTTP_BASE_URL);
    this.#timeoutMs = configuredInteger(options.timeoutMs, "CHATNTC_EMBEDDING_TIMEOUT_MS", DEFAULT_BGE_M3_HTTP_TIMEOUT_MS);
    this.#batchSize = configuredInteger(options.batchSize, "CHATNTC_EMBEDDING_BATCH_SIZE", DEFAULT_BGE_M3_HTTP_BATCH_SIZE);
    if (!Number.isSafeInteger(this.#timeoutMs) || this.#timeoutMs < 1 || this.#timeoutMs > MAX_TIMEOUT_MS) {
      throw new Error("Timeout BGE-M3 HTTP non valido.");
    }
    if (!Number.isSafeInteger(this.#batchSize) || this.#batchSize < 1 || this.#batchSize > MAX_BATCH_SIZE) {
      throw new Error("Batch size BGE-M3 HTTP non valido.");
    }
    this.#fetch = options.fetchImpl ?? fetch;
  }

  async #json(path: string, init?: RequestInit, parentSignal?: AbortSignal): Promise<unknown> {
    if (parentSignal?.aborted) throw abortReason(parentSignal);
    const timeoutSignal = AbortSignal.timeout(this.#timeoutMs);
    const signal = parentSignal ? AbortSignal.any([parentSignal, timeoutSignal]) : timeoutSignal;
    let response: Response;
    let text: string;
    try {
      response = await this.#fetch(new URL(path, this.#baseUrl), {
        ...init,
        signal,
        redirect: "error",
        cache: "no-store",
      });
      text = await response.text();
    } catch (error) {
      if (parentSignal?.aborted) throw abortReason(parentSignal);
      if (timeoutSignal.aborted) throw new Error(`Timeout BGE-M3 HTTP dopo ${this.#timeoutMs} ms.`, { cause: error });
      throw new Error("Servizio BGE-M3 HTTP non disponibile.", { cause: error });
    }
    if (!response.ok) throw new Error(`Servizio BGE-M3 HTTP non disponibile (HTTP ${response.status}).`);
    if (text.length > MAX_RESPONSE_CHARACTERS) throw new Error("Risposta BGE-M3 HTTP oltre il limite.");
    try { return JSON.parse(text); } catch { throw new Error("Risposta BGE-M3 HTTP non valida."); }
  }

  async #loadDescription(): Promise<ChatNTCEmbeddingDescription> {
    const health = parseHealth(await this.#json("health"));
    const parameters = Object.freeze({
      denseOnly: true,
      normalization: "l2",
      maxLength: health.maxLength,
      fp16: health.fp16,
      inputTypes: "query,document",
      flagEmbeddingVersion: health.flagEmbeddingVersion,
    });
    return Object.freeze({
      embeddingProvider: "flagembedding-http",
      embeddingModel: health.model,
      modelVersion: null,
      modelDigest: null,
      dimensions: health.dimensions,
      parameters,
    });
  }

  async describe(options: ChatNTCEmbeddingRequestOptions = {}): Promise<ChatNTCEmbeddingDescription> {
    if (options.signal?.aborted) throw abortReason(options.signal);
    if (!this.#descriptionPromise) {
      this.#descriptionPromise = this.#loadDescription().catch((error: unknown) => {
        this.#descriptionPromise = undefined;
        throw error;
      });
    }
    return waitWithSignal(this.#descriptionPromise, options.signal);
  }

  async embed(texts: readonly string[], options: ChatNTCEmbeddingRequestOptions = {}): Promise<readonly (readonly number[])[]> {
    if (!texts.length || texts.some((text) => typeof text !== "string" || !text)) {
      throw new Error("Input embedding BGE-M3 HTTP non valido.");
    }
    if (options.signal?.aborted) throw abortReason(options.signal);
    await this.describe({ signal: options.signal });
    const inputType = options.inputType ?? "document";
    const embeddings: number[][] = [];
    for (let offset = 0; offset < texts.length; offset += this.#batchSize) {
      if (options.signal?.aborted) throw abortReason(options.signal);
      const batch = texts.slice(offset, offset + this.#batchSize);
      const value = await this.#json("embed", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ texts: batch, inputType }),
      }, options.signal);
      embeddings.push(...validateVectors(value, batch.length));
    }
    return embeddings;
  }
}
