import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = fileURLToPath(new URL("../", import.meta.url));
const formulaId = (number: string) => "urn:structural-codes:it:asset:formula:ntc2018:" + number;
const tableId = (number: string) => "urn:structural-codes:it:asset:table:ntc2018:" + number.toLowerCase();
const formulaNumbers = ["3.6.1", "3.6.2", "3.6.3", "3.6.4", "3.6.5a", "3.6.5b", "3.6.6", "3.6.7", "3.6.8", "3.6.9"];
const unitNumbers = [
    "3.5.4", "3.5.5", "3.5.7", "3.6.1.1", "3.6.1.2", "3.6.1.5.1",
    "3.6.2.2", "3.6.2.3", "3.6.3.2", "3.6.3.3.1", "3.6.3.3.2", "3.6.3.4",
];
type Formula = { officialNumber: string; latex: string };
type TableCell = { text: string; latex?: string; colSpan?: number; rowSpan?: number; align?: string };
type Table = { officialNumber: string; columnCount: number; headers: TableCell[][]; rows: TableCell[][] };

async function json(path: string) {
    return JSON.parse(await readFile(join(root, path), "utf8"));
}

test("NTC pagine 65–71 conserva le dieci formule display ufficiali", async () => {
    const manifest = await json("corpus/assets/ntc2018/core-editorial.json");
    const formulas = manifest.formulas.filter((formula: { pdfPage: number }) => formula.pdfPage >= 65 && formula.pdfPage <= 71) as Formula[];
    assert.deepEqual(formulas.map((formula) => formula.officialNumber), formulaNumbers);
    const byNumber = new Map<string, Formula>(formulas.map((formula) => [formula.officialNumber, formula]));
    assert.equal(byNumber.get("3.6.1")!.latex, "q_{f,d}=q_f\\cdot\\delta_{q1}\\cdot\\delta_{q2}\\cdot\\delta_n");
    assert.equal(byNumber.get("3.6.2")!.latex, "\\theta_g=20+345\\log_{10}(8t+1)\\,[{}^\\circ\\mathrm{C}]");
    assert.equal(byNumber.get("3.6.3")!.latex.includes("0{,}675\\cdot e^{-2{,}5t}"), true);
    assert.equal(byNumber.get("3.6.4")!.latex.includes("0{,}313\\cdot e^{-3{,}8t}"), true);
    assert.equal(byNumber.get("3.6.5b")!.latex, "p_d=3+\\frac{p_v}{2}+\\frac{0{,}04}{(A_v/V)^2}");
    assert.equal(byNumber.get("3.6.6")!.latex, "0{,}05\\,\\mathrm{m}^{-1}\\le\\frac{A_v}{V}\\le0{,}15\\,\\mathrm{m}^{-1}");
    assert.equal(byNumber.get("3.6.7")!.latex, "F_{d,y}=0{,}50F_{d,x}");
    assert.equal(byNumber.get("3.6.9")!.latex, "F=5W");
});

test("NTC pagine 65–71 colloca ogni formula una sola volta e separa il testo estratto", async () => {
    const units = await Promise.all(unitNumbers.map((number) => json("corpus/units/ntc2018/" + number + ".json")));
    const refs = units.flatMap((unit) => unit.blocks.filter((block: { kind: string }) => block.kind === "formula-ref"));
    const ids = refs.map((block: { assetId: string }) => block.assetId);
    for (const number of formulaNumbers) {
        assert.equal(ids.filter((id: string) => id === formulaId(number)).length, 1, number);
    }
    for (const unit of units) {
        for (const block of unit.blocks) {
            if (!block.text?.normalized) continue;
            assert.doesNotMatch(block.text.normalized, />3\.6\.|[ǂǃȡ@]|(?:^|\s)qT(?:\s|$)/);
            if (block.text.inline) {
                assert.equal(block.text.inline.map((segment: { value: string }) => segment.value).join(""), block.text.normalized);
            }
        }
    }
});

