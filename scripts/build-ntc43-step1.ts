import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { sha256OfFile, sha256OfText } from "../src/lib/hash.ts";

const repoRoot = fileURLToPath(new URL("../", import.meta.url));
const unitDirectory = join(repoRoot, "corpus", "units", "ntc2018");
const assetDirectory = join(repoRoot, "corpus", "assets", "ntc2018");
const figureDirectory = join(repoRoot, "corpus", "assets", "figures", "ntc2018");
const sourceId = "gu-so8-2018-ntc";
const workId = "it-mit:dm:2018-01-17:ntc2018";
const expressionId = "it-mit:dm:2018-01-17:ntc2018:original-it";
const profile = "ntc43-editorial-profile-0.1.0";
const createdAt = "2026-08-09T00:00:00Z";

type Region = {
    coordinateSystem: "pdf-points-top-left";
    x: number;
    y: number;
    width: number;
    height: number;
};

type Inline = {
    kind: "text" | "math";
    value: string;
    latex?: string;
};

type Page = {
    printedPage: string | null;
    textItems: Array<{
        sequence: number;
        text: string;
        region: Region;
    }>;
};

const pageCache = new Map<number, Page>();
for (const pageNumber of [119, 120, 121, 122]) {
    const file = join(
        repoRoot,
        "evidence",
        sourceId,
        "pages",
        `page-${String(pageNumber).padStart(4, "0")}.json`,
    );
    pageCache.set(pageNumber, JSON.parse(readFileSync(file, "utf8")) as Page);
}

const region = (x: number, y: number, width: number, height: number): Region => ({
    coordinateSystem: "pdf-points-top-left",
    x,
    y,
    width,
    height,
});

const unitId = (number: string) =>
    `urn:structural-codes:it:unit:ntc2018:${number}`;
const formulaId = (number: string) =>
    `urn:structural-codes:it:asset:formula:ntc2018:${number}`;
const tableId = (number: string) =>
    `urn:structural-codes:it:asset:table:ntc2018:${number}`;
const figureId = (number: string) =>
    `urn:structural-codes:it:asset:figure:ntc2018:${number}`;

function rawFor(pageNumber: number, blockRegion: Region): string {
    const page = pageCache.get(pageNumber);
    if (page === undefined) throw new Error(`evidence mancante per pagina ${pageNumber}`);
    return page.textItems
        .filter((item) => {
            const bottom = item.region.y + item.region.height;
            const right = item.region.x + item.region.width;
            return (
                item.text.length > 0 &&
                item.region.y < blockRegion.y + blockRegion.height &&
                bottom > blockRegion.y &&
                item.region.x < blockRegion.x + blockRegion.width &&
                right > blockRegion.x
            );
        })
        .sort((left, right) => left.sequence - right.sequence)
        .map((item) => item.text)
        .join(" ");
}

function transformations(options: { wrap?: boolean; hyphen?: boolean; control?: boolean; manual?: boolean } = {}) {
    const result: Array<{ operation: string; ruleVersion: string; note: string }> = [];
    if (options.control) {
        result.push({
            operation: "remove-control-character",
            ruleVersion: profile,
            note: "Rimossi i caratteri di controllo privi di resa visuale dall'estrazione ufficiale.",
        });
    }
    if (options.hyphen) {
        result.push({
            operation: "remove-discretionary-hyphen",
            ruleVersion: profile,
            note: "Ricomposte le parole spezzate dal trattino tipografico a fine riga dopo confronto con il render.",
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
            note: "Ripristinati accenti, apostrofi, simboli matematici e sillabazioni confrontati con il render della fonte ufficiale.",
        });
    }
    if (options.wrap || options.manual) {
        result.push({
            operation: "unicode-nfc",
            ruleVersion: profile,
            note: "Testo normalizzato in Unicode NFC.",
        });
    }
    return result;
}

function evidence(
    page: number,
    blockRegion: Region,
    raw: string,
    normalized: string,
    method: "pdf-text" | "manual-transcription" = "pdf-text",
    options: { wrap?: boolean; hyphen?: boolean; control?: boolean; manual?: boolean } = {},
) {
    return {
        sourceId,
        pdfPage: page,
        printedPage: pageCache.get(page)?.printedPage ?? String(page - 4),
        region: blockRegion,
        extraction: {
            method,
            tool: method === "pdf-text" ? "pdfjs-dist" : "codex-source-transcription",
            toolVersion: method === "pdf-text" ? "4.10.38" : profile,
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
    page: number,
    blockRegion: Region,
    normalized: string,
    inline: Inline[] = [{ kind: "text", value: normalized }],
    options: { wrap?: boolean; hyphen?: boolean; control?: boolean; manual?: boolean } = { wrap: true, manual: true },
) {
    const raw = rawFor(page, blockRegion) || normalized;
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
        evidence: evidence(page, blockRegion, raw, normalized, "pdf-text", options),
    };
}

function heading(number: string, title: string, page: number, blockRegion: Region) {
    return textBlock(
        number,
        "heading",
        "heading",
        page,
        blockRegion,
        `${number} ${title}`,
        [{ kind: "text", value: `${number} ${title}` }],
        { manual: true },
    );
}

function formulaRefForUnit(unitNumber: string, formulaNumber: string, suffix: string, page: number, blockRegion: Region) {
    const id = formulaId(formulaNumber);
    return {
        blockId: `${unitId(unitNumber)}#block-${suffix}`,
        kind: "formula-ref",
        origin: "official",
        assetId: id,
        evidence: evidence(
            page,
            blockRegion,
            id,
            id,
            "manual-transcription",
            { manual: true },
        ),
    };
}

function assetRef(
    unitNumber: string,
    suffix: string,
    kind: "table-ref" | "figure-ref",
    id: string,
    page: number,
    blockRegion: Region,
) {
    return {
        blockId: `${unitId(unitNumber)}#block-${suffix}`,
        kind,
        origin: "official",
        assetId: id,
        evidence: evidence(
            page,
            blockRegion,
            id,
            id,
            "manual-transcription",
            { manual: true },
        ),
    };
}

function parent(number: string): string | null {
    const parts = number.split(".");
    return parts.length === 1 ? null : unitId(parts.slice(0, -1).join("."));
}

function ancestors(number: string): string[] {
    const parts = number.split(".");
    return parts.slice(1).map((_, index) => unitId(parts.slice(0, index + 1).join(".")));
}

function makeUnit(
    number: string,
    title: string,
    kind: "section" | "subparagraph",
    blocks: unknown[],
    assets: { formulaIds: string[]; tableIds: string[]; figureIds: string[] },
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
        assets,
        workflow: {
            status: "extracted",
            createdBy: {
                actorId: "codex:ntc43-step1",
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
                    note: "Record trascritto dall'evidence ufficiale ma non ancora confrontato integralmente da un revisore umano con il render della fonte.",
                },
                ...(assets.formulaIds.length + assets.tableIds.length + assets.figureIds.length > 0
                    ? [{
                          issueId: `ntc2018-${number.replaceAll(".", "-")}-assets`,
                          type: "asset-review",
                          severity: "blocking",
                          note: "Formule, tabelle e figure sono state separate e collocate; resta obbligatoria la revisione umana puntuale sulla fonte ufficiale.",
                      }]
                    : []),
            ],
        },
    };
}

