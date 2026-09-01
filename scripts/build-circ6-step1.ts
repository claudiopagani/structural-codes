/* eslint-disable @typescript-eslint/no-explicit-any */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
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
type BlockKind = "heading" | "paragraph" | "list-item" | "footnote" | "table-ref";
type BlockSpec = {
    kind: BlockKind;
    parts: Part[];
    text?: string;
    manual?: boolean;
    asset?: string;
};
type UnitSpec = {
    number: string;
    title: string;
    blocks: BlockSpec[];
    manual: boolean;
};

const pageLines = new Map<number, string[]>();
for (let page = 177; page <= 186; page += 1) {
    const filename = join(sourceDir, `page-${String(page).padStart(4, "0")}.raw.txt`);
    pageLines.set(page, (await readFile(filename, "utf8")).replace(/\r\n/gu, "\n").split("\n"));
}

const clean = (value: string): string => value.replace(/\s+/gu, " ").trim();
const sha256 = (value: string): string => createHash("sha256").update(value, "utf8").digest("hex");
const uid = (number: string): string => `urn:structural-codes:it:unit:circ2019:${number.toLowerCase()}`;
const tableId = (number: string): string => `urn:structural-codes:it:asset:table:circ2019:${number.toLowerCase()}`;

function raw(parts: Part[]): string {
    return parts.map(({ page, from, to = from }) => {
        const lines = pageLines.get(page);
        if (!lines) throw new Error(`Evidence mancante per pagina ${page}`);
        return lines.slice(from - 1, to).join("\n");
    }).join("\n");
}

function transformations(source: string, normalized: string): any[] {
    if (source === normalized) return [];
    const result: any[] = [];
    if (/\n/u.test(source)) {
        result.push({ operation: "join-line-wrap", ruleVersion: profile, note: "Ricomposti i ritorni a capo tipografici verificati sul render ufficiale." });
    }
    if (/[\u0000-\u001f\u007f-\u009f]/u.test(source)) {
        result.push({ operation: "remove-control-character", ruleVersion: profile, note: "Rimossi i caratteri di controllo privi di resa visuale dal layer testuale." });
    }
    result.push({ operation: "manual-correction", ruleVersion: profile, note: "Ripristinati accenti, apostrofi, sillabazioni e segni di elenco verificati sul render ufficiale." });
    result.push({ operation: "normalize-whitespace", ruleVersion: profile, note: "Uniformati gli spazi dopo la ricomposizione del testo." });
    return result;
}

function evidence(parts: Part[], normalized: string, manual: boolean, asset = false): any {
    const source = manual ? normalized : raw(parts);
    const page = parts[0]?.page ?? 178;
    return {
        sourceId,
        pdfPage: page,
        printedPage: String(page - 4),
        region: null,
        extraction: {
            method: manual || asset ? "manual-transcription" : "pdf-text",
            tool: manual || asset ? "codex-render-transcription" : "pdfjs-dist",
            toolVersion: manual || asset ? profile : "4.10.38",
        },
        transformations: manual || asset ? [] : transformations(source, normalized),
        rawSha256: sha256(source),
        normalizedSha256: sha256(normalized),
    };
}

const h = (page: number, from: number, text: string, manual = false): BlockSpec => ({
    kind: "heading", parts: manual ? [] : [{ page, from }], text: clean(text), manual,
});
const p = (page: number, from: number, to: number, text: string, manual = false): BlockSpec => ({
    kind: "paragraph", parts: manual ? [] : [{ page, from, to }], text: clean(text), manual,
});
const li = (page: number, from: number, to: number, text: string, manual = false): BlockSpec => ({
    kind: "list-item", parts: manual ? [] : [{ page, from, to }], text: clean(text), manual,
});
const cross = (kind: Exclude<BlockKind, "heading" | "table-ref">, parts: Part[], text: string): BlockSpec => ({
    kind, parts, text: clean(text),
});
const ref = (parts: Part[], asset: string): BlockSpec => ({ kind: "table-ref", parts, asset });

const inlineTerms: Array<[string, string]> = [
    ["A2+M2+R2", "A2+M2+R2"],
    ["A1+M1+R1", "A1+M1+R1"],
    ["γ_R", "\\gamma_R"],
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
        if (!next) {
            result.push({ kind: "text", value: text.slice(cursor) });
            break;
        }
        if (next.index > cursor) result.push({ kind: "text", value: text.slice(cursor, next.index) });
        result.push({ kind: "math", value: next.value, latex: next.latex });
        cursor = next.index + next.value.length;
    }
    return result.filter(({ value }) => value);
}

