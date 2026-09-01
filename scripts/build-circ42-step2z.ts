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
type FormulaRow = { number: string; page: number; latex: string; raw: string; region: Region };
type BlockKind = "heading" | "paragraph" | "formula-ref";
type GeneratedBlock = { blockId: string; kind: BlockKind; origin: "official"; text?: { raw: string; normalized: string; normalizationVersion: string; inline: Inline[] }; evidence: { rawSha256: string; normalizedSha256: string; [key: string]: unknown }; assetId?: string };

const uid = (number: string) => "urn:structural-codes:it:unit:circ2019:" + number.toLowerCase();
const formulaId = (number: string) => "urn:structural-codes:it:asset:formula:circ2019:" + number.toLowerCase();
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
      { operation: "join-line-wrap", ruleVersion: profile, note: "Ricomposte le righe tipografiche appartenenti allo stesso capoverso; le formule restano blocchi distinti." },
      ...(raw !== normalized ? [{ operation: "manual-correction", ruleVersion: profile, note: "Ripristinati accenti, apostrofi, simboli e notazione matematica confrontati con i render ufficiali." }] : []),
      { operation: "unicode-nfc", ruleVersion: profile, note: "Testo normalizzato in Unicode NFC." },
    ],
    rawSha256: hash(raw),
    normalizedSha256: hash(normalized),
  };
}

function block(number: string, suffix: string, kind: Exclude<BlockKind, "formula-ref">, page: number, normalized: string, inline: Inline[], region: Region): GeneratedBlock {
  return { blockId: uid(number) + "#block-" + suffix, kind, origin: "official", text: { raw: normalized, normalized, normalizationVersion: profile, inline }, evidence: evidence(page, normalized, normalized, region) };
}

function formulaBlock(number: string, suffix: string, formula: FormulaRow): GeneratedBlock {
  return { blockId: uid(number) + "#block-" + suffix, kind: "formula-ref", origin: "official", assetId: formulaId(formula.number), evidence: evidence(formula.page, formula.raw, formula.raw, formula.region, true) };
}

const formula133: FormulaRow = { number: "C4.2.133", page: 143, latex: "F_{b,Rd}=\\frac{\\alpha\\cdot f_{tk}\\cdot d\\cdot t}{\\gamma_{M2}}", raw: "F_b,Rd = α·f_tk·d·t/γ_M2 [C4.2.133]", region: reg(145, 285, 325, 45) };
const formula134: FormulaRow = { number: "C4.2.134", page: 143, latex: "\\begin{aligned}\\alpha&=3{,}6\\cdot\\sqrt{\\frac{t}{d}}\\le2{,}1&&\\text{per }t_1=t\\text{ oppure per }t_1\\ge2{,}5\\cdot t\\text{ e }t<1\\,\\mathrm{mm}\\\\\\alpha&=2{,}1&&\\text{per }t_1\\ge2{,}5\\cdot t\\text{ e }t\\ge1\\,\\mathrm{mm}\\end{aligned}", raw: "α = 3,6·√(t/d) ≤ 2,1 per t_1 = t oppure per t_1 ≥ 2,5·t e t < 1 mm; α = 2,1 per t_1 ≥ 2,5·t e t ≥ 1 mm [C4.2.134]", region: reg(145, 330, 325, 70) };
const formula135: FormulaRow = { number: "C4.2.135", page: 143, latex: "F_{t,Rd}=\\frac{f_{tk}\\cdot e_1\\cdot t}{1{,}2\\cdot\\gamma_{M2}}", raw: "F_t,Rd = f_tk·e_1·t/(1,2·γ_M2) [C4.2.135]", region: reg(145, 410, 325, 45) };
const formula136: FormulaRow = { number: "C4.2.136", page: 143, latex: "F_{n,Rd}=\\frac{A_{net}\\cdot f_{tk}}{\\gamma_{M2}}", raw: "F_n,Rd = A_net·f_tk/γ_M2 [C4.2.136]", region: reg(145, 455, 325, 45) };
const formula137: FormulaRow = { number: "C4.2.137", page: 143, latex: "F_{p,Rd}=\\frac{f_{tk}\\cdot d_w\\cdot t}{\\gamma_{M2}}", raw: "F_p,Rd = f_tk·d_w·t/γ_M2 [C4.2.137]", region: reg(145, 510, 325, 45) };
const formula138: FormulaRow = { number: "C4.2.138", page: 143, latex: "\\begin{aligned}F_{0,Rd}&=\\frac{0{,}45\\cdot t\\cdot d\\cdot f_{tk}}{\\gamma_{M2}}&&\\text{per }t_1<s\\\\F_{0,Rd}&=\\frac{0{,}65\\cdot t\\cdot d\\cdot f_{tk}}{\\gamma_{M2}}&&\\text{per }t_1\\ge s\\end{aligned}", raw: "F_0,Rd = 0,45·t·d·f_tk/γ_M2 per t_1 < s; F_0,Rd = 0,65·t·d·f_tk/γ_M2 per t_1 ≥ s [C4.2.138]", region: reg(145, 560, 325, 70) };
const formula139: FormulaRow = { number: "C4.2.139", page: 143, latex: "3\\,\\mathrm{mm}\\le d\\le8\\,\\mathrm{mm}", raw: "3 mm ≤ d ≤ 8 mm [C4.2.139]", region: reg(145, 645, 325, 40) };
const formula140: FormulaRow = { number: "C4.2.140", page: 143, latex: "e_1\\ge3{,}0\\cdot d\\ ;\\quad p_1\\ge3\\cdot d\\ ;\\quad e_2\\ge1{,}5\\cdot d\\ ;\\quad p_2\\ge3\\cdot d", raw: "e_1 ≥ 3,0·d; p_1 ≥ 3·d; e_2 ≥ 1,5·d; p_2 ≥ 3·d [C4.2.140]", region: reg(145, 685, 325, 45) };
const formula141: FormulaRow = { number: "C4.2.141", page: 143, latex: "0{,}5\\,\\mathrm{mm}\\le t\\le1{,}5\\,\\mathrm{mm}\\quad\\text{e}\\quad t_1\\ge0{,}9\\,\\mathrm{mm}", raw: "0,5 mm ≤ t ≤ 1,5 mm e t_1 ≥ 0,9 mm [C4.2.141]", region: reg(145, 725, 325, 45) };

