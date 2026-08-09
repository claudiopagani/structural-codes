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
const actorId = "codex:ntc43-step3";

type Region = { coordinateSystem: "pdf-points-top-left"; x: number; y: number; width: number; height: number };
type Inline = { kind: "text" | "math"; value: string; latex?: string };
type Page = { printedPage: string | null; textItems: Array<{ sequence: number; text: string; region: Region }> };

const pageCache = new Map<number, Page>();
for (const pageNumber of [127, 128, 129, 130, 131, 132]) {
    const file = join(repoRoot, "evidence", sourceId, "pages", `page-${String(pageNumber).padStart(4, "0")}.json`);
    pageCache.set(pageNumber, JSON.parse(readFileSync(file, "utf8")) as Page);
}

const region = (x: number, y: number, width: number, height: number): Region => ({ coordinateSystem: "pdf-points-top-left", x, y, width, height });
const unitId = (number: string) => `urn:structural-codes:it:unit:ntc2018:${number}`;
const formulaId = (number: string) => `urn:structural-codes:it:asset:formula:ntc2018:${number}`;
const tableId = (number: string) => `urn:structural-codes:it:asset:table:ntc2018:${number}`;
const figureId = (number: string) => `urn:structural-codes:it:asset:figure:ntc2018:${number}`;
const t = (value: string): Inline => ({ kind: "text", value });
const m = (value: string, latex = value): Inline => ({ kind: "math", value, latex });

function rawFor(pageNumber: number, blockRegion: Region): string {
    const page = pageCache.get(pageNumber);
    if (!page) throw new Error(`evidence mancante per pagina ${pageNumber}`);
    return page.textItems.filter((item) => {
        const bottom = item.region.y + item.region.height;
        const right = item.region.x + item.region.width;
        return item.text.length > 0 && item.region.y < blockRegion.y + blockRegion.height && bottom > blockRegion.y && item.region.x < blockRegion.x + blockRegion.width && right > blockRegion.x;
    }).sort((a, b) => a.sequence - b.sequence).map((item) => item.text).join(" ");
}

function transformations(options: { wrap?: boolean; hyphen?: boolean; control?: boolean; manual?: boolean } = {}) {
    const result: Array<{ operation: string; ruleVersion: string; note: string }> = [];
    if (options.control) result.push({ operation: "remove-control-character", ruleVersion: profile, note: "Rimossi i caratteri di controllo privi di resa visuale dall’estrazione ufficiale." });
    if (options.hyphen) result.push({ operation: "remove-discretionary-hyphen", ruleVersion: profile, note: "Ricomposte le parole spezzate dal trattino tipografico a fine riga dopo confronto con il render." });
    if (options.wrap) {
        result.push({ operation: "join-line-wrap", ruleVersion: profile, note: "Unite le righe appartenenti allo stesso capoverso; i capoversi distinti restano blocchi separati." });
        result.push({ operation: "normalize-whitespace", ruleVersion: profile, note: "Uniformati gli spazi dopo la ricomposizione delle righe." });
    }
    if (options.manual) result.push({ operation: "manual-correction", ruleVersion: profile, note: "Ripristinati accenti, apostrofi, simboli matematici e sillabazioni confrontati con il render della fonte ufficiale." });
    if (options.wrap || options.manual) result.push({ operation: "unicode-nfc", ruleVersion: profile, note: "Testo normalizzato in Unicode NFC." });
    return result;
}

function evidence(page: number, blockRegion: Region, raw: string, normalized: string, method: "pdf-text" | "manual-transcription" = "pdf-text", options: { wrap?: boolean; hyphen?: boolean; control?: boolean; manual?: boolean } = {}) {
    return { sourceId, pdfPage: page, printedPage: pageCache.get(page)?.printedPage ?? String(page - 4), region: blockRegion, extraction: { method, tool: method === "pdf-text" ? "pdfjs-dist" : "codex-source-transcription", toolVersion: method === "pdf-text" ? "4.10.38" : profile }, transformations: transformations(options), rawSha256: sha256OfText(raw), normalizedSha256: sha256OfText(normalized) };
}

function textBlock(number: string, suffix: string, kind: "heading" | "paragraph" | "list-item", page: number, blockRegion: Region, normalized: string, inline: Inline[] = [t(normalized)], options: { wrap?: boolean; hyphen?: boolean; control?: boolean; manual?: boolean } = { wrap: true, manual: true }) {
    const raw = rawFor(page, blockRegion) || normalized;
    return { blockId: `${unitId(number)}#block-${suffix}`, kind, origin: "official", text: { raw, normalized, normalizationVersion: profile, inline: inline.length === 0 ? [t(normalized)] : inline }, evidence: evidence(page, blockRegion, raw, normalized, "pdf-text", options) };
}

function heading(number: string, title: string, page: number, blockRegion: Region) {
    return textBlock(number, "heading", "heading", page, blockRegion, `${number} ${title}`, [t(`${number} ${title}`)], { manual: true });
}

function formulaRef(unitNumber: string, formulaNumber: string, suffix: string, page: number, blockRegion: Region) {
    const id = formulaId(formulaNumber);
    return { blockId: `${unitId(unitNumber)}#block-${suffix}`, kind: "formula-ref", origin: "official", assetId: id, evidence: evidence(page, blockRegion, id, id, "manual-transcription", { manual: true }) };
}

function assetRef(unitNumber: string, suffix: string, kind: "table-ref" | "figure-ref", id: string, page: number, blockRegion: Region) {
    return { blockId: `${unitId(unitNumber)}#block-${suffix}`, kind, origin: "official", assetId: id, evidence: evidence(page, blockRegion, id, id, "manual-transcription", { manual: true }) };
}

function parent(number: string): string | null { const parts = number.split("."); return parts.length === 1 ? null : unitId(parts.slice(0, -1).join(".")); }
function ancestors(number: string): string[] { const parts = number.split("."); return parts.slice(1).map((_, index) => unitId(parts.slice(0, index + 1).join("."))); }

function makeUnit(number: string, title: string, kind: "section" | "subparagraph", blocks: unknown[], assets: { formulaIds: string[]; tableIds: string[]; figureIds: string[] }) {
    return {
        $schema: "urn:structural-codes:schema:canonical-unit:v2", schemaVersion: "2.0.0-alpha.2", recordType: "canonical-unit", id: unitId(number), workId, expressionId, kind,
        numbering: { official: number, sortKey: number.split(".").map((part) => part.padStart(3, "0")).join(".") }, title, titleBlockId: `${unitId(number)}#block-heading`, hierarchy: { parentId: parent(number), ancestorIds: ancestors(number), position: Number(number.split(".").at(-1)) },
        validity: { from: "2018-03-22", to: null, status: "in-force", asOf: "2026-08-09" }, blocks, citations: [], relations: [], assets,
        workflow: { status: "extracted", createdBy: { actorId, kind: "automated-agent", toolVersion: profile }, createdAt, reviews: [], openIssues: [
            { issueId: `ntc2018-${number.replaceAll(".", "-")}-source-review`, type: "normalization-review", severity: "blocking", note: "Record trascritto dall’evidence ufficiale ma non ancora confrontato integralmente da un revisore umano con il render della fonte." },
            ...(assets.formulaIds.length + assets.tableIds.length + assets.figureIds.length > 0 ? [{ issueId: `ntc2018-${number.replaceAll(".", "-")}-assets`, type: "asset-review", severity: "blocking", note: "Formule, tabelle e figure sono state separate e collocate; resta obbligatoria la revisione umana puntuale sulla fonte ufficiale." }] : []),
        ] },
    };
}

