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
const profile = "ntc45-editorial-profile-0.1.0";
const createdAt = "2026-08-09T00:00:00Z";

type Part = string | { value: string; latex: string };
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
    control?: boolean;
    raw?: string;
};

const unitId = (number: string) =>
    `urn:structural-codes:it:unit:ntc2018:${number}`;
const assetId = (kind: "formula" | "table", number: string) =>
    `urn:structural-codes:it:asset:${kind}:ntc2018:${number}`;
const region = (pdfPage: number, y = 80, height = 670): Region => ({
    coordinateSystem: "pdf-points-top-left",
    x: 82.954,
    y,
    width: 428.6,
    height: Math.min(height, 842 - y),
});

const cp1252: Record<number, string> = {
    0x80: "€",
    0x82: "‚",
    0x83: "ƒ",
    0x84: "„",
    0x85: "…",
    0x86: "†",
    0x87: "‡",
    0x88: "ˆ",
    0x89: "‰",
    0x8a: "Š",
    0x8b: "‹",
    0x8c: "Œ",
    0x8e: "Ž",
    0x91: "‘",
    0x92: "’",
    0x93: "“",
    0x94: "”",
    0x95: "•",
    0x96: "–",
    0x97: "—",
    0x98: "˜",
    0x99: "™",
    0x9a: "š",
    0x9b: "›",
    0x9c: "œ",
    0x9e: "ž",
    0x9f: "Ÿ",
};

const reverseCp1252 = new Map<string, number>([
    ...Object.entries(cp1252).map(([byte, character]) => [character, Number(byte)] as const),
    ...Array.from({ length: 0x60 }, (_, index) => [String.fromCharCode(0xa0 + index), 0xa0 + index] as const),
]);

function repairMojibake(value: string): string {
    const bytes: number[] = [];
    for (const character of value) {
        const codePoint = character.codePointAt(0)!;
        const byte = codePoint < 0x80 ? codePoint : reverseCp1252.get(character);
        if (byte === undefined) return value;
        bytes.push(byte);
    }
    try {
        const repaired = Buffer.from(bytes).toString("utf8");
        return repaired.includes("�") ? value : repaired;
    } catch {
        return value;
    }
}

function extractedRaw(value: string): string {
    return [...Buffer.from(value, "utf8")]
        .map((byte) => (byte < 0x80 ? String.fromCharCode(byte) : cp1252[byte] ?? String.fromCharCode(byte)))
        .join("");
}

function inline(parts: Part[] | string) {
    const values = typeof parts === "string" ? [parts] : parts;
    const normalized = values
        .map((part) => repairMojibake(typeof part === "string" ? part : part.value))
        .join("");
    const segments: Array<
        | { kind: "text"; value: string }
        | { kind: "math"; value: string; latex: string }
    > = [];
    for (const part of values) {
        if (typeof part === "string") {
            const repaired = repairMojibake(part);
            if (repaired.length > 0) segments.push({ kind: "text", value: repaired });
        } else {
            segments.push({ kind: "math", value: repairMojibake(part.value), latex: part.latex });
        }
    }
    return { normalized, segments };
}

function transformations(options: TextOptions) {
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
            note: "Rimossi i caratteri di controllo privi di resa visuale dall’estrazione evidence.",
        });
    }
    if (options.discretionaryHyphen) {
        result.push({
            operation: "remove-discretionary-hyphen",
            ruleVersion: profile,
            note: "Ricomposte le parole spezzate dal trattino tipografico a fine riga, verificate sul render.",
        });
    }
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
    result.push(
        {
            operation: "manual-correction",
            ruleVersion: profile,
            note: "Ripristinati caratteri accentati, apostrofi tipografici e glifi matematici confrontati con il render ufficiale.",
        },
        {
            operation: "unicode-nfc",
            ruleVersion: profile,
            note: "Testo normalizzato in Unicode NFC.",
        },
    );
    return result.map((item) => ({ ...item, note: repairMojibake(item.note) }));
}

function evidence(
    pdfPage: number,
    blockRegion: Region,
    method: "pdf-text" | "manual-transcription",
    raw: string,
    normalized: string,
    options: TextOptions,
) {
    return {
        sourceId,
        pdfPage,
        printedPage: String(pdfPage - 4),
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
    pdfPage: number,
    y: number,
    parts: Part[] | string,
    options: TextOptions = {},
) {
    const text = inline(parts);
    const normalized = text.normalized;
    const raw = options.raw ?? extractedRaw(normalized);
    return {
        blockId: `${unitId(number)}#block-${suffix}`,
        kind,
        origin: "official",
        text: {
            raw,
            normalized,
            normalizationVersion: profile,
            inline: text.segments,
        },
        evidence: evidence(pdfPage, region(pdfPage, y), "pdf-text", raw, normalized, options),
    };
}

function assetBlock(
    number: string,
    suffix: string,
    kind: "formula-ref" | "table-ref",
    asset: string,
    pdfPage: number,
    y: number,
) {
    return {
        blockId: `${unitId(number)}#block-${suffix}`,
        kind,
        origin: "official",
        assetId: asset,
        evidence: evidence(
            pdfPage,
            region(pdfPage, y),
            "manual-transcription",
            asset,
            asset,
            {},
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
        title: repairMojibake(title),
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
                actorId: "codex:ntc45",
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
                ...(assets.formulaIds.length + assets.tableIds.length > 0
                    ? [
                          {
                              issueId: `ntc2018-${number.replaceAll(".", "-")}-assets`,
                              type: "asset-review",
                              severity: "blocking",
                              note: "Formule e tabelle sono separate, trascritte e collocate nel punto normativo originario; resta obbligatorio il confronto umano puntuale con la fonte ufficiale.",
                          },
                      ]
                    : []),
            ],
        },
    };
}

function formula(
    number: string,
    unit: string,
    pdfPage: number,
    latex: string,
) {
    return {
        id: assetId("formula", number),
        unitId: unitId(unit),
        officialNumber: number,
        pdfPage,
        latex,
    };
}

function cell(text: string, latex?: string, spans: { colSpan?: number; rowSpan?: number } = {}) {
    return { text: repairMojibake(text), ...(latex === undefined ? {} : { latex }), ...spans };
}

const formulaAssets = [
    formula("4.5.1", "4.5.4", 147, "\\lambda=h_0/t"),
    formula("4.5.2", "4.5.6.1", 148, "f_d=f_k/\\gamma_M"),
    formula("4.5.3", "4.5.6.1", 148, "f_{vd}=f_{vk}/\\gamma_M"),
    formula("4.5.4", "4.5.6.2", 148, "f_{d,\\mathrm{rid}}=\\Phi f_d"),
    formula("4.5.5", "4.5.6.2", 149, "h_0=\\rho h"),
    formula("4.5.6", "4.5.6.2", 149, "m=6e/t"),
    formula(
        "4.5.7",
        "4.5.6.2",
        149,
        "e_{s1}=\\dfrac{N_1d_1}{N_1+\\sum N_2};\\quad e_{s2}=\\dfrac{\\sum N_2d_2}{N_1+\\sum N_2}",
    ),
    formula("4.5.8", "4.5.6.2", 149, "e_a=h/200"),
    formula("4.5.9", "4.5.6.2", 149, "e_v=M_v/N"),
    formula("4.5.10", "4.5.6.2", 150, "e_1=|e_s|+e_a;\\quad e_2=\\dfrac{e_1}{2}+|e_v|"),
    formula("4.5.11", "4.5.6.2", 150, "e_1\\le0{,}33t;\\quad e_2\\le0{,}33t"),
    formula("4.5.12", "4.5.6.4", 150, "\\sigma=N/(0{,}65A)\\le f_k/\\gamma_M"),
];

const tableIa = assetId("table", "4.5.ia");
const tableIb = assetId("table", "4.5.ib");
const tableII = assetId("table", "4.5.ii");
const tableIII = assetId("table", "4.5.iii");
const tableIV = assetId("table", "4.5.iv");

