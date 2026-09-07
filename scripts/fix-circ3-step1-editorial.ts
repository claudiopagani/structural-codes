import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

type InlineKind = "text" | "em" | "strong" | "math";

type InlineSegment = {
    kind: InlineKind;
    value: string;
    latex?: string;
};

type TextBlock = {
    blockId: string;
    kind: string;
    listMarker?: "bullet" | "dash" | "none";
    text?: {
        normalized: string;
        inline?: InlineSegment[];
    };
};

type Unit = {
    blocks: TextBlock[];
};

type AssetManifest = {
    figures?: Array<{
        officialNumber: string;
        caption: string;
        captionInline?: InlineSegment[];
    }>;
    tables?: Array<{
        officialNumber: string;
        caption: string;
        captionInline?: InlineSegment[];
    }>;
};

const root = fileURLToPath(new URL("../", import.meta.url));
const unitDirectory = join(root, "corpus", "units", "circ2019");
const assetDirectory = join(root, "corpus", "assets", "circ2019");

function assert(condition: unknown, message: string): asserts condition {
    if (!condition) throw new Error(message);
}

function inlineText(block: TextBlock) {
    assert(block.text, `Blocco testuale mancante: ${block.blockId}`);
    return block.text.inline ?? [{ kind: "text" as const, value: block.text.normalized }];
}

function setInline(block: TextBlock, inline: InlineSegment[]) {
    assert(block.text, `Blocco testuale mancante: ${block.blockId}`);
    assert(
        inline.map(({ value }) => value).join("") === block.text.normalized,
        `Inline non allineato al testo normalizzato: ${block.blockId}`,
    );
    block.text.inline = inline;
}

function replaceText(
    block: TextBlock,
    target: string,
    replacement: InlineSegment,
    expectedCount = 1,
) {
    const matchingExisting = inlineText(block).filter(
        (segment) =>
            segment.kind === replacement.kind &&
            segment.value === replacement.value &&
            (segment.kind !== "math" || segment.latex === replacement.latex),
    ).length;
    if (matchingExisting === expectedCount) return;
    assert(
        matchingExisting === 0,
        `Formattazione già presente in modo inatteso per “${target}” in ${block.blockId}`,
    );

    let replacements = 0;
    const updated: InlineSegment[] = [];

    for (const segment of inlineText(block)) {
        if (segment.kind !== "text") {
            updated.push(segment);
            continue;
        }

        let cursor = 0;
        while (cursor < segment.value.length) {
            const index = segment.value.indexOf(target, cursor);
            if (index === -1 || replacements === expectedCount) {
                const tail = segment.value.slice(cursor);
                if (tail) updated.push({ kind: "text", value: tail });
                break;
            }
            const prefix = segment.value.slice(cursor, index);
            if (prefix) updated.push({ kind: "text", value: prefix });
            updated.push(replacement);
            replacements += 1;
            cursor = index + target.length;
        }
    }

    assert(
        replacements === expectedCount,
        `Occorrenze inattese di “${target}” in ${block.blockId}: ${replacements}/${expectedCount}`,
    );
    setInline(block, updated);
}

async function readUnit(name: string) {
    const path = join(unitDirectory, `${name}.json`);
    return { path, unit: JSON.parse(await readFile(path, "utf8")) as Unit };
}

function blockStartingWith(unit: Unit, text: string) {
    const block = unit.blocks.find(
        (candidate) => candidate.text?.normalized.startsWith(text),
    );
    assert(block, `Blocco non trovato: ${text}`);
    return block;
}

function style(
    block: TextBlock,
    kind: "em" | "strong",
    value: string,
    expectedCount = 1,
) {
    replaceText(block, value, { kind, value }, expectedCount);
}

function math(
    block: TextBlock,
    value: string,
    latex: string,
    expectedCount = 1,
) {
    replaceText(block, value, { kind: "math", value, latex }, expectedCount);
}

async function writeUnit(path: string, unit: Unit) {
    await writeFile(path, `${JSON.stringify(unit, null, 2)}\n`, "utf8");
}

function captionInline(
    label: string,
    segments: InlineSegment[],
): InlineSegment[] {
    const inline = [{ kind: "strong" as const, value: label }, ...segments];
    return inline;
}

function verifyCaption(caption: string, inline: InlineSegment[]) {
    assert(
        inline.map(({ value }) => value).join("") === caption,
        `Didascalia non allineata: ${caption}`,
    );
}