const p127 = {
    detail4: region(82, 95, 430, 30), h3435: region(82, 137, 430, 18), armIntro: region(82, 150, 430, 38), fig35: region(82, 195, 380, 100), armP1: region(82, 298, 430, 25), armP2: region(82, 322, 430, 40), h344: region(82, 374, 430, 18), exec: region(82, 388, 430, 18), h345: region(82, 408, 430, 18), min1: region(82, 421, 430, 18), min2: region(82, 434, 430, 22), h35: region(82, 466, 430, 18), h351: region(82, 488, 430, 18), typeIntro: region(82, 501, 430, 25), typeA: region(82, 523, 430, 18), typeB: region(82, 536, 430, 18), typeC: region(82, 549, 430, 18), typeD: region(82, 562, 430, 18), fig36: region(82, 575, 440, 100),
};
const p128 = {
    general: region(82, 95, 430, 38), reqIntro: region(82, 139, 430, 25), req1: region(82, 161, 430, 18), req2: region(82, 174, 430, 18), req3: region(82, 187, 430, 18), req4: region(82, 201, 430, 18), req5: region(82, 214, 430, 25), req6: region(82, 238, 430, 18), req7: region(82, 251, 430, 18), criteria: region(82, 276, 430, 25), h352: region(82, 308, 430, 20), p352a: region(82, 321, 430, 18), f315: region(140, 330, 300, 40), p352b: region(82, 367, 430, 18), p352c: region(82, 390, 430, 28), f316: region(140, 408, 300, 35), p352d: region(82, 430, 430, 40), f317: region(150, 458, 260, 45), dove: region(82, 490, 430, 18), definitions: region(82, 500, 430, 55), p352e: region(82, 540, 430, 18), f318: region(150, 550, 260, 40), p352f: region(82, 580, 430, 18), f319: region(150, 594, 260, 28), p352g: region(82, 617, 430, 25), f320: region(140, 635, 300, 30), p352h: region(82, 652, 430, 18), p352i: region(82, 668, 430, 22),
};
const p129 = {
    h353: region(82, 105, 430, 20), h3531: region(82, 125, 430, 20), p3531a: region(82, 139, 430, 18), f321: region(130, 150, 300, 35), p3531b: region(82, 180, 430, 28), p3531c: region(82, 221, 430, 28), p3531d: region(82, 252, 430, 28), f322: region(150, 270, 300, 45), f323: region(75, 330, 300, 65), f324: region(75, 395, 310, 70), fig37: region(82, 460, 440, 83), p3531e: region(82, 562, 430, 25), p3531f: region(82, 587, 430, 28), p3531g: region(82, 620, 430, 25),
};
const p130 = {
    fig38: region(82, 88, 440, 200), p3531h: region(82, 300, 430, 38), p3531i: region(82, 343, 430, 20), p3531j: region(82, 356, 430, 20), f325: region(145, 373, 300, 35), p3531k: region(82, 405, 25, 18), p3531l: region(82, 418, 430, 25), f326: region(140, 438, 300, 30), p3531m: region(82, 456, 430, 20), p3531n: region(82, 469, 430, 32), f327: region(110, 500, 330, 65), p3531o: region(82, 560, 430, 40), h3532: region(82, 612, 430, 20), p3532a: region(82, 625, 430, 30), f328: region(140, 657, 300, 45),
};
const p131 = {
    p3532b: region(82, 95, 430, 65), p3532c: region(82, 176, 430, 20), h354: region(82, 199, 430, 20), h3541: region(82, 220, 430, 20), p3541a: region(82, 234, 430, 18), f329: region(130, 240, 300, 35), p3541b: region(82, 260, 430, 30), f330: region(130, 275, 300, 35), phi: region(82, 312, 300, 25), table3541: region(82, 334, 360, 285), h3542: region(82, 627, 430, 20), p3542a: region(82, 640, 430, 20), f331: region(75, 650, 310, 35),
};
const p132 = {
    f333: region(82, 94, 440, 27), f334: region(82, 118, 440, 25), defs: region(82, 140, 430, 25),
};

