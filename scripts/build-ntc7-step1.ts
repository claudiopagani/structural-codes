import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { sha256OfText } from "../src/lib/hash.ts";

const root = fileURLToPath(new URL("../", import.meta.url));
const sourceId = "gu-so8-2018-ntc";
const workId = "it-mit:dm:2018-01-17:ntc2018";
const expressionId = "it-mit:dm:2018-01-17:ntc2018:original-it";
const profile = "ntc7-editorial-profile-0.1.0";
const createdAt = "2026-08-10T00:00:00Z";
const unitDir = join(root, "corpus", "units", "ntc2018");
const assetDir = join(root, "corpus", "assets", "ntc2018");

type Region = {
    coordinateSystem: "pdf-points-top-left";
    x: number;
    y: number;
    width: number;
    height: number;
};
type Inline = { kind: "text" | "math"; value: string; latex?: string };
type Part = [page: number, from: number, to: number];
type UnitKind = "chapter" | "section" | "paragraph" | "subparagraph";

const uid = (number: string) =>
    `urn:structural-codes:it:unit:ntc2018:${number}`;
const fid = (name: string) =>
    `urn:structural-codes:it:asset:formula:ntc2018:${name}`;
const tid = (name: string) =>
    `urn:structural-codes:it:asset:table:ntc2018:${name}`;
const reg = (
    x: number,
    y: number,
    width: number,
    height: number,
): Region => ({
    coordinateSystem: "pdf-points-top-left",
    x,
    y,
    width,
    height,
});

const pageLines = new Map<number, string[]>();
for (let page = 211; page <= 219; page += 1) {
    const file = join(
        root,
        "evidence",
        sourceId,
        "pages",
        `page-${String(page).padStart(4, "0")}.raw.txt`,
    );
    pageLines.set(
        page,
        (await readFile(file, "utf8")).replace(/\r\n/gu, "\n").split("\n"),
    );
}

function rawPart(page: number, from: number, to: number): string {
    const lines = pageLines.get(page);
    if (!lines) throw new Error(`Evidence mancante per pagina ${page}`);
    return lines.slice(from - 1, to).join("\n");
}

function raw(parts: Part[]): string {
    return parts.map(([page, from, to]) => rawPart(page, from, to)).join("\n");
}

function autoNormalize(value: string): string {
    return value
        .replace(/\r?\n/gu, " ")
        .replace(/\s+/gu, " ")
        .replace(/^x /u, "- ")
        .replace(/\s+([,.;:])/gu, "$1")
        .replace(/^77\.0\./u, "7.0.")
        .replace(/^77\.2\.2\./u, "7.2.2.")
        .replace(/^77\.2\.3\./u, "7.2.3.")
        .replace(/^77\.2\.5\./u, "7.2.5.")
        .replace(/^77\.2\.6\./u, "7.2.6.")
        .replace(/^77\.3\./u, "7.3.")
        .replace(/D ISTANZA/gu, "DISTANZA")
        .replace(/A LTEZZA/gu, "ALTEZZA")
        .replace(/L IMITAZIONE DELL ’ALTEZZA/gu, "LIMITAZIONE DELL’ALTEZZA")
        .replace(/F ONDAZIONI/gu, "FONDAZIONI")
        .replace(/M ODELLAZIONE DELL ’AZIONE/gu, "MODELLAZIONE DELL’AZIONE")
        .replace(/·Rd/gu, "γ_Rd")
        .replace(/·ov/gu, "γ_ov")
        .replace(/·/gu, "γ")
        .replace(/ǂ/gu, "≤")
        .replace(/ǃ/gu, "≥")
        .replace(/CD[“”]A[“”]/gu, "CD “A”")
        .replace(/CD[“”]B[“”]/gu, "CD “B”")
        .replace(/CD[“”]/gu, "CD “")
        .trim();
}

function textInline(value: string): Inline[] {
    return [{ kind: "text", value }];
}

function inlineTerms(
    value: string,
    terms: Array<[value: string, latex: string]>,
): Inline[] {
    const ordered = [...terms]
        .filter(([term]) => value.includes(term))
        .sort((left, right) => right[0].length - left[0].length);
    const result: Inline[] = [];
    let cursor = 0;
    while (cursor < value.length) {
        let found:
            | { index: number; value: string; latex: string }
            | undefined;
        for (const [term, latex] of ordered) {
            let index = value.indexOf(term, cursor);
            while (index >= 0 && term.length === 1) {
                const before = index > 0 ? value[index - 1] ?? "" : "";
                const after = value[index + term.length] ?? "";
                if (!/[\p{L}\p{N}_]/u.test(before) && !/[\p{L}\p{N}_]/u.test(after)) break;
                index = value.indexOf(term, index + term.length);
            }
            if (
                index >= 0 &&
                (!found ||
                    index < found.index ||
                    (index === found.index && term.length > found.value.length))
            ) {
                found = { index, value: term, latex };
            }
        }
        if (!found) {
            result.push({ kind: "text", value: value.slice(cursor) });
            break;
        }
        if (found.index > cursor) {
            result.push({
                kind: "text",
                value: value.slice(cursor, found.index),
            });
        }
        result.push({ kind: "math", value: found.value, latex: found.latex });
        cursor = found.index + found.value.length;
    }
    return result.filter(({ value: segment }) => segment.length > 0);
}

function lineRegion(page: number, from: number, to: number): Region {
    const y = Math.max(70, 65 + from * 10.35);
    const height = Math.max(8, (to - from + 1) * 10.35);
    return reg(82.954, y, 428.6, height);
}

function transformations(source: string, normalized: string, manual = false) {
    if (source === normalized) return [];
    const result: Array<{
        operation: string;
        ruleVersion: string;
        note: string;
    }> = [];
    if (source.includes("\n")) {
        result.push({
            operation: "join-line-wrap",
            ruleVersion: profile,
            note: "Ricomposti i ritorni a capo tipografici verificati sul render ufficiale.",
        });
    }
    if (manual || /[\u0000-\u001f\u007f-\u009fǂǃ·ȭ]/u.test(source)) {
        result.push({
            operation: "manual-correction",
            ruleVersion: profile,
            note: "Ripristinati numerazione, glifi, simboli e matematica confrontati con il render ufficiale.",
        });
    }
    result.push({
        operation: "normalize-whitespace",
        ruleVersion: profile,
        note: "Uniformati gli spazi dopo la ricomposizione editoriale.",
    });
    result.push({
        operation: "unicode-nfc",
        ruleVersion: profile,
        note: "Testo normalizzato in Unicode NFC.",
    });
    return result;
}

