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
            createdBy: { actorId: "codex:circ42-step2a", kind: "automated-agent", toolVersion: profile },
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
    { number: "C4.2.21", unit: "C4.2.4.1.3.1", page: 106, latex: "e_0=\\frac{L}{500}", raw: "e₀ = L/500 [C4.2.21]", region: reg(150, 250, 300, 80) },
    { number: "C4.2.22", unit: "C4.2.4.1.3.1.1", page: 106, latex: "N_{C,Ed}=0{,}5\\,N_{Ed}+\\frac{M_{Ed}\\,h_0\\,A_C}{2\\,J_{eff}}", raw: "NC,Ed = 0,5 · NEd + MEd · h₀ · AC/(2 · Jeff) [C4.2.22]", region: reg(130, 485, 350, 95) },
    { number: "C4.2.23", unit: "C4.2.4.1.3.1.1", page: 106, latex: "M_{Ed}=\\frac{N_{Ed}\\,e_0+M^I_{Ed}}{1-N_{Ed}/N_{cr}-N_{Ed}/S_V}", raw: "MEd = (NEd · e₀ + MᴵEd)/(1 − NEd/Ncr − NEd/SV) [C4.2.23]", region: reg(125, 635, 360, 100) },
    { number: "C4.2.24", unit: "C4.2.4.1.3.1.2", page: 107, latex: "V_{Ed}=\\pi\\,\\frac{M_{Ed}}{L}", raw: "VEd = π · MEd/L [C4.2.24]", region: reg(125, 95, 360, 90) },
    { number: "C4.2.25", unit: "C4.2.4.1.3.1.3", page: 107, latex: "\\frac{N_{c,Ed}}{N_{b,Rd}}\\le1{,}0", raw: "Nc,Ed/Nb,Rd ≤ 1,0 [C4.2.25]", region: reg(125, 215, 360, 90) },
    { number: "C4.2.26", unit: "C4.2.4.1.3.1.3", page: 107, latex: "J_{eff}=0{,}5\\,h_0^2\\,A_C", raw: "Jeff = 0,5 · h₀² · AC [C4.2.26]", region: reg(125, 345, 360, 90) },
    { number: "C4.2.27", unit: "C4.2.4.1.3.1.4", page: 108, latex: "J_{eff}=0{,}5\\,h_0^2\\,A_C+2\\,\\mu\\,J_C", raw: "Jeff = 0,5 · h₀² · AC + 2 · μ · JC [C4.2.27]", region: reg(125, 250, 360, 90) },
    { number: "C4.2.28", unit: "C4.2.4.1.3.1.4", page: 108, latex: "\\lambda=\\frac{L}{i_0}=L\\sqrt{\\frac{2\\,A_C}{0{,}5\\,h_0^2\\,A_C+2\\,J_C}}", raw: "λ = L/i₀ = L √(2 · AC/(0,5 · h₀² · AC + 2 · JC)) [C4.2.28]", region: reg(125, 350, 360, 115) },
    { number: "C4.2.29", unit: "C4.2.4.1.3.1.5", page: 108, latex: "i_y=\\frac{i_0}{1{,}15}", raw: "iy = i₀/1,15 [C4.2.29]", region: reg(125, 470, 360, 90) },
];

const formulaByNumber = new Map(formulaRows.map((row) => [row.number, row]));
const formula = (number: string) => formulaByNumber.get(number)!;
const tableIIId = tableId("C4.2.II");
const tableIIIId = tableId("C4.2.III");
const figureData = [
    { number: "C4.2.7", unit: "C4.2.4.1.3.1", page: 106, caption: "Aste composte costituite da due correnti uguali", alt: "Schema di due correnti uguali collegati da elementi di parete", source: "page-0106-x150-y310-w300-h145@3x.png", region: reg(150, 310, 300, 145), sha256: "ab2cec690a08509af4e5f0d89d0d209487c9f815d654190531e4a2d9158b9d60" },
    { number: "C4.2.8", unit: "C4.2.4.1.3.1.3", page: 107, caption: "Lunghezza di libera inflessione dei correnti di aste tralicciate", alt: "Schema della lunghezza di libera inflessione dei correnti di aste tralicciate", source: "page-0107-x125-y355-w350-h235@3x.png", region: reg(125, 355, 350, 235), sha256: "4acc970209f0c9e6c7679bca5456f9d83226500dcb2f717c909fb7b4a83976c1" },
    { number: "C4.2.9", unit: "C4.2.4.1.3.1.4", page: 108, caption: "Schema di calcolo semplificato per un’asta calastrellata", alt: "Schema di calcolo semplificato per un’asta calastrellata", source: "page-0108-x175-y155-w250-h145@3x.png", region: reg(175, 155, 250, 145), sha256: "9bfa7c6fc7fbc8cddd0704185958642e779c699c610052bfe1f724467f786789" },
    { number: "C4.2.10", unit: "C4.2.4.1.3.1.5", page: 108, caption: "Tipologie di aste composte costituite da elementi ravvicinati", alt: "Tipologie di aste composte costituite da elementi ravvicinati", source: "page-0108-x100-y580-w400-h150@3x.png", region: reg(100, 580, 400, 150), sha256: "28e3eec224d45869e393722ca580ce016fa11e8e5cd52e629270531264a6c29b" },
];

