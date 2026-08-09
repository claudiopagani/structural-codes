import { copyFile, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { sha256OfText } from "../src/lib/hash.ts";

const root = fileURLToPath(new URL("../", import.meta.url));
const unitDirectory = join(root, "corpus", "units", "circ2019");
const assetDirectory = join(root, "corpus", "assets", "circ2019");
const figureDirectory = join(root, "corpus", "assets", "figures", "circ2019");
const evidenceRenderDirectory = join(root, "evidence", "circ-7-2019", "renders");
const sourceId = "circ-7-2019";
const workId = "it-mit:circ:2019-01-21:7-csllpp";
const expressionId = "it-mit:circ:2019-01-21:7-csllpp:original-it";
const profile = "circ42-editorial-profile-0.1.0";
const createdAt = "2026-08-09T00:00:00Z";
const unitNumber = "C4.2.4.1.4.3";

type Region = { coordinateSystem: "pdf-points-top-left"; x: number; y: number; width: number; height: number };
type Inline = { kind: "text" | "math"; value: string; latex?: string };
type FormulaRow = { number: string; page: number; latex: string; raw: string; region: Region };
type GeneratedBlock = {
    blockId: string;
    kind: string;
    origin: "official";
    text?: { raw: string; normalized: string; normalizationVersion: string; inline: Inline[] };
    evidence: { rawSha256: string; normalizedSha256: string; [key: string]: unknown };
    assetId?: string;
};

const uid = (number: string) => `urn:structural-codes:it:unit:circ2019:${number.toLowerCase()}`;
const formulaId = (number: string) => `urn:structural-codes:it:asset:formula:circ2019:${number.toLowerCase()}`;
const figureId = (number: string) => `urn:structural-codes:it:asset:figure:circ2019:${number.toLowerCase()}`;
const tableId = (number: string) => `urn:structural-codes:it:asset:table:circ2019:${number.toLowerCase()}`;
const reg = (x: number, y: number, width: number, height: number): Region => ({ coordinateSystem: "pdf-points-top-left", x, y, width, height });
const text = (value: string): Inline => ({ kind: "text", value });
const math = (value: string, latex: string): Inline => ({ kind: "math", value, latex });
const hash = (value: string) => sha256OfText(value);
const c = (value: string, latex?: string, spans: { colSpan?: number; rowSpan?: number } = {}) => ({ text: value, ...(latex ? { latex } : {}), ...spans });
const f = (value: string, latex: string, spans: { colSpan?: number; rowSpan?: number } = {}) => c(value, latex, spans);

function evidence(page: number, raw: string, normalized: string, region: Region, manual = false) {
    return {
        sourceId,
        pdfPage: page,
        printedPage: String(page - 4),
        region,
        extraction: { method: manual ? "manual-transcription" : "pdf-text", tool: manual ? "codex-source-transcription" : "pdfjs-dist", toolVersion: manual ? profile : "4.10.38" },
        transformations: [
            { operation: "join-line-wrap", ruleVersion: profile, note: "Ricomposte le righe tipografiche appartenenti allo stesso capoverso; le formule e le figure restano blocchi distinti." },
            ...(raw !== normalized ? [{ operation: "manual-correction", ruleVersion: profile, note: "Ripristinati accenti, apostrofi, simboli e notazione matematica confrontati con il render ufficiale." }] : []),
            { operation: "unicode-nfc", ruleVersion: profile, note: "Testo normalizzato in Unicode NFC." },
        ],
        rawSha256: hash(raw),
        normalizedSha256: hash(normalized),
    };
}

function block(suffix: string, kind: "heading" | "paragraph", page: number, normalized: string, inline: Inline[], region: Region, manual = false): GeneratedBlock {
    return { blockId: `${uid(unitNumber)}#block-${suffix}`, kind, origin: "official", text: { raw: normalized, normalized, normalizationVersion: profile, inline }, evidence: evidence(page, normalized, normalized, region, manual) };
}

function formulaBlock(suffix: string, formula: FormulaRow): GeneratedBlock {
    return { blockId: `${uid(unitNumber)}#block-${suffix}`, kind: "formula-ref", origin: "official", assetId: formulaId(formula.number), evidence: evidence(formula.page, formula.raw, formula.raw, formula.region, true) };
}

function figureBlock(suffix: string, asset: string, page: number, caption: string, region: Region): GeneratedBlock {
    return { blockId: `${uid(unitNumber)}#block-${suffix}`, kind: "figure-ref", origin: "official", assetId: asset, evidence: evidence(page, caption, caption, region, true) };
}

function tableBlock(suffix: string, asset: string, page: number, caption: string, region: Region): GeneratedBlock {
    return { blockId: `${uid(unitNumber)}#block-${suffix}`, kind: "table-ref", origin: "official", assetId: asset, evidence: evidence(page, caption, caption, region, true) };
}

const formula94: FormulaRow = {
    number: "C4.2.94",
    page: 125,
    latex: "\\begin{aligned}\\Delta\\sigma&=\\Delta\\sigma_C\\left(\\frac{2\\cdot10^6}{N}\\right)^{1/m}&&\\text{per }N\\le5\\cdot10^6\\\\\\Delta\\sigma&=\\Delta\\sigma_D\\left(\\frac{2\\cdot10^6}{N}\\right)^{1/(m+2)}&&\\text{per }5\\cdot10^6<N\\le10^8,\\\\\\Delta\\sigma&=\\Delta\\sigma_L&&\\text{per }N>10^8\\end{aligned}",
    raw: "Δσ = Δσ_C (2·10^6/N)^(1/m) per N ≤ 5·10^6; Δσ = Δσ_D (2·10^6/N)^(1/(m+2)) per 5·10^6 < N ≤ 10^8,; Δσ = Δσ_L per N > 10^8 [C4.2.94]",
    region: reg(145, 365, 325, 130),
};
const formula95: FormulaRow = {
    number: "C4.2.95",
    page: 125,
    latex: "\\Delta\\sigma_D=0{,}737\\Delta\\sigma_C;\\qquad\\Delta\\sigma_L=0{,}549\\Delta\\sigma_C",
    raw: "Δσ_D = 0,737 Δσ_C;  Δσ_L = 0,549 Δσ_C [C4.2.95]",
    region: reg(145, 465, 325, 45),
};
const formula96: FormulaRow = {
    number: "C4.2.96",
    page: 126,
    latex: "\\begin{aligned}\\Delta\\tau&=\\Delta\\tau_C\\left(\\frac{2\\cdot10^6}{N}\\right)^{1/m}&&\\text{per }N\\le10^8\\\\\\Delta\\tau&=\\Delta\\tau_L&&\\text{per }N>10^8\\end{aligned}",
    raw: "Δτ = Δτ_C (2·10^6/N)^(1/m) per N ≤ 10^8; Δτ = Δτ_L per N > 10^8 [C4.2.96]",
    region: reg(145, 345, 325, 95),
};
const formula97: FormulaRow = {
    number: "C4.2.97",
    page: 126,
    latex: "\\Delta\\tau_L=0{,}457\\Delta\\tau_C",
    raw: "Δτ_L = 0,457 Δτ_C. [C4.2.97]",
    region: reg(145, 430, 325, 40),
};
const figure21 = figureId("C4.2.21");
const figure22 = figureId("C4.2.22");
const figure23 = figureId("C4.2.23");
const figure21Region = reg(135, 510, 330, 225);
const figure22Region = reg(145, 155, 310, 160);
const figure23Region = reg(170, 470, 300, 205);
const tableXIIaId = tableId("C4.2.XII.a");
const tableXIIaRegion = reg(70, 100, 455, 190);

const tableXIIa = {
    id: tableXIIaId,
    unitId: uid(unitNumber),
    officialNumber: "C4.2.XII.a",
    pdfPage: 127,
    caption: "Dettagli costruttivi per prodotti laminati e estrusi e loro classificazione (Δσ)",
    columnCount: 4,
    headers: [[c("Classe del dettaglio"), c("Dettaglio costruttivo"), c("Descrizione"), c("Requisiti")]],
    rows: [
        [
            f("160\\n140(1)", "\\begin{gathered}160\\\\140^{(1)}\\end{gathered}"),
            c("Schemi 1, 2 e 3: lamiera o piastra piana; profilo a I; profilo cavo circolare, con frecce di sollecitazione."),
            c("Prodotti laminati e estrusi\n1) Lamiere e piatti laminati;\n2) Lamiere e piatti;\n3) Profili cavi senza saldatura, rettangolari e circolari"),
            c("Difetti superficiali e di laminazione e spigoli vivi devono essere eliminati mediante molatura"),
        ],
        [
            f("140\\n125(1)", "\\begin{gathered}140\\\\125^{(1)}\\end{gathered}"),
            c("Schema 4: lamiera tagliata, con bordo di taglio e frecce di sollecitazione."),
            c("Lamiere tagliate con gas o meccanicamente\n4) Taglio a gas automatico o taglio meccanico e successiva eliminazione delle tracce del taglio"),
            c("4) Tutti i segni visibili di intaglio sui bordi devono essere eliminati. Le aree di taglio devono essere lavorate a macchina. Graffi e scalfitture di lavorazione devono essere paralleli agli sforzi"),
        ],
        [
            f("125\\n112(1)", "\\begin{gathered}125\\\\112^{(1)}\\end{gathered}"),
            c("Schema 5: lamiera tagliata, con bordo di taglio regolare e superficiale e frecce di sollecitazione."),
            c("5) Taglio a gas manuale o taglio a gas automatico con tracce del taglio regolari e superficiali e successiva eliminazione di tutti i difetti dei bordi"),
            f("4) e 5) Angoli rientranti devono essere raccordati con pendenza ≤1:4, in caso contrario occorre impiegare opportuni fattori di concentrazione degli sforzi.\nNon sono ammesse riparazioni mediante saldatura", "\\begin{gathered}\\text{4) e 5) Angoli rientranti devono essere raccordati con pendenza }\\le1:4,\\\\\\text{in caso contrario occorre impiegare opportuni fattori di concentrazione degli sforzi.}\\\\\\text{Non sono ammesse riparazioni mediante saldatura}\\end{gathered}"),
        ],
    ],
    notes: [
        "I disegni interni della colonna «Dettaglio costruttivo» sono rappresentati mediante descrizioni strutturate.",
        "(1) Classe da adottare per acciai resistenti alla corrosione.",
    ],
};

const tableXIIbId = tableId("C4.2.XII.b");
const tableXIIcId = tableId("C4.2.XII.c");
const tableXIIdId = tableId("C4.2.XII.d");
const tableXIIbRegion = reg(70, 300, 455, 75);
const tableXIIcRegion = reg(70, 375, 455, 95);
const tableXIIdRegion = reg(70, 470, 455, 240);

const tableXIIb = {
    id: tableXIIbId,
    unitId: uid(unitNumber),
    officialNumber: "C4.2.XII.b",
    pdfPage: 127,
    caption: "Dettagli costruttivi per prodotti laminati e estrusi e loro classificazione (Δτ)",
    columnCount: 4,
    headers: [[c("Classe del dettaglio"), c("Dettaglio costruttivo"), c("Descrizione"), c("Requisiti")]],
    rows: [[
        c("100"),
        c("Schemi 6 e 7: profilo a I e profilo cavo circolare, con frecce di sollecitazione."),
        c("6) e 7) Prodotti laminati e estrusi (come quelli di tabella C4.2.XVI.a) soggetti a tensioni tangenziali"),
        f("Δτ calcolati con Δτ = ΔV·S(t)/(I·t)", "\\begin{gathered}\\Delta\\tau\\text{ calcolati con}\\\\\\Delta\\tau=\\frac{\\Delta V\\cdot S(t)}{I\\cdot t}\\end{gathered}"),
    ]],
    notes: ["I disegni interni della colonna «Dettaglio costruttivo» sono rappresentati mediante descrizioni strutturate."],
};

const tableXIIc = {
    id: tableXIIcId,
    unitId: uid(unitNumber),
    officialNumber: "C4.2.XII.c",
    pdfPage: 127,
    caption: "Bulloni sollecitati a taglio (Δτ)",
    columnCount: 4,
    headers: [[c("Classe del dettaglio"), c("Dettaglio costruttivo"), c("Descrizione"), c("Requisiti")]],
    rows: [[
        c("100"),
        c("Schema 15: bullone sollecitato a taglio su uno o due piani non interessanti la parte filettata, con frecce contrapposte."),
        c("15) Bulloni sollecitati a taglio su uno o due piani non interessanti la parte filettata.\n- Bulloni calibrati\n- Bulloni normali di grado 5.6, 8.8 e 10.9 e assenza di inversioni di carico"),
        f("Δτ calcolati in riferimento all’area del gambo", "\\Delta\\tau\\text{ calcolati in riferimento all’area del gambo}"),
    ]],
    notes: ["Il disegno interno della colonna «Dettaglio costruttivo» è rappresentato mediante una descrizione strutturata."],
};

const tableXIId = {
    id: tableXIIdId,
    unitId: uid(unitNumber),
    officialNumber: "C4.2.XII.d",
    pdfPage: 127,
    caption: "Dettagli costruttivi per giunti chiodati o bullonati (Δσ)",
    columnCount: 4,
    headers: [[c("Classe del dettaglio"), c("Dettaglio costruttivo"), c("Descrizione"), c("Requisiti")]],
    rows: [
        [
            c("112"),
            c("Schema 8: giunto con coprigiunti doppi e bulloni, con frecce di sollecitazione."),
            c("8) Giunti bullonati con coprigiunti doppi e bulloni AR precaricati o bulloni precaricati iniettati"),
            f("Δσ riferiti alla sezione lorda", "\\Delta\\sigma\\text{ riferiti alla sezione lorda}"),
        ],
        [
            c("90", undefined, { rowSpan: 3 }),
            c("Schema 9: giunto con coprigiunti doppi e bulloni, con frecce di sollecitazione."),
            c("9) Giunti bullonati con coprigiunti doppi e bulloni calibrati o bulloni non precaricati iniettati"),
            f("Δσ riferiti alla sezione netta", "\\Delta\\sigma\\text{ riferiti alla sezione netta}"),
        ],
        [
            c("Schema 10: giunto con coprigiunti singoli e bulloni, con frecce di sollecitazione."),
            c("10) Giunti bullonati con coprigiunti singoli e bulloni AR precaricati o bulloni precaricati iniettati"),
            f("Δσ riferiti alla sezione lorda", "\\Delta\\sigma\\text{ riferiti alla sezione lorda}"),
        ],
        [
            c("Schema 11: elemento strutturale forato soggetto a forza normale e momento flettente."),
            c("11) Elementi strutturali forati soggetti a forza normale e momento flettente"),
            f("Δσ riferiti alla sezione netta", "\\Delta\\sigma\\text{ riferiti alla sezione netta}"),
        ],
    ],
    notes: ["I disegni interni della colonna «Dettaglio costruttivo» sono rappresentati mediante descrizioni strutturate."],
};

const tableXIIIId = tableId("C4.2.XIII");
const tableXIIIRegion = reg(70, 300, 455, 400);

const tableXIII = {
    id: tableXIIIId,
    unitId: uid(unitNumber),
    officialNumber: "C4.2.XIII",
    pdfPage: 128,
    caption: "Dettagli costruttivi per sezioni saldate (Δσ)",
    columnCount: 4,
    headers: [[c("Classe del dettaglio"), c("Dettaglio costruttivo"), c("Descrizione"), c("Requisiti")]],
    rows: [
        [
            c("125"),
            c("Schemi 1 e 2: saldature longitudinali continue su piatti o piattabande."),
            c("Saldature longitudinali continue\n1) Saldatura automatica a piena penetrazione effettuata da entrambi i lati\n2) Saldatura automatica a cordoni d’angolo. Le parti terminali dei piatti di rinforzo devono essere verificate considerando i dettagli 5) e 6) della tabella C4.2.XVI.a"),
            c("1) e 2) Non sono consentite interruzioni/riprese, a meno che la riparazione sia eseguita da un tecnico qualificato e siano eseguiti controlli atti a verificare la corretta esecuzione della riparazione"),
        ],
        [
            c("112"),
            c("Schemi 3 e 4: saldature su piatti e piatti di sostegno, con punti di interruzione/ripresa nel solo schema 3."),
            c("3) Saldatura automatica a cordoni d’angolo o a piena penetrazione effettuata da entrambi i lati, ma contenente punti di interruzione/ripresa.\n4) Saldatura automatica a piena penetrazione su piatto di sostegno, non contenente punti di interruzione/ripresa"),
            c("4) Se il dettaglio contiene punti di interruzione/ripresa, si deve far riferimento alla classe 100"),
        ],
        [
            c("100"),
            c("Schemi 5 e 6: saldature manuali o automatiche su piatti e profili, eseguite da uno o da entrambi i lati."),
            c("5) Saldatura manuale a cordoni d’angolo o a piena penetrazione\n6) Saldatura a piena penetrazione manuale o automatica eseguita da un solo lato, in particolare per travi a cassone"),
            c("5) e 6) Deve essere assicurato un corretto contatto tra anima e piattabanda. Il bordo dell’anima deve essere preparato in modo da garantire una penetrazione regolare alla radice, senza interruzioni"),
        ],
        [
            c("100"),
            c("Schema 7: saldatura longitudinale su piatto di sostegno."),
            c("7) Saldatura a cordoni d’angolo o a piena penetrazione, manuale o automatica, appartenente ai dettagli da 1) a 6) riparata"),
            c("In caso di adozione di metodi migliorativi mediante molatura eseguita da tecnici qualificati, integrati da opportuni controlli, è possibile ripristinare la classe originaria"),
        ],
        [
            c("80"),
            c("Schema 8: saldatura longitudinale a tratti, con rapporto g/h ≤ 2,5."),
            c("8) Saldatura longitudinale a cordoni d’angolo a tratti"),
            f("Δσ riferiti alle tensioni nella piattabanda", "\\Delta\\sigma\\text{ riferiti alle tensioni nella piattabanda}"),
        ],
        [
            c("71"),
            c("Schema 9: saldatura longitudinale con lunette di scarico."),
            c("9) Saldatura longitudinale a piena penetrazione, a cordoni d’angolo e a tratti, con lunette di scarico di altezza non maggiore di 60 mm. Per lunette di altezza maggiore vedere dettaglio 1) della tabella C4.2.XV"),
            f("Δσ riferiti alle tensioni nella piattabanda", "\\Delta\\sigma\\text{ riferiti alle tensioni nella piattabanda}"),
        ],
        [
            c("125 (a)\n112 (b)\n90 (c)"),
            c("Schema 10: saldatura longitudinale a piena penetrazione."),
            c("10) Saldatura longitudinale a piena penetrazione"),
            c("(a) Entrambe le facce molate in direzione degli sforzi e controlli non distruttivi al 100%\n(b) Come saldata, assenza di interruzioni/riprese\n(c) Con interruzioni/riprese"),
        ],
        [
            c("140 (a)\n125 (b)\n90 (c)"),
            c("Schema 11: saldatura longitudinale automatica in sezioni cave circolari o rettangolari."),
            c("11) Saldatura longitudinale automatica di composizione in sezioni cave circolari o rettangolari, in assenza di interruzioni/riprese"),
            c("(a) Difetti entro i limiti della UNI EN 1090. Spessore t≤12,5 mm e controlli non distruttivi al 100%\n(b) Come saldata, assenza di interruzioni/riprese\n(c) Con interruzioni/riprese"),
        ],
    ],
    notes: [
        "I disegni interni della colonna «Dettaglio costruttivo» sono rappresentati mediante descrizioni strutturate.",
        "La tabella prosegue a pagina PDF 129 con i dettagli 10) e 11).",
    ],
};

const tableXIVId = tableId("C4.2.XIV");
const tableXIVRegion = reg(70, 205, 455, 500);

const tableXIV = {
    id: tableXIVId,
    unitId: uid(unitNumber),
    officialNumber: "C4.2.XIV",
    pdfPage: 129,
    caption: "Dettagli costruttivi per saldature a piena penetrazione (Δσ)",
    columnCount: 4,
    headers: [[c("Classe del dettaglio"), c("Dettaglio costruttivo"), c("Descrizione"), c("Requisiti")]],
    rows: [
        [
            c("112"),
            c("Schemi 1, 2, 3 e 4: saldature senza piatto di sostegno su piatti, lamiere, profili laminati e piatti rastremati."),
            c("Saldature senza piatto di sostegno\n1) Giunti trasversali in piatti e lamiere\n2) Giunti di anime e piattabande in travi composte eseguiti prima dell’assemblaggio\n3) Giunti trasversali completi di profili laminati, in assenza di lunette di scarico\n4) Giunti trasversali di lamiere e piatti con rastremazioni in larghezza e spessore con pendenza non maggiore di 1:4. Nelle zone di transizione gli intagli nelle saldature devono essere eliminati\nPer spessori t>25 mm, si deve adottare una classe ridotta del coefficiente\nk_s = (25/t)^0,2"),
            c("Saldature effettuate da entrambi i lati, molate in direzione degli sforzi e sottoposte a controlli non distruttivi\nLe saldature devono essere iniziate e terminate su tacchi d’estremità, da rimuovere una volta completata la saldatura\nI bordi esterni delle saldature devono essere molati in direzione degli sforzi\n3) Vale solo per profilati tagliati e risaldati"),
        ],
        [
            c("90"),
            c("Schemi 5, 6 e 7: saldature senza piatto di sostegno su piatti, lamiere e profili laminati."),
            c("Saldature senza piatto di sostegno\n5) Giunti trasversali in piatti e lamiere\n6) Giunti trasversali completi di profili laminati, in assenza di lunette di scarico\n7) Giunti trasversali di lamiere e piatti con rastremazioni in larghezza e spessore con pendenza non maggiore di 1:4.\nNelle zone di transizione gli intagli nelle saldature devono essere eliminati\nPer spessori t>25 mm, si deve adottare una classe ridotta del coefficiente\nk_s = (25/t)^0,2"),
            c("Saldature effettuate da entrambi i lati e sottoposte a controlli non distruttivi\nSovraspessore di saldatura non maggiore del 10% della larghezza del cordone, con zone di transizione regolari\nLe saldature devono essere iniziate e terminate su tacchi d’estremità, da rimuovere una volta completata la saldatura\nI bordi esterni delle saldature devono essere molati in direzione degli sforzi\nLe saldature dei dettagli 5) e 7) devono essere eseguite in piano"),
        ],
        [
            c("90"),
            c("Schema 8: giunto completo di profili laminati con lunette di scarico."),
            c("8) Come il dettaglio 3), ma con lunette di scarico\nPer spessori t>25 mm, si deve adottare una classe ridotta del coefficiente\nk_s = (25/t)^0,2"),
            c("Saldature effettuate da entrambi i lati, molate in direzione degli sforzi e sottoposte a controlli non distruttivi.\nLe saldature devono essere iniziate e terminate su tacchi d’estremità, da rimuovere una volta completata la saldatura\nI bordi esterni delle saldature devono essere molati in direzione degli sforzi\nI profili laminati devono avere le stesse dimensioni, senza differenze dovute a tolleranze"),
        ],
        [
            c("80"),
            c("Schemi 9, 10 e 11: saldature senza piatto di sostegno in travi composte, profili laminati, lamiere e piatti."),
            c("Saldature senza piatto di sostegno\n9) Giunti trasversali in travi composte, in assenza di lunette di scarico\n10) Giunti trasversali completi di profili laminati, in presenza di lunette di scarico\n11) Giunti trasversali di lamiere, piatti, profilati e travi composte\nPer spessori t>25 mm, si deve adottare una classe ridotta del coefficiente\nk_s = (25/t)^0,2"),
            c("Saldature effettuate da entrambi i lati, non molate e sottoposte a controlli non distruttivi.\nLe saldature devono essere iniziate e terminate su tacchi d’estremità, da rimuovere una volta completata la saldatura\nI bordi esterni delle saldature devono essere molati in direzione degli sforzi\nSovraspessore di saldatura non maggiore del 20% della larghezza del cordone, per i dettagli 9) e 11), o del 10% per il dettaglio 10, con zone di transizione regolari"),
        ],
        [
            c("63"),
            c("Schema 12: giunto trasversale completo di profili laminati, senza lunette di scarico."),
            c("12) Giunti trasversali completi di profili laminati, in assenza di lunette di scarico"),
            c("Saldature effettuate da entrambi i lati\nLe saldature devono essere iniziate e terminate su tacchi d’estremità, da rimuovere una volta completata la saldatura\nI bordi esterni delle saldature devono essere molati in direzione degli sforzi"),
        ],
        [
            c("71 (36)"),
            c("Schema 13: giunto trasversale a piena penetrazione eseguito da un solo lato."),
            c("13) Giunti trasversali a piena penetrazione eseguiti da un solo lato, con piena penetrazione controllata mediante opportuni controlli non distruttivi.\nPer spessori t>25 mm, si deve adottare una classe ridotta del coefficiente\nk_s = (25/t)^0,2\nIn assenza di controlli, si deve adottare la classe 36, per qualsiasi valore di t"),
            c("Saldature senza piatto di sostegno\nLe saldature devono essere iniziate e terminate su tacchi d’estremità, da rimuovere una volta completata la saldatura\nI bordi esterni delle saldature devono essere molati in direzione degli sforzi"),
        ],
        [
            c("71"),
            c("Schemi 14 e 15: saldature su piatto di sostegno in piatti e lamiere."),
            c("Saldature su piatto di sostegno\n14) Giunti trasversali in piatti e lamiere\n15) Giunti trasversali di lamiere e piatti con rastremazioni in larghezza e spessore con pendenza non maggiore di 1:4.\nVale anche per lamiere curve\nPer spessori t>25 mm, si deve adottare una classe ridotta del coefficiente\nk_s = (25/t)^0,2"),
            c("I cordoni d’angolo che fissano il piatto di sostegno devono terminare a più di 10 mm dai bordi dell’elemento e devono essere interni alla saldatura di testa"),
        ],
        [
            c("50"),
            c("Schema 16: saldatura su piatto di sostegno permanente con rastremazioni."),
            c("16) Saldature su piatto di sostegno permanente con rastremazioni in larghezza e spessore con pendenza non maggiore di 1:4.\nVale anche per lamiere curve\nPer spessori t>25 mm, si deve adottare una classe ridotta del coefficiente\nk_s = (25/t)^0,2"),
            c("Da adottarsi quando i cordoni d’angolo che fissano il piatto di sostegno terminano a meno di 10 mm dai bordi dell’elemento o quando non può essere garantito un buon accoppiamento"),
        ],
        [
            c("71"),
            c("Schema 17: saldatura trasversale tra elementi di spessore differente con assi allineati."),
            c("17) Saldature trasversali a piena penetrazione tra elementi di spessore differente con assi allineati\nPer spessori t₁>25 mm si deve adottare una classe ridotta del coefficiente\nk_s = (25/t₁)^0,2"),
            c("Nel caso di disassamento la classe deve essere ridotta con il coefficiente k_se = (1 + (6e/t₁)·(t₁^1,5/(t₁^1,5+t₂^1,5)))^-1, da combinare, eventualmente, con k_s, quando t₁>25 mm"),
        ],
    ],
    notes: [
        "I disegni interni della colonna «Dettaglio costruttivo» sono rappresentati mediante descrizioni strutturate.",
        "La tabella prosegue a pagina PDF 130 con i dettagli 12)–17).",
    ],
};

const tableXVId = tableId("C4.2.XV");
const tableXVRegion = reg(70, 520, 455, 275);

const tableXV = {
    id: tableXVId,
    unitId: uid(unitNumber),
    officialNumber: "C4.2.XV",
    pdfPage: 130,
    caption: "Dettagli costruttivi per attacchi e irrigiditori saldati (Δσ)",
    columnCount: 4,
    headers: [[c("Classe del dettaglio"), c("Dettaglio costruttivo"), c("Descrizione"), c("Requisiti")]],
    rows: [
        [
            c("80 (a)\n71 (b)\n63 (c)\n56 (d)"),
            c("Schema 1: attacco saldato longitudinale."),
            c("Attacchi saldati longitudinali\n1) La classe del dettaglio dipende dalla lunghezza dell'attacco\n(a) L ≤ 50 mm\n(b) 50 < L ≤ 80 mm\n(c) 80 < L ≤ 100 mm\n(d) L > 100 mm"),
            c("Spessore dell'attacco minore della sua altezza. In caso contrario vedi dettagli 5 e 6"),
        ],
        [
            c("71"),
            c("Schema 2: attacco saldato longitudinale a piatto o tubo."),
            c("2) Attacchi saldati longitudinali a piatti o tubi con L>100 m e α<45°"),
            c(""),
        ],
        [
            c("80"),
            c("Schema 3: fazzoletto d'attacco saldato con raccordo terminale di raggio r."),
            c("3) Fazzoletto d'attacco saldato a piatti o tubi con cordoni d'angolo longitudinali e dotati di raccordo di transizione terminale di raggio r.\nLa parte terminale dei cordoni deve essere rinforzata, cioè a piena penetrazione, per una lunghezza maggiore di r.\nr>150 mm"),
            c("Raccordo di transizione di raggio r realizzato con taglio meccanico o a gas realizzato prima della saldatura del fazzoletto. Al termine della saldatura, la parte terminale deve essere molata in direzione della freccia per eliminare completamente la punta della saldatura"),
        ],
        [
            c("90 (a)\n71 (b)\n50 (c)"),
            c("Schema 4: fazzoletto d'attacco saldato con raccordo di transizione di raggio r."),
            c("4) Fazzoletto d'attacco saldato a un lato di un piatto o della piattabanda di una trave e dotati di raccordo di transizione di raggio r.\nLa lunghezza L deve essere valutata come per i dettagli 1), 2) e 3).\nLa stessa classificazione può essere adottata anche per piattabande saldate dotate di raccordo di transizione di raggio r.\n(a) r ≥ L/3 o r >150 mm\n(b) L/3 > r ≥ L/6\n(c) r < L/6"),
            c("Raccordo di transizione di raggio r realizzato con taglio meccanico o a gas realizzato prima della saldatura del fazzoletto. Al termine della saldatura, la parte terminale deve essere molata in direzione della freccia per eliminare completamente la punta della saldatura"),
        ],
        [
            c("40"),
            c("Schema 5: attacco trasversale come saldato, senza raccordo di transizione."),
            c("5) Come saldato, senza raccordo di transizione"),
            c(""),
        ],
        [
            c("80 (a)\n71 (b)"),
            c("Schemi 6, 7 e 8: attacchi trasversali."),
            c("Attacchi trasversali\n6) Saldati a una piastra\n7) Nervature verticali saldate a un profilo o a una trave composta\n8) Diaframmi di travi a cassone composte, saldati all'anima o alla piattabanda\n(a) ℓ ≤ 50 mm\n(b) 50< ℓ ≤ 80 mm\nLe classi sono valide anche per nervature anulari"),
            c("6) e 7) Le parti terminali delle saldature devono essere molate accuratamente per eliminare tutte le rientranze presenti\n7) Se la nervatura termina nell'anima, Δσ deve essere calcolato usando le tensioni principali"),
        ],
        [
            c("80"),
            c("Schema 9: effetto della saldatura del piolo sul materiale base della piastra."),
            c("9) Effetto della saldatura del piolo sul materiale base della piastra"),
            c(""),
        ],
    ],
    notes: [
        "I disegni interni della colonna «Dettaglio costruttivo» sono rappresentati mediante descrizioni strutturate.",
        "La tabella prosegue a pagina PDF 131 con i dettagli 4)–9).",
    ],
};

const tableXVIaId = tableId("C4.2.XVI.a");
const tableXVIaRegion = reg(70, 300, 455, 400);

const tableXVIa = {
    id: tableXVIaId,
    unitId: uid(unitNumber),
    officialNumber: "C4.2.XVI.a",
    pdfPage: 131,
    caption: "Connessioni saldate direttamente sollecitate (Δσ)",
    columnCount: 4,
    headers: [[c("Classe del dettaglio"), c("Dettaglio costruttivo"), c("Descrizione"), c("Requisiti")]],
    rows: [
        [
            c("80 (a)\n71 (b)\n63 (c)\n56 (d)\n50 (e)\n45 (f)\n40 (g)"),
            c("Schemi 1 e 2: giunti a croce o a T."),
            c("Giunti a croce o a T\n1) Lesioni al piede della saldatura in giunti a piena penetrazione o a parziale penetrazione\n2) Lesione al piede della saldatura a partire dal bordo del piatto caricato, in presenza di picchi locali di tensione nelle parti terminali della saldatura dovuti alla deformabilità del pannello\n(a) ℓ ≤ 50 mm e t qualsiasi\n(b) 50< ℓ ≤ 80 mm e t qualsiasi\n(c) 80< ℓ ≤ 100 mm e t qualsiasi\n(d) 100< ℓ ≤ 120 mm e t qualsiasi\n(e) ℓ >120 mm e t ≤ 20 mm\n(e) 120< ℓ ≤ 200 mm e t >20 mm\n(e) ℓ >200 mm e 20<t ≤ 30 mm\n(f) 200< ℓ ≤ 300 mm e t >30 mm\n(f) ℓ >300 mm e 30<t ≤ 50 mm\n(g) ℓ >300 mm e t >50 mm"),
            c("1) Il giunto deve essere controllato: le discontinuità e i disallineamenti devono essere conformi alle tolleranze della UNI EN 1090\n2) Nel calcolo di Δσ si deve far riferimento al valore di picco delle tensioni, mediante un opportuno fattore di concentrazione degli sforzi k_f\n1) e 2) Il disallineamento dei piatti caricati non deve superare il 15% dello spessore della piastra intermedia"),
        ],
        [
            c("36*"),
            c("Schema 3: lesione alla radice della saldatura."),
            c("Giunti a croce o a T\n3) Lesione alla radice della saldatura in giunti a T a cordoni d'angolo, a parziale penetrazione e a parziale penetrazione equivalente alla piena penetrazione"),
            c("Nelle saldature a parziale penetrazione sono richieste due verifiche: la prima riguardo alle lesioni alla radice della saldatura deve essere riferita alla classe 36* per Δσ e alla classe 80 per Δτ, la seconda riguardo alle lesioni al piede della saldatura nel piatto caricato deve essere riferita alle classi dei dettagli 1 e 2 della presente tabella\nIl disallineamento dei piatti caricati non deve superare il 15% dello spessore della piastra intermedia"),
        ],
        [
            c("come dettaglio 1"),
            c("Schema 4: giunzione a sovrapposizione su piastra principale."),
            c("Giunzioni a sovrapposizione\n4) Giunzione a sovrapposizione a cordoni d'angolo (verifica della piastra principale)"),
            c("Δσ nella piastra principale deve essere calcolato considerando l'area indicata in figura (diffusione con pendenza 1:2)\nLe saldature devono terminare a più di 10 mm dal bordo della piastra.\nLe verifiche a fatica della saldatura per tensioni tangenziali devono essere effettuate in riferimento al dettaglio 8 (Tabella C4.2.XVI.b)"),
        ],
        [
            c("45*"),
            c("Schema 5: giunzione a sovrapposizione."),
            c("Giunzioni a sovrapposizione\n4) Giunzione a sovrapposizione a cordoni d'angolo (verifica degli elementi sovrapposti)"),
            c("Δσ è riferito agli elementi sovrapposti\nLe saldature devono terminare a più di 10 mm dal bordo della piastra.\nLe verifiche a fatica della saldatura per tensioni tangenziali devono essere effettuate in riferimento al dettaglio 8 (Tabella C4.2.XVI.b)"),
        ],
        [
            c("56* (a)\n50 (b)\n45 (c)\n40 (d)\n36 (e)"),
            c("Schema 6: coprigiunti di travi e travi composte."),
            c("Coprigiunti di travi e travi composte\n6) Zone terminali di coprigiunti saldati singoli o multipli, con o senza cordoni terminali trasversali\n(a) t_c≤t e t≤20 mm\n(b) t_c<t e 20<t≤30 mm\n(b) t_c≥t e t≤20 mm\n(c) t_c<t e 30<t≤50 mm\n(c) t_c≥t e 20<t≤30 mm\n(d) t_c<t e t>50 mm\n(d) t_c≥t e 30<t≤50 mm\n(e) t_c≥t e t>50 mm"),
            c("Se il coprigiunto è più largo della flangia occorre eseguire un cordone terminale trasversale, che deve essere accuratamente molato per eliminare le incisioni marginali\nLa lunghezza minima del coprigiunto è 300 mm"),
        ],
        [
            c("56"),
            c("Schema 7: coprigiunto con cordone terminale rinforzato."),
            c("Coprigiunti di travi e travi composte\n7) Zone terminali di coprigiunti saldati con cordone terminale rinforzato di lunghezza minima 5 t_c"),
            c("Cordone trasversale rinforzato molato e raccordato\nSe t_c>20 mm, il raccordo, di pendenza non maggiore di 1:4, deve essere esteso fino al bordo superiore del coprigiunto"),
        ],
    ],
    notes: [
        "I disegni interni della colonna «Dettaglio costruttivo» sono rappresentati mediante descrizioni strutturate.",
        "La tabella prosegue a pagina PDF 132 con i dettagli 3)–7).",
    ],
};

const tableXVIbId = tableId("C4.2.XVI.b");
const tableXVIbRegion = reg(70, 520, 455, 145);

const tableXVIb = {
    id: tableXVIbId,
    unitId: uid(unitNumber),
    officialNumber: "C4.2.XVI.b",
    pdfPage: 132,
    caption: "Connessioni saldate direttamente sollecitate (Δτ)",
    columnCount: 4,
    headers: [[c("Classe del dettaglio"), c("Dettaglio costruttivo"), c("Descrizione"), c("Requisiti")]],
    rows: [
        [
            c("80"),
            c("Schemi 8 e 9: cordoni d'angolo soggetti a sforzi di scorrimento e giunzioni a sovrapposizione."),
            c("8) Cordoni d'angolo continui soggetti a sforzi di scorrimento, quali quelli di composizione tra anima e piattabanda in travi composte saldate\n9) Giunzioni a sovrapposizione a cordoni d'angolo soggette a tensioni tangenziali"),
            c("8) Δτ deve essere calcolato in riferimento alla sezione di gola del cordone\n9) Δτ deve essere calcolato in riferimento alla sezione di gola del cordone, considerando la lunghezza totale del cordone, che deve terminare a più di 10 mm dal bordo della piastra"),
        ],
    ],
    notes: ["I disegni interni della colonna «Dettaglio costruttivo» sono rappresentati mediante descrizioni strutturate."],
};

const tableXVIIId = tableId("C4.2.XVII");
const tableXVIIRegion = reg(70, 650, 455, 140);

const tableXVII = {
    id: tableXVIIId,
    unitId: uid(unitNumber),
    officialNumber: "C4.2.XVII",
    pdfPage: 132,
    caption: "Dettagli costruttivi e resistenza a fatica per le vie di corsa di carriponte",
    columnCount: 4,
    headers: [[c("Classe del dettaglio"), c("Dettaglio costruttivo"), c("Descrizione"), c("Requisiti")]],
    rows: [
        [c("160"), c("Schema 1: sezione laminata ad I o H."), c("1) Sezioni laminate ad I o H"), c("La classe è relativa ai delta di compressione verticali Δσ_vert indotti nell'anima dai carichi ruota")],
        [c("71"), c("Schema 2: saldatura a piena penetrazione a T."), c("2) Saldatura a piena penetrazione a T"), c("La classe è relativa ai delta di compressione verticali Δσ_vert indotti nell'anima dai carichi ruota")],
        [c("36*"), c("Schema 3: saldatura a T a parziale penetrazione."), c("3) Saldatura a T a parziale penetrazione o a piena penetrazione equivalente a parziale penetrazione"), c("La classe è relativa ai delta di compressione verticali Δσ_vert indotti nella sezione di gola della saldatura dai carichi ruota")],
        [c("36*"), c("Schema 4: saldatura a cordone d'angolo."), c("4) Saldatura a cordone d'angolo"), c("La classe è relativa ai delta di compressione verticali Δσ_vert indotti nella sezione di gola della saldatura dai carichi ruota")],
        [c("71"), c("Schema 5: saldatura a T a piena penetrazione tra anima e piattabanda."), c("5) Saldatura a T a piena penetrazione tra anima e piattabanda a T"), c("La classe è relativa ai delta di compressione verticali Δσ_vert indotti nell'anima dai carichi ruota")],
        [c("36*"), c("Schema 6: saldatura a T a parziale penetrazione tra anima e piattabanda."), c("6) Saldatura a T a parziale penetrazione o a piena penetrazione equivalente a parziale penetrazione tra anima e piattabanda a T"), c("La classe è relativa ai delta di compressione verticali Δσ_vert indotti nella sezione di gola della saldatura dai carichi ruota")],
        [c("36*"), c("Schema 7: saldatura a T a cordoni d'angolo tra anima e piattabanda."), c("7) Saldatura a T a cordoni d'angolo tra anima e piattabanda a T"), c("La classe è relativa ai delta di compressione verticali Δσ_vert indotti nella saldatura dai carichi ruota")],
    ],
    notes: [
        "I disegni interni della colonna «Dettaglio costruttivo» sono rappresentati mediante descrizioni strutturate.",
        "La tabella prosegue a pagina PDF 133 con i dettagli 2)–7).",
    ],
};

const blocks: GeneratedBlock[] = [
    block("heading", "heading", 125, "C4.2.4.1.4.3. Curve S-N", [text("C4.2.4.1.4.3. Curve S-N")], reg(73.9, 260, 450, 25), true),
    block("p1", "paragraph", 125, "La resistenza a fatica di un dettaglio è individuata nel piano bilogaritmico log(Δσ)-log(N) o log(Δτ)-log(N), essendo N il numero di cicli a rottura, mediante una curva caratteristica, detta curva S-N. Detta curva, è individuata mediante la classe di resistenza a fatica Δσ_C o Δτ_C, che rappresenta la resistenza a fatica del dettaglio, espressa in MPa, per N=2·10^6 cicli.", [text("La resistenza a fatica di un dettaglio è individuata nel piano bilogaritmico "), math("log(Δσ)-log(N)", "\\log(\\Delta\\sigma)-\\log(N)"), text(" o "), math("log(Δτ)-log(N)", "\\log(\\Delta\\tau)-\\log(N)"), text(", essendo "), math("N", "N"), text(" il numero di cicli a rottura, mediante una curva caratteristica, detta curva S-N. Detta curva, è individuata mediante la classe di resistenza a fatica "), math("Δσ_C", "\\Delta\\sigma_C"), text(" o "), math("Δτ_C", "\\Delta\\tau_C"), text(", che rappresenta la resistenza a fatica del dettaglio, espressa in MPa, per "), math("N=2·10^6", "N=2\\cdot10^6"), text(" cicli.")], reg(73.9, 280, 450, 80), true),
    block("p2", "paragraph", 125, "Le curve S-N per tensioni normali sono caratterizzate, oltre che dalla classe Δσ_C, dal limite di fatica ad ampiezza costante Δσ_D, corrispondente a N=5·10^6 cicli e dal limite per i calcoli di fatica, Δσ_L, che corrisponde all’intersezione del secondo ramo della curva con la verticale per N=10^8 cicli.", [text("Le curve S-N per tensioni normali sono caratterizzate, oltre che dalla classe "), math("Δσ_C", "\\Delta\\sigma_C"), text(", dal limite di fatica ad ampiezza costante "), math("Δσ_D", "\\Delta\\sigma_D"), text(", corrispondente a "), math("N=5·10^6", "N=5\\cdot10^6"), text(" cicli e dal limite per i calcoli di fatica, "), math("Δσ_L", "\\Delta\\sigma_L"), text(", che corrisponde all’intersezione del secondo ramo della curva con la verticale per "), math("N=10^8", "N=10^8"), text(" cicli.")], reg(73.9, 330, 450, 45), true),
    block("p3", "paragraph", 125, "L’equazione della curva S-N è", [text("L’equazione della curva S-N è")], reg(73.9, 375, 450, 20), true),
    formulaBlock("formula-94", formula94),
    block("p4", "paragraph", 125, "dove m=3, cosicché risulta", [text("dove "), math("m=3", "m=3"), text(", cosicché risulta")], reg(73.9, 500, 450, 20), true),
    formulaBlock("formula-95", formula95),
    block("p5", "paragraph", 125, "Le curve S-N per tensioni normali sono rappresentate in Figura C4.2.21.", [text("Le curve S-N per tensioni normali sono rappresentate in Figura C4.2.21.")], reg(73.9, 515, 450, 20), true),
    figureBlock("figure-21", figure21, 125, "Figura C4.2.21 - Curve S-N per dettagli/elementi soggetti a tensioni normali", figure21Region),
    block("p6", "paragraph", 126, "Le classi di resistenza a fatica per tensioni normali relative a i dettagli più comuni sono riportate nella Tabelle C4.2.XII.a, C4.2.XII.d, C4.2.XIII, C4.2.XIV, C4.2.XV e C4.2.XVI.a, mentre in Tabella C4.2.XVII sono riportate le classi dei dettagli tipici dei carriponte. Nelle tabelle le classi relative ad alcuni dettagli sono contrassegnate con un asterisco: per questi dettagli è possibile adottare una classificazione superiore di una classe, se si assume come resistenza a fatica ad ampiezza costante quella corrispondente a 10^7 cicli (vedi Figura C4.2.22).", [text("Le classi di resistenza a fatica per tensioni normali relative a i dettagli più comuni sono riportate nella Tabelle C4.2.XII.a, C4.2.XII.d, C4.2.XIII, C4.2.XIV, C4.2.XV e C4.2.XVI.a, mentre in Tabella C4.2.XVII sono riportate le classi dei dettagli tipici dei carriponte. Nelle tabelle le classi relative ad alcuni dettagli sono contrassegnate con un asterisco: per questi dettagli è possibile adottare una classificazione superiore di una classe, se si assume come resistenza a fatica ad ampiezza costante quella corrispondente a "), math("10^7", "10^7"), text(" cicli (vedi Figura C4.2.22).")], reg(73.9, 75, 450, 70)),
    figureBlock("figure-22", figure22, 126, "Figura C4.2.22 – Classificazione alternativa Δσ_C per dettagli classificati come Δσ_C^*", figure22Region),
    block("p7", "paragraph", 126, "Le curve S-N per tensioni tangenziali sono rappresentate in Figura C4.2.23.", [text("Le curve S-N per tensioni tangenziali sono rappresentate in Figura C4.2.23.")], reg(73.9, 315, 450, 20)),
    block("p8", "paragraph", 126, "Le curve S-N per tensioni tangenziali sono caratterizzate, oltre che dalla classe Δτ_C, dal limite per i calcoli di fatica, Δτ_L, corrispondente a N=10^8 cicli. L’equazione della curva S-N è", [text("Le curve S-N per tensioni tangenziali sono caratterizzate, oltre che dalla classe "), math("Δτ_C", "\\Delta\\tau_C"), text(", dal limite per i calcoli di fatica, "), math("Δτ_L", "\\Delta\\tau_L"), text(", corrispondente a "), math("N=10^8", "N=10^8"), text(" cicli. L’equazione della curva S-N è")], reg(73.9, 335, 450, 35)),
    formulaBlock("formula-96", formula96),
    block("p9", "paragraph", 126, "dove m=5, cosicché risulta", [text("dove "), math("m=5", "m=5"), text(", cosicché risulta")], reg(73.9, 430, 450, 20)),
    formulaBlock("formula-97", formula97),
    block("p10", "paragraph", 126, "Le classi di resistenza a fatica per tensioni tangenziali relative ai dettagli più comuni sono riportate nella Tabelle C4.2.XII.b, C4.2.XII.c e C4.2.XVI.b.", [text("Le classi di resistenza a fatica per tensioni tangenziali relative ai dettagli più comuni sono riportate nella Tabelle C4.2.XII.b, C4.2.XII.c e C4.2.XVI.b.")], reg(73.9, 450, 450, 30)),
    figureBlock("figure-23", figure23, 126, "Figura C4.2.23 - Curve S-N per dettagli/elementi soggetti a tensioni tangenziali", figure23Region),
    block("p11", "paragraph", 126, "Per la resistenza dei dettagli costruttivi tipici degli impalcati a piastra ortotropa, si può far riferimento al documento UNI EN 1993-1-9.", [text("Per la resistenza dei dettagli costruttivi tipici degli impalcati a piastra ortotropa, si può far riferimento al documento UNI EN 1993-1-9.")], reg(73.9, 690, 450, 25)),
    tableBlock("table-xii-a", tableXIIaId, 127, "Tabella C4.2.XII.a - Dettagli costruttivi per prodotti laminati e estrusi e loro classificazione (Δσ)", tableXIIaRegion),
    tableBlock("table-xii-b", tableXIIbId, 127, "Tabella C4.2.XII.b - Dettagli costruttivi per prodotti laminati e estrusi e loro classificazione (Δτ)", tableXIIbRegion),
    tableBlock("table-xii-c", tableXIIcId, 127, "Tabella C4.2.XII.c - Bulloni sollecitati a taglio (Δτ)", tableXIIcRegion),
    tableBlock("table-xii-d", tableXIIdId, 127, "Tabella C4.2.XII.d - Dettagli costruttivi per giunti chiodati o bullonati (Δσ)", tableXIIdRegion),
    tableBlock("table-xiii", tableXIIIId, 128, "Tabella C4.2.XIII - Dettagli costruttivi per sezioni saldate (Δσ)", tableXIIIRegion),
    tableBlock("table-xiv", tableXIVId, 129, "Tabella C4.2.XIV - Dettagli costruttivi per saldature a piena penetrazione (Δσ)", tableXIVRegion),
    tableBlock("table-xv", tableXVId, 130, "Tabella C4.2.XV - Dettagli costruttivi per attacchi e irrigiditori saldati (Δσ)", tableXVRegion),
    tableBlock("table-xvi-a", tableXVIaId, 131, "Tabella C4.2.XVI.a - Connessioni saldate direttamente sollecitate (Δσ)", tableXVIaRegion),
    tableBlock("table-xvi-b", tableXVIbId, 132, "Tabella C4.2.XVI.b - Connessioni saldate direttamente sollecitate (Δτ)", tableXVIbRegion),
    tableBlock("table-xvii", tableXVIIId, 132, "Tabella C4.2.XVII - Dettagli costruttivi e resistenza a fatica per le vie di corsa di carriponte", tableXVIIRegion),
];

const parent = uid("C4.2.4.1.4");
const unit = {
    $schema: "urn:structural-codes:schema:canonical-unit:v2",
    schemaVersion: "2.0.0-alpha.2",
    recordType: "canonical-unit",
    id: uid(unitNumber),
    workId,
    expressionId,
    kind: "subparagraph",
    numbering: { official: unitNumber, sortKey: unitNumber.replace(/^C/, "").split(".").map((part) => part.padStart(3, "0")).join(".") },
    title: "Curve S-N",
    titleBlockId: `${uid(unitNumber)}#block-heading`,
    hierarchy: { parentId: parent, ancestorIds: [uid("C4.2"), uid("C4.2.4"), uid("C4.2.4.1"), parent], position: 3 },
    validity: { from: null, to: null, status: "unknown", asOf: "2026-08-09" },
    blocks,
    citations: [],
    relations: [],
    assets: { formulaIds: [formula94, formula95, formula96, formula97].map((row) => formulaId(row.number)), tableIds: [tableXIIaId, tableXIIbId, tableXIIcId, tableXIIdId, tableXIIIId, tableXIVId, tableXVId, tableXVIaId, tableXVIbId, tableXVIIId], figureIds: [figure21, figure22, figure23] },
    workflow: {
        status: "extracted",
        createdBy: { actorId: "codex:circ42-step2o", kind: "automated-agent", toolVersion: profile },
        createdAt,
        reviews: [],
        openIssues: [
            { issueId: "circ2019-C4-2-4-1-4-3-source-review", type: "normalization-review", severity: "blocking", note: "Record trascritto dall’evidence ufficiale ma non ancora confrontato integralmente da un revisore umano con i render delle pagine fonte." },
            { issueId: "circ2019-C4-2-4-1-4-3-assets-review", type: "asset-review", severity: "blocking", note: "Le Tabelle C4.2.XII.a–d e C4.2.XIII–XVII, le figure C4.2.21–C4.2.23 e i gruppi di formule C4.2.94–C4.2.97 richiedono revisione umana indipendente." },
        ],
    },
};

const manifest = {
    $schema: "urn:structural-codes:schema:asset-manifest:v2",
    schemaVersion: "2.0.0-alpha.1",
    recordType: "asset-manifest",
    document: "circ2019",
    section: "C4.2-step2o",
    sourceId,
    status: "transcribed-unreviewed",
    formulas: [formula94, formula95, formula96, formula97].map((row) => ({ id: formulaId(row.number), unitId: uid(unitNumber), officialNumber: row.number, pdfPage: row.page, latex: row.latex })),
    tables: [tableXIIa, tableXIIb, tableXIIc, tableXIId, tableXIII, tableXIV, tableXV, tableXVIa, tableXVIb, tableXVII],
    figures: [
        { id: figure21, unitId: uid(unitNumber), officialNumber: "C4.2.21", pdfPage: 125, caption: "Figura C4.2.21 - Curve S-N per dettagli/elementi soggetti a tensioni normali", alt: "Curve S-N per dettagli ed elementi soggetti a tensioni normali", imagePath: "figures/circ2019/figc4.2.21.png", region: figure21Region, sha256: "38bc3bd9721ad9a5f710058cf50bebe30560d87160901eb6155a4df533a82c3a" },
        { id: figure22, unitId: uid(unitNumber), officialNumber: "C4.2.22", pdfPage: 126, caption: "Figura C4.2.22 – Classificazione alternativa Δσ_C per dettagli classificati come Δσ_C^*", alt: "Classificazione alternativa della resistenza a fatica per dettagli con asterisco", imagePath: "figures/circ2019/figc4.2.22.png", region: figure22Region, sha256: "64f7b2b7ed43fcebb39fe8bded79cf93210d02ac409911d1a3ade3d6fee7cf8d" },
        { id: figure23, unitId: uid(unitNumber), officialNumber: "C4.2.23", pdfPage: 126, caption: "Figura C4.2.23 - Curve S-N per dettagli/elementi soggetti a tensioni tangenziali", alt: "Curve S-N per dettagli ed elementi soggetti a tensioni tangenziali", imagePath: "figures/circ2019/figc4.2.23.png", region: figure23Region, sha256: "c6dcc9a54a3c1e6586169bd9bed45a0fdc97af7dfe9a9b8abe7555e545bd6ac4" },
    ],
};

await mkdir(unitDirectory, { recursive: true });
await mkdir(assetDirectory, { recursive: true });
await mkdir(figureDirectory, { recursive: true });
await Promise.all([
    copyFile(join(evidenceRenderDirectory, "page-0125-x135-y510-w330-h225@4x.png"), join(figureDirectory, "figc4.2.21.png")),
    copyFile(join(evidenceRenderDirectory, "page-0126-x145-y155-w310-h160@4x.png"), join(figureDirectory, "figc4.2.22.png")),
    copyFile(join(evidenceRenderDirectory, "page-0126-x170-y470-w300-h205@4x.png"), join(figureDirectory, "figc4.2.23.png")),
    writeFile(join(unitDirectory, `${unitNumber.toLowerCase()}.json`), `${JSON.stringify(unit, null, 2)}\n`, "utf8"),
    writeFile(join(assetDirectory, "C4.2-step2o.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8"),
]);
console.log("Circolare C4.2 step2o: generate 1 unità, 4 gruppi di formule e 3 figure.");
