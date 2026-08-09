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
const tableId = (number: string) => `urn:structural-codes:it:asset:table:circ2019:${number.toLowerCase()}`;
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

function block(number: string, suffix: string, kind: TextKind, page: number, normalized: string, inline: Inline[] = [text(normalized)], raw = normalized) {
    return { blockId: `${uid(number)}#block-${suffix}`, kind, origin: "official" as const, text: { raw, normalized, normalizationVersion: profile, inline }, evidence: evidence(page, raw, normalized, pageRegion()) };
}

function formulaBlock(number: string, suffix: string, formula: FormulaRow) {
    return { blockId: `${uid(number)}#block-${suffix}`, kind: "formula-ref", origin: "official" as const, assetId: formulaId(formula.number), evidence: evidence(formula.page, formula.raw, formula.raw, formula.region, true) };
}

function tableBlock(number: string, suffix: string, page: number, asset: string, caption: string, region: Region) {
    return { blockId: `${uid(number)}#block-${suffix}`, kind: "table-ref", origin: "official" as const, assetId: asset, evidence: evidence(page, caption, caption, region, true) };
}

function figureBlock(number: string, suffix: string, page: number, asset: string, caption: string, region: Region) {
    return { blockId: `${uid(number)}#block-${suffix}`, kind: "figure-ref", origin: "official" as const, assetId: asset, evidence: evidence(page, caption, caption, region, true) };
}

function parent(number: string) {
    const parts = number.split(".");
    return parts.length === 1 ? null : uid(parts.slice(0, -1).join("."));
}

function ancestors(number: string) {
    const parts = number.split(".");
    return parts.slice(1).map((_, index) => uid(parts.slice(0, index + 1).join(".")));
}

function makeUnit(number: string, title: string, blocks: GeneratedBlock[], formulas: string[] = [], tables: string[] = [], figures: string[] = []) {
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
        assets: { formulaIds: formulas.map(formulaId), tableIds: tables.map(tableId), figureIds: figures.map(figureId) },
        workflow: {
            status: "extracted",
            createdBy: { actorId: "codex:circ42-step2b", kind: "automated-agent", toolVersion: profile },
            createdAt,
            reviews: [],
            openIssues: [
                { issueId: `circ2019-${number.replaceAll(".", "-")}-source-review`, type: "normalization-review", severity: "blocking", note: "Record trascritto dall’evidence ufficiale ma non ancora confrontato integralmente da un revisore umano con il render della fonte." },
                ...(tables.length || figures.length ? [{ issueId: `circ2019-${number.replaceAll(".", "-")}-assets`, type: "asset-review", severity: "blocking", note: "Tabelle e figure sono strutturate o ritagliate dalla fonte; resta obbligatoria la revisione umana indipendente." }] : []),
            ],
        },
    };
}

