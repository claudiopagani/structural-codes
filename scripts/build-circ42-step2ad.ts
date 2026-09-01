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
function evidence(page: number, raw: string, normalized: string, region: Region, manual = false) { return { sourceId, pdfPage: page, printedPage: String(page - 4), region, extraction: { method: manual ? "manual-transcription" : "pdf-text", tool: manual ? "codex-source-transcription" : "pdfjs-dist", toolVersion: manual ? profile : "4.10.38" }, transformations: [{ operation: "join-line-wrap", ruleVersion: profile, note: "Ricomposte le righe tipografiche appartenenti allo stesso capoverso; le formule restano blocchi distinti." }, ...(raw !== normalized ? [{ operation: "manual-correction", ruleVersion: profile, note: "Ripristinati accenti, apostrofi, simboli e notazione matematica confrontati con il render ufficiale." }] : []), { operation: "unicode-nfc", ruleVersion: profile, note: "Testo normalizzato in Unicode NFC." }], rawSha256: hash(raw), normalizedSha256: hash(normalized) }; }
function block(number: string, suffix: string, kind: Exclude<BlockKind, "formula-ref">, page: number, normalized: string, inline: Inline[], region: Region): GeneratedBlock { return { blockId: uid(number) + "#block-" + suffix, kind, origin: "official", text: { raw: normalized, normalized, normalizationVersion: profile, inline }, evidence: evidence(page, normalized, normalized, region) }; }
function formulaBlock(number: string, suffix: string, formula: FormulaRow): GeneratedBlock { return { blockId: uid(number) + "#block-" + suffix, kind: "formula-ref", origin: "official", assetId: formulaId(formula.number), evidence: evidence(formula.page, formula.raw, formula.raw, formula.region, true) }; }

const formula154: FormulaRow = { number: "C4.2.154", page: 145, latex: "\\begin{aligned}F_{b,Rd}&=\\frac{2{,}7\\cdot f_{tk}\\cdot d_s\\cdot\\sqrt{t}}{\\gamma_{M2}}&&\\text{per }t\\le t_1\\le2{,}5\\cdot t\\\\F_{b,Rd}&=\\min\\left(\\frac{2{,}7\\cdot f_{tk}\\cdot d_s\\cdot\\sqrt{t}}{\\gamma_{M2}};\\frac{0{,}7\\cdot f_{tk}\\cdot d_s^2}{\\gamma_{M2}};\\frac{3{,}1\\cdot f_{tk}\\cdot d_s\\cdot t}{\\gamma_{M2}}\\right)&&\\text{per }t_1>2{,}5\\cdot t\\end{aligned}", raw: "F_b,Rd = 2,7·f_tk·d_s·√t/γ_M2 per t ≤ t_1 ≤ 2,5·t; F_b,Rd = min(2,7·f_tk·d_s·√t/γ_M2; 0,7·f_tk·d_s²/γ_M2; 3,1·f_tk·d_s·t/γ_M2) per t_1 > 2,5·t [C4.2.154]", region: reg(145, 250, 325, 80) };
const formula155: FormulaRow = { number: "C4.2.155", page: 145, latex: "F_{t,Rd}=\\frac{1{,}4\\cdot f_{tk}\\cdot e_1\\cdot t}{\\gamma_{M2}}", raw: "F_t,Rd = 1,4·f_tk·e_1·t/γ_M2 [C4.2.155]", region: reg(145, 330, 325, 45) };
const formula156: FormulaRow = { number: "C4.2.156", page: 145, latex: "F_{n,Rd}=\\frac{A_{net}\\cdot f_{tk}}{\\gamma_{M2}}", raw: "F_n,Rd = A_net·f_tk/γ_M2 [C4.2.156]", region: reg(145, 380, 325, 45) };
const formula157: FormulaRow = { number: "C4.2.157", page: 145, latex: "F_{v,Rd}=\\frac{0{,}25\\cdot\\pi\\cdot d_s^2\\cdot f_{tk}}{\\gamma_{M2}}", raw: "F_v,Rd = 0,25·π·d_s²·f_tk/γ_M2 [C4.2.157]", region: reg(145, 425, 325, 45) };
const formula158: FormulaRow = { number: "C4.2.158", page: 145, latex: "2\\cdot d_s\\le e_1\\le6\\cdot d_s\\ ;\\quad3\\cdot d_s\\le p_1\\le8\\cdot d_s\\ ;\\quad1{,}5\\cdot d_s\\le e_2\\le4\\cdot d_s\\ ;\\quad3\\cdot d_s\\le p_2\\le6\\cdot d_s", raw: "2·d_s ≤ e_1 ≤ 6·d_s; 3·d_s ≤ p_1 ≤ 8·d_s; 1,5·d_s ≤ e_2 ≤ 4·d_s; 3·d_s ≤ p_2 ≤ 6·d_s [C4.2.158]", region: reg(145, 475, 325, 45) };

