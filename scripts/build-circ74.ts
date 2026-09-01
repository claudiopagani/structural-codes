/* eslint-disable @typescript-eslint/no-explicit-any */
import { createHash } from "node:crypto";
import { mkdir, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const sourceId = "circ-7-2019";
const profile = "circ74-manual-render-transcription-0.1.0";
const unitId = (number: string): string =>
    `urn:structural-codes:it:unit:circ2019:${number.toLowerCase()}`;
const assetId = (kind: "formula" | "figure", number: string): string =>
    `urn:structural-codes:it:asset:${kind}:circ2019:${number.toLowerCase()}`;
const sha256 = (text: string): string =>
    createHash("sha256").update(text, "utf8").digest("hex");

const mathTerms: Array<[string, string]> = [
    ["M_b,Rd", "M_{b,Rd}"],
    ["M_c,Ed", "M_{c,Ed}"],
    ["M_Ed/M_Rd", "M_{Ed}/M_{Rd}"],
    ["M_Ed", "M_{Ed}"],
    ["M_Rd", "M_{Rd}"],
    ["M_i,d", "M_{i,d}"],
    ["l_p", "l_p"],
    ["V_jbd", "V_{jbd}"],
    ["α_j = 0,48 (f_ck,c / f_ck)", "\\alpha_j=0{,}48\\left(f_{ck,c}/f_{ck}\\right)"],
    ["α_u/α_1", "\\alpha_u/\\alpha_1"],
    ["γ_Rd", "\\gamma_{Rd}"],
    ["γ_C", "\\gamma_C"],
    ["γ_S", "\\gamma_S"],
    ["μ_φ", "\\mu_\\phi"],
    ["q_0", "q_0"],
    ["r²/l_s² > 1", "r^2/l_s^2>1"],
    ["r²/l_s²", "r^2/l_s^2"],
    ["K_θ", "K_\\theta"],
    ["l_s", "l_s"],
    ["T_θ", "T_\\theta"],
    ["Ω", "\\Omega"],
    ["θ ≤ 0,3", "\\theta\\le0{,}3"],
    ["d_r = d_Ee", "d_r=d_{Ee}"],
    ["0,0075h", "0{,}0075h"],
    ["0,0100h", "0{,}0100h"],
    ["30%", "30\\%"],
    ["15 cm", "15\\,\\mathrm{cm}"],
    ["α", "\\alpha"],
    ["q", "q"],
    ["r", "r"],
    ["K", "K"],
    ["T", "T"],
];

function findTerm(text: string, value: string, cursor: number): number {
    let index = text.indexOf(value, cursor);
    if (!/^[A-Za-z]$/.test(value)) return index;
    while (index >= 0) {
        const before = index > 0 ? text.charAt(index - 1) : "";
        const after = index + 1 < text.length ? text.charAt(index + 1) : "";
        if (!/[A-Za-z0-9_]/.test(before) && !/[A-Za-z0-9_]/.test(after)) return index;
        index = text.indexOf(value, index + 1);
    }
    return -1;
}

function inline(text: string): any[] | undefined {
    const terms = mathTerms
        .filter(([value]) => text.includes(value))
        .sort((a, b) => b[0].length - a[0].length);
    if (!terms.length) return undefined;
    const result: any[] = [];
    let cursor = 0;
    while (cursor < text.length) {
        let next: { index: number; value: string; latex: string } | undefined;
        for (const [value, latex] of terms) {
            const index = findTerm(text, value, cursor);
            if (
                index >= 0 &&
                (!next ||
                    index < next.index ||
                    (index === next.index && value.length > next.value.length))
            ) {
                next = { index, value, latex };
            }
        }
        if (!next) {
            result.push({ kind: "text", value: text.slice(cursor) });
            break;
        }
        if (next.index > cursor) {
            result.push({ kind: "text", value: text.slice(cursor, next.index) });
        }
        result.push({ kind: "math", value: next.value, latex: next.latex });
        cursor = next.index + next.value.length;
    }
    const filtered = result.filter(({ value }) => value);
    return filtered.some(({ kind }) => kind === "math") ? filtered : undefined;
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

type TextKind = "heading" | "paragraph" | "list-item" | "footnote";
type Block =
    | { kind: TextKind; page: number; text: string }
    | {
          kind: "formula-ref" | "figure-ref";
          page: number;
          asset: string;
          label: string;
          region?: any;
      };
type Unit = {
    number: string;
    title: string;
    page: number;
    blocks: Block[];
};
const p = (page: number, text: string): Block => ({
    kind: "paragraph",
    page,
    text,
});
const h = (page: number, text: string): Block => ({
    kind: "heading",
    page,
    text,
});
const formula = (page: number, number: string): Block => ({
    kind: "formula-ref",
    page,
    asset: assetId("formula", number),
    label: number,
});
const figure = (
    page: number,
    number: string,
    region: { x: number; y: number; width: number; height: number },
): Block => ({
    kind: "figure-ref",
    page,
    asset: assetId("figure", number),
    label: `Figura ${number}`,
    region: { coordinateSystem: "pdf-points-top-left", ...region },
});

const units: Unit[] = [
    {
        number: "C7.4",
        title: "COSTRUZIONI DI CALCESTRUZZO",
        page: 214,
        blocks: [
            p(214, "Per le costruzioni con struttura di calcestruzzo la norma contiene disposizioni specifiche a seconda del comportamento strutturale prescelto."),
            p(214, "Nel caso di comportamento strutturale non dissipativo si fa riferimento unicamente al § 4.1 delle NTC, senza nessun requisito aggiuntivo, a condizione che gli elementi strutturali siano progettati per rimanere in campo sostanzialmente elastico."),
            p(214, "Nel caso di comportamento strutturale dissipativo, i principi e i criteri della progettazione in capacità si applicano, in maniera estesa, alla progettazione di tutti gli elementi strutturali, poiché contribuiscono alla realizzazione di meccanismi ciclici inelastici dissipativi e globalmente stabili."),
            p(214, "Nell’ottica del perseguimento di un comportamento duttile, affidato a plasticizzazioni diffuse nelle zone a tal fine individuate (zone dissipative) la norma dà particolare risalto, per le costruzioni di calcestruzzo, al confinamento. È noto, infatti, che il confinamento migliora il comportamento del calcestruzzo in termini sia di resistenza, sia di duttilità. A questo scopo, al § 4.1.2.1.2, la norma fornisce un legame costitutivo parabola-rettangolo in grado di descrivere il comportamento del calcestruzzo confinato da armature trasversali. Tale legame può essere utilizzato, con riferimento al solo nucleo confinato, per il calcolo della capacità della sezione, in termini di resistenza e di duttilità."),
            p(214, "Per garantire un comportamento globalmente duttile, anche in considerazione dell’esigenza di contenere i fenomeni di degrado oligociclico e riduzione di rigidezza nelle zone dissipative, le verifiche di duttilità sono espressamente richieste nelle zone dissipative, sia degli elementi primari, sia degli elementi secondari."),
            p(214, "Un particolare riguardo è richiesto per le verifiche di duttilità nelle zone allo spiccato delle fondazioni di tutti i pilastri primari. Per questi elementi, la norma fornisce, in alternativa alle verifiche specifiche, anche delle espressioni semplificate per il calcolo delle armature trasversali in funzione della domanda di duttilità."),
            p(215, "In generale, per tutti gli elementi strutturali, la norma fornisce dettagli costruttivi finalizzati a garantire il comportamento desiderato a livello sia locale sia globale."),
            {
                kind: "footnote",
                page: 214,
                text: "Le verifiche sugli elementi strutturali si eseguono in termini di: rigidezza, per contenere le deformazioni indotte dal sisma e conseguentemente i danni sugli elementi non strutturali; resistenza, per soddisfare la domanda allo SLV, in condizioni ultime o sostanzialmente elastiche, a seconda che si faccia riferimento a un comportamento strutturale dissipativo o non dissipativo; duttilità, per garantire alla struttura la capacità di sostenere la domanda di spostamento allo SLC. Relativamente all’ultimo dei tre punti sopra elencati, per le strutture a telaio o a pareti, oltre ai dettagli costruttivi, sono previste specifiche verifiche di duttilità che riguardano gli elementi verticali primari allo spiccato delle fondazioni e per tutte le zone dissipative degli elementi strutturali secondari.",
            },
        ],
    },
    {
        number: "C7.4.2",
        title: "CARATTERISTICHE DEI MATERIALI",
        page: 215,
        blocks: [],
    },
    {
        number: "C7.4.2.1",
        title: "CONGLOMERATO",
        page: 215,
        blocks: [
            p(215, "Si consente l’impiego di calcestruzzi con aggregati leggeri purché di sufficiente resistenza."),
        ],
    },
    {
        number: "C7.4.3",
        title: "TIPOLOGIE STRUTTURALI E FATTORI DI COMPORTAMENTO",
        page: 215,
        blocks: [],
    },
    {
        number: "C7.4.3.1",
        title: "TIPOLOGIE STRUTTURALI",
        page: 215,
        blocks: [
            p(215, "La norma identifica le tipologie strutturali, classificandole essenzialmente in base alla tipologia delle strutture verticali che contribuiscono maggiormente alla resistenza laterale. Ciò significa che l’individuazione della tipologia è possibile, a rigore, solo a progettazione avvenuta e, considerato che i fattori di comportamento e dunque l’azione sismica di progetto dipendono proprio dalla tipologia, il processo dovrebbe essere di necessità iterativo."),
            p(215, "In realtà, almeno in prima battuta, per l’identificazione della tipologia strutturale, si può valutare la percentuale del taglio totale al piede agente su ciascun tipo di struttura verticale sismoresistente (telaio, parete, ecc.) a partire dalle rigidezze relative, quindi in base alla ripartizione delle sollecitazioni ottenuta attraverso un modello elastico. Sarebbe pertanto opportuno verificare, almeno a fine progettazione, la ripartizione delle resistenze rispetto alla resistenza a taglio totale, o comunque tenere debitamente conto delle eventuali incertezze nell’individuazione della tipologia strutturale ai fini della determinazione del fattore di comportamento."),
            p(215, "Le strutture dotate di rigidezza e/o resistenza torsionale basse sono deformabili torsionalmente; per tali tipologie strutturali occorre evitare o limitare, quanto più possibile, le eccentricità tra il centro di massa e il centro di rigidezza, in quanto l’attivazione di modi di vibrare torsionali può provocare amplificazioni significative degli effetti legati all’azione sismica. Qualora non si riesca, modificando opportunamente la geometria e la disposizione degli elementi strutturali, a ridurre la significatività dei modi torsionali, la norma tende a penalizzare la struttura, particolarmente nei telai perimetrali, per tener conto dell’incremento della domanda di duttilità dovuta alla torsione d’insieme."),
            p(215, "Da un punto di vista operativo, ciò si traduce in una riduzione significativa del fattore di comportamento e nel conseguente incremento dell’azione sismica di progetto. Secondo quanto prescritto al § 7.4.3.1, le strutture deformabili torsionalmente sono tipologie strutturali la cui rigidezza torsionale non soddisfa ad ogni piano la condizione r²/l_s² > 1."),
            p(215, "Il parametro r è il raggio torsionale, che può essere così calcolato:"),
            formula(215, "C7.4.1"),
            p(215, "dove: K_θ è la rigidezza torsionale di piano rispetto al centro di rigidezza; K è la maggiore tra le rigidezze di piano."),
            p(215, "Per la determinazione della rigidezza torsionale e flessionale di piano occorre considerare tutti gli elementi strutturali primari."),
            p(215, "Il parametro l_s è il raggio di inerzia delle masse, che è pari alla radice quadrata del rapporto tra il momento di inerzia polare della massa del piano, rispetto ad un asse verticale passante per il centro di massa, e la massa del piano stesso. Nel caso di pianta rettangolare e distribuzione uniforme delle masse, è valida la formulazione semplificata proposta dalla norma al § 7.4.3.1; tale espressione può essere estesa a tutte le strutture che rispettano i requisiti di regolarità in pianta, considerando L e B come le dimensioni medie dell’ingombro lungo le due direzioni principali."),
            p(215, "Alternativamente l’individuazione delle strutture deformabili torsionalmente può essere effettuata valutando il rapporto Ω tra i periodi dei modi di vibrare:"),
            formula(215, "C7.4.2"),
            p(215, "dove: T è il periodo traslazionale disaccoppiato; T_θ è il periodo torsionale disaccoppiato."),
            p(215, "Se Ω è maggiore di 1 la risposta è principalmente traslazionale, se inferiore ad 1 la risposta è dominata da un comportamento torsionale, dunque la struttura viene classificata come deformabile torsionalmente."),
        ],
    },
    {
        number: "C7.4.4",
        title:
            "DIMENSIONAMENTO E VERIFICA DEGLI ELEMENTI STRUTTURALI PRIMARI E SECONDARI",
        page: 216,
        blocks: [
            p(216, "L’analisi delle sollecitazioni è effettuata con riferimento alla combinazione sismica delle azioni specificata al § 2.5.3 delle NTC ed alla combinazione delle componenti orizzontali e verticali del sisma specificata al § 7.3.5 delle NTC (espressione [7.3.10]). Le verifiche di resistenza degli elementi strutturali si effettuano come indicato al § 4.1.2 delle NTC, dove si assumono, per tener conto del degrado ciclico dei materiali, gli stessi coefficienti parziali γ_C e γ_S delle condizioni non sismiche."),
            p(216, "Le verifiche di duttilità previste al § 7.4.4 delle NTC si intendono implicitamente soddisfatte se si seguono le regole per i materiali, i dettagli costruttivi e la progettazione in capacità indicate al § 7.4 delle NTC per le diverse tipologie ed elementi strutturali."),
            p(216, "Nella valutazione della duttilità di curvatura per le verifiche di duttilità nelle zone dissipative, il contributo in termini di resistenza e di duttilità dovuto al confinamento del calcestruzzo va considerato utilizzando modelli adeguati, così come specificato al Capitolo 4 delle NTC. A tal fine, la sola parte di calcestruzzo contenuta all’interno delle armature che garantiscono il confinamento può essere considerata efficacemente confinata."),
            p(216, "In condizioni sismiche, quando nell’elemento si formano cerniere duttili occorre assicurare che la riduzione di resistenza a taglio, legata alla domanda di duttilità in condizioni cicliche, non attivi un meccanismo combinato di taglio-flessione."),
            p(216, "Tale verifica deve essere eseguita almeno nelle zone dissipative degli elementi in cui sono attese con maggiore probabilità le plasticizzazioni, ovvero le sezioni di estremità delle travi, dei pilastri secondari e le sezioni allo spiccato dei pilastri primari e delle pareti."),
            p(216, "Si deve verificare che la capacità a taglio nell’elemento sia maggiore della corrispondente domanda valutata in base ai criteri della progettazione in capacità, con i fattori di sovraresistenza specifici per la classe di duttilità scelta."),
            p(216, "La capacità a taglio in condizioni cicliche, in funzione della domanda di duttilità, può essere determinata come indicato nei successivi paragrafi. Ciò comporta l’esecuzione di una ulteriore verifica a taglio, per garantire il raggiungimento della duttilità di rotazione delle zone dissipative senza che si attivi un meccanismo a taglio. Il quantitativo di armatura trasversale nelle zone dissipative sarà, pertanto, pari al valore massimo tra l’armatura trasversale a taglio, considerando il degrado ciclico di resistenza, e l’armatura trasversale per il confinamento, necessaria a conseguire una duttilità di curvatura maggiore di quella richiesta, coerentemente con il fattore di comportamento adottato."),
        ],
    },
    {
        number: "C7.4.4.1",
        title: "TRAVI",
        page: 216,
        blocks: [],
    },
    {
        number: "C7.4.4.1.1",
        title: "Verifiche di resistenza (RES)",
        page: 216,
        blocks: [
            h(216, "Taglio"),
            p(216, "Per il calcolo della domanda a taglio sulla trave, si può far riferimento allo schema di Figura C7.4.1, dove è rappresentato sia il caso di plasticizzazione delle sezioni di estremità delle travi (quando la somma dei momenti resistenti delle sezioni di estremità delle travi convergenti nel nodo è inferiore alla somma dei momenti resistenti delle sezioni di estremità dei pilastri convergenti nel medesimo nodo) sia il caso di plasticizzazione dei pilastri (quando la somma dei momenti resistenti delle sezioni di estremità delle travi convergenti nel nodo è superiore alla somma dei momenti resistenti delle sezioni di estremità dei pilastri convergenti nel medesimo nodo)."),
            p(216, "Si precisa che quest’ultima condizione potrebbe presentarsi in differenti situazioni, in accordo con i principi di progettazione in capacità e con le prescrizioni definite nel Capitolo 7 delle NTC, ad esempio in corrispondenza di pilastri trattati come elementi secondari oppure quando le travi appartengono all’ultimo orizzontamento."),
            figure(216, "C7.4.1", {
                x: 140,
                y: 530,
                width: 315,
                height: 155,
            }),
        ],
    },
    {
        number: "C7.4.4.1.2",
        title: "Verifiche di duttilità (DUT)",
        page: 216,
        blocks: [
            p(216, "Le verifiche di duttilità devono essere eseguite secondo quanto specificato al Capitolo 4 delle NTC."),
        ],
    },
    {
        number: "C7.4.4.2",
        title: "PILASTRI",
        page: 217,
        blocks: [],
    },
    {
        number: "C7.4.4.2.1",
        title: "Verifiche di resistenza (RES)",
        page: 217,
        blocks: [
            p(217, "La progettazione in capacità dei pilastri prevede, basandosi su considerazioni di equilibrio, che la somma dei momenti resistenti delle sezioni di estremità dei pilastri convergenti in un nodo sia maggiore della somma dei momenti resistenti delle sezioni di estremità delle travi convergenti nello stesso nodo, moltiplicati per un fattore di sovraresistenza."),
            p(217, "Dal punto di vista applicativo, per determinare le sollecitazioni di progetto in ciascuna sezione dei pilastri all’interfaccia col pannello nodale, si può ipotizzare che il rapporto tra i momenti flettenti nelle due sezioni considerate si mantenga invariato a seguito delle plasticizzazioni nelle travi; in tale ipotesi, il coefficiente moltiplicativo α da applicare ai momenti flettenti sui pilastri derivanti dall’analisi elastica vale:"),
            formula(217, "C7.4.3"),
            p(217, "con M_b,Rd momento resistente della generica trave convergente nel nodo e M_c,Ed momento di calcolo del generico pilastro convergente nel nodo; le sommatorie sono estese a tutte le travi e i pilastri concorrenti nel nodo. Se i momenti di calcolo nei due pilastri concorrenti al nodo sono discordi vale quanto detto al § 7.4.4.2.1 e descritto in Fig. 7.4.2 delle NTC, dunque al denominatore della [C7.4.3] va il solo valore maggiore, mentre il minore va sommato ai momenti resistenti delle travi."),
            p(217, "È opportuno sottolineare che l’utilizzo della formula [C7.4.3] rappresenta solo uno dei possibili modi per arrivare al rispetto della formula [7.4.4] delle NTC, unica condizione di norma da rispettare per proteggere i pilastri dalla plasticizzazione anticipata riducendo, in ossequio ai principi della progettazione in capacità, la domanda di duttilità su di essi. In questo caso, a parte le incertezze portate in conto attraverso il fattore di sovraresistenza, la progettazione in capacità non è in grado di impedire plasticizzazioni, seppur limitate, in alcuni pilastri."),
            p(217, "Nella realtà, infatti, a causa della variazione delle rigidezze relative fra gli elementi strutturali, quando la struttura entra in campo inelastico varia la distribuzione delle caratteristiche della sollecitazione all’interno della struttura. Può pertanto accadere che, pur mantenendosi inalterato l’equilibrio al nodo, una volta raggiunta la plasticizzazione nelle sezioni delle travi possa modificarsi, all’interfaccia del pannello nodale, il rapporto fra i momenti nelle sezioni dei pilastri convergenti nel medesimo nodo ovvero, in pratica, che uno dei due momenti dei pilastri possa crescere, potenzialmente fino alla plasticizzazione, e l’altro decrescere."),
            p(217, "Pertanto non è escluso che, pur avendo utilizzato le regole della progettazione in capacità, si possano verificare delle plasticizzazioni nelle zone di estremità di qualche pilastro. D’altra parte, scopo della progettazione in capacità è limitare il più possibile tale eventualità e, soprattutto, escludere la formazione di meccanismi globalmente instabili, quali ad esempio quelli che possono determinarsi a causa della plasticizzazione contemporanea, alla base ed in testa, di tutti i pilastri di uno stesso livello (meccanismi di piano)."),
            p(217, "Per i motivi detti, nelle zone dissipative di tutti i pilastri primari la norma aggiunge, all’utilizzo della progettazione in capacità, l’applicazione di specifici accorgimenti per la duttilità. Un riguardo maggiore è dato alle zone dissipative allo spiccato dei pilastri primari, che devono necessariamente plasticizzarsi affinché si possa formare il meccanismo globale desiderato, cioè quello che prevede la contemporanea plasticizzazione delle sezioni di estremità delle travi a tutti i livelli."),
            p(217, "Nella progettazione dei pilastri la norma prevede un approccio semplificato consentendo, per ciascuna direzione di applicazione del sisma, una verifica a presso-flessione retta purché la corrispondente capacità a flessione del pilastro venga considerata ridotta del 30%."),
            p(217, "Le sollecitazioni della domanda si riferiscono alle due combinazioni sismiche con direzioni prevalenti alternate, secondo le regole di combinazione direzionale illustrate al § 7.3.5 delle NTC. Quando si applica la progettazione in capacità, per ottenere la domanda a pressoflessione deviata su ciascuna sezione dei pilastri, si può procedere nel modo seguente."),
            p(217, "Per ciascuna combinazione direzionale, si determinano i rapporti tra i momenti flettenti lungo le direzioni principali della sezione considerata. Per ogni direzione principale della sezione, individuata la combinazione che massimizza la relativa componente di momento flettente, se ne incrementa il valore applicando le regole della progettazione in capacità, a partire dalla capacità delle travi convergenti nel nodo disposte lungo la direzione considerata. Si incrementa poi il momento nell’altra direzione, rispetto a quello ottenuto dall’analisi, in modo da mantenere invariato il rapporto tra le componenti. Si procede in analogia, massimizzando il momento lungo l’altra direzione principale della sezione. A partire dalla domanda a pressoflessione deviata nelle diverse combinazioni, associata ai corrispondenti valori del carico assiale, si eseguono le verifiche di resistenza."),
            h(217, "Taglio"),
            p(217, "Nella valutazione del taglio di calcolo attraverso la formula [7.4.5] delle NTC, M_i,d rappresenta la massima azione flettente trasmessa al pilastro, ove si tiene conto che le cerniere plastiche devono formarsi nelle zone estremali delle travi convergenti al nodo oppure (qualora si formino prima) nelle zone di estremità dei pilastri, come illustrato in Figura C7.4.2."),
            p(217, "L’utilizzo della [7.4.5] consente di individuare il massimo taglio agente sul pilastro nell’ipotesi che le sequenze di plasticizzazione siano coerenti con il meccanismo globale ipotizzato; nella valutazione del taglio di calcolo mediante l’espressione [7.4.5], la lunghezza del pilastro l_p è da valutarsi escludendo l’ingombro delle travi in esso confluenti."),
            figure(218, "C7.4.2", {
                x: 100,
                y: 90,
                width: 400,
                height: 300,
            }),
        ],
    },
    {
        number: "C7.4.4.2.2",
        title: "Verifiche di duttilità (DUT)",
        page: 218,
        blocks: [
            p(218, "Le verifiche di duttilità devono essere eseguite secondo quanto specificato al Capitolo 4 delle NTC. Per le zone dissipative allo spiccato dei pilastri primari e per le zone dissipative di tutti i pilastri secondari, al § 7.4.6.2.2 le NTC forniscono, in alternativa alle verifiche di duttilità, i quantitativi di armatura trasversale minimi in funzione della domanda di duttilità."),
        ],
    },
    {
        number: "C7.4.4.3",
        title: "NODI TRAVE-PILASTRO",
        page: 218,
        blocks: [
            p(218, "Il progetto dei nodi è essenziale, indipendentemente dal comportamento strutturale prescelto, perché la sollecitazione da taglio all’interno del pannello nodale (la zona di intersezione tra travi e pilastri) è decisamente più elevata dell’analoga sollecitazione nei pilastri. Lo stato tensionale all’interno del pannello nodale dipende, oltre che dalla geometria e dalle sollecitazioni derivanti dal calcolo elastico, dai quantitativi di armatura delle travi. Infatti gli sforzi di taglio all’interno del pannello nodale non possono essere determinati direttamente dal modello di calcolo ma richiedono specifiche analisi per determinare la trasmissione degli sforzi all’interno della zona diffusiva. È pertanto indispensabile, se si vogliono evitare rotture da taglio del nodo, ricorrere ai criteri della progettazione in capacità, in questo caso non legata al conseguimento di un comportamento duttile, ma indispensabile per il progetto della resistenza del pannello nodale, che deve garantire il trasferimento delle sollecitazioni tra gli elementi in esso convergenti."),
        ],
    },
    {
        number: "C7.4.4.3.1",
        title: "Verifiche di resistenza (RES)",
        page: 218,
        blocks: [
            p(218, "Le verifiche di resistenza dei nodi indicate nel presente paragrafo si applicano a strutture in CD “A” e, limitatamente ai nodi non interamente confinati, in CD “B”. Esse non si applicano alle strutture non dissipative."),
            p(218, "Per le verifiche di resistenza dei nodi trave-pilastro è richiesta l’identificazione della zona efficace ai fini del trasferimento delle sollecitazioni da un elemento strutturale all’altro. In Fig. C7.4.3 sono sintetizzate le limitazioni di norma per la determinazione delle dimensioni della zona efficace nelle due direzioni ortogonali. Le armature trasversali nelle due direzioni devono essere contenute all’interno della zona efficace."),
            figure(219, "C7.4.3", {
                x: 100,
                y: 85,
                width: 400,
                height: 305,
            }),
            p(219, "Per la verifica della capacità del nodo, relativamente alla massima trazione diagonale nel calcestruzzo, le NTC forniscono due formulazioni alternative. Attraverso l’uso della [7.4.10] si garantisce che le tensioni all’interno del pannello nodale non superino la resistenza a trazione del calcestruzzo, garantendo l’integrità del nodo; attraverso la [7.4.11] e la [7.4.12] la capacità del nodo è affidata interamente alle armature orizzontali, accettando dunque la fessurazione del nodo. Nel primo caso la verifica dipende dalle dimensioni del pannello nodale; nel secondo caso la verifica risulta indipendente da esse. È sufficiente che la verifica risulti soddisfatta per uno dei due approcci."),
            p(219, "Per la verifica di capacità del nodo è consigliabile l’utilizzo, nelle due direzioni di verifica del pannello nodale, dello stesso approccio, tra i due consentiti dalla norma."),
            p(219, "Nella valutazione di V_jbd, di cui alla Equazione [7.4.8], è possibile tenere direttamente conto del confinamento del calcestruzzo, così come indicato al § 4.1.2.1.2.1 delle NTC, ponendo α_j = 0,48 (f_ck,c / f_ck), avendo cura di considerare soltanto il volume di calcestruzzo effettivamente confinato."),
        ],
    },
    {
        number: "C7.4.4.4",
        title: "DIAFRAMMI ORIZZONTALI",
        page: 219,
        blocks: [],
    },
    {
        number: "C7.4.4.4.1",
        title: "Verifiche di resistenza (RES)",
        page: 219,
        blocks: [
            p(219, "Qualora la verifica indichi deformazioni sensibili dell’orizzontamento nel suo piano, non si può assumere l’ipotesi di diaframma rigido nell’analisi della struttura."),
        ],
    },
    {
        number: "C7.4.4.5",
        title: "PARETI",
        page: 219,
        blocks: [
            p(219, "Il presente paragrafo si applica alle verifiche sulle pareti, così come definite al § 7.4.4.5 delle NTC."),
            p(219, "Per le strutture di calcestruzzo debolmente armato ottenute con blocchi cassero, si applicano le “linee guida per sistemi costruttivi a pannelli portanti basati sull’impiego di blocchi cassero e calcestruzzo debolmente armato gettato in opera” emanate dal Consiglio Superiore dei Lavori Pubblici."),
        ],
    },
    {
        number: "C7.4.4.5.1",
        title: "Verifiche di resistenza (RES)",
        page: 219,
        blocks: [
            p(219, "Nella progettazione di strutture con pareti, la norma consente una ridistribuzione degli effetti dell’azione sismica fino al 30%, purché non si verifichi una riduzione della domanda totale di resistenza delle pareti stesse."),
            p(219, "La norma consente di ridistribuire momenti e tagli dalle pareti soggette a modesta compressione o a trazione semplice a quelle soggette a un’elevata compressione assiale, con la finalità di ottenere un comportamento dissipativo stabile."),
            p(219, "Nell’avvalersi della possibilità di ridistribuire tra le pareti gli effetti dell’azione sismica, il progettista dovrebbe considerare le variazioni della risposta d’insieme dovute alle ridistribuzioni, quali ad esempio le possibili eccentricità indotte da plasticizzazioni non uniformi nelle pareti, che potrebbero influire sulle condizioni di regolarità strutturale conseguite in fase di dimensionamento degli elementi strutturali."),
        ],
    },
    {
        number: "C7.4.4.5.2",
        title: "Verifiche di duttilità (DUT)",
        page: 220,
        blocks: [
            p(220, "Per le zone dissipative delle pareti, la norma prevede che vengano eseguite specifiche verifiche di duttilità. La domanda di duttilità in tali zone viene espressa, a livello di sezione, mediante il fattore di duttilità in curvatura μ_φ. Qualora non si proceda ad una determinazione diretta mediante analisi non lineare, tale domanda può essere valutata attribuendo a μ_φ i valori forniti dalle [7.4.3] del § 7.4.4.1.2 in cui il valore di q è ridotto del fattore M_Ed/M_Rd, dove M_Ed è il momento flettente di progetto alla base della parete fornito dall’analisi nella situazione sismica di progetto (domanda) e M_Rd è il momento resistente di calcolo (capacità)."),
            p(220, "Si noti che, nel caso in cui nella progettazione si ricorra alla ridistribuzione degli effetti tra le pareti, il fattore M_Ed/M_Rd può assumere valori maggiori dell’unità, comportando un conseguente incremento della domanda di duttilità nelle pareti progettate con valori del momento resistente inferiori alla corrispondente sollecitazione flessionale ottenuta dall’analisi."),
            p(220, "Le formule [7.4.32e] e [7.4.33] contenute al § 7.4.6.2.4 delle NTC consentono di determinare i quantitativi di armatura trasversale in funzione della domanda di duttilità; tali quantitativi sono da intendersi come minimi inderogabili solo nel caso in cui non vengano eseguite le verifiche di duttilità come indicato al § 7.4.4.5.2."),
        ],
    },
    {
        number: "C7.4.5",
        title: "COSTRUZIONI CON STRUTTURA PREFABBRICATA",
        page: 220,
        blocks: [],
    },
    {
        number: "C7.4.5.1",
        title: "TIPOLOGIE STRUTTURALI E FATTORI DI COMPORTAMENTO",
        page: 220,
        blocks: [
            p(220, "Il paragrafo 7.4.5.1 riporta le tipologie di sistemi strutturali previsti dalle NTC per le costruzioni con struttura prefabbricata. I relativi valori massimi di q_0 sono contenuti nella tabella 7.3.II."),
            p(220, "La norma prevede che altre tipologie possano essere utilizzate giustificando i fattori di comportamento adottati e impiegando regole di dettaglio tali da garantire i requisiti generali di sicurezza di cui alle presenti norme. Per tali tipologie i valori dei fattori di comportamento, non indicati dalle NTC, possono essere determinati sulla base di una opportuna campagna di prove e verifiche locali di duttilità e globali di spostamento allo SLV, utilizzando i medesimi principi indicati al § 7.3.1 in merito alla determinazione di q_0."),
        ],
    },
    {
        number: "C7.4.5.1.1",
        title: "Strutture a telaio",
        page: 220,
        blocks: [
            p(220, "Una prima categoria di sistemi a telaio prefabbricati si riferisce a strutture con collegamenti monolitici realizzati con getti integrativi che danno continuità di forze e momenti, ad emulazione delle strutture gettate in opera (v. Figura C7.4.4)."),
            figure(220, "C7.4.4", {
                x: 120,
                y: 405,
                width: 355,
                height: 140,
            }),
            p(220, "A questa categoria di telai si applicano le regole relative alle strutture in opera di cui al § 7.4 delle NTC. Il vincolo di base dei pilastri deve realizzare un incastro totale con la fondazione dimensionato con le regole delle strutture in opera di cui al § 7.4 o con le regole relative ai collegamenti tipo b) o tipo c) di cui al § 7.4.5.2.1 delle NTC."),
            p(220, "Una seconda categoria di sistemi prefabbricati a telaio si riferisce a strutture con collegamenti realizzati con dispositivi meccanici tra i vari elementi prefabbricati. A questa categoria di telai si applicano le regole relative ai collegamenti di cui al § 7.4.5.2.1 delle NTC. Il vincolo di base dei pilastri deve realizzare un incastro totale con la fondazione dimensionato con le regole delle strutture in opera di cui al § 7.4 o con le regole relative ai collegamenti tipo b) o tipo c) di cui al § 7.4.5.2.1 delle NTC."),
        ],
    },
    {
        number: "C7.4.5.1.2",
        title:
            "Strutture con pilastri incastrati alla base e orizzontamenti ad essi incernierati",
        page: 220,
        blocks: [
            p(220, "Nelle strutture con pilastri incastrati alla base ed orizzontamenti ad essi incernierati il collegamento a cerniera dà continuità di forze (v. Figura C7.4.5). A questa categoria di strutture, tipica della tecnologia della prefabbricazione, si applicano le regole relative ai collegamenti di cui al § 7.4.5.2.1 delle NTC, mentre il vincolo di base dei pilastri deve realizzare un incastro con la fondazione dimensionato con le regole delle strutture in opera di cui al § 7.4 o con le regole relative ai collegamenti tipo b) o tipo c) di cui al § 7.4.5.2.1 delle NTC."),
            figure(221, "C7.4.5", {
                x: 130,
                y: 85,
                width: 335,
                height: 145,
            }),
            p(221, "Per tali tipologie di strutture, oltre che in corrispondenza dei giunti come indicato al § 7.4.5.2, i collegamenti ad appoggio mobile sono consentiti, come indicato al § 7.4.5.2.1, per le sole strutture monopiano del tipo di quelle rappresentate in Figura C7.4.6, che consentono le libere dilatazioni della copertura per effetto di fenomeni come le variazioni termiche, concentrando le azioni orizzontali dovute al sisma su alcuni pilastri."),
            figure(221, "C7.4.6", {
                x: 140,
                y: 270,
                width: 320,
                height: 150,
            }),
        ],
    },
    {
        number: "C7.4.6",
        title: "DETTAGLI COSTRUTTIVI",
        page: 221,
        blocks: [],
    },
    {
        number: "C7.4.6.1",
        title: "LIMITAZIONI GEOMETRICHE",
        page: 221,
        blocks: [],
    },
    {
        number: "C7.4.6.1.2",
        title: "Pilastri",
        page: 221,
        blocks: [
            p(221, "Resta la limitazione sul valore massimo degli effetti del 2° ordine data al § 7.3.1 delle NTC (θ ≤ 0,3)."),
        ],
    },
    {
        number: "C7.4.6.2",
        title: "LIMITAZIONI DI ARMATURA",
        page: 221,
        blocks: [],
    },
    {
        number: "C7.4.6.2.3",
        title: "Nodi Trave-Pilastro",
        page: 221,
        blocks: [
            p(221, "Le NTC prevedono che, oltre a quanto richiesto dalla verifica nel § 7.4.4.3.1, lungo le armature longitudinali del pilastro che attraversano i nodi devono essere disposte staffe di contenimento in quantità almeno pari alla maggiore prevista nelle zone adiacenti al nodo del pilastro inferiore e superiore; nel caso di nodi interamente confinati il passo risultante dell’armatura di confinamento orizzontale nel nodo può essere raddoppiato, ma non può essere maggiore di 15 cm. Questo è un minimo inderogabile e non aggiuntivo rispetto a quanto previsto al § 7.4.4.3."),
        ],
    },
];

const formulas = [
    {
        number: "C7.4.1",
        unit: "C7.4.3.1",
        page: 215,
        latex: "r=\\sqrt{\\frac{K_\\theta}{K}}",
    },
    {
        number: "C7.4.2",
        unit: "C7.4.3.1",
        page: 215,
        latex: "\\Omega=\\frac{T}{T_\\theta}",
    },
    {
        number: "C7.4.3",
        unit: "C7.4.4.2.1",
        page: 217,
        latex:
            "\\alpha=\\frac{\\gamma_{Rd}\\sum M_{b,Rd}}{\\sum M_{c,Ed}}",
    },
];

const figures = [
    ["C7.4.1", "C7.4.4.1.1", 216, "Figura C7.4.1 – Equilibrio dei momenti per il calcolo delle sollecitazioni di taglio di progetto VEd nelle travi", [140, 530, 455, 685]],
    ["C7.4.2", "C7.4.4.2.1", 218, "Figura C7.4.2 – Equilibrio dei momenti per il calcolo delle sollecitazioni di taglio di progetto VEd nei pilastri", [100, 90, 500, 375]],
    ["C7.4.3", "C7.4.4.3.1", 219, "Figura C7.4.3 – Dimensione efficace dei nodi trave-pilastro", [100, 85, 500, 355]],
    ["C7.4.4", "C7.4.5.1.1", 220, "Figura C7.4.4 – Strutture a telaio con collegamenti monolitici", [120, 405, 475, 500]],
    ["C7.4.5", "C7.4.5.1.2", 221, "Figura C7.4.5 – Strutture con pilastri incastrati alla base ed orizzontamenti ad essi incernierati", [130, 85, 465, 230]],
    ["C7.4.6", "C7.4.5.1.2", 221, "Figura C7.4.6 – Strutture monopiano con pilastri secondari collegati con appoggi mobili", [140, 270, 460, 420]],
] as const;

const outputDirectory = join(root, "corpus", "units", "circ2019");
await mkdir(outputDirectory, { recursive: true });
const pages214To216Only = process.argv.includes("--pages-214-216");
const pages217To221Only = process.argv.includes("--pages-217-221");
const currentStepOnly = pages214To216Only || pages217To221Only;
const unitsToWrite = pages214To216Only
    ? units.filter(({ page }) => page <= 216)
    : pages217To221Only
      ? units.filter(({ page }) => page >= 217 && page <= 221)
      : units;
const knownNtcNumbers = new Set(
    (await readdir(join(root, "corpus", "units", "ntc2018")))
        .filter((name) => name.endsWith(".json"))
        .map((name) => name.slice(0, -5)),
);
for (const unit of unitsToWrite) {
    const id = unitId(unit.number);
    const hasNtcTarget = knownNtcNumbers.has(unit.number.slice(1));
    const headingText = `${unit.number} ${unit.title}`;
    const specs: Block[] = [
        { kind: "heading", page: unit.page, text: headingText },
        ...unit.blocks,
    ];
    const blocks = specs.map((block, index) => {
        const blockId =
            index === 0
                ? "block-heading"
                : `block-editorial-${String(index).padStart(3, "0")}`;
        if ("asset" in block) {
            return {
                blockId: `${id}#${blockId}`,
                kind: block.kind,
                origin: "official",
                assetId: block.asset,
                evidence: evidence(
                    block.page,
                    block.label,
                    block.region ?? null,
                ),
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
    const numberParts = unit.number
        .slice(1)
        .split(".")
        .map((part) => Number(part));
    const lower = unit.number.toLowerCase();
    const parentNumber = lower.split(".");
    parentNumber.pop();
    const ancestorIds = lower
        .split(".")
        .slice(1)
        .map((_, index) =>
            unitId(lower.split(".").slice(0, index + 1).join(".")),
        );
    const record = {
        $schema: "urn:structural-codes:schema:canonical-unit:v2",
        schemaVersion: "2.0.0-alpha.2",
        recordType: "canonical-unit",
        id,
        workId: "it-mit:circ:2019-01-21:7-csllpp",
        expressionId: "it-mit:circ:2019-01-21:7-csllpp:original-it",
        kind:
            numberParts.length === 2
                ? "section"
                : numberParts.length === 3
                  ? "paragraph"
                  : "subparagraph",
        numbering: {
            official: unit.number,
            sortKey: numberParts
                .map((part) => String(part).padStart(3, "0"))
                .join("."),
        },
        title: unit.title,
        titleBlockId: `${id}#block-heading`,
        hierarchy: {
            parentId: unitId(parentNumber.join(".")),
            ancestorIds,
            position: numberParts.at(-1),
        },
        validity: {
            from: null,
            to: null,
            status: "unknown",
            asOf: "2026-07-28",
        },
        blocks,
        citations: [],
        relations: hasNtcTarget
            ? [{
                relationId: `${id}#relation-001`,
                type: "clarifies",
                targetUnitId: `urn:structural-codes:it:unit:ntc2018:${unit.number.slice(1)}`,
                basis: "editorial",
                evidenceBlockIds: [`${id}#block-heading`],
                rationale:
                    "Corrispondenza proposta tra numerazione omologa della Circolare e delle NTC; richiede conferma umana sul contenuto completo.",
                review: {
                    status: "proposed",
                    reviewedBy: null,
                    reviewedAt: null,
                },
            }]
            : [],
        assets: {
            formulaIds: blocks
                .filter(({ kind }) => kind === "formula-ref")
                .map(({ assetId }: any) => assetId),
            tableIds: [],
            figureIds: blocks
                .filter(({ kind }) => kind === "figure-ref")
                .map(({ assetId }: any) => assetId),
        },
        workflow: {
            status: "extracted",
            createdBy: {
                actorId: "generator:circ74",
                kind: "script",
                toolVersion: profile,
            },
            createdAt: "2026-07-28T15:00:00Z",
            reviews: [],
            openIssues: [
                {
                    issueId: `circ2019-${lower.replaceAll(".", "-")}-source-review`,
                    type: "normalization-review",
                    severity: "blocking",
                    note: "Trascrizione manuale confrontata dal modello con il render ufficiale; resta obbligatoria la revisione umana indipendente.",
                },
                {
                    issueId: `circ2019-${lower.replaceAll(".", "-")}-missing-text-layer`,
                    type: "missing-region",
                    severity: "blocking",
                    note: "Il layer testuale ufficiale della pagina contiene solo intestazione e numero pagina; il testo è stato trascritto manualmente dal render PDF.",
                },
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
    await writeFile(
        join(outputDirectory, `${lower}.json`),
        `${JSON.stringify(record, null, 2)}\n`,
        "utf8",
    );
}

const manifest = {
    $schema: "urn:structural-codes:schema:asset-manifest:v2",
    schemaVersion: "2.0.0-alpha.1",
    recordType: "asset-manifest",
    document: "circ2019",
    section: "C7.4",
    sourceId,
    status: "transcribed-unreviewed",
    formulas: formulas.map(({ number, unit, page, latex }) => ({
        id: assetId("formula", number),
        unitId: unitId(unit),
        officialNumber: number,
        pdfPage: page,
        latex,
    })),
    tables: [],
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
if (!currentStepOnly) {
    await writeFile(
        join(root, "corpus", "assets", "circ2019", "7.4.json"),
        `${JSON.stringify(manifest, null, 2)}\n`,
        "utf8",
    );
}
console.log(
    `circ74: generated ${unitsToWrite.length} units${pages214To216Only ? " for PDF pages 214-216" : pages217To221Only ? " for PDF pages 217-221" : `, ${formulas.length} formulas and ${figures.length} figures`}`,
);
