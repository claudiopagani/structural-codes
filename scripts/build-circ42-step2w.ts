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
const unitNumber = "C4.2.12.1.5.4.1";

type Region = { coordinateSystem: "pdf-points-top-left"; x: number; y: number; width: number; height: number };
type Inline = { kind: "text" | "math"; value: string; latex?: string };
type FormulaRow = { number: string; page: number; latex: string; raw: string; region: Region };
type BlockKind = "heading" | "paragraph" | "list-item" | "formula-ref" | "figure-ref";
type GeneratedBlock = { blockId: string; kind: BlockKind; origin: "official"; text?: { raw: string; normalized: string; normalizationVersion: string; inline: Inline[] }; evidence: { rawSha256: string; normalizedSha256: string; [key: string]: unknown }; assetId?: string };

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
      { operation: "join-line-wrap", ruleVersion: profile, note: "Ricomposte le righe tipografiche appartenenti allo stesso capoverso o voce di elenco; formule e figure restano blocchi distinti." },
      ...(raw !== normalized ? [{ operation: "manual-correction", ruleVersion: profile, note: "Ripristinati accenti, apostrofi, simboli e notazione matematica confrontati con il render ufficiale." }] : []),
      { operation: "unicode-nfc", ruleVersion: profile, note: "Testo normalizzato in Unicode NFC." },
    ],
    rawSha256: hash(raw),
    normalizedSha256: hash(normalized),
  };
}

function block(suffix: string, kind: Exclude<BlockKind, "formula-ref" | "figure-ref">, page: number, normalized: string, inline: Inline[], region: Region): GeneratedBlock {
  return { blockId: `${uid(unitNumber)}#block-${suffix}`, kind, origin: "official", text: { raw: normalized, normalized, normalizationVersion: profile, inline }, evidence: evidence(page, normalized, normalized, region) };
}

function formulaBlock(suffix: string, formula: FormulaRow): GeneratedBlock {
  return { blockId: `${uid(unitNumber)}#block-${suffix}`, kind: "formula-ref", origin: "official", assetId: formulaId(formula.number), evidence: evidence(formula.page, formula.raw, formula.raw, formula.region, true) };
}

function figureBlock(suffix: string, asset: string, page: number, caption: string, region: Region): GeneratedBlock {
  return { blockId: `${uid(unitNumber)}#block-${suffix}`, kind: "figure-ref", origin: "official", assetId: asset, evidence: evidence(page, caption, caption, region, true) };
}

const formula121: FormulaRow = { number: "C4.2.121", page: 140, latex: "V_{b,Rd}=\\frac{h_w\\cdot t\\cdot f_{bv}}{\\gamma_{M0}\\cdot\\sin\\phi}", raw: "V_b,Rd = h_w·t·f_bv/(γ_M0·sin φ) [C4.2.121]", region: reg(145, 150, 325, 45) };
const formula122: FormulaRow = { number: "C4.2.122", page: 140, latex: "f_{bv}=f_{yk}\\cdot\\chi(\\lambda_w)", raw: "f_bv = f_yk·χ(λ_w) [C4.2.122]", region: reg(145, 215, 325, 45) };
const formula123: FormulaRow = { number: "C4.2.123", page: 140, latex: "\\lambda_w=0{,}346\\cdot\\frac{s_w}{t}\\cdot\\sqrt{\\frac{f_{yk}}{E}}", raw: "λ_w = 0,346·(s_w/t)·√(f_yk/E) [C4.2.123]", region: reg(145, 270, 325, 45) };
const formula124: FormulaRow = { number: "C4.2.124", page: 140, latex: "\\begin{aligned}\\chi&=0{,}58&&\\text{per }\\lambda_w\\le0{,}83\\\\\\chi&=\\frac{0{,}48}{\\lambda_w}&&\\text{per }\\lambda_w>0{,}83\\end{aligned}", raw: "χ = 0,58 per λ_w ≤ 0,83; χ = 0,48/λ_w per λ_w > 0,83 [C4.2.124]", region: reg(145, 425, 325, 60) };
const formula125: FormulaRow = { number: "C4.2.125", page: 140, latex: "\\begin{aligned}\\chi&=0{,}58&&\\text{per }\\lambda_w\\le0{,}83\\\\\\chi&=\\frac{0{,}48}{\\lambda_w}&&\\text{per }0{,}83<\\lambda_w<1{,}40\\\\\\chi&=\\frac{0{,}67}{\\lambda_w^2}&&\\text{per }\\lambda_w\\ge1{,}40\\end{aligned}", raw: "χ = 0,58 per λ_w ≤ 0,83; χ = 0,48/λ_w per 0,83 < λ_w < 1,40; χ = 0,67/λ_w² per λ_w ≥ 1,40 [C4.2.125]", region: reg(145, 500, 325, 80) };

