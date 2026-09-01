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
const uid = (number: string) => `urn:structural-codes:it:unit:circ2019:${number.toLowerCase()}`;
const formulaId = (number: string) => `urn:structural-codes:it:asset:formula:circ2019:${number.toLowerCase()}`;
const reg = (x: number, y: number, width: number, height: number): Region => ({ coordinateSystem: "pdf-points-top-left", x, y, width, height });
const text = (value: string): Inline => ({ kind: "text", value });
const math = (value: string, latex: string): Inline => ({ kind: "math", value, latex });
const hash = (value: string) => sha256OfText(value);
function evidence(page: number, raw: string, normalized: string, region: Region, manual = false) { return { sourceId, pdfPage: page, printedPage: String(page - 4), region, extraction: { method: manual ? "manual-transcription" : "pdf-text", tool: manual ? "codex-source-transcription" : "pdfjs-dist", toolVersion: manual ? profile : "4.10.38" }, transformations: [{ operation: "join-line-wrap", ruleVersion: profile, note: "Ricomposte le righe tipografiche appartenenti allo stesso capoverso; le formule restano blocchi distinti." }, ...(raw !== normalized ? [{ operation: "manual-correction", ruleVersion: profile, note: "Ripristinati accenti, apostrofi, simboli e notazione matematica confrontati con i render ufficiali." }] : []), { operation: "unicode-nfc", ruleVersion: profile, note: "Testo normalizzato in Unicode NFC." }], rawSha256: hash(raw), normalizedSha256: hash(normalized) }; }
function block(unitNumber: string, suffix: string, kind: "heading" | "paragraph", page: number, normalized: string, inline: Inline[], region: Region): GeneratedBlock { return { blockId: `${uid(unitNumber)}#block-${suffix}`, kind, origin: "official", text: { raw: normalized, normalized, normalizationVersion: profile, inline }, evidence: evidence(page, normalized, normalized, region) }; }
function formulaBlock(unitNumber: string, suffix: string, formula: FormulaRow): GeneratedBlock { return { blockId: `${uid(unitNumber)}#block-${suffix}`, kind: "formula-ref", origin: "official", assetId: formulaId(formula.number), evidence: evidence(formula.page, formula.raw, formula.raw, formula.region, true) }; }

const parentNumber = "C4.2.12.1.5";
const unit151 = "C4.2.12.1.5.1";
const unit152 = "C4.2.12.1.5.2";
const unit153 = "C4.2.12.1.5.3";
const unit154 = "C4.2.12.1.5.4";
const formula113: FormulaRow = { number: "C4.2.113", page: 139, latex: "N_{t,Rd}=\\frac{A\\cdot f_{myk}}{\\gamma_{M0}}", raw: "N_t,Rd = A·f_myk/γ_M0 [C4.2.113]", region: reg(145, 160, 325, 45) };
const formula114: FormulaRow = { number: "C4.2.114", page: 139, latex: "N_{t,Rd}\\le F_{n,Rd}=\\frac{A_{net}\\cdot f_{tk}}{\\gamma_{M2}}", raw: "N_t,Rd ≤ F_n,Rd = A_net·f_tk/γ_M2 [C4.2.114]", region: reg(145, 250, 325, 45) };
const formula115: FormulaRow = { number: "C4.2.115", page: 139, latex: "N_{c,Rd}=\\frac{A_{eff}\\cdot f_{yk}}{\\gamma_{M0}}", raw: "N_c,Rd = A_eff·f_yk/γ_M0 [C4.2.115]", region: reg(145, 350, 325, 45) };
const formula116: FormulaRow = { number: "C4.2.116", page: 139, latex: "N_{c,Rd}=\\frac{A\\cdot f_{myk}}{\\gamma_{M0}}", raw: "N_c,Rd = A·f_myk/γ_M0 [C4.2.116]", region: reg(145, 400, 325, 45) };
const formula117: FormulaRow = { number: "C4.2.117", page: 139, latex: "M_{c,Rd}=\\frac{W_{eff}\\cdot f_{yk}}{\\gamma_{M0}}", raw: "M_c,Rd = W_eff·f_yk/γ_M0 [C4.2.117]", region: reg(145, 490, 325, 45) };
const formula118: FormulaRow = { number: "C4.2.118", page: 139, latex: "M_{c,Rd}=\\frac{W\\cdot f_{yk}}{\\gamma_{M0}}", raw: "M_c,Rd = W·f_yk/γ_M0 [C4.2.118]", region: reg(145, 545, 325, 45) };
const formula119: FormulaRow = { number: "C4.2.119", page: 139, latex: "\\frac{M_{y,Ed}+\\Delta M_{y,Ed}}{M_{cy,Rd}}+\\frac{M_{z,Ed}+\\Delta M_{z,Ed}}{M_{cz,Rd}}\\pm\\frac{N_{Ed}}{N_{c,Rd}}\\le1", raw: "(M_y,Ed+ΔM_y,Ed)/M_cy,Rd + (M_z,Ed+ΔM_z,Ed)/M_cz,Rd ± N_Ed/N_c,Rd ≤ 1 [C4.2.119]", region: reg(145, 625, 325, 65) };
const formula120: FormulaRow = { number: "C4.2.120", page: 139, latex: "\\frac{M_{y,Ed}}{M_{cy,Rd}}+\\frac{M_{z,Ed}}{M_{cz,Rd}}\\pm\\frac{N_{Ed}}{N_{t,Rd}}\\le1", raw: "M_y,Ed/M_cy,Rd + M_z,Ed/M_cz,Rd ± N_Ed/N_t,Rd ≤ 1 [C4.2.120]", region: reg(145, 720, 325, 55) };

