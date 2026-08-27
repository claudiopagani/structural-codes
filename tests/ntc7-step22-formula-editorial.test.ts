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
    const manifests = await Promise.all([
        json("corpus/assets/ntc2018/7.4-step3.json"),
        json("corpus/assets/ntc2018/7.5-step1.json"),
    ]);
    const inStep = (asset: { pdfPage: number }) =>
        asset.pdfPage >= 242 && asset.pdfPage <= 251;
    return {
        formulas: manifests
            .flatMap((manifest) => manifest.formulas ?? [])
            .filter(inStep),
        tables: manifests
            .flatMap((manifest) => manifest.tables ?? [])
            .filter(inStep),
        figures: manifests
            .flatMap((manifest) => manifest.figures ?? [])
            .filter(inStep),
    };
}

const expected = new Map<string, string>([
    [fid("7.4.29"), "\\alpha\\cdot\\omega_{wd}\\ge30\\mu_\\phi\\cdot\\nu_d\\cdot\\varepsilon_{sy,d}\\cdot\\frac{b_c}{b_0}-0{,}035"],
    [fid("7.4.30"), "\\omega_{wd}=\\frac{\\text{volume delle staffe di confinamento}}{\\text{volume del nucleo di calcestruzzo}}\\cdot\\frac{f_{yd}}{f_{cd}}"],
    [fid("7.4.31a"), "\\alpha_n=1-\\frac{\\sum_n b_i^2}{6\\cdot b_0\\cdot h_0}"],
    [fid("7.4.31b"), "\\alpha_s=\\left[1-\\frac{s}{2\\cdot b_0}\\right]\\cdot\\left[1-\\frac{s}{2\\cdot h_0}\\right]"],
    [fid("7.4.31c"), "\\alpha_n=1"],
    [fid("7.4.31d"), "\\alpha_s=\\left[1-\\frac{s}{2\\cdot D_0}\\right]^\\beta"],
    [fid("7.4.32"), "\\alpha\\cdot\\omega_{wd}\\ge30\\mu_\\phi\\cdot\\left(\\nu_d+\\omega_v\\right)\\cdot\\varepsilon_{sy,d}\\cdot\\frac{b_c}{b_0}-0{,}035"],
    [fid("7.4.33"), "\\omega_{wd}=\\frac{\\text{volume delle staffe di confinamento}}{\\text{volume del nucleo di calcestruzzo degli elementi di bordo}}\\cdot\\frac{f_{yd}}{f_{cd}}"],
    [fid("7.5.1"), "R_{j,d}\\ge1{,}1\\cdot\\gamma_{ov}\\cdot R_{pl,Rd}=R_{U,Rd}"],
    [fid("7.5.2"), "\\frac{A_{res}}{A}\\ge1{,}1\\cdot\\frac{\\gamma_{M2}}{\\gamma_{M0}}\\cdot\\frac{f_{yk}}{f_{tk}}"],
    [fid("7.5.3"), "\\frac{N_{Ed}}{N_{pl,Rd}}\\le0{,}3"],
    [fid("7.5.3.2:mu-local"), "\\mu=\\theta_u/\\theta_y"],
    [fid("7.5.4"), "\\frac{M_{Ed}}{M_{pl,Rd}}\\le1"],
    [fid("7.5.5"), "\\frac{N_{Ed}}{N_{pl,Rd}}\\le0{,}15"],
    [fid("7.5.6"), "\\frac{V_{Ed,G}+V_{Ed,M}}{V_{pl,Rd}}\\le0{,}50"],
    [fid("7.5.7"), "N_{Ed}=N_{Ed,G}+1{,}1\\cdot\\gamma_{ov}\\cdot\\Omega\\cdot N_{Ed,E}"],
    [fid("7.5.8"), "M_{Ed}=M_{Ed,G}+1{,}1\\cdot\\gamma_{ov}\\cdot\\Omega\\cdot M_{Ed,E}"],
    [fid("7.5.9"), "V_{Ed}=V_{Ed,G}+1{,}1\\cdot\\gamma_{ov}\\cdot\\Omega\\cdot V_{Ed,E}"],
    [fid("7.5.10"), "\\frac{V_{Ed}}{V_{pl,Rd}}\\le0{,}50"],
    [fid("7.5.11"), "\\sum M_{C,pl,Rd}\\ge\\gamma_{Rd}\\cdot\\sum M_{b,pl,Rd}"],
    [fid("7.5.12"), "M_{j,Rd}\\ge1{,}1\\cdot\\gamma_{ov}\\cdot M_{b,pl,Rd}"],
    [fid("7.5.13"), "\\frac{V_{vp,Ed}}{\\min(V_{vp,Rd},V_{vb,Rd})}<1"],
    [fid("7.5.14"), "M_{C,Rd}\\ge1{,}1\\cdot\\gamma_{ov}\\cdot M_{c,pl,Rd}(N_{Ed})"],
    [fid("7.5.15"), "\\frac{N_{Ed}}{N_{b,Rdp}(M_{Ed})}\\le1"],
    [fid("7.5.16a"), "\\text{“corti”:}\\quad e\\le0{,}8(1+\\alpha)\\frac{M_{l,Rd}}{V_{l,Rd}}"],
    [fid("7.5.16b"), "\\text{“intermedi”:}\\quad0{,}8(1+\\alpha)\\frac{M_{l,Rd}}{V_{l,Rd}}<e<1{,}5(1+\\alpha)\\frac{M_{l,Rd}}{V_{l,Rd}}"],
    [fid("7.5.16c"), "\\text{“lunghi”:}\\quad e\\ge1{,}5(1+\\alpha)\\frac{M_{l,Rd}}{V_{l,Rd}}"],
    [fid("7.5.17"), "M_{l,Rd}=f_y\\cdot b\\cdot t_f\\cdot(h-t_f)"],
    [fid("7.5.18"), "V_{l,Rd}=\\frac{f_y}{\\sqrt{3}}\\cdot t_w\\cdot(h-t_f)"],
    [fid("7.5.19"), "V_{Ed}\\le V_{l,Rd}"],
    [fid("7.5.20"), "M_{Ed}\\le M_{l,Rd}"],
    [fid("7.5.21"), "V_{l,Rd,r}=V_{l,Rd}\\left[1-\\left(\\frac{N_{Ed}}{N_{pl,Rd}}\\right)^2\\right]^{0{,}5}"],
    [fid("7.5.22"), "M_{l,Rd,r}=M_{l,Rd}\\left[1-\\frac{N_{Ed}}{N_{pl,Rd}}\\right]"],
    [fid("7.5.23"), "e\\le1{,}6\\cdot\\frac{M_{l,Rd}}{V_{l,Rd}}\\quad\\text{se }R<0{,}3"],
    [fid("7.5.24"), "e\\le(1{,}15-0{,}5\\cdot R)\\cdot1{,}6\\cdot\\frac{M_{l,Rd}}{V_{l,Rd}}\\quad\\text{se }R\\ge0{,}3"],
    [fid("7.5.25"), "N_{Rd}(M_{Ed},V_{Ed})\\le N_{Ed,G}+1{,}1\\cdot\\gamma_{ov}\\cdot\\Omega\\cdot N_{Ed,E}"],
    [fid("7.5.26"), "E_d=E_{d,G}+1{,}1\\cdot\\gamma_{ov}\\cdot\\Omega_i\\cdot E_{d,E}"],
    [fid("7.5.26a:short"), "\\text{elementi corti:}\\quad\\theta_p\\le0{,}08\\,\\mathrm{rad}"],
    [fid("7.5.26a:long"), "\\text{elementi lunghi:}\\quad\\theta_p\\le0{,}02\\,\\mathrm{rad}"],
]);

