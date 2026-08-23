import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const repositoryRoot = fileURLToPath(new URL("../", import.meta.url));
const packageManifest = JSON.parse(
  await readFile(join(repositoryRoot, "package.json"), "utf8"),
);
const temporaryRoot = await mkdtemp(join(tmpdir(), "structural-codes-release-"));

function fail(message) {
  throw new Error(`release package: ${message}`);
}

function run(command, arguments_, options = {}) {
  const result = spawnSync(command, arguments_, {
    cwd: options.cwd ?? repositoryRoot,
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
    stdio: options.capture === false ? "inherit" : "pipe",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    if (result.stdout) process.stderr.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    fail(`${command} ${arguments_.join(" ")} ha restituito ${result.status}`);
  }
  return result.stdout ?? "";
}

function runNpm(arguments_, options = {}) {
  const npmExecPath = process.env.npm_execpath;
  if (npmExecPath) {
    return run(process.execPath, [npmExecPath, ...arguments_], options);
  }
  const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
  return run(npmCommand, arguments_, options);
}

function parsePackJson(raw, label) {
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    fail(`${label}: output npm non JSON (${String(error)})`);
  }
  const record = parsed[0];
  if (!record || !Array.isArray(record.files)) {
    fail(`${label}: inventario file npm mancante`);
  }
  return record;
}

const forbiddenPath =
  /(^|\/)(?:viewer|scripts|src|tests|fixtures|docs|raw-sources|evidence|review|tmp|\.audit-private|node_modules|\.github)(?:\/|$)|(^|\/)\.env(?:\.|$)|\.(?:log|pdf|tgz|tsbuildinfo|pyc)$/iu;
const requiredFiles = [
  "LICENSE",
  "NOTICE",
  "README.md",
  "package.json",
  "dist/index.js",
  "dist/index.d.ts",
  "dist/corpus/index.js",
  "dist/corpus/index.d.ts",
  "dist/schema/index.js",
  "dist/schema/index.d.ts",
  "dist/lib/index.js",
  "dist/lib/index.d.ts",
  "schemas/corpus-v2.schema.json",
  "schemas/corpus-assets-v2.schema.json",
  "corpus/manifest.json",
  "corpus/units/ntc2018/4.1.json",
  "corpus/units/circ2019/c4.1.json",
  "sources/registry/sources.v2.json",
  "integration/structural-checks-ts/manifest.json",
];

function verifyInventory(record, label) {
  if (record.name !== "structural-codes") {
    fail(`${label}: nome inatteso ${String(record.name)}`);
  }
  if (record.version !== packageManifest.version) {
    fail(`${label}: versione inattesa ${String(record.version)}`);
  }
  if (!/-(?:alpha|beta|rc)\./u.test(record.version)) {
    fail(`${label}: la prima pubblicazione deve restare una prerelease SemVer`);
  }
  const paths = record.files.map(({ path }) => path.replaceAll("\\", "/"));
  const pathSet = new Set(paths);
  for (const required of requiredFiles) {
    if (!pathSet.has(required)) fail(`${label}: file richiesto assente ${required}`);
  }
  const forbidden = paths.filter((path) => forbiddenPath.test(path));
  if (forbidden.length > 0) {
    fail(`${label}: file vietati: ${forbidden.join(", ")}`);
  }
  if (paths.some((path) => path.startsWith("viewer/"))) {
    fail(`${label}: il viewer non deve entrare nel package runtime`);
  }
  return paths;
}

