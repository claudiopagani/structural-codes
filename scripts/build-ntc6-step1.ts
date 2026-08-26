/* eslint-disable @typescript-eslint/no-explicit-any */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const sourceId = "gu-so8-2018-ntc";
const profile = "ntc6-editorial-profile-0.1.0";
const createdAt = "2026-08-09T12:00:00Z";
const sourceDir = join(root, "evidence", sourceId, "pages");
const unitDir = join(root, "corpus", "units", "ntc2018");
const assetDir = join(root, "corpus", "assets", "ntc2018");
const throughPageArg = process.argv.indexOf("--through-page");
const throughPage = throughPageArg >= 0 ? Number(process.argv[throughPageArg + 1]) : null;
if (throughPage !== null && (!Number.isInteger(throughPage) || throughPage < 187 || throughPage > 196)) {
    throw new Error("--through-page deve essere una pagina intera compresa fra 187 e 196");
}

const pageLines = new Map<number, string[]>();
for (let page = 187; page <= 196; page += 1) {
    const filename = join(sourceDir, `page-${String(page).padStart(4, "0")}.raw.txt`);
    pageLines.set(
        page,
        (await readFile(filename, "utf8")).replace(/\r\n/gu, "\n").split("\n"),
    );
}

function raw(page: number, from: number, to = from): string {
    const lines = pageLines.get(page);
    if (!lines) throw new Error(`Evidence mancante per pagina ${page}`);
    return lines.slice(from - 1, to).join("\n");
}

function hash(value: string): string {
    return createHash("sha256").update(value, "utf8").digest("hex");
}

function normalize(source: string): string {
    let value = source
        .replace(/-\n(?=[a-zàèìòù])/gu, "")
        .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/gu, "")
        .replace(/\n/gu, " ")
        .replace(/\s+/gu, " ")
        .trim();

    value = value
        .replace(/^C?CAPITOLO 6\.?\s*/u, "")
        .replace(/^66(?=\.\d)/u, "6")
        .replace(/\b66(?=\.\d)/gu, "6")
        .replace(/^(\d+(?:\.\d+)+)\.\s+/u, "$1 ")
        .replace(/\bV ERIFICHE\b/gu, "VERIFICHE")
        .replace(/\bN ORME\b/gu, "NORME")
        .replace(/\bD ETTAGLI\b/gu, "DETTAGLI")
        .replace(/\bP ROGETTO\b/gu, "PROGETTO")
        .replace(/^[ƺȡ]\s*/u, "")
        .replace(/[ƺȡ]/gu, "")
        .replace(/ǂ/gu, "≤")
        .replace(/ǃ/gu, "≥")
        .replace(/·G1/gu, "γG1")
        .replace(/·G2/gu, "γG2")
        .replace(/·Qi/gu, "γQi")
        .replace(/·F/gu, "γF")
        .replace(/·E/gu, "γE")
        .replace(/·M/gu, "γM")
        .replace(/·WR/gu, "γτR")
        .replace(/·R/gu, "γR")
        .replace(/\bE inst,d\b/gu, "Einst,d")
        .replace(/\bE stb,d\b/gu, "Estb,d")
        .replace(/\bE d\b/gu, "Ed")
        .replace(/\bR d\b/gu, "Rd")
        .replace(/\bVinst,d\b/gu, "Vinst,d")
        .replace(/\bGstb,d\b/gu, "Gstb,d")
        .replace(/\bG inst,d\b/gu, "Ginst,d")
        .replace(/\bQ inst,d\b/gu, "Qinst,d")
        .replace(/\bR c,k\b/gu, "Rc,k")
        .replace(/\bR t,k\b/gu, "Rt,k")
        .replace(/\bR c,m\b/gu, "Rc,m")
        .replace(/\bR t,m\b/gu, "Rt,m")
        .replace(/\bR c,cal\b/gu, "Rc,cal")
        .replace(/\bR t,cal\b/gu, "Rt,cal")
        .replace(/\bR k\b/gu, "Rk")
        .replace(/\bR c\b/gu, "Rc")
        .replace(/\bR t\b/gu, "Rt")
        .replace(/ȥ/gu, "ψ")
        .replace(/\bJF\b/gu, "γF")
        .replace(/\bF k\b/gu, "Fk")
        .replace(/\bX k\b/gu, "Xk")
        .replace(/\ba d\b/gu, "ad")
        .replace(/Gstb,d\s+\)/gu, "Gstb,d)")
        .replace(/terrenostruttura/gu, "terreno-struttura")
        .replace(/Πȝk/gu, "tan φ′k")
        .replace(/·Πȝ/gu, "γφ′")
        .replace(/\bJR\b/gu, "γR")
        .replace(/\bWR\b/gu, "τR")
        .replace(/Wf/gu, "τf")
        .replace(/\bW\b/gu, "τ")
        .replace(/Β([1-6])/gu, "ξ$1")
        .replace(/Β/gu, "ξ")
        .replace(/\s+([,.;:])/gu, "$1")
        .trim();
    return value;
}

