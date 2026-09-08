import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

const root = process.cwd();
type Inline = { kind: string; value: string; latex?: string };
type Block = { kind: string; listMarker?: string; listLevel?: number; text?: { normalized: string; inline?: Inline[] } };
type Unit = { blocks: Block[] };

async function unit(document: "ntc2018" | "circ2019", name: string): Promise<Unit> {
    return JSON.parse(await readFile(join(root, "corpus", "units", document, `${name}.json`), "utf8")) as Unit;
}

function lists(record: Unit): Block[] {
    return record.blocks.filter((block) => block.kind === "list-item");
}

test("NTC 10 conserva trattini strutturali e sottotitoli in corsivo", async () => {
    const characteristics = await unit("ntc2018", "10.1");
    const report = await unit("ntc2018", "10.2.1");
    const dashes = [...lists(characteristics), ...lists(report)].filter((block) => block.listMarker === "dash");
    assert.equal(dashes.length, 16);
    assert.ok(dashes.every((block) => !block.text?.normalized.startsWith("-")));
    for (const title of ["Tipo di analisi svolta", "Origine e Caratteristiche dei Codici di Calcolo", "Modalità di presentazione dei risultati.", "Informazioni generali sull’elaborazione.", "Giudizio motivato di accettabilità dei risultati."]) {
        assert.ok(report.blocks.some((block) => block.kind === "heading" && block.text?.inline?.some((segment) => segment.kind === "em" && segment.value === title)), title);
    }
});

test("C10 conserva liste labeled, livelli annidati, corsivi e rapporti inline", async () => {
    const characteristics = await unit("circ2019", "c10.1");
    const report = await unit("circ2019", "c10.2.1");
    const c101Dashes = lists(characteristics).filter((block) => block.listMarker === "dash");
    assert.equal(c101Dashes.length, 20);
    assert.ok(c101Dashes.every((block) => !block.text?.normalized.startsWith("-")));
    assert.equal(lists(characteristics).filter((block) => block.listMarker === "none").length, 8);
    assert.equal(lists(report).filter((block) => block.listMarker === "none" && block.listLevel === undefined).length, 2);
    assert.equal(lists(report).filter((block) => block.listMarker === "none" && block.listLevel === 1).length, 9);
    assert.equal(lists(report).filter((block) => block.listMarker === "dash" && block.listLevel === 2).length, 3);
    for (const phrase of ["“assicurare la perfetta stabilità e sicurezza delle strutture e di evitare qualsiasi pericolo per la pubblica incolumità”", "“la necessità di variazioni in corso di esecuzione”", "“pericolosità sismica di base”", "Relazioni specialistiche"]) {
        assert.ok(characteristics.blocks.some((block) => block.text?.inline?.some((segment) => segment.kind === "em" && segment.value === phrase)), phrase);
    }
    const ratios = characteristics.blocks[30]!.text?.inline?.filter((segment) => segment.kind === "math");
    assert.deepEqual(ratios, [{ kind: "math", value: "1:50", latex: "1{:}50" }, { kind: "math", value: "1:10", latex: "1{:}10" }]);
});
