import { readFile } from "node:fs/promises";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import type { CorpusChunk, CorpusManifest, CorpusUnit, DocumentId, DocumentIndex } from "../shared/corpusData.js";

export interface LoadedChatNTCCorpus {
  manifest: CorpusManifest;
  units: CorpusUnit[];
}

async function json<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(file, "utf8")) as T;
}

function artifactFile(dataDirectory: string, path: string) {
  if (!path.startsWith("/data/codes/") || path.includes("\\")) throw new Error(`Percorso artifact non valido: ${path}`);
  const file = resolve(dataDirectory, path.slice("/data/codes/".length));
  const within = relative(dataDirectory, file);
  if (!within || isAbsolute(within) || within === ".." || within.startsWith(`..${sep}`)) throw new Error(`Percorso artifact non valido: ${path}`);
  return file;
}

/** Load and validate the canonical, generated corpus payload used by semantic tooling. */
export async function loadChatNTCCorpus(dataDirectory: string): Promise<LoadedChatNTCCorpus> {
  const manifest = await json<CorpusManifest>(join(dataDirectory, "manifest.json"));
  if (manifest.formatVersion !== 2 || !/^[a-f0-9]{64}$/u.test(manifest.corpusFingerprintSha256)) throw new Error("Manifest corpus non supportato.");
  const chunks = new Map<string, Promise<CorpusChunk>>();
  const loadChunk = (path: string) => {
    let pending = chunks.get(path);
    if (!pending) { pending = json<CorpusChunk>(artifactFile(dataDirectory, path)); chunks.set(path, pending); }
    return pending;
  };
  const units: CorpusUnit[] = [];
  for (const document of ["ntc2018", "circ2019"] as const satisfies readonly DocumentId[]) {
    const index = await json<DocumentIndex>(artifactFile(dataDirectory, manifest.documents[document].indexPath));
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
