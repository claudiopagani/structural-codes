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
const unitNumber = "C4.2.4.1.4.2";

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
const reg = (x: number, y: number, width: number, height: number): Region => ({ coordinateSystem: "pdf-points-top-left", x, y, width, height });
const text = (value: string): Inline => ({ kind: "text", value });
const math = (value: string, latex: string): Inline => ({ kind: "math", value, latex });
const hash = (value: string) => sha256OfText(value);

function evidence(page: number, raw: string, normalized: string, region: Region, manual = false) {
    return {
        sourceId,
        pdfPage: page,
        printedPage: String(page - 4),
        region,
        extraction: { method: manual ? "manual-transcription" : "pdf-text", tool: manual ? "codex-source-transcription" : "pdfjs-dist", toolVersion: manual ? profile : "4.10.38" },
        transformations: [
            { operation: "join-line-wrap", ruleVersion: profile, note: "Ricomposte le righe tipografiche appartenenti allo stesso capoverso o voce di elenco; le continuazioni di pagina restano nello stesso blocco logico." },
            ...(raw !== normalized ? [{ operation: "manual-correction", ruleVersion: profile, note: "Ripristinati accenti, apostrofi, simboli e notazione matematica confrontati con il render ufficiale." }] : []),
            { operation: "unicode-nfc", ruleVersion: profile, note: "Testo normalizzato in Unicode NFC." },
        ],
        rawSha256: hash(raw),
        normalizedSha256: hash(normalized),
    };
}

function block(suffix: string, kind: "heading" | "paragraph" | "list-item", page: number, normalized: string, inline: Inline[], region: Region): GeneratedBlock {
    return { blockId: `${uid(unitNumber)}#block-${suffix}`, kind, origin: "official", text: { raw: normalized, normalized, normalizationVersion: profile, inline }, evidence: evidence(page, normalized, normalized, region) };
}

function formulaBlock(suffix: string, formula: FormulaRow): GeneratedBlock {
    return { blockId: `${uid(unitNumber)}#block-${suffix}`, kind: "formula-ref", origin: "official", assetId: formulaId(formula.number), evidence: evidence(formula.page, formula.raw, formula.raw, formula.region, true) };
}

function figureBlock(suffix: string, asset: string, page: number, caption: string, region: Region): GeneratedBlock {
    return { blockId: `${uid(unitNumber)}#block-${suffix}`, kind: "figure-ref", origin: "official", assetId: asset, evidence: evidence(page, caption, caption, region, true) };
}

const formula93: FormulaRow = {
    number: "C4.2.93",
    page: 125,
    latex: "\\Delta\\sigma_{i,d}=\\gamma_{Mf}\\Delta\\sigma_i",
    raw: "Δσ_i,d = γ_Mf Δσ_i [C4.2.93]",
    region: reg(145, 225, 325, 40),
};
const figure19 = figureId("C4.2.19");
const figure20 = figureId("C4.2.20");
const figure19Region = reg(170, 175, 270, 155);
const figure20Region = reg(170, 505, 270, 140);

