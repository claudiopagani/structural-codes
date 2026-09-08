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

function listItems(record: Unit): Block[] {
    return record.blocks.filter((block) => block.kind === "list-item");
}

test("NTC 9 conserva trattini strutturali e allineamento delle voci alfabetiche", async () => {
    const general = await unit("ntc2018", "9.1");
    const loading = await unit("ntc2018", "9.2");
    const generalDash = listItems(general).filter((block) => block.listMarker === "dash");
    const loadingDash = listItems(loading).filter((block) => block.listMarker === "dash");
    assert.equal(generalDash.length, 5);
    assert.ok(generalDash.every((block) => block.listLevel === 1 && !block.text?.normalized.startsWith("-")));
    assert.equal(loadingDash.length, 4);
    assert.ok(loadingDash.every((block) => block.listLevel === undefined && !block.text?.normalized.startsWith("-")));
    assert.equal(listItems(general).filter((block) => block.listMarker === "none").length, 9);
});

test("C9 conserva livelli degli elenchi, corsivi e formule inline", async () => {
    const general = await unit("circ2019", "c9.1");
    const loading = await unit("circ2019", "c9.2");
    const generalDash = listItems(general).filter((block) => block.listMarker === "dash");
    const loadingDash = listItems(loading).filter((block) => block.listMarker === "dash");
    assert.equal(generalDash.length, 18);
    assert.equal(generalDash.filter((block) => block.listLevel === 1).length, 7);
    assert.ok(generalDash.every((block) => !block.text?.normalized.startsWith("-")));
    assert.equal(listItems(general).filter((block) => block.listMarker === "none").length, 9);
    assert.equal(loadingDash.length, 7);
    assert.ok(loadingDash.every((block) => !block.text?.normalized.startsWith("-")));
    for (const phrase of ["prove di carico", "prove sui materiali messi in opera", "monitoraggio programmato"]) {
        assert.ok(general.blocks.some((block) => block.text?.inline?.some((segment) => segment.kind === "em" && segment.value === phrase)), phrase);
    }
    for (const name of ["c9.2.2", "c9.2.3"]) {
        const record = await unit("circ2019", name);
        assert.ok(record.blocks.some((block) => block.text?.inline?.some((segment) => segment.kind === "math" && segment.value === "15%" && segment.latex === "15\\%")), name);
        assert.ok(record.blocks.some((block) => block.text?.inline?.some((segment) => segment.kind === "math" && segment.value === "1/5" && segment.latex === "\\frac{1}{5}")), name);
    }
});