test("NTC pagine 242–251 conserva tutti i trentanove blocchi formula", async () => {
    const { formulas } = await stepAssets();
    assert.equal(formulas.length, 39);
    assert.deepEqual(
        new Set(formulas.map((formula: any) => formula.id)),
        new Set(expected.keys()),
    );
    for (const formula of formulas) {
        assert.equal(formula.latex, expected.get(formula.id), formula.id);
    }
    assert.equal(
        formulas.filter((formula: any) => formula.officialNumber === "7.5.26a")
            .length,
        2,
    );
});

test("NTC pagine 242–251 conserva inline completi e confini dei simboli", async () => {
    const units = await allUnits();
    const inStep = (page: number | undefined) =>
        (page ?? 0) >= 242 && (page ?? 0) <= 251;
    const stepUnits = units.filter((unit) =>
        unit.blocks.some((block: any) => inStep(block.evidence?.pdfPage)),
    );
    assert.equal(stepUnits.length, 21);

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
            for (let index = 0; index < segments.length; index += 1) {
                const segment = segments[index];
                if (segment.kind !== "math") continue;
                latex.add(segment.latex);
                if (!/^[A-Za-z]$/u.test(segment.value)) continue;
                const before = segments[index - 1]?.value?.at(-1);
                const after = segments[index + 1]?.value?.at(0);
                assert.ok(before === undefined || !/[\p{L}\p{N}_]/u.test(before));
                assert.ok(after === undefined || !/[\p{L}\p{N}_]/u.test(after));
            }
        }
    }
    for (const required of [
        "\\nu_d=\\frac{N_{Ed}}{A_c\\cdot f_{cd}}",
        "\\omega_v=\\rho_v\\cdot\\frac{f_{yd,v}}{f_{cd}}",
        "50\\%",
        "\\alpha_u/\\alpha_1=1{,}3",
        "\\gamma_{M2}",
        "1{,}3\\le\\overline{\\lambda}\\le2",
        "\\frac{N_{Ed}}{N_{pl,Rd}}<0{,}15",
        "R=\\frac{N_{Ed}t_w(d-2t_f)}{V_{Ed}A}",
        "\\frac{A_{st}f_y}{4}",
    ]) {
        assert.ok(latex.has(required), required);
    }
});

