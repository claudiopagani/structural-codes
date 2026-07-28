import { readFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../", import.meta.url));
const viewerDirectory = join(repoRoot, "viewer");
const viewerManifest = JSON.parse(
  readFileSync(join(viewerDirectory, "package.json"), "utf8"),
);
const viewerLock = JSON.parse(
  readFileSync(join(viewerDirectory, "package-lock.json"), "utf8"),
);
const approved = new Map(
  Object.entries(viewerManifest.allowScripts ?? {}).map(([specifier, allowed]) => {
    const separator = specifier.lastIndexOf("@");
    if (allowed !== true || separator <= 0) {
      throw new Error(`allowScripts non valido: ${specifier}`);
    }
    return [specifier.slice(0, separator), specifier.slice(separator + 1)];
  }),
);
const found = new Map();

function supportsCurrentPlatform(metadata) {
  if (!metadata.os) return true;
  const allowed = metadata.os.filter((value) => !value.startsWith("!"));
  const denied = metadata.os
    .filter((value) => value.startsWith("!"))
    .map((value) => value.slice(1));
  return !denied.includes(process.platform) &&
    (allowed.length === 0 || allowed.includes(process.platform));
}

function packageNameFromLockPath(packagePath) {
  const segments = packagePath.replaceAll("\\", "/").split("node_modules/");
  const packageSegments = segments.at(-1).split("/");
  return packageSegments[0].startsWith("@")
    ? `${packageSegments[0]}/${packageSegments[1]}`
    : packageSegments[0];
}

for (const [packagePath, metadata] of Object.entries(viewerLock.packages ?? {})) {
  if (!packagePath || !metadata.hasInstallScript || !supportsCurrentPlatform(metadata)) {
    continue;
  }
  const packageName = metadata.name ?? packageNameFromLockPath(packagePath);
  const expectedVersion = approved.get(packageName);
  if (expectedVersion !== metadata.version) {
    throw new Error(
      `${packageName}@${metadata.version} contiene install script ma non è approvato`,
    );
  }
  found.set(packageName, metadata.version);
}

for (const [packageName, version] of approved) {
  if (found.get(packageName) !== version) {
    throw new Error(
      `${packageName}@${version} è approvato ma non corrisponde al lockfile`,
    );
  }
}

const npmExecPath = process.env.npm_execpath;
const npmCommand = npmExecPath ? process.execPath : process.platform === "win32" ? "npm.cmd" : "npm";

function runNpm(arguments_) {
  const commandArguments = npmExecPath ? [npmExecPath, ...arguments_] : arguments_;
  const result = spawnSync(npmCommand, commandArguments, {
    cwd: repoRoot,
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

runNpm(["--prefix", "viewer", "ci", "--ignore-scripts"]);
runNpm([
  "--prefix",
  "viewer",
  "rebuild",
  "--ignore-scripts=false",
  ...approved.keys(),
]);
