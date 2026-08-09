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
const actorId = "codex:ntc43-step2";

type Region = {
    coordinateSystem: "pdf-points-top-left";
    x: number;
    y: number;
    width: number;
    height: number;
};

type Inline = { kind: "text" | "math"; value: string; latex?: string };
type Page = {
    printedPage: string | null;
    textItems: Array<{ sequence: number; text: string; region: Region }>;
};

const pageCache = new Map<number, Page>();
for (const pageNumber of [123, 124, 125, 126, 127]) {
    const file = join(repoRoot, "evidence", sourceId, "pages", `page-${String(pageNumber).padStart(4, "0")}.json`);
    pageCache.set(pageNumber, JSON.parse(readFileSync(file, "utf8")) as Page);
}

const region = (x: number, y: number, width: number, height: number): Region => ({
    coordinateSystem: "pdf-points-top-left",
    x,
    y,
    width,
    height,
});

const unitId = (number: string) => `urn:structural-codes:it:unit:ntc2018:${number}`;
const formulaId = (number: string) => `urn:structural-codes:it:asset:formula:ntc2018:${number}`;
const tableId = (number: string) => `urn:structural-codes:it:asset:table:ntc2018:${number}`;
const figureId = (number: string) => `urn:structural-codes:it:asset:figure:ntc2018:${number}`;

const t = (value: string): Inline => ({ kind: "text", value });
const m = (value: string, latex = value): Inline => ({ kind: "math", value, latex });

function rawFor(pageNumber: number, blockRegion: Region): string {
    const page = pageCache.get(pageNumber);
    if (page === undefined) throw new Error(`evidence mancante per pagina ${pageNumber}`);
    return page.textItems
        .filter((item) => {
            const bottom = item.region.y + item.region.height;
            const right = item.region.x + item.region.width;
            return item.text.length > 0 &&
                item.region.y < blockRegion.y + blockRegion.height &&
                bottom > blockRegion.y &&
                item.region.x < blockRegion.x + blockRegion.width &&
                right > blockRegion.x;
        })
        .sort((left, right) => left.sequence - right.sequence)
        .map((item) => item.text)
        .join(" ");
}

