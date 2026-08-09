/* eslint-disable @typescript-eslint/no-explicit-any */
import { createHash } from "node:crypto";
import { mkdir, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const sourceId = "circ-7-2019";
const profile = "circ76-step1-manual-render-transcription-0.1.0";
const asOf = "2026-08-09";
const unitId = (number: string): string =>
    `urn:structural-codes:it:unit:circ2019:${number.toLowerCase()}`;
const assetId = (kind: "formula" | "figure", number: string): string =>
    `urn:structural-codes:it:asset:${kind}:circ2019:${number.toLowerCase()}`;
const sha256 = (value: string): string =>
    createHash("sha256").update(value, "utf8").digest("hex");

const mathTerms: Array<[string, string]> = [
    ["V_wp,c,Rd", "V_{wp,c,Rd}"],
    ["V_wp,Sd", "V_{wp,Sd}"],
    ["N_pl,Rd", "N_{pl,Rd}"],
    ["N_Ed", "N_{Ed}"],
    ["A_s,l,totale", "A_{s,l,totale}"],
    ["b^+_eff", "b^+_{eff}"],
    ["M_l,Rd", "M_{l,Rd}"],
    ["V_l,Rd", "V_{l,Rd}"],
    ["F_c,max", "F_{c,max}"],
    ["F_Rd,1", "F_{Rd,1}"],
    ["F_Rd,2", "F_{Rd,2}"],
    ["F_Rd,3", "F_{Rd,3}"],
    ["F_b,yd", "F_{b,yd}"],
    ["F_sc", "F_{sc}"],
    ["d_eff", "d_{eff}"],
    ["f_yd,T", "f_{yd,T}"],
    ["f_yd", "f_{yd}"],
    ["f_cd", "f_{cd}"],
    ["f_ck", "f_{ck}"],
    ["b_b", "b_b"],
    ["h_c", "h_c"],
    ["l_b", "l_b"],
    ["A_T", "A_T"],
    ["A_r", "A_r"],
    ["A_c", "A_c"],
    ["b_c", "b_c"],
    ["t_w", "t_w"],
    ["t_f", "t_f"],
    ["q_0", "q_0"],
    ["0,15L", "0{,}15L"],
    ["L = b_b + 4 h_c + 2 l_b", "L=b_b+4h_c+2l_b"],
    ["θ", "\\theta"],
    ["ν", "\\nu"],
    ["σ", "\\sigma"],
    ["e ≤ 2M_l,Rd/V_l,Rd", "e\\le2M_{l,Rd}/V_{l,Rd}"],
    ["e ≤ M_l,Rd/V_l,Rd", "e\\le M_{l,Rd}/V_{l,Rd}"],
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
    | {
          kind: "formula-ref" | "figure-ref";
          page: number;
          asset: string;
          label: string;
          region?: any;
      };
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
        number: "C7.6",
        title: "COSTRUZIONI COMPOSTE DI ACCIAIO-CALCESTRUZZO",
        page: 224,
        blocks: [
            p(224, "Le regole integrative di progettazione ed esecuzione, per l’impiego in zona sismica, delle costruzioni composte acciaio-calcestruzzo sono, per larga parte, analoghe a quelle delle corrispondenti strutture metalliche; tuttavia sono previste regole specifiche aggiuntive per quanto riguarda la disposizione delle armature in soletta in prossimità dei nodi trave-pilastro e la progettazione dei pannelli nodali delle strutture intelaiate, poiché i collegamenti trave-pilastro devono essere progettati considerando una gerarchia di resistenze che determini la plasticizzazione nell’elemento trave."),
            p(224, "Nel caso del nodo composto la resistenza è fortemente influenzata dalla capacità di trasferimento delle forze dalla soletta alla colonna e dalla resistenza del pannello nodale che può essere in solo acciaio o riempito di calcestruzzo."),
            p(224, "Nel seguito sono illustrati i meccanismi resistenti che si possono attivare nella zona del nodo composto e quindi il tipo di dettagli costruttivi cui si deve fare riferimento; per quanto riguarda ulteriori regole e formule di progetto si rimanda a normative di comprovata validità."),
        ],
    },
    {
        number: "C7.6.4",
        title: "CRITERI DI PROGETTO E DETTAGLI PER STRUTTURE DISSIPATIVE",
        page: 225,
        blocks: [],
    },
    {
        number: "C7.6.4.5",
        title: "COLLEGAMENTI COMPOSTI NELLE ZONE DISSIPATIVE",
        page: 225,
        blocks: [
            p(225, "I meccanismi che si attivano nelle zone di nodo tra la trave composta e la colonna composta o in acciaio possono essere divisi in base al segno del momento flettente trasferito dalla trave e ad alcuni dettagli costruttivi nella zona nodale."),
            p(225, "In particolare, per il nodo esterno, la differenza fondamentale è dovuta alla presenza o meno di una mensola esterna e della trave trasversale (Figura C7.6.1); inoltre nelle zone dissipative delle travi soggette a momento negativo, occorre predisporre armatura metallica ad elevata duttilità, così come schematicamente riportato in Figura C7.6.1."),
            figure(225, "C7.6.1", { x: 145, y: 200, width: 330, height: 140 }),
            p(225, "La disposizione delle barre d’armatura presentata in Figura C7.6.1 è efficace solo nel caso in cui la connessione tra trave e colonna sia sufficientemente rigida da consentire lo svilupparsi delle cerniere plastiche all’interno delle travi composte."),
            p(225, "Nel caso si utilizzino collegamenti metallici trave-colonna a parziale ripristino di resistenza e semi-rigidi per una ottimale distribuzione delle tensioni e per evitare un prematuro collasso della porzione di soletta soggetta a compressione è necessario eseguire una opportuna qualifica, per via sperimentale e/o numerica, del collegamento e progettare su tale base la disposizione dell’armatura in soletta."),
            p(225, "Le cerniere plastiche all’interno della trave composta devono avere un comportamento duttile, per cui nel disporre l’armatura di rinforzo in corrispondenza dei nodi trave-colonna composti è necessario:"),
            li(225, "eliminare tutti i possibili fenomeni di instabilità dell’equilibrio nei componenti in acciaio e nelle armature;"),
            li(225, "evitare la prematura rottura della soletta in calcestruzzo a contatto con la colonna composta."),
            p(225, "Per il calcolo delle armature necessarie in soletta devono essere utilizzati metodi di calcolo basati su schemi di equilibrio “puntone-tirante”. Inoltre, per favorire una migliore diffusione della sollecitazione di compressione dalla colonna composta alla soletta, è possibile predisporre una piastra supplementare saldata sull’ala interna della colonna e di larghezza maggiore di quest’ultima, in modo da incrementare la porzione di soletta collaborante nel trasferimento delle sollecitazioni in condizioni sismiche."),
        ],
    },
    {
        number: "C7.6.4.5.1",
        title: "MODELLI RESISTENTI PER LA SOLETTA SOGGETTA A COMPRESSIONE",
        page: 225,
        blocks: [
            p(225, "La configurazione di tutti i meccanismi che si possono attivare in un nodo esterno è illustrata nella Figura C7.6.2, per il caso di momento positivo (a) e di momento negativo (b)."),
            figure(225, "C7.6.2", { x: 100, y: 545, width: 450, height: 150 }),
            p(225, "Nel caso di nodi trave-colonna in acciaio, rigidi ed a completo ripristino di resistenza, si osserva che la compressione trasferibile dalla soletta alla colonna (Figura C7.6.2 a) avviene per contatto diretto della soletta sull’ala della colonna, mediante meccanismi"),
            p(226, "resistenti puntone-tirante in corrispondenza dell’anima della colonna, nel caso in cui sia stata realizzata la mensola esterna, con trasferimento sui connettori della trave trasversale, qualora questa sia presente."),
            p(226, "Anche quando la trave trasferisce momento negativo (Figura C7.6.2 b), i meccanismi dipendono dalla configurazione del calcestruzzo nella zona di nodo. Se la soletta termina al filo interno della colonna non si può sviluppare alcun meccanismo e quindi la resistenza del nodo si valuta considerando solo la parte in acciaio; se invece si realizza la mensola esterna e si dispone l’armatura circondando la colonna si forma un sistema di puntoni e tiranti; nel caso in cui sia presente una trave trasversale dotata di armatura a taglio si può realizzare un trasferimento diretto ancorando l’armatura tesa ai pioli."),
            p(226, "Sulla base di quanto illustrato, in presenza di momento positivo si possono individuare tre meccanismi di trasferimento della compressione dalla soletta alla colonna, che possono essere sommati:"),
            li(226, "meccanismo 1 – compressione diretta sull’ala della colonna;"),
            li(226, "meccanismo 2 – puntoni inclinati verso l’anima della colonna."),
            li(226, "meccanismo 3 – compressione sui pioli della trave trasversale"),
            figure(226, "C7.6.3", { x: 140, y: 250, width: 410, height: 185 }),
            p(226, "La forza trasmessa alla colonna dal meccanismo 1 (Figura C7.6.3), si calcola come segue:"),
            formula(226, "C7.6.1"),
            p(226, "dove d_eff e b_b sono, rispettivamente, lo spessore e la larghezza della sezione della soletta a contatto con la colonna. Nel caso di soletta realizzata con lamiera grecata d_eff è lo spessore del calcestruzzo al di sopra delle greche. Per il completo sviluppo della resistenza F_Rd,1 è necessario disporre un quantitativo minimo di armatura di “confinamento” la cui area complessiva deve rispettare la disuguaglianza:"),
            formula(226, "C7.6.2"),
            p(226, "dove f_yd,T è la tensione di snervamento di progetto dell’armatura trasversale disposta in prossimità della colonna ed l è la luce della trave composta collegata al nodo trave-colonna. La prima barra di armatura trasversale o rete elettrosaldata (se considerata nel calcolo) deve essere posta a non più di 30 mm dalla colonna composta."),
            p(226, "La forza trasmessa alla colonna dal meccanismo 2 (Figura C7.6.3), è pari a:"),
            formula(226, "C7.6.3"),
            p(226, "dove h_c è l’altezza della sezione della colonna. Affinché possano formarsi i due puntoni inclinati del meccanismo 2 è necessario disporre un quantitativo di armatura minimo pari a:"),
            formula(226, "C7.6.4"),
            p(226, "Tale armatura deve essere distribuita su una lunghezza uguale all’altezza h_c della sezione della colonna e le barre trasversali d’armatura impiegate devono avere una lunghezza almeno pari a L = b_b + 4 h_c + 2 l_b, dove l_b è la lunghezza d’ancoraggio necessaria affinché la singola barra di armatura possa sviluppare la sua tensione di snervamento f_yd,T"),
            p(227, "La massima compressione F_c,max trasferibile dalla trave composta alla colonna in un nodo trave-colonna esterno in assenza di trave trasversale e soggetta a momento flettente positivo, è dunque pari a:"),
            formula(227, "C7.6.5"),
            p(227, "Per quanto riguarda il contributo del meccanismo 3, da considerare in caso di travi trasversale collegata con pioli alla soletta, si rimanda al caso del nodo interno trattato successivamente poiché è analogo anche per il nodo esterno."),
            p(227, "Nel caso di nodo esterno soggetto a momento negativo, i meccanismi presentati nella figura C7.6.2b si attivano solo in presenza di mensola esterna e possono essere ancora distinti come meccanismo 1, di compressione diretta sull’ala della colonna, meccanismo 2, di diffusione verso l’anima della colonna, meccanismo 3, di ancoraggio dell’armatura quando è presente la trave trasversale."),
            p(227, "Si deve rilevare che nel caso di momento negativo la larghezza efficace della trave nella zona di nodo è determinata dall’angolo di diffusione θ delle bielle che si formano nella mensola, dipendenti dalla geometria dell’armatura posizionata nella mensola stessa, e in presenza di travi trasversale, dalla zona in cui sono ancorate le barre longitudinali ai pioli."),
            p(227, "Pertanto la larghezza efficace della trave per il caso in esame di nodo esterno a momento negativo si deve definire come il minimo tra quella determinata dal suddetto dettaglio costruttivo e quella riportata dalla Tabella 7.6.IV delle NTC."),
            p(227, "Nei nodi trave colonna interni appartenenti a telai progettati per avere un comportamento dissipativo, è necessario limitare la massima forza di compressione trasmissibile alla colonna con i meccanismi 1 e 2. L’assumere in fase di progetto un comportamento dissipativo per una struttura a telaio, impone infatti lo sviluppo delle cerniere plastiche all’estremità delle travi composte; per tale motivo, la massima compressione trasferibile alla colonna dalla trave soggetta a momento flettente positivo deve essere limitata in ragione della della massima trazione che le barre d’armatura trasferiscono alla colonna dalla trave soggetta a momento flettente negativo, come mostrato in Figura C7.6.4."),
            p(227, "In tal caso, considerando che si raggiunga lo snervamento delle armature prima della crisi del calcestruzzo, la massima compressione F_c,max trasferibile alla colonna dalla trave composta è pari a:"),
            formula(227, "C7.6.6"),
            p(227, "dove 2·F_b,yd è la forza complessiva dovuta allo snervamento delle barre longitudinali disposte sul lato teso della soletta che circonda la colonna composta."),
            figure(227, "C7.6.4", { x: 80, y: 410, width: 450, height: 240 }),
            p(227, "La presenza delle travi secondarie o di travi di bordo meccanicamente connesse con la soletta può rendere possibile un ulteriore meccanismo di trasferimento delle sollecitazioni di compressione (meccanismo 3), utile specialmente nei nodi trave-colonna interni al telaio ed in cui si abbia la presenza delle barre d’armatura in trazione. L’attivazione di questo meccanismo resistente è infatti assicurata dalla resistenza a taglio dei connettori disposti sull’ala superiore della trave secondaria e ricadenti all’interno di una zona di soletta larga 0,15L (Figura C7.6.5) con L luce della trave."),
            p(227, "La resistenza del meccanismo 3 è pari a:"),
            formula(228, "C7.6.7"),
            p(228, "dove n è il numero dei connettori a taglio presenti all’interno della larghezza collaborante 0,15L mentre P_Rd è la resistenza a taglio del singolo connettore impiegato."),
            figure(228, "C7.6.5", { x: 100, y: 155, width: 400, height: 225 }),
            p(228, "In conclusione:"),
            li(228, "per i nodi trave-colonna perimetrali al telaio, in cui concorre una sola trave composta, la compressione massima F_c,max trasferibile dalla soletta della trave composta alla colonna, considerando la collaborazione delle travi secondarie connesse a taglio alla soletta, è pari a:"),
            formula(228, "C7.6.8"),
            li(228, "per i nodi trave-colonna interni al telaio, in cui concorrono due travi composte, la compressione massima F_c,max trasferibile dalla soletta della trave composta alla colonna è pari a:"),
            formula(228, "C7.6.9"),
            p(228, "Al fine di poter ritenere il giunto composto a completo ripristino di resistenza è necessario che:"),
            li(228, "a) Il giunto metallico sia sovraresistente a flessione rispetto alla trave metallica (nel rispetto della gerarchia delle resistenze) considerando entrambi i segni del momento flettente. Il pannello d’anima della colonna deve essere sovraresistente a taglio (vedere punto C7.6.4.5.2);"),
            li(228, "b) La compressione F_c,max calcolata come ai punti precedenti in funzione della posizione del giunto (interno o esterno) sia maggiore della massima compressione trasmissibile dalla soletta della trave pari a:"),
            formula(228, "C7.6.10"),
            p(228, "con b^+_eff pari alla larghezza efficace della trave per il caso in esame di nodo soggetto a momento positivo riportata in Tabella 7.6.IV delle NTC;"),
            li(228, "c) La compressione F_c,max calcolata come ai punti precedenti in un giunto esterno soggetto a momento negativo (Figura C7.6.2 b) sia maggiore della massima trazione trasmissibile dalla soletta pari a:"),
            formula(228, "C7.6.11"),
            p(228, "dove A_s,l,totale rappresenta l’armatura longitudinale contenuta all’interno della larghezza efficace della trave a momento negativo riportata in Tabella 7.6.IV delle NTC;"),
            p(228, "Tale metodo di calcolo è valido solo per i nodi, presentati in questo paragrafo e cioè nodi a completo ripristino di resistenza e rigidi, con colonna parzialmente o completamente rivestita di calcestruzzo e con/senza travi secondarie."),
            p(228, "Nel caso si utilizzino colonne di differente geometria o particolari sistemi di connessione tra gli elementi di acciaio concorrenti nel nodo e la soletta, si deve fare riferimento ad altre normative o a documentazione tecnica di comprovata validità."),
        ],
    },
    {
        number: "C7.6.4.5.2",
        title: "RESISTENZA DEI PANNELLI D’ANIMA DELLE COLONNE COMPOSTE",
        page: 229,
        blocks: [
            p(229, "La resistenza a taglio del pannello d’anima, nel caso dei profili composti parzialmente rivestiti, può essere valutata considerando anche il contributo resistente della parte in calcestruzzo localizzata a livello del nodo trave-colonna. Il taglio sollecitante agente sul pannello, V_wp,Sd deve essere calcolato considerando la situazione di maggior cimento. In particolare, sotto azioni sismiche, il pannello d’anima della colonna composta deve consentire lo sviluppo del meccanismo dissipativo globale a telaio assunto in fase di progettazione. Per tale ragione è necessario che la forza di taglio trasmessa dalle travi al pannello d’anima della colonna sia calcolata in condizioni di collasso, secondo lo schema proposto in § C7.5.4.4 per le strutture metalliche."),
            p(229, "Per una colonna il contributo del riempimento in calcestruzzo della sezione, V_wp,c,Rd può essere calcolato utilizzando normative e documentazione tecnica di comprovata affidabilità. In alternativa, nel caso delle colonne completamente o parzialmente rivestite, è possibile calcolare tale contributo tramite la formula"),
            formula(229, "C7.6.12"),
            p(229, "dove A_c rappresenta l’area della sezione del puntone inclinato che si forma, a livello del pannello d’anima della colonna, tra la linea d’azione della risultante delle forze di compressione e la linea d’azione della risultante delle forze di trazione ambedue trasmesse dalla trave composta alla colonna, come mostrato in Figura C7.6.6. L’area della sezione del puntone inclinato è pari a:"),
            formula(229, "C7.6.13"),
            p(229, "dove b_c è la larghezza del rivestimento in calcestruzzo, h è l’altezza della sezione della colonna, t_f e t_w sono, rispettivamente, lo spessore della flangia e dell’anima del profilo in acciaio, mentre z è il braccio di coppia interna, misurato tra la linea d’azione della risultante delle compressioni e la linea d’azione della risultante delle trazioni trasmesse dal collegamento trave-colonna al pannello nodale."),
            figure(229, "C7.6.6", { x: 40, y: 360, width: 515, height: 135 }),
            p(229, "Il fattore ν tiene in conto gli effetti della compressione assiale presente nella colonna riducendo, opportunamente, la resistenza del rivestimento in calcestruzzo in ragione del livello di sforzo presente. Tale coefficiente può essere determinato tramite la formula:"),
            formula(229, "C7.6.14"),
        ],
    },
    {
        number: "C7.6.7",
        title: "REGOLE SPECIFICHE PER STRUTTURE CON CONTROVENTI CONCENTRICI",
        page: 229,
        blocks: [
            p(229, "I controventi dovrebbero essere realizzati utilizzando unicamente elementi in acciaio, seguendo in tal modo tutte le indicazioni progettuali fornite in § 7.5.5 delle NTC ed in § C7.5.5."),
        ],
    },
    {
        number: "C7.6.8",
        title: "CONTROVENTI ECCENTRICI",
        page: 229,
        blocks: [
            p(229, "I telai composti forniti di un sistema resistente a controventi eccentrici dovrebbero essere progettati in modo da dissipare l’energia sismica essenzialmente per cicli deformativi plastici di taglio del link mantenendo in campo elastico tutti i restanti elementi. Per la sezione del link, qualora sia composta, deve essere garantita la collaborazione tra sezione in acciaio e soletta e deve essere spiegato come viene garantito il ripristino."),
            p(229, "L’elemento di connessione deve essere di lunghezza corta o limitata, perciò la sua luce massima deve rispettare le seguenti limitazioni:"),
            li(229, "nel caso in cui si consideri lo sviluppo di due cerniere plastiche all’estremità dell’elemento di connessione e ≤ 2M_l,Rd/V_l,Rd"),
            li(230, "nel caso in cui si consideri lo sviluppo di una sola cerniera plastica all’interno dell’elemento di connessione e ≤ M_l,Rd/V_l,Rd"),
            p(230, "dove M_l,Rd e V_l,Rd sono, rispettivamente, il momento resistente ed il taglio resistente della sezione del profilo in acciaio nella zona del link, calcolati secondo le formule riportate nel §7.5.6 delle NTC, trascurando perciò il contributo della soletta."),
        ],
    },
];