const formulaRows: FormulaRow[] = [
    { number: "C4.2.30", unit: "C4.2.4.1.3.2", page: 109, latex: "M_{cr}=\\psi\\,\\frac{\\pi}{L_{cr}}\\sqrt{EJ_y\\,GJ_T}\\sqrt{1+\\left(\\frac{\\pi}{L_{cr}}\\right)^2\\frac{EJ_\\omega}{GJ_T}}", raw: "Mcr = ψ · π/Lcr · √(EJy · GJT) · √(1 + (π/Lcr)² · EJω/GJT) [C4.2.30]", region: reg(120, 250, 360, 90) },
    { number: "C4.2.31", unit: "C4.2.4.1.3.2", page: 109, latex: "\\psi=1{,}75-1{,}05\\,\\frac{M_B}{M_A}+0{,}3\\left(\\frac{M_B}{M_A}\\right)^2", raw: "ψ = 1,75 − 1,05 · MB/MA + 0,3 · (MB/MA)² [C4.2.31]", region: reg(140, 390, 330, 80) },
    { number: "C4.2.32", unit: "C4.2.4.1.3.3.1", page: 109, latex: "\\frac{N_{Ed}\\,\\gamma_{M1}}{\\chi_{min}\\,f_{yk}\\,A}+\\frac{M_{y,eq,Ed}\\,\\gamma_{M1}}{f_{yk}\\,W_y\\left(1-N_{Ed}/N_{cr,y}\\right)}+\\frac{M_{z,eq,Ed}\\,\\gamma_{M1}}{f_{yk}\\,W_z\\left(1-N_{Ed}/N_{cr,z}\\right)}\\le1", raw: "NEd · γM1/(χmin · fyk · A) + Myeq,Ed · γM1/[fyk · Wy · (1 − NEd/Ncr,y)] + Mzeq,Ed · γM1/[fyk · Wz · (1 − NEd/Ncr,z)] ≤ 1 [C4.2.32]", region: reg(105, 610, 390, 110) },
    { number: "C4.2.33", unit: "C4.2.4.1.3.3.1", page: 109, latex: "M_{eq,Ed}=1{,}3\\,M_{m,Ed}", raw: "Meq,Ed = 1,3 · Mm,Ed [C4.2.33]", region: reg(150, 735, 320, 70) },
    { number: "C4.2.34", unit: "C4.2.4.1.3.3.1", page: 109, latex: "0{,}75\\,M_{max,Ed}\\le M_{eq,Ed}\\le M_{max,Ed}", raw: "0,75 · Mmax,Ed ≤ Meq,Ed ≤ Mmax,Ed [C4.2.34]", region: reg(145, 790, 330, 50) },
    { number: "C4.2.35", unit: "C4.2.4.1.3.3.1", page: 110, latex: "M_{eq,Ed}=0{,}6\\,M_a-0{,}4\\,M_b\\ge0{,}4\\,M_a", raw: "Meq,Ed = 0,6 · Ma − 0,4 · Mb ≥ 0,4 · Ma [C4.2.35]", region: reg(120, 55, 360, 65) },
    { number: "C4.2.36", unit: "C4.2.4.1.3.3.1", page: 110, latex: "\\frac{N_{Ed}\\,\\gamma_{M1}}{\\chi_{min}\\,f_{yk}\\,A}+\\frac{M_{y,eq,Ed}\\,\\gamma_{M1}}{\\chi_{LT}\\,f_{yk}\\,W_y\\left(1-N_{Ed}/N_{cr,y}\\right)}+\\frac{M_{z,eq,Ed}\\,\\gamma_{M1}}{f_{yk}\\,W_z\\left(1-N_{Ed}/N_{cr,z}\\right)}\\le1", raw: "NEd · γM1/(χmin · fyk · A) + Myeq,Ed · γM1/[χLT · fyk · Wy · (1 − NEd/Ncr,y)] + Mzeq,Ed · γM1/[fyk · Wz · (1 − NEd/Ncr,z)] ≤ 1 [C4.2.36]", region: reg(100, 145, 400, 105) },
    { number: "C4.2.37", unit: "C4.2.4.1.3.3.2", page: 110, latex: "\\begin{aligned}\\frac{N_{Ed}\\gamma_{M1}}{\\chi_yAf_{yk}}+k_{yy}\\frac{M_{y,Ed}\\gamma_{M1}}{\\chi_{LT}W_yf_{yk}}+k_{yz}\\frac{M_{z,Ed}\\gamma_{M1}}{W_zf_{yk}}&\\le1\\\\\\frac{N_{Ed}\\gamma_{M1}}{\\chi_zAf_{yk}}+k_{zy}\\frac{M_{y,Ed}\\gamma_{M1}}{\\chi_{LT}W_yf_{yk}}+k_{zz}\\frac{M_{z,Ed}\\gamma_{M1}}{W_zf_{yk}}&\\le1\\end{aligned}", raw: "[C4.2.37] NEd · γM1/(χy · A · fyk) + kyy · My,Ed · γM1/(χLT · Wy · fyk) + kyz · Mz,Ed · γM1/(Wz · fyk) ≤ 1; NEd · γM1/(χz · A · fyk) + kzy · My,Ed · γM1/(χLT · Wy · fyk) + kzz · Mz,Ed · γM1/(Wz · fyk) ≤ 1", region: reg(100, 300, 400, 155) },
    { number: "C4.2.38", unit: "C4.2.4.1.3.3.2", page: 110, latex: "\\begin{aligned}\\frac{N_{Ed}\\gamma_{M1}}{\\chi_yA_{eff}f_{yk}}+k_{yy}\\frac{(M_{y,Ed}+\\Delta M_{y,Ed})\\gamma_{M1}}{\\chi_{LT}W_{eff,y}f_{yk}}+k_{yz}\\frac{(M_{z,Ed}+\\Delta M_{z,Ed})\\gamma_{M1}}{W_{eff,z}f_{yk}}&\\le1\\\\\\frac{N_{Ed}\\gamma_{M1}}{\\chi_zA_{eff}f_{yk}}+k_{zy}\\frac{(M_{y,Ed}+\\Delta M_{y,Ed})\\gamma_{M1}}{\\chi_{LT}W_{eff,y}f_{yk}}+k_{zz}\\frac{(M_{z,Ed}+\\Delta M_{z,Ed})\\gamma_{M1}}{W_{eff,z}f_{yk}}&\\le1\\end{aligned}", raw: "[C4.2.38] NEd · γM1/(χy · Aeff · fyk) + kyy · (My,Ed + ΔMy,Ed) · γM1/(χLT · Weff,y · fyk) + kyz · (Mz,Ed + ΔMz,Ed) · γM1/(Weff,z · fyk) ≤ 1; NEd · γM1/(χz · Aeff · fyk) + kzy · (My,Ed + ΔMy,Ed) · γM1/(χLT · Weff,y · fyk) + kzz · (Mz,Ed + ΔMz,Ed) · γM1/(Weff,z · fyk) ≤ 1", region: reg(100, 450, 400, 160) },
    { number: "C4.2.39", unit: "C4.2.4.1.3.3.2", page: 110, latex: "\\Delta M_{y,Ed}=e_{N,z}N_{Ed}\\qquad\\Delta M_{z,Ed}=e_{N,y}N_{Ed}", raw: "ΔMy,Ed = eN,z · NEd e ΔMz,Ed = eN,y · NEd [C4.2.39]", region: reg(130, 635, 350, 80) },
    { number: "C4.2.40", unit: "C4.2.4.1.3.3.3", page: 112, latex: "\\bar{\\lambda}_{op}=\\sqrt{\\frac{\\alpha_{ult,k}}{\\alpha_{cr,op}}}", raw: "λ̄op = √(αult,k/αcr,op) [C4.2.40]", region: reg(125, 535, 350, 85) },
    { number: "C4.2.41", unit: "C4.2.4.1.3.3.3", page: 112, latex: "\\chi_{op}=\\min\\left\\{\\chi(\\bar{\\lambda}_{op});\\chi_{LT}(\\bar{\\lambda}_{op})\\right\\}", raw: "χop = min{χ(λ̄op); χLT(λ̄op)} [C4.2.41]", region: reg(125, 630, 350, 75) },
    { number: "C4.2.42", unit: "C4.2.4.1.3.3.3", page: 112, latex: "\\frac{\\chi_{op}\\,\\alpha_{ult,k}}{\\gamma_{M1}}\\ge1{,}0", raw: "χop · αult,k/γM1 ≥ 1,0 [C4.2.42]", region: reg(125, 760, 350, 80) },
];

const formulaByNumber = new Map(formulaRows.map((row) => [row.number, row]));
const formula = (number: string) => formulaByNumber.get(number)!;
const c = (value: string, latex?: string, spans: { colSpan?: number; rowSpan?: number } = {}) => ({ text: value, ...(latex ? { latex } : {}), ...spans });
const f = (value: string, latex: string, spans: { colSpan?: number; rowSpan?: number } = {}) => c(value, latex, spans);

const tableIVId = tableId("C4.2.IV");
const tableVId = tableId("C4.2.V");
const tableVIId = tableId("C4.2.VI");

