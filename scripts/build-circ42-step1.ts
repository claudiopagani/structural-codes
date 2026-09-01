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
type TextKind = "heading" | "paragraph" | "list-item";
type FormulaRow = { number: string; unit: string; page: number; latex: string; raw: string; region: Region };
type GeneratedBlock = {
    blockId: string;
    kind: string;
    origin: string;
    text?: { raw: string; normalized: string; normalizationVersion: string; inline: Inline[] };
    evidence: { rawSha256: string; normalizedSha256: string; [key: string]: unknown };
    assetId?: string;
};

const uid = (number: string) => `urn:structural-codes:it:unit:circ2019:${number.toLowerCase()}`;
const formulaId = (number: string) => `urn:structural-codes:it:asset:formula:circ2019:${number.toLowerCase()}`;
const tableId = (number: string) => `urn:structural-codes:it:asset:table:circ2019:${number.toLowerCase()}`;
const figureId = (number: string) => `urn:structural-codes:it:asset:figure:circ2019:${number.toLowerCase()}`;
const relationless = new Set(["C4.2.3.6", "C4.2.3.7"]);
const reg = (x: number, y: number, width: number, height: number): Region => ({ coordinateSystem: "pdf-points-top-left", x, y, width, height });
const pageRegion = (): Region => reg(73.9, 55, 450, 730);
const text = (value: string): Inline => ({ kind: "text", value });
const math = (value: string, latex: string): Inline => ({ kind: "math", value, latex });
const hash = (value: string) => sha256OfText(value);

function transformations(raw: string, normalized: string, manual = false) {
    const result = [{ operation: "join-line-wrap", ruleVersion: profile, note: "Ricomposte le righe tipografiche appartenenti allo stesso capoverso; i capoversi distinti restano blocchi separati." }];
    if (raw !== normalized) result.push({ operation: "manual-correction", ruleVersion: profile, note: "Ripristinati accenti, apostrofi, simboli e notazione confrontati con il render ufficiale." });
    if (manual) result.push({ operation: "manual-correction", ruleVersion: profile, note: "Asset trascritto direttamente dal render ufficiale a causa del layer testuale corrotto o incompleto." });
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
        transformations: transformations(raw, normalized, manual),
        rawSha256: hash(raw),
        normalizedSha256: hash(normalized),
    };
}

function block(number: string, suffix: string, kind: TextKind, page: number, normalized: string, inline: Inline[] = [text(normalized)], raw = normalized) {
    return { blockId: `${uid(number)}#block-${suffix}`, kind, origin: "official", text: { raw, normalized, normalizationVersion: profile, inline }, evidence: evidence(page, raw, normalized, pageRegion()) };
}

function formulaBlock(number: string, suffix: string, formula: FormulaRow) {
    return { blockId: `${uid(number)}#block-${suffix}`, kind: "formula-ref", origin: "official", assetId: formulaId(formula.number), evidence: evidence(formula.page, formula.raw, formula.raw, formula.region, true) };
}

function tableBlock(number: string, suffix: string, page: number, asset: string, region: Region) {
    const raw = "Tabella C4.2.I – Valori massimi delle imperfezioni locali";
    return { blockId: `${uid(number)}#block-${suffix}`, kind: "table-ref", origin: "official", assetId: asset, evidence: evidence(page, raw, raw, region, true) };
}

function figureBlock(number: string, suffix: string, page: number, asset: string, region: Region) {
    const raw = `Figura ${asset.split(":").at(-1)?.toUpperCase()}`;
    return { blockId: `${uid(number)}#block-${suffix}`, kind: "figure-ref", origin: "official", assetId: asset, evidence: evidence(page, raw, raw, region, true) };
}

function parent(number: string) {
    const parts = number.split(".");
    return parts.length === 1 ? null : uid(parts.slice(0, -1).join("."));
}

function ancestors(number: string) {
    const parts = number.split(".");
    return parts.slice(1).map((_, index) => uid(parts.slice(0, index + 1).join(".")));
}

function relation(number: string) {
    return [{
        relationId: `${uid(number)}#relation-001`,
        type: "clarifies",
        targetUnitId: `urn:structural-codes:it:unit:ntc2018:${number.replace(/^C/, "")}`,
        basis: "editorial",
        evidenceBlockIds: [`${uid(number)}#block-heading`],
        rationale: "Corrispondenza proposta tra numerazione omologa della Circolare e delle NTC; non implica ancora equivalenza semantica completa.",
        review: { status: "proposed", reviewedBy: null, reviewedAt: null },
    }];
}

function makeUnit(number: string, title: string, blocks: GeneratedBlock[], formulas: string[] = [], tables: string[] = [], figures: string[] = []) {
    const kind = number === "C4.2" ? "section" : "subparagraph";
    return {
        $schema: "urn:structural-codes:schema:canonical-unit:v2",
        schemaVersion: "2.0.0-alpha.2",
        recordType: "canonical-unit",
        id: uid(number),
        workId,
        expressionId,
        kind,
        numbering: { official: number, sortKey: number.replace(/^C/, "").split(".").map((part) => part.padStart(3, "0")).join(".") },
        title,
        titleBlockId: `${uid(number)}#block-heading`,
        hierarchy: { parentId: parent(number), ancestorIds: ancestors(number), position: Number(number.split(".").at(-1)?.replace(/^C/, "") ?? "1") },
        validity: { from: null, to: null, status: "unknown", asOf: "2026-08-09" },
        blocks,
        citations: [],
        relations: relationless.has(number) ? [] : relation(number),
        assets: { formulaIds: formulas.map(formulaId), tableIds: tables.map(tableId), figureIds: figures.map(figureId) },
        workflow: {
            status: "extracted",
            createdBy: { actorId: "codex:circ42-step1", kind: "automated-agent", toolVersion: profile },
            createdAt,
            reviews: [],
            openIssues: [
                { issueId: `circ2019-${number.replaceAll(".", "-")}-source-review`, type: "normalization-review", severity: "blocking", note: "Record trascritto dall’evidence ufficiale ma non ancora confrontato integralmente da un revisore umano con il render della fonte." },
                ...(tables.length || figures.length ? [{ issueId: `circ2019-${number.replaceAll(".", "-")}-assets`, type: "asset-review", severity: "blocking", note: "Tabelle e figure sono strutturate o ritagliate dalla fonte; resta obbligatoria la revisione umana indipendente." }] : []),
            ],
        },
    };
}

const tI = tableId("C4.2.I");
const g = (number: string) => figureId(number);

