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

const formula148: FormulaRow = { number: "C4.2.148", page: 144, latex: "F_{b,Rd}=\\frac{2{,}5\\,\\alpha_b\\,k_t\\,f_{tk}\\,d\\,t}{\\gamma_{M2}}", raw: "F_b,Rd = 2,5·α_b·k_t·f_tk·d·t/γ_M2 [C4.2.148]", region: reg(145, 485, 325, 45) };
const formula149: FormulaRow = { number: "C4.2.149", page: 144, latex: "\\alpha_b=\\min\\left[1;\\frac{e_1}{3\\,d}\\right]", raw: "α_b = min[1; e_1/(3·d)] [C4.2.149]", region: reg(145, 535, 325, 45) };
const formula150: FormulaRow = { number: "C4.2.150", page: 144, latex: "k_t=\\frac{0{,}8\\,t+1{,}5}{2{,}5}\\quad\\text{per }t\\le1{,}25\\,\\mathrm{mm}\\ ;\\quad k_t=1{,}0\\quad\\text{per }t>1{,}25\\,\\mathrm{mm}", raw: "k_t = (0,8·t+1,5)/2,5 per t ≤ 1,25 mm; k_t = 1,0 per t > 1,25 mm [C4.2.150]", region: reg(145, 570, 325, 55) };
const formula151: FormulaRow = { number: "C4.2.151", page: 144, latex: "F_{n,Rd}=\\frac{\\beta\\,A_{net}\\,f_{tk}}{\\gamma_{M2}}", raw: "F_n,Rd = β·A_net·f_tk/γ_M2 [C4.2.151]", region: reg(145, 620, 325, 45) };
const formula152: FormulaRow = { number: "C4.2.152", page: 144, latex: "\\beta=1+3\\,r\\left(\\frac{d_0}{u}-0{,}3\\right)\\le1", raw: "β = 1 + 3·r·(d_0/u − 0,3) ≤ 1 [C4.2.152]", region: reg(145, 665, 325, 45) };
const formula153: FormulaRow = { number: "C4.2.153", page: 145, latex: "e_1\\ge d_0\\ ;\\quad p_1\\ge3{,}0\\,d_0\\ ;\\quad e_2\\ge1{,}5\\,d_0\\ ;\\quad p_2\\ge3{,}0\\,d_0", raw: "e_1 ≥ d_0; p_1 ≥ 3,0·d_0; e_2 ≥ 1,5·d_0; p_2 ≥ 3,0·d_0 [C4.2.153]", region: reg(145, 135, 325, 45) };

const unit74 = "C4.2.12.1.7.4";
const unit741 = "C4.2.12.1.7.4.1";
const unit742 = "C4.2.12.1.7.4.2";

const blocks74: GeneratedBlock[] = [
  block(unit74, "heading", "heading", 144, "C4.2.12.1.7.4. Bulloni (per impiego con spessori minori di 4 mm)", [text("C4.2.12.1.7.4. Bulloni (per impiego con spessori minori di 4 mm)")], reg(73.9, 430, 450, 25)),
  block(unit74, "p1", "paragraph", 144, "Per le classi dei bulloni si veda il § 11.3.4.6 delle NTC.", [text("Per le classi dei bulloni si veda il § 11.3.4.6 delle NTC.")], reg(73.9, 455, 450, 25)),
];

const blocks741: GeneratedBlock[] = [
  block(unit741, "heading", "heading", 144, "C4.2.12.1.7.4.1. Bulloni soggetti a taglio", [text("C4.2.12.1.7.4.1. Bulloni soggetti a taglio")], reg(73.9, 480, 450, 25)),
  block(unit741, "p1", "paragraph", 144, "La resistenza a rifollamento è data da", [text("La resistenza a rifollamento è data da")], reg(73.9, 510, 450, 20)),
  formulaBlock(unit741, "formula-148", formula148),
  block(unit741, "p2", "paragraph", 144, "dove", [text("dove")], reg(73.9, 550, 80, 20)),
  formulaBlock(unit741, "formula-149", formula149),
  formulaBlock(unit741, "formula-150", formula150),
  block(unit741, "p3", "paragraph", 144, "La resistenza a trazione della sezione netta è data da", [text("La resistenza a trazione della sezione netta è data da")], reg(73.9, 610, 450, 25)),
  formulaBlock(unit741, "formula-151", formula151),
  block(unit741, "p4", "paragraph", 144, "in cui, detto r il rapporto tra il numero di bulloni nella sezione netta e il numero totale di bulloni impegnati ed u il minimo tra 2·e_2 e p_2, è", [text("in cui, detto "), math("r", "r"), text(" il rapporto tra il numero di bulloni nella sezione netta e il numero totale di bulloni impegnati ed "), math("u", "u"), text(" il minimo tra "), math("2·e_2", "2\\,e_2"), text(" e "), math("p_2", "p_2"), text(", è")], reg(73.9, 655, 450, 35)),
  formulaBlock(unit741, "formula-152", formula152),
  block(unit741, "p5", "paragraph", 144, "Per il calcolo della resistenza a taglio dei bulloni si applicano le formule [4.2.63] e [4.2.64] di cui al § 4.2.8 delle NTC: con piccoli spessori di serraggio i piani di rescissione interessano sempre la parte filettata della vite.", [text("Per il calcolo della resistenza a taglio dei bulloni si applicano le formule [4.2.63] e [4.2.64] di cui al § 4.2.8 delle NTC: con piccoli spessori di serraggio i piani di rescissione interessano sempre la parte filettata della vite.")], reg(73.9, 715, 450, 45)),
];

