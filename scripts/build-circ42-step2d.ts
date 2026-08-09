import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { sha256OfText } from "../src/lib/hash.ts";

const root = fileURLToPath(new URL("../", import.meta.url));
const unitDirectory = join(root, "corpus", "units", "circ2019");
const assetDirectory = join(root, "corpus", "assets", "circ2019");
const sourceId = "circ-7-2019";
const workId = "it-mit:circ:2019-01-21:7-csllpp";
const expressionId = "it-mit:circ:2019-01-21:7-csllpp:original-it";
const profile = "circ42-editorial-profile-0.1.0";
const createdAt = "2026-08-09T00:00:00Z";

type Region = { coordinateSystem: "pdf-points-top-left"; x: number; y: number; width: number; height: number };
type Inline = { kind: "text" | "math"; value: string; latex?: string };
type TextKind = "heading" | "paragraph";
type FormulaRow = { number: string; unit: string; page: number; latex: string; raw: string; region: Region };
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

function parent(number: string) {
    const parts = number.split(".");
    return parts.length === 1 ? null : uid(parts.slice(0, -1).join("."));
}

function ancestors(number: string) {
    const parts = number.split(".");
    return parts.slice(1).map((_, index) => uid(parts.slice(0, index + 1).join(".")));
}

function makeUnit(number: string, title: string, blocks: GeneratedBlock[], formulas: string[] = [], tables: string[] = []) {
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
        assets: { formulaIds: formulas.map(formulaId), tableIds: tables.map(tableId), figureIds: [] },
        workflow: {
            status: "extracted",
            createdBy: { actorId: "codex:circ42-step2d", kind: "automated-agent", toolVersion: profile },
            createdAt,
            reviews: [],
            openIssues: [
                { issueId: `circ2019-${number.replaceAll(".", "-")}-source-review`, type: "normalization-review", severity: "blocking", note: "Record trascritto dall’evidence ufficiale ma non ancora confrontato integralmente da un revisore umano con il render della fonte." },
                ...(tables.length ? [{ issueId: `circ2019-${number.replaceAll(".", "-")}-assets`, type: "asset-review", severity: "blocking", note: "Tabelle strutturate dalla fonte; resta obbligatoria la revisione umana indipendente delle celle, dei diagrammi e delle formule." }] : []),
            ],
        },
    };
}

const formulaRows: FormulaRow[] = [
    { number: "C4.2.57", unit: "C4.2.4.1.3.4.2", page: 115, latex: "\\begin{aligned}\\rho&=1{,}0 &&\\text{se }\\lambda_p\\le0{,}673\\\\\\rho&=\\frac{\\lambda_p-0{,}055(3+\\psi)}{\\lambda_p^2}\\ge\\frac{1}{\\lambda_p} &&\\text{se }\\lambda_p>0{,}673\\end{aligned}", raw: "ρ = 1,0 se λ_p ≤ 0,673; ρ = [λ_p − 0,055(3 + ψ)]/λ_p² ≥ 1/λ_p se λ_p > 0,673 [C4.2.57]", region: reg(125, 150, 360, 90) },
    { number: "C4.2.58", unit: "C4.2.4.1.3.4.2", page: 115, latex: "\\begin{aligned}\\rho&=1{,}0 &&\\text{se }\\lambda_p\\le0{,}748\\\\\\rho&=\\frac{\\lambda_p-0{,}188}{\\lambda_p^2}\\le1{,}0 &&\\text{se }\\lambda_p>0{,}748\\end{aligned}", raw: "ρ = 1,0 se λ_p ≤ 0,748; ρ = (λ_p − 0,188)/λ_p² ≤ 1,0 se λ_p > 0,748 [C4.2.58]", region: reg(125, 255, 360, 85) },
    { number: "C4.2.59", unit: "C4.2.4.1.3.4.2", page: 115, latex: "\\lambda_p=\\sqrt{\\frac{f_y}{\\sigma_{cr}}}=\\frac{\\bar{b}}{28{,}4\\,t\\,\\varepsilon\\sqrt{k_\\sigma}}", raw: "λ_p = √(f_y/σ_cr) = b̄/(28,4 · t · ε · √k_σ) [C4.2.59]", region: reg(125, 355, 360, 75) },
    { number: "C4.2.60", unit: "C4.2.4.1.3.4.2", page: 116, latex: "\\frac{N_{Ed}}{\\dfrac{f_yA_{eff}}{\\gamma_{M0}}}+\\frac{M_{Ed}+(N_{Ed}\\,e_N)}{\\dfrac{f_yW_{eff}}{\\gamma_{M0}}}\\le1{,}0", raw: "N_Ed/(f_y A_eff/γ_M0) + [M_Ed + (N_Ed · e_N)]/(f_y W_eff/γ_M0) ≤ 1,0 [C4.2.60]", region: reg(125, 570, 350, 75) },
    { number: "C4.2.61", unit: "C4.2.4.1.3.4.2", page: 116, latex: "\\frac{N_{Ed}}{\\dfrac{f_yA_{eff}}{\\gamma_{M0}}}+\\frac{M_{y,Ed}+(N_{Ed}\\,e_{y,N})}{\\dfrac{f_yW_{y,eff}}{\\gamma_{M0}}}+\\frac{M_{z,Ed}+(N_{Ed}\\,e_{z,N})}{\\dfrac{f_yW_{z,eff}}{\\gamma_{M0}}}\\le1{,}0", raw: "N_Ed/(f_y A_eff/γ_M0) + [M_y,Ed + (N_Ed · e_y,N)]/(f_y W_y,eff/γ_M0) + [M_z,Ed + (N_Ed · e_z,N)]/(f_y W_z,eff/γ_M0) ≤ 1,0 [C4.2.61]", region: reg(105, 650, 400, 100) },
];