const unit72 = "C4.2.12.1.7.2";
const unit721 = "C4.2.12.1.7.2.1";
const unit722 = "C4.2.12.1.7.2.2";

const blocks72: GeneratedBlock[] = [
  block(unit72, "heading", "heading", 143, "C4.2.12.1.7.2. Viti autofilettanti e automaschianti", [text("C4.2.12.1.7.2. Viti autofilettanti e automaschianti")], reg(73.9, 230, 450, 25)),
];

const blocks721: GeneratedBlock[] = [
  block(unit721, "heading", "heading", 143, "C4.2.12.1.7.2.1. Viti autofilettanti o automaschianti soggette a taglio", [text("C4.2.12.1.7.2.1. Viti autofilettanti o automaschianti soggette a taglio")], reg(73.9, 255, 450, 25)),
  block(unit721, "p1", "paragraph", 143, "La resistenza a rifollamento è data da", [text("La resistenza a rifollamento è data da")], reg(73.9, 285, 450, 20)),
  formulaBlock(unit721, "formula-133", formula133),
  block(unit721, "p2", "paragraph", 143, "dove", [text("dove")], reg(73.9, 325, 80, 20)),
  formulaBlock(unit721, "formula-134", formula134),
  block(unit721, "p3", "paragraph", 143, "nei casi intermedi (t ≤ t_1<2,5 t) α può essere determinato per interpolazione lineare.", [text("nei casi intermedi ("), math("t ≤ t_1<2,5 t", "t\\le t_1<2{,}5\\,t"), text(") "), math("α", "\\alpha"), text(" può essere determinato per interpolazione lineare.")], reg(73.9, 405, 450, 25)),
  block(unit721, "p4", "paragraph", 143, "La resistenza allo strappo della lamiera collegata è data da", [text("La resistenza allo strappo della lamiera collegata è data da")], reg(73.9, 435, 450, 25)),
  formulaBlock(unit721, "formula-135", formula135),
  block(unit721, "p5", "paragraph", 143, "essendo e_1 indicato in Figura C4.2.34.", [text("essendo "), math("e_1", "e_1"), text(" indicato in Figura C4.2.34.")], reg(73.9, 475, 450, 20)),
  block(unit721, "p6", "paragraph", 143, "La resistenza a trazione della sezione netta è data da", [text("La resistenza a trazione della sezione netta è data da")], reg(73.9, 500, 450, 20)),
  formulaBlock(unit721, "formula-136", formula136),
];