const units: UnitSpec[] = [
    {
        number: "C6",
        title: "PROGETTAZIONE GEOTECNICA",
        manual: true,
        blocks: [
            h(177, 3, "C6 PROGETTAZIONE GEOTECNICA"),
            p(178, 1, 1, "Per progettazione geotecnica si intende l’insieme delle attività progettuali, dalla pianificazione delle indagini geotecniche fino alle verifiche di sicurezza e al monitoraggio, che riguardano le costruzioni o le parti di costruzioni che interagiscono con il terreno, gli interventi di miglioramento e di rinforzo, le opere in materiali sciolti, i fronti di scavo, nonché la stabilità globale del sito nel quale ricade la costruzione.¹", true),
            p(178, 1, 1, "Gli obiettivi della progettazione geotecnica sono quindi la verifica delle condizioni di sicurezza del sito e del sistema costruzione-terreno, inclusa la determinazione delle sollecitazioni nelle strutture a contatto con il terreno e la valutazione delle prestazioni del sistema nelle condizioni d’esercizio.", true),
            p(178, 1, 1, "La caratterizzazione e modellazione geologica del sito, è propedeutica all’impostazione della progettazione geotecnica, soprattutto quando si tratti di opere infrastrutturali a grande sviluppo lineare o che investano aree molto estese; esse derivano da studi geologici, basati anche sugli esiti di specifiche indagini.", true),
            p(178, 1, 1, "Le indicazioni e le prescrizioni riportate in questo Capitolo devono intendersi come integrative delle analoghe indicazioni e prescrizioni che si riferiscono alla progettazione geotecnica in condizioni sismiche di cui ai §§ 3.2 e 7.11.", true),
            {
                kind: "footnote", parts: [], manual: true,
                text: clean("Il primo passo della progettazione geotecnica riguarda le scelte tipologiche (ad esempio il sistema di fondazione) e la pianificazione delle indagini e delle prove per la caratterizzazione meccanica di terreni o rocce compresi nel volume significativo, definito nel § 6.2.2 delle NTC; indagini geotecniche, stati limite e metodi di analisi sono intrinsecamente connessi. La caratterizzazione meccanica dei terreni deve infatti tenere conto del loro carattere tipicamente non lineare, anche a piccole deformazioni, del possibile comportamento fragile, della dipendenza dai percorsi tensionali, degli effetti di scala così come delle fasi costruttive e delle modalità esecutive. È dunque compito e responsabilità del progettista definire il piano delle indagini geotecniche e, sulla base dei risultati ottenuti, individuare i modelli geotecnici di sottosuolo più appropriati alla tipologia di opera e/o intervento, tenendo conto delle tecnologie e delle modalità costruttive previste. In definitiva, alla luce degli studi geologici, il progettista definisce le scelte tipologiche dell’opera, i materiali da costruzione, le modalità e le fasi esecutive, programma le indagini geotecniche per stabilire i modelli geotecnici di sottosuolo ed effettua le verifiche agli stati limite; se ritenuti necessari a questi fini può richiedere approfondimenti dello studio geologico con ulteriori indagini e accertamenti che concorrano a una migliore definizione del modello geologico. Pur concorrendo entrambe alla progettazione di un’opera, le indagini per la definizione del modello geologico e le indagini geotecniche sono concettualmente diverse tra loro sia perché interessano generalmente aree e volumi diversi sia perché hanno finalità diverse. Le prime, infatti, riguardano aree e volumi di sottosuolo più ampi e sono finalizzate alla definizione del modello geologico. Le seconde interessano generalmente aree e volumi più ridotti (i volumi significativi) e sono finalizzate alla definizione dei modelli geotecnici di sottosuolo specifici per la singola opera e/o per parti di essa, che comprendono l’identificazione e la valutazione quantitativa dei parametri geotecnici necessari alle relative verifiche agli stati limite ultimi e di esercizio. Definito il quadro geologico di riferimento, le indagini geotecniche, logicamente consequenziali, sono programmate dal progettista sulla base della conoscenza dell’opera e dei suoi possibili stati limite."),
            },
        ],
    },
    {
        number: "C6.2", title: "ARTICOLAZIONE DEL PROGETTO", manual: true,
        blocks: [h(178, 1, "C6.2 ARTICOLAZIONE DEL PROGETTO", true)],
    },
    {
        number: "C6.2.1", title: "CARATTERIZZAZIONE E MODELLAZIONE GEOLOGICA DEL SITO", manual: true,
        blocks: [
            h(178, 1, "C6.2.1 CARATTERIZZAZIONE E MODELLAZIONE GEOLOGICA DEL SITO", true),
            p(178, 1, 1, "La relazione geologica, estesa ad un ambito significativo e modulata in relazione al livello progettuale, alle caratteristiche dell’opera e del contesto in cui questa si inserisce, descrive il modello geologico, definito sulla base di specifiche indagini e prove.", true),
            p(178, 1, 1, "Tale relazione, che comprende quanto previsto al § 6.2.1 delle NTC, tiene conto dei seguenti aspetti:", true),
            li(178, 1, 1, "caratteristiche geologiche e successione stratigrafica locale (assetti litostrutturali stratigrafici, stato di alterazione e fessurazione, distribuzione spaziale e rapporti tra i vari corpi geologici);", true),
            li(178, 1, 1, "caratteristiche geo-strutturali dell’area di studio e principali elementi tettonici presenti;", true),
            li(178, 1, 1, "processi morfoevolutivi e principali fenomeni geomorfologici presenti, con particolare riferimento a quelli di frana, individuandone stato e tipo di attività, di erosione e di alluvionamento;", true),
            li(178, 1, 1, "caratteristiche idrogeologiche del sito e schema di circolazione idrica superficiale e sotterranea;", true),
            li(178, 1, 1, "risultati dello studio sismo-tettonico;", true),
            li(178, 1, 1, "assetti geologici finalizzati alla valutazione degli effetti di sito sismoindotti.", true),
            p(178, 1, 1, "La relazione geologica sarà corredata dai relativi elaborati grafici, quali: carte geologiche, idrogeologiche(con eventuale schema di circolazione idrica sotterranea) e geomorfologiche,sezioni geologiche, planimetrie e profili utili a rappresentare in dettaglio aspetti significativi, schema geologico di dettaglio alla scala dell’opera, carte dei vincoli geologico-ambientale rapporto tecnico sulle indagini pregresse ed eseguite, corredate da una planimetria con la loro ubicazione.", true),
            p(178, 1, 1, "Il piano delle indagini nell’area di interesse deve essere definito ed attuato sulla base dell’inquadramento geologico della zona e in funzione dei dati che è necessario acquisire per pervenire ad una ricostruzione geologica adeguata ed utile per la caratterizzazione e la modellazione geotecnica del sottosuolo. Gli studi svolti devono condurre ad una valutazione delle pericolosità geologiche presenti e devono essere finalizzati alla definizione della compatibilità geologica con le peculiarità dell’opera da realizzare.", true),
        ],
    },
    {
        number: "C6.2.2", title: "INDAGINI, CARATTERIZZAZIONE E MODELLAZIONE GEOTECNICA", manual: false,
        blocks: [
            h(179, 5, "C6.2.2 INDAGINI, CARATTERIZZAZIONE E MODELLAZIONE GEOTECNICA"),
            p(179, 6, 8, "Stabilito il volume significativo di terreno coinvolto dall’opera in progetto (definito nel § 6.2.2 delle NTC), l’obiettivo delle indagini è di giungere alla definizione del modello geotecnico ovvero a uno schema rappresentativo del volume significativo stesso, suddiviso in unità omogenee sotto il profilo fisico-meccanico."),
            p(179, 9, 11, "A tal fine devono essere definiti la successione stratigrafica, il regime delle pressioni interstiziali e gli altri elementi significativi del sottosuolo, nonché i valori caratteristici dei parametri geotecnici; questi ultimi da intendersi come stime cautelative dei singoli parametri per ogni stato limite considerato."),
            p(179, 12, 12, "Per le costruzioni di opere in materiali sciolti devono essere definite le proprietà dei materiali da impiegare per la costruzione."),
            p(179, 13, 15, "La caratterizzazione geomeccanica degli ammassi rocciosi richiede inoltre l’individuazione delle famiglie (o dei sistemi) di discontinuità presenti e la definizione della loro giacitura (orientazione) e spaziatura. Sono anche descritte le seguenti caratteristiche delle discontinuità: forma, apertura, estensione, scabrezza, riempimento."),
            p(179, 16, 18, "Le indagini sono estese ed approfondite in modo da risultare adeguate a tutte le diverse fasi di sviluppo del progetto e comprendono quanto necessario per la definizione dell’azione e l’analisi delle opere in condizioni sismiche secondo quanto prescritto ai §§ 3.2.2 e 7.11.2."),
            p(179, 19, 20, "Opere che interessino grandi aree e che incidano profondamente sul territorio richiedono l’accertamento della fattibilità secondo i criteri di cui al § 6.12 delle NTC."),
            p(179, 21, 23, "Nel caso di opere di notevole rilevanza e complessità o che interessino terreni dalle caratteristiche meccaniche scadenti è opportunoeffettuare il controllo del comportamento dell’opera durante e dopo la costruzione, predisponendo un programma di osservazioni e misure commisurato all’importanza dell’opera e alla complessità della situazione."),
        ],
    },
    {
        number: "C6.2.2.1", title: "INDAGINI E PROVE GEOTECNICHE IN SITO", manual: false,
        blocks: [
            h(179, 24, "C6.2.2.1 INDAGINI E PROVE GEOTECNICHE IN SITO"),
            p(179, 25, 26, "Nel rispetto delle indicazioni generali innanzi precisate, a titolo indicativo e non esaustivo, nella Tabella C6.2.I si elencano i mezzi di indagine e le prove geotecniche in sito di più frequente uso."),
            ref([{ page: 179, from: 27, to: 61 }, { page: 180, from: 3, to: 28 }], tableId("C6.2.I")),
            p(180, 29, 30, "La scelta dei mezzi di indagine è effettuata in fase di pianificazione e verificata durante lo svolgimento dell’indagine stessa, modificando ed integrando le scelte iniziali, se necessario."),
            p(180, 31, 32, "Gli eventuali scavi, cunicoli o trincee realizzati a scopo esplorativosono realizzati in modo da non causare apprezzabili modifiche alla situazione esistente, sia dal punto di vista statico, sia da quello idraulico."),
            p(180, 33, 35, "Le indagini di tipo tradizionale (sondaggi, prove penetrometriche, piezometri, ecc.), sono frequentemente integrate da indagini di tipo geofisico. In questo caso, i risultati delle indagini geofisiche sono interpretati alla luce dei risultati ottenuti dalle altre indagini di tipo tradizionale, con l’obbiettivo di ottenere un quadro sperimentale coerente ed unitario."),
            p(180, 36, 39, "Generalmente le indagini di tipo geofisico inducono nei terreni deformazioni molto piccole; pertanto i risultati ottenuti non sono immediatamente utilizzabili nelle analisi geotecniche di stati limite che diano luogo a livelli deformativi più elevati, a meno che non si utilizzino modelli costitutivi del terreno che tengano conto della dipendenza della rigidezza dal livello deformativo o come dato di base per valutare la rigidezza operativa dei terreni."),
            p(180, 40, 40, "I risultati delle indagini e delle prove geotecniche in sito sono documentati con:"),
            li(180, 41, 41, "una planimetria con la collocazione delle verticali di indagine;"),
            li(180, 42, 42, "indicazioni su tipologia e caratteristiche delle attrezzature impiegate;"),
            li(180, 43, 43, "i profili stratigrafici ottenuti dalle perforazioni di sondaggio e dagli scavi esplorativi;"),
            li(180, 44, 44, "i particolari esecutivi delle prove e delle misure eseguite in sito e in laboratorio;"),
            li(180, 45, 45, "i risultati delle prove e delle misure eseguite in sito e in laboratorio;"),
            li(180, 46, 47, "le notizie di eventi particolari verificatisi durante lo svolgimento delle indagini e ogni altro dato utile per la caratterizzazione del sottosuolo."),
        ],
    },
    {
        number: "C6.2.2.2", title: "PROVE GEOTECNICHE DI LABORATORIO", manual: false,
        blocks: [
            h(180, 48, "C6.2.2.2 PROVE GEOTECNICHE DI LABORATORIO"),
            p(180, 49, 56, "Le prove geotecniche di laboratorio integrano le prove in sito e, a seconda del tipo di terreno, permettono di ricavare alcuni valori delle grandezze fisiche e meccaniche necessarie per le verifiche agli stati limite ultimi e agli stati limite di esercizio. La possibilità di ricavare grandezze fisiche e meccaniche da prove di laboratorio dipende dal grado di disturbo dei campioni di terreno prelevati che è funzione, a sua volta, del tipo di terreno e delle tecniche di campionamento. Per terreni ad elevata permeabilità, la qualità dei campioni prelevabili con le tecniche usuali di campionamento non permette la caratterizzazione meccanica in laboratorio ma solo la determinazione di alcune grandezze fisiche. In questi casi i parametri meccanici devono essere ricavati dalle prove in sito. Di contro, per terreni saturi a grana fine (di bassa permeabilità), le prove di laboratorio costituiscono il solo mezzo per la determinazione dei parametri di resistenza in termini di tensioni efficaci."),
            p(180, 57, 59, "Le prove sui terreni utilizzati come materiali da costruzione devono essere effettuate su campioni rappresentativi dei materiali disponibili, preparati in laboratorio secondo modalità da stabilire in relazione alle condizioni di posa in opera previste e alla destinazione del manufatto."),
            p(180, 60, 60, "I risultati delle prove di laboratorio devono essere accompagnati da chiare indicazioni sulle procedure sperimentali adottate."),
        ],
    },
    {
        number: "C6.2.2.3", title: "CARATTERIZZAZIONE E MODELLAZIONE GEOTECNICA", manual: false,
        blocks: [
            h(180, 61, "C6.2.2.3 CARATTERIZZAZIONE E MODELLAZIONE GEOTECNICA"),
            cross("paragraph", [{ page: 180, from: 62, to: 63 }, { page: 181, from: 3, to: 4 }], "I risultati delle indagini e delle prove geotecniche, eseguite in sito e in laboratorio, sono interpretate dal progettista che, sulla base dei risultati acquisiti, della tipologia di opera e/o intervento, delle tecnologie previste e delle modalità costruttive, deve individuare i valori caratteristici dei parametri geotecnici per le analisi e le verifiche nei riguardi degli stati limite ultimi e di esercizio."),
        ],
    },
    {
        number: "C6.2.2.4", title: "VALORI CARATTERISTICI DEI PARAMETRI GEOTECNICI", manual: false,
        blocks: [
            h(181, 5, "C6.2.2.4 VALORI CARATTERISTICI DEI PARAMETRI GEOTECNICI"),
            p(181, 6, 6, "La scelta dei valori caratteristici dei parametri geotecnici avviene in due fasi."),
            p(181, 7, 9, "La prima fase comporta l’identificazione dei parametri geotecnici appropriati ai fini progettuali. Tale scelta richiede una valutazione specifica da parte del progettista, per il necessario riferimento alle diverse verifiche da effettuare (ad esempio, ai diversi tipi di meccanismi di collasso del terreno nel caso di verifiche SLU)."),
            p(181, 10, 17, "A titolo di esempio, nel valutare la stabilità di un muro di sostegno è opportuno che la verifica allo scorrimento della fondazione del muro sia effettuata con riferimento al valore dell’angolo di resistenza al taglio a volume costante (stato critico), poiché il meccanismo di scorrimento, che coinvolge spessori molto modesti di terreno, e l’inevitabile disturbo connesso con la preparazione del piano di posa della fondazione, implicano il rimaneggiamento del terreno. Per questo stesso motivo, nelle analisi svolte in termini di tensioni efficaci, è opportuno trascurare ogni contributo della coesione nelle verifiche allo scorrimento. Considerazioni diverse, invece, devono essere svolte con riferimento al calcolo della capacità portante della fondazione del muro che, per l’elevato volume di terreno indisturbato coinvolto, comporta il riferimento alla resistenza al taglio del terreno intatto, considerando, quando appropriato, anche il contributo della coesione efficace."),
            p(181, 18, 19, "Identificati i parametri geotecnici appropriati, la seconda fase del processo decisionale riguarda la valutazione dei valori caratteristici degli stessi parametri."),
            p(181, 20, 29, "Nelle valutazioni che il progettista deve svolgere per pervenire ad una scelta corretta dei valori caratteristici, appare giustificato il riferimento a valori prossimi ai valori medi quando nello stato limite considerato è coinvolto un elevato volume di terreno, con possibile compensazione delle eterogeneità o quando la struttura a contatto con il terreno è dotata di rigidezza sufficiente a trasferire le azioni dalle zone meno resistenti a quelle più resistenti. Al contrario, valori caratteristici prossimi ai valori minimi dei parametri geotecnici appaiono più giustificati nel caso in cui siano coinvolti modesti volumi di terreno, con concentrazione delle deformazioni fino alla formazione di superfici di rottura nelle porzioni di terreno meno resistenti del volume significativo, o nel caso in cui la struttura a contatto con il terreno non sia in grado di trasferire forze dalle zone meno resistenti a quelle più resistenti a causa della sua insufficiente rigidezza. La scelta di valori caratteristici prossimi ai valori minimi dei parametri geotecnici può essere dettata anche solo dalle caratteristiche dei terreni; basti pensare, ad esempio, all’effetto delle discontinuità sul valore operativo della resistenza non drenata."),
            p(181, 30, 35, "Una migliore approssimazione nella valutazione dei valori caratteristici può essere ottenuta operando le opportune medie dei valori dei parametri geotecnici nell’ambito di piccoli volumi di terreno, quando questi assumano importanza per lo stato limite considerato. È questo il caso, ad esempio, delle verifiche SLU dei pali in condizioni non drenate, in termini di tensioni totali, nelle quali per la determinazione del contributo di resistenza alla punta è appropriata la valutazione del valore caratteristico della resistenza non drenata mediante una media locale effettuata nel volume di terreno interessato dal meccanismo di collasso indotto dalla punta stessa."),
        ],
    },
    {
        number: "C6.2.2.5", title: "RELAZIONE GEOTECNICA", manual: false,
        blocks: [
            h(181, 36, "C6.2.2.5 RELAZIONE GEOTECNICA"),
            p(181, 37, 39, "La relazione geotecnica contiene i principali risultati ottenuti dalle indagini e prove geotecniche, descrive la caratterizzazione e la modellazione geotecnica dei terreni interagenti con l’opera e riassume i risultati delle analisi svolte per la verifica delle condizioni di sicurezza e la valutazione delle prestazioni nelle condizioni d’esercizio del sistema costruzione-terreno."),
            p(181, 40, 41, "I contenuti della relazione geotecnica, modulati in relazione alla fase progettuale, al tipo di opera ed al contesto in cui essa si inserisce, sono indicativamente i seguenti:"),
            li(181, 42, 42, "descrizione del sito, delle opere e degli interventi;"),
            li(181, 43, 43, "valutazione della pericolosità ambientale (stabilità del territorio in condizioni statiche e sismiche);"),
            li(181, 44, 44, "risposta sismica locale;"),
            li(181, 45, 45, "problemi geotecnici e scelte tipologiche;"),
            li(181, 46, 46, "identificazione degli stati limite per le opere in progetto e metodi di analisi;"),
            li(181, 47, 47, "descrizione del programma delle indagini e delle prove geotecniche;"),
            li(181, 48, 48, "caratterizzazione fisica e meccanica dei terreni e delle rocce e definizione dei valori caratteristici dei parametri geotecnici;"),
            li(181, 49, 49, "modelli geotecnici di sottosuolo con indicazione dei valori caratteristici e di progetto dei parametri geotecnici;"),
            li(181, 50, 50, "risultati delle analisi;"),
            li(181, 51, 51, "confronto dei risultati con le prestazioni previste per le opere;"),
            li(181, 52, 52, "prescrizioni sulle modalità costruttive;"),
            li(181, 53, 53, "eventuale piano di monitoraggio in corso d’opera e in esercizio."),
            p(182, 3, 6, "La relazione è inoltre corredata da una planimetria con l’ubicazione delle indagini, sia quelle appositamente effettuate, sia quelle di carattere storico e di esperienza locale eventualmente disponibili, dalla documentazione sulle indagini in sito e in laboratorio, da un numero adeguato di sezioni stratigrafiche con indicazione dei profili delle grandezze misurate (resistenza alla punta di prove penetrometriche, altezze piezometriche, valori della velocità di propagazione delle onde di taglio, ecc.)."),
            p(182, 7, 11, "Nel caso di impiego del metodo osservazionale di cui al § 6.2.5 delle NTC, la relazione geotecnica comprende la descrizione delle possibili soluzioni progettuali alternative, con le relative verifiche, e la specificazione dei parametri di controllo per l’adozione di una delle soluzioni previste e dei relativi limiti di accettabilità. A questo fine, il piano di monitoraggio include l’individuazione della specifica strumentazione di controllo e la definizione delle procedure di acquisizione, archiviazione ed elaborazione delle misure."),
        ],
    },
    {
        number: "C6.2.3", title: "FASI E MODALITÀ COSTRUTTIVE", manual: false,
        blocks: [h(182, 12, "C6.2.3 FASI E MODALITÀ COSTRUTTIVE"), p(182, 13, 14, "La definizione, nel progetto, delle fasi esecutive di cui al § 6.2.3 delle NTC, comprende anche l’individuazione dei connessi stati limite ultimi e di esercizio.")],
    },
    {
        number: "C6.2.4", title: "VERIFICHE DELLA SICUREZZA E DELLE PRESTAZIONI", manual: false,
        blocks: [
            h(182, 15, "C6.2.4 VERIFICHE DELLA SICUREZZA E DELLE PRESTAZIONI"),
            p(182, 16, 17, "Conseguentemente ai principi generali enunciati nelle NTC, la progettazione geotecnica si basa sul metodo degli stati limite e sull’impiego dei coefficienti parziali di sicurezza."),
            p(182, 18, 19, "Nel metodo degli stati limite, ultimi e di esercizio, i coefficienti parziali sono applicati alle azioni, agli effetti delle azioni, alle caratteristiche dei materiali e alle resistenze."),
            p(182, 20, 21, "I coefficienti parziali possono essere diversamente raggruppati e combinati tra loro in funzione del tipo e delle finalità delle verifiche, nei diversi stati limite considerati."),
        ],
    },
    {
        number: "C6.2.4.1", title: "VERIFICHE NEI CONFRONTI DEGLI STATI LIMITE ULTIMI (SLU)", manual: false,
        blocks: [
            h(182, 22, "C6.2.4.1 VERIFICHE NEI CONFRONTI DEGLI STATI LIMITE ULTIMI (SLU)"),
            p(182, 23, 23, "Si considerano cinque stati limite ultimi che, mantenendo la denominazione abbreviata delle UNI EN 1990, sono così identificati:"),
            p(182, 24, 24, "EQU perdita di equilibrio della struttura fuori terra, considerata come corpo rigido;"),
            p(182, 25, 26, "STR raggiungimento della resistenza degli elementi strutturali, compresi gli elementi di fondazione e tutti gli altri elementi strutturali che eventualmente interagiscono con il terreno;"),
            p(182, 27, 28, "GEO raggiungimento della resistenza del terreno interagente con la struttura con sviluppo di meccanismi di collasso dell’insieme terreno-struttura;"),
            p(182, 29, 29, "UPL perdita di equilibrio della struttura o del terreno, dovuta alla spinta dell’acqua (sollevamento per galleggiamento);"),
            p(182, 30, 30, "HYD erosione e sifonamento del terreno dovuta ai gradienti idraulici."),
            p(182, 31, 36, "Nei paragrafi successivi questi stati limite sono specificati per i diversi tipi di opere e sistemi geotecnici. Tra gli stati limite GEO si possono menzionare, a mero titolo di esempio, gli stati limite che riguardano la capacità portante del complesso fondazione terreno e lo scorrimento sul piano di posa di fondazioni superficiali e muri di sostegno, la rotazione intorno a un punto di una paratia a sbalzo o con un livello di vincolo, ecc. In questi casi si esegue, di fatto, una verifica del sistema geotecnico nei confronti di un meccanismo di collasso che può implicare anche la plasticizzazione degli elementi strutturali (è il caso, ad esempio, della resistenza a carico limite sotto forze trasversali dei pali di fondazione."),
            p(182, 37, 40, "Nelle verifiche di sicurezza rispetto agli stati limite ultimi strutturale e geotecnico, la Norma individua per ogni opera e per ogni stato limite l’approccio progettuale a cui fare riferimento, privilegiando per quanto possibile l’Approccio 2, anche per la semplificazione conseguente all’impiego di una sola combinazione di coefficienti di sicurezza parziali, così come riportato nelle NTC."),
            p(182, 41, 42, "Il riferimento all’Approccio 1 è stato tuttavia mantenuto in quei casi per i quali può manifestarsi qualche ambiguità, non risolvibile a priori, sugli effetti delle azioni permanenti nelle verifiche di tipo geotecnico."),
            p(182, 43, 44, "Per consentire l’impiego più appropriato dell’Approccio 1, è opportuno richiamare i due presupposti fondamentali sui quali sono basate le verifiche rispetto a SLU di tipo geotecnico e di tipo strutturale in entrambi gli approcci progettuali:"),
            li(182, 45, 49, "1) le verifiche SLU di tipo geotecnico hanno lo scopo di controllare che l’opera sia dimensionata in modo da garantire un adeguato margine di sicurezza nei riguardi della formazione di uno o più meccanismi di collasso del terreno, che eventualmente possono coinvolgere anche gli elementi strutturali. Il controllo si esercita mediante la fattorizzazione delle azioni e delle resistenze nell’Approccio 2 e delle sole azioni variabili e dei parametri di resistenza nell’Approccio 1 combinazione A2+M2+R2;"),
            cross("list-item", [{ page: 182, from: 50, to: 54 }, { page: 183, from: 3, to: 14 }], "2) le verifiche SLU di tipo strutturale fanno sempre riferimento al raggiungimento locale della resistenza di progetto e, per questo motivo, richiedono la verifica delle singole sezioni. Una verifica di questo genere, per opere che interagiscano con il terreno, non può che scaturire da un’analisi d’interazione del sistema terreno-struttura, in cui svolge un ruolo preminente la rigidezza di entrambi i componenti del sistema. Nello studio dell’interazione terreno-struttura effettuata con modelli costitutivi non lineari dei terreni, spesso utilizzati nelle analisi numeriche geotecniche, la rigidezza del terreno dipende anche dalle caratteristiche di resistenza e sarebbe alterata in presenza di una loro fattorizzazione con coefficienti parziali. Inoltre, in tali analisi, la fattorizzazione dei soli parametri di resistenza modificherebbe il rapporto rigidezza-resistenza del terreno alterando la distribuzione delle tensioni di contatto. Per queste ragioni le analisi d’interazione devono pertanto essere effettuate senza alcuna fattorizzazione di questi parametri, impiegando quindi i loro valori caratteristici. Anche la fattorizzazione dei carichi non è possibile in queste analisi poiché comporterebbe un’artificiosa alterazione delle condizioni di plasticizzazione del terreno e, conseguentemente, una irrealistica ridistribuzione delle tensioni di contatto. Le analisi d’interazione devono essere svolte impiegando i valori caratteristici anche delle azioni. Il margine di sicurezza è poi introdotto fattorizzando opportunamente le sollecitazioni risultanti dall’analisi d’interazione. Poiché nelle verifiche strutturali si adottano sempre valori unitari dei coefficienti γ_R, che fattorizzano la resistenza, questo procedimento è comune sia all’Approccio 1 combinazione A1+M1+R1 sia all’Approccio 2."),
            p(183, 15, 17, "La Combinazione A2+M2+R2 dell’Approccio 1 è la sola che deve essere utilizzata per le verifiche di stabilità globale della parte di sottosuolo su cui insistono le opere di fondazione e di sostegno, nonché per le verifiche della stabilità dei fronti di scavo e dei paramenti delle opere di materiali sciolti."),
            p(183, 18, 22, "Lo stato limite di ribaltamento dei muri di sostegno è compreso nelle verifiche GEO, da condurre con l’Approccio 2, diversamente da quanto previsto nelle NTC08 nelle quali era trattato come uno stato limite di equilibrio di corpo rigido (EQU). Questa scelta è stata effettuata per evitare che la verifica a ribaltamento richieda una differente determinazione della spinta rispetto a quella da utilizzare per le verifiche a scorrimento e a carico limite. Le verifiche EQU, ai fini geotecnici, sono limitate al ribaltamento di strutture fuori terra, quali ciminiere, cartelloni pubblicitari, torri, ecc., rispetto ad una estremità della fondazione."),
        ],
    },
    {
        number: "C6.2.4.2", title: "VERIFICHE NEI CONFRONTI DEGLI STATI LIMITE ULTIMI IDRAULICI", manual: false,
        blocks: [
            h(183, 23, "C6.2.4.2 VERIFICHE NEI CONFRONTI DEGLI STATI LIMITE ULTIMI IDRAULICI"),
            p(183, 24, 28, "Gli stati limite UPL e HYD si riferiscono a stati limite ultimi di tipo idraulico (§ 6.2.4.2 NTC). Ad esempio, gli stati limite di sollevamento per galleggiamento di strutture interrate (parcheggi sotterranei, stazioni metropolitane, ecc.) o di opere marittime devono essere trattati come stati limite di equilibrio UPL. Al contrario, lo stato limite di sifonamento al quale corrisponde l’annullamento delle tensioni efficaci e che può essere prodotto da moti di filtrazione diretti dal basso verso l’alto, devono essere trattati come stati limite HYD."),
            p(183, 29, 30, "Gli stati limite HYD sono stati trattati diversamente rispetto alle precedenti norme tecniche, semplificando il procedimento nelle situazioni più frequenti di frontiera di efflusso libera o con un carico imposto."),
        ],
    },
    {
        number: "C6.2.4.3", title: "VERIFICHE NEI CONFRONTI DEGLI STATI LIMITE DI ESERCIZIO (SLE)", manual: false,
        blocks: [h(183, 31, "C6.2.4.3 VERIFICHE NEI CONFRONTI DEGLI STATI LIMITE DI ESERCIZIO (SLE)"), p(183, 32, 35, "Per le opere e i sistemi geotecnici, gli stati limite di esercizio si riferiscono generalmente al raggiungimento di valori critici di spostamenti e rotazioni, assoluti e/o relativi, e distorsioni che possano compromettere la funzionalità dell’opera. È quindi necessario valutare, utilizzando i valori caratteristici delle azioni e delle resistenze dei materiali, gli spostamenti e le rotazioni delle opere, nonché il loro andamento nel tempo.")],
    },
    {
        number: "C6.3", title: "STABILITÀ DEI PENDII NATURALI", manual: false,
        blocks: [h(183, 36, "C6.3 STABILITÀ DEI PENDII NATURALI")],
    },
    {
        number: "C6.3.1", title: "PRESCRIZIONI GENERALI", manual: false,
        blocks: [
            h(183, 37, "C6.3.1 PRESCRIZIONI GENERALI"),
            p(183, 38, 39, "Nel caso della stabilità dei pendii naturali che siano interessati da movimenti franosi, potenziali o in atto, la cui scala di riferimento sia quella del singolo pendio, vale quanto nel seguito riportato."),
            p(183, 40, 40, "Nello studio delle condizioni di stabilità dei pendii naturali sono presi in considerazione almeno i seguenti fattori:"),
            li(183, 41, 41, "le caratteristiche geologiche e gli assetti geologico-strutturali del sito;"),
            li(183, 42, 42, "gli assetti geomorfologici e l’evoluzione morfologica;"),
            li(183, 43, 43, "la sismicità dell’area e le evidenze di fenomeni di instabilità pregressi sismo-indotti;"),
            li(183, 44, 44, "le condizioni climatiche ed in particolare la distribuzione nel tempo degli eventi meteorici significativi;"),
            li(183, 45, 45, "gli assetti idrogeologici;"),
            li(183, 46, 46, "il regime idrico superficiale;"),
            li(183, 47, 47, "le caratteristiche geometriche del pendio;"),
            li(183, 48, 48, "le caratteristiche cinematiche della frana;"),
            li(183, 49, 49, "il regime delle pressioni interstiziali e delle pressioni dell’acqua nelle discontinuità eventualmente presenti;"),
            li(183, 50, 50, "le proprietà fisiche e meccaniche dei terreni e delle rocce costituenti il pendio e quelle che caratterizzano le discontinuità;"),
            li(183, 51, 51, "peso proprio e azioni applicate sul pendio."),
        ],
    },
    {
        number: "C6.3.2", title: "MODELLAZIONE GEOLOGICA DEL PENDIO", manual: false,
        blocks: [
            h(184, 18, "C6.3.2 MODELLAZIONE GEOLOGICA DEL PENDIO"),
            p(184, 19, 21, "Lo studio geologico di un pendio naturale, finalizzato alla valutazione delle condizioni di stabilità, consiste nella definizione dell’assetto lito-strutturale, geomorfologico e idrogeologico del versante al fine di identificare i meccanismi e i cinematismi di rottura attuali o potenziali, nonché le possibili cause."),
            p(184, 22, 25, "Con tali riferimenti viene definito l’ambito geomorfologico significativo che corrisponde a quella porzione di territorio, identificabile cartograficamente sul terreno e delimitabile anche in profondità, nella quale sussistano assetti predisponenti ad una specifica tipologia di movimento franoso ed in cui i processi morfo-evolutivi di versante/fondovalle possano interferire direttamente o indirettamente con l’area d’interesse."),
            p(184, 26, 30, "L’obiettivo dello studio geologico di un versante è, pertanto, quello di costruire un modello geologico finalizzato, oltre che alla illustrazione dei predetti assetti, anche alla conoscenza delle condizioni evolutive che hanno prodotto l’attuale assetto lito-strutturale, idrogeologico e geomorfologico, con connessa analisi dettagliata dello stato e tipo di attività delle eventuali instabilità presenti. La ricostruzione dell’assetto litostratigrafico e strutturale del versante deve integrare, in una specifica modellazione, sia rilievi di superficie sia indagini specifiche del sottosuolo."),
            p(184, 31, 33, "L’evoluzione di un versante naturale, e di conseguenza anche la sua stabilità, può essere condizionata da situazioni geologiche locali non riportate nella cartografia geologica o non visibili in superficie, che richiedono, quindi, una caratterizzazione geologica di dettaglio. Pertanto, dovrà essere posta particolare attenzione:"),
            li(184, 34, 34, "alla presenza di specifici assetti che inducono condizioni di suscettibilità a movimenti franosi;"),
            li(184, 35, 35, "alla presenza e alla giacitura di intercalazioni anche sottili di litotipi a minore resistenza;"),
            li(184, 36, 37, "alla sovrapposizione stratigrafica o tettonica di litotipi con differenti caratteristiche litologiche, idrogeologiche e geostrutturali;"),
            li(184, 38, 38, "al grado di alterazione degli ammassi rocciosi;"),
            li(184, 39, 39, "all’esistenza di discontinuità ad elevata persistenza ed all’eventuale materiale di riempimento."),
            p(184, 40, 44, "Nel caso di presenza di eventi di frana nell’area di specifico interesse, i dati scaturenti dalle attività di indagine, sia di superficie sia in profondità, dovranno condurre ad una dettagliata ricostruzione dell’evento nelle tre dimensioni attraverso specifiche planimetrie (carta della frana) e sezioni illustrative. Soprattutto quando si è in presenza di eventi attivi può essere necessario integrare i dati dei rilievi con misure di spostamento superficiale o profondo del pendio e con i dati di monitoraggio più in generale, al fine di validare il modello geologico."),
        ],
    },
    {
        number: "C6.3.3", title: "MODELLAZIONE GEOTECNICA DEL PENDIO", manual: false,
        blocks: [
            h(184, 45, "C6.3.3 MODELLAZIONE GEOTECNICA DEL PENDIO"),
            p(184, 46, 47, "Tenendo conto del modello geologico di riferimento, lo studio geotecnico di un pendio è finalizzato all’identificazione del suo modello geotecnico ed implica:"),
            li(184, 48, 48, "la definizione dei caratteri geometrici e cinematici dell’eventuale corpo di frana;"),
            li(184, 49, 50, "l’acquisizione dei dati necessari alle analisi, quali le caratteristiche meccaniche e idrauliche dei terreni o delle rocce presenti;"),
            li(184, 51, 51, "la valutazione del comportamento delle discontinuità e del regime delle pressioni interstiziali."),
            p(184, 52, 55, "Ricostruito il modello geotecnico del pendio, lo studio geotecnico si completa con la valutazione delle condizioni di stabilità attuali e future, in relazione alla realizzazione di nuovi manufatti e in base anche alle possibili evoluzione delle condizioni climatiche e ambientali, con il dimensionamento degli eventuali interventi di stabilizzazione e la programmazione del piano di monitoraggio."),
        ],
    },
    {
        number: "C6.3.4", title: "VERIFICHE DI SICUREZZA", manual: false,
        blocks: [
            h(185, 42, "C6.3.4 VERIFICHE DI SICUREZZA"),
            p(185, 43, 50, "Le verifiche di sicurezza si eseguono utilizzando i valori caratteristici dei parametri di resistenza congruenti con lo stato e l’evoluzione del cinematismo della frana, facendo riferimento, nelle situazioni più frequenti, ai valori dei parametri di resistenza di post-picco o, nel caso di possibile riattivazione di frane preesistenti, ai valori residui. Il coefficiente di sicurezza è definito dal rapporto tra la resistenza unitaria al taglio disponibile lungo la superficie di scorrimento (esistente o potenziale) e lo sforzo di taglio mobilitato lungo di essa. Il suo valore minimo deve essere scelto e motivato dal progettista in relazione al livello di affidabilità dei dati acquisiti, alla validità del modello di calcolo utilizzato, nonché al livello di protezione che si vuole garantire e che è funzione delle conseguenze di un eventuale fenomeno franoso. È necessario inoltre adottare valori cautelativi delle pressioni interstiziali nelle verifiche di sicurezza."),
            p(185, 51, 52, "Le verifiche devono essere eseguite anche per le combinazioni sismiche previste dalle NTC, secondo quanto disposto nel § 7.11 delle NTC stesse."),
        ],
    },
    {
        number: "C6.3.5", title: "INTERVENTI DI STABILIZZAZIONE", manual: false,
        blocks: [
            h(185, 53, "C6.3.5 INTERVENTI DI STABILIZZAZIONE"),
            cross("paragraph", [{ page: 185, from: 54, to: 57 }, { page: 186, from: 3, to: 5 }], "Nel dimensionamento degli interventi di stabilizzazione devono essere valutate le condizioni di stabilità iniziali, prima dell’esecuzione dell’intervento, e quelle finali, ad intervento eseguito, in modo da valutare l’incremento del margine di sicurezza rispetto al cinematismo di collasso critico potenziale o effettivo. In dipendenza della tipologia di intervento deve essere valutata l’evoluzione temporale dell’incremento del coefficiente di sicurezza nel tempo, per garantire il raggiungimento di condizioni di stabilità adeguate in tempi compatibili con i requisiti di progetto. In ogni caso, le condizioni di stabilità devono essere verificate non solo lungo il cinematismo di collasso critico originario, ma anche lungo possibili cinematismi alternativi che possano innescarsi a seguito della realizzazione dell’intervento di stabilizzazione."),
            p(186, 6, 13, "Se un pendio è interessato da una nuova costruzione, il progettista deve verificare la stabilità del pendio prima della realizzazione dell’opera, quantificandone il coefficiente di sicurezza nelle condizioni più critiche. Se in queste condizioni il valore del coefficiente di sicurezza è giudicato adeguato alla nuova costruzione si procede alle verifiche dell’opera, valutandone anche la stabilità globale secondo quanto prescritto nel § 6.8.2. Il progettista deve poi rianalizzare la stabilità del pendio tenendo conto della presenza della nuova costruzione e controllando che il valore del coefficiente di sicurezza non risulti inferiore al valore ottenuto con l’analisi effettuata prima della costruzione dell’opera. In caso contrario, è necessario predisporre interventi di stabilizzazione del pendio per riportarne il margine di sicurezza finale almeno pari a quello precedente la realizzazione della nuova opera."),
            p(186, 14, 18, "Nel caso di frane di ampie dimensioni, per le quali non sempre è possibile giungere alla stabilizzazione, gli interventi possono essere progettati con il fine di rallentare l’evoluzione dei fenomeni in atto. In tal caso, l’efficacia di un intervento sul pendio deve essere valutata in termini di riduzione della pericolosità. Poiché l’obiettivo finale è la mitigazione del rischio per la vita umana e per le proprietà, in alcuni casi possono essere concepiti interventi di protezione (reti paramassi, vasche di accumulo, ecc.), che non incidono sulla pericolosità dell’evento franoso ma sulla protezione di persone e cose."),
        ],
    },
    {
        number: "C6.3.6", title: "CONTROLLI E MONITORAGGIO", manual: false,
        blocks: [
            h(186, 19, "C6.3.6 CONTROLLI E MONITORAGGIO"),
            p(186, 20, 23, "Il piano dei controlli e di monitoraggio dei pendii è parte integrante del piano di indagini ed è uno strumento essenziale per validare le ipotesi sulla sicurezza del pendio e l’efficacia degli interventi di stabilizzazione. In situazioni particolari, il monitoraggio continuo del pendio è funzionale alla gestione della sicurezza dei manufatti presenti e rappresenta un metodo per la mitigazione del rischio rispetto ai fenomeni di instabilità per frana."),
            p(186, 24, 28, "Il primo obiettivo del monitoraggio è quello di fornire un quadro di riferimento del comportamento del pendio prima di attuare un intervento di stabilizzazione. Si dovranno a questo fine installare dispositivi che permettano di misurare l’evoluzione di grandezze fisiche significative quali spostamenti, superficiali e profondi, e pressioni interstiziali. Le misure dovranno essere messe in relazione con i dati di natura meteoclimatica resi disponibili da stazioni di osservazione presenti nella zona, ovvero installate appositamente."),
            p(186, 29, 31, "Quando possibile, il monitoraggio del pendio si avvale delle informazioni sullo stato di deformazione e/o fessurazione di manufatti presenti. In tal caso è necessario conoscere l’organizzazione strutturale del manufatto con particolare riferimento alla tipologia e profondità delle fondazioni."),
            p(186, 32, 34, "Il controllo del pendio nel corso del tempo ed a seguito di un intervento di stabilizzazione si esegue attraverso il monitoraggio delle grandezze fisiche significative ai fini della mitigazione del rischio di instabilità o di danneggiamento dei manufatti e dei beni esistenti. Tipiche grandezze fisiche da monitorare sono:"),
            li(186, 35, 35, "parametri ambientali (piogge, temperatura, neve);"),
            li(186, 36, 36, "accelerazioni sismiche al suolo;"),
            li(186, 37, 37, "pressioni interstiziali e suzioni (nei terreni insaturi);"),
            li(186, 38, 38, "spostamenti assoluti di punti sulla superficie e in profondità;"),
            li(186, 39, 39, "spostamenti relativi tra punti interni ad un eventuale corpo di frana;"),
            li(186, 40, 40, "deformazioni di elementi strutturali."),
            p(186, 41, 44, "Il sistema di controllo da mettere in opera dovrà essere progettato in relazione alla pericolosità del fenomeno e al rischio ad essa connesso. Il rischio deve poi essere differenziato tra rischio per le cose e rischio per la vita umana. Quest’ultimo è anche funzione della velocità di sviluppo dell’evento franoso. Pertanto, nei casi di fenomeni di crollo potenziale, per limitare il rischio per la vita umana il monitoraggio dovrà essere continuo."),
            p(186, 45, 47, "La tipologia dei fenomeni franosi attesi condiziona la frequenza e le modalità di misura. Tenuto conto della particolarità dell’ambiente fisico in cui si deve svolgere il monitoraggio, la disposizione della strumentazione ed il numero dei sensori, dovranno essere scelti in base a principi di ridondanza ed affidabilità del sistema complessivo."),
        ],
    },
    {
        number: "C6.4", title: "OPERE DI FONDAZIONE", manual: false,
        blocks: [h(186, 48, "C6.4 OPERE DI FONDAZIONE"), p(186, 49, 50, "Le fondazioni sono distinte in fondazioni superficiali, o dirette (ad es.: plinti, travi, platee), e fondazioni profonde (ad es.: pali, pozzi, cassoni).")],
    },
    {
        number: "C6.4.1", title: "CRITERI GENERALI DI PROGETTO", manual: false,
        blocks: [h(186, 51, "C6.4.1 CRITERI GENERALI DI PROGETTO"), p(186, 52, 53, "La progettazione delle opere di fondazione deve essere svolta contestualmente a quella delle strutture in elevazione, tenendo conto delle condizioni geotecniche e delle prestazioni richieste alla costruzione nel suo complesso.")],
    },
];

