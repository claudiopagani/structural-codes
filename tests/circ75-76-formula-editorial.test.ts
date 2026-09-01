import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = fileURLToPath(new URL("../", import.meta.url));
const readJson = async (relativePath: string) => JSON.parse(await readFile(join(root, relativePath), "utf8"));
type Segment = { kind: string; value: string; latex: string };
type Unit = { blocks: Array<{ kind: string; text?: { inline?: Segment[] } }> };
const math = (unit: Unit): Segment[] =>
    unit.blocks.flatMap((block) => block.text?.inline ?? []).filter((segment) => segment.kind === "math");

test("C7.5 conserva i prodotti e la disuguaglianza delle tre formule display", async () => {
    const manifest = await readJson("corpus/assets/circ2019/7.5.json");
    assert.deepEqual(
        manifest.formulas.map(({ officialNumber, latex }: { officialNumber: string; latex: string }) => [officialNumber, latex]),
        [
            ["C7.5.1", "V_{WP,Ed,U}=\\gamma_{ov}\\cdot\\frac{\\sum M_{b,pl,Rd}}{Z}\\left(1-\\frac{z}{H-h_b}\\right)"],
            ["C7.5.2", "V_{WP,Rd}\\ge\\frac{f_y}{\\sqrt{3}}\\cdot A_{VC}\\cdot\\sqrt{1-\\left(\\frac{\\sigma}{f_y}\\right)^2}"],
            ["C7.5.3", "\\left|\\frac{A^+-A^-}{A^++A^-}\\right|\\le0{,}05"],
        ],
    );

    const panel = math(await readJson("corpus/units/circ2019/c7.5.4.4.json"));
    assert.equal(panel.some(({ value, latex }) => value === "z" && latex === "z"), true);
    assert.equal(panel.some(({ value }) => value === "z è"), false);
    assert.equal(panel.some(({ value, latex }) => value === "σ" && latex === "\\sigma"), true);

    for (const number of ["c7.5.3.1", "c7.5.4", "c7.5.5", "c7.5.6"]) {
        const unit = await readJson(`corpus/units/circ2019/${number}.json`);
        const heading = unit.blocks.find((block: { kind: string }) => block.kind === "heading");
        assert.equal(heading.text.inline, undefined, number);
    }
});

test("C7.6.1-C7.6.4 conserva tutti i punti di moltiplicazione ufficiali", async () => {
    const manifest = await readJson("corpus/assets/circ2019/7.6.json");
    const formulas = manifest.formulas
        .filter(({ pdfPage }: { pdfPage: number }) => pdfPage === 226)
        .map(({ officialNumber, latex }: { officialNumber: string; latex: string }) => [officialNumber, latex]);
    assert.deepEqual(formulas, [
        ["C7.6.1", "F_{Rd,1}=d_{eff}\\cdot b_b\\cdot f_{cd}"],
        ["C7.6.2", "A_r\\ge0{,}25\\cdot d_{eff}\\cdot b_b\\cdot\\frac{0{,}15l-b_b}{0{,}15l}\\cdot\\frac{f_{cd}}{f_{yd,T}}"],
        ["C7.6.3", "F_{Rd,2}=0{,}7\\cdot h_c\\cdot d_{eff}\\cdot f_{cd}"],
        ["C7.6.4", "A_T\\ge\\frac{F_{Rd,2}}{2\\cdot f_{yd,T}}"],
    ]);

    const current = math(await readJson("corpus/units/circ2019/c7.6.4.5.1.json"));
    assert.equal(current.some(({ value, latex }) => value === "30 mm" && latex === "30\\,\\mathrm{mm}"), true);
    assert.equal(current.some(({ value, latex }) => value === "l" && latex === "l"), true);
    for (const number of ["c7.6", "c7.6.4", "c7.6.4.5"]) {
        assert.equal(math(await readJson(`corpus/units/circ2019/${number}.json`)).some(({ value }) => value === "l"), false, number);
    }
});