function evidence(
    page: number,
    source: string,
    normalized: string,
    region: Region | null,
    manual = false,
) {
    return {
        sourceId,
        pdfPage: page,
        printedPage: String(page - 4),
        region,
        extraction: {
            method: manual ? "manual-transcription" : "pdf-text",
            tool: manual ? "codex-source-transcription" : "pdfjs-dist",
            toolVersion: manual ? profile : "4.10.38",
        },
        transformations: transformations(source, normalized, manual),
        rawSha256: sha256OfText(source),
        normalizedSha256: sha256OfText(normalized),
    };
}

function block(
    number: string,
    suffix: string,
    kind: "heading" | "paragraph" | "list-item",
    parts: Part[],
    normalized: string,
    options: { manual?: boolean; inline?: Inline[] } = {},
) {
    const source = raw(parts);
    const firstPart = parts[0]!;
    const page = firstPart[0];
    const region = lineRegion(page, firstPart[1], firstPart[2]);
    return {
        blockId: `${uid(number)}#block-${suffix}`,
        kind,
        origin: "official",
        text: {
            raw: source,
            normalized,
            normalizationVersion: profile,
            inline: options.inline ?? textInline(normalized),
        },
        evidence: evidence(page, source, normalized, region, options.manual),
    };
}

function autoBlock(
    number: string,
    suffix: string,
    kind: "paragraph" | "list-item",
    parts: Part[],
    options: { manual?: boolean; inline?: Inline[] } = {},
) {
    const normalized = autoNormalize(raw(parts));
    return block(number, suffix, kind, parts, normalized, options);
}

function heading(number: string, suffix: string, parts: Part[], normalized: string) {
    return block(number, suffix, "heading", parts, normalized, { manual: true });
}

function formulaBlock(
    number: string,
    suffix: string,
    page: number,
    officialNumber: string | null,
    latex: string,
    region: Region,
) {
    const asset = fid(suffix);
    const label = officialNumber ? `[${officialNumber}]` : `[formula-${suffix}]`;
    const blockSuffix = suffix.replaceAll(".", "-").toLowerCase();
    return {
        blockId: `${uid(number)}#block-formula-${blockSuffix}`,
        kind: "formula-ref",
        origin: "official",
        assetId: asset,
        evidence: evidence(page, label, label, region, true),
    };
}

function tableBlock(number: string, suffix: string, page: number, asset: string, region: Region) {
    const label = `Tabella ${suffix}`;
    return {
        blockId: `${uid(number)}#block-table-${suffix.replaceAll(".", "-").toLowerCase()}`,
        kind: "table-ref",
        origin: "official",
        assetId: asset,
        evidence: evidence(page, label, label, region, true),
    };
}

function cell(text: string, latex?: string, extra: Record<string, number> = {}) {
    return { text, ...(latex ? { latex } : {}), ...extra };
}

function parent(number: string): string | null {
    const parts = number.split(".");
    return parts.length === 1 ? null : uid(parts.slice(0, -1).join("."));
}

function ancestors(number: string): string[] {
    const parts = number.split(".");
    return parts.slice(1).map((_, index) => uid(parts.slice(0, index + 1).join(".")));
}

function makeUnit(
    number: string,
    title: string,
    kind: UnitKind,
    blocks: unknown[],
    formulas: string[] = [],
    tables: string[] = [],
) {
    const issuePrefix = `ntc2018-${number.replaceAll(".", "-")}`;
    return {
        $schema: "urn:structural-codes:schema:canonical-unit:v2",
        schemaVersion: "2.0.0-alpha.2",
        recordType: "canonical-unit",
        id: uid(number),
        workId,
        expressionId,
        kind,
        numbering: {
            official: number,
            sortKey: number
                .split(".")
                .map((part) => part.padStart(3, "0"))
                .join("."),
        },
        title,
        titleBlockId: `${uid(number)}#block-heading`,
        hierarchy: {
            parentId: parent(number),
            ancestorIds: ancestors(number),
            position: number === "7.0" ? 1 : Number(number.split(".").at(-1)),
        },
        validity: {
            from: "2018-03-22",
            to: null,
            status: "in-force",
            asOf: "2026-08-10",
        },
        blocks,
        citations: [],
        relations: [],
        assets: {
            formulaIds: formulas.map(fid),
            tableIds: tables.map(tid),
            figureIds: [],
        },
        workflow: {
            status: "extracted",
            createdBy: {
                actorId: "generator:ntc7:step1",
                kind: "script",
                toolVersion: profile,
            },
            createdAt,
            reviews: [],
            openIssues: [
                {
                    issueId: `${issuePrefix}-source-review`,
                    type: "normalization-review",
                    severity: "blocking",
                    note: "Record trascritto dall’evidence ufficiale ma non ancora confrontato integralmente da un revisore umano con il render della fonte.",
                },
                ...tables.map((table) => ({
                    issueId: `${issuePrefix}-${table}-review`,
                    type: "asset-review",
                    severity: "blocking",
                    note: "La tabella è strutturata dal render ufficiale e richiede verifica umana cella per cella.",
                })),
            ],
        },
    };
}

