import { readFile } from "node:fs/promises";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import type { CorpusChunk, CorpusManifest, CorpusUnit, DocumentId, DocumentIndex } from "../shared/corpusData.js";
import { OllamaEmbeddingProvider } from "../server/chatntc/ollamaEmbedding.js";
import { generateSemanticIndex, readSemanticIndex, semanticInputFingerprint } from "../server/chatntc/semanticIndex.js";

const viewerRoot = resolve(fileURLToPath(new URL("../", import.meta.url)));
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
  console.log("Uso: npm --prefix viewer run chatntc:semantic:index -- --model <nome> [--dimensions N] [--batch-size N] [--ollama-url URL] [--output DIR]\n       npm --prefix viewer run chatntc:semantic:validate");
  process.exit(0);
}

const dataDirectory = resolve(option("data") ?? defaultData);
const outputDirectory = resolve(option("output") ?? defaultOutput);
const localRelative = relative(join(viewerRoot, ".local"), outputDirectory);
if (!localRelative || isAbsolute(localRelative) || localRelative === ".." || localRelative.startsWith(`..${sep}`)) {
  throw new Error("La destinazione deve essere una sottodirectory di viewer/.local/.");
}

async function json<T>(file: string): Promise<T> { return JSON.parse(await readFile(file, "utf8")) as T; }
function artifactFile(path: string) {
  if (!path.startsWith("/data/codes/") || path.includes("\\")) throw new Error(`Percorso artifact non valido: ${path}`);
  const file = resolve(dataDirectory, path.slice("/data/codes/".length));
  const within = relative(dataDirectory, file);
  if (!within || isAbsolute(within) || within === ".." || within.startsWith(`..${sep}`)) throw new Error(`Percorso artifact non valido: ${path}`);
  return file;
}

async function loadCorpus() {
  const manifest = await json<CorpusManifest>(join(dataDirectory, "manifest.json"));
  if (manifest.formatVersion !== 2 || !/^[a-f0-9]{64}$/u.test(manifest.corpusFingerprintSha256)) throw new Error("Manifest corpus non supportato.");
  const chunks = new Map<string, Promise<CorpusChunk>>();
  const loadChunk = (path: string) => {
    let pending = chunks.get(path);
    if (!pending) { pending = json<CorpusChunk>(artifactFile(path)); chunks.set(path, pending); }
    return pending;
  };
  const units: CorpusUnit[] = [];
  for (const document of ["ntc2018", "circ2019"] as const satisfies readonly DocumentId[]) {
    const index = await json<DocumentIndex>(artifactFile(manifest.documents[document].indexPath));
    if (index.formatVersion !== 2 || index.document !== document) throw new Error(`Indice documento incoerente: ${document}`);
    for (const summary of index.units) {
      const chunk = await loadChunk(summary.chunkPath);
      const inventory = manifest.chunks.find((item) => item.path === summary.chunkPath);
      const found = chunk.units.filter((unit) => unit.id === summary.id);
      if (!inventory || chunk.contentFingerprintSha256 !== inventory.contentFingerprintSha256 || found.length !== 1
        || found[0].document !== document || found[0].numbering.official !== summary.numbering.official) {
        throw new Error(`Unità artifact incoerente: ${summary.id}`);
      }
      units.push(found[0]);
    }
  }
  if (units.length !== manifest.stats.units || new Set(units.map((unit) => unit.id)).size !== units.length) throw new Error("Inventario unità incompleto o duplicato.");
  return { manifest, units };
}

const { manifest, units } = await loadCorpus();
const expected = { corpusFingerprint: manifest.corpusFingerprintSha256, unitIds: units.map((unit) => unit.id),
  inputFingerprint: semanticInputFingerprint(units) };
if (flag("validate-only")) {
  const index = await readSemanticIndex(outputDirectory, expected);
  console.log(`semantic-index valido: ${index.metadata.unitCount} unità, ${index.metadata.dimensions} dimensioni, modello ${index.metadata.embeddingModel}`);
} else {
  const model = option("model");
  if (!model) throw new Error("--model è obbligatorio per generare l'indice.");
  const provider = new OllamaEmbeddingProvider({ model, baseUrl: option("ollama-url"), dimensions: numberOption("dimensions"),
    timeoutMs: numberOption("timeout-ms") });
  const metadata = await generateSemanticIndex({ units, corpusFingerprint: manifest.corpusFingerprintSha256,
    provider, outputDirectory, batchSize: numberOption("batch-size") });
  await readSemanticIndex(outputDirectory, expected);
  console.log(`semantic-index generato: ${metadata.unitCount} unità × ${metadata.dimensions} dimensioni; ${metadata.vectors.byteLength} byte in ${outputDirectory}`);
}