const blocks: GeneratedBlock[] = [
    block("heading", "heading", 123, "C4.2.4.1.4.2. Spettri di tensione e metodi di conteggio", [text("C4.2.4.1.4.2. Spettri di tensione e metodi di conteggio")], reg(73.9, 690, 450, 25)),
    block("p1", "paragraph", 123, "Gli spettri di tensione debbono essere ricavati analizzando gli oscillogrammi di tensione σ(t), indotti nel dettaglio considerato dalle azioni dello spettro di carico assegnato, con opportuni metodi di identificazione e di conteggio. Per le strutture civili si possono impiegare, in alternativa, il metodo del serbatoio (reservoir method) o il metodo del flusso di pioggia (rainflow method). Per singole strutture, ad esempio strutture offshore ecc., anche in considerazione della particolare tipologia dello spettro di carico cui sono soggette, si può far ricorso a metodi di conteggio alternativi, previa adeguata giustificazione.", [text("Gli spettri di tensione debbono essere ricavati analizzando gli oscillogrammi di tensione "), math("σ(t)", "\\sigma(t)"), text(", indotti nel dettaglio considerato dalle azioni dello spettro di carico assegnato, con opportuni metodi di identificazione e di conteggio. Per le strutture civili si possono impiegare, in alternativa, il metodo del serbatoio (reservoir method) o il metodo del flusso di pioggia (rainflow method). Per singole strutture, ad esempio strutture offshore ecc., anche in considerazione della particolare tipologia dello spettro di carico cui sono soggette, si può far ricorso a metodi di conteggio alternativi, previa adeguata giustificazione.")], reg(73.9, 700, 450, 45)),
    block("p2", "paragraph", 124, "Nel metodo del serbatoio (Figura C4.2.19) si ipotizza che l’oscillogramma delle tensioni rappresenti il profilo di fondo di un serbatoio pieno di liquido, i cui paramenti esterni sono costituiti dal tratto convergente verso il massimo assoluto e da un tratto corrispondente, reale o fittizio. posto al termine del diagramma stesso.", [text("Nel metodo del serbatoio (Figura C4.2.19) si ipotizza che l’oscillogramma delle tensioni rappresenti il profilo di fondo di un serbatoio pieno di liquido, i cui paramenti esterni sono costituiti dal tratto convergente verso il massimo assoluto e da un tratto corrispondente, reale o fittizio. posto al termine del diagramma stesso.")], reg(73.9, 140, 450, 35)),
    figureBlock("figure-19", figure19, 124, "Figura C4.2.19 - Metodo del serbatoio", figure19Region),
    block("p3", "paragraph", 124, "In riferimento alla Figura C4.2.19, si immagina di svuotare il serbatoio a partire dal minimo assoluto, punto 1 di figura, al vuoto che si forma corrisponde il primo ciclo ed alla differenza di quota tra 1 ed il pelo libero originario il delta di tensione relativo; al termine di questa operazione si formano altri bacini, semplici (2’22”) o multipli (3’35’53”) e (4’66”44”). L’operazione si ripete procedendo a svuotare in successione dagli altri punti di minimo relativo, ordinati in senso crescente, σ_i<σ_i+1, fino a svuotare l’intero serbatoio; ad ogni operazione di svuotamento corrisponde un ciclo, il cui delta di tensione è pari all’altezza d’acqua svuotata.", [text("In riferimento alla Figura C4.2.19, si immagina di svuotare il serbatoio a partire dal minimo assoluto, punto 1 di figura, al vuoto che si forma corrisponde il primo ciclo ed alla differenza di quota tra 1 ed il pelo libero originario il delta di tensione relativo; al termine di questa operazione si formano altri bacini, semplici (2’22”) o multipli (3’35’53”) e (4’66”44”). L’operazione si ripete procedendo a svuotare in successione dagli altri punti di minimo relativo, ordinati in senso crescente, "), math("σ_i<σ_i+1", "\\sigma_i<\\sigma_{i+1}"), text(", fino a svuotare l’intero serbatoio; ad ogni operazione di svuotamento corrisponde un ciclo, il cui delta di tensione è pari all’altezza d’acqua svuotata.")], reg(73.9, 330, 450, 60)),
    block("p4", "paragraph", 124, "Il metodo del flusso di pioggia, meno intuitivo ed abbastanza complesso dal punto di vista operativo, individua i cicli mediante il flusso di una goccia d’acqua che scorre sulla traiettoria, immaginato verticale l’asse dei tempi (Figura C4.2.20). Si procede alternativamente da un massimo locale e da un minimo locale, curando che i massimi siano ordinati in senso decrescente e i minimi in senso crescente. Ogni volta che la goccia si distacca dalla traiettoria e cade o incontra un tratto già bagnato viene inizializzato un nuovo semiciclo, in modo che ciascun tratto dell’oscillogramma venga percorso una sola volta. I semicicli di uguale ampiezza vengono poi accoppiati sì da individuare i cicli.", [text("Il metodo del flusso di pioggia, meno intuitivo ed abbastanza complesso dal punto di vista operativo, individua i cicli mediante il flusso di una goccia d’acqua che scorre sulla traiettoria, immaginato verticale l’asse dei tempi (Figura C4.2.20). Si procede alternativamente da un massimo locale e da un minimo locale, curando che i massimi siano ordinati in senso decrescente e i minimi in senso crescente. Ogni volta che la goccia si distacca dalla traiettoria e cade o incontra un tratto già bagnato viene inizializzato un nuovo semiciclo, in modo che ciascun tratto dell’oscillogramma venga percorso una sola volta. I semicicli di uguale ampiezza vengono poi accoppiati sì da individuare i cicli.")], reg(73.9, 398, 450, 55)),
    figureBlock("figure-20", figure20, 124, "Figura C4.2.20 - Metodo del flusso di pioggia", figure20Region),
    block("p5", "paragraph", 124, "Con riferimento alla Figura C4.2.20 e dopo aver spostato il tratto 0-1 alla fine dell’oscillogramma:", [text("Con riferimento alla Figura C4.2.20 e dopo aver spostato il tratto 0-1 alla fine dell’oscillogramma:")], reg(73.9, 460, 340, 15)),
    block("item-1", "list-item", 124, "la prima goccia viene rilasciata dal punto 1, che rappresenta il massimo assoluto del diagramma, percorre il tratto 1-2-2’-6 e cade individuando un semiciclo di ampiezza Δσ_1=σ_1−σ_6;", [text("la prima goccia viene rilasciata dal punto 1, che rappresenta il massimo assoluto del diagramma, percorre il tratto 1-2-2’-6 e cade individuando un semiciclo di ampiezza "), math("Δσ_1=σ_1−σ_6", "\\Delta\\sigma_1=\\sigma_1-\\sigma_6"), text(";")], reg(73.9, 477, 450, 35)),
    block("item-2", "list-item", 124, "la seconda goccia viene rilasciata dal punto 6, che rappresenta il minimo assoluto del diagramma, percorre il tratto 6-7-7’-11-11’-14 e cade individuando un semiciclo di ampiezza Δσ_1=σ_14−σ_6 (σ_14=σ_1);", [text("la seconda goccia viene rilasciata dal punto 6, che rappresenta il minimo assoluto del diagramma, percorre il tratto 6-7-7’-11-11’-14 e cade individuando un semiciclo di ampiezza "), math("Δσ_1=σ_14−σ_6 (σ_14=σ_1)", "\\Delta\\sigma_1=\\sigma_{14}-\\sigma_6\\; (\\sigma_{14}=\\sigma_1)"), text(";")], reg(73.9, 648, 450, 35)),
    block("item-3", "list-item", 124, "la terza goccia viene rilasciata dal punto 11, che rappresenta il secondo massimo locale del diagramma, percorre il tratto 11-12 e cade individuando un semiciclo di ampiezza Δσ_2=σ_11−σ_12;", [text("la terza goccia viene rilasciata dal punto 11, che rappresenta il secondo massimo locale del diagramma, percorre il tratto 11-12 e cade individuando un semiciclo di ampiezza "), math("Δσ_2=σ_11−σ_12", "\\Delta\\sigma_2=\\sigma_{11}-\\sigma_{12}"), text(";")], reg(73.9, 673, 450, 25)),
    block("item-4", "list-item", 124, "la quarta goccia viene rilasciata dal punto 12, che rappresenta il secondo minimo locale del diagramma, percorre il tratto 12-11’, incontra il tratto 11’-14, che è già bagnato, e si arresta individuando un semiciclo di ampiezza Δσ_2=σ_11−σ_12 (σ_11=σ_11’);", [text("la quarta goccia viene rilasciata dal punto 12, che rappresenta il secondo minimo locale del diagramma, percorre il tratto 12-11’, incontra il tratto 11’-14, che è già bagnato, e si arresta individuando un semiciclo di ampiezza "), math("Δσ_2=σ_11−σ_12 (σ_11=σ_11’)", "\\Delta\\sigma_2=\\sigma_{11}-\\sigma_{12}\\; (\\sigma_{11}=\\sigma_{11'})"), text(";")], reg(73.9, 698, 450, 45)),
    block("item-5", "list-item", 125, "la quinta goccia viene rilasciata dal punto 7, che rappresenta il terzo massimo locale del diagramma, percorre il tratto 7-8-8’-10-10’ e si arresta perché incontra il tratto 10’-12, già bagnato, individuando un semiciclo di ampiezza Δσ_3=σ_7−σ_10 (σ_10=σ_10’);", [text("la quinta goccia viene rilasciata dal punto 7, che rappresenta il terzo massimo locale del diagramma, percorre il tratto 7-8-8’-10-10’ e si arresta perché incontra il tratto 10’-12, già bagnato, individuando un semiciclo di ampiezza "), math("Δσ_3=σ_7−σ_10 (σ_10=σ_10’)", "\\Delta\\sigma_3=\\sigma_7-\\sigma_{10}\\; (\\sigma_{10}=\\sigma_{10'})"), text(";")], reg(73.9, 95, 450, 35)),
    block("item-6", "list-item", 125, "la sesta goccia viene rilasciata dal punto 2, che rappresenta il terzo minimo locale del diagramma, percorre il tratto 2-3-3’-5-5’ e si arresta perché incontra il tratto 5’-7, già bagnato, individuando un semiciclo di ampiezza Δσ_4=σ_5−σ_2;", [text("la sesta goccia viene rilasciata dal punto 2, che rappresenta il terzo minimo locale del diagramma, percorre il tratto 2-3-3’-5-5’ e si arresta perché incontra il tratto 5’-7, già bagnato, individuando un semiciclo di ampiezza "), math("Δσ_4=σ_5−σ_2", "\\Delta\\sigma_4=\\sigma_5-\\sigma_2"), text(";")], reg(73.9, 145, 450, 35)),
    block("item-7", "list-item", 125, "si ripete quindi il procedimento finché tutto l’oscillogramma non è bagnato.", [text("si ripete quindi il procedimento finché tutto l’oscillogramma non è bagnato.")], reg(73.9, 185, 450, 20)),
    block("p6", "paragraph", 125, "Rispetto al metodo del serbatoio, il metodo del flusso di pioggia ha il vantaggio di poter essere più facilmente implementato su calcolatore.", [text("Rispetto al metodo del serbatoio, il metodo del flusso di pioggia ha il vantaggio di poter essere più facilmente implementato su calcolatore.")], reg(73.9, 205, 450, 25)),
    block("p7", "paragraph", 125, "Nella verifica si impiegheranno i delta di tensione di calcolo Δσ_i,d ricavati moltiplicando i delta di tensione dello spettro Δσ_i per il coefficiente parziale di sicurezza per le verifiche a fatica γ_Mf definito nella Tabella 4.2. XI delle NTC", [text("Nella verifica si impiegheranno i delta di tensione di calcolo "), math("Δσ_i,d", "\\Delta\\sigma_{i,d}"), text(" ricavati moltiplicando i delta di tensione dello spettro "), math("Δσ_i", "\\Delta\\sigma_i"), text(" per il coefficiente parziale di sicurezza per le verifiche a fatica "), math("γ_Mf", "\\gamma_{Mf}"), text(" definito nella Tabella 4.2. XI delle NTC")], reg(73.9, 235, 450, 35)),
    formulaBlock("formula-93", formula93),
    block("p8", "paragraph", 125, "e la curva caratteristica S-N di resistenza a fatica del dettaglio, individuata mediante la classe Δσ_C anch’essa definita nel seguito.", [text("e la curva caratteristica S-N di resistenza a fatica del dettaglio, individuata mediante la classe "), math("Δσ_C", "\\Delta\\sigma_C"), text(" anch’essa definita nel seguito.")], reg(73.9, 285, 450, 20)),
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
    title: "Spettri di tensione e metodi di conteggio",
    titleBlockId: `${uid(unitNumber)}#block-heading`,
    hierarchy: { parentId: parent, ancestorIds: [uid("C4.2"), uid("C4.2.4"), uid("C4.2.4.1"), parent], position: 2 },
    validity: { from: null, to: null, status: "unknown", asOf: "2026-08-09" },
    blocks,
    citations: [],
    relations: [],
    assets: { formulaIds: [formulaId(formula93.number)], tableIds: [], figureIds: [figure19, figure20] },
    workflow: {
        status: "extracted",
        createdBy: { actorId: "codex:circ42-step2n", kind: "automated-agent", toolVersion: profile },
        createdAt,
        reviews: [],
        openIssues: [
            { issueId: "circ2019-C4-2-4-1-4-2-source-review", type: "normalization-review", severity: "blocking", note: "Record trascritto dall’evidence ufficiale ma non ancora confrontato integralmente da un revisore umano con i render delle pagine fonte." },
            { issueId: "circ2019-C4-2-4-1-4-2-assets-review", type: "asset-review", severity: "blocking", note: "Le figure C4.2.19–C4.2.20 e la formula C4.2.93 sono ritagli/trascrizioni dalla fonte e richiedono revisione umana indipendente." },
        ],
    },
};

