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
const profile = "ntc42-formatting-step2-0.1.0";

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

function setMath(block: Block, math: MathSpec[], note: string) {
    saveText(block, block.text.raw, block.text.normalized, inline(block.text.normalized, math), note);
}

function setNoMarker(block: Block) {
    block.kind = "list-item";
    block.listMarker = "none";
    delete block.listLevel;
}

function splitDefinitions(unit: Unit, prefix: string, definitions: Definition[], note: string) {
    const source = findBlock(unit, prefix);
    if (unit.blocks.some((block: Block) => block.blockId === `${source.blockId}-2`)) return;
    const index = unit.blocks.indexOf(source);
    const replacement = definitions.map((definition, definitionIndex) => {
        const block = structuredClone(source);
        if (definitionIndex > 0) block.blockId = `${source.blockId}-${definitionIndex + 1}`;
        setNoMarker(block);
        saveText(block, definition.raw, definition.normalized, inline(definition.normalized, definition.math), note);
        return block;
    });
    unit.blocks.splice(index, 1, ...replacement);
}

function italicHeading(block: Block, title: string, note: string) {
    const prefix = block.text.normalized.slice(0, -title.length);
    assert(block.text.normalized.endsWith(title), `Titolo inatteso: ${title}`);
    saveText(block, block.text.raw, block.text.normalized, [
        ...(prefix ? [{ kind: "text" as const, value: prefix }] : []),
        { kind: "em", value: title },
    ], note);
}

async function updateHeadings() {
    const headings = [
        ["4.2.4.1.1", "Resistenza di progetto"],
        ["4.2.4.1.2", "Resistenza delle membrature"],
        ["4.2.4.1.2.1", "Trazione"],
        ["4.2.4.1.2.2", "Compressione"],
        ["4.2.4.1.2.3", "Flessione monoassiale (retta)"],
        ["4.2.4.1.2.4", "Taglio"],
        ["4.2.4.1.2.5", "Torsione"],
        ["4.2.4.1.2.6", "Flessione e taglio"],
        ["4.2.4.1.2.7", "Presso o tenso-flessione retta"],
        ["4.2.4.1.2.8", "Presso o tenso flessione biassiale"],
        ["4.2.4.1.2.9", "Flessione, taglio e sforzo assiale"],
        ["4.2.4.1.3", "Stabilità delle membrature"],
        ["4.2.4.1.3.1", "Aste compresse"],
    ] as const;
    for (const [number, title] of headings) {
        const { path, unit } = await readUnit(number);
        italicHeading(unit.blocks.find((block: Block) => block.kind === "heading"), title, "Conservato il corsivo del titolo di sottolivello.");
        await writeJson(path, unit);
    }
    const { path, unit } = await readUnit("4.2.4.1.3.1");
    const heading = unit.blocks.find((block: Block) => block.blockId.endsWith("#block-heading-limit"));
    assert(heading, "Sottotitolo Limitazioni della snellezza assente");
    italicHeading(heading, "Limitazioni della snellezza", "Conservato il corsivo del sottotitolo non numerato.");
    await writeJson(path, unit);
}

