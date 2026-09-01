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
            createdBy: { actorId: "codex:circ42-step2g", kind: "automated-agent", toolVersion: profile },
            createdAt,
            reviews: [],
            openIssues: [
                { issueId: `circ2019-${number.replaceAll(".", "-")}-source-review`, type: "normalization-review", severity: "blocking", note: "Record trascritto dall’evidence ufficiale ma non ancora confrontato integralmente da un revisore umano con il render della fonte." },
                { issueId: `circ2019-${number.replaceAll(".", "-")}-assets`, type: "asset-review", severity: "blocking", note: "Tabelle e figure sono strutturate o ritagliate dalla fonte; resta obbligatoria la revisione umana indipendente." },
            ],
        },
    };
}

const formulaRows: FormulaRow[] = [
    { number: "C4.2.70", unit: "C4.2.4.1.3.4.5", page: 119, latex: "\\sigma_{\\mathrm{cr,c}}=\\frac{\\pi^2 E\\cdot t^2}{12(1-\\nu^2)a^2}", raw: "σ_cr,c = π² E · t²/[12(1 − ν²)a²] [C4.2.70]", region: reg(145, 265, 310, 75) },
    { number: "C4.2.71", unit: "C4.2.4.1.3.4.5", page: 119, latex: "\\sigma_{\\mathrm{cr,c}}=\\sigma_{\\mathrm{cr,sl}}\\cdot\\frac{b_c}{b_{\\mathrm{sl,1}}}", raw: "σ_cr,c = σ_cr,sl · b_c/b_sl,1 [C4.2.71]", region: reg(145, 355, 310, 65) },
    { number: "C4.2.72", unit: "C4.2.4.1.3.4.5", page: 120, latex: "\\sigma_{\\mathrm{cr,sl}}=\\frac{\\pi^2 E\\cdot I_{\\mathrm{sl,1}}}{A_{\\mathrm{sl}}a^2}", raw: "σ_cr,sl = π² E · I_sl,1/(A_sl a²) [C4.2.72]", region: reg(145, 270, 310, 65) },
    { number: "C4.2.73", unit: "C4.2.4.1.3.4.5", page: 120, latex: "\\lambda_c=\\sqrt{\\frac{f_y}{\\sigma_{\\mathrm{cr,c}}}}", raw: "λ_c = √(f_y/σ_cr,c) [C4.2.73]", region: reg(145, 365, 310, 65) },
    { number: "C4.2.74", unit: "C4.2.4.1.3.4.5", page: 120, latex: "\\lambda_c=\\sqrt{\\frac{A_{\\mathrm{sl,1,eff}}f_y}{A_{\\mathrm{sl}}\\sigma_{\\mathrm{cr,c}}}}", raw: "λ_c = √(A_sl,1,eff f_y/(A_sl σ_cr,c)) [C4.2.74]", region: reg(145, 460, 310, 70) },
    { number: "C4.2.75", unit: "C4.2.4.1.3.4.5", page: 120, latex: "\\alpha_e=\\alpha+\\frac{0{,}09\\cdot e}{i}", raw: "α_e = α + 0,09 · e/i [C4.2.75]", region: reg(145, 555, 310, 70) },
    { number: "C4.2.76", unit: "C4.2.4.1.3.4.5", page: 120, latex: "i=\\sqrt{\\frac{I_{\\mathrm{sl,1}}}{A_{\\mathrm{sl,1}}}}", raw: "i = √(I_sl,1/A_sl,1) [C4.2.76]", region: reg(145, 660, 310, 70) },
];

const formulaByNumber = new Map(formulaRows.map((row) => [row.number, row]));
const formula = (number: string) => formulaByNumber.get(number)!;
const c = (value: string, latex?: string, spans: { colSpan?: number; rowSpan?: number } = {}) => ({ text: value, ...(latex ? { latex } : {}), ...spans });
const f = (value: string, latex: string, spans: { colSpan?: number; rowSpan?: number } = {}) => c(value, latex, spans);