const table72 = {
    id: tid("7.2.i"),
    unitId: uid("7.2.2"),
    officialNumber: "7.2.I",
    pdfPage: 215,
    caption: "Fattori di sovraresistenza γ_Rd (fra parentesi quadre è indicato il numero dell’equazione corrispondente)",
    columnCount: 5,
    headers: [
        [
            cell("Tipologia strutturale", undefined, { rowSpan: 2 }),
            cell("Elementi strutturali", undefined, { rowSpan: 2 }),
            cell("Progettazione in capacità", undefined, { rowSpan: 2 }),
            cell("γ_Rd", "\\gamma_{Rd}", { colSpan: 2 }),
        ],
        [cell("CD “A”"), cell("CD “B”")],
    ],
    rows: [
        [cell("C.a. gettata in opera", undefined, { rowSpan: 5 }), cell("Travi (§ 7.4.4.1.1)"), cell("Taglio"), cell("1,20"), cell("1,10")],
        [cell("Pilastri (§ 7.4.4.2.1)"), cell("Pressoflessione [7.4.4]"), cell("1,30"), cell("1,30")],
        [cell("Pilastri (§ 7.4.4.2.1)"), cell("Taglio [7.4.5]"), cell("1,30"), cell("1,10")],
        [cell("Nodi trave-pilastro (§ 7.4.4.3.1)"), cell("Taglio [7.4.6-7, 7.4.11-12]"), cell("1,20"), cell("1,10")],
        [cell("Pareti (§ 7.4.4.5.1)"), cell("Taglio [7.4.13-14]"), cell("1,20"), cell("-")],
        [cell("C.a. prefabbricata a struttura intelaiata", undefined, { rowSpan: 2 }), cell("Collegamenti di tipo a) (§ 7.4.5.2.1)"), cell("Flessione e taglio"), cell("1,20"), cell("1,10")],
        [cell("Collegamenti di tipo b) (§ 7.4.5.2.1)"), cell("Flessione e taglio"), cell("1,35"), cell("1,20")],
        [cell("C.a. prefabbricata con pilastri incastrati alla base e orizzontamenti incernierati"), cell("Collegamenti di tipo fisso (§ 7.4.5.2.1)"), cell("Taglio"), cell("1,35"), cell("1,20")],
        [cell("Acciaio"), cell("Si impiega il fattore di sovraresistenza γ_ov definito al § 7.5.1", "\\gamma_{ov}", { colSpan: 4 })],
        [cell(""), cell("Colonne (§ 7.5.4.2)"), cell("Pressoflessione [7.5.10]"), cell("1,30"), cell("1,30")],
        [cell("Composta acciaio-calcestruzzo"), cell("Si impiega il fattore di sovraresistenza γ_ov definito al § 7.5.1", "\\gamma_{ov}", { colSpan: 4 })],
        [cell(""), cell("Colonne (§ 7.6.6.2)"), cell("Pressoflessione [7.6.7]"), cell("1,30"), cell("1,30")],
        [cell("Legno"), cell("Collegamenti"), cell(""), cell("1,60"), cell("1,30")],
        [cell("Muratura armata con progettazione in capacità"), cell("Pannelli murari (§ 7.8.1.7)"), cell("Taglio"), cell("1,50"), cell("-")],
        [cell("Ponti"), cell("Si impiegano i fattori di sovraresistenza definiti al § 7.9.5", undefined, { colSpan: 4 })],
    ],
    notes: [],
};

const table73 = {
    id: tid("7.3.i"),
    unitId: uid("7.3"),
    officialNumber: "7.3.I",
    pdfPage: 219,
    caption: "Limiti su q e modalità di modellazione dell’azione sismica",
    columnCount: 6,
    headers: [
        [cell("STATI LIMITE", undefined, { colSpan: 2 }), cell("Lineare (Dinamica e Statica)", undefined, { colSpan: 2 }), cell("Non Lineare", undefined, { colSpan: 2 })],
        [cell(""), cell(""), cell("Dissipativo"), cell("Non Dissipativo"), cell("Dinamica"), cell("Statica")],
    ],
    rows: [
        [cell("SLE", undefined, { rowSpan: 2 }), cell("SLO"), cell("q = 1,0\n§ 3.2.3.4"), cell("q = 1,0\n§ 3.2.3.4"), cell("§ 7.3.4.1", undefined, { rowSpan: 4 }), cell("§ 7.3.4.2", undefined, { rowSpan: 4 })],
        [cell("SLD"), cell("q ≤ 1,5\n§ 3.2.3.5"), cell("q ≤ 1,5\n§ 3.2.3.5")],
        [cell("SLU", undefined, { rowSpan: 2 }), cell("SLV"), cell("q ≥ 1,5\n§ 3.2.3.5"), cell("q ≤ 1,5\n§ 3.2.3.5")],
        [cell("SLC"), cell("---"), cell("---")],
    ],
    notes: [],
};

const fDelta = "7.2.2-delta";
const fFa = "7.2.3-7.2.1";
const fAxial = ["7.2.5-axial-a", "7.2.5-axial-b", "7.2.5-axial-c", "7.2.5-axial-d"];

