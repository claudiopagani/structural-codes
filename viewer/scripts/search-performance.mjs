import { mkdir, readFile, writeFile } from "node:fs/promises";
import { cpus, platform, release } from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { createSearchEngine } from "../shared/searchEngine.js";

const viewerRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const indexPath = path.join(viewerRoot, "public", "data", "codes", "search-index.json");
const outputPath = path.resolve(process.env.SCV_SEARCH_BENCHMARK_OUTPUT || path.join(viewerRoot, "reports", "search-phase-two.json"));
const iterations = Math.max(10, Number(process.env.SCV_SEARCH_BENCHMARK_RUNS) || 50);
const indexBytes = await readFile(indexPath);
const index = JSON.parse(indexBytes.toString("utf8"));

function modeAllows(document, mode) {
  return mode === "combined" || (mode === "ntc" ? document === "ntc2018" : document === "circ2019");
}

function legacySearch(query, mode, limit) {
  const normalizedQuery = query.normalize("NFKC").trim().toLocaleLowerCase("it");
  return index.units.filter((unit) => {
    if (!modeAllows(unit.document, mode)) return false;
    return `${unit.numbering} ${unit.title} ${unit.text}`.normalize("NFKC").toLocaleLowerCase("it").includes(normalizedQuery);
  }).slice(0, limit);
}

function distribution(samples) {
  const sorted = [...samples].sort((left, right) => left - right);
  const percentile = (value) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * value))];
  return {
    medianMs: Number(percentile(0.5).toFixed(3)),
    p95Ms: Number(percentile(0.95).toFixed(3)),
    maxMs: Number(sorted.at(-1).toFixed(3)),
  };
}

function time(action) {
  const startedAt = performance.now();
  action();
  return performance.now() - startedAt;
}

function measure(action) {
  for (let iteration = 0; iteration < 5; iteration += 1) action();
  return distribution(Array.from({ length: iterations }, () => time(action)));
}

const scenarios = [
  { name: "exact-reference", query: "7.3.3.3", mode: "combined", limit: 12 },
  { name: "ranked-phrase", query: "azione sismica", mode: "combined", limit: 12 },
  { name: "common-term", query: "struttura", mode: "combined", limit: 12 },
].map((scenario) => {
  const freshEngine = createSearchEngine(index);
  const firstLegacyMs = time(() => legacySearch(scenario.query, scenario.mode, scenario.limit));
  const firstPhaseTwoMs = time(() => freshEngine.search(scenario));
  const warmEngine = createSearchEngine(index);
  const legacy = measure(() => legacySearch(scenario.query, scenario.mode, scenario.limit));
  const phaseTwo = measure(() => warmEngine.search(scenario));
  return {
    ...scenario,
    legacyMainThreadScan: { firstRunMs: Number(firstLegacyMs.toFixed(3)), ...legacy },
    phaseTwoEngine: { firstRunMs: Number(firstPhaseTwoMs.toFixed(3)), ...phaseTwo, execution: scenario.name === "exact-reference" ? "main-thread O(1) document lookup in the viewer" : "dedicated Web Worker" },
    medianSpeedup: Number((legacy.medianMs / Math.max(0.001, phaseTwo.medianMs)).toFixed(2)),
  };
});

const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  environment: {
    os: `${platform()} ${release()}`,
    cpu: cpus()[0]?.model || "unknown",
    logicalCpuCount: cpus().length,
    node: process.version,
  },
  methodology: {
    iterations,
    legacy: "full array filter with NFKC/lowercase normalization of every unit on every query",
    phaseTwo: "build-time normalized inverted index; persistent engine caches; result limit 12",
    note: "Engine timings exclude worker transport and lazy network download; full-text work executes outside the browser main thread.",
  },
  searchIndex: { bytes: indexBytes.length, units: index.units.length, terms: Object.keys(index.postings).length },
  scenarios,
};

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
process.stderr.write(`Benchmark ricerca scritto in ${outputPath}\n`);
