import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();
const unitsDir = join(root, "corpus", "units", "circ2019");
const profile = "circ8-c87-step1-editorial-0.1.0";

type InlineKind = "text" | "math" | "em" | "underline" | "strong-em" | "strong";
type Inline = { kind: InlineKind; value: string; latex?: string };
type Evidence = { transformations?: Array<{ operation: string; ruleVersion: string; note: string }>; normalizedSha256?: string };
type Text = { normalized: string; inline?: Inline[]; normalizationVersion?: string };
type Block = {
    kind: string;
    text?: Text;
    evidence?: Evidence;
    listMarker?: "numbered" | "bullet" | "dash" | "none";
    listLevel?: number;
};
type Unit = { blocks: Block[] };

async function readJson<T>(path: string): Promise<T> {
    return JSON.parse(await readFile(path, "utf8")) as T;
}

async function writeJson(path: string, value: unknown): Promise<void> {
    await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function addTransformation(block: Block, note: string): void {
    if (!block.evidence) return;
    block.evidence.transformations ??= [];
    if (!block.evidence.transformations.some((item) => item.ruleVersion === profile && item.note === note)) {
        block.evidence.transformations.push({ operation: "manual-correction", ruleVersion: profile, note });
    }
}

function updateNormalizedHash(block: Block): void {
    if (!block.text || !block.evidence) return;
    block.evidence.normalizedSha256 = createHash("sha256").update(block.text.normalized, "utf8").digest("hex");
}

function setHeadingTitleEmphasis(block: Block): void {
    if (!block.text || block.kind !== "heading") throw new Error("Titolo non valido");
    const match = /^(C\d+(?:\.\d+)+)\s+(.+)$/u.exec(block.text.normalized);
    if (!match) throw new Error(`Titolo non riconosciuto: ${block.text.normalized}`);
    block.text.inline = [
        { kind: "text", value: `${match[1]} ` },
        { kind: "strong-em", value: match[2]! },
    ];
    block.text.normalizationVersion = profile;
    addTransformation(block, "Applicata la resa in grassetto corsivo del titolo interno verificata sul render ufficiale.");
}

function makeLabeled(block: Block, note: string): void {
    if (!block.text) throw new Error("Voce labeled senza testo");
    block.kind = "list-item";
    block.listMarker = "none";
    block.listLevel = 0;
    block.text.normalizationVersion = profile;
    addTransformation(block, note);
}

function removeLeadingDash(block: Block): void {
    if (!block.text) throw new Error("Voce senza testo per il trattino");
    if (!/^\s*-\s*/u.test(block.text.normalized)) return;
    block.text.normalized = block.text.normalized.replace(/^\s*-\s*/u, "");
    block.text.inline = block.text.inline?.map((segment, index) => index === 0 ? { ...segment, value: segment.value.replace(/^\s*-\s*/u, "") } : segment);
    block.text.normalizationVersion = profile;
    updateNormalizedHash(block);
    addTransformation(block, "Separato il marcatore dash dal testo della voce dell’elenco annidato.");
}

function styleStateLabel(block: Block, state: string): void {
    if (!block.text) throw new Error(`Blocco senza testo per ${state}`);
    const source = block.text.inline ?? [{ kind: "text" as const, value: block.text.normalized }];
    let found = false;
    const result: Inline[] = [];
    for (let index = 0; index < source.length; index += 1) {
        const segment = source[index]!;
        const next = source[index + 1];
        if (!found && segment.kind === "math" && segment.value === state && next?.value.startsWith(":")) {
            found = true;
            result.push({ ...segment, latex: `\\mathbf{${state}}` });
            result.push({ kind: "strong-em", value: ":" });
            if (next.value.length > 1) result.push({ ...next, value: next.value.slice(1) });
            index += 1;
        } else {
            result.push(segment);
        }
    }
    if (!found) {
        const plain = source.map((segment) => segment.value).join("");
        if (!plain.startsWith(`${state}:`)) throw new Error(`Etichetta ${state}: non trovata in ${plain}`);
        block.text.inline = [
            { kind: "strong-em", value: `${state}:` },
            { kind: "text", value: plain.slice(state.length + 1) },
        ];
    } else block.text.inline = result;
    block.text.normalizationVersion = profile;
    updateNormalizedHash(block);
    addTransformation(block, `Evidenziata in grassetto l’etichetta ${state}: dell’elenco.`);
}

function setAlpha0Inline(block: Block, occurrenceCount: number): void {
    if (!block.text) throw new Error("Blocco senza testo per α_0");
    const text = block.text.normalized;
    const positions: number[] = [];
    let from = 0;
    while (true) {
        const position = text.indexOf("α_0", from);
        if (position < 0) break;
        positions.push(position);
        from = position + 3;
    }
    if (positions.length !== occurrenceCount) throw new Error(`Attese ${occurrenceCount} occorrenze di α_0, trovate ${positions.length}`);
    const inline: Inline[] = [];
    let cursor = 0;
    for (const position of positions) {
        if (position > cursor) inline.push({ kind: "text", value: text.slice(cursor, position) });
        inline.push({ kind: "math", value: "α_0", latex: "\\alpha_0" });
        cursor = position + 3;
    }
    if (cursor < text.length) inline.push({ kind: "text", value: text.slice(cursor) });
    block.text.inline = inline;
    block.text.normalizationVersion = profile;
    updateNormalizedHash(block);
    addTransformation(block, "Corretto il glifo estratto come moltiplicatore α_0 sulla base del PDF ufficiale.");
}

function fixQInInline(block: Block): void {
    if (!block.text?.inline) throw new Error("Inline mancante per q");
    const source = block.text.inline;
    if (source.some((segment) => segment.kind === "math" && segment.value === "q")) return;
    const result: Inline[] = [];
    let changed = false;
    for (const segment of source) {
        if (!changed && segment.kind === "text" && segment.value.includes(" q.")) {
            const at = segment.value.indexOf(" q.");
            result.push({ kind: "text", value: segment.value.slice(0, at + 1) });
            result.push({ kind: "math", value: "q", latex: "q" }, { kind: "text", value: "." });
            changed = true;
        } else {
            result.push(segment);
        }
    }
    if (!changed) throw new Error("q non trovato nell’inline");
    block.text.inline = result;
    block.text.normalizationVersion = profile;
    addTransformation(block, "Reso in matematica inline il fattore q del primo paragrafo.");
}

const files = [
    "c8.7.1.2.1.json",
    "c8.7.1.2.1.1.json",
    "c8.7.1.2.1.2.json",
    "c8.7.1.2.1.3.json",
    "c8.7.1.2.1.6.json",
    "c8.7.1.3.1.json",
];
const units = new Map<string, Unit>();
for (const file of files) units.set(file, await readJson<Unit>(join(unitsDir, file)));

const c87121 = units.get("c8.7.1.2.1.json")!;
for (const prefix of ["L’approccio cinematico lineare", "L’approccio cinematico non lineare"]) {
    const block = c87121.blocks.find((item) => item.text?.normalized.startsWith(prefix));
    if (!block) throw new Error(`Titolo interno non trovato: ${prefix}`);
    const source = block.text!.inline ?? [{ kind: "text" as const, value: block.text!.normalized }];
    const plain = source.map((segment) => segment.value).join("");
    const at = plain.indexOf(prefix);
    if (at < 0) throw new Error(`Titolo interno non trovato nell’inline: ${prefix}`);
    const before = plain.slice(0, at);
    const after = plain.slice(at + prefix.length);
    block.text!.inline = [
        ...(before ? [{ kind: "text" as const, value: before }] : []),
        { kind: "strong-em", value: prefix },
        ...(after ? [{ kind: "text" as const, value: after }] : []),
    ];
    block.text!.normalizationVersion = profile;
    addTransformation(block, `Applicata la resa in grassetto corsivo del titolo ${prefix}.`);
}

const c871212 = units.get("c8.7.1.2.1.1.json")!;
setHeadingTitleEmphasis(c871212.blocks[0]!);
fixQInInline(c871212.blocks[1]!);
const block3 = c871212.blocks[3]!;
block3.text!.normalized = block3.text!.normalized.replace("moltiplicatore 9", "moltiplicatore α_0");
setAlpha0Inline(block3, 1);
const block15 = c871212.blocks[15]!;
block15.text!.normalized = block15.text!.normalized.replace("moltiplicatore 9che", "moltiplicatore α_0 che").replace("moltiplicatori 9ottenuti", "moltiplicatori α_0 ottenuti");
setAlpha0Inline(block15, 2);
const block21 = c871212.blocks[21]!;
block21.text!.inline = block21.text!.inline?.map((segment) => segment.kind === "math" ? { ...segment, latex: segment.latex?.replaceAll("\\varphi", "\\phi") } : segment);
block21.text!.normalizationVersion = profile;
addTransformation(block21, "Uniformata la resa LaTeX del simbolo φ verificata sul PDF ufficiale.");
const block25 = c871212.blocks[25]!;
block25.text!.normalized = block25.text!.normalized.replace("moltiplicatore 9", "moltiplicatore α_0");
setAlpha0Inline(block25, 1);
for (const index of [6, 7, 8, 9, 10, 11, 12, 13, 14, 19, 20, 21, 22, 23, 24]) makeLabeled(c871212.blocks[index]!, "Resa come elenco labeled con descrizione allineata al label matematico.");

const c871212Unit = units.get("c8.7.1.2.1.2.json")!;
setHeadingTitleEmphasis(c871212Unit.blocks[0]!);

const c871213 = units.get("c8.7.1.2.1.3.json")!;
setHeadingTitleEmphasis(c871213.blocks[0]!);
for (const index of [5, 6, 7, 8, 16, 17, 18, 19, 20, 21]) makeLabeled(c871213.blocks[index]!, "Resa come elenco labeled con descrizione allineata al label matematico.");
const kappa = c871213.blocks[17]!;
kappa.text!.inline = [
    { kind: "math", value: "κ", latex: "\\kappa" },
    { kind: "text", value: " è un coefficiente che vale " },
    { kind: "math", value: "6,2", latex: "6{,}2" },
    { kind: "text", value: " per elementi svettanti (mensola) e " },
    { kind: "math", value: "2,2", latex: "2{,}2" },
    { kind: "text", value: " per meccanismi flessionali verticali (trave appoggiata);" },
];
kappa.text!.normalizationVersion = profile;
addTransformation(kappa, "Separato in matematica inline il label κ dell’elenco.");

const c871216 = units.get("c8.7.1.2.1.6.json")!;
for (const state of ["SLV", "SLC"]) {
    const candidates = c871216.blocks.filter((block) => block.text?.inline?.some((segment, index, all) => segment.kind === "math" && segment.value === state && all[index + 1]?.value.startsWith(":")));
    for (const block of candidates) styleStateLabel(block, state);
}
c871216.blocks[1]!.text!.inline = [
    { kind: "text", value: "La verifica a stato limite ultimo può essere eseguita con riferimento ad uno dei due stati limite (" },
    { kind: "math", value: "SLV", latex: "\\mathrm{SLV}" },
    { kind: "text", value: " o " },
    { kind: "math", value: "SLC", latex: "\\mathrm{SLC}" },
    { kind: "text", value: ") individuati sulla curva di capacità attraverso opportune soglie dello spostamento spettrale d. " },
    { kind: "math", value: "SLV", latex: "\\mathbf{SLV}" },
    { kind: "strong-em", value: ":" },
    { kind: "text", value: " lo spostamento d " },
    { kind: "math", value: "SLV", latex: "\\mathrm{SLV}" },
    { kind: "text", value: " corrisponde al minore tra gli spostamenti così definiti:" },
];
c871216.blocks[4]!.text!.inline = [
    { kind: "math", value: "SLC", latex: "\\mathbf{SLC}" },
    { kind: "strong-em", value: ":" },
    { kind: "text", value: " lo spostamento d " },
    { kind: "math", value: "SLC", latex: "\\mathrm{SLC}" },
    { kind: "text", value: " corrisponde al minore tra gli spostamenti così definiti:" },
];
c871216.blocks[1]!.text!.normalizationVersion = profile;
c871216.blocks[4]!.text!.normalizationVersion = profile;
addTransformation(c871216.blocks[1]!, "Resa in grassetto l’etichetta SLV: mantenendo il testo completo della voce.");
addTransformation(c871216.blocks[4]!, "Resa in grassetto l’etichetta SLC: mantenendo il testo completo della voce.");
for (const index of [2, 3, 5, 6]) {
    const block = c871216.blocks[index]!;
    block.listMarker = "dash";
    block.listLevel = 1;
    removeLeadingDash(block);
}

const c87131 = units.get("c8.7.1.3.1.json")!;
for (const state of ["SLC", "SLV", "SLD", "SLO"]) {
    const block = c87131.blocks.find((item) => item.text?.normalized.startsWith(`${state}:`));
    if (block) {
        if (block.text!.inline?.some((segment) => segment.kind === "math" && segment.value === state)) styleStateLabel(block, state);
        else {
            block.text!.inline = [{ kind: "strong-em", value: `${state}:` }, { kind: "text", value: block.text!.normalized.slice(state.length + 1) }];
            block.text!.normalizationVersion = profile;
            updateNormalizedHash(block);
            addTransformation(block, `Evidenziata in grassetto l’etichetta ${state}: dell’elenco.`);
        }
    }
}
for (const index of [14, 15, 18, 19]) {
    const block = c87131.blocks[index]!;
    block.listMarker = "dash";
    block.listLevel = 1;
    removeLeadingDash(block);
}

for (const unit of units.values()) {
    for (const block of unit.blocks) updateNormalizedHash(block);
}
for (const [file, unit] of units) await writeJson(join(unitsDir, file), unit);
console.log("fix-circ8-c87-step1-editorial: C8.7.1.2.1–C8.7.1.3.1 aggiornati");