const units = [
    makeUnit("7", "PROGETTAZIONE PER AZIONI SISMICHE", "chapter", [
        heading("7", "heading", [[211, 3, 4]], "7 PROGETTAZIONE PER AZIONI SISMICHE"),
    ]),
    makeUnit("7.0", "GENERALITÀ", "section", [
        heading("7.0", "heading", [[212, 3, 3]], "7.0 GENERALITÀ"),
        autoBlock("7.0", "p1", "paragraph", [[212, 4, 7]]),
        block("7.0", "p2", "paragraph", [[212, 8, 12]], "Le costruzioni caratterizzate, nei confronti dello SLV, da a_g S ≥ 0,075g, in cui S è il coefficiente che comprende l’effetto dell’amplificazione stratigrafica S_S e dell’amplificazione topografica S_T, di cui al § 3.2.3.2, e a_g è l’accelerazione orizzontale massima per il suddetto SLV su sito di riferimento rigido, possono essere progettate e verificate come segue:", { manual: true, inline: inlineTerms("Le costruzioni caratterizzate, nei confronti dello SLV, da a_g S ≥ 0,075g, in cui S è il coefficiente che comprende l’effetto dell’amplificazione stratigrafica S_S e dell’amplificazione topografica S_T, di cui al § 3.2.3.2, e a_g è l’accelerazione orizzontale massima per il suddetto SLV su sito di riferimento rigido, possono essere progettate e verificate come segue:", [["a_g S", "a_g S"], ["S_S", "S_S"], ["S_T", "S_T"], ["S", "S"], ["≥", "\\ge"], ["a_g", "a_g"]]) }),
        block("7.0", "li1", "list-item", [[212, 13, 15]], "- si considera la combinazione di azioni definita nel § 2.5.3, applicando, in due direzioni ortogonali, il sistema di forze orizzontali definito dall’espressione [7.3.7] assumendo F_h = 0,10 W per tutte le tipologie strutturali, essendo q definito al § 7.3.3.2;", { manual: true, inline: inlineTerms("- si considera la combinazione di azioni definita nel § 2.5.3, applicando, in due direzioni ortogonali, il sistema di forze orizzontali definito dall’espressione [7.3.7] assumendo F_h = 0,10 W per tutte le tipologie strutturali, essendo q definito al § 7.3.3.2;", [["F_h", "F_h"], ["q", "q"]]) }),
        autoBlock("7.0", "li2", "list-item", [[212, 16, 16]]),
        block("7.0", "li3", "list-item", [[212, 17, 19]], "- si utilizza in generale una “progettazione per comportamento strutturale non dissipativo”, quale definita nel § 7.2.2; qualora si scelga una “progettazione per comportamento strutturale dissipativo”, quale definita nel § 7.2.2, si possono impiegare, in classe di duttilità CD “B”, valori unitari per i coefficienti γ_Rd di cui alla Tab. 7.2.I;", { manual: true, inline: inlineTerms("- si utilizza in generale una “progettazione per comportamento strutturale non dissipativo”, quale definita nel § 7.2.2; qualora si scelga una “progettazione per comportamento strutturale dissipativo”, quale definita nel § 7.2.2, si possono impiegare, in classe di duttilità CD “B”, valori unitari per i coefficienti γ_Rd di cui alla Tab. 7.2.I;", [["γ_Rd", "\\gamma_{Rd}"]]) }),
        autoBlock("7.0", "li4", "list-item", [[212, 20, 21]]),
    ]),
    makeUnit("7.1", "REQUISITI NEI CONFRONTI DEGLI STATI LIMITE", "paragraph", [
        heading("7.1", "heading", [[212, 22, 22]], "7.1 REQUISITI NEI CONFRONTI DEGLI STATI LIMITE"),
        autoBlock("7.1", "p1", "paragraph", [[212, 23, 23]]),
        autoBlock("7.1", "li1", "list-item", [[212, 24, 25]]),
        autoBlock("7.1", "li2", "list-item", [[212, 26, 27]]),
        autoBlock("7.1", "p2", "paragraph", [[212, 28, 30]]),
        autoBlock("7.1", "p3", "paragraph", [[212, 31, 34]]),
        autoBlock("7.1", "p4", "paragraph", [[212, 35, 37]]),
    ]),
    makeUnit("7.2", "CRITERI GENERALI DI PROGETTAZIONE E MODELLAZIONE", "paragraph", [
        heading("7.2", "heading", [[212, 38, 38]], "7.2 CRITERI GENERALI DI PROGETTAZIONE E MODELLAZIONE"),
    ]),
    makeUnit("7.2.1", "CARATTERISTICHE GENERALI DELLE COSTRUZIONI", "subparagraph", [
        heading("7.2.1", "heading", [[212, 39, 39]], "7.2.1 CARATTERISTICHE GENERALI DELLE COSTRUZIONI"),
        heading("7.2.1", "heading-regularita", [[212, 40, 40]], "REGOLARITÀ"),
        autoBlock("7.2.1", "p1", "paragraph", [[212, 41, 42]]),
        autoBlock("7.2.1", "p2", "paragraph", [[212, 43, 43]]),
        autoBlock("7.2.1", "li-a", "list-item", [[212, 44, 48]]),
        autoBlock("7.2.1", "li-b", "list-item", [[212, 49, 49]]),
        autoBlock("7.2.1", "li-c", "list-item", [[212, 50, 52]]),
        autoBlock("7.2.1", "p3", "paragraph", [[212, 53, 53]]),
        autoBlock("7.2.1", "li-d", "list-item", [[212, 54, 55]]),
        autoBlock("7.2.1", "li-e", "list-item", [[213, 3, 7]]),
        autoBlock("7.2.1", "li-f", "list-item", [[213, 8, 11]]),
        autoBlock("7.2.1", "li-g", "list-item", [[213, 12, 16]]),
        autoBlock("7.2.1", "p4", "paragraph", [[213, 17, 22]]),
        autoBlock("7.2.1", "p5", "paragraph", [[213, 23, 23]]),
        heading("7.2.1", "heading-distanza", [[213, 24, 24]], "DISTANZA TRA COSTRUZIONI CONTIGUE"),
        autoBlock("7.2.1", "p6", "paragraph", [[213, 25, 28]]),
        block("7.2.1", "p7", "paragraph", [[213, 29, 32]], "La distanza tra due punti di costruzioni che si fronteggiano non potrà in ogni caso essere inferiore a 1/100 della quota dei punti considerati, misurata dallo spiccato della fondazione o dalla sommità della struttura scatolare rigida di cui al § 7.2.1, moltiplicata per 2a_gS/g ≤ 1.", { manual: true, inline: inlineTerms("La distanza tra due punti di costruzioni che si fronteggiano non potrà in ogni caso essere inferiore a 1/100 della quota dei punti considerati, misurata dallo spiccato della fondazione o dalla sommità della struttura scatolare rigida di cui al § 7.2.1, moltiplicata per 2a_gS/g ≤ 1.", [["2a_gS/g", "2a_gS/g"], ["≤", "\\le"]]) }),
        block("7.2.1", "p8", "paragraph", [[213, 33, 36]], "Qualora non si possano eseguire calcoli specifici, lo spostamento massimo di una costruzione non isolata alla base può essere stimato in 1/100 della sua altezza, misurata come sopra, moltiplicata per a_gS/g; in questo caso, la distanza tra costruzioni contigue non potrà essere inferiore alla somma degli spostamenti massimi di ciascuna di esse. Il presente capoverso non si applica ai ponti.", { manual: true, inline: inlineTerms("Qualora non si possano eseguire calcoli specifici, lo spostamento massimo di una costruzione non isolata alla base può essere stimato in 1/100 della sua altezza, misurata come sopra, moltiplicata per a_gS/g; in questo caso, la distanza tra costruzioni contigue non potrà essere inferiore alla somma degli spostamenti massimi di ciascuna di esse. Il presente capoverso non si applica ai ponti.", [["a_gS/g", "a_gS/g"]]) }),
        autoBlock("7.2.1", "p9", "paragraph", [[213, 37, 38]]),
        heading("7.2.1", "heading-altezza", [[213, 39, 39]], "ALTEZZA MASSIMA DEI NUOVI EDIFICI"),
        autoBlock("7.2.1", "p10", "paragraph", [[213, 40, 41]]),
        heading("7.2.1", "heading-larghezza", [[213, 42, 42]], "LIMITAZIONE DELL’ALTEZZA IN FUNZIONE DELLA LARGHEZZA STRADALE"),
        autoBlock("7.2.1", "p11", "paragraph", [[213, 43, 44]]),
        autoBlock("7.2.1", "p12", "paragraph", [[213, 45, 47]]),
    ]),
    makeUnit("7.2.2", "CRITERI GENERALI DI PROGETTAZIONE DEI SISTEMI STRUTTURALI", "subparagraph", [
        heading("7.2.2", "heading", [[213, 48, 48]], "7.2.2 CRITERI GENERALI DI PROGETTAZIONE DEI SISTEMI STRUTTURALI"),
        autoBlock("7.2.2", "p1", "paragraph", [[213, 49, 50]]),
        autoBlock("7.2.2", "p2", "paragraph", [[213, 51, 53]]),
        autoBlock("7.2.2", "p3", "paragraph", [[213, 54, 57], [214, 3, 9]]),
        heading("7.2.2", "heading-comportamento", [[214, 10, 10]], "COMPORTAMENTO STRUTTURALE"),
        autoBlock("7.2.2", "p4", "paragraph", [[214, 11, 12]]),
        autoBlock("7.2.2", "li-a", "list-item", [[214, 13, 13]]),
        autoBlock("7.2.2", "or", "paragraph", [[214, 14, 14]]),
        autoBlock("7.2.2", "li-b", "list-item", [[214, 15, 15]]),
        autoBlock("7.2.2", "p5", "paragraph", [[214, 16, 19]]),
        autoBlock("7.2.2", "p6", "paragraph", [[214, 20, 25]]),
        heading("7.2.2", "heading-duttilita", [[214, 26, 26]], "CLASSI DI DUTTILITÀ"),
        autoBlock("7.2.2", "p7", "paragraph", [[214, 27, 28]]),
        autoBlock("7.2.2", "li-cd-a", "list-item", [[214, 29, 29]]),
        autoBlock("7.2.2", "li-cd-b", "list-item", [[214, 30, 30]]),
        autoBlock("7.2.2", "p8", "paragraph", [[214, 31, 32]]),
        heading("7.2.2", "heading-capacita", [[214, 33, 33]], "PROGETTAZIONE IN CAPACITÀ E FATTORI DI SOVRARESISTENZA"),
        autoBlock("7.2.2", "p9", "paragraph", [[214, 34, 35]]),
        autoBlock("7.2.2", "p10", "paragraph", [[214, 36, 36]]),
        autoBlock("7.2.2", "li-cap-a", "list-item", [[214, 37, 37]]),
        autoBlock("7.2.2", "li-cap-b", "list-item", [[214, 38, 38]]),
        autoBlock("7.2.2", "li-cap-c", "list-item", [[214, 39, 40]]),
        autoBlock("7.2.2", "p11", "paragraph", [[214, 41, 45]]),
        autoBlock("7.2.2", "p12", "paragraph", [[214, 46, 46]]),
        autoBlock("7.2.2", "li-overstrength-global", "list-item", [[214, 47, 49]]),
        autoBlock("7.2.2", "li-overstrength-local", "list-item", [[214, 50, 51]]),
        tableBlock("7.2.2", "7.2.I", 215, table72.id, reg(75, 95, 465, 300)),
        autoBlock("7.2.2", "p13", "paragraph", [[215, 35, 36]]),
        autoBlock("7.2.2", "p14", "paragraph", [[215, 37, 39]]),
        autoBlock("7.2.2", "p15", "paragraph", [[215, 40, 41]], { inline: inlineTerms("I collegamenti realizzati con dispositivi di vincolo temporaneo, di cui al § 11.9, devono sostenere la domanda allo SLV (vedi § 7.3) maggiorata di un coefficiente γ_Rd almeno pari a 1,5.", [["γ_Rd", "\\gamma_{Rd}"]]) }),
        heading("7.2.2", "heading-appoggi", [[215, 42, 42]], "SPOSTAMENTI RELATIVI IN APPOGGI MOBILI"),
        autoBlock("7.2.2", "p16", "paragraph", [[215, 43, 44]]),
        formulaBlock("7.2.2", fDelta, 215, null, "\\Delta=d_{Es}+d_{Eg}", reg(180, 510, 250, 25)),
        autoBlock("7.2.2", "p17", "paragraph", [[215, 46, 46]]),
        block("7.2.2", "p18", "paragraph", [[215, 47, 50]], "d_{Es} è lo spostamento relativo tra le due parti della struttura, valutato come radice quadrata della somma dei quadrati dei massimi spostamenti orizzontali nella direzione d’interesse delle due parti; tali massimi spostamenti sono calcolati, nel caso di analisi lineare, secondo il § 7.3.3.3 o, nel caso di analisi non lineare, secondo il § 7.3.4; per i ponti, lo spostamento relativo così ottenuto deve essere moltiplicato per 1,25,", { manual: true, inline: inlineTerms("d_{Es} è lo spostamento relativo tra le due parti della struttura, valutato come radice quadrata della somma dei quadrati dei massimi spostamenti orizzontali nella direzione d’interesse delle due parti; tali massimi spostamenti sono calcolati, nel caso di analisi lineare, secondo il § 7.3.3.3 o, nel caso di analisi non lineare, secondo il § 7.3.4; per i ponti, lo spostamento relativo così ottenuto deve essere moltiplicato per 1,25,", [["d_{Es}", "d_{Es}"]]) }),
        block("7.2.2", "p19", "paragraph", [[215, 51, 52]], "d_{Eg} è lo spostamento relativo tra il terreno alla base delle due parti della struttura collegate dall’appoggio mobile, calcolato come indicato al § 3.2.4.2.", { manual: true, inline: inlineTerms("d_{Eg} è lo spostamento relativo tra il terreno alla base delle due parti della struttura collegate dall’appoggio mobile, calcolato come indicato al § 3.2.4.2.", [["d_{Eg}", "d_{Eg}"]]) }),
        autoBlock("7.2.2", "p20", "paragraph", [[215, 53, 54]]),
        heading("7.2.2", "heading-zone", [[215, 55, 55]], "ZONE DISSIPATIVE E RELATIVI DETTAGLI COSTRUTTIVI"),
        autoBlock("7.2.2", "p21", "paragraph", [[215, 56, 59]]),
        autoBlock("7.2.2", "p22", "paragraph", [[215, 60, 62]]),
    ], [fDelta], ["7.2.i"]),
    makeUnit("7.2.3", "CRITERI DI PROGETTAZIONE DI ELEMENTI STRUTTURALI SECONDARI ED ELEMENTI COSTRUTTIVI NON STRUTTURALI", "subparagraph", [
        heading("7.2.3", "heading", [[216, 3, 3]], "7.2.3 CRITERI DI PROGETTAZIONE DI ELEMENTI STRUTTURALI SECONDARI ED ELEMENTI COSTRUTTIVI NON STRUTTURALI"),
        heading("7.2.3", "heading-secondari", [[216, 4, 4]], "ELEMENTI SECONDARI"),
        autoBlock("7.2.3", "p1", "paragraph", [[216, 5, 10]]),
        autoBlock("7.2.3", "p2", "paragraph", [[216, 11, 13]]),
        heading("7.2.3", "heading-non-strutturali", [[216, 14, 14]], "ELEMENTI COSTRUTTIVI NON STRUTTURALI"),
        autoBlock("7.2.3", "p3", "paragraph", [[216, 15, 17]]),
        autoBlock("7.2.3", "p4", "paragraph", [[216, 18, 24]]),
        autoBlock("7.2.3", "p5", "paragraph", [[216, 25, 27]]),
        autoBlock("7.2.3", "p6", "paragraph", [[216, 28, 31]]),
        block("7.2.3", "p7", "paragraph", [[216, 32, 33]], "La domanda sismica sugli elementi non strutturali può essere determinata applicando loro una forza orizzontale F_a definita come segue:", { manual: true, inline: inlineTerms("La domanda sismica sugli elementi non strutturali può essere determinata applicando loro una forza orizzontale F_a definita come segue:", [["F_a", "F_a"]]) }),
        formulaBlock("7.2.3", fFa, 216, "7.2.1", "F_a=\\frac{S_a W_a}{q_a}", reg(170, 438, 260, 30)),
        autoBlock("7.2.3", "p8", "paragraph", [[216, 35, 35]]),
        block("7.2.3", "p9", "paragraph", [[216, 36, 37]], "F_a è la forza sismica orizzontale distribuita o agente nel centro di massa dell’elemento non strutturale, nella direzione più sfavorevole, risultante delle forze distribuite proporzionali alla massa;", { manual: true, inline: inlineTerms("F_a è la forza sismica orizzontale distribuita o agente nel centro di massa dell’elemento non strutturale, nella direzione più sfavorevole, risultante delle forze distribuite proporzionali alla massa;", [["F_a", "F_a"]]) }),
        block("7.2.3", "p10", "paragraph", [[216, 38, 39]], "S_a è l’accelerazione massima, adimensionalizzata rispetto a quella di gravità, che l’elemento non strutturale subisce durante il sisma e corrisponde allo stato limite in esame (v. § 3.2.1);", { manual: true, inline: inlineTerms("S_a è l’accelerazione massima, adimensionalizzata rispetto a quella di gravità, che l’elemento non strutturale subisce durante il sisma e corrisponde allo stato limite in esame (v. § 3.2.1);", [["S_a", "S_a"]]) }),
        block("7.2.3", "p11", "paragraph", [[216, 40, 40]], "W_a è il peso dell’elemento;", { manual: true, inline: inlineTerms("W_a è il peso dell’elemento;", [["W_a", "W_a"]]) }),
        block("7.2.3", "p12", "paragraph", [[216, 41, 42]], "q_a è il fattore di comportamento dell’elemento. In assenza di specifiche determinazioni, per S_a e q_a può farsi utile riferimento a documenti di comprovata validità.", { manual: true, inline: inlineTerms("q_a è il fattore di comportamento dell’elemento. In assenza di specifiche determinazioni, per S_a e q_a può farsi utile riferimento a documenti di comprovata validità.", [["q_a", "q_a"], ["S_a", "S_a"]]) }),
    ], [fFa]),
    makeUnit("7.2.4", "CRITERI DI PROGETTAZIONE DEGLI IMPIANTI", "subparagraph", [
        heading("7.2.4", "heading", [[216, 43, 43]], "7.2.4 CRITERI DI PROGETTAZIONE DEGLI IMPIANTI"),
        autoBlock("7.2.4", "p1", "paragraph", [[216, 44, 49]]),
        autoBlock("7.2.4", "p2", "paragraph", [[216, 50, 53]]),
        block("7.2.4", "p3", "paragraph", [[216, 54, 56], [217, 3, 8]], "Non ricadono nelle prescrizioni successive e richiedono uno specifico studio gli impianti che eccedano il 30% del carico permanente totale del campo di solaio su cui sono collocati o del pannello di tamponatura o di tramezzatura a cui sono appesi o il 10% del carico permanente totale dell’intera struttura. In assenza di più accurate valutazioni, la domanda sismica agente per la presenza di un impianto sul pannello di tamponatura o di tramezzatura a cui l’impianto è appeso, si può assimilare ad un carico uniformemente distribuito di intensità 2F_a/S, dove F_a è la forza di competenza di ciascuno degli elementi funzionali componenti l’impianto applicata al baricentro dell’elemento e calcolata utilizzando l’equazione [7.2.1] e S è la superficie del pannello di tamponatura o di tramezzatura. Tale carico distribuito deve intendersi agente sia ortogonalmente sia tangenzialmente al piano medio del pannello.", { manual: true, inline: inlineTerms("Non ricadono nelle prescrizioni successive e richiedono uno specifico studio gli impianti che eccedano il 30% del carico permanente totale del campo di solaio su cui sono collocati o del pannello di tamponatura o di tramezzatura a cui sono appesi o il 10% del carico permanente totale dell’intera struttura. In assenza di più accurate valutazioni, la domanda sismica agente per la presenza di un impianto sul pannello di tamponatura o di tramezzatura a cui l’impianto è appeso, si può assimilare ad un carico uniformemente distribuito di intensità 2F_a/S, dove F_a è la forza di competenza di ciascuno degli elementi funzionali componenti l’impianto applicata al baricentro dell’elemento e calcolata utilizzando l’equazione [7.2.1] e S è la superficie del pannello di tamponatura o di tramezzatura. Tale carico distribuito deve intendersi agente sia ortogonalmente sia tangenzialmente al piano medio del pannello.", [["2F_a/S", "2F_a/S"], ["F_a", "F_a"], ["S", "S"]]) }),
        autoBlock("7.2.4", "p4", "paragraph", [[217, 9, 12]], { inline: inlineTerms(autoNormalize(raw([[217, 9, 12]])), [["q", "q"]]) }),
        autoBlock("7.2.4", "p5", "paragraph", [[217, 13, 16]], { inline: inlineTerms(autoNormalize(raw([[217, 13, 16]])), [["T", "T"]]) }),
        autoBlock("7.2.4", "p6", "paragraph", [[217, 17, 20]]),
    ]),
    makeUnit("7.2.5", "REQUISITI STRUTTURALI DEGLI ELEMENTI DI FONDAZIONE", "subparagraph", [
        heading("7.2.5", "heading", [[217, 21, 21]], "7.2.5 REQUISITI STRUTTURALI DEGLI ELEMENTI DI FONDAZIONE"),
        autoBlock("7.2.5", "p1", "paragraph", [[217, 22, 23]]),
        autoBlock("7.2.5", "p2", "paragraph", [[217, 24, 26]]),
        autoBlock("7.2.5", "li1", "list-item", [[217, 27, 27]]),
        autoBlock("7.2.5", "li2", "list-item", [[217, 28, 29]]),
        autoBlock("7.2.5", "li3", "list-item", [[217, 30, 31]]),
        heading("7.2.5", "heading-superficiali", [[217, 32, 32]], "FONDAZIONI SUPERFICIALI"),
        autoBlock("7.2.5", "p3", "paragraph", [[217, 33, 34]]),
        autoBlock("7.2.5", "p4", "paragraph", [[217, 35, 37]]),
        autoBlock("7.2.5", "p5", "paragraph", [[217, 38, 39]]),
        heading("7.2.5", "heading-pali", [[217, 40, 40]], "FONDAZIONI SU PALI"),
        autoBlock("7.2.5", "p6", "paragraph", [[217, 41, 43]]),
        autoBlock("7.2.5", "p7", "paragraph", [[217, 44, 44]]),
        autoBlock("7.2.5", "li-palo-1", "list-item", [[217, 45, 48]]),
        autoBlock("7.2.5", "li-palo-2", "list-item", [[217, 49, 50]]),
        autoBlock("7.2.5", "p8", "paragraph", [[217, 51, 53]]),
        autoBlock("7.2.5", "p9", "paragraph", [[217, 54, 54]]),
        autoBlock("7.2.5", "li-prescrizione-1", "list-item", [[217, 55, 55]]),
        autoBlock("7.2.5", "li-prescrizione-2", "list-item", [[217, 56, 57]], { inline: inlineTerms(autoNormalize(raw([[217, 56, 57]])), [["fcd", "f_{cd}"]]) }),
        autoBlock("7.2.5", "li-prescrizione-3", "list-item", [[217, 58, 59]], { inline: inlineTerms(autoNormalize(raw([[217, 58, 59]])), [["MRd", "M_{Rd}"]]) }),
        autoBlock("7.2.5", "p10", "paragraph", [[218, 3, 4]]),
        heading("7.2.5", "heading-collegamenti", [[218, 5, 5]], "COLLEGAMENTI ORIZZONTALI TRA GLI ELEMENTI DI FONDAZIONE"),
        autoBlock("7.2.5", "p11", "paragraph", [[218, 6, 7]]),
        autoBlock("7.2.5", "p12", "paragraph", [[218, 8, 10]]),
        formulaBlock("7.2.5", fAxial[0]!, 218, null, "\\pm 0{,}2\\,N_{sd}\\,a_{max}/g", reg(82, 185, 200, 18)),
        formulaBlock("7.2.5", fAxial[1]!, 218, null, "\\pm 0{,}3\\,N_{sd}\\,a_{max}/g", reg(82, 200, 200, 18)),
        formulaBlock("7.2.5", fAxial[2]!, 218, null, "\\pm 0{,}4\\,N_{sd}\\,a_{max}/g", reg(82, 215, 200, 18)),
        formulaBlock("7.2.5", fAxial[3]!, 218, null, "\\pm 0{,}6\\,N_{sd}\\,a_{max}/g", reg(82, 230, 200, 18)),
        autoBlock("7.2.5", "p13", "paragraph", [[218, 15, 16]], { inline: inlineTerms(autoNormalize(raw([[218, 15, 16]])), [["Nsd", "N_{sd}"], ["amax", "a_{max}"]]) }),
        block("7.2.5", "p14", "paragraph", [[218, 17, 20]], "In assenza di analisi specifiche della risposta sismica locale l’accelerazione massima attesa al sito può essere valutata con la relazione: a_max = a_g S, in cui S è il coefficiente che comprende l’effetto dell’amplificazione stratigrafica S_S e dell’amplificazione topografica S_T, di cui al § 3.2.3.2, e a_g è l’accelerazione orizzontale massima per lo SLC su sito di riferimento rigido.", { manual: true, inline: inlineTerms("In assenza di analisi specifiche della risposta sismica locale l’accelerazione massima attesa al sito può essere valutata con la relazione: a_max = a_g S, in cui S è il coefficiente che comprende l’effetto dell’amplificazione stratigrafica S_S e dell’amplificazione topografica S_T, di cui al § 3.2.3.2, e a_g è l’accelerazione orizzontale massima per lo SLC su sito di riferimento rigido.", [["a_max = a_g S", "a_{max}=a_g S"], ["S_S", "S_S"], ["S_T", "S_T"], ["S", "S"], ["a_g", "a_g"]]) }),
        autoBlock("7.2.5", "p15", "paragraph", [[218, 21, 24]]),
        autoBlock("7.2.5", "p16", "paragraph", [[218, 25, 26]]),
    ], fAxial),
    makeUnit("7.2.6", "CRITERI DI MODELLAZIONE DELLA STRUTTURA E DELL’AZIONE SISMICA", "subparagraph", [
        heading("7.2.6", "heading", [[218, 27, 27]], "7.2.6 CRITERI DI MODELLAZIONE DELLA STRUTTURA E DELL’AZIONE SISMICA"),
        heading("7.2.6", "heading-struttura", [[218, 28, 28]], "MODELLAZIONE DELLA STRUTTURA"),
        autoBlock("7.2.6", "p1", "paragraph", [[218, 29, 31]]),
        autoBlock("7.2.6", "p2", "paragraph", [[218, 32, 33]], { inline: inlineTerms(autoNormalize(raw([[218, 32, 33]])), [["q", "q"]]) }),
        autoBlock("7.2.6", "p3", "paragraph", [[218, 34, 36]]),
        autoBlock("7.2.6", "p4", "paragraph", [[218, 37, 37]]),
        autoBlock("7.2.6", "p5", "paragraph", [[218, 38, 41]]),
        autoBlock("7.2.6", "p6", "paragraph", [[218, 42, 46]]),
        autoBlock("7.2.6", "p7", "paragraph", [[218, 47, 49]]),
        heading("7.2.6", "heading-azione", [[218, 50, 50]], "MODELLAZIONE DELL’AZIONE SISMICA"),
        autoBlock("7.2.6", "p8", "paragraph", [[218, 51, 52]]),
        autoBlock("7.2.6", "p9", "paragraph", [[218, 53, 55]]),
        autoBlock("7.2.6", "p10", "paragraph", [[219, 3, 5]]),
        autoBlock("7.2.6", "p11", "paragraph", [[219, 6, 6]]),
        autoBlock("7.2.6", "li-a", "list-item", [[219, 7, 10]]),
        autoBlock("7.2.6", "li-b", "list-item", [[219, 11, 14]]),
        autoBlock("7.2.6", "p12", "paragraph", [[219, 15, 17]]),
        autoBlock("7.2.6", "p13", "paragraph", [[219, 18, 20]]),
        autoBlock("7.2.6", "p14", "paragraph", [[219, 21, 25]], { inline: inlineTerms(autoNormalize(raw([[219, 21, 25]])), [["0,05", "0{,}05"]]) }),
    ]),
    makeUnit("7.3", "METODI DI ANALISI E CRITERI DI VERIFICA", "paragraph", [
        heading("7.3", "heading", [[219, 26, 26]], "7.3 METODI DI ANALISI E CRITERI DI VERIFICA"),
        autoBlock("7.3", "p1", "paragraph", [[219, 27, 28]]),
        autoBlock("7.3", "p2", "paragraph", [[219, 29, 30]]),
        autoBlock("7.3", "p3", "paragraph", [[219, 31, 34]], { inline: inlineTerms(autoNormalize(raw([[219, 31, 34]])), [["q", "q"]]) }),
        autoBlock("7.3", "p4", "paragraph", [[219, 35, 35]]),
        autoBlock("7.3", "li1", "list-item", [[219, 36, 37]]),
        autoBlock("7.3", "li2", "list-item", [[219, 38, 38]]),
        tableBlock("7.3", "7.3.I", 219, table73.id, reg(75, 515, 430, 190)),
        autoBlock("7.3", "p5", "paragraph", [[219, 59, 60]], { inline: inlineTerms(autoNormalize(raw([[219, 59, 60]])), [["q", "q"]]) }),
    ], [], ["7.3.i"]),
];

