import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ErrorObject } from "ajv";
import type { FormatsPlugin } from "ajv-formats";
import { sourceRegistryV2Schema } from "../src/schema/source-registry-v2.schema.ts";
import { walkFiles } from "./lib/walk-content.ts";
import { validateCanonicalUnitSemantics } from "./lib/validate-canonical-unit.ts";

const repoRoot = fileURLToPath(new URL("../", import.meta.url));
const schemaFile = join(repoRoot, "schemas", "corpus-v2.schema.json");
const registryFile = join(repoRoot, "sources", "registry", "sources.v2.json");
const fixturesDir = join(repoRoot, "fixtures", "corpus-v2");
const corpusDir = join(repoRoot, "corpus");
let errors = 0;
let validFixtures = 0;
let invalidFixtures = 0;
let corpusRecords = 0;
const validRecords: Array<{ label: string; value: unknown }> = [];

const [schema, registryValue] = await Promise.all([
    readFile(schemaFile, "utf8").then((raw) => JSON.parse(raw) as object),
    readFile(registryFile, "utf8").then((raw) => JSON.parse(raw) as unknown),
]);
const registry = sourceRegistryV2Schema.parse(registryValue);
const { Ajv2020 } = await import("ajv/dist/2020.js");
const addFormatsModule = await import("ajv-formats");
const addFormats = addFormatsModule.default as unknown as FormatsPlugin;
const ajv = new Ajv2020({
    allErrors: true,
    strict: true,
});
addFormats(ajv);
const validateSchema = ajv.compile(schema);

function schemaErrors(): string {
    return (validateSchema.errors ?? [])
        .map(
            (issue: ErrorObject) =>
                `${issue.instancePath || "/"} ${issue.message ?? "errore"}`,
        )
        .join("; ");
}

async function loadExpectedValid(filePath: string, label: string): Promise<void> {
    const value: unknown = JSON.parse(await readFile(filePath, "utf8"));
    if (!validateSchema(value)) {
        errors += 1;
        console.error(`  ERRORE ${label}: ${schemaErrors()}`);
        return;
    }
    validRecords.push({ label, value });
}

const fixtures = await walkFiles(fixturesDir, ".json");
for (const fixture of fixtures) {
    const value: unknown = JSON.parse(await readFile(fixture.absolutePath, "utf8"));
    if (fixture.relativePath.endsWith(".valid.json")) {
        validFixtures += 1;
        await loadExpectedValid(fixture.absolutePath, fixture.relativePath);
    } else if (fixture.relativePath.endsWith(".invalid.json")) {
        invalidFixtures += 1;
        if (validateSchema(value)) {
            errors += 1;
            console.error(
                `  ERRORE ${fixture.relativePath}: fixture negativa accettata dallo schema`,
            );
        }
    }
}

const corpusFiles = await walkFiles(corpusDir, ".json");
for (const file of corpusFiles) {
    corpusRecords += 1;
    await loadExpectedValid(file.absolutePath, file.relativePath);
}

const canonicalIds = validRecords.map(
    (record) => (record.value as { id: string }).id,
);
const knownUnitIds = new Set(canonicalIds);
if (knownUnitIds.size !== canonicalIds.length) {
    errors += 1;
    console.error("  ERRORE: ID canonici duplicati tra fixture e corpus");
}
for (const record of validRecords) {
    for (const issue of validateCanonicalUnitSemantics(
        record.value,
        registry,
        knownUnitIds,
    )) {
        errors += 1;
        console.error(`  ERRORE ${record.label}: ${issue}`);
    }
}

if (validFixtures === 0 || invalidFixtures === 0) {
    errors += 1;
    console.error("  ERRORE: richieste almeno una fixture valida e una non valida");
}

console.log(
    `validate-corpus-v2: ${validFixtures} fixture valide, ${invalidFixtures} fixture negative, ${corpusRecords} record canonici, ${errors} errori`,
);
if (errors > 0) process.exitCode = 1;
