import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();
const unitsDir = join(root, "corpus", "units", "circ2019");
const assetsPath = join(root, "corpus", "assets", "circ2019", "C8.5-step1.json");
const profile = "circ8-c85-step1-editorial-0.1.0";

type InlineKind = "text" | "math" | "em" | "underline" | "strong-em" | "strong";
type Inline = { kind: InlineKind; value: string; latex?: string };
type Evidence = { transformations?: Array<{ operation: string; ruleVersion: string; note: string }> };
type Text = { normalized: string; inline?: Inline[]; paragraphs?: Array<{ normalized: string; inline?: Inline[]; listMarker?: string; listLevel?: number }>; normalizationVersion?: string };
type Block = { kind: string; text?: Text; evidence?: Evidence };
type Unit = { blocks: Block[] };
type Cell = { text: string; latex?: string; rowSpan?: number; colSpan?: number; align?: "left" | "center" | "right"; strong?: boolean; noWrap?: boolean; verticalText?: boolean };
type Table = { officialNumber: string; columnCount: number; columnWidths?: number[]; headers: Cell[][]; rows: Cell[][]; notes: string[]; notesInline?: Inline[][] };
type AssetManifest = { tables: Table[] };

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

function stylePrefix(block: Block, prefix: string, kind: "strong-em" | "em" | "underline"): void {
    if (!block.text) throw new Error(`Blocco senza testo per il prefisso ${prefix}`);
    const source = block.text.inline ?? [{ kind: "text" as const, value: block.text.normalized }];
    const plain = source.map((segment) => segment.value).join("");
    if (!plain.startsWith(prefix)) throw new Error(`Prefisso non trovato: ${prefix}`);
    let remaining = prefix.length;
    const result: Inline[] = [];
    for (const segment of source) {
        if (remaining === 0) {
            result.push(segment);
            continue;
        }
        if (segment.value.length <= remaining) {
            result.push({ kind, value: segment.value });
            remaining -= segment.value.length;
            continue;
        }
        result.push({ kind, value: segment.value.slice(0, remaining) });
        result.push({ ...segment, value: segment.value.slice(remaining) });
        remaining = 0;
    }
    if (remaining !== 0) throw new Error(`Prefisso troncato: ${prefix}`);
    block.text.inline = result;
    block.text.normalizationVersion = profile;
    addTransformation(block, `Applicata la resa tipografica verificata del titolo iniziale: ${prefix}`);
}

function stylePhrases(block: Block, phrases: Array<{ value: string; kind: "underline" | "strong-em" }>): void {
    if (!block.text) throw new Error("Blocco senza testo per le frasi formattate");
    const source = block.text.normalized;
    const ordered = phrases
        .map((phrase) => ({ ...phrase, start: source.indexOf(phrase.value) }))
        .sort((a, b) => a.start - b.start);
    if (ordered.some((phrase) => phrase.start < 0)) throw new Error("Frase formattata non trovata");
    const result: Inline[] = [];
    let offset = 0;
    for (const phrase of ordered) {
        if (phrase.start < offset) throw new Error("Frasi formattate sovrapposte");
        if (phrase.start > offset) result.push({ kind: "text", value: source.slice(offset, phrase.start) });
        result.push({ kind: phrase.kind, value: phrase.value });
        offset = phrase.start + phrase.value.length;
    }
    if (offset < source.length) result.push({ kind: "text", value: source.slice(offset) });
    block.text.inline = result;
    block.text.normalizationVersion = profile;
    addTransformation(block, "Ripristinati sottolineature e titoli in grassetto corsivo verificati sul render ufficiale.");
}

function setBodyAlignments(table: Table): void {
    for (const row of table.rows) {
        row.forEach((cell, index) => {
            cell.align = index === 0 ? "left" : "center";
        });
    }
}

function cell(text: string, options: Omit<Cell, "text"> = {}): Cell {
    return { text, ...options };
}

