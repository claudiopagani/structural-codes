import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const sourceId = "circ-7-2019";
const workId = "it-mit:circ:2019-01-21:7-csllpp";
const expressionId = "it-mit:circ:2019-01-21:7-csllpp:original-it";
const profile = "circ45-editorial-profile-0.1.0";
const createdAt = "2026-08-09T00:00:00Z";
const evidenceDir = join(root, "evidence", sourceId, "pages");
const unitDir = join(root, "corpus", "units", "circ2019");

type Inline =
    | { kind: "text"; value: string }
    | { kind: "math"; value: string; latex: string };
type BlockKind = "heading" | "paragraph";
type Part = { page: number; from?: number; to?: number };
type BlockSpec = { kind: BlockKind; page: number; text: string; inline?: Inline[]; manual?: boolean; parts?: Part[] };

const uid = (number: string): string => `urn:structural-codes:it:unit:circ2019:${number.toLowerCase()}`;
const sha256 = (value: string): string => createHash("sha256").update(value, "utf8").digest("hex");
const text = (value: string): Inline => ({ kind: "text", value });
const math = (value: string, latex: string): Inline => ({ kind: "math", value, latex });
const plain = (value: string): Inline[] => [text(value)];

const pageLines = new Map<number, string[]>();
for (const page of [164, 165]) {
    const filename = join(evidenceDir, `page-${String(page).padStart(4, "0")}.raw.txt`);
    pageLines.set(page, (await readFile(filename, "utf8")).replace(/\r\n/gu, "\n").split("\n"));
}

function raw(parts: Part[] = []): string {
    return parts
        .map(({ page, from = 1, to = from }) => pageLines.get(page)!.slice(from - 1, to).join("\n"))
        .join("\n");
}

function evidence(spec: BlockSpec): Record<string, unknown> {
    const source = spec.manual ? spec.text : raw(spec.parts);
    const transformations = spec.manual
        ? []
        : [
              {
                  operation: "join-line-wrap",
                  ruleVersion: profile,
                  note: "Ricomposti i ritorni a capo tipografici verificati sul render ufficiale.",
              },
              {
                  operation: "remove-control-character",
                  ruleVersion: profile,
                  note: "Rimossi i caratteri di controllo privi di resa visuale dal layer testuale.",
              },
              {
                  operation: "manual-correction",
                  ruleVersion: profile,
                  note: "Ripristinati numerazione, accenti, apostrofi e simboli matematici confrontati con il render ufficiale.",
              },
              {
                  operation: "normalize-whitespace",
                  ruleVersion: profile,
                  note: "Uniformati gli spazi dopo la ricomposizione delle righe.",
              },
              {
                  operation: "unicode-nfc",
                  ruleVersion: profile,
                  note: "Testo normalizzato in Unicode NFC.",
              },
          ];
    return {
        sourceId,
        pdfPage: spec.page,
        printedPage: String(spec.page - 4),
        region: null,
        extraction: {
            method: spec.manual ? "manual-transcription" : "pdf-text",
            tool: spec.manual ? "codex-render-transcription" : "pdfjs-dist",
            toolVersion: spec.manual ? profile : "4.10.38",
        },
        transformations,
        rawSha256: sha256(source),
        normalizedSha256: sha256(spec.text),
    };
}

function block(number: string, index: number, spec: BlockSpec): Record<string, unknown> {
    const blockId = `${uid(number)}#block-${spec.kind === "heading" ? "heading" : `editorial-${String(index).padStart(3, "0")}`}`;
    return {
        blockId,
        kind: spec.kind,
        origin: "official",
        text: {
            raw: spec.manual ? spec.text : raw(spec.parts),
            normalized: spec.text,
            normalizationVersion: profile,
            inline: spec.inline ?? plain(spec.text),
        },
        evidence: evidence(spec),
    };
}

function parent(number: string): string | null {
    const parts = number.split(".");
    return parts.length === 1 ? null : uid(parts.slice(0, -1).join("."));
}