const p119 = {
    title: region(82.954, 507.872, 285.457, 9.968),
    intro1: region(82.954, 522.818, 428.572, 17.601),
    intro2: region(82.957, 545.499, 421.653, 17.547),
    intro3: region(82.957, 565.687, 428.63, 27.617),
    safetyTitle: region(82.954, 609.693, 152.523, 7.476),
    safety1: region(82.954, 621.651, 428.685, 7.48),
    safety2: region(82.947, 634.21, 428.692, 17.601),
    safety3: region(82.954, 656.89, 378.962, 7.48),
    ultimateTitle: region(82.954, 679.369, 112.672, 7.476),
    ultimate: region(82.953, 691.181, 428.63, 17.545),
};

const p120 = {
    slesTitle: region(82.954, 98.884, 131.135, 7.476),
    sles: region(82.955, 110.696, 428.684, 17.541),
    phasesTitle: region(82.954, 143.244, 106.326, 7.476),
    phases: region(82.954, 155.05, 428.582, 17.549),
    analysisTitle: region(82.954, 188.994, 120.554, 7.476),
    analysis1: region(82.954, 200.95, 371.322, 7.48),
    analysis2: region(82.954, 213.508, 371.322, 7.48),
    classificationTitle: region(82.954, 236.044, 150.549, 7.476),
    classification1: region(82.954, 247.8, 428.623, 27.668),
    classification2: region(82.947, 280.548, 428.561, 17.598),
    formulaA: region(160, 299, 210, 18),
    formulaB: region(160, 317, 210, 25),
    classification3: region(82.951, 349.777, 428.63, 41.214),
    methodsTitle: region(82.954, 405.994, 139.511, 7.476),
    methods1: region(82.954, 417.81, 428.57, 17.549),
    methods2: region(82.954, 440.438, 428.591, 17.598),
    methods3: region(82.954, 463.118, 428.623, 17.601),
    linearTitle: region(82.954, 494.064, 124.642, 7.476),
    linear1: region(82.954, 506.67, 428.576, 17.549),
    linear2: region(82.947, 529.351, 428.623, 51.0),
    linear3: region(82.939, 593.243, 428.62, 60.66),
    linear4: region(82.958, 659.034, 428.597, 28.555),
    linear5: region(82.951, 693.57, 338.146, 7.48),
};

const p121 = {
    linear6: region(82.954, 98.93, 428.614, 27.668),
    linear7: region(82.954, 131.678, 428.644, 17.549),
    linear8: region(82.947, 154.358, 428.598, 50.296),
    linear9: region(82.954, 209.786, 339.825, 7.48),
    table: region(82.954, 227.021, 275.6, 39.0),
    linear10: region(82.954, 271.6, 428.6, 17.6),
    plasticTitle: region(82.954, 301.8, 124.0, 7.476),
    plastic1: region(82.954, 314.4, 428.6, 45.0),
    plastic2: region(82.954, 363.0, 428.6, 28.0),
    plastic3: region(82.954, 399.0, 428.6, 17.6),
    plastic4: region(82.954, 421.5, 428.6, 17.6),
    nonlinearTitle: region(82.954, 449.454, 115.0, 7.476),
    nonlinear1: region(82.954, 462.06, 249.918, 7.48),
    nonlinear2: region(82.954, 474.619, 428.568, 17.601),
    nonlinear3: region(82.954, 497.299, 341.568, 7.48),
    effectiveTitle: region(82.954, 519.782, 113.75, 7.476),
    effective1: region(82.954, 531.59, 428.585, 17.601),
    effective2: region(82.954, 554.271, 340.2, 7.48),
    formula32: region(185, 562, 185, 18),
    effective3: region(82.953, 578.739, 428.655, 18.5),
    figure1: region(82.954, 600, 260, 120),
};

const p122 = {
    effective4: region(82.954, 98.93, 428.6, 17.6),
    effective5: region(82.954, 121.5, 428.6, 17.6),
    effective6: region(82.954, 144.24, 282.0, 7.48),
    formula33: region(150, 138, 220, 22),
    beta: region(100, 158, 230, 25),
    effective7: region(82.954, 189.29, 248.0, 7.48),
    figure2: region(82.954, 200, 440, 166),
    deformationTitle: region(82.954, 378.834, 143.0, 7.476),
    deformationIntro: region(82.954, 390.64, 111.759, 7.48),
    deformationList1: region(82.953, 400.76, 400.0, 7.48),
    deformationList2: region(82.953, 410.83, 420.0, 7.48),
    deformation1: region(82.953, 423.4, 428.6, 50.4),
    formula34: region(190, 497, 180, 20),
    deformation2: region(82.952, 516.0, 428.6, 17.6),
    imperfectionTitle: region(82.954, 526.66, 137.686, 7.476),
    imperfection1: region(82.954, 538.468, 428.6, 30.0),
    imperfectionIntro: region(82.953, 573.708, 111.759, 7.48),
    imperfectionList1: region(82.953, 583.829, 220.0, 7.48),
    imperfectionList2: region(82.953, 593.897, 190.0, 7.48),
    imperfection2: region(82.953, 606.456, 428.6, 20.0),
    formula35: region(190, 640, 180, 25),
    imperfection3: region(82.952, 669.296, 428.6, 20.0),
    imperfection4: region(82.949, 678.468, 428.6, 17.6),
    imperfection5: region(82.949, 698.949, 428.583, 7.48),
};

