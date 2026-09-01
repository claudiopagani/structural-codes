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
type FormulaRow = { number: string; page: number; latex: string; raw: string; region: Region };
type BlockKind = "heading" | "paragraph" | "list-item" | "formula-ref" | "figure-ref";
type GeneratedBlock = { blockId: string; kind: BlockKind; origin: "official"; text?: { raw: string; normalized: string; normalizationVersion: string; inline: Inline[] }; evidence: { rawSha256: string; normalizedSha256: string; [key: string]: unknown }; assetId?: string };

const uid = (number: string) => "urn:structural-codes:it:unit:circ2019:" + number.toLowerCase();
const formulaId = (number: string) => "urn:structural-codes:it:asset:formula:circ2019:" + number.toLowerCase();
const figureId = (number: string) => "urn:structural-codes:it:asset:figure:circ2019:" + number.toLowerCase();
const reg = (x: number, y: number, width: number, height: number): Region => ({ coordinateSystem: "pdf-points-top-left", x, y, width, height });
const text = (value: string): Inline => ({ kind: "text", value });
const math = (value: string, latex: string): Inline => ({ kind: "math", value, latex });
const hash = (value: string) => sha256OfText(value);
function evidence(page: number, raw: string, normalized: string, region: Region, manual = false) { return { sourceId, pdfPage: page, printedPage: String(page - 4), region, extraction: { method: manual ? "manual-transcription" : "pdf-text", tool: manual ? "codex-source-transcription" : "pdfjs-dist", toolVersion: manual ? profile : "4.10.38" }, transformations: [{ operation: "join-line-wrap", ruleVersion: profile, note: "Ricomposte le righe tipografiche appartenenti allo stesso capoverso o voce di elenco; formule e figure restano blocchi distinti." }, ...(raw !== normalized ? [{ operation: "manual-correction", ruleVersion: profile, note: "Ripristinati accenti, apostrofi, simboli e notazione matematica confrontati con i render ufficiali." }] : []), { operation: "unicode-nfc", ruleVersion: profile, note: "Testo normalizzato in Unicode NFC." }], rawSha256: hash(raw), normalizedSha256: hash(normalized) }; }
function block(number: string, suffix: string, kind: Exclude<BlockKind, "formula-ref" | "figure-ref">, page: number, normalized: string, inline: Inline[], region: Region): GeneratedBlock { return { blockId: uid(number) + "#block-" + suffix, kind, origin: "official", text: { raw: normalized, normalized, normalizationVersion: profile, inline }, evidence: evidence(page, normalized, normalized, region) }; }
function formulaBlock(number: string, suffix: string, formula: FormulaRow): GeneratedBlock { return { blockId: uid(number) + "#block-" + suffix, kind: "formula-ref", origin: "official", assetId: formulaId(formula.number), evidence: evidence(formula.page, formula.raw, formula.raw, formula.region, true) }; }
function figureBlock(number: string, suffix: string, asset: string, page: number, caption: string, region: Region): GeneratedBlock { return { blockId: uid(number) + "#block-" + suffix, kind: "figure-ref", origin: "official", assetId: asset, evidence: evidence(page, caption, caption, region, true) }; }

