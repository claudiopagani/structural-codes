/* eslint-disable @typescript-eslint/no-explicit-any */
import { createHash } from "node:crypto";
import { mkdir, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const sourceId = "circ-7-2019";
const profile = "circ75-step1-manual-render-transcription-0.1.0";
const asOf = "2026-08-09";
const unitId = (number: string): string =>
    `urn:structural-codes:it:unit:circ2019:${number.toLowerCase()}`;
const assetId = (kind: "formula" | "figure", number: string): string =>
    `urn:structural-codes:it:asset:${kind}:circ2019:${number.toLowerCase()}`;
const sha256 = (value: string): string =>
    createHash("sha256").update(value, "utf8").digest("hex");

const mathTerms: Array<[string, string]> = [
    ["V_WP,Ed,U", "V_{WP,Ed,U}"],
    ["V_WP,Rd", "V_{WP,Rd}"],
    ["Σ M_b,pl,Rd", "\\sum M_{b,pl,Rd}"],
    ["5α_u/α_1", "5\\alpha_u/\\alpha_1"],
    ["2α_u/α_1", "2\\alpha_u/\\alpha_1"],
    ["α_u/α_1", "\\alpha_u/\\alpha_1"],
    ["q_0", "q_0"],
    ["A_VC", "A_{VC}"],
    ["f_y", "f_y"],
    ["h_b", "h_b"],
    ["A+", "A^{+}"],
    ["A-", "A^{-}"],
    ["z è", "z"],
    ["H", "H"],
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
type Unit = {
    number: string;
    title: string;
    page: number;
    blocks: Block[];
};

const p = (page: number, text: string): Block => ({ kind: "paragraph", page, text });
const h = (page: number, text: string): Block => ({ kind: "heading", page, text });
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
        number: "C7.5",
        title: "COSTRUZIONI D’ACCIAIO",
        page: 221,
        blocks: [
            p(221, "Nel Capitolo sono opportunamente integrate le regole generali di progettazione ed esecuzione per le Costruzioni in acciaio per l’impiego in zona sismica."),
            p(221, "In particolare, al fine di garantire la richiesta duttilità, sono fornite prescrizioni più dettagliate per la concezione dei dettagli nelle zone dissipative e per le modalità di verifica, in termini di gerarchia delle resistenze, dei gruppi trave-colonna."),
        ],
    },
    {
        number: "C7.5.2",
        title: "TIPOLOGIE STRUTTURALI E FATTORI DI COMPORTAMENTO",
        page: 222,
        blocks: [],
    },
    {
        number: "C7.5.2.1",
        title: "TIPOLOGIE STRUTTURALI",
        page: 222,
        blocks: [
            p(222, "Nelle strutture a telaio le zone dissipative devono essere localizzate principalmente all’estremità delle travi e/o nei nodi trave-colonna in modo tale da dissipare efficacemente l’energia sismica attraverso cicli flessionali inelastici. La localizzazione delle cerniere plastiche nelle strutture a telaio dovrebbe seguire le distribuzioni indicate nella Figura C7.5.1 a seconda delle soluzione strutturale realizzata."),
            p(222, "È possibile, inoltre, formare le cerniere plastiche nelle colonne, ma solo nelle seguenti parti:"),
            li(222, "alla base della struttura a telaio (a, b, c, d, e);"),
            li(222, "in sommità delle colonne all’ultimo piano dell’edificio (b e c in alternativa alle travi della copertura);"),
            li(222, "alla base ed alla sommità delle colonne nelle strutture ad un unico piano (d)."),
            figure(222, "C7.5.1", { x: 65, y: 225, width: 460, height: 115 }),
            p(222, "Una tipologia dissipativa ad un piano, in cui le cerniere plastiche sono localizzate nelle travi ed alla base delle colonne (tipo a, Figura C7.5.1), è caratterizzata da maggiori proprietà dissipative rispetto alle strutture del tipo d (Figura C7.5.1). Infatti, gran parte della capacità dissipativa della struttura è fornita dalle cerniere plastiche delle travi, soggette a sforzi normali trascurabili: per tale ragione il fattore di comportamento q_0 è pari a 5α_u/α_1 per il tipo (a) ed a 2α_u/α_1 per il tipo (d) e per il tipo (e)."),
            p(222, "In genere nel calcolo del fattore di comportamento, si assume per il coefficiente di sovraresistenza α_u/α_1 il valore proposto nel § 7.5.2.2. Tale valore, però, può essere determinato utilizzando metodi di analisi non lineari quali l’analisi dinamica non-lineare oppure l’analisi statica non-lineare (§ 7.3.4.1 e § 7.3.4.2). Ad ogni modo, durante la progettazione tale coefficiente non può assumere valori maggiori di 1,6, anche nel caso si ottengano valori più elevati a seguito di analisi non-lineari."),
        ],
    },
    {
        number: "C7.5.3",
        title: "REGOLE DI PROGETTO GENERALI PER ELEMENTI STRUTTURALI DISSIPATIVI",
        page: 222,
        blocks: [],
    },
    {
        number: "C7.5.3.1",
        title: "VERIFICHE DI RESISTENZA (RES)",
        page: 222,
        blocks: [
            p(222, "Si ritiene che il requisito di sovraresistenza sia soddisfatto nel caso di saldature a completa penetrazione."),
            p(222, "Nel caso in cui i collegamenti in zone dissipative siano realizzati mediante unioni bullonate, queste devono essere sufficientemente sovraresistenti per evitare la rottura dei bulloni a taglio. Per tale ragione, la resistenza di progetto dei bulloni a taglio deve essere almeno 1,2 volte superiore alla resistenza a rifollamento dell’unione. Inoltre, deve essere assolutamente evitata la rottura dei bulloni a trazione, meccanismo di collasso caratterizzato da un comportamento fragile. Per tale motivo, anche i bulloni soggetti a trazione devono essere dotati di un’opportuna sovraresistenza."),
        ],
    },
    {
        number: "C7.5.4",
        title: "REGOLE DI PROGETTO SPECIFICHE PER STRUTTURE INTELAIATE",
        page: 222,
        blocks: [],
    },
    {
        number: "C7.5.4.4",
        title: "PANNELLI D’ANIMA DEI COLLEGAMENTI TRAVE-COLONNA",
        page: 222,
        blocks: [
            p(222, "Affinché il pannello d’anima della colonna possa sostenere lo sviluppo del meccanismo dissipativo globale a telaio, secondo uno degli schemi proposti nella Figura C7.5.1, è necessario che la forza di taglio trasmessa dalle travi al pannello d’anima della colonna sia calcolata in condizioni di collasso. Per tale motivo la forza con cui è necessario confrontare la resistenza a taglio di progetto del pannello, V_WP,Rd, non deriva dalle sollecitazioni di calcolo ottenute dall’analisi strutturale, bensì dal momento plastico resistente delle travi concorrenti tramite la formula"),
            formula(222, "C7.5.1"),
            p(222, "dove Σ M_b,pl,Rd è la sommatoria dei momenti plastici resistenti delle travi, H è l’altezza di interpiano del telaio, z è il braccio di coppia interna della trave ed h_b è l’altezza della sezione della trave. La resistenza del pannello nodale privo di piatti di irrigidimento e/o continuità, ove i fenomeni di instabilità non siano condizionanti, è data da"),
            formula(223, "C7.5.2"),
            p(223, "dove A_VC (§ 4.2.4.1.2.4) è l’area resistente a taglio, mentre σ è la tensione normale media agente nel pannello dovuta allo sforzo normale di calcolo presente nella colonna."),
            p(223, "In Figura C7.5.2 sono rappresentati i dettagli costruttivi dei pannelli nodali, cui è necessario fare riferimento per il calcolo della resistenza a taglio. Nel caso di collegamenti trave-colonna saldati i piatti di continuità in prosecuzione delle ali della trave devono essere sempre previsti."),
            figure(223, "C7.5.2", { x: 70, y: 190, width: 450, height: 150 }),
        ],
    },
    {
        number: "C7.5.5",
        title: "REGOLE DI PROGETTO SPECIFICHE PER STRUTTURE CON CONTROVENTI CONCENTRICI",
        page: 223,
        blocks: [
            p(223, "La risposta carico-spostamento laterale di una struttura con controventi concentrici deve risultare sostanzialmente indipendente dal verso dell’azione sismica. Tale requisito si ritiene soddisfatto se ad ogni piano vale la seguente disuguaglianza:"),
            formula(223, "C7.5.3"),
            p(223, "essendo A+ e A- le proiezioni verticali delle sezioni trasversali delle diagonali tese, valutate per i due versi possibili delle azioni sismiche, secondo quanto presentato nella Figura C7.5.3."),
            figure(223, "C7.5.3", { x: 65, y: 455, width: 470, height: 200 }),
        ],
    },
    {
        number: "C7.5.6",
        title: "REGOLE DI PROGETTO SPECIFICHE PER STRUTTURE CON CONTROVENTI ECCENTRICI",
        page: 223,
        blocks: [
            p(223, "Le capacità dissipative di un elemento di connessione (“link”) di una struttura a controventi eccentrici dipendono dai dettagli strutturali con cui è realizzato tale elemento. In particolare, la presenza degli irrigidimenti trasversali d’anima garantisce lo sviluppo delle deformazioni plastiche all’interno del “link”, per cui le regole costruttive presentate in § 7.5.6 devono essere necessariamente impiegate per la realizzazione di “link”, sia lunghi sia corti."),
            figure(224, "C7.5.4", { x: 45, y: 75, width: 510, height: 390 }),
            p(224, "Per quanto riguarda gli elementi di connessione corti, l’instabilità inelastica a taglio potrebbe limitare la capacità dissipativa di tali elementi che potrebbero, quindi, non raggiungere la necessaria capacità rotazionale (espressa in termini di mrad). Pertanto, allo scopo di migliorare la duttilità locale, devono essere impiegati degli irrigidimenti d’anima il cui interasse “a”, perché si raggiunga un’adeguata capacità deformativa, deve soddisfare le limitazioni presentate nella Figura C7.5.4 (a)."),
            p(224, "Il comportamento degli elementi di connessione lunghi è dominato dalla plasticizzazione per flessione per cui è necessario disporre irrigidimenti che coprano tutta l’altezza dell’anima del profilo. Anche nel caso di collegamenti “intermedi” o “lunghi” il passo degli irrigidimenti governa la capacità dissipativa dell’elemento. Per ottenere “link” di buone proprietà dissipative è necessario seguire le prescrizioni costruttive presentate nelle figure C7.5.4 (b) e C7.5.4 (c)."),
        ],
    },
];

