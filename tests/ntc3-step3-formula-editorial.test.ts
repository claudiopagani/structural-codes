import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = fileURLToPath(new URL("../", import.meta.url));
const formulaId = (number: string) => "urn:structural-codes:it:asset:formula:ntc2018:" + number;
const tableId = (number: string) => "urn:structural-codes:it:asset:table:ntc2018:" + number.toLowerCase();
const formulaNumbers = [
    "3.2.13", "3.2.14", "3.2.15", "3.2.16",
    "3.3.1", "3.3.1.b", "3.3.2", "3.3.3", "3.3.4", "3.3.5", "3.3.6", "3.3.7",
    "3.4.1", "3.4.2", "3.4.3", "3.4.4", "3.4.5",
    "3.5.1", "3.5.2", "3.5.3", "3.5.4", "3.5.5", "3.5.6", "3.5.7", "3.5.8",
];
const unitNumbers = [
    "3.2.4.2", "3.3.1", "3.3.2", "3.3.4", "3.3.5", "3.3.6", "3.3.7",
    "3.3.8", "3.4.1", "3.4.2", "3.4.3.1", "3.4.4", "3.4.5", "3.5.2", "3.5.3",
];
type Formula = { officialNumber: string; latex: string };
type TableCell = { text: string; latex?: string; align?: string };
type Table = { officialNumber: string; columnCount: number; headers: TableCell[][]; rows: TableCell[][] };

async function json(path: string) {
    return JSON.parse(await readFile(join(root, path), "utf8"));
}

test("NTC pagine 55–64 conserva le venticinque formule display ufficiali", async () => {
    const manifest = await json("corpus/assets/ntc2018/core-editorial.json");
    const formulas = manifest.formulas.filter((formula: { pdfPage: number }) => formula.pdfPage >= 55 && formula.pdfPage <= 64) as Formula[];
    assert.deepEqual(formulas.map((formula: { officialNumber: string }) => formula.officialNumber), formulaNumbers);
    const byNumber = new Map<string, Formula>(formulas.map((formula) => [formula.officialNumber, formula]));
    assert.equal(byNumber.get("3.2.14")!.latex, "d_{ij}(x)=d_{ij0}+\\left(d_{ij\\mathrm{max}}-d_{ij0}\\right)\\left[1-e^{-1{,}25(x/v_s)^{0{,}7}}\\right]");
    assert.equal(byNumber.get("3.2.16")!.latex.includes("\\cdot3{,}0x"), true);
    assert.equal(byNumber.get("3.3.1")!.latex, "v_b=v_{b,0}\\cdot c_a");
    assert.equal(byNumber.get("3.3.2")!.latex, "v_r=v_b\\cdot c_r");
    assert.equal(byNumber.get("3.3.3")!.latex.includes("0{,}2\\times\\ln"), true);
    assert.equal(byNumber.get("3.4.1")!.latex, "q_s=q_{sk}\\cdot\\mu_i\\cdot C_E\\cdot C_t");
    assert.equal(byNumber.get("3.4.2")!.latex.includes("\\left(a_s/728\\right)^2"), true);
    assert.equal(byNumber.get("3.5.6")!.latex, "T_{\\max}=42-0{,}3\\cdot a_s/1000");
});

test("NTC pagine 55–64 colloca ogni formula una sola volta e rimuove il rumore estratto", async () => {
    const units = await Promise.all(unitNumbers.map((number) => json("corpus/units/ntc2018/" + number + ".json")));
    const refs = units.flatMap((unit) => unit.blocks.filter((block: { kind: string }) => block.kind === "formula-ref"));
    const ids = refs.map((block: { assetId: string }) => block.assetId);
    for (const number of formulaNumbers) {
        assert.equal(ids.filter((id: string) => id === formulaId(number)).length, 1, number);
    }
    for (const unit of units) {
        for (const block of unit.blocks) {
            if (!block.text?.normalized) continue;
            assert.doesNotMatch(block.text.normalized, />3\.[2345]\.|[ǂǃ]|(?:^|\s)t\s+(?:5|10)\s+anni/);
            if (block.text.inline) {
                assert.equal(block.text.inline.map((segment: { value: string }) => segment.value).join(""), block.text.normalized);
                assert.equal(block.text.inline.some((segment: { kind: string; value: string }) => segment.kind === "math" && /^[=>dcp]$/.test(segment.value)), false);
            }
        }
    }
});

