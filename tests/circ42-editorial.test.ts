import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

type InlineSegment = { kind: string; value: string; latex?: string };
type Block = { kind: string; listMarker?: string; text?: { normalized: string; inline: InlineSegment[] } };
type Unit = { blocks: Block[] };
type Asset = { officialNumber: string; caption: string; captionInline?: InlineSegment[] };
type Manifest = { figures: Asset[]; tables: Asset[] };

const root = process.cwd();
const unitPath = (number: string) => join(root, "corpus", "units", "circ2019", `${number.toLowerCase()}.json`);

async function readUnit(number: string): Promise<Unit> {
    return JSON.parse(await readFile(unitPath(number), "utf8")) as Unit;
}

function inlineValue(segments: InlineSegment[]): string {
    return segments.map((segment) => segment.value).join("");
}

test("Circolare C4.2 pagine 100-105 conserva corsivi e trattini degli elenchi", async () => {
    const overview = await readUnit("C4.2");
    const specification = overview.blocks.find((block) => block.text?.normalized.includes("Specifica di esecuzione"));
    assert.ok(specification?.text?.inline.some((segment) => segment.kind === "em" && segment.value === "Specifica di esecuzione"));
    assert.deepEqual(overview.blocks.filter((block) => block.kind === "list-item").map((block) => block.listMarker), ["dash", "dash", "dash"]);

    const methods = await readUnit("C4.2.3.3");
    assert.deepEqual(methods.blocks.filter((block) => block.kind === "list-item").map((block) => block.listMarker), ["dash", "dash", "dash"]);
});

test("Le didascalie C4.2.1-C4.2.6 e C4.2.I mantengono i loro stili", async () => {
    const manifest = JSON.parse(await readFile(join(root, "corpus", "assets", "circ2019", "C4.2-step1.json"), "utf8")) as Manifest;
    for (const figure of manifest.figures) {
        assert.ok(figure.captionInline, `captionInline assente per ${figure.officialNumber}`);
        assert.equal(inlineValue(figure.captionInline), figure.caption);
        assert.equal(figure.captionInline[0]?.kind, "strong");
        assert.ok(figure.captionInline.slice(1).every((segment) => segment.kind === "em"));
    }
    const table = manifest.tables.find((asset) => asset.officialNumber === "C4.2.I");
    assert.ok(table?.captionInline);
    assert.equal(inlineValue(table.captionInline), table.caption);
    assert.deepEqual(table.captionInline, [{ kind: "em", value: "Valori massimi delle imperfezioni locali" }]);
});

test("C4.2 pagine 106-115 conserva i sottotitoli corsivi, le definizioni e le caption", async () => {
    const definitions = await readUnit("C4.2.4.1.3.1.1");
    assert.ok(definitions.blocks.find((block) => block.kind === "heading")?.text?.inline.every((segment) => segment.kind === "em"));
    assert.ok(definitions.blocks.filter((block) => block.text?.normalized.startsWith("N") && block.text.normalized.includes("forza normale")).every((block) => block.kind === "list-item" && block.listMarker === "none"));

    const manifest = JSON.parse(await readFile(join(root, "corpus", "assets", "circ2019", "C4.2-step2a.json"), "utf8")) as Manifest;
    const figure = manifest.figures.find((asset) => asset.officialNumber === "C4.2.7");
    assert.ok(figure?.captionInline);
    assert.equal(inlineValue(figure.captionInline), figure.caption);
    assert.equal(figure.captionInline[0]?.kind, "strong");
    const table = manifest.tables.find((asset) => asset.officialNumber === "C4.2.II");
    assert.ok(table);
    assert.deepEqual(table.captionInline, [{ kind: "em", value: table.caption }]);
});

test("C4.2 pagine 116-125 conserva gerarchie, terminologia, elenchi e matematica delle caption", async () => {
    const plates = await readUnit("C4.2.4.1.3.4.6");
    assert.ok(plates.blocks.filter((block) => block.kind === "heading").every((block) => block.text?.inline.every((segment) => segment.kind === "em")));

    const fatigue = await readUnit("C4.2.4.1.4.2");
    const firstParagraph = fatigue.blocks.find((block) => block.text?.normalized.startsWith("Gli spettri di tensione"));
    assert.deepEqual(firstParagraph?.text?.inline.filter((segment) => segment.kind === "em").map((segment) => segment.value), ["reservoir method", "rainflow method"]);
    assert.ok(fatigue.blocks.filter((block) => block.kind === "list-item").every((block) => block.listMarker === "dash"));

    const manifests = await Promise.all(["C4.2-step2e.json", "C4.2-step2f.json", "C4.2-step2g.json", "C4.2-step2h.json", "C4.2-step2i.json"].map(async (file) => JSON.parse(await readFile(join(root, "corpus", "assets", "circ2019", file), "utf8")) as Manifest));
    const assets = manifests.flatMap((manifest) => [...manifest.figures, ...manifest.tables]);
    const figure = assets.find((asset) => asset.officialNumber === "C4.2.13");
    assert.equal(inlineValue(figure?.captionInline ?? []), figure?.caption);
    assert.ok(figure?.captionInline?.some((segment) => segment.kind === "math" && segment.latex === "L_e"));
    assert.ok(figure?.captionInline?.some((segment) => segment.kind === "math" && segment.latex === "\\beta"));
    const table = assets.find((asset) => asset.officialNumber === "C4.2.X");
    assert.equal(inlineValue(table?.captionInline ?? []), table?.caption);
    assert.ok(table?.captionInline?.some((segment) => segment.kind === "math" && segment.latex === "\\beta"));
});

