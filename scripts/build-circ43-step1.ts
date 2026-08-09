/* eslint-disable @typescript-eslint/no-explicit-any */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const sourceId = "circ-7-2019";
const workId = "it-mit:circ:2019-01-21:7-csllpp";
const expressionId = "it-mit:circ:2019-01-21:7-csllpp:original-it";
const profile = "circ43-editorial-profile-0.1.0";
const createdAt = "2026-08-09T00:00:00Z";
const pages = [147, 148, 149, 150, 151, 152, 153, 154];
const sourceDir = join(root, "evidence", sourceId, "pages");
const unitDir = join(root, "corpus", "units", "circ2019");
const assetDir = join(root, "corpus", "assets", "circ2019");
const figureDir = join(root, "corpus", "assets", "figures", "circ2019");

type Region = {
    coordinateSystem: "pdf-points-top-left";
    x: number;
    y: number;
    width: number;
    height: number;
};

type Inline =
    | { kind: "text"; value: string }
    | { kind: "math"; value: string; latex: string };

type Page = {
    printedPage?: string | null;
    textItems: Array<{ sequence: number; text: string; region: Region }>;
};

const pageCache = new Map<number, Page>();
for (const page of pages) {
    const file = join(sourceDir, `page-${String(page).padStart(4, "0")}.json`);
    pageCache.set(page, JSON.parse(readFileSync(file, "utf8")) as Page);
}

const sha256 = (value: string | Uint8Array): string =>
    createHash("sha256").update(value).digest("hex");
const fileSha256 = (file: string): string => sha256(readFileSync(file));
const region = (x: number, y: number, width: number, height: number): Region => ({
    coordinateSystem: "pdf-points-top-left",
    x,
    y,
    width,
    height,
});
const unitId = (number: string): string =>
    `urn:structural-codes:it:unit:circ2019:${number.toLowerCase()}`;
const formulaId = (number: string): string =>
    `urn:structural-codes:it:asset:formula:circ2019:${number.toLowerCase()}`;
const tableId = (number: string): string =>
    `urn:structural-codes:it:asset:table:circ2019:${number.toLowerCase()}`;
const figureId = (number: string): string =>
    `urn:structural-codes:it:asset:figure:circ2019:${number.toLowerCase()}`;
const t = (value: string): Inline => ({ kind: "text", value });
const m = (value: string, latex: string): Inline => ({ kind: "math", value, latex });

function rawFor(pageNumber: number, blockRegion: Region): string {
    const page = pageCache.get(pageNumber);
    if (!page) throw new Error(`evidence mancante per pagina ${pageNumber}`);
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

function transformations(raw: string, normalized: string, manual = true): any[] {
    if (!manual && raw === normalized) return [];
    const result: any[] = [];
    if (/[\u0000-\u001f\u007f-\u009f]/u.test(raw)) {
        result.push({
            operation: "remove-control-character",
            ruleVersion: profile,
            note: "Rimossi i caratteri di controllo privi di resa visuale dal layer testuale estratto.",
        });
    }
    if (/\s{2,}/u.test(raw) || raw !== normalized) {
        result.push({
            operation: "normalize-whitespace",
            ruleVersion: profile,
            note: "Ricostruiti gli spazi e uniti i ritorni a capo tipografici dopo confronto con il render ufficiale.",
        });
    }
    if (manual) {
        result.push({
            operation: "manual-correction",
            ruleVersion: profile,
            note: "Ripristinati accenti, glifi matematici, sillabazioni e notazione confrontati con il render della fonte ufficiale.",
        });
    }
    return result;
}

function evidence(
    page: number,
    blockRegion: Region | null,
    raw: string,
    normalized: string,
    method: "pdf-text" | "manual-transcription" = "pdf-text",
): any {
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
        transformations: transformations(raw, normalized, true),
        rawSha256: sha256(raw),
        normalizedSha256: sha256(normalized),
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
): any {
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
        evidence: evidence(page, blockRegion, raw, normalized),
    };
}

function heading(number: string, title: string, page: number, blockRegion: Region): any {
    return textBlock(number, "heading", "heading", page, blockRegion, `${number} ${title}`);
}

function assetRef(
    number: string,
    suffix: string,
    kind: "formula-ref" | "table-ref" | "figure-ref",
    asset: string,
    page: number,
    blockRegion: Region,
    label: string,
): any {
    return {
        blockId: `${unitId(number)}#block-${suffix}`,
        kind,
        origin: "official",
        assetId: asset,
        evidence: evidence(page, blockRegion, label, label, "manual-transcription"),
    };
}

function parent(number: string): string | null {
    const parts = number.split(".");
    return parts.length <= 1 ? null : unitId(parts.slice(0, -1).join("."));
}

function ancestors(number: string): string[] {
    const parts = number.split(".");
    return parts.slice(1).map((_, index) => unitId(parts.slice(0, index + 1).join(".")));
}

function makeUnit(
    number: string,
    title: string,
    kind: "section" | "subparagraph",
    blocks: any[],
    assets: { formulaIds: string[]; tableIds: string[]; figureIds: string[] },
    extraIssues: any[] = [],
): any {
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
            sortKey: number.replace(/^C/u, "").split(".").map((part) => part.padStart(3, "0")).join("."),
        },
        title,
        titleBlockId: `${unitId(number)}#block-heading`,
        hierarchy: {
            parentId: parent(number),
            ancestorIds: ancestors(number),
            position: Number(number.split(".").at(-1)),
        },
        validity: {
            from: null,
            to: null,
            status: "unknown",
            asOf: "2026-08-09",
        },
        blocks,
        citations: [],
        relations: [],
        assets,
        workflow: {
            status: "extracted",
            createdBy: {
                actorId: "codex:circ43-step1",
                kind: "automated-agent",
                toolVersion: profile,
            },
            createdAt,
            reviews: [],
            openIssues: [
                {
                    issueId: `circ2019-${number.replaceAll(".", "-")}-source-review`,
                    type: "normalization-review",
                    severity: "blocking",
                    note: "Trascrizione confrontata con il render ufficiale nello step; resta obbligatoria la revisione umana indipendente prima della pubblicazione.",
                },
                ...(assets.formulaIds.length + assets.tableIds.length + assets.figureIds.length > 0
                    ? [{
                          issueId: `circ2019-${number.replaceAll(".", "-")}-asset-review`,
                          type: "asset-review",
                          severity: "blocking",
                          note: "Formule, tabelle e figure sono state separate e collocate; resta obbligatoria la revisione umana puntuale sulla fonte ufficiale.",
                      }]
                    : []),
                ...extraIssues,
            ],
        },
    };
}

const f = (number: string, unit: string, page: number, latex: string): any => ({
    id: formulaId(number),
    unitId: unitId(unit),
    officialNumber: `C${number}`,
    pdfPage: page,
    latex,
});

const formulas = [
    f("4.3.1", "C4.3.4.2", 148, "M_{Rd}=M_{pl,a,Rd}+(M_{pl,Rd}-M_{pl,a,Rd})\\,\\eta"),
    f("4.3.2", "C4.3.4.3.1.2", 150, "\\frac{F_l^2}{P_{l,Rd}^2}+\\frac{F_t^2}{P_{t,Rd}^2}\\le1,0"),
    f("4.3.3", "C4.3.4.3.3", 150, "V_{ld}=F_{cf}=\\min\\left\\{\\frac{A_a f_{yk}}{\\gamma_a};0,85\\frac{f_{ck}A_c}{\\gamma_c}+\\frac{A_{se}f_{sk}}{\\gamma_s}\\right\\}"),
    f("4.3.4", "C4.3.4.3.3", 150, "V_{ld}=F_{cf}+\\frac{A_s f_{sk}}{\\gamma_s}+\\frac{A_{ap}f_{yp}}{\\gamma_{ap}}=\\min\\left\\{\\frac{A_a f_{yk}}{\\gamma_a};0,85\\frac{f_{ck}A_c}{\\gamma_c}+\\frac{A_{se}f_{sk}}{\\gamma_s}\\right\\}+\\frac{A_s f_{sk}}{\\gamma_s}+\\frac{A_{ap}f_{yp}}{\\gamma_{ap}}"),
    f("4.3.5", "C4.3.4.3.3", 151, "V_{ld}=F_c=\\eta F_{cf}=\\frac{M_{Rd}-M_{a,pl,Rd}}{M_{pl,Rd}-M_{a,pl,Rd}}F_{cf}"),
    f("4.3.6", "C4.3.4.3.3", 151, "V_{ld}=F_c+\\frac{A_s f_{sk}}{\\gamma_s}+\\frac{A_{ap}f_{yp}}{\\gamma_{ap}}"),
    f("4.3.7", "C4.3.4.3.5", 151, "v_{Ed}=\\frac{\\Delta F_s}{\\Delta x\\,h_f}"),
    f("4.3.8", "C4.3.4.3.5", 151, "\\frac{A_{sf}f_{sk}}{\\gamma_s\\,s_f}\\ge v_{Ed}h_f"),
    f("4.3.9", "C4.3.4.3.5", 151, "v_{Ed}\\le0,3\\left[1-\\frac{f_{ck}}{250}\\right]\\frac{f_{ck}}{\\gamma_c}"),
    f("4.3.10", "C4.3.4.3.6", 152, "M_{b,Rd}=\\chi_{LT}\\,M_{Rd}"),
    f("4.3.11", "C4.3.4.3.6", 152, "\\lambda_{LT}=\\sqrt{\\frac{M_{Rk}}{M_{cr}}}"),
    f("4.3.12", "C4.3.4.3.6", 152, "k_s=\\frac{1}{k_1}+\\frac{1}{k_2}"),
    f("4.3.13", "C4.3.4.3.6", 152, "k_2=\\frac{E_a t_w^3}{4(1-\\nu^2)\\,h_s}"),
];