const tableIV = {
    id: tableIVId,
    unitId: uid("C4.2.4.1.3.3.2"),
    officialNumber: "C4.2.IV",
    pdfPage: 111,
    caption: "Coefficienti di interazione per la verifica di stabilità a pressoflessione di elementi con modesta deformabilità torsionale",
    columnCount: 4,
    headers: [[c("k"), c("Tipi di sezione"), c("Sezioni di classe 3 e 4 (proprietà delle sezioni calcolate in campo elastico)"), c("Sezioni di classe 1 e 2 (proprietà delle sezioni calcolate in campo plastico)")]],
    rows: [
        [f("kyy", "k_{yy}"), c("I, H, Sezioni cave"), f("αmy(1 + 0,6·λ̄y·NEdγM1/(χy·A·fyk)) ≤ αmy(1 + 0,6·NEdγM1/(χy·A·fyk))", "\\alpha_{my}\\left(1+0{,}6\\,\\bar{\\lambda}_y\\frac{N_{Ed}\\gamma_{M1}}{\\chi_yAf_{yk}}\\right)\\le\\alpha_{my}\\left(1+0{,}6\\frac{N_{Ed}\\gamma_{M1}}{\\chi_yAf_{yk}}\\right)"), f("αmy(1 + (λ̄y − 0,2)·NEdγM1/(χy·A·fyk)) ≤ αmy(1 + 0,8·NEdγM1/(χy·A·fyk))", "\\alpha_{my}\\left(1+(\\bar{\\lambda}_y-0{,}2)\\frac{N_{Ed}\\gamma_{M1}}{\\chi_yAf_{yk}}\\right)\\le\\alpha_{my}\\left(1+0{,}8\\frac{N_{Ed}\\gamma_{M1}}{\\chi_yAf_{yk}}\\right)")],
        [f("kyz", "k_{yz}"), c("I, H, Sezioni cave"), f("kzz", "k_{zz}"), f("0,6·kzz", "0{,}6\\,k_{zz}")],
        [f("kzy", "k_{zy}"), c("I, H, Sezioni cave"), f("0,8·kyy", "0{,}8\\,k_{yy}"), f("0,6·kyy", "0{,}6\\,k_{yy}")],
        [f("kzz", "k_{zz}", { rowSpan: 2 }), c("I, H"), f("αmz(1 + 0,6·λ̄y·NEdγM1/(χy·A·fyk)) ≤ αmz(1 + 0,6·NEdγM1/(χy·A·fyk))", "\\alpha_{mz}\\left(1+0{,}6\\,\\bar{\\lambda}_y\\frac{N_{Ed}\\gamma_{M1}}{\\chi_yAf_{yk}}\\right)\\le\\alpha_{mz}\\left(1+0{,}6\\frac{N_{Ed}\\gamma_{M1}}{\\chi_yAf_{yk}}\\right)", { rowSpan: 2 }), f("αmz(1 + (2λ̄y − 0,6)·NEdγM1/(χy·A·fyk)) ≤ αmz(1 + 1,4·NEdγM1/(χy·A·fyk))", "\\alpha_{mz}\\left(1+(2\\bar{\\lambda}_y-0{,}6)\\frac{N_{Ed}\\gamma_{M1}}{\\chi_yAf_{yk}}\\right)\\le\\alpha_{mz}\\left(1+1{,}4\\frac{N_{Ed}\\gamma_{M1}}{\\chi_yAf_{yk}}\\right)")],
        [c("Sezioni cave"), f("αmz(1 + (λ̄y − 0,2)·NEdγM1/(χy·A·fyk)) ≤ αmz(1 + 0,8·NEdγM1/(χy·A·fyk))", "\\alpha_{mz}\\left(1+(\\bar{\\lambda}_y-0{,}2)\\frac{N_{Ed}\\gamma_{M1}}{\\chi_yAf_{yk}}\\right)\\le\\alpha_{mz}\\left(1+0{,}8\\frac{N_{Ed}\\gamma_{M1}}{\\chi_yAf_{yk}}\\right)")],
    ],
    notes: ["Per pressoflessione retta, My,Ed≠0, kzy = 0 (Mz,Ed=0)."],
};

