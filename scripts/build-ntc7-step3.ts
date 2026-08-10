import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { sha256OfText } from "../src/lib/hash.ts";

const root = fileURLToPath(new URL("../", import.meta.url));
const sourceId = "gu-so8-2018-ntc";
const workId = "it-mit:dm:2018-01-17:ntc2018";
const expressionId = "it-mit:dm:2018-01-17:ntc2018:original-it";
const profile = "ntc7-editorial-profile-0.1.0";
const createdAt = "2026-08-10T00:00:00Z";
const unitDir = join(root, "corpus", "units", "ntc2018");
const assetDir = join(root, "corpus", "assets", "ntc2018");

type Region = {
    coordinateSystem: "pdf-points-top-left";
    x: number;
    y: number;
    width: number;
    height: number;
};
type Inline = { kind: "text" | "math"; value: string; latex?: string };
type Part = [page: number, from: number, to: number];

const uid = (number: string) =>
    `urn:structural-codes:it:unit:ntc2018:${number}`;
const fid = (name: string) =>
    `urn:structural-codes:it:asset:formula:ntc2018:${name}`;
const tid = (name: string) =>
    `urn:structural-codes:it:asset:table:ntc2018:${name}`;
const reg = (x: number, y: number, width: number, height: number): Region => ({
    coordinateSystem: "pdf-points-top-left",
    x,
    y,
    width,
    height,
});

const pageLines = new Map<number, string[]>();
for (const page of [224, 225, 226, 227]) {
    const file = join(
        root,
        "evidence",
        sourceId,
        "pages",
        `page-${String(page).padStart(4, "0")}.raw.txt`,
    );
    pageLines.set(
        page,
        (await readFile(file, "utf8")).replace(/\r\n/gu, "\n").split("\n"),
    );
}

function rawPart(page: number, from: number, to: number): string {
    const lines = pageLines.get(page);
    if (!lines) throw new Error(`Evidence mancante per pagina ${page}`);
    return lines.slice(from - 1, to).join("\n");
}

function raw(parts: Part[]): string {
    return parts.map(([page, from, to]) => rawPart(page, from, to)).join("\n");
}