const tableII = {
    id: tableIIId,
    unitId: uid("C4.2.4.1.3.1.3"),
    officialNumber: "C4.2.II",
    pdfPage: 107,
    caption: "Rigidezza a taglio equivalenti di aste tralicciate o calastrellate",
    columnCount: 5,
    headers: [[
        { text: "Schema dell’asta composta (v. fig. C4.2.7)" },
        { text: "(1)" },
        { text: "(2)" },
        { text: "(3)" },
        { text: "(4)" },
    ]],
    rows: [[
        { text: "SV – rigidezza a taglio", latex: "S_V\\text{ – rigidezza a taglio}" },
        { text: "n · EA · Ad · h₀²/d³", latex: "n\\,E_A\\,A_d\\,h_0^2/d^3" },
        { text: "n · EA · Ad · h₀²/(2 · d³)", latex: "n\\,E_A\\,A_d\\,h_0^2/(2\\,d^3)" },
        { text: "n · EA · Ad · h₀²/[d³ · (1 + Ad · h₀³/(AV · d³))]", latex: "\\frac{n\\,E_A\\,A_d\\,h_0^2}{d^3\\left(1+A_d\\,h_0^3/(A_V\\,d^3)\\right)}" },
        { text: "24 · E · JC/[a² · (1 + 2 · JC · h₀/(n · JV · a))] ≤ 2π² · E · JC/a²", latex: "\\frac{24\\,E\\,J_C}{a^2\\left(1+2\\,J_C\\,h_0/(n\\,J_V\\,a)\\right)}\\le\\frac{2\\pi^2\\,E\\,J_C}{a^2}" },
    ]],
    notes: ["Ad area dei diagonali, AV area dei calastrelli, JV momento di inerzia del calastrello, AC area di un corrente, n numero di piani di tralicciatura o calastrellatura."],
};

const tableIII = {
    id: tableIIIId,
    unitId: uid("C4.2.4.1.3.1.5"),
    officialNumber: "C4.2.III",
    pdfPage: 109,
    caption: "Disposizione delle imbottiture di connessione tra i profili",
    columnCount: 2,
    headers: [[
        { text: "Tipo di asta composta (Figura C4.2.10)" },
        { text: "Spaziatura massima tra i collegamenti(*)" },
    ]],
    rows: [
        [{ text: "Tipo (1), (2), (3) o (4) collegati con imbottiture bullonate o saldate" }, { text: "15 imin", latex: "15\\,i_{min}" }],
        [{ text: "Tipi (5) o (6) collegati con coppie di calastrelli" }, { text: "70 imin", latex: "70\\,i_{min}" }],
    ],
    notes: ["(*) La distanza è misurata tra i centri di due collegamenti successivi e imin è il raggio di inerzia minimo del singolo profilo costituente l’asta."],
};

const fig = (number: string) => figureId(number);

