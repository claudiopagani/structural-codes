import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = fileURLToPath(new URL("../", import.meta.url));
const formulaId = (number: string) => `urn:structural-codes:it:asset:formula:ntc2018:${number}`;

const expectedFormulas = new Map<string, string>([
    [formulaId("5.2.1"), "\\frac{Q_{v2}}{Q_{v1}}=1{,}25"],
    [formulaId("5.2.2"), "n_0=94{,}76\\cdot L^{-0{,}748}"],
    [formulaId("5.2.3"), "n_0=80/L\\qquad\\text{per}\\quad4\\,\\mathrm{m}\\le L\\le20\\,\\mathrm{m}"],
    [formulaId("5.2.4"), "n_0=23{,}58\\cdot L^{-0{,}592}\\qquad\\text{per}\\quad20\\,\\mathrm{m}\\le L\\le100\\,\\mathrm{m}"],
    [formulaId("5.2.5"), "n_0=\\frac{17{,}75}{\\sqrt{\\delta_0}}\\;[\\mathrm{Hz}]"],
    [formulaId("5.2.6"), "\\Phi_2=\\frac{1{,}44}{\\sqrt{L_\\Phi}-0{,}2}+0{,}82\\qquad\\text{con la limitazione}\\quad1{,}00\\le\\Phi_2\\le1{,}67"],
    [formulaId("5.2.7"), "\\Phi_3=\\frac{2{,}16}{\\sqrt{L_\\Phi}-0{,}2}+0{,}73\\qquad\\text{con la limitazione}\\quad1{,}00\\le\\Phi_3\\le2{,}00"],
]);

async function json(path: string) {
    return JSON.parse(await readFile(join(root, path), "utf8"));
}

async function allUnits() {
    const names = (await readdir(join(root, "corpus/units/ntc2018"))).filter((name) => name.endsWith(".json"));
    return Promise.all(names.map((name) => json(`corpus/units/ntc2018/${name}`)));
}

async function stepAssets() {
    const names = (await readdir(join(root, "corpus/assets/ntc2018"))).filter((name) => name.endsWith(".json"));
    const manifests = await Promise.all(names.map((name) => json(`corpus/assets/ntc2018/${name}`)));
    const inStep = (asset: { pdfPage: number }) => asset.pdfPage >= 162 && asset.pdfPage <= 171;
    return {
        formulas: manifests.flatMap((manifest) => manifest.formulas ?? []).filter(inStep),
        tables: manifests.flatMap((manifest) => manifest.tables ?? []).filter(inStep),
        figures: manifests.flatMap((manifest) => manifest.figures ?? []).filter(inStep),
    };
}

test("NTC pagine 162–171 conserva esattamente le formule 5.2.1–5.2.7", async () => {
    const { formulas } = await stepAssets();
    assert.equal(formulas.length, 7);
    assert.deepEqual(new Set(formulas.map((formula: { id: string }) => formula.id)), new Set(expectedFormulas.keys()));
    for (const formula of formulas as Array<{ id: string; latex: string }>) assert.equal(formula.latex, expectedFormulas.get(formula.id), formula.id);
});