type MathTerm = [string, string];
const mathTerms: MathTerm[] = [
    ["γτR =1,0", "\\gamma_{\\tau_R}=1{,}0"],
    ["γτR=1,25", "\\gamma_{\\tau_R}=1{,}25"],
    ["γE = γF", "\\gamma_E=\\gamma_F"],
    ["γF Fk", "\\gamma_F F_k"],
    ["Xk /γM", "\\frac{X_k}{\\gamma_M}"],
    ["A2+M2+R2", "\\mathrm{A2+M2+R2}"],
    ["A1+M1+R3", "\\mathrm{A1+M1+R3}"],
    ["γR = 3", "\\gamma_R=3"],
    ["γR = 2", "\\gamma_R=2"],
    ["Einst,d", "E_{inst,d}"],
    ["Estb,d", "E_{stb,d}"],
    ["Vinst,d", "V_{inst,d}"],
    ["Gstb,d", "G_{stb,d}"],
    ["Ginst,d", "G_{inst,d}"],
    ["Qinst,d", "Q_{inst,d}"],
    ["Rc,cal", "R_{c,cal}"],
    ["Rt,cal", "R_{t,cal}"],
    ["Rc,m", "R_{c,m}"],
    ["Rt,m", "R_{t,m}"],
    ["Rc,k", "R_{c,k}"],
    ["Rt,k", "R_{t,k}"],
    ["γG1", "\\gamma_{G1}"],
    ["γG2", "\\gamma_{G2}"],
    ["γQi", "\\gamma_{Qi}"],
    ["γφ′", "\\gamma_{\\varphi'}"],
    ["γF", "\\gamma_F"],
    ["γE", "\\gamma_E"],
    ["γM", "\\gamma_M"],
    ["γR", "\\gamma_R"],
    ["γτR", "\\gamma_{\\tau_R}"],
    ["ψij", "\\psi_{ij}"],
    ["φ′k", "\\varphi'_k"],
    ["c′k", "c'_k"],
    ["cuk", "c_{uk}"],
    ["τf", "\\tau_f"],
    ["τR", "\\tau_R"],
    ["τ", "\\tau"],
    ["ic", "i_c"],
    ["ξ1", "\\xi_1"],
    ["ξ2", "\\xi_2"],
    ["ξ3", "\\xi_3"],
    ["ξ4", "\\xi_4"],
    ["ξ5", "\\xi_5"],
    ["ξ6", "\\xi_6"],
    ["ξ", "\\xi"],
    ["n", "n"],
    ["M1", "\\mathrm{M1}"],
    ["R3", "\\mathrm{R3}"],
    ["Ed", "E_d"],
    ["Rd", "R_d"],
    ["Fk", "F_k"],
    ["Xk", "X_k"],
    ["Cd", "C_d"],
    ["Rk", "R_k"],
];

function inline(text: string, terms = mathTerms): any[] | undefined {
    const isWord = (character: string | undefined): boolean => character !== undefined && /[\p{L}\p{N}]/u.test(character);
    const candidates: Array<{ start: number; end: number; value: string; latex: string }> = [];
    for (const [value, latex] of terms) {
        let start = text.indexOf(value);
        while (start >= 0) {
            const end = start + value.length;
            const leftOk = !isWord(value[0]) || !isWord(text[start - 1]);
            const rightOk = !isWord(value.at(-1)) || !isWord(text[end]);
            if (leftOk && rightOk) candidates.push({ start, end, value, latex });
            start = text.indexOf(value, start + 1);
        }
    }
    const hydraulicGradient = /(?<=gradiente idraulico )i(?= risulti)/gu;
    for (const match of text.matchAll(hydraulicGradient)) {
        candidates.push({ start: match.index, end: match.index + 1, value: "i", latex: "i" });
    }
    const designParameter = /(?<=parametri geometrici di progetto )ad\b/gu;
    for (const match of text.matchAll(designParameter)) {
        candidates.push({ start: match.index, end: match.index + 2, value: "ad", latex: "a_d" });
    }
    candidates.sort((left, right) => left.start - right.start || (right.end - right.start) - (left.end - left.start));
    const matches: typeof candidates = [];
    for (const candidate of candidates) {
        if (!matches.some((match) => candidate.start < match.end && candidate.end > match.start)) matches.push(candidate);
    }
    if (matches.length === 0) return undefined;
    const segments: any[] = [];
    let cursor = 0;
    for (const match of matches) {
        if (match.start > cursor) segments.push({ kind: "text", value: text.slice(cursor, match.start) });
        segments.push({ kind: "math", value: match.value, latex: match.latex });
        cursor = match.end;
    }
    if (cursor < text.length) segments.push({ kind: "text", value: text.slice(cursor) });
    return segments.filter((segment) => segment.value.length > 0);
}

const step17TermValues = new Set(["A2+M2+R2", "A1+M1+R3", "ξ", "n", "M1", "R3"]);
const beforeStep17Terms = mathTerms.filter(([value]) => !step17TermValues.has(value));

function transformations(source: string, normalized: string): any[] {
    if (source === normalized) return [];
    const result: any[] = [];
    if (source.includes("\n")) {
        result.push({
            operation: "join-line-wrap",
            ruleVersion: profile,
            note: "Ricomposti i ritorni a capo tipografici verificati sul render ufficiale.",
        });
    }
    if (/[\u0000-\u001f\u007f-\u009fƺȡǂǃ·ΒΠȝW]/u.test(source)) {
        result.push({
            operation: "manual-correction",
            ruleVersion: profile,
            note: "Ripristinati numerazione, glifi, simboli matematici e marcatori di elenco verificati sul render ufficiale.",
        });
    }
    result.push({
        operation: "normalize-whitespace",
        ruleVersion: profile,
        note: "Uniformati gli spazi dopo la ricomposizione editoriale.",
    });
    result.push({
        operation: "unicode-nfc",
        ruleVersion: profile,
        note: "Testo normalizzato in Unicode NFC.",
    });
    return result;
}

function evidence(page: number, source: string, normalized: string, method = "pdf-text"): any {
    return {
        sourceId,
        pdfPage: page,
        printedPage: String(page - 4),
        region: null,
        extraction: {
            method,
            tool: method === "pdf-text" ? "pdfjs-dist" : "codex-source-transcription",
            toolVersion: method === "pdf-text" ? "4.10.38" : profile,
        },
        transformations: transformations(source, normalized),
        rawSha256: hash(source),
        normalizedSha256: hash(normalized),
    };
}

type BlockSpec = {
    kind: "heading" | "paragraph" | "list-item" | "formula-ref" | "table-ref";
    page: number;
    from: number;
    to?: number;
    norm?: string;
    asset?: string;
};
type UnitSpec = {
    number: string;
    title: string;
    heading: { page: number; from: number; to?: number; norm?: string };
    blocks?: BlockSpec[];
};

const aid = (kind: "formula" | "table", suffix: string): string =>
    `urn:structural-codes:it:asset:${kind}:ntc2018:${suffix}`;