const units = [
    makeUnit("C4.2.4", "VERIFICHE", [
        block("C4.2.4", "heading", "heading", 106, "C4.2.4 VERIFICHE"),
    ]),
    makeUnit("C4.2.4.1", "VERIFICHE AGLI STATI LIMITI ULTIMI", [
        block("C4.2.4.1", "heading", "heading", 106, "C4.2.4.1 VERIFICHE AGLI STATI LIMITI ULTIMI"),
    ]),
    makeUnit("C4.2.4.1.3", "Stabilità delle membrature", [
        block("C4.2.4.1.3", "heading", "heading", 106, "C4.2.4.1.3 Stabilità delle membrature"),
    ]),
    makeUnit("C4.2.4.1.3.1", "Aste compresse", [
        block("C4.2.4.1.3.1", "heading", "heading", 106, "C4.2.4.1.3.1 Aste compresse"),
        block("C4.2.4.1.3.1", "p1", "paragraph", 106, "Aste compresse composte a sezione costante realizzate da due elementi (correnti) collegati tra loro con calastrelli o tralicci possono essere verificate con il metodo qui proposto, a condizione che i campi individuati dai calastrelli o dalle aste di parete del traliccio siano uguali e non meno di tre."),
        block("C4.2.4.1.3.1", "p2", "paragraph", 106, "I correnti dell’asta composta possono essere a parete piena (Figura C4.2.7) oppure calastrellati o tralicciati a loro volta. Nel caso di correnti a pareti piena le tralicciature delle facce opposte devono corrispondersi ed essere sovrapponibili per traslazione, in caso contrario debbono essere considerati anche gli effetti torsionali sui correnti."),
        block("C4.2.4.1.3.1", "p3", "paragraph", 106, "Nel seguito si fa riferimento ad aste di lunghezza L, incernierate agli estremi nel piano della calastrellatura o della tralicciatura, equiparando la deformabilità della calastrellatura o della tralicciatura alla deformabilità a taglio di un’asta a parete piena equivalente. Per condizioni di vincolo diverse la trattazione può essere convenientemente adattata.", [text("Nel seguito si fa riferimento ad aste di lunghezza "), math("L", "L"), text(", incernierate agli estremi nel piano della calastrellatura o della tralicciatura, equiparando la deformabilità della calastrellatura o della tralicciatura alla deformabilità a taglio di un’asta a parete piena equivalente. Per condizioni di vincolo diverse la trattazione può essere convenientemente adattata.")]),
        block("C4.2.4.1.3.1", "p4", "paragraph", 106, "Le imperfezioni di montaggio possono essere schematizzate considerando un difetto di rettilineità."),
        formulaBlock("C4.2.4.1.3.1", "formula-21", formula("C4.2.21")),
        figureBlock("C4.2.4.1.3.1", "figure-7", 106, fig("C4.2.7"), "Figura C4.2.7-Aste composte costituite da due correnti uguali", figureData[0]!.region),
        block("C4.2.4.1.3.1", "p5", "paragraph", 106, "Oltre alle verifiche di stabilità dell’asta composta si devono eseguire anche le verifiche di stabilità e resistenza dei correnti e delle aste di parete, come specificato nel seguito. Per configurazioni più complesse, non trattate nel presente documento, si può far riferimento a procedimenti di comprovata validità."),
    ], ["C4.2.21"], [], ["C4.2.7"]),
    makeUnit("C4.2.4.1.3.1.1", "Calcolo della forza normale di progetto agente in un corrente", [
        block("C4.2.4.1.3.1.1", "heading", "heading", 106, "C4.2.4.1.3.1.1. Calcolo della forza normale di progetto agente in un corrente"),
        block("C4.2.4.1.3.1.1", "p1", "paragraph", 106, "Per un elemento costituito da due correnti a parete piena, la forza normale di progetto nei correnti può essere ricavata da", [text("Per un elemento costituito da due correnti a parete piena, la forza normale di progetto nei correnti può essere ricavata da")]),
        formulaBlock("C4.2.4.1.3.1.1", "formula-22", formula("C4.2.22")),
        block("C4.2.4.1.3.1.1", "where-1", "paragraph", 106, "dove"),
        block("C4.2.4.1.3.1.1", "def-ned", "paragraph", 106, "NEd è la forza normale di progetto dell’asta composta;", [math("NEd", "N_{Ed}"), text(" è la forza normale di progetto dell’asta composta;")]),
        block("C4.2.4.1.3.1.1", "def-h0", "paragraph", 106, "h0 è la distanza tra i baricentri dei correnti;", [math("h0", "h_0"), text(" è la distanza tra i baricentri dei correnti;")]),
        block("C4.2.4.1.3.1.1", "def-ac", "paragraph", 106, "AC è l’area della sezione di ciascun corrente;", [math("AC", "A_C"), text(" è l’area della sezione di ciascun corrente;")]),
        block("C4.2.4.1.3.1.1", "def-jeff", "paragraph", 106, "Jeff è il momento di inerzia efficace della sezione dell’elemento composto;", [math("Jeff", "J_{eff}"), text(" è il momento di inerzia efficace della sezione dell’elemento composto;")]),
        block("C4.2.4.1.3.1.1", "def-med", "paragraph", 106, "MEd è il momento di progetto dato da", [math("MEd", "M_{Ed}"), text(" è il momento di progetto dato da")]),
        formulaBlock("C4.2.4.1.3.1.1", "formula-23", formula("C4.2.23")),
        block("C4.2.4.1.3.1.1", "where-2", "paragraph", 106, "in cui"),
        block("C4.2.4.1.3.1.1", "def-ncr", "paragraph", 106, "Ncr è il carico critico euleriano dell’asta composta;", [math("Ncr", "N_{cr}"), text(" è il carico critico euleriano dell’asta composta;")]),
        block("C4.2.4.1.3.1.1", "def-mied", "paragraph", 106, "MᴵEd è il valore del massimo momento flettente agente in mezzeria dell’asta composta;", [math("MᴵEd", "M^I_{Ed}"), text(" è il valore del massimo momento flettente agente in mezzeria dell’asta composta;")]),
        block("C4.2.4.1.3.1.1", "def-sv", "paragraph", 107, "SV è la rigidezza a taglio equivalente della tralicciatura o della calastrellatura.", [math("SV", "S_V"), text(" è la rigidezza a taglio equivalente della tralicciatura o della calastrellatura.")]),
    ], ["C4.2.22", "C4.2.23"]),
    makeUnit("C4.2.4.1.3.1.2", "Calcolo della forza di taglio agente negli elementi di collegamento", [
        block("C4.2.4.1.3.1.2", "heading", "heading", 107, "C4.2.4.1.3.1.2. Calcolo della forza di taglio agente negli elementi di collegamento"),
        block("C4.2.4.1.3.1.2", "p1", "paragraph", 107, "La verifica dei calastrelli e degli elementi di parete dei tralicci nei campi estremi può essere eseguita considerando la forza di taglio nell’asta composta", [text("La verifica dei calastrelli e degli elementi di parete dei tralicci nei campi estremi può essere eseguita considerando la forza di taglio nell’asta composta")]),
        formulaBlock("C4.2.4.1.3.1.2", "formula-24", formula("C4.2.24")),
        block("C4.2.4.1.3.1.2", "p2", "paragraph", 107, "Per i calastrelli si devono considerare anche il momento flettente e lo sforzo di taglio dovuto al funzionamento a telaio dell’elemento."),
    ], ["C4.2.24"]),
    makeUnit("C4.2.4.1.3.1.3", "Verifiche di aste composte tralicciate", [
        block("C4.2.4.1.3.1.3", "heading", "heading", 107, "C4.2.4.1.3.1.3. Verifiche di aste composte tralicciate"),
        block("C4.2.4.1.3.1.3", "p1", "paragraph", 107, "Devono essere verificati nei riguardi dei fenomeni di instabilità sia i diagonali sia i correnti. La verifica si esegue controllando che", [text("Devono essere verificati nei riguardi dei fenomeni di instabilità sia i diagonali sia i correnti. La verifica si esegue controllando che")]),
        formulaBlock("C4.2.4.1.3.1.3", "formula-25", formula("C4.2.25")),
        block("C4.2.4.1.3.1.3", "p2", "paragraph", 107, "Nel caso dei correnti, Nc,Ed è la forza normale di progetto calcolata con la (C4.2.22), mentre Nb,Rd è il carico critico, determinato in riferimento alla lunghezza di libera inflessione Lch del corrente. Per correnti ad anima piena si può assumere Lch=a (v. Figura C4.2.7), per correnti tralicciati Lch dipende dallo schema adottato ed è indicato in Figura C4.2.8.", [text("Nel caso dei correnti, "), math("Nc,Ed", "N_{c,Ed}"), text(" è la forza normale di progetto calcolata con la (C4.2.22), mentre "), math("Nb,Rd", "N_{b,Rd}"), text(" è il carico critico, determinato in riferimento alla lunghezza di libera inflessione "), math("Lch", "L_{ch}"), text(" del corrente. Per correnti ad anima piena si può assumere "), math("Lch=a", "L_{ch}=a"), text(" (v. Figura C4.2.7), per correnti tralicciati "), math("Lch", "L_{ch}"), text(" dipende dallo schema adottato ed è indicato in Figura C4.2.8.")]),
        block("C4.2.4.1.3.1.3", "p3", "paragraph", 107, "La rigidezza equivalente dell’asta composta tralicciata può essere assunta uguale a"),
        formulaBlock("C4.2.4.1.3.1.3", "formula-26", formula("C4.2.26")),
        block("C4.2.4.1.3.1.3", "p4", "paragraph", 107, "mentre la rigidezza equivalente a taglio della tralicciatura, SV, può essere ricavata, in funzione dello schema di tralicciatura adottato, dalla Tabella C4.2.II.", [text("mentre la rigidezza equivalente a taglio della tralicciatura, "), math("SV", "S_V"), text(", può essere ricavata, in funzione dello schema di tralicciatura adottato, dalla Tabella C4.2.II.")]),
        figureBlock("C4.2.4.1.3.1.3", "figure-8", 107, fig("C4.2.8"), "Figura C4.2.8 -Lunghezza di libera inflessione dei correnti di aste tralicciate", figureData[1]!.region),
        tableBlock("C4.2.4.1.3.1.3", "table-ii", 107, tableIIId, "Tabella C4.2.II - Rigidezza a taglio equivalenti di aste tralicciate o calastrellate", reg(74, 590, 450, 170)),
    ], ["C4.2.25", "C4.2.26"], ["C4.2.II"], ["C4.2.8"]),
    makeUnit("C4.2.4.1.3.1.4", "Verifiche di aste composte calastrellate", [
        block("C4.2.4.1.3.1.4", "heading", "heading", 108, "C4.2.4.1.3.1.4. Verifiche di aste composte calastrellate"),
        block("C4.2.4.1.3.1.4", "p1", "paragraph", 108, "Nelle aste composte calastrellate le verifiche dei correnti e dei calastrelli possono essere condotte in riferimento alla distribuzione di forze e sollecitazioni indicata in Figura C4.2.9."),
        figureBlock("C4.2.4.1.3.1.4", "figure-9", 108, fig("C4.2.9"), "Figura C4.2.9 -Schema di calcolo semplificato per un’asta calastrellata", figureData[2]!.region),
        block("C4.2.4.1.3.1.4", "p2", "paragraph", 108, "Cautelativamente, nei correnti, lo sforzo di taglio massimo di progetto VEd può essere combinato con la forza normale massima di progetto NEd.", [text("Cautelativamente, nei correnti, lo sforzo di taglio massimo di progetto "), math("VEd", "V_{Ed}"), text(" può essere combinato con la forza normale massima di progetto "), math("NEd", "N_{Ed}"), text(".")]),
        block("C4.2.4.1.3.1.4", "p3", "paragraph", 108, "La rigidezza a taglio equivalente SV della parete calastrellata è indicata in Tabella C4.2.II (schema (4)).", [text("La rigidezza a taglio equivalente "), math("SV", "S_V"), text(" della parete calastrellata è indicata in Tabella C4.2.II (schema (4)).")]),
        block("C4.2.4.1.3.1.4", "p4", "paragraph", 108, "Il momento di inerzia effettivo della sezione composta può essere ricavato da"),
        formulaBlock("C4.2.4.1.3.1.4", "formula-27", formula("C4.2.27")),
        block("C4.2.4.1.3.1.4", "p5", "paragraph", 108, "dove JC è il momento di inerzia della sezione del corrente e μ è un coefficiente di efficienza, uguale a 0 se la snellezza dell’asta composta λ è maggiore o uguale a 150, uguale a 1 se la snellezza è minore o uguale a 75 e uguale a (2-λ/75) se la snellezza è compresa tra 75 e 150.", [text("dove "), math("JC", "J_C"), text(" è il momento di inerzia della sezione del corrente e "), math("μ", "\\mu"), text(" è un coefficiente di efficienza, uguale a 0 se la snellezza dell’asta composta "), math("λ", "\\lambda"), text(" è maggiore o uguale a 150, uguale a 1 se la snellezza è minore o uguale a 75 e uguale a (2-"), math("λ/75", "\\lambda/75"), text(") se la snellezza è compresa tra 75 e 150.")]),
        block("C4.2.4.1.3.1.4", "p6", "paragraph", 108, "La snellezza λ dell’asta è definita come:", [text("La snellezza "), math("λ", "\\lambda"), text(" dell’asta è definita come:")]),
        formulaBlock("C4.2.4.1.3.1.4", "formula-28", formula("C4.2.28")),
    ], ["C4.2.27", "C4.2.28"], [], ["C4.2.9"]),
    makeUnit("C4.2.4.1.3.1.5", "Sezioni composte da elementi ravvicinati collegati con calastrelli o imbottiture", [
        block("C4.2.4.1.3.1.5", "heading", "heading", 108, "C4.2.4.1.3.1.5. Sezioni composte da elementi ravvicinati collegati con calastrelli o imbottiture"),
        block("C4.2.4.1.3.1.5", "p1", "paragraph", 108, "La verifica di aste composte costituite da due o quattro profilati, vedi Figura C4.2.10, posti ad un intervallo pari alle spessore delle piastre di attacco ai nodi e comunque ad una distanza non superiore a 3 volte il loro spessore e collegati con calastrelli o imbottiture, può essere condotta come per un’asta semplice, trascurando la deformabilità a taglio del collegamento, se gli interassi dei collegamenti soddisfano le limitazioni della tabella C4.2.III. Nel caso di angolari a lati disuguali, tipo (6) di Figura C4.2.10, l’instabilità dell’asta con inflessione intorno all’asse y di Figura C4.2.10 può essere verificata considerando un raggio d’inerzia", [text("La verifica di aste composte costituite da due o quattro profilati, vedi Figura C4.2.10, posti ad un intervallo pari alle spessore delle piastre di attacco ai nodi e comunque ad una distanza non superiore a 3 volte il loro spessore e collegati con calastrelli o imbottiture, può essere condotta come per un’asta semplice, trascurando la deformabilità a taglio del collegamento, se gli interassi dei collegamenti soddisfano le limitazioni della tabella C4.2.III. Nel caso di angolari a lati disuguali, tipo (6) di Figura C4.2.10, l’instabilità dell’asta con inflessione intorno all’asse y di Figura C4.2.10 può essere verificata considerando un raggio d’inerzia")]),
        formulaBlock("C4.2.4.1.3.1.5", "formula-29", formula("C4.2.29")),
        block("C4.2.4.1.3.1.5", "p2", "paragraph", 108, "dove i0 è il raggio d’inerzia minimo dell’asta composta.", [text("dove "), math("i0", "i_0"), text(" è il raggio d’inerzia minimo dell’asta composta.")]),
        figureBlock("C4.2.4.1.3.1.5", "figure-10", 108, fig("C4.2.10"), "Figura C4.2.10 -Tipologie di aste composte costituite da elementi ravvicinati", figureData[3]!.region),
        tableBlock("C4.2.4.1.3.1.5", "table-iii", 109, tableIIIId, "Tabella C4.2.III - Disposizione delle imbottiture di connessione tra i profili", reg(74, 85, 450, 235)),
        block("C4.2.4.1.3.1.5", "p3", "paragraph", 109, "Nei casi in cui le aste non soddisfino le condizioni della Tabella C4.2.III è possibile determinare un’appropriata snellezza equivalente dell’asta ricorrendo a normative di comprovata validità."),
    ], ["C4.2.29"], ["C4.2.III"], ["C4.2.10"]),
];

