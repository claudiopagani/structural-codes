import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

type InlineKind = "text" | "em" | "strong" | "math";
type InlineSegment = { kind: InlineKind; value: string; latex?: string };
type TextBlock = {
    blockId: string;
    kind: string;
    listMarker?: "bullet" | "dash" | "none";
    text?: { normalized: string; inline?: InlineSegment[] };
};
type Unit = { blocks: TextBlock[] };
type CaptionAsset = {
    officialNumber: string;
    caption: string;
    captionInline?: InlineSegment[];
};

const root = fileURLToPath(new URL("../", import.meta.url));
const units = join(root, "corpus", "units", "circ2019");
const assets = join(root, "corpus", "assets", "circ2019");

function assert(condition: unknown, message: string): asserts condition {
    if (!condition) throw new Error(message);
}

function currentInline(block: TextBlock): InlineSegment[] {
    assert(block.text, `Blocco testuale mancante: ${block.blockId}`);
    return block.text.inline ?? [{ kind: "text", value: block.text.normalized }];
}

function setInline(block: TextBlock, inline: InlineSegment[]) {
    assert(block.text, `Blocco testuale mancante: ${block.blockId}`);
    assert(
        inline.map(({ value }) => value).join("") === block.text.normalized,
        `Inline non allineato al testo normalizzato: ${block.blockId}`,
    );
    block.text.inline = inline;
}

function replace(
    block: TextBlock,
    target: string,
    replacement: InlineSegment,
    expectedCount = 1,
) {
    const alreadyPresent = currentInline(block).filter(
        // Le unità C3.3 già contengono molte formule inline verificate: una
        // variante LaTeX equivalente non va sovrascritta durante il passaggio
        // tipografico.
        (segment) => segment.kind === replacement.kind && segment.value === replacement.value,
    ).length;
    if (alreadyPresent === expectedCount) return;
    assert(alreadyPresent === 0, `Formattazione inattesa: ${target} (${block.blockId})`);

    let replaced = 0;
    const updated: InlineSegment[] = [];
    for (const segment of currentInline(block)) {
        if (segment.kind !== "text") {
            updated.push(segment);
            continue;
        }
        let cursor = 0;
        while (cursor < segment.value.length) {
            const index = segment.value.indexOf(target, cursor);
            if (index === -1 || replaced === expectedCount) {
                const tail = segment.value.slice(cursor);
                if (tail) updated.push({ kind: "text", value: tail });
                break;
            }
            const prefix = segment.value.slice(cursor, index);
            if (prefix) updated.push({ kind: "text", value: prefix });
            updated.push(replacement);
            replaced += 1;
            cursor = index + target.length;
        }
    }
    assert(replaced === expectedCount, `Occorrenze inattese: ${target} (${replaced}/${expectedCount})`);
    setInline(block, updated);
}

function math(block: TextBlock, value: string, latex: string, expectedCount = 1) {
    replace(block, value, { kind: "math", value, latex }, expectedCount);
}

function emphasize(block: TextBlock, value: string) {
    replace(block, value, { kind: "em", value });
}

function blockStartingWith(unit: Unit, prefix: string) {
    const block = unit.blocks.find((candidate) => candidate.text?.normalized.startsWith(prefix));
    assert(block, `Blocco non trovato: ${prefix}`);
    return block;
}

async function readUnit(name: string) {
    const path = join(units, `${name}.json`);
    return { path, unit: JSON.parse(await readFile(path, "utf8")) as Unit };
}

async function writeUnit(path: string, unit: Unit) {
    await writeFile(path, `${JSON.stringify(unit, null, 2)}\n`, "utf8");
}

