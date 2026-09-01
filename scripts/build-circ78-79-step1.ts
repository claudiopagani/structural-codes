/* eslint-disable @typescript-eslint/no-explicit-any */
import { createHash } from "node:crypto";
import { mkdir, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const sourceId = "circ-7-2019";
const profile = "circ78-79-step1-manual-render-transcription-0.1.0";
const asOf = "2026-08-09";
const unitId = (number: string): string =>
    `urn:structural-codes:it:unit:circ2019:${number.toLowerCase()}`;
const assetId = (kind: "figure", number: string): string =>
    `urn:structural-codes:it:asset:${kind}:circ2019:${number.toLowerCase()}`;
const sha256 = (value: string): string =>
    createHash("sha256").update(value, "utf8").digest("hex");

const mathTerms: Array<[string, string]> = [
    ["1.25% x (1-ν)", "1.25\\%\\times(1-\\nu)"],
    ["2.0% x (1-ν)", "2.0\\%\\times(1-\\nu)"],
    ["1.5% x (1-ν)", "1.5\\%\\times(1-\\nu)"],
    ["ν = σ_0/f_d=N/(A f_d)", "\\nu=\\frac{\\sigma_0}{f_d}=\\frac{N}{A f_d}"],
    ["ν = σ_0/f_d", "\\nu=\\frac{\\sigma_0}{f_d}"],
    ["L_zd-sez", "L_{zd-sez}"],
    ["L_zd-M", "L_{zd-M}"],
    ["M_prc", "M_{prc}"],
    ["q*≤4", "q^*\\le4"],
    ["q*=4", "q^*=4"],
    ["q*=3", "q^*=3"],
    ["1.0%", "1.0\\%"],
    ["1.6%", "1.6\\%"],
    ["1.2%", "1.2\\%"],
    ["0.5%", "0.5\\%"],
    ["0,075 g", "0{,}075\\,g"],
    ["55%", "55\\%"],
    ["45%", "45\\%"],
    ["80%", "80\\%"],
    ["3/4", "\\frac{3}{4}"],
    ["2/3", "\\frac{2}{3}"],
    ["ν > 0.2", "\\nu>0.2"],
    ["ν ≤ 0.2", "\\nu\\le0.2"],
    ["0.2", "0.2"],
    ["0,2", "0{,}2"],
    ["f_vd", "f_{vd}"],
    ["f_yd", "f_{yd}"],
    ["f_bd", "f_{bd}"],
    ["f_hd", "f_{hd}"],
    ["f_y", "f_y"],
    ["f_v", "f_v"],
    ["a_gS", "a_{g}S"],
    ["σ_0/f_d", "\\frac{\\sigma_0}{f_d}"],
    ["ν", "\\nu"],
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
          kind: "figure-ref";
          page: number;
          asset: string;
          label: string;
          region?: any;
      };
type Unit = { number: string; title: string; page: number; blocks: Block[] };
const p = (page: number, text: string): Block => ({ kind: "paragraph", page, text });
const li = (page: number, text: string): Block => ({ kind: "list-item", page, text });
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
        number: "C7.8",
        title: "COSTRUZIONI DI MURATURA",
        page: 232,
        blocks: [
            p(232, "Nel Capitolo sono opportunamente integrate le regole generali di progettazione ed esecuzione per le costruzioni di muratura per l’impiego in zona sismica."),
        ],
    },
    { number: "C7.8.1", title: "REGOLE GENERALI", page: 232, blocks: [] },
    {
        number: "C7.8.1.1",
        title: "PREMESSA",
        page: 232,
        blocks: [
            p(232, "Quanto riportato nel presente Capitolo si applica alle costruzioni in muratura ordinaria, in muratura armata e in muratura confinata, soggette ad azioni sismiche."),
            p(232, "Si applicano, oltre alle indicazioni specifiche riportate al § 7.8 delle NTC, i contenuti di carattere generale del § 4.5 delle NTC ed i requisiti dei prodotti e materiali (mattoni o blocchi e malta), costituenti la muratura, stabiliti al § 11.10 delle NTC."),
        ],
    },
    {
        number: "C7.8.1.2",
        title: "MATERIALI",
        page: 232,
        blocks: [
            p(232, "Le limitazioni indicate per lo spessore minimo dei setti interni ed esterni degli elementi si riferiscono agli elementi in laterizio. Si sottolinea che la percentuale massima di foratura del 55% è applicabile solo nel caso in cui a_gS è non maggiore di 0,075 g, allo SLV, dove i valori di a_gS siano superiori vale, per tutte le tipologie di elemento, la limitazione del 45%, in accordo con quanto indicato al primo capoverso del § 7.8.1.2 delle NTC."),
        ],
    },
    { number: "C7.8.1.5", title: "METODI DI ANALISI", page: 232, blocks: [] },
    {
        number: "C7.8.1.5.2",
        title: "Analisi lineare statica",
        page: 232,
        blocks: [
            p(232, "Per le pareti resistenti al sisma, il richiamo alla tabella Tab. 7.8.II è da intendersi alla Tab. 7.8.I"),
        ],
    },
    {
        number: "C7.8.1.5.4",
        title: "Analisi statica non lineare",
        page: 232,
        blocks: [
            p(232, "L’analisi statica non lineare consiste nell’applicare all’edificio i carichi gravitazionali ed un sistema di forze orizzontali che vengono tutte scalate in modo da far crescere lo spostamento orizzontale di un punto di controllo sulla struttura (ad esempio posto in sommità dell’edificio, a livello della copertura) fino al raggiungimento delle condizioni ultime. Il principale risultato dell’analisi consiste in un diagramma riportante in ascissa lo spostamento orizzontale del punto di controllo, in ordinata la forza orizzontale totale applicata (taglio alla base). La capacità di spostamento relativa ai diversi stati limite (§ 3.2.1) verrà valutata sulla curva forza-spostamento così definita, in corrispondenza dei seguenti punti:"),
            p(232, "SLC: il minore tra i valori di spostamento corrispondenti a ciascuna delle due condizioni:"),
            li(232, "quello corrispondente ad un taglio di base residuo pari all’80% del massimo;"),
            li(232, "quello corrispondente al raggiungimento della soglia limite della deformazione angolare a SLC in tutti i maschi murari verticali di un qualunque livello in una qualunque parete ritenuta significativa ai fini della sicurezza (questo controllo può essere omesso nelle analisi quando i diaframmi siano infinitamente rigidi o quando sia eseguita l’analisi di una singola parete)."),
            p(232, "SLV: spostamento corrispondente a 3/4 dello spostamento allo SLC;"),
            p(232, "SLD: spostamento minore tra quello corrispondente al raggiungimento della massima forza e quello per il quale lo spostamento relativo fra due piani consecutivi eccede i valori riportati al § 7.3.6.1;"),
            p(232, "SLO: spostamento minore tra quello corrispondente al raggiungimento della massima forza e quello per il quale lo spostamento relativo fra due piani consecutivi eccede i 2/3 dei valori riportati al § 7.3.6.1."),
        ],
    },
    {
        number: "C7.8.1.6",
        title: "VERIFICHE DI SICUREZZA",
        page: 232,
        blocks: [
            p(232, "Nel caso dell’analisi statica non lineare le verifiche consistono nel confronto tra la capacità di spostamento della costruzione e la domanda di spostamento, ai diversi stati limite. La domanda di spostamento può essere valutata sul sistema bilineare equivalente attraverso le espressioni C.7.3.6, C.7.3.7 e C.7.3.8, indicate nel § C.7.3.4.2. Per lo SLC vale inoltre il requisito q*≤4, ovvero la capacità di spostamento del sistema allo SLC non potrà mai eccedere lo spostamento corrispondente al valore q*=4 per tutte le tipologie di muratura (ordinaria, armata, confinata). Si raccomanda inoltre che la capacità di spostamento del sistema allo SLV non ecceda lo spostamento corrispondente al valore q*=3 per tutte le tipologie di muratura (ordinaria, armata, confinata)."),
            p(233, "Le verifiche fuori piano sulle pareti dovranno comunque essere svolte anche nel caso dell’analisi statica non lineare e potranno essere effettuate separatamente, secondo le procedure indicate per l’analisi lineare statica."),
            p(233, "Per la verifica a pressoflessione fuori dal piano delle pareti, di cui al primo capoverso del § 7.8.1.6 delle NTC, il richiamo alla tabella Tab. 7.8.II è da intendersi alla Tab. 7.8.I."),
            p(233, "Inoltre, quanto riportato al penultimo capoverso dello stesso § 7.8.1.6 in merito alla verifica di sicurezza per costruzioni non progettate in capacità, si applica anche alla muratura confinata."),
        ],
    },
    {
        number: "C7.8.1.9",
        title: "COSTRUZIONI SEMPLICI",
        page: 233,
        blocks: [
            p(233, "Ai fini del calcolo delle percentuali di sezione resistente delle pareti di cui alla Tabella 7.8.II, la superficie totale in pianta dell’edificio deve essere determinata considerando l’area racchiusa dalla poligonale definita dal filo esterno delle pareti perimetrali al netto di eventuali aggetti (per es. gronde, balconi)."),
            p(233, "Nel calcolo del carico verticale totale N per la verifica espressa nell’equazione [7.8.1], i carichi verticali vanno moltiplicati per i coefficienti di combinazione corrispondenti alla combinazione sismica [2.5.5] del § 2.5.3."),
            p(233, "Ai fini del conteggio della lunghezza complessiva dei setti murari, il richiamo alla tabella Tab. 7.8.II è da intendersi alla Tab. 7.8.I."),
            p(233, "Nella Tabella 7.8.II il coefficiente S_T andrebbe applicato, come previsto al § 3.2.3, anche nel caso di costruzioni in classe I e II."),
            p(233, "Per la muratura confinata, nella Tabella 7.8.II, si applicano i valori indicati per la muratura ordinaria."),
        ],
    },
    { number: "C7.8.2", title: "COSTRUZIONI DI MURATURA ORDINARIA", page: 233, blocks: [] },
    { number: "C7.8.2.2", title: "VERIFICHE DI SICUREZZA", page: 233, blocks: [] },
    {
        number: "C7.8.2.2.1",
        title: "Pressoflessione nel piano",
        page: 233,
        blocks: [
            p(233, "Si sottolinea che la capacità di spostamento ultimo allo SLC pari a 1.0% è coerente con rotture per pressoflessione caratterizzate da bassi valori dello sforzo di compressione medio normalizzato ν = σ_0/f_d. In particolare tale valore è coerente con i risultati sperimentali ottenuti per ν ≤ 0.2; per ν > 0.2 è opportuno assumere valori più cautelativi. In assenza di considerazioni più approfondite si suggerisce di assumere che la capacità di spostamento ultima sia non superiore a 1.25% x (1-ν) e, comunque, non inferiore allo spostamento al limite elastico del pannello."),
        ],
    },
    {
        number: "C7.8.2.2.2",
        title: "Taglio",
        page: 233,
        blocks: [
            p(233, "In questo §, il simbolo f_y è da intendersi f_v, inoltre il richiamo al § 11.3.3 è da intendersi al § 11.10.3.3."),
        ],
    },
    {
        number: "C7.8.2.2.4",
        title: "Travi in Muratura",
        page: 233,
        blocks: [
            p(233, "Nella equazione [7.8.5] il simbolo f_bd è da intendersi f_hd."),
        ],
    },
    { number: "C7.8.3", title: "COSTRUZIONI DI MURATURA ARMATA", page: 233, blocks: [] },
    { number: "C7.8.3.2", title: "VERIFICHE DI SICUREZZA", page: 233, blocks: [] },
    {
        number: "C7.8.3.2.1",
        title: "Pressoflessione nel piano",
        page: 233,
        blocks: [
            p(233, "Si sottolinea che la capacità di spostamento ultimo allo SLC pari a 1.6% è coerente con rotture per pressoflessione caratterizzate da bassi valori dello sforzo di compressione medio normalizzato ν = σ_0/f_d. Per valori di ν superiori a 0.2 è opportuno assumere valori più cautelativi. In assenza di considerazioni più approfondite si suggerisce di assumere che la capacità di spostamento ultima sia non superiore a 2.0% x (1-ν) e, comunque, non inferiore allo spostamento al limite elastico del pannello."),
        ],
    },
    {
        number: "C7.8.3.2.2",
        title: "Taglio",
        page: 233,
        blocks: [
            p(233, "In questo §, il simbolo f_y è da intendersi f_v, invece nella espressione [7.8.9] f_vd è da intendersi f_yd."),
        ],
    },
    {
        number: "C7.8.4",
        title: "COSTRUZIONI DI MURATURA CONFINATA",
        page: 233,
        blocks: [
            p(233, "La progettazione e la realizzazione di edifici in muratura confinata devono essere eseguite in accordo anche con la UNI EN 1996-1-1, che è espressamente richiamata dalla UNI EN 1998-1."),
            p(233, "Le resistenze a taglio e a pressoflessione nel piano, e a pressoflessione fuori piano, possono essere calcolate in accordo con la UNI EN 1996-1-1."),
            p(233, "La capacità di spostamento ai fini della verifica allo SLC, a meno di moti rigidi del pannello, può essere assunta pari a:"),
            li(233, "1.2% dell’altezza del pannello (rottura per pressoflessione con ν ≤ 0.2);"),
            li(233, "0.5% dell’altezza del pannello (rottura per taglio);"),
            p(233, "in cui ν è lo sforzo assiale medio normalizzato ν = σ_0/f_d=N/(A f_d) ed A è l’area lorda della sezione normale del setto murario comprensiva degli elementi di confinamento in c.a."),
            p(234, "Per valori di ν superiori a 0,2, nel caso di rottura per pressoflessione, è opportuno assumere valori più cautelativi. In assenza di considerazioni più approfondite, si suggerisce di assumere che la capacità di spostamento ultima sia non superiore a 1.5% x (1-ν) e, comunque, non inferiore allo spostamento al limite elastico del pannello."),
        ],
    },
    {
        number: "C7.8.5",
        title: "STRUTTURE MISTE",
        page: 234,
        blocks: [
            p(234, "La trasmissione delle azioni sismiche in una struttura mista può avvenire attraverso un organismo strutturale che presenti elementi in muratura ed elementi in cemento armato o acciaio o legno od altra tecnologia disposti altimetricamente allo stesso piano oppure disposti altimetricamente su piani successivi."),
            p(234, "Laddove le azioni sismiche non vengano integralmente affidate alla struttura muraria od a quella in altra tecnologia ma si ravvisi l’esigenza di considerare la collaborazione delle pareti in muratura e dei sistemi di diversa tecnologia nella resistenza al sisma, per tali strutture è necessario eseguire l’analisi non lineare, statica o dinamica, al fine di valutare correttamente i diversi contributi di elementi caratterizzati da rigidezze, resistenze e capacità deformative molto differenziate tra di loro."),
        ],
    },
    { number: "C7.8.6", title: "REGOLE DI DETTAGLIO", page: 234, blocks: [] },
    {
        number: "C7.8.6.3",
        title: "COSTRUZIONI DI MURATURA CONFINATA",
        page: 234,
        blocks: [
            p(234, "Si ricorda che in ogni caso il cordolo di piano deve essere realizzato nel rispetto di quanto riportato al § 7.8.6.1, in analogia con le costruzioni in muratura ordinaria e in muratura armata."),
            p(234, "Come per le costruzioni in muratura armata è possibile derogare dal requisito di avere agli incroci delle pareti perimetrali zone di parete muraria di lunghezza non inferiore ad un metro su ciascun lato dell’angolo."),
        ],
    },
    { number: "C7.9", title: "PONTI", page: 234, blocks: [] },
    {
        number: "C7.9.5",
        title: "DIMENSIONAMENTO E VERIFICA DEGLI ELEMENTI STRUTTURALI",
        page: 234,
        blocks: [
            p(234, "Per garantire alle pile da ponte un comportamento dissipativo, nel dimensionamento e nella verifica degli elementi strutturali si adotta la progettazione in capacità. A differenza degli elementi strutturali di tutte le altre tipologie strutturali, per le quali i fattori di sovraresistenza sono tutti riassunti nella Tabella 7.2.I, la norma fornisce un’espressione specifica per le strutture in elevazione dei ponti. Per individuare la domanda calcolata, in base a considerazioni di equilibrio, a partire dalla capacità a flessione delle zone dissipative e dai carichi permanenti, si utilizza, solo per i ponti, il pedice “prc”."),
        ],
    },
    { number: "C7.9.5.1", title: "PILE", page: 234, blocks: [] },
    {
        number: "C7.9.5.1.1",
        title: "Verifiche di resistenza (RES)",
        page: 234,
        blocks: [
            p(234, "La figura C7.9.1 sintetizza i criteri di verifica per le pile, con riferimento a due schemi tipo: quello della pila libera in testa (mensola) e quello con incastro al piede e in testa, con diverso grado di vincolo. Le prescrizioni sulla lunghezza delle zone dissipative sono riportate al § 7.9.6.1.3 della norma."),
            figure(235, "C7.9.1", { x: 115, y: 75, width: 380, height: 260 }),
            p(235, "Si specifica di seguito il significato dei simboli in Figura C7.9.1: L_zd = lunghezza della zona dissipativa; L_zd-sez = lunghezza della zona dissipativa in funzione delle dimensioni della sezione (§ 7.9.6.1.3 NTC); L_zd-M = lunghezza della zona dissipativa in funzione della domanda flessionale M_prc definita al § 7.9.5 della norma."),
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
const pages232To235Only = process.argv.includes("--pages-232-235");
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
    const includeRelations = hasNtcTarget && !pages232To235Only;
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
    const relation = includeRelations
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
            formulaIds: [],
            tableIds: [],
            figureIds: blocks.filter(({ kind }) => kind === "figure-ref").map(({ assetId }: any) => assetId),
        },
        workflow: {
            status: "extracted",
            createdBy: { actorId: "generator:circ78-79-step1", kind: "script", toolVersion: profile },
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
                ...(includeRelations
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
    section: "C7.8-C7.9",
    sourceId,
    status: "transcribed-unreviewed",
    formulas: [],
    tables: [],
    figures: [
        {
            id: assetId("figure", "C7.9.1"),
            unitId: unitId("C7.9.5.1.1"),
            officialNumber: "C7.9.1",
            pdfPage: 235,
            caption: "Figura C7.9.1 - Progettazione in capacità delle pile (schema a mensola e a doppio incastro)",
            alt: "Figura C7.9.1 - Progettazione in capacità delle pile (schema a mensola e a doppio incastro)",
            imagePath: "figures/circ2019/figc7.9.1.png",
            region: {
                coordinateSystem: "pdf-points-top-left",
                x: 115,
                y: 75,
                width: 380,
                height: 260,
            },
            sha256: "0".repeat(64),
        },
    ],
};
await writeFile(join(root, "corpus", "assets", "circ2019", "7.8-7.9.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(`circ78-79-step1: generated ${units.length} units and 1 figure`);
