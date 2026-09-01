/* eslint-disable @typescript-eslint/no-explicit-any */
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const unitDirectory = join(root, "corpus", "units", "circ2019");
const assetDirectory = join(root, "corpus", "assets", "circ2019");
const sourceId = "circ-7-2019";
const workId = "it-mit:circ:2019-01-21:7-csllpp";
const expressionId = "it-mit:circ:2019-01-21:7-csllpp:original-it";
const profile = "circ7-manual-render-transcription-0.2.0";
const createdAt = "2026-08-23T00:00:00Z";

type Region = {
    coordinateSystem: "pdf-points-top-left";
    x: number;
    y: number;
    width: number;
    height: number;
};
type TextKind = "heading" | "paragraph" | "list-item" | "footnote";
type TextBlock = { kind: TextKind; page: number; text: string };
type AssetBlock = {
    kind: "formula-ref" | "table-ref" | "figure-ref";
    page: number;
    asset: string;
    label: string;
    region?: Region;
};
type Block = TextBlock | AssetBlock;

const unitId = (number: string) =>
    `urn:structural-codes:it:unit:circ2019:${number.toLowerCase()}`;
const assetId = (kind: "formula" | "table" | "figure", number: string) =>
    `urn:structural-codes:it:asset:${kind}:circ2019:${number.toLowerCase()}`;
const sha256 = (value: string) =>
    createHash("sha256").update(value, "utf8").digest("hex");
const pageRegion = (): Region => ({
    coordinateSystem: "pdf-points-top-left",
    x: 73.9,
    y: 55,
    width: 450,
    height: 730,
});
const printedPage = (page: number) => String(page - 4);
const p = (page: number, text: string): TextBlock => ({
    kind: "paragraph",
    page,
    text,
});
const h = (page: number, text: string): TextBlock => ({
    kind: "heading",
    page,
    text,
});
const li = (page: number, text: string): TextBlock => ({
    kind: "list-item",
    page,
    text,
});
const footnote = (page: number, text: string): TextBlock => ({
    kind: "footnote",
    page,
    text,
});
const formula = (page: number, number: string): AssetBlock => ({
    kind: "formula-ref",
    page,
    asset: assetId("formula", number),
    label: number,
});
const table = (page: number, number: string): AssetBlock => ({
    kind: "table-ref",
    page,
    asset: assetId("table", number),
    label: `Tabella ${number}`,
});
const figure = (
    page: number,
    number: string,
    region: Omit<Region, "coordinateSystem">,
): AssetBlock => ({
    kind: "figure-ref",
    page,
    asset: assetId("figure", number),
    label: `Figura ${number}`,
    region: { coordinateSystem: "pdf-points-top-left", ...region },
});

const mathTerms: Array<[string, string]> = [
    ["γ_Rd ≥ 1,25", "\\gamma_{Rd}\\ge1{,}25"],
    ["S_{eZ}(T,ξ,z)", "S_{eZ}(T,\\xi,z)"],
    ["S_{eZ,k}", "S_{eZ,k}"],
    ["S_e(T,ξ)", "S_e(T,\\xi)"],
    ["S_i(T_i)", "S_i(T_i)"],
    ["S_{eZ}", "S_{eZ}"],
    ["S_a(T_a)", "S_a(T_a)"],
    ["S_a", "S_a"],
    ["a_{Z,k}", "a_{Z,k}"],
    ["a_gS", "a_gS"],
    ["q_a", "q_a"],
    ["γ_Rd", "\\gamma_{Rd}"],
    ["Rd", "Rd"],
    ["γ_k", "\\gamma_k"],
    ["ψ_k(z)", "\\psi_k(z)"],
    ["Γ_i", "\\Gamma_i"],
    ["φ_i", "\\phi_i"],
    ["ξ_k", "\\xi_k"],
    ["ξ", "\\xi"],
    ["η", "\\eta"],
    ["α", "\\alpha"],
    ["T_a", "T_a"],
    ["T_i", "T_i"],
    ["T_k", "T_k"],
    ["T_1", "T_1"],
    ["T*", "T^*"],
    ["a, b, a_p", "a,b,a_p"],
    ["z = 0", "z=0"],
    ["≥", "\\ge"],
    ["≤", "\\le"],
    ["§ 7.11", "\\S 7.11"],
    ["§ 7.1", "\\S 7.1"],
    ["§ 7.2.1", "\\S 7.2.1"],
    ["§ 7.2.2", "\\S 7.2.2"],
    ["§ 7.2.3", "\\S 7.2.3"],
    ["§ 7.2.6", "\\S 7.2.6"],
    ["§ 3.2.4", "\\S 3.2.4"],
    ["§ 3.2.3.2.1", "\\S 3.2.3.2.1"],
    ["§ 7.3.6", "\\S 7.3.6"],
    ["§ 7.3.4.2", "\\S 7.3.4.2"],
    ["§ 7.3.3.2", "\\S 7.3.3.2"],
    ["§ 7.10.2", "\\S 7.10.2"],
    ["§ 3.2.3.2.1", "\\S 3.2.3.2.1"],
    ["1,25", "1{,}25"],
    ["1,3", "1{,}3"],
    ["0,8", "0{,}8"],
    ["1,1", "1{,}1"],
    ["0,4 e 0,5", "0{,}4\\text{ e }0{,}5"],
    ["5%", "5\\%"],
];

function inline(text: string): any[] | undefined {
    const terms = mathTerms
        .filter(([value]) => text.includes(value))
        .sort((a, b) => b[0].length - a[0].length);
    if (!terms.length) return undefined;
    const segments: any[] = [];
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
            segments.push({ kind: "text", value: text.slice(cursor) });
            break;
        }
        if (next.index > cursor) {
            segments.push({ kind: "text", value: text.slice(cursor, next.index) });
        }
        segments.push({ kind: "math", value: next.value, latex: next.latex });
        cursor = next.index + next.value.length;
    }
    return segments.filter(({ value }) => value);
}

function evidence(page: number, value: string, region: Region = pageRegion()) {
    return {
        sourceId,
        pdfPage: page,
        printedPage: printedPage(page),
        region,
        extraction: {
            method: "manual-transcription",
            tool: "codex-render-transcription",
            toolVersion: profile,
        },
        transformations: [],
        rawSha256: sha256(value),
        normalizedSha256: sha256(value),
    };
}