const formula159: FormulaRow = { number: "C4.2.159", page: 145, latex: "e_1\\ge\\frac{2{,}1\\cdot F_{w,Sd}\\cdot\\gamma_{M2}}{f_{tk}\\cdot t}", raw: "e_1 ≥ 2,1·F_w,Sd·γ_M2/(f_tk·t) [C4.2.159]", region: reg(145, 690, 325, 45) };
const formula160: FormulaRow = { number: "C4.2.160", page: 146, latex: "F_{w,Sd}=\\frac{0{,}25\\cdot\\pi\\cdot d_s^2\\cdot0{,}625\\cdot f_{tk}}{\\gamma_{M2}}", raw: "F_w,Sd = 0,25·π·d_s²·0,625·f_tk/γ_M2 [C4.2.160]", region: reg(145, 75, 325, 45) };
const formula161: FormulaRow = { number: "C4.2.161", page: 146, latex: "d_s=0{,}7\\cdot d_w-1{,}5\\cdot\\sum t", raw: "d_s = 0,7·d_w − 1,5·Σt [C4.2.161]", region: reg(145, 125, 325, 45) };
const formula162: FormulaRow = { number: "C4.2.162", page: 146, latex: "\\begin{aligned}F_{w,Sd}&\\le\\frac{1{,}5\\cdot d_p\\cdot f_{tk}\\cdot\\sum t}{\\gamma_{M2}}&&\\text{per }\\frac{d_p}{\\sum t}\\le18\\cdot\\sqrt{\\frac{420}{f_{tk}}}\\\\F_{w,Sd}&\\le\\frac{27\\cdot f_{tk}\\cdot(\\sum t)^2}{\\gamma_{M2}}\\cdot\\sqrt{\\frac{420}{f_{tk}}}&&\\text{per }18\\cdot\\sqrt{\\frac{420}{f_{tk}}}\\le\\frac{d_p}{\\sum t}\\le30\\cdot\\sqrt{\\frac{420}{f_{tk}}}\\\\F_{w,Sd}&\\le\\frac{0{,}9\\cdot d_p\\cdot f_{tk}\\cdot\\sum t}{\\gamma_{M2}}&&\\text{per }\\frac{d_p}{\\sum t}>30\\cdot\\sqrt{\\frac{420}{f_{tk}}}\\end{aligned}", raw: "F_w,Sd ≤ 1,5·d_p·f_tk·Σt/γ_M2 per d_p/Σt ≤ 18√(420/f_tk); F_w,Sd ≤ 27·f_tk·(Σt)²/γ_M2·√(420/f_tk) per 18√(420/f_tk) ≤ d_p/Σt ≤ 30√(420/f_tk); F_w,Sd ≤ 0,9·d_p·f_tk·Σt/γ_M2 per d_p/Σt > 30√(420/f_tk) [C4.2.162]", region: reg(145, 175, 325, 105) };
const formula163: FormulaRow = { number: "C4.2.163", page: 146, latex: "F_{w,Sd}=\\frac{\\left(0{,}25\\cdot\\pi\\cdot d_s^2+L_w\\cdot d_s\\right)\\cdot0{,}625\\cdot f_{tk}}{\\gamma_{M2}}", raw: "F_w,Sd = (0,25·π·d_s² + L_w·d_s)·0,625·f_tk/γ_M2 [C4.2.163]", region: reg(145, 305, 325, 50) };
const formula164: FormulaRow = { number: "C4.2.164", page: 146, latex: "F_{w,Sd}\\le\\frac{\\left(0{,}5\\cdot L_w+1{,}67\\cdot d_p\\right)\\cdot f_{tk}\\cdot\\sum t}{\\gamma_{M2}}", raw: "F_w,Sd ≤ (0,5·L_w + 1,67·d_p)·f_tk·Σt/γ_M2 [C4.2.164]", region: reg(145, 360, 325, 50) };
const formula165: FormulaRow = { number: "C4.2.165", page: 146, latex: "d_p=d_w-t", raw: "d_p = d_w − t [C4.2.165]", region: reg(145, 430, 325, 45) };
const formula166: FormulaRow = { number: "C4.2.166", page: 146, latex: "d_p=d_w-2\\cdot\\sum t", raw: "d_p = d_w − 2·Σt [C4.2.166]", region: reg(145, 475, 325, 45) };

