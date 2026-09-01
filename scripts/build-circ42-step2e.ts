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
            createdBy: { actorId: "codex:circ42-step2e", kind: "automated-agent", toolVersion: profile },
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
    { number: "C4.2.62", unit: "C4.2.4.1.3.4.3", page: 117, latex: "b_{\\mathrm{eff}}=\\beta\\cdot b_0", raw: "b_eff = β · b_0 [C4.2.62]", region: reg(145, 165, 310, 60) },
    { number: "C4.2.63", unit: "C4.2.4.1.3.4.3", page: 117, latex: "\\alpha_0=\\sqrt{1+\\frac{A_{sl}}{b_0t}}", raw: "α_0 = √(1 + A_sl/(b_0 t)) [C4.2.63]", region: reg(145, 405, 310, 75) },
    { number: "C4.2.64", unit: "C4.2.4.1.3.4.3", page: 118, latex: "\\begin{aligned}&\\text{(a)}\\quad\\beta>0{,}20\\quad\\begin{cases}\\sigma_2=1{,}25(\\beta-0{,}20)\\,\\sigma_1\\\\\\sigma(y)=\\sigma_2+(\\sigma_1-\\sigma_2)\\left(1-\\frac{y}{b_0}\\right)^4\\end{cases}\\ ;\\quad\\text{(b)}\\quad\\beta\\le0{,}20\\quad\\begin{cases}\\sigma_2=0\\\\\\sigma(y)=\\sigma_1\\left(1-\\frac{y}{b_1}\\right)^4\\end{cases}\\end{aligned}", raw: "(a) β > 0,20: σ_2 = 1,25(β − 0,20)σ_1; σ(y) = σ_2 + (σ_1 − σ_2)[1 − y/b_0]^4; (b) β ≤ 0,20: σ_2 = 0; σ(y) = σ_1[1 − y/b_1]^4 [C4.2.64]", region: reg(85, 225, 425, 105) },
    { number: "C4.2.65", unit: "C4.2.4.1.3.4.3", page: 118, latex: "A_{\\mathrm{eff}}=\\beta^\\kappa\\cdot A_{c,\\mathrm{eff}}\\ge\\beta\\cdot A_{c,\\mathrm{eff}}", raw: "A_eff = β^κ · A_c,eff ≥ β · A_c,eff [C4.2.65]", region: reg(145, 345, 310, 60) },
];

const formulaByNumber = new Map(formulaRows.map((row) => [row.number, row]));
const formula = (number: string) => formulaByNumber.get(number)!;
const c = (value: string, latex?: string, spans: { colSpan?: number; rowSpan?: number } = {}) => ({ text: value, ...(latex ? { latex } : {}), ...spans });
const f = (value: string, latex: string, spans: { colSpan?: number; rowSpan?: number } = {}) => c(value, latex, spans);

const tableXId = tableId("C4.2.X");
const tableX = {
    id: tableXId,
    unitId: uid("C4.2.4.1.3.4.3"),
    officialNumber: "C4.2.X",
    pdfPage: 117,
    caption: "Fattori riduttivi β per la larghezza collaborante",
    columnCount: 3,
    headers: [[f("κ = α_0·b_0/L_e", "\\kappa=\\frac{\\alpha_0\\,b_0}{L_e}"), c("Sezioni da verificare"), c("Valori di β")]],
    rows: [
        [f("κ ≤ 0,02", "\\kappa\\le0{,}02"), c(""), f("β = 1,0", "\\beta=1{,}0")],
        [f("0,02 < κ ≤ 0,70", "0{,}02<\\kappa\\le0{,}70", { rowSpan: 2 }), c("Zone a momento positivo"), f("β = β_1 = 1/(1 + 6,4·κ²)", "\\beta=\\beta_1=\\frac{1}{1+6{,}4\\,\\kappa^2}")],
        [c("Zone a momento negativo"), f("β = β_2 = 1/[1 + 6,0(κ − 1/(2500·κ)) + 1,6·κ²]", "\\beta=\\beta_2=\\frac{1}{1+6{,}0\\left(\\kappa-\\frac{1}{2500\\,\\kappa}\\right)+1{,}6\\,\\kappa^2}")],
        [f("κ > 0,70", "\\kappa>0{,}70", { rowSpan: 2 }), c("Zone a momento positivo"), f("β = β_1 = 1/(5,9·κ)", "\\beta=\\beta_1=\\frac{1}{5{,}9\\,\\kappa}")],
        [c("Zone a momento negativo"), f("β = β_1 = 1/(8,6·κ)", "\\beta=\\beta_1=\\frac{1}{8{,}6\\,\\kappa}")],
        [f("κ qualsiasi", "\\kappa\\text{ qualsiasi}"), c("Appoggi di estremità"), f("β = (0,55 + 0,025/κ)β_1 ≤ β_1", "\\beta=\\left(0{,}55+\\frac{0{,}025}{\\kappa}\\right)\\beta_1\\le\\beta_1")],
        [f("κ qualsiasi", "\\kappa\\text{ qualsiasi}"), c("Sbalzi"), f("β = β_2 sugli appoggi, β_0 = 1,0 all’estremità", "\\beta=\\beta_2\\text{ sugli appoggi, }\\beta_0=1{,}0\\text{ all’estremità}")],
    ],
    notes: [],
};