const c7: Block[] = [
    h(197, "C7 PROGETTAZIONE PER AZIONI SISMICHE"),
    p(198, "Il Capitolo 7 delle NTC illustra, per ciascuna delle tipologie costruttive considerate nei Capitoli 4, 5 e 6, i provvedimenti specifici da adottare, in presenza di azioni sismiche, finalizzandoli alla progettazione e costruzione delle nuove opere (per le opere esistenti si rimanda ai Capitoli 8 delle NTC e C8)."),
    p(198, "Le indicazioni relative ai modelli di calcolo, alle sollecitazioni e alle resistenze degli elementi strutturali sono additive e non sostitutive di quelle riportate nei Capitoli 4 e 5 delle NTC. Si deve inoltre fare riferimento al Capitolo 2 delle NTC, per le azioni e le loro combinazioni, e al Capitolo 3 delle NTC, per le modalità di rappresentazione dell’azione sismica e la definizione della sua entità in relazione ai diversi stati limite da considerare. Particolare attenzione richiedono, infine, le indicazioni geotecniche specificamente antisismiche (§ 7.11 delle NTC), al solito, additive e non sostitutive di quelle già riportate nel Capitolo 6 delle NTC."),
    p(198, "Ampio spazio è stato riservato, sia nelle NTC sia nel presente documento, alle costruzioni e ai ponti con isolamento e dissipazione di energia (§ 7.10 delle NTC e C7.10); tale attenzione è giustificata dalla indiscutibile efficacia che tali tecniche hanno manifestato nel garantire i livelli prestazionali richiesti alle costruzioni antisismiche, particolarmente quando si vogliano perseguire strategie progettuali atte a minimizzare i danni, sia alle componenti strutturali, sia alle componenti non strutturali e agli impianti."),
    p(198, "La norma fa sistematico riferimento alla UNI EN 1998, risultando in sostanziale accordo con essa. Con tale finalità, particolare attenzione è stata dedicata a raccogliere, in una trattazione sintetica iniziale valida per tutte le tipologie costruttive, i requisiti comuni nei confronti degli stati limite (§ 7.1 delle NTC), i criteri generali di progettazione e modellazione (§ 7.2 delle NTC), i metodi di analisi e i criteri di verifica (§ 7.3 delle NTC). I paragrafi successivi (dal 7.4 al 7.11 delle NTC) sono poi dedicati alle diverse tipologie costruttive e a problemi specifici."),
    p(198, "Le novità del Capitolo 7 delle NTC rispetto alla precedente versione sono più di carattere organizzativo che di carattere concettuale e verranno esaurientemente illustrate nei successivi paragrafi; tra le poche novità di carattere concettuale le principali sono:"),
    li(198, "la scomparsa di qualunque riferimento alla zonazione sismica, sostituita dalla indicazione dei livelli di accelerazione a_gS, attesa allo SLV;"),
    li(198, "la chiara distinzione tra progettazione in capacità (approccio concettuale con cui si persegue la duttilità) e gerarchia delle resistenze (strumento operativo impiegato per conseguirla);"),
    li(198, "la sistematica adozione di tavole sinottiche di riepilogo dei diversi coefficienti, finalizzata a facilitare i confronti sistematici tra le diverse tipologie e i diversi stati limite."),
];

const c71: Block[] = [
    h(198, "C7.1 REQUISITI NEI CONFRONTI DEGLI STATI LIMITE"),
    p(198, "La norma indica, per ciascuno stato limite, l’insieme delle verifiche da eseguire attraverso il confronto tra capacità e domanda, così come definite al § 7.1 delle NTC."),
    p(198, "Ciò prevede una strategia progettuale basata su livelli crescenti dell’azione sismica e dei danni ad essa corrispondenti; non è possibile basarsi unicamente su verifiche in termini di resistenza ma occorre effettuare verifiche anche in termini di duttilità."),
    p(198, "Riferendosi agli Stati Limite definiti al § 3.2.1 delle NTC, occorre anche garantire l’operatività della costruzione o il controllo dei danni, per gli Stati Limite di Esercizio, la salvaguardia della vita o la prevenzione del collasso, per gli Stati Limite Ultimi."),
    p(198, "Scelta la tipologia strutturale e definite le caratteristiche generali della struttura, da cui dipende il comportamento sismico e dunque l’azione sismica stessa (legata alle proprietà dinamiche e di duttilità), la prestazione associata a ciascuno Stato Limite può essere assicurata progettando gli elementi strutturali e non strutturali in modo da garantire loro che una o più delle grandezze proprie della capacità (rigidezza, resistenza, duttilità) siano adeguate alla corrispondente domanda, secondo i criteri di verifica dettagliati nelle NTC."),
    p(198, "Il controllo del danneggiamento strutturale e non strutturale, ad esempio, si consegue essenzialmente attraverso la limitazione degli spostamenti relativi di interpiano; la relativa capacità, pertanto, è quantizzata in termini di rigidezza, tenendo opportunamente conto delle non linearità di materiale che si manifestano, in genere, già per livelli di azione sismica legati agli Stati Limite di Esercizio. D’altro canto, per garantire le prestazioni associate allo Stato Limite di Salvaguardia della Vita, è necessario un confronto capacità/domanda in termini di resistenza; mentre nello Stato Limite di Prevenzione del Collasso il confronto capacità/domanda si effettua in termini di duttilità."),
    p(198, "L’insieme delle verifiche da eseguire per gli elementi strutturali e non strutturali e per gli impianti è sintetizzato al § 7.3.6 delle NTC, commentato e ulteriormente dettagliato nel corrispondente paragrafo della presente circolare."),
    footnote(198, "Pur essendo la capacità una caratteristica intrinseca della struttura, per manifestarsi essa richiede un preciso livello dell’azione; nel caso di comportamento non lineare quale quello in esame, peraltro, le grandezze che esprimono la capacità possono variare in funzione dell’azione. Pertanto, la domanda e la capacità sono tra loro mutuamente connesse e dipendenti dal particolare stato limite considerato; il loro confronto, in fase di progettazione, è finalizzato ad assicurare alla costruzione nel suo insieme i livelli prestazionali prefissati. Tali livelli prestazionali si misurano essenzialmente in termini di danni, per gli elementi strutturali e non strutturali, in termini di funzionamento e stabilità, per gli impianti."),
];

const c72: Block[] = [
    h(199, "C7.2 CRITERI GENERALI DI PROGETTAZIONE E MODELLAZIONE"),
    p(199, "Questo paragrafo della norma illustra i criteri generali di progettazione e modellazione, indicando le caratteristiche generali che le costruzioni devono possedere per conseguire un comportamento dinamico ottimale in presenza di azioni sismiche, con particolare riguardo alle condizioni di regolarità (§ 7.2.1). La norma tratta, con le modalità in essa specificate, gli elementi strutturali, gli elementi non strutturali e gli impianti, dedicando attenzione specifica a ciascuna delle tre componenti, per ciascuno stato limite e, dunque, per il corrispondente valore dell’azione sismica, così da consentire il raggiungimento dei rispettivi livelli prestazionali definiti in fase di progettazione."),
    p(199, "Per quanto riguarda i sistemi strutturali (§ 7.2.2), la norma distingue, preliminarmente, tra comportamento dissipativo e comportamento non dissipativo, lasciando libero il progettista di scegliere tra i due e, nel caso in cui opti per il comportamento dissipativo, fornendo i principi, le modalità operative e le regole pratiche per conseguire i livelli di duttilità prefissati."),
];

