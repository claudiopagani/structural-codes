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
const unitNumber = "C4.2.12.1.4";

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
function evidence(page: number, raw: string, normalized: string, region: Region, manual = false) { return { sourceId, pdfPage: page, printedPage: String(page - 4), region, extraction: { method: manual ? "manual-transcription" : "pdf-text", tool: manual ? "codex-source-transcription" : "pdfjs-dist", toolVersion: manual ? profile : "4.10.38" }, transformations: [{ operation: "join-line-wrap", ruleVersion: profile, note: "Ricomposte le righe tipografiche appartenenti allo stesso capoverso o voce di elenco; formule e figure restano blocchi distinti." }, ...(raw !== normalized ? [{ operation: "manual-correction", ruleVersion: profile, note: "Ripristinati accenti, apostrofi, simboli e notazione matematica confrontati con i render ufficiali." }] : []), { operation: "unicode-nfc", ruleVersion: profile, note: "Testo normalizzato in Unicode NFC." }], rawSha256: hash(raw), normalizedSha256: hash(normalized) }; }
function block(suffix: string, kind: Exclude<BlockKind, "formula-ref" | "figure-ref">, page: number, normalized: string, inline: Inline[], region: Region): GeneratedBlock { return { blockId: `${uid(unitNumber)}#block-${suffix}`, kind, origin: "official", text: { raw: normalized, normalized, normalizationVersion: profile, inline }, evidence: evidence(page, normalized, normalized, region) }; }
function formulaBlock(suffix: string, formula: FormulaRow): GeneratedBlock { return { blockId: `${uid(unitNumber)}#block-${suffix}`, kind: "formula-ref", origin: "official", assetId: formulaId(formula.number), evidence: evidence(formula.page, formula.raw, formula.raw, formula.region, true) }; }
function figureBlock(suffix: string, asset: string, page: number, caption: string, region: Region): GeneratedBlock { return { blockId: `${uid(unitNumber)}#block-${suffix}`, kind: "figure-ref", origin: "official", assetId: asset, evidence: evidence(page, caption, caption, region, true) }; }

const formula104: FormulaRow = { number: "C4.2.104", page: 136, latex: "g_r=r_m\\left[\\tan\\left(\\frac{\\Phi}{2}\\right)-\\sin\\left(\\frac{\\Phi}{2}\\right)\\right]", raw: "g_r = r_m [tan(Φ/2) − sin(Φ/2)] [C4.2.104]", region: reg(145, 180, 325, 50) };
const formula105: FormulaRow = { number: "C4.2.105", page: 138, latex: "\\sigma_{cr,s}=2\\,\\frac{\\sqrt{k\\,E\\,I_s}}{A_s}", raw: "σ_cr,s = 2 · √(k·E·I_s)/A_s [C4.2.105]", region: reg(145, 300, 325, 45) };
const formula106: FormulaRow = { number: "C4.2.106", page: 138, latex: "\\lambda_d=\\sqrt{\\frac{f_{yk}}{\\sigma_{cr,s}}}", raw: "λ_d = √(f_yk/σ_cr,s) [C4.2.106]", region: reg(145, 350, 325, 45) };
const formula107: FormulaRow = { number: "C4.2.107", page: 138, latex: "\\sigma_{d,Rd}=\\chi_d(\\lambda_d)\\,f_{yk}", raw: "σ_d,Rd = χ_d(λ_d) f_yk [C4.2.107]", region: reg(145, 395, 325, 45) };
const formula108: FormulaRow = { number: "C4.2.108", page: 138, latex: "\\begin{aligned}\\chi_d&=1&&\\text{per }\\lambda_d<0{,}65\\\\\\chi_d&=1{,}47-0{,}723\\,\\lambda_d&&\\text{per }0{,}65\\le\\lambda_d\\le1{,}38\\\\\\chi_d&=\\frac{0{,}66}{\\lambda_d}&&\\text{per }\\lambda_d>1{,}38\\end{aligned}", raw: "χ_d = 1 per λ_d < 0,65; χ_d = 1,47 − 0,723·λ_d per 0,65 ≤ λ_d ≤ 1,38; χ_d = 0,66/λ_d per λ_d > 1,38 [C4.2.108]", region: reg(145, 430, 325, 75) };
const formula109: FormulaRow = { number: "C4.2.109", page: 138, latex: "\\sigma_{com,Ed,i}=\\chi_d\\,\\frac{f_{yk}}{\\gamma_{M0}}", raw: "σ_com,Ed,i = χ_d · f_yk/γ_M0 [C4.2.109]", region: reg(145, 560, 325, 45) };
const formula110: FormulaRow = { number: "C4.2.110", page: 138, latex: "\\sigma_{d,Rd}=\\chi_d(\\lambda'_d)\\,f_{yk}", raw: "σ_d,Rd = χ_d(λ′_d) f_yk [C4.2.110]", region: reg(145, 635, 325, 45) };
const formula111: FormulaRow = { number: "C4.2.111", page: 138, latex: "A_{s,rid}=\\frac{\\chi_d\\,f_{yk}\\,A_s}{\\gamma_{M0}\\,\\sigma_{com,Ed}}", raw: "A_s,rid = χ_d · f_yk · A_s/(γ_M0 · σ_com,Ed) [C4.2.111]", region: reg(145, 690, 325, 45) };
const formula112: FormulaRow = { number: "C4.2.112", page: 139, latex: "t_{rid}=t\\,\\frac{A_{s,rid}}{A_s}", raw: "t_rid = t · A_s,rid/A_s [C4.2.112]", region: reg(145, 50, 325, 70) };

