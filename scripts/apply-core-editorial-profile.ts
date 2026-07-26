import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
    buildInlineSegments,
    type InlineSegment,
} from "./lib/inline-math.ts";

const repoRoot = fileURLToPath(new URL("../", import.meta.url));
const snapshotFile = join(
    repoRoot,
    "migration",
    "source-snapshots",
    "core-editorial-text-blocks.json",
);
const layoutFile = join(
    repoRoot,
    "migration",
    "layout",
    "core-editorial-layout.json",
);
const normalizationVersion = "core-editorial-profile-0.1.0";

type Transformation = {
    operation: string;
    ruleVersion: string;
    note: string;
};

type Evidence = {
    sourceId: string;
    pdfPage: number;
    printedPage: string | null;
    region: unknown;
    extraction: {
        method: "pdf-text" | "ocr" | "manual-transcription";
        tool: string;
        toolVersion: string;
    };
    transformations: Transformation[];
    rawSha256: string;
    normalizedSha256: string;
};

type TextBlock = {
    blockId: string;
    kind: "heading" | "paragraph" | "list-item" | "footnote";
    origin: "official";
    text: {
        raw: string;
        normalized: string;
        normalizationVersion: string;
        inline?: InlineSegment[];
    };
    evidence: Evidence;
};

type AssetBlock = {
    blockId: string;
    kind: "formula-ref" | "table-ref" | "figure-ref";
    origin: "official";
    assetId: string;
    evidence: Evidence;
};

type CanonicalUnit = {
    id: string;
    title: string;
    titleBlockId: string;
    numbering: { official: string };
    blocks: Array<TextBlock | AssetBlock>;
    assets: {
        formulaIds: string[];
        tableIds: string[];
        figureIds: string[];
    };
};

type SourceSnapshot = {
    formatVersion: 1;
    normalizationProfile: string;
    units: Record<string, TextBlock[]>;
};

type Layout = {
    documents: Record<
        string,
        {
            pages: Record<
                string,
                { boldLines: Array<{ text: string }> }
            >;
        }
    >;
};

type LineToken = {
    type: "line";
    raw: string;
    normalized: string;
    evidence: Evidence;
    breakAfter?: boolean;
};

type Asset = {
    id: string;
    unitId: string;
    officialNumber: string | null;
    pdfPage: number;
    imagePath?: string;
};

type AssetManifest = {
    formulas: Asset[];
    tables: Asset[];
    figures: Asset[];
};

type AssetToken = {
    type: "asset";
    asset: Asset;
    evidence: Evidence;
};

type Token = LineToken | AssetToken;

type Placement = {
    start: number;
    end: number;
    number: string;
    prefix?: string;
};

type GeneratedAssetPlacement = {
    start: number;
    end: number;
    assetId: string;
};

type GeneratedTablePlacements = {
    placements: Record<string, GeneratedAssetPlacement[]>;
};

const formulaPlacements: Record<string, Placement[]> = {
    "ntc2018:2.3@40": [
        { start: 9, end: 9, number: "2.2.1" },
        { start: 25, end: 25, number: "2.2.2" },
    ],
    "ntc2018:2.4.3@41": [{ start: 2, end: 2, number: "2.4.1" }],
    "ntc2018:2.5.3@43": [
        { start: 2, end: 2, number: "2.5.1" },
        { start: 4, end: 5, number: "2.5.2" },
        { start: 7, end: 7, number: "2.5.3" },
        { start: 9, end: 9, number: "2.5.4" },
        { start: 11, end: 11, number: "2.5.5" },
        { start: 13, end: 13, number: "2.5.6" },
        {
            start: 14,
            end: 15,
            number: "2.5.7",
            prefix: "Gli effetti dell'azione sismica saranno valutati tenendo conto delle masse associate ai seguenti carichi gravitazionali:",
        },
    ],
    "ntc2018:3.1.4.1@48": [
        {
            start: 5,
            end: 10,
            number: "3.1.1",
            prefix: "Il coefficiente riduttivo \u03b1A \u00e8 dato da:",
        },
        {
            start: 14,
            end: 18,
            number: "3.1.2",
            prefix: "Il coefficiente riduttivo \u03b1n \u00e8 dato da:",
        },
    ],
    "ntc2018:3.2.1@50": [{ start: 10, end: 12, number: "3.2.0" }],
    "ntc2018:3.2.2@50": [
        {
            start: 10,
            end: 16,
            number: "3.2.1",
            prefix: "La classificazione del sottosuolo si effettua in base alle condizioni stratigrafiche e ai valori della velocit\u00e0 equivalente di propagazione delle onde di taglio, VS,eq (in m/s), definita dall'espressione:",
        },
    ],
    "ntc2018:3.2.3.2.3@53": [{ start: 3, end: 12, number: "3.2.10", prefix: "Lo spettro di risposta elastico in spostamento si ricava dalla corrispondente risposta in accelerazione mediante la seguente espressione:" }],
    "ntc2018:3.2.3.3@54": [{ start: 1, end: 2, number: "3.2.12" }],
    "ntc2018:3.3.1@56": [
        { start: 3, end: 4, number: "3.3.1" },
        {
            start: 7,
            end: 17,
            number: "3.3.1.b",
            prefix: "ca \u00e8 il coefficiente di altitudine fornito dalla relazione:",
        },
    ],
    "ntc2018:3.3.2@57": [
        { start: 2, end: 3, number: "3.3.2" },
        {
            start: 7,
            end: 13,
            number: "3.3.3",
            prefix: "In mancanza di specifiche e adeguate indagini statistiche, il coefficiente di ritorno \u00e8 fornito dalla relazione:",
        },
    ],
    "ntc2018:3.3.4@58": [{ start: 1, end: 4, number: "3.3.4" }],
    "ntc2018:3.3.5@58": [{ start: 1, end: 3, number: "3.3.5" }],
    "ntc2018:3.3.6@58": [{ start: 0, end: 4, number: "3.3.6", prefix: "La pressione cinetica di riferimento qr \u00e8 data dall'espressione:" }],
    "ntc2018:3.3.7@58": [{ start: 3, end: 8, number: "3.3.7", prefix: "Per altezze sul suolo non maggiori di z = 200 m, il coefficiente di esposizione \u00e8 dato dalla formula:" }],
    "ntc2018:3.4.1@61": [{ start: 0, end: 1, number: "3.4.1", prefix: "Il carico provocato dalla neve sulle coperture \u00e8 valutato mediante la seguente espressione:" }],
    "ntc2018:3.6.1.1@66": [{ start: 23, end: 24, number: "3.6.1", prefix: "I valori del carico d'incendio specifico di progetto sono determinati mediante la relazione:" }],
    "circ2019:C3.2.1@48": [
        { start: 26, end: 28, number: "C3.2.1" },
    ],
    "circ2019:C3.2.1@49": [
        { start: 17, end: 23, number: "C3.2.2" },
        { start: 42, end: 51, number: "C3.2.3" },
    ],
    "circ2019:C3.2.2@51": [
        { start: 0, end: 16, number: "C3.2.4" },
    ],
    "circ2019:C3.2.3.6@54": [
        { start: 15, end: 21, number: "C3.2.5" },
    ],
    "circ2019:C3.3.2@54": [
        { start: 3, end: 4, number: "C3.3.1" },
        { start: 8, end: 10, number: "C3.3.2" },
    ],
    "circ2019:C3.3.8@55": [
        { start: 13, end: 15, number: "C3.3.3" },
    ],
    "circ2019:C4.1.1.1@86": [{ start: 9, end: 11, number: "C4.1.1", prefix: "Il diagramma dei momenti flettenti deve risultare staticamente ammissibile, cioè deve essere equilibrato e soddisfare in ogni sezione la condizione:" }],
    "circ2019:C4.1.2.2.2@90": [
        { start: 5, end: 6, number: "C4.1.2", prefix: "Detto pf il valore assunto dal parametro nella membratura interamente fessurata e p quello nella membratura interamente reagente, il valore di calcolo p* \u00e8 dato da:" },
        { start: 7, end: 7, number: "C4.1.3", prefix: "in cui:" },
        { start: 20, end: 25, number: "C4.1.4", prefix: "Per travi e solai con luci non superiori a 10 m \u00e8 possibile omettere la verifica delle inflessioni se il rapporto l/h rispetta la limitazione:" },
    ],
    "circ2019:C4.1.2.2.4.5@91": [
        { start: 1, end: 3, number: "C4.1.5", prefix: "L'ampiezza caratteristica di verifica delle fessure, wk, pu\u00f2 essere calcolata con l'espressione:" },
        { start: 7, end: 16, number: "C4.1.6", prefix: "La deformazione unitaria media delle barre d'armatura pu\u00f2 essere calcolata con l'espressione:" },
    ],
    "circ2019:C4.1.2.2.4.5@92": [
        { start: 1, end: 5, number: "C4.1.7", prefix: "Quando la spaziatura delle armature non supera 5(c + \u03c6/2), la distanza media tra le fessure pu\u00f2 essere valutata con l'espressione:" },
        { start: 7, end: 12, number: "C4.1.8", prefix: "\u03c6 \u00e8 il diametro delle barre; se sono impiegati diametri diversi, si adotta il diametro equivalente:" },
        { start: 18, end: 20, number: "C4.1.9", prefix: "In caso di trazione eccentrica, o per singole parti di sezione, k2 pu\u00f2 essere calcolato con la relazione:" },
        { start: 25, end: 28, number: "C4.1.10", prefix: "Nelle zone in cui la spaziatura supera 5(c + \u03c6/2), nella parte rimanente la distanza media tra le fessure pu\u00f2 essere valutata con l'espressione:" },
    ],
    "circ2019:C4.1.2.3.4.2@93": [
        { start: 0, end: 7, number: "C4.1.11", prefix: "Con riferimento alla verifica di resistenza dei pilastri di c.a. soggetti a sola compressione assiale, la prescrizione circa l’eccentricità minima dell’azione assiale da tenere in conto può essere implicitamente soddisfatta valutando NRd con la formula:" },
    ],
    "circ2019:C4.1.12.1.1.1@97": [
        { start: 0, end: 1, number: "C4.1.12" },
        { start: 2, end: 2, number: "C4.1.13" },
        { start: 3, end: 3, number: "C4.1.12.eta1", prefix: "dove:" },
        { start: 8, end: 9, number: "C4.1.12.flcm", prefix: "Il valore di flcm è pari a:" },
        { start: 10, end: 10, number: "C4.1.14.a", prefix: "I valori caratteristici della resistenza a trazione semplice, corrispondenti ai frattili 0,05 e 0,95, possono assumersi pari a. Frattile 5%:" },
        { start: 11, end: 11, number: "C4.1.14.b", prefix: "Frattile 95%:" },
        { start: 12, end: 12, number: "C4.1.15", prefix: "La resistenza a trazione di calcolo è pari a:" },
    ],
    "circ2019:C4.1.12.1.1.2@97": [
        { start: 0, end: 6, number: "C4.1.16", prefix: "In assenza di sperimentazione diretta, il modulo elastico secante a compressione a 28 giorni pu\u00f2 essere stimato con l'espressione:" },
        { start: 9, end: 11, number: "C4.1.16.etae", prefix: "con:" },
    ],
    "circ2019:C4.1.12.1.3.1@98": [
        { start: 2, end: 5, number: "C4.1.13.strains.le50", prefix: "Per calcestruzzi di classe di resistenza inferiore o uguale a LC 50/55:" },
        { start: 6, end: 9, number: "C4.1.13.strains.55", prefix: "Per calcestruzzi di classe di resistenza pari a LC 55/60:" },
    ],
    "circ2019:C4.1.12.1.3.2.1@98": [
        { start: 2, end: 5, number: "C4.1.17", prefix: "La resistenza a taglio di un elemento fessurato da momento flettente pu\u00f2 essere valutata con la formula:" },
        { start: 6, end: 10, number: "C4.1.17.parameters", prefix: "nella quale:" },
        { start: 19, end: 23, number: "C4.1.18", prefix: "In ogni caso il taglio di calcolo VEd non deve superare la limitazione:" },
        { start: 24, end: 24, number: "C4.1.19", prefix: "Il fattore di riduzione della resistenza del calcestruzzo fessurato per taglio è dato da:" },
    ],
};