const c721: Block[] = [
    h(199, "C7.2.1 CARATTERISTICHE GENERALI DELLE COSTRUZIONI"),
    h(199, "Regolarità"),
    p(199, "La regolarità strutturale è finalizzata a favorire, anche in campo inelastico, un comportamento della costruzione e delle sue membrature il più possibile uniforme e tale da evitare concentrazioni di sforzi."),
    p(199, "In generale, un edificio può dirsi regolare in pianta e in altezza quando il suo comportamento dinamico sia governato principalmente da modi di vibrare traslazionali lungo le sue direzioni principali e quando tali modi siano caratterizzati da spostamenti crescenti, all’incirca linearmente, con l’altezza."),
    p(199, "Con riferimento al § 7.2.1 delle NTC le condizioni a) e b) di regolarità in pianta sono sintetizzate nella figura C7.2.1, la condizione g) di regolarità in elevazione è sintetizzata nella figura C7.2.2 e riferita al caso in cui, in una stessa direzione, siano presenti restringimenti in elevazione ad entrambe le estremità; in tal caso il limite del 10% della dimensione corrispondente all’orizzontamento immediatamente sottostante è da intendersi per ciascuno dei due rientri, mentre il limite del 30% della dimensione corrispondente al primo orizzontamento è da intendersi per la somma dei due."),
    figure(199, "C7.2.1", { x: 74, y: 373, width: 188, height: 178 }),
    figure(199, "C7.2.2", { x: 262, y: 373, width: 260, height: 178 }),
    p(199, "Nel caso in cui in un edificio, immediatamente al di sopra della fondazione, sia presente un basamento, di uno o più piani, con caratteristiche tali da poter essere considerato alla stregua di una struttura scatolare rigida, le NTC specificano che, per valutare la regolarità in altezza, si può far riferimento alla sola parte della struttura che si sviluppa al di sopra del basamento. Tale indicazione tende a escludere la fondazione scatolare rigida dall’individuazione del comportamento strutturale, a condizione che ad essa venga assicurato un comportamento non dissipativo, indipendentemente dallo stato limite considerato²."),
    h(199, "Distanza tra costruzioni contigue"),
    p(199, "Tra costruzioni contigue la norma impone la verifica degli spostamenti massimi per evitare fenomeni di martellamento; tale verifica deve essere eseguita attraverso un calcolo diretto degli spostamenti assicurando, in ogni caso, che la distanza tra le costruzioni non risulti inferiore al valore minimo stabilito dalla norma."),
    p(200, "L’eventualità in cui non si possano eseguire calcoli specifici va riferita al solo caso di progettazione di nuova costruzione in adiacenza a costruzioni esistenti."),
    footnote(199, "Questo requisito è essenziale perché le eventuali plasticizzazioni nella fondazione scatolare altererebbero i rapporti di rigidezza con la sovrastruttura, con la conseguenza di non poter assicurare il soddisfacimento dei criteri di regolarità in elevazione posti a base della progettazione."),
];

const c722: Block[] = [
    h(200, "C7.2.2 CRITERI GENERALI DI PROGETTAZIONE DEI SISTEMI STRUTTURALI"),
    p(200, "Le prescrizioni normative sono volte a garantire che l’organismo strutturale sia dotato di sistemi resistenti disposti almeno secondo due direzioni distinte, capaci di garantire un’adeguata resistenza e rigidezza nei confronti sia dei moti traslazionali, sia dei moti torsionali, dovuti all’eccentricità tra il centro di massa ed il centro di rigidezza dell’intera struttura o anche solo di una sua porzione, che tendono a sollecitare i diversi elementi strutturali in maniera non uniforme."),
    p(200, "Al riguardo, nel caso degli edifici, sono da preferirsi configurazioni strutturali in cui i principali elementi resistenti all’azione sismica sono distribuiti nelle zone perimetrali, così da massimizzare la rigidezza torsionale della costruzione. Per sfruttare al meglio la rigidezza torsionale conseguita nel modo suddetto è necessario che gli orizzontamenti, ai fini della ripartizione degli effetti delle componenti orizzontali dell’azione sismica, tra gli elementi verticali che li sostengono, funzionino da diaframma rigido nei modi specificati al § 7.2.6 delle NTC."),
    p(200, "Per quanto riguarda gli effetti della componente verticale dell’azione sismica, nel § 7.2.2 sono indicati gli elementi e le tipologie costruttive che maggiormente risentono delle accelerazioni verticali indotte dal sisma, nonché i livelli di pericolosità per i quali tale componente deve essere considerata nel progetto. Per gli elementi soggetti a tali azioni e per quelli di supporto dei medesimi è ammesso l’uso di modelli parziali che tengano conto della rigidezza degli elementi adiacenti."),
    p(200, "In generale non si tiene conto della variabilità spaziale del moto sismico e si adotta per esso una rappresentazione di tipo “puntuale”, quale è quella che prevede l’utilizzo degli spettri di risposta adottando un unico valore di accelerazione del suolo per tutti i punti di contatto tra esso e la struttura."),
    p(200, "Quando, per l’estensione del sistema di fondazione, non è realistica l’ipotesi che l’intera costruzione sia soggetta ad una eccitazione sismica uniforme, è necessario considerare la variabilità spaziale del moto di cui al § 3.2.4 delle NTC."),
    p(200, "Le NTC distinguono due tipi di comportamento strutturale:"),
    li(200, "a) non dissipativo;"),
    li(200, "b) dissipativo."),
    p(200, "Specificando, per ciascun comportamento, i corrispondenti criteri di modellazione dell’azione sismica e della struttura."),
    p(200, "Le NTC consentono al progettista di optare per uno dei due comportamenti, in relazione al particolare problema progettuale. Il comportamento strutturale non dissipativo (a) richiede che la struttura abbia resistenza tale da rimanere in campo sostanzialmente elastico per tutti gli stati limite considerati. Il comportamento strutturale dissipativo (b) si basa sulla duttilità e presuppone dunque l’accettazione del danneggiamento strutturale come strategia di protezione passiva per i terremoti di progetto agli stati limite ultimi."),
    p(200, "Nel caso di comportamento strutturale non dissipativo (a) la risposta sismica della struttura dipende, essenzialmente, dalle sue caratteristiche di rigidezza e resistenza; in caso di comportamento strutturale dissipativo (b), dalle caratteristiche di rigidezza, resistenza e dalla capacità di sviluppare deformazioni cicliche in campo plastico (duttilità)."),
    p(200, "L’insieme delle prescrizioni contenute nelle NTC, finalizzate al conseguimento dei prefissati livelli di duttilità, costituisce la “progettazione in capacità”."),
    p(200, "Quando si opta per il comportamento non dissipativo (a) le azioni sismiche di progetto sono più elevate, ma la duttilità necessaria è molto contenuta e dunque non è richiesta la progettazione in capacità e l’adozione dei dettagli costruttivi riportati al Capitolo 7; quando, invece, si opta per il comportamento dissipativo (b), le azioni sismiche di progetto sono minori, ma la duttilità necessaria è più elevata e dunque è richiesta la progettazione in capacità e l’adozione di dettagli costruttivi specifici."),
    p(200, "Il comportamento dissipativo (b), ammette, in generale, un danneggiamento della costruzione, eventualmente anche esteso ma controllato, per i livelli di azione relativi a SLV e SLC e un possibile danneggiamento, di entità comunque limitata, per lo SLD."),
    p(200, "A ciò fanno eccezione le strutture dotate di isolamento alla base, per le quali anche i requisiti riferiti agli stati limite ultimi vengono conseguiti evitando significative escursioni in campo plastico degli elementi strutturali della sovrastruttura e della sottostruttura (si veda il § 7.10.2 delle NTC)."),
    p(200, "Nelle costruzioni dissipative e prive di specifici dispositivi antisismici o di controllo delle vibrazioni, ai fini di un buon comportamento dissipativo d’insieme, le deformazioni inelastiche devono essere distribuite nel maggior numero possibile di elementi duttili per contenere l’entità delle plasticizzazioni."),
    p(200, "In funzione della tipologia costruttiva e dei materiali utilizzati, è dunque possibile separare i meccanismi deformativi fragili o scarsamente dissipativi, dai meccanismi duttili ai quali è invece possibile associare, mediante adeguati accorgimenti, significativa capacità di dissipare energia."),
    p(201, "La progettazione del comportamento dissipativo, effettuata secondo le NTC, è mirata a garantire l’attivazione di meccanismi deformativi, locali e globali, che concentrino la domanda di duttilità negli elementi più duttili (ad es. le travi) invece che negli elementi meno duttili (ad es. le pareti o i pilastri, particolarmente quelli soggetti a sforzi normali di compressione rilevanti) e che impediscano l’attivazione di meccanismi fragili (ad es. rottura a taglio di pareti, travi o pilastri, rottura di nodi trave-pilastro), sia locali sia globali, o globalmente instabili."),
    p(201, "La duttilità d’insieme della costruzione si ottiene, in definitiva, individuando gli elementi ed i meccanismi resistenti ai quali affidare le capacità dissipative e localizzando, all’interno del sistema strutturale, le zone in cui ammettere la plasticizzazione, in modo da ottenere un meccanismo deformativo d’insieme stabile, che coinvolga il maggior numero possibile di fonti di duttilità locale."),
    p(201, "Nell’ambito del comportamento strutturale dissipativo, il progettista può decidere di conseguire la Classe di Duttilità Alta (CD“A”), a elevata capacità dissipativa, oppure la Classe di Duttilità Media (CD“B”), a media capacità dissipativa, rappresentando dunque le lettere “A” e “B” una mera tipizzazione."),
    p(201, "La scelta della CD“A” rispetto alla CD“B” si traduce in un’ulteriore riduzione delle azioni di progetto, ma implica richieste di duttilità più elevate e, in generale, un maggiore onere in termini di dettagli costruttivi."),
    p(201, "La norma definisce i criteri progettuali per conseguire il livello di duttilità prefissato; l’insieme di tali criteri costituisce la “progettazione in capacità”."),
    p(201, "In particolare, al fine di garantire il comportamento duttile locale e globale, fatta la distinzione tra elementi/meccanismi fragili e duttili, su ciascun elemento si determina:"),
    li(201, "la domanda in termini di resistenza, stabilendo, in base a considerazioni di equilibrio, una “gerarchia delle resistenze” tra elementi/meccanismi fragili (più resistenti) e elementi/meccanismi duttili (meno resistenti);"),
    li(201, "la domanda in termini di duttilità nelle zone destinate a plasticizzarsi, cui deve essere garantito un comportamento inelastico dissipativo e stabile in condizioni cicliche (duttile)."),
    p(201, "Si progettano quindi, in termini di resistenza e/o duttilità, le corrispondenti capacità."),
    p(201, "Per conseguire gli obiettivi insiti nella progettazione in capacità, si impiegano fattori di sovraresistenza γ_Rd, opportunamente differenziati tra le due classi di duttilità³."),
    p(201, "Le NTC prescrivono che il comportamento duttile vada perseguito sia a livello locale sia a livello globale. A tal fine viene prescritto un fattore di sovraresistenza γ_Rd ≥ 1,25 per i meccanismi globali fragili rispetto ai meccanismi globali duttili."),
    p(201, "Per una struttura alla quale si richiede un comportamento duttile e che abbia al suo interno pareti di controventamento tozze (particolarmente suscettibili di rottura a taglio) e telai duttili, ciò comporta l’assunzione di γ_Rd locali sulle pareti tali da assicurare che, per attivare un meccanismo globale che veda la rottura a taglio delle pareti, occorrano azioni sismiche maggiori, almeno di un fattore 1,25, delle azioni richieste per attivare il meccanismo a telaio⁴."),
    p(201, "Al riguardo è bene chiarire che, nel caso di strutture a telaio, l’applicazione della progettazione in capacità è finalizzata, a livello globale, ad impedire l’attivazione di meccanismi instabili di piano, a livello locale, a controllare le plasticizzazioni nei pilastri senza escluderle in assoluto."),
    p(201, "Proprio per questa ragione, in accordo con la UNI EN 1998, per la pressoflessione di pilastri o colonne si adotta un fattore di sovraresistenza γ_Rd unico e pari a 1,3, sia per la CD“A” sia per la CD“B”. Per lo stesso motivo, non essendo possibile escludere che, durante l’evento sismico, si abbiano plasticizzazioni in alcuni pilastri, alle zone di estremità di tutti i pilastri primari deve essere garantito un comportamento dissipativo."),
    p(201, "I valori dei fattori di sovraresistenza γ_Rd, distinti per tipologia strutturale e Classi di Duttilità, sono riportati nella Tabella 7.2.I delle NTC."),
    p(201, "I principi della progettazione in capacità sono alla base della progettazione antisismica e si applicano ogni qual volta si voglia favorire un determinato comportamento strutturale a livello sia locale sia globale."),
    p(201, "Analogamente, se si vuole valutare la massima domanda a taglio in un elemento strutturale, si determina, in base a semplici considerazioni di equilibrio, il valore del taglio in equilibrio con le azioni esterne (ad es. il carico verticale distribuito in una trave) e con la capacità a flessione (momenti resistenti) nelle sezioni di estremità, analizzando, per quanto riguarda i versi delle sollecitazioni, le diverse situazioni possibili in condizioni sismiche."),
    footnote(201, "I fattori di sovraresistenza tengono conto delle incertezze nella determinazione delle resistenze, dovute ai materiali, alla geometria, al modello di calcolo, ecc.; tali fattori, almeno pari all’unità, vengono utilizzati per maggiorare la domanda in termini di resistenza (e di conseguenza la corrispondente capacità) degli elementi/meccanismi fragili di cui si vuole impedire l’attivazione. Essi includono, oltre alle incertezze dette, anche l’incertezza sulla capacità dell’elemento duttile di cui si vuole favorire la plasticizzazione ed hanno lo scopo di ridurre la probabilità di attivazione delle rotture/meccanismi indesiderati."),
    footnote(201, "Per evitare che, in forza di questa prescrizione, il progettista sia obbligato a produrre più modelli di calcolo confrontandoli poi sistematicamente, le NTC richiedono che la verifica avvenga “anche solo su base deduttiva a partire dai fattori di sovraresistenza Rd da utilizzare nella progettazione in capacità a livello locale”."),
];

