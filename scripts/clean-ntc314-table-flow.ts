/* eslint-disable @typescript-eslint/no-explicit-any */
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../", import.meta.url));
const unitPath = `${repoRoot}/corpus/units/ntc2018/3.1.4.json`;
const profile = "ntc2018-3.1.4-table-flow-0.1.0";
const hash = (value: string) => createHash("sha256").update(value, "utf8").digest("hex");

const unit = JSON.parse(await readFile(unitPath, "utf8"));
if (unit.blocks.some((block: { blockId: string }) => block.blockId.endsWith("#block-editorial-004-paragraph"))) {
    for (const block of unit.blocks) {
        for (const transformation of block.evidence?.transformations ?? []) {
            if (transformation.operation === "split-source-block") transformation.operation = "manual-correction";
        }
    }
    await writeFile(unitPath, `${JSON.stringify(unit, null, 2)}\n`, "utf8");
    console.log("ntc314-table-flow: existing split normalized");
    process.exit(0);
}
const old = unit.blocks.find((block: { blockId: string }) => block.blockId.endsWith("#block-editorial-004"));
if (!old?.text || !old.evidence) throw new Error("Blocco NTC 3.1.4#block-editorial-004 non trovato");

const splitNote = {
    operation: "manual-correction",
    ruleVersion: profile,
    note: "Separata la terza voce dell’elenco dal capoverso successivo, come mostrato nello stacco tipografico della pagina PDF 47.",
};
const textBlock = (block: any, blockId: string, kind: string, raw: string, normalized: string, inline?: any[]) => ({
    ...block,
    blockId,
    kind,
    text: { ...block.text, raw, normalized, normalizationVersion: profile, ...(inline ? { inline } : {}) },
    evidence: {
        ...block.evidence,
        extraction: { ...block.evidence.extraction, toolVersion: profile },
        transformations: [...block.evidence.transformations, splitNote],
        rawSha256: hash(raw),
        normalizedSha256: hash(normalized),
    },
});

const listRaw = "- carichi orizzontali lineari Hk";
const listNormalized = "carichi orizzontali lineari Hk";
const paragraphRaw = "I valori nominali e/o caratteristici di qk, Qk ed H k sono riportati nella Tab. 3.1.II. Tali valori sono comprensivi degli effetti dinamici\nordinari, purché non vi sia rischio di rilevanti amplificazioni dinamiche della risposta delle strutture.";
const paragraphNormalized = "I valori nominali e/o caratteristici di qk, Qk ed Hk sono riportati nella Tab. 3.1.II. Tali valori sono comprensivi degli effetti dinamici ordinari, purché non vi sia rischio di rilevanti amplificazioni dinamiche della risposta delle strutture.";
const listInline = [
    { kind: "text", value: "carichi orizzontali lineari " },
    { kind: "math", value: "Hk", latex: "H_k" },
];
const paragraphInline = [
    { kind: "text", value: "I valori nominali e/o caratteristici di " },
    { kind: "math", value: "qk", latex: "q_k" },
    { kind: "text", value: ", " },
    { kind: "math", value: "Qk", latex: "Q_k" },
    { kind: "text", value: " ed " },
    { kind: "math", value: "Hk", latex: "H_k" },
    { kind: "text", value: " sono riportati nella Tab. 3.1.II. Tali valori sono comprensivi degli effetti dinamici ordinari, purché non vi sia rischio di rilevanti amplificazioni dinamiche della risposta delle strutture." },
];

const listBlock = textBlock(old, `${unit.id}#block-editorial-004`, "list-item", listRaw, listNormalized, listInline);
const paragraphBlock = textBlock(old, `${unit.id}#block-editorial-004-paragraph`, "paragraph", paragraphRaw, paragraphNormalized, paragraphInline);
const duplicateIds = new Set(["006", "007", "008", "009"].map((number) => `${unit.id}#block-editorial-${number}`));
const nextBlocks = [];
for (const block of unit.blocks) {
    if (duplicateIds.has(block.blockId)) continue;
    if (block === old) {
        nextBlocks.push(listBlock, paragraphBlock);
    } else {
        nextBlocks.push(block);
    }
}
unit.blocks = nextBlocks;
await writeFile(unitPath, `${JSON.stringify(unit, null, 2)}\n`, "utf8");
console.log("ntc314-table-flow: separated list/capoverso and removed duplicated table extraction");
