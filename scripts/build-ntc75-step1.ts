/* eslint-disable @typescript-eslint/no-explicit-any */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../", import.meta.url));
const sourceId = "gu-so8-2018-ntc";
const profile = "ntc75-editorial-profile-0.1.0";
const actor = {
    actorId: "generator:ntc75:step1",
    kind: "script",
    toolVersion: profile,
};
const createdAt = "2026-08-09T00:00:00Z";

const pageLines = new Map<number, string[]>();
for (let page = 243; page <= 251; page += 1) {
    const filename = join(
        repoRoot,
        "evidence",
        sourceId,
        "pages",
        `page-${String(page).padStart(4, "0")}.raw.txt`,
    );
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

function sha256(value: string): string {
    return createHash("sha256").update(value, "utf8").digest("hex");
}

function clean(source: string): string {
    return source
        .replace(/\n/gu, " ")
        .replace(/\s+/gu, " ")
        .replace(/^77\.5/gu, "7.5")
        .replace(/\bF ATTORI\b/gu, "FATTORI")
        .replace(/\bV ERIFICHE\b/gu, "VERIFICHE")
        .replace(/\bP ANNELLI\b/gu, "PANNELLI")
        .replace(/Jov|·ov|Î‡ov/gu, "γ_ov")
        .replace(/Ç‚/gu, "≤")
        .replace(/Çƒ/gu, "≥")
        .replace(/ÎŒp/gu, "θ_p")
        .replace(/Î…/gu, "α")
        .replace(/q\s+0/gu, "q_0")
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
    if (/[\u0000-\u001f\u007f-\u009fİȞȝȦ·Ç‚ÇƒÎŒÎ‡]/u.test(source)) {
        operations.push({
            operation: "manual-correction",
            ruleVersion: profile,
            note: "Ripristinati manualmente glifi, simboli matematici, indici e spaziatura verificati sul render ufficiale.",
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
    while (cursor < text.length) {
        let match: { index: number; term: MathTerm } | undefined;
        for (const term of unique) {
            const index = text.indexOf(term.value, cursor);
            if (
                index >= 0 &&
                (match === undefined ||
                    index < match.index ||
                    (index === match.index && term.value.length > match.term.value.length))
            ) {
                match = { index, term };
            }
        }
        if (!match) {
            segments.push({ kind: "text", value: text.slice(cursor) });
            break;
        }
        if (match.index > cursor) {
            segments.push({ kind: "text", value: text.slice(cursor, match.index) });
        }
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

const idFor = (number: string): string =>
    `urn:structural-codes:it:unit:ntc2018:${number}`;
const assetId = (kind: "formula" | "table" | "figure", suffix: string): string =>
    `urn:structural-codes:it:asset:${kind}:ntc2018:${suffix}`;
const sortKey = (number: string): string =>
    number.split(".").map((part) => part.padStart(3, "0")).join(".");
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

const formula = (number: string, unit: string, page: number, from: number, to: number, latex: string): AssetSpec => {
    void unit;
    void latex;
    return {
        kind: "formula-ref",
        page,
        from,
        to,
        assetId: assetId("formula", number),
    };
};
const tableId = assetId("table", "7.5.i");
const figureTopId = assetId("figure", "7.5.1:upper");
const figureBottomId = assetId("figure", "7.5.1:lower");

const math = {
    gammaOv: m("γ_ov", "\\gamma_{ov}"),
    q0: m("q_0", "q_0"),
    alphaRatio: m("α_u/α_1", "\\alpha_u/\\alpha_1"),
    theta: m("θ", "\\theta"),
    thetaU: m("θ_u", "\\theta_u"),
    thetaY: m("θ_y", "\\theta_y"),
    mu: m("μ", "\\mu"),
    nEd: m("N_{Ed}", "N_{Ed}"),
    nPlRd: m("N_{pl,Rd}", "N_{pl,Rd}"),
    mEd: m("M_{Ed}", "M_{Ed}"),
    mPlRd: m("M_{pl,Rd}", "M_{pl,Rd}"),
    vEd: m("V_{Ed}", "V_{Ed}"),
    vPlRd: m("V_{pl,Rd}", "V_{pl,Rd}"),
    nEdG: m("N_{Ed,G}", "N_{Ed,G}"),
    mEdG: m("M_{Ed,G}", "M_{Ed,G}"),
    vEdG: m("V_{Ed,G}", "V_{Ed,G}"),
    nEdE: m("N_{Ed,E}", "N_{Ed,E}"),
    mEdE: m("M_{Ed,E}", "M_{Ed,E}"),
    vEdE: m("V_{Ed,E}", "V_{Ed,E}"),
    omega: m("Ω", "\\Omega"),
    omegaI: m("Ω_i", "\\Omega_i"),
    lambda: m("λ", "\\lambda"),
    lambdaRatio: m("d/t", "d/t"),
    r: m("R", "R"),
    mLRd: m("M_{l,Rd}", "M_{l,Rd}"),
    vLRd: m("V_{l,Rd}", "V_{l,Rd}"),
    mLRdI: m("M_{l,Rd,i}", "M_{l,Rd,i}"),
    vLRdI: m("V_{l,Rd,i}", "V_{l,Rd,i}"),
    nPlRdI: m("N_{pl,Rd,i}", "N_{pl,Rd,i}"),
    nEdI: m("N_{Ed,i}", "N_{Ed,i}"),
    thetaP: m("θ_p", "\\theta_p"),
    tW: m("t_w", "t_w"),
};

const units: UnitSpec[] = [
    {
        number: "7.5",
        title: "COSTRUZIONI DI ACCIAIO",
        heading: { kind: "heading", page: 243, from: 40, normalized: "7.5 COSTRUZIONI DI ACCIAIO" },
        blocks: [
            { kind: "paragraph", page: 243, from: 41, to: 42 },
            { kind: "paragraph", page: 243, from: 43, to: 46 },
            {
                kind: "paragraph", page: 243, from: 47, to: 50,
                normalized: "Nelle zone dissipative, al fine di assicurare che le stesse si formino in accordo con quanto previsto in progetto, la possibilità che il reale limite di snervamento dell’acciaio sia maggiore del limite nominale deve essere tenuta in conto attraverso un opportuno coefficiente γ_ov, definito al § 7.5.1.",
                math: [math.gammaOv],
            },
            { kind: "paragraph", page: 243, from: 51, to: 52 },
        ],
    },
    {
        number: "7.5.1",
        title: "CARATTERISTICHE DEI MATERIALI",
        heading: { kind: "heading", page: 243, from: 53, normalized: "7.5.1 CARATTERISTICHE DEI MATERIALI" },
        blocks: [
            { kind: "paragraph", page: 243, from: 54 },
            { kind: "paragraph", page: 243, from: 55, to: 56 },
            {
                kind: "paragraph", page: 243, from: 57, to: 58,
                normalized: "Ai fini della progettazione, il fattore di sovraresistenza del materiale, γ_ov è assunto pari a 1,25 per gli acciai tipo S235, S275 ed S355 e pari a 1,15 per gli acciai tipo S420 e S460.",
                math: [math.gammaOv],
            },
        ],
    },
    {
        number: "7.5.2",
        title: "TIPOLOGIE STRUTTURALI E FATTORI DI COMPORTAMENTO",
        heading: { kind: "heading", page: 243, from: 59, normalized: "7.5.2 TIPOLOGIE STRUTTURALI E FATTORI DI COMPORTAMENTO" },
    },
    {
        number: "7.5.2.1",
        title: "TIPOLOGIE STRUTTURALI",
        heading: { kind: "heading", page: 243, from: 60, normalized: "7.5.2.1 TIPOLOGIE STRUTTURALI" },
        extraIssues: [
            {
                issueId: "ntc2018-7-5-2-1-multipage-figure",
                type: "missing-region",
                severity: "blocking",
                note: "La Fig. 7.5.1 è spezzata fra le pagine PDF 244 e 245; lo schema asset corrente conserva i due ritagli ufficiali consecutivi ma non esprime un unico asset multipagina. Verificare la resa editoriale prima della pubblicazione.",
            },
        ],
        blocks: [
            { kind: "paragraph", page: 243, from: 61, to: 62 },
            { kind: "list-item", page: 243, from: 63, to: 66 },
            { kind: "list-item", page: 244, from: 3, to: 7 },
            { kind: "list-item", page: 244, from: 8, to: 9 },
            { kind: "list-item", page: 244, from: 10, to: 12 },
            { kind: "list-item", page: 244, from: 13, to: 14 },
            { kind: "list-item", page: 244, from: 15, to: 19 },
            { kind: "list-item", page: 244, from: 20, to: 24 },
            { kind: "list-item", page: 244, from: 25, to: 26 },
            { kind: "list-item", page: 244, from: 27, to: 28 },
            { kind: "figure-ref", page: 244, from: 29, to: 31, assetId: figureTopId, region: { coordinateSystem: "pdf-points-top-left", x: 70, y: 390, width: 470, height: 350 } },
            { kind: "figure-ref", page: 245, from: 3, to: 6, assetId: figureBottomId, region: { coordinateSystem: "pdf-points-top-left", x: 70, y: 75, width: 470, height: 335 } },
            { kind: "paragraph", page: 245, from: 7, to: 8 },
            { kind: "paragraph", page: 245, from: 9, to: 10 },
            { kind: "paragraph", page: 245, from: 11, to: 13 },
        ],
    },
    {
        number: "7.5.2.2",
        title: "FATTORI DI COMPORTAMENTO",
        heading: { kind: "heading", page: 245, from: 14, normalized: "7.5.2.2 FATTORI DI COMPORTAMENTO" },
        blocks: [
            { kind: "paragraph", page: 245, from: 15, normalized: "Per ciascuna tipologia strutturale il valore massimo per q_0 è indicato in Tab. 7.3.II.", math: [math.q0] },
            { kind: "paragraph", page: 245, from: 16, normalized: "Per le strutture regolari in pianta possono essere adottati i seguenti valori di α_u/α_1:", math: [math.alphaRatio] },
            { kind: "list-item", page: 245, from: 17, normalized: "edifici a un piano α_u/α_1 = 1,1", math: [math.alphaRatio] },
            { kind: "list-item", page: 245, from: 18, normalized: "edifici a telaio a più piani, con una sola campata α_u/α_1 = 1,2", math: [math.alphaRatio] },
            { kind: "list-item", page: 245, from: 19, normalized: "edifici a telaio con più piani e più campate α_u/α_1 = 1,3", math: [math.alphaRatio] },
            { kind: "list-item", page: 245, from: 20, normalized: "edifici con controventi eccentrici a più piani α_u/α_1 = 1,2", math: [math.alphaRatio] },
            { kind: "list-item", page: 245, from: 21, normalized: "edifici con strutture a mensola o a pendolo inverso α_u/α_1 = 1,0", math: [math.alphaRatio] },
            { kind: "paragraph", page: 245, from: 22, to: 24, normalized: "Tali valori di q_0 sono da intendersi validi a patto che vengano rispettate le regole di progettazione e di dettaglio fornite nei paragrafi dal § 7.5.3 al § 7.5.6.", math: [math.q0] },
        ],
    },
    {
        number: "7.5.3",
        title: "REGOLE DI PROGETTO GENERALI PER ELEMENTI STRUTTURALI DISSIPATIVI",
        heading: { kind: "heading", page: 245, from: 25, normalized: "7.5.3 REGOLE DI PROGETTO GENERALI PER ELEMENTI STRUTTURALI DISSIPATIVI" },
        blocks: [
            { kind: "paragraph", page: 245, from: 26, to: 27 },
            { kind: "paragraph", page: 245, from: 28, to: 29 },
        ],
    },
    {
        number: "7.5.3.1",
        title: "VERIFICHE DI RESISTENZA (RES)",
        heading: { kind: "heading", page: 246, from: 3, normalized: "7.5.3.1 VERIFICHE DI RESISTENZA (RES)" },
        blocks: [
            { kind: "paragraph", page: 246, from: 4, to: 5 },
            formula("7.5.1", "7.5.3.1", 246, 6, 7, "R_{j,d}\\ge1{,}1\\,\\gamma_{ov}\\,R_{pl,Rd}=R_{U,Rd}"),
            { kind: "paragraph", page: 246, from: 8 },
            { kind: "paragraph", page: 246, from: 9 },
            { kind: "paragraph", page: 246, from: 10 },
            { kind: "paragraph", page: 246, from: 11 },
            { kind: "paragraph", page: 246, from: 12, to: 14 },
            formula("7.5.2", "7.5.3.1", 246, 15, 25, "\\frac{A_{res}}{A}\\ge1{,}1\\,\\frac{\\gamma_{M2}}{\\gamma_{M0}}\\,\\frac{f_{yk}}{f_{tk}}"),
            { kind: "paragraph", page: 246, from: 26, to: 27 },
        ],
    },
    {
        number: "7.5.3.2",
        title: "VERIFICHE DI DUTTILITÀ (DUT)",
        heading: { kind: "heading", page: 246, from: 28, normalized: "7.5.3.2 VERIFICHE DI DUTTILITÀ (DUT)" },
        blocks: [
            { kind: "paragraph", page: 246, from: 29, to: 31 },
            { kind: "paragraph", page: 246, from: 32, normalized: "Per le tipologie indicate in § 7.5.2.1, si possono utilizzare le seguenti misure di deformazione locale θ:", math: [math.theta] },
            { kind: "list-item", page: 246, from: 33 },
            { kind: "list-item", page: 246, from: 34 },
            { kind: "list-item", page: 246, from: 35, to: 36 },
            { kind: "formula-ref", page: 246, from: 37, to: 38, assetId: assetId("formula", "7.5.3.2:mu-local") },
            { kind: "paragraph", page: 246, from: 39, to: 41, normalized: "La domanda in duttilità locale è definita dal rapporto tra il valore di deformazione θ_u misurato mediante analisi non lineare e il valore di deformazione θ_y al limite elastico. Nel caso di analisi strutturale lineare con fattore di comportamento, la domanda di deformazione può essere dedotta dal campo di spostamenti ultimi ottenuti come in § 7.3.3.3.", math: [math.thetaU, math.thetaY] },
            { kind: "paragraph", page: 246, from: 42, to: 44, normalized: "La capacità in duttilità locale è data dal rapporto tra la misura di deformazione al collasso θ_u, valutata in corrispondenza della riduzione del 15% della massima resistenza dell’elemento, e la deformazione θ_y corrispondente al raggiungimento della prima plasticizzazione.", math: [math.thetaU, math.thetaY] },
            { kind: "paragraph", page: 246, from: 45, to: 47 },
            { kind: "paragraph", page: 246, from: 48, to: 52, normalized: "La verifica di duttilità si ritiene comunque soddisfatta qualora siano rispettate, in funzione della classe di duttilità e del valore di base del fattore di comportamento q_0 utilizzato in fase di progetto, le prescrizioni relative alle classi di sezioni trasversali per le zone/elementi dissipativi riportate in Tab. 7.5.I nonché le prescrizioni specifiche di cui ai successivi paragrafi relativi a ciascuna tipologia strutturale e sia soddisfatta, per le sezioni delle colonne primarie delle strutture a telaio in cui si prevede la formazione di zone dissipative, la relazione:", math: [math.q0] },
            formula("7.5.3", "7.5.3.2", 246, 53, 53, "\\frac{N_{Ed}}{N_{pl,Rd}}\\le0{,}3"),
            { kind: "paragraph", page: 246, from: 54, to: 56, normalized: "dove N_{Ed} è il valore della domanda a sforzo normale e N_{pl,Rd} è il valore della capacità a sforzo normale determinata secondo criteri di cui al § 4.2.4.1.2.", math: [math.nEd, math.nPlRd] },
            { kind: "table-ref", page: 246, from: 57, to: 66, assetId: tableId },
        ],
    },
    {
        number: "7.5.4",
        title: "REGOLE DI PROGETTO SPECIFICHE PER STRUTTURE INTELAIATE",
        heading: { kind: "heading", page: 247, from: 3, normalized: "7.5.4 REGOLE DI PROGETTO SPECIFICHE PER STRUTTURE INTELAIATE" },
        blocks: [{ kind: "paragraph", page: 247, from: 4, to: 7 }],
    },
    {
        number: "7.5.4.1",
        title: "TRAVI",
        heading: { kind: "heading", page: 247, from: 8, normalized: "7.5.4.1 TRAVI" },
        blocks: [
            { kind: "heading", page: 247, from: 9, normalized: "Verifiche di resistenza (RES)" },
            { kind: "paragraph", page: 247, from: 10 },
            formula("7.5.4", "7.5.4.1", 247, 11, 11, "\\frac{M_{Ed}}{M_{pl,Rd}}\\le1"),
            formula("7.5.5", "7.5.4.1", 247, 12, 12, "\\frac{N_{Ed}}{N_{pl,Rd}}\\le0{,}15"),
            formula("7.5.6", "7.5.4.1", 247, 13, 13, "\\frac{V_{Ed,G}+V_{Ed,M}}{V_{pl,Rd}}\\le0{,}50"),
            { kind: "paragraph", page: 247, from: 14 },
            { kind: "paragraph", page: 247, from: 15, to: 17, normalized: "M_{Ed}, N_{Ed} e V_{Ed} sono i valori della domanda a flessione, sforzo normale e taglio;", math: [math.mEd, math.nEd, math.vEd] },
            { kind: "paragraph", page: 247, from: 18, to: 21, normalized: "M_{pl,Rd}, N_{pl,Rd} e V_{pl,Rd} sono i valori della capacità a flessione, sforzo normale e taglio determinate secondo criteri di cui al § 4.2.4.1.2;", math: [math.mPlRd, math.nPlRd, math.vPlRd] },
            { kind: "paragraph", page: 247, from: 22 },
            { kind: "paragraph", page: 247, from: 23, to: 24, normalized: "V_{Ed,M} è la domanda a taglio dovuta all’applicazione di momenti plastici equiversi M_{pl,Rd} nelle sezioni in cui è attesa la formazione delle zone dissipative.", math: [math.vEd, math.mPlRd] },
            { kind: "paragraph", page: 247, from: 25, to: 27 },
        ],
    },
    {
        number: "7.5.4.2",
        title: "COLONNE",
        heading: { kind: "heading", page: 247, from: 28, normalized: "7.5.4.2 COLONNE" },
        blocks: [
            { kind: "heading", page: 247, from: 29, normalized: "Verifiche di resistenza (RES)" },
            { kind: "paragraph", page: 247, from: 30, to: 31 },
            { kind: "paragraph", page: 247, from: 32 },
            formula("7.5.7", "7.5.4.2", 247, 33, 34, "N_{Ed}=N_{Ed,G}+1{,}1\\,\\gamma_{ov}\\,\\Omega\\,N_{Ed,E}"),
            formula("7.5.8", "7.5.4.2", 247, 35, 36, "M_{Ed}=M_{Ed,G}+1{,}1\\,\\gamma_{ov}\\,\\Omega\\,M_{Ed,E}"),
            formula("7.5.9", "7.5.4.2", 247, 37, 38, "V_{Ed}=V_{Ed,G}+1{,}1\\,\\gamma_{ov}\\,\\Omega\\,V_{Ed,E}"),
            { kind: "paragraph", page: 247, from: 39 },
            { kind: "paragraph", page: 247, from: 40, to: 42, normalized: "M_{Ed}, N_{Ed} e V_{Ed} sono i valori della domanda a flessione, sforzo normale e taglio;", math: [math.mEd, math.nEd, math.vEd] },
            { kind: "paragraph", page: 247, from: 43, to: 46, normalized: "N_{Ed,G}, M_{Ed,G}, V_{Ed,G} sono i valori della domanda a sforzo normale, flessione e taglio dovuta alle azioni non sismiche incluse nella combinazione delle azioni per la condizione sismica di progetto;", math: [math.nEdG, math.mEdG, math.vEdG] },
            { kind: "paragraph", page: 247, from: 47, to: 50, normalized: "N_{Ed,E}, M_{Ed,E}, V_{Ed,E} sono i valori della domanda a sforzo normale, flessione e taglio dovuta alle azioni sismiche di progetto;", math: [math.nEdE, math.mEdE, math.vEdE] },
            { kind: "paragraph", page: 247, from: 51, normalized: "γ_ov è il fattore di sovraresistenza relativo al materiale di cui al § 7.5.1;", math: [math.gammaOv] },
            { kind: "paragraph", page: 247, from: 52, to: 58, normalized: "Ω è il minimo valore tra gli Ω_i = (M_{pl,Rd,i} − M_{Ed,G,i}) / M_{Ed,E,i} valutati per tutte le travi in cui si attende la formazione di zone dissipative, essendo M_{Ed,E,i} la domanda a flessione dovuta alle azioni sismiche di progetto, M_{Ed,G,i} la domanda a flessione dovuta alle azioni non sismiche incluse nella combinazione delle azioni per la condizione sismica di progetto e M_{pl,Rd,i} il valore della capacità a flessione della i-esima trave.", math: [math.omega] },
            { kind: "paragraph", page: 247, from: 59, to: 60, normalized: "Nelle colonne in cui si attende la formazione di zone dissipative, la domanda deve essere calcolata nell’ipotesi che in corrispondenza di tali zone sia raggiunta la capacità a flessione M_{pl,Rd}.", math: [math.mPlRd] },
            { kind: "paragraph", page: 248, from: 3 },
            formula("7.5.10", "7.5.4.2", 248, 4, 5, "\\frac{V_{Ed}}{V_{pl,Rd}}\\le0{,}50"),
            { kind: "paragraph", page: 248, from: 6, to: 7 },
            formula("7.5.11", "7.5.4.2", 248, 8, 9, "\\sum M_{C,pl,Rd}\\ge\\gamma_{Rd}\\sum M_{b,pl,Rd}"),
            { kind: "paragraph", page: 248, from: 10, to: 15 },
        ],
    },
    {
        number: "7.5.4.3",
        title: "COLLEGAMENTI TRAVE-COLONNA",
        heading: { kind: "heading", page: 248, from: 16, normalized: "7.5.4.3 COLLEGAMENTI TRAVE-COLONNA" },
        blocks: [
            { kind: "heading", page: 248, from: 17, normalized: "Verifiche di resistenza (RES)" },
            { kind: "paragraph", page: 248, from: 18, to: 21, normalized: "I collegamenti trave-colonna devono essere progettati in modo da consentire la formazione delle zone dissipative alle estremità delle travi secondo le indicazioni di cui al § 7.5.3.1. In particolare, la capacità a flessione del collegamento trave-colonna, M_{j,Rd}, deve soddisfare la seguente relazione", math: [m("M_{j,Rd}", "M_{j,Rd}")] },
            formula("7.5.12", "7.5.4.3", 248, 22, 23, "M_{j,Rd}\\ge1{,}1\\,\\gamma_{ov}\\,M_{b,pl,Rd}"),
            { kind: "paragraph", page: 248, from: 24, to: 25, normalized: "dove M_{b,pl,Rd} è la capacità a flessione della trave collegata e γ_ov è il coefficiente di sovraresistenza.", math: [m("M_{b,pl,Rd}", "M_{b,pl,Rd}"), math.gammaOv] },
        ],
    },
    {
        number: "7.5.4.4",
        title: "PANNELLI D’ANIMA DEI COLLEGAMENTI TRAVE-COLONNA",
        heading: { kind: "heading", page: 248, from: 26, normalized: "7.5.4.4 PANNELLI D’ANIMA DEI COLLEGAMENTI TRAVE-COLONNA" },
        blocks: [
            { kind: "heading", page: 248, from: 27, normalized: "Verifiche di resistenza (RES)" },
            { kind: "paragraph", page: 248, from: 28, to: 30 },
            { kind: "paragraph", page: 248, from: 31 },
            formula("7.5.13", "7.5.4.4", 248, 32, 33, "\\frac{V_{vp,Ed}}{\\min(V_{vp,Rd},V_{vb,Rd})}<1"),
            { kind: "paragraph", page: 248, from: 34, to: 35, normalized: "essendo V_{vp,Ed}, V_{vp,Rd} e V_{vb,Rd} rispettivamente la domanda a taglio, la capacità a taglio per plasticizzazione del pannello e la capacità a taglio per instabilità del pannello, queste ultime valutate come in § 4.2.4.1.2 e 4.2.4.1.3.", math: [m("V_{vp,Ed}", "V_{vp,Ed}"), m("V_{vp,Rd}", "V_{vp,Rd}"), m("V_{vb,Rd}", "V_{vb,Rd}")] },
            { kind: "paragraph", page: 248, from: 36, to: 37, normalized: "La domanda a taglio V_{vp,Ed} deve essere determinata assumendo il raggiungimento della capacità a flessione nelle sezioni delle travi convergenti nel nodo trave-colonna, secondo lo schema e le modalità previste in fase di progetto.", math: [m("V_{vp,Ed}", "V_{vp,Ed}")] },
        ],
    },
    {
        number: "7.5.4.5",
        title: "COLLEGAMENTI COLONNA-FONDAZIONE",
        heading: { kind: "heading", page: 248, from: 38, normalized: "7.5.4.5 COLLEGAMENTI COLONNA-FONDAZIONE" },
        blocks: [
            { kind: "heading", page: 248, from: 39, normalized: "Verifiche di resistenza (RES)" },
            { kind: "paragraph", page: 248, from: 40, to: 41 },
            { kind: "paragraph", page: 248, from: 42 },
            formula("7.5.14", "7.5.4.5", 248, 43, 44, "M_{C,Rd}\\ge1{,}1\\,\\gamma_{ov}\\,M_{c,pl,Rd}(N_{Ed})"),
            { kind: "paragraph", page: 248, from: 45, to: 46, normalized: "dove M_{c,pl,Rd} è la capacità a flessione della colonna, valutata per la domanda a sforzo normale N_{Ed} che fornisce la condizione più gravosa per il collegamento di base. Il coefficiente γ_ov è fornito nel § 7.5.1.", math: [m("M_{c,pl,Rd}", "M_{c,pl,Rd}"), math.nEd, math.gammaOv] },
        ],
    },
    {
        number: "7.5.5",
        title: "REGOLE DI PROGETTO SPECIFICHE PER STRUTTURE CON CONTROVENTI CONCENTRICI",
        heading: { kind: "heading", page: 248, from: 47, normalized: "7.5.5 REGOLE DI PROGETTO SPECIFICHE PER STRUTTURE CON CONTROVENTI CONCENTRICI" },
        blocks: [
            { kind: "paragraph", page: 248, from: 48, to: 51 },
            { kind: "paragraph", page: 249, from: 3 },
            { kind: "paragraph", page: 249, from: 4 },
            { kind: "list-item", page: 249, from: 5, normalized: "1,3 ≤ λ ≤ 2 in telai con controventi ad X;", math: [math.lambda] },
            { kind: "list-item", page: 249, from: 6, normalized: "λ ≤ 2 in telai con controventi a V.", math: [math.lambda] },
            { kind: "heading", page: 249, from: 7, normalized: "Verifiche di resistenza (RES)" },
            { kind: "paragraph", page: 249, from: 8, to: 9 },
            formula("7.5.15", "7.5.5", 249, 10, 10, "\\frac{N_{Ed}}{N_{b,Rd}(M_{Ed})}\\le1"),
            { kind: "paragraph", page: 249, from: 11 },
            { kind: "paragraph", page: 249, from: 12, to: 16, normalized: "N_{b,Rd} è la capacità nei confronti dell’instabilità, calcolata come in § 4.2.4.1.3.1 tenendo conto dell’interazione con il momento flettente M_{Ed}.", math: [m("N_{b,Rd}", "N_{b,Rd}"), math.mEd] },
            { kind: "paragraph", page: 249, from: 17, to: 23, normalized: "N_{Ed} ed M_{Ed} i valori della domanda a sforzo normale e flessione dovuta alle combinazioni sismiche di progetto, valutate rispettivamente mediante le espressioni 7.5.7 e 7.5.8, ponendo Ω il minimo valore tra gli Ω_i = N_{pl,Rd,i} / N_{Ed,i} dove N_{pl,Rd,i} è la capacità a sforzo normale della i-esima diagonale e N_{Ed,i} la domanda a sforzo normale per la combinazione sismica, calcolati per tutti gli elementi di controvento in cui si attende la formazione di zone dissipative.", math: [math.nEd, math.mEd, math.omega, math.omegaI, math.nPlRdI, math.nEdI] },
            { kind: "paragraph", page: 249, from: 24, to: 27, normalized: "Per garantire un comportamento dissipativo omogeneo delle diagonali all’interno della struttura, i valori massimo e minimo dei coefficienti Ω_i = N_{pl,Rd,i} / N_{Ed,i}, dove N_{pl,Rd,i} è la capacità a sforzo normale della i-esima diagonale e N_{Ed,i} la domanda a sforzo normale per la combinazione sismica, calcolati per tutti gli elementi di controvento in cui si attende la formazione di zone dissipative, devono differire non più del 25%.", math: [math.omegaI, math.nPlRdI, math.nEdI] },
            { kind: "paragraph", page: 249, from: 28, to: 29 },
            { kind: "paragraph", page: 249, from: 30, to: 38, normalized: "Le travi devono inoltre avere capacità sufficiente per rispondere alla domanda che si sviluppa a seguito della plasticizzazione delle diagonali tese e dell’instabilizzazione delle diagonali compresse in condizioni sismiche. Per determinare il valore di tale domanda si può considerare la presenza, nelle diagonali tese, di una sollecitazione pari alla capacità a sforzo normale N_{pl,Rd} e, nelle diagonali compresse, di una sollecitazione pari a γ_{pb} · N_{pl,Rd}, essendo γ_{pb} = 0,30 il fattore che permette di stimare la capacità residua dopo l’instabilizzazione della diagonale. I collegamenti delle diagonali alle altre parti strutturali devono garantire il rispetto dei requisiti di cui al § 7.5.3.1.", math: [math.nPlRd, m("γ_{pb}", "\\gamma_{pb}")] },
            { kind: "heading", page: 249, from: 39, normalized: "Verifiche di duttilità (DUT)" },
            { kind: "paragraph", page: 249, from: 40, to: 44, normalized: "Qualora non si eseguano le specifiche verifiche di duttilità di cui al § 7.5.3.2, le membrature di controvento devono appartenere alla prima o alla seconda classe di cui al § 4.2.3.1 secondo la Tab. 7.5.I. Qualora esse siano costituite da sezioni circolari cave, il rapporto tra il diametro esterno d e lo spessore t deve soddisfare la limitazione d/t ≤ 36. Nel caso in cui le aste di controvento siano costituite da profili tubolari a sezione rettangolare, i rapporti larghezza/spessore delle parti che costituiscono la sezione non devono eccedere 18, a meno che le pareti del tubo non siano irrigidite.", math: [math.lambdaRatio] },
        ],
    },
    {
        number: "7.5.6",
        title: "REGOLE DI PROGETTO SPECIFICHE PER STRUTTURE CON CONTROVENTI ECCENTRICI",
        heading: { kind: "heading", page: 249, from: 45, normalized: "7.5.6 REGOLE DI PROGETTO SPECIFICHE PER STRUTTURE CON CONTROVENTI ECCENTRICI" },
        blocks: [
            { kind: "paragraph", page: 249, from: 46, to: 48 },
            { kind: "paragraph", page: 249, from: 49, to: 51 },
            formula("7.5.16a", "7.5.6", 249, 52, 56, "e\\le0{,}8(1+\\alpha)\\frac{M_{l,Rd}}{V_{l,Rd}}"),
            formula("7.5.16b", "7.5.6", 249, 57, 66, "0{,}8(1+\\alpha)\\frac{M_{l,Rd}}{V_{l,Rd}}<e<1{,}5(1+\\alpha)\\frac{M_{l,Rd}}{V_{l,Rd}}"),
            formula("7.5.16c", "7.5.6", 249, 67, 71, "e\\ge1{,}5(1+\\alpha)\\frac{M_{l,Rd}}{V_{l,Rd}}"),
            { kind: "paragraph", page: 249, from: 72, to: 73, normalized: "dove M_{l,Rd} e V_{l,Rd} sono, rispettivamente, la capacità a flessione e la capacità a taglio dell’elemento di connessione, α è il rapporto tra il valore minore ed il maggiore della domanda a flessione attesa alle due estremità dell’elemento di connessione.", math: [math.mLRd, math.vLRd, m("α", "\\alpha")] },
            { kind: "heading", page: 250, from: 3, normalized: "Verifiche di resistenza (RES)" },
            { kind: "paragraph", page: 250, from: 4, to: 5 },
            formula("7.5.17", "7.5.6", 250, 6, 6, "M_{l,Rd}=f_y\\,b\\,t_f\\,(h-t_f)"),
            formula("7.5.18", "7.5.6", 250, 7, 12, "V_{l,Rd}=\\frac{f_y}{\\sqrt{3}}\\,t_w\\,(h-t_f)"),
            { kind: "paragraph", page: 250, from: 13, to: 14, normalized: "essendo b e t_f la larghezza e lo spessore della flangia, h l’altezza della sezione e t_w lo spessore dell’anima del profilo costituente la sezione.", math: [m("t_f", "t_f"), math.tW] },
            { kind: "paragraph", page: 250, from: 15, to: 16, normalized: "Quando sia soddisfatta la relazione N_{Ed}/N_{pl,Rd} < 0,15 occorre che ad entrambe le estremità del collegamento la capacità a taglio ed a flessione siano maggiori della corrispondente domanda:", math: [math.nEd, math.nPlRd] },
            formula("7.5.19", "7.5.6", 250, 17, 18, "V_{Ed}\\le V_{l,Rd}"),
            formula("7.5.20", "7.5.6", 250, 19, 20, "M_{Ed}\\le M_{l,Rd}"),
            { kind: "paragraph", page: 250, from: 21, to: 24, normalized: "essendo N_{Ed}, V_{Ed} e M_{Ed} i valori della domanda a sforzo normale, taglio e flessione agenti in corrispondenza delle estremità dell’elemento di connessione e N_{pl,Rd} la capacità a sforzo normale della sezione costituente l’elemento di connessione.", math: [math.nEd, math.vEd, math.mEd, math.nPlRd] },
            { kind: "paragraph", page: 250, from: 25, to: 29, normalized: "Quando il valore di progetto della domanda a sforzo normale N_{Ed} agente sull’elemento di connessione supera il 15% della corrispondente capacità della sezione costituente l’elemento N_{pl,Rd}, tale domanda va tenuta opportunamente in conto riducendo la capacità a taglio, V_{l,Rd}, e a flessione, M_{l,Rd}, dell’elemento di connessione stesso, adottando le seguenti espressioni", math: [math.nEd, math.nPlRd, math.vLRd, math.mLRd] },
            formula("7.5.21", "7.5.6", 250, 30, 33, "V_{l,Rd,r}=V_{l,Rd}\\left[1-\\left(\\frac{N_{Ed}}{N_{pl,Rd}}\\right)^2\\right]^{0{,}5}"),
            formula("7.5.22", "7.5.6", 250, 34, 35, "M_{l,Rd,r}=M_{l,Rd}\\left[1-\\frac{N_{Ed}}{N_{pl,Rd}}\\right]"),
            { kind: "paragraph", page: 250, from: 36 },
            formula("7.5.23", "7.5.6", 250, 37, 38, "e\\le1{,}6\\frac{M_{l,Rd}}{V_{l,Rd}}\\quad\\text{se }R<0{,}3"),
            formula("7.5.24", "7.5.6", 250, 39, 40, "e\\le(1{,}15-0{,}5R)1{,}6\\frac{M_{l,Rd}}{V_{l,Rd}}\\quad\\text{se }R\\ge0{,}3"),
            { kind: "paragraph", page: 250, from: 41, to: 42, normalized: "dove R = N_{Ed} t_w (d - 2t_f) / (V_{Ed} A), in cui A è l’area lorda del collegamento.", math: [math.r, math.nEd, math.tW, math.vEd, m("t_f", "t_f")] },
            { kind: "paragraph", page: 250, from: 43, to: 45 },
            formula("7.5.25", "7.5.6", 250, 46, 47, "N_{Rd}(M_{Ed},V_{Ed})\\le N_{Ed,G}+1{,}1\\,\\gamma_{ov}\\,\\Omega\\,N_{Ed,E}"),
            { kind: "paragraph", page: 250, from: 48 },
            { kind: "paragraph", page: 250, from: 49, to: 50, normalized: "N_{Rd}(M_{Ed}, V_{Ed}) è la capacità a sforzo normale di progetto della colonna o dell’elemento diagonale valutata tenendo conto dell’interazione con la domanda a flessione ed a taglio, M_{Ed} e V_{Ed} nella combinazione sismica;", math: [m("N_{Rd}", "N_{Rd}"), math.mEd, math.vEd] },
            { kind: "paragraph", page: 250, from: 51, to: 52, normalized: "N_{Ed,G} è la domanda a sforzo normale nella colonna o nell’elemento diagonale, dovuta ad azioni di tipo non-sismico incluse nella combinazione sismica di progetto;", math: [math.nEdG] },
            { kind: "paragraph", page: 250, from: 53, normalized: "N_{Ed,E} è la domanda a sforzo normale nella colonna o nell’elemento diagonale per l’azione sismica di progetto;", math: [math.nEdE] },
            { kind: "paragraph", page: 250, from: 54, normalized: "γ_ov è il coefficiente di sovraresistenza del materiale di cui al § 7.5.1;", math: [math.gammaOv] },
            { kind: "paragraph", page: 250, from: 55, to: 59, normalized: "Ω è pari al valore minimo dei coefficienti Ω_i = 1,5 V_{l,Rd,i} / V_{Ed,i} per elementi di connessione corti in cui si localizzano le zone dissipative e Ω_i = 1,5 M_{l,Rd,i}/M_{Ed,i} per tutti gli elementi di connessione lunghi e intermedi in cui si localizzano le zone dissipative, dove V_{Ed,i} e M_{Ed,i} sono i valori della domanda a taglio e flessione dell’i-esimo elemento di connessione per la combinazione sismica di progetto, V_{l,Rd,i} e M_{l,Rd,i} sono le capacità a taglio e flessione dell’i-esimo elemento di connessione.", math: [math.omega, math.omegaI, math.vLRdI, math.mLRdI, m("V_{Ed,i}", "V_{Ed,i}"), m("M_{Ed,i}", "M_{Ed,i}")] },
            { kind: "paragraph", page: 250, from: 60 },
            formula("7.5.26", "7.5.6", 250, 61, 62, "E_d=E_{d,G}+1{,}1\\,\\gamma_{ov}\\,\\Omega_i\\,E_{d,E}"),
            { kind: "paragraph", page: 250, from: 63 },
            { kind: "paragraph", page: 250, from: 64 },
            { kind: "paragraph", page: 250, from: 65 },
            { kind: "paragraph", page: 250, from: 66 },
            { kind: "paragraph", page: 251, from: 3, to: 6, normalized: "Ω_i è il coefficiente relativo all’elemento di connessione considerato e calcolato come indicato nel presente paragrafo. Per garantire un comportamento dissipativo omogeneo degli elementi di collegamento all’interno della struttura, i coefficienti Ω_i calcolati per tutti gli elementi di connessione come indicato in precedenza nel presente paragrafo, devono differire tra il massimo ed il minimo di non più del 25%.", math: [math.omegaI] },
            { kind: "heading", page: 251, from: 7, normalized: "Verifiche di duttilità (DUT)" },
            { kind: "paragraph", page: 251, from: 8 },
            { kind: "list-item", page: 251, from: 9, to: 10, normalized: "gli elementi di collegamento lunghi e intermedi devono appartenere alla prima o alla seconda classe di cui al § 4.2.3.1 secondo la Tab. 7.5.I;" },
            { kind: "list-item", page: 251, from: 11, to: 12, normalized: "negli elementi di collegamento intermedi e corti devono essere evitati i fenomeni di instabilità locale fino al raggiungimento della completa plasticizzazione della sezione;" },
            { kind: "list-item", page: 251, from: 13, normalized: "devono essere soddisfatte le prescrizioni sui dettagli costruttivi di cui al presente paragrafo;" },
            { kind: "paragraph", page: 251, from: 14, normalized: "la domanda di rotazione rigida θ_p tra l’elemento di connessione e l’elemento contiguo non deve eccedere i seguenti valori:", math: [math.thetaP] },
            { kind: "formula-ref", page: 251, from: 15, assetId: assetId("formula", "7.5.26a:short") },
            { kind: "formula-ref", page: 251, from: 16, assetId: assetId("formula", "7.5.26a:long") },
            { kind: "paragraph", page: 251, from: 17 },
            { kind: "heading", page: 251, from: 18, normalized: "Dettagli costruttivi" },
            { kind: "paragraph", page: 251, from: 19, to: 22, normalized: "Il comportamento degli elementi di connessione lunghi è dominato dalla plasticizzazione per flessione. Le modalità di collasso tipiche di tali elementi di connessione sono rappresentate dalla instabilità locale della piattabanda compressa e dalla instabilità flesso-torsionale. Al fine di evitare tali fenomeni, occorre disporre irrigidimenti ad una distanza massima pari a 1,5 b, essendo b la larghezza della flangia del profilo costituente l’elemento di connessione, dall’estremità dell’elemento di connessione stesso.", math: [m("1,5 b", "1{,}5b")] },
            { kind: "paragraph", page: 251, from: 23 },
            { kind: "paragraph", page: 251, from: 24, to: 29, normalized: "Nel caso di elementi di connessione corti e travi di modesta altezza (minore di 600 mm) è sufficiente che gli irrigidimenti siano disposti da un solo lato dell’anima, impegnando almeno i 3/4 della altezza dell’anima stessa. Tali irrigidimenti devono avere spessore non inferiore a t_w, e comunque non inferiore a 10 mm, e larghezza pari a (b/2)-t_w, essendo t_w lo spessore dell’anima del profilo costituente l’elemento di connessione.", math: [math.tW] },
            { kind: "paragraph", page: 251, from: 30, to: 31 },
            { kind: "paragraph", page: 251, from: 32, to: 37, normalized: "Le saldature che collegano il generico elemento di irrigidimento all’anima devono possedere una capacità tale da soddisfare una domanda pari a A_{st} f_y, essendo A_{st} l’area dell’elemento di irrigidimento; le saldature che lo collegano alle piattabande devono possedere una capacità superiore a A_{st} f_y/4.", math: [m("A_{st}", "A_{st}"), m("f_y", "f_y")] },
        ],
    },
];

const formulaLatex: Record<string, { unit: string; number: string | null; page: number; latex: string }> = {
    "7.5.1": { unit: "7.5.3.1", number: "7.5.1", page: 246, latex: "R_{j,d}\\ge1{,}1\\,\\gamma_{ov}\\,R_{pl,Rd}=R_{U,Rd}" },
    "7.5.2": { unit: "7.5.3.1", number: "7.5.2", page: 246, latex: "\\frac{A_{res}}{A}\\ge1{,}1\\,\\frac{\\gamma_{M2}}{\\gamma_{M0}}\\,\\frac{f_{yk}}{f_{tk}}" },
    "7.5.3": { unit: "7.5.3.2", number: "7.5.3", page: 246, latex: "\\frac{N_{Ed}}{N_{pl,Rd}}\\le0{,}3" },
    "7.5.3.2:mu-local": { unit: "7.5.3.2", number: null, page: 246, latex: "\\mu=\\theta_u/\\theta_y" },
    "7.5.4": { unit: "7.5.4.1", number: "7.5.4", page: 247, latex: "\\frac{M_{Ed}}{M_{pl,Rd}}\\le1" },
    "7.5.5": { unit: "7.5.4.1", number: "7.5.5", page: 247, latex: "\\frac{N_{Ed}}{N_{pl,Rd}}\\le0{,}15" },
    "7.5.6": { unit: "7.5.4.1", number: "7.5.6", page: 247, latex: "\\frac{V_{Ed,G}+V_{Ed,M}}{V_{pl,Rd}}\\le0{,}50" },
    "7.5.7": { unit: "7.5.4.2", number: "7.5.7", page: 247, latex: "N_{Ed}=N_{Ed,G}+1{,}1\\,\\gamma_{ov}\\,\\Omega\\,N_{Ed,E}" },
    "7.5.8": { unit: "7.5.4.2", number: "7.5.8", page: 247, latex: "M_{Ed}=M_{Ed,G}+1{,}1\\,\\gamma_{ov}\\,\\Omega\\,M_{Ed,E}" },
    "7.5.9": { unit: "7.5.4.2", number: "7.5.9", page: 247, latex: "V_{Ed}=V_{Ed,G}+1{,}1\\,\\gamma_{ov}\\,\\Omega\\,V_{Ed,E}" },
    "7.5.10": { unit: "7.5.4.2", number: "7.5.10", page: 248, latex: "\\frac{V_{Ed}}{V_{pl,Rd}}\\le0{,}50" },
    "7.5.11": { unit: "7.5.4.2", number: "7.5.11", page: 248, latex: "\\sum M_{C,pl,Rd}\\ge\\gamma_{Rd}\\sum M_{b,pl,Rd}" },
    "7.5.12": { unit: "7.5.4.3", number: "7.5.12", page: 248, latex: "M_{j,Rd}\\ge1{,}1\\,\\gamma_{ov}\\,M_{b,pl,Rd}" },
    "7.5.13": { unit: "7.5.4.4", number: "7.5.13", page: 248, latex: "\\frac{V_{vp,Ed}}{\\min(V_{vp,Rd},V_{vb,Rd})}<1" },
    "7.5.14": { unit: "7.5.4.5", number: "7.5.14", page: 248, latex: "M_{C,Rd}\\ge1{,}1\\,\\gamma_{ov}\\,M_{c,pl,Rd}(N_{Ed})" },
    "7.5.15": { unit: "7.5.5", number: "7.5.15", page: 249, latex: "\\frac{N_{Ed}}{N_{b,Rd}(M_{Ed})}\\le1" },
    "7.5.16a": { unit: "7.5.6", number: "7.5.16a", page: 249, latex: "e\\le0{,}8(1+\\alpha)\\frac{M_{l,Rd}}{V_{l,Rd}}" },
    "7.5.16b": { unit: "7.5.6", number: "7.5.16b", page: 249, latex: "0{,}8(1+\\alpha)\\frac{M_{l,Rd}}{V_{l,Rd}}<e<1{,}5(1+\\alpha)\\frac{M_{l,Rd}}{V_{l,Rd}}" },
    "7.5.16c": { unit: "7.5.6", number: "7.5.16c", page: 249, latex: "e\\ge1{,}5(1+\\alpha)\\frac{M_{l,Rd}}{V_{l,Rd}}" },
    "7.5.17": { unit: "7.5.6", number: "7.5.17", page: 250, latex: "M_{l,Rd}=f_y\\,b\\,t_f\\,(h-t_f)" },
    "7.5.18": { unit: "7.5.6", number: "7.5.18", page: 250, latex: "V_{l,Rd}=\\frac{f_y}{\\sqrt{3}}\\,t_w\\,(h-t_f)" },
    "7.5.19": { unit: "7.5.6", number: "7.5.19", page: 250, latex: "V_{Ed}\\le V_{l,Rd}" },
    "7.5.20": { unit: "7.5.6", number: "7.5.20", page: 250, latex: "M_{Ed}\\le M_{l,Rd}" },
    "7.5.21": { unit: "7.5.6", number: "7.5.21", page: 250, latex: "V_{l,Rd,r}=V_{l,Rd}\\left[1-\\left(\\frac{N_{Ed}}{N_{pl,Rd}}\\right)^2\\right]^{0{,}5}" },
    "7.5.22": { unit: "7.5.6", number: "7.5.22", page: 250, latex: "M_{l,Rd,r}=M_{l,Rd}\\left[1-\\frac{N_{Ed}}{N_{pl,Rd}}\\right]" },
    "7.5.23": { unit: "7.5.6", number: "7.5.23", page: 250, latex: "e\\le1{,}6\\frac{M_{l,Rd}}{V_{l,Rd}}\\quad\\text{se }R<0{,}3" },
    "7.5.24": { unit: "7.5.6", number: "7.5.24", page: 250, latex: "e\\le(1{,}15-0{,}5R)1{,}6\\frac{M_{l,Rd}}{V_{l,Rd}}\\quad\\text{se }R\\ge0{,}3" },
    "7.5.25": { unit: "7.5.6", number: "7.5.25", page: 250, latex: "N_{Rd}(M_{Ed},V_{Ed})\\le N_{Ed,G}+1{,}1\\,\\gamma_{ov}\\,\\Omega\\,N_{Ed,E}" },
    "7.5.26": { unit: "7.5.6", number: "7.5.26", page: 250, latex: "E_d=E_{d,G}+1{,}1\\,\\gamma_{ov}\\,\\Omega_i\\,E_{d,E}" },
    "7.5.26a:short": { unit: "7.5.6", number: "7.5.26a", page: 251, latex: "\\theta_p\\le0{,}08\\,\\mathrm{rad}" },
    "7.5.26a:long": { unit: "7.5.6", number: "7.5.26a", page: 251, latex: "\\theta_p\\le0{,}02\\,\\mathrm{rad}" },
};

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
            ? [{ issueId: `ntc2018-${spec.number.replaceAll(".", "-")}-assets`, type: "asset-review", severity: "blocking", note: "Formule, tabella e ritagli di figura sono stati separati e collocati nel flusso originario; resta obbligatoria la verifica umana puntuale." }]
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

const figuresDirectory = join(repoRoot, "corpus", "assets", "figures", "ntc2018");
const figureSha = async (filename: string): Promise<string> =>
    createHash("sha256").update(await readFile(join(figuresDirectory, filename))).digest("hex");
const manifest = {
    $schema: "urn:structural-codes:schema:asset-manifest:v2",
    schemaVersion: "2.0.0-alpha.1",
    recordType: "asset-manifest",
    document: "ntc2018",
    section: "7.5-step1",
    sourceId,
    status: "transcribed-unreviewed",
    formulas: Object.entries(formulaLatex).map(([suffix, value]) => ({
        id: assetId("formula", suffix),
        unitId: idFor(value.unit),
        officialNumber: value.number,
        pdfPage: value.page,
        latex: value.latex,
    })),
    tables: [
        {
            id: tableId,
            unitId: idFor("7.5.3.2"),
            officialNumber: "7.5.I",
            pdfPage: 246,
            caption: "Classe della sezione trasversale di elementi dissipativi in funzione della classe di duttilità e di q_0",
            columnCount: 3,
            headers: [[
                { text: "Classe di duttilità" },
                { text: "Valore di base q_0 del fattore di comportamento", latex: "\\text{Valore di base }q_0\\text{ del fattore di comportamento}" },
                { text: "Classe di sezione trasversale richiesta" },
            ]],
            rows: [
                [{ text: "CD “B”" }, { text: "2 < q_0 ≤ 4", latex: "2<q_0\\le4" }, { text: "Classe 1 o 2" }],
                [{ text: "CD “A”" }, { text: "q_0 > 4", latex: "q_0>4" }, { text: "Classe 1" }],
            ],
            notes: ["Tabella strutturata dal render ufficiale; revisione umana cella per cella ancora obbligatoria."],
        },
    ],
    figures: [
        {
            id: figureTopId,
            unitId: idFor("7.5.2.1"),
            officialNumber: "7.5.1",
            pdfPage: 244,
            caption: "Fig. 7.5.1 – Tipologie strutturali (parte superiore, pannelli b1–b3)",
            alt: "Parte superiore della Fig. 7.5.1 con strutture con controventi concentrici a diagonale tesa attiva, a V e a K.",
            imagePath: "figures/ntc2018/fig7.5.1-upper.png",
            region: { coordinateSystem: "pdf-points-top-left", x: 70, y: 390, width: 470, height: 350 },
            sha256: await figureSha("fig7.5.1-upper.png"),
        },
        {
            id: figureBottomId,
            unitId: idFor("7.5.2.1"),
            officialNumber: "7.5.1",
            pdfPage: 245,
            caption: "Fig. 7.5.1 – Tipologie strutturali (parte inferiore, pannelli c–e e didascalia)",
            alt: "Parte inferiore della Fig. 7.5.1 con strutture con controventi eccentrici, a mensola o a pendolo inverso e intelaiate con controventi concentrici.",
            imagePath: "figures/ntc2018/fig7.5.1-lower.png",
            region: { coordinateSystem: "pdf-points-top-left", x: 70, y: 75, width: 470, height: 335 },
            sha256: await figureSha("fig7.5.1-lower.png"),
        },
    ],
};
await mkdir(join(repoRoot, "corpus", "assets", "ntc2018"), { recursive: true });
await writeFile(join(repoRoot, "corpus", "assets", "ntc2018", "7.5-step1.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(`ntc75-step1: generate ${units.length} unità e ${Object.keys(formulaLatex).length} formule`);
