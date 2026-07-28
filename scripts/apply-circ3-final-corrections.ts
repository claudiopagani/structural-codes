import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../", import.meta.url));
const unitDir = join(repoRoot, "corpus", "units", "circ2019");
const profile = "circ3-final-editorial-profile-0.1.0";

// Canonical unit records intentionally contain heterogeneous block shapes.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Unit = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Block = any;

function sha256(value: string): string {
    return createHash("sha256").update(value).digest("hex");
}

async function load(id: string): Promise<Unit> {
    return JSON.parse(await readFile(join(unitDir, `${id}.json`), "utf8"));
}

async function save(id: string, unit: Unit): Promise<void> {
    await writeFile(
        join(unitDir, `${id}.json`),
        `${JSON.stringify(unit, null, 2)}\n`,
        "utf8",
    );
}

function refreshHashes(block: Block): void {
    if (!block.text || !block.evidence) return;
    block.evidence.rawSha256 = sha256(block.text.raw);
    block.evidence.normalizedSha256 = sha256(block.text.normalized);
}

function addCorrection(block: Block, note: string): void {
    block.text.normalizationVersion = profile;
    block.evidence.transformations ??= [];
    block.evidence.transformations.push({
        operation: "manual-correction",
        ruleVersion: profile,
        note,
    });
    refreshHashes(block);
}

function cloneTextBlock(
    source: Block,
    blockId: string,
    kind: "paragraph" | "list-item",
    raw: string,
    normalized: string,
    inline?: Array<{ kind: "text" | "math"; value: string; latex?: string }>,
): Block {
    const block = structuredClone(source);
    block.blockId = blockId;
    block.kind = kind;
    block.text.raw = raw;
    block.text.normalized = normalized;
    block.text.normalizationVersion = profile;
    if (inline) block.text.inline = inline;
    else delete block.text.inline;
    block.evidence.transformations = [
        {
            operation: "join-line-wrap",
            ruleVersion: profile,
            note: "Ricomposti esclusivamente i ritorni a capo tipografici del PDF.",
        },
        {
            operation: "normalize-whitespace",
            ruleVersion: profile,
            note: "Uniformati gli spazi dopo la ricomposizione.",
        },
        {
            operation: "unicode-nfc",
            ruleVersion: profile,
            note: "Testo normalizzato in Unicode NFC.",
        },
    ];
    refreshHashes(block);
    return block;
}

{
    const unit = await load("c3.2.1");
    const replacements = new Map([
        ["Tabella C3.2.I", "Tabella C.3.2.I"],
        ["Tabella C3.2.II", "Tabella C.3.2.II"],
        ["formula C3.2.1", "formula C.3.2.1"],
        ["formula C3.2.2", "formula C.3.2.2"],
    ]);
    for (const block of unit.blocks) {
        if (!block.text) continue;
        let changed = false;
        for (const [from, to] of replacements) {
            if (block.text.normalized.includes(from)) {
                block.text.normalized = block.text.normalized.replaceAll(from, to);
                changed = true;
            }
            for (const segment of block.text.inline ?? []) {
                if (segment.kind === "text" && segment.value.includes(from)) {
                    segment.value = segment.value.replaceAll(from, to);
                    changed = true;
                }
            }
        }
        if (changed) {
            addCorrection(
                block,
                "Ripristinata la punteggiatura della numerazione ufficiale C.3.2 nel testo della fonte.",
            );
        }
    }
    await save("c3.2.1", unit);
}