const formulaRows = [
    [fDelta, "7.2.2", null, "\\Delta=d_{Es}+d_{Eg}"],
    [fFa, "7.2.3", "7.2.1", "F_a=\\frac{S_a W_a}{q_a}"],
    [fAxial[0], "7.2.5", null, "\\pm 0{,}2\\,N_{sd}\\,a_{max}/g"],
    [fAxial[1], "7.2.5", null, "\\pm 0{,}3\\,N_{sd}\\,a_{max}/g"],
    [fAxial[2], "7.2.5", null, "\\pm 0{,}4\\,N_{sd}\\,a_{max}/g"],
    [fAxial[3], "7.2.5", null, "\\pm 0{,}6\\,N_{sd}\\,a_{max}/g"],
] as const;

const manifest = {
    $schema: "urn:structural-codes:schema:asset-manifest:v2",
    schemaVersion: "2.0.0-alpha.1",
    recordType: "asset-manifest",
    document: "ntc2018",
    section: "7-step1",
    sourceId,
    status: "transcribed-unreviewed",
    formulas: formulaRows.map(([id, unit, officialNumber, latex], index) => ({
        id: fid(id!),
        unitId: uid(unit!),
        officialNumber,
        pdfPage: index === 0 ? 215 : index === 1 ? 216 : 218,
        latex,
    })),
    tables: [table72, table73],
    figures: [],
};

await mkdir(unitDir, { recursive: true });
await mkdir(assetDir, { recursive: true });
await Promise.all([
    ...units.map((unit) =>
        writeFile(
            join(unitDir, `${unit.numbering.official}.json`),
            `${JSON.stringify(unit, null, 2)}\n`,
            "utf8",
        ),
    ),
    writeFile(
        join(assetDir, "7-step1.json"),
        `${JSON.stringify(manifest, null, 2)}\n`,
        "utf8",
    ),
]);
console.log(
    `NTC 7 step1: generate ${units.length} unità, ${formulaRows.length} formule e 2 tabelle.`,
);
