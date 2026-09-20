import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();
const unitsDir = join(root, "corpus", "units", "circ2019");
const assetsDir = join(root, "corpus", "assets", "circ2019");
const profile = "circ8-c87-step3-editorial-0.1.0";

type InlineKind = "text" | "math" | "em" | "underline" | "em-underline" | "strong" | "strong-em" | "strong-underline";
type Inline = { kind: InlineKind; value: string; latex?: string };
type Evidence = { transformations?: Array<{ operation: string; ruleVersion: string; note: string }>; rawSha256?: string; normalizedSha256?: string };
type Text = { raw?: string; normalized: string; inline?: Inline[]; normalizationVersion?: string };
type Block = {
    blockId: string;
    kind: string;
    text?: Text;
    evidence?: Evidence;
    listMarker?: "numbered" | "bullet" | "dash" | "none";
    listLevel?: number;
    indentLevel?: number;
    [key: string]: unknown;
};
type Unit = { blocks: Block[] };
type Cell = {
    text: string;
    colSpan?: number;
    rowSpan?: number;
    strong?: boolean;
    align?: "left" | "center" | "right";
    shade?: "gray";
    inline?: Inline[];
    [key: string]: unknown;
};
type Table = { officialNumber: string; columnCount: number; headers: Cell[][]; rows: Cell[][]; columnWidths?: number[]; notes: string[]; notesInline?: Inline[][]; [key: string]: unknown };
type AssetManifest = { tables: Table[]; [key: string]: unknown };

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

function updateHashes(block: Block): void {
    if (!block.text || !block.evidence) return;
    if (block.text.raw !== undefined) block.evidence.rawSha256 = createHash("sha256").update(block.text.raw, "utf8").digest("hex");
    block.evidence.normalizedSha256 = createHash("sha256").update(block.text.normalized, "utf8").digest("hex");
}

function setList(block: Block, marker: "dash" | "none", level: number, note: string): void {
    block.kind = "list-item";
    block.listMarker = marker;
    block.listLevel = level;
    if (block.text) block.text.normalizationVersion = profile;
    addTransformation(block, note);
}

function normalizeNumberedListItem(block: Block): void {
    if (!block.text || block.kind !== "list-item" || !/^\d+\.\s+/u.test(block.text.normalized)) return;
    setList(block, "none", 0, "Reso esplicito l’elenco numerato conservando il marcatore nel testo verificato sul PDF ufficiale.");
}

function restoreC8741NumberedStructure(unit: Unit): void {
    const numberedItems = new Map([
        ["block-003", "1."],
        ["block-004", "2."],
        ["block-005", "3."],
        ["block-006", "4."],
        ["block-007", "5."],
    ]);
    for (const block of unit.blocks) {
        const shortId = block.blockId.split("#").at(-1) ?? "";
        const prefix = numberedItems.get(shortId);
        if (!prefix || !block.text) continue;
        if (!block.text.normalized.startsWith(`${prefix} `)) {
            block.text.normalized = `${prefix} ${block.text.normalized.replace(/^\d+\.\s+/u, "")}`;
            block.text.raw = `${prefix} ${(block.text.raw ?? block.text.normalized).replace(/^\d+\.\s+/u, "")}`;
            block.text.inline = undefined;
            block.text.normalizationVersion = profile;
            updateHashes(block);
            addTransformation(block, "Ripristinato il marcatore numerico della voce secondo il PDF ufficiale.");
        }
        setList(block, "none", 0, "Reso esplicito l’elenco numerato conservando il marcatore nel testo verificato sul PDF ufficiale.");
    }

    const sectionHeadings = new Map([
        ["block-009", "1."],
        ["block-016", "2."],
        ["block-029", "3."],
        ["block-033", "4."],
        ["block-043", "5."],
        ["block-048", "6."],
    ]);
    for (const block of unit.blocks) {
        const shortId = block.blockId.split("#").at(-1) ?? "";
        const prefix = sectionHeadings.get(shortId);
        if (!prefix || !block.text) continue;
        block.kind = "heading";
        delete block.listMarker;
        delete block.listLevel;
        if (!block.text.normalized.startsWith(`${prefix} `)) {
            block.text.normalized = `${prefix} ${block.text.normalized.replace(/^\d+\.\s+/u, "")}`;
            block.text.raw = `${prefix} ${(block.text.raw ?? block.text.normalized).replace(/^\d+\.\s+/u, "")}`;
            block.text.inline = undefined;
            block.text.normalizationVersion = profile;
            updateHashes(block);
            addTransformation(block, "Ripristinato il numero del sottotitolo secondo il PDF ufficiale.");
        }
    }
}

