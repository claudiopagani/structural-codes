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
const unitNumber = "C4.2.4.1.3.4.6";

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

function block(number: string, suffix: string, kind: TextKind, page: number, normalized: string, inline: Inline[] = [text(normalized)], raw = normalized): GeneratedBlock {
    return { blockId: `${uid(number)}#block-${suffix}`, kind, origin: "official", text: { raw, normalized, normalizationVersion: profile, inline }, evidence: evidence(page, raw, normalized, pageRegion()) };
}

function formulaBlock(number: string, suffix: string, formula: FormulaRow): GeneratedBlock {
    return { blockId: `${uid(number)}#block-${suffix}`, kind: "formula-ref", origin: "official", assetId: formulaId(formula.number), evidence: evidence(formula.page, formula.raw, formula.raw, formula.region, true) };
}

function figureBlock(number: string, suffix: string, page: number, asset: string, caption: string, region: Region): GeneratedBlock {
    return { blockId: `${uid(number)}#block-${suffix}`, kind: "figure-ref", origin: "official", assetId: asset, evidence: evidence(page, caption, caption, region, true) };
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
            createdBy: { actorId: "codex:circ42-step2h", kind: "automated-agent", toolVersion: profile },
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
    { number: "C4.2.77", unit: unitNumber, page: 121, latex: "\\sigma_{\\mathrm{cr,p}}=k_{\\sigma,\\mathrm{p}}\\cdot\\frac{\\pi^2 E}{12(1-\\nu^2)}\\cdot\\left(\\frac{t}{b}\\right)^2", raw: "σ_cr,p = k_σ,p · π² E/[12(1 − ν²)] · (t/b)² [C4.2.77]", region: reg(145, 65, 310, 55) },
    { number: "C4.2.78.a", unit: unitNumber, page: 121, latex: "k_{\\sigma,\\mathrm{p}}=\\frac{2\\left[(1+\\alpha_1^2)^2+\\gamma-1\\right]}{\\alpha_1^2(\\psi+1)(1+\\delta)}\\quad\\text{se }\\alpha_1\\le\\sqrt[4]{\\gamma}", raw: "k_σ,p = 2[(1 + α₁²)² + γ − 1]/[α₁²(ψ + 1)(1 + δ)] se α₁ ≤ ⁴√γ [C4.2.78.a]", region: reg(145, 155, 310, 60) },
    { number: "C4.2.78.b", unit: unitNumber, page: 121, latex: "k_{\\sigma,\\mathrm{p}}=\\frac{4(1+\\sqrt{\\gamma})}{(\\psi+1)(1+\\delta)}\\quad\\text{se }\\alpha_1>\\sqrt[4]{\\gamma}", raw: "k_σ,p = 4(1 + √γ)/[(ψ + 1)(1 + δ)] se α₁ > ⁴√γ [C4.2.78.b]", region: reg(145, 245, 310, 60) },
    { number: "C4.2.79", unit: unitNumber, page: 121, latex: "\\gamma=\\frac{12(1-\\nu^2)I_{\\mathrm{sl}}}{b\\cdot t^3}", raw: "γ = 12(1 − ν²) I_sl/(b · t³) [C4.2.79]", region: reg(170, 365, 260, 50) },
    { number: "C4.2.80", unit: unitNumber, page: 121, latex: "\\delta=\\frac{\\sum A_{\\mathrm{sl}}}{b\\cdot t}", raw: "δ = ΣA_sl/(b · t) [C4.2.80]", region: reg(175, 425, 245, 50) },
    { number: "C4.2.81.a", unit: unitNumber, page: 121, latex: "\\sigma_{\\mathrm{cr,sl}}=\\frac{1{,}05\\cdot E}{A_{\\mathrm{sl,1}}}\\cdot\\sqrt{\\frac{I_{\\mathrm{sl,1}}\\cdot t^3\\cdot b}{b_1\\cdot b_2}}\\quad\\text{se }a\\ge a_c", raw: "σ_cr,sl = (1,05 · E/A_sl,1) · √(I_sl,1 · t³ · b/(b₁ · b₂)) se a ≥ a_c [C4.2.81.a]", region: reg(125, 505, 345, 70) },
    { number: "C4.2.81.b", unit: unitNumber, page: 121, latex: "\\sigma_{\\mathrm{cr,sl}}=\\frac{\\pi^2 E I_{\\mathrm{sl,1}}}{A_{\\mathrm{sl,1}}\\cdot a^2}+\\frac{E b\\cdot a^2\\cdot t^3}{4\\pi^2(1-\\nu^2)A_{\\mathrm{sl,1}}\\cdot b_1^2\\cdot b_2^2}\\quad\\text{se }a<a_c", raw: "σ_cr,sl = π² E I_sl,1/(A_sl,1 · a²) + E b · a² · t³/[4π²(1 − ν²) A_sl,1 · b₁² · b₂²] se a < a_c [C4.2.81.b]", region: reg(105, 580, 405, 70) },
    { number: "C4.2.82", unit: unitNumber, page: 121, latex: "a_c=4{,}33\\cdot\\sqrt[4]{\\frac{I_{\\mathrm{sl,1}}\\cdot b_1^2\\cdot b_2^2}{t^3\\cdot b}}", raw: "a_c = 4,33 · ⁴√(I_sl,1 · b₁² · b₂²/(t³ · b)) [C4.2.82]", region: reg(185, 700, 250, 60) },
    { number: "C4.2.83", unit: unitNumber, page: 122, latex: "\\sigma_{\\mathrm{cr,p}}=\\min\\left(\\sigma_{\\mathrm{cr,pI}},\\sigma_{\\mathrm{cr,pII}},\\sigma_{\\mathrm{cr,pIII}}\\right)", raw: "σ_cr,p = min(σ_cr,pI, σ_cr,pII, σ_cr,pIII) [C4.2.83]", region: reg(150, 185, 300, 55) },
];

