/* eslint-disable @typescript-eslint/no-explicit-any */

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createCanvas, loadImage } from "@napi-rs/canvas";
const PROFILE = "figure-horizontal-center-0.1.0";
const TARGET_FIGURE_IDS = new Set([
    "urn:structural-codes:it:asset:figure:ntc2018:3.3.1",
    "urn:structural-codes:it:asset:figure:ntc2018:3.3.2",
    "urn:structural-codes:it:asset:figure:ntc2018:3.3.3",
    "urn:structural-codes:it:asset:figure:ntc2018:3.4.1",
    "urn:structural-codes:it:asset:figure:ntc2018:3.4.2",
    "urn:structural-codes:it:asset:figure:ntc2018:3.4.3",
    "urn:structural-codes:it:asset:figure:ntc2018:3.5.1",
    "urn:structural-codes:it:asset:figure:ntc2018:3.5.2",
    "urn:structural-codes:it:asset:figure:ntc2018:4.1.1",
    "urn:structural-codes:it:asset:figure:ntc2018:4.1.3",
    "urn:structural-codes:it:asset:figure:ntc2018:4.1.4",
    "urn:structural-codes:it:asset:figure:ntc2018:4.2.5",
    "urn:structural-codes:it:asset:figure:ntc2018:4.3.1",
    "urn:structural-codes:it:asset:figure:ntc2018:4.3.2",
    "urn:structural-codes:it:asset:figure:ntc2018:4.3.3",
    "urn:structural-codes:it:asset:figure:ntc2018:4.3.4.a",
    "urn:structural-codes:it:asset:figure:ntc2018:4.3.4.b",
    "urn:structural-codes:it:asset:figure:ntc2018:4.3.5",
    "urn:structural-codes:it:asset:figure:ntc2018:4.3.6",
    "urn:structural-codes:it:asset:figure:ntc2018:4.3.11",
    "urn:structural-codes:it:asset:figure:ntc2018:4.4.1",
    "urn:structural-codes:it:asset:figure:ntc2018:5.1.1",
    "urn:structural-codes:it:asset:figure:ntc2018:5.1.3.a",
    "urn:structural-codes:it:asset:figure:ntc2018:5.1.3.b",
    "urn:structural-codes:it:asset:figure:ntc2018:5.2.3",
    "urn:structural-codes:it:asset:figure:ntc2018:5.2.12",
    "urn:structural-codes:it:asset:figure:ntc2018:5.2.13",
    "urn:structural-codes:it:asset:figure:ntc2018:7.4.2",
    "urn:structural-codes:it:asset:figure:ntc2018:7.6.1",
    "urn:structural-codes:it:asset:figure:ntc2018:7.6.2",
    "urn:structural-codes:it:asset:figure:ntc2018:7.9.3-fig7.9.1",
    "urn:structural-codes:it:asset:figure:ntc2018:11.9.2",
    "urn:structural-codes:it:asset:figure:circ2019:c3.3.10",
    "urn:structural-codes:it:asset:figure:circ2019:c4.2.1",
    "urn:structural-codes:it:asset:figure:circ2019:c4.2.4",
    "urn:structural-codes:it:asset:figure:circ2019:c4.2.6",
    "urn:structural-codes:it:asset:figure:circ2019:c4.2.16",
    "urn:structural-codes:it:asset:figure:circ2019:c4.2.19",
    "urn:structural-codes:it:asset:figure:circ2019:c4.2.23",
    "urn:structural-codes:it:asset:figure:circ2019:c4.2.36",
    "urn:structural-codes:it:asset:figure:circ2019:4.3.4",
    "urn:structural-codes:it:asset:figure:circ2019:4.3.6",
    "urn:structural-codes:it:asset:figure:circ2019:c7.3.4",
    "urn:structural-codes:it:asset:figure:circ2019:c7.6.2",
    "urn:structural-codes:it:asset:figure:circ2019:c7.6.3",
    "urn:structural-codes:it:asset:figure:circ2019:c7.10.2a",
    "urn:structural-codes:it:asset:figure:circ2019:c11.3.2.10.4.b",
]);

const repoRoot = fileURLToPath(new URL("../", import.meta.url));

async function json(relativePath: string): Promise<any> {
    return JSON.parse(await readFile(join(repoRoot, relativePath), "utf8"));
}

async function inkAsymmetry(imagePath: string): Promise<number> {
    const image = await loadImage(imagePath);
    const canvas = createCanvas(image.width, image.height);
    const context = canvas.getContext("2d");
    context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, image.width, image.height).data;
    let minX = image.width;
    let maxX = -1;
    for (let y = 0; y < image.height; y += 1) {
        for (let x = 0; x < image.width; x += 1) {
            const offset = (y * image.width + x) * 4;
            const red = pixels[offset] ?? 255;
            const green = pixels[offset + 1] ?? 255;
            const blue = pixels[offset + 2] ?? 255;
            const alpha = pixels[offset + 3] ?? 0;
            if (alpha > 0 && (red < 250 || green < 250 || blue < 250)) {
                minX = Math.min(minX, x);
                maxX = Math.max(maxX, x);
            }
        }
    }
    assert.notEqual(maxX, -1, imagePath);
    const leftMargin = minX;
    const rightMargin = image.width - 1 - maxX;
    return Math.abs(leftMargin - rightMargin) / image.width;
}

test("le figure ricentrate rispettano hash, evidence e margini laterali", async () => {
    const found = new Map<string, { figure: any; document: "ntc2018" | "circ2019" }>();
    for (const document of ["ntc2018", "circ2019"] as const) {
        const manifestDirectory = join(repoRoot, "corpus", "assets", document);
        const manifestNames = (await readdir(manifestDirectory)).filter((name) => name.endsWith(".json"));
        for (const manifestName of manifestNames) {
            const manifest = await json(`corpus/assets/${document}/${manifestName}`);
            for (const figure of manifest.figures ?? []) {
                if (TARGET_FIGURE_IDS.has(figure.id)) {
                    found.set(figure.id, { figure, document });
                }
            }
        }
    }

    assert.equal(found.size, TARGET_FIGURE_IDS.size, "tutte le figure selezionate devono avere un manifest");
    for (const figureId of TARGET_FIGURE_IDS) {
        const record = found.get(figureId);
        assert.ok(record, figureId);
        const imagePath = join(repoRoot, "corpus", "assets", record.figure.imagePath);
        const image = await readFile(imagePath);
        assert.equal(
            createHash("sha256").update(image).digest("hex"),
            record.figure.sha256,
            figureId,
        );
        assert.ok(
            await inkAsymmetry(imagePath) < 0.1,
            `${figureId}: margini laterali ancora asimmetrici`,
        );

        const unitId = record.figure.unitId.split(":").at(-1) ?? "";
        const unit = await json(`corpus/units/${record.document}/${unitId}.json`);
        const block = unit.blocks.find((candidate: any) => candidate.assetId === figureId);
        assert.ok(block, `${figureId}: blocco asset assente nell'unità`);
        assert.ok(block.evidence.transformations.some(
            (transformation: any) => transformation.ruleVersion === PROFILE,
        ), `${figureId}: trasformazione ${PROFILE} assente`);
    }
});
