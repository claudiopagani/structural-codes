import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

type InlineSegment =
    | { kind: "text" | "em" | "strong" | "underline"; value: string }
    | { kind: "math"; value: string; latex: string };

type Block = {
    blockId: string;
    kind: string;
    listMarker?: "bullet" | "dash" | "none";
    listLevel?: number;
    text: {
        raw: string;
        normalized: string;
        inline: InlineSegment[];
    };
    evidence: {
        normalizedSha256: string;
        transformations: Array<{ operation: string; ruleVersion: string; note: string }>;
    };
};

type Unit = { numbering: { official: string }; blocks: Block[] };
type Asset = {
    officialNumber: string;
    caption: string;
    captionInline?: InlineSegment[];
};
type Manifest = { figures: Asset[]; tables: Asset[] };

const root = process.cwd();
const unitDirectory = join(root, "corpus", "units", "circ2019");
const assetPath = join(root, "corpus", "assets", "circ2019", "C4.2-step1.json");
const profile = "circ42-editorial-formatting-0.1.0";

function assert(condition: unknown, message: string): asserts condition {
    if (!condition) throw new Error(message);
}

function sha256(value: string): string {
    return createHash("sha256").update(value, "utf8").digest("hex");
}

function concatenate(segments: InlineSegment[]): string {
    return segments.map((segment) => segment.value).join("");
}

function findBlock(unit: Unit, prefix: string): Block {
    const block = unit.blocks.find((candidate) => candidate.text?.normalized.startsWith(prefix));
    assert(block, `Blocco assente in ${unit.numbering.official}: ${prefix}`);
    return block;
}

function saveInline(block: Block, segments: InlineSegment[], note: string): void {
    assert(concatenate(segments) === block.text.normalized, `Inline incoerente: ${block.blockId}`);
    block.text.inline = segments;
    block.evidence.normalizedSha256 = sha256(block.text.normalized);
    if (!block.evidence.transformations.some((entry) => entry.operation === "manual-correction" && entry.note === note)) {
        block.evidence.transformations.push({ operation: "manual-correction", ruleVersion: profile, note });
    }
}

function emphasizePhrase(block: Block, phrase: string, note: string): void {
    if (block.text.inline.some((segment) => segment.kind === "em" && segment.value === phrase)) return;
    const index = block.text.normalized.indexOf(phrase);
    assert(index >= 0, `Frase assente in ${block.blockId}: ${phrase}`);
    const end = index + phrase.length;
    const segments: InlineSegment[] = [];
    if (index > 0) segments.push({ kind: "text", value: block.text.normalized.slice(0, index) });
    segments.push({ kind: "em", value: phrase });
    if (end < block.text.normalized.length) segments.push({ kind: "text", value: block.text.normalized.slice(end) });
    saveInline(block, segments, note);
}

function setCaption(asset: Asset, caption: string, label: string): void {
    assert(caption.startsWith(label), `Didascalia inattesa: ${asset.officialNumber}`);
    const tail = caption.slice(label.length);
    asset.caption = caption;
    assert(tail.length > 0, `Didascalia senza descrizione: ${asset.officialNumber}`);
    const captionInline: InlineSegment[] = [{ kind: "strong", value: label }, { kind: "em", value: tail }];
    asset.captionInline = captionInline;
    assert(concatenate(captionInline) === asset.caption, `Didascalia incoerente: ${asset.officialNumber}`);
}

async function readUnit(number: string): Promise<{ path: string; unit: Unit }> {
    const path = join(unitDirectory, `${number.toLowerCase()}.json`);
    return { path, unit: JSON.parse(await readFile(path, "utf8")) as Unit };
}

async function save(path: string, value: unknown): Promise<void> {
    await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function updateUnits(): Promise<void> {
    {
        const { path, unit } = await readUnit("C4.2");
        emphasizePhrase(
            findBlock(unit, "E’ pertanto compito del progettista"),
            "Specifica di esecuzione",
            "Ripristinato il corsivo della denominazione ufficiale del documento UNI EN 1090-2.",
        );
        for (const block of unit.blocks.filter((candidate) => candidate.kind === "list-item")) {
            block.listMarker = "dash";
        }
        await save(path, unit);
    }

    {
        const { path, unit } = await readUnit("C4.2.3.3");
        for (const block of unit.blocks.filter((candidate) => candidate.kind === "list-item")) {
            block.listMarker = "dash";
        }
        await save(path, unit);
    }
}

async function updateAssets(): Promise<void> {
    const manifest = JSON.parse(await readFile(assetPath, "utf8")) as Manifest;
    const figures = new Map(manifest.figures.map((figure) => [figure.officialNumber, figure]));
    const figureCaptions: Array<[string, string]> = [
        ["C4.2.1", "Figura C4.2.1 - Configurazione deformata di strutture a telaio sotto azioni orizzontali e verticali"],
        ["C4.2.2", "Figura C4.2.2 -Imperfezioni globali equivalenti"],
        ["C4.2.3", "Figura C4.2.3 -Effetti delle imperfezioni sugli orizzontamenti"],
        ["C4.2.4", "Figura C4.2.4 - Sistemi di forze equivalenti alle imperfezioni"],
        ["C4.2.5", "Figura C4.2.5 - Forze equivalenti in sistemi di controvento"],
        ["C4.2.6", "Figura C4.2.6 - Forze equivalenti nelle giunzioni di elementi o piattabande compresse"],
    ];
    for (const [officialNumber, caption] of figureCaptions) {
        const figure = figures.get(officialNumber);
        assert(figure, `Figura assente: ${officialNumber}`);
        setCaption(figure, caption, `Figura ${officialNumber}`);
    }

    const table = manifest.tables.find((candidate) => candidate.officialNumber === "C4.2.I");
    assert(table, "Tabella C4.2.I assente");
    table.captionInline = [{ kind: "em", value: table.caption }];
    assert(concatenate(table.captionInline) === table.caption, "Didascalia tabella incoerente: C4.2.I");

    await save(assetPath, manifest);
}

await updateUnits();
await updateAssets();