const figure36 = figureId("C4.2.36");
const figure36Region = reg(175, 565, 270, 105);
const unit77 = "C4.2.12.1.7.7";
const unit771 = "C4.2.12.1.7.7.1";
const blocks77: GeneratedBlock[] = [
  block(unit77, "heading", "heading", 145, "C4.2.12.1.7.7. Bottoni di saldatura", [text("C4.2.12.1.7.7. Bottoni di saldatura")], reg(73.9, 395, 450, 25)),
  block(unit77, "p1", "paragraph", 145, "I bottoni di saldatura sono previsti per solo impiego a taglio.", [text("I bottoni di saldatura sono previsti per solo impiego a taglio.")], reg(73.9, 425, 450, 25)),
];
const blocks771: GeneratedBlock[] = [
  block(unit771, "heading", "heading", 145, "C4.2.12.1.7.7.1. Bottoni di saldatura soggetti a taglio", [text("C4.2.12.1.7.7.1. Bottoni di saldatura soggetti a taglio")], reg(73.9, 450, 450, 25)),
  block(unit771, "p1", "paragraph", 145, "I bottoni possono essere circolari oppure oblunghi (Figura C4.2.36).", [text("I bottoni possono essere circolari oppure oblunghi (Figura C4.2.36).")], reg(73.9, 480, 450, 25)),
  block(unit771, "p2", "paragraph", 145, "L’applicazione del procedimento è limitata a lamiere aventi spessore totale Σt ≤ 4 mm.", [text("L’applicazione del procedimento è limitata a lamiere aventi spessore totale "), math("Σt ≤ 4 mm", "\\sum t\\le4\\,\\mathrm{mm}"), text(".")], reg(73.9, 510, 450, 25)),
  figureBlock(unit771, "figure-36", figure36, 145, "Figura C4.2.36 – Saldature oblunghe a bottone", figure36Region),
  block(unit771, "p3", "paragraph", 145, "Secondo la direzione della forza trasmessa, la distanza minima tra il centro del bottone ed il bordo libero deve soddisfare la relazione", [text("Secondo la direzione della forza trasmessa, la distanza minima tra il centro del bottone ed il bordo libero deve soddisfare la relazione")], reg(73.9, 675, 450, 35)),
  formulaBlock(unit771, "formula-159", formula159),
  block(unit771, "p4", "paragraph", 146, "dove F_w,Sd è la resistenza a taglio del bottone, che per i bottoni circolari è data da", [text("dove "), math("F_w,Sd", "F_{w,Sd}"), text(" è la resistenza a taglio del bottone, che per i bottoni circolari è data da")], reg(73.9, 70, 450, 30)),
  formulaBlock(unit771, "formula-160", formula160),
  block(unit771, "p5", "paragraph", 146, "Il diametro effettivamente resistente della saldatura a bottone d_s, (fig. C4.2.35), viene determinato con la seguente espressione:", [text("Il diametro effettivamente resistente della saldatura a bottone "), math("d_s", "d_s"), text(", (fig. C4.2.35), viene determinato con la seguente espressione:")], reg(73.9, 120, 450, 35)),
  formulaBlock(unit771, "formula-161", formula161),
  block(unit771, "p6", "paragraph", 146, "con la limitazione d_s ≥0,55 d_w", [text("con la limitazione "), math("d_s ≥0,55 d_w", "d_s\\ge0{,}55\\,d_w")], reg(73.9, 170, 450, 20)),
  block(unit771, "p7", "paragraph", 146, "con d_w diametro di saldatura visibile (figg. C4.2.35 e C4.2.36)", [text("con "), math("d_w", "d_w"), text(" diametro di saldatura visibile (figg. C4.2.35 e C4.2.36)")], reg(73.9, 195, 450, 25)),
  block(unit771, "p8", "paragraph", 146, "con le seguenti limitazioni", [text("con le seguenti limitazioni")], reg(73.9, 225, 450, 20)),
  formulaBlock(unit771, "formula-162", formula162),
  block(unit771, "p9", "paragraph", 146, "e che per i bottoni oblunghi è data da", [text("e che per i bottoni oblunghi è data da")], reg(73.9, 295, 450, 25)),
  formulaBlock(unit771, "formula-163", formula163),
  block(unit771, "p10", "paragraph", 146, "con la limitazione", [text("con la limitazione")], reg(73.9, 350, 450, 20)),
  formulaBlock(unit771, "formula-164", formula164),
  block(unit771, "p11", "paragraph", 146, "essendo L_w indicato in Figura C4.2.36 e l’effettivo diametro periferico d_p di una saldatura a bottone si ottiene con le seguenti espressioni:", [text("essendo "), math("L_w", "L_w"), text(" indicato in Figura C4.2.36 e l’effettivo diametro periferico "), math("d_p", "d_p"), text(" di una saldatura a bottone si ottiene con le seguenti espressioni:")], reg(73.9, 405, 450, 35)),
  block(unit771, "item-1", "list-item", 146, "per un unione a due piastre di spessore minimo t:", [text("per un unione a due piastre di spessore minimo "), math("t", "t"), text(":")], reg(73.9, 445, 450, 25)),
  formulaBlock(unit771, "formula-165", formula165),
  block(unit771, "item-2", "list-item", 146, "per unione di di piastre multipla con spessore totale Σt:", [text("per unione di di piastre multipla con spessore totale "), math("Σt", "\\sum t"), text(":")], reg(73.9, 490, 450, 25)),
  formulaBlock(unit771, "formula-166", formula166),
];

