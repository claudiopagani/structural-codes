import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

type Inline = { kind: "text" | "em"; value: string };
type Block = {
    text?: { normalized: string; inline?: Inline[] };
    evidence?: {
        normalizedSha256: string;
        transformations: Array<{ operation: string; ruleVersion: string; note: string }>;
    };
};
type Unit = { blocks: Block[] };

const root = fileURLToPath(new URL("../", import.meta.url));
const path = join(root, "corpus", "units", "circ2019", "c4.6.json");
const ruleVersion = "circ46-editorial-profile-0.1.0";
const note = "Ripristinato il corsivo della definizione citata, verificato sul render ufficiale.";

function digest(value: string): string {
    return createHash("sha256").update(value).digest("hex");
}

const unit = JSON.parse(await readFile(path, "utf8")) as Unit;
const phrase = "sistemi costruttivi diversi da quelli disciplinati dalle presenti norme tecniche";
const block = unit.blocks.find((candidate) => candidate.text?.normalized.includes(phrase));
assert.ok(block?.text && block.evidence, "Definizione C4.6 assente");

if (!block.text.inline?.some((segment) => segment.kind === "em" && segment.value === phrase)) {
    const start = block.text.normalized.indexOf(phrase);
    assert.notEqual(start, -1, "Definizione C4.6 non trovata");
    block.text.inline = [
        { kind: "text", value: block.text.normalized.slice(0, start) },
        { kind: "em", value: phrase },
        { kind: "text", value: block.text.normalized.slice(start + phrase.length) },
    ];
}
block.evidence.normalizedSha256 = digest(block.text.normalized);
if (!block.evidence.transformations.some((transformation) => transformation.operation === "manual-correction" && transformation.ruleVersion === ruleVersion && transformation.note === note)) {
    block.evidence.transformations.push({ operation: "manual-correction", ruleVersion, note });
}

await writeFile(path, `${JSON.stringify(unit, null, 2)}\n`, "utf8");
