import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createCanvas, loadImage } from "@napi-rs/canvas";

const root = fileURLToPath(new URL("../", import.meta.url));

const groups = [
  { document: "ntc2018", manifest: "4.3-step4.json", numbers: ["4.3.12"] },
  { document: "ntc2018", manifest: "5.1-step3.json", numbers: ["5.2.8", "5.2.9", "5.2.10", "5.2.11"] },
  { document: "circ2019", manifest: "core-figure-placeholders.json", numbers: ["C3.2.1a", "C3.2.1b", "C3.2.1c", "C3.4.4"] },
  { document: "circ2019", manifest: "C5-step3.json", numbers: ["C5.2.1", "C5.2.2", "C5.2.3"] },
  { document: "circ2019", manifest: "7.2.json", numbers: ["C7.2.1", "C7.2.2"] },
] as const;

const recropped = new Set(["5.2.8", "5.2.10", "C3.2.1a", "C3.2.1b", "C5.2.2", "C5.2.3"]);

type Region = { coordinateSystem: string; x: number; y: number; width: number; height: number };
type Figure = {
  id: string;
  unitId: string;
  officialNumber: string;
  imagePath: string;
  region: Region;
  sha256: string;
  displayScale?: number;
};

async function inkMargins(path: string): Promise<[number, number, number, number]> {
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
  assert.ok(maxX >= 0 && maxY >= 0, path);
  return [minX, minY, image.width - 1 - maxX, image.height - 1 - maxY];
}

test("le figure confrontate usano la stessa scala fisica del PDF", async () => {
  for (const group of groups) {
    const manifest = JSON.parse(await readFile(join(root, "corpus/assets", group.document, group.manifest), "utf8")) as { figures: Figure[] };
    for (const number of group.numbers) {
      const figure = manifest.figures.find((candidate) => candidate.officialNumber === number);
      assert.ok(figure, number);
      assert.ok(figure.displayScale && figure.displayScale < 1, number);
      const enlarged = /^(?:5\.2\.(?:8|9|10|11)|C3\.2\.1[abc])$/u.test(number);
      assert.ok(Math.abs((figure.displayScale * 760 / figure.region.width) - (enlarged ? 1.98 : 1.65)) < 0.012, `${number}: scala difforme`);

      if (!recropped.has(number)) continue;
      const path = join(root, "corpus/assets", figure.imagePath);
      const bytes = await readFile(path);
      assert.equal(createHash("sha256").update(bytes).digest("hex"), figure.sha256, number);
      const [left, top, right, bottom] = await inkMargins(path);
      assert.ok(Math.min(left, top, right, bottom) >= 8, `${number}: contenuto tagliato`);
      assert.ok(Math.abs(left - right) <= 8, `${number}: margini laterali`);
      assert.ok(Math.abs(top - bottom) <= 8, `${number}: margini verticali`);

      const unitName = figure.unitId.split(":").at(-1);
      assert.ok(unitName);
      const unit = JSON.parse(await readFile(join(root, "corpus/units", group.document, `${unitName}.json`), "utf8")) as {
        blocks: Array<{ assetId?: string; evidence: { region: Region; transformations: Array<{ ruleVersion: string }> } }>;
      };
      const refs = unit.blocks.filter((block) => block.assetId === figure.id);
      assert.equal(refs.length, 1, number);
      assert.deepEqual(refs[0]?.evidence.region, figure.region, number);
      assert.ok(refs[0]?.evidence.transformations.some((item) => item.ruleVersion === "figure-zoom-normalization-0.1.0"), number);
    }
  }
});

test("Tabella C4.1.IV conserva classi e ambiente su una riga con scorrimento", async () => {
  const manifest = JSON.parse(await readFile(join(root, "corpus/assets/circ2019/core-tables.json"), "utf8")) as {
    tables: Array<{ officialNumber: string; columnWidths?: number[] }>;
  };
  const table = manifest.tables.find((candidate) => candidate.officialNumber === "C4.1.IV");
  assert.ok(table);
  assert.deepEqual(table.columnWidths, [8, 8, 13, 7, 10.75, 7, 10.75, 7, 10.75, 7, 10.75]);
  const css = await readFile(join(root, "viewer/shared/styles.css"), "utf8");
  assert.match(css, /\.table-asset-c4-1-iv table \{ min-width: 1080px; table-layout: fixed; \}/u);
  assert.match(css, /\.table-asset-c4-1-iv thead tr:nth-child\(2\) th:nth-child\(n \+ 4\) \.katex \{ font-size: \.94em; \}/u);
  assert.match(css, /\.table-asset-c4-1-iv tbody td:nth-child\(-n \+ 3\) \{ overflow-wrap: normal; white-space: nowrap; text-align: center; \}/u);
});