const formulas = [
    ["C7.6.1", "C7.6.4.5.1", 226, "F_{Rd,1}=d_{eff}\\,b_b\\,f_{cd}"],
    ["C7.6.2", "C7.6.4.5.1", 226, "A_r\\ge0{,}25\\,d_{eff}\\,b_b\\,\\frac{0{,}15l-b_b}{0{,}15l}\\,\\frac{f_{cd}}{f_{yd,T}}"],
    ["C7.6.3", "C7.6.4.5.1", 226, "F_{Rd,2}=0{,}7\\,h_c\\,d_{eff}\\,f_{cd}"],
    ["C7.6.4", "C7.6.4.5.1", 226, "A_T\\ge\\frac{F_{Rd,2}}{2\\,f_{yd,T}}"],
    ["C7.6.5", "C7.6.4.5.1", 227, "F_{c,max}=F_{Rd,1}+F_{Rd,2}=(0{,}7\\,h_c+b_b)\\,d_{eff}\\,f_{cd}"],
    ["C7.6.6", "C7.6.4.5.1", 227, "F_{c,max}=F_{Rd,1}+F_{Rd,2}-2\\,F_{b,yd}"],
    ["C7.6.7", "C7.6.4.5.2", 228, "F_{Rd,3}=n\\,P_{Rd}"],
    ["C7.6.8", "C7.6.4.5.2", 228, "F_{c,max}=F_{Rd,1}+F_{Rd,2}+F_{Rd,3}=n\\,P_{Rd}+(0{,}7\\,h_c+b_b)\\,d_{eff}\\,f_{cd}"],
    ["C7.6.9", "C7.6.4.5.2", 228, "F_{c,max}=F_{Rd,1}+F_{Rd,2}+F_{Rd,3}-2\\,F_{b,yd}=n\\,P_{Rd}+(0{,}7\\,h_c+b_b)\\,d_{eff}\\,f_{cd}-A_{s,l,totale}\\,f_{yd}"],
    ["C7.6.10", "C7.6.4.5.2", 228, "F_{sc}=b^+_{eff}\\,d_{eff}\\,(0{,}85\\,f_{ck}/\\gamma_c)"],
    ["C7.6.11", "C7.6.4.5.2", 228, "F_{st}=A_{s,l,totale}\\,f_{yd}"],
    ["C7.6.12", "C7.6.4.5.2", 229, "V_{wp,c,Rd}=0{,}85\\,\\nu\\,A_c\\,f_{cd}\\,\\sin(\\theta)"],
    ["C7.6.13", "C7.6.4.5.2", 229, "A_c=0{,}8\\,(b_c-t_w)\\,(h-2t_f)\\cos(\\theta),\\quad \\theta=\\arctan\\left(\\frac{h-2t_f}{z}\\right)"],
    ["C7.6.14", "C7.6.4.5.2", 229, "\\nu=0{,}55\\left(1+2\\frac{N_{Ed}}{N_{pl,Rd}}\\right)\\le1"],
] as const;