const formulaByNumber = new Map(formulaRows.map((row) => [row.number, row]));
const formula = (number: string) => formulaByNumber.get(number)!;
const c = (value: string, latex?: string, spans: { colSpan?: number; rowSpan?: number } = {}) => ({ text: value, ...(latex ? { latex } : {}), ...spans });
const f = (value: string, latex: string, spans: { colSpan?: number; rowSpan?: number } = {}) => c(value, latex, spans);

const tableVIIIId = tableId("C4.2.VIII");
const tableVIII = {
    id: tableVIIIId,
    unitId: uid("C4.2.4.1.3.4.2"),
    officialNumber: "C4.2.VIII",
    pdfPage: 115,
    caption: "Larghezza efficace di pannelli compressi con entrambi i bordi longitudinali irrigiditi",
    columnCount: 7,
    headers: [[c("Distribuzione delle tensioni", undefined, { colSpan: 3 }), c("Larghezza efficace del pannello", undefined, { colSpan: 4 })]],
    rows: [
        [f("Diagramma: σ₁ = σ₂; pannello uniformemente compresso, con b̄, b_e1 e b_e2", "\\text{Diagramma: }\\sigma_1=\\sigma_2;\\quad\\bar b,\\ b_{e1},\\ b_{e2}", { colSpan: 3 }), f("ψ = σ₂/σ₁ = 1; b_eff = ρ·b̄; b_e1 = 0,5·b_eff; b_e2 = 0,5·b_eff", "\\begin{gathered}\\psi=\\frac{\\sigma_2}{\\sigma_1}=1\\\\b_{\\mathrm{eff}}=\\rho\\,\\bar b\\\\b_{e1}=0{,}5\\,b_{\\mathrm{eff}}\\quad b_{e2}=0{,}5\\,b_{\\mathrm{eff}}\\end{gathered}", { colSpan: 4 })],
        [f("Diagramma: distribuzione lineare decrescente da σ₁ a σ₂, con 1 > ψ = σ₂/σ₁ > 0", "\\text{Diagramma: distribuzione lineare; }1>\\psi=\\frac{\\sigma_2}{\\sigma_1}>0", { colSpan: 3 }), f("b_eff = ρ·b̄; b_e1 = 2/(5−ψ)·b_eff; b_e2 = b_eff − b_e1", "\\begin{gathered}b_{\\mathrm{eff}}=\\rho\\,\\bar b\\\\b_{e1}=\\frac{2}{5-\\psi}b_{\\mathrm{eff}}\\quad b_{e2}=b_{\\mathrm{eff}}-b_{e1}\\end{gathered}", { colSpan: 4 })],
        [f("Diagramma: distribuzione lineare da σ₁ compressiva a σ₂ con ψ < 0; b_c e b_t", "\\text{Diagramma: }\\sigma_1\\text{ compressiva, }\\sigma_2\\text{ con }\\psi<0;\\quad b_c,b_t", { colSpan: 3 }), f("ψ = σ₂/σ₁ < 0; b_eff = ρ·b̄/(1−ψ); b_e1 = 0,4·b_eff; b_e2 = 0,6·b_eff", "\\begin{gathered}\\psi=\\frac{\\sigma_2}{\\sigma_1}<0\\\\b_{\\mathrm{eff}}=\\rho\\,\\frac{\\bar b}{1-\\psi}\\\\b_{e1}=0{,}4\\,b_{\\mathrm{eff}}\\quad b_{e2}=0{,}6\\,b_{\\mathrm{eff}}\\end{gathered}", { colSpan: 4 })],
        [f("ψ = σ₂/σ₁", "\\psi=\\sigma_2/\\sigma_1"), f("1,00", "1{,}00"), f("1 > ψ > 0", "1>\\psi>0"), f("0", "0"), f("0 > ψ > −1", "0>\\psi>-1"), f("−1", "-1"), f("−1 > ψ > −3", "-1>\\psi>-3")],
        [f("fattore k_σ", "\\text{fattore }k_\\sigma"), f("4,00", "4{,}00"), f("8,2/(1,05 + ψ)", "\\frac{8{,}2}{1{,}05+\\psi}"), f("7,81", "7{,}81"), f("7,81 − 6,29ψ + 9,78ψ²", "7{,}81-6{,}29\\psi+9{,}78\\psi^2"), f("23,9", "23{,}9"), f("5,98(1 − ψ)²", "5{,}98(1-\\psi)^2")],
    ],
    notes: ["I diagrammi delle distribuzioni delle tensioni sono rappresentati come descrizioni strutturate delle figure interne alla tabella."]
};