const uid = (number: string): string => `urn:structural-codes:it:unit:ntc2018:${number}`;
const f = (suffix: string): string => aid("formula", suffix);
const t = (suffix: string): string => aid("table", suffix);

const formulas = [
    { suffix: "6.2.4.1:equ", unit: "6.2.4.1", number: null, page: 189, latex: "E_{inst,d}\\le E_{stb,d}" },
    { suffix: "6.2.1", unit: "6.2.4.1", number: "6.2.1", page: 189, latex: "E_d\\le R_d" },
    { suffix: "6.2.2a", unit: "6.2.4.1", number: "6.2.2a", page: 189, latex: "E_d=E\\left[\\gamma_F F_k;\\frac{X_k}{\\gamma_M};a_d\\right]" },
    { suffix: "6.2.2b", unit: "6.2.4.1", number: "6.2.2b", page: 189, latex: "E_d=\\gamma_E\\cdot E\\left[F_k;\\frac{X_k}{\\gamma_M};a_d\\right]" },
    { suffix: "6.2.3", unit: "6.2.4.1", number: "6.2.3", page: 189, latex: "R_d=\\frac{1}{\\gamma_R}R\\left[\\gamma_F F_k;\\frac{X_k}{\\gamma_M};a_d\\right]" },
    { suffix: "6.2.4", unit: "6.2.4.2", number: "6.2.4", page: 191, latex: "V_{inst,d}\\le G_{stb,d}+R_d" },
    { suffix: "6.2.5", unit: "6.2.4.2", number: "6.2.5", page: 191, latex: "V_{inst,d}=G_{inst,d}+Q_{inst,d}" },
    { suffix: "6.2.7", unit: "6.2.4.3", number: "6.2.7", page: 191, latex: "E_d\\le C_d" },
    { suffix: "6.4.1", unit: "6.4.3.1.1", number: "6.4.1", page: 196, latex: "R_{c,k}=\\operatorname{Min}\\left\\{\\frac{(R_{c,m})_{\\mathrm{media}}}{\\xi_1};\\frac{(R_{c,m})_{\\mathrm{min}}}{\\xi_2}\\right\\}" },
    { suffix: "6.4.2", unit: "6.4.3.1.1", number: "6.4.2", page: 196, latex: "R_{t,k}=\\operatorname{Min}\\left\\{\\frac{(R_{t,m})_{\\mathrm{media}}}{\\xi_1};\\frac{(R_{t,m})_{\\mathrm{min}}}{\\xi_2}\\right\\}" },
    { suffix: "6.4.3", unit: "6.4.3.1.1", number: "6.4.3", page: 196, latex: "R_{c,k}=\\operatorname{Min}\\left\\{\\frac{(R_{c,cal})_{\\mathrm{media}}}{\\xi_3};\\frac{(R_{c,cal})_{\\mathrm{min}}}{\\xi_4}\\right\\}" },
    { suffix: "6.4.4", unit: "6.4.3.1.1", number: "6.4.4", page: 196, latex: "R_{t,k}=\\operatorname{Min}\\left\\{\\frac{(R_{t,cal})_{\\mathrm{media}}}{\\xi_3};\\frac{(R_{t,cal})_{\\mathrm{min}}}{\\xi_4}\\right\\}" },
    { suffix: "6.4.5", unit: "6.4.3.1.1", number: "6.4.5", page: 196, latex: "R_{c,k}=\\operatorname{Min}\\left\\{\\frac{(R_{c,m})_{\\mathrm{media}}}{\\xi_5};\\frac{(R_{c,m})_{\\mathrm{min}}}{\\xi_6}\\right\\}" },
];

const cell = (text: string, latex?: string, extra: Record<string, number> = {}): any => ({
    text,
    ...(latex ? { latex } : {}),
    ...extra,
});