const figure13 = figureId("C4.2.13");
const figure14 = figureId("C4.2.14");
const figure13Region = reg(95, 490, 400, 240);
const figure14Region = reg(105, 75, 390, 175);

const units = [
    makeUnit("C4.2.4.1.3.4.3", "Larghezza collaborante", [
        block("C4.2.4.1.3.4.3", "heading", "heading", 117, "C4.2.4.1.3.4.3. Larghezza collaborante"),
        block("C4.2.4.1.3.4.3", "p1", "paragraph", 117, "Gli effetti di trascinamento da taglio possono essere trascurati se risulta b_0<0,02·L_e, dove b_0=0,5·b per le piattabande interne, essendo b l’interasse delle anime, e b_0=c per le parti a sbalzo, essendo c la luce dello sbalzo, mentre L_e, luce equivalente, è la distanza tra due punti di nullo consecutivi del diagramma dei momenti.", [text("Gli effetti di trascinamento da taglio possono essere trascurati se risulta "), math("b_0<0,02·L_e", "b_0<0{,}02\\cdot L_e"), text(", dove "), math("b_0=0,5·b", "b_0=0{,}5\\cdot b"), text(" per le piattabande interne, essendo "), math("b", "b"), text(" l’interasse delle anime, e "), math("b_0=c", "b_0=c"), text(" per le parti a sbalzo, essendo "), math("c", "c"), text(" la luce dello sbalzo, mentre "), math("L_e", "L_e"), text(", luce equivalente, è la distanza tra due punti di nullo consecutivi del diagramma dei momenti.")]),
        block("C4.2.4.1.3.4.3", "p2", "paragraph", 117, "Quando il trascinamento da taglio avviene in campo elastico la larghezza collaborante può essere valutata come"),
        formulaBlock("C4.2.4.1.3.4.3", "formula-62", formula("C4.2.62")),
        block("C4.2.4.1.3.4.3", "p3", "paragraph", 117, "essendo β il fattore riduttivo dato nella Tabella C4.2.X in funzione di κ=α_0·b_0/L_e.", [text("essendo "), math("β", "\\beta"), text(" il fattore riduttivo dato nella Tabella C4.2.X in funzione di "), math("κ=α_0·b_0/L_e", "\\kappa=\\alpha_0\\cdot b_0/L_e"), text(".")]),
        tableBlock("C4.2.4.1.3.4.3", "table-x", 117, tableXId, "Tabella C4.2.X - Fattori riduttivi β per la larghezza collaborante", reg(70, 195, 455, 235)),
        block("C4.2.4.1.3.4.3", "p4", "paragraph", 117, "Detta A_sl l’area di tutti gli irrigiditori longitudinali compresi nella larghezza b_0, il coefficiente α_0 è", [text("Detta "), math("A_sl", "A_{sl}"), text(" l’area di tutti gli irrigiditori longitudinali compresi nella larghezza "), math("b_0", "b_0"), text(", il coefficiente "), math("α_0", "\\alpha_0"), text(" è")]),
        formulaBlock("C4.2.4.1.3.4.3", "formula-63", formula("C4.2.63")),
        block("C4.2.4.1.3.4.3", "p5", "paragraph", 117, "Nel caso di travi continue in cui le luci di due campate adiacenti non differiscono di più del 50% e gli eventuali sbalzi hanno luce non superiore al 50% della campata adiacente, le luci equivalenti L_e ed i coefficienti β possono essere calcolati come indicato in Figura C4.2.13.", [text("Nel caso di travi continue in cui le luci di due campate adiacenti non differiscono di più del 50% e gli eventuali sbalzi hanno luce non superiore al 50% della campata adiacente, le luci equivalenti "), math("L_e", "L_e"), text(" ed i coefficienti "), math("β", "\\beta"), text(" possono essere calcolati come indicato in Figura C4.2.13.")]),
        figureBlock("C4.2.4.1.3.4.3", "figure-13", 117, figure13, "Figura C4.2.13 – Luci equivalenti L_e e coefficienti riduttivi β per travi continue", figure13Region),
        figureBlock("C4.2.4.1.3.4.3", "figure-14", 118, figure14, "Figura C4.2.14 – Distribuzione delle tensioni normali dovute al trascinamento da taglio", figure14Region),
        block("C4.2.4.1.3.4.3", "p6", "paragraph", 118, "La distribuzione delle tensioni normali nella piattabanda, considerando l’effetto del trascinamento da taglio, è riportata in Figura C4.2.14., con l’andamento delle tensioni nei due casi (a) e (b) descritto rispettivamente da"),
        formulaBlock("C4.2.4.1.3.4.3", "formula-64", formula("C4.2.64")),
        block("C4.2.4.1.3.4.3", "p7", "paragraph", 118, "Allo stato limite ultimo, gli effetti di trascinamento da taglio delle piattabande compresse possono essere determinati considerando un’area efficace A_eff data da", [text("Allo stato limite ultimo, gli effetti di trascinamento da taglio delle piattabande compresse possono essere determinati considerando un’area efficace "), math("A_eff", "A_{eff}"), text(" data da")]),
        formulaBlock("C4.2.4.1.3.4.3", "formula-65", formula("C4.2.65")),
        block("C4.2.4.1.3.4.3", "p8", "paragraph", 118, "in cui β e κ sono ricavati dalla Tabella C.4.2.X e A_c,eff è l’area efficace della piattabanda compressa, che tiene conto dell’instabilità ed è definita al § C4.2.4.1.3.4.4.", [text("in cui "), math("β", "\\beta"), text(" e "), math("κ", "\\kappa"), text(" sono ricavati dalla Tabella C.4.2.X e "), math("A_c,eff", "A_{c,\\mathrm{eff}}"), text(" è l’area efficace della piattabanda compressa, che tiene conto dell’instabilità ed è definita al § C4.2.4.1.3.4.4.")]),
        block("C4.2.4.1.3.4.3", "p9", "paragraph", 118, "L’espressione [C4.2.65] è valida anche per le piattabande tese, purché si sostituisca A_c,eff con l’area lorda della piattabanda tesa.", [text("L’espressione [C4.2.65] è valida anche per le piattabande tese, purché si sostituisca "), math("A_c,eff", "A_{c,\\mathrm{eff}}"), text(" con l’area lorda della piattabanda tesa.")]),
    ], formulaRows.map((row) => row.number), ["C4.2.X"], ["C4.2.13", "C4.2.14"]),
];