const formulaRows: FormulaRow[] = [
    { number: "C4.2.1", unit: "C4.2.3.1", page: 101, latex: "\\bar{k}=\\sqrt{\\frac{f_{yk}}{\\gamma_{M0}\\cdot\\sigma_{c,Ed}}}", raw: "k̄ = √(fyk/(γM0·σc,Ed)) [C4.2.1]", region: reg(120, 130, 360, 100) },
    { number: "C4.2.2", unit: "C4.2.3.3", page: 101, latex: "M_{pl,Rd}=\\frac{W_{pl}f_{yk}}{\\gamma_{M0}}", raw: "Mpl,Rd = Wpl·fyk/γM0 [C4.2.2]", region: reg(140, 260, 320, 100) },
    { number: "C4.2.3", unit: "C4.2.3.3", page: 101, latex: "a^*=\\max\\left(2d;L_{0{,}8M_p}\\right)", raw: "a* = max(2d; L0,8Mp) [C4.2.3]", region: reg(120, 500, 360, 100) },
    { number: "C4.2.4", unit: "C4.2.3.3", page: 101, latex: "\\frac{A\\cdot f_{yk}}{\\gamma_{M0}}\\le\\frac{0{,}9\\cdot A_{net}\\cdot f_{tk}}{\\gamma_{M2}}", raw: "A·fyk/γM0 ≤ 0,9·Anet·ftk/γM2 [C4.2.4]", region: reg(110, 610, 380, 100) },
    { number: "C4.2.5", unit: "C4.2.3.4", page: 102, latex: "\\alpha_{cr}=\\frac{h\\cdot H_{Ed}}{\\delta\\cdot V_{Ed}}", raw: "αcr = h·HEd/(δ·VEd) [C4.2.5]", region: reg(130, 270, 340, 100) },
    { number: "C4.2.6", unit: "C4.2.3.4", page: 102, latex: "\\bar{\\lambda}\\le0{,}3\\cdot\\sqrt{\\frac{A\\cdot f_{yk}}{N_{Ed}}}", raw: "λ̄ ≤ 0,3·√(A·fyk/NEd) [C4.2.6]", region: reg(120, 490, 350, 100) },
    { number: "C4.2.7", unit: "C4.2.3.5", page: 102, latex: "\\phi=\\alpha_h\\alpha_m\\phi_0", raw: "φ = αh·αm·φ0 [C4.2.7]", region: reg(110, 640, 370, 100) },
    { number: "C4.2.8", unit: "C4.2.3.5", page: 102, latex: "\\frac{2}{3}\\le\\alpha_h=\\frac{2}{\\sqrt{h}}\\le1{,}0\\quad\\text{e da}\\quad\\alpha_m=\\sqrt{\\frac{1}{2}\\left(1+\\frac{1}{m}\\right)}", raw: "2/3 ≤ αh = 2/√h ≤ 1,0 e da αm = √(1/2(1+1/m)) [C4.2.8]", region: reg(110, 680, 370, 100) },
    { number: "C4.2.9", unit: "C4.2.3.5", page: 103, latex: "H_{Ed}\\ge0{,}15\\cdot V_{Ed}", raw: "HEd ≥ 0,15·VEd [C4.2.9]", region: reg(110, 250, 380, 100) },
    { number: "C4.2.10", unit: "C4.2.3.5", page: 103, latex: "\\bar{\\lambda}\\ge0{,}5\\cdot\\sqrt{\\frac{A\\cdot f_y}{N_{Ed}}}", raw: "λ̄ ≥ 0,5·√(A·fy/NEd) [C4.2.10]", region: reg(110, 460, 380, 100) },
    { number: "C4.2.11", unit: "C4.2.3.5", page: 103, latex: "F_h=\\phi\\cdot N_{Ed}", raw: "Fh = φ·NEd [C4.2.11]", region: reg(110, 530, 380, 100) },
    { number: "C4.2.12", unit: "C4.2.3.5", page: 103, latex: "q_h=\\frac{8\\cdot e_{0,d}\\cdot N_{Ed}}{L^2}", raw: "qh = 8·e0,d·NEd/L² [C4.2.12]", region: reg(110, 570, 380, 100) },
    { number: "C4.2.13", unit: "C4.2.3.5", page: 104, latex: "e_0=\\alpha_m\\cdot\\frac{L}{500}", raw: "e0 = αm·L/500 [C4.2.13]", region: reg(110, 110, 380, 100) },
    { number: "C4.2.14", unit: "C4.2.3.5", page: 104, latex: "\\alpha_m=\\sqrt{\\frac{1}{2}\\left(1+\\frac{1}{m}\\right)}", raw: "αm = √(1/2(1+1/m)) [C4.2.14]", region: reg(110, 155, 380, 100) },
    { number: "C4.2.15", unit: "C4.2.3.5", page: 104, latex: "q_d=\\frac{8\\left(e_0+\\delta_q\\right)N_{Ed}}{L^2}", raw: "qd = 8(e0+δq)NEd/L² [C4.2.15]", region: reg(110, 340, 390, 100) },
    { number: "C4.2.16", unit: "C4.2.3.5", page: 104, latex: "N_{Ed}=\\frac{M_{Ed}}{h}", raw: "NEd = MEd/h [C4.2.16]", region: reg(110, 440, 380, 100) },
    { number: "C4.2.17", unit: "C4.2.3.5", page: 104, latex: "F_d=\\alpha_m\\cdot\\phi_0=\\frac{\\alpha_m\\cdot N_{Ed}}{100}", raw: "Fd = αm·φ0 = αm·NEd/100 [C4.2.17]", region: reg(110, 620, 380, 100) },
    { number: "C4.2.18", unit: "C4.2.3.6", page: 105, latex: "\\beta=\\frac{\\alpha_{cr}}{\\alpha_{cr}-1}", raw: "β = αcr/(αcr−1) [C4.2.18]", region: reg(110, 400, 380, 100) },
    { number: "C4.2.19", unit: "C4.2.3.7", page: 105, latex: "\\frac{h}{t_f}\\le40\\cdot\\varepsilon", raw: "h/tf ≤ 40·ε [C4.2.19]", region: reg(110, 530, 380, 100) },
    { number: "C4.2.3.7-epsilon", unit: "C4.2.3.7", page: 105, latex: "\\varepsilon=\\sqrt{\\frac{235\\,\\mathrm{MPa}}{f_{yk}}}", raw: "ε = √(235 MPa/fyk)", region: reg(110, 565, 380, 80) },
    { number: "C4.2.20", unit: "C4.2.3.7", page: 105, latex: "L_s=\\begin{cases}35\\cdot\\varepsilon\\cdot i_z & \\text{per }0{,}625\\le\\psi\\le1{,}0\\\\(60-40\\cdot\\psi)\\cdot\\varepsilon\\cdot i_z & \\text{per }-1\\le\\psi<0{,}625\\end{cases}", raw: "Ls = 35·ε·iz per 0,625 ≤ ψ ≤ 1,0; Ls = (60−40·ψ)·ε·iz per −1 ≤ ψ < 0,625 [C4.2.20]", region: reg(110, 620, 380, 100) },
    { number: "C4.2.3.7-psi", unit: "C4.2.3.7", page: 105, latex: "\\psi=\\frac{M_{Ed,min}}{M_{pl,Rd}}", raw: "ψ = MEd,min/Mpl,Rd", region: reg(110, 700, 380, 80) },
];

const formulaByNumber = new Map(formulaRows.map((row) => [row.number, row]));
const formula = (number: string) => formulaByNumber.get(number)!;

const tableI = {
    id: tI,
    unitId: uid("C4.2.3.5"),
    officialNumber: "C4.2.I",
    pdfPage: 104,
    caption: "Valori massimi delle imperfezioni locali",
    columnCount: 4,
    headers: [[
        { text: "Schema grafico dell’imperfezione locale" },
        { text: "Curva d’instabilità (v. Tab. C4.2.VIII NTC)" },
        { text: "e0/L (analisi globale elastica)", latex: "e_0/L" },
        { text: "e0/L (analisi globale plastica)", latex: "e_0/L" },
    ]],
    rows: [
        [{ text: "Schema grafico dell’imperfezione locale e0/L", rowSpan: 5 }, { text: "a₀" }, { text: "1/350" }, { text: "1/300" }],
        [{ text: "a" }, { text: "1/300" }, { text: "1/250" }],
        [{ text: "b" }, { text: "1/250" }, { text: "1/200" }],
        [{ text: "c" }, { text: "1/200" }, { text: "1/150" }],
        [{ text: "d" }, { text: "1/150" }, { text: "1/100" }],
    ],
    notes: ["La prima colonna contiene lo schema grafico ufficiale dell’imperfezione locale e0/L; la trascrizione tabellare richiede verifica umana cella per cella.", "La distanza è misurata tra i centri di due collegamenti successivi e imin è il raggio d’inerzia minimo del singolo profilo costituente l’asta."],
};