const tables = [
    {
        id: t("6.2.i"), unit: "6.2.4.1.1", number: "6.2.I", page: 190,
        caption: "Coefficienti parziali per le azioni o per l’effetto delle azioni",
        columnCount: 6,
        headers: [
            [cell(""), cell("Effetto"), cell("Coefficiente Parziale"), cell("EQU"), cell("(A1)"), cell("(A2)")],
            [cell(""), cell(""), cell("γF (o γE)", "\\gamma_F\\;(\\mathrm{o}\\;\\gamma_E)"), cell(""), cell(""), cell("")],
        ],
        rows: [
            [cell("Carichi permanenti G₁", "G_1", { rowSpan: 2 }), cell("Favorevole"), cell("γG1", "\\gamma_{G1}", { rowSpan: 2 }), cell("0,9"), cell("1,0"), cell("1,0")],
            [cell("Sfavorevole"), cell("1,1"), cell("1,3"), cell("1,0")],
            [cell("Carichi permanenti G₂ (1)", "G_2", { rowSpan: 2 }), cell("Favorevole"), cell("γG2", "\\gamma_{G2}", { rowSpan: 2 }), cell("0,8"), cell("0,8"), cell("0,8")],
            [cell("Sfavorevole"), cell("1,5"), cell("1,5"), cell("1,3")],
            [cell("Azioni variabili Q", "Q", { rowSpan: 2 }), cell("Favorevole"), cell("γQi", "\\gamma_{Qi}", { rowSpan: 2 }), cell("0,0"), cell("0,0"), cell("0,0")],
            [cell("Sfavorevole"), cell("1,5"), cell("1,5"), cell("1,3")],
        ],
        notes: ["(1) Per i carichi permanenti G₂ si applica quanto indicato alla Tabella 2.6.I. Per la spinta delle terre si fa riferimento ai coefficienti γG1.", "Trascrizione verificata sul render della pagina PDF 190; review umana cella per cella ancora obbligatoria."],
    },
    {
        id: t("6.2.ii"), unit: "6.2.4.1.2", number: "6.2.II", page: 190,
        caption: "Coefficienti parziali per i parametri geotecnici del terreno",
        columnCount: 5,
        headers: [[cell("Parametro"), cell("Grandezza alla quale applicare il coefficiente parziale"), cell("Coefficiente parziale γM", "\\gamma_M"), cell("(M1)"), cell("(M2)")]],
        rows: [
            [cell("Tangente dell’angolo di resistenza al taglio"), cell("tan φ′k", "\\tan\\varphi'_k"), cell("γφ′", "\\gamma_{\\varphi'}"), cell("1,0"), cell("1,25")],
            [cell("Coesione efficace"), cell("c′k", "c'_k"), cell("γc′", "\\gamma_{c'}"), cell("1,0"), cell("1,25")],
            [cell("Resistenza non drenata"), cell("cuk", "c_{uk}"), cell("γcu", "\\gamma_{cu}"), cell("1,0"), cell("1,4")],
            [cell("Peso dell’unità di volume"), cell("γ", "\\gamma"), cell("γγ", "\\gamma_\\gamma"), cell("1,0"), cell("1,0")],
        ],
        notes: ["Trascrizione verificata sul render della pagina PDF 190; review umana cella per cella ancora obbligatoria."],
    },
    {
        id: t("6.2.iii"), unit: "6.2.4.2", number: "6.2.III", page: 191,
        caption: "Coefficienti parziali sulle azioni per le verifiche nei confronti di stati limite di sollevamento",
        columnCount: 4,
        headers: [[cell(""), cell("Effetto"), cell("Coefficiente Parziale γF (o γE)", "\\text{Coefficiente Parziale }\\gamma_F\\;(\\mathrm{o}\\;\\gamma_E)"), cell("Sollevamento (UPL)")]],
        rows: [
            [cell("Carichi permanenti G₁", "G_1", { rowSpan: 2 }), cell("Favorevole"), cell("γG1", "\\gamma_{G1}", { rowSpan: 2 }), cell("0,9")],
            [cell("Sfavorevole"), cell("1,1")],
            [cell("Carichi permanenti G₂ (1)", "G_2", { rowSpan: 2 }), cell("Favorevole"), cell("γG2", "\\gamma_{G2}", { rowSpan: 2 }), cell("0,8")],
            [cell("Sfavorevole"), cell("1,5")],
            [cell("Azioni variabili Q", "Q", { rowSpan: 2 }), cell("Favorevole"), cell("γQi", "\\gamma_{Qi}", { rowSpan: 2 }), cell("0,0")],
            [cell("Sfavorevole"), cell("1,5")],
        ],
        notes: ["(1) Per i carichi permanenti G₂ si applica quanto indicato alla Tabella 2.6.I. Per la spinta delle terre si fa riferimento ai coefficienti γG1.", "Trascrizione verificata sul render della pagina PDF 191; review umana cella per cella ancora obbligatoria."],
    },
    {
        id: t("6.4.i"), unit: "6.4.2.1", number: "6.4.I", page: 194,
        caption: "Coefficienti parziali γR per le verifiche agli stati limite ultimi di fondazioni superficiali",
        columnCount: 2,
        headers: [[cell("Verifica"), cell("Coefficiente parziale")], [cell(""), cell("(R3)", "(\\mathrm{R3})")]],
        rows: [[cell("Carico limite"), cell("γR = 2,3", "\\gamma_R=2{,}3")], [cell("Scorrimento"), cell("γR = 1,1", "\\gamma_R=1{,}1")]],
        notes: ["Trascrizione verificata sul render della pagina PDF 194; review umana cella per cella ancora obbligatoria."],
    },
    {
        id: t("6.4.ii"), unit: "6.4.3.1.1", number: "6.4.II", page: 195,
        caption: "Coefficienti parziali γR da applicare alle resistenze caratteristiche a carico verticale dei pali",
        columnCount: 5,
        headers: [[cell("Resistenza"), cell("Simbolo"), cell("Pali infissi"), cell("Pali trivellati"), cell("Pali ad elica continua")], [cell(""), cell("γR", "\\gamma_R"), cell("(R3)", "(\\mathrm{R3})"), cell("(R3)", "(\\mathrm{R3})"), cell("(R3)", "(\\mathrm{R3})")]],
        rows: [
            [cell("Base"), cell("γb", "\\gamma_b"), cell("1,15"), cell("1,35"), cell("1,3")],
            [cell("Laterale in compressione"), cell("γs", "\\gamma_s"), cell("1,15"), cell("1,15"), cell("1,15")],
            [cell("Totale (*)"), cell("γ", "\\gamma"), cell("1,15"), cell("1,30"), cell("1,25")],
            [cell("Laterale in trazione"), cell("γst", "\\gamma_{st}"), cell("1,25"), cell("1,25"), cell("1,25")],
        ],
        notes: ["(*) da applicare alle resistenze caratteristiche dedotte dai risultati di prove di carico di progetto.", "Trascrizione verificata sul render della pagina PDF 195; review umana cella per cella ancora obbligatoria."],
    },
    {
        id: t("6.4.iii"), unit: "6.4.3.1.1", number: "6.4.III", page: 196,
        caption: "Fattori di correlazione ξ per la determinazione della resistenza caratteristica a partire dai risultati di prove di carico statico su pali pilota",
        columnCount: 6,
        headers: [[cell("Numero di prove di carico"), cell("1"), cell("2"), cell("3"), cell("4"), cell("≥ 5", "\\ge5")]],
        rows: [[cell("ξ1", "\\xi_1"), cell("1,40"), cell("1,30"), cell("1,20"), cell("1,10"), cell("1,0")], [cell("ξ2", "\\xi_2"), cell("1,40"), cell("1,20"), cell("1,05"), cell("1,00"), cell("1,0")]],
        notes: ["Trascrizione verificata sul render della pagina PDF 196; review umana cella per cella ancora obbligatoria."],
    },
    {
        id: t("6.4.iv"), unit: "6.4.3.1.1", number: "6.4.IV", page: 196,
        caption: "Fattori di correlazione ξ per la determinazione della resistenza caratteristica in funzione del numero di verticali indagate",
        columnCount: 8,
        headers: [[cell("Numero di verticali indagate"), cell("1"), cell("2"), cell("3"), cell("4"), cell("5"), cell("7"), cell("≥ 10", "\\ge10")]],
        rows: [[cell("ξ3", "\\xi_3"), cell("1,70"), cell("1,65"), cell("1,60"), cell("1,55"), cell("1,50"), cell("1,45"), cell("1,40")], [cell("ξ4", "\\xi_4"), cell("1,70"), cell("1,55"), cell("1,48"), cell("1,42"), cell("1,34"), cell("1,28"), cell("1,21")]],
        notes: ["Trascrizione verificata sul render della pagina PDF 196; review umana cella per cella ancora obbligatoria."],
    },
    {
        id: t("6.4.v"), unit: "6.4.3.1.1", number: "6.4.V", page: 196,
        caption: "Fattori di correlazione ξ per la determinazione della resistenza caratteristica a partire dai risultati di prove dinamiche su pali pilota",
        columnCount: 6,
        headers: [[cell("Numero di prove di carico"), cell("≥ 2", "\\ge2"), cell("≥ 5", "\\ge5"), cell("≥ 10", "\\ge10"), cell("≥ 15", "\\ge15"), cell("≥ 20", "\\ge20")]],
        rows: [[cell("ξ5", "\\xi_5"), cell("1,60"), cell("1,50"), cell("1,45"), cell("1,42"), cell("1,40")], [cell("ξ6", "\\xi_6"), cell("1,50"), cell("1,35"), cell("1,30"), cell("1,25"), cell("1,25")]],
        notes: ["Trascrizione verificata sul render della pagina PDF 196; review umana cella per cella ancora obbligatoria."],
    },
];