async function updateDefinitionsAndMath() {
    {
        const { path, unit } = await readUnit("4.2.4.1.1");
        for (const prefix of ["Rk è", "γM è"]) setNoMarker(findBlock(unit, prefix));
        await writeJson(path, unit);
    }
    {
        const { path, unit } = await readUnit("4.2.4.1.2");
        splitDefinitions(unit, "dove: σx,Ed", [
            { raw: "σx,Ed è il valore di progetto della tensione normale nel punto in esame, agente in direzione parallela all’asse della membratura;", normalized: "σx,Ed è il valore di progetto della tensione normale nel punto in esame, agente in direzione parallela all’asse della membratura;", math: [{ value: "σx,Ed", latex: "\\sigma_{x,Ed}" }] },
            { raw: "σz,Ed è il valore di progetto della tensione normale nel punto in esame, agente in direzione ortogonale all’asse della membratura;", normalized: "σz,Ed è il valore di progetto della tensione normale nel punto in esame, agente in direzione ortogonale all’asse della membratura;", math: [{ value: "σz,Ed", latex: "\\sigma_{z,Ed}" }] },
            { raw: "τEd è il valore di progetto della tensione tangenziale nel punto in esame, agente nel piano della sezione della membratura.", normalized: "τEd è il valore di progetto della tensione tangenziale nel punto in esame, agente nel piano della sezione della membratura.", math: [{ value: "τEd", latex: "\\tau_{Ed}" }] },
        ], "Separate le tre definizioni allineate dopo «dove» secondo il PDF.");
        await writeJson(path, unit);
    }
    {
        const { path, unit } = await readUnit("4.2.4.1.2.1");
        setMath(findBlock(unit, "dove la resistenza"), [{ value: "Nt,Rd", latex: "N_{t,Rd}" }], "Ripristinato il pedice della resistenza a trazione nella prosa.");
        const first = findBlock(unit, "a)");
        first.kind = "list-item";
        setMath(first, [{ value: "A", latex: "A" }], "Conservata la prima voce alfabetica e la sua grandezza matematica.");
        const second = findBlock(unit, "b)");
        second.kind = "list-item";
        setMath(second, [{ value: "Anet", latex: "A_{net}" }], "Conservata la seconda voce alfabetica e la sua grandezza matematica.");
        setMath(findBlock(unit, "Qualora il progetto"), [{ value: "Npl,Rd", latex: "N_{pl,Rd}" }, { value: "Nu,Rd", latex: "N_{u,Rd}" }], "Ripristinati i pedici delle resistenze nella condizione gerarchica.");
        await writeJson(path, unit);
    }
    {
        const { path, unit } = await readUnit("4.2.4.1.2.3");
        setMath(findBlock(unit, "dove la resistenza"), [{ value: "Mc,Rd", latex: "M_{c,Rd}" }], "Ripristinato il pedice della resistenza a flessione nella prosa.");
        setMath(findBlock(unit, "La resistenza di progetto"), [{ value: "Mc,Rd", latex: "M_{c,Rd}" }], "Ripristinato il pedice della resistenza a flessione nella prosa.");
        setMath(findBlock(unit, "per le sezioni di classe 3"), [{ value: "Wel,min", latex: "W_{el,min}" }, { value: "Weff,min", latex: "W_{eff,min}" }], "Ripristinati i pedici dei moduli resistenti efficaci.");
        setMath(findBlock(unit, "dove Af"), [{ value: "Af", latex: "A_f" }, { value: "Af,net", latex: "A_{f,net}" }, { value: "ftk", latex: "f_{tk}" }], "Ripristinati i simboli delle piattabande e della resistenza ultima.");
        await writeJson(path, unit);
    }
    {
        const { path, unit } = await readUnit("4.2.4.1.2.4");
        splitDefinitions(unit, "dove: A", [
            { raw: "A è l’area lorda della sezione del profilo,", normalized: "A è l’area lorda della sezione del profilo,", math: [{ value: "A", latex: "A" }] },
            { raw: "b è la larghezza delle ali per i profilati e la larghezza per le sezioni cave,", normalized: "b è la larghezza delle ali per i profilati e la larghezza per le sezioni cave,", math: [{ value: "b", latex: "b" }] },
            { raw: "hw è l’altezza dell’anima,", normalized: "hw è l’altezza dell’anima,", math: [{ value: "hw", latex: "h_w" }] },
            { raw: "h è l’altezza delle sezioni cave,", normalized: "h è l’altezza delle sezioni cave,", math: [{ value: "h", latex: "h" }] },
            { raw: "r è il raggio di raccordo tra anima ed ala,", normalized: "r è il raggio di raccordo tra anima ed ala,", math: [{ value: "r", latex: "r" }] },
            { raw: "tf è lo spessore delle ali,", normalized: "tf è lo spessore delle ali,", math: [{ value: "tf", latex: "t_f" }] },
            { raw: "tw è lo spessore dell’anima.", normalized: "tw è lo spessore dell’anima.", math: [{ value: "tw", latex: "t_w" }] },
        ], "Separate le sette definizioni geometriche stampate su righe distinte.");
        await writeJson(path, unit);
    }
    {
        const { path, unit } = await readUnit("4.2.4.1.2.6");
        setMath(findBlock(unit, "si può trascurare"), [{ value: "VEd", latex: "V_{Ed}" }, { value: "Vc,Rd", latex: "V_{c,Rd}" }], "Ripristinati i pedici delle azioni di taglio nella prosa.");
        await writeJson(path, unit);
    }
    {
        const { path, unit } = await readUnit("4.2.4.1.2.7");
        splitDefinitions(unit, "Mpl,y,Rd", [
            { raw: "Mpl,y,Rd il momento resistente plastico di progetto a flessione semplice nel piano dell’anima,", normalized: "Mpl,y,Rd il momento resistente plastico di progetto a flessione semplice nel piano dell’anima,", math: [{ value: "Mpl,y,Rd", latex: "M_{pl,y,Rd}" }] },
            { raw: "Mpl,z,Rd il momento resistente plastico di progetto a flessione semplice nel piano delle ali,", normalized: "Mpl,z,Rd il momento resistente plastico di progetto a flessione semplice nel piano delle ali,", math: [{ value: "Mpl,z,Rd", latex: "M_{pl,z,Rd}" }] },
        ], "Separate le due definizioni dei momenti plastici allineate nella fonte.");
        splitDefinitions(unit, "dove: A", [
            { raw: "A è l’area lorda della sezione,", normalized: "A è l’area lorda della sezione,", math: [{ value: "A", latex: "A" }] },
            { raw: "b è la larghezza delle ali,", normalized: "b è la larghezza delle ali,", math: [{ value: "b", latex: "b" }] },
            { raw: "tf è lo spessore delle ali.", normalized: "tf è lo spessore delle ali.", math: [{ value: "tf", latex: "t_f" }] },
        ], "Separate le tre definizioni geometriche allineate nella fonte.");
        await writeJson(path, unit);
    }
    {
        const { path, unit } = await readUnit("4.2.4.1.3.1");
        for (const prefix of ["NEd è", "Nb,Rd è"]) setNoMarker(findBlock(unit, prefix));
        splitDefinitions(unit, "l0 è", [
            { raw: "l0 è la lunghezza d’inflessione nel piano considerato,", normalized: "l0 è la lunghezza d’inflessione nel piano considerato,", math: [{ value: "l0", latex: "l_0" }] },
            { raw: "i è il raggio d’inerzia relativo.", normalized: "i è il raggio d’inerzia relativo.", math: [{ value: "i", latex: "i" }] },
        ], "Separate le due definizioni della snellezza stampate su righe distinte.");
        await writeJson(path, unit);
    }
}

