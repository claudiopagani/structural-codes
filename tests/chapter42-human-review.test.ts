import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";
import { join } from "node:path";

type UnitRecord = {
    numbering: { official: string };
    review: { status: string };
};

async function chapterUnits(document: string, prefix: string): Promise<UnitRecord[]> {
    const directory = join(process.cwd(), "corpus", "units", document);
    const files = (await readdir(directory)).filter((file) => file.endsWith(".json"));
    const units = await Promise.all(files.map(async (file) => JSON.parse(await readFile(join(directory, file), "utf8")) as UnitRecord));
    return units.filter((unit) => unit.numbering.official === prefix || unit.numbering.official.startsWith(`${prefix}.`));
}

test("NTC 4.2 e Circolare C4.2 registrano la validazione umana completa", async () => {
    const scopes = [
        { units: await chapterUnits("ntc2018", "4.2"), expected: 67 },
        { units: await chapterUnits("circ2019", "C4.2"), expected: 75 },
    ];
    for (const scope of scopes) {
        assert.equal(scope.units.length, scope.expected);
        for (const unit of scope.units) {
            assert.equal(unit.review.status, "verified", unit.numbering.official);
        }
    }
});
