import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import katex from "katex";

const repoRoot = fileURLToPath(new URL("../../", import.meta.url));
const unitDir = join(repoRoot, "corpus", "units", "ntc2018");
const assetDir = join(repoRoot, "corpus", "assets", "ntc2018");

async function jsonFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await jsonFiles(path));
    else if (entry.name.endsWith(".json")) files.push(path);
  }
  return files;
}

function latexEntries(value, file, jsonPath = "$") {
  if (Array.isArray(value)) return value.flatMap((entry, index) => latexEntries(entry, file, `${jsonPath}[${index}]`));
  if (value === null || typeof value !== "object") return [];
  return Object.entries(value).flatMap(([key, entry]) => {
    const entryPath = `${jsonPath}.${key}`;
    if (key === "latex" && typeof entry === "string") return [{ file, jsonPath: entryPath, latex: entry }];
    return latexEntries(entry, file, entryPath);
  });
}

test("tutto il LaTeX NTC compila nel renderer rigoroso del viewer", async () => {
  const files = [...await jsonFiles(unitDir), ...await jsonFiles(assetDir)];
  const entries = [];
  for (const file of files) entries.push(...latexEntries(JSON.parse(await readFile(file, "utf8")), file));
  assert.equal(entries.length, 5741);
  for (const entry of entries) {
    assert.doesNotThrow(
      () => katex.renderToString(entry.latex, { throwOnError: true, strict: "error", output: "html" }),
      `${relative(repoRoot, entry.file)} ${entry.jsonPath}: ${entry.latex}`,
    );
  }
});

test("ogni formula NTC dichiarata compare una sola volta nel flusso", async () => {
  const formulaIds = [];
  for (const file of await jsonFiles(assetDir)) {
    const manifest = JSON.parse(await readFile(file, "utf8"));
    formulaIds.push(...(manifest.formulas ?? []).map((formula) => formula.id));
  }
  const refs = [];
  for (const file of await jsonFiles(unitDir)) {
    const unit = JSON.parse(await readFile(file, "utf8"));
    refs.push(...unit.blocks.filter((block) => block.kind === "formula-ref").map((block) => block.assetId));
  }
  assert.equal(formulaIds.length, 515);
  assert.equal(new Set(formulaIds).size, formulaIds.length);
  assert.deepEqual(refs.toSorted(), formulaIds.toSorted());
});
