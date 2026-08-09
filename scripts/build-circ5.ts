/* eslint-disable @typescript-eslint/no-explicit-any */
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const sourceId = "circ-7-2019";
const profile = "circ5-manual-render-transcription-0.1.0";
const createdAt = "2026-08-09T12:00:00Z";
const sourceDir = join(root, "evidence", sourceId, "pages");
const unitDir = join(root, "corpus", "units", "circ2019");
const assetDir = join(root, "corpus", "assets", "circ2019");

type TextKind = "heading" | "paragraph" | "list-item";
type AssetKind = "formula-ref" | "table-ref" | "figure-ref";
type BlockSpec = {
    kind: TextKind | AssetKind;
    page: number;
    from: number;
    to?: number;
    text?: string;
    assetId?: string;
};
type UnitSpec = { number: string; title: string; blocks: BlockSpec[] };

const pageLines = new Map<number, string[]>();
for (let page = 167; page <= 176; page += 1) {
    const filename = join(sourceDir, `page-${String(page).padStart(4, "0")}.raw.txt`);
    pageLines.set(page, (await readFile(filename, "utf8")).replace(/\r\n/gu, "\n").split("\n"));
}

const sha256 = (value: string | Uint8Array): string => createHash("sha256").update(value).digest("hex");
const uid = (number: string): string => `urn:structural-codes:it:unit:circ2019:${number.toLowerCase()}`;
const asset = (kind: "formula" | "table" | "figure", number: string): string => `urn:structural-codes:it:asset:${kind}:circ2019:c5.${number}`;
const source = (page: number, from: number, to = from): string => pageLines.get(page)!.slice(from - 1, to).join("\n");

function transformations(): any[] {
    return [
        { operation: "join-line-wrap", ruleVersion: profile, note: "Ricomposti i ritorni a capo tipografici verificati sul render ufficiale." },
        { operation: "remove-control-character", ruleVersion: profile, note: "Rimossi i caratteri di controllo privi di resa visuale dal layer testuale." },
        { operation: "manual-correction", ruleVersion: profile, note: "Ripristinati accenti, apostrofi, sillabazioni, simboli e formule verificati sul render ufficiale." },
        { operation: "normalize-whitespace", ruleVersion: profile, note: "Uniformati gli spazi dopo la ricomposizione del testo." },
    ];
}

const mathTerms: Array<[string, string]> = [
    ["Δφ_fat", "\\Delta\\varphi_{\\mathrm{fat}}"], ["ΔT_exp,d", "\\Delta T_{\\mathrm{exp,d}}"], ["ΔT_con,d", "\\Delta T_{\\mathrm{con,d}}"],
    ["ΔT_exp,k", "\\Delta T_{\\mathrm{exp,k}}"], ["ΔT_con,k", "\\Delta T_{\\mathrm{con,k}}"], ["T_e,max", "T_{\\mathrm{e,max}}"], ["T_e,min", "T_{\\mathrm{e,min}}"],
    ["Q_{sv1}", "Q_{\\mathrm{sv1}}"], ["Q_{sv2}", "Q_{\\mathrm{sv2}}"], ["Q_{1k}", "Q_{1k}"], ["γ_Q", "\\gamma_Q"], ["T_r", "T_r"],
    ["1/T_r", "1/T_r"], ["ΔT_0", "\\Delta T_0"], ["ΔT_exp", "\\Delta T_{\\mathrm{exp}}"], ["ΔT_con", "\\Delta T_{\\mathrm{con}}"],
    ["σ_max", "\\sigma_{\\max}"], ["σ_min", "\\sigma_{\\min}"], ["Δσ", "\\Delta\\sigma"], ["q_8", "q_8"], ["q_1", "q_1"],
    ["V_N", "V_N"], ["C_U", "C_U"], ["V_R", "V_R"], ["6÷7", "6\\div 7"], ["q_{f,r}", "q_{f,r}"],
    ["Q_sv1", "Q_{\\mathrm{sv1}}"], ["Q_sv2", "Q_{\\mathrm{sv2}}"], ["L", "L"], ["q", "q"], ["d", "d"], ["T_0", "T_0"],
];

function isBoundary(text: string, index: number, length: number): boolean {
    const before = index > 0 ? text[index - 1] ?? "" : "";
    const after = index + length < text.length ? text[index + length] ?? "" : "";
    return !/[A-Za-zÀ-ÿ0-9_]/u.test(before) && !/[A-Za-zÀ-ÿ0-9_]/u.test(after);
}

function inline(text: string): any[] | undefined {
    const candidates: Array<{ index: number; value: string; latex: string }> = [];
    for (const [value, latex] of mathTerms) {
        let cursor = 0;
        while (cursor < text.length) {
            const index = text.indexOf(value, cursor);
            if (index < 0) break;
            if (isBoundary(text, index, value.length)) candidates.push({ index, value, latex });
            cursor = index + value.length;
        }
    }
    if (!candidates.length) return undefined;
    candidates.sort((left, right) => left.index - right.index || right.value.length - left.value.length);
    const result: any[] = [];
    let cursor = 0;
    for (const candidate of candidates) {
        if (candidate.index < cursor) continue;
        if (candidate.index > cursor) result.push({ kind: "text", value: text.slice(cursor, candidate.index) });
        result.push({ kind: "math", value: candidate.value, latex: candidate.latex });
        cursor = candidate.index + candidate.value.length;
    }
    if (cursor < text.length) result.push({ kind: "text", value: text.slice(cursor) });
    return result.filter((segment) => segment.value.length > 0);
}

const h = (page: number, from: number, text: string, to = from): BlockSpec => ({ kind: "heading", page, from, to, text });
const p = (page: number, from: number, to: number, text: string): BlockSpec => ({ kind: "paragraph", page, from, to, text });
const li = (page: number, from: number, to: number, text: string): BlockSpec => ({ kind: "list-item", page, from, to, text });
const ref = (kind: AssetKind, page: number, assetId: string, from = 1, to = from): BlockSpec => ({ kind, page, from, to, assetId });

const formulaRef = (page: number, number: string, from: number, to = from): BlockSpec => ref("formula-ref", page, asset("formula", number), from, to);
const tableRef = (page: number, from: number, to: number): BlockSpec => ref("table-ref", page, asset("table", "delta-t0"), from, to);
const figureRef = (page: number, number: string, from: number, to = from): BlockSpec => ref("figure-ref", page, asset("figure", number), from, to);

