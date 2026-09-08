import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

type InlineKind = "text" | "strong" | "em" | "math";
type InlineSegment = { kind: InlineKind; value: string; latex?: string };
type MathSpec = { value: string; latex: string };
// I record canonici contengono blocchi e evidence eterogenei.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Unit = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Block = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Asset = any;

const root = fileURLToPath(new URL("../", import.meta.url));
const unitDirectory = join(root, "corpus", "units", "circ2019");
const assetDirectory = join(root, "corpus", "assets", "circ2019");
const profile = "circ41-step2-editorial-0.1.0";

function assert(condition: unknown, message: string): asserts condition {
    if (!condition) throw new Error(message);
}

function sha256(value: string): string {
    return createHash("sha256").update(value).digest("hex");
}

function mathInline(normalized: string, math: MathSpec[] = []): InlineSegment[] {
    const result: InlineSegment[] = [];
    let cursor = 0;
    for (const item of math) {
        const index = normalized.indexOf(item.value, cursor);
        assert(index >= 0, `Segmento ${item.value} assente da: ${normalized}`);
        if (index > cursor) result.push({ kind: "text", value: normalized.slice(cursor, index) });
        result.push({ kind: "math", value: item.value, latex: item.latex });
        cursor = index + item.value.length;
    }
    if (cursor < normalized.length) result.push({ kind: "text", value: normalized.slice(cursor) });
    return result;
}

function recordTransformation(block: Block, note: string) {
    block.evidence.transformations ??= [];
    if (!block.evidence.transformations.some((item: { ruleVersion?: string; note?: string }) => item.ruleVersion === profile && item.note === note)) {
        block.evidence.transformations.push({ operation: "manual-correction", ruleVersion: profile, note });
    }
}

function setText(block: Block, normalized: string, math: MathSpec[], note: string, raw = block.text.raw) {
    block.text.raw = raw;
    block.text.normalized = normalized;
    block.text.inline = mathInline(normalized, math);
    block.text.normalizationVersion = profile;
    recordTransformation(block, note);
    block.evidence.rawSha256 = sha256(raw);
    block.evidence.normalizedSha256 = sha256(normalized);
}

function setInline(block: Block, inline: InlineSegment[], note: string) {
    assert(inline.map((segment) => segment.value).join("") === block.text.normalized, `Segmenti incoerenti: ${block.blockId}`);
    block.text.inline = inline;
    block.text.normalizationVersion = profile;
    recordTransformation(block, note);
    block.evidence.rawSha256 = sha256(block.text.raw);
    block.evidence.normalizedSha256 = sha256(block.text.normalized);
}

async function readUnit(id: string): Promise<{ path: string; unit: Unit }> {
    const path = join(unitDirectory, `${id}.json`);
    return { path, unit: JSON.parse(await readFile(path, "utf8")) as Unit };
}

async function save(path: string, unit: Unit) {
    await writeFile(path, `${JSON.stringify(unit, null, 2)}\n`, "utf8");
}

function textBlock(unit: Unit, prefixes: string | readonly string[]): Block {
    const accepted = Array.isArray(prefixes) ? prefixes : [prefixes];
    const block = unit.blocks.find((candidate: Block) => accepted.some((prefix) => candidate.text?.normalized.startsWith(prefix)));
    assert(block, `Blocco non trovato: ${accepted.join(" | ")}`);
    return block;
}

function splitLabelBlock(
    unit: Unit,
    prefix: string | string[],
    lines: Array<{ raw: string; normalized: string; math: MathSpec[] }>,
    note: string,
) {
    const source = textBlock(unit, prefix);
    const start = unit.blocks.indexOf(source);
    if (unit.blocks.some((block: Block) => block.blockId === `${source.blockId}-2`)) {
        for (const [index, line] of lines.entries()) {
            const block = unit.blocks[start + index];
            assert(block?.blockId === (index === 0 ? source.blockId : `${source.blockId}-${index + 1}`), `Blocco derivato inatteso: ${source.blockId}`);
            block.kind = "list-item";
            block.listMarker = "none";
            delete block.listLevel;
            setText(block, line.normalized, line.math, note, line.raw);
        }
        return;
    }
    const replacement = lines.map((line, index) => {
        const block = structuredClone(source);
        if (index > 0) block.blockId = `${source.blockId}-${index + 1}`;
        block.kind = "list-item";
        block.listMarker = "none";
        delete block.listLevel;
        setText(block, line.normalized, line.math, note, line.raw);
        return block;
    });
    unit.blocks.splice(start, 1, ...replacement);
}