const units: UnitSpec[] = [
    { number: "6", title: "PROGETTAZIONE GEOTECNICA", heading: { page: 187, from: 3, to: 4, norm: "6 PROGETTAZIONE GEOTECNICA" } },
    { number: "6.1", title: "DISPOSIZIONI GENERALI", heading: { page: 188, from: 3, norm: "6.1 DISPOSIZIONI GENERALI" } },
    { number: "6.1.1", title: "OGGETTO DELLE NORME", heading: { page: 188, from: 4, norm: "6.1.1 OGGETTO DELLE NORME" }, blocks: [
        { kind: "paragraph", page: 188, from: 5, to: 6 },
        ...Array.from({ length: 8 }, (_, index) => ({ kind: "list-item" as const, page: 188, from: 7 + index })),
        { kind: "paragraph", page: 188, from: 15 },
    ] },
    { number: "6.1.2", title: "PRESCRIZIONI GENERALI", heading: { page: 188, from: 16 }, blocks: [
        { kind: "paragraph", page: 188, from: 17, to: 19 },
        { kind: "paragraph", page: 188, from: 20, to: 21 },
        { kind: "paragraph", page: 188, from: 22, to: 24 },
    ] },
    { number: "6.2", title: "ARTICOLAZIONE DEL PROGETTO", heading: { page: 188, from: 25 }, blocks: [
        { kind: "paragraph", page: 188, from: 26 },
        { kind: "list-item", page: 188, from: 27 },
        { kind: "list-item", page: 188, from: 28 },
        { kind: "list-item", page: 188, from: 29, to: 30 },
        { kind: "list-item", page: 188, from: 31 },
        { kind: "list-item", page: 188, from: 32 },
        { kind: "list-item", page: 188, from: 33 },
    ] },
    { number: "6.2.1", title: "CARATTERIZZAZIONE E MODELLAZIONE GEOLOGICA DEL SITO", heading: { page: 188, from: 34 }, blocks: [
        { kind: "paragraph", page: 188, from: 35, to: 37 },
        { kind: "paragraph", page: 188, from: 38, to: 40 },
        { kind: "paragraph", page: 188, from: 41, to: 42 },
        { kind: "paragraph", page: 188, from: 43, to: 44 },
        { kind: "paragraph", page: 188, from: 45, to: 49 },
    ] },
    { number: "6.2.2", title: "INDAGINI, CARATTERIZZAZIONE E MODELLAZIONE GEOTECNICA", heading: { page: 189, from: 3 }, blocks: [
        { kind: "paragraph", page: 189, from: 4, to: 9 },
        { kind: "paragraph", page: 189, from: 10, to: 13 },
        { kind: "paragraph", page: 189, from: 14, to: 17 },
        { kind: "paragraph", page: 189, from: 18, to: 20 },
        { kind: "paragraph", page: 189, from: 21, to: 22 },
        { kind: "paragraph", page: 189, from: 23, to: 25 },
        { kind: "paragraph", page: 189, from: 26, to: 28 },
    ] },
    { number: "6.2.3", title: "FASI E MODALITA’ COSTRUTTIVE", heading: { page: 189, from: 29 }, blocks: [{ kind: "paragraph", page: 189, from: 30, to: 32 }] },
    { number: "6.2.4", title: "VERIFICHE DELLA SICUREZZA E DELLE PRESTAZIONI", heading: { page: 189, from: 33 }, blocks: [{ kind: "paragraph", page: 189, from: 34, to: 35 }] },
    { number: "6.2.4.1", title: "VERIFICHE NEI CONFRONTI DEGLI STATI LIMITE ULTIMI (SLU)", heading: { page: 189, from: 36 }, blocks: [
        { kind: "paragraph", page: 189, from: 37 },
        { kind: "formula-ref", page: 189, from: 38, asset: f("6.2.4.1:equ") },
        { kind: "paragraph", page: 189, from: 39, to: 41 },
        { kind: "paragraph", page: 189, from: 42, to: 43 },
        { kind: "formula-ref", page: 189, from: 44, asset: f("6.2.1") },
        { kind: "paragraph", page: 189, from: 45 },
        { kind: "formula-ref", page: 189, from: 46, asset: f("6.2.2a") },
        { kind: "formula-ref", page: 189, from: 47, asset: f("6.2.2b") },
        { kind: "paragraph", page: 189, from: 48 },
        { kind: "formula-ref", page: 189, from: 49, asset: f("6.2.3") },
        { kind: "paragraph", page: 190, from: 3, to: 10 },
        { kind: "paragraph", page: 190, from: 11, to: 13 },
        { kind: "paragraph", page: 190, from: 14 },
        { kind: "paragraph", page: 190, from: 15, to: 16 },
        { kind: "paragraph", page: 190, from: 17 },
        { kind: "paragraph", page: 190, from: 18, to: 21 },
    ] },
    { number: "6.2.4.1.1", title: "Azioni", heading: { page: 190, from: 22 }, blocks: [
        { kind: "paragraph", page: 190, from: 23, to: 26 },
        { kind: "paragraph", page: 190, from: 27, to: 28 },
        { kind: "paragraph", page: 190, from: 29, to: 30 },
        { kind: "table-ref", page: 190, from: 31, to: 40, asset: t("6.2.i") },
    ] },
    { number: "6.2.4.1.2", title: "Resistenze", heading: { page: 190, from: 41 }, blocks: [
        { kind: "paragraph", page: 190, from: 42 },
        { kind: "list-item", page: 190, from: 43, to: 45 },
        { kind: "list-item", page: 190, from: 46, to: 47 },
        { kind: "list-item", page: 190, from: 48, to: 49 },
        { kind: "table-ref", page: 190, from: 50, to: 60, asset: t("6.2.ii") },
        { kind: "paragraph", page: 191, from: 3, to: 6 },
    ] },
    { number: "6.2.4.1.3", title: "Verifiche strutturali con l’analisi di interazione terreno-struttura", heading: { page: 191, from: 7 }, blocks: [{ kind: "paragraph", page: 191, from: 8, to: 9 }] },
    { number: "6.2.4.2", title: "Verifiche nei confronti degli stati limite ultimi idraulici", heading: { page: 191, from: 10 }, blocks: [
        { kind: "paragraph", page: 191, from: 11 },
        { kind: "paragraph", page: 191, from: 12, to: 13 },
        { kind: "paragraph", page: 191, from: 14, to: 17 },
        { kind: "formula-ref", page: 191, from: 18, asset: f("6.2.4") },
        { kind: "paragraph", page: 191, from: 19, norm: "dove" },
        { kind: "formula-ref", page: 191, from: 19, asset: f("6.2.5") },
        { kind: "paragraph", page: 191, from: 20, to: 23 },
        { kind: "table-ref", page: 191, from: 24, to: 39, asset: t("6.2.iii") },
        { kind: "paragraph", page: 191, from: 40 },
        { kind: "list-item", page: 191, from: 41, to: 44 },
        { kind: "list-item", page: 191, from: 45, to: 47 },
        { kind: "paragraph", page: 191, from: 48, to: 49 },
        { kind: "paragraph", page: 191, from: 50, to: 51 },
    ] },
    { number: "6.2.4.3", title: "VERIFICHE NEI CONFRONTI DEGLI STATI LIMITE DI ESERCIZIO (SLE)", heading: { page: 191, from: 52 }, blocks: [
        { kind: "paragraph", page: 191, from: 53, to: 54 },
        { kind: "paragraph", page: 191, from: 55, to: 57 },
        { kind: "paragraph", page: 191, from: 58 },
        { kind: "formula-ref", page: 191, from: 59, asset: f("6.2.7") },
        { kind: "paragraph", page: 191, from: 60, to: 63 },
    ] },
    { number: "6.2.5", title: "IMPIEGO DEL METODO OSSERVAZIONALE", heading: { page: 192, from: 3 }, blocks: [
        { kind: "paragraph", page: 192, from: 4, to: 6 },
        { kind: "paragraph", page: 192, from: 7 },
        { kind: "list-item", page: 192, from: 8, to: 9 },
        { kind: "list-item", page: 192, from: 10 },
        { kind: "list-item", page: 192, from: 11 },
        { kind: "list-item", page: 192, from: 12, to: 13 },
    ] },
    { number: "6.2.6", title: "MONITORAGGIO DEL COMPLESSO OPERA-TERRENO", heading: { page: 192, from: 14 }, blocks: [
        { kind: "paragraph", page: 192, from: 15, to: 17 },
        { kind: "paragraph", page: 192, from: 18, to: 20 },
        { kind: "paragraph", page: 192, from: 21 },
    ] },
    { number: "6.3", title: "STABILITÀ DEI PENDII NATURALI", heading: { page: 192, from: 22 }, blocks: [{ kind: "paragraph", page: 192, from: 23, to: 24 }] },
    { number: "6.3.1", title: "PRESCRIZIONI GENERALI", heading: { page: 192, from: 25 }, blocks: [{ kind: "paragraph", page: 192, from: 26, to: 30 }] },
    { number: "6.3.2", title: "MODELLAZIONE GEOLOGICA DEL PENDIO", heading: { page: 192, from: 31 }, blocks: [{ kind: "paragraph", page: 192, from: 32, to: 35 }, { kind: "paragraph", page: 192, from: 36, to: 37 }] },
    { number: "6.3.3", title: "MODELLAZIONE GEOTECNICA DEL PENDIO", heading: { page: 192, from: 38 }, blocks: [
        { kind: "paragraph", page: 192, from: 39, to: 41 },
        { kind: "paragraph", page: 192, from: 42 },
        { kind: "list-item", page: 192, from: 43, to: 44 },
        { kind: "list-item", page: 192, from: 45, to: 47 },
        { kind: "paragraph", page: 192, from: 48, to: 51 },
        { kind: "paragraph", page: 193, from: 3, to: 5 },
        { kind: "paragraph", page: 193, from: 6, to: 7 },
        { kind: "paragraph", page: 193, from: 8, to: 10 },
    ] },
    { number: "6.3.4", title: "VERIFICHE DI SICUREZZA", heading: { page: 193, from: 11 }, blocks: [
        { kind: "paragraph", page: 193, from: 12, to: 14 },
        { kind: "paragraph", page: 193, from: 15, to: 16 },
        { kind: "paragraph", page: 193, from: 17, to: 18 },
        { kind: "paragraph", page: 193, from: 19, to: 20 },
        { kind: "paragraph", page: 193, from: 21, to: 23, norm: "La valutazione del coefficiente di sicurezza dei pendii naturali, espresso dal rapporto tra la resistenza al taglio disponibile (τf) e la tensione di taglio agente (τ) lungo la superficie di scorrimento, deve essere eseguita impiegando sia i parametri geotecnici, congruenti con i caratteri del cinematismo atteso o accertato, sia le azioni presi con il loro valore caratteristico." },
        { kind: "paragraph", page: 193, from: 24, to: 26 },
    ] },
    { number: "6.3.5", title: "INTERVENTI DI STABILIZZAZIONE", heading: { page: 193, from: 27 }, blocks: [{ kind: "paragraph", page: 193, from: 28, to: 31 }, { kind: "paragraph", page: 193, from: 32, to: 34 }, { kind: "paragraph", page: 193, from: 35, to: 37 }] },
    { number: "6.3.6", title: "CONTROLLI E MONITORAGGIO", heading: { page: 193, from: 38 }, blocks: [{ kind: "paragraph", page: 193, from: 39, to: 42 }, { kind: "paragraph", page: 193, from: 43, to: 44 }] },
    { number: "6.4", title: "OPERE DI FONDAZIONE", heading: { page: 193, from: 45 }, blocks: [] },
    { number: "6.4.1", title: "CRITERI GENERALI DI PROGETTO", heading: { page: 193, from: 46 }, blocks: [{ kind: "paragraph", page: 193, from: 47, to: 48 }, { kind: "paragraph", page: 193, from: 49, to: 50 }, { kind: "paragraph", page: 193, from: 51, to: 52 }, { kind: "paragraph", page: 194, from: 3 }, { kind: "paragraph", page: 194, from: 4, to: 5 }] },
    { number: "6.4.2", title: "FONDAZIONI SUPERFICIALI", heading: { page: 194, from: 6 }, blocks: [{ kind: "paragraph", page: 194, from: 7, to: 8 }, { kind: "paragraph", page: 194, from: 9, to: 10 }, { kind: "paragraph", page: 194, from: 11, to: 12 }, { kind: "paragraph", page: 194, from: 13, to: 14 }] },
    { number: "6.4.2.1", title: "VERIFICHE AGLI STATI LIMITE ULTIMI (SLU)", heading: { page: 194, from: 15 }, blocks: [
        { kind: "paragraph", page: 194, from: 16, to: 17 },
        { kind: "paragraph", page: 194, from: 18, to: 20 },
        { kind: "paragraph", page: 194, from: 21, to: 22 },
        { kind: "paragraph", page: 194, from: 23, to: 24 },
        { kind: "list-item", page: 194, from: 25 },
        { kind: "list-item", page: 194, from: 26 },
        { kind: "list-item", page: 194, from: 27 },
        { kind: "list-item", page: 194, from: 28 },
        { kind: "list-item", page: 194, from: 29 },
        { kind: "list-item", page: 194, from: 30 },
        { kind: "paragraph", page: 194, from: 31, to: 33 },
        { kind: "paragraph", page: 194, from: 34, to: 35 },
        { kind: "paragraph", page: 194, from: 36 },
        { kind: "table-ref", page: 194, from: 48, to: 53, asset: t("6.4.i") },
    ] },
    { number: "6.4.2.2", title: "VERIFICHE AGLI STATI LIMITE DI ESERCIZIO (SLE)", heading: { page: 194, from: 37 }, blocks: [{ kind: "paragraph", page: 194, from: 38, to: 40 }, { kind: "paragraph", page: 194, from: 41, to: 43 }] },
    { number: "6.4.3", title: "FONDAZIONI SU PALI", heading: { page: 194, from: 44 }, blocks: [{ kind: "paragraph", page: 194, from: 45, to: 47 }, { kind: "paragraph", page: 195, from: 3, to: 4 }, { kind: "paragraph", page: 195, from: 5, to: 7 }, { kind: "paragraph", page: 195, from: 8, to: 9 }, { kind: "paragraph", page: 195, from: 10, to: 11 }, { kind: "paragraph", page: 195, from: 12, to: 13 }, { kind: "paragraph", page: 195, from: 14, to: 15 }] },
    { number: "6.4.3.1", title: "VERIFICHE AGLI STATI LIMITE ULTIMI (SLU)", heading: { page: 195, from: 16 }, blocks: [
        { kind: "paragraph", page: 195, from: 17, to: 18 },
        { kind: "paragraph", page: 195, from: 19, to: 21 },
        { kind: "paragraph", page: 195, from: 22, to: 23 },
        { kind: "paragraph", page: 195, from: 24, to: 25 },
        { kind: "list-item", page: 195, from: 26 },
        { kind: "list-item", page: 195, from: 27 },
        { kind: "list-item", page: 195, from: 28 },
        { kind: "list-item", page: 195, from: 29 },
        { kind: "list-item", page: 195, from: 30 },
        { kind: "list-item", page: 195, from: 31 },
        { kind: "list-item", page: 195, from: 32 },
        { kind: "list-item", page: 195, from: 33 },
        { kind: "paragraph", page: 195, from: 34, to: 36 },
        { kind: "paragraph", page: 195, from: 37, to: 38 },
        { kind: "paragraph", page: 195, from: 39 },
    ] },
    { number: "6.4.3.1.1", title: "Resistenze di pali soggetti a carichi assiali", heading: { page: 195, from: 40 }, blocks: [
        { kind: "paragraph", page: 195, from: 41, to: 42 },
        { kind: "table-ref", page: 195, from: 43, to: 55, asset: t("6.4.ii") },
        { kind: "paragraph", page: 195, from: 56 },
        { kind: "list-item", page: 195, from: 57 },
        { kind: "list-item", page: 195, from: 58, to: 59 },
        { kind: "list-item", page: 196, from: 3 },
        { kind: "paragraph", page: 196, from: 4 },
        { kind: "paragraph", page: 196, from: 5, to: 8 },
        { kind: "formula-ref", page: 196, from: 9, asset: f("6.4.1") },
        { kind: "formula-ref", page: 196, from: 10, asset: f("6.4.2") },
        { kind: "table-ref", page: 196, from: 11, to: 14, asset: t("6.4.iii") },
        { kind: "paragraph", page: 196, from: 15, to: 18 },
        { kind: "formula-ref", page: 196, from: 19, asset: f("6.4.3") },
        { kind: "formula-ref", page: 196, from: 20, asset: f("6.4.4") },
        { kind: "table-ref", page: 196, from: 21, to: 24, asset: t("6.4.iv") },
        { kind: "paragraph", page: 196, from: 25, to: 29 },
        { kind: "paragraph", page: 196, from: 30, to: 33 },
        { kind: "formula-ref", page: 196, from: 34, asset: f("6.4.5") },
        { kind: "table-ref", page: 196, from: 35, to: 38, asset: t("6.4.v") },
    ] },
];