const formulas = [
    {
        number: "C7.5.1",
        unit: "C7.5.4.4",
        page: 222,
        latex: "V_{WP,Ed,U}=\\gamma_{ov}\\,\\frac{\\sum M_{b,pl,Rd}}{Z}\\left(1-\\frac{z}{H-h_b}\\right)",
    },
    {
        number: "C7.5.2",
        unit: "C7.5.4.4",
        page: 223,
        latex: "V_{WP,Rd}\\ge\\frac{f_y}{\\sqrt{3}}\\,A_{VC}\\sqrt{1-\\left(\\frac{\\sigma}{f_y}\\right)^2}",
    },
    {
        number: "C7.5.3",
        unit: "C7.5.5",
        page: 223,
        latex: "\\left|\\frac{A^+-A^-}{A^++A^-}\\right|\\le0{,}05",
    },
];

const figures = [
    ["C7.5.1", "C7.5.2.1", 222, "Figura C7.5.1 - Configurazioni dissipative di strutture intelaiate: disposizione delle cerniere plastiche, secondo le tipologie esposte nella Tabella 7.3.II del § 7.3.1 delle NTC", [65, 225, 525, 340]],
    ["C7.5.2", "C7.5.4.4", 223, "Figura C7.5.2 - Dettagli costruttivi dei pannelli nodali irrigiditi", [70, 190, 520, 340]],
    ["C7.5.3", "C7.5.5", 223, "Figura C7.5.3 - Definizione dell’area delle sezioni dei controventi tesi, A+ ed A-, da utilizzare nella formula C7.5.3", [65, 455, 535, 655]],
    ["C7.5.4", "C7.5.6", 224, "Figura C7.5.4 - Dettagli costruttivi degli elementi di connessione", [45, 75, 555, 465]],
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
    const specs: Block[] = [h(unit.page, `${unit.number} ${unit.title}`), ...unit.blocks];
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
            createdBy: { actorId: "generator:circ75-step1", kind: "script", toolVersion: profile },
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
    section: "C7.5",
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
await writeFile(join(root, "corpus", "assets", "circ2019", "7.5.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(`circ75-step1: generated ${units.length} units, ${formulas.length} formulas and ${figures.length} figures`);