const formulaAssets = [
    { id: formulaId("4.3.15"), unitId: unitId("4.3.5.2"), officialNumber: "4.3.15", pdfPage: 128, latex: "\\delta=\\frac{A_a\\,f_{yk}}{\\gamma_A}\\cdot\\frac{1}{N_{pl,Rd}}" },
    { id: formulaId("4.3.16"), unitId: unitId("4.3.5.2"), officialNumber: "4.3.16", pdfPage: 128, latex: "(EJ)_{\\mathrm{eff}}=E_aJ_a+E_sJ_s+k_eE_{c,\\mathrm{eff}}J_c" },
    { id: formulaId("4.3.17"), unitId: unitId("4.3.5.2"), officialNumber: "4.3.17", pdfPage: 128, latex: "E_{c,\\mathrm{eff}}=E_{cm}\\frac{1}{1+(N_{G,Ed}/N_{Ed})\\varphi}" },
    { id: formulaId("4.3.18"), unitId: unitId("4.3.5.2"), officialNumber: "4.3.18", pdfPage: 128, latex: "\\bar{\\lambda}=\\sqrt{\\frac{N_{pl,Rk}}{N_{cr}}}" },
    { id: formulaId("4.3.19"), unitId: unitId("4.3.5.2"), officialNumber: "4.3.19", pdfPage: 128, latex: "N_{pl,Rk}=A_af_{yk}+0.85A_cf_{ck}+A_sf_{sk}" },
    { id: formulaId("4.3.20"), unitId: unitId("4.3.5.2"), officialNumber: "4.3.20", pdfPage: 128, latex: "(EJ)_{\\mathrm{eff,II}}=k_0(E_aJ_a+E_sJ_s+k_{e,II}E_{cm}J_c)" },
    { id: formulaId("4.3.21"), unitId: unitId("4.3.5.3.1"), officialNumber: "4.3.21", pdfPage: 129, latex: "N_{pl,Rd}=\\frac{A_af_{yk}}{\\gamma_A}+\\frac{A_c\\,0.85f_{ck}}{\\gamma_C}+\\frac{A_sf_{sk}}{\\gamma_S}" },
    { id: formulaId("4.3.22"), unitId: unitId("4.3.5.3.1"), officialNumber: "4.3.22", pdfPage: 129, latex: "N_{pl,Rd}=\\eta_a\\frac{A_af_{yk}}{\\gamma_A}+\\frac{A_cf_{ck}}{\\gamma_C}\\left(1+\\eta_c\\frac{t}{d}\\frac{f_{yk}}{f_{ck}}\\right)+\\frac{A_sf_{sk}}{\\gamma_S}" },
    { id: formulaId("4.3.23"), unitId: unitId("4.3.5.3.1"), officialNumber: "4.3.23", pdfPage: 129, latex: "\\eta_a=\\begin{cases}0.25(3+2\\bar{\\lambda})\\le1.0& e=0\\\\0.25(3+2\\bar{\\lambda})+10(0.25-0.5\\bar{\\lambda})\\frac{e}{d}&0<e/d\\le0.1\\\\1.0&e>0.1\\end{cases}" },
    { id: formulaId("4.3.24"), unitId: unitId("4.3.5.3.1"), officialNumber: "4.3.24", pdfPage: 129, latex: "\\eta_c=\\begin{cases}(4.9-18.5\\bar{\\lambda}+17\\bar{\\lambda}^2)\\ge0&e=0\\\\(4.9-18.5\\bar{\\lambda}+17\\bar{\\lambda}^2)\\left(1-10\\frac{e}{d}\\right)&0<e/d\\le0.1\\\\0&e>0.1\\end{cases}" },
    { id: formulaId("4.3.25"), unitId: unitId("4.3.5.3.1"), officialNumber: "4.3.25", pdfPage: 130, latex: "N_{pm,Rd}=0.85\\frac{f_{ck}}{\\gamma_C}A_c" },
    { id: formulaId("4.3.26"), unitId: unitId("4.3.5.3.1"), officialNumber: "4.3.26", pdfPage: 130, latex: "M_{pl,Rd}(N_{Ed})=\\mu_d\\,M_{pl,Rd}" },
    { id: formulaId("4.3.27"), unitId: unitId("4.3.5.3.1"), officialNumber: "4.3.27", pdfPage: 130, latex: "\\begin{aligned}\\frac{M_{y,Ed}}{\\mu_{dy}M_{pl,y,Rd}}&\\le\\alpha_{M,y} & \\frac{M_{z,Ed}}{\\mu_{dz}M_{pl,z,Rd}}&\\le\\alpha_{M,z}\\\\\\frac{M_{y,Ed}}{\\mu_{dy}M_{pl,y,Rd}}+\\frac{M_{z,Ed}}{\\mu_{dz}M_{pl,z,Rd}}&\\le1.0\\end{aligned}" },
    { id: formulaId("4.3.28"), unitId: unitId("4.3.5.3.2"), officialNumber: "4.3.28", pdfPage: 130, latex: "V_{a,Ed}=V_{Ed}\\frac{M_{pl,a,Rd}}{M_{pl,Rd}}\\qquad V_{c,Ed}=V_{Ed}-V_{a,Ed}" },
    { id: formulaId("4.3.29"), unitId: unitId("4.3.5.4.1"), officialNumber: "4.3.29", pdfPage: 131, latex: "N_{b,Rd}=\\chi\\,N_{pl,Rd}" },
    { id: formulaId("4.3.30"), unitId: unitId("4.3.5.4.1"), officialNumber: "4.3.30", pdfPage: 131, latex: "\\chi=\\frac{1}{\\Phi+\\sqrt{\\Phi^2-\\bar{\\lambda}^2}}\\le1.0" },
    { id: formulaId("4.3.30-phi"), unitId: unitId("4.3.5.4.1"), officialNumber: null, pdfPage: 131, latex: "\\Phi=0.5\\left[1+\\alpha(\\bar{\\lambda}-0.2)+\\bar{\\lambda}^2\\right]" },
    { id: formulaId("4.3.31"), unitId: unitId("4.3.5.4.2"), officialNumber: "4.3.31", pdfPage: 131, latex: "\\frac{d}{t}\\le90\\frac{235}{f_y}" },
    { id: formulaId("4.3.32"), unitId: unitId("4.3.5.4.2"), officialNumber: "4.3.32", pdfPage: 131, latex: "\\frac{d}{t}\\le52\\sqrt{\\frac{235}{f_y}}" },
    { id: formulaId("4.3.33"), unitId: unitId("4.3.5.4.2"), officialNumber: "4.3.33", pdfPage: 132, latex: "\\frac{b}{t_f}\\le44\\sqrt{\\frac{235}{f_y}}" },
    { id: formulaId("4.3.34"), unitId: unitId("4.3.5.4.2"), officialNumber: "4.3.34", pdfPage: 132, latex: "c\\ge\\max\\left\\{40\\,\\mathrm{mm};\\frac{b}{6}\\right\\}" },
];

const tableAsset = {
    id: tableId("4.3.iii"), unitId: unitId("4.3.5.4.1"), officialNumber: "4.3.III", pdfPage: 131, caption: "Curve di instabilità e fattori di imperfezione", columnCount: 4,
    headers: [[{ text: "Tipo sezione" }, { text: "Inflessione intorno all’asse" }, { text: "Curva di stabilità" }, { text: "Imperfezione" }]],
    rows: [
        [{ text: "(a)", rowSpan: 2 }, { text: "y-y" }, { text: "b" }, { text: "L/200" }],
        [{ text: "z-z" }, { text: "c" }, { text: "L/150" }],
        [{ text: "(b)", rowSpan: 2 }, { text: "y-y" }, { text: "b" }, { text: "L/200" }],
        [{ text: "z-z" }, { text: "c" }, { text: "L/150" }],
        [{ text: "(c)", rowSpan: 3 }, { text: "" }, { text: "a (ρ_s<3%)", latex: "a\\;(\\rho_s<3\\%)" }, { text: "L/300" }],
        [{ text: "" }, { text: "b (3%<ρ_s<6%)", latex: "b\\;(3\\%<\\rho_s<6\\%)" }, { text: "L/200" }],
        [{ text: "" }, { text: "ρ_s=A_s/A_c (A_s area armature, A_c area calcestruzzo)", latex: "\\rho_s=A_s/A_c" }, { text: "" }],
        [{ text: "Curva di stabilità" }, { text: "a" }, { text: "b" }, { text: "C" }],
        [{ text: "Fattore di imperfezione α", latex: "\\text{Fattore di imperfezione }\\alpha" }, { text: "0,21" }, { text: "0,34" }, { text: "0,49" }],
    ],
    notes: ["La prima colonna contiene gli schemi grafici delle sezioni (a), (b) e (c), non rappresentabili come immagini nelle celle con lo schema corrente; le etichette e tutti i valori tabellari sono trascritti, ma la verifica visuale cella per cella resta bloccante."],
};

