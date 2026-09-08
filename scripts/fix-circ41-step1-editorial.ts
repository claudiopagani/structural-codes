import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

type InlineKind = "text" | "em-underline" | "strong" | "em" | "math";
type InlineSegment = { kind: InlineKind; value: string; latex?: string };
type MathSpec = { value: string; latex: string };
// I record canonici hanno blocchi e evidence eterogenei.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Unit = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Block = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Asset = any;

const root = fileURLToPath(new URL("../", import.meta.url));
const unitDirectory = join(root, "corpus", "units", "circ2019");
const assetDirectory = join(root, "corpus", "assets", "circ2019");
const profile = "circ41-step1-editorial-0.1.0";

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
        block.evidence.transformations.push({
            operation: "manual-correction",
            ruleVersion: profile,
            note,
        });
    }
}

function setText(
    block: Block,
    normalized: string,
    math: MathSpec[],
    note: string,
    raw = block.text.raw,
) {
    block.text.raw = raw;
    block.text.normalized = normalized;
    block.text.inline = inline(normalized, math);
    block.text.normalizationVersion = profile;
    recordTransformation(block, note);
    block.evidence.rawSha256 = sha256(raw);
    block.evidence.normalizedSha256 = sha256(normalized);
}

async function readUnit(id: string): Promise<{ path: string; unit: Unit }> {
    const path = join(unitDirectory, `${id}.json`);
    return { path, unit: JSON.parse(await readFile(path, "utf8")) as Unit };
}

function textBlock(unit: Unit, prefixes: string | string[]): Block {
    const accepted = Array.isArray(prefixes) ? prefixes : [prefixes];
    const block = unit.blocks.find((candidate: Block) => accepted.some((prefix) => candidate.text?.normalized.startsWith(prefix)));
    assert(block, `Blocco non trovato: ${accepted.join(" | ")}`);
    return block;
}

async function save(path: string, unit: Unit) {
    await writeFile(path, `${JSON.stringify(unit, null, 2)}\n`, "utf8");
}