function removeLeadingDash(block: Block): void {
    if (!block.text || !/^\s*[-–]\s*/u.test(block.text.normalized)) return;
    block.text.normalized = block.text.normalized.replace(/^\s*[-–]\s*/u, "");
    block.text.inline = block.text.inline?.map((segment, index) => index === 0 ? { ...segment, value: segment.value.replace(/^\s*[-–]\s*/u, "") } : segment);
    block.text.normalizationVersion = profile;
    updateHashes(block);
    addTransformation(block, "Separato il marcatore dell’elenco dal testo della voce.");
}

function styleOccurrences(block: Block, tokens: string[], kind: "em" | "strong-em"): void {
    if (!block.text) throw new Error("Blocco senza testo per l’enfasi");
    let segments = block.text.inline ?? [{ kind: "text" as const, value: block.text.normalized }];
    let changed = false;
    for (const token of [...tokens].sort((a, b) => b.length - a.length)) {
        const next: Inline[] = [];
        for (const segment of segments) {
            if (segment.kind !== "text" || !segment.value.includes(token)) {
                next.push(segment);
                continue;
            }
            let cursor = 0;
            while (true) {
                const at = segment.value.indexOf(token, cursor);
                if (at < 0) break;
                if (at > cursor) next.push({ kind: "text", value: segment.value.slice(cursor, at) });
                next.push({ kind, value: token });
                cursor = at + token.length;
                changed = true;
            }
            if (cursor < segment.value.length) next.push({ kind: "text", value: segment.value.slice(cursor) });
        }
        segments = next;
    }
    if (!changed) return;
    block.text.inline = segments;
    block.text.normalizationVersion = profile;
    addTransformation(block, `Applicata la resa in ${kind === "em" ? "corsivo" : "grassetto corsivo"} dei titoli verificata sul PDF ufficiale.`);
}

function demoteExactStrongEm(block: Block, token: string, keep = 0): void {
    if (!block.text?.inline) return;
    let seen = 0;
    let changed = false;
    block.text.inline = block.text.inline.map((segment) => {
        if (segment.kind !== "strong-em" || segment.value !== token) return segment;
        if (seen++ < keep) return segment;
        changed = true;
        return { kind: "text", value: segment.value };
    });
    if (!changed) return;
    block.text.normalizationVersion = profile;
    addTransformation(block, `Rimosso il grassetto corsivo dalla ricorrenza non evidenziata di «${token}», secondo il PDF ufficiale.`);
}

