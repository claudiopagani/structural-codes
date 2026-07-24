import { test } from "node:test";
import assert from "node:assert/strict";
import { sha256OfText, normalizeForComparison, hashNormalized } from "../src/lib/hash.ts";

test("sha256OfText produce hash esadecimale a 64 caratteri", () => {
    const hash = sha256OfText("prova");
    assert.match(hash, /^[a-f0-9]{64}$/);
    assert.equal(hash, sha256OfText("prova")); // deterministico
    assert.notEqual(hash, sha256OfText("prova2"));
});

test("normalizeForComparison riunisce la sillabazione a fine riga", () => {
    const input = "il coeffi-\nciente di esposizione";
    assert.equal(normalizeForComparison(input), "il coefficiente di esposizione");
});

test("normalizeForComparison normalizza apostrofi tipografici e spazi", () => {
    const input = "l\u2019azione   del\tvento";
    assert.equal(normalizeForComparison(input), "l'azione del vento");
});

test("normalizeForComparison collassa righe vuote multiple", () => {
    const input = "primo\n\n\n\nsecondo";
    assert.equal(normalizeForComparison(input), "primo\n\nsecondo");
});

test("hashNormalized e' stabile rispetto a variazioni ammesse", () => {
    const a = "il coeffi-\nciente   di esposizione";
    const b = "il coefficiente di esposizione";
    assert.equal(hashNormalized(a), hashNormalized(b));
});
