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
const unitNumber = "C4.2.4.1.3.4.8";

type Region = { coordinateSystem: "pdf-points-top-left"; x: number; y: number; width: number; height: number };
type Inline = { kind: "text" | "math"; value: string; latex?: string };
type FormulaRow = { number: string; page: number; latex: string; raw: string; region: Region };
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
const reg = (x: number, y: number, width: number, height: number): Region => ({ coordinateSystem: "pdf-points-top-left", x, y, width, height });
const text = (value: string): Inline => ({ kind: "text", value });
const math = (value: string, latex: string): Inline => ({ kind: "math", value, latex });
const hash = (value: string) => sha256OfText(value);

function evidence(page: number, raw: string, normalized: string, region: Region, manual = false) {
    return {
        sourceId,
        pdfPage: page,
        printedPage: String(page - 4),
        region,
        extraction: { method: manual ? "manual-transcription" : "pdf-text", tool: manual ? "codex-source-transcription" : "pdfjs-dist", toolVersion: manual ? profile : "4.10.38" },
        transformations: [
            { operation: "join-line-wrap", ruleVersion: profile, note: "Ricomposte le righe tipografiche appartenenti allo stesso capoverso; i capoversi distinti restano blocchi separati." },
            ...(raw !== normalized ? [{ operation: "manual-correction", ruleVersion: profile, note: "Ripristinati accenti, apostrofi, simboli e notazione confrontati con il render ufficiale." }] : []),
            { operation: "unicode-nfc", ruleVersion: profile, note: "Testo normalizzato in Unicode NFC." },
        ],
        rawSha256: hash(raw),
        normalizedSha256: hash(normalized),
    };
}

function block(suffix: string, kind: "heading" | "paragraph", page: number, normalized: string, inline: Inline[] = [text(normalized)], region = reg(73.9, 55, 450, 730)): GeneratedBlock {
    return { blockId: `${uid(unitNumber)}#block-${suffix}`, kind, origin: "official", text: { raw: normalized, normalized, normalizationVersion: profile, inline }, evidence: evidence(page, normalized, normalized, region) };
}

function formulaBlock(suffix: string, formula: FormulaRow): GeneratedBlock {
    return { blockId: `${uid(unitNumber)}#block-${suffix}`, kind: "formula-ref", origin: "official", assetId: formulaId(formula.number), evidence: evidence(formula.page, formula.raw, formula.raw, formula.region, true) };
}

const formulaRows: FormulaRow[] = [
    { number: "C4.2.85", page: 122, latex: "I_{\\mathrm{st}}\\ge\\frac{\\sigma_m}{E}\\cdot\\left(\\frac{b}{\\pi}\\right)^4\\cdot\\left(1+300\\frac{w_0}{b}\\cdot u\\right)", raw: "I_st ≥ (σ_m/E) · (b/π)^4 · (1 + 300 w_0/b · u) [C4.2.85]", region: reg(145, 535, 325, 45) },
    { number: "C4.2.86", page: 122, latex: "\\sigma_m=\\frac{\\sigma_{\\mathrm{cr,c}}}{\\sigma_{\\mathrm{cr,p}}}\\cdot\\left(\\frac{N_{\\mathrm{Ed}}}{b}\\right)\\cdot\\left(\\frac{1}{a_1}+\\frac{1}{a_2}\\right)", raw: "σ_m = (σ_cr,c/σ_cr,p) · (N_Ed/b) · (1/a_1 + 1/a_2) [C4.2.86]", region: reg(145, 595, 325, 45) },
    { number: "C4.2.87", page: 122, latex: "u=\\frac{\\pi^2\\cdot E\\cdot e_{\\max}\\cdot\\gamma_{M1}}{300\\cdot b\\cdot f_y}", raw: "u = (π^2 · E · e_max · γ_M1)/(300 · b · f_y) [C4.2.87]", region: reg(145, 635, 325, 45) },
    { number: "C4.2.88", page: 122, latex: "N_d\\ge N_d^*=0{,}5\\cdot\\sigma_{\\max}\\cdot A_{c,\\mathrm{eff}}", raw: "N_d ≥ N_d* = 0,5 · σ_max · A_c,eff [C4.2.88]", region: reg(145, 690, 325, 45) },
    { number: "C4.2.89", page: 123, latex: "\\Delta N_{\\mathrm{st}}=\\frac{\\sigma_m\\cdot b^2}{\\pi^2}", raw: "ΔN_st = σ_m · b^2/π^2 [C4.2.89]", region: reg(145, 145, 325, 45) },
    { number: "C4.2.90", page: 123, latex: "q=\\frac{\\pi}{4}\\cdot\\sigma_m\\cdot\\left(w_0+w_{\\mathrm{el}}\\right)", raw: "q = (π/4) · σ_m · (w_0 + w_el) [C4.2.90]", region: reg(145, 205, 325, 45) },
    { number: "C4.2.91", page: 123, latex: "\\frac{I_T}{I_p}\\ge 5{,}3\\cdot\\frac{f_y}{E}", raw: "I_T/I_p ≥ 5,3 · f_y/E [C4.2.91]", region: reg(145, 270, 325, 55) },
    { number: "C4.2.92", page: 123, latex: "\\sigma_{\\mathrm{cr}}\\ge 6\\cdot f_y", raw: "σ_cr ≥ 6 · f_y [C4.2.92]", region: reg(145, 335, 325, 45) },
];