const units: UnitSpec[] = [
    {
        number: "C5", title: "PONTI", blocks: [h(167, 3, "C5 PONTI", 4),
            p(168, 3, 4, "Il Capitolo 5 delle NTC tratta i criteri generali e le indicazioni tecniche per la progettazione e l’esecuzione dei ponti stradali e ferroviari."),
            p(168, 5, 6, "In particolare, per quanto riguarda i ponti stradali, oltre alle principali caratteristiche geometriche, vengono definite le diverse possibili azioni agenti ed assegnati gli schemi di carico corrispondenti alle azioni variabili da traffico."),
            p(168, 7, 8, "Gli schemi di carico stradali e ferroviari da impiegare per le verifiche statiche e a fatica sono generalmente coerenti con gli schemi delle UNI EN 1991-2, cui si può far riferimento per aspetti di dettaglio non trattati nelle NTC."),
            p(168, 9, 11, "I carichi da traffico per ponti stradali del modello principale sono indipendenti dall’estensione della zona caricata, includono gli effetti dinamici e sono indifferenziati per le verifiche locali e le verifiche globali, cosicché le possibili ambiguità e/o difficoltà applicative sono minimizzate."),
            p(168, 12, 13, "Per i ponti stradali sono anche forniti appositi modelli di carico per il calcolo degli effetti globali in ponti di luce superiore a 300 m."),
            p(168, 14, 15, "Per i ponti ferroviari particolare attenzione viene posta sui carichi ed i relativi effetti dinamici. Particolari e dettagliate prescrizioni vengono fornite per le verifiche, sia agli SLU sia agli SLE."),
            p(168, 16, 17, "I modelli di carico assegnati, sia per i ponti stradali che per i ponti ferroviari, sono modelli ideali, intesi a riprodurre gli effetti del traffico reale caratterizzati da assegnato periodo di ritorno. Essi non sono pertanto rappresentativi di veicoli o convogli reali."),
            p(168, 18, 21, "Si segnala ancora che i coefficienti parziali di sicurezza relativi ai sovraccarichi da traffico sono minori di quelli pertinenti ad altri sovraccarichi; infatti, il coefficiente γ_Q per le azioni da traffico stradale vale 1,35 per le combinazioni EQU e STR e 1,15 per la combinazione GEO, e il coefficiente γ_Q per le azioni da traffico ferroviario vale 1,45 per le combinazioni EQU e STR e 1,25 per la combinazione GEO."),
        ],
    },
    {
        number: "C5.1", title: "PONTI STRADALI", blocks: [h(168, 22, "C5.1 PONTI STRADALI")],
    },
    {
        number: "C5.1.2", title: "PRESCRIZIONI GENERALI", blocks: [h(168, 23, "C5.1.2 PRESCRIZIONI GENERALI")],
    },
    {
        number: "C5.1.2.3", title: "COMPATIBILITÀ IDRAULICA", blocks: [
            h(168, 24, "C5.1.2.3 COMPATIBILITÀ IDRAULICA"),
            p(168, 25, 28, "Ai fini dell’applicazione del punto 5.1.2.3 della Norma, s’intende per alveo la sezione occupata dal deflusso della portata di piena di progetto. Quest’ultima è a sua volta caratterizzata da un tempo di ritorno pari a T_r = 200 anni, dovendosi intendere tale valore quale il più appropriato da scegliere, non escludendo tuttavia valori anche maggiori che devono però essere adeguatamente motivati e giustificati."),
            p(168, 29, 32, "Gli elementi del ponte, quali le opere strutturali, di difesa ed accessorie, quando interessino l’alveo di un corso d’acqua, fanno parte di un progetto unitario corredato dallo studio di compatibilità idraulica di cui al punto 5.1.2.3 delle NTC. Il progetto sarà impostato tenendo in considerazione la necessità di garantire l’accesso per il ripristino dell’officiosità idraulica degli attraversamenti parzialmente o totalmente intasati dai detriti durante gli eventi di piena."),
            p(168, 33, 34, "Fermo restando quanto previsto dalla Norma, nello studio di compatibilità idraulica, in funzione delle diverse situazioni, è opportuno siano tra l’altro illustrati i seguenti aspetti:"),
            li(168, 35, 38, "analisi degli eventi di massima piena; esame dei principali eventi verificatisi nel corso d’acqua; raccolta dei valori estremi in quanto disponibili, e loro elaborazione in termini di frequenza probabile del verificarsi; per i ponti in sezioni di un corso d’acqua che abbiano a monte manufatti artificiali che limitino il naturale deflusso delle piene, queste sono da valutarsi anche nell’ipotesi che tali manufatti siano dismessi;"),
            li(168, 39, 40, "ricerca e raccolta, presso gli Uffici ed Enti competenti, delle notizie e dei rilievi esistenti, anche storici, utili per lo studio idraulico da svolgere;"),
            li(168, 41, 43, "giustificazione della soluzione proposta per: l’ubicazione del ponte, le sue dimensioni e le sue strutture in pianta, in elevazione ed in fondazione, tenuto conto del regime del corso d’acqua, dell’assetto morfologico attuale e della sua possibile evoluzione, nonché delle caratteristiche geotecniche della zona interessata;"),
            li(168, 44, 45, "allontanamento delle acque dall’impalcato e prevenzione del loro scolo incontrollato sulle strutture del ponte stesso o su infrastrutture sottostanti."),
            p(168, 46, 47, "Inoltre è di interesse stimare i valori della frequenza probabile (1/T_r) di ipotetici eventi che diano luogo a riduzioni del franco stesso."),
            p(168, 48, 48, "Nello studio idraulico, in funzione delle diverse situazioni, sono inoltre considerati, ove applicabili, i seguenti problemi:"),
            li(168, 49, 51, "classificazione del corso d’acqua ai fini dell’esercizio della navigazione interna: per ponti posti su vie classificate navigabili va rispettata la luce minima sotto il ponte che compete ai natanti per i quali il corso è classificato, fino alla portata per la quale sia consentita la navigazione;"),
            li(168, 52, 53, "valutazione dell’influenza dello scavo localizzato che si realizza in corrispondenza delle pile e delle spalle, sulla stabilità di argini e sponde, oltre che delle fondazioni di altri manufatti presenti nelle vicinanze;"),
            li(169, 3, 5, "esame delle conseguenze della presenza di corpi flottanti, considerando anche il possibile disormeggio dei natanti, trasportati dalle acque in relazione a possibili ostruzioni delle luci (specie se queste possono creare invasi anche temporanei a monte), sia in fase costruttiva sia durante l’esercizio delle opere;"),
            li(169, 6, 7, "sollecitazioni indotte dall’acqua per evento sismico quando sia di qualche rilievo la superficie immersa delle pile (e, per i ponti esistenti, delle spalle) con riferimento al livello idrico massimo che si verifica mediamente ogni anno."),
            p(169, 8, 12, "Per la stima del livello idrico massimo che si verifica mediamente ogni anno, in assenza di dati che garantiscano una robusta caratterizzazione statistica degli eventi, è da utilizzarsi il minimo fra i valori di portata massimi annuali registrati. Scalzamento e azioni idrodinamiche devono in tal caso essere combinate con tutte le altre azioni variabili, mentre nella situazione corrispondente all’evento di piena di progetto, nella combinazione con le altre azioni variabili sono da considerare solo quelle variabili da traffico."),
            p(169, 13, 13, "In situazioni particolarmente complesse può essere opportuno sviluppare le indagini anche con l’ausilio di modelli fisici."),
            p(169, 14, 18, "Quando, per caratteristiche del territorio e del corso d’acqua, si possa verificare nella sezione oggetto dell’attraversamento il transito di tronchi di rilevanti dimensioni, in aggiunta alla prescrizione di un franco normale minimo di 1,50 m, è da raccomandare che il dislivello tra fondo e sottotrave sia indicativamente non inferiore a 6÷7 m. Nel caso di corsi di acqua arginati, la quota di sottotrave sarà comunque non inferiore alla quota della sommità arginale per l’intera luce. Per tutti gli attraversamenti è opportuno sia garantito il transito dei mezzi di manutenzione delle sponde e/o delle arginature."),
            p(169, 19, 21, "Le limitazioni alle modifiche delle pile o delle spalle e relative fondazioni di ponti esistenti previste al punto 5.1.2.3 della Norma, sono da riferirsi agli elementi che interessano l’alveo, come sopra definito, o i corpi arginali. La possibilità di deroga, subordinata all’autorizzazione dell’Autorità competente come previsto allo stesso punto della norma, è relativa alle sole pile."),
            p(169, 22, 28, "Per i ponti esistenti sono ammessi gli interventi per l’incremento della sicurezza strutturale in analogia a quanto prescritto al § 8.4 della Norma, solo nel caso in cui siano esclusi incrementi, rispetto all’attuale, del livello di traffico di progetto e gli stessi interventi non vadano in alcun modo a peggiorare le condizioni di sicurezza idraulica esistenti. Poiché in questi casi sono possibili fenomeni di instabilità locale, in applicazione del § 8.3 della Norma, è opportuno effettuare la verifica delle fondazioni, e quindi la valutazione dello scalzamento di eventuali spalle o pile in alveo. Anche gli interventi necessari per l’incremento della sicurezza strutturale devono essere accompagnati dallo studio di compatibilità idraulica dove sia messa in evidenza la frequenza probabile (1/T_r) degli eventi che garantiscono il franco previsto da Norma."),
            p(169, 29, 30, "Nelle Relazioni idrologica e idraulica sarà valutato il sistema di smaltimento delle acque meteoriche, tenendo in considerazione anche i seguenti aspetti:"),
            li(169, 31, 31, "analisi degli eventi pluviometrici brevi ed intensi della zona;"),
            li(169, 32, 33, "disposizione delle caditoie in numero e posizioni dipendenti dalle loro dimensioni, dalla geometria plano-altimetrica della sede stradale e dai dati pluviometrici, al fine di evitare ristagni;"),
            li(169, 34, 35, "influenza del trasporto solido e dell’eventuale deposito residuo in condotta sul dimensionamento del sistema di tubazioni che collettano le acque fino al tubo di eduzione;"),
            li(169, 36, 37, "posizione e lunghezza dei tubi di eduzione affinché l’acqua di scolo sia portata a distanza tale da evitare la ricaduta sulle strutture anche in presenza di vento."),
            p(169, 38, 40, "Fermo restando il rispetto della normativa ambientale vigente, in tutti quei casi in cui le acque di eduzione possono produrre danni e inconvenienti o nel caso di attraversamento di zone urbane, è opportuno considerare la possibilità che esse siano intubate fino a terra ed eventualmente immesse in un sistema fognante."),
            p(169, 41, 43, "Nelle strutture a cassone va considerata l’opportunità di praticare, nei punti di possibili accumulo, fori di evacuazione di eventuali acque di infiltrazione. Tubi di evacuazione e gocciolatoi saranno predisposti in modo da evitare scoli di acque sul manufatto."),
            p(169, 44, 47, "Restano esclusi dal punto 5.1.2.3 della Norma i tombini, intendendosi per tombino un manufatto totalmente rivestito in sezione, eventualmente suddiviso in più canne, in grado di condurre complessivamente portate fino a 50 m³/s. L’evento da assumere a base del progetto di un tombino ha comunque tempo di ritorno uguale a quello da assumere per i ponti. La scelta dei materiali deve garantire la resistenza anche ai fenomeni di abrasione e urto causati dai materiali trasportati dalla corrente."),
            p(169, 48, 49, "Oltre a quanto previsto per gli attraversamenti dalla Norma, nella Relazione idraulica è opportuno siano considerati anche i seguenti aspetti:"),
            li(169, 50, 51, "è da sconsigliare il frazionamento della portata fra più canne, tranne nei casi in cui questo sia fatto per facilitare le procedure di manutenzione, predisponendo allo scopo luci panconabili all’imbocco e allo sbocco e accessi per i mezzi d’opera;"),
            li(169, 52, 53, "sono da evitare andamenti planimetrici non rettilinei e disallineamenti altimetrici del fondo rispetto alla pendenza naturale del corso d’acqua."),
            li(169, 54, 54, "per sezioni di area maggiore a 1,5 m² è da garantire la praticabilità del manufatto;"),
            li(169, 55, 57, "il tombino può funzionare sia in pressione che a superficie libera, evitando in ogni caso il funzionamento intermittente fra i due regimi: nel caso in una o più sezioni il funzionamento sia in pressione, la massima velocità che si realizza all’interno dello stesso tombino non dovrà superare 1,5 m/s;"),
            li(170, 3, 4, "nel caso di funzionamento a superficie libera, il tirante idrico non dovrà superare i 2/3 dell’altezza della sezione, garantendo comunque un franco minimo di 0,50 m;"),
            li(170, 5, 6, "il calcolo idraulico è da sviluppare prendendo in considerazione le condizioni che si realizzano nel tratto del corso d’acqua a valle del tombino;"),
            li(170, 7, 8, "la tenuta idraulica deve essere garantita per ciascuna sezione dell’intero manufatto per un carico pari al maggiore tra: 0,5 bar rispetto all’estradosso o 1,5 volte la massima pressione d’esercizio;"),
            li(170, 9, 10, "il massimo rigurgito previsto a monte del tombino deve garantire il rispetto del franco idraulico nel tratto del corso d’acqua a monte;"),
            li(170, 11, 16, "nel caso sia da temersi l’ostruzione anche parziale del manufatto da parte dei detriti galleggianti trasportati dalla corrente, è da disporre immediatamente a monte una varice presidiata da una griglia che consenta il passaggio di elementi caratterizzati da dimensioni non superiori alla metà della larghezza del tombino; in alternativa il tombino è da dimensionare assumendo che la sezione efficace ai fini del deflusso delle acque sia ridotta almeno alla metà di quella effettiva. È in ogni caso da garantire l’accesso in alveo ai mezzi necessari per le operazioni di manutenzione ordinaria o straordinaria da svolgere dopo gli eventi di piena;"),
            li(170, 17, 18, "i tratti del corso d’acqua immediatamente prospicienti l’imbocco e lo sbocco del manufatto devono essere protetti da fenomeni di scalzamento e/o erosione, e opportune soluzioni tecniche sono da adottare per evitare i fenomeni di sifonamento."),
            p(170, 19, 20, "Nel caso il tombino sia opera provvisionale, ovvero a servizio di un cantiere, le precedenti disposizioni possono essere assunte come elementi di riferimento, tenendo opportunamente conto del tempo di utilizzo previsto per l’opera provvisionale stessa."),
        ],
    },
    {
        number: "C5.1.3", title: "AZIONI SUI PONTI STRADALI", blocks: [h(170, 21, "C5.1.3 AZIONI SUI PONTI STRADALI")],
    },
    {
        number: "C5.1.3.3", title: "AZIONI VARIABILI DA TRAFFICO. CARICHI VERTICALI: q_1", blocks: [h(170, 22, "C5.1.3.3 AZIONI VARIABILI DA TRAFFICO. CARICHI VERTICALI: q_1", 23)],
    },
    {
        number: "C5.1.3.3.2", title: "Definizione delle corsie convenzionali", blocks: [
            h(170, 23, "C5.1.3.3.2 Definizione delle corsie convenzionali"),
            p(170, 24, 27, "Ai fini del calcolo, la carreggiata deve essere suddivisa in corsie convenzionali, ciascuna di larghezza 3,00 m, come indicato al § 5.1.3.3.2 delle NTC, in modo da individuare, di volta in volta, le condizioni di carico più severe per la verifica in esame. A tal fine, si osserva che le corsie convenzionali possono essere adiacenti oppure no, a seconda del dettaglio considerato e della forma della superficie d’influenza."),
            p(170, 28, 29, "Le corsie convenzionali, la loro posizione e la loro numerazione sono indipendenti dalle corsie fisiche, disegnate sulla carreggiata mediante la segnaletica orizzontale."),
            p(170, 30, 31, "In alcuni casi quali verifiche per particolari SLE e/o verifiche a fatica, le corsie convenzionali possono essere disposte in modo meno severo."),
        ],
    },
    {
        number: "C5.1.3.3.3", title: "Schemi di carico", blocks: [
            h(170, 32, "C5.1.3.3.3 Schemi di carico"),
            p(170, 33, 34, "Gli schemi di carico specificati al § 5.1.3.3.3 delle NTC includono gli effetti dinamici determinati con riferimento alla rugosità di pavimentazioni stradali di media qualità secondo la norma ISO 8685:1995."),
            p(170, 35, 35, "Lo schema di carico 1 vale per ponti di luce non maggiore di 300 m."),
            p(170, 36, 37, "Per ponti di luce superiore a 300 m e in assenza di studi specifici, in alternativa allo schema di carico 1, generalmente cautelativo, si può utilizzare lo schema di carico 6."),
        ],
    },
    {
        number: "C5.1.3.3.5", title: "Disposizioni dei carichi mobili per realizzare le condizioni di carico più gravose", blocks: [
            h(170, 38, "C5.1.3.3.5 Disposizioni dei carichi mobili per realizzare le condizioni di carico più gravose"),
            p(170, 39, 41, "Gli assi tandem si considerano viaggianti secondo l’asse longitudinale del ponte e sono generalmente disposti in asse alle rispettive corsie. Nel caso in cui si debbano considerare due corsie con tandem affiancati, per ponti con carreggiata di larghezza minore di 5,80 m, la minima distanza trasversale tra due tandem affiancati si può considerare uguale a 50 cm."),
        ],
    },
    {
        number: "C5.1.3.3.5.1", title: "Carichi verticali da traffico su rilevati e su terrapieni adiacenti al ponte", blocks: [
            h(170, 42, "C5.1.3.3.5.1 Carichi verticali da traffico su rilevati e su terrapieni adiacenti al ponte"),
            p(170, 43, 45, "Ai fini del calcolo delle spalle, dei muri d’ala e delle altre parti del ponte a contatto con il terreno, sul rilevato o sul terrapieno si può considerare applicato lo schema di carico 1 in cui, per semplicità, i carichi tandem possono essere sostituiti da carichi uniformemente distribuiti equivalenti, applicati su una superficie rettangolare larga 3,0 m e lunga 2,20 m."),
            p(170, 46, 46, "In un rilevato correttamente consolidato, si può assumere una diffusione del carico con angolo di 30°."),
        ],
    },
    {
        number: "C5.1.3.3.5.2", title: "Carichi orizzontali da traffico su rilevati e su terrapieni adiacenti al ponte", blocks: [
            h(170, 47, "C5.1.3.3.5.2 Carichi orizzontali da traffico su rilevati e su terrapieni adiacenti al ponte"),
            p(170, 48, 49, "Ai fini del calcolo delle spalle, dei muri d’ala e dei muri laterali, i carichi orizzontali da traffico sui rilevati o sui terrapieni possono essere considerati assenti."),
            p(170, 50, 52, "Per il calcolo dei muri paraghiaia si deve, invece, considerare un’azione orizzontale longitudinale di frenamento, applicata alla testa del muro paraghiaia (vedi Figura C5.1.1), di valore caratteristico pari al 60% del carico asse Q_{1k}. Pertanto si considererà un carico orizzontale di 180 kN, concomitante con un carico verticale di 300 kN."),
            figureRef(171, "1.1", 3, 3),
        ],
    },
    {
        number: "C5.1.3.10", title: "AZIONI SUI PARAPETTI E URTI DI VEICOLO IN SVIO: q_8", blocks: [
            h(171, 4, "C5.1.3.10 AZIONI SUI PARAPETTI E URTI DI VEICOLO IN SVIO: q_8", 5),
            p(171, 6, 9, "Le barriere di sicurezza stradali e gli elementi ai quali sono collegate devono essere dimensionati in funzione della classe di contenimento richiesta per l’impiego specifico dalle normative nazionali applicabili. Al fine di garantire il rispetto del requisito di resistenza meccanica e stabilità, si potranno utilizzare solo dispositivi di ritenuta stradale in possesso di idonea qualificazione ai sensi della normativa comunitaria o nazionale applicabile."),
            p(171, 10, 10, "Nella progettazione dell’impalcato si dovrà tenere conto:"),
            li(171, 11, 11, "della tipologia di barriera di sicurezza prescelta;"),
            li(171, 12, 14, "della necessità di garantire uno spazio di lavoro tale da permettere la traslazione e il sostegno del veicolo in svio ed anche dei moduli di barriera coinvolti prevedendo una prosecuzione del cordolo per una larghezza trasversale retro-barriera almeno pari a quella utilizzata nella prova di qualificazione;"),
            li(171, 15, 16, "delle modalità di ancoraggio e di funzionamento della barriera prescelta e della sua compatibilità, anche nel caso di impalcato non rettilineo, al fine di garantire un funzionamento “a catena” dell’intera tratta minima individuata nei test dal vero."),
            p(171, 17, 18, "Nella progettazione esecutiva andranno altresì recepite tutte le prescrizioni di installazione e manutenzione contenute nel documento di qualificazione del dispositivo."),
            p(171, 19, 19, "Per tutte le operazioni di sostituzione o adeguamento dei dispositivi di ritenuta stradale valgono le prescrizioni precedenti."),
            p(171, 20, 24, "In caso di ripristino di parti localizzate di un sistema di ritenuta, danneggiate a seguito di eventi incidentali, prima di procedere al ripristino con elementi identici o equivalenti ma comunque compatibili con quelli già installati, si rende necessaria da parte del progettista una valutazione del comportamento offerto dalla barriera nell’evento che ha causato il danneggiamento, per valutarne l’efficacia in termini di prestazioni ai sensi della normativa nazionale vigente e tenuto conto della effettiva composizione prevalente del traffico e della conseguente classe di contenimento."),
            p(171, 25, 26, "Utile e immediato a garantire le richieste minime di resistenza al piede della barriera è la riproduzione delle tipologie di vincolo effettivamente utilizzate nella positiva sperimentazione documentata da prove eseguite ai sensi della UNI EN 1317-2."),
        ],
    },
    {
        number: "C5.1.4", title: "VERIFICHE DI SICUREZZA", blocks: [h(171, 27, "C5.1.4 VERIFICHE DI SICUREZZA")],
    },
    {
        number: "C5.1.4.3", title: "VERIFICHE ALLO STATO LIMITE DI FATICA", blocks: [
            h(171, 28, "C5.1.4.3 VERIFICHE ALLO STATO LIMITE DI FATICA"),
            p(171, 29, 32, "Per le verifiche a fatica, in alternativa all’effettivo spettro di carico che interessa il ponte, o in mancanza di esso, si può far riferimento ai quattro modelli di carico a fatica assegnati al § 5.1.4.3 delle NTC. I predetti modelli di carico a fatica includono gli effetti dinamici, calcolati con riferimento alla rugosità di pavimentazioni stradali di qualità buona secondo la norma ISO 8685:1995."),
            p(171, 33, 35, "Per le verifiche a fatica di dettagli caratterizzati da limite di fatica ad ampiezza costante debbono essere effettuate verifiche differenziate a seconda che si conducano verifiche a vita illimitata o verifiche a danneggiamento. Per dettagli caratterizzati da curve S-N prive di limite di fatica ad ampiezza costante, possono essere condotte solo verifiche a danneggiamento."),
            p(171, 36, 40, "Per le verifiche a vita illimitata si possono impiegare, in alternativa, il modello di carico a fatica n. 1, derivato dal modello di carico statico, che è un modello cautelativo, molto semplificato, che consente anche di considerare l’effetto d’interazione di carichi simultaneamente applicati su più corsie, o il modello di carico a fatica n. 2, che è un modello molto raffinato costituito da uno spettro di carico frequente, il quale, però, non tiene conto dell’effetto d’interazione di carichi simultaneamente applicati su più corsie."),
            p(171, 41, 41, "Il modello di carico a fatica n. 1 va disposto sul ponte in modo da massimizzare il delta di tensione,"),
            formulaRef(171, "1.1", 42, 45),
            p(171, 46, 47, "considerando, se necessario, disposizioni diverse per il calcolo di σ_max e di σ_min."),
            p(172, 3, 8, "I veicoli del modello di carico a fatica n. 2 debbono essere disposti in asse alla corsia convenzionale n. 1, che è quella che determina l’effetto più severo nel dettaglio in esame; il delta di tensione da considerare è espresso nuovamente da (C5.1.1), essendo σ_max e σ_min, rispettivamente, le tensioni massima e minima indotte dai veicoli dello spettro. Ove effetti di interazione tra veicoli simultaneamente presenti su una o più corsie siano rilevanti, è necessario tener conto, facendo ricorso a studi specifici o a letteratura tecnica consolidata."),
            p(172, 9, 11, "Per le verifiche a danneggiamento si possono impiegare, in alternativa, il modello di carico a fatica n. 3, semplificato e generalmente cautelativo, costituito da un veicolo di fatica convenzionale equivalente, e il modello di carico a fatica n. 4, costituito da uno spettro di carico equivalente (Tab. 5.1.VIII delle NTC)."),
            p(172, 12, 14, "Il flusso annuo di veicoli da considerare su ciascuna corsia è dato, in funzione della strada servita, nella Tab. 5.1.X delle NTC, mentre la composizione del traffico è riportata, in funzione della tipologia di traffico interessante il ponte in esame, nella Tab. 5.1.VIII."),
            p(172, 15, 16, "Con assunzione estremamente cautelativa, i veicoli dei modelli di carico di fatica 3 o 4 possono essere applicati in asse alle corsie convenzionali determinate in accordo con il § 5.1.3.3.2 delle NTC."),
            p(172, 17, 22, "È possibile, tuttavia, adottare disposizioni più favorevoli e realistiche dei veicoli, considerando che il flusso avvenga per il 10% sulle corsie convenzionali e per il 90% sulle corsie fisiche. La posizione dei veicoli nelle corsie fisiche dovrà essere, comunque, tale da determinare nel dettaglio in esame gli effetti più severi. L’aliquota del flusso di traffico considerata sulle corsie convenzionali (10%) tiene conto del fatto che, nel corso della vita del ponte, per effetto di incidenti, congestioni di traffico, lavori di manutenzione ecc., si possano verificare modifiche o restringimenti della carreggiata, tali da determinare condizioni di flusso più severe di quelle corrispondenti al flusso sulle corsie fisiche."),
            p(172, 23, 24, "Nel caso in cui siano da prevedere significativi effetti di interazione tra veicoli, si deve far riferimento a studi specifici o a metodologie consolidate."),
            p(172, 25, 28, "Il modello di carico di fatica 3, considerato in asse alla corsia convenzionale, può essere utilizzato per le verifiche col metodo dei coefficienti di danneggiamento equivalente, metodo λ. Per la determinazione dei coefficienti di danneggiamento equivalente, che devono essere specificamente calibrati sul predetto modello di carico di fatica 3, si può far riferimento alle norme UNI EN 1992-2, UNI EN 1993-2 ed UNI EN 1994-2."),
            p(172, 29, 31, "In prossimità di un giunto d’espansione può essere necessario considerare un fattore di amplificazione dinamica addizionale Δφ_fat, da applicare a tutti i carichi e dato da"),
            formulaRef(172, "1.2", 32, 39),
            p(172, 40, 40, "dove d è la distanza della sezione considerata dalla sezione di giunto, espressa in m."),
        ],
    },
    {
        number: "C5.1.4.5", title: "VERIFICHE ALLO STATO LIMITE DI DEFORMAZIONE", blocks: [
            h(172, 41, "C5.1.4.5 VERIFICHE ALLO STATO LIMITE DI DEFORMAZIONE"),
            p(172, 42, 45, "Per la valutazione della domanda relativa alla componente cinematica dei vincoli e per il calcolo della dimensione dei varchi, ovvero della distanza tra costruzioni contigue in corrispondenza delle interruzioni strutturali, si potranno prendere in conto, oltre alle combinazioni sismiche, anche le combinazioni SLU delle altre azioni significative per il caso in esame (ritiro, viscosità, variazioni termiche, frenatura, azione centrifuga, vento, precompressione, ecc.)."),
            p(172, 46, 47, "I valori di progetto della variazione termica uniforme per la valutazione agli SLU della massima espansione/contrazione si possono esprimere come segue:"),
            formulaRef(172, "1.3", 48), formulaRef(172, "1.4", 49),
            p(172, 50, 50, "In cui:"), formulaRef(172, "1.5", 51), formulaRef(172, "1.6", 52),
            li(172, 53, 54, "T_e,max e T_e,min sono rispettivamente la massima e minima temperatura uniforme del ponte ricavabili, come indicato nel Capitolo 6 delle UNI EN 1991-1-5, in funzione della T_min e T_max dell’aria esterna di cui al § 3.5 delle NTC."),
            li(172, 55, 55, "T_0 è la temperatura iniziale all’atto della regolazione degli appoggi del ponte di cui al § 3.5.4 delle NTC."),
            li(172, 56, 56, "ΔT_0 è indicato nella tabella seguente."),
            tableRef(172, 57, 60),
            formulaRef(173, "1.7", 14), formulaRef(173, "1.8", 15),
        ],
    },
    {
        number: "C5.1.4.6", title: "VERIFICA DELLE AZIONI SISMICHE", blocks: [
            h(173, 16, "C5.1.4.6 VERIFICA DELLE AZIONI SISMICHE"),
            p(173, 17, 21, "Nella progettazione sismica di manufatti che si collocano sull’intersezione di due infrastrutture lineari, caratterizzate da valori non coincidenti di V_N e C_U, per non pregiudicare il livello di sicurezza dell’infrastruttura più rilevante occorrerà progettare gli elementi strutturali delle opere di intersezione assumendo il più alto valore di V_R fra quelli determinati considerando l’opera appartenente a ciascuna delle infrastrutture interferenti."),
        ],
    },
    {
        number: "C5.1.8", title: "PONTI PEDONALI", blocks: [
            h(173, 22, "C5.1.8 PONTI PEDONALI"),
            p(173, 23, 24, "Per i ponti pedonali si deve considerare lo schema di carico 4, folla compatta, applicato su tutta la parte sfavorevole della superficie d’influenza."),
            p(173, 25, 27, "L’intensità del carico, comprensiva degli effetti dinamici, è di 5,0 kN/m². Tuttavia, quando si possa escludere la presenza di folla compatta, come accade per ponti in zone scarsamente abitate, l’intensità del carico può essere ridotta, previa adeguata giustificazione, a"),
            formulaRef(173, "1.9", 28, 34),
            p(173, 35, 35, "dove L è la lunghezza della stesa di carico in m."),
            p(173, 36, 40, "Qualora, per operazioni di manutenzione o di soccorso, sia necessario considerare la presenza di un veicolo sul ponte si può considerare lo schema di carico di Figura C5.1.2, costituito da due assi di peso Q_sv1=40 kN e Q_sv2=80 kN, comprensivi degli effetti dinamici, con carreggiata di 1,3 m ed interasse 3,0 m. L’impronta di ciascuna ruota può essere considerata quadrata di lato 20 cm."),
            p(173, 40, 40, "A questo schema può essere associata una forza orizzontale di frenamento pari al 60% del carico verticale."),
            figureRef(173, "1.2", 41),
        ],
    },
    {
        number: "C5.1.8.1", title: "MODELLI DINAMICI PER PONTI PEDONALI", blocks: [
            h(173, 42, "C5.1.8.1 MODELLI DINAMICI PER PONTI PEDONALI"),
            p(173, 43, 44, "Vibrazioni nei ponti pedonali possono essere indotte da varie cause quali, per esempio, vento o persone singole o in gruppo che camminano, corrono, saltano o danzano sul ponte."),
            p(173, 45, 48, "Ai fini delle verifiche nei riguardi dello stato limite di vibrazione può essere necessario considerare appropriati modelli dinamici, che tengano conto del numero e della posizione delle persone simultaneamente presenti sul ponte e di fattori esterni, quale la localizzazione del ponte stesso, e definire opportuni criteri di comfort, facendo riferimento a normative e a procedure di comprovata validità."),
            p(174, 3, 6, "A titolo puramente informativo si può considerare che, in assenza di significativa risposta da parte del ponte, una persona che cammini ecciti il ponte con un’azione periodica verticale di frequenza compresa tra 1 e 3 Hz e un’azione orizzontale simultanea di frequenza compresa tra 0,5 e 1,5 Hz, e che un gruppo di persone in leggera corsa ecciti il ponte con una frequenza verticale pari a circa 3 Hz."),
        ],
    },
    {
        number: "C5.2", title: "PONTI FERROVIARI", blocks: [h(174, 7, "C5.2 PONTI FERROVIARI")],
    },
    {
        number: "C5.2.1.2", title: "COMPATIBILITÀ IDRAULICA", blocks: [h(174, 8, "C5.2.1.2 COMPATIBILITÀ IDRAULICA"), p(174, 9, 9, "Vale quanto detto al § C.5.1.2.3.")],
    },
    {
        number: "C5.2.2", title: "AZIONI SULLE OPERE", blocks: [
            h(174, 10, "C5.2.2 AZIONI SULLE OPERE"),
            p(174, 11, 12, "Le azioni variabili da traffico assegnate ai §§ 5.2.2.2 e 5.2.2.3 delle NTC sono relative alla rete ferroviaria con scartamento standard e alle linee principali."),
            p(174, 13, 15, "Per ferrovie a scartamento ridotto, tramvie e linee ferroviarie leggere, metropolitane e funicolari non valgono le prescrizioni di cui sopra e le azioni debbono essere determinate caso per caso, in riferimento alle peculiarità della linea servita, sulla base di studi specifici o a normative di comprovata validità."),
        ],
    },
    {
        number: "C5.2.2.4", title: "AZIONI VARIABILI AMBIENTALI", blocks: [h(174, 16, "C5.2.2.4 AZIONI VARIABILI AMBIENTALI")],
    },
    {
        number: "C5.2.2.4.2", title: "Temperatura", blocks: [
            h(174, 17, "C5.2.2.4.2 Temperatura"),
            p(174, 18, 18, "Le azioni della temperatura sono definite al § 3.5 delle NTC."),
            p(174, 19, 20, "Nelle stesse norme sono individuate le metodologie per valutare l’effetto dell’azione. Le strutture andranno progettate e verificate nel rispetto di queste azioni."),
            p(174, 21, 22, "Per le opere direttamente esposte alle azioni atmosferiche le variazioni termiche uniformi da considerare, in mancanza di studi approfonditi, rispetto alla temperatura media del sito, sono da assumersi pari a quanto indicato nello stesso § 3.5."),
            p(174, 23, 25, "Per la valutazione della domanda relativa alla componente cinematica dei vincoli e per il calcolo della dimensione dei varchi, ovvero della distanza tra costruzioni contigue in corrispondenza delle interruzioni strutturali vale quanto indicato al punto C.5.1.4.5."),
        ],
    },
    {
        number: "C5.2.2.5", title: "EFFETTI DI INTERAZIONE STATICA TRENO-BINARIO-STRUTTURA", blocks: [
            h(174, 26, "C5.2.2.5 EFFETTI DI INTERAZIONE STATICA TRENO-BINARIO-STRUTTURA"),
            p(174, 27, 30, "Ai fini della determinazione degli effetti di interazione statica treno-binario-struttura, di cui al § 5.2.2.5 delle NTC, si possono utilizzare i legami tra la resistenza longitudinale allo scorrimento e lo scorrimento longitudinale per metro di binario singolo, riportati nelle figure C5.2.1, C5.2.2 e C5.2.3 e relativi ai casi di posa su ballast, posa diretta con attacco tradizionale indiretto di tipo K e posa diretta con attacco elastico, rispettivamente."),
            p(174, 31, 34, "Nel caso di posa su ballast, la forza di scorrimento longitudinale q, in assenza di carico verticale da traffico, è assunta pari a 12,5 kN/m su rilevato e a 20 kN/m su ponte, mentre in presenza di un carico verticale da traffico di 80 kN/m, è assunta pari a 60 kN/m. Per carichi diversi i valori della resistenza si otterranno per interpolazione o estrapolazione lineare. In tutti i casi si assume uno spostamento di soglia di 2 mm, per cui risulta univocamente definita la rigidezza iniziale."),
            p(174, 35, 37, "Nel caso di binario con posa diretta, la resistenza allo scorrimento q dipende dal tipo di attacco e dalla forza di serraggio, oltre che dal carico verticale applicato, come descritto nel seguito. Dette norme non si applicano alle opere d’arte con armamento di tipo innovativo."),
            p(174, 38, 39, "Per l’attacco tradizionale indiretto di tipo K, la forza di scorrimento longitudinale q è assunta, per interasse fra le traverse di 0,6 m, 50 kN/m in assenza di carico verticale da traffico, 80 kN/m in presenza di un carico verticale da traffico di 80 kN/m."),
            p(174, 40, 41, "Per l’attacco elastico, la forza di scorrimento longitudinale q è assunta pari a 13 kN/m in assenza di carico verticale da traffico e a 35 kN/m in presenza di un carico verticale da traffico di 80 kN/m."),
            p(174, 42, 44, "Nel caso di posa diretta e per carichi verticali da traffico diversi, i valori della resistenza si otterranno per interpolazione o estrapolazione lineare. In tutti i casi si assume uno spostamento di soglia di 0,5 mm, per cui risulta univocamente definita la rigidezza iniziale."),
            figureRef(175, "2.1", 3), figureRef(175, "2.2", 4, 5), figureRef(175, "2.3", 6),
        ],
    },
    {
        number: "C5.2.2.8", title: "AZIONI SISMICHE", blocks: [
            h(176, 3, "C5.2.2.8 AZIONI SISMICHE"),
            p(176, 4, 8, "Nella progettazione sismica di manufatti che si collocano sull’intersezione di due infrastrutture lineari, caratterizzate da valori non coincidenti di V_N e C_U, per non pregiudicare il livello di sicurezza dell’infrastruttura più rilevante occorrerà progettare gli elementi strutturali delle opere di intersezione assumendo il più alto valore di V_R fra quelli determinati considerando l’opera appartenente a ciascuna delle infrastrutture interferenti."),
        ],
    },
    {
        number: "C5.2.3", title: "PARTICOLARI PRESCRIZIONI PER LE VERIFICHE", blocks: [h(176, 9, "C5.2.3 PARTICOLARI PRESCRIZIONI PER LE VERIFICHE")],
    },
    {
        number: "C5.2.3.2", title: "VERIFICHE AGLI SLU E SLE", blocks: [h(176, 10, "C5.2.3.2 VERIFICHE AGLI SLU E SLE")],
    },
    {
        number: "C5.2.3.2.1", title: "Requisiti concernenti gli SLU", blocks: [
            h(176, 11, "C5.2.3.2.1 Requisiti concernenti gli SLU"),
            p(176, 12, 15, "Al § 5.2.3.2.1 delle NTC, il carico permanente dovuto al ballast è trattato, se sfavorevole, come un carico variabile non da traffico (v. Tabella 5.2.V delle NTC) ed è precisato che qualora se ne prevedano variazioni significative, queste dovranno essere esplicitamente considerate nelle verifiche. In quest’ultimo caso dovranno essere aumentate di conseguenza anche le masse sismiche."),
        ],
    },
    {
        number: "C5.2.3.2.3", title: "Verifiche allo stato limite di fatica", blocks: [
            h(176, 16, "C5.2.3.2.3 Verifiche allo stato limite di fatica"),
            p(176, 17, 18, "Per la definizione dei modelli di carico a fatica, si può far riferimento agli spettri e ai coefficienti dinamici riportati nella norma UNI EN 1991-2."),
            p(176, 19, 20, "Per le verifiche col metodo dei coefficienti di danneggiamento equivalente, metodo λ, si può utilizzare il modello di carico LM71, associato ad un appropriato coefficiente dinamico."),
            p(176, 21, 22, "Per la determinazione dei coefficienti di danneggiamento equivalente, che devono essere specificamente calibrati sul predetto modello LM71, si può far riferimento alle norme UNI EN 1992-2, UNI EN 1993-2 ed UNI EN 1994-2."),
            p(176, 23, 24, "La determinazione dell’effettivo spettro di carico da considerare nella verifica del ponte dovrà essere effettuata in base alle caratteristiche funzionali e d’uso della infrastruttura ferroviaria cui l’opera appartiene."),
        ],
    },
];