const lineReplacements: Record<string, Record<number, string | null>> = {
    "circ2019:C3.2@46": {
        11: "di riferimento” VR e la probabilità è denominata “probabilità di eccedenza o di superamento nel periodo di riferimento” PVR.",
        12: null,
    },
    "circ2019:C3.2@47": {
        0: "Le caratteristiche del moto sismico atteso al sito di riferimento, per una fissata PVR, sono espresse dall’accelerazione massima e dallo spettro di risposta elastico in accelerazione.",
        1: null,
        2: null,
        3: "È ammessa la possibilità di descrivere il terremoto in forma di storie temporali del moto del terreno, a condizione che esse siano compatibili con le caratteristiche del moto sismico attese. In particolare, per ciascuna PVR i caratteri del moto sismico su sito di riferimento rigido orizzontale sono descritti dalla distribuzione sul territorio nazionale delle seguenti grandezze, sulla base delle quali risultano compiutamente definiti gli spettri elastici di risposta:",
        4: null,
        5: null,
        6: null,
        7: null,
        8: "ag = accelerazione massima al sito;",
        9: "Fo = valore massimo del fattore di amplificazione dello spettro in accelerazione orizzontale;",
        10: "TC* = periodo di inizio del tratto a velocità costante dello spettro in accelerazione orizzontale.",
        11: null,
        12: "Il valore di ag è desunto dalla pericolosità di riferimento, attualmente fornita dallo INGV, mentre Fo e TC* sono calcolati in modo che gli spettri di risposta elastici in accelerazione, velocità e spostamento forniti dalle NTC approssimino al meglio i corrispondenti spettri di risposta elastici in accelerazione, velocità e spostamento derivanti dalla pericolosità di riferimento.",
        13: null,
        14: null,
        15: null,
        16: null,
        17: "I valori di ag, Fo e TC* sono riportati negli allegati A e B al decreto del Ministro delle Infrastrutture 14 gennaio 2008 pubblicato nel S.O. alla Gazzetta Ufficiale del 4 febbraio 2008 n. 29 e negli eventuali successivi aggiornamenti; di essi si fornisce la rappresentazione in termini di andamento medio in funzione del periodo di ritorno TR, per l’intero territorio nazionale (v. Figure C3.2.1a, b, c). Si riportano inoltre, in corrispondenza di ciascun valore di TR, i relativi intervalli di confidenza al 95% valutati con riferimento ad una distribuzione log-normale, per fornire una misura della loro variabilità sul territorio (“variabilità spaziale”).",
        18: null,
        19: null,
        20: null,
        21: null,
        22: null,
        23: "Nel caso di costruzioni di notevoli dimensioni, va considerata l’azione sismica più sfavorevole calcolata sull’intero sito ove sorge la costruzione e, ove fosse necessario, la variabilità spaziale del moto di cui al § 3.2.5. Figura C3.2.1a – Variabilità di ag con TR: andamento medio sul territorio nazionale ed intervallo di confidenza al 95%",
        24: null,
        25: null,
        26: "Figura C3.2.1b – Variabilità di Fo con TR: andamento medio sul territorio nazionale ed intervallo di confidenza al 95%",
        27: "Figura C3.2.1c – Variabilità di TC* con TR: andamento medio sul territorio nazionale ed intervallo di confidenza al 95%",
        28: null,
        29: null,
        30: null,
        31: null,
        32: null,
        33: null,
        34: null,
        35: null,
        36: null,
        37: null,
        38: null,
        39: null,
        40: null,
        41: null,
        42: null,
        43: null,
        44: null,
        45: null,
        46: null,
        47: null,
        48: null,
        49: null,
        50: null,
        51: null,
        52: null,
        53: null,
        54: null,
        55: null,
        56: null,
        57: null,
        58: null,
        59: null,
        60: null,
        61: null,
        62: null,
        63: null,
        64: null,
        65: null,
    },
    "circ2019:C3.2.1@48": {
        16: "Ai quattro stati limite sono attribuiti (v. Tabella 3.2.I delle NTC) valori della probabilità di superamento PVR pari rispettivamente a 81%, 63%, 10% e 5%, valori che restano immutati quale che sia la classe d’uso della costruzione considerata; tali probabilità, valutate nel periodo di riferimento VR proprio della costruzione considerata, consentono di individuare, per ciascuno stato limite, l’azione sismica di progetto corrispondente.",
        17: null,
        18: null,
        19: null,
        20: null,
        21: "Viene preliminarmente valutato il periodo di riferimento VR della costruzione (espresso in anni), ottenuto come prodotto tra la vita nominale VN fissata all’atto della progettazione ed il coefficiente d’uso CU che compete alla classe d’uso nella quale la costruzione ricade (v. § 2.4 delle NTC). Si ricava poi, per ciascuno stato limite e relativa probabilità di eccedenza PVR nel periodo di riferimento VR, il periodo di ritorno TR del sisma. Si utilizza a tal fine la relazione:",
        22: null,
        23: null,
        24: null,
        25: null,
        29: "ottenendo, per i vari stati limite, le espressioni di TR in funzione di VR riportate nella Tabella C3.2.I.",
        47: null,
        48: null,
        49: null,
        50: null,
        51: null,
        52: "Alla base dei risultati così ottenuti è la strategia progettuale che impone, al variare del periodo di riferimento VR, la costanza della probabilità di superamento PVR di ciascuno degli stati limite considerati (strategia progettuale di norma).",
        53: null,
        54: null,
        55: "È immediato constatare (v. formula C3.2.1) che, imponendo PVR = costante al variare di CU, si ottiene TR = CUVN/[-ln(1-PVR)] e dunque, a parità di VN, TR varia dello stesso fattore CU per cui viene moltiplicata VN per avere VR.",
        56: null,
        57: null,
        58: null,
        59: null,
        60: null,
        61: null,
        62: null,
        63: "Fissata la vita nominale VN della costruzione e valutato il periodo di ritorno TR,1 corrispondente a CU = 1, si ricava il TR corrispondente al generico CU dal prodotto CU·TR,1. Al variare di CU, TR e VR variano con legge uguale.",
        64: null,
        65: null,
        66: null,
    },
    "circ2019:C3.2.1@49": {
        0: "Strategie progettuali alternative a quella ora illustrata sono ipotizzabili².",
        7: "Per rispettare le limitazioni testé citate, al variare della classe d’uso e del coefficiente CU, si può utilizzare CU non per aumentare VN, portandola a VR, ma per ridurre PVR.",
        8: null,
        9: null,
        10: null,
        11: null,
        12: "In tal caso si ha TR = -VN/ln(1-PVR/CU); detto TR,a il periodo di ritorno ottenuto con la strategia progettuale di norma e TR,b il periodo di ritorno ottenuto con la strategia progettuale appena illustrata, il rapporto R tra i due periodi di ritorno varrebbe:",
        13: null,
        14: null,
        15: null,
        16: null,
        24: "ed avrebbe, al variare di CU e PVR, gli andamenti riportati nel grafico successivo. Figura C3.2.2 – Variazione di R con CU e PVR",
        25: null,
        26: "Constatato che, con la strategia ipotizzata, si rispettano le condizioni preliminarmente indicate come irrinunciabili (sostanziale costanza di TR, dunque protezione sostanzialmente immutata, per i valori di PVR relativi agli SLU, ossia per PVR ≤ 10%; significativa crescita di TR, dunque protezione significativamente incrementata, per i valori di PVR relativi agli SLE, ossia per PVR ≥ 60%) si può poi passare a valutare come applicare l’indicazione di norma, ossia come modificare le PVR.",
        27: null,
        28: null,
        29: null,
        30: null,
        31: null,
        32: null,
        33: null,
        34: "Per trovare come modificare, al variare di CU, i valori di PVR nel periodo di riferimento VR per ottenere gli stessi valori di TR suggeriti dalla strategia ipotizzata, basta imporre R = 1 nella formula C3.2.2 ed indicare con P*VR i nuovi valori di PVR, così ottenendo:",
        35: null,
        36: null,
        37: null,
        38: null,
        39: null,
        40: null,
        41: null,
        52: "È così possibile ricavare, al variare di CU, i valori di P*VR a partire dai valori di PVR; tali valori sono riportati, insieme ai valori di TR corrispondenti, nella Tabella C3.2.II. Adottando la strategia ipotizzata, al crescere di CU i valori dei P*VR corrispondenti agli Stati Limite di Esercizio (SLE) si riducono sensibilmente ed i corrispondenti TR crescono, mentre i valori dei P*VR corrispondenti agli Stati Limite Ultimi (SLU) ed i corrispondenti TR sostanzialmente non variano.",
        53: null,
        54: null,
        55: null,
        56: null,
        57: null,
        58: null,
        59: null,
        60: null,
        61: null,
        62: null,
        63: null,
        69: "² Si veda al riguardo EN 1998-1, § 2.1, punto 4.",
    },
    "circ2019:C3.2.1@50": {
        0: null,
        1: null,
        2: null,
        3: null,
        4: null,
        5: null,
        6: null,
        7: null,
        8: null,
        9: null,
        10: null,
        11: null,
        12: null,
        13: null,
        14: null,
        15: null,
        16: "Se dunque la protezione nei confronti degli SLE è di prioritaria importanza, si possono sostituire i valori di PVR con quelli di P*VR, così conseguendo una miglior protezione nei confronti degli SLE. La strategia progettuale testé ipotizzata, peraltro, conduce ad un’opera decisamente più costosa e dunque è lecito adottarla unicamente nei casi in cui gli SLE siano effettivamente di prioritaria importanza.",
        17: null,
        18: null,
        19: null,
        20: null,
        21: null,
        22: null,
        23: "Ottenuti i valori di TR corrispondenti ai quattro stati limite considerati (utilizzando, a seconda dei casi, la strategia progettuale a o b) si possono infine ricavare, al variare del sito nel quale la costruzione sorge ed utilizzando i dati riportati negli Allegati A e B al Decreto del Ministro delle Infrastrutture 14 gennaio 2008 e eventuali successivi aggiornamenti, l’accelerazione del suolo ag e le forme dello spettro di risposta di progetto per ciascun sito, costruzione, situazione d’uso, stato limite.",
        24: null,
        25: null,
        26: null,
    },
    "circ2019:C3.2.2@50": {
        7: "Le modifiche sopra citate corrispondono a:",
        8: "- effetti stratigrafici, legati alla successione stratigrafica, alle proprietà meccaniche dei terreni, alla geometria del contatto tra il substrato rigido e i terreni sovrastanti ed alla geometria dei contatti tra gli strati di terreno;",
        9: "- effetti topografici, legati alla configurazione topografica del piano campagna. La modifica delle caratteristiche del moto sismico per effetto della geometria superficiale del terreno è dovuta alla focalizzazione delle onde sismiche in prossimità della cresta dei rilievi a seguito dei fenomeni di riflessione delle onde sismiche ed all’interazione tra il campo d’onda incidente e quello diffratto. I fenomeni di amplificazione cresta-base aumentano in proporzione al rapporto tra l’altezza del rilievo e la sua larghezza.",
        10: null,
        11: null,
        12: null,
        13: null,
        23: "L’identificazione della categoria del sottosuolo è basata sulla descrizione stratigrafica e sui valori della velocità di propagazione delle onde di taglio VS. Ai fini della valutazione semplificata della risposta sismica locale, nelle NTC non è più consentita la classificazione del sottosuolo sulla base del parametro NSPT,30 per i terreni a grana grossa e cu,30 per i terreni a grana fine. Le NTC richiedono, quindi, che la categoria di sottosuolo sia stabilita sulla base del profilo VS. La misura diretta di VS attraverso specifiche indagini geofisiche è in ogni caso preferibile, essendo consentita, in alternativa, la definizione del profilo VS attraverso il ricorso a correlazioni empiriche “di comprovata affidabilità” solo per il metodo semplificato ed in ipotesi residuali, stante la maggiore incertezza che caratterizza la determinazione di VS con le citate correlazioni empiriche. In caso di utilizzo di correlazioni empiriche è comunque raccomandabile non limitarsi all’uso di un singolo modello empirico, al fine di consentire una stima dell’incertezza legata al carattere regionale di tali correlazioni e alla conseguente elevata dispersione dei relativi dati sperimentali.",
        24: null,
        25: null,
        26: null,
        27: null,
        28: null,
        29: null,
        30: null,
        31: null,
        32: null,
        33: "Fatta salva la necessità di estendere le indagini geotecniche nel volume significativo di terreno interagente con l’opera, la classificazione si effettua in base ai valori della velocità equivalente VS,eq definita mediante la media armonica [3.2.1] delle NTC ([C3.2.4]).",
        34: null,
        35: null,
    },
    "circ2019:C3.2.2@51": {
        17: "La velocità equivalente è ottenuta imponendo l’equivalenza tra i tempi di arrivo delle onde di taglio in un terreno omogeneo equivalente di spessore pari ad H. Dove H è la profondità del substrato definito come quella formazione costituita da roccia o terreno molto rigido caratterizzato da valori di VS non inferiori ad 800 m/s. Per depositi con profondità H del substrato superiore a 30 m, la velocità equivalente delle onde di taglio VS,eq è definita dal parametro VS,30 ottenuto ponendo H = 30 m nell’equazione [3.2.1]-[C3.2.4] e considerando le proprietà degli strati di terreno fino a tale profondità. Derivando da una media armonica, la velocità equivalente assume valori differenti da quelli ottenuti dalla media aritmetica delle velocità dei singoli strati pesata sui relativi spessori, soprattutto in presenza di strati molto deformabili di limitato spessore. Lo scopo della definizione adottata è quello di privilegiare il contributo degli strati più deformabili.",
        18: null,
        19: null,
        20: null,
        21: null,
        22: null,
        23: null,
        24: null,
        25: "Per terreni nei quali la profondità del substrato è maggiore di 30 m (H > 30 m), la VS,eq, così come definita dall’equazione [3.2.1]-[C3.2.4], coincide di fatto con la VS,30 delle NTC 2008. L’introduzione della VS,eq, unita alla modifica nella definizione delle categorie di sottosuolo, si è resa necessaria al fine di includere nell’attuale testo normativo le configurazioni stratigrafiche che rimanevano escluse nelle NTC 2008 (ad esempio profili di tipo B con profondità del substrato inferiore a 30 m).",
        26: null,
        27: null,
        28: null,
    },
    "circ2019:C3.2.3@51": {
        6: "La rappresentazione di riferimento per le componenti dell’azione sismica è lo spettro di risposta elastico in accelerazione per uno smorzamento convenzionale del 5%. Esso fornisce la risposta massima in accelerazione del generico sistema dinamico elementare con periodo di oscillazione T ≤ 4 s ed è espresso come il prodotto di una forma spettrale per l’accelerazione massima del terreno.",
        7: null,
        8: null,
        9: "La forma spettrale per le componenti orizzontali è definita mediante le stesse espressioni fornite dall’UNI EN 1998 nelle quali, tuttavia, non si è assunto un singolo valore per l’amplificazione massima ma si è fornita tale grandezza, Fo, in funzione della pericolosità del sito insieme alle grandezze ag, TC e, conseguentemente, TB, TD. Per la componente verticale, invece, le uniche grandezze fornite in funzione della pericolosità del sito sono l’accelerazione massima, posta pari alla massima accelerazione orizzontale del suolo ag, e l’amplificazione massima Fv, espressa come funzione di ag.",
        10: null,
        11: null,
        12: null,
        13: null,
        14: null,
        15: null,
        16: null,
        17: null,
        18: null,
        19: null,
        20: "La categoria di sottosuolo e le condizioni topografiche incidono sullo spettro elastico di risposta. Specificamente, l’accelerazione spettrale massima dipende dal coefficiente S = SS·ST che comprende gli effetti delle amplificazioni stratigrafica (SS) e topografica (ST). Per le componenti orizzontali dell’azione sismica, il periodo TC di inizio del tratto a velocità costante dello spettro è funzione invece del coefficiente CC, dipendente anch’esso dalla categoria di sottosuolo.",
        21: null,
        22: null,
        23: null,
        24: null,
        27: "Per le componenti orizzontali dell’azione sismica il coefficiente SS è definito nella Tabella 3.2.IV delle NTC. Esso è il rapporto tra il valore dell’accelerazione massima attesa in superficie e quello su sottosuolo di categoria A ed è definito in funzione della categoria di sottosuolo e del livello di pericolosità sismica di base del sito (descritto dal prodotto Fo·ag).",
        28: null,
        29: null,
        30: null,
        31: null,
    },
    "circ2019:C3.2.3@52": {
        1: "Nella Figura C3.2.3 è mostrata, per le cinque categorie di sottosuolo, la variazione di SS in funzione del prodotto Fo·ag.",
        2: null,
        3: null,
        4: "A parità di categoria di sottosuolo, l’andamento di SS con Fo·ag è caratterizzato da due tratti orizzontali, rispettivamente per bassi ed elevati valori di pericolosità sismica di base; tali tratti sono raccordati da un segmento di retta che descrive il decremento lineare di SS con Fo·ag.",
        5: null,
        6: null,
        7: null,
        8: null,
        9: null,
        10: "In genere, per bassi valori di pericolosità sismica di base, a parità di Fo·ag i valori di SS si incrementano al decrescere della rigidezza del sottosuolo, passando dal sottosuolo di categoria A al sottosuolo di categoria E. In particolare, per Fo·ag < 0,78g, il sottosuolo di categoria D mostra amplificazioni maggiori delle altre categorie di sottosuolo. Come conseguenza del comportamento ciclico non lineare e dissipativo del terreno, per valori elevati della pericolosità sismica di base si osserva un’inversione di tendenza. Per 0,78g ≤ Fo·ag < 1,17g i fenomeni di amplificazione diventano più marcati per il sottosuolo di categoria C mentre per elevati livelli di pericolosità sismica del sito, caratterizzati da valori del prodotto Fo·ag > 0,93g, le accelerazioni massime su sottosuolo di categoria D sono inferiori a quelle su sottosuolo di categoria A. Si verifica cioè una deamplificazione del moto in termini di accelerazione massima.",
        11: null,
        12: null,
        13: null,
        14: null,
        15: null,
        16: null,
        17: null,
        18: null,
        19: null,
        20: null,
        21: null,
        22: "Per la componente verticale dell’azione sismica, in assenza di studi specifici, si assume SS = 1.",
        23: "Figura C3.2.4 – Andamento del coefficiente CC",
        24: "Il coefficiente CC è definito nella Tabella 3.2.IV delle NTC in funzione della categoria di sottosuolo e del valore di TC riferito a sottosuolo di categoria A, TC*. Nella Figura C3.2.4, la variazione di CC è mostrata, per le cinque categorie di sottosuolo, in funzione di TC*.",
        25: null,
        26: null,
        27: "A parità della categoria di sottosuolo, il coefficiente CC decresce al crescere di TC* e, conseguentemente, l’effetto di amplificazione massima si sposta verso periodi più brevi e si riduce l’estensione del tratto orizzontale caratterizzato da ordinata spettrale massima. In genere, a parità di TC*, i valori di CC si incrementano al decrescere della rigidezza del sottosuolo, ovvero passando dal sottosuolo di categoria A al sottosuolo di categoria E. Il sottosuolo di categoria D presenta, nell’intervallo di valori di interesse, valori di TC maggiori di quelli relativi alle altre categorie di sottosuolo.",
        28: null,
        29: null,
        30: null,
        31: null,
        32: null,
        33: null,
        34: null,
        35: null,
        36: null,
        37: null,
        38: null,
    },
    "circ2019:C3.2.3@53": {
        0: null,
        1: null,
    },
    "circ2019:C3.2.3.1@53": {
        0: "Se le azioni sismiche al piano di fondazione sono ricavate mediante analisi di risposta sismica locale, si può procedere nella maniera seguente:",
        1: "- Si selezionano accelerogrammi rappresentativi delle azioni su affioramento rigido di riferimento, verificandone la compatibilità con lo spettro elastico di risposta secondo quanto disposto al § 3.2.3.6 della norma e tenendo conto delle indicazioni fornite al successivo C3.2.3.6 e al C7.11.3.1.2.2.",
        2: null,
        3: null,
        4: "- Dalle analisi di risposta sismica locale si ottiene, per ciascun accelerogramma, il corrispondente accelerogramma in superficie o sul piano di riferimento (ad esempio il piano di fondazione) e il relativo spettro elastico di risposta.",
        5: null,
        6: "- Per le analisi con spettro elastico di risposta si adotta lo spettro medio, ottenuto dagli spettri determinati con l’analisi di risposta sismica locale. Per le analisi nel dominio del tempo si utilizzano direttamente gli accelerogrammi ricavati dall’analisi di risposta sismica locale.",
        7: null,
        8: null,
    },
    "circ2019:C3.2.3.2.1@53": {
        0: "Il fattore η tiene conto delle capacità dissipative delle costruzioni alterando lo spettro di risposta assunto a riferimento, per il quale η = 1, definito come lo spettro elastico con smorzamento viscoso convenzionale ξ = 5%. La relazione [3.2.4] può essere utilizzata per costruzioni che non subiscono significativi danneggiamenti e può essere utilizzata nel campo di smorzamenti convenzionali compresi tra i valori ξ = 5% e ξ = 28%. Al di fuori di questo campo, la scelta del valore del fattore η deve essere adeguatamente giustificata.",
        1: null,
        2: null,
        3: null,
        4: null,
        5: "Nel caso di significativi danneggiamenti, generalmente associati ad azioni riferite agli Stati Limite Ultimi, il fattore η può essere calcolato in funzione del fattore di struttura q previsto per lo Stato Limite considerato secondo quanto definito al § 3.2.3.5 delle NTC.",
        6: null,
        7: null,
    },
    "circ2019:C3.2.3.6@54": {
        0: "1. Per ogni coppia di registrazioni orizzontali, si costruisce uno spettro SRSS, dato dalla radice quadrata della somma dei quadrati degli spettri di ogni componente;",
        1: null,
        2: "2. Lo “spettro medio SRSS” è pari alla media degli spettri SRSS di ciascuna coppia di accelerogrammi, appartenente al medesimo gruppo di storie temporali;",
        3: null,
        4: "3. Le coppie di registrazioni, nel numero indicato dalla norma, devono essere selezionate e scalate in modo tale che lo spettro medio SRSS approssimi, secondo i criteri di coerenza spettrale di norma, lo “spettro di riferimento”, dato dal prodotto dello spettro elastico di progetto per un opportuno coefficiente α.",
        5: null,
        6: null,
        7: "Il valore del coefficiente α è in genere non superiore a 1,3 che corrisponde alla risultante di due componenti il cui rapporto è circa pari a 0,85. Tuttavia, nel definire la coerenza spettrale, con particolare riguardo al rapporto fra le componenti accelerometriche, in assenza di studi sismo-tettonici specifici che giustifichino scelte differenti, si deve adottare un valore limite per il coefficiente α pari a √2, ovvero la risultante di due componenti uguali tra loro, come specificato al § 3.2.3.1 della norma.",
        8: null,
        9: null,
        10: null,
        11: "Ai fini dell’impiego di accelerogrammi nelle analisi, una descrizione delle azioni sismiche coerente con l’evento di origine può essere ottenuta proiettando ciascuna coppia di registrazioni lungo le direzioni principali del sisma, definite come le direzioni per le quali si annulla la correlazione tra le componenti. Il coefficiente di correlazione tra due componenti accelerometriche X e Y nell’intervallo di tempo t1 < t < t2 può essere così determinato:",
        12: null,
        13: null,
        14: null,
        22: "dove t1 e t2 rappresentano gli estremi dell’intervallo temporale considerato, che può essere assunto corrispondente alla fase intensa del sisma.",
        23: null,
    },
    "circ2019:C3.3.2@54": {
        0: "In questo paragrafo vengono introdotte, in mancanza di indagini statistiche adeguate, le seguenti espressioni che forniscono la velocità di riferimento del vento vb(TR) riferita ad un generico periodo di ritorno:",
        1: null,
        2: null,
        5: "dove:",
        6: "vb è la velocità di riferimento del vento associata a un periodo di ritorno di 50 anni; αR è un coefficiente fornito dalla Figura C3.3.1, alla quale corrisponde l’espressione:",
        7: null,
        11: "dove TR è espresso in anni.",
    },
    "circ2019:C3.3.2@55": {
        0: "Figura C3.3.1 – αR in funzione del periodo di ritorno TR (asse in scala logaritmica)",
    },
    "circ2019:C3.3.8@55": {
        3: "Nel seguito, in riferimento alle costruzioni di forma regolare indicate ai paragrafi da C3.3.8.1 a C3.3.8.4, si forniscono tre distinte serie di coefficienti di pressione esterna:",
        4: "- coefficienti globali cpe, che possono essere utilizzati in tutti i casi in cui la rappresentazione delle azioni aerodinamiche del vento possa essere effettuata in maniera semplificata, rivolta alla valutazione delle azioni globali su porzioni estese di costruzioni o delle risultanti delle azioni indotte dal vento sugli elementi principali della struttura;",
        5: null,
        6: null,
        7: "- coefficienti locali cpe,10, che consentono una rappresentazione più realistica dell’effettivo campo di pressione che si instaura sulle superfici delle costruzioni e che possono essere impiegati sia in alternativa ai coefficienti di pressione globali cpe, sia per quantificare la pressione locale sugli elementi con area di incidenza maggiore o uguale a 10 m²;",
        8: null,
        9: null,
        10: "- coefficienti locali cpe,1, che consentono la quantificazione della pressione locale su elementi di piccole dimensioni con un’area di incidenza minore o uguale a 1 m² (quali elementi di rivestimento ed i loro fissaggi).",
        11: null,
        12: "Per i coefficienti di pressione locali relativi ad un’area di incidenza compresa fra 1 e 10 m², il valore è pari a:",
        16: "dove:",
        17: "A è l’area di incidenza della pressione del vento.",
    },
    "circ2019:C3.3.8.1.1@56": {
        0: "I coefficienti globali cpe da assumere sulle pareti di un edificio a pianta rettangolare sono riportati in Figura C3.3.2 e in Tabella C3.3.I. Figura C3.3.2 – a) Parametri caratteristici di edifici a pianta rettangolare; b) Edifici a pianta rettangolare: cpe per facce sopravento, sottovento e laterali",
        1: null,
        2: null,
        3: null,
        4: null,
        5: null,
        10: "I coefficienti locali cpe,10 e di dettaglio cpe,1 da assumere sulle pareti di un edificio a pianta rettangolare sono riportati in Figura C3.3.3 e in Tabella C3.3.II; il valore della dimensione e è pari al minimo tra b e 2h.",
        11: null,
        12: "Figura C3.3.3 – a) Schema planimetrico di riferimento; b) Suddivisione delle pareti verticali di edificio a pianta rettangolare in zone di uguale pressione (prospetti laterali)",
        13: null,
        14: null,
    },
    "circ2019:C3.3.8.1.1@57": {
        0: null,
        1: null,
        2: null,
        3: null,
        4: null,
    },
    "circ2019:C3.3.8.1.1.1@57": {
        0: "La distribuzione altimetrica della pressione sulle pareti della costruzione è, in generale, diversa dal profilo della pressione cinetica di picco del vento indisturbato, come si ricava attraverso il coefficiente di esposizione (§ 3.3.7 delle NTC). In conseguenza di ciò, è opportuno calcolare la pressione cinetica di picco in corrispondenza di un punto posto ad una quota detta di riferimento (z̄e), tale da consentire la stima, generalmente a favore di sicurezza, della risultante delle pressioni agenti sulle pareti verticali dell’edificio.",
        1: null,
        2: null,
        3: null,
        4: null,
        5: null,
        6: "Per gli edifici bassi, ossia con altezza minore o uguale della dimensione in pianta ortogonale al flusso del vento (h ≤ b), l’altezza di riferimento è costante e pari alla quota di sommità dell’edificio (z̄e = h); la pressione del vento è pertanto uniforme.",
        7: null,
        8: null,
        9: "Per gli edifici alti, ossia con altezza compresa fra la dimensione in pianta ortogonale al flusso del vento e 5 volte la profondità dell’edificio (b < h ≤ 5·d), si definiscono due zone distinte. Nella prima parte dell’edificio, sino alla quota z = b, l’altezza di riferimento è costante e pari a z̄e = b; la pressione del vento è pertanto uniforme. Nella parte superiore dell’edificio, per z compreso fra b e h, la quota di riferimento z̄e può essere scelta seguendo uno dei due seguenti criteri (Figura C3.3.4):",
        10: null,
        11: null,
        12: null,
        13: null,
        14: null,
        15: "1. L’altezza di riferimento è costante e pari alla sommità dell’edificio (z̄e = h); la pressione del vento è pertanto uniforme fra le quote z = b e z = h. In questo modo il calcolo delle forze aerodinamiche è semplificato, ma la forza totale che ne risulta è generalmente maggiore di quella reale.",
        16: null,
        17: null,
        18: null,
        19: "2. L’edificio è suddiviso in tronchi di altezza arbitraria, a ciascuno dei quali corrisponde un’altezza di riferimento costante pari alla sommità del tronco; se l’altezza di ciascun tronco coincide con l’interpiano dell’edificio, ed ogni singolo tronco risulta centrato sulla posizione degli elementi orizzontali (solai), è lecito ammettere che l’altezza di riferimento sia pari alla quota del solaio relativo; in entrambi i casi la pressione del vento è uniforme su ogni tronco. In questo modo il calcolo delle forze è più oneroso, ma i valori che si ottengono sono più aderenti alla realtà e non maggiori di quelli che si ottengono applicando la procedura di cui al punto precedente. Figura C3.3.4 – Quote di riferimento negli edifici bassi ed alti",
        20: null,
        21: null,
        22: null,
        23: null,
        24: null,
        25: "Particolare attenzione va posta nel caso di edifici particolarmente snelli, il cui rapporto h/d sia maggiore di 5, per i quali potrà farsi utile riferimento a studi specifici di settore.",
        26: null,
    },
    "circ2019:C3.3.8.1.1.2@57": {
        0: "La pressione sulle facce sottovento e sulle facce laterali degli edifici può essere considerata, con buona approssimazione, costante con la quota. Di ciò si tiene conto assumendo che l’altezza di riferimento sia costante e pari alla quota di sommità dell’edificio (z̄e = h).",
        1: null,
        2: null,
        3: null,
    },
    "circ2019:C3.3.8.1.2@57": {
        0: "Si considerano piane le coperture la cui inclinazione sull’orizzontale sia compresa tra −5° e +5°. L’altezza di riferimento z̄e per le coperture piane è pari alla quota massima della copertura stessa, inclusa la presenza dei parapetti e di altri analoghi elementi. I coefficienti globali cpe da assumere sulle coperture di un edificio a pianta rettangolare sono riportati in Figura C3.3.5 e in Tabella C3.3.III.",
        1: null,
        2: null,
        3: null,
        4: null,
    },
    "circ2019:C3.3.8.1.2@58": {
        0: "Figura C3.3.5 – Schema di riferimento per coperture piane",
        1: null,
        7: "Nella zona sottovento la pressione può assumere sia valori negativi sia valori positivi, per cui si devono considerare entrambi i casi.",
        8: null,
        9: "I coefficienti locali cpe,10 e di dettaglio cpe,1 da assumere sulle coperture di un edificio a pianta rettangolare sono riportati in Figura C3.3.6 e in Tabella C3.3.IV. In riferimento alla Figura C3.3.6 e alla Tabella C3.3.IV, il valore della dimensione e è pari al minimo fra b e 2h.",
        10: null,
        11: null,
        12: "Figura C3.3.6 – a) Suddivisione delle coperture piane in zone di uguale pressione; b) Altezza di riferimento per coperture piane con parapetti o raccordi (curvi e piani)",
        13: null,
        14: null,
        15: null,
    },
    "circ2019:C3.3.8.1.3@59": {
        0: "L’altezza di riferimento z̄e per le coperture inclinate a semplice falda è pari alla quota massima della copertura stessa. Per le inclinazioni −5° ≤ α ≤ +5° occorre fare riferimento al caso di copertura piana (§ C3.3.8.1.2). I coefficienti globali da assumere sulle coperture a singola falda di un edificio a pianta rettangolare, nel caso di vento ortogonale alla direzione del colmo sono riportati in Figura C3.3.8 e in Tabella C3.3.V. Nella zona 5° ≤ α ≤ 45° la pressione può variare rapidamente da valori negativi a valori positivi, per cui vengono forniti valori dei coefficienti di pressione con entrambi i segni; in generale, si considerano ambedue le condizioni di carico, valutando quale può condurre a situazioni più gravose per la struttura o l’elemento strutturale considerato.",
        1: null,
        2: null,
        3: null,
        4: null,
        5: null,
        6: "Figura C3.3.7 – Schema di riferimento per coperture a semplice falda",
        7: "Figura C3.3.8 – Coperture a semplice falda: valori del coefficiente cpe; vento perpendicolare alla direzione del colmo",
        9: "I coefficienti globali da assumere sulle coperture a singola falda di un edificio a pianta rettangolare, nel caso di vento parallelo alla direzione del colmo sono riportati in Figura C3.3.9 e in Tabella C3.3.VI.",
        10: null,
    },
    "circ2019:C3.3.8.1.3@60": {
        0: "Figura C3.3.9 – Coefficienti di pressione per coperture a semplice falda: vento parallelo alla direzione del colmo",
        10: "I coefficienti locali cpe,10 e di dettaglio cpe,1 da assumere sulle coperture a singola falda di un edificio a pianta rettangolare sono riportati in Figura C3.3.10 e in Tabella C3.3.VII e C3.3.VIII; il valore di e è pari al minimo fra b e 2h.",
        11: "Figura C3.3.10 – Suddivisione delle coperture a semplice falda in zone di uguale pressione",
        12: null,
        13: null,
    },
    "circ2019:C3.3.8.1.4@61": {
        0: "L’altezza di riferimento z̄e per le coperture inclinate a doppia falda (Figura C3.3.11) è pari alla quota massima della copertura stessa. Per le inclinazioni −5° ≤ α ≤ +5° occorre fare riferimento al caso di copertura piana.",
        1: null,
        2: null,
        3: "I coefficienti globali da assumere sulla falda sopravento di coperture a falda doppia di un edificio a pianta rettangolare, nel caso di vento perpendicolare alla direzione del colmo, sono quelli per le coperture a falda singola. Nella zona 0° ≤ α ≤ 45° vale quanto previsto per le coperture a falda singola circa la variazione di segno della pressione.",
        4: null,
        5: null,
        6: "Per la falda sottovento, si fa riferimento ai valori riportati in Tabella C3.3.IX e Figura C3.3.12. Figura C3.3.11 – Schema di riferimento per coperture a falda doppia",
        7: "Figura C3.3.12 – Coefficienti di pressione per coperture a doppia falda: falda sottovento con vento in direzione perpendicolare al colmo",
    },
    "circ2019:C3.3.8.1.4@62": {
        1: "Nel caso di vento parallelo alla direzione del colmo, i coefficienti di pressione sono riportati nella Tabella C3.3.X e Figura C3.3.13. Figura C3.3.13 – Coefficienti di pressione per coperture a doppia falda: vento in direzione parallela al colmo",
        3: "I coefficienti locali cpe,10 e di dettaglio cpe,1 da assumere sulle coperture a doppia falda di un edificio a pianta rettangolare sono riportati in Figura C3.3.14 e in Tabella C3.3.XI e C3.3.XII; il valore di e è pari al minimo fra b e 2h.",
        4: null,
    },
    "circ2019:C3.3.8.1.4@63": {
        0: "Figura C3.3.14 – Suddivisione delle coperture a falda doppia in zone di uguale pressione",
    },
    "circ2019:C3.3.8.1.5@64": {
        0: "L’altezza di riferimento z̄e per le coperture a padiglione (Figura C3.3.15) è pari all’altezza massima della copertura stessa.",
        1: null,
        2: "Per i coefficienti globali sulle coperture a padiglione di un edificio a pianta rettangolare, per le falde sopravento e sottovento, si assumano gli stessi coefficienti previsti per le coperture a falda doppia.",
        3: "Figura C3.3.15 – Schema delle coperture a padiglione",
        4: "Per le falde laterali, relative alle pareti parallele alla direzione del vento, si considerano i coefficienti riportati in Figura C3.3.16 e Tabella C3.3.XIII.",
        5: "Figura C3.3.16 – Coefficienti di pressione per coperture a padiglione: falde laterali",
        7: "I coefficienti locali cpe,10 e di dettaglio cpe,1 da assumere sulle coperture a padiglione di un edificio a pianta rettangolare sono riportati in Figura C3.3.17 e in Tabella C3.3.XIV; il valore di e è pari al minimo fra b e 2h.",
        8: null,
    },
    "circ2019:C3.3.8.1.5@65": {
        0: "Figura C3.3.17 – Suddivisione delle coperture a padiglione in zone di uguale pressione",
        1: "Per la direzione del vento Θ = 0°, nel caso di inclinazioni di falda 5° ≤ α ≤ 45°, ove è presente un doppio valore del coefficiente di pressione, vanno considerati due casi diversi: nel primo si adottano tutti i valori positivi dei coefficienti di pressione, nel secondo tutti i valori negativi; non occorre prendere in considerazione combinazioni di carico in cui i coefficienti di pressione assumano valori sia positivi sia negativi. È possibile utilizzare un’interpolazione lineare per valori intermedi dell’angolo α, purché questa sia fatta fra valori corrispondenti di segno non opposto. I valori dei coefficienti di pressione sono sempre da valutare in funzione dell’inclinazione della falda sopravento.",
        2: null,
        3: null,
        4: null,
        5: null,
        6: null,
    },
    "circ2019:C3.3.8.1.6@65": {
        0: "L’altezza di riferimento z̄e per le coperture a falde multiple, ossia le coperture composte da successioni contigue di coperture a semplice o a doppia falda, è pari all’altezza massima h della copertura stessa. In generale, i coefficienti di pressione per le coperture a falde multiple sono gli stessi forniti nei precedenti paragrafi per le coperture corrispondenti a semplice e a doppia falda.",
        1: null,
        2: null,
    },
    "circ2019:C3.3.8.1.6@66": {
        0: null,
        1: "Figura C3.3.18 – Suddivisione delle coperture a falda multipla",
        2: "Limitatamente al caso di vento perpendicolare alla direzione del colmo, e per i soli tipi costruttivi illustrati in Figura C3.3.18, i coefficienti di pressione sopra definiti possono essere moltiplicati per i fattori riduttivi indicati nella stessa figura. In particolare:",
        3: "- nel caso riportato nella Figura C3.3.18 (a), si applicano ad ogni tratto della copertura i coefficienti di pressione definiti nel paragrafo coperture a falda singola, con inclinazione negativa. Tali coefficienti sono moltiplicati per il fattore riduttivo 0,8 nel secondo tratto, e per il fattore riduttivo 0,6 nei tratti successivi;",
        4: null,
        5: null,
        6: "- nel caso riportato nella Figura C3.3.18 (b), si applicano ad ogni tratto della copertura i coefficienti di pressione definiti nel paragrafo coperture a falda singola, con inclinazione positiva. Nel caso in cui tali coefficienti siano positivi (cpe > 0), nel secondo tratto e in quelli successivi si assume cpe = −0,4. Nel caso in cui tali coefficienti siano negativi (cpe < 0), essi sono moltiplicati per il fattore riduttivo 0,8 nel secondo tratto, e per il fattore riduttivo 0,6 nei tratti successivi;",
        7: null,
        8: null,
        9: null,
        10: null,
        11: null,
        12: "- nel caso riportato in Figura C3.3.18 (c), si applicano al primo tratto della copertura (prima falda sopravento) i coefficienti di pressione definiti nel paragrafo coperture a falda singola con inclinazione positiva. Ai tratti successivi della copertura si applicano i coefficienti di pressione riportati nel paragrafo coperture a falda doppia con inclinazione negativa; tali coefficienti sono moltiplicati per il fattore riduttivo 0,6 a partire dal terzo tratto della copertura;",
        13: null,
        14: null,
        15: null,
        16: "- nel caso riportato in Figura C3.3.18 (d), si applicano ad ogni tratto della copertura i coefficienti di pressione riportati nel paragrafo coperture a falda doppia con inclinazione negativa. Tali coefficienti sono moltiplicati per il fattore riduttivo 0,8 nel secondo tratto, e per il fattore riduttivo 0,6 nei tratti successivi.",
        17: null,
        18: null,
    },
    "circ2019:C3.3.8.1.7@66": {
        0: "La quota di riferimento per le coperture a volta cilindrica è pari a z̄e = h + f/2 (in riferimento alla Figura C3.3.19 (a) e (b)).",
        1: null,
        2: "Nel caso di vento perpendicolare alle generatrici della copertura, la copertura è suddivisa in quattro zone distinte di uguale sviluppo:",
        3: "- nella prima zona (A, sopravento) si adottano i coefficienti di pressione cpe,A;",
        4: "- nelle due zone intermedie (B) si adottano i coefficienti di pressione cpe,B;",
        5: null,
    },
    "circ2019:C3.3.8.1.7@67": {
        0: "- nell’ultima zona (C, sottovento) si adottano i coefficienti di pressione cpe,C.",
        1: null,
        2: "I valori dei coefficienti di pressione cpe,A, cpe,B e cpe,C sono forniti nella Figura C3.3.19 (c), in funzione dei rapporti h/d e f/d.",
        3: null,
        4: "In particolare, per quanto riguarda il coefficiente cpe,A:",
        5: "- nel caso in cui h/d ≥ 0,5, si considerano entrambi i valori riportati nel grafico;",
        6: "- per valori intermedi tra h/d = 0 e h/d = 0,5, si possono interpolare linearmente i valori riportati.",
        7: "Per valori di f/d ≤ 0,05 si possono adottare i coefficienti di pressione delle coperture piane.",
        8: "Nel caso di vento parallelo alle generatrici della copertura, in prima approssimazione, è lecito applicare i coefficienti di pressione relativi alle coperture piane.",
        9: null,
        10: "Figura C3.3.19 – a) e b) Schema di riferimento per coperture a volta cilindrica; c) coefficienti di pressione per coperture a volta cilindrica",
        11: null,
        12: null,
        13: null,
        14: null,
    },
    "circ2019:C3.3.8.2@67": {
        0: "Il presente paragrafo fornisce i criteri per valutare le azioni globali del vento sulle coperture in cui lo spazio sottostante non sia delimitato in maniera permanente da pareti.",
        1: null,
        2: "Si definisce grado di bloccaggio φ, il rapporto tra l’area esposta al vento di un’eventuale ostruzione presente al di sotto della tettoia e l’area totale della superficie ortogonale alla direzione del vento al di sotto della tettoia (Figura C3.3.20). Si identificano due situazioni limite:",
        3: null,
        4: "- φ = 0 corrisponde all’assenza di ostruzioni al di sotto della tettoia (tettoia libera);",
        5: "- φ = 1 corrisponde alla situazione in cui lo spazio al di sotto della tettoia risulti completamente ostruito.",
    },
    "circ2019:C3.3.8.2@68": {
        0: "La condizione φ = 1 è sostanzialmente diversa da quella prevista per gli edifici in quanto l’eventuale ostruzione può essere offerta anche da elementi che non delimitano completamente e permanentemente lo spazio al di sotto della tettoia.",
        1: null,
        2: "A valle della massima ostruzione si adotta φ = 0.",
        3: "Le azioni aerodinamiche esercitate dal vento sulle tettoie dipendono fortemente dal grado di bloccaggio in quanto la presenza di un’ostruzione, anche soltanto sul lato sottovento, impedisce il passaggio dell’aria al di sotto della tettoia.",
        4: "Figura C3.3.20 – Differenze nel flusso dell’aria per tettoie con φ = 0 e φ = 1",
        5: "Il presente paragrafo schematizza l’azione del vento sulle tettoie attraverso le forze F risultanti dal campo di pressioni sulla superficie della falda della tettoia, dirette ortogonalmente ad essa. Tali forze sono quantificate dal prodotto dei coefficienti di forza, cF, per la superficie della falda in esame e sono applicate nei punti indicati nel seguito per le varie tipologie di tettoia.",
        6: null,
        7: null,
        8: null,
        9: "Per la valutazione più dettagliata del campo di pressione agente sulle tettoie, al fine di valutare azioni locali su elementi o su porzioni delle tettoie costituite da un singolo strato di copertura, si potrà fare riferimento a documenti di comprovata validità. La valutazione delle pressioni locali sulla faccia superiore e sulla faccia inferiore delle tettoie costituite da un doppio strato di copertura richiede valutazioni specifiche e, se necessario, lo svolgimento di prove in galleria del vento.",
        10: null,
        11: null,
        12: null,
    },
    "circ2019:C3.3.8.2.1@68": {
        0: "La Tabella C3.3.XV e la relativa Figura C3.3.21 riportano i valori dei coefficienti di forza per le tettoie a semplice falda con vento agente perpendicolarmente alla linea di colmo. I valori dei coefficienti di forza sono espressi in funzione del grado di bloccaggio φ e dell’inclinazione α della falda. Per valori intermedi di φ è ammessa un’interpolazione lineare tra i valori relativi ai casi φ = 0 e φ = 1. La quota di riferimento z̄e è pari all’altezza massima h della tettoia. L’area di riferimento L², ossia l’area su cui è applicata la forza risultante, è pari all’area della tettoia.",
        1: null,
        2: null,
        3: null,
        4: null,
        5: "Figura C3.3.21 – Coefficienti di pressione complessiva per tettoie a semplice falda",
        7: "Per il calcolo della tettoia si considerano le condizioni di carico più gravose tra le quattro indicate nella Figura C3.3.22, dove la forza risultante F = qp(z) L² cF.",
        8: null,
    },
    "circ2019:C3.3.8.2.1@69": {
        0: "Figura C3.3.22 – Tettoie a semplice falda: posizione del punto di applicazione della forza risultante in funzione della direzione di provenienza del vento e della direzione della forza",
        1: "Le tettoie a semplice falda con vento agente parallelamente alla linea di colmo possono essere analizzate, in prima approssimazione, come tettoie piane a semplice falda (α = 0°).",
        2: null,
    },
    "circ2019:C3.3.8.2.2@69": {
        0: "La Tabella C3.3.XVI e la relativa Figura C3.3.23 riportano i valori dei coefficienti di forza per le tettoie a doppia falda (di uguale pendenza) con vento agente perpendicolarmente alla linea di colmo. I valori dei coefficienti di forza sono espressi in funzione del grado di bloccaggio φ e dell’inclinazione α delle falde. Per valori intermedi di φ è ammessa un’interpolazione lineare tra i valori relativi ai casi φ = 0 e φ = 1. La quota di riferimento z̄e è pari all’altezza massima h della tettoia. L’area di riferimento L², ossia l’area su cui è applicata la forza risultante, è pari all’area di ciascuna falda della tettoia.",
        1: null,
        2: null,
        3: null,
        4: null,
        5: "Figura C3.3.23 – Coefficienti di pressione complessiva per tettoie a falda doppia",
        7: "Per il calcolo della tettoia si considerano le condizioni di carico più gravose tra quelle indicate nella Figura C3.3.24, dove la forza risultante F = qp(z) L² cF è considerata agente simultaneamente su entrambe le falde oppure soltanto su una di esse. Ciascuna falda delle tettoie a doppia falda con vento agente parallelamente alla linea di colmo può essere analizzata, in prima approssimazione, come una tettoia piana a semplice falda (α = 0°).",
        8: null,
        9: null,
        10: null,
    },
    "circ2019:C3.3.8.2.2@70": {
        0: "Figura C3.3.24 – Tettoie a doppia falda: posizione del punto di applicazione delle forze risultanti in funzione della direzione della forza; a) schema per α > 0°; b) schema per α < 0°",
        1: null,
        2: null,
        3: null,
    },
    "circ2019:C3.3.8.2.3@70": {
        0: "Ciascuna coppia di falde delle tettoie composte da più coppie di falde affiancate (di uguale pendenza) può essere analizzata, in prima approssimazione, come una singola tettoia a doppia falda. Limitatamente al caso di vento perpendicolare alla direzione dei colmi, e per il solo tipo costruttivo illustrato in Figura C3.3.25, i coefficienti di forza sopra definiti possono essere moltiplicati per i fattori riduttivi riportati in Tabella C3.3.XVII, secondo lo schema indicato nella stessa Figura C3.3.25.",
        1: null,
        2: null,
        3: "Figura C3.3.25 – Tettoie a falda multipla: individuazione dei vari elementi",
    },
    "circ2019:C1.1@36": {
        2: "confronto diretto tra le varie tipologie di elementi costruttivi rilevabili su una costruzione esistente e le prescrizioni tecnico-costruttive che la Norma impone alle nuove costruzioni e che consentono, per queste, un immediato giudizio di accettabilità.",
        3: null,
        28: "Infatti, al § 8.3 “Valutazione della sicurezza” si legge: “Nelle verifiche rispetto alle azioni sismiche il livello di sicurezza della costruzione è quantificato attraverso il rapporto ζE tra l’azione sismica massima sopportabile dalla struttura e l’azione sismica massima che si utilizzerebbe nel progetto di una nuova costruzione; l’entità delle altre azioni contemporaneamente presenti è la stessa assunta per le nuove costruzioni, salvo quanto emerso sui carichi verticali permanenti a seguito delle indagini condotte (di cui al § 8.5.5) e salvo l’eventuale adozione di appositi provvedimenti restrittivi sull’uso e, conseguentemente, sui carichi verticali variabili.",
        29: null,
        30: null,
        31: null,
        32: null,
        33: "La restrizione sull’uso può mutare da porzione a porzione della costruzione e, per l’i-esima porzione, è quantificata attraverso il rapporto ζV,i tra il valore massimo del sovraccarico variabile verticale sopportabile da quella parte della costruzione e il valore del sovraccarico verticale variabile che si utilizzerebbe nel progetto di una nuova costruzione.”",
        34: null,
        35: null,
    },
    "circ2019:C1.2@36": {
        1: "- Premessa",
    },
    "circ2019:C1.2@37": {
        25: "- delle opere di fondazione;",
        26: "- delle opere di sostegno;",
        27: "- delle opere in sotterraneo;",
        28: "- delle opere e manufatti di materiali sciolti naturali;",
        29: "- dei fronti di scavo;",
        30: "- del miglioramento e rinforzo dei terreni e degli ammassi rocciosi;",
        31: "- del consolidamento dei terreni interessanti opere esistenti, nonché la valutazione della sicurezza dei pendii e",
        49: "- riparazioni o interventi locali, che interessino elementi isolati e che comunque comportino un miglioramento delle",
        51: "- interventi di miglioramento, atti ad aumentare la sicurezza strutturale esistente pur senza necessariamente rag-",
    },
    "circ2019:C1.2@38": {
        0: "- interventi di adeguamento, atti a conseguire i livelli di sicurezza previsti dalle NTC;",
    },
    "circ2019:C2.4.1@41": {
        0: "Al punto 2.4.1 delle norme, anche ai fini delle verifiche sismiche, è definita la “vita nominale di progetto” di un’opera, VN, che è convenzionalmente definita come il numero di anni nel quale l’opera, purché ispezionata e manutenuta come previsto in progetto, manterrà i livelli prestazionali e svolgerà le funzioni per i quali è stata progettata.",
        1: null,
        2: null,
        3: null,
        4: "Le opere sono classificate in tre differenti categorie, per ciascuna delle quali viene fissato il valore minimo di VN: 10 anni per le strutture temporanee e provvisorie e quelle in fase di costruzione, 50 anni per le opere con livelli di prestazione ordinari, 100 anni per le opere con livelli di prestazione elevati.",
        5: null,
        6: null,
        7: null,
        8: "VN è dunque il parametro convenzionale correlato alla durata dell’opera alla quale viene fatto riferimento in sede progettuale per le verifiche dei fenomeni dipendenti dal tempo (ad esempio: fatica, durabilità, ecc.), rispettivamente attraverso la scelta ed il dimensionamento dei particolari costruttivi, dei materiali e delle eventuali applicazioni di misure protettive per garantire il mantenimento dei livelli di affidabilità, funzionalità e durabilità richiesti.",
        9: null,
        10: null,
        11: null,
        12: "Il periodo di ritorno dei sovraccarichi e delle azioni climatiche agenti sulla costruzione non è correlato alla vita nominale di progetto dell’opera, essendo i livelli di affidabilità regolati dalla combinazione dei coefficienti parziali γF, calibrati per essere utilizzati congiuntamente ai valori caratteristici delle azioni stesse. Questi ultimi sono definiti indipendentemente dalla vita nominale attesa per la costruzione con un preassegnato periodo di ritorno (a titolo esemplificativo: 50 anni per le azioni ambientali, 1000 anni per le azioni da traffico, vedasi § 2.5.2).",
        13: null,
        14: null,
        15: null,
        16: null,
        17: null,
    },
    "circ2019:C2.4.1@42": {
        2: "Il livello di prestazione rispetto alla durabilità da fornire alla costruzione dovrà perciò scaturire da una valutazione tecnico-economica che il Committente stabilirà a seguito di un’opportuna interazione con il progettista, ed è disgiunta dalle indicazioni che la norma fornisce per individuare la classe d’uso da attribuire.",
        3: null,
        4: null,
        17: "Pertanto, nelle previsioni progettuali, se le condizioni ambientali e d’uso si mantengono, nel corso di VN, nei limiti previsti, sarà possibile utilizzare l’opera senza interventi significativi di riparazione o di manutenzione straordinaria. Peraltro, una volta effettuati detti interventi, la vita nominale di progetto originaria sarà sostanzialmente ripristinata, cosicché risulta possibile che grazie a interventi successivi, la vita effettiva della costruzione possa essere molto maggiore della vita nominale di progetto. La vita nominale di progetto viene così a perdere ogni connotazione di carattere “biologico”, perché essa sostanzialmente si rinnova a seguito degli interventi di riparazione o di manutenzione straordinaria. Figura C2.1 - Evoluzione dell’affidabilità strutturale e del periodo di vita nominale in funzione delle strategie d’intervento",
        18: null,
        19: null,
        20: null,
        21: null,
        22: null,
        23: null,
        24: null,
        25: "Va anche segnalato, come sintetizzato nella Figura C2.1, che non è necessario concentrare gli interventi al termine di VN, perché sono possibili anche strategie d’intervento alternative, che prevedono interventi più contenuti e più ravvicinati nel tempo.",
        26: null,
        27: null,
        28: "Va ancora rilevato che costruzioni o parti di esse che possono essere smantellate e riutilizzate non sono da considerarsi temporanee e vanno classificate, ai fini della determinazione della vita nominale, come opere con livelli di prestazione ordinari (VN ≥ 50 anni) o elevati (VN ≥ 100 anni).",
        29: null,
        30: null,
        31: null,
    },
    "circ2019:C2.4.3@43": {
        0: "Il periodo di riferimento VR di una costruzione, valutato moltiplicando la vita nominale VN (espressa in anni) per il coefficiente d’uso della costruzione CU (VR = VN · CU), riveste notevole importanza, in quanto, assumendo che la legge di ricorrenza dell’azione sismica sia un processo poissoniano, è utilizzato per valutare, fissata la probabilità di superamento PVR corrispondente allo stato limite considerato (Tabella 3.2.I della NTC), il periodo di ritorno TR dell’azione sismica cui fare riferimento per la verifica.",
        1: null,
        2: null,
        3: null,
        4: null,
        5: null,
        6: "In particolare la tabella mostra i valori di VR corrispondenti ai valori di VN che individuano le frontiere tra i tre tipi di costruzione considerati (tipo 1, tipo 2, tipo 3); valori di VN intermedi tra detti valori di frontiera (e dunque valori di VR intermedi tra quelli mostrati in tabella) sono consentiti ed i corrispondenti valori dei parametri necessari a definire l’azione sismica sono ricavati utilizzando le formule d’interpolazione fornite nell’Allegato A alle NTC.",
        7: null,
        8: null,
        9: null,
        10: null,
        11: null,
        21: "Per le costruzioni a servizio di attività a rischio di incidente rilevante si adotteranno valori di CU anche superiori a 2, in relazione alle conseguenze sull’ambiente e sulla pubblica incolumità determinate dal raggiungimento degli stati limite.",
        22: null,
        23: null,
        28: "- CU > 2 per attività a rischio di incidente rilevante per i quali risultano essere presenti scenari incidentali con impatto all’esterno dell’attività stessa (sezione L dell’allegato 5 al D. Lgs 105/2015) con categorie di effetti di inizio letalità ed elevata letalità. I valori di soglia da prendere in considerazione per tali categorie di effetti sono quelli indicati nella tabella 2 del punto 6.2 del decreto del Ministro dei Lavori Pubblici 9 maggio 2001. In attesa di più specifiche successive indicazioni normative è possibile assumere cautelativamente CU = 2,5.",
        29: null,
        30: null,
        31: null,
        32: null,
        33: "- CU = 2 per tutti gli altri casi;",
    },
    "circ2019:C2.5@44": {
        2: "In relazione al valore caratteristico delle azioni permanenti Gk è specificato che questo possa essere assunto pari al valore medio della distribuzione qualora il coefficiente di variazione dell’azione sia inferiore a 0,10, che è un limite entro cui rientrano la maggior parte delle azioni permanenti.",
        3: null,
        4: null,
        5: null,
        7: "precisato che nelle combinazioni si dovranno trascurare le azioni di natura variabile Qkj che danno un contributo favorevole ai fini delle verifiche e, se del caso, i carichi permanenti non strutturali G2. Questi ultimi potranno quindi essere trascurati, ad esempio, nel caso di situazioni transitorie, in cui la costruzione subisca alterazioni e modifiche che prevedano la possibilità di assenza dei carichi G2 favorevoli alle verifiche. Questa indicazione non contrasta, quindi, con il contenuto della tabella 2.6.I, nonché delle conseguenti tabelle 6.2.I e 6.2.III, in cui vengono forniti i valori dei coefficienti parziali per le azioni o per l’effetto delle azioni nelle verifiche SLU, in cui, per i carichi G2, qualora questi diano un contributo favorevole ai fini delle verifiche, viene indicato il valore minimo pari a 0,8.",
        8: null,
        9: null,
        10: null,
        11: null,
        12: null,
        13: null,
        14: null,
        15: null,
        16: null,
        20: "La selezione del coefficiente parziale γF sulla base della classificazione del tipo di carichi in “favorevoli” o “sfavorevoli” va effettuata in relazione agli effetti globali indotti dai carichi stessi e risultanti sulla costruzione, tenendo sempre conto della loro natura fisica e della loro correlazione. Differenti assunzioni possono essere adottate nel caso di singole verifiche locali.",
        21: null,
        22: null,
    },
    "circ2019:C4.1.1.1@85": {
        2: "Cautelativamente, le NTC proibiscono la ridistribuzione dei momenti nei pilastri e nei nodi, consentendola nelle travi continue (sia appartenenti che non appartenenti a telai), nelle solette e nei telai, alle condizioni seguenti:",
        3: "- gli effetti del 2° ordine siano trascurabili;",
        4: "- le sollecitazioni di flessione siano prevalenti;",
        5: "- i rapporti tra le luci di campate contigue siano compresi nell’intervallo 0,5-2,0.",
        12: "La ridistribuzione dei momenti flettenti può effettuarsi, senza esplicite verifiche in merito alla duttilità delle membrature, purché il rapporto δ tra il momento dopo la ridistribuzione M̄i,j = Mi,j ± ΔMi,j e il momento prima della ridistribuzione Mi,j soddisfi quanto riportato all’interno del testo normativo.",
        13: null,
        14: null,
        15: null,
        16: null,
        17: "Il limite δ ≥ 0,70 ha lo scopo di evitare che un eccesso di ridistribuzione possa indurre plasticizzazione allo Stato Limite di Esercizio nelle sezioni in cui si riduce il momento resistente.",
        18: null,
    },
    "circ2019:C4.1.1.1@86": {
        0: "Ai fini della ridistribuzione dei momenti negli elementi, in ciascun nodo, l’aliquota dei momenti da ridistribuire, ΔM, non può eccedere il 30% del minore tra i due momenti d’estremità concorrenti al nodo, nel caso di momenti di verso opposto. Nel caso di momenti equiversi, il rapporto δ va riferito al momento che viene ridotto in valore assoluto.",
        1: null,
        2: null,
        5: "Ciò consente di:",
        6: "- progettare travi aventi resistenza massima a flessione minore di quella richiesta dall’analisi elastica, grazie ad una più uniforme distribuzione delle resistenze lungo il loro sviluppo;",
        7: "- utilizzare meglio la resistenza minima a flessione delle sezioni, dovuta al rispetto delle limitazioni costruttive imposte dalle NTC, quando essa ecceda significativamente le sollecitazioni agenti derivanti dall’analisi elastica.",
        8: null,
        12: "dove M̄Ed è il valore di progetto del momento dopo la ridistribuzione e M̄Rd è il momento resistente di progetto.",
        13: null,
    },
    "circ2019:C4.1.1.1.1@86": {
        0: "Nel caso di una trave continua (Figura C4.1.1), i momenti M1 e M2 delle sezioni più sollecitate (in corrispondenza degli appoggi) possono venire ridotti ai valori M1’ e M2’, nel rispetto dei limiti M1’ ≥ δM1 e M2’ ≥ δM2. Il diagramma del momento flettente sortito dall’analisi elastica lineare della trave continua in esame, rappresentato dalla curva a tratto continuo, va di conseguenza traslato, nel rispetto dell’equilibrio con il carico p applicato, come indicato dalla curva a tratteggio.",
        1: null,
        2: null,
        3: null,
        4: null,
        5: null,
        6: null,
        7: "Figura C4.1.1 - Ridistribuzione dei momenti per travi continue",
    },
    "circ2019:C4.1.1.1.2@87": {
        1: "Il soddisfacimento dell’equilibrio impone che, nel caso in cui i momenti d’estremità delle travi abbiano verso discorde, essi siano entrambi ridotti di ΔM (Figura C4.1.4) e che, in caso contrario, il momento d’estremità della trave di sinistra sia ridotto di ΔM e quello della trave destra sia aumentato della stessa quantità ΔM (Figura C4.1.5).",
        2: null,
        3: null,
    },
    "circ2019:C4.1.2.1.2.1@88": {
        5: "Per il diagramma tensione-deformazione del calcestruzzo confinato, la norma consente l’utilizzo di modelli analitici di comprovata validità, rappresentativi del reale comportamento del materiale in stato di tensione triassiale. In assenza di specifiche valutazioni, le NTC, in linea con l’UNI EN 1998-2, forniscono un diagramma tensione-deformazione per il calcestruzzo confinato del tipo parabola-rettangolo. Tale legame descrive il comportamento del calcestruzzo confinato in condizioni di assialsimmetria, esprimendo la pressione laterale di confinamento attraverso l’unico parametro σ2. Per la sezione circolare tale parametro può essere ricavato in base a considerazioni di equilibrio su una porzione compresa in un passo staffe, come in Figura C4.1.7a.",
        6: null,
        7: null,
        8: null,
        9: null,
        10: null,
        11: null,
        14: null,
        15: null,
        17: "Nel caso di sezione rettangolare, σl = √(σlx · σly) (Eq. 4.1.12c) rappresenta la pressione laterale equivalente, ovvero il valore della pressione di confinamento che, in condizioni assialsimmetriche, produrrebbe gli stessi effetti medi in termini di incremento di resistenza del calcestruzzo confinato.",
        18: null,
        19: null,
        20: null,
        21: null,
        22: null,
        23: null,
        24: null,
        25: null,
        26: null,
        27: null,
    },
    "circ2019:C4.1.2.1.2.1@89": {
        0: "La pressione efficace di confinamento σ2 si ottiene a partire dalla pressione laterale di confinamento, per mezzo di un coefficiente riduttivo espresso dal rapporto tra il volume di calcestruzzo effettivamente confinato e il volume di calcestruzzo racchiuso dalle staffe, come indicato in Figura C4.1.8.",
        1: null,
        2: null,
        11: "Nella Figura C4.1.9, il pedice “0” dopo la virgola indica il calcestruzzo non confinato, mentre il pedice “c” indica il calcestruzzo confinato.",
        12: null,
        13: null,
        14: null,
        15: null,
        16: null,
        17: null,
        18: null,
        19: null,
        20: null,
        21: null,
        22: null,
        23: null,
        24: null,
        25: null,
        26: null,
        27: null,
        28: null,
        29: null,
        30: null,
        31: null,
        32: null,
        33: null,
        34: null,
        35: null,
        36: null,
        37: null,
        38: null,
        39: null,
        40: null,
        41: null,
        42: null,
        46: "Quando il calcestruzzo è confinato, oltre che da armature trasversali, anche attraverso interventi esterni alla sezione, per descriverne il comportamento possono essere utilizzati modelli di comprovata validità presenti nella letteratura scientifica, in linee guida o normative internazionali, utilizzando resistenze dei materiali coerenti con le NTC. Sia nelle verifiche di resistenza sia in quelle di duttilità, il legame tensione-deformazione per il calcestruzzo confinato deve essere utilizzato solo per le zone",
        47: null,
        48: null,
        49: null,
        50: null,
        51: null,
        52: null,
        53: null,
        54: null,
        55: null,
        56: null,
        57: null,
        58: null,
        59: null,
        60: null,
        61: null,
        62: null,
        63: null,
        64: null,
        65: null,
        66: null,
    },
    "circ2019:C4.1.2.2.2@90": {
        8: "Nella [C4.1.3] si assume β = Mf/M (rapporto tra il momento di fessurazione Mf e il momento flettente effettivo) o β = Nf/N (rapporto tra la forza normale di fessurazione Nf e la forza normale effettiva), a seconda che la membratura sia soggetta a flessione o a trazione; il coefficiente c assume il valore 1 per un singolo carico di breve durata e 0,50 per carichi permanenti o cicli di carico ripetuti.",
        9: null,
        10: null,
        11: null,
        12: null,
        13: null,
        26: "dove fck e fyk sono espressi in MPa; ρ e ρ’ sono i rapporti tra armatura tesa e compressa, rispettivamente; As,eff e As,calc sono l’armatura tesa effettivamente presente nella sezione più sollecitata e l’armatura di progetto nella stessa sezione; K è un coefficiente correttivo dipendente dallo schema strutturale.",
        27: null,
        28: null,
        35: "I valori di K per calcestruzzo molto sollecitato (ρ = 1,5%) o poco sollecitato (ρ = 0,5%) sono riportati nella Tabella C4.1.I, insieme ai valori limite di l/h calcolati assumendo fck = 30 MPa e [500 As,eff/(fyk As,calc)] = 1.",
        36: null,
        37: null,
        38: null,
        39: null,
        40: null,
    },
    "circ2019:C4.1.2.2.2@91": {
        0: null,
        1: null,
        2: null,
        3: null,
        4: null,
        5: null,
        6: null,
        7: null,
        8: null,
        9: null,
        10: null,
    },
    "circ2019:C4.1.2.2.4.5@91": {
        5: "εsm è la deformazione unitaria media delle barre d’armatura;",
        6: "Δsm è la distanza media tra le fessure.",
        18: "\u03c3s \u00e8 la tensione nell'armatura tesa, calcolata considerando la sezione fessurata;",
        19: "\u03b1e \u00e8 il rapporto Es/Ecm;",
        20: "\u03c1eff = As/Ac,eff, dove Ac,eff \u00e8 l'area efficace di calcestruzzo teso attorno all'armatura, di altezza hc,eff = min[2,5(h-d), (h-x)/3, h/2] (vedere Figura C4.1.10); in trazione, le due aree efficaci all'estradosso e all'intradosso sono considerate separatamente;",
        21: null,
        22: null,
        23: null,
        24: null,
    },
    "circ2019:C4.1.2.2.4.5@92": {
        13: "c \u00e8 il ricoprimento dell'armatura;",
        14: "k1 = 0,8 per barre ad aderenza migliorata e k1 = 1,6 per barre lisce;",
        15: null,
        16: "k2 = 0,5 nel caso di flessione e k2 = 1,0 nel caso di trazione semplice.",
        17: null,
        21: "\u03b51 ed \u03b52 sono, rispettivamente, la maggiore e la minore deformazione di trazione alle estremit\u00e0 della sezione, calcolate considerando la sezione fessurata.",
        22: null,
        23: "k3 = 3,4;",
        24: "k4 = 0,425.",
        29: "in cui:",
        30: "h ed x sono definiti nella Figura C4.1.10;",
        31: "(h - x) \u00e8 la distanza tra l'asse neutro e il lembo teso della membratura.",
        32: null,
        33: null,
        34: null,
        35: null,
    },
    "circ2019:C4.1.2.2.4.5@93": {
        0: "La verifica dell’ampiezza di fessurazione per via indiretta può riferirsi ai limiti di tensione nell’acciaio d’armatura definiti nelle Tabelle C4.1.II e C4.1.III. La tensione σs è quella nell’acciaio d’armatura prossimo al lembo teso della sezione, calcolata nella sezione parzializzata per la combinazione di carico pertinente (v. Tabella 4.1.IV delle NTC). Per le armature di pretensione aderenti, la tensione σs si riferisce all’escursione oltre la decompressione del calcestruzzo; per le sezioni precompresse a cavi post-tesi si fa riferimento all’armatura ordinaria aggiuntiva.",
        1: null,
        2: null,
        3: null,
        4: null,
    },
    "circ2019:C4.1.12.1.1.1@97": {
        4: "ρ è il valore limite superiore della massa per unità di volume del calcestruzzo, per la classe di massa per unità di volume di appartenenza, in kg/m³;",
        5: null,
        6: "flck è il valore della resistenza cilindrica caratteristica a compressione, in N/mm²;",
        7: "flcm è il valore della resistenza media cilindrica a compressione, in N/mm².",
    },
    "circ2019:C4.1.12.1.1.2@97": {
        8: "flcm è il valore della resistenza media cilindrica a compressione, in N/mm².",
        12: "ρ è il valore limite superiore della massa per unità di volume del calcestruzzo, per la classe di massa per unità di volume di appartenenza, in kg/m³.",
        13: null,
    },
    "circ2019:C4.1.12.1.3.1@97": {
        1: "Per il diagramma tensione-deformazione del calcestruzzo è possibile adottare il modello parabola-rettangolo (a) o triangolo-rettangolo (b), entrambi raffigurati nella Figura C4.1.13.",
        2: null,
    },
    "circ2019:C4.1.12.1.3.1@98": {
        1: "I limiti deformativi εc2, εc3 ed εcu possono essere assunti:",
    },
    "circ2019:C4.1.12.1.3.2.1@98": {
        12: "d è l’altezza utile della sezione, in mm;",
        13: "ρl = Asl/(bw d) è il rapporto geometrico di armatura longitudinale (≤ 0,02);",
        14: "σcp = NEd/Ac è la tensione media di compressione nella sezione (≤ 0,2 fcd);",
        15: "bw è la larghezza minima della sezione, in mm.",
        16: "Nel caso di elementi di calcestruzzo armato precompresso disposti in semplice appoggio, nelle zone non fessurate da momento flettente (con tensioni di trazione non superiori a flctd), la resistenza può valutarsi, in via semplificata, con la formula [4.1.24] delle NTC, sostituendo a fctd il corrispondente valore flctd per il calcestruzzo di aggregati leggeri.",
        17: null,
        18: null,
        25: "dove la resistenza caratteristica a trazione del calcestruzzo leggero flck è espressa in N/mm².",
    },
    "circ2019:C4.1.6.1.3@94": {
        46: "La classe di resistenza minima Cmin indicata in tabella deve comunque intendersi riferita alla pertinente classe di esposizione di cui alla UNI EN 206:2016 richiamata nella Tabella 4.1.III delle NTC.",
        47: null,
        48: null,
        49: null,
        50: null,
        51: null,
        52: null,
        53: null,
        54: null,
        55: null,
        56: null,
        57: null,
        58: null,
        59: null,
        60: null,
        61: null,
        62: null,
        63: null,
        64: null,
        65: null,
    },
    "circ2019:C4.1.2.3.6@94": {
        0: "Nella formula [4.1.35] si intende con f’cd la resistenza di progetto a compressione ridotta del calcestruzzo d’anima, valutata come ν fcd, assumendo ν = 0,5.",
        1: null,
    },
    "circ2019:C4.1.12.1.3.2.2@98": {
        0: "Si applicano le regole di calcolo di cui al § 4.1.2.3.5.2 delle NTC, sostituendo nella formula [4.1.28] ν fcd con il valore 0,40 flcd.",
    },
    "circ2019:C4.1.12.1.3.2.3@99": {
        0: "Si applicano le regole di calcolo di cui al § 4.1.2.3.6 delle NTC, sostituendo nella formula [4.1.35] f’cd con il valore f’lcd = 0,40 flcd.",
    },
    "circ2019:C4.1.12.1.4.1@99": {
        2: "Per barre raggruppate, il diametro equivalente del raggruppamento, assunto pari a Φn = Φ√n, non deve eccedere 45 mm.",
    },
    "circ2019:C4.1.12.1.4.2@99": {
        0: "Il diametro dei mandrini per la piegatura delle barre deve essere incrementato del 50% rispetto al valore ammesso per il calcestruzzo ordinario. In particolare, i valori minimi dei diametri dei mandrini da utilizzare in relazione al diametro delle barre sono:",
        1: null,
        2: null,
        3: "per φ ≤ 16 mm, D ≥ 6φ; per φ > 16 mm, D ≥ 11φ.",
    },
    "circ2019:C4.1.9.1.1@95": {
        1: "- il profilo delle pareti delimitanti le nervature di calcestruzzo da gettarsi in opera non deve presentare risvolti che ostacolino il deflusso del calcestruzzo e restringano la sezione delle nervature stesse sotto i limiti minimi stabiliti. Nel caso si richieda ai blocchi il concorso alla resistenza agli sforzi tangenziali si devono impiegare elementi monoblocco disposti in modo che, nelle file adiacenti comprendenti una nervatura di calcestruzzo, i giunti risultino sfalsati tra loro. Si devono adottare forme semplici, caratterizzate da setti rettilinei allineati, per lo più continui, particolarmente nella direzione orizzontale, con rapporto spessore/lunghezza il più possibile uniforme. Speciale cura deve essere rivolta al controllo dell’integrità dei blocchi, con particolare riferimento all’eventuale presenza di fessurazioni;",
        2: null,
        3: null,
        4: null,
        5: null,
        6: null,
        7: null,
        8: "- le pareti esterne, sia orizzontali che verticali, devono avere uno spessore minimo di 8 mm. Le pareti interne, sia orizzontali che verticali, devono avere uno spessore minimo di 7 mm. Tutte le intersezioni dovranno essere raccordate con raggio di curvatura, al netto delle tolleranze, maggiore di 3 mm. Il rapporto tra l’area complessiva dei fori e l’area lorda delimitata dal perimetro della sezione dei blocchi non deve risultare maggiore di 0,6 + 0,625·h (dove h è l’altezza del blocco in metri, h ≤ 0,32 m).",
        9: null,
        10: null,
        11: null,
        12: null,
    },
    "circ2019:C4.1.9.1.3@95": {
        0: "I blocchi di entrambe le categorie devono garantire una resistenza a punzonamento o punzonamento-flessione (quest’ultimo caso se sono del tipo interposto) per carico concentrato non minore di 1,50 kN. Il carico deve essere applicato su un’impronta quadrata di 50 mm di lato nel punto della superficie orizzontale superiore a cui corrisponde la minore resistenza del blocco.",
        1: null,
        2: null,
        3: "Per i blocchi collaboranti, la resistenza caratteristica a compressione, riferita alla sezione netta delle pareti e delle costolature, deve risultare non minore di 30 N/mm² nella direzione dei fori e di 15 N/mm² nella direzione trasversale ai fori, nel piano del solaio. La resistenza caratteristica a trazione per flessione, determinata su campioni ricavati dai blocchi mediante opportuno taglio di listelli di dimensioni minime 30 × 120 × spessore in mm, deve essere non minore di 10 N/mm².",
        4: null,
        5: null,
        6: null,
        7: "Per i blocchi non collaboranti, la resistenza caratteristica a compressione, riferita alla sezione netta delle pareti e delle costolature, deve risultare non minore di 15 N/mm² nella direzione dei fori e di 7 N/mm² nella direzione trasversale ai fori, nel piano del solaio. La resistenza caratteristica a trazione per flessione, determinata su campioni ricavati dai blocchi mediante opportuno taglio di listelli di dimensioni minime 30 × 120 × spessore in mm, deve essere non minore di 7 N/mm².",
        8: null,
    },
    "circ2019:C4.1.9.1.3@96": {
        0: null,
        1: null,
        2: "Il modulo elastico del laterizio non deve essere superiore a 25 kN/mm².",
        3: "Il coefficiente di dilatazione termica lineare del laterizio deve essere αt ≥ 6·10⁻⁶ °C⁻¹.",
        4: "Il valore della dilatazione per umidità, misurata secondo quanto stabilito dalla UNI 9730-3, deve essere < 0,4 mm/m.",
        5: "Nei solai in cui l’armatura è collocata entro scanalature, qualunque superficie metallica deve essere contornata in ogni direzione da un adeguato spessore di malta cementizia.",
        6: null,
        7: "Al fine di garantire un’efficace inserimento dell’armatura nelle scanalature, detta armatura non dovrà avere diametro superiore a 12 mm.",
        8: null,
    },
};

