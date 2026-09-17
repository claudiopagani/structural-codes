import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

const root = process.cwd();
// I record canonici contengono forme eterogenee di blocco.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function json(relativePath: string): Promise<any> {
    return JSON.parse(await readFile(join(root, relativePath), "utf8"));
}

test("NTC 4.5 distingue trattini, definizioni allineate e voci alfabetiche", async () => {
    for (const name of ["4.5.4", "4.5.5", "4.5.6.1", "4.5.6.2"]) {
        const unit = await json(`corpus/units/ntc2018/${name}.json`);
        const dashed = unit.blocks.filter((block: { kind: string; listMarker?: string }) => block.kind === "list-item" && block.listMarker === "dash");
        assert.ok(dashed.length > 0, name);
        assert.ok(dashed.every((block: { text: { normalized: string } }) => !block.text.normalized.startsWith("– ")), name);
    }
    for (const name of ["4.5.2.2.1", "4.5.6.2", "4.5.6.4"]) {
        const unit = await json(`corpus/units/ntc2018/${name}.json`);
        assert.ok(unit.blocks.some((block: { kind: string; listMarker?: string }) => block.kind === "list-item" && block.listMarker === "none"), name);
    }
});

test("NTC 4.5 conserva i corsivi e le didascalie della fonte", async () => {
    for (const [name, phrase] of [["4.5.2.3", "a singolo paramento"], ["4.5.4", "snellezza convenzionale"], ["4.5.6.2", "coefficiente di eccentricità"]]) {
        const unit = await json(`corpus/units/ntc2018/${name}.json`);
        assert.ok(unit.blocks.some((block: { text?: { inline?: { kind: string; value: string }[] } }) => block.text?.inline?.some((segment) => segment.kind === "em" && segment.value === phrase)), phrase);
    }
    const manifest = await json("corpus/assets/ntc2018/4.5.json");
    assert.equal(manifest.tables.length, 5);
    assert.ok(manifest.tables.every((table: { caption: string; captionInline?: { kind: string; value: string }[] }) => table.captionInline?.length === 1 && table.captionInline[0]?.kind === "em" && table.captionInline[0]?.value === table.caption));
});

test("NTC Tabelle 4.5 applicano gli allineamenti richiesti", async () => {
    const manifest = await json("corpus/assets/ntc2018/4.5.json");
    const table = (number: string) => manifest.tables.find((candidate: { officialNumber: string }) => candidate.officialNumber === number);
    for (const number of ["4.5.Ia", "4.5.Ib", "4.5.II"]) {
        const current = table(number);
        assert.ok([...current.headers, ...current.rows].every((row: Array<{ align?: string }>) => row.slice(1).every((cell) => cell.align === "center")), number);
    }
    for (const number of ["4.5.III", "4.5.IV"]) {
        const current = table(number);
        assert.ok([...current.headers, ...current.rows].flat().every((cell: { align?: string }) => cell.align === "center"), number);
    }
});

test("NTC 4.5.4 conserva il testo delle voci su segmenti distinti", async () => {
    const unit = await json("corpus/units/ntc2018/4.5.4.json");
    const items = unit.blocks.filter((block: { kind: string }) => block.kind === "list-item");
    assert.ok(items.every((item: { text: { inline: Array<{ kind: string; value: string }> } }) => item.text.inline.at(-1)?.kind === "math"));
});

test("NTC 4.5 allinea con tabulazione i valori degli spessori", async () => {
    const unit = await json("corpus/units/ntc2018/4.5.2.2.1.json");
    const ids = ["block-editorial-016", "block-editorial-017", "block-editorial-019", "block-editorial-020"];
    const values = ids.map((id) => {
        const block = unit.blocks.find((candidate: { blockId: string }) => candidate.blockId.endsWith(`#${id}`));
        return block?.text?.inline?.find((segment: { kind: string }) => segment.kind === "math")?.value;
    });
    assert.deepEqual(values, ["7 mm", "18 mm", "10 mm", "18 mm"]);
});
