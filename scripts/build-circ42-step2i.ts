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
const unitNumber = "C4.2.4.1.3.4.7";

type Region = { coordinateSystem: "pdf-points-top-left"; x: number; y: number; width: number; height: number };
type Inline = { kind: "text" | "math"; value: string; latex?: string };
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

function block(suffix: string, kind: "heading" | "paragraph", page: number, normalized: string, inline: Inline[] = [text(normalized)]): GeneratedBlock {
    return { blockId: `${uid(unitNumber)}#block-${suffix}`, kind, origin: "official", text: { raw: normalized, normalized, normalizationVersion: profile, inline }, evidence: evidence(page, normalized, normalized, reg(73.9, 55, 450, 730)) };
}

function formulaBlock(suffix: string, formula: FormulaRow): GeneratedBlock {
    return { blockId: `${uid(unitNumber)}#block-${suffix}`, kind: "formula-ref", origin: "official", assetId: formulaId(formula.number), evidence: evidence(formula.page, formula.raw, formula.raw, formula.region, true) };
}

function figureBlock(asset: string, caption: string, region: Region): GeneratedBlock {
    return { blockId: `${uid(unitNumber)}#block-figure-18`, kind: "figure-ref", origin: "official", assetId: asset, evidence: evidence(122, caption, caption, region, true) };
}

const formulaRows: FormulaRow[] = [{
    number: "C4.2.84",
    unit: unitNumber,
    page: 122,
    latex: "w_0=\\frac{\\min(a_1;a_2;b)}{300}",
    raw: "w₀ = min(a₁; a₂; b)/300 [C4.2.84]",
    region: reg(190, 315, 225, 35),
}];
const formula84: FormulaRow = formulaRows[0]!;
const figure18 = figureId("C4.2.18");
const figure18Region = reg(130, 375, 350, 90);

const blocks: GeneratedBlock[] = [
    block("heading", "heading", 122, "C4.2.4.1.3.4.7. Requisiti minimi per gli irrigiditori trasversali"),
    block("p1", "paragraph", 122, "Gli irrigiditori trasversali devono garantire un adeguato vincolo alla lamiera, sia in assenza, sia in presenza di nervature longitudinali."),
    block("p2", "paragraph", 122, "Gli irrigiditori trasversali possono essere considerati come elementi semplicemente appoggiati soggetti ai carichi laterali e ad un difetto di rettilineità di forma sinusoidale di ampiezza"),
    formulaBlock("formula-84", formula84),
    block("p3", "paragraph", 122, "in cui a₁ e a₂ sono le lunghezze dei due pannelli adiacenti all’irrigiditore considerato e b è la luce dell’irrigiditore (Figura C4.2.18).", [text("in cui "), math("a₁", "a_1"), text(" e "), math("a₂", "a_2"), text(" sono le lunghezze dei due pannelli adiacenti all’irrigiditore considerato e "), math("b", "b"), text(" è la luce dell’irrigiditore (Figura C4.2.18).")]),
    block("p4", "paragraph", 122, "Nel calcolo, gli altri irrigiditori si considerano rigidi e rettilinei, come rappresentato in Figura C4.2.18."),
    figureBlock(figure18, "Figura C4.2.18 - Schema di calcolo per gli irrigiditori trasversali", figure18Region),
    block("p5", "paragraph", 122, "Con le ipotesi sopra dette, si deve verificare, mediante un’analisi elastica del second’ordine che la tensione massima nell’irrigiditore risulti minore di f_y/γ_M1 e che l’incremento massimo di freccia dell’irrigiditore risulti minore di b/300.", [text("Con le ipotesi sopra dette, si deve verificare, mediante un’analisi elastica del second’ordine che la tensione massima nell’irrigiditore risulti minore di "), math("f_y/γ_M1", "\\frac{f_y}{\\gamma_{M1}}"), text(" e che l’incremento massimo di freccia dell’irrigiditore risulti minore di "), math("b/300", "\\frac{b}{300}"), text(".")]),
    block("p6", "paragraph", 122, "Nel caso che gli irrigiditori longitudinali siano soggetti a forze trasversali, occorre far riferimento a metodologie di calcolo e a normative di comprovata validità."),
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
    title: "Requisiti minimi per gli irrigiditori trasversali",
    titleBlockId: `${uid(unitNumber)}#block-heading`,
    hierarchy: { parentId: parent, ancestorIds: [uid("C4.2"), uid("C4.2.4"), uid("C4.2.4.1"), uid("C4.2.4.1.3"), parent], position: 7 },
    validity: { from: null, to: null, status: "unknown", asOf: "2026-08-09" },
    blocks,
    citations: [],
    relations: [],
    assets: { formulaIds: formulaRows.map((row) => formulaId(row.number)), tableIds: [], figureIds: [figure18] },
    workflow: {
        status: "extracted",
        createdBy: { actorId: "codex:circ42-step2i", kind: "automated-agent", toolVersion: profile },
        createdAt,
        reviews: [],
        openIssues: [
            { issueId: "circ2019-C4-2-4-1-3-4-7-source-review", type: "normalization-review", severity: "blocking", note: "Record trascritto dall’evidence ufficiale ma non ancora confrontato integralmente da un revisore umano con il render della fonte." },
            { issueId: "circ2019-C4-2-4-1-3-4-7-assets", type: "asset-review", severity: "blocking", note: "La figura è ritagliata dalla fonte; resta obbligatoria la revisione umana indipendente." },
        ],
    },
};

const manifest = {
    $schema: "urn:structural-codes:schema:asset-manifest:v2",
    schemaVersion: "2.0.0-alpha.1",
    recordType: "asset-manifest",
    document: "circ2019",
    section: "C4.2-step2i",
    sourceId,
    status: "transcribed-unreviewed",
    formulas: [{ id: formulaId(formula84.number), unitId: uid(unitNumber), officialNumber: formula84.number, pdfPage: 122, latex: formula84.latex }],
    tables: [],
    figures: [{ id: figure18, unitId: uid(unitNumber), officialNumber: "C4.2.18", pdfPage: 122, caption: "Figura C4.2.18 - Schema di calcolo per gli irrigiditori trasversali", alt: "Schema di calcolo longitudinale e trasversale per gli irrigiditori trasversali", imagePath: "figures/circ2019/figc4.2.18.png", region: figure18Region, sha256: "721c4836cd3592a873eea24107914048202acd9f7cf5aa207727e2f7f0450b2b" }],
};

await mkdir(unitDirectory, { recursive: true });
await mkdir(assetDirectory, { recursive: true });
await mkdir(figureDirectory, { recursive: true });
await copyFile(join(evidenceRenderDirectory, "page-0122-x130-y375-w350-h90@4x.png"), join(figureDirectory, "figc4.2.18.png"));
await Promise.all([
    writeFile(join(unitDirectory, `${unitNumber.toLowerCase()}.json`), `${JSON.stringify(unit, null, 2)}\n`, "utf8"),
    writeFile(join(assetDirectory, "C4.2-step2i.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8"),
]);
console.log(`Circolare C4.2 step2i: generate 1 unità, 1 formula e 1 figura.`);