const figure26 = figureId("C4.2.26");
const figure27 = figureId("C4.2.27");
const figure28 = figureId("C4.2.28");
const figure29 = figureId("C4.2.29");
const figure30 = figureId("C4.2.30");
const figure31 = figureId("C4.2.31");
const figure32 = figureId("C4.2.32");
const figure26Region = reg(170, 450, 270, 80);
const figure27Region = reg(70, 570, 455, 170);
const figure28Region = reg(130, 150, 330, 215);
const figure29Region = reg(180, 480, 260, 95);
const figure30Region = reg(180, 590, 260, 55);
const figure31Region = reg(170, 75, 270, 85);
const figure32Region = reg(170, 175, 270, 90);

const blocks: GeneratedBlock[] = [
    block("heading", "heading", 136, "C4.2.12.1.4. Classificazione delle sezioni, instabilità locale e distorsione delle sezioni trasversali", [text("C4.2.12.1.4. Classificazione delle sezioni, instabilità locale e distorsione delle sezioni trasversali")], reg(73.9, 410, 450, 30)),
    block("p1", "paragraph", 136, "Nelle membrature formate a freddo e nelle lamiere grecate, al fine della utilizzazione delle Tabelle 4.2.III, IV e V delle NTC per la classificazione delle sezioni, la larghezza b_p degli elementi piani deve essere determinata a partire dai punti medi di raccordo di due lati adiacenti, secondo le indicazioni di Figura C4.2.26.", [text("Nelle membrature formate a freddo e nelle lamiere grecate, al fine della utilizzazione delle Tabelle 4.2.III, IV e V delle NTC per la classificazione delle sezioni, la larghezza "), math("b_p", "b_p"), text(" degli elementi piani deve essere determinata a partire dai punti medi di raccordo di due lati adiacenti, secondo le indicazioni di Figura C4.2.26.")], reg(73.9, 445, 450, 45)),
    block("p2", "paragraph", 136, "In Figura C4.2.26 il punto P è il punto medio del raccordo da considerare per determinare la larghezza dell’elemento piano; X è l’intersezione degli assi degli elementi piani.", [text("In Figura C4.2.26 il punto P è il punto medio del raccordo da considerare per determinare la larghezza dell’elemento piano; X è l’intersezione degli assi degli elementi piani.")], reg(73.9, 495, 450, 30)),
    block("p3", "paragraph", 136, "Il raggio medio di piega del raccordo r_m si determina a partire dal raggio interno di piega r_m = r + 0,5·t, mentre la proiezione g_r del segmento PX sull’asse dell’elemento piano è uguale a", [text("Il raggio medio di piega del raccordo "), math("r_m", "r_m"), text(" si determina a partire dal raggio interno di piega "), math("r_m = r + 0,5·t", "r_m=r+0{,}5\\,t"), text(", mentre la proiezione "), math("g_r", "g_r"), text(" del segmento PX sull’asse dell’elemento piano è uguale a")], reg(73.9, 530, 450, 35)),
    formulaBlock("formula-104", formula104),
    figureBlock("figure-26", figure26, 136, "Figura C4.2.26 – Determinazione del punto X per la valutazione della larghezza di elementi piani", figure26Region),
    block("p4", "paragraph", 136, "Alcuni esempi applicativi sono riportati in Figura C4.2.27.", [text("Alcuni esempi applicativi sono riportati in Figura C4.2.27.")], reg(73.9, 625, 450, 20)),
    figureBlock("figure-27", figure27, 136, "Figura C4.2.27 – Esempi di determinazione della larghezza b_p", figure27Region),
    block("p5", "paragraph", 137, "Nel caso di parti compresse appartenenti alla classi 3 e 4 si possono verificare fenomeni di instabilità locale e distorsione della sezione trasversale che interagiscono tra loro ed insieme alla inflessione trasversale delle aste compresse e/o inflesse. Questi fenomeni possono essere studiati mediante una specifica modellazione matematica. In alternativa si possono applicare i metodi semplificati indicati nel seguito.", [text("Nel caso di parti compresse appartenenti alla classi 3 e 4 si possono verificare fenomeni di instabilità locale e distorsione della sezione trasversale che interagiscono tra loro ed insieme alla inflessione trasversale delle aste compresse e/o inflesse. Questi fenomeni possono essere studiati mediante una specifica modellazione matematica. In alternativa si possono applicare i metodi semplificati indicati nel seguito.")], reg(73.9, 75, 450, 55)),
    figureBlock("figure-28", figure28, 137, "Figura C4.2.28 – Modelli statici per diverse tipologie di elementi piani", figure28Region),
    block("p6", "paragraph", 137, "I vari tipi di elementi piani possono essere schematizzati con i modelli riportati in Figura C4.2.28.", [text("I vari tipi di elementi piani possono essere schematizzati con i modelli riportati in Figura C4.2.28.")], reg(73.9, 380, 450, 25)),
    block("p7", "paragraph", 137, "Le parti piane compresse che, con la definizione di larghezza data sopra, non rispettano le limitazioni per la classe 3 sono soggette a fenomeni di ingobbamento locale i quali si possono considerare con il metodo delle larghezze efficaci per la determinazione delle quali si devono seguire i criteri esposti al § C4.2.4.1.3.4.", [text("Le parti piane compresse che, con la definizione di larghezza data sopra, non rispettano le limitazioni per la classe 3 sono soggette a fenomeni di ingobbamento locale i quali si possono considerare con il metodo delle larghezze efficaci per la determinazione delle quali si devono seguire i criteri esposti al § C4.2.4.1.3.4.")], reg(73.9, 410, 450, 40)),
    block("p8", "paragraph", 137, "Tenendo presenti le larghezze efficaci degli elementi piani compressi si possono determinare le grandezze geometriche efficaci che tengono conto dei fenomeni di instabilità locale e che sono richiamate al § 4.2.4.1 delle NTC, nell’ipotesi che non intervenga la distorsione della sezione trasversale considerata più oltre.", [text("Tenendo presenti le larghezze efficaci degli elementi piani compressi si possono determinare le grandezze geometriche efficaci che tengono conto dei fenomeni di instabilità locale e che sono richiamate al § 4.2.4.1 delle NTC, nell’ipotesi che non intervenga la distorsione della sezione trasversale considerata più oltre.")], reg(73.9, 455, 450, 40)),
    block("p9", "paragraph", 137, "Per discutere i fenomeni di distorsione della sezione trasversale si distinguono:", [text("Per discutere i fenomeni di distorsione della sezione trasversale si distinguono:")], reg(73.9, 500, 450, 20)),
    block("item-1", "list-item", 137, "elementi piani, con o senza irrigidimenti intermedi, delimitati da un’anima e da un irrigidimento di bordo (Figura C4.2.29);", [text("elementi piani, con o senza irrigidimenti intermedi, delimitati da un’anima e da un irrigidimento di bordo (Figura C4.2.29);")], reg(73.9, 525, 450, 30)),
    block("item-2", "list-item", 137, "elementi piani compresi tra due anime con uno o più irrigidimenti intermedi (Figura C4.2.30).", [text("elementi piani compresi tra due anime con uno o più irrigidimenti intermedi (Figura C4.2.30).")], reg(73.9, 555, 450, 25)),
    figureBlock("figure-29", figure29, 137, "Figura C4.2.29 – Elementi piani delimitati da un’anima e da un irrigidimento di bordo", figure29Region),
    figureBlock("figure-30", figure30, 137, "Figura C4.2.30 – Elementi piani delimitati da due anime con irrigidimenti intermedi", figure30Region),
    block("p10", "paragraph", 137, "L’irrigidimento, insieme alla larghezza collaborante che gli compete (Figura C4.2.31) viene studiato come trave compressa su letto elastico alla Winkler. Il letto elastico ha costante elastica dipendente dall’elemento piano e dalle altre parti della sezione della trave alle quali l’elemento è collegato.", [text("L’irrigidimento, insieme alla larghezza collaborante che gli compete (Figura C4.2.31) viene studiato come trave compressa su letto elastico alla Winkler. Il letto elastico ha costante elastica dipendente dall’elemento piano e dalle altre parti della sezione della trave alle quali l’elemento è collegato.")], reg(73.9, 650, 450, 45)),
    figureBlock("figure-31", figure31, 138, "Figura C4.2.31 – Schematizzazione degli irrigidimenti", figure31Region),
    block("p11", "paragraph", 138, "In Figura C4.2.32 sono riportati alcuni schemi statici di riferimento per il calcolo della costante k del letto elastico.", [text("In Figura C4.2.32 sono riportati alcuni schemi statici di riferimento per il calcolo della costante "), math("k", "k"), text(" del letto elastico.")], reg(73.9, 120, 450, 25)),
    figureBlock("figure-32", figure32, 138, "Figura C4.2.32 – Schemi di calcolo per la determinazione della costante elastica", figure32Region),
    block("p12", "paragraph", 138, "Detti A_s l’area efficace dell’irrigidimento con la larghezza collaborante che gli compete e I_s il momento di inerzia dell’irrigidimento con la larghezza collaborante che gli compete, calcolato rispetto al suo asse baricentrico parallelo all’elemento piano collaborante, la tensione critica euleriana dell’irrigidimento compresso sul letto elastico σ_cr,s, salvo più precise determinazioni teorico-numeriche, può essere assunta pari a", [text("Detti "), math("A_s", "A_s"), text(" l’area efficace dell’irrigidimento con la larghezza collaborante che gli compete e "), math("I_s", "I_s"), text(" il momento di inerzia dell’irrigidimento con la larghezza collaborante che gli compete, calcolato rispetto al suo asse baricentrico parallelo all’elemento piano collaborante, la tensione critica euleriana dell’irrigidimento compresso sul letto elastico "), math("σ_cr,s", "\\sigma_{cr,s}"), text(", salvo più precise determinazioni teorico-numeriche, può essere assunta pari a")], reg(73.9, 270, 450, 45)),
    formulaBlock("formula-105", formula105),
    block("p13", "paragraph", 138, "La resistenza all’instabilità distorsionale dell’irrigidimento compresso σ_d,Rd dipende dalla snellezza adimensionale λ_d", [text("La resistenza all’instabilità distorsionale dell’irrigidimento compresso "), math("σ_d,Rd", "\\sigma_{d,Rd}"), text(" dipende dalla snellezza adimensionale "), math("λ_d", "\\lambda_d")], reg(73.9, 350, 450, 25)),
    formulaBlock("formula-106", formula106),
    block("p14", "paragraph", 138, "tramite il fattore di riduzione χ_d per cui risulta", [text("tramite il fattore di riduzione "), math("χ_d", "\\chi_d"), text(" per cui risulta")], reg(73.9, 395, 450, 20)),
    formulaBlock("formula-107", formula107),
    block("p15", "paragraph", 138, "Essendo", [text("Essendo")], reg(73.9, 425, 80, 15)),
    formulaBlock("formula-108", formula108),
    block("p16", "paragraph", 138, "Per semplicità ed in prima approssimazione si può assumere l’area ridotta dell’irrigidimento, che tiene conto dell’instabilità distorsionale, pari a A_s,rid = χ_d · A_s.", [text("Per semplicità ed in prima approssimazione si può assumere l’area ridotta dell’irrigidimento, che tiene conto dell’instabilità distorsionale, pari a "), math("A_s,rid = χ_d · A_s", "A_{s,rid}=\\chi_d\\,A_s"), text(".")], reg(73.9, 515, 450, 30)),
    block("p17", "paragraph", 138, "Nel caso χ_d<1, per migliorare l’approssimazione si può far ricorso ad un processo iterativo che comporta le seguenti fasi:", [text("Nel caso "), math("χ_d<1", "\\chi_d<1"), text(", per migliorare l’approssimazione si può far ricorso ad un processo iterativo che comporta le seguenti fasi:")], reg(73.9, 550, 450, 25)),
    block("item-3", "list-item", 138, "nuova definizione della larghezza efficace del pannello piano, riferita alla tensione massima di compressione,", [text("nuova definizione della larghezza efficace del pannello piano, riferita alla tensione massima di compressione,")], reg(73.9, 580, 450, 25)),
    formulaBlock("formula-109", formula109),
    block("item-4", "list-item", 138, "nuova determinazione delle caratteristiche geometriche dell’irrigidimento, A_s e I_s;", [text("nuova determinazione delle caratteristiche geometriche dell’irrigidimento, "), math("A_s", "A_s"), text(" e "), math("I_s", "I_s"), text(";")], reg(73.9, 645, 450, 25)),
    block("item-5", "list-item", 138, "determinazione della nuova tensione critica euleriana σ′_cr,s, della nuova snellezza λ′_d e della nuova resistenza all’instabilità distorsionale dell’irrigidimento compresso", [text("determinazione della nuova tensione critica euleriana "), math("σ′_cr,s", "\\sigma'_{cr,s}"), text(", della nuova snellezza "), math("λ′_d", "\\lambda'_d"), text(" e della nuova resistenza all’instabilità distorsionale dell’irrigidimento compresso")], reg(73.9, 675, 450, 30)),
    formulaBlock("formula-110", formula110),
    block("p18", "paragraph", 138, "e così via iterando, fino a convergenza.", [text("e così via iterando, fino a convergenza.")], reg(73.9, 735, 450, 20)),
    block("p19", "paragraph", 138, "Una volta raggiunta la convergenza, l’area ridotta dell’irrigidimento, che tiene conto dell’instabilità distorsionale, è data:", [text("Una volta raggiunta la convergenza, l’area ridotta dell’irrigidimento, che tiene conto dell’instabilità distorsionale, è data:")], reg(73.9, 760, 450, 25)),
    formulaBlock("formula-111", formula111),
    block("p20", "paragraph", 139, "Per la determinazione delle caratteristiche geometriche della sezione trasversale della membratura l’area ridotta dell’irrigidimento A_s,rid può essere utilmente rappresentata mediante lo spessore ridotto dello stesso", [text("Per la determinazione delle caratteristiche geometriche della sezione trasversale della membratura l’area ridotta dell’irrigidimento "), math("A_s,rid", "A_{s,rid}"), text(" può essere utilmente rappresentata mediante lo spessore ridotto dello stesso")], reg(73.9, 25, 450, 30)),
    formulaBlock("formula-112", formula112),
];

