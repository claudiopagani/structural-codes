import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { createTwoFilesPatch } from "diff";

interface TextBlock {
    blockId: string;
    origin: string;
    kind: string;
    text?: {
        raw: string;
        normalized: string;
    };
    evidence?: {
        sourceId: string;
        pdfPage: number;
        printedPage: string | null;
        region: unknown;
        rawSha256: string;
        normalizedSha256: string;
        transformations: unknown[];
    };
}

interface Unit {
    id: string;
    blocks: TextBlock[];
}

const repoRoot = fileURLToPath(new URL("../", import.meta.url));
const outputRoot = resolve(repoRoot, "review", "diffs");

function argument(name: string): string | undefined {
    const index = process.argv.indexOf(name);
    return index === -1 ? undefined : process.argv[index + 1];
}

function visibleControls(text: string): string {
    return text.replace(
        /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/gu,
        (character) =>
            `\\u${character.codePointAt(0)!.toString(16).toUpperCase().padStart(4, "0")}`,
    );
}

const unitArg = argument("--unit");
if (unitArg === undefined) {
    console.error("Uso: generate-review-diff --unit <record.json>");
    process.exit(2);
}
const unitFile = resolve(repoRoot, unitArg);
if (!unitFile.startsWith(resolve(repoRoot) + sep)) {
    throw new Error("--unit deve essere interno al repository");
}
const unit = JSON.parse(await readFile(unitFile, "utf8")) as Unit;
const sections: string[] = [
    `# Diff di revisione — ${unit.id}`,
    "",
    `Origine record: \`${relative(repoRoot, unitFile).replaceAll("\\", "/")}\``,
    "",
    "> Report generato: non costituisce approvazione umana.",
    "",
];
for (const block of unit.blocks) {
    if (block.origin !== "official" || block.text === undefined) continue;
    sections.push(`## ${block.blockId}`, "");
    if (block.evidence !== undefined) {
        sections.push(
            `- Fonte: \`${block.evidence.sourceId}\``,
            `- Pagina PDF: ${block.evidence.pdfPage}`,
            `- Pagina stampata: ${block.evidence.printedPage ?? "non rilevata"}`,
            `- Regione: \`${JSON.stringify(block.evidence.region)}\``,
            `- Hash raw: \`${block.evidence.rawSha256}\``,
            `- Hash normalizzato: \`${block.evidence.normalizedSha256}\``,
            `- Trasformazioni: \`${JSON.stringify(block.evidence.transformations)}\``,
            "",
        );
    }
    if (block.text.raw === block.text.normalized) {
        sections.push("Nessuna differenza tra raw e normalizzato.", "");
    } else {
        sections.push(
            "```diff",
            createTwoFilesPatch(
                "raw",
                "normalized",
                visibleControls(block.text.raw),
                visibleControls(block.text.normalized),
                "",
                "",
                { context: 3 },
            ).trimEnd(),
            "```",
            "",
        );
    }
}
const safeId = unit.id.replace(/[^a-zA-Z0-9._-]+/gu, "-");
const outputFile = join(outputRoot, `${safeId}.md`);
await mkdir(dirname(outputFile), { recursive: true });
await writeFile(outputFile, `${sections.join("\n")}\n`, "utf8");
console.log(`Report diff: ${outputFile}`);
