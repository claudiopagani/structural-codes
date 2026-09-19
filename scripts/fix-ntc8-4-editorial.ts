import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

type Inline = { kind: "text" | "strong-em"; value: string };
type Block = {
    kind: string;
    text?: {
        normalized: string;
        inline?: Inline[];
        normalizationVersion?: string;
    };
    evidence?: {
        transformations: Array<{ operation: string; ruleVersion: string; note: string }>;
        normalizedSha256: string;
    };
};
type Unit = { blocks: Block[] };

const root = process.cwd();
const path = join(root, "corpus", "units", "ntc2018", "8.4.json");
const profile = "ntc8-4-editorial-formatting-0.1.0";
const note = "Applicato il grassetto corsivo ai titoli delle tre categorie, verificato sul render ufficiale della pagina 295.";

function sha256(value: string): string {
    return createHash("sha256").update(value, "utf8").digest("hex");
}

function styleTitle(block: Block, title: string): void {
    if (!block.text || !block.evidence) throw new Error(`Blocco incompleto: ${block.kind}`);
    const index = block.text.normalized.indexOf(title);
    if (index < 0) throw new Error(`Titolo non trovato: ${title}`);
    const end = index + title.length;
    block.text.inline = [
        ...(index > 0 ? [{ kind: "text" as const, value: block.text.normalized.slice(0, index) }] : []),
        { kind: "strong-em", value: title },
        ...(end < block.text.normalized.length ? [{ kind: "text" as const, value: block.text.normalized.slice(end) }] : []),
    ];
    block.text.normalizationVersion = profile;
    block.evidence.normalizedSha256 = sha256(block.text.normalized);
    if (!block.evidence.transformations.some((entry) => entry.operation === "manual-correction" && entry.ruleVersion === profile && entry.note === note)) {
        block.evidence.transformations.push({ operation: "manual-correction", ruleVersion: profile, note });
    }
}

const unit = JSON.parse(await readFile(path, "utf8")) as Unit;
const titles = [
    "interventi di riparazione o locali:",
    "interventi di miglioramento:",
    "interventi di adeguamento:",
];

for (const title of titles) {
    const block = unit.blocks.find((candidate) => candidate.text?.normalized.includes(title));
    if (!block) throw new Error(`Voce non trovata: ${title}`);
    styleTitle(block, title);
}

await writeFile(path, `${JSON.stringify(unit, null, 2)}\n`, "utf8");