async function updateStepUnits() {
    {
        const { path, unit } = await readUnit("c3.1.3");
        const block = blockStartingWith(unit, "Nel paragrafo § 3.1.3");
        math(block, "5,0 kN/m", "5{,}0\\,\\mathrm{kN/m}");
        await writeUnit(path, unit);
    }

    {
        const { path, unit } = await readUnit("c3.2");
        const naming = blockStartingWith(unit, "La pericolosità sismica di un sito");
        style(naming, "em", "periodo di riferimento");
        style(naming, "em", "probabilità di eccedenza o di superamento nel periodo di riferimento");

        const variability = blockStartingWith(unit, "I valori di ag, Fo e TC*");
        style(variability, "em", "variabilità spaziale");
        await writeUnit(path, unit);
    }

    {
        const { path, unit } = await readUnit("c3.2.1");
        const exercise = blockStartingWith(unit, "Ci si riferisce dunque");
        for (const value of ["SLE", "SLO", "SLD"]) style(exercise, "strong", value);

        const ultimate = blockStartingWith(unit, "In modo analogo");
        for (const value of ["SLU", "SLV", "SLC"]) style(ultimate, "strong", value);

        const orderedStates = blockStartingWith(unit, "I quattro stati limite così");
        for (const value of ["SLO", "SLD", "SLV", "SLC"]) style(orderedStates, "strong", value);

        const strategy = blockStartingWith(unit, "Alla base dei risultati");
        style(strategy, "strong", "strategia progettuale di norma");

        const equalLaw = blockStartingWith(unit, "Fissata la vita nominale");
        style(equalLaw, "strong", "Al variare di ");
        style(equalLaw, "strong", " variano con legge uguale.");

        const quotation = blockStartingWith(unit, "Al riguardo le NTC");
        style(
            quotation,
            "em",
            "“Qualora la protezione nei confronti degli stati limite di esercizio sia di prioritaria importanza, i valori di ",
        );
        style(
            quotation,
            "em",
            " forniti in tabella devono essere ridotti in funzione del grado di protezione che si vuole raggiungere.”",
        );
        const quotedMath = quotation.text?.inline?.find(
            (segment) => segment.kind === "math" && segment.value === "PVR",
        );
        assert(quotedMath, "PVR non trovato nella citazione C3.2.1");
        quotedMath.latex = "\\mathit{P}_{VR}";

        const inferredValues = blockStartingWith(unit, "Constatato che");
        for (const value of ["SLU", "SLE"]) style(inferredValues, "strong", value);

        const tableValues = blockStartingWith(unit, "È così possibile ricavare");
        for (const value of ["SLE", "SLU"]) style(tableValues, "strong", value);

        const costlyStrategy = blockStartingWith(unit, "Se dunque la protezione");
        style(
            costlyStrategy,
            "em",
            "dunque è lecito adottarla unicamente nei casi in cui gli SLE siano effettivamente di prioritaria importanza.",
        );

        const strategyChoice = blockStartingWith(unit, "Ottenuti i valori di TR");
        style(strategyChoice, "strong", "strategia progettuale a o b");

        await writeUnit(path, unit);
    }

    {
        const { path, unit } = await readUnit("c3.2.2");
        const definition = blockStartingWith(unit, "Si denomina");
        style(definition, "em", "“risposta sismica locale”");
        style(definition, "em", "“superficie”", 2);
        style(definition, "em", "”piano di riferimento”");

        const stratigraphic = blockStartingWith(unit, "effetti stratigrafici");
        stratigraphic.listMarker = "dash";
        style(stratigraphic, "em", "effetti stratigrafici");

        const topographic = blockStartingWith(unit, "effetti topografici");
        topographic.listMarker = "dash";
        style(topographic, "em", "effetti topografici");

        const profile = blockStartingWith(unit, "L’identificazione della categoria");
        math(profile, "NSPT,30", "N_{\u005cmathrm{SPT},30}");
        math(profile, "cu,30", "c_{u,30}");
        style(profile, "em", "“di comprovata affidabilità”");

        const velocity = blockStartingWith(unit, "La velocità equivalente è ottenuta");
        math(velocity, "H", "H", 2);
        await writeUnit(path, unit);
    }

    {
        const { path, unit } = await readUnit("c3.2.3.1");
        for (const block of unit.blocks.filter(({ kind }) => kind === "list-item")) {
            block.listMarker = "dash";
        }
        await writeUnit(path, unit);
    }

    {
        const { path, unit } = await readUnit("c3.2.3.2.1");
        const block = blockStartingWith(unit, "Nel caso di significativi");
        math(block, "q", "q");
        await writeUnit(path, unit);
    }

    {
        const { path, unit } = await readUnit("c3.2.3.6");
        for (const block of unit.blocks.filter(({ kind }) => kind === "list-item")) {
            block.listMarker = "none";
        }
        const numbered = blockStartingWith(unit, "3. Le coppie di registrazioni");
        math(numbered, "α", "\\alpha");
        const interval = blockStartingWith(unit, "dove t1 e t2");
        math(interval, "t1", "t_1");
        math(interval, "t2", "t_2");
        await writeUnit(path, unit);
    }
}

