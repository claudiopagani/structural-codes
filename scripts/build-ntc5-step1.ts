/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, no-useless-escape */
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

type Inline =
    | { kind: "text"; value: string }
    | { kind: "math"; value: string; latex: string };
type BlockDef = {
    kind: "heading" | "paragraph" | "list-item" | "formula-ref" | "table-ref" | "figure-ref";
    page: number;
    text?: string;
    raw?: string;
    assetId?: string;
    inline?: Inline[];
};
type UnitDef = {
    number: string;
    title: string;
    blocks: BlockDef[];
};

const asset = (kind: "formula" | "table" | "figure", suffix: string) =>
    `urn:structural-codes:it:asset:${kind}:ntc2018:${suffix}`;

function sha256(value: string): string {
    return createHash("sha256").update(value, "utf8").digest("hex");
}

function inlineMath(text: string): Inline[] {
    const decimal = (value: string) => value.replace(",", "{,}");
    const quantity = (value: string) => {
        const match = value.match(/^(\d+(?:,\d+)?)\s*(kN\/m²|kN\/m|kN|m²|mm²|cm²|mm|cm|m)$/u);
        if (!match) return value;
        const units: Record<string, string> = {
            "kN/m²": "\\mathrm{kN/m^2}",
            "kN/m": "\\mathrm{kN/m}",
            kN: "\\mathrm{kN}",
            "m²": "\\mathrm{m^2}",
            "mm²": "\\mathrm{mm^2}",
            "cm²": "\\mathrm{cm^2}",
            mm: "\\mathrm{mm}",
            cm: "\\mathrm{cm}",
            m: "\\mathrm{m}",
        };
        return `${decimal(match[1] ?? "")}\\,${units[match[2] ?? ""]}`;
    };
    const patterns: Array<[RegExp, string | ((match: RegExpExecArray) => string)]> = [
        [/Qv = Σi 2Qik/g, "Q_v=\\sum_i2Q_{ik}"],
        [/Ψ([012])j\s*=\s*(\d+,\d+)/g, (match) => `\\psi_{${match[1]}j}=${decimal(match[2] ?? "")}`],
        [/Ψ([01])(?!j)/g, (match) => `\\psi_${match[1]}`],
        [/Tr\s*=\s*(\d+(?:,\d+)?)/g, (match) => `T_r=${decimal(match[1] ?? "")}`],
        [/h1\s*=/g, "h_1="],
        [/h2\s*=\s*1,00 m/g, "h_2=1{,}00\\,\\mathrm{m}"],
        [/≤\s*5,0 m/g, "\\le5{,}0\\,\\mathrm{m}"],
        [/45°/g, "45^\\circ"],
        [/2\/3/g, "2/3"],
        [/\d+(?:,\d+)?\s*(?:kN\/m²|kN\/m|kN|m²|mm²|cm²|mm|cm|m)/g, (match) => quantity(match[0])],
        [/\d+,\d+/g, (match) => decimal(match[0])],
        [/qL,a/g, "q_{L,a}"],
        [/qL,b/g, "q_{L,b}"],
        [/qL,c/g, "q_{L,c}"],
        [/Qik/g, "Q_{ik}"],
        [/qik/g, "q_{ik}"],
        [/Qv/g, "Q_v"],
        [/Q1k/g, "Q_{1k}"],
        [/q1k/g, "q_{1k}"],
        [/w1/g, "w_1"],
        [/wl/g, "w_l"],
        [/nl/g, "n_l"],
        [/Tr/g, "T_r"],
        [/ε1/g, "\\varepsilon_1"],
        [/ε2/g, "\\varepsilon_2"],
        [/ε3/g, "\\varepsilon_3"],
        [/ε4/g, "\\varepsilon_4"],
        [/q([1-9])/g, "q_{$1}"],
        [/g([1-3])/g, "g_{$1}"],
        [/Ψ0j/g, "\\psi_{0j}"],
        [/Ψ1j/g, "\\psi_{1j}"],
        [/Ψ2j/g, "\\psi_{2j}"],
        [/Ed/g, "E_d"],
        [/Rd/g, "R_d"],
        [/Cd/g, "C_d"],
        [/h1/g, "h_1"],
        [/h2/g, "h_2"],
        [/(?<=quota )h\b/g, "h"],
        [/\bR\b/g, "R"],
        [/(?<=essendo )L\b/g, "L"],
        [/(?<= e )L(?= la lunghezza)/g, "L"],
        [/(?<= in )m(?=\.)/g, "\\mathrm{m}"],
        [/(?<=: )E$/g, "E"],
        [/(?<=: )A$/g, "A"],
    ];
    let cursor = 0;
    const matches: Array<{ start: number; end: number; value: string; latex: string }> = [];
    for (const [pattern, latex] of patterns) {
        pattern.lastIndex = 0;
        let match: RegExpExecArray | null;
        while ((match = pattern.exec(text)) !== null) {
            const start = match.index;
            const end = start + match[0].length;
            if (matches.some((item) => start < item.end && end > item.start)) continue;
            matches.push({
                start,
                end,
                value: match[0],
                latex: typeof latex === "function" ? latex(match) : latex.replace("$1", match[1] ?? ""),
            });
        }
    }
    matches.sort((a, b) => a.start - b.start);
    const result: Inline[] = [];
    for (const match of matches) {
        if (match.start > cursor) result.push({ kind: "text", value: text.slice(cursor, match.start) });
        result.push({ kind: "math", value: match.value, latex: match.latex });
        cursor = match.end;
    }
    if (cursor < text.length) result.push({ kind: "text", value: text.slice(cursor) });
    return result.length === 0 ? [{ kind: "text", value: text }] : result;
}

const p = (page: number, text: string, raw = text, inline = inlineMath(text)): BlockDef => ({
    kind: "paragraph",
    page,
    text,
    raw,
    inline,
});
const li = (page: number, text: string, raw = text, inline = inlineMath(text)): BlockDef => ({
    kind: "list-item",
    page,
    text,
    raw,
    inline,
});
const heading = (page: number, number: string, title: string, raw = `${number}. ${title}`): BlockDef => {
    const text = `${number} ${title}`;
    const inline = inlineMath(text);
    return {
        kind: "heading",
        page,
        text,
        raw,
        ...(inline.some((segment) => segment.kind === "math") ? { inline } : {}),
    };
};
const innerHeading = (page: number, text: string): BlockDef => ({
    kind: "heading",
    page,
    text,
    raw: text,
});
const ref = (kind: "formula-ref" | "table-ref" | "figure-ref", page: number, suffix: string): BlockDef => ({
    kind,
    page,
    assetId: asset(kind.replace("-ref", "") as "formula" | "table" | "figure", suffix),
});

