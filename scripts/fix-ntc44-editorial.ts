import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

type Inline = { kind: "text" | "em" | "strong" | "math"; value: string; latex?: string };
type Block = { kind: string; listMarker?: "dash" | "none"; text?: { normalized: string; inline?: Inline[] } };
type Unit = { blocks: Block[] };
type CaptionAsset = { officialNumber: string; caption: string; captionInline?: Inline[] };

const root = fileURLToPath(new URL("../", import.meta.url));
const units = join(root, "corpus", "units", "ntc2018");

async function updateUnit(name: string, edit: (unit: Unit) => void): Promise<void> {
    const path = join(units, `${name}.json`);
    const unit = JSON.parse(await readFile(path, "utf8")) as Unit;
    edit(unit);
    await writeFile(path, `${JSON.stringify(unit, null, 2)}\n`, "utf8");
}

function listItems(unit: Unit): Block[] {
    const items = unit.blocks.filter((block) => block.kind === "list-item");
    assert.ok(items.length > 0, "Elenco atteso ma assente");
    return items;
}

function markDefinitions(unit: Unit, prefixes: string[]): void {
    for (const prefix of prefixes) {
        const matches = unit.blocks.filter((block) => block.kind === "paragraph" && block.text?.normalized.startsWith(prefix));
        assert.equal(matches.length, 1, `Definizione attesa una sola volta: ${prefix}`);
        const definition = matches[0];
        assert.ok(definition, `Definizione assente: ${prefix}`);
        definition.kind = "list-item";
        definition.listMarker = "none";
    }
}

for (const name of ["4.4.4", "4.4.8.1.6", "4.4.8.2.2", "4.4.12"]) {
    await updateUnit(name, (unit) => {
        for (const block of listItems(unit)) block.listMarker = "dash";
    });
}

await updateUnit("4.4.8.1.10", (unit) => {
    for (const block of listItems(unit)) block.listMarker = "none";
});

await updateUnit("4.4.6", (unit) => markDefinitions(unit, ["Xk è", "γM è", "kmod è"]));
await updateUnit("4.4.8.1.1", (unit) => markDefinitions(unit, ["σt,0,d è", "ft,0,d è"]));
await updateUnit("4.4.8.1.3", (unit) => markDefinitions(unit, ["σc,0,d è", "fc,0,d è"]));
await updateUnit("4.4.8.1.4", (unit) => markDefinitions(unit, ["σc,90,d è", "fc,90,d è"]));
await updateUnit("4.4.8.1.6", (unit) => markDefinitions(unit, ["σm,y,d e", "fm,y,d e"]));
await updateUnit("4.4.8.1.9", (unit) => {
    markDefinitions(unit, ["τd è", "fv,d è"]);
    const block = unit.blocks.find((candidate) => candidate.text?.normalized.startsWith("τd è"));
    assert.ok(block?.text, "Definizione di taglio assente");
    block.text.inline = [
        { kind: "math", value: "τd", latex: "\\tau_d" },
        { kind: "text", value: " è la massima tensione tangenziale di progetto, valutata secondo la teoria di Jourawski, " },
        { kind: "strong", value: "considerando una larghezza di trave opportunamente ridotta per la presenza di eventuali fessurazioni" },
        { kind: "text", value: ";" }
    ];
});
await updateUnit("4.4.8.1.10", (unit) => markDefinitions(unit, ["τtor,d è", "ksh è", "fv,d è"]));
await updateUnit("4.4.8.2.1", (unit) => markDefinitions(unit, ["σm,d è", "kcrit,m è", "fm,d è", "λrel,m =", "fm,k è", "σm,crit è"]));
await updateUnit("4.4.8.2.2", (unit) => markDefinitions(unit, ["σc,0,d tensione", "fc,0,d resistenza", "kcrit,c coefficiente", "fc,0,k resistenza", "σc,crit tensione", "λ snellezza"]));

const assetPath = join(root, "corpus", "assets", "ntc2018", "4.4-step1.json");
const manifest = JSON.parse(await readFile(assetPath, "utf8")) as { tables: CaptionAsset[]; figures: CaptionAsset[] };
for (const table of manifest.tables) table.captionInline = [{ kind: "em", value: table.caption }];
for (const figure of manifest.figures) {
    if (figure.officialNumber !== "4.4.1") continue;
    const label = "Fig. 4.4.1";
    assert.ok(figure.caption.startsWith(label), "Didascalia della figura inattesa");
    figure.captionInline = [{ kind: "strong", value: label }, { kind: "em", value: figure.caption.slice(label.length) }];
}
await writeFile(assetPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