const c723: Block[] = [
    h(202, "C7.2.3 CRITERI DI PROGETTAZIONE DI ELEMENTI STRUTTURALI SECONDARI ED ELEMENTI COSTRUTTIVI NON STRUTTURALI"),
    h(202, "Elementi Secondari"),
    p(202, "Gli elementi strutturali secondari devono essere in grado, nella configurazione deformata più sfavorevole, di mantenere la loro capacità portante nei confronti dei carichi verticali tenendo conto, quando necessario, delle non linearità geometriche nei modi specificati nel § 7.3 delle NTC. Quando gli elementi secondari soggetti a spostamenti causati dalla più sfavorevole delle condizioni sismiche di progetto allo SLC, valutati come previsto nel § 7.2.3 delle NTC, non subiscono plasticizzazioni, per questi ultimi possono essere adottati i particolari costruttivi prescritti al Capitolo 4; in caso contrario valgono le prescrizioni del Capitolo 7."),
    h(202, "Elementi costruttivi non strutturali"),
    p(202, "Le NTC classificano gli elementi costruttivi non strutturali in due gruppi:"),
    li(202, "1) elementi con rigidezza, resistenza e massa tali da influenzare in maniera significativa la risposta strutturale;"),
    li(202, "2) elementi che influenzano la risposta strutturale solo attraverso la loro massa, ma sono ugualmente significativi ai fini della sicurezza e/o dell’incolumità delle persone."),
    p(202, "Ai fini anche della determinazione della domanda sismica, per il primo gruppo di elementi non strutturali, si potrà introdurre, in relazione al tipo di verifica e di analisi da effettuarsi, nel modello strutturale globale oltre alla massa degli elementi che viene sempre considerata anche la loro rigidezza descrivendone le condizioni di vincolo alla struttura."),
    p(202, "Per il secondo gruppo di elementi non strutturali, ottenuta la risposta in accelerazione della struttura a ciascun piano, la si può assimilare ad una forzante esterna da applicare all’elemento non strutturale, così ricavando la domanda sismica su di esso."),
    p(202, "La verifica degli elementi non strutturali, degli impianti o, per le costruzioni di muratura, dei meccanismi locali richiede una corretta valutazione dell’input sismico; il moto alla base dell’edificio è infatti filtrato dalla risposta della costruzione, in relazione alle sue caratteristiche dinamiche (frequenze proprie) e alla quota alla quale gli elementi soggetti a verifica sono collocati (forme modali); a tal fine risulta utile la seguente definizione di spettri di risposta di piano."),
    h(202, "Spettri di risposta di piano"),
    p(202, "Gli spettri di risposta di piano rappresentano un modello per la valutazione dell’azione sismica in un predeterminato punto della struttura. Diverse formulazioni, più o meno approssimate, possono essere utilizzate. Nel seguito si riportano alcuni possibili metodi di calcolo, è ammesso l’uso anche di altre formulazioni purché di comprovata e documentata validità."),
    p(202, "Gli spettri di risposta di ciascun piano possono essere determinati, a partire dalla risposta in accelerazione della struttura alla quota considerata, nell’ipotesi semplificativa che la struttura possa essere assunta come una forzante armonica per l’elemento non strutturale, portando in conto le amplificazioni dovute agli effetti dinamici sul singolo elemento non strutturale, legate al suo periodo di oscillazione e al suo coefficiente di smorzamento nonché alle corrispondenti caratteristiche della struttura."),
    p(202, "Nella formula [7.2.1], il parametro S_a rappresenta appunto l’accelerazione massima (risposta), normalizzata rispetto a quella di gravità, che l’elemento non strutturale subisce durante il sisma, per lo stato limite considerato. L’inviluppo dei valori assunti da S_a al variare del periodo proprio T_a, a un generico piano della costruzione, costituisce lo spettro di risposta di quel piano."),
    p(202, "L’accelerazione del piano j-esimo della struttura relativa al modo i-esimo è data dalla relazione:"),
    formula(202, "C7.2.1"),
    h(202, "dove:"),
    li(202, "S_i(T_i) è l’ordinata dello spettro relativa al modo i-esimo (normalizzata rispetto a g ed eventualmente ridotta attraverso il fattore di comportamento q della costruzione);"),
    li(202, "Γ_i è il “fattore di partecipazione modale”, definito dalla relazione:"),
    formula(202, "C7.2.2"),
    p(202, "Il vettore τ è il vettore di trascinamento corrispondente alla direzione del sisma considerata; il vettore φ_i è la forma modale del modo i-esimo normalizzata al valore massimo; la matrice M è la matrice di massa del sistema reale."),
    p(202, "L’accelerazione dell’elemento non strutturale al piano considerato, nella direzione considerata, per il modo i-esimo, è data, dunque, dall’equazione:"),
    footnote(202, "Per facilitare la progettazione in situazioni oggettivamente difficili quali, ad esempio, quelle che si presentano quando, per ragioni architettoniche, alcuni elementi debbano avere dimensioni nettamente maggiori di quelle che sarebbero loro richieste dal progetto strutturale, le NTC consentono di trattare tali elementi come elementi secondari e dunque di trascurare la loro rigidezza e resistenza alle azioni orizzontali. Tale semplificazione è condizionata al rispetto di alcune condizioni precisate nelle norme."),
    formula(203, "C7.2.3"),
    p(203, "dove R, fattore di amplificazione dell’elemento non strutturale, è funzione del coefficiente di smorzamento ξ_a dell’elemento e del rapporto tra il periodo dell’elemento T_a e il periodo del modo i-esimo della struttura T_i, e vale:"),
    formula(203, "C7.2.4"),
    p(203, "L’eq. C7.2.3 rappresenta la risposta del singolo elemento non strutturale di periodo T_a, posto al piano j-esimo, per effetto del modo di vibrare i-esimo della struttura e tiene conto attraverso il coefficiente β (variabile tra 0,4 e 0,5) dell’accoppiamento tra ciascun modo di vibrare della struttura e il modo proprio dell’elemento non strutturale. La risposta totale si ottiene combinando opportunamente le risposte relative ai diversi modi, ad es. attraverso la regola SRSS."),
    p(203, "La norma consente infine di ridurre la domanda sismica S_a su ciascun elemento non strutturale attraverso uno specifico fattore di comportamento q_a. In tabella C7.2.I sono riportati i valori di q_a utilizzabili per le tipologie ricorrenti di elementi non strutturali."),
    table(203, "C7.2.I"),
    p(203, "È opportuno che il progettista, in base a considerazioni specifiche sulla risposta strutturale dell’elemento, indichi espressamente il gruppo attribuito a ciascun elemento non strutturale e il tipo di modellazione adottata. Nell’attribuzione del gruppo è opportuno ricordare che uno stesso elemento strutturale, ad esempio una tamponatura robusta, può appartenere al gruppo 1 per azioni sismiche nel proprio piano medio e al gruppo 2 per azioni sismiche ortogonali al proprio piano medio e tenere opportuno conto di ciò nel modello di calcolo."),
    p(203, "Poiché la risposta degli elementi non strutturali è legata, attraverso il periodo proprio dell’elemento, ai modi di vibrare della struttura, nel valutarne la risposta si deve considerare un intervallo nell’intorno del periodo fondamentale della struttura, che tenga conto, per il limite inferiore dell’intervallo, delle possibili incertezze di modellazione o dell’incremento di rigidezza rispetto al modello di riferimento dovuta agli elementi non strutturali, per il limite superiore dell’intervallo, dell’incremento di periodo dovuto alle plasticizzazioni, da valutarsi in funzione del fattore di comportamento attribuito alla struttura. Lo stesso fattore di comportamento deve essere utilizzato per la valutazione della risposta spettrale inelastica della struttura."),
    h(203, "Formulazione semplificata, a diverse quote, per elementi non strutturali, impianti, eventuali meccanismi locali"),
    p(203, "Nel seguito è fornita una formulazione analitica semplificata, valida per gli elementi non strutturali, per gli impianti e per eventuali meccanismi locali, valida qualunque sia la tipologia della costruzione."),
    p(203, "La formulazione analitica semplificata consente di valutare lo spettro di accelerazione S_{eZ}(T,ξ,z) ad una quota z significativa per l’elemento non strutturale, l’impianto o il meccanismo locale in esame; la formulazione è basata sulle proprietà dinamiche della struttura principale e sui valori dello spettro di risposta alla base dell’edificio calcolati in corrispondenza dei periodi propri della costruzione."),
    p(203, "Questa formulazione consente di tenere conto del contributo fornito da tutti i modi di vibrazione ritenuti significativi; in linea generale devono essere preventivamente individuate le forme di vibrazione (ed i relativi periodi) significative per l’elemento non strutturale, l’impianto o il meccanismo locale in esame, anche in relazione alla sua posizione in pianta (la sommatoria nella formula che segue è estesa a questi modi, identificati dal pedice k):"),
    formula(203, "C7.2.5"),
    formula(204, "C7.2.6"),
    formula(204, "C7.2.7"),
    h(204, "dove:"),
    li(204, "S_e(T,ξ) è lo spettro di risposta elastico al suolo, valutato per il periodo equivalente T e lo smorzamento viscoso equivalente ξ dell’elemento non strutturale, dell’impianto o del meccanismo locale considerato;"),
    li(204, "S_{eZ,k} è il contributo allo spettro di risposta di piano fornito dal k-esimo modo della struttura principale, di periodo proprio T_k e smorzamento viscoso equivalente ξ_k (in percentuale);"),
    li(204, "a e b sono coefficienti che definiscono l’intervallo di amplificazione massima dello spettro di piano, che possono essere assunti pari a 0,8 e 1,1 rispettivamente;"),
    li(204, "γ_k è il k-esimo coefficiente di partecipazione modale della costruzione;"),
    li(204, "ψ_k(z) è il valore della k-esima forma modale alla quota z, nella posizione in pianta dove è collocato il meccanismo locale da verificare;"),
    li(204, "η è il fattore che altera lo spettro elastico per un coefficiente di smorzamento ξ diverso dal 5%, dato dalla (3.2.4) nel § 3.2.3.2.1;"),
    li(204, "a_{Z,k} è il contributo del k-esimo modo alla accelerazione massima di piano."),
    p(204, "L’accelerazione massima alla quota z è quindi fornita dalla seguente espressione:"),
    formula(204, "C7.2.8"),
    p(204, "mentre il contributo al picco di accelerazione spettrale in corrispondenza del periodo T_k fornito dal k-esimo modo, vale:"),
    formula(204, "C7.2.9"),
    p(204, "Nella verifica di meccanismi locali in edifici multipiano è, in genere, sufficiente riferirsi al solo primo modo di vibrare nella direzione di verifica, in quanto è quello che induce la domanda di spostamento più significativa; nel caso in cui si stia eseguendo una verifica globale dell’edificio principale attraverso un’analisi statica non lineare, per il periodo T_1 può essere assunto il periodo elastico T*, dato dalla formula [C7.3.6] riportata nel § C7.3.4.2."),
    p(204, "Una valutazione più accurata di T_1 richiederebbe la stima del periodo secante del sistema bilineare, in corrispondenza della domanda di spostamento (v. equazione [C7.3.7] o [C7.3.8]) prodotta dall’accelerazione al suolo che porta allo stato limite il meccanismo locale (proprio elemento), per il quale si tiene conto dello stato di danneggiamento della struttura principale, al raggiungimento dello stato limite da parte del meccanismo locale)."),
    p(204, "In assenza di tali valutazioni, il periodo T_1 può essere stimato con la formula [7.3.6] del § 7.3.3.2."),
    p(204, "Nel caso di strutture con masse distribuite in maniera sostanzialmente uniforme lungo l’altezza, se si assume la prima forma modale lineare e la si normalizza allo spostamento in sommità all’edificio, il coefficiente di partecipazione modale può essere approssimato dalla formula:"),
    formula(204, "C7.2.10"),
    p(204, "dove n è il numero di piani."),
    p(204, "Si segnala che gli spettri alle diverse quote sono fortemente influenzati dal livello di non linearità della struttura principale; essi presentano infatti una forte amplificazione in corrispondenza del periodo fondamentale della costruzione. Tale amplificazione si riduce considerevolmente quando la struttura entra in campo non lineare. La formulazione proposta considera tale effetto attraverso lo smorzamento viscoso equivalente ξ_k e l’incremento del periodo equivalente T_k."),
    h(204, "Formulazione semplificata per costruzioni con struttura a telai"),
    p(204, "Per le sole costruzioni con struttura intelaiata, in alternativa alle precedenti formulazioni e nell’ipotesi di andamento delle accelerazioni strutturali linearmente crescente con l’altezza, l’accelerazione massima S_a(T_a) può essere determinata attraverso l’espressione [C7.2.5 o 11]."),
    formula(205, "C7.2.11"),
    h(205, "dove:"),
    li(205, "α è il rapporto tra l’accelerazione massima del terreno a_gS su sottosuolo tipo A da considerare nello stato limite in esame (si veda § 3.2.3.2.1) e l’accelerazione di gravità g;"),
    li(205, "S è il coefficiente che tiene conto della categoria di sottosuolo e delle condizioni topografiche secondo quanto riportato nel § 3.2.3.2.1;"),
    li(205, "T_a è il periodo fondamentale di vibrazione dell’elemento non strutturale;"),
    li(205, "T_1 è il periodo fondamentale di vibrazione della costruzione nella direzione considerata;"),
    li(205, "z è la quota del baricentro dell’elemento non strutturale misurata a partire dal piano di fondazione;"),
    li(205, "H è l’altezza della costruzione misurata a partire dal piano di fondazione;"),
    li(205, "a, b, a_p sono parametri definiti in accordo con il periodo fondamentale di vibrazione della costruzione (si vedano Fig. C7.2.4 e Tabella C7.2.II)."),
    p(205, "Per le strutture con isolamento sismico si assume sempre z = 0."),
    p(205, "Gli spettri di piano, descritti attraverso l’eq. C7.2.11, sono in generale conservativi per un ampio campo di periodi, con particolare riguardo a elementi non strutturali aventi periodo proprio prossimo al periodo fondamentale della costruzione. In particolare i parametri a, b e a_p sono stati definiti in accordo con il periodo proprio della struttura e calibrati per tener conto dell’elongazione del periodo fondamentale, legata alle non linearità del sistema, e del contributo dei modi superiori."),
    figure(205, "C7.2.3", { x: 190, y: 435, width: 220, height: 150 }),
    table(205, "C7.2.II"),
    figure(206, "C7.2.4", { x: 74, y: 100, width: 450, height: 240 }),
    p(206, "L’approccio seguito per la determinazione degli effetti sugli elementi non strutturali del secondo gruppo può essere utilizzato anche per quelli del primo gruppo, a condizione che la risposta strutturale sia determinata attraverso un modello che includa sia la massa sia la rigidezza degli elementi non strutturali. Ciò può rendersi necessario per quei modelli che non consentano la determinazione diretta della risposta dinamica degli elementi non strutturali."),
];