function splitLabelBlock(
    unit: Unit,
    prefix: string | string[],
    lines: Array<{ raw: string; normalized: string; math: MathSpec[] }>,
    note: string,
) {
    const source = textBlock(unit, prefix);
    if (unit.blocks.some((block: Block) => block.blockId === `${source.blockId}-2`)) return;
    const start = unit.blocks.indexOf(source);
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

async function updateUnits() {
    {
        const { path, unit } = await readUnit("c4.1");
        const block = textBlock(unit, "Il coefficiente parziale di sicurezza per l’acciaio");
        setText(
            block,
            "Il coefficiente parziale di sicurezza per l’acciaio da armatura γs rimane, per tutti i tipi, pari a 1,15.",
            [
                { value: "γs", latex: "\\gamma_s" },
                { value: "1,15", latex: "1{,}15" },
            ],
            "Ripristinati il simbolo gamma_s e il valore del coefficiente di sicurezza dall’evidence visiva.",
        );
        await save(path, unit);
    }

    {
        const { path, unit } = await readUnit("c4.1.1.1");
        const items = unit.blocks.filter((block: Block) => block.kind === "list-item");
        assert(items.length === 5, "Numero inatteso di voci in C4.1.1.1");
        items.forEach((block: Block) => { block.listMarker = "dash"; });
        await save(path, unit);
    }

    {
        const { path, unit } = await readUnit("c4.1.2.2.4.5");
        for (const heading of [
            "Calcolo dell’ampiezza delle fessure",
            "Verifica della fessurazione senza calcolo diretto",
        ]) {
            const block = textBlock(unit, heading);
            block.text.inline = [{ kind: "em-underline", value: block.text.normalized }];
            block.text.normalizationVersion = profile;
            recordTransformation(block, "Conservati insieme corsivo e sottolineatura del sottotitolo non numerato.");
            block.evidence.rawSha256 = sha256(block.text.raw);
            block.evidence.normalizedSha256 = sha256(block.text.normalized);
        }

        splitLabelBlock(unit, "εsm è la deformazione unitaria", [
            {
                raw: "sm è la deformazione unitaria media delle barre d’armatura;",
                normalized: "εsm è la deformazione unitaria media delle barre d’armatura;",
                math: [{ value: "εsm", latex: "\\varepsilon_{sm}" }],
            },
            {
                raw: "0sm è la distanza media tra le fessure.",
                normalized: "Δsm è la distanza media tra le fessure.",
                math: [{ value: "Δsm", latex: "\\Delta_{sm}" }],
            },
        ], "Separate le due definizioni allineate dopo «dove» sulla base del PDF renderizzato.");

        splitLabelBlock(unit, ["σs è la tensione nell'armatura", "σs è la tensione nell’armatura"], [
            {
                raw: "s è la tensione nell’armatura tesa considerando la sezione fessurata;",
                normalized: "σs è la tensione nell’armatura tesa considerando la sezione fessurata;",
                math: [{ value: "σs", latex: "\\sigma_s" }],
            },
            {
                raw: "\u000fe è il rapporto Es/Ecm;",
                normalized: "αe è il rapporto Es/Ecm;",
                math: [
                    { value: "αe", latex: "\\alpha_e" },
                    { value: "Es/Ecm", latex: "E_s/E_{cm}" },
                ],
            },
            {
                raw: "\u0012eff è pari a \u0017 \u0015\u0011\u0007--",
                normalized: "ρeff è pari a As/Ac,eff;",
                math: [
                    { value: "ρeff", latex: "\\rho_{eff}" },
                    { value: "As/Ac,eff", latex: "A_s/A_{c,eff}" },
                ],
            },
            {
                raw: "\u0012eff è pari a \u0017 \u0015\u0011\u0007--",
                normalized: "Ac,eff è l’area efficace di calcestruzzo teso attorno all’armatura, di altezza hc,eff, dove hc,eff è il valore minore tra 2,5 (h–d), (h–x)/3 o h/2 (vedere Figura C4.1.10); nel caso di elementi in trazione, in cui esistono due aree efficaci, l’una all’estradosso e l’altra all’intradosso, entrambe le aree vanno considerate separatamente;",
                math: [
                    { value: "Ac,eff", latex: "A_{c,eff}" },
                    { value: "hc,eff", latex: "h_{c,eff}" },
                    { value: "hc,eff", latex: "h_{c,eff}" },
                    { value: "2,5 (h–d)", latex: "2{,}5(h-d)" },
                    { value: "(h–x)/3", latex: "\\frac{h-x}{3}" },
                    { value: "h/2", latex: "\\frac{h}{2}" },
                ],
            },
            {
                raw: "kt è un fattore dipendente dalla durata del carico e vale:",
                normalized: "kt è un fattore dipendente dalla durata del carico e vale:",
                math: [{ value: "kt", latex: "k_t" }],
            },
        ], "Separate le cinque definizioni allineate dopo «in cui» e ripristinati i simboli dal render ufficiale.");

        splitLabelBlock(unit, "kt = 0,6 per carichi", [
            {
                raw: "kt = 0,6 per carichi di breve durata,",
                normalized: "kt = 0,6 per carichi di breve durata,",
                math: [{ value: "kt = 0,6", latex: "k_t=0{,}6" }],
            },
            {
                raw: "kt = 0,4 per carichi di lunga durata. \u0002",
                normalized: "kt = 0,4 per carichi di lunga durata.",
                math: [{ value: "kt = 0,4", latex: "k_t=0{,}4" }],
            },
        ], "Separate le due righe del coefficiente k_t secondo il PDF.");

        const diameter = textBlock(unit, "φ è il diametro delle barre");
        diameter.kind = "list-item";
        diameter.listMarker = "none";
        setText(
            diameter,
            "φ è il diametro delle barre. Se nella sezione considerata sono impiegate barre di diametro diverso, si raccomanda di adottare un opportuno diametro equivalente, φeq. Se n1 è il numero di barre di diametro φ1 ed n2 è il numero di barre di diametro φ2, si raccomanda di utilizzare l’espressione seguente:",
            [
                { value: "φ", latex: "\\phi" },
                { value: "φeq", latex: "\\phi_{eq}" },
                { value: "n1", latex: "n_1" },
                { value: "φ1", latex: "\\phi_1" },
                { value: "n2", latex: "n_2" },
                { value: "φ2", latex: "\\phi_2" },
            ],
            "Ripristinati i simboli e la definizione completa del diametro equivalente dal render ufficiale.",
        );

        splitLabelBlock(unit, ["c è il ricoprimento dell'armatura", "c è il ricoprimento dell’armatura"], [
            {
                raw: "c è il ricoprimento dell’armatura;",
                normalized: "c è il ricoprimento dell’armatura;",
                math: [{ value: "c", latex: "c" }],
            },
            {
                raw: "k 1 = 0,8 per barre ad aderenza migliorata,\nk 1 = 1,6 per barre lisce;",
                normalized: "k1 = 0,8 per barre ad aderenza migliorata, k1 = 1,6 per barre lisce;",
                math: [
                    { value: "k1 = 0,8", latex: "k_1=0{,}8" },
                    { value: "k1 = 1,6", latex: "k_1=1{,}6" },
                ],
            },
            {
                raw: "k 2 = 0,5 nel caso di flessione,\nk 2 = 1,0 nel caso di trazione semplice.",
                normalized: "k2 = 0,5 nel caso di flessione, k2 = 1,0 nel caso di trazione semplice.",
                math: [
                    { value: "k2 = 0,5", latex: "k_2=0{,}5" },
                    { value: "k2 = 1,0", latex: "k_2=1{,}0" },
                ],
            },
        ], "Separate le definizioni allineate dei coefficienti c, k_1 e k_2.");

        const strains = textBlock(unit, ["ε1 ed ε2 sono, rispettivamente", "in cui ε1 ed ε2 sono rispettivamente"]);
        setText(
            strains,
            "in cui ε1 ed ε2 sono rispettivamente la più grande e la più piccola deformazione di trazione alle estremità della sezione considerata, calcolate considerando la sezione fessurata.",
            [
                { value: "ε1", latex: "\\varepsilon_1" },
                { value: "ε2", latex: "\\varepsilon_2" },
            ],
            "Ripristinata l’introduzione e i pedici della definizione delle deformazioni epsilon_1 ed epsilon_2.",
        );

        splitLabelBlock(unit, ["k3 = 3,4;", "k3 = 3,4"], [
            {
                raw: "k 3 = 3,4",
                normalized: "k3 = 3,4",
                math: [{ value: "k3 = 3,4", latex: "k_3=3{,}4" }],
            },
            {
                raw: "k 4 = 0,425.",
                normalized: "k4 = 0,425.",
                math: [{ value: "k4 = 0,425", latex: "k_4=0{,}425" }],
            },
        ], "Separate le due righe dei coefficienti k_3 e k_4.");

        const spacing = textBlock(unit, ["Quando la spaziatura delle armature", "Nei casi in cui l’armatura sia disposta"]);
        setText(
            spacing,
            "Nei casi in cui l’armatura sia disposta con una spaziatura non superiore a 5(c + φ/2) (vedi Figura C4.1.11), la distanza media tra le fessure, Δsm, può essere valutata con l’espressione:",
            [
                { value: "5(c + φ/2)", latex: "5\\left(c+\\frac{\\phi}{2}\\right)" },
                { value: "Δsm", latex: "\\Delta_{sm}" },
            ],
            "Ripristinati l’incipit, il simbolo Delta_sm e la formula inline della distanza fra fessure.",
        );

        const wideSpacing = textBlock(unit, ["Nelle zone in cui la spaziatura supera", "Nelle zone in cui l’armatura è disposta"]);
        setText(
            wideSpacing,
            "Nelle zone in cui l’armatura è disposta con una spaziatura superiore a 5(c + φ/2) (vedi Figura C4.1.11), per la parte di estensione 5(c + φ/2) nell’intorno delle barre la distanza media tra le fessure, Δsm, può essere valutata ancora con l’espressione C4.1.7:",
            [
                { value: "5(c + φ/2)", latex: "5\\left(c+\\frac{\\phi}{2}\\right)" },
                { value: "5(c + φ/2)", latex: "5\\left(c+\\frac{\\phi}{2}\\right)" },
                { value: "Δsm", latex: "\\Delta_{sm}" },
            ],
            "Ripristinati il riferimento alle barre e il simbolo Delta_sm nel passaggio alla seconda zona.",
        );

        splitLabelBlock(unit, ["h ed x sono definiti", "h ed x sono definite"], [
            {
                raw: "h ed x sono definite in Figura C4.1.10;",
                normalized: "h ed x sono definite in Figura C4.1.10;",
                math: [
                    { value: "h", latex: "h" },
                    { value: "x", latex: "x" },
                ],
            },
            {
                raw: "(h – x) è la distanza tra l’asse neutro ed il lembo teso della membratura.",
                normalized: "(h – x) è la distanza tra l’asse neutro ed il lembo teso della membratura.",
                math: [{ value: "h – x", latex: "h-x" }],
            },
        ], "Separate le definizioni finali di h, x e della loro differenza.");

        await save(path, unit);
    }
}

function setCaption(asset: Asset, label: string, math: MathSpec[] = []) {
    assert(asset.caption.startsWith(label), `Didascalia inattesa: ${asset.officialNumber}`);
    const tail = asset.caption.slice(label.length);
    asset.captionInline = [{ kind: "strong", value: label }, ...inline(tail, math).map((segment) => segment.kind === "text" ? { ...segment, kind: "em" as const } : segment)];
    assert(asset.captionInline.map((segment: InlineSegment) => segment.value).join("") === asset.caption, `Didascalia incoerente: ${asset.officialNumber}`);
}

async function updateCaptions() {
    const figuresPath = join(assetDirectory, "core-figure-placeholders.json");
    const figuresManifest = JSON.parse(await readFile(figuresPath, "utf8")) as { figures: Asset[] };
    const figures = new Map(figuresManifest.figures.map((figure) => [figure.officialNumber, figure]));
    for (let index = 1; index <= 11; index += 1) {
        const number = `C4.1.${index}`;
        const figure = figures.get(number);
        assert(figure, `Figura assente: ${number}`);
        setCaption(figure, `Figura ${number}`, number === "C4.1.11" ? [{ value: "w", latex: "w" }] : []);
    }
    await writeFile(figuresPath, `${JSON.stringify(figuresManifest, null, 2)}\n`, "utf8");

    const tablesPath = join(assetDirectory, "core-tables.json");
    const tablesManifest = JSON.parse(await readFile(tablesPath, "utf8")) as { tables: Asset[] };
    for (const number of ["C4.1.I", "C4.1.II", "C4.1.III"]) {
        const table = tablesManifest.tables.find((asset) => asset.officialNumber === number);
        assert(table, `Tabella assente: ${number}`);
        setCaption(
            table,
            `Tabella ${number}`,
            number === "C4.1.I"
                ? [
                    { value: "K", latex: "K" },
                    { value: "l/h", latex: "\\frac{l}{h}" },
                ]
                : [],
        );
    }
    await writeFile(tablesPath, `${JSON.stringify(tablesManifest, null, 2)}\n`, "utf8");
}

await updateUnits();
await updateCaptions();
console.log("circ41-step1-editorial: corretti struttura, stili e formule inline delle pagine 85-93");