const units: UnitDef[] = [
    {
        number: "5",
        title: "PONTI",
        blocks: [heading(153, "5", "PONTI", "CCAPITOLO 5.\nPONTI")],
    },
    {
        number: "5.1",
        title: "PONTI STRADALI",
        blocks: [heading(154, "5.1", "PONTI STRADALI")],
    },
    {
        number: "5.1.1",
        title: "OGGETTO",
        blocks: [
            heading(154, "5.1.1", "OGGETTO"),
            p(154, "Il presente capitolo contiene i criteri generali e le indicazioni tecniche per la progettazione e l’esecuzione dei ponti stradali."),
            p(154, "Nel seguito col termine “ponti” si intendono anche tutte quelle opere che, in relazione alle loro diverse destinazioni, vengono normalmente indicate con nomi particolari, quali: viadotti, sottovia o cavalcavia, sovrappassi, sottopassi, strade sopraelevate, ecc.", "Nel seguito col termine “ponti” si intendono anche tutte quelle opere che, in relazione alle loro diverse destinazioni, vengono nor-\nmalmente indicate con nomi particolari, quali: viadotti, sottovia o cavalcavia, sovrappassi, sottopassi, strade sopraelevate, ecc."),
            p(154, "Le prescrizioni fornite, per quanto applicabili, riguardano anche i ponti mobili."),
        ],
    },
    {
        number: "5.1.2",
        title: "PRESCRIZIONI GENERALI",
        blocks: [heading(154, "5.1.2", "PRESCRIZIONI GENERALI")],
    },
    {
        number: "5.1.2.1",
        title: "GEOMETRIA DELLA SEDE STRADALE",
        blocks: [
            heading(154, "5.1.2.1", "GEOMETRIA DELLA SEDE STRADALE", "5.1.2.1 G EOMETRIA DELLA SEDE STRADALE"),
            p(154, "Ai fini della presente normativa, per larghezza della sede stradale del ponte si intende la distanza misurata ortogonalmente all’asse stradale tra i punti più esterni dell’impalcato.", "Ai fini della presente normativa, per larghezza della sede stradale del ponte si intende la distanza misurata ortogonalmente\nall’asse stradale tra i punti più esterni dell’impalcato."),
            p(154, "La sede stradale sul ponte è composta dalla piattaforma, eventualmente divisa da uno spartitraffico e composta dalle corsie e dalle banchine, dai cordoli e laddove previsti dai marciapiedi, a seconda dell’importanza, della funzione e delle caratteristiche della strada.", "La sede stradale sul ponte è composta dalla piattaforma, eventualmente divisa da uno spartitraffico e composta dalle corsie e dal-\nle banchine, dai cordoli e laddove previsti dai marciapiedi, a seconda dell’importanza, della funzione e delle caratteristiche della\nstrada."),
            p(154, "La superficie carrabile del ponte è composta dalla piattaforma e da eventuali marciapiedi sormontabili, di altezza inferiore a 20 cm e non protetti da barriere di sicurezza stradale o da altri dispositivi di ritenuta.", "La superficie carrabile del ponte è composta dalla piattaforma e da eventuali marciapiedi sormontabili, di altezza inferiore a 20\ncm e non protetti da barriere di sicurezza stradale o da altri dispositivi di ritenuta."),
        ],
    },
    {
        number: "5.1.2.2",
        title: "ALTEZZA LIBERA",
        blocks: [
            heading(154, "5.1.2.2", "ALTEZZA LIBERA", "5.1.2.2 A LTEZZA LIBERA"),
            p(154, "Nel caso di un ponte che scavalchi una strada ordinaria, l’altezza libera al di sotto del ponte non deve essere in alcun punto minore di 5 m, tenendo conto anche delle pendenze della strada sottostante.", "Nel caso di un ponte che scavalchi una strada ordinaria, l’altezza libera al di sotto del ponte non deve essere in alcun punto mi-\nnore di 5 m, tenendo conto anche delle pendenze della strada sottostante."),
            p(154, "Nei casi di strada a traffico selezionato è ammesso, per motivi validi e comprovati, derogare da quanto sopra, purché l’altezza minima non sia minore di 4 m.", "Nei casi di strada a traffico selezionato è ammesso, per motivi validi e comprovati, derogare da quanto sopra, purché l’altezza\nminima non sia minore di 4 m."),
            p(154, "Eccezionalmente, ove l’esistenza di vincoli non eliminabili imponesse di scendere al di sotto di tale valore, si può adottare un’altezza minima, in ogni caso non inferiore a 3,20 m. Tale deroga è vincolata al parere favorevole dei Comandi Militare e dei Vigili del Fuoco competenti per territorio.", "Eccezionalmente, ove l’esistenza di vincoli non eliminabili imponesse di scendere al di sotto di tale valore, si può adottare\nun’altezza minima, in ogni caso non inferiore a 3,20 m. Tale deroga è vincolata al parere favorevole dei Comandi Militare e dei\nVigili del Fuoco competenti per territorio."),
            p(154, "I ponti sui corsi d’acqua classificati navigabili devono avere il tirante corrispondente alla classe dei natanti previsti."),
            p(154, "Per tutti i casi in deroga all’altezza minima prescritta di 5 m, si devono adottare opportuni dispositivi segnaletici di sicurezza (ad es. controsagome), collocati a conveniente distanza dall’imbocco dell’opera.", "Per tutti i casi in deroga all’altezza minima prescritta di 5 m, si devono adottare opportuni dispositivi segnaletici di sicurezza (ad\nes. controsagome), collocati a conveniente distanza dall’imbocco dell’opera."),
            p(154, "Nel caso di sottopassaggi pedonali l’altezza libera non deve essere inferiore a 2,50 m."),
        ],
    },
    {
        number: "5.1.2.3",
        title: "COMPATIBILITÀ IDRAULICA",
        blocks: [
            heading(154, "5.1.2.3", "COMPATIBILITÀ IDRAULICA"),
            p(154, "Quando il ponte interessa un corso d’acqua naturale o artificiale, il progetto deve essere corredato da uno studio di compatibilità idraulica costituito da una relazione idrologica e da una relazione idraulica riguardante le scelte progettuali, la costruzione e l’esercizio del ponte."),
            p(154, "L’ampiezza e l’approfondimento dello studio e delle indagini che ne costituiscono la base devono essere commisurati all’importanza del problema e al livello di progettazione. Deve in ogni caso essere definita una piena di progetto caratterizzata da un tempo di ritorno Tr pari a 200 anni (Tr=200).", "L’ampiezza e l’approfondimento dello studio e delle indagini che ne costituiscono la base devono essere commisurati\nall’importanza del problema e al livello di progettazione. Deve in ogni caso essere definita una piena di progetto caratterizzata da\nun tempo di ritorno Tr pari a 200 anni (Tr=200)."),
            p(154, "Coerentemente al livello di progettazione, lo studio di compatibilità idraulica deve riportare:"),
            li(154, "l’analisi idrologica degli eventi di massima piena e stima della loro frequenza probabile;"),
            li(154, "la definizione dei mesi dell’anno durante i quali siano da attendersi eventi di piena, con riferimento alla prevista successione delle fasi costruttive;", "- la definizione dei mesi dell'anno durante i quali siano da attendersi eventi di piena, con riferimento alla prevista successione\ndelle fasi costruttive;"),
            li(154, "la definizione della scala delle portate nelle condizioni attuali, di progetto, e nelle diverse fasi costruttive previste, corredata dal calcolo del profilo di rigurgito indotto dalla presenza delle opere in alveo, tenendo conto della possibile formazione di ammassi di detriti galleggianti;", "- la definizione della scala delle portate nelle condizioni attuali, di progetto, e nelle diverse fasi costruttive previste, corredata dal\ncalcolo del profilo di rigurgito indotto dalla presenza delle opere in alveo, tenendo conto della possibile formazione di am-\nmassi di detriti galleggianti;"),
            li(154, "la valutazione dello scavo localizzato con riferimento alle forme ed alle dimensioni di pile, spalle e relative fondazioni, nonché di altre opere in alveo provvisionali e definitive, tenendo conto della possibile formazione di ammassi di detriti galleggianti oltre che dei fenomeni erosivi generalizzati conseguenti al restringimento d’alveo;", "- la valutazione dello scavo localizzato con riferimento alle forme ed alle dimensioni di pile, spalle e relative fondazioni, nonché\ndi altre opere in alveo provvisionali e definitive, tenendo conto della possibile formazione di ammassi di detriti galleggianti\noltre che dei fenomeni erosivi generalizzati conseguenti al restringimento d’alveo;"),
            li(154, "l’esame delle conseguenze di urti e abrasioni dovuti alla presenza di natanti e corpi flottanti;"),
            p(154, "Il manufatto non dovrà interessare con spalle, pile e rilevati la sezione del corso d’acqua interessata dalla piena di progetto e, se arginata, i corpi arginali.", "Il manufatto non dovrà interessare con spalle, pile e rilevati la sezione del corso d’acqua interessata dalla piena di progetto e, se\narginata, i corpi arginali."),
            p(154, "Qualora fosse necessario realizzare pile in alveo, la luce netta minima tra pile contigue, o fra pila e spalla del ponte, non deve essere inferiore a 40 m misurati ortogonalmente al filone principale della corrente. Per i ponti esistenti, eventualmente interessati da luci nette di misura inferiore, è ammesso l’allargamento della piattaforma, a patto che questo non comporti modifiche dimensionali delle pile, delle spalle o della pianta delle fondazioni di queste, e nel rispetto del franco idraulico come nel seguito precisato.", "Qualora fosse necessario realizzare pile in alveo, la luce netta minima tra pile contigue, o fra pila e spalla del ponte, non deve es-\sere inferiore a 40 m misurati ortogonalmente al filone principale della corrente. Per i ponti esistenti, eventualmente interessati da\nluci nette di misura inferiore, è ammesso l’allargamento della piattaforma, a patto che questo non comporti modifiche dimensio-"),
            p(155, "In tutti gli altri casi deve essere richiesta l’autorizzazione all’Autorità competente, che si esprime previo parere del Consiglio Superiore dei Lavori Pubblici.", "nali delle pile, delle spalle o della pianta delle fondazioni di queste, e nel rispetto del franco idraulico come nel seguito precisato.\nIn tutti gli altri casi deve essere richiesta l’autorizzazione all’Autorità competente, che si esprime previo parere del Consiglio Su-\nperiore dei Lavori Pubblici."),
            p(155, "Nel caso di pile e/o spalle in alveo, cura particolare è da dedicare al problema delle escavazioni in corrispondenza delle fondazioni e alla protezione delle fondazioni delle pile e delle spalle tenuto anche conto del materiale galleggiante che il corso d’acqua può trasportare. In tali situazioni, una stima anche speditiva dello scalzamento è da sviluppare fin dai primi livelli di progettazione.", "Nel caso di pile e/o spalle in alveo, cura particolare è da dedicare al problema delle escavazioni in corrispondenza delle fonda-\nzioni e alla protezione delle fondazioni delle pile e delle spalle tenuto anche conto del materiale galleggiante che il corso d’acqua\npuò trasportare. In tali situazioni, una stima anche speditiva dello scalzamento è da sviluppare fin dai primi livelli di progetta-\nzione."),
            p(155, "Il franco idraulico, definito come la distanza fra la quota liquida di progetto immediatamente a monte del ponte e l’intradosso delle strutture, è da assumersi non inferiore a 1,50 m, e comunque dovrà essere scelto tenendo conto di considerazioni e previsioni sul trasporto solido di fondo e sul trasporto di materiale galleggiante, garantendo una adeguata distanza fra l’intradosso delle strutture e il fondo alveo.", "Il franco idraulico, definito come la distanza fra la quota liquida di progetto immediatamente a monte del ponte e l’intradosso\ndelle strutture, è da assumersi non inferiore a 1,50 m, e comunque dovrà essere scelto tenendo conto di considerazioni e previsio-\nni sul trasporto solido di fondo e sul trasporto di materiale galleggiante, garantendo una adeguata distanza fra l’intradosso delle\nstrutture e il fondo alveo."),
            p(155, "Quando l’intradosso delle strutture non sia costituito da un’unica linea orizzontale tra gli appoggi, il franco idraulico deve essere assicurato per una ampiezza centrale di 2/3 della luce, e comunque non inferiore a 40 m.", "Quando l’intradosso delle strutture non sia costituito da un’unica linea orizzontale tra gli appoggi, il franco idraulico deve essere\nassicurato per una ampiezza centrale di 2/3 della luce, e comunque non inferiore a 40 m."),
            p(155, "Il franco idraulico necessario non può essere ottenuto con il sollevamento del ponte durante la piena."),
            p(155, "Lo scalzamento e le azioni idrodinamiche associate al livello idrico massimo che si verifica mediamente ogni anno (si assuma Tr = 1,001) devono essere combinate con le altre azioni variabili adottando valori del coefficiente Ψ0 unitario.", "Lo scalzamento e le azioni idrodinamiche associate al livello idrico massimo che si verifica mediamente ogni anno (si assuma Tr =\n1,001) devono essere combinate con le altre azioni variabili adottando valori del coefficiente \\R unitario."),
            p(155, "Lo scalzamento e le azioni idrodinamiche associati all’evento di piena di progetto devono essere combinate esclusivamente con le altre azioni variabili da traffico, adottando per queste ultime i coefficienti di combinazione Ψ1.", "Lo scalzamento e le azioni idrodinamiche associati all’evento di piena di progetto devono essere combinate esclusivamente con le\naltre azioni variabili da traffico, adottando per queste ultime i coefficienti di combinazione \\."),
        ],
    },
    {
        number: "5.1.3",
        title: "AZIONI SUI PONTI STRADALI",
        blocks: [
            heading(155, "5.1.3", "AZIONI SUI PONTI STRADALI"),
            p(155, "Le azioni da considerare nella progettazione dei ponti stradali sono:"),
            li(155, "le azioni permanenti;", "– le azioni permanenti;"),
            li(155, "distorsioni e deformazioni impresse;", "– distorsioni e deformazioni impresse;"),
            li(155, "le azioni variabili da traffico;", "– le azioni variabili da traffico;"),
            li(155, "le azioni variabili (variazioni termiche, spinte idrodinamiche, vento, neve e le azioni sui parapetti);", "– le azioni variabili (variazioni termiche, spinte idrodinamiche, vento, neve e le azioni sui parapetti);"),
            li(155, "le resistenze passive dei vincoli;", "– le resistenze passive dei vincoli;"),
            li(155, "gli urti sulle barriere di sicurezza stradale di veicoli in svio;", "– gli urti sulle barriere di sicurezza stradale di veicoli in svio;"),
            li(155, "le azioni sismiche;", "– le azioni sismiche;"),
            li(155, "le azioni eccezionali.", "– le azioni eccezionali."),
        ],
    },
    {
        number: "5.1.3.1",
        title: "AZIONI PERMANENTI",
        blocks: [
            heading(155, "5.1.3.1", "AZIONI PERMANENTI", "5.1.3.1 A ZIONI PERMANENTI"),
            li(155, "1. Peso proprio degli elementi strutturali: g1"),
            li(155, "2. Carichi permanenti portati: g2 (pavimentazione stradale, marciapiedi, barriere acustiche, barriere di sicurezza stradale, parapetti, finiture, sistema di smaltimento acque, attrezzature stradali, rinfianchi e simili).", "2. Carichi permanenti portati: g2 (pavimentazione stradale, marciapiedi, barriere acustiche, barriere di sicurezza stradale, para-\npetti, finiture, sistema di smaltimento acque, attrezzature stradali, rinfianchi e simili)."),
            li(155, "3. Altre azioni permanenti: g3 (spinta delle terre, spinte idrauliche, ecc.)."),
        ],
    },
    {
        number: "5.1.3.2",
        title: "DISTORSIONI E DEFORMAZIONI IMPRESSE",
        blocks: [
            heading(155, "5.1.3.2", "DISTORSIONI E DEFORMAZIONI IMPRESSE", "5.1.3.2 D ISTORSIONI E DEFORMAZIONI IMPRESSE"),
            li(155, "1. Distorsioni e presollecitazioni di progetto: ε1."),
            p(155, "Ai fini delle verifiche si devono considerare gli effetti delle distorsioni e delle presollecitazioni eventualmente previste in progetto.", "Ai fini delle verifiche si devono considerare gli effetti delle distorsioni e delle presollecitazioni eventualmente previste in pro-\ngetto."),
            li(155, "2. Effetti reologici: ritiro ε2 e viscosità ε3;"),
            p(155, "Il calcolo degli effetti del ritiro del calcestruzzo e della viscosità deve essere effettuato in accordo al carattere ed all’intensità di tali distorsioni definiti nelle relative sezioni delle presenti Norme Tecniche."),
            li(155, "3. Cedimenti vincolari: ε4"),
            p(155, "Devono considerarsi gli effetti di cedimenti vincolari quando, sulla base delle indagini e delle valutazioni geotecniche, questi risultino significativi per le strutture."),
        ],
    },
    {
        number: "5.1.3.3",
        title: "AZIONI VARIABILI DA TRAFFICO. CARICHI VERTICALI: q1",
        blocks: [
            heading(155, "5.1.3.3", "AZIONI VARIABILI DA TRAFFICO. CARICHI VERTICALI: q1", "5.1.3.3 A ZIONI VARIABILI DA TRAFFICO. CARICHI VERTICALI : ͳ"),
        ],
    },
    {
        number: "5.1.3.3.1",
        title: "Premessa",
        blocks: [
            heading(155, "5.1.3.3.1", "Premessa"),
            p(155, "I carichi verticali da traffico sono definiti dagli Schemi di Carico descritti nel § 5.1.3.3.3, disposti su corsie convenzionali."),
        ],
    },
    {
        number: "5.1.3.3.2",
        title: "Definizione delle corsie convenzionali",
        blocks: [
            heading(155, "5.1.3.3.2", "Definizione delle corsie convenzionali"),
            p(155, "Le larghezze wl delle corsie convenzionali sulla superficie carrabile ed il massimo numero (intero) possibile di tali corsie su di essa sono indicati nel prospetto seguente (Fig. 5.1.1 e Tab. 5.1.I).", "Le larghezze wl delle corsie convenzionali sulla superficie carrabile ed il massimo numero (intero) possibile di tali corsie su di es-\nsa sono indicati nel prospetto seguente (Fig. 5.1.1 e Tab. 5.1.I)."),
            p(155, "Se non diversamente specificato, qualora la piattaforma di un impalcato da ponte sia divisa in due parti separate da una zona spartitraffico centrale, si distinguono i casi seguenti:", "Se non diversamente specificato, qualora la piattaforma di un impalcato da ponte sia divisa in due parti separate da una zona\nspartitraffico centrale, si distinguono i casi seguenti:"),
            li(156, "a) se le parti sono separate da una barriera di sicurezza fissa, ciascuna parte, incluse tutte le corsie di emergenza e le banchine, è autonomamente divisa in corsie convenzionali.", "a) se le parti sono separate da una barriera di sicurezza fissa, ciascuna parte, incluse tutte le corsie di emergenza e le banchine, è\nautonomamente divisa in corsie convenzionali."),
            li(156, "b) se le parti sono separate da barriere di sicurezza mobili o da altro dispositivo di ritenuta, l’intera carreggiata, inclusa la zona spartitraffico centrale, è divisa in corsie convenzionali.", "b) se le parti sono separate da barriere di sicurezza mobili o da altro dispositivo di ritenuta, l’intera carreggiata, inclusa la zona\nspartitraffico centrale, è divisa in corsie convenzionali."),
            ref("figure-ref", 156, "5.1.1"),
            ref("table-ref", 156, "5.1.i"),
            p(156, "La disposizione e la numerazione delle corsie va determinata in modo da indurre le più sfavorevoli condizioni di progetto. Per ogni singola verifica il numero di corsie da considerare caricate, la loro disposizione sulla superficie carrabile e la loro numerazione vanno scelte in modo che gli effetti della disposizione dei carichi risultino i più sfavorevoli. La corsia che, caricata, dà l’effetto più sfavorevole è numerata come corsia Numero 1; la corsia che dà il successivo effetto più sfavorevole è numerata come corsia Numero 2, ecc.", "La disposizione e la numerazione delle corsie va determinata in modo da indurre le più sfavorevoli condizioni di progetto. Per\nogni singola verifica il numero di corsie da considerare caricate, la loro disposizione sulla superficie carrabile e la loro numera-\nzione vanno scelte in modo che gli effetti della disposizione dei carichi risultino i più sfavorevoli. La corsia che, caricata, dà\nl’effetto più sfavorevole è numerata come corsia Numero 1; la corsia che dà il successivo effetto più sfavorevole è numerata come\ncorsia Numero 2, ecc."),
            p(156, "Quando la superficie carrabile è costituita da due parti separate portate da uno stesso impalcato, le corsie sono numerate considerando l’intera superficie carrabile, cosicché vi è solo una corsia 1, solo una corsia 2 ecc., che possono appartenere alternativamente ad una delle due parti.", "Quando la superficie carrabile è costituita da due parti separate portate da uno stesso impalcato, le corsie sono numerate conside-\nrando l’intera superficie carrabile, cosicché vi è solo una corsia 1, solo una corsia 2 ecc., che possono appartenere alternativamen-\nte ad una delle due parti."),
            p(156, "Quando la superficie carrabile consiste di due parti separate portate da due impalcati indipendenti, per il progetto di ciascun impalcato si adottano numerazioni indipendenti. Quando, invece, gli impalcati indipendenti sono portati da una singola pila o da una singola spalla, per il progetto della pila o della spalla si adotta un’unica numerazione per le due parti.", "Quando la superficie carrabile consiste di due parti separate portate da due impalcati indipendenti, per il progetto di ciascun im-\npalcato si adottano numerazioni indipendenti. Quando, invece, gli impalcati indipendenti sono portati da una singola pila o da\nuna singola spalla, per il progetto della pila o della spalla si adotta un’unica numerazione per le due parti."),
            p(156, "Per ciascuna singola verifica e per ciascuna corsia convenzionale si applicano gli Schemi di Carico definiti nel seguito per una lunghezza e per una disposizione longitudinale tali da ottenere l’effetto più sfavorevole."),
        ],
    },
    {
        number: "5.1.3.3.3",
        title: "Schemi di Carico",
        blocks: [
            heading(156, "5.1.3.3.3", "Schemi di Carico"),
            p(156, "Le azioni variabili del traffico, comprensive degli effetti dinamici, sono definite dai seguenti Schemi di Carico:"),
            p(156, "Schema di Carico 1: è costituito da carichi concentrati su due assi in tandem, applicati su impronte di pneumatico di forma quadrata e lato 0,40 m, e da carichi uniformemente distribuiti come mostrato in Fig. 5.1.2. Questo schema è da assumere a riferimento sia per le verifiche globali, sia per le verifiche locali, considerando un solo carico tandem per corsia, disposto in asse alla corsia stessa. Il carico tandem, se presente, va considerato per intero.", "Schema di Carico 1: è costituito da carichi concentrati su due assi in tandem, applicati su impronte di pneumatico di forma\nquadrata e lato 0,40 m, e da carichi uniformemente distribuiti come mostrato in Fig. 5.1.2. Questo\nschema è da assumere a riferimento sia per le verifiche globali, sia per le verifiche locali, considerando\nun solo carico tandem per corsia, disposto in asse alla corsia stessa. Il carico tandem, se presente, va\nconsiderato per intero."),
            p(156, "Schema di Carico 2: è costituito da un singolo asse applicato su specifiche impronte di pneumatico di forma rettangolare, di larghezza 0,60 m ed altezza 0,35 m, come mostrato in Fig. 5.1.2. Questo schema va considerato autonomamente con asse longitudinale nella posizione più gravosa ed è da assumere a riferimento solo per verifiche locali. Qualora sia più gravoso si considererà il peso di una singola ruota di 200 kN.", "Schema di Carico 2: è costituito da un singolo asse applicato su specifiche impronte di pneumatico di forma rettangolare,\ndi larghezza 0,60 m ed altezza 0,35 m, come mostrato in Fig. 5.1.2. Questo schema va considerato auto-\nnomamente con asse longitudinale nella posizione più gravosa ed è da assumere a riferimento solo per\nverifiche locali. Qualora sia più gravoso si considererà il peso di una singola ruota di 200 kN."),
            p(156, "Schema di Carico 3: è costituito da un carico isolato da 150 kN con impronta quadrata di lato 0,40 m. Si utilizza per verifiche locali su marciapiedi non protetti da sicurvia.", "Schema di Carico 3: è costituito da un carico isolato da 150 kN con impronta quadrata di lato 0,40 m. Si utilizza per verifi-\nche locali su marciapiedi non protetti da sicurvia."),
            p(156, "Schema di Carico 4: è costituito da un carico isolato da 10 kN con impronta quadrata di lato 0,10 m. Si utilizza per verifiche locali su marciapiedi protetti da sicurvia e sulle passerelle pedonali.", "Schema di Carico 4: è costituito da un carico isolato da 10 kN con impronta quadrata di lato 0,10 m. Si utilizza per verifiche\nlocali su marciapiedi protetti da sicurvia e sulle passerelle pedonali."),
            p(156, "Schema di Carico 5: costituito dalla folla compatta, agente con intensità nominale, comprensiva degli effetti dinamici, di 5,0 kN/m². Il valore di combinazione è invece di 2,5 kN/m². Il carico folla deve essere applicato su tutte le zone significative della superficie di influenza, inclusa l’area dello spartitraffico centrale, ove rilevante.", "Schema di Carico 5: costituito dalla folla compatta, agente con intensità nominale, comprensiva degli effetti dinamici, di 5,0\nkN/m². Il valore di combinazione è invece di 2,5 kN/m². Il carico folla deve essere applicato su tutte le\nzone significative della superficie di influenza, inclusa l’area dello spartitraffico centrale, ove rilevante."),
            p(156, "Schemi di Carico 6.a, b, c: In assenza di studi specifici ed in alternativa al modello di carico principale, generalmente cautelativo, per opere di luce maggiore di 300 m, ai fini della statica complessiva del ponte, si può far riferimento ai seguenti carichi qL,a, qL,b e qL,c", "Schemi di Carico 6.a, b, c: In assenza di studi specifici ed in alternativa al modello di carico principale, generalmente cautelativo,\nper opere di luce maggiore di 300 m, ai fini della statica complessiva del ponte, si può far riferimento\nai seguenti carichi qL,a, qL,b e qL,c"),
            ref("formula-ref", 157, "5.1.1"),
            ref("formula-ref", 157, "5.1.2"),
            ref("formula-ref", 157, "5.1.3"),
            p(157, "essendo L la lunghezza della zona caricata in m."),
        ],
    },
    {
        number: "5.1.3.3.4",
        title: "Categorie Stradali",
        blocks: [
            heading(157, "5.1.3.3.4", "Categorie Stradali"),
            p(157, "Sulla base dei carichi mobili ammessi al transito, i ponti stradali si suddividono nelle due seguenti categorie:"),
            li(157, "ponti per il transito dei carichi mobili sopra indicati con il loro intero valore;"),
            li(157, "ponti per il transito dei soli carichi associati allo Schema 5 (ponti pedonali)."),
            p(157, "L’accesso ai ponti pedonali di carichi diversi da quelli di progetto deve essere materialmente impedito."),
            p(157, "Se necessario, il progetto potrà specificatamente considerare uno o più veicoli speciali rappresentativi, per geometria e carichi-asse, dei veicoli eccezionali previsti sul ponte. Detti veicoli speciali e le relative regole di combinazione possono essere appositamente specificati caso per caso o dedotti da normative di comprovata validità.", "Se necessario, il progetto potrà specificatamente considerare uno o più veicoli speciali rappresentativi, per geometria e carichi-asse,\ndei veicoli eccezionali previsti sul ponte. Detti veicoli speciali e le relative regole di combinazione possono essere appositamente spe-\ncificati caso per caso o dedotti da normative di comprovata validità."),
        ],
    },
    {
        number: "5.1.3.3.5",
        title: "Disposizione dei carichi mobili per realizzare le condizioni di carico più gravose",
        blocks: [
            heading(157, "5.1.3.3.5", "Disposizione dei carichi mobili per realizzare le condizioni di carico più gravose"),
            p(157, "Il numero delle colonne di carichi mobili da considerare nel calcolo è quello massimo compatibile con la larghezza della superficie carrabile, tenuto conto che la larghezza di ingombro convenzionale è stabilita per ciascuna corsia in 3,00 m."),
            ref("figure-ref", 157, "5.1.2"),
            p(157, "In ogni caso il numero delle corsie non deve essere inferiore a 2, a meno che la larghezza della superficie carrabile sia inferiore a 5,40 m."),
            p(157, "La disposizione dei carichi ed il numero delle corsie sulla superficie carrabile saranno volta per volta quelli che determinano le condizioni più sfavorevoli di sollecitazione per la struttura, membratura o sezione considerata."),
            p(157, "Si devono considerare, compatibilmente con le larghezze precedentemente definite, le seguenti intensità dei carichi (Tab. 5.1.II):"),
            ref("table-ref", 158, "5.1.ii"),
            p(158, "Per i ponti pedonali si considera il carico associato allo Schema 5 (folla compatta) applicato con la disposizione più gravosa per le singole verifiche."),
            p(158, "Ai fini delle verifiche globali di opere singole di luce maggiore di 300 m, in assenza di studi specifici ed in alternativa al modello di carico principale, si disporrà sulla corsia n. 1 un carico qL,a, sulla corsia n. 2 un carico qL,b, sulla corsia n. 3 un carico qL,c e sulle altre corsie e sull’area rimanente un carico distribuito di intensità 2,5 kN/m².", "Ai fini delle verifiche globali di opere singole di luce maggiore di 300 m, in assenza di studi specifici ed in alternativa al modello\ndi carico principale, si disporrà sulla corsia n. 1 un carico qL,a, sulla corsia n. 2 un carico qL,b, sulla corsia n. 3 un carico qL,c e sulle\naltre corsie e sull’area rimanente un carico distribuito di intensità 2,5 kN/m²."),
            p(158, "I carichi qL,a, qL,b e qL,c si dispongono in asse alle rispettive corsie convenzionali."),
        ],
    },
    {
        number: "5.1.3.3.6",
        title: "Strutture secondarie di impalcato",
        blocks: [
            heading(158, "5.1.3.3.6", "Strutture secondarie di impalcato"),
            innerHeading(158, "Diffusione dei carichi locali"),
            p(158, "I carichi concentrati da considerarsi ai fini delle verifiche locali ed associati agli Schemi di Carico 1, 2, 3 e 4 si assumono uniformemente distribuiti sulla superficie della rispettiva impronta. La diffusione attraverso la pavimentazione e lo spessore della soletta si considera avvenire secondo un angolo di 45°, fino al piano medio della struttura della soletta sottostante (Fig. 5.1.3.a). Nel caso di piastra ortotropa la diffusione va considerata fino al piano medio della lamiera superiore d’impalcato (Fig. 5.1.3.b).", "I carichi concentrati da considerarsi ai fini delle verifiche locali ed associati agli Schemi di Carico 1, 2, 3 e 4 si assumono unifor-\nmemente distribuiti sulla superficie della rispettiva impronta. La diffusione attraverso la pavimentazione e lo spessore della so-\nletta si considera avvenire secondo un angolo di 45°, fino al piano medio della struttura della soletta sottostante (Fig. 5.1.3.a). Nel\ncaso di piastra ortotropa la diffusione va considerata fino al piano medio della lamiera superiore d’impalcato (Fig. 5.1.3.b)."),
            ref("figure-ref", 158, "5.1.3.a"),
            ref("figure-ref", 158, "5.1.3.b"),
            innerHeading(158, "Calcolo delle strutture secondarie di impalcato"),
            p(158, "Ai fini del calcolo delle strutture secondarie dell’impalcato (solette, marciapiedi, traversi, ecc.) si devono prendere in considerazione i carichi già definiti in precedenza, nelle posizioni di volta in volta più gravose per l’elemento considerato. In alternativa si considera, se più gravoso, il carico associato allo Schema 2, disposto nel modo più sfavorevole e supposto viaggiante in direzione longitudinale.", "Ai fini del calcolo delle strutture secondarie dell’impalcato (solette, marciapiedi, traversi, ecc.) si devono prendere in considera-\nzione i carichi già definiti in precedenza, nelle posizioni di volta in volta più gravose per l’elemento considerato. In alternativa si\nconsidera, se più gravoso, il carico associato allo Schema 2, disposto nel modo più sfavorevole e supposto viaggiante in direzione\nlongitudinale."),
            p(158, "Per i marciapiedi non protetti da sicurvia si considera il carico associato allo Schema 3."),
            p(158, "Per i marciapiedi protetti da sicurvia e per i ponti pedonali si considera il carico associato allo Schema 4."),
            p(158, "Nella determinazione delle combinazioni di carico si indica come carico q1 la disposizione dei carichi mobili che, caso per caso, risulta più gravosa ai fini delle verifiche.", "Nella determinazione delle combinazioni di carico si indica come carico q1 la disposizione dei carichi mobili che, caso per caso,\nrisulta più gravosa ai fini delle verifiche."),
        ],
    },
    {
        number: "5.1.3.4",
        title: "AZIONI VARIABILI DA TRAFFICO. INCREMENTO DINAMICO ADDIZIONALE IN PRESENZA DI DISCONTINUITÀ STRUTTURALI: q2",
        blocks: [
            heading(158, "5.1.3.4", "AZIONI VARIABILI DA TRAFFICO. INCREMENTO DINAMICO ADDIZIONALE IN PRESENZA DI DISCONTINUITÀ STRUTTURALI: q2", "5.1.3.4 A ZIONI VARIABILI DA TRAFFICO. INCREMENTO DINAMICO ADDIZIONALE IN PRESENZA DI DISCONTINUITÀ STRUTTURALI: q\n2"),
            p(158, "I carichi mobili includono gli effetti dinamici per pavimentazioni di media rugosità. In casi particolari, come ad esempio in prossimità dei giunti di dilatazione, può essere necessario considerare un coefficiente dinamico addizionale q2, da valutare in riferimento alla specifica situazione considerata.", "I carichi mobili includono gli effetti dinamici per pavimentazioni di media rugosità. In casi particolari, come ad esempio in pros-\nsimità dei giunti di dilatazione, può essere necessario considerare un coefficiente dinamico addizionale q2, da valutare in riferi-\nmento alla specifica situazione considerata."),
        ],
    },
    {
        number: "5.1.3.5",
        title: "AZIONI VARIABILI DA TRAFFICO. AZIONE LONGITUDINALE DI FRENAMENTO O DI ACCELERAZIONE: q3",
        blocks: [
            heading(158, "5.1.3.5", "AZIONI VARIABILI DA TRAFFICO. AZIONE LONGITUDINALE DI FRENAMENTO O DI ACCELERAZIONE: q3", "5.1.3.5 A ZIONI VARIABILI DA TRAFFICO. A ZIONE LONGITUDINALE DI FRENAMENTO O DI ACCELERAZIONE : q\n3"),
            p(158, "La forza di frenamento o di accelerazione q3 è funzione del carico verticale totale agente sulla corsia convenzionale n. 1 ed è uguale a", "La forza di frenamento o di accelerazione q3 è funzione del carico verticale totale agente sulla corsia convenzionale n. 1 ed è ugua-\nle a"),
            ref("formula-ref", 158, "5.1.4"),
            p(158, "essendo w1 la larghezza della corsia e L la lunghezza della zona caricata. La forza, applicata a livello della pavimentazione ed agente lungo l’asse della corsia, è assunta uniformemente distribuita sulla lunghezza caricata e include gli effetti di interazione.", "essendo wl la larghezza della corsia e L la lunghezza della zona caricata. La forza, applicata a livello della pavimentazione ed a-\ngente lungo l’asse della corsia, è assunta uniformemente distribuita sulla lunghezza caricata e include gli effetti di interazione."),
        ],
    },
    {
        number: "5.1.3.6",
        title: "AZIONI VARIABILI DA TRAFFICO. AZIONE CENTRIFUGA: q4",
        blocks: [
            heading(159, "5.1.3.6", "AZIONI VARIABILI DA TRAFFICO. AZIONE CENTRIFUGA: q4", "5.1.3.6 A ZIONI VARIABILI DA TRAFFICO. A ZIONE CENTRIFUGA: q\n4"),
            p(159, "Nei ponti con asse curvo di raggio R (in metri) l’azione centrifuga corrispondente ad ogni colonna di carico si valuta convenzionalmente come indicato in Tab. 5.1.III, essendo Qv = Σi 2Qik il carico totale dovuto agli assi tandem dello schema di carico 1 agenti sul ponte.", "Nei ponti con asse curvo di raggio R (in metri) l’azione centrifuga corrispondente ad ogni colonna di carico si valuta convenzio-\nnalmente come indicato in Tab. 5.1.III, essendo Qv =  ̕ i 2Q ik il carico totale dovuto agli assi tandem dello schema di carico 1 agenti\nsul ponte."),
            p(159, "Il carico concentrato q4, applicato a livello della pavimentazione, agisce in direzione normale all’asse del ponte.", "Il carico concentrato q 4 , applicato a livello della pavimentazione, agisce in direzione normale all’asse del ponte."),
            ref("table-ref", 159, "5.1.iii"),
        ],
    },
    {
        number: "5.1.3.7",
        title: "AZIONI DI NEVE E DI VENTO: q5",
        blocks: [
            heading(159, "5.1.3.7", "AZIONI DI NEVE E DI VENTO: q5", "5.1.3.7 A ZIONI DI N EVE E DI V ENTO: q5"),
            p(159, "Per le azioni da neve e vento vale quanto specificato al Capitolo 3."),
            p(159, "L’azione del vento può essere convenzionalmente assimilata ad un sistema di carichi statici, la cui componente principale è orizzontale e diretta ortogonalmente all’asse del ponte e/o diretta nelle direzioni più sfavorevoli per alcuni dei suoi elementi (ad es. le pile). Tale componente principale si considera agente sulla proiezione nel piano verticale delle superfici investite, ivi compresi i parapetti, le barriere di sicurezza stradale e le barriere acustiche, ove previsti; al riguardo può farsi utile riferimento a documenti di comprovata validità di cui al Capitolo 12.", "L’azione del vento può essere convenzionalmente assimilata ad un sistema di carichi statici, la cui componente principale è oriz-\nzontale e diretta ortogonalmente all’asse del ponte e/o diretta nelle direzioni più sfavorevoli per alcuni dei suoi elementi (ad es. le\npile). Tale componente principale si considera agente sulla proiezione nel piano verticale delle superfici investite, ivi compresi i\nparapetti, le barriere di sicurezza stradale e le barriere acustiche, ove previsti; al riguardo può farsi utile riferimento a documenti\ndi comprovata validità di cui al Capitolo 12."),
            p(159, "La superficie dei carichi transitanti sul ponte esposta al vento si assimila ad una parete rettangolare continua dell’altezza di 3 m a partire dal piano stradale.", "La superficie dei carichi transitanti sul ponte esposta al vento si assimila ad una parete rettangolare continua dell’altezza di 3 m a par-\ntire dal piano stradale."),
            p(159, "L’azione del vento si può valutare come sopra specificato nei casi in cui essa non possa destare fenomeni dinamici nelle strutture del ponte o quando l’orografia non possa dar luogo ad azioni anomale del vento."),
            p(159, "Per i ponti particolarmente sensibili all’eccitazione dinamica del vento si deve procedere alla valutazione della risposta strutturale in galleria del vento e, se necessario, alla formulazione di un modello matematico dell’azione del vento dedotto da misure sperimentali.", "Per i ponti particolarmente sensibili all’eccitazione dinamica del vento si deve procedere alla valutazione della risposta struttura-\nle in galleria del vento e, se necessario, alla formulazione di un modello matematico dell’azione del vento dedotto da misure spe-\nrimentali."),
            p(159, "Il carico di neve si considera non concomitante con i carichi da traffico, salvo che per ponti coperti."),
        ],
    },
    {
        number: "5.1.3.8",
        title: "AZIONI IDRODINAMICHE: q6",
        blocks: [
            heading(159, "5.1.3.8", "AZIONI IDRODINAMICHE: q6", "5.1.3.8 AZIONI IDRODINAMICHE: q\n6"),
            p(159, "Le azioni idrodinamiche sulle pile poste nell’alveo dei fiumi devono essere calcolate secondo le prescrizioni del § 5.1.2.3 tenendo conto, oltre che dell’orientamento e della forma della pila, anche degli effetti di modificazioni locali dell’alveo, dovute, per esempio, allo scalzamento."),
        ],
    },
    {
        number: "5.1.3.9",
        title: "AZIONI DELLA TEMPERATURA: q7",
        blocks: [
            heading(159, "5.1.3.9", "AZIONI DELLA TEMPERATURA: q7"),
            p(159, "Il calcolo degli effetti delle variazioni termiche deve essere effettuato in accordo al carattere ed all’intensità di tali variazioni definite nel Capitolo 3. Per situazioni di particolare complessità può anche farsi utile riferimento a documenti di comprovata validità, di cui al Capitolo 12.", "Il calcolo degli effetti delle variazioni termiche deve essere effettuato in accordo al carattere ed all’intensità di tali variazioni defi-\nnite nel Capitolo 3. Per situazioni di particolare complessità può anche farsi utile riferimento a documenti di comprovata validità,\ndi cui al Capitolo 12."),
        ],
    },
    {
        number: "5.1.3.10",
        title: "AZIONI SUI PARAPETTI E URTO DI VEICOLO IN SVIO: q8",
        blocks: [
            heading(159, "5.1.3.10", "AZIONI SUI PARAPETTI E URTO DI VEICOLO IN SVIO: q8", "5.1.3.10 A ZIONI SUI PARAPETTI E URTO DI VEICOLO IN SVIO : q8"),
            p(159, "L’altezza dei parapetti non può essere inferiore a 1,10 m. I parapetti devono essere calcolati in base ad un’azione orizzontale di 1,5 kN/m applicata al corrimano."),
            p(159, "Le barriere di sicurezza stradali e gli elementi strutturali ai quali sono collegate devono essere dimensionati in funzione della classe di contenimento richiesta, per l’impiego specifico, dalle norme nazionali applicabili."),
            p(159, "Nel progetto dell’impalcato deve essere considerata una combinazione di carico nella quale al sistema di forze orizzontali, equivalenti all’effetto dell’azione d’urto sulla barriera di sicurezza stradale, si associa un carico verticale isolato sulla sede stradale costituito dallo Schema di Carico 2, posizionato in adiacenza alla barriera stessa e disposto nella posizione più gravosa.", "Nel progetto dell’impalcato deve essere considerata una combinazione di carico nella quale al sistema di forze orizzontali, equi-\nvalenti all’effetto dell’azione d’urto sulla barriera di sicurezza stradale, si associa un carico verticale isolato sulla sede stradale co-\stituito dallo Schema di Carico 2, posizionato in adiacenza alla barriera stessa e disposto nella posizione più gravosa."),
            p(159, "Tale sistema di forze orizzontali potrà essere valutato dal progettista, alternativamente, sulla base:"),
            li(159, "delle risultanze sperimentali ottenute nel corso di prove d’urto al vero, su barriere della stessa tipologia e della classe di contenimento previste in progetto, mediante l’utilizzo di strumentazione idonea a registrare l’evoluzione degli effetti dinamici;", "• delle risultanze sperimentali ottenute nel corso di prove d’urto al vero, su barriere della stessa tipologia e della classe di\ncontenimento previste in progetto, mediante l’utilizzo di strumentazione idonea a registrare l’evoluzione degli effetti\ndinamici;"),
            li(159, "del riconoscimento di equivalenza tra il sistema di forze e le azioni trasmesse alla struttura, a causa di urti su barriere della stessa tipologia e della classe di contenimento previste in progetto, laddove tale equivalenza risulti da valutazioni teoriche e/o modellazioni numerico-sperimentali;", "• del riconoscimento di equivalenza tra il sistema di forze e le azioni trasmesse alla struttura, a causa di urti su barriere\ndella stessa tipologia e della classe di contenimento previste in progetto, laddove tale equivalenza risulti da valutazioni\nteoriche e/o modellazioni numerico-sperimentali;"),
            p(159, "In assenza delle suddette valutazioni, il sistema di forze orizzontali può essere determinato con riferimento alla resistenza caratteristica degli elementi strutturali principali coinvolti nel meccanismo d’insieme della barriera e deve essere applicato ad una quota h, misurata dal piano viario, pari alla minore delle dimensioni h1 e h2, dove h1 = (altezza della barriera - 0,10m) e h2 = 1,00 m. Nel dimensionamento degli elementi strutturali ai quali è collegata la barriera si deve tener conto della eventuale sovrapposizione delle zone di diffusione di tale sistema di forze, in funzione della geometria della barriera e delle sue condizioni di vincolo. Per il dimensionamento dell’impalcato, le forze orizzontali così determinate devono essere amplificate di un fattore pari a 1,50.", "In assenza delle suddette valutazioni, il sistema di forze orizzontali può essere determinato con riferimento alla resistenza caratteri-\nstica degli elementi strutturali principali coinvolti nel meccanismo d’insieme della barriera e deve essere applicato ad una quota h,\nmisurata dal piano viario, pari alla minore delle dimensioni h1 e h2, dove h1 = (altezza della barriera - 0,10m) e h2 = 1,00 m. Nel di-\nmensionamento degli elementi strutturali ai quali è collegata la barriera si deve tener conto della eventuale sovrapposizione delle\nzone di diffusione di tale sistema di forze, in funzione della geometria della barriera e delle sue condizioni di vincolo. Per il dimen-\nsionamento dell’impalcato, le forze orizzontali così determinate devono essere amplificate di un fattore pari a 1,50."),
            p(160, "Il coefficiente parziale di sicurezza per la combinazione di carico agli SLU per l’urto di veicolo in svio deve essere assunto unitario."),
        ],
    },
    {
        number: "5.1.3.11",
        title: "RESISTENZE PASSIVE DEI VINCOLI: q9",
        blocks: [
            heading(160, "5.1.3.11", "RESISTENZE PASSIVE DEI VINCOLI: q9", "5.1.3.11 R ESISTENZE PASSIVE DEI VINCOLI : q9"),
            p(160, "Nel calcolo delle pile, delle spalle, delle fondazioni, degli stessi apparecchi di appoggio e, se del caso, dell’impalcato, si devono considerare le forze che derivano dalle resistenze parassite dei vincoli."),
            p(160, "Nel caso di appoggi in gomma dette forze devono essere valutate sulla base delle caratteristiche dell’appoggio e degli spostamenti previsti.", "Nel caso di appoggi in gomma dette forze devono essere valutate sulla base delle caratteristiche dell’appoggio e degli spostamen-\nti previsti."),
            p(160, "Le resistenze passive dei vincoli devono essere considerate associate a quelle azioni per le quali danno effetto."),
            p(160, "Il coefficiente parziale di sicurezza per le combinazioni di carico agli SLU deve essere assunto come per le azioni variabili."),
        ],
    },
    {
        number: "5.1.3.12",
        title: "AZIONI SISMICHE: E",
        blocks: [
            heading(160, "5.1.3.12", "AZIONI SISMICHE: E", "5.1.3.12 A ZIONI SISMICHE : E"),
            p(160, "Per le azioni sismiche si devono rispettare le prescrizioni di cui ai §§ 2.5.3 e 3.2."),
            p(160, "Nelle espressioni [2.5.5] e [2.5.7] si assume, di regola, per i carichi dovuti al transito dei mezzi Ψ2j = 0,0.", "Nelle espressioni >2.5.5@ e >2.5.7@ si assume, di regola, per i carichi dovuti al transito dei mezzi ȥ2j = 0,0."),
            p(160, "Ove necessario, per esempio per ponti in zona urbana di intenso traffico, si assume per i carichi dovuti al transito dei mezzi Ψ2j = 0,2, quando rilevante, sia nella combinazione delle azioni, sia per la definizione dell’effetto dell’azione sismica.", "Ove necessario, per esempio per ponti in zona urbana di intenso traffico, si assume per i carichi dovuti al transito dei mezzi ȥ2j =\n0,2, quando rilevante, sia nella combinazione delle azioni, sia per la definizione dell’effetto dell’azione sismica."),
        ],
    },
    {
        number: "5.1.3.13",
        title: "AZIONI ECCEZIONALI: A",
        blocks: [
            heading(160, "5.1.3.13", "AZIONI ECCEZIONALI: A", "5.1.3.13 A ZIONI ECCEZIONALI : A"),
            p(160, "Le azioni eccezionali da considerare nel progetto sono valutate sulla base delle indicazioni contenute nel § 3.6, in generale, ed al § 3.6.3, in particolare."),
            p(160, "Con riferimento al § 3.6.3.1, si puntualizza che le azioni d’urto agenti sugli elementi strutturali orizzontali al disopra della strada, sono da impiegarsi per la verifica di sicurezza globale dell’impalcato nel suo insieme inteso come corpo rigido (sollevamento/ribaltamento); al verificarsi di tali eventi sono ammessi danni localizzati agli elementi strutturali che non comportino il collasso dell’impalcato.", "Con riferimento al § 3.6.3.1, si puntualizza che le azioni d’urto agenti sugli elementi strutturali orizzontali al disopra della strada, so-\nno da impiegarsi per la verifica di sicurezza globale dell’impalcato nel suo insieme inteso come corpo rigido (sollevamen-\nto/ribaltamento); al verificarsi di tali eventi sono ammessi danni localizzati agli elementi strutturali che non comportino il collasso\ndell’impalcato."),
            p(160, "I piedritti dei ponti ubicati a distanza ≤5,0 m dalla sede stradale devono essere protetti contro il pericolo di urti di veicoli stradali mediante adeguate opere chiaramente destinate alla protezione dei piedritti stessi.", "I piedritti dei ponti ubicati a distanza ǂ5,0 m dalla sede stradale devono essere protetti contro il pericolo di urti di veicoli stradali\nmediante adeguate opere chiaramente destinate alla protezione dei piedritti stessi."),
        ],
    },
    {
        number: "5.1.3.14",
        title: "COMBINAZIONI DI CARICO",
        blocks: [
            heading(160, "5.1.3.14", "COMBINAZIONI DI CARICO", "5.1.3.14 C OMBINAZIONI DI CARICO"),
            p(160, "Le combinazioni di carico da considerare ai fini delle verifiche devono essere stabilite in modo da garantire la sicurezza in conformità a quanto prescritto al Cap. 2.", "Le combinazioni di carico da considerare ai fini delle verifiche devono essere stabilite in modo da garantire la sicurezza in con-\nformità a quanto prescritto al Cap. 2."),
            p(160, "Ai fini della determinazione dei valori caratteristici delle azioni dovute al traffico, si devono considerare, generalmente, le combinazioni riportate in Tab. 5.1.IV.", "Ai fini della determinazione dei valori caratteristici delle azioni dovute al traffico, si devono considerare, generalmente, le combi-\nnazioni riportate in Tab. 5.1.IV."),
            ref("table-ref", 160, "5.1.iv"),
            p(161, "La Tab. 5.1.V, con riferimento al § 2.6.1, fornisce i valori dei coefficienti parziali delle azioni da assumere nell’analisi per la determinazione degli effetti delle azioni nelle verifiche agli stati limite ultimi.", "La Tab. 5.1.V, con riferimento al § 2.6.1, fornisce i valori dei coefficienti parziali delle azioni da assumere nell’analisi per la deter-\nminazione degli effetti delle azioni nelle verifiche agli stati limite ultimi."),
            p(161, "Altri valori di coefficienti parziali sono riportati nel Capitolo 4 con riferimento a particolari azioni specifiche dei diversi materiali."),
            p(161, "I valori dei coefficienti di combinazione Ψ0j, Ψ1j e Ψ2j per le diverse categorie di azioni sono riportati nella Tab. 5.1.VI.", "I valori dei coefficienti di combinazione ȥ0j , ȥ1j e ȥ2j per le diverse categorie di azioni sono riportati nella Tab. 5.1.VI."),
            ref("table-ref", 161, "5.1.v"),
            ref("table-ref", 161, "5.1.vi"),
            p(161, "Per le opere di luce maggiore di 300 m è possibile modificare i coefficienti indicati in tabella previa autorizzazione del Servizio tecnico centrale del Consiglio superiore dei lavori pubblici, sentito lo stesso Consiglio.", "Per le opere di luce maggiore di 300 m è possibile modificare i coefficienti indicati in tabella previa autorizzazione del Servizio tecni-\nco centrale del Consiglio superiore dei lavori pubblici, sentito lo stesso Consiglio."),
        ],
    },
];