const c726: Block[] = [
    h(206, "C7.2.6 CRITERI DI MODELLAZIONE DELLA STRUTTURA E DELL’ AZIONE SISMICA"),
    h(206, "Modellazione della struttura"),
    p(206, "Gli orizzontamenti devono essere dotati di opportuna rigidezza e resistenza nel piano e essere collegati in maniera efficace alle membrature verticali che li sostengono, affinché possano assolvere la funzione di diaframma rigido ai fini della ripartizione delle forze orizzontali tra le membrature verticali stesse. Particolare attenzione va posta quando abbiano forma molto allungata o comunque non compatta: in quest’ultimo caso, occorre valutare se le aperture presenti, specie se localizzate in prossimità dei principali elementi resistenti verticali, non riducano significativamente la rigidezza."),
    p(206, "Gli orizzontamenti possono essere considerati infinitamente rigidi nel loro piano, modellandone la deformabilità nel piano, le variazioni degli spostamenti di tutti i punti appartenenti al piano in esame non differiscono tra loro per più del 10%. Tale condizione può ritenersi generalmente soddisfatta nei casi specificati nelle NTC (v. § 7.2.6), salvo porre particolare attenzione quando gli orizzontamenti siano sostenuti da elementi strutturali verticali (per es. pareti) di notevole rigidezza e resistenza."),
    p(206, "Quando gli orizzontamenti possono essere considerati infinitamente rigidi nel loro piano, le masse e le inerzie rotazionali di ogni piano possono essere concentrate nel suo centro di gravità."),
    p(206, "Ai fini di una corretta valutazione della risposta strutturale, la norma richiede che, nel rappresentare la rigidezza flessionale e a taglio dei singoli elementi di muratura, calcestruzzo, acciaio-calcestruzzo, si tenga conto della fessurazione. La norma prevede che, in assenza di analisi specifiche, la rigidezza degli elementi fessurati non sia assunta minore del 50% delle corrispondenti rigidezze non fessurate. Valori minori possono essere assunti a fronte di specifiche valutazioni adeguatamente motivate."),
    p(206, "La norma precisa che in ogni caso, nella valutazione della rigidezza degli elementi fessurati, si debba tenere conto dello stato limite considerato⁶ e dell’influenza della sollecitazione assiale permanente."),
    footnote(206, "Il coefficiente di fessurazione allo SLD dipende dal fattore di comportamento q, in quanto quest’ultimo condiziona lo stato fessurativo che si riscontra in corrispondenza dei diversi stati limite considerati. Ad esempio, se si adotta per la progettazione allo SLV un fattore di comportamento q di notevole entità, è ragionevole ipotizzare che molti elementi possano essere plasticizzati e che gran parte di essi siano fessurati in maniera estesa; può accadere inoltre che, in corrispondenza di un’azione sismica minore (ad esempio quella corrispondente allo SLD), ci siano già plasticizzazioni ed estese fessurazioni. Se invece la struttura è stata progettata allo SLV per valori ridotti del fattore di comportamento q, è ragionevole ipotizzare che, per azioni sismiche minori quali quelle relative allo SLD, molti elementi siano ancora in campo elastico o siano fessurati in maniera limitata, tenuto sempre conto che la fessurazione si manifesta comunque anche per effetto dei soli carichi verticali. Per gli elementi di calcestruzzo armato la fessurazione degli elementi dipende dalla geometria, dai quantitativi di armatura e dallo stato di sollecitazione; pertanto, per tenerne correttamente conto, si dovrebbe ricorrere a un processo iterativo, che risulterebbe eccessivamente oneroso e, in ogni caso, affetto da numerose incertezze."),
];

