/* eslint-disable @typescript-eslint/no-explicit-any */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = fileURLToPath(new URL("../", import.meta.url));
const fid = (suffix: string) =>
    "urn:structural-codes:it:asset:formula:ntc2018:" + suffix;

async function json(path: string) {
    return JSON.parse(await readFile(join(root, path), "utf8"));
}

async function allUnits() {
    const names = (await readdir(join(root, "corpus/units/ntc2018"))).filter(
        (name) => name.endsWith(".json"),
    );
    return Promise.all(
        names.map((name) => json("corpus/units/ntc2018/" + name)),
    );
}

async function stepAssets() {
    const manifest = await json("corpus/assets/ntc2018/7.7-78-step2.json");
    const inStep = (asset: { pdfPage: number }) =>
        asset.pdfPage >= 267 && asset.pdfPage <= 271;
    return {
        formulas: (manifest.formulas ?? []).filter(inStep),
        tables: (manifest.tables ?? []).filter(inStep),
        figures: (manifest.figures ?? []).filter(inStep),
    };
}

const expected = new Map<string, string>([
    [fid("7.8.3.2.2-7.8.7"), "V_t=V_{t,M}+V_{t,S}"],
    [fid("7.8.3.2.2-7.8.8"), "V_{t,M}=d\\cdot t\\cdot f_{vd}"],
    [fid("7.8.3.2.2-7.8.9"), "V_{t,S}=(0{,}6\\cdot d\\cdot A_{sw}\\cdot f_{vd})/s"],
    [fid("7.8.3.2.2-7.8.10"), "V_{t,c}=0{,}3\\cdot f_d\\cdot t\\cdot d"],
    [fid("7.9.2.1-7.9.1"), "q_0(\\nu_k)=q_0-\\left[\\frac{\\nu_k}{0{,}3}-1\\right]\\cdot(q_0-1)"],
    [fid("7.9.2.1-7.9.2"), "K_R=2/\\tilde r"],
    [fid("7.9.4-7.9.3"), "\\Delta M=d_{Ed}\\cdot N_{Ed}"],
    [fid("7.9.4.1-7.9.4"), "T_1=2\\pi\\sqrt{M/K}"],
    [fid("7.9.4.1-7.9.5"), "F_i=\\frac{4\\pi^2}{T_1^2}\\frac{S_d(T_1)}{g^2}\\cdot d_i\\cdot G_i"],
]);

test("NTC pagine 267–271 conserva le nove formule in display", async () => {
    const { formulas, tables, figures } = await stepAssets();
    assert.equal(formulas.length, 9);
    assert.equal(tables.length, 0);
    assert.equal(figures.length, 1);
    assert.deepEqual(
        new Set(formulas.map((formula: any) => formula.id)),
        new Set(expected.keys()),
    );
    for (const formula of formulas) {
        assert.equal(formula.latex, expected.get(formula.id), formula.id);
        assert.notEqual(formula.officialNumber, null, formula.id);
    }
    for (const suffix of ["7.8.3.2.2-7.8.9", "7.9.2.1-7.9.2", "7.9.4.1-7.9.4"]) {
        assert.ok(!expected.get(fid(suffix))?.includes("\\frac"), suffix);
    }
});

test("NTC pagine 267–271 conserva matematica inline completa e confini dei simboli", async () => {
    const units = await allUnits();
    const inStep = (page: number | undefined) =>
        (page ?? 0) >= 267 && (page ?? 0) <= 271;
    const stepUnits = units.filter((unit) =>
        unit.blocks.some((block: any) => inStep(block.evidence?.pdfPage)),
    );
    assert.equal(stepUnits.length, 20);

    const latex = new Set<string>();
    for (const unit of stepUnits) {
        for (const block of unit.blocks) {
            if (!inStep(block.evidence?.pdfPage) || !block.text?.inline) continue;
            const segments = block.text.inline;
            assert.equal(
                segments.map((segment: any) => segment.value).join(""),
                block.text.normalized,
                block.blockId,
            );
            assert.doesNotMatch(block.text.normalized, /[΅ΏǊ·ǂǃȭΑȞ]/u, block.blockId);
            for (let index = 0; index < segments.length; index += 1) {
                const segment = segments[index];
                if (segment.kind !== "math") continue;
                latex.add(segment.latex);
                if (!/^[A-Za-z]$/u.test(segment.value)) continue;
                const before = segments[index - 1]?.value?.at(-1);
                const after = segments[index + 1]?.value?.at(0);
                assert.ok(
                    before === undefined || !/[\p{L}\p{N}_]/u.test(before),
                    block.blockId,
                );
                assert.ok(
                    after === undefined || !/[\p{L}\p{N}_]/u.test(after),
                    block.blockId,
                );
            }
        }
    }

    for (const required of [
        "0{,}8",
        "0{,}85f_d",
        "\\varepsilon_m=0{,}0035",
        "\\varepsilon_s=0{,}01",
        "1{,}6\\%",
        "f_{yd}=f_{yk}/\\gamma_M",
        "\\sigma_n=P/dt",
        "0{,}8\\%",
        "0{,}25\\cdot t",
        "0{,}2\\cdot t",
        "8\\,\\mathrm{cm}^2",
        "0{,}04\\%",
        "1{,}5\\,\\mathrm{m}^2",
        "300\\,\\mathrm{mm}^2",
        "1\\%",
        "q_0",
        "\\lambda(\\alpha)=(\\alpha/3)^{0{,}5}",
        "3>\\alpha\\ge1",
        "\\nu_k=N_{Ed}/A_c f_{ck}",
        "T\\le0{,}03\\,\\mathrm{s}",
        "r_i=q_0M_{Ed,i}/M_{Rd,i}",
        "\\tilde r=r_{i,\\max}/r_{i,\\min}<2",
        "q=q_0K_R\\ge1",
        "20\\%",
        "45^\\circ",
        "\\varphi>20^\\circ",
        "B/L>2{,}0",
        "0{,}03",
        "S_d(T_1)",
        "f_i=G_i",
    ]) {
        assert.ok(latex.has(required), required);
    }
});

