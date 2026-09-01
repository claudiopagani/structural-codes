import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const unitDirectory = fileURLToPath(new URL("../corpus/units/circ2019/", import.meta.url));
const readUnit = async (number: string) => JSON.parse(await readFile(join(unitDirectory, `${number.toLowerCase()}.json`), "utf8"));

test("Circ C7 rasterizzato conserva il testo trascritto e gli asset verificati", async () => {
    const numbers = ["C7", "C7.1", "C7.2", "C7.2.1", "C7.2.2", "C7.2.3", "C7.2.6", "C7.3", "C7.3.1", "C7.3.3", "C7.3.3.1", "C7.3.3.2", "C7.3.4", "C7.3.4.1", "C7.3.4.2", "C7.3.5", "C7.3.6", "C7.3.6.1", "C7.3.6.2"];
    const units = await Promise.all(numbers.map(readUnit));
    assert.equal(units.length, 19);
    for (const unit of units) {
        assert.equal(unit.workflow.status, "extracted", unit.id);
        assert.equal(unit.workflow.openIssues.some((issue: { type: string; severity: string }) => issue.type === "missing-region" && issue.severity === "blocking"), true, unit.id);
    }
    const c723 = units.find((unit) => unit.numbering.official === "C7.2.3");
    assert.ok(c723);
    assert.equal(c723.blocks.filter((block: { kind: string }) => block.kind === "formula-ref").length, 11);
    assert.deepEqual(c723.assets, {
        formulaIds: [
            "urn:structural-codes:it:asset:formula:circ2019:c7.2.1",
            "urn:structural-codes:it:asset:formula:circ2019:c7.2.2",
            "urn:structural-codes:it:asset:formula:circ2019:c7.2.3",
            "urn:structural-codes:it:asset:formula:circ2019:c7.2.4",
            "urn:structural-codes:it:asset:formula:circ2019:c7.2.5",
            "urn:structural-codes:it:asset:formula:circ2019:c7.2.6",
            "urn:structural-codes:it:asset:formula:circ2019:c7.2.7",
            "urn:structural-codes:it:asset:formula:circ2019:c7.2.8",
            "urn:structural-codes:it:asset:formula:circ2019:c7.2.9",
            "urn:structural-codes:it:asset:formula:circ2019:c7.2.10",
            "urn:structural-codes:it:asset:formula:circ2019:c7.2.11",
        ],
        tableIds: [
            "urn:structural-codes:it:asset:table:circ2019:c7.2.i",
            "urn:structural-codes:it:asset:table:circ2019:c7.2.ii",
        ],
        figureIds: [
            "urn:structural-codes:it:asset:figure:circ2019:c7.2.3",
            "urn:structural-codes:it:asset:figure:circ2019:c7.2.4",
        ],
    });
    const c7361 = units.find((unit) => unit.numbering.official === "C7.3.6.1");
    const c7362 = units.find((unit) => unit.numbering.official === "C7.3.6.2");
    assert.ok(c7361 && c7361.blocks.length > 1);
    assert.ok(c7362 && c7362.blocks.length > 1);
});

test("Circ C7 pagine 197-206 conserva indici, disequazioni e parentesi ufficiali", async () => {
    const c7 = await readUnit("C7");
    const c722 = await readUnit("C7.2.2");
    const c723 = await readUnit("C7.2.3");
    const math = (unit: { blocks: Array<{ text?: { inline?: Array<{ kind: string; value: string; latex: string }> } }> }) =>
        unit.blocks.flatMap((block) => block.text?.inline ?? []).filter((segment) => segment.kind === "math");

    assert.equal(math(c7).some((segment) => segment.value === "a_gS" && segment.latex === "a_gS"), true);
    assert.equal(math(c7).some((segment) => segment.latex === "a_{gS}"), false);
    assert.equal(math(c722).some((segment) => segment.value === "γ_Rd ≥ 1,25" && segment.latex === "\\gamma_{Rd}\\ge1{,}25"), true);
    assert.equal(math(c722).some((segment) => segment.value === "Rd" && segment.latex === "Rd"), true);
    assert.equal(math(c722).some((segment) => segment.latex === "R_d"), false);
    assert.equal(math(c723).some((segment) => segment.value === "S_{eZ}(T,ξ,z)" && segment.latex === "S_{eZ}(T,\\xi,z)"), true);
    assert.equal(math(c723).some((segment) => segment.value === "a_{Z,k}" && segment.latex === "a_{Z,k}"), true);

    const manifest = JSON.parse(await readFile(join(unitDirectory, "..", "..", "assets", "circ2019", "7.2.json"), "utf8"));
    const formula = manifest.formulas.find((asset: { officialNumber: string }) => asset.officialNumber === "C7.2.5");
    assert.equal(formula.latex, "S_{eZ}(T,\\xi,z)=\\sqrt{\\sum_k\\left(S_{eZ,k}(T,\\xi,z)\\right)^2}\\;(\\ge S_e(T,\\xi)\\text{ per }T>T_1");
});

