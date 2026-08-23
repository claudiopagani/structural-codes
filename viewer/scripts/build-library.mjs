import { cp, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const viewerRoot = fileURLToPath(new URL("../", import.meta.url));
const outputDirectory = join(viewerRoot, "package-dist");
await rm(outputDirectory, { recursive: true, force: true });

const tsc = join(viewerRoot, "node_modules", "typescript", "bin", "tsc");
const result = spawnSync(process.execPath, [tsc, "-p", join(viewerRoot, "tsconfig.library.json")], { cwd: viewerRoot, stdio: "inherit" });
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);

await mkdir(outputDirectory, { recursive: true });
await cp(join(viewerRoot, "shared", "styles.css"), join(outputDirectory, "styles.css"));
await cp(join(viewerRoot, "shared", "generate-artifacts.mjs"), join(outputDirectory, "generate-artifacts.mjs"));
console.log(`library build: ${outputDirectory}`);