function evidence(block: BlockSpec, normalized?: string): any {
    const raw = source(block.page, block.from, block.to ?? block.from);
    const isAsset = block.kind.endsWith("-ref");
    const value = normalized ?? block.assetId ?? raw;
    return {
        sourceId,
        pdfPage: block.page,
        printedPage: String(block.page - 4),
        region: null,
        extraction: { method: isAsset ? "manual-transcription" : "pdf-text", tool: isAsset ? "codex-render-transcription" : "pdfjs-dist", toolVersion: isAsset ? profile : "4.10.38" },
        transformations: isAsset ? [] : transformations(),
        rawSha256: sha256(isAsset ? value : raw),
        normalizedSha256: sha256(value),
    };
}

function blockRecord(number: string, block: BlockSpec, index: number): any {
    const id = uid(number);
    const blockId = `${id}#block-${index === 0 ? "heading" : `editorial-${String(index).padStart(3, "0")}`}`;
    if (block.kind.endsWith("-ref")) return { blockId, kind: block.kind, origin: "official", assetId: block.assetId, evidence: evidence(block) };
    const normalized = block.text!;
    const text: any = { raw: source(block.page, block.from, block.to ?? block.from), normalized, normalizationVersion: profile };
    const segments = inline(normalized);
    if (segments) text.inline = segments;
    return { blockId, kind: block.kind, origin: "official", text, evidence: evidence(block, normalized) };
}

