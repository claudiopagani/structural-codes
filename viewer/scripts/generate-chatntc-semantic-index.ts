import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { loadBgeM3Tokenizer } from "./bge-m3-tokenizer.js";
import { loadChatNTCCorpus } from "./load-chatntc-corpus.js";
import { OllamaEmbeddingProvider } from "../server/chatntc/ollamaEmbedding.js";
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
  console.log("Uso: npm --prefix viewer run chatntc:semantic:index -- --model <nome> [--dimensions N] [--num-ctx N] [--max-chunk-tokens N] [--overlap-tokens N] [--batch-size N] [--ollama-url URL] [--output DIR]\n       npm --prefix viewer run chatntc:semantic:validate");
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
  console.log(`semantic-index valido: ${index.metadata.unitCount} unità / ${index.metadata.chunkCount} chunk, ${index.metadata.dimensions} dimensioni, modello ${index.metadata.embeddingModel}`);
} else {
  const model = option("model");
  if (!model) throw new Error("--model è obbligatorio per generare l'indice.");
  const provider = new OllamaEmbeddingProvider({ model, baseUrl: option("ollama-url"), dimensions: numberOption("dimensions"),
    numCtx: numberOption("num-ctx"), timeoutMs: numberOption("timeout-ms") });
  const metadata = await generateSemanticIndex({ chunks, unitIds: units.map((unit) => unit.id), corpusFingerprint: manifest.corpusFingerprintSha256,
    provider, outputDirectory, chunking, tokenizerModel: tokenizer.metadata.model, tokenizerRevision: tokenizer.metadata.revision,
    batchSize: numberOption("batch-size") });
  await readSemanticIndex(outputDirectory, expected);
  console.log(`semantic-index generato: ${metadata.unitCount} unità / ${metadata.chunkCount} chunk × ${metadata.dimensions} dimensioni; ${metadata.vectors.byteLength} byte in ${outputDirectory}`);
}