const figures = [
    ["C7.6.1", "C7.6.4.5", 225, "Figura C7.6.1 - Dettagli di armatura in corrispondenza dei nodi trave-colonna", [145, 200, 475, 340]],
    ["C7.6.2", "C7.6.4.5.1", 225, "Figura C7.6.2 - Meccanismi attivabili nella soletta: a) Soletta compressa (momento positivo); b) Soletta tesa (momento negativo)", [100, 545, 550, 695]],
    ["C7.6.3", "C7.6.4.5.1", 226, "Figura C7.6.3 - Vista in pianta dei meccanismi resistenti attivabili nella soletta compressa (momento positivo)", [140, 250, 550, 435]],
    ["C7.6.4", "C7.6.4.5.1", 227, "Figura C7.6.4 - Distribuzione a SLU sotto azioni sismiche, delle massime resistenze agenti nella soletta del nodo.", [80, 410, 530, 650]],
    ["C7.6.5", "C7.6.4.5.1", 228, "Figura C7.6.5 - Meccanismo 3 – Connettori a taglio sulle travi secondarie", [100, 155, 500, 380]],
    ["C7.6.6", "C7.6.4.5.2", 229, "Figura C7.6.6 - Definizione del braccio di coppia interno Z e rappresentazione del puntone di calcestruzzo attivo nell’assorbire le sollecitazioni di taglio", [40, 360, 555, 495]],
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
        numbering: {
            official: unit.number,
            sortKey: numberParts.map((part) => String(part).padStart(3, "0")).join("."),
        },
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
            createdBy: { actorId: "generator:circ76-step1", kind: "script", toolVersion: profile },
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
    section: "C7.6",
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
await writeFile(join(root, "corpus", "assets", "circ2019", "7.6.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(`circ76-step1: generated ${units.length} units, ${formulas.length} formulas and ${figures.length} figures`);
