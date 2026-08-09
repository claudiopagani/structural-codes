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
const unitNumber = "C4.2.4.1.4.4";

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
            { operation: "join-line-wrap", ruleVersion: profile, note: "Ricomposte le righe tipografiche appartenenti allo stesso capoverso; la formula e la figura restano blocchi distinti." },
            ...(raw !== normalized ? [{ operation: "manual-correction", ruleVersion: profile, note: "Ripristinati accenti, apostrofi, simboli e notazione matematica confrontati con il render ufficiale." }] : []),
            { operation: "unicode-nfc", ruleVersion: profile, note: "Testo normalizzato in Unicode NFC." },
        ],
        rawSha256: hash(raw),
        normalizedSha256: hash(normalized),
    };
}

function block(suffix: string, kind: "heading" | "paragraph", page: number, normalized: string, inline: Inline[], region: Region): GeneratedBlock {
    return { blockId: `${uid(unitNumber)}#block-${suffix}`, kind, origin: "official", text: { raw: normalized, normalized, normalizationVersion: profile, inline }, evidence: evidence(page, normalized, normalized, region) };
}

function formulaBlock(suffix: string, formula: FormulaRow): GeneratedBlock {
    return { blockId: `${uid(unitNumber)}#block-${suffix}`, kind: "formula-ref", origin: "official", assetId: formulaId(formula.number), evidence: evidence(formula.page, formula.raw, formula.raw, formula.region, true) };
}

function figureBlock(suffix: string, asset: string, page: number, caption: string, region: Region): GeneratedBlock {
    return { blockId: `${uid(unitNumber)}#block-${suffix}`, kind: "figure-ref", origin: "official", assetId: asset, evidence: evidence(page, caption, caption, region, true) };
}

const formula98: FormulaRow = {
    number: "C4.2.98",
    page: 133,
    latex: "\\Delta\\tau_C=90\\left(\\frac{\\rho}{2200}\\right)^2\\,\\mathrm{MPa}",
    raw: "Δτ_C = 90 (ρ/2200)^2 MPa [C4.2.98]",
    region: reg(145, 390, 325, 50),
};
const figure24 = figureId("C4.2.24");
const figure24Region = reg(170, 575, 270, 95);

const blocks: GeneratedBlock[] = [
    block("heading", "heading", 133, "C4.2.4.1.4.4. Curva S-N per connettori a piolo", [text("C4.2.4.1.4.4. Curva S-N per connettori a piolo")], reg(73.9, 405, 450, 30)),
    block("p1", "paragraph", 133, "La curva S-N per connettori a piolo sollecitati a taglio delle strutture composte acciaio-calcestruzzo è rappresentata in Figura C4.2.24 ed è caratterizzata dall’assenza di limite di fatica. La pendenza della curva è m = 8 e la classe del particolare per calcestruzzo normale è Δτ_C = 90 MPa.", [text("La curva S-N per connettori a piolo sollecitati a taglio delle strutture composte acciaio-calcestruzzo è rappresentata in Figura C4.2.24 ed è caratterizzata dall’assenza di limite di fatica. La pendenza della curva è "), math("m = 8", "m=8"), text(" e la classe del particolare per calcestruzzo normale è "), math("Δτ_C = 90 MPa", "\\Delta\\tau_C=90\\,\\mathrm{MPa}"), text(".")], reg(73.9, 440, 450, 55)),
    block("p2", "paragraph", 133, "Per calcestruzzi leggeri la classe si riduce, in funzione del limite superiore della densità della classe di appartenenza, ρ, espresso in kg/m³, a", [text("Per calcestruzzi leggeri la classe si riduce, in funzione del limite superiore della densità della classe di appartenenza, "), math("ρ", "\\rho"), text(", espresso in "), math("kg/m³", "\\mathrm{kg}/\\mathrm{m}^3"), text(", a")], reg(73.9, 500, 450, 45)),
    formulaBlock("formula-98", formula98),
    block("p3", "paragraph", 133, "Le tensioni tangenziali devono essere valutate in riferimento alla sezione nominale del connettore.", [text("Le tensioni tangenziali devono essere valutate in riferimento alla sezione nominale del connettore.")], reg(73.9, 590, 450, 25)),
    figureBlock("figure-24", figure24, 133, "Figura C4.2.24 – Curva S-N per connettori a piolo", figure24Region),
];

const parent = uid("C4.2.4.1.4");
const unit = {
    $schema: "urn:structural-codes:schema:canonical-unit:v2",
    schemaVersion: "2.0.0-alpha.2",
    recordType: "canonical-unit",
    id: uid(unitNumber),
    workId,
    expressionId,
    kind: "subparagraph",
    numbering: { official: unitNumber, sortKey: unitNumber.replace(/^C/, "").split(".").map((part) => part.padStart(3, "0")).join(".") },
    title: "Curva S-N per connettori a piolo",
    titleBlockId: `${uid(unitNumber)}#block-heading`,
    hierarchy: { parentId: parent, ancestorIds: [uid("C4.2"), uid("C4.2.4"), uid("C4.2.4.1"), parent], position: 4 },
    validity: { from: null, to: null, status: "unknown", asOf: "2026-08-09" },
    blocks,
    citations: [],
    relations: [],
    assets: { formulaIds: [formulaId(formula98.number)], tableIds: [], figureIds: [figure24] },
    workflow: {
        status: "extracted",
        createdBy: { actorId: "codex:circ42-step2p", kind: "automated-agent", toolVersion: profile },
        createdAt,
        reviews: [],
        openIssues: [
            { issueId: "circ2019-C4-2-4-1-4-4-source-review", type: "normalization-review", severity: "blocking", note: "Record trascritto dall’evidence ufficiale ma non ancora confrontato integralmente da un revisore umano con i render della pagina fonte." },
            { issueId: "circ2019-C4-2-4-1-4-4-assets-review", type: "asset-review", severity: "blocking", note: "La formula C4.2.98 e la Figura C4.2.24 richiedono revisione umana indipendente." },
        ],
    },
};

const manifest = {
    $schema: "urn:structural-codes:schema:asset-manifest:v2",
    schemaVersion: "2.0.0-alpha.1",
    recordType: "asset-manifest",
    document: "circ2019",
    section: "C4.2-step2p",
    sourceId,
    status: "transcribed-unreviewed",
    formulas: [{ id: formulaId(formula98.number), unitId: uid(unitNumber), officialNumber: formula98.number, pdfPage: formula98.page, latex: formula98.latex }],
    tables: [],
    figures: [{ id: figure24, unitId: uid(unitNumber), officialNumber: "C4.2.24", pdfPage: 133, caption: "Figura C4.2.24 – Curva S-N per connettori a piolo", alt: "Curva S-N per connettori a piolo", imagePath: "figures/circ2019/figc4.2.24.png", region: figure24Region, sha256: "16b5f5fc35e165711ce0de9b6de624dbe6a3c700095371d26005c1b99c07bb70" }],
};

await mkdir(unitDirectory, { recursive: true });
await mkdir(assetDirectory, { recursive: true });
await mkdir(figureDirectory, { recursive: true });
await Promise.all([
    copyFile(join(evidenceRenderDirectory, "page-0133-x170-y575-w270-h95@4x.png"), join(figureDirectory, "figc4.2.24.png")),
    writeFile(join(unitDirectory, `${unitNumber.toLowerCase()}.json`), `${JSON.stringify(unit, null, 2)}\n`, "utf8"),
    writeFile(join(assetDirectory, "C4.2-step2p.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8"),
]);
console.log("Circolare C4.2 step2p: generate 1 unità, 1 formula e 1 figura.");