const blocks722: GeneratedBlock[] = [
  block(unit722, "heading", "heading", 143, "C4.2.12.1.7.2.2. Viti autofilettanti o automaschianti soggette a trazione", [text("C4.2.12.1.7.2.2. Viti autofilettanti o automaschianti soggette a trazione")], reg(73.9, 540, 450, 25)),
  block(unit722, "p1", "paragraph", 143, "La resistenza all’imbutitura delle lamiere collegate è data da", [text("La resistenza all’imbutitura delle lamiere collegate è data da")], reg(73.9, 565, 450, 25)),
  formulaBlock(unit722, "formula-137", formula137),
  block(unit722, "p2", "paragraph", 143, "Questo valore è da ridurre al 50% quando queste viti sono adottate per collegamenti impegnati dagli effetti del vento.", [text("Questo valore è da ridurre al 50% quando queste viti sono adottate per collegamenti impegnati dagli effetti del vento.")], reg(73.9, 615, 450, 30)),
  block(unit722, "p3", "paragraph", 143, "La resistenza allo sfilamento (strappo della filettatura) è data, infine, da", [text("La resistenza allo sfilamento (strappo della filettatura) è data, infine, da")], reg(73.9, 650, 450, 25)),
  formulaBlock(unit722, "formula-138", formula138),
  block(unit722, "p4", "paragraph", 143, "Le formule [C4.2.133], [C4.2.135], [C4.2.136], [C4.2.137] e [C4.2.138] per viti autofilettanti e automaschianti sono valide per diametri d compresi nell’intervallo", [text("Le formule [C4.2.133], [C4.2.135], [C4.2.136], [C4.2.137] e [C4.2.138] per viti autofilettanti e automaschianti sono valide per diametri "), math("d", "d"), text(" compresi nell’intervallo")], reg(73.9, 625, 450, 35)),
  formulaBlock(unit722, "formula-139", formula139),
  block(unit722, "p5", "paragraph", 143, "e per geometrie del collegamento che rispettino le condizioni", [text("e per geometrie del collegamento che rispettino le condizioni")], reg(73.9, 680, 450, 25)),
  formulaBlock(unit722, "formula-140", formula140),
  block(unit722, "p6", "paragraph", 143, "I collegamenti con viti tese devono soddisfare, inoltre,", [text("I collegamenti con viti tese devono soddisfare, inoltre,")], reg(73.9, 715, 450, 25)),
  formulaBlock(unit722, "formula-141", formula141),
  block(unit722, "p7", "paragraph", 144, "Informazioni sulla resistenza a taglio, a trazione, ecc. delle viti autofilettanti o automaschianti devono essere dedotte sperimentalmente, con adeguata base statistica (EOTA), sulle specifiche produzioni.", [text("Informazioni sulla resistenza a taglio, a trazione, ecc. delle viti autofilettanti o automaschianti devono essere dedotte sperimentalmente, con adeguata base statistica (EOTA), sulle specifiche produzioni.")], reg(73.9, 80, 450, 35)),
];

function makeUnit(number: string, title: string, parentId: string | null, ancestors: string[], position: number, blocks: GeneratedBlock[], formulaIds: string[]) {
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
    titleBlockId: uid(number) + "#block-heading",
    hierarchy: { parentId, ancestorIds: ancestors, position },
    validity: { from: null, to: null, status: "unknown", asOf: "2026-08-09" },
    blocks,
    citations: [],
    relations: [],
    assets: { formulaIds, tableIds: [], figureIds: [] },
    workflow: { status: "extracted", createdBy: { actorId: "codex:circ42-step2z", kind: "automated-agent", toolVersion: profile }, createdAt, reviews: [], openIssues: [{ issueId: "circ2019-" + number.replaceAll(".", "-") + "-source-review", type: "normalization-review", severity: "blocking", note: "Record trascritto dall’evidence ufficiale ma non ancora confrontato integralmente da un revisore umano con i render delle pagine fonte." }, ...(formulaIds.length ? [{ issueId: "circ2019-" + number.replaceAll(".", "-") + "-assets-review", type: "asset-review", severity: "blocking", note: "Le formule del blocco richiedono revisione umana indipendente." }] : [])] },
  };
}

const formulas721 = [formula133, formula134, formula135, formula136];
const formulas722 = [formula137, formula138, formula139, formula140, formula141];
const records = [
  makeUnit(unit72, "Viti autofilettanti e automaschianti", uid("C4.2.12.1.7"), [uid("C4.2"), uid("C4.2.12"), uid("C4.2.12.1"), uid("C4.2.12.1.7")], 2, blocks72, []),
  makeUnit(unit721, "Viti autofilettanti o automaschianti soggette a taglio", uid(unit72), [uid("C4.2"), uid("C4.2.12"), uid("C4.2.12.1"), uid("C4.2.12.1.7"), uid(unit72)], 1, blocks721, formulas721.map((formula) => formulaId(formula.number))),
  makeUnit(unit722, "Viti autofilettanti o automaschianti soggette a trazione", uid(unit72), [uid("C4.2"), uid("C4.2.12"), uid("C4.2.12.1"), uid("C4.2.12.1.7"), uid(unit72)], 2, blocks722, formulas722.map((formula) => formulaId(formula.number))),
];
const formulaRows = [...formulas721, ...formulas722];
const manifest = { $schema: "urn:structural-codes:schema:asset-manifest:v2", schemaVersion: "2.0.0-alpha.1", recordType: "asset-manifest", document: "circ2019", section: "C4.2-step2z", sourceId, status: "transcribed-unreviewed", formulas: formulaRows.map((formula) => ({ id: formulaId(formula.number), unitId: uid(formulas721.includes(formula) ? unit721 : unit722), officialNumber: formula.number, pdfPage: formula.page, latex: formula.latex })), tables: [], figures: [] };
await mkdir(unitDirectory, { recursive: true });
await mkdir(assetDirectory, { recursive: true });
await Promise.all([...records.map((record) => writeFile(join(unitDirectory, record.numbering.official.toLowerCase() + ".json"), JSON.stringify(record, null, 2) + "\n", "utf8")), writeFile(join(assetDirectory, "C4.2-step2z.json"), JSON.stringify(manifest, null, 2) + "\n", "utf8")]);
console.log("Circolare C4.2 step2z: generate 3 unità e 9 formule.");
