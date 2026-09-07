import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

type InlineKind = "text" | "em" | "strong" | "math";
type InlineSegment = { kind: InlineKind; value: string; latex?: string };
type TextBlock = { kind: string; listMarker?: "bullet" | "dash" | "none" };
type Unit = { blocks: TextBlock[] };
type Asset = { officialNumber: string; caption: string; captionInline?: InlineSegment[] };

const root = fileURLToPath(new URL("../", import.meta.url));
const unitDirectory = join(root, "corpus", "units", "circ2019");
const assetDirectory = join(root, "corpus", "assets", "circ2019");

function assert(condition: unknown, message: string): asserts condition {
    if (!condition) throw new Error(message);
}

async function readUnit(name: string) {
    const path = join(unitDirectory, `${name}.json`);
    return { path, unit: JSON.parse(await readFile(path, "utf8")) as Unit };
}

async function updateListMarkers(name: string, markers: Array<"dash" | "none">) {
    const { path, unit } = await readUnit(name);
    const items = unit.blocks.filter(({ kind }) => kind === "list-item");
    assert(items.length === markers.length, `Numero di voci inatteso in ${name}`);
    items.forEach((item, index) => {
        item.listMarker = markers[index];
    });
    await writeFile(path, `${JSON.stringify(unit, null, 2)}\n`, "utf8");
}

function setCaption(asset: Asset, label: string, mathTerms: Array<[string, string]> = []) {
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

async function updateAssets() {
    const figuresPath = join(assetDirectory, "core-figure-placeholders.json");
    const figuresManifest = JSON.parse(await readFile(figuresPath, "utf8")) as { figures: Asset[] };
    const figures = new Map(figuresManifest.figures.map((asset) => [asset.officialNumber, asset]));
    const figureUpdates: Array<[string, Array<[string, string]>]> = [
        ["C3.3.15", []],
        ["C3.3.16", []],
        ["C3.3.17", []],
        ["C3.3.18", []],
        ["C3.3.19", []],
        ["C3.3.20", [["φ=0", "\\phi=0"], ["φ=1", "\\phi=1"]]],
        ["C3.3.21", []],
        ["C3.3.22", []],
        ["C3.3.23", []],
        ["C3.3.24", [["α>0°", "\\alpha>0^\\circ"], ["α<0°", "\\alpha<0^\\circ"]]],
        ["C3.3.25", []],
        ["C3.3.26", [["cpe0", "c_{pe0}"]]],
        ["C3.3.27", []],
        ["C3.3.28", []],
    ];
    for (const [number, terms] of figureUpdates) {
        const figure = figures.get(number);
        assert(figure, `Figura assente: ${number}`);
        setCaption(figure, `Figura ${number}`, terms);
    }
    await writeFile(figuresPath, `${JSON.stringify(figuresManifest, null, 2)}\n`, "utf8");

    const tablesPath = join(assetDirectory, "core-tables.json");
    const tablesManifest = JSON.parse(await readFile(tablesPath, "utf8")) as { tables: Asset[] };
    const tables = new Map(tablesManifest.tables.map((asset) => [asset.officialNumber, asset]));
    const tableUpdates: Array<[string, Array<[string, string]>]> = [
        ["C3.3.XIII", []],
        ["C3.3.XIV", []],
        ["C3.3.XV", [["α", "\\alpha"]]],
        ["C3.3.XVI", [["α", "\\alpha"]]],
        ["C3.3.XVII", [["α", "\\alpha"]]],
        [
            "C3.3.XVIII",
            [
                ["cpm", "c_{pm}"],
                ["cpb", "c_{pb}"],
                ["αm", "\\alpha_m"],
                ["αb", "\\alpha_b"],
                ["k/b ≤ 0,5·10⁻³", "\\frac{k}{b}\\le0{,}5\\cdot10^{-3}"],
            ],
        ],
        ["C3.3.XIX", []],
    ];
    for (const [number, terms] of tableUpdates) {
        const table = tables.get(number);
        assert(table, `Tabella assente: ${number}`);
        setCaption(table, `Tabella ${number}`, terms);
    }
    await writeFile(tablesPath, `${JSON.stringify(tablesManifest, null, 2)}\n`, "utf8");
}

await updateListMarkers("c3.3.8.1.6", ["dash", "dash", "dash", "dash"]);
await updateListMarkers("c3.3.8.1.7", ["dash", "dash", "dash", "dash", "dash"]);
await updateListMarkers("c3.3.8.2", ["dash", "dash"]);
await updateListMarkers("c3.3.8.3", ["dash", "dash", "none", "none"]);
await updateAssets();
