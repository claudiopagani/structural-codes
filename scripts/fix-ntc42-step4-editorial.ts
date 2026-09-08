import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

type InlineSegment = { kind: "text" | "em" | "strong" | "math"; value: string; latex?: string };
type MathSpec = { value: string; latex: string };
type Definition = { raw: string; normalized: string; math: MathSpec[] };
// I record canonici contengono blocchi e asset con forme eterogenee.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Unit = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Block = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Asset = any;

const root = fileURLToPath(new URL("../", import.meta.url));
const unitDirectory = join(root, "corpus", "units", "ntc2018");
const assetDirectory = join(root, "corpus", "assets", "ntc2018");
const profile = "ntc42-formatting-step4-0.1.0";

function assert(condition: unknown, message: string): asserts condition {
    if (!condition) throw new Error(message);
}

function sha256(value: string): string {
    return createHash("sha256").update(value).digest("hex");
}

function inline(normalized: string, math: MathSpec[] = []): InlineSegment[] {
    const result: InlineSegment[] = [];
    let cursor = 0;
    for (const item of math) {
        const index = normalized.indexOf(item.value, cursor);
        assert(index >= 0, `Segmento assente: ${item.value}`);
        if (index > cursor) result.push({ kind: "text", value: normalized.slice(cursor, index) });
        result.push({ kind: "math", value: item.value, latex: item.latex });
        cursor = index + item.value.length;
    }
    if (cursor < normalized.length) result.push({ kind: "text", value: normalized.slice(cursor) });
    return result;
}

function assertInline(block: Block, segments: InlineSegment[]) {
    assert(segments.map((segment) => segment.value).join("") === block.text.normalized, `Segmenti incoerenti: ${block.blockId}`);
}

function recordTransformation(block: Block, note: string) {
    block.evidence.transformations ??= [];
    if (block.evidence.transformations.some((item: { ruleVersion?: string; note?: string }) => item.ruleVersion === profile && item.note === note)) return;
    block.evidence.transformations.push({ operation: "manual-correction", ruleVersion: profile, note });
}

function saveText(block: Block, raw: string, normalized: string, segments: InlineSegment[], note: string) {
    block.text.raw = raw;
    block.text.normalized = normalized;
    assertInline(block, segments);
    block.text.inline = segments;
    block.text.normalizationVersion = profile;
    recordTransformation(block, note);
    block.evidence.rawSha256 = sha256(raw);
    block.evidence.normalizedSha256 = sha256(normalized);
}

async function readUnit(number: string): Promise<{ path: string; unit: Unit }> {
    const path = join(unitDirectory, `${number}.json`);
    return { path, unit: JSON.parse(await readFile(path, "utf8")) as Unit };
}

