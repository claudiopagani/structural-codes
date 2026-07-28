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

const unitNumbers = [
    "C7.4",
    "C7.4.2",
    "C7.4.2.1",
    "C7.4.3",
    "C7.4.3.1",
    "C7.4.4",
    "C7.4.4.1",
    "C7.4.4.1.1",
    "C7.4.4.1.2",
    "C7.4.4.2",
    "C7.4.4.2.1",
    "C7.4.4.2.2",
    "C7.4.4.3",
    "C7.4.4.3.1",
    "C7.4.4.4",
    "C7.4.4.4.1",
    "C7.4.4.5",
    "C7.4.4.5.1",
    "C7.4.4.5.2",
    "C7.4.5",
    "C7.4.5.1",
    "C7.4.5.1.1",
    "C7.4.5.1.2",
    "C7.4.6",
    "C7.4.6.1",
    "C7.4.6.1.2",
    "C7.4.6.2",
    "C7.4.6.2.3",
];

test("C7.4 contiene le 28 unità presenti nella fonte", async () => {
    for (const number of unitNumbers) {
        const unit = await json(
            `corpus/units/circ2019/${number.toLowerCase()}.json`,
        );
        assert.equal(unit.numbering.official, number);
    }
});

test("C7.4 trascrive le tre formule display", async () => {
    const manifest = await json("corpus/assets/circ2019/7.4.json");
    assert.deepEqual(
        manifest.formulas.map(
            ({
                officialNumber,
                latex,
            }: {
                officialNumber: string;
                latex: string;
            }) => [officialNumber, latex],
        ),
        [
            ["C7.4.1", "r=\\sqrt{\\frac{K_\\theta}{K}}"],
            ["C7.4.2", "\\Omega=\\frac{T}{T_\\theta}"],
            [
                "C7.4.3",
                "\\alpha=\\frac{\\gamma_{Rd}\\sum M_{b,Rd}}{\\sum M_{c,Ed}}",
            ],
        ],
    );
});

test("le sei figure C7.4 sono ritagli ufficiali integri", async () => {
    const manifest = await json("corpus/assets/circ2019/7.4.json");
    assert.equal(manifest.figures.length, 6);
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
});

test("C7.4 registra il layer testuale mancante senza promuovere la review", async () => {
    for (const number of unitNumbers) {
        const unit = await json(
            `corpus/units/circ2019/${number.toLowerCase()}.json`,
        );
        assert.equal(unit.workflow.status, "extracted");
        assert.ok(
            unit.workflow.openIssues.some(
                ({ issueId }: { issueId: string }) =>
                    issueId.endsWith("-missing-text-layer"),
            ),
            number,
        );
    }
});

test("ogni asset C7.4 compare una sola volta", async () => {
    const manifest = await json("corpus/assets/circ2019/7.4.json");
    const expected = new Set<string>([
        ...manifest.formulas.map(({ id }: { id: string }) => id),
        ...manifest.figures.map(({ id }: { id: string }) => id),
    ]);
    const counts = new Map<string, number>();
    for (const number of unitNumbers) {
        const unit = await json(
            `corpus/units/circ2019/${number.toLowerCase()}.json`,
        );
        for (const { assetId } of unit.blocks) {
            if (!assetId || !expected.has(assetId)) continue;
            counts.set(assetId, (counts.get(assetId) ?? 0) + 1);
        }
    }
    assert.equal(counts.size, expected.size);
    for (const [assetId, count] of counts) assert.equal(count, 1, assetId);
});