async function updateUnits() {
    {
        const { path, unit } = await readUnit("c3.3.2");
        math(blockStartingWith(unit, "In questo paragrafo"), "vb(TR)", "v_b(T_R)");
        const definition = blockStartingWith(unit, "vb è la velocità");
        math(definition, "vb", "v_b");
        math(definition, "αR", "\\alpha_R");
        math(blockStartingWith(unit, "dove TR è"), "TR", "T_R");
        math(blockStartingWith(unit, "La formula C3.3.2"), "TR", "T_R");
        await writeUnit(path, unit);
    }

    {
        const { path, unit } = await readUnit("c3.3.4");
        math(blockStartingWith(unit, "Le espressioni 3.3.2"), "cp", "c_p");
        await writeUnit(path, unit);
    }

    {
        const { path, unit } = await readUnit("c3.3.8");
        const global = blockStartingWith(unit, "coefficienti globali");
        global.listMarker = "dash";
        math(global, "cpe", "c_{pe}");

        const local10 = blockStartingWith(unit, "coefficienti locali cpe,10");
        local10.listMarker = "dash";
        math(local10, "cpe,10", "c_{pe,10}");
        math(local10, "cpe", "c_{pe}");

        const local1 = blockStartingWith(unit, "coefficienti locali cpe,1,");
        local1.listMarker = "dash";
        math(local1, "cpe,1", "c_{pe,1}");

        math(blockStartingWith(unit, "A è l’area"), "A", "A");
        await writeUnit(path, unit);
    }

    {
        const { path, unit } = await readUnit("c3.3.8.1.1");
        math(blockStartingWith(unit, "I coefficienti globali"), "cpe", "c_{pe}");
        const local = blockStartingWith(unit, "I coefficienti locali cpe,10");
        math(local, "cpe,10", "c_{pe,10}");
        math(local, "cpe,1", "c_{pe,1}");
        await writeUnit(path, unit);
    }

    {
        const { path, unit } = await readUnit("c3.3.8.1.1.1");
        emphasize(blockStartingWith(unit, "C3.3.8.1.1.1"), "Altezza di riferimento per la faccia sopravento");
        // Le espressioni z̄e, h, b e d del capoverso sono già segmentate come
        // matematica inline nel record canonico; qui si interviene solo sugli
        // elenchi e sull'enfasi visibile nel PDF.
        for (const block of unit.blocks.filter(({ kind }) => kind === "list-item")) block.listMarker = "none";
        await writeUnit(path, unit);
    }

    {
        const { path, unit } = await readUnit("c3.3.8.1.1.2");
        emphasize(blockStartingWith(unit, "C3.3.8.1.1.2"), "Altezza di riferimento per le facce sottovento e laterali");
        await writeUnit(path, unit);
    }

    {
        const { path, unit } = await readUnit("c3.3.8.1.2");
        const global = blockStartingWith(unit, "Si considerano piane");
        math(global, "−5°", "-5^\\circ");
        math(global, "+5°", "+5^\\circ");
        math(global, "z̄e", "\\bar z_e");
        math(global, "cpe", "c_{pe}");
        const local = blockStartingWith(unit, "I coefficienti locali cpe,10");
        math(local, "cpe,10", "c_{pe,10}");
        math(local, "cpe,1", "c_{pe,1}");
        await writeUnit(path, unit);
    }

    {
        const { path, unit } = await readUnit("c3.3.8.1.3");
        const global = blockStartingWith(unit, "L’altezza di riferimento");
        math(global, "z̄e", "\\bar z_e");
        math(global, "−5° ≤ α ≤ +5°", "-5^\\circ \\le \\alpha \\le +5^\\circ");
        math(global, "5° ≤ α ≤ 45°", "5^\\circ \\le \\alpha \\le 45^\\circ");
        const local = blockStartingWith(unit, "I coefficienti locali cpe,10");
        math(local, "cpe,10", "c_{pe,10}");
        math(local, "cpe,1", "c_{pe,1}");
        await writeUnit(path, unit);
    }

    {
        const { path, unit } = await readUnit("c3.3.8.1.4");
        const first = blockStartingWith(unit, "L’altezza di riferimento");
        math(first, "z̄e", "\\bar z_e");
        math(first, "−5° ≤ α ≤ +5°", "-5^\\circ \\le \\alpha \\le +5^\\circ");
        math(blockStartingWith(unit, "I coefficienti globali"), "0° ≤ α ≤ 45°", "0^\\circ \\le \\alpha \\le 45^\\circ");
        const local = blockStartingWith(unit, "I coefficienti locali cpe,10");
        math(local, "cpe,10", "c_{pe,10}");
        math(local, "cpe,1", "c_{pe,1}");
        await writeUnit(path, unit);
    }

    {
        const { path, unit } = await readUnit("c3.3.8.1.5");
        math(blockStartingWith(unit, "L’altezza di riferimento"), "z̄e", "\\bar z_e");
        await writeUnit(path, unit);
    }
}