async function writeJson(path: string, value: unknown) {
    await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function findBlock(unit: Unit, prefix: string): Block {
    const block = unit.blocks.find((candidate: Block) => candidate.text?.normalized.startsWith(prefix));
    assert(block, `Blocco assente in ${unit.numbering.official}: ${prefix}`);
    return block;
}

function setNoMarker(block: Block) {
    block.kind = "list-item";
    block.listMarker = "none";
    delete block.listLevel;
}

function italicHeading(block: Block, title: string, note: string) {
    assert(block.text.normalized === title, `Titolo inatteso: ${title}`);
    saveText(block, block.text.raw, block.text.normalized, [{ kind: "em", value: title }], note);
}

function emphasize(block: Block, phrases: string[], note: string) {
    const segments: InlineSegment[] = [];
    let cursor = 0;
    for (const phrase of phrases) {
        const index = block.text.normalized.indexOf(phrase, cursor);
        assert(index >= 0, `Frase assente: ${phrase}`);
        if (index > cursor) segments.push({ kind: "text", value: block.text.normalized.slice(cursor, index) });
        segments.push({ kind: "em", value: phrase });
        cursor = index + phrase.length;
    }
    if (cursor < block.text.normalized.length) segments.push({ kind: "text", value: block.text.normalized.slice(cursor) });
    saveText(block, block.text.raw, block.text.normalized, segments, note);
}

function splitWithIntro(unit: Unit, prefix: string, intro: string, definitions: Definition[], note: string) {
    const source = findBlock(unit, prefix);
    if (unit.blocks.some((block: Block) => block.blockId === `${source.blockId}-definition-1`)) return;
    const index = unit.blocks.indexOf(source);
    saveText(source, intro, intro, inline(intro), note);
    const replacements = definitions.map((definition, definitionIndex) => {
        const block = structuredClone(source);
        block.blockId = `${source.blockId}-definition-${definitionIndex + 1}`;
        setNoMarker(block);
        saveText(block, definition.raw, definition.normalized, inline(definition.normalized, definition.math), note);
        return block;
    });
    unit.blocks.splice(index + 1, 0, ...replacements);
}

function setTableCaption(table: Asset, label: string, description: InlineSegment[]) {
    table.caption = label + description.map((segment) => segment.value).join("");
    table.captionInline = [{ kind: "strong", value: label }, ...description];
    assert(table.captionInline.map((segment: InlineSegment) => segment.value).join("") === table.caption, `Didascalia incoerente: ${label}`);
}

function setFigureCaption(figure: Asset, label: string, description?: string) {
    figure.caption = `${label}${description ?? ""}`;
    figure.captionInline = description === undefined
        ? [{ kind: "strong", value: label }]
        : [{ kind: "strong", value: label }, { kind: "em", value: description }];
}

async function updateBullons() {
    {
        const { path, unit } = await readUnit("4.2.8.1");
        emphasize(findBlock(unit, "Le unioni realizzate con bulloni"), ["“non precaricate”", "“precaricate”"], "Conservati i termini qualificanti in corsivo.");
        emphasize(findBlock(unit, "Le unioni realizzate con chiodi"), ["“non precaricate”"], "Conservato il termine qualificante in corsivo.");
        await writeJson(path, unit);
    }

    {
        const { path, unit } = await readUnit("4.2.8.1.1");
        emphasize(findBlock(unit, "Nei collegamenti con bulloni “non precaricati”"), ["“non precaricati”"], "Conservato il termine qualificante in corsivo.");
        emphasize(findBlock(unit, "Nei collegamenti con bulloni “precaricati”"), ["“precaricati”"], "Conservato il termine qualificante in corsivo.");
        emphasize(findBlock(unit, "Nel caso di utilizzo di bulloneria"), ["“non precaricati”"], "Conservato il termine qualificante in corsivo.");
        emphasize(findBlock(unit, "Nei giunti con bulloni ad alta resistenza"), ["“precaricati”", "“precarico”"], "Conservati i termini qualificanti in corsivo.");
        emphasize(findBlock(unit, "I fori devono avere diametro"), ["“accoppiamenti di precisione”"], "Conservata l’espressione tecnica fra virgolette in corsivo.");
        italicHeading(findBlock(unit, "Unioni con bulloni o chiodi soggette"), "Unioni con bulloni o chiodi soggette a taglio e/o a trazione", "Conservato il corsivo del sottotitolo interno.");
        italicHeading(findBlock(unit, "Unioni a taglio per attrito"), "Unioni a taglio per attrito con bulloni ad alta resistenza", "Conservato il corsivo del sottotitolo interno.");
        for (const prefix of ["d è il diametro", "t è lo spessore", "ftk è la resistenza", "α=min {e1", "α=min {p1", "k=min {2,8", "k=min {1,4"]) setNoMarker(findBlock(unit, prefix));
        splitWithIntro(unit, "dove: n è", "dove:", [
            { raw: "n è il numero delle superfici di attrito,", normalized: "n è il numero delle superfici di attrito,", math: [{ value: "n", latex: "n" }] },
            { raw: "μ è il coefficiente di attrito,", normalized: "μ è il coefficiente di attrito,", math: [{ value: "μ", latex: "\\mu" }] },
            { raw: "Fp,Cd è la forza di precarico del bullone data dalla espressione [4.2.62] che, in caso di serraggio controllato, può essere assunta pari a 0,7 ftbk Ares, invece che pari a 0,7 ftbk Ares/γM7.", normalized: "Fp,Cd è la forza di precarico del bullone data dalla espressione [4.2.62] che, in caso di serraggio controllato, può essere assunta pari a 0,7 ftbk Ares, invece che pari a 0,7 ftbk Ares/γM7.", math: [{ value: "Fp,Cd", latex: "F_{p,Cd}" }, { value: "0,7 ftbk Ares", latex: "0{,}7f_{tbk}A_{res}" }, { value: "0,7 ftbk Ares/γM7", latex: "0{,}7f_{tbk}A_{res}/\\gamma_{M7}" }] },
        ], "Separate le tre definizioni allineate del collegamento ad attrito.");
        const frictionIntro = findBlock(unit, "Il coefficiente di attrito");
        saveText(frictionIntro, frictionIntro.text.raw, frictionIntro.text.normalized, [
            { kind: "text", value: "Il coefficiente di attrito tra le piastre " },
            { kind: "math", value: "μ", latex: "\\mu" },
            { kind: "text", value: " a contatto nelle unioni " },
            { kind: "em", value: "“precaricate”" },
            { kind: "text", value: " è in genere assunto pari a:" },
        ], "Conservato il corsivo del termine qualificante con il coefficiente di attrito.");
        for (const prefix of ["μ = 0,5", "μ = 0,4", "– superfici sabbiate", "μ = 0,3", "μ = 0,2"]) setNoMarker(findBlock(unit, prefix));
        await writeJson(path, unit);
    }
}

async function updateWelds() {
    {
        const { path, unit } = await readUnit("4.2.8.2.3");
        const block = findBlock(unit, "La resistenza di progetto, per unità");
        saveText(block, block.text.raw, block.text.normalized, [
            { kind: "text", value: "La resistenza di progetto, per unità di lunghezza, dei cordoni d’angolo si determina con riferimento all’altezza di gola “" },
            { kind: "math", value: "a", latex: "a" },
            { kind: "text", value: "”, cioè all’altezza “" },
            { kind: "math", value: "a", latex: "a" },
            { kind: "text", value: "” del triangolo inscritto nella sezione trasversale del cordone stesso (Fig. 4.2.6)." },
        ], "Resa matematica l’altezza di gola citata nella prosa.");
        await writeJson(path, unit);
    }
}

async function updateCaptions() {
    {
        const path = join(assetDirectory, "4.2-step5.json");
        const manifest = JSON.parse(await readFile(path, "utf8")) as { tables: Asset[]; figures: Asset[] };
        for (const [number, label, description] of [
            ["4.2.XV", "Tabella 4.2.XV", " - Classi funzionali per i bulloni"],
            ["4.2.XVI", "Tabella 4.2.XVI", " – Coppie di serraggio per i bulloni 8.8"],
            ["4.2.XVII", "Tabella 4.2.XVII", " Coppie di serraggio per bulloni 10.9"],
            ["4.2.XVIII", "Tab. 4.2.XVIII", " - Posizione dei fori per unioni bullonate e chiodate."],
        ] as const) {
            const table = manifest.tables.find((asset) => asset.officialNumber === number);
            assert(table, `Tabella assente: ${number}`);
            setTableCaption(table, label, [{ kind: "em", value: description }]);
        }
        const figure = manifest.figures.find((asset) => asset.officialNumber === "4.2.5");
        assert(figure, "Figura 4.2.5 assente");
        setFigureCaption(figure, "Fig. 4.2.5", " -Disposizione dei fori per la realizzazione di unioni bullonate o chiodate");
        await writeJson(path, manifest);
    }

    {
        const path = join(assetDirectory, "4.2-step6.json");
        const manifest = JSON.parse(await readFile(path, "utf8")) as { tables: Asset[]; figures: Asset[] };
        const table = manifest.tables.find((asset) => asset.officialNumber === "4.2.XIX");
        assert(table, "Tabella 4.2.XIX assente");
        setTableCaption(table, "Tab. 4.2.XIX", [
            { kind: "em", value: " - Valori dei coefficienti " },
            { kind: "math", value: "β1", latex: "\\beta_1" },
            { kind: "em", value: " e " },
            { kind: "math", value: "β2", latex: "\\beta_2" },
        ]);
        const figure6 = manifest.figures.find((asset) => asset.officialNumber === "4.2.6");
        const figure7 = manifest.figures.find((asset) => asset.officialNumber === "4.2.7");
        assert(figure6 && figure7, "Figure 4.2.6-7 assenti");
        setFigureCaption(figure6, "Fig. 4.2.6", " -Definizione dell’area di gola per le saldature a cordone d’angolo");
        setFigureCaption(figure7, "Figura 4.2.7");
        await writeJson(path, manifest);
    }
}

await updateBullons();
await updateWelds();
await updateCaptions();
console.log("ntc42-step4-editorial: corretti corsivi, definizioni, elenchi e didascalie delle pagine 113-119");
