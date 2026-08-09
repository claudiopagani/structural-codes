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

function makeUnit(number: string, title: string, blocks: GeneratedBlock[], formulas: string[] = [], figures: string[] = []) {
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
        assets: { formulaIds: formulas.map(formulaId), tableIds: [], figureIds: figures.map(figureId) },
        workflow: {
            status: "extracted",
            createdBy: { actorId: "codex:circ42-step2f", kind: "automated-agent", toolVersion: profile },
            createdAt,
            reviews: [],
            openIssues: [
                { issueId: `circ2019-${number.replaceAll(".", "-")}-source-review`, type: "normalization-review", severity: "blocking", note: "Record trascritto dall’evidence ufficiale ma non ancora confrontato integralmente da un revisore umano con il render della fonte." },
                { issueId: `circ2019-${number.replaceAll(".", "-")}-assets`, type: "asset-review", severity: "blocking", note: "La figura è ritagliata dalla fonte; resta obbligatoria la revisione umana indipendente." },
            ],
        },
    };
}

const formulaRows: FormulaRow[] = [
    { number: "C4.2.66", unit: "C4.2.4.1.3.4.4", page: 118, latex: "A_{c,\\mathrm{eff},\\mathrm{loc}}=A_{sl,\\mathrm{eff}}+\\sum_{c}\\rho_{\\mathrm{loc}}\\,b_{c,\\mathrm{loc}}\\,t", raw: "A_c,eff,loc = A_sl,eff + ∑_c ρ_loc b_c,loc t [C4.2.66]", region: reg(145, 565, 310, 70) },
    { number: "C4.2.67", unit: "C4.2.4.1.3.4.4", page: 119, latex: "A_{c,\\mathrm{eff}}=\\rho_c A_{c,\\mathrm{eff},\\mathrm{loc}}+\\sum b_{\\mathrm{lat,eff}}\\,t", raw: "A_c,eff = ρ_c A_c,eff,loc + ∑ b_lat,eff t [C4.2.67]", region: reg(145, 65, 310, 55) },
    { number: "C4.2.68", unit: "C4.2.4.1.3.4.4", page: 119, latex: "\\rho_c=\\xi(\\rho-\\chi_c)(2-\\xi)+\\chi_c", raw: "ρ_c = ξ(ρ − χ_c)(2 − ξ) + χ_c [C4.2.68]", region: reg(145, 165, 310, 55) },
    { number: "C4.2.69", unit: "C4.2.4.1.3.4.4", page: 119, latex: "0\\le\\xi=\\frac{\\sigma_{\\mathrm{cr,p}}}{\\sigma_{\\mathrm{cr,c}}}-1\\le1", raw: "0 ≤ ξ = σ_cr,p/σ_cr,c − 1 ≤ 1 [C4.2.69]", region: reg(145, 230, 310, 55) },
];

const formulaByNumber = new Map(formulaRows.map((row) => [row.number, row]));
const formula = (number: string) => formulaByNumber.get(number)!;
const figure15 = figureId("C4.2.15");
const figure15Region = reg(120, 620, 360, 145);
const unitNumber = "C4.2.4.1.3.4.4";