const blocks151: GeneratedBlock[] = [
    block(unit151, "heading", "heading", 139, "C4.2.12.1.5.1. Verifiche di resistenza a trazione", [text("C4.2.12.1.5.1. Verifiche di resistenza a trazione")], reg(73.9, 125, 450, 25)),
    block(unit151, "p1", "paragraph", 139, "La resistenza di calcolo a trazione centrata della sezione lorda è:", [text("La resistenza di calcolo a trazione centrata della sezione lorda è:")], reg(73.9, 150, 450, 25)),
    formulaBlock(unit151, "formula-113", formula113),
    block(unit151, "p2", "paragraph", 139, "dove A è l’area lorda della sezione trasversale e f_myk è il valore della tensione di snervamento media dopo formatura.", [text("dove "), math("A", "A"), text(" è l’area lorda della sezione trasversale e "), math("f_myk", "f_{myk}"), text(" è il valore della tensione di snervamento media dopo formatura.")], reg(73.9, 205, 450, 25)),
    block(unit151, "p3", "paragraph", 139, "La resistenza di calcolo a trazione centrata della sezione lorda N_t,Rd è limitata dalla resistenza di calcolo della sezione netta, indebolita dai fori per i collegamenti di estremità F_n,Rd:", [text("La resistenza di calcolo a trazione centrata della sezione lorda "), math("N_t,Rd", "N_{t,Rd}"), text(" è limitata dalla resistenza di calcolo della sezione netta, indebolita dai fori per i collegamenti di estremità "), math("F_n,Rd", "F_{n,Rd}"), text(":")], reg(73.9, 230, 450, 35)),
    formulaBlock(unit151, "formula-114", formula114),
    block(unit151, "p4", "paragraph", 139, "essendo A_net l’area netta della sezione trasversale indebolita dai fori per i collegamenti di estremità e f_tk la resistenza a rottura dell’acciaio.", [text("essendo "), math("A_net", "A_{net}"), text(" l’area netta della sezione trasversale indebolita dai fori per i collegamenti di estremità e "), math("f_tk", "f_{tk}"), text(" la resistenza a rottura dell’acciaio.")], reg(73.9, 285, 450, 30)),
];
const blocks152: GeneratedBlock[] = [
    block(unit152, "heading", "heading", 139, "C4.2.12.1.5.2. Verifiche di resistenza a compressione", [text("C4.2.12.1.5.2. Verifiche di resistenza a compressione")], reg(73.9, 320, 450, 25)),
    block(unit152, "p1", "paragraph", 139, "La resistenza di calcolo a compressione centrata della sezione lorda è data da", [text("La resistenza di calcolo a compressione centrata della sezione lorda è data da")], reg(73.9, 350, 450, 25)),
    formulaBlock(unit152, "formula-115", formula115),
    block(unit152, "p2", "paragraph", 139, "se l’area efficace A_eff della sezione trasversale è minore dell’area lorda A, e da", [text("se l’area efficace "), math("A_eff", "A_{eff}"), text(" della sezione trasversale è minore dell’area lorda "), math("A", "A"), text(", e da")], reg(73.9, 405, 450, 25)),
    formulaBlock(unit152, "formula-116", formula116),
    block(unit152, "p3", "paragraph", 139, "se l’area efficace A_eff della sezione trasversale è uguale all’area lorda A.", [text("se l’area efficace "), math("A_eff", "A_{eff}"), text(" della sezione trasversale è uguale all’area lorda "), math("A", "A"), text(".")], reg(73.9, 455, 450, 25)),
];
const blocks153: GeneratedBlock[] = [
    block(unit153, "heading", "heading", 139, "C4.2.12.1.5.3. Verifiche di resistenza a flessione", [text("C4.2.12.1.5.3. Verifiche di resistenza a flessione")], reg(73.9, 485, 450, 25)),
    block(unit153, "p1", "paragraph", 139, "La resistenza di calcolo a flessione rispetto ad un asse principale di inerzia è:", [text("La resistenza di calcolo a flessione rispetto ad un asse principale di inerzia è:")], reg(73.9, 515, 450, 25)),
    formulaBlock(unit153, "formula-117", formula117),
    block(unit153, "p2", "paragraph", 139, "se il modulo di resistenza della sezione efficace, W_eff, è minore di quello dell’area lorda W, e da", [text("se il modulo di resistenza della sezione efficace, "), math("W_eff", "W_{eff}"), text(", è minore di quello dell’area lorda "), math("W", "W"), text(", e da")], reg(73.9, 570, 450, 25)),
    formulaBlock(unit153, "formula-118", formula118),
    block(unit153, "p3", "paragraph", 139, "se W_eff=W, salvo più favorevoli indicazioni fornite da normative di comprovata validità.", [text("se "), math("W_eff=W", "W_{eff}=W"), text(", salvo più favorevoli indicazioni fornite da normative di comprovata validità.")], reg(73.9, 625, 450, 25)),
];
const blocks154: GeneratedBlock[] = [
    block(unit154, "heading", "heading", 139, "C4.2.12.1.5.4. Verifiche di resistenza a presso-tenso flessione", [text("C4.2.12.1.5.4. Verifiche di resistenza a presso-tenso flessione")], reg(73.9, 655, 450, 25)),
    block(unit154, "p1", "paragraph", 139, "Nel caso di pressoflessione, la condizione di resistenza è", [text("Nel caso di pressoflessione, la condizione di resistenza è")], reg(73.9, 685, 450, 25)),
    formulaBlock(unit154, "formula-119", formula119),
    block(unit154, "p2", "paragraph", 139, "in cui ΔM_y,Ed e ΔM_z,Ed sono gli eventuali momenti flettenti addizionali dovuti allo spostamento del baricentro della sezione efficace rispetto al baricentro della sezione lorda.", [text("in cui "), math("ΔM_y,Ed e ΔM_z,Ed", "\\Delta M_{y,Ed}\\text{ e }\\Delta M_{z,Ed}"), text(" sono gli eventuali momenti flettenti addizionali dovuti allo spostamento del baricentro della sezione efficace rispetto al baricentro della sezione lorda.")], reg(73.9, 745, 450, 35)),
    block(unit154, "p3", "paragraph", 140, "Nella [C4.2.119] si considera il segno + quando la condizione più sfavorevole per la resistenza a flessione è dettata dalle fibre compresse; si considera il segno − quando la condizione più sfavorevole per la resistenza a flessione è dettata dalle fibre tese (di questa differenza si deve tenere conto anche nella determinazione di M_cy,Rd e di M_cz,Rd).", [text("Nella [C4.2.119] si considera il segno + quando la condizione più sfavorevole per la resistenza a flessione è dettata dalle fibre compresse; si considera il segno − quando la condizione più sfavorevole per la resistenza a flessione è dettata dalle fibre tese (di questa differenza si deve tenere conto anche nella determinazione di "), math("M_cy,Rd", "M_{cy,Rd}"), text(" e di "), math("M_cz,Rd", "M_{cz,Rd}"), text(").")], reg(73.9, 75, 450, 55)),
    block(unit154, "p4", "paragraph", 140, "Nel caso di tensoflessione, la condizione di resistenza è", [text("Nel caso di tensoflessione, la condizione di resistenza è")], reg(73.9, 135, 450, 25)),
    formulaBlock(unit154, "formula-120", formula120),
    block(unit154, "p5", "paragraph", 140, "Si applica il segno + quando la condizione più sfavorevole per la resistenza a flessione è dettata dalle fibre tese; si applica il segno - quando la condizione più sfavorevole per la resistenza a flessione è dettata dalle fibre compresse (di questa differenza si deve tenere conto anche nella determinazione di M_cy,Rd e di M_cz,Rd).", [text("Si applica il segno + quando la condizione più sfavorevole per la resistenza a flessione è dettata dalle fibre tese; si applica il segno - quando la condizione più sfavorevole per la resistenza a flessione è dettata dalle fibre compresse (di questa differenza si deve tenere conto anche nella determinazione di "), math("M_cy,Rd", "M_{cy,Rd}"), text(" e di "), math("M_cz,Rd", "M_{cz,Rd}"), text(").")], reg(73.9, 190, 450, 45)),
];

