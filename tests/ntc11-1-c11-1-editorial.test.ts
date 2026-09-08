import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

const root = process.cwd();
type Inline = { kind: string; value: string; latex?: string };
type Block = { kind: string; listMarker?: string; text?: { normalized: string; inline?: Inline[] } };
type Unit = { blocks: Block[] };

async function unit(document: "ntc2018" | "circ2019", name: string): Promise<Unit> {
    return JSON.parse(await readFile(join(root, "corpus", "units", document, `${name}.json`), "utf8")) as Unit;
}

test("NTC 11.1 conserva elenchi e corsivi verificati", async () => {
    const record = await unit("ntc2018", "11.1");
    const lists = record.blocks.filter((block) => block.kind === "list-item");
    assert.equal(lists.filter((block) => block.listMarker === "dash").length, 3);
    assert.equal(lists.filter((block) => block.listMarker === "none").length, 6);
    assert.ok(lists.filter((block) => block.listMarker === "dash").every((block) => !block.text?.normalized.startsWith("–")));
    for (const phrase of ["Resistenza meccanica e stabilità", "Relazione sui materiali", "Relazione a struttura ultimata", "mandatario"]) {
        assert.ok(record.blocks.some((block) => block.text?.inline?.some((segment) => segment.kind === "em" && segment.value === phrase)), phrase);
    }
});

test("C11.1 conserva label, liste, corsivi e nota separata", async () => {
    const record = await unit("circ2019", "c11.1");
    const lists = record.blocks.filter((block) => block.kind === "list-item");
    assert.equal(lists.filter((block) => block.listMarker === "none").length, 3);
    assert.equal(lists.filter((block) => block.listMarker === "dash").length, 12);
    assert.ok(lists.filter((block) => block.listMarker === "dash").every((block) => !block.text?.normalized.startsWith("-")));
    const footnote = record.blocks.find((block) => block.kind === "footnote");
    assert.equal(footnote?.text?.normalized, "1 http://ec.europa.eu/growth/tools-databases/nando/index.cfm?fuseaction=directive.notifiedbody&dir_id=33");
    assert.ok(record.blocks.some((block) => block.kind === "paragraph" && block.text?.normalized.startsWith("Le NTC prevedono, a riguardo")));
    for (const phrase of ["«Fabbricante»", "«Valutazione Tecnica Europea (ETA)»", "«Organismi notificati»", "l’acquisizione e verifica", "prodotti occasionali"]) {
        assert.ok(record.blocks.some((block) => block.text?.inline?.some((segment) => segment.kind === "em" && segment.value === phrase)), phrase);
    }
    assert.equal(record.blocks.some((block) => block.text?.inline?.some((segment) => segment.kind === "math" && segment.value === "Ar")), false);
});