const cell = (text: string, latex?: string, extra: Record<string, number> = {}): any => ({ text, ...(latex ? { latex } : {}), ...extra });
const table = {
    id: tableId("C6.2.I"),
    unit: "C6.2.2.1",
    number: "C6.2.I",
    page: 179,
    caption: "Tabella C6.2.I - Mezzi di indagine e prove geotecniche in sito",
    columnCount: 3,
    headers: [],
    rows: [
        [cell("Stratigrafia", undefined, { rowSpan: 1 }), cell(""), cell("Trincee\nPozzi\nCunicoli\nSondaggi a carotaggio continuo\nProve penetrometriche\nIndagini di tipo geofisico (*)")],
        [cell("Proprietà fisiche e meccaniche", undefined, { rowSpan: 3 }), cell("Terreni a grana fine"), cell("Prove penetrometriche\nProve scissometriche\nProve dilatometriche\nProve pressiometriche\nProve di carico su piastra\nProve di laboratorio\nProve di tipo geofisico (*)")],
        [cell("Terreni a grana grossa"), cell("Prove penetrometriche\nProve di carico su piastra\nProve di laboratorio\nProve di tipo geofisico (*)")],
        [cell("Rocce"), cell("Prove speciali in sito (prove di taglio)\nProve di carico su piastra\nProve di laboratorio\nProve di tipo geofisico (*)")],
        [cell("Misure di pressione interstiziale"), cell("Terreni di qualsiasi tipo"), cell("Piezometri")],
        [cell("Permeabilità", undefined, { rowSpan: 2 }), cell("Terreni a grana fine"), cell("Misure piezometriche\nProve di laboratorio")],
        [cell("Terreni a grana grossa"), cell("Prove idrauliche in fori di sondaggio\nProve di emungimento da pozzi")],
        [cell("Verifica di procedimenti tecnologici", undefined, { rowSpan: 3 }), cell("Palificate"), cell("Prove di carico su pali singoli\nProve di carico su gruppi di pali")],
        [cell("Impermeabilizzazioni"), cell("Prove di permeabilità in sito e misura di altezza piezometrica prima e dopo l’intervento")],
        [cell("Consolidamenti"), cell("Determinazione delle proprietà meccaniche in sito prima e dopo l’intervento\nProve di laboratorio")],
        [cell("(*) Indagini di tipo geofisico", undefined, { rowSpan: 3 }), cell("In foro con strumentazione in profondità"), cell("Cross hole\nDown hole")],
        [cell("Senza esecuzioni di fori, con strumentazione in profondità"), cell("Penetrometro sismico\nDilatometro sismico")],
        [cell("Con strumentazione in superficie"), cell("Prove SASW o MASW\nProve di rifrazione sismica\nProve di riflessione sismica")],
    ],
    notes: ["Trascrizione strutturata verificata sul render delle pagine PDF 179–180; revisione umana cella per cella ancora obbligatoria."],
};