test("C4.2 pagine 126-135 conserva stili di fatica, elenchi e caption tabellari", async () => {
    const methods = await readUnit("C4.2.4.1.4.5");
    assert.deepEqual(methods.blocks.find((block) => block.text?.normalized.startsWith("Nelle verifiche a fatica"))?.text?.inline.filter((segment) => segment.kind === "em").map((segment) => segment.value), ["tensioni nominali", "tensioni di picco"]);
    assert.deepEqual(methods.blocks.find((block) => block.text?.normalized.startsWith("Per i dettagli costruttivi"))?.text?.inline.filter((segment) => segment.kind === "em").map((segment) => segment.value), ["geometriche o di picco"]);

    const coldForming = await readUnit("C4.2.12.1.1");
    assert.deepEqual(coldForming.blocks.filter((block) => block.kind === "list-item").map((block) => block.listMarker), ["none", "none", "none", "none", "none", "dash", "dash", "dash", "dash", "dash"]);

    const figureManifest = JSON.parse(await readFile(join(root, "corpus", "assets", "circ2019", "C4.2-step2o.json"), "utf8")) as Manifest;
    const figure = figureManifest.figures.find((asset) => asset.officialNumber === "C4.2.22");
    assert.equal(inlineValue(figure?.captionInline ?? []), figure?.caption);
    assert.deepEqual(figure?.captionInline?.filter((segment) => segment.kind === "math").map((segment) => segment.latex), ["\\Delta\\sigma_C", "\\Delta\\sigma_C^{*}"]);
    const table = figureManifest.tables.find((asset) => asset.officialNumber === "C4.2.XII.a");
    assert.equal(inlineValue(table?.captionInline ?? []), table?.caption);
    assert.ok(table?.captionInline?.some((segment) => segment.kind === "math" && segment.latex === "\\Delta\\sigma"));
});

test("C4.2 pagine 136-145 conserva sottotitoli, simboli e caption dei profilati formati a freddo", async () => {
    const transverse = await readUnit("C4.2.12.1.3");
    assert.ok(transverse.blocks.find((block) => block.text?.normalized.includes("curling"))?.text?.inline.some((segment) => segment.kind === "em" && segment.value === "curling"));

    const resistance = await readUnit("C4.2.12.1.5.1");
    assert.ok(resistance.blocks.find((block) => block.kind === "heading")?.text?.inline.every((segment) => segment.kind === "em"));
    const distortion = await readUnit("C4.2.12.1.4");
    assert.ok(distortion.blocks.filter((block) => block.kind === "list-item").every((block) => block.listMarker === "dash"));
    const joins = await readUnit("C4.2.12.1.7");
    assert.ok(joins.blocks.filter((block) => block.text?.normalized.includes("spessore") && block.text.normalized.includes("collegamento")).every((block) => block.kind === "list-item" && block.listMarker === "none"));

    const manifest = JSON.parse(await readFile(join(root, "corpus", "assets", "circ2019", "C4.2-step2u.json"), "utf8")) as Manifest;
    const figure = manifest.figures.find((asset) => asset.officialNumber === "C4.2.27");
    assert.equal(inlineValue(figure?.captionInline ?? []), figure?.caption);
    assert.ok(figure?.captionInline?.some((segment) => segment.kind === "math" && segment.latex === "b_p"));
    const tableManifest = JSON.parse(await readFile(join(root, "corpus", "assets", "circ2019", "C4.2-step2x.json"), "utf8")) as Manifest;
    assert.deepEqual(tableManifest.tables.find((asset) => asset.officialNumber === "C4.2.XX")?.captionInline, [{ kind: "em", value: "Curve di stabilità per profili sottili compressi" }]);
});

test("C4.2 pagina 146 mantiene le due voci finali sui bottoni di saldatura", async () => {
    const buttons = await readUnit("C4.2.12.1.7.7.1");
    assert.deepEqual(buttons.blocks.filter((block) => block.kind === "list-item").map((block) => block.listMarker), ["dash", "dash"]);
});
