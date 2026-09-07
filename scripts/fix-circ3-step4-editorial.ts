import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

type InlineKind = "text" | "em" | "underline" | "strong" | "math";
type InlineSegment = { kind: InlineKind; value: string; latex?: string };
type TextBlock = {
    blockId: string;
    kind: string;
    listMarker?: "bullet" | "dash" | "none";
    text?: { normalized: string; inline?: InlineSegment[] };
};
type Unit = {
    blocks: TextBlock[];
    workflow?: {
        openIssues: Array<{
            issueId: string;
            type: string;
            severity: string;
            note: string;
        }>;
    };
};
type Asset = { officialNumber: string; caption: string; captionInline?: InlineSegment[] };

const root = fileURLToPath(new URL("../", import.meta.url));
const unitDirectory = join(root, "corpus", "units", "circ2019");
const assetDirectory = join(root, "corpus", "assets", "circ2019");

function assert(condition: unknown, message: string): asserts condition {
    if (!condition) throw new Error(message);
}

function inline(block: TextBlock): InlineSegment[] {
    assert(block.text, `Blocco testuale mancante: ${block.blockId}`);
    return block.text.inline ?? [{ kind: "text", value: block.text.normalized }];
}

function setInline(block: TextBlock, segments: InlineSegment[]) {
    assert(block.text, `Blocco testuale mancante: ${block.blockId}`);
    assert(segments.map(({ value }) => value).join("") === block.text.normalized, `Inline incoerente: ${block.blockId}`);
    block.text.inline = segments;
}

function emphasize(block: TextBlock, target: string) {
    if (inline(block).some(({ kind, value }) => kind === "em" && value === target)) return;
    let count = 0;
    const result: InlineSegment[] = [];
    for (const segment of inline(block)) {
        if (segment.kind !== "text") {
            result.push(segment);
            continue;
        }
        const index = segment.value.indexOf(target);
        if (index === -1) {
            result.push(segment);
            continue;
        }
        const before = segment.value.slice(0, index);
        const after = segment.value.slice(index + target.length);
        if (before) result.push({ kind: "text", value: before });
        result.push({ kind: "em", value: target });
        if (after) result.push({ kind: "text", value: after });
        count += 1;
    }
    assert(count === 1, `Occorrenza inattesa di ${target}: ${count}`);
    setInline(block, result);
}

function underline(block: TextBlock, target: string) {
    if (inline(block).some(({ kind, value }) => kind === "underline" && value === target)) return;
    let count = 0;
    const result: InlineSegment[] = [];
    for (const segment of inline(block)) {
        if (segment.kind !== "text") {
            result.push(segment);
            continue;
        }
        const index = segment.value.indexOf(target);
        if (index === -1) {
            result.push(segment);
            continue;
        }
        const before = segment.value.slice(0, index);
        const after = segment.value.slice(index + target.length);
        if (before) result.push({ kind: "text", value: before });
        result.push({ kind: "underline", value: target });
        if (after) result.push({ kind: "text", value: after });
        count += 1;
    }
    assert(count === 1, `Occorrenza inattesa di ${target}: ${count}`);
    setInline(block, result);
}

async function readUnit(name: string) {
    const path = join(unitDirectory, `${name}.json`);
    return { path, unit: JSON.parse(await readFile(path, "utf8")) as Unit };
}

function blockStartingWith(unit: Unit, prefix: string) {
    const block = unit.blocks.find((candidate) => candidate.text?.normalized.startsWith(prefix));
    assert(block, `Blocco non trovato: ${prefix}`);
    return block;
}

async function setMarkers(name: string, markers: Array<"dash" | "none">) {
    const { path, unit } = await readUnit(name);
    const items = unit.blocks.filter(({ kind }) => kind === "list-item");
    assert(items.length === markers.length, `Numero di voci inatteso in ${name}`);
    items.forEach((item, index) => { item.listMarker = markers[index]; });
    await writeFile(path, `${JSON.stringify(unit, null, 2)}\n`, "utf8");
}