const formulaAssets = [
    { id: formulaId("4.3.1.a"), unitId: unitId("4.3.2.1"), officialNumber: "4.3.1.a", pdfPage: 120, latex: "A_s\\ge\\rho_s\\cdot A_c" },
    { id: formulaId("4.3.1.b"), unitId: unitId("4.3.2.1"), officialNumber: "4.3.1.b", pdfPage: 120, latex: "\\rho_s=\\delta\\frac{f_{yk}}{235}\\frac{f_{ctm}}{f_{sk}}\\sqrt{\\frac{1}{1+\\frac{h_c}{2z_0}}}+0{,}3\\le\\delta\\frac{f_{yk}}{235}\\frac{f_{ctm}}{f_{sk}}" },
    { id: formulaId("4.3.2"), unitId: unitId("4.3.2.3"), officialNumber: "4.3.2", pdfPage: 121, latex: "b_{\\mathrm{eff}}=b_0+b_{e1}+b_{e2}," },
    { id: formulaId("4.3.3"), unitId: unitId("4.3.2.3"), officialNumber: "4.3.3", pdfPage: 122, latex: "b_{\\mathrm{eff}}=b_0+\\beta_1b_{e-1}+\\beta_2b_{e-2}" },
    { id: formulaId("4.3.3-beta"), unitId: unitId("4.3.2.3"), officialNumber: null, pdfPage: 122, latex: "\\beta_i=\\left(0{,}55+0{,}025\\cdot\\frac{L_e}{b_{\\mathrm{eff},i}}\\right)\\le1{,}0" },
    { id: formulaId("4.3.4"), unitId: unitId("4.3.2.4"), officialNumber: "4.3.4", pdfPage: 122, latex: "\\alpha_{\\mathrm{cr}}\\ge10" },
    { id: formulaId("4.3.5"), unitId: unitId("4.3.2.5"), officialNumber: "4.3.5", pdfPage: 122, latex: "\\bar{\\lambda}\\le0{,}5\\cdot\\sqrt{\\frac{N_{\\mathrm{pl,Rk}}}{N_{\\mathrm{Ed}}}}" },
];

const tableAsset = {
    id: tableId("4.3.i"),
    unitId: unitId("4.3.2.2.1"),
    officialNumber: "4.3.I",
    pdfPage: 121,
    caption: "Limiti della ridistribuzione del momento negativo sugli appoggi",
    columnCount: 5,
    headers: [[
        { text: "Classe della sezione" },
        { text: "1" },
        { text: "2" },
        { text: "3" },
        { text: "4" },
    ]],
    rows: [
        [{ text: "“Analisi non-fessurata”" }, { text: "40" }, { text: "30" }, { text: "20" }, { text: "10" }],
        [{ text: "“Analisi fessurata”" }, { text: "25" }, { text: "15" }, { text: "10" }, { text: "0" }],
    ],
    notes: ["Tabella trascritta dal render ufficiale; revisione umana cella per cella ancora obbligatoria."],
};

const figureAssets = [
    {
        id: figureId("4.3.1"),
        unitId: unitId("4.3.2.3"),
        officialNumber: "4.3.1",
        pdfPage: 121,
        caption: "Definizione della larghezza efficace b_eff e delle aliquote b_ei",
        alt: "Schema della larghezza efficace della soletta collaborante e delle aliquote laterali.",
        imagePath: "figures/ntc2018/fig4.3.1.png",
        region: p121.figure1,
        filename: "fig4.3.1.png",
    },
    {
        id: figureId("4.3.2"),
        unitId: unitId("4.3.2.3"),
        officialNumber: "4.3.2",
        pdfPage: 122,
        caption: "Larghezza efficace, b_eff, e luci equivalenti, L_e, per le travi continue",
        alt: "Schema delle luci equivalenti e della larghezza efficace per travi continue.",
        imagePath: "figures/ntc2018/fig4.3.2.png",
        region: p122.figure2,
        filename: "fig4.3.2.png",
    },
];