const formulaRows = [formula104, formula105, formula106, formula107, formula108, formula109, formula110, formula111, formula112];
const figureRows = [
    [figure26, "C4.2.26", "Figura C4.2.26 – Determinazione del punto X per la valutazione della larghezza di elementi piani", "Determinazione del punto X per la valutazione della larghezza di elementi piani", figure26Region, "page-0136-x170-y460-w270-h80@4x.png", "6cd0a782c0334a4c0c678b662efcc5ea91a29c1dfbbbe9929360edb4884b3d89"],
    [figure27, "C4.2.27", "Figura C4.2.27 – Esempi di determinazione della larghezza b_p", "Esempi di determinazione della larghezza b_p", figure27Region, "page-0136-x70-y570-w455-h170@4x.png", "e8212b0a06bcfa3ac5d0c53209b50f503637211a84fb89aa32d1e8695498f23a"],
    [figure28, "C4.2.28", "Figura C4.2.28 – Modelli statici per diverse tipologie di elementi piani", "Modelli statici per diverse tipologie di elementi piani", figure28Region, "page-0137-x130-y150-w330-h215@4x.png", "f70a6a56d4c9c08d5e783cfbca59f8e895c0558d6e61e78a01e2e61d047d91e7"],
    [figure29, "C4.2.29", "Figura C4.2.29 – Elementi piani delimitati da un’anima e da un irrigidimento di bordo", "Elementi piani delimitati da un’anima e da un irrigidimento di bordo", figure29Region, "page-0137-x180-y480-w260-h95@4x.png", "ba87a0abdbff13c051ee9878ef483e6ea25b059bbc71356e0e88a5359ba0c32e"],
    [figure30, "C4.2.30", "Figura C4.2.30 – Elementi piani delimitati da due anime con irrigidimenti intermedi", "Elementi piani delimitati da due anime con irrigidimenti intermedi", figure30Region, "page-0137-x180-y590-w260-h55@4x.png", "bf0aee4b223d6c5170800d173fffd96bea9da305a3dd15cbdc01e3322cd7c42a"],
    [figure31, "C4.2.31", "Figura C4.2.31 – Schematizzazione degli irrigidimenti", "Schematizzazione degli irrigidimenti", figure31Region, "page-0138-x170-y75-w270-h85@4x.png", "510ea05861bf754d650a873c5377d7b3fc183b74841057da004c9181c6e3ae7c"],
    [figure32, "C4.2.32", "Figura C4.2.32 – Schemi di calcolo per la determinazione della costante elastica", "Schemi di calcolo per la determinazione della costante elastica", figure32Region, "page-0138-x170-y175-w270-h90@4x.png", "da5bde680342230b7aab9afbd27033b4a031c6c79a19866e4a0020b1dcee69f0"],
] as const;
const unit = { $schema: "urn:structural-codes:schema:canonical-unit:v2", schemaVersion: "2.0.0-alpha.2", recordType: "canonical-unit", id: uid(unitNumber), workId, expressionId, kind: "subparagraph", numbering: { official: unitNumber, sortKey: unitNumber.replace(/^C/, "").split(".").map((part) => part.padStart(3, "0")).join(".") }, title: "Classificazione delle sezioni, instabilità locale e distorsione delle sezioni trasversali", titleBlockId: `${uid(unitNumber)}#block-heading`, hierarchy: { parentId: uid("C4.2.12.1"), ancestorIds: [uid("C4.2"), uid("C4.2.12"), uid("C4.2.12.1")], position: 4 }, validity: { from: null, to: null, status: "unknown", asOf: "2026-08-09" }, blocks, citations: [], relations: [], assets: { formulaIds: formulaRows.map((formula) => formulaId(formula.number)), tableIds: [], figureIds: figureRows.map(([id]) => id) }, workflow: { status: "extracted", createdBy: { actorId: "codex:circ42-step2u", kind: "automated-agent", toolVersion: profile }, createdAt, reviews: [], openIssues: [{ issueId: "circ2019-C4-2-12-1-4-source-review", type: "normalization-review", severity: "blocking", note: "Record trascritto dall’evidence ufficiale ma non ancora confrontato integralmente da un revisore umano con i render delle pagine fonte." }, { issueId: "circ2019-C4-2-12-1-4-assets-review", type: "asset-review", severity: "blocking", note: "Le formule C4.2.104–C4.2.112 e le figure C4.2.26–C4.2.32 richiedono revisione umana indipendente." }] } };
const manifest = { $schema: "urn:structural-codes:schema:asset-manifest:v2", schemaVersion: "2.0.0-alpha.1", recordType: "asset-manifest", document: "circ2019", section: "C4.2-step2u", sourceId, status: "transcribed-unreviewed", formulas: formulaRows.map((formula) => ({ id: formulaId(formula.number), unitId: uid(unitNumber), officialNumber: formula.number, pdfPage: formula.page, latex: formula.latex })), tables: [], figures: figureRows.map(([id, officialNumber, caption, alt, region, imageName, sha256]) => ({ id, unitId: uid(unitNumber), officialNumber, pdfPage: officialNumber === "C4.2.26" || officialNumber === "C4.2.27" ? 136 : officialNumber === "C4.2.28" || officialNumber === "C4.2.29" || officialNumber === "C4.2.30" ? 137 : 138, caption, alt, imagePath: `figures/circ2019/${imageName.replace(/page-[^/]+-/, "figc4.2.").replace(/@4x\\.png$/, ".png")}`, region, sha256 })) };
// Keep stable public names for the official figure crops.
manifest.figures.forEach((figure, index) => { figure.imagePath = `figures/circ2019/figc4.2.${26 + index}.png`; });
await mkdir(unitDirectory, { recursive: true });
await mkdir(assetDirectory, { recursive: true });
await mkdir(figureDirectory, { recursive: true });
await Promise.all([
    writeFile(join(unitDirectory, `${unitNumber.toLowerCase()}.json`), `${JSON.stringify(unit, null, 2)}\n`, "utf8"),
    writeFile(join(assetDirectory, "C4.2-step2u.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8"),
    ...figureRows.map(([, officialNumber, , , , imageName]) => copyFile(join(evidenceRenderDirectory, imageName), join(figureDirectory, `figc4.2.${officialNumber.slice(5)}.png`))),
]);
console.log("Circolare C4.2 step2u: generate 1 unità, 9 formule e 7 figure.");