const figureSource13 = "page-0117-x95-y490-w400-h240@4x.png";
const figureSource14 = "page-0118-x105-y75-w390-h175@4x.png";
const manifest = {
    $schema: "urn:structural-codes:schema:asset-manifest:v2",
    schemaVersion: "2.0.0-alpha.1",
    recordType: "asset-manifest",
    document: "circ2019",
    section: "C4.2-step2e",
    sourceId,
    status: "transcribed-unreviewed",
    formulas: formulaRows.map((row) => ({ id: formulaId(row.number), unitId: uid(row.unit), officialNumber: row.number, pdfPage: row.page, latex: row.latex })),
    tables: [tableX],
    figures: [
        { id: figure13, unitId: uid("C4.2.4.1.3.4.3"), officialNumber: "C4.2.13", pdfPage: 117, caption: "Figura C4.2.13 – Luci equivalenti L_e e coefficienti riduttivi β per travi continue", alt: "Schema di travi continue con luci equivalenti L_e e coefficienti riduttivi β", imagePath: "figures/circ2019/figc4.2.13.png", region: figure13Region, sha256: "bbba14528a3cfb9e559c33fa197d9e7edfa00c8b2fc1396adf6a45a164bb8aa2" },
        { id: figure14, unitId: uid("C4.2.4.1.3.4.3"), officialNumber: "C4.2.14", pdfPage: 118, caption: "Figura C4.2.14 – Distribuzione delle tensioni normali dovute al trascinamento da taglio", alt: "Distribuzione delle tensioni normali nella piattabanda dovuta al trascinamento da taglio nei casi a e b", imagePath: "figures/circ2019/figc4.2.14.png", region: figure14Region, sha256: "15d0492ac989c93d9b3ed5da626c687ce30ef12800e40716757a6c4a8c16cec0" },
    ],
};

await mkdir(unitDirectory, { recursive: true });
await mkdir(assetDirectory, { recursive: true });
await mkdir(figureDirectory, { recursive: true });
await copyFile(join(evidenceRenderDirectory, figureSource13), join(figureDirectory, "figc4.2.13.png"));
await copyFile(join(evidenceRenderDirectory, figureSource14), join(figureDirectory, "figc4.2.14.png"));
await Promise.all([
    ...units.map((unit) => writeFile(join(unitDirectory, `${unit.numbering.official.toLowerCase()}.json`), `${JSON.stringify(unit, null, 2)}\n`, "utf8")),
    writeFile(join(assetDirectory, "C4.2-step2e.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8"),
]);
console.log(`Circolare C4.2 step2e: generate ${units.length} unità, ${formulaRows.length} formule, 1 tabella e 2 figure.`);