const unitNumber = "C4.2.4.1.3.4.5";
const tableXIId = tableId("C4.2.XI");
const tableXI = {
    id: tableXIId,
    unitId: uid(unitNumber),
    officialNumber: "C4.2.XI",
    pdfPage: 120,
    caption: "Calcolo della larghezza di lamiera collaborante in riferimento alla Figura C4.2.16",
    columnCount: 4,
    headers: [[c(""), c("larghezza collaborante per il calcolo dell’area lorda"), c("larghezza collaborante per il calcolo dell’area efficace (Tabella C4.2.VIII)"), f("ψ_i", "\\psi_i")]],
    rows: [
        [f("b_1,inf", "b_{1,\\mathrm{inf}}"), f("(3 − ψ_1)/(5 − ψ_1) · b_1", "\\frac{3-\\psi_1}{5-\\psi_1}\\,b_1"), f("(3 − ψ_1)/(5 − ψ_1) · b_1,eff", "\\frac{3-\\psi_1}{5-\\psi_1}\\,b_{1,\\mathrm{eff}}"), f("ψ_1 = σ_cr,sl,1/σ_cr,p > 0", "\\psi_1=\\frac{\\sigma_{\\mathrm{cr,sl,1}}}{\\sigma_{\\mathrm{cr,p}}}>0")],
        [f("b_2,sup", "b_{2,\\mathrm{sup}}"), f("2/(5 − ψ_2) · b_2", "\\frac{2}{5-\\psi_2}\\,b_2"), f("2/(5 − ψ_2) · b_2,eff", "\\frac{2}{5-\\psi_2}\\,b_{2,\\mathrm{eff}}"), f("ψ_2 = σ_2/σ_cr,sl,1 > 0", "\\psi_2=\\frac{\\sigma_2}{\\sigma_{\\mathrm{cr,sl,1}}}>0")],
        [f("b_2,inf", "b_{2,\\mathrm{inf}}"), f("(3 − ψ_2)/(5 − ψ_2) · b_2", "\\frac{3-\\psi_2}{5-\\psi_2}\\,b_2"), f("(3 − ψ_2)/(5 − ψ_2) · b_2,eff", "\\frac{3-\\psi_2}{5-\\psi_2}\\,b_{2,\\mathrm{eff}}"), f("ψ_2 = σ_2/σ_cr,sl,1 > 0", "\\psi_2=\\frac{\\sigma_2}{\\sigma_{\\mathrm{cr,sl,1}}}>0")],
        [f("b_3,sup", "b_{3,\\mathrm{sup}}"), f("0,4 · b_3c", "0{,}4\\,b_{3c}"), f("0,4 · b_3c,eff", "0{,}4\\,b_{3c,\\mathrm{eff}}"), f("ψ_3 = σ_3/σ_2 < 0", "\\psi_3=\\frac{\\sigma_3}{\\sigma_2}<0")],
    ],
    notes: [],
};

const figure16 = figureId("C4.2.16");
const figure16Region = reg(150, 395, 330, 210);