const forcedBreakAfterLines = new Set([
    "circ2019:C1.1@34:44",
    "circ2019:C1.2@37:9",
]);

const manualSubheadings = new Set([
    "Categorie di sottosuolo",
    "Condizioni topografiche",
    "Amplificazione stratigrafica",
    "Amplificazione topografica",
    "Calcolo dell'ampiezza delle fessure",
    "Calcolo dell\u2019ampiezza delle fessure",
    "Verifica della fessurazione senza calcolo diretto",
]);

const glyphReplacements: Array<[RegExp, string]> = [
    [/[\u0000-\u001f\u007f-\u009f]/g, ""],
    [/\u01ba/g, "-"],
    [/\u01c2/g, "\u2264"],
    [/\u01c3/g, "\u2265"],
    [/\u0385/g, "\u03b1"],
    [/\u0387/g, "\u03b3"],
    [/\u038b/g, "\u03b7"],
    [/\u0388/g, "\u03b4"],
    [/\u0389/g, "\u03b5"],
    [/\u0397/g, "\u03c3"],
    [/\u039d/g, "\u03c9"],
    [/\u0391/g, "\u03bd"],
    [/\u038c/g, "\u03b8"],
    [/\u038f/g, "\u03bb"],
    [/\u039a/g, "\u03c6"],
    [/\u0130/g, "\u03b5"],
    [/\u01ca/g, "\u0394"],
    [/\u012e/g, "\u03b1"],
    [/\u0225/g, "\u03c8"],
    [/\u0209/g, "\u00b7"],
    [/\u022d/g, "\u2013"],
    [/\u0098/g, "\u00b7"],
    [/\u0318/g, "\u03a6"],
];