const tableV = {
    id: tableVId,
    unitId: uid("C4.2.4.1.3.3.2"),
    officialNumber: "C4.2.V",
    pdfPage: 111,
    caption: "Coefficienti d’interazione per la verifica di stabilità a pressoflessione di elementi deformabili torsionalmente",
    columnCount: 3,
    headers: [[c("k"), c("Sezioni di classe 3 e 4 (proprietà delle sezioni calcolate in campo elastico)"), c("Sezioni di classe 1 e 2 (proprietà delle sezioni calcolate in campo plastico)")]],
    rows: [
        [f("kyy", "k_{yy}"), f("αmy(1 + 0,6·λ̄y·NEdγM1/(χy·A·fyk)) ≤ αmy(1 + 0,6·NEdγM1/(χy·A·fyk))", "\\alpha_{my}\\left(1+0{,}6\\,\\bar{\\lambda}_y\\frac{N_{Ed}\\gamma_{M1}}{\\chi_yAf_{yk}}\\right)\\le\\alpha_{my}\\left(1+0{,}6\\frac{N_{Ed}\\gamma_{M1}}{\\chi_yAf_{yk}}\\right)"), f("αmy(1 + (λ̄y − 0,2)·NEdγM1/(χy·A·fyk)) ≤ αmy(1 + 0,8·NEdγM1/(χy·A·fyk))", "\\alpha_{my}\\left(1+(\\bar{\\lambda}_y-0{,}2)\\frac{N_{Ed}\\gamma_{M1}}{\\chi_yAf_{yk}}\\right)\\le\\alpha_{my}\\left(1+0{,}8\\frac{N_{Ed}\\gamma_{M1}}{\\chi_yAf_{yk}}\\right)")],
        [f("kyz", "k_{yz}"), f("kzz", "k_{zz}"), f("0,6·kzz", "0{,}6\\,k_{zz}")],
        [f("kzy", "k_{zy}"), f("(1 − 0,05·λ̄z/(αmLT − 0,25)·NEdγM1/(χz·A·fyk)) ≥ (1 − 0,05/(αmLT − 0,25)·NEdγM1/(χz·A·fyk))", "\\left(1-\\frac{0{,}05\\,\\bar{\\lambda}_z}{\\alpha_{mLT}-0{,}25}\\frac{N_{Ed}\\gamma_{M1}}{\\chi_zAf_{yk}}\\right)\\ge\\left(1-\\frac{0{,}05}{\\alpha_{mLT}-0{,}25}\\frac{N_{Ed}\\gamma_{M1}}{\\chi_zAf_{yk}}\\right)"), f("(1 − 0,1·λ̄z/(αmLT − 0,25)·NEdγM1/(χz·A·fyk)) ≥ (1 − 0,1/(αmLT − 0,25)·NEdγM1/(χz·A·fyk)) per λ̄z ≥ 0,4; kzy = 0,6 + λ̄z ≤ (1 − 0,1·λ̄z/(αmLT − 0,25)·NEdγM1/(χz·A·fyk)) per λ̄z < 0,4", "\\begin{cases}\\left(1-\\frac{0{,}1\\,\\bar{\\lambda}_z}{\\alpha_{mLT}-0{,}25}\\frac{N_{Ed}\\gamma_{M1}}{\\chi_zAf_{yk}}\\right)\\ge\\left(1-\\frac{0{,}1}{\\alpha_{mLT}-0{,}25}\\frac{N_{Ed}\\gamma_{M1}}{\\chi_zAf_{yk}}\\right)&\\text{per }\\bar{\\lambda}_z\\ge0{,}4\\\\k_{zy}=0{,}6+\\bar{\\lambda}_z\\le\\left(1-\\frac{0{,}1\\,\\bar{\\lambda}_z}{\\alpha_{mLT}-0{,}25}\\frac{N_{Ed}\\gamma_{M1}}{\\chi_zAf_{yk}}\\right)&\\text{per }\\bar{\\lambda}_z<0{,}4\\end{cases}")],
        [f("kzz", "k_{zz}"), f("αmz(1 + 0,6·λ̄z·NEdγM1/(χz·A·fyk)) ≤ αmz(1 + 0,6·NEdγM1/(χz·A·fyk))", "\\alpha_{mz}\\left(1+0{,}6\\,\\bar{\\lambda}_z\\frac{N_{Ed}\\gamma_{M1}}{\\chi_zAf_{yk}}\\right)\\le\\alpha_{mz}\\left(1+0{,}6\\frac{N_{Ed}\\gamma_{M1}}{\\chi_zAf_{yk}}\\right)"), f("αmz(1 + (2λ̄z − 0,6)·NEdγM1/(χz·A·fyk)) ≤ αmz(1 + 1,4·NEdγM1/(χz·A·fyk))", "\\alpha_{mz}\\left(1+(2\\bar{\\lambda}_z-0{,}6)\\frac{N_{Ed}\\gamma_{M1}}{\\chi_zAf_{yk}}\\right)\\le\\alpha_{mz}\\left(1+1{,}4\\frac{N_{Ed}\\gamma_{M1}}{\\chi_zAf_{yk}}\\right)")],
    ],
    notes: [],
};

const tableVI = {
    id: tableVIId,
    unitId: uid("C4.2.4.1.3.3.2"),
    officialNumber: "C4.2.VI",
    pdfPage: 112,
    caption: "Coefficienti correttivi del momento flettente per la verifica di stabilità a presso-flessione deviata",
    columnCount: 5,
    headers: [
        [c("Diagramma del momento", undefined, { rowSpan: 2 }), c("Intervallo", undefined, { colSpan: 2, rowSpan: 2 }), c("Coefficienti αmy, αmz, αmLT", undefined, { colSpan: 2 })],
        [c("Carico uniforme"), c("Carico concentrato")],
    ],
    rows: [
        [f("Mh … ψMh", "M_h\\;\\cdots\\;\\psi M_h"), c("—"), f("−1 ≤ ψ ≤ 1", "-1\\le\\psi\\le1"), f("0,6 + 0,4ψ ≥ 0,4", "0{,}6+0{,}4\\psi\\ge0{,}4", { colSpan: 2 })],
        [f("Mh … Ms … ψMh; αs = Ms/Mh", "M_h\\;\\cdots\\;M_s\\;\\cdots\\;\\psi M_h;\\quad\\alpha_s=M_s/M_h", { rowSpan: 3 }), f("0 ≤ αs ≤ 1", "0\\le\\alpha_s\\le1", { rowSpan: 3 }), f("−1 ≤ ψ ≤ 1", "-1\\le\\psi\\le1"), f("0,2 + 0,8αs ≥ 0,4", "0{,}2+0{,}8\\alpha_s\\ge0{,}4"), f("0,2 + 0,8αs ≥ 0,4", "0{,}2+0{,}8\\alpha_s\\ge0{,}4")],
        [f("0 ≤ ψ ≤ 1", "0\\le\\psi\\le1"), f("0,1 − 0,8αs ≥ 0,4", "0{,}1-0{,}8\\alpha_s\\ge0{,}4"), f("−0,8αs ≥ 0,4", "-0{,}8\\alpha_s\\ge0{,}4")],
        [f("−1 ≤ ψ ≤ 0", "-1\\le\\psi\\le0"), f("0,1(1 − ψ) − 0,8αs ≥ 0,4", "0{,}1(1-\\psi)-0{,}8\\alpha_s\\ge0{,}4"), f("0,2(−ψ) − 0,8αs ≥ 0,4", "0{,}2(-\\psi)-0{,}8\\alpha_s\\ge0{,}4")],
        [f("Mh … Ms … ψMh; αh = Mh/Ms", "M_h\\;\\cdots\\;M_s\\;\\cdots\\;\\psi M_h;\\quad\\alpha_h=M_h/M_s", { rowSpan: 3 }), f("0 ≤ αh ≤ 1", "0\\le\\alpha_h\\le1", { rowSpan: 3 }), f("−1 ≤ ψ ≤ 1", "-1\\le\\psi\\le1"), f("0,95 + 0,05αh", "0{,}95+0{,}05\\alpha_h"), f("0,90 + 0,10αh", "0{,}90+0{,}10\\alpha_h")],
        [f("0 ≤ ψ ≤ 1", "0\\le\\psi\\le1"), f("0,95 + 0,05αh", "0{,}95+0{,}05\\alpha_h"), f("0,90 + 0,10αh", "0{,}90+0{,}10\\alpha_h")],
        [f("−1 ≤ ψ ≤ 0", "-1\\le\\psi\\le0"), f("0,95 + 0,05αh(1 + 2ψ)", "0{,}95+0{,}05\\alpha_h(1+2\\psi)"), f("0,90 + 0,10αh(1 + 2ψ)", "0{,}90+0{,}10\\alpha_h(1+2\\psi)")],
    ],
    notes: [],
};

