/* eslint-disable @typescript-eslint/no-explicit-any */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const root = fileURLToPath(new URL("../", import.meta.url));
const sourceId = "gu-so8-2018-ntc";
const workId = "it-mit:dm:2018-01-17:ntc2018";
const expressionId = "it-mit:dm:2018-01-17:ntc2018:original-it";
const ruleVersion = "ntc5-editorial-profile-0.1.0";
const createdAt = "2026-08-09T00:00:00Z";
const unitId = (n: string) => `urn:structural-codes:it:unit:ntc2018:${n}`;
const asset = (kind: "formula" | "table" | "figure", suffix: string) => `urn:structural-codes:it:asset:${kind}:ntc2018:${suffix}`;
const sha256 = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");

type Inline = { kind: "text"; value: string } | { kind: "math"; value: string; latex: string };
type Block = { kind: "heading" | "paragraph" | "list-item" | "formula-ref" | "table-ref" | "figure-ref"; page: number; text?: string; raw?: string; assetId?: string; inline?: Inline[] };
type UnitDef = { number: string; title: string; blocks: Block[] };

function inlineMath(text: string, page: number): Inline[] {
    const quantityLatex = (value: string): string => {
        const match = value.match(/^([+-]?\d+(?:,\d+)?)\s*(kN\/m²|kN\/m|kN|km\/h|m\/s²|m\/s|°C|mm|m)$/u);
        if (!match) return value;
        const rawNumber = match[1] as string;
        const rawUnit = match[2] as string;
        const number = rawNumber.replace(",", "{,}");
        if (rawUnit === "°C") return `${number}\\,{}^\\circ\\mathrm{C}`;
        const units: Record<string, string> = { "kN/m²": "kN/m^2", "kN/m": "kN/m", kN: "kN", "km/h": "km/h", "m/s²": "m/s^2", "m/s": "m/s", mm: "mm", m: "m" };
        return `${number}\\,\\mathrm{${units[rawUnit]}}`;
    };
    const patterns: Array<[RegExp, string | ((value: string) => string)]> = page === 171 ? [
        [/Φ₂/g, "\\Phi_2"], [/Φ₃/g, "\\Phi_3"], [/LΦ/g, "L_{\\Phi}"], [/δ₀/g, "\\delta_0"],
        [/\d+(?:,\d+)?\s*kN\/m²/g, (value) => value.replace(/\s*kN\/m²/u, "").replace(",", "{,}") + "\\,\\mathrm{kN/m^2}"],
        [/\d+(?:,\d+)?\s*km\/h/g, (value) => value.replace(/\s*km\/h/u, "").replace(",", "{,}") + "\\,\\mathrm{km/h}"],
        [/\d+(?:,\d+)?\s*mm/g, (value) => value.replace(/\s*mm/u, "").replace(",", "{,}") + "\\,\\mathrm{mm}"],
        [/\bmm\b/g, "\\mathrm{mm}"], [/\bL\b/g, "L"], [/n₀/g, "n_0"], [/Φ/g, "\\Phi"],
        [/Qla,k/g, "Q_{la,k}"], [/Qlb,k/g, "Q_{lb,k}"], [/qA1d/g, "q_{A1d}"], [/qA2d/g, "q_{A2d}"],
        [/Qsk/g, "Q_{sk}"], [/Qtk/g, "Q_{tk}"], [/qtk/g, "q_{tk}"], [/Qvk/g, "Q_{vk}"], [/qvk/g, "q_{vk}"],
        [/q1k/g, "q_{1k}"], [/q2k/g, "q_{2k}"], [/q3k/g, "q_{3k}"], [/q4k/g, "q_{4k}"],
        [/Φ2/g, "\\Phi_2"], [/Φ3/g, "\\Phi_3"], [/Φrid/g, "\\Phi_{rid}"], [/α/g, "\\alpha"], [/Ψ2/g, "\\Psi_2"],
        [/Lf/g, "L_f"], [/δ0/g, "\\delta_0"], [/Qvi/g, "Q_{vi}"], [/Ed/g, "E_d"], [/Rd/g, "R_d"], [/Cd/g, "C_d"], [/\bD\b/g, "D"],
    ] : [
        [/Qtk-qtk/g, "Q_{tk}\\!-\\!q_{tk}"], [/Qvk-qvk/g, "Q_{vk}\\!-\\!q_{vk}"],
        [/Qsk = 100 kN/g, "Q_{sk}=100\\,\\mathrm{kN}"], [/α>1/g, "\\alpha>1"],
        [/qA1d = 60 kN\/m/g, "q_{A1d}=60\\,\\mathrm{kN/m}"],
        [/qA2d = 80 kN\/m · 1,4/g, "q_{A2d}=80\\,\\mathrm{kN/m}\\cdot1{,}4"],
        [/max ag = 6,0 m/g, "\\max a_g=6{,}0\\,\\mathrm{m}"], [/max ag > 6 m/g, "\\max a_g>6\\,\\mathrm{m}"],
        [/ψ0i=1,0/g, "\\psi_{0i}=1{,}0"], [/Ψ2 = 0,2/g, "\\Psi_2=0{,}2"], [/λ ≤ 30/g, "\\lambda\\le30"],
        [/f\(V\) = f\(300\)/g, "f(V)=f(300)"], [/120 ≤ V ≤ 300 km\/h/g, "120\\le V\\le300\\,\\mathrm{km/h}"],
        [/V ≤ 120 km\/h/g, "V\\le120\\,\\mathrm{km/h}"], [/V = 120 km\/h/g, "V=120\\,\\mathrm{km/h}"], [/V > 300 km\/h/g, "V>300\\,\\mathrm{km/h}"],
        [/Lf ≤ 2,88 m/g, "L_f\\le2{,}88\\,\\mathrm{m}"], [/Lf > 2,88 m/g, "L_f>2{,}88\\,\\mathrm{m}"], [/f = 1/g, "f=1"], [/f < 1/g, "f<1"],
        [/± q1k/g, "\\pm q_{1k}"], [/± q2k/g, "\\pm q_{2k}"], [/± q3k/g, "\\pm q_{3k}"], [/± q4k/g, "\\pm q_{4k}"],
        [/k2 =1,3/g, "k_2=1{,}3"], [/± k4 · q1k/g, "\\pm k_4\\cdot q_{1k}"], [/k4 = 2/g, "k_4=2"],
        [/± k5 · q2k/g, "\\pm k_5\\cdot q_{2k}"], [/k5 = 2,5/g, "k_5=2{,}5"], [/k5 = 3,5/g, "k_5=3{,}5"],
        [/± 20 kN/g, "\\pm20\\,\\mathrm{kN}"], [/1,5 s/g, "1{,}5s"], [/≤1,0 m/g, "\\le1{,}0\\,\\mathrm{m}"], [/≤2,50 m/g, "\\le2{,}50\\,\\mathrm{m}"],
        [/[+-]?\d+(?:,\d+)?\s*(?:kN\/m²|kN\/m|kN|km\/h|m\/s²|m\/s|°C|mm|m)(?=$|[\s,.;:)])/gu, quantityLatex],
        [/\d+(?:,\d+)?%/g, (value) => value.slice(0, -1).replace(",", "{,}") + "\\%"], [/1\/3/g, "\\frac{1}{3}"],
        [/kN\/m²/g, "\\mathrm{kN/m^2}"], [/kN\/m/g, "\\mathrm{kN/m}"], [/\bkN\b/g, "\\mathrm{kN}"], [/km\/h/g, "\\mathrm{km/h}"], [/m\/s²/g, "\\mathrm{m/s^2}"], [/m\/s/g, "\\mathrm{m/s}"], [/\bm\b/g, "\\mathrm{m}"],
        [/Qla,k/g, "Q_{la,k}"], [/Qlb,k/g, "Q_{lb,k}"], [/qA1d/g, "q_{A1d}"], [/qA2d/g, "q_{A2d}"],
        [/Qsk/g, "Q_{sk}"], [/Qtk/g, "Q_{tk}"], [/qtk/g, "q_{tk}"], [/Qvk/g, "Q_{vk}"], [/qvk/g, "q_{vk}"],
        [/q1k/g, "q_{1k}"], [/q2k/g, "q_{2k}"], [/q3k/g, "q_{3k}"], [/q4k/g, "q_{4k}"],
        [/\bk1\b/g, "k_1"], [/\bk2\b/g, "k_2"], [/\bk3\b/g, "k_3"], [/\bk4\b/g, "k_4"], [/\bk5\b/g, "k_5"],
        [/Φrid/g, "\\Phi_{rid}"], [/Φ2/g, "\\Phi_2"], [/Φ3/g, "\\Phi_3"], [/Ψ2/g, "\\Psi_2"], [/ψ0i/g, "\\psi_{0i}"],
        [/LΦ/g, "L_{\\Phi}"], [/Lf/g, "L_f"], [/δ0/g, "\\delta_0"], [/a[’']g/g, "a'_g"],
        [/\bmax ag\b/g, "\\max a_g"], [/\bmin ag\b/g, "\\min a_g"], [/\bag\b/g, "a_g"], [/\bhg\b/g, "h_g"],
        [/α/g, "\\alpha"], [/β/g, "\\beta"], [/λ/g, "\\lambda"], [/Φ/g, "\\Phi"],
        [/\bL\b/g, "L"], [/\bV\b/g, "V"], [/\bv\b/g, "v"], [/\bf\b/g, "f"], [/\bg\b/g, "g"], [/\br\b/g, "r"], [/(?<!\/)\bh\b/g, "h"], [/\bS\b/g, "S"], [/\bE\b/g, "E"],
        [/Qvi/g, "Q_{vi}"], [/Ed/g, "E_d"], [/Rd/g, "R_d"], [/Cd/g, "C_d"], [/\bD\b/g, "D"],
    ];
    const matches: Array<{ start: number; end: number; value: string; latex: string }> = [];
    for (const [pattern, toLatex] of patterns) {
        pattern.lastIndex = 0;
        let match: RegExpExecArray | null;
        while ((match = pattern.exec(text)) !== null) {
            const start = match.index;
            const end = start + match[0].length;
            if (!matches.some((item) => start < item.end && end > item.start)) {
                matches.push({ start, end, value: match[0], latex: typeof toLatex === "function" ? toLatex(match[0]) : toLatex });
            }
        }
    }
    matches.sort((a, b) => a.start - b.start);
    const result: Inline[] = [];
    let cursor = 0;
    for (const match of matches) {
        if (match.start > cursor) result.push({ kind: "text", value: text.slice(cursor, match.start) });
        result.push({ kind: "math", value: match.value, latex: match.latex });
        cursor = match.end;
    }
    if (cursor < text.length) result.push({ kind: "text", value: text.slice(cursor) });
    return result.length ? result : [{ kind: "text", value: text }];
}
const p = (page: number, text: string, raw = text): Block => ({ kind: "paragraph", page, text, raw, inline: inlineMath(text, page) });
const li = (page: number, text: string, raw = text): Block => ({ kind: "list-item", page, text, raw, inline: inlineMath(text, page) });
const h = (page: number, number: string, title: string, raw = `${number}. ${title}`): Block => ({ kind: "heading", page, text: `${number} ${title}`, raw });
const ih = (page: number, text: string): Block => ({ kind: "heading", page, text, raw: text });
const ref = (kind: "formula-ref" | "table-ref" | "figure-ref", page: number, suffix: string): Block => ({ kind, page, assetId: asset(kind.replace("-ref", "") as "formula" | "table" | "figure", suffix) });
const U = (number: string, title: string, page: number, blocks: Block[] = []): UnitDef => ({ number, title, blocks: [h(page, number, title), ...blocks] });

const units: UnitDef[] = [
    U("5.2.2.2.3", "EFFETTI DINAMICI", 171, [
        p(171, "Le sollecitazioni e gli spostamenti determinati sulle strutture del ponte dall’applicazione statica dei modelli di carico debbono essere incrementati per tenere conto della natura dinamica del transito dei convogli."),
        p(171, "Nella progettazione dei ponti ferroviari gli effetti di amplificazione dinamica dovranno valutarsi nel modo seguente:"),
        li(171, "per le usuali tipologie di ponti e per velocità di percorrenza non superiore a 200 km/h, quando la frequenza propria della struttura ricade all’interno del fuso indicato in Fig. 5.2.7, è sufficiente utilizzare i coefficienti dinamici Φ definiti nel presente paragrafo;", "- per le usuali tipologie di ponti e per velocità di percorrenza non superiore a 200 km/h, quando la frequenza propria della strut-\ntura ricade all’interno del fuso indicato in Fig. 5.2.7, è sufficiente utilizzare i coefficienti dinamici  ̘ definiti nel presente para-\ngrafo;"),
        li(171, "per le usuali tipologie di ponti, ove la velocità di percorrenza sia superiore a 200 km/h e quando la frequenza propria della struttura non ricade all’interno del fuso indicato in Fig. 5.2.7 e comunque per le tipologie non convenzionali (ponti strallati, ponti sospesi, ponti di grande luce, ponti metallici difformi dalle tipologie in uso in ambito ferroviario, ecc.) dovrà effettuarsi una analisi dinamica adottando convogli “reali” e parametri di controllo specifici dell’infrastruttura e del tipo di traffico ivi previsto.", "- per le usuali tipologie di ponti, ove la velocità di percorrenza sia superiore a 200 km/h e quando la frequenza propria della\nstruttura non ricade all’interno del fuso indicato in Fig. 5.2.7 e comunque per le tipologie non convenzionali (ponti strallati,\nponti sospesi, ponti di grande luce, ponti metallici difformi dalle tipologie in uso in ambito ferroviario, ecc.) dovrà effettuarsi\nuna analisi dinamica adottando convogli “reali” e parametri di controllo specifici dell’infrastruttura e del tipo di traffico ivi\nprevisto."),
        ref("figure-ref", 171, "5.2.7"),
        p(171, "In Fig. 5.2.7 il “fuso” è caratterizzato da:"),
        p(171, "un limite superiore pari a:"), ref("formula-ref", 171, "5.2.2"),
        p(171, "un limite inferiore pari a:"), ref("formula-ref", 171, "5.2.3"),
        ref("formula-ref", 171, "5.2.4"),
        p(171, "Per una trave semplicemente appoggiata, sottoposta a flessione, la prima frequenza flessionale può valutarsi con la formula:"),
        ref("formula-ref", 171, "5.2.5"),
        p(171, "dove: δ₀ rappresenta la freccia, espressa in mm, valutata in mezzeria e dovuta alle azioni permanenti."),
        p(171, "Per ponti in calcestruzzo δ₀ deve calcolarsi impiegando il modulo elastico secante, in accordo con la breve durata del passaggio del treno."),
        p(171, "Per travi continue, salvo più precise determinazioni, L è da assumersi pari alla LΦ definita come di seguito."),
        p(171, "I coefficienti di incremento dinamico Φ che aumentano l’intensità dei modelli di carico definiti in 5.2.2.2.1 si assumono pari a Φ₂ o Φ₃, in dipendenza del livello di manutenzione della linea. In particolare, si assumerà:"),
        li(171, "(a) per linee con elevato standard manutentivo:"), ref("formula-ref", 171, "5.2.6"),
        li(171, "(b) per linee con ridotto standard manutentivo:"), ref("formula-ref", 171, "5.2.7"),
        p(172, "LΦ rappresenta la lunghezza “caratteristica” in metri, così come definita in Tab. 5.2.II."),
        ref("table-ref", 172, "5.2.ii"),
        p(173, "I coefficienti di incremento dinamico sono stabiliti con riferimento a travi semplicemente appoggiate. La lunghezza LΦ permette di estendere l’uso di questi coefficienti anche ad altre tipologie strutturali."),
        p(173, "Ove le sollecitazioni agenti in un elemento strutturale dipendessero da diversi termini ciascuno dei quali afferente a componenti strutturali distinti, ognuno di questi termini dovrà calcolarsi utilizzando la lunghezza caratteristica LΦ appropriata."),
        p(173, "Questo coefficiente dinamico Φ non dovrà essere usato con i seguenti carichi:"),
        li(173, "treno scarico;", "▪ treno scarico;"), li(173, "treni “reali”.", "▪ treni “reali”."),
        p(173, "Per i ponti metallici con armamento diretto occorrerà considerare un ulteriore coefficiente di adattamento dell’incremento dinamico β (inserito per tener conto del maggiore incremento dinamico dovuto al particolare tipo di armamento), variabile esclusivamente in funzione della lunghezza caratteristica LΦ dell’elemento, dato da:"),
        ref("formula-ref", 173, "5.2.2.2.3-beta"),
        p(173, "Nei casi di ponti ad arco o scatolari, con o senza solettone di fondo, aventi copertura “h” maggiore di 1,0 m, il coefficiente dinamico può essere ridotto nella seguente maniera:"),
        ref("formula-ref", 173, "5.2.8"),
        p(173, "dove h, in metri, è l’altezza della copertura dall’estradosso della struttura alla faccia superiore delle traverse."),
        p(173, "Per le strutture dotate di una copertura maggiore di 2,50 m può assumersi un coefficiente di incremento dinamico unitario."),
        p(173, "Pile con snellezza λ ≤ 30, spalle, fondazioni, muri di sostegno e spinte del terreno possono essere calcolate assumendo coefficienti dinamici unitari.", "Pile con snellezza Ώ ǂ 30, spalle, fondazioni, muri di sostegno e spinte del terreno possono essere calcolate assumendo coefficienti\ndinamici unitari."),
        p(173, "Qualora debbano eseguirsi verifiche con treni reali, agli stessi dovranno essere associati coefficienti dinamici reali."),
    ]),
    U("5.2.2.3", "AZIONI VARIABILI ORIZZONTALI", 173),
    U("5.2.2.3.1", "FORZA CENTRIFUGA", 173, [
        p(173, "Nei ponti ferroviari al di sopra dei quali il binario presenta un tracciato in curva deve essere considerata la forza centrifuga agente su tutta l’estensione del tratto in curva."),
        p(173, "La forza centrifuga si considera agente verso l’esterno della curva, in direzione orizzontale ed applicata alla quota di 1,80 m al di sopra del P.F.."),
        p(173, "I calcoli si basano sulla massima velocità compatibile con il tracciato della linea. Ove siano considerati gli effetti dei modelli di carico SW, si assumerà una velocità di 100 km/h."),
        p(173, "Il valore caratteristico della forza centrifuga si determinerà in accordo con la seguente espressione:"),
        ref("formula-ref", 173, "5.2.9.a"), ref("formula-ref", 173, "5.2.9.b"),
        p(173, "dove: Qtk-qtk = valore caratteristico della forza centrifuga [kN - kN/m]; Qvk-qvk = valore caratteristico dei carichi verticali [kN - kN/m]; α = coefficiente di adattamento; v = velocità di progetto espressa in m/s; V = velocità di progetto espressa in km/h; f = fattore di riduzione (definito in seguito nella 5.2.10); g = accelerazione di gravità in m/s²; r = raggio di curvatura in m.", "dove:\nQ tk -qtk = valore caratteristico della forza centrifuga [kN -kN/m];\nQ vk -qvk = valore caratteristico dei carichi verticali [kN -kN/m];\n΅ = coefficiente di adattamento;\nv = velocità di progetto espressa in m/s;\nV = velocità di progetto espressa in km/h;\nf = fattore di riduzione (definito in seguito nella 5.2.10);\ng = accelerazione di gravità in m/s²;\nr = raggio di curvatura in m."),
        p(174, "Nel caso di curva policentrica come valore del raggio r dovrà essere assunto un opportuno valore medio fra i raggi di curvatura che interessano la campata in esame."),
        p(174, "La forza centrifuga sarà sempre combinata con i carichi verticali supposti agenti nella generica configurazione di carico, e non sarà incrementata dai coefficienti dinamici."),
        p(174, "f è un fattore di riduzione dato in funzione della velocità V e della lunghezza Lf di binario carico."),
        ref("formula-ref", 174, "5.2.10-force"),
        p(174, "dove: Lf = lunghezza di influenza, in metri, della parte curva di binario carico sul ponte, che è la più sfavorevole per il progetto del generico elemento strutturale; f = 1 per V ≤ 120 km/h o Lf ≤ 2,88 m; f < 1 per 120 ≤ V ≤ 300 km/h e Lf > 2,88 m; f(V) = f(300) per V > 300 km/h."),
        p(174, "Per il modello di carico LM 71 e per velocità di progetto superiori ai 120 km/h, saranno considerati due casi:"),
        li(174, "(a) Modello di carico LM 71 e forza centrifuga per V = 120 km/h in accordo con le formule precedenti dove f = 1;"),
        li(174, "(b) Modello di carico LM 71 e forza centrifuga calcolata secondo le precedenti espressioni per la massima velocità di progetto."),
        p(174, "Inoltre, per ponti situati in curva, dovrà essere considerato anche il caso di assenza di forza centrifuga (convogli fermi)."),
        p(174, "Per i modelli di carico LM71 e SW/0 l’azione centrifuga si dovrà determinare partendo dalle equazioni [5.2.9] e [5.2.10] considerando i valori di V, α, e f definiti nella seguente Tab. 5.2 II.b."),
        ref("table-ref", 174, "5.2.ii.b"),
    ]),
    U("5.2.2.3.2", "AZIONE LATERALE (SERPEGGIO)", 174, [
        p(174, "La forza laterale indotta dal serpeggio si considera come una forza concentrata agente orizzontalmente, applicata alla sommità della rotaia più alta, perpendicolarmente all’asse del binario. Tale azione si applicherà sia in rettifilo che in curva."),
        p(174, "Il valore caratteristico di tale forza sarà assunto pari a Qsk = 100 kN. Tale valore deve essere moltiplicato per α, (se α>1), ma non per il coefficiente Φ."),
        p(174, "Questa forza laterale deve essere sempre combinata con i carichi verticali."),
    ]),
    U("5.2.2.3.3", "AZIONI DI AVVIAMENTO E FRENATURA", 174, [
        p(174, "Le forze di frenatura e di avviamento agiscono sulla sommità del binario, nella direzione longitudinale dello stesso. Dette forze sono da considerarsi uniformemente distribuite su una lunghezza di binario L determinata per ottenere l’effetto più gravoso sull’elemento strutturale considerato."),
        p(174, "I valori caratteristici da considerare sono i seguenti:"),
        ref("formula-ref", 174, "5.2.2.3.3-starting"),
        ref("formula-ref", 175, "5.2.2.3.3-braking"),
        p(175, "Questi valori caratteristici sono applicabili a tutti i tipi di binario, sia con rotaie saldate, sia con rotaie giuntate, con o senza dispositivi di espansione."),
        p(175, "Le azioni di frenatura ed avviamento saranno combinate con i relativi carichi verticali (per modelli di carico SW/0 e SW/2 saranno tenute in conto solo le parti di struttura che sono caricate in accordo con la Fig. 5.2.2 e con la Tab. 5.2.I)."),
        p(175, "Quando la rotaia è continua ad una o ad entrambe le estremità del ponte solo una parte delle forze di frenatura ed avviamento è trasferita, attraverso l’impalcato, agli apparecchi di appoggio, la parte rimanente di queste forze è trasmessa, attraverso le rotaie, ai rilevati a tergo delle spalle. La percentuale di forze trasferite attraverso l’impalcato agli apparecchi di appoggio è valutabile con le modalità riportate nel paragrafo relativo agli effetti di interazione statica."),
        p(175, "Nel caso di ponti a doppio binario si devono considerare due treni in transito in versi opposti, uno in fase di avviamento, l’altro in fase di frenatura."),
        p(175, "Nel caso di ponti a più di due binari si deve considerare:"),
        li(175, "un primo binario con la massima forza di frenatura;", "- un primo binario con la massima forza di frenatura;"),
        li(175, "un secondo binario con la massima forza di avviamento nello stesso verso della forza di frenatura;", "- un secondo binario con la massima forza di avviamento nello stesso verso della forza di frenatura;"),
        li(175, "un terzo ed un quarto binario con il 50% della forza di frenatura, concorde con le precedenti;", "- un terzo ed un quarto binario con il 50% della forza di frenatura, concorde con le precedenti;"),
        li(175, "altri eventuali binari privi di forze orizzontali.", "- altri eventuali binari privi di forze orizzontali."),
        p(175, "Per il treno scarico la frenatura e l’avviamento possono essere trascurate."),
        p(175, "Per lunghezze di carico superiori a 300 m dovranno essere eseguiti appositi studi per valutare i requisiti aggiuntivi da tenere in conto ai fini degli effetti di frenatura ed avviamento."),
        p(175, "Per la determinazione delle azioni di frenatura e avviamento relative a ferrovie diverse da quelle ordinarie (ferrovie leggere, metropolitane, a scartamento ridotto, ecc.) dovranno essere eseguiti appositi studi in relazione alla singola tipologia di infrastruttura.", "Per la determinazione delle azioni di frenatura e avviamento relative a ferrovie diverse da quelle ordinarie (ferrovie leggere, me-\ntropolitane, a scartamento ridotto, ecc.) dovranno essere eseguiti appositi studi in relazione alla singola tipologia di infrastruttu-\nra."),
        p(175, "I valori caratteristici dell’azione di frenatura e di quella di avviamento devono essere moltiplicati per α e non devono essere moltiplicati per Φ.", "I valori caratteristici dell’azione di frenatura e di quella di avviamento devono essere moltiplicati per ΅ e non devono essere mol-\ntiplicati per )."),
    ]),
    U("5.2.2.4", "AZIONI VARIABILI AMBIENTALI", 175),
    U("5.2.2.4.1", "AZIONE DEL VENTO", 175, [
        p(175, "Le azioni del vento sono definite al § 3.3 delle presenti Norme Tecniche."),
        p(175, "Nelle stesse norme sono individuate le metodologie per valutare l’effetto dell’azione sia come effetto statico che dinamico. Le strutture andranno progettate e verificate nel rispetto di queste azioni."),
        p(175, "Nei casi ordinari il treno viene individuato come una superficie piana continua convenzionalmente alta 4 m dal P.F., indipendentemente dal numero dei convogli presenti sul ponte."),
        p(175, "Nel caso in cui si consideri il ponte scarico, l’azione del vento dovrà considerarsi agente sulle barriere antirumore presenti, così da individuare la situazione più gravosa."),
    ]),
    U("5.2.2.4.2", "TEMPERATURA", 175, [
        p(175, "Le azioni della temperatura sono definite al § 3.5 delle presenti Norme Tecniche."),
        p(175, "Nelle stesse norme sono individuate le metodologie per valutare l’effetto dell’azione. Le strutture andranno progettate e verificate nel rispetto di queste azioni."),
        ih(175, "Variazione termica non uniforme"),
        p(175, "In aggiunta alla variazione termica uniforme, andrà considerato un gradiente di temperatura di 5 °C fra estradosso ed intradosso di impalcato con verso da determinare caso per caso."),
        p(175, "Nel caso di impalcati a cassone in calcestruzzo, andrà considerata una differenza di temperatura di 5 °C con andamento lineare nello spessore delle pareti e nei due casi di temperatura interna maggiore/minore dell’esterna."),
        p(175, "Nei ponti a struttura mista acciaio-calcestruzzo, andrà considerata anche una differenza di temperatura di 5 °C tra la soletta in calcestruzzo e la trave in acciaio."),
        p(175, "Anche per le pile si dovrà tenere conto degli effetti dovuti ai fenomeni termici e di ritiro differenziale."),
        p(175, "Per le usuali tipologie di pile cave, salvo più accurate determinazioni, si potranno adottare le ipotesi approssimate di seguito descritte:"),
        li(175, "differenza di temperatura tra interno ed esterno pari a 10 °C (con interno più caldo dell’esterno o viceversa), considerando un modulo elastico E non ridotto;", "- differenza di temperatura tra interno ed esterno pari a 10 °C (con interno più caldo dell’esterno o viceversa), considerando un\nmodulo elastico E non ridotto;"),
        li(175, "variazione termica uniforme tra fusto, pila e zattera interrata pari a 5 °C (zattera più fredda della pila e viceversa) con variazione lineare tra l’estradosso zattera di fondazione ed una altezza da assumersi, in mancanza di determinazioni più precise, pari a 5 volte lo spessore della parete della pila.", "- variazione termica uniforme tra fusto, pila e zattera interrata pari a 5 °C (zattera più fredda della pila e viceversa) con varia-\nzione lineare tra l’estradosso zattera di fondazione ed una altezza da assumersi, in mancanza di determinazioni più precise,\npari a 5 volte lo spessore della parete della pila."),
        p(176, "Per la verifica delle deformazioni orizzontali e verticali degli impalcati, con l’esclusione delle analisi di comfort, dovranno considerarsi delle differenze di temperatura fra estradosso ed intradosso e fra le superfici laterali più esterne degli impalcati di 10 °C."),
        p(176, "Per tali differenze di temperatura potrà assumersi un andamento lineare fra i detti estremi, considerando gli stessi gradienti termici diretti sia in un verso che nell’altro."),
        p(176, "Per il calcolo degli effetti di interazione statica binario-struttura, si potranno considerare i seguenti effetti termici sul binario:"),
        li(176, "in assenza di apparecchi di dilatazione del binario, si potrà considerare nulla la variazione termica nel binario, essendo essa ininfluente ai fini della valutazione delle reazioni nei vincoli fissi e delle tensioni aggiuntive nelle rotaie e non generando essa scorrimenti relativi binario impalcato;", "- in assenza di apparecchi di dilatazione del binario, si potrà considerare nulla la variazione termica nel binario, essendo essa\nininfluente ai fini della valutazione delle reazioni nei vincoli fissi e delle tensioni aggiuntive nelle rotaie e non generando essa\nscorrimenti relativi binario impalcato;"),
        li(176, "in presenza di apparecchi di dilatazione del binario, si assumeranno variazioni termiche del binario pari a +30 °C e -40 °C rispetto alla temperatura di regolazione del binario stesso. Nel caso di impalcato in acciaio esse dovranno essere applicate contemporaneamente alle variazioni termiche dell’impalcato e con lo stesso segno. Nel caso di impalcati in c.a.p. o misti in acciaio-calcestruzzo, occorrerà considerare, tra le due seguenti, la condizione più sfavorevole nella combinazione con le altre azioni: nella prima è nulla la variazione termica nell’impalcato e massima (positiva o negativa) quella nella rotaia, nella seconda è nulla la variazione termica nella rotaia e massima (positiva o negativa) quella nell’impalcato.", "- in presenza di apparecchi di dilatazione del binario, si assumeranno variazioni termiche del binario pari a +30 °C e -40 °C ri-\nspetto alla temperatura di regolazione del binario stesso. Nel caso di impalcato in acciaio esse dovranno essere applicate con-\ntemporaneamente alle variazioni termiche dell’impalcato e con lo stesso segno. Nel caso di impalcati in c.a.p. o misti in acciaio-\ncalcestruzzo, occorrerà considerare, tra le due seguenti, la condizione più sfavorevole nella combinazione con le altre azioni:\nnella prima è nulla la variazione termica nell’impalcato e massima (positiva o negativa) quella nella rotaia, nella seconda è nul-\nla la variazione termica nella rotaia e massima (positiva o negativa) quella nell’impalcato."),
        p(176, "Ai fini delle verifiche di interazione, le massime variazioni termiche dell’impalcato rispetto alla temperatura dello stesso all’atto della regolazione del binario, possono essere assunte pari a quelle indicate in precedenza, in funzione dei materiali costituenti l’opera e della tipologia di armamento. Quanto innanzi esplicitato trova applicazione quando la regolazione del binario viene eseguita nei periodi stagionali nei quali il ponte viene a trovarsi approssimativamente in condizioni di temperatura media. In generale si possono ritenere trascurabili, e comunque in favore di sicurezza, gli effetti del gradiente termico lungo l’altezza dell’impalcato.", "Ai fini delle verifiche di interazione, le massime variazioni termiche dell’impalcato rispetto alla temperatura dello stesso all’atto\ndella regolazione del binario, possono essere assunte pari a quelle indicate in precedenza, in funzione dei materiali costituenti\nl’opera e della tipologia di armamento. Quanto innanzi esplicitato trova applicazione quando la regolazione del binario viene e-\nseguita nei periodi stagionali nei quali il ponte viene a trovarsi approssimativamente in condizioni di temperatura media. In ge-\nnerale si possono ritenere trascurabili, e comunque in favore di sicurezza, gli effetti del gradiente termico lungo l’altezza\ndell’impalcato."),
    ]),
    U("5.2.2.5", "EFFETTI DI INTERAZIONE STATICA TRENO-BINARIO-STRUTTURA", 176, [
        p(176, "Nei casi in cui si abbia continuità delle rotaie tra il ponte ed il rilevato a tergo delle spalle ad una o ad entrambe le estremità del ponte (ipotesi di assenza, ad uno o ad entrambi gli estremi del ponte, di apparecchi di dilatazione del binario) si dovrà tenere conto degli effetti di interazione tra binario e struttura che inducono forze longitudinali nella rotaia e nella sottostruttura del ponte (sistemi fondazione-pila-apparecchio di appoggio, fondazione-spalla-apparecchio di appoggio) e scorrimenti longitudinali tra binario e impalcato che interessano il mezzo di collegamento (ballast e/o attacco).", "Nei casi in cui si abbia continuità delle rotaie tra il ponte ed il rilevato a tergo delle spalle ad una o ad entrambe le estremità del\nponte (ipotesi di assenza, ad uno o ad entrambi gli estremi del ponte, di apparecchi di dilatazione del binario) si dovrà tenere\nconto degli effetti di interazione tra binario e struttura che inducono forze longitudinali nella rotaia e nella sottostruttura del pon-\nte (sistemi fondazione-pila-apparecchio di appoggio, fondazione-spalla-apparecchio di appoggio) e scorrimenti longitudinali tra\nbinario e impalcato che interessano il mezzo di collegamento (ballast e/o attacco)."),
        p(176, "Le suddette azioni dovranno essere portate in conto nel progetto di tutti gli elementi della struttura (impalcati, apparecchi d’appoggio, pile, spalle, fondazioni, ecc.) e dovranno essere tali da non compromettere le condizioni di servizio del binario (tensioni nella rotaia, scorrimenti binario-impalcato)."),
        p(176, "Devono essere considerati gli effetti di interazione binario-struttura prodotti da:"),
        li(176, "frenatura ed avviamento dei treni;"), li(176, "variazioni termiche della struttura e del binario;"), li(176, "deformazioni dovute ai carichi verticali;"),
        p(176, "Gli effetti di interazione prodotti da viscosità e ritiro nelle strutture in c.a. e c.a.p. dovranno essere presi in conto, ove rilevanti."),
        p(176, "La rigidezza del sistema appoggio/pile/fondazioni, da considerare per la valutazione degli effetti delle interazioni statiche, dovrà essere calcolata trascurando lo scalzamento nel caso di pile in alveo."),
        p(176, "Al fine di garantire la sicurezza del binario rispetto a fenomeni di instabilità per compressione e rottura per trazione della rotaia, nonché rispetto ad eccessivi scorrimenti nel ballast, causa di un suo rapido deterioramento, occorre che vengano rispettati i limiti sull’incremento delle tensioni nel binario e sugli spostamenti relativi tra binario ed estradosso dell’impalcato o del rilevato forniti dal gestore dell’infrastruttura, che specificherà modalità e parametri di controllo in funzione delle caratteristiche dell’infrastruttura e della tipologia di armamento (rotaie, traverse, attacchi) e della presenza o meno del ballast."),
        p(176, "La verifica di sicurezza del binario andrà condotta considerando la combinazione caratteristica (SLE), adottando per le azioni termiche coefficienti ψ0i=1,0.", "La verifica di sicurezza del binario andrà condotta considerando la combinazione caratteristica (SLE), adottando per le azioni\ntermiche coefficienti ψoi=1,0."),
    ]),
    U("5.2.2.6", "EFFETTI AERODINAMICI ASSOCIATI AL PASSAGGIO DEI CONVOGLI FERROVIARI", 176, [
        p(176, "Il passaggio dei convogli ferroviari induce sulle superfici situate in prossimità della linea ferroviaria (per esempio barriere antirumore) onde di pressione e depressione secondo gli schemi riportati nel seguito."),
        p(176, "Le azioni possono essere schematizzate mediante carichi equivalenti agenti nelle zone prossime alla testa ed alla coda del treno nei casi in cui, in ragione della velocità della linea, non si instaurino amplificazioni dinamiche significative per il comportamento degli elementi strutturali investiti dalle azioni aerodinamiche. Esse dovranno essere utilizzate per il progetto delle barriere e delle relative strutture di sostegno (cordoli, solette, fondazioni, ecc.)."),
        p(176, "I carichi equivalenti sono considerati valori caratteristici delle azioni."),
        p(176, "In ogni caso le azioni aerodinamiche dovranno essere cumulate con l’azione del vento come indicato al punto 5.2.3.3.2."),
    ]),
    U("5.2.2.6.1", "SUPERFICI VERTICALI PARALLELE AL BINARIO", 177, [
        p(177, "I valori caratteristici dell’azione ± q1k relativi a superfici verticali parallele al binario sono forniti in Fig. 5.2.8 in funzione della distanza ag dall’asse del binario più vicino."), ref("figure-ref", 177, "5.2.8"),
        p(177, "I suddetti valori sono relativi a treni con forme aerodinamiche sfavorevoli; per i casi di forme aerodinamiche favorevoli, questi valori dovranno essere corretti per mezzo del fattore k1, ove:"),
        ref("formula-ref", 177, "5.2.2.6.1-k1"),
        p(177, "Se l’altezza di un elemento strutturale (o parte della sua superficie di influenza) è ≤1,0 m o se la larghezza è ≤2,50 m, l’azione q1k deve essere incrementata del fattore k2 =1,3.", "Se l’altezza di un elemento strutturale (o parte della sua superficie di influenza) è ǂ1,0 m o se la larghezza è ǂ2,50 m, l’azione q1k deve\nessere incrementata del fattore k2 =1,3."),
    ]),
    U("5.2.2.6.2", "SUPERFICI ORIZZONTALI AL DI SOPRA DEL BINARIO", 177, [
        p(177, "I valori caratteristici dell’azione ± q2k, relativi a superfici orizzontali al di sopra del binario, sono forniti in Fig. 5.2.9 in funzione della distanza hg della superficie inferiore della struttura dal PF."), ref("figure-ref", 178, "5.2.9"),
        p(177, "La larghezza d’applicazione del carico per gli elementi strutturali da considerare si estende sino a 10 m da ciascun lato a partire dalla mezzeria del binario."),
        p(177, "Per convogli transitanti in due direzioni opposte le azioni saranno sommate. Nel caso di presenza di più binari andranno considerati solo due binari."),
        p(177, "Anche l’azione q2k andrà ridotta del fattore k1, in accordo a quanto previsto nel precedente § 5.2.2.6.1."),
        p(177, "Le azioni agenti sul bordo di elementi nastriformi che attraversano i binari, come ad esempio le passerelle, possono essere ridotte con un fattore pari a 0,75 per una larghezza fino a 1,50 m."),
    ]),
    U("5.2.2.6.3", "SUPERFICI ORIZZONTALI ADIACENTI IL BINARIO", 177, [
        p(177, "I valori caratteristici dell’azione ± q3k, relativi a superfici orizzontali adiacenti il binario, sono forniti in Fig. 5.2.10 e si applicano indipendentemente dalla forma aerodinamica del treno."), ref("figure-ref", 178, "5.2.10"),
        p(177, "Per tutte le posizioni lungo le superfici da progettare, q3k si determinerà come una funzione della distanza ag dall’asse del binario più vicino. Le azioni saranno sommate, se ci sono binari su entrambi i lati dell’elemento strutturale da calcolare."),
        p(177, "Se la distanza hg supera i 3,80 m l’azione q3k può essere ridotta del fattore k3:"),
        p(177, "k3 = (7,5 − hg)/3,7 per 3,8 m < hg < 7,5 m; k3 = 0 per hg ≥ 7,5 m", "7,3\nh5,7\nk g\n3  \n per 3,8 m < hg < 7,5 m;\nk3 = 0 per hg ǃ 7,5 m"),
        ref("formula-ref", 177, "5.2.2.6.3-k3"),
        p(177, "dove hg rappresenta la distanza dal P.F. alla superficie inferiore della struttura."),
    ]),
    U("5.2.2.6.4", "STRUTTURE CON SUPERFICI MULTIPLE A FIANCO DEL BINARIO SIA VERTICALI CHE ORIZZONTALI O INCLINATE", 178, [
        p(178, "I valori caratteristici dell’azione ± q4k sono forniti in Fig. 5.2.11 e si applicano ortogonalmente alla superficie considerata. Le azioni sono determinate secondo quanto detto nel precedente § 5.2.2.6.1 adottando una distanza fittizia dal binario pari a"),
        ref("formula-ref", 178, "5.2.10-distance"),
        p(178, "Le distanze min ag, max ag sono indicate in Fig. 5.2.11."),
        ref("figure-ref", 179, "5.2.11"),
        p(178, "Nei casi in cui max ag > 6 m si adotterà max ag = 6,0 m"),
        p(178, "I coefficienti k1 e k2 sono gli stessi definiti al precedente § 5.2.2.6.1."),
    ]),
    U("5.2.2.6.5", "SUPERFICI CHE CIRCONDANO INTEGRALMENTE IL BINARIO PER LUNGHEZZE INFERIORI A 20 M", 179, [
        p(179, "In questo caso, tutte le azioni si applicheranno indipendentemente dalla forma aerodinamica del treno nel modo seguente:.", "In questo caso, tutte le azioni si applicheranno indipendentemente dalla forma aerodinamica del treno nel modo seguente: ."),
        li(179, "sulle superfici verticali ± k4 · q1k, per tutta l’altezza dell’elemento, con q1k determinato in accordo con il punto 5.2.2.6.1 e k4 = 2;", "- sulle superfici verticali ± k4 · q1k, per tutta l’altezza dell’elemento, con q1k determinato in accordo con il punto 5.2.2.6.1 e k4 = 2;"),
        li(179, "sulla superficie orizzontale ± k5 · q2k, con: q2k determinato in accordo con il punto 5.2.2.6.2; k5 = 2,5 se la struttura racchiude un solo binario; k5 = 3,5 se la struttura racchiude due binari.", "- sulla superficie orizzontale ± k5 · q2k, con:\nq2k determinato in accordo con il punto 5.2.2.6.2;\nk5 = 2,5 se la struttura racchiude un solo binario;\nk5 = 3,5 se la struttura racchiude due binari."),
    ]),
    U("5.2.2.7", "AZIONI IDRODINAMICHE", 179, [p(179, "Le azioni idrauliche sulle pile poste nell’alveo dei fiumi andranno calcolate secondo le prescrizioni del § 5.2.1.2 tenendo conto, oltre che dell’orientamento e della forma della pila, anche degli effetti di modificazioni locali dell’alveo dovute, per esempio, allo scalzamento.")]),
    U("5.2.2.8", "AZIONI SISMICHE", 179, [
        p(179, "Per le azioni sismiche si devono rispettare le prescrizioni di cui al § 3.2. e al § 7.9."),
        p(179, "Per la determinazione degli effetti di tali azioni si farà di regola riferimento alle sole masse corrispondenti ai pesi propri ed ai carichi permanenti e considerando con un coefficiente Ψ2 = 0,2 il valore quasi permanente delle masse corrispondenti ai carichi da traffico ferroviario.", "Per la determinazione degli effetti di tali azioni si farà di regola riferimento alle sole masse corrispondenti ai pesi propri ed ai ca-\nrichi permanenti e considerando con un coefficiente Ψ2 = 0,2 il valore quasi permanente delle masse corrispondenti ai carichi da\ntraffico ferroviario."),
    ]),
    U("5.2.2.9", "AZIONI ECCEZIONALI", 179, [
        p(179, "Le azioni eccezionali da considerare nel progetto saranno valutate sulla base delle indicazioni contenute nel § 3.6 in generale e al § 3.6.3.1 in particolare.", "Le azioni eccezionali da considerare nel progetto saranno valutate sulla base delle indicazioni contenute nel § 3.6 in generale e al §\n3.6.3.1 in particolare."),
        p(179, "Con riferimento al § 3.6.3.1 si puntualizza che le azioni d’urto agenti sugli elementi strutturali orizzontali al disopra della strada, sono da impiegarsi per la verifica di sicurezza globale dell’impalcato nel suo insieme inteso come corpo rigido (sollevamento/ribaltamento); all’occorrenza di tali eventi sono ammessi danni localizzati agli elementi strutturali che non comportino il collasso dell’impalcato.", "Con riferimento al § 3.6.3.1 si puntualizza che le azioni d’urto agenti sugli elementi strutturali orizzontali al disopra della strada, so-\nno da impiegarsi per la verifica di sicurezza globale dell’impalcato nel suo insieme inteso come corpo rigido (sollevamen-\nto/ribaltamento); all’occorrenza di tali eventi sono ammessi danni localizzati agli elementi strutturali che non comportino il collasso\ndell’impalcato."),
        p(179, "Sempre nell’ambito delle azioni eccezionali devono essere considerate quelle riportate nei seguenti paragrafi."),
    ]),
    U("5.2.2.9.1", "ROTTURA DELLA CATENARIA", 179, [
        p(179, "Si dovrà considerare l’eventualità che si verifichi la rottura della catenaria nel punto più sfavorevole per la struttura del ponte. La forza trasmessa alla struttura in conseguenza di un simile evento si considererà come una forza di natura statica agente in direzione parallela all’asse dei binari, di intensità pari a ± 20 kN e applicata sui sostegni alla quota del filo."),
        p(179, "In funzione del numero di binari presenti sull’opera si assumerà la rottura simultanea di:"),
        li(179, "1 catenaria per ponti con un binario;"), li(179, "2 catenarie per ponti con un numero di binari compreso fra 2 e 6;"), li(179, "3 catenarie per ponti con più di sei binari."),
        p(179, "Nelle verifiche saranno considerate rotte le catenarie che determinano l’effetto più sfavorevole."),
    ]),
    U("5.2.2.9.2", "DERAGLIAMENTO AL DI SOPRA DEL PONTE", 180, [
        p(180, "Oltre a considerare i modelli di carico verticale da traffico ferroviario, ai fini della verifica della struttura si dovrà tenere conto della possibilità alternativa che un locomotore o un carro pesante deragli, esaminando separatamente le due seguenti situazioni di progetto:", "Oltre a considerare i modelli di carico verticale da traffico ferroviario, ai fini della verifica della struttura si dovrà tenere conto\ndella possibilità alternativa che un locomotore o un carro pesante deragli, esaminando separatamente le due seguenti situazioni\ndi progetto:"),
        ih(180, "Caso 1:"),
        p(180, "Si considerano due carichi verticali lineari qA1d = 60 kN/m (comprensivo dell’effetto dinamico) ciascuno."),
        p(180, "Trasversalmente i carichi distano fra loro di S (scartamento del binario) e possono assumere tutte le posizioni comprese entro i limiti indicati in Fig. 5.2.12."), ref("figure-ref", 180, "5.2.12"),
        p(180, "Per questa condizione sono tollerati danni locali, purché possano essere facilmente riparati, mentre sono da evitare danneggiamenti delle strutture portanti principali."),
        ih(180, "Caso 2:"),
        p(180, "Si considera un unico carico lineare qA2d = 80 kN/m · 1,4 esteso per 20 m e disposto con una eccentricità massima, lato esterno, di 1,5 s rispetto all’asse del binario (Fig. 5.2.13). Per questa condizione convenzionale di carico andrà verificata la stabilità globale dell’opera, come il ribaltamento d’impalcato, il collasso della soletta, ecc.", "Si considera un unico carico lineare qA2d=80 kN/m.1,4 esteso per 20 m e disposto con una eccentricità massima, lato esterno, di 1,5\ns rispetto all’asse del binario (Fig. 5.2.13). Per questa condizione convenzionale di carico andrà verificata la stabilità globale\ndell’opera, come il ribaltamento d’impalcato, il collasso della soletta, ecc."),
        ref("figure-ref", 180, "5.2.13"),
        p(180, "Per impalcati metallici con armamento diretto, il caso 2 dovrà essere considerato solo per le verifiche globali."),
    ]),
    U("5.2.2.9.3", "DERAGLIAMENTO AL DI SOTTO DEL PONTE", 180, [
        p(180, "Nel posizionamento degli elementi strutturali in adiacenza della ferrovia, ad eccezione delle gallerie artificiali a parete continua, occorre tenere conto che per una zona di larghezza di 3,5 m misurata perpendicolarmente dall’asse del binario più vicino, vige il divieto di edificabilità."),
        p(180, "A distanze superiori di 4,50 m è consentita la realizzazione di pilastri isolati. Per distanze intermedie dovranno essere previsti elementi strutturali aventi rigidezza via via crescenti con il diminuire della distanza dal binario.", "A distanze superiori di 4,50 m è consentita la realizzazione di pilastri isolati. Per distanze intermedie dovranno essere previsti e-\nlementi strutturali aventi rigidezza via via crescenti con il diminuire della distanza dal binario."),
        p(180, "Le azioni prodotte dal treno deragliato sugli elementi verticali di sostegno adiacenti la sede ferroviaria sono indicate al § 3.6.3.4."),
    ]),
    U("5.2.2.10", "AZIONI INDIRETTE", 180),
    U("5.2.2.10.1", "DISTORSIONI", 180, [
        p(180, "Le distorsioni, quali ad esempio i cedimenti vincolari artificialmente provocati e non, sono da considerarsi azioni permanenti. Nei ponti in c.a., c.a.p. e a struttura mista i loro effetti vanno valutati tenendo conto dei fenomeni di viscosità."),
    ]),
    U("5.2.2.10.2", "RITIRO E VISCOSITÀ", 180, [
        p(180, "I coefficienti di ritiro e viscosità finali, salvo sperimentazione diretta, sono quelli indicati rispettivamente nei §§ 11.2.10.6 e 11.2.10.7."),
        p(181, "Qualora si debba provvedere al calcolo dell’ampiezza dei giunti e della corsa degli apparecchi di appoggio, gli effetti del ritiro e della viscosità dovranno essere valutati incrementando del 50% i valori di cui al precedente capoverso."),
        p(181, "Nella progettazione delle pile di un viadotto ferroviario deve considerarsi il ritiro differenziale fusto-fondazione (fusto-pulvino), considerando un plinto (pulvino) parzialmente stagionato, che non ha, quindi, ancora esaurito la relativa deformazione da ritiro."),
        p(181, "Conseguentemente a tale situazione si potrà considerare un valore di ritiro differenziale pari al 50% di quello a lungo termine, considerando un valore convenzionale del modulo di elasticità del calcestruzzo pari ad 1/3 di quello misurato."),
    ]),
    U("5.2.2.10.3", "RESISTENZE PARASSITE NEI VINCOLI", 181, [
        p(181, "Nel calcolo delle pile, delle spalle, delle fondazioni, degli stessi apparecchi d’appoggio e, se del caso, dell’impalcato, si devono considerare le forze che derivano dalle resistenze parassite dei vincoli. Le forze indotte dalla resistenza parassita nei vincoli saranno da esprimere in funzione del tipo di appoggio e del sistema di vincolo dell’impalcato."),
    ]),
    U("5.2.3", "PARTICOLARI PRESCRIZIONI PER LE VERIFICHE", 181),
    U("5.2.3.1", "COMBINAZIONE DEI TRENI DI CARICO E DELLE AZIONI DA ESSI DERIVATE PER PIÙ BINARI", 181),
    U("5.2.3.1.1", "NUMERO DI BINARI", 181, [
        p(181, "Salvo diversa prescrizione progettuale ciascun ponte dovrà essere progettato per il maggior numero di binari geometricamente compatibile con la larghezza dell’impalcato, a prescindere dal numero di binari effettivamente presenti."),
    ]),
    U("5.2.3.1.2", "NUMERO DI TRENI CONTEMPORANEI", 181, [
        p(181, "Nella progettazione dei ponti andrà considerata l’eventuale contemporaneità di più treni, secondo quanto previsto nella Tab. 5.2.III considerando, in genere, sia il traffico normale che il traffico pesante."), ref("table-ref", 181, "5.2.iii"),
        p(181, "Per strutture con 3 o più binari dovranno considerarsi due distinte condizioni: la prima che prevede caricati solo due binari (primo e secondo) considerando gli effetti più gravosi tra il caso “a” ed il traffico pesante; la seconda che prevede tutti i binari caricati con l’entità del carico corrispondente a quello fissato nel caso “b”.", "Per strutture con 3 o più binari dovranno considerarsi due distinte condizioni: la prima che prevede caricati solo due binari (pri-\nmo e secondo) considerando gli effetti più gravosi tra il caso “a” ed il traffico pesante; la seconda che prevede tutti i binari carica-\nti con l’entità del carico corrispondente a quello fissato nel caso “b”."),
        p(181, "Come “primo” binario si intende quello su cui disporre il treno più pesante per avere i massimi effetti sulla struttura. Per “secondo” binario si intende quello su cui viene disposto il secondo treno per avere, congiuntamente con il primo, i massimi effetti sulla struttura; pertanto, il “primo” e il “secondo” binario possono anche non essere contigui nel caso di ponti con 3 o più binari."),
        p(181, "Qualora la presenza del secondo treno o, eventualmente, dei successivi, riduca l’effetto in esame, essi non vanno considerati presenti."),
        p(181, "Tutti gli effetti delle azioni dovranno determinarsi con i carichi e le forze disposti nelle posizioni più sfavorevoli. Azioni che producano effetti favorevoli saranno trascurate (ad eccezione dei casi in cui si considerino i treni di carico SW i quali debbono considerarsi applicati per l’intera estensione del carico).", "Tutti gli effetti delle azioni dovranno determinarsi con i carichi e le forze disposti nelle posizioni più sfavorevoli. Azioni che pro-\nducano effetti favorevoli saranno trascurate (ad eccezione dei casi in cui si considerino i treni di carico SW i quali debbono consi-\nderarsi applicati per l’intera estensione del carico)."),
    ]),
];

const pageRecords = new Map<number, any>();
for (const page of Array.from({ length: 10 }, (_, index) => index + 172)) pageRecords.set(page, JSON.parse(await readFile(join(root, "evidence", sourceId, "pages", `page-${String(page).padStart(4, "0")}.json`), "utf8")));
const pageRegion = (page: number) => ({ coordinateSystem: "pdf-points-top-left", x: 73, y: 75, width: 455, height: Math.min(680, (pageRecords.get(page)?.page?.height ?? 842) - 100) });
function transformations(raw: string, normalized: string): any[] {
    if (raw === normalized) return [];
    return [
        { operation: "remove-control-character", ruleVersion, note: "Rimossi caratteri di controllo privi di resa visuale." },
        { operation: "remove-discretionary-hyphen", ruleVersion, note: "Unite le parole divise esclusivamente dall’andata a capo tipografica." },
        { operation: "join-line-wrap", ruleVersion, note: "Rimosse le andate a capo di impaginazione, conservando capoversi ed elenchi." },
        { operation: "manual-correction", ruleVersion, note: "Ripristinati i glifi matematici e i caratteri riconoscibili nel render ufficiale." },
        { operation: "normalize-whitespace", ruleVersion, note: "Uniformati gli spazi dopo la ricomposizione delle righe." },
        { operation: "unicode-nfc", ruleVersion, note: "Testo normalizzato in Unicode NFC." },
    ];
}
function makeBlock(number: string, index: number, def: Block): any {
    const blockId = `${unitId(number)}#block-${def.kind === "heading" && index === 0 ? "heading" : `editorial-${String(index).padStart(3, "0")}`}`;
    if (def.kind.endsWith("-ref")) return { blockId, kind: def.kind, origin: "official", assetId: def.assetId, evidence: { sourceId, pdfPage: def.page, printedPage: String(def.page - 4), region: pageRegion(def.page), extraction: { method: "manual-transcription", tool: "codex-source-transcription", toolVersion: ruleVersion }, transformations: [{ operation: "manual-correction", ruleVersion, note: "Asset collocato nel punto normativo originario; resta da revisionare puntualmente." }], rawSha256: sha256(def.assetId ?? blockId), normalizedSha256: sha256(def.assetId ?? blockId) } };
    const normalized = def.text ?? "";
    const raw = def.raw ?? normalized;
    return { blockId, kind: def.kind, origin: "official", text: { raw, normalized, normalizationVersion: ruleVersion, inline: def.inline }, evidence: { sourceId, pdfPage: def.page, printedPage: String(def.page - 4), region: pageRegion(def.page), extraction: { method: "pdf-text", tool: "pdfjs-dist", toolVersion: "4.10.38" }, transformations: transformations(raw, normalized), rawSha256: sha256(raw), normalizedSha256: sha256(normalized) } };
}
function parent(number: string): string | null { const parts = number.split("."); return parts.length === 1 ? null : parts.slice(0, -1).join("."); }
function ancestors(number: string): string[] { const parts = number.split("."); return Array.from({ length: parts.length - 1 }, (_, index) => unitId(parts.slice(0, index + 1).join("."))); }
function kind(number: string): string { const depth = number.split(".").length; return depth === 1 ? "chapter" : depth === 2 ? "section" : depth === 3 ? "paragraph" : "subparagraph"; }
function makeUnit(def: UnitDef): any {
    const editorialBlocks = def.number === "5.2.2.6.3"
        ? def.blocks.filter((block) => !block.text?.startsWith("k3 = (7,5 − hg)/3,7"))
        : def.blocks;
    const blocks = editorialBlocks.map((block, index) => {
        const stableIndex = def.number === "5.2.2.2.3" && block.page >= 172 ? index + 2 : index;
        return makeBlock(def.number, stableIndex, block);
    });
    const ids = { formulaIds: blocks.filter((b) => b.assetId?.includes(":formula:")).map((b) => b.assetId), tableIds: blocks.filter((b) => b.assetId?.includes(":table:")).map((b) => b.assetId), figureIds: blocks.filter((b) => b.assetId?.includes(":figure:")).map((b) => b.assetId) };
    const issues: any[] = [{ issueId: `ntc2018-${def.number.replaceAll(".", "-")}-source-review`, type: "normalization-review", severity: "blocking", note: "Record trascritto dall’evidence ufficiale ma non ancora confrontato integralmente da un revisore umano con il render della fonte." }];
    if (Object.values(ids).some((items) => items.length)) issues.push({ issueId: `ntc2018-${def.number.replaceAll(".", "-")}-assets`, type: "asset-review", severity: "blocking", note: "Formule, tabelle e figure sono collocate nel punto originario; resta obbligatorio il confronto umano puntuale con la fonte ufficiale." });
    if (def.number === "5.2.2.3.1") issues.push({ issueId: "ntc2018-5-2-2-3-1-duplicate-formula-number", type: "other", severity: "blocking", note: "La fonte stampa [5.2.10] sia per la formula del fattore f sia per quella della distanza fittizia a’g; i due asset sono mantenuti distinti con identificatori tecnici diversi e lo stesso numero ufficiale." });
    return { $schema: "urn:structural-codes:schema:canonical-unit:v2", schemaVersion: "2.0.0-alpha.2", recordType: "canonical-unit", id: unitId(def.number), workId, expressionId, kind: kind(def.number), numbering: { official: def.number, sortKey: def.number.split(".").map((part) => part.padStart(3, "0")).join(".") }, title: def.title, titleBlockId: `${unitId(def.number)}#block-heading`, hierarchy: { parentId: parent(def.number) ? unitId(parent(def.number) as string) : null, ancestorIds: ancestors(def.number), position: Number(def.number.split(".").at(-1)) }, validity: { from: "2018-03-22", to: null, status: "in-force", asOf: "2026-08-09" }, blocks, citations: [], relations: [], assets: ids, workflow: { status: "extracted", createdBy: { actorId: "codex:ntc5-step3", kind: "automated-agent", toolVersion: ruleVersion }, createdAt, reviews: [], openIssues: issues } };
}
const cell = (text: string, extra: Record<string, unknown> = {}) => ({ text, ...extra });
const tables: any[] = [
    { id: asset("table", "5.2.ii"), unitId: unitId("5.2.2.2.3"), officialNumber: "5.2.II", pdfPage: 172, caption: "Tab. 5.2.II - Lunghezza caratteristica LΦ", columnCount: 3, headers: [[cell("Caso"), cell("Elemento strutturale"), cell("Lunghezza LΦ", { latex: "\\text{Lunghezza }L_\\Phi" })]], rows: [
        [cell(""), cell("IMPALCATO DI PONTE IN ACCIAIO CON BALLAST (LASTRA ORTOTROPA O STRUTTURA EQUIVALENTE)", { colSpan: 2 })],
        [cell("1"), cell("Piastra con nervature longitudinali e trasversali, o solo longitudinali: 1.1 Piastra (in entrambe le direzioni)"), cell("3 volte l’interasse delle travi trasversali")],
        [cell("1"), cell("1.2 Nervature longitudinali (comprese mensole fino a 0,50 m)"), cell("3 volte l’interasse delle travi trasversali")],
        [cell("1"), cell("1.3 Travi trasversali: intermedie e di estremità"), cell("2 volte la luce delle travi trasversali")],
        [cell("2"), cell("Piastre con sole nervature trasversali: 2.1 Piastra (per entrambe le direzioni)"), cell("2 volte l’interasse delle travi trasversali + 3 m")],
        [cell("2"), cell("2.2 Travi trasversali intermedie"), cell("2 volte la luce delle travi trasversali")],
        [cell("2"), cell("2.3 Travi trasversali d’estremità"), cell("luce della trave trasversale")],
        [cell(""), cell("IMPALCATO DI PONTE IN ACCIAIO SENZA BALLAST (PER TENSIONI LOCALI)", { colSpan: 2 })],
        [cell("3"), cell("3.1 Sostegni per rotaie (longherine): come elemento di un grigliato"), cell("3 volte l’interasse delle travi trasversali")],
        [cell("3"), cell("3.1 Sostegni per rotaie (longherine): come elemento semplicemente appoggiato"), cell("distanza fra le travi trasversali + 3 m")],
        [cell("3"), cell("3.2 Sostegni per rotaie a mensola (longherine a mensola) per travi trasversali di estremità"), cell("Φ₃ = 2,0, ove non meglio specificato", { latex: "\\Phi_3=2{,}0,\\quad\\text{ove non meglio specificato}" })],
        [cell("3"), cell("3.3 Travi trasversali intermedie"), cell("2 volte la luce delle travi trasversali")], [cell("3"), cell("3.4 Travi trasversali d’estremità"), cell("luce della trave trasversale")],
        [cell(""), cell("IMPALCATO DI PONTE IN CALCESTRUZZO CON BALLAST (PER IL CALCOLO DEGLI EFFETTI LOCALI E TRASVERSALI)", { colSpan: 2 })],
        [cell("4"), cell("4.1 Solette superiori e traversi di impalcati a sezione scatolare o a graticcio di travi: nella direzione trasversale alle travi principali"), cell("3 volte la luce della soletta")],
        [cell("4"), cell("4.1 ... nella direzione longitudinale"), cell("3 volte la luce della soletta d’impalcato o, se minore, la lunghezza caratteristica della trave principale")],
        [cell("4"), cell("4.1 ... mensole trasversali supportanti carichi ferroviari: se e>0,50 m, essendo e la distanza fra l’asse della rotaia più esterna e il filo esterno dell’anima più esterna della struttura principale longitudinale, occorre uno studio specifico."), cell("3 volte la distanza fra le anime della struttura principale longitudinale")],
        [cell("4"), cell("4.2 Soletta continua su travi trasversali (nella direzione delle travi principali)"), cell("2 volte l’interasse delle travi trasversali")],
        [cell("4"), cell("4.3 Solette per ponti a via inferiore: ordite perpendicolarmente alle travi principali"), cell("2 volte la luce della soletta")],
        [cell("4"), cell("4.3 Solette per ponti a via inferiore: ordite parallelamente alle travi principali"), cell("2 volte la luce della soletta o, se minore, la lunghezza caratteristica delle travi principali")],
        [cell("4"), cell("4.4 Impalcati a travi incorporate tessute ortogonalmente all’asse del binario"), cell("2 volte la lunghezza caratteristica in direzione longitudinale")],
        [cell("4"), cell("4.5 Mensole longitudinali supportanti carichi ferroviari (per le azioni in direzione longitudinale)"), cell("se e≤0,5: m Φ₂=1,67; per e>0,5 m v. (4.1)", { latex: "\\text{se }e\\le0{,}5:\\,\\mathrm{m}\\;\\Phi_2=1{,}67;\\quad\\text{per }e>0{,}5\\,\\mathrm{m}\\;\\text{v. (4.1)}" })],
        [cell(""), cell("TRAVI PRINCIPALI", { colSpan: 2 })],
        [cell("5"), cell("5.1 Travi e solette semplicemente appoggiate (compresi i solettoni a travi incorporate)"), cell("luce nella direzione delle travi principali")],
        [cell("5"), cell("5.2 Travi e solette continue su n luci, indicando con: Lₘ = 1/n · (L₁+L₂+.....+Lₙ)", { latex: "\\begin{gathered}\\text{5.2 Travi e solette continue su }n\\text{ luci, indicando con:}\\\\L_m=\\frac{1}{n}\\cdot(L_1+L_2+\\ldots+L_n)\\end{gathered}" }), cell("LΦ = kLₘ dove: n = 2-3-4-≥5; k = 1,2-1,3-1,4-1,5", { latex: "\\begin{gathered}L_\\Phi=kL_m\\quad\\text{dove:}\\\\n=2-3-4-\\ge5\\\\k=1{,}2-1{,}3-1{,}4-1{,}5\\end{gathered}" })],
        [cell("5"), cell("5.3 Portali: a luce singola"), cell("da considerare come trave continua a tre luci (usando la 5.2 considerando le altezze dei piedritti e la lunghezza del traverso)")],
        [cell("5"), cell("5.3 Portali: a luci multiple"), cell("da considerare come trave continua a più luci (usando la 5.2 considerando le altezze dei piedritti terminali e la lunghezza di tutti i traversi)")],
        [cell("5"), cell("5.4 Solette ed altri elementi di scatolari per uno o più binari (sottovia di altezza libera ≤5,0 m e luce libera ≤8,0 m). Per gli scatolari che non rispettano i precedenti limiti vale il punto 5.3, trascurando la presenza della soletta inferiore e considerando un coefficiente riduttivo del Φ pari a 0,9, da applicare al coefficiente Φ"), cell("Φ₂ = 1,20; Φ₃ = 1,35", { latex: "\\Phi_2=1{,}20;\\quad\\Phi_3=1{,}35" })],
        [cell("5"), cell("5.5 Travi ad asse curvilineo, archi a spinta eliminata, archi senza riempimento."), cell("metà della luce libera")],
        [cell("5"), cell("5.6 Archi e serie di archi con riempimento"), cell("due volte la luce libera")],
        [cell("5"), cell("5.7 Strutture di sospensione (di collegamento a travi di irrigidimento)"), cell("4 volte la distanza longitudinale fra le strutture di sospensione")],
        [cell(""), cell("SUPPORTI STRUTTURALI", { colSpan: 2 })],
        [cell("6"), cell("6.1 Pile con snellezza λ>30", { latex: "\\text{6.1 Pile con snellezza }\\lambda>30" }), cell("somma delle lunghezze delle campate adiacenti la pila")],
        [cell("6"), cell("6.2 Appoggi, calcolo delle tensioni di contatto al di sotto degli stessi e tiranti di sospensione"), cell("lunghezza degli elementi sostenuti")],
    ], notes: [] },
    { id: asset("table", "5.2.ii.b"), unitId: unitId("5.2.2.3.1"), officialNumber: "5.2.II.b", pdfPage: 174, caption: "Tab. 5.2.II.b - Parametri per determinazione della forza centrifuga", columnCount: 7, headers: [[cell("Valore di α", { latex: "\\text{Valore di }\\alpha" }), cell("Massima velocità della linea [Km/h]"), cell("V", { latex: "V" }), cell("α", { latex: "\\alpha" }), cell("f", { latex: "f" }), cell("Azione centrifuga basata su"), cell("Carico verticale associato")]], rows: [
        [cell("SW/2", { latex: "\\mathrm{SW/2}" }), cell("≥ 100", { latex: "\\ge100" }), cell("100", { latex: "100" }), cell("1", { latex: "1" }), cell("1", { latex: "1" }), cell("1 × 1 × SW/2", { latex: "1\\times1\\times\\mathrm{SW/2}" }), cell("Φ × 1 × 1 × SW/2", { latex: "\\Phi\\times1\\times1\\times\\mathrm{SW/2}" })],
        [cell("SW/2", { latex: "\\mathrm{SW/2}" }), cell("< 100", { latex: "<100" }), cell("V", { latex: "V" }), cell("1", { latex: "1" }), cell("1", { latex: "1" }), cell("1 × 1 × SW/2", { latex: "1\\times1\\times\\mathrm{SW/2}" }), cell("Φ × 1 × 1 × SW/2", { latex: "\\Phi\\times1\\times1\\times\\mathrm{SW/2}" })],
        [cell("LM71 e SW/0"), cell("> 120", { latex: ">120" }), cell("V", { latex: "V" }), cell("1", { latex: "1" }), cell("f", { latex: "f" }), cell("1 × f × (LM71 “+” SW/0)", { latex: "1\\times f\\times(\\mathrm{LM71}\\mathbin{\\text{“+”}}\\mathrm{SW/0})" }), cell("Φ × 1 × 1 × (LM71 “+” SW/0)", { latex: "\\Phi\\times1\\times1\\times(\\mathrm{LM71}\\mathbin{\\text{“+”}}\\mathrm{SW/0})" })],
        [cell("LM71 e SW/0"), cell("> 120", { latex: ">120" }), cell("120", { latex: "120" }), cell("α", { latex: "\\alpha" }), cell("1", { latex: "1" }), cell("α × 1 × (LM71 “+” SW/0)", { latex: "\\alpha\\times1\\times(\\mathrm{LM71}\\mathbin{\\text{“+”}}\\mathrm{SW/0})" }), cell("Φ × α × 1 × (LM71 “+” SW/0)", { latex: "\\Phi\\times\\alpha\\times1\\times(\\mathrm{LM71}\\mathbin{\\text{“+”}}\\mathrm{SW/0})" })],
        [cell("LM71 e SW/0"), cell("≤ 120", { latex: "\\le120" }), cell("V", { latex: "V" }), cell("α", { latex: "\\alpha" }), cell("1", { latex: "1" }), cell("α × 1 × (LM71 “+” SW/0)", { latex: "\\alpha\\times1\\times(\\mathrm{LM71}\\mathbin{\\text{“+”}}\\mathrm{SW/0})" }), cell("Φ × α × 1 × (LM71 “+” SW/0)", { latex: "\\Phi\\times\\alpha\\times1\\times(\\mathrm{LM71}\\mathbin{\\text{“+”}}\\mathrm{SW/0})" })],
    ], notes: ["La composizione grafica delle intestazioni e delle celle è stata resa in celle strutturate; mantenere issue di revisione umana sul PDF."] },
    { id: asset("table", "5.2.iii"), unitId: unitId("5.2.3.1.2"), officialNumber: "5.2.III", pdfPage: 181, caption: "Tab. 5.2.III - Carichi mobili in funzione del numero di binari presenti sul ponte", columnCount: 5, headers: [[cell("Numero di binari"), cell("Binari / Carichi"), cell("Traffico normale: caso a(1)"), cell("Traffico normale: caso b(1)"), cell("Traffico pesante(2)")]], rows: [
        [cell("1"), cell("Primo"), cell("1,0 (LM71 “+” SW/0)", { latex: "1{,}0\\,(\\mathrm{LM71}\\mathbin{\\text{“+”}}\\mathrm{SW/0})" }), cell("-"), cell("1,0 SW/2", { latex: "1{,}0\\,\\mathrm{SW/2}" })],
        [cell("2"), cell("Primo"), cell("1,0 (LM71 “+” SW/0)", { latex: "1{,}0\\,(\\mathrm{LM71}\\mathbin{\\text{“+”}}\\mathrm{SW/0})" }), cell("-"), cell("1,0 SW/2", { latex: "1{,}0\\,\\mathrm{SW/2}" })],
        [cell("2"), cell("secondo"), cell("1,0 (LM71 “+” SW/0)", { latex: "1{,}0\\,(\\mathrm{LM71}\\mathbin{\\text{“+”}}\\mathrm{SW/0})" }), cell("-"), cell("1,0 (LM71 “+” SW/0)", { latex: "1{,}0\\,(\\mathrm{LM71}\\mathbin{\\text{“+”}}\\mathrm{SW/0})" })],
        [cell("≥3", { latex: "\\ge3" }), cell("Primo"), cell("1,0 (LM71 “+” SW/0)", { latex: "1{,}0\\,(\\mathrm{LM71}\\mathbin{\\text{“+”}}\\mathrm{SW/0})" }), cell("0,75 (LM71 “+” SW/0)", { latex: "0{,}75\\,(\\mathrm{LM71}\\mathbin{\\text{“+”}}\\mathrm{SW/0})" }), cell("1,0 SW/2", { latex: "1{,}0\\,\\mathrm{SW/2}" })],
        [cell("≥3", { latex: "\\ge3" }), cell("secondo"), cell("1,0 (LM71 “+” SW/0)", { latex: "1{,}0\\,(\\mathrm{LM71}\\mathbin{\\text{“+”}}\\mathrm{SW/0})" }), cell("0,75 (LM71 “+” SW/0)", { latex: "0{,}75\\,(\\mathrm{LM71}\\mathbin{\\text{“+”}}\\mathrm{SW/0})" }), cell("1,0 (LM71 “+” SW/0)", { latex: "1{,}0\\,(\\mathrm{LM71}\\mathbin{\\text{“+”}}\\mathrm{SW/0})" })],
        [cell("≥3", { latex: "\\ge3" }), cell("Altri"), cell("-"), cell("0,75 (LM71 “+” SW/0)", { latex: "0{,}75\\,(\\mathrm{LM71}\\mathbin{\\text{“+”}}\\mathrm{SW/0})" }), cell("-")],
    ], notes: ["(1) LM71 “+” SW/0 significa considerare il più sfavorevole fra i treni LM 71, SW/0.", "(2) Salvo i casi in cui sia esplicitamente escluso."] },
];
const figureDefs: Array<[string, string, number, string, string, string, { x: number; y: number; width: number; height: number }]> = [
    ["5.2.7", "5.2.2.2.3", 171, "Fig. 5.2.7 - Limiti delle frequenze proprie n₀ in Hz in funzione della luce della campata", "Limiti delle frequenze proprie in funzione della luce della campata", "fig5.2.7.png", { x: 70, y: 315, width: 460, height: 145 }],
    ["5.2.8", "5.2.2.6.1", 177, "Fig. 5.2.8 - Valori caratteristici delle azioni q1k per superfici verticali parallele al binario", "Valori caratteristici delle azioni q1k per superfici verticali parallele al binario", "fig5.2.8.png", { x: 105, y: 140, width: 390, height: 170 }],
    ["5.2.9", "5.2.2.6.2", 178, "Fig. 5.2.9 - Valori caratteristici delle azioni q2k per superfici orizzontali al di sopra del binario", "Valori caratteristici delle azioni q2k per superfici orizzontali al di sopra del binario", "fig5.2.9.png", { x: 105, y: 75, width: 390, height: 235 }],
    ["5.2.10", "5.2.2.6.3", 178, "Fig. 5.2.10 - Valori caratteristici delle azioni q3k per superfici orizzontali adiacenti il binario", "Valori caratteristici delle azioni q3k per superfici orizzontali adiacenti il binario", "fig5.2.10.png", { x: 105, y: 325, width: 390, height: 195 }],
    ["5.2.11", "5.2.2.6.4", 179, "Fig. 5.2.11 - Definizione della distanza max ag e min ag dall’asse del binario", "Definizione della distanza max ag e min ag dall’asse del binario", "fig5.2.11.png", { x: 140, y: 70, width: 320, height: 205 }],
    ["5.2.12", "5.2.2.9.2", 180, "Fig. 5.2.12 - Caso 1", "Deragliamento al di sopra del ponte, caso 1", "fig5.2.12.png", { x: 165, y: 235, width: 330, height: 100 }],
    ["5.2.13", "5.2.2.9.2", 180, "Fig. 5.2.13 - Caso 2", "Deragliamento al di sopra del ponte, caso 2", "fig5.2.13.png", { x: 165, y: 390, width: 330, height: 115 }],
];
const figures: any[] = figureDefs.map(([n, u, page, caption, alt, filename, r]) => ({ id: asset("figure", n), unitId: unitId(u), officialNumber: n, pdfPage: page, caption, alt, imagePath: `figures/ntc2018/${filename}`, region: { coordinateSystem: "pdf-points-top-left", ...r }, sha256: "" }));
const formulas: any[] = [
    ["5.2.2", "5.2.2.2.3", "5.2.2", 171, "n_0=94{,}76\\cdot L^{-0{,}748}"], ["5.2.3", "5.2.2.2.3", "5.2.3", 171, "n_0=80/L\\qquad\\text{per}\\quad4\\,\\mathrm{m}\\le L\\le20\\,\\mathrm{m}"], ["5.2.4", "5.2.2.2.3", "5.2.4", 171, "n_0=23{,}58\\cdot L^{-0{,}592}\\qquad\\text{per}\\quad20\\,\\mathrm{m}\\le L\\le100\\,\\mathrm{m}"], ["5.2.5", "5.2.2.2.3", "5.2.5", 171, "n_0=\\frac{17{,}75}{\\sqrt{\\delta_0}}\\;[\\mathrm{Hz}]"], ["5.2.6", "5.2.2.2.3", "5.2.6", 171, "\\Phi_2=\\frac{1{,}44}{\\sqrt{L_\\Phi}-0{,}2}+0{,}82\\qquad\\text{con la limitazione}\\quad1{,}00\\le\\Phi_2\\le1{,}67"], ["5.2.7", "5.2.2.2.3", "5.2.7", 171, "\\Phi_3=\\frac{2{,}16}{\\sqrt{L_\\Phi}-0{,}2}+0{,}73\\qquad\\text{con la limitazione}\\quad1{,}00\\le\\Phi_3\\le2{,}00"], ["5.2.8", "5.2.2.2.3", "5.2.8", 173, "\\Phi_{rid}=\\Phi-\\frac{h-1{,}00}{10}\\ge1{,}0"], ["5.2.9.a", "5.2.2.3.1", "5.2.9.a", 173, "Q_{tk}=\\frac{v^2}{g\\,r}(f\\,\\alpha Q_{vk})=\\frac{V^2}{127\\,r}(f\\,\\alpha Q_{vk})"], ["5.2.9.b", "5.2.2.3.1", "5.2.9.b", 173, "q_{tk}=\\frac{v^2}{g\\,r}(f\\,\\alpha q_{vk})=\\frac{V^2}{127\\,r}(f\\,\\alpha q_{vk})"], ["5.2.10-force", "5.2.2.3.1", "5.2.10", 174, "f=\\left[1-\\frac{V-120}{1000}\\left(\\frac{814}{V}+1{,}75\\right)\\right]\\left[1-\\sqrt{\\frac{2{,}88}{L_f}}\\right]"], ["5.2.10-distance", "5.2.2.6.4", "5.2.10", 178, "a'_g=0{,}6\\,\\min a_g+0{,}4\\,\\max a_g"],
].map(([id, u, officialNumber, page, latex]) => ({ id: asset("formula", id as string), unitId: unitId(u as string), officialNumber, pdfPage: page, latex }));

const formulaCorrections = new Map<string, string>([
    ["5.2.9.a", "Q_{tk}=\\frac{v^2}{g\\cdot r}\\cdot(f\\cdot\\alpha Q_{vk})=\\frac{V^2}{127\\cdot r}\\cdot(f\\cdot\\alpha Q_{vk})"],
    ["5.2.9.b", "q_{tk}=\\frac{v^2}{g\\cdot r}\\cdot(f\\cdot\\alpha q_{vk})=\\frac{V^2}{127\\cdot r}\\cdot(f\\cdot\\alpha q_{vk})"],
    ["5.2.10-force", "f=\\left[1-\\frac{V-120}{1000}\\left(\\frac{814}{V}+1{,}75\\right)\\cdot\\left(1-\\sqrt{\\frac{2{,}88}{L_f}}\\right)\\right]"],
]);
for (const formula of formulas) {
    const suffix = formula.id.split(":").at(-1) as string;
    if (formulaCorrections.has(suffix)) formula.latex = formulaCorrections.get(suffix);
}
for (const [id, u, page, latex] of [
    ["5.2.2.2.3-beta", "5.2.2.2.3", 173, "\\begin{aligned}\\beta&=1{,}0\\quad\\text{per }L_\\Phi\\le8\\,\\mathrm{m}\\text{ ed }L_\\Phi>90\\,\\mathrm{m}\\\\\\beta&=1{,}1\\quad\\text{per }8\\,\\mathrm{m}<L_\\Phi\\le90\\,\\mathrm{m}\\end{aligned}"],
    ["5.2.2.3.3-starting", "5.2.2.3.3", 174, "\\begin{aligned}\\text{avviamento:}\\quad Q_{la,k}&=33\\,[\\mathrm{kN/m}]\\cdot L[\\mathrm{m}]\\le1000\\,\\mathrm{kN}\\quad\\text{per modelli di carico LM 71, SW/0,}\\\\&\\hspace{15.5em}\\text{SW/2}\\end{aligned}"],
    ["5.2.2.3.3-braking", "5.2.2.3.3", 175, "\\begin{aligned}\\text{frenatura:}\\quad Q_{lb,k}&=20\\,[\\mathrm{kN/m}]\\cdot L[\\mathrm{m}]\\le6000\\,\\mathrm{kN}\\quad\\text{per modelli di carico LM 71, SW/0}\\\\Q_{lb,k}&=35\\,[\\mathrm{kN/m}]\\cdot L[\\mathrm{m}]\\quad\\text{per modelli di carico SW/2}\\end{aligned}"],
    ["5.2.2.6.1-k1", "5.2.2.6.1", 177, "\\begin{aligned}k_1&=0{,}85\\quad\\text{per convogli formati da carrozze con sagoma arrotondata;}\\\\k_1&=0{,}60\\quad\\text{per treni aerodinamici.}\\end{aligned}"],
    ["5.2.2.6.3-k3", "5.2.2.6.3", 177, "\\begin{aligned}k_3&=\\frac{7{,}5-h_g}{3{,}7}\\quad\\text{per }3{,}8\\,\\mathrm{m}<h_g<7{,}5\\,\\mathrm{m};\\\\k_3&=0\\quad\\text{per }h_g\\ge7{,}5\\,\\mathrm{m}\\end{aligned}"],
] as Array<[string, string, number, string]>) formulas.push({ id: asset("formula", id), unitId: unitId(u), officialNumber: null, pdfPage: page, latex });

const assetManifest: any = { $schema: "urn:structural-codes:schema:asset-manifest:v2", schemaVersion: "2.0.0-alpha.1", recordType: "asset-manifest", document: "ntc2018", section: "5.1-step3", sourceId, status: "transcribed-unreviewed", formulas, tables, figures };
const unitOutput = join(root, "corpus", "units", "ntc2018");
const assetOutput = join(root, "corpus", "assets", "ntc2018", "5.1-step3.json");
await mkdir(unitOutput, { recursive: true });
for (const figure of assetManifest.figures) figure.sha256 = sha256(await readFile(join(root, "corpus", "assets", figure.imagePath)));
for (const def of units) await writeFile(join(unitOutput, `${def.number}.json`), `${JSON.stringify(makeUnit(def), null, 2)}\n`, "utf8");
await writeFile(assetOutput, `${JSON.stringify(assetManifest, null, 2)}\n`, "utf8");
console.log(`NTC5 step3: ${units.length} unità e manifest asset scritto.`);