const formulas = [
    ["C7.2.1", "C7.2.3", 202, "S_{ij}=\\varphi_{ij}\\Gamma_i S_i(T_i)"],
    ["C7.2.2", "C7.2.3", 202, "\\Gamma_i=\\frac{\\boldsymbol{\\varphi}_i^{T}\\mathbf{M}\\boldsymbol{\\tau}}{\\boldsymbol{\\varphi}_i^{T}\\mathbf{M}\\boldsymbol{\\varphi}_i}"],
    ["C7.2.3", "C7.2.3", 203, "S_{a,ij}=S_{ij}R\\left(\\frac{T_a}{T_i};\\xi_a\\right)"],
    ["C7.2.4", "C7.2.3", 203, "R=\\left[\\left(2\\xi_a\\frac{T_a}{T_i}\\right)^2+\\left(1-\\left(\\frac{T_a}{T_i}\\right)^2\\right)^2\\right]^{-\\beta}"],
    ["C7.2.5", "C7.2.3", 203, "S_{eZ}(T,\\xi,z)=\\sqrt{\\sum_k\\left(S_{eZ,k}(T,\\xi,z)\\right)^2}\\;(\\ge S_e(T,\\xi)\\text{ per }T>T_1"],
    ["C7.2.6", "C7.2.3", 204, "S_{eZ,k}(T,\\xi,z)=\\begin{cases}\\dfrac{1.1\\xi_k^{-0.5}\\eta(\\xi)a_{Z,k}(z)}{1+\\left[1.1\\xi_k^{-0.5}\\eta(\\xi)-1\\right]\\left(1-\\dfrac{T}{aT_k}\\right)^{1.6}}&\\text{per }T<aT_k\\\\1.1\\xi_k^{-0.5}\\eta(\\xi)a_{Z,k}(z)&\\text{per }aT_k\\le T<bT_k\\\\\\dfrac{1.1\\xi_k^{-0.5}\\eta(\\xi)a_{Z,k}(z)}{1+\\left[1.1\\xi_k^{-0.5}\\eta(\\xi)-1\\right]\\left(\\dfrac{T}{bT_k}-1\\right)^{1.2}}&\\text{per }T\\ge bT_k\\end{cases}"],
    ["C7.2.7", "C7.2.3", 204, "a_{Z,k}(z)=S_e(T_k,\\xi_k)|\\gamma_k\\psi_k(z)|\\sqrt{1+0.0004\\xi_k^2}"],
    ["C7.2.8", "C7.2.3", 204, "a_Z(z)=\\sqrt{\\sum_k\\left(a_{Z,k}(z)\\right)^2}"],
    ["C7.2.9", "C7.2.3", 204, "S_{eZ,k}(T_k,\\xi_k,z)=1.1\\xi_k^{-0.5}\\eta(\\xi)a_{Z,k}(z)"],
    ["C7.2.10", "C7.2.3", 204, "\\gamma_1=\\frac{3n}{2n+1}"],
    ["C7.2.11", "C7.2.3", 205, "S_a(T_a)=\\begin{cases}\\alpha S\\left(1+\\dfrac{z}{H}\\right)\\left[\\dfrac{a_p}{1+(a_p-1)\\left(1-\\dfrac{T_a}{aT_1}\\right)^2}\\right]\\ge\\alpha S&\\text{per }T_a<aT_1\\\\\\alpha S\\left(1+\\dfrac{z}{H}\\right)a_p&\\text{per }aT_1\\le T_a<bT_1\\\\\\alpha S\\left(1+\\dfrac{z}{H}\\right)\\left[\\dfrac{a_p}{1+(a_p-1)\\left(1-\\dfrac{T_a}{bT_1}\\right)^2}\\right]\\ge\\alpha S&\\text{per }T_a\\ge bT_1\\end{cases}"],
] as const;

