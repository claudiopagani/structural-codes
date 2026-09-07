import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

type InlineSegment = { kind: "text" | "em" | "strong" | "underline"; value: string } | { kind: "math"; value: string; latex: string };
type Block = {
    blockId: string;
    kind: string;
    listMarker?: "bullet" | "dash" | "none";
    listLevel?: number;
    text: { normalized: string; inline: InlineSegment[] };
    evidence: { normalizedSha256: string; transformations: Array<{ operation: string; ruleVersion: string; note: string }> };
};
type Unit = { blocks: Block[] };
type Asset = { officialNumber: string; pdfPage: number; caption: string; captionInline?: InlineSegment[] };
type Manifest = { figures: Asset[]; tables: Asset[] };

const root = process.cwd();
const unitDirectory = join(root, "corpus", "units", "circ2019");
const assetDirectory = join(root, "corpus", "assets", "circ2019");
const profile = "circ42-editorial-formatting-0.1.0";

function assert(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message); }
function sha256(value: string): string { return createHash("sha256").update(value, "utf8").digest("hex"); }
function joinInline(segments: InlineSegment[]): string { return segments.map((segment) => segment.value).join(""); }

async function readUnit(number: string): Promise<{ path: string; unit: Unit }> {
    const path = join(unitDirectory, `${number.toLowerCase()}.json`);
    return { path, unit: JSON.parse(await readFile(path, "utf8")) as Unit };
}
async function save(path: string, value: unknown): Promise<void> { await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8"); }

function italicHeading(unit: Unit, number: string): void {
    const block = unit.blocks.find((candidate) => candidate.kind === "heading");
    assert(block, `Heading assente: ${number}`);
    assert(block.text.normalized.startsWith(number), `Heading inatteso: ${number}`);
    block.text.inline = [{ kind: "em", value: block.text.normalized }];
    block.evidence.normalizedSha256 = sha256(block.text.normalized);
    const note = "Ripristinato il corsivo del sottotitolo ufficiale.";
    if (!block.evidence.transformations.some((entry) => entry.operation === "manual-correction" && entry.note === note)) {
        block.evidence.transformations.push({ operation: "manual-correction", ruleVersion: profile, note });
    }
}

function structureDefinitions(unit: Unit): void {
    for (const block of unit.blocks.filter((candidate) => candidate.blockId.includes("#block-def-"))) {
        block.kind = "list-item";
        block.listMarker = "none";
        delete block.listLevel;
    }
}

async function updateUnits(): Promise<void> {
    const italicNumbers = [
        "C4.2.4.1.3.1", "C4.2.4.1.3.1.1", "C4.2.4.1.3.1.2", "C4.2.4.1.3.1.3", "C4.2.4.1.3.1.4", "C4.2.4.1.3.1.5",
        "C4.2.4.1.3.2", "C4.2.4.1.3.3", "C4.2.4.1.3.3.1", "C4.2.4.1.3.3.2", "C4.2.4.1.3.3.3",
        "C4.2.4.1.3.4.1", "C4.2.4.1.3.4.2",
    ];
    for (const number of italicNumbers) {
        const { path, unit } = await readUnit(number);
        italicHeading(unit, number);
        if (number === "C4.2.4.1.3.1.1" || number === "C4.2.4.1.3.3.1") structureDefinitions(unit);
        await save(path, unit);
    }
}

async function updateCaptions(): Promise<void> {
    const files = (await readdir(assetDirectory)).filter((file) => /^C4\.2-step2[a-z]*\.json$/u.test(file));
    for (const file of files) {
        const path = join(assetDirectory, file);
        const manifest = JSON.parse(await readFile(path, "utf8")) as Manifest;
        let changed = false;
        for (const asset of [...manifest.figures, ...manifest.tables]) {
            if (asset.pdfPage < 106 || asset.pdfPage > 115) continue;
            if (asset.officialNumber.startsWith("C4.2.")) {
                const label = asset.officialNumber.match(/^C4\.2\.\d+$/u) ? `Figura ${asset.officialNumber}` : undefined;
                const captionInline: InlineSegment[] = label && asset.caption.startsWith(label)
                    ? [{ kind: "strong", value: label }, { kind: "em", value: asset.caption.slice(label.length) }]
                    : [{ kind: "em", value: asset.caption }];
                assert(captionInline.every((segment) => segment.value.length > 0), `Didascalia senza descrizione: ${asset.officialNumber}`);
                asset.captionInline = captionInline;
                assert(joinInline(captionInline) === asset.caption, `Didascalia incoerente: ${asset.officialNumber}`);
                changed = true;
            }
        }
        if (changed) await save(path, manifest);
    }
}

await updateUnits();
await updateCaptions();