function ancestors(number: string): string[] {
    const parts = number.split(".");
    return parts.slice(1).map((_, index) => uid(parts.slice(0, index + 1).join(".")));
}

function makeUnit(number: string, title: string, specs: BlockSpec[]): Record<string, unknown> {
    const blocks = specs.map((spec, index) => block(number, index, spec));
    return {
        $schema: "urn:structural-codes:schema:canonical-unit:v2",
        schemaVersion: "2.0.0-alpha.2",
        recordType: "canonical-unit",
        id: uid(number),
        workId,
        expressionId,
        kind: number === "C4.5" ? "section" : "subparagraph",
        numbering: {
            official: number,
            sortKey: number.slice(1).split(".").map((part) => part.padStart(3, "0")).join("."),
        },
        title,
        titleBlockId: `${uid(number)}#block-heading`,
        hierarchy: {
            parentId: parent(number),
            ancestorIds: ancestors(number),
            position: Number(number.split(".").at(-1)),
        },
        validity: { from: null, to: null, status: "unknown", asOf: "2026-08-09" },
        blocks,
        citations: [],
        relations: [
            {
                relationId: `${uid(number)}#relation-001`,
                type: "clarifies",
                targetUnitId: `urn:structural-codes:it:unit:ntc2018:${number.slice(1)}`,
                basis: "editorial",
                evidenceBlockIds: [`${uid(number)}#block-heading`],
                rationale: "Corrispondenza proposta tra numerazione omologa della Circolare e delle NTC; non implica ancora equivalenza semantica completa.",
                review: { status: "proposed", reviewedBy: null, reviewedAt: null },
            },
        ],
        assets: { formulaIds: [], tableIds: [], figureIds: [] },
        workflow: {
            status: "extracted",
            createdBy: { actorId: "codex:circ45-step1", kind: "automated-agent", toolVersion: profile },
            createdAt,
            reviews: [],
            openIssues: [
                {
                    issueId: `circ2019-${number.toLowerCase().replaceAll(".", "-")}-source-review`,
                    type: "normalization-review",
                    severity: "blocking",
                    note: "Record trascritto dall’evidence ufficiale ma non ancora confrontato integralmente da un revisore umano con il render della fonte.",
                },
                {
                    issueId: `circ2019-${number.toLowerCase().replaceAll(".", "-")}-relation-review`,
                    type: "relation-review",
                    severity: "blocking",
                    note: "Il collegamento proposto con l’unità omologa NTC 2018 richiede conferma umana sul contenuto completo.",
                },
            ],
        },
    };
}

const h = (number: string, title: string, page: number, manual = false, parts?: Part[]): BlockSpec => ({
    kind: "heading",
    page,
    text: `${number} ${title}`,
    manual,
    parts,
});
const p = (page: number, textValue: string, inline?: Inline[], manual = false, parts?: Part[]): BlockSpec => ({
    kind: "paragraph",
    page,
    text: textValue,
    inline,
    manual,
    parts,
});

