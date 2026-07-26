import assert from "node:assert/strict";
import test from "node:test";
import {
    canonicalJson,
    detectEvidenceAnomalies,
    detectPrintedPage,
    parsePageRange,
    reconstructRawText,
    sha256OfCanonicalJson,
    type EvidenceTextItem,
} from "../scripts/lib/evidence.ts";

function item(
    sequence: number,
    text: string,
    x: number,
    y: number,
    hasEol = false,
): EvidenceTextItem {
    return {
        sequence,
        text,
        direction: "ltr",
        fontName: "fixture",
        hasEol,
        transform: [1, 0, 0, 1, x, y],
        region: {
            coordinateSystem: "pdf-points-top-left",
            x,
            y,
            width: text.length * 5,
            height: 10,
        },
        angleDegrees: 0,
    };
}

test("canonicalJson e hash sono indipendenti dall'ordine delle chiavi", () => {
    const first = { z: 1, a: { y: 2, b: 3 } };
    const second = { a: { b: 3, y: 2 }, z: 1 };
    assert.equal(canonicalJson(first), canonicalJson(second));
    assert.equal(sha256OfCanonicalJson(first), sha256OfCanonicalJson(second));
});

test("parsePageRange accetta intervalli chiusi e rifiuta quelli invertiti", () => {
    assert.deepEqual(parsePageRange("55-58"), { from: 55, to: 58 });
    assert.throws(() => parsePageRange("58-55"), /invertito/u);
    assert.throws(() => parsePageRange("0-2"), /non valido/u);
});

test("reconstructRawText preserva ordine e interruzioni geometriche", () => {
    const items = [
        item(0, "Prima", 10, 20),
        item(1, "riga", 45, 20, true),
        item(2, "Seconda", 10, 40),
    ];
    assert.equal(reconstructRawText(items), "Prima riga\nSeconda");
});

test("reconstructRawText non trasforma un pedice in un cambio riga", () => {
    const items = [
        item(0, "c", 72, 162),
        item(1, " ", 76, 162),
        item(2, "e", 77, 167),
        item(3, " coefficiente", 80, 162),
    ];
    assert.equal(reconstructRawText(items), "c e coefficiente");
});

test("rileva pagina stampata e caratteri di controllo senza correggerli", () => {
    const raw = "— 54 —\nC3.3.7\u0002 TITOLO";
    const items = [item(0, raw, 0, 0)];
    assert.equal(detectPrintedPage(raw), "54");
    const anomalies = detectEvidenceAnomalies(items, raw, 800);
    assert.deepEqual(anomalies.controlCharacters, [
        { sequence: 0, codePoints: ["U+0002"] },
    ]);
});
