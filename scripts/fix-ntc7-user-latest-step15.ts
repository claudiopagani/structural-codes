import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

type Inline = { kind: "text" | "em" | "strong" | "strong-em" | "math"; value: string; latex?: string };
type Evidence = { transformations: Array<Record<string, unknown>>; normalizedSha256: string; [key: string]: unknown };
type Block = { kind: string; listMarker?: "bullet" | "dash" | "none"; listLevel?: number; text?: { normalized: string; normalizationVersion: string; inline?: Inline[] }; evidence?: Evidence };
type Unit = { blocks: Block[] };
type Cell = { text: string; [key: string]: unknown };
type Table = { officialNumber: string; columnWidths?: number[]; headers: Cell[][]; rows: Cell[][] };
type Manifest = { tables: Table[] };

const root = fileURLToPath(new URL("../", import.meta.url));
const profile = "ntc7-user-latest-step15-0.1.0";

function hash(value: string): string {
    return createHash("sha256").update(value, "utf8").digest("hex");
}

async function readJson<T>(relativePath: string): Promise<T> {
    return JSON.parse(await readFile(join(root, relativePath), "utf8")) as T;
}

async function writeJson(relativePath: string, value: unknown): Promise<void> {
    await writeFile(join(root, relativePath), `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

const behavior = await readJson<Unit>("corpus/units/ntc2018/7.5.2.2.json");
for (const block of behavior.blocks) {
    if (block.kind !== "list-item" || !block.text) continue;
    const normalized = block.text.normalized.startsWith("- ") ? block.text.normalized : `- ${block.text.normalized.trimStart()}`;
    block.text.normalized = normalized;
    block.text.normalizationVersion = profile;
    if (block.text.inline?.[0]?.kind === "text") {
        block.text.inline[0].value = block.text.inline[0].value.startsWith("- ")
            ? block.text.inline[0].value
            : `- ${block.text.inline[0].value.trimStart()}`;
    }
    if (block.evidence) {
        block.evidence.normalizedSha256 = hash(normalized);
        if (!block.evidence.transformations.some((transformation) => transformation.ruleVersion === profile)) {
            block.evidence.transformations.push({
                operation: "manual-correction",
                ruleVersion: profile,
                note: "Riprodotto il pattern di §7.4.3.2: voce con trattino, testo e formula α_u/α_1 inline, al livello di elenco annidato.",
            });
        }
    }
    block.listMarker = "dash";
    block.listLevel = 1;
}
await writeJson("corpus/units/ntc2018/7.5.2.2.json", behavior);

const manifest = await readJson<Manifest>("corpus/assets/ntc2018/7.7-78-step2.json");
const table = manifest.tables.find((candidate) => candidate.officialNumber === "7.8.II");
if (!table) throw new Error("Tab. 7.8.II mancante");
table.columnWidths = [10, 6, 8.4, 8.4, 8.4, 8.4, 8.4, 8.4, 8.4, 8.4, 8.4, 8.4];
await writeJson("corpus/assets/ntc2018/7.7-78-step2.json", manifest);

console.log(`fix-ntc7-user-latest-step15 (${profile}): pattern §7.5.2.2 e larghezze Tab. 7.8.II aggiornati`);