const tables = [
    {
        number: "C7.2.I",
        unit: "C7.2.3",
        page: 203,
        caption: "Tabella C7.2.I – Valori di q_a per elementi non strutturali",
        columnCount: 2,
        headers: [[{ text: "Elemento non strutturale" }, { text: "q_a", latex: "q_a" }]],
        rows: [
            [{ text: "Parapetti o decorazioni aggettanti" }, { text: "1,0", rowSpan: 3, latex: "1{,}0" }],
            [{ text: "Insegne e pannelli pubblicitari" }],
            [{ text: "Comignoli antenne e serbatoi su supporti funzionanti come mensole senza controventi per più di metà della loro altezza" }],
            [{ text: "Pareti interne ed esterne" }, { text: "2,0", rowSpan: 5, latex: "2{,}0" }],
            [{ text: "Tramezzatura e facciate" }],
            [{ text: "Comignoli, antenne e serbatoi su supporti funzionanti come mensole non controventate per meno di metà della loro altezza o connesse alla struttura in corrispondenza o al di sopra del loro centro di massa" }],
            [{ text: "Elementi di ancoraggio per armadi e librerie permanenti direttamente poggianti sul pavimento" }],
            [{ text: "Elementi di ancoraggio per controsoffitti e corpi illuminanti" }],
        ],
        notes: [],
    },
    {
        number: "C7.2.II",
        unit: "C7.2.3",
        page: 205,
        caption: "Tabella C7.2.II – Parametri a, b, a_p in accordo con il periodo di vibrazione della costruzione T_1",
        columnCount: 4,
        headers: [[{ text: "T_1", latex: "T_1" }, { text: "a", latex: "a" }, { text: "b", latex: "b" }, { text: "a_p", latex: "a_p" }]],
        rows: [
            [{ text: "T_1 < 0,5 s", latex: "T_1<0{,}5\\,\\mathrm{s}" }, { text: "0,8", latex: "0{,}8" }, { text: "1,4", latex: "1{,}4" }, { text: "5,0", latex: "5{,}0" }],
            [{ text: "0,5 s ≤ T_1 ≤ 1,0 s", latex: "0{,}5\\,\\mathrm{s}\\le T_1\\le1{,}0\\,\\mathrm{s}" }, { text: "0,3", latex: "0{,}3" }, { text: "1,2", latex: "1{,}2" }, { text: "4,0", latex: "4{,}0" }],
            [{ text: "T_1 > 1,0 s", latex: "T_1>1{,}0\\,\\mathrm{s}" }, { text: "0,3", latex: "0{,}3" }, { text: "1,0", latex: "1{,}0" }, { text: "2,5", latex: "2{,}5" }],
        ],
        notes: [],
    },
];