const titleRepairs: Array<[RegExp, string]> = [
    [/\bPPREMESSA\b/gu, "PREMESSA"],
    [/\bEPERIODO\b/gu, "E PERIODO"],
    [/\bEINDUSTRIALI\b/gu, "E INDUSTRIALI"],
    [/\bERELATIVE\b/gu, "E RELATIVE"],
    [/\bECONDIZIONI\b/gu, "E CONDIZIONI"],
    [/\bESUL\b/gu, "E SUL"],
    [/\bEVELOCITÀORIZZONTALE\b/gu, "E VELOCITÀ ORIZZONTALE"],
    [/\bERELATIVO\b/gu, "E RELATIVO"],
    [/\bEDELLA\b/gu, "E DELLA"],
    [/\bEMETODI\b/gu, "E METODI"],
    [/\bAPIANTA\b/gu, "A PIANTA"],
    [/\bAFALDE\b/gu, "A FALDE"],
    [/\bECURVILINEE\b/gu, "E CURVILINEE"],
    [/\bADUE\b/gu, "A DUE"],
    [/\bOPIÙ\b/gu, "O PIÙ"],
    [/\bERETICOLARI\b/gu, "E RETICOLARI"],
    [/\bEPALI\b/gu, "E PALI"],
    [/\bATRALICCIO\b/gu, "A TRALICCIO"],
    [/\bASEZIONE\b/gu, "A SEZIONE"],
    [/\bOQUADRATA\b/gu, "O QUADRATA"],
    [/\bEPILASTRI\b/gu, "E PILASTRI"],
    [/\bEBLOCCHI\b/gu, "E BLOCCHI"],
    [/\bOIN\b/gu, "O IN"],
    [/\b([A-ZÀ-ÖØ-Þ]+)EPERIODO\b/gu, "$1 E PERIODO"],
    [/\b([A-ZÀ-ÖØ-Þ]+)ERELATIVE\b/gu, "$1 E RELATIVE"],
    [/\b([A-ZÀ-ÖØ-Þ]+)ECONDIZIONI\b/gu, "$1 E CONDIZIONI"],
    [/\b([A-ZÀ-ÖØ-Þ]+)EMETODI\b/gu, "$1 E METODI"],
    [/\b([A-ZÀ-ÖØ-Þ]+)ESUL\b/gu, "$1 E SUL"],
    [/\b([A-ZÀ-ÖØ-Þ]+)EVELOCITÀ\b/gu, "$1 E VELOCITÀ"],
    [/\b([A-ZÀ-ÖØ-Þ]+)APIANTA\b/gu, "$1 A PIANTA"],
    [/\b([A-ZÀ-ÖØ-Þ]+)AFALDE\b/gu, "$1 A FALDE"],
    [/\b([A-ZÀ-ÖØ-Þ]+)ECURVILINEE\b/gu, "$1 E CURVILINEE"],
    [/\b([A-ZÀ-ÖØ-Þ]+)ADUE\b/gu, "$1 A DUE"],
    [/\b([A-ZÀ-ÖØ-Þ]+)OPIÙ\b/gu, "$1 O PIÙ"],
    [/\b([A-ZÀ-ÖØ-Þ]+)EPALI\b/gu, "$1 E PALI"],
    [/\b([A-ZÀ-ÖØ-Þ]+)ATRALICCIO\b/gu, "$1 A TRALICCIO"],
    [/\b([A-ZÀ-ÖØ-Þ]+)ASEZIONE\b/gu, "$1 A SEZIONE"],
    [/\b([A-ZÀ-ÖØ-Þ]+)OQUADRATA\b/gu, "$1 O QUADRATA"],
    [/\b([A-ZÀ-ÖØ-Þ]+)ISOLAI\b/gu, "$1 I SOLAI"],
    [/\b([A-ZÀ-ÖØ-Þ]+)EBLOCCHI\b/gu, "$1 E BLOCCHI"],
    [/\b([A-ZÀ-ÖØ-Þ]+)OIN\b/gu, "$1 O IN"],
    [/\b([A-ZÀ-ÖØ-Þ]+)ONON\b/gu, "$1 O NON"],
    [/\b([A-ZÀ-ÖØ-Þ]+)ABASSA\b/gu, "$1 A BASSA"],
    [/\b([A-ZÀ-ÖØ-Þ]+)AMARCATURA\b/gu, "$1 A MARCATURA"],
];

