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
            sha256: "228bda5a4bf4ced0286e6003d4ec3f63c4f043db9a2983a673e59900d280422c",
            height: 114.261,
        }],
        ["C4.1.10", {
            sha256: "c87459f9069447c251b1949d22b62b1c3cd961f35b118e9eb4b13a65dc0d11df",
            height: 140,
        }],
    ]);
    const manifests = [
        "corpus/assets/circ2019/core-figure-placeholders.json",
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