test("NTC pagine 268–271 non converte lettere discorsive in matematica", async () => {
    const ordinary = await json("corpus/units/ntc2018/7.8.6.1.json");
    const cordoli = ordinary.blocks.find((block: any) => block.blockId.endsWith("#block-p2"));
    assert.equal(
        cordoli.text.inline.filter((segment: any) => segment.latex === "t").length,
        2,
    );

    const staticAnalysis = await json("corpus/units/ntc2018/7.9.4.1.json");
    const definitions = staticAnalysis.blocks.find((block: any) => block.blockId.endsWith("#block-p7"));
    assert.deepEqual(
        definitions.text.inline
            .filter((segment: any) => segment.kind === "math")
            .map((segment: any) => segment.latex),
        ["T_1", "g", "d_i", "i", "f_i=G_i", "G_i", "i"],
    );
});

test("NTC pagine 270–271 conserva figura e continuazione del modello strutturale", async () => {
    const { figures } = await stepAssets();
    const [figure] = figures;
    assert.equal(figure.officialNumber, "7.9.1");
    assert.equal(figure.caption, "Fig. 7.9.1 – Ponte obliquo");
    assert.deepEqual(figure.region, {
        coordinateSystem: "pdf-points-top-left",
        x: 247,
        y: 630,
        width: 102,
        height: 88.75,
    });
    const bytes = await readFile(join(root, "corpus/assets", figure.imagePath));
    assert.equal(createHash("sha256").update(bytes).digest("hex"), figure.sha256);

    const model = await json("corpus/units/ntc2018/7.9.3.json");
    assert.deepEqual(
        model.blocks.map((block: any) => block.blockId.split("#").at(-1)),
        ["block-heading", "block-p1", "block-figure-7-9-3-fig7-9-1", "block-p2", "block-p3"],
    );
    assert.deepEqual(
        model.blocks.map((block: any) => block.evidence.pdfPage),
        [270, 270, 270, 271, 271],
    );
    assert.ok(model.blocks[3].text.normalized.startsWith("La rigidezza degli elementi"));
    assert.ok(model.blocks[4].text.normalized.includes("0,03 volte"));
});

test("NTC pagina 271 ripristina gli elenchi e le espressioni estratte male", async () => {
    const unit = await json("corpus/units/ntc2018/7.9.4.1.json");
    const bySuffix = (suffix: string) =>
        unit.blocks.find((block: any) => block.blockId.endsWith(suffix));
    assert.equal(
        bySuffix("#block-p4").text.normalized,
        "Il periodo fondamentale T_1 in corrispondenza del quale valutare la risposta spettrale in accelerazione S_d(T_1) è dato in entrambi i casi dall’espressione:",
    );
    assert.ok(bySuffix("#block-d").text.normalized.startsWith("– la massa"));
    assert.ok(bySuffix("#block-e").text.normalized.startsWith("– l’intera massa"));
    assert.ok(!unit.blocks.some((block: any) => block.text?.normalized?.includes("ȭ")));
});

test("NTC pagine 267–271 colloca ciascun asset una sola volta", async () => {
    const units = await allUnits();
    const references = units
        .flatMap((unit) => unit.blocks)
        .filter((block: any) => block.assetId)
        .map((block: any) => block.assetId);
    const { figures } = await stepAssets();
    for (const id of [...expected.keys(), ...figures.map((figure: any) => figure.id)]) {
        assert.equal(
            references.filter((candidate: string) => candidate === id).length,
            1,
            id,
        );
    }
});
