import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

type InlineSegment = { kind: "text" | "em" | "strong" | "underline"; value: string } | { kind: "math"; value: string; latex: string };
type Block = {
    blockId: string;
    kind: string;
    listMarker?: "bullet" | "dash" | "none";
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
const typographicNote = "Ripristinato il corsivo del sottotitolo ufficiale.";

function assert(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message); }
function sha256(value: string): string { return createHash("sha256").update(value, "utf8").digest("hex"); }
function joinInline(segments: InlineSegment[]): string { return segments.map((segment) => segment.value).join(""); }

async function readUnit(number: string): Promise<{ path: string; unit: Unit }> {
    const path = join(unitDirectory, `${number.toLowerCase()}.json`);
    return { path, unit: JSON.parse(await readFile(path, "utf8")) as Unit };
}
async function save(path: string, value: unknown): Promise<void> { await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8"); }

function recordTransformation(block: Block, note: string): void {
    block.evidence.normalizedSha256 = sha256(block.text.normalized);
    if (!block.evidence.transformations.some((entry) => entry.operation === "manual-correction" && entry.note === note)) {
        block.evidence.transformations.push({ operation: "manual-correction", ruleVersion: profile, note });
    }
}

function italicHeading(block: Block): void {
    block.text.inline = [{ kind: "em", value: block.text.normalized }];
    recordTransformation(block, typographicNote);
}

function italicTerms(block: Block, terms: string[]): void {
    const source = block.text.inline;
    const updated: InlineSegment[] = [];
    for (const segment of source) {
        if (segment.kind !== "text") {
            updated.push(segment);
            continue;
        }
        let remaining = segment.value;
        while (remaining.length > 0) {
            const match = terms
                .map((term) => ({ term, index: remaining.indexOf(term) }))
                .filter((candidate) => candidate.index >= 0)
                .sort((left, right) => left.index - right.index || right.term.length - left.term.length)[0];
            if (!match) {
                updated.push({ kind: "text", value: remaining });
                break;
            }
            if (match.index > 0) updated.push({ kind: "text", value: remaining.slice(0, match.index) });
            updated.push({ kind: "em", value: match.term });
            remaining = remaining.slice(match.index + match.term.length);
        }
    }
    assert(joinInline(updated) === block.text.normalized, `Segmenti inline incoerenti: ${block.blockId}`);
    block.text.inline = updated;
    recordTransformation(block, "Ripristinato il corsivo dei termini tecnici inglesi.");
}

async function updateUnits(): Promise<void> {
    const italicNumbers = [
        "C4.2.4.1.3.4.3", "C4.2.4.1.3.4.4", "C4.2.4.1.3.4.5", "C4.2.4.1.3.4.6", "C4.2.4.1.3.4.7",
        "C4.2.4.1.3.4.8", "C4.2.4.1.3.4.9", "C4.2.4.1.4.1", "C4.2.4.1.4.2", "C4.2.4.1.4.3",
    ];
    for (const number of italicNumbers) {
        const { path, unit } = await readUnit(number);
        const headings = unit.blocks.filter((block) => block.kind === "heading");
        assert(headings.length > 0, `Heading assente: ${number}`);
        if (number === "C4.2.4.1.3.4.6") {
            for (const heading of headings) italicHeading(heading);
        } else {
            const [heading] = headings;
            assert(heading, `Heading assente: ${number}`);
            assert(heading.text.normalized.startsWith(number), `Heading inatteso: ${number}`);
            italicHeading(heading);
        }
        if (number === "C4.2.4.1.4.2") {
            const firstParagraph = unit.blocks.find((block) => block.blockId.endsWith("#block-p1"));
            assert(firstParagraph, "Primo capoverso non trovato: C4.2.4.1.4.2");
            italicTerms(firstParagraph, ["reservoir method", "rainflow method"]);
            for (const item of unit.blocks.filter((block) => block.kind === "list-item")) item.listMarker = "dash";
        }
        await save(path, unit);
    }
}

function formatFigureCaption(asset: Asset): InlineSegment[] {
    const label = `Figura ${asset.officialNumber}`;
    assert(asset.caption.startsWith(label), `Didascalia inattesa: ${asset.officialNumber}`);
    if (asset.officialNumber === "C4.2.13") {
        const segments: InlineSegment[] = [
            { kind: "strong", value: label },
            { kind: "em", value: " – Luci equivalenti " },
            { kind: "math", value: "L_e", latex: "L_e" },
            { kind: "em", value: " e coefficienti riduttivi " },
            { kind: "math", value: "β", latex: "\\beta" },
            { kind: "em", value: " per travi continue" },
        ];
        assert(joinInline(segments) === asset.caption, `Didascalia incoerente: ${asset.officialNumber}`);
        return segments;
    }
    const tail = asset.caption.slice(label.length);
    assert(tail.length > 0, `Didascalia senza descrizione: ${asset.officialNumber}`);
    return [{ kind: "strong", value: label }, { kind: "em", value: tail }];
}

function formatTableCaption(asset: Asset): InlineSegment[] {
    if (asset.officialNumber === "C4.2.X") {
        const segments: InlineSegment[] = [
            { kind: "em", value: "Fattori riduttivi " },
            { kind: "math", value: "β", latex: "\\beta" },
            { kind: "em", value: " per la larghezza collaborante" },
        ];
        assert(joinInline(segments) === asset.caption, `Didascalia incoerente: ${asset.officialNumber}`);
        return segments;
    }
    return [{ kind: "em", value: asset.caption }];
}

async function updateCaptions(): Promise<void> {
    const files = (await readdir(assetDirectory)).filter((file) => /^C4\.2-step2[a-z]*\.json$/u.test(file));
    for (const file of files) {
        const path = join(assetDirectory, file);
        const manifest = JSON.parse(await readFile(path, "utf8")) as Manifest;
        let changed = false;
        for (const asset of manifest.figures) {
            if (asset.pdfPage < 116 || asset.pdfPage > 125 || !/^C4\.2\.\d+$/u.test(asset.officialNumber)) continue;
            asset.captionInline = formatFigureCaption(asset);
            changed = true;
        }
        for (const asset of manifest.tables) {
            if (asset.pdfPage < 116 || asset.pdfPage > 125 || !asset.officialNumber.startsWith("C4.2.")) continue;
            asset.captionInline = formatTableCaption(asset);
            changed = true;
        }
        if (changed) await save(path, manifest);
    }
}

await updateUnits();
await updateCaptions();
