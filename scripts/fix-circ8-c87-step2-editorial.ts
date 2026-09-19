import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();
const unitsDir = join(root, "corpus", "units", "circ2019");
const profile = "circ8-c87-step2-editorial-0.1.0";

type InlineKind = "text" | "math" | "em" | "underline" | "em-underline" | "strong" | "strong-em" | "strong-underline";
type Inline = { kind: InlineKind; value: string; latex?: string };
type Evidence = {
    transformations?: Array<{ operation: string; ruleVersion: string; note: string }>;
    rawSha256?: string;
    normalizedSha256?: string;
};
type Text = { raw?: string; normalized: string; inline?: Inline[]; normalizationVersion?: string };
type Block = {
    blockId: string;
    kind: string;
    origin?: string;
    text?: Text;
    evidence?: Evidence;
    assetId?: string;
    listMarker?: "numbered" | "bullet" | "dash" | "none";
    listLevel?: number;
    indentLevel?: number;
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

function updateRawHash(block: Block): void {
    if (!block.text?.raw || !block.evidence) return;
    block.evidence.rawSha256 = createHash("sha256").update(block.text.raw, "utf8").digest("hex");
}

function setList(block: Block, marker: "dash" | "none", level: number, note: string): void {
    block.kind = "list-item";
    block.listMarker = marker;
    block.listLevel = level;
    if (block.text) block.text.normalizationVersion = profile;
    addTransformation(block, note);
}

function removeLeadingDash(block: Block): void {
    if (!block.text || !/^\s*[-–]\s*/u.test(block.text.normalized)) return;
    block.text.normalized = block.text.normalized.replace(/^\s*[-–]\s*/u, "");
    block.text.inline = block.text.inline?.map((segment, index) => index === 0 ? { ...segment, value: segment.value.replace(/^\s*[-–]\s*/u, "") } : segment);
    block.text.normalizationVersion = profile;
    updateNormalizedHash(block);
    addTransformation(block, "Separato il marcatore dell’elenco dal testo della voce.");
}

function stylePlainPrefix(block: Block, prefix: string, kind: "strong" | "strong-underline"): void {
    if (!block.text) throw new Error(`Blocco senza testo per ${prefix}`);
    const text = block.text.normalized;
    const at = text.indexOf(prefix);
    if (at < 0) throw new Error(`Prefisso non trovato: ${prefix}`);
    if (block.text.inline?.some((segment) => segment.kind === "math")) {
        throw new Error(`Prefisso con matematica inline non gestito: ${prefix}`);
    }
    block.text.inline = [
        ...(at > 0 ? [{ kind: "text" as const, value: text.slice(0, at) }] : []),
        { kind, value: prefix },
        ...(at + prefix.length < text.length ? [{ kind: "text" as const, value: text.slice(at + prefix.length) }] : []),
    ];
    block.text.normalizationVersion = profile;
    addTransformation(block, `Reso ${prefix} in ${kind === "strong-underline" ? "grassetto sottolineato" : "grassetto"} secondo il PDF ufficiale.`);
}

function setMathTokens(block: Block, replacements: Array<{ plain: string; value: string; latex: string }>, note: string): void {
    if (!block.text) throw new Error("Blocco senza testo per la matematica");
    if (block.text.inline?.some((segment) => segment.kind === "math")) return;
    const source = block.text.normalized;
    const pattern = new RegExp(replacements.map(({ plain }) => plain.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")).join("|"), "gu");
    const inline: Inline[] = [];
    let cursor = 0;
    for (const match of source.matchAll(pattern)) {
        const start = match.index ?? 0;
        const token = match[0]!;
        if (start > cursor) inline.push({ kind: "text", value: source.slice(cursor, start) });
        const replacement = replacements.find((item) => item.plain === token);
        if (!replacement) throw new Error(`Token matematico non riconosciuto: ${token}`);
        inline.push({ kind: "math", value: replacement.value, latex: replacement.latex });
        cursor = start + token.length;
    }
    if (cursor < source.length) inline.push({ kind: "text", value: source.slice(cursor) });
    if (inline.length === 0) throw new Error(`Nessun token matematico trovato in ${source}`);
    block.text.inline = inline;
    block.text.normalizationVersion = profile;
    addTransformation(block, note);
}

function styleOccurrences(block: Block, token: string): void {
    if (!block.text) throw new Error(`Blocco senza testo per ${token}`);
    const source = block.text.inline ?? [{ kind: "text" as const, value: block.text.normalized }];
    const result: Inline[] = [];
    let changed = false;
    for (const segment of source) {
        if (segment.kind !== "text" || !segment.value.includes(token)) {
            result.push(segment);
            continue;
        }
        let cursor = 0;
        while (true) {
            const at = segment.value.indexOf(token, cursor);
            if (at < 0) break;
            if (at > cursor) result.push({ kind: "text", value: segment.value.slice(cursor, at) });
            result.push({ kind: "strong", value: token });
            cursor = at + token.length;
            changed = true;
        }
        if (cursor < segment.value.length) result.push({ kind: "text", value: segment.value.slice(cursor) });
    }
    if (!changed) return;
    block.text.inline = result;
    block.text.normalizationVersion = profile;
    addTransformation(block, `Evidenziata in grassetto la sigla ${token} in tutte le occorrenze.`);
}

function setTrailingQ(block: Block): void {
    if (!block.text) throw new Error("Titolo senza testo per q");
    const text = block.text.normalized;
    const match = /^(.*?)(?:\s+)q$/u.exec(text);
    if (!match) throw new Error(`q finale non trovato: ${text}`);
    block.text.inline = [
        { kind: "text", value: `${match[1]} ` },
        { kind: "math", value: "q", latex: "q" },
    ];
    block.text.normalizationVersion = profile;
    addTransformation(block, "Reso in matematica inline il fattore di comportamento q nel titolo.");
}

function cloneBlock(block: Block, suffix: string, normalized: string, marker: "none" | "dash", level: number): Block {
    const clone = JSON.parse(JSON.stringify(block)) as Block;
    clone.blockId = `${block.blockId}-${suffix}`;
    clone.kind = "list-item";
    clone.listMarker = marker;
    clone.listLevel = level;
    clone.text = { ...(block.text ?? {}), raw: normalized, normalized, inline: undefined, normalizationVersion: profile };
    updateRawHash(clone);
    updateNormalizedHash(clone);
    return clone;
}

function splitConfidentFactors(unit: Unit): void {
    const index = unit.blocks.findIndex((block) => block.blockId.endsWith("#block-002"));
    if (index < 0) throw new Error("Blocco dei fattori di confidenza non trovato");
    if (unit.blocks.some((block) => block.blockId.endsWith("#block-002-a"))) {
        for (const suffix of ["a", "b"]) {
            const existing = unit.blocks.find((block) => block.blockId.endsWith(`#block-002-${suffix}`));
            if (existing?.text) {
                existing.text.raw = existing.text.normalized;
                updateRawHash(existing);
            }
        }
        return;
    }
    const original = unit.blocks[index]!;
    if (!original.text) throw new Error("Blocco dei fattori senza testo");
    const text = original.text.normalized;
    const aAt = text.indexOf(" a. ");
    const bAt = text.indexOf(" b. ");
    if (aAt < 0 || bAt < 0 || bAt <= aAt) throw new Error(`Elenco a/b non trovato: ${text}`);
    const intro = text.slice(0, aAt).trimEnd();
    const a = text.slice(aAt + 1, bAt).trim();
    const b = text.slice(bAt + 1).trim();
    original.text.normalized = intro;
    original.text.inline = undefined;
    original.text.normalizationVersion = profile;
    addTransformation(original, "Separata l’introduzione dall’elenco a/b verificato sul PDF ufficiale.");
    const aBlock = cloneBlock(original, "a", a, "none", 0);
    const bBlock = cloneBlock(original, "b", b, "none", 0);
    addTransformation(aBlock, "Esplicitata la voce a. dell’elenco con descrizione allineata.");
    addTransformation(bBlock, "Esplicitata la voce b. dell’elenco con descrizione allineata.");
    updateNormalizedHash(original);
    unit.blocks.splice(index, 1, original, aBlock, bBlock);
}

function splitPointDE(unit: Unit): void {
    const dIndex = unit.blocks.findIndex((block) => block.text?.normalized.startsWith("d. tutti gli elementi"));
    if (dIndex < 0) throw new Error("Punto d dell’elenco non trovato");
    const d = unit.blocks[dIndex]!;
    const next = unit.blocks[dIndex + 1]!;
    if (!d.text || !next.text) throw new Error("Punto d/e privo di testo");
    if (d.text.normalized.includes("cornicioni ecc.") && next.text.normalized.startsWith("e.")) return;
    const continuation = next.text.normalized;
    const eAt = continuation.indexOf("e. ");
    if (eAt < 0) throw new Error(`Continuazione e non trovata: ${continuation}`);
    d.text.normalized = `${d.text.normalized.trimEnd()} ${continuation.slice(0, eAt).trim()}`;
    d.text.inline = undefined;
    d.text.normalizationVersion = profile;
    next.text.normalized = continuation.slice(eAt).trim();
    next.text.inline = undefined;
    next.text.normalizationVersion = profile;
    d.listMarker = "none";
    d.listLevel = 0;
    next.listMarker = "none";
    next.listLevel = 0;
    updateNormalizedHash(d);
    updateNormalizedHash(next);
    addTransformation(d, "Ricostruita la continuità tipografica del punto d. attraverso il cambio pagina.");
    addTransformation(next, "Separata la voce e. dalla continuazione del punto d. secondo il PDF ufficiale.");
}

const files = [
    "c8.7.1.3.1.1.json",
    "c8.7.1.3.2.json",
    "c8.7.1.3.3.json",
    "c8.7.2.2.json",
    "c8.7.2.2.1.json",
    "c8.7.2.2.2.json",
    "c8.7.2.2.3.json",
    "c8.7.2.3.2.json",
    "c8.7.2.3.5.json",
];
const units = new Map<string, Unit>();
for (const file of files) units.set(file, await readJson<Unit>(join(unitsDir, file)));

const c871311 = units.get("c8.7.1.3.1.1.json")!;
for (const [prefix, kind] of [
    ["Nei maschi murari", "strong-underline"],
    ["Nelle fasce di piano", "strong"],
    ["Per le valutazioni relative alla pressoflessione", "strong-underline"],
    ["Per le valutazioni relative al taglio", "strong"],
    ["Nel caso di muratura irregolare", "strong"],
    ["Nel caso di muratura regolare", "strong"],
] as const) {
    const block = c871311.blocks.find((item) => item.text?.normalized.startsWith(prefix));
    if (!block) throw new Error(`Titolo interno non trovato: ${prefix}`);
    if (!block.text?.inline?.some((segment) => segment.kind === kind && segment.value === prefix)) {
        stylePlainPrefix(block, prefix, kind);
    }
}
for (const block of c871311.blocks) {
    if (block.kind === "list-item") {
        setList(block, "dash", 0, "Resa esplicita la voce dell’elenco puntato con il rientro della fonte.");
        removeLeadingDash(block);
    }
}

const c871312 = units.get("c8.7.1.3.2.json")!;
for (const block of c871312.blocks) styleOccurrences(block, "US");
for (const block of c871312.blocks) {
    if (block.kind === "list-item") {
        setList(block, "dash", 0, "Resa esplicita la voce dell’elenco puntato con il rientro della fonte.");
        removeLeadingDash(block);
    }
}

const c871313 = units.get("c8.7.1.3.3.json")!;
setMathTokens(c871313.blocks[1]!, [
    { plain: "fk", value: "fk", latex: "f_k" },
    { plain: "fm", value: "fm", latex: "f_m" },
], "Resi in matematica inline i simboli f_k e f_m del testo introduttivo.");
if (c871313.blocks[1]!.text?.inline) {
    c871313.blocks[1]!.text!.inline = c871313.blocks[1]!.text!.inline.map((segment) => {
        if (segment.kind !== "math") return segment;
        if (segment.latex === "f_k") return { ...segment, value: "fk" };
        if (segment.latex === "f_m") return { ...segment, value: "fm" };
        return segment;
    });
    c871313.blocks[1]!.text!.normalizationVersion = profile;
}
splitPointDE(c871313);
for (const block of c871313.blocks.slice(2, 8)) {
    if (block.kind === "list-item") setList(block, "none", 0, "Resa esplicita la sequenza alfabetica dell’elenco verificato sul PDF ufficiale.");
}

const c8722 = units.get("c8.7.2.2.json")!;
splitConfidentFactors(c8722);
for (const block of c8722.blocks) {
    if (block.kind === "list-item" && block.text?.normalized.startsWith("-")) {
        setList(block, "dash", 0, "Resa esplicita la voce dash dell’elenco verificato sul PDF ufficiale.");
        removeLeadingDash(block);
    }
}

const c87221 = units.get("c8.7.2.2.1.json")!;
const qHeading = c87221.blocks.find((block) => block.kind === "heading" && block.text?.normalized.endsWith(" q"));
if (!qHeading) throw new Error("Titolo con q non trovato in C8.7.2.2.1");
if (!qHeading.text?.inline?.some((segment) => segment.kind === "math" && segment.value === "q")) setTrailingQ(qHeading);

const c87222 = units.get("c8.7.2.2.2.json")!;
const qHeading2 = c87222.blocks.find((block) => block.kind === "heading" && block.text?.normalized.endsWith(" q"));
if (!qHeading2) throw new Error("Titolo con q non trovato in C8.7.2.2.2");
if (!qHeading2.text?.inline?.some((segment) => segment.kind === "math" && segment.value === "q")) setTrailingQ(qHeading2);

const c87223 = units.get("c8.7.2.2.3.json")!;
for (const index of [4, 5]) {
    const block = c87223.blocks[index]!;
    setList(block, "dash", 0, "Resa esplicita la voce principale dell’elenco con il rientro della fonte.");
    removeLeadingDash(block);
}
for (const index of [6, 7, 8, 9]) {
    setList(c87223.blocks[index]!, "none", 1, "Reso esplicito l’elenco alfabetico annidato sotto la voce principale.");
}

const c87232 = units.get("c8.7.2.3.2.json")!;
for (const index of [4, 5, 6, 7, 8, 9, 10, 11, 12]) {
    setList(c87232.blocks[index]!, "none", 0, "Reso esplicito l’elenco labeled delle definizioni dopo la formula.");
}
const phiBlock = c87232.blocks[26]!;
if (phiBlock.text?.inline) {
    phiBlock.text.inline = phiBlock.text.inline.map((segment) => segment.kind === "math" && segment.value === "φ_u" ? { ...segment, latex: "\\phi_u" } : segment);
    phiBlock.text.normalizationVersion = profile;
    addTransformation(phiBlock, "Corretto il simbolo φ_u in LaTeX come phi, verificato sul PDF ufficiale.");
}

const c87235 = units.get("c8.7.2.3.5.json")!;
for (const index of [6, 7, 8, 9, 10, 11, 12, 13]) {
    setList(c87235.blocks[index]!, "none", 0, "Reso esplicito l’elenco labeled delle definizioni della formula [C8.7.2.8].");
}
setList(c87235.blocks[14]!, "none", 0, "Reso esplicita la voce introduttiva che contiene l’elenco annidato delle formule di V_W.");
for (const index of [15, 18]) {
    const block = c87235.blocks[index]!;
    setList(block, "dash", 1, "Annidata la voce di sezione sotto V_W secondo il PDF ufficiale.");
    removeLeadingDash(block);
}
for (const index of [16, 17, 19]) {
    if (c87235.blocks[index]!.kind === "formula-ref") {
        c87235.blocks[index]!.indentLevel = 2;
        delete c87235.blocks[index]!.listLevel;
    } else c87235.blocks[index]!.listLevel = 2;
    addTransformation(c87235.blocks[index]!, "Allineato il blocco della formula e della relativa descrizione al livello dell’elenco annidato.");
}

for (const unit of units.values()) {
    for (const block of unit.blocks) updateNormalizedHash(block);
}
for (const [file, unit] of units) await writeJson(join(unitsDir, file), unit);
console.log("fix-circ8-c87-step2-editorial: C8.7.1.3.1.1–C8.7.2.3.5 aggiornati");
