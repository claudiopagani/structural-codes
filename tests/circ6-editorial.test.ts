/* eslint-disable @typescript-eslint/no-explicit-any */
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const unitDir = join(root, "corpus", "units", "circ2019");
const unitFile = /^c6(?:\.\d+)*\.json$/u;

async function loadUnits(): Promise<any[]> {
    const names = (await readdir(unitDir)).filter((name) => unitFile.test(name)).sort();
    return Promise.all(names.map(async (name) => JSON.parse(await readFile(join(unitDir, name), "utf8"))));
}

test("Circolare capitolo 6: unità, gerarchia e stato editoriale", async () => {
    const units = await loadUnits();
    const numbers = units.map((unit) => unit.numbering.official);
    assert.equal(numbers.length, 55);
    assert.equal(numbers.includes("C6"), true);
    assert.equal(numbers.includes("C6.12.2.1"), true);
    const numberSet = new Set(numbers);
    for (const unit of units) {
        const parts = unit.numbering.official.slice(1).split(".");
        const parent = parts.length > 1 ? `C${parts.slice(0, -1).join(".")}` : null;
        if (parent) assert.equal(numberSet.has(parent), true, unit.id);
        assert.equal(unit.workflow.status, "extracted", unit.id);
        assert.equal(unit.workflow.openIssues.some((issue: any) => issue.severity === "blocking"), true, unit.id);
    }
});

test("Circolare capitolo 6: tabella C6.2.I strutturata e collocata", async () => {
    const unit = JSON.parse(await readFile(join(unitDir, "c6.2.2.1.json"), "utf8"));
    const tableBlock = unit.blocks.find((block: any) => block.kind === "table-ref");
    assert.equal(tableBlock.assetId, "urn:structural-codes:it:asset:table:circ2019:c6.2.i");
    assert.deepEqual(unit.assets.tableIds, [tableBlock.assetId]);

    const manifest = JSON.parse(await readFile(join(root, "corpus", "assets", "circ2019", "C6-step1.json"), "utf8"));
    const table = manifest.tables.find((asset: any) => asset.id === tableBlock.assetId);
    assert.ok(table);
    assert.equal(table.pdfPage, 179);
    assert.equal(table.columnCount, 3);
    assert.equal(table.rows.length, 13);
    assert.equal(table.rows[1][0].rowSpan, 3);
    assert.equal(table.rows[5][0].rowSpan, 2);
    assert.equal(table.rows[7][0].rowSpan, 3);
    assert.equal(table.rows[10][0].rowSpan, 3);
    assert.deepEqual(manifest.formulas, []);
    assert.deepEqual(manifest.figures, []);
});

test("Circolare capitolo 6: capoversi, elenchi e matematica inline", async () => {
    const c641 = JSON.parse(await readFile(join(unitDir, "c6.4.1.json"), "utf8"));
    const c642 = JSON.parse(await readFile(join(unitDir, "c6.4.2.json"), "utf8"));
    const c65312 = JSON.parse(await readFile(join(unitDir, "c6.5.3.1.2.json"), "utf8"));
    const c6811 = JSON.parse(await readFile(join(unitDir, "c6.8.1.1.json"), "utf8"));

    assert.equal(c641.blocks.some((block: any) => block.evidence.pdfPage === 187 && block.kind === "list-item"), true);
    assert.equal(c641.blocks.some((block: any) => block.text?.inline?.some((segment: any) => segment.latex === "b\\div 2b")), true);
    assert.equal(c642.blocks[1].kind, "heading");
    assert.match(c642.blocks[1].text.normalized, /Criteri di progetto/u);
    assert.equal(c65312.blocks.some((block: any) => block.text?.inline?.some((segment: any) => segment.latex === "E_d\\le R_d")), true);
    assert.equal(c65312.blocks.some((block: any) => block.text?.inline?.some((segment: any) => segment.latex === "\\gamma_{\\varphi'}")), true);
    assert.equal(c6811.blocks.some((block: any) => block.text?.inline?.some((segment: any) => segment.latex === "15\\,\\mu\\mathrm{m}")), true);
    const c6862 = JSON.parse(await readFile(join(unitDir, "c6.8.6.2.json"), "utf8"));
    assert.equal(c6862.blocks.some((block: any) => block.text?.inline?.some((segment: any) => segment.value === "Rd/Ed" && segment.latex === "Rd/Ed")), true);
    assert.equal(c6862.blocks.some((block: any) => block.text?.inline?.some((segment: any) => /R_d|E_d/u.test(segment.latex ?? ""))), false);
    assert.equal(c641.workflow.openIssues.some((issue: any) => issue.type === "missing-region"), true);
});

