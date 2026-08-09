import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { sha256OfText } from "../src/lib/hash.ts";

const repoRoot = fileURLToPath(new URL("../", import.meta.url));
const unitDirectory = join(repoRoot, "corpus", "units", "ntc2018");
const sourceId = "gu-so8-2018-ntc";
const workId = "it-mit:dm:2018-01-17:ntc2018";
const expressionId = "it-mit:dm:2018-01-17:ntc2018:original-it";
const profile = "ntc42-editorial-profile-0.1.0";
const createdAt = "2026-08-09T00:00:00Z";

type Region = {
    coordinateSystem: "pdf-points-top-left";
    x: number;
    y: number;
    width: number;
    height: number;
};

type TextOptions = {
    wrap?: boolean;
    discretionaryHyphen?: boolean;
    manual?: boolean;
};

const unitId = (number: string) =>
    `urn:structural-codes:it:unit:ntc2018:${number}`;
const region = (x: number, y: number, width: number, height: number): Region => ({
    coordinateSystem: "pdf-points-top-left",
    x,
    y,
    width,
    height,
});

function transformations(options: TextOptions = {}) {
    const result: Array<{
        operation:
            | "unicode-nfc"
            | "join-line-wrap"
            | "remove-discretionary-hyphen"
            | "normalize-whitespace"
            | "manual-correction";
        ruleVersion: string;
        note: string;
    }> = [];
    if (options.wrap) {
        result.push(
            {
                operation: "join-line-wrap",
                ruleVersion: profile,
                note: "Unite le righe appartenenti allo stesso blocco; i capoversi e le voci dell’elenco restano distinti.",
            },
            {
                operation: "normalize-whitespace",
                ruleVersion: profile,
                note: "Uniformati gli spazi dopo la ricomposizione delle righe.",
            },
        );
    }
    if (options.discretionaryHyphen) {
        result.push({
            operation: "remove-discretionary-hyphen",
            ruleVersion: profile,
            note: "Ricomposte le parole spezzate dal trattino tipografico a fine riga.",
        });
    }
    if (options.manual) {
        result.push({
            operation: "manual-correction",
            ruleVersion: profile,
            note: "Ripristinati gli accenti, gli apostrofi tipografici e la punteggiatura confrontati con il render ufficiale.",
        });
    }
    if (options.manual || options.wrap) {
        result.push({
            operation: "unicode-nfc",
            ruleVersion: profile,
            note: "Testo normalizzato in Unicode NFC.",
        });
    }
    return result;
}

function evidence(
    pdfPage: number,
    printedPage: string,
    blockRegion: Region,
    raw: string,
    normalized: string,
    options: TextOptions,
) {
    return {
        sourceId,
        pdfPage,
        printedPage,
        region: blockRegion,
        extraction: {
            method: "pdf-text",
            tool: "pdfjs-dist",
            toolVersion: "4.10.38",
        },
        transformations: transformations(options),
        rawSha256: sha256OfText(raw),
        normalizedSha256: sha256OfText(normalized),
    };
}

function textBlock(
    number: string,
    suffix: string,
    kind: "heading" | "paragraph" | "list-item",
    blockRegion: Region,
    raw: string,
    normalized: string,
    options: TextOptions = {},
) {
    return {
        blockId: `${unitId(number)}#block-${suffix}`,
        kind,
        origin: "official",
        text: {
            raw,
            normalized,
            normalizationVersion: profile,
            inline: [{ kind: "text" as const, value: normalized }],
        },
        evidence: evidence(97, "93", blockRegion, raw, normalized, options),
    };
}

function parent(number: string) {
    const parts = number.split(".");
    return parts.length === 1 ? null : unitId(parts.slice(0, -1).join("."));
}

function ancestors(number: string) {
    const parts = number.split(".");
    return parts.slice(1).map((_, index) => unitId(parts.slice(0, index + 1).join(".")));
}