const byNumber = new Map(formulaRows.map((formula) => [formula.number, formula]));
const formula = (number: string) => byNumber.get(number)!;

const blocks: GeneratedBlock[] = [
    block("heading", "heading", 122, "C4.2.4.1.3.4.8. Verifiche semplificate"),
    block("p1", "paragraph", 122, "Le verifiche possono essere semplificate controllando che, in assenza di sforzo normale, il momento d’inerzia dell’irrigiditore I_st soddisfi la disuguaglianza", [text("Le verifiche possono essere semplificate controllando che, in assenza di sforzo normale, il momento d’inerzia dell’irrigiditore "), math("I_st", "I_{\\mathrm{st}}"), text(" soddisfi la disuguaglianza")]),
    formulaBlock("formula-85", formula("C4.2.85")),
    block("p2", "paragraph", 122, "dove"),
    formulaBlock("formula-86", formula("C4.2.86")),
    formulaBlock("formula-87", formula("C4.2.87")),
    block("p3", "paragraph", 122, "essendo e_max la massima distanza tra i lembi dell’irrigiditore e il suo baricentro, N_Ed la massima forza di compressione nei pannelli adiacenti all’irrigiditore e σ_cr,c e σ_cr,p le tensioni critiche per l’instabilità di colonna e l’instabilità di piastra, definite ai §§ C4.2.4.1.3.4.5 e C4.2.4.1.3.4.6. N_Ed deve comunque soddisfare la relazione", [text("essendo "), math("e_max", "e_{\\max}"), text(" la massima distanza tra i lembi dell’irrigiditore e il suo baricentro, "), math("N_Ed", "N_{\\mathrm{Ed}}"), text(" la massima forza di compressione nei pannelli adiacenti all’irrigiditore e "), math("σ_cr,c", "\\sigma_{\\mathrm{cr,c}}"), text(" e "), math("σ_cr,p", "\\sigma_{\\mathrm{cr,p}}"), text(" le tensioni critiche per l’instabilità di colonna e l’instabilità di piastra, definite ai §§ C4.2.4.1.3.4.5 e C4.2.4.1.3.4.6. "), math("N_Ed", "N_{\\mathrm{Ed}}"), text(" deve comunque soddisfare la relazione")]),
    formulaBlock("formula-88", formula("C4.2.88")),
    block("p4", "paragraph", 123, "in cui A_c,eff è l’area compressa effettiva del pannello nervato e σ_max la massima tensione di compressione nel pannello nervato stesso.", [text("in cui "), math("A_c,eff", "A_{c,\\mathrm{eff}}"), text(" è l’area compressa effettiva del pannello nervato e "), math("σ_max", "\\sigma_{\\max}"), text(" la massima tensione di compressione nel pannello nervato stesso.")]),
    block("p5", "paragraph", 123, "Qualora l’irrigidimento sia anche soggetto a forza normale di compressione N_st, questa deve essere incrementata ai fini della presente verifica semplificata di", [text("Qualora l’irrigidimento sia anche soggetto a forza normale di compressione "), math("N_st", "N_{\\mathrm{st}}"), text(", questa deve essere incrementata ai fini della presente verifica semplificata di")]),
    formulaBlock("formula-89", formula("C4.2.89")),
    block("p6", "paragraph", 123, "In alternativa al metodo appena descritto, in assenza di forza normale, la verifica semplificata può essere effettuata mediante un’analisi elastica lineare, considerando un carico fittizio addizionale uniformemente distribuito sulla lunghezza b", [text("In alternativa al metodo appena descritto, in assenza di forza normale, la verifica semplificata può essere effettuata mediante un’analisi elastica lineare, considerando un carico fittizio addizionale uniformemente distribuito sulla lunghezza "), math("b", "b")]),
    formulaBlock("formula-90", formula("C4.2.90")),
    block("p7", "paragraph", 123, "dove w_0 è l’imperfezione [C4.2.84] e w_el la deformazione elastica, che può essere determinata per iterazione, o assunta cautelativamente uguale a b/300.", [text("dove "), math("w_0", "w_0"), text(" è l’imperfezione [C4.2.84] e "), math("w_el", "w_{\\mathrm{el}}"), text(" la deformazione elastica, che può essere determinata per iterazione, o assunta cautelativamente uguale a "), math("b/300", "\\frac{b}{300}"), text(".")]),
    block("p8", "paragraph", 123, "Nel caso di irrigiditori aperti, si deve inoltre effettuare la verifica di stabilità torsionale."),
    block("p9", "paragraph", 123, "In assenza di analisi più rigorose, la verifica può considerarsi soddisfatta se"),
    formulaBlock("formula-91", formula("C4.2.91")),
    block("p10", "paragraph", 123, "i cui I_T è il momento d’inerzia torsionale del solo irrigiditore e I_p è il momento d’inerzia polare del solo irrigiditore, rispetto all’attacco con la lamiera.", [text("i cui "), math("I_T", "I_T"), text(" è il momento d’inerzia torsionale del solo irrigiditore e "), math("I_p", "I_p"), text(" è il momento d’inerzia polare del solo irrigiditore, rispetto all’attacco con la lamiera.")]),
    block("p11", "paragraph", 123, "Qualora si consideri la rigidezza torsionale da ingobbamento impedito, la verifica di stabilità torsionale può essere effettuata controllando, in alternativa alla [C4.2.91], che risulti soddisfatta la disuguaglianza"),
    formulaBlock("formula-92", formula("C4.2.92")),
    block("p12", "paragraph", 123, "dove σ_cr è la tensione critica euleriana per l’instabilità torsionale dell’irrigiditore considerato incernierato alla lamiera.", [text("dove "), math("σ_cr", "\\sigma_{\\mathrm{cr}}"), text(" è la tensione critica euleriana per l’instabilità torsionale dell’irrigiditore considerato incernierato alla lamiera.")]),
];

