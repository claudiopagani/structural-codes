import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../", import.meta.url));

// Fixtures editoriali eterogenee: ogni test restringe poi la forma usata.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function json(relativePath: string): Promise<any> {
    return JSON.parse(await readFile(join(repoRoot, relativePath), "utf8"));
}

test("C4.1 usa tutti i ritagli ufficiali, senza segnaposto", async () => {
    const manifest = await json(
        "corpus/assets/circ2019/core-figure-placeholders.json",
    );
    const figures = manifest.figures.filter(
        ({ officialNumber }: { officialNumber: string }) =>
            officialNumber.startsWith("C4.1."),
    );

    assert.equal(figures.length, 13);
    for (const figure of figures) {
        assert.doesNotMatch(figure.imagePath, /placeholder/u);
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

test("C4.1 contiene le formule verificate e i gruppi non numerati", async () => {
    const manifest = await json("corpus/assets/circ2019/core-editorial.json");
    const formulas = manifest.formulas.filter(
        ({ unitId }: { unitId: string }) => unitId.includes(":circ2019:c4.1"),
    );
    const byNumber = new Map<string | null, string>(
        formulas.map(
            (formula: { officialNumber: string | null; latex: string }) => [
                formula.officialNumber,
                formula.latex,
            ],
        ),
    );

    assert.equal(formulas.length, 26);
    assert.equal(byNumber.get("C4.1.1"), "\\overline{M}_{Ed}\\le M_{Rd}");
    assert.equal(byNumber.get("C4.1.3"), "\\zeta=1-c\\beta^2");
    assert.equal(
        byNumber.get("C4.1.5 e 4.1.14"),
        "w_k=1{,}7\\,\\varepsilon_{sm}\\,\\Delta_{sm}",
    );
    assert.equal(byNumber.get("C4.1.10"), "\\Delta_{sm}=0{,}75(h-x)");
    assert.match(byNumber.get("C4.1.16") ?? "", /^E_\{lcm\}=22000/u);
    assert.match(byNumber.get("C4.1.17") ?? "", /0\{,\}15/u);
    assert.equal(
        byNumber.get("C4.1.18"),
        "V_{Ed}\\le0{,}5\\eta_1b_wd\\nu_lf_{lcd}",
    );
    assert.equal(
        byNumber.get("C4.1.19"),
        "\\nu_l=0{,}5\\eta_1\\left(1-\\frac{f_{lck}}{250}\\right)",
    );
    assert.equal(
        formulas.filter(
            ({ officialNumber }: { officialNumber: string | null }) =>
                officialNumber === null,
        ).length,
        6,
    );
});

test("C4.1 pagine 94-99 conserva prodotti e disuguaglianze inline complete", async () => {
    const ids = [
        "c4.1.2.3.6",
        "c4.1.9.1.1",
        "c4.1.9.1.3",
        "c4.1.12.1.3.2.1",
    ];
    const units = await Promise.all(
        ids.map((id) => json(`corpus/units/circ2019/${id}.json`)),
    );
    const math = units.flatMap((unit) =>
        unit.blocks.flatMap(({ text }: { text?: { inline?: Array<{ kind: string; value: string; latex?: string }> } }) =>
            (text?.inline ?? []).filter(({ kind }) => kind === "math"),
        ),
    );
    assert.equal(
        math.filter(({ value }) => ["=", "<", "≤"].includes(value)).length,
        0,
    );
    const latex = math.map((item) => item.latex);
    for (const expected of [
        "\\nu\\cdot f_{cd}",
        "\\nu=0{,}5",
        "0{,}6+0{,}625\\cdot h",
        "h\\le0{,}32\\,\\mathrm{m}",
        "<0{,}4\\,\\mathrm{mm/m}",
        "\\le0{,}02",
        "\\le0{,}2f_{cd}",
        "\\times",
    ]) assert.ok(latex.includes(expected), expected);
});

test("C4.1 pagine 84-93 non frammenta uguaglianze e simboli inline", async () => {
    const ids = ["c4.1", "c4.1.2.2.2", "c4.1.2.2.4.5", "c4.1.2.2.5"];
    const units = await Promise.all(
        ids.map((id) => json(`corpus/units/circ2019/${id}.json`)),
    );
    const math = units.flatMap((unit) =>
        unit.blocks.flatMap(({ text }: { text?: { inline?: Array<{ kind: string; value: string; latex?: string }> } }) =>
            (text?.inline ?? []).filter(({ kind }) => kind === "math"),
        ),
    );
    assert.equal(math.filter(({ value }) => value === "=").length, 0);
    const latex = math.map((item) => item.latex);
    for (const expected of [
        "\\gamma_c",
        "\\alpha_{cc}",
        "\\rho=1{,}5\\%",
        "k_t=0{,}6",
        "k_1=0{,}8",
        "k_3=3{,}4",
        "n=15",
    ]) assert.ok(latex.includes(expected), expected);
});

test("C4.1 pagine 85-93 conserva liste, definizioni allineate e stili editoriali", async () => {
    const [analysis, crack, concrete] = await Promise.all([
        json("corpus/units/circ2019/c4.1.1.1.json"),
        json("corpus/units/circ2019/c4.1.2.2.4.5.json"),
        json("corpus/units/circ2019/c4.1.json"),
    ]);
    assert.deepEqual(
        analysis.blocks.filter(({ kind }: { kind: string }) => kind === "list-item").map(({ listMarker }: { listMarker?: string }) => listMarker),
        ["dash", "dash", "dash", "dash", "dash"],
    );
    const headings = crack.blocks.filter(({ kind }: { kind: string }) => kind === "heading");
    for (const heading of headings.slice(1)) {
        assert.deepEqual(heading.text.inline, [{ kind: "em-underline", value: heading.text.normalized }]);
    }
    const labels = crack.blocks.filter(({ kind, listMarker }: { kind: string; listMarker?: string }) => kind === "list-item" && listMarker === "none");
    assert.equal(labels.length >= 14, true);
    assert.equal(labels.some(({ text }: { text: { inline?: Array<{ kind: string; latex?: string }> } }) => text.inline?.some(({ latex }) => latex === "A_{c,eff}")), true);
    assert.equal(
        concrete.blocks.some(({ text }: { text?: { inline?: Array<{ latex?: string }> } }) => text?.inline?.some(({ latex }) => latex === "\\gamma_s")),
        true,
    );
});

test("Le didascalie e le intestazioni C4.1 distinguono stili e matematica", async () => {
    const [figures, tables] = await Promise.all([
        json("corpus/assets/circ2019/core-figure-placeholders.json"),
        json("corpus/assets/circ2019/core-tables.json"),
    ]);
    const figure = figures.figures.find(({ officialNumber }: { officialNumber: string }) => officialNumber === "C4.1.11");
    assert.equal(figure.captionInline[0].kind, "strong");
    assert.deepEqual(
        figure.captionInline.filter(({ kind }: { kind: string }) => kind === "math").map(({ latex }: { latex: string }) => latex),
        ["w"],
    );
    const table = tables.tables.find(({ officialNumber }: { officialNumber: string }) => officialNumber === "C4.1.I");
    assert.equal(table.headers.length, 2);
    assert.equal(table.headers[0][2].colSpan, 2);
    assert.deepEqual(
        table.captionInline.filter(({ kind }: { kind: string }) => kind === "math").map(({ latex }: { latex: string }) => latex),
        ["K", "\\frac{l}{h}"],
    );
});

test("C4.1 contiene tutte le sei tabelle ritrascritte", async () => {
    const manifest = await json("corpus/assets/circ2019/core-tables.json");
    const tables = manifest.tables.filter(
        ({ officialNumber }: { officialNumber: string }) =>
            officialNumber.startsWith("C4.1."),
    );

    assert.deepEqual(
        tables.map(({ officialNumber }: { officialNumber: string }) =>
            officialNumber,
        ),
        ["C4.1.I", "C4.1.II", "C4.1.III", "C4.1.IV", "C4.1.V", "C4.1.VI"],
    );
    const tableV = tables.find(
        ({ officialNumber }: { officialNumber: string }) =>
            officialNumber === "C4.1.V",
    );
    assert.equal(tableV.columnCount, 3);
    assert.equal(tableV.rows.length, 9);
    const tableVI = tables.find(
        ({ officialNumber }: { officialNumber: string }) =>
            officialNumber === "C4.1.VI",
    );
    assert.equal(tableVI.columnCount, 7);
    assert.equal(tableVI.rows.length, 3);
});

test("C4.1 pagine 94-99 conserva elenchi, definizioni e corsivi della fonte", async () => {
    const [slabs, blocks, tension, strains, shear] = await Promise.all([
        json("corpus/units/circ2019/c4.1.9.json"),
        json("corpus/units/circ2019/c4.1.9.1.1.json"),
        json("corpus/units/circ2019/c4.1.12.1.1.1.json"),
        json("corpus/units/circ2019/c4.1.12.1.3.1.json"),
        json("corpus/units/circ2019/c4.1.12.1.3.2.1.json"),
    ]);
    assert.deepEqual(
        slabs.blocks.filter(({ kind }: { kind: string }) => kind === "list-item").map(({ text }: { text: { normalized: string } }) => text.normalized.slice(0, 2)),
        ["1)", "2)"],
    );
    assert.equal(
        slabs.blocks.some(({ text }: { text?: { inline?: Array<{ kind: string; value: string }> } }) => text?.inline?.some(({ kind, value }) => kind === "em" && value === "rigidezza nel piano")),
        true,
    );
    assert.deepEqual(
        blocks.blocks.filter(({ kind }: { kind: string }) => kind === "list-item").map(({ listMarker }: { listMarker?: string }) => listMarker),
        ["dash", "dash"],
    );
    assert.equal(
        tension.blocks.filter(({ kind, listMarker }: { kind: string; listMarker?: string }) => kind === "list-item" && listMarker === "none").length,
        3,
    );
    assert.equal(
        tension.blocks.filter(({ kind, listMarker }: { kind: string; listMarker?: string }) => kind === "list-item" && listMarker === "dash").length,
        2,
    );
    assert.deepEqual(
        strains.blocks.filter(({ kind }: { kind: string }) => kind === "list-item").map(({ listMarker }: { listMarker?: string }) => listMarker),
        ["dash", "dash"],
    );
    assert.equal(
        shear.blocks.filter(({ kind, listMarker }: { kind: string; listMarker?: string }) => kind === "list-item" && listMarker === "none").length,
        4,
    );
    const heading = shear.blocks.find(({ kind }: { kind: string }) => kind === "heading");
    assert.deepEqual(heading.text.inline, [
        { kind: "text", value: "C4.1.12.1.3.2.1 " },
        { kind: "em", value: "Elementi senza armature trasversali resistenti al taglio" },
    ]);
});

test("Le didascalie e le intestazioni finali C4.1 mantengono gerarchia e matematica", async () => {
    const [figures, tables] = await Promise.all([
        json("corpus/assets/circ2019/core-figure-placeholders.json"),
        json("corpus/assets/circ2019/core-tables.json"),
    ]);
    const figure = figures.figures.find(({ officialNumber }: { officialNumber: string }) => officialNumber === "C4.1.13");
    assert.deepEqual(
        figure.captionInline.map(({ kind, latex }: { kind: string; latex?: string }) => [kind, latex]),
        [["strong", undefined], ["em", undefined], ["math", "\\sigma-\\varepsilon"], ["em", undefined]],
    );
    const table = tables.tables.find(({ officialNumber }: { officialNumber: string }) => officialNumber === "C4.1.IV");
    assert.equal(table.headers.length, 2);
    assert.equal(table.headers[0][0].colSpan, 3);
    assert.deepEqual(
        table.headers[1].slice(3).map(({ inline }: { inline?: Array<{ latex: string }> }) => inline?.[0]?.latex),
        ["C\\ge C_0", "C_{min}\\le C<C_0", "C\\ge C_0", "C_{min}\\le C<C_0", "C\\ge C_0", "C_{min}\\le C<C_0", "C\\ge C_0", "C_{min}\\le C<C_0"],
    );
});

test("ogni asset C4.1 compare una sola volta nel flusso editoriale", async () => {
    const directory = join(repoRoot, "corpus", "units", "circ2019");
    const files = (await readdir(directory)).filter(
        (name) => name.startsWith("c4.1") && name.endsWith(".json"),
    );
    const counts = new Map<string, number>();

    for (const file of files) {
        const unit = await json(join("corpus", "units", "circ2019", file));
        for (const block of unit.blocks) {
            if (!block.assetId) continue;
            counts.set(block.assetId, (counts.get(block.assetId) ?? 0) + 1);
        }
    }

    const grouped = {
        figure: [...counts].filter(([id]) => id.includes(":asset:figure:")),
        formula: [...counts].filter(([id]) => id.includes(":asset:formula:")),
        table: [...counts].filter(([id]) => id.includes(":asset:table:")),
    };
    assert.equal(grouped.figure.length, 13);
    assert.equal(grouped.formula.length, 26);
    assert.equal(grouped.table.length, 6);
    for (const [assetId, count] of counts) {
        assert.equal(count, 1, assetId);
    }
});
