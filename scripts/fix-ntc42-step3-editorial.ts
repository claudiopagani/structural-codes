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
const profile = "ntc42-formatting-step3-0.1.0";

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

function setMath(block: Block, math: MathSpec[], note: string) {
    saveText(block, block.text.raw, block.text.normalized, inline(block.text.normalized, math), note);
}

function italicHeading(block: Block, title: string, note: string) {
    const prefix = block.text.normalized.slice(0, -title.length);
    assert(block.text.normalized.endsWith(title), `Titolo inatteso: ${title}`);
    saveText(block, block.text.raw, block.text.normalized, [
        ...(prefix ? [{ kind: "text" as const, value: prefix }] : []),
        { kind: "em", value: title },
    ], note);
}

function splitWithIntro(unit: Unit, prefix: string, intro: string, definitions: Definition[], note: string) {
    if (unit.blocks.some((block: Block) => block.blockId.includes("-definition-"))) return;
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

function setFigureCaption(figure: Asset, label: string, description: string) {
    figure.caption = `${label}${description}`;
    figure.captionInline = [{ kind: "strong", value: label }, { kind: "em", value: description }];
}

async function updateHeadingsAndDefinitions() {
    for (const [number, title] of [
        ["4.2.4.1.3.2", "Travi inflesse"],
        ["4.2.4.1.3.3", "Membrature inflesse e compresse"],
        ["4.2.4.1.3.4", "Stabilità dei pannelli"],
        ["4.2.4.2.3.2", "Strutture di elevata flessibilità e soggette a carichi ciclici"],
        ["4.2.4.2.3.3", "Oscillazioni prodotte dal vento"],
    ] as const) {
        const { path, unit } = await readUnit(number);
        italicHeading(unit.blocks.find((block: Block) => block.kind === "heading"), title, "Conservato il corsivo del titolo di sottolivello.");
        await writeJson(path, unit);
    }

    {
        const { path, unit } = await readUnit("4.2.4.1.3.2");
        splitWithIntro(unit, "dove: MEd", "dove:", [
            { raw: "MEd è il massimo momento flettente di progetto", normalized: "MEd è il massimo momento flettente di progetto", math: [{ value: "MEd", latex: "M_{Ed}" }] },
            { raw: "Mb,Rd è il momento resistente di progetto per l’instabilità.", normalized: "Mb,Rd è il momento resistente di progetto per l’instabilità.", math: [{ value: "Mb,Rd", latex: "M_{b,Rd}" }] },
        ], "Separate le due definizioni allineate della trave inflessa.");
        splitWithIntro(unit, "dove Wy", "dove", [
            { raw: "Wy è il modulo resistente della sezione, pari al modulo plastico Wpl,y, per le sezioni di classe 1 e 2, al modulo elastico Wel,y per le sezioni di classe 3 e che può essere assunto pari al modulo efficace Weff,y per le sezioni di classe 4.", normalized: "Wy è il modulo resistente della sezione, pari al modulo plastico Wpl,y, per le sezioni di classe 1 e 2, al modulo elastico Wel,y per le sezioni di classe 3 e che può essere assunto pari al modulo efficace Weff,y per le sezioni di classe 4.", math: [{ value: "Wy", latex: "W_y" }, { value: "Wpl,y", latex: "W_{pl,y}" }, { value: "Wel,y", latex: "W_{el,y}" }, { value: "Weff,y", latex: "W_{eff,y}" }] },
        ], "Separata la definizione di modulo resistente introdotta da «dove».");
        await writeJson(path, unit);
    }

    {
        const { path, unit } = await readUnit("4.2.4.1.4");
        italicHeading(findBlock(unit, "Verifica a vita illimitata."), "Verifica a vita illimitata.", "Conservato il corsivo del sottotitolo di verifica a vita illimitata.");
        italicHeading(findBlock(unit, "Verifica a danneggiamento"), "Verifica a danneggiamento", "Conservato il corsivo del sottotitolo di verifica a danneggiamento.");
        for (const prefix of ["Δd l’escursione", "ΔR la resistenza", "γMf il coefficiente"]) setNoMarker(findBlock(unit, prefix));
        await writeJson(path, unit);
    }

    {
        const { path, unit } = await readUnit("4.2.4.2.1");
        splitWithIntro(unit, "essendo: δC", "essendo:", [
            { raw: "δC la monta iniziale della trave,", normalized: "δC la monta iniziale della trave,", math: [{ value: "δC", latex: "\\delta_C" }] },
            { raw: "δ1 lo spostamento elastico dovuto ai carichi permanenti,", normalized: "δ1 lo spostamento elastico dovuto ai carichi permanenti,", math: [{ value: "δ1", latex: "\\delta_1" }] },
            { raw: "δ2 lo spostamento elastico dovuto ai carichi variabili,", normalized: "δ2 lo spostamento elastico dovuto ai carichi variabili,", math: [{ value: "δ2", latex: "\\delta_2" }] },
            { raw: "δmax lo spostamento nello stato finale, depurato della monta iniziale = δtot − δC.", normalized: "δmax lo spostamento nello stato finale, depurato della monta iniziale = δtot − δC.", math: [{ value: "δmax", latex: "\\delta_{max}" }, { value: "δtot − δC", latex: "\\delta_{tot}-\\delta_C" }] },
        ], "Separate le definizioni allineate degli spostamenti verticali.");
        for (const [prefix, math] of [
            ["δC la monta", [{ value: "δC", latex: "\\delta_C" }]],
            ["δ1 lo spostamento", [{ value: "δ1", latex: "\\delta_1" }]],
            ["δ2 lo spostamento", [{ value: "δ2", latex: "\\delta_2" }]],
            ["δmax lo spostamento", [{ value: "δmax", latex: "\\delta_{max}" }, { value: "δtot − δC", latex: "\\delta_{tot}-\\delta_C" }]],
        ] as const) setMath(findBlock(unit, prefix), [...math], "Resi espliciti i simboli delle definizioni di spostamento.");
        await writeJson(path, unit);
    }

    {
        const { path, unit } = await readUnit("4.2.4.2.2");
        setMath(findBlock(unit, "In assenza di più precise"), [{ value: "Δ", latex: "\\Delta" }, { value: "δ", latex: "\\delta" }], "Resi espliciti gli spostamenti orizzontali nella prosa.");
        await writeJson(path, unit);
    }

    {
        const { path, unit } = await readUnit("4.2.8");
        for (const prefix of ["– le azioni così", "– le deformazioni derivanti"]) {
            const block = findBlock(unit, prefix);
            block.kind = "list-item";
        }
        await writeJson(path, unit);
    }
}

async function updateCaptions() {
    {
        const path = join(assetDirectory, "4.2-step4b.json");
        const manifest = JSON.parse(await readFile(path, "utf8")) as { tables: Asset[] };
        const tableA = manifest.tables.find((asset) => asset.officialNumber === "4.2.IX (a)");
        const tableB = manifest.tables.find((asset) => asset.officialNumber === "4.2.IX (b)");
        assert(tableA && tableB, "Tabelle 4.2.IX assenti");
        setTableCaption(tableA, "Tab. 4.2.IX (a)", [
            { kind: "em", value: " Valori raccomandati di " },
            { kind: "math", value: "αLT", latex: "\\alpha_{LT}" },
            { kind: "em", value: " per le differenti curve di stabilità." },
        ]);
        setTableCaption(tableB, "Tab. 4.2.IX (b)", [{ kind: "em", value: " - Definizione delle curve di stabilità per le varie tipologie di sezione e per gli elementi inflessi" }]);
        await writeJson(path, manifest);
    }

    {
        const path = join(assetDirectory, "4.2-step4c.json");
        const manifest = JSON.parse(await readFile(path, "utf8")) as { tables: Asset[] };
        for (const [number, description] of [
            ["4.2.X", " - Coefficiente correttivo del momento flettente per la verifica a stabilità delle travi inflesse"],
            ["4.2.XI", " - Coefficienti di sicurezza da assumere per le verifiche a fatica."],
        ] as const) {
            const table = manifest.tables.find((asset) => asset.officialNumber === number);
            assert(table, `Tabella assente: ${number}`);
            setTableCaption(table, `Tab. ${number}`, [{ kind: "em", value: description }]);
        }
        await writeJson(path, manifest);
    }

    {
        const path = join(assetDirectory, "4.2-step4d.json");
        const manifest = JSON.parse(await readFile(path, "utf8")) as { tables: Asset[]; figures: Asset[] };
        for (const [number, description] of [
            ["4.2.XII", " - Limiti di deformabilità per gli elementi di impalcato delle costruzioni ordinarie"],
            ["4.2.XIII", " - Limiti di deformabilità per costruzioni ordinarie soggette ad azioni orizzontali"],
        ] as const) {
            const table = manifest.tables.find((asset) => asset.officialNumber === number);
            assert(table, `Tabella assente: ${number}`);
            setTableCaption(table, `Tab. ${number}`, [{ kind: "em", value: description }]);
        }
        const figure3 = manifest.figures.find((asset) => asset.officialNumber === "4.2.3");
        const figure4 = manifest.figures.find((asset) => asset.officialNumber === "4.2.4");
        assert(figure3 && figure4, "Figure 4.2.3-4 assenti");
        setFigureCaption(figure3, "Fig. 4.2.3", " -Definizione degli spostamenti verticali per le verifiche in esercizio");
        setFigureCaption(figure4, "Fig. 4.2.4", " - Definizione degli spostamenti orizzontali per le verifiche in esercizio");
        await writeJson(path, manifest);
    }

    {
        const path = join(assetDirectory, "4.2-step5.json");
        const manifest = JSON.parse(await readFile(path, "utf8")) as { tables: Asset[] };
        const table = manifest.tables.find((asset) => asset.officialNumber === "4.2.XIV");
        assert(table, "Tabella 4.2.XIV assente");
        setTableCaption(table, "Tab. 4.2.XIV", [{ kind: "em", value: " - Coefficienti di sicurezza per la verifica delle unioni." }]);
        await writeJson(path, manifest);
    }
}

await updateHeadingsAndDefinitions();
await updateCaptions();
console.log("ntc42-step3-editorial: corretti titoli, definizioni, elenchi e didascalie delle pagine 107-112");
