import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

type InlineSegment = {
    kind: "text" | "em" | "strong" | "math";
    value: string;
    latex?: string;
};

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
const profile = "ntc42-formatting-step1-0.1.0";

function assert(condition: unknown, message: string): asserts condition {
    if (!condition) throw new Error(message);
}

function sha256(value: string): string {
    return createHash("sha256").update(value).digest("hex");
}

function concatenate(inline: InlineSegment[]): string {
    return inline.map((segment) => segment.value).join("");
}

function recordTransformation(block: Block, note: string) {
    block.evidence.transformations ??= [];
    if (block.evidence.transformations.some((item: { ruleVersion?: string; note?: string }) => item.ruleVersion === profile && item.note === note)) return;
    block.evidence.transformations.push({
        operation: "manual-correction",
        ruleVersion: profile,
        note,
    });
}

function saveInline(block: Block, inline: InlineSegment[], note: string) {
    assert(concatenate(inline) === block.text.normalized, `Segmenti incoerenti: ${block.blockId}`);
    block.text.inline = inline;
    block.text.normalizationVersion = profile;
    recordTransformation(block, note);
    block.evidence.rawSha256 = sha256(block.text.raw);
    block.evidence.normalizedSha256 = sha256(block.text.normalized);
}

function emphasizePrefix(block: Block, prefix: string, note: string) {
    const source = block.text.inline as InlineSegment[];
    assert(concatenate(source) === block.text.normalized, `Inline iniziale incoerente: ${block.blockId}`);
    if (source[0]?.kind === "em" && source[0].value === prefix) return;
    const first = source[0];
    assert(first?.kind === "text" && first.value.startsWith(prefix), `Prefisso assente: ${prefix}`);
    const before = first.value.slice(0, prefix.length);
    const rest = first.value.slice(prefix.length);
    const inline: InlineSegment[] = [
        { kind: "em", value: before },
        ...(rest ? [{ kind: "text" as const, value: rest }] : []),
        ...source.slice(1),
    ];
    saveInline(block, inline, note);
}

function emphasizePhrase(block: Block, phrase: string, note: string) {
    const source = block.text.inline as InlineSegment[];
    if (source.some((segment) => segment.kind === "em" && segment.value === phrase)) return;
    const segmentIndex = source.findIndex((segment) => segment.kind === "text" && segment.value.includes(phrase));
    assert(segmentIndex >= 0, `Frase assente: ${phrase}`);
    const segment = source[segmentIndex];
    assert(segment, `Segmento assente: ${phrase}`);
    const index = segment.value.indexOf(phrase);
    const before = segment.value.slice(0, index);
    const after = segment.value.slice(index + phrase.length);
    saveInline(block, [
        ...source.slice(0, segmentIndex),
        ...(before ? [{ kind: "text" as const, value: before }] : []),
        { kind: "em", value: phrase },
        ...(after ? [{ kind: "text" as const, value: after }] : []),
        ...source.slice(segmentIndex + 1),
    ], note);
}

async function readUnit(number: string): Promise<{ path: string; unit: Unit }> {
    const path = join(unitDirectory, `${number}.json`);
    return { path, unit: JSON.parse(await readFile(path, "utf8")) as Unit };
}

