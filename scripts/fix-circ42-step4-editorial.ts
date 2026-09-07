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

function applyEmphasis(block: Block, terms: string[], note: string): void {
    const result: InlineSegment[] = [];
    for (const segment of block.text.inline) {
        if (segment.kind !== "text") {
            result.push(segment);
            continue;
        }
        let remaining = segment.value;
        while (remaining.length > 0) {
            const match = terms
                .map((term) => ({ term, index: remaining.indexOf(term) }))
                .filter((candidate) => candidate.index >= 0)
                .sort((left, right) => left.index - right.index || right.term.length - left.term.length)[0];
            if (!match) {
                result.push({ kind: "text", value: remaining });
                break;
            }
            if (match.index > 0) result.push({ kind: "text", value: remaining.slice(0, match.index) });
            result.push({ kind: "em", value: match.term });
            remaining = remaining.slice(match.index + match.term.length);
        }
    }
    assert(joinInline(result) === block.text.normalized, `Segmenti inline incoerenti: ${block.blockId}`);
    block.text.inline = result;
    traceFormatting(block, note);
}

async function updateUnits(): Promise<void> {
    for (const number of ["C4.2.4.1.4.4", "C4.2.4.1.4.5", "C4.2.4.1.4.6"]) {
        const { path, unit } = await readUnit(number);
        const heading = unit.blocks.find((block) => block.kind === "heading");
        assert(heading, `Heading assente: ${number}`);
        assert(heading.text.normalized.startsWith(number), `Heading inatteso: ${number}`);
        heading.text.inline = [{ kind: "em", value: heading.text.normalized }];
        traceFormatting(heading, "Ripristinato il corsivo del sottotitolo ufficiale.");
        if (number === "C4.2.4.1.4.5") {
            const first = unit.blocks.find((block) => block.blockId.endsWith("#block-p1"));
            const third = unit.blocks.find((block) => block.blockId.endsWith("#block-p3"));
            assert(first && third, "Capoversi non trovati: C4.2.4.1.4.5");
            applyEmphasis(first, ["tensioni nominali", "tensioni di picco"], "Ripristinato il corsivo delle categorie di tensione.");
            applyEmphasis(third, ["geometriche o di picco"], "Ripristinato il corsivo delle categorie di tensione.");
        }
        await save(path, unit);
    }

    const { path, unit } = await readUnit("C4.2.12.1.1");
    for (const block of unit.blocks.filter((block) => block.kind === "list-item")) {
        const number = Number.parseInt(block.blockId.match(/block-item-(\d+)$/u)?.[1] ?? "0", 10);
        assert(number > 0, `Voce inattesa: ${block.blockId}`);
        block.listMarker = number <= 5 ? "none" : "dash";
    }
    await save(path, unit);
}

function mathCaption(caption: string): InlineSegment[] {
    const tokenLatex: Record<string, string> = { "Δσ": "\\Delta\\sigma", "Δτ": "\\Delta\\tau" };
    const segments: InlineSegment[] = [];
    let cursor = 0;
    for (const match of caption.matchAll(/Δ[στ]/gu)) {
        const index = match.index ?? 0;
        if (index > cursor) segments.push({ kind: "em", value: caption.slice(cursor, index) });
        const token = match[0];
        assert(token && tokenLatex[token], `Simbolo inatteso in didascalia: ${caption}`);
        segments.push({ kind: "math", value: token, latex: tokenLatex[token] });
        cursor = index + token.length;
    }
    if (cursor < caption.length) segments.push({ kind: "em", value: caption.slice(cursor) });
    assert(joinInline(segments) === caption, `Didascalia incoerente: ${caption}`);
    return segments;
}

function figureCaption(asset: Asset): InlineSegment[] {
    const label = `Figura ${asset.officialNumber}`;
    assert(asset.caption.startsWith(label), `Didascalia inattesa: ${asset.officialNumber}`);
    if (asset.officialNumber === "C4.2.22") {
        const segments: InlineSegment[] = [
            { kind: "strong", value: label },
            { kind: "em", value: " – Classificazione alternativa " },
            { kind: "math", value: "Δσ_C", latex: "\\Delta\\sigma_C" },
            { kind: "em", value: " per dettagli classificati come " },
            { kind: "math", value: "Δσ_C^*", latex: "\\Delta\\sigma_C^{*}" },
        ];
        assert(joinInline(segments) === asset.caption, `Didascalia incoerente: ${asset.officialNumber}`);
        return segments;
    }
    const tail = asset.caption.slice(label.length);
    assert(tail.length > 0, `Didascalia senza descrizione: ${asset.officialNumber}`);
    return [{ kind: "strong", value: label }, { kind: "em", value: tail }];
}

async function updateCaptions(): Promise<void> {
    const files = (await readdir(assetDirectory)).filter((file) => /^C4\.2-step2[a-z]*\.json$/u.test(file));
    for (const file of files) {
        const path = join(assetDirectory, file);
        const manifest = JSON.parse(await readFile(path, "utf8")) as Manifest;
        let changed = false;
        for (const asset of manifest.figures) {
            if (asset.pdfPage < 126 || asset.pdfPage > 135 || !/^C4\.2\.\d+$/u.test(asset.officialNumber)) continue;
            asset.captionInline = figureCaption(asset);
            changed = true;
        }
        for (const asset of manifest.tables) {
            if (asset.pdfPage < 126 || asset.pdfPage > 135 || !asset.officialNumber.startsWith("C4.2.")) continue;
            asset.captionInline = mathCaption(asset.caption);
            changed = true;
        }
        if (changed) await save(path, manifest);
    }
}

await updateUnits();
await updateCaptions();
