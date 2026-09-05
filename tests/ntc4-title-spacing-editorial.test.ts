import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = fileURLToPath(new URL("../", import.meta.url));
const expected = new Map<string, string>([
    ["4.1.1", "VALUTAZIONE DELLA SICUREZZA E METODI DI ANALISI"],
    ["4.1.5", "PROGETTAZIONE INTEGRATA DA PROVE E VERIFICA MEDIANTE PROVE"],
    ["4.1.6.1", "ELEMENTI MONODIMENSIONALI: TRAVI E PILASTRI"],
    ["4.1.9", "NORME ULTERIORI PER I SOLAI"],
    ["4.1.9.1", "SOLAI MISTI DI C.A. E C.A.P. E BLOCCHI FORATI IN LATERIZIO O IN CALCESTRUZZO"],
    ["4.1.9.2", "SOLAI MISTI DI C.A. E C.A.P. E BLOCCHI DIVERSI DAL LATERIZIO O CALCESTRUZZO"],
    ["4.1.9.3", "SOLAI REALIZZATI CON L’ASSOCIAZIONE DI COMPONENTI PREFABBRICATI IN C.A. E C.A.P."],
    ["4.1.11", "CALCESTRUZZO A BASSA PERCENTUALE DI ARMATURA O NON ARMATO"],
]);

async function json(path: string) {
    return JSON.parse(await readFile(join(root, path), "utf8"));
}

test("NTC §4.1 conserva gli spazi corretti nei titoli e nei relativi heading", async () => {
    for (const [number, title] of expected) {
        const unit = await json(`corpus/units/ntc2018/${number}.json`);
        const heading = unit.blocks.find((block: { blockId: string }) => block.blockId.endsWith("#block-heading"));
        assert.equal(unit.title, title, number);
        assert.equal(heading.text.normalized, `${number} ${title}`, number);
        assert.equal(heading.text.inline, undefined, number);
    }
});