const figures = [
    ["C7.2.1", "C7.2.1", 199, "Figura C7.2.1 – Condizioni di regolarità in pianta", [74, 373, 262, 551]],
    ["C7.2.2", "C7.2.1", 199, "Figura C7.2.2 – Condizioni di regolarità in elevazione", [262, 373, 522, 551]],
    ["C7.2.3", "C7.2.3", 205, "Figura C7.2.3 – Spettri di risposta di piano per gli elementi non strutturali", [190, 435, 410, 585]],
    ["C7.2.4", "C7.2.3", 206, "Figura C7.2.4 – Accelerazione massima, normalizzata rispetto ad αS, per i seguenti valori di T₁: (a) T₁ = 0,3 s, (b) T₁ = 0,6 s, (c) T₁ = 0,9 s, (d) T₁ = 1,2 s", [74, 100, 524, 340]],
] as const;

const units = [
    ["C7", "PROGETTAZIONE PER AZIONI SISMICHE", c7],
    ["C7.1", "REQUISITI NEI CONFRONTI DEGLI STATI LIMITE", c71],
    ["C7.2", "CRITERI GENERALI DI PROGETTAZIONE E MODELLAZIONE", c72],
    ["C7.2.1", "CARATTERISTICHE GENERALI DELLE COSTRUZIONI", c721],
    ["C7.2.2", "CRITERI GENERALI DI PROGETTAZIONE DEI SISTEMI STRUTTURALI", c722],
    ["C7.2.3", "CRITERI DI PROGETTAZIONE DI ELEMENTI STRUTTURALI SECONDARI ED ELEMENTI COSTRUTTIVI NON STRUTTURALI", c723],
    ["C7.2.6", "CRITERI DI MODELLAZIONE DELLA STRUTTURA E DELL’ AZIONE SISMICA", c726],
] as const;

function parent(number: string) {
    const parts = number.split(".");
    return parts.length === 1 ? null : unitId(parts.slice(0, -1).join("."));
}
function ancestors(number: string) {
    const parts = number.split(".");
    return parts.slice(1).map((_, index) => unitId(parts.slice(0, index + 1).join(".")));
}

function record(number: string, title: string, specs: readonly Block[]) {
    const id = unitId(number);
    const blocks = specs.map((block, index) => {
        const blockId = `${id}#block-${index === 0 ? "heading" : `editorial-${String(index).padStart(3, "0")}`}`;
        if ("asset" in block) {
            return {
                blockId,
                kind: block.kind,
                origin: "official",
                assetId: block.asset,
                evidence: evidence(block.page, block.label, block.region ?? pageRegion()),
            };
        }
        return {
            blockId,
            kind: block.kind,
            origin: "official",
            text: {
                raw: block.text,
                normalized: block.text,
                normalizationVersion: profile,
                ...(inline(block.text) ? { inline: inline(block.text) } : {}),
            },
            evidence: evidence(block.page, block.text),
        };
    });
    const numberParts = number.slice(1).split(".").map(Number);
    const lower = number.toLowerCase();
    return {
        $schema: "urn:structural-codes:schema:canonical-unit:v2",
        schemaVersion: "2.0.0-alpha.2",
        recordType: "canonical-unit",
        id,
        workId,
        expressionId,
        kind: numberParts.length === 1 ? "section" : numberParts.length === 2 ? "paragraph" : "subparagraph",
        numbering: {
            official: number,
            sortKey: numberParts.map((part) => String(part).padStart(3, "0")).join("."),
        },
        title,
        titleBlockId: `${id}#block-heading`,
        hierarchy: {
            parentId: parent(number),
            ancestorIds: ancestors(number),
            position: numberParts.at(-1),
        },
        validity: { from: null, to: null, status: "unknown", asOf: "2026-08-23" },
        blocks,
        citations: [],
        relations: [],
        assets: {
            formulaIds: blocks.filter(({ kind }) => kind === "formula-ref").map(({ assetId }: any) => assetId),
            tableIds: blocks.filter(({ kind }) => kind === "table-ref").map(({ assetId }: any) => assetId),
            figureIds: blocks.filter(({ kind }) => kind === "figure-ref").map(({ assetId }: any) => assetId),
        },
        workflow: {
            status: "extracted",
            createdBy: { actorId: "generator:circ7:step1", kind: "script", toolVersion: profile },
            createdAt,
            reviews: [],
            openIssues: [
                {
                    issueId: `circ2019-${lower.replaceAll(".", "-")}-source-review`,
                    type: "normalization-review",
                    severity: "blocking",
                    note: "Trascrizione confrontata con i render delle pagine ufficiali; resta obbligatoria la revisione umana indipendente.",
                },
                {
                    issueId: `circ2019-${lower.replaceAll(".", "-")}-missing-text-layer`,
                    type: "missing-region",
                    severity: "blocking",
                    note: "Le pagine ufficiali sono scansioni con un layer testuale limitato a intestazione e numero pagina; i blocchi sono stati trascritti dal render PDF.",
                },
            ],
        },
    };
}

await mkdir(unitDirectory, { recursive: true });
await mkdir(assetDirectory, { recursive: true });
for (const [number, title, blocks] of units) {
    await writeFile(join(unitDirectory, `${number.toLowerCase()}.json`), `${JSON.stringify(record(number, title, blocks), null, 2)}\n`, "utf8");
}

const manifest = {
    $schema: "urn:structural-codes:schema:asset-manifest:v2",
    schemaVersion: "2.0.0-alpha.1",
    recordType: "asset-manifest",
    document: "circ2019",
    section: "C7.2",
    sourceId,
    status: "transcribed-unreviewed",
    formulas: formulas.map(([number, unit, page, latex]) => ({
        id: assetId("formula", number),
        unitId: unitId(unit),
        officialNumber: number,
        pdfPage: page,
        latex,
    })),
    tables: tables.map(({ number, unit, page, caption, columnCount, headers, rows, notes }) => ({
        id: assetId("table", number),
        unitId: unitId(unit),
        officialNumber: number,
        pdfPage: page,
        caption,
        columnCount,
        headers,
        rows,
        notes,
    })),
    figures: figures.map(([number, unit, page, caption, box]) => ({
        id: assetId("figure", number),
        unitId: unitId(unit),
        officialNumber: number,
        pdfPage: page,
        caption,
        alt: caption,
        imagePath: `figures/circ2019/fig${number.toLowerCase()}.png`,
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
await writeFile(join(assetDirectory, "7.2.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(`circ7-step1: generated ${units.length} units, ${formulas.length} formulas, ${tables.length} tables and ${figures.length} figures`);