const parent = uid("C4.2.4.1.3.4");
const unit = {
    $schema: "urn:structural-codes:schema:canonical-unit:v2",
    schemaVersion: "2.0.0-alpha.2",
    recordType: "canonical-unit",
    id: uid(unitNumber),
    workId,
    expressionId,
    kind: "subparagraph",
    numbering: { official: unitNumber, sortKey: unitNumber.replace(/^C/, "").split(".").map((part) => part.padStart(3, "0")).join(".") },
    title: "Verifiche semplificate",
    titleBlockId: `${uid(unitNumber)}#block-heading`,
    hierarchy: { parentId: parent, ancestorIds: [uid("C4.2"), uid("C4.2.4"), uid("C4.2.4.1"), uid("C4.2.4.1.3"), parent], position: 8 },
    validity: { from: null, to: null, status: "unknown", asOf: "2026-08-09" },
    blocks,
    citations: [],
    relations: [],
    assets: { formulaIds: formulaRows.map((row) => formulaId(row.number)), tableIds: [], figureIds: [] },
    workflow: {
        status: "extracted",
        createdBy: { actorId: "codex:circ42-step2j", kind: "automated-agent", toolVersion: profile },
        createdAt,
        reviews: [],
        openIssues: [
            { issueId: "circ2019-C4-2-4-1-3-4-8-source-review", type: "normalization-review", severity: "blocking", note: "Record trascritto dall’evidence ufficiale ma non ancora confrontato integralmente da un revisore umano con il render della fonte." },
            { issueId: "circ2019-C4-2-4-1-3-4-8-formula-review", type: "other", severity: "blocking", note: "Le formule C4.2.85–C4.2.92 richiedono revisione umana indipendente dei glifi e della notazione." },
        ],
    },
};

const manifest = {
    $schema: "urn:structural-codes:schema:asset-manifest:v2",
    schemaVersion: "2.0.0-alpha.1",
    recordType: "asset-manifest",
    document: "circ2019",
    section: "C4.2-step2j",
    sourceId,
    status: "transcribed-unreviewed",
    formulas: formulaRows.map((row) => ({ id: formulaId(row.number), unitId: uid(unitNumber), officialNumber: row.number, pdfPage: row.page, latex: row.latex })),
    tables: [],
    figures: [],
};

await mkdir(unitDirectory, { recursive: true });
await mkdir(assetDirectory, { recursive: true });
await Promise.all([
    writeFile(join(unitDirectory, `${unitNumber.toLowerCase()}.json`), `${JSON.stringify(unit, null, 2)}\n`, "utf8"),
    writeFile(join(assetDirectory, "C4.2-step2j.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8"),
]);
console.log(`Circolare C4.2 step2j: generate 1 unità e ${formulaRows.length} formule.`);