function setHeadingEm(unit: Unit, officialNumber: string, title: string) {
    const block = textBlock(unit, `${officialNumber} ${title}`);
    assert(block.kind === "heading", `Attesa heading: ${officialNumber}`);
    setInline(block, [
        { kind: "text", value: `${officialNumber} ` },
        { kind: "em", value: title },
    ], "Conservato il corsivo del sottotitolo numerato nella fonte ufficiale.");
}

async function updateUnits() {
    {
        const { path, unit } = await readUnit("c4.1.9");
        const source = textBlock(unit, "1) le deformazioni risultino compatibili");
        if (!unit.blocks.some((block: Block) => block.blockId === `${source.blockId}-2`)) {
            const start = unit.blocks.indexOf(source);
            const first = structuredClone(source);
            const second = structuredClone(source);
            first.kind = "list-item";
            first.listMarker = "none";
            second.blockId = `${source.blockId}-2`;
            second.kind = "list-item";
            second.listMarker = "none";
            const note = "Separate le due voci numerate dopo l’introduzione, come nel PDF ufficiale.";
            setText(first, "1) le deformazioni risultino compatibili con le condizioni di esercizio del solaio e degli elementi costruttivi ed impiantistici ad esso collegati;", [], note, "1) le deformazioni risultino compatibili con le condizioni di esercizio del solaio e degli elementi costruttivi ed impiantistici ad esso collegati;");
            setText(second, "2) vi sia, in base alle resistenze meccaniche dei materiali, un rapporto adeguato tra la sezione delle armature di acciaio, la larghezza delle nervature in calcestruzzo, il loro interasse e lo spessore della soletta di completamento in modo che sia assicurata la rigidezza nel piano e che sia evitato il pericolo di effetti secondari indesiderati.", [], note, "2) vi sia, in base alle resistenze meccaniche dei materiali, un rapporto adeguato tra la sezione delle armature di acciaio, la larghezza delle nervature in calcestruzzo, il loro interasse e lo spessore della soletta di completamento in modo che sia assicurata la rigidezza nel piano e che sia evitato il pericolo di effetti secondari indesiderati.");
            setInline(second, [
                { kind: "text", value: "2) vi sia, in base alle resistenze meccaniche dei materiali, un rapporto adeguato tra la sezione delle armature di acciaio, la larghezza delle nervature in calcestruzzo, il loro interasse e lo spessore della soletta di completamento in modo che sia assicurata la " },
                { kind: "em", value: "rigidezza nel piano" },
                { kind: "text", value: " e che sia evitato il pericolo di effetti secondari indesiderati." },
            ], "Conservato il corsivo di «rigidezza nel piano» nella seconda voce numerata.");
            unit.blocks.splice(start, 1, first, second);
        }
        await save(path, unit);
    }

    {
        const { path, unit } = await readUnit("c4.1.9.1.1");
        const [first, second] = unit.blocks.filter((block: Block) => block.kind === "list-item");
        assert(first && second, "Voci tratteggiate mancanti in C4.1.9.1.1");
        first.listMarker = "dash";
        second.listMarker = "dash";
        const block = textBlock(unit, "I blocchi di laterizio sia collaboranti");
        setInline(block, [
            { kind: "text", value: "I blocchi di laterizio sia " },
            { kind: "em", value: "collaboranti" },
            { kind: "text", value: " che " },
            { kind: "em", value: "non collaboranti" },
            { kind: "text", value: " devono avere le seguenti caratteristiche minime:" },
        ], "Conservato il corsivo delle due qualificazioni dei blocchi e i trattini dell’elenco.");
        await save(path, unit);
    }

    {
        const { path, unit } = await readUnit("c4.1.9.1.3");
        const block = textBlock(unit, "Per i blocchi collaboranti, la resistenza caratteristica");
        setInline(block, [
            { kind: "text", value: "Per i blocchi collaboranti, la resistenza caratteristica a compressione, riferita alla sezione netta delle pareti e delle costolature, deve risultare non minore di 30 " },
            { kind: "math", value: "N/mm²", latex: "\\mathrm{N/mm^2}" },
            { kind: "text", value: " nella direzione dei fori e di 15 " },
            { kind: "math", value: "N/mm²", latex: "\\mathrm{N/mm^2}" },
            { kind: "text", value: " nella direzione trasversale ai fori, nel piano del solaio. " },
            { kind: "em", value: "La resistenza caratteristica a trazione per flessione" },
            { kind: "text", value: ", determinata su campioni ricavati dai blocchi mediante opportuno taglio di listelli di dimensioni minime 30 " },
            { kind: "math", value: "×", latex: "\\times" },
            { kind: "text", value: " 120 " },
            { kind: "math", value: "×", latex: "\\times" },
            { kind: "text", value: " spessore in mm, deve essere non minore di 10 " },
            { kind: "math", value: "N/mm²", latex: "\\mathrm{N/mm^2}" },
            { kind: "text", value: "." },
        ], "Conservato il corsivo della grandezza caratteristica a trazione per flessione.");
        await save(path, unit);
    }

    {
        const { path, unit } = await readUnit("c4.1.12.1.1.1");
        setHeadingEm(unit, "C4.1.12.1.1.1", "Resistenza a trazione");
        splitLabelBlock(unit, "ρ è il valore limite superiore", [
            {
                raw: "ρ = valore limite superiore della massa per unità di volume del calcestruzzo, per la classe di massa per unità di volume di appartenenza in kg/m³;",
                normalized: "ρ è il valore limite superiore della massa per unità di volume del calcestruzzo, per la classe di massa per unità di volume di appartenenza, in kg/m³;",
                math: [{ value: "ρ", latex: "\\rho" }],
            },
            {
                raw: "flck = valore della resistenza cilindrica caratteristica a compressione in N/mm²;",
                normalized: "flck è il valore della resistenza cilindrica caratteristica a compressione, in N/mm²;",
                math: [{ value: "flck", latex: "f_{lck}" }, { value: "N/mm²", latex: "\\mathrm{N/mm^2}" }],
            },
            {
                raw: "flcm = valore della resistenza media cilindrica a compressione in N/mm².",
                normalized: "flcm è il valore della resistenza media cilindrica a compressione, in N/mm².",
                math: [{ value: "flcm", latex: "f_{lcm}" }, { value: "N/mm²", latex: "\\mathrm{N/mm^2}" }],
            },
        ], "Separate le tre definizioni allineate dopo «dove» dal PDF ufficiale.");
        const fractional = textBlock(unit, "I valori caratteristici della resistenza a trazione semplice");
        if (!unit.blocks.some((block: Block) => block.blockId === `${fractional.blockId}-2`)) {
            const start = unit.blocks.indexOf(fractional);
            const intro = structuredClone(fractional);
            const first = structuredClone(fractional);
            intro.text.normalized = "I valori caratteristici della resistenza a trazione semplice, corrispondenti ai frattili 0,05 e 0,95, possono assumersi pari a:";
            intro.text.raw = intro.text.normalized;
            delete intro.text.inline;
            intro.text.normalizationVersion = profile;
            recordTransformation(intro, "Separate l’introduzione dai due frattili elencati nella fonte ufficiale.");
            intro.evidence.rawSha256 = sha256(intro.text.raw);
            intro.evidence.normalizedSha256 = sha256(intro.text.normalized);
            first.blockId = `${fractional.blockId}-2`;
            first.kind = "list-item";
            first.listMarker = "dash";
            setText(first, "frattile 5%:", [], "Separate l’introduzione dai due frattili elencati nella fonte ufficiale.", "– frattile 5%:");
            unit.blocks.splice(start, 1, intro, first);
        }
        const second = textBlock(unit, ["frattile 95%:", "Frattile 95%:"]);
        second.kind = "list-item";
        second.listMarker = "dash";
        setText(second, "frattile 95%:", [], "Conservato il secondo frattile come voce tratteggiata.", "– frattile 95%:");
        await save(path, unit);
    }

    {
        const { path, unit } = await readUnit("c4.1.12.1.1.2");
        setHeadingEm(unit, "C4.1.12.1.1.2", "Modulo di elasticità");
        for (const prefix of ["flcm è il valore", "ρ è il valore limite superiore"]) {
            const block = textBlock(unit, prefix);
            block.kind = "list-item";
            block.listMarker = "none";
            recordTransformation(block, "Conservata la definizione allineata della grandezza dopo la formula.");
        }
        await save(path, unit);
    }

    {
        const { path, unit } = await readUnit("c4.1.12.1.2.1");
        setHeadingEm(unit, "C4.1.12.1.2.1", "Verifiche di deformabilità");
        await save(path, unit);
    }

    {
        const { path, unit } = await readUnit("c4.1.12.1.3.1");
        setHeadingEm(unit, "C4.1.12.1.3.1", "Resistenza a sforzo normale e flessione (elementi monodimensionali)");
        for (const [prefix, normalized] of [
            [["Per calcestruzzi di classe di resistenza inferiore", "per calcestruzzi di classe di resistenza inferiore"], "per calcestruzzi di classe di resistenza inferiore o uguale a LC 50/55 pari a:"],
            [["Per calcestruzzi di classe di resistenza pari", "per calcestruzzi di classe di resistenza pari"], "per calcestruzzi di classe di resistenza pari a LC 55/60 pari a:"],
        ] as const) {
            const block = textBlock(unit, prefix);
            block.kind = "list-item";
            block.listMarker = "dash";
            setText(block, normalized, [], "Conservato il trattino e il minuscolo iniziale delle due classi di resistenza.", `– ${normalized}`);
        }
        await save(path, unit);
    }

    {
        const { path, unit } = await readUnit("c4.1.12.1.3.2");
        setHeadingEm(unit, "C4.1.12.1.3.2", "Resistenza nei confronti di sollecitazioni taglianti");
        await save(path, unit);
    }

    {
        const { path, unit } = await readUnit("c4.1.12.1.3.2.1");
        setHeadingEm(unit, "C4.1.12.1.3.2.1", "Elementi senza armature trasversali resistenti al taglio");
        splitLabelBlock(unit, "d è l’altezza utile della sezione", [
            { raw: "d l’altezza utile della sezione (in mm);", normalized: "d è l’altezza utile della sezione (in mm);", math: [{ value: "d", latex: "d" }] },
            { raw: "ρl = Asl/(bw d) il rapporto geometrico di armatura longitudinale (≤ 0,02);", normalized: "ρl = Asl/(bw d) è il rapporto geometrico di armatura longitudinale (≤ 0,02);", math: [{ value: "ρl = Asl/(bw d)", latex: "\\rho_l=A_{sl}/(b_w d)" }, { value: "≤ 0,02", latex: "\\le0{,}02" }] },
            { raw: "σcp = NEd/Ac la tensione media di compressione nella sezione (≤ 0,2 fcd);", normalized: "σcp = NEd/Ac è la tensione media di compressione nella sezione (≤ 0,2 fcd);", math: [{ value: "σcp = NEd/Ac", latex: "\\sigma_{cp}=N_{Ed}/A_c" }, { value: "≤ 0,2 fcd", latex: "\\le0{,}2f_{cd}" }] },
            { raw: "bw la larghezza minima della sezione (in mm).", normalized: "bw è la larghezza minima della sezione (in mm).", math: [{ value: "bw", latex: "b_w" }] },
        ], "Separate le quattro definizioni allineate sotto la Formula C4.1.17.");
        await save(path, unit);
    }

    for (const [unitId, number, title] of [
        ["c4.1.12.1.3.2.2", "C4.1.12.1.3.2.2", "Elementi con armature trasversali resistenti al taglio"],
        ["c4.1.12.1.3.2.3", "C4.1.12.1.3.2.3", "Resistenza nei confronti di sollecitazioni torcenti"],
        ["c4.1.12.1.4.1", "C4.1.12.1.4.1", "Diametro massimo delle barre e dei trefoli"],
        ["c4.1.12.1.4.2", "C4.1.12.1.4.2", "Raggio di curvatura delle barre"],
        ["c4.1.12.1.4.3", "C4.1.12.1.4.3", "Ancoraggio delle barre e sovrapposizioni"],
    ] as const) {
        const { path, unit } = await readUnit(unitId);
        setHeadingEm(unit, number, title);
        await save(path, unit);
    }
}