const manifest = {
    $schema: "urn:structural-codes:schema:asset-manifest:v2",
    schemaVersion: "2.0.0-alpha.1",
    recordType: "asset-manifest",
    document: "circ2019",
    section: "C4.2-step2n",
    sourceId,
    status: "transcribed-unreviewed",
    formulas: [{ id: formulaId(formula93.number), unitId: uid(unitNumber), officialNumber: formula93.number, pdfPage: formula93.page, latex: formula93.latex }],
    tables: [],
    figures: [
        { id: figure19, unitId: uid(unitNumber), officialNumber: "C4.2.19", pdfPage: 124, caption: "Figura C4.2.19 - Metodo del serbatoio", alt: "Oscillogramma rappresentato come profilo di fondo di un serbatoio per il conteggio dei cicli", imagePath: "figures/circ2019/figc4.2.19.png", region: figure19Region, sha256: "f599fb4e6751d0b4b5cf51e7eaa4348807e562f1ade905915b24d5f813063fe4" },
        { id: figure20, unitId: uid(unitNumber), officialNumber: "C4.2.20", pdfPage: 124, caption: "Figura C4.2.20 - Metodo del flusso di pioggia", alt: "Oscillogramma con traiettoria e gocce per il metodo del flusso di pioggia", imagePath: "figures/circ2019/figc4.2.20.png", region: figure20Region, sha256: "7c0b267275b0539b57adaed581cba38b7f90c591eec044a28ebe49db87a32c9c" },
    ],
};

await mkdir(unitDirectory, { recursive: true });
await mkdir(assetDirectory, { recursive: true });
await mkdir(figureDirectory, { recursive: true });
await Promise.all([
    copyFile(join(evidenceRenderDirectory, "page-0124-x170-y175-w270-h155@4x.png"), join(figureDirectory, "figc4.2.19.png")),
    copyFile(join(evidenceRenderDirectory, "page-0124-x170-y505-w270-h140@4x.png"), join(figureDirectory, "figc4.2.20.png")),
    writeFile(join(unitDirectory, `${unitNumber.toLowerCase()}.json`), `${JSON.stringify(unit, null, 2)}\n`, "utf8"),
    writeFile(join(assetDirectory, "C4.2-step2n.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8"),
]);
console.log("Circolare C4.2 step2n: generate 1 unità, 1 formula e 2 figure.");