const tables = [
    {
        id: tableId("4.3.i"),
        unitId: unitId("C4.3.2.1"),
        officialNumber: "C4.3.I",
        pdfPage: 147,
        caption: "Tabella C4.3.I - Classificazione di piattabande compresse in profilati o in sezioni saldate parzialmente rivestiti",
        columnCount: 2,
        headers: [[
            { text: "Schema della piattabanda" },
            { text: "Condizione di classificazione" },
        ]],
        rows: [
            [
                { text: "Schemi 1 e 2; 0,8 ≤ b_c/b ≤ 1,0", latex: "0,8\\le\\frac{b_c}{b}\\le1,0" },
                { text: "Classe 1", latex: "\\frac{c}{t}\\le9\\,\\varepsilon" },
            ],
            [{ text: "Schemi 1 e 2" }, { text: "Classe 2: 9 ε < c/t ≤ 14 ε", latex: "9\\,\\varepsilon<\\frac{c}{t}\\le14\\,\\varepsilon" }],
            [{ text: "Schemi 1 e 2" }, { text: "Classe 3: 14 ε < c/t ≤ 20 ε", latex: "14\\,\\varepsilon<\\frac{c}{t}\\le20\\,\\varepsilon" }],
            [{ text: "Schemi 1 e 2" }, { text: "Classe 4: c/t > 20 ε", latex: "\\frac{c}{t}>20\\,\\varepsilon" }],
        ],
        notes: [
            "La colonna sinistra della fonte contiene due disegni numerati 1 e 2; il disegno non è rappresentabile nel formato tabellare corrente ed è mantenuto come issue bloccante di revisione asset.",
            "La relazione comune riportata sotto gli schemi è 0,8 ≤ b_c/b ≤ 1,0.",
        ],
    },
    {
        id: tableId("4.3.ii"),
        unitId: unitId("C4.3.4.3.6"),
        officialNumber: "C4.3.II",
        pdfPage: 153,
        caption: "Tabella C4.3.II - Altezza massima in mm dell’elemento di acciaio non rivestito",
        columnCount: 5,
        headers: [
            [
                { text: "Elemento di acciaio", rowSpan: 2 },
                { text: "Grado nominale dell’acciaio", colSpan: 4 },
            ],
            [{ text: "S235" }, { text: "S275" }, { text: "S355" }, { text: "S420 e S460" }],
        ],
        rows: [
            [{ text: "IPE" }, { text: "600" }, { text: "550" }, { text: "400" }, { text: "270" }],
            [{ text: "HE" }, { text: "800" }, { text: "700" }, { text: "650" }, { text: "500" }],
        ],
        notes: [],
    },
];

const figureRegions: Record<string, { page: number; region: Region; filename: string; caption: string }> = {
    "4.3.1": { page: 148, region: region(140, 198, 330, 92), filename: "figc4.3.1.png", caption: "Figura C4.3.1 - Distribuzione delle tensioni plastiche allo SLU per il calcolo del momento resistente positivo" },
    "4.3.2": { page: 148, region: region(140, 395, 330, 87), filename: "figc4.3.2.png", caption: "Figura C4.3.2 - Distribuzione delle tensioni plastiche allo SLU per il calcolo del momento resistente negativo" },
    "4.3.3": { page: 148, region: region(130, 580, 350, 127), filename: "figc4.3.3.png", caption: "Figura C4.3.3 - Relazione tra il momento resistente della trave e il grado di connessione per connettori a taglio duttili" },
    "4.3.4": { page: 149, region: region(150, 210, 350, 60), filename: "figc4.3.4.png", caption: "Figura C4.3.4 – Trave d’acciaio con soletta collaborante" },
    "4.3.5": { page: 149, region: region(110, 300, 420, 195), filename: "figc4.3.5.png", caption: "Figura C4.3.5 – Legame tra resistenza della trave e resistenza della connessione" },
    "4.3.6": { page: 151, region: region(145, 400, 330, 168), filename: "figc4.3.6.png", caption: "Figura C4.3.6. Distribuzione della sollecitazione di taglio longitudinale nella piattabanda di calcestruzzo" },
    "4.3.7": { page: 152, region: region(140, 345, 340, 85), filename: "figc4.3.7.png", caption: "Figura C4.3.7 - Telaio ad U invertita: A-B-C-D" },
    "4.3.8": { page: 153, region: region(75, 386, 455, 118), filename: "figc4.3.8.png", caption: "Figura C4.3.8 - Distribuzione plastica delle tension: (a) asse neutro nel calcestruzzo sopra la lamiera; (b) asse neutro che taglia la lamiera grecata" },
    "4.3.9": { page: 154, region: region(70, 100, 455, 150), filename: "figc4.3.9.png", caption: "Figura C4.3.9 - Diagramma di interazione parziale calcestruzzo lamiera" },
};

const figures = Object.entries(figureRegions).map(([number, item]) => ({
    id: figureId(number),
    unitId: unitId(number === "4.3.1" || number === "4.3.2" || number === "4.3.3" ? "C4.3.4.2" : number === "4.3.4" || number === "4.3.5" ? "C4.3.4.3" : number === "4.3.6" || number === "4.3.7" ? "C4.3.4.3.5" : "C4.3.6.2"),
    officialNumber: `C4.3.${number.split(".").at(-1)}`,
    pdfPage: item.page,
    caption: item.caption,
    alt: item.caption,
    imagePath: `figures/circ2019/${item.filename}`,
    region: item.region,
    sha256: fileSha256(join(figureDir, item.filename)),
}));