async function writeJson(path: string, value: unknown) {
    await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function updateStateLimits() {
    const { path, unit } = await readUnit("4.2.2.1");
    const entries = [
        ["– stato limite di equilibrio", "stato limite di equilibrio"],
        ["– stato limite di collasso", "stato limite di collasso"],
        ["– stato limite di fatica", "stato limite di fatica"],
        ["– stati limite di deformazione e/o spostamento", "stati limite di deformazione e/o spostamento"],
        ["– stato limite di vibrazione", "stato limite di vibrazione"],
        ["– stato limite di plasticizzazioni locali", "stato limite di plasticizzazioni locali"],
        ["– stato limite di scorrimento dei collegamenti ad attrito con bulloni ad alta resistenza", "stato limite di scorrimento dei collegamenti ad attrito con bulloni ad alta resistenza"],
    ] as const;
    for (const [start, emphasis] of entries) {
        const block = unit.blocks.find((candidate: Block) => candidate.text?.normalized.startsWith(start));
        assert(block, `Voce non trovata: ${start}`);
        const source = block.text.inline as InlineSegment[];
        if (source[0]?.kind === "text" && source[0].value === "– " && source[1]?.kind === "em" && source[1].value === emphasis) continue;
        const onlySegment = source[0];
        assert(source.length === 1 && onlySegment?.kind === "text", `Voce inattesa: ${start}`);
        const marker = "– ";
        assert(onlySegment.value.startsWith(marker + emphasis), `Corsivo inatteso: ${start}`);
        saveInline(block, [
            { kind: "text", value: marker },
            { kind: "em", value: emphasis },
            { kind: "text", value: onlySegment.value.slice(marker.length + emphasis.length) },
        ], "Conservato il corsivo del nome dello stato limite nell’elenco ufficiale.");
    }
    await writeJson(path, unit);
}

async function updateAnalysisStyles() {
    {
        const { path, unit } = await readUnit("4.2.3.1");
        for (const label of ["classe 1", "classe 2", "classe 3", "classe 4"]) {
            const block = unit.blocks.find((candidate: Block) => candidate.text?.normalized.startsWith(label));
            assert(block, `Classe assente: ${label}`);
            emphasizePrefix(block, label, "Conservato il corsivo dell’etichetta della classe di sezione.");
        }
        const effective = unit.blocks.find((candidate: Block) => candidate.text?.normalized.includes("una sezione efficace."));
        assert(effective, "Frase sulla sezione efficace assente");
        emphasizePhrase(effective, "sezione efficace", "Conservato il corsivo del termine «sezione efficace».");
        await writeJson(path, unit);
    }

    for (const number of ["4.2.3.2", "4.2.3.3"]) {
        const { path, unit } = await readUnit(number);
        for (const block of unit.blocks.filter((candidate: Block) => candidate.text?.normalized.startsWith("Metodo "))) {
            emphasizePrefix(block, block.text.normalized, "Conservato il corsivo dell’intestazione del metodo di analisi.");
        }
        await writeJson(path, unit);
    }
}

function setCaption(table: Asset, label: string, description: string) {
    const caption = `${label} – ${description}`;
    table.caption = caption;
    table.captionInline = [
        { kind: "strong", value: label },
        { kind: "em", value: ` – ${description}` },
    ];
    assert(concatenate(table.captionInline) === table.caption, `Didascalia incoerente: ${label}`);
}

async function updateCaptions() {
    const paths = ["4.2-step1.json", "4.2-step3.json"];
    const manifests = await Promise.all(paths.map(async (name) => ({
        path: join(assetDirectory, name),
        value: JSON.parse(await readFile(join(assetDirectory, name), "utf8")) as { tables: Asset[] },
    })));
    const tables = new Map(manifests.flatMap(({ value }) => value.tables).map((table) => [table.officialNumber, table]));
    const captions = [
        ["4.2.I", "Laminati a caldo con profili a sezione aperta piani e lunghi"],
        ["4.2.II", "Laminati a caldo con profili a sezione cava"],
        ["4.2.III", "Massimi rapporti larghezza spessore per parti compresse"],
        ["4.2.IV", "Massimi rapporti larghezza spessore per parti compresse"],
        ["4.2.V", "Massimi rapporti larghezza spessore per parti compresse"],
        ["4.2.VI", "Metodi di analisi globali e relativi metodi di calcolo delle capacità e classi di sezioni ammesse"],
    ] as const;
    for (const [number, description] of captions) {
        const table = tables.get(number);
        assert(table, `Tabella assente: ${number}`);
        setCaption(table, `Tab. ${number}`, description);
    }
    await Promise.all(manifests.map(({ path, value }) => writeJson(path, value)));
}

await updateStateLimits();
await updateAnalysisStyles();
await updateCaptions();
console.log("ntc42-step1-editorial: conservati corsivi e didascalie delle pagine 95-100");
