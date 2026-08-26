/* eslint-disable @typescript-eslint/no-explicit-any */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../", import.meta.url));
const sourceId = "gu-so8-2018-ntc";
const profile = "ntc74-editorial-profile-0.1.0";
const actor = {
    actorId: "generator:ntc74:step1",
    kind: "script",
    toolVersion: profile,
};

const pageLines = new Map<number, string[]>();
for (let page = 227; page <= 232; page += 1) {
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

async function fileSha256(path: string): Promise<string> {
    return createHash("sha256").update(await readFile(path)).digest("hex");
}

function clean(value: string): string {
    return value
        .replace(/\n/gu, " ")
        .replace(/\s+/gu, " ")
        .replace(/^77\.4/gu, "7.4")
        .replace(/\bF ATTORI\b/gu, "FATTORI")
        .replace(/\bP ILASTRI\b/gu, "PILASTRI")
        .replace(/\bN ODI TRAVE- PILASTRO\b/gu, "NODI TRAVE-PILASTRO")
        .replace(/\bD IAFRAMMI\b/gu, "DIAFRAMMI")
        .replace(/\bP ARETI\b/gu, "PARETI")
        .replace(/^ȭ /gu, "")
        .replace(/^E’/gu, "È")
        .replace(/§7\./gu, "§ 7.")
        .replace(/CD”/gu, "CD “")
        .replace(/CD ”/gu, "CD “")
        .replace(/”B”/gu, "B”")
        .replace(/”A”/gu, "A”")
        .trim();
}

type MathTerm = { value: string; latex: string };

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
            let index = text.indexOf(term.value, cursor);
            const needsWordBoundaries = /^[A-Za-z]$/u.test(term.value);
            while (index >= 0 && needsWordBoundaries) {
                const before = text[index - 1];
                const after = text[index + term.value.length];
                const beforeIsWord = before !== undefined && /[\p{L}\p{N}_]/u.test(before);
                const afterIsWord = after !== undefined && /[\p{L}\p{N}_]/u.test(after);
                if (!beforeIsWord && !afterIsWord) break;
                index = text.indexOf(term.value, index + 1);
            }
            if (
                index >= 0 &&
                (match === undefined ||
                    index < match.index ||
                    (index === match.index &&
                        term.value.length > match.term.value.length))
            ) {
                match = { index, term };
            }
        }
        if (!match) {
            segments.push({ kind: "text", value: text.slice(cursor) });
            break;
        }
        if (match.index > cursor) {
            segments.push({
                kind: "text",
                value: text.slice(cursor, match.index),
            });
        }
        segments.push({
            kind: "math",
            value: match.term.value,
            latex: match.term.latex,
        });
        cursor = match.index + match.term.value.length;
    }
    return segments.filter(({ value }) => value.length > 0);
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
    if (/[\u0000-\u001f\u007f-\u009fȭ΅·ǃǂΌΑ]/u.test(source)) {
        operations.push({
            operation: "manual-correction",
            ruleVersion: profile,
            note: "Ripristinati manualmente glifi, simboli matematici e spaziatura verificati sul render ufficiale.",
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
            tool:
                method === "pdf-text"
                    ? "pdfjs-dist"
                    : "codex-manual-asset-transcription",
            toolVersion: method === "pdf-text" ? "4.10.38" : profile,
        },
        transformations: transformations(source, normalized),
        rawSha256: sha256(source),
        normalizedSha256: sha256(normalized),
    };
}

type BlockSpec = {
    kind: "heading" | "paragraph" | "list-item";
    page: number;
    from: number;
    to?: number;
    normalized?: string;
    math?: MathTerm[];
};

type AssetBlockSpec = {
    kind: "formula-ref" | "figure-ref";
    page: number;
    from: number;
    to?: number;
    assetId: string;
    region?: any;
};

type UnitSpec = {
    number: string;
    title: string;
    heading: { page: number; from: number; normalized?: string };
    blocks?: Array<BlockSpec | AssetBlockSpec>;
};

const m = (value: string, latex: string): MathTerm => ({ value, latex });