function styledCaption(
    asset: CaptionAsset,
    label: string,
    mathTerms: Array<[string, string]> = [],
) {
    assert(asset.caption.startsWith(label), `Etichetta inattesa: ${asset.officialNumber}`);
    const tail = asset.caption.slice(label.length);
    const inline: InlineSegment[] = [{ kind: "strong", value: label }];
    let cursor = 0;
    for (const [value, latex] of mathTerms) {
        const index = tail.indexOf(value, cursor);
        assert(index >= 0, `Simbolo ${value} assente da ${asset.officialNumber}`);
        if (index > cursor) inline.push({ kind: "em", value: tail.slice(cursor, index) });
        inline.push({ kind: "math", value, latex });
        cursor = index + value.length;
    }
    if (cursor < tail.length) inline.push({ kind: "em", value: tail.slice(cursor) });
    assert(inline.map(({ value }) => value).join("") === asset.caption, `Didascalia non allineata: ${asset.officialNumber}`);
    asset.captionInline = inline;
}

async function updateAssets() {
    const figurePath = join(assets, "core-figure-placeholders.json");
    const figureManifest = JSON.parse(await readFile(figurePath, "utf8")) as { figures: CaptionAsset[] };
    const figures = new Map(figureManifest.figures.map((asset) => [asset.officialNumber, asset]));
    const figureUpdates: Array<[string, string, Array<[string, string]>?]> = [
        ["C3.3.1", "Figura C3.3.1", [["αR", "\\alpha_R"], ["TR", "T_R"]]],
        ["C3.3.2", "Figura C3.3.2", [["cpe", "c_{pe}"]]],
        ["C3.3.3", "Figura C3.3.3"],
        ["C3.3.4", "Figure C3.3.4"],
        ["C3.3.5", "Figura C3.3.5"],
        ["C3.3.6", "Figura C3.3.6"],
        ["C3.3.7", "Figura C3.3.7"],
        ["C3.3.8", "Figura C3.3.8", [["cpe", "c_{pe}"]]],
        ["C3.3.9", "Figura C3.3.9"],
        ["C3.3.10", "Figura C3.3.10"],
        ["C3.3.11", "Figura C3.3.11"],
        ["C3.3.12", "Figura C3.3.12"],
        ["C3.3.13", "Figura C3.3.13"],
        ["C3.3.14", "Figura C3.3.14"],
    ];
    for (const [number, label, terms] of figureUpdates) {
        const asset = figures.get(number);
        assert(asset, `Figura assente: ${number}`);
        styledCaption(asset, label, terms);
    }
    await writeFile(figurePath, `${JSON.stringify(figureManifest, null, 2)}\n`, "utf8");

    const tablePath = join(assets, "core-tables.json");
    const tableManifest = JSON.parse(await readFile(tablePath, "utf8")) as { tables: CaptionAsset[] };
    const tables = new Map(tableManifest.tables.map((asset) => [asset.officialNumber, asset]));
    const tableUpdates: Array<[string, Array<[string, string]>]> = [
        ["C3.3.I", [["cpe", "c_{pe}"]]],
        ["C3.3.II", [["cpe", "c_{pe}"]]],
        ["C3.3.III", [["cpe", "c_{pe}"]]],
        ["C3.3.IV", []],
        ["C3.3.V", [["α", "\\alpha"]]],
        ["C3.3.VI", [["α", "\\alpha"]]],
        ["C3.3.VII", [["α", "\\alpha"]]],
        ["C3.3.VIII", [["α", "\\alpha"]]],
        ["C3.3.IX", [["α", "\\alpha"]]],
        ["C3.3.X", [["α", "\\alpha"]]],
        ["C3.3.XI", []],
        ["C3.3.XII", []],
    ];
    for (const [number, terms] of tableUpdates) {
        const asset = tables.get(number);
        assert(asset, `Tabella assente: ${number}`);
        styledCaption(asset, `Tabella ${number}`, terms);
    }
    await writeFile(tablePath, `${JSON.stringify(tableManifest, null, 2)}\n`, "utf8");
}

await updateUnits();
await updateAssets();