const figureNumber = "C4.2.11";
const figureAssetId = figureId(figureNumber);
const figureRegion = reg(205, 145, 205, 47);

const units = [
    makeUnit("C4.2.4.1.3.2", "Travi inflesse", [
        block("C4.2.4.1.3.2", "heading", "heading", 109, "C4.2.4.1.3.2 Travi inflesse"),
        block("C4.2.4.1.3.2", "p1", "paragraph", 109, "Il coefficiente di snellezza adimensionale λLT, di cui al § 4.2.4.1.3.2 delle NTC, che consente di eseguire la verifica ad instabilità flesso-torsionale dipende dal valore del momento critico elastico di instabilità torsionale, Mcr, del profilo inflesso in esame. Tale valore può calcolarsi, per profili di qualunque geometria, utilizzando metodi numerici, quali ad esempio metodi agli elementi finiti oppure programmi di calcolo strutturale che consentano di eseguire analisi di “buckling”.", [text("Il coefficiente di snellezza adimensionale "), math("λLT", "\\bar{\\lambda}_{LT}"), text(", di cui al § 4.2.4.1.3.2 delle NTC, che consente di eseguire la verifica ad instabilità flesso-torsionale dipende dal valore del momento critico elastico di instabilità torsionale, "), math("Mcr", "M_{cr}"), text(", del profilo inflesso in esame. Tale valore può calcolarsi, per profili di qualunque geometria, utilizzando metodi numerici, quali ad esempio metodi agli elementi finiti oppure programmi di calcolo strutturale che consentano di eseguire analisi di “buckling”.")]),
        block("C4.2.4.1.3.2", "p2", "paragraph", 109, "In alternativa, per profili standard (sezioni doppiamente simmetriche ad I o H) il momento critico può calcolarsi con la seguente formula"),
        formulaBlock("C4.2.4.1.3.2", "formula-30", formula("C4.2.30")),
        block("C4.2.4.1.3.2", "p3", "paragraph", 109, "dove Lcr è la lunghezza di libera inflessione laterale, misurata tra due ritegni torsionali successivi, EJy è la rigidezza flessionale laterale del profilo (misurata in genere rispetto all’asse debole), GJT è la rigidezza torsionale del profilo mentre EJω è la rigidezza torsionale secondaria del profilo. Il coefficiente ψ tiene conto della distribuzione del momento flettente lungo la trave ed è dato dall’espressione", [text("dove "), math("Lcr", "L_{cr}"), text(" è la lunghezza di libera inflessione laterale, misurata tra due ritegni torsionali successivi, "), math("EJy", "EJ_y"), text(" è la rigidezza flessionale laterale del profilo (misurata in genere rispetto all’asse debole), "), math("GJT", "GJ_T"), text(" è la rigidezza torsionale del profilo mentre "), math("EJω", "EJ_{\\omega}"), text(" è la rigidezza torsionale secondaria del profilo. Il coefficiente "), math("ψ", "\\psi"), text(" tiene conto della distribuzione del momento flettente lungo la trave ed è dato dall’espressione")]),
        formulaBlock("C4.2.4.1.3.2", "formula-31", formula("C4.2.31")),
        block("C4.2.4.1.3.2", "p4", "paragraph", 109, "in cui MA ed MB sono i momenti flettenti agenti alle estremità della trave, con |MB|<|MA|.", [text("in cui "), math("MA", "M_A"), text(" ed "), math("MB", "M_B"), text(" sono i momenti flettenti agenti alle estremità della trave, con |"), math("MB", "M_B"), text("|<|"), math("MA", "M_A"), text("|.")]),
    ], ["C4.2.30", "C4.2.31"]),
    makeUnit("C4.2.4.1.3.3", "Membrature inflesse e compresse", [
        block("C4.2.4.1.3.3", "heading", "heading", 109, "C4.2.4.1.3.3 Membrature inflesse e compresse"),
        block("C4.2.4.1.3.3", "p1", "paragraph", 109, "Oltre alle verifiche di resistenza, per elementi pressoinflessi devono essere eseguite, quando rilevanti, anche verifiche di instabilità a pressoflessione."),
        block("C4.2.4.1.3.3", "p2", "paragraph", 109, "In assenza di più accurate valutazioni, si possono impiegare, in alternativa, i metodi A e B riportati nel seguito, o anche altre metodi ricavati da normative di comprovata validità."),
    ]),
    makeUnit("C4.2.4.1.3.3.1", "Metodo A", [
        block("C4.2.4.1.3.3.1", "heading", "heading", 109, "C4.2.4.1.3.3.1. Metodo A"),
        block("C4.2.4.1.3.3.1", "p1", "paragraph", 109, "Nel caso di aste prismatiche soggette a compressione NEd e a momenti flettenti My,Ed e Mz,Ed agenti nei due piani principali di inerzia, in presenza di vincoli che impediscono gli spostamenti torsionali, si dovrà controllare che risulti:", [text("Nel caso di aste prismatiche soggette a compressione "), math("NEd", "N_{Ed}"), text(" e a momenti flettenti "), math("My,Ed", "M_{y,Ed}"), text(" e "), math("Mz,Ed", "M_{z,Ed}"), text(" agenti nei due piani principali di inerzia, in presenza di vincoli che impediscono gli spostamenti torsionali, si dovrà controllare che risulti:")]),
        formulaBlock("C4.2.4.1.3.3.1", "formula-32", formula("C4.2.32")),
        block("C4.2.4.1.3.3.1", "where", "paragraph", 109, "dove:"),
        block("C4.2.4.1.3.3.1", "def-chimin", "paragraph", 109, "χmin è il minimo fattore χ relativo all’inflessione intorno agli assi principali di inerzia;", [math("χmin", "\\chi_{min}"), text(" è il minimo fattore χ relativo all’inflessione intorno agli assi principali di inerzia;")]),
        block("C4.2.4.1.3.3.1", "def-w", "paragraph", 109, "Wy e Wz sono i moduli resistenti elastici per le sezioni di classe 3 e i moduli resistenti plastici per le sezioni di classe 1 e 2,", [math("Wy", "W_y"), text(" e "), math("Wz", "W_z"), text(" sono i moduli resistenti elastici per le sezioni di classe 3 e i moduli resistenti plastici per le sezioni di classe 1 e 2,")]),
        block("C4.2.4.1.3.3.1", "def-ncr", "paragraph", 109, "Ncr,y e Ncr,z sono i carichi critici euleriani relativi all’inflessione intorno agli assi principali di inerzia;", [math("Ncr,y", "N_{cr,y}"), text(" e "), math("Ncr,z", "N_{cr,z}"), text(" sono i carichi critici euleriani relativi all’inflessione intorno agli assi principali di inerzia;")]),
        block("C4.2.4.1.3.3.1", "def-meq", "paragraph", 109, "Myeq,Ed e Mzeq,Ed sono i valori equivalenti dei momenti flettenti da considerare nella verifica.", [math("Myeq,Ed", "M_{y,eq,Ed}"), text(" e "), math("Mzeq,Ed", "M_{z,eq,Ed}"), text(" sono i valori equivalenti dei momenti flettenti da considerare nella verifica.")]),
        block("C4.2.4.1.3.3.1", "p2", "paragraph", 109, "Se il momento flettente varia lungo l’asta si assume, per ogni asse principale di inerzia,"),
        formulaBlock("C4.2.4.1.3.3.1", "formula-33", formula("C4.2.33")),
        block("C4.2.4.1.3.3.1", "p3", "paragraph", 109, "essendo Mm,Ed il valor medio del momento flettente, con la limitazione", [text("essendo "), math("Mm,Ed", "M_{m,Ed}"), text(" il valor medio del momento flettente, con la limitazione")]),
        formulaBlock("C4.2.4.1.3.3.1", "formula-34", formula("C4.2.34")),
        block("C4.2.4.1.3.3.1", "p4", "paragraph", 110, "Nel caso di asta vincolata agli estremi, soggetta a momento flettente variabile linearmente tra i valori di estremità Ma e Mb, |Ma|≥|Mb|, (Figura C4.2.11), si può assumere per Meq,Ed il seguente valore", [text("Nel caso di asta vincolata agli estremi, soggetta a momento flettente variabile linearmente tra i valori di estremità "), math("Ma", "M_a"), text(" e "), math("Mb", "M_b"), text(", |"), math("Ma", "M_a"), text("|≥|"), math("Mb", "M_b"), text("|, (Figura C4.2.11), si può assumere per "), math("Meq,Ed", "M_{eq,Ed}"), text(" il seguente valore")]),
        formulaBlock("C4.2.4.1.3.3.1", "formula-35", formula("C4.2.35")),
        figureBlock("C4.2.4.1.3.3.1", "figure-11", 110, figureId("C4.2.11"), "Figura C4.2.11 - Trave soggetta a momenti d’estremità", figureRegion),
        block("C4.2.4.1.3.3.1", "p5", "paragraph", 110, "In presenza di fenomeni di instabilità flesso-torsionali bisogna verificare che sia:"),
        formulaBlock("C4.2.4.1.3.3.1", "formula-36", formula("C4.2.36")),
        block("C4.2.4.1.3.3.1", "p6", "paragraph", 110, "dove χLT è il fattore di riduzione per l’instabilità flesso-torsionale, definito al § 4.2.4.1.3.2 delle NTC e z è l’asse debole.", [text("dove "), math("χLT", "\\chi_{LT}"), text(" è il fattore di riduzione per l’instabilità flesso-torsionale, definito al § 4.2.4.1.3.2 delle NTC e "), math("z", "z"), text(" è l’asse debole.")]),
    ], ["C4.2.32", "C4.2.33", "C4.2.34", "C4.2.35", "C4.2.36"], [], ["C4.2.11"]),
    makeUnit("C4.2.4.1.3.3.2", "Metodo B", [
        block("C4.2.4.1.3.3.2", "heading", "heading", 110, "C4.2.4.1.3.3.2. Metodo B"),
        block("C4.2.4.1.3.3.2", "p1", "paragraph", 110, "In assenza di più accurate valutazioni, nel caso di membrature a sezione costante con sezioni doppiamente simmetriche aperte o chiuse, soggette a sforzo assiale e momento flettente, la verifica di stabilità a pressoflessione, per sezioni di classe 1, 2 o 3, può essere eseguita controllando che siano soddisfatte le seguenti disuguaglianze"),
        formulaBlock("C4.2.4.1.3.3.2", "formula-37", formula("C4.2.37")),
        block("C4.2.4.1.3.3.2", "p2", "paragraph", 110, "dove NEd, My,Ed e Mz,Ed sono, rispettivamente, lo sforzo assiale ed i massimi momenti flettenti agenti sull’elemento nei piani di normale y e z, A è l’area e Wy e Wz i moduli resistenti elastici per le sezioni di classe 3 e i moduli resistenti plastici per le sezioni di classe 1 e 2, e kyy, kyz, kzy e kzz sono opportuni coefficienti di interazione dati nel seguito.", [text("dove "), math("NEd", "N_{Ed}"), text(", "), math("My,Ed", "M_{y,Ed}"), text(" e "), math("Mz,Ed", "M_{z,Ed}"), text(" sono, rispettivamente, lo sforzo assiale ed i massimi momenti flettenti agenti sull’elemento nei piani di normale y e z, "), math("A", "A"), text(" è l’area e "), math("Wy", "W_y"), text(" e "), math("Wz", "W_z"), text(" i moduli resistenti elastici per le sezioni di classe 3 e i moduli resistenti plastici per le sezioni di classe 1 e 2, e "), math("kyy", "k_{yy}"), text(", "), math("kyz", "k_{yz}"), text(", "), math("kzy", "k_{zy}"), text(" e "), math("kzz", "k_{zz}"), text(" sono opportuni coefficienti di interazione dati nel seguito.")]),
        block("C4.2.4.1.3.3.2", "p3", "paragraph", 110, "Per sezioni di classe 4 le [C4.2.37] si modificano nelle"),
        formulaBlock("C4.2.4.1.3.3.2", "formula-38", formula("C4.2.38")),
        block("C4.2.4.1.3.3.2", "p4", "paragraph", 110, "dove Aeff è l’area efficace della sezione, Weff,y e Weff,z i moduli resistenti efficaci e ΔMy,Ed e ΔMz,Ed i momenti della forza normale NEd rispetto al baricentro della sezione efficace,", [text("dove "), math("Aeff", "A_{eff}"), text(" è l’area efficace della sezione, "), math("Weff,y", "W_{eff,y}"), text(" e "), math("Weff,z", "W_{eff,z}"), text(" i moduli resistenti efficaci e "), math("ΔMy,Ed", "\\Delta M_{y,Ed}"), text(" e "), math("ΔMz,Ed", "\\Delta M_{z,Ed}"), text(" i momenti della forza normale "), math("NEd", "N_{Ed}"), text(" rispetto al baricentro della sezione efficace,")]),
        formulaBlock("C4.2.4.1.3.3.2", "formula-39", formula("C4.2.39")),
        block("C4.2.4.1.3.3.2", "p5", "paragraph", 110, "con eN,y e eN,z distanze del baricentro della sezione efficace dal baricentro della sezione lorda, lungo gli assi y e z rispettivamente.", [text("con "), math("eN,y", "e_{N,y}"), text(" e "), math("eN,z", "e_{N,z}"), text(" distanze del baricentro della sezione efficace dal baricentro della sezione lorda, lungo gli assi y e z rispettivamente.")]),
        block("C4.2.4.1.3.3.2", "p6", "paragraph", 110, "Nelle [C4.2.37] e [C4.2.38] χy, χz sono i coefficienti di riduzione per l’instabilità a compressione e χLT è il coefficiente di riduzione per l’instabilità flessotorsionale, dati nel § 4.2.4.1.3.1 e § 4.2.4.1.3.2 delle NTC.", [text("Nelle [C4.2.37] e [C4.2.38] "), math("χy", "\\chi_y"), text(", "), math("χz", "\\chi_z"), text(" sono i coefficienti di riduzione per l’instabilità a compressione e "), math("χLT", "\\chi_{LT}"), text(" è il coefficiente di riduzione per l’instabilità flessotorsionale, dati nel § 4.2.4.1.3.1 e § 4.2.4.1.3.2 delle NTC.")]),
        tableBlock("C4.2.4.1.3.3.2", "table-iv", 111, tableIVId, "Tabella C4.2.IV - Coefficienti di interazione per la verifica di stabilità a pressoflessione di elementi con modesta deformabilità torsionale", reg(70, 55, 455, 290)),
        tableBlock("C4.2.4.1.3.3.2", "table-v", 111, tableVId, "Tabella C4.2.V - Coefficienti d’interazione per la verifica di stabilità a pressoflessione di elementi deformabili torsionalmente", reg(70, 390, 455, 340)),
        block("C4.2.4.1.3.3.2", "p7", "paragraph", 111, "I coefficienti di interazione kyy, kyz, kzy e kzz sono dati nella Tabella C4.2.IV, per le membrature a sezione chiusa e per quelle a sezione aperta vincolate a torsione, e nella Tabella C4.2.V per le membrature a sezione aperta non vincolate a torsione. I valori riportati dipendono dai coefficienti αmy, αmz per l’instabilità a compressione con inflessione intorno agli assi y e z, rispettivamente, e dal coefficiente αmLT per l’instabilità flessotorsionale, che sono dati, in funzione del tipo di carico e dell’effettiva distribuzione dei momenti flettenti lungo l’elemento strutturale, in Tabella C4.2.VI.", [text("I coefficienti di interazione "), math("kyy", "k_{yy}"), text(", "), math("kyz", "k_{yz}"), text(", "), math("kzy", "k_{zy}"), text(" e "), math("kzz", "k_{zz}"), text(" sono dati nella Tabella C4.2.IV, per le membrature a sezione chiusa e per quelle a sezione aperta vincolate a torsione, e nella Tabella C4.2.V per le membrature a sezione aperta non vincolate a torsione. I valori riportati dipendono dai coefficienti "), math("αmy", "\\alpha_{my}"), text(", "), math("αmz", "\\alpha_{mz}"), text(" per l’instabilità a compressione con inflessione intorno agli assi y e z, rispettivamente, e dal coefficiente "), math("αmLT", "\\alpha_{mLT}"), text(" per l’instabilità flessotorsionale, che sono dati, in funzione del tipo di carico e dell’effettiva distribuzione dei momenti flettenti lungo l’elemento strutturale, in Tabella C4.2.VI.")]),
        tableBlock("C4.2.4.1.3.3.2", "table-vi", 112, tableVIId, "Tabella C4.2.VI - Coefficienti correttivi del momento flettente per la verifica di stabilità a presso-flessione deviata", reg(70, 55, 455, 330)),
        block("C4.2.4.1.3.3.2", "p8", "paragraph", 112, "Per la valutazione dei coefficienti αmy si farà riferimento ai vincoli allo spostamento lungo z; per la valutazione dei coefficienti αmz e αmLT si farà riferimento ai vincoli allo spostamento lungo y.", [text("Per la valutazione dei coefficienti "), math("αmy", "\\alpha_{my}"), text(" si farà riferimento ai vincoli allo spostamento lungo z; per la valutazione dei coefficienti "), math("αmz", "\\alpha_{mz}"), text(" e "), math("αmLT", "\\alpha_{mLT}"), text(" si farà riferimento ai vincoli allo spostamento lungo y.")]),
        block("C4.2.4.1.3.3.2", "p9", "paragraph", 112, "Per elementi con modo instabile per traslazione dei piani, si deve assumere αmy=0,9 o αmz=0,9, rispettivamente.", [text("Per elementi con modo instabile per traslazione dei piani, si deve assumere "), math("αmy=0,9", "\\alpha_{my}=0{,}9"), text(" o "), math("αmz=0,9", "\\alpha_{mz}=0{,}9"), text(", rispettivamente.")]),
        block("C4.2.4.1.3.3.2", "p10", "paragraph", 112, "Per il calcolo dei coefficienti d’interazione si possono adottare metodi alternativi, adeguatamente comprovati."),
    ], ["C4.2.37", "C4.2.38", "C4.2.39"], ["C4.2.IV", "C4.2.V", "C4.2.VI"]),
    makeUnit("C4.2.4.1.3.3.3", "Metodo generale per la verifica ad instabilità laterale e flesso-torsionale", [
        block("C4.2.4.1.3.3.3", "heading", "heading", 112, "C4.2.4.1.3.3.3. Metodo generale per la verifica ad instabilità laterale e flesso-torsionale"),
        block("C4.2.4.1.3.3.3", "p1", "paragraph", 112, "Se elementi strutturali o parti di struttura non sono conformi ai requisiti imposti per l’applicazione dei metodi di verifica semplificati esposti nel § 4.2.4.1.3 delle NTC e nei §§ C4.2.4.1.3.1÷ C4.2.4.1.3.3, è necessario eseguire delle analisi più accurate per determinare i valori della resistenza nei confronti dei fenomeni di instabilità dell’equilibrio dovute a sollecitazioni di compressione, flessione o combinate. In particolare, è necessario conoscere i moltiplicatori dei carichi applicati all’elemento strutturale che ingenerano fenomeni di instabilità dell’equilibrio, calcolando, per l’elemento strutturale o la struttura o parte di essa:"),
        block("C4.2.4.1.3.3.3", "def-aultk", "paragraph", 112, "αult,k – moltiplicatore dei carichi di progetto che induce in una sezione del sistema sollecitazioni pari alla sua resistenza caratteristica;", [math("αult,k", "\\alpha_{ult,k}"), text(" – moltiplicatore dei carichi di progetto che induce in una sezione del sistema sollecitazioni pari alla sua resistenza caratteristica;")]),
        block("C4.2.4.1.3.3.3", "def-acrop", "paragraph", 112, "αcr,op – il minore dei moltiplicatori dei carichi di progetto che produce nell’elemento strutturale o in uno degli elementi del sistema fenomeni di instabilità laterale o torsionale.", [math("αcr,op", "\\alpha_{cr,op}"), text(" – il minore dei moltiplicatori dei carichi di progetto che produce nell’elemento strutturale o in uno degli elementi del sistema fenomeni di instabilità laterale o torsionale.")]),
        block("C4.2.4.1.3.3.3", "p2", "paragraph", 112, "Da tali moltiplicatori è possibile ricavare la snellezza adimensionale"),
        formulaBlock("C4.2.4.1.3.3.3", "formula-40", formula("C4.2.40")),
        block("C4.2.4.1.3.3.3", "p3", "paragraph", 112, "dalla quale si ottiene il fattore di riduzione della resistenza del sistema"),
        formulaBlock("C4.2.4.1.3.3.3", "formula-41", formula("C4.2.41")),
        block("C4.2.4.1.3.3.3", "p4", "paragraph", 112, "Tali moltiplicatori dei carichi di progetto, sono ricavati all’interno del § 4.2.4.1.3 delle NTC con formule semplificate valide solo per particolari casi di sollecitazione e per le geometrie delle sezioni più comuni e doppiamente simmetriche. Il calcolo, invece, di tali coefficienti tramite modelli numerici più complessi consente la loro definizione per geometrie e condizioni di carico qualunque, purché convalidato tramite attendibili riscontri sperimentali. Ovviamente tale metodo di analisi è fortemente raccomandato nel caso di strutture speciali e/o caratterizzate da conformazioni strutturali particolarmente complesse, per le quali sia giustificato il riscontro sperimentale."),
        block("C4.2.4.1.3.3.3", "p5", "paragraph", 112, "La verifica complessiva nei confronti dell’instabilità al di fuori del piano per l’elemento strutturale generico (non prismatico, con condizioni al contorno particolari, ecc.) o per la struttura è imposta con la formula seguente"),
        formulaBlock("C4.2.4.1.3.3.3", "formula-42", formula("C4.2.42")),
    ], ["C4.2.40", "C4.2.41", "C4.2.42"]),
];