const units = [
    makeUnit(unitNumber, "Pannelli con irrigiditori longitudinali", [
        block(unitNumber, "heading", "heading", 118, "C4.2.4.1.3.4.4. Pannelli con irrigiditori longitudinali"),
        block(unitNumber, "p1", "paragraph", 118, "Nel calcolo dei pannelli con irrigiditori longitudinali si deve tener conto delle aree efficaci delle zone compresse, considerando l’instabilità globale del pannello irrigidito e l’instabilità locale di ciascun sottopannello e le riduzioni per effetto del trascinamento da taglio, se significative. Per le zone tese le aree efficaci si assumono uguali a quelle lorde, con le eventuali riduzioni per effetto del trascinamento da taglio."),
        block(unitNumber, "p2", "paragraph", 118, "Per tener conto dell’instabilità locale l’area effettiva di ciascun sottopannello deve essere valutata considerando il coefficiente di riduzione indicato nel seguito."),
        block(unitNumber, "p3", "paragraph", 118, "Il pannello irrigidito deve essere verificato per l’instabilità globale: il calcolo deve essere effettuato considerando le aree efficaci degli irrigiditori e modellando il pannello come una piastra ortotropa equivalente, in modo da determinare il coefficiente di riduzione ρ_c per l’instabilità globale.", [text("Il pannello irrigidito deve essere verificato per l’instabilità globale: il calcolo deve essere effettuato considerando le aree efficaci degli irrigiditori e modellando il pannello come una piastra ortotropa equivalente, in modo da determinare il coefficiente di riduzione "), math("ρ_c", "\\rho_c"), text(" per l’instabilità globale.")]),
        block(unitNumber, "p4", "paragraph", 118, "Indicati con A_sl,eff la somma delle aree efficaci di tutti gli irrigiditori longitudinali che sono nella zona compressa e con ρ_loc il coefficiente di riduzione della larghezza b_c,loc della parte compressa di ogni sottopannello, valutati come indicato nel seguito, e detto t lo spessore del sottopannello, l’area efficace A_c,eff,loc degli irrigiditori e dei sottopannelli che sono in zona compressa è data da", [text("Indicati con "), math("A_sl,eff", "A_{sl,\\mathrm{eff}}"), text(" la somma delle aree efficaci di tutti gli irrigiditori longitudinali che sono nella zona compressa e con "), math("ρ_loc", "\\rho_{\\mathrm{loc}}"), text(" il coefficiente di riduzione della larghezza "), math("b_c,loc", "b_{c,\\mathrm{loc}}"), text(" della parte compressa di ogni sottopannello, valutati come indicato nel seguito, e detto "), math("t", "t"), text(" lo spessore del sottopannello, l’area efficace "), math("A_c,eff,loc", "A_{c,\\mathrm{eff},\\mathrm{loc}}"), text(" degli irrigiditori e dei sottopannelli che sono in zona compressa è data da")]),
        formulaBlock(unitNumber, "formula-66", formula("C4.2.66")),
        block(unitNumber, "p5", "paragraph", 118, "essendo la sommatoria estesa a tutta la zona compressa del pannello irrigidito, ad eccezione delle parti, di larghezza b_lat,eff, vincolati a lastre adiacenti (Figura C4.2.15).", [text("essendo la sommatoria estesa a tutta la zona compressa del pannello irrigidito, ad eccezione delle parti, di larghezza "), math("b_lat,eff", "b_{\\mathrm{lat,eff}}"), text(", vincolati a lastre adiacenti (Figura C4.2.15).")]),
        figureBlock(unitNumber, "figure-15", 118, figure15, "Figura C4.2.15 - Lastra irrigidita uniformemente compressa", figure15Region),
        block(unitNumber, "p6", "paragraph", 119, "L’area efficace della parte compressa del pannello nervato è quindi data da"),
        formulaBlock(unitNumber, "formula-67", formula("C4.2.67")),
        block(unitNumber, "p7", "paragraph", 119, "Nel caso di lastre irrigidite pressoinflesse si può far riferimento alla Figura C4.2.16. In detta figura b_i e b_i+1 rappresentano le larghezze di lamiera collaboranti con l’irrigiditore, che possono essere ricavate, sempre in riferimento alla Figura C4.2.16, dalla Tabella C4.2.XI.", [text("Nel caso di lastre irrigidite pressoinflesse si può far riferimento alla Figura C4.2.16. In detta figura "), math("b_i", "b_i"), text(" e "), math("b_i+1", "b_{i+1}"), text(" rappresentano le larghezze di lamiera collaboranti con l’irrigiditore, che possono essere ricavate, sempre in riferimento alla Figura C4.2.16, dalla Tabella C4.2.XI.")]),
        block(unitNumber, "p8", "paragraph", 119, "Il coefficiente di riduzione ρ_c per l’instabilità globale può essere determinato come", [text("Il coefficiente di riduzione "), math("ρ_c", "\\rho_c"), text(" per l’instabilità globale può essere determinato come")]),
        formulaBlock(unitNumber, "formula-68", formula("C4.2.68")),
        block(unitNumber, "p9", "paragraph", 119, "dove χ_c è il coefficiente di riduzione per l’instabilità di colonna, ρ il coefficiente di riduzione per l’instabilità di lastra e", [text("dove "), math("χ_c", "\\chi_c"), text(" è il coefficiente di riduzione per l’instabilità di colonna, "), math("ρ", "\\rho"), text(" il coefficiente di riduzione per l’instabilità di lastra e")]),
        formulaBlock(unitNumber, "formula-69", formula("C4.2.69")),
        block(unitNumber, "p10", "paragraph", 119, "essendo σ_cr,c e σ_cr,p le tensioni critiche eleuriane per l’instabilità di colonna e l’instabilità di piastra, rispettivamente.", [text("essendo "), math("σ_cr,c", "\\sigma_{\\mathrm{cr,c}}"), text(" e "), math("σ_cr,p", "\\sigma_{\\mathrm{cr,p}}"), text(" le tensioni critiche eleuriane per l’instabilità di colonna e l’instabilità di piastra, rispettivamente.")]),
    ], formulaRows.map((row) => row.number), ["C4.2.15"]),
];

const manifest = {
    $schema: "urn:structural-codes:schema:asset-manifest:v2",
    schemaVersion: "2.0.0-alpha.1",
    recordType: "asset-manifest",
    document: "circ2019",
    section: "C4.2-step2f",
    sourceId,
    status: "transcribed-unreviewed",
    formulas: formulaRows.map((row) => ({ id: formulaId(row.number), unitId: uid(row.unit), officialNumber: row.number, pdfPage: row.page, latex: row.latex })),
    tables: [],
    figures: [
        { id: figure15, unitId: uid(unitNumber), officialNumber: "C4.2.15", pdfPage: 118, caption: "Figura C4.2.15 - Lastra irrigidita uniformemente compressa", alt: "Lastra irrigidita uniformemente compressa con aree efficaci del pannello", imagePath: "figures/circ2019/figc4.2.15.png", region: figure15Region, sha256: "2d53a599a704b8e146c7f350932f7f0e0469b79d77aab5d61461bb173289921e" },
    ],
};

await mkdir(unitDirectory, { recursive: true });
await mkdir(assetDirectory, { recursive: true });
await mkdir(figureDirectory, { recursive: true });
await copyFile(join(evidenceRenderDirectory, "page-0118-x120-y620-w360-h145@4x.png"), join(figureDirectory, "figc4.2.15.png"));
await Promise.all([
    ...units.map((unit) => writeFile(join(unitDirectory, `${unit.numbering.official.toLowerCase()}.json`), `${JSON.stringify(unit, null, 2)}\n`, "utf8")),
    writeFile(join(assetDirectory, "C4.2-step2f.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8"),
]);
console.log(`Circolare C4.2 step2f: generate ${units.length} unità, ${formulaRows.length} formule e 1 figura.`);
