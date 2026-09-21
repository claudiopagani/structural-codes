import { createHash } from "node:crypto";
import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { BGE_M3_TOKENIZER_FILES, BGE_M3_TOKENIZER_MODEL, BGE_M3_TOKENIZER_REVISION } from "./bge-m3-tokenizer.js";

const viewerRoot = resolve(process.cwd());
const defaultDirectory = join(viewerRoot, ".local", "bge-m3-tokenizer");
const option = (name: string) => {
  const position = process.argv.indexOf(`--${name}`);
  return position < 0 ? undefined : process.argv[position + 1];
};
const directory = resolve(option("output") ?? defaultDirectory);

async function download(name: string): Promise<Buffer> {
  const response = await fetch(`https://huggingface.co/${BGE_M3_TOKENIZER_MODEL}/resolve/${BGE_M3_TOKENIZER_REVISION}/${name}`);
  if (!response.ok) throw new Error(`Download ${name} fallito: HTTP ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

await mkdir(directory, { recursive: true });
for (const file of BGE_M3_TOKENIZER_FILES) {
  const target = join(directory, file.name);
  const temporary = `${target}.tmp-${process.pid}`;
  const bytes = await download(file.name);
  const digest = createHash("sha256").update(bytes).digest("hex");
  if (bytes.length !== file.bytes || digest !== file.sha256) {
    await rm(temporary, { force: true });
    throw new Error(`${file.name}: hash o dimensione inattesi (${bytes.length} byte, ${digest}).`);
  }
  await writeFile(temporary, bytes);
  await rename(temporary, target);
}
await writeFile(join(directory, "manifest.json"), `${JSON.stringify({ model: BGE_M3_TOKENIZER_MODEL, revision: BGE_M3_TOKENIZER_REVISION, files: BGE_M3_TOKENIZER_FILES }, null, 2)}\n`, "utf8");
console.log(`Tokenizer BGE-M3 installato e verificato in ${directory}`);
