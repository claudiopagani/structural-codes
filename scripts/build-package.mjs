import { rm } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repositoryRoot = fileURLToPath(new URL("../", import.meta.url));
const outputDirectory = resolve(repositoryRoot, "dist");

if (dirname(outputDirectory) !== resolve(repositoryRoot)) {
  throw new Error(`directory di build non sicura: ${outputDirectory}`);
}

await rm(outputDirectory, { recursive: true, force: true });

const tsc = join(repositoryRoot, "node_modules", "typescript", "bin", "tsc");
const result = spawnSync(process.execPath, [tsc, "-p", "tsconfig.build.json"], {
  cwd: repositoryRoot,
  stdio: "inherit",
});

if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);
