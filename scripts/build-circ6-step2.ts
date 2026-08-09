/* eslint-disable @typescript-eslint/no-explicit-any */
import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const sourceId = "circ-7-2019";
const profile = "circ6-manual-render-transcription-0.1.0";
const createdAt = "2026-08-09T12:00:00Z";
const sourceDir = join(root, "evidence", sourceId, "pages");
const unitDir = join(root, "corpus", "units", "circ2019");
const assetDir = join(root, "corpus", "assets", "circ2019");

type Part = { page: number; from: number; to?: number };
type BlockKind = "heading" | "paragraph" | "list-item";
type BlockSpec = { kind: BlockKind; parts: Part[]; text?: string; manual?: boolean };
type UnitSpec = { number: string; title: string; blocks: BlockSpec[]; manual: boolean };

const pageLines = new Map<number, string[]>();
for (let page = 186; page <= 196; page += 1) {
    const filename = join(sourceDir, `page-${String(page).padStart(4, "0")}.raw.txt`);
    pageLines.set(page, (await readFile(filename, "utf8")).replace(/\r\n/gu, "\n").split("\n"));
}

const clean = (value: string): string => value.replace(/\s+/gu, " ").trim();
const sha256 = (value: string): string => createHash("sha256").update(value, "utf8").digest("hex");
const uid = (number: string): string => `urn:structural-codes:it:unit:circ2019:${number.toLowerCase()}`;

function raw(parts: Part[]): string {
    return parts.map(({ page, from, to = from }) => {
        const lines = pageLines.get(page);
        if (!lines) throw new Error(`Evidence mancante per pagina ${page}`);
        return lines.slice(from - 1, to).join("\n");
    }).join("\n");
}

const cp1252: Record<string, number> = {
    "€": 0x80, "‚": 0x82, "ƒ": 0x83, "„": 0x84, "…": 0x85, "†": 0x86, "‡": 0x87,
    "ˆ": 0x88, "‰": 0x89, "Š": 0x8a, "‹": 0x8b, "Œ": 0x8c, "Ž": 0x8e,
    "‘": 0x91, "’": 0x92, "“": 0x93, "”": 0x94, "•": 0x95, "–": 0x96, "—": 0x97,
    "˜": 0x98, "™": 0x99, "š": 0x9a, "›": 0x9b, "œ": 0x9c, "ž": 0x9e, "Ÿ": 0x9f,
};

function decodeMojibake(value: string): string {
    if (!/[ÃÂâ]/u.test(value)) return value;
    const bytes: number[] = [];
    for (const character of value) {
        const code = character.codePointAt(0) ?? 0;
        if (code <= 0xff) bytes.push(code);
        else if (cp1252[character] !== undefined) bytes.push(cp1252[character]);
        else bytes.push(0x3f);
    }
    return new TextDecoder("utf-8", { fatal: false }).decode(Uint8Array.from(bytes));
}

