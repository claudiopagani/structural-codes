import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { sha256OfText } from "../src/lib/hash.ts";

const repoRoot = fileURLToPath(new URL("../", import.meta.url));
const unitDirectory = join(repoRoot, "corpus", "units", "ntc2018");
const assetDirectory = join(repoRoot, "corpus", "assets", "ntc2018");
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
    control?: boolean;
};

const unitId = (number: string) =>
    `urn:structural-codes:it:unit:ntc2018:${number}`;
const assetId = (kind: "table", number: string) =>
    `urn:structural-codes:it:asset:${kind}:ntc2018:${number}`;
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
            | "remove-control-character"
            | "normalize-whitespace"
            | "manual-correction";
        ruleVersion: string;
        note: string;
    }> = [];
    if (options.control) {
        result.push({
            operation: "remove-control-character",
            ruleVersion: profile,
            note: "Rimossi i caratteri di controllo privi di resa visuale presenti nell’estrazione.",
        });
    }
    if (options.discretionaryHyphen) {
        result.push({
            operation: "remove-discretionary-hyphen",
            ruleVersion: profile,
            note: "Ricomposte le parole spezzate dal trattino tipografico a fine riga.",
        });
    }
    if (options.wrap) {
        result.push({
            operation: "join-line-wrap",
            ruleVersion: profile,
            note: "Unite le righe appartenenti allo stesso capoverso; i capoversi distinti restano blocchi separati.",
        });
        result.push({
            operation: "normalize-whitespace",
            ruleVersion: profile,
            note: "Uniformati gli spazi dopo la ricomposizione delle righe.",
        });
    }
    if (options.manual) {
        result.push({
            operation: "manual-correction",
            ruleVersion: profile,
            note: "Ripristinati i caratteri accentati, gli apostrofi tipografici e i glifi matematici confrontati con il render ufficiale.",
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
    method: "pdf-text" | "manual-transcription",
    rawFingerprint: string,
    normalizedFingerprint: string,
    blockTransformations: ReturnType<typeof transformations>,
) {
    return {
        sourceId,
        pdfPage,
        printedPage,
        region: blockRegion,
        extraction: {
            method,
            tool: method === "pdf-text" ? "pdfjs-dist" : "codex-source-transcription",
            toolVersion: method === "pdf-text" ? "4.10.38" : profile,
        },
        transformations: blockTransformations,
        rawSha256: rawFingerprint,
        normalizedSha256: normalizedFingerprint,
    };
}

function textBlock(
    number: string,
    suffix: string,
    kind: "heading" | "paragraph",
    page: number,
    printedPage: string,
    blockRegion: Region,
    raw: string,
    normalized: string,
    inline: Array<{ kind: "text" | "math"; value: string; latex?: string }>,
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
            inline,
        },
        evidence: evidence(
            page,
            printedPage,
            blockRegion,
            "pdf-text",
            sha256OfText(raw),
            sha256OfText(normalized),
            transformations(options),
        ),
    };
}

function plain(value: string) {
    return [{ kind: "text" as const, value }];
}

function withMath(
    before: string,
    value: string,
    latex: string,
    after: string,
) {
    return [
        { kind: "text" as const, value: before },
        { kind: "math" as const, value, latex },
        { kind: "text" as const, value: after },
    ];
}

