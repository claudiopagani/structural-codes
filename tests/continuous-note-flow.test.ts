/* eslint-disable @typescript-eslint/no-explicit-any */
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../", import.meta.url));

async function json(relativePath: string): Promise<any> {
    return JSON.parse(await readFile(join(repoRoot, relativePath), "utf8"));
}

function blockIndex(unit: any, prefix: string): number {
    const index = unit.blocks.findIndex((block: any) => block.text?.normalized?.startsWith(prefix));
    assert.notEqual(index, -1, `${unit.id}: ${prefix}`);
    return index;
}

function assertNoteImmediatelyAfter(unit: any, notePrefix: string, anchorPrefix: string): void {
    const noteIndex = blockIndex(unit, notePrefix);
    const anchorIndex = blockIndex(unit, anchorPrefix);
    assert.equal(unit.blocks[noteIndex].kind, "footnote", `${unit.id}: nota non marcata come footnote`);
    assert.equal(noteIndex, anchorIndex + 1, `${unit.id}: nota non collocata dopo il richiamo`);
}

test("le note della Circolare seguono il richiamo nel flusso continuo", async () => {
    assertNoteImmediatelyAfter(await json("corpus/units/circ2019/c3.2.1.json"), "² Si veda al riguardo", "Strategie progettuali alternative");
    assertNoteImmediatelyAfter(await json("corpus/units/circ2019/c6.json"), "Il primo passo della progettazione geotecnica", "Per progettazione geotecnica si intende");
    assertNoteImmediatelyAfter(await json("corpus/units/circ2019/c7.1.json"), "Pur essendo la capacità", "La norma indica, per ciascuno stato limite");
    assertNoteImmediatelyAfter(await json("corpus/units/circ2019/c7.2.1.json"), "Questo requisito è essenziale", "Nel caso in cui in un edificio");

    const c722 = await json("corpus/units/circ2019/c7.2.2.json");
    assertNoteImmediatelyAfter(c722, "I fattori di sovraresistenza", "Per conseguire gli obiettivi insiti");
    assertNoteImmediatelyAfter(c722, "Per evitare che, in forza", "Per una struttura alla quale");

    assertNoteImmediatelyAfter(await json("corpus/units/circ2019/c7.2.3.json"), "Per facilitare la progettazione", "Elementi Secondari");
    const c726 = await json("corpus/units/circ2019/c7.2.6.json");
    assertNoteImmediatelyAfter(c726, "Il coefficiente di fessurazione", "La norma precisa che in ogni caso");
    assertNoteImmediatelyAfter(c726, "Si specifica che l’eccentricità accidentale", "Per semplicità di analisi");
    assertNoteImmediatelyAfter(await json("corpus/units/circ2019/c7.3.3.1.json"), "L’analisi lineare dinamica", "C7.3.3.1 ANALISI LINEARE DINAMICA");
    assertNoteImmediatelyAfter(await json("corpus/units/circ2019/c7.3.3.2.json"), "L’analisi lineare statica", "C7.3.3.2 ANALISI LINEARE STATICA");
    assertNoteImmediatelyAfter(await json("corpus/units/circ2019/c7.3.6.1.json"), "Le verifiche sugli elementi strutturali", "Nelle verifiche di cui al § 7.3.6.1");
    assertNoteImmediatelyAfter(await json("corpus/units/circ2019/c8.2.json"), "Per quanto riguarda le costruzioni esistenti", "In generale, la valutazione della sicurezza");
    assertNoteImmediatelyAfter(await json("corpus/units/circ2019/c8.4.json"), "È opportuno che gli interventi", "Le NTC confermano le tre categorie");
    assertNoteImmediatelyAfter(await json("corpus/units/circ2019/c8.5.4.1.json"), "³Dalla formula emerge", "Nel determinare la stima aggiornata");
    assertNoteImmediatelyAfter(await json("corpus/units/circ2019/c11.1.json"), "1 http://ec.europa.eu", "Mediante lo strumento informatico");

    const duplicate = await json("corpus/units/circ2019/c7.3.1.json");
    assert.equal(duplicate.blocks.filter((block: any) => block.text?.normalized?.startsWith("Si specifica che l’eccentricità accidentale")).length, 0);
    assert.equal((await json("corpus/units/circ2019/c7.3.6.1.json")).blocks.filter((block: any) => block.kind === "footnote").length, 1);
    assert.equal((await json("corpus/units/circ2019/c7.4.json")).blocks.filter((block: any) => block.kind === "footnote").length, 0);
});

test("le note restano dati strutturati e sono presenti in entrambi i documenti", async () => {
    let footnoteCount = 0;
    let tableNoteCount = 0;
    for (const document of ["ntc2018", "circ2019"]) {
        const directory = join(repoRoot, "corpus/units", document);
        for (const fileName of (await readdir(directory)).filter((name) => name.endsWith(".json"))) {
            const unit = await json(`corpus/units/${document}/${fileName}`);
            footnoteCount += unit.blocks.filter((block: any) => block.kind === "footnote").length;
        }
    }
    for (const document of ["ntc2018", "circ2019"]) {
        const manifest = await json(`corpus/assets/${document}/${document === "ntc2018" ? "5.1-step3" : "core-tables"}.json`);
        tableNoteCount += manifest.tables.filter((table: any) => (table.notes ?? []).length > 0).length;
    }
    assert.equal(footnoteCount, 23);
    assert.ok(tableNoteCount > 0);
});