function makeUnit(
    number: string,
    title: string,
    blocks: unknown[],
) {
    return {
        $schema: "urn:structural-codes:schema:canonical-unit:v2",
        schemaVersion: "2.0.0-alpha.2",
        recordType: "canonical-unit",
        id: unitId(number),
        workId,
        expressionId,
        kind: "subparagraph",
        numbering: {
            official: number,
            sortKey: number.split(".").map((part) => part.padStart(3, "0")).join("."),
        },
        title,
        titleBlockId: `${unitId(number)}#block-heading`,
        hierarchy: {
            parentId: parent(number),
            ancestorIds: ancestors(number),
            position: Number(number.split(".").at(-1)),
        },
        validity: {
            from: "2018-03-22",
            to: null,
            status: "in-force",
            asOf: "2026-08-09",
        },
        blocks,
        citations: [],
        relations: [],
        assets: { formulaIds: [], tableIds: [], figureIds: [] },
        workflow: {
            status: "extracted",
            createdBy: {
                actorId: "codex:ntc42-step2",
                kind: "automated-agent",
                toolVersion: profile,
            },
            createdAt,
            reviews: [],
            openIssues: [
                {
                    issueId: `ntc2018-${number.replaceAll(".", "-")}-source-review`,
                    type: "normalization-review",
                    severity: "blocking",
                    note: "Record trascritto dall’evidence ufficiale ma non ancora confrontato integralmente da un revisore umano con il render della fonte.",
                },
            ],
        },
    };
}

