import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const visibleFields = new Set([
    "normalized", "value", "latex", "title", "caption", "alt",
]);
const unwantedGlyphs = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u00ad\ufffc\ufffd\ue000-\uf8ff]/u;

function checkVisibleText(value: unknown, location: string, key = ""): void {
    if (typeof value === "string" && visibleFields.has(key)) {
        assert.doesNotMatch(value, unwantedGlyphs, location);
    } else if (Array.isArray(value)) {
        value.forEach((item, index) =>
            checkVisibleText(item, `${location}[${index}]`, key),
        );
    } else if (value && typeof value === "object") {
        for (const [field, item] of Object.entries(value)) {
            checkVisibleText(item, `${location}.${field}`, field);
        }
    }
}

function checkDirectory(directory: string): void {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) {
            checkDirectory(path);
        } else if (entry.name.endsWith(".json")) {
            checkVisibleText(JSON.parse(readFileSync(path, "utf8")), path);
        }
    }
}

test("testo visibile del corpus senza controlli, glifi sostitutivi o trattini discrezionali", () => {
    checkDirectory("corpus/units");
    checkDirectory("corpus/assets");
});

test("C7.11.5.3.2 conserva raw e provenance della correzione di ammorsati", () => {
    const unit = JSON.parse(readFileSync(
        "corpus/units/circ2019/c7.11.5.3.2.json", "utf8",
    ));
    const block = unit.blocks.find((item: { blockId: string }) =>
        item.blockId.endsWith("#block-editorial-004"),
    );
    assert.ok(block);
    assert.match(block.text.raw, /ammor\u00adsati/u);
    assert.equal(block.text.normalized, block.text.raw.replace("\u00ad", ""));
    for (const field of ["raw", "normalized"] as const) {
        assert.equal(block.evidence[`${field}Sha256`],
            createHash("sha256").update(block.text[field]).digest("hex"));
    }
    assert.equal(block.evidence.pdfPage, 250);
    assert.equal(block.evidence.transformations[0].operation, "remove-discretionary-hyphen");
    assert.equal(block.evidence.transformations[0].ruleVersion, block.text.normalizationVersion);
    assert.deepEqual(unit.assets, { formulaIds: [], tableIds: [], figureIds: [] });
});
