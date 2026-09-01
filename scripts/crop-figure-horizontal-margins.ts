import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join, resolve } from "node:path";
import { createCanvas, loadImage } from "@napi-rs/canvas";

const ROOT = resolve(fileURLToPath(new URL("../", import.meta.url)));
const FIGURE_MANIFEST_DIRS = {
    ntc2018: join(ROOT, "corpus", "assets", "ntc2018"),
    circ2019: join(ROOT, "corpus", "assets", "circ2019"),
} as const;
const UNIT_DIRS = {
    ntc2018: join(ROOT, "corpus", "units", "ntc2018"),
    circ2019: join(ROOT, "corpus", "units", "circ2019"),
} as const;

export const PROFILE = "figure-horizontal-center-0.1.0";
const INK_THRESHOLD = 250;
const MARGIN_PADDING = 12;
const MIN_ASYMMETRY = 0.1;
const MANUAL_CROP_BOUNDS = new Map<string, { left?: number; right?: number; top?: number; bottom?: number }>([
    // The source crop contains the preceding prose line at x=0. These limits
    // retain the complete C4.2.4 drawing and exclude that non-figure text.
    ["urn:structural-codes:it:asset:figure:circ2019:c4.2.4", { left: 300, right: 766 }],
    // The source crop begins inside the preceding prose column; the drawing
    // starts after this verified left boundary.
    ["urn:structural-codes:it:asset:figure:ntc2018:5.1.3.b", { left: 105 }],
    // The source crop also contains two preceding prose lines above the
    // drawing; the verified figure starts 80 raster pixels below that crop.
    ["urn:structural-codes:it:asset:figure:ntc2018:4.2.5", { top: 80 }],
]);

// These are the only assets selected by this editorial pass. Each candidate
// was inspected in the official page crop before being added here.
export const TARGET_FIGURE_IDS = new Set([
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

type Document = keyof typeof FIGURE_MANIFEST_DIRS;
type Region = {
    coordinateSystem: "pdf-points-top-left";
    x: number;
    y: number;
    width: number;
    height: number;
};
type Figure = {
    id: string;
    unitId: string;
    officialNumber: string | null;
    pdfPage: number;
    imagePath: string;
    region: Region;
    sha256: string;
};
type Manifest = {
    document: Document;
    figures: Figure[];
};
type Transformation = {
    operation: "manual-correction";
    ruleVersion: string;
    note: string;
};
type UnitBlock = {
    assetId?: string;
    evidence?: {
        region?: Region;
        transformations?: Transformation[];
    };
};
type Unit = {
    blocks?: UnitBlock[];
};
type FigureRecord = {
    manifestPath: string;
    manifest: Manifest;
    figure: Figure;
};
type InkBounds = {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
};
type CropPlan = FigureRecord & {
    imagePath: string;
    imageWidth: number;
    imageHeight: number;
    ink: InkBounds;
    cropLeft: number;
    cropRight: number;
    cropTop: number;
    cropBottom: number;
    newRegion: Region;
};

async function jsonFiles(directory: string): Promise<string[]> {
    const entries = await readdir(directory, { withFileTypes: true });
    const files: string[] = [];
    for (const entry of entries) {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) {
            files.push(...await jsonFiles(path));
        } else if (entry.isFile() && entry.name.endsWith(".json")) {
            files.push(path);
        }
    }
    return files;
}

async function loadFigureRecords(document?: Document): Promise<FigureRecord[]> {
    const documents = document ? [document] : Object.keys(FIGURE_MANIFEST_DIRS) as Document[];
    const records: FigureRecord[] = [];
    for (const currentDocument of documents) {
        for (const manifestPath of await jsonFiles(FIGURE_MANIFEST_DIRS[currentDocument])) {
            const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as Manifest;
            for (const figure of manifest.figures ?? []) {
                records.push({ manifestPath, manifest, figure });
            }
        }
    }
    return records;
}

function parsePages(value: string | undefined): [number, number] | undefined {
    if (value === undefined) return undefined;
    const match = /^(\d+)-(\d+)$/.exec(value);
    if (!match) throw new Error("--pages deve avere il formato inizio-fine");
    const start = Number(match[1]);
    const end = Number(match[2]);
    if (end < start || end - start + 1 > 10) {
        throw new Error("uno step può coprire al massimo 10 pagine contigue");
    }
    return [start, end];
}

function inScope(figure: Figure, pages: [number, number] | undefined): boolean {
    return pages === undefined || (figure.pdfPage >= pages[0] && figure.pdfPage <= pages[1]);
}

function imageAbsolutePath(figure: Figure): string {
    return join(ROOT, "corpus", "assets", figure.imagePath);
}

function unitAbsolutePath(figure: Figure): string {
    const document = figure.id.includes(":circ2019:") ? "circ2019" : "ntc2018";
    const unitNumber = figure.unitId.split(":").at(-1);
    if (!unitNumber) throw new Error(`unitId non valido: ${figure.unitId}`);
    return join(UNIT_DIRS[document], `${unitNumber}.json`);
}

async function inkBounds(imagePath: string): Promise<{ imageWidth: number; imageHeight: number; ink: InkBounds }> {
    const image = await loadImage(imagePath);
    const canvas = createCanvas(image.width, image.height);
    const context = canvas.getContext("2d");
    context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, image.width, image.height).data;
    let minX = image.width;
    let maxX = -1;
    let minY = image.height;
    let maxY = -1;
    for (let y = 0; y < image.height; y += 1) {
        for (let x = 0; x < image.width; x += 1) {
            const offset = (y * image.width + x) * 4;
            const alpha = pixels[offset + 3] ?? 0;
            const red = pixels[offset] ?? 255;
            const green = pixels[offset + 1] ?? 255;
            const blue = pixels[offset + 2] ?? 255;
            if (alpha === 0 || (red >= INK_THRESHOLD && green >= INK_THRESHOLD && blue >= INK_THRESHOLD)) continue;
            minX = Math.min(minX, x);
            maxX = Math.max(maxX, x);
            minY = Math.min(minY, y);
            maxY = Math.max(maxY, y);
        }
    }
    if (maxX < 0 || maxY < 0) throw new Error(`figura senza contenuto visibile: ${imagePath}`);
    return { imageWidth: image.width, imageHeight: image.height, ink: { minX, maxX, minY, maxY } };
}