async function updateStepAssets() {
    const figurePath = join(assetDirectory, "core-figure-placeholders.json");
    const figureManifest = JSON.parse(
        await readFile(figurePath, "utf8"),
    ) as AssetManifest;
    assert(figureManifest.figures, "Manifest figure mancante");

    const figures = new Map(
        figureManifest.figures.map((figure) => [figure.officialNumber, figure]),
    );
    const figureUpdates: Array<[string, string, InlineSegment[]]> = [
        [
            "C3.2.1a",
            "Figura C3.2.1 a – Variabilità di ag con TR: andamento medio sul territorio nazionale ed intervallo di confidenza al 95%",
            captionInline("Figura C3.2.1 a", [
                { kind: "text", value: " – " },
                { kind: "em", value: "Variabilità di " },
                { kind: "math", value: "ag", latex: "a_g" },
                { kind: "em", value: " con " },
                { kind: "math", value: "TR", latex: "T_R" },
                {
                    kind: "em",
                    value: ": andamento medio sul territorio nazionale ed intervallo di confidenza al 95%",
                },
            ]),
        ],
        [
            "C3.2.1b",
            "Figura C3.2.1 b – Variabilità di Fo con TR: andamento medio sul territorio nazionale ed intervallo di confidenza al 95%",
            captionInline("Figura C3.2.1 b", [
                { kind: "text", value: " – " },
                { kind: "em", value: "Variabilità di " },
                { kind: "math", value: "Fo", latex: "F_0" },
                { kind: "em", value: " con " },
                { kind: "math", value: "TR", latex: "T_R" },
                {
                    kind: "em",
                    value: ": andamento medio sul territorio nazionale ed intervallo di confidenza al 95%",
                },
            ]),
        ],
        [
            "C3.2.1c",
            "Figura C3.2.1 c – Variabilità di TC* con TR: andamento medio sul territorio nazionale ed intervallo di confidenza al 95%",
            captionInline("Figura C3.2.1 c", [
                { kind: "text", value: " – " },
                { kind: "em", value: "Variabilità di " },
                { kind: "math", value: "TC*", latex: "T_C^*" },
                { kind: "em", value: " con " },
                { kind: "math", value: "TR", latex: "T_R" },
                {
                    kind: "em",
                    value: ": andamento medio sul territorio nazionale ed intervallo di confidenza al 95%",
                },
            ]),
        ],
        [
            "C3.2.2",
            "Figura C3.2.2 – Variazione di R con CU e PVR",
            captionInline("Figura C3.2.2", [
                { kind: "text", value: " – " },
                { kind: "em", value: "Variazione di " },
                { kind: "math", value: "R", latex: "R" },
                { kind: "em", value: " con " },
                { kind: "math", value: "CU", latex: "C_U" },
                { kind: "em", value: " e " },
                { kind: "math", value: "PVR", latex: "P_{VR}" },
            ]),
        ],
        [
            "C3.2.3",
            "Figura C3.2.3 – Andamento del coefficiente SS per le componenti orizzontali dell’azione sismica",
            captionInline("Figura C3.2.3", [
                { kind: "text", value: " – " },
                { kind: "em", value: "Andamento del coefficiente " },
                { kind: "math", value: "SS", latex: "S_S" },
                {
                    kind: "em",
                    value: " per le componenti orizzontali dell’azione sismica",
                },
            ]),
        ],
        [
            "C3.2.4",
            "Figura C3.2.4 – Andamento del coefficiente CC",
            captionInline("Figura C3.2.4", [
                { kind: "text", value: " – " },
                { kind: "em", value: "Andamento del coefficiente " },
                { kind: "math", value: "CC", latex: "C_C" },
            ]),
        ],
    ];

    for (const [officialNumber, caption, inline] of figureUpdates) {
        const figure = figures.get(officialNumber);
        assert(figure, `Figura non trovata: ${officialNumber}`);
        verifyCaption(caption, inline);
        figure.caption = caption;
        figure.captionInline = inline;
    }
    await writeFile(figurePath, `${JSON.stringify(figureManifest, null, 2)}\n`, "utf8");

    const tablePath = join(assetDirectory, "core-tables.json");
    const tableManifest = JSON.parse(
        await readFile(tablePath, "utf8"),
    ) as AssetManifest;
    assert(tableManifest.tables, "Manifest tabelle mancante");
    const tables = new Map(
        tableManifest.tables.map((table) => [table.officialNumber, table]),
    );
    const tableUpdates: Array<[string, InlineSegment[]]> = [
        [
            "C.3.2.I",
            captionInline("Tabella C.3.2.I", [
                { kind: "text", value: " – " },
                { kind: "em", value: "Valori di " },
                { kind: "math", value: "TR", latex: "T_R" },
                { kind: "em", value: " espressi in funzione di " },
                { kind: "math", value: "VR", latex: "V_R" },
            ]),
        ],
        [
            "C.3.2.II",
            captionInline("Tabella C.3.2.II", [
                { kind: "text", value: " – " },
                { kind: "em", value: "Valori di " },
                { kind: "math", value: "P*VR", latex: "P^*_{VR}" },
                { kind: "em", value: " e " },
                { kind: "math", value: "TR", latex: "T_R" },
                { kind: "em", value: " al variare di " },
                { kind: "math", value: "CU", latex: "C_U" },
            ]),
        ],
    ];

    for (const [officialNumber, inline] of tableUpdates) {
        const table = tables.get(officialNumber);
        assert(table, `Tabella non trovata: ${officialNumber}`);
        verifyCaption(table.caption, inline);
        table.captionInline = inline;
    }
    await writeFile(tablePath, `${JSON.stringify(tableManifest, null, 2)}\n`, "utf8");
}

await updateStepUnits();
await updateStepAssets();