const tableIXId = tableId("C4.2.IX");
const tableIX = {
    id: tableIXId,
    unitId: uid("C4.2.4.1.3.4.2"),
    officialNumber: "C4.2.IX",
    pdfPage: 116,
    caption: "Larghezza efficace di pannelli compressi con un solo bordo longitudinale irrigidito",
    columnCount: 6,
    headers: [
        [c("Distribuzione delle tensioni", undefined, { colSpan: 3 }), c("Larghezza efficace del pannello", undefined, { colSpan: 3 })],
    ],
    rows: [
        [f("Diagramma: bordo longitudinale irrigidito a sinistra; σ₁, σ₂, c e b_eff", "\\text{Diagramma: bordo irrigidito a sinistra; }\\sigma_1,\\sigma_2,c,b_{\\mathrm{eff}}", { colSpan: 3 }), f("1 > ψ = σ₂/σ₁ ≥ 0; b_eff = ρ·c", "\\begin{gathered}1>\\psi=\\frac{\\sigma_2}{\\sigma_1}\\ge0\\\\b_{\\mathrm{eff}}=\\rho\\,c\\end{gathered}", { colSpan: 3 })],
        [f("Diagramma: bordo longitudinale irrigidito a sinistra; distribuzione con ψ < 0, b_c e b_t", "\\text{Diagramma: bordo irrigidito a sinistra; }\\psi<0,\\quad b_c,b_t", { colSpan: 3 }), f("ψ = σ₂/σ₁ < 0; b_eff = ρ·b_c = ρ·c/(1−ψ)", "\\begin{gathered}\\psi=\\frac{\\sigma_2}{\\sigma_1}<0\\\\b_{\\mathrm{eff}}=\\rho\\,b_c=\\rho\\,\\frac{c}{1-\\psi}\\end{gathered}", { colSpan: 3 })],
        [f("ψ = σ₂/σ₁", "\\psi=\\sigma_2/\\sigma_1"), f("1,00", "1{,}00"), f("1 > ψ > 0", "1>\\psi>0"), f("0", "0"), f("0 > ψ > −1", "0>\\psi>-1"), f("−1", "-1")],
        [f("fattore k_σ", "\\text{fattore }k_\\sigma"), f("0,43", "0{,}43"), f("0,578/(0,34 + ψ)", "\\frac{0{,}578}{0{,}34+\\psi}"), f("1,70", "1{,}70"), f("1,7 − 5ψ + 17,1ψ²", "1{,}7-5\\psi+17{,}1\\psi^2"), f("23,8", "23{,}8")],
        [c("Distribuzione delle tensioni", undefined, { colSpan: 3 }), c("Larghezza efficace del pannello", undefined, { colSpan: 3 })],
        [f("Diagramma: bordo longitudinale irrigidito a destra; σ₁, σ₂, c e b_eff", "\\text{Diagramma: bordo irrigidito a destra; }\\sigma_1,\\sigma_2,c,b_{\\mathrm{eff}}", { colSpan: 3 }), f("1 > ψ = σ₂/σ₁ ≥ 0; b_eff = ρ·c", "\\begin{gathered}1>\\psi=\\frac{\\sigma_2}{\\sigma_1}\\ge0\\\\b_{\\mathrm{eff}}=\\rho\\,c\\end{gathered}", { colSpan: 3 })],
        [f("Diagramma: bordo longitudinale irrigidito a destra; distribuzione con ψ < 0, b_c e b_t", "\\text{Diagramma: bordo irrigidito a destra; }\\psi<0,\\quad b_c,b_t", { colSpan: 3 }), f("ψ = σ₂/σ₁ < 0; b_eff = ρ·b_c = ρ·c/(1−ψ)", "\\begin{gathered}\\psi=\\frac{\\sigma_2}{\\sigma_1}<0\\\\b_{\\mathrm{eff}}=\\rho\\,b_c=\\rho\\,\\frac{c}{1-\\psi}\\end{gathered}", { colSpan: 3 })],
        [f("ψ = σ₂/σ₁", "\\psi=\\sigma_2/\\sigma_1"), f("1 ≥ ψ ≥ −3", "1\\ge\\psi\\ge-3", { colSpan: 5 })],
        [f("fattore k_σ", "\\text{fattore }k_\\sigma"), f("0,57 − 0,21ψ + 0,07ψ²", "0{,}57-0{,}21\\psi+0{,}07\\psi^2", { colSpan: 5 })],
    ],
    notes: ["I diagrammi delle distribuzioni delle tensioni sono rappresentati come descrizioni strutturate delle figure interne alla tabella."]
};