function kind(number: string): string {
    const depth = number.split(".").length;
    return depth === 1 ? "chapter" : depth === 2 ? "section" : depth === 3 ? "paragraph" : "subparagraph";
}

function unitRecord(unit: UnitSpec): any {
    const id = uid(unit.number);
    const parts = unit.number.slice(1).split(".");
    const ancestors = parts.length === 1 ? [] : parts.slice(0, -1).map((_, index) => uid(`C${parts.slice(0, index + 1).join(".")}`));
    const blocks = unit.blocks.map((block, index) => blockRecord(unit.number, block, index));
    const formulaIds = blocks.filter((block: any) => block.kind === "formula-ref").map((block: any) => block.assetId);
    const tableIds = blocks.filter((block: any) => block.kind === "table-ref").map((block: any) => block.assetId);
    const figureIds = blocks.filter((block: any) => block.kind === "figure-ref").map((block: any) => block.assetId);
    const suffix = unit.number.toLowerCase().replaceAll(".", "-");
    const ntcTarget = join(root, "corpus", "units", "ntc2018", `${unit.number.slice(1)}.json`);
    const relations = existsSync(ntcTarget) ? [{ relationId: `${id}#relation-001`, type: "clarifies", targetUnitId: `urn:structural-codes:it:unit:ntc2018:${unit.number.slice(1)}`, basis: "editorial", evidenceBlockIds: [`${id}#block-heading`], rationale: "Corrispondenza proposta tra numerazione omologa della Circolare e delle NTC; richiede conferma umana sul contenuto completo.", review: { status: "proposed", reviewedBy: null, reviewedAt: null } }] : [];
    return {
        $schema: "urn:structural-codes:schema:canonical-unit:v2", schemaVersion: "2.0.0-alpha.2", recordType: "canonical-unit", id,
        workId: "it-mit:circ:2019-01-21:7-csllpp", expressionId: "it-mit:circ:2019-01-21:7-csllpp:original-it", kind: kind(unit.number),
        numbering: { official: unit.number, sortKey: parts.map((part) => part.padStart(3, "0")).join(".") }, title: unit.title,
        titleBlockId: `${id}#block-heading`, hierarchy: { parentId: ancestors.at(-1) ?? null, ancestorIds: ancestors, position: Number(parts.at(-1)) },
        validity: { from: null, to: null, status: "unknown", asOf: "2026-08-09" }, blocks, citations: [],
        relations,
        assets: { formulaIds, tableIds, figureIds },
        workflow: { status: "extracted", createdBy: { actorId: "generator:circ5", kind: "script", toolVersion: profile }, createdAt, reviews: [], openIssues: [
            { issueId: `circ2019-${suffix}-source-review`, type: "normalization-review", severity: "blocking", note: "Trascrizione confrontata con il render ufficiale nello step; resta obbligatoria la revisione umana indipendente prima della pubblicazione." },
            ...(relations.length ? [{ issueId: `circ2019-${suffix}-relation`, type: "relation-review", severity: "blocking", note: "Il collegamento Circolare-NTC per numerazione omologa richiede conferma umana." }] : []),
            ...(formulaIds.length || tableIds.length || figureIds.length ? [{ issueId: `circ2019-${suffix}-assets`, type: "asset-review", severity: "blocking", note: "Formule, tabella e figure sono state collocate nel flusso originario; resta obbligatorio il confronto umano puntuale con la fonte ufficiale." }] : []),
        ] },
    };
}

