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
      ...(raw !== normalized ? [{ operation: "manual-correction", ruleVersion: profile, note: "Ripristinati accenti, apostrofi, simboli e notazione matematica confrontati con il render ufficiale." }] : []),
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

const formula142: FormulaRow = { number: "C4.2.142", page: 144, latex: "F_{b,Rd}=\\frac{3{,}2\\,f_{tk}\\,d\\,t}{\\gamma_{M2}}", raw: "F_b,Rd = 3,2·f_tk·d·t/γ_M2 [C4.2.142]", region: reg(145, 170, 325, 45) };
const formula143: FormulaRow = { number: "C4.2.143", page: 144, latex: "F_{n,Rd}=\\frac{A_{net}\\,f_{tk}}{\\gamma_{M2}}", raw: "F_n,Rd = A_net·f_tk/γ_M2 [C4.2.143]", region: reg(145, 215, 325, 45) };
const formula144: FormulaRow = { number: "C4.2.144", page: 144, latex: "F_{p,Rd}=\\frac{f_{tk}\\,d_w\\,t}{\\gamma_{M2}}", raw: "F_p,Rd = f_tk·d_w·t/γ_M2 [C4.2.144]", region: reg(145, 255, 325, 45) };
const formula145: FormulaRow = { number: "C4.2.145", page: 144, latex: "3{,}7\\,\\mathrm{mm}\\le d\\le6\\,\\mathrm{mm}", raw: "3,7 mm ≤ d ≤ 6 mm [C4.2.145]", region: reg(145, 305, 325, 40) };
const formula146: FormulaRow = { number: "C4.2.146", page: 144, latex: "\\begin{aligned}&e_1\\ge4{,}5\\,d\\ ;\\quad p_1\\ge4{,}5\\,d\\ ;\\quad e_2\\ge4{,}5\\,d\\ ;\\quad p_2\\ge4{,}5\\,d\\\\&\\text{per }d=3{,}7\\,\\mathrm{mm}:t^*\\ge4\\,\\mathrm{mm};\\quad\\text{per }d=4{,}5\\,\\mathrm{mm}:t^*\\ge6\\,\\mathrm{mm};\\quad\\text{per }d=5{,}2\\,\\mathrm{mm}:t^*\\ge8\\,\\mathrm{mm}\\end{aligned}", raw: "e_1 ≥ 4,5·d; p_1 ≥ 4,5·d; e_2 ≥ 4,5·d; p_2 ≥ 4,5·d; per d=3,7 mm t*≥4 mm; per d=4,5 mm t*≥6 mm; per d=5,2 mm t*≥8 mm [C4.2.146]", region: reg(145, 335, 325, 65) };
const formula147: FormulaRow = { number: "C4.2.147", page: 144, latex: "0{,}5\\,\\mathrm{mm}\\le t\\le1{,}5\\,\\mathrm{mm}\\quad\\text{e}\\quad t^*\\ge6\\,\\mathrm{mm}", raw: "0,5 mm ≤ t ≤ 1,5 mm e t* ≥ 6 mm [C4.2.147]", region: reg(145, 385, 325, 45) };

