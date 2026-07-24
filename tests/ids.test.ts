import { test } from "node:test";
import assert from "node:assert/strict";
import {
    isValidUnitId,
    docIdOf,
    slugify,
    publicPathOf,
    entityKindOf,
    paragraphSequenceOf,
    compareSequences,
} from "../src/lib/ids.ts";

test("isValidUnitId accetta ID conformi", () => {
    assert.ok(isValidUnitId("ntc2018:c3/s3.3/p3.3.7"));
    assert.ok(isValidUnitId("ntc2018:c3/s3.3/tab3.3.ii"));
    assert.ok(isValidUnitId("ntc2018:c3/s3.3/eq3.3.7"));
    assert.ok(isValidUnitId("ntc2018:c3/s3.3/eq3.3.7-a"));
    assert.ok(isValidUnitId("circ2019:c3/s3.3/p-c3.3.7"));
    assert.ok(isValidUnitId("ntc2018:c3"));
});

test("isValidUnitId rifiuta ID malformati", () => {
    assert.ok(!isValidUnitId("NTC2018:c3")); // maiuscolo
    assert.ok(!isValidUnitId("ntc2018")); // senza docId separatore
    assert.ok(!isValidUnitId("ntc2018:C3/S3.3")); // maiuscole nei segmenti
    assert.ok(!isValidUnitId("ntc2018:c3//s3.3")); // doppio slash
    assert.ok(!isValidUnitId("en1992:c1")); // docId non ammesso
    assert.ok(!isValidUnitId("ntc2018:c3 s3.3")); // spazi
});

test("docIdOf estrae il documento", () => {
    assert.equal(docIdOf("ntc2018:c3/s3.3/p3.3.7"), "ntc2018");
    assert.equal(docIdOf("circ2019:c3/s3.3/p-c3.3.7"), "circ2019");
    assert.equal(docIdOf("bogus"), null);
});

test("slugify e' deterministico e coerente", () => {
    assert.equal(slugify("ntc2018:c3/s3.3/p3.3.7"), "ntc2018-c3-s3-3-p3-3-7");
    assert.equal(slugify("ntc2018:c3/s3.3/tab3.3.ii"), "ntc2018-c3-s3-3-tab3-3-ii");
    assert.equal(slugify("circ2019:c3/s3.3/p-c3.3.7"), "circ2019-c3-s3-3-p-c3-3-7");
});

test("publicPathOf produce URL stabili", () => {
    assert.equal(publicPathOf("ntc2018:c3/s3.3/p3.3.7"), "/normativa/ntc2018/c3/s3.3/p3.3.7");
});

test("entityKindOf riconosce i tipi", () => {
    assert.equal(entityKindOf("ntc2018:c3/s3.3/p3.3.7"), "paragraph");
    assert.equal(entityKindOf("circ2019:c3/s3.3/p-c3.3.7"), "paragraph");
    assert.equal(entityKindOf("ntc2018:c3/s3.3/tab3.3.ii"), "table");
    assert.equal(entityKindOf("ntc2018:c3/s3.3/eq3.3.7"), "formula");
    assert.equal(entityKindOf("ntc2018:c3/s3.3/fig3.3.2"), "figure");
});

test("paragraphSequenceOf e compareSequences ordinano numericamente", () => {
    assert.deepEqual(paragraphSequenceOf("ntc2018:c3/s3.3/p3.3.7"), [3, 3, 7]);
    assert.deepEqual(paragraphSequenceOf("circ2019:c3/s3.3/p-c3.3.10"), [3, 3, 10]);
    assert.equal(paragraphSequenceOf("ntc2018:c3/s3.3/tab3.3.ii"), null);
    assert.ok(compareSequences([3, 3, 7], [3, 3, 10]) < 0);
    assert.ok(compareSequences([3, 3, 10], [3, 3, 7]) > 0);
    assert.equal(compareSequences([3, 3, 7], [3, 3, 7]), 0);
});
