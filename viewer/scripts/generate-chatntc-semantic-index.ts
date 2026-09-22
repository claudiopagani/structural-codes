import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { performance } from "node:perf_hooks";
import { loadBgeM3Tokenizer } from "./bge-m3-tokenizer.js";
import { loadChatNTCCorpus } from "./load-chatntc-corpus.js";
import {
  assertChatNTCEmbeddingCompatibility, createChatNTCEmbeddingProvider, parseChatNTCEmbeddingProvider,
} from "../server/chatntc/embeddingProviderFactory.js";
import {
  CHATNTC_SEMANTIC_CHUNKING_DEFAULTS, chunkSemanticUnits, generateSemanticIndex, readSemanticIndex,
  semanticInputFingerprint,
} from "../server/chatntc/semanticIndex.js";

const viewerRoot = resolve(process.cwd());
const defaultData = join(viewerRoot, "public", "data", "codes");
const defaultOutput = join(viewerRoot, ".local", "chatntc-semantic");
const args = process.argv.slice(2);
const flag = (name: string) => args.includes(`--${name}`);
const option = (name: string) => {
  const position = args.indexOf(`--${name}`);
  return position < 0 ? undefined : args[position + 1];
};
const numberOption = (name: string) => {
  const value = option(name);
  if (value === undefined) return undefined;
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 1) throw new Error(`--${name} non valido.`);
  return number;
};

if (flag("help")) {
  console.log("Uso: npm --prefix viewer run chatntc:semantic:index -- --provider <ollama|flagembedding-http> [--model NOME] [--embedding-url URL] [--timeout-ms N] [--batch-size N] [--dimensions N] [--num-ctx N] [--max-chunk-tokens N] [--overlap-tokens N] [--ollama-url URL] [--output DIR]\n       npm --prefix viewer run chatntc:semantic:validate -- [--provider ...] [--output DIR]");
  process.exit(0);
}

const dataDirectory = resolve(option("data") ?? defaultData);
const outputDirectory = resolve(option("output") ?? defaultOutput);
const localRelative = relative(join(viewerRoot, ".local"), outputDirectory);
if (!localRelative || isAbsolute(localRelative) || localRelative === ".." || localRelative.startsWith(`..${sep}`)) {
  throw new Error("La destinazione deve essere una sottodirectory di viewer/.local/.");
}

const { manifest, units } = await loadChatNTCCorpus(dataDirectory);
const tokenizer = await loadBgeM3Tokenizer(join(viewerRoot, ".local", "bge-m3-tokenizer"));
const chunking = { maxChunkTokens: numberOption("max-chunk-tokens") ?? CHATNTC_SEMANTIC_CHUNKING_DEFAULTS.maxChunkTokens,
  overlapTokens: numberOption("overlap-tokens") ?? CHATNTC_SEMANTIC_CHUNKING_DEFAULTS.overlapTokens };
const chunks = chunkSemanticUnits(units, tokenizer.tokenizer, chunking);
const expected = { corpusFingerprint: manifest.corpusFingerprintSha256, unitIds: units.map((unit) => unit.id),
  inputFingerprint: semanticInputFingerprint(chunks, { policy: chunking, tokenizerModel: tokenizer.metadata.model, tokenizerRevision: tokenizer.metadata.revision }) };
if (flag("validate-only")) {
  const index = await readSemanticIndex(outputDirectory, expected);
  const requestedProvider = option("provider");
  if (requestedProvider !== undefined) {
    const providerName = parseChatNTCEmbeddingProvider(requestedProvider, "ollama");
    const provider = createChatNTCEmbeddingProvider({
      provider: providerName,
      model: providerName === "ollama" ? option("model") ?? index.metadata.embeddingModel : undefined,
      baseUrl: providerName === "ollama" ? option("ollama-url") : option("embedding-url"),
      timeoutMs: numberOption("timeout-ms"),
      batchSize: numberOption("batch-size"),
      dimensions: providerName === "ollama" ? numberOption("dimensions") : undefined,
      numCtx: providerName === "ollama" ? numberOption("num-ctx") : undefined,
    });
    assertChatNTCEmbeddingCompatibility(await provider.describe(), index.metadata);
  }
  console.log(`semantic-index valido: ${index.metadata.unitCount} unità / ${index.metadata.chunkCount} chunk, ${index.metadata.dimensions} dimensioni, modello ${index.metadata.embeddingModel}`);
} else {
  const providerName = parseChatNTCEmbeddingProvider(option("provider"), "ollama");
  const batchSize = numberOption("batch-size");
  const provider = createChatNTCEmbeddingProvider({ provider: providerName, model: option("model"),
    baseUrl: providerName === "ollama" ? option("ollama-url") : option("embedding-url"),
    dimensions: numberOption("dimensions"), numCtx: numberOption("num-ctx"), timeoutMs: numberOption("timeout-ms"),
    batchSize });
  const started = performance.now();
  const metadata = await generateSemanticIndex({ chunks, unitIds: units.map((unit) => unit.id), corpusFingerprint: manifest.corpusFingerprintSha256,
    provider, outputDirectory, chunking, tokenizerModel: tokenizer.metadata.model, tokenizerRevision: tokenizer.metadata.revision,
    batchSize });
  await readSemanticIndex(outputDirectory, expected);
  const elapsedSeconds = (performance.now() - started) / 1000;
  console.log(`semantic-index generato: ${metadata.unitCount} unità / ${metadata.chunkCount} chunk × ${metadata.dimensions} dimensioni; ${metadata.vectors.byteLength} byte in ${outputDirectory}`);
  console.log(`tempo embedding+scrittura: ${elapsedSeconds.toFixed(2)} s; throughput ${(metadata.chunkCount / elapsedSeconds).toFixed(2)} chunk/s`);
}
