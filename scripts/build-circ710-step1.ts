/* eslint-disable @typescript-eslint/no-explicit-any */
import { createHash } from "node:crypto";
import { mkdir, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const sourceId = "circ-7-2019";
const profile = "circ710-step1-manual-render-transcription-0.1.0";
const asOf = "2026-08-09";
const unitId = (number: string): string =>
    `urn:structural-codes:it:unit:circ2019:${number.toLowerCase()}`;
const assetId = (kind: "formula" | "figure", number: string): string =>
    `urn:structural-codes:it:asset:${kind}:circ2019:${number.toLowerCase()}`;
const sha256 = (value: string): string =>
    createHash("sha256").update(value, "utf8").digest("hex");

const mathTerms: Array<[string, string]> = [
    ["T_is ≥ 3·T_bf", "T_{is}\\ge3\\,T_{bf}"],
    ["T_is>2,0 s", "T_{is}>2{,}0\\,s"],
    ["T_bf", "T_{bf}"],
    ["T_is", "T_{is}"],
    ["d_dc", "d_{dc}"],
    ["K_esi,min", "K_{esi,min}"],
    ["K_esi", "K_{esi}"],
    ["S_e(T_is, ξ_esi)", "S_e(T_{is},\\xi_{esi})"],
    ["ξ_esi", "\\xi_{esi}"],
    ["ξ_i", "\\xi_i"],
    ["ξ_1", "\\xi_1"],
    ["ξ_2", "\\xi_2"],
    ["T_1", "T_1"],
    ["T_2", "T_2"],
    ["α", "\\alpha"],
    ["β", "\\beta"],
    ["μ_c", "\\mu_c"],
    ["k_d", "k_d"],
    ["F_dy", "F_{dy}"],
    ["k_c", "k_c"],
    ["k_s", "k_s"],
    ["k_a", "k_a"],
    ["±30%", "\\pm30\\%"],
    ["50% e 150%", "50\\%\\text{ e }150\\%"],
    ["4-5 volte", "4\\text{-}5\\,\\text{volte}"],
    ["2/3", "\\frac{2}{3}"],
    ["0,05 s", "0{,}05\\,s"],
    ["1,5", "1{,}5"],
];

function inline(text: string): any[] | undefined {
    const terms = mathTerms
        .filter(([value]) => text.includes(value))
        .sort((left, right) => right[0].length - left[0].length);
    if (terms.length === 0) return undefined;
    const result: any[] = [];
    let cursor = 0;
    while (cursor < text.length) {
        let next: { index: number; value: string; latex: string } | undefined;
        for (const [value, latex] of terms) {
            const index = text.indexOf(value, cursor);
            if (
                index >= 0 &&
                (!next || index < next.index || (index === next.index && value.length > next.value.length))
            ) {
                next = { index, value, latex };
            }
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

function evidence(page: number, text: string, region: any = null): any {
    return {
        sourceId,
        pdfPage: page,
        printedPage: String(page - 4),
        region,
        extraction: {
            method: "manual-transcription",
            tool: region ? "poppler-pdf-crop" : "codex-render-transcription",
            toolVersion: profile,
        },
        transformations: [],
        rawSha256: sha256(text),
        normalizedSha256: sha256(text),
    };
}

type TextKind = "heading" | "paragraph" | "list-item";
type Block =
    | { kind: TextKind; page: number; text: string }
    | { kind: "formula-ref" | "figure-ref"; page: number; asset: string; label: string; region?: any };
type Unit = { number: string; title: string; page: number; blocks: Block[] };
const p = (page: number, text: string): Block => ({ kind: "paragraph", page, text });
const li = (page: number, text: string): Block => ({ kind: "list-item", page, text });
const formula = (page: number, number: string): Block => ({
    kind: "formula-ref",
    page,
    asset: assetId("formula", number),
    label: `[${number}]`,
});
const figure = (
    page: number,
    assetNumber: string,
    officialNumber: string,
    region: { x: number; y: number; width: number; height: number },
): Block => ({
    kind: "figure-ref",
    page,
    asset: assetId("figure", assetNumber),
    label: `Figura ${officialNumber}`,
    region: { coordinateSystem: "pdf-points-top-left", ...region },
});

const units: Unit[] = [
    {
        number: "C7.10",
        title: "COSTRUZIONI CON ISOLAMENTO E/O DISSIPAZIONE",
        page: 235,
        blocks: [
            p(235, `Le tecniche di isolamento sismico e di dissipazione di energia consentono di ridurre la risposta sismica delle costruzioni, utilizzando appositi dispositivi collocati all’interno della struttura o colleganti strutture contigue.`),
        ],
    },
    {
        number: "C7.10.1",
        title: "SCOPO",
        page: 235,
        blocks: [
            p(235, `Queste tecniche di protezione si utilizzano per migliorare le prestazioni delle costruzioni soggette ad azioni sismiche.`),
            p(235, `Per realizzare l’isolamento sismico, occorre creare una discontinuità strutturale lungo l’altezza della costruzione che permetta ampi spostamenti orizzontali relativi tra la parte della costruzione superiore (sovrastruttura) e quella inferiore (sottostruttura) alla discontinuità. Il collegamento tra la sovrastruttura e la sottostruttura è realizzato mediante isolatori, ovvero speciali apparecchi di appoggio caratterizzati da rigidezze basse nei confronti degli spostamenti orizzontali, elevate nei confronti di quelli verticali.`),
            p(235, `Negli edifici, la discontinuità strutturale viene spesso realizzata alla base, tra la fondazione e l’elevazione (isolamento alla base) o immediatamente al di sopra del 1° piano, per lo più lo scantinato.`),
            p(235, `Nei ponti l’isolamento sismico è generalmente realizzato tra l’impalcato e le strutture di supporto (pile e spalle), nel qual caso gli isolatori sostituiscono gli usuali apparecchi di appoggio. Normalmente la riduzione delle forze sismiche che ne consegue produce i suoi maggiori benefici sulle pile e sulle spalle (benefici indiretti sulla sottostruttura). Nei ponti ad impalcato continuo, un’attenta calibrazione delle caratteristiche meccaniche e dei dispositivi d’isolamento e di vincolo che collegano l’impalcato con le pile e le spalle permette altresì di migliorare la distribuzione delle forze sismiche orizzontali trasmesse dall’impalcato alle diverse strutture di supporto.`),
            p(235, `Molti degli isolatori attualmente in commercio, anche a comportamento sostanzialmente lineare, garantiscono rapporti di smorzamento del sistema d’isolamento superiori al 5%. Per modificare e migliorare le caratteristiche del sistema d’isolamento, in termini di capacità dissipative e/o ricentranti, si possono utilizzare “dispositivi ausiliari” con opportuno comportamento meccanico.`),
            p(236, `Gli effetti dell’isolamento su una struttura possono essere ben interpretati facendo riferimento a forme tipiche degli spettri di risposta elastici in accelerazioni e in spostamenti, per diversi rapporti di smorzamento (Figura C7.10.1).`),
            p(236, `Considerando una porzione di struttura che, a base fissa, avrebbe un periodo fondamentale di oscillazione T_bf in una data direzione, l’isolamento alla base di questa porzione deve produrre uno dei seguenti effetti:`),
            li(236, `a) l’incremento del periodo grazie all’adozione di dispositivi con comportamento d’insieme approssimativamente lineare. Si ottiene un buon “disaccoppiamento” quando il periodo della struttura isolata T_is risulta ≥ 3·T_bf. Maggiore è l’incremento di periodo (generalmente T_is>2,0 s) maggiore è la riduzione delle accelerazioni sulla sovrastruttura (spettro in accelerazioni) e l’incremento degli spostamenti (spettro in spostamenti), che si concentrano essenzialmente nel sistema di isolamento;`),
            li(236, `b) la limitazione della forza trasmessa alla sottostruttura, grazie all’adozione di dispositivi con comportamento d’insieme non lineare, caratterizzato da basso incrudimento ovvero incrementi minimi o nulli della forza per grandi spostamenti. In questo modo si limitano le forze d’inerzia, quindi l’accelerazione, sulla sovrastruttura, ancora a scapito di un sensibile incremento degli spostamenti nel sistema di isolamento.`),
            p(236, `Oltre che nei due modi detti, l’isolamento si può conseguire utilizzando dispositivi che garantiscano al sistema un comportamento d’insieme intermedio tra i due.`),
            p(236, `La dissipazione di energia, dovuta agli isolatori e/o ad eventuali dispositivi ausiliari determina sempre una riduzione degli spostamenti nel sistema di isolamento. Essa è particolarmente utile in siti caratterizzati da elevata sismicità e/o nel caso di sottosuoli con caratteristiche meccaniche scadenti (tipo C, D, E), cioè nei casi in cui gli spettri di risposta possono presentare spostamenti elevati ed accelerazioni significative anche su periodi di oscillazione elevati.`),
            figure(236, "C7.10.1", "C7.10.1", { x: 80, y: 350, width: 440, height: 130 }),
            p(236, `L’applicazione dell’isolamento sismico, anche alle usuali costruzioni, richiede criteri, regole e accorgimenti particolari, riportati nel § 7.10 delle NTC e, ove necessario, meglio esplicitati in questa circolare, per tener conto del comportamento peculiare dell’insieme sottostruttura-sistema d’isolamento-sovrastruttura.`),
            p(236, `Tali regole, evidentemente, non possono essere estese all’applicazione strutturale di altri sistemi di protezione sismica, quali quelli basati sull’impiego di dispositivi dissipativi distribuiti a vari livelli, all’interno della costruzione, come nel caso dei sistemi di controventi dissipativi per gli edifici a struttura intelaiata.`),
            p(236, `Per essi non è necessaria una trattazione specifica, poiché la loro progettazione non richiede regole aggiuntive rispetto a quelle già descritte per le costruzioni ordinarie, una volta che il comportamento dei dispositivi antisismici sia tenuto correttamente in conto e che le loro caratteristiche meccaniche e modalità d’utilizzo siano conformi alle prescrizioni del § 11.9 delle NTC, fatto salvo il numero di cicli da effettuare nelle prove di qualificazione, che dovrà essere commisurato a quello prevedibile per il terremoto di progetto allo SLC. Infatti, le NTC forniscono indicazioni e prescrizioni sugli strumenti e metodi di valutazione (modellazione e analisi strutturali lineari e non lineari) nonché le regole per le verifiche di sicurezza degli elementi strutturali e dei dispositivi.`),
            p(236, `Per questi schemi applicativi, lo spostamento di interpiano prodotto dal sisma attiva i meccanismi di dissipazione di energia prima che gli spostamenti relativi possano produrre danni significativi sugli elementi strutturali. In tal modo la maggior parte dell’energia in entrata viene immagazzinata e dissipata nei dispositivi, mentre la funzione di sostegno dei carichi verticali rimane attribuita alla struttura convenzionale.`),
            p(236, `Facendo riferimento alle forme tipiche degli spettri di risposta elastici delle accelerazioni e degli spostamenti di Fig. C7.10.2, il comportamento di una struttura dotata di dispositivi dissipativi, assimilata ad un oscillatore elementare, può essere interpretato osservando che l’introduzione del sistema di dissipazione produce un aumento dello smorzamento e, se il sistema determina un irrigidimento della struttura, una riduzione del periodo, oltre che, per molti sistemi di uso corrente, un aumento della resistenza complessiva.`),
            p(237, `Ciò determina una sensibile riduzione degli spostamenti complessivi (si vedano gli spettri in spostamenti) e, quindi, degli spostamenti di interpiano, con conseguente riduzione dei danni agli elementi strutturali e non.`),
            p(237, `Quando la struttura non isolata ha un periodo elevato, come nel caso esposto in figura, così da ricadere nell’intervallo del ramo calante delle curve spettrali in accelerazione, si può manifestare un aumento delle accelerazioni sulla struttura, e quindi un aumento delle forze orizzontali, con conseguente maggior impegno delle fondazioni, in particolare di quelle immediatamente sottostanti le maglie strutturali rafforzate. In ogni caso i pilastri interagenti direttamente con i controventi, a fronte di una drastica riduzione delle sollecitazioni flettenti e taglianti, subiscono un incremento delle sollecitazioni assiali.`),
            figure(237, "C7.10.2a", "C7.10.2", { x: 170, y: 190, width: 300, height: 170 }),
            p(237, `Tra i pregi che la strategia della dissipazione di energia presenta, anche rispetto all’isolamento sismico, spicca la capacità di far fronte a qualsiasi tipo di azione dinamica, indipendentemente dal contenuto in frequenza della forzante, il che la rende favorevolmente applicabile a qualsiasi tipo di edificio, in particolare anche agli edifici alti, e qualunque sia la natura del terreno di fondazione, quindi anche nel caso di terreni soffici. Inoltre essa ben si presta all’adeguamento o miglioramento sismico di costruzioni esistenti, particolarmente degli edifici intelaiati, con possibili vantaggi rispetto ad interventi sia convenzionali sia basati sull’isolamento sismico.`),
        ],
    },
    {
        number: "C7.10.2",
        title: "REQUISITI GENERALI E CRITERI PER IL LORO SODDISFACIMENTO",
        page: 237,
        blocks: [
            p(237, `Il sistema d’isolamento deve consentire elevati spostamenti orizzontali garantendo, al contempo, le previste condizioni di vincolo sotto le azioni di servizio. Per garantire quest’ultima condizione, qualora i dispositivi d’isolamento non siano in grado di garantire la condizione di vincolo necessaria, possono essere anche utilizzati dispositivi di vincolo temporaneo, del tipo “a fusibile” (v. § 11.9 delle NTC), che cessano di essere efficaci quando l’azione sismica supera una prefissata intensità. Quando si utilizzano dispositivi di vincolo temporaneo occorre valutare gli effetti che hanno sul movimento della struttura isolata, anche per azioni sismiche che eccedono questo livello prefissato.`),
            p(237, `La capacità di ricentraggio del sistema d’isolamento è un requisito aggiuntivo, legato alla necessità, o semplicemente, all’opportunità, di garantire che al termine di un terremoto anche violento il sistema d’isolamento, e quindi la struttura nella sua globalità, presenti spostamenti residui nulli o molto piccoli, in modo da non comprometterne l’efficacia operativa nel caso di scosse successive.`),
            p(237, `Il comportamento di una costruzione con isolamento sismico risulta valutabile, con una buona approssimazione, se i suoi elementi strutturali non subiscono grandi escursioni in campo plastico. La completa plasticizzazione della sovrastruttura può condurre, in alcuni casi particolari (strutture con uno o due piani, con alti periodi di isolamento, scarsa ridondanza e basso incrudimento post-elastico), a notevoli richieste di duttilità. Per questo motivo la sovrastruttura e la sottostruttura devono avere comportamento strutturale non dissipativo, il che, per azioni sismiche relative allo SLV, implica un danneggiamento strutturale molto più limitato, quasi nullo, rispetto a quello di una struttura antisismica convenzionale, per la quale si ammette che, per lo stesso livello di azione, si verifichino notevoli richieste di duttilità.`),
            p(237, `Il rispetto di questa prescrizione, peraltro, non richiede in generale sovradimensionamenti rispetto alle costruzioni convenzionali, grazie al drastico abbattimento delle accelerazioni cui la struttura isolata è soggetta, e anzi conduce a sollecitazioni di progetto paragonabili quando non inferiori. Essendo nulle o molto limitate le richieste di duttilità agli elementi strutturali, l’adozione di una progettazione in alta duttilità comporterebbe degli inutili aggravati di costo, senza sostanziali vantaggi. Pertanto per i dettagli costruttivi (e solo per questi) si fa riferimento alle regole relative alla Classe di Duttilità a media capacità dissipativa “CDB”, per la quale non si richiedono particolari capacità dissipative, ma solo un’adeguata resistenza laterale.`),
        ],
    },
    {
        number: "C7.10.3",
        title: "CARATTERISTICHE E CRITERI DI ACCETTAZIONE DEI DISPOSITIVI",
        page: 238,
        blocks: [
            p(238, `In relazione alla funzione svolta nell’ambito del sistema d’isolamento, i dispositivi facenti parte di un sistema di isolamento si possono distinguere in “isolatori” e “dispositivi ausiliari”.`),
            p(238, `Gli isolatori, in accordo con la definizione data nel § 11.9 delle NTC, sono dispositivi che svolgono fondamentalmente la funzione di sostegno dei carichi verticali, con i requisiti di un’elevata rigidezza in direzione verticale e di una bassa rigidezza o resistenza in direzione orizzontale, permettendo notevoli spostamenti orizzontali. A tale funzione possono essere associate o no quelle di dissipazione di energia, di ricentraggio del sistema, di vincolo laterale sotto carichi orizzontali di servizio (non sismici).`),
            p(238, `Ricadono nell’ampia categoria dei dispositivi ausiliari tutti quei dispositivi, trattati nel § 11.9, che non sostengono carichi verticali ma svolgono, rispetto alle azioni orizzontali, la funzione di dissipazione di energia e/o di ricentraggio del sistema e/o di vincolo laterale temporaneo per azioni sismiche o non sismiche.`),
            p(238, `Un sistema di isolamento può essere ad esempio costituito da isolatori elastomerici, eventualmente realizzati con elastomeri ad alta dissipazione o comprendenti inserti di materiali dissipativi (ad es. piombo), oppure da isolatori a scorrimento o rotolamento, che inglobano funzioni dissipative o ricentranti per capacità intrinseca o per presenza di elementi capaci di svolgere tali funzioni, oppure da un’opportuna combinazione di isolatori e dispositivi ausiliari, questi ultimi generalmente con funzione dissipativa, ricentrante e/o di vincolo.`),
            p(238, `Le proprietà di un sistema di isolamento, nel suo complesso, e la loro costanza nel tempo e nelle varie condizioni di funzionamento scaturiscono dalla combinazione delle proprietà dei dispositivi che lo costituiscono.`),
            p(238, `La scelta della tipologia di dispositivi da utilizzare in ciascun caso dipende da numerosi fattori, tra cui il livello di protezione da conseguire, le caratteristiche della struttura principale, gli ingombri, la necessità di garantire la piena funzionalità e l’assenza di danno ai dispositivi anche dopo terremoti violenti, le esigenze di manutenzione.`),
            p(238, `Tipicamente si utilizzano dispositivi di un unico tipo su tutta la struttura, sia per semplicità di progettazione ed esecuzione, sia per una generale economia dell’opera. Non è escluso, tuttavia, che per alcune situazioni progettuali, un’opportuna combinazione di tipologie diverse di dispositivi possa determinare vantaggi nel comportamento generale della struttura. In tali casi occorre ben valutare gli effetti differenziati di fattori, quali ad esempio la temperatura e l’invecchiamento, che possono variare il comportamento dei dispositivi rispetto a condizioni di riferimento medie.`),
        ],
    },
    {
        number: "C7.10.4",
        title: "INDICAZIONI PROGETTUALI",
        page: 238,
        blocks: [
            p(238, `La progettazione richiede, in generale, la scelta della tipologia dei dispositivi e il loro dimensionamento, in base agli obiettivi da raggiungere.`),
            p(238, `Nel caso in cui si intervenga su una struttura esistente, l’analisi preliminare della struttura allo stato attuale fornisce utili indicazioni per il progetto del sistema di dissipazione.`),
            p(238, `L’inserimento del sistema dissipativo sarà finalizzato a ridurre le deformazioni, in modo da contenere i danni ed evitare il collasso della struttura, attraverso le due seguenti azioni alternative:`),
            li(238, `1. l’incremento della sola dissipazione, che si traduce in uno smorzamento modale equivalente aggiuntivo, con la conseguente riduzione dell’ordinata dello spettro degli spostamenti, a parità di periodo proprio;`),
            li(238, `2. l’incremento della rigidezza e della dissipazione, per cui la riduzione dell’ordinata dello spettro degli spostamenti avviene sia per aumento dello smorzamento che per riduzione del periodo.`),
            p(238, `La prima è ottenibile con l'utilizzazione di dispositivi dipendenti dalla velocità e si applica bene a strutture dotate di per sé di buona rigidezza e resistenza, per le quali è sufficiente una riduzione dell'ordine del 20-40% delle deformazioni sismiche, conseguente ad una uguale riduzione delle forze sismiche.`),
            p(239, `La seconda è ottenibile con l’utilizzazione di dispositivi dipendenti dallo spostamento e permette di ridurre drasticamente le deformazioni prodotte dal sisma. Nel contempo si possono però avere notevoli incrementi delle accelerazioni, e quindi incrementi delle forze sismiche, con aggravio delle sollecitazioni in fondazione.`),
        ],
    },
    {
        number: "C7.10.4.1",
        title: "INDICAZIONI RIGUARDANTI I DISPOSITIVI",
        page: 239,
        blocks: [
            p(239, `La scelta prevede la possibilità di sostituzione dei dispositivi, e dunque predisporre la struttura in modo che sia possibile trasferire temporaneamente alla sottostruttura, attraverso martinetti opportunamente disposti, il carico gravante sul singolo isolatore e prevedere un adeguato spazio per le operazioni necessarie alla rimozione e sostituzione.`),
            p(239, `Per ridurre o annullare gli spostamenti residui a seguito di un terremoto è inoltre necessario verificare la presenza o prevedere appositi elementi strutturali di contrasto con cui fare forze per ricollocare la struttura nella sua posizione originaria.`),
            p(239, `Le connessioni tra i controventi e i nodi strutturali devono essere progettate in modo tale da assorbire, con ampio margine di sicurezza, le forze previste dal calcolo. Le stesse aste non dovranno subire fenomeni di instabilità, sotto la massima forza che il dispositivo dissipativo è in grado di trasmettere.`),
            p(239, `Per i dispositivi dipendenti dagli spostamenti i parametri fondamentali sono la rigidezza k_d e la resistenza F_dy, la duttilità μ_c e il rapporto tra la rigidezza del sistema dissipativo k_c e quella della struttura k_s, mentre per i dispositivi dipendenti dalla velocità sono la costante di smorzamento e l’eventuale rigidezza.`),
            figure(239, "C7.10.2b", "C7.10.2", { x: 180, y: 280, width: 270, height: 180 }),
            p(239, `La rigidezza del sistema dissipativo deriva dalla combinazione delle rigidezze dei singoli componenti, ossia del dispositivo dissipativo e della struttura, generalmente metallica, di supporto.`),
            p(239, `Indicando con: k_c la rigidezza del sistema dissipativo, k_a la rigidezza del telaio, k_d la rigidezza del dispositivo e k_s la rigidezza del supporto metallico e, con riferimento alla Figura C7.10.2, si ha:`),
            formula(239, "C7.10.1"),
            formula(239, "C7.10.2"),
            p(239, `In generale il sistema di supporto deve possedere un’elevata rigidezza, rigidezza assiale se si tratta di controventi, necessaria per concentrare le deformazioni indotte dal sisma nei dispositivi e per garantire una significativa dissipazione d’energia per piccoli spostamenti.`),
            p(239, `Per garantire un’efficace interazione, i sistemi dissipativi devono essere posizionati nel piano dei telai, possibilmente all’interno delle maglie strutturali. In caso contrario, particolare attenzione va posta nello studio delle connessioni, che possono risultare non sufficientemente rigide o indurre eccessive sollecitazioni locali nelle strutture portanti dell’edificio.`),
        ],
    },
    {
        number: "C7.10.4.2",
        title: "CONTROLLO DI MOVIMENTI INDESIDERATI",
        page: 239,
        blocks: [
            p(239, `Gli effetti torsionali d’insieme del sistema strutturale, ossia di rotazione intorno ad un asse verticale, determinano spostamenti diversi nei dispositivi e, nel caso di forti non linearità, differenze di comportamento che possono ulteriormente accentuare la torsione. Occorre pertanto evitare o limitare quanto più possibile le eccentricità massa-rigidezza, cosa peraltro facilmente ottenibile attraverso una corretta progettazione degli isolatori e dei dispositivi ausiliari, e incrementare la rigidezza e/o resistenza torsionale del sistema d’isolamento.`),
        ],
    },
    {
        number: "C7.10.4.3",
        title: "CONTROLLO DEGLI SPOSTAMENTI SISMICI DIFFERENZIALI DEL TERRENO",
        page: 240,
        blocks: [
            p(240, `Si sottolinea la necessità di valutare i possibili effetti sulla struttura legati alla deformabilità verticale degli isolatori elastomerici, funzione delle caratteristiche geometriche dell’isolatore e meccaniche dell’elastomero, e a quella pressoché nulla degli isolatori a scorrimento. Si possono avere spostamenti differenziali significativi sia nella fase elastica di caricamento, sia nella fase successiva, di deformazioni lente (viscosità della gomma), sia, infine, sotto l’azione del terremoto.`),
            p(240, `L’isolatore in gomma, infatti sottoposto a spostamento laterale, subisce anche accorciamenti verticali non trascurabili, a causa della concentrazione degli sforzi di compressione nell’area di sovrapposizione tra la piastra superiore e quella inferiore, nella condizione di isolatore deformato. In termini generali è consigliabile adottare isolatori in gomma molto rigidi verticalmente e, dunque, con fattori di forma primario e secondario piuttosto elevati, così da minimizzare gli spostamenti verticali in condizioni statiche e sismiche.`),
            p(240, `Gli isolatori soggetti a forze di trazione o a sollevamento durante l’azione sismica dovranno essere in grado di sopportare la trazione o il sollevamento senza perdere la loro funzionalità strutturale.`),
            p(240, `La presenza di sforzi di trazione eccessivi negli isolatori elastomerici può indurre cavitazione nella gomma e l’innesco di rotture. Nel caso di isolatori a scorrimento, possono determinarsi sollevamenti e quindi distacchi tra le superfici di scorrimento, con possibili negativi effetti di impatto. In generale, la trazione negli isolatori determina comportamenti non lineari, difficilmente valutabili attraverso un calcolo lineare, ed una condizione di lavoro degli isolatori di solito non verificata sperimentalmente.`),
            p(240, `In generale, salvo situazioni particolari in cui una parte della struttura abbia resistenza sovrabbondante rispetto alla richiesta locale, sarà opportuno che il sistema di dissipazione sia distribuito lungo tutta l’altezza della struttura, con caratteristiche meccaniche piano per piano calibrate in modo da conseguire gli obiettivi sopra richiamati.`),
            p(240, `La posizione e la configurazione dei controventi dissipativi è spesso condizionata dalle esigenze architettoniche, e ciò può costituire un vincolo all’ottimizzazione della posizione in pianta e della disposizione nella maglia strutturale. Sarà, quindi, opportuno cercare soluzioni concordate con il progettista architettonico, che possano conciliare entrambe le esigenze.`),
            p(240, `È opportuna una buona ridondanza degli elementi che costituiscono il sistema di protezione per un duplice motivo. In primo luogo, l’utilizzo di un maggior numero di controventi consente di ridurre le sollecitazioni indotte sulle membrature cui essi sono collegati. In secondo luogo, disponendo più controventi all’interno della struttura, è possibile scongiurare il rischio che il malfunzionamento di un dispositivo possa compromettere l’efficacia dell’intero sistema di protezione.`),
        ],
    },
    {
        number: "C7.10.4.4",
        title: "CONTROLLO DEGLI SPOSTAMENTI RELATIVI AL TERRENO ED ALLE COSTRUZIONI CIRCOSTANTI",
        page: 240,
        blocks: [
            p(240, `Il corretto funzionamento di una struttura con isolamento sismico si consegue solo a condizione che la massa isolata, ossia quella della sovrastruttura, possa muoversi liberamente in tutte le direzioni orizzontali per spostamenti almeno pari a quelli di progetto. Questa condizione deve essere verificata in tutte le fasi progettuali, realizzative e di collaudo.`),
            p(240, `In particolare è importante controllare che elementi non strutturali e/o impianti non riducano le possibilità di movimento della struttura previste nella progettazione strutturale. In tal senso è richiesta, da parte di tutti i progettisti inclusi quelli architettonici e impiantistici, la massima sensibilizzazione e la piena consapevolezza delle modalità di funzionamento di una struttura con isolamento sismico.`),
            p(240, `È inoltre importante controllare coprigiunti e elementi di attraversamento orizzontali (dispositivi di giunto) e verticali (scale, ascensori), affinché siano concepiti e realizzati così da non impedire il libero movimento della sovrastruttura.`),
        ],
    },
    {
        number: "C7.10.5",
        title: "MODELLAZIONE E ANALISI STRUTTURALE",
        page: 240,
        blocks: [
            p(240, `Il modello matematico dell’edificio deve tener conto della effettiva distribuzione in pianta e in elevazione dei dispositivi dissipativi, per consentire la valutazione esplicita della distribuzione delle forze e delle azioni di progetto nei componenti al sistema dissipativo. I rapporti di rigidezza tra il sistema di dissipazione e la struttura portante sono importanti per determinare la distribuzione delle forze orizzontali tra l’uno e l’altra e il comportamento dinamico dell’insieme. La complessità, inoltre, si accresce in relazione al fatto che la rigidezza delle membrature in c.a. è fortemente condizionata dalla fessurazione, a sua volta funzione del livello di sollecitazione flessionale e tagliante, dell’entità dello sforzo assiale e della quantità di armatura, e di tali parametri è necessario tener conto almeno in maniera approssimata.`),
            p(240, `Nella modellazione del sistema di controventamento, occorre portare in conto la deformabilità dei collegamenti alla struttura portante e al dispositivo dissipativo.`),
        ],
    },
    {
        number: "C7.10.5.1",
        title: "PROPRIETÀ DEL SISTEMA DI ISOLAMENTO",
        page: 241,
        blocks: [
            p(241, `Ai fini della valutazione globale delle variazioni delle caratteristiche meccaniche da mettere in conto nelle analisi, occorrerà tener conto sia della (bassa) probabilità di occorrenza del terremoto contemporaneamente alle diverse condizioni che determinano tali variazioni, sia della correlazione tra le variazioni dei parametri che definiscono il comportamento meccanico dei diversi dispositivi che compongono il sistema di isolamento, in particolare verificando se le variazioni avvengono con stesso segno o con segno opposto.`),
            p(241, `L’entità delle deformazioni subite in relazione allo stato limite considerato ha notevole influenza nel caso di sistemi a comportamento non lineare, minore nel caso di sistemi a comportamento quasi-lineare. Nel primo caso, quando si esegue l’analisi non lineare, tale variabilità è automaticamente messa in conto nel modello. Qualora, invece, fosse possibile adottare l’analisi lineare, particolare cura dovrà essere rivolta alla determinazione delle caratteristiche lineari equivalenti del sistema. Per i sistemi quasi lineari l’effetto risulterà tanto maggiore quanto maggiore è la dissipazione di energia. Nel caso di isolatori elastomerici, per rapporti di smorzamento dell’ordine del 10%, le analisi per lo SLU e per lo SLD possono eseguirsi, in genere, con gli stessi valori di rigidezza e di smorzamento, se i valori di deformazione raggiunti per i due livelli di azione sono compresi tra il 50% e il 150%.`),
            p(241, `La velocità di deformazione (frequenza), nell’intervallo di variabilità del ±30% del valore di progetto ha, per la maggior parte dei dispositivi normalmente utilizzati, influenza trascurabile. Più importanti sono le differenze di comportamento tra le condizioni di esercizio (ad esempio in relazione a spostamenti lenti dovuti a variazioni termiche) e quelle sismiche, differenziandosi le velocità di qualche ordine di grandezza.`),
            p(241, `La rigidezza o la resistenza agli spostamenti orizzontali di alcuni tipi di isolatori dipendono dall’entità degli sforzi verticali agenti simultaneamente agli spostamenti sismici orizzontali. Ciò accade in maniera significativa per gli isolatori a scorrimento e, in misura minore, per gli isolatori elastomerici con basso fattore di forma secondario.`),
            p(241, `Per gli isolatori elastomerici con elevati fattori di forma e con verifiche di stabilità soddisfatte con ampio margine, la dipendenza della rigidezza orizzontale dallo sforzo verticale presente è in genere trascurabile.`),
            p(241, `Il comportamento di un dispositivo secondo una direzione può essere, per alcuni tipi, influenzato dalle deformazioni in direzione trasversale a quella considerata, per effetti del second’ordine non trascurabili.`),
            p(241, `Le variazioni di caratteristiche meccaniche conseguenti alle variazioni termiche potranno essere valutate coerentemente con i valori di combinazione degli effetti termici.`),
            p(241, `Nel piano di manutenzione dei dispositivi antisismici occorre tenere conto degli effetti dell’invecchiamento che, per i dispositivi elastomerici, possono essere particolarmente significativi.`),
        ],
    },
    {
        number: "C7.10.5.2",
        title: "MODELLAZIONE",
        page: 241,
        blocks: [
            p(241, `Anche nel caso in cui sia necessario ricorrere all’analisi non lineare, il modello della sovrastruttura e della sottostruttura sarà costituito da elementi a comportamento lineare, essendo assenti o trascurabili le escursioni in campo non lineare della struttura, per quanto specificato in § 7.10.5.2 e § 7.10.6.2.1.`),
            p(241, `In tal caso si farà riferimento ad un modello in cui gli elementi della struttura operano in campo elastico lineare mentre gli elementi del sistema d’isolamento operano in campo non lineare, riproducendone al meglio il comportamento ciclico reale dei dispositivi, così come ricavato dalle prove di qualificazione (v. § 11.9).`),
        ],
    },
    {
        number: "C7.10.5.3",
        title: "ANALISI",
        page: 241,
        blocks: [
            p(241, `L’analisi statica lineare è applicabile solo nei casi in cui il sistema d’isolamento è modellabile come visco-elastico lineare (v. § 7.10.5.2) e solo quando sono soddisfatte le condizioni specificate in § 7.10.5.3.1, che individuano edifici e ponti con caratteristiche correnti e regolari.`),
            p(241, `L’analisi dinamica lineare è applicabile in tutti i casi in cui il sistema d’isolamento è modellabile come visco-elastico lineare (v. § 7.10.5.2).`),
            p(241, `L’analisi dinamica non lineare del sistema d’isolamento può essere svolta in ogni caso. Essa è obbligatoria quando il sistema d’isolamento non può essere rappresentato da un modello lineare equivalente. In tal caso si farà riferimento ad un modello in cui gli elementi della struttura operano in campo elastico lineare mentre gli elementi del sistema d’isolamento operano in campo non lineare, riproducendone al meglio il suo comportamento ciclico (v. § 7.10.5.2).`),
            p(241, `Particolare attenzione andrà posta nella scelta dei parametri di smorzamento viscoso del sistema strutturale. Quando la dissipazione nel sistema d’isolamento è affidata esclusivamente a dispositivi con comportamento dipendente dallo spostamento, la matrice di smorzamento andrà definita in modo tale che lo smorzamento viscoso dia un contributo trascurabile alla dissipazione di energia nel movimento del sistema d’isolamento e il corretto contributo, assimilabile a quello della struttura in elevazione operante in campo lineare, nei movimenti della struttura. Per valutare l’influenza della scelta dei parametri dello smorzamento è consigliabile eseguire più analisi variando tali parametri intorno al valore ritenuto più idoneo.`),
            p(242, `Non è citata l’analisi statica non lineare in quanto, dovendo essere trascurabili le non linearità che si sviluppano nella struttura, l’adozione dell’analisi statica non lineare non comporterebbe particolari vantaggi nella progettazione della struttura.`),
            p(242, `Per le costruzioni con sistemi di dissipazione di energia le prescrizioni del § 7.3 delle NTC, integrate con le indicazioni contenute nei successivi punti possono costituire un utile riferimento.`),
            p(242, `La dipendenza del comportamento dei dispositivi da fattori quali la frequenza, la temperatura, l’invecchiamento dei materiali, può essere tenuta in conto, qualora significativa, effettuando analisi multiple che considerino il comportamento dei dispositivi in corrispondenza dei valori limite dei parametri sopra detti. Le verifiche di sicurezza degli elementi strutturali e dei componenti del sistema dissipativo saranno riferite alla risposta più gravosa ottenuta dall’analisi multipla.`),
            p(242, `Per l’effettuazione delle verifiche agli SLU occorre, in generale, effettuare due serie di analisi. Per le verifiche della struttura le sollecitazioni saranno calcolate con riferimento alle azioni valide per lo SLV, per le verifiche dei dispositivi si farà riferimento alle azioni valide per lo SLC.`),
            p(242, `Nella valutazione dei risultati delle analisi, particolare attenzione andrà posta alla determinazione del numero di cicli di grande ampiezza cui sono soggetti i dispositivi, al fine di definire correttamente il programma delle prove di qualificazione e accettazione dei dispositivi stessi (v. § 11.9 e relativi commenti in circolare).`),
        ],
    },
    {
        number: "C7.10.5.3.1",
        title: "Analisi lineare statica",
        page: 242,
        blocks: [
            p(242, `L’analisi statica lineare considera due traslazioni orizzontali indipendenti, cui sovrappone gli effetti torsionali. Si assume che la sovrastruttura sia un solido rigido che trasla al di sopra del sistema di isolamento, con un periodo equivalente di traslazione pari`),
            formula(242, "C7.10.3"),
            p(242, `in cui:`),
            p(242, `M è la massa totale della sovrastruttura;`),
            p(242, `K_esi è la rigidezza equivalente orizzontale del sistema d’isolamento, ottenuta trascurando eventuali effetti torsionali a livello di isolamento.`),
            p(242, `Lo spostamento del centro di rigidezza dovuto all’azione sismica d_dc verrà calcolato, in ciascuna direzione orizzontale, mediante la seguente espressione (equazione [7.10.2] della norma):`),
            formula(242, "C7.10.4"),
            p(242, `In cui S_e(T_is, ξ_esi) è l’accelerazione spettrale definita in 3.2.3 per la categoria di suolo di fondazione appropriata e K_esi,min è la rigidezza equivalente minima in relazione alla variabilità delle proprietà meccaniche del sistema di isolamento, per effetto dei fattori definiti in § C7.10.1.`),
            p(242, `Anche quando non sussistono le condizioni per la sua applicabilità, l’analisi statica lineare è un ottimo ausilio per la progettazione del sistema di isolamento e dei principali elementi strutturali ed i suoi risultati possono fornire utili indicazioni all’impostazione generale del progetto e sui risultati ottenuti con analisi più sofisticate soprattutto nei passi relativi alla verifica del sistema di isolamento e alla valutazione del taglio alla base.`),
        ],
    },
    {
        number: "C7.10.5.3.2",
        title: "Analisi lineare dinamica",
        page: 242,
        blocks: [
            p(242, `La matrice di smorzamento, in caso di integrazione diretta delle equazioni del moto (analisi con accelerogrammi), può essere definita, se non si può determinarla direttamente, con la classica formulazione:`),
            formula(242, "C7.10.5"),
            p(242, `con:`),
            formula(242, "C7.10.6"),
            formula(242, "C7.10.7"),
            p(242, `ξ = valore dello smorzamento che si vuole attribuire ai modi principali, mentre T_1 e T_2 definiscono il range di periodi per il quale si vuole che lo smorzamento sia all’incirca pari a ξ (con valore esatto agli estremi dell’intervallo).`),
            p(242, `Si possono adottare due diverse strategie nel fissare i parametri ξ_1,T_1, ξ_2,T_2:`),
            li(242, `1. assumere ξ_1=ξ_2=ξ e scegliere T_1 e T_2 in modo da definire il campo di periodi di interesse;`),
            li(242, `2. scegliere ξ_1 e ξ_2 in modo da garantire un adeguato smorzamento nei modi principali e scegliere T_1 e T_2 in modo da definire il campo di periodi di interesse.`),
            p(243, `Per scegliere nella maniera più opportuna occorre tener conto dello smorzamento risultante per gli altri modi di vibrare dall’adozione dei coefficienti α e β tarati su due soli modi, ricavabile con la formula seguente:`),
            formula(243, "C7.10.8"),
        ],
    },
    {
        number: "C7.10.6",
        title: "VERIFICHE",
        page: 243,
        blocks: [],
    },
    {
        number: "C7.10.6.1",
        title: "VERIFICHE AGLI STATI LIMITE DI ESERCIZIO",
        page: 243,
        blocks: [
            p(243, `Il requisito del sostanziale mantenimento in campo elastico della struttura nelle verifiche allo SLV fornisce ampie garanzie rispetto alla sicurezza nei confronti dello SLD.`),
            p(243, `Ovviamente la condizione da rispettare allo SLD relativa agli spostamenti di interpiano, si applica solo agli edifici. In generale gli edifici con isolamento sismico subiscono spostamenti interpiano decisamente minori rispetto agli edifici convenzionali, grazie alla forte riduzione dell’ordinata spettrale legata all’incremento del periodo proprio e dello smorzamento, riduzione che può risultare dell’ordine di 4-5 volte e anche più. Per questo negli edifici con isolamento sismico i limiti da rispettare, pur ridotti ai 2/3 dei limiti utilizzati per gli edifici convenzionali, garantiscono un livello di protezione maggiore anche agli elementi non strutturali.`),
            p(243, `La presenza di spostamenti residui, ad esempio derivanti da plasticizzazioni più o meno estese degli elementi base, nel caso di sistemi a comportamento non lineare, non deve, in generale, portare né a malfunzionamenti del sistema d’isolamento, né a compromissione delle normali condizioni di esercizio dell’edificio.`),
            p(243, `Il comportamento quasi-elastico degli isolatori in gomma garantisce un ritorno alla condizione indeformata, anche se non necessariamente immediato, e garantisce il ripristino delle condizioni pre-sisma, senza necessità di verifiche apposite.`),
            p(243, `Date le modalità di funzionamento di una struttura con isolamento alla base, possono verificarsi spostamenti relativi non trascurabili (qualche centimetro) tra la sovrastruttura e le pareti fisse (sottostruttura, terreno, costruzioni adiacenti), anche per le azioni sismiche relative allo SLD. Tali spostamenti potrebbero arrecare danni alle connessioni, se queste non vengono esplicitamente progettate per sostenerli ed alle tubazioni rigide tipicamente adottate nella transizione tra edifici fissi alla base e terreno (o altre costruzioni o parti strutturali). Occorre, perciò, prestare particolare attenzione ai dettagli degli impianti, soprattutto delle condutture, in corrispondenza dell’attraversamento dei giunti. Per queste ultime occorre adottare delle giunzioni flessibili e comunque che permettano di subire spostamenti dell’entità detta, senza determinare danni e perdite.`),
            p(243, `Si raccomanda di valutare, di caso in caso, l’opportunità di elevare la protezione degli impianti, riferendola al terremoto di progetto allo SLV, come già richiesto in C7.10.6.2.1 per le costruzioni di classe IV, o comunque un’azione di intensità superiore a quella dello SLD.`),
            p(243, `È auspicabile che i dispositivi dissipativi possano esplicare la loro funzione dissipativa anche per le azioni orizzontali relative allo SLD, senza però compromettere le prestazioni allo SLC.`),
            p(243, `Gli edifici rinforzati mediante inserimento di dispositivi dissipativi che potrebbero giungere a rottura per un numero non elevato di cicli (es. smorzatori di tipo elastoplastico) devono resistere in campo elastico alle altre azioni di progetto, al fine di evitare rotture premature dovute a fatica.`),
        ],
    },
    {
        number: "C7.10.6.2",
        title: "VERIFICHE AGLI STATI LIMITE ULTIMI",
        page: 243,
        blocks: [],
    },
    {
        number: "C7.10.6.2.1",
        title: "Verifiche allo SLV",
        page: 243,
        blocks: [
            p(243, `Di seguito si forniscono alcune indicazioni per gli edifici isolati alla base.`),
            p(243, `Per un corretto funzionamento del sistema di isolamento, occorre che la sottostruttura rimanga in campo sostanzialmente elastico, sotto l’effetto delle azioni sismiche di progetto. Le forze d’inerzia rispetto alle quali occorre verificare gli elementi della sottostruttura saranno quelle trasmesse dalla sovrastruttura, attraverso il sistema di isolamento, e quelle direttamente agenti su di essa. Queste ultime, nel caso in cui la sottostruttura sia estremamente rigida ed abbia modi di vibrare con periodo di oscillazione inferiore a 0,05 s, dunque in sostanziale assenza di amplificazioni, potranno essere calcolate applicando direttamente la massima accelerazione del terreno alle masse della sottostruttura.`),
            p(243, `In virtù della bassa probabilità che i massimi delle sollecitazioni indotte nella sottostruttura dalle forze d’inerzia sulla sovrastruttura e dalle forze d’inerzia direttamente applicate alla sottostruttura siano contemporanei, si può applicare la regola di combinazione della radice quadrata della somma dei quadrati, anche nel caso in cui le sollecitazioni prodotte dai due sistemi di forze d’inerzia (sulla sovrastruttura e sulla sottostruttura) siano calcolate separatamente mediante analisi statiche.`),
            p(243, `Per evitare danneggiamenti significativi della sovrastruttura, le sollecitazioni di progetto degli elementi strutturali della sovrastruttura possono essere determinate a partire da quelle ottenute dal calcolo, nell’ipotesi di comportamento perfettamente elastico lineare, utilizzando un fattore di comportamento pari a 1,5.`),
            p(243, `Le parti dei dispositivi non impegnate nella funzione dissipativa, cui si riferisce la norma, sono, ad esempio, gli elementi di connessione alla struttura (bulloni, piastre, etc.), le piastre cui sono attaccate le superfici di scorrimento degli isolatori in acciaio-`),
            p(244, `PTFE, il cilindro e lo stelo di un dispositivo viscoso, tutti gli elementi costruttivi e le connessioni di un dispositivo elasto-plastico ad esclusione degli elementi dissipativi (metallici o altro), etc..`),
            p(244, `Gli edifici di classe d’uso IV debbono mantenere la loro piena funzionalità anche dopo un terremoto violento. Per i loro impianti, pertanto, si richiede che vengano rispettati i requisiti di assenza di danni nelle connessioni anche per il terremoto di progetto allo SLV.`),
        ],
    },
    {
        number: "C7.10.6.2.2",
        title: "Verifiche allo SLC",
        page: 244,
        blocks: [
            p(244, `La verifica allo SLC dei dispositivi del sistema d’isolamento realizza il requisito enunciato in precedenza, riguardante il livello superiore di sicurezza richiesto al sistema d’isolamento. Lo spostamento d_2, che definisce lo spostamento di riferimento per la verifica dei dispositivi di isolamento, è prodotto da un terremoto di intensità superiore all’intensità del terremoto per il quale vengono progettate le strutture allo SLV. Ciò implica la necessità di ripetere il calcolo, anche in caso di analisi dinamica lineare.`),
            p(244, `Per gli impianti pericolosi, in particolare per le condutture del gas, la verifica della capacità delle strutture di sopportare senza perdite di fluidi gli spostamenti relativi va obbligatoriamente riferita alle azioni sismiche relative allo SLC, in relazione all’alto rischio che essi implicano e che, in caso di rottura, può portare la struttura al collasso o creare condizioni di pericolo per la vita umana.`),
        ],
    },
    {
        number: "C7.10.8",
        title: "ACCORGIMENTI SPECIFICI IN FASE DI COLLAUDO",
        page: 244,
        blocks: [
            p(244, `È auspicabile che il collaudatore abbia specifiche competenze, acquisite attraverso precedenti esperienze, come progettista, collaudatore o direttore dei lavori di strutture con isolamento sismico, o attraverso corsi universitari o di specializzazione universitaria.`),
            p(244, `Oltre a quanto indicato nelle norme tecniche emanate ai sensi dell’art.21 della legge 5.11.71 n.1086, per le opere in c.a., in c.a.p. ed a struttura metallica, devono osservarsi le indicazioni di seguito riportate:`),
            li(244, `1. devono essere acquisiti dal collaudatore i documenti di origine, forniti dal produttore dei dispositivi, unitamente ai certificati relativi alle prove sui materiali ed alla qualificazione dei dispositivi, nonché i certificati relativi alle prove di accettazione in cantiere disposte dalla Direzione dei Lavori;`),
            li(244, `2. la documentazione ed i certificati sopraindicati devono essere esposti nella relazione a struttura ultimata del Direttore dei Lavori cui spetta, ai sensi delle vigenti norme, il preminente compito di accertare la qualità dei materiali impiegati nella realizzazione dell’opera.`),
            p(244, `In relazione all’importanza di assicurare la totale libertà di spostamento orizzontale della sovrastruttura (ossia della parte isolata), ai fini del corretto funzionamento dell’isolamento sismico, particolare attenzione andrà posta nel verificare tale condizione nelle ispezioni di collaudo. Oltre all’assenza di connessioni strutturali, è importante verificare che non ci siano elementi non strutturali, impianti o contatto con il terreno circostante che possano creare impedimento al movimento della sovrastruttura.`),
        ],
    },
];

const formulas = [
    ["C7.10.1", "C7.10.4.1", 239, "k_c=\\frac{1}{\\frac{1}{k_d}+\\frac{1}{k_a}}"],
    ["C7.10.2", "C7.10.4.1", 239, "k_{TOT}=k_s+k_c"],
    ["C7.10.3", "C7.10.5.3.1", 242, "T_{is}=2\\pi\\sqrt{M/K_{esi}}"],
    ["C7.10.4", "C7.10.5.3.1", 242, "d_{dc}=\\frac{M\\,\\cdot\\,S_e(T_{is},\\xi_{esi})}{K_{esi,min}}"],
    ["C7.10.5", "C7.10.5.3.2", 242, "C=\\alpha M+\\beta K"],
    ["C7.10.6", "C7.10.5.3.2", 242, "\\alpha=4\\pi\\frac{\\xi_2T_2-\\xi_1T_1}{T_2^2-T_1^2}"],
    ["C7.10.7", "C7.10.5.3.2", 242, "\\beta=\\left[\\frac{T_1T_2}{\\pi}\\right]\\left[\\frac{\\xi_1T_2-\\xi_2T_1}{T_2^2-T_1^2}\\right]"],
    ["C7.10.8", "C7.10.5.3.2", 243, "\\xi_i=0.5\\left[\\frac{\\alpha T_i}{2\\pi}+\\frac{2\\pi\\beta}{T_i}\\right]"],
] as const;

const figures = [
    ["C7.10.1", "C7.10.1", "C7.10.1", 236, "Figura C7.10.1 - Strategie di riduzione della domanda mediante isolamento sismico", [80, 350, 520, 480]],
    ["C7.10.2a", "C7.10.1", "C7.10.2", 237, "Figura C7.10.2 - Strategie di riduzione della domanda mediante dissipazione di energia", [170, 190, 470, 360]],
    ["C7.10.2b", "C7.10.4.1", "C7.10.2", 239, "Figura C7.10.2 - Rigidezza risultante del telaio rinforzato con sistema dissipativo", [180, 280, 450, 460]],
] as const;

const outputDirectory = join(root, "corpus", "units", "circ2019");
await mkdir(outputDirectory, { recursive: true });
const knownNtcNumbers = new Set(
    (await readdir(join(root, "corpus", "units", "ntc2018")))
        .filter((name) => name.endsWith(".json"))
        .map((name) => name.slice(0, -5)),
);
for (const unit of units) {
    const id = unitId(unit.number);
    const lower = unit.number.toLowerCase();
    const numberParts = unit.number.slice(1).split(".").map(Number);
    const parentParts = lower.split(".");
    parentParts.pop();
    const ancestorIds = lower
        .split(".")
        .slice(1)
        .map((_, index) => unitId(lower.split(".").slice(0, index + 1).join(".")));
    const hasNtcTarget = knownNtcNumbers.has(unit.number.slice(1));
    const specs = [{ kind: "heading" as const, page: unit.page, text: `${unit.number} ${unit.title}` }, ...unit.blocks];
    const blocks = specs.map((block, index) => {
        const blockId = index === 0 ? "block-heading" : `block-editorial-${String(index).padStart(3, "0")}`;
        if ("asset" in block) {
            return {
                blockId: `${id}#${blockId}`,
                kind: block.kind,
                origin: "official",
                assetId: block.asset,
                evidence: evidence(block.page, block.label, block.region ?? null),
            };
        }
        const segments = inline(block.text);
        return {
            blockId: `${id}#${blockId}`,
            kind: block.kind,
            origin: "official",
            text: {
                raw: block.text,
                normalized: block.text,
                normalizationVersion: profile,
                ...(segments ? { inline: segments } : {}),
            },
            evidence: evidence(block.page, block.text),
        };
    });
    const relation = hasNtcTarget
        ? [{
              relationId: `${id}#relation-001`,
              type: "clarifies",
              targetUnitId: `urn:structural-codes:it:unit:ntc2018:${unit.number.slice(1)}`,
              basis: "editorial",
              evidenceBlockIds: [`${id}#block-heading`],
              rationale: "Corrispondenza proposta tra numerazione omologa della Circolare e delle NTC; richiede conferma umana sul contenuto completo.",
              review: { status: "proposed", reviewedBy: null, reviewedAt: null },
          }]
        : [];
    const record = {
        $schema: "urn:structural-codes:schema:canonical-unit:v2",
        schemaVersion: "2.0.0-alpha.2",
        recordType: "canonical-unit",
        id,
        workId: "it-mit:circ:2019-01-21:7-csllpp",
        expressionId: "it-mit:circ:2019-01-21:7-csllpp:original-it",
        kind: numberParts.length === 2 ? "section" : numberParts.length === 3 ? "paragraph" : "subparagraph",
        numbering: { official: unit.number, sortKey: numberParts.map((part) => String(part).padStart(3, "0")).join(".") },
        title: unit.title,
        titleBlockId: `${id}#block-heading`,
        hierarchy: {
            parentId: unitId(parentParts.join(".")),
            ancestorIds,
            position: numberParts.at(-1),
        },
        validity: { from: null, to: null, status: "unknown", asOf },
        blocks,
        citations: [],
        relations: relation,
        assets: {
            formulaIds: blocks.filter(({ kind }) => kind === "formula-ref").map(({ assetId }: any) => assetId),
            tableIds: [],
            figureIds: blocks.filter(({ kind }) => kind === "figure-ref").map(({ assetId }: any) => assetId),
        },
        workflow: {
            status: "extracted",
            createdBy: { actorId: "generator:circ710-step1", kind: "script", toolVersion: profile },
            createdAt: "2026-08-09T12:00:00Z",
            reviews: [],
            openIssues: [
                {
                    issueId: `circ2019-${lower.replaceAll(".", "-")}-source-review`,
                    type: "normalization-review",
                    severity: "blocking",
                    note: "Trascrizione manuale confrontata con il render ufficiale; resta obbligatoria la revisione umana indipendente.",
                },
                {
                    issueId: `circ2019-${lower.replaceAll(".", "-")}-missing-text-layer`,
                    type: "missing-region",
                    severity: "blocking",
                    note: "Il layer testuale ufficiale delle pagine contiene solo intestazione e numero pagina; il testo è stato trascritto manualmente dal render PDF.",
                },
                ...(unit.number === "C7.10.1" || unit.number === "C7.10.4.1"
                    ? [{
                          issueId: `circ2019-${lower.replaceAll(".", "-")}-duplicate-figure-number`,
                          type: "normalization-review",
                          severity: "blocking",
                          note: "La fonte ufficiale usa il numero Figura C7.10.2 per due figure graficamente distinte; gli asset sono mantenuti separati senza correggere la numerazione della fonte.",
                      }]
                    : []),
                ...(hasNtcTarget
                    ? [{
                          issueId: `circ2019-${lower.replaceAll(".", "-")}-relation`,
                          type: "relation-review",
                          severity: "blocking",
                          note: "Il collegamento Circolare-NTC per numerazione omologa richiede conferma umana.",
                      }]
                    : []),
            ],
        },
    };
    await writeFile(join(outputDirectory, `${lower}.json`), `${JSON.stringify(record, null, 2)}\n`, "utf8");
}

const manifest = {
    $schema: "urn:structural-codes:schema:asset-manifest:v2",
    schemaVersion: "2.0.0-alpha.1",
    recordType: "asset-manifest",
    document: "circ2019",
    section: "C7.10",
    sourceId,
    status: "transcribed-unreviewed",
    formulas: formulas.map(([number, unit, page, latex]) => ({
        id: assetId("formula", number),
        unitId: unitId(unit),
        officialNumber: number,
        pdfPage: page,
        latex,
    })),
    tables: [],
    figures: figures.map(([assetNumber, unit, officialNumber, page, caption, box]) => ({
        id: assetId("figure", assetNumber),
        unitId: unitId(unit),
        officialNumber,
        pdfPage: page,
        caption,
        alt: caption,
        imagePath: `figures/circ2019/fig${assetNumber.toLowerCase()}.png`,
        region: {
            coordinateSystem: "pdf-points-top-left",
            x: box[0],
            y: box[1],
            width: box[2] - box[0],
            height: box[3] - box[1],
        },
        sha256: "0".repeat(64),
    })),
};
await writeFile(join(root, "corpus", "assets", "circ2019", "7.10.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(`circ710-step1: generated ${units.length} units, ${formulas.length} formulas and ${figures.length} figures`);