const pageRecords = new Map<number, any>();
for (const page of [153, 154, 155, 156, 157, 158, 159, 160, 161]) {
    const filename = join(root, "evidence", sourceId, "pages", `page-${String(page).padStart(4, "0")}.json`);
    pageRecords.set(page, JSON.parse(await readFile(filename, "utf8")));
}

function pageRegion(page: number): { coordinateSystem: "pdf-points-top-left"; x: number; y: number; width: number; height: number } {
    const record = pageRecords.get(page);
    return {
        coordinateSystem: "pdf-points-top-left",
        x: 73,
        y: page === 153 ? 235 : 75,
        width: page === 153 ? 450 : 455,
        height: page === 153 ? 500 : 670,
    };
}

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

function makeBlock(unitNumber: string, index: number, def: BlockDef): any {
    const blockId = `urn:structural-codes:it:unit:ntc2018:${unitNumber}#block-${def.kind === "heading" && index === 0 ? "heading" : `editorial-${String(index).padStart(3, "0")}`}`;
    if (def.kind.endsWith("-ref")) {
        const evidence = {
            sourceId,
            pdfPage: def.page,
            printedPage: String(def.page - 4),
            region: pageRegion(def.page),
            extraction: { method: "manual-transcription", tool: "codex-source-transcription", toolVersion: ruleVersion },
            transformations: [{ operation: "manual-correction", ruleVersion, note: "Asset collocato nel punto normativo originario; resta da revisionare puntualmente." }],
            rawSha256: sha256(def.assetId ?? blockId),
            normalizedSha256: sha256(def.assetId ?? blockId),
        };
        return { blockId, kind: def.kind, origin: "official", assetId: def.assetId, evidence };
    }
    const normalized = def.text ?? "";
    const raw = def.raw ?? normalized;
    const text: any = {
        raw,
        normalized,
        normalizationVersion: ruleVersion,
    };
    if (def.inline) text.inline = def.inline;
    return {
        blockId,
        kind: def.kind,
        origin: "official",
        text,
        evidence: {
            sourceId,
            pdfPage: def.page,
            printedPage: String(def.page - 4),
            region: pageRegion(def.page),
            extraction: { method: "pdf-text", tool: "pdfjs-dist", toolVersion: "4.10.38" },
            transformations: transformations(raw, normalized),
            rawSha256: sha256(raw),
            normalizedSha256: sha256(normalized),
        },
    };
}