const parentUnit = { $schema: "urn:structural-codes:schema:canonical-unit:v2", schemaVersion: "2.0.0-alpha.2", recordType: "canonical-unit", id: uid(parentNumber), workId, expressionId, kind: "subparagraph", numbering: { official: parentNumber, sortKey: parentNumber.replace(/^C/, "").split(".").map((part) => part.padStart(3, "0")).join(".") }, title: "Verifiche di resistenza", titleBlockId: `${uid(parentNumber)}#block-heading`, hierarchy: { parentId: uid("C4.2.12.1"), ancestorIds: [uid("C4.2"), uid("C4.2.12"), uid("C4.2.12.1")], position: 5 }, validity: { from: null, to: null, status: "unknown", asOf: "2026-08-09" }, blocks: [block(parentNumber, "heading", "heading", 139, "C4.2.12.1.5. Verifiche di resistenza", [text("C4.2.12.1.5. Verifiche di resistenza")], reg(73.9, 95, 450, 25))], citations: [], relations: [], assets: { formulaIds: [], tableIds: [], figureIds: [] }, workflow: { status: "extracted", createdBy: { actorId: "codex:circ42-step2v", kind: "automated-agent", toolVersion: profile }, createdAt, reviews: [], openIssues: [{ issueId: "circ2019-C4-2-12-1-5-source-review", type: "normalization-review", severity: "blocking", note: "Unità parent trascritta dall’evidence ufficiale; le verifiche figlie contengono il testo e le formule del sottoparagrafo." }] } };

