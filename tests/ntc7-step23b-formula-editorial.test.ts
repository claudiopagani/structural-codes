/* eslint-disable @typescript-eslint/no-explicit-any */
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = fileURLToPath(new URL("../", import.meta.url));
const unitDir = join(root, "corpus/units/ntc2018");

async function json(path: string) {
    return JSON.parse(await readFile(join(root, path), "utf8"));
}

async function allUnits() {
    const names = (await readdir(unitDir)).filter((name) => name.endsWith(".json"));
    return Promise.all(names.map((name) => json(`corpus/units/ntc2018/${name}`)));
}

const inStep = (page: number | undefined) => (page ?? 0) >= 258 && (page ?? 0) <= 261;

test("NTC pagine 258–261 non inventa asset assenti dalla fonte", async () => {
    for (const name of ["7.6-step1.json", "7.7-step1.json", "7.7-78-step2.json"]) {
        const manifest = await json(`corpus/assets/ntc2018/${name}`);
        for (const kind of ["formulas", "tables", "figures"]) {
            assert.deepEqual(
                (manifest[kind] ?? []).filter((asset: any) => inStep(asset.pdfPage)),
                [],
                `${name}:${kind}`,
            );
        }
    }
});

test("NTC pagine 258–261 conserva tutte le formule inline complete", async () => {
    const units = (await allUnits()).filter((unit) =>
        unit.blocks.some((block: any) => inStep(block.evidence?.pdfPage)),
    );
    assert.equal(units.length, 20);

    const latex = new Set<string>();
    for (const unit of units) {
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
                assert.ok(before === undefined || !/[\p{L}\p{N}_]/u.test(before), block.blockId);
                assert.ok(after === undefined || !/[\p{L}\p{N}_]/u.test(after), block.blockId);
            }
        }
    }

    for (const required of [
        "\\gamma_{Rd}",
        "13\\,\\mathrm{mm}",
        "q_0",
        "12\\,\\mathrm{mm}",
        "10d",
        "3{,}1\\,\\mathrm{mm}",
        "4d",
        "8d",
        "3d",
        "h/b\\le4",
        "a_g S\\ge0{,}2g",
        "a_g S\\le0{,}075g",
        "f_{bk}",
        "f_b",
        "\\bar{f}_{bk}",
        "1{,}5\\,\\mathrm{MPa}",
        "a_g S\\le0{,}15g",
        "0{,}075g<a_g S\\le0{,}15g",
    ]) {
        assert.ok(latex.has(required), required);
    }
});

test("NTC pagine 258–261 corregge glifi, indici e barra della resistenza ortogonale", async () => {
    const qUnit = await json("corpus/units/ntc2018/7.7.3.json");
    const qBlocks = qUnit.blocks.filter((block: any) =>
        block.text?.inline?.some((segment: any) => segment.latex === "q_0"),
    );
    assert.equal(qBlocks.length, 2);
    assert.equal(qUnit.blocks.at(-1).text.normalized, ".");
    assert.ok(!qBlocks.some((block: any) => block.text.normalized.includes("q 0")));
    assert.ok(qUnit.workflow.openIssues.some((issue: any) =>
        issue.issueId === "ntc2018-7-7-3-source-anomaly-standalone-period" &&
        issue.severity === "warning",
    ));

    const floor = await json("corpus/units/ntc2018/7.7.7.2.json");
    assert.deepEqual(
        floor.blocks.slice(1).map((block: any) =>
            block.text.inline.filter((segment: any) => segment.kind === "math").map((segment: any) => segment.latex),
        ),
        [["h/b\\le4"], ["a_g S\\ge0{,}2g"]],
    );
    assert.ok(!floor.blocks.some((block: any) => /[ǂǃ]/u.test(block.text?.normalized ?? "")));

    const materials = await json("corpus/units/ntc2018/7.8.1.2.json");
    const perpendicular = materials.blocks.find((block: any) => block.blockId.endsWith("#block-d"));
    assert.ok(perpendicular.text.normalized.includes("f̄_{bk}"));
    assert.deepEqual(
        perpendicular.text.inline.filter((segment: any) => segment.kind === "math")[0],
        { kind: "math", value: "f̄_{bk}", latex: "\\bar{f}_{bk}" },
    );
});

test("NTC pagine 258–261 non marca d dentro parole discorsive", async () => {
    for (const number of ["7.7.3.1", "7.7.7.1"]) {
        const unit = await json(`corpus/units/ntc2018/${number}.json`);
        for (const block of unit.blocks) {
            const segments = block.text?.inline ?? [];
            for (let index = 0; index < segments.length; index += 1) {
                if (segments[index].kind !== "math" || segments[index].value !== "d") continue;
                const before = segments[index - 1]?.value?.at(-1);
                const after = segments[index + 1]?.value?.at(0);
                assert.ok(before === undefined || !/[\p{L}\p{N}_]/u.test(before), block.blockId);
                assert.ok(after === undefined || !/[\p{L}\p{N}_]/u.test(after), block.blockId);
            }
        }
    }
});
