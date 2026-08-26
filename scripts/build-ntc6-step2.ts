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

const pageLines = new Map<number, string[]>();
for (let page = 197; page <= 206; page += 1) {
    const filename = join(sourceDir, `page-${String(page).padStart(4, "0")}.raw.txt`);
    pageLines.set(page, (await readFile(filename, "utf8")).replace(/\r\n/gu, "\n").split("\n"));
}

type Ref = [page: number, from: number, to?: number];
function raw(page: number, from: number, to = from): string {
    const lines = pageLines.get(page);
    if (!lines) throw new Error(`Evidence mancante per pagina ${page}`);
    return lines.slice(from - 1, to).join("\n");
}
function rawRefs(refs: Ref[]): string {
    return refs.map(([page, from, to]) => raw(page, from, to)).join("\n");
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
        .replace(/^66(?=\.\d)/u, "6")
        .replace(/\b66(?=\.\d)/gu, "6")
        .replace(/^Tab\.\s*/u, "Tab. ")
        .replace(/^((?:\d+\.)+\d+)\.\s+/u, "$1 ")
        .replace(/\bV ERIFICHE\b/gu, "VERIFICHE")
        .replace(/\bS OVRACCARICHI\b/gu, "SOVRACCARICHI")
        .replace(/\bM ODELLO\b/gu, "MODELLO")
        .replace(/\bA SPETTI\b/gu, "ASPETTI")
        .replace(/\bP ROVE\b/gu, "PROVE")
        .replace(/\bP RESCRIZIONI\b/gu, "PRESCRIZIONI")
        .replace(/\bC ONTROLLI\b/gu, "CONTROLLI")
        .replace(/\bC RITERI\b/gu, "CRITERI")
        .replace(/\bA NALISI\b/gu, "ANALISI")
        .replace(/\bC ARATTERIZZAZIONE\b/gu, "CARATTERIZZAZIONE")
        .replace(/\bO PERE\b/gu, "OPERE")
        .replace(/^[ƺȡ-]\s*/u, "")
        .replace(/[ƺȡ]/gu, "")
        .replace(/ǃ/gu, "≥")
        .replace(/·T/gu, "γT")
        .replace(/·R/gu, "γR")
        .replace(/Βa([1-4])/gu, "ξa$1")
        .replace(/Β/gu, "ξ")
        .replace(/Έ/gu, "φ")
        .replace(/Π[’']/gu, "π′")
        .replace(/\bJR\b/gu, "γR")
        .replace(/\bR ad\b/gu, "Rad")
        .replace(/\bP d\b/gu, "Pd")
        .replace(/\bR tr,d\b/gu, "Rtr,d")
        .replace(/\bR tr,k\b/gu, "Rtr,k")
        .replace(/\bR tr,m\b/gu, "Rtr,m")
        .replace(/\bR a,k\b/gu, "Rak")
        .replace(/\bR a,m\b/gu, "Ra,m")
        .replace(/\bR a,c\b/gu, "Ra,c")
        .replace(/\bF k\b/gu, "Fk")
        .replace(/\bX k\b/gu, "Xk")
        .replace(/\ba d\b/gu, "ad")
        .replace(/\bP d\b/gu, "Pd")
        .replace(/terrenostruttura/gu, "terreno-struttura")
        .replace(/\s+([,.;:])/gu, "$1")
        .trim();
    return value;
}

type MathTerm = [string, string];
const mathTerms: MathTerm[] = [
    ["5 + n/500", "5+\\frac{n}{500}"],
    ["A2+M2+R2", "\\mathrm{A2+M2+R2}"], ["A1+M1+R3", "\\mathrm{A1+M1+R3}"],
    ["A1+M1+R1", "\\mathrm{A1+M1+R1}"], ["A2+M2+R1", "\\mathrm{A2+M2+R1}"],
    ["Rtr,d", "R_{tr,d}"], ["Rtr,k", "R_{tr,k}"], ["Rtr,m", "R_{tr,m}"],
    ["Rad", "R_{ad}"], ["Rak", "R_{ak}"], ["Ra,m", "R_{a,m}"], ["Ra,c", "R_{a,c}"],
    ["γT", "\\gamma_T"], ["γR", "\\gamma_R"], ["γM", "\\gamma_M"],
    ["ξa1", "\\xi_{a1}"], ["ξa2", "\\xi_{a2}"], ["ξa3", "\\xi_{a3}"], ["ξa4", "\\xi_{a4}"],
    ["Pd", "P_d"], ["Ed", "E_d"], ["Rd", "R_d"], ["Fk", "F_k"], ["Xk", "X_k"],
    ["R3", "\\mathrm{R3}"], ["R2", "\\mathrm{R2}"], ["R1", "\\mathrm{R1}"], ["M1", "\\mathrm{M1}"], ["n", "n"],
    ["UPL", "\\mathrm{UPL}"], ["HYD", "\\mathrm{HYD}"], ["GEO", "\\mathrm{GEO}"], ["STR", "\\mathrm{STR}"],
    ["d ≥ 80 cm", "d\\ge 80\\,\\mathrm{cm}"], ["d < 80 cm", "d<80\\,\\mathrm{cm}"],
    ["k < 10^{-6} m/s", "k<10^{-6}\\,\\mathrm{m/s}"], ["δ > φ′/2", "\\delta>\\varphi'/2"],
];

const proseAcronyms = new Set(["UPL", "HYD", "GEO", "STR"]);
function inline(text: string, page: number): any[] | undefined {
    const isWord = (character: string | undefined): boolean => character !== undefined && /[\p{L}\p{N}]/u.test(character);
    const candidates: Array<{ start: number; end: number; value: string; latex: string }> = [];
    for (const [value, latex] of mathTerms) {
        if (page < 202 && value === "R2") continue;
        if (page >= 202 && proseAcronyms.has(value)) continue;
        let start = text.indexOf(value);
        while (start >= 0) {
            const end = start + value.length;
            const leftOk = !isWord(value[0]) || !isWord(text[start - 1]);
            const rightOk = !isWord(value.at(-1)) || !isWord(text[end]);
            if (leftOk && rightOk) candidates.push({ start, end, value, latex });
            start = text.indexOf(value, start + 1);
        }
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

const auditedThroughPage = 206;
const legacyExcludedValues = new Set([
    "5 + n/500", "A2+M2+R2", "A1+M1+R3", "A1+M1+R1", "A2+M2+R1",
    "Rd", "R3", "R1", "M1", "n", "δ > φ′/2",
]);
function inlineLegacy(text: string): any[] | undefined {
    const terms = mathTerms
        .filter((term) => !legacyExcludedValues.has(term[0]))
        .filter((term) => text.includes(term[0]))
        .sort((a, b) => b[0].length - a[0].length);
    if (terms.length === 0) return undefined;
    const segments: any[] = [];
    let cursor = 0;
    while (cursor < text.length) {
        let match: { index: number; term: MathTerm } | undefined;
        for (const term of terms) {
            const index = text.indexOf(term[0], cursor);
            if (index >= 0 && (!match || index < match.index)) match = { index, term };
        }
        if (!match) {
            segments.push({ kind: "text", value: text.slice(cursor) });
            break;
        }
        if (match.index > cursor) segments.push({ kind: "text", value: text.slice(cursor, match.index) });
        segments.push({ kind: "math", value: match.term[0], latex: match.term[1] });
        cursor = match.index + match.term[0].length;
    }
    return segments.filter((segment) => segment.value.length > 0);
}

function transformations(source: string, normalized: string): any[] {
    if (source === normalized) return [];
    const result: any[] = [];
    if (source.includes("\n")) result.push({ operation: "join-line-wrap", ruleVersion: profile, note: "Ricomposti i ritorni a capo tipografici verificati sul render ufficiale." });
    if (/[\u0000-\u001f\u007f-\u009fƺȡǃ·ΒΈΠ¿¾½¯®]/u.test(source)) result.push({ operation: "manual-correction", ruleVersion: profile, note: "Ripristinati numerazione, glifi, simboli matematici e marcatori di elenco verificati sul render ufficiale." });
    result.push({ operation: "normalize-whitespace", ruleVersion: profile, note: "Uniformati gli spazi dopo la ricomposizione editoriale." });
    result.push({ operation: "unicode-nfc", ruleVersion: profile, note: "Testo normalizzato in Unicode NFC." });
    return result;
}

function evidence(page: number, source: string, normalized: string, method = "pdf-text"): any {
    return {
        sourceId, pdfPage: page, printedPage: String(page - 4), region: null,
        extraction: { method, tool: method === "pdf-text" ? "pdfjs-dist" : "codex-source-transcription", toolVersion: method === "pdf-text" ? "4.10.38" : profile },
        transformations: transformations(source, normalized), rawSha256: hash(source), normalizedSha256: hash(normalized),
    };
}

type BlockSpec = { kind: "heading" | "paragraph" | "list-item" | "formula-ref" | "table-ref"; page: number; from: number; to?: number; norm?: string; asset?: string; refs?: Ref[] };
type UnitSpec = { number: string; title: string; heading: { page: number; from: number; to?: number; norm?: string }; blocks?: BlockSpec[] };
const aid = (kind: "formula" | "table", suffix: string): string => `urn:structural-codes:it:asset:${kind}:ntc2018:${suffix}`;
const uid = (number: string): string => `urn:structural-codes:it:unit:ntc2018:${number}`;
const f = (suffix: string): string => aid("formula", suffix);
const t = (suffix: string): string => aid("table", suffix);
const p = (page: number, from: number, to?: number, norm?: string): BlockSpec => ({ kind: "paragraph", page, from, to, norm });
const li = (page: number, from: number, to?: number, norm?: string): BlockSpec => ({ kind: "list-item", page, from, to, norm });
const ref = (kind: "formula-ref" | "table-ref", page: number, from: number, to: number, asset: string): BlockSpec => ({ kind, page, from, to, asset });
const multi = (kind: "paragraph" | "list-item", refs: Ref[], norm?: string): BlockSpec => {
    const first = refs[0];
    if (!first) throw new Error("Riferimento multiparte vuoto");
    return { kind, page: first[0], from: first[1], to: first[2], refs, norm };
};

const formulas = [
    { suffix: "6.6.1", unit: "6.6.2", number: "6.6.1", page: 202, latex: "R_{ak}=\\operatorname{Min}\\left\\{\\frac{(R_{a,m})_{\\mathrm{medio}}}{\\xi_{a1}};\\frac{(R_{a,m})_{\\mathrm{min}}}{\\xi_{a2}}\\right\\}" },
    { suffix: "6.6.2", unit: "6.6.2", number: "6.6.2", page: 202, latex: "R_{ak}=\\operatorname{Min}\\left\\{\\frac{(R_{a,c})_{\\mathrm{medio}}}{\\xi_{a3}};\\frac{(R_{a,c})_{\\mathrm{min}}}{\\xi_{a4}}\\right\\}" },
];
const cell = (text: string, latex?: string, extra: Record<string, number> = {}): any => ({ text, ...(latex ? { latex } : {}), ...extra });
const tables = [
    { id: t("6.4.vi"), unit: "6.4.3.1.2", number: "6.4.VI", page: 197, caption: "Coefficiente parziale γT per le verifiche agli stati limite ultimi di pali soggetti a carichi trasversali", columnCount: 1, headers: [[cell("Coefficiente parziale (R3)", "\\text{Coefficiente parziale }(\\mathrm{R3})")]], rows: [[cell("γT = 1,3", "\\gamma_T=1{,}3")]], notes: ["Trascrizione verificata sul render della pagina PDF 197; review umana cella per cella ancora obbligatoria."] },
    { id: t("6.5.i"), unit: "6.5.3.1.1", number: "6.5.I", page: 200, caption: "Coefficienti parziali γR per le verifiche agli stati limite ultimi di muri di sostegno", columnCount: 2, headers: [[cell("Verifica"), cell("Coefficiente parziale (R3)", "\\text{Coefficiente parziale }(\\mathrm{R3})")]], rows: [[cell("Capacità portante della fondazione"), cell("γR = 1,4", "\\gamma_R=1{,}4")], [cell("Scorrimento"), cell("γR = 1,1", "\\gamma_R=1{,}1")], [cell("Ribaltamento"), cell("γR = 1,15", "\\gamma_R=1{,}15")], [cell("Resistenza del terreno a valle"), cell("γR = 1,4", "\\gamma_R=1{,}4")]], notes: ["Trascrizione verificata sul render della pagina PDF 200; review umana cella per cella ancora obbligatoria."] },
    { id: t("6.6.i"), unit: "6.6.2", number: "6.6.I", page: 202, caption: "Coefficienti parziali per la resistenza degli ancoraggi", columnCount: 3, headers: [[cell(""), cell("Simbolo"), cell("Coefficiente parziale")]], rows: [[cell("Temporanei"), cell("γR", "\\gamma_R"), cell("1,1")], [cell("Permanenti"), cell("γR", "\\gamma_R"), cell("1,2")]], notes: ["Trascrizione verificata sul render della pagina PDF 202; review umana cella per cella ancora obbligatoria."] },
    { id: t("6.6.ii"), unit: "6.6.2", number: "6.6.II", page: 202, caption: "Fattori di correlazione per derivare la resistenza caratteristica da prove di progetto, in funzione del numero degli ancoraggi di prova", columnCount: 4, headers: [[cell("Numero degli ancoraggi di prova"), cell("1"), cell("2"), cell("> 2", ">2")]], rows: [[cell("ξa1", "\\xi_{a1}"), cell("1,5"), cell("1,4"), cell("1,3")], [cell("ξa2", "\\xi_{a2}"), cell("1,5"), cell("1,3"), cell("1,2")]], notes: ["Trascrizione verificata sul render della pagina PDF 202; review umana cella per cella ancora obbligatoria."] },
    { id: t("6.6.iii"), unit: "6.6.2", number: "6.6.III", page: 203, caption: "Fattori di correlazione per derivare la resistenza caratteristica dalle prove geotecniche, in funzione del numero n di profili di indagine", columnCount: 6, headers: [[cell("Numero di profili di indagine"), cell("1"), cell("2"), cell("3"), cell("4"), cell("≥ 5", "\\ge5")]], rows: [[cell("ξa3", "\\xi_{a3}"), cell("1,80"), cell("1,75"), cell("1,70"), cell("1,65"), cell("1,60")], [cell("ξa4", "\\xi_{a4}"), cell("1,80"), cell("1,70"), cell("1,65"), cell("1,60"), cell("1,55")]], notes: ["Trascrizione verificata sul render della pagina PDF 203; review umana cella per cella ancora obbligatoria."] },
    { id: t("6.8.i"), unit: "6.8.2", number: "6.8.I", page: 206, caption: "Coefficienti parziali per le verifiche di sicurezza di opere di materiali sciolti e di fronti di scavo", columnCount: 2, headers: [[cell("Coefficiente"), cell("R2", "\\mathrm{R2}")]], rows: [[cell("γR", "\\gamma_R"), cell("1,1")]], notes: ["Trascrizione verificata sul render della pagina PDF 206; review umana cella per cella ancora obbligatoria."] },
];

const units: UnitSpec[] = [
    { number: "6.4.3.1.1.1", title: "Resistenza a carico assiale di una palificata", heading: { page: 197, from: 3 }, blocks: [p(197, 4, 7)] },
    { number: "6.4.3.1.2", title: "Resistenze di pali soggetti a carichi trasversali", heading: { page: 197, from: 45 }, blocks: [p(197, 46, 47), ref("table-ref", 197, 48, 50, t("6.4.vi")), p(197, 51, 52), p(197, 53, 55)] },
    { number: "6.4.3.2", title: "VERIFICHE AGLI STATI LIMITE DI ESERCIZIO (SLE)", heading: { page: 197, from: 10 }, blocks: [p(197, 11), li(197, 12), li(197, 13), p(197, 14, 19)] },
    { number: "6.4.3.3", title: "VERIFICHE AGLI STATI LIMITE ULTIMI (SLU) DELLE FONDAZIONI MISTE", heading: { page: 197, from: 20 }, blocks: [p(197, 21, 22), p(197, 23, 24), p(197, 25, 26), li(197, 27), li(197, 28), li(197, 29), li(197, 30), li(197, 31), li(197, 32), li(197, 33), p(197, 34, 36), p(197, 37, 41), multi("paragraph", [[197, 42, 44], [198, 3, 4]])] },
    { number: "6.4.3.4", title: "VERIFICHE AGLI STATI LIMITE DI ESERCIZIO (SLE) DELLE FONDAZIONI MISTE", heading: { page: 198, from: 5 }, blocks: [p(198, 6, 7), p(198, 8, 10)] },
    { number: "6.4.3.5", title: "ASPETTI COSTRUTTIVI", heading: { page: 198, from: 11 }, blocks: [p(198, 12, 17)] },
    { number: "6.4.3.6", title: "CONTROLLI D’INTEGRITÀ DEI PALI", heading: { page: 198, from: 18 }, blocks: [p(198, 19, 20), p(198, 21, 22), p(198, 23, 24, "Nel caso di gruppi di pali di grande diametro (d ≥ 80 cm), il controllo dell’integrità deve essere effettuato su tutti i pali di ciascun gruppo se i pali del gruppo sono in numero inferiore o uguale a 4.")] },
    { number: "6.4.3.7", title: "PROVE DI CARICO", heading: { page: 198, from: 25 }, blocks: [] },
    { number: "6.4.3.7.1", title: "Prove di progetto su pali pilota", heading: { page: 198, from: 26 }, blocks: [p(198, 27, 31), p(198, 32, 33), p(198, 34, 36), p(198, 37, 38), p(198, 39, 41, "La resistenza del complesso palo-terreno è assunta pari al valore del carico applicato corrispondente ad un cedimento della testa pari al 10% del diametro nel caso di pali di piccolo e medio diametro (d < 80 cm), non inferiori al 5% del diametro nel caso di pali di grande diametro (d ≥ 80 cm)."), p(198, 42, 43), p(198, 44, 48, "Per i pali di grande diametro si può ricorrere a prove statiche eseguite su pali aventi la stessa lunghezza dei pali da realizzare, ma diametro inferiore, purché tali prove siano adeguatamente motivate ed interpretate al fine di fornire indicazioni utili per i pali da realizzare. In ogni caso, la riduzione del diametro non può essere superiore al 50% e tale da restituire un palo ancora di grande diametro (d ≥ 80 cm); il palo di prova deve essere opportunamente strumentato per consentire il rilievo separato delle curve di mobilitazione della resistenza laterale e della resistenza alla base."), p(198, 49, 50)] },
    { number: "6.4.3.7.2", title: "Prove in corso d’opera", heading: { page: 198, from: 51 }, blocks: [p(198, 52, 54), p(199, 3, 4), p(199, 5, 7), li(199, 8), li(199, 9), li(199, 10), li(199, 11), li(199, 12), li(199, 13), p(199, 14, 17), p(199, 18, 19)] },
    { number: "6.5", title: "OPERE DI SOSTEGNO", heading: { page: 199, from: 20 }, blocks: [p(199, 21, 22), li(199, 23, 24), li(199, 25, 26), li(199, 27, 28), p(199, 29, 30)] },
    { number: "6.5.1", title: "CRITERI GENERALI DI PROGETTO", heading: { page: 199, from: 31 }, blocks: [p(199, 32, 35), p(199, 36, 39), p(199, 40, 42), p(199, 43, 47), p(199, 48, 49), p(199, 50)] },
    { number: "6.5.2", title: "AZIONI", heading: { page: 199, from: 51 }, blocks: [p(199, 52, 53)] },
    { number: "6.5.2.1", title: "SOVRACCARICHI", heading: { page: 200, from: 3 }, blocks: [p(200, 4, 5)] },
    { number: "6.5.2.2", title: "MODELLO GEOMETRICO DI RIFERIMENTO", heading: { page: 200, from: 6 }, blocks: [p(200, 7, 8), p(200, 9, 10), li(200, 11), li(200, 12), li(200, 13), p(200, 14, 19, "Il livello della superficie libera dell’acqua deve essere scelto sulla base di misure e sulla possibile evoluzione del regime delle pressioni interstiziali anche legati a eventi di carattere eccezionale e a possibili malfunzionamenti dei sistemi di drenaggio. In assenza di particolari sistemi di drenaggio, nelle verifiche allo stato limite ultimo, si deve sempre ipotizzare che la superficie libera della falda non sia inferiore a quella del livello di sommità dei terreni con bassa permeabilità (k < 10^{-6} m/s).")] },
    { number: "6.5.3", title: "VERIFICHE AGLI STATI LIMITE", heading: { page: 200, from: 20 }, blocks: [p(200, 21, 23)] },
    { number: "6.5.3.1", title: "VERIFICHE DI SICUREZZA (SLU)", heading: { page: 200, from: 24 }, blocks: [p(200, 25, 28)] },
    { number: "6.5.3.1.1", title: "Muri di sostegno", heading: { page: 200, from: 29 }, blocks: [p(200, 30, 31), li(200, 32), li(200, 33), li(200, 34), li(200, 35), li(200, 36), li(200, 37), li(200, 38), p(200, 39, 42), p(200, 43, 44), p(200, 45), ref("table-ref", 200, 46, 54, t("6.5.i")), multi("paragraph", [[200, 55, 57], [201, 3, 5]]), p(201, 6, 10), p(201, 11, 12)] },
    { number: "6.5.3.1.2", title: "Paratie", heading: { page: 201, from: 13 }, blocks: [p(201, 14, 15), li(201, 16), li(201, 17), li(201, 18), li(201, 19), li(201, 20), li(201, 21), li(201, 22), li(201, 23), li(201, 24), li(201, 25), li(201, 26), li(201, 27), p(201, 28, 30), p(201, 31), li(201, 32), li(201, 33), p(201, 34, 35), p(201, 36, 37), p(201, 38, 39, "Fermo restando quanto specificato nel § 6.5.3.1.1 per il calcolo delle spinte, per valori dell’angolo d’attrito tra terreno e parete δ > φ′/2, ai fini della valutazione della resistenza passiva è necessario tener conto della non planarità delle superfici di scorrimento.")] },
    { number: "6.5.3.2", title: "VERIFICHE DI ESERCIZIO (SLE)", heading: { page: 201, from: 40 }, blocks: [p(201, 41, 43), p(201, 44, 45)] },
    { number: "6.6", title: "TIRANTI DI ANCORAGGIO", heading: { page: 201, from: 46 }, blocks: [p(201, 47)] },
    { number: "6.6.1", title: "CRITERI DI PROGETTO", heading: { page: 201, from: 48 }, blocks: [p(201, 49, 51), p(201, 52, 53), p(202, 3, 4), p(202, 5, 8), p(202, 9, 11), p(202, 12, 13), p(202, 14, 16)] },
    { number: "6.6.2", title: "VERIFICHE DI SICUREZZA (SLU)", heading: { page: 202, from: 17 }, blocks: [p(202, 18, 19), p(202, 20, 21), p(202, 22, 24), p(202, 25, 26), ref("table-ref", 202, 27, 30, t("6.6.i")), p(202, 31), li(202, 32), li(202, 33, 34), p(202, 35, 37), ref("formula-ref", 202, 38, 50, f("6.6.1")), p(202, 51, 54), ref("formula-ref", 202, 55, 55, f("6.6.2")), p(202, 56, 57), ref("table-ref", 202, 58, 61, t("6.6.ii")), ref("table-ref", 203, 3, 6, t("6.6.iii"))] },
    { number: "6.6.3", title: "ASPETTI COSTRUTTIVI", heading: { page: 203, from: 9 }, blocks: [p(203, 10, 12), p(203, 13), p(203, 14, 16)] },
    { number: "6.6.4", title: "PROVE DI CARICO", heading: { page: 203, from: 17 }, blocks: [] },
    { number: "6.6.4.1", title: "PROVE DI PROGETTO SU ANCORAGGI PRELIMINARI", heading: { page: 203, from: 18 }, blocks: [p(203, 19, 21), p(203, 22, 23), p(203, 24, 25), p(203, 26), li(203, 27), li(203, 28), li(203, 29), li(203, 30), li(203, 31), li(203, 32)] },
    { number: "6.6.4.2", title: "PROVE DI CARICO IN CORSO D’OPERA SUGLI ANCORAGGI", heading: { page: 203, from: 33 }, blocks: [p(203, 34, 37)] },
    { number: "6.7", title: "OPERE IN SOTTERRANEO", heading: { page: 204, from: 29 }, blocks: [p(204, 30, 33)] },
    { number: "6.7.1", title: "PRESCRIZIONI GENERALI", heading: { page: 204, from: 34 }, blocks: [p(204, 35, 36), p(204, 37, 42), li(204, 43, 44), li(204, 45), li(204, 3, 5), li(204, 46), li(204, 47, 48), li(204, 49, 51), li(204, 52, 53)] },
    { number: "6.7.2", title: "CARATTERIZZAZIONE GEOLOGICA", heading: { page: 204, from: 6 }, blocks: [p(204, 7, 8), p(204, 9, 14), p(204, 15, 16)] },
    { number: "6.7.3", title: "CARATTERIZZAZIONE E MODELLAZIONE GEOTECNICA", heading: { page: 204, from: 17 }, blocks: [p(204, 18, 21), p(204, 22, 25), p(204, 26, 28)] },
    { number: "6.7.4", title: "CRITERI DI PROGETTO", heading: { page: 205, from: 3 }, blocks: [p(205, 4, 9), p(205, 10, 12)] },
    { number: "6.7.5", title: "ANALISI PROGETTUALI E VERIFICHE DI SICUREZZA", heading: { page: 205, from: 13 }, blocks: [p(205, 14, 15), p(205, 16, 21), p(205, 22, 23), p(205, 24), li(205, 25), li(205, 26), p(205, 27), p(205, 28, 30), p(205, 31), p(205, 32, 36)] },
    { number: "6.7.6", title: "CONTROLLO E MONITORAGGIO", heading: { page: 205, from: 37 }, blocks: [p(205, 38, 43), p(205, 44, 46)] },
    { number: "6.8", title: "OPERE DI MATERIALI SCIOLTI E FRONTI DI SCAVO", heading: { page: 205, from: 47 }, blocks: [p(205, 48, 51)] },
    { number: "6.8.1", title: "CRITERI GENERALI DI PROGETTO", heading: { page: 205, from: 52 }, blocks: [p(205, 53, 55), p(205, 56, 57), p(205, 58, 59), p(206, 3, 6)] },
    { number: "6.8.2", title: "VERIFICHE DI SICUREZZA (SLU)", heading: { page: 206, from: 7 }, blocks: [p(206, 8, 9), p(206, 10, 11), ref("table-ref", 206, 12, 14, t("6.8.i")), p(206, 15, 16), p(206, 17, 20), p(206, 21, 24)] },
    { number: "6.8.3", title: "VERIFICHE DI ESERCIZIO (SLE)", heading: { page: 206, from: 25 }, blocks: [p(206, 26, 28)] },
    { number: "6.8.4", title: "ASPETTI COSTRUTTIVI", heading: { page: 206, from: 29 }, blocks: [p(206, 30, 31), p(206, 32, 34)] },
    { number: "6.8.5", title: "CONTROLLI E MONITORAGGIO", heading: { page: 206, from: 35 }, blocks: [p(206, 36, 39)] },
    { number: "6.8.6", title: "FRONTI DI SCAVO", heading: { page: 206, from: 40 }, blocks: [] },
    { number: "6.8.6.1", title: "INDAGINI GEOTECNICHE E CARATTERIZZAZIONE GEOTECNICA", heading: { page: 206, from: 41 }, blocks: [p(206, 42, 43)] },
    { number: "6.8.6.2", title: "CRITERI GENERALI DI PROGETTO E VERIFICHE DI SICUREZZA", heading: { page: 206, from: 44 }, blocks: [p(206, 45, 46), p(206, 47, 48), p(206, 49, 51), p(206, 52, 55)] },
];

function blockRecord(unit: UnitSpec, block: BlockSpec, index: number): any {
    const id = uid(unit.number);
    const blockId = `${id}#block-${index === 0 ? "heading" : `editorial-${String(index).padStart(3, "0")}`}`;
    const source = block.refs ? rawRefs(block.refs) : raw(block.page, block.from, block.to);
    if (block.kind === "formula-ref" || block.kind === "table-ref") return { blockId, kind: block.kind, origin: "official", assetId: block.asset, evidence: evidence(block.page, source, source, "manual-transcription") };
    const normalized = block.norm ?? normalize(source);
    const segments = block.page <= auditedThroughPage ? inline(normalized, block.page) : inlineLegacy(normalized);
    return { blockId, kind: block.kind, origin: "official", text: { raw: source, normalized, normalizationVersion: profile, ...(segments ? { inline: segments } : {}) }, evidence: evidence(block.page, source, normalized) };
}

for (const unit of units) {
    const id = uid(unit.number);
    const parts = unit.number.split(".");
    const blocks = [{ kind: "heading", ...unit.heading } as BlockSpec, ...(unit.blocks ?? [])].map((block, index) => blockRecord(unit, block, index));
    const ancestorParts = parts.slice(0, -1);
    const record = {
        $schema: "urn:structural-codes:schema:canonical-unit:v2", schemaVersion: "2.0.0-alpha.2", recordType: "canonical-unit", id,
        workId: "it-mit:dm:2018-01-17:ntc2018", expressionId: "it-mit:dm:2018-01-17:ntc2018:original-it",
        kind: parts.length === 1 ? "chapter" : parts.length === 2 ? "section" : parts.length === 3 ? "paragraph" : "subparagraph",
        numbering: { official: unit.number, sortKey: parts.map((part) => part.padStart(3, "0")).join(".") }, title: unit.title, titleBlockId: `${id}#block-heading`,
        hierarchy: { parentId: ancestorParts.length ? uid(ancestorParts.join(".")) : null, ancestorIds: ancestorParts.map((_, index) => uid(parts.slice(0, index + 1).join("."))), position: Number(parts[parts.length - 1]) },
        validity: { from: "2018-03-22", to: null, status: "in-force", asOf: "2026-08-09" }, blocks, citations: [], relations: [],
        assets: { formulaIds: blocks.filter((block: any) => block.kind === "formula-ref").map((block: any) => block.assetId), tableIds: blocks.filter((block: any) => block.kind === "table-ref").map((block: any) => block.assetId), figureIds: [] },
        workflow: { status: "extracted", createdBy: { actorId: "generator:ntc6:step2", kind: "script", toolVersion: profile }, createdAt, reviews: [], openIssues: [
            { issueId: `ntc2018-${unit.number.replaceAll(".", "-")}-source-review`, type: "normalization-review", severity: "blocking", note: "Trascrizione confrontata con il render ufficiale nello step; resta obbligatoria la revisione umana indipendente prima della pubblicazione." },
            ...(blocks.some((block: any) => block.kind === "formula-ref" || block.kind === "table-ref") ? [{ issueId: `ntc2018-${unit.number.replaceAll(".", "-")}-assets`, type: "asset-review", severity: "blocking", note: "Formule e tabelle sono separate e collocate nel flusso originario; resta obbligatorio il confronto umano puntuale con la fonte ufficiale." }] : []),
        ] },
    };
    await writeFile(join(unitDir, `${unit.number}.json`), `${JSON.stringify(record, null, 2)}\n`, "utf8");
}

const manifest = {
    $schema: "urn:structural-codes:schema:asset-manifest:v2", schemaVersion: "2.0.0-alpha.1", recordType: "asset-manifest", document: "ntc2018", section: "6-step2", sourceId, status: "transcribed-unreviewed",
    formulas: formulas.map(({ suffix, unit, number, page, latex }) => ({ id: f(suffix), unitId: uid(unit), officialNumber: number, pdfPage: page, latex })),
    tables: tables.map(({ id, unit, number, page, caption, columnCount, headers, rows, notes }) => ({ id, unitId: uid(unit), officialNumber: number, pdfPage: page, caption, columnCount, headers, rows, notes })), figures: [],
};
await mkdir(assetDir, { recursive: true });
await writeFile(join(assetDir, "6-step2.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(`ntc6-step2: generated ${units.length} units, ${formulas.length} formulas, ${tables.length} tables`);