const units = [
    makeUnit("4.3", "COSTRUZIONI COMPOSTE DI ACCIAIO - CALCESTRUZZO", "section", [
        heading("4.3", "COSTRUZIONI COMPOSTE DI ACCIAIO - CALCESTRUZZO", 119, p119.title),
        textBlock("4.3", "editorial-001", "paragraph", 119, p119.intro1, "Le strutture composte sono costituite da parti realizzate in acciaio per carpenteria e da parti realizzate in calcestruzzo armato (normale o precompresso) rese collaboranti fra loro con un sistema di connessione appropriatamente dimensionato."),
        textBlock("4.3", "editorial-002", "paragraph", 119, p119.intro2, "Le presenti norme definiscono i principi e le regole generali per soddisfare i requisiti di sicurezza delle costruzioni con strutture composte in acciaio e calcestruzzo."),
        textBlock("4.3", "editorial-003", "paragraph", 119, p119.intro3, "Per tutto quanto non espressamente indicato nel presente capitolo, per la progettazione strutturale, l’esecuzione, i controlli e la manutenzione deve farsi riferimento ai precedenti §§ 4.1 e 4.2 relativi alle costruzioni di calcestruzzo armato ed alle costruzioni di acciaio, rispettivamente."),
    ], { formulaIds: [], tableIds: [], figureIds: [] }),
    makeUnit("4.3.1", "VALUTAZIONE DELLA SICUREZZA", "subparagraph", [
        heading("4.3.1", "VALUTAZIONE DELLA SICUREZZA", 119, p119.safetyTitle),
        textBlock("4.3.1", "editorial-001", "paragraph", 119, p119.safety1, "La valutazione della sicurezza è condotta secondo i principi fondamentali illustrati nel Capitolo 2."),
        textBlock("4.3.1", "editorial-002", "paragraph", 119, p119.safety2, "I requisiti richiesti di resistenza, funzionalità, durabilità e robustezza si garantiscono verificando il rispetto degli stati limite ultimi e degli stati limite di esercizio della struttura, dei componenti strutturali e dei collegamenti descritti nella presente norma."),
        textBlock("4.3.1", "editorial-003", "paragraph", 119, p119.safety3, "In aggiunta a quanto indicato in §§ 4.1 e 4.2 dovranno essere considerati gli ulteriori stati limite di seguito indicati."),
    ], { formulaIds: [], tableIds: [], figureIds: [] }),
    makeUnit("4.3.1.1", "STATI LIMITE ULTIMI", "subparagraph", [
        heading("4.3.1.1", "STATI LIMITE ULTIMI", 119, p119.ultimateTitle),
        textBlock("4.3.1.1", "editorial-001", "paragraph", 119, p119.ultimate, "Stato limite di resistenza della connessione acciaio-calcestruzzo, al fine di evitare la crisi del collegamento tra elementi in acciaio ed elementi in calcestruzzo con la conseguente perdita del funzionamento composto della sezione."),
    ], { formulaIds: [], tableIds: [], figureIds: [] }),
    makeUnit("4.3.1.2", "STATI LIMITE DI ESERCIZIO", "subparagraph", [
        heading("4.3.1.2", "STATI LIMITE DI ESERCIZIO", 120, p120.slesTitle),
        textBlock("4.3.1.2", "editorial-001", "paragraph", 120, p120.sles, "Stato limite di esercizio della connessione acciaio-calcestruzzo, al fine di evitare eccessivi scorrimenti fra l’elemento in acciaio e l’elemento in calcestruzzo durante l’esercizio della costruzione."),
    ], { formulaIds: [], tableIds: [], figureIds: [] }),
    makeUnit("4.3.1.3", "FASI COSTRUTTIVE", "subparagraph", [
        heading("4.3.1.3", "FASI COSTRUTTIVE", 120, p120.phasesTitle),
        textBlock("4.3.1.3", "editorial-001", "paragraph", 120, p120.phases, "Le fasi costruttive, quando rilevanti, devono essere considerate nella progettazione, nell’analisi e nella verifica delle strutture composte."),
    ], { formulaIds: [], tableIds: [], figureIds: [] }),
    makeUnit("4.3.2", "ANALISI STRUTTURALE", "subparagraph", [
        heading("4.3.2", "ANALISI STRUTTURALE", 120, p120.analysisTitle),
        textBlock("4.3.2", "editorial-001", "paragraph", 120, p120.analysis1, "Il metodo di analisi deve essere coerente con le ipotesi di progetto."),
        textBlock("4.3.2", "editorial-002", "paragraph", 120, p120.analysis2, "L’analisi deve essere basata su modelli strutturali di calcolo appropriati, a seconda dello stato limite considerato."),
    ], { formulaIds: [], tableIds: [], figureIds: [] }),
    makeUnit("4.3.2.1", "CLASSIFICAZIONE DELLE SEZIONI", "subparagraph", [
        heading("4.3.2.1", "CLASSIFICAZIONE DELLE SEZIONI", 120, p120.classificationTitle),
        textBlock("4.3.2.1", "editorial-001", "paragraph", 120, p120.classification1, "La classificazione delle sezioni composte è eseguita secondo lo schema introdotto per le sezioni in acciaio in § 4.2.3. Nel calcolo si possono adottare distribuzioni di tensioni plastiche o elastiche per le classi 1 e 2, mentre per le classi 3 e 4 si debbono utilizzare distribuzioni di tensioni elastiche."),
        textBlock("4.3.2.1", "editorial-002", "paragraph", 120, p120.classification2, "In particolare, per le sezioni di classe 1 e 2, l’armatura di trazione A_s in soletta, posta all’interno della larghezza collaborante ed utilizzata per il calcolo del momento plastico, deve essere realizzata con acciaio B450C e rispettare la condizione:", [
            { kind: "text", value: "In particolare, per le sezioni di classe 1 e 2, l’armatura di trazione " },
            { kind: "math", value: "A_s", latex: "A_s" },
            { kind: "text", value: " in soletta, posta all’interno della larghezza collaborante ed utilizzata per il calcolo del momento plastico, deve essere realizzata con acciaio B450C e rispettare la condizione:" },
        ]),
        formulaRefForUnit("4.3.2.1", "4.3.1.a", "formula-001", 120, p120.formulaA),
        formulaRefForUnit("4.3.2.1", "4.3.1.b", "formula-002", 120, p120.formulaB),
        textBlock("4.3.2.1", "editorial-003", "paragraph", 120, p120.classification3, "dove A_c è l’area collaborante della soletta di calcestruzzo, f_ctm è la resistenza media a trazione del calcestruzzo, f_yk e f_sk sono la resistenza caratteristica a snervamento dell’acciaio da carpenteria e di quello d’armatura rispettivamente, h_c è lo spessore della soletta di calcestruzzo, z_0 è la distanza tra il baricentro della soletta di calcestruzzo non fessurata e il baricentro della sezione composta non fessurata, δ è pari ad 1 per le sezioni in classe 2 e a 1,1 per le sezioni in classe 1.", [
            { kind: "text", value: "dove " },
            { kind: "math", value: "A_c", latex: "A_c" },
            { kind: "text", value: " è l’area collaborante della soletta di calcestruzzo, " },
            { kind: "math", value: "f_ctm", latex: "f_{ctm}" },
            { kind: "text", value: " è la resistenza media a trazione del calcestruzzo, " },
            { kind: "math", value: "f_yk", latex: "f_{yk}" },
            { kind: "text", value: " e " },
            { kind: "math", value: "f_sk", latex: "f_{sk}" },
            { kind: "text", value: " sono la resistenza caratteristica a snervamento dell’acciaio da carpenteria e di quello d’armatura rispettivamente, " },
            { kind: "math", value: "h_c", latex: "h_c" },
            { kind: "text", value: " è lo spessore della soletta di calcestruzzo, " },
            { kind: "math", value: "z_0", latex: "z_0" },
            { kind: "text", value: " è la distanza tra il baricentro della soletta di calcestruzzo non fessurata e il baricentro della sezione composta non fessurata, " },
            { kind: "math", value: "δ", latex: "\\delta" },
            { kind: "text", value: " è pari ad 1 per le sezioni in classe 2 e a 1,1 per le sezioni in classe 1." },
        ]),
    ], { formulaIds: [formulaId("4.3.1.a"), formulaId("4.3.1.b")], tableIds: [], figureIds: [] }),
    makeUnit("4.3.2.2", "METODI DI ANALISI GLOBALE", "subparagraph", [
        heading("4.3.2.2", "METODI DI ANALISI GLOBALE", 120, p120.methodsTitle),
        textBlock("4.3.2.2", "editorial-001", "paragraph", 120, p120.methods1, "Gli effetti delle azioni possono essere valutati mediante l’analisi globale elastica anche quando si consideri la resistenza plastica, o comunque in campo non-lineare delle sezioni trasversali."),
        textBlock("4.3.2.2", "editorial-002", "paragraph", 120, p120.methods2, "L’analisi lineare elastica può essere utilizzata per le verifiche agli stati limite di esercizio, introducendo opportune correzioni per tenere conto degli effetti non-lineari quali la fessurazione del calcestruzzo, e per le verifiche dello stato limite di fatica."),
        textBlock("4.3.2.2", "editorial-003", "paragraph", 120, p120.methods3, "Gli effetti del trascinamento da taglio e dell’instabilità locale devono essere tenuti in debito conto quando questi influenzino significativamente l’analisi."),
    ], { formulaIds: [], tableIds: [], figureIds: [] }),
    makeUnit("4.3.2.2.1", "ANALISI LINEARE ELASTICA", "subparagraph", [
        heading("4.3.2.2.1", "Analisi lineare elastica", 120, p120.linearTitle),
        textBlock("4.3.2.2.1", "editorial-001", "paragraph", 120, p120.linear1, "In questo tipo di analisi si devono anche considerare, se rilevanti, la viscosità, la fessurazione, gli effetti della temperatura, il ritiro e le fasi costruttive."),
        textBlock("4.3.2.2.1", "editorial-002", "paragraph", 120, p120.linear2, "Per costruzioni poco sensibili ai fenomeni del secondo ordine e quindi non suscettibili di problemi di stabilità globale, è possibile tenere in conto la viscosità nelle travi di impalcato sostituendo l’area delle porzioni in calcestruzzo, A_c, con aree equivalenti ridotte in ragione del coefficiente di omogeneizzazione n, cioè del rapporto tra i moduli elastici dei materiali, calcolato per breve e lungo termine. Quando le tensioni di lunga durata non siano preponderanti si può adottare un unico coefficiente di omogeneizzazione assumendo un modulo elastico del calcestruzzo pari alla metà del modulo elastico istantaneo, sia per le analisi a breve termine che per quelle a lungo termine. Per tenere in conto la fessurazione delle travi composte è possibile utilizzare due metodi.", [
            { kind: "text", value: "Per costruzioni poco sensibili ai fenomeni del secondo ordine e quindi non suscettibili di problemi di stabilità globale, è possibile tenere in conto la viscosità nelle travi di impalcato sostituendo l’area delle porzioni in calcestruzzo, " },
            { kind: "math", value: "A_c", latex: "A_c" },
            { kind: "text", value: ", con aree equivalenti ridotte in ragione del coefficiente di omogeneizzazione " },
            { kind: "math", value: "n", latex: "n" },
            { kind: "text", value: ", cioè del rapporto tra i moduli elastici dei materiali, calcolato per breve e lungo termine. Quando le tensioni di lunga durata non siano preponderanti si può adottare un unico coefficiente di omogeneizzazione assumendo un modulo elastico del calcestruzzo pari alla metà del modulo elastico istantaneo, sia per le analisi a breve termine che per quelle a lungo termine. Per tenere in conto la fessurazione delle travi composte è possibile utilizzare due metodi." },
        ]),
        textBlock("4.3.2.2.1", "editorial-003", "paragraph", 120, p120.linear3, "Il primo consiste nell’effettuare una prima “analisi non fessurata” in cui l’inerzia omogeneizzata di tutte le travi è pari a quella della sezione interamente reagente, EJ_1. Individuate, alla conclusione dell’analisi, le sezioni soggette a momento flettente negativo, nelle quali si hanno fenomeni di fessurazione, si esegue una seconda “analisi fessurata”. In tale analisi la rigidezza EJ_1 è assegnata alle porzioni di trave soggette a momento flettente positivo, mentre la rigidezza fessurata ottenuta trascurando il calcestruzzo teso, EJ_2, è assegnata alle porzioni di trave soggette a momento flettente negativo. La nuova distribuzione delle rigidezze e delle sollecitazioni interne è utilizzata per le verifiche agli stati limite di servizio ed ultimo.", [
            { kind: "text", value: "Il primo consiste nell’effettuare una prima “analisi non fessurata” in cui l’inerzia omogeneizzata di tutte le travi è pari a quella della sezione interamente reagente, " },
            { kind: "math", value: "EJ_1", latex: "EJ_1" },
            { kind: "text", value: ". Individuate, alla conclusione dell’analisi, le sezioni soggette a momento flettente negativo, nelle quali si hanno fenomeni di fessurazione, si esegue una seconda “analisi fessurata”. In tale analisi la rigidezza " },
            { kind: "math", value: "EJ_1", latex: "EJ_1" },
            { kind: "text", value: " è assegnata alle porzioni di trave soggette a momento flettente positivo, mentre la rigidezza fessurata ottenuta trascurando il calcestruzzo teso, " },
            { kind: "math", value: "EJ_2", latex: "EJ_2" },
            { kind: "text", value: ", è assegnata alle porzioni di trave soggette a momento flettente negativo. La nuova distribuzione delle rigidezze e delle sollecitazioni interne è utilizzata per le verifiche agli stati limite di servizio ed ultimo." },
        ]),
        textBlock("4.3.2.2.1", "editorial-004", "paragraph", 120, p120.linear4, "Il secondo metodo, applicabile alle travi continue in telai controventati in cui le luci delle campate non differiscono tra loro di più del 60%, considera una estensione della zona fessurata all’estremità di ogni campata, caratterizzata da rigidezza EJ_2, pari al 15% della luce della campata; la rigidezza EJ_1 è assegnata a tutte le altre zone.", [
            { kind: "text", value: "Il secondo metodo, applicabile alle travi continue in telai controventati in cui le luci delle campate non differiscono tra loro di più del 60%, considera una estensione della zona fessurata all’estremità di ogni campata, caratterizzata da rigidezza " },
            { kind: "math", value: "EJ_2", latex: "EJ_2" },
            { kind: "text", value: ", pari al 15% della luce della campata; la rigidezza " },
            { kind: "math", value: "EJ_1", latex: "EJ_1" },
            { kind: "text", value: " è assegnata a tutte le altre zone." },
        ]),
        textBlock("4.3.2.2.1", "editorial-005", "paragraph", 120, p120.linear5, "La rigidezza delle colonne deve essere assunta pari al valore indicato in § 4.3.5.2 della presente norma."),
        textBlock("4.3.2.2.1", "editorial-006", "paragraph", 121, p121.linear6, "Gli effetti della temperatura devono essere considerati nel calcolo quando influenti. Tali effetti possono solitamente essere trascurati nella verifica allo stato limite ultimo, quando gli elementi strutturali siano in classe 1 o 2 e quando non vi siano pericoli di instabilità flesso-torsionale."),
        textBlock("4.3.2.2.1", "editorial-007", "paragraph", 121, p121.linear7, "Il momento flettente ottenuto dall’analisi elastica può essere ridistribuito in modo da soddisfare ancora l’equilibrio tenendo in conto gli effetti del comportamento non-lineare dei materiali e tutti i fenomeni di instabilità."),
        textBlock("4.3.2.2.1", "editorial-008", "paragraph", 121, p121.linear8, "Per le verifiche allo stato limite ultimo, ad eccezione delle verifiche a fatica, il momento elastico può essere ridistribuito quando la trave composta è continua o parte di un telaio controventato, è di altezza costante, non vi è pericolo di fenomeni di instabilità. Nel caso di travi composte parzialmente rivestite di calcestruzzo, occorre anche verificare che la capacità rotazionale sia sufficiente per effettuare la ridistribuzione, trascurando il contributo del calcestruzzo a compressione nel calcolo del momento resistente ridotto nella situazione ridistribuita."),
        textBlock("4.3.2.2.1", "editorial-009", "paragraph", 121, p121.linear9, "La riduzione del massimo momento negativo non deve eccedere le percentuali indicate nella Tab. 4.3.I."),
        assetRef("4.3.2.2.1", "table-001", "table-ref", tableId("4.3.i"), 121, p121.table),
        textBlock("4.3.2.2.1", "editorial-010", "paragraph", 121, p121.linear10, "Se si utilizzano profili di acciaio strutturale di grado S355 o superiore la ridistribuzione può essere fatta solo con sezioni di classe 1 e classe 2, e non deve superare il 30% per le “analisi non fessurate” ed il 15% per le “analisi fessurate”."),
    ], { formulaIds: [], tableIds: [tableId("4.3.i")], figureIds: [] }),
    makeUnit("4.3.2.2.2", "Analisi plastica", "subparagraph", [
        heading("4.3.2.2.2", "Analisi plastica", 121, p121.plasticTitle),
        textBlock("4.3.2.2.2", "editorial-001", "paragraph", 121, p121.plastic1, "L’analisi plastica può essere utilizzata per eseguire le verifiche allo stato limite ultimo quando:"),
        textBlock("4.3.2.2.2", "editorial-002", "list-item", 121, region(94.765, 328, 390, 7.5), "tutti gli elementi sono in acciaio o composti acciaio-calcestruzzo;"),
        textBlock("4.3.2.2.2", "editorial-003", "list-item", 121, region(94.765, 338, 390, 7.5), "i materiali soddisfano i requisiti indicati in § 4.3.3.1;"),
        textBlock("4.3.2.2.2", "editorial-004", "list-item", 121, region(94.765, 348, 390, 7.5), "le sezioni sono di classe 1;"),
        textBlock("4.3.2.2.2", "editorial-005", "list-item", 121, region(94.765, 358, 410, 17), "i collegamenti tra le membrature sono a completo ripristino di resistenza plastica e sono dotati di adeguata capacità di rotazione o di adeguata sovraresistenza."),
        textBlock("4.3.2.2.2", "editorial-006", "paragraph", 121, p121.plastic2, "Inoltre, nelle zone in cui è supposto lo sviluppo delle deformazioni plastiche (cerniere plastiche), è necessario che:"),
        textBlock("4.3.2.2.2", "editorial-007", "list-item", 121, region(94.765, 377, 390, 7.5), "i profili in acciaio siano simmetrici rispetto al piano dell’anima;"),
        textBlock("4.3.2.2.2", "editorial-008", "list-item", 121, region(94.765, 387, 390, 7.5), "la piattabanda compressa sia opportunamente vincolata;"),
        textBlock("4.3.2.2.2", "editorial-009", "list-item", 121, region(94.765, 397, 390, 7.5), "la capacità rotazionale della cerniera plastica sia sufficiente."),
    ], { formulaIds: [], tableIds: [], figureIds: [] }),
    makeUnit("4.3.2.2.3", "Analisi non lineare", "subparagraph", [
        heading("4.3.2.2.3", "Analisi non lineare", 121, p121.nonlinearTitle),
        textBlock("4.3.2.2.3", "editorial-001", "paragraph", 121, p121.nonlinear1, "L’analisi non lineare deve essere eseguita secondo le indicazioni in § 4.2.3.3."),
        textBlock("4.3.2.2.3", "editorial-002", "paragraph", 121, p121.nonlinear2, "I materiali devono essere modellati considerando tutte le loro non-linearità e deve essere tenuto in conto il comportamento della connessione a taglio tra gli elementi delle travi composte."),
        textBlock("4.3.2.2.3", "editorial-003", "paragraph", 121, p121.nonlinear3, "L’influenza delle deformazioni sulle sollecitazioni interne deve essere tenuta in conto quando rilevante."),
    ], { formulaIds: [], tableIds: [], figureIds: [] }),
    makeUnit("4.3.2.3", "LARGHEZZE EFFICACI", "subparagraph", [
        heading("4.3.2.3", "LARGHEZZE EFFICACI", 121, p121.effectiveTitle),
        textBlock("4.3.2.3", "editorial-001", "paragraph", 121, p121.effective1, "La distribuzione delle tensioni normali negli elementi composti deve essere determinata mediante un modello che tenga conto della diffusione degli sforzi nelle ali della trave metallica e nella soletta in calcestruzzo."),
        textBlock("4.3.2.3", "editorial-002", "paragraph", 121, p121.effective2, "La larghezza efficace, b_eff, di una soletta in calcestruzzo può essere determinata mediante l’espressione:", [
            { kind: "text", value: "La larghezza efficace, " },
            { kind: "math", value: "b_eff", latex: "b_{\\mathrm{eff}}" },
            { kind: "text", value: ", di una soletta in calcestruzzo può essere determinata mediante l’espressione:" },
        ]),
        formulaRefForUnit("4.3.2.3", "4.3.2", "formula-001", 121, p121.formula32),
        textBlock("4.3.2.3", "editorial-003", "paragraph", 121, p121.effective3, "dove b_0 è la distanza tra gli assi dei connettori e b_ei = min (L_e/8, b_i) è il valore della larghezza collaborante da ciascun lato della sezione composta (vedi fig. 4.3.1).", [
            { kind: "text", value: "dove " },
            { kind: "math", value: "b_0", latex: "b_0" },
            { kind: "text", value: " è la distanza tra gli assi dei connettori e " },
            { kind: "math", value: "b_ei = min (L_e/8, b_i)", latex: "b_{ei}=\\min\\left(\\frac{L_e}{8},b_i\\right)" },
            { kind: "text", value: " è il valore della larghezza collaborante da ciascun lato della sezione composta (vedi fig. 4.3.1)." },
        ]),
        assetRef("4.3.2.3", "figure-001", "figure-ref", figureId("4.3.1"), 121, p121.figure1),
        textBlock("4.3.2.3", "editorial-004", "paragraph", 122, p122.effective4, "L_e indica approssimativamente la distanza tra due punti di nullo del diagramma dei momenti. Nel caso di travi continue con flessione determinata prevalentemente da carichi distribuiti uniformi si possono utilizzare le indicazioni di Fig. 4.3.2.", [
            { kind: "math", value: "L_e", latex: "L_e" },
            { kind: "text", value: " indica approssimativamente la distanza tra due punti di nullo del diagramma dei momenti. Nel caso di travi continue con flessione determinata prevalentemente da carichi distribuiti uniformi si possono utilizzare le indicazioni di Fig. 4.3.2." },
        ]),
        textBlock("4.3.2.3", "editorial-005", "paragraph", 122, p122.effective5, "Per gli appoggi di estremità la formula diviene:"),
        formulaRefForUnit("4.3.2.3", "4.3.3", "formula-002", 122, p122.formula33),
        textBlock("4.3.2.3", "editorial-006", "paragraph", 122, p122.effective6, "dove"),
        formulaRefForUnit("4.3.2.3", "4.3.3-beta", "formula-003", 122, p122.beta),
        textBlock("4.3.2.3", "editorial-007", "paragraph", 122, p122.effective7, "essendo L_e e b_eff,i relativi alla campata di estremità.", [
            { kind: "text", value: "essendo " },
            { kind: "math", value: "L_e", latex: "L_e" },
            { kind: "text", value: " e " },
            { kind: "math", value: "b_eff,i", latex: "b_{\\mathrm{eff},i}" },
            { kind: "text", value: " relativi alla campata di estremità." },
        ]),
        assetRef("4.3.2.3", "figure-002", "figure-ref", figureId("4.3.2"), 122, p122.figure2),
    ], { formulaIds: [formulaId("4.3.2"), formulaId("4.3.3"), formulaId("4.3.3-beta")], tableIds: [], figureIds: [figureId("4.3.1"), figureId("4.3.2")] }),
    makeUnit("4.3.2.4", "EFFETTI DELLE DEFORMAZIONI", "subparagraph", [
        heading("4.3.2.4", "EFFETTI DELLE DEFORMAZIONI", 122, p122.deformationTitle),
        textBlock("4.3.2.4", "editorial-001", "paragraph", 122, p122.deformationIntro, "In generale, è possibile effettuare:"),
        textBlock("4.3.2.4", "list-001", "list-item", 122, p122.deformationList1, "l’analisi del primo ordine, imponendo l’equilibrio sulla configurazione iniziale della struttura;"),
        textBlock("4.3.2.4", "list-002", "list-item", 122, p122.deformationList2, "l’analisi del secondo ordine, imponendo l’equilibrio sulla configurazione deformata della struttura;"),
        textBlock("4.3.2.4", "editorial-002", "paragraph", 122, p122.deformation1, "Gli effetti della geometria deformata (effetti del secondo ordine) devono essere considerati se essi amplificano significativamente gli effetti delle azioni o modificano significativamente il comportamento strutturale. L’analisi del primo ordine può essere utilizzata quando l’incremento delle sollecitazioni dovuto agli effetti del secondo ordine è inferiore al 10%. Tale condizione è ritenuta soddisfatta se:"),
        formulaRefForUnit("4.3.2.4", "4.3.4", "formula-001", 122, p122.formula34),
        textBlock("4.3.2.4", "editorial-003", "paragraph", 122, p122.deformation2, "dove α_cr è il fattore amplificativo dei carichi di progetto necessario per causare fenomeni di perdita della stabilità dell’equilibrio elastico. Per i telai il valore di α_cr può essere calcolato utilizzando l’espressione valida per le costruzioni in acciaio di cui al punto § 4.2.3.4.", [
            { kind: "text", value: "dove " },
            { kind: "math", value: "α_cr", latex: "\\alpha_{\\mathrm{cr}}" },
            { kind: "text", value: " è il fattore amplificativo dei carichi di progetto necessario per causare fenomeni di perdita della stabilità dell’equilibrio elastico. Per i telai il valore di " },
            { kind: "math", value: "α_cr", latex: "\\alpha_{\\mathrm{cr}}" },
            { kind: "text", value: " può essere calcolato utilizzando l’espressione valida per le costruzioni in acciaio di cui al punto § 4.2.3.4." },
        ]),
    ], { formulaIds: [formulaId("4.3.4")], tableIds: [], figureIds: [] }),
    makeUnit("4.3.2.5", "EFFETTI DELLE IMPERFEZIONI", "subparagraph", [
        heading("4.3.2.5", "EFFETTI DELLE IMPERFEZIONI", 122, p122.imperfectionTitle),
        textBlock("4.3.2.5", "editorial-001", "paragraph", 122, p122.imperfection1, "Nell’analisi strutturale si deve tenere conto, per quanto possibile, degli effetti delle imperfezioni. A tal fine possono adottarsi adeguate imperfezioni geometriche equivalenti, a meno che tali effetti non siano inclusi implicitamente nel calcolo della resistenza degli elementi strutturali."),
        textBlock("4.3.2.5", "editorial-002", "paragraph", 122, p122.imperfectionIntro, "Si devono considerare nel calcolo:"),
        textBlock("4.3.2.5", "list-001", "list-item", 122, p122.imperfectionList1, "le imperfezioni globali per i telai o per i sistemi di controvento;"),
        textBlock("4.3.2.5", "list-002", "list-item", 122, p122.imperfectionList2, "le imperfezioni locali per i singoli elementi strutturali."),
        textBlock("4.3.2.5", "editorial-003", "paragraph", 122, p122.imperfection2, "Nell’ambito dell’analisi globale della struttura, le imperfezioni degli elementi composti soggetti a compressione possono essere trascurate durante l’esecuzione dell’analisi del primo ordine. Le imperfezioni degli elementi strutturali possono essere trascurate anche nelle analisi al secondo ordine se:"),
        formulaRefForUnit("4.3.2.5", "4.3.5", "formula-001", 122, p122.formula35),
        textBlock("4.3.2.5", "editorial-004", "paragraph", 122, p122.imperfection3, "dove λ̄ è la snellezza normalizzata dell’elemento, calcolata in § 4.3.5.2, N_pl,Rk è la resistenza a compressione caratteristica dell’elemento, ottenuta considerando tutte le resistenze dei materiali senza coefficienti parziali di sicurezza e N_Ed è lo sforzo assiale di progetto.", [
            { kind: "text", value: "dove " },
            { kind: "math", value: "λ̄", latex: "\\bar{\\lambda}" },
            { kind: "text", value: " è la snellezza normalizzata dell’elemento, calcolata in § 4.3.5.2, " },
            { kind: "math", value: "N_pl,Rk", latex: "N_{\\mathrm{pl,Rk}}" },
            { kind: "text", value: " è la resistenza a compressione caratteristica dell’elemento, ottenuta considerando tutte le resistenze dei materiali senza coefficienti parziali di sicurezza e " },
            { kind: "math", value: "N_Ed", latex: "N_{\\mathrm{Ed}}" },
            { kind: "text", value: " è lo sforzo assiale di progetto." },
        ]),
        textBlock("4.3.2.5", "editorial-005", "paragraph", 122, p122.imperfection5, "Gli effetti delle imperfezioni globali devono essere tenuti in conto secondo quanto prescritto per le strutture in acciaio al punto § 4.2.3.5 della presente norma."),
    ], { formulaIds: [formulaId("4.3.5")], tableIds: [], figureIds: [] }),
];