function normalizeExtracted(value: string): string {
    let result = value
        .replace(/-\n(?=[a-zàèéìòù])/gu, "")
        .replace(/\n/gu, " ")
        .replace(/\.\s*\u001c[’']/gu, " γ_φ'")
        .replace(/\.G([12])\b/gu, " γ_G$1")
        .replace(/\.Q\b/gu, " γ_Q")
        .replace(/\.R\b/gu, " γ_R")
        .replace(/\.c[’']/gu, " γ_c'")
        .replace(/\.cu\b/gu, " γ_cu")
        .replace(/\b15\s*-\s*m\b/gu, "15 μm")
        .replace(/[\u0002\u0005]/gu, " ");
    result = decodeMojibake(result)
        .replace(/[\u0000-\u001f\u007f-\u009f]/gu, "")
        .replace(/\bP ROVE\b/gu, "PROVE")
        .replace(/\bM ETODI\b/gu, "METODI")
        .replace(/\bR ILEVATI\b/gu, "RILEVATI")
        .replace(/\bE\s+d\b/gu, "E_d")
        .replace(/\bR\s+d\b/gu, "R_d")
        .replace(/\bR\s*ad\b/gu, "R_{ad}")
        .replace(/\bRd\/Ed\b/gu, "R_d/E_d")
        .replace(/\s+/gu, " ")
        .trim();
    return result;
}

function transformations(source: string, normalized: string): any[] {
    if (source === normalized) return [];
    const result: any[] = [];
    if (/\n/u.test(source)) result.push({ operation: "join-line-wrap", ruleVersion: profile, note: "Ricomposti i ritorni a capo tipografici verificati sul render ufficiale." });
    if (/[\u0000-\u001f\u007f-\u009fÃÂâ]/u.test(source)) result.push({ operation: "manual-correction", ruleVersion: profile, note: "Ripristinati accenti, glifi matematici, sillabazioni e marcatori di elenco verificati sul render ufficiale." });
    result.push({ operation: "normalize-whitespace", ruleVersion: profile, note: "Uniformati gli spazi dopo la ricomposizione del testo." });
    return result;
}

function evidence(parts: Part[], normalized: string, manual = false): any {
    const source = manual ? normalized : raw(parts);
    const page = parts[0]?.page ?? 187;
    return {
        sourceId,
        pdfPage: page,
        printedPage: String(page - 4),
        region: null,
        extraction: {
            method: manual ? "manual-transcription" : "pdf-text",
            tool: manual ? "codex-render-transcription" : "pdfjs-dist",
            toolVersion: manual ? profile : "4.10.38",
        },
        transformations: manual ? [] : transformations(source, normalized),
        rawSha256: sha256(source),
        normalizedSha256: sha256(normalized),
    };
}

const h = (page: number, from: number, text?: string): BlockSpec => ({ kind: "heading", parts: [{ page, from }], ...(text ? { text: clean(text) } : {}) });
const p = (page: number, from: number, to: number, text?: string): BlockSpec => ({ kind: "paragraph", parts: [{ page, from, to }], ...(text ? { text: clean(text) } : {}) });
const li = (page: number, from: number, to: number, text?: string): BlockSpec => ({ kind: "list-item", parts: [{ page, from, to }], ...(text ? { text: clean(text) } : {}) });
const cross = (kind: BlockKind, parts: Part[], text: string): BlockSpec => ({ kind, parts, text: clean(text) });
const manual = (kind: BlockKind, page: number, text: string): BlockSpec => ({ kind, parts: [{ page, from: 1 }], text: clean(text), manual: true });

const inlineTerms: Array<[string, string]> = [
    ["b÷2b", "b\\div 2b"],
    ["0.5b÷b", "0{,}5b\\div b"],
    ["A2+M2+R2", "A_2+M_2+R_2"],
    ["A2+M2+R1", "A_2+M_2+R_1"],
    ["A2+M2+R3", "A_2+M_2+R_3"],
    ["A1+M1+R1", "A_1+M_1+R_1"],
    ["A1+M1+R3", "A_1+M_1+R_3"],
    ["γ_G1", "\\gamma_{G1}"],
    ["γ_G2", "\\gamma_{G2}"],
    ["γ_Q", "\\gamma_Q"],
    ["γ_c'", "\\gamma_{c'}"],
    ["γ_φ'", "\\gamma_{\\varphi'}"],
    ["γ_cu", "\\gamma_{cu}"],
    ["γ_R", "\\gamma_R"],
    ["E_d ≤ R_d", "E_d\\le R_d"],
    ["R_d/E_d", "R_d/E_d"],
    ["E_d", "E_d"],
    ["R_d", "R_d"],
    ["R_{ad}", "R_{ad}"],
    ["15 μm", "15\\,\\mu\\mathrm{m}"],
];

function inline(text: string): any[] | undefined {
    const terms = inlineTerms.filter(([value]) => text.includes(value)).sort((a, b) => b[0].length - a[0].length);
    if (!terms.length) return undefined;
    const result: any[] = [];
    let cursor = 0;
    while (cursor < text.length) {
        let next: { index: number; value: string; latex: string } | undefined;
        for (const [value, latex] of terms) {
            const index = text.indexOf(value, cursor);
            if (index >= 0 && (!next || index < next.index)) next = { index, value, latex };
        }
        if (!next) { result.push({ kind: "text", value: text.slice(cursor) }); break; }
        if (next.index > cursor) result.push({ kind: "text", value: text.slice(cursor, next.index) });
        result.push({ kind: "math", value: next.value, latex: next.latex });
        cursor = next.index + next.value.length;
    }
    return result.filter(({ value }) => value);
}

const units: UnitSpec[] = [
    {
        number: "C6.4.1", title: "CRITERI GENERALI DI PROGETTO", manual: true,
        blocks: [
            h(186, 51, "C6.4.1 CRITERI GENERALI DI PROGETTO"),
            p(186, 52, 53),
            manual("paragraph", 187, "Il progetto delle fondazioni prevede le sequenze progettuali evidenziate nel § 6.2 delle NTC che vanno dalla scelta del sistema di fondazione, alla pianificazione delle indagini e delle prove per la caratterizzazione meccanica dei terreni compresi nel volume significativo, definito nel § 6.2.2 delle NTC, alle analisi e al dimensionamento geotecnico delle opere, nonché alle analisi eseguite per la verifica delle condizioni di sicurezza e per la valutazione delle prestazioni nelle condizioni d’esercizio del sistema costruzione-terreno."),
            manual("paragraph", 187, "In relazione alle diverse fasi sopraccitate occorre almeno considerare:"),
            manual("list-item", 187, "a) Terreni di fondazione:"),
            manual("list-item", 187, "Profondità del volume significativo"),
            manual("paragraph", 187, "Nel caso di fondazioni superficiali la profondità da raggiungere con le indagini può essere dell’ordine di b÷2b, dove b è la lunghezza del lato minore del rettangolo che meglio approssima la forma in pianta del manufatto."),
            manual("paragraph", 187, "Nel caso di fondazioni su pali, la profondità, considerata dall’estremità inferiore dei pali, può essere dell’ordine di 0.5b÷b."),
            manual("paragraph", 187, "Profondità maggiori dovranno essere indagate in presenza di terreni molto compressibili o di cavità o per costruzioni molto sensibili ai cedimenti assoluti e differenziali."),
            manual("list-item", 187, "Stratigrafia, regime delle pressioni interstiziali e grandezze fisiche e meccaniche e idrauliche dei terreni nel volume significativo."),
            manual("list-item", 187, "b) Opere in progetto:"),
            manual("list-item", 187, "dimensioni dell’opera;"),
            manual("list-item", 187, "caratteristiche della struttura in elevazione, con particolare riferimento ai possibili cedimenti differenziali;"),
            manual("list-item", 187, "sequenza cronologica con la quale vengono costruite le varie parti dell’opera (fasi costruttive);"),
            manual("list-item", 187, "distribuzione, intensità o variazione nel tempo dei carichi trasmessi in fondazione, distinguendo i carichi permanenti dai sovraccarichi, e questi, a loro volta, in statici e dinamici."),
            manual("list-item", 187, "c) Fattori ambientali:"),
            manual("list-item", 187, "caratteri morfologici del sito;"),
            manual("list-item", 187, "deflusso delle acque superficiali;"),
            manual("list-item", 187, "presenza o caratteristiche di altri manufatti (edifici, canali, acquedotti, strade, muri di sostegno, gallerie, ponti, ecc.) esistenti nelle vicinanze o dei quali è prevista la costruzione."),
            manual("paragraph", 187, "Qualora non si adotti un’unica tipologia di fondazione per tutto il manufatto, si deve tenere conto dei diversi comportamenti dei tipi di fondazione adottati, in particolare per quanto concerne i cedimenti."),
            manual("paragraph", 187, "Nel caso di opere in alveo ed a mare, o in bacini naturali e artificiali caratterizzati dalla presenza di correnti e/o moto ondoso, è necessario considerare la configurazione e la possibile evoluzione del fondo oltre ai fenomeni erosivi localizzati in dipendenza del regime delle acque e delle caratteristiche dei terreni e del manufatto."),
            manual("paragraph", 187, "Particolare attenzione deve essere posta nel progetto di opere contigue ad altre costruzioni. In questi casi è necessaria la valutazione degli effetti indotti dalla nuova opera sulle costruzioni preesistenti, in tutte le fasi della sua realizzazione. Nel caso in cui siano previsti scavi per impostare le nuove fondazioni si dovrà porre ulteriore attenzione alla scelta e al dimensionamento degli scavi e delle opere di sostegno, per limitare gli spostamenti del terreno circostante."),
            manual("paragraph", 187, "La progettazione di manufatti in pendii in frana, per i quali non è possibile una diversa localizzazione, o la verifica di manufatti esistenti, richiede la valutazione delle azioni trasmesse dai terreni in movimento al manufatto e alla sua fondazione. A tal fine è necessario definire le caratteristiche geometriche e cinematiche dei dissesti in conformità a quanto indicato nel § 6.3 delle NTC."),
            manual("paragraph", 187, "Il dimensionamento geotecnico delle fondazioni deve essere effettuato con riferimento ai modelli geotecnici del volume significativo definiti per i diversi stati limite considerati."),
            manual("paragraph", 187, "Per tutti i sistemi di fondazione, l’applicazione del metodo degli stati limite richiede necessariamente sia le verifiche agli stati limite ultimi sia le verifiche agli stati limite di esercizio."),
            manual("paragraph", 187, "Gli stati limite ultimi delle fondazioni si riferiscono allo sviluppo di meccanismi di collasso determinati dalla mobilitazione della resistenza del terreno interagente con le fondazioni (GEO) e al raggiungimento della resistenza degli elementi che compongono la fondazione stessa (STR)."),
            manual("paragraph", 187, "Per le verifiche agli stati limite ultimi delle fondazioni, nelle NTC, è considerato il solo Approccio 2 richiamato nel § C6.2.4."),
        ],
    },
    {
        number: "C6.4.2", title: "FONDAZIONI SUPERFICIALI", manual: true,
        blocks: [
            manual("heading", 187, "C6.4.2 FONDAZIONI SUPERFICIALI"),
            manual("heading", 187, "Criteri di progetto"),
            manual("paragraph", 187, "È opportuno che i piani di posa di tutte le fondazioni di uno stesso manufatto siano posti alla stessa quota. Ove ciò non sia possibile, le fondazioni adiacenti, appartenenti o non ad un unico manufatto, dovranno essere verificate tenendo conto della reciproca influenza e della configurazione dei piani di posa."),
            manual("paragraph", 187, "Le fondazioni situate nell’alveo o nelle golene di corsi d’acqua possono essere soggette allo scalzamento e devono perciò essere adeguatamente difese e approfondite. Analoga precauzione deve essere presa nel caso delle opere marittime."),
            p(188, 3, 5),
        ],
    },
    {
        number: "C6.4.2.1", title: "VERIFICHE AGLI STATI LIMITE ULTIMI (SLU)", manual: false,
        blocks: [
            h(188, 6), p(188, 7, 10), p(188, 11, 13), p(188, 14, 18), p(188, 19, 24), p(188, 25, 28),
            h(188, 29, "VERIFICHE AGLI STATI LIMITE ULTIMI GEOTECNICI"),
            p(188, 30, 33), p(188, 34, 37),
            h(188, 38, "VERIFICHE AGLI STATI LIMITE ULTIMI STRUTTURALI"), p(188, 39, 42),
        ],
    },
    {
        number: "C6.4.2.2", title: "VERIFICHE AGLI STATI LIMITE DI ESERCIZIO (SLE)", manual: false,
        blocks: [h(188, 43), p(188, 44, 45), p(188, 46, 47), p(188, 48, 51), p(188, 52, 53)],
    },
    {
        number: "C6.4.3", title: "FONDAZIONI SU PALI", manual: false,
        blocks: [
            h(189, 3), p(189, 4, 5), p(189, 6, 7), p(189, 8, 9), h(189, 10, "Indagini geotecniche e caratterizzazione dei terreni"), p(189, 11, 12), p(189, 13, 17), p(189, 18, 20),
        ],
    },
    {
        number: "C6.4.3.1", title: "VERIFICHE AGLI STATI LIMITE ULTIMI (SLU)", manual: false,
        blocks: [
            h(189, 21), p(189, 22, 24), p(189, 25, 27), p(189, 28, 29), p(189, 30, 33), p(189, 34, 42), p(189, 43, 44),
        ],
    },
    {
        number: "C6.4.3.7", title: "PROVE DI CARICO", manual: false,
        blocks: [h(189, 45), p(189, 46, 47), p(189, 48, 48), p(189, 49, 49)],
    },
    {
        number: "C6.5", title: "OPERE DI SOSTEGNO", manual: false,
        blocks: [h(189, 50), p(189, 51, 53), p(190, 3, 7)],
    },
    {
        number: "C6.5.3", title: "VERIFICHE AGLI STATI LIMITE", manual: false,
        blocks: [h(190, 8)],
    },
    {
        number: "C6.5.3.1", title: "VERIFICHE DI SICUREZZA (SLU)", manual: false,
        blocks: [h(190, 9)],
    },
    {
        number: "C6.5.3.1.1", title: "Muri di sostegno", manual: false,
        blocks: [
            h(190, 10), p(190, 11, 13), p(190, 14, 16), p(190, 17, 18), p(190, 19, 21), p(190, 22, 22), p(190, 23, 26), p(190, 27, 29), p(190, 30, 32), p(190, 33, 36), p(190, 37, 38), h(190, 39, "APPROCCIO 2"), p(190, 40, 49), p(190, 50, 52),
        ],
    },
    {
        number: "C6.5.3.1.2", title: "Paratie", manual: false,
        blocks: [
            h(190, 53), cross("paragraph", [{ page: 190, from: 54, to: 56 }, { page: 191, from: 3, to: 4 }], "Gli stati limite ultimi per sviluppo di meccanismi di collasso determinati dal raggiungimento della resistenza del terreno interagente con una paratia riguardano la rotazione intorno a un punto dell’opera, la formazione di un meccanismo di collasso nel terreno per rotazione con formazione di una o più cerniere plastiche nella struttura o per plasticizzazione di eventuali sistemi di vincoli, l’instabilità del fondo scavo in terreni a grana fine in condizioni non drenate, l’instabilità globale dell’insieme terreno-opera, il collasso per carico limite verticale e lo sfilamento di uno o più ancoraggi."),
            p(191, 5, 7), p(191, 8, 10), p(191, 11, 15), p(191, 16, 18), p(191, 19, 21), h(191, 22, "APPROCCIO 1"), p(191, 23, 32), p(191, 33, 41), p(191, 42, 45),
            p(191, 46, 56),
            cross("paragraph", [{ page: 191, from: 57, to: 58 }, { page: 192, from: 3, to: 6 }], "La verifica allo stato limite ultimo nei confronti del raggiungimento della resistenza in una sezione della paratia o in uno degli elementi dell’eventuale sistema di vincoli (puntoni o ancoraggi) si esegue moltiplicando le sollecitazioni calcolate con l’analisi d’interazione prima della ricerca di un meccanismo di collasso per i coefficienti parziali del gruppo A1 (γ_G1, γ_G2 e γ_Q). La presenza di un sovraccarico (permanente non strutturale o variabile) può essere trattata ripetendo l’analisi nella doppia ipotesi di presenza e assenza del sovraccarico, in modo da isolare l’aliquota di sollecitazione ad esso associata e permetterne la fattorizzazione prescritta in normativa."),
            p(192, 7, 7), p(192, 8, 9),
            p(192, 10, 21, "Nella verifica SLU nei confronti di meccanismi di tipo geotecnico, la verifica si esegue adottando la Combinazione 2 dei coefficienti parziali di sicurezza, controllando che la condizione fondamentale E_d ≤ R_d sia sempre soddisfatta, escludendo anche che si verifichino meccanismi di collasso che coinvolgano il complesso terreno-struttura. In queste verifiche, l’effetto delle azioni E_d e la resistenza R_d sono rispettivamente i momenti della spinta attiva di progetto e della spinta passiva di progetto rispetto ad un punto di rotazione (punto di applicazione del vincolo nelle paratie con un livello di ancoraggio; punto di rotazione per le paratie a sbalzo). Mantenendo la stessa configurazione geometrica si effettua la verifica SLU di tipo strutturale mediante un’analisi d’interazione, svolta ancora con i valori caratteristici dei parametri geotecnici e delle azioni, ma semplificata dall’assunzione a priori della distribuzione delle pressioni di contatto. Da quanto noto sulla mobilitazione delle spinte, si ipotizza infatti che a monte della paratia le tensioni orizzontali assumano il valore di equilibrio limite attivo, mentre a valle assumano valori la cui risultante sia inferiore alla resistenza passiva della quantità necessaria ad ottenere le condizioni di equilibrio, che in un’analisi di questo tipo devono essere soddisfatte. Le sollecitazioni così calcolate devono essere quindi moltiplicate per i coefficienti parziali del gruppo A1 (Combinazione 1), come in precedenza."),
            p(192, 22, 25),
        ],
    },
    {
        number: "C6.5.3.2", title: "VERIFICHE DI ESERCIZIO (SLE)", manual: false,
        blocks: [h(192, 26), p(192, 27, 29), p(192, 30, 31), p(192, 32, 34)],
    },
    {
        number: "C6.6", title: "TIRANTI DI ANCORAGGIO", manual: false,
        blocks: [h(192, 35)],
    },
    {
        number: "C6.6.1", title: "CRITERI DI PROGETTO", manual: false,
        blocks: [
            h(192, 36), p(192, 37, 37), li(192, 38, 38), li(192, 39, 39), li(192, 40, 40), li(192, 41, 42), li(192, 43, 43), li(192, 44, 44), li(192, 45, 45), li(192, 46, 46), li(192, 47, 47), p(192, 48, 49), p(192, 50, 51),
        ],
    },
    {
        number: "C6.6.2", title: "VERIFICHE DI SICUREZZA (SLU)", manual: false,
        blocks: [h(193, 23), p(193, 24, 26), li(193, 27, 27), li(193, 28, 28), p(193, 29, 31), p(193, 32, 34), p(193, 35, 38), p(193, 39, 42)],
    },
    {
        number: "C6.6.3", title: "ASPETTI COSTRUTTIVI", manual: false,
        blocks: [h(193, 43), p(193, 44, 46), p(193, 47, 48), p(193, 49, 52)],
    },
    {
        number: "C6.7", title: "OPERE IN SOTTERRANEO", manual: false,
        blocks: [h(194, 3), p(194, 4, 6), h(194, 7, "Indagini specifiche"), p(194, 8, 11)],
    },
    {
        number: "C6.7.4", title: "CRITERI DI PROGETTO", manual: false,
        blocks: [h(194, 12), p(194, 13, 14), p(194, 15, 19), p(194, 20, 23)],
    },
    {
        number: "C6.7.4.1", title: "METODI DI SCAVO", manual: false,
        blocks: [h(194, 24, "C6.7.4.1 METODI DI SCAVO"), p(194, 25, 29), p(194, 30, 32), p(194, 33, 34)],
    },
    {
        number: "C6.7.4.2", title: "VERIFICA DEL RIVESTIMENTO", manual: false,
        blocks: [h(194, 35), p(194, 36, 38), p(194, 39, 40)],
    },
    {
        number: "C6.7.6", title: "CONTROLLO E MONITORAGGIO", manual: false,
        blocks: [h(194, 41), p(194, 42, 43)],
    },
    {
        number: "C6.8", title: "OPERE DI MATERIALI SCIOLTI E FRONTI DI SCAVO", manual: false,
        blocks: [h(194, 44), p(194, 45, 46)],
    },
    {
        number: "C6.8.1", title: "CRITERI GENERALI DI PROGETTO", manual: false,
        blocks: [h(194, 47)],
    },
    {
        number: "C6.8.1.1", title: "RILEVATI E RINTERRI", manual: false,
        blocks: [h(194, 48, "C6.8.1.1 RILEVATI E RINTERRI"), cross("paragraph", [{ page: 194, from: 49, to: 50 }, { page: 195, from: 3, to: 4 }], "Per i rilevati ed i rinterri a tergo di opere di sostegno sono da preferire le terre a grana media o grossa. Terre a grana fine possono essere impiegate per opere di modesta importanza e quando non sia possibile reperire materiali migliori. Si possono adoperare anche materiali ottenuti dalla frantumazione di rocce. Sono da escludere materiali con forti percentuali di sostanze organiche di qualsiasi tipo e materiali fortemente rigonfianti."), p(195, 5, 5), p(195, 6, 7), p(195, 8, 10), p(195, 11, 13), p(195, 14, 15)],
    },
    {
        number: "C6.8.1.2", title: "DRENAGGI E FILTRI", manual: false,
        blocks: [h(195, 16), p(195, 17, 17), li(195, 18, 18), li(195, 19, 19), li(195, 20, 21), li(195, 22, 22), p(195, 23, 24), li(195, 25, 25), li(195, 26, 27), li(195, 28, 29), p(195, 30, 31), p(195, 32, 34), p(195, 35, 36), p(195, 37, 38), p(195, 39, 40), p(195, 41, 41), p(195, 42, 42)],
    },
    {
        number: "C6.8.6", title: "FRONTI DI SCAVO", manual: false,
        blocks: [h(195, 43), p(195, 44, 45)],
    },
    {
        number: "C6.8.6.2", title: "CRITERI GENERALI DI PROGETTO E VERIFICHE DI SICUREZZA", manual: false,
        blocks: [h(195, 46), p(195, 47, 49)],
    },
    {
        number: "C6.11", title: "DISCARICHE CONTROLLATE DI RIFIUTI E DEPOSITI DI INERTI", manual: false,
        blocks: [h(196, 3), p(196, 4, 5), p(196, 6, 8), p(196, 9, 10), p(196, 11, 12)],
    },
    {
        number: "C6.12", title: "FATTIBILITÀ DI OPERE SU GRANDI AREE", manual: false,
        blocks: [h(196, 13)],
    },
    {
        number: "C6.12.1", title: "INDAGINI SPECIFICHE", manual: false,
        blocks: [h(196, 14), p(196, 15, 15), li(196, 16, 16), li(196, 17, 17), li(196, 18, 18), li(196, 19, 19), p(196, 20, 21), p(196, 22, 24), p(196, 25, 25), p(196, 26, 28)],
    },
    {
        number: "C6.12.2", title: "VERIFICHE DI FATTIBILITÀ", manual: false,
        blocks: [h(196, 29), p(196, 30, 33), p(196, 34, 35), p(196, 36, 38)],
    },
    {
        number: "C6.12.2.1", title: "EMUNGIMENTO DA FALDE IDRICHE", manual: false,
        blocks: [h(196, 39), p(196, 40, 41)],
    },
];

const ntcFiles = new Set(await readdir(join(root, "corpus", "units", "ntc2018")));
const mathUnits = new Set(["C6.4.1", "C6.4.2.1", "C6.4.3.1", "C6.5.3.1.2", "C6.6.1", "C6.6.2", "C6.8.1.1", "C6.8.6.2"]);

function blockRecord(unit: UnitSpec, block: BlockSpec, index: number): any {
    const id = uid(unit.number);
    const blockId = `${id}#block-${index === 0 ? "heading" : `editorial-${String(index).padStart(3, "0")}`}`;
    const source = block.manual ? (block.text ?? "") : raw(block.parts);
    const normalized = block.text ?? normalizeExtracted(source);
    const text: any = { raw: source, normalized, normalizationVersion: profile };
    const segments = inline(normalized);
    if (segments) text.inline = segments;
    return { blockId, kind: block.kind, origin: "official", text, evidence: evidence(block.parts, normalized, Boolean(block.manual)) };
}

await mkdir(unitDir, { recursive: true });
for (const unit of units) {
    const id = uid(unit.number);
    const parts = unit.number.slice(1).split(".");
    const pathNumbers = parts.map((_, index) => `C${parts.slice(0, index + 1).join(".")}`);
    const ancestorParts = pathNumbers.slice(0, -1);
    const blocks = unit.blocks.map((block, index) => blockRecord(unit, block, index));
    const relationTarget = `${unit.number.slice(1)}.json`;
    const hasNtcEquivalent = ntcFiles.has(relationTarget);
    const record = {
        $schema: "urn:structural-codes:schema:canonical-unit:v2",
        schemaVersion: "2.0.0-alpha.2",
        recordType: "canonical-unit",
        id,
        workId: "it-mit:circ:2019-01-21:7-csllpp",
        expressionId: "it-mit:circ:2019-01-21:7-csllpp:original-it",
        kind: parts.length === 1 ? "chapter" : parts.length === 2 ? "section" : parts.length === 3 ? "paragraph" : "subparagraph",
        numbering: { official: unit.number, sortKey: parts.map((part) => part.padStart(3, "0")).join(".") },
        title: unit.title,
        titleBlockId: `${id}#block-heading`,
        hierarchy: { parentId: ancestorParts.length ? uid(ancestorParts.at(-1)!) : null, ancestorIds: ancestorParts.map((ancestor) => uid(ancestor)), position: Number(parts[parts.length - 1]) },
        validity: { from: null, to: null, status: "unknown", asOf: "2026-08-09" },
        blocks,
        citations: [],
        relations: hasNtcEquivalent ? [{ relationId: `${id}#relation-001`, type: "clarifies", targetUnitId: `urn:structural-codes:it:unit:ntc2018:${unit.number.slice(1)}`, basis: "editorial", evidenceBlockIds: [`${id}#block-heading`], rationale: "Corrispondenza proposta tra numerazione omologa della Circolare e delle NTC; richiede conferma umana sul contenuto completo.", review: { status: "proposed", reviewedBy: null, reviewedAt: null } }] : [],
        assets: { formulaIds: [], tableIds: [], figureIds: [] },
        workflow: {
            status: "extracted",
            createdBy: { actorId: "generator:circ6:step2", kind: "script", toolVersion: profile },
            createdAt,
            reviews: [],
            openIssues: [
                { issueId: `circ2019-${unit.number.toLowerCase().replaceAll(".", "-")}-source-review`, type: "normalization-review", severity: "blocking", note: "Trascrizione confrontata con il render ufficiale nello step; resta obbligatoria la revisione umana indipendente prima della pubblicazione." },
                ...(hasNtcEquivalent ? [{ issueId: `circ2019-${unit.number.toLowerCase().replaceAll(".", "-")}-relation`, type: "relation-review", severity: "blocking", note: "Il collegamento Circolare-NTC per numerazione omologa richiede conferma umana." }] : []),
                ...(unit.manual ? [{ issueId: `circ2019-${unit.number.toLowerCase().replaceAll(".", "-")}-missing-text-layer`, type: "missing-region", severity: "blocking", note: "Il layer testuale ufficiale della pagina PDF 187 non è sufficiente; il contenuto è stato trascritto manualmente dal render ufficiale." }] : []),
                ...(mathUnits.has(unit.number) ? [{ issueId: `circ2019-${unit.number.toLowerCase().replaceAll(".", "-")}-inline-math`, type: "asset-review", severity: "blocking", note: "Le grandezze matematiche inline sono state segmentate in LaTeX; resta obbligatoria la verifica umana dei glifi e degli indici." }] : []),
            ],
        },
    };
    await writeFile(join(unitDir, `${unit.number.toLowerCase()}.json`), `${JSON.stringify(record, null, 2)}\n`, "utf8");
}

const manifest = {
    $schema: "urn:structural-codes:schema:asset-manifest:v2",
    schemaVersion: "2.0.0-alpha.1",
    recordType: "asset-manifest",
    document: "circ2019",
    section: "C6-step2",
    sourceId,
    status: "transcribed-unreviewed",
    formulas: [],
    tables: [],
    figures: [],
};
await writeFile(join(assetDir, "C6-step2.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

console.log(`circ6-step2: generated ${units.length} units and no display assets`);