const figure33 = figureId("C4.2.33");
const figure33Region = reg(170, 300, 270, 112);

const blocks: GeneratedBlock[] = [
  block("heading", "heading", 140, "C4.2.12.1.5.4.1. Verifiche di resistenza a taglio", [text("C4.2.12.1.5.4.1. Verifiche di resistenza a taglio")], reg(73.9, 125, 450, 25)),
  block("p1", "paragraph", 140, "La resistenza di calcolo a taglio di un’anima senza irrigidimenti (Figura C4.2.33) è", [text("La resistenza di calcolo a taglio di un’anima senza irrigidimenti (Figura C4.2.33) è")], reg(73.9, 150, 450, 25)),
  formulaBlock("formula-121", formula121),
  block("p2", "paragraph", 140, "dove t è lo spessore dell’anima, h_w è l’altezza dell’anima, φ è l’angolo di inclinazione dell’anima e f_bv è la resistenza alle tensioni tangenziali dell’anima, che tiene conto dell’instabilità locale.", [text("dove "), math("t", "t"), text(" è lo spessore dell’anima, "), math("h_w", "h_w"), text(" è l’altezza dell’anima, "), math("φ", "\\phi"), text(" è l’angolo di inclinazione dell’anima e "), math("f_bv", "f_{bv}"), text(" è la resistenza alle tensioni tangenziali dell’anima, che tiene conto dell’instabilità locale.")], reg(73.9, 195, 450, 35)),
  block("p3", "paragraph", 140, "La resistenza alle tensioni tangenziali è data da", [text("La resistenza alle tensioni tangenziali è data da")], reg(73.9, 235, 450, 25)),
  formulaBlock("formula-122", formula122),
  block("p4", "paragraph", 140, "essendo χ un coefficiente riduttivo, dipendente dalla snellezza adimensionale λ_w dell’anima,", [text("essendo "), math("χ", "\\chi"), text(" un coefficiente riduttivo, dipendente dalla snellezza adimensionale "), math("λ_w", "\\lambda_w"), text(" dell’anima,")], reg(73.9, 260, 450, 25)),
  formulaBlock("formula-123", formula123),
  block("p5", "paragraph", 140, "dove s_w è la lunghezza dell’anima (Figura C4.2.33).", [text("dove "), math("s_w", "s_w"), text(" è la lunghezza dell’anima (Figura C4.2.33).")], reg(73.9, 315, 450, 25)),
  figureBlock("figure-33", figure33, 140, "Figura C4.2.33 – Anime di profili sottili", figure33Region),
  block("p6", "paragraph", 140, "In presenza di irrigidimenti agli appoggi, atti ad incassare la reazione vincolare e a prevenire distorsioni dell’anima, si può assumere", [text("In presenza di irrigidimenti agli appoggi, atti ad incassare la reazione vincolare e a prevenire distorsioni dell’anima, si può assumere")], reg(73.9, 415, 450, 35)),
  formulaBlock("formula-124", formula124),
  block("p7", "paragraph", 140, "in assenza di tali irrigidimenti si ha, invece,", [text("in assenza di tali irrigidimenti si ha, invece,")], reg(73.9, 490, 450, 25)),
  formulaBlock("formula-125", formula125),
  block("p8", "paragraph", 140, "Si rimanda a normative di comprovata validità per problemi particolari, quali:", [text("Si rimanda a normative di comprovata validità per problemi particolari, quali:")], reg(73.9, 585, 450, 25)),
  block("item-1", "list-item", 140, "la resistenza a taglio di anime con irrigidimenti intermedi,", [text("la resistenza a taglio di anime con irrigidimenti intermedi,")], reg(73.9, 610, 450, 20)),
  block("item-2", "list-item", 140, "la resistenza a carichi concentrati (intermedi o di estremità),", [text("la resistenza a carichi concentrati (intermedi o di estremità),")], reg(73.9, 630, 450, 20)),
  block("item-3", "list-item", 140, "la interazione tra taglio e flessione quando l’azione tagliante di calcolo V_Ed>0,5 V_b,Rd,", [text("la interazione tra taglio e flessione quando l’azione tagliante di calcolo "), math("V_Ed>0,5 V_b,Rd", "V_{Ed}>0{,}5\\,V_{b,Rd}"), text(",")], reg(73.9, 650, 450, 35)),
  block("item-4", "list-item", 140, "la interazione tra carichi concentrati e flessione,", [text("la interazione tra carichi concentrati e flessione,")], reg(73.9, 685, 450, 20)),
];

