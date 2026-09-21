import { join, resolve } from "node:path";
import { loadBgeM3Tokenizer } from "./bge-m3-tokenizer.js";
import { loadChatNTCCorpus } from "./load-chatntc-corpus.js";
import { numericStats } from "./semantic-length-audit.js";
import {
  CHATNTC_SEMANTIC_CHUNKING_DEFAULTS, chunkSemanticUnits,
} from "../server/chatntc/semanticIndex.js";

const viewerRoot = resolve(process.cwd());
const option = (name: string) => {
  const position = process.argv.indexOf(`--${name}`);
  return position < 0 ? undefined : process.argv[position + 1];
};
const numberOption = (name: string, fallback: number) => {
  const value = option(name);
  if (value === undefined) return fallback;
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 1) throw new Error(`--${name} non valido.`);
  return number;
};
const dataDirectory = join(viewerRoot, "public", "data", "codes");
const tokenizerDirectory = join(viewerRoot, ".local", "bge-m3-tokenizer");
const policy = { maxChunkTokens: numberOption("max-chunk-tokens", CHATNTC_SEMANTIC_CHUNKING_DEFAULTS.maxChunkTokens),
  overlapTokens: numberOption("overlap-tokens", CHATNTC_SEMANTIC_CHUNKING_DEFAULTS.overlapTokens) };
const { units } = await loadChatNTCCorpus(dataDirectory);
const tokenizer = await loadBgeM3Tokenizer(tokenizerDirectory);
const chunks = chunkSemanticUnits(units, tokenizer.tokenizer, policy);
const chunksByUnit = new Map<string, number>();
for (const chunk of chunks) chunksByUnit.set(chunk.unitId, (chunksByUnit.get(chunk.unitId) ?? 0) + 1);
const distribution = [...chunksByUnit.values()].reduce((counts, count) => {
  counts[count] = (counts[count] ?? 0) + 1;
  return counts;
}, {} as Record<number, number>);
const splitUnits = [...chunksByUnit.values()].filter((count) => count > 1).length;
const documentStats = new Map<string, { units: number; chunks: number; splitUnits: number }>();
for (const unit of units) {
  const stats = documentStats.get(unit.document) ?? { units: 0, chunks: 0, splitUnits: 0 };
  stats.units += 1;
  documentStats.set(unit.document, stats);
}
for (const chunk of chunks) {
  const stats = documentStats.get(chunk.document);
  if (stats) stats.chunks += 1;
}
for (const unit of units) {
  const stats = documentStats.get(unit.document);
  if (stats && (chunksByUnit.get(unit.id) ?? 0) > 1) stats.splitUnits += 1;
}
console.log("ChatNTC semantic chunk audit (nessun embedding generato)");
console.log(`Policy: maxChunkTokens=${policy.maxChunkTokens}, overlapTokens=${policy.overlapTokens}`);
console.log(`Tokenizer: ${tokenizer.metadata.model} @ ${tokenizer.metadata.revision}`);
console.log(`Unità: ${units.length}; chunk totali: ${chunks.length}; media chunk/unità: ${(chunks.length / units.length).toFixed(2)}; max chunk/unità: ${Math.max(...chunksByUnit.values())}`);
console.log(`Unità spezzate: ${splitUnits} (${((splitUnits / units.length) * 100).toFixed(2)}%)`);
console.log(`Distribuzione documenti: ${[...documentStats.entries()].map(([document, stats]) => `${document}=${stats.units} unità/${stats.chunks} chunk/${stats.splitUnits} spezzate`).join(", ")}`);
console.log(`Distribuzione chunk/unità: ${Object.entries(distribution).sort(([left], [right]) => Number(left) - Number(right)).map(([count, unitsWithCount]) => `${count}=${unitsWithCount}`).join(", ")}`);
console.log(`Token per chunk: ${JSON.stringify(numericStats(chunks.map((chunk) => chunk.tokenCount)))}`);