test("Circolare C6.2.4.1 allinea le etichette in grassetto e C6.4.1 conserva i rientri annidati", async () => {
    const c6241 = JSON.parse(await readFile(join(unitDir, "c6.2.4.1.json"), "utf8"));
    const c641 = JSON.parse(await readFile(join(unitDir, "c6.4.1.json"), "utf8"));

    assert.deepEqual(c6241.blocks.slice(2, 7).map((block: any) => [
        block.kind,
        block.listMarker,
        block.listLevel,
        block.text.inline?.[0]?.kind,
        block.text.inline?.[0]?.value,
    ]), [
        ["list-item", "none", 0, "strong", "EQU"],
        ["list-item", "none", 0, "strong", "STR"],
        ["list-item", "none", 0, "strong", "GEO"],
        ["list-item", "none", 0, "strong", "UPL"],
        ["list-item", "none", 0, "strong", "HYD"],
    ]);

    assert.deepEqual(c641.blocks.filter((block: any) => block.kind === "list-item").map((block: any) => [
        block.text.normalized,
        block.listMarker,
        block.listLevel,
    ]), [
        ["a) Terreni di fondazione:", "none", 0],
        ["Profondità del volume significativo", "dash", 1],
        ["Nel caso di fondazioni superficiali la profondità da raggiungere con le indagini può essere dell’ordine di b÷2b, dove b è la lunghezza del lato minore del rettangolo che meglio approssima la forma in pianta del manufatto.", "none", 1],
        ["Nel caso di fondazioni su pali, la profondità, considerata dall’estremità inferiore dei pali, può essere dell’ordine di 0.5b÷b.", "none", 1],
        ["Profondità maggiori dovranno essere indagate in presenza di terreni molto compressibili o di cavità o per costruzioni molto sensibili ai cedimenti assoluti e differenziali.", "none", 1],
        ["Stratigrafia, regime delle pressioni interstiziali e grandezze fisiche e meccaniche e idrauliche dei terreni nel volume significativo.", "dash", 1],
        ["b) Opere in progetto:", "none", 0],
        ["dimensioni dell’opera;", "dash", 1],
        ["caratteristiche della struttura in elevazione, con particolare riferimento ai possibili cedimenti differenziali;", "dash", 1],
        ["sequenza cronologica con la quale vengono costruite le varie parti dell’opera (fasi costruttive);", "dash", 1],
        ["distribuzione, intensità o variazione nel tempo dei carichi trasmessi in fondazione, distinguendo i carichi permanenti dai sovraccarichi, e questi, a loro volta, in statici e dinamici.", "dash", 1],
        ["c) Fattori ambientali:", "none", 0],
        ["caratteri morfologici del sito;", "dash", 1],
        ["deflusso delle acque superficiali;", "dash", 1],
        ["presenza o caratteristiche di altri manufatti (edifici, canali, acquedotti, strade, muri di sostegno, gallerie, ponti, ecc.) esistenti nelle vicinanze o dei quali è prevista la costruzione.", "dash", 1],
    ]);
});

test("Circolare capitolo 6: lo step 2 non introduce asset display", async () => {
    const manifest = JSON.parse(await readFile(join(root, "corpus", "assets", "circ2019", "C6-step2.json"), "utf8"));
    assert.deepEqual(manifest.formulas, []);
    assert.deepEqual(manifest.tables, []);
    assert.deepEqual(manifest.figures, []);
});

test("Circolare C6 conserva le combinazioni A/M/R senza pedici inventati", async () => {
    const units = await Promise.all([
        "c6.2.4.1.json", "c6.4.2.1.json", "c6.5.3.1.1.json",
        "c6.5.3.1.2.json", "c6.6.2.json",
    ].map(async (name) => JSON.parse(await readFile(join(unitDir, name), "utf8"))));
    const segments = units.flatMap((unit: any) => unit.blocks)
        .flatMap((block: any) => block.text?.inline ?? [])
        .filter((segment: any) => segment.kind === "math")
        .map((segment: any) => [segment.value, segment.latex]);
    assert.equal(segments.some(([value, latex]: string[]) => value === "A2+M2+R2" && latex === "A2+M2+R2"), true);
    assert.equal(segments.some(([value, latex]: string[]) => value === "A1+M1+R1" && latex === "A1+M1+R1"), true);
    assert.equal(segments.some(([value, latex]: string[]) => value === "A1+M1+R3" && latex === "A1+M1+R3"), true);
    assert.equal(segments.some((segment: string[]) => /A_[12]|M_[12]|R_[12]/u.test(segment[1] ?? "")), false);
});

test("Circolare C6 conserva il punto decimale ufficiale in 0.5b÷b", async () => {
    const unit = JSON.parse(await readFile(join(unitDir, "c6.4.1.json"), "utf8"));
    const segment = unit.blocks.flatMap((block: any) => block.text?.inline ?? [])
        .find((candidate: any) => candidate.value === "0.5b÷b");
    assert.equal(segment?.latex, "0.5b\\div b");
});