const formulaByNumber = new Map(formulaRows.map((row) => [row.number, row]));
const formula = (number: string) => formulaByNumber.get(number)!;
const figure17 = figureId("C4.2.17");
const figure17Region = reg(95, 80, 410, 125);

const units = [makeUnit(unitNumber, "Instabilità di piastra", [
    block(unitNumber, "heading", "heading", 120, "C4.2.4.1.3.4.6. Instabilità di piastra"),
    formulaBlock(unitNumber, "formula-77", formula("C4.2.77")),
    block(unitNumber, "p1", "paragraph", 121, "dove t e b sono lo spessore e la larghezza della piastra irrigidita (v. Figura C4.2.16) e k_σ,p è il coefficiente d’instabilità per tensioni normali.", [text("dove "), math("t", "t"), text(" e "), math("b", "b"), text(" sono lo spessore e la larghezza della piastra irrigidita (v. Figura C4.2.16) e "), math("k_σ,p", "k_{\\sigma,\\mathrm{p}}"), text(" è il coefficiente d’instabilità per tensioni normali.")]),
    block(unitNumber, "p2", "paragraph", 121, "In mancanza di determinazioni più accurate, il coefficiente k_σ,p per un pannello di lunghezza a può essere assunto uguale a", [text("In mancanza di determinazioni più accurate, il coefficiente "), math("k_σ,p", "k_{\\sigma,\\mathrm{p}}"), text(" per un pannello di lunghezza "), math("a", "a"), text(" può essere assunto uguale a")]),
    formulaBlock(unitNumber, "formula-78a", formula("C4.2.78.a")),
    formulaBlock(unitNumber, "formula-78b", formula("C4.2.78.b")),
    block(unitNumber, "p3", "paragraph", 121, "in cui"),
    block(unitNumber, "p4", "paragraph", 121, "α₁=a/b≥0,5;", [math("α₁=a/b≥0,5", "\\alpha_1=\\frac{a}{b}\\ge 0{,}5"), text(";")]),
    block(unitNumber, "p5", "paragraph", 121, "ψ è il rapporto tra le tensioni ai lembi del pannello, ψ=σ₂/σ₁≥0,5, essendo σ₁ la tensione al lembo maggiormente compresso;", [math("ψ", "\\psi"), text(" è il rapporto tra le tensioni ai lembi del pannello, "), math("ψ=σ₂/σ₁≥0,5", "\\psi=\\frac{\\sigma_2}{\\sigma_1}\\ge 0{,}5"), text(", essendo "), math("σ₁", "\\sigma_1"), text(" la tensione al lembo maggiormente compresso;")]),
    block(unitNumber, "p6", "paragraph", 121, "γ è il rapporto tra il momento d’inerzia baricentrico dell’intera piastra irrigidita, I_sl, e il momento d’inerzia della lamiera:", [math("γ", "\\gamma"), text(" è il rapporto tra il momento d’inerzia baricentrico dell’intera piastra irrigidita, "), math("I_sl", "I_{\\mathrm{sl}}"), text(", e il momento d’inerzia della lamiera:")]),
    formulaBlock(unitNumber, "formula-79", formula("C4.2.79")),
    block(unitNumber, "p7", "paragraph", 121, "δ è il rapporto tra l’area complessiva lorda degli irrigiditori ΣA_sl e l’area lorda della lamiera", [math("δ", "\\delta"), text(" è il rapporto tra l’area complessiva lorda degli irrigiditori "), math("ΣA_sl", "\\sum A_{\\mathrm{sl}}"), text(" e l’area lorda della lamiera")]),
    formulaBlock(unitNumber, "formula-80", formula("C4.2.80")),
    block(unitNumber, "heading-compressa", "heading", 121, "Piastre con uno o due irrigiditori longitudinali in zona compressa"),
    block(unitNumber, "p8", "paragraph", 121, "Piastre con uno o due irrigiditori longitudinali in zona compressa possono essere trattate con i seguenti metodi semplificati, trascurando il contributo degli eventuali irrigiditori tesi."),
    block(unitNumber, "heading-solo", "heading", 121, "Piastra con un solo irrigiditore longitudinale"),
    block(unitNumber, "p9", "paragraph", 121, "Se la piastra presenta un solo irrigiditore in zona compressa, quest’ultimo può essere considerato come un elemento compresso isolato vincolato elasticamente dalla lamiera, cosicché la tensione critica eleuriana può essere calcolata come"),
    formulaBlock(unitNumber, "formula-81a", formula("C4.2.81.a")),
    formulaBlock(unitNumber, "formula-81b", formula("C4.2.81.b")),
    block(unitNumber, "p10", "paragraph", 121, "dove A_sl,1 è l’area lorda dell’irrigiditore, ottenuta come indicato in Figura C4.2.16 e in Tabella C4.2.XI, I_sl,1 è il momento d’inerzia baricentrico della sezione lorda dell’irrigiditore, b₁ e b₂ sono le distanze dell’irrigiditore dai bordi longitudinali del pannello b₁+b₂=b, e a_c è uguale a", [text("dove "), math("A_sl,1", "A_{\\mathrm{sl,1}}"), text(" è l’area lorda dell’irrigiditore, ottenuta come indicato in Figura C4.2.16 e in Tabella C4.2.XI, "), math("I_sl,1", "I_{\\mathrm{sl,1}}"), text(" è il momento d’inerzia baricentrico della sezione lorda dell’irrigiditore, "), math("b₁", "b_1"), text(" e "), math("b₂", "b_2"), text(" sono le distanze dell’irrigiditore dai bordi longitudinali del pannello "), math("b₁+b₂=b", "b_1+b_2=b"), text(", e "), math("a_c", "a_c"), text(" è uguale a")]),
    formulaBlock(unitNumber, "formula-82", formula("C4.2.82")),
    block(unitNumber, "heading-due", "heading", 121, "Piastra con due irrigiditori longitudinali"),
    block(unitNumber, "p11", "paragraph", 122, "Se la piastra presenta due irrigiditori longitudinali, di area A_sl,1 e A_sl,2, e momenti d’inerzia I_sl,1 e I_sl,2, rispettivamente, si possono considerare le tre situazioni limite illustrate in Figura C4.2.17.", [text("Se la piastra presenta due irrigiditori longitudinali, di area "), math("A_sl,1", "A_{\\mathrm{sl,1}}"), text(" e "), math("A_sl,2", "A_{\\mathrm{sl,2}}"), text(", e momenti d’inerzia "), math("I_sl,1", "I_{\\mathrm{sl,1}}"), text(" e "), math("I_sl,2", "I_{\\mathrm{sl,2}}"), text(", rispettivamente, si possono considerare le tre situazioni limite illustrate in Figura C4.2.17.")]),
    block(unitNumber, "p12", "paragraph", 122, "Nel caso I il primo irrigiditore si instabilizza e il secondo è considerato rigido; nel caso II il secondo irrigiditore si instabilizza e il primo è considerato rigido; nel caso III, infine, si considera un unico irrigiditore equivalente di area A_sl,eq=A_sl,1+A_sl,2 e momento d’inerzia I_sl,eq=I_sl,1+I_sl,2, disposto nel punto d’applicazione della risultante delle forze normali incassate dei due irrigiditori.", [text("Nel caso I il primo irrigiditore si instabilizza e il secondo è considerato rigido; nel caso II il secondo irrigiditore si instabilizza e il primo è considerato rigido; nel caso III, infine, si considera un unico irrigiditore equivalente di area "), math("A_sl,eq=A_sl,1+A_sl,2", "A_{\\mathrm{sl,eq}}=A_{\\mathrm{sl,1}}+A_{\\mathrm{sl,2}}"), text(" e momento d’inerzia "), math("I_sl,eq=I_sl,1+I_sl,2", "I_{\\mathrm{sl,eq}}=I_{\\mathrm{sl,1}}+I_{\\mathrm{sl,2}}"), text(", disposto nel punto d’applicazione della risultante delle forze normali incassate dei due irrigiditori.")]),
    figureBlock(unitNumber, "figure-17", 122, figure17, "Figura C4.2.17 - Lastra irrigidita con due irrigiditori nella parte compressa", figure17Region),
    block(unitNumber, "p13", "paragraph", 122, "Mediante le formule [C4.2.81], ponendo b₁=b₁*, b₂=b₂*, b=b*, si calcolano le tensioni critiche euleriane, σ_cr,pI, σ_cr,pII e σ_cr,pIII, relative ai tre casi indicati in Figura C4.2.17.", [text("Mediante le formule [C4.2.81], ponendo "), math("b₁=b₁*", "b_1=b_1^*"), text(", "), math("b₂=b₂*", "b_2=b_2^*"), text(", "), math("b=b*", "b=b^*"), text(", si calcolano le tensioni critiche euleriane, "), math("σ_cr,pI", "\\sigma_{\\mathrm{cr,pI}}"), text(", "), math("σ_cr,pII", "\\sigma_{\\mathrm{cr,pII}}"), text(" e "), math("σ_cr,pIII", "\\sigma_{\\mathrm{cr,pIII}}"), text(", relative ai tre casi indicati in Figura C4.2.17.")]),
    block(unitNumber, "p14", "paragraph", 122, "La tensione critica del pannello σ_cr,p è quella minima tra le tre sopra determinate", [text("La tensione critica del pannello "), math("σ_cr,p", "\\sigma_{\\mathrm{cr,p}}"), text(" è quella minima tra le tre sopra determinate")]),
    formulaBlock(unitNumber, "formula-83", formula("C4.2.83")),
], formulaRows.map((row) => row.number), ["C4.2.17"])];