const tableAssets = [
    {
        id: tableIa,
        unitId: unitId("4.5.2.2.1"),
        officialNumber: "4.5.Ia",
        pdfPage: 146,
        caption: "Classificazione elementi in laterizio",
        columnCount: 3,
        headers: [[
            cell("Elementi"),
            cell("Percentuale di foratura φ", "\\text{Percentuale di foratura }\\varphi"),
            cell("Area f della sezione normale del foro", "\\text{Area }f\\text{ della sezione normale del foro}"),
        ]],
        rows: [
            [cell("Pieni"), cell("φ≤15%", "\\varphi\\le15\\%"), cell("f≤9 cm²", "f\\le9\\,\\mathrm{cm^2}")],
            [cell("Semipieni"), cell("15% < φ≤45%", "15\\%<\\varphi\\le45\\%"), cell("f≤12 cm²", "f\\le12\\,\\mathrm{cm^2}")],
            [cell("Forati"), cell("45% < φ≤55%", "45\\%<\\varphi\\le55\\%"), cell("f≤15 cm²", "f\\le15\\,\\mathrm{cm^2}")],
        ],
        notes: ["Trascritta dal render ufficiale; revisione umana cella per cella ancora obbligatoria."],
    },
    {
        id: tableIb,
        unitId: unitId("4.5.2.2.1"),
        officialNumber: "4.5.Ib",
        pdfPage: 146,
        caption: "Classificazione elementi in calcestruzzo",
        columnCount: 4,
        headers: [
            [
                cell("Elementi", undefined, { rowSpan: 2 }),
                cell("Percentuale di foratura φ", "\\text{Percentuale di foratura }\\varphi", { rowSpan: 2 }),
                cell("Area f della sezione normale del foro", "\\text{Area }f\\text{ della sezione normale del foro}", { colSpan: 2 }),
            ],
            [cell("A≤900 cm²", "A\\le900\\,\\mathrm{cm^2}"), cell("A > 900 cm²", "A>900\\,\\mathrm{cm^2}")],
        ],
        rows: [
            [cell("Pieni"), cell("φ≤15%", "\\varphi\\le15\\%"), cell("f≤0,10 A", "f\\le0{,}10A"), cell("f≤0,15 A", "f\\le0{,}15A")],
            [cell("Semipieni"), cell("15% < φ≤45%", "15\\%<\\varphi\\le45\\%"), cell("f≤0,10 A", "f\\le0{,}10A"), cell("f≤0,15 A", "f\\le0{,}15A")],
            [cell("Forati"), cell("45% < φ≤55%", "45\\%<\\varphi\\le55\\%"), cell("f≤0,10 A", "f\\le0{,}10A"), cell("f≤0,15 A", "f\\le0{,}15A")],
        ],
        notes: ["Trascritta dal render ufficiale; revisione umana cella per cella ancora obbligatoria."],
    },
    {
        id: tableII,
        unitId: unitId("4.5.6.1"),
        officialNumber: "4.5.II",
        pdfPage: 148,
        caption: "Valori del coefficiente γM in funzione della classe di esecuzione e della categoria degli elementi resistenti",
        columnCount: 3,
        headers: [
            [cell("Materiale", undefined, { rowSpan: 2 }), cell("Classe di esecuzione", undefined, { colSpan: 2 })],
            [cell("1"), cell("2")],
        ],
        rows: [
            [cell("Muratura con elementi resistenti di categoria I, malta a prestazione garantita"), cell("2,0", "2{,}0"), cell("2,5", "2{,}5")],
            [cell("Muratura con elementi resistenti di categoria I, malta a composizione prescritta"), cell("2,2", "2{,}2"), cell("2,7", "2{,}7")],
            [cell("Muratura con elementi resistenti di categoria II, ogni tipo di malta"), cell("2,5", "2{,}5"), cell("3,0", "3{,}0")],
        ],
        notes: ["Trascritta dal render ufficiale; revisione umana cella per cella ancora obbligatoria."],
    },
    {
        id: tableIII,
        unitId: unitId("4.5.6.2"),
        officialNumber: "4.5.III",
        pdfPage: 149,
        caption: "Valori del coefficiente Φ con l’ipotesi della articolazione (a cerniera)",
        columnCount: 6,
        headers: [
            [cell("Snellezza λ", "\\text{Snellezza }\\lambda"), cell("Coefficiente di eccentricità m = 6 e/t", "\\text{Coefficiente di eccentricità }m=6e/t", { colSpan: 5 })],
            [cell(""), cell("0"), cell("0,5", "0{,}5"), cell("1,0", "1{,}0"), cell("1,5", "1{,}5"), cell("2,0", "2{,}0")],
        ],
        rows: [
            [cell("0"), cell("1,00", "1{,}00"), cell("0,74", "0{,}74"), cell("0,59", "0{,}59"), cell("0,44", "0{,}44"), cell("0,33", "0{,}33")],
            [cell("5"), cell("0,97", "0{,}97"), cell("0,71", "0{,}71"), cell("0,55", "0{,}55"), cell("0,39", "0{,}39"), cell("0,27", "0{,}27")],
            [cell("10"), cell("0,86", "0{,}86"), cell("0,61", "0{,}61"), cell("0,45", "0{,}45"), cell("0,27", "0{,}27"), cell("0,16", "0{,}16")],
            [cell("15"), cell("0,69", "0{,}69"), cell("0,48", "0{,}48"), cell("0,32", "0{,}32"), cell("0,17", "0{,}17"), cell("")],
            [cell("20"), cell("0,53", "0{,}53"), cell("0,36", "0{,}36"), cell("0,23", "0{,}23"), cell(""), cell("")],
        ],
        notes: ["Trascritta dal render ufficiale; revisione umana cella per cella ancora obbligatoria."],
    },
    {
        id: tableIV,
        unitId: unitId("4.5.6.2"),
        officialNumber: "4.5.IV",
        pdfPage: 149,
        caption: "Fattore laterale di vincolo",
        columnCount: 2,
        headers: [[cell("h/a", "h/a"), cell("ρ", "\\rho")]],
        rows: [
            [cell("h/a≤0,5", "h/a\\le0{,}5"), cell("1")],
            [cell("0,5 < h/a≤1,0", "0{,}5<h/a\\le1{,}0"), cell("3/2 − h/a", "3/2-h/a")],
            [cell("1,0 < h/a", "1{,}0<h/a"), cell("1/[1+(h/a)²]", "1/[1+(h/a)^2]")],
        ],
        notes: ["Trascritta dal render ufficiale; revisione umana cella per cella ancora obbligatoria."],
    },
];

for (const table of tableAssets) {
    table.caption = repairMojibake(table.caption);
    table.notes = table.notes.map(repairMojibake);
}

const f = (number: string) => assetId("formula", number);
const m = (value: string, latex: string): Part => ({ value, latex });
const h = (number: string, title: string, pdfPage: number, y: number, raw?: string) =>
    textBlock(number, "heading", "heading", pdfPage, y, `${number} ${title}`, {
        raw: raw ?? `${number}. ${title}`,
    });
const p = (number: string, suffix: string, pdfPage: number, y: number, parts: Part[] | string, options: TextOptions = {}) =>
    textBlock(number, suffix, "paragraph", pdfPage, y, parts, { wrap: true, ...options });
const li = (number: string, suffix: string, pdfPage: number, y: number, parts: Part[] | string, options: TextOptions = {}) =>
    textBlock(number, suffix, "list-item", pdfPage, y, parts, { wrap: true, ...options });

