import { test } from "node:test";
import assert from "node:assert/strict";
import { findMarkers, distinctMarkers, REVIEW_MARKERS } from "../src/lib/markers.ts";

test("findMarkers trova tutti i marcatori, anche ripetuti", () => {
  const text = "valore [DA_VERIFICARE] e formula [FORMULA_NON_LEGGIBILE], ancora [DA_VERIFICARE]";
  assert.deepEqual(findMarkers(text), ["DA_VERIFICARE", "FORMULA_NON_LEGGIBILE", "DA_VERIFICARE"]);
});

test("distinctMarkers deduplica", () => {
  const text = "[DA_VERIFICARE] [DA_VERIFICARE] [FIGURA_MANCANTE]";
  assert.deepEqual(distinctMarkers(text).sort(), ["DA_VERIFICARE", "FIGURA_MANCANTE"]);
});

test("non riconosce marcatori inventati", () => {
  assert.deepEqual(findMarkers("[QUASI_GIUSTO]"), []);
  assert.equal(REVIEW_MARKERS.length, 5);
});