function assetBlock(
    number: string,
    suffix: string,
    asset: string,
    page: number,
    printedPage: string,
    blockRegion: Region,
) {
    const fingerprint = sha256OfText(asset);
    return {
        blockId: `${unitId(number)}#block-${suffix}`,
        kind: "table-ref",
        origin: "official",
        assetId: asset,
        evidence: evidence(
            page,
            printedPage,
            blockRegion,
            "manual-transcription",
            fingerprint,
            fingerprint,
            [
                {
                    operation: "manual-correction" as const,
                    ruleVersion: profile,
                    note: "Tabella trascritta dal render ufficiale e collocata nella posizione normativa originaria; resta obbligatoria la revisione umana puntuale.",
                },
            ],
        ),
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
    kind: "section" | "subparagraph",
    blocks: unknown[],
    assetLists: { formulaIds: string[]; tableIds: string[]; figureIds: string[] },
) {
    return {
        $schema: "urn:structural-codes:schema:canonical-unit:v2",
        schemaVersion: "2.0.0-alpha.2",
        recordType: "canonical-unit",
        id: unitId(number),
        workId,
        expressionId,
        kind,
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
        assets: assetLists,
        workflow: {
            status: "extracted",
            createdBy: {
                actorId: "codex:ntc42-step1",
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
                ...(assetLists.tableIds.length > 0
                    ? [
                          {
                              issueId: `ntc2018-${number.replaceAll(".", "-")}-assets`,
                              type: "asset-review",
                              severity: "blocking",
                              note: "Le tabelle sono strutturate e collocate nel punto originario; resta obbligatorio il confronto umano cella per cella con la fonte ufficiale.",
                          },
                      ]
                    : []),
            ],
        },
    };
}

const page95MaterialsHeading = region(82.954, 559.803, 81.717, 7.476);
const page9511Heading = region(82.954, 581.683, 110.905, 7.479);
const page9511Paragraph1 = region(82.954, 593.489, 428.565, 17.553);
const page9511Paragraph2 = region(82.954, 616.167, 428.611, 17.552);
const page96Intro = region(82.951, 98.928, 428.553, 28.565);
const page96Table1 = region(82.954, 145.131, 275.604, 231.909);
const page96Table2 = region(82.954, 396.021, 275.508, 255.587);
const page9612Heading = region(82.954, 644.132, 20.598, 7.476);
const page9612Paragraph = region(82.954, 655.889, 428.626, 27.667);
const page9713Heading = region(82.954, 108.854, 105.253, 7.476);
const page9713Paragraph1 = region(82.954, 120.658, 417.352, 7.482);
const page9713Paragraph2 = region(82.954, 133.22, 421.578, 7.482);
const page9713Paragraph3 = region(82.947, 145.781, 414.094, 7.482);
const page9713Paragraph4 = region(82.946, 158.388, 428.58, 27.623);
const page9714Heading = region(82.954, 201.054, 105.253, 7.476);
const page9714Paragraph1 = region(82.954, 212.808, 394.212, 7.482);
const page9714Paragraph2 = region(82.951, 225.415, 428.596, 18.498);

const table1 = assetId("table", "4.2.i");
const table2 = assetId("table", "4.2.ii");

const tableHeaders = [
    [
        { text: "Norme e qualità degli acciai", rowSpan: 3 },
        { text: "Spessore nominale “t” dell’elemento", colSpan: 4 },
    ],
    [
        { text: "t ≤ 40 mm", colSpan: 2, latex: "t\\le40\\,\\mathrm{mm}" },
        { text: "40 mm < t ≤ 80 mm", colSpan: 2, latex: "40\\,\\mathrm{mm}<t\\le80\\,\\mathrm{mm}" },
    ],
    [
        { text: "fyk [N/mm²]", latex: "f_{yk}\\,[\\mathrm{N/mm^2}]" },
        { text: "ftk [N/mm²]", latex: "f_{tk}\\,[\\mathrm{N/mm^2}]" },
        { text: "fyk [N/mm²]", latex: "f_{yk}\\,[\\mathrm{N/mm^2}]" },
        { text: "ftk [N/mm²]", latex: "f_{tk}\\,[\\mathrm{N/mm^2}]" },
    ],
];

const blank = () => ({ text: "" });
const row = (label: string, values: string[]) => [
    { text: label },
    ...values.map((text) => ({ text })),
];
const group = (label: string) => [
    { text: label },
    blank(),
    blank(),
    blank(),
    blank(),
];

const tables = [
    {
        id: table1,
        unitId: unitId("4.2.1.1"),
        officialNumber: "4.2.I",
        pdfPage: 96,
        caption: "Laminati a caldo con profili a sezione aperta piani e lunghi",
        columnCount: 5,
        headers: tableHeaders,
        rows: [
            group("UNI EN 10025-2"),
            row("S 235", ["235", "360", "215", "360"]),
            row("S 275", ["275", "430", "255", "410"]),
            row("S 355", ["355", "510", "335", "470"]),
            row("S 450", ["440", "550", "420", "550"]),
            group("UNI EN 10025-3"),
            row("S 275 N/NL", ["275", "390", "255", "370"]),
            row("S 355 N/NL", ["355", "490", "335", "470"]),
            row("S 420 N/NL", ["420", "520", "390", "520"]),
            row("S 460 N/NL", ["460", "540", "430", "540"]),
            group("UNI EN 10025-4"),
            row("S 275 M/ML", ["275", "370", "255", "360"]),
            row("S 355 M/ML", ["355", "470", "335", "450"]),
            row("S 420 M/ML", ["420", "520", "390", "500"]),
            row("S 460 M/ML", ["460", "540", "430", "530"]),
            row("S460 Q/QL/QL1", ["460", "570", "440", "580"]),
            group("UNI EN 10025-5"),
            row("S 235 W", ["235", "360", "215", "340"]),
            row("S 355 W", ["355", "510", "335", "490"]),
        ],
        notes: [
            "Trascritta dal render della pagina ufficiale; revisione umana cella per cella ancora obbligatoria.",
        ],
    },
    {
        id: table2,
        unitId: unitId("4.2.1.1"),
        officialNumber: "4.2.II",
        pdfPage: 96,
        caption: "Laminati a caldo con profili a sezione cava",
        columnCount: 5,
        headers: tableHeaders,
        rows: [
            group("UNI EN 10210-1"),
            row("S 235 H", ["235", "360", "215", "340"]),
            row("S 275 H", ["275", "430", "255", "410"]),
            row("S 355 H", ["355", "510", "335", "490"]),
            row("S 275 NH/NLH", ["275", "390", "255", "370"]),
            row("S 355 NH/NLH", ["355", "490", "335", "470"]),
            row("S 420 NH/NLH", ["420", "540", "390", "520"]),
            row("S 460 NH/NLH", ["460", "560", "430", "550"]),
            group("UNI EN 10219-1"),
            row("S 235 H", ["235", "360", "", ""]),
            row("S 275 H", ["275", "430", "", ""]),
            row("S 355 H", ["355", "510", "", ""]),
            row("S 275 NH/NLH", ["275", "370", "", ""]),
            row("S 355 NH/NLH", ["355", "470", "", ""]),
            row("S 275 MH/MLH", ["275", "360", "", ""]),
            row("S 355 MH/MLH", ["355", "470", "", ""]),
            row("S 420 MH/MLH", ["420", "500", "", ""]),
            row("S460 MH/MLH", ["460", "530", "", ""]),
            row("S460 NH/NHL", ["460", "550", "", ""]),
        ],
        notes: [
            "Trascritta dal render della pagina ufficiale; revisione umana cella per cella ancora obbligatoria.",
        ],
    },
];

const units = [
    makeUnit(
        "4.2",
        "COSTRUZIONI DI ACCIAIO",
        "section",
        [
            textBlock(
                "4.2",
                "heading",
                "heading",
                95,
                "91",
                region(82.954, 480.662, 157.677, 9.968),
                "4.2. COSTRUZIONI DI ACCIAIO",
                "4.2 COSTRUZIONI DI ACCIAIO",
                plain("4.2 COSTRUZIONI DI ACCIAIO"),
                { manual: true },
            ),
            textBlock(
                "4.2",
                "editorial-001",
                "paragraph",
                95,
                "91",
                region(82.954, 495.608, 428.58, 17.597),
                "Le presenti norme definiscono i principi e le regole generali per soddisfare i requisiti di sicurezza delle costruzioni con struttura\ndi acciaio.",
                "Le presenti norme definiscono i principi e le regole generali per soddisfare i requisiti di sicurezza delle costruzioni con struttura di acciaio.",
                plain("Le presenti norme definiscono i principi e le regole generali per soddisfare i requisiti di sicurezza delle costruzioni con struttura di acciaio."),
                { wrap: true },
            ),
            textBlock(
                "4.2",
                "editorial-002",
                "paragraph",
                95,
                "91",
                region(82.954, 518.285, 428.558, 27.668),
                "I requisiti per l\u00e2\u20ac\u2122esecuzione di strutture di acciaio, al fine di assicurare un adeguato livello di resistenza meccanica e stabilit\u00c3\u00a0, di\nefficienza e di durata, devono essere conformi alle UNI EN 1090-2:2011, \u00e2\u20ac\u0153Esecuzione di strutture di acciaio e di alluminio - Parte\n2: Requisiti tecnici per strutture di acciaio\u00e2\u20ac\u009d, per quanto non in contrasto con le presenti norme.",
                "I requisiti per l\u2019esecuzione di strutture di acciaio, al fine di assicurare un adeguato livello di resistenza meccanica e stabilità, di efficienza e di durata, devono essere conformi alle UNI EN 1090-2:2011, “Esecuzione di strutture di acciaio e di alluminio - Parte 2: Requisiti tecnici per strutture di acciaio”, per quanto non in contrasto con le presenti norme.",
                plain("I requisiti per l\u2019esecuzione di strutture di acciaio, al fine di assicurare un adeguato livello di resistenza meccanica e stabilità, di efficienza e di durata, devono essere conformi alle UNI EN 1090-2:2011, “Esecuzione di strutture di acciaio e di alluminio - Parte 2: Requisiti tecnici per strutture di acciaio”, per quanto non in contrasto con le presenti norme."),
                { wrap: true, manual: true, control: true },
            ),
        ],
        { formulaIds: [], tableIds: [], figureIds: [] },
    ),
    makeUnit(
        "4.2.1",
        "MATERIALI",
        "subparagraph",
        [
            textBlock(
                "4.2.1",
                "heading",
                "heading",
                95,
                "91",
                page95MaterialsHeading,
                "4.2.1. MATERIALI",
                "4.2.1 MATERIALI",
                plain("4.2.1 MATERIALI"),
                { manual: true },
            ),
        ],
        { formulaIds: [], tableIds: [], figureIds: [] },
    ),
    makeUnit(
        "4.2.1.1",
        "ACCIAIO LAMINATO",
        "subparagraph",
        [
            textBlock(
                "4.2.1.1",
                "heading",
                "heading",
                95,
                "91",
                page9511Heading,
                "4.2.1.1 ACCIAIO LAMINATO",
                "4.2.1.1 ACCIAIO LAMINATO",
                plain("4.2.1.1 ACCIAIO LAMINATO"),
            ),
            textBlock(
                "4.2.1.1",
                "editorial-001",
                "paragraph",
                95,
                "91",
                page9511Paragraph1,
                "Gli acciai per impiego strutturale devono appartenere ai gradi da S235 a S460 e le loro caratteristiche devono essere conformi ai\nrequisiti di cui al \u00c2\u00a7 11.3.4 delle presenti norme.",
                "Gli acciai per impiego strutturale devono appartenere ai gradi da S235 a S460 e le loro caratteristiche devono essere conformi ai requisiti di cui al § 11.3.4 delle presenti norme.",
                plain("Gli acciai per impiego strutturale devono appartenere ai gradi da S235 a S460 e le loro caratteristiche devono essere conformi ai requisiti di cui al § 11.3.4 delle presenti norme."),
                { wrap: true, manual: true },
            ),
            textBlock(
                "4.2.1.1",
                "editorial-002",
                "paragraph",
                95,
                "91",
                page9511Paragraph2,
                "Per le applicazioni nelle zone dissipative delle costruzioni soggette ad azioni sismiche sono richiesti ulteriori requisiti specificati\nnel \u00c2\u00a7 11.3.4.9 delle presenti norme.",
                "Per le applicazioni nelle zone dissipative delle costruzioni soggette ad azioni sismiche sono richiesti ulteriori requisiti specificati nel § 11.3.4.9 delle presenti norme.",
                plain("Per le applicazioni nelle zone dissipative delle costruzioni soggette ad azioni sismiche sono richiesti ulteriori requisiti specificati nel § 11.3.4.9 delle presenti norme."),
                { wrap: true, manual: true },
            ),
            textBlock(
                "4.2.1.1",
                "editorial-003",
                "paragraph",
                96,
                "92",
                page96Intro,
                "In sede di progettazione, per gli acciai di cui alle norme europee armonizzate UNI EN 10025-1, UNI EN 10210-1 ed UNI EN\n10219-1, si possono assumere nei calcoli i valori nominali delle tensioni caratteristiche di snervamento fyk e di rottura ftk riportati\nnelle tabelle seguenti.",
                "In sede di progettazione, per gli acciai di cui alle norme europee armonizzate UNI EN 10025-1, UNI EN 10210-1 ed UNI EN 10219-1, si possono assumere nei calcoli i valori nominali delle tensioni caratteristiche di snervamento fyk e di rottura ftk riportati nelle tabelle seguenti.",
                withMath(
                    "In sede di progettazione, per gli acciai di cui alle norme europee armonizzate UNI EN 10025-1, UNI EN 10210-1 ed UNI EN 10219-1, si possono assumere nei calcoli i valori nominali delle tensioni caratteristiche di snervamento ",
                    "fyk",
                    "f_{yk}",
                    " e di rottura ftk riportati nelle tabelle seguenti.",
                ).flatMap((part) =>
                    part.kind === "text" && part.value.includes("ftk")
                        ? [
                              {
                                  kind: "text" as const,
                                  value: part.value.slice(0, part.value.indexOf("ftk")),
                              },
                              { kind: "math" as const, value: "ftk", latex: "f_{tk}" },
                              { kind: "text" as const, value: " riportati nelle tabelle seguenti." },
                          ]
                        : [part],
                ),
                { wrap: true, manual: true },
            ),
            assetBlock("4.2.1.1", "editorial-004", table1, 96, "92", page96Table1),
            assetBlock("4.2.1.1", "editorial-005", table2, 96, "92", page96Table2),
        ],
        { formulaIds: [], tableIds: [table1, table2], figureIds: [] },
    ),
    makeUnit(
        "4.2.1.2",
        "ACCIAIO INOSSIDABILE",
        "subparagraph",
        [
            textBlock(
                "4.2.1.2",
                "heading",
                "heading",
                96,
                "92",
                page9612Heading,
                "4.2.1.2 ACCIAIO INOSSIDABILE",
                "4.2.1.2 ACCIAIO INOSSIDABILE",
                plain("4.2.1.2 ACCIAIO INOSSIDABILE"),
            ),
            textBlock(
                "4.2.1.2",
                "editorial-001",
                "paragraph",
                96,
                "92",
                page9612Paragraph,
                "Gli acciai inossidabili per impieghi strutturali devono essere conformi a quanto previsto nel \u00c2\u00a7 11.3.4.8. Per quanto attiene alla\nprogettazione strutturale con acciai inossidabili, le indicazioni e le regole indicate nella presente norma devono essere integrate\nda norme di comprovata validit\u00c3\u00a0, quali, ad esempio, la UNI EN 1993-1-4.",
                "Gli acciai inossidabili per impieghi strutturali devono essere conformi a quanto previsto nel § 11.3.4.8. Per quanto attiene alla progettazione strutturale con acciai inossidabili, le indicazioni e le regole indicate nella presente norma devono essere integrate da norme di comprovata validità, quali, ad esempio, la UNI EN 1993-1-4.",
                plain("Gli acciai inossidabili per impieghi strutturali devono essere conformi a quanto previsto nel § 11.3.4.8. Per quanto attiene alla progettazione strutturale con acciai inossidabili, le indicazioni e le regole indicate nella presente norma devono essere integrate da norme di comprovata validità, quali, ad esempio, la UNI EN 1993-1-4."),
                { wrap: true, manual: true },
            ),
        ],
        { formulaIds: [], tableIds: [], figureIds: [] },
    ),
    makeUnit(
        "4.2.1.3",
        "SALDATURE",
        "subparagraph",
        [
            textBlock(
                "4.2.1.3",
                "heading",
                "heading",
                97,
                "93",
                page9713Heading,
                "4.2.1.3 S ALDATURE",
                "4.2.1.3 SALDATURE",
                plain("4.2.1.3 SALDATURE"),
                { manual: true },
            ),
            textBlock(
                "4.2.1.3",
                "editorial-001",
                "paragraph",
                97,
                "93",
                page9713Paragraph1,
                "I procedimenti di saldatura e i materiali di apporto devono essere conformi ai requisiti di cui al \u00c2\u00a7 11.3.4.5 delle presenti norme.",
                "I procedimenti di saldatura e i materiali di apporto devono essere conformi ai requisiti di cui al § 11.3.4.5 delle presenti norme.",
                plain("I procedimenti di saldatura e i materiali di apporto devono essere conformi ai requisiti di cui al § 11.3.4.5 delle presenti norme."),
                { manual: true },
            ),
            textBlock(
                "4.2.1.3",
                "editorial-002",
                "paragraph",
                97,
                "93",
                page9713Paragraph2,
                "Per l\u00e2\u20ac\u2122omologazione degli elettrodi da impiegare nella saldatura ad arco pu\u00c3\u00b2 farsi utile riferimento alla norma UNI EN ISO 2560.",
                "Per l\u2019omologazione degli elettrodi da impiegare nella saldatura ad arco può farsi utile riferimento alla norma UNI EN ISO 2560.",
                plain("Per l\u2019omologazione degli elettrodi da impiegare nella saldatura ad arco può farsi utile riferimento alla norma UNI EN ISO 2560."),
                { manual: true, control: true },
            ),
            textBlock(
                "4.2.1.3",
                "editorial-003",
                "paragraph",
                97,
                "93",
                page9713Paragraph3,
                "Per gli altri procedimenti di saldatura devono essere impiegati fili, flussi o gas di cui alle prove di qualifica del procedimento.",
                "Per gli altri procedimenti di saldatura devono essere impiegati fili, flussi o gas di cui alle prove di qualifica del procedimento.",
                plain("Per gli altri procedimenti di saldatura devono essere impiegati fili, flussi o gas di cui alle prove di qualifica del procedimento."),
            ),
            textBlock(
                "4.2.1.3",
                "editorial-004",
                "paragraph",
                97,
                "93",
                page9713Paragraph4,
                "Le caratteristiche dei materiali di apporto (tensione di snervamento, tensione di rottura, allungamento a rottura e resilienza) de-\nvono, salvo casi particolari precisati dal progettista, essere equivalenti o superiori alle corrispondenti caratteristiche delle parti\ncollegate.",
                "Le caratteristiche dei materiali di apporto (tensione di snervamento, tensione di rottura, allungamento a rottura e resilienza) devono, salvo casi particolari precisati dal progettista, essere equivalenti o superiori alle corrispondenti caratteristiche delle parti collegate.",
                plain("Le caratteristiche dei materiali di apporto (tensione di snervamento, tensione di rottura, allungamento a rottura e resilienza) devono, salvo casi particolari precisati dal progettista, essere equivalenti o superiori alle corrispondenti caratteristiche delle parti collegate."),
                { wrap: true, discretionaryHyphen: true },
            ),
        ],
        { formulaIds: [], tableIds: [], figureIds: [] },
    ),
    makeUnit(
        "4.2.1.4",
        "BULLONI E CHIODI",
        "subparagraph",
        [
            textBlock(
                "4.2.1.4",
                "heading",
                "heading",
                97,
                "93",
                page9714Heading,
                "4.2.1.4 B ULLONI E CHIODI",
                "4.2.1.4 BULLONI E CHIODI",
                plain("4.2.1.4 BULLONI E CHIODI"),
                { manual: true },
            ),
            textBlock(
                "4.2.1.4",
                "editorial-001",
                "paragraph",
                97,
                "93",
                page9714Paragraph1,
                "I bulloni e i chiodi per collegamenti di forza devono essere conformi ai requisiti di cui al \u00c2\u00a7 11.3.4.6 delle presenti norme.",
                "I bulloni e i chiodi per collegamenti di forza devono essere conformi ai requisiti di cui al § 11.3.4.6 delle presenti norme.",
                plain("I bulloni e i chiodi per collegamenti di forza devono essere conformi ai requisiti di cui al § 11.3.4.6 delle presenti norme."),
                { manual: true },
            ),
            textBlock(
                "4.2.1.4",
                "editorial-002",
                "paragraph",
                97,
                "93",
                page9714Paragraph2,
                "I valori della tensione di snervamento f yb e della tensione di rottura f tb dei bulloni, da adottare nelle verifiche quali valori caratte-\nristici, sono specificati nel \u00c2\u00a7 11.3.4.6 delle presenti norme.",
                "I valori della tensione di snervamento fyb e della tensione di rottura ftb dei bulloni, da adottare nelle verifiche quali valori caratteristici, sono specificati nel § 11.3.4.6 delle presenti norme.",
                [
                    { kind: "text" as const, value: "I valori della tensione di snervamento " },
                    { kind: "math" as const, value: "fyb", latex: "f_{yb}" },
                    { kind: "text" as const, value: " e della tensione di rottura " },
                    { kind: "math" as const, value: "ftb", latex: "f_{tb}" },
                    { kind: "text" as const, value: " dei bulloni, da adottare nelle verifiche quali valori caratteristici, sono specificati nel § 11.3.4.6 delle presenti norme." },
                ],
                { wrap: true, discretionaryHyphen: true, manual: true },
            ),
        ],
        { formulaIds: [], tableIds: [], figureIds: [] },
    ),
];

const manifest = {
    $schema: "urn:structural-codes:schema:asset-manifest:v2",
    schemaVersion: "2.0.0-alpha.1",
    recordType: "asset-manifest",
    document: "ntc2018",
    section: "4.2-step1",
    sourceId,
    status: "transcribed-unreviewed",
    formulas: [],
    tables,
    figures: [],
};

await mkdir(unitDirectory, { recursive: true });
await mkdir(assetDirectory, { recursive: true });
await Promise.all([
    ...units.map((unit) =>
        writeFile(
            join(unitDirectory, `${unit.numbering.official}.json`),
            `${JSON.stringify(unit, null, 2)}\n`,
            "utf8",
        ),
    ),
    writeFile(
        join(assetDirectory, "4.2-step1.json"),
        `${JSON.stringify(manifest, null, 2)}\n`,
        "utf8",
    ),
]);

console.log(`NTC 4.2 step1: generate ${units.length} unità e 2 tabelle.`);