const figureRows = [
    { number: "C4.2.1", unit: "C4.2.3.4", page: 102, caption: "Configurazione deformata di strutture a telaio sotto azioni orizzontali e verticali", alt: "Configurazione deformata di strutture a telaio sotto azioni orizzontali e verticali, con h, HEd, VEd e δHEd.", region: reg(150, 390, 340, 90), source: "page-0102-x150-y390-w340-h90@3x.png", sha256: "f35664adcde38f7b01b6ff727a717e98a77e5e911a825582ecd563ee96f8884b" },
    { number: "C4.2.2", unit: "C4.2.3.5", page: 103, caption: "Imperfezioni globali equivalenti", alt: "Imperfezioni globali equivalenti φ in un telaio e in un sistema controventato.", region: reg(125, 105, 350, 125), source: "page-0103-x125-y105-w350-h125@3x.png", sha256: "e51b5fbc860e3168306394ac7fc4b5272bd2bdaa208f136bd60b6fa1cacfb34c" },
    { number: "C4.2.3", unit: "C4.2.3.5", page: 103, caption: "Effetti delle imperfezioni sugli orizzontamenti", alt: "Effetti delle imperfezioni sugli orizzontamenti, con forze H_i e N_Ed.", region: reg(150, 320, 310, 125), source: "page-0103-x150-y320-w310-h125@3x.png", sha256: "85fe0d55ceff497bf6cec6432bab43551734a857fbb846c996c70b38be54842f" },
    { number: "C4.2.4", unit: "C4.2.3.5", page: 103, caption: "Sistemi di forze equivalenti alle imperfezioni", alt: "Sistemi di forze equivalenti alle imperfezioni globali e locali.", region: reg(120, 610, 380, 125), source: "page-0103-x120-y610-w380-h125@3x.png", sha256: "7d6f1d3bee2901e9c010e5634e68cf81cfa9d45f91156754d7a858a08129a25c" },
    { number: "C4.2.5", unit: "C4.2.3.5", page: 104, caption: "Forze equivalenti in sistemi di controvento", alt: "Forze equivalenti in un sistema di controvento, con e0, qd, NEd e L.", region: reg(150, 510, 330, 120), source: "page-0104-x150-y510-w330-h120@3x.png", sha256: "5efd28e9fcb2cbe4a19e299d1eae8b5905eef13c42c2de643c7ac317de281afa" },
    { number: "C4.2.6", unit: "C4.2.3.5", page: 105, caption: "Forze equivalenti nelle giunzioni di elementi o piattabande compresse", alt: "Forze equivalenti nelle giunzioni di elementi o piattabande compresse, con φNEd e 2φNEd.", region: reg(150, 80, 330, 175), source: "page-0105-x150-y80-w330-h175@3x.png", sha256: "d2c9917b0f0cd5520dec6dc8e0e7503530e681c2e9e4f1b110f7272ca987dcc0" },
];

