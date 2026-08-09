import { copyFile, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { sha256OfText } from "../src/lib/hash.ts";

const root = fileURLToPath(new URL("../", import.meta.url));
const unitDirectory = join(root, "corpus", "units", "circ2019");
const assetDirectory = join(root, "corpus", "assets", "circ2019");
const figureDirectory = join(root, "corpus", "assets", "figures", "circ2019");
const evidenceRenderDirectory = join(root, "evidence", "circ-7-2019", "renders");
const sourceId = "circ-7-2019";
const workId = "it-mit:circ:2019-01-21:7-csllpp";
const expressionId = "it-mit:circ:2019-01-21:7-csllpp:original-it";
const profile = "circ42-editorial-profile-0.1.0";
const createdAt = "2026-08-09T00:00:00Z";

type Region = { coordinateSystem: "pdf-points-top-left"; x: number; y: number; width: number; height: number };
type Inline = { kind: "text" | "math"; value: string; latex?: string };
type TextKind = "heading" | "paragraph";
type FormulaRow = { number: string; officialNumber: string | null; unit: string; page: number; latex: string; raw: string; region: Region };
type GeneratedBlock = {
    blockId: string;
    kind: string;
    origin: "official";
    text?: { raw: string; normalized: string; normalizationVersion: string; inline: Inline[] };
    evidence: { rawSha256: string; normalizedSha256: string; [key: string]: unknown };
    assetId?: string;
};

const uid = (number: string) => `urn:structural-codes:it:unit:circ2019:${number.toLowerCase()}`;
const formulaId = (number: string) => `urn:structural-codes:it:asset:formula:circ2019:${number.toLowerCase()}`;
const tableId = (number: string) => `urn:structural-codes:it:asset:table:circ2019:${number.toLowerCase()}`;
const figureId = (number: string) => `urn:structural-codes:it:asset:figure:circ2019:${number.toLowerCase()}`;
const reg = (x: number, y: number, width: number, height: number): Region => ({ coordinateSystem: "pdf-points-top-left", x, y, width, height });
const pageRegion = (): Region => reg(73.9, 55, 450, 730);
const text = (value: string): Inline => ({ kind: "text", value });
const math = (value: string, latex: string): Inline => ({ kind: "math", value, latex });
const hash = (value: string) => sha256OfText(value);

function transformations(raw: string, normalized: string) {
    const result = [{ operation: "join-line-wrap", ruleVersion: profile, note: "Ricomposte le righe tipografiche appartenenti allo stesso capoverso; i capoversi distinti restano blocchi separati." }];
    if (raw !== normalized) result.push({ operation: "manual-correction", ruleVersion: profile, note: "Ripristinati accenti, apostrofi, simboli e notazione confrontati con il render ufficiale." });
    result.push({ operation: "unicode-nfc", ruleVersion: profile, note: "Testo normalizzato in Unicode NFC." });
    return result;
}

function evidence(page: number, raw: string, normalized: string, region: Region, manual = false) {
    return {
        sourceId,
        pdfPage: page,
        printedPage: String(page - 4),
        region,
        extraction: { method: manual ? "manual-transcription" : "pdf-text", tool: manual ? "codex-source-transcription" : "pdfjs-dist", toolVersion: manual ? profile : "4.10.38" },
        transformations: transformations(raw, normalized),
        rawSha256: hash(raw),
        normalizedSha256: hash(normalized),
    };
}

function block(number: string, suffix: string, kind: TextKind, page: number, normalized: string, inline: Inline[] = [text(normalized)], raw = normalized) {
    return { blockId: `${uid(number)}#block-${suffix}`, kind, origin: "official" as const, text: { raw, normalized, normalizationVersion: profile, inline }, evidence: evidence(page, raw, normalized, pageRegion()) };
}

function formulaBlock(number: string, suffix: string, formula: FormulaRow) {
    return { blockId: `${uid(number)}#block-${suffix}`, kind: "formula-ref", origin: "official" as const, assetId: formulaId(formula.number), evidence: evidence(formula.page, formula.raw, formula.raw, formula.region, true) };
}

function tableBlock(number: string, suffix: string, page: number, asset: string, caption: string, region: Region) {
    return { blockId: `${uid(number)}#block-${suffix}`, kind: "table-ref", origin: "official" as const, assetId: asset, evidence: evidence(page, caption, caption, region, true) };
}

function figureBlock(number: string, suffix: string, page: number, asset: string, caption: string, region: Region) {
    return { blockId: `${uid(number)}#block-${suffix}`, kind: "figure-ref", origin: "official" as const, assetId: asset, evidence: evidence(page, caption, caption, region, true) };
}

function parent(number: string) {
    const parts = number.split(".");
    return parts.length === 1 ? null : uid(parts.slice(0, -1).join("."));
}

function ancestors(number: string) {
    const parts = number.split(".");
    return parts.slice(1).map((_, index) => uid(parts.slice(0, index + 1).join(".")));
}

function makeUnit(number: string, title: string, blocks: GeneratedBlock[], formulas: string[] = [], tables: string[] = [], figures: string[] = []) {
    return {
        $schema: "urn:structural-codes:schema:canonical-unit:v2",
        schemaVersion: "2.0.0-alpha.2",
        recordType: "canonical-unit",
        id: uid(number),
        workId,
        expressionId,
        kind: "subparagraph",
        numbering: { official: number, sortKey: number.replace(/^C/, "").split(".").map((part) => part.padStart(3, "0")).join(".") },
        title,
        titleBlockId: `${uid(number)}#block-heading`,
        hierarchy: { parentId: parent(number), ancestorIds: ancestors(number), position: Number(number.split(".").at(-1) ?? "1") },
        validity: { from: null, to: null, status: "unknown", asOf: "2026-08-09" },
        blocks,
        citations: [],
        relations: [],
        assets: { formulaIds: formulas.map(formulaId), tableIds: tables.map(tableId), figureIds: figures.map(figureId) },
        workflow: {
            status: "extracted",
            createdBy: { actorId: "codex:circ42-step2c", kind: "automated-agent", toolVersion: profile },
            createdAt,
            reviews: [],
            openIssues: [
                { issueId: `circ2019-${number.replaceAll(".", "-")}-source-review`, type: "normalization-review", severity: "blocking", note: "Record trascritto dall’evidence ufficiale ma non ancora confrontato integralmente da un revisore umano con il render della fonte." },
                ...(tables.length || figures.length ? [{ issueId: `circ2019-${number.replaceAll(".", "-")}-assets`, type: "asset-review", severity: "blocking", note: "Tabelle e figure sono strutturate o ritagliate dalla fonte; resta obbligatoria la revisione umana indipendente." }] : []),
            ],
        },
    };
}

const formulaRows: FormulaRow[] = [
    { number: "C4.2.43", officialNumber: "C4.2.43", unit: "C4.2.4.1.3.4.1", page: 113, latex: "\\frac{h_w}{t}\\ge\\frac{72}{\\eta}\\,\\varepsilon", raw: "h_w/t ≥ 72/η · ε [C4.2.43]", region: reg(145, 130, 310, 55) },
    { number: "C4.2.44", officialNumber: "C4.2.44", unit: "C4.2.4.1.3.4.1", page: 113, latex: "\\frac{h_w}{t}\\ge\\frac{31}{\\eta}\\,\\varepsilon\\sqrt{k_\\tau}", raw: "h_w/t ≥ 31/η · ε · √k_τ [C4.2.44]", region: reg(145, 205, 310, 55) },
    { number: "C4.2.45", officialNumber: "C4.2.45", unit: "C4.2.4.1.3.4.1", page: 113, latex: "\\varepsilon=\\sqrt{\\frac{235}{f_y}}\\,[\\mathrm{MPa}]", raw: "ε = √(235/f_y) [MPa] [C4.2.45]", region: reg(145, 280, 310, 55) },
    { number: "C4.2.46", officialNumber: "C4.2.46", unit: "C4.2.4.1.3.4.1", page: 113, latex: "V_{b,Rd}=V_{bw,Rd}+V_{bf,Rd}\\le\\frac{\\eta\\,f_{yw}\\,h_w\\,t}{\\sqrt{3}\\,\\gamma_{M1}}", raw: "V_b,Rd = V_bw,Rd + V_bf,Rd ≤ η · f_yw · h_w · t/(√3 · γ_M1) [C4.2.46]", region: reg(125, 350, 340, 70) },
    { number: "C4.2.47", officialNumber: "C4.2.47", unit: "C4.2.4.1.3.4.1", page: 113, latex: "V_{bw,Rd}=\\frac{\\chi_w\\,f_{yw}\\,h_w\\,t}{\\sqrt{3}\\,\\gamma_{M1}}", raw: "V_bw,Rd = χ_w · f_yw · h_w · t/(√3 · γ_M1) [C4.2.47]", region: reg(145, 475, 310, 60) },
    { number: "C4.2.48", officialNumber: "C4.2.48", unit: "C4.2.4.1.3.4.1", page: 113, latex: "V_{bf,Rd}=\\frac{b_f\\,t_f^2\\,f_{yf}}{a\\left(0{,}25+\\frac{1{,}6\\,b_f\\,t_f^2\\,f_{yf}}{t\\,h_w^2\\,f_{yw}}\\right)\\gamma_{M1}}\\left[1-\\left(\\frac{M_{Ed}}{M_{f,red}}\\right)^2\\right]", raw: "V_bf,Rd = [b_f · t_f² · f_yf / (a(0,25 + 1,6 · b_f · t_f² · f_yf/(t · h_w² · f_yw))γ_M1)] · [1 − (M_Ed/M_f,red)²] [C4.2.48]", region: reg(90, 535, 415, 105) },
    { number: "C4.2.49", officialNumber: "C4.2.49", unit: "C4.2.4.1.3.4.1", page: 113, latex: "M_{f,red}=\\frac{M_{fk}}{\\gamma_{M0}}\\left(1-\\frac{N_{Ed}\\,\\gamma_{M0}}{(A_{fi}+A_{fs})\\,f_{yf}}\\right)", raw: "M_f,red = M_fk/γ_M0 · (1 − N_Ed · γ_M0/((A_fi + A_fs) · f_yf)) [C4.2.49]", region: reg(135, 650, 350, 65) },
    { number: "C4.2.50", officialNumber: "C4.2.50", unit: "C4.2.4.1.3.4.1", page: 114, latex: "\\lambda_w=0{,}76\\sqrt{\\frac{f_{yw}}{\\tau_{cr}}}", raw: "λ_w = 0,76 √(f_yw/τ_cr) [C4.2.50]", region: reg(145, 75, 310, 60) },
    { number: "C4.2.4.1.3.4.1-sigma-e", officialNumber: null, unit: "C4.2.4.1.3.4.1", page: 114, latex: "\\sigma_E=\\frac{\\pi^2 E t^2}{12(1-\\nu^2)h_w^2}=190000\\left(\\frac{t}{h_w}\\right)^2\\,[\\mathrm{MPa}]", raw: "σ_E = π² · E · t²/[12(1 − ν²) · h_w²] = 190000(t/h_w)² [MPa]", region: reg(115, 145, 380, 70) },
    { number: "C4.2.51", officialNumber: "C4.2.51", unit: "C4.2.4.1.3.4.1", page: 114, latex: "\\begin{aligned}k_\\tau&=5{,}34+4{,}00\\left(\\frac{h_w}{a}\\right)^2 &&\\text{se } a/h_w\\ge1\\\\k_\\tau&=4{,}00+5{,}34\\left(\\frac{h_w}{a}\\right)^2 &&\\text{se } a/h_w<1\\end{aligned}", raw: "k_τ = 5,34 + 4,00(h_w/a)² se a/h_w ≥ 1; k_τ = 4,00 + 5,34(h_w/a)² se a/h_w < 1 [C4.2.51]", region: reg(125, 205, 355, 105) },
    { number: "C4.2.52", officialNumber: "C4.2.52", unit: "C4.2.4.1.3.4.1", page: 114, latex: "\\begin{aligned}I_{st}&\\ge1{,}5\\,h_w^3\\,t^3/a^2 &&\\text{se } a/h_w<\\sqrt{2}\\\\I_{st}&\\ge0{,}75\\,h_w\\,t^3 &&\\text{se } a/h_w\\ge\\sqrt{2}\\end{aligned}", raw: "I_st ≥ 1,5 · h_w³ · t³/a² se a/h_w < √2; I_st ≥ 0,75 · h_w · t³ se a/h_w ≥ √2 [C4.2.52]", region: reg(125, 320, 355, 85) },
    { number: "C4.2.53", officialNumber: "C4.2.53", unit: "C4.2.4.1.3.4.1", page: 114, latex: "N_{st,d}=V_{Ed}-\\frac{f_{yw}\\,h_w\\,t}{\\sqrt{3}\\,\\lambda_w^2\\,\\gamma_{M1}}", raw: "N_st,d = V_Ed − f_yw · h_w · t/(√3 · λ_w² · γ_M1) [C4.2.53]", region: reg(145, 415, 315, 60) },
    { number: "C4.2.54", officialNumber: "C4.2.54", unit: "C4.2.4.1.3.4.1", page: 114, latex: "\\begin{aligned}k_\\tau&=5{,}34+4{,}00\\left(\\frac{h_w}{a}\\right)^2+k_{\\tau l} &&\\text{quando } \\alpha=a/h_w\\ge1\\\\k_\\tau&=4{,}00+5{,}34\\left(\\frac{h_w}{a}\\right)^2+k_{\\tau l} &&\\text{quando } \\alpha=a/h_w<1\\end{aligned}", raw: "k_τ = 5,34 + 4,00(h_w/a)² + k_τl quando α = a/h_w ≥ 1; k_τ = 4,00 + 5,34(h_w/a)² + k_τl quando α = a/h_w < 1 [C4.2.54]", region: reg(105, 485, 390, 100) },
    { number: "C4.2.55", officialNumber: "C4.2.55", unit: "C4.2.4.1.3.4.1", page: 114, latex: "k_{\\tau l}=\\max\\left[\\left(\\frac{3}{\\alpha}\\right)^2\\sqrt[4]{\\left(\\frac{I_{sl}}{t^3\\,h_w}\\right)^3};\\frac{2{,}1}{t}\\sqrt[3]{\\frac{I_{sl}}{h_w}}\\right]", raw: "k_τl = max[(3/α)² · ⁴√((I_sl/(t³ · h_w))³); (2,1/t) · ³√(I_sl/h_w)] [C4.2.55]", region: reg(105, 585, 390, 75) },
    { number: "C4.2.56", officialNumber: "C4.2.56", unit: "C4.2.4.1.3.4.1", page: 114, latex: "k_\\tau=4{,}1+\\frac{1}{\\alpha^2}\\left(6{,}3+0{,}18\\frac{I_{sl}}{t^3 h_w}\right)+2{,}2\\sqrt[3]{\\frac{I_{sl}}{t^3 h_w}}", raw: "k_τ = 4,1 + 1/α² · (6,3 + 0,18 · I_sl/(t³ · h_w)) + 2,2 · ³√(I_sl/(t³ · h_w)) [C4.2.56]", region: reg(105, 660, 390, 70) },
];

const formulaByNumber = new Map(formulaRows.map((row) => [row.number, row]));
const formula = (number: string) => formulaByNumber.get(number)!;
const c = (value: string, latex?: string, spans: { colSpan?: number; rowSpan?: number } = {}) => ({ text: value, ...(latex ? { latex } : {}), ...spans });
const f = (value: string, latex: string, spans: { colSpan?: number; rowSpan?: number } = {}) => c(value, latex, spans);

const tableVIIId = tableId("C4.2.VII");
const tableVII = {
    id: tableVIIId,
    unitId: uid("C4.2.4.1.3.4.1"),
    officialNumber: "C4.2.VII",
    pdfPage: 113,
    caption: "Coefficienti χ_w per il calcolo della resistenza all’instabilità a taglio del pannello",
    columnCount: 3,
    headers: [[c("Coefficiente di snellezza"), c("Coefficiente χ_w per montanti d’appoggio rigidi"), c("Coefficiente χ_w per gli altri casi")]],
    rows: [
        [f("λ_w < 0,83/η", "\\lambda_w<0{,}83/\\eta"), f("η", "\\eta"), f("η", "\\eta")],
        [f("(0,83/η) ≤ λ_w < 1,08", "(0{,}83/\\eta)\\le\\lambda_w<1{,}08"), f("0,83/λ_w", "0{,}83/\\lambda_w"), f("0,83/λ_w", "0{,}83/\\lambda_w")],
        [f("λ_w ≥ 1,08", "\\lambda_w\\ge1{,}08"), f("1,37/(0,7 + λ̄_w)", "\\frac{1{,}37}{0{,}7+\\bar{\\lambda}_w}"), f("0,83/λ_w", "0{,}83/\\lambda_w")],
    ],
    notes: [],
};

const figureNumber = "C4.2.12";
const figureAssetId = figureId(figureNumber);
const figureRegion = reg(190, 628, 220, 112);

const units = [
    makeUnit("C4.2.4.1.3.4", "Stabilità dei pannelli", [
        block("C4.2.4.1.3.4", "heading", "heading", 112, "C4.2.4.1.3.4 Stabilità dei pannelli"),
        block("C4.2.4.1.3.4", "p1", "paragraph", 112, "I pannelli d’anima degli elementi strutturali, laminati oppure realizzati in soluzione composta saldata, devono essere verificati nei confronti dei fenomeni di instabilità dell’equilibrio allo stato limite ultimo."),
        block("C4.2.4.1.3.4", "p2", "paragraph", 112, "In presenza di fenomeni di instabilità che potrebbero portare a rotture per fenomeni di fatica la verifica deve essere condotta in fase d’esercizio (verifica a respiro delle anime): al riguardo si veda § 7.4 del documento UNI EN 1993-2:2007 ed § 4.6 dell’UNI EN 1993-1-5:2007. Inoltre, nel caso di profili in parete sottile e/o sagomati a freddo di classe 4 è necessario fare riferimento ai documenti tecnici specializzati, che trattino le loro problematiche di resistenza e stabilità in maniera più esaustiva. Al riguardo si veda anche il documento UNI EN 1993-1-3."),
        block("C4.2.4.1.3.4", "p3", "paragraph", 113, "Per la verifica dei pannelli d’anima è necessario riferirsi in genere a normative e documentazione tecnica di comprovata validità."),
        block("C4.2.4.1.3.4", "p4", "paragraph", 113, "Nei casi maggiormente ricorrenti è possibile verificare la stabilità dei pannelli d’anima utilizzando le procedure esposte nei paragrafi seguenti."),
    ]),
    makeUnit("C4.2.4.1.3.4.1", "Stabilità dei pannelli soggetti a taglio", [
        block("C4.2.4.1.3.4.1", "heading", "heading", 113, "C4.2.4.1.3.4.1. Stabilità dei pannelli soggetti a taglio"),
        block("C4.2.4.1.3.4.1", "p1", "paragraph", 113, "I pannelli d’anima rettangolari delle travi a pareti piena devono essere verificati nei riguardi dell’instabilità per taglio quando il rapporto altezza spessore h_w/t supera il valore", [text("I pannelli d’anima rettangolari delle travi a pareti piena devono essere verificati nei riguardi dell’instabilità per taglio quando il rapporto altezza spessore "), math("h_w/t", "h_w/t"), text(" supera il valore")]),
        formulaBlock("C4.2.4.1.3.4.1", "formula-43", formula("C4.2.43")),
        block("C4.2.4.1.3.4.1", "p2", "paragraph", 113, "nel caso di pannelli non irrigiditi e"),
        formulaBlock("C4.2.4.1.3.4.1", "formula-44", formula("C4.2.44")),
        block("C4.2.4.1.3.4.1", "p3", "paragraph", 113, "per pannelli irrigiditi, dove h_w è l’altezza del pannello, t il suo spessore, η è uguale a 1,20, k_τ è il minimo coefficiente di instabilità per taglio del pannello e", [text("per pannelli irrigiditi, dove "), math("h_w", "h_w"), text(" è l’altezza del pannello, "), math("t", "t"), text(" il suo spessore, "), math("η", "\\eta"), text(" è uguale a 1,20, "), math("k_τ", "k_\\tau"), text(" è il minimo coefficiente di instabilità per taglio del pannello e")]),
        formulaBlock("C4.2.4.1.3.4.1", "formula-45", formula("C4.2.45")),
        block("C4.2.4.1.3.4.1", "p4", "paragraph", 113, "In questo caso devono essere previsti irrigidimenti trasversali in corrispondenza dei vincoli."),
        block("C4.2.4.1.3.4.1", "p5", "paragraph", 113, "La resistenza all’instabilità per taglio di un pannello d’anima privo di irrigidimenti intermedi è espressa da"),
        formulaBlock("C4.2.4.1.3.4.1", "formula-46", formula("C4.2.46")),
        block("C4.2.4.1.3.4.1", "p6", "paragraph", 113, "dove f_yw è la tensione di snervamento del pannello, χ_w è un coefficiente che tiene conto dell’instabilità elastica dell’elemento ed è dato nella Tabella C4.2.VII in funzione del coefficiente di snellezza λ_w e della rigidezza dell’irrigiditore sull’appoggio, V_bw,Rd è il contributo resistente dell’anima", [text("dove "), math("f_yw", "f_{yw}"), text(" è la tensione di snervamento del pannello, "), math("χ_w", "\\chi_w"), text(" è un coefficiente che tiene conto dell’instabilità elastica dell’elemento ed è dato nella Tabella C4.2.VII in funzione del coefficiente di snellezza "), math("λ_w", "\\lambda_w"), text(" e della rigidezza dell’irrigiditore sull’appoggio, "), math("V_bw,Rd", "V_{bw,Rd}"), text(" è il contributo resistente dell’anima")]),
        formulaBlock("C4.2.4.1.3.4.1", "formula-47", formula("C4.2.47")),
        block("C4.2.4.1.3.4.1", "p7", "paragraph", 113, "e V_bf,Rd è il contributo resistente delle piattabande.", [text("e "), math("V_bf,Rd", "V_{bf,Rd}"), text(" è il contributo resistente delle piattabande.")]),
        block("C4.2.4.1.3.4.1", "p8", "paragraph", 113, "Il contributo resistente delle piattabande può essere espresso da"),
        formulaBlock("C4.2.4.1.3.4.1", "formula-48", formula("C4.2.48")),
        block("C4.2.4.1.3.4.1", "p9", "paragraph", 113, "in cui b_f è la larghezza efficace dell’anima, non maggiore di 15·ε·t_f da ciascun lato dell’irrigiditore, t_f lo spessore della piattabanda di resistenza assiale minima e M_f,red è il momento resistente di progetto ridotto della sezione costituita dalle aree efficaci, A_fi e A_fs rispettivamente, delle sole piattabande inferiore e superiore, che tiene conto dell’eventuale presenza dello sforzo normale di progetto N_Ed,", [text("in cui "), math("b_f", "b_f"), text(" è la larghezza efficace dell’anima, non maggiore di "), math("15·ε·t_f", "15\\,\\varepsilon\\,t_f"), text(" da ciascun lato dell’irrigiditore, "), math("t_f", "t_f"), text(" lo spessore della piattabanda di resistenza assiale minima e "), math("M_f,red", "M_{f,red}"), text(" è il momento resistente di progetto ridotto della sezione costituita dalle aree efficaci, "), math("A_fi", "A_{fi}"), text(" e "), math("A_fs", "A_{fs}"), text(" rispettivamente, delle sole piattabande inferiore e superiore, che tiene conto dell’eventuale presenza dello sforzo normale di progetto "), math("N_Ed", "N_{Ed}"), text(",")]),
        formulaBlock("C4.2.4.1.3.4.1", "formula-49", formula("C4.2.49")),
        block("C4.2.4.1.3.4.1", "p10", "paragraph", 113, "Il coefficiente χ_w (vedi Tabella C4.2.VII) dipende dalla rigidezza del montante d’appoggio: un montante d’appoggio costituito da due coppie di piatti simmetrici rispetto al piano dell’anima, poste a distanza longitudinale e>0,1·h_w, e tali che l’area di ciascuna coppia di piatti sia almeno uguale a 4·h_w·t²/e può essere considerato rigido, negli altri casi il montante d’appoggio deve essere considerato non rigido.", [text("Il coefficiente "), math("χ_w", "\\chi_w"), text(" (vedi Tabella C4.2.VII) dipende dalla rigidezza del montante d’appoggio: un montante d’appoggio costituito da due coppie di piatti simmetrici rispetto al piano dell’anima, poste a distanza longitudinale "), math("e>0,1·h_w", "e>0{,}1\\,h_w"), text(", e tali che l’area di ciascuna coppia di piatti sia almeno uguale a "), math("4·h_w·t²/e", "4\\,h_w\\,t^2/e"), text(" può essere considerato rigido, negli altri casi il montante d’appoggio deve essere considerato non rigido.")]),
        tableBlock("C4.2.4.1.3.4.1", "table-vii", 113, tableVIIId, "Tabella C4.2.VII - Coefficienti χ_w per il calcolo della resistenza all’instabilità a taglio del pannello", reg(70, 600, 455, 160)),
        block("C4.2.4.1.3.4.1", "p11", "paragraph", 114, "Il parametro di snellezza λ_w è dato dalla formula", [text("Il parametro di snellezza "), math("λ_w", "\\lambda_w"), text(" è dato dalla formula")]),
        formulaBlock("C4.2.4.1.3.4.1", "formula-50", formula("C4.2.50")),
        block("C4.2.4.1.3.4.1", "p12", "paragraph", 114, "dove τ_cr = k_τ·σ_E è la tensione tangenziale critica e σ_E è la tensione critica euleriana, che per un piatto di altezza h_w e spessore t è data da", [text("dove "), math("τ_cr = k_τ·σ_E", "\\tau_{cr}=k_\\tau\\,\\sigma_E"), text(" è la tensione tangenziale critica e "), math("σ_E", "\\sigma_E"), text(" è la tensione critica euleriana, che per un piatto di altezza "), math("h_w", "h_w"), text(" e spessore "), math("t", "t"), text(" è data da")]),
        formulaBlock("C4.2.4.1.3.4.1", "formula-sigma-e", formula("C4.2.4.1.3.4.1-sigma-e")),
        block("C4.2.4.1.3.4.1", "p13", "paragraph", 114, "In assenza di irrigiditori longitudinali, il parametro k_τ, coefficiente per l’instabilità a taglio, è dato da", [text("In assenza di irrigiditori longitudinali, il parametro "), math("k_τ", "k_\\tau"), text(", coefficiente per l’instabilità a taglio, è dato da")]),
        formulaBlock("C4.2.4.1.3.4.1", "formula-51", formula("C4.2.51")),
        block("C4.2.4.1.3.4.1", "p14", "paragraph", 114, "dove a è la lunghezza del pannello compreso tra due irrigiditori trasversali rigidi consecutivi. In assenza di irrigidimenti la lunghezza a del pannello si considera coincidente con quella della trave.", [text("dove "), math("a", "a"), text(" è la lunghezza del pannello compreso tra due irrigiditori trasversali rigidi consecutivi. In assenza di irrigidimenti la lunghezza "), math("a", "a"), text(" del pannello si considera coincidente con quella della trave.")]),
        block("C4.2.4.1.3.4.1", "p15", "paragraph", 114, "Un irrigiditore trasversale può essere considerato rigido quando il suo momento d’inerzia I_st soddisfa le relazioni seguenti", [text("Un irrigiditore trasversale può essere considerato rigido quando il suo momento d’inerzia "), math("I_st", "I_{st}"), text(" soddisfa le relazioni seguenti")]),
        formulaBlock("C4.2.4.1.3.4.1", "formula-52", formula("C4.2.52")),
        block("C4.2.4.1.3.4.1", "p16", "paragraph", 114, "Gli irrigiditori trasversali rigidi devono essere verificati per una forza assiale"),
        formulaBlock("C4.2.4.1.3.4.1", "formula-53", formula("C4.2.53")),
        block("C4.2.4.1.3.4.1", "p17", "paragraph", 114, "essendo V_Ed è il taglio di calcolo a distanza 0,5·h_w dal bordo del pannello più sollecitato.", [text("essendo "), math("V_Ed", "V_{Ed}"), text(" è il taglio di calcolo a distanza "), math("0,5·h_w", "0{,}5\\,h_w"), text(" dal bordo del pannello più sollecitato.")]),
        block("C4.2.4.1.3.4.1", "p18", "paragraph", 114, "Nel caso di pannelli dotati di irrigiditori longitudinali:"),
        block("C4.2.4.1.3.4.1", "p19", "paragraph", 114, "se gli irrigiditori longitudinali sono più di due o se il rapporto d’allungamento α=a/h_w≥3 il coefficiente k_τ è dato da", [text("se gli irrigiditori longitudinali sono più di due o se il rapporto d’allungamento "), math("α=a/h_w≥3", "\\alpha=a/h_w\\ge3"), text(" il coefficiente "), math("k_τ", "k_\\tau"), text(" è dato da")]),
        formulaBlock("C4.2.4.1.3.4.1", "formula-54", formula("C4.2.54")),
        block("C4.2.4.1.3.4.1", "p20", "paragraph", 114, "in cui"),
        formulaBlock("C4.2.4.1.3.4.1", "formula-55", formula("C4.2.55")),
        block("C4.2.4.1.3.4.1", "p21", "paragraph", 114, "essendo I_sl la somma dei momenti d’inerzia degli irrigiditori longitudinali rispetto ai singoli assi baricentrici paralleli al piano dell’anima, considerando una larghezza collaborante pari a 15·ε·t da ciascun lato dell’irrigiditore (Figura C4.2.12); se, invece, gli irrigiditori sono uno o due e α=a/h_w<3, il coefficiente k_τ è", [text("essendo "), math("I_sl", "I_{sl}"), text(" la somma dei momenti d’inerzia degli irrigiditori longitudinali rispetto ai singoli assi baricentrici paralleli al piano dell’anima, considerando una larghezza collaborante pari a "), math("15·ε·t", "15\\,\\varepsilon\\,t"), text(" da ciascun lato dell’irrigiditore (Figura C4.2.12); se, invece, gli irrigiditori sono uno o due e "), math("α=a/h_w<3", "\\alpha=a/h_w<3"), text(", il coefficiente "), math("k_τ", "k_\\tau"), text(" è")]),
        formulaBlock("C4.2.4.1.3.4.1", "formula-56", formula("C4.2.56")),
        figureBlock("C4.2.4.1.3.4.1", "figure-12", 114, figureAssetId, "Figura C4.2.12 - Irrigidimenti longitudinali dei pannelli d’anima", figureRegion),
    ], formulaRows.map((row) => row.number), ["C4.2.VII"], [figureNumber]),
];

const figureSource = "page-0114-x190-y628-w220-h112@3x.png";
const manifest = {
    $schema: "urn:structural-codes:schema:asset-manifest:v2",
    schemaVersion: "2.0.0-alpha.1",
    recordType: "asset-manifest",
    document: "circ2019",
    section: "C4.2-step2c",
    sourceId,
    status: "transcribed-unreviewed",
    formulas: formulaRows.map((row) => ({ id: formulaId(row.number), unitId: uid(row.unit), officialNumber: row.officialNumber, pdfPage: row.page, latex: row.latex })),
    tables: [tableVII],
    figures: [{
        id: figureAssetId,
        unitId: uid("C4.2.4.1.3.4.1"),
        officialNumber: figureNumber,
        pdfPage: 114,
        caption: "Figura C4.2.12 - Irrigidimenti longitudinali dei pannelli d’anima",
        alt: "Irrigidimenti longitudinali dei pannelli d’anima con le larghezze collaboranti 15εt",
        imagePath: "figures/circ2019/figc4.2.12.png",
        region: figureRegion,
        sha256: "712d97bbe856575fe05436efffec53f9396bce39ab5ed96409b8261a625ca647",
    }],
};

await mkdir(unitDirectory, { recursive: true });
await mkdir(assetDirectory, { recursive: true });
await mkdir(figureDirectory, { recursive: true });
await copyFile(join(evidenceRenderDirectory, figureSource), join(figureDirectory, "figc4.2.12.png"));
await Promise.all([
    ...units.map((unit) => writeFile(join(unitDirectory, `${unit.numbering.official.toLowerCase()}.json`), `${JSON.stringify(unit, null, 2)}\n`, "utf8")),
    writeFile(join(assetDirectory, "C4.2-step2c.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8"),
]);
console.log(`Circolare C4.2 step2c: generate ${units.length} unità, ${formulaRows.length} formule, 1 tabella e 1 figura.`);