function sortKey(number: string): string {
    return number.split(".").map((part) => part.padStart(3, "0")).join(".");
}
function parentNumber(number: string): string | null {
    const parts = number.split(".");
    return parts.length === 1 ? null : parts.slice(0, -1).join(".");
}
function kindFor(number: string): string {
    const depth = number.split(".").length;
    return depth === 1 ? "chapter" : depth === 2 ? "section" : depth === 3 ? "paragraph" : "subparagraph";
}
function ancestorIds(number: string): string[] {
    const parts = number.split(".");
    const result: string[] = [];
    for (let length = 1; length < parts.length; length += 1) {
        result.push(`urn:structural-codes:it:unit:ntc2018:${parts.slice(0, length).join(".")}`);
    }
    return result;
}
function childPosition(number: string): number {
    const parts = number.split(".");
    return Number(parts.at(-1));
}

const assetIdsByUnit = new Map<string, { formulaIds: string[]; tableIds: string[]; figureIds: string[] }>();
function assetIds(blocks: any[]) {
    const result = { formulaIds: [] as string[], tableIds: [] as string[], figureIds: [] as string[] };
    for (const block of blocks) {
        if (!block.assetId) continue;
        const type = block.kind.replace("-ref", "") as "formula" | "table" | "figure";
        const key = `${type}Ids` as keyof typeof result;
        result[key].push(block.assetId);
    }
    return result;
}

