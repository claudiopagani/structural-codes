import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { sha256OfText } from "../src/lib/hash.ts";
import {
    assertNormalizationOperation,
    normalizeText,
    type NormalizationOperation,
} from "./lib/normalization.ts";

const repoRoot = fileURLToPath(new URL("../", import.meta.url));
const outputRoot = resolve(repoRoot, "review", "normalized");

function argument(name: string): string | undefined {
    const index = process.argv.indexOf(name);
    return index === -1 ? undefined : process.argv[index + 1];
}

const inputArg = argument("--input");
const operationsArg = argument("--operations");
const note = argument("--note");
if (inputArg === undefined || operationsArg === undefined || note === undefined) {
    console.error(
        "Uso: normalize-text --input <file> --operations <op,op> --note <motivazione> [--name <slug>]",
    );
    process.exit(2);
}
if (note.trim().length < 8) {
    throw new Error("--note deve descrivere la motivazione in almeno 8 caratteri");
}

const inputFile = resolve(repoRoot, inputArg);
if (
    inputFile !== repoRoot &&
    !inputFile.startsWith(resolve(repoRoot) + sep)
) {
    throw new Error("--input deve essere interno al repository");
}
const operationValues = operationsArg
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value !== "");
for (const value of operationValues) assertNormalizationOperation(value);
const operations = operationValues as NormalizationOperation[];

const raw = await readFile(inputFile, "utf8");
const result = normalizeText(raw, operations, note.trim());
const requestedName = argument("--name");
const safeName = (
    requestedName ?? basename(inputFile).replace(/\.[^.]+$/u, "")
).replace(/[^a-zA-Z0-9._-]+/gu, "-");
if (safeName.length === 0 || safeName === "." || safeName === "..") {
    throw new Error("--name non valido");
}
const textFile = join(outputRoot, `${safeName}.normalized.txt`);
const manifestFile = join(outputRoot, `${safeName}.normalization.json`);
await mkdir(dirname(textFile), { recursive: true });
await Promise.all([
    writeFile(textFile, result.normalized, "utf8"),
    writeFile(
        manifestFile,
        `${JSON.stringify(
            {
                normalizationManifestVersion: 1,
                input: relative(repoRoot, inputFile).replaceAll("\\", "/"),
                output: relative(repoRoot, textFile).replaceAll("\\", "/"),
                rawSha256: sha256OfText(raw),
                normalizedSha256: sha256OfText(result.normalized),
                transformations: result.transformations,
                recordedAt: new Date().toISOString(),
            },
            null,
            2,
        )}\n`,
        "utf8",
    ),
]);
console.log(`Normalizzato: ${textFile}`);
console.log(`Manifest: ${manifestFile}`);