function transformations(options: { wrap?: boolean; hyphen?: boolean; control?: boolean; manual?: boolean } = {}) {
    const result: Array<{ operation: string; ruleVersion: string; note: string }> = [];
    if (options.control) {
        result.push({ operation: "remove-control-character", ruleVersion: profile, note: "Rimossi i caratteri di controllo privi di resa visuale dall’estrazione ufficiale." });
    }
    if (options.hyphen) {
        result.push({ operation: "remove-discretionary-hyphen", ruleVersion: profile, note: "Ricomposte le parole spezzate dal trattino tipografico a fine riga dopo confronto con il render." });
    }
    if (options.wrap) {
        result.push({ operation: "join-line-wrap", ruleVersion: profile, note: "Unite le righe appartenenti allo stesso capoverso; i capoversi distinti restano blocchi separati." });
        result.push({ operation: "normalize-whitespace", ruleVersion: profile, note: "Uniformati gli spazi dopo la ricomposizione delle righe." });
    }
    if (options.manual) {
        result.push({ operation: "manual-correction", ruleVersion: profile, note: "Ripristinati accenti, apostrofi, simboli matematici e sillabazioni confrontati con il render della fonte ufficiale." });
    }
    if (options.wrap || options.manual) {
        result.push({ operation: "unicode-nfc", ruleVersion: profile, note: "Testo normalizzato in Unicode NFC." });
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
    inline: Inline[] = [t(normalized)],
    options: { wrap?: boolean; hyphen?: boolean; control?: boolean; manual?: boolean } = { wrap: true, manual: true },
) {
    const raw = rawFor(page, blockRegion) || normalized;
    const inlineValue = inline.length === 0 ? [t(normalized)] : inline;
    return {
        blockId: `${unitId(number)}#block-${suffix}`,
        kind,
        origin: "official",
        text: { raw, normalized, normalizationVersion: profile, inline: inlineValue },
        evidence: evidence(page, blockRegion, raw, normalized, "pdf-text", options),
    };
}

function heading(number: string, title: string, page: number, blockRegion: Region) {
    return textBlock(number, "heading", "heading", page, blockRegion, `${number} ${title}`, [t(`${number} ${title}`)], { manual: true });
}

function formulaRef(unitNumber: string, formulaNumber: string, suffix: string, page: number, blockRegion: Region) {
    const id = formulaId(formulaNumber);
    return {
        blockId: `${unitId(unitNumber)}#block-${suffix}`,
        kind: "formula-ref",
        origin: "official",
        assetId: id,
        evidence: evidence(page, blockRegion, id, id, "manual-transcription", { manual: true }),
    };
}

function assetRef(unitNumber: string, suffix: string, kind: "table-ref" | "figure-ref", id: string, page: number, blockRegion: Region) {
    return {
        blockId: `${unitId(unitNumber)}#block-${suffix}`,
        kind,
        origin: "official",
        assetId: id,
        evidence: evidence(page, blockRegion, id, id, "manual-transcription", { manual: true }),
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

function makeUnit(number: string, title: string, kind: "section" | "subparagraph", blocks: unknown[], assets: { formulaIds: string[]; tableIds: string[]; figureIds: string[] }) {
    return {
        $schema: "urn:structural-codes:schema:canonical-unit:v2",
        schemaVersion: "2.0.0-alpha.2",
        recordType: "canonical-unit",
        id: unitId(number),
        workId,
        expressionId,
        kind,
        numbering: { official: number, sortKey: number.split(".").map((part) => part.padStart(3, "0")).join(".") },
        title,
        titleBlockId: `${unitId(number)}#block-heading`,
        hierarchy: { parentId: parent(number), ancestorIds: ancestors(number), position: Number(number.split(".").at(-1)) },
        validity: { from: "2018-03-22", to: null, status: "in-force", asOf: "2026-08-09" },
        blocks,
        citations: [],
        relations: [],
        assets,
        workflow: {
            status: "extracted",
            createdBy: { actorId, kind: "automated-agent", toolVersion: profile },
            createdAt,
            reviews: [],
            openIssues: [
                { issueId: `ntc2018-${number.replaceAll(".", "-")}-source-review`, type: "normalization-review", severity: "blocking", note: "Record trascritto dall’evidence ufficiale ma non ancora confrontato integralmente da un revisore umano con il render della fonte." },
                ...(assets.formulaIds.length + assets.tableIds.length + assets.figureIds.length > 0
                    ? [{ issueId: `ntc2018-${number.replaceAll(".", "-")}-assets`, type: "asset-review", severity: "blocking", note: "Formule, tabelle e figure sono state separate e collocate; resta obbligatoria la revisione umana puntuale sulla fonte ufficiale." }]
                    : []),
            ],
        },
    };
}

const p123 = {
    h33: region(82, 160, 430, 18), formula36: region(185, 185, 190, 28), intro36: region(82, 176, 430, 20), dove36: region(82, 212, 430, 20), assume: region(82, 225, 430, 18), gammaC: region(82, 239, 430, 18), gammaA: region(82, 252, 430, 18), gammaS: region(82, 266, 430, 18), gammaV: region(82, 279, 430, 18), sles: region(82, 293, 430, 18), exceptional: region(82, 307, 430, 18), materials: region(82, 320, 430, 40), h331: region(82, 360, 430, 18), h3311: region(82, 383, 430, 18), steel1: region(82, 397, 430, 18), steel2: region(82, 410, 430, 18), steel3: region(82, 423, 430, 18), steel4: region(82, 436, 430, 18), h3312: region(82, 464, 430, 18), conc1: region(82, 479, 430, 18), conc2: region(82, 500, 430, 28), conc3: region(82, 532, 430, 30), conc4: region(82, 557, 430, 30), conc5: region(82, 588, 430, 18), h34: region(82, 611, 430, 18), h341: region(82, 633, 430, 18), beam1: region(82, 648, 430, 18), beam2: region(82, 660, 430, 30),
};
const p124 = {
    fig33: region(75, 80, 450, 90), h342: region(82, 169, 430, 18), para342: region(82, 183, 430, 28), h3421: region(82, 222, 430, 18), flex1: region(82, 237, 430, 18), flex2: region(82, 259, 430, 18), flex3: region(82, 282, 430, 22), h34211: region(82, 307, 430, 18), elastic: region(82, 320, 430, 30), h34212: region(82, 357, 430, 18), plastic: region(82, 370, 430, 25), h34213: region(82, 396, 430, 18), elasto: region(82, 409, 430, 38), h3422: region(82, 457, 430, 18), shear: region(82, 471, 430, 22), h343: region(82, 502, 430, 20), c3431: region(82, 516, 430, 22), c3432: region(82, 539, 430, 22), c3433: region(82, 561, 430, 22), c3434: region(82, 582, 430, 30), c3435: region(82, 612, 430, 38), c3436: region(82, 651, 430, 22), c3437: region(82, 675, 430, 38), listIntro: region(82, 715, 430, 18),
};
const p125 = {
    list1: region(82, 95, 430, 18), list2: region(82, 106, 430, 18), list3: region(82, 117, 430, 18), list4: region(82, 128, 430, 18), method: region(82, 142, 430, 25), h3431: region(82, 172, 430, 18), h34311: region(82, 190, 430, 18), dutile1: region(82, 201, 430, 22), dutile2: region(82, 224, 430, 30), listA: region(82, 256, 430, 18), listB: region(82, 267, 430, 18), listC: region(82, 278, 430, 18), listD: region(82, 289, 430, 18), listE: region(82, 301, 430, 18), listF: region(82, 313, 430, 18), etaIntro: region(82, 326, 430, 20), f37: region(130, 338, 300, 48), doveLe: region(82, 391, 430, 20), alternative: region(82, 405, 430, 30), f38: region(130, 438, 300, 48), general: region(82, 493, 430, 18), h34312: region(82, 509, 430, 18), connectorIntro: region(82, 521, 430, 25), f39: region(175, 540, 190, 25), f310: region(165, 557, 220, 25), dove: region(82, 573, 430, 18), gammaV: region(82, 584, 430, 18), ftk: region(82, 597, 430, 25), fck: region(82, 611, 430, 18), Ecm: region(82, 624, 430, 18), diameter: region(82, 638, 430, 18), hsc: region(82, 651, 430, 18), f311a: region(75, 658, 300, 24), f311b: region(75, 672, 300, 24), reduction: region(82, 688, 430, 30),
};
const p126 = {
    f313: region(150, 94, 280, 25), dove313: region(82, 113, 430, 20), fig34a: region(82, 135, 440, 64), transverse: region(82, 200, 430, 20), f314: region(145, 207, 280, 25), dove314: region(82, 225, 430, 40), table34: region(82, 276, 430, 76), fig34b: region(82, 369, 440, 75), h3432: region(82, 449, 430, 18), otherConnectors: region(82, 463, 430, 25), h3433: region(82, 493, 430, 18), shear1: region(82, 507, 430, 25), shear2: region(82, 530, 430, 18), shear3: region(82, 542, 430, 25), shear4: region(82, 565, 430, 30), h3434: region(82, 605, 430, 20), detail1: region(82, 619, 430, 30), detail2: region(82, 651, 430, 30), detail3: region(82, 682, 430, 20),
};
const p127 = { detail4: region(82, 95, 430, 30) };

const formulaAssets = [
    { id: formulaId("4.3.6"), unitId: unitId("4.3.3"), officialNumber: "4.3.6", pdfPage: 123, latex: "f_d=\\frac{f_k}{\\gamma_M}" },
    { id: formulaId("4.3.7"), unitId: unitId("4.3.4.3.1.1"), officialNumber: "4.3.7", pdfPage: 125, latex: "\\begin{aligned}\\eta&\\ge\\max\\left\\{\\left[1-\\left(\\frac{355}{f_{yk}}\\right)\\left(1.0-0.04L_e\\right)\\right];0.4\\right\\}&&\\text{per }L_e\\le25\\,\\mathrm{m}\\\\\\eta&\\ge1&&\\text{per }L_e>25\\,\\mathrm{m}\\end{aligned}" },
    { id: formulaId("4.3.8"), unitId: unitId("4.3.4.3.1.1"), officialNumber: "4.3.8", pdfPage: 125, latex: "\\begin{aligned}\\eta&\\ge\\max\\left\\{\\left[1-\\left(\\frac{355}{f_{yk}}\\right)\\left(0.75-0.03L_e\\right)\\right];0.4\\right\\}&&\\text{per }L_e\\le25\\,\\mathrm{m}\\\\\\eta&\\ge1&&\\text{per }L_e>25\\,\\mathrm{m}\\end{aligned}" },
    { id: formulaId("4.3.9"), unitId: unitId("4.3.4.3.1.2"), officialNumber: "4.3.9", pdfPage: 125, latex: "P_{Rd,a}=0.8f_{tk}\\left(\\pi d^2/4\\right)/\\gamma_V" },
    { id: formulaId("4.3.10"), unitId: unitId("4.3.4.3.1.2"), officialNumber: "4.3.10", pdfPage: 125, latex: "P_{Rd,c}=0.29\\alpha d^2\\left(f_{ck}E_{cm}\\right)^{0.5}/\\gamma_V" },
    { id: formulaId("4.3.11.a"), unitId: unitId("4.3.4.3.1.2"), officialNumber: "4.3.11 a", pdfPage: 125, latex: "\\alpha=0.2\\left(h_{sc}/d+1\\right)\\quad\\text{per }3\\le h_{sc}/d\\le4" },
    { id: formulaId("4.3.11.b"), unitId: unitId("4.3.4.3.1.2"), officialNumber: "4.3.11 b", pdfPage: 125, latex: "\\alpha=1.0\\quad\\text{per }h_{sc}/d>4" },
    { id: formulaId("4.3.13"), unitId: unitId("4.3.4.3.1.2"), officialNumber: "4.3.13", pdfPage: 126, latex: "k_l=0.6\\,b_0\\left(h_{sc}-h_p\\right)/h_p^2\\le1.0" },
    { id: formulaId("4.3.14"), unitId: unitId("4.3.4.3.1.2"), officialNumber: "4.3.14", pdfPage: 126, latex: "k_t=0.7\\,b_0\\left(h_{sc}-h_p\\right)/h_p^2/\\sqrt{n_r}" },
];

const tableAsset = {
    id: tableId("4.3.ii"), unitId: unitId("4.3.4.3.1.2"), officialNumber: "4.3.II", pdfPage: 126,
    caption: "Limiti superiori del coefficiente k_t", columnCount: 4,
    headers: [[
        { text: "Numero di pioli per greca" },
        { text: "Spessore della lamiera" },
        { text: "Connettori con φ≤20mm e saldati attraverso la lamiera", latex: "\\text{Connettori con }\\varphi\\le20\\,\\mathrm{mm}\\text{ e saldati attraverso la lamiera}" },
        { text: "Lamiera con fori e pioli saldati sul profilo – diametro pioli 19 o 22 mm" },
    ]],
    rows: [
        [{ text: "Nr=1", rowSpan: 2 }, { text: "≤1,0", latex: "\\le1.0" }, { text: "0,85" }, { text: "0,75" }],
        [{ text: ">1,0", latex: ">1.0" }, { text: "1,00" }, { text: "0,75" }],
        [{ text: "Nr=2", rowSpan: 2 }, { text: "≤1,0", latex: "\\le1.0" }, { text: "0,70" }, { text: "0,60" }],
        [{ text: ">1,0", latex: ">1.0" }, { text: "0,80" }, { text: "0,60" }],
    ],
    notes: ["Tabella trascritta dal render ufficiale; revisione umana cella per cella ancora obbligatoria."],
};

const figureAssets = [
    { id: figureId("4.3.3"), unitId: unitId("4.3.4.1"), officialNumber: "4.3.3", pdfPage: 124, caption: "Tipologie di sezione composte per travi", alt: "Tipologie grafiche di sezioni composte per travi.", filename: "fig4.3.3.png", imagePath: "figures/ntc2018/fig4.3.3.png", region: p124.fig33 },
    { id: figureId("4.3.4.a"), unitId: unitId("4.3.4.3.1.2"), officialNumber: "4.3.4(a)", pdfPage: 126, caption: "Disposizione della lamiera grecata rispetto al profilo in acciaio", alt: "Disposizione della lamiera grecata rispetto al profilo in acciaio, configurazione a.", filename: "fig4.3.4a.png", imagePath: "figures/ntc2018/fig4.3.4a.png", region: p126.fig34a },
    { id: figureId("4.3.4.b"), unitId: unitId("4.3.4.3.1.2"), officialNumber: "4.3.4(b)", pdfPage: 126, caption: "Disposizione della lamiera grecata rispetto al profilo in acciaio", alt: "Disposizione della lamiera grecata rispetto al profilo in acciaio, configurazione b.", filename: "fig4.3.4b.png", imagePath: "figures/ntc2018/fig4.3.4b.png", region: p126.fig34b },
];

const units = [
    makeUnit("4.3.3", "RESISTENZE DI PROGETTO", "section", [
        heading("4.3.3", "RESISTENZE DI PROGETTO", 123, p123.h33),
        textBlock("4.3.3", "p-001", "paragraph", 123, p123.intro36, "La resistenza di progetto dei materiali f_d è definita mediante l’espressione:", [t("La resistenza di progetto dei materiali "), m("f_d", "f_d"), t(" è definita mediante l’espressione:")]),
        formulaRef("4.3.3", "4.3.6", "formula-001", 123, p123.formula36),
        textBlock("4.3.3", "p-002", "paragraph", 123, p123.dove36, "dove f_k è la resistenza caratteristica del materiale.", [t("dove "), m("f_k", "f_k"), t(" è la resistenza caratteristica del materiale.")]),
        textBlock("4.3.3", "p-003", "paragraph", 123, p123.assume, "In particolare, nelle verifiche agli stati limite ultimi si assume γ_M pari a :", [t("In particolare, nelle verifiche agli stati limite ultimi si assume "), m("γ_M", "\\gamma_M"), t(" pari a :")]),
        textBlock("4.3.3", "p-004", "paragraph", 123, p123.gammaC, "γ_C (calcestruzzo) = 1,5 ;", [m("γ_C", "\\gamma_C"), t(" (calcestruzzo) = 1,5 ;")]),
        textBlock("4.3.3", "p-005", "paragraph", 123, p123.gammaA, "γ_A (acciaio da carpenteria) = 1,05 ;", [m("γ_A", "\\gamma_A"), t(" (acciaio da carpenteria) = 1,05 ;")]),
        textBlock("4.3.3", "p-006", "paragraph", 123, p123.gammaS, "γ_S (acciaio da armatura) = 1,15 ;", [m("γ_S", "\\gamma_S"), t(" (acciaio da armatura) = 1,15 ;")]),
        textBlock("4.3.3", "p-007", "paragraph", 123, p123.gammaV, "γ_V (connessioni) = 1,25 .", [m("γ_V", "\\gamma_V"), t(" (connessioni) = 1,25 .")]),
        textBlock("4.3.3", "p-008", "paragraph", 123, p123.sles, "Nelle verifiche agli stati limite di esercizio si assume γ_M = 1.", [t("Nelle verifiche agli stati limite di esercizio si assume "), m("γ_M", "\\gamma_M"), t(" = 1.")]),
        textBlock("4.3.3", "p-009", "paragraph", 123, p123.exceptional, "Nelle verifiche in situazioni di progetto eccezionali si assume γ_M = 1.", [t("Nelle verifiche in situazioni di progetto eccezionali si assume "), m("γ_M", "\\gamma_M"), t(" = 1.")]),
        textBlock("4.3.3", "p-010", "paragraph", 123, p123.materials, "Si assumono per i differenti materiali (acciaio da carpenteria, lamiere grecate, acciaio da armatura, calcestruzzo, ecc.) le resistenze caratteristiche f_k definite nel Capitolo 11 delle presenti norme. Nella presente sezione si indicano con f_yk, f_sk, f_pk e f_ck, rispettivamente, le resistenze caratteristiche dell’acciaio strutturale, delle barre d’armatura, della lamiera grecata e del calcestruzzo.", [t("Si assumono per i differenti materiali (acciaio da carpenteria, lamiere grecate, acciaio da armatura, calcestruzzo, ecc.) le resistenze caratteristiche "), m("f_k", "f_k"), t(" definite nel Capitolo 11 delle presenti norme. Nella presente sezione si indicano con "), m("f_yk", "f_{yk}"), t(", "), m("f_sk", "f_{sk}"), t(", "), m("f_pk", "f_{pk}"), t(" e "), m("f_ck", "f_{ck}"), t(", rispettivamente, le resistenze caratteristiche dell’acciaio strutturale, delle barre d’armatura, della lamiera grecata e del calcestruzzo.")]),
    ], { formulaIds: [formulaId("4.3.6")], tableIds: [], figureIds: [] }),

    makeUnit("4.3.3.1", "MATERIALI", "subparagraph", [heading("4.3.3.1", "MATERIALI", 123, p123.h331)], { formulaIds: [], tableIds: [], figureIds: [] }),
    makeUnit("4.3.3.1.1", "Acciaio", "subparagraph", [
        heading("4.3.3.1.1", "Acciaio", 123, p123.h3311),
        textBlock("4.3.3.1.1", "p-001", "paragraph", 123, p123.steel1, "Per le caratteristiche degli acciai (strutturali, da lamiera grecata e da armatura) utilizzati nelle strutture composte di acciaio e calcestruzzo si deve fare riferimento al § 11.3 delle presenti norme.", [], { wrap: true, hyphen: true, manual: true }),
        textBlock("4.3.3.1.1", "p-002", "paragraph", 123, p123.steel2, "Le prescrizioni generali relative alle saldature, di cui al § 11.3 delle presenti norme, si applicano integralmente."),
        textBlock("4.3.3.1.1", "p-003", "paragraph", 123, p123.steel3, "Per le procedure di saldatura dei connettori ed il relativo controllo si può fare riferimento a normative consolidate."),
        textBlock("4.3.3.1.1", "p-004", "paragraph", 123, p123.steel4, "Nel caso si utilizzino connettori a piolo, l’acciaio deve rispettare le prescrizioni di cui al § 11.3.4.7."),
    ], { formulaIds: [], tableIds: [], figureIds: [] }),
    makeUnit("4.3.3.1.2", "Calcestruzzo", "subparagraph", [
        heading("4.3.3.1.2", "Calcestruzzo", 123, p123.h3312),
        textBlock("4.3.3.1.2", "p-001", "paragraph", 123, p123.conc1, "Le caratteristiche meccaniche del calcestruzzo devono risultare da prove eseguite in conformità alle indicazioni delle presenti norme sulle strutture di calcestruzzo armato ordinario o precompresso."),
        textBlock("4.3.3.1.2", "p-002", "paragraph", 123, p123.conc2, "Nei calcoli statici non può essere considerata né una classe di resistenza del calcestruzzo inferiore a C20/25 né una classe di resistenza superiore a C60/75; per i calcestruzzi con aggregati leggeri, la cui densità non può essere inferiore a 1800 kg/m³, le classi limite sono LC20/22 e LC55/60.", [t("Nei calcoli statici non può essere considerata né una classe di resistenza del calcestruzzo inferiore a C20/25 né una classe di resistenza superiore a C60/75; per i calcestruzzi con aggregati leggeri, la cui densità non può essere inferiore a 1800 kg/m³, le classi limite sono LC20/22 e LC55/60.")]),
        textBlock("4.3.3.1.2", "p-003", "paragraph", 123, p123.conc3, "Per classi di resistenza del calcestruzzo superiori a C45/55 e LC 40/44 si richiede che prima dell’inizio dei lavori venga eseguito uno studio adeguato e che la produzione segua specifiche procedure per il controllo qualità."),
        textBlock("4.3.3.1.2", "p-004", "paragraph", 123, p123.conc4, "Qualora si preveda l’utilizzo di calcestruzzi con aggregati leggeri, si deve considerare che i valori sia del modulo di elasticità sia dei coefficienti di viscosità, ritiro e dilatazione termica dipendono dalle proprietà degli aggregati utilizzati; pertanto i valori da utilizzare sono scelti in base alle proprietà del materiale specifico."),
        textBlock("4.3.3.1.2", "p-005", "paragraph", 123, p123.conc5, "Nel caso si utilizzino elementi prefabbricati, si rinvia alle indicazioni specifiche delle presenti norme."),
    ], { formulaIds: [], tableIds: [], figureIds: [] }),
    makeUnit("4.3.4", "TRAVI CON SOLETTA COLLABORANTE", "section", [heading("4.3.4", "TRAVI CON SOLETTA COLLABORANTE", 123, p123.h34)], { formulaIds: [], tableIds: [], figureIds: [] }),
    makeUnit("4.3.4.1", "TIPOLOGIA DELLE SEZIONI", "subparagraph", [
        heading("4.3.4.1", "TIPOLOGIA DELLE SEZIONI", 123, p123.h341),
        textBlock("4.3.4.1", "p-001", "paragraph", 123, p123.beam1, "Le sezioni resistenti in acciaio delle travi composte, Fig. 4.3.3, si classificano secondo i criteri di cui in § 4.2.3.1."),
        textBlock("4.3.4.1", "p-002", "paragraph", 123, p123.beam2, "Qualora la trave di acciaio sia rivestita dal calcestruzzo, le anime possono essere trattate come vincolate trasversalmente ai fini della classificazione della sezione purché il calcestruzzo sia armato, collegato meccanicamente alla sezione di acciaio e in grado di prevenire l’instabilità dell’anima e di ogni parte della piattabanda compressa nella direzione dell’anima."),
        assetRef("4.3.4.1", "figure-001", "figure-ref", figureId("4.3.3"), 124, p124.fig33),
    ], { formulaIds: [], tableIds: [], figureIds: [figureId("4.3.3")] }),
    makeUnit("4.3.4.2", "RESISTENZA DELLE SEZIONI", "subparagraph", [
        heading("4.3.4.2", "RESISTENZA DELLE SEZIONI", 124, p124.h342),
        textBlock("4.3.4.2", "p-001", "paragraph", 124, p124.para342, "Il presente paragrafo tratta sezioni composte realizzate con profili e soletta collaborante. Metodi e criteri di calcolo per la determinazione delle caratteristiche resistenti di sezione di travi composte rivestite possono essere trovati nel § 6.3 della UNI EN1994-1-1.", [], { wrap: true, hyphen: true, manual: true }),
    ], { formulaIds: [], tableIds: [], figureIds: [] }),
    makeUnit("4.3.4.2.1", "Resistenza a flessione", "subparagraph", [
        heading("4.3.4.2.1", "Resistenza a flessione", 124, p124.h3421),
        textBlock("4.3.4.2.1", "p-001", "paragraph", 124, p124.flex1, "Il momento resistente della sezione composta può essere ricavato utilizzando differenti metodi analogamente a quanto indicato per le costruzioni in acciaio."),
        textBlock("4.3.4.2.1", "p-002", "paragraph", 124, p124.flex2, "La larghezza di soletta collaborante da utilizzare per le verifiche di resistenza delle sezioni può essere determinata secondo le indicazioni del punto 4.3.2.3"),
        textBlock("4.3.4.2.1", "p-003", "paragraph", 124, p124.flex3, "La lamiera grecata utilizzata per la realizzazione dei solai collaboranti e disposta con le greche parallelamente all’asse del profilo in acciaio non deve essere considerata nel calcolo del momento resistente."),
    ], { formulaIds: [], tableIds: [], figureIds: [] }),
    makeUnit("4.3.4.2.1.1", "Metodo elastico", "subparagraph", [
        heading("4.3.4.2.1.1", "Metodo elastico", 124, p124.h34211),
        textBlock("4.3.4.2.1.1", "p-001", "paragraph", 124, p124.elastic, "Il momento resistente elastico è calcolato sulla base di una distribuzione elastica delle tensioni nella sezione. Si deve trascurare il contributo del calcestruzzo teso. Il momento resistente elastico, M_el, è calcolato limitando le deformazioni al limite elastico della resistenza dei materiali: f_cd per il calcestruzzo, f_yd per l’acciaio strutturale e f_sd per le barre d’armatura.", [t("Il momento resistente elastico è calcolato sulla base di una distribuzione elastica delle tensioni nella sezione. Si deve trascurare il contributo del calcestruzzo teso. Il momento resistente elastico, "), m("M_el", "M_{el}"), t(", è calcolato limitando le deformazioni al limite elastico della resistenza dei materiali: "), m("f_cd", "f_{cd}"), t(" per il calcestruzzo, "), m("f_yd", "f_{yd}"), t(" per l’acciaio strutturale e "), m("f_sd", "f_{sd}"), t(" per le barre d’armatura.")]),
    ], { formulaIds: [], tableIds: [], figureIds: [] }),
    makeUnit("4.3.4.2.1.2", "Metodo plastico", "subparagraph", [
        heading("4.3.4.2.1.2", "Metodo plastico", 124, p124.h34212),
        textBlock("4.3.4.2.1.2", "p-001", "paragraph", 124, p124.plastic, "Il momento plastico di progetto, M_pl,Rd, si valuta assumendo tutti i materiali completamente plasticizzati, una tensione di compressione nel calcestruzzo pari a 0,85f_cd, e trascurando la resistenza a trazione del calcestruzzo.", [t("Il momento plastico di progetto, "), m("M_pl,Rd", "M_{pl,Rd}"), t(", si valuta assumendo tutti i materiali completamente plasticizzati, una tensione di compressione nel calcestruzzo pari a 0,85"), m("f_cd", "f_{cd}"), t(", e trascurando la resistenza a trazione del calcestruzzo.")]),
    ], { formulaIds: [], tableIds: [], figureIds: [] }),
    makeUnit("4.3.4.2.1.3", "Metodo elasto-plastico", "subparagraph", [
        heading("4.3.4.2.1.3", "Metodo elasto-plastico", 124, p124.h34213),
        textBlock("4.3.4.2.1.3", "p-001", "paragraph", 124, p124.elasto, "Il momento resistente della sezione è ricavato attraverso una analisi non-lineare in cui sono impiegate le curve tensioni-deformazioni dei materiali. È assunta la conservazione delle sezioni piane. Il metodo è applicabile a sezioni di qualunque classe; è necessario quindi tenere in conto tutte le non linearità presenti, gli eventuali fenomeni di instabilità e il grado di connessione a taglio.", [], { wrap: true, hyphen: true, manual: true }),
    ], { formulaIds: [], tableIds: [], figureIds: [] }),
    makeUnit("4.3.4.2.2", "Resistenza a taglio", "subparagraph", [
        heading("4.3.4.2.2", "Resistenza a taglio", 124, p124.h3422),
        textBlock("4.3.4.2.2", "p-001", "paragraph", 124, p124.shear, "La resistenza a taglio verticale della membratura è affidata interamente alla trave metallica, la cui resistenza è calcolata secondo le formule riportate in §4.2.4.1.2."),
    ], { formulaIds: [], tableIds: [], figureIds: [] }),
    makeUnit("4.3.4.3", "SISTEMI DI CONNESSIONE ACCIAIO-CALCESTRUZZO", "subparagraph", [
        heading("4.3.4.3", "SISTEMI DI CONNESSIONE ACCIAIO-CALCESTRUZZO", 124, p124.h343),
        textBlock("4.3.4.3", "p-001", "paragraph", 124, p124.c3431, "Nelle strutture composte si definiscono sistemi di connessione i dispositivi atti ad assicurare la trasmissione delle forze di scorrimento tra acciaio e calcestruzzo.", [], { wrap: true, hyphen: true, manual: true }),
        textBlock("4.3.4.3", "p-002", "paragraph", 124, p124.c3432, "Per le travi, sull’intera lunghezza devono essere previsti connettori a taglio ed armatura trasversale in grado di trasmettere la forza di scorrimento tra soletta e trave di acciaio, trascurando l’effetto dell’aderenza tra le due parti."),
        textBlock("4.3.4.3", "p-003", "paragraph", 124, p124.c3433, "Il presente paragrafo fornisce indicazioni generali sui sistemi di connessione tra la trave metallica e la soletta in calcestruzzo, e indicazioni specifiche per il calcolo della connessione con connettori duttili."),
        textBlock("4.3.4.3", "p-004", "paragraph", 124, p124.c3434, "Il sistema di connessione si definisce duttile se possiede capacità deformativa sufficiente per giustificare l’ipotesi di comportamento plastico ideale nella struttura considerata; i connettori possono essere classificati “duttili” secondo quanto esposto in § 4.3.4.3.1."),
        textBlock("4.3.4.3", "p-005", "paragraph", 124, p124.c3435, "Il concetto di connessione a completo o parziale ripristino si applica solo a travi nelle quali la verifica di resistenza delle sezioni critiche è effettuata con il metodo plastico. Un sistema di connessione si definisce a completo ripristino quando un incremento di resistenza della connessione non produce un incremento di capacità portante della trave. In caso contrario la connessione viene definita a parziale ripristino."),
        textBlock("4.3.4.3", "p-006", "paragraph", 124, p124.c3436, "Il grado di connessione η è inteso, perciò, come il rapporto tra il numero effettivo di connettori a taglio presenti, N, e il numero di connettori che assicurano il completo sviluppo del momento resistente plastico della sezione composta, N_f.", [t("Il grado di connessione "), m("η", "\\eta"), t(" è inteso, perciò, come il rapporto tra il numero effettivo di connettori a taglio presenti, "), m("N", "N"), t(", e il numero di connettori che assicurano il completo sviluppo del momento resistente plastico della sezione composta, "), m("N_f", "N_f"), t(".")]),
        textBlock("4.3.4.3", "p-007", "paragraph", 124, p124.c3437, "Quando le sezioni di solo acciaio sono duttili o compatte (classe 1 e 2, secondo quanto definito ai §§ 4.2.3.1. e 4.3.4.1.) e sono progettate utilizzando il metodo plastico, si può utilizzare una connessione a taglio a parziale ripristino di resistenza solo se il carico ultimo di progetto è minore di quello che potrebbe essere sopportato dallo stesso elemento progettato con connessioni a completo ripristino di resistenza.", [], { wrap: true, hyphen: true, manual: true }),
        textBlock("4.3.4.3", "p-008", "paragraph", 124, p124.listIntro, "Le diverse tipologie dei connettori possono essere classificate secondo le seguenti categorie:"),
        textBlock("4.3.4.3", "list-001", "list-item", 125, p125.list1, "connessioni a taglio;"),
        textBlock("4.3.4.3", "list-002", "list-item", 125, p125.list2, "connessioni a staffa;"),
        textBlock("4.3.4.3", "list-003", "list-item", 125, p125.list3, "connessioni composte da connettori a taglio e a staffa;"),
        textBlock("4.3.4.3", "list-004", "list-item", 125, p125.list4, "connessioni ad attrito."),
        textBlock("4.3.4.3", "p-009", "paragraph", 125, p125.method, "Nel presente paragrafo sono esposti metodi di calcolo per connessioni a taglio che impiegano pioli con testa in cui la trazione agente sul singolo connettore a taglio risulta minore di 1/10 della sua resistenza ultima.", [], { wrap: true, hyphen: true, manual: true }),
    ], { formulaIds: [], tableIds: [], figureIds: [] }),
    makeUnit("4.3.4.3.1", "Connessioni a taglio con pioli", "subparagraph", [heading("4.3.4.3.1", "Connessioni a taglio con pioli", 125, p125.h3431)], { formulaIds: [], tableIds: [], figureIds: [] }),
    makeUnit("4.3.4.3.1.1", "Disposizione e limitazioni", "subparagraph", [
        heading("4.3.4.3.1.1", "Disposizione e limitazioni", 125, p125.h34311),
        textBlock("4.3.4.3.1.1", "p-001", "paragraph", 125, p125.dutile1, "I connettori a piolo devono essere duttili per consentire l’adozione di un metodo di calcolo plastico della connessione e per applicare il calcolo plastico per la definizione del momento resistente della trave.", [], { wrap: true, hyphen: true, manual: true }),
        textBlock("4.3.4.3.1.1", "p-002", "paragraph", 125, p125.dutile2, "Tale requisito di duttilità della connessione si ritiene soddisfatto se essi hanno una capacità deformativa a taglio superiore a 6 mm, ma tale valore deve essere convalidato da apposite prove o comunque certificato dal produttore dei pioli. In alternativa, il comportamento dei pioli può essere assunto come “duttile” sull’intera luce di una trave d’impalcato se:"),
        textBlock("4.3.4.3.1.1", "list-001", "list-item", 125, p125.listA, "i pioli hanno una altezza minima dopo la saldatura pari a 76 mm ed un diametro pari a 19 mm;"),
        textBlock("4.3.4.3.1.1", "list-002", "list-item", 125, p125.listB, "la sezione in acciaio ad I o H è laminata a caldo;"),
        textBlock("4.3.4.3.1.1", "list-003", "list-item", 125, p125.listC, "quando, nel caso si utilizzino lamiere grecate per il solaio, queste siano continue sulla trave;"),
        textBlock("4.3.4.3.1.1", "list-004", "list-item", 125, p125.listD, "in ogni greca sia disposto un unico piolo;"),
        textBlock("4.3.4.3.1.1", "list-005", "list-item", 125, p125.listE, "la lamiera grecata soddisfi le limitazioni b_0/h_p ≥ 2 e h_p ≤ 60 mm (vedi Figure 4.3.4.a e 4.3.4.b);", [t("la lamiera grecata soddisfi le limitazioni "), m("b_0/h_p", "b_0/h_p"), t(" ≥ 2 e "), m("h_p", "h_p"), t(" ≤ 60 mm (vedi Figure 4.3.4.a e 4.3.4.b);")]),
        textBlock("4.3.4.3.1.1", "list-006", "list-item", 125, p125.listF, "la forza agente in soletta sia calcolata utilizzando il metodo per il calcolo del momento plastico."),
        textBlock("4.3.4.3.1.1", "p-003", "paragraph", 125, p125.etaIntro, "In ogni caso il grado di connessione η, definito al § 4.3.4.3, deve soddisfare le seguenti limitazioni:", [t("In ogni caso il grado di connessione "), m("η", "\\eta"), t(", definito al § 4.3.4.3, deve soddisfare le seguenti limitazioni:")]),
        formulaRef("4.3.4.3.1.1", "4.3.7", "formula-001", 125, p125.f37),
        textBlock("4.3.4.3.1.1", "p-004", "paragraph", 125, p125.doveLe, "dove con L_e si è indicata la distanza, in metri, tra i punti di momento nullo nella parte di trave soggetta a momento positivo.", [t("dove con "), m("L_e", "L_e"), t(" si è indicata la distanza, in metri, tra i punti di momento nullo nella parte di trave soggetta a momento positivo.")]),
        textBlock("4.3.4.3.1.1", "p-005", "paragraph", 125, p125.alternative, "Alternativamente possono essere considerati come “duttili” i pioli aventi altezza non inferiore a 4 volte il loro diametro, un diametro compreso tra 16 mm e 25 mm, saldati su un profilo a piattabande uguali, ed un grado di connessione che rispetta le seguenti limitazioni:", [], { wrap: true, hyphen: true, manual: true }),
        formulaRef("4.3.4.3.1.1", "4.3.8", "formula-002", 125, p125.f38),
        textBlock("4.3.4.3.1.1", "p-006", "paragraph", 125, p125.general, "Per una casistica più generale, si rimanda a normative di comprovata validità."),
    ], { formulaIds: [formulaId("4.3.7"), formulaId("4.3.8")], tableIds: [], figureIds: [] }),
    makeUnit("4.3.4.3.1.2", "Resistenza dei connettori", "subparagraph", [
        heading("4.3.4.3.1.2", "Resistenza dei connettori", 125, p125.h34312),
        textBlock("4.3.4.3.1.2", "p-001", "paragraph", 125, p125.connectorIntro, "La resistenza di progetto a taglio di un piolo dotato di testa, saldato in modo automatico, con collare di saldatura normale, posto in una soletta di calcestruzzo piena può essere assunta pari al minore dei seguenti valori:", [], { wrap: true, hyphen: true, manual: true }),
        formulaRef("4.3.4.3.1.2", "4.3.9", "formula-001", 125, p125.f39),
        formulaRef("4.3.4.3.1.2", "4.3.10", "formula-002", 125, p125.f310),
        textBlock("4.3.4.3.1.2", "p-002", "paragraph", 125, p125.dove, "dove:"),
        textBlock("4.3.4.3.1.2", "p-003", "paragraph", 125, p125.gammaV, "γ_V è il fattore parziale definito al § 4.3.3;", [m("γ_V", "\\gamma_V"), t(" è il fattore parziale definito al § 4.3.3;")]),
        textBlock("4.3.4.3.1.2", "p-004", "paragraph", 125, p125.ftk, "f_tk è la resistenza caratteristica a rottura dell’acciaio del piolo (comunque f_tk ≤ 500 MPa);", [m("f_tk", "f_{tk}"), t(" è la resistenza caratteristica a rottura dell’acciaio del piolo (comunque "), m("f_tk", "f_{tk}"), t(" ≤ 500 MPa);")]),
        textBlock("4.3.4.3.1.2", "p-005", "paragraph", 125, p125.fck, "f_ck è la resistenza cilindrica caratteristica del calcestruzzo della soletta;", [m("f_ck", "f_{ck}"), t(" è la resistenza cilindrica caratteristica del calcestruzzo della soletta;")]),
        textBlock("4.3.4.3.1.2", "p-006", "paragraph", 125, p125.Ecm, "E_cm è il valore medio del modulo elastico secante del calcestruzzo della soletta definito al § 11.2.10.3;", [m("E_cm", "E_{cm}"), t(" è il valore medio del modulo elastico secante del calcestruzzo della soletta definito al § 11.2.10.3;")]),
        textBlock("4.3.4.3.1.2", "p-007", "paragraph", 125, p125.diameter, "d è il diametro del piolo, compreso tra 16 e 25 mm;", [m("d", "d"), t(" è il diametro del piolo, compreso tra 16 e 25 mm;")]),
        textBlock("4.3.4.3.1.2", "p-008", "paragraph", 125, p125.hsc, "h_sc è l’altezza del piolo dopo la saldatura;", [m("h_sc", "h_{sc}"), t(" è l’altezza del piolo dopo la saldatura;")]),
        formulaRef("4.3.4.3.1.2", "4.3.11.a", "formula-003", 125, p125.f311a),
        formulaRef("4.3.4.3.1.2", "4.3.11.b", "formula-004", 125, p125.f311b),
        textBlock("4.3.4.3.1.2", "p-009", "paragraph", 125, p125.reduction, "Nel caso di solette con lamiera grecata la resistenza di progetto dei connettori a piolo, calcolata per la soletta piena, deve essere convenientemente ridotta. Per lamiera disposta con le greche parallelamente all’asse del profilo, la resistenza della connessione a taglio è moltiplicata per il fattore riduttivo:", [], { wrap: true, hyphen: true, manual: true }),
        formulaRef("4.3.4.3.1.2", "4.3.13", "formula-005", 126, p126.f313),
        textBlock("4.3.4.3.1.2", "p-010", "paragraph", 126, p126.dove313, "dove h_sc è l’altezza del connettore, non maggiore di h_p+75mm, e h_sc, h_p e b_0 sono indicati in Fig.4.3.4(a).", [t("dove "), m("h_sc", "h_{sc}"), t(" è l’altezza del connettore, non maggiore di "), m("h_p+75mm", "h_p+75\\,\\mathrm{mm}"), t(", e "), m("h_sc", "h_{sc}"), t(", "), m("h_p", "h_p"), t(" e "), m("b_0", "b_0"), t(" sono indicati in Fig.4.3.4(a).")]),
        assetRef("4.3.4.3.1.2", "figure-001", "figure-ref", figureId("4.3.4.a"), 126, p126.fig34a),
        textBlock("4.3.4.3.1.2", "p-011", "paragraph", 126, p126.transverse, "Se le greche sono orientate trasversalmente al profilo in acciaio (fig. 4.3.4(b)), il fattore riduttivo è"),
        formulaRef("4.3.4.3.1.2", "4.3.14", "formula-006", 126, p126.f314),
        textBlock("4.3.4.3.1.2", "p-012", "paragraph", 126, p126.dove314, "dove n_r è il numero dei pioli posti dentro ogni greca. La (4.3.14) può essere utilizzata solo se f_tk del connettore è inferiore a 450 MPa. Il valore di k_t deve essere sempre inferiore ai valori riportati nella Tab. 4.3.II; l’espressione di k_t è valida se h_p≤85mm e b_0≥h_p e con connettori di diametro massimo pari a 20 mm nel caso di saldatura attraverso la lamiera e pari a 22 mm nel caso di lamiera forata.", [t("dove "), m("n_r", "n_r"), t(" è il numero dei pioli posti dentro ogni greca. La (4.3.14) può essere utilizzata solo se "), m("f_tk", "f_{tk}"), t(" del connettore è inferiore a 450 MPa. Il valore di "), m("k_t", "k_t"), t(" deve essere sempre inferiore ai valori riportati nella Tab. 4.3.II; l’espressione di "), m("k_t", "k_t"), t(" è valida se "), m("h_p", "h_p"), t("≤85mm e "), m("b_0", "b_0"), t("≥"), m("h_p", "h_p"), t(" e con connettori di diametro massimo pari a 20 mm nel caso di saldatura attraverso la lamiera e pari a 22 mm nel caso di lamiera forata.")], { wrap: true, hyphen: true, manual: true }),
        assetRef("4.3.4.3.1.2", "table-001", "table-ref", tableId("4.3.ii"), 126, p126.table34),
        assetRef("4.3.4.3.1.2", "figure-002", "figure-ref", figureId("4.3.4.b"), 126, p126.fig34b),
    ], { formulaIds: [formulaId("4.3.9"), formulaId("4.3.10"), formulaId("4.3.11.a"), formulaId("4.3.11.b"), formulaId("4.3.13"), formulaId("4.3.14")], tableIds: [tableId("4.3.ii")], figureIds: [figureId("4.3.4.a"), figureId("4.3.4.b")] }),
    makeUnit("4.3.4.3.2", "Altri tipi di connettori", "subparagraph", [
        heading("4.3.4.3.2", "Altri tipi di connettori", 126, p126.h3432),
        textBlock("4.3.4.3.2", "p-001", "paragraph", 126, p126.otherConnectors, "Per altri tipi di connettori, quali connettori a pressione, uncini e cappi, connettori rigidi nelle solette piene, la resistenza a taglio si deve valutare secondo normative di comprovata validità."),
    ], { formulaIds: [], tableIds: [], figureIds: [] }),
    makeUnit("4.3.4.3.3", "Valutazione delle sollecitazioni di taglio agenti sul sistema di connessione", "subparagraph", [
        heading("4.3.4.3.3", "Valutazione delle sollecitazioni di taglio agenti sul sistema di connessione", 126, p126.h3433),
        textBlock("4.3.4.3.3", "p-001", "paragraph", 126, p126.shear1, "Ai fini della progettazione della connessione, la forza di scorrimento per unità di lunghezza può essere calcolata impiegando l’analisi lineare elastica, l’analisi non lineare o, nel caso di connettori duttili, la teoria plastica.", [], { wrap: true, hyphen: true, manual: true }),
        textBlock("4.3.4.3.3", "p-002", "paragraph", 126, p126.shear2, "Nel caso di analisi elastica, le verifiche devono essere condotte su ogni singolo connettore."),
        textBlock("4.3.4.3.3", "p-003", "paragraph", 126, p126.shear3, "Per connessioni duttili a completo ripristino, la massima forza totale di scorrimento di progetto, V_ld che deve essere contrastata da connettori distribuiti tra le sezioni critiche, si determina con equazioni di equilibrio plastico.", [t("Per connessioni duttili a completo ripristino, la massima forza totale di scorrimento di progetto, "), m("V_ld", "V_{ld}"), t(" che deve essere contrastata da connettori distribuiti tra le sezioni critiche, si determina con equazioni di equilibrio plastico.")]),
        textBlock("4.3.4.3.3", "p-004", "paragraph", 126, p126.shear4, "Se si utilizza per le sezioni trasversali la teoria elastica, anche la forza di scorrimento per unità di lunghezza deve essere calcolata utilizzando la teoria elastica. Le proprietà statiche della sezione trasversale devono essere uguali a quelle utilizzate nel calcolo delle tensioni normali.", [], { wrap: true, hyphen: true, manual: true }),
    ], { formulaIds: [], tableIds: [], figureIds: [] }),
    makeUnit("4.3.4.3.4", "Dettagli costruttivi della zona di connessione a taglio", "subparagraph", [
        heading("4.3.4.3.4", "Dettagli costruttivi della zona di connessione a taglio", 126, p126.h3434),
        textBlock("4.3.4.3.4", "p-001", "paragraph", 126, p126.detail1, "Il copriferro al di sopra dei connettori a piolo deve essere almeno 20 mm. Lo spessore del piatto a cui il connettore è saldato deve essere sufficiente per l’esecuzione della saldatura e per una efficace trasmissione delle azioni di taglio. La distanza minima tra il connettore e il bordo della piattabanda cui è collegato deve essere almeno 20 mm.", [], { wrap: true, hyphen: true, manual: true }),
        textBlock("4.3.4.3.4", "p-002", "paragraph", 126, p126.detail2, "L’altezza complessiva del piolo dopo la saldatura deve essere almeno 3 volte il diametro del gambo del piolo d. La testa del piolo deve avere diametro pari ad almeno 1,5 d e spessore pari ad almeno 0,4 d. Quando i connettori a taglio sono soggetti ad azioni che inducono sollecitazioni di fatica, il diametro del piolo non deve eccedere 1,5 volte lo spessore del piatto a cui è collegato.", [t("L’altezza complessiva del piolo dopo la saldatura deve essere almeno 3 volte il diametro del gambo del piolo "), m("d", "d"), t(". La testa del piolo deve avere diametro pari ad almeno 1,5 "), m("d", "d"), t(" e spessore pari ad almeno 0,4 "), m("d", "d"), t(". Quando i connettori a taglio sono soggetti ad azioni che inducono sollecitazioni di fatica, il diametro del piolo non deve eccedere 1,5 volte lo spessore del piatto a cui è collegato.")]),
        textBlock("4.3.4.3.4", "p-003", "paragraph", 126, p126.detail3, "Quando i connettori a piolo sono saldati sull’ala, in corrispondenza dell’anima del profilo in acciaio, il loro diametro non deve essere superiore a 2,5 volte lo spessore dell’ala.", [], { wrap: true, hyphen: true, manual: true }),
        textBlock("4.3.4.3.4", "p-004", "paragraph", 127, p127.detail4, "Quando i connettori sono utilizzati con le lamiere grecate per la realizzazione degli impalcati negli edifici, l’altezza nominale del connettore deve sporgere non meno di 2 volte il diametro del gambo al di sopra della lamiera grecata. La larghezza minima della greca che può essere utilizzata negli edifici è di 50 mm.", [], { wrap: true, hyphen: true, manual: true }),
    ], { formulaIds: [], tableIds: [], figureIds: [] }),
];

const manifest = {
    $schema: "urn:structural-codes:schema:asset-manifest:v2",
    schemaVersion: "2.0.0-alpha.1",
    recordType: "asset-manifest",
    document: "ntc2018",
    section: "4.3-step2",
    sourceId,
    status: "transcribed-unreviewed",
    formulas: formulaAssets,
    tables: [tableAsset],
    figures: await Promise.all(figureAssets.map(async (asset) => {
        const { filename, ...manifestAsset } = asset;
        return { ...manifestAsset, sha256: await sha256OfFile(join(figureDirectory, filename)) };
    })),
};

mkdirSync(unitDirectory, { recursive: true });
mkdirSync(assetDirectory, { recursive: true });
for (const unit of units) writeFileSync(join(unitDirectory, `${unit.numbering.official}.json`), `${JSON.stringify(unit, null, 2)}\n`, "utf8");
writeFileSync(join(assetDirectory, "4.3-step2.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(`NTC 4.3 step2: generate ${units.length} unità e ${formulaAssets.length} formule, 1 tabella, ${figureAssets.length} figure.`);
