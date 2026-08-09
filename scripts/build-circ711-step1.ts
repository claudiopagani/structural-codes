/* eslint-disable @typescript-eslint/no-explicit-any */
import { createHash } from "node:crypto";
import { mkdir, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const sourceId = "circ-7-2019";
const profile = "circ711-step1-manual-render-transcription-0.1.0";
const asOf = "2026-08-09";
const unitId = (number: string): string =>
    `urn:structural-codes:it:unit:circ2019:${number.toLowerCase()}`;
const sha256 = (value: string): string =>
    createHash("sha256").update(value, "utf8").digest("hex");

const mathTerms: Array<[string, string]> = [
    ["a_max=S_s·a_g", "a_{max}=S_s\\,a_g"],
    ["a_max", "a_{max}"],
    ["a_g", "a_g"],
    ["S_s", "S_s"],
    ["S_T", "S_T"],
    ["S_e", "S_e"],
    ["CRR", "CRR"],
    ["CSR", "CSR"],
    ["τ_media/σ’_v0", "\\tau_{media}/\\sigma'_{v0}"],
    ["τ_f/σ’_v0", "\\tau_f/\\sigma'_{v0}"],
    ["τ_max", "\\tau_{max}"],
    ["σ’_v0", "\\sigma'_{v0}"],
    ["I_L", "I_L"],
    ["V_s", "V_s"],
    ["a_max>0.15g", "a_{max}>0{,}15g"],
    ["Δu", "\\Delta u"],
    ["σ’_v", "\\sigma'_v"],
    ["C_αu", "C_{\\alpha u}"],
    ["k_h,eq", "k_{h,eq}"],
    ["β_s", "\\beta_s"],
    ["β_m<1", "\\beta_m<1"],
    ["β_m", "\\beta_m"],
    ["γ_R", "\\gamma_R"],
    ["k_hE", "k_{hE}"],
    ["a_h", "a_h"],
    ["1.20", "1{,}20"],
    ["2.3", "2{,}3"],
    ["1.8", "1{,}8"],
    ["0,18g", "0{,}18g"],
    ["30%", "30\\%"],
    ["800 m/s", "800\\,m/s"],
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
            if (index >= 0 && (!next || index < next.index || (index === next.index && value.length > next.value.length))) {
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

function evidence(page: number, text: string): any {
    return {
        sourceId,
        pdfPage: page,
        printedPage: String(page - 4),
        region: null,
        extraction: { method: "manual-transcription", tool: "codex-render-transcription", toolVersion: profile },
        transformations: [],
        rawSha256: sha256(text),
        normalizedSha256: sha256(text),
    };
}

type TextKind = "heading" | "paragraph" | "list-item";
type Block = { kind: TextKind; page: number; text: string };
type Unit = { number: string; title: string; page: number; blocks: Block[] };
const p = (page: number, text: string): Block => ({ kind: "paragraph", page, text });
const li = (page: number, text: string): Block => ({ kind: "list-item", page, text });
const h = (page: number, text: string): Block => ({ kind: "heading", page, text });

const units: Unit[] = [
    {
        number: "C7.11",
        title: "OPERE E SISTEMI GEOTECNICI",
        page: 244,
        blocks: [
            p(244, `La progettazione delle opere e dei sistemi geotecnici in presenza di azioni sismiche si esegue rispettando, in modo integrato, le prescrizioni contenute nel Capitolo 6 delle NTC relative alle azioni statiche e quelle specifiche fornite nel presente §7.11 per le azioni sismiche.`),
        ],
    },
    {
        number: "C7.11.1",
        title: "REQUISITI NEI CONFRONTI DEGLI STATI LIMITE",
        page: 244,
        blocks: [
            p(244, `Le verifiche agli stati limite ultimi in presenza di azioni sismiche (SLV) devono essere effettuate adottando valori unitari dei coefficienti parziali dei gruppi A ed M per il calcolo delle azioni e dei parametri geotecnici di progetto e i soli coefficienti parziali del gruppo R per il calcolo delle resistenze di progetto. A quest’ultimo fine, devono essere impiegati i valori dei coefficienti γ_R riportati nel presente Capitolo 7. Nel caso in cui non fossero espressamente indicati, si fa riferimento ai valori di γ_R indicati nel Capitolo 6.`),
        ],
    },
    {
        number: "C7.11.2",
        title: "CARATTERIZZAZIONE GEOTECNICA AI FINI SISMICI",
        page: 244,
        blocks: [
            p(244, `La caratterizzazione geotecnica dei terreni e delle rocce, così come la definizione dei modelli geotecnici di sottosuolo, costituiscono un insieme di attività riguardanti unitariamente la progettazione geotecnica, sia in condizioni statiche, sia in condizioni sismiche. Ne consegue che la caratterizzazione geotecnica ai fini sismici costituisce la necessaria integrazione di quella illustrata nel Capitolo 6 delle NTC per la progettazione in condizioni statiche ed è finalizzata a completare la definizione dei modelli geotecnici di sottosuolo secondo le necessità della progettazione sismica. Pertanto, anche in presenza di azioni sismiche, il progetto deve articolarsi nelle fasi prescritte nel § 6.2 delle NTC, comprendendo anche tutti gli elementi necessari per tenere`),
        ],
    },
    {
        number: "C7.11.3",
        title: "RISPOSTA SISMICA E STABILITÀ DEL SITO",
        page: 245,
        blocks: [],
    },
    {
        number: "C7.11.3.1",
        title: "RISPOSTA SISMICA LOCALE",
        page: 245,
        blocks: [
            p(245, `Nella definizione delle azioni sismiche cui è sottoposta una costruzione, sia in fondazione, sia in elevazione, il progettista deve svolgere un’analisi della risposta sismica locale, cioè una valutazione delle modificazioni del segnale sismico, rispetto a quanto atteso sulla base delle indicazioni riportate al paragrafo 3.2 in merito alla pericolosità sismica di base, dovute alla deformabilità e alla capacità dissipativa del terreno compreso nel volume significativo. A questo fine, sono disponibili diversi strumenti per studiare gli effetti della propagazione delle onde sismiche nel sottosuolo, basati in genere su metodi di analisi numerica, lineare e non, riferiti a problemi monodimensionali, bidimensionali o tridimensionali.`),
            p(245, `Mentre nelle analisi monodimensionali è possibile tenere conto soltanto degli effetti dell’amplificazione stratigrafica, nelle analisi condotte in condizioni bi-tridimensionali è possibile tenere conto, congiuntamente, sia dell’amplificazione stratigrafica, sia dell’amplificazione morfologica (superficiale e/o profonda) del sito.`),
            p(245, `Nel caso in cui il volume significativo di terreno sia caratterizzato da situazioni stratigrafiche tipiche e ben definite, cui corrispondano anche prefissati campi di variazione dei valori della velocità di propagazione delle onde di taglio, le norme offrono la possibilità di studiare la risposta sismica locale con un procedimento semplificato che permette di identificare uno spettro di risposta elastico in accelerazione ancorato all’accelerazione a_max=S_s·a_g, dove a_g è l’accelerazione massima su sito di riferimento rigido ed S_s è il coefficiente di amplificazione stratigrafica. Analogamente, per condizioni topografiche riconducibili alle categorie di cui alla Tab. 3.2.III delle NTC, la valutazione dell’amplificazione topografica può essere effettuata con metodi semplificati, utilizzando il coefficiente di amplificazione topografica S_T.`),
        ],
    },
    {
        number: "C7.11.3.1.1",
        title: "Indagini specifiche",
        page: 245,
        blocks: [
            p(245, `In aggiunta alle indagini in sito e alle prove di laboratorio necessarie per l’identificazione dei modelli geotecnici di sottosuolo in condizioni statiche, per la progettazione in presenza di azioni sismiche le indagini e le prove devono comprendere l’accertamento della profondità e della conformazione del substrato rigido o di una formazione ad esso assimilabile.`),
            p(245, `Per depositi molto profondi, la profondità di indagine si estende fino alla profondità in corrispondenza della quale vengono individuati strati di terreno molto rigidi, assimilabili al substrato ai fini delle analisi di risposta sismica locale.`),
            p(245, `Queste analisi richiedono, inoltre, un’adeguata conoscenza delle proprietà meccaniche dei terreni in condizioni cicliche, da determinare mediante specifiche indagini in sito e prove di laboratorio, programmate dal progettista in funzione del tipo di opera e/o di intervento, e della procedura di analisi che intende adottare. In particolare è auspicabile l’esecuzione di prove in sito per la determinazione dei profili di velocità di propagazione delle onde di taglio, ai fini della valutazione della rigidezza a bassi livelli di deformazione. Le prove di laboratorio sono invece raccomandate per la valutazione della dipendenza della rigidezza e dello smorzamento dal livello deformativo, e per la determinazione, in dipendenza del legame costitutivo adottato per i terreni, dei parametri di ingresso necessari alle analisi. A titolo di esempio e in maniera non esaustiva, le prove in sito possono includere le prove Cross-Hole, le prove Down-Hole, le prove SASW, le prove MASW, le prove eseguite con il dilatometro sismico (SDMT) e con il penetrometro sismico SCPT, ecc.; le prove di laboratorio possono invece consistere in prove cicliche di taglio torsionale o di taglio semplice, prove di colonna risonante, prove triassiali cicliche, ecc. Le apparecchiature di laboratorio, opportunamente strumentate, possono permettere anche la determinazione delle caratteristiche di rigidezza a bassi livelli di deformazione.`),
        ],
    },
    {
        number: "C7.11.3.1.2",
        title: "Analisi numeriche di risposta sismica locale",
        page: 245,
        blocks: [
            p(245, `Le analisi della risposta sismica locale sono effettuate utilizzando procedure di calcolo numerico in cui viene simulata la propagazione delle onde sismiche entro gli strati di terreno compresi tra il sottostante substrato rigido e il piano campagna (volume significativo ai fini della definizione della azione sismica). In generale, queste analisi richiedono le seguenti operazioni:`),
            li(245, `scelta della schematizzazione geometrica del problema;`),
            li(245, `definizione del modello geotecnico di sottosuolo;`),
            li(245, `definizione delle azioni sismiche al substrato rigido;`),
            li(245, `scelta della procedura di analisi.`),
        ],
    },
    {
        number: "C7.11.3.1.2.1",
        title: "Scelta della schematizzazione geometrica e definizione del modello geotecnico di sottosuolo",
        page: 245,
        blocks: [
            p(245, `La schematizzazione geometrica monodimensionale è la più semplice ai fini delle analisi; a prescindere dalla effettiva configurazione topografica del piano campagna, ci si riconduce allo schema di terreno omogeneo o stratificato orizzontalmente, delimitato da piano campagna orizzontale e poggiante su un substrato rigido, anch’esso orizzontale. Sono assimilabili ad un substrato rigido strati di terreno caratterizzati da valori di velocità delle onde di taglio maggiori di 800 m/s.`),
            p(245, `Qualora il piano di campagna o la giacitura degli strati e/o del substrato non siano facilmente riconducibili a tale schematizzazione a causa di assetti morfologici e stratigrafici complessi debbono essere valutate schematizzazioni che consentano una rappresentazione adeguata degli effetti della morfologia superficiale e dell’assetto stratigrafico del sito, attraverso una modellazione numerica più raffinata.`),
            p(246, `Nella definizione del modello geotecnico di sottosuolo è necessario specificare, per ciascuno degli strati individuati, i parametri di ingresso all’analisi.`),
        ],
    },
    {
        number: "C7.11.3.1.2.2",
        title: "Definizione delle azioni sismiche di ingresso",
        page: 246,
        blocks: [
            p(246, `Le azioni sismiche di ingresso sono costituite da storie temporali del moto del terreno rappresentative dello scuotimento sismico atteso su un sito di riferimento rigido ed affiorante con superficie topografica orizzontale (sottosuolo di categoria A e classe topografica T1 descritte nel § 3.2.2 delle NTC).`),
            p(246, `Come specificato nel § 3.2.3.6 delle NTC, nelle analisi di risposta sismica locale, così come nelle analisi dinamiche di opere e sistemi geotecnici, non è consentito usare accelerogrammi artificiali. Gli accelerogrammi artificiali spettro-compatibili sono infatti caratterizzati da una banda di frequenze irrealisticamente ampia poiché gli spettri di risposta di progetto, su cui essi sono calibrati, sono ottenuti da inviluppi di spettri di risposta di numerosi eventi reali. Conseguentemente, l’uso di accelerogrammi artificiali in un’analisi di risposta sismica locale può produrre un’amplificazione contemporanea, e perciò poco realistica, dei diversi modi di vibrazione del sistema, mentre un’azione sismica reale, caratterizzata da una larghezza di banda modesta, amplifica solo un limitato numero di modi, o al limite un unico modo. Inoltre, dal momento che la risposta dei terreni a una sollecitazione ciclica è non lineare, la rigidezza e la capacità di dissipare energia dipendono dall’ampiezza del livello deformativo. Perciò, durante il sisma, il terreno modifica la propria rigidezza e le caratteristiche di smorzamento, adattandole all’ampiezza delle vibrazioni che riceve. Se l’azione sismica è poco realistica, la rigidezza e lo smorzamento operativi prodotti dalla non-linearità del comportamento del terreno sono molto distanti dal vero e la conseguente risposta sismica risulta falsata.`),
            p(246, `Per le analisi di risposta sismica locale e per le analisi dinamiche di opere e sistemi geotecnici devono essere impiegati accelerogrammi registrati. È ammesso tuttavia l’uso di accelerogrammi sintetici, purché siano generati mediante simulazione del meccanismo di sorgente (§ 3.2.3.6 delle NTC). La scelta di accelerogrammi registrati può essere effettuata attingendo da archivi nazionali o internazionali accreditati, disponibili in rete, a condizione che la loro scelta sia rappresentativa della sismicità del sito e sia adeguatamente giustificata in base alle caratteristiche sismogenetiche della sorgente, alla magnitudo, alla distanza dalla sorgente e alla massima accelerazione orizzontale attesa al sito. Nella selezione degli accelerogrammi registrati occorre anche tenere conto del contesto geologico e delle caratteristiche geotecniche dei siti ove sono ubicate le stazioni accelerometriche di registrazione. Idealmente essi dovrebbero essere caratterizzati da substrato roccioso affiorante e superficie topografica orizzontale. Inoltre è opportuno utilizzare registrazioni in campo libero ed evitare la selezione di accelerogrammi registrati all’interno di edifici o altre tipologie di strutture. Ulteriori dettagli sui criteri di scelta degli accelerogrammi registrati sono riportati nel § 3.2.3.6 delle NTC. È inoltre raccomandabile effettuare analisi di risposta sismica locale utilizzando un numero adeguato di segnali (almeno 7 come richiamato in diversi punti delle NTC). Ciò è relativamente agevole, considerata l’ampia disponibilità di registrazioni accelerometriche di terremoti reali.`),
            p(246, `Benché le NTC prescrivano che il requisito della spettro-compatibilità debba essere soddisfatto rispetto allo spettro di risposta medio di un insieme di accelerogrammi, è opportuno evitare l’utilizzo di segnali individuali il cui spettro di risposta presenti uno scarto in eccesso rispetto allo spettro elastico di riferimento superiore al 30%, questo per evitare l’adozione di accelerogrammi rappresentativi di una domanda sismica troppo severa. Tali accelerogrammi potrebbero infatti determinare, sulla struttura o sul sistema geotecnico oggetto dell’analisi, effetti di non linearità eccessivamente pronunciati e incompatibili con l’effettiva pericolosità sismica del sito. Per motivi analoghi, è opportuno selezionare storie temporali che soddisfino l’ulteriore vincolo di compatibilità in media con l’accelerazione massima (a_g) prescritta per il sito in esame dallo studio di pericolosità sismica di base`),
        ],
    },
    {
        number: "C7.11.3.1.2.3",
        title: "Scelta della procedura di analisi",
        page: 246,
        blocks: [
            p(246, `Le analisi di risposta sismica locale possono essere effettuate a diversi livelli di raffinatezza, in relazione all’importanza dell’opera e/o dell’intervento, e alla complessità del problema in esame.`),
            p(246, `Nelle analisi semplificate, il terreno viene assimilato a un mezzo monofase visco-elastico non lineare, con caratteristiche di rigidezza e smorzamento dipendenti dal livello di deformazione. Le analisi sono generalmente eseguite in termini di tensioni totali, risolvendo la non linearità con un approccio lineare equivalente. Queste analisi possono essere condotte in condizioni monodimensionali o bidimensionali e forniscono i profili o le isolinee di accelerazione massima, deformazione e tensione di taglio, i valori operativi del modulo di taglio e del coefficiente di smorzamento, le storie temporali di accelerazione, deformazione e tensione di taglio e gli spettri di risposta e di Fourier in prefissati punti del dominio. L’analisi non permette la valutazione delle deformazioni permanenti indotte dal sisma nel terreno, in quanto essa è condotta facendo riferimento ad un modello elastico. Inoltre, essendo svolte in termini di tensioni totali, nel caso di terreni saturi, le analisi non permettono la valutazione della variazione delle pressioni interstiziali e delle tensioni efficaci. Le analisi semplificate risultano poco accurate nei casi in cui la non-linearità di comportamento dei terreni assume un ruolo importante (eventi sismici di elevata intensità e terreni teneri/sciolti, di modesta rigidezza). Per valori delle deformazioni di taglio maggiori di 1-2%, soprattutto in presenza di terreni molto deformabili, è quindi opportuno non utilizzare l’approccio lineare equivalente e riferirsi a leggi costitutive maggiormente rappresentative del comportamento meccanico del terreno.`),
            p(246, `Nelle procedure di analisi avanzate, il terreno viene assimilato a un mezzo polifase elasto-plastico il cui comportamento è descritto in termini di tensioni efficaci. Affinché le analisi siano affidabili, i modelli costitutivi adottati devono essere in grado di riprodurre adeguatamente il comportamento non lineare e isteretico dei terreni in condizioni cicliche, a partire da bassi livelli di`),
            p(247, `deformazione. In queste condizioni è possibile ottenere una descrizione più realistica del comportamento dei terreni, ottenendo, ad esempio, in aggiunta a quanto summenzionato, la valutazione di:`),
            li(247, `sovrappressioni interstiziali indotte dal sisma, particolarmente rilevanti nelle verifiche di stabilità nei confronti della liquefazione;`),
            li(247, `ridistribuzione e dissipazione delle sovrappressioni interstiziali nella fase successiva al sisma;`),
            li(247, `stato di deformazione permanente indotta dal sisma e diffusione delle zone plasticizzate;`),
            li(247, `stato di tensione efficace e grado di mobilitazione della resistenza al taglio.`),
            p(247, `L’uso di queste procedure di analisi richiede in genere un numero elevato di parametri di ingresso all’analisi, in dipendenza dei modelli costitutivi adottati per i terreni, e implica perciò una campagna di indagine specifica, da definire caso per caso.`),
        ],
    },
    {
        number: "C7.11.3.4",
        title: "STABILITÀ NEI CONFRONTI DELLA LIQUEFAZIONE",
        page: 247,
        blocks: [
            p(247, `La sicurezza nei confronti della liquefazione può essere valutata con procedure di analisi avanzate o con metodologie di carattere semi-empirico.`),
            p(247, `Le NTC, innanzitutto, fissano i casi in cui è possibile omettere la verifica a liquefazione. E’ sufficiente che si verifichi almeno una delle quattro condizioni indicate nel §7.11.3.4.2 affinché si possa omettere l’esecuzione di tale verifica.`),
            p(247, `Se la condizione relativa alla severità della azione sismica non è soddisfatta (e cioè se le accelerazioni massime attese al piano campagna in campo libero sono superiori a 0,1g), le NTC prescrivono degli approfondimenti delle indagini geotecniche finalizzati a verificare il manifestarsi o meno delle altre tre condizioni.`),
            p(247, `Nei metodi di analisi avanzata si deve tenere conto della natura polifase dei terreni, considerando l’accoppiamento tra fase solida e fase fluida, e si deve descrivere adeguatamente il comportamento meccanico delle terre in condizioni cicliche.`),
            p(247, `Le metodologie di carattere semi-empirico permettono sia verifiche di tipo puntuale, sia verifiche di tipo globale.`),
            p(247, `Nelle analisi puntuali, la sicurezza alla liquefazione è valutata localmente, a diverse profondità, calcolando il rapporto tra la resistenza ciclica alla liquefazione, CRR = τ_f/σ’_v0 e la sollecitazione ciclica indotta dall’azione sismica, CSR = τ_media/σ’_v0, in cui con σ’_v0 si intende la tensione efficace verticale agente alla profondità considerata prima dell’evento sismico. La sollecitazione ciclica è correlata alla massima tensione tangenziale indotta dall’azione sismica alla profondità considerata, τ_max che può essere determinata direttamente, da analisi di risposta sismica locale, o indirettamente, da relazioni empiriche, in funzione dei caratteri del moto sismico atteso al sito. La resistenza ciclica alla liquefazione, CRR, può essere valutata da prove cicliche di laboratorio o da correlazioni empiriche basate su risultati di prove e misure in sito. La verifica è effettuata utilizzando abachi di letteratura che riportano, in ordinata, la sollecitazione ciclica CSR e in ascissa una proprietà del terreno stimata dalle prove in sito (ad esempio da prove penetrometriche che statiche o dinamiche o da misure in sito della velocità di propagazione delle onde di taglio Vs). Negli abachi, una curva separa gli stati per i quali nel passato si è osservata la liquefazione da quelli per i quali la liquefazione non è avvenuta.`),
            p(247, `Nelle verifiche globali, si valutano preliminarmente i profili della sollecitazione e della resistenza ciclica, CSR e CRR, e si valuta, per l’intervallo di profondità in esame, il potenziale di liquefazione, I_L, funzione dell’area racchiusa tra i due profili. La suscettibilità nei confronti della liquefazione, valutata in base ai valori assunti dal potenziale di liquefazione, è così riferita ad uno spessore finito di terreno piuttosto che al singolo punto.`),
            p(247, `Tali procedure sono valide per piano di campagna sub-orizzontale. In caso contrario, la verifica deve essere eseguita con studi specifici.`),
            p(247, `Se le verifiche semplificate sono effettuate contemporaneamente con più metodi, si deve adottare quella più cautelativa, a meno di non giustificare adeguatamente una scelta diversa.`),
            p(247, `La sicurezza nei confronti della liquefazione deve essere effettuata utilizzando i valori caratteristici delle proprietà meccaniche dei terreni. L’adeguatezza del margine di sicurezza nei confronti della liquefazione deve essere valutata e motivata dal progettista.`),
        ],
    },
    {
        number: "C7.11.3.5",
        title: "STABILITÀ DEI PENDII",
        page: 247,
        blocks: [
            p(247, `Il comportamento dei pendii durante un evento sismico, e per un periodo successivo all’evento stesso, è strettamente legato alla natura del terreno e alle condizioni esistenti prima del terremoto. Un’analisi completa della stabilità in condizioni sismiche deve perciò sempre comprendere lo studio del comportamento del pendio prima, durante e dopo il terremoto.`),
            p(247, `I metodi per l’analisi di stabilità dei pendii in presenza di sisma possono essere suddivisi in tre categorie principali, in ordine di complessità crescente:`),
            li(247, `metodi pseudostatici`),
            li(247, `metodi degli spostamenti (analisi dinamica semplificata)`),
            li(247, `metodi di analisi dinamica avanzata`),
            p(248, `Per i pendii naturali le verifiche di sicurezza devono essere effettuate utilizzando i valori caratteristici dei parametri di resistenza dei terreni e delle azioni. In altre parole, tutti i coefficienti parziali sono assunti unitari.`),
            p(248, `Nei metodi pseudostatici la condizione di stato limite ultimo viene riferita al cinematismo di collasso critico, caratterizzato dal più basso valore del coefficiente di sicurezza, FS, definito come rapporto tra resistenza al taglio disponibile e sforzo di taglio mobilitato lungo la superficie di scorrimento (effettiva o potenziale) (F_s=τ_s/τ_m).`),
            p(248, `Nei pendii interessati da frane attive o quiescenti, che possono essere riattivate in occasione del sisma, le analisi in termini di tensioni efficaci risultano più appropriate rispetto a quelle in tensioni totali. In tal caso, particolare riguardo deve essere posto nella scelta delle caratteristiche di resistenza dei materiali, facendo riferimento alla resistenza al taglio a grandi deformazioni, in dipendenza dell’entità dei movimenti e della natura dei terreni.`),
            p(248, `In terreni saturi e per valori di a_max>0.15g, nell’analisi statica delle condizioni successive al sisma, si deve considerare la riduzione della resistenza al taglio indotta da condizioni di carico ciclico a causa dell’incremento delle pressioni interstiziali e della degradazione dei parametri di resistenza. In assenza di specifiche prove di laboratorio eseguite in condizioni cicliche, l’incremento delle pressioni interstiziali, Δu, per le analisi in tensioni efficaci, e il coefficiente di riduzione della resistenza non drenata, C_αu, per le analisi in tensioni totali, possono essere stimati facendo ricorso all’uso di relazioni empiriche.`),
            p(248, `Nelle analisi condotte con i metodi pseudostatici, il campo di accelerazione all’interno del pendio è assunto uniforme e le componenti orizzontale e verticale delle forze di inerzia sono applicate nel baricentro della massa potenzialmente in frana, nei metodi globali, o nei baricentri delle singole strisce, nei metodi delle strisce. Per tener conto dei fenomeni di amplificazione del moto sismico all’interno del pendio, il valore dell’accelerazione orizzontale massima su sito di riferimento rigido, a_g, può essere moltiplicato per un coefficiente S che comprende l’effetto dell’amplificazione stratigrafica, S_s, e dell’amplificazione topografica S_T. In alternativa, la variabilità spaziale dell’azione sismica può essere introdotta valutando un coefficiente sismico orizzontale equivalente, k_h,eq, mediante un’analisi della risposta sismica locale.`),
            p(248, `Nelle verifiche pseudostatiche allo SLV dei pendii si utilizzano i coefficienti β_s dell’accelerazione massima attesa al sito riportati in Tabella 7.11.I delle NTC. Tali coefficienti derivano da valutazioni sulla duttilità del meccanismo di rottura per scorrimento dei pendii di terra. Nel caso dei pendii di roccia, soprattutto per i meccanismi di rottura per crollo e per ribaltamento, decisamente più fragili di quello per scorrimento, si dovrebbero utilizzare valori di β_s più elevati, al limite unitari.`),
            p(248, `La norma non fissa esplicitamente i valori di β_s per le verifiche allo SLD. Per queste verifiche il coefficiente β_s potrebbe essere unitario, nel caso in cui non si accettassero spostamenti residui, o compreso tra 1 e quello fissato per le verifiche allo SLV, in funzione dello spostamento massimo ritenuto accettabile per lo stato limite SLD in cinematismi di rottura per scorrimento. Per la valutazione di β_s per questo stato limite si può fare riferimento alla Fig. 7.11.3 delle NTC. Per la definizione dello spostamento ammissibile si può fare riferimento alle indicazioni riportate di seguito, nell’illustrazione del metodo degli spostamenti.`),
            p(248, `I metodi degli spostamenti consentono di valutare gli effetti della storia delle accelerazioni. In essi l’azione sismica è definita da una funzione temporale (ad es., un accelerogramma), e la risposta del pendio all’azione sismica è valutata in termini di spostamenti accumulati, eseguendo la doppia integrazione nel tempo dell’equazione del moto relativo tra massa potenzialmente instabile e terreno stabile.`),
            p(248, `Gli spostamenti indotti dal sisma possono essere confrontati sia con valori di soglia dello spostamento corrispondenti ad una condizione di Stato Limite di salvaguardia della Vita (SLV), sia con valori di soglia dello spostamento corrispondenti ad una perdita di funzionalità (SLD).`),
            p(248, `Tenuto conto che i metodi degli spostamenti fanno riferimento a cinematismi di collasso idealizzati e semplificati, gli spostamenti calcolati devono considerarsi come una stima dell’ordine di grandezza degli spostamenti reali, e quindi come un indice di prestazione del pendio in condizioni sismiche.`),
            p(248, `Lo spostamento ammissibile dipende da molteplici fattori tra i quali la presenza e la natura di strutture/infrastrutture esistenti, il livello di protezione che si intende adottare, la gravità dei danni connessi ad un eventuale movimento franoso. In generale, maggiori valori dello spostamento ammissibile possono essere adottati per terreni e manufatti a comportamento duttile, o il cui comportamento sia analizzato utilizzando parametri di resistenza a grandi deformazioni.`),
            p(248, `La sensibilità del metodo degli spostamenti alle caratteristiche dell’accelerogramma (a_max forma, durata e contenuto in frequenza) è ben nota e pertanto l’accelerogramma di riferimento dovrebbe essere scelto accuratamente dopo un’analisi dettagliata della pericolosità sismica e un’analisi statistica dei dati strumentali a scala regionale. È opportuno in ogni caso confrontare gli effetti di più accelerogrammi (almeno 7) selezionati secondo i criteri descritti nel § 3.2.3.6.`),
            p(248, `In aggiunta ai metodi pseudostatici e ai metodi degli spostamenti, la valutazione del comportamento dei pendii in presenza di sisma può essere valutata anche con metodi di analisi dinamica avanzata. In essi le equazioni dinamiche del moto vengono risolte mediante tecniche di integrazione numerica implementate in codici di calcolo.`),
            p(248, `Le analisi dinamiche avanzate dovrebbero intendersi come un affinamento delle analisi delle condizioni di stabilità di un pendio, non potendo, allo stato attuale delle conoscenze, considerarsi sostitutive dei metodi pseudostatici e dei metodi degli spostamenti. Anche nel caso in cui si conducano analisi dinamiche avanzate è opportuno che si faccia riferimento a più accelerogrammi (almeno 7) scelti secondo i criteri di cui al § 3.2.3.6.`),
        ],
    },
    {
        number: "C7.11.4",
        title: "FRONTI DI SCAVO E RILEVATI",
        page: 249,
        blocks: [
            p(249, `Per le verifiche di sicurezza dei fronti di scavo e dei rilevati si possono utilizzare gli stessi metodi descritti al § 7.11.3.5 e § C7.11.3.5 per i pendii naturali: metodi pseudostatici, metodi degli spostamenti e metodi avanzati di analisi dinamica.`),
            p(249, `Come specificato in generale al § 7.11.1 delle NTC, le verifiche pseudostatiche di sicurezza dei fronti di scavo e dei rilevati si eseguono adottando valori unitari dei coefficienti parziali dei gruppi A ed M per il calcolo delle azioni e dei parametri geotecnici di progetto e un coefficiente parziale γ_R pari a 1.20.`),
            p(249, `Nelle verifiche con metodi pseudostatici effettuate con riferimento a cinematismi di rottura per scorrimento nei terreni, si utilizzano i coefficienti β_s di riduzione della massima accelerazione attesa al sito riportati nel §7.11.4 delle NTC. Valori più elevati di tali coefficienti (al massimo unitari), per le verifiche allo SLD, possono essere utilizzati in presenza di elementi particolarmente sensibili agli spostamenti in prossimità del fronte di scavo o del rilevato. Inoltre, valori più elevati di β_s si devono utilizzare nel caso di fronti di scavo in ammassi rocciosi, soprattutto nel caso di meccanismi di rottura fragili (ad es., ribaltamento).`),
            p(249, `Si applicano ai fronti di scavo e ai rilevati le considerazioni già esposte per i pendii naturali, relative alla scelta dei parametri di resistenza, alla necessità di valutare la riduzione della resistenza al taglio indotta dall’azione sismica, e di tenere conto degli effetti dei fenomeni di risposta sismica locale.`),
            p(249, `Anche quando la verifica viene eseguita con il metodo degli spostamenti, l’accelerazione critica deve essere valutata utilizzando i valori caratteristici dei parametri di resistenza. Le condizioni del fronte di scavo possono in questo caso essere riferite ad una condizione di stato limite di salvaguardia della Vita (SLV) o di danno (SLD), in dipendenza del valore di soglia fissato per lo spostamento ammissibile (si veda § 7.11.3.5). Anche nel caso dei fronti di scavo o dei rilevati è opportuno che si faccia riferimento a più accelerogrammi (almeno 7) scelti secondo i criteri di cui al §3.2.3.6.`),
        ],
    },
    {
        number: "C7.11.5",
        title: "FONDAZIONI",
        page: 249,
        blocks: [],
    },
    {
        number: "C7.11.5.1",
        title: "REGOLE GENERALI DI PROGETTAZIONE",
        page: 249,
        blocks: [],
    },
    {
        number: "C7.11.5.1.1",
        title: "Modellazione dell’interazione terreno-fondazione-struttura",
        page: 249,
        blocks: [
            p(249, `Le azioni trasmesse dalla struttura in elevazione alla fondazione rappresentano la soluzione del problema dell’interazione terreno-fondazione-struttura, che può essere studiato con diversi livelli di complessità, in relazione all’importanza dell’opera e alla pericolosità sismica del sito.`),
            p(249, `Al fine delle verifiche di sicurezza del complesso fondazione-terreno e per il dimensionamento strutturale delle fondazioni, il valore delle azioni trasmesse alle fondazioni deve essere scelto secondo quanto prescritto al § 7.2.5, tenendo conto dei criteri di modellazione della struttura e dell’azione sismica di cui al § 7.2.6.`),
            p(249, `Nei metodi di analisi avanzata, il modello numerico include la struttura in elevazione, la fondazione e il sottosuolo; si considera l’interazione dinamica terreno-fondazione considerando la natura polifase dei terreni, tenendo conto del comportamento non lineare e isteretico degli elementi strutturali e dei terreni in condizioni cicliche, a partire da bassi livelli di deformazione. Tale approccio presuppone di per sé lo svolgimento di analisi dinamiche in campo non lineare.`),
            p(249, `Nei metodi di complessità intermedia (ad esempio, metodo delle sottostrutture), l’analisi viene eseguita in due fasi. Nella prima viene definita l’azione sismica alla base della struttura, mediante un’analisi non lineare o lineare equivalente di risposta sismica locale nella condizione di campo libero. Si può tenere conto della modifica del moto sismico dovuta all’interazione cinematica fondazione-terreno. Nella seconda fase si applica il moto sismico così ottenuto alla struttura la cui fondazione è generalmente modellata con vincoli visco-elastici caratterizzati da opportune funzioni di impedenza dinamica. Nel calcolo dell’impedenza dinamica è necessario tenere conto della dipendenza della rigidezza e dello smorzamento dei terreni dal livello deformativo e dalla frequenza di eccitazione.`),
            p(249, `Anche in questo caso l’azione sismica può essere valutata con analisi di risposta sismica-locale lineare o lineare equivalente.`),
            p(249, `Qualora le verifiche nella struttura in elevazione siano condotte utilizzando le sollecitazioni derivanti da analisi effettuate con spettri di progetto applicati su strutture schematizzate come elastiche, e non da analisi non lineari, le azioni di progetto da considerare applicate sulle strutture di fondazione nelle verifiche agli stati limite ultimi (SLV e, eventualmente, SLC) delle fondazioni devono tenere conto di quanto previsto al § 7.2.5 delle NTC.`),
            p(249, `L’analisi sismica delle fondazioni con il metodo degli spostamenti o con metodi dinamici avanzati si esegue utilizzando i valori caratteristici delle azioni statiche e dei parametri di resistenza. In questo caso, il risultato dell’analisi è uno spostamento permanente (cedimento, traslazione orizzontale e/o rotazione). La verifica consiste nel confronto tra lo spostamento calcolato e quello limite scelto dal progettista per l’opera in esame, in funzione dello stato limite considerato.`),
        ],
    },
    {
        number: "C7.11.5.3",
        title: "VERIFICHE ALLO STATO LIMITE ULTIMO (SLV) E ALLO STATO LIMITE DI ESERCIZIO (SLD)",
        page: 250,
        blocks: [],
    },
    {
        number: "C7.11.5.3.1",
        title: "Fondazioni superficiali",
        page: 250,
        blocks: [
            p(250, `L’analisi pseudo-statica delle fondazioni si esegue utilizzando valori unitari per i coefficienti parziali sulle azioni e sui parametri geotecnici come specificato al § 7.11.1. Si utilizzano invece i coefficienti γ_R riportati nella Tabella 7.11.II per i diversi meccanismi considerati.`),
            p(250, `L’azione del sisma si traduce in accelerazioni nella parte di sottosuolo che interagisce con l’opera e in variazioni delle sollecitazioni normali, di taglio e dei momenti flettenti sulla fondazione, per l’azione delle forze d’inerzia generate nella struttura in elevazione (effetto inerziale). Nella valutazione delle azioni di progetto agenti sulle fondazioni, nelle verifiche SLV, si deve tenere conto anche di quanto previsto al §7.2.5.`),
            p(250, `Le verifiche a scorrimento e a ribaltamento si eseguono utilizzando gli usuali metodi già previsti per le verifiche sotto azioni statiche.`),
            p(250, `Nelle verifiche a carico limite, le NTC consentono di trascurare le azioni inerziali agenti nel volume di terreno sottostante la fondazione. In tal caso l’effetto dell’azione sismica si traduce nella sola variazione delle azioni di progetto in fondazione rispetto a quelle valutate nelle combinazioni statiche. La verifica viene condotta con le usuali formule del carico limite tenendo conto dell’eccentricità e dell’inclinazione, rispetto alla verticale, del carico agente sul piano di posa. In tal caso si adotta un coefficiente γ_R a carico limite pari a 2.3.`),
            p(250, `Nel caso in cui si considerino esplicitamente le azioni inerziali nel volume di terreno al di sotto della fondazione, le NTC consentono di utilizzare un coefficiente γ_R a carico limite più basso e pari a 1.8. In tal caso, le accelerazioni nel volume di sottosuolo interessato dai cinematismi di rottura modificano i coefficienti di capacità portante in funzione del coefficiente sismico pseudo-statico k_hE che simula l’azione sismica in tale volume di terreno. La scelta del valore di k_hE è nella responsabilità del progettista e dovrebbe tenere conto del livello di spostamenti permanenti che si ritiene di accettare in occasione dell’evento sismico, considerando anche che le azioni inerziali sulla struttura in elevazione e quelle sul volume di terreno sottostante la fondazione potrebbero non essere sincrone.`),
            p(250, `L’analisi sismica delle fondazioni (sia SLV sia SLD) con il metodo degli spostamenti si esegue utilizzando i valori caratteristici delle azioni statiche e delle resistenze. In questo caso, il risultato dell’analisi è uno spostamento permanente, che si genera quando l’accelerazione massima al sito è superiore o uguale all’accelerazione critica del sistema. La verifica consiste nel confrontare lo spostamento calcolato con uno spostamento limite scelto dal progettista per l’opera in esame. Nel caso in cui si applichi il metodo degli spostamenti si deve fare riferimento ad almeno 7 accelerogrammi scelti in accordo con quanto riportato al §3.2.3.6 delle NTC.`),
            p(250, `In considerazione del fatto che non è consolidato in ambito tecnico l’uso di procedimenti per la valutazione degli spostamenti permanenti delle fondazioni superficiali prodotti da azioni sismiche, le NTC richiedono, anche per le verifiche SLD, che il progettista, in alternativa al calcolo degli spostamenti, effettui le stesse verifiche in fondazione con gli stessi valori dei coefficienti di sicurezza riportati in Tab. 7.11.II. Tali verifiche potrebbero essere anche più gravose di quelle allo SLV, in quanto in alcuni casi lo spettro elastico SLD può superare quello SLV e dare luogo a sollecitazioni di taglio e flettenti in fondazione maggiori di quelle allo SLV.`),
        ],
    },
    {
        number: "C7.11.5.3.2",
        title: "Fondazioni su pali",
        page: 250,
        blocks: [
            p(250, `L’analisi pseudo-statica delle fondazioni su pali si esegue utilizzando valori unitari per i coefficienti parziali sulle azioni e sui parametri geotecnici, come specificato al § 7.11.1 delle NTC. Si utilizzano invece i coefficienti γ_R riportati nella Tabella 6.4.II e 6.4.VI, rispettivamente, per i carichi assiali e trasversali.`),
            h(250, `Gruppi di pali`),
            p(250, `La resistenza per carico limite verticale del complesso pali-terreno deve essere valutata tenendo conto dell’eccentricità del carico verticale e degli effetti di gruppo. Ci si deve riferire alla rottura per carico limite verticale ed eccentrico della palificata nel suo complesso. Anche nella verifica a carico limite orizzontale ci si deve riferire alla rottura della palificata nel suo complesso, tenendo conto degli effetti di gruppo.`),
            p(250, `Nelle verifiche agli stati limite ultimi nei confronti della rottura strutturale dei pali, con le limitazioni alle condizioni previste dalle NTC circa le caratteristiche del sottosuolo in cui sono ammor­sati i pali, si deve tenere conto anche degli effetti flessionali prodotti dall’interazione cinematica palo-terreno, tenendo conto dei livelli di deformazione nel sottosuolo prodotti dal passaggio delle onde sismiche.`),
            h(250, `Fondazioni miste`),
            p(250, `Se la capacità portante della fondazione diretta è sufficiente, ai pali può essere affidata la sola funzione di controllo e regolazione del cedimento. In tale circostanza, per fare in modo che i pali possano svolgere correttamente tale funzione, occorre evitare la rottura di uno degli elementi strutturali (pali e struttura di collegamento).`),
            p(250, `Se la capacità portante della fondazione diretta è invece insufficiente, è possibile tenere conto del contributo dei pali nell’analisi dei seguenti stati limite ultimi:`),
            li(250, `collasso della fondazione mista nei riguardi dei carichi assiali;`),
            li(251, `collasso per carico limite della fondazione mista nei riguardi dei carichi trasversali.`),
            p(251, `Per la resistenza della fondazione mista nei confronti del collasso per carico limite orizzontale, occorre in primo luogo eseguire un’analisi di interazione pali-struttura di collegamento-terreno, al fine di pervenire alle aliquote di ripartizione fra platea e pali sia dei carichi assiali sia dei carichi trasversali. A questo punto la verifica viene effettuata per le due componenti della fondazione mista, secondo le prescrizioni di cui ai §§ 7.11.5.3.1 e 7.11.5.3.2. Se invece l’interazione fra la struttura di collegamento e i pali viene giudicata non significativa, o si omette la relativa analisi, il carico orizzontale deve essere affidato integralmente ai pali, e le verifiche della palificata nei confronti dei carichi trasversali vanno effettuate con le prescrizioni di cui al § 7.11.5.3.2.`),
            p(251, `L’integrità strutturale della fondazione mista (e dunque dei suoi componenti) deve essere preservata sia se l’aggiunta dei pali serve ad evitare una rottura per carico limite sia se l’aggiunta dei pali serve a ridurre il cedimento delle fondazioni. In ambedue le circostanze, l’azione orizzontale di progetto da applicare alla palificata può essere individuata con lo stesso criterio considerato per la verifica della fondazione mista nei confronti del collasso per carico limite orizzontale.`),
            p(251, `In considerazione del fatto che non è consolidato in ambito tecnico l’uso di procedimenti per la valutazione degli spostamenti permanenti delle fondazioni su pali prodotti da azioni sismiche, le NTC richiedono, per le verifiche SLD, che il progettista, in alternativa al calcolo degli spostamenti, effettui le stesse verifiche in fondazione con gli stessi valori dei coefficienti di sicurezza riportati in Tab.6.4.II e 6.4.VI rispettivamente per carichi assiali e trasversali. Tali verifiche potrebbero essere anche più gravose di quelle allo SLV, in quanto in alcuni casi lo spettro elastico SLD può superare quello SLV e dare luogo a sollecitazioni di taglio e flettenti in fondazione maggiori di quelle allo SLV.`),
        ],
    },
    {
        number: "C7.11.6",
        title: "OPERE DI SOSTEGNO",
        page: 251,
        blocks: [],
    },
    {
        number: "C7.11.6.2",
        title: "MURI DI SOSTEGNO",
        page: 251,
        blocks: [
            p(251, `L’analisi dei muri di sostegno in presenza dell’azione sismica si esegue utilizzando sempre valori unitari dei coefficienti parziali sulle azioni e sui parametri geotecnici come prescritto al § 7.11.1. Per le sole verifiche SLV, si utilizzano i coefficienti γ_R riportati nella Tab. 7.11.III.`),
            p(251, `Nel caso in cui la verifica si conduca con approccio pseudo-statico, l’azione sismica è rappresentata da una forza statica equivalente funzione dell’accelerazione massima attesa al sito e di un fattore di riduzione dell’accelerazione massima, β_m, che assume i valori specificati al § 7.11.6.2.1, differenziati per verifiche SLV e SLD. L’impiego di un fattore β_m<1 implica che il muro di sostegno in occasione del sisma possa subire spostamenti permanenti lungo la sua base e che questi spostamenti siano quindi liberi di verificarsi e compatibili con la sicurezza delle strutture che interagiscono con l’opera stessa. Nel caso in cui ciò non fosse possibile, si devono assumere valori di β_m più elevati, derivanti dal diagramma di Fig. 7.11.3 delle NTC, fino ad assumere un valore β_m unitario per i muri nei quali la traslazione è impedita. Per garantire la sicurezza nei confronti del ribaltamento (meccanismo fragile), la norma impone che la verifica nei confronti di tale meccanismo sia effettuata facendo riferimento ad un valore di β_m incrementato del 50% rispetto a quello utilizzato nelle verifiche a scorrimento. Ovviamente, il coefficiente β_m utilizzato nelle verifiche a ribaltamento ha un limite superiore pari a 1.00.`),
            p(251, `Nel rispetto della gerarchia delle resistenze, sarebbe opportuno che le verifiche geotecniche, diverse da quella a scorrimento, e quelle strutturali siano condotte con riferimento alla minore tra l’accelerazione orizzontale massima attesa al sito e l’accelerazione sismica pseudo-statica critica, che produce lo scorrimento in fondazione. L’analisi sismica dei muri di sostegno con il metodo degli spostamenti si esegue utilizzando i valori caratteristici delle azioni statiche e delle resistenze. In questo caso, il risultato dell’analisi è uno spostamento permanente, eventualmente anche nullo. La verifica consiste nel confrontare lo spostamento calcolato con uno spostamento limite scelto dal progettista per l’opera in esame. Nel caso in cui si applichi il metodo degli spostamenti si deve fare riferimento ad almeno 7 accelerogrammi scelti in accordo con quanto riportato al §3.2.3.6. delle NTC. La verifica allo scorrimento con il metodo degli spostamenti sostituisce la sola verifica allo scorrimento pseudo-statica. Vanno ovviamente condotte comunque le altre verifiche geotecniche e strutturali, tenendo conto delle indicazioni riportate in precedenza.`),
            p(251, `Il progetto dei muri di sostegno sotto azioni sismiche deve essere improntato per favorire lo sviluppo di meccanismi di rottura duttili (scorrimento) rispetto ad altri meccanismi considerati più fragili, primo tra tutti il ribaltamento.`),
        ],
    },
    {
        number: "C7.11.6.3",
        title: "PARATIE",
        page: 251,
        blocks: [
            p(251, `L’analisi sismica delle paratie si esegue verificando la sicurezza dell’opera, nei confronti di stati limite di tipo strutturale o geotecnico, in presenza di azioni sismiche. Come prescritto al §7.11.1, le verifiche si eseguono con coefficienti parziali unitari sulle azioni e sui parametri geotecnici e considerando le variazioni della spinta delle terre a monte e a valle della paratia per effetto dell’accelerazione sismica.`),
            p(251, `L’accelerazione sismica fa variare infatti la spinta delle terre e determina una maggiore mobilitazione delle resistenze del terreno con accumulo di spostamenti permanenti. Tali spostamenti consentono una dissipazione di energia progressivamente crescente all’aumentare del volume di terreno coinvolto nel processo di deformazione; la dissipazione diviene massima con l’innesco di un meccanismo di rottura generale nel terreno. Il valore dell’accelerazione sismica in grado di innescare il primo cinematismo è detta accelerazione critica del sistema.`),
            p(252, `Per tener conto degli effetti dissipativi, nei metodi pseudo-statici si considera il valore dell’accelerazione orizzontale equivalente a_h, valutato secondo la Formula 7.11.9 in funzione del coefficiente di spostamento β che tiene conto della capacità del sistema (terreno, struttura e vincoli) di dissipare energia durante il moto sismico.`),
            p(252, `Il coefficiente β è minore di 1 solo se l’accelerazione massima attesa al sito risulta maggiore dell’accelerazione critica del sistema. Con β<1, a seguito del sisma, la paratia subirà quindi spostamenti di tipo permanente.`),
            p(252, `L’entità degli spostamenti permanenti può essere valutata in modo semplificato attraverso il diagramma di Figura 7.11.3 che assimila gli effetti permanenti prodotti dal sisma a quelli calcolati sul blocco rigido di Newmark con riferimento a numerosi accelerogrammi italiani. A tal fine, il valore di β può essere assunto pari al rapporto fra accelerazione critica del sistema e accelerazione massima attesa.`),
            p(252, `Qualora l’accelerazione massima non fosse sufficiente a produrre un meccanismo di rottura generale nel terreno, allora deve essere β = 1. Conseguentemente, l’accelerazione equivalente coincide con quella massima, a meno del fattore α di deformabilità, che va considerato solo come riduttore della spinta attiva.`),
            p(252, `La verifica delle paratie può essere condotta anche con metodi dinamici avanzati, tenendo conto del comportamento non lineare, non elastico e isteretico dei terreni interessati dall’opera. L’uso di tali modelli richiede necessariamente un’adeguata campagna di indagini in sito e in laboratorio che consenta la caratterizzazione del comportamento meccanico dei terreni in un ampio campo di deformazioni, oltre a strumenti di calcolo adeguati. Inoltre, poiché, sia per le verifiche SLV sia per quelle SLD, la verifica consiste nella valutazione degli effetti del sisma in termini di spostamenti e di variazioni del regime di sollecitazione dell’opera, la verifica va condotta confrontando gli effetti di più accelerogrammi (almeno 7) selezionati secondo i criteri descritti nel § 3.2.3.6.`),
        ],
    },
];

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
    const ancestorIds = lower.split(".").slice(1).map((_, index) => unitId(lower.split(".").slice(0, index + 1).join(".")));
    const hasNtcTarget = knownNtcNumbers.has(unit.number.slice(1));
    const specs = [{ kind: "heading" as const, page: unit.page, text: `${unit.number} ${unit.title}` }, ...unit.blocks];
    const blocks = specs.map((block, index) => {
        const blockId = index === 0 ? "block-heading" : `block-editorial-${String(index).padStart(3, "0")}`;
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
    const relation = hasNtcTarget ? [{
        relationId: `${id}#relation-001`, type: "clarifies",
        targetUnitId: `urn:structural-codes:it:unit:ntc2018:${unit.number.slice(1)}`,
        basis: "editorial", evidenceBlockIds: [`${id}#block-heading`],
        rationale: "Corrispondenza proposta tra numerazione omologa della Circolare e delle NTC; richiede conferma umana sul contenuto completo.",
        review: { status: "proposed", reviewedBy: null, reviewedAt: null },
    }] : [];
    const sourceIssue = {
        issueId: `circ2019-${lower.replaceAll(".", "-")}-source-review`,
        type: "normalization-review", severity: "blocking",
        note: "Trascrizione manuale confrontata con il render ufficiale; resta obbligatoria la revisione umana indipendente.",
    };
    const missingLayerIssue = {
        issueId: `circ2019-${lower.replaceAll(".", "-")}-missing-text-layer`,
        type: "missing-region", severity: "blocking",
        note: "Il layer testuale ufficiale delle pagine contiene solo intestazione e numero pagina; il testo è stato trascritto manualmente dal render PDF.",
    };
    const issues = [sourceIssue, missingLayerIssue, ...(unit.number === "C7.11.2" ? [{
        issueId: "circ2019-c7-11-2-truncated-source-paragraph", type: "normalization-review", severity: "blocking",
        note: "Il capoverso della fonte termina visibilmente con «per tenere» prima del cambio di pagina; non è stato completato per plausibilità.",
    }] : []), ...(hasNtcTarget ? [{
        issueId: `circ2019-${lower.replaceAll(".", "-")}-relation`, type: "relation-review", severity: "blocking",
        note: "Il collegamento Circolare-NTC per numerazione omologa richiede conferma umana.",
    }] : [])];
    const record = {
        $schema: "urn:structural-codes:schema:canonical-unit:v2", schemaVersion: "2.0.0-alpha.2", recordType: "canonical-unit",
        id, workId: "it-mit:circ:2019-01-21:7-csllpp", expressionId: "it-mit:circ:2019-01-21:7-csllpp:original-it",
        kind: numberParts.length === 2 ? "section" : numberParts.length === 3 ? "paragraph" : "subparagraph",
        numbering: { official: unit.number, sortKey: numberParts.map((part) => String(part).padStart(3, "0")).join(".") },
        title: unit.title, titleBlockId: `${id}#block-heading`,
        hierarchy: { parentId: unitId(parentParts.join(".")), ancestorIds, position: numberParts.at(-1) },
        validity: { from: null, to: null, status: "unknown", asOf }, blocks, citations: [], relations: relation,
        assets: { formulaIds: [], tableIds: [], figureIds: [] },
        workflow: { status: "extracted", createdBy: { actorId: "generator:circ711-step1", kind: "script", toolVersion: profile }, createdAt: "2026-08-09T12:00:00Z", reviews: [], openIssues: issues },
    };
    await writeFile(join(outputDirectory, `${lower}.json`), `${JSON.stringify(record, null, 2)}\n`, "utf8");
}
console.log(`circ711-step1: generated ${units.length} units`);
