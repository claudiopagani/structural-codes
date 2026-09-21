import { join, resolve } from "node:path";
import { loadBgeM3Tokenizer } from "./bge-m3-tokenizer.js";
import { loadChatNTCCorpus } from "./load-chatntc-corpus.js";
import {
  BGE_M3_CONTEXT_WINDOW, assertLocalOutput, createSemanticLengthAuditReport,
  formatTopUnit, sortLongestUnits, writeSemanticLengthAuditReport,
} from "./semantic-length-audit.js";

const viewerRoot = resolve(process.cwd());
const dataDirectory = resolve(join(viewerRoot, "public", "data", "codes"));
const tokenizerDirectory = resolve(join(viewerRoot, ".local", "bge-m3-tokenizer"));
const outputFile = resolve(join(viewerRoot, ".local", "chatntc-semantic-audit", "unit-lengths.json"));
const tokenizer = await loadBgeM3Tokenizer(tokenizerDirectory).catch((error: unknown) => {
  throw new Error(`Tokenizer BGE-M3 non disponibile in ${tokenizerDirectory}. Esegui prima npm run chatntc:semantic:tokenizer:setup.\n${error instanceof Error ? error.message : String(error)}`);
});
assertLocalOutput(viewerRoot, outputFile);
const { manifest, units } = await loadChatNTCCorpus(dataDirectory);
const report = createSemanticLengthAuditReport({ units, corpusFingerprint: manifest.corpusFingerprintSha256,
  tokenizerMetadata: tokenizer.metadata, tokenizer: tokenizer.tokenizer });
await writeSemanticLengthAuditReport(outputFile, report);

const percentage = (count: number) => `${count} (${((count / report.summary.unitCount) * 100).toFixed(2)}%)`;
const printStats = (label: string, stats: { min: number; max: number; mean: number; median: number; p75?: number; p90: number; p95: number; p99: number }) => {
  console.log(`${label}: min ${stats.min}, max ${stats.max}, media ${stats.mean}, mediana ${stats.median}, P75 ${stats.p75 ?? "n/a"}, P90 ${stats.p90}, P95 ${stats.p95}, P99 ${stats.p99}`);
};

console.log("ChatNTC semantic unit length audit");
console.log(`Unità totali: ${report.summary.unitCount}`);
console.log(`Tokenizer: ${report.tokenizer.model} @ ${report.tokenizer.revision}`);
console.log(`Metodo: ${report.tokenizer.method}; token speciali inclusi: sì`);
printStats("Caratteri", report.summary.characters);
printStats("Token BGE-M3", report.summary.tokens);
console.log("Soglie token (strettamente sopra):");
for (const threshold of report.thresholds) console.log(`  > ${threshold.threshold}: ${percentage(threshold.count)}`);
console.log("Distribuzione documenti:");
for (const document of ["ntc2018", "circ2019"] as const) {
  const entry = report.documents[document];
  console.log(`  ${document}: ${entry.unitCount} unità; max ${entry.tokens.max}; mediana ${entry.tokens.median}; P90 ${entry.tokens.p90}; >8192 ${entry.thresholds.find((item) => item.threshold === BGE_M3_CONTEXT_WINDOW)?.count ?? 0}`);
}
console.log("Diagnostica context window (nessun chunking applicato):");
for (const threshold of [2000, 4000, BGE_M3_CONTEXT_WINDOW]) {
  const entry = report.thresholds.find((item) => item.threshold === threshold);
  console.log(`  > ${threshold}: ${entry ? percentage(entry.count) : "n/a"}`);
}
console.log("Top 30 unità per token:");
for (const [index, unit] of sortLongestUnits(report.units).slice(0, 30).entries()) console.log(formatTopUnit(unit, index + 1));
console.log(`Report JSON: ${outputFile}`);
