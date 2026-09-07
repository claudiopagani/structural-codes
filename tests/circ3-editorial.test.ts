import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = fileURLToPath(new URL("../", import.meta.url));

type InlineSegment = { kind: string; value: string; latex?: string };
type TextBlock = {
    kind: string;
    listMarker?: string;
    text?: { normalized: string; inline?: InlineSegment[] };
};
type Unit = { blocks: TextBlock[] };

async function readUnit(name: string) {
    return JSON.parse(
        await readFile(join(root, "corpus/units/circ2019", `${name}.json`), "utf8"),
    ) as Unit;
}

function blockStartingWith(unit: Unit, prefix: string) {
    const block = unit.blocks.find((candidate) =>
        candidate.text?.normalized.startsWith(prefix),
    );
    assert.ok(block, prefix);
    assert.ok(block.text);
    return block as TextBlock & { text: NonNullable<TextBlock["text"]> };
}

function kindsForValue(block: TextBlock, value: string) {
    return block.text?.inline
        ?.filter((segment) => segment.value === value)
        .map((segment) => segment.kind) ?? [];
}

test("Circolare C3.2 conserva enfasi, elenchi e matematica inline verificati sul PDF", async () => {
    const c32 = await readUnit("c3.2");
    assert.deepEqual(
        kindsForValue(
            blockStartingWith(c32, "La pericolosità sismica di un sito"),
            "periodo di riferimento",
        ),
        ["em"],
    );
    assert.deepEqual(
        kindsForValue(
            blockStartingWith(c32, "I valori di ag, Fo e TC*"),
            "variabilità spaziale",
        ),
        ["em"],
    );

    const c321 = await readUnit("c3.2.1");
    assert.deepEqual(
        kindsForValue(blockStartingWith(c321, "Ci si riferisce dunque"), "SLO"),
        ["strong"],
    );
    assert.deepEqual(
        kindsForValue(
            blockStartingWith(c321, "Alla base dei risultati"),
            "strategia progettuale di norma",
        ),
        ["strong"],
    );
    assert.equal(
        blockStartingWith(c321, "Al riguardo le NTC").text.inline?.some(
            (segment) => segment.kind === "em" && segment.value.startsWith("“Qualora"),
        ),
        true,
    );

    const c322 = await readUnit("c3.2.2");
    assert.deepEqual(
        c322.blocks.filter(({ kind }) => kind === "list-item").map(({ listMarker }) => listMarker),
        ["dash", "dash"],
    );
    const profile = blockStartingWith(c322, "L’identificazione della categoria");
    assert.equal(
        profile.text.inline?.some(
            (segment) => segment.kind === "math" && segment.latex === "N_{\\mathrm{SPT},30}",
        ),
        true,
    );
    assert.deepEqual(kindsForValue(profile, "“di comprovata affidabilità”"), ["em"]);

    const c3231 = await readUnit("c3.2.3.1");
    assert.equal(
        c3231.blocks.filter(({ kind }) => kind === "list-item").every(({ listMarker }) => listMarker === "dash"),
        true,
    );

    const c32321 = await readUnit("c3.2.3.2.1");
    assert.equal(
        blockStartingWith(c32321, "Nel caso di significativi").text.inline?.some(
            (segment) => segment.kind === "math" && segment.value === "q" && segment.latex === "q",
        ),
        true,
    );

    const c3236 = await readUnit("c3.2.3.6");
    assert.equal(
        c3236.blocks.filter(({ kind }) => kind === "list-item").every(({ listMarker }) => listMarker === "none"),
        true,
    );
    assert.equal(
        blockStartingWith(c3236, "dove t1 e t2").text.inline?.filter(
            (segment) => segment.kind === "math",
        ).map(({ latex }) => latex).join(","),
        "t_1,t_2",
    );
});