const figureSource = "page-0110-x205-y145-w205-h47@3x.png";
const manifest = {
    $schema: "urn:structural-codes:schema:asset-manifest:v2",
    schemaVersion: "2.0.0-alpha.1",
    recordType: "asset-manifest",
    document: "circ2019",
    section: "C4.2-step2b",
    sourceId,
    status: "transcribed-unreviewed",
    formulas: formulaRows.map((row) => ({ id: formulaId(row.number), unitId: uid(row.unit), officialNumber: row.number, pdfPage: row.page, latex: row.latex })),
    tables: [tableIV, tableV, tableVI],
    figures: [{
        id: figureAssetId,
        unitId: uid("C4.2.4.1.3.3.1"),
        officialNumber: figureNumber,
        pdfPage: 110,
        caption: "Figura C4.2.11 - Trave soggetta a momenti d’estremità",
        alt: "Trave soggetta a momenti d’estremità con momenti Ma e Mb alle estremità",
        imagePath: "figures/circ2019/figc4.2.11.png",
        region: figureRegion,
        sha256: "e270c68cd1a0160f4183624e40c0d4f175197270c137f689aba7fad01967e25f",
    }],
};

await mkdir(unitDirectory, { recursive: true });
await mkdir(assetDirectory, { recursive: true });
await mkdir(figureDirectory, { recursive: true });
await copyFile(join(evidenceRenderDirectory, figureSource), join(figureDirectory, "figc4.2.11.png"));
await Promise.all([
    ...units.map((unit) => writeFile(join(unitDirectory, `${unit.numbering.official.toLowerCase()}.json`), `${JSON.stringify(unit, null, 2)}\n`, "utf8")),
    writeFile(join(assetDirectory, "C4.2-step2b.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8"),
]);
console.log(`Circolare C4.2 step2b: generate ${units.length} unità, ${formulaRows.length} formule, 3 tabelle e 1 figura.`);
