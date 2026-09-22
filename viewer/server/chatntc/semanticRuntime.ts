import "server-only";
import { existsSync, readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";
import type { DocumentId, DocumentIndex } from "../../shared/corpusData.js";
import type { ChatNTCEmbeddingProvider } from "./semanticIndex.js";
import {
  assertChatNTCEmbeddingCompatibility,
  createChatNTCEmbeddingProvider,
  parseChatNTCEmbeddingProvider,
  type ChatNTCEmbeddingProviderId,
  type ChatNTCEmbeddingProviderOptions,
} from "./embeddingProviderFactory.js";
import type { ChatNTCEnvironment } from "./config.js";
import type { ChatNTCShadowDiagnostics, ChatNTCSemanticRetrievalConfiguration,
  ChatNTCSemanticRetrievalMode, ChatNTCSemanticRetriever } from "./retrievalCoordinator.js";
import { createChatNTCSemanticIndexLoader, createChatNTCSemanticRetriever } from "./semanticRetriever.js";

const FLAG_MODEL = "BAAI/bge-m3";
const FLAG_DIMENSIONS = 1024;

type ProviderFactory = (options: ChatNTCEmbeddingProviderOptions) => ReturnType<typeof createChatNTCEmbeddingProvider>;

interface SemanticIndexHeader {
  embeddingProvider: string;
  embeddingModel: string;
  dimensions: number;
}

export interface ChatNTCSemanticRuntimeOptions {
  cwd?: string;
  dataDirectory?: string;
  fetchImpl?: typeof fetch;
  providerFactory?: ProviderFactory;
  onDiagnostics?: (diagnostics: ChatNTCShadowDiagnostics) => void | Promise<void>;
}

export interface ChatNTCSemanticRuntime {
  mode: ChatNTCSemanticRetrievalMode;
  provider: ChatNTCEmbeddingProviderId | null;
  indexDirectory: string | null;
  configuration: ChatNTCSemanticRetrievalConfiguration;
  initialize(): Promise<ChatNTCSemanticRetrievalConfiguration>;
}

export class ChatNTCSemanticConfigurationError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(`Configurazione semantic ChatNTC non valida: ${message}`, options);
    this.name = "ChatNTCSemanticConfigurationError";
  }
}

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function mode(value: string | undefined): ChatNTCSemanticRetrievalMode {
  const selected = value ?? "off";
  if (selected !== "off" && selected !== "shadow" && selected !== "on") {
    throw new ChatNTCSemanticConfigurationError(`CHATNTC_SEMANTIC_MODE non supportata: ${selected}.`);
  }
  return selected;
}

function positiveInteger(value: string | undefined, name: string): number | undefined {
  if (value === undefined || !value.trim()) return undefined;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) throw new ChatNTCSemanticConfigurationError(`${name} deve essere un intero positivo.`);
  return parsed;
}

function indexHeader(directory: string, provider: ChatNTCEmbeddingProviderId, configuredModel?: string): SemanticIndexHeader {
  const metadataFile = join(directory, "index.json");
  const vectorFile = join(directory, "vectors.f32");
  if (!existsSync(metadataFile) || !existsSync(vectorFile)) {
    throw new ChatNTCSemanticConfigurationError(`indice non disponibile in ${directory}.`);
  }
  let value: unknown;
  try { value = JSON.parse(readFileSync(metadataFile, "utf8")); }
  catch (error) { throw new ChatNTCSemanticConfigurationError("index.json non leggibile o non valido.", { cause: error }); }
  if (!object(value) || typeof value.embeddingProvider !== "string" || typeof value.embeddingModel !== "string"
    || typeof value.dimensions !== "number") {
    throw new ChatNTCSemanticConfigurationError("metadata minimi dell'indice assenti.");
  }
  if (value.embeddingProvider !== provider) {
    throw new ChatNTCSemanticConfigurationError(`provider indice ${value.embeddingProvider} incompatibile con runtime ${provider}.`);
  }
  if (provider === "flagembedding-http"
    && (value.embeddingModel !== FLAG_MODEL || value.dimensions !== FLAG_DIMENSIONS)) {
    throw new ChatNTCSemanticConfigurationError("l'indice FlagEmbedding deve usare BAAI/bge-m3 con 1024 dimensioni.");
  }
  if (configuredModel && value.embeddingModel !== configuredModel) {
    throw new ChatNTCSemanticConfigurationError(`modello indice ${value.embeddingModel} incompatibile con runtime ${configuredModel}.`);
  }
  return { embeddingProvider: value.embeddingProvider, embeddingModel: value.embeddingModel, dimensions: value.dimensions };
}