const units = [
    makeUnit(unitNumber, "Instabilità di colonna", [
        block(unitNumber, "heading", "heading", 119, "C4.2.4.1.3.4.5. Instabilità di colonna"),
        block(unitNumber, "p1", "paragraph", 119, "In un pannello di lunghezza a, la tensione critica eleuriana σ_cr,c è data da", [text("In un pannello di lunghezza "), math("a", "a"), text(", la tensione critica eleuriana "), math("σ_cr,c", "\\sigma_{\\mathrm{cr,c}}"), text(" è data da")]),
        formulaBlock(unitNumber, "formula-70", formula("C4.2.70")),
        block(unitNumber, "p2", "paragraph", 119, "se non irrigidito, e da"),
        formulaBlock(unitNumber, "formula-71", formula("C4.2.71")),
        block(unitNumber, "p3", "paragraph", 119, "se irrigidito, essendo b_c e b_sl,1, rispettivamente, le distanze del lembo e dell’irrigiditore maggiormente compressi dall’asse neutro di pressoflessione (Figura C4.2.16).", [text("se irrigidito, essendo "), math("b_c", "b_c"), text(" e "), math("b_sl,1", "b_{\\mathrm{sl,1}}"), text(", rispettivamente, le distanze del lembo e dell’irrigiditore maggiormente compressi dall’asse neutro di pressoflessione (Figura C4.2.16).")]),
        figureBlock(unitNumber, "figure-16", 119, figure16, "Figura C4.2.16 - Lastra irrigidita pressoinflessa", figure16Region),
        tableBlock(unitNumber, "table-xi", 120, tableXIId, "Tabella C4.2.XI - Calcolo della larghezza di lamiera collaborante in riferimento alla Figura C4.2.16", reg(70, 45, 455, 225)),
        block(unitNumber, "p4", "paragraph", 120, "Nella [C4.2.71] σ_cr,sl rappresenta la tensione critica eleuriana dell’irrigiditore maggiormente compresso", [text("Nella [C4.2.71] "), math("σ_cr,sl", "\\sigma_{\\mathrm{cr,sl}}"), text(" rappresenta la tensione critica eleuriana dell’irrigiditore maggiormente compresso")]),
        formulaBlock(unitNumber, "formula-72", formula("C4.2.72")),
        block(unitNumber, "p5", "paragraph", 120, "essendo A_sl,1 e I_sl,1 l’area e il momento d’inerzia per l’inflessione fuori piano della sezione lorda dell’irrigiditore e delle parti di pannello ad esso adiacenti, determinate come indicato in Figura C4.2.16. La snellezza relativa λ_c è definita da", [text("essendo "), math("A_sl,1", "A_{\\mathrm{sl,1}}"), text(" e "), math("I_sl,1", "I_{\\mathrm{sl,1}}"), text(" l’area e il momento d’inerzia per l’inflessione fuori piano della sezione lorda dell’irrigiditore e delle parti di pannello ad esso adiacenti, determinate come indicato in Figura C4.2.16. La snellezza relativa "), math("λ_c", "\\lambda_c"), text(" è definita da")]),
        formulaBlock(unitNumber, "formula-73", formula("C4.2.73")),
        block(unitNumber, "p6", "paragraph", 120, "per i pannelli non irrigiditi e da"),
        formulaBlock(unitNumber, "formula-74", formula("C4.2.74")),
        block(unitNumber, "p7", "paragraph", 120, "per i pannelli irrigiditi, essendo A_sl,1,eff l’area efficace dell’irrigiditore e delle parti di pannello ad esso adiacenti.", [text("per i pannelli irrigiditi, essendo "), math("A_sl,1,eff", "A_{\\mathrm{sl,1,eff}}"), text(" l’area efficace dell’irrigiditore e delle parti di pannello ad esso adiacenti.")]),
        block(unitNumber, "p8", "paragraph", 120, "Il fattore di riduzione χ_c può essere ottenuto applicando la formula [4.2.44] del § 4.2.4.1.3.1 delle NTC e considerando un opportuno valore amplificato, α_e, del coefficiente α.", [text("Il fattore di riduzione "), math("χ_c", "\\chi_c"), text(" può essere ottenuto applicando la formula [4.2.44] del § 4.2.4.1.3.1 delle NTC e considerando un opportuno valore amplificato, "), math("α_e", "\\alpha_e"), text(", del coefficiente "), math("α", "\\alpha"), text(".")]),
        block(unitNumber, "p9", "paragraph", 120, "Per pannelli irrigiditi si può assumere"),
        formulaBlock(unitNumber, "formula-75", formula("C4.2.75")),
        block(unitNumber, "p10", "paragraph", 120, "dove α=0,34 (curva b della Tabella 4.2.VIII delle NTC) per irrigiditori a sezione chiusa e α=0,49 (curva c della Tabella 4.2.VIII delle NTC) per irrigiditori a sezione aperta. Nella [C4.2.75] e=max(e_1,e_2), dove e_1 e e_2 rappresentano le distanze dal baricentro della lamiera e dal baricentro dell’irrigiditore singolo, rispettivamente, (o dei baricentri dei due irrigiditori, in casi di irrigiditori doppi) dal baricentro della sezione efficace dell’irrigiditore (vedi Figura C4.2.16), e i è il raggio d’inerzia della sezione lorda dell’irrigiditore, comprensiva della parte di lamiera collaborante:", [text("dove "), math("α=0,34", "\\alpha=0{,}34"), text(" (curva b della Tabella 4.2.VIII delle NTC) per irrigiditori a sezione chiusa e "), math("α=0,49", "\\alpha=0{,}49"), text(" (curva c della Tabella 4.2.VIII delle NTC) per irrigiditori a sezione aperta. Nella [C4.2.75] "), math("e=max(e_1,e_2)", "e=\\max(e_1,e_2)"), text(", dove "), math("e_1", "e_1"), text(" e "), math("e_2", "e_2"), text(" rappresentano le distanze dal baricentro della lamiera e dal baricentro dell’irrigiditore singolo, rispettivamente, (o dei baricentri dei due irrigiditori, in casi di irrigiditori doppi) dal baricentro della sezione efficace dell’irrigiditore (vedi Figura C4.2.16), e "), math("i", "i"), text(" è il raggio d’inerzia della sezione lorda dell’irrigiditore, comprensiva della parte di lamiera collaborante:")]),
        formulaBlock(unitNumber, "formula-76", formula("C4.2.76")),
        block(unitNumber, "p11", "paragraph", 120, "Per pannelli non irrigiditi si può porre α_e=α=0,21 (curva a della Tab. 4.2.VIII delle NTC).", [text("Per pannelli non irrigiditi si può porre "), math("α_e=α=0,21", "\\alpha_e=\\alpha=0{,}21"), text(" (curva a della Tab. 4.2.VIII delle NTC).")]),
    ], formulaRows.map((row) => row.number), ["C4.2.XI"], ["C4.2.16"]),
];