function rebuildMath(block: Block, replacements: Array<{ plain: string; value: string; latex: string }>, note: string): void {
    if (!block.text) throw new Error("Blocco senza testo per la matematica");
    const source = block.text.normalized;
    const pattern = new RegExp(replacements.map(({ plain }) => plain.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")).sort((a, b) => b.length - a.length).join("|"), "gu");
    const segments: Inline[] = [];
    let cursor = 0;
    for (const match of source.matchAll(pattern)) {
        const start = match.index ?? 0;
        const token = match[0]!;
        if (start > cursor) segments.push({ kind: "text", value: source.slice(cursor, start) });
        const replacement = replacements.find((item) => item.plain === token);
        if (!replacement) throw new Error(`Token matematico non riconosciuto: ${token}`);
        segments.push({ kind: "math", value: replacement.value, latex: replacement.latex });
        cursor = start + token.length;
    }
    if (cursor < source.length) segments.push({ kind: "text", value: source.slice(cursor) });
    block.text.inline = segments;
    block.text.normalizationVersion = profile;
    addTransformation(block, note);
}

function cloneListBlock(source: Block, suffix: string, normalized: string, marker: "dash" | "none", level: number): Block {
    const clone = JSON.parse(JSON.stringify(source)) as Block;
    clone.blockId = `${source.blockId}-${suffix}`;
    clone.kind = "list-item";
    clone.listMarker = marker;
    clone.listLevel = level;
    clone.text = { raw: normalized, normalized, normalizationVersion: profile };
    updateHashes(clone);
    addTransformation(clone, "Esplicitata la voce dell’elenco secondo la struttura verificata sul PDF ufficiale.");
    return clone;
}

function splitDashSeparated(unit: Unit, index: number, note: string): void {
    const original = unit.blocks[index];
    if (!original?.text) throw new Error(`Blocco ${index} privo di testo`);
    const source = original.text.normalized;
    const firstDash = source.indexOf(" - ");
    if (firstDash < 0) return;
    const intro = source.slice(0, firstDash).trimEnd();
    const items = source.slice(firstDash + 3).split(/\s+-\s+/u).map((value) => value.trim()).filter(Boolean);
    if (items.length < 1) throw new Error(`Elenco dash non riconosciuto: ${source}`);
    original.text.normalized = intro;
    original.text.raw = intro;
    original.text.inline = undefined;
    original.text.normalizationVersion = profile;
    updateHashes(original);
    addTransformation(original, note);
    const clones = items.map((item, itemIndex) => cloneListBlock(original, `item-${itemIndex + 1}`, item, "dash", 0));
    unit.blocks.splice(index, 1, original, ...clones);
}

function splitAtMarker(unit: Unit, index: number, marker: string, markerType: "dash" | "none", note: string, itemKind: "list-item" | "paragraph" = "list-item"): void {
    const original = unit.blocks[index];
    if (!original?.text) throw new Error(`Blocco ${index} privo di testo`);
    const at = original.text.normalized.indexOf(marker);
    if (at < 0) return;
    const intro = original.text.normalized.slice(0, at).trimEnd();
    const item = original.text.normalized.slice(at).trim();
    if (!intro || !item) throw new Error(`Suddivisione non riconosciuta: ${original.text.normalized}`);
    original.text.normalized = intro;
    original.text.raw = intro;
    original.text.inline = undefined;
    original.text.normalizationVersion = profile;
    updateHashes(original);
    addTransformation(original, note);
    const clone = cloneListBlock(original, "item-1", item, markerType, 0);
    clone.kind = itemKind;
    if (itemKind === "paragraph") {
        delete clone.listMarker;
        delete clone.listLevel;
    }
    unit.blocks.splice(index, 1, original, clone);
}

function splitSecondAlphabeticItem(unit: Unit, index: number): void {
    const original = unit.blocks[index];
    if (!original?.text) throw new Error("Voce alfabetica priva di testo");
    const at = original.text.normalized.indexOf(" b) ");
    if (at < 0) return;
    const first = original.text.normalized.slice(0, at).trimEnd();
    const second = original.text.normalized.slice(at + 1).trim();
    original.text.normalized = first;
    original.text.raw = first;
    original.text.inline = undefined;
    original.text.normalizationVersion = profile;
    updateHashes(original);
    addTransformation(original, "Separata la voce b) dalla voce a) dell’elenco dopo la formula C8.7.4.8.");
    const clone = cloneListBlock(original, "b", second, "none", 0);
    unit.blocks.splice(index, 1, original, clone);
}

function prependText(block: Block, prefix: string, note: string): void {
    if (!block.text || block.text.normalized.startsWith(prefix)) return;
    block.text.normalized = `${prefix}${block.text.normalized}`;
    block.text.raw = `${prefix}${block.text.raw ?? ""}`;
    block.text.inline = undefined;
    block.text.normalizationVersion = profile;
    updateHashes(block);
    addTransformation(block, note);
}

function mergeWithNext(unit: Unit, index: number, note: string): void {
    const first = unit.blocks[index];
    const second = unit.blocks[index + 1];
    if (!first?.text || !second?.text) throw new Error("Capoversi da unire privi di testo");
    if (first.text.normalized.endsWith(second.text.normalized)) return;
    first.text.normalized = `${first.text.normalized.trimEnd()} ${second.text.normalized.trimStart()}`;
    first.text.raw = `${first.text.raw ?? first.text.normalized} ${second.text.raw ?? second.text.normalized}`;
    first.text.inline = undefined;
    first.text.normalizationVersion = profile;
    updateHashes(first);
    addTransformation(first, note);
    unit.blocks.splice(index + 1, 1);
}

function noteMathMarker(value: string, text: string): Inline[] {
    return [{ kind: "math", value, latex: `{ }^{${value}}` }, { kind: "text", value: text }];
}

const c87242 = await readJson<Unit>(join(unitsDir, "c8.7.2.4.2.json"));
const deformation = c87242.blocks.find((block) => block.text?.normalized.includes("{y") || block.text?.normalized.includes("θ_y"));
if (!deformation?.text) throw new Error("Simboli della rotazione theta_y non trovati in C8.7.2.4.2");
if (deformation.text.normalized.includes("{y")) {
    deformation.text.normalized = deformation.text.normalized.replaceAll("{y", "θ_y");
    deformation.text.raw = deformation.text.raw?.replaceAll("{y", "θ_y");
}
if (!deformation.text.inline?.some((segment) => segment.kind === "math" && segment.latex === "\\theta_y")) {
    rebuildMath(deformation, [{ plain: "θ_y", value: "θ_y", latex: "\\theta_y" }], "Ripristinato il simbolo θ_y in matematica inline secondo il PDF ufficiale.");
}
if (!deformation.text.inline?.some((segment) => segment.kind === "em" && segment.value === "member deformation capacities")) styleOccurrences(deformation, ["member deformation capacities"], "em");
updateHashes(deformation);
await writeJson(join(unitsDir, "c8.7.2.4.2.json"), c87242);

const c873 = await readJson<Unit>(join(unitsDir, "c8.7.3.json"));
const verificaIndex = c873.blocks.findIndex((block) => block.text?.normalized.startsWith("La verifica deve"));
if (verificaIndex > 0) mergeWithNext(c873, verificaIndex - 1, "Ricostruito il capoverso continuo verificato sul PDF ufficiale.");
await writeJson(join(unitsDir, "c8.7.3.json"), c873);

const c8741 = await readJson<Unit>(join(unitsDir, "c8.7.4.1.json"));
restoreC8741NumberedStructure(c8741);
for (const block of c8741.blocks) {
    normalizeNumberedListItem(block);
    for (const token of [
        "collegamento dei diaframmi di piano", "cordoli in sommità", "diatoni artificiali", "tirantini antiespulsivi",
        "iniezioni di miscele leganti", "ristilatura dei giunti", "intonaco armato", "fasciature resistenti a trazione",
        "tiranti verticali post-tesi", "nuove aperture", "tiranti", "cerchiature", "contrafforti", "ringrossi murari",
    ]) styleOccurrences(block, [token], "strong-em");
    if (block.kind === "list-item" && /^\s*-/u.test(block.text?.normalized ?? "")) {
        setList(block, "dash", 0, "Resa esplicita la voce puntata degli interventi verificata sul PDF ufficiale.");
        removeLeadingDash(block);
    }
}
for (const index of [24, 25, 26, 27]) {
    const block = c8741.blocks[index];
    if (!block?.text) throw new Error(`Voce dei cordoli non trovata alla posizione ${index}`);
    styleOccurrences(block, [block.text.normalized], "strong-em");
}
const diaphragmsIntro = c8741.blocks.find((block) => block.text?.normalized.startsWith("Per quanto riguarda le coperture"));
if (diaphragmsIntro) styleOccurrences(diaphragmsIntro, ["coperture"], "strong-em");
const wallConnections = c8741.blocks.find((block) => block.text?.normalized.startsWith("Qualora i collegamenti tra le pareti"));
if (wallConnections) styleOccurrences(wallConnections, ["idonea ammorsatura", "Cuciture armate"], "strong-em");
const tieParagraph = c8741.blocks.find((block) => block.text?.normalized.startsWith("Particolarmente efficaci sono gli elementi di collegamento"));
if (tieParagraph) styleOccurrences(tieParagraph, ["catene"], "strong-em");
const cordoliIntro = c8741.blocks.find((block) => block.text?.normalized === "I cordoli in sommità possono essere realizzati nei seguenti modi.");
if (cordoliIntro) demoteExactStrongEm(cordoliIntro, "cordoli in sommità");
const sectionFive = c8741.blocks.find((block) => block.text?.normalized.startsWith("L’assorbimento delle spinte di strutture voltate"));
if (sectionFive) {
    demoteExactStrongEm(sectionFive, "tiranti", 1);
    demoteExactStrongEm(sectionFive, "catene");
}
const columnsIntervention = c8741.blocks.find((block) => block.text?.normalized.startsWith("migliorare la resistenza a sforzo normale"));
if (columnsIntervention) demoteExactStrongEm(columnsIntervention, "cerchiature");
const foundationFixes: Array<[string, string]> = [
    ["Allargamento della fondazione mediante cordoli o platee in c.a.", "L’intervento va realizzato in modo tale da far collaborare "],
    ["Consolidamento dei terreni di fondazione.", "Gli interventi di consolidamento dei terreni possono essere effettuati mediante "],
    ["Inserimento di sottofondazioni profonde (micropali, pali radice).", "Nel caso di cedimenti che interessino singole porzioni di "],
];
for (const [heading, prefix] of foundationFixes) {
    const headingIndex = c8741.blocks.findIndex((block) => block.kind === "heading" && block.text?.normalized === heading);
    if (headingIndex < 0) throw new Error(`Titolo fondale non trovato: ${heading}`);
    const paragraph = c8741.blocks[headingIndex + 1];
    if (!paragraph) throw new Error(`Paragrafo fondale mancante dopo ${heading}`);
    prependText(paragraph, prefix, `Reintegrata la prima riga del paragrafo dopo ${heading}, verificata sul PDF ufficiale.`);
}
await writeJson(join(unitsDir, "c8.7.4.1.json"), c8741);

const c87421 = await readJson<Unit>(join(unitsDir, "c8.7.4.2.1.json"));
const objectiveC87421 = c87421.blocks.findIndex((block) => block.text?.normalized.includes("tutti o alcuni dei seguenti obiettivi: -"));
if (objectiveC87421 >= 0) splitDashSeparated(c87421, objectiveC87421, "Esplicitata la lista degli obiettivi dell’incamiciatura in c.a.");
for (const block of c87421.blocks) {
    if (block.kind === "paragraph" && /^\s*-/u.test(block.text?.normalized ?? "")) {
        setList(block, "dash", 0, "Resa esplicita la lista delle ipotesi semplificative verificata sul PDF ufficiale.");
        removeLeadingDash(block);
    }
}
for (const block of c87421.blocks) {
    if (block.kind === "list-item" && /^\s*-/u.test(block.text?.normalized ?? "")) {
        setList(block, "dash", 0, "Resa esplicita la voce puntata verificata sul PDF ufficiale.");
        removeLeadingDash(block);
    }
    if (block.text?.normalized.startsWith("capacità in termini di")) setList(block, "dash", 0, "Reso esplicito l’elenco delle capacità secondo il PDF ufficiale.");
    if (block.kind === "formula-ref") {
        block.indentLevel = 1;
        addTransformation(block, "Allineata la formula alla voce dell’elenco che la introduce.");
    }
    if (block.kind === "list-item" && /^(?:a|b|c|d)\)/u.test(block.text?.normalized ?? "")) setList(block, "none", 0, "Resa esplicita la lista alfabetica delle resistenze dei materiali.");
}
const capacityIndex = c87421.blocks.findIndex((block) => block.text?.normalized.includes("espressioni seguenti: - capacità"));
if (capacityIndex >= 0) splitDashSeparated(c87421, capacityIndex, "Separata l’introduzione dall’elenco delle capacità e delle formule.");
await writeJson(join(unitsDir, "c8.7.4.2.1.json"), c87421);

const c87422 = await readJson<Unit>(join(unitsDir, "c8.7.4.2.2.json"));
const objectiveIndex = c87422.blocks.findIndex((block) => block.text?.normalized.includes("tutti o alcuni dei seguenti obiettivi: -"));
if (objectiveIndex >= 0) splitDashSeparated(c87422, objectiveIndex, "Esplicitata la lista degli obiettivi dell’incamiciatura in acciaio.");
const propertiesIndex = c87422.blocks.findIndex((block) => block.text?.normalized.includes("Per le proprietà del calcestruzzo confinato") && !block.text.normalized.startsWith("Per le proprietà del calcestruzzo confinato"));
if (propertiesIndex >= 0) splitAtMarker(c87422, propertiesIndex, "Per le proprietà del calcestruzzo confinato", "none", "Inserito il capoverso dedicato alle proprietà del calcestruzzo confinato.", "paragraph");
const resistanceIndex = c87422.blocks.findIndex((block) => block.text?.normalized.includes("seguenti: per la resistenza del calcestruzzo confinato:"));
if (resistanceIndex >= 0) splitAtMarker(c87422, resistanceIndex, "per la resistenza del calcestruzzo confinato:", "none", "Separato il capoverso della resistenza del calcestruzzo confinato.", "paragraph");
const materialIndex = c87422.blocks.findIndex((block) => block.text?.normalized.startsWith("Nelle due equazioni precedenti"));
if (materialIndex >= 0 && c87422.blocks[materialIndex]!.text!.normalized.includes(" sono: a)")) splitAtMarker(c87422, materialIndex, "a)", "none", "Separata l’introduzione dall’elenco alfabetico dopo la formula C8.7.4.8.");
const materialItemIndex = c87422.blocks.findIndex((block) => block.text?.normalized.startsWith("a) per il calcestruzzo") && block.text.normalized.includes(" b) "));
if (materialItemIndex >= 0) splitSecondAlphabeticItem(c87422, materialItemIndex);
const tighteningIndex = c87422.blocks.findIndex((block) => block.text?.normalized.includes("Per ottenere questo risultato occorre che: -"));
if (tighteningIndex >= 0) splitDashSeparated(c87422, tighteningIndex, "Esplicitato l’elenco delle condizioni di serraggio della camicia.");
for (const block of c87422.blocks) {
    if (block.kind === "list-item" && /^\s*-/u.test(block.text?.normalized ?? "")) {
        setList(block, "dash", 0, "Resa esplicita la voce puntata verificata sul PDF ufficiale.");
        removeLeadingDash(block);
    }
    if (block.text?.normalized.startsWith("per la deformazione ultima del calcestruzzo confinato:")) {
        setList(block, "dash", 0, "Resa esplicita la voce dell’elenco puntato, mantenendo il testo in grassetto tondo.");
        block.text.inline = [{ kind: "strong", value: block.text.normalized }];
        block.text.normalizationVersion = profile;
        addTransformation(block, "Rimosso il corsivo dalla voce dell’elenco puntato, mantenendo il grassetto verificato sul PDF ufficiale.");
    }
    if (/^(?:a|b)\)/u.test(block.text?.normalized ?? "")) setList(block, "none", 0, "Resa esplicita la lista alfabetica dei materiali dopo la formula C8.7.4.8.");
}
const confinementBase = c87422.blocks.find((block) => block.text?.normalized.startsWith("L’effetto di confinamento di una camicia di acciaio"));
const propertiesBlock = c87422.blocks.find((block) => block.text?.normalized.startsWith("Per le proprietà del calcestruzzo confinato"));
const resistanceBlock = c87422.blocks.find((block) => block.text?.normalized.startsWith("per la resistenza del calcestruzzo confinato"));
if (confinementBase && propertiesBlock && resistanceBlock) {
    propertiesBlock.kind = "paragraph";
    delete propertiesBlock.listMarker;
    delete propertiesBlock.listLevel;
    resistanceBlock.kind = "paragraph";
    delete resistanceBlock.listMarker;
    delete resistanceBlock.listLevel;
    propertiesBlock.blockId = `${confinementBase.blockId}-properties`;
    resistanceBlock.blockId = `${confinementBase.blockId}-resistance`;
}
await writeJson(join(unitsDir, "c8.7.4.2.2.json"), c87422);