async function updateEmphasis() {
    {
        const { path, unit } = await readUnit("c3.4.3.3.2");
        emphasize(
            blockStartingWith(unit, "deposito della neve"),
            "“ombra aerodinamica”",
        );
        await writeFile(path, `${JSON.stringify(unit, null, 2)}\n`, "utf8");
    }
    {
        const { path, unit } = await readUnit("c3.4.3.3.4");
        emphasize(
            blockStartingWith(unit, "La presenza di sporgenze"),
            "“ombra aerodinamica”",
        );
        await writeFile(path, `${JSON.stringify(unit, null, 2)}\n`, "utf8");
    }
    {
        const { path, unit } = await readUnit("c3.6.1.1");
        const definition = blockStartingWith(unit, "la capacità di compartimentazione");
        emphasize(definition, "la capacità di compartimentazione");
        const load = blockStartingWith(unit, "il carico d’incendio");
        emphasize(load, "il carico d’incendio");
        emphasize(load, "carico d’incendio specifico");
        underline(load, "lorda");
        assert(unit.workflow, "Workflow mancante: c3.6.1.1");
        unit.workflow.openIssues = unit.workflow.openIssues.filter(
            ({ issueId }) => issueId !== "circ2019-c3-6-1-1-underline",
        );
        await writeFile(path, `${JSON.stringify(unit, null, 2)}\n`, "utf8");
    }
    {
        const { path, unit } = await readUnit("c3.6.1.5.1");
        const curves = blockStartingWith(unit, "Si evidenzia infine");
        emphasize(curves, "“slow heating curve”");
        emphasize(curves, "“tunnel curve”");
        await writeFile(path, `${JSON.stringify(unit, null, 2)}\n`, "utf8");
    }
}

function setCaption(asset: Asset, mathTerms: Array<[string, string]> = []) {
    const label = `Figura ${asset.officialNumber}`;
    assert(asset.caption.startsWith(label), `Etichetta inattesa: ${asset.officialNumber}`);
    const tail = asset.caption.slice(label.length);
    const inline: InlineSegment[] = [{ kind: "strong", value: label }];
    let cursor = 0;
    for (const [value, latex] of mathTerms) {
        const index = tail.indexOf(value, cursor);
        assert(index >= 0, `Simbolo ${value} assente: ${asset.officialNumber}`);
        if (index > cursor) inline.push({ kind: "em", value: tail.slice(cursor, index) });
        inline.push({ kind: "math", value, latex });
        cursor = index + value.length;
    }
    if (cursor < tail.length) inline.push({ kind: "em", value: tail.slice(cursor) });
    assert(inline.map(({ value }) => value).join("") === asset.caption, `Caption incoerente: ${asset.officialNumber}`);
    asset.captionInline = inline;
}

async function updateCaptions() {
    const figuresPath = join(assetDirectory, "core-figure-placeholders.json");
    const figuresManifest = JSON.parse(await readFile(figuresPath, "utf8")) as { figures: Asset[] };
    const figures = new Map(figuresManifest.figures.map((asset) => [asset.officialNumber, asset]));
    const updates: Array<[string, Array<[string, string]>]> = [
        ["C3.4.1", [["v = 0,6", "v = 0{,}6"]]],
        ["C3.4.2", []],
        ["C3.4.3", []],
        ["C3.4.4", []],
        ["C3.4.5", []],
        ["C3.4.6", []],
        ["C3.4.7", []],
    ];
    for (const [number, terms] of updates) {
        const figure = figures.get(number);
        assert(figure, `Figura assente: ${number}`);
        setCaption(figure, terms);
    }
    await writeFile(figuresPath, `${JSON.stringify(figuresManifest, null, 2)}\n`, "utf8");

    const tablesPath = join(assetDirectory, "core-tables.json");
    const tablesManifest = JSON.parse(await readFile(tablesPath, "utf8")) as { tables: Asset[] };
    const table = tablesManifest.tables.find(({ officialNumber }) => officialNumber === "C3.4.I");
    assert(table, "Tabella C3.4.I assente");
    const label = "Tabella C3.4.I";
    assert(table.caption.startsWith(label), "Etichetta inattesa: C3.4.I");
    table.captionInline = [
        { kind: "strong", value: label },
        { kind: "em", value: table.caption.slice(label.length) },
    ];
    await writeFile(tablesPath, `${JSON.stringify(tablesManifest, null, 2)}\n`, "utf8");
}

await setMarkers("c3.3.11", ["dash", "dash", "dash"]);
await setMarkers("c3.4.3", ["dash", "dash", "dash", "dash", "dash", "dash"]);
await setMarkers("c3.4.3.2", ["dash", "dash"]);
await setMarkers("c3.4.3.3.2", ["dash", "dash"]);
await setMarkers("c3.6.1.1", ["dash", "dash"]);
await setMarkers("c3.6.1.2", ["dash", "dash"]);
await setMarkers("c3.6.1.5.1", ["dash", "dash"]);
await updateEmphasis();
await updateCaptions();