const P = {
    p147: {
        heading: region(70, 90, 460, 20), intro1: region(70, 110, 455, 24), intro2: region(70, 133, 455, 23), intro3: region(70, 154, 455, 24),
        p4: region(70, 178, 455, 13), p5: region(70, 191, 455, 32), p6: region(70, 225, 455, 13), p7: region(70, 239, 455, 24), p8: region(70, 276, 455, 24),
        h431: region(70, 306, 260, 16), p431: region(70, 320, 455, 24), li431a: region(70, 344, 260, 12), li431b: region(70, 357, 260, 12), p431b: region(70, 370, 300, 13),
        h432: region(70, 391, 250, 16), h4321: region(70, 412, 300, 16), p4321a: region(70, 426, 455, 22), p4321b: region(70, 449, 455, 22), p4321c: region(70, 474, 455, 29), table: region(70, 520, 330, 132),
    },
    p148: {
        h434: region(70, 92, 460, 16), h4342: region(70, 113, 300, 16), p1: region(70, 127, 455, 32), p2: region(70, 163, 455, 38), fig1: region(140, 198, 330, 92), p3: region(70, 286, 455, 24), p4: region(70, 313, 455, 32), p5: region(70, 363, 455, 29), fig2: region(140, 395, 330, 87), p6: region(70, 487, 455, 44), formula1: region(70, 531, 455, 28), p7: region(70, 554, 455, 14), fig3: region(130, 580, 350, 127),
    },
    p149: {
        h4343: region(70, 94, 460, 18), p1: region(70, 110, 455, 39), p2: region(70, 157, 455, 50), fig4: region(150, 210, 350, 60), p3: region(70, 275, 455, 18), fig5: region(110, 300, 420, 195), p4: region(70, 501, 455, 31), p5: region(70, 535, 455, 18), p6: region(70, 559, 455, 14), p7: region(70, 582, 455, 18), p8: region(70, 606, 455, 32), p9: region(70, 651, 455, 60),
    },
    p150: {
        h431: region(70, 94, 460, 18), h4311: region(70, 111, 300, 16), p1: region(70, 127, 455, 40), spacing: region(70, 174, 455, 90), p2: region(70, 276, 455, 47), h4312: region(70, 333, 460, 16), p3: region(70, 350, 455, 40), formula2: region(70, 399, 455, 28), p4: region(70, 426, 455, 40), h433: region(70, 475, 460, 16), p5: region(70, 491, 455, 40), formula3: region(70, 539, 455, 29), p6: region(70, 569, 455, 22), p7: region(70, 581, 455, 22), formula4: region(70, 610, 455, 28), p8: region(70, 640, 455, 20), p9: region(70, 666, 455, 35),
    },
    p151: {
        formula5: region(70, 88, 455, 30), p1: region(70, 127, 455, 25), formula6: region(70, 145, 455, 30), p2: region(70, 184, 455, 30), p3: region(70, 219, 455, 18), h435: region(70, 246, 300, 16), p4: region(70, 263, 455, 49), p5: region(70, 318, 455, 36), formula7: region(70, 353, 455, 27), p6: region(70, 381, 455, 22), fig6: region(145, 400, 330, 168), p7: region(70, 569, 300, 16), formula8: region(70, 580, 455, 28), p8: region(70, 611, 455, 24), formula9: region(70, 632, 455, 28), p9: region(70, 663, 455, 20),
    },
    p152: {
        h436: region(70, 94, 460, 18), p1: region(70, 112, 455, 29), p2: region(70, 146, 455, 20), p3: region(70, 170, 455, 18), formula10: region(70, 191, 455, 27), p4: region(70, 210, 455, 28), formula11: region(70, 240, 455, 28), p5: region(70, 264, 455, 30), intro: region(70, 299, 250, 14), liA: region(80, 311, 455, 12), liB: region(80, 321, 455, 14), liC: region(80, 332, 455, 14), fig7: region(140, 345, 340, 85), p6: region(70, 432, 455, 18), formula12: region(70, 455, 455, 28), p7: region(70, 481, 455, 54), formula13: region(70, 535, 455, 28), p8: region(70, 563, 455, 16), p9: region(70, 578, 455, 18), liA2: region(70, 597, 455, 21), liB2: region(70, 618, 455, 21), liC2: region(70, 639, 455, 13), liD2: region(70, 650, 455, 13), liE2: region(70, 661, 455, 13), liF2: region(70, 672, 455, 13), liG2: region(70, 682, 455, 18),
    },
    p153: {
        hItem: region(70, 94, 455, 25), table: region(70, 160, 350, 70), h436: region(70, 240, 460, 18), h4362: region(70, 260, 460, 18), p1: region(70, 275, 455, 28), liA: region(85, 308, 455, 13), liB: region(85, 321, 455, 13), liC: region(85, 334, 455, 13), liD: region(85, 347, 455, 13), p2: region(70, 362, 455, 22), fig8: region(75, 386, 455, 118), p3: region(70, 505, 455, 45), p4: region(70, 548, 455, 28), p5: region(70, 585, 455, 16), p6: region(70, 609, 455, 25),
    },
    p154: { fig9: region(65, 100, 460, 150) },
};

const b = (number: string, suffix: string, kind: "paragraph" | "list-item", page: number, r: Region, text: string, inline?: Inline[]) =>
    textBlock(number, suffix, kind, page, r, text, inline);
const h = (number: string, title: string, page: number, r: Region) => heading(number, title, page, r);
const fr = (number: string, suffix: string, formula: string, page: number, r: Region) =>
    assetRef(number, suffix, "formula-ref", formulaId(formula), page, r, `[C${formula}]`);
const tr = (number: string, suffix: string, table: string, page: number, r: Region) =>
    assetRef(number, suffix, "table-ref", tableId(table), page, r, `Tabella C${table}`);
const gr = (number: string, suffix: string, figure: string, page: number, r: Region) =>
    assetRef(number, suffix, "figure-ref", figureId(figure), page, r, `Figura C${figure}`);