const assetPath = join(assetsDir, "C8.7-step3b.json");
const assets = await readJson<AssetManifest>(assetPath);
const table1 = assets.tables.find((table) => table.officialNumber === "C8.7.6.3.I");
const table2 = assets.tables.find((table) => table.officialNumber === "C8.7.6.3.II");
if (!table1 || !table2) throw new Error("Tabelle C8.7.6.3 non trovate");
table1.columnWidths = [23, 12, 9, 15, 5, 5, 5, 5, 5, 5, 5, 5];
const firstHeader = table1.headers[0] ?? [];
table1.headers = [firstHeader.map((cell) => {
    const next = { ...cell, align: "center" as const, strong: true };
    delete next.shade;
    delete next.rowSpan;
    return next;
})];
table1.rows = table1.rows.map((row) => {
    if (row.length === 1 && row[0]?.colSpan === 12) return [{ ...row[0], align: "center", shade: "gray", strong: true }];
    return row.map((cell, index) => ({ ...cell, align: index === 0 ? "left" as const : "center" as const }));
});
table1.notes = [
    "⁵La vulnerabilità è quella assunta per alta sismicità.",
    "⁶Le raccomandazioni si basano sulle osservazioni dei danni dei terremoti passati e sull'ipotesi di vulnerabilità, importanza e costi di adeguamento per sistemi tipici.",
    "⁷La colonna ‘Ancoraggi se nuovi nelle zone’ riguarda i componenti o i sistemi di nuova installazione in edifici sia nuovi che esistenti.",
    "⁸Per i componenti fissati sul pavimento o sul tetto il rapporto di ribaltamento è pari a h_c / x_min, dove h_c è l'altezza del baricentro del componente sopra la sua base, e x_min è la distanza orizzontale più breve dal baricentro al bordo della base del componente.",
];
table1.notesInline = [
    noteMathMarker("5", "La vulnerabilità è quella assunta per alta sismicità."),
    noteMathMarker("6", "Le raccomandazioni si basano sulle osservazioni dei danni dei terremoti passati e sull'ipotesi di vulnerabilità, importanza e costi di adeguamento per sistemi tipici."),
    noteMathMarker("7", "La colonna ‘Ancoraggi se nuovi nelle zone’ riguarda i componenti o i sistemi di nuova installazione in edifici sia nuovi che esistenti."),
    [
        ...noteMathMarker("8", "Per i componenti fissati sul pavimento o sul tetto il rapporto di ribaltamento è pari a "),
        { kind: "math", value: "h_c / x_{\\min}", latex: "\\frac{h_c}{x_{\\min}}" },
        { kind: "text", value: ", dove " },
        { kind: "math", value: "h_c", latex: "h_c" },
        { kind: "text", value: " è l'altezza del baricentro del componente sopra la sua base, e " },
        { kind: "math", value: "x_{\\min}", latex: "x_{\\min}" },
        { kind: "text", value: " è la distanza orizzontale più breve dal baricentro al bordo della base del componente." },
    ],
];
table2.columnWidths = [14, 14.5, 14.5, 14.5, 14.5, 14, 14];
table2.headers = table2.headers.map((row) => row.map((cell) => {
    const next = { ...cell, align: "center" as const, strong: true };
    delete next.shade;
    return next;
}));
table2.rows = table2.rows.map((row) => row.map((cell) => ({ ...cell, align: "center" as const })));
await writeJson(assetPath, assets);

console.log("fix-circ8-c87-step3-editorial: C8.7.2.4.2–C8.7.6.3 aggiornati");