function blockRecord(unit: UnitSpec, block: BlockSpec, index: number): any {
    const id = uid(unit.number);
    const blockId = `${id}#block-${index === 0 ? "heading" : `editorial-${String(index).padStart(3, "0")}`}`;
    const source = raw(block.page, block.from, block.to);
    if (block.kind === "formula-ref" || block.kind === "table-ref") {
        return { blockId, kind: block.kind, origin: "official", assetId: block.asset, evidence: evidence(block.page, source, source, "manual-transcription") };
    }
    const normalized = block.norm ?? normalize(source);
    const segments = inline(normalized, block.page >= 192 ? mathTerms : beforeStep17Terms);
    return {
        blockId,
        kind: block.kind,
        origin: "official",
        text: { raw: source, normalized, normalizationVersion: profile, ...(segments ? { inline: segments } : {}) },
        evidence: evidence(block.page, source, normalized),
    };
}

await mkdir(unitDir, { recursive: true });
for (const unit of units) {
    const unitPages = [unit.heading.page, ...(unit.blocks ?? []).map((block) => block.page)];
    if (throughPage !== null && Math.max(...unitPages) > throughPage) continue;
    const id = uid(unit.number);
    const parts = unit.number.split(".");
    const blocks = [
        { kind: "heading", ...unit.heading } as BlockSpec,
        ...(unit.blocks ?? []),
    ].map((block, index) => blockRecord(unit, block, index));
    const ancestorParts = parts.slice(0, -1);
    const record = {
        $schema: "urn:structural-codes:schema:canonical-unit:v2",
        schemaVersion: "2.0.0-alpha.2",
        recordType: "canonical-unit",
        id,
        workId: "it-mit:dm:2018-01-17:ntc2018",
        expressionId: "it-mit:dm:2018-01-17:ntc2018:original-it",
        kind: parts.length === 1 ? "chapter" : parts.length === 2 ? "section" : parts.length === 3 ? "paragraph" : "subparagraph",
        numbering: { official: unit.number, sortKey: parts.map((part) => part.padStart(3, "0")).join(".") },
        title: unit.title,
        titleBlockId: `${id}#block-heading`,
        hierarchy: {
            parentId: ancestorParts.length ? uid(ancestorParts.join(".")) : null,
            ancestorIds: ancestorParts.map((_, index) => uid(parts.slice(0, index + 1).join("."))),
            position: Number(parts[parts.length - 1]),
        },
        validity: { from: "2018-03-22", to: null, status: "in-force", asOf: "2026-08-09" },
        blocks,
        citations: [],
        relations: [],
        assets: {
            formulaIds: blocks.filter((block: any) => block.kind === "formula-ref").map((block: any) => block.assetId),
            tableIds: blocks.filter((block: any) => block.kind === "table-ref").map((block: any) => block.assetId),
            figureIds: [],
        },
        workflow: {
            status: "extracted",
            createdBy: { actorId: "generator:ntc6:step1", kind: "script", toolVersion: profile },
            createdAt,
            reviews: [],
            openIssues: [
                { issueId: `ntc2018-${unit.number.replaceAll(".", "-")}-source-review`, type: "normalization-review", severity: "blocking", note: "Trascrizione confrontata con il render ufficiale nello step; resta obbligatoria la revisione umana indipendente prima della pubblicazione." },
                ...(blocks.some((block: any) => block.kind === "formula-ref" || block.kind === "table-ref") ? [{ issueId: `ntc2018-${unit.number.replaceAll(".", "-")}-assets`, type: "asset-review", severity: "blocking", note: "Formule e tabelle sono separate e collocate nel flusso originario; resta obbligatorio il confronto umano puntuale con la fonte ufficiale." }] : []),
            ],
        },
    };
    await writeFile(join(unitDir, `${unit.number}.json`), `${JSON.stringify(record, null, 2)}\n`, "utf8");
}

const manifest = {
    $schema: "urn:structural-codes:schema:asset-manifest:v2",
    schemaVersion: "2.0.0-alpha.1",
    recordType: "asset-manifest",
    document: "ntc2018",
    section: "6-step1",
    sourceId,
    status: "transcribed-unreviewed",
    formulas: formulas.map(({ suffix, unit, number, page, latex }) => ({ id: f(suffix), unitId: uid(unit), officialNumber: number, pdfPage: page, latex })),
    tables: tables.map(({ id, unit, number, page, caption, columnCount, headers, rows, notes }) => ({ id, unitId: uid(unit), officialNumber: number, pdfPage: page, caption, columnCount, headers, rows, notes })),
    figures: [],
};
await writeFile(join(assetDir, "6-step1.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
const generatedUnits = throughPage === null
    ? units.length
    : units.filter((unit) => Math.max(unit.heading.page, ...(unit.blocks ?? []).map((block) => block.page)) <= throughPage).length;
console.log(`ntc6-step1: generated ${generatedUnits} units, ${formulas.length} formulas, ${tables.length} tables`);
