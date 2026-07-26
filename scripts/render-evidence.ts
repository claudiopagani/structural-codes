import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import {
    createCanvas,
    DOMMatrix,
    ImageData,
    Path2D,
} from "@napi-rs/canvas";
import { sha256OfFile } from "../src/lib/hash.ts";
import { sourceRegistryV2Schema } from "../src/schema/source-registry-v2.schema.ts";
import { EVIDENCE_PIPELINE_VERSION } from "./lib/evidence.ts";

const repoRoot = fileURLToPath(new URL("../", import.meta.url));
const registryFile = join(repoRoot, "sources", "registry", "sources.v2.json");

function argument(name: string): string | undefined {
    const index = process.argv.indexOf(name);
    return index === -1 ? undefined : process.argv[index + 1];
}

function positiveNumber(name: string, fallback?: number): number {
    const raw = argument(name);
    if (raw === undefined && fallback !== undefined) return fallback;
    const value = Number(raw);
    if (!Number.isFinite(value) || value <= 0) {
        throw new Error(`${name} deve essere un numero positivo`);
    }
    return value;
}

const sourceId = argument("--source");
if (sourceId === undefined) {
    console.error(
        "Uso: render-evidence --source <sourceId> --page <n> [--region x,y,w,h] [--scale 2]",
    );
    process.exit(2);
}
const pdfPage = positiveNumber("--page");
if (!Number.isInteger(pdfPage)) throw new Error("--page deve essere intero");
const scale = positiveNumber("--scale", 2);
const regionRaw = argument("--region");
const region =
    regionRaw === undefined
        ? null
        : (() => {
              const values = regionRaw.split(",").map(Number);
              if (
                  values.length !== 4 ||
                  values.some((value) => !Number.isFinite(value) || value < 0) ||
                  values[2] === 0 ||
                  values[3] === 0
              ) {
                  throw new Error("--region richiede x,y,width,height non negativi");
              }
              return {
                  x: values[0]!,
                  y: values[1]!,
                  width: values[2]!,
                  height: values[3]!,
              };
          })();

const registry = sourceRegistryV2Schema.parse(
    JSON.parse(await readFile(registryFile, "utf8")) as unknown,
);
const manifestation = registry.works
    .flatMap((work) => work.manifestations)
    .find((item) => item.sourceId === sourceId);
if (manifestation === undefined) throw new Error(`Fonte non registrata: ${sourceId}`);
if (pdfPage > manifestation.pageCount) {
    throw new Error(`pagina ${pdfPage} oltre il limite ${manifestation.pageCount}`);
}

const pdfPath = resolve(repoRoot, manifestation.localFile);
const allowedRoot = resolve(repoRoot, "raw-sources") + sep;
if (!pdfPath.startsWith(allowedRoot)) {
    throw new Error(`percorso fonte fuori da raw-sources/: ${manifestation.localFile}`);
}
const currentHash = await sha256OfFile(pdfPath);
if (currentHash !== manifestation.sha256) {
    throw new Error(`hash locale difforme per ${sourceId}`);
}

Object.assign(globalThis, { DOMMatrix, ImageData, Path2D });
const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
const document = await pdfjs.getDocument({
    data: new Uint8Array(await readFile(pdfPath)),
    useSystemFonts: false,
}).promise;
const page = await document.getPage(pdfPage);
const viewport = page.getViewport({ scale });
const fullCanvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
const context = fullCanvas.getContext("2d");
context.fillStyle = "#ffffff";
context.fillRect(0, 0, fullCanvas.width, fullCanvas.height);
await page.render({
    canvasContext:
        context as unknown as Parameters<typeof page.render>[0]["canvasContext"],
    viewport,
    background: "#ffffff",
}).promise;

let outputCanvas = fullCanvas;
if (region !== null) {
    const sx = Math.floor(region.x * scale);
    const sy = Math.floor(region.y * scale);
    const sw = Math.ceil(region.width * scale);
    const sh = Math.ceil(region.height * scale);
    if (sx + sw > fullCanvas.width || sy + sh > fullCanvas.height) {
        throw new Error("regione oltre i limiti della pagina");
    }
    outputCanvas = createCanvas(sw, sh);
    outputCanvas.getContext("2d").drawImage(
        fullCanvas,
        sx,
        sy,
        sw,
        sh,
        0,
        0,
        sw,
        sh,
    );
}
await document.destroy();

const renderKey =
    region === null
        ? `page-${String(pdfPage).padStart(4, "0")}-full`
        : `page-${String(pdfPage).padStart(4, "0")}-x${region.x}-y${region.y}-w${region.width}-h${region.height}`;
const outDir = join(repoRoot, "evidence", sourceId, "renders");
const pngFile = join(outDir, `${renderKey}@${scale}x.png`);
await mkdir(dirname(pngFile), { recursive: true });
await writeFile(pngFile, outputCanvas.toBuffer("image/png"));
const pngSha256 = await sha256OfFile(pngFile);
const sidecar = {
    renderManifestVersion: 1,
    pipelineVersion: EVIDENCE_PIPELINE_VERSION,
    sourceId,
    sourceSha256: currentHash,
    pdfPage,
    coordinateSystem: "pdf-points-top-left",
    region,
    scale,
    output: basename(pngFile),
    pngSha256,
};
const sidecarFile = pngFile.replace(/\.png$/u, ".json");
await writeFile(sidecarFile, `${JSON.stringify(sidecar, null, 2)}\n`, "utf8");
console.log(`Render: ${pngFile}`);
console.log(`SHA-256: ${pngSha256}`);