const units = [
    makeUnit("C4.2.4.1.3.4.2", "Stabilità dei pannelli soggetti a compressione", [
        block("C4.2.4.1.3.4.2", "heading", "heading", 115, "C4.2.4.1.3.4.2. Stabilità dei pannelli soggetti a compressione"),
        block("C4.2.4.1.3.4.2", "p1", "paragraph", 115, "La verifica di stabilità dei pannelli compressi non irrigiditi si conduce considerando la sezione efficace del pannello."),
        block("C4.2.4.1.3.4.2", "p2", "paragraph", 115, "L’area della sezione efficace è definita come A_c,eff = ρ · A_c, dove ρ è il coefficiente di riduzione che tiene conto dell’instabilità della lastra e A_c è l’area lorda della sezione del pannello.", [text("L’area della sezione efficace è definita come "), math("A_c,eff = ρ · A_c", "A_{c,\\mathrm{eff}}=\\rho\\,A_c"), text(", dove "), math("ρ", "\\rho"), text(" è il coefficiente di riduzione che tiene conto dell’instabilità della lastra e "), math("A_c", "A_c"), text(" è l’area lorda della sezione del pannello.")]),
        block("C4.2.4.1.3.4.2", "p3", "paragraph", 115, "Nel caso dei pannelli irrigiditi su entrambi i lati longitudinali il coefficiente ρ è dato da", [text("Nel caso dei pannelli irrigiditi su entrambi i lati longitudinali il coefficiente "), math("ρ", "\\rho"), text(" è dato da")]),
        formulaBlock("C4.2.4.1.3.4.2", "formula-57", formula("C4.2.57")),
        block("C4.2.4.1.3.4.2", "p4", "paragraph", 115, "dove ψ = σ_2/σ_1 è il rapporto tra le tensioni ai bordi del pannello, essendo σ_1 la tensione di compressione massima in valore assoluto.", [text("dove "), math("ψ = σ_2/σ_1", "\\psi=\\sigma_2/\\sigma_1"), text(" è il rapporto tra le tensioni ai bordi del pannello, essendo "), math("σ_1", "\\sigma_1"), text(" la tensione di compressione massima in valore assoluto.")]),
        block("C4.2.4.1.3.4.2", "p5", "paragraph", 115, "Nel caso dei pannelli irrigiditi su un solo lato longitudinale ρ è dato da", [text("Nel caso dei pannelli irrigiditi su un solo lato longitudinale "), math("ρ", "\\rho"), text(" è dato da")]),
        formulaBlock("C4.2.4.1.3.4.2", "formula-58", formula("C4.2.58")),
        block("C4.2.4.1.3.4.2", "p6", "paragraph", 115, "Nelle espressioni [C4.2.57] e [C4.2.58], la snellezza relativa del pannello λ_p è", [text("Nelle espressioni [C4.2.57] e [C4.2.58], la snellezza relativa del pannello "), math("λ_p", "\\lambda_p"), text(" è")]),
        formulaBlock("C4.2.4.1.3.4.2", "formula-59", formula("C4.2.59")),
        block("C4.2.4.1.3.4.2", "p7", "paragraph", 115, "dove il coefficiente per l’instabilità per compressione k_σ, dipendente da ψ e dalle condizioni di vincolo, è dato nella Tabella C4.2.VIII per i pannelli con entrambi i bordi longitudinali irrigiditi e nella Tabella C4.2.IX per i pannelli con un solo bordo longitudinale irrigidito, e b̄ è la larghezza del pannello. b̄ è uguale a h_w per i pannelli d’anima, è uguale alla larghezza b della piattabanda per le piattabande interne, è uguale a b−3t_f per le piattabande delle sezioni rettangolari cave di spessore t_f ed è uguale alla lunghezza c dello sbalzo per le piattabande o le ali irrigidite da un sol lato.", [text("dove il coefficiente per l’instabilità per compressione "), math("k_σ", "k_\\sigma"), text(", dipendente da "), math("ψ", "\\psi"), text(" e dalle condizioni di vincolo, è dato nella Tabella C4.2.VIII per i pannelli con entrambi i bordi longitudinali irrigiditi e nella Tabella C4.2.IX per i pannelli con un solo bordo longitudinale irrigidito, e "), math("b̄", "\\bar b"), text(" è la larghezza del pannello. "), math("b̄", "\\bar b"), text(" è uguale a "), math("h_w", "h_w"), text(" per i pannelli d’anima, è uguale alla larghezza "), math("b", "b"), text(" della piattabanda per le piattabande interne, è uguale a "), math("b−3t_f", "b-3t_f"), text(" per le piattabande delle sezioni rettangolari cave di spessore "), math("t_f", "t_f"), text(" ed è uguale alla lunghezza "), math("c", "c"), text(" dello sbalzo per le piattabande o le ali irrigidite da un sol lato.")]),
        tableBlock("C4.2.4.1.3.4.2", "table-viii", 115, tableVIIIId, "Tabella C4.2.VIII - Larghezza efficace di pannelli compressi con entrambi i bordi longitudinali irrigiditi", reg(70, 500, 455, 285)),
        tableBlock("C4.2.4.1.3.4.2", "table-ix", 116, tableIXId, "Tabella C4.2.IX - Larghezza efficace di pannelli compressi con un solo bordo longitudinale irrigidito", reg(70, 55, 455, 455)),
        block("C4.2.4.1.3.4.2", "p8", "paragraph", 116, "La definizione dei coefficienti k_σ e ψ si basa sul valore delle tensioni estreme σ_1 e σ_2, per cui, essendo il valore di tali tensioni dipendente dalla sezione efficace considerata, il calcolo di ψ e la determinazione della geometria della sezione efficace necessitano di una procedura iterativa, in cui si considera una geometria inizialmente coincidente con la sezione lorda del pannello.", [text("La definizione dei coefficienti "), math("k_σ", "k_\\sigma"), text(" e "), math("ψ", "\\psi"), text(" si basa sul valore delle tensioni estreme "), math("σ_1", "\\sigma_1"), text(" e "), math("σ_2", "\\sigma_2"), text(", per cui, essendo il valore di tali tensioni dipendente dalla sezione efficace considerata, il calcolo di "), math("ψ", "\\psi"), text(" e la determinazione della geometria della sezione efficace necessitano di una procedura iterativa, in cui si considera una geometria inizialmente coincidente con la sezione lorda del pannello.")]),
        block("C4.2.4.1.3.4.2", "p9", "paragraph", 116, "La sezione efficace del pannello è definita da area, A_eff, modulo resistente, W_eff, e momento di inerzia, J_eff, che tengono conto anche degli effetti da trascinamento da taglio. Poiché la caratteristiche della sollecitazione sono calcolate, in genere, rispetto alle linee d’asse baricentriche dei profili, in fase di verifica il baricentro della sezione efficace potrebbe risultare non più coincidente con il baricentro della sezione lorda, determinando un’eccentricità addizionale e_N, che deve essere considerata nel calcolo, aggiungendo al momento flettente di calcolo M_Ed il momento flettente addizionale N_Ed·e_N.prodotto dalla sollecitazione assiale di calcolo N_Ed.", [text("La sezione efficace del pannello è definita da area, "), math("A_eff", "A_{eff}"), text(", modulo resistente, "), math("W_eff", "W_{eff}"), text(", e momento di inerzia, "), math("J_eff", "J_{eff}"), text(", che tengono conto anche degli effetti da trascinamento da taglio. Poiché la caratteristiche della sollecitazione sono calcolate, in genere, rispetto alle linee d’asse baricentriche dei profili, in fase di verifica il baricentro della sezione efficace potrebbe risultare non più coincidente con il baricentro della sezione lorda, determinando un’eccentricità addizionale "), math("e_N", "e_N"), text(", che deve essere considerata nel calcolo, aggiungendo al momento flettente di calcolo "), math("M_Ed", "M_{Ed}"), text(" il momento flettente addizionale "), math("N_Ed·e_N", "N_{Ed}\\,e_N"), text(".prodotto dalla sollecitazione assiale di calcolo "), math("N_Ed", "N_{Ed}"), text(".")]),
        block("C4.2.4.1.3.4.2", "p10", "paragraph", 116, "In tal modo la verifica nei riguardi della stabilità è condotta utilizzando la formula"),
        formulaBlock("C4.2.4.1.3.4.2", "formula-60", formula("C4.2.60")),
        block("C4.2.4.1.3.4.2", "p11", "paragraph", 116, "Nel caso in cui l’elemento sia soggetto a compressione e a flessione biassiale, l’equazione di verifica dei pannelli è"),
        formulaBlock("C4.2.4.1.3.4.2", "formula-61", formula("C4.2.61")),
        block("C4.2.4.1.3.4.2", "p12", "paragraph", 116, "dove M_y,Ed ed M_z,Ed sono i momenti flettenti di calcolo rispetto agli assi y e z della sezione, mentre e_y,N ed e_z,N sono le eccentricità degli assi neutri e W_y,eff, W_z,eff ed A_eff sono i moduli resistenti e l’area della sezione efficace.", [text("dove "), math("M_y,Ed", "M_{y,Ed}"), text(" ed "), math("M_z,Ed", "M_{z,Ed}"), text(" sono i momenti flettenti di calcolo rispetto agli assi "), math("y", "y"), text(" e "), math("z", "z"), text(" della sezione, mentre "), math("e_y,N", "e_{y,N}"), text(" ed "), math("e_z,N", "e_{z,N}"), text(" sono le eccentricità degli assi neutri e "), math("W_y,eff", "W_{y,eff}"), text(", "), math("W_z,eff", "W_{z,eff}"), text(" ed "), math("A_eff", "A_{eff}"), text(" sono i moduli resistenti e l’area della sezione efficace.")]),
        block("C4.2.4.1.3.4.2", "p13", "paragraph", 116, "In alternativa a quanto detto sopra e in via semplificata, l’area efficace A_eff si può determinare considerando la sezione soggetta a compressione semplice e il modulo resistente efficace W_eff si può determinare considerando la sezione soggetta a flessione pura.", [text("In alternativa a quanto detto sopra e in via semplificata, l’area efficace "), math("A_eff", "A_{eff}"), text(" si può determinare considerando la sezione soggetta a compressione semplice e il modulo resistente efficace "), math("W_eff", "W_{eff}"), text(" si può determinare considerando la sezione soggetta a flessione pura.")]),
        block("C4.2.4.1.3.4.2", "p14", "paragraph", 116, "Nel calcolo si deve tener conto anche degli effetti dovuti al trascinamento da taglio, considerando una larghezza collaborante determinata in accordo con il § C4.2.4.1.3.4.3."),
    ], formulaRows.map((row) => row.number), ["C4.2.VIII", "C4.2.IX"]),
];

const manifest = {
    $schema: "urn:structural-codes:schema:asset-manifest:v2",
    schemaVersion: "2.0.0-alpha.1",
    recordType: "asset-manifest",
    document: "circ2019",
    section: "C4.2-step2d",
    sourceId,
    status: "transcribed-unreviewed",
    formulas: formulaRows.map((row) => ({ id: formulaId(row.number), unitId: uid(row.unit), officialNumber: row.number, pdfPage: row.page, latex: row.latex })),
    tables: [tableVIII, tableIX],
    figures: [],
};

await mkdir(unitDirectory, { recursive: true });
await mkdir(assetDirectory, { recursive: true });
await Promise.all([
    ...units.map((unit) => writeFile(join(unitDirectory, `${unit.numbering.official.toLowerCase()}.json`), `${JSON.stringify(unit, null, 2)}\n`, "utf8")),
    writeFile(join(assetDirectory, "C4.2-step2d.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8"),
]);
console.log(`Circolare C4.2 step2d: generate ${units.length} unità, ${formulaRows.length} formule e 2 tabelle.`);