const figureDir = join(root, "corpus", "assets", "figures", "circ2019");
const figurePath = (number: string): string => join(figureDir, `figc5.${number}.png`);
const figureMeta = async (number: string, unitNumber: string, pdfPage: number, caption: string, region: any): Promise<any> => ({
    id: asset("figure", number), unitId: uid(unitNumber), officialNumber: `C5.${number}`, pdfPage, caption, alt: caption,
    imagePath: `figures/circ2019/figc5.${number}.png`, region, sha256: sha256(await readFile(figurePath(number))),
});

const formulaMeta = (number: string, unitNumber: string, pdfPage: number, latex: string): any => ({ id: asset("formula", number), unitId: uid(unitNumber), officialNumber: `C5.${number}`, pdfPage, latex });
const tableAsset = {
    id: asset("table", "delta-t0"), unitId: uid("C5.1.4.5"), officialNumber: null, pdfPage: 172, caption: "Tabella non numerata relativa a ΔT_0", columnCount: 2, headers: [],
    rows: [
        [{ text: "ΔT_0 = 5 °C per strutture di c.a., c.a.p. e acciaio/cls", latex: "\\Delta T_0=5\\,^{\\circ}\\mathrm{C}" }, { text: "Installazione con la misurazione accurata della temperatura della struttura e con preregolazione per effetti termici a fine costruzione.", rowSpan: 2 }],
        [{ text: "ΔT_0 = 5 °C per strutture di acciaio", latex: "\\Delta T_0=5\\,^{\\circ}\\mathrm{C}" }],
        [{ text: "ΔT_0 = 10 °C per strutture di c.a., c.a.p. e acciaio/cls", latex: "\\Delta T_0=10\\,^{\\circ}\\mathrm{C}" }, { text: "Installazione con la stima della temperatura della struttura e con preregolazione per effetti termici a fine costruzione. Per stima della temperatura della struttura si intende la valutazione secondo quanto indicato nel Capitolo 6 delle UNI EN 1991-1-5 con una accurata misura della temperatura dell’aria esterna.", rowSpan: 2 }],
        [{ text: "ΔT_0 = 15 °C per strutture di acciaio", latex: "\\Delta T_0=15\\,^{\\circ}\\mathrm{C}" }],
        [{ text: "ΔT_0 = 20 °C per strutture di c.a., c.a.p. e acciaio/cls", latex: "\\Delta T_0=20\\,^{\\circ}\\mathrm{C}" }, { text: "Installazione senza alcuna preregolazione per effetti termici." , rowSpan: 2 }],
        [{ text: "ΔT_0 = 30 °C per strutture di acciaio", latex: "\\Delta T_0=30\\,^{\\circ}\\mathrm{C}" }],
    ],
    notes: ["Tabella non numerata, iniziata a pagina PDF 172 e continuata a pagina PDF 173; confronto cella per cella ancora obbligatorio."],
};

