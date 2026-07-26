import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { normalizeText } from "../scripts/lib/normalization.ts";
import { workflowTransitionBlockers } from "../scripts/lib/workflow.ts";
import { sourceRegistryV2Schema } from "../src/schema/source-registry-v2.schema.ts";

test("normalizzazione conserva una traccia hash per ogni operazione", () => {
    const raw = "C3.3.7\u0002 COEFFICIENTE\r\nDI\u00A0ESPOSIZIONE";
    const result = normalizeText(
        raw,
        [
            "unicode-nfc",
            "normalize-line-endings",
            "remove-control-character",
            "normalize-whitespace",
        ],
        "Rimozione artefatti meccanici della fixture",
    );
    assert.equal(result.normalized, "C3.3.7 COEFFICIENTE\nDI ESPOSIZIONE");
    assert.equal(result.transformations.length, 4);
    assert.equal(
        result.transformations.every(
            (item) =>
                item.beforeSha256.length === 64 && item.afterSha256.length === 64,
        ),
        true,
    );
});

test("normalizzazione non rimuove il trattino visibile a fine riga", () => {
    const result = normalizeText(
        "catego-\nria",
        ["remove-discretionary-hyphen"],
        "Il trattino visibile richiede decisione umana",
    );
    assert.equal(result.normalized, "catego-\nria");
});

test("il workflow rifiuta il salto diretto draft → published", async () => {
    const fixture = JSON.parse(
        await readFile(
            fileURLToPath(
                new URL(
                    "../fixtures/corpus-v2/ntc2018-3.3.7.metadata.valid.json",
                    import.meta.url,
                ),
            ),
            "utf8",
        ),
    ) as unknown;
    const registry = sourceRegistryV2Schema.parse(
        JSON.parse(
            await readFile(
                fileURLToPath(
                    new URL("../sources/registry/sources.v2.json", import.meta.url),
                ),
                "utf8",
            ),
        ) as unknown,
    );
    assert.deepEqual(workflowTransitionBlockers(fixture, "published", registry), [
        "transizione non ammessa: draft → published",
    ]);
});
