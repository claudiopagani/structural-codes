import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createCanvas, loadImage } from "@napi-rs/canvas";

const root = fileURLToPath(new URL("../", import.meta.url));
const profile = "figure-balanced-crop-0.1.0";
const targets = {
    ntc2018: [
        "fig4.2.6.png", "fig4.3.1.png", "fig4.3.3.png", "fig4.3.4a.png",
        "fig4.3.8.png", "fig4.3.12.png", "fig5.1.5.png", "fig5.2.9.png",
        "fig5.2.11.png", "fig5.2.14.png",
    ],
    circ2019: [
        "figc3.2.1c.png", "figc3.4.4.png", "figc4.1.10.png", "figc4.2.6.png",
        "figc4.2.14.png", "figc5.2.1.png", "figc7.2.1.png", "figc7.2.2.png",
        "figc7.3.2.png", "figc7.3.4.png", "figc7.4.4.png", "figc7.9.1.png",
    ],
} as const;

type Region = {
    coordinateSystem: string;
    x: number;
    y: number;
    width: number;
    height: number;
};

type Figure = {
    id: string;
    unitId: string;
    officialNumber: string;
    pdfPage: number;
    imagePath: string;
    region: Region;
    additionalSourceRegions?: Array<{ pdfPage: number; region: Region }>;
    sha256: string;
};

async function margins(path: string): Promise<[number, number, number, number]> {
    const image = await loadImage(path);
    const canvas = createCanvas(image.width, image.height);
    const context = canvas.getContext("2d");
    context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, image.width, image.height).data;
    let minX = image.width;
    let minY = image.height;
    let maxX = -1;
    let maxY = -1;
    for (let y = 0; y < image.height; y += 1) {
        for (let x = 0; x < image.width; x += 1) {
            const offset = (y * image.width + x) * 4;
            if ((pixels[offset] ?? 255) >= 190 &&
                (pixels[offset + 1] ?? 255) >= 190 &&
                (pixels[offset + 2] ?? 255) >= 190) continue;
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x);
            maxY = Math.max(maxY, y);
        }
    }
    assert.ok(maxX >= 0 && maxY >= 0, `figura vuota: ${path}`);
    return [minX, minY, image.width - 1 - maxX, image.height - 1 - maxY];
}

test("i ritagli richiesti restano centrati, tracciati e unici nelle unità", async () => {
    for (const document of ["ntc2018", "circ2019"] as const) {
        const wanted = new Set<string>(targets[document]);
        const found = new Map<string, Figure>();
        const directory = join(root, "corpus", "assets", document);
        for (const name of await readdir(directory)) {
            if (!name.endsWith(".json")) continue;
            const manifest = JSON.parse(await readFile(join(directory, name), "utf8")) as {
                figures: Figure[];
            };
            for (const figure of manifest.figures) {
                const basename = figure.imagePath.split("/").at(-1) ?? "";
                if (!wanted.has(basename)) continue;
                assert.ok(!found.has(basename), `asset duplicato: ${basename}`);
                found.set(basename, figure);
            }
        }
        assert.equal(found.size, wanted.size, `${document}: inventario incompleto`);
        for (const name of wanted) {
            const figure = found.get(name);
            assert.ok(figure, name);
            const path = join(root, "corpus", "assets", figure.imagePath);
            const bytes = await readFile(path);
            assert.equal(createHash("sha256").update(bytes).digest("hex"), figure.sha256, name);

            const [left, top, right, bottom] = await margins(path);
            assert.ok(Math.min(left, top, right, bottom) >= 5, `${name}: figura tocca il bordo`);
            assert.ok(Math.abs(left - right) <= 8, `${name}: margini laterali ${left}/${right}`);
            assert.ok(Math.abs(top - bottom) <= 8, `${name}: margini verticali ${top}/${bottom}`);

            const unitName = figure.unitId.split(":").at(-1);
            assert.ok(unitName);
            const unit = JSON.parse(await readFile(
                join(root, "corpus", "units", document, `${unitName}.json`), "utf8",
            )) as {
                blocks: Array<{
                    assetId?: string;
                    evidence: {
                        pdfPage: number;
                        region: Region;
                        transformations: Array<{ ruleVersion: string }>;
                    };
                }>;
            };
            const references = unit.blocks.filter((block) => block.assetId === figure.id);
            assert.equal(references.length, 1, `${name}: riferimento nell’unità non unico`);
            assert.equal(references[0]?.evidence.pdfPage, figure.pdfPage, name);
            assert.deepEqual(references[0]?.evidence.region, figure.region, name);
            assert.ok(references[0]?.evidence.transformations.some(
                (transformation) => transformation.ruleVersion === profile,
            ), `${name}: provenance della correzione assente`);
        }
    }
});

test("la figura C4.1.10 conserva la provenance delle due pagine", async () => {
    const manifest = JSON.parse(await readFile(
        join(root, "corpus/assets/circ2019/core-figure-placeholders.json"), "utf8",
    )) as { figures: Figure[] };
    const figure = manifest.figures.find((candidate) => candidate.officialNumber === "C4.1.10");
    assert.ok(figure);
    assert.equal(figure.pdfPage, 91);
    assert.deepEqual(figure.additionalSourceRegions, [{
        pdfPage: 92,
        region: {
            coordinateSystem: "pdf-points-top-left",
            x: 175.5,
            y: 96,
            width: 245.5,
            height: 64,
        },
    }]);
});