test("Circ C7 pagine 207-214 conserva formule display e matematica inline completa", async () => {
    const manifest = JSON.parse(await readFile(join(unitDirectory, "..", "..", "assets", "circ2019", "7.3.json"), "utf8"));
    assert.deepEqual(
        manifest.formulas.map(({ officialNumber, latex }: { officialNumber: string; latex: string }) => [officialNumber, latex]),
        [
            ["C7.3.1", "q'=q_{ND}\\frac{S_{e,SLV}(T_1)}{S_{e,SLD}(T_1)}"],
            ["C7.3.2", "T_1=C_1H^{3/4}"],
            ["C7.3.3", "F^*=F_b/\\Gamma"],
            ["C7.3.4", "d^*=d_c/\\Gamma"],
            ["C7.3.5", "\\Gamma=\\frac{\\boldsymbol{\\phi}^{T}\\mathbf{M}\\boldsymbol{\\tau}}{\\boldsymbol{\\phi}^{T}\\mathbf{M}\\boldsymbol{\\phi}}"],
            ["C7.3.6", "T^*=2\\pi\\sqrt{\\frac{m^*}{k^*}}"],
            ["C7.3.7", "d^*_{max}=d^*_{e,max}=S_{De}(T^*)"],
            ["C7.3.8", "d^*_{max}=\\frac{d^*_{e,max}}{q^*}\\left[1+(q^*-1)\\frac{T_C}{T^*}\\right]\\ge d^*_{e,max}"],
            ["C7.3.9", "d_{max}^{*(0)}=d_e"],
            ["C7.3.10", "\\xi_{eq}^{(1)}=k\\frac{63.7\\left(F_y^{*(0)}d_{max}^{*(0)}-F_{max}^{*(0)}d_y^{*(0)}\\right)}{F_{max}^{*(0)}d_{max}^{*(0)}}+5"],
        ],
    );

    const math = (unit: { blocks: Array<{ text?: { inline?: Array<{ kind: string; value: string; latex: string }> } }> }) =>
        unit.blocks.flatMap((block) => block.text?.inline ?? []).filter((segment) => segment.kind === "math");
    const c726 = math(await readUnit("C7.2.6"));
    const c731 = math(await readUnit("C7.3.1"));
    const c7342 = math(await readUnit("C7.3.4.2"));
    const c7361 = math(await readUnit("C7.3.6.1"));

    assert.equal(c726.some(({ value, latex }) => value === "f_cd" && latex === "f_{cd}"), true);
    assert.equal(c731.some(({ value, latex }) => value === "S_e,SLV(T_1)" && latex === "S_{e,SLV}(T_1)"), true);
    assert.equal(c7342.some(({ value, latex }) => value === "m* = Φ Mτ" && latex === "m^*=\\Phi M\\tau"), true);
    assert.equal(c7342.some(({ value, latex }) => value === "≤0,15F*_{bu}" && latex === "\\le0{,}15F_{bu}^*"), true);
    assert.equal(c7342.some(({ value, latex }) => value === "d*_{max} = d*_{e,max}" && latex === "d_{max}^*=d_{e,max}^*"), true);
    assert.equal(c7361.some(({ value, latex }) => value === "d_r = d_{r,E}" && latex === "d_r=d_{r,E}"), true);
    assert.equal(c7361.some(({ value }) => value === "d_r" || value === "d_{r,E}"), false);
});

test("Circ C8 esplicita la radice e la continuazione tabellare p.299", async () => {
    const root = await readUnit("C8");
    assert.equal(root.blocks[0].evidence.pdfPage, 253);
    const c8763 = await readUnit("C8.7.6.3");
    assert.equal(c8763.workflow.openIssues.some((issue: { issueId: string; note: string }) => issue.issueId === "circ2019-c8-7-6-3-page-299" && issue.note.includes("PDF 299")), true);
});
