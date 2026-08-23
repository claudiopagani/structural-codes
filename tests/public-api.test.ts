import assert from "node:assert/strict";
import test from "node:test";
import {
    compareCanonicalUnits,
    createUnitIndex,
    documentIdFromUnitId,
    findIncomingRelations,
    isCanonicalUnitId,
    type CanonicalUnitLike,
} from "../src/index.ts";

function unit(
    id: string,
    sortKey: string,
    relations: CanonicalUnitLike["relations"] = [],
): CanonicalUnitLike {
    return {
        id,
        numbering: { official: id.split(":").at(-1) ?? id, sortKey },
        hierarchy: { parentId: null, ancestorIds: [], position: 1 },
        relations,
    };
}

test("la public API indicizza unità e rifiuta duplicati", () => {
    const first = unit("urn:structural-codes:it:unit:ntc2018:4.1", "004.001");
    const second = unit("urn:structural-codes:it:unit:ntc2018:4.2", "004.002");

    assert.equal(createUnitIndex([first, second]).get(first.id), first);
    assert.throws(() => createUnitIndex([first, first]), /duplicato/u);
    assert.equal(compareCanonicalUnits(second, first) > 0, true);
});

test("le relazioni inverse usano solo edge espliciti", () => {
    const ntc = unit("urn:structural-codes:it:unit:ntc2018:4.1", "004.001");
    const circ = unit(
        "urn:structural-codes:it:unit:circ2019:c4.1",
        "004.001",
        [
            {
                relationId:
                    "urn:structural-codes:it:unit:circ2019:c4.1#relation-001",
                type: "clarifies",
                targetUnitId: ntc.id,
                basis: "editorial",
                rationale: "Collegamento esplicito di test.",
                review: { status: "proposed" },
            },
        ],
    );
    const sameNumberWithoutRelation = unit(
        "urn:structural-codes:it:unit:circ2019:c4.1.1",
        "004.001.001",
    );

    assert.deepEqual(findIncomingRelations([ntc, circ], ntc.id), [
        { sourceUnit: circ, relation: circ.relations[0] },
    ]);
    assert.deepEqual(
        findIncomingRelations([ntc, sameNumberWithoutRelation], ntc.id),
        [],
    );
});

test("gli helper URN distinguono NTC e Circolare", () => {
    const ntc = "urn:structural-codes:it:unit:ntc2018:4.1";
    const circ = "urn:structural-codes:it:unit:circ2019:c4.1";

    assert.equal(isCanonicalUnitId(ntc), true);
    assert.equal(documentIdFromUnitId(ntc), "ntc2018");
    assert.equal(documentIdFromUnitId(circ), "circ2019");
    assert.equal(documentIdFromUnitId("4.1"), null);
});