const unit76 = "C4.2.12.1.7.6";
const unit761 = "C4.2.12.1.7.6.1";
const blocks76: GeneratedBlock[] = [
  block(unit76, "heading", "heading", 145, "C4.2.12.1.7.6. Saldature per punti (a resistenza o per fusione)", [text("C4.2.12.1.7.6. Saldature per punti (a resistenza o per fusione)")], reg(73.9, 165, 450, 25)),
];
const blocks761: GeneratedBlock[] = [
  block(unit761, "heading", "heading", 145, "C4.2.12.1.7.6.1. Saldature per punti soggette a taglio", [text("C4.2.12.1.7.6.1. Saldature per punti soggette a taglio")], reg(73.9, 195, 450, 25)),
  block(unit761, "p1", "paragraph", 145, "La resistenza a rifollamento è data da", [text("La resistenza a rifollamento è data da")], reg(73.9, 225, 450, 20)),
  formulaBlock(unit761, "formula-154", formula154),
  block(unit761, "p2", "paragraph", 145, "con t espresso in mm.", [text("con "), math("t", "t"), text(" espresso in mm.")], reg(73.9, 335, 450, 20)),
  block(unit761, "p3", "paragraph", 145, "La resistenza allo strappamento della lamiera collegata è data da", [text("La resistenza allo strappamento della lamiera collegata è data da")], reg(73.9, 360, 450, 25)),
  formulaBlock(unit761, "formula-155", formula155),
  block(unit761, "p4", "paragraph", 145, "La resistenza a trazione della sezione netta è data da", [text("La resistenza a trazione della sezione netta è data da")], reg(73.9, 410, 450, 25)),
  formulaBlock(unit761, "formula-156", formula156),
  block(unit761, "p5", "paragraph", 145, "La resistenza a taglio dei punti è data da", [text("La resistenza a taglio dei punti è data da")], reg(73.9, 455, 450, 25)),
  formulaBlock(unit761, "formula-157", formula157),
  block(unit761, "p6", "paragraph", 145, "Le formule [C4.2.154], [C4.2.155], [C4.2.156], e [C4.2.157] per saldature per punti sono valide per geometrie del collegamento che rispettino le condizioni", [text("Le formule [C4.2.154], [C4.2.155], [C4.2.156], e [C4.2.157] per saldature per punti sono valide per geometrie del collegamento che rispettino le condizioni")], reg(73.9, 505, 450, 35)),
  formulaBlock(unit761, "formula-158", formula158),
  block(unit761, "p7", "paragraph", 145, "dove d_s=0,5·t+5 mm per punti di fusione e d_s=5·t^0,5, t in mm, per punti a resistenza.", [text("dove "), math("d_s=0,5·t+5 mm", "d_s=0{,}5\\cdot t+5\\,\\mathrm{mm}"), text(" per punti di fusione e "), math("d_s=5·t^0,5", "d_s=5\\cdot t^{0{,}5}"), text(", "), math("t", "t"), text(" in mm, per punti a resistenza.")], reg(73.9, 560, 450, 30)),
];

function makeUnit(number: string, title: string, parentId: string | null, ancestors: string[], position: number, blocks: GeneratedBlock[], formulaIds: string[]) {
  return { $schema: "urn:structural-codes:schema:canonical-unit:v2", schemaVersion: "2.0.0-alpha.2", recordType: "canonical-unit", id: uid(number), workId, expressionId, kind: "subparagraph", numbering: { official: number, sortKey: number.replace(/^C/, "").split(".").map((part) => part.padStart(3, "0")).join(".") }, title, titleBlockId: uid(number) + "#block-heading", hierarchy: { parentId, ancestorIds: ancestors, position }, validity: { from: null, to: null, status: "unknown", asOf: "2026-08-09" }, blocks, citations: [], relations: [], assets: { formulaIds, tableIds: [], figureIds: [] }, workflow: { status: "extracted", createdBy: { actorId: "codex:circ42-step2ad", kind: "automated-agent", toolVersion: profile }, createdAt, reviews: [], openIssues: [{ issueId: "circ2019-" + number.replaceAll(".", "-") + "-source-review", type: "normalization-review", severity: "blocking", note: "Record trascritto dall’evidence ufficiale ma non ancora confrontato integralmente da un revisore umano con il render della pagina fonte." }, ...(formulaIds.length ? [{ issueId: "circ2019-" + number.replaceAll(".", "-") + "-assets-review", type: "asset-review", severity: "blocking", note: "Le formule del blocco richiedono revisione umana indipendente." }] : [])] } };
}

const formulaRows = [formula154, formula155, formula156, formula157, formula158];
const records = [
  makeUnit(unit76, "Saldature per punti (a resistenza o per fusione)", uid("C4.2.12.1.7"), [uid("C4.2"), uid("C4.2.12"), uid("C4.2.12.1"), uid("C4.2.12.1.7")], 6, blocks76, []),
  makeUnit(unit761, "Saldature per punti soggette a taglio", uid(unit76), [uid("C4.2"), uid("C4.2.12"), uid("C4.2.12.1"), uid("C4.2.12.1.7"), uid(unit76)], 1, blocks761, formulaRows.map((formula) => formulaId(formula.number))),
];
const manifest = { $schema: "urn:structural-codes:schema:asset-manifest:v2", schemaVersion: "2.0.0-alpha.1", recordType: "asset-manifest", document: "circ2019", section: "C4.2-step2ad", sourceId, status: "transcribed-unreviewed", formulas: formulaRows.map((formula) => ({ id: formulaId(formula.number), unitId: uid(unit761), officialNumber: formula.number, pdfPage: formula.page, latex: formula.latex })), tables: [], figures: [] };
await mkdir(unitDirectory, { recursive: true });
await mkdir(assetDirectory, { recursive: true });
await Promise.all([...records.map((record) => writeFile(join(unitDirectory, record.numbering.official.toLowerCase() + ".json"), JSON.stringify(record, null, 2) + "\n", "utf8")), writeFile(join(assetDirectory, "C4.2-step2ad.json"), JSON.stringify(manifest, null, 2) + "\n", "utf8")]);
console.log("Circolare C4.2 step2ad: generate 2 unità e 5 formule.");
