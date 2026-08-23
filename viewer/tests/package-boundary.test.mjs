import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const testsRoot = dirname(fileURLToPath(import.meta.url));
const viewerRoot = dirname(testsRoot);
const repositoryRoot = dirname(viewerRoot);
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

function packPreview(cwd) {
  const output = execSync(`${npmCommand} pack --dry-run --json`, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  return JSON.parse(output)[0].files.map(({ path }) => path);
}

test("i tarball rispettano il boundary core/viewer", async () => {
  const [rootPackage, viewerPackage] = await Promise.all([
    readFile(join(repositoryRoot, "package.json"), "utf8").then(JSON.parse),
    readFile(join(viewerRoot, "package.json"), "utf8").then(JSON.parse),
  ]);
  const rootFiles = packPreview(repositoryRoot);
  const viewerFiles = packPreview(viewerRoot);

  assert.equal(rootFiles.some((path) => path.startsWith("viewer/")), false);
  assert.equal(viewerFiles.some((path) => path.includes("corpus/units/") || path.includes("corpus/assets/")), false);
  assert.equal(viewerFiles.some((path) => path.includes("pdfjs-dist") || path.startsWith("worker/") || path.startsWith("app/")), false);
  assert.deepEqual(viewerPackage.peerDependencies, { react: "^19.0.0", "react-dom": "^19.0.0" });
  assert.equal(Object.prototype.hasOwnProperty.call(viewerPackage.dependencies, "pdfjs-dist"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(viewerPackage.dependencies, "next"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(viewerPackage.dependencies, "vinext"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(viewerPackage.dependencies, "@cloudflare/vite-plugin"), false);
  assert.equal(rootPackage.dependencies.react, undefined);
});

test("il core React-free non è una dipendenza inversa del package viewer", async () => {
  const [rootPackage, generator, viewerSource] = await Promise.all([
    readFile(join(repositoryRoot, "package.json"), "utf8").then(JSON.parse),
    readFile(join(viewerRoot, "shared", "generate-artifacts.mjs"), "utf8"),
    readFile(join(viewerRoot, "shared", "NormativeViewer.tsx"), "utf8"),
  ]);
  assert.equal(rootPackage.dependencies["structural-codes-viewer"], undefined);
  assert.doesNotMatch(generator, /\.\.\/strutture-normative|\.\.\/structural-codes/iu);
  assert.doesNotMatch(viewerSource, /pdfjs-dist|source-pdf|vinext|cloudflare/iu);
});