function sha256(value: string): string {
    return createHash("sha256").update(value, "utf8").digest("hex");
}

function isTextBlock(block: TextBlock | AssetBlock): block is TextBlock {
    return "text" in block;
}

function inScope(document: string, official: string): boolean {
    if (document === "ntc2018") {
        return /^[123](?:\.|$)/u.test(official);
    }
    return (
        /^C[123](?:\.|$)/u.test(official) ||
        official === "C4.1" ||
        official.startsWith("C4.1.")
    );
}

function repairCommonText(value: string): string {
    let normalized = value;
    for (const [pattern, replacement] of glyphReplacements) {
        normalized = normalized.replace(pattern, replacement);
    }
    return normalized;
}

function normalizeLine(value: string): string {
    return repairCommonText(value)
        .normalize("NFC")
        .replace(/\s+/gu, " ")
        .replace(
            /\b([A-Z])\s+(d|k|R|S|N|U|Ed|Rd|VR|k[123]|s|r|b|f|p|t|c)\b/gu,
            "$1$2",
        )
        .replace(
            /([\u03b1-\u03c9])\s+([A-Za-z]?\d+(?:,[A-Za-z0-9]+)?)/gu,
            "$1$2",
        )
        .replace(/\s+([,.;:!?])/gu, "$1")
        .replace(/\(\s+/gu, "(")
        .replace(/\s+\)/gu, ")")
        .trim();
}