const units: UnitSpec[] = [
    {
        number: "7.4",
        title: "COSTRUZIONI DI CALCESTRUZZO",
        heading: {
            page: 227,
            from: 21,
            normalized: "7.4 COSTRUZIONI DI CALCESTRUZZO",
        },
    },
    {
        number: "7.4.1",
        title: "GENERALITÀ",
        heading: { page: 227, from: 22, normalized: "7.4.1 GENERALITÀ" },
        blocks: [
            { kind: "paragraph", page: 227, from: 23, to: 27 },
            { kind: "paragraph", page: 227, from: 28, to: 31 },
            {
                kind: "paragraph",
                page: 227,
                from: 32,
                to: 33,
                math: [m("0,35%", "0{,}35\\%")],
            },
            { kind: "paragraph", page: 227, from: 34 },
            { kind: "list-item", page: 227, from: 35 },
            { kind: "list-item", page: 227, from: 36 },
            { kind: "list-item", page: 227, from: 37, to: 38 },
            { kind: "paragraph", page: 227, from: 39, to: 40 },
            { kind: "paragraph", page: 227, from: 41, to: 43 },
            { kind: "paragraph", page: 227, from: 44, to: 45 },
        ],
    },
    {
        number: "7.4.2",
        title: "CARATTERISTICHE DEI MATERIALI",
        heading: {
            page: 227,
            from: 46,
            normalized: "7.4.2 CARATTERISTICHE DEI MATERIALI",
        },
    },
    {
        number: "7.4.2.1",
        title: "CONGLOMERATO",
        heading: {
            page: 227,
            from: 47,
            normalized: "7.4.2.1 CONGLOMERATO",
        },
        blocks: [{ kind: "paragraph", page: 227, from: 48 }],
    },
    {
        number: "7.4.2.2",
        title: "ACCIAIO",
        heading: { page: 228, from: 3, normalized: "7.4.2.2 ACCIAIO" },
        blocks: [
            { kind: "paragraph", page: 228, from: 4 },
            {
                kind: "paragraph",
                page: 228,
                from: 5,
                to: 8,
                normalized:
                    "È consentito l’utilizzo di acciai di tipo B450A, con diametri compresi tra 5 e 10 mm, per le reti e i tralicci; se ne consente inoltre l’uso per l’armatura trasversale unicamente se è rispettata almeno una delle seguenti condizioni: elementi in cui è impedita la plasticizzazione mediante il rispetto del criterio di gerarchia delle resistenze, elementi secondari di cui al § 7.2.3, strutture con comportamento non dissipativo di cui al § 7.2.2.",
            },
        ],
    },
    {
        number: "7.4.3",
        title: "TIPOLOGIE STRUTTURALI E FATTORI DI COMPORTAMENTO",
        heading: {
            page: 228,
            from: 9,
            normalized:
                "7.4.3 TIPOLOGIE STRUTTURALI E FATTORI DI COMPORTAMENTO",
        },
    },
    {
        number: "7.4.3.1",
        title: "TIPOLOGIE STRUTTURALI",
        heading: {
            page: 228,
            from: 10,
            normalized: "7.4.3.1 TIPOLOGIE STRUTTURALI",
        },
        blocks: [
            { kind: "paragraph", page: 228, from: 11, to: 12 },
            {
                kind: "list-item",
                page: 228,
                from: 13,
                to: 14,
                normalized:
                    "strutture a telaio, nelle quali la resistenza alle azioni sia verticali che orizzontali è affidata principalmente a telai spaziali, aventi resistenza a taglio alla base ≥ 65% della resistenza a taglio totale;",
                math: [m("≥ 65%", "\\ge 65\\%")],
            },
            {
                kind: "list-item",
                page: 228,
                from: 15,
                to: 18,
                normalized:
                    "strutture a pareti, nelle quali la resistenza alle azioni sia verticali che orizzontali è affidata principalmente a pareti (v. § 7.4.4.5), aventi resistenza a taglio alla base ≥ 65% della resistenza a taglio totale; le pareti, a seconda della forma in pianta, si definiscono semplici o composte (v. § 7.4.4.5), a seconda della assenza o presenza di opportune “travi di accoppiamento” duttili distribuite in modo regolare lungo l’altezza, si definiscono singole o accoppiate;",
                math: [m("≥ 65%", "\\ge 65\\%")],
            },
            { kind: "list-item", page: 228, from: 19, to: 22 },
            { kind: "list-item", page: 228, from: 23, to: 24 },
            { kind: "list-item", page: 228, from: 25, to: 28 },
            {
                kind: "list-item",
                page: 228,
                from: 29,
                to: 30,
                normalized:
                    "strutture deformabili torsionalmente, composte da telai e/o pareti, la cui rigidezza torsionale non soddisfa ad ogni piano la condizione r²/lₛ² ≥ 1, nella quale:",
                math: [m("r²/lₛ² ≥ 1", "\\frac{r^2}{l_s^2}\\ge 1")],
            },
            {
                kind: "paragraph",
                page: 228,
                from: 31,
                to: 34,
                normalized:
                    "r² = raggio torsionale al quadrato è, per ciascun piano, il rapporto tra la rigidezza torsionale rispetto al centro di rigidezza laterale e la maggiore tra le rigidezze laterali, tenendo conto dei soli elementi strutturali primari; per strutture a telaio o a pareti (purché snelle e a deformazione prevalentemente flessionale), r² può essere valutato, per ogni piano, riferendosi ai momenti d’inerzia flessionali delle sezioni degli elementi verticali primari.",
                math: [m("r²", "r^2")],
            },
            {
                kind: "paragraph",
                page: 228,
                from: 35,
                to: 37,
                normalized:
                    "lₛ² = per ogni piano, è il rapporto fra il momento d’inerzia polare della massa del piano rispetto ad un asse verticale passante per il centro di massa del piano e la massa stessa del piano; nel caso di piano a pianta rettangolare lₛ² = (L² + B²)/12, essendo L e B le dimensioni in pianta del piano.",
                math: [
                    m("lₛ² = (L² + B²)/12", "l_s^2=\\frac{L^2+B^2}{12}"),
                    m("lₛ²", "l_s^2"),
                    m("L", "L"),
                    m("B", "B"),
                ],
            },
            {
                kind: "paragraph",
                page: 228,
                from: 38,
                to: 42,
                math: [m("T_C", "T_C")],
                normalized:
                    "Una struttura a pareti, nei termini sopra definiti, è da considerarsi come struttura a pareti estese debolmente armate se le pareti sono caratterizzate da un’estensione a buona parte del perimetro della pianta strutturale e sono dotate di idonei provvedimenti per garantire la continuità strutturale così da produrre un efficace comportamento scatolare. Inoltre, nella direzione orizzontale d’interesse, la struttura deve avere un periodo fondamentale, in condizioni non fessurate e calcolato nell’ipotesi di assenza di rotazioni alla base, non superiore a T_C.",
            },
        ],
    },
    {
        number: "7.4.3.2",
        title: "FATTORI DI COMPORTAMENTO",
        heading: {
            page: 228,
            from: 43,
            normalized: "7.4.3.2 FATTORI DI COMPORTAMENTO",
        },
        blocks: [
            {
                kind: "paragraph",
                page: 228,
                from: 44,
                to: 45,
                math: [m("q", "q")],
            },
            {
                kind: "paragraph",
                page: 228,
                from: 46,
                to: 48,
                math: [m("q", "q")],
            },
            { kind: "paragraph", page: 228, from: 49, to: 50 },
            { kind: "paragraph", page: 228, from: 51, to: 52 },
            {
                kind: "paragraph",
                page: 228,
                from: 53,
                normalized:
                    "Per strutture regolari in pianta, possono essere adottati i seguenti valori di αᵤ/α₁:",
                math: [m("αᵤ/α₁", "\\alpha_u/\\alpha_1")],
            },
            { kind: "list-item", page: 228, from: 54 },
            {
                kind: "list-item",
                page: 228,
                from: 55,
                normalized:
                    "- strutture a telaio di un piano αᵤ/α₁ = 1,1",
                math: [m("αᵤ/α₁ = 1,1", "\\alpha_u/\\alpha_1=1{,}1")],
            },
            {
                kind: "list-item",
                page: 228,
                from: 56,
                normalized:
                    "- strutture a telaio con più piani ed una sola campata αᵤ/α₁ = 1,2",
                math: [m("αᵤ/α₁ = 1,2", "\\alpha_u/\\alpha_1=1{,}2")],
            },
            {
                kind: "list-item",
                page: 228,
                from: 57,
                normalized:
                    "- strutture a telaio con più piani e più campate αᵤ/α₁ = 1,3",
                math: [m("αᵤ/α₁ = 1,3", "\\alpha_u/\\alpha_1=1{,}3")],
            },
            { kind: "list-item", page: 229, from: 3 },
            {
                kind: "list-item",
                page: 229,
                from: 4,
                normalized:
                    "- strutture con solo due pareti non accoppiate per direzione orizzontale αᵤ/α₁ = 1,0",
                math: [m("αᵤ/α₁ = 1,0", "\\alpha_u/\\alpha_1=1{,}0")],
            },
            {
                kind: "list-item",
                page: 229,
                from: 5,
                normalized:
                    "- altre strutture a pareti non accoppiate αᵤ/α₁ = 1,1",
                math: [m("αᵤ/α₁ = 1,1", "\\alpha_u/\\alpha_1=1{,}1")],
            },
            {
                kind: "list-item",
                page: 229,
                from: 6,
                normalized:
                    "- strutture a pareti accoppiate o miste equivalenti a pareti αᵤ/α₁ = 1,2",
                math: [m("αᵤ/α₁ = 1,2", "\\alpha_u/\\alpha_1=1{,}2")],
            },
            {
                kind: "paragraph",
                page: 229,
                from: 7,
                to: 8,
                math: [m("q > 1,5", "q>1{,}5")],
            },
        ],
    },
    {
        number: "7.4.4",
        title:
            "DIMENSIONAMENTO E VERIFICA DEGLI ELEMENTI STRUTTURALI PRIMARI E SECONDARI",
        heading: {
            page: 229,
            from: 9,
            normalized:
                "7.4.4 DIMENSIONAMENTO E VERIFICA DEGLI ELEMENTI STRUTTURALI PRIMARI E SECONDARI",
        },
        blocks: [
            { kind: "paragraph", page: 229, from: 10, to: 11 },
            {
                kind: "paragraph",
                page: 229,
                from: 12,
                to: 13,
                normalized:
                    "I fattori di sovraresistenza γ_Rd da utilizzare nelle singole verifiche, secondo le regole della progettazione in capacità, sono riportati nella Tab. 7.2.I.",
                math: [m("γ_Rd", "\\gamma_{Rd}")],
            },
            { kind: "paragraph", page: 229, from: 14 },
            { kind: "paragraph", page: 229, from: 15 },
            {
                kind: "paragraph",
                page: 229,
                from: 16,
                to: 19,
                normalized:
                    "Per le strutture, o parti di esse, progettate con comportamento strutturale non dissipativo, la capacità delle membrature soggette a flessione o pressoflessione deve essere calcolata, a livello di sezione, al raggiungimento della curvatura di prima plasticizzazione φ_yd di cui al § 7.4.4.1.2.",
                math: [m("φ_yd", "\\phi_{yd}")],
            },
        ],
    },
    {
        number: "7.4.4.1",
        title: "TRAVI",
        heading: { page: 229, from: 20, normalized: "7.4.4.1 TRAVI" },
    },
    {
        number: "7.4.4.1.1",
        title: "Verifiche di resistenza (RES)",
        heading: {
            page: 229,
            from: 21,
            normalized: "7.4.4.1.1 Verifiche di resistenza (RES)",
        },
        blocks: [
            { kind: "paragraph", page: 229, from: 22 },
            { kind: "heading", page: 229, from: 23 },
            { kind: "paragraph", page: 229, from: 24 },
            { kind: "paragraph", page: 229, from: 25, to: 27 },
            {
                kind: "figure-ref",
                page: 229,
                from: 28,
                assetId:
                    "urn:structural-codes:it:asset:figure:ntc2018:7.4.1",
                region: {
                    coordinateSystem: "pdf-points-top-left",
                    x: 185,
                    y: 392,
                    width: 250,
                    height: 148,
                },
            },
            {
                kind: "paragraph",
                page: 229,
                from: 29,
                normalized:
                    "La larghezza collaborante è da assumersi uguale alla larghezza del pilastro b_c (vedi Fig. 7.4.1a) su cui la trave confluisce, più:",
                math: [m("b_c", "b_c")],
            },
            { kind: "list-item", page: 229, from: 30 },
            { kind: "list-item", page: 229, from: 31, to: 32 },
            { kind: "paragraph", page: 229, from: 33 },
            { kind: "heading", page: 229, from: 34 },
            {
                kind: "paragraph",
                page: 229,
                from: 35,
                to: 38,
                normalized:
                    "La domanda a taglio, per ciascuna direzione e ciascun verso di applicazione delle azioni sismiche, si ottiene dalla condizione di equilibrio della trave, considerata incernierata agli estremi, soggetta ai carichi gravitazionali e all’azione della capacità flessionale di progetto nelle due sezioni di plasticizzazione (generalmente quelle di estremità) determinati come indicato in § 4.1.2.3.4 e amplificati del fattore di sovraresistenza γ_Rd di cui alla Tab. 7.2.I.",
                math: [m("γ_Rd", "\\gamma_{Rd}")],
            },
            { kind: "paragraph", page: 229, from: 39, to: 40 },
            { kind: "paragraph", page: 229, from: 41 },
            { kind: "paragraph", page: 230, from: 3 },
            {
                kind: "list-item",
                page: 230,
                from: 4,
                normalized:
                    "- la capacità a taglio si valuta come indicato in § 4.1.2.3, assumendo nelle zone dissipative ctgθ = 1;",
                math: [m("ctgθ = 1", "\\operatorname{ctg}\\theta=1")],
            },
            { kind: "list-item", page: 230, from: 5, to: 6 },
            {
                kind: "formula-ref",
                page: 230,
                from: 7,
                to: 21,
                assetId:
                    "urn:structural-codes:it:asset:formula:ntc2018:7.4.1",
            },
            {
                kind: "paragraph",
                page: 230,
                from: 22,
                to: 25,
                normalized:
                    "dove b_w è la larghezza dell’anima della trave e d è l’altezza utile della sua sezione, allora nel piano verticale di inflessione della trave devono essere disposti due ordini di armature diagonali, l’uno inclinato di +45° e l’altro di -45° rispetto all’asse della trave. In tal caso, la capacità a taglio deve essere affidata per metà alle staffe e per metà ai due ordini di armature inclinate, per le quali deve risultare:",
                math: [
                    m("b_w", "b_w"),
                    m("d", "d"),
                    m("+45°", "+45^\\circ"),
                    m("-45°", "-45^\\circ"),
                ],
            },
            {
                kind: "formula-ref",
                page: 230,
                from: 26,
                to: 31,
                assetId:
                    "urn:structural-codes:it:asset:formula:ntc2018:7.4.2",
            },
            {
                kind: "paragraph",
                page: 230,
                from: 32,
                normalized:
                    "dove A_s è l’area di ciascuno dei due ordini di armature inclinate.",
                math: [m("A_s", "A_s")],
            },
        ],
    },
    {
        number: "7.4.4.1.2",
        title: "Verifiche di duttilità (DUT)",
        heading: {
            page: 230,
            from: 33,
            normalized: "7.4.4.1.2 Verifiche di duttilità (DUT)",
        },
        blocks: [
            { kind: "paragraph", page: 230, from: 34, to: 36 },
            { kind: "paragraph", page: 230, from: 37, to: 39 },
            {
                kind: "paragraph",
                page: 230,
                from: 40,
                to: 42,
                normalized:
                    "La domanda in duttilità di curvatura allo SLC nelle zone dissipative, espressa mediante il fattore di duttilità in curvatura μ_φ, qualora non si proceda ad una determinazione diretta mediante analisi non lineare, può essere valutata in via approssimata come:",
                math: [m("μ_φ", "\\mu_\\phi")],
            },
            {
                kind: "formula-ref",
                page: 230,
                from: 43,
                to: 69,
                assetId:
                    "urn:structural-codes:it:asset:formula:ntc2018:7.4.3",
            },
            {
                kind: "paragraph",
                page: 230,
                from: 70,
                normalized:
                    "dove T_1 è il periodo proprio fondamentale della struttura.",
                math: [m("T_1", "T_1")],
            },
            { kind: "paragraph", page: 230, from: 71 },
            {
                kind: "paragraph",
                page: 230,
                from: 72,
                to: 74,
                normalized:
                    "Tra il fattore di duttilità in spostamento μ_d (v. § 7.3.3.3) e il fattore di duttilità in curvatura μ_φ sussiste la relazione μ_φ = 2μ_d - 1 (usualmente conservativa per le strutture in c.a.), mentre tra il fattore di duttilità in spostamento μ_d e il fattore di comportamento q sussistono le relazioni [7.3.9] (v. § 7.3.3.3).",
                math: [
                    m("μ_φ = 2μ_d - 1", "\\mu_\\phi=2\\mu_d-1"),
                    m("μ_d", "\\mu_d"),
                    m("μ_φ", "\\mu_\\phi"),
                    m("q", "q"),
                ],
            },
        ],
    },
    {
        number: "7.4.4.2",
        title: "PILASTRI",
        heading: { page: 230, from: 75, normalized: "7.4.4.2 PILASTRI" },
    },
    {
        number: "7.4.4.2.1",
        title: "Verifiche di resistenza (RES)",
        heading: {
            page: 230,
            from: 76,
            normalized: "7.4.4.2.1 Verifiche di resistenza (RES)",
        },
        blocks: [
            { kind: "paragraph", page: 230, from: 77 },
            { kind: "heading", page: 230, from: 78 },
            { kind: "paragraph", page: 230, from: 79, to: 80 },
            {
                kind: "paragraph",
                page: 230,
                from: 81,
                to: 84,
                normalized:
                    "Ai fini della progettazione in capacità, per ciascuna direzione e ciascun verso di applicazione delle azioni sismiche, per ogni nodo trave-pilastro (ad eccezione dei nodi in corrispondenza della sommità dei pilastri dell’ultimo orizzontamento), la capacità a flessione complessiva dei pilastri deve essere maggiore della capacità a flessione complessiva delle travi amplificata del coefficiente γ_Rd, in accordo con la formula:",
                math: [m("γ_Rd", "\\gamma_{Rd}")],
            },
            {
                kind: "formula-ref",
                page: 230,
                from: 85,
                assetId:
                    "urn:structural-codes:it:asset:formula:ntc2018:7.4.4",
            },
            { kind: "paragraph", page: 230, from: 86 },
            {
                kind: "paragraph",
                page: 230,
                from: 87,
                normalized:
                    "per il valore di γ_Rd si veda la Tab. 7.2.I;",
                math: [m("γ_Rd", "\\gamma_{Rd}")],
            },
            {
                kind: "paragraph",
                page: 230,
                from: 88,
                to: 89,
                normalized:
                    "M_c,Rd è la capacità a flessione del pilastro convergente nel nodo, calcolata per i livelli di sollecitazione assiale presenti nelle combinazioni sismiche delle azioni;",
                math: [m("M_c,Rd", "M_{c,Rd}")],
            },
            {
                kind: "paragraph",
                page: 230,
                from: 90,
                normalized:
                    "M_b,Rd è la capacità a flessione della trave convergente nel nodo.",
                math: [m("M_b,Rd", "M_{b,Rd}")],
            },
            {
                kind: "figure-ref",
                page: 231,
                from: 3,
                assetId:
                    "urn:structural-codes:it:asset:figure:ntc2018:7.4.2",
                region: {
                    coordinateSystem: "pdf-points-top-left",
                    x: 185,
                    y: 88,
                    width: 265,
                    height: 156,
                },
            },
            { kind: "paragraph", page: 231, from: 4, to: 6 },
            {
                kind: "paragraph",
                page: 231,
                from: 7,
                to: 8,
                normalized:
                    "Per la sezione di base dei pilastri del piano terreno si adotta come domanda a flessione il maggiore tra il momento risultante dall’analisi e la capacità a flessione M_c,Rd della sezione di sommità del pilastro.",
                math: [m("M_c,Rd", "M_{c,Rd}")],
            },
            { kind: "paragraph", page: 231, from: 9, to: 10 },
            {
                kind: "paragraph",
                page: 231,
                from: 11,
                to: 12,
                normalized:
                    "Nel caso in cui si sia adottato il modello elastico incrudente di fig. 4.1.3.a, le capacità a flessione M_c,Rd e M_b,Rd si determinano come specificato nel § 4.1.2.3.4.",
                math: [
                    m("M_c,Rd", "M_{c,Rd}"),
                    m("M_b,Rd", "M_{b,Rd}"),
                ],
            },
            { kind: "heading", page: 231, from: 13 },
            {
                kind: "paragraph",
                page: 231,
                from: 14,
                to: 20,
                normalized:
                    "Ai fini della progettazione in capacità, per ciascuna direzione di applicazione del sisma la domanda a taglio V_Ed si ottiene imponendo l’equilibrio con i momenti delle sezioni di estremità (superiore e inferiore) del pilastro M_i,d^s e M_i,d^i, determinate come appresso indicato ed amplificate del fattore di sovraresistenza γ_Rd, secondo l’espressione:",
                math: [
                    m("V_Ed", "V_{Ed}"),
                    m("M_i,d^s", "M_{i,d}^{s}"),
                    m("M_i,d^i", "M_{i,d}^{i}"),
                    m("γ_Rd", "\\gamma_{Rd}"),
                ],
            },
            {
                kind: "formula-ref",
                page: 231,
                from: 21,
                to: 23,
                assetId:
                    "urn:structural-codes:it:asset:formula:ntc2018:7.4.5",
            },
            { kind: "paragraph", page: 231, from: 24 },
            {
                kind: "paragraph",
                page: 231,
                from: 25,
                normalized:
                    "per il valore di γ_Rd si veda la Tab. 7.2.I;",
                math: [m("γ_Rd", "\\gamma_{Rd}")],
            },
            {
                kind: "formula-ref",
                page: 231,
                from: 26,
                to: 35,
                assetId:
                    "urn:structural-codes:it:asset:formula:ntc2018:7.4.5:mi-d",
            },
            {
                kind: "paragraph",
                page: 231,
                from: 36,
                to: 37,
                normalized:
                    "M_c,Rd è la capacità a flessione nella sezione di estremità (superiore o inferiore);",
                math: [m("M_c,Rd", "M_{c,Rd}")],
            },
            {
                kind: "paragraph",
                page: 231,
                from: 38,
                normalized: "l_p è la lunghezza del pilastro.",
                math: [m("l_p", "l_p")],
            },
            {
                kind: "paragraph",
                page: 231,
                from: 39,
                to: 41,
                normalized:
                    "Nel caso in cui le tamponature non si estendano per l’intera altezza dei pilastri adiacenti, la domanda a taglio da considerare per la parte del pilastro priva di tamponamento è valutata utilizzando la relazione [7.4.5], dove l’altezza l_p è assunta pari all’estensione della parte di pilastro priva di tamponamento.",
                math: [m("l_p", "l_p")],
            },
            { kind: "paragraph", page: 231, from: 42 },
        ],
    },
    {
        number: "7.4.4.2.2",
        title: "Verifiche di duttilità (DUT)",
        heading: {
            page: 231,
            from: 43,
            normalized: "7.4.4.2.2 Verifiche di duttilità (DUT)",
        },
        blocks: [{ kind: "paragraph", page: 231, from: 44 }],
    },
    {
        number: "7.4.4.3",
        title: "NODI TRAVE-PILASTRO",
        heading: {
            page: 231,
            from: 45,
            normalized: "7.4.4.3 NODI TRAVE-PILASTRO",
        },
        blocks: [
            { kind: "paragraph", page: 231, from: 46 },
            { kind: "paragraph", page: 231, from: 47 },
            {
                kind: "list-item",
                page: 231,
                from: 48,
                to: 50,
                normalized:
                    "interamente confinati: quando in ognuna delle quattro facce verticali si innesta una trave; il confinamento si considera realizzato quando, su ogni faccia del nodo, la sezione della trave copre per almeno i 3/4 la larghezza del pilastro e, su entrambe le coppie di facce opposte del nodo, le sezioni delle travi si ricoprono per almeno i 3/4 dell’altezza;",
                math: [m("3/4", "\\frac{3}{4}")],
            },
            {
                kind: "list-item",
                page: 231,
                from: 51,
                normalized:
                    "non interamente confinati: quando non appartenenti alla categoria precedente.",
            },
        ],
    },
    {
        number: "7.4.4.3.1",
        title: "Verifiche di resistenza (RES)",
        heading: {
            page: 232,
            from: 3,
            normalized: "7.4.4.3.1 Verifiche di resistenza (RES)",
        },
        blocks: [
            { kind: "paragraph", page: 232, from: 4, to: 5 },
            { kind: "paragraph", page: 232, from: 6 },
            { kind: "paragraph", page: 232, from: 7, to: 9 },
            {
                kind: "formula-ref",
                page: 232,
                from: 10,
                to: 15,
                assetId:
                    "urn:structural-codes:it:asset:formula:ntc2018:7.4.6",
            },
            {
                kind: "formula-ref",
                page: 232,
                from: 10,
                to: 16,
                assetId:
                    "urn:structural-codes:it:asset:formula:ntc2018:7.4.7",
            },
            {
                kind: "paragraph",
                page: 232,
                from: 17,
                to: 18,
                normalized:
                    "in cui per il valore di γ_Rd si veda la Tab. 7.2.I, A_s1 ed A_s2 sono rispettivamente l’area dell’armatura superiore ed inferiore della trave e V_C è la forza di taglio nel pilastro al di sopra del nodo, derivante dall’analisi in condizioni sismiche.",
                math: [
                    m("γ_Rd", "\\gamma_{Rd}"),
                    m("A_s1", "A_{s1}"),
                    m("A_s2", "A_{s2}"),
                    m("V_C", "V_C"),
                ],
            },
            {
                kind: "paragraph",
                page: 232,
                from: 19,
                to: 20,
                normalized:
                    "Le forze di taglio che agiscono sui nodi devono corrispondere alla più avversa direzione di provenienza dell’azione sismica, la quale si riflette sulla scelta dei valori di A_s1, A_s2 e V_C da utilizzare nelle espressioni [7.4.6] e [7.4.7].",
                math: [
                    m("A_s1", "A_{s1}"),
                    m("A_s2", "A_{s2}"),
                    m("V_C", "V_C"),
                ],
            },
            { kind: "paragraph", page: 232, from: 21, to: 23 },
            { kind: "paragraph", page: 232, from: 24, to: 25 },
            {
                kind: "formula-ref",
                page: 232,
                from: 26,
                to: 29,
                assetId:
                    "urn:structural-codes:it:asset:formula:ntc2018:7.4.8",
            },
            { kind: "paragraph", page: 232, from: 30 },
            {
                kind: "formula-ref",
                page: 232,
                from: 31,
                to: 41,
                assetId:
                    "urn:structural-codes:it:asset:formula:ntc2018:7.4.9",
            },
            {
                kind: "paragraph",
                page: 232,
                from: 42,
                to: 44,
                normalized:
                    "ed α_j è un coefficiente che vale 0,6 per nodi interni e 0,48 per nodi esterni, ν_d è la forza assiale nel pilastro al di sopra del nodo, normalizzata rispetto alla resistenza a compressione della sezione di solo calcestruzzo, h_jc è la distanza tra le giaciture più esterne delle armature del pilastro, b_j è la larghezza effettiva del nodo. Quest’ultima è assunta pari alla minore tra:",
                math: [
                    m("α_j", "\\alpha_j"),
                    m("ν_d", "\\nu_d"),
                    m("h_jc", "h_{jc}"),
                    m("b_j", "b_j"),
                ],
            },
            { kind: "list-item", page: 232, from: 45 },
            { kind: "list-item", page: 232, from: 46, to: 47 },
            {
                kind: "paragraph",
                page: 232,
                from: 48,
                to: 49,
                normalized:
                    "Per evitare che la massima trazione diagonale del calcestruzzo ecceda la f_ctd deve essere previsto un adeguato confinamento. In assenza di modelli più accurati, si possono disporre nel nodo staffe orizzontali di diametro non inferiore a 6 mm, in modo che:",
                math: [m("f_ctd", "f_{ctd}")],
            },
            {
                kind: "formula-ref",
                page: 232,
                from: 50,
                to: 64,
                assetId:
                    "urn:structural-codes:it:asset:formula:ntc2018:7.4.10",
            },
            {
                kind: "paragraph",
                page: 232,
                from: 65,
                to: 66,
                normalized:
                    "in cui i simboli già utilizzati hanno il significato in precedenza illustrato, A_sh è l’area totale della sezione delle staffe e h_jw è la distanza tra le giaciture di armature superiori e inferiori della trave.",
                math: [m("A_sh", "A_{sh}"), m("h_jw", "h_{jw}")],
            },
            { kind: "paragraph", page: 232, from: 67, to: 68 },
            {
                kind: "formula-ref",
                page: 232,
                from: 69,
                assetId:
                    "urn:structural-codes:it:asset:formula:ntc2018:7.4.11",
            },
            {
                kind: "formula-ref",
                page: 232,
                from: 70,
                assetId:
                    "urn:structural-codes:it:asset:formula:ntc2018:7.4.12",
            },
            {
                kind: "paragraph",
                page: 232,
                from: 71,
                to: 72,
                normalized:
                    "dove per il valore di γ_Rd si veda la Tab. 7.2.I, A_s1 ed A_s2 hanno il valore visto in precedenza, ν_d è la forza assiale normalizzata agente al di sopra del nodo, per i nodi interni, al di sotto del nodo, per i nodi esterni.",
                math: [
                    m("γ_Rd", "\\gamma_{Rd}"),
                    m("A_s1", "A_{s1}"),
                    m("A_s2", "A_{s2}"),
                    m("ν_d", "\\nu_d"),
                ],
            },
        ],
    },
    {
        number: "7.4.4.4",
        title: "DIAFRAMMI ORIZZONTALI",
        heading: {
            page: 232,
            from: 73,
            normalized: "7.4.4.4 DIAFRAMMI ORIZZONTALI",
        },
    },
    {
        number: "7.4.4.4.1",
        title: "Verifiche di resistenza (RES)",
        heading: {
            page: 232,
            from: 74,
            normalized: "7.4.4.4.1 Verifiche di resistenza (RES)",
        },
        blocks: [{ kind: "paragraph", page: 232, from: 75 }],
    },
];

