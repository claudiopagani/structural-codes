import assert from "node:assert/strict";
import test from "node:test";
import { normalizeText } from "../scripts/lib/normalization.ts";

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