const units = [
    makeUnit("C4.2", "COSTRUZIONI DI ACCIAIO", [
        block("C4.2", "heading", "heading", 100, "C4.2 COSTRUZIONI DI ACCIAIO"),
        block("C4.2", "p1", "paragraph", 100, "Novità assoluta è la possibilità di impiego di acciai inossidabili, sebbene le regole fornite dalla norma debbano essere integrate con normative di comprovata validità."),
        block("C4.2", "p2", "paragraph", 100, "La classificazione delle sezioni in termini di resistenza e capacità di rotazione, conforme la UNI EN 1993, permane come la connessa individuazione dei metodi di analisi strutturale e dei criteri di verifica applicabili."),
        block("C4.2", "p3", "paragraph", 100, "Per l’analisi globale delle strutture è stato confermato l’impiego, oltre del classico metodo elastico, anche del metodo plastico, il metodo elastico con ridistribuzione o il metodo elastoplastico, se soddisfatte certe condizioni."),
        block("C4.2", "p4", "paragraph", 100, "Le unioni chiodate, bullonate, ad attrito con bulloni AR, saldate a piena penetrazione e saldate a cordoni d’angolo o a parziale penetrazione sono trattate diffusamente; le saldature a cordoni d’angolo o a parziale penetrazione possono essere verificate sia mediante il classico approccio nazionale che considera la sezione di gola del cordone ribaltata sui lati del cordone stesso, sia mediante l’approccio della UNI EN 1993, che considera la sezione di gola nell’effettiva posizione."),
        block("C4.2", "p5", "paragraph", 100, "Le suddette regole generali di progettazione ed esecuzione per le Costruzioni di acciaio sono opportunamente integrate, nel § 7.5 delle NTC, per l’impiego in zona sismica."),
        block("C4.2", "p6", "paragraph", 100, "Il richiamo alla norma UNI EN 1090-2:2011, riportato al secondo capoverso del § 4.2 delle NTC, in virtù dell’estensiva trattazione di tutto il processo realizzativo di un’opera in acciaio che essa contiene, implica che già in sede di progetto si tenga conto di diversi aspetti riguardanti le fasi di esecuzione e di installazione in cantiere delle strutture."),
        block("C4.2", "p7", "paragraph", 100, "Tra le principali innovazioni che la norma europea contiene vi sono, in particolare"),
        block("C4.2", "li1", "list-item", 100, "l’indicazione della classe di esecuzione del componente strutturale"),
        block("C4.2", "li2", "list-item", 100, "l’indicazione del grado di preparazione delle superfici all’esecuzione del trattamento superficiale previsto di protezione dalla corrosione"),
        block("C4.2", "li3", "list-item", 100, "l’indicazione dei valori delle tolleranze geometriche, essenziali e funzionali"),
        block("C4.2", "p8", "paragraph", 100, "E’ pertanto compito del progettista individuare, definire e specificare i contenuti delle suddette informazioni e riportarne i riferimenti nel documento specifico che la norma UNI EN 1090-2 definisce “Specifica di esecuzione”."),
    ]),
    makeUnit("C4.2.1", "MATERIALI", [
        block("C4.2.1", "heading", "heading", 100, "C4.2.1 MATERIALI"),
        block("C4.2.1", "p1", "paragraph", 100, "Per quanto attiene le costruzioni di acciaio la gamma degli acciai da carpenteria laminati a caldo e formati a freddo normalmente impiegabili è compresa tra l’acciaio S235 e l’acciaio S460. E’ introdotta la possibilità di impiego di acciai inossidabili."),
    ]),
    makeUnit("C4.2.2", "VALUTAZIONE DELLA SICUREZZA", [
        block("C4.2.2", "heading", "heading", 100, "C4.2.2 VALUTAZIONE DELLA SICUREZZA"),
        block("C4.2.2", "p1", "paragraph", 100, "Alcune problematiche specifiche, quali l’instabilità, la fatica e la fragilità alle basse temperature sono trattate nelle NTC in termini generali, approfondendo soltanto gli aspetti applicativi maggiormente ricorrenti e rimandando, per questioni di dettaglio o molto specialistiche, a normative di comprovata validità."),
    ]),
    makeUnit("C4.2.3", "ANALISI STRUTTURALE", [
        block("C4.2.3", "heading", "heading", 100, "C4.2.3 ANALISI STRUTTURALE"),
        block("C4.2.3", "p1", "paragraph", 100, "Nell’analisi strutturale si devono considerare, se rilevanti, tutti gli effetti che possono influenzare la resistenza e/o la rigidezza della struttura e il suo comportamento, quali, ad esempio, imperfezioni, effetti del secondo ordine, fenomeni d’instabilità locale, effetti di trascinamento da taglio."),
    ]),
    makeUnit("C4.2.3.1", "CLASSIFICAZIONE DELLE SEZIONI", [
        block("C4.2.3.1", "heading", "heading", 100, "C4.2.3.1 CLASSIFICAZIONE DELLE SEZIONI"),
        block("C4.2.3.1", "p1", "paragraph", 100, "La classificazione delle sezioni ricorrenti è riportata nel § 4.2.3.1 delle NTC (Tabella 4.2.III)."),
        block("C4.2.3.1", "p2", "paragraph", 100, "Scopo della classificazione delle sezioni di acciaio è quello di quantificare l’influenza dei fenomeni di instabilità locale sulla resistenza e sulla capacità deformativa delle sezioni di acciaio."),
        block("C4.2.3.1", "p3", "paragraph", 100, "Le Tabelle 4.2.III÷V delle NTC forniscono indicazioni per definire se una sezione appartiene alle classi 1, 2 o 3; il metodo di classificazione proposto dipende dal rapporto tra la larghezza e lo spessore delle parti della sezione soggette a compressione, per cui nel procedimento di classificazione devono essere considerate tutte quelle parti completamente o parzialmente compresse."),
        block("C4.2.3.1", "p4", "paragraph", 100, "La sezione è in genere classificata secondo la classe più sfavorevole delle sue parti compresse."),
        block("C4.2.3.1", "p5", "paragraph", 100, "In alternativa, è possibile procedere ad una classificazione separata delle flange e dell’anima della sezione, limitando localmente, all’interno della sezione, le capacità plastiche delle singole parti. Le sezioni che non soddisfano i requisiti imposti per la classe 3 sono di classe 4."),
        block("C4.2.3.1", "p6", "paragraph", 100, "Oltre che mediante il procedimento semplificato proposto nelle Tabelle 4.2.III÷V delle NTC, è possibile classificare una sezione strutturale anche tramite la determinazione della sua capacità rotazionale e quindi delle sue proprietà plastiche complessive, facendo riferimento a metodologie di calcolo di riconosciuta validità."),
        block("C4.2.3.1", "p7", "paragraph", 101, "Ad eccezione delle verifiche di stabilità, che devono essere condotte con stretto riferimento alla classificazione della Tabella 4.2.III delle NTC, una parte di sezione di classe 4 può essere trattata come una parte di sezione di classe 3 se è caratterizzata da un rapporto larghezza/spessore entro il limite previsto per la classe 3, incrementato di k̄².", [text("Ad eccezione delle verifiche di stabilità, che devono essere condotte con stretto riferimento alla classificazione della Tabella 4.2.III delle NTC, una parte di sezione di classe 4 può essere trattata come una parte di sezione di classe 3 se è caratterizzata da un rapporto larghezza/spessore entro il limite previsto per la classe 3, incrementato di "), math("k̄²", "\\bar{k}^2"), text(".")]),
        formulaBlock("C4.2.3.1", "formula-c4-2-1", formula("C4.2.1")),
        block("C4.2.3.1", "p8", "paragraph", 101, "essendo σc,Ed la massima tensione di compressione indotta nella parte considerata dalle azioni di progetto.", [text("essendo "), math("σc,Ed", "\\sigma_{c,Ed}"), text(" la massima tensione di compressione indotta nella parte considerata dalle azioni di progetto.")]),
        block("C4.2.3.1", "p9", "paragraph", 101, "Il calcolo delle sezioni di classe 4 può essere effettuato in riferimento alle metodologie di calcolo descritte nel § C4.2.12."),
    ], ["C4.2.1"]),
    makeUnit("C4.2.3.3", "METODI DI ANALISI GLOBALE", [
        block("C4.2.3.3", "heading", "heading", 101, "C4.2.3.3 METODI DI ANALISI GLOBALE"),
        block("C4.2.3.3", "p1", "paragraph", 101, "I metodi di analisi globale sono indicati al § 4.2.3.3 delle NTC."),
        block("C4.2.3.3", "p2", "paragraph", 101, "I metodi di analisi globale elastico (E) o elastoplastico (EP) possono essere utilizzati per sezioni di classe qualsiasi, come indicato nella Tabella 4.2.VI delle NTC."),
        block("C4.2.3.3", "p3", "paragraph", 101, "Il metodo di analisi globale plastico (P) può essere impiegato se sono soddisfatte alcune condizioni, in particolare se si possono escludere fenomeni di instabilità e se le sezioni in cui sono localizzate le cerniere plastiche, in cui, cioè, il momento flettente è uguale a", [text("Il metodo di analisi globale plastico (P) può essere impiegato se sono soddisfatte alcune condizioni, in particolare se si possono escludere fenomeni di instabilità e se le sezioni in cui sono localizzate le cerniere plastiche, in cui, cioè, il momento flettente è uguale a")]),
        formulaBlock("C4.2.3.3", "formula-c4-2-2", formula("C4.2.2")),
        block("C4.2.3.3", "p4", "paragraph", 101, "hanno sufficiente capacità di rotazione. Nella [C4.2.2] Wpl è il modulo plastico della sezione, fyk è la tensione di snervamento caratteristica e γM0=1,05 (v. Tabella 4.2.VII delle NTC).", [text("hanno sufficiente capacità di rotazione. Nella [C4.2.2] "), math("Wpl", "W_{pl}"), text(" è il modulo plastico della sezione, "), math("fyk", "f_{yk}"), text(" è la tensione di snervamento caratteristica e "), math("γM0", "\\gamma_{M0}"), text("=1,05 (v. Tabella 4.2.VII delle NTC).")]),
        block("C4.2.3.3", "p5", "paragraph", 101, "Le porzioni di trave in corrispondenza ed in prossimità delle cerniere plastiche devono essere assicurate nei confronti dei fenomeni di instabilità flesso-torsionale e dell’equilibrio in generale, disponendo, se necessario, appositi ritegni torsionali e controllando la classificazione della sezione trasversale del profilo lungo tale porzione. In tal modo é possibile garantire la capacità rotazionale in tutte le sezioni in cui si possano formare delle cerniere plastiche sotto i carichi di progetto."),
        block("C4.2.3.3", "p6", "paragraph", 101, "Se la cerniera è localizzata in una membratura, la sezione della membratura deve essere simmetrica rispetto al piano di sollecitazione; se la cerniera è localizzata in una giunzione, la giunzione deve avere una capacità di rotazione, valutata secondo metodologie di riconosciuta validità, maggiore di quella richiesta. Nel caso in cui la cerniera plastica si sviluppi all’interno della membratura, la giunzione deve essere comunque dotata di un livello di sovraresistenza tale da evitare che la cerniera plastica possa interessare la giunzione."),
        block("C4.2.3.3", "p7", "paragraph", 101, "In assenza di più accurate determinazioni:"),
        block("C4.2.3.3", "li1", "list-item", 101, "in membrature a sezione costante, la capacità di rotazione richiesta si intende assicurata se la sezione in cui si forma la cerniera plastica è di classe 1 secondo il § 4.2.3.1 delle NTC; inoltre, qualora nella sezione il rapporto tra il taglio di progetto e la resistenza plastica a taglio della sezione risulti maggiore di 0,1, si devono disporre irrigidimenti trasversali d’anima a distanza non superiore a 0,5 h dalla cerniera, essendo h l’altezza della trave.", [text("in membrature a sezione costante, la capacità di rotazione richiesta si intende assicurata se la sezione in cui si forma la cerniera plastica è di classe 1 secondo il § 4.2.3.1 delle NTC; inoltre, qualora nella sezione il rapporto tra il taglio di progetto e la resistenza plastica a taglio della sezione risulti maggiore di 0,1, si devono disporre irrigidimenti trasversali d’anima a distanza non superiore a 0,5 "), math("h", "h"), text(" dalla cerniera, essendo "), math("h", "h"), text(" l’altezza della trave.")]),
        block("C4.2.3.3", "li2", "list-item", 101, "in membrature a sezione variabile, la capacità di rotazione richiesta si intende assicurata se la sezione in cui si forma la cerniera plastica è di classe 1 per un tratto pari ad a*,", [text("in membrature a sezione variabile, la capacità di rotazione richiesta si intende assicurata se la sezione in cui si forma la cerniera plastica è di classe 1 per un tratto pari ad "), math("a*", "a^*"), text(",")]),
        formulaBlock("C4.2.3.3", "formula-c4-2-3", formula("C4.2.3")),
        block("C4.2.3.3", "li2-cont", "list-item", 101, "da ciascun lato della cerniera, essendo d l’altezza netta dell’anima in corrispondenza della cerniera e L0,8Mpl,Rd la distanza tra la cerniera in cui il momento flettente assume il valore plastico di calcolo, Mpl,Rd, e la sezione in cui il momento flettente vale 0,8 Mpl,Rd, e se, inoltre, risulta che lo spessore dell’anima si mantiene costante nell’intervallo [-2d, 2d] centrato sulla cerniera plastica, e che, contemporaneamente, al di fuori delle zone sopra menzionate, la piattabanda compressa è di classe 1 o 2 e l’anima non è di classe 4.", [text("da ciascun lato della cerniera, essendo "), math("d", "d"), text(" l’altezza netta dell’anima in corrispondenza della cerniera e "), math("L0,8Mpl,Rd", "L_{0{,}8M_{pl,Rd}}"), text(" la distanza tra la cerniera in cui il momento flettente assume il valore plastico di calcolo, "), math("Mpl,Rd", "M_{pl,Rd}"), text(", e la sezione in cui il momento flettente vale 0,8 "), math("Mpl,Rd", "M_{pl,Rd}"), text(", e se, inoltre, risulta che lo spessore dell’anima si mantiene costante nell’intervallo [-2"), math("d", "d"), text(", 2"), math("d", "d"), text("] centrato sulla cerniera plastica, e che, contemporaneamente, al di fuori delle zone sopra menzionate, la piattabanda compressa è di classe 1 o 2 e l’anima non è di classe 4.")]),
        block("C4.2.3.3", "p8", "paragraph", 101, "Le zone tese indebolite dai fori, poste a distanza dalla cerniera plastica minore di a*, debbono comunque soddisfare il principio di gerarchia delle resistenze indicato al § 4.2.4.1.2 delle NTC", [text("Le zone tese indebolite dai fori, poste a distanza dalla cerniera plastica minore di "), math("a*", "a^*"), text(", debbono comunque soddisfare il principio di gerarchia delle resistenze indicato al § 4.2.4.1.2 delle NTC")]),
        formulaBlock("C4.2.3.3", "formula-c4-2-4", formula("C4.2.4")),
        block("C4.2.3.3", "p9", "paragraph", 101, "dove A è l’area lorda, Anet è l’area netta, ftk è la resistenza a rottura caratteristica e γM2=1,25.", [text("dove "), math("A", "A"), text(" è l’area lorda, "), math("Anet", "A_{net}"), text(" è l’area netta, "), math("ftk", "f_{tk}"), text(" è la resistenza a rottura caratteristica e "), math("γM2", "\\gamma_{M2}"), text("=1,25.")]),
        block("C4.2.3.3", "p10", "paragraph", 101, "È ammesso il ricorso al metodo di analisi elastico con ridistribuzione purché l’entità dei momenti da ridistribuire sia non superiore a 0,15 Mpl,Rd, il diagramma dei momenti sia staticamente ammissibile, le sezioni delle membrature in cui si attua la ridistribuzione siano di classe 1 o 2 e siano esclusi fenomeni di instabilità.", [text("È ammesso il ricorso al metodo di analisi elastico con ridistribuzione purché l’entità dei momenti da ridistribuire sia non superiore a 0,15 "), math("Mpl,Rd", "M_{pl,Rd}"), text(", il diagramma dei momenti sia staticamente ammissibile, le sezioni delle membrature in cui si attua la ridistribuzione siano di classe 1 o 2 e siano esclusi fenomeni di instabilità.")]),
    ], ["C4.2.2", "C4.2.3", "C4.2.4"]),
    makeUnit("C4.2.3.4", "EFFETTI DELLE DEFORMAZIONI", [
        block("C4.2.3.4", "heading", "heading", 102, "C4.2.3.4 EFFETTI DELLE DEFORMAZIONI"),
        block("C4.2.3.4", "p1", "paragraph", 102, "Nel § 4.2.3.4 delle NTC si stabilisce che l’analisi globale della struttura può essere eseguita con la teoria del primo ordine quando il moltiplicatore dei carichi αcr che induce l’instabilità della struttura è maggiore o uguale a 10, se si esegue un’analisi elastica, o a 15, se si esegue un’analisi plastica.", [text("Nel § 4.2.3.4 delle NTC si stabilisce che l’analisi globale della struttura può essere eseguita con la teoria del primo ordine quando il moltiplicatore dei carichi "), math("αcr", "\\alpha_{cr}"), text(" che induce l’instabilità della struttura è maggiore o uguale a 10, se si esegue un’analisi elastica, o a 15, se si esegue un’analisi plastica.")]),
        block("C4.2.3.4", "p2", "paragraph", 102, "Il coefficiente αcr è il minimo fattore del quale devono essere incrementati i carichi applicati alla struttura per causare il primo fenomeno di instabilità elastica globale, ovvero che coinvolge l’intera struttura. Tali valori possono essere ottenuti da apposite analisi elastiche (o di “buckling”) condotte in genere utilizzando programmi di calcolo strutturale od apposite procedure numeriche.", [text("Il coefficiente "), math("αcr", "\\alpha_{cr}"), text(" è il minimo fattore del quale devono essere incrementati i carichi applicati alla struttura per causare il primo fenomeno di instabilità elastica globale, ovvero che coinvolge l’intera struttura. Tali valori possono essere ottenuti da apposite analisi elastiche (o di “buckling”) condotte in genere utilizzando programmi di calcolo strutturale od apposite procedure numeriche.")]),
        block("C4.2.3.4", "p3", "paragraph", 102, "Una forte limitazione al calcolo del moltiplicatore dei carichi αcr con l’analisi plastica deriva dalla significativa influenza che le proprietà non-lineari dei materiali allo stato limite ultimo hanno sul comportamento di alcune tipologie strutturali (ad esempio telai in cui si formino delle cerniere plastiche con ridistribuzione del momento flettente, oppure strutture con un comportamento fortemente non-lineare quali telai con nodi semi-rigidi o strutture con stralli o tiranti). In tali casi l’analisi plastica deve seguire approcci risolutivi molto più accurati che nel caso elastico; inoltre il valore limite di 15 può considerarsi valido solo per tipologie strutturali largamente utilizzate nella pratica e di semplice organizzazione dello schema strutturale. Per strutture più complesse devono essere reperiti valori limite idonei in normative di comprovata validità.", [text("Una forte limitazione al calcolo del moltiplicatore dei carichi "), math("αcr", "\\alpha_{cr}"), text(" con l’analisi plastica deriva dalla significativa influenza che le proprietà non-lineari dei materiali allo stato limite ultimo hanno sul comportamento di alcune tipologie strutturali (ad esempio telai in cui si formino delle cerniere plastiche con ridistribuzione del momento flettente, oppure strutture con un comportamento fortemente non-lineare quali telai con nodi semi-rigidi o strutture con stralli o tiranti). In tali casi l’analisi plastica deve seguire approcci risolutivi molto più accurati che nel caso elastico; inoltre il valore limite di 15 può considerarsi valido solo per tipologie strutturali largamente utilizzate nella pratica e di semplice organizzazione dello schema strutturale. Per strutture più complesse devono essere reperiti valori limite idonei in normative di comprovata validità.")]),
        block("C4.2.3.4", "p4", "paragraph", 102, "Nel caso di telai multipiano e nel caso di portali con falde poco inclinate, il moltiplicatore critico αcr può essere stimato mediante l’espressione", [text("Nel caso di telai multipiano e nel caso di portali con falde poco inclinate, il moltiplicatore critico "), math("αcr", "\\alpha_{cr}"), text(" può essere stimato mediante l’espressione")]),
        formulaBlock("C4.2.3.4", "formula-c4-2-5", formula("C4.2.5")),
        block("C4.2.3.4", "p5", "paragraph", 102, "in cui HEd è il valore di progetto del taglio alla base dei pilastri della stilata considerata (taglio di piano), VEd è il valore di progetto della forza normale alla base dei pilastri della stilata considerata, h è l’altezza d’interpiano e δ lo spostamento d’interpiano. Nel calcolo di HEd e di δ si devono considerare, oltre alle forze orizzontali esplicite, anche quelle fittizie dovute alle imperfezioni, calcolate come indicato al § C4.2.3.5.", [text("in cui "), math("HEd", "H_{Ed}"), text(" è il valore di progetto del taglio alla base dei pilastri della stilata considerata (taglio di piano), "), math("VEd", "V_{Ed}"), text(" è il valore di progetto della forza normale alla base dei pilastri della stilata considerata, "), math("h", "h"), text(" è l’altezza d’interpiano e "), math("δ", "\\delta"), text(" lo spostamento d’interpiano. Nel calcolo di "), math("HEd", "H_{Ed}"), text(" e di "), math("δ", "\\delta"), text(" si devono considerare, oltre alle forze orizzontali esplicite, anche quelle fittizie dovute alle imperfezioni, calcolate come indicato al § C4.2.3.5.")]),
        figureBlock("C4.2.3.4", "figure-c4-2-1", 102, g("C4.2.1"), figureRows[0]!.region),
        block("C4.2.3.4", "p6", "paragraph", 102, "L’applicazione della [C4.2.5] richiede che la forza normale di progetto NEd nelle travi sia poco significativa. In assenza di valutazioni più precise, questa condizione si intende soddisfatta se la snellezza adimensionale λ̄ della trave, considerata incernierata alle estremità, soddisfa la condizione", [text("L’applicazione della [C4.2.5] richiede che la forza normale di progetto "), math("NEd", "N_{Ed}"), text(" nelle travi sia poco significativa. In assenza di valutazioni più precise, questa condizione si intende soddisfatta se la snellezza adimensionale "), math("λ̄", "\\bar{\\lambda}"), text(" della trave, considerata incernierata alle estremità, soddisfa la condizione")]),
        formulaBlock("C4.2.3.4", "formula-c4-2-6", formula("C4.2.6")),
        block("C4.2.3.4", "p7", "paragraph", 102, "dove A è l’area della trave.", [text("dove "), math("A", "A"), text(" è l’area della trave.")]),
    ], ["C4.2.5", "C4.2.6"], [], ["C4.2.1"]),
    makeUnit("C4.2.3.5", "EFFETTO DELLE IMPERFEZIONI", [
        block("C4.2.3.5", "heading", "heading", 102, "C4.2.3.5 EFFETTO DELLE IMPERFEZIONI"),
        block("C4.2.3.5", "p1", "paragraph", 102, "Nell’analisi strutturale le autotensioni, le tensioni residue ed i difetti geometrici, quali errori di verticalità, errori di rettilineità, disallineamenti, eccentricità accidentali dei giunti, possono essere considerati introducendo imperfezioni geometriche equivalenti globali o locali."),
        block("C4.2.3.5", "p2", "paragraph", 102, "Le imperfezioni globali equivalenti intervengono nell’analisi globale di strutture, in particolare telai e sistemi di controvento, mentre le imperfezioni locali si considerano per il calcolo di singoli elementi. Generalmente, la distribuzione delle imperfezioni può essere adottata coerente con quella corrispondente alla deformata critica relativa al modo instabile considerato."),
        block("C4.2.3.5", "p3", "paragraph", 102, "Per telai sensibili alle azioni orizzontali, indicata con h l’altezza totale del telaio, l’imperfezione globale, in termini di errore di verticalità (Figura C4.2.2), può essere assunta pari a", [text("Per telai sensibili alle azioni orizzontali, indicata con "), math("h", "h"), text(" l’altezza totale del telaio, l’imperfezione globale, in termini di errore di verticalità (Figura C4.2.2), può essere assunta pari a")]),
        formulaBlock("C4.2.3.5", "formula-c4-2-7", formula("C4.2.7")),
        block("C4.2.3.5", "p4", "paragraph", 102, "dove φ0 è il difetto di verticalità, φ0=h/200, e αh e αm sono due coefficienti riduttivi dati da", [text("dove "), math("φ0", "\\phi_0"), text(" è il difetto di verticalità, "), math("φ0", "\\phi_0"), text("=h/200, e "), math("αh", "\\alpha_h"), text(" e "), math("αm", "\\alpha_m"), text(" sono due coefficienti riduttivi dati da")]),
        formulaBlock("C4.2.3.5", "formula-c4-2-8", formula("C4.2.8")),
        block("C4.2.3.5", "p5", "paragraph", 103, "essendo m il numero dei pilastri di una stilata soggetti ad uno sforzo assiale di progetto NEd non minore del 50% della forza normale media di progetto agente sui pilastri della stilata stessa.", [text("essendo "), math("m", "m"), text(" il numero dei pilastri di una stilata soggetti ad uno sforzo assiale di progetto "), math("NEd", "N_{Ed}"), text(" non minore del 50% della forza normale media di progetto agente sui pilastri della stilata stessa.")]),
        figureBlock("C4.2.3.5", "figure-c4-2-2", 103, g("C4.2.2"), figureRows[1]!.region),
        block("C4.2.3.5", "p6", "paragraph", 103, "Per il calcolo degli effetti delle imperfezioni sugli orizzontamenti si può far riferimento agli schemi di Figura C4.2.3, in cui h è l’altezza d’interpiano e φ il valore dell’imperfezione, calcolato con la [C4.2.7].", [text("Per il calcolo degli effetti delle imperfezioni sugli orizzontamenti si può far riferimento agli schemi di Figura C4.2.3, in cui "), math("h", "h"), text(" è l’altezza d’interpiano e "), math("φ", "\\phi"), text(" il valore dell’imperfezione, calcolato con la [C4.2.7].")]),
        block("C4.2.3.5", "p7", "paragraph", 103, "Nell’analisi dei telai i difetti di verticalità possono essere trascurati quando", [text("Nell’analisi dei telai i difetti di verticalità possono essere trascurati quando")]),
        formulaBlock("C4.2.3.5", "formula-c4-2-9", formula("C4.2.9")),
        block("C4.2.3.5", "p8", "paragraph", 103, "con HEd e VEd definiti al § C4.2.3.4.", [text("con "), math("HEd", "H_{Ed}"), text(" e "), math("VEd", "V_{Ed}"), text(" definiti al § C4.2.3.4.")]),
        figureBlock("C4.2.3.5", "figure-c4-2-3", 103, g("C4.2.3"), figureRows[2]!.region),
        block("C4.2.3.5", "p9", "paragraph", 103, "Nel calcolo gli effetti delle imperfezioni locali possono essere generalmente trascurati. Nelle analisi globali di telai sensibili agli effetti del secondo ordine, tuttavia, può essere necessario considerare anche i difetti di rettilineità delle aste compresse che abbiano un vincolo rotazionale ad almeno un estremo e la cui snellezza adimensionale λ̄, calcolata considerando l’asta incernierata ad entrambi gli estremi, sia", [text("Nel calcolo gli effetti delle imperfezioni locali possono essere generalmente trascurati. Nelle analisi globali di telai sensibili agli effetti del secondo ordine, tuttavia, può essere necessario considerare anche i difetti di rettilineità delle aste compresse che abbiano un vincolo rotazionale ad almeno un estremo e la cui snellezza adimensionale "), math("λ̄", "\\bar{\\lambda}"), text(", calcolata considerando l’asta incernierata ad entrambi gli estremi, sia")]),
        formulaBlock("C4.2.3.5", "formula-c4-2-10", formula("C4.2.10")),
        block("C4.2.3.5", "p10", "paragraph", 103, "Le imperfezioni locali dei singoli elementi possono essere rappresentate considerando i valori degli scostamenti massimi dalla configurazione iniziale e0/L, dove L è la lunghezza dell’elemento, dati in Tabella C4.2.I in funzione della curva d’instabilità (v. Tabella 4.2.VIII delle NTC) e del tipo di analisi globale effettuata.", [text("Le imperfezioni locali dei singoli elementi possono essere rappresentate considerando i valori degli scostamenti massimi dalla configurazione iniziale "), math("e0/L", "e_0/L"), text(", dove "), math("L", "L"), text(" è la lunghezza dell’elemento, dati in Tabella C4.2.I in funzione della curva d’instabilità (v. Tabella 4.2.VIII delle NTC) e del tipo di analisi globale effettuata.")]),
        block("C4.2.3.5", "p11", "paragraph", 103, "Le imperfezioni globali possono essere sostituite con le forze concentrate Fh, applicate a ciascun orizzontamento e in copertura:", [text("Le imperfezioni globali possono essere sostituite con le forze concentrate "), math("Fh", "F_h"), text(", applicate a ciascun orizzontamento e in copertura:")]),
        formulaBlock("C4.2.3.5", "formula-c4-2-11", formula("C4.2.11")),
        block("C4.2.3.5", "p12", "paragraph", 103, "Le imperfezioni locali possono essere sostituite con forze distribuite qh equivalenti, applicate a ciascuna colonna, date da", [text("Le imperfezioni locali possono essere sostituite con forze distribuite "), math("qh", "q_h"), text(" equivalenti, applicate a ciascuna colonna, date da")]),
        formulaBlock("C4.2.3.5", "formula-c4-2-12", formula("C4.2.12")),
        block("C4.2.3.5", "p13", "paragraph", 103, "come indicato in Figura C4.2.4."),
        figureBlock("C4.2.3.5", "figure-c4-2-4", 103, g("C4.2.4"), figureRows[3]!.region),
        block("C4.2.3.5", "p14", "paragraph", 104, "Nell’analisi di un sistema di controvento, le imperfezioni del sistema controventato possono essere tenute in conto considerando uno scostamento di quest’ultimo dalla configurazione iniziale di valor massimo e0 uguale a", [text("Nell’analisi di un sistema di controvento, le imperfezioni del sistema controventato possono essere tenute in conto considerando uno scostamento di quest’ultimo dalla configurazione iniziale di valor massimo "), math("e0", "e_0"), text(" uguale a")]),
        formulaBlock("C4.2.3.5", "formula-c4-2-13", formula("C4.2.13")),
        block("C4.2.3.5", "p15", "paragraph", 104, "dove L è la luce del sistema di controvento e αm dipende dal numero m di elementi controventati,", [text("dove "), math("L", "L"), text(" è la luce del sistema di controvento e "), math("αm", "\\alpha_m"), text(" dipende dal numero "), math("m", "m"), text(" di elementi controventati,")]),
        formulaBlock("C4.2.3.5", "formula-c4-2-14", formula("C4.2.14")),
        tableBlock("C4.2.3.5", "table-c4-2-i", 104, tI, reg(70, 200, 430, 240)),
        block("C4.2.3.5", "p16", "paragraph", 104, "Gli effetti delle imperfezioni sul sistema di controvento possono essere tenute in conto anche mediante un carico distribuito equivalente", [text("Gli effetti delle imperfezioni sul sistema di controvento possono essere tenute in conto anche mediante un carico distribuito equivalente")]),
        formulaBlock("C4.2.3.5", "formula-c4-2-15", formula("C4.2.15")),
        block("C4.2.3.5", "p17", "paragraph", 104, "dove δq è la freccia massima del sistema di controvento dovuta a qd e ai carichi esterni, da considerarsi nulla se si effettua un’analisi del second’ordine, e NEd è la forza normale di compressione nel sistema o quella trasmessa dagli elementi controventati (Figura C4.2.5).", [text("dove "), math("δq", "\\delta_q"), text(" è la freccia massima del sistema di controvento dovuta a "), math("qd", "q_d"), text(" e ai carichi esterni, da considerarsi nulla se si effettua un’analisi del second’ordine, e "), math("NEd", "N_{Ed}"), text(" è la forza normale di compressione nel sistema o quella trasmessa dagli elementi controventati (Figura C4.2.5).")]),
        block("C4.2.3.5", "p18", "paragraph", 104, "Se il sistema di controventamento è preposto alla stabilizzazione laterale di un elemento inflesso di altezza h, la forza NEd, riportata nella [C4.2.15] e rappresentativa degli effetti prodotti dall’instabilità della piattabanda compressa dell’elemento inflesso sul controventamento, è data da", [text("Se il sistema di controventamento è preposto alla stabilizzazione laterale di un elemento inflesso di altezza "), math("h", "h"), text(", la forza "), math("NEd", "N_{Ed}"), text(", riportata nella [C4.2.15] e rappresentativa degli effetti prodotti dall’instabilità della piattabanda compressa dell’elemento inflesso sul controventamento, è data da")]),
        formulaBlock("C4.2.3.5", "formula-c4-2-16", formula("C4.2.16")),
        block("C4.2.3.5", "p19", "paragraph", 104, "dove MEd è il massimo momento flettente nell’elemento inflesso. Se l’elemento da stabilizzare è soggetto anche a compressione assiale, una quota di tale sollecitazione deve essere considerata per determinare NEd.", [text("dove "), math("MEd", "M_{Ed}"), text(" è il massimo momento flettente nell’elemento inflesso. Se l’elemento da stabilizzare è soggetto anche a compressione assiale, una quota di tale sollecitazione deve essere considerata per determinare "), math("NEd", "N_{Ed}"), text(".")]),
        figureBlock("C4.2.3.5", "figure-c4-2-5", 104, g("C4.2.5"), figureRows[4]!.region),
        block("C4.2.3.5", "p20", "paragraph", 104, "Le forze che piattabande o elementi compressi giuntati esercitano sul sistema di controvento, in corrispondenza del giunto, possono essere assunte uguali a", [text("Le forze che piattabande o elementi compressi giuntati esercitano sul sistema di controvento, in corrispondenza del giunto, possono essere assunte uguali a")]),
        formulaBlock("C4.2.3.5", "formula-c4-2-17", formula("C4.2.17")),
        block("C4.2.3.5", "p21", "paragraph", 104, "essendo NEd la forza di compressione nella piattabanda o nell’elemento (Figura C4.2.6).", [text("essendo "), math("NEd", "N_{Ed}"), text(" la forza di compressione nella piattabanda o nell’elemento (Figura C4.2.6).")]),
        figureBlock("C4.2.3.5", "figure-c4-2-6", 105, g("C4.2.6"), figureRows[5]!.region),
        block("C4.2.3.5", "p22", "paragraph", 104, "Le imperfezioni locali non debbono essere considerate nelle verifiche di stabilità, poiché le formule di verifica nella presente sezione e adottate al § 4.2 delle NTC le considerano implicitamente. Se, invece, la verifica della membratura è eseguita mediante un’apposita analisi del secondo ordine, si dovrà considerare un’imperfezione locale dell’asta, che potrà essere assunta uguale a e0 per l’instabilità a compressione e a 0,5·e0 per l’instabilità flessotorsionale, essendo e0 dato in Tabella C4.2.I.", [text("Le imperfezioni locali non debbono essere considerate nelle verifiche di stabilità, poiché le formule di verifica nella presente sezione e adottate al § 4.2 delle NTC le considerano implicitamente. Se, invece, la verifica della membratura è eseguita mediante un’apposita analisi del secondo ordine, si dovrà considerare un’imperfezione locale dell’asta, che potrà essere assunta uguale a "), math("e0", "e_0"), text(" per l’instabilità a compressione e a 0,5·"), math("e0", "e_0"), text(" per l’instabilità flessotorsionale, essendo "), math("e0", "e_0"), text(" dato in Tabella C4.2.I.")]),
    ], ["C4.2.7", "C4.2.8", "C4.2.9", "C4.2.10", "C4.2.11", "C4.2.12", "C4.2.13", "C4.2.14", "C4.2.15", "C4.2.16", "C4.2.17"], ["C4.2.I"], ["C4.2.2", "C4.2.3", "C4.2.4", "C4.2.5", "C4.2.6"]),
    makeUnit("C4.2.3.6", "ANALISI DI STABILITÀ DI STRUTTURE INTELAIATE", [
        block("C4.2.3.6", "heading", "heading", 105, "C4.2.3.6 ANALISI DI STABILITÀ DI STRUTTURE INTELAIATE"),
        block("C4.2.3.6", "p1", "paragraph", 105, "Quando αcr è minore dei limiti ricordati al § C4.2.3.4, l’analisi strutturale deve tener conto delle deformazioni.", [text("Quando "), math("αcr", "\\alpha_{cr}"), text(" è minore dei limiti ricordati al § C4.2.3.4, l’analisi strutturale deve tener conto delle deformazioni.")]),
        block("C4.2.3.6", "p2", "paragraph", 105, "Gli effetti del secondo ordine e le imperfezioni possono essere considerati nel calcolo con modalità diverse a seconda del tipo di struttura considerata e del tipo di analisi che può essere adottata."),
        block("C4.2.3.6", "p3", "paragraph", 105, "Il metodo più generale prevede di eseguire un’analisi globale non lineare completa, in cui si verificano contemporaneamente sia la stabilità globale della struttura, sia la stabilità locale dei singoli elementi. Una possibile semplificazione di questo metodo consiste nell’eseguire un’analisi non lineare globale della struttura per verificarne la stabilità globale e determinare le sollecitazioni negli elementi, da verificare individualmente."),
        block("C4.2.3.6", "p4", "paragraph", 105, "Nel caso in cui il modo instabile orizzontale sia predominante e risulti αcr≥3,0, l’analisi può essere semplificata. In questo caso, infatti, si può eseguire un’analisi globale lineare, considerando, per ogni elemento, le sollecitazioni dovute agli spostamenti orizzontali adeguatamente amplificate mediante un coefficiente β>1,0. Per i telai multipiano, caratterizzati da distribuzioni di carichi verticali e orizzontali simili ad ogni piano e con distribuzione delle rigidezze orizzontali coerente con i tagli di piano, e per i portali il coefficiente di amplificazione delle sollecitazioni dovute alle azioni orizzontali può essere calcolato come", [text("Nel caso in cui il modo instabile orizzontale sia predominante e risulti "), math("αcr", "\\alpha_{cr}"), text("≥3,0, l’analisi può essere semplificata. In questo caso, infatti, si può eseguire un’analisi globale lineare, considerando, per ogni elemento, le sollecitazioni dovute agli spostamenti orizzontali adeguatamente amplificate mediante un coefficiente "), math("β", "\\beta"), text(">1,0. Per i telai multipiano, caratterizzati da distribuzioni di carichi verticali e orizzontali simili ad ogni piano e con distribuzione delle rigidezze orizzontali coerente con i tagli di piano, e per i portali il coefficiente di amplificazione delle sollecitazioni dovute alle azioni orizzontali può essere calcolato come")]),
        formulaBlock("C4.2.3.6", "formula-c4-2-18", formula("C4.2.18")),
        block("C4.2.3.6", "p5", "paragraph", 105, "dove il moltiplicatore critico αcr≥3,0 può essere calcolato mediante la [C4.2.5].", [text("dove il moltiplicatore critico "), math("αcr", "\\alpha_{cr}"), text("≥3,0 può essere calcolato mediante la [C4.2.5].")]),
    ], ["C4.2.18"]),
    makeUnit("C4.2.3.7", "LUNGHEZZA STABILE DELLA ZONA DI CERNIERA PLASTICA", [
        block("C4.2.3.7", "heading", "heading", 105, "C4.2.3.7 LUNGHEZZA STABILE DELLA ZONA DI CERNIERA PLASTICA"),
        block("C4.2.3.7", "p1", "paragraph", 105, "La verifica nei confronti dell’instabilità torsionale del tratto di membratura compreso tra il ritegno laterale che vincola la cerniera plastica e il ritegno torsionale successivo può essere condotta, in assenza di valutazioni più accurate, controllando che la lunghezza del tratto in esame sia minore della lunghezza stabile Ls.", [text("La verifica nei confronti dell’instabilità torsionale del tratto di membratura compreso tra il ritegno laterale che vincola la cerniera plastica e il ritegno torsionale successivo può essere condotta, in assenza di valutazioni più accurate, controllando che la lunghezza del tratto in esame sia minore della lunghezza stabile "), math("Ls", "L_s"), text(".")]),
        block("C4.2.3.7", "p2", "paragraph", 105, "Nel caso di travi a sezione costante aventi sezioni a I o a H, soggette a forza assiale poco significata (v. § C4.2.3.4) e a momento flettente variabile linearmente, caratterizzate da un rapporto tra altezza h e spessore della piattabanda tf,", [text("Nel caso di travi a sezione costante aventi sezioni a I o a H, soggette a forza assiale poco significata (v. § C4.2.3.4) e a momento flettente variabile linearmente, caratterizzate da un rapporto tra altezza "), math("h", "h"), text(" e spessore della piattabanda "), math("tf", "t_f"), text(",")]),
        formulaBlock("C4.2.3.7", "formula-c4-2-19", formula("C4.2.19")),
        formulaBlock("C4.2.3.7", "formula-c4-2-3-7-epsilon", formula("C4.2.3.7-epsilon")),
        block("C4.2.3.7", "p3", "paragraph", 105, "la lunghezza stabile può essere valutata, in via semplificata, come", [text("la lunghezza stabile può essere valutata, in via semplificata, come")]),
        formulaBlock("C4.2.3.7", "formula-c4-2-20", formula("C4.2.20")),
        block("C4.2.3.7", "p4", "paragraph", 105, "essendo iz il raggio d’inerzia della piattabanda relativo all’asse dell’anima e ψ il rapporto tra i momenti flettenti alle estremità del segmento considerato, MEd,min e Mpl,Rd.", [text("essendo "), math("iz", "i_z"), text(" il raggio d’inerzia della piattabanda relativo all’asse dell’anima e "), math("ψ", "\\psi"), text(" il rapporto tra i momenti flettenti alle estremità del segmento considerato, "), math("MEd,min", "M_{Ed,min}"), text(" e "), math("Mpl,Rd", "M_{pl,Rd}"), text(".")]),
        formulaBlock("C4.2.3.7", "formula-c4-2-3-7-psi", formula("C4.2.3.7-psi")),
    ], ["C4.2.19", "C4.2.3.7-epsilon", "C4.2.20", "C4.2.3.7-psi"]),
];