const figureAssets = [
    { id: figureId("4.3.5"), unitId: unitId("4.3.4.3.5"), officialNumber: "4.3.5", pdfPage: 127, caption: "Tipiche superfici di collasso a taglio nelle piattabande di calcestruzzo", alt: "Tre schemi delle superfici critiche di collasso a taglio nelle piattabande di calcestruzzo.", filename: "fig4.3.5.png", imagePath: "figures/ntc2018/fig4.3.5.png", region: p127.fig35 },
    { id: figureId("4.3.6"), unitId: unitId("4.3.5.1"), officialNumber: "4.3.6", pdfPage: 127, caption: "Tipi di sezioni per colonne composte, trattate nel presente paragrafo", alt: "Quattro tipologie di sezioni per colonne composte, indicate con a, b, c e d.", filename: "fig4.3.6.png", imagePath: "figures/ntc2018/fig4.3.6.png", region: p127.fig36 },
    { id: figureId("4.3.7"), unitId: unitId("4.3.5.3.1"), officialNumber: "4.3.7", pdfPage: 129, caption: "Sezione tipo di colonna composta circolare riempita di calcestruzzo in cui è possibile considerare il confinamento del calcestruzzo", alt: "Sezione circolare cava riempita di calcestruzzo con armatura e confinamento.", filename: "fig4.3.7.png", imagePath: "figures/ntc2018/fig4.3.7.png", region: p129.fig37 },
    { id: figureId("4.3.8"), unitId: unitId("4.3.5.3.1"), officialNumber: "4.3.8", pdfPage: 130, caption: "Metodo semplificato per la valutazione del dominio di interazione N-M per le colonne composte", alt: "Dominio di interazione N-M con punti A, B, C e D e diagrammi delle sezioni composte.", filename: "fig4.3.8.png", imagePath: "figures/ntc2018/fig4.3.8.png", region: p130.fig38 },
];

