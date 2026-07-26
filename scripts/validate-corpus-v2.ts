import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ErrorObject, ValidateFunction } from "ajv";
import type { FormatsPlugin } from "ajv-formats";
import { sourceRegistryV2Schema } from "../src/schema/source-registry-v2.schema.ts";
import { walkFiles } from "./lib/walk-content.ts";
import { validateCanonicalUnitSemantics } from "./lib/validate-canonical-unit.ts";

const repoRoot = fileURLToPath(new URL("../", import.meta.url));
const schemaFile = join(repoRoot, "schemas", "corpus-v2.schema.json");
const assetSchemaFile = join(repoRoot, "schemas", "corpus-assets-v2.schema.json");
const registryFile = join(repoRoot, "sources", "registry", "sources.v2.json");
const fixturesDir = join(repoRoot, "fixtures", "corpus-v2");
const corpusDir = join(repoRoot, "corpus", "units");
const assetManifestDir = join(repoRoot, "corpus", "assets");
let errors = 0;
let validFixtures = 0;
let invalidFixtures = 0;
let corpusRecords = 0;
let assetManifests = 0;
const validFixtureRecords: Array<{ label: string; value: unknown }> = [];
const validCorpusRecords: Array<{ label: string; value: unknown }> = [];
const validAssetRecords: Array<{ label: string; value: AssetManifest }> = [];

type Asset = {
    id: string;
    unitId: string;
    pdfPage: number;
};

type TableCell = {
    text: string;
    colSpan?: number;
    rowSpan?: number;
};

type TableAsset = Asset & {
    columnCount: number;
    headers: TableCell[][];
    rows: TableCell[][];
};

type FigureAsset = Asset & {
    imagePath: string;
    sha256: string;
};

type AssetManifest = {
    sourceId: string;
    formulas: Asset[];
    tables: TableAsset[];
    figures: FigureAsset[];
};

