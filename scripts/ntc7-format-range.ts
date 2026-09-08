import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

type Inline = { kind: "text" | "em" | "strong" | "math"; value: string; latex?: string };
type Block = {
    blockId: string;
    kind: string;
    listMarker?: "bullet" | "dash" | "none";
    text?: { raw?: string; normalized: string; inline?: Inline[] };
    evidence?: { pdfPage?: number; normalizedSha256?: string; transformations?: Array<Record<string, unknown>> };
};
type Unit = { blocks: Block[] };

const root = fileURLToPath(new URL("../", import.meta.url));
const unitDir = join(root, "corpus", "units", "ntc2018");
const assetPath = join(root, "corpus", "assets", "ntc2018", "7.7-78-step2.json");
const acronym = /\b(SLV|SLC|SLD|SLU)\b/gu;

function assert(value: unknown, message: string): asserts value {
    if (!value) throw new Error(message);
}

function splitText(parts: Inline[], pattern: RegExp, kind: "em", only?: string): Inline[] {
    const output: Inline[] = [];
    for (const part of parts) {
        if (part.kind !== "text") {
            output.push(part);
            continue;
        }
        let cursor = 0;
        pattern.lastIndex = 0;
        for (const match of part.value.matchAll(pattern)) {
            const value = match[0];
            if (only && value !== only) continue;
            const at = match.index ?? 0;
            if (at > cursor) output.push({ kind: "text", value: part.value.slice(cursor, at) });
            output.push({ kind, value });
            cursor = at + value.length;
        }
        if (cursor < part.value.length) output.push({ kind: "text", value: part.value.slice(cursor) });
    }
    return output.filter((part) => part.value);
}

function recordNormalizedChange(block: Block, profile: string, note: string): void {
    if (!block.text || !block.evidence) return;
    block.evidence.normalizedSha256 = createHash("sha256").update(block.text.normalized).digest("hex");
    block.evidence.transformations ??= [];
    block.evidence.transformations.push({ operation: "manual-correction", ruleVersion: profile, note });
}

function formatBlock(block: Block, fileName: string, profile: string): boolean {
    if (!block.text) return false;
    const before = JSON.stringify(block);
    const raw = (block.text.raw ?? "").trimStart();
    const label = raw.match(/^([a-z]\)|\d+\.)\s/u)?.[1];

    if (block.kind === "list-item") {
        if (label) block.listMarker = "none";
        else if (/^(?:x|\u0083)\s/u.test(raw)) block.listMarker = "bullet";
        else if (/^(?:-|–|ȭ|ƺ)\s/u.test(raw) || /^[-–]\s/u.test(block.text.normalized) || fileName === "7.8.5.json") block.listMarker = "dash";
        else block.listMarker = "none";

        if (label && !block.text.normalized.startsWith(`${label} `)) {
            block.text.normalized = `${label} ${block.text.normalized}`;
            block.text.inline = [{ kind: "em", value: label }, { kind: "text", value: " " }, ...(block.text.inline ?? [{ kind: "text", value: block.text.normalized.slice(label.length + 1) }])];
            recordNormalizedChange(block, profile, "Ripristinata l’etichetta alfabetica o numerica dell’elenco, verificata sul PDF ufficiale.");
        } else if (label) {
            block.text.inline = splitText(block.text.inline ?? [{ kind: "text", value: block.text.normalized }], new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=\\s)`, "gu"), "em", label);
        }
    }

    if (block.kind !== "heading") block.text.inline = splitText(block.text.inline ?? [{ kind: "text", value: block.text.normalized }], acronym, "em");
    assert((block.text.inline ?? []).map((part) => part.value).join("") === block.text.normalized, `Inline incoerente: ${block.blockId}`);
    return before !== JSON.stringify(block);
}

function emWhole(block: Block): void {
    assert(block.text, block.blockId);
    block.text.inline = [{ kind: "em", value: block.text.normalized }];
}

function emPhrase(block: Block, phrase: string): void {
    assert(block.text, block.blockId);
    block.text.inline = splitText(block.text.inline ?? [{ kind: "text", value: block.text.normalized }], new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gu"), "em", phrase);
}

function captionParts(caption: string): Inline[] {
    const parts: Inline[] = [];
    let cursor = 0;
    for (const match of caption.matchAll(/γ_R|α|β/gu)) {
        const at = match.index ?? 0;
        if (at > cursor) parts.push({ kind: "em", value: caption.slice(cursor, at) });
        const latex = match[0] === "γ_R" ? "\\gamma_R" : match[0] === "α" ? "\\alpha" : "\\beta";
        parts.push({ kind: "math", value: match[0], latex });
        cursor = at + match[0].length;
    }
    if (cursor < caption.length) parts.push({ kind: "em", value: caption.slice(cursor) });
    return parts;
}

export async function runRange(start: number, end: number, profile: string): Promise<void> {
    const changed: string[] = [];
    for (const fileName of await readdir(unitDir)) {
        if (!/^7(?:\.|\.json)/u.test(fileName)) continue;
        const path = join(unitDir, fileName);
        const unit = JSON.parse(await readFile(path, "utf8")) as Unit;
        let touched = false;
        for (const block of unit.blocks) {
            const page = block.evidence?.pdfPage ?? 0;
            if (page < start || page > end) continue;
            touched = formatBlock(block, fileName, profile) || touched;

            if (fileName === "7.9.5.1.1.json" && block.kind === "heading" && ["Presso-flessione", "Taglio"].includes(block.text?.normalized ?? "")) {
                emWhole(block);
                touched = true;
            }
            if (fileName === "7.10.6.2.1.json" && block.text?.normalized.includes("Distanza tra costruzioni contigue")) {
                emPhrase(block, "Distanza tra costruzioni contigue");
                touched = true;
            }
            if (["7.11.5.3.1.json", "7.11.5.3.2.json"].includes(fileName) && block.kind === "heading" && !/^7\./u.test(block.text?.normalized ?? "")) {
                emWhole(block);
                touched = true;
            }
        }
        if (touched) {
            await writeFile(path, `${JSON.stringify(unit, null, 2)}\n`, "utf8");
            changed.push(fileName);
        }
    }

    const manifest = JSON.parse(await readFile(assetPath, "utf8"));
    let assetTouched = false;
    for (const table of manifest.tables ?? []) {
        if (table.pdfPage < start || table.pdfPage > end) continue;
        table.captionInline = captionParts(table.caption);
        assert(table.captionInline.map((part: Inline) => part.value).join("") === table.caption, `Caption tabella ${table.officialNumber}`);
        assetTouched = true;
    }
    for (const figure of manifest.figures ?? []) {
        if (figure.pdfPage < start || figure.pdfPage > end) continue;
        const separator = figure.caption.includes(" – ") ? " – " : " - ";
        const prefix = `Fig. ${figure.officialNumber}${separator}`;
        assert(figure.caption.startsWith(prefix), `Caption figura ${figure.officialNumber}`);
        figure.captionInline = [{ kind: "strong", value: prefix }, ...captionParts(figure.caption.slice(prefix.length))];
        assert(figure.captionInline.map((part: Inline) => part.value).join("") === figure.caption, `Caption figura ${figure.officialNumber}`);
        assetTouched = true;
    }
    if (assetTouched) await writeFile(assetPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
    console.log(`${profile}: pagine PDF ${start}-${end}; unità aggiornate ${changed.length}`);
}