const redistribution = units.find((unit) => unit.numbering.official === "C4.2.3.3")?.blocks.find((block) => block.blockId.endsWith("#block-p10"));
if (redistribution?.text) {
    redistribution.text.raw = redistribution.text.raw.replace("0,15 Mpl,Rd", "0,15·Mpl,Rd");
    redistribution.text.normalized = redistribution.text.normalized.replace("0,15 Mpl,Rd", "0,15·Mpl,Rd");
    const formulaPart = redistribution.text.inline.findIndex((part) => part.kind === "math" && part.value === "Mpl,Rd");
    if (formulaPart > 0) {
        const previous = redistribution.text.inline[formulaPart - 1]!;
        previous.value = previous.value.replace("0,15 ", "");
        redistribution.text.inline[formulaPart] = { kind: "math", value: "0,15·Mpl,Rd", latex: "0{,}15\\cdot M_{pl,Rd}" };
    }
    redistribution.evidence.rawSha256 = hash(redistribution.text.raw);
    redistribution.evidence.normalizedSha256 = hash(redistribution.text.normalized);
}

const extendMath = (official: string, blockSuffix: string, value: string, suffix: string, latex: string, occurrence = 0) => {
    const block = units.find((unit) => unit.numbering.official === official)?.blocks.find((candidate) => candidate.blockId.endsWith(blockSuffix));
    if (!block?.text) return;
    const matches = block.text.inline
        .map((part, index) => ({ part, index }))
        .filter(({ part }) => part.kind === "math" && part.value === value);
    const match = matches[occurrence];
    const next = match ? block.text.inline[match.index + 1] : undefined;
    if (match && next?.kind === "text" && next.value.startsWith(suffix)) {
        match.part.value = `${value}${suffix}`;
        match.part.latex = latex;
        next.value = next.value.slice(suffix.length);
    }
};