const manifest = {
    $schema: "urn:structural-codes:schema:asset-manifest:v2",
    schemaVersion: "2.0.0-alpha.1",
    recordType: "asset-manifest",
    document: "circ2019",
    section: "C4.2-step2g",
    sourceId,
    status: "transcribed-unreviewed",
    formulas: formulaRows.map((row) => ({ id: formulaId(row.number), unitId: uid(row.unit), officialNumber: row.number, pdfPage: row.page, latex: row.latex })),
    tables: [tableXI],
    figures: [
        { id: figure16, unitId: uid(unitNumber), officialNumber: "C4.2.16", pdfPage: 119, caption: "Figura C4.2.16 - Lastra irrigidita pressoinflessa", alt: "Lastra irrigidita pressoinflessa con distribuzione delle tensioni e grandezze geometriche", imagePath: "figures/circ2019/figc4.2.16.png", region: figure16Region, sha256: "1e4623ee543dba92297649d82a8353bbd5361645fb23505aafed32be0222023d" },
    ],
};

await mkdir(unitDirectory, { recursive: true });
await mkdir(assetDirectory, { recursive: true });
await mkdir(figureDirectory, { recursive: true });
await copyFile(join(evidenceRenderDirectory, "page-0119-x150-y395-w330-h210@4x.png"), join(figureDirectory, "figc4.2.16.png"));
await Promise.all([
    ...units.map((unit) => writeFile(join(unitDirectory, `${unit.numbering.official.toLowerCase()}.json`), `${JSON.stringify(unit, null, 2)}\n`, "utf8")),
    writeFile(join(assetDirectory, "C4.2-step2g.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8"),
]);
console.log(`Circolare C4.2 step2g: generate ${units.length} unità, ${formulaRows.length} formule, 1 tabella e 1 figura.`);