function rounded(value: number): number {
    return Math.round(value * 1000) / 1000;
}

function planCrop(
    record: FigureRecord,
    dimensions: Awaited<ReturnType<typeof inkBounds>>,
    preserveCurrentVerticalCrop = false,
): CropPlan | undefined {
    const { imageWidth, imageHeight, ink } = dimensions;
    const leftMargin = ink.minX;
    const rightMargin = imageWidth - 1 - ink.maxX;
    const asymmetry = Math.abs(leftMargin - rightMargin) / imageWidth;
    const manualBounds = MANUAL_CROP_BOUNDS.get(record.figure.id);
    if (!manualBounds && asymmetry < MIN_ASYMMETRY) return undefined;
    const cropLeft = manualBounds?.left ?? Math.max(0, ink.minX - MARGIN_PADDING);
    const cropRight = manualBounds?.right ?? Math.min(imageWidth, ink.maxX + 1 + MARGIN_PADDING);
    const cropTop = preserveCurrentVerticalCrop ? 0 : manualBounds?.top ?? 0;
    const cropBottom = preserveCurrentVerticalCrop ? imageHeight : manualBounds?.bottom ?? imageHeight;
    if (cropLeft < 0 || cropRight > imageWidth || cropRight <= cropLeft || cropTop < 0 || cropBottom > imageHeight || cropBottom <= cropTop) {
        throw new Error(`limiti crop non validi per ${record.figure.id}: ${cropLeft}-${cropRight} x ${cropTop}-${cropBottom}/${imageWidth}x${imageHeight}`);
    }
    const scale = record.figure.region.width / imageWidth;
    return {
        ...record,
        imagePath: imageAbsolutePath(record.figure),
        imageWidth,
        imageHeight,
        ink,
        cropLeft,
        cropRight,
        newRegion: {
            ...record.figure.region,
            x: rounded(record.figure.region.x + cropLeft * scale),
            y: rounded(record.figure.region.y + cropTop * scale),
            width: rounded((cropRight - cropLeft) * scale),
            height: rounded((cropBottom - cropTop) * scale),
        },
        cropTop,
        cropBottom,
    };
}

function alreadyProcessed(unit: Unit, figureId: string): boolean {
    return (unit.blocks ?? []).some((block) => block.assetId === figureId && (
        block.evidence?.transformations ?? []
    ).some((transformation) => transformation.ruleVersion === PROFILE));
}

function sha256(path: string): string {
    return createHash("sha256").update(readFileSync(path)).digest("hex");
}