const c82 = await readJson<Unit>(join(unitsDir, "c8.2.json"));
const c82Footnote = c82.blocks.find((block) => block.kind === "footnote");
if (!c82Footnote?.text) throw new Error("C8.2: nota non trovata");
c82Footnote.text.paragraphs = [
    {
        normalized: "Per quanto riguarda le costruzioni esistenti di muratura, la valutazione della sicurezza deve essere effettuata nei confronti dei meccanismi di collasso, sia locali, sia globali, ove questi ultimi siano significativi; la verifica dei meccanismi globali diviene, in genere, significativa solo dopo che gli eventuali interventi abbiano eliminato i meccanismi di collasso locale. E’ inoltre opportuno considerare la distinzione tipologica tra edifici singoli e edifici in aggregato (es. edilizia dei centri storici, complessi formati da più corpi). In particolare, per le tipologie in aggregato, particolarmente frequenti nei centri storici, il comportamento globale è spesso non definibile o non identificabile, al contrario del comportamento delle singole parti o unità strutturali.",
    },
    {
        normalized: "Per quanto riguarda le costruzioni esistenti di c.a. e di acciaio, le NTC evidenziano come in esse possa essere attivata la capacità di elementi con meccanismi resistenti sia “duttili” sia “fragili”; a tale riguardo, è opportuno che l’analisi sismica globale utilizzi, per quanto possibile, metodi di modellazione e analisi che consentano di valutare in maniera appropriata sia la resistenza sia la duttilità disponibili, tenendo conto della possibilità di sviluppo di entrambi i tipi di meccanismo e adottando parametri di capacità dei materiali diversificati a seconda del tipo di meccanismo.",
    },
];
c82Footnote.text.normalizationVersion = profile;
addTransformation(c82Footnote, "Conservati i due capoversi della nota verificati sul render ufficiale.");
await writeJson(join(unitsDir, "c8.2.json"), c82);

const c8521 = await readJson<Unit>(join(unitsDir, "c8.5.2.1.json"));
for (const prefix of ["Indagini limitate:", "Indagini estese:", "Indagini esaustive:"]) {
    const block = c8521.blocks.find((item) => item.text?.normalized.startsWith(prefix));
    if (!block) throw new Error(`C8.5.2.1: titolo non trovato: ${prefix}`);
    stylePrefix(block, prefix, "strong-em");
}
await writeJson(join(unitsDir, "c8.5.2.1.json"), c8521);

const c8522 = await readJson<Unit>(join(unitsDir, "c8.5.2.2.json"));
const firstC8522 = c8522.blocks.find((block) => block.text?.normalized.startsWith("Il rilievo è finalizzato"));
if (!firstC8522) throw new Error("C8.5.2.2: primo paragrafo non trovato");
stylePhrases(firstC8522, [
    { value: "Per gli elementi aventi funzione strutturale la geometria esterna deve essere", kind: "underline" },
    { value: "sempre descritta in maniera la più completa possibile", kind: "underline" },
    { value: "mentre i dettagli,", kind: "underline" },
    { value: "possono essere rilevati a campione", kind: "underline" },
]);
const informationLead = c8522.blocks.find((block) => block.text?.normalized.includes("il rilievo dei dettagli costruttivi è finalizzato a conseguire le seguenti informazioni"));
if (!informationLead) throw new Error("C8.5.2.2: introduzione all’elenco delle informazioni non trovata");
stylePhrases(informationLead, [
    { value: "il rilievo dei dettagli costruttivi è finalizzato a conseguire le seguenti informazioni:", kind: "underline" },
]);
for (const prefix of ["Indagini limitate:", "Indagini estese:", "Indagini esaustive:"]) {
    const block = c8522.blocks.find((item) => item.text?.normalized.startsWith(prefix));
    if (!block) throw new Error(`C8.5.2.2: titolo non trovato: ${prefix}`);
    stylePrefix(block, prefix, "strong-em");
}
for (const title of ["Costruzioni di calcestruzzo armato", "Costruzioni di acciaio:"]) {
    const block = c8522.blocks.find((item) => item.kind === "heading" && item.text?.normalized === title);
    if (!block?.text) throw new Error(`C8.5.2.2: sottotitolo non trovato: ${title}`);
    block.text.inline = [{ kind: "strong-em", value: title }];
    block.text.normalizationVersion = profile;
    addTransformation(block, `Reso in grassetto corsivo il sottotitolo verificato: ${title}`);
}
await writeJson(join(unitsDir, "c8.5.2.2.json"), c8522);