const units = [
    makeUnit("4.2.2", "VALUTAZIONE DELLA SICUREZZA", [
        textBlock(
            "4.2.2",
            "heading",
            "heading",
            region(82.954, 260.264, 152.614, 7.476),
            "4.2.2. VALUTAZIONE DELLA SICUREZZA",
            "4.2.2 VALUTAZIONE DELLA SICUREZZA",
            { manual: true },
        ),
        textBlock(
            "4.2.2",
            "editorial-001",
            "paragraph",
            region(82.954, 272.218, 323.058, 7.482),
            "La valutazione della sicurezza è condotta secondo i principi fondamentali illustrati nel Capitolo 2.",
            "La valutazione della sicurezza è condotta secondo i principi fondamentali illustrati nel Capitolo 2.",
        ),
        textBlock(
            "4.2.2",
            "editorial-002",
            "paragraph",
            region(82.954, 284.78, 428.647, 17.598),
            "I requisiti richiesti di resistenza, funzionalità, durabilità e robustezza si garantiscono verificando il rispetto degli stati limite ultimi e\ndegli stati limite di esercizio della struttura, dei componenti strutturali e dei collegamenti descritti nella presente norma.",
            "I requisiti richiesti di resistenza, funzionalità, durabilità e robustezza si garantiscono verificando il rispetto degli stati limite ultimi e degli stati limite di esercizio della struttura, dei componenti strutturali e dei collegamenti descritti nella presente norma.",
            { wrap: true },
        ),
    ]),
    makeUnit("4.2.2.1", "STATI LIMITE", [
        textBlock(
            "4.2.2.1",
            "heading",
            "heading",
            region(82.954, 317.384, 89.0, 7.476),
            "4.2.2.1 S TATI LIMITE",
            "4.2.2.1 STATI LIMITE",
            { manual: true },
        ),
        textBlock(
            "4.2.2.1",
            "editorial-001",
            "paragraph",
            region(82.954, 340.648, 185.002, 7.482),
            "Gli stati limite ultimi da verificare, ove necessario, sono:",
            "Gli stati limite ultimi da verificare, ove necessario, sono:",
        ),
        textBlock(
            "4.2.2.1",
            "editorial-002",
            "list-item",
            region(82.954, 351.564, 428.556, 17.557),
            "– stato limite di equilibrio, al fine di controllare l’equilibrio globale della struttura e delle sue parti durante tutta la vita nominale\ncomprese le fasi di costruzione e di riparazione;",
            "– stato limite di equilibrio, al fine di controllare l’equilibrio globale della struttura e delle sue parti durante tutta la vita nominale comprese le fasi di costruzione e di riparazione;",
            { wrap: true },
        ),
        textBlock(
            "4.2.2.1",
            "editorial-003",
            "list-item",
            region(82.953, 374.246, 428.633, 48.0),
            "– stato limite di collasso, corrispondente al raggiungimento della tensione di snervamento oppure delle deformazioni ultime del\nmateriale e quindi della crisi o eccessiva deformazione di una sezione, di una membratura o di un collegamento (escludendo\nfenomeni di fatica), o alla formazione di un meccanismo di collasso, o all’instaurarsi di fenomeni di instabilità dell’equilibrio\nnegli elementi componenti o nella struttura nel suo insieme, considerando anche fenomeni locali d’instabilità dei quali si possa\ntener conto eventualmente con riduzione delle aree delle sezioni resistenti;",
            "– stato limite di collasso, corrispondente al raggiungimento della tensione di snervamento oppure delle deformazioni ultime del materiale e quindi della crisi o eccessiva deformazione di una sezione, di una membratura o di un collegamento (escludendo fenomeni di fatica), o alla formazione di un meccanismo di collasso, o all’instaurarsi di fenomeni di instabilità dell’equilibrio negli elementi componenti o nella struttura nel suo insieme, considerando anche fenomeni locali d’instabilità dei quali si possa tener conto eventualmente con riduzione delle aree delle sezioni resistenti;",
            { wrap: true },
        ),
        textBlock(
            "4.2.2.1",
            "editorial-004",
            "list-item",
            region(82.961, 427.182, 428.55, 17.55),
            "– stato limite di fatica, controllando le variazioni tensionali indotte dai carichi ripetuti in relazione alle caratteristiche dei dettagli\nstrutturali interessati.",
            "– stato limite di fatica, controllando le variazioni tensionali indotte dai carichi ripetuti in relazione alle caratteristiche dei dettagli strutturali interessati.",
            { wrap: true },
        ),
        textBlock(
            "4.2.2.1",
            "editorial-005",
            "paragraph",
            region(92.371, 449.811, 309.529, 7.482),
            "Per strutture o situazioni particolari, può essere necessario considerare altri stati limite ultimi.",
            "Per strutture o situazioni particolari, può essere necessario considerare altri stati limite ultimi.",
        ),
        textBlock(
            "4.2.2.1",
            "editorial-006",
            "paragraph",
            region(82.951, 462.417, 202.333, 7.482),
            "Gli stati limite di esercizio da verificare, ove necessario, sono:",
            "Gli stati limite di esercizio da verificare, ove necessario, sono:",
        ),
        textBlock(
            "4.2.2.1",
            "editorial-007",
            "list-item",
            region(82.951, 473.333, 428.725, 17.557),
            "– stati limite di deformazione e/o spostamento, al fine di evitare deformazioni e spostamenti che possano compromettere l’uso effi-\nciente della costruzione e dei suoi contenuti, nonché il suo aspetto estetico;",
            "– stati limite di deformazione e/o spostamento, al fine di evitare deformazioni e spostamenti che possano compromettere l’uso efficiente della costruzione e dei suoi contenuti, nonché il suo aspetto estetico;",
            { wrap: true, discretionaryHyphen: true },
        ),
        textBlock(
            "4.2.2.1",
            "editorial-008",
            "list-item",
            region(82.954, 495.948, 428.55, 17.597),
            "– stato limite di vibrazione, al fine di assicurare che le sensazioni percepite dagli utenti garantiscano accettabili livelli di comfort ed il\ncui superamento potrebbe essere indice di scarsa robustezza e/o indicatore di possibili danni negli elementi secondari;",
            "– stato limite di vibrazione, al fine di assicurare che le sensazioni percepite dagli utenti garantiscano accettabili livelli di comfort ed il cui superamento potrebbe essere indice di scarsa robustezza e/o indicatore di possibili danni negli elementi secondari;",
            { wrap: true },
        ),
        textBlock(
            "4.2.2.1",
            "editorial-009",
            "list-item",
            region(82.956, 518.625, 428.551, 17.557),
            "– stato limite di plasticizzazioni locali, al fine di scongiurare deformazioni plastiche che generino deformazioni irreversibili ed inac-\ncettabili;",
            "– stato limite di plasticizzazioni locali, al fine di scongiurare deformazioni plastiche che generino deformazioni irreversibili ed inaccettabili;",
            { wrap: true, discretionaryHyphen: true },
        ),
        textBlock(
            "4.2.2.1",
            "editorial-010",
            "list-item",
            region(82.952, 541.307, 428.539, 17.553),
            "– stato limite di scorrimento dei collegamenti ad attrito con bulloni ad alta resistenza, nel caso che il collegamento sia stato dimensiona-\nto a collasso per taglio dei bulloni.",
            "– stato limite di scorrimento dei collegamenti ad attrito con bulloni ad alta resistenza, nel caso che il collegamento sia stato dimensionato a collasso per taglio dei bulloni.",
            { wrap: true, discretionaryHyphen: true },
        ),
    ]),
];

await mkdir(unitDirectory, { recursive: true });
await Promise.all(
    units.map((unit) =>
        writeFile(
            join(unitDirectory, `${unit.numbering.official}.json`),
            `${JSON.stringify(unit, null, 2)}\n`,
            "utf8",
        ),
    ),
);

console.log(`NTC 4.2 step2: generate ${units.length} unità.`);