const formulas = [
    formulaMeta("1.1", "C5.1.4.3", 171, "\\Delta\\sigma=\\sigma_{\\max}-\\sigma_{\\min}"),
    formulaMeta("1.2", "C5.1.4.3", 172, "\\Delta\\varphi_{\\mathrm{fat}}=1{,}30\\left(1-\\frac{d}{26}\\right)\\ge 1{,}0"),
    formulaMeta("1.3", "C5.1.4.5", 172, "\\Delta T_{\\mathrm{exp,d}}=\\Delta T_{\\mathrm{exp}}+\\Delta T_0"),
    formulaMeta("1.4", "C5.1.4.5", 172, "\\Delta T_{\\mathrm{con,d}}=\\Delta T_{\\mathrm{con}}+\\Delta T_0"),
    formulaMeta("1.5", "C5.1.4.5", 172, "\\Delta T_{\\mathrm{exp}}=+T_{\\mathrm{e,max}}-T_0"),
    formulaMeta("1.6", "C5.1.4.5", 172, "\\Delta T_{\\mathrm{con}}=-T_{\\mathrm{e,min}}+T_0"),
    formulaMeta("1.7", "C5.1.4.5", 173, "\\Delta T_{\\mathrm{exp,k}}=\\Delta T_{\\mathrm{exp}}"),
    formulaMeta("1.8", "C5.1.4.5", 173, "\\Delta T_{\\mathrm{con,k}}=\\Delta T_{\\mathrm{con}}"),
    formulaMeta("1.9", "C5.1.8", 173, "2{,}50\\,\\mathrm{kN/m^2}\\le q_{f,r}=2{,}0+\\frac{120}{L+30}\\le 5{,}00\\,\\mathrm{kN/m^2}"),
];