const manifest = {
    $schema: "urn:structural-codes:schema:asset-manifest:v2",
    schemaVersion: "2.0.0-alpha.1",
    recordType: "asset-manifest",
    document: "ntc2018",
    section: "4.3-step1",
    sourceId,
    status: "transcribed-unreviewed",
    formulas: formulaAssets,
    tables: [tableAsset],
    figures: [] as unknown[],
};

for (const asset of figureAssets) {
    const imageFile = join(figureDirectory, asset.filename);
    manifest.figures.push({
        id: asset.id,
        unitId: asset.unitId,
        officialNumber: asset.officialNumber,
        pdfPage: asset.pdfPage,
        caption: asset.caption,
        alt: asset.alt,
        imagePath: asset.imagePath,
        region: asset.region,
        sha256: await sha256OfFile(imageFile),
    });
}

mkdirSync(unitDirectory, { recursive: true });
mkdirSync(assetDirectory, { recursive: true });
for (const unit of units) {
    const number = (unit as { numbering: { official: string } }).numbering.official;
    writeFileSync(join(unitDirectory, `${number}.json`), `${JSON.stringify(unit, null, 2)}\n`, "utf8");
}
writeFileSync(join(assetDirectory, "4.3-step1.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(`NTC 4.3 step1: generate ${units.length} unità e ${formulaAssets.length} formule, 1 tabella, ${figureAssets.length} figure.`);