function setCaption(table: Asset, label: string, description: string) {
    table.caption = `${label} – ${description}`;
    table.captionInline = [{ kind: "strong", value: label }, { kind: "em", value: ` – ${description}` }];
    assert(table.captionInline.map((segment: InlineSegment) => segment.value).join("") === table.caption, `Didascalia incoerente: ${label}`);
}

async function updateCaptions() {
    for (const [file, number, description] of [
        ["4.2-step4a.json", "4.2.VII", "Coefficienti di sicurezza per la resistenza delle membrature e la stabilità"],
        ["4.2-step4b.json", "4.2.VIII", "Curve d’instabilità per varie tipologie di sezioni e classi d’acciaio, per elementi compressi"],
    ] as const) {
        const path = join(assetDirectory, file);
        const manifest = JSON.parse(await readFile(path, "utf8")) as { tables: Asset[] };
        const table = manifest.tables.find((asset) => asset.officialNumber === number);
        assert(table, `Tabella assente: ${number}`);
        setCaption(table, `Tab. ${number}`, description);
        await writeJson(path, manifest);
    }
}

await updateHeadings();
await updateDefinitionsAndMath();
await updateCaptions();
console.log("ntc42-step2-editorial: corretti corsivi, definizioni allineate, matematica inline e didascalie delle pagine 100-107");