const manifest = {
    $schema: "urn:structural-codes:schema:asset-manifest:v2",
    schemaVersion: "2.0.0-alpha.1",
    recordType: "asset-manifest",
    document: "circ2019",
    section: "C4.2-step2h",
    sourceId,
    status: "transcribed-unreviewed",
    formulas: formulaRows.map((row) => ({ id: formulaId(row.number), unitId: uid(row.unit), officialNumber: row.number, pdfPage: row.page, latex: row.latex })),
    tables: [],
    figures: [{ id: figure17, unitId: uid(unitNumber), officialNumber: "C4.2.17", pdfPage: 122, caption: "Figura C4.2.17 - Lastra irrigidita con due irrigiditori nella parte compressa", alt: "Lastra irrigidita con due irrigiditori nella parte compressa nei tre casi limite", imagePath: "figures/circ2019/figc4.2.17.png", region: figure17Region, sha256: "08da290c7f23f9441bd82a36e44e533db4f05eda4368af5604cbbdf1ae6f82a5" }],
};

await mkdir(unitDirectory, { recursive: true });
await mkdir(assetDirectory, { recursive: true });
await mkdir(figureDirectory, { recursive: true });
await copyFile(join(evidenceRenderDirectory, "page-0122-x95-y80-w410-h125@4x.png"), join(figureDirectory, "figc4.2.17.png"));
await Promise.all([
    ...units.map((unit) => writeFile(join(unitDirectory, `${unit.numbering.official.toLowerCase()}.json`), `${JSON.stringify(unit, null, 2)}\n`, "utf8")),
    writeFile(join(assetDirectory, "C4.2-step2h.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8"),
]);
console.log(`Circolare C4.2 step2h: generate ${units.length} unità, ${formulaRows.length} formule e 1 figura.`);