function transformations(source: string, normalized: string, manual = false) {
    if (source === normalized) return [];
    const result: Array<{
        operation: string;
        ruleVersion: string;
        note: string;
    }> = [];
    if (source.includes("\n")) {
        result.push({
            operation: "join-line-wrap",
            ruleVersion: profile,
            note: "Ricomposti i ritorni a capo tipografici verificati sul render ufficiale.",
        });
    }
    if (manual || /[\u0000-\u001f\u007f-\u009f΅ȭ·Ε]/u.test(source)) {
        result.push({
            operation: "manual-correction",
            ruleVersion: profile,
            note: "Ripristinati numerazione, glifi, simboli e matematica confrontati con il render ufficiale.",
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

function textInline(value: string): Inline[] {
    return [{ kind: "text", value }];
}

function inlineTerms(value: string, terms: Array<[string, string]>): Inline[] {
    const ordered = [...terms]
        .filter(([term]) => value.includes(term))
        .sort((left, right) => right[0].length - left[0].length);
    const result: Inline[] = [];
    let cursor = 0;
    while (cursor < value.length) {
        let found: { index: number; value: string; latex: string } | undefined;
        for (const [term, latex] of ordered) {
            let index = value.indexOf(term, cursor);
            while (index >= 0 && term.length === 1) {
                const before = index > 0 ? value[index - 1] ?? "" : "";
                const after = value[index + 1] ?? "";
                if (!/[\p{L}\p{N}_]/u.test(before) && !/[\p{L}\p{N}_]/u.test(after)) break;
                index = value.indexOf(term, index + term.length);
            }
            if (
                index >= 0 &&
                (!found ||
                    index < found.index ||
                    (index === found.index && term.length > found.value.length))
            ) {
                found = { index, value: term, latex };
            }
        }
        if (!found) {
            result.push({ kind: "text", value: value.slice(cursor) });
            break;
        }
        if (found.index > cursor) {
            result.push({ kind: "text", value: value.slice(cursor, found.index) });
        }
        result.push({ kind: "math", value: found.value, latex: found.latex });
        cursor = found.index + found.value.length;
    }
    return result.filter(({ value }) => value.length > 0);
}

function lineRegion(page: number, from: number, to: number): Region {
    const y = Math.max(70, 65 + from * 10.35);
    const height = Math.max(8, (to - from + 1) * 10.35);
    return reg(82.954, y, 428.6, height);
}

function evidence(
    page: number,
    source: string,
    normalized: string,
    region: Region | null,
    manual = false,
) {
    return {
        sourceId,
        pdfPage: page,
        printedPage: String(page - 4),
        region,
        extraction: {
            method: manual ? "manual-transcription" : "pdf-text",
            tool: manual ? "codex-source-transcription" : "pdfjs-dist",
            toolVersion: manual ? profile : "4.10.38",
        },
        transformations: transformations(source, normalized, manual),
        rawSha256: sha256OfText(source),
        normalizedSha256: sha256OfText(normalized),
    };
}

function block(
    number: string,
    suffix: string,
    kind: "heading" | "paragraph" | "list-item",
    parts: Part[],
    normalized: string,
    options: { manual?: boolean; inline?: Inline[] } = {},
) {
    const source = raw(parts);
    const first = parts[0]!;
    return {
        blockId: `${uid(number)}#block-${suffix}`,
        kind,
        origin: "official",
        text: {
            raw: source,
            normalized,
            normalizationVersion: profile,
            inline: options.inline ?? textInline(normalized),
        },
        evidence: evidence(
            first[0],
            source,
            normalized,
            lineRegion(first[0], first[1], first[2]),
            options.manual,
        ),
    };
}

function heading(number: string, suffix: string, parts: Part[], normalized: string) {
    return block(number, suffix, "heading", parts, normalized, { manual: true });
}

function formulaBlock(number: string, suffix: string, page: number, officialNumber: string, region: Region) {
    const label = `[${officialNumber}]`;
    return {
        blockId: `${uid(number)}#block-formula-${suffix.replaceAll(".", "-")}`,
        kind: "formula-ref",
        origin: "official",
        assetId: fid(suffix),
        evidence: evidence(page, label, label, region, true),
    };
}

function tableBlock(number: string, suffix: string, page: number, asset: string, region: Region) {
    const label = `Tabella ${suffix}`;
    return {
        blockId: `${uid(number)}#block-table-${suffix.replaceAll(".", "-").toLowerCase()}`,
        kind: "table-ref",
        origin: "official",
        assetId: asset,
        evidence: evidence(page, label, label, region, true),
    };
}

function cell(text: string, latex?: string, extra: Record<string, number> = {}) {
    return { text, ...(latex ? { latex } : {}), ...extra };
}

function parent(number: string): string | null {
    const parts = number.split(".");
    return parts.length === 1 ? null : uid(parts.slice(0, -1).join("."));
}

function ancestors(number: string): string[] {
    const parts = number.split(".");
    return parts.slice(1).map((_, index) => uid(parts.slice(0, index + 1).join(".")));
}

function makeUnit(number: string, title: string, blocks: unknown[], formulas: string[] = [], tables: string[] = []) {
    const issuePrefix = `ntc2018-${number.replaceAll(".", "-")}`;
    return {
        $schema: "urn:structural-codes:schema:canonical-unit:v2",
        schemaVersion: "2.0.0-alpha.2",
        recordType: "canonical-unit",
        id: uid(number),
        workId,
        expressionId,
        kind: "subparagraph",
        numbering: {
            official: number,
            sortKey: number.split(".").map((part) => part.padStart(3, "0")).join("."),
        },
        title,
        titleBlockId: `${uid(number)}#block-heading`,
        hierarchy: {
            parentId: parent(number),
            ancestorIds: ancestors(number),
            position: Number(number.split(".").at(-1)),
        },
        validity: { from: "2018-03-22", to: null, status: "in-force", asOf: "2026-08-10" },
        blocks,
        citations: [],
        relations: [],
        assets: {
            formulaIds: formulas.map(fid),
            tableIds: tables.map(tid),
            figureIds: [],
        },
        workflow: {
            status: "extracted",
            createdBy: { actorId: "generator:ntc7:step3", kind: "script", toolVersion: profile },
            createdAt,
            reviews: [],
            openIssues: [
                {
                    issueId: `${issuePrefix}-source-review`,
                    type: "normalization-review",
                    severity: "blocking",
                    note: "Record trascritto dall’evidence ufficiale ma non ancora confrontato integralmente da un revisore umano con il render della fonte.",
                },
                ...tables.map((table) => ({
                    issueId: `${issuePrefix}-${table}-review`,
                    type: "asset-review",
                    severity: "blocking",
                    note: "La tabella è strutturata dal render ufficiale e richiede verifica umana cella per cella.",
                })),
            ],
        },
    };
}

const table73iii = {
    id: tid("7.3.iii"),
    unitId: uid("7.3.6"),
    officialNumber: "7.3.III",
    pdfPage: 225,
    caption: "Stati limite di elementi strutturali primari, elementi non strutturali e impianti",
    columnCount: 9,
    headers: [
        [cell("STATI LIMITE", undefined, { colSpan: 2, rowSpan: 2 }), cell("CU I"), cell("CU II", undefined, { colSpan: 3 }), cell("CU III e IV", undefined, { colSpan: 3 })],
        [cell("ST"), cell("ST"), cell("NS"), cell("IM"), cell("ST"), cell("NS"), cell("IM(*)")],
    ],
    rows: [
        [cell("SLE", undefined, { rowSpan: 2 }), cell("SLO"), cell(""), cell(""), cell(""), cell(""), cell("RIG"), cell(""), cell("FUN")],
        [cell("SLD"), cell("RIG"), cell("RIG"), cell(""), cell(""), cell("RES"), cell(""), cell("")],
        [cell("SLU", undefined, { rowSpan: 2 }), cell("SLV"), cell("RES"), cell("RES"), cell("STA"), cell("STA"), cell("RES"), cell("STA"), cell("STA")],
        [cell("SLC"), cell(""), cell("DUT(**)"), cell(""), cell(""), cell("DUT(**)"), cell(""), cell("")],
    ],
    notes: [
        "(*) Per le sole CU III e IV, nella categoria Impianti ricadono anche gli arredi fissi.",
        "(**) Nei casi esplicitamente indicati dalle presenti norme.",
    ],
};

const fResponse = "7.3.5-7.3.10";
const fDrFragile = "7.3.6.1-7.3.11a";
const fDrDuctile = "7.3.6.1-7.3.11b";
const fDrRelative = "7.3.6.1-7.3.12";
const fDrMasonry = "7.3.6.1-7.3.13";
const fDrReinforced = "7.3.6.1-7.3.14";
const fDrConfined = "7.3.6.1-7.3.15";

const units = [
    makeUnit("7.3.4", "ANALISI NON LINEARE DINAMICA O STATICA", [
        heading("7.3.4", "heading", [[224, 5, 5]], "7.3.4 ANALISI NON LINEARE DINAMICA O STATICA"),
        block("7.3.4", "p1", "paragraph", [[224, 6, 6]], "L’analisi non lineare, dinamica o statica, si può utilizzare, tra gli altri, per gli scopi e nei casi seguenti:", { manual: true }),
        block("7.3.4", "li1", "list-item", [[224, 7, 7]], "- valutare gli spostamenti relativi allo SL di interesse;", { manual: true, inline: inlineTerms("- valutare gli spostamenti relativi allo SL di interesse;", [["SL", "\\mathrm{SL}"]]) }),
        block("7.3.4", "li2", "list-item", [[224, 8, 8]], "- eseguire le verifiche di duttilità relative allo SLC;", { manual: true, inline: inlineTerms("- eseguire le verifiche di duttilità relative allo SLC;", [["SLC", "\\mathrm{SLC}"]]) }),
        block("7.3.4", "li3", "list-item", [[224, 9, 9]], "- individuare la distribuzione della domanda inelastica nelle costruzioni progettate con il fattore di comportamento q;", { manual: true, inline: inlineTerms("- individuare la distribuzione della domanda inelastica nelle costruzioni progettate con il fattore di comportamento q;", [["q", "q"]]) }),
        block("7.3.4", "li4", "list-item", [[224, 10, 10]], "- valutare i rapporti di sovraresistenza α_u/α_1 di cui ai §§ 7.4.3.2, 7.4.5.1, 7.5.2.2, 7.6.2.2, 7.7.3, 7.8.1.3 e 7.9.2.1;", { manual: true, inline: inlineTerms("- valutare i rapporti di sovraresistenza α_u/α_1 di cui ai §§ 7.4.3.2, 7.4.5.1, 7.5.2.2, 7.6.2.2, 7.7.3, 7.8.1.3 e 7.9.2.1;", [["α_u/α_1", "\\alpha_u/\\alpha_1"]]) }),
        block("7.3.4", "li5", "list-item", [[224, 11, 11]], "- come metodo di progetto per gli edifici di nuova costruzione, in alternativa ai metodi di analisi lineare;", { manual: true }),
        block("7.3.4", "li6", "list-item", [[224, 12, 12]], "- come metodo per la valutazione della capacità di edifici esistenti.", { manual: true }),
    ]),
    makeUnit("7.3.4.1", "ANALISI NON LINEARE DINAMICA", [
        heading("7.3.4.1", "heading", [[224, 13, 13]], "7.3.4.1 ANALISI NON LINEARE DINAMICA"),
        block("7.3.4.1", "p1", "paragraph", [[224, 14, 18]], "L’analisi non lineare dinamica consiste nel calcolo della risposta sismica della struttura mediante integrazione delle equazioni del moto, utilizzando un modello non lineare della struttura e le storie temporali del moto del terreno definite al § 3.2.3.6. Essa ha lo scopo di valutare il comportamento dinamico della struttura in campo non lineare, consentendo il confronto tra duttilità richiesta e duttilità disponibile allo SLC e le relative verifiche, nonché di verificare l’integrità degli elementi strutturali nei confronti di possibili comportamenti fragili.", { manual: true, inline: inlineTerms("L’analisi non lineare dinamica consiste nel calcolo della risposta sismica della struttura mediante integrazione delle equazioni del moto, utilizzando un modello non lineare della struttura e le storie temporali del moto del terreno definite al § 3.2.3.6. Essa ha lo scopo di valutare il comportamento dinamico della struttura in campo non lineare, consentendo il confronto tra duttilità richiesta e duttilità disponibile allo SLC e le relative verifiche, nonché di verificare l’integrità degli elementi strutturali nei confronti di possibili comportamenti fragili.", [["SLC", "\\mathrm{SLC}"]]) }),
        block("7.3.4.1", "p2", "paragraph", [[224, 19, 20]], "L’analisi non lineare dinamica deve essere confrontata con un’analisi modale con spettro di risposta di progetto, al fine di controllare le differenze in termini di sollecitazioni globali alla base della struttura.", { manual: true }),
        block("7.3.4.1", "p3", "paragraph", [[224, 21, 24]], "Nel caso delle costruzioni con isolamento alla base l’analisi dinamica non lineare è obbligatoria quando il sistema d’isolamento non può essere rappresentato da un modello lineare equivalente, come stabilito nel § 7.10.5.2. Gli effetti torsionali sul sistema d’isolamento sono valutati come precisato nel § 7.10.5.3.1, adottando valori delle rigidezze equivalenti coerenti con gli spostamenti risultanti dall’analisi. In proposito si può fare riferimento a documenti di comprovata validità.", { manual: true }),
    ]),
    makeUnit("7.3.4.2", "ANALISI NON LINEARE STATICA", [
        heading("7.3.4.2", "heading", [[224, 25, 25]], "7.3.4.2 ANALISI NON LINEARE STATICA"),
        block("7.3.4.2", "p1", "paragraph", [[224, 26, 26]], "L’analisi non lineare statica richiede che al sistema strutturale reale sia associato un sistema strutturale equivalente non lineare.", { manual: true }),
        block("7.3.4.2", "p2", "paragraph", [[224, 27, 35]], "Nel caso in cui il sistema equivalente sia ad un grado di libertà, a detto sistema strutturale equivalente si applicano i carichi gravitazionali e, per la direzione considerata dell’azione sismica, in corrispondenza degli orizzontamenti della costruzione, forze orizzontali proporzionali alle forza d’inerzia aventi risultante (taglio alla base) F_b. Tali forze sono scalate in modo da far crescere monotonamente, sia in direzione positiva che negativa e fino al raggiungimento delle condizioni di collasso locale o globale, lo spostamento orizzontale d_c di un punto di controllo coincidente con il centro di massa dell’ultimo livello della costruzione (sono esclusi eventuali torrini). Vanno considerati anche punti di controllo alternativi, come le estremità della pianta dell’ultimo livello, quando sia significativo l’accoppiamento di traslazioni e rotazioni.", { manual: true, inline: inlineTerms("Nel caso in cui il sistema equivalente sia ad un grado di libertà, a detto sistema strutturale equivalente si applicano i carichi gravitazionali e, per la direzione considerata dell’azione sismica, in corrispondenza degli orizzontamenti della costruzione, forze orizzontali proporzionali alle forza d’inerzia aventi risultante (taglio alla base) F_b. Tali forze sono scalate in modo da far crescere monotonamente, sia in direzione positiva che negativa e fino al raggiungimento delle condizioni di collasso locale o globale, lo spostamento orizzontale d_c di un punto di controllo coincidente con il centro di massa dell’ultimo livello della costruzione (sono esclusi eventuali torrini). Vanno considerati anche punti di controllo alternativi, come le estremità della pianta dell’ultimo livello, quando sia significativo l’accoppiamento di traslazioni e rotazioni.", [["F_b", "F_b"], ["d_c", "d_c"]]) }),
        block("7.3.4.2", "p3", "paragraph", [[224, 36, 37]], "Il diagramma F_b – d_c rappresenta la curva di capacità della struttura.", { manual: true, inline: inlineTerms("Il diagramma F_b – d_c rappresenta la curva di capacità della struttura.", [["F_b – d_c", "F_b-d_c"]]) }),
        block("7.3.4.2", "p4", "paragraph", [[224, 38, 39]], "Si devono considerare almeno due distribuzioni di forze d’inerzia, ricadenti l’una nelle distribuzioni principali (Gruppo 1) e l’altra nelle distribuzioni secondarie (Gruppo 2) appresso illustrate.", { manual: true }),
        heading("7.3.4.2", "heading-group1", [[224, 40, 40]], "Gruppo 1 - Distribuzioni principali:"),
        block("7.3.4.2", "li1", "list-item", [[224, 41, 42]], "- se il modo di vibrare fondamentale nella direzione considerata ha una partecipazione di massa non inferiore al 75% si applica una delle due distribuzioni seguenti:", { manual: true, inline: inlineTerms("- se il modo di vibrare fondamentale nella direzione considerata ha una partecipazione di massa non inferiore al 75% si applica una delle due distribuzioni seguenti:", [["75%", "75\\%"]]) }),
        block("7.3.4.2", "li1a", "list-item", [[224, 43, 44]], "distribuzione proporzionale alle forze statiche di cui al § 7.3.3.2, utilizzando come seconda distribuzione la a) del Gruppo 2,", { manual: true }),
        block("7.3.4.2", "li1b", "list-item", [[224, 45, 46]], "distribuzione corrispondente a un andamento di accelerazioni proporzionale alla forma del modo fondamentale di vibrare nella direzione considerata;", { manual: true }),
        block("7.3.4.2", "li2", "list-item", [[224, 47, 50]], "- in tutti i casi può essere utilizzata la distribuzione corrispondente all’andamento delle forze di piano agenti su ciascun orizzontamento calcolate in un’analisi dinamica lineare, includendo nella direzione considerata un numero di modi con partecipazione di massa complessiva non inferiore allo 85%. L’utilizzo di questa distribuzione è obbligatorio se il periodo fondamentale della struttura è superiore a 1,3 T_C.", { manual: true, inline: inlineTerms("- in tutti i casi può essere utilizzata la distribuzione corrispondente all’andamento delle forze di piano agenti su ciascun orizzontamento calcolate in un’analisi dinamica lineare, includendo nella direzione considerata un numero di modi con partecipazione di massa complessiva non inferiore allo 85%. L’utilizzo di questa distribuzione è obbligatorio se il periodo fondamentale della struttura è superiore a 1,3 T_C.", [["85%", "85\\%"], ["1,3 T_C", "1{,}3T_C"]]) }),
        heading("7.3.4.2", "heading-group2", [[224, 51, 51]], "Gruppo 2 - Distribuzioni secondarie:"),
        block("7.3.4.2", "li2a", "list-item", [[224, 52, 52]], "a) distribuzione di forze, desunta da un andamento uniforme di accelerazioni lungo l’altezza della costruzione;", { manual: true }),
        block("7.3.4.2", "li2b", "list-item", [[224, 53, 54]], "b) distribuzione adattiva, che cambia al crescere dello spostamento del punto di controllo in funzione della plasticizzazione della struttura;", { manual: true }),
        block("7.3.4.2", "li2c", "list-item", [[224, 55, 55]], "c) distribuzione multimodale, considerando almeno sei modi significativi.", { manual: true }),
    ]),
    makeUnit("7.3.5", "RISPOSTA ALLE DIVERSE COMPONENTI DELL’AZIONE SISMICA ED ALLA VARIABILITÀ SPAZIALE DEL MOTO", [
        heading("7.3.5", "heading", [[225, 3, 3]], "7.3.5 RISPOSTA ALLE DIVERSE COMPONENTI DELL’AZIONE SISMICA ED ALLA VARIABILITÀ SPAZIALE DEL MOTO"),
        heading("7.3.5", "heading-analysis", [[225, 4, 4]], "ANALISI DINAMICA O STATICA, LINEARE O NON LINEARE"),
        block("7.3.5", "p1", "paragraph", [[225, 5, 5]], "La risposta è calcolata unitariamente per le tre componenti, applicando l’espressione:", { manual: true }),
        formulaBlock("7.3.5", fResponse, 225, "7.3.10", reg(165, 122, 280, 38)),
        block("7.3.5", "p2", "paragraph", [[225, 7, 8]], "Gli effetti più gravosi si ricavano dal confronto tra le tre combinazioni ottenute permutando circolarmente i coefficienti moltiplicativi.", { manual: true }),
        block("7.3.5", "p3", "paragraph", [[225, 9, 9]], "In ogni caso:", { manual: true }),
        block("7.3.5", "li1", "list-item", [[225, 10, 10]], "- la componente verticale deve essere tenuta in conto unicamente nei casi previsti al § 7.2.2.", { manual: true }),
        block("7.3.5", "li2", "list-item", [[225, 11, 13]], "- la risposta deve essere combinata con gli effetti pseudo-statici indotti dagli spostamenti relativi prodotti dalla variabilità spaziale del moto unicamente nei casi previsti al § 3.2.4.1, utilizzando, salvo per quanto indicato al § 7.2.2 in merito agli appoggi mobili, la radice quadrata della somma dei quadrati (SRSS).", { manual: true }),
        heading("7.3.5", "heading-step", [[225, 14, 14]], "ANALISI DINAMICA, LINEARE O NON LINEARE, CON INTEGRAZIONE AL PASSO"),
        block("7.3.5", "p4", "paragraph", [[225, 15, 18]], "La risposta è valutata applicando simultaneamente le due componenti orizzontali della storia temporale del moto del terreno (e quella verticale, ove necessario). Si devono adottare almeno 3 storie temporali; si valutano gli effetti sulla struttura utilizzando i valori più sfavorevoli. Impiegando invece almeno 7 diverse storie temporali, gli effetti sulla struttura sono rappresentati dalla media dei valori più sfavorevoli.", { manual: true }),
        block("7.3.5", "p5", "paragraph", [[225, 19, 22]], "Nel caso in cui sia necessario valutare gli effetti della variabilità spaziale del moto, l’analisi può essere eseguita imponendo alla base della costruzione storie temporali del moto del terreno differenziate, ma coerenti tra loro e generate in accordo con lo spettro di risposta appropriato per ciascun vincolo. In alternativa, si potranno eseguire analisi dinamiche con moto sincrono tenendo in dovuto conto gli effetti pseudo-statici di cui al § 3.2.4.", { manual: true }),
    ], [fResponse]),
    makeUnit("7.3.6", "RISPETTO DEI REQUISITI NEI CONFRONTI DEGLI STATI LIMITE", [
        heading("7.3.6", "heading", [[225, 23, 23]], "7.3.6 RISPETTO DEI REQUISITI NEI CONFRONTI DEGLI STATI LIMITE"),
        block("7.3.6", "p1", "paragraph", [[225, 24, 26]], "Per tutti gli elementi strutturali primari e secondari, gli elementi non strutturali e gli impianti si deve verificare che il valore di ciascuna domanda di progetto, definito dalla tabella 7.3.III per ciascuno degli stati limite richiesti, sia inferiore al corrispondente valore della capacità di progetto.", { manual: true }),
        block("7.3.6", "p2", "paragraph", [[225, 27, 28]], "Le verifiche degli elementi strutturali primari (ST) si eseguono, come sintetizzato nella tabella 7.3.III, in dipendenza della Classe d’Uso (CU):", { manual: true }),
        block("7.3.6", "li1", "list-item", [[225, 29, 30]], "- nel caso di comportamento strutturale non dissipativo, in termini di rigidezza (RIG) e di resistenza (RES), senza applicare le regole specifiche dei dettagli costruttivi e della progettazione in capacità;", { manual: true }),
        block("7.3.6", "li2", "list-item", [[225, 31, 32]], "- nel caso di comportamento strutturale dissipativo, in termini di rigidezza (RIG), di resistenza (RES) e di duttilità (DUT) (quando richiesto), applicando le regole specifiche dei dettagli costruttivi e della progettazione in capacità.", { manual: true }),
        block("7.3.6", "p3", "paragraph", [[225, 33, 33]], "Le verifiche degli elementi strutturali secondari si effettuano solo in termini di duttilità.", { manual: true }),
        block("7.3.6", "p4", "paragraph", [[225, 34, 35]], "Le verifiche degli elementi non strutturali (NS) e degli impianti (IM) si effettuano in termini di funzionamento (FUN) e stabilità (STA), come sintetizzato nella tabella 7.3.III, in dipendenza della Classe d’Uso (CU).", { manual: true }),
        tableBlock("7.3.6", "7.3.III", 225, table73iii.id, reg(78, 490, 440, 165)),
        block("7.3.6", "p5", "paragraph", [[225, 48, 49]], "Le verifiche allo stato limite di prevenzione del collasso (SLC), a meno di specifiche indicazioni, si svolgono soltanto in termini di duttilità e solo qualora le verifiche in duttilità siano espressamente richieste (v. § 7.3.6.1)", { manual: true, inline: inlineTerms("Le verifiche allo stato limite di prevenzione del collasso (SLC), a meno di specifiche indicazioni, si svolgono soltanto in termini di duttilità e solo qualora le verifiche in duttilità siano espressamente richieste (v. § 7.3.6.1)", [["SLC", "\\mathrm{SLC}"]]) }),
    ], [], ["7.3.iii"]),
    makeUnit("7.3.6.1", "ELEMENTI STRUTTURALI (ST)", [
        heading("7.3.6.1", "heading", [[225, 50, 50]], "7.3.6.1 ELEMENTI STRUTTURALI (ST)"),
        heading("7.3.6.1", "heading-rig", [[225, 51, 51]], "VERIFICHE DI RIGIDEZZA (RIG)"),
        block("7.3.6.1", "p1", "paragraph", [[225, 52, 53]], "La condizione in termini di rigidezza sulla struttura si ritiene soddisfatta qualora la conseguente deformazione degli elementi strutturali non produca sugli elementi non strutturali danni tali da rendere la costruzione temporaneamente inagibile.", { manual: true }),
        block("7.3.6.1", "p2", "paragraph", [[225, 54, 56]], "Nel caso delle costruzioni civili e industriali, qualora la temporanea inagibilità sia dovuta a spostamenti di interpiano eccessivi, questa condizione si può ritenere soddisfatta quando gli spostamenti di interpiano ottenuti dall’analisi in presenza dell’azione sismica di progetto corrispondente allo SL e alla CU considerati siano inferiori ai limiti indicati nel seguito.", { manual: true, inline: inlineTerms("Nel caso delle costruzioni civili e industriali, qualora la temporanea inagibilità sia dovuta a spostamenti di interpiano eccessivi, questa condizione si può ritenere soddisfatta quando gli spostamenti di interpiano ottenuti dall’analisi in presenza dell’azione sismica di progetto corrispondente allo SL e alla CU considerati siano inferiori ai limiti indicati nel seguito.", [["SL", "\\mathrm{SL}"], ["CU", "\\mathrm{CU}"]]) }),
        block("7.3.6.1", "p3", "paragraph", [[226, 3, 3]], "Per le CU I e II ci si riferisce allo SLD (v. Tab. 7.3.III) e deve essere:", { manual: true, inline: inlineTerms("Per le CU I e II ci si riferisce allo SLD (v. Tab. 7.3.III) e deve essere:", [["CU", "\\mathrm{CU}"], ["SLD", "\\mathrm{SLD}"]]) }),
        block("7.3.6.1", "li-a", "list-item", [[226, 4, 4]], "a) per tamponature collegate rigidamente alla struttura, che interferiscono con la deformabilità della stessa:", { manual: true }),
        formulaBlock("7.3.6.1", fDrFragile, 226, "7.3.11a", reg(145, 112, 330, 35)),
        formulaBlock("7.3.6.1", fDrDuctile, 226, "7.3.11b", reg(145, 150, 330, 35)),
        block("7.3.6.1", "li-b", "list-item", [[226, 7, 8]], "b) per tamponature progettate in modo da non subire danni a seguito di spostamenti d’interpiano d_{rp}, per effetto della loro deformabilità intrinseca oppure dei collegamenti alla struttura:", { manual: true, inline: inlineTerms("b) per tamponature progettate in modo da non subire danni a seguito di spostamenti d’interpiano d_{rp}, per effetto della loro deformabilità intrinseca oppure dei collegamenti alla struttura:", [["d_{rp}", "d_{rp}"]]) }),
        formulaBlock("7.3.6.1", fDrRelative, 226, "7.3.12", reg(175, 230, 300, 35)),
        block("7.3.6.1", "li-c", "list-item", [[226, 10, 10]], "c) per costruzioni con struttura portante di muratura ordinaria", { manual: true }),
        formulaBlock("7.3.6.1", fDrMasonry, 226, "7.3.13", reg(180, 300, 280, 35)),
        block("7.3.6.1", "li-d", "list-item", [[226, 12, 12]], "d) per costruzioni con struttura portante di muratura armata", { manual: true }),
        formulaBlock("7.3.6.1", fDrReinforced, 226, "7.3.14", reg(180, 365, 280, 35)),
        block("7.3.6.1", "li-e", "list-item", [[226, 14, 14]], "e) per costruzioni con struttura portante di muratura confinata", { manual: true }),
        formulaBlock("7.3.6.1", fDrConfined, 226, "7.3.15", reg(180, 430, 280, 35)),
        block("7.3.6.1", "p4", "paragraph", [[226, 16, 16]], "dove:", { manual: true }),
        block("7.3.6.1", "p5", "paragraph", [[226, 17, 20]], "d_r è lo spostamento di interpiano, cioè la differenza tra gli spostamenti del solaio superiore e del solaio inferiore, calcolati, nel caso di analisi lineare, secondo il § 7.3.3.3 o, nel caso di analisi non lineare, secondo il § 7.3.4, sul modello di calcolo non comprensivo delle tamponature,", { manual: true, inline: inlineTerms("d_r è lo spostamento di interpiano, cioè la differenza tra gli spostamenti del solaio superiore e del solaio inferiore, calcolati, nel caso di analisi lineare, secondo il § 7.3.3.3 o, nel caso di analisi non lineare, secondo il § 7.3.4, sul modello di calcolo non comprensivo delle tamponature,", [["d_r", "d_r"]]) }),
        block("7.3.6.1", "p6", "paragraph", [[226, 21, 21]], "h è l’altezza del piano.", { manual: true, inline: inlineTerms("h è l’altezza del piano.", [["h", "h"]]) }),
        block("7.3.6.1", "p7", "paragraph", [[226, 22, 23]], "Per le CU III e IV ci si riferisce allo SLO (v. Tab. 7.3.III) e gli spostamenti d’interpiano devono essere inferiori ai 2/3 dei limiti in precedenza indicati.", { manual: true, inline: inlineTerms("Per le CU III e IV ci si riferisce allo SLO (v. Tab. 7.3.III) e gli spostamenti d’interpiano devono essere inferiori ai 2/3 dei limiti in precedenza indicati.", [["CU", "\\mathrm{CU}"], ["SLO", "\\mathrm{SLO}"]]) }),
        block("7.3.6.1", "p8", "paragraph", [[226, 24, 27]], "In caso di coesistenza di diversi tipi di tamponamento o struttura portante nel medesimo piano della costruzione, deve essere assunto il limite di spostamento più restrittivo. Qualora gli spostamenti di interpiano siano superiori a 0,005 h (caso b), le verifiche della capacità di spostamento degli elementi non strutturali vanno estese a tutte le tamponature, alle tramezzature interne ed agli impianti.", { manual: true, inline: inlineTerms("In caso di coesistenza di diversi tipi di tamponamento o struttura portante nel medesimo piano della costruzione, deve essere assunto il limite di spostamento più restrittivo. Qualora gli spostamenti di interpiano siano superiori a 0,005 h (caso b), le verifiche della capacità di spostamento degli elementi non strutturali vanno estese a tutte le tamponature, alle tramezzature interne ed agli impianti.", [["h", "h"]]) }),
        heading("7.3.6.1", "heading-res", [[226, 28, 28]], "VERIFICHE DI RESISTENZA (RES)"),
        block("7.3.6.1", "p9", "paragraph", [[226, 29, 30]], "Si deve verificare che i singoli elementi strutturali e la struttura nel suo insieme possiedano una capacità in resistenza sufficiente a soddisfare la domanda allo SLV.", { manual: true, inline: inlineTerms("Si deve verificare che i singoli elementi strutturali e la struttura nel suo insieme possiedano una capacità in resistenza sufficiente a soddisfare la domanda allo SLV.", [["SLV", "\\mathrm{SLV}"]]) }),
        block("7.3.6.1", "p10", "paragraph", [[226, 31, 32]], "La capacità in resistenza delle membrature e dei collegamenti è valutata in accordo con le regole contenute nei capitoli precedenti, integrate dalle regole di progettazione definite di volta in volta nei successivi paragrafi.", { manual: true }),
        block("7.3.6.1", "p11", "paragraph", [[226, 33, 34]], "Per le strutture a comportamento dissipativo, la capacità delle membrature è calcolata con riferimento al loro comportamento ultimo, come definito di volta in volta nei successivi paragrafi.", { manual: true }),
        block("7.3.6.1", "p12", "paragraph", [[226, 35, 36]], "Per le strutture a comportamento non dissipativo, la capacità delle membrature è calcolata con riferimento al loro comportamento elastico o sostanzialmente elastico, come definito di volta in volta nei successivi paragrafi.", { manual: true }),
        block("7.3.6.1", "p13", "paragraph", [[226, 37, 39]], "La resistenza dei materiali può essere ridotta per tener conto del degrado per deformazioni cicliche, giustificandolo sulla base di apposite prove sperimentali. In tal caso, ai coefficienti parziali di sicurezza sui materiali γ_M si attribuiscono i valori precisati nel Cap. 4 per le situazioni eccezionali.", { manual: true, inline: inlineTerms("La resistenza dei materiali può essere ridotta per tener conto del degrado per deformazioni cicliche, giustificandolo sulla base di apposite prove sperimentali. In tal caso, ai coefficienti parziali di sicurezza sui materiali γ_M si attribuiscono i valori precisati nel Cap. 4 per le situazioni eccezionali.", [["γ_M", "\\gamma_M"]]) }),
        heading("7.3.6.1", "heading-dut", [[226, 40, 40]], "VERIFICHE DI DUTTILITÀ (DUT)"),
        block("7.3.6.1", "p14", "paragraph", [[226, 41, 41]], "Si deve verificare che i singoli elementi strutturali e la struttura nel suo insieme possiedano una capacità in duttilità:", { manual: true }),
        block("7.3.6.1", "li-f", "list-item", [[226, 42, 43]], "- nel caso di analisi lineare, coerente con il fattore di comportamento q adottato e i relativi spostamenti, quali definiti in 7.3.3.3;", { manual: true, inline: inlineTerms("- nel caso di analisi lineare, coerente con il fattore di comportamento q adottato e i relativi spostamenti, quali definiti in 7.3.3.3;", [["q", "q"]]) }),
        block("7.3.6.1", "li-g", "list-item", [[226, 44, 44]], "- nel caso di analisi non lineare, sufficiente a soddisfare la domanda in duttilità evidenziata dall’analisi.", { manual: true }),
        block("7.3.6.1", "p15", "paragraph", [[226, 45, 49]], "Nel caso di analisi lineare la verifica di duttilità si può ritenere soddisfatta, rispettando per tutti gli elementi strutturali, sia primari sia secondari, le regole specifiche per i dettagli costruttivi precisate nel presente capitolo per le diverse tipologie costruttive; tali regole sono da considerarsi aggiuntive rispetto a quanto previsto nel Cap. 4 e a quanto imposto dalle regole della progettazione in capacità, il cui rispetto è comunque obbligatorio per gli elementi strutturali primari delle strutture a comportamento dissipativo.", { manual: true }),
        block("7.3.6.1", "p16", "paragraph", [[226, 50, 51]], "Per strutture a comportamento dissipativo, qualora non siano rispettate le regole specifiche dei dettagli costruttivi, quali precisate nel presente capitolo, occorrerà procedere a verifiche di duttilità.", { manual: true }),
        block("7.3.6.1", "p17", "paragraph", [[226, 52, 53], [227, 3, 4]], "Per le sezioni allo spiccato dalle fondazioni o dalla struttura scatolare rigida di base di cui al § 7.2.1 degli elementi strutturali verticali primari la verifica di duttilità, indipendentemente dai particolari costruttivi adottati, è necessaria qualora non diversamente specificato nei paragrafi successivi relativi alle diverse tipologie costruttive, accertando che la capacità in duttilità della costruzione sia almeno pari:", { manual: true }),
        block("7.3.6.1", "li-h", "list-item", [[227, 5, 5]], "- a 1,2 volte la domanda in duttilità locale, valutata in corrispondenza dello SLV, nel caso si utilizzino modelli lineari,", { manual: true, inline: inlineTerms("- a 1,2 volte la domanda in duttilità locale, valutata in corrispondenza dello SLV, nel caso si utilizzino modelli lineari,", [["SLV", "\\mathrm{SLV}"]]) }),
        block("7.3.6.1", "li-i", "list-item", [[227, 6, 6]], "- alla domanda in duttilità locale e globale allo SLC, nel caso si utilizzino modelli non lineari.", { manual: true, inline: inlineTerms("- alla domanda in duttilità locale e globale allo SLC, nel caso si utilizzino modelli non lineari.", [["SLC", "\\mathrm{SLC}"]]) }),
        block("7.3.6.1", "p18", "paragraph", [[227, 7, 7]], "Le verifiche di duttilità non sono dovute nel caso di progettazione con q ≤ 1,5.", { manual: true, inline: inlineTerms("Le verifiche di duttilità non sono dovute nel caso di progettazione con q ≤ 1,5.", [["q", "q"], ["≤", "\\le"]]) }),
    ], [fDrFragile, fDrDuctile, fDrRelative, fDrMasonry, fDrReinforced, fDrConfined]),
    makeUnit("7.3.6.2", "ELEMENTI NON STRUTTURALI (NS)", [
        heading("7.3.6.2", "heading", [[227, 8, 8]], "7.3.6.2 ELEMENTI NON STRUTTURALI (NS)"),
        heading("7.3.6.2", "heading-sta", [[227, 9, 9]], "VERIFICHE DI STABILITÀ (STA)"),
        block("7.3.6.2", "p1", "paragraph", [[227, 10, 11]], "Per gli elementi non strutturali devono essere adottati magisteri atti ad evitare la possibile espulsione sotto l’azione della F_a (v. § 7.2.3) corrispondente allo SL e alla CU considerati.", { manual: true, inline: inlineTerms("Per gli elementi non strutturali devono essere adottati magisteri atti ad evitare la possibile espulsione sotto l’azione della F_a (v. § 7.2.3) corrispondente allo SL e alla CU considerati.", [["F_a", "F_a"], ["SL", "\\mathrm{SL}"], ["CU", "\\mathrm{CU}"]]) }),
    ]),
    makeUnit("7.3.6.3", "IMPIANTI (IM)", [
        heading("7.3.6.3", "heading", [[227, 12, 12]], "7.3.6.3 IMPIANTI (IM)"),
        heading("7.3.6.3", "heading-fun", [[227, 13, 13]], "VERIFICHE DI FUNZIONAMENTO (FUN)"),
        block("7.3.6.3", "p1", "paragraph", [[227, 14, 16]], "Per gli impianti, si deve verificare che gli spostamenti strutturali o le accelerazioni (a seconda che gli impianti siano più vulnerabili all’effetto dei primi o delle seconde) prodotti dalle azioni relative allo SL e alla CU considerati non siano tali da produrre interruzioni d’uso degli impianti stessi.", { manual: true, inline: inlineTerms("Per gli impianti, si deve verificare che gli spostamenti strutturali o le accelerazioni (a seconda che gli impianti siano più vulnerabili all’effetto dei primi o delle seconde) prodotti dalle azioni relative allo SL e alla CU considerati non siano tali da produrre interruzioni d’uso degli impianti stessi.", [["SL", "\\mathrm{SL}"], ["CU", "\\mathrm{CU}"]]) }),
        heading("7.3.6.3", "heading-sta", [[227, 17, 17]], "VERIFICHE DI STABILITÀ (STA)"),
        block("7.3.6.3", "p2", "paragraph", [[227, 18, 20]], "Per ciascuno degli impianti principali, i diversi elementi funzionali costituenti l’impianto, compresi gli elementi strutturali che li sostengono e collegano, tra loro e alla struttura principale, devono avere capacità sufficiente a sostenere la domanda corrispondente allo SL e alla CU considerati.", { manual: true, inline: inlineTerms("Per ciascuno degli impianti principali, i diversi elementi funzionali costituenti l’impianto, compresi gli elementi strutturali che li sostengono e collegano, tra loro e alla struttura principale, devono avere capacità sufficiente a sostenere la domanda corrispondente allo SL e alla CU considerati.", [["SL", "\\mathrm{SL}"], ["CU", "\\mathrm{CU}"]]) }),
    ]),
];

const formulaRows = [
    [fResponse, "7.3.5", "7.3.10", "1{,}00\\cdot E_x+0{,}30\\cdot E_y+0{,}30\\cdot E_z"],
    [fDrFragile, "7.3.6.1", "7.3.11a", "q_{dr}\\le0{,}0050\\cdot h"],
    [fDrDuctile, "7.3.6.1", "7.3.11b", "q_{dr}\\le0{,}0075\\cdot h"],
    [fDrRelative, "7.3.6.1", "7.3.12", "q_{dr}\\le d_{rp}\\le0{,}0100\\cdot h"],
    [fDrMasonry, "7.3.6.1", "7.3.13", "q_{dr}\\le0{,}0020\\cdot h"],
    [fDrReinforced, "7.3.6.1", "7.3.14", "q_{dr}\\le0{,}0030\\cdot h"],
    [fDrConfined, "7.3.6.1", "7.3.15", "q_{dr}<0{,}0025\\cdot h"],
] as const;

const manifest = {
    $schema: "urn:structural-codes:schema:asset-manifest:v2",
    schemaVersion: "2.0.0-alpha.1",
    recordType: "asset-manifest",
    document: "ntc2018",
    section: "7-step3",
    sourceId,
    status: "transcribed-unreviewed",
    formulas: formulaRows.map(([id, unit, officialNumber, latex]) => ({
        id: fid(id),
        unitId: uid(unit),
        officialNumber,
        pdfPage: officialNumber === "7.3.10" ? 225 : 226,
        latex,
    })),
    tables: [table73iii],
    figures: [],
};

await mkdir(unitDir, { recursive: true });
await mkdir(assetDir, { recursive: true });
for (const unit of units) {
    const number = String(unit.numbering.official);
    await writeFile(join(unitDir, `${number}.json`), `${JSON.stringify(unit, null, 2)}\n`, "utf8");
}
await writeFile(join(assetDir, "7-step3.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(`NTC 7 step3: generate ${units.length} unità, ${formulaRows.length} formule e 1 tabella.`);
