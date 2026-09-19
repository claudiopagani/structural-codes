import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

type Inline = { kind: string; value: string };
type Block = { blockId: string; kind: string; text?: { normalized: string; inline?: Inline[] }; evidence?: { pdfPage?: number } };
type Unit = { blocks: Block[] };

const root = process.cwd();
const unit = async (number: string): Promise<Unit> => JSON.parse(await readFile(join(root, "corpus", "units", "circ2019", `${number}.json`), "utf8")) as Unit;

test("Circolare C8 conserva l’introduzione prima di C8.1 e i corsivi di C8.1", async () => {
    const c8 = await unit("c8");
    assert.deepEqual(c8.blocks.map(({ kind }) => kind), ["heading", "paragraph", "paragraph", "paragraph", "paragraph"]);
    assert.equal(c8.blocks[1]?.text?.normalized.startsWith("Le costruzioni esistenti rappresentano certamente"), true);
    assert.equal(c8.blocks.slice(1).every((block) => block.evidence?.pdfPage === 254), true);

    const c81 = await unit("c8.1");
    const first = c81.blocks.find((block) => block.blockId.endsWith("#block-editorial-001"));
    const third = c81.blocks.find((block) => block.blockId.endsWith("#block-editorial-003"));
    assert.deepEqual(first?.text?.inline?.filter(({ kind }) => kind === "em").map(({ value }) => value), ["costruzioni esistenti", "alla data della redazione della valutazione di sicurezza e/o del progetto d’intervento", "completamente realizzata"]);
    assert.deepEqual(third?.text?.inline?.filter(({ kind }) => kind === "em").map(({ value }) => value), ["struttura completamente realizzata"]);
});