const manualPage164 = true;
const units: Array<[string, string, BlockSpec[]]> = [
    ["C4.5", "COSTRUZIONI DI MURATURA", [h("C4.5", "COSTRUZIONI DI MURATURA", 164, manualPage164)]],
    ["C4.5.2", "MATERIALI E CARATTERISTICHE TIPOLOGICHE", [h("C4.5.2", "MATERIALI E CARATTERISTICHE TIPOLOGICHE", 164, manualPage164)]],
    ["C4.5.2.2", "ELEMENTI RESISTENTI DI MURATURA", [h("C4.5.2.2", "ELEMENTI RESISTENTI DI MURATURA", 164, manualPage164)]],
    [
        "C4.5.2.2.1",
        "Elementi artificiali",
        [
            h("C4.5.2.2.1", "Elementi artificiali", 164, manualPage164),
            p(164, "Il rispetto degli spessori minimi dei setti esterni ed interni degli elementi artificiali ha il fine principale di garantire sufficiente robustezza agli elementi, cioè di prevenire rotture fragili. L’uso di elementi con spessori inferiori a quanto indicato nel presente punto è soggetto a quanto previsto nei §§ 4.6 e 11.1 delle NTC.", undefined, manualPage164),
            p(164, "Analogamente, il rispetto della percentuale di foratura e della massima area della sezione normale di ogni singolo foro ha il fine principale di garantire sufficiente robustezza agli elementi, cioè di prevenire rotture fragili. L’uso di elementi con percentuale di foratura superiore o con fori di dimensioni superiori, anche se riempiti con materiale il quale non abbia però proprietà meccaniche uguali a quelle del materiale di base dell’elemento (laterizio, calcestruzzo, silicato di calcio, etc…), è soggetto a quanto previsto nei §§ 4.6 e 11.1 delle NTC. Si rammenta comunque che, in base al § 4.5.2.2.1, delle NTC non sono soggetti a limitazione di dimensioni i fori degli elementi in laterizio e calcestruzzo destinati ad essere riempiti di calcestruzzo o malta ad uso strutturale.", undefined, manualPage164),
        ],
    ],
    [
        "C4.5.2.3",
        "MURATURE",
        [
            h("C4.5.2.3", "MURATURE", 164, manualPage164),
            p(164, "La muratura a paramento doppio dal punto di vista strutturale è intesa come muratura in cui entrambi i paramenti sono progettati per svolgere una funzione strutturale. Nel caso in cui siano costruttivamente presenti due paramenti, dei quali però uno venga concepito con la sola funzione di rivestimento non strutturale, è possibile considerare tale paramento unicamente come massa portata, e seguire per l’altro le procedure di verifica strutturale per muratura a paramenti singoli.", undefined, manualPage164),
            p(164, "Ai fini delle limitazioni in altezza indicate, qualora si impieghino giunti sottili e/o giunti verticali a secco, l’altezza interpiano è intesa come altezza massima del paramento murario misurata dall’estradosso del solaio o del cordolo inferiore all’intradosso del solaio o cordolo superiore.", undefined, manualPage164),
            p(164, "Nel caso in cui vengano utilizzati elementi che consentono la realizzazione di giunti verticali a tasca, le condizioni per cui tali giunti possono essere considerati equivalenti ai giunti interamente riempiti sono riportate al paragrafo § 8.1.5(3) della norma UNI EN 1996-1-1:2013.", undefined, manualPage164),
        ],
    ],
    [
        "C4.5.4",
        "ORGANIZZAZIONE STRUTTURALE",
        [
            h("C4.5.4", "ORGANIZZAZIONE STRUTTURALE", 164, manualPage164),
            p(164, "La funzione “portante” di un muro consiste nel sopportare i carichi verticali. La funzione di controvento consiste nel resistere alle azioni orizzontali. La resistenza di un muro a forze orizzontali è maggiore quando queste lo sollecitano parallelamente al proprio piano. Una adeguata concezione strutturale prevede muri disposti in pianta secondo almeno due direzioni ortogonali, al fine di resistere ad azioni orizzontali comunque dirette. La presenza di uno stato di compressione verticale influenza la resistenza della muratura alle azioni orizzontali, in particolar modo nel caso di muratura non armata. Per bassi valori di compressione media, un setto di muratura incrementa la sua resistenza alle forze orizzontali (nel piano e fuori del piano) al crescere della compressione verticale. L’orientamento dei solai e la modalità con cui questi trasmettono i carichi verticali ai setti murari rientrano quindi tra le scelte progettuali che possono influenzare il comportamento strutturale nei confronti delle azioni orizzontali.", undefined, manualPage164),
        ],
    ],
    [
        "C4.5.5",
        "ANALISI STRUTTURALE",
        [
            h("C4.5.5", "ANALISI STRUTTURALE", 164, manualPage164),
            p(164, "L’uso dei modelli semplificati basati sullo schema dell’articolazione completa è consentito, in particolare qualora ci si avvalga del metodo semplificato di verifica a pressoflessione per carichi laterali riportato al seguente § 4.5.6.2, ma non è l’unico modello utilizzabile. Sono altresì ammessi i metodi di analisi riportati nella norma UNI EN 1996-1-1, a cui dovranno essere abbinati i metodi di verifica corrispondenti riportati nella stessa norma.", undefined, manualPage164),
        ],
    ],
    [
        "C4.5.6",
        "VERIFICHE",
        [
            h("C4.5.6", "VERIFICHE", 164, manualPage164),
            p(164, "Le verifiche sulle travi di accoppiamento di cui al § 4.5.6 delle NTC si eseguono anche per la muratura armata e confinata.", undefined, manualPage164),
        ],
    ],
    [
        "C4.5.6.1",
        "RESISTENZE DI PROGETTO",
        [
            h("C4.5.6.1", "RESISTENZE DI PROGETTO", 164, manualPage164),
            p(164, "Per quanto riguarda il controllo e valutazione in loco delle proprietà della malta, il rispetto del requisito può essere considerato soddisfatto dai controlli di accettazione previsti al Capitolo 11 delle NTC.", undefined, manualPage164),
            p(164, "Il coefficiente parziale di sicurezza γ_M da impiegarsi nelle espressioni 4.5.2 e 4.5.3 delle NTC è riportato in Tabella 4.5.II.", [
                text("Il coefficiente parziale di sicurezza "),
                math("γ_M", "\\gamma_M"),
                text(" da impiegarsi nelle espressioni 4.5.2 e 4.5.3 delle NTC è riportato in Tabella 4.5.II."),
            ], manualPage164),
        ],
    ],
    [
        "C4.5.6.2",
        "VERIFICHE AGLI STATI LIMITE ULTIMI",
        [
            h("C4.5.6.2", "VERIFICHE AGLI STATI LIMITE ULTIMI", 165, false, [{ page: 165, from: 3, to: 3 }]),
            p(165, "Il metodo semplificato proposto è una possibile alternativa ai metodi riportati dalle normative di comprovata validità (ad esempio la UNI EN 1996-1-1) ed introduce una riduzione della resistenza a compressione della muratura per l’effetto combinato di eccentricità trasversali del carico e effetti geometrici del secondo ordine mediante il coefficiente Φ. Questo metodo deriva dalle norme tecniche italiane precedentemente in vigore (a partire dal DM 20/11/87). Nell’applicazione di tale metodo è opportuno ricordare che le tensioni di compressione possono essere distribuite in modo non uniforme in direzione longitudinale al muro, a causa di una eccentricità longitudinale della risultante dei carichi verticali. Tale eccentricità longitudinale può essere dovuta alle modalità con cui i carichi verticali sono trasmessi al muro, oppure alla presenza di momenti nel piano del muro dovuti ad esempio alla spinta del vento nel caso di muri di controvento.", [
                text("Il metodo semplificato proposto è una possibile alternativa ai metodi riportati dalle normative di comprovata validità (ad esempio la UNI EN 1996-1-1) ed introduce una riduzione della resistenza a compressione della muratura per l’effetto combinato di eccentricità trasversali del carico e effetti geometrici del secondo ordine mediante il coefficiente "),
                math("Φ", "\\Phi"),
                text(". Questo metodo deriva dalle norme tecniche italiane precedentemente in vigore (a partire dal DM 20/11/87). Nell’applicazione di tale metodo è opportuno ricordare che le tensioni di compressione possono essere distribuite in modo non uniforme in direzione longitudinale al muro, a causa di una eccentricità longitudinale della risultante dei carichi verticali. Tale eccentricità longitudinale può essere dovuta alle modalità con cui i carichi verticali sono trasmessi al muro, oppure alla presenza di momenti nel piano del muro dovuti ad esempio alla spinta del vento nel caso di muri di controvento."),
            ], false, [{ page: 165, from: 4, to: 11 }]),
            p(165, "È quindi necessario tenere conto, nella verifica di sicurezza, della distribuzione non uniforme in senso longitudinale delle compressioni. In alternativa, è possibile valutare l’eccentricità longitudinale e_l dei carichi verticali e definire una ulteriore riduzione convenzionale della resistenza a compressione applicando alla resistenza ridotta f_d,rid un ulteriore coefficiente Φ₁ valutato dalla Tabella 4.5.III delle NTC, ponendo m = 6e_l/l dove l è la lunghezza del muro, e ponendo λ = 0.", [
                text("È quindi necessario tenere conto, nella verifica di sicurezza, della distribuzione non uniforme in senso longitudinale delle compressioni. In alternativa, è possibile valutare l’eccentricità longitudinale "),
                math("e_l", "e_l"),
                text(" dei carichi verticali e definire una ulteriore riduzione convenzionale della resistenza a compressione applicando alla resistenza ridotta "),
                math("f_d,rid", "f_{d,\\mathrm{rid}}"),
                text(" un ulteriore coefficiente "),
                math("Φ₁", "\\Phi_1"),
                text(" valutato dalla Tabella 4.5.III delle NTC, ponendo "),
                math("m = 6e_l/l", "m=6e_l/l"),
                text(" dove "),
                math("l", "l"),
                text(" è la lunghezza del muro, e ponendo "),
                math("λ = 0", "\\lambda=0"),
                text("."),
            ], false, [{ page: 165, from: 12, to: 15 }]),
            p(165, "La verifica di sicurezza viene formulata quindi come N_d≤ΦΦ₁f_dtl dove N_d è il carico verticale totale agente sulla sezione del muro oggetto di verifica, l e t sono rispettivamente lunghezza e spessore del muro.", [
                text("La verifica di sicurezza viene formulata quindi come "),
                math("N_d≤ΦΦ₁f_dtl", "N_d\\le\\Phi\\Phi_1 f_d t l"),
                text(" dove "),
                math("N_d", "N_d"),
                text(" è il carico verticale totale agente sulla sezione del muro oggetto di verifica, "),
                math("l", "l"),
                text(" e "),
                math("t", "t"),
                text(" sono rispettivamente lunghezza e spessore del muro."),
            ], false, [{ page: 165, from: 16, to: 17 }]),
            p(165, "L’eccentricità accidentale e_a va considerata in ciascuna delle relazioni 4.5.10 con segno tale da rendere massimo il valore assoluto dell’eccentricità di calcolo. Il valore di eccentricità e₁ è adottato per la verifica dei muri nelle loro estremità superiori, nelle sezioni inferiori l’eccentricità di calcolo dovrà essere assunta almeno pari ad e_a.", [
                text("L’eccentricità accidentale "),
                math("e_a", "e_a"),
                text(" va considerata in ciascuna delle relazioni 4.5.10 con segno tale da rendere massimo il valore assoluto dell’eccentricità di calcolo. Il valore di eccentricità "),
                math("e₁", "e_1"),
                text(" è adottato per la verifica dei muri nelle loro estremità superiori, nelle sezioni inferiori l’eccentricità di calcolo dovrà essere assunta almeno pari ad "),
                math("e_a", "e_a"),
                text("."),
            ], false, [{ page: 165, from: 18, to: 20 }]),
        ],
    ],
    [
        "C4.5.6.4",
        "VERIFICHE SEMPLIFICATE",
        [
            h("C4.5.6.4", "VERIFICHE SEMPLIFICATE", 165, false, [{ page: 165, from: 21, to: 21 }]),
            p(165, "Il limite di snellezza fissato a 12, di cui alla lettera e), è relativo alla muratura ordinaria, mentre si assume il valore limite di 15 nel caso di muratura confinata e di muratura armata.", [
                text("Il limite di snellezza fissato a "), math("12", "12"), text(", di cui alla lettera e), è relativo alla muratura ordinaria, mentre si assume il valore limite di "), math("15", "15"), text(" nel caso di muratura confinata e di muratura armata."),
            ], false, [{ page: 165, from: 22, to: 23 }]),
            p(165, "Il valore di carico variabile di cui alla lettera f) è da intendersi come valore caratteristico del sovraccarico q_k di cui al § 3.1.4., e la limitazione non riguarda il sovraccarico di balconi e scale.", [
                text("Il valore di carico variabile di cui alla lettera f) è da intendersi come valore caratteristico del sovraccarico "), math("q_k", "q_k"), text(" di cui al § 3.1.4., e la limitazione non riguarda il sovraccarico di balconi e scale."),
            ], false, [{ page: 165, from: 24, to: 25 }]),
            p(165, "Ai fini del calcolo delle percentuali di sezione resistente delle pareti di cui alla Tabella 7.8.II delle NTC, la superficie totale in pianta dell’edificio deve essere determinata considerando la poligonale definita dal filo esterno delle pareti perimetrali al netto di eventuali aggetti (per es. gronde, balconi).", undefined, false, [{ page: 165, from: 26, to: 28 }]),
            p(165, "Le verifiche semplificate consentite, quando applicabili, garantiscono il progettista nei confronti degli stati limite per tutti i casi previsti ai § 4.5.6.2 e § 4.5.6.3 delle NTC, con eccezione della verifica per eventuali carichi concentrati. Rimane responsabilità del progettista valutare l’eventuale presenza di carichi concentrati e la necessità di una conseguente verifica locale.", undefined, false, [{ page: 165, from: 29, to: 31 }]),
        ],
    ],
    [
        "C4.5.7",
        "MURATURA ARMATA",
        [
            h("C4.5.7", "MURATURA ARMATA", 165, false, [{ page: 165, from: 32, to: 32 }]),
            p(165, "Le indicazioni progettuali sulla muratura armata riportate nel § 4.5.7 delle NTC si basano sulle esperienze e sulle rilevanze sperimentali attualmente disponibili. Pertanto nei sistemi di muratura armata qui normati è previsto l’uso di giunti orizzontali e verticali completamente riempiti di malta. Sono quindi esclusi, in accordo anche con quanto prescritto nella UNI EN 1996-1-1:2013 § 8.1.5(3), riempimenti parziali dei giunti verticali, come quelli consentiti per la muratura non armata (ad esempio i sistemi a tasca).", undefined, false, [{ page: 165, from: 33, to: 37 }]),
        ],
    ],
    [
        "C4.5.8",
        "MURATURA CONFINATA",
        [
            h("C4.5.8", "MURATURA CONFINATA", 165, false, [{ page: 165, from: 38, to: 38 }]),
            p(165, "L’introduzione della muratura confinata nel testo della norma costituisce un elemento di novità rispetto alle precedenti Norme Tecniche del 2008. La muratura confinata è costituita da setti di muratura “confinata”, da elementi verticali ed orizzontali (cordolature) in cemento armato o muratura armata. Il calcestruzzo con cui sono realizzati gli elementi armati viene gettato in opera successivamente alla costruzione dei paramenti murari. I riferimenti normativi sono costituiti dalle norme della serie UNI EN 1996 e UNI EN 1998 con le relative Appendici Nazionali.", undefined, false, [{ page: 165, from: 39, to: 43 }]),
        ],
    ],
];

await mkdir(unitDir, { recursive: true });
for (const [number, title, specs] of units) {
    await writeFile(join(unitDir, `${number.toLowerCase()}.json`), `${JSON.stringify(makeUnit(number, title, specs), null, 2)}\n`, "utf8");
}
console.log(`Circolare C4.5: generate ${units.length} unità.`);