const units = [
    makeUnit("4.3.4.3.5", "Armatura trasversale", "subparagraph", [
        heading("4.3.4.3.5", "Armatura trasversale", 127, p127.h3435),
        textBlock("4.3.4.3.5", "p-001", "paragraph", 127, p127.armIntro, "L’armatura trasversale della soletta deve essere progettata in modo da prevenire la rottura prematura per scorrimento o fessurazione longitudinale nelle sezioni critiche della soletta di calcestruzzo a causa delle elevate sollecitazioni di taglio create dai connettori. L’armatura deve essere dimensionata in modo da assorbire le tensioni di scorrimento agenti sulle superfici “critiche” di potenziale rottura, a-a, b-b, c-c, d-d, esemplificate in Fig. 4.3.5.", [], { wrap: true, hyphen: true, manual: true }),
        assetRef("4.3.4.3.5", "figure-001", "figure-ref", figureId("4.3.5"), 127, p127.fig35),
        textBlock("4.3.4.3.5", "p-002", "paragraph", 127, p127.armP1, "La sollecitazione di taglio agente lungo le superfici critiche deve essere determinata coerentemente con le ipotesi di calcolo assunte per la determinazione della resistenza della connessione.", [], { wrap: true, hyphen: true, manual: true }),
        textBlock("4.3.4.3.5", "p-003", "paragraph", 127, p127.armP2, "L’area di armatura trasversale in una soletta piena non deve essere minore di 0,002 volte l’area del calcestruzzo e deve essere distribuita uniformemente. In solette con lamiera grecata aventi nervature parallele o perpendicolari all’asse della trave, l’area dell’armatura trasversale non deve essere minore di 0,002 volte l’area del calcestruzzo della soletta posta al di sopra dell’estradosso della lamiera grecata e deve essere uniformemente distribuita.", [], { wrap: true, hyphen: true, manual: true }),
    ], { formulaIds: [], tableIds: [], figureIds: [figureId("4.3.5")] }),
    makeUnit("4.3.4.4", "MODALITÀ ESECUTIVE", "subparagraph", [heading("4.3.4.4", "MODALITÀ ESECUTIVE", 127, p127.h344), textBlock("4.3.4.4", "p-001", "paragraph", 127, p127.exec, "Le modalità esecutive devono essere conformi alle indicazioni di normative di comprovata validità.")], { formulaIds: [], tableIds: [], figureIds: [] }),
    makeUnit("4.3.4.5", "SPESSORI MINIMI", "subparagraph", [
        heading("4.3.4.5", "SPESSORI MINIMI", 127, p127.h345),
        textBlock("4.3.4.5", "p-001", "paragraph", 127, p127.min1, "Per gli elementi di acciaio della struttura composta valgono le regole stabilite al § 4.2.9.1. delle presenti norme."),
        textBlock("4.3.4.5", "p-002", "paragraph", 127, p127.min2, "Nelle travi composte da profilati metallici e soletta in c.a. lo spessore della soletta collaborante non deve essere inferiore a 50 mm e lo spessore della piattabanda della trave di acciaio cui è collegata la soletta non deve essere inferiore a 5 mm.", [], { wrap: true, manual: true }),
    ], { formulaIds: [], tableIds: [], figureIds: [] }),
    makeUnit("4.3.5", "COLONNE COMPOSTE", "section", [heading("4.3.5", "COLONNE COMPOSTE", 127, p127.h35)], { formulaIds: [], tableIds: [], figureIds: [] }),
    makeUnit("4.3.5.1", "GENERALITÀ E TIPOLOGIE", "subparagraph", [
        heading("4.3.5.1", "GENERALITÀ E TIPOLOGIE", 127, p127.h351),
        textBlock("4.3.5.1", "p-001", "paragraph", 127, p127.typeIntro, "Si considerano colonne composte soggette a compressione centrata, presso-flessione e taglio, costituite dall’unione di profili metallici, armature metalliche e calcestruzzo:"),
        textBlock("4.3.5.1", "list-001", "list-item", 127, p127.typeA, "(a) sezioni completamente rivestite di calcestruzzo;"),
        textBlock("4.3.5.1", "list-002", "list-item", 127, p127.typeB, "(b) sezioni parzialmente rivestite di calcestruzzo;"),
        textBlock("4.3.5.1", "list-003", "list-item", 127, p127.typeC, "(c) sezioni scatolari rettangolari riempite di calcestruzzo;"),
        textBlock("4.3.5.1", "list-004", "list-item", 127, p127.typeD, "(d) sezioni circolari cave riempite di calcestruzzo."),
        assetRef("4.3.5.1", "figure-001", "figure-ref", figureId("4.3.6"), 127, p127.fig36),
        textBlock("4.3.5.1", "p-002", "paragraph", 128, p128.general, "In generale è possibile concepire qualunque tipo di sezione trasversale, in cui gli elementi in acciaio e in calcestruzzo sono assemblati in modo da realizzare qualunque tipo di forma. Il progetto e le verifiche di tali elementi strutturali va eseguito utilizzando procedure numeriche affidabili che tengano in conto le non-linearità dei materiali e dei sistemi di connessione, i fenomeni di ritiro e viscosità, le non linearità legate alle imperfezioni.", [], { wrap: true, hyphen: true, manual: true }),
        textBlock("4.3.5.1", "p-003", "paragraph", 128, p128.reqIntro, "Nel seguito vengono fornite indicazioni per verificare le colonne composte più comuni, vedi fig. 4.3.6, che rispettano i seguenti requisiti:"),
        textBlock("4.3.5.1", "list-005", "list-item", 128, p128.req1, "1. la sezione è doppiamente simmetrica;"),
        textBlock("4.3.5.1", "list-006", "list-item", 128, p128.req2, "2. la sezione è costante lungo l’altezza della colonna;"),
        textBlock("4.3.5.1", "list-007", "list-item", 128, p128.req3, "3. il contributo meccanico del profilato in acciaio δ, definito in § 4.3.5.2, è compreso tra 0,2 e 0,9;", [t("3. il contributo meccanico del profilato in acciaio "), m("δ", "\\delta"), t(", definito in § 4.3.5.2, è compreso tra 0,2 e 0,9;")]),
        textBlock("4.3.5.1", "list-008", "list-item", 128, p128.req4, "4. la snellezza normalizzata λ̄, definita in § 4.3.5.2, è inferiore a 2.0;", [t("4. la snellezza normalizzata "), m("λ̄", "\\bar{\\lambda}"), t(", definita in § 4.3.5.2, è inferiore a 2.0;")]),
        textBlock("4.3.5.1", "list-009", "list-item", 128, p128.req5, "5. per le sezioni interamente rivestite, fig. 4.3.6, i copriferri massimi che si possono considerare nel calcolo sono c_y=0,4·b e c_z=0,3·h;", [t("5. per le sezioni interamente rivestite, fig. 4.3.6, i copriferri massimi che si possono considerare nel calcolo sono "), m("c_y=0,4·b", "c_y=0.4b"), t(" e "), m("c_z=0,3·h", "c_z=0.3h"), t(";")]),
        textBlock("4.3.5.1", "list-010", "list-item", 128, p128.req6, "6. il rapporto tra l’altezza h_c e la larghezza b_c della sezione deve essere 0,2 ≤ h_c/b_c ≤ 5,0;", [t("6. il rapporto tra l’altezza "), m("h_c", "h_c"), t(" e la larghezza "), m("b_c", "b_c"), t(" della sezione deve essere 0,2 ≤ "), m("h_c/b_c", "h_c/b_c"), t(" ≤ 5,0;")]),
        textBlock("4.3.5.1", "list-011", "list-item", 128, p128.req7, "7. l’armatura longitudinale utilizzata nel calcolo non deve essere maggiore del 6% della sezione in calcestruzzo."),
        textBlock("4.3.5.1", "p-004", "paragraph", 128, p128.criteria, "Nei criteri di verifica, inoltre, si deve distinguere il caso in cui le sollecitazioni siano affidate interamente alla struttura composta dal caso in cui la costruzione venga realizzata costruendo prima la parte in acciaio e poi completandola con il calcestruzzo.", [], { wrap: true, hyphen: true, manual: true }),
    ], { formulaIds: [], tableIds: [], figureIds: [figureId("4.3.6")] }),
    makeUnit("4.3.5.2", "RIGIDEZZA FLESSIONALE, SNELLEZZA E CONTRIBUTO MECCANICO DELL’ACCIAIO", "subparagraph", [
        heading("4.3.5.2", "RIGIDEZZA FLESSIONALE, SNELLEZZA E CONTRIBUTO MECCANICO DELL’ACCIAIO", 128, p128.h352),
        textBlock("4.3.5.2", "p-001", "paragraph", 128, p128.p352a, "Il contributo meccanico del profilato in acciaio è definito dalla formula:"), formulaRef("4.3.5.2", "4.3.15", "formula-001", 128, p128.f315),
        textBlock("4.3.5.2", "p-002", "paragraph", 128, p128.p352b, "dove con A_a è indicata l’area del profilo in acciaio e con N_pl,Rd la resistenza plastica di progetto a sforzo normale della sezione composta, definita in § 4.3.5.3.1.", [t("dove con "), m("A_a", "A_a"), t(" è indicata l’area del profilo in acciaio e con "), m("N_pl,Rd", "N_{pl,Rd}"), t(" la resistenza plastica di progetto a sforzo normale della sezione composta, definita in § 4.3.5.3.1.")]),
        textBlock("4.3.5.2", "p-003", "paragraph", 128, p128.p352c, "La rigidezza flessionale efficace della sezione composta, EJ_eff, da utilizzarsi per la definizione del carico critico euleriano è data dalla formula:", [t("La rigidezza flessionale efficace della sezione composta, "), m("EJ_eff", "(EJ)_{\\mathrm{eff}}"), t(", da utilizzarsi per la definizione del carico critico euleriano è data dalla formula:")]), formulaRef("4.3.5.2", "4.3.16", "formula-002", 128, p128.f316),
        textBlock("4.3.5.2", "p-004", "paragraph", 128, p128.p352d, "dove k_e è un fattore correttivo pari a 0,6, mentre J_a, J_s e J_c sono i momenti di inerzia rispettivamente del profilo in acciaio, delle barre d’armatura e del calcestruzzo ed E_c,eff è il modulo elastico efficace del calcestruzzo ottenuto tenendo conto degli effetti della viscosità in base alla relazione:", [t("dove "), m("k_e", "k_e"), t(" è un fattore correttivo pari a 0,6, mentre "), m("J_a", "J_a"), t(", "), m("J_s", "J_s"), t(" e "), m("J_c", "J_c"), t(" sono i momenti di inerzia rispettivamente del profilo in acciaio, delle barre d’armatura e del calcestruzzo ed "), m("E_c,eff", "E_{c,\\mathrm{eff}}"), t(" è il modulo elastico efficace del calcestruzzo ottenuto tenendo conto degli effetti della viscosità in base alla relazione:")]), formulaRef("4.3.5.2", "4.3.17", "formula-003", 128, p128.f317),
        textBlock("4.3.5.2", "p-005", "paragraph", 128, p128.dove, "dove"),
        textBlock("4.3.5.2", "p-006", "paragraph", 128, p128.definitions, "E_cm è il modulo elastico istantaneo del calcestruzzo; φ è il coefficiente di viscosità definito al punto (11.2.10.7); N_Ed è la massima azione assiale di progetto; N_G,Ed è l’aliquota di azione assiale dovuta alle azioni permanenti.", [m("E_cm", "E_{cm}"), t(" è il modulo elastico istantaneo del calcestruzzo; "), m("φ", "\\varphi"), t(" è il coefficiente di viscosità definito al punto (11.2.10.7); "), m("N_Ed", "N_{Ed}"), t(" è la massima azione assiale di progetto; "), m("N_G,Ed", "N_{G,Ed}"), t(" è l’aliquota di azione assiale dovuta alle azioni permanenti.")]),
        textBlock("4.3.5.2", "p-007", "paragraph", 128, p128.p352e, "La snellezza normalizzata della colonna è definita come:", [t("La snellezza normalizzata della colonna è definita come:")]), formulaRef("4.3.5.2", "4.3.18", "formula-004", 128, p128.f318),
        textBlock("4.3.5.2", "p-008", "paragraph", 128, p128.p352f, "dove N_cr è il carico critico euleriano definito in base alla rigidezza flessionale efficace della colonna composta e N_pl,Rk è il valore caratteristico della resistenza a compressione dato da:", [t("dove "), m("N_cr", "N_{cr}"), t(" è il carico critico euleriano definito in base alla rigidezza flessionale efficace della colonna composta e "), m("N_pl,Rk", "N_{pl,Rk}"), t(" è il valore caratteristico della resistenza a compressione dato da:")]), formulaRef("4.3.5.2", "4.3.19", "formula-005", 128, p128.f319),
        textBlock("4.3.5.2", "p-009", "paragraph", 128, p128.p352g, "Nel calcolo delle sollecitazioni allo stato limite ultimo la rigidezza flessionale dovrebbe essere determinata in base alla relazione seguente per tenere conto degli effetti del secondo ordine:", [], { wrap: true, hyphen: true, manual: true }), formulaRef("4.3.5.2", "4.3.20", "formula-006", 128, p128.f320),
        textBlock("4.3.5.2", "p-010", "paragraph", 128, p128.p352h, "dove k_0 vale 0,9 e k_e,II è assunto pari a 0,5.", [t("dove "), m("k_0", "k_0"), t(" vale 0,9 e "), m("k_e,II", "k_{e,II}"), t(" è assunto pari a 0,5.")]),
        textBlock("4.3.5.2", "p-011", "paragraph", 128, p128.p352i, "Quando una colonna è particolarmente snella, oppure quando la costruzione richiede particolari livelli di sicurezza, è necessario considerare anche i fenomeni a lungo termine."),
    ], { formulaIds: formulaAssets.filter((asset) => asset.unitId === unitId("4.3.5.2")).map((asset) => asset.id), tableIds: [], figureIds: [] }),
    makeUnit("4.3.5.3", "RESISTENZA DELLE SEZIONI", "subparagraph", [heading("4.3.5.3", "RESISTENZA DELLE SEZIONI", 129, p129.h353)], { formulaIds: [], tableIds: [], figureIds: [] }),
    makeUnit("4.3.5.3.1", "Resistenza della sezione per tensioni normali", "subparagraph", [
        heading("4.3.5.3.1", "Resistenza della sezione per tensioni normali", 129, p129.h3531),
        textBlock("4.3.5.3.1", "p-001", "paragraph", 129, p129.p3531a, "La resistenza plastica di progetto della sezione composta a sforzo normale può essere valutata secondo la formula"), formulaRef("4.3.5.3.1", "4.3.21", "formula-001", 129, p129.f321),
        textBlock("4.3.5.3.1", "p-002", "paragraph", 129, p129.p3531b, "dove A_a, A_c, A_s sono, rispettivamente, le aree del profilo in acciaio, della parte in calcestruzzo e delle barre d’armatura. Nel caso in cui si adottino sezioni riempite (Fig.4.3.6 c, d) è possibile sostituire il coefficiente 0.85 con il coefficiente 1.0, (fig. 4.3.6 c). Nelle colonne composte riempite realizzate con profili a sezione cava di forma circolare (fig.4.3.6 d) è possibile tenere in conto, nel calcolo della sforzo normale plastico resistente, degli effetti prodotti dal confinamento che il tubo in acciaio esercita sul calcestruzzo.", [t("dove "), m("A_a", "A_a"), t(", "), m("A_c", "A_c"), t(", "), m("A_s", "A_s"), t(" sono, rispettivamente, le aree del profilo in acciaio, della parte in calcestruzzo e delle barre d’armatura. Nel caso in cui si adottino sezioni riempite (Fig.4.3.6 c, d) è possibile sostituire il coefficiente 0.85 con il coefficiente 1.0, (fig. 4.3.6 c). Nelle colonne composte riempite realizzate con profili a sezione cava di forma circolare (fig.4.3.6 d) è possibile tenere in conto, nel calcolo della sforzo normale plastico resistente, degli effetti prodotti dal confinamento che il tubo in acciaio esercita sul calcestruzzo.")], { wrap: true, hyphen: true, manual: true }),
        textBlock("4.3.5.3.1", "p-003", "paragraph", 129, p129.p3531c, "In particolare, è possibile fare riferimento a vari modelli di confinamento presenti nelle normative e nella documentazione tecnico/scientifica di comprovata validità. In mancanza di più precise analisi e per elementi strutturali del tipo rappresentato nella Figura 4.3.7 è possibile utilizzare il seguente modello di confinamento.", [], { wrap: true, hyphen: true, manual: true }),
        textBlock("4.3.5.3.1", "p-004", "paragraph", 129, p129.p3531d, "La resistenza plastica di progetto della colonna circolare riempita di calcestruzzo, tenendo conto del confinamento, assume la seguente forma:", [], { wrap: true, hyphen: true, manual: true }), formulaRef("4.3.5.3.1", "4.3.22", "formula-002", 129, p129.f322), formulaRef("4.3.5.3.1", "4.3.23", "formula-003", 129, p129.f323), formulaRef("4.3.5.3.1", "4.3.24", "formula-004", 129, p129.f324),
        assetRef("4.3.5.3.1", "figure-001", "figure-ref", figureId("4.3.7"), 129, p129.fig37),
        textBlock("4.3.5.3.1", "p-005", "paragraph", 129, p129.p3531e, "Il calcolo del momento resistente di progetto della colonna composta M_Rd in funzione dello sforzo normale N_Ed agente si ricava dal dominio di interazione M-N, che definisce la resistenza della sezione trasversale.", [t("Il calcolo del momento resistente di progetto della colonna composta "), m("M_Rd", "M_{Rd}"), t(" in funzione dello sforzo normale "), m("N_Ed", "N_{Ed}"), t(" agente si ricava dal dominio di interazione M-N, che definisce la resistenza della sezione trasversale.")]),
        textBlock("4.3.5.3.1", "p-006", "paragraph", 129, p129.p3531f, "Per definire tale dominio di interazione N-M, è possibile utilizzare metodi presenti nelle normative e nella documentazione tecnica di comprovata validità oppure utilizzare apposite procedure e tecniche numeriche basate sull’integrazione dei legami costitutivi tensione-deformazione dell’acciaio e del calcestruzzo nella sezione composta.", [], { wrap: true, hyphen: true, manual: true }),
        textBlock("4.3.5.3.1", "p-007", "paragraph", 129, p129.p3531g, "È possibile, nel caso si utilizzino i tipi di sezione composta presentate nella Figura 4.3.6 e rispettose dei requisiti esposti in § 4.3.5.1, utilizzare un metodo semplificato per la definizione del dominio di interazione N-M (vedi Figura 4.3.8).", [], { wrap: true, hyphen: true, manual: true }),
        assetRef("4.3.5.3.1", "figure-002", "figure-ref", figureId("4.3.8"), 130, p130.fig38),
        textBlock("4.3.5.3.1", "p-008", "paragraph", 130, p130.p3531h, "In tale metodo si assume il modello dello stress-block per il calcestruzzo, si trascura la resistenza a trazione del conglomerato e si adotta un metodo di calcolo plastico in cui le barre d’armatura sono assunte completamente snervate, così come il profilo in acciaio. Il dominio non è rappresentato completamente, ma approssimato secondo una poligonale passante per quattro punti: A, B, C e D.", [], { wrap: true, hyphen: true, manual: true }),
        textBlock("4.3.5.3.1", "p-009", "paragraph", 130, p130.p3531i, "I punti A e B corrispondono, rispettivamente, alle sollecitazioni di forza normale centrata e flessione pura."),
        textBlock("4.3.5.3.1", "p-010", "paragraph", 130, p130.p3531j, "I punti C e D sono ottenuti fissando lo sforzo normale al valore N_pm,Rd e 0,5 N_pm,Rd, essendo N_pm,Rd lo sforzo normale resistente di progetto della sola porzione di calcestruzzo della sezione composta:", [t("I punti C e D sono ottenuti fissando lo sforzo normale al valore "), m("N_pm,Rd", "N_{pm,Rd}"), t(" e 0,5 "), m("N_pm,Rd", "N_{pm,Rd}"), t(", essendo "), m("N_pm,Rd", "N_{pm,Rd}"), t(" lo sforzo normale resistente di progetto della sola porzione di calcestruzzo della sezione composta:")]), formulaRef("4.3.5.3.1", "4.3.25", "formula-005", 130, p130.f325),
        textBlock("4.3.5.3.1", "p-011", "paragraph", 130, p130.p3531k, "dove A_c è l’area complessiva di calcestruzzo della sezione composta.", [t("dove "), m("A_c", "A_c"), t(" è l’area complessiva di calcestruzzo della sezione composta.")]),
        textBlock("4.3.5.3.1", "p-012", "paragraph", 130, p130.p3531l, "Dal dominio resistente si ricava il momento resistente plastico di progetto associato allo sforzo normale N_Ed della combinazione di calcolo come:", [t("Dal dominio resistente si ricava il momento resistente plastico di progetto associato allo sforzo normale "), m("N_Ed", "N_{Ed}"), t(" della combinazione di calcolo come:")]), formulaRef("4.3.5.3.1", "4.3.26", "formula-006", 130, p130.f326),
        textBlock("4.3.5.3.1", "p-013", "paragraph", 130, p130.p3531m, "dove M_pl,Rd è il momento resistente plastico di progetto e μ_d è un coefficiente di progetto a presso-flessione uniassiale.", [t("dove "), m("M_pl,Rd", "M_{pl,Rd}"), t(" è il momento resistente plastico di progetto e "), m("μ_d", "\\mu_d"), t(" è un coefficiente di progetto a presso-flessione uniassiale.")]),
        textBlock("4.3.5.3.1", "p-014", "paragraph", 130, p130.p3531n, "Nel caso in cui la colonna sia soggetta a sollecitazioni di presso-flessione deviata, la verifica della colonna composta è condotta calcolando i coefficienti di progetto μ_dy e μ_dz indipendentemente per i due piani di flessione delle colonne, secondo il metodo presentato nella Figura 4.3.8, e controllando che:", [t("Nel caso in cui la colonna sia soggetta a sollecitazioni di presso-flessione deviata, la verifica della colonna composta è condotta calcolando i coefficienti di progetto "), m("μ_dy", "\\mu_{dy}"), t(" e "), m("μ_dz", "\\mu_{dz}"), t(" indipendentemente per i due piani di flessione delle colonne, secondo il metodo presentato nella Figura 4.3.8, e controllando che:")]), formulaRef("4.3.5.3.1", "4.3.27", "formula-007", 130, p130.f327),
        textBlock("4.3.5.3.1", "p-015", "paragraph", 130, p130.p3531o, "dove M_pl,y,Rd e M_pl,z,Rd sono i momenti resistenti plastici rispetto ai due piani di flessione, mentre M_y,Ed ed M_z,Ed sono i momenti sollecitanti derivanti dalle analisi strutturali, incrementati per tenere conto dei fenomeni del II ordine, come esposto in § 4.3.5.4.3 oppure calcolati secondo uno schema di calcolo in cui le imperfezioni dell’elemento sono state considerate utilizzando opportuni fattori di imperfezione. I coefficienti α_M,y e α_M,z sono quelli riportati in § 4.3.5.4.3.", [], { wrap: true, hyphen: true, manual: true }),
    ], { formulaIds: formulaAssets.filter((asset) => asset.unitId === unitId("4.3.5.3.1")).map((asset) => asset.id), tableIds: [], figureIds: [figureId("4.3.7"), figureId("4.3.8")] }),
    makeUnit("4.3.5.3.2", "Resistenza e taglio della sezione", "subparagraph", [
        heading("4.3.5.3.2", "Resistenza e taglio della sezione", 130, p130.h3532),
        textBlock("4.3.5.3.2", "p-001", "paragraph", 130, p130.p3532a, "La sollecitazione di taglio di progetto V_Ed agente sulla sezione deve essere distribuita tra la porzione in acciaio e la porzione in calcestruzzo in modo da risultare minore o uguale della resistenza di ognuna delle due parti della sezione. In assenza di analisi più accurate il taglio può essere suddiviso utilizzando la seguente formula:", [t("La sollecitazione di taglio di progetto "), m("V_Ed", "V_{Ed}"), t(" agente sulla sezione deve essere distribuita tra la porzione in acciaio e la porzione in calcestruzzo in modo da risultare minore o uguale della resistenza di ognuna delle due parti della sezione. In assenza di analisi più accurate il taglio può essere suddiviso utilizzando la seguente formula:")], { wrap: true, hyphen: true, manual: true }), formulaRef("4.3.5.3.2", "4.3.28", "formula-001", 130, p130.f328),
        textBlock("4.3.5.3.2", "p-002", "paragraph", 131, p131.p3532b, "dove M_pl,Rd è il momento resistente di progetto della sezione composta mentre M_pl,a,Rd è il momento resistente di progetto della sola sezione in acciaio. In generale la sollecitazione di taglio di progetto sulla parte in acciaio, V_a,Ed, non deve eccedere il 50% del taglio resistente di progetto della sola sezione in acciaio, V_a,Rd (§ 4.2.4.1.2), per poterne così trascurare l’influenza sulla determinazione della curva di interazione N-M. In caso contrario è possibile tenerne in conto dell’interazione in base alle indicazioni del § 4.2.4.1.2.", [t("dove "), m("M_pl,Rd", "M_{pl,Rd}"), t(" è il momento resistente di progetto della sezione composta mentre "), m("M_pl,a,Rd", "M_{pl,a,Rd}"), t(" è il momento resistente di progetto della sola sezione in acciaio. In generale la sollecitazione di taglio di progetto sulla parte in acciaio, "), m("V_a,Ed", "V_{a,Ed}"), t(", non deve eccedere il 50% del taglio resistente di progetto della sola sezione in acciaio, "), m("V_a,Rd", "V_{a,Rd}"), t(" (§ 4.2.4.1.2), per poterne così trascurare l’influenza sulla determinazione della curva di interazione N-M. In caso contrario è possibile tenerne in conto dell’interazione in base alle indicazioni del § 4.2.4.1.2.")], { wrap: true, hyphen: true, manual: true }),
        textBlock("4.3.5.3.2", "p-003", "paragraph", 131, p131.p3532c, "Per semplicità è possibile procedere assegnando tutta l’azione di taglio V_Ed alla sola parte in acciaio.", [t("Per semplicità è possibile procedere assegnando tutta l’azione di taglio "), m("V_Ed", "V_{Ed}"), t(" alla sola parte in acciaio.")]),
    ], { formulaIds: [formulaId("4.3.28")], tableIds: [], figureIds: [] }),
    makeUnit("4.3.5.4", "STABILITÀ DELLE MEMBRATURE", "subparagraph", [heading("4.3.5.4", "STABILITÀ DELLE MEMBRATURE", 131, p131.h354)], { formulaIds: [], tableIds: [], figureIds: [] }),
    makeUnit("4.3.5.4.1", "Colonne compresse", "subparagraph", [
        heading("4.3.5.4.1", "Colonne compresse", 131, p131.h3541),
        textBlock("4.3.5.4.1", "p-001", "paragraph", 131, p131.p3541a, "La resistenza di progetto all’instabilità della colonna composta è data dalla formula:"), formulaRef("4.3.5.4.1", "4.3.29", "formula-001", 131, p131.f329),
        textBlock("4.3.5.4.1", "p-002", "paragraph", 131, p131.p3541b, "dove N_pl,Rd è la resistenza definita in § 4.3.5.3.1 e χ è il coefficiente riduttivo che tiene conto dei fenomeni di instabilità, definito in funzione della snellezza normalizzata dell’elemento λ̄ con la formula:", [t("dove "), m("N_pl,Rd", "N_{pl,Rd}"), t(" è la resistenza definita in § 4.3.5.3.1 e "), m("χ", "\\chi"), t(" è il coefficiente riduttivo che tiene conto dei fenomeni di instabilità, definito in funzione della snellezza normalizzata dell’elemento "), m("λ̄", "\\bar{\\lambda}"), t(" con la formula:")]), formulaRef("4.3.5.4.1", "4.3.30", "formula-002", 131, p131.f330),
        textBlock("4.3.5.4.1", "p-003", "paragraph", 131, p131.phi, "dove Φ = 0,5 [1 + α (λ̄ − 0,2) + λ̄²] e α è il fattore di imperfezione, ricavato dalla Tab. 4.3.III.", [t("dove "), m("Φ", "\\Phi"), t(" = 0,5 [1 + "), m("α", "\\alpha"), t(" ("), m("λ̄", "\\bar{\\lambda}"), t(" − 0,2) + "), m("λ̄²", "\\bar{\\lambda}^2"), t("] e "), m("α", "\\alpha"), t(" è il fattore di imperfezione, ricavato dalla Tab. 4.3.III.")]), formulaRef("4.3.5.4.1", "4.3.30-phi", "formula-003", 131, p131.phi),
        assetRef("4.3.5.4.1", "table-001", "table-ref", tableId("4.3.iii"), 131, p131.table3541),
    ], { formulaIds: [formulaId("4.3.29"), formulaId("4.3.30"), formulaId("4.3.30-phi")], tableIds: [tableId("4.3.iii")], figureIds: [] }),
    makeUnit("4.3.5.4.2", "Instabilità locale", "subparagraph", [
        heading("4.3.5.4.2", "Instabilità locale", 131, p131.h3542),
        textBlock("4.3.5.4.2", "p-001", "paragraph", 131, p131.p3542a, "I fenomeni di instabilità locale possono essere trascurati nel calcolo delle colonne se sono rispettate le seguenti disuguaglianze:"),
        formulaRef("4.3.5.4.2", "4.3.31", "formula-001", 131, p131.f331),
        formulaRef("4.3.5.4.2", "4.3.32", "formula-002", 131, p131.f331),
        formulaRef("4.3.5.4.2", "4.3.33", "formula-003", 132, p132.f333),
        formulaRef("4.3.5.4.2", "4.3.34", "formula-004", 132, p132.f334),
        textBlock("4.3.5.4.2", "p-002", "paragraph", 132, p132.defs, "dove b e t_f sono rispettivamente la larghezza e lo spessore delle ali del profilo ad I o H; d e t sono invece il diametro e lo spessore della sezione dei profili cavi; c è il copriferro esterno delle sezioni interamente rivestite.", [t("dove "), m("b", "b"), t(" e "), m("t_f", "t_f"), t(" sono rispettivamente la larghezza e lo spessore delle ali del profilo ad I o H; "), m("d", "d"), t(" e "), m("t", "t"), t(" sono invece il diametro e lo spessore della sezione dei profili cavi; "), m("c", "c"), t(" è il copriferro esterno delle sezioni interamente rivestite.")]),
    ], { formulaIds: [formulaId("4.3.31"), formulaId("4.3.32"), formulaId("4.3.33"), formulaId("4.3.34")], tableIds: [], figureIds: [] }),
];

const manifest = {
    $schema: "urn:structural-codes:schema:asset-manifest:v2", schemaVersion: "2.0.0-alpha.1", recordType: "asset-manifest", document: "ntc2018", section: "4.3-step3", sourceId, status: "transcribed-unreviewed", formulas: formulaAssets, tables: [tableAsset],
    figures: await Promise.all(figureAssets.map(async (asset) => { const { filename, ...manifestAsset } = asset; return { ...manifestAsset, sha256: await sha256OfFile(join(figureDirectory, filename)) }; })),
};

mkdirSync(unitDirectory, { recursive: true });
mkdirSync(assetDirectory, { recursive: true });
for (const unit of units) writeFileSync(join(unitDirectory, `${unit.numbering.official}.json`), `${JSON.stringify(unit, null, 2)}\n`, "utf8");
writeFileSync(join(assetDirectory, "4.3-step3.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(`NTC 4.3 step3: generate ${units.length} unità e ${formulaAssets.length} formule, 1 tabella, ${figureAssets.length} figure.`);
