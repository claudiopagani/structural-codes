import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

type Figure = {
    id: string;
    officialNumber: string;
    imagePath: string;
    region: {
        coordinateSystem: "pdf-points-top-left";
        x: number;
        y: number;
        width: number;
        height: number;
    };
    sha256: string;
};

const root = fileURLToPath(new URL("../", import.meta.url));
const manifestPath = join(root, "corpus", "assets", "circ2019", "core-figure-placeholders.json");

const regions = new Map([
    ["C3.3.3", { x: 80, y: 490, width: 440, height: 125 }],
    ["C3.3.6", { x: 170, y: 390, width: 262, height: 225 }],
]);

const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as { figures: Figure[] };
for (const figure of manifest.figures) {
    const region = regions.get(figure.officialNumber);
    if (!region) continue;
    const imagePath = join(root, "corpus", "assets", figure.imagePath);
    const image = await readFile(imagePath);
    figure.region = { coordinateSystem: "pdf-points-top-left", ...region };
    figure.sha256 = createHash("sha256").update(image).digest("hex");
}
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log("circ3-figure-label-crops: updated C3.3.3 and C3.3.6");
