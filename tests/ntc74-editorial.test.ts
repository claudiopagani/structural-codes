import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../", import.meta.url));

// Canonical JSON records intentionally contain heterogeneous block shapes.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function json(relativePath: string): Promise<any> {
    return JSON.parse(await readFile(join(repoRoot, relativePath), "utf8"));
}

test("NTC 7.4 contiene tutte le unità degli step 2 e 3", async () => {
    for (const number of [
        "7.4.4.5",
        "7.4.4.5.1",
        "7.4.4.5.2",
        "7.4.4.6",
        "7.4.5",
        "7.4.5.1",
        "7.4.5.2",
        "7.4.5.2.1",
        "7.4.5.2.2",
        "7.4.5.3",
        "7.4.6",
        "7.4.6.1",
        "7.4.6.1.1",
        "7.4.6.1.2",
        "7.4.6.1.3",
        "7.4.6.1.4",
        "7.4.6.2",
        "7.4.6.2.1",
        "7.4.6.2.2",
        "7.4.6.2.3",
        "7.4.6.2.4",
    ]) {
        const unit = await json(`corpus/units/ntc2018/${number}.json`);
        assert.equal(unit.numbering.official, number);
    }
});

test("NTC 7.4 conserva la sequenza ufficiale delle formule", async () => {
    const step2 = await json("corpus/assets/ntc2018/7.4-step2.json");
    const step3 = await json("corpus/assets/ntc2018/7.4-step3.json");
    assert.deepEqual(
        step2.formulas.map(
            ({ officialNumber }: { officialNumber: string | null }) =>
                officialNumber,
        ),
        Array.from({ length: 12 }, (_, index) => `7.4.${index + 13}`),
    );
    assert.deepEqual(
        step3.formulas.map(
            ({ officialNumber }: { officialNumber: string | null }) =>
                officialNumber,
        ),
        [
            "7.4.26",
            "7.4.27",
            "7.4.28",
            null,
            "7.4.29",
            "7.4.30",
            "7.4.31a",
            "7.4.31b",
            "7.4.31c",
            "7.4.31d",
            "7.4.32",
            "7.4.33",
        ],
    );
    assert.equal(
        step2.formulas.find(
            ({ officialNumber }: { officialNumber: string }) =>
                officialNumber === "7.4.22",
        )?.latex,
        "V_{fd}=\\min\\begin{cases}\\mu_f\\cdot\\left[\\left(\\sum A_{sj}\\cdot f_{yd}+N_{Ed}\\right)\\cdot\\xi+M_{Ed}/z\\right]\\\\0{,}5\\cdot\\eta\\cdot f_{cd}\\cdot\\xi\\cdot l_w\\cdot b_{wo}\\end{cases}",
    );
    assert.equal(
        step3.formulas.find(
            ({ officialNumber }: { officialNumber: string }) =>
                officialNumber === "7.4.31d",
        )?.latex,
        "\\alpha_s=\\left[1-\\frac{s}{2\\cdot D_0}\\right]^\\beta",
    );
});

test("le sei figure NTC 7.4 sono ritagli ufficiali integri", async () => {
    for (const manifestPath of [
        "corpus/assets/ntc2018/7.4-step1.json",
        "corpus/assets/ntc2018/7.4-step2.json",
    ]) {
        const manifest = await json(manifestPath);
        for (const figure of manifest.figures) {
            const image = await readFile(
                join(repoRoot, "corpus", "assets", figure.imagePath),
            );
            assert.equal(
                createHash("sha256").update(image).digest("hex"),
                figure.sha256,
                figure.officialNumber,
            );
        }
    }
});

test("ogni asset NTC 7.4 compare una sola volta", async () => {
    const manifestPaths = [
        "corpus/assets/ntc2018/7.4-step1.json",
        "corpus/assets/ntc2018/7.4-step2.json",
        "corpus/assets/ntc2018/7.4-step3.json",
    ];
    const expected = new Set<string>();
    for (const path of manifestPaths) {
        const manifest = await json(path);
        for (const formula of manifest.formulas) expected.add(formula.id);
        for (const figure of manifest.figures) expected.add(figure.id);
    }

    const counts = new Map<string, number>();
    for (const number of [
        "7.4",
        "7.4.1",
        "7.4.2",
        "7.4.2.1",
        "7.4.2.2",
        "7.4.3",
        "7.4.3.1",
        "7.4.3.2",
        "7.4.4",
        "7.4.4.1",
        "7.4.4.1.1",
        "7.4.4.1.2",
        "7.4.4.2",
        "7.4.4.2.1",
        "7.4.4.2.2",
        "7.4.4.3",
        "7.4.4.3.1",
        "7.4.4.4",
        "7.4.4.4.1",
        "7.4.4.5",
        "7.4.4.5.1",
        "7.4.4.5.2",
        "7.4.4.6",
        "7.4.5",
        "7.4.5.1",
        "7.4.5.2",
        "7.4.5.2.1",
        "7.4.5.2.2",
        "7.4.5.3",
        "7.4.6",
        "7.4.6.1",
        "7.4.6.1.1",
        "7.4.6.1.2",
        "7.4.6.1.3",
        "7.4.6.1.4",
        "7.4.6.2",
        "7.4.6.2.1",
        "7.4.6.2.2",
        "7.4.6.2.3",
        "7.4.6.2.4",
    ]) {
        const unit = await json(`corpus/units/ntc2018/${number}.json`);
        for (const { assetId } of unit.blocks) {
            if (!assetId || !expected.has(assetId)) continue;
            counts.set(assetId, (counts.get(assetId) ?? 0) + 1);
        }
    }
    assert.equal(counts.size, expected.size);
    for (const [assetId, count] of counts) assert.equal(count, 1, assetId);
});