test("Le didascalie degli asset C3.2 mantengono stile e pedici", async () => {
    const figures = JSON.parse(
        await readFile(
            join(root, "corpus/assets/circ2019/core-figure-placeholders.json"),
            "utf8",
        ),
    ) as { figures: Array<{ officialNumber: string; caption: string; captionInline?: InlineSegment[] }> };
    const figure = figures.figures.find(
        ({ officialNumber }) => officialNumber === "C3.2.1a",
    );
    assert.ok(figure);
    assert.equal(
        figure.caption,
        "Figura C3.2.1 a – Variabilità di ag con TR: andamento medio sul territorio nazionale ed intervallo di confidenza al 95%",
    );
    assert.deepEqual(
        figure.captionInline?.filter(({ kind }) => kind === "math").map(({ latex }) => latex),
        ["a_g", "T_R"],
    );

    const tables = JSON.parse(
        await readFile(join(root, "corpus/assets/circ2019/core-tables.json"), "utf8"),
    ) as { tables: Array<{ officialNumber: string; caption: string; captionInline?: InlineSegment[] }> };
    const table = tables.tables.find(
        ({ officialNumber }) => officialNumber === "C.3.2.II",
    );
    assert.ok(table);
    assert.deepEqual(
        table.captionInline?.filter(({ kind }) => kind === "math").map(({ latex }) => latex),
        ["P^*_{VR}", "T_R", "C_U"],
    );
});

test("Circolare C3.3 conserva marcatori, enfasi e formule inline già verificate", async () => {
    const c338 = await readUnit("c3.3.8");
    assert.deepEqual(
        c338.blocks.filter(({ kind }) => kind === "list-item").map(({ listMarker }) => listMarker),
        ["dash", "dash", "dash"],
    );
    assert.equal(
        blockStartingWith(c338, "A è l’area").text.inline?.some(
            (segment) => segment.kind === "math" && segment.value === "A" && segment.latex === "A",
        ),
        true,
    );

    const height = await readUnit("c3.3.8.1.1.1");
    assert.deepEqual(
        height.blocks.filter(({ kind }) => kind === "list-item").map(({ listMarker }) => listMarker),
        ["none", "none"],
    );
    assert.deepEqual(
        kindsForValue(
            blockStartingWith(height, "C3.3.8.1.1.1"),
            "Altezza di riferimento per la faccia sopravento",
        ),
        ["em"],
    );
});

test("Le didascalie C3.3 distinguono etichetta, descrizione e simboli", async () => {
    const figures = JSON.parse(
        await readFile(
            join(root, "corpus/assets/circ2019/core-figure-placeholders.json"),
            "utf8",
        ),
    ) as { figures: Array<{ officialNumber: string; captionInline?: InlineSegment[] }> };
    const chart = figures.figures.find(({ officialNumber }) => officialNumber === "C3.3.1");
    assert.ok(chart);
    assert.deepEqual(
        chart.captionInline?.filter(({ kind }) => kind === "math").map(({ latex }) => latex),
        ["\\alpha_R", "T_R"],
    );
    assert.equal(chart.captionInline?.[0]?.kind, "strong");
    assert.equal(chart.captionInline?.some(({ kind }) => kind === "em"), true);

    const tables = JSON.parse(
        await readFile(join(root, "corpus/assets/circ2019/core-tables.json"), "utf8"),
    ) as { tables: Array<{ officialNumber: string; captionInline?: InlineSegment[] }> };
    const table = tables.tables.find(({ officialNumber }) => officialNumber === "C3.3.V");
    assert.ok(table);
    assert.deepEqual(
        table.captionInline?.filter(({ kind }) => kind === "math").map(({ latex }) => latex),
        ["\\alpha"],
    );
    assert.equal(table.captionInline?.[0]?.kind, "strong");
});