test("NTC Tabelle 3.5.I–IV e 3.6.I–III conservano griglia, celle unite e matematica", async () => {
    const manifest = await json("corpus/assets/ntc2018/core-tables.json");
    const expected = ["3.5.I", "3.5.II", "3.5.III", "3.5.IV", "3.6.I", "3.6.II", "3.6.III"];
    const tables = manifest.tables.filter((table: { officialNumber: string }) => expected.includes(table.officialNumber)) as Table[];
    assert.deepEqual(tables.map((table) => table.officialNumber), expected);
    const byNumber = new Map<string, Table>(tables.map((table) => [table.officialNumber, table]));
    assert.equal(byNumber.get("3.5.I")!.columnCount, 4);
    assert.equal(byNumber.get("3.5.I")!.headers[0]![2]!.colSpan, 2);
    assert.equal(byNumber.get("3.5.I")!.rows[0]![0]!.rowSpan, 3);
    assert.equal(byNumber.get("3.5.I")!.headers[1]![0]!.text, "superfici esposte\na Nord-Est");
    assert.equal(byNumber.get("3.5.I")!.headers[1]![1]!.text, "superfici esposte a Sud-Ovest\nod orizzontali");
    assert.equal(byNumber.get("3.5.I")!.rows.every((row) => row.slice(-2).every((cell) => cell.align === "center")), true);
    assert.equal(byNumber.get("3.5.II")!.rows[2]![1]!.latex, "\\pm25\\,{}^\\circ\\mathrm{C}");
    assert.equal(byNumber.get("3.5.II")!.headers[0]![1]!.align, "center");
    assert.equal(byNumber.get("3.5.II")!.rows.every((row) => row[1]!.align === "center"), true);
    assert.equal(byNumber.get("3.5.III")!.rows[7]![1]!.latex, "30\\div70");
    assert.equal(byNumber.get("3.5.III")!.headers[0]![1]!.align, "center");
    assert.equal(byNumber.get("3.5.III")!.rows.every((row) => row[1]!.align === "center"), true);
    assert.equal(byNumber.get("3.5.IV")!.rows.length, 5);
    assert.equal(byNumber.get("3.6.I")!.rows[2]![1]!.text, "Effetti generalizzati sulle strutture");
    assert.equal(byNumber.get("3.6.II")!.columnCount, 2);
    assert.equal(byNumber.get("3.6.III")!.rows[3]![0]!.rowSpan, 2);
    assert.equal(byNumber.get("3.6.III")!.headers[0]![2]!.latex, "F_{d,x}\\,[\\mathrm{kN}]");
    for (const officialNumber of ["3.6.I", "3.6.II"]) {
        const table = byNumber.get(officialNumber)!;
        assert.equal(table.headers[0]![0]!.align, "center", officialNumber);
        assert.equal(table.rows.every((row) => row[0]!.align === "center"), true, officialNumber);
    }
    assert.equal(byNumber.get("3.6.III")!.headers[0]![2]!.align, "center");
    assert.equal(byNumber.get("3.6.III")!.rows.every((row) => row.at(-1)!.align === "center"), true);
    const tableRefs: Array<[string, string]> = [
        ["3.5.4", "3.5.I"], ["3.5.5", "3.5.II"], ["3.5.7", "3.5.III"], ["3.6.1.2", "3.5.IV"],
        ["3.6.2.2", "3.6.I"], ["3.6.3.2", "3.6.II"], ["3.6.3.3.1", "3.6.III"],
    ];
    const refs = await Promise.all(tableRefs.map(async ([unit, table]) => {
        const record = await json("corpus/units/ntc2018/" + unit + ".json");
        return [record.assets.tableIds, tableId(table)];
    }));
    for (const [tableIds, expectedId] of refs) assert.deepEqual(tableIds, [expectedId]);
});

test("NTC § 3.6.1.5.1 e § 3.6.3.4 conservano corsivi e nesting delle liste", async () => {
    const fireCurves = await json("corpus/units/ntc2018/3.6.1.5.1.json");
    const curveBlocks = ["editorial-007", "editorial-009"].map((suffix) => fireCurves.blocks.find((candidate: { blockId: string }) => candidate.blockId.endsWith("#block-" + suffix)));
    assert.deepEqual(curveBlocks.map((candidate) => candidate.text.inline.filter((segment: { kind: string }) => segment.kind === "em").map((segment: { value: string }) => segment.value)), [
        ["curva nominale degli idrocarburi"], ["curva nominale esterna"],
    ]);

    const impacts = await json("corpus/units/ntc2018/3.6.3.4.json");
    const nested = impacts.blocks.filter((candidate: { blockId: string }) => /#block-editorial-00[5-9]|#block-editorial-010|#block-editorial-011$/u.test(candidate.blockId));
    assert.deepEqual(nested.map((candidate: { listMarker?: string; listLevel?: number }) => [candidate.listMarker, candidate.listLevel]), [
        ["bullet", 0], ["dash", 1], ["dash", 1], ["bullet", 0], ["dash", 1], ["dash", 1], ["bullet", 0],
    ]);
});

test("NTC § 3.6.1.1 conserva corsivi, label e allineamento degli elenchi", async () => {
    const unit = await json("corpus/units/ntc2018/3.6.1.1.json");
    const block = (suffix: string) => unit.blocks.find((candidate: { blockId: string }) => candidate.blockId.endsWith("#block-" + suffix));
    assert.deepEqual(
        ["editorial-004", "editorial-004-b", "editorial-015", "editorial-016", "editorial-017", "editorial-018"].map((suffix) => [block(suffix).kind, block(suffix).listMarker]),
        [["list-item", "none"], ["list-item", "none"], ["list-item", "none"], ["list-item", "none"], ["list-item", "none"], ["list-item", "none"]],
    );
    assert.deepEqual(
        ["editorial-004", "editorial-004-b"].map((suffix) => block(suffix).text.inline[0].value),
        ["nominale", "naturale"],
    );
    assert.deepEqual(
        ["editorial-001", "editorial-002", "editorial-005", "editorial-006", "editorial-007", "editorial-008", "editorial-009", "editorial-010", "editorial-011", "editorial-019"].map((suffix) => block(suffix).text.inline.filter((segment: { kind: string }) => segment.kind === "em").map((segment: { value: string }) => segment.value)),
        [["incendio"], ["incendio convenzionale di progetto", "curva di incendio"], ["capacità di compartimentazione"], ["capacità portante in caso di incendio"], ["resistenza al fuoco"], ["compartimento antincendio"], ["carico di incendio"], ["carico d’incendio specifico"], ["carico di incendio specifico di progetto"], ["incendio localizzato"]],
    );
    assert.deepEqual(
        ["editorial-015", "editorial-016", "editorial-017", "editorial-018"].map((suffix) => block(suffix).text.inline[0].latex),
        ["q_f", "\\delta_{q1}\\ge1{,}00", "\\delta_{q2}\\ge0{,}80", "\\delta_n=\\prod_{i=1}^{10}\\delta_{ni}\\ge0{,}20"],
    );
});