const units = [
    makeUnit("C4.3", "COSTRUZIONI COMPOSTE DI ACCIAIO-CALCESTRUZZO", "section", [
        h("C4.3", "COSTRUZIONI COMPOSTE DI ACCIAIO-CALCESTRUZZO", 147, P.p147.heading),
        b("C4.3", "001", "paragraph", 147, P.p147.intro1, "Per le costruzioni composte acciaio-calcestruzzo, la gamma degli acciai da carpenteria normalmente impiegabili è estesa dall’acciaio S235 fino all’acciaio S460, come nel caso dell’acciaio."),
        b("C4.3", "002", "paragraph", 147, P.p147.intro2, "Il calcestruzzo ordinario deve avere classe non inferiore a C20/25 né superiore a C60/75, mentre il calcestruzzo con aggregati leggeri, la cui densità non può essere inferiore a 1800 kg/m³, deve avere classe non inferiore a LC20/22 e non superiore a LC55/60.", [t("Il calcestruzzo ordinario deve avere classe non inferiore a C20/25 né superiore a C60/75, mentre il calcestruzzo con aggregati leggeri, la cui densità non può essere inferiore a 1800 kg/"), m("m³", "m^3"), t(", deve avere classe non inferiore a LC20/22 e non superiore a LC55/60.")]),
        b("C4.3", "003", "paragraph", 147, P.p147.intro3, "Calcestruzzi di classe di resistenza superiori a C45/55 e LC 40/44, rispettivamente, richiedono comunque uno studio adeguato e specifiche procedure per il controllo di qualità."),
        b("C4.3", "004", "paragraph", 147, P.p147.p4, "Particolare attenzione deve essere posta al sistema di connessione, che determina il comportamento di queste strutture."),
        b("C4.3", "005", "paragraph", 147, P.p147.p5, "La classificazione delle sezioni è analoga a quella delle strutture metalliche, ma è possibile tenere conto del favorevole effetto irrigidente della soletta che può impedire alcuni fenomeni di instabilità locale consentendo una collocazione delle sezioni in classi caratterizzate da maggiore duttilità."),
        b("C4.3", "006", "paragraph", 147, P.p147.p6, "Oltre agli usuali stati limite, devono essere considerati anche lo SLU di resistenza e lo SLE della connessione acciaio-calcestruzzo."),
        b("C4.3", "007", "paragraph", 147, P.p147.p7, "Analogamente a quanto previsto per le strutture metalliche, anche per l’analisi globale delle strutture composte è possibile impiegare, in alternativa il metodo plastico, il metodo elastico con ridistribuzione o il metodo non-lineare."),
        b("C4.3", "008", "paragraph", 147, P.p147.p8, "Per l’ulteriore approfondimento di elementi non trattati o non completamente trattati nelle NTC e nella presente Circolare si può fare utile riferimento a normative di comprovata validità, in particolare agli Eurocodici."),
    ], { formulaIds: [], tableIds: [], figureIds: [] }),
    makeUnit("C4.3.1", "VALUTAZIONE DELLA SICUREZZA", "subparagraph", [
        h("C4.3.1", "VALUTAZIONE DELLA SICUREZZA", 147, P.p147.h431),
        b("C4.3.1", "001", "paragraph", 147, P.p147.p431, "Oltre a quanto indicato per le strutture di calcestruzzo armato e per quelle in carpenteria metallica, le NTC richiedono di considerare ulteriori stati limite, ed in particolare:"),
        b("C4.3.1", "002", "list-item", 147, P.p147.li431a, "Stato limite di resistenza della connessione acciaio-calcestruzzo;"),
        b("C4.3.1", "003", "list-item", 147, P.p147.li431b, "Stato limite di esercizio della connessione acciaio-calcestruzzo."),
        b("C4.3.1", "004", "paragraph", 147, P.p147.p431b, "E’ inoltre richiesta l’esplicita considerazione delle Fasi Costruttive."),
    ], { formulaIds: [], tableIds: [], figureIds: [] }),
    makeUnit("C4.3.2", "ANALISI STRUTTURALE", "subparagraph", [h("C4.3.2", "ANALISI STRUTTURALE", 147, P.p147.h432)], { formulaIds: [], tableIds: [], figureIds: [] }),
    makeUnit("C4.3.2.1", "CLASSIFICAZIONE DELLE SEZIONI", "subparagraph", [
        h("C4.3.2.1", "CLASSIFICAZIONE DELLE SEZIONI", 147, P.p147.h4321),
        b("C4.3.2.1", "001", "paragraph", 147, P.p147.p4321a, "La classificazione di una sezione composta acciaio-calcestruzzo può farsi con riferimento alla sola sezione metallica, adottando quindi come classe quella meno favorevole delle parti metalliche."),
        b("C4.3.2.1", "002", "paragraph", 147, P.p147.p4321b, "In ogni caso, una piattabanda metallica, efficacemente collegata ad una soletta di calcestruzzo mediante connettori soddisfacenti alle condizioni date nel § 4.3.4.1 delle NTC, può essere classificata in classe 1."),
        b("C4.3.2.1", "003", "paragraph", 147, P.p147.p4321c, "Una piattabanda metallica di una sezione parzialmente rivestita di calcestruzzo può essere classificata in accordo con la Tabella C4.3.I. In una sezione parzialmente rivestita di calcestruzzo, il calcestruzzo che circonda l’anima dovrebbe essere efficacemente collegato alla sezione metallica e dovrebbe impedire l’instabilità dell’anima o della piattabanda compressa verso l’anima."),
        tr("C4.3.2.1", "004", "4.3.i", 147, P.p147.table),
    ], { formulaIds: [], tableIds: [tableId("4.3.i")], figureIds: [] }, [{ issueId: "circ2019-c4-3-2-1-table-diagrams", type: "asset-review", severity: "blocking", note: "La colonna grafica della Tabella C4.3.I contiene schemi ufficiali non rappresentabili come celle testuali; verificare la resa editoriale prima della pubblicazione." }]),
    makeUnit("C4.3.4", "TRAVI CON SOLETTA COLLABORANTE", "subparagraph", [h("C4.3.4", "TRAVI CON SOLETTA COLLABORANTE", 148, P.p148.h434)], { formulaIds: [], tableIds: [], figureIds: [] }),
    makeUnit("C4.3.4.2", "RESISTENZA DELLE SEZIONI", "subparagraph", [
        h("C4.3.4.2", "RESISTENZA DELLE SEZIONI", 148, P.p148.h4342),
        b("C4.3.4.2", "001", "paragraph", 148, P.p148.p1, "Il momento resistente, M_pl,Rd, di una sezione composta di classe 1 o 2 si valuta nell’ipotesi di conservazione delle sezioni piane, assumendo un diagramma equilibrato delle tensioni nella sezione, come indicato in Figura C4.3.1, e considerando nullo il contributo del calcestruzzo teso.", [t("Il momento resistente, "), m("M_pl,Rd", "M_{pl,Rd}"), t(", di una sezione composta di classe 1 o 2 si valuta nell’ipotesi di conservazione delle sezioni piane, assumendo un diagramma equilibrato delle tensioni nella sezione, come indicato in Figura C4.3.1, e considerando nullo il contributo del calcestruzzo teso.")]),
        b("C4.3.4.2", "002", "paragraph", 148, P.p148.p2, "L’armatura longitudinale in soletta si ipotizza plasticizzata, sia in trazione sia in compressione, così come l’acciaio strutturale. A momento positivo, la parte compressa della sezione efficace della soletta di calcestruzzo si considera uniformemente compressa con tensione di compressione pari 0,85 f_cd, e la risultante di compressione è detta N_cf.", [t("L’armatura longitudinale in soletta si ipotizza plasticizzata, sia in trazione sia in compressione, così come l’acciaio strutturale. A momento positivo, la parte compressa della sezione efficace della soletta di calcestruzzo si considera uniformemente compressa con tensione di compressione pari "), m("0,85 f_cd", "0,85 f_{cd}"), t(", e la risultante di compressione è detta "), m("N_cf", "N_{cf}"), t(".")]),
        gr("C4.3.4.2", "003", "4.3.1", 148, P.p148.fig1),
        b("C4.3.4.2", "004", "paragraph", 148, P.p148.p3, "Si definisce, in questo paragrafo, grado di connessione η il rapporto N_c/N_cf tra il massimo sforzo trasmissibile dalla connessione N_c e la risultante delle compressioni in soletta N_cf.", [t("Si definisce, in questo paragrafo, grado di connessione "), m("η", "\\eta"), t(" il rapporto "), m("N_c/N_cf", "\\frac{N_c}{N_{cf}}"), t(" tra il massimo sforzo trasmissibile dalla connessione "), m("N_c", "N_c"), t(" e la risultante delle compressioni in soletta "), m("N_cf", "N_{cf}"), t(".")]),
        b("C4.3.4.2", "005", "paragraph", 148, P.p148.p4, "In via approssimata tale rapporto si può assumere pari al grado di connessione η definito al § 4.3.4.3 delle NTC come il rapporto tra il numero effettivo di connettori a taglio presenti e il numero di connettori che assicurano il completo sviluppo del momento resistente plastico della sezione composta.", [t("In via approssimata tale rapporto si può assumere pari al grado di connessione "), m("η", "\\eta"), t(" definito al § 4.3.4.3 delle NTC come il rapporto tra il numero effettivo di connettori a taglio presenti e il numero di connettori che assicurano il completo sviluppo del momento resistente plastico della sezione composta.")]),
        b("C4.3.4.2", "006", "paragraph", 148, P.p148.p5, "Nel caso di connessione a pieno ripristino si ha N_c=N_cf.", [t("Nel caso di connessione a pieno ripristino si ha "), m("N_c=N_cf", "N_c=N_{cf}"), t(".")]),
        b("C4.3.4.2", "007", "paragraph", 148, P.p148.p5, "La resistenza del calcestruzzo a trazione è trascurata ed in caso di momento negativo la connessione a taglio in genere è sufficiente a trasferire la risultante di trazione delle barre d’armatura in soletta, calcolata ipotizzando le barre d’armatura completamente snervate e soggette ad una tensione f_sd (vedi Figura C4.3.2).", [t("La resistenza del calcestruzzo a trazione è trascurata ed in caso di momento negativo la connessione a taglio in genere è sufficiente a trasferire la risultante di trazione delle barre d’armatura in soletta, calcolata ipotizzando le barre d’armatura completamente snervate e soggette ad una tensione "), m("f_sd", "f_{sd}"), t(" (vedi Figura C4.3.2).")]),
        gr("C4.3.4.2", "008", "4.3.2", 148, P.p148.fig2),
        b("C4.3.4.2", "009", "paragraph", 148, P.p148.p6, "Quando la connessione a taglio è a parziale ripristino di resistenza (N_c/N_cf < 1) e realizzata con connettori “duttili”, il momento resistente, M_Rd, è calcolato utilizzando il metodo rigido-plastico ed il valore ridotto della risultante delle compressioni in soletta, N_c. In particolare, può assumersi una relazione lineare tra il grado di connessione η ed il momento resistente ottenibile, vedi Figura C4.3.3, rappresentata dalla formula", [t("Quando la connessione a taglio è a parziale ripristino di resistenza ("), m("N_c/N_cf < 1", "\\frac{N_c}{N_{cf}}<1"), t(") e realizzata con connettori “duttili”, il momento resistente, "), m("M_Rd", "M_{Rd}"), t(", è calcolato utilizzando il metodo rigido-plastico ed il valore ridotto della risultante delle compressioni in soletta, "), m("N_c", "N_c"), t(". In particolare, può assumersi una relazione lineare tra il grado di connessione "), m("η", "\\eta"), t(" ed il momento resistente ottenibile, vedi Figura C4.3.3, rappresentata dalla formula")]),
        fr("C4.3.4.2", "010", "4.3.1", 148, P.p148.formula1),
        b("C4.3.4.2", "011", "paragraph", 148, P.p148.p7, "dove M_pl,a,Rd è il momento plastico della sola sezione di acciaio.", [t("dove "), m("M_pl,a,Rd", "M_{pl,a,Rd}"), t(" è il momento plastico della sola sezione di acciaio.")]),
        gr("C4.3.4.2", "012", "4.3.3", 148, P.p148.fig3),
    ], { formulaIds: [formulaId("4.3.1")], tableIds: [], figureIds: [figureId("4.3.1"), figureId("4.3.2"), figureId("4.3.3")] }),
    makeUnit("C4.3.4.3", "SISTEMI DI CONNESSIONE ACCIAIO-CALCESTRUZZO", "subparagraph", [
        h("C4.3.4.3", "SISTEMI DI CONNESSIONE ACCIAIO-CALCESTRUZZO", 149, P.p149.h4343),
        b("C4.3.4.3", "001", "paragraph", 149, P.p149.p1, "Nelle NTC, in linea con la UNI EN 1994 e con le CNR 10016/2000, per le travi con soletta collaborante, sono considerate sia connessioni “complete” a taglio, sia connessioni “parziali” a taglio."),
        b("C4.3.4.3", "002", "paragraph", 149, P.p149.p1, "Nel seguito viene più dettagliatamente illustrato il concetto di connessione a taglio (“completa” o “parziale”) e vengono illustrate le limitazioni applicative."),
        b("C4.3.4.3", "003", "paragraph", 149, P.p149.p2, "Si ha una connessione a taglio “completa” quando i connettori, nel loro insieme, sono così robusti che la capacità portante limite della struttura è determinata dalla massima resistenza flessionale. Ad esempio, la capacità portante limite della trave di acciaio con soletta collaborante rappresentata in Figura C4.3.4, semplicemente appoggiata agli estremi e soggetta ad un carico uniformemente distribuito, nel caso di connessione a taglio “completa” lungo la sezione III si raggiunge quando nella sezione II si stabilisce la distribuzione di tensioni normali che corrisponde al momento plastico."),
        gr("C4.3.4.3", "004", "4.3.4", 149, P.p149.fig4),
        b("C4.3.4.3", "005", "paragraph", 149, P.p149.p3, "Nel caso di connessione “completa” a taglio, pertanto, un eventuale incremento del numero dei connettori a taglio nella sezione III non si tradurrebbe in aumento della capacità portante, essendo determinante la resistenza flessionale."),
        gr("C4.3.4.3", "006", "4.3.5", 149, P.p149.fig5),
        b("C4.3.4.3", "007", "paragraph", 149, P.p149.p4, "Per contro, disponendo connettori in minor numero si avrà una capacità portante ridotta, che dipende dalla numerosità dei connettori disposti nella sezione III, perché si riduce la risultante delle tensioni normali (di trazione e compressione) e quindi il momento limite nella sezione II: in questo caso si parla di connessione “parziale” a taglio."),
        b("C4.3.4.3", "008", "paragraph", 149, P.p149.p5, "In Figura C4.3.5 è schematizzato quanto sopra esposto: in ascisse è riportata la resistenza della connessione a taglio nella sezione III, in ordinate la capacità portante ultima della trave composta."),
        b("C4.3.4.3", "009", "paragraph", 149, P.p149.p6, "Al limite, quando mancassero del tutto i connettori, la resistenza della soletta può essere trascurata rispetto a quella della trave di acciaio."),
        b("C4.3.4.3", "010", "paragraph", 149, P.p149.p7, "L’applicazione della connessione “parziale” a taglio ha interesse per le travi composte acciaio-calcestruzzo nelle quali non è necessario sfruttare a fondo la collaborazione tra i due materiali per ottenere la resistenza richiesta."),
        b("C4.3.4.3", "011", "paragraph", 149, P.p149.p8, "Questo concetto si applica alle travi composte quando, ad esempio, le solette vengono gettate su casseri non puntellati, ma sostenuti direttamente dalle travi di acciaio. Le sezioni di acciaio devono essere dimensionate per sostenere il peso del getto cosicché, dopo l’indurimento del calcestruzzo, la connessione “completa” può portare a travi composte più prestazionali del richiesto."),
        b("C4.3.4.3", "012", "paragraph", 149, P.p149.p9, "Un altro caso in cui questo concetto si applica è quello in cui la progettazione delle travi composte è governata dalle limitazioni di deformabilità negli stati limite di esercizio; in tal caso, infatti, la resistenza ultima della sezione che ne consegue risulta sovrabbondante. Situazione analoga si ha quando, per ragioni tecniche o economiche, il progettista è portato a preferire una sezione maggiore delle travi metalliche e un numero minore di connettori, piuttosto che travi con sezione di acciaio ridotta e maggior numero di connettori, come potrebbe accadere quando la soletta è gettata su una lamiera grecata, che limita posizione e numero dei connettori a causa della posizione e larghezza delle onde."),
    ], { formulaIds: [], tableIds: [], figureIds: [figureId("4.3.4"), figureId("4.3.5")] }),
    makeUnit("C4.3.4.3.1", "CONNESSIONI A TAGLIO CON PIOLI", "subparagraph", [h("C4.3.4.3.1", "CONNESSIONI A TAGLIO CON PIOLI", 150, P.p150.h431)], { formulaIds: [], tableIds: [], figureIds: [] }),
    makeUnit("C4.3.4.3.1.1", "DISPOSIZIONI E LIMITAZIONI", "subparagraph", [
        h("C4.3.4.3.1.1", "DISPOSIZIONI E LIMITAZIONI", 150, P.p150.h4311),
        b("C4.3.4.3.1.1", "001", "paragraph", 150, P.p150.p1, "Le regole di progetto contenute nel § 4.3.4 delle NTC per la verifica delle travi composte acciaio-calcestruzzo riguardano elementi strutturali realizzati con connettori a taglio dotati di comportamento duttile. In particolare, tale condizione è imprescindibile allorquando si applichi il calcolo plastico per la definizione del momento resistente della trave. Nelle NTC (§ 4.3.4.3.1.1) sono indicate le condizioni che si devono verificare per assumere l’ipotesi di connettori duttili."),
        b("C4.3.4.3.1.1", "002", "paragraph", 150, P.p150.spacing, "La spaziatura massima tra i connettori deve essere pari a s_MAX = 22 · t_f · √(235/f_yk) per le travi collaboranti con solette piene o solette gettate su lamiere con greche parallele all’asse della trave; s_MAX = 15 · t_f · √(235/f_yk) nel caso in cui le greche della lamiera siano ortogonali all’asse della trave, dove con t_f si è indicato lo spessore della piattabanda del profilo e con f_yk la tensione di snervamento della piattabanda del profilo. In ogni caso la spaziatura massima deve essere inferiore ad 800 mm. La spaziatura minima dei connettori a pioli deve essere non minore di 5 volte il diametro del gambo del connettore. In direzione ortogonale alla forza di scorrimento l’interasse dei pioli non deve essere inferiore a 2,5 volte il diametro del gambo per le solette di calcestruzzo piene ed a 4 volte il diametro del gambo per tutti gli altri tipi di soletta.", [t("La spaziatura massima tra i connettori deve essere pari a "), m("s_MAX = 22 · t_f · √(235/f_yk)", "s_{MAX}=22\\,t_f\\,\\sqrt{235/f_{yk}}"), t(" per le travi collaboranti con solette piene o solette gettate su lamiere con greche parallele all’asse della trave; "), m("s_MAX = 15 · t_f · √(235/f_yk)", "s_{MAX}=15\\,t_f\\,\\sqrt{235/f_{yk}}"), t(" nel caso in cui le greche della lamiera siano ortogonali all’asse della trave, dove con "), m("t_f", "t_f"), t(" si è indicato lo spessore della piattabanda del profilo e con "), m("f_yk", "f_{yk}"), t(" la tensione di snervamento della piattabanda del profilo. In ogni caso la spaziatura massima deve essere inferiore ad 800 mm. La spaziatura minima dei connettori a pioli deve essere non minore di 5 volte il diametro del gambo del connettore. In direzione ortogonale alla forza di scorrimento l’interasse dei pioli non deve essere inferiore a 2,5 volte il diametro del gambo per le solette di calcestruzzo piene ed a 4 volte il diametro del gambo per tutti gli altri tipi di soletta.")]),
        b("C4.3.4.3.1.1", "003", "paragraph", 150, P.p150.p2, "I connettori possono essere disposti uniformemente tra i punti di momento massimo e minimo della trave solo nel caso di sezioni di classe 1 e classe 2 e se il fattore di connessione η rispetta le limitazioni indicate. Se l’azione composta della connessione è tale da definire una sezione con un momento plastico resistente maggiore di 2,5 volte quello della sola sezione di acciaio è necessario eseguire verifiche supplementari nelle sezioni intermedie tra quelle di massimo e minimo momento perché in tale caso il sistema di connessione potrebbe avere un comportamento non duttile.", [t("I connettori possono essere disposti uniformemente tra i punti di momento massimo e minimo della trave solo nel caso di sezioni di classe 1 e classe 2 e se il fattore di connessione "), m("η", "\\eta"), t(" rispetta le limitazioni indicate. Se l’azione composta della connessione è tale da definire una sezione con un momento plastico resistente maggiore di 2,5 volte quello della sola sezione di acciaio è necessario eseguire verifiche supplementari nelle sezioni intermedie tra quelle di massimo e minimo momento perché in tale caso il sistema di connessione potrebbe avere un comportamento non duttile.")]),
    ], { formulaIds: [], tableIds: [], figureIds: [] }),
    makeUnit("C4.3.4.3.1.2", "RESISTENZA DEI CONNETTORI (A SOLLECITAZIONI COMBINATE)", "subparagraph", [
        h("C4.3.4.3.1.2", "RESISTENZA DEI CONNETTORI (A SOLLECITAZIONI COMBINATE)", 150, P.p150.h4312),
        b("C4.3.4.3.1.2", "001", "paragraph", 150, P.p150.p3, "Quando i connettori a taglio disposti sul profilo di acciaio sono simultaneamente considerati efficaci per due elementi ortogonali, come ad esempio nel caso di una trave composta longitudinale e di una soletta composta, si deve considerare la combinazione delle forze di connessione provenienti dai due elementi strutturali e la verifica di resistenza del connettore può essere eseguita con la formula."),
        fr("C4.3.4.3.1.2", "002", "4.3.2", 150, P.p150.formula2),
        b("C4.3.4.3.1.2", "003", "paragraph", 150, P.p150.p4, "dove F_l è l’azione longitudinale di progetto derivante dall’elemento principale, mentre F_t è la forza di progetto trasversale derivante dall’elemento secondario e P_l,Rd e P_t,Rd sono le resistenze a taglio del singolo connettore in direzione longitudinale e trasversale. La resistenza del connettore nelle due direzioni può assumere valori differenti a causa del diverso grado di ricoprimento offerto dal calcestruzzo al connettore a piolo nelle due direzioni (longitudinale e trasversale).", [t("dove "), m("F_l", "F_l"), t(" è l’azione longitudinale di progetto derivante dall’elemento principale, mentre "), m("F_t", "F_t"), t(" è la forza di progetto trasversale derivante dall’elemento secondario e "), m("P_l,Rd", "P_{l,Rd}"), t(" e "), m("P_t,Rd", "P_{t,Rd}"), t(" sono le resistenze a taglio del singolo connettore in direzione longitudinale e trasversale. La resistenza del connettore nelle due direzioni può assumere valori differenti a causa del diverso grado di ricoprimento offerto dal calcestruzzo al connettore a piolo nelle due direzioni (longitudinale e trasversale).")]),
    ], { formulaIds: [formulaId("4.3.2")], tableIds: [], figureIds: [] }),
    makeUnit("C4.3.4.3.3", "VALUTAZIONE DELLE SOLLECITAZIONI DI TAGLIO AGENTI SUL SISTEMA DI CONNESSIONE", "subparagraph", [
        h("C4.3.4.3.3", "VALUTAZIONE DELLE SOLLECITAZIONI DI TAGLIO AGENTI SUL SISTEMA DI CONNESSIONE", 150, P.p150.h433),
        b("C4.3.4.3.3", "001", "paragraph", 150, P.p150.p5, "Il calcolo della forza di scorrimento a taglio necessaria per il progetto dei connettori può essere condotta utilizzando sia la teoria elastica sia la teoria plastica. Per le connessioni a completo ripristino di resistenza, in sezioni progettate utilizzando il calcolo plastico, la forza totale di scorrimento con cui progettare la connessione tra la sezione di massimo momento positivo e un appoggio di estremità è data da."),
        fr("C4.3.4.3.3", "002", "4.3.3", 150, P.p150.formula3),
        b("C4.3.4.3.3", "003", "paragraph", 150, P.p150.p6, "dove A_a, A_c ed A_se sono le aree, rispettivamente, del profilo di acciaio, della soletta di calcestruzzo e dell’armatura compressa." , [t("dove "), m("A_a", "A_a"), t(", "), m("A_c", "A_c"), t(" ed "), m("A_se", "A_{se}"), t(" sono le aree, rispettivamente, del profilo di acciaio, della soletta di calcestruzzo e dell’armatura compressa.")]),
        b("C4.3.4.3.3", "004", "paragraph", 150, P.p150.p7, "La forza di scorrimento tra una sezione soggetta al minimo momento flettente e la sezione soggetta al massimo momento flettente (appoggio intermedio e campata) è pari a."),
        fr("C4.3.4.3.3", "005", "4.3.4", 150, P.p150.formula4),
        b("C4.3.4.3.3", "006", "paragraph", 150, P.p150.p8, "dove A_ap è l’area della lamiera grecata, da considerarsi solo se è dimostrata la sua efficacia, f_yp la sua tensione di snervamento e A_s e f_sk sono, rispettivamente, l’area e la tensione di snervamento delle barre d’armatura in soletta.", [t("dove "), m("A_ap", "A_{ap}"), t(" è l’area della lamiera grecata, da considerarsi solo se è dimostrata la sua efficacia, "), m("f_yp", "f_{yp}"), t(" la sua tensione di snervamento e "), m("A_s", "A_s"), t(" e "), m("f_sk", "f_{sk}"), t(" sono, rispettivamente, l’area e la tensione di snervamento delle barre d’armatura in soletta.")]),
        b("C4.3.4.3.3", "007", "paragraph", 150, P.p150.p9, "Nel caso di connessione a parziale ripristino di resistenza con connettori duttili, si può assumere che allo stato limite ultimo si sviluppino scorrimenti sufficienti per ottenere nelle sezioni critiche i momenti resistenti calcolati sulla base della teoria plastica. In tal caso, la forza di scorrimento agente tra la sezione di estremità della trave e la sezione a momento flettente massimo si assume pari a.") ,
        fr("C4.3.4.3.3", "008", "4.3.5", 151, P.p151.formula5),
        b("C4.3.4.3.3", "009", "paragraph", 151, P.p151.p1, "mentre la forza di scorrimento tra la sezione a massimo momento flettente positivo e la sezione a minimo momento flettente negativo è pari a."),
        fr("C4.3.4.3.3", "010", "4.3.6", 151, P.p151.formula6),
        b("C4.3.4.3.3", "011", "paragraph", 151, P.p151.p2, "Se si utilizza per le sezioni trasversali la teoria elastica, anche la forza di scorrimento per unità di lunghezza deve essere calcolata utilizzando la teoria elastica, considerando l’aliquota di taglio che agisce dopo che la connessione si è attivata. Le proprietà statiche della sezione trasversale devono essere uguali a quelle utilizzate nel calcolo delle tensioni normali."),
        b("C4.3.4.3.3", "012", "paragraph", 151, P.p151.p3, "Per le travate da ponte, nello stato limite di esercizio, il taglio longitudinale per ciascun connettore non deve eccedere il 60% della resistenza di progetto."),
    ], { formulaIds: [formulaId("4.3.3"), formulaId("4.3.4"), formulaId("4.3.5"), formulaId("4.3.6")], tableIds: [], figureIds: [] }),
    makeUnit("C4.3.4.3.5", "ARMATURA TRASVERSALE", "subparagraph", [
        h("C4.3.4.3.5", "ARMATURA TRASVERSALE", 151, P.p151.h435),
        b("C4.3.4.3.5", "001", "paragraph", 151, P.p151.p4, "La disposizione dell’armatura trasversale in soletta secondo le tipologie mostrate nelle Figure 4.3.5a, 4.3.5b e 4.3.5c delle NTC è necessaria per l’eliminazione di possibili rotture fragili nel calcestruzzo a causa degli elevati sforzi di taglio che si concentrano in prossimità della connessione piolata. Le superfici interessate dai maggiori sforzi di taglio sono differenti in relazione alla tipologia di soletta considerata nel progetto della trave composta e comunque l’armatura trasversale deve essere disposta in modo tale da rinforzare e cucire tali superfici di scorrimento potenziali."),
        b("C4.3.4.3.5", "002", "paragraph", 151, P.p151.p5, "La sollecitazione di taglio agente lungo tali superfici critiche, v_Ed, è determinata, sulla base delle ipotesi di calcolo seguite per la definizione del momento resistente plastico della sezione, dalla forza di compressione massima sviluppata in soletta. Per cui la sollecitazione di taglio per unità di lunghezza si ricava, vedi Figura C4.3.6, dalla formula.", [t("La sollecitazione di taglio agente lungo tali superfici critiche, "), m("v_Ed", "v_{Ed}"), t(", è determinata, sulla base delle ipotesi di calcolo seguite per la definizione del momento resistente plastico della sezione, dalla forza di compressione massima sviluppata in soletta. Per cui la sollecitazione di taglio per unità di lunghezza si ricava, vedi Figura C4.3.6, dalla formula.")]),
        fr("C4.3.4.3.5", "003", "4.3.7", 151, P.p151.formula7),
        b("C4.3.4.3.5", "004", "paragraph", 151, P.p151.p6, "dove h_f è lo spessore della piattabanda di calcestruzzo e Δx la distanza tra la sezione di momento massimo o minimo e la sezione di momento nullo.", [t("dove "), m("h_f", "h_f"), t(" è lo spessore della piattabanda di calcestruzzo e "), m("Δx", "\\Delta x"), t(" la distanza tra la sezione di momento massimo o minimo e la sezione di momento nullo.")]),
        gr("C4.3.4.3.5", "005", "4.3.6", 151, P.p151.fig6),
        b("C4.3.4.3.5", "006", "paragraph", 151, P.p151.p7, "L’area dell’armatura minima necessaria all’assorbimento della sollecitazione v_Ed è data da.", [t("L’area dell’armatura minima necessaria all’assorbimento della sollecitazione "), m("v_Ed", "v_{Ed}"), t(" è data da.")]),
        fr("C4.3.4.3.5", "007", "4.3.8", 151, P.p151.formula8),
        b("C4.3.4.3.5", "008", "paragraph", 151, P.p151.p8, "dove A_sf è l’area della singola barra d’armatura disposta ad un interasse s_f. Per evitare la rottura del calcestruzzo compresso è necessario imporre che.", [t("dove "), m("A_sf", "A_{sf}"), t(" è l’area della singola barra d’armatura disposta ad un interasse "), m("s_f", "s_f"), t(". Per evitare la rottura del calcestruzzo compresso è necessario imporre che.")]),
        fr("C4.3.4.3.5", "009", "4.3.9", 151, P.p151.formula9),
        b("C4.3.4.3.5", "010", "paragraph", 151, P.p151.p9, "Se le tensioni v_Ed sono inferiori a 0,4 f_ctd, dove f_ctd è la resistenza a trazione di progetto del calcestruzzo, non è necessario disporre apposita armatura trasversale.", [t("Se le tensioni "), m("v_Ed", "v_{Ed}"), t(" sono inferiori a 0,4 "), m("f_ctd", "f_{ctd}"), t(", dove "), m("f_ctd", "f_{ctd}"), t(" è la resistenza a trazione di progetto del calcestruzzo, non è necessario disporre apposita armatura trasversale.")]),
    ], { formulaIds: [formulaId("4.3.7"), formulaId("4.3.8"), formulaId("4.3.9")], tableIds: [], figureIds: [figureId("4.3.6")] }),
    makeUnit("C4.3.4.3.6", "INSTABILITÀ FLESSO-TORSIONALE DELLE TRAVI COMPOSTE", "subparagraph", [
        h("C4.3.4.3.6", "INSTABILITÀ FLESSO-TORSIONALE DELLE TRAVI COMPOSTE", 152, P.p152.h436),
        b("C4.3.4.3.6", "001", "paragraph", 152, P.p152.p1, "Nel caso in cui la soletta di calcestruzzo collaborante sia garantita nei riguardi dell’instabilità laterale, è possibile assumere che la piattabanda superiore del profilo d’acciaio connesso a taglio alla soletta sia stabile lateralmente. In tutti gli altri casi è necessario verificare la sicurezza delle ali dei profili nei riguardi della stabilità."),
        b("C4.3.4.3.6", "002", "paragraph", 152, P.p152.p2, "In generale è possibile verificare l’instabilità flesso-torsionale dei profili di acciaio trascurando il ritegno torsionale costituito dalla soletta di calcestruzzo ed utilizzando le formule ed i metodi proposti nel § C.4.2 e nelle NTC."),
        b("C4.3.4.3.6", "003", "paragraph", 152, P.p152.p3, "In alternativa è possibile considerare il contributo alla stabilità laterale fornito dalla soletta. Il momento resistente di progetto nei confronti dell’instabilità flesso-torsionale è pari a:"),
        fr("C4.3.4.3.6", "004", "4.3.10", 152, P.p152.formula10),
        b("C4.3.4.3.6", "005", "paragraph", 152, P.p152.p4, "dove χ_LT è il fattore riduttivo della resistenza flessionale M_Rd espresso, tramite la formula 4.2.51 delle NTC, in funzione della snellezza relativa λ_LT.", [t("dove "), m("χ_LT", "\\chi_{LT}"), t(" è il fattore riduttivo della resistenza flessionale "), m("M_Rd", "M_{Rd}"), t(" espresso, tramite la formula 4.2.51 delle NTC, in funzione della snellezza relativa "), m("λ_LT", "\\lambda_{LT}"), t(".")]),
        fr("C4.3.4.3.6", "006", "4.3.11", 152, P.p152.formula11),
        b("C4.3.4.3.6", "007", "paragraph", 152, P.p152.p5, "dove M_Rk è il momento resistente della sezione composta, calcolato utilizzando i valori caratteristici delle resistenze, e M_cr è il momento critico corrispondente all’instabilità flesso-torsionale, calcolato per la trave di maggior luce e con il maggiore momento sollecitante negativo.", [t("dove "), m("M_Rk", "M_{Rk}"), t(" è il momento resistente della sezione composta, calcolato utilizzando i valori caratteristici delle resistenze, e "), m("M_cr", "M_{cr}"), t(" è il momento critico corrispondente all’instabilità flesso-torsionale, calcolato per la trave di maggior luce e con il maggiore momento sollecitante negativo.")]),
        b("C4.3.4.3.6", "008", "paragraph", 152, P.p152.intro, "Se sono verificate le seguenti ipotesi:"),
        b("C4.3.4.3.6", "009", "list-item", 152, P.p152.liA, "a. la flangia superiore del profilo è connessa alla soletta;"),
        b("C4.3.4.3.6", "010", "list-item", 152, P.p152.liB, "b. la soletta è composta e fissata su due profili contigui a formare una sezione ad “U invertita” (v. Figura C4.3.7);"),
        b("C4.3.4.3.6", "011", "list-item", 152, P.p152.liC, "c. in ogni punto di appoggio l’elemento di acciaio ha la flangia inferiore bloccata lateralmente e l’anima irrigidita,"),
        gr("C4.3.4.3.6", "012", "4.3.7", 152, P.p152.fig7),
        b("C4.3.4.3.6", "013", "paragraph", 152, P.p152.p6, "il contributo stabilizzante da considerare nel calcolo di M_cr si può valutare definendo la rigidezza rotazionale k_s per unità di lunghezza della soletta d’impalcato come:", [t("il contributo stabilizzante da considerare nel calcolo di "), m("M_cr", "M_{cr}"), t(" si può valutare definendo la rigidezza rotazionale "), m("k_s", "k_s"), t(" per unità di lunghezza della soletta d’impalcato come:")]),
        fr("C4.3.4.3.6", "014", "4.3.12", 152, P.p152.formula12),
        b("C4.3.4.3.6", "015", "paragraph", 152, P.p152.p7, "dove k_1, rigidezza flessionale in fase fessurata della soletta di calcestruzzo o composta ed in direzione trasversale ai profili d’acciaio, è definita come k_1 = α(EJ)_2/a, in cui α=2 per le travi esterne ed α=3 per le travi interne (per un telaio con più di 4 travi α=4 per le travi più interne) e a è la distanza tra due profili consecutivi; (EJ)_2 è il modulo di rigidezza fessurato per unità di larghezza della soletta; k_2 è la rigidezza flessionale dell’anima del profilo d’acciaio, che vale.", [t("dove "), m("k_1", "k_1"), t(", rigidezza flessionale in fase fessurata della soletta di calcestruzzo o composta ed in direzione trasversale ai profili d’acciaio, è definita come "), m("k_1 = α(EJ)_2/a", "k_1=\\alpha(EJ)_2/a"), t(", in cui "), m("α=2", "\\alpha=2"), t(" per le travi esterne ed "), m("α=3", "\\alpha=3"), t(" per le travi interne (per un telaio con più di 4 travi "), m("α=4", "\\alpha=4"), t(" per le travi più interne) e "), m("a", "a"), t(" è la distanza tra due profili consecutivi; "), m("(EJ)_2", "(EJ)_2"), t(" è il modulo di rigidezza fessurato per unità di larghezza della soletta; "), m("k_2", "k_2"), t(" è la rigidezza flessionale dell’anima del profilo d’acciaio, che vale.")]),
        fr("C4.3.4.3.6", "016", "4.3.13", 152, P.p152.formula13),
        b("C4.3.4.3.6", "017", "paragraph", 152, P.p152.p8, "dove ν è il coefficiente di Poisson, h_s è l’altezza del profilo di acciaio e t_w è lo spessore dell’anima.", [t("dove "), m("ν", "\\nu"), t(" è il coefficiente di Poisson, "), m("h_s", "h_s"), t(" è l’altezza del profilo di acciaio e "), m("t_w", "t_w"), t(" è lo spessore dell’anima.")]),
        b("C4.3.4.3.6", "018", "paragraph", 152, P.p152.p9, "Se la trave composta è continua su più appoggi o fa parte di un telaio a più campate ed è di classe 1, 2 o 3 la sezione può essere progettata senza un sistema di stabilizzazione laterale se sono soddisfatte le seguenti condizioni:"),
        b("C4.3.4.3.6", "019", "list-item", 152, P.p152.liA2, "(a) le luci di campate adiacenti non differiscono tra loro di più del 20% (15% nel caso di una campata esterna a sbalzo e della campata adiacente);"),
        b("C4.3.4.3.6", "020", "list-item", 152, P.p152.liB2, "(b) il carico su ogni campata è uniformemente distribuito ed i carichi permanenti costituiscono più del 40% dei carichi di progetto;"),
        b("C4.3.4.3.6", "021", "list-item", 152, P.p152.liC2, "(c) la piattabanda superiore è collegata alla soletta;"),
        b("C4.3.4.3.6", "022", "list-item", 152, P.p152.liD2, "(d) la soletta è connessa ad un altro profilo di acciaio che la supporta e che è parallelo alla trave composta considerata;"),
        b("C4.3.4.3.6", "023", "list-item", 152, P.p152.liE2, "(e) se la soletta è composta, questa connette due profili di acciaio a formare un telaio ad “U invertita”;"),
        b("C4.3.4.3.6", "024", "list-item", 152, P.p152.liF2, "(f) in ogni punto di appoggio l’elemento di acciaio ha la piattabanda inferiore lateralmente bloccata e l’anima irrigidita;"),
        b("C4.3.4.3.6", "025", "list-item", 152, P.p152.liG2, "(g) se la sezione di acciaio non è rivestita di calcestruzzo, rispetta i limiti imposti, sull’altezza della sezione, nella Tabella C4.3.II;"),
        tr("C4.3.4.3.6", "026", "4.3.ii", 153, P.p153.table),
        b("C4.3.4.3.6", "027", "list-item", 153, P.p153.hItem, "(h) se l’elemento della sezione è parzialmente rivestito di calcestruzzo, l’altezza h della sua sezione di acciaio non eccede l’altezza fornita in Tabella C4.3.II di più di 200 mm, per le classi d’acciaio S235, S275 ed S355, e di più di 150 mm, per le classi S420 ed S460.", [t("(h) se l’elemento della sezione è parzialmente rivestito di calcestruzzo, l’altezza "), m("h", "h"), t(" della sua sezione di acciaio non eccede l’altezza fornita in Tabella C4.3.II di più di 200 mm, per le classi d’acciaio S235, S275 ed S355, e di più di 150 mm, per le classi S420 ed S460.")]),
    ], { formulaIds: [formulaId("4.3.10"), formulaId("4.3.11"), formulaId("4.3.12"), formulaId("4.3.13")], tableIds: [tableId("4.3.ii")], figureIds: [figureId("4.3.7")] }),
    makeUnit("C4.3.6", "SOLETTE COMPOSTE CON LAMIERA GRECATA", "subparagraph", [h("C4.3.6", "SOLETTE COMPOSTE CON LAMIERA GRECATA", 153, P.p153.h436)], { formulaIds: [], tableIds: [], figureIds: [] }),
    makeUnit("C4.3.6.2", "VERIFICHE DI RESISTENZA ALLO STATO LIMITE ULTIMO (SOLETTE COMPOSTE)", "subparagraph", [
        h("C4.3.6.2", "VERIFICHE DI RESISTENZA ALLO STATO LIMITE ULTIMO (SOLETTE COMPOSTE)", 153, P.p153.h4362),
        b("C4.3.6.2", "001", "paragraph", 153, P.p153.p1, "La resistenza a flessione delle sezioni trasversali di una soletta composta realizzata con una soletta armata di calcestruzzo gettata su una lamiera grecata collaborante può essere determinata con la teoria plastica, in accordo a quanto esposto in § 4.3.4.2.1.2 delle NTC ed in § C4.3.4.2, se sono soddisfatte le seguenti condizioni:"),
        b("C4.3.6.2", "002", "list-item", 153, P.p153.liA, "sussiste la piena interazione tra lamiera e calcestruzzo;"),
        b("C4.3.6.2", "003", "list-item", 153, P.p153.liB, "la sezione efficace della lamiera è valutata al netto di bugnature o dentelli;"),
        b("C4.3.6.2", "004", "list-item", 153, P.p153.liC, "la lamiera nelle zone soggette a momento negativo è considerata attiva solo se continua sul profilo di acciaio;"),
        b("C4.3.6.2", "005", "list-item", 153, P.p153.liD, "la stabilità delle parti compresse della lamiera è assicurata."),
        b("C4.3.6.2", "006", "paragraph", 153, P.p153.p2, "In tal caso si assume per il calcestruzzo un modello stress-block con tensione massima 0,85 f_ck/γ_c mentre le tensioni normali nella lamiera e nelle barre d’armatura sono assunte pari al limite plastico; vedi Figure C4.3.8 (a) e C4.3.8 (b).", [t("In tal caso si assume per il calcestruzzo un modello stress-block con tensione massima "), m("0,85 f_ck/γ_c", "0,85\\frac{f_{ck}}{\\gamma_c}"), t(" mentre le tensioni normali nella lamiera e nelle barre d’armatura sono assunte pari al limite plastico; vedi Figure C4.3.8 (a) e C4.3.8 (b).")]),
        gr("C4.3.6.2", "007", "4.3.8", 153, P.p153.fig8),
        b("C4.3.6.2", "008", "paragraph", 153, P.p153.p3, "La resistenza allo scorrimento tra lamiera grecata e soletta deve essere verificata nelle zone in cui sono localizzate le massime sollecitazioni di taglio, in generale le sezioni prossime agli appoggi, poiché in caso di connessione parziale tra i due elementi non è possibile sviluppare il momento resistente plastico così come al § 4.3.6.2 delle NTC. A tal riguardo, è possibile definire una relazione lineare che rappresenta l’interazione parziale tra la lamiera grecata ed il calcestruzzo, basata sulla resistenza allo scorrimento offerta dalla lamiera, F_u,Rd, che consente di ricavare il momento resistente massimo ottenibile prima del raggiungimento della crisi per flessione (vedi Figura C4.3.9). Tale relazione, basandosi sulla capacità F_u,Rd della lamiera grecata, dipende dal tipo di lamiera utilizzata.", [t("La resistenza allo scorrimento tra lamiera grecata e soletta deve essere verificata nelle zone in cui sono localizzate le massime sollecitazioni di taglio, in generale le sezioni prossime agli appoggi, poiché in caso di connessione parziale tra i due elementi non è possibile sviluppare il momento resistente plastico così come al § 4.3.6.2 delle NTC. A tal riguardo, è possibile definire una relazione lineare che rappresenta l’interazione parziale tra la lamiera grecata ed il calcestruzzo, basata sulla resistenza allo scorrimento offerta dalla lamiera, "), m("F_u,Rd", "F_{u,Rd}"), t(", che consente di ricavare il momento resistente massimo ottenibile prima del raggiungimento della crisi per flessione (vedi Figura C4.3.9). Tale relazione, basandosi sulla capacità "), m("F_u,Rd", "F_{u,Rd}"), t(" della lamiera grecata, dipende dal tipo di lamiera utilizzata.")]),
        gr("C4.3.6.2", "009", "4.3.9", 154, P.p154.fig9),
        b("C4.3.6.2", "010", "paragraph", 153, P.p153.p5, "Altre tipologie di connessione e differenti condizioni di carico definiscono differenti diagrammi di interazione parziale, come presentato in § 7.4.3 della CNR10016."),
        b("C4.3.6.2", "011", "paragraph", 153, P.p153.p6, "Metodi per il calcolo della resistenza allo scorrimento di sistemi di connessione a pioli, illustrati nella Figura 4.3.4(a,b) delle NTC, sono basati sulle resistenze fornite nel § 4.3.4.3.1 delle NTC; ulteriori informazioni e metodi per il calcolo sono riportati in § 9.7.3, § 9.7.4 della UNI EN 1994-1-1:2005."),
    ], { formulaIds: [], tableIds: [], figureIds: [figureId("4.3.8"), figureId("4.3.9")] }),
];

mkdirSync(unitDir, { recursive: true });
mkdirSync(assetDir, { recursive: true });
for (const unit of units) {
    const number = unit.numbering.official.toLowerCase();
    writeFileSync(join(unitDir, `${number}.json`), `${JSON.stringify(unit, null, 2)}\n`);
}
const manifest = {
    $schema: "urn:structural-codes:schema:asset-manifest:v2",
    schemaVersion: "2.0.0-alpha.1",
    recordType: "asset-manifest",
    document: "circ2019",
    section: "C4.3-step1",
    sourceId,
    status: "transcribed-unreviewed",
    formulas,
    tables,
    figures,
};
writeFileSync(join(assetDir, "C4.3-step1.json"), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Wrote ${units.length} units, ${formulas.length} formulas, ${tables.length} tables, ${figures.length} figures.`);