const unit73 = "C4.2.12.1.7.3";
const unit731 = "C4.2.12.1.7.3.1";
const blocks73: GeneratedBlock[] = [
  block(unit73, "heading", "heading", 144, "C4.2.12.1.7.3. Chiodi sparati", [text("C4.2.12.1.7.3. Chiodi sparati")], reg(73.9, 125, 450, 25)),
];
const blocks731: GeneratedBlock[] = [
  block(unit731, "heading", "heading", 144, "C4.2.12.1.7.3.1. Chiodi sparati soggetti a taglio", [text("C4.2.12.1.7.3.1. Chiodi sparati soggetti a taglio")], reg(73.9, 150, 450, 25)),
  block(unit731, "p1", "paragraph", 144, "La resistenza a rifollamento è data da", [text("La resistenza a rifollamento è data da")], reg(73.9, 180, 450, 20)),
  formulaBlock(unit731, "formula-142", formula142),
  block(unit731, "p2", "paragraph", 144, "La resistenza a trazione della sezione netta è data da", [text("La resistenza a trazione della sezione netta è data da")], reg(73.9, 225, 450, 25)),
  formulaBlock(unit731, "formula-143", formula143),
  block(unit731, "p3", "paragraph", 144, "La resistenza all’imbutitura delle lamiere collegate è data da", [text("La resistenza all’imbutitura delle lamiere collegate è data da")], reg(73.9, 265, 450, 25)),
  formulaBlock(unit731, "formula-144", formula144),
  block(unit731, "p4", "paragraph", 144, "Questo valore è da ridurre al 50% quando questi chiodi sono adottati per collegamenti impegnati dagli effetti del vento.", [text("Questo valore è da ridurre al 50% quando questi chiodi sono adottati per collegamenti impegnati dagli effetti del vento.")], reg(73.9, 310, 450, 30)),
  block(unit731, "p5", "paragraph", 144, "Le formule [C4.2.142], [C4.2.143] e [C4.2.144] per chiodi sparati sono valide per diametri d compresi nell’intervallo", [text("Le formule [C4.2.142], [C4.2.143] e [C4.2.144] per chiodi sparati sono valide per diametri "), math("d", "d"), text(" compresi nell’intervallo")], reg(73.9, 345, 450, 30)),
  formulaBlock(unit731, "formula-145", formula145),
  block(unit731, "p6", "paragraph", 144, "e per geometrie del collegamento che rispettino le condizioni", [text("e per geometrie del collegamento che rispettino le condizioni")], reg(73.9, 385, 450, 25)),
  formulaBlock(unit731, "formula-146", formula146),
  block(unit731, "p7", "paragraph", 144, "I collegamenti con chiodi tesi devono soddisfare, inoltre,", [text("I collegamenti con chiodi tesi devono soddisfare, inoltre,")], reg(73.9, 455, 450, 25)),
  formulaBlock(unit731, "formula-147", formula147),
  block(unit731, "p8", "paragraph", 144, "Informazioni sulla resistenza a taglio, a trazione, allo sfilamento ecc. dei chiodi sparati devono essere dedotte sperimentalmente, con adeguata base statistica (EOTA), sulle specifiche produzioni.", [text("Informazioni sulla resistenza a taglio, a trazione, allo sfilamento ecc. dei chiodi sparati devono essere dedotte sperimentalmente, con adeguata base statistica (EOTA), sulle specifiche produzioni.")], reg(73.9, 505, 450, 35)),
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
    workflow: { status: "extracted", createdBy: { actorId: "codex:circ42-step2aa", kind: "automated-agent", toolVersion: profile }, createdAt, reviews: [], openIssues: [{ issueId: "circ2019-" + number.replaceAll(".", "-") + "-source-review", type: "normalization-review", severity: "blocking", note: "Record trascritto dall’evidence ufficiale ma non ancora confrontato integralmente da un revisore umano con i render delle pagine fonte." }, ...(formulaIds.length ? [{ issueId: "circ2019-" + number.replaceAll(".", "-") + "-assets-review", type: "asset-review", severity: "blocking", note: "Le formule del blocco richiedono revisione umana indipendente." }] : [])] },
  };
}

const formulaRows = [formula142, formula143, formula144, formula145, formula146, formula147];
const records = [
  makeUnit(unit73, "Chiodi sparati", uid("C4.2.12.1.7"), [uid("C4.2"), uid("C4.2.12"), uid("C4.2.12.1"), uid("C4.2.12.1.7")], 3, blocks73, []),
  makeUnit(unit731, "Chiodi sparati soggetti a taglio", uid(unit73), [uid("C4.2"), uid("C4.2.12"), uid("C4.2.12.1"), uid("C4.2.12.1.7"), uid(unit73)], 1, blocks731, formulaRows.map((formula) => formulaId(formula.number))),
];
const manifest = { $schema: "urn:structural-codes:schema:asset-manifest:v2", schemaVersion: "2.0.0-alpha.1", recordType: "asset-manifest", document: "circ2019", section: "C4.2-step2aa", sourceId, status: "transcribed-unreviewed", formulas: formulaRows.map((formula) => ({ id: formulaId(formula.number), unitId: uid(unit731), officialNumber: formula.number, pdfPage: formula.page, latex: formula.latex })), tables: [], figures: [] };
await mkdir(unitDirectory, { recursive: true });
await mkdir(assetDirectory, { recursive: true });
await Promise.all([...records.map((record) => writeFile(join(unitDirectory, record.numbering.official.toLowerCase() + ".json"), JSON.stringify(record, null, 2) + "\n", "utf8")), writeFile(join(assetDirectory, "C4.2-step2aa.json"), JSON.stringify(manifest, null, 2) + "\n", "utf8")]);
console.log("Circolare C4.2 step2aa: generate 2 unità e 6 formule.");
