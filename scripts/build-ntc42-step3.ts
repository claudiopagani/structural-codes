import { copyFile, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { sha256OfText } from "../src/lib/hash.ts";

const repoRoot = fileURLToPath(new URL("../", import.meta.url));
const unitDirectory = join(repoRoot, "corpus", "units", "ntc2018");
const assetDirectory = join(repoRoot, "corpus", "assets", "ntc2018");
const figureDirectory = join(repoRoot, "corpus", "assets", "figures", "ntc2018");
const evidenceRenderDirectory = join(repoRoot, "evidence", "gu-so8-2018-ntc", "renders");
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
type Inline = { kind: "text" | "math"; value: string; latex?: string };
type TextOptions = {
    page: number;
    printedPage: string;
    wrap?: boolean;
    discretionaryHyphen?: boolean;
    manual?: boolean;
};

const unitId = (number: string) =>
    `urn:structural-codes:it:unit:ntc2018:${number}`;
const formulaId = (number: string) =>
    `urn:structural-codes:it:asset:formula:ntc2018:${number}`;
const tableId = (number: string) =>
    `urn:structural-codes:it:asset:table:ntc2018:${number}`;
const region = (x: number, y: number, width: number, height: number): Region => ({
    coordinateSystem: "pdf-points-top-left",
    x,
    y,
    width,
    height,
});

function transformations(options: TextOptions) {
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
                note: "Unite le righe appartenenti allo stesso capoverso; i capoversi distinti restano blocchi separati.",
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
            note: "Ripristinati gli accenti, gli apostrofi tipografici e i glifi matematici confrontati con il render ufficiale.",
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
    options: TextOptions,
    blockRegion: Region | null,
    raw: string,
    normalized: string,
) {
    return {
        sourceId,
        pdfPage: options.page,
        printedPage: options.printedPage,
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
    options: TextOptions,
    blockRegion: Region,
    raw: string,
    normalized: string,
    inline: Inline[] = [{ kind: "text", value: normalized }],
) {
    return {
        blockId: `${unitId(number)}#block-${suffix}`,
        kind,
        origin: "official",
        text: { raw, normalized, normalizationVersion: profile, inline },
        evidence: evidence(options, blockRegion, raw, normalized),
    };
}

function formulaBlock(
    number: string,
    suffix: string,
    asset: string,
    options: TextOptions,
    blockRegion: Region,
    raw: string,
) {
    return {
        blockId: `${unitId(number)}#block-${suffix}`,
        kind: "formula-ref",
        origin: "official",
        assetId: asset,
        evidence: evidence(options, blockRegion, raw, raw),
    };
}

function tableBlock(
    number: string,
    suffix: string,
    asset: string,
    options: TextOptions,
    blockRegion: Region,
) {
    const note = "Tabella strutturata dal render ufficiale; gli schemi grafici incorporati nella fonte restano soggetti a revisione visuale puntuale.";
    return {
        blockId: `${unitId(number)}#block-${suffix}`,
        kind: "table-ref",
        origin: "official",
        assetId: asset,
        evidence: {
            ...evidence(options, blockRegion, note, note),
            extraction: {
                method: "manual-transcription",
                tool: "codex-source-transcription",
                toolVersion: profile,
            },
            transformations: [
                {
                    operation: "manual-correction",
                    ruleVersion: profile,
                    note,
                },
            ],
        },
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
    formulas: string[] = [],
    tables: string[] = [],
) {
    return {
        $schema: "urn:structural-codes:schema:canonical-unit:v2",
        schemaVersion: "2.0.0-alpha.2",
        recordType: "canonical-unit",
        id: unitId(number),
        workId,
        expressionId,
        kind: number === "4.2.3" ? "section" : "subparagraph",
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
        assets: { formulaIds: formulas, tableIds: tables, figureIds: [] },
        workflow: {
            status: "extracted",
            createdBy: {
                actorId: "codex:ntc42-step3",
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
                ...(tables.length > 0
                    ? [
                          {
                              issueId: `ntc2018-${number.replaceAll(".", "-")}-assets`,
                              type: "asset-review",
                              severity: "blocking",
                              note: "Le tabelle sono strutturate e collocate nel punto originario; resta obbligatorio il confronto umano cella per cella e schema per schema con la fonte ufficiale.",
                          },
                      ]
                    : []),
            ],
        },
    };
}

const p97 = { page: 97, printedPage: "93" };
const p98 = { page: 98, printedPage: "94" };
const p99 = { page: 99, printedPage: "95" };
const p100 = { page: 100, printedPage: "96" };
const p101 = { page: 101, printedPage: "97" };

const f420 = formulaId("4.2.0");
const f421 = formulaId("4.2.1");
const f422 = formulaId("4.2.2");
const t4_2_iii = tableId("4.2.iii");
const t4_2_iv = tableId("4.2.iv");
const t4_2_v = tableId("4.2.v");
const t4_2_vi = tableId("4.2.vi");

const math = (value: string, latex: string): Inline => ({ kind: "math", value, latex });
const text = (value: string): Inline => ({ kind: "text", value });

const tableImageSpecs = {
    iiiSections: { source: "page-0098-x86-y303-w253-h68@3x.png", target: "table4.2.iii-sections.png", alt: "Parti interne compresse e assi di inflessione", region: region(86, 303, 253, 68), sha256: "52c3c09730be9aaab099435cbd4476d917d101d03f9cae8ce4ca8a777c21d196" },
    iiiFlexure: { source: "page-0098-x127-y396-w47-h45@3x.png", target: "table4.2.iii-stress-flexure.png", alt: "Distribuzione delle tensioni per parte soggetta a flessione", region: region(127, 396, 47, 45), sha256: "d855d35a0dcbbf391a6a50d5cde08071062999fd20430d3b093bad26ca2cf8f4" },
    iiiCompression: { source: "page-0098-x182-y396-w51-h45@3x.png", target: "table4.2.iii-stress-compression.png", alt: "Distribuzione delle tensioni per parte soggetta a compressione", region: region(182, 396, 51, 45), sha256: "dfc331ffb39a6a0ee7bc7830e877afc4aa7d93848c5254aa3a11385877d7d8bb" },
    iiiCombined: { source: "page-0098-x249-y396-w69-h45@3x.png", target: "table4.2.iii-stress-flexure-compression.png", alt: "Distribuzione delle tensioni per parte soggetta a flessione e compressione", region: region(249, 396, 69, 45), sha256: "7b9be73e5e1151b0286f3c0067d4447cf430eed9e59aa6c055f07511f12fd102" },
    iiiFlexureClass3: { source: "page-0098-x125-y492-w50-h55@3x.png", target: "table4.2.iii-stress-flexure-class3.png", alt: "Distribuzione elastica delle tensioni per flessione, classe 3", region: region(125, 492, 50, 55), sha256: "3cbc15b28d69c062f9de1c48c422e13a98794c1feedee24c33ef23e5d19b882d" },
    iiiCompressionClass3: { source: "page-0098-x184-y492-w50-h55@3x.png", target: "table4.2.iii-stress-compression-class3.png", alt: "Distribuzione elastica delle tensioni per compressione, classe 3", region: region(184, 492, 50, 55), sha256: "8a33748417038261bd587e6238f21e16d735335c05f94857eb4d6457b1901a48" },
    iiiCombinedClass3: { source: "page-0098-x248-y492-w70-h55@3x.png", target: "table4.2.iii-stress-flexure-compression-class3.png", alt: "Distribuzione elastica delle tensioni per flessione e compressione, classe 3", region: region(248, 492, 70, 55), sha256: "ad20a8cb36b759081f0a0e438e54d96a4bb6c24af5c6587f92e5e4d948276266" },
    ivSections: { source: "page-0099-x110-y119-w188-h32@3x.png", target: "table4.2.iv-sections.png", alt: "Piattabande esterne di profilati laminati a caldo e sezioni saldate", region: region(110, 119, 188, 32), sha256: "7199d1987eda0355b9ed12b88cb2bcb3b782f171927461e135e50a631555a019" },
    ivCompression: { source: "page-0099-x151-y188-w37-h23@3x.png", target: "table4.2.iv-stress-compression.png", alt: "Distribuzione delle tensioni nella piattabanda esterna compressa", region: region(151, 188, 37, 23), sha256: "77e8b5071d68e899716d58ad728eac5861f938d8a92f771ea7f85cc80f5ec0c6" },
    ivCombinedCompression: { source: "page-0099-x210-y188-w49-h23@3x.png", target: "table4.2.iv-stress-compression-end.png", alt: "Distribuzione delle tensioni con estremità in compressione", region: region(210, 188, 49, 23), sha256: "2a90ec231eaa6b2c0833b57027af45c348311258c812d8bc9949c75f02291b4a" },
    ivCombinedTension: { source: "page-0099-x275-y188-w39-h23@3x.png", target: "table4.2.iv-stress-tension-end.png", alt: "Distribuzione delle tensioni con estremità in trazione", region: region(275, 188, 39, 23), sha256: "7074595a424e9f22819dcf7cd2850ae9193af784f5b99e16a794fdf6ff5254fa" },
    ivCompressionClass3: { source: "page-0099-x151-y244-w37-h20@3x.png", target: "table4.2.iv-stress-compression-class3.png", alt: "Distribuzione elastica delle tensioni nella piattabanda esterna compressa, classe 3", region: region(151, 244, 37, 20), sha256: "c4a6a6d8759929eae9c58f21ac09def7cd6f566a661f221ba122780a4e8c9d71" },
    ivCombinedCompressionClass3: { source: "page-0099-x210-y244-w49-h20@3x.png", target: "table4.2.iv-stress-compression-end-class3.png", alt: "Distribuzione elastica delle tensioni con estremità in compressione, classe 3", region: region(210, 244, 49, 20), sha256: "f4cde4136a61d24f17c8278e86be69dfab16f890102e8e89f4e5df9ee738b848" },
    ivCombinedTensionClass3: { source: "page-0099-x275-y244-w39-h20@3x.png", target: "table4.2.iv-stress-tension-end-class3.png", alt: "Distribuzione elastica delle tensioni con estremità in trazione, classe 3", region: region(275, 244, 39, 20), sha256: "51f7edac6745fe74f67413e57b10e4f3c13e7a7ab02c001ca3cd52c37d44a1d6" },
    vAngle: { source: "page-0099-x177-y334-w34-h18@3x.png", target: "table4.2.v-angle.png", alt: "Sezione angolare con dimensioni b, h e t", region: region(177, 334, 34, 18), sha256: "cdc5e8222448c99128592a462c41d01c8b5e4471d6e83c071e77ac741dcddba1" },
    vAngleStress: { source: "page-0099-x174-y379-w47-h24@3x.png", target: "table4.2.v-angle-stress.png", alt: "Distribuzione delle tensioni sulla sezione angolare", region: region(174, 379, 47, 24), sha256: "ae228e061063bf0cca9a13457ce29f12687109fbe81bef515fbc038acba9fec0" },
    vTube: { source: "page-0099-x173-y427-w45-h23@3x.png", target: "table4.2.v-tube.png", alt: "Sezione tubolare con diametro d e spessore t", region: region(173, 427, 45, 23), sha256: "1ebf9dbbee24a2c12d4089ed70d94290a9d3f41173c9cb7f0b62f649fdebb215" },
} as const;

function tableImage(key: keyof typeof tableImageSpecs) {
    const { target, alt, region: imageRegion, sha256 } = tableImageSpecs[key];
    return { image: { imagePath: `figures/ntc2018/${target}`, alt, region: imageRegion, sha256 } };
}

const tableIIICombinedClass1Inline: Inline[] = [
    text("quando "), math("α > 0,5", "\\alpha>0{,}5"), text(": "),
    math("c/t ≤ 396ε/(13α−1)", "c/t\\le\\frac{396\\varepsilon}{13\\alpha-1}"),
    text("; quando "), math("α ≤ 0,5", "\\alpha\\le0{,}5"), text(": "),
    math("c/t ≤ 36ε/α", "c/t\\le\\frac{36\\varepsilon}{\\alpha}"),
];
const tableIIICombinedClass2Inline: Inline[] = [
    text("quando "), math("α > 0,5", "\\alpha>0{,}5"), text(": "),
    math("c/t ≤ 456ε/(13α−1)", "c/t\\le\\frac{456\\varepsilon}{13\\alpha-1}"),
    text("; quando "), math("α ≤ 0,5", "\\alpha\\le0{,}5"), text(": "),
    math("c/t ≤ 41,5ε/α", "c/t\\le\\frac{41{,}5\\varepsilon}{\\alpha}"),
];
const tableIIICombinedClass3Inline: Inline[] = [
    text("quando "), math("ψ > −1", "\\psi>-1"), text(": "),
    math("c/t ≤ 42ε/(0,67+0,33ψ)", "c/t\\le\\frac{42\\varepsilon}{0{,}67+0{,}33\\psi}"),
    text("; quando "), math("ψ ≤ −1", "\\psi\\le-1"), text(": "),
    math("c/t ≤ 62ε(1−ψ)√(−ψ)", "c/t\\le62\\varepsilon(1-\\psi)\\sqrt{-\\psi}"),
];
const tableIIIClassificationDistribution = "Distribuzione\ndelle tensioni\nnelle parti\n(compressione\npositiva)";
const tableIVClassificationDistribution = "Distribuzione delle\ntensioni nelle parti\n(compressione positiva)";
const tableVClassificationDistribution = "Distribuzione delle\ntensioni sulla sezione\n(compressione positiva)";

const tableIII = {
    id: t4_2_iii,
    unitId: unitId("4.2.3.1"),
    officialNumber: "4.2.III",
    pdfPage: 98,
    caption: "Tab. 4.2.III – Massimi rapporti larghezza spessore per parti compresse",
    captionInline: [
        { kind: "strong", value: "Tab. 4.2.III" },
        { kind: "em", value: " – Massimi rapporti larghezza spessore per parti compresse" },
    ],
    columnCount: 7,
    headers: [
        [{ text: "", colSpan: 7, align: "center", ...tableImage("iiiSections") }],
        [{ text: "Parti interne compresse", colSpan: 7, align: "center", strong: true }],
        [
            { text: "Classe", align: "center" },
            { text: "Parte soggetta a flessione", colSpan: 2, align: "left" },
            { text: "Parte soggetta a compressione", colSpan: 2, align: "left" },
            { text: "Parte soggetta a flessione e a compressione", colSpan: 2, align: "left" },
        ],
    ],
    rows: [
        [
            { text: tableIIIClassificationDistribution, align: "center", strong: true },
            { text: "", colSpan: 2, align: "center", ...tableImage("iiiFlexure") },
            { text: "", colSpan: 2, align: "center", ...tableImage("iiiCompression") },
            { text: "", colSpan: 2, align: "center", ...tableImage("iiiCombined") },
        ],
        [
            { text: "1", align: "center" },
            { text: "c/t ≤ 72ε", latex: "c/t\\le72\\varepsilon", colSpan: 2, align: "center" },
            { text: "c/t ≤ 33ε", latex: "c/t\\le33\\varepsilon", colSpan: 2, align: "center" },
            { text: "quando α > 0,5: c/t ≤ 396ε/(13α−1); quando α ≤ 0,5: c/t ≤ 36ε/α", latex: "\\text{quando }\\alpha>0{,}5:\\ c/t\\le\\frac{396\\varepsilon}{13\\alpha-1};\\quad\\text{quando }\\alpha\\le0{,}5:\\ c/t\\le\\frac{36\\varepsilon}{\\alpha}", inline: tableIIICombinedClass1Inline, colSpan: 2, align: "center" },
        ],
        [
            { text: "2", align: "center" },
            { text: "c/t ≤ 83ε", latex: "c/t\\le83\\varepsilon", colSpan: 2, align: "center" },
            { text: "c/t ≤ 38ε", latex: "c/t\\le38\\varepsilon", colSpan: 2, align: "center" },
            { text: "quando α > 0,5: c/t ≤ 456ε/(13α−1); quando α ≤ 0,5: c/t ≤ 41,5ε/α", latex: "\\text{quando }\\alpha>0{,}5:\\ c/t\\le\\frac{456\\varepsilon}{13\\alpha-1};\\quad\\text{quando }\\alpha\\le0{,}5:\\ c/t\\le\\frac{41{,}5\\varepsilon}{\\alpha}", inline: tableIIICombinedClass2Inline, colSpan: 2, align: "center" },
        ],
        [
            { text: tableIIIClassificationDistribution, align: "center", strong: true },
            { text: "", colSpan: 2, align: "center", ...tableImage("iiiFlexureClass3") },
            { text: "", colSpan: 2, align: "center", ...tableImage("iiiCompressionClass3") },
            { text: "", colSpan: 2, align: "center", ...tableImage("iiiCombinedClass3") },
        ],
        [
            { text: "3", align: "center" },
            { text: "c/t ≤ 124ε", latex: "c/t\\le124\\varepsilon", colSpan: 2, align: "center" },
            { text: "c/t ≤ 42ε", latex: "c/t\\le42\\varepsilon", colSpan: 2, align: "center" },
            { text: "quando ψ > −1: c/t ≤ 42ε/(0,67 + 0,33ψ); quando ψ ≤ −1: c/t ≤ 62ε(1−ψ)√(−ψ)", latex: "\\text{quando }\\psi>-1:\\ c/t\\le\\frac{42\\varepsilon}{0{,}67+0{,}33\\psi};\\quad\\text{quando }\\psi\\le-1:\\ c/t\\le62\\varepsilon(1-\\psi)\\sqrt{-\\psi}", inline: tableIIICombinedClass3Inline, colSpan: 2, align: "center" },
        ],
        [
            { text: "ε = √(235/fyk)", latex: "\\varepsilon=\\sqrt{235/f_{yk}}", rowSpan: 2, align: "center" },
            { text: "fyk", latex: "f_{yk}", align: "center" },
            { text: "235", align: "center" },
            { text: "275", align: "center" },
            { text: "355", align: "center" },
            { text: "420", align: "center" },
            { text: "460", align: "center" },
        ],
        [
            { text: "ε", latex: "\\varepsilon", align: "center" },
            { text: "1,00", align: "center" },
            { text: "0,92", align: "center" },
            { text: "0,81", align: "center" },
            { text: "0,75", align: "center" },
            { text: "0,71", align: "center" },
        ],
    ],
    notes: [
        "*) ψ ≤ −1 si applica se la tensione di compressione σ ≤ fyk o la deformazione a trazione εy > fyk/E.",
    ],
    notesInline: [[
        text("*) "), math("ψ ≤ −1", "\\psi\\le-1"), text(" si applica se la tensione di compressione "),
        math("σ ≤ fyk", "\\sigma\\le f_{yk}"), text(" o la deformazione a trazione "),
        math("εy > fyk/E", "\\varepsilon_y>f_{yk}/E"), text("."),
    ]],
};

const tableIV = {
    id: t4_2_iv,
    unitId: unitId("4.2.3.1"),
    officialNumber: "4.2.IV",
    pdfPage: 99,
    caption: "Tab. 4.2.IV – Massimi rapporti larghezza spessore per parti compresse",
    captionInline: [
        { kind: "strong", value: "Tab. 4.2.IV" },
        { kind: "em", value: " – Massimi rapporti larghezza spessore per parti compresse" },
    ],
    columnCount: 7,
    headers: [
        [{ text: "Piattabande esterne", colSpan: 7, align: "center", strong: true }],
        [{ text: "", colSpan: 7, align: "center", ...tableImage("ivSections") }],
        [{ text: "Profilati laminati a caldo", colSpan: 3, align: "center", strong: true }, { text: "Sezioni saldate", colSpan: 4, align: "center", strong: true }],
        [
            { text: "Classe", align: "center" },
            { text: "Piattabande esterne soggette a compressione", colSpan: 2, align: "left" },
            { text: "Piattabande esterne soggette a flessione e a compressione", colSpan: 4, align: "left" },
        ],
        [{ text: "" }, { text: "", colSpan: 2 }, { text: "Con estremità in compressione", colSpan: 2, align: "left" }, { text: "Con estremità in trazione", colSpan: 2, align: "left" }],
    ],
    rows: [
        [
            { text: tableIVClassificationDistribution, align: "center", strong: true },
            { text: "", colSpan: 2, align: "center", ...tableImage("ivCompression") },
            { text: "", colSpan: 2, align: "center", ...tableImage("ivCombinedCompression") },
            { text: "", colSpan: 2, align: "center", ...tableImage("ivCombinedTension") },
        ],
        [
            { text: "1", align: "center" },
            { text: "c/t ≤ 9ε", latex: "c/t\\le9\\varepsilon", colSpan: 2, align: "center" },
            { text: "c/t ≤ 9ε/α", latex: "c/t\\le\\frac{9\\varepsilon}{\\alpha}", colSpan: 2, align: "center" },
            { text: "c/t ≤ 9ε/(α√α)", latex: "c/t\\le\\frac{9\\varepsilon}{\\alpha\\sqrt{\\alpha}}", colSpan: 2, align: "center" },
        ],
        [
            { text: "2", align: "center" },
            { text: "c/t ≤ 10ε", latex: "c/t\\le10\\varepsilon", colSpan: 2, align: "center" },
            { text: "c/t ≤ 10ε/α", latex: "c/t\\le\\frac{10\\varepsilon}{\\alpha}", colSpan: 2, align: "center" },
            { text: "c/t ≤ 10ε/(α√α)", latex: "c/t\\le\\frac{10\\varepsilon}{\\alpha\\sqrt{\\alpha}}", colSpan: 2, align: "center" },
        ],
        [
            { text: tableIVClassificationDistribution, align: "center", strong: true },
            { text: "", colSpan: 2, align: "center", ...tableImage("ivCompressionClass3") },
            { text: "", colSpan: 2, align: "center", ...tableImage("ivCombinedCompressionClass3") },
            { text: "", colSpan: 2, align: "center", ...tableImage("ivCombinedTensionClass3") },
        ],
        [
            { text: "3", align: "center" },
            { text: "c/t ≤ 14ε", latex: "c/t\\le14\\varepsilon", colSpan: 2, align: "center" },
            { text: "c/t ≤ 21ε√ke — Per ke vedere EN 1993-1-5", latex: "c/t\\le21\\varepsilon\\sqrt{k_e}\\quad\\text{Per }k_e\\text{ vedere EN 1993-1-5}", colSpan: 4, align: "center" },
        ],
        [
            { text: "ε = √(235/fyk)", latex: "\\varepsilon=\\sqrt{235/f_{yk}}", rowSpan: 2, align: "center" },
            { text: "fyk", latex: "f_{yk}", align: "center" },
            { text: "235", align: "center" },
            { text: "275", align: "center" },
            { text: "355", align: "center" },
            { text: "420", align: "center" },
            { text: "460", align: "center" },
        ],
        [
            { text: "ε", latex: "\\varepsilon", align: "center" },
            { text: "1,00", align: "center" },
            { text: "0,92", align: "center" },
            { text: "0,81", align: "center" },
            { text: "0,75", align: "center" },
            { text: "0,71", align: "center" },
        ],
    ],
    notes: [],
};

const tableV = {
    id: t4_2_v,
    unitId: unitId("4.2.3.1"),
    officialNumber: "4.2.V",
    pdfPage: 99,
    caption: "Tab. 4.2.V – Massimi rapporti larghezza spessore per parti compresse",
    captionInline: [
        { kind: "strong", value: "Tab. 4.2.V" },
        { kind: "em", value: " – Massimi rapporti larghezza spessore per parti compresse" },
    ],
    columnCount: 7,
    headers: [
        [{ text: "Angolari", colSpan: 7, align: "center", strong: true }],
        [{ text: "", colSpan: 7, align: "center", ...tableImage("vAngle") }],
        [{ text: "Riferirsi anche alle piattabande esterne (v. Tab. 4.2.IV).\nNon si applica agli angoli in contatto continuo con altri componenti.", colSpan: 7, align: "left", header: false }],
        [{ text: "Classe", colSpan: 1, align: "center" }, { text: "Sezione in compressione", colSpan: 6, align: "center" }],
    ],
    rows: [
        [
            { text: tableVClassificationDistribution, colSpan: 1, align: "center", strong: true },
            { text: "", colSpan: 6, align: "center", ...tableImage("vAngleStress") },
        ],
        [{ text: "3", colSpan: 1, align: "center" }, { text: "h/t ≤ 15ε; (b+h)/(2t) ≤ 11,5ε", latex: "h/t\\le15\\varepsilon;\\quad\\frac{b+h}{2t}\\le11{,}5\\varepsilon", inline: [math("h/t ≤ 15ε", "h/t\\le15\\varepsilon"), text("; "), math("(b+h)/(2t) ≤ 11,5ε", "\\frac{b+h}{2t}\\le11{,}5\\varepsilon")], colSpan: 6, align: "center" }],
        [{ text: "Sezioni Tubolari", colSpan: 7, align: "center", strong: true }],
        [{ text: "", colSpan: 7, align: "center", ...tableImage("vTube") }],
        [{ text: "Classe", colSpan: 1, align: "center", strong: true }, { text: "Sezione inflessa e/o compressa", colSpan: 6, align: "center", strong: true }],
        [{ text: "1", colSpan: 1, align: "center" }, { text: "d/t ≤ 50ε²", latex: "d/t\\le50\\varepsilon^2", colSpan: 6, align: "center" }],
        [{ text: "2", colSpan: 1, align: "center" }, { text: "d/t ≤ 70ε²", latex: "d/t\\le70\\varepsilon^2", colSpan: 6, align: "center" }],
        [{ text: "3", colSpan: 1, align: "center" }, { text: "d/t ≤ 90ε² (Per d/t > 90ε² vedere EN 1993-1-6)", latex: "d/t\\le90\\varepsilon^2\\quad(\\text{Per }d/t>90\\varepsilon^2\\text{ vedere EN 1993-1-6})", inline: [math("d/t ≤ 90ε²", "d/t\\le90\\varepsilon^2"), text(" (Per "), math("d/t > 90ε²", "d/t>90\\varepsilon^2"), text(" vedere EN 1993-1-6)")], colSpan: 6, align: "center" }],
        [
            { text: "ε = √(235/fyk)", latex: "\\varepsilon=\\sqrt{235/f_{yk}}", rowSpan: 3, align: "center" },
            { text: "fyk", latex: "f_{yk}", align: "center" },
            ...["235", "275", "355", "420", "460"].map((value) => ({ text: value, align: "center" as const })),
        ],
        [{ text: "ε", latex: "\\varepsilon", align: "center" }, ...["1,00", "0,92", "0,81", "0,75", "0,71"].map((value) => ({ text: value, align: "center" as const }))],
        [{ text: "ε²", latex: "\\varepsilon^2", align: "center" }, ...["1,00", "0,85", "0,66", "0,56", "0,51"].map((value) => ({ text: value, align: "center" as const }))],
    ],
    notes: [],
};

const tableVI = {
    id: t4_2_vi,
    unitId: unitId("4.2.3.3"),
    officialNumber: "4.2.VI",
    pdfPage: 100,
    caption: "Tab. 4.2.VI – Metodi di analisi globali e relativi metodi di calcolo delle capacità e classi di sezioni ammesse",
    captionInline: [
        { kind: "strong", value: "Tab. 4.2.VI" },
        { kind: "em", value: " – Metodi di analisi globali e relativi metodi di calcolo delle capacità e classi di sezioni ammesse" },
    ],
    columnCount: 3,
    headers: [[
        { text: "Metodo di analisi globale", align: "center" },
        { text: "Metodo di calcolo della capacità\nresistente della sezione", align: "center" },
        { text: "Tipo di sezione" },
    ]],
    rows: [
        [{ text: "(E)", align: "center" }, { text: "(E)", align: "center" }, { text: "tutte (*)" }],
        [{ text: "(E)", align: "center" }, { text: "(P)", align: "center" }, { text: "classi 1 e 2" }],
        [{ text: "(E)", align: "center" }, { text: "(EP)", align: "center" }, { text: "tutte (*)" }],
        [{ text: "(P)", align: "center" }, { text: "(P)", align: "center" }, { text: "classe 1" }],
        [{ text: "(EP)", align: "center" }, { text: "(EP)", align: "center" }, { text: "tutte (*)" }],
    ],
    notes: ["(*) per le sezioni di classe 4 la capacità resistente può essere calcolata con riferimento alla sezione efficace."],
};

const units = [
    makeUnit("4.2.3", "ANALISI STRUTTURALE", [
        textBlock("4.2.3", "heading", "heading", { ...p97, manual: true }, region(82.954, 575.254, 120.561, 7.476), "4.2.3. ANALISI STRUTTURALE", "4.2.3 ANALISI STRUTTURALE"),
        textBlock("4.2.3", "editorial-001", "paragraph", { ...p97, wrap: true }, region(82.954, 587.209, 428.618, 17.553), "Il metodo di analisi deve essere coerente con le ipotesi di progetto. L’analisi deve essere basata su modelli strutturali di calcolo\nappropriati, a seconda dello stato limite considerato.", "Il metodo di analisi deve essere coerente con le ipotesi di progetto. L’analisi deve essere basata su modelli strutturali di calcolo appropriati, a seconda dello stato limite considerato."),
        textBlock("4.2.3", "editorial-002", "paragraph", { ...p97, wrap: true }, region(82.947, 609.887, 428.521, 17.552), "Le ipotesi scelte ed il modello di calcolo adottato devono essere in grado di riprodurre il comportamento globale della struttura e\nquello locale delle sezioni adottate, degli elementi strutturali, dei collegamenti e degli appoggi.", "Le ipotesi scelte ed il modello di calcolo adottato devono essere in grado di riprodurre il comportamento globale della struttura e quello locale delle sezioni adottate, degli elementi strutturali, dei collegamenti e degli appoggi."),
        textBlock("4.2.3", "editorial-003", "paragraph", { ...p97, wrap: true }, region(82.947, 632.519, 428.624, 17.597), "Nell’analisi globale della struttura, in quella dei sistemi di controvento e nel calcolo delle membrature si deve tener conto delle\nimperfezioni geometriche e strutturali di cui al § 4.2.3.5.", "Nell’analisi globale della struttura, in quella dei sistemi di controvento e nel calcolo delle membrature si deve tener conto delle imperfezioni geometriche e strutturali di cui al § 4.2.3.5."),
    ]),
        makeUnit("4.2.3.1", "CLASSIFICAZIONE DELLE SEZIONI", [
        textBlock("4.2.3.1", "heading", "heading", { ...p97, manual: true }, region(82.954, 665.115, 150.55, 7.476), "4.2.3.1 C LASSIFICAZIONE DELLE SEZIONI", "4.2.3.1 CLASSIFICAZIONE DELLE SEZIONI"),
        textBlock("4.2.3.1", "editorial-001", "paragraph", { ...p97 }, region(82.954, 676.921, 400.09, 7.482), "Le sezioni trasversali degli elementi strutturali si classificano in funzione della loro capacità rotazionale CΌ definita come:", "Le sezioni trasversali degli elementi strutturali si classificano in funzione della loro capacità rotazionale Cϑ definita come:", [text("Le sezioni trasversali degli elementi strutturali si classificano in funzione della loro capacità rotazionale "), math("Cϑ", "C_{\\vartheta}"), text(" definita come:")]),
        formulaBlock("4.2.3.1", "editorial-002", f420, { ...p97, manual: true }, region(201.168, 691.873, 164.43, 7.482), "CΟ = Οr / Οy ƺ 1 [4.2.0]"),
        textBlock("4.2.3.1", "editorial-003", "paragraph", { ...p97 }, region(82.951, 706.874, 406.796, 7.482), "essendo Οr e Οy le rotazioni corrispondenti rispettivamente al raggiungimento della deformazione ultima ed allo snervamento.", "essendo ϑr e ϑy le rotazioni corrispondenti rispettivamente al raggiungimento della deformazione ultima ed allo snervamento.", [text("essendo "), math("ϑr", "\\vartheta_r"), text(" e "), math("ϑy", "\\vartheta_y"), text(" le rotazioni corrispondenti rispettivamente al raggiungimento della deformazione ultima ed allo snervamento.")]),
        textBlock("4.2.3.1", "editorial-004", "paragraph", { ...p98, wrap: true }, region(82.954, 98.928, 428.556, 17.552), "La classificazione delle sezioni trasversali degli elementi strutturali si effettua in funzione della loro capacità di deformarsi in\ncampo plastico. E’ possibile distinguere le seguenti classi di sezioni:", "La classificazione delle sezioni trasversali degli elementi strutturali si effettua in funzione della loro capacità di deformarsi in campo plastico. E’ possibile distinguere le seguenti classi di sezioni:"),
        textBlock("4.2.3.1", "editorial-005", "paragraph", { ...p98, wrap: true }, region(82.954, 121.614, 428.696, 27.617), "classe 1 se la sezione è in grado di sviluppare una cerniera plastica avente la capacità rotazionale richiesta per l’analisi strutturale\ncondotta con il metodo plastico di cui al § 4.2.3.2 senza subire riduzioni della resistenza Possono generalmente classifi-\ncarsi come tali le sezioni con capacità rotazionale CΟ ǃ 3;", "classe 1 se la sezione è in grado di sviluppare una cerniera plastica avente la capacità rotazionale richiesta per l’analisi strutturale condotta con il metodo plastico di cui al § 4.2.3.2 senza subire riduzioni della resistenza Possono generalmente classificarsi come tali le sezioni con capacità rotazionale Cϑ ≥ 3;", [text("classe 1 se la sezione è in grado di sviluppare una cerniera plastica avente la capacità rotazionale richiesta per l’analisi strutturale condotta con il metodo plastico di cui al § 4.2.3.2 senza subire riduzioni della resistenza Possono generalmente classificarsi come tali le sezioni con capacità rotazionale "), math("Cϑ ≥ 3", "C_{\\vartheta}\\ge3"), text(";")]),
        textBlock("4.2.3.1", "editorial-006", "paragraph", { ...p98, wrap: true }, region(82.954, 155.254, 428.56, 17.552), "classe 2 se la sezione è in grado di sviluppare il proprio momento resistente plastico, ma con capacità rotazionale limitata. Possono\ngeneralmente classificarsi come tali le sezioni con capacità rotazionale CΟ ǃ 1,5;", "classe 2 se la sezione è in grado di sviluppare il proprio momento resistente plastico, ma con capacità rotazionale limitata. Possono generalmente classificarsi come tali le sezioni con capacità rotazionale Cϑ ≥ 1,5;", [text("classe 2 se la sezione è in grado di sviluppare il proprio momento resistente plastico, ma con capacità rotazionale limitata. Possono generalmente classificarsi come tali le sezioni con capacità rotazionale "), math("Cϑ ≥ 1,5", "C_{\\vartheta}\\ge1{,}5"), text(";")]),
        textBlock("4.2.3.1", "editorial-007", "paragraph", { ...p98, wrap: true }, region(82.954, 178.824, 400.459, 17.592), "classe 3 se nella sezione le tensioni calcolate nelle fibre estreme compresse possono raggiungere la tensione di snervamento, ma\nl’instabilità locale impedisce lo sviluppo del momento resistente plastico;", "classe 3 se nella sezione le tensioni calcolate nelle fibre estreme compresse possono raggiungere la tensione di snervamento, ma l’instabilità locale impedisce lo sviluppo del momento resistente plastico;"),
        textBlock("4.2.3.1", "editorial-008", "paragraph", { ...p98, wrap: true, discretionaryHyphen: true }, region(82.954, 201.504, 428.859, 27.662), "classe 4 se, per determinarne la resistenza flettente, tagliante o normale, è necessario tener conto degli effetti dell’instabilità locale\nin fase elastica nelle parti compresse che compongono la sezione. In tal caso nel calcolo della resistenza la sezione geome-\ntrica effettiva può sostituirsi con una sezione efficace.", "classe 4 se, per determinarne la resistenza flettente, tagliante o normale, è necessario tener conto degli effetti dell’instabilità locale in fase elastica nelle parti compresse che compongono la sezione. In tal caso nel calcolo della resistenza la sezione geometrica effettiva può sostituirsi con una sezione efficace."),
        textBlock("4.2.3.1", "editorial-009", "paragraph", { ...p98 }, region(82.955, 234.25, 425.286, 7.482), "Le sezioni di classe 1 si definiscono duttili, quelle di classe 2 compatte, quelle di classe 3 semi-compatte e quelle di classe 4 snelle.", "Le sezioni di classe 1 si definiscono duttili, quelle di classe 2 compatte, quelle di classe 3 semi-compatte e quelle di classe 4 snelle."),
        textBlock("4.2.3.1", "editorial-010", "paragraph", { ...p98, wrap: true, discretionaryHyphen: true }, region(82.956, 246.812, 428.681, 17.597), "Per i casi più comuni delle forme delle sezioni e delle modalità di sollecitazione, le seguenti Tabelle 4.2.III, 4.2.IV e 4.2.V fornisco-\nno indicazioni per la classificazione delle sezioni.", "Per i casi più comuni delle forme delle sezioni e delle modalità di sollecitazione, le seguenti Tabelle 4.2.III, 4.2.IV e 4.2.V forniscono indicazioni per la classificazione delle sezioni."),
        textBlock("4.2.3.1", "editorial-011", "paragraph", { ...p98 }, region(82.956, 269.489, 374.874, 7.482), "La classe di una sezione composta corrisponde al valore di classe più alto tra quelli dei suoi elementi componenti.", "La classe di una sezione composta corrisponde al valore di classe più alto tra quelli dei suoi elementi componenti."),
        tableBlock("4.2.3.1", "editorial-012", t4_2_iii, { ...p98, manual: true }, region(82.954, 290.121, 276, 300)),
        tableBlock("4.2.3.1", "editorial-013", t4_2_iv, { ...p99, manual: true }, region(82.954, 98.881, 276, 210)),
        tableBlock("4.2.3.1", "editorial-014", t4_2_v, { ...p99, manual: true }, region(82.955, 318.08, 276, 205)),
    ], [f420], [t4_2_iii, t4_2_iv, t4_2_v]),
    makeUnit("4.2.3.2", "CAPACITÀ RESISTENTE DELLE SEZIONI", [
        textBlock("4.2.3.2", "heading", "heading", { ...p99, manual: true }, region(82.954, 515.0, 180, 7.476), "4.2.3.2 CAPACITÀ RESISTENTE DELLE SEZIONI", "4.2.3.2 CAPACITÀ RESISTENTE DELLE SEZIONI"),
        textBlock("4.2.3.2", "editorial-001", "paragraph", { ...p99, wrap: true, discretionaryHyphen: true }, region(82.954, 527.0, 428.6, 17.6), "La capacità resistente delle sezioni deve essere valutata nei confronti delle sollecitazioni di trazione o compressione, flessione, ta-\nglio e torsione, determinando anche gli effetti indotti sulla resistenza dalla presenza combinata di più sollecitazioni.", "La capacità resistente delle sezioni deve essere valutata nei confronti delle sollecitazioni di trazione o compressione, flessione, taglio e torsione, determinando anche gli effetti indotti sulla resistenza dalla presenza combinata di più sollecitazioni."),
        textBlock("4.2.3.2", "editorial-002", "paragraph", { ...p99 }, region(82.954, 554.714, 249.48, 7.482), "La capacità resistente della sezione si determina con uno dei seguenti metodi.", "La capacità resistente della sezione si determina con uno dei seguenti metodi."),
        textBlock("4.2.3.2", "editorial-003", "paragraph", { ...p99 }, region(82.954, 567.279, 58.269, 7.476), "Metodo elastico (E)", "Metodo elastico (E)"),
        textBlock("4.2.3.2", "editorial-004", "paragraph", { ...p99, wrap: true, discretionaryHyphen: true }, region(82.952, 579.84, 428.584, 25.17), "Si assume un comportamento elastico lineare del materiale, sino al raggiungimento della condizione di snervamento.\nIl metodo può applicarsi a tutte le classi di sezioni, con l’avvertenza di riferirsi al metodo delle sezioni efficaci o a metodi equiva-\nlenti, nel caso di sezioni di classe 4.", "Si assume un comportamento elastico lineare del materiale, sino al raggiungimento della condizione di snervamento. Il metodo può applicarsi a tutte le classi di sezioni, con l’avvertenza di riferirsi al metodo delle sezioni efficaci o a metodi equivalenti, nel caso di sezioni di classe 4."),
        textBlock("4.2.3.2", "editorial-005", "paragraph", { ...p99 }, region(82.954, 610.142, 59.097, 7.476), "Metodo plastico (P)", "Metodo plastico (P)"),
        textBlock("4.2.3.2", "editorial-006", "paragraph", { ...p99 }, region(82.954, 620.203, 351.923, 7.482), "Si assume la completa plasticizzazione del materiale. Il metodo può applicarsi solo a sezioni di classe 1 e 2.", "Si assume la completa plasticizzazione del materiale. Il metodo può applicarsi solo a sezioni di classe 1 e 2."),
        textBlock("4.2.3.2", "editorial-007", "paragraph", { ...p99 }, region(82.954, 632.769, 83.345, 7.476), "Metodo elasto-plastico (EP)", "Metodo elasto-plastico (EP)"),
        textBlock("4.2.3.2", "editorial-008", "paragraph", { ...p99, wrap: true }, region(82.953, 642.83, 428.0, 17.6), "Si assumono legami costitutivi tensione-deformazione del materiale di tipo bilineare o più complessi.\nIl metodo può applicarsi a qualsiasi tipo di sezione.", "Si assumono legami costitutivi tensione-deformazione del materiale di tipo bilineare o più complessi. Il metodo può applicarsi a qualsiasi tipo di sezione."),
    ]),
    makeUnit("4.2.3.3", "METODI DI ANALISI GLOBALE", [
        textBlock("4.2.3.3", "heading", "heading", { ...p99, manual: true }, region(82.954, 676.0, 180, 7.476), "4.2.3.3 METODI DI ANALISI GLOBALE", "4.2.3.3 METODI DI ANALISI GLOBALE"),
        textBlock("4.2.3.3", "editorial-001", "paragraph", { ...p99 }, region(82.954, 688.0, 428.0, 7.482), "L’analisi globale della struttura può essere condotta con uno dei seguenti metodi:", "L’analisi globale della struttura può essere condotta con uno dei seguenti metodi:"),
        textBlock("4.2.3.3", "editorial-002", "paragraph", { ...p99 }, region(82.954, 699.803, 58.269, 7.476), "Metodo elastico (E)", "Metodo elastico (E)"),
        textBlock("4.2.3.3", "editorial-003", "paragraph", { ...p99, wrap: true }, region(82.954, 709.86, 428.0, 17.6), "Si valutano gli effetti delle azioni nell’ipotesi che il legame tensione-deformazione del materiale sia indefinitamente lineare.\nIl metodo è applicabile a strutture composte da sezioni di classe qualsiasi.", "Si valutano gli effetti delle azioni nell’ipotesi che il legame tensione-deformazione del materiale sia indefinitamente lineare. Il metodo è applicabile a strutture composte da sezioni di classe qualsiasi."),
        textBlock("4.2.3.3", "editorial-004", "paragraph", { ...p100, wrap: true }, region(82.954, 98.928, 428.563, 27.667), "La resistenza delle sezioni può essere valutata con il metodo elastico, plastico o elasto-plastico per le sezioni duttili o compatte\n(classe 1 o 2), con il metodo elastico o elasto-plastico per le sezioni semi-compatte o snelle (classe 3 o 4).", "La resistenza delle sezioni può essere valutata con il metodo elastico, plastico o elasto-plastico per le sezioni duttili o compatte (classe 1 o 2), con il metodo elastico o elasto-plastico per le sezioni semi-compatte o snelle (classe 3 o 4)."),
        textBlock("4.2.3.3", "editorial-005", "paragraph", { ...p100 }, region(82.954, 131.684, 59.082, 7.476), "Metodo plastico (P)", "Metodo plastico (P)"),
        textBlock("4.2.3.3", "editorial-006", "paragraph", { ...p100, wrap: true }, region(82.954, 141.75, 428.0, 27.6), "Gli effetti delle azioni si valutano trascurando la deformazione elastica degli elementi strutturali e concentrando le deformazioni\nplastiche nelle sezioni di formazione delle cerniere plastiche.\nIl metodo è applicabile a strutture interamente composte da sezioni di classe 1.", "Gli effetti delle azioni si valutano trascurando la deformazione elastica degli elementi strutturali e concentrando le deformazioni plastiche nelle sezioni di formazione delle cerniere plastiche. Il metodo è applicabile a strutture interamente composte da sezioni di classe 1."),
        textBlock("4.2.3.3", "editorial-007", "paragraph", { ...p100 }, region(82.954, 174.494, 81.398, 7.476), "Metodo elasto-plastico(EP)", "Metodo elasto-plastico(EP)"),
        textBlock("4.2.3.3", "editorial-008", "paragraph", { ...p100, wrap: true }, region(82.954, 184.56, 428.0, 27.6), "Gli effetti delle azioni si valutano introducendo nel modello il legame momento-curvatura delle sezioni ottenuto considerando un\nlegame costitutivo tensione-deformazione di tipo bilineare o più complesso.\nIl metodo è applicabile a strutture composte da sezioni di classe qualsiasi.", "Gli effetti delle azioni si valutano introducendo nel modello il legame momento-curvatura delle sezioni ottenuto considerando un legame costitutivo tensione-deformazione di tipo bilineare o più complesso. Il metodo è applicabile a strutture composte da sezioni di classe qualsiasi."),
        textBlock("4.2.3.3", "editorial-009", "paragraph", { ...p100, wrap: true }, region(82.954, 214.84, 428.0, 17.6), "Le possibili alternative per i metodi di analisi strutturale e di valutazione della capacità resistente flessionale delle sezioni sono\nriassunte nella seguente Tab. 4.2.VI.", "Le possibili alternative per i metodi di analisi strutturale e di valutazione della capacità resistente flessionale delle sezioni sono riassunte nella seguente Tab. 4.2.VI."),
        tableBlock("4.2.3.3", "editorial-010", t4_2_vi, { ...p100, manual: true }, region(82.954, 237.491, 275, 80)),
    ], [], [t4_2_vi]),
    makeUnit("4.2.3.4", "EFFETTI DELLE DEFORMAZIONI", [
        textBlock("4.2.3.4", "heading", "heading", { ...p100, manual: true }, region(82.954, 329.744, 150, 7.476), "4.2.3.4 E FFETTI DELLE DEFORMAZIONI", "4.2.3.4 EFFETTI DELLE DEFORMAZIONI"),
        textBlock("4.2.3.4", "editorial-001", "paragraph", { ...p100 }, region(82.954, 341.7, 220, 7.482), "In generale, è possibile effettuare:", "In generale, è possibile effettuare:"),
        textBlock("4.2.3.4", "editorial-002", "list-item", { ...p100, wrap: true }, region(82.954, 352.6, 428.6, 7.482), "– l’analisi del primo ordine, imponendo l’equilibrio sulla configurazione iniziale della struttura,", "– l’analisi del primo ordine, imponendo l’equilibrio sulla configurazione iniziale della struttura,"),
        textBlock("4.2.3.4", "editorial-003", "list-item", { ...p100, wrap: true }, region(82.954, 365.2, 428.6, 7.482), "– l’analisi del secondo ordine, imponendo l’equilibrio sulla configurazione deformata della struttura.", "– l’analisi del secondo ordine, imponendo l’equilibrio sulla configurazione deformata della struttura."),
        textBlock("4.2.3.4", "editorial-004", "paragraph", { ...p100, wrap: true, discretionaryHyphen: true }, region(82.954, 377.8, 428.6, 17.6), "L’analisi globale può condursi con la teoria del primo ordine nei casi in cui possano ritenersi trascurabili gli effetti delle deforma-\nzioni sull’entità delle sollecitazioni, sui fenomeni di instabilità e su qualsiasi altro rilevante parametro di risposta della struttura.", "L’analisi globale può condursi con la teoria del primo ordine nei casi in cui possano ritenersi trascurabili gli effetti delle deformazioni sull’entità delle sollecitazioni, sui fenomeni di instabilità e su qualsiasi altro rilevante parametro di risposta della struttura."),
        textBlock("4.2.3.4", "editorial-005", "paragraph", { ...p100 }, region(82.954, 401.956, 276.478, 7.482), "Tale condizione si può assumere verificata se risulta soddisfatta la seguente relazione:", "Tale condizione si può assumere verificata se risulta soddisfatta la seguente relazione:"),
        formulaBlock("4.2.3.4", "editorial-006", f421, { ...p100, manual: true }, region(146, 416, 244, 46), "αcr = Fcr/FEd ≥ 10 per l’analisi elastica; αcr = Fcr/FEd ≥ 15 per l’analisi plastica [4.2.1]"),
        textBlock("4.2.3.4", "editorial-007", "paragraph", { ...p100, wrap: true }, region(82.954, 466.0, 428.6, 17.6), "dove αcr è il moltiplicatore dei carichi applicati che induce l’instabilità globale della struttura, FEd è il valore dei carichi di progetto\ne Fcr è il valore del carico instabilizzante calcolato considerando la rigidezza iniziale elastica della struttura.", "dove αcr è il moltiplicatore dei carichi applicati che induce l’instabilità globale della struttura, FEd è il valore dei carichi di progetto e Fcr è il valore del carico instabilizzante calcolato considerando la rigidezza iniziale elastica della struttura.", [text("dove "), math("αcr", "\\alpha_{cr}"), text(" è il moltiplicatore dei carichi applicati che induce l’instabilità globale della struttura, "), math("FEd", "F_{Ed}"), text(" è il valore dei carichi di progetto e "), math("Fcr", "F_{cr}"), text(" è il valore del carico instabilizzante calcolato considerando la rigidezza iniziale elastica della struttura.")]),
    ], [f421]),
    makeUnit("4.2.3.5", "EFFETTO DELLE IMPERFEZIONI", [
        textBlock("4.2.3.5", "heading", "heading", { ...p100, manual: true }, region(82.954, 500.0, 145, 7.476), "4.2.3.5 E FFETTO DELLE IMPERFEZIONI", "4.2.3.5 EFFETTO DELLE IMPERFEZIONI"),
        textBlock("4.2.3.5", "editorial-001", "paragraph", { ...p100, wrap: true, discretionaryHyphen: true }, region(82.954, 512.0, 428.6, 27.7), "Nell’analisi della struttura, in quella dei sistemi di controvento e nel calcolo delle membrature si deve tener conto degli effetti del-\nle imperfezioni geometriche e strutturali quali la mancanza di verticalità o di rettilineità, la mancanza di accoppiamento e le ine-\nvitabili eccentricità minori presenti nei collegamenti reali.", "Nell’analisi della struttura, in quella dei sistemi di controvento e nel calcolo delle membrature si deve tener conto degli effetti delle imperfezioni geometriche e strutturali quali la mancanza di verticalità o di rettilineità, la mancanza di accoppiamento e le inevitabili eccentricità minori presenti nei collegamenti reali."),
        textBlock("4.2.3.5", "editorial-002", "paragraph", { ...p100, wrap: true, discretionaryHyphen: true }, region(82.951, 551.927, 428.626, 27.7), "A tal fine possono adottarsi nell’analisi adeguate imperfezioni geometriche equivalenti, di valore tale da simulare i possibili effet-\nti delle reali imperfezioni da esse sostituite, a meno che tali effetti non siano inclusi implicitamente nel calcolo della resistenza\ndegli elementi strutturali.", "A tal fine possono adottarsi nell’analisi adeguate imperfezioni geometriche equivalenti, di valore tale da simulare i possibili effetti delle reali imperfezioni da esse sostituite, a meno che tali effetti non siano inclusi implicitamente nel calcolo della resistenza degli elementi strutturali."),
        textBlock("4.2.3.5", "editorial-003", "paragraph", { ...p100 }, region(82.954, 584.6, 200, 7.482), "Si devono considerare nel calcolo:", "Si devono considerare nel calcolo:"),
        textBlock("4.2.3.5", "editorial-004", "list-item", { ...p100 }, region(88.586, 597.237, 207.906, 7.482), "– le imperfezioni globali per i telai o per i sistemi di controvento;", "– le imperfezioni globali per i telai o per i sistemi di controvento;"),
        textBlock("4.2.3.5", "editorial-005", "list-item", { ...p100, discretionaryHyphen: true }, region(88.586, 609.843, 155.996, 7.482), "– le imperfezioni locali per i singoli elementi struĴurali.", "– le imperfezioni locali per i singoli elementi strutturali."),
        textBlock("4.2.3.5", "editorial-006", "paragraph", { ...p100, wrap: true }, region(82.952, 622.405, 428.546, 17.6), "Gli effetti delle imperfezioni globali per telai sensibili agli effetti del secondo ordine possono essere riprodotti introducendo un\nerrore iniziale di verticalità della struttura ed una curvatura iniziale degli elementi strutturali costituenti.", "Gli effetti delle imperfezioni globali per telai sensibili agli effetti del secondo ordine possono essere riprodotti introducendo un errore iniziale di verticalità della struttura ed una curvatura iniziale degli elementi strutturali costituenti."),
        textBlock("4.2.3.5", "editorial-007", "paragraph", { ...p100 }, region(82.952, 645.0, 300, 7.482), "L’errore iniziale di verticalità in un telaio può essere trascurato quando:", "L’errore iniziale di verticalità in un telaio può essere trascurato quando:"),
        formulaBlock("4.2.3.5", "editorial-008", f422, { ...p100, manual: true }, region(198, 659, 180, 20), "HEd ≥ 0,15 · QEd [4.2.2]"),
        textBlock("4.2.3.5", "editorial-009", "paragraph", { ...p100, wrap: true }, region(82.952, 683.0, 428.6, 17.6), "dove HEd è la somma delle reazioni orizzontali alla base delle colonne del piano considerato e QEd è la somma delle reazioni verti-\ncali alla base delle colonne del piano stesso.", "dove HEd è la somma delle reazioni orizzontali alla base delle colonne del piano considerato e QEd è la somma delle reazioni verticali alla base delle colonne del piano stesso.", [text("dove "), math("HEd", "H_{Ed}"), text(" è la somma delle reazioni orizzontali alla base delle colonne del piano considerato e "), math("QEd", "Q_{Ed}"), text(" è la somma delle reazioni verticali alla base delle colonne del piano stesso.")]),
        textBlock("4.2.3.5", "editorial-010", "paragraph", { ...p101, wrap: true, discretionaryHyphen: true }, region(82.954, 98.928, 428.507, 27.7), "Nell’analisi dei sistemi di controvento che devono garantire la stabilità laterale di travi inflesse o elementi compressi, gli effetti\ndelle imperfezioni globali devono essere riprodotti introducendo, sotto forma di errore di rettilineità iniziale, un’imperfezione\ngeometrica equivalente dell’elemento da vincolare.", "Nell’analisi dei sistemi di controvento che devono garantire la stabilità laterale di travi inflesse o elementi compressi, gli effetti delle imperfezioni globali devono essere riprodotti introducendo, sotto forma di errore di rettilineità iniziale, un’imperfezione geometrica equivalente dell’elemento da vincolare."),
        textBlock("4.2.3.5", "editorial-011", "paragraph", { ...p101, wrap: true, discretionaryHyphen: true }, region(82.954, 130.0, 428.6, 17.6), "Nella verifica di singoli elementi strutturali, quando non occorra tenere conto degli effetti del secondo ordine, gli effetti delle im-\nperfezioni locali sono da considerarsi inclusi implicitamente nelle formule di verifica di stabilità.", "Nella verifica di singoli elementi strutturali, quando non occorra tenere conto degli effetti del secondo ordine, gli effetti delle imperfezioni locali sono da considerarsi inclusi implicitamente nelle formule di verifica di stabilità."),
    ], [f422]),
];

const manifest = {
    $schema: "urn:structural-codes:schema:asset-manifest:v2",
    schemaVersion: "2.0.0-alpha.1",
    recordType: "asset-manifest",
    document: "ntc2018",
    section: "4.2-step3",
    sourceId,
    status: "transcribed-unreviewed",
    formulas: [
        { id: f420, unitId: unitId("4.2.3.1"), officialNumber: "4.2.0", pdfPage: 97, latex: "C_{\\vartheta}=\\vartheta_r/\\vartheta_y-1" },
        { id: f421, unitId: unitId("4.2.3.4"), officialNumber: "4.2.1", pdfPage: 100, latex: "\\begin{aligned}\\alpha_{cr}&=\\frac{F_{cr}}{F_{Ed}}\\ge10&&\\text{per l’analisi elastica}\\\\\\alpha_{cr}&=\\frac{F_{cr}}{F_{Ed}}\\ge15&&\\text{per l’analisi plastica}\\end{aligned}" },
        { id: f422, unitId: unitId("4.2.3.5"), officialNumber: "4.2.2", pdfPage: 100, latex: "H_{Ed}\\ge0{,}15\\cdot Q_{Ed}" },
    ],
    tables: [tableIII, tableIV, tableV, tableVI],
    figures: [],
};

await mkdir(unitDirectory, { recursive: true });
await mkdir(assetDirectory, { recursive: true });
await mkdir(figureDirectory, { recursive: true });
await Promise.all([
    ...units.map((unit) => writeFile(join(unitDirectory, `${unit.numbering.official}.json`), `${JSON.stringify(unit, null, 2)}\n`, "utf8")),
    writeFile(join(assetDirectory, "4.2-step3.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8"),
    ...Object.values(tableImageSpecs).map(({ source, target }) => copyFile(join(evidenceRenderDirectory, source), join(figureDirectory, target))),
]);

console.log(`NTC 4.2 step3: generate ${units.length} unità, 3 formule, 4 tabelle e ${Object.keys(tableImageSpecs).length} immagini di cella.`);