test("NTC pagine 162–171 colloca le formule una volta e segmenta gli inline senza duplicare i display", async () => {
    const units = await allUnits();
    const refs = units.flatMap((unit) => unit.blocks).filter((block: { kind: string }) => block.kind === "formula-ref").map((block: { assetId: string }) => block.assetId);
    for (const id of expectedFormulas.keys()) assert.equal(refs.filter((candidate: string) => candidate === id).length, 1, id);

    const inStep = (page: number | undefined) => (page ?? 0) >= 162 && (page ?? 0) <= 171;
    const stepUnits = units.filter((unit) => unit.blocks.some((block: { evidence?: { pdfPage?: number } }) => inStep(block.evidence?.pdfPage)));
    assert.equal(stepUnits.length, 43);
    for (const unit of stepUnits) {
        for (const block of unit.blocks) {
            if (!block.text?.inline || !inStep(block.evidence?.pdfPage)) continue;
            assert.equal(block.text.inline.map((segment: { value: string }) => segment.value).join(""), block.text.normalized, block.blockId);
            for (const segment of block.text.inline) {
                if (segment.kind !== "math") continue;
                assert.ok(!segment.latex.includes("\\\\"), `${block.blockId}: doppio escape LaTeX`);
                assert.ok(!/\d,(?=\d)/u.test(segment.latex), `${block.blockId}: virgola decimale non protetta`);
                assert.notEqual(segment.value, "ag", `${block.blockId}: falso positivo dentro una parola italiana`);
            }
        }
    }

    const fatigue = await json("corpus/units/ntc2018/5.1.4.3.json");
    const stress = fatigue.blocks.find((block: { text?: { normalized?: string } }) => block.text?.normalized?.includes("Δσmax"));
    assert.equal(stress.text.inline.find((segment: { value: string }) => segment.value.startsWith("Δσmax =")).latex, "\\Delta\\sigma_{\\max}=(\\sigma_{\\max}-\\sigma_{\\min})");
    assert.ok(fatigue.blocks.some((block: { text?: { normalized?: string; inline?: Array<{ latex?: string }> } }) => block.text?.normalized?.includes("metodo λ") && block.text.inline?.some((segment) => segment.latex === "\\lambda")));

    const railway = await json("corpus/units/ntc2018/5.2.2.2.1.1.json");
    const wheels = railway.blocks.find((block: { text?: { normalized?: string } }) => block.text?.normalized?.startsWith("essendo QV1"));
    assert.deepEqual(wheels.text.inline.filter((segment: { kind: string }) => segment.kind === "math").map((segment: { latex: string }) => segment.latex), ["Q_{v1}", "Q_{v2}", "s/18\\text{ con }s=1435\\,\\mathrm{mm}"]);

    const dynamics = await json("corpus/units/ntc2018/5.2.2.2.3.json");
    const page171Text = dynamics.blocks.filter((block: { evidence?: { pdfPage?: number }; text?: { normalized?: string } }) => block.evidence?.pdfPage === 171 && block.text).map((block: { text: { normalized: string } }) => block.text.normalized);
    assert.ok(!page171Text.some((text: string) => /n₀\s*=|Φ₂\s*=|Φ₃\s*=/u.test(text)), "le formule display non devono essere duplicate nei capoversi");
    assert.deepEqual(dynamics.blocks.filter((block: { evidence?: { pdfPage?: number }; kind: string }) => block.evidence?.pdfPage === 171 && block.kind === "formula-ref").map((block: { assetId: string }) => block.assetId), [...expectedFormulas.keys()].slice(1));
});

test("NTC pagine 162–171 conserva cinque tabelle con matematica strutturata", async () => {
    const { tables } = await stepAssets();
    assert.deepEqual(tables.map((table: { officialNumber: string }) => table.officialNumber).sort(), ["5.1.VII", "5.1.VIII", "5.1.IX", "5.1.X", "5.2.I"].sort());

    const frequent = tables.find((table: { officialNumber: string }) => table.officialNumber === "5.1.VII");
    assert.equal(frequent.headers[0][1].latex, "\\text{Distanza tra gli assi }(\\mathrm{m})");
    assert.equal(frequent.rows[1][1].latex, "\\begin{gathered}4{,}20\\\\1{,}30\\end{gathered}");
    assert.equal(frequent.rows[2][2].latex, "\\begin{gathered}90\\\\180\\\\120\\\\120\\\\120\\end{gathered}");

    const traffic = tables.find((table: { officialNumber: string }) => table.officialNumber === "5.1.X");
    assert.deepEqual(traffic.rows.map((row: Array<{ latex: string }>) => row.at(1)?.latex), ["2{,}0\\times 10^6", "0{,}5\\times 10^6", "0{,}125\\times 10^6", "0{,}05\\times 10^6"]);

    const sw = tables.find((table: { officialNumber: string }) => table.officialNumber === "5.2.I");
    assert.deepEqual(sw.headers[0].slice(1).map((cell: { latex: string }) => cell.latex), ["q_{vk}\\;[\\mathrm{kN/m}]", "a\\;[\\mathrm{m}]", "c\\;[\\mathrm{m}]"]);
    assert.deepEqual(sw.rows.map((row: Array<{ latex?: string }>) => row.slice(1).map((cell) => cell.latex)), [["133", "15{,}0", "5{,}3"], ["150", "25{,}0", "7{,}0"]]);
});

test("NTC pagine 162–171 usa nove crop ufficiali con hash verificabile", async () => {
    const { figures } = await stepAssets();
    assert.deepEqual(figures.map((figure: { officialNumber: string }) => figure.officialNumber).sort(), ["5.1.4", "5.1.5", "5.2.1", "5.2.2", "5.2.3", "5.2.4", "5.2.5", "5.2.6", "5.2.7"].sort());
    for (const figure of figures as Array<{ imagePath: string; sha256: string }>) {
        const bytes = await readFile(join(root, "corpus/assets", figure.imagePath));
        assert.equal(createHash("sha256").update(bytes).digest("hex"), figure.sha256);
    }
});