async function loadCatalog(dataDirectory: string) {
  let manifest: unknown;
  try { manifest = JSON.parse(await readFile(join(dataDirectory, "manifest.json"), "utf8")); }
  catch (error) { throw new ChatNTCSemanticConfigurationError("manifest corpus non leggibile.", { cause: error }); }
  if (!object(manifest) || typeof manifest.corpusFingerprintSha256 !== "string" || !object(manifest.stats)
    || typeof manifest.stats.units !== "number") {
    throw new ChatNTCSemanticConfigurationError("manifest corpus non valido.");
  }
  const units = [] as Array<{ unitId: string; document: DocumentId; numbering: string }>;
  for (const document of ["ntc2018", "circ2019"] as const) {
    let index: DocumentIndex;
    try { index = JSON.parse(await readFile(join(dataDirectory, document, "index.json"), "utf8")) as DocumentIndex; }
    catch (error) { throw new ChatNTCSemanticConfigurationError(`indice documento ${document} non leggibile.`, { cause: error }); }
    if (index.formatVersion !== 2 || index.document !== document || !Array.isArray(index.units)) {
      throw new ChatNTCSemanticConfigurationError(`indice documento ${document} non valido.`);
    }
    for (const unit of index.units) {
      if (typeof unit.id !== "string" || unit.document !== document || typeof unit.numbering?.official !== "string") {
        throw new ChatNTCSemanticConfigurationError(`catalogo unità ${document} non valido.`);
      }
      units.push({ unitId: unit.id, document, numbering: unit.numbering.official });
    }
  }
  if (units.length !== manifest.stats.units || new Set(units.map((unit) => unit.unitId)).size !== units.length) {
    throw new ChatNTCSemanticConfigurationError("inventario unità semantic non coerente con il manifest.");
  }
  return { corpusFingerprint: manifest.corpusFingerprintSha256, units };
}

