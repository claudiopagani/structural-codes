import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createCanvas } from "@napi-rs/canvas";

const repoRoot = fileURLToPath(new URL("../", import.meta.url));
const snapshot = JSON.parse(
    await readFile(
        join(repoRoot, "migration", "source-snapshots", "core-editorial-text-blocks.json"),
        "utf8",
    ),
) as {
    units: Record<
        string,
        Array<{
            kind: string;
            text: { raw: string };
            evidence: {
                sourceId: string;
                pdfPage: number;
                region: {
                    coordinateSystem: string;
                    x: number;
                    y: number;
                    width: number;
                    height: number;
                };
            };
        }>
    >;
};

const captionPattern =
    /(?:Fig\.|Figura)\s+(C?\d+(?:\.\d+)+(?:\s*[a-c])?)\s*[-–]\s*([^\n]+)/gu;

type FigureSeed = {
    number: string;
    unitId: string;
    sourceId: string;
    page: number;
    caption: string;
    region: {
        coordinateSystem: string;
        x: number;
        y: number;
        width: number;
        height: number;
    };
};

const byDocument = new Map<string, Map<string, FigureSeed>>();
for (const [unitId, blocks] of Object.entries(snapshot.units)) {
    const document = unitId.split(":").at(-2);
    if (!document) continue;
    const seeds = byDocument.get(document) ?? new Map<string, FigureSeed>();
    byDocument.set(document, seeds);
    for (const block of blocks) {
        if (block.kind === "heading") continue;
        for (const line of block.text.raw.split(/\r?\n/u)) {
            for (const match of line.matchAll(captionPattern)) {
                const number = match[1]?.replace(/\s+/gu, "");
                const detail = match[2]?.replace(/[\u0000-\u001f]/gu, "").trim();
                if (!number || !detail || seeds.has(number.toLowerCase())) continue;
                seeds.set(number.toLowerCase(), {
                    number,
                    unitId,
                    sourceId: block.evidence.sourceId,
                    page: block.evidence.pdfPage,
                    caption: `${number} - ${detail}`,
                    region: block.evidence.region,
                });
            }
        }
    }
}

function wrap(
    context: ReturnType<ReturnType<typeof createCanvas>["getContext"]>,
    text: string,
    maxWidth: number,
): string[] {
    const lines: string[] = [];
    let current = "";
    for (const word of text.split(/\s+/u)) {
        const candidate = current ? `${current} ${word}` : word;
        if (context.measureText(candidate).width <= maxWidth) {
            current = candidate;
        } else {
            if (current) lines.push(current);
            current = word;
        }
    }
    if (current) lines.push(current);
    return lines;
}

let total = 0;
for (const [document, seedMap] of byDocument) {
    const figures = [];
    for (const seed of seedMap.values()) {
        const slug = seed.number.toLowerCase().replace(/[^a-z0-9.]+/gu, "-");
        const relativePath = `figures/${document}/placeholder-${slug}.png`;
        const output = join(repoRoot, "corpus", "assets", relativePath);
        const canvas = createCanvas(1200, 300);
        const context = canvas.getContext("2d");
        context.fillStyle = "#f4f0e7";
        context.fillRect(0, 0, 1200, 300);
        context.strokeStyle = "#92724a";
        context.lineWidth = 3;
        context.setLineDash([12, 10]);
        context.strokeRect(18, 18, 1164, 264);
        context.setLineDash([]);
        context.fillStyle = "#5d472e";
        context.font = "600 28px Arial";
        context.fillText("FIGURA DA INSERIRE DAL PDF UFFICIALE", 54, 78);
        context.font = "24px Arial";
        const lines = wrap(context, seed.caption, 1090).slice(0, 4);
        lines.forEach((line, index) => context.fillText(line, 54, 132 + index * 34));
        const png = canvas.toBuffer("image/png");
        await mkdir(dirname(output), { recursive: true });
        await writeFile(output, png);
        const sha256 = createHash("sha256").update(png).digest("hex");
        figures.push({
            id: `urn:structural-codes:it:asset:figure:${document}:${seed.number.toLowerCase()}`,
            unitId: seed.unitId,
            officialNumber: seed.number,
            pdfPage: seed.page,
            caption: seed.caption,
            alt: `Segnaposto per ${seed.caption}`,
            imagePath: relativePath,
            region: seed.region,
            sha256,
        });
        total += 1;
    }
    const first = [...seedMap.values()][0];
    const manifest = {
        $schema: "urn:structural-codes:schema:asset-manifest:v2",
        schemaVersion: "2.0.0-alpha.1",
        recordType: "asset-manifest",
        document,
        section: "core-figure-placeholders",
        sourceId:
            first?.sourceId ??
            (document === "ntc2018" ? "gu-so8-2018-ntc" : "circ-7-2019"),
        status: "transcribed-unreviewed",
        formulas: [],
        tables: [],
        figures,
    };
    const manifestFile = join(
        repoRoot,
        "corpus",
        "assets",
        document,
        "core-figure-placeholders.json",
    );
    await mkdir(dirname(manifestFile), { recursive: true });
    await writeFile(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}

console.log(`core-figure-placeholders: ${total} figure`);
