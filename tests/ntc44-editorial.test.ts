import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { join } from "node:path";

const root = process.cwd();
// I record canonici contengono forme eterogenee di blocco.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function json(relativePath: string): Promise<any> {
    return JSON.parse(await readFile(join(root, relativePath), "utf8"));
}

test("NTC 4.4 distingue elenchi con trattino da definizioni allineate", async () => {
    for (const name of ["4.4.4", "4.4.8.1.6", "4.4.8.2.2", "4.4.12"]) {
        const unit = await json(`corpus/units/ntc2018/${name}.json`);
        assert.ok(unit.blocks.filter((block: { kind: string }) => block.kind === "list-item").every((block: { listMarker?: string }) => block.listMarker === "dash" || block.listMarker === "none"), name);
    }
    for (const name of ["4.4.6", "4.4.8.1.1", "4.4.8.1.3", "4.4.8.1.4", "4.4.8.1.9", "4.4.8.1.10", "4.4.8.2.1"]) {
        const unit = await json(`corpus/units/ntc2018/${name}.json`);
        assert.ok(unit.blocks.some((block: { kind: string; listMarker?: string }) => block.kind === "list-item" && block.listMarker === "none"), name);
    }
});

test("NTC 4.4 conserva il grassetto editoriale nella definizione di taglio", async () => {
    const unit = await json("corpus/units/ntc2018/4.4.8.1.9.json");
    const definition = unit.blocks.find((block: { text?: { normalized: string } }) => block.text?.normalized.startsWith("τd è"));
    assert.ok(definition);
    assert.ok(definition.text.inline.some((segment: { kind: string; value: string }) => segment.kind === "strong" && segment.value.startsWith("considerando una larghezza")));
});

test("Le didascalie NTC 4.4 mantengono corsivo e label della figura", async () => {
    const manifest = await json("corpus/assets/ntc2018/4.4-step1.json");
    assert.ok(manifest.tables.every((table: { caption: string; captionInline?: { kind: string; value: string }[] }) => {
        const inline = table.captionInline;
        return inline?.length === 1 && inline[0]?.kind === "em" && inline[0]?.value === table.caption;
    }));
    const figure = manifest.figures.find((candidate: { officialNumber: string }) => candidate.officialNumber === "4.4.1");
    assert.ok(figure?.captionInline);
    assert.equal(figure.captionInline.map(({ value }: { value: string }) => value).join(""), figure.caption);
    assert.equal(figure.captionInline[0].kind, "strong");
    assert.equal(figure.captionInline[1].kind, "em");
});

test("NTC Tabelle 4.4 applicano allineamenti e larghezze richiesti", async () => {
    const manifest = await json("corpus/assets/ntc2018/4.4-step1.json");
    const table = (number: string) => manifest.tables.find((candidate: { officialNumber: string }) => candidate.officialNumber === number);
    const tableI = table("4.4.I");
    assert.ok(tableI.rows.every((row: Array<{ align?: string }>) => row[1]?.align === "center"));
    const tableIII = table("4.4.III");
    assert.deepEqual(tableIII.columnWidths, [72, 14, 14]);
    for (const row of tableIII.rows.filter((candidate: Array<{ colSpan?: number }>) => candidate.length === 3 && candidate[0]?.colSpan === undefined)) {
        assert.equal(row[0].noWrap, true);
        assert.ok(row.slice(1).every((cell: { align?: string; noWrap?: boolean }) => cell.align === "center" && cell.noWrap === true));
    }
    const tableIV = table("4.4.IV");
    assert.equal(tableIV.rows[0][2].align, "center");
    assert.equal(tableIV.rows[0][7].align, "center");
    const tableV = table("4.4.V");
    assert.ok(tableV.rows.every((row: Array<{ align?: string }>) => row.slice(-3).every((cell) => cell.align === "center")));
});