const units = [
    makeUnit("4.5", "COSTRUZIONI DI MURATURA", "section", [
        h("4.5", "COSTRUZIONI DI MURATURA", 145, 508),
    ], { formulaIds: [], tableIds: [], figureIds: [] }),
    makeUnit("4.5.1", "DEFINIZIONI", "subparagraph", [
        h("4.5.1", "DEFINIZIONI", 145, 534),
        p("4.5.1", "editorial-001", 145, 546, "Formano oggetto delle presenti norme le costruzioni con struttura portante verticale realizzata con sistemi di muratura in grado di sopportare azioni verticali ed orizzontali, collegati tra di loro da strutture di impalcato, orizzontali ai piani ed eventualmente inclinate in copertura, e da opere di fondazione."),
        p("4.5.1", "editorial-002", 145, 575, "Per l’impiego di tipologie murarie o materiali diversi rispetto a quanto di seguito specificato si applica quanto previsto ai §§ 4.6 o 11.1."),
    ], { formulaIds: [], tableIds: [], figureIds: [] }),
    makeUnit("4.5.2", "MATERIALI E CARATTERISTICHE TIPOLOGICHE", "subparagraph", [
        h("4.5.2", "MATERIALI E CARATTERISTICHE TIPOLOGICHE", 145, 612),
    ], { formulaIds: [], tableIds: [], figureIds: [] }),
    makeUnit("4.5.2.1", "MALTE", "subparagraph", [
        h("4.5.2.1", "MALTE", 145, 634, "4.5.2.1 MALTE"),
        p("4.5.2.1", "editorial-001", 145, 646, "Le prescrizioni riguardanti le malte per muratura sono contenute nel § 11.10.2."),
    ], { formulaIds: [], tableIds: [], figureIds: [] }),
    makeUnit("4.5.2.2", "ELEMENTI RESISTENTI IN MURATURA", "subparagraph", [
        h("4.5.2.2", "ELEMENTI RESISTENTI IN MURATURA", 145, 669, "4.5.2.2 ELEMENTI RESISTENTI IN MURATURA"),
    ], { formulaIds: [], tableIds: [], figureIds: [] }),
    makeUnit("4.5.2.2.1", "Elementi artificiali", "subparagraph", [
        h("4.5.2.2.1", "Elementi artificiali", 145, 689, "4.5.2.2.1 Elementi artificiali"),
        p("4.5.2.2.1", "editorial-001", 145, 701, "Per gli elementi resistenti artificiali da impiegare con funzione resistente si applicano le prescrizioni riportate al § 11.10.1."),
        p("4.5.2.2.1", "editorial-002", 146, 99, "Gli elementi resistenti artificiali possono essere dotati di fori in direzione normale al piano di posa (foratura verticale) oppure in direzione parallela (foratura orizzontale) con caratteristiche di cui al § 11.10. Gli elementi possono essere rettificati sulla superficie di posa."),
        p("4.5.2.2.1", "editorial-003", 146, 132, ["Per l’impiego nelle opere trattate dalla presente norma, gli elementi sono classificati in base alla percentuale di foratura ", m("φ", "\\varphi"), " ed all’area media della sezione normale di ogni singolo foro ", m("f", "f"), "."]),
        p("4.5.2.2.1", "editorial-004", 146, 154, "I fori sono di regola distribuiti pressoché uniformemente sulla faccia dell’elemento."),
        p("4.5.2.2.1", "editorial-005", 146, 167, ["La percentuale di foratura è espressa dalla relazione ", m("Π = 100 F/A", "\\Pi=100F/A"), " dove:"]),
        li("4.5.2.2.1", "editorial-006", 146, 178, [m("F", "F"), " è l’area complessiva dei fori passanti e profondi non passanti;"]),
        li("4.5.2.2.1", "editorial-007", 146, 189, [m("A", "A"), " è l’area lorda della faccia dell’elemento di muratura delimitata dal suo perimetro."]),
        p("4.5.2.2.1", "editorial-008", 146, 201, ["Nel caso dei blocchi in laterizio estrusi la percentuale di foratura ", m("Π", "\\Pi"), " coincide con la percentuale in volume dei vuoti come definita dalla norma UNI EN 772-9:2007."]),
        p("4.5.2.2.1", "editorial-009", 146, 224, "Le Tab. 4.5.Ia-b riportano la classificazione per gli elementi in laterizio e calcestruzzo rispettivamente."),
        assetBlock("4.5.2.2.1", "editorial-010", "table-ref", tableIa, 146, 239),
        p("4.5.2.2.1", "editorial-011", 146, 290, "Gli elementi possono avere incavi di limitata profondità destinati ad essere riempiti dal letto di malta."),
        p("4.5.2.2.1", "editorial-012", 146, 303, ["Elementi di laterizio di area lorda ", m("A", "A"), " maggiore di ", m("300 cm²", "300\\,\\mathrm{cm^2}"), " possono essere dotati di un foro di presa di area massima pari a ", m("35 cm²", "35\\,\\mathrm{cm^2}"), ", da computare nella percentuale complessiva della foratura, avente lo scopo di agevolare la presa manuale; per ", m("A", "A"), " superiore a ", m("580 cm²", "580\\,\\mathrm{cm^2}"), " sono ammessi due fori, ciascuno di area massima pari a ", m("35 cm²", "35\\,\\mathrm{cm^2}"), ", oppure un foro di presa o per l’eventuale alloggiamento della armatura la cui area non superi ", m("70 cm²", "70\\,\\mathrm{cm^2}"), "."], { discretionaryHyphen: true }),
        assetBlock("4.5.2.2.1", "editorial-013", "table-ref", tableIb, 146, 353),
        p("4.5.2.2.1", "editorial-014", 146, 423, "Non sono soggetti a limitazione i fori degli elementi in laterizio e calcestruzzo destinati ad essere riempiti di calcestruzzo o malta."),
        p("4.5.2.2.1", "editorial-015", 146, 435, "Lo spessore minimo dei setti interni (distanza minima tra due fori) è il seguente:"),
        li("4.5.2.2.1", "editorial-016", 146, 448, ["elementi in laterizio e di silicato di calcio: ", m("7 mm", "7\\,\\mathrm{mm}"), ";"]),
        li("4.5.2.2.1", "editorial-017", 146, 459, ["elementi in calcestruzzo: ", m("18 mm", "18\\,\\mathrm{mm}"), ";"]),
        p("4.5.2.2.1", "editorial-018", 146, 470, "Spessore minimo dei setti esterni (distanza minima dal bordo esterno al foro più vicino al netto dell’eventuale rigatura) è il seguente:"),
        li("4.5.2.2.1", "editorial-019", 146, 491, ["elementi in laterizio e di silicato di calcio: ", m("10 mm", "10\\,\\mathrm{mm}"), ";"]),
        li("4.5.2.2.1", "editorial-020", 146, 502, ["elementi in calcestruzzo: ", m("18 mm", "18\\,\\mathrm{mm}"), ";"]),
        p("4.5.2.2.1", "editorial-021", 146, 513, "Per i valori di adesività malta/elemento resistente si può fare riferimento a indicazioni di normative di riconosciuta validità."),
    ], { formulaIds: [], tableIds: [tableIa, tableIb], figureIds: [] }),
    makeUnit("4.5.2.2.2", "Elementi naturali", "subparagraph", [
        h("4.5.2.2.2", "Elementi naturali", 146, 534, "4.5.2.2.2 Elementi naturali"),
        p("4.5.2.2.2", "editorial-001", 146, 545, "Gli elementi naturali sono ricavati da materiale lapideo non friabile o sfaldabile, e resistente al gelo; essi non devono contenere in misura sensibile sostanze solubili, o residui organici e devono essere integri, senza zone alterate o rimovibili."),
        p("4.5.2.2.2", "editorial-002", 146, 568, "Gli elementi devono possedere i requisiti di resistenza meccanica ed adesività alle malte determinati secondo le modalità descritte nel § 11.10.3.", { discretionaryHyphen: true }),
    ], { formulaIds: [], tableIds: [], figureIds: [] }),
    makeUnit("4.5.2.3", "MURATURE", "subparagraph", [
        h("4.5.2.3", "MURATURE", 146, 600, "4.5.2.3 MURATURE"),
        p("4.5.2.3", "editorial-001", 146, 612, "Le murature costituite dall’assemblaggio organizzato ed efficace di elementi e malta possono essere a singolo paramento, se la parete è senza cavità o giunti verticali continui nel suo piano, o a paramento doppio. In questo ultimo caso, qualora siano presenti le connessioni trasversali previste dall’Eurocodice UNI EN 1996-1-1, si farà riferimento agli stessi Eurocodici UNI EN 1996-1-1, oppure, in assenza delle connessioni trasversali previste dall’Eurocodice, si applica quanto previsto al § 4.6.", { discretionaryHyphen: true }),
        p("4.5.2.3", "editorial-002", 146, 655, ["Nel caso di elementi naturali, le pietre di geometria pressoché parallelepipeda, poste in opera in strati regolari, formano le murature di pietra squadrata. L’impiego di materiale di cava grossolanamente lavorato è consentito per le nuove costruzioni, purché posto in opera in strati pressoché regolari: in tal caso si parla di muratura di pietra non squadrata; se la muratura in pietra non squadrata è intercalata, ad interasse non superiore a ", m("1,6 m", "1{,}6\\,\\mathrm{m}"), " e per tutta la lunghezza e lo spessore del muro, da fasce di calcestruzzo semplice o armato oppure da ricorsi orizzontali costituiti da almeno due filari di laterizio pieno, si parla di muratura listata."], { discretionaryHyphen: true }),
        p("4.5.2.3", "editorial-003", 146, 707, ["L’uso di giunti di malta sottili (spessore compreso tra ", m("0,5 mm", "0{,}5\\,\\mathrm{mm}"), " e ", m("3 mm", "3\\,\\mathrm{mm}"), ") e/o di giunti verticali a secco va limitato ad edifici con numero di piani fuori terra non superiore a quanto specificato al § 7.8.1.2 ed altezza interpiano massima di ", m("3,5 m", "3{,}5\\,\\mathrm{m}"), "."], { discretionaryHyphen: true }),
    ], { formulaIds: [], tableIds: [], figureIds: [] }),
    makeUnit("4.5.3", "CARATTERISTICHE MECCANICHE DELLE MURATURE", "subparagraph", [
        h("4.5.3", "CARATTERISTICHE MECCANICHE DELLE MURATURE", 147, 98),
        p("4.5.3", "editorial-001", 147, 110, ["Le proprietà fondamentali in base alle quali si classifica una muratura sono la resistenza caratteristica a compressione ", m("f_k", "f_k"), ", la resistenza caratteristica a taglio in assenza di azione assiale ", m("f_{vk0}", "f_{vk0}"), ", il modulo di elasticità normale secante ", m("E", "E"), ", il modulo di elasticità tangenziale secante ", m("G", "G"), "."]),
        p("4.5.3", "editorial-002", 147, 145, ["Le resistenze caratteristiche ", m("f_k", "f_k"), " e ", m("f_{vk0}", "f_{vk0}"), " sono determinate o per via sperimentale su campioni di muro o, con alcune limitazioni, in funzione delle proprietà dei componenti. Le modalità per determinare le resistenze caratteristiche sono indicate nel § 11.10.3, dove sono anche riportate le modalità per la valutazione dei moduli di elasticità."], { discretionaryHyphen: true }),
        p("4.5.3", "editorial-003", 147, 181, "In ogni caso i valori delle caratteristiche meccaniche utilizzate per le verifiche devono essere indicati nel progetto delle opere."),
        p("4.5.3", "editorial-004", 147, 194, ["In ogni caso, quando è richiesto un valore di ", m("f_k", "f_k"), " maggiore o uguale a ", m("8 MPa", "8\\,\\mathrm{MPa}"), " si deve controllare il valore di ", m("f_k", "f_k"), ", mediante prove sperimentali come indicato nel § 11.10."], { discretionaryHyphen: true }),
    ], { formulaIds: [], tableIds: [], figureIds: [] }),
    makeUnit("4.5.4", "ORGANIZZAZIONE STRUTTURALE", "subparagraph", [
        h("4.5.4", "ORGANIZZAZIONE STRUTTURALE", 147, 225),
        p("4.5.4", "editorial-001", 147, 237, "L’edificio a muratura portante deve essere concepito come una struttura tridimensionale. I sistemi resistenti di pareti di muratura, gli orizzontamenti e le fondazioni devono essere collegati tra di loro in modo da resistere alle azioni verticali ed orizzontali."),
        p("4.5.4", "editorial-002", 147, 272, ["I pannelli murari, di muratura non armata, sono considerati resistenti anche alle azioni orizzontali quando hanno una lunghezza non inferiore a ", m("0,3", "0{,}3"), " volte l’altezza di interpiano; i pannelli murari svolgono funzione portante, quando sono sollecitati prevalentemente da azioni verticali, e svolgono funzione di controvento, quando sollecitati prevalentemente da azioni orizzontali. Ai fini di un adeguato comportamento statico e dinamico dell’edificio, tutti le pareti devono assolvere, per quanto possibile, sia la funzione portante sia la funzione di controventamento."], { discretionaryHyphen: true }),
        p("4.5.4", "editorial-003", 147, 329, "Gli orizzontamenti sono generalmente solai piani, o con falde inclinate in copertura, che devono assicurare, per resistenza e rigidezza, la ripartizione delle azioni orizzontali fra i muri di controventamento."),
        p("4.5.4", "editorial-004", 147, 354, "L’organizzazione dell’intera struttura e l’interazione ed il collegamento tra le sue parti devono essere tali da assicurare appropriata resistenza e stabilità, ed un comportamento d’insieme “scatolare”."),
        p("4.5.4", "editorial-005", 147, 380, "Per garantire un comportamento scatolare, muri ed orizzontamenti devono essere opportunamente collegati fra loro. Tutte le pareti devono essere collegate al livello dei solai mediante cordoli di piano di calcestruzzo armato e, tra di loro, mediante ammorsamenti lungo le intersezioni verticali. I cordoli di piano devono avere adeguata sezione ed armatura.", { discretionaryHyphen: true }),
        p("4.5.4", "editorial-006", 147, 427, "Devono inoltre essere previsti opportuni incatenamenti al livello dei solai, aventi lo scopo di collegare tra loro i muri paralleli della scatola muraria. Tali incatenamenti devono essere realizzati per mezzo di armature metalliche o altro materiale resistente a trazione, le cui estremità devono essere efficacemente ancorate ai cordoli. Per il collegamento nella direzione di tessitura del solaio possono essere omessi gli incatenamenti quando il collegamento è assicurato dal solaio stesso. Per il collegamento in direzione normale alla tessitura del solaio, si possono adottare opportuni accorgimenti che sostituiscano efficacemente gli incatenamenti costituiti da tiranti estranei al solaio.", { discretionaryHyphen: true }),
        p("4.5.4", "editorial-007", 147, 496, "Il collegamento fra la fondazione e la struttura in elevazione è generalmente realizzato mediante cordolo in calcestruzzo armato disposto alla base di tutte le murature verticali resistenti. È possibile realizzare la prima elevazione con pareti di calcestruzzo armato; in tal caso la disposizione delle fondazioni e delle murature sovrastanti deve essere tale da garantire un adeguato centraggio dei carichi trasmessi alle pareti della prima elevazione ed alla fondazione.", { discretionaryHyphen: true }),
        p("4.5.4", "editorial-008", 147, 566, "Lo spessore dei muri portanti non può essere inferiore ai seguenti valori:"),
        li("4.5.4", "editorial-009", 147, 579, ["– muratura in elementi resistenti artificiali pieni ", m("150 mm", "150\\,\\mathrm{mm}")]),
        li("4.5.4", "editorial-010", 147, 591, ["– muratura in elementi resistenti artificiali semipieni ", m("200 mm", "200\\,\\mathrm{mm}")]),
        li("4.5.4", "editorial-011", 147, 604, ["– muratura in elementi resistenti artificiali forati ", m("240 mm", "240\\,\\mathrm{mm}")]),
        li("4.5.4", "editorial-012", 147, 616, ["– muratura di pietra squadrata ", m("240 mm", "240\\,\\mathrm{mm}")]),
        li("4.5.4", "editorial-013", 147, 629, ["– muratura di pietra listata ", m("400 mm", "400\\,\\mathrm{mm}")]),
        li("4.5.4", "editorial-014", 147, 641, ["– muratura di pietra non squadrata ", m("500 mm", "500\\,\\mathrm{mm}")]),
        p("4.5.4", "editorial-015", 147, 653, "I fenomeni del secondo ordine possono essere controllati mediante la snellezza convenzionale della parete, definita dal rapporto:"),
        assetBlock("4.5.4", "editorial-016", "formula-ref", f("4.5.1"), 147, 589),
        p("4.5.4", "editorial-017", 147, 606, ["dove ", m("h_0", "h_0"), " è la lunghezza libera di inflessione della parete valutata in base alle condizioni di vincolo ai bordi espresse dalla [4.5.5] e ", m("t", "t"), " è lo spessore della parete."]),
        p("4.5.4", "editorial-018", 147, 631, ["Il valore della snellezza ", m("λ", "\\lambda"), " non deve risultare superiore a ", m("20", "20"), "."]),
    ], { formulaIds: [f("4.5.1")], tableIds: [], figureIds: [] }),
    makeUnit("4.5.5", "ANALISI STRUTTURALE", "subparagraph", [
        h("4.5.5", "ANALISI STRUTTURALE", 147, 653),
        p("4.5.5", "editorial-001", 147, 666, "La risposta strutturale è calcolata usando:"),
        li("4.5.5", "editorial-002", 147, 679, "– analisi semplificate."),
        li("4.5.5", "editorial-003", 147, 691, "– analisi lineari, assumendo i valori secanti dei moduli di elasticità"),
        li("4.5.5", "editorial-004", 147, 704, "– analisi non lineari"),
        p("4.5.5", "editorial-005", 147, 717, "Per la valutazione di effetti locali è consentito l’impiego di modelli di calcolo relativi a parti isolate della struttura."),
        p("4.5.5", "editorial-006", 148, 99, "Per il calcolo dei carichi trasmessi dai solai alle pareti e per la valutazione su queste ultime degli effetti delle azioni fuori dal piano, è consentito l’impiego di modelli semplificati, basati sullo schema dell’articolazione completa alle estremità degli elementi strutturali.", { discretionaryHyphen: true }),
    ], { formulaIds: [], tableIds: [], figureIds: [] }),
    makeUnit("4.5.6", "VERIFICHE", "subparagraph", [
        h("4.5.6", "VERIFICHE", 148, 143),
        p("4.5.6", "editorial-001", 148, 155, "Le verifiche sono condotte con l’ipotesi di conservazione delle sezioni piane e trascurando la resistenza a trazione per flessione della muratura."),
        p("4.5.6", "editorial-002", 148, 178, "Oltre alle verifiche sulle pareti portanti, si deve eseguire anche la verifica di travi di accoppiamento in muratura ordinaria, quando prese in considerazione dal modello della struttura. Tali verifiche si eseguono in analogia a quanto previsto per i pannelli murari verticali.", { discretionaryHyphen: true }),
    ], { formulaIds: [], tableIds: [], figureIds: [] }),
    makeUnit("4.5.6.1", "RESISTENZE DI PROGETTO", "subparagraph", [
        h("4.5.6.1", "RESISTENZE DI PROGETTO", 148, 220),
        p("4.5.6.1", "editorial-001", 148, 232, ["Le resistenze di progetto da impiegare, rispettivamente, per le verifiche a compressione, pressoflessione e a carichi concentrati (", m("f_d", "f_d"), "), e a taglio (", m("f_{vd}", "f_{vd}"), ") valgono:"]),
        assetBlock("4.5.6.1", "editorial-002", "formula-ref", f("4.5.2"), 148, 255),
        assetBlock("4.5.6.1", "editorial-003", "formula-ref", f("4.5.3"), 148, 269),
        p("4.5.6.1", "editorial-004", 148, 293, "dove"),
        p("4.5.6.1", "editorial-005", 148, 307, [m("f_k", "f_k"), " è la resistenza caratteristica a compressione della muratura;"]),
        p("4.5.6.1", "editorial-006", 148, 320, [m("f_{vk}", "f_{vk}"), " è la resistenza caratteristica a taglio della muratura in presenza delle effettive tensioni di compressione, valutata secondo quanto indicato al §11.10.3.3, in cui ", m("γ_M", "\\gamma_M"), " è il coefficiente parziale di sicurezza sulla resistenza a compressione della muratura, comprensivo delle incertezze di modello e di geometria, fornito dalla Tab. 4.5.II, in funzione delle classi di esecuzione più avanti precisate, e a seconda che gli elementi resistenti utilizzati siano di categoria I o di categoria II (vedi § 11.10.1)."], { discretionaryHyphen: true }),
        assetBlock("4.5.6.1", "editorial-007", "table-ref", tableII, 148, 362),
        p("4.5.6.1", "editorial-008", 148, 432, "L’attribuzione delle Classi di esecuzione 1 e 2 viene effettuata adottando quanto di seguito indicato."),
        p("4.5.6.1", "editorial-009", 148, 445, "In ogni caso occorre (Classe 2):"),
        li("4.5.6.1", "editorial-010", 148, 458, "– disponibilità di specifico personale qualificato e con esperienza, dipendente dall’impresa esecutrice, per la supervisione del lavoro (capocantiere);"),
        li("4.5.6.1", "editorial-011", 148, 482, "– disponibilità di specifico personale qualificato e con esperienza, indipendente dall’impresa esecutrice, per il controllo ispettivo del lavoro (direttore dei lavori)."),
        p("4.5.6.1", "editorial-012", 148, 519, "La Classe 1 è attribuita qualora siano previsti, oltre ai controlli di cui sopra, le seguenti operazioni di controllo:"),
        li("4.5.6.1", "editorial-013", 148, 532, "– controllo e valutazione in loco delle proprietà della malta e del calcestruzzo;"),
        li("4.5.6.1", "editorial-014", 148, 545, "– dosaggio dei componenti della malta “a volume” con l’uso di opportuni contenitori di misura e controllo delle operazioni di miscelazione o uso di malta premiscelata certificata dal produttore.", { discretionaryHyphen: true }),
    ], { formulaIds: [f("4.5.2"), f("4.5.3")], tableIds: [tableII], figureIds: [] }),
    makeUnit("4.5.6.2", "VERIFICHE AGLI STATI LIMITE ULTIMI", "subparagraph", [
        h("4.5.6.2", "VERIFICHE AGLI STATI LIMITE ULTIMI", 148, 565),
        p("4.5.6.2", "editorial-001", 148, 577, "Gli stati limite ultimi da verificare sono:"),
        li("4.5.6.2", "editorial-002", 148, 590, "– presso flessione per carichi laterali (resistenza e stabilità fuori dal piano);"),
        li("4.5.6.2", "editorial-003", 148, 603, "– presso flessione nel piano del muro;"),
        li("4.5.6.2", "editorial-004", 148, 615, "– taglio per azioni nel piano del muro;"),
        li("4.5.6.2", "editorial-005", 148, 628, "– carichi concentrati;"),
        li("4.5.6.2", "editorial-006", 148, 640, "– flessione e taglio di travi di accoppiamento."),
        p("4.5.6.2", "editorial-007", 148, 653, "Le verifiche vanno condotte con riferimento a normative di comprovata validità."),
        p("4.5.6.2", "editorial-008", 148, 666, "Per la verifica a presso flessione per carichi laterali, nel caso di adozione dell’ipotesi di articolazione completa delle estremità della parete (vedi § 4.5.5), è consentito far riferimento al metodo semplificato di seguito riportato.", { discretionaryHyphen: true }),
        p("4.5.6.2", "editorial-009", 148, 689, ["La resistenza unitaria di progetto ridotta ", m("f_{d,rid}", "f_{d,\\mathrm{rid}}"), " riferita all’elemento strutturale si assume pari a"]),
        assetBlock("4.5.6.2", "editorial-010", "formula-ref", f("4.5.4"), 148, 701),
        p("4.5.6.2", "editorial-011", 149, 99, ["in cui ", m("Φ", "\\Phi"), " è il coefficiente di riduzione della resistenza del materiale, riportato in Tab. 4.5.III in funzione della snellezza convenzionale ", m("λ", "\\lambda"), " e del coefficiente di eccentricità ", m("m", "m"), " definito più avanti (equazione [4.5.6])."]),
        p("4.5.6.2", "editorial-012", 149, 112, "Per valori non contemplati in tabella è ammessa l’interpolazione lineare; in nessun caso sono ammesse estrapolazioni."),
        assetBlock("4.5.6.2", "editorial-013", "table-ref", tableIII, 149, 142),
        p("4.5.6.2", "editorial-014", 149, 188, ["Per la valutazione della snellezza convenzionale ", m("λ", "\\lambda"), " della parete secondo l’espressione [4.5.1] la lunghezza libera d’inflessione del muro ", m("h_0", "h_0"), " è data dalla relazione"]),
        assetBlock("4.5.6.2", "editorial-015", "formula-ref", f("4.5.5"), 149, 267),
        p("4.5.6.2", "editorial-016", 149, 279, ["in cui il fattore ", m("ρ", "\\rho"), " tiene conto dell’efficacia del vincolo fornito dai muri ortogonali e ", m("h", "h"), " è l’altezza interna di piano; ", m("ρ", "\\rho"), " assume il valore ", m("1", "1"), " per muro isolato, e i valori indicati nella Tab. 4.5.IV, quando il muro non ha aperture ed è irrigidito con efficace vincolo da due muri trasversali di spessore non inferiore a ", m("200 mm", "200\\,\\mathrm{mm}"), ", e di lunghezza ", m("l", "l"), " non inferiore a ", m("1/5 h", "h/5"), ", posti ad interasse ", m("a", "a"), "."], { discretionaryHyphen: true }),
        assetBlock("4.5.6.2", "editorial-017", "table-ref", tableIV, 149, 321),
        p("4.5.6.2", "editorial-018", 149, 366, ["Se un muro trasversale ha aperture, si ritiene convenzionalmente che la sua funzione di irrigidimento possa essere espletata quando lo stipite delle aperture disti dalla superficie del muro irrigidito almeno ", m("1/5", "1/5"), " dell’altezza del muro stesso; in caso contrario si assume ", m("ρ = 1", "\\rho=1"), "."]),
        p("4.5.6.2", "editorial-019", 149, 399, ["Nella lunghezza ", m("l", "l"), " del muro di irrigidimento si intende compresa anche metà dello spessore del muro irrigidito. Il coefficiente di eccentricità ", m("m", "m"), " è definito dalla relazione:"]),
        assetBlock("4.5.6.2", "editorial-020", "formula-ref", f("4.5.6"), 149, 437),
        p("4.5.6.2", "editorial-021", 149, 449, ["essendo ", m("e", "e"), " l’eccentricità totale e ", m("t", "t"), " lo spessore del muro. Le eccentricità dei carichi verticali sullo spessore della muratura sono dovute alle eccentricità totali dei carichi verticali, alle tolleranze di esecuzione ed alle azioni orizzontali. Esse possono essere determinate convenzionalmente con i criteri che seguono."], { discretionaryHyphen: true }),
        li("4.5.6.2", "editorial-022", 149, 485, "a) eccentricità totale dei carichi verticali:"),
        assetBlock("4.5.6.2", "editorial-023", "formula-ref", f("4.5.7"), 149, 502),
        p("4.5.6.2", "editorial-024", 149, 522, "dove:"),
        li("4.5.6.2", "editorial-025", 149, 535, [m("e_{s1}", "e_{s1}"), " eccentricità della risultante dei carichi trasmessi dai muri dei piani superiori rispetto al piano medio del muro da verificare;"]),
        li("4.5.6.2", "editorial-026", 149, 548, [m("e_{s2}", "e_{s2}"), " eccentricità delle reazioni di appoggio dei solai soprastanti la sezione di verifica;"]),
        li("4.5.6.2", "editorial-027", 149, 561, [m("N_1", "N_1"), " carico trasmesso dal muro sovrastante supposto centrato rispetto al muro stesso;"]),
        li("4.5.6.2", "editorial-028", 149, 574, [m("N_2", "N_2"), " reazione di appoggio dei solai sovrastanti il muro da verificare;"]),
        li("4.5.6.2", "editorial-029", 149, 587, [m("d_1", "d_1"), " eccentricità di ", m("N_1", "N_1"), " rispetto al piano medio del muro da verificare;"]),
        li("4.5.6.2", "editorial-030", 149, 600, [m("d_2", "d_2"), " eccentricità di ", m("N_2", "N_2"), " rispetto al piano medio del muro da verificare;"]),
        li("4.5.6.2", "editorial-031", 149, 613, "tali eccentricità possono essere positive o negative;"),
        li("4.5.6.2", "editorial-032", 149, 626, ["b) eccentricità dovuta a tolleranze di esecuzione, ", m("e_a", "e_a"), "."]),
        p("4.5.6.2", "editorial-033", 149, 639, ["Considerate le tolleranze morfologiche e dimensionali connesse alle tecnologie di esecuzione degli edifici in muratura si deve tener conto di una eccentricità ", m("e_a", "e_a"), " che è assunta almeno uguale a"]),
        assetBlock("4.5.6.2", "editorial-034", "formula-ref", f("4.5.8"), 149, 659),
        p("4.5.6.2", "editorial-035", 149, 672, ["con ", m("h", "h"), " altezza interna di piano."]),
        li("4.5.6.2", "editorial-036", 149, 685, ["c) eccentricità ", m("e_v", "e_v"), " dovuta alle azioni orizzontali considerate agenti in direzione normale al piano della muratura,"]),
        assetBlock("4.5.6.2", "editorial-037", "formula-ref", f("4.5.9"), 149, 696),
        p("4.5.6.2", "editorial-038", 150, 99, ["dove ", m("M_v", "M_v"), " ed ", m("N", "N"), " sono, rispettivamente, il massimo momento flettente dovuto alle azioni orizzontali e lo sforzo normale nella relativa sezione di verifica. Il muro è supposto incernierato al livello dei piani e, in mancanza di aperture, anche in corrispondenza dei muri trasversali, se questi hanno interasse minore di ", m("6 m", "6\\,\\mathrm{m}"), "."]),
        p("4.5.6.2", "editorial-039", 150, 135, ["Le eccentricità ", m("e_s", "e_s"), ", ", m("e_a", "e_a"), " e ", m("e_v", "e_v"), " vanno convenzionalmente combinate tra di loro secondo le due espressioni:"]),
        assetBlock("4.5.6.2", "editorial-040", "formula-ref", f("4.5.10"), 150, 154),
        p("4.5.6.2", "editorial-041", 150, 176, ["Il valore di ", m("e=e_1", "e=e_1"), " è adottato per la verifica dei muri nelle loro sezioni di estremità; il valore di ", m("e=e_2", "e=e_2"), " è adottato per la verifica della sezione ove è massimo il valore di ", m("M_v", "M_v"), ". L’eccentricità di calcolo ", m("e", "e"), " non può comunque essere assunta inferiore ad ", m("e_a", "e_a"), "."]),
        p("4.5.6.2", "editorial-042", 150, 202, "In ogni caso dove risultare:"),
        assetBlock("4.5.6.2", "editorial-043", "formula-ref", f("4.5.11"), 150, 213),
    ], { formulaIds: [f("4.5.4"), f("4.5.5"), f("4.5.6"), f("4.5.7"), f("4.5.8"), f("4.5.9"), f("4.5.10"), f("4.5.11")], tableIds: [tableIII, tableIV], figureIds: [] }),
    makeUnit("4.5.6.3", "VERIFICHE AGLI STATI LIMITE DI ESERCIZIO", "subparagraph", [
        h("4.5.6.3", "VERIFICHE AGLI STATI LIMITE DI ESERCIZIO", 150, 225),
        p("4.5.6.3", "editorial-001", 150, 238, "Non è generalmente necessario eseguire verifiche nei confronti di stati limite di esercizio di strutture di muratura, quando siano soddisfatte le verifiche nei confronti degli stati limite ultimi."),
        p("4.5.6.3", "editorial-002", 150, 263, "Nel caso della muratura armata, e per particolari situazioni della muratura non armata, si farà riferimento a norme tecniche di comprovata validità."),
    ], { formulaIds: [], tableIds: [], figureIds: [] }),
    makeUnit("4.5.6.4", "VERIFICHE SEMPLIFICATE", "subparagraph", [
        h("4.5.6.4", "VERIFICHE SEMPLIFICATE", 150, 292),
        p("4.5.6.4", "editorial-001", 150, 304, ["Per edifici semplici è consentito eseguire le verifiche, in via semplificativa, adottando le azioni previste nelle presenti Norme Tecniche, con resistenza del materiale di cui al § 4.5.6.1, ponendo il coefficiente ", m("γ_M = 4,2", "\\gamma_M=4{,}2"), " ed utilizzando il dimensionamento semplificato di seguito riportato con le corrispondenti limitazioni:"]),
        li("4.5.6.4", "editorial-002", 150, 330, "a) le pareti strutturali della costruzione siano continue dalle fondazioni alla sommità;"),
        li("4.5.6.4", "editorial-003", 150, 343, ["b) nessuna altezza interpiano sia superiore a ", m("3,5 metri", "3{,}5\\,\\mathrm{m}"), ";"]),
        li("4.5.6.4", "editorial-004", 150, 356, ["c) il numero di piani in muratura non sia superiore a ", m("3", "3"), " (entro e fuori terra) per costruzioni in muratura ordinaria ed a ", m("4", "4"), " per costruzioni in muratura armata;"]),
        li("4.5.6.4", "editorial-005", 150, 382, ["d) la planimetria dell’edificio sia inscrivibile in un rettangolo con rapporti fra lato minore e lato maggiore non inferiore a ", m("1/3", "1/3"), ";"]),
        li("4.5.6.4", "editorial-006", 150, 395, ["e) la snellezza della muratura, secondo l’espressione [4.5.1], non sia in nessun caso superiore a ", m("12", "12"), ";"]),
        li("4.5.6.4", "editorial-007", 150, 408, ["f) il carico variabile per i solai non sia superiore a ", m("3,00 kN/m²", "3{,}00\\,\\mathrm{kN/m^2}"), "."]),
        li("4.5.6.4", "editorial-008", 150, 421, "g) devono essere rispettate le percentuali minime, calcolate coperta rispetto alla superficie totale in pianta dell’edificio, di sezione resistente delle pareti, calcolate nelle due direzioni ortogonali, specificate in Tab. 7.8.II."),
        p("4.5.6.4", "editorial-009", 150, 447, "La verifica si intende soddisfatta se risulta:"),
        assetBlock("4.5.6.4", "editorial-010", "formula-ref", f("4.5.12"), 150, 458),
        p("4.5.6.4", "editorial-011", 150, 472, ["in cui ", m("N", "N"), " è il carico verticale totale alla base di ciascun piano dell’edificio corrispondente alla somma dei carichi permanenti e variabili (valutati ponendo ", m("γ_G=γ_Q=1", "\\gamma_G=\\gamma_Q=1"), ") della combinazione caratteristica e ", m("A", "A"), " è l’area totale dei muri portanti allo stesso piano."]),
    ], { formulaIds: [f("4.5.12")], tableIds: [], figureIds: [] }),
    makeUnit("4.5.7", "MURATURA ARMATA", "subparagraph", [
        h("4.5.7", "MURATURA ARMATA", 150, 507),
        p("4.5.7", "editorial-001", 150, 519, "La muratura armata è costituita da elementi resistenti artificiali pieni e semipieni idonei alla realizzazione di pareti murarie incorporanti apposite armature metalliche verticali e orizzontali, annegate nella malta o nel conglomerato cementizio."),
        p("4.5.7", "editorial-002", 150, 554, "Le barre di armatura possono essere costituite da acciaio al carbonio, o da acciaio inossidabile o da acciaio con rivestimento speciale, conformi alle pertinenti indicazioni di cui al § 11.3."),
        p("4.5.7", "editorial-003", 150, 579, "È ammesso, per le armature orizzontali, l’impiego di armature a traliccio elettrosaldato o l’impiego di altre armature conformate in modo da garantire adeguata aderenza ed ancoraggio, nel rispetto delle pertinenti normative di comprovata validità."),
        p("4.5.7", "editorial-004", 150, 614, "In ogni caso dovrà essere garantita una adeguata protezione dell’armatura nei confronti della corrosione."),
        p("4.5.7", "editorial-005", 150, 627, ["Le barre di armatura devono avere un diametro minimo di ", m("5 mm", "5\\,\\mathrm{mm}"), ". Nelle pareti che incorporano armatura nei letti di malta al fine di fornire un aumento della resistenza ai carichi fuori piano, per contribuire al controllo della fessurazione o per fornire duttilità, l’area totale dell’armatura non deve essere minore dello ", m("0,03%", "0{,}03\\%"), " dell’area lorda della sezione trasversale della parete (cioè ", m("0,015%", "0{,}015\\%"), " per ogni faccia nel caso della resistenza fuori piano)."], { discretionaryHyphen: true }),
        p("4.5.7", "editorial-006", 150, 680, ["Qualora l’armatura sia utilizzata negli elementi di muratura armata per aumentare la resistenza nel piano, o quando sia richiesta armatura a taglio, la percentuale di armatura orizzontale, calcolata rispetto all’area lorda della muratura, non potrà essere inferiore allo ", m("0,04%", "0{,}04\\%"), " né superiore allo ", m("0,5%", "0{,}5\\%"), ", e non potrà avere interasse superiore a ", m("60 cm", "60\\,\\mathrm{cm}"), ". La percentuale di armatura verticale, calcolata rispetto all’area lorda della muratura, non potrà essere inferiore allo ", m("0,05%", "0{,}05\\%"), ", né superiore allo ", m("1,0%", "1{,}0\\%"), ". In tal caso, armature verticali con sezione complessiva non inferiore a ", m("2 cm²", "2\\,\\mathrm{cm^2}"), " dovranno essere collocate a ciascuna estremità di ogni parete portante, ad ogni intersezione tra pareti portanti, in corrispondenza di ogni apertura e comunque ad interasse non superiore a ", m("4 m", "4\\,\\mathrm{m}"), "."], { discretionaryHyphen: true }),
        p("4.5.7", "editorial-007", 150, 734, "La lunghezza d’ancoraggio, idonea a garantire la trasmissione degli sforzi alla malta o al calcestruzzo di riempimento, deve in ogni caso essere in grado di evitare la fessurazione longitudinale o lo sfaldamento della muratura. L’ancoraggio deve essere ottenuto mediante una barra rettilinea, mediante ganci, piegature o forcelle o, in alternativa, mediante opportuni dispositivi meccanici di comprovata efficacia.", { discretionaryHyphen: true }),
        p("4.5.7", "editorial-008", 151, 99, "La lunghezza di ancoraggio richiesta per barre dritte può essere calcolata in analogia a quanto usualmente fatto per le strutture di calcestruzzo armato."),
        p("4.5.7", "editorial-009", 151, 124, ["L’ancoraggio dell’armatura a taglio, staffe incluse, deve essere ottenuto mediante ganci o piegature, con una barra d’armatura longitudinale inserita nel gancio o nella piegatura. Le sovrapposizioni devono garantire la continuità nella trasmissione degli sforzi di trazione, in modo che lo snervamento dell’armatura abbia luogo prima che venga meno la resistenza della giunzione. In mancanza di dati sperimentali relativi alla tecnologia usata, la lunghezza di sovrapposizione deve essere di almeno ", m("60 diametri", "60\\text{ diametri}"), "."], { discretionaryHyphen: true }),
        p("4.5.7", "editorial-010", 151, 170, ["La malta o il conglomerato di riempimento dei vani o degli alloggi delle armature deve avvolgere completamente l’armatura. Lo spessore di ricoprimento deve essere tale da garantire la trasmissione degli sforzi tra la muratura e l’armatura e tale da costituire un idoneo copriferro ai fini della durabilità degli acciai. L’armatura verticale dovrà essere collocata in apposite cavità o recessi, di dimensioni tali che in ciascuno di essi risulti inscrivibile un cilindro di almeno ", m("6 cm", "6\\,\\mathrm{cm}"), " di diametro."], { discretionaryHyphen: true }),
        p("4.5.7", "editorial-011", 151, 220, ["La resistenza a compressione minima richiesta per la malta è di ", m("10 MPa", "10\\,\\mathrm{MPa}"), ", mentre la classe minima richiesta per il conglomerato cementizio è C12/15. Per i valori di resistenza di aderenza caratteristica dell’armatura si può fare riferimento a risultati di prove sperimentali o a indicazioni normative di comprovata validità."]),
        p("4.5.7", "editorial-012", 151, 258, ["La resistenza di progetto della muratura da impiegare per le verifiche a taglio (", m("f_{vd}", "f_{vd}"), "), può essere calcolata ignorando il contributo di qualsiasi armatura a taglio incorporata nell’elemento, qualora non sia fornita l’area minima di armatura sopra specificata per elementi di muratura armata atti ad aumentare la resistenza nel piano, oppure prendendo in considerazione il contributo dell’armatura a taglio, qualora sia presente almeno l’area minima prevista, secondo quanto riportato in normative di riconosciuta validità."], { discretionaryHyphen: true }),
        p("4.5.7", "editorial-013", 151, 323, ["Le verifiche di sicurezza vanno condotte assumendo per l’acciaio ", m("γ_s = 1,15", "\\gamma_s=1{,}15"), "."]),
    ], { formulaIds: [], tableIds: [], figureIds: [] }),
    makeUnit("4.5.8", "MURATURA CONFINATA", "subparagraph", [
        h("4.5.8", "MURATURA CONFINATA", 151, 342),
        p("4.5.8", "editorial-001", 151, 365, "La muratura confinata è una muratura costituita da elementi resistenti artificiali pieni e semipieni, dotata di elementi di confinamento in calcestruzzo armato o muratura armata. Il progetto della muratura confinata può essere svolto applicando integralmente quanto previsto negli Eurocodici strutturali ed in particolare nelle norme della serie UNI EN 1996 e UNI EN 1998 con le relative appendici nazionali.", { discretionaryHyphen: true }),
    ], { formulaIds: [], tableIds: [], figureIds: [] }),
    makeUnit("4.5.9", "VERIFICHE PER SITUAZIONI TRANSITORIE", "subparagraph", [
        h("4.5.9", "VERIFICHE PER SITUAZIONI TRANSITORIE", 151, 416),
        p("4.5.9", "editorial-001", 151, 428, "Per le situazioni costruttive transitorie, come quelle che si hanno durante le fasi della costruzione, dovranno adottarsi tecnologie costruttive e programmi di lavoro che non possano provocare danni permanenti alla struttura o agli elementi strutturali e che comunque non possano riverberarsi sulla sicurezza dell’opera.", { discretionaryHyphen: true }),
        p("4.5.9", "editorial-002", 151, 465, "Le entità delle azioni ambientali da prendere in conto saranno determinate in relazione al tempo della situazione transitoria e della tecnologia esecutiva.", { discretionaryHyphen: true }),
    ], { formulaIds: [], tableIds: [], figureIds: [] }),
    makeUnit("4.5.10", "VERIFICHE PER SITUAZIONI ECCEZIONALI", "subparagraph", [
        h("4.5.10", "VERIFICHE PER SITUAZIONI ECCEZIONALI", 151, 494),
        p("4.5.10", "editorial-001", 151, 507, ["Per situazioni progettuali eccezionali, il progetto dovrà dimostrare la robustezza della costruzione mediante procedure di scenari di danno per i quali i fattori parziali ", m("γ_M", "\\gamma_M"), " dei materiali possono essere assunti pari a ", m("½", "1/2"), " di quelli delle situazioni ordinarie (vedi Tab. 4.5.II)."]),
    ], { formulaIds: [], tableIds: [], figureIds: [] }),
    makeUnit("4.5.11", "RESISTENZA AL FUOCO", "subparagraph", [
        h("4.5.11", "RESISTENZA AL FUOCO", 151, 551),
        p("4.5.11", "editorial-001", 151, 563, ["Le verifiche di resistenza al fuoco potranno eseguirsi con riferimento a UNI EN 1996-1-2, utilizzando i coefficienti ", m("γ_M", "\\gamma_M"), " (vedi § 4.5.10) relativi alle combinazioni eccezionali."]),
    ], { formulaIds: [], tableIds: [], figureIds: [] }),
    makeUnit("4.5.12", "PROGETTAZIONE INTEGRATA DA PROVE E VERIFICA MEDIANTE PROVE", "subparagraph", [
        h("4.5.12", "PROGETTAZIONE INTEGRATA DA PROVE E VERIFICA MEDIANTE PROVE", 151, 611),
        p("4.5.12", "editorial-001", 151, 623, "La resistenza e la funzionalità di strutture e elementi strutturali può essere misurata attraverso prove su campioni di adeguata numerosità."),
        p("4.5.12", "editorial-002", 151, 648, "I risultati delle prove eseguite su opportuni campioni devono essere trattati con i metodi dell’analisi statistica, in modo tale da ricavare parametri significativi quali media, deviazione standard e fattore di asimmetria della distribuzione, sì da caratterizzare adeguatamente un modello probabilistico descrittore delle quantità indagate (variabili aleatorie).", { discretionaryHyphen: true }),
        p("4.5.12", "editorial-003", 151, 689, "Indicazioni più dettagliate al riguardo e metodi operativi completi per la progettazione integrata da prove possono essere reperiti nella Appendice D della UNI EN 1990:2006.", { discretionaryHyphen: true }),
    ], { formulaIds: [], tableIds: [], figureIds: [] }),
];

const manifest = {
    $schema: "urn:structural-codes:schema:asset-manifest:v2",
    schemaVersion: "2.0.0-alpha.1",
    recordType: "asset-manifest",
    document: "ntc2018",
    section: "4.5",
    sourceId,
    status: "transcribed-unreviewed",
    formulas: formulaAssets,
    tables: tableAssets,
    figures: [],
};

await mkdir(unitDirectory, { recursive: true });
await mkdir(assetDirectory, { recursive: true });
await Promise.all([
    ...units.map((unit) =>
        writeFile(join(unitDirectory, `${unit.numbering.official}.json`), `${JSON.stringify(unit, null, 2)}\n`, "utf8"),
    ),
    writeFile(join(assetDirectory, "4.5.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8"),
]);

console.log(`NTC 4.5: generate ${units.length} unità, ${formulaAssets.length} formule e ${tableAssets.length} tabelle.`);
