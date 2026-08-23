import { copyFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { generateArtifacts } from "../shared/generate-artifacts.mjs";

const viewerRoot = fileURLToPath(new URL("../", import.meta.url));
const result = await generateArtifacts({
  sourcePackage: "structural-codes",
  outputDirectory: join(viewerRoot, "public", "data", "codes"),
  assetOutputDirectory: join(viewerRoot, "public", "assets"),
});

const pdfWorkerFile = fileURLToPath(import.meta.resolve("pdfjs-dist/build/pdf.worker.min.mjs"));
const pdfWorkerOutput = join(viewerRoot, "public", "vendor", "pdf.worker.min.mjs");
await mkdir(dirname(pdfWorkerOutput), { recursive: true });
await copyFile(pdfWorkerFile, pdfWorkerOutput);

console.log(
  `sync-corpus: ${result.units} unità in ${result.chunks} chunk; ` +
  `${result.relations} relazioni esplicite, ${result.diagnostics} suggerimenti diagnostici; ` +
  `manifest ${result.manifestBytes} byte, figure ${result.figureBytes} byte; ` +
  `artifact sha256 ${result.artifactFingerprintSha256}`,
);
