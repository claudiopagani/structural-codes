/* eslint-disable @typescript-eslint/no-explicit-any */

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../", import.meta.url));

async function json(relativePath: string): Promise<any> {
    return JSON.parse(await readFile(join(repoRoot, relativePath), "utf8"));
}

test("le didascalie rasterizzate delle figure restano fuori dal PNG", async () => {
    const expected = new Map([
        ["C3.3.2", {
            sha256: "254d3a9bbf10143ad518c0a58db44ebc4fb72944a9da5447e0c0e26f1b414012",
            height: 107.054,
        }],
        ["C3.3.3", {
            sha256: "8bef9e477bed98901019168a2e6c3a9868d847cb5a6976d94cf86a6e73b977f9",
            height: 125,
        }],
        ["C4.1.10", {
            sha256: "c87459f9069447c251b1949d22b62b1c3cd961f35b118e9eb4b13a65dc0d11df",
            height: 140,
        }],
        ["C4.2.11", { sha256: "41a4af3811cd99807771ea084b71af118c5fcd814308fab9d983688bf9032d09", height: 31 }],
        ["C4.2.25", { sha256: "9ddff3f330cf91dfb9be1486b406f770050d01cf85ce325f60c0b4a137f82dd8", height: 58 }],
        ["C4.2.27", { sha256: "6c73368e6d919b066fbe69596230754fb931e5bf2af14d65704d4282ae6e0edf", height: 143 }],
        ["C4.2.28", { sha256: "b07a17af17c202704fb3ba3085d2428111c7ac3120d09aebe863c9878a2c58a6", height: 200 }],
        ["C4.2.29", { sha256: "bebe36a69a464fed17fa30c0c82b22d5c92869e4576bf3b0d59950f36397a65c", height: 70 }],
        ["C4.2.30", { sha256: "99340d6e962bb029736646a6eda786a7bc22b2cafe952f072f22c328c6543050", height: 48 }],
    ]);
    const manifests = [
        "corpus/assets/circ2019/core-figure-placeholders.json",
        "corpus/assets/circ2019/C4.2-step2b.json",
        "corpus/assets/circ2019/C4.2-step2t.json",
        "corpus/assets/circ2019/C4.2-step2u.json",
    ];
    const units = new Map<string, any>();
    for (const manifestPath of manifests) {
        const manifest = await json(manifestPath);
        for (const figure of manifest.figures) {
            const expectedFigure = expected.get(figure.officialNumber);
            if (!expectedFigure) continue;
            assert.equal(figure.sha256, expectedFigure.sha256, figure.officialNumber);
            assert.equal(figure.region.height, expectedFigure.height, figure.officialNumber);
            const image = await readFile(join(repoRoot, "corpus/assets", figure.imagePath));
            assert.equal(
                createHash("sha256").update(image).digest("hex"),
                expectedFigure.sha256,
                figure.officialNumber,
            );
            const unitId = figure.unitId.split(":").at(-1) ?? "";
            const unit = units.get(unitId) ?? await json(`corpus/units/circ2019/${unitId}.json`);
            units.set(unitId, unit);
            const block = unit.blocks.find((candidate: any) => candidate.assetId === figure.id);
            assert.ok(block);
            assert.ok(block.evidence.transformations.some(
                (transformation: any) => transformation.ruleVersion === "figure-caption-crop-0.1.0",
            ));
        }
    }
});