function childUnit(number: string, title: string, position: number, blocks: GeneratedBlock[], formulas: FormulaRow[]) { return { $schema: "urn:structural-codes:schema:canonical-unit:v2", schemaVersion: "2.0.0-alpha.2", recordType: "canonical-unit", id: uid(number), workId, expressionId, kind: "subparagraph", numbering: { official: number, sortKey: number.replace(/^C/, "").split(".").map((part) => part.padStart(3, "0")).join(".") }, title, titleBlockId: `${uid(number)}#block-heading`, hierarchy: { parentId: uid(parentNumber), ancestorIds: [uid("C4.2"), uid("C4.2.12"), uid("C4.2.12.1"), uid(parentNumber)], position }, validity: { from: null, to: null, status: "unknown", asOf: "2026-08-09" }, blocks, citations: [], relations: [], assets: { formulaIds: formulas.map((formula) => formulaId(formula.number)), tableIds: [], figureIds: [] }, workflow: { status: "extracted", createdBy: { actorId: `codex:circ42-step2v-${position}`, kind: "automated-agent", toolVersion: profile }, createdAt, reviews: [], openIssues: [{ issueId: `circ2019-${number.replaceAll(".", "-")}-source-review`, type: "normalization-review", severity: "blocking", note: "Record trascritto dall’evidence ufficiale ma non ancora confrontato integralmente da un revisore umano con i render delle pagine fonte." }, { issueId: `circ2019-${number.replaceAll(".", "-")}-assets-review`, type: "asset-review", severity: "blocking", note: "Le formule del sottoparagrafo richiedono revisione umana indipendente." }] } };
}
const childRecords = [childUnit(unit151, "Verifiche di resistenza a trazione", 1, blocks151, [formula113, formula114]), childUnit(unit152, "Verifiche di resistenza a compressione", 2, blocks152, [formula115, formula116]), childUnit(unit153, "Verifiche di resistenza a flessione", 3, blocks153, [formula117, formula118]), childUnit(unit154, "Verifiche di resistenza a presso-tenso flessione", 4, blocks154, [formula119, formula120])];
const formulaRows = [formula113, formula114, formula115, formula116, formula117, formula118, formula119, formula120];
const formulaUnit = (formula: FormulaRow) => [formula113, formula114].includes(formula) ? unit151 : [formula115, formula116].includes(formula) ? unit152 : [formula117, formula118].includes(formula) ? unit153 : unit154;
const manifest = { $schema: "urn:structural-codes:schema:asset-manifest:v2", schemaVersion: "2.0.0-alpha.1", recordType: "asset-manifest", document: "circ2019", section: "C4.2-step2v", sourceId, status: "transcribed-unreviewed", formulas: formulaRows.map((formula) => ({ id: formulaId(formula.number), unitId: uid(formulaUnit(formula)), officialNumber: formula.number, pdfPage: formula.page, latex: formula.latex })), tables: [], figures: [] };
await mkdir(unitDirectory, { recursive: true });
await mkdir(assetDirectory, { recursive: true });
await Promise.all([writeFile(join(unitDirectory, `${parentNumber.toLowerCase()}.json`), `${JSON.stringify(parentUnit, null, 2)}\n`, "utf8"), ...childRecords.map((record) => writeFile(join(unitDirectory, `${record.numbering.official.toLowerCase()}.json`), `${JSON.stringify(record, null, 2)}\n`, "utf8")), writeFile(join(assetDirectory, "C4.2-step2v.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8")]);
console.log("Circolare C4.2 step2v: generate 5 unità e 8 formule.");
