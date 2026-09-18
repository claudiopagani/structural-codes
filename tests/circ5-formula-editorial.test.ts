import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../", import.meta.url));

async function json(relativePath: string): Promise<unknown> {
    return JSON.parse(await readFile(join(repoRoot, relativePath), "utf8"));
}

test("Circolare C5.1.1-C5.1.9 conserva il LaTeX verificato sul PDF", async () => {
    const manifest = await json("corpus/assets/circ2019/C5-step2.json") as {
        formulas: Array<{ officialNumber: string; latex: string }>;
    };
    assert.deepEqual(
        manifest.formulas.map(({ officialNumber, latex }) => [officialNumber, latex]),
        [
            ["C5.1.1", "\\Delta\\sigma=\\sigma_{\\max}-\\sigma_{\\min}"],
            ["C5.1.2", "\\Delta\\varphi_{\\mathrm{fat}}=1{,}30\\cdot\\left(1-\\frac{d}{26}\\right)\\ge 1{,}0"],
            ["C5.1.3", "\\Delta T_{exp,d}=\\Delta T_{exp}+\\Delta T_0"],
            ["C5.1.4", "\\Delta T_{con,d}=\\Delta T_{con}+\\Delta T_0"],
            ["C5.1.5", "\\Delta T_{exp}=+T_{e,max}-T_0"],
            ["C5.1.6", "\\Delta T_{con}=-T_{e,min}+T_0"],
            ["C5.1.7", "\\Delta T_{exp,k}=\\Delta T_{exp}"],
            ["C5.1.8", "\\Delta T_{con,k}=\\Delta T_{con}"],
            ["C5.1.9", "2{,}50\\,\\mathrm{kN/m^2}\\le q_{f,r}=2{,}0+\\frac{120}{L+30}\\le 5{,}00\\,\\mathrm{kN/m^2}"],
        ],
    );
});

test("Circolare C5 conserva gli indici corsivi delle grandezze inline", async () => {
    const thermalUnit = await json("corpus/units/circ2019/c5.1.4.5.json") as {
        blocks: Array<{ text?: { inline?: Array<{ kind: string; latex?: string }> } }>;
    };
    const pedestrianUnit = await json("corpus/units/circ2019/c5.1.8.json") as typeof thermalUnit;
    const latex = [...thermalUnit.blocks, ...pedestrianUnit.blocks]
        .flatMap((block) => block.text?.inline ?? [])
        .filter((segment) => segment.kind === "math")
        .map((segment) => segment.latex);
    assert.ok(latex.includes("T_{e,max}"));
    assert.ok(latex.includes("Q_{sv1}"));
    assert.ok(!latex.some((value) => value?.includes("\\mathrm{e,") || value?.includes("\\mathrm{sv")));
});

test("Circolare C5 non trasforma in matematica le preposizioni d’arte e d’uso", async () => {
    const units = await Promise.all([
        json("corpus/units/circ2019/c5.2.2.5.json"),
        json("corpus/units/circ2019/c5.2.3.2.3.json"),
    ]) as Array<{ blocks: Array<{ text?: { normalized: string; inline?: Array<{ value: string }> } }> }>;
    for (const unit of units) {
        for (const block of unit.blocks) {
            if (/d[’'](?:arte|uso)/u.test(block.text?.normalized ?? "")) {
                assert.ok(!block.text?.inline?.some((segment) => segment.value === "d"));
            }
        }
    }
});

test("Circolare C5 rende q_1 e q_8 in KaTeX nei titoli e non etichetta la tabella ΔT_0", async () => {
    const titleMath = async (unitNumber: string) => {
        const unit = await json(`corpus/units/circ2019/${unitNumber.toLowerCase()}.json`) as {
            blocks: Array<{ text?: { inline?: Array<{ kind: string; value?: string; latex?: string }> } }>;
        };
        return unit.blocks[0]?.text?.inline?.find((segment) => segment.kind === "math");
    };
    assert.deepEqual(await titleMath("C5.1.3.3"), { kind: "math", value: "q_1", latex: "q_{1}" });
    assert.deepEqual(await titleMath("C5.1.3.10"), { kind: "math", value: "q_8", latex: "q_{8}" });

    const manifest = await json("corpus/assets/circ2019/C5-step2.json") as {
        tables: Array<{
            id: string;
            caption: string | null;
            hideLabel?: boolean;
            columnWidths?: number[];
            notes: string[];
            rows?: Array<Array<{ text: string; inline?: Array<{ kind: string; value: string; latex?: string }> }>>;
        }>;
    };
    const thermalTable = manifest.tables.find(({ id }) => id.endsWith(":c5.delta-t0"));
    assert.ok(thermalTable);
    assert.equal(thermalTable.caption, null);
    assert.equal(thermalTable.hideLabel, true);
    assert.deepEqual(thermalTable.columnWidths, [60, 40]);
    assert.deepEqual(thermalTable.notes, []);
    assert.equal(thermalTable.rows?.[0]?.[0]?.inline?.[1]?.value, " per strutture di c.a., c.a.p. e acciaio/cls");
    assert.equal(thermalTable.rows?.[1]?.[0]?.inline?.[1]?.value, " per strutture di acciaio");
    for (const row of thermalTable.rows ?? []) {
        const firstCell = row[0];
        if (!firstCell) continue;
        assert.equal(firstCell.inline?.map((segment) => segment.value).join(""), firstCell.text);
    }
});