test("NTC pagine 242–251 conserva tabella, crop ufficiali e anomalie", async () => {
    const { tables, figures } = await stepAssets();
    assert.deepEqual(
        tables.map((table: any) => table.id),
        ["urn:structural-codes:it:asset:table:ntc2018:7.5.i"],
    );
    assert.deepEqual(
        figures.map((figure: any) => figure.officialNumber),
        ["7.5.1", "7.5.1"],
    );
    for (const figure of figures) {
        const bytes = await readFile(join(root, "corpus/assets", figure.imagePath));
        assert.equal(
            createHash("sha256").update(bytes).digest("hex"),
            figure.sha256,
            figure.imagePath,
        );
    }
    const unit = await json("corpus/units/ntc2018/7.5.5.json");
    assert.ok(
        unit.workflow.openIssues.some(
            (issue: any) =>
                issue.issueId === "ntc2018-7-5-15-source-anomaly-rdp" &&
                issue.severity === "warning",
        ),
    );
});

test("NTC pagine 242–251 colloca ciascun asset una sola volta", async () => {
    const units = await allUnits();
    const references = units
        .flatMap((unit) => unit.blocks)
        .filter((block: any) => block.assetId)
        .map((block: any) => block.assetId);
    const { tables, figures } = await stepAssets();
    for (const id of [
        ...expected.keys(),
        ...tables.map((table: any) => table.id),
        ...figures.map((figure: any) => figure.id),
    ]) {
        assert.equal(
            references.filter((candidate: string) => candidate === id).length,
            1,
            id,
        );
    }
});