{
    const unit = await load("c3.4.5");
    const source = unit.blocks[2];
    const splitRaw = source.text.raw.split("\nPer edifici");
    if (splitRaw.length !== 2) throw new Error("c3.4.5 raw split non trovato");
    const firstRaw = splitRaw[0];
    const secondRaw = `Per edifici${splitRaw[1]}`;
    const first =
        "Laddove adeguatamente motivato può applicarsi solamente per coperture ricadenti in località nelle quali il carico della neve al suolo è superiore a 1,5 kN/m2, e caratterizzate da trasmittanza superiore a 1 W/m2K°.";
    const second =
        "Per edifici nei quali la temperatura interna è mantenuta intenzionalmente sotto 0°C (edifici frigoriferi, impianti per il pattinaggio su ghiaccio ecc.) si raccomanda di assumere il valore del coefficiente termico pari a 1,2, indipendentemente dal valore del carico neve al suolo.";
    unit.blocks.splice(
        2,
        1,
        cloneTextBlock(
            source,
            `${unit.id}#block-editorial-002`,
            "paragraph",
            firstRaw,
            first,
            [
                {
                    kind: "text",
                    value: "Laddove adeguatamente motivato può applicarsi solamente per coperture ricadenti in località nelle quali il carico della neve al suolo è superiore a ",
                },
                {
                    kind: "math",
                    value: "1,5 kN/m2",
                    latex: "1{,}5\\,\\mathrm{kN/m^2}",
                },
                {
                    kind: "text",
                    value: ", e caratterizzate da trasmittanza superiore a ",
                },
                {
                    kind: "math",
                    value: "1 W/m2K°",
                    latex: "1\\,\\mathrm{W/(m^2 K^\\circ)}",
                },
                { kind: "text", value: "." },
            ],
        ),
        cloneTextBlock(
            source,
            `${unit.id}#block-editorial-003`,
            "paragraph",
            secondRaw,
            second,
            [
                {
                    kind: "text",
                    value: "Per edifici nei quali la temperatura interna è mantenuta intenzionalmente sotto ",
                },
                {
                    kind: "math",
                    value: "0°C",
                    latex: "0\\,{}^\\circ\\mathrm{C}",
                },
                {
                    kind: "text",
                    value: " (edifici frigoriferi, impianti per il pattinaggio su ghiaccio ecc.) si raccomanda di assumere il valore del coefficiente termico pari a ",
                },
                { kind: "math", value: "1,2", latex: "1{,}2" },
                {
                    kind: "text",
                    value: ", indipendentemente dal valore del carico neve al suolo.",
                },
            ],
        ),
    );
    await save("c3.4.5", unit);
}

{
    const unit = await load("c3.6");
    for (const [firstIndex, secondIndex] of [
        [7, 8],
        [4, 5],
    ] as const) {
        const first = unit.blocks[firstIndex];
        const second = unit.blocks[secondIndex];
        first.text.raw = `${first.text.raw}\n${second.text.raw}`;
        first.text.normalized = `${first.text.normalized} ${second.text.normalized}.`
            .replace("2015..", "2015.")
            .replace("2015 .", "2015.");
        addCorrection(
            first,
            "Unito il capoverso falsamente spezzato dall’andata a capo tipografica dopo «D.M.».",
        );
        unit.blocks.splice(secondIndex, 1);
    }
    await save("c3.6", unit);
}

for (const spec of [
    {
        id: "c3.6.1.1",
        marker: ":- la capacità",
        intro: "Si chiariscono di seguito le seguenti definizioni:",
        item:
            "la capacità di compartimentazione è riferibile ai requisiti REI nonché ad ulteriori requisiti aggiuntivi attribuibili agli elementi delimitanti un compartimento antincendio ai fini della mitigazione del rischio di incendio. Utili indicazioni in merito sono riportate nel D.M. 16 febbraio 2007, nel D.M. 3 agosto 2015 e nella UNI EN 13501-2;",
    },
    {
        id: "c3.6.1.2",
        marker: "decreti:- D.M. 9 marzo",
        intro:
            "Con riferimento al § 3.6.1.2 delle NTC, le disposizioni del Ministero dell’interno richiamate al punto precedente, sono contenute nei seguenti decreti:",
        item:
            "D.M. 9 marzo 2007: Prestazioni di resistenza al fuoco delle costruzioni nelle attività soggette al controllo del corpo nazionale dei Vigili del Fuoco;",
    },
    {
        id: "c3.6.1.5.1",
        marker: "condizioni:- curva nominale",
        intro:
            "Secondo l’incendio convenzionale di progetto adottato, si precisa che l’andamento delle temperature è valutato con riferimento a una delle due seguenti condizioni:",
        item:
            "curva nominale d’incendio, da individuare tra quelle indicate successivamente, per l’intervallo di tempo di esposizione pari alla classe di resistenza al fuoco prevista, senza alcuna fase di raffreddamento;",
    },
]) {
    const unit = await load(spec.id);
    const source = unit.blocks[1];
    const markerIndex = source.text.raw.indexOf(spec.marker);
    if (markerIndex < 0) throw new Error(`${spec.id} raw marker non trovato`);
    const separator = spec.marker.indexOf(":-") + 2;
    const rawIntro = source.text.raw.slice(0, markerIndex + separator);
    const rawItem = source.text.raw
        .slice(markerIndex + separator)
        .replace(/^\s*-\s*/u, "");
    unit.blocks.splice(
        1,
        1,
        cloneTextBlock(
            source,
            `${unit.id}#block-editorial-001`,
            "paragraph",
            rawIntro,
            spec.intro,
        ),
        cloneTextBlock(
            source,
            `${unit.id}#block-editorial-001a`,
            "list-item",
            rawItem,
            spec.item,
        ),
    );
    await save(spec.id, unit);
}

console.log("circ3-final-corrections: aggiornate 6 unità");