const figures = [
    await figureMeta("1.1", "C5.1.3.3.5.2", 171, "Figura C5.1.1 - Carichi da traffico su muri paraghiaia", { coordinateSystem: "pdf-points-top-left", x: 90, y: 280, width: 145, height: 90 }),
    await figureMeta("1.2", "C5.1.8", 173, "Figura C5.1.2 - Veicolo di servizio per ponti di 3a categoria", { coordinateSystem: "pdf-points-top-left", x: 150, y: 480, width: 300, height: 150 }),
    await figureMeta("2.1", "C5.2.2.5", 175, "Figura C5.2.1 - Legame tra resistenza allo scorrimento e scorrimento longitudinale per metro di singolo binario (posa su ballast)", { coordinateSystem: "pdf-points-top-left", x: 80, y: 100, width: 400, height: 190 }),
    await figureMeta("2.2", "C5.2.2.5", 175, "Figura C5.2.2 - Legame tra resistenza allo scorrimento e scorrimento longitudinale per metro di singolo binario (posa diretta con attacco tradizionale indiretto di tipo K)", { coordinateSystem: "pdf-points-top-left", x: 45, y: 270, width: 500, height: 205 }),
    await figureMeta("2.3", "C5.2.2.5", 175, "Figura C5.2.3 - Legame tra resistenza allo scorrimento e scorrimento longitudinale per metro di singolo binario (posa diretta con attacco elastico)", { coordinateSystem: "pdf-points-top-left", x: 45, y: 480, width: 520, height: 240 }),
];

await mkdir(unitDir, { recursive: true });
for (const unit of units) await writeFile(join(unitDir, `${unit.number.toLowerCase()}.json`), `${JSON.stringify(unitRecord(unit), null, 2)}\n`, "utf8");

const manifests = [
    { section: "C5-step1", filename: "C5-step1.json", formulas: [], tables: [], figures: [] },
    { section: "C5-step2", filename: "C5-step2.json", formulas, tables: [tableAsset], figures: figures.slice(0, 2) },
    { section: "C5-step3", filename: "C5-step3.json", formulas: [], tables: [], figures: figures.slice(2) },
];
for (const manifest of manifests) await writeFile(join(assetDir, manifest.filename), `${JSON.stringify({ $schema: "urn:structural-codes:schema:asset-manifest:v2", schemaVersion: "2.0.0-alpha.1", recordType: "asset-manifest", document: "circ2019", section: manifest.section, sourceId, status: "transcribed-unreviewed", formulas: manifest.formulas, tables: manifest.tables, figures: manifest.figures }, null, 2)}\n`, "utf8");

console.log(`circ5: generated ${units.length} units, ${formulas.length} formulas, 1 table and ${figures.length} figures`);