const c8531 = await readJson<Unit>(join(unitsDir, "c8.5.3.1.json"));
for (const prefix of [
    "malta di buone caratteristiche:",
    "presenza di ricorsi (o listature):",
    "presenza sistematica di elementi di collegamento trasversale tra i paramenti:",
    "Prove limitate:",
    "Prove estese:",
    "Prove esaustive:",
]) {
    const block = c8531.blocks.find((item) => item.text?.normalized.startsWith(prefix));
    if (!block) throw new Error(`C8.5.3.1: titolo non trovato: ${prefix}`);
    stylePrefix(block, prefix, "strong-em");
}
for (const title of [
    "Consolidamento con iniezioni di miscele leganti",
    "Consolidamento con intonaco armato",
    "Consolidamento con diatoni artificiali o tirantini antiespulsivi",
    "Consolidamento con ristilatura armata e connessione dei paramenti",
]) {
    const block = c8531.blocks.find((item) => item.kind === "heading" && item.text?.normalized === title);
    if (!block?.text) throw new Error(`C8.5.3.1: sottotitolo non trovato: ${title}`);
    block.text.inline = [{ kind: "strong-em", value: title }];
    block.text.normalizationVersion = profile;
    addTransformation(block, `Reso in grassetto corsivo il sottotitolo verificato: ${title}`);
}
await writeJson(join(unitsDir, "c8.5.3.1.json"), c8531);

const assets = await readJson<AssetManifest>(assetsPath);
const tableI = assets.tables.find((table) => table.officialNumber === "C8.5.I");
const tableII = assets.tables.find((table) => table.officialNumber === "C8.5.II");
if (!tableI || !tableII) throw new Error("Tabelle C8.5.I–II non trovate");

tableI.columnWidths = [23, 13, 13, 13, 13, 13, 12];
tableI.headers = [
    [
        cell("Tipologia di muratura", { rowSpan: 3, align: "left", strong: true }),
        cell("f", { latex: "f", align: "center", strong: true }),
        cell("τ₀", { latex: "\\tau_0", align: "center", strong: true }),
        cell("fᵥ₀", { latex: "f_{v0}", align: "center", strong: true }),
        cell("E", { latex: "E", align: "center", strong: true }),
        cell("G", { latex: "G", align: "center", strong: true }),
        cell("w", { latex: "w", align: "center", strong: true }),
    ],
    [
        cell("(N/mm²)", { latex: "\\left(\\mathrm{N/mm^2}\\right)", align: "center", strong: true }),
        cell("(N/mm²)", { latex: "\\left(\\mathrm{N/mm^2}\\right)", align: "center", strong: true }),
        cell("(N/mm²)", { latex: "\\left(\\mathrm{N/mm^2}\\right)", align: "center", strong: true }),
        cell("(N/mm²)", { latex: "\\left(\\mathrm{N/mm^2}\\right)", align: "center", strong: true }),
        cell("(N/mm²)", { latex: "\\left(\\mathrm{N/mm^2}\\right)", align: "center", strong: true }),
        cell("(kN/m³)", { latex: "\\left(\\mathrm{kN/m^3}\\right)", align: "center", strong: true }),
    ],
    [
        cell("min-max", { align: "center", strong: true }),
        cell("min-max", { align: "center", strong: true }),
        cell("", { align: "center", strong: true }),
        cell("min-max", { align: "center", strong: true }),
        cell("min-max", { align: "center", strong: true }),
        cell("", { align: "center", strong: true }),
    ],
];
tableI.headers.flat().forEach((header) => { header.align = "center"; });
tableI.headers[0]![0]!.align = "left";
setBodyAlignments(tableI);
for (const row of tableI.rows) {
    row.slice(1).forEach((bodyCell) => { bodyCell.noWrap = true; });
}
tableI.notesInline = [
    [{ kind: "text", value: tableI.notes[0] ?? "" }],
    [
        { kind: "text", value: "(**) Data la varietà litologica della pietra tenera, il peso specifico è molto variabile ma può essere facilmente stimato con prove dirette. Nel caso di muratura a conci regolari di pietra tenera, in presenza di una caratterizzazione diretta della resistenza a compressione degli elementi costituenti, la resistenza a compressione " },
        { kind: "math", value: "f", latex: "f" },
        { kind: "text", value: " può essere valutata attraverso le indicazioni del § 11.10 delle NTC." },
    ],
    [{ kind: "text", value: tableI.notes[2] ?? "" }],
];