function cleanTitle(value: string): string {
    let title = normalizeLine(value);
    for (const [pattern, replacement] of titleRepairs) {
        title = title.replace(pattern, replacement);
    }
    return title
        .replace(/([\u00c0-\u00d6\u00d8-\u00de])(?=[A-Z])/gu, "$1 ")
        .replace(/\s+/gu, " ")
        .trim();
}

function textTransformations(
    raw: string,
    normalized: string,
    pages: Set<number>,
): Transformation[] {
    if (raw === normalized) return [];
    const transformations: Transformation[] = [
        {
            operation: "remove-control-character",
            ruleVersion: normalizationVersion,
            note: "Rimossi i caratteri di controllo privi di resa visuale.",
        },
        {
            operation: "remove-discretionary-hyphen",
            ruleVersion: normalizationVersion,
            note: "Unite le parole divise esclusivamente dall’andata a capo tipografica.",
        },
        {
            operation: "join-line-wrap",
            ruleVersion: normalizationVersion,
            note: "Rimosse le andate a capo di impaginazione, conservando capoversi ed elenchi.",
        },
        {
            operation: "manual-correction",
            ruleVersion: normalizationVersion,
            note: "Ripristinati i caratteri italiani, greci e matematici riconoscibili nel layer ufficiale.",
        },
        {
            operation: "normalize-whitespace",
            ruleVersion: normalizationVersion,
            note: "Uniformati gli spazi dopo la ricomposizione.",
        },
        {
            operation: "unicode-nfc",
            ruleVersion: normalizationVersion,
            note: "Testo normalizzato in Unicode NFC.",
        },
    ];
    if (pages.size > 1) {
        transformations.push({
            operation: "join-page-break",
            ruleVersion: normalizationVersion,
            note: "Unita una continuazione testuale attraversata da un cambio pagina.",
        });
    }
    return transformations;
}