function makeUnit(number: string, title: string, parentId: string | null, ancestors: string[], position: number, blocks: GeneratedBlock[], formulaIds: string[], figureIds: string[]) {
  return { $schema: "urn:structural-codes:schema:canonical-unit:v2", schemaVersion: "2.0.0-alpha.2", recordType: "canonical-unit", id: uid(number), workId, expressionId, kind: "subparagraph", numbering: { official: number, sortKey: number.replace(/^C/, "").split(".").map((part) => part.padStart(3, "0")).join(".") }, title, titleBlockId: uid(number) + "#block-heading", hierarchy: { parentId, ancestorIds: ancestors, position }, validity: { from: null, to: null, status: "unknown", asOf: "2026-08-09" }, blocks, citations: [], relations: [], assets: { formulaIds, tableIds: [], figureIds }, workflow: { status: "extracted", createdBy: { actorId: "codex:circ42-step2ae", kind: "automated-agent", toolVersion: profile }, createdAt, reviews: [], openIssues: [{ issueId: "circ2019-" + number.replaceAll(".", "-") + "-source-review", type: "normalization-review", severity: "blocking", note: "Record trascritto dall’evidence ufficiale ma non ancora confrontato integralmente da un revisore umano con i render delle pagine fonte." }, ...((formulaIds.length || figureIds.length) ? [{ issueId: "circ2019-" + number.replaceAll(".", "-") + "-assets-review", type: "asset-review", severity: "blocking", note: "Le formule e la figura del blocco richiedono revisione umana indipendente." }] : [])] } };
}

const formulaRows = [formula159, formula160, formula161, formula162, formula163, formula164, formula165, formula166];
const records = [
  makeUnit(unit77, "Bottoni di saldatura", uid("C4.2.12.1.7"), [uid("C4.2"), uid("C4.2.12"), uid("C4.2.12.1"), uid("C4.2.12.1.7")], 7, blocks77, [], []),
  makeUnit(unit771, "Bottoni di saldatura soggetti a taglio", uid(unit77), [uid("C4.2"), uid("C4.2.12"), uid("C4.2.12.1"), uid("C4.2.12.1.7"), uid(unit77)], 1, blocks771, formulaRows.map((formula) => formulaId(formula.number)), [figure36]),
];
const manifest = { $schema: "urn:structural-codes:schema:asset-manifest:v2", schemaVersion: "2.0.0-alpha.1", recordType: "asset-manifest", document: "circ2019", section: "C4.2-step2ae", sourceId, status: "transcribed-unreviewed", formulas: formulaRows.map((formula) => ({ id: formulaId(formula.number), unitId: uid(unit771), officialNumber: formula.number, pdfPage: formula.page, latex: formula.latex })), tables: [], figures: [{ id: figure36, unitId: uid(unit771), officialNumber: "C4.2.36", pdfPage: 145, caption: "Figura C4.2.36 – Saldature oblunghe a bottone", alt: "Saldature oblunghe a bottone", imagePath: "figures/circ2019/figc4.2.36.png", region: figure36Region, sha256: "bdcb2aa161b5ed856e19288c18483258a5032ce923ca541f85bcddad9badf333" }] };
await mkdir(unitDirectory, { recursive: true });
await mkdir(assetDirectory, { recursive: true });
await mkdir(figureDirectory, { recursive: true });
await Promise.all([...records.map((record) => writeFile(join(unitDirectory, record.numbering.official.toLowerCase() + ".json"), JSON.stringify(record, null, 2) + "\n", "utf8")), writeFile(join(assetDirectory, "C4.2-step2ae.json"), JSON.stringify(manifest, null, 2) + "\n", "utf8"), copyFile(join(evidenceRenderDirectory, "page-0145-x175-y565-w270-h105@4x.png"), join(figureDirectory, "figc4.2.36.png"))]);
console.log("Circolare C4.2 step2ae: generate 2 unità, 8 formule e 1 figura.");