test("NTC Tabelle 3.3.I–III e 3.4.I–II conservano griglia e matematica ufficiali", async () => {
    const manifest = await json("corpus/assets/ntc2018/core-tables.json");
    const expected = ["3.3.I", "3.3.II", "3.3.III", "3.4.I", "3.4.II"];
    const tables = manifest.tables.filter((table: { officialNumber: string }) => expected.includes(table.officialNumber)) as Table[];
    assert.deepEqual(tables.map((table: { officialNumber: string }) => table.officialNumber), expected);
    const byNumber = new Map<string, Table>(tables.map((table) => [table.officialNumber, table]));
    assert.equal(byNumber.get("3.3.I")!.columnCount, 5);
    assert.equal(byNumber.get("3.3.I")!.rows.length, 9);
    assert.equal(byNumber.get("3.3.II")!.columnCount, 4);
    assert.equal(byNumber.get("3.3.III")!.rows[3]![1]!.text.includes("a) Mare"), true);
    assert.equal(byNumber.get("3.4.I")!.rows[2]![2]!.latex, "1{,}1");
    assert.equal(byNumber.get("3.4.II")!.columnCount, 4);
    assert.equal(byNumber.get("3.4.II")!.rows[0]![2]!.latex, "0{,}8\\cdot\\dfrac{60-\\alpha}{30}");
    assert.equal([...byNumber.get("3.4.II")!.headers.flat(), ...byNumber.get("3.4.II")!.rows.flat()].every((cell) => cell.align === "center"), true);
    const unit337 = await json("corpus/units/ntc2018/3.3.7.json");
    assert.deepEqual(unit337.assets.tableIds, [tableId("3.3.II"), tableId("3.3.III")]);
    const unit3431 = await json("corpus/units/ntc2018/3.4.3.1.json");
    assert.deepEqual(unit3431.assets.tableIds, [tableId("3.4.II")]);
    const unit341 = await json("corpus/units/ntc2018/3.4.1.json");
    assert.deepEqual(
        unit341.blocks
            .filter((block: { kind: string; listMarker?: string }) => block.kind === "list-item" && block.listMarker === "none")
            .map((block: { text?: { inline?: Array<{ latex?: string }> } }) => block.text?.inline?.[0]?.latex),
        ["q_{sk}", "\\mu_i", "C_E", "C_t"],
    );
});

test("NTC Figure 3.3.1–3.5.2 sono crop ufficiali univoci con hash verificato", async () => {
    const manifest = await json("corpus/assets/ntc2018/core-figure-placeholders.json");
    const expected = ["3.3.1", "3.3.2", "3.3.3", "3.4.1", "3.4.2", "3.4.3", "3.5.1", "3.5.2"];
    const figures = manifest.figures.filter((figure: { officialNumber: string }) => expected.includes(figure.officialNumber));
    assert.deepEqual(figures.map((figure: { officialNumber: string }) => figure.officialNumber), expected);
    for (const figure of figures) {
        assert.doesNotMatch(figure.imagePath, /placeholder/);
        const image = await readFile(join(root, "corpus/assets", figure.imagePath));
        assert.equal(createHash("sha256").update(image).digest("hex"), figure.sha256, figure.officialNumber);
        assert.equal(figure.region.height > 50, true, figure.officialNumber);
    }
    const units = await Promise.all(["3.3.1", "3.3.7", "3.4.2", "3.4.3.2", "3.4.3.3", "3.5.2", "3.5.4"]
        .map((number) => json(`corpus/units/ntc2018/${number}.json`)));
    const refs = units.flatMap((unit) => unit.blocks.filter((block: { kind: string }) => block.kind === "figure-ref"));
    assert.equal(refs.length, expected.length);
    assert.equal(new Set(refs.map((block: { assetId: string }) => block.assetId)).size, expected.length);
    for (const block of refs) assert.equal(block.evidence.extraction.tool, "poppler-pdf-crop");
});