tableII.columnWidths = [31, 8, 8, 8, 11, 11, 13, 10];
const tableIIHeader0 = tableII.headers[0] ?? [];
if (tableIIHeader0.length < 3) throw new Error("Intestazione Tab. C8.5.II incompleta");
tableII.headers[0] = [
    { ...tableIIHeader0[0]!, align: "left", strong: true },
    { ...tableIIHeader0[1]!, align: "center", strong: true },
    { ...tableIIHeader0[2]!, align: "center", strong: true },
];
tableII.headers[1] = (tableII.headers[1] ?? []).map((header) => ({ ...header, align: "center", strong: true, verticalText: true }));
const tableIIHeader1 = tableII.headers[1]!;
tableIIHeader1[1]!.text = "Ricorsi o\nlistature";
tableIIHeader1[2]!.text = "Connessione\ntrasversale";
tableIIHeader1[3]!.text = "Iniezione di\nmiscele leganti (*)";
tableIIHeader1[5]!.text = "Ristilatura armata\ncon connessione\ndei paramenti (**)";
tableIIHeader1[6]!.text = "Massimo\ncoefficiente\ncomplessivo";
setBodyAlignments(tableII);
tableII.notesInline = [
    [{ kind: "text", value: tableII.notes[0] ?? "" }],
    [
        { kind: "text", value: "(**) Valori da ridurre convenientemente nel caso di pareti di notevole spessore (p.es. " },
        { kind: "math", value: "> 70 cm", latex: ">70\\,\\mathrm{cm}" },
        { kind: "text", value: ")." },
    ],
    [
        { kind: "text", value: "(***) Nel caso di muratura di mattoni si intende come “malta buona” una malta con resistenza media a compressione " },
        { kind: "math", value: "f_m", latex: "f_m" },
        { kind: "text", value: " superiore a 2 " },
        { kind: "math", value: "N/mm²", latex: "\\mathrm{N/mm^2}" },
        { kind: "text", value: ". In tal caso il coefficiente correttivo può essere posto pari a " },
        { kind: "math", value: "f_m^{0,35}", latex: "f_m^{0{,}35}" },
        { kind: "text", value: " (" },
        { kind: "math", value: "f_m", latex: "f_m" },
        { kind: "text", value: " in " },
        { kind: "math", value: "N/mm²", latex: "\\mathrm{N/mm^2}" },
        { kind: "text", value: ")." },
    ],
    [{ kind: "text", value: tableII.notes[3] ?? "" }],
];
await writeJson(assetsPath, assets);

console.log("fix-circ8-c85-step1-editorial: C8.2, C8.5.2.1–.2, C8.5.3.1 e Tabelle C8.5.I–II aggiornati");
