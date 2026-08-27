/* eslint-disable @typescript-eslint/no-explicit-any */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../", import.meta.url));
const sourceId = "gu-so8-2018-ntc";
const profile = "ntc76-editorial-profile-0.1.0";
const actor = {
    actorId: "generator:ntc76:step1",
    kind: "script",
    toolVersion: profile,
};
const createdAt = "2026-08-09T00:00:00Z";

const pageLines = new Map<number, string[]>();
for (let page = 251; page <= 258; page += 1) {
    const filename = join(
        repoRoot,
        "evidence",
        sourceId,
        "pages",
        `page-${String(page).padStart(4, "0")}.raw.txt`,
    );
    pageLines.set(page, (await readFile(filename, "utf8")).replace(/\r\n/gu, "\n").split("\n"));
}

function raw(page: number, from: number, to = from): string {
    const lines = pageLines.get(page);
    if (!lines) throw new Error(`Evidence mancante per pagina ${page}`);
    return lines.slice(from - 1, to).join("\n");
}

function sha256(value: string): string {
    return createHash("sha256").update(value, "utf8").digest("hex");
}

function sha256Bytes(value: Uint8Array): string {
    return createHash("sha256").update(value).digest("hex");
}

function clean(source: string): string {
    return source
        .replace(/\n/gu, " ")
        .replace(/\s+/gu, " ")
        .replace(/^[^\S\r\n]*77\.6/gu, "7.6")
        .replace(/\bA CCIAIO\b/gu, "ACCIAIO")
        .replace(/\bF ATTORI\b/gu, "FATTORI")
        .replace(/\bV ERIFICHE\b/gu, "VERIFICHE")
        .replace(/\bD ETTAGLI\b/gu, "DETTAGLI")
        .replace(/\bM EMBRATURE\b/gu, "MEMBRATURE")
        .replace(/\bA NALISI\b/gu, "ANALISI")
        .replace(/\bP ANNELLI\b/gu, "PANNELLI")
        .replace(//gu, "-")
        .replace(/·/gu, "γ")
        .replace(/ǂ/gu, "≤")
        .replace(/Ή/gu, "ε")
        .replace(/P\s*\u0003\s*\u0003/gu, "μ")
        .trim();
}

function transformations(source: string, normalized: string): any[] {
    if (source === normalized) return [];
    const operations: any[] = [];
    if (source.includes("\n")) {
        operations.push({
            operation: "join-line-wrap",
            ruleVersion: profile,
            note: "Ricomposti i ritorni a capo esclusivamente tipografici verificati sul render ufficiale.",
        });
    }
    if (normalized !== clean(source)) {
        operations.push({
            operation: "manual-correction",
            ruleVersion: profile,
            note: "Ripristinati manualmente glifi, simboli matematici, indici e marcatori verificati sul render ufficiale.",
        });
    }
    operations.push({
        operation: "normalize-whitespace",
        ruleVersion: profile,
        note: "Uniformati gli spazi dopo la ricomposizione editoriale.",
    });
    operations.push({
        operation: "unicode-nfc",
        ruleVersion: profile,
        note: "Testo normalizzato in Unicode NFC.",
    });
    return operations;
}

function evidence(
    page: number,
    source: string,
    normalized: string,
    method = "pdf-text",
    region: any = null,
): any {
    return {
        sourceId,
        pdfPage: page,
        printedPage: String(page - 4),
        region,
        extraction: {
            method,
            tool: method === "pdf-text" ? "pdfjs-dist" : "codex-manual-asset-transcription",
            toolVersion: method === "pdf-text" ? "4.10.38" : profile,
        },
        transformations: transformations(source, normalized),
        rawSha256: sha256(source),
        normalizedSha256: sha256(normalized),
    };
}

type MathTerm = { value: string; latex: string };
const m = (value: string, latex: string): MathTerm => ({ value, latex });

function inlineSegments(text: string, terms: MathTerm[]): any[] | undefined {
    const unique = [...new Map(terms.map((term) => [term.value, term])).values()]
        .filter((term) => text.includes(term.value))
        .sort((left, right) => right.value.length - left.value.length);
    if (unique.length === 0) return undefined;
    const segments: any[] = [];
    let cursor = 0;
    const isWordChar = (character: string | undefined): boolean => character !== undefined && /[\p{L}\p{N}_]/u.test(character);
    const isBoundaryMatch = (index: number, term: MathTerm): boolean => {
        const before = text[index - 1];
        const after = text[index + term.value.length];
        return !(isWordChar(term.value[0]) && isWordChar(before)) && !(isWordChar(term.value.at(-1)) && isWordChar(after));
    };
    const nextBoundaryIndex = (term: MathTerm, start: number): number => {
        let index = text.indexOf(term.value, start);
        while (index >= 0 && !isBoundaryMatch(index, term)) {
            index = text.indexOf(term.value, index + term.value.length);
        }
        return index;
    };
    while (cursor < text.length) {
        let match: { index: number; term: MathTerm } | undefined;
        for (const term of unique) {
            const index = nextBoundaryIndex(term, cursor);
            if (
                index >= 0 &&
                (match === undefined || index < match.index ||
                    (index === match.index && term.value.length > match.term.value.length))
            ) {
                match = { index, term };
            }
        }
        if (!match) {
            segments.push({ kind: "text", value: text.slice(cursor) });
            break;
        }
        if (match.index > cursor) segments.push({ kind: "text", value: text.slice(cursor, match.index) });
        segments.push({ kind: "math", value: match.term.value, latex: match.term.latex });
        cursor = match.index + match.term.value.length;
    }
    return segments.filter(({ value }) => value.length > 0);
}

type TextSpec = {
    kind: "heading" | "paragraph" | "list-item";
    page: number;
    from: number;
    to?: number;
    normalized?: string;
    math?: MathTerm[];
};
type AssetSpec = {
    kind: "formula-ref" | "table-ref" | "figure-ref";
    page: number;
    from: number;
    to?: number;
    assetId: string;
    region?: any;
};
type BlockSpec = TextSpec | AssetSpec;
type UnitSpec = {
    number: string;
    title: string;
    heading: TextSpec;
    blocks?: BlockSpec[];
    extraIssues?: any[];
};

const idFor = (number: string): string => `urn:structural-codes:it:unit:ntc2018:${number}`;
const assetId = (kind: "formula" | "table" | "figure", suffix: string): string =>
    `urn:structural-codes:it:asset:${kind}:ntc2018:${suffix}`;
const sortKey = (number: string): string => number.split(".").map((part) => part.padStart(3, "0")).join(".");
const ancestors = (number: string): string[] => {
    const parts = number.split(".");
    return parts.slice(1).map((_, index) => idFor(parts.slice(0, index + 1).join(".")));
};
const position = (number: string): number => Number(number.split(".").at(-1));
const unitKind = (number: string): string => {
    const depth = number.split(".").length;
    if (depth === 1) return "chapter";
    if (depth === 2) return "section";
    if (depth === 3) return "paragraph";
    return "subparagraph";
};

function textBlock(unitId: string, blockId: string, spec: TextSpec): any {
    const source = raw(spec.page, spec.from, spec.to);
    const normalized = spec.normalized ?? clean(source);
    const inline = inlineSegments(normalized, spec.math ?? []);
    return {
        blockId: `${unitId}#${blockId}`,
        kind: spec.kind,
        origin: "official",
        text: {
            raw: source,
            normalized,
            normalizationVersion: profile,
            ...(inline ? { inline } : {}),
        },
        evidence: evidence(spec.page, source, normalized),
    };
}

function assetBlock(unitId: string, blockId: string, spec: AssetSpec): any {
    const source = raw(spec.page, spec.from, spec.to);
    return {
        blockId: `${unitId}#${blockId}`,
        kind: spec.kind,
        origin: "official",
        assetId: spec.assetId,
        evidence: evidence(spec.page, source, source, "manual-transcription", spec.region ?? null),
    };
}

const formula = (number: string, page: number, from: number, to: number, latex: string): AssetSpec => {
    void latex;
    return { kind: "formula-ref", page, from, to, assetId: assetId("formula", number) };
};
const table = (number: string, page: number, from: number, to: number): AssetSpec => ({
    kind: "table-ref",
    page,
    from,
    to,
    assetId: assetId("table", number),
});
const figure = (number: string, page: number, from: number, to: number, region: any): AssetSpec => ({
    kind: "figure-ref",
    page,
    from,
    to,
    assetId: assetId("figure", number),
    region,
});

const tableI = assetId("table", "7.6.i");
const tableII = assetId("table", "7.6.ii");
const tableIII = assetId("table", "7.6.iii");
const tableIV = assetId("table", "7.6.iv");
const figure61 = assetId("figure", "7.6.1");
const figure62 = assetId("figure", "7.6.2");

const math = {
    q0: m("q0", "q_0"),
    gammaOv: m("γ_ov", "\\gamma_{ov}"),
    gammaRd: m("γRd", "\\gamma_{Rd}"),
    ePlRd: m("Epl,Rd", "E_{pl,Rd}"),
    eURd: m("EU,Rd", "E_{U,Rd}"),
    eSd: m("ESd", "E_{Sd}"),
    rjD: m("Rj,d", "R_{j,d}"),
    ruRd: m("RU,Rd", "R_{U,Rd}"),
    vwpRd: m("Vwp,Rd", "V_{wp,Rd}"),
    vwpSRd: m("Vwp,s,Rd", "V_{wp,s,Rd}"),
    vwpCRd: m("Vwp,c,Rd", "V_{wp,c,Rd}"),
    vwpSd: m("Vwp,Sd", "V_{wp,Sd}"),
    q: m("q", "q"),
    mu: m("μ", "\\mu"),
    qu: m("q_u", "q_u"),
    qy: m("q_y", "q_y"),
    nEd: m("NEd", "N_{Ed}"),
    nPlRd: m("Npl,Rd", "N_{pl,Rd}"),
    n: m("n", "n"),
    ea: m("Ea", "E_a"),
    ecm: m("Ecm", "E_{cm}"),
    i1: m("I1", "I_1"),
    i2: m("I2", "I_2"),
    iEq: m("Ieq", "I_{eq}"),
    e: m("e", "e"),
    beff: m("beff", "b_{eff}"),
    be1: m("be1", "b_{e1}"),
    be2: m("be2", "b_{e2}"),
    bc: m("bc", "b_c"),
    c: m("c", "c"),
    bei: m("bei", "b_{ei}"),
    bmagg: m("bmagg", "b_{magg}"),
    hc: m("hc", "h_c"),
    x: m("x", "x"),
    d: m("d", "d"),
    epsCu: m("εcu", "\\varepsilon_{cu}"),
    epsA: m("εa", "\\varepsilon_a"),
    fy: m("fy", "f_y"),
    fydf: m("fydf", "f_{ydf}"),
    fydw: m("fydw", "f_{ydw}"),
    ia: m("Ia", "I_a"),
    ic: m("Ic", "I_c"),
    is: m("Is", "I_s"),
    ec: m("(E·I)C", "(E\\cdot I)_C"),
    E: m("E", "E"),
    r: m("r", "r"),
    mcPlRd: m("MC,pl,Rd", "M_{C,pl,Rd}"),
    mbPlRd: m("Mb,pl,Rd", "M_{b,pl,Rd}"),
    beffText: m("beff", "b_{eff}"),
};

const h = (page: number, from: number, normalized: string): TextSpec => ({
    kind: "heading",
    page,
    from,
    normalized,
});

const units: UnitSpec[] = [
    {
        number: "7.6",
        title: "COSTRUZIONI COMPOSTE DI ACCIAIO-CALCESTRUZZO",
        heading: h(251, 38, "7.6 COSTRUZIONI COMPOSTE DI ACCIAIO-CALCESTRUZZO"),
        blocks: [
            { kind: "paragraph", page: 251, from: 39, to: 40 },
            { kind: "list-item", page: 251, from: 41, normalized: "a) comportamento strutturale non dissipativo." },
            { kind: "list-item", page: 251, from: 42, to: 43, normalized: "b) comportamento strutturale dissipativo, con zone dissipative localizzate in componenti e membrature composte acciaio-calcestruzzo;" },
            { kind: "list-item", page: 251, from: 44, normalized: "c) comportamento strutturale dissipativo, con zone dissipative localizzate in componenti e membrature in acciaio;" },
            { kind: "paragraph", page: 251, from: 45, to: 46 },
            { kind: "paragraph", page: 251, from: 47, to: 51 },
            { kind: "paragraph", page: 251, from: 52, to: 53 },
            { kind: "paragraph", page: 251, from: 54, to: 55 },
            { kind: "paragraph", page: 251, from: 56, to: 57 },
        ],
    },
    {
        number: "7.6.1",
        title: "CARATTERISTICHE DEI MATERIALI",
        heading: h(252, 3, "7.6.1 CARATTERISTICHE DEI MATERIALI"),
    },
    {
        number: "7.6.1.1",
        title: "CALCESTRUZZO",
        heading: h(252, 4, "7.6.1.1 CALCESTRUZZO"),
        blocks: [
            { kind: "paragraph", page: 252, from: 5 },
            { kind: "paragraph", page: 252, from: 6, to: 7 },
        ],
    },
    {
        number: "7.6.1.2",
        title: "ACCIAIO PER C.A.",
        heading: h(252, 8, "7.6.1.2 ACCIAIO PER C.A."),
        blocks: [{ kind: "paragraph", page: 252, from: 9, to: 10 }],
    },
    {
        number: "7.6.1.3",
        title: "ACCIAIO STRUTTURALE",
        heading: h(252, 11, "7.6.1.3 ACCIAIO STRUTTURALE"),
        blocks: [{ kind: "paragraph", page: 252, from: 12 }],
    },
    {
        number: "7.6.2",
        title: "TIPOLOGIE STRUTTURALI E FATTORI DI COMPORTAMENTO",
        heading: h(252, 13, "7.6.2 TIPOLOGIE STRUTTURALI E FATTORI DI COMPORTAMENTO"),
    },
    {
        number: "7.6.2.1",
        title: "TIPOLOGIE STRUTTURALI",
        heading: h(252, 14, "7.6.2.1 TIPOLOGIE STRUTTURALI"),
        blocks: [
            { kind: "paragraph", page: 252, from: 15, to: 16 },
            { kind: "list-item", page: 252, from: 17, normalized: "a) strutture intelaiate;" },
            { kind: "list-item", page: 252, from: 18, normalized: "b) strutture con controventi concentrici realizzati in acciaio strutturale;" },
            { kind: "list-item", page: 252, from: 19, to: 20, normalized: "c) strutture con controventi eccentrici nelle quali gli elementi di connessione, dove si localizzano le zone dissipative, devono essere realizzati in acciaio strutturale;" },
            { kind: "list-item", page: 252, from: 21, normalized: "d) strutture a mensola o a pendolo inverso;" },
            { kind: "list-item", page: 252, from: 22, normalized: "e) strutture intelaiate controventate." },
            { kind: "paragraph", page: 252, from: 23, to: 25, normalized: "Per strutture con pareti o nuclei in c.a., nelle quali la resistenza all’azione sismica è affidata agli elementi strutturali di calcestruzzo armato, si rimanda al § 7.4. Le pareti possono essere accoppiate mediante travi in acciaio o composte acciaio-calcestruzzo." },
        ],
    },
    {
        number: "7.6.2.2",
        title: "FATTORI DI COMPORTAMENTO",
        heading: h(252, 26, "7.6.2.2 FATTORI DI COMPORTAMENTO"),
        blocks: [
            { kind: "paragraph", page: 252, from: 27, to: 29, math: [math.q0] },
        ],
    },
    {
        number: "7.6.3",
        title: "RIGIDEZZA DELLA SEZIONE TRASVERSALE COMPOSTA",
        heading: h(252, 30, "7.6.3 RIGIDEZZA DELLA SEZIONE TRASVERSALE COMPOSTA"),
        blocks: [
            { kind: "paragraph", page: 252, from: 31, to: 39, normalized: "La rigidezza elastica delle sezioni in cui il calcestruzzo è in compressione deve essere valutata utilizzando un coefficiente di omogeneizzazione n = Ea/Ecm = 7, essendo Ecm il modulo di elasticità secante del calcestruzzo. Inoltre il calcolo del momento d’inerzia non fessurato, I1, delle travi composte con calcestruzzo in compressione deve essere valutato includendo nel calcolo la porzione della soletta di calcestruzzo compresa nella larghezza efficace, determinata come al § 7.6.5.1.", math: [m("n = Ea/Ecm = 7", "n=E_a/E_{cm}=7"), math.ecm, math.i1] },
            { kind: "paragraph", page: 252, from: 40, to: 43, normalized: "Nei casi in cui il calcestruzzo è in trazione, la rigidezza della sezione composta dipende dal momento d’inerzia della sezione fessurata I2, calcolato assumendo il calcestruzzo non reagente e come attive le sole componenti metalliche della sezione, profilo strutturale ed armatura, collocate nella larghezza efficace.", math: [math.i2] },
        ],
    },
    {
        number: "7.6.4",
        title: "CRITERI DI PROGETTO E DETTAGLI PER STRUTTURE DISSIPATIVE",
        heading: h(252, 44, "7.6.4 CRITERI DI PROGETTO E DETTAGLI PER STRUTTURE DISSIPATIVE"),
    },
    {
        number: "7.6.4.1",
        title: "CRITERI DI PROGETTO PER STRUTTURE DISSIPATIVE",
        heading: h(252, 45, "7.6.4.1 CRITERI DI PROGETTO PER STRUTTURE DISSIPATIVE"),
        blocks: [
            { kind: "paragraph", page: 252, from: 46, to: 48 },
            { kind: "paragraph", page: 252, from: 49, to: 50 },
            { kind: "paragraph", page: 252, from: 51, to: 52 },
        ],
    },
    {
        number: "7.6.4.2",
        title: "VERIFICHE DI RESISTENZA (RES)",
        heading: h(252, 53, "7.6.4.2 VERIFICHE DI RESISTENZA (RES)"),
        blocks: [
            { kind: "paragraph", page: 252, from: 54, to: 55, normalized: "La progettazione sismica delle strutture composte acciaio-calcestruzzo è basata sulla valutazione del limite inferiore (Epl,Rd) e del limite superiore (EU,Rd) della capacità.", math: [math.ePlRd, math.eURd] },
            { kind: "paragraph", page: 253, from: 3, to: 10, normalized: "Il limite inferiore della capacità delle zone dissipative, Epl,Rd, deve essere confrontato con la domanda ottenuta dalla combinazione sismica delle azioni ESd, per cui deve risultare ESd < Epl,Rd. Il limite superiore della capacità delle zone dissipative (EU,Rd) deve essere utilizzato nella verifica della capacità delle altre componenti strutturali coinvolte nello sviluppo dei meccanismi di collasso prescelti. Tale valore deve essere assunto analogamente a quanto previsto nelle strutture in acciaio pari a EU,Rd = 1,1 γ_ov Epl,Rd, con γ_ov definito nel § 7.5.1.", math: [m("ESd < Epl,Rd", "E_{Sd}<E_{pl,Rd}"), m("EU,Rd = 1,1 γ_ov Epl,Rd", "E_{U,Rd}=1{,}1\\gamma_{ov}E_{pl,Rd}"), math.ePlRd, math.eSd, math.eURd, math.gammaOv] },
            { kind: "paragraph", page: 253, from: 11, normalized: "In particolare per il progetto dei collegamenti adiacenti le zone dissipative deve risultare:" },
            formula("7.6.1", 253, 12, 13, "R_{j,d}\\ge R_{U,Rd}"),
            { kind: "paragraph", page: 253, from: 14, to: 16, normalized: "dove Rj,d è la capacità del collegamento; RU,Rd è il limite superiore della capacità della membratura collegata, valutata come indicato nel presente paragrafo.", math: [math.rjD, math.ruRd] },
            { kind: "paragraph", page: 253, from: 17, to: 21, math: [m("40%", "40\\%")] },
            formula("7.6.2", 253, 22, 23, "V_{wp,Rd}=0{,}8\\left(V_{wp,s,Rd}+V_{wp,c,Rd}\\right)"),
            { kind: "paragraph", page: 253, from: 24, to: 28, normalized: "dove Vwp,s,Rd è la capacità del pannello d’anima in acciaio calcolato secondo i metodi indicati nel § 4.2, Vwp,c,Rd è la capacità a taglio fornita dal calcestruzzo che deve essere determinata utilizzando appropriati modelli tirante-puntone tipici delle strutture in calcestruzzo. La domanda a taglio, Vwp,Sd, con cui confrontare la capacità Vwp,Rd, è calcolata considerando il raggiungimento della capacità a flessione nelle sezioni delle travi convergenti nel nodo trave-colonna secondo lo schema e le modalità previste in fase di progetto.", math: [math.vwpSRd, math.vwpCRd, math.vwpSd, math.vwpRd] },
        ],
    },
    {
        number: "7.6.4.3",
        title: "VERIFICHE DI DUTTILITÀ (DUT)",
        heading: h(253, 29, "7.6.4.3 VERIFICHE DI DUTTILITÀ (DUT)"),
        extraIssues: [{
            issueId: "ntc2018-7-6-4-3-source-anomaly-q",
            type: "other",
            severity: "warning",
            note: "Il PDF ufficiale usa esplicitamente q, q_u e q_y come misure di deformazione locale, mentre l’analogo § 7.5.3.2 usa θ, θ_u e θ_y; la notazione ufficiale è conservata senza correzione editoriale.",
        }],
        blocks: [
            { kind: "paragraph", page: 253, from: 30, to: 32 },
            { kind: "paragraph", page: 253, from: 33, math: [math.q] },
            { kind: "list-item", page: 253, from: 34, normalized: "elementi inflessi o presso inflessi di strutture intelaiate: rotazione alla corda;" },
            { kind: "list-item", page: 253, from: 35, normalized: "elementi prevalentemente tesi e compressi di strutture controventate: allungamento complessivo del diagonale;" },
            { kind: "list-item", page: 253, from: 36, to: 37, normalized: "elementi sottoposti a taglio e flessione di strutture con controventi eccentrici (elementi di collegamento): rotazione rigida tra l’elemento di connessione e l’elemento contiguo." },
            { kind: "paragraph", page: 253, from: 38, normalized: "La duttilità locale è definita come segue: μ = q_u/q_y.", math: [m("μ = q_u/q_y", "\\mu=q_u/q_y")] },
            { kind: "paragraph", page: 253, from: 39, to: 41, normalized: "La domanda di prestazione in duttilità locale è definita dal rapporto tra il valore di deformazione q_u misurato mediante analisi non lineare e il valore di deformazione q_y al limite elastico. Nel caso di analisi strutturale lineare con fattore di comportamento, la domanda di deformazione può essere dedotta dal campo di spostamenti ultimi ottenuti come in § 7.3.3.3.", math: [math.qu, math.qy] },
            { kind: "paragraph", page: 253, from: 42, to: 46, normalized: "La capacità in duttilità locale è data dal rapporto tra la misura di deformazione al collasso q_u valutato in corrispondenza della riduzione del 15% della massima resistenza dell’elemento, e la deformazione q_y corrispondente al raggiungimento della prima plasticizzazione, La capacità in duttilità, quando non sia determinata mediante sperimentazione diretta, deve essere valutata utilizzando metodi di calcolo che descrivano in modo adeguato il comportamento in campo non-lineare, inclusi i fenomeni di instabilità dell’equilibrio, e tengano conto dei fenomeni di degrado connessi al comportamento ciclico.", math: [math.qu, math.qy, m("15%", "15\\%")] },
            { kind: "paragraph", page: 253, from: 47, to: 50 },
            formula("7.6.3", 253, 51, 51, "N_{Ed}/N_{pl,Rd}\\le0{,}3"),
            { kind: "paragraph", page: 253, from: 52, to: 54, normalized: "dove NEd è il valore della domanda a sforzo normale e Npl,Rd è il valore della capacità a sforzo normale determinata secondo criteri di cui al § 4.2.4.1.2.", math: [math.nEd, math.nPlRd] },
            { kind: "paragraph", page: 253, from: 55 },
            { kind: "list-item", page: 253, from: 56, normalized: "per le zone dissipative in solo acciaio (non rivestite in calcestruzzo) valgono le indicazioni di cui al precedente § 7.5.6;" },
            { kind: "list-item", page: 253, from: 57, to: 58, normalized: "per le zone dissipative rivestite in calcestruzzo i valori dei rapporti larghezza-spessore per le facce dei profilati metallici impiegati devono rispettare le limitazioni di cui alla Tab. 7.6.I." },
            table("7.6.i", 254, 3, 18),
        ],
    },
    {
        number: "7.6.4.4",
        title: "DETTAGLI COSTRUTTIVI",
        heading: h(254, 19, "7.6.4.4 DETTAGLI COSTRUTTIVI"),
        blocks: [
            { kind: "paragraph", page: 254, from: 20, to: 21 },
            { kind: "paragraph", page: 254, from: 22, to: 24 },
        ],
    },
    {
        number: "7.6.5",
        title: "REGOLE SPECIFICHE PER LE MEMBRATURE",
        heading: h(254, 25, "7.6.5 REGOLE SPECIFICHE PER LE MEMBRATURE"),
        blocks: [
            { kind: "paragraph", page: 254, from: 26, to: 28, math: [m("250 mm", "250\\,\\mathrm{mm}")] },
            figure("7.6.1", 254, 29, 29, { coordinateSystem: "pdf-points-top-left", x: 230, y: 370, width: 180, height: 150 }),
            { kind: "paragraph", page: 254, from: 30, to: 38 },
        ],
    },
    {
        number: "7.6.5.1",
        title: "TRAVI CON SOLETTA COLLABORANTE",
        heading: h(254, 39, "7.6.5.1 TRAVI CON SOLETTA COLLABORANTE"),
        blocks: [
            { kind: "heading", page: 254, from: 40, normalized: "Verifiche di resistenza (RES)" },
            { kind: "paragraph", page: 254, from: 41, to: 45, normalized: "Nelle travi con soletta collaborante il grado di connessione N/N_f, definito al § 4.3.4.3., deve risultare non inferiore a 0,8 e la complessiva capacità a taglio dei connettori nella zona in cui il calcestruzzo della soletta è teso non deve essere inferiore alla capacità delle armature longitudinali. La capacità dei connettori a piolo si ottiene, a partire da quella indicata al § 4.3.4.3.1, applicando un fattore di riduzione pari a 0,75.", math: [m("N/N_f", "N/N_f"), m("0,8", "0{,}8"), m("0,75", "0{,}75")] },
            { kind: "paragraph", page: 255, from: 3, to: 7, normalized: "La determinazione delle caratteristiche geometriche della sezione composta va effettuata considerando un’appropriata larghezza collaborante della soletta e delle relative armature longitudinali. La larghezza collaborante beff si determina con le modalità indicate nel § 4.3.2.3 e si ottiene come somma delle due aliquote be1 e be2 ai due lati dell’asse della trave e della larghezza bc impegnata direttamente dai connettori.", math: [math.beff, math.be1, math.be2, math.bc] },
            formula("7.6.4", 255, 8, 9, "b_{eff}=b_{e1}+b_{e2}+b_c"),
            { kind: "paragraph", page: 255, from: 10, to: 12, math: [math.be1, math.be2] },
            { kind: "paragraph", page: 255, from: 13, to: 15, math: [math.bei] },
            { kind: "paragraph", page: 255, from: 16, to: 19, normalized: "I termini utilizzati sono definiti nella Fig. 7.6.2. Nella Tab. 7.6.IV con bmagg è individuata la larghezza di eventuali piastre addizionali saldate alle piattabande delle colonne con lo scopo di aumentare la capacità portante del calcestruzzo in prossimità dell’area nodale; qualora queste non siano installate, tale parametro coincide con la larghezza bc della colonna.", math: [math.bmagg, math.bc] },
            { kind: "heading", page: 255, from: 20, normalized: "Verifiche di duttilità (DUT)" },
            { kind: "paragraph", page: 255, from: 21, to: 22, math: [m("x/d", "x/d")] },
            formula("7.6.5", 255, 23, 23, "x/d<\\varepsilon_{cu}/\\left(\\varepsilon_{cu}+\\varepsilon_a\\right)"),
            { kind: "paragraph", page: 255, from: 24, to: 29, normalized: "nella quale: x è la profondità dell’asse neutro a rottura; d è l’altezza totale della sezione composta; εcu è la deformazione a rottura del calcestruzzo, valutata tenendo conto degli effetti di degrado ciclico del materiale; εa è la deformazione totale al lembo teso del profilo metallico. Il suddetto requisito di duttilità può ritenersi soddisfatto quando il rapporto x/d soddisfa i limiti riportati in Tab. 7.6.II.", math: [m("x/d", "x/d"), math.x, math.d, math.epsCu, math.epsA] },
            table("7.6.ii", 255, 30, 39),
        ],
    },
    {
        number: "7.6.5.2",
        title: "MEMBRATURE COMPOSTE PARZIALMENTE RIVESTITE DI CALCESTRUZZO",
        heading: h(255, 40, "7.6.5.2 MEMBRATURE COMPOSTE PARZIALMENTE RIVESTITE DI CALCESTRUZZO"),
        blocks: [
            { kind: "heading", page: 255, from: 41, normalized: "Criteri di dettaglio" },
            { kind: "paragraph", page: 255, from: 42, to: 46, normalized: "L’adozione dei dettagli d’armatura trasversale riportati in Fig. 7.6.1 può ritardare l’innesco dei fenomeni di instabilità locale nelle zone dissipative. In particolare i limiti riportati in Tab. 7.6.I per le piattabande possono essere incrementati se tali barre sono caratterizzate da un interasse longitudinale, s_l, minore della lunghezza netta, c, della piattabanda, s_l/c < 1,0:", math: [m("s_l/c < 1,0", "s_l/c<1{,}0"), m("s_l", "s_l"), math.c] },
            { kind: "list-item", page: 255, from: 47, to: 48, normalized: "per s_l/c ≤ 0,5, i limiti di Tab. 7.6.I possono essere moltiplicati per un coefficiente 1,50;", math: [m("s_l/c ≤ 0,5", "s_l/c\\le0{,}5"), m("1,50", "1{,}50")] },
            { kind: "list-item", page: 255, from: 49, to: 51, normalized: "per 0,5 < s_l/c < 1,0 si può interpolare linearmente tra i coefficienti 1,50 e 1,00.", math: [m("0,5 < s_l/c < 1,0", "0{,}5<s_l/c<1{,}0"), m("1,50", "1{,}50"), m("1,00", "1{,}00")] },
            { kind: "paragraph", page: 255, from: 52, math: [m("20 mm", "20\\,\\mathrm{mm}"), m("40 mm", "40\\,\\mathrm{mm}")] },
            { kind: "paragraph", page: 255, from: 53 },
            table("7.6.iii", 255, 54, 71),
            table("7.6.iv", 256, 3, 45),
            figure("7.6.2", 256, 46, 51, { coordinateSystem: "pdf-points-top-left", x: 80, y: 437, width: 380, height: 108 }),
        ],
    },
    {
        number: "7.6.5.3",
        title: "COLONNE COMPOSTE COMPLETAMENTE RIVESTITE DI CALCESTRUZZO",
        heading: h(256, 52, "7.6.5.3 COLONNE COMPOSTE COMPLETAMENTE RIVESTITE DI CALCESTRUZZO"),
        blocks: [
            { kind: "heading", page: 256, from: 53, normalized: "Criteri di dettaglio" },
            { kind: "paragraph", page: 256, from: 54, to: 58, math: [m("250 mm", "250\\,\\mathrm{mm}")] },
            { kind: "paragraph", page: 256, from: 59, to: 61, math: [m("s", "s"), math.c ?? m("c", "c")] },
            { kind: "paragraph", page: 256, from: 62, to: 67, math: [m("175 mm", "175\\,\\mathrm{mm}"), m("8 volte", "8\\,\\text{volte}"), m("150 mm", "150\\,\\mathrm{mm}"), m("6 volte", "6\\,\\text{volte}")] },
            { kind: "paragraph", page: 257, from: 3, to: 10, normalized: "Il diametro minimo delle armature trasversali non deve essere inferiore a 6 mm e comunque pari al maggiore dei seguenti valori: 6 mm e 0,35 volte il diametro massimo delle armature longitudinali moltiplicato per (fydf/fydw)^{0,5}, essendo fydf e fydw le tensioni di progetto della piattabanda e dell’armatura.", math: [m("(fydf/fydw)^{0,5}", "(f_{ydf}/f_{ydw})^{0{,}5}"), math.fydf, math.fydw, m("6 mm", "6\\,\\mathrm{mm}"), m("0,35", "0{,}35")] },
        ],
    },
    {
        number: "7.6.5.4",
        title: "COLONNE COMPOSTE RIEMPITE DI CALCESTRUZZO",
        heading: h(257, 11, "7.6.5.4 COLONNE COMPOSTE RIEMPITE DI CALCESTRUZZO"),
        blocks: [
            { kind: "heading", page: 257, from: 12, normalized: "Verifiche di resistenza (RES)" },
            { kind: "paragraph", page: 257, from: 13, to: 14 },
        ],
    },
    {
        number: "7.6.6",
        title: "REGOLE SPECIFICHE PER STRUTTURE INTELAIATE",
        heading: h(257, 15, "7.6.6 REGOLE SPECIFICHE PER STRUTTURE INTELAIATE"),
    },
    {
        number: "7.6.6.1",
        title: "ANALISI STRUTTURALE",
        heading: h(257, 16, "7.6.6.1 ANALISI STRUTTURALE"),
        blocks: [
            { kind: "paragraph", page: 257, from: 17, to: 19, normalized: "Nelle travi composte è possibile assumere un momento d’inerzia equivalente costante lungo l’intera trave, Ieq, dato dalla relazione:", math: [math.iEq] },
            formula("7.6.6", 257, 20, 21, "I_{eq}=0{,}6\\cdot I_1+0{,}4\\cdot I_2"),
            { kind: "paragraph", page: 257, from: 22 },
            formula("7.6.7", 257, 23, 25, "\\left(E\\cdot I\\right)_C=0{,}9\\cdot\\left(E\\cdot I_a+r\\cdot E_{cm}\\cdot I_c+E\\cdot I_s\\right)"),
            { kind: "paragraph", page: 257, from: 26, to: 30, normalized: "nella quale E e Ecm sono i moduli di elasticità dell’acciaio e del calcestruzzo; Ia, Ic e Is sono i momenti di inerzia della sezione in acciaio, del calcestruzzo e delle armature, rispettivamente. Il coefficiente di riduzione r dipende dal tipo di sezione trasversale; in assenza di più accurate determinazioni, può essere assunto pari a 0.5.", math: [math.E, math.ecm, math.ia, math.ic, math.is, math.r, m("0.5", "0.5")] },
        ],
    },
    {
        number: "7.6.6.2",
        title: "TRAVI E COLONNE",
        heading: h(257, 31, "7.6.6.2 TRAVI E COLONNE"),
        blocks: [
            { kind: "paragraph", page: 257, from: 32 },
            { kind: "heading", page: 257, from: 33, normalized: "Verifiche di resistenza (RES)" },
            { kind: "paragraph", page: 257, from: 34 },
            { kind: "paragraph", page: 257, from: 35, to: 37 },
            { kind: "paragraph", page: 257, from: 38, to: 39 },
            formula("7.6.8", 257, 40, 41, "\\sum M_{C,pl,Rd}\\ge\\gamma_{Rd}\\cdot\\sum M_{b,pl,Rd}"),
            { kind: "paragraph", page: 257, from: 42, to: 44, normalized: "dove γRd è dato in Tab. 7.2.I, MC,pl,Rd è la capacità a flessione della colonna calcolato per i livelli di domanda a sforzo normale valutata nelle combinazioni sismiche delle azioni e Mb,pl,Rd è la capacità delle travi che convergono nel nodo trave-colonna.", math: [math.gammaRd, math.mcPlRd, math.mbPlRd] },
        ],
    },
    {
        number: "7.6.6.3",
        title: "COLLEGAMENTI TRAVE-COLONNA",
        heading: h(257, 45, "7.6.6.3 COLLEGAMENTI TRAVE-COLONNA"),
        blocks: [{ kind: "paragraph", page: 257, from: 46 }],
    },
    {
        number: "7.6.6.4",
        title: "COLLEGAMENTI COLONNA-FONDAZIONE",
        heading: h(257, 47, "7.6.6.4 COLLEGAMENTI COLONNA-FONDAZIONE"),
        blocks: [{ kind: "paragraph", page: 257, from: 48 }],
    },
    {
        number: "7.6.6.5",
        title: "CONDIZIONE PER TRASCURARE IL CARATTERE COMPOSTO DELLE TRAVI CON SOLETTA",
        heading: h(257, 49, "7.6.6.5 CONDIZIONE PER TRASCURARE IL CARATTERE COMPOSTO DELLE TRAVI CON SOLETTA"),
        blocks: [
            { kind: "paragraph", page: 257, from: 50, to: 53, math: [m("2 beff", "2b_{eff}"), math.beff] },
            { kind: "paragraph", page: 257, from: 54, to: 56 },
            { kind: "paragraph", page: 257, from: 57, to: 58 },
        ],
    },
    {
        number: "7.6.7",
        title: "REGOLE SPECIFICHE PER STRUTTURE CON CONTROVENTI CONCENTRICI",
        heading: h(258, 3, "7.6.7 REGOLE SPECIFICHE PER STRUTTURE CON CONTROVENTI CONCENTRICI"),
        blocks: [{ kind: "paragraph", page: 258, from: 4 }],
    },
    {
        number: "7.6.8",
        title: "REGOLE SPECIFICHE PER STRUTTURE CON CONTROVENTI ECCENTRICI",
        heading: h(258, 5, "7.6.8 REGOLE SPECIFICHE PER STRUTTURE CON CONTROVENTI ECCENTRICI"),
        blocks: [
            { kind: "paragraph", page: 258, from: 6, to: 7 },
            { kind: "paragraph", page: 258, from: 8 },
        ],
    },
];

const formulaLatex: Record<string, { unit: string; number: string | null; page: number; latex: string }> = {
    "7.6.1": { unit: "7.6.4.2", number: "7.6.1", page: 253, latex: "R_{j,d}\\ge R_{U,Rd}" },
    "7.6.2": { unit: "7.6.4.2", number: "7.6.2", page: 253, latex: "V_{wp,Rd}=0{,}8\\left(V_{wp,s,Rd}+V_{wp,c,Rd}\\right)" },
    "7.6.3": { unit: "7.6.4.3", number: "7.6.3", page: 253, latex: "N_{Ed}/N_{pl,Rd}\\le0{,}3" },
    "7.6.4": { unit: "7.6.5.1", number: "7.6.4", page: 255, latex: "b_{eff}=b_{e1}+b_{e2}+b_c" },
    "7.6.5": { unit: "7.6.5.1", number: "7.6.5", page: 255, latex: "x/d<\\varepsilon_{cu}/\\left(\\varepsilon_{cu}+\\varepsilon_a\\right)" },
    "7.6.6": { unit: "7.6.6.1", number: "7.6.6", page: 257, latex: "I_{eq}=0{,}6\\cdot I_1+0{,}4\\cdot I_2" },
    "7.6.7": { unit: "7.6.6.1", number: "7.6.7", page: 257, latex: "\\left(E\\cdot I\\right)_C=0{,}9\\cdot\\left(E\\cdot I_a+r\\cdot E_{cm}\\cdot I_c+E\\cdot I_s\\right)" },
    "7.6.8": { unit: "7.6.6.2", number: "7.6.8", page: 257, latex: "\\sum M_{C,pl,Rd}\\ge\\gamma_{Rd}\\cdot\\sum M_{b,pl,Rd}" },
};

const cell = (text: string, latex?: string, rowSpan?: number, colSpan?: number): any => ({
    text,
    ...(latex ? { latex } : {}),
    ...(rowSpan ? { rowSpan } : {}),
    ...(colSpan ? { colSpan } : {}),
});

const tables = [
    {
        id: tableI,
        unitId: idFor("7.6.4.3"),
        officialNumber: "7.6.I",
        pdfPage: 254,
        caption: "Valori limite della snellezza per i profilati metallici",
        columnCount: 3,
        headers: [[
            cell("Valore di base q_0 del fattore di comportamento", "\\text{Valore di base }q_0\\text{ del fattore di comportamento}"),
            cell("1,5 ÷ 2 ≤ q_0 ≤ 4", "1{,}5\\div2\\le q_0\\le4"),
            cell("q_0 > 4", "q_0>4"),
        ]],
        rows: [
            [
                cell("Sezione ad H o I parzialmente o totalmente rivestita in calcestruzzo: limiti per le sporgenze delle ali c/t_f", "\\text{Sezione ad H o I parzialmente o totalmente rivestita in calcestruzzo: limiti per le sporgenze delle ali }c/t_f"),
                cell("14 ε", "14\\varepsilon"),
                cell("9 ε", "9\\varepsilon"),
            ],
            [
                cell("Sezione rettangolare cava riempita di calcestruzzo: h/t limite", "\\text{Sezione rettangolare cava riempita di calcestruzzo: }h/t\\text{ limite}"),
                cell("38 ε", "38\\varepsilon"),
                cell("24 ε", "24\\varepsilon"),
            ],
            [
                cell("Sezione circolare cava riempita di calcestruzzo: d/t limite", "\\text{Sezione circolare cava riempita di calcestruzzo: }d/t\\text{ limite}"),
                cell("85 ε²", "85\\varepsilon^2"),
                cell("80 ε²", "80\\varepsilon^2"),
            ],
        ],
        notes: [
            "Essendo:",
            "ε = (235/f_yk)^0,5",
            "c/t_f: il rapporto tra la larghezza e lo spessore della parte in aggetto dell’ala definita nella Fig. 7.6.1",
            "d/t ed h/t: i rapporti tra massima dimensione esterna e spessore.",
            "Tabella strutturata dal render ufficiale; revisione umana cella per cella ancora obbligatoria.",
        ],
    },
    {
        id: tableII,
        unitId: idFor("7.6.5.1"),
        officialNumber: "7.6.II",
        pdfPage: 255,
        caption: "Valori limite del rapporto x/d per le travi composte, al variare del fattore q_0",
        columnCount: 3,
        headers: [[
            cell("f_y (N/mm²)", "f_y\\ (\\mathrm{N/mm^2})"),
            cell("1,5 < q_0 ≤ 4 (x/d)limite", "1{,}5<q_0\\le4\\quad(x/d)_{\\mathrm{limite}}"),
            cell("q_0 > 4 (x/d)limite", "q_0>4\\quad(x/d)_{\\mathrm{limite}}"),
        ]],
        rows: [
            [cell("235"), cell("0,36"), cell("0,27")],
            [cell("275"), cell("0,32"), cell("0,24")],
            [cell("355"), cell("0,27"), cell("0,20")],
        ],
        notes: ["Tabella strutturata dal render ufficiale; revisione umana cella per cella ancora obbligatoria."],
    },
    {
        id: tableIII,
        unitId: idFor("7.6.5.2"),
        officialNumber: "7.6.III",
        pdfPage: 255,
        caption: "Definizione della larghezza efficace parziale per il calcolo della rigidezza flessionale",
        columnCount: 3,
        headers: [[
            cell(""),
            cell("Membratura trasversale"),
            cell("Larghezza efficace parziale b_ei", "\\text{Larghezza efficace parziale }b_{ei}"),
        ]],
        rows: [
            [
                cell("Nodo/Colonna interni"),
                cell("Presente o non presente"),
                cell("Per M^-: 0,05 L; Per M^+: 0,0375 L", "\\text{Per }M^-:0{,}05L;\\quad\\text{Per }M^+:0{,}0375L", 2),
            ],
            [cell("Nodo/Colonna esterni"), cell("Presente")],
            [
                cell("Nodo/Colonna esterni"),
                cell("Non presente/Armatura non ancorata"),
                cell("Per M^-: 0; Per M^+: 0,025 L", "\\text{Per }M^-:0;\\quad\\text{Per }M^+:0{,}025L"),
            ],
        ],
        notes: ["Tabella strutturata dal render ufficiale; revisione umana cella per cella ancora obbligatoria."],
    },
    {
        id: tableIV,
        unitId: idFor("7.6.5.2"),
        officialNumber: "7.6.IV",
        pdfPage: 256,
        caption: "Definizione della larghezza efficace parziale per il calcolo del momento plastico",
        columnCount: 4,
        headers: [[
            cell("Segno del momento flettente"),
            cell("Posizione"),
            cell("Membratura trasversale"),
            cell("Larghezza efficace parziale b_ei", "\\text{Larghezza efficace parziale }b_{ei}"),
        ]],
        rows: [
            [cell("Negativo, M^-", "\\text{Negativo, }M^-"), cell("Colonna interna"), cell("Armatura sismica incrociata"), cell("0,10 L", "0{,}10L")],
            [cell("Negativo, M^-", "\\text{Negativo, }M^-"), cell("Colonna esterna"), cell("Armature ancorate alle travi di facciata o al cordolo di estremità"), cell("0,10 L", "0{,}10L")],
            [cell("Negativo, M^-", "\\text{Negativo, }M^-"), cell("Colonna esterna"), cell("Armature non ancorate alle travi di facciata o al cordolo di estremità"), cell("0", "0")],
            [cell("Positivo, M^+", "\\text{Positivo, }M^+"), cell("Colonna interna"), cell("Armatura sismica incrociata"), cell("0,075 L", "0{,}075L")],
            [cell("Positivo, M^+", "\\text{Positivo, }M^+"), cell("Colonna esterna"), cell("Trave in acciaio trasversale dotata di connettori; Soletta disposta in modo da raggiungere o superare il filo esterno della colonna disposta in asse forte"), cell("0,075 L", "0{,}075L")],
            [cell("Positivo, M^+", "\\text{Positivo, }M^+"), cell("Colonna esterna"), cell("Trave trasversale assente o priva di connettori; Soletta disposta in modo da raggiungere o superare il filo esterno della colonna disposta in asse forte"), cell("bmagg/2 + 0,7 hc/2", "b_{magg}/2+0{,}7h_c/2")],
            [cell("Positivo, M^+", "\\text{Positivo, }M^+"), cell("Colonna esterna"), cell("Disposizioni differenti"), cell("bmagg/2 ≤ 0,05 L", "b_{magg}/2\\le0{,}05L")],
        ],
        notes: ["Tabella strutturata dal render ufficiale; revisione umana cella per cella ancora obbligatoria."],
    },
];

const figuresDirectory = join(repoRoot, "corpus", "assets", "figures", "ntc2018");
const figureSha = async (filename: string): Promise<string> => sha256Bytes(await readFile(join(figuresDirectory, filename)));
const figures = [
    {
        id: figure61,
        unitId: idFor("7.6.5"),
        officialNumber: "7.6.1",
        pdfPage: 254,
        caption: "Fig. 7.6.1 - Rapporti dimensionali",
        alt: "Fig. 7.6.1 con i rapporti dimensionali b = bc, h = hc, c, tw e tf della sezione composta.",
        imagePath: "figures/ntc2018/fig7.6.1.png",
        region: { coordinateSystem: "pdf-points-top-left", x: 230, y: 370, width: 180, height: 150 },
        sha256: await figureSha("fig7.6.1.png"),
    },
    {
        id: figure62,
        unitId: idFor("7.6.5.2"),
        officialNumber: "7.6.2",
        pdfPage: 256,
        caption: "Fig. 7.6.2 - Definizione degli elementi in una struttura intelaiata",
        alt: "Fig. 7.6.2 con la definizione degli elementi A, B, C, D ed E in una struttura intelaiata.",
        imagePath: "figures/ntc2018/fig7.6.2.png",
        region: { coordinateSystem: "pdf-points-top-left", x: 80, y: 437, width: 380, height: 108 },
        sha256: await figureSha("fig7.6.2.png"),
    },
];

const outputDirectory = join(repoRoot, "corpus", "units", "ntc2018");
await mkdir(outputDirectory, { recursive: true });

for (const spec of units) {
    const unitId = idFor(spec.number);
    const blocks: any[] = [textBlock(unitId, "block-heading", spec.heading)];
    let counter = 1;
    for (const blockSpec of spec.blocks ?? []) {
        const blockId = `block-editorial-${String(counter).padStart(3, "0")}`;
        blocks.push("assetId" in blockSpec ? assetBlock(unitId, blockId, blockSpec) : textBlock(unitId, blockId, blockSpec));
        counter += 1;
    }
    const formulaIds = blocks.filter(({ kind }) => kind === "formula-ref").map(({ assetId }) => assetId);
    const tableIds = blocks.filter(({ kind }) => kind === "table-ref").map(({ assetId }) => assetId);
    const figureIds = blocks.filter(({ kind }) => kind === "figure-ref").map(({ assetId }) => assetId);
    const parentParts = spec.number.split(".");
    parentParts.pop();
    const issues = [
        {
            issueId: `ntc2018-${spec.number.replaceAll(".", "-")}-source-review`,
            type: "normalization-review",
            severity: "blocking",
            note: "Trascrizione confrontata con il render ufficiale nello step; resta obbligatoria la revisione umana indipendente.",
        },
        ...((formulaIds.length || tableIds.length || figureIds.length)
            ? [{ issueId: `ntc2018-${spec.number.replaceAll(".", "-")}-assets`, type: "asset-review", severity: "blocking", note: "Formule, tabelle e ritagli di figura sono stati separati e collocati nel flusso originario; resta obbligatoria la verifica umana puntuale." }]
            : []),
        ...(spec.extraIssues ?? []),
    ];
    const record = {
        $schema: "urn:structural-codes:schema:canonical-unit:v2",
        schemaVersion: "2.0.0-alpha.2",
        recordType: "canonical-unit",
        id: unitId,
        workId: "it-mit:dm:2018-01-17:ntc2018",
        expressionId: "it-mit:dm:2018-01-17:ntc2018:original-it",
        kind: unitKind(spec.number),
        numbering: { official: spec.number, sortKey: sortKey(spec.number) },
        title: spec.title,
        titleBlockId: `${unitId}#block-heading`,
        hierarchy: {
            parentId: idFor(parentParts.join(".")),
            ancestorIds: ancestors(spec.number),
            position: position(spec.number),
        },
        validity: { from: "2018-03-22", to: null, status: "in-force", asOf: "2026-08-09" },
        blocks,
        citations: [],
        relations: [],
        assets: { formulaIds, tableIds, figureIds },
        workflow: {
            status: "extracted",
            createdBy: actor,
            createdAt,
            reviews: [],
            openIssues: issues,
        },
    };
    await writeFile(join(outputDirectory, `${spec.number}.json`), `${JSON.stringify(record, null, 2)}\n`, "utf8");
}

const manifest = {
    $schema: "urn:structural-codes:schema:asset-manifest:v2",
    schemaVersion: "2.0.0-alpha.1",
    recordType: "asset-manifest",
    document: "ntc2018",
    section: "7.6-step1",
    sourceId,
    status: "transcribed-unreviewed",
    formulas: Object.entries(formulaLatex).map(([suffix, value]) => ({
        id: assetId("formula", suffix),
        unitId: idFor(value.unit),
        officialNumber: value.number,
        pdfPage: value.page,
        latex: value.latex,
    })),
    tables,
    figures,
};
await mkdir(join(repoRoot, "corpus", "assets", "ntc2018"), { recursive: true });
await writeFile(join(repoRoot, "corpus", "assets", "ntc2018", "7.6-step1.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(`ntc76-step1: generate ${units.length} unità, ${Object.keys(formulaLatex).length} formule, ${tables.length} tabelle e ${figures.length} figure`);
