import "server-only";
import { readFile } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { createArtifactRepository } from "../../shared/chatntc/viewerArtifacts.js";
import type { CorpusChunk, CorpusManifest, CrossReferenceIndex, DocumentIndex, RelationsIndex, SearchIndex } from "../../shared/corpusData.js";

/** Per-request file snapshot/cache; all indexing and resolution stay in the STEP 1 adapter. */
export function createLocalArtifactRepository(directory = resolve(process.cwd(), "public/data/codes")) {
  const root = resolve(directory);
  const cache = new Map<string, Promise<unknown>>();
  async function read<T>(artifactPath: string): Promise<T> {
    if (!artifactPath.startsWith("/data/codes/") || artifactPath.includes("\\")) throw new Error("Invalid artifact path");
    const file = resolve(root, artifactPath.slice("/data/codes/".length));
    const within = relative(root, file);
    if (!within || isAbsolute(within) || within === ".." || within.startsWith(`..${sep}`) || !file.endsWith(".json")) throw new Error("Invalid artifact path");
    let pending = cache.get(file);
    if (!pending) {
      pending = readFile(file, "utf8").then((value) => JSON.parse(value) as unknown);
      cache.set(file, pending);
    }
    return await pending as T;
  }
  return createArtifactRepository({
    manifest: () => read<CorpusManifest>("/data/codes/manifest.json"),
    documentIndex: (manifest, document) => read<DocumentIndex>(manifest.documents[document].indexPath),
    chunk: (path) => read<CorpusChunk>(path),
    searchIndex: (manifest) => read<SearchIndex>(manifest.searchIndexPath),
    crossReferenceIndex: (manifest) => read<CrossReferenceIndex>(manifest.crossReferenceIndexPath),
    relations: (manifest) => read<RelationsIndex>(manifest.relationsPath),
  });
}