try {
  if (packageManifest.private === true) fail("package.json contiene ancora private:true");
  if (packageManifest.publishConfig?.access !== "public") {
    fail("publishConfig.access deve essere public");
  }

  const dryRun = parsePackJson(
    runNpm(["pack", "--dry-run", "--json", "--ignore-scripts"]),
    "dry-run",
  );
  const dryPaths = verifyInventory(dryRun, "dry-run");

  const packed = parsePackJson(
    runNpm([
      "pack",
      "--json",
      "--ignore-scripts",
      "--pack-destination",
      temporaryRoot,
    ]),
    "tarball",
  );
  const packedPaths = verifyInventory(packed, "tarball");
  const tarball = resolve(temporaryRoot, packed.filename);
  const tarEntries = run("tar", ["-tf", tarball])
    .split(/\r?\n/u)
    .filter(Boolean);
  const actualFiles = tarEntries
    .filter((entry) => !entry.endsWith("/"))
    .map((entry) => entry.replace(/^package\//u, ""));
  const actualSet = new Set(actualFiles);

  for (const path of packedPaths) {
    if (!actualSet.has(path)) fail(`tarball reale privo di ${path}`);
  }
  if (actualFiles.some((path) => forbiddenPath.test(path))) {
    fail("il tarball reale contiene un percorso vietato");
  }
  if (dryPaths.length !== packedPaths.length) {
    fail("dry-run e tarball reale hanno inventari diversi");
  }

  const consumerRoot = join(temporaryRoot, "consumer");
  await mkdir(consumerRoot, { recursive: true });
  await writeFile(
    join(consumerRoot, "package.json"),
    `${JSON.stringify({ private: true, type: "module" }, null, 2)}\n`,
    "utf8",
  );
  runNpm(
    ["install", "--ignore-scripts", "--no-audit", "--no-fund", tarball],
    { cwd: consumerRoot },
  );

  const runtimeConsumer = `
import assert from "node:assert/strict";
import {
  CANONICAL_UNIT_SCHEMA_VERSION,
  compareCanonicalUnits,
  createUnitIndex,
  documentIdFromUnitId,
  findIncomingRelations,
  sourceRegistryV2Schema,
} from "structural-codes";
import { sha256OfText } from "structural-codes/lib";
import corpusManifest from "structural-codes/corpus/manifest.json" with { type: "json" };
import ntcUnit from "structural-codes/corpus/units/ntc2018/4.1.json" with { type: "json" };
import circUnit from "structural-codes/corpus/units/circ2019/c4.1.json" with { type: "json" };
import registry from "structural-codes/sources/registry" with { type: "json" };
import integration from "structural-codes/integration/structural-checks-ts" with { type: "json" };

assert.equal(CANONICAL_UNIT_SCHEMA_VERSION, "2.0.0-alpha.2");
assert.equal(corpusManifest.status, "canonical-extracted-not-reviewed");
assert.equal(documentIdFromUnitId(ntcUnit.id), "ntc2018");
assert.equal(createUnitIndex([ntcUnit, circUnit]).size, 2);
assert.equal(compareCanonicalUnits(ntcUnit, ntcUnit), 0);
assert.equal(findIncomingRelations([ntcUnit, circUnit], ntcUnit.id).length, 1);
assert.equal(sourceRegistryV2Schema.parse(registry).registryVersion, 2);
assert.equal(integration.provider.currentName, "structural-checks-ts");
assert.equal(sha256OfText("structural-codes").length, 64);
`;
  await writeFile(join(consumerRoot, "consumer.mjs"), runtimeConsumer, "utf8");
  run(process.execPath, ["consumer.mjs"], { cwd: consumerRoot, capture: false });

  const typeConsumer = `
import {
  createUnitIndex,
  type CanonicalUnitLike,
  type StructuralCodesDocumentId,
} from "structural-codes";
import { sha256OfText } from "structural-codes/lib";

declare const units: CanonicalUnitLike[];
const index: ReadonlyMap<string, CanonicalUnitLike> = createUnitIndex(units);
const document: StructuralCodesDocumentId = "ntc2018";
void index;
void document;
void sha256OfText("types");
`;
  await writeFile(join(consumerRoot, "consumer.ts"), typeConsumer, "utf8");
  const tsc = join(repositoryRoot, "node_modules", "typescript", "bin", "tsc");
  run(
    process.execPath,
    [
      tsc,
      "--noEmit",
      "--strict",
      "--target",
      "ES2022",
      "--module",
      "NodeNext",
      "--moduleResolution",
      "NodeNext",
      "consumer.ts",
    ],
    { cwd: consumerRoot, capture: false },
  );

  console.log(
    `release-package: ${packedPaths.length} file, ${packed.size} byte packed, ${packed.unpackedSize} byte unpacked; consumer runtime e tipi validi`,
  );
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}