function blockRecord(unit: UnitSpec, block: BlockSpec, index: number): any {
    const id = uid(unit.number);
    const blockId = `${id}#block-${index === 0 ? "heading" : `editorial-${String(index).padStart(3, "0")}`}`;
    if (block.kind === "table-ref") {
        const source = raw(block.parts);
        return { blockId, kind: block.kind, origin: "official", assetId: block.asset, evidence: evidence(block.parts, source, false, true) };
    }
    const normalized = block.text ?? "";
    const source = block.manual ? normalized : raw(block.parts);
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
    const blocks = unit.blocks.map((block, index) => blockRecord(unit, block, index));
    const ancestorParts = pathNumbers.slice(0, -1);
    const assetIds = blocks.filter((block: any) => block.kind === "table-ref").map((block: any) => block.assetId);
    const hasNtcEquivalent = !/^C6\.2\.2\.[1-5]$/u.test(unit.number);
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
        hierarchy: {
            parentId: ancestorParts.length ? uid(ancestorParts.at(-1)!) : null,
            ancestorIds: ancestorParts.map((ancestor) => uid(ancestor)),
            position: Number(parts[parts.length - 1]),
        },
        validity: { from: null, to: null, status: "unknown", asOf: "2026-08-09" },
        blocks,
        citations: [],
        relations: hasNtcEquivalent ? [{
            relationId: `${id}#relation-001`,
            type: "clarifies",
            targetUnitId: `urn:structural-codes:it:unit:ntc2018:${unit.number.slice(1)}`,
            basis: "editorial",
            evidenceBlockIds: [`${id}#block-heading`],
            rationale: "Corrispondenza proposta tra numerazione omologa della Circolare e delle NTC; richiede conferma umana sul contenuto completo.",
            review: { status: "proposed", reviewedBy: null, reviewedAt: null },
        }] : [],
        assets: { formulaIds: [], tableIds: assetIds, figureIds: [] },
        workflow: {
            status: "extracted",
            createdBy: { actorId: "generator:circ6:step1", kind: "script", toolVersion: profile },
            createdAt,
            reviews: [],
            openIssues: [
                { issueId: `circ2019-${unit.number.toLowerCase().replaceAll(".", "-")}-source-review`, type: "normalization-review", severity: "blocking", note: "Trascrizione confrontata con il render ufficiale nello step; resta obbligatoria la revisione umana indipendente prima della pubblicazione." },
                { issueId: `circ2019-${unit.number.toLowerCase().replaceAll(".", "-")}-relation`, type: "relation-review", severity: "blocking", note: "Il collegamento Circolare-NTC per numerazione omologa richiede conferma umana." },
                ...(unit.manual ? [{ issueId: `circ2019-${unit.number.toLowerCase().replaceAll(".", "-")}-missing-text-layer`, type: "missing-region", severity: "blocking", note: "Il layer testuale ufficiale delle pagine PDF 177–178 non è sufficiente; il contenuto è stato trascritto manualmente dal render ufficiale." }] : []),
                ...(assetIds.length ? [{ issueId: `circ2019-${unit.number.toLowerCase().replaceAll(".", "-")}-assets`, type: "asset-review", severity: "blocking", note: "La tabella è stata strutturata e collocata nel flusso originario; resta obbligatorio il confronto umano cella per cella con la fonte ufficiale." }] : []),
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
    section: "C6-step1",
    sourceId,
    status: "transcribed-unreviewed",
    formulas: [],
    tables: [{ id: table.id, unitId: uid(table.unit), officialNumber: table.number, pdfPage: table.page, caption: table.caption, columnCount: table.columnCount, headers: table.headers, rows: table.rows, notes: table.notes }],
    figures: [],
};
await writeFile(join(assetDir, "C6-step1.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

console.log(`circ6-step1: generated ${units.length} units and 1 table`);