function setCaption(asset: Asset, label: string, math: MathSpec[] = []) {
    assert(asset.caption.startsWith(label), `Didascalia inattesa: ${asset.officialNumber}`);
    const tail = asset.caption.slice(label.length);
    asset.captionInline = [{ kind: "strong", value: label }, ...mathInline(tail, math).map((segment) => segment.kind === "text" ? { ...segment, kind: "em" as const } : segment)];
    assert(asset.captionInline.map((segment: InlineSegment) => segment.value).join("") === asset.caption, `Didascalia incoerente: ${asset.officialNumber}`);
}

async function updateCaptions() {
    const figuresPath = join(assetDirectory, "core-figure-placeholders.json");
    const figuresManifest = JSON.parse(await readFile(figuresPath, "utf8")) as { figures: Asset[] };
    for (const number of ["C4.1.12", "C4.1.13"]) {
        const figure = figuresManifest.figures.find((asset) => asset.officialNumber === number);
        assert(figure, `Figura assente: ${number}`);
        setCaption(figure, `Figura ${number}`, number === "C4.1.13" ? [{ value: "σ-ε", latex: "\\sigma-\\varepsilon" }] : []);
    }
    await writeFile(figuresPath, `${JSON.stringify(figuresManifest, null, 2)}\n`, "utf8");

    const tablesPath = join(assetDirectory, "core-tables.json");
    const tablesManifest = JSON.parse(await readFile(tablesPath, "utf8")) as { tables: Asset[] };
    for (const number of ["C4.1.IV", "C4.1.V", "C4.1.VI"]) {
        const table = tablesManifest.tables.find((asset) => asset.officialNumber === number);
        assert(table, `Tabella assente: ${number}`);
        setCaption(table, `Tabella ${number}`);
    }
    await writeFile(tablesPath, `${JSON.stringify(tablesManifest, null, 2)}\n`, "utf8");
}

await updateUnits();
await updateCaptions();
console.log("circ41-step2-editorial: corretti struttura, stili e didascalie delle pagine 94-99");