function makeUnit(def: UnitDef): any {
    const blocks = def.blocks.map((block, index) => makeBlock(def.number, index, block));
    const ids = assetIds(blocks);
    assetIdsByUnit.set(def.number, ids);
    const id = `urn:structural-codes:it:unit:ntc2018:${def.number}`;
    const parent = parentNumber(def.number);
    return {
        $schema: "urn:structural-codes:schema:canonical-unit:v2",
        schemaVersion: "2.0.0-alpha.2",
        recordType: "canonical-unit",
        id,
        workId,
        expressionId,
        kind: kindFor(def.number),
        numbering: { official: def.number, sortKey: sortKey(def.number) },
        title: def.title,
        titleBlockId: `${id}#block-heading`,
        hierarchy: {
            parentId: parent === null ? null : `urn:structural-codes:it:unit:ntc2018:${parent}`,
            ancestorIds: ancestorIds(def.number),
            position: childPosition(def.number),
        },
        validity: { from: "2018-03-22", to: null, status: "in-force", asOf: "2026-08-09" },
        blocks,
        citations: [],
        relations: [],
        assets: ids,
        workflow: {
            status: "extracted",
            createdBy: { actorId: "codex:ntc5-step1", kind: "automated-agent", toolVersion: ruleVersion },
            createdAt,
            reviews: [],
            openIssues: [
                { issueId: `ntc2018-${def.number.replaceAll(".", "-")}-source-review`, type: "normalization-review", severity: "blocking", note: "Record trascritto dall’evidence ufficiale ma non ancora confrontato integralmente da un revisore umano con il render della fonte." },
                ...(Object.values(ids).some((items) => items.length > 0)
                    ? [{ issueId: `ntc2018-${def.number.replaceAll(".", "-")}-assets`, type: "asset-review", severity: "blocking", note: "Formule, tabelle e figure sono collocate nel punto originario; resta obbligatorio il confronto umano puntuale con la fonte ufficiale." }]
                    : []),
            ],
        },
    };
}