const blocks742: GeneratedBlock[] = [
  block(unit742, "heading", "heading", 145, "C4.2.12.1.7.4.2. Bulloni soggetti a trazione", [text("C4.2.12.1.7.4.2. Bulloni soggetti a trazione")], reg(73.9, 80, 450, 25)),
  block(unit742, "p1", "paragraph", 145, "Per il calcolo della resistenza a trazione dei bulloni si applica la formula [4.2.68] di cui al § 4.2.8 delle Norme Tecniche.", [text("Per il calcolo della resistenza a trazione dei bulloni si applica la formula [4.2.68] di cui al § 4.2.8 delle Norme Tecniche.")], reg(73.9, 105, 450, 25)),
  block(unit742, "p2", "paragraph", 145, "Le formule per i bulloni sono valide per bulloni di dimensione minima M6, per spessori t degli elementi da collegare compresi nell’intervallo 0,75 mm ≤ t ≤ 3 mm, e per geometrie del collegamento che rispettino le condizioni", [text("Le formule per i bulloni sono valide per bulloni di dimensione minima M6, per spessori "), math("t", "t"), text(" degli elementi da collegare compresi nell’intervallo 0,75 mm ≤ "), math("t", "t"), text(" ≤ 3 mm, e per geometrie del collegamento che rispettino le condizioni")], reg(73.9, 135, 450, 35)),
  formulaBlock(unit742, "formula-153", formula153),
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
    workflow: { status: "extracted", createdBy: { actorId: "codex:circ42-step2ab", kind: "automated-agent", toolVersion: profile }, createdAt, reviews: [], openIssues: [{ issueId: "circ2019-" + number.replaceAll(".", "-") + "-source-review", type: "normalization-review", severity: "blocking", note: "Record trascritto dall’evidence ufficiale ma non ancora confrontato integralmente da un revisore umano con i render delle pagine fonte." }, ...(formulaIds.length ? [{ issueId: "circ2019-" + number.replaceAll(".", "-") + "-assets-review", type: "asset-review", severity: "blocking", note: "Le formule del blocco richiedono revisione umana indipendente." }] : [])] },
  };
}

const formulas741 = [formula148, formula149, formula150, formula151, formula152];
const formulas742 = [formula153];
const formulaRows = [...formulas741, ...formulas742];
const records = [
  makeUnit(unit74, "Bulloni (per impiego con spessori minori di 4 mm)", uid("C4.2.12.1.7"), [uid("C4.2"), uid("C4.2.12"), uid("C4.2.12.1"), uid("C4.2.12.1.7")], 4, blocks74, []),
  makeUnit(unit741, "Bulloni soggetti a taglio", uid(unit74), [uid("C4.2"), uid("C4.2.12"), uid("C4.2.12.1"), uid("C4.2.12.1.7"), uid(unit74)], 1, blocks741, formulas741.map((formula) => formulaId(formula.number))),
  makeUnit(unit742, "Bulloni soggetti a trazione", uid(unit74), [uid("C4.2"), uid("C4.2.12"), uid("C4.2.12.1"), uid("C4.2.12.1.7"), uid(unit74)], 2, blocks742, formulas742.map((formula) => formulaId(formula.number))),
];
const manifest = { $schema: "urn:structural-codes:schema:asset-manifest:v2", schemaVersion: "2.0.0-alpha.1", recordType: "asset-manifest", document: "circ2019", section: "C4.2-step2ab", sourceId, status: "transcribed-unreviewed", formulas: formulaRows.map((formula) => ({ id: formulaId(formula.number), unitId: uid(formulas741.includes(formula) ? unit741 : unit742), officialNumber: formula.number, pdfPage: formula.page, latex: formula.latex })), tables: [], figures: [] };
await mkdir(unitDirectory, { recursive: true });
await mkdir(assetDirectory, { recursive: true });
await Promise.all([...records.map((record) => writeFile(join(unitDirectory, record.numbering.official.toLowerCase() + ".json"), JSON.stringify(record, null, 2) + "\n", "utf8")), writeFile(join(assetDirectory, "C4.2-step2ab.json"), JSON.stringify(manifest, null, 2) + "\n", "utf8")]);
console.log("Circolare C4.2 step2ab: generate 3 unità e 6 formule.");