function appendLine(current: string, next: string): string {
    if (!current) return next;
    if (/[\p{L}\p{N}]-$/u.test(current) && /^\p{Ll}/u.test(next)) {
        return `${current.slice(0, -1)}${next}`;
    }
    return `${current} ${next}`;
}

function isBullet(value: string): boolean {
    return /^(?:[•–—!-]\s*|[a-z]\)\s+|[a-z]\.\s+|\d+\.\s+)/iu.test(value);
}

function withoutBullet(value: string): string {
    return value
        .replace(/^[•–—!-]\s*/u, "")
        .replace(/^([a-z])\.\s+/iu, "$1) ")
        .trim();
}

function closesParagraph(value: string): boolean {
    return /[.!?](?:["”’')\]])?$/.test(value);
}

function closesListItem(value: string): boolean {
    return closesParagraph(value);
}

function assetEvidence(source: Evidence, asset: Asset): Evidence {
    const figure = asset.id.includes(":asset:figure:");
    const table = asset.id.includes(":asset:table:");
    const sourceCrop = figure && !asset.imagePath?.includes("placeholder-");
    const reviewedTable =
        table &&
        (asset.officialNumber?.startsWith("C4.1.") ||
            asset.officialNumber === "C2.4.I");
    const reviewedFormula =
        !figure &&
        !table &&
        asset.unitId.startsWith("urn:structural-codes:it:unit:circ2019:c4.1");
    return {
        ...source,
        pdfPage: asset.pdfPage,
        extraction: {
            method: "manual-transcription",
            tool: figure
                ? sourceCrop
                    ? "poppler-pdf-crop"
                    : "codex-figure-placeholder"
                : table
                  ? reviewedTable
                      ? "codex-manual-table-transcription"
                      : "pdfplumber-table-extraction"
                  : reviewedFormula
                    ? "codex-reviewed-source-transcription"
                    : "codex-source-transcription",
            toolVersion: normalizationVersion,
        },
        transformations: [
            {
                operation: "manual-correction",
                ruleVersion: normalizationVersion,
                note: figure
                    ? sourceCrop
                        ? "Ritaglio ad alta risoluzione ricavato dalla figura e dalla didascalia nella fonte ufficiale."
                        : "Segnaposto collocato in corrispondenza della didascalia ufficiale; il ritaglio della figura deve ancora essere inserito."
                    : table
                      ? reviewedTable
                          ? "Tabella ritrascritta e verificata riga per riga sulla fonte ufficiale."
                          : "Tabella ricostruita dalla geometria del PDF e collocata al posto delle righe estratte linearmente; richiede revisione puntuale."
                    : reviewedFormula
                      ? "Formula ritrascritta in LaTeX, verificata sulla fonte ufficiale e collocata nella posizione originaria."
                      : "Formula trascritta in LaTeX dal documento ufficiale e collocata nella posizione originaria; richiede revisione puntuale.",
            },
        ],
    };
}

function makeTextBlock(
    unitId: string,
    sequence: number,
    kind: TextBlock["kind"],
    rawLines: string[],
    normalized: string,
    evidences: Evidence[],
): TextBlock {
    const raw = rawLines.join("\n");
    const evidence = evidences[0];
    if (!evidence) throw new Error(`Evidence assente: ${unitId}`);
    const inline = buildInlineSegments(normalized);
    return {
        blockId: `${unitId}#block-editorial-${String(sequence).padStart(3, "0")}`,
        kind,
        origin: "official",
        text: {
            raw,
            normalized,
            normalizationVersion,
            ...(inline ? { inline } : {}),
        },
        evidence: {
            ...evidence,
            transformations: textTransformations(
                raw,
                normalized,
                new Set(evidences.map(({ pdfPage }) => pdfPage)),
            ),
            rawSha256: sha256(raw),
            normalizedSha256: sha256(normalized),
        },
    };
}

function titleBlock(unit: CanonicalUnit, source: TextBlock): TextBlock {
    const normalized = `${unit.numbering.official} ${unit.title}`;
    const inline = buildInlineSegments(normalized);
    return {
        ...source,
        blockId: unit.titleBlockId,
        kind: "heading",
        text: {
            ...source.text,
            normalized,
            normalizationVersion,
            ...(inline ? { inline } : {}),
        },
        evidence: {
            ...source.evidence,
            transformations: textTransformations(
                source.text.raw,
                normalized,
                new Set([source.evidence.pdfPage]),
            ),
            rawSha256: sha256(source.text.raw),
            normalizedSha256: sha256(normalized),
        },
    };
}

function layoutHeadings(layout: Layout, document: string): Map<number, Set<string>> {
    const result = new Map<number, Set<string>>();
    for (const [page, entry] of Object.entries(
        layout.documents[document]?.pages ?? {},
    )) {
        result.set(
            Number(page),
            new Set(entry.boldLines.map(({ text }) => normalizeLine(text))),
        );
    }
    return result;
}

function formulaAssetId(document: string, number: string): string {
    return `urn:structural-codes:it:asset:formula:${document}:${number.toLowerCase()}`;
}

function figureAssetId(document: string, number: string): string {
    return `urn:structural-codes:it:asset:figure:${document}:${number.toLowerCase()}`;
}

function tokenize(
    document: string,
    unit: CanonicalUnit,
    sourceBlocks: TextBlock[],
    assetsById: Map<string, Asset>,
): Token[] {
    const tokens: Token[] = [];
    for (const block of sourceBlocks.filter(({ kind }) => kind !== "heading")) {
        const lines = block.text.raw.split(/\r?\n/u);
        const key = `${document}:${unit.numbering.official}@${block.evidence.pdfPage}`;
        const placements = formulaPlacements[key] ?? [];
        const replacements = lineReplacements[key] ?? {};
        const byStart = new Map(placements.map((placement) => [placement.start, placement]));
        const tablesByStart = new Map(
            (tablePlacements.placements[key] ?? []).map((placement) => [
                placement.start,
                placement,
            ]),
        );
        for (let index = 0; index < lines.length; index += 1) {
            const placement = byStart.get(index);
            if (placement) {
                if (placement.prefix) {
                    tokens.push({
                        type: "line",
                        raw: lines.slice(placement.start, placement.end + 1).join("\n"),
                        normalized: normalizeLine(placement.prefix),
                        evidence: block.evidence,
                    });
                }
                const id = formulaAssetId(document, placement.number);
                const asset = assetsById.get(id);
                if (!asset) throw new Error(`Asset formula assente: ${id}`);
                tokens.push({ type: "asset", asset, evidence: block.evidence });
                index = placement.end;
                continue;
            }
            const tablePlacement = tablesByStart.get(index);
            if (tablePlacement) {
                const asset = assetsById.get(tablePlacement.assetId);
                if (!asset) {
                    throw new Error(`Asset tabella assente: ${tablePlacement.assetId}`);
                }
                tokens.push({ type: "asset", asset, evidence: block.evidence });
                for (const swallowed of lines.slice(
                    tablePlacement.start,
                    tablePlacement.end + 1,
                )) {
                    const match = normalizeLine(swallowed).match(
                        /(?:Fig\.|Figura)\s+(C?\d+(?:\.\d+)+(?:\s*[a-c])?)\s*[-–]\s*/u,
                    );
                    if (!match?.[1]) continue;
                    const figure = assetsById.get(
                        figureAssetId(
                            document,
                            match[1].replace(/\s+/gu, ""),
                        ),
                    );
                    if (figure) {
                        tokens.push({
                            type: "asset",
                            asset: figure,
                            evidence: block.evidence,
                        });
                    }
                }
                index = tablePlacement.end;
                continue;
            }
            const raw = lines[index]!;
            const replacement: string | null = Object.hasOwn(
                replacements,
                index,
            )
                ? (replacements[index] ?? null)
                : raw;
            if (replacement === null) continue;
            const normalized = normalizeLine(replacement);
            if (!normalized) continue;
            const figureCaption = normalized.match(
                /(?:Fig\.|Figura)\s+(C?\d+(?:\.\d+)+(?:\s*[a-c])?)\s*[-–]\s*/u,
            );
            if (figureCaption?.index !== undefined && figureCaption[1]) {
                const prefix = normalized.slice(0, figureCaption.index).trim();
                if (prefix) {
                    tokens.push({
                        type: "line",
                        raw,
                        normalized: prefix,
                        evidence: block.evidence,
                    });
                }
                const number = figureCaption[1].replace(/\s+/gu, "");
                const asset = assetsById.get(figureAssetId(document, number));
                if (asset) {
                    tokens.push({ type: "asset", asset, evidence: block.evidence });
                    continue;
                }
            }
            tokens.push({
                type: "line",
                raw,
                normalized,
                evidence: block.evidence,
                breakAfter: forcedBreakAfterLines.has(`${key}:${index}`),
            });
        }
    }
    return tokens;
}

function compose(
    document: string,
    unit: CanonicalUnit,
    sourceBlocks: TextBlock[],
    pageHeadings: Map<number, Set<string>>,
    assetsById: Map<string, Asset>,
): Array<TextBlock | AssetBlock> {
    const sourceHeading =
        sourceBlocks.find(({ blockId }) => blockId === unit.titleBlockId) ??
        sourceBlocks.find(({ kind }) => kind === "heading");
    if (!sourceHeading) throw new Error(`Titolo sorgente assente: ${unit.id}`);

    const blocks: Array<TextBlock | AssetBlock> = [titleBlock(unit, sourceHeading)];
    const tokens = tokenize(document, unit, sourceBlocks, assetsById);
    let sequence = 0;
    let accumulator:
        | {
              kind: "paragraph" | "list-item";
              rawLines: string[];
              normalized: string;
              evidences: Evidence[];
          }
        | undefined;

    const flush = () => {
        if (!accumulator?.normalized) {
            accumulator = undefined;
            return;
        }
        sequence += 1;
        blocks.push(
            makeTextBlock(
                unit.id,
                sequence,
                accumulator.kind,
                accumulator.rawLines,
                accumulator.normalized,
                accumulator.evidences,
            ),
        );
        accumulator = undefined;
    };

    for (const token of tokens) {
        if (token.type === "asset") {
            flush();
            sequence += 1;
            blocks.push({
                blockId: `${unit.id}#block-editorial-${String(sequence).padStart(3, "0")}`,
                kind: token.asset.id.includes(":asset:figure:")
                    ? "figure-ref"
                    : token.asset.id.includes(":asset:table:")
                      ? "table-ref"
                    : "formula-ref",
                origin: "official",
                assetId: token.asset.id,
                evidence: assetEvidence(token.evidence, token.asset),
            });
            continue;
        }
        const isSubheading =
            manualSubheadings.has(token.normalized) ||
            pageHeadings.get(token.evidence.pdfPage)?.has(token.normalized);
        if (isSubheading) {
            flush();
            sequence += 1;
            blocks.push(
                makeTextBlock(
                    unit.id,
                    sequence,
                    "heading",
                    [token.raw],
                    token.normalized,
                    [token.evidence],
                ),
            );
            continue;
        }

        const bullet = isBullet(token.normalized);
        if (bullet) {
            flush();
            accumulator = {
                kind: "list-item",
                rawLines: [token.raw],
                normalized: withoutBullet(token.normalized),
                evidences: [token.evidence],
            };
            if (
                closesListItem(accumulator.normalized) ||
                token.breakAfter
            ) {
                flush();
            }
            continue;
        }

        if (accumulator?.kind === "list-item") {
            if (
                /;$/.test(accumulator.normalized) &&
                /^\p{Lu}/u.test(token.normalized)
            ) {
                flush();
            } else {
                accumulator.rawLines.push(token.raw);
                accumulator.normalized = appendLine(
                    accumulator.normalized,
                    token.normalized,
                );
                accumulator.evidences.push(token.evidence);
                if (closesListItem(token.normalized)) flush();
                continue;
            }
        }

        accumulator ??= {
            kind: "paragraph",
            rawLines: [],
            normalized: "",
            evidences: [],
        };
        accumulator.rawLines.push(token.raw);
        accumulator.normalized = appendLine(
            accumulator.normalized,
            token.normalized,
        );
        accumulator.evidences.push(token.evidence);

        if (/:$/.test(token.normalized) || closesParagraph(token.normalized)) {
            flush();
        }
    }
    flush();
    return blocks;
}

const [layout, tablePlacements] = await Promise.all([
    readFile(layoutFile, "utf8").then((raw) => JSON.parse(raw) as Layout),
    readFile(
        join(repoRoot, "migration", "layout", "core-table-placements.json"),
        "utf8",
    ).then((raw) => JSON.parse(raw) as GeneratedTablePlacements),
]);
const assetManifestDirectory = join(repoRoot, "corpus", "assets");
const assetManifestFiles = (
    await readdir(assetManifestDirectory, { recursive: true })
).filter((filename) => filename.endsWith(".json"));
const assetManifests = await Promise.all(
    assetManifestFiles.map(async (filename) =>
        JSON.parse(
            await readFile(join(assetManifestDirectory, filename), "utf8"),
        ) as AssetManifest,
    ),
);
const allAssets = assetManifests.flatMap(({ formulas, tables, figures }) => [
    ...formulas,
    ...tables,
    ...figures,
]);
const assetsById = new Map(allAssets.map((asset) => [asset.id, asset]));
const loaded: Array<{
    document: string;
    filePath: string;
    unit: CanonicalUnit;
}> = [];

for (const document of ["ntc2018", "circ2019"]) {
    const directory = join(repoRoot, "corpus", "units", document);
    for (const filename of await readdir(directory)) {
        if (!filename.endsWith(".json")) continue;
        const filePath = join(directory, filename);
        const unit = JSON.parse(await readFile(filePath, "utf8")) as CanonicalUnit;
        if (!inScope(document, unit.numbering.official)) continue;
        loaded.push({ document, filePath, unit });
    }
}

let snapshot: SourceSnapshot;
try {
    snapshot = JSON.parse(await readFile(snapshotFile, "utf8")) as SourceSnapshot;
} catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    snapshot = {
        formatVersion: 1,
        normalizationProfile: "canonical-extraction-before-core-editorial-split",
        units: Object.fromEntries(
            loaded.map(({ unit }) => [
                unit.id,
                unit.blocks.filter(isTextBlock),
            ]),
        ),
    };
    await mkdir(dirname(snapshotFile), { recursive: true });
    await writeFile(snapshotFile, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
}

let changed = 0;
let textBlocks = 0;
for (const { document, filePath, unit } of loaded) {
    const sourceBlocks = snapshot.units[unit.id];
    if (!sourceBlocks) throw new Error(`Snapshot sorgente assente: ${unit.id}`);
    unit.title = cleanTitle(unit.title);
    unit.blocks = compose(
        document,
        unit,
        sourceBlocks,
        layoutHeadings(layout, document),
        assetsById,
    );
    const unitAssets = allAssets.filter((asset) => asset.unitId === unit.id);
    unit.assets = {
        formulaIds: unitAssets
            .filter(({ id }) => id.includes(":asset:formula:"))
            .map(({ id }) => id),
        tableIds: unitAssets
            .filter(({ id }) => id.includes(":asset:table:"))
            .map(({ id }) => id),
        figureIds: unitAssets
            .filter(({ id }) => id.includes(":asset:figure:"))
            .map(({ id }) => id),
    };
    textBlocks += unit.blocks.length;
    await writeFile(filePath, `${JSON.stringify(unit, null, 2)}\n`, "utf8");
    changed += 1;
}

console.log(
    `core-editorial-profile: ${changed} unità, ${textBlocks} blocchi testuali logici`,
);
