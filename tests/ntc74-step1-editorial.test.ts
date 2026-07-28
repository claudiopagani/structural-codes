import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../", import.meta.url));

// Canonical JSON records intentionally contain heterogeneous block shapes.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function json(relativePath: string): Promise<any> {
    return JSON.parse(await readFile(join(repoRoot, relativePath), "utf8"));
}

test("NTC 7.4 step 1 contiene tutte le unità fino ai diaframmi", async () => {
    for (const number of [
        "7.4",
        "7.4.1",
        "7.4.2",
        "7.4.2.1",
        "7.4.2.2",
        "7.4.3",
        "7.4.3.1",
        "7.4.3.2",
        "7.4.4",
        "7.4.4.1",
        "7.4.4.1.1",
        "7.4.4.1.2",
        "7.4.4.2",
        "7.4.4.2.1",
        "7.4.4.2.2",
        "7.4.4.3",
        "7.4.4.3.1",
        "7.4.4.4",
        "7.4.4.4.1",
    ]) {
        const unit = await json(`corpus/units/ntc2018/${number}.json`);
        assert.equal(unit.numbering.official, number);
    }
});

test("NTC 7.4 step 1 trascrive le formule [7.4.1]-[7.4.12]", async () => {
    const manifest = await json("corpus/assets/ntc2018/7.4-step1.json");
    const byNumber = new Map(
        manifest.formulas.map(
            (formula: { officialNumber: string | null; latex: string }) => [
                formula.officialNumber,
                formula.latex,
            ],
        ),
    );
    for (let number = 1; number <= 12; number += 1) {
        assert.ok(byNumber.has(`7.4.${number}`), `7.4.${number}`);
    }
    assert.equal(
        byNumber.get("7.4.4"),
        "\\sum M_{c,Rd}\\ge\\gamma_{Rd}\\sum M_{b,Rd}",
    );
    assert.equal(
        byNumber.get("7.4.8"),
        "V_{jbd}\\le\\eta\\,f_{cd}\\,b_j\\,h_{jc}\\sqrt{1-\\frac{\\nu_d}{\\eta}}",
    );
    assert.equal(
        manifest.formulas.filter(
            ({ officialNumber }: { officialNumber: string | null }) =>
                officialNumber === null,
        ).length,
        1,
    );
});

test("NTC 7.4 step 1 usa due ritagli ufficiali integri", async () => {
    const manifest = await json("corpus/assets/ntc2018/7.4-step1.json");
    assert.equal(manifest.figures.length, 2);
    for (const figure of manifest.figures) {
        const image = await readFile(
            join(repoRoot, "corpus", "assets", figure.imagePath),
        );
        assert.equal(
            createHash("sha256").update(image).digest("hex"),
            figure.sha256,
            figure.officialNumber,
        );
    }
});

test("NTC 7.4 step 1 conserva ordine e unicità degli asset", async () => {
    const unitIds = ["7.4.4.1.1", "7.4.4.1.2", "7.4.4.2.1", "7.4.4.3.1"];
    const assetIds: string[] = [];
    for (const unitId of unitIds) {
        const unit = await json(`corpus/units/ntc2018/${unitId}.json`);
        assetIds.push(
            ...unit.blocks.flatMap(({ assetId }: { assetId?: string }) =>
                assetId ? [assetId] : [],
            ),
        );
    }
    assert.equal(assetIds.length, 15);
    assert.equal(new Set(assetIds).size, assetIds.length);
    assert.deepEqual(
        assetIds.filter((id) => id.includes(":figure:")),
        [
            "urn:structural-codes:it:asset:figure:ntc2018:7.4.1",
            "urn:structural-codes:it:asset:figure:ntc2018:7.4.2",
        ],
    );
});