const formulaRows = [formula121, formula122, formula123, formula124, formula125];
const unit = {
  $schema: "urn:structural-codes:schema:canonical-unit:v2",
  schemaVersion: "2.0.0-alpha.2",
  recordType: "canonical-unit",
  id: uid(unitNumber),
  workId,
  expressionId,
  kind: "subparagraph",
  numbering: { official: unitNumber, sortKey: unitNumber.replace(/^C/, "").split(".").map((part) => part.padStart(3, "0")).join(".") },
  title: "Verifiche di resistenza a taglio",
  titleBlockId: `${uid(unitNumber)}#block-heading`,
  hierarchy: { parentId: uid("C4.2.12.1.5.4"), ancestorIds: [uid("C4.2"), uid("C4.2.12"), uid("C4.2.12.1"), uid("C4.2.12.1.5"), uid("C4.2.12.1.5.4")], position: 1 },
  validity: { from: null, to: null, status: "unknown", asOf: "2026-08-09" },
  blocks,
  citations: [],
  relations: [],
  assets: { formulaIds: formulaRows.map((formula) => formulaId(formula.number)), tableIds: [], figureIds: [figure33] },
  workflow: { status: "extracted", createdBy: { actorId: "codex:circ42-step2w", kind: "automated-agent", toolVersion: profile }, createdAt, reviews: [], openIssues: [{ issueId: "circ2019-C4-2-12-1-5-4-1-source-review", type: "normalization-review", severity: "blocking", note: "Record trascritto dal render dell’evidence ufficiale ma non ancora confrontato integralmente da un revisore umano con la pagina fonte." }, { issueId: "circ2019-C4-2-12-1-5-4-1-assets-review", type: "asset-review", severity: "blocking", note: "Le formule C4.2.121–C4.2.125 e la Figura C4.2.33 richiedono revisione umana indipendente." }] },
};

const manifest = {
  $schema: "urn:structural-codes:schema:asset-manifest:v2",
  schemaVersion: "2.0.0-alpha.1",
  recordType: "asset-manifest",
  document: "circ2019",
  section: "C4.2-step2w",
  sourceId,
  status: "transcribed-unreviewed",
  formulas: formulaRows.map((formula) => ({ id: formulaId(formula.number), unitId: uid(unitNumber), officialNumber: formula.number, pdfPage: formula.page, latex: formula.latex })),
  tables: [],
  figures: [{ id: figure33, unitId: uid(unitNumber), officialNumber: "C4.2.33", pdfPage: 140, caption: "Figura C4.2.33 – Anime di profili sottili", alt: "Anime di profili sottili", imagePath: "figures/circ2019/figc4.2.33.png", region: figure33Region, sha256: "193451a389da73fb503ad5d27e61e95184010935550279e3ca3f77d78bf4310a" }],
};

await mkdir(unitDirectory, { recursive: true });
await mkdir(assetDirectory, { recursive: true });
await mkdir(figureDirectory, { recursive: true });
await copyFile(join(evidenceRenderDirectory, "page-0140-x170-y300-w270-h112@4x.png"), join(figureDirectory, "figc4.2.33.png"));
await Promise.all([
  writeFile(join(unitDirectory, `${unitNumber.toLowerCase()}.json`), `${JSON.stringify(unit, null, 2)}\n`, "utf8"),
  writeFile(join(assetDirectory, "C4.2-step2w.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8"),
]);
console.log("Circolare C4.2 step2w: generata 1 unità, 5 formule e 1 figura.");