export function configuredChatNTCSemanticRuntime(
  env: ChatNTCEnvironment,
  options: ChatNTCSemanticRuntimeOptions = {},
): ChatNTCSemanticRuntime {
  const selectedMode = mode(env.CHATNTC_SEMANTIC_MODE);
  if (selectedMode === "off") {
    const configuration = Object.freeze({ mode: "off" as const });
    return { mode: "off", provider: null, indexDirectory: null, configuration,
      async initialize() { return configuration; } };
  }

  let providerId: ChatNTCEmbeddingProviderId;
  try { providerId = parseChatNTCEmbeddingProvider(env.CHATNTC_EMBEDDING_PROVIDER, "flagembedding-http"); }
  catch (error) { throw new ChatNTCSemanticConfigurationError("CHATNTC_EMBEDDING_PROVIDER non supportato.", { cause: error }); }
  const rawIndexPath = env.CHATNTC_SEMANTIC_INDEX_PATH;
  if (!rawIndexPath?.trim()) throw new ChatNTCSemanticConfigurationError("CHATNTC_SEMANTIC_INDEX_PATH è obbligatorio in shadow/on.");
  const cwd = resolve(options.cwd ?? process.cwd());
  const indexDirectory = isAbsolute(rawIndexPath) ? resolve(rawIndexPath) : resolve(cwd, rawIndexPath);
  const model = providerId === "ollama" ? env.CHATNTC_EMBEDDING_MODEL?.trim() : undefined;
  if (providerId === "ollama" && !model) {
    throw new ChatNTCSemanticConfigurationError("CHATNTC_EMBEDDING_MODEL è obbligatorio per Ollama.");
  }
  indexHeader(indexDirectory, providerId, model);

  let timeoutMs: number | undefined;
  let batchSize: number | undefined;
  let dimensions: number | undefined;
  let numCtx: number | undefined;
  try {
    timeoutMs = positiveInteger(env.CHATNTC_EMBEDDING_TIMEOUT_MS, "CHATNTC_EMBEDDING_TIMEOUT_MS");
    batchSize = positiveInteger(env.CHATNTC_EMBEDDING_BATCH_SIZE, "CHATNTC_EMBEDDING_BATCH_SIZE");
    dimensions = positiveInteger(env.CHATNTC_EMBEDDING_DIMENSIONS, "CHATNTC_EMBEDDING_DIMENSIONS");
    numCtx = positiveInteger(env.CHATNTC_EMBEDDING_NUM_CTX, "CHATNTC_EMBEDDING_NUM_CTX");
  } catch (error) {
    if (error instanceof ChatNTCSemanticConfigurationError) throw error;
    throw new ChatNTCSemanticConfigurationError("parametri numerici embedding non validi.", { cause: error });
  }
  const makeProvider = options.providerFactory ?? createChatNTCEmbeddingProvider;
  let provider: ChatNTCEmbeddingProvider;
  try {
    provider = makeProvider({ provider: providerId, model, baseUrl: env.CHATNTC_EMBEDDING_URL,
      timeoutMs, batchSize, dimensions, numCtx, fetchImpl: options.fetchImpl });
  } catch (error) {
    throw new ChatNTCSemanticConfigurationError("provider embedding non inizializzabile.", { cause: error });
  }

  const dataDirectory = resolve(options.dataDirectory ?? join(cwd, "public", "data", "codes"));
  let activeRetriever: ChatNTCSemanticRetriever | undefined;
  let pending: Promise<ChatNTCSemanticRetrievalConfiguration> | undefined;
  const configuration: ChatNTCSemanticRetrievalConfiguration = {
    mode: selectedMode,
    retriever: { async retrieve(input) {
      await initialize();
      if (!activeRetriever) throw new ChatNTCSemanticConfigurationError("retriever semantic non inizializzato.");
      return activeRetriever.retrieve(input);
    } },
    ...(options.onDiagnostics ? { onDiagnostics: options.onDiagnostics } : {}),
  };

  function initialize(): Promise<ChatNTCSemanticRetrievalConfiguration> {
    pending ??= (async () => {
      try {
        const catalog = await loadCatalog(dataDirectory);
        const loader = createChatNTCSemanticIndexLoader({ directory: indexDirectory,
          expected: { corpusFingerprint: catalog.corpusFingerprint, unitIds: catalog.units.map((unit) => unit.unitId) } });
        const [description, index] = await Promise.all([provider.describe(), loader.load()]);
        assertChatNTCEmbeddingCompatibility(description, index.metadata);
        if (providerId === "flagembedding-http" && (description.embeddingModel !== FLAG_MODEL
          || description.dimensions !== FLAG_DIMENSIONS)) {
          throw new Error("Runtime FlagEmbedding diverso da BAAI/bge-m3 1024d.");
        }
        activeRetriever = createChatNTCSemanticRetriever({ provider, indexLoader: loader, units: catalog.units });
        return configuration;
      } catch (error) {
        if (error instanceof ChatNTCSemanticConfigurationError) throw error;
        throw new ChatNTCSemanticConfigurationError("preflight provider/indice fallito.", { cause: error });
      }
    })();
    return pending;
  }

  return { mode: selectedMode, provider: providerId, indexDirectory, configuration, initialize };
}