const table = (id: string, unitId: string, officialNumber: string, pdfPage: number, caption: string | null, headers: any[][], rows: any[][], notes: string[] = []) => ({
    id: asset("table", id),
    unitId: `urn:structural-codes:it:unit:ntc2018:${unitId}`,
    officialNumber,
    pdfPage,
    caption,
    columnCount: Math.max(...headers.concat(rows).map((row) => row.length)),
    headers,
    rows,
    notes,
});
function inferredCellLatex(text: string): string | undefined {
    const footnoted = text.match(/^(\d+(?:,\d+)?) \((\d+)\)$/u);
    if (footnoted) return `${(footnoted[1] ?? "").replace(",", "{,}")}^{(${footnoted[2]})}`;
    if (/^\d+(?:,\d+)?$/u.test(text)) return text.replace(",", "{,}");
    return undefined;
}
const cell = (text: string, extra: Record<string, unknown> = {}) => {
    const latex = inferredCellLatex(text);
    return { text, ...(latex ? { latex } : {}), ...extra };
};

const assetManifest = {
    $schema: "urn:structural-codes:schema:asset-manifest:v2",
    schemaVersion: "2.0.0-alpha.1",
    recordType: "asset-manifest",
    document: "ntc2018",
    section: "5.1-step1",
    sourceId,
    status: "transcribed-unreviewed",
    formulas: [
        { id: asset("formula", "5.1.1"), unitId: "urn:structural-codes:it:unit:ntc2018:5.1.3.3.3", officialNumber: "5.1.1", pdfPage: 157, latex: "q_{L,a}=128{,}95\\left(\\frac{1}{L}\\right)^{0{,}25}\\;[\\mathrm{KN/m}]" },
        { id: asset("formula", "5.1.2"), unitId: "urn:structural-codes:it:unit:ntc2018:5.1.3.3.3", officialNumber: "5.1.2", pdfPage: 157, latex: "q_{L,b}=88{,}71\\left(\\frac{1}{L}\\right)^{0{,}38}\\;[\\mathrm{KN/m}]" },
        { id: asset("formula", "5.1.3"), unitId: "urn:structural-codes:it:unit:ntc2018:5.1.3.3.3", officialNumber: "5.1.3", pdfPage: 157, latex: "q_{L,c}=77{,}12\\left(\\frac{1}{L}\\right)^{0{,}38}\\;[\\mathrm{KN/m}]" },
        { id: asset("formula", "5.1.4"), unitId: "urn:structural-codes:it:unit:ntc2018:5.1.3.5", officialNumber: "5.1.4", pdfPage: 158, latex: "180\\,\\mathrm{kN}\\le q_3=0{,}6(2Q_{1k})+0{,}10q_{1k}\\cdot w_1\\cdot L\\le900\\,\\mathrm{kN}" },
    ],
    tables: [
        table("5.1.i", "5.1.3.3.2", "5.1.I", 156, "Tab. 5.1.I - Numero e larghezza delle corsie", [[cell("Larghezza della superficie carrabile \\\"w\\\"", { latex: "\\text{Larghezza della superficie carrabile }w" }), cell("Numero di corsie convenzionali"), cell("Larghezza di una corsia convenzionale [m]", { latex: "\\text{Larghezza di una corsia convenzionale }[\\mathrm{m}]" }), cell("Larghezza della zona rimanente [m]", { latex: "\\text{Larghezza della zona rimanente }[\\mathrm{m}]" })]], [
            [cell("w < 5,40 m", { latex: "w<5{,}40\\,\\mathrm{m}" }), cell("n_l = 1", { latex: "n_l=1" }), cell("3,00"), cell("(w - 3,00)", { latex: "(w-3{,}00)" })],
            [cell("5,4 ≤ w < 6,0 m", { latex: "5{,}4\\le w<6{,}0\\,\\mathrm{m}" }), cell("n_l = 2", { latex: "n_l=2" }), cell("w/2", { latex: "w/2" }), cell("0")],
            [cell("6,0 m ≤ w", { latex: "6{,}0\\,\\mathrm{m}\\le w" }), cell("n_l = Int(w/3)", { latex: "n_l=\\operatorname{Int}(w/3)" }), cell("3,00"), cell("w - (3,00 × n_l)", { latex: "w-(3{,}00\\times n_l)" })],
        ]),
        table("5.1.ii", "5.1.3.3.5", "5.1.II", 158, "Tab. 5.1.II - Intensità dei carichi Qik e qik per le diverse corsie", [[cell("Posizione"), cell("Carico asse Qik [kN]", { latex: "\\text{Carico asse }Q_{ik}\\;[\\mathrm{kN}]" }), cell("qik [kN/m²]", { latex: "q_{ik}\\;[\\mathrm{kN/m^2}]" })]], [
            [cell("Corsia Numero 1"), cell("300"), cell("9,00")],
            [cell("Corsia Numero 2"), cell("200"), cell("2,50")],
            [cell("Corsia Numero 3"), cell("100"), cell("2,50")],
            [cell("Altre corsie"), cell("0,00"), cell("2,50")],
        ]),
        table("5.1.iii", "5.1.3.6", "5.1.III", 159, "Tab. 5.1.III - Valori caratteristici delle forze centrifughe", [[cell("Raggio di curvatura [m]", { latex: "\\text{Raggio di curvatura }[\\mathrm{m}]" }), cell("q4 [kN]", { latex: "q_4\\;[\\mathrm{kN}]" })]], [
            [cell("R < 200", { latex: "R<200" }), cell("0,2 Qv", { latex: "0{,}2Q_v" })],
            [cell("200 ≤ R ≤ 1500", { latex: "200\\le R\\le1500" }), cell("40 Qv/R", { latex: "40Q_v/R" })],
            [cell("1500 ≤ R", { latex: "1500\\le R" }), cell("0")],
        ]),
        table("5.1.iv", "5.1.3.14", "5.1.IV", 160, "Tab. 5.1.IV - Valori caratteristici delle azioni dovute al traffico", [[
            cell("Gruppo di azioni"), cell("Modello principale (schemi di carico 1, 2, 3, 4 e 6)"), cell("Veicoli speciali"), cell("Folla (Schema di carico 5)"), cell("Frenatura"), cell("Forza centrifuga"), cell("Carico uniformemente distribuito"),
        ]], [
            [cell("1"), cell("Valore caratteristico"), cell(""), cell(""), cell(""), cell(""), cell("Schema di carico 5 con valore di combinazione 2,5 kN/m²", { latex: "\\text{Schema di carico 5 con valore di combinazione }2{,}5\\,\\mathrm{kN/m^2}" })],
            [cell("2a"), cell("Valore frequente"), cell(""), cell(""), cell("Valore caratteristico"), cell(""), cell("")],
            [cell("2b"), cell("Valore frequente"), cell(""), cell(""), cell(""), cell("Valore caratteristico"), cell("")],
            [cell("3 (*)"), cell(""), cell(""), cell(""), cell(""), cell(""), cell("Schema di carico 5 con valore caratteristico 5,0 kN/m²", { latex: "\\text{Schema di carico 5 con valore caratteristico }5{,}0\\,\\mathrm{kN/m^2}" })],
            [cell("4 (**)"), cell(""), cell(""), cell("Schema di carico 5 con valore caratteristico 5,0 kN/m²", { latex: "\\text{Schema di carico 5 con valore caratteristico }5{,}0\\,\\mathrm{kN/m^2}" }), cell(""), cell(""), cell("Schema di carico 5 con valore caratteristico 5,0 kN/m²", { latex: "\\text{Schema di carico 5 con valore caratteristico }5{,}0\\,\\mathrm{kN/m^2}" })],
            [cell("5 (***)"), cell("Da definirsi per il singolo progetto"), cell("Valore caratteristico o nominale"), cell(""), cell(""), cell(""), cell("")],
        ], ["(*) Ponti pedonali", "(**) Da considerare solo se richiesto dal particolare progetto (ad es. ponti in zona urbana)", "(***) Da considerare solo se si considerano veicoli speciali"]),
        table("5.1.v", "5.1.3.14", "5.1.V", 161, "Tab. 5.1.V - Coefficienti parziali di sicurezza per le combinazioni di carico agli SLU", [[cell("Azione"), cell("Condizione"), cell("Coefficiente"), cell("EQU(1)", { latex: "\\mathrm{EQU}^{(1)}" }), cell("A1", { latex: "A_1" }), cell("A2", { latex: "A_2" })]], [
            [cell("Azioni permanenti g1 e g3", { latex: "\\text{Azioni permanenti }g_1\\text{ e }g_3" }), cell("favorevoli"), cell("γG1 e γG3", { latex: "\\gamma_{G1}\\text{ e }\\gamma_{G3}" }), cell("0,90"), cell("1,00"), cell("1,00")],
            [cell("Azioni permanenti g1 e g3", { latex: "\\text{Azioni permanenti }g_1\\text{ e }g_3" }), cell("sfavorevoli"), cell("γG1 e γG3", { latex: "\\gamma_{G1}\\text{ e }\\gamma_{G3}" }), cell("1,10"), cell("1,35"), cell("1,00")],
            [cell("Azioni permanenti non strutturali (2) g2", { latex: "\\text{Azioni permanenti non strutturali}^{(2)}\,g_2" }), cell("favorevoli"), cell("γG2", { latex: "\\gamma_{G2}" }), cell("0,00"), cell("0,00"), cell("0,00")],
            [cell("Azioni permanenti non strutturali (2) g2", { latex: "\\text{Azioni permanenti non strutturali}^{(2)}\,g_2" }), cell("sfavorevoli"), cell("γG2", { latex: "\\gamma_{G2}" }), cell("1,50"), cell("1,50"), cell("1,30")],
            [cell("Azioni variabili da traffico"), cell("favorevoli"), cell("γQ", { latex: "\\gamma_Q" }), cell("0,00"), cell("0,00"), cell("0,00")],
            [cell("Azioni variabili da traffico"), cell("sfavorevoli"), cell("γQ", { latex: "\\gamma_Q" }), cell("1,35"), cell("1,35"), cell("1,15")],
            [cell("Azioni variabili"), cell("favorevoli"), cell("γQi", { latex: "\\gamma_{Qi}" }), cell("0,00"), cell("0,00"), cell("0,00")],
            [cell("Azioni variabili"), cell("sfavorevoli"), cell("γQi", { latex: "\\gamma_{Qi}" }), cell("1,50"), cell("1,50"), cell("1,30")],
            [cell("Distorsioni e presollecitazioni di progetto"), cell("favorevoli"), cell("γε1", { latex: "\\gamma_{\\varepsilon1}" }), cell("0,90"), cell("1,00"), cell("1,00")],
            [cell("Distorsioni e presollecitazioni di progetto"), cell("sfavorevoli"), cell("γε1", { latex: "\\gamma_{\\varepsilon1}" }), cell("1,00 (3)"), cell("1,00 (4)"), cell("1,00")],
            [cell("Ritiro e viscosità, Cedimenti vincolari"), cell("favorevoli"), cell("γε2, γε3, γε4", { latex: "\\gamma_{\\varepsilon2},\\,\\gamma_{\\varepsilon3},\\,\\gamma_{\\varepsilon4}" }), cell("0,00"), cell("0,00"), cell("0,00")],
            [cell("Ritiro e viscosità, Cedimenti vincolari"), cell("sfavorevoli"), cell("γε2, γε3, γε4", { latex: "\\gamma_{\\varepsilon2},\\,\\gamma_{\\varepsilon3},\\,\\gamma_{\\varepsilon4}" }), cell("1,20"), cell("1,20"), cell("1,00")],
        ], ["(1) Equilibrio che non coinvolga i parametri di deformabilità e resistenza del terreno; altrimenti si applicano i valori della colonna A2.", "(2) Nel caso in cui l’intensità dei carichi permanenti non strutturali, o di una parte di essi (ad esempio carichi permanenti portati), sia ben definita in fase di progetto, per detti carichi o per la parte di essi nota si potranno adottare gli stessi coefficienti validi per le azioni permanenti.", "(3) 1,30 per instabilità in strutture con precompressione esterna", "(4) 1,20 per effetti locali"]),
        table("5.1.vi", "5.1.3.14", "5.1.VI", 161, "Tab. 5.1.VI - Coefficienti Ψ per le azioni variabili per ponti stradali e pedonali", [[cell("Azioni"), cell("Gruppo di azioni (Tab. 5.1.IV)"), cell("Coefficiente Ψ0 di combinazione", { latex: "\\text{Coefficiente }\\psi_0\\text{ di combinazione}" }), cell("Coefficiente Ψ1 (valori frequenti)", { latex: "\\text{Coefficiente }\\psi_1\\text{ (valori frequenti)}" }), cell("Coefficiente Ψ2 (valori quasi permanenti)", { latex: "\\text{Coefficiente }\\psi_2\\text{ (valori quasi permanenti)}" })]], [
            [cell("Azioni da traffico (Tab. 5.1.IV)"), cell("Schema 1 (carichi tandem)"), cell("0,75"), cell("0,75"), cell("0,0")],
            [cell("Azioni da traffico (Tab. 5.1.IV)"), cell("Schemi 1, 5 e 6 (carichi distribuiti)"), cell("0,40"), cell("0,40"), cell("0,0")],
            [cell("Azioni da traffico (Tab. 5.1.IV)"), cell("Schemi 3 e 4 (carichi concentrati)"), cell("0,40"), cell("0,40"), cell("0,0")],
            [cell("Azioni da traffico (Tab. 5.1.IV)"), cell("Schema 2"), cell("0,0"), cell("0,75"), cell("0,0")],
            [cell("Azioni da traffico (Tab. 5.1.IV)"), cell("2"), cell("0,0"), cell("0,0"), cell("0,0")],
            [cell("Azioni da traffico (Tab. 5.1.IV)"), cell("3"), cell("0,0"), cell("0,0"), cell("0,0")],
            [cell("Azioni da traffico (Tab. 5.1.IV)"), cell("4 (folla)"), cell("--"), cell("0,75"), cell("0,0")],
            [cell("Azioni da traffico (Tab. 5.1.IV)"), cell("5"), cell("0,0"), cell("0,0"), cell("0,0")],
            [cell("Vento"), cell("a ponte scarico - SLU e SLE"), cell("0,6"), cell("0,2"), cell("0,0")],
            [cell("Vento"), cell("in esecuzione"), cell("0,8"), cell("0,0"), cell("0,0")],
            [cell("Vento"), cell("a ponte carico - SLU e SLE"), cell("0,6"), cell("0,0"), cell("0,0")],
            [cell("Neve"), cell("SLU e SLE"), cell("0,0"), cell("0,0"), cell("0,0")],
            [cell("Neve"), cell("in esecuzione"), cell("0,8"), cell("0,6"), cell("0,5")],
            [cell("Temperatura"), cell("SLU e SLE"), cell("0,6"), cell("0,6"), cell("0,5")],
        ]),
    ],
    figures: [
        { id: asset("figure", "5.1.1"), unitId: "urn:structural-codes:it:unit:ntc2018:5.1.3.3.2", officialNumber: "5.1.1", pdfPage: 156, caption: "Fig. 5.1.1 - Esempio di numerazione delle corsie", alt: "Esempio di numerazione delle corsie convenzionali", imagePath: "figures/ntc2018/fig5.1.1.png", region: { coordinateSystem: "pdf-points-top-left", x: 75, y: 140, width: 340, height: 95 }, sha256: "" },
        { id: asset("figure", "5.1.2"), unitId: "urn:structural-codes:it:unit:ntc2018:5.1.3.3.5", officialNumber: "5.1.2", pdfPage: 157, caption: "Fig. 5.1.2 - Schemi di carico 1 – 5 (dimensioni in m)", alt: "Schemi di carico da 1 a 5 per ponti stradali", imagePath: "figures/ntc2018/fig5.1.2.png", region: { coordinateSystem: "pdf-points-top-left", x: 65, y: 345, width: 465, height: 320 }, sha256: "" },
        { id: asset("figure", "5.1.3.a"), unitId: "urn:structural-codes:it:unit:ntc2018:5.1.3.3.6", officialNumber: "5.1.3.a", pdfPage: 158, caption: "Fig. 5.1.3.a - Diffusione dei carichi concentrati nelle solette", alt: "Diffusione dei carichi concentrati nelle solette", imagePath: "figures/ntc2018/fig5.1.3.a.png", region: { coordinateSystem: "pdf-points-top-left", x: 75, y: 460, width: 260, height: 105 }, sha256: "" },
        { id: asset("figure", "5.1.3.b"), unitId: "urn:structural-codes:it:unit:ntc2018:5.1.3.3.6", officialNumber: "5.1.3.b", pdfPage: 158, caption: "Fig. 5.1.3.b - Diffusione dei carichi concentrati negli impalcati a piastra ortotropa", alt: "Diffusione dei carichi concentrati negli impalcati a piastra ortotropa", imagePath: "figures/ntc2018/fig5.1.3.b.png", region: { coordinateSystem: "pdf-points-top-left", x: 330, y: 465, width: 205, height: 100 }, sha256: "" },
    ],
};

const unitOutput = join(root, "corpus", "units", "ntc2018");
const assetOutput = join(root, "corpus", "assets", "ntc2018", "5.1-step1.json");
await mkdir(unitOutput, { recursive: true });
for (const figure of assetManifest.figures) {
    const image = await readFile(join(root, "corpus", "assets", figure.imagePath));
    figure.sha256 = createHash("sha256").update(image).digest("hex");
}
for (const def of units) {
    await writeFile(join(unitOutput, `${def.number}.json`), `${JSON.stringify(makeUnit(def), null, 2)}\n`, "utf8");
}
await writeFile(assetOutput, `${JSON.stringify(assetManifest, null, 2)}\n`, "utf8");
console.log(`NTC5 step1: ${units.length} unità e manifest asset scritto.`);
