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
    [fid("7.9.6.1.1-7.9.15"), "\\omega_{wd,r}\\ge\\max(\\omega_{w,req};\\;0{,}67\\cdot\\omega_{w,min})"],
    [fid("7.9.6.1.1-7.9.16"), "\\omega_{w,req}=\\frac{A_c}{A_{cc}}\\cdot\\lambda\\cdot\\nu_k+0{,}13\\cdot\\frac{f_{yd}}{f_{cd}}(\\rho_L-0{,}01)"],
    [fid("7.9.6.1.1-7.9.17"), "\\omega_{wd,c}\\ge\\max(1{,}4\\cdot\\omega_{w,req};\\;\\omega_{w,min})"],
    [fid("7.9.6.1.1-7.9.18"), "\\omega_{wd,r}=\\frac{A_{sw}}{s\\cdot b}\\cdot\\frac{f_{yd}}{f_{cd}}"],
    [fid("7.9.6.1.1-7.9.19"), "\\omega_{wd,c}=\\frac{4A_{sp}}{D_{sp}\\cdot s}\\cdot\\frac{f_{yd}}{f_{cd}}"],
    [fid("7.9.6.1.1-7.9.20"), "S_L\\le\\min(6\\cdot d_{bL};\\;1{,}5\\cdot b^*)"],
    [fid("7.9.6.1.1-7.9.21"), "S_L\\le\\min(\\frac{1}{3}\\cdot b^*;\\;200\\,\\mathrm{mm})"],
    [fid("7.9.6.1.2-7.9.22"), "S_L\\le6\\cdot d_{bL}"],
    [fid("7.9.6.1.2-7.9.23"), "\\frac{A_T}{S_T}=\\sum A_s\\cdot f_{yk,s}\\cdot\\frac{1}{1{,}6\\cdot f_{yk,t}}"],
]);

const stepIds = [
    "7.9.5.4.2",
    "7.9.6",
    "7.9.6.1",
    "7.9.6.1.1",
    "7.9.6.1.2",
    "7.9.6.1.3",
];

test("NTC pagine 275–276 conserva le nove formule display ufficiali", async () => {
    const manifest = await json("corpus/assets/ntc2018/7.7-78-step2.json");
    const inStep = (asset: { pdfPage: number }) =>
        asset.pdfPage >= 275 && asset.pdfPage <= 276;
    const formulas = (manifest.formulas ?? []).filter(inStep);
    assert.equal(formulas.length, 9);
    assert.equal((manifest.tables ?? []).filter(inStep).length, 0);
    assert.equal((manifest.figures ?? []).filter(inStep).length, 0);
    assert.deepEqual(
        new Set(formulas.map((formula: any) => formula.id)),
        new Set(expected.keys()),
    );
    for (const formula of formulas) {
        assert.equal(formula.latex, expected.get(formula.id), formula.id);
    }
    assert.ok(!formulas.some((formula: any) =>
        ["7.9.13", "7.9.14"].includes(formula.officialNumber),
    ));
});

test("NTC formule 7.9.15–7.9.23 conserva parentesi, prodotti e uguaglianza", () => {
    for (const suffix of ["7.9.6.1.1-7.9.15", "7.9.6.1.1-7.9.17", "7.9.6.1.1-7.9.20", "7.9.6.1.1-7.9.21"]) {
        const latex = expected.get(fid(suffix)) ?? "";
        assert.ok(latex.includes("("), suffix);
        assert.ok(latex.includes(")"), suffix);
        assert.ok(!latex.includes("\\{"), suffix);
    }
    assert.equal(
        expected.get(fid("7.9.6.1.2-7.9.23"))?.includes("\\ge"),
        false,
    );
    assert.ok(expected.get(fid("7.9.6.1.2-7.9.23"))?.includes("="));
    for (const latex of expected.values()) assert.ok(latex.includes("\\cdot"));
});

test("NTC pagine 275–276 conserva matematica inline completa", async () => {
    const units = await Promise.all(
        stepIds.map((id) => json("corpus/units/ntc2018/" + id + ".json")),
    );
    const latex = new Set<string>();
    for (const unit of units) {
        for (const block of unit.blocks) {
            const inStep =
                (block.evidence?.pdfPage >= 275 && block.evidence?.pdfPage <= 276) ||
                (unit.numbering.official === "7.9.5.4.2" && block.blockId.endsWith("#block-p2"));
            if (!inStep) continue;
            if (!block.text?.inline) continue;
            const segments = block.text.inline;
            assert.equal(
                segments.map((segment: any) => segment.value).join(""),
                block.text.normalized,
                block.blockId,
            );
            assert.doesNotMatch(block.text.normalized, /[΅·ǂǃȉΑƺʌ¦ǌȡ]/u, block.blockId);
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
        "0{,}05\\,\\mathrm{s}",
        "a_g\\cdot S",
        "80\\%",
        "\\nu_k\\le0{,}08",
        "\\nu_k\\le0{,}2",
        "\\mu_\\varphi=13",
        "0{,}0035",
        "0{,}37",
        "0{,}18",
        "d_{bL}",
        "b^*",
        "0{,}0035/2",
        "200\\,\\mathrm{mm}",
        "\\mathrm{mm}^2",
        "\\sum A_s",
        "20\\%",
        "0{,}3\\le\\nu_k\\le0{,}6",
        "50\\%",
    ]) {
        assert.ok(latex.has(required), required);
    }
});

test("NTC pagine 275–276 conserva gli elenchi e la definizione di b", async () => {
    const piles = await json("corpus/units/ntc2018/7.9.6.1.json");
    assert.deepEqual(
        piles.blocks.map((block: any) => block.kind),
        ["heading", "paragraph", "list-item", "list-item", "paragraph", "list-item", "list-item", "list-item", "paragraph"],
    );

    const confinement = await json("corpus/units/ntc2018/7.9.6.1.1.json");
    const bIndex = confinement.blocks.findIndex((block: any) =>
        block.blockId.endsWith("#block-def-b"),
    );
    const circularIndex = confinement.blocks.findIndex((block: any) =>
        block.blockId.endsWith("#block-subheading-circular"),
    );
    assert.ok(bIndex >= 0 && bIndex < circularIndex);
    assert.equal(confinement.blocks[bIndex].kind, "list-item");
    assert.equal(confinement.blocks[bIndex].evidence.pdfPage, 276);

    const instability = await json("corpus/units/ntc2018/7.9.6.1.2.json");
    assert.equal(
        instability.blocks.find((block: any) => block.blockId.endsWith("#block-p2")).evidence.pdfPage,
        276,
    );
    assert.ok(instability.blocks.filter((block: any) => block.kind === "list-item").length >= 5);
});

test("NTC pagine 275–276 colloca ogni formula una sola volta", async () => {
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
