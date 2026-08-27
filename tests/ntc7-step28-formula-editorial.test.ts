/* eslint-disable @typescript-eslint/no-explicit-any */
import assert from "node:assert/strict";
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

const expected = new Map<string, string>([
    [fid("7.10.5.3.1-7.10.1"), "F=M\\cdot S_e(T_{is},\\xi_{esi})"],
    [fid("7.10.5.3.1-7.10.2"), "d_{de}=\\frac{M\\cdot S_e(T_{is},\\xi_{esi})}{K_{esi,min}}"],
    [fid("7.10.5.3.1-7.10.3"), "f_j=m_j\\cdot S_e(T_{is},\\xi_{esi})"],
    [fid("7.10.5.3.1-7.10.4"), "\\delta_{xi}=1+\\frac{e_{tot,y}}{r_y^2}y_i\\qquad \\delta_{yi}=1+\\frac{e_{tot,x}}{r_x^2}x_i"],
    [fid("7.10.5.3.1-7.10.5"), "\\begin{aligned}r_x^2&=\\sum(x_i^2\\cdot K_{yi}+y_i^2\\cdot K_{xi})/\\sum K_{yi}\\\\r_y^2&=\\sum(x_i^2\\cdot K_{yi}+y_i^2\\cdot K_{xi})/\\sum K_{xi}\\end{aligned}"],
]);

const stepIds = [
    "7.9.6.1.3", "7.9.6.2", "7.10", "7.10.1", "7.10.2", "7.10.3",
    "7.10.4", "7.10.4.1", "7.10.4.2", "7.10.4.3", "7.10.4.4",
    "7.10.5", "7.10.5.1", "7.10.5.2", "7.10.5.3", "7.10.5.3.1",
    "7.10.5.3.2", "7.10.6", "7.10.6.1", "7.10.6.2", "7.10.6.2.1",
];

test("NTC pagine 277–281 conserva le cinque formule display ufficiali", async () => {
    const manifest = await json("corpus/assets/ntc2018/7.7-78-step2.json");
    const inStep = (asset: { pdfPage: number }) =>
        asset.pdfPage >= 277 && asset.pdfPage <= 281;
    const formulas = (manifest.formulas ?? []).filter(inStep);
    assert.equal(formulas.length, 5);
    assert.equal((manifest.tables ?? []).filter(inStep).length, 0);
    assert.equal((manifest.figures ?? []).filter(inStep).length, 0);
    assert.deepEqual(
        new Set(formulas.map((formula: any) => formula.id)),
        new Set(expected.keys()),
    );
    for (const formula of formulas) {
        assert.equal(formula.latex, expected.get(formula.id), formula.id);
    }
});

test("NTC formule 7.10.1–7.10.5 conserva prodotti, slash e allineamento", () => {
    assert.match(expected.get(fid("7.10.5.3.1-7.10.1")) ?? "", /M\\cdot S_e/u);
    assert.match(expected.get(fid("7.10.5.3.1-7.10.2")) ?? "", /^d_\{de\}=/u);
    assert.match(expected.get(fid("7.10.5.3.1-7.10.3")) ?? "", /m_j\\cdot S_e/u);
    assert.match(expected.get(fid("7.10.5.3.1-7.10.4")) ?? "", /y_i\\qquad \\delta/u);
    const radii = expected.get(fid("7.10.5.3.1-7.10.5")) ?? "";
    assert.match(radii, /^\\begin\{aligned\}/u);
    assert.match(radii, /\\\\r_y\^2/u);
    assert.match(radii, /\/\\sum K_\{yi\}/u);
    assert.doesNotMatch(radii, /\\frac/u);
});

test("NTC pagine 277–281 conserva la matematica inline verificata", async () => {
    const units = await Promise.all(
        stepIds.map((id) => json("corpus/units/ntc2018/" + id + ".json")),
    );
    const latex = new Set<string>();
    for (const unit of units) {
        for (const block of unit.blocks) {
            if (!block.text?.inline) continue;
            const segments = block.text.inline;
            assert.equal(
                segments.map((segment: any) => segment.value).join(""),
                block.text.normalized,
                block.blockId,
            );
            if (block.evidence?.pdfPage >= 277 && block.evidence?.pdfPage <= 281) {
                assert.doesNotMatch(
                    block.text.normalized,
                    /[΅·ǂǃȉΑƺʌ¦ǌȡȟΒ΋Έȭ]/u,
                    block.blockId,
                );
            }
            for (const segment of segments) {
                if (segment.kind === "math") latex.add(segment.latex);
            }
        }
    }

    for (const required of [
        "\\nu_k\\le0{,}30", "135^\\circ", "90^\\circ",
        "a_gS\\le0{,}075g", "V\\ge0", "V<0", "1\\,\\mathrm{MPa}",
        "1/20", "V_R", "\\pm30\\%", "K_{esi}", "\\xi_{esi}",
        "0{,}5d_{dc}", "d_{dc}", "2{,}5\\%", "T_{is}",
        "3\\cdot T_{bf}", "T_V=2\\pi\\sqrt{M/K_V}",
        "T\\ge0{,}8T_{is}", "\\eta", "\\xi", "\\gamma_M",
        "q\\le1{,}50", "q=1",
    ]) {
        assert.ok(latex.has(required), required);
    }
});

test("NTC pagina 280 conserva capoversi, elenchi e possibili refusi della fonte", async () => {
    const unit = await json("corpus/units/ntc2018/7.10.5.3.1.json");
    const bySuffix = (suffix: string) => unit.blocks.find((block: any) =>
        block.blockId.endsWith("#block-" + suffix),
    );

    for (const suffix of ["g", "h", "i", "i2", "j", "k", "l", "m"]) {
        assert.equal(bySuffix(suffix)?.kind, "list-item", suffix);
    }
    for (const suffix of ["p9a", "p9b", "p10a", "p10b", "p10c", "p10d", "p11a", "p11b"]) {
        assert.equal(bySuffix(suffix)?.kind, "paragraph", suffix);
        assert.equal(bySuffix(suffix)?.evidence.pdfPage, 280, suffix);
    }

    assert.match(bySuffix("p6").text.normalized, /K_esi,min,min/u);
    assert.match(bySuffix("p7").text.normalized, /d_dc/u);
    assert.equal(bySuffix("p10b").text.normalized.startsWith("(x_i, x_i)"), true);
    assert.equal(bySuffix("p11a").text.normalized.startsWith("K_xi, K_xi"), true);
    for (const issueId of [
        "ntc2018-7-10-5-3-1-source-anomaly-k-esi-min",
        "ntc2018-7-10-5-3-1-source-anomaly-d-de",
        "ntc2018-7-10-5-3-1-source-anomaly-duplicated-x",
    ]) {
        assert.ok(unit.workflow.openIssues.some((issue: any) => issue.issueId === issueId), issueId);
    }
});

test("NTC pagine 277–281 colloca ogni formula una sola volta", async () => {
    const units = await allUnits();
    const references = units
        .flatMap((unit) => unit.blocks)
        .filter((block: any) => block.assetId)
        .map((block: any) => block.assetId);
    for (const id of expected.keys()) {
        assert.equal(
            references.filter((candidate: string) => candidate === id).length,
            1,
            id,
        );
    }
});
