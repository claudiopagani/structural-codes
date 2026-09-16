/* eslint-disable @typescript-eslint/no-explicit-any */
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../", import.meta.url));

// Canonical records intentionally contain heterogeneous block and asset shapes.
async function json(relativePath: string): Promise<any> {
    return JSON.parse(await readFile(join(repoRoot, relativePath), "utf8"));
}

test("le frazioni nelle formule inline di NTC e Circolare sono rese con slash", async () => {
    const remaining: string[] = [];
    const malformed: string[] = [];
    for (const document of ["ntc2018", "circ2019"]) {
        const directory = join(repoRoot, "corpus/units", document);
        for (const fileName of (await readdir(directory)).filter((name) => name.endsWith(".json"))) {
            const unit = await json(`corpus/units/${document}/${fileName}`);
            for (const block of unit.blocks) {
                for (const segment of block.text?.inline ?? []) {
                    if (segment.kind !== "math" || typeof segment.latex !== "string") continue;
                    if (segment.latex.includes("\\frac")) remaining.push(`${document}/${fileName}: ${segment.latex}`);
                    if (/\\cdot[A-Za-z]/u.test(segment.latex)) malformed.push(`${document}/${fileName}: ${segment.latex}`);
                }
            }
        }
    }
    assert.deepEqual(remaining, []);
    assert.deepEqual(malformed, []);
});

test("il caso C3.2.1 conserva la formula inline su una sola riga", async () => {
    const unit = await json("corpus/units/circ2019/c3.2.1.json");
    const formulas = unit.blocks
        .flatMap((block: any) => block.text?.inline ?? [])
        .filter((segment: any) => segment.kind === "math")
        .map((segment: any) => segment.latex);
    assert.ok(formulas.includes("\\left[T_R=-C_U\\cdot V_N/\\ln(1-P_{VR})=-C_U\\cdot V_N/\\text{costante}\\right]"));
    assert.ok(formulas.includes("T_R=-V_N/\\ln(1-P_{VR}/C_U)"));
});

test("solo le celle tabellari composte inline convertono \\frac", async () => {
    const circ = await json("corpus/assets/circ2019/core-tables.json");
    const inlineTableNumbers = new Set([
        "C3.3.I",
        "C3.3.II",
        "C3.3.V",
        "C3.3.VI",
        "C3.3.IX",
        "C3.3.X",
        "C3.3.XIII",
        "C3.3.XVI",
    ]);
    for (const table of circ.tables.filter((candidate: any) => inlineTableNumbers.has(candidate.officialNumber))) {
        for (const row of [...(table.headers ?? []), ...(table.rows ?? [])]) {
            for (const cell of row) {
                assert.doesNotMatch(cell.latex ?? "", /\\frac/u, table.officialNumber);
            }
        }
    }
    assert.equal(
        circ.tables.find((table: any) => table.officialNumber === "C4.1.I").captionInline[4].latex,
        "l/h",
    );
    assert.equal(
        circ.tables.find((table: any) => table.officialNumber === "C3.3.XVIII").captionInline[10].latex,
        "k/b\\le0{,}5\\cdot10^{-3}",
    );

    const ntc = await json("corpus/assets/ntc2018/5.1-step3.json");
    const characteristicLength = ntc.tables.find((table: any) => table.officialNumber === "5.2.II").rows[24][1].latex;
    assert.equal(
        characteristicLength,
        "\\begin{gathered}\\text{5.2 Travi e solette continue su }n\\text{ luci, indicando con:}\\\\L_m=1/n\\cdot(L_1+L_2+\\ldots+L_n)\\end{gathered}",
    );
});

test("le frazioni in display e nelle celle impaginate su più righe restano frazioni", async () => {
    const displayManifest = await json("corpus/assets/circ2019/core-editorial.json");
    assert.ok(displayManifest.formulas.some((formula: any) => formula.latex.includes("\\frac")));

    const stackedTableManifest = await json("corpus/assets/ntc2018/4.2-step4d.json");
    const stackedTable = stackedTableManifest.tables.find((table: any) => table.officialNumber === "4.2.XII");
    assert.ok(stackedTable.rows.flat().some((cell: any) => typeof cell.latex === "string" && /\\d?frac/u.test(cell.latex)));
});