extendMath("C4.2.3.3", "#block-p4", "γM0", "=1,05", "\\gamma_{M0}=1{,}05");
extendMath("C4.2.3.3", "#block-p9", "γM2", "=1,25", "\\gamma_{M2}=1{,}25");
extendMath("C4.2.3.5", "#block-p4", "φ0", "=h/200", "\\phi_0=h/200", 1);
extendMath("C4.2.3.6", "#block-p4", "β", ">1,0", "\\beta>1{,}0");

const localImperfection = units.find((unit) => unit.numbering.official === "C4.2.3.5")?.blocks.find((block) => block.blockId.endsWith("#block-p22"));
if (localImperfection?.text) {
    const index = localImperfection.text.inline.findIndex((part, partIndex) => part.kind === "math" && part.value === "e0" && localImperfection.text!.inline[partIndex - 1]?.value.endsWith("0,5·"));
    if (index > 0) {
        const previous = localImperfection.text.inline[index - 1]!;
        previous.value = previous.value.slice(0, -4);
        localImperfection.text.inline[index] = { kind: "math", value: "0,5·e0", latex: "0{,}5\\cdot e_0" };
    }
}

const figureManifest = figureRows.map((row) => ({
    id: g(row.number),
    unitId: uid(row.unit),
    officialNumber: row.number,
    pdfPage: row.page,
    caption: `Figura ${row.number} – ${row.caption}`,
    alt: row.alt,
    imagePath: `figures/circ2019/fig${row.number.toLowerCase()}.png`,
    region: row.region,
    sha256: row.sha256,
}));

