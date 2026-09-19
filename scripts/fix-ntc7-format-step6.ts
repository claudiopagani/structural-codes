import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { runRange } from "./ntc7-format-range.ts";

type Inline = { kind: "text" | "math"; value: string; latex?: string };
type Evidence = { transformations?: Array<Record<string, unknown>>; [key: string]: unknown };
type UnitBlock = { blockId: string; text?: { normalized: string; inline?: Inline[] }; evidence?: Evidence; [key: string]: unknown };
type GeneratedBlock = {
    blockId: string;
    kind: string;
    listMarker?: "none";
    origin: "official";
    text: { raw: string; normalized: string; normalizationVersion: string; inline: Inline[] };
    evidence: Record<string, unknown>;
};

await runRange(260, 269, "ntc7-format-audit-step6-0.1.0");

const root = fileURLToPath(new URL("../", import.meta.url));
const path = join(root, "corpus", "units", "ntc2018", "7.8.1.5.2.json");
const unit = JSON.parse(await readFile(path, "utf8")) as { blocks: UnitBlock[] };
const source = unit.blocks.find((block) => block.text?.normalized.startsWith("dove: α è il rapporto"));
if (source) {
    const baseEvidence = source.evidence ?? {};
    const make = (id: string, kind: string, normalized: string, listMarker?: "none"): GeneratedBlock => ({
        blockId: `urn:structural-codes:it:unit:ntc2018:7.8.1.5.2#${id}`,
        kind,
        ...(listMarker ? { listMarker } : {}),
        origin: "official",
        text: { raw: normalized, normalized, normalizationVersion: "ntc77-78-editorial-profile-0.1.0", inline: [] },
        evidence: {
            ...JSON.parse(JSON.stringify(baseEvidence)),
            transformations: [...(baseEvidence.transformations ?? []), { operation: "manual-correction", ruleVersion: "ntc7-format-audit-step6-0.1.0", note: "Ricostruito l’elenco labeled dopo la formula non numerata, come nello stacco tipografico del PDF ufficiale." }],
            rawSha256: createHash("sha256").update(normalized).digest("hex"),
            normalizedSha256: createHash("sha256").update(normalized).digest("hex"),
        },
    });
    const items = [
        make("block-p9-intro", "paragraph", "dove:"),
        make("block-p9-alpha", "list-item", "α è il rapporto tra accelerazione massima del terreno a_g su sottosuolo tipo A per lo stato limite in esame (vedi § 3.2.1) e l’accelerazione di gravità g;", "none"),
        make("block-p9-s", "list-item", "S è il coefficiente che tiene conto della categoria di sottosuolo e delle condizioni topografiche secondo quanto riportato nel § 3.2.3.2.1;", "none"),
        make("block-p9-z", "list-item", "Z è la quota del baricentro dell’elemento non strutturale misurata a partire dal piano di fondazione (vedi § 3.2.2);", "none"),
        make("block-p9-h", "list-item", "H è l’altezza della costruzione misurata a partire dal piano di fondazione;", "none"),
        make("block-p9-tail", "paragraph", "Per le strutture con isolamento sismico si assume sempre Z=0."),
    ];
    const terms = [
        ["α", "\\alpha"], ["a_g", "a_g"], ["g", "g"], ["S", "S"], ["Z", "Z"], ["H", "H"], ["Z=0", "Z=0"],
    ] as const;
    for (const block of items) {
        const text = block.text.normalized;
        let cursor = 0;
        block.text.inline = [];
        for (const [value, latex] of terms.filter(([value]) => text.includes(value)).sort((a, b) => b[0].length - a[0].length)) {
            const index = text.indexOf(value, cursor);
            if (index < 0) continue;
            if (index > cursor) block.text.inline.push({ kind: "text", value: text.slice(cursor, index) });
            block.text.inline.push({ kind: "math", value, latex });
            cursor = index + value.length;
        }
        if (cursor < text.length) block.text.inline.push({ kind: "text", value: text.slice(cursor) });
        if (block.text.inline.length === 0) block.text.inline = [{ kind: "text", value: text }];
    }
    unit.blocks.splice(unit.blocks.indexOf(source), 1, ...items);
    await writeFile(path, `${JSON.stringify(unit, null, 2)}\n`, "utf8");
}
const inlineById: Record<string, Inline[]> = {
    "block-p9-alpha": [{ kind: "math", value: "α", latex: "\\alpha" }, { kind: "text", value: " è il rapporto tra accelerazione massima del terreno " }, { kind: "math", value: "a_g", latex: "a_g" }, { kind: "text", value: " su sottosuolo tipo A per lo stato limite in esame (vedi § 3.2.1) e l’accelerazione di gravità " }, { kind: "math", value: "g", latex: "g" }, { kind: "text", value: ";" }],
    "block-p9-s": [{ kind: "math", value: "S", latex: "S" }, { kind: "text", value: " è il coefficiente che tiene conto della categoria di sottosuolo e delle condizioni topografiche secondo quanto riportato nel § 3.2.3.2.1;" }],
    "block-p9-z": [{ kind: "math", value: "Z", latex: "Z" }, { kind: "text", value: " è la quota del baricentro dell’elemento non strutturale misurata a partire dal piano di fondazione (vedi § 3.2.2);" }],
    "block-p9-h": [{ kind: "math", value: "H", latex: "H" }, { kind: "text", value: " è l’altezza della costruzione misurata a partire dal piano di fondazione;" }],
    "block-p9-tail": [{ kind: "text", value: "Per le strutture con isolamento sismico si assume sempre " }, { kind: "math", value: "Z=0", latex: "Z=0" }, { kind: "text", value: "." }],
};
let inlineFixed = false;
for (const block of unit.blocks) {
    const id = block.blockId.split("#")[1] ?? "";
    if (inlineById[id] && block.text) { block.text.inline = inlineById[id]; inlineFixed = true; }
}
if (inlineFixed) await writeFile(path, `${JSON.stringify(unit, null, 2)}\n`, "utf8");
