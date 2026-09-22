import { BgeM3HttpEmbeddingProvider } from "./bgeM3HttpEmbedding.js";
import { OllamaEmbeddingProvider } from "./ollamaEmbedding.js";
import type { ChatNTCEmbeddingDescription, ChatNTCEmbeddingProvider } from "./semanticIndex.js";

export type ChatNTCEmbeddingProviderId = "ollama" | "flagembedding-http";

export interface ChatNTCEmbeddingProviderOptions {
  provider: ChatNTCEmbeddingProviderId;
  model?: string;
  baseUrl?: string;
  timeoutMs?: number;
  batchSize?: number;
  dimensions?: number;
  numCtx?: number;
  fetchImpl?: typeof fetch;
}

export interface ChatNTCEmbeddingIndexIdentity {
  embeddingProvider: string;
  embeddingModel: string;
  modelVersion: string | null;
  modelDigest: string | null;
  dimensions: number;
  normalization: string;
  parameters: Readonly<Record<string, string | number | boolean | null>>;
}

export function parseChatNTCEmbeddingProvider(value: string | undefined,
  fallback: ChatNTCEmbeddingProviderId): ChatNTCEmbeddingProviderId {
  const provider = value ?? fallback;
  if (provider !== "ollama" && provider !== "flagembedding-http") {
    throw new Error(`Provider embedding non supportato: ${provider}.`);
  }
  return provider;
}

export function createChatNTCEmbeddingProvider(options: ChatNTCEmbeddingProviderOptions): ChatNTCEmbeddingProvider {
  if (options.provider === "flagembedding-http") {
    return new BgeM3HttpEmbeddingProvider({
      baseUrl: options.baseUrl,
      timeoutMs: options.timeoutMs,
      batchSize: options.batchSize,
      fetchImpl: options.fetchImpl,
    });
  }
  if (!options.model?.trim()) throw new Error("Il modello Ollama deve essere configurato esplicitamente.");
  return new OllamaEmbeddingProvider({
    model: options.model,
    baseUrl: options.baseUrl,
    timeoutMs: options.timeoutMs,
    dimensions: options.dimensions,
    numCtx: options.numCtx,
    fetchImpl: options.fetchImpl,
  });
}

function stableParameters(value: Readonly<Record<string, string | number | boolean | null>>) {
  return JSON.stringify(Object.entries(value).sort(([left], [right]) => left.localeCompare(right, "en")));
}

export function assertChatNTCEmbeddingCompatibility(
  description: ChatNTCEmbeddingDescription,
  index: ChatNTCEmbeddingIndexIdentity,
): void {
  if (description.embeddingProvider.trim() !== index.embeddingProvider
    || description.embeddingModel.trim() !== index.embeddingModel) {
    throw new Error(`Provider/modello non compatibile con l'indice: indice=${index.embeddingProvider}/${index.embeddingModel}, `
      + `runtime=${description.embeddingProvider}/${description.embeddingModel}.`);
  }
  if ((description.modelVersion?.trim() || null) !== index.modelVersion
    || (description.modelDigest?.trim() || null) !== index.modelDigest) {
    throw new Error("Versione o digest del modello non compatibile con l'indice.");
  }
  if (description.dimensions !== undefined && description.dimensions !== index.dimensions) {
    throw new Error("Dimensioni del provider non compatibili con l'indice.");
  }
  if (stableParameters(description.parameters) !== stableParameters(index.parameters)) {
    throw new Error("Parametri del provider non compatibili con l'indice.");
  }
  if (index.normalization !== "l2") throw new Error("Normalizzazione dell'indice non compatibile.");
}
