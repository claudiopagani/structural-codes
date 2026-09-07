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

function traceFormatting(block: Block, note: string): void {
    block.evidence.normalizedSha256 = sha256(block.text.normalized);
    if (!block.evidence.transformations.some((entry) => entry.operation === "manual-correction" && entry.note === note)) {
        block.evidence.transformations.push({ operation: "manual-correction", ruleVersion: profile, note });
    }
}

function italicHeading(block: Block): void {
    block.text.inline = [{ kind: "em", value: block.text.normalized }];
    traceFormatting(block, "Ripristinato il corsivo del sottotitolo ufficiale.");
}

function italicText(block: Block, term: string): void {
    const segments: InlineSegment[] = [];
    for (const segment of block.text.inline) {
        if (segment.kind !== "text") {
            segments.push(segment);
            continue;
        }
        const index = segment.value.indexOf(term);
        if (index < 0) {
            segments.push(segment);
            continue;
        }
        if (index > 0) segments.push({ kind: "text", value: segment.value.slice(0, index) });
        segments.push({ kind: "em", value: term });
        if (index + term.length < segment.value.length) segments.push({ kind: "text", value: segment.value.slice(index + term.length) });
    }
    assert(joinInline(segments) === block.text.normalized, `Segmenti inline incoerenti: ${block.blockId}`);
    block.text.inline = segments;
    traceFormatting(block, "Ripristinato il corsivo del termine tecnico ufficiale.");
}

async function updateUnits(): Promise<void> {
    const italicNumbers = [
        "C4.2.12.1.5.1", "C4.2.12.1.5.2", "C4.2.12.1.5.3", "C4.2.12.1.5.4", "C4.2.12.1.5.4.1",
        "C4.2.12.1.6.1", "C4.2.12.1.6.2", "C4.2.12.1.6.3",
        "C4.2.12.1.7.1", "C4.2.12.1.7.1.1", "C4.2.12.1.7.2", "C4.2.12.1.7.2.1", "C4.2.12.1.7.2.2",
        "C4.2.12.1.7.3", "C4.2.12.1.7.3.1", "C4.2.12.1.7.4", "C4.2.12.1.7.4.1", "C4.2.12.1.7.4.2",
        "C4.2.12.1.7.5", "C4.2.12.1.7.6", "C4.2.12.1.7.6.1", "C4.2.12.1.7.7", "C4.2.12.1.7.7.1",
    ];
    for (const number of italicNumbers) {
        const { path, unit } = await readUnit(number);
        const heading = unit.blocks.find((block) => block.kind === "heading");
        assert(heading, `Heading assente: ${number}`);
        assert(heading.text.normalized.startsWith(number), `Heading inatteso: ${number}`);
        italicHeading(heading);
        await save(path, unit);
    }

    const transverse = await readUnit("C4.2.12.1.3");
    const curling = transverse.unit.blocks.find((block) => block.blockId.endsWith("#block-p1"));
    assert(curling, "Capoverso non trovato: C4.2.12.1.3");
    italicText(curling, "curling");
    await save(transverse.path, transverse.unit);

    for (const number of ["C4.2.12.1.4", "C4.2.12.1.5.4.1"]) {
        const { path, unit } = await readUnit(number);
        for (const block of unit.blocks.filter((block) => block.kind === "list-item")) block.listMarker = "dash";
        await save(path, unit);
    }

    const joins = await readUnit("C4.2.12.1.7");
    const symbolsHeading = joins.unit.blocks.find((block) => block.blockId.endsWith("#block-symbols-heading"));
    assert(symbolsHeading, "Heading dei simboli non trovato");
    italicHeading(symbolsHeading);
    for (const block of joins.unit.blocks.filter((block) => block.blockId.includes("#block-symbol-"))) {
        block.kind = "list-item";
        block.listMarker = "none";
        delete block.listLevel;
    }
    await save(joins.path, joins.unit);
}

function figureCaption(asset: Asset): InlineSegment[] {
    const label = `Figura ${asset.officialNumber}`;
    assert(asset.caption.startsWith(label), `Didascalia inattesa: ${asset.officialNumber}`);
    const tail = asset.caption.slice(label.length);
    const term = asset.officialNumber === "C4.2.26" ? "X" : asset.officialNumber === "C4.2.27" ? "b_p" : undefined;
    if (!term) {
        assert(tail.length > 0, `Didascalia senza descrizione: ${asset.officialNumber}`);
        return [{ kind: "strong", value: label }, { kind: "em", value: tail }];
    }
    const index = tail.indexOf(term);
    assert(index >= 0, `Grandezza assente dalla didascalia: ${asset.officialNumber}`);
    const segments: InlineSegment[] = [{ kind: "strong", value: label }];
    if (index > 0) segments.push({ kind: "em", value: tail.slice(0, index) });
    segments.push({ kind: "math", value: term, latex: term });
    if (index + term.length < tail.length) segments.push({ kind: "em", value: tail.slice(index + term.length) });
    assert(joinInline(segments) === asset.caption, `Didascalia incoerente: ${asset.officialNumber}`);
    return segments;
}

async function updateCaptions(): Promise<void> {
    const files = (await readdir(assetDirectory)).filter((file) => /^C4\.2-step2[a-z]*\.json$/u.test(file));
    for (const file of files) {
        const path = join(assetDirectory, file);
        const manifest = JSON.parse(await readFile(path, "utf8")) as Manifest;
        let changed = false;
        for (const asset of manifest.figures) {
            if (asset.pdfPage < 136 || asset.pdfPage > 145 || !/^C4\.2\.\d+$/u.test(asset.officialNumber)) continue;
            asset.captionInline = figureCaption(asset);
            changed = true;
        }
        for (const asset of manifest.tables) {
            if (asset.pdfPage < 136 || asset.pdfPage > 145 || !asset.officialNumber.startsWith("C4.2.")) continue;
            asset.captionInline = [{ kind: "em", value: asset.caption }];
            changed = true;
        }
        if (changed) await save(path, manifest);
    }
}

await updateUnits();
await updateCaptions();
