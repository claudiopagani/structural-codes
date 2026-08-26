import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = fileURLToPath(new URL("../", import.meta.url));
const formulaId = (suffix: string) => `urn:structural-codes:it:asset:formula:ntc2018:${suffix}`;

const expectedFormulas = new Map<string, string>([
    [formulaId("5.2.2.2.3-beta"), "\\begin{aligned}\\beta&=1{,}0\\quad\\text{per }L_\\Phi\\le8\\,\\mathrm{m}\\text{ ed }L_\\Phi>90\\,\\mathrm{m}\\\\\\beta&=1{,}1\\quad\\text{per }8\\,\\mathrm{m}<L_\\Phi\\le90\\,\\mathrm{m}\\end{aligned}"],
    [formulaId("5.2.8"), "\\Phi_{rid}=\\Phi-\\frac{h-1{,}00}{10}\\ge1{,}0"],
    [formulaId("5.2.9.a"), "Q_{tk}=\\frac{v^2}{g\\cdot r}\\cdot(f\\cdot\\alpha Q_{vk})=\\frac{V^2}{127\\cdot r}\\cdot(f\\cdot\\alpha Q_{vk})"],
    [formulaId("5.2.9.b"), "q_{tk}=\\frac{v^2}{g\\cdot r}\\cdot(f\\cdot\\alpha q_{vk})=\\frac{V^2}{127\\cdot r}\\cdot(f\\cdot\\alpha q_{vk})"],
    [formulaId("5.2.10-force"), "f=\\left[1-\\frac{V-120}{1000}\\left(\\frac{814}{V}+1{,}75\\right)\\cdot\\left(1-\\sqrt{\\frac{2{,}88}{L_f}}\\right)\\right]"],
    [formulaId("5.2.2.3.3-starting"), "\\begin{aligned}\\text{avviamento:}\\quad Q_{la,k}&=33\\,[\\mathrm{kN/m}]\\cdot L[\\mathrm{m}]\\le1000\\,\\mathrm{kN}\\quad\\text{per modelli di carico LM 71, SW/0,}\\\\&\\hspace{15.5em}\\text{SW/2}\\end{aligned}"],
    [formulaId("5.2.2.3.3-braking"), "\\begin{aligned}\\text{frenatura:}\\quad Q_{lb,k}&=20\\,[\\mathrm{kN/m}]\\cdot L[\\mathrm{m}]\\le6000\\,\\mathrm{kN}\\quad\\text{per modelli di carico LM 71, SW/0}\\\\Q_{lb,k}&=35\\,[\\mathrm{kN/m}]\\cdot L[\\mathrm{m}]\\quad\\text{per modelli di carico SW/2}\\end{aligned}"],
    [formulaId("5.2.2.6.1-k1"), "\\begin{aligned}k_1&=0{,}85\\quad\\text{per convogli formati da carrozze con sagoma arrotondata;}\\\\k_1&=0{,}60\\quad\\text{per treni aerodinamici.}\\end{aligned}"],
    [formulaId("5.2.2.6.3-k3"), "\\begin{aligned}k_3&=\\frac{7{,}5-h_g}{3{,}7}\\quad\\text{per }3{,}8\\,\\mathrm{m}<h_g<7{,}5\\,\\mathrm{m};\\\\k_3&=0\\quad\\text{per }h_g\\ge7{,}5\\,\\mathrm{m}\\end{aligned}"],
    [formulaId("5.2.10-distance"), "a'_g=0{,}6\\,\\min a_g+0{,}4\\,\\max a_g"],
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
    const inStep = (asset: { pdfPage: number }) => asset.pdfPage >= 172 && asset.pdfPage <= 181;
    return {
        formulas: manifests.flatMap((manifest) => manifest.formulas ?? []).filter(inStep),
        tables: manifests.flatMap((manifest) => manifest.tables ?? []).filter(inStep),
        figures: manifests.flatMap((manifest) => manifest.figures ?? []).filter(inStep),
    };
}

test("NTC pagine 172–181 conserva dieci gruppi display e corregge la struttura della formula 5.2.10", async () => {
    const { formulas } = await stepAssets();
    assert.equal(formulas.length, 10);
    assert.deepEqual(new Set(formulas.map((formula: { id: string }) => formula.id)), new Set(expectedFormulas.keys()));
    for (const formula of formulas as Array<{ id: string; latex: string }>) assert.equal(formula.latex, expectedFormulas.get(formula.id), formula.id);

    const force = formulas.find((formula: { id: string }) => formula.id === formulaId("5.2.10-force"));
    assert.match(force.latex, /\\left\[1-.*\\cdot\\left\(1-\\sqrt/u);
    assert.doesNotMatch(force.latex, /\\right\]\\left\[/u, "la fonte non moltiplica due parentesi quadre");
});

test("NTC pagine 172–181 colloca ogni display una volta e segmenta gli inline senza falsi positivi", async () => {
    const units = await allUnits();
    const refs = units.flatMap((unit) => unit.blocks).filter((block: { kind: string }) => block.kind === "formula-ref").map((block: { assetId: string }) => block.assetId);
    for (const id of expectedFormulas.keys()) assert.equal(refs.filter((candidate: string) => candidate === id).length, 1, id);

    const inStep = (page: number | undefined) => (page ?? 0) >= 172 && (page ?? 0) <= 181;
    const stepUnits = units.filter((unit) => unit.blocks.some((block: { evidence?: { pdfPage?: number } }) => inStep(block.evidence?.pdfPage)));
    assert.equal(stepUnits.length, 30);
    for (const unit of stepUnits) {
        for (const block of unit.blocks) {
            if (!block.text?.inline || !inStep(block.evidence?.pdfPage)) continue;
            assert.equal(block.text.inline.map((segment: { value: string }) => segment.value).join(""), block.text.normalized, block.blockId);
            for (const segment of block.text.inline) {
                if (segment.kind !== "math") continue;
                assert.ok(!/\d,(?=\d)/u.test(segment.latex), `${block.blockId}: virgola decimale non protetta`);
                assert.doesNotMatch(segment.value, /^(?:agenti|passaggio|stagionali)$/u, `${block.blockId}: falso positivo ag/hg`);
            }
        }
    }

    const dynamics = await json("corpus/units/ntc2018/5.2.2.2.3.json");
    assert.ok(!dynamics.blocks.some((block: { text?: { normalized?: string } }) => block.text?.normalized?.startsWith("β =")));
    const distance = await json("corpus/units/ntc2018/5.2.2.6.4.json");
    assert.ok(!distance.blocks.some((block: { text?: { normalized?: string } }) => block.text?.normalized?.startsWith("a’g =")));
});

test("NTC pagine 172–181 conserva le formule nelle tre tabelle e il segno più fra virgolette", async () => {
    const { tables } = await stepAssets();
    assert.deepEqual(tables.map((table: { officialNumber: string }) => table.officialNumber).sort(), ["5.2.II", "5.2.II.b", "5.2.III"].sort());

    const characteristic = tables.find((table: { officialNumber: string }) => table.officialNumber === "5.2.II");
    assert.equal(characteristic.rows[24][2].latex, "\\begin{gathered}L_\\Phi=kL_m\\quad\\text{dove:}\\\\n=2-3-4-\\ge5\\\\k=1{,}2-1{,}3-1{,}4-1{,}5\\end{gathered}");
    assert.equal(characteristic.rows[27][2].latex, "\\Phi_2=1{,}20;\\quad\\Phi_3=1{,}35");

    const centrifugal = tables.find((table: { officialNumber: string }) => table.officialNumber === "5.2.II.b");
    assert.ok(centrifugal.rows.flat().filter((cell: { latex?: string }) => cell.latex?.includes("LM71")).every((cell: { latex: string }) => cell.latex.includes('\\text{“+”}')));

    const trains = tables.find((table: { officialNumber: string }) => table.officialNumber === "5.2.III");
    assert.ok(trains.rows.flat().filter((cell: { text: string }) => cell.text.includes("LM71")).every((cell: { text: string; latex?: string }) => cell.text.includes("“+”") && cell.latex?.includes('\\text{“+”}')));
});

test("NTC pagine 172–181 usa sei crop ufficiali con hash verificabile", async () => {
    const { figures } = await stepAssets();
    assert.deepEqual(figures.map((figure: { officialNumber: string }) => figure.officialNumber).sort(), ["5.2.8", "5.2.9", "5.2.10", "5.2.11", "5.2.12", "5.2.13"].sort());
    for (const figure of figures as Array<{ imagePath: string; sha256: string }>) {
        const bytes = await readFile(join(root, "corpus/assets", figure.imagePath));
        assert.equal(createHash("sha256").update(bytes).digest("hex"), figure.sha256);
    }
});