const [schema, assetSchema, registryValue] = await Promise.all([
    readFile(schemaFile, "utf8").then((raw) => JSON.parse(raw) as object),
    readFile(assetSchemaFile, "utf8").then((raw) => JSON.parse(raw) as object),
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
const validateAssetSchema = ajv.compile(assetSchema);

function schemaErrors(validator: ValidateFunction): string {
    return (validator.errors ?? [])
        .map(
            (issue: ErrorObject) =>
                `${issue.instancePath || "/"} ${issue.message ?? "errore"}`,
        )
        .join("; ");
}

async function loadExpectedValid(
    filePath: string,
    label: string,
    target: Array<{ label: string; value: unknown }>,
): Promise<void> {
    const value: unknown = JSON.parse(await readFile(filePath, "utf8"));
    if (!validateSchema(value)) {
        errors += 1;
        console.error(`  ERRORE ${label}: ${schemaErrors(validateSchema)}`);
        return;
    }
    target.push({ label, value });
}

const fixtures = await walkFiles(fixturesDir, ".json");
for (const fixture of fixtures) {
    const value: unknown = JSON.parse(await readFile(fixture.absolutePath, "utf8"));
    if (fixture.relativePath.endsWith(".valid.json")) {
        validFixtures += 1;
        await loadExpectedValid(
            fixture.absolutePath,
            fixture.relativePath,
            validFixtureRecords,
        );
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
    await loadExpectedValid(
        file.absolutePath,
        file.relativePath,
        validCorpusRecords,
    );
}

const assetFiles = await walkFiles(assetManifestDir, ".json");
for (const file of assetFiles) {
    assetManifests += 1;
    const value: unknown = JSON.parse(await readFile(file.absolutePath, "utf8"));
    if (!validateAssetSchema(value)) {
        errors += 1;
        console.error(
            `  ERRORE asset ${file.relativePath}: ${schemaErrors(validateAssetSchema)}`,
        );
        continue;
    }
    validAssetRecords.push({
        label: file.relativePath,
        value: value as AssetManifest,
    });
}

for (const [scope, records] of [
    ["fixture", validFixtureRecords],
    ["corpus", validCorpusRecords],
] as const) {
    const canonicalIds = records.map(
        (record) => (record.value as { id: string }).id,
    );
    const knownUnitIds = new Set(canonicalIds);
    if (knownUnitIds.size !== canonicalIds.length) {
        errors += 1;
        console.error(`  ERRORE: ID canonici duplicati nel perimetro ${scope}`);
    }
    for (const record of records) {
        for (const issue of validateCanonicalUnitSemantics(
            record.value,
            registry,
            knownUnitIds,
        )) {
            errors += 1;
            console.error(`  ERRORE ${record.label}: ${issue}`);
        }
    }
}

const corpusUnitIds = new Set(
    validCorpusRecords.map((record) => (record.value as { id: string }).id),
);
const declaredAssetIds = new Set<string>();
for (const record of validCorpusRecords) {
    const assets = (
        record.value as {
            assets: {
                formulaIds: string[];
                tableIds: string[];
                figureIds: string[];
            };
        }
    ).assets;
    for (const id of [
        ...assets.formulaIds,
        ...assets.tableIds,
        ...assets.figureIds,
    ]) {
        if (declaredAssetIds.has(id)) {
            errors += 1;
            console.error(`  ERRORE asset dichiarato da più unità: ${id}`);
        }
        declaredAssetIds.add(id);
    }
}

function validateTableRows(
    label: string,
    rows: TableCell[][],
    columnCount: number,
): void {
    const occupied = Array<number>(columnCount).fill(0);
    rows.forEach((row, rowIndex) => {
        let column = 0;
        for (const cell of row) {
            while (column < columnCount && occupied[column]! > 0) column += 1;
            const colSpan = cell.colSpan ?? 1;
            const rowSpan = cell.rowSpan ?? 1;
            if (column + colSpan > columnCount) {
                errors += 1;
                console.error(
                    `  ERRORE ${label}: riga ${rowIndex + 1} supera ${columnCount} colonne`,
                );
                return;
            }
            for (let offset = 0; offset < colSpan; offset += 1) {
                if (occupied[column + offset]! > 0) {
                    errors += 1;
                    console.error(
                        `  ERRORE ${label}: sovrapposizione di celle alla riga ${rowIndex + 1}`,
                    );
                    return;
                }
                occupied[column + offset] = rowSpan;
            }
            column += colSpan;
        }
        if (occupied.some((span) => span === 0)) {
            errors += 1;
            console.error(
                `  ERRORE ${label}: riga ${rowIndex + 1} non copre ${columnCount} colonne`,
            );
        }
        for (let index = 0; index < occupied.length; index += 1) {
            occupied[index] = Math.max(0, occupied[index]! - 1);
        }
    });
    if (occupied.some((span) => span > 0)) {
        errors += 1;
        console.error(`  ERRORE ${label}: rowSpan oltre l'ultima riga`);
    }
}

const manifestAssetIds = new Set<string>();
const registeredSourceIds = new Set(
    registry.works.flatMap((work) =>
        work.manifestations.map((manifestation) => manifestation.sourceId),
    ),
);
for (const record of validAssetRecords) {
    if (!registeredSourceIds.has(record.value.sourceId)) {
        errors += 1;
        console.error(
            `  ERRORE asset ${record.label}: sourceId non registrato ${record.value.sourceId}`,
        );
    }
    for (const asset of [
        ...record.value.formulas,
        ...record.value.tables,
        ...record.value.figures,
    ]) {
        if (manifestAssetIds.has(asset.id)) {
            errors += 1;
            console.error(`  ERRORE asset duplicato nei manifest: ${asset.id}`);
        }
        manifestAssetIds.add(asset.id);
        if (!corpusUnitIds.has(asset.unitId)) {
            errors += 1;
            console.error(
                `  ERRORE ${asset.id}: unità canonica inesistente ${asset.unitId}`,
            );
        }
    }
    for (const table of record.value.tables) {
        validateTableRows(`${table.id} intestazione`, table.headers, table.columnCount);
        validateTableRows(`${table.id} corpo`, table.rows, table.columnCount);
    }
    for (const figure of record.value.figures) {
        const imageFile = join(repoRoot, "corpus", "assets", figure.imagePath);
        const digest = createHash("sha256")
            .update(await readFile(imageFile))
            .digest("hex");
        if (digest !== figure.sha256) {
            errors += 1;
            console.error(`  ERRORE ${figure.id}: sha256 del ritaglio non corrisponde`);
        }
    }
}

for (const assetId of declaredAssetIds) {
    if (!manifestAssetIds.has(assetId)) {
        errors += 1;
        console.error(`  ERRORE asset dichiarato senza manifest: ${assetId}`);
    }
}
for (const assetId of manifestAssetIds) {
    if (!declaredAssetIds.has(assetId)) {
        errors += 1;
        console.error(`  ERRORE asset nel manifest non referenziato: ${assetId}`);
    }
}

if (validFixtures === 0 || invalidFixtures === 0) {
    errors += 1;
    console.error("  ERRORE: richieste almeno una fixture valida e una non valida");
}

console.log(
    `validate-corpus-v2: ${validFixtures} fixture valide, ${invalidFixtures} fixture negative, ${corpusRecords} record canonici, ${assetManifests} manifest asset, ${errors} errori`,
);
if (errors > 0) process.exitCode = 1;