const manifest = {
    $schema: "urn:structural-codes:schema:asset-manifest:v2",
    schemaVersion: "2.0.0-alpha.1",
    recordType: "asset-manifest",
    document: "circ2019",
    section: "C4.2-step2a",
    sourceId,
    status: "transcribed-unreviewed",
    formulas: formulaRows.map((row) => ({ id: formulaId(row.number), unitId: uid(row.unit), officialNumber: row.number, pdfPage: row.page, latex: row.latex })),
    tables: [tableII, tableIII],
    figures: figureData.map((row) => ({
        id: fig(row.number),
        unitId: uid(row.unit),
        officialNumber: row.number,
        pdfPage: row.page,
        caption: `Figura ${row.number}-${row.caption}`,
        alt: row.alt,
        imagePath: `figures/circ2019/fig${row.number.toLowerCase()}.png`,
        region: row.region,
        sha256: row.sha256,
    })),
};

await mkdir(unitDirectory, { recursive: true });
await mkdir(assetDirectory, { recursive: true });
await mkdir(figureDirectory, { recursive: true });
for (const row of figureData) {
    await copyFile(join(evidenceRenderDirectory, row.source), join(figureDirectory, `fig${row.number.toLowerCase()}.png`));
}
await Promise.all([
    ...units.map((unit) => writeFile(join(unitDirectory, `${unit.numbering.official.toLowerCase()}.json`), `${JSON.stringify(unit, null, 2)}\n`, "utf8")),
    writeFile(join(assetDirectory, "C4.2-step2a.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8"),
]);
console.log(`Circolare C4.2 step2a: generate ${units.length} unità, ${formulaRows.length} formule, 2 tabelle e ${figureData.length} figure.`);
