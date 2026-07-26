import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";
import type { FormatsPlugin } from "ajv-formats";
import { validateCanonicalUnitSemantics } from "../scripts/lib/validate-canonical-unit.ts";
import { sourceRegistryV2Schema } from "../src/schema/source-registry-v2.schema.ts";

const schemaFile = fileURLToPath(
    new URL("../schemas/corpus-v2.schema.json", import.meta.url),
);
const validFixtureFile = fileURLToPath(
    new URL(
        "../fixtures/corpus-v2/ntc2018-3.3.7.metadata.valid.json",
        import.meta.url,
    ),
);
const invalidFixtureFile = fileURLToPath(
    new URL("../fixtures/corpus-v2/missing-evidence.invalid.json", import.meta.url),
);
const registryFile = fileURLToPath(
    new URL("../sources/registry/sources.v2.json", import.meta.url),
);

async function compileValidator() {
    const { Ajv2020 } = await import("ajv/dist/2020.js");
    const addFormatsModule = await import("ajv-formats");
    const addFormats = addFormatsModule.default as unknown as FormatsPlugin;
    const ajv = new Ajv2020({ allErrors: true, strict: true });
    addFormats(ajv);
    const schema = JSON.parse(await readFile(schemaFile, "utf8")) as object;
    return ajv.compile(schema);
}

async function fixture(file: string): Promise<unknown> {
    return JSON.parse(await readFile(file, "utf8")) as unknown;
}

test("la fixture NTC reale supera schema e vincoli semantici", async () => {
    const validate = await compileValidator();
    const value = await fixture(validFixtureFile);
    assert.equal(validate(value), true, JSON.stringify(validate.errors));

    const registry = sourceRegistryV2Schema.parse(await fixture(registryFile));
    assert.deepEqual(validateCanonicalUnitSemantics(value, registry), []);
});

test("lo schema rifiuta un blocco ufficiale senza evidence", async () => {
    const validate = await compileValidator();
    assert.equal(validate(await fixture(invalidFixtureFile)), false);
});

test("il validatore semantico rifiuta hash e sourceId non coerenti", async () => {
    const value = (await fixture(validFixtureFile)) as {
        blocks: Array<{
            evidence: {
                sourceId: string;
                rawSha256: string;
            };
        }>;
    };
    value.blocks[0]!.evidence.sourceId = "source-inesistente";
    value.blocks[0]!.evidence.rawSha256 = "0".repeat(64);
    const registry = sourceRegistryV2Schema.parse(await fixture(registryFile));
    const errors = validateCanonicalUnitSemantics(value, registry);
    assert.equal(errors.some((issue) => issue.includes("sourceId non registrato")), true);
    assert.equal(errors.some((issue) => issue.includes("rawSha256")), true);
});

test("un revisore qualificato può firmare i due atti di review richiesti", async () => {
    const value = (await fixture(validFixtureFile)) as {
        workflow: {
            status: string;
            reviews: Array<{
                reviewId: string;
                type: string;
                reviewer: { actorId: string; kind: string };
                reviewedAt: string;
                result: string;
                note: string;
            }>;
        };
    };
    value.workflow.status = "double-reviewed";
    value.workflow.reviews = [
        {
            reviewId: "review-source-001",
            type: "source",
            reviewer: {
                actorId: "reviewer:internal:001",
                kind: "human",
            },
            reviewedAt: "2026-07-26T12:00:00Z",
            result: "accepted",
            note: "Confronto con evidence completato.",
        },
        {
            reviewId: "review-normative-001",
            type: "normative",
            reviewer: {
                actorId: "reviewer:internal:001",
                kind: "human",
            },
            reviewedAt: "2026-07-26T12:30:00Z",
            result: "accepted",
            note: "Struttura e significato tecnico verificati.",
        },
    ];

    const registry = sourceRegistryV2Schema.parse(await fixture(registryFile));
    assert.deepEqual(validateCanonicalUnitSemantics(value, registry), []);
});