const manifest = {
    $schema: "urn:structural-codes:schema:asset-manifest:v2",
    schemaVersion: "2.0.0-alpha.1",
    recordType: "asset-manifest",
    document: "circ2019",
    section: "C4.2-step1",
    sourceId,
    status: "transcribed-unreviewed",
    formulas: formulaRows.map((row) => ({ id: formulaId(row.number), unitId: uid(row.unit), officialNumber: row.number.startsWith("C4.2.") && !row.number.includes("-") ? row.number : null, pdfPage: row.page, latex: row.latex })),
    tables: [tableI],
    figures: figureManifest,
};

await mkdir(unitDirectory, { recursive: true });
await mkdir(assetDirectory, { recursive: true });
await mkdir(figureDirectory, { recursive: true });
for (const row of figureRows) {
    await copyFile(join(evidenceRenderDirectory, row.source), join(figureDirectory, `fig${row.number.toLowerCase()}.png`));
}
await Promise.all([
    ...units.map((unit) => writeFile(join(unitDirectory, `${unit.numbering.official.toLowerCase()}.json`), `${JSON.stringify(unit, null, 2)}\n`, "utf8")),
    writeFile(join(assetDirectory, "C4.2-step1.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8"),
]);
console.log(`Circolare C4.2 step1: generate ${units.length} unità, ${formulaRows.length} formule, 1 tabella e ${figureRows.length} figure.`);