test("C3.3 successivo conserva livelli di elenco e caption delle tettoie", async () => {
    const multiple = await readUnit("c3.3.8.1.6");
    assert.deepEqual(
        multiple.blocks.filter(({ kind }) => kind === "list-item").map(({ listMarker }) => listMarker),
        ["dash", "dash", "dash", "dash"],
    );
    const round = await readUnit("c3.3.8.3");
    assert.deepEqual(
        round.blocks.filter(({ kind }) => kind === "list-item").map(({ listMarker }) => listMarker),
        ["dash", "dash", "none", "none"],
    );

    const figures = JSON.parse(
        await readFile(
            join(root, "corpus/assets/circ2019/core-figure-placeholders.json"),
            "utf8",
        ),
    ) as { figures: Array<{ officialNumber: string; captionInline?: InlineSegment[] }> };
    const flow = figures.figures.find(({ officialNumber }) => officialNumber === "C3.3.20");
    assert.ok(flow);
    assert.deepEqual(
        flow.captionInline?.filter(({ kind }) => kind === "math").map(({ latex }) => latex),
        ["\\phi=0", "\\phi=1"],
    );

    const tables = JSON.parse(
        await readFile(join(root, "corpus/assets/circ2019/core-tables.json"), "utf8"),
    ) as { tables: Array<{ officialNumber: string; captionInline?: InlineSegment[] }> };
    const parameters = tables.tables.find(({ officialNumber }) => officialNumber === "C3.3.XVIII");
    assert.ok(parameters);
    assert.deepEqual(
        parameters.captionInline?.filter(({ kind }) => kind === "math").map(({ latex }) => latex),
        ["c_{pm}", "c_{pb}", "\\alpha_m", "\\alpha_b", "\\frac{k}{b}\\le0{,}5\\cdot10^{-3}"],
    );
});

test("C3.4 e C3.6 mantengono marcatori, enfasi e sottolineature verificate sul PDF", async () => {
    const snow = await readUnit("c3.4.3");
    assert.equal(
        snow.blocks.filter(({ kind }) => kind === "list-item").every(({ listMarker }) => listMarker === "dash"),
        true,
    );
    const drift = await readUnit("c3.4.3.3.2");
    assert.deepEqual(
        kindsForValue(
            blockStartingWith(drift, "deposito della neve"),
            "“ombra aerodinamica”",
        ),
        ["em"],
    );
    const fire = await readUnit("c3.6.1.1");
    assert.deepEqual(
        kindsForValue(
            blockStartingWith(fire, "la capacità di compartimentazione"),
            "la capacità di compartimentazione",
        ),
        ["em"],
    );
    assert.deepEqual(
        kindsForValue(
            blockStartingWith(fire, "il carico d’incendio"),
            "lorda",
        ),
        ["underline"],
    );
    assert.equal(
        (fire as Unit & { workflow?: { openIssues?: Array<{ issueId: string }> } }).workflow?.openIssues?.some(
            ({ issueId }) => issueId === "circ2019-c3-6-1-1-underline",
        ),
        false,
    );
    const curves = await readUnit("c3.6.1.5.1");
    assert.deepEqual(
        kindsForValue(blockStartingWith(curves, "Si evidenzia infine"), "“tunnel curve”"),
        ["em"],
    );
});

test("Le caption C3.4 riproducono label, corsivo e matematica", async () => {
    const figures = JSON.parse(
        await readFile(
            join(root, "corpus/assets/circ2019/core-figure-placeholders.json"),
            "utf8",
        ),
    ) as { figures: Array<{ officialNumber: string; captionInline?: InlineSegment[] }> };
    const adaptation = figures.figures.find(({ officialNumber }) => officialNumber === "C3.4.1");
    assert.ok(adaptation);
    assert.equal(adaptation.captionInline?.[0]?.kind, "strong");
    assert.deepEqual(
        adaptation.captionInline?.filter(({ kind }) => kind === "math").map(({ latex }) => latex),
        ["v = 0{,}6"],
    );
    const tables = JSON.parse(
        await readFile(join(root, "corpus/assets/circ2019/core-tables.json"), "utf8"),
    ) as { tables: Array<{ officialNumber: string; captionInline?: InlineSegment[] }> };
    const snowTable = tables.tables.find(({ officialNumber }) => officialNumber === "C3.4.I");
    assert.ok(snowTable);
    assert.deepEqual(snowTable.captionInline?.map(({ kind }) => kind), ["strong", "em"]);
});