const formulaLatex: Record<string, { unit: string; number: string | null; page: number; latex: string }> = {
    "7.4.1": {
        unit: "7.4.4.1.1",
        number: "7.4.1",
        page: 230,
        latex:
            "V_{R1}=\\left(2-\\left|\\frac{V_{Ed,min}}{V_{Ed,max}}\\right|\\right)\\cdot f_{ctd}\\cdot b_w\\cdot d",
    },
    "7.4.2": {
        unit: "7.4.4.1.1",
        number: "7.4.2",
        page: 230,
        latex: "V_{Ed,max}\\le\\frac{A_s\\cdot f_{yd}}{\\sqrt{2}}",
    },
    "7.4.3": {
        unit: "7.4.4.1.2",
        number: "7.4.3",
        page: 230,
        latex:
            "\\mu_\\phi=\\begin{cases}1{,}2\\cdot\\left(2q_0-1\\right)&\\text{per }T_1\\ge T_C\\\\1{,}2\\cdot\\left[1+2\\left(q_0-1\\right)\\dfrac{T_C}{T_1}\\right]&\\text{per }T_1<T_C\\end{cases}",
    },
    "7.4.4": {
        unit: "7.4.4.2.1",
        number: "7.4.4",
        page: 230,
        latex: "\\sum M_{c,Rd}\\ge\\gamma_{Rd}\\cdot\\sum M_{b,Rd}",
    },
    "7.4.5": {
        unit: "7.4.4.2.1",
        number: "7.4.5",
        page: 231,
        latex:
            "V_{Ed}l_p=\\gamma_{Rd}\\left(M_{i,d}^{s}+M_{i,d}^{i}\\right)",
    },
    "7.4.5:mi-d": {
        unit: "7.4.4.2.1",
        number: null,
        page: 231,
        latex:
            "M_{i,d}=M_{c,Rd}\\cdot\\min\\left(1,\\frac{\\sum M_{b,Rd}}{\\sum M_{c,Rd}}\\right)",
    },
    "7.4.6": {
        unit: "7.4.4.3.1",
        number: "7.4.6",
        page: 232,
        latex:
            "V_{jbd}=\\gamma_{Rd}\\cdot\\left(A_{s1}+A_{s2}\\right)\\cdot f_{yd}-V_C\\qquad\\text{per nodi interni}",
    },
    "7.4.7": {
        unit: "7.4.4.3.1",
        number: "7.4.7",
        page: 232,
        latex:
            "V_{jbd}=\\gamma_{Rd}\\cdot A_{s1}\\cdot f_{yd}-V_C\\qquad\\text{per nodi esterni}",
    },
    "7.4.8": {
        unit: "7.4.4.3.1",
        number: "7.4.8",
        page: 232,
        latex:
            "V_{jbd}\\le\\eta\\cdot f_{cd}\\cdot b_j\\cdot h_{jc}\\cdot\\sqrt{1-\\frac{\\nu_d}{\\eta}}",
    },
    "7.4.9": {
        unit: "7.4.4.3.1",
        number: "7.4.9",
        page: 232,
        latex:
            "\\eta=\\alpha_j\\cdot\\left(1-\\frac{f_{ck}}{250}\\right)\\qquad\\text{con }f_{ck}\\text{ espresso in MPa}",
    },
    "7.4.10": {
        unit: "7.4.4.3.1",
        number: "7.4.10",
        page: 232,
        latex:
            "\\frac{A_{sh}\\cdot f_{ywd}}{b_j\\cdot h_{jw}}\\ge\\frac{\\left[V_{jbd}/\\left(b_j\\cdot h_{jc}\\right)\\right]^2}{f_{ctd}+\\nu_d\\cdot f_{cd}}-f_{ctd}",
    },
    "7.4.11": {
        unit: "7.4.4.3.1",
        number: "7.4.11",
        page: 232,
        latex:
            "A_{sh}\\cdot f_{ywd}\\ge\\gamma_{Rd}\\cdot\\left(A_{s1}+A_{s2}\\right)\\cdot f_{yd}\\cdot\\left(1-0{,}8\\nu_d\\right)\\qquad\\text{per nodi interni}",
    },
    "7.4.12": {
        unit: "7.4.4.3.1",
        number: "7.4.12",
        page: 232,
        latex:
            "A_{sh}\\cdot f_{ywd}\\ge\\gamma_{Rd}\\cdot A_{s2}\\cdot f_{yd}\\cdot\\left(1-0{,}8\\nu_d\\right)\\qquad\\text{per nodi esterni}",
    },
};