async function updateUnits(plans: CropPlan[]): Promise<number> {
    const byUnit = new Map<string, CropPlan[]>();
    for (const plan of plans) {
        const unitPath = unitAbsolutePath(plan.figure);
        const current = byUnit.get(unitPath) ?? [];
        current.push(plan);
        byUnit.set(unitPath, current);
    }
    let changed = 0;
    for (const [unitPath, unitPlans] of byUnit) {
        const unit = JSON.parse(await readFile(unitPath, "utf8")) as Unit;
        const plansById = new Map(unitPlans.map((plan) => [plan.figure.id, plan]));
        let matches = 0;
        for (const block of unit.blocks ?? []) {
            const plan = block.assetId ? plansById.get(block.assetId) : undefined;
            if (!plan) continue;
            if (!block.evidence) throw new Error(`evidence mancante per ${block.assetId} in ${unitPath}`);
            block.evidence.region = plan.newRegion;
            block.evidence.transformations ??= [];
            if (!block.evidence.transformations.some((transformation) => transformation.ruleVersion === PROFILE)) {
                block.evidence.transformations.push({
                    operation: "manual-correction",
                    ruleVersion: PROFILE,
                    note: "Margini bianchi asimmetrici ridotti; il crop è centrato sul contenuto verificato nel render ufficiale.",
                });
            }
            matches += 1;
        }
        if (matches !== unitPlans.length) {
            throw new Error(`asset figure non trovato nell’unità ${unitPath}`);
        }
        await writeFile(unitPath, `${JSON.stringify(unit, null, 2)}\n`, "utf8");
        changed += 1;
    }
    return changed;
}

async function applyPlans(plans: CropPlan[]): Promise<{ images: number; manifests: number; units: number }> {
    const manifests = new Map<string, Manifest>();
    for (const plan of plans) {
        const image = await loadImage(plan.imagePath);
        const canvas = createCanvas(plan.cropRight - plan.cropLeft, plan.cropBottom - plan.cropTop);
        const context = canvas.getContext("2d");
        context.drawImage(image, plan.cropLeft, plan.cropTop, plan.cropRight - plan.cropLeft, plan.cropBottom - plan.cropTop, 0, 0, plan.cropRight - plan.cropLeft, plan.cropBottom - plan.cropTop);
        await writeFile(plan.imagePath, canvas.toBuffer("image/png"));
        plan.figure.region = plan.newRegion;
        plan.figure.sha256 = sha256(plan.imagePath);
        manifests.set(plan.manifestPath, plan.manifest);
    }
    for (const [manifestPath, manifest] of manifests) {
        await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
    }
    return { images: plans.length, manifests: manifests.size, units: await updateUnits(plans) };
}

async function main(): Promise<void> {
    const args = new Map<string, string | true>();
    for (let index = 2; index < process.argv.length; index += 1) {
        const argument = process.argv[index];
        if (argument === "--apply" || argument === "--reprocess-manual" || argument === "--reprocess-horizontal") {
            args.set(argument, true);
        }
        else if (argument?.startsWith("--") && process.argv[index + 1]) args.set(argument, process.argv[index + 1] as string);
    }
    const document = args.get("--document");
    if (document !== undefined && document !== "ntc2018" && document !== "circ2019") {
        throw new Error(`documento non valido: ${String(document)}`);
    }
    const pages = parsePages(typeof args.get("--pages") === "string" ? args.get("--pages") as string : undefined);
    const records = (await loadFigureRecords(document as Document | undefined))
        .filter((record) => TARGET_FIGURE_IDS.has(record.figure.id) && inScope(record.figure, pages));
    const foundIds = new Set(records.map((record) => record.figure.id));
    const missingIds = [...TARGET_FIGURE_IDS].filter((id) => !foundIds.has(id) && pages === undefined);
    if (missingIds.length > 0) throw new Error(`asset candidati mancanti nei manifest: ${missingIds.join(", ")}`);
    const plans: CropPlan[] = [];
    for (const record of records) {
        const unit = JSON.parse(await readFile(unitAbsolutePath(record.figure), "utf8")) as Unit;
        const reprocessManual = args.get("--reprocess-manual") === true && MANUAL_CROP_BOUNDS.has(record.figure.id);
        const reprocessHorizontal = args.get("--reprocess-horizontal") === true;
        if (alreadyProcessed(unit, record.figure.id) && !reprocessManual && !reprocessHorizontal) {
            console.log(`[SKIP] crop orizzontale già applicato: ${record.figure.id} p.${record.figure.pdfPage}`);
            continue;
        }
        const dimensions = await inkBounds(imageAbsolutePath(record.figure));
        const plan = planCrop(record, dimensions, reprocessHorizontal);
        if (!plan) {
            console.log(`[OK] margini già equilibrati: ${record.figure.id} p.${record.figure.pdfPage}`);
            continue;
        }
        plans.push(plan);
        console.log(`[PLAN] ${record.figure.officialNumber} p.${record.figure.pdfPage}: ${dimensions.imageWidth}x${dimensions.imageHeight} -> ${plan.cropRight - plan.cropLeft}x${dimensions.imageHeight}, x=${plan.newRegion.x}, width=${plan.newRegion.width}`);
    }
    console.log(`figure: ${plans.length}/${records.length} crop orizzontali pianificati`);
    if (args.get("--apply") !== true) return;
    const result = await applyPlans(plans);
    console.log(`figure: aggiornati ${result.images} PNG, ${result.manifests} manifest e ${result.units} unità`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    await main();
}