function idFor(number: string): string {
    return `urn:structural-codes:it:unit:ntc2018:${number}`;
}

function ancestors(number: string): string[] {
    const parts = number.split(".");
    return parts.slice(1).map((_, index) => idFor(parts.slice(0, index + 1).join(".")));
}

function position(number: string): number {
    return Number(number.split(".").at(-1));
}

function sortKey(number: string): string {
    return number
        .split(".")
        .map((part) => part.padStart(3, "0"))
        .join(".");
}

function kind(number: string): string {
    const depth = number.split(".").length;
    if (depth === 1) return "chapter";
    if (depth === 2) return "section";
    if (depth === 3) return "paragraph";
    return "subparagraph";
}

function makeTextBlock(
    unitId: string,
    blockId: string,
    spec: BlockSpec,
): any {
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

function makeAssetBlock(
    unitId: string,
    blockId: string,
    spec: AssetBlockSpec,
): any {
    const source = raw(spec.page, spec.from, spec.to);
    return {
        blockId: `${unitId}#${blockId}`,
        kind: spec.kind,
        origin: "official",
        assetId: spec.assetId,
        evidence: evidence(
            spec.page,
            source,
            source,
            "manual-transcription",
            spec.region ?? null,
        ),
    };
}

const outputDirectory = join(repoRoot, "corpus", "units", "ntc2018");
await mkdir(outputDirectory, { recursive: true });

for (const spec of units) {
    const unitId = idFor(spec.number);
    const headingRaw = raw(spec.heading.page, spec.heading.from);
    const headingNormalized = spec.heading.normalized ?? clean(headingRaw);
    const blocks: any[] = [
        {
            blockId: `${unitId}#block-heading`,
            kind: "heading",
            origin: "official",
            text: {
                raw: headingRaw,
                normalized: headingNormalized,
                normalizationVersion: profile,
            },
            evidence: evidence(
                spec.heading.page,
                headingRaw,
                headingNormalized,
            ),
        },
    ];
    let counter = 1;
    for (const blockSpec of spec.blocks ?? []) {
        const blockId = `block-editorial-${String(counter).padStart(3, "0")}`;
        blocks.push(
            "assetId" in blockSpec
                ? makeAssetBlock(unitId, blockId, blockSpec)
                : makeTextBlock(unitId, blockId, blockSpec),
        );
        counter += 1;
    }
    const formulaIds = blocks
        .filter(({ kind: blockKind }) => blockKind === "formula-ref")
        .map(({ assetId }) => assetId);
    const figureIds = blocks
        .filter(({ kind: blockKind }) => blockKind === "figure-ref")
        .map(({ assetId }) => assetId);
    const parentParts = spec.number.split(".");
    parentParts.pop();
    const record = {
        $schema: "urn:structural-codes:schema:canonical-unit:v2",
        schemaVersion: "2.0.0-alpha.2",
        recordType: "canonical-unit",
        id: unitId,
        workId: "it-mit:dm:2018-01-17:ntc2018",
        expressionId: "it-mit:dm:2018-01-17:ntc2018:original-it",
        kind: kind(spec.number),
        numbering: {
            official: spec.number,
            sortKey: sortKey(spec.number),
        },
        title: spec.title,
        titleBlockId: `${unitId}#block-heading`,
        hierarchy: {
            parentId: idFor(parentParts.join(".")),
            ancestorIds: ancestors(spec.number),
            position: position(spec.number),
        },
        validity: {
            from: "2018-03-22",
            to: null,
            status: "in-force",
            asOf: "2026-07-28",
        },
        blocks,
        citations: [],
        relations: [],
        assets: {
            formulaIds,
            tableIds: [],
            figureIds,
        },
        workflow: {
            status: "extracted",
            createdBy: actor,
            createdAt: "2026-07-28T12:00:00Z",
            reviews: [],
            openIssues: [
                {
                    issueId: `ntc2018-${spec.number.replaceAll(".", "-")}-source-review`,
                    type: "normalization-review",
                    severity: "blocking",
                    note: "Trascrizione confrontata dal modello con il render ufficiale; resta obbligatoria la revisione umana indipendente prima della pubblicazione.",
                },
            ],
        },
    };
    await writeFile(
        join(outputDirectory, `${spec.number}.json`),
        `${JSON.stringify(record, null, 2)}\n`,
        "utf8",
    );
}

const figure741Sha256 = await fileSha256(
    join(repoRoot, "corpus", "assets", "figures", "ntc2018", "fig7.4.1.png"),
);
const figure742Sha256 = await fileSha256(
    join(repoRoot, "corpus", "assets", "figures", "ntc2018", "fig7.4.2.png"),
);

const manifest = {
    $schema: "urn:structural-codes:schema:asset-manifest:v2",
    schemaVersion: "2.0.0-alpha.1",
    recordType: "asset-manifest",
    document: "ntc2018",
    section: "7.4-step1",
    sourceId,
    status: "transcribed-unreviewed",
    formulas: Object.entries(formulaLatex).map(([key, formula]) => ({
        id: `urn:structural-codes:it:asset:formula:ntc2018:${key}`,
        unitId: idFor(formula.unit),
        officialNumber: formula.number,
        pdfPage: formula.page,
        latex: formula.latex,
    })),
    tables: [],
    figures: [
        {
            id: "urn:structural-codes:it:asset:figure:ntc2018:7.4.1",
            unitId: idFor("7.4.4.1.1"),
            officialNumber: "7.4.1",
            pdfPage: 229,
            caption: "Fig. 7.4.1 – Larghezza collaborante delle travi",
            alt: "Schemi della larghezza collaborante delle travi per pilastri esterni e interni, con e senza travi trasversali.",
            imagePath: "figures/ntc2018/fig7.4.1.png",
            region: {
                coordinateSystem: "pdf-points-top-left",
                x: 185,
                y: 392,
                width: 250,
                height: 148,
            },
            sha256: figure741Sha256,
        },
        {
            id: "urn:structural-codes:it:asset:figure:ntc2018:7.4.2",
            unitId: idFor("7.4.4.2.1"),
            officialNumber: "7.4.2",
            pdfPage: 231,
            caption: "Fig. 7.4.2 – Progettazione in capacità dei pilastri",
            alt: "Schemi dei momenti resistenti concordi e discordi nei pilastri e nelle travi concorrenti in un nodo.",
            imagePath: "figures/ntc2018/fig7.4.2.png",
            region: {
                coordinateSystem: "pdf-points-top-left",
                x: 185,
                y: 88,
                width: 265,
                height: 156,
            },
            sha256: figure742Sha256,
        },
    ],
};

await writeFile(
    join(repoRoot, "corpus", "assets", "ntc2018", "7.4-step1.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8",
);

console.log(
    `ntc74-step1: generated ${units.length} units, ${manifest.formulas.length} formulas and ${manifest.figures.length} figure records`,
);
