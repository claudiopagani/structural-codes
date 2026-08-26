import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../", import.meta.url));
const unitDirectory = join(repoRoot, "corpus", "units", "ntc2018");
const assetDirectory = join(repoRoot, "corpus", "assets", "ntc2018");
const figurePath = join(repoRoot, "corpus", "assets", "figures", "ntc2018", "fig4.4.1.png");
const sourceId = "gu-so8-2018-ntc";
const workId = "it-mit:dm:2018-01-17:ntc2018";
const expressionId = "it-mit:dm:2018-01-17:ntc2018:original-it";
const profile = "ntc44-editorial-profile-0.1.0";
const createdAt = "2026-08-09T00:00:00Z";

type Inline =
    | { kind: "text"; value: string }
    | { kind: "math"; value: string; latex: string };
type TextBlockDef = { kind: "paragraph" | "list-item" | "heading"; page: number; text: string; inline?: Inline[] };
type BlockDef = TextBlockDef | { kind: "formula-ref" | "table-ref" | "figure-ref"; page: number; assetId: string };
type Cell = { text: string; latex?: string; colSpan?: number; rowSpan?: number };

const unitId = (number: string) => `urn:structural-codes:it:unit:ntc2018:${number}`;
const assetId = (kind: "formula" | "table" | "figure", name: string) =>
    `urn:structural-codes:it:asset:${kind}:ntc2018:${name}`;
const sha256 = (value: string | Uint8Array) => createHash("sha256").update(value).digest("hex");
const m = (value: string, latex: string): Inline => ({ kind: "math", value, latex });
const t = (value: string): Inline => ({ kind: "text", value });
const plain = (value: string): Inline[] => [t(value)];
const row = (...cells: Cell[]) => cells;
const cell = (text: string, options: Omit<Cell, "text"> = {}): Cell => ({ text, ...options });

function pageRegion(page: number) {
    void page;
    return { coordinateSystem: "pdf-points-top-left", x: 72, y: 80, width: 450, height: 700 };
}

function evidence(page: number, raw: string, normalized: string, asset = false) {
    return {
        sourceId,
        pdfPage: page,
        printedPage: String(page - 4),
        region: pageRegion(page),
        extraction: {
            method: asset ? "manual-transcription" : "pdf-text",
            tool: asset ? "codex-source-transcription" : "pdftotext",
            toolVersion: asset ? profile : "24.08.0",
        },
        transformations:
            raw === normalized
                ? []
                : [
                      {
                          operation: "join-line-wrap",
                          ruleVersion: profile,
                          note: "Unite le righe appartenenti allo stesso capoverso; conservati i capoversi e gli elenchi della fonte.",
                      },
                      {
                          operation: "normalize-whitespace",
                          ruleVersion: profile,
                          note: "Uniformati gli spazi dopo la ricomposizione delle righe.",
                      },
                      {
                          operation: "manual-correction",
                          ruleVersion: profile,
                          note: "Ripristinati gli accenti e i glifi matematici confrontati con il render ufficiale.",
                      },
                      {
                          operation: "unicode-nfc",
                          ruleVersion: profile,
                          note: "Testo normalizzato in Unicode NFC.",
                      },
                  ],
        rawSha256: sha256(raw),
        normalizedSha256: sha256(normalized),
    };
}

function makeBlock(number: string, index: number, def: BlockDef) {
    const blockId = `${unitId(number)}#block-${def.kind === "heading" ? "heading" : `editorial-${String(index).padStart(3, "0")}`}`;
    if ("assetId" in def) {
        return {
            blockId,
            kind: def.kind,
            origin: "official",
            assetId: def.assetId,
            evidence: evidence(def.page, def.assetId, def.assetId, true),
        };
    }
    const textDef: TextBlockDef = def;
    return {
        blockId,
        kind: textDef.kind,
        origin: "official",
        text: {
            raw: textDef.text,
            normalized: textDef.text,
            normalizationVersion: profile,
            inline: textDef.inline ?? plain(textDef.text),
        },
        evidence: evidence(textDef.page, textDef.text, textDef.text),
    };
}

function parent(number: string) {
    const parts = number.split(".");
    return parts.length === 1 ? null : unitId(parts.slice(0, -1).join("."));
}

function ancestors(number: string) {
    const parts = number.split(".");
    return parts.slice(1).map((_, index) => unitId(parts.slice(0, index + 1).join(".")));
}

function makeUnit(number: string, title: string, blocks: BlockDef[]) {
    const materialized = blocks.map((block, index) => makeBlock(number, index, block));
    const formulas = materialized.filter((block) => block.kind === "formula-ref").map((block) => block.assetId);
    const tables = materialized.filter((block) => block.kind === "table-ref").map((block) => block.assetId);
    const figures = materialized.filter((block) => block.kind === "figure-ref").map((block) => block.assetId);
    return {
        $schema: "urn:structural-codes:schema:canonical-unit:v2",
        schemaVersion: "2.0.0-alpha.2",
        recordType: "canonical-unit",
        id: unitId(number),
        workId,
        expressionId,
        kind: number === "4.4" ? "section" : "subparagraph",
        numbering: {
            official: number,
            sortKey: number.split(".").map((part) => part.padStart(3, "0")).join("."),
        },
        title,
        titleBlockId: `${unitId(number)}#block-heading`,
        hierarchy: {
            parentId: parent(number),
            ancestorIds: ancestors(number),
            position: Number(number.split(".").at(-1)),
        },
        validity: { from: "2018-03-22", to: null, status: "in-force", asOf: "2026-08-09" },
        blocks: materialized,
        citations: [],
        relations: [],
        assets: { formulaIds: formulas, tableIds: tables, figureIds: figures },
        workflow: {
            status: "extracted",
            createdBy: { actorId: "codex:ntc44-step1", kind: "automated-agent", toolVersion: profile },
            createdAt,
            reviews: [],
            openIssues: [
                {
                    issueId: `ntc2018-${number.replaceAll(".", "-")}-source-review`,
                    type: "normalization-review",
                    severity: "blocking",
                    note: "Record trascritto dall’evidence ufficiale ma non ancora confrontato integralmente da un revisore umano con il render della fonte.",
                },
                ...(formulas.length + tables.length + figures.length > 0
                    ? [
                          {
                              issueId: `ntc2018-${number.replaceAll(".", "-")}-assets`,
                              type: "asset-review",
                              severity: "blocking",
                              note: "Formule, tabelle e figure sono separate e collocate nel flusso originario; resta obbligatorio il confronto umano puntuale con la fonte ufficiale.",
                          },
                      ]
                    : []),
            ],
        },
    };
}

const h = (number: string, title: string, page: number): BlockDef => ({ kind: "heading", page, text: `${number} ${title}` });
const p = (page: number, text: string, inline?: Inline[]): BlockDef => ({ kind: "paragraph", page, text, inline });
const li = (page: number, text: string, inline?: Inline[]): BlockDef => ({ kind: "list-item", page, text, inline });
const f = (page: number, number: string): BlockDef => ({ kind: "formula-ref", page, assetId: assetId("formula", number) });
const tab = (page: number, number: string): BlockDef => ({ kind: "table-ref", page, assetId: assetId("table", number) });
const fig = (page: number, number: string): BlockDef => ({ kind: "figure-ref", page, assetId: assetId("figure", number) });

const formulaDefs = [
    ["4.4.1", "4.4.6", 137, String.raw`X_d=\frac{k_{\mathrm{mod}}X_k}{\gamma_M}`],
    ["4.4.2", "4.4.8.1.1", 140, String.raw`\sigma_{t,0,d}\le f_{t,0,d}`],
    ["4.4.3", "4.4.8.1.3", 140, String.raw`\sigma_{c,0,d}\le f_{c,0,d}`],
    ["4.4.4", "4.4.8.1.4", 140, String.raw`\sigma_{c,90,d}\le f_{c,90,d}`],
    ["4.4.5a", "4.4.8.1.6", 141, String.raw`\frac{\sigma_{m,y,d}}{f_{m,y,d}}+k_m\frac{\sigma_{m,z,d}}{f_{m,z,d}}\le1`],
    ["4.4.5b", "4.4.8.1.6", 141, String.raw`k_m\frac{\sigma_{m,y,d}}{f_{m,y,d}}+\frac{\sigma_{m,z,d}}{f_{m,z,d}}\le1`],
    ["4.4.6a", "4.4.8.1.7", 141, String.raw`\frac{\sigma_{t,0,d}}{f_{t,0,d}}+\frac{\sigma_{m,y,d}}{f_{m,y,d}}+k_m\frac{\sigma_{m,z,d}}{f_{m,z,d}}\le1`],
    ["4.4.6b", "4.4.8.1.7", 141, String.raw`\frac{\sigma_{t,0,d}}{f_{t,0,d}}+k_m\frac{\sigma_{m,y,d}}{f_{m,y,d}}+\frac{\sigma_{m,z,d}}{f_{m,z,d}}\le1`],
    ["4.4.7a", "4.4.8.1.8", 141, String.raw`\left(\frac{\sigma_{c,0,d}}{f_{c,0,d}}\right)^2+\frac{\sigma_{m,y,d}}{f_{m,y,d}}+k_m\frac{\sigma_{m,z,d}}{f_{m,z,d}}\le1`],
    ["4.4.7b", "4.4.8.1.8", 141, String.raw`\left(\frac{\sigma_{c,0,d}}{f_{c,0,d}}\right)^2+k_m\frac{\sigma_{m,y,d}}{f_{m,y,d}}+\frac{\sigma_{m,z,d}}{f_{m,z,d}}\le1`],
    ["4.4.8", "4.4.8.1.9", 141, String.raw`\tau_d\le f_{v,d},`],
    ["4.4.9", "4.4.8.1.10", 142, String.raw`\tau_{\mathrm{tor},d}\le k_{\mathrm{sh}}f_{v,d}`],
    ["4.4.10", "4.4.8.1.11", 142, String.raw`\frac{\tau_{\mathrm{tor},d}}{k_{\mathrm{sh}}f_{v,d}}+\left(\frac{\tau_d}{f_{v,d}}\right)^2\le1`],
    ["4.4.11", "4.4.8.2.1", 142, String.raw`\frac{\sigma_{m,d}}{k_{\mathrm{crit},m}f_{m,d}}\le1`],
    ["4.4.12", "4.4.8.2.1", 142, String.raw`k_{\mathrm{crit},m}=\begin{cases}1&\text{per }\lambda_{\mathrm{rel},m}\le0{,}75\\1{,}56-0{,}75\lambda_{\mathrm{rel},m}&\text{per }0{,}75<\lambda_{\mathrm{rel},m}\le1{,}4\\1/\lambda_{\mathrm{rel},m}^{2}&\text{per }1{,}4<\lambda_{\mathrm{rel},m}\end{cases}`],
    ["4.4.13", "4.4.8.2.2", 143, String.raw`\frac{\sigma_{c,0,d}}{k_{\mathrm{crit},c}f_{c,0,d}}\le1`],
    ["4.4.14", "4.4.8.2.2", 143, String.raw`\lambda_{\mathrm{rel},c}=\sqrt{\frac{f_{c,0,k}}{\sigma_{c,\mathrm{crit}}}}=\frac{\lambda}{\pi}\sqrt{\frac{f_{c,0,k}}{E_{0{,}05}}}`],
    ["4.4.15", "4.4.8.2.2", 143, String.raw`k_{\mathrm{crit},c}=\frac{1}{k+\sqrt{k^2-\lambda_{\mathrm{rel},c}^{2}}}`],
    ["4.4.16", "4.4.8.2.2", 143, String.raw`k=0{,}5\left(1+\beta_c(\lambda_{\mathrm{rel},c}-0{,}3)+\lambda_{\mathrm{rel},c}^{2}\right)`],
] as const;

const formulaAsset = ([number, unit, page, latex]: readonly [string, string, number, string]) => ({
    id: assetId("formula", number),
    unitId: unitId(unit),
    officialNumber: number,
    pdfPage: page,
    latex,
});

const table1 = assetId("table", "4.4.i");
const table2 = assetId("table", "4.4.ii");
const table3 = assetId("table", "4.4.iii");
const table4 = assetId("table", "4.4.iv");
const table5 = assetId("table", "4.4.v");
const figure1 = assetId("figure", "4.4.1");

const tables = [
    {
        id: table1,
        unitId: unitId("4.4.4"),
        officialNumber: "4.4.I",
        pdfPage: 137,
        caption: "Classi di durata del carico",
        columnCount: 2,
        headers: [[cell("Classe di durata del carico"), cell("Durata del carico")]],
        rows: [
            row(cell("Permanente"), cell("più di 10 anni")),
            row(cell("Lunga durata"), cell("6 mesi - 10 anni")),
            row(cell("Media durata"), cell("1 settimana – 6 mesi")),
            row(cell("Breve durata"), cell("meno di 1 settimana")),
            row(cell("Istantaneo"), cell("--")),
        ],
        notes: [],
    },
    {
        id: table2,
        unitId: unitId("4.4.5"),
        officialNumber: "4.4.II",
        pdfPage: 137,
        caption: "Classi di servizio",
        columnCount: 2,
        headers: [[cell("Classe di servizio"), cell("Descrizione")]],
        rows: [
            row(cell("Classe di servizio 1"), cell("È caratterizzata da un’umidità del materiale in equilibrio con l’ambiente a una temperatura di 20 °C e un’umidità relativa dell’aria circostante che non superi il 65%, se non per poche settimane all’anno.")),
            row(cell("Classe di servizio 2"), cell("É caratterizzata da un’umidità del materiale in equilibrio con l’ambiente a una temperatura di 20 °C e un’umidità relativa dell’aria circostante che superi l’85% solo per poche settimane all’anno.")),
            row(cell("Classe di servizio 3"), cell("È caratterizzata da umidità più elevata di quella della classe di servizio 2.")),
        ],
        notes: [],
    },
    {
        id: table3,
        unitId: unitId("4.4.6"),
        officialNumber: "4.4.III",
        pdfPage: 138,
        caption: "Coefficienti parziali γM per le proprietà dei materiali",
        columnCount: 3,
        headers: [[cell("Stati limite ultimi"), cell("Colonna A", { latex: "\\gamma_M" }), cell("Colonna B", { latex: "\\gamma_M" })]],
        rows: [
            [cell("combinazioni fondamentali", { colSpan: 3 })],
            row(cell("legno massiccio"), cell("1,50"), cell("1,45")),
            row(cell("legno lamellare incollato"), cell("1,45"), cell("1,35")),
            row(cell("pannelli di tavole incollate a strati incrociati"), cell("1,45"), cell("1,35")),
            row(cell("pannelli di particelle o di fibre"), cell("1,50"), cell("1,40")),
            row(cell("LVL, compensato, pannelli di scaglie orientate"), cell("1,40"), cell("1,30")),
            row(cell("unioni"), cell("1,50"), cell("1,40")),
            row(cell("combinazioni eccezionali"), cell("1,00"), cell("1,00")),
            [cell(""), cell("Per i materiali non compresi nella Tabella si potrà fare riferimento ai pertinenti valori riportati nei riferimenti tecnici di comprovata validità indicati nel Capitolo 12, nel rispetto dei livelli di sicurezza delle presenti norme.", { colSpan: 2 })],
        ],
        notes: [],
    },
    {
        id: table4,
        unitId: unitId("4.4.7"),
        officialNumber: "4.4.IV",
        pdfPage: 138,
        caption: "Valori di kmod per legno e prodotti strutturali a base di legno",
        columnCount: 9,
        headers: [
            [cell("Materiale", { rowSpan: 2 }), cell("Riferimento", { colSpan: 2, rowSpan: 2 }), cell("Classe di servizio", { rowSpan: 2 }), cell("Classe di durata del carico", { colSpan: 5 })],
            [cell("Permanente"), cell("Lunga"), cell("Media"), cell("Breve"), cell("Istantanea")],
        ],
        rows: [
            row(cell("Legno massiccio\nLegno lamellare incollato (*)\nLVL", { rowSpan: 3 }), cell("UNI EN 14081-1\nUNI EN 14080\nUNI EN 14374, UNI EN 14279", { colSpan: 2, rowSpan: 3 }), cell("1"), cell("0,60"), cell("0,70"), cell("0,80"), cell("0,90"), cell("1,10")),
            row(cell("2"), cell("0,60"), cell("0,70"), cell("0,80"), cell("0,90"), cell("1,10")),
            row(cell("3"), cell("0,50"), cell("0,55"), cell("0,65"), cell("0,70"), cell("0,90")),
            row(cell("Compensato", { rowSpan: 3 }), cell("UNI EN 636:2015", { colSpan: 2, rowSpan: 3 }), cell("1"), cell("0,60"), cell("0,70"), cell("0,80"), cell("0,90"), cell("1,10")),
            row(cell("2"), cell("0,60"), cell("0,70"), cell("0,80"), cell("0,90"), cell("1,10")),
            row(cell("3"), cell("0,50"), cell("0,55"), cell("0,65"), cell("0,70"), cell("0,90")),
            row(cell("Pannello di scaglie orientate (OSB)", { rowSpan: 3 }), cell("UNI EN 300:2006", { rowSpan: 3 }), cell("OSB/2"), cell("1"), cell("0,30"), cell("0,45"), cell("0,65"), cell("0,85"), cell("1,10")),
            row(cell("OSB/3 –"), cell("1"), cell("0,40"), cell("0,50"), cell("0,70"), cell("0,90"), cell("1,10")),
            row(cell("OSB/4"), cell("2"), cell("0,30"), cell("0,40"), cell("0,55"), cell("0,70"), cell("0,90")),
            row(cell("Pannello di particelle (truciolare)", { rowSpan: 4 }), cell("UNI EN 312 :2010", { rowSpan: 4 }), cell("Parti 4, 5"), cell("1"), cell("0,30"), cell("0,45"), cell("0,65"), cell("0,85"), cell("1,10")),
            row(cell("Parte 5"), cell("2"), cell("0,20"), cell("0,30"), cell("0,45"), cell("0,60"), cell("0,80")),
            row(cell("Parti 6, 7"), cell("1"), cell("0,40"), cell("0,50"), cell("0,70"), cell("0,90"), cell("1,10")),
            row(cell("Parte 7"), cell("2"), cell("0,30"), cell("0,40"), cell("0,55"), cell("0,70"), cell("0,90")),
            row(cell("Pannello di fibre, pannelli duri", { rowSpan: 2 }), cell("UNI EN 622-2::2005", { rowSpan: 2 }), cell("HB.LA,\nHB.HLA 1 o 2"), cell("1"), cell("0,30"), cell("0,45"), cell("0,65"), cell("0,85"), cell("1,10")),
            row(cell("HB.HLA 1 o 2"), cell("2"), cell("0,20"), cell("0,30"), cell("0,45"), cell("0,60"), cell("0,80")),
            row(cell("Pannello di fibre, pannelli semiduri", { rowSpan: 3 }), cell("UNI EN 622-3:2005", { rowSpan: 3 }), cell("MBH.LA1 o 2"), cell("1"), cell("0,20"), cell("0,40"), cell("0,60"), cell("0,80"), cell("1,10")),
            row(cell("MBH.HLS1 o\n2", { rowSpan: 2 }), cell("1"), cell("0,20"), cell("0,40"), cell("0,60"), cell("0,80"), cell("1,10")),
            row(cell("2"), cell("-"), cell("-"), cell("-"), cell("0,45"), cell("0,80")),
            row(cell("Pannello di fibra di legno, ottenuto per via secca (MDF)", { rowSpan: 2 }), cell("UNI EN 622-5:2010", { rowSpan: 2 }), cell("MDF.LA,\nMDF.HLS"), cell("1"), cell("0,20"), cell("0,40"), cell("0,60"), cell("0,80"), cell("1,10")),
            row(cell("MDF.HLS"), cell("2"), cell("-"), cell("-"), cell("-"), cell("0,45"), cell("0,80")),
        ],
        notes: [
            "Per i materiali non compresi nella Tabella si potrà fare riferimento ai pertinenti valori riportati nei riferimenti tecnici di comprovata validità indicati nel Capitolo 12, nel rispetto dei livelli di sicurezza delle presenti norme.",
            "(*) I valori indicati si possono adottare anche per i pannelli di tavole incollate a strati incrociati, ma limitatamente alle classi di servizio 1 e 2.",
        ],
    },
    {
        id: table5,
        unitId: unitId("4.4.7"),
        officialNumber: "4.4.V",
        pdfPage: 139,
        caption: "Valori di kdef per legno e prodotti strutturali a base di legno",
        columnCount: 6,
        headers: [
            [cell("Materiale", { rowSpan: 2 }), cell("Riferimento", { colSpan: 2, rowSpan: 2 }), cell("Classe di servizio", { colSpan: 3 })],
            [cell("1"), cell("2"), cell("3")],
        ],
        rows: [
            row(cell("Legno massiccio"), cell("UNI EN 14081-1", { colSpan: 2 }), cell("0,60"), cell("0,80"), cell("2,00")),
            row(cell("Legno lamellare incollato *"), cell("UNI EN 14080", { colSpan: 2 }), cell("0,60"), cell("0,80"), cell("2,00")),
            row(cell("LVL"), cell("UNI EN 14374, UNI EN 14279", { colSpan: 2 }), cell("0,60"), cell("0,80"), cell("2,00")),
            row(cell("Compensato", { rowSpan: 3 }), cell("UNI EN 636:2015", { rowSpan: 3 }), cell(""), cell("0,80"), cell("-"), cell("-")),
            row(cell(""), cell("0,80"), cell("1,00"), cell("-")),
            row(cell(""), cell("0,80"), cell("1,00"), cell("2,50")),
            row(cell("Pannelli di scaglie orientate (OSB)", { rowSpan: 2 }), cell("UNI EN 300:2006", { rowSpan: 2 }), cell("OSB/2"), cell("2,25"), cell("-"), cell("-")),
            row(cell("OSB/3 OSB/4"), cell("1,50"), cell("2,25"), cell("-")),
            row(cell("Pannello di particelle (truciolare)", { rowSpan: 4 }), cell("UNI EN 312:2010", { rowSpan: 4 }), cell("Parte 4"), cell("2,25"), cell("-"), cell("-")),
            row(cell("Parte 5"), cell("2,25"), cell("3,00"), cell("-")),
            row(cell("Parte 6"), cell("1,50"), cell("-"), cell("-")),
            row(cell("Parte 7"), cell("1,50"), cell("2,25"), cell("-")),
            row(cell("Pannello di fibre, pannelli duri", { rowSpan: 2 }), cell("UNI EN 622-2::2005", { rowSpan: 2 }), cell("HB.LA"), cell("2,25"), cell("-"), cell("-")),
            row(cell("HB.HLA1,\nHB.HLA2"), cell("2,25"), cell("3,00"), cell("-")),
            row(cell("Pannello di fibre, pannelli semiduri", { rowSpan: 2 }), cell("UNI EN 622-3:2005", { rowSpan: 2 }), cell("MBH.LA1,\nMBH.LA2"), cell("3,00"), cell("-"), cell("-")),
            row(cell("MBH.HLS1,\nMBH.HLS2"), cell("3,00"), cell("4,00"), cell("-")),
            row(cell("Pannello di fibra di legno, ottenuto per via secca (MDF)", { rowSpan: 2 }), cell("UNI EN 622-5:2010", { rowSpan: 2 }), cell("MDF.LA"), cell("2,25"), cell("-"), cell("-")),
            row(cell("MDF.HLS"), cell("2,25"), cell("3,00"), cell("-")),
        ],
        notes: [
            "Per materiale posto in opera con umidità prossima al punto di saturazione delle fibre, e che possa essere soggetto a essiccazione sotto carico, il valore di kdef dovrà, in assenza di idonei provvedimenti, essere aumentato a seguito di opportune valutazioni, sommando ai termini della tabella un valore comunque non inferiore a 2,0.",
            "Per i materiali non compresi nella Tabella si potrà fare riferimento ai pertinenti valori riportati nei riferimenti tecnici di comprovata validità indicati nel Capitolo 12, nel rispetto dei livelli di sicurezza delle presenti norme.",
            "* I valori indicati si possono adottare anche per i pannelli di tavole incollate a strati incrociati, ma limitatamente alle classi di servizio 1 e 2.",
        ],
    },
];

const blocksByUnit: Record<string, BlockDef[]> = {
    "4.4": [
        h("4.4", "COSTRUZIONI DI LEGNO", 136),
        p(136, "Formano oggetto delle presenti norme le opere costituite da strutture portanti realizzate con elementi di legno strutturale o con prodotti strutturali a base di legno."),
        p(136, "I materiali e i prodotti devono rispondere ai requisiti indicati nel § 11.7."),
        p(136, "Tutto il legno per impieghi strutturali deve essere classificato secondo la resistenza, prima della sua messa in opera."),
        p(136, "La presente norma può essere usata anche per le verifiche di strutture in legno esistenti purché si provveda ad una corretta valutazione delle caratteristiche del legno e, in particolare, degli eventuali stati di degrado."),
    ],
    "4.4.1": [
        h("4.4.1", "VALUTAZIONE DELLA SICUREZZA", 136),
        p(136, "La valutazione della sicurezza deve essere effettuata secondo i principi fondamentali illustrati nel Capitolo 2."),
        p(136, "La valutazione della sicurezza deve essere svolta secondo il metodo degli stati limite."),
        p(136, "I requisiti richiesti di resistenza, rigidezza, funzionalità, durabilità e robustezza si garantiscono verificando gli stati limite ultimi e gli stati limite di esercizio della struttura, dei singoli componenti strutturali e dei collegamenti."),
    ],
    "4.4.2": [
        h("4.4.2", "ANALISI STRUTTURALE", 136),
        p(136, "L’analisi della struttura si può effettuare assumendo un comportamento elastico lineare dei materiali e dei collegamenti considerando i valori pertinenti (medi o caratteristici) del modulo elastico dei materiali e della rigidezza delle unioni, in funzione dello stato limite e del tipo di verifica considerati."),
        p(136, "I calcoli devono essere svolti usando appropriate schematizzazioni e, se necessario, supportati da prove. Lo schema adottato deve essere sufficientemente accurato per simulare con ragionevole precisione il comportamento strutturale della costruzione, anche in relazione alle modalità costruttive previste."),
        p(136, "Nell’analisi globale della struttura, in quella dei sistemi di controvento e nel calcolo delle membrature si deve tener conto delle imperfezioni geometriche e strutturali."),
        p(136, "A tal fine possono adottarsi adeguate imperfezioni geometriche equivalenti, il valore delle quali può essere reperito in normative di comprovata validità."),
        p(136, "Per quelle tipologie strutturali in grado di ridistribuire le azioni interne, anche grazie alla presenza di giunti di adeguata duttilità, si può far uso di metodi di analisi non lineari."),
        p(136, "In presenza di giunti meccanici si deve, di regola, considerare l’influenza della deformabilità degli stessi."),
        p(136, "Per tutte le strutture, in particolare per quelle composte da parti con diverso comportamento reologico, le verifiche, per gli stati limite ultimi e di esercizio, devono essere effettuate con riferimento, oltre che alle condizioni iniziali, anche alle condizioni finali (a tempo infinito)."),
    ],
    "4.4.3": [
        h("4.4.3", "AZIONI E LORO COMBINAZIONI", 137),
        p(137, "Le azioni caratteristiche devono essere definite in accordo con quanto indicato nei Capitoli 3 e 2 delle presenti norme."),
        p(137, "Per costruzioni civili o industriali per le quali non esistano regolamentazioni specifiche, le azioni di progetto si devono determinare secondo quanto indicato nel Capitolo 2."),
    ],
    "4.4.4": [
        h("4.4.4", "CLASSI DI DURATA DEL CARICO", 137),
        p(137, "Le azioni di progetto devono essere assegnate ad una delle classi di durata del carico elencate nella Tab. 4.4.I."),
        tab(137, "4.4.i"),
        p(137, "Le classi di durata del carico si riferiscono a un carico costante attivo per un certo periodo di tempo nella vita della struttura. Per un’azione variabile la classe appropriata deve essere determinata in funzione dell’interazione fra la variazione temporale tipica del carico nel tempo e le proprietà reologiche dei materiali."),
        p(137, "Ai fini del calcolo in genere si può assumere quanto segue:"),
        li(137, "il peso proprio e i carichi non rimovibili durante il normale esercizio della struttura, appartengono alla classe di durata permanente;"),
        li(137, "i carichi permanenti suscettibili di cambiamenti durante il normale esercizio della struttura e i carichi variabili relativi a magazzini e depositi, appartengono alla classe di lunga durata;"),
        li(137, "i carichi variabili degli edifici, ad eccezione di quelli relativi a magazzini e depositi, appartengono alla classe di media durata;"),
        li(137, "il sovraccarico da neve riferito al suolo qsk, calcolato in uno specifico sito ad una certa altitudine, è da attribuire ad una classe di durata del carico da considerarsi in funzione delle caratteristiche del sito per altitudini di riferimento as inferiori a 1000 m, mentre è da considerarsi almeno di media durata per altitudini as superiori o uguali a 1000 m;", [t("il sovraccarico da neve riferito al suolo "), m("qsk", "q_{sk}"), t(", calcolato in uno specifico sito ad una certa altitudine, è da attribuire ad una classe di durata del carico da considerarsi in funzione delle caratteristiche del sito per altitudini di riferimento "), m("as", "a_s"), t(" inferiori a "), m("1000 m", "1000\\,\\mathrm{m}"), t(", mentre è da considerarsi almeno di media durata per altitudini "), m("as", "a_s"), t(" superiori o uguali a "), m("1000 m", "1000\\,\\mathrm{m}"), t(";")]),
        li(137, "l’azione del vento medio appartiene alla classe di breve durata;"),
        li(137, "l’azione di picco del vento e le azioni eccezionali in genere appartengono alla classe di durata istantanea;"),
    ],
    "4.4.5": [
        h("4.4.5", "CLASSI DI SERVIZIO", 137),
        p(137, "Le strutture (o parti di esse) devono essere assegnate ad una delle 3 classi di servizio elencate nella Tab. 4.4.II."),
        p(137, "Il sistema delle classi di servizio ha lo scopo di definire la dipendenza delle resistenze di progetto e dei moduli elastici del legno e materiali da esso derivati dalle condizioni ambientali."),
        tab(137, "4.4.ii"),
    ],
    "4.4.6": [
        h("4.4.6", "RESISTENZA DI PROGETTO", 137),
        p(137, "La durata del carico e l’umidità del legno influiscono sulle proprietà resistenti del legno."),
        p(137, "I valori di progetto per le proprietà del materiale a partire dai valori caratteristici si assegnano quindi con riferimento combinato alle classi di servizio e alle classi di durata del carico."),
        p(137, "Il valore di progetto Xd di una proprietà del materiale (o della resistenza di un collegamento) viene calcolato mediante la relazione:", [t("Il valore di progetto "), m("Xd", "X_d"), t(" di una proprietà del materiale (o della resistenza di un collegamento) viene calcolato mediante la relazione:")]),
        f(137, "4.4.1"),
        p(137, "dove:"),
        p(137, "Xk è il valore caratteristico della proprietà del materiale, come specificato al § 11.7, o della resistenza del collegamento. Il valore caratteristico Xk può anche essere determinato mediante prove sperimentali sulla base di prove svolte in condizioni definite dalle norme europee applicabili, come riportato nel paragrafo 11.7.", [m("Xk", "X_k"), t(" è il valore caratteristico della proprietà del materiale, come specificato al § 11.7, o della resistenza del collegamento. Il valore caratteristico "), m("Xk", "X_k"), t(" può anche essere determinato mediante prove sperimentali sulla base di prove svolte in condizioni definite dalle norme europee applicabili, come riportato nel paragrafo 11.7.")]),
        p(137, "γM è il coefficiente parziale di sicurezza relativo al materiale, i cui valori sono riportati nella Tab. 4.4.III.", [m("γM", "\\gamma_M"), t(" è il coefficiente parziale di sicurezza relativo al materiale, i cui valori sono riportati nella Tab. 4.4.III.")]),
        p(137, "kmod è un coefficiente correttivo che tiene conto dell’effetto, sui parametri di resistenza, sia della durata del carico sia dell’umidità della struttura. I valori di kmod sono forniti nella Tab. 4.4.IV.", [m("kmod", "k_{\\mathrm{mod}}"), t(" è un coefficiente correttivo che tiene conto dell’effetto, sui parametri di resistenza, sia della durata del carico sia dell’umidità della struttura. I valori di "), m("kmod", "k_{\\mathrm{mod}}"), t(" sono forniti nella Tab. 4.4.IV.")]),
        p(138, "Se una combinazione di carico comprende azioni appartenenti a differenti classi di durata del carico si dovrà scegliere un valore di kmod che corrisponde all’azione di minor durata.", [t("Se una combinazione di carico comprende azioni appartenenti a differenti classi di durata del carico si dovrà scegliere un valore di "), m("kmod", "k_{\\mathrm{mod}}"), t(" che corrisponde all’azione di minor durata.")]),
        p(138, "Il coefficiente γM è valutato secondo la colonna A della tabella 4.4.III. Si possono assumere i valori riportati nella colonna B della stessa tabella, per produzioni continuative di elementi o strutture, soggette a controllo continuativo del materiale dal quale risulti un coefficiente di variazione (rapporto tra scarto quadratico medio e valor medio) della resistenza non superiore al 15%. Le suddette produzioni devono essere inserite in un sistema di qualità di cui al § 11.7.", [t("Il coefficiente "), m("γM", "\\gamma_M"), t(" è valutato secondo la colonna A della tabella 4.4.III. Si possono assumere i valori riportati nella colonna B della stessa tabella, per produzioni continuative di elementi o strutture, soggette a controllo continuativo del materiale dal quale risulti un coefficiente di variazione (rapporto tra scarto quadratico medio e valor medio) della resistenza non superiore al "), m("15%", "15\\%"), t(". Le suddette produzioni devono essere inserite in un sistema di qualità di cui al § 11.7.")]),
        tab(138, "4.4.iii"),
    ],
    "4.4.7": [
        h("4.4.7", "STATI LIMITE DI ESERCIZIO", 138),
        p(138, "Le deformazioni di una struttura, dovute agli effetti delle azioni applicate, degli stati di coazione, delle variazioni di umidità e degli scorrimenti nelle unioni, devono essere contenute entro limiti accettabili, sia in relazione ai danni che possono essere indotti ai materiali di rivestimento, ai pavimenti, alle tramezzature e, più in generale, alle finiture, sia in relazione ai requisiti estetici ed alla funzionalità dell’opera."),
        p(138, "In generale nella valutazione delle deformazioni delle strutture si deve tener conto della deformabilità dei collegamenti."),
        p(138, "Considerando il particolare comportamento reologico del legno e dei materiali derivati dal legno, si devono valutare sia la deformazione istantanea sia la deformazione a lungo termine."),
        p(138, "La deformazione istantanea si calcola usando i valori medi dei moduli elastici per le membrature e il valore istantaneo del modulo di scorrimento dei collegamenti."),
        tab(138, "4.4.iv"),
        p(139, "La deformazione a lungo termine può essere calcolata utilizzando i valori medi dei moduli elastici ridotti opportunamente mediante il fattore 1/(1+kdef), per le membrature, e utilizzando un valore ridotto nello stesso modo del modulo di scorrimento dei collegamenti.", [t("La deformazione a lungo termine può essere calcolata utilizzando i valori medi dei moduli elastici ridotti opportunamente mediante il fattore "), m("1/(1+kdef)", "\\frac{1}{1+k_{\\mathrm{def}}}"), t(", per le membrature, e utilizzando un valore ridotto nello stesso modo del modulo di scorrimento dei collegamenti.")]),
        p(139, "Il coefficiente kdef tiene conto dell’aumento di deformabilità con il tempo causato dall’effetto combinato della viscosità, dell’umidità del materiale e delle sue variazioni. I valori di kdef sono riportati nella Tab. 4.4.V.", [t("Il coefficiente "), m("kdef", "k_{\\mathrm{def}}"), t(" tiene conto dell’aumento di deformabilità con il tempo causato dall’effetto combinato della viscosità, dell’umidità del materiale e delle sue variazioni. I valori di "), m("kdef", "k_{\\mathrm{def}}"), t(" sono riportati nella Tab. 4.4.V.")]),
        p(139, "La freccia (valore dello spostamento ortogonale all’asse dell’elemento) netta di un elemento inflesso è data dalla somma della freccia dovuta ai soli carichi permanenti, della freccia dovuta ai soli carichi variabili, dedotta dalla eventuale controfreccia (qualora presente)."),
        p(139, "Nei casi in cui sia opportuno limitare la freccia istantanea dovuta ai soli carichi variabili nella combinazione di carico rara, in mancanza di più precise indicazioni, si raccomanda che essa sia inferiore a L/300, essendo L la luce dell’elemento o, nel caso di mensole, il doppio dello sbalzo.", [t("Nei casi in cui sia opportuno limitare la freccia istantanea dovuta ai soli carichi variabili nella combinazione di carico rara, in mancanza di più precise indicazioni, si raccomanda che essa sia inferiore a "), m("L/300", "L/300"), t(", essendo "), m("L", "L"), t(" la luce dell’elemento o, nel caso di mensole, il doppio dello sbalzo.")]),
        p(139, "Nei casi in cui sia opportuno limitare la freccia finale, in mancanza di più precise indicazioni, si raccomanda che essa sia inferiore a L/200, essendo L la luce dell’elemento o, nel caso di mensole, il doppio dello sbalzo.", [t("Nei casi in cui sia opportuno limitare la freccia finale, in mancanza di più precise indicazioni, si raccomanda che essa sia inferiore a "), m("L/200", "L/200"), t(", essendo "), m("L", "L"), t(" la luce dell’elemento o, nel caso di mensole, il doppio dello sbalzo.")]),
        p(139, "Per il calcolo della freccia finale si potrà fare utile riferimento ai documenti di comprovata validità cui al capitolo 12."),
        p(139, "I limiti indicati per la freccia costituiscono solo requisiti minimi indicativi. Limitazioni più severe possono rivelarsi necessarie in casi particolari, ad esempio in relazione ad elementi portati non facenti parte della struttura. In generale, nel caso di impalcati, si raccomanda la verifica della compatibilità della deformazione con la destinazione d’uso."),
        tab(139, "4.4.v"),
    ],
    "4.4.8": [h("4.4.8", "STATI LIMITE ULTIMI", 139)],
    "4.4.8.1": [
        h("4.4.8.1", "VERIFICHE DI RESISTENZA", 139),
        p(139, "Le tensioni interne si possono calcolare nell’ipotesi di conservazione delle sezioni piane e di una relazione lineare tra tensioni e deformazioni fino alla rottura."),
        p(139, "Le resistenze di progetto dei materiali Xd sono quelle definite al § 4.4.6.", [t("Le resistenze di progetto dei materiali "), m("Xd", "X_d"), t(" sono quelle definite al § 4.4.6.")]),
        p(140, "Le prescrizioni del presente paragrafo si riferiscono alla verifica di resistenza di elementi strutturali in legno massiccio o di prodotti derivati dal legno aventi direzione della fibratura coincidente sostanzialmente con il proprio asse longitudinale e sezione trasversale costante, soggetti a sforzi agenti prevalentemente lungo uno o più assi principali dell’elemento stesso (Fig. 4.4.1)."),
        p(140, "A causa dell’anisotropia del materiale, le verifiche degli stati tensionali di trazione e compressione si devono eseguire tenendo conto dell’angolo tra direzione della fibratura e direzione della tensione."),
        fig(140, "4.4.1"),
    ],
    "4.4.8.1.1": [
        h("4.4.8.1.1", "Trazione parallela alla fibratura", 140),
        p(140, "Deve essere soddisfatta la seguente condizione:"), f(140, "4.4.2"),
        p(140, "dove:"),
        p(140, "σt,0,d è la tensione di progetto a trazione parallela alla fibratura valutata sulla sezione netta;", [m("σt,0,d", "\\sigma_{t,0,d}"), t(" è la tensione di progetto a trazione parallela alla fibratura valutata sulla sezione netta;")]),
        p(140, "ft,0,d è la corrispondente resistenza di progetto (formula 4.4.1), determinata tenendo conto anche delle dimensioni della sezione trasversale mediante il coefficiente kh, come definito al § 11.7.1.1.", [m("ft,0,d", "f_{t,0,d}"), t(" è la corrispondente resistenza di progetto (formula 4.4.1), determinata tenendo conto anche delle dimensioni della sezione trasversale mediante il coefficiente "), m("kh", "k_h"), t(", come definito al § 11.7.1.1.")]),
        p(140, "Nelle giunzioni di estremità si dovrà tener conto dell’eventuale azione flettente indotta dall’eccentricità dell’azione di trazione attraverso il giunto: tali azioni secondarie potranno essere computate, in via approssimata, attraverso una opportuna riduzione della resistenza di progetto a trazione."),
    ],
    "4.4.8.1.2": [
        h("4.4.8.1.2", "Trazione perpendicolare alla fibratura", 140),
        p(140, "Nella verifica degli elementi si dovrà opportunamente tener conto del volume effettivamente sollecitato a trazione. Per tale verifica si dovrà far riferimento a normative di comprovata validità."),
        p(140, "Particolare attenzione dovrà essere posta nella verifica degli elementi soggetti a forze trasversali applicate in prossimità dei bordi della sezione in direzione tale da indurre tensione di trazione perpendicolare alla fibratura."),
    ],
    "4.4.8.1.3": [
        h("4.4.8.1.3", "Compressione parallela alla fibratura", 140),
        p(140, "Deve essere soddisfatta la seguente condizione:"), f(140, "4.4.3"),
        p(140, "dove:"),
        p(140, "σc,0,d è la tensione di progetto a compressione parallela alla fibratura;", [m("σc,0,d", "\\sigma_{c,0,d}"), t(" è la tensione di progetto a compressione parallela alla fibratura;")]),
        p(140, "fc,0,d è la corrispondente resistenza di progetto (formula 4.4.1). Deve essere inoltre effettuata la verifica di stabilità per elementi compressi, come definita al § 4.4.8.2.2.", [m("fc,0,d", "f_{c,0,d}"), t(" è la corrispondente resistenza di progetto (formula 4.4.1). Deve essere inoltre effettuata la verifica di stabilità per elementi compressi, come definita al § 4.4.8.2.2.")]),
    ],
    "4.4.8.1.4": [
        h("4.4.8.1.4", "Compressione perpendicolare alla fibratura", 140),
        p(140, "Deve essere soddisfatta la seguente condizione:"), f(140, "4.4.4"),
        p(140, "dove:"),
        p(140, "σc,90,d è la tensione di progetto a compressione ortogonale alla fibratura;", [m("σc,90,d", "\\sigma_{c,90,d}"), t(" è la tensione di progetto a compressione ortogonale alla fibratura;")]),
        p(140, "fc,90,d è la corrispondente resistenza di progetto (formula 4.4.1).", [m("fc,90,d", "f_{c,90,d}"), t(" è la corrispondente resistenza di progetto (formula 4.4.1).")]),
        p(140, "Nella valutazione di σc,90,d è possibile tenere conto della ripartizione del carico nella direzione della fibratura lungo l’altezza della sezione trasversale dell’elemento. È possibile, con riferimento a normative di comprovata validità, tener conto di una larghezza efficace maggiore di quella di carico.", [t("Nella valutazione di "), m("σc,90,d", "\\sigma_{c,90,d}"), t(" è possibile tenere conto della ripartizione del carico nella direzione della fibratura lungo l’altezza della sezione trasversale dell’elemento. È possibile, con riferimento a normative di comprovata validità, tener conto di una larghezza efficace maggiore di quella di carico.")]),
    ],
    "4.4.8.1.5": [
        h("4.4.8.1.5", "Compressione inclinata rispetto alla fibratura", 140),
        p(140, "Nel caso di tensioni di compressione agenti lungo una direzione inclinata rispetto alla fibratura si deve opportunamente tener conto della sua influenza sulla resistenza, facendo riferimento a normative di comprovata validità."),
    ],
    "4.4.8.1.6": [
        h("4.4.8.1.6", "Flessione", 141),
        p(141, "Devono essere soddisfatte entrambe le condizioni seguenti:"), f(141, "4.4.5a"), f(141, "4.4.5b"),
        p(141, "dove:"),
        p(141, "σm,y,d e σm,z,d sono le tensioni di progetto massime per flessione rispettivamente nei piani xz e xy determinate assumendo una distribuzione elastico lineare delle tensioni sulla sezione (vedi Fig. 4.4.1);", [m("σm,y,d", "\\sigma_{m,y,d}"), t(" e "), m("σm,z,d", "\\sigma_{m,z,d}"), t(" sono le tensioni di progetto massime per flessione rispettivamente nei piani "), m("xz", "xz"), t(" e "), m("xy", "xy"), t(" determinate assumendo una distribuzione elastico lineare delle tensioni sulla sezione (vedi Fig. 4.4.1);")]),
        p(141, "fm,y,d e fm,z,d sono le corrispondenti resistenze di progetto a flessione (formula 4.4.1), determinate tenendo conto anche delle dimensioni della sezione trasversale mediante il coefficiente kh, come definito al § 11.7.1.1.", [m("fm,y,d", "f_{m,y,d}"), t(" e "), m("fm,z,d", "f_{m,z,d}"), t(" sono le corrispondenti resistenze di progetto a flessione (formula 4.4.1), determinate tenendo conto anche delle dimensioni della sezione trasversale mediante il coefficiente "), m("kh", "k_h"), t(", come definito al § 11.7.1.1.")]),
        p(141, "I valori da adottare per il coefficiente km, che tiene conto convenzionalmente della ridistribuzione delle tensioni e della disomogeneità del materiale nella sezione trasversale, sono:", [t("I valori da adottare per il coefficiente "), m("km", "k_m"), t(", che tiene conto convenzionalmente della ridistribuzione delle tensioni e della disomogeneità del materiale nella sezione trasversale, sono:")]),
        li(141, "km = 0,7 per sezioni trasversali rettangolari;", [m("km = 0,7", "k_m=0{,}7"), t(" per sezioni trasversali rettangolari;")]),
        li(141, "km = 1,0 per altre sezioni trasversali.", [m("km = 1,0", "k_m=1{,}0"), t(" per altre sezioni trasversali.")]),
        p(141, "Deve essere inoltre effettuata la verifica di stabilità per elementi inflessi (svergolamento o instabilità flesso-torsionale), come definita al § 4.4.8.2.1."),
    ],
    "4.4.8.1.7": [
        h("4.4.8.1.7", "Tensoflessione", 141),
        p(141, "Nel caso di sforzo normale di trazione accompagnato da sollecitazioni di flessione attorno ai due assi principali dell’elemento strutturale, devono essere soddisfatte entrambe le seguenti condizioni:"), f(141, "4.4.6a"), f(141, "4.4.6b"),
        p(141, "I valori di km da utilizzare sono quelli riportati al § 4.4.8.1.6.", [t("I valori di "), m("km", "k_m"), t(" da utilizzare sono quelli riportati al § 4.4.8.1.6.")]),
        p(141, "Deve essere inoltre effettuata la verifica di stabilità per elementi inflessi (svergolamento o instabilità flesso-torsionale), come definita al § 4.4.8.2.1."),
    ],
    "4.4.8.1.8": [
        h("4.4.8.1.8", "Pressoflessione", 141),
        p(141, "Nel caso di sforzo normale di compressione accompagnato da sollecitazioni di flessione attorno ai due assi principali dell’elemento strutturale, devono essere soddisfatte entrambe le seguenti condizioni:"), f(141, "4.4.7a"), f(141, "4.4.7b"),
        p(141, "I valori di km da utilizzare sono quelli riportati al precedente § 4.4.8.1.6.", [t("I valori di "), m("km", "k_m"), t(" da utilizzare sono quelli riportati al precedente § 4.4.8.1.6.")]),
        p(141, "Devono essere inoltre effettuate le verifiche di stabilità, come definite al § 4.4.8.2."),
    ],
    "4.4.8.1.9": [
        h("4.4.8.1.9", "Taglio", 141),
        p(141, "Deve essere soddisfatta la condizione:"), f(141, "4.4.8"),
        p(141, "dove:"),
        p(141, "τd è la massima tensione tangenziale di progetto, valutata secondo la teoria di Jourawski, considerando una larghezza di trave opportunamente ridotta per la presenza di eventuali fessurazioni;", [m("τd", "\\tau_d"), t(" è la massima tensione tangenziale di progetto, valutata secondo la teoria di Jourawski, considerando una larghezza di trave opportunamente ridotta per la presenza di eventuali fessurazioni;")]),
        p(141, "fv,d è la corrispondente resistenza di progetto a taglio (formula 4.4.1).", [m("fv,d", "f_{v,d}"), t(" è la corrispondente resistenza di progetto a taglio (formula 4.4.1).")]),
        p(141, "Alle estremità della trave si potrà effettuare la verifica sopra indicata valutando in modo convenzionale τd, considerando nullo, ai fini del calcolo dello sforzo di taglio di estremità, il contributo di eventuali forze agenti all’interno del tratto di lunghezza pari all’altezza h della trave, misurato a partire dal bordo interno dell’appoggio, o all’altezza effettiva ridotta heff nel caso di travi con intagli.", [t("Alle estremità della trave si potrà effettuare la verifica sopra indicata valutando in modo convenzionale "), m("τd", "\\tau_d"), t(", considerando nullo, ai fini del calcolo dello sforzo di taglio di estremità, il contributo di eventuali forze agenti all’interno del tratto di lunghezza pari all’altezza "), m("h", "h"), t(" della trave, misurato a partire dal bordo interno dell’appoggio, o all’altezza effettiva ridotta "), m("heff", "h_{\\mathrm{eff}}"), t(" nel caso di travi con intagli.")]),
        p(141, "Per la verifica di travi con intagli o rastremazioni di estremità si farà riferimento a normative di comprovata validità."),
    ],
    "4.4.8.1.10": [
        h("4.4.8.1.10", "Torsione", 142),
        p(142, "Deve essere soddisfatta la condizione:"), f(142, "4.4.9"),
        p(142, "dove:"),
        p(142, "τtor,d è la massima tensione tangenziale di progetto per torsione;", [m("τtor,d", "\\tau_{\\mathrm{tor},d}"), t(" è la massima tensione tangenziale di progetto per torsione;")]),
        p(142, "ksh è un coefficiente che tiene conto della forma della sezione trasversale;", [m("ksh", "k_{\\mathrm{sh}}"), t(" è un coefficiente che tiene conto della forma della sezione trasversale;")]),
        p(142, "fv,d è la resistenza di progetto a taglio (formula 4.4.1).", [m("fv,d", "f_{v,d}"), t(" è la resistenza di progetto a taglio (formula 4.4.1).")]),
        p(142, "Per il coefficiente ksh si possono assumere i valori:", [t("Per il coefficiente "), m("ksh", "k_{\\mathrm{sh}}"), t(" si possono assumere i valori:")]),
        li(142, "ksh = 1,2 per sezioni circolari piene;", [m("ksh = 1,2", "k_{\\mathrm{sh}}=1{,}2"), t(" per sezioni circolari piene;")]),
        li(142, "ksh = 1 + 0,15 h/b ≤ 2 per sezioni rettangolari piene, di lati b e h, b ≤ h;", [m("ksh = 1 + 0,15 h/b ≤ 2", "k_{\\mathrm{sh}}=1+0{,}15h/b\\le2"), t(" per sezioni rettangolari piene, di lati "), m("b", "b"), t(" e "), m("h", "h"), t(", "), m("b ≤ h", "b\\le h"), t(";")]),
        li(142, "ksh = 1 per altri tipi di sezione.", [m("ksh = 1", "k_{\\mathrm{sh}}=1"), t(" per altri tipi di sezione.")]),
    ],
    "4.4.8.1.11": [
        h("4.4.8.1.11", "Taglio e torsione", 142),
        p(142, "Nel caso di torsione accompagnata da taglio si può eseguire una verifica combinata adottando la formula di interazione:"), f(142, "4.4.10"),
        p(142, "ove il significato dei simboli è quello riportato nei paragrafi corrispondenti alle verifiche a taglio e a torsione."),
    ],
    "4.4.8.2": [
        h("4.4.8.2", "VERIFICHE DI STABILITÀ", 142),
        p(142, "Oltre alle verifiche di resistenza devono essere eseguite le verifiche necessarie ad accertare la sicurezza della struttura o delle singole membrature nei confronti di possibili fenomeni di instabilità, quali lo svergolamento delle travi inflesse (instabilità flesso-torsionale) e lo sbandamento laterale degli elementi compressi o pressoinflessi."),
        p(142, "Nella valutazione della sicurezza all’instabilità occorre tener conto, per il calcolo delle tensioni per flessione, anche della curvatura iniziale dell’elemento, dell’eccentricità del carico assiale e delle eventuali deformazioni (frecce o controfrecce) imposte."),
        p(142, "Per queste verifiche si devono utilizzare i valori caratteristici al frattile 5% per i moduli elastici dei materiali.", [t("Per queste verifiche si devono utilizzare i valori caratteristici al frattile "), m("5%", "5\\%"), t(" per i moduli elastici dei materiali.")]),
    ],
    "4.4.8.2.1": [
        h("4.4.8.2.1", "Elementi inflessi (instabilità di trave)", 142),
        p(142, "Nel caso di flessione semplice, con momento flettente agente attorno all’asse forte y della sezione (cioè nel piano ortogonale a quello di possibile svergolamento), con riferimento alla tensione dovuta al massimo momento agente nel tratto di trave compreso tra due successivi ritegni torsionali, deve essere soddisfatta la relazione:", [t("Nel caso di flessione semplice, con momento flettente agente attorno all’asse forte "), m("y", "y"), t(" della sezione (cioè nel piano ortogonale a quello di possibile svergolamento), con riferimento alla tensione dovuta al massimo momento agente nel tratto di trave compreso tra due successivi ritegni torsionali, deve essere soddisfatta la relazione:")]),
        f(142, "4.4.11"),
        p(142, "σm,d è la tensione di progetto massima per flessione;", [m("σm,d", "\\sigma_{m,d}"), t(" è la tensione di progetto massima per flessione;")]),
        p(142, "kcrit,m è il coefficiente riduttivo di tensione critica per instabilità di trave, per tener conto della riduzione di resistenza dovuta allo sbandamento laterale;", [m("kcrit,m", "k_{\\mathrm{crit},m}"), t(" è il coefficiente riduttivo di tensione critica per instabilità di trave, per tener conto della riduzione di resistenza dovuta allo sbandamento laterale;")]),
        p(142, "fm,d è la resistenza di progetto a flessione (formula 4.4.1), determinata tenendo conto anche delle dimensioni della sezione trasversale mediante il coefficiente kh.", [m("fm,d", "f_{m,d}"), t(" è la resistenza di progetto a flessione (formula 4.4.1), determinata tenendo conto anche delle dimensioni della sezione trasversale mediante il coefficiente "), m("kh", "k_h"), t(".")]),
        p(142, "Per travi aventi una deviazione laterale iniziale rispetto alla rettilineità nei limiti di accettabilità del prodotto, si possono assumere i seguenti valori del coefficiente di tensione critica kcrit,m", [t("Per travi aventi una deviazione laterale iniziale rispetto alla rettilineità nei limiti di accettabilità del prodotto, si possono assumere i seguenti valori del coefficiente di tensione critica "), m("kcrit,m", "k_{\\mathrm{crit},m}")]),
        f(142, "4.4.12"),
        p(142, "λrel,m = √(fm,k/σm,crit) è la snellezza relativa di trave;", [m("λrel,m = √(fm,k/σm,crit)", "\\lambda_{\\mathrm{rel},m}=\\sqrt{f_{m,k}/\\sigma_{m,\\mathrm{crit}}}"), t(" è la snellezza relativa di trave;")]),
        p(142, "fm,k è la resistenza caratteristica a flessione (paragrafo 11.7.1.1);", [m("fm,k", "f_{m,k}"), t(" è la resistenza caratteristica a flessione (paragrafo 11.7.1.1);")]),
        p(142, "σm,crit è la tensione critica per flessione calcolata secondo la teoria classica della stabilità, con i valori dei moduli elastici caratteristici (frattile 5%) (paragrafo 11.7.1.1).", [m("σm,crit", "\\sigma_{m,\\mathrm{crit}}"), t(" è la tensione critica per flessione calcolata secondo la teoria classica della stabilità, con i valori dei moduli elastici caratteristici (frattile "), m("5%", "5\\%"), t(") (paragrafo 11.7.1.1).")]),
    ],
    "4.4.8.2.2": [
        h("4.4.8.2.2", "Elementi compressi (instabilità di colonna)", 143),
        p(143, "Nel caso di asta soggetta solo a sforzo normale deve essere soddisfatta la condizione:"), f(143, "4.4.13"),
        p(143, "σc,0,d tensione di compressione di progetto per sforzo normale;", [m("σc,0,d", "\\sigma_{c,0,d}"), t(" tensione di compressione di progetto per sforzo normale;")]),
        p(143, "fc,0,d resistenza di progetto a compressione;", [m("fc,0,d", "f_{c,0,d}"), t(" resistenza di progetto a compressione;")]),
        p(143, "kcrit,c coefficiente riduttivo di tensione critica per instabilità di colonna valutato per il piano in cui assume il valore minimo.", [m("kcrit,c", "k_{\\mathrm{crit},c}"), t(" coefficiente riduttivo di tensione critica per instabilità di colonna valutato per il piano in cui assume il valore minimo.")]),
        p(143, "Il coefficiente riduttivo kcrit,c si calcola in funzione della snellezza relativa di colonna λrel,c, che vale:", [t("Il coefficiente riduttivo "), m("kcrit,c", "k_{\\mathrm{crit},c}"), t(" si calcola in funzione della snellezza relativa di colonna "), m("λrel,c", "\\lambda_{\\mathrm{rel},c}"), t(", che vale:")]),
        f(143, "4.4.14"),
        p(143, "fc,0,k resistenza caratteristica a compressione parallela alla fibratura;", [m("fc,0,k", "f_{c,0,k}"), t(" resistenza caratteristica a compressione parallela alla fibratura;")]),
        p(143, "σc,crit tensione critica calcolata secondo la teoria classica della stabilità, con i valori dei moduli elastici caratteristici (frattile 5%) (paragrafo 11.7.1.1);", [m("σc,crit", "\\sigma_{c,\\mathrm{crit}}"), t(" tensione critica calcolata secondo la teoria classica della stabilità, con i valori dei moduli elastici caratteristici (frattile "), m("5%", "5\\%"), t(") (paragrafo 11.7.1.1);")]),
        p(143, "λ snellezza dell’elemento strutturale valutata per il piano in cui essa assume il valore massimo.", [m("λ", "\\lambda"), t(" snellezza dell’elemento strutturale valutata per il piano in cui essa assume il valore massimo.")]),
        p(143, "Quando λrel,c ≤ 0,3 si deve porre kcrit,c = 1, altrimenti", [t("Quando "), m("λrel,c ≤ 0,3", "\\lambda_{\\mathrm{rel},c}\\le0{,}3"), t(" si deve porre "), m("kcrit,c = 1", "k_{\\mathrm{crit},c}=1"), t(", altrimenti")]),
        f(143, "4.4.15"),
        p(143, "con"), f(143, "4.4.16"),
        p(143, "βc coefficiente di imperfezione, che, se gli elementi rientrano nei limiti di rettilineità definiti al § 4.4.15, può assumere i seguenti valori:", [m("βc", "\\beta_c"), t(" coefficiente di imperfezione, che, se gli elementi rientrano nei limiti di rettilineità definiti al § 4.4.15, può assumere i seguenti valori:")]),
        li(143, "per legno massiccio βc = 0,2;", [t("per legno massiccio "), m("βc = 0,2", "\\beta_c=0{,}2"), t(";")]),
        li(143, "per legno lamellare βc = 0,1.", [t("per legno lamellare "), m("βc = 0,1", "\\beta_c=0{,}1"), t(".")]),
    ],
    "4.4.9": [
        h("4.4.9", "COLLEGAMENTI", 143),
        p(143, "I collegamenti tra gli elementi strutturali devono essere progettati in numero, posizione, resistenza, rigidezza tali da garantire la trasmissione delle sollecitazioni di progetto allo stato limite considerato in coerenza ai criteri adottati nello svolgimento dell’analisi strutturale."),
        p(143, "Le capacità portanti e le deformabilità dei mezzi di unione utilizzati nei collegamenti devono essere determinate sulla base di prove meccaniche, per il cui svolgimento può farsi utile riferimento alle norme UNI EN 1075, UNI EN 1380, UNI EN 1381, UNI EN 26891, UNI EN ISO 8970 e alle pertinenti norme europee."),
        p(143, "La capacità portante e la deformabilità dei mezzi di unione possono essere valutate con riferimento a normative di comprovata validità."),
        p(143, "Nel calcolo della capacità portante del collegamento realizzato con mezzi di unione del tipo a gambo cilindrico, si dovrà tener conto, tra l’altro, della tipologia e della capacità portante ultima del singolo mezzo d’unione, del tipo di unione (legno-legno, pannelli-legno, acciaio-legno), del numero di sezioni resistenti e, nel caso di collegamento organizzato con più unioni elementari, dell’allineamento dei singoli mezzi di unione."),
        p(143, "È ammesso l’uso di sistemi di unione di tipo speciale purché il comportamento degli stessi sia chiaramente individuato su base teorica e/o sperimentale e purché sia comunque garantito un livello di sicurezza non inferiore a quanto previsto nella presente norma tecnica."),
        p(143, "Giunti a dita incollati a tutta sezione non possono essere usati in classe di servizio 3."),
        p(143, "In ogni caso i sistemi di unione devono essere verificati nelle reali condizioni di impiego in opera."),
    ],
    "4.4.10": [
        h("4.4.10", "ELEMENTI STRUTTURALI", 143),
        p(143, "Ogni elemento strutturale, in legno massiccio o in materiali derivati dal legno, prevalentemente compresso, inflesso, teso o sottoposto a combinazioni dei precedenti stati di sollecitazione, può essere caratterizzato da un’unica sezione o da una sezione composta da più elementi, incollati o assemblati meccanicamente."),
        p(143, "Le verifiche dell’elemento composto dovranno tener conto degli scorrimenti nelle unioni. A tale scopo è ammesso adottare per le unioni un legame lineare tra sforzo e scorrimento."),
        p(143, "Nel caso di elementi strutturali realizzati mediante accoppiamento di elementi a base di legno o di altro materiale tramite connessioni o incollaggi, la verifica complessiva dell’elemento composto dovrà tenere conto dell’effettivo comportamento dell’unione, definito con riferimento a normativa tecnica di comprovata validità ed eventualmente per via sperimentale. In ogni caso le sollecitazioni nei singoli elementi componenti dovranno essere confrontate con quelle specificate ai §§ 4.1, 4.2 in relazione a ciascun singolo materiale."),
    ],
    "4.4.11": [
        h("4.4.11", "SISTEMI STRUTTURALI", 144),
        p(144, "Le strutture reticolari costituite da elementi lignei assemblati tramite collegamenti metallici, unioni di carpenteria o incollaggio, dovranno essere in genere analizzate come sistemi di travi, considerando la deformabilità e le effettive eccentricità dei collegamenti."),
        p(144, "La stabilità delle singole membrature nelle strutture intelaiate deve essere verificata, in generale, tenendo conto delle effettive condizioni dei vincoli nonché della deformabilità dei nodi e della presenza di eventuali sistemi di controventamento."),
        p(144, "La stabilità delle strutture intelaiate deve essere verificata considerando, oltre agli effetti instabilizzanti dei carichi verticali, anche le imperfezioni geometriche e strutturali, inquadrando le corrispondenti azioni convenzionali nella stessa classe di durata dei carichi che le hanno provocate."),
        p(144, "Nei casi in cui la stabilità laterale è assicurata dal contrasto di controventamenti adeguati, la lunghezza di libera inflessione dei piedritti, in mancanza di un’analisi rigorosa, si può assumere pari all’altezza d’interpiano."),
        p(144, "Per gli archi, oltre alle usuali verifiche, vanno sempre eseguite le verifiche nei confronti dell’instabilità anche al di fuori del piano."),
        p(144, "Per gli archi, come per tutte le strutture spingenti, i vincoli devono essere idonei ad assorbire le componenti orizzontali delle reazioni."),
        p(144, "Le azioni di progetto sui controventi e/o diaframmi devono essere determinate tenendo conto anche delle imperfezioni geometriche strutturali, nonché delle deformazioni indotte dai carichi applicati, se significative."),
        p(144, "Qualora le strutture dei tetti e dei solai svolgano anche funzioni di controventamento nel loro piano (diaframmi per tetti e solai), la capacità di esplicare tale funzione con un comportamento a lastra deve essere opportunamente verificata, tenendo conto delle modalità di realizzazione e delle caratteristiche dei mezzi di unione."),
        p(144, "Qualora gli elementi di parete svolgano anche funzioni di controventamento nel loro piano (diaframma per pareti), la capacità di esplicare tale funzione con un comportamento a mensola verticale deve essere opportunamente verificata, tenendo conto delle modalità di realizzazione e delle caratteristiche dei mezzi di unione."),
    ],
    "4.4.12": [
        h("4.4.12", "ROBUSTEZZA", 144),
        p(144, "I requisiti di robustezza strutturale di cui ai §§ 2.1 e 3.1.1 possono essere raggiunti anche mediante l’adozione di opportune scelte progettuali e di adeguati provvedimenti costruttivi che, per gli elementi lignei, devono riguardare almeno:"),
        li(144, "la protezione della struttura e dei suoi elementi componenti nei confronti dell’umidità;"),
        li(144, "l’utilizzazione di mezzi di collegamento intrinsecamente duttili o di sistemi di collegamento a comportamento duttile;"),
        li(144, "l’utilizzazione di elementi composti a comportamento globalmente duttile;"),
        li(144, "la limitazione delle zone di materiale legnoso sollecitate a trazione perpendicolarmente alla fibratura, soprattutto nei casi in cui tali stati di sollecitazione si accompagnino a tensioni tangenziali (come nel caso degli intagli) e, in genere, quando siano da prevedere elevati gradienti di umidità nell’elemento durante la sua vita utile."),
    ],
    "4.4.13": [
        h("4.4.13", "DURABILITÀ", 144),
        p(144, "In relazione alla classe di servizio della struttura e alle condizioni di carico, dovrà essere predisposto in sede progettuale un programma delle operazioni di manutenzione e di controllo da effettuarsi durante la vita della struttura."),
    ],
    "4.4.14": [
        h("4.4.14", "RESISTENZA AL FUOCO", 144),
        p(144, "Le verifiche di resistenza al fuoco potranno eseguirsi con riferimento a UNI EN 1995-1-2, utilizzando i coefficienti γM (vedi § 4.4.6, Tab. 4.4.III) relativi alle combinazioni eccezionali.", [t("Le verifiche di resistenza al fuoco potranno eseguirsi con riferimento a UNI EN 1995-1-2, utilizzando i coefficienti "), m("γM", "\\gamma_M"), t(" (vedi § 4.4.6, Tab. 4.4.III) relativi alle combinazioni eccezionali.")]),
    ],
    "4.4.15": [
        h("4.4.15", "REGOLE PER L’ESECUZIONE", 144),
        p(144, "In assenza di specifiche prescrizioni contenute nelle pertinenti norme di prodotto, le tolleranze di lavorazione così come quelle di esecuzione devono essere definite in fase progettuale."),
        p(144, "In assenza di specifiche prescrizioni contenute nelle pertinenti norme di prodotto, al fine di limitare la variazione dell’umidità del materiale e dei suoi effetti sul comportamento strutturale, le condizioni di stoccaggio, montaggio e le fasi di carico parziali, devono essere definite in fase progettuale."),
        p(144, "Per tutte le membrature per le quali sia significativo il problema della instabilità, lo scostamento dalla configurazione geometrica teorica non dovrà superare 1/500 della distanza tra due vincoli successivi, nel caso di elementi lamellari incollati, e 1/300 della medesima distanza, nel caso di elementi di legno massiccio.", [t("Per tutte le membrature per le quali sia significativo il problema della instabilità, lo scostamento dalla configurazione geometrica teorica non dovrà superare "), m("1/500", "1/500"), t(" della distanza tra due vincoli successivi, nel caso di elementi lamellari incollati, e "), m("1/300", "1/300"), t(" della medesima distanza, nel caso di elementi di legno massiccio.")]),
        p(144, "Il legno, i componenti derivati dal legno e gli elementi strutturali non dovranno di regola essere esposti a condizioni atmosferiche più severe di quelle previste per la struttura finita e che comunque producano effetti che ne compromettano l’efficienza strutturale."),
        p(145, "Prima della costruzione o comunque prima della messa in carico, il legno dovrà essere portato ad una umidità il più vicino possibile a quella appropriata alle condizioni ambientali in cui si troverà nell’opera finita."),
        p(145, "Qualora si operi con elementi lignei per i quali assumano importanza trascurabile gli effetti del ritiro, o comunque della variazione della umidità, si potrà accettare durante la posa in opera una maggiore umidità del materiale, purché sia assicurata al legno la possibilità di un successivo asciugamento, fino a raggiungere l’umidità prevista in fase progettuale senza che ne venga compromessa l’efficienza strutturale."),
        p(145, "I sistemi di collegamento non devono presentare distorsioni permanenti in opera."),
    ],
    "4.4.16": [
        h("4.4.16", "VERIFICHE PER SITUAZIONI TRANSITORIE, CONTROLLI E PROVE DI CARICO", 145),
        p(145, "Per situazioni costruttive transitorie, come quelle che si hanno durante le fasi della costruzione, dovranno adottarsi tecnologie costruttive e programmi di lavoro che non possono provocare danni permanenti alla struttura o agli elementi strutturali e che comunque non possano riverberarsi sulla sicurezza dell’opera."),
        p(145, "Le entità delle azioni ambientali da prendere in conto saranno determinate in relazione alla durata della situazione transitoria e della tecnologia esecutiva."),
        p(145, "L’assegnazione delle azioni di progetto ad una delle classi di durata del carico e delle classi di servizio dovrà essere congruente con la effettiva durata della situazione transitoria in esame."),
        p(145, "In aggiunta a quanto previsto al Capitolo 9, l’esecuzione delle prove di carico per le strutture con elementi portanti di legno o con materiali derivati dal legno, dovrà tener conto della temperatura ambientale e dell’umidità del materiale."),
        p(145, "L’applicazione del carico dovrà essere in grado di evidenziare la dipendenza del comportamento del materiale dalla durata e dalla velocità di applicazione del carico."),
        p(145, "A tal fine, si possono adottare metodi e protocolli di prova riportati in normative di comprovata validità."),
    ],
    "4.4.17": [
        h("4.4.17", "VERIFICHE PER SITUAZIONI PROGETTUALI ECCEZIONALI", 145),
        p(145, "Per situazioni progettuali eccezionali, il progetto dovrà dimostrare la robustezza della costruzione mediante procedure di scenari di danno per i quali i fattori parziali γM dei materiali possono essere assunti pari all’unità.", [t("Per situazioni progettuali eccezionali, il progetto dovrà dimostrare la robustezza della costruzione mediante procedure di scenari di danno per i quali i fattori parziali "), m("γM", "\\gamma_M"), t(" dei materiali possono essere assunti pari all’unità.")]),
    ],
    "4.4.18": [
        h("4.4.18", "PROGETTAZIONE INTEGRATA DA PROVE E VERIFICA MEDIANTE PROVE", 145),
        p(145, "La resistenza e la funzionalità di strutture e elementi strutturali può essere misurata attraverso prove su campioni di adeguata numerosità."),
        p(145, "I risultati delle prove eseguite su opportuni campioni devono essere trattati con i metodi dell’analisi statistica, in modo tale da ricavare parametri significativi quali media, deviazione standard e fattore di asimmetria della distribuzione, sì da caratterizzare adeguatamente un modello probabilistico descrittore delle quantità indagate (variabili aleatorie)."),
        p(145, "Indicazioni più dettagliate al riguardo e metodi operativi completi per la progettazione integrata da prove possono essere reperiti nella Appendice D della UNI EN 1990:2006."),
    ],
};

const titles: Record<string, string> = {
    "4.4": "COSTRUZIONI DI LEGNO",
    "4.4.1": "VALUTAZIONE DELLA SICUREZZA",
    "4.4.2": "ANALISI STRUTTURALE",
    "4.4.3": "AZIONI E LORO COMBINAZIONI",
    "4.4.4": "CLASSI DI DURATA DEL CARICO",
    "4.4.5": "CLASSI DI SERVIZIO",
    "4.4.6": "RESISTENZA DI PROGETTO",
    "4.4.7": "STATI LIMITE DI ESERCIZIO",
    "4.4.8": "STATI LIMITE ULTIMI",
    "4.4.8.1": "VERIFICHE DI RESISTENZA",
    "4.4.8.1.1": "Trazione parallela alla fibratura",
    "4.4.8.1.2": "Trazione perpendicolare alla fibratura",
    "4.4.8.1.3": "Compressione parallela alla fibratura",
    "4.4.8.1.4": "Compressione perpendicolare alla fibratura",
    "4.4.8.1.5": "Compressione inclinata rispetto alla fibratura",
    "4.4.8.1.6": "Flessione",
    "4.4.8.1.7": "Tensoflessione",
    "4.4.8.1.8": "Pressoflessione",
    "4.4.8.1.9": "Taglio",
    "4.4.8.1.10": "Torsione",
    "4.4.8.1.11": "Taglio e torsione",
    "4.4.8.2": "VERIFICHE DI STABILITÀ",
    "4.4.8.2.1": "Elementi inflessi (instabilità di trave)",
    "4.4.8.2.2": "Elementi compressi (instabilità di colonna)",
    "4.4.9": "COLLEGAMENTI",
    "4.4.10": "ELEMENTI STRUTTURALI",
    "4.4.11": "SISTEMI STRUTTURALI",
    "4.4.12": "ROBUSTEZZA",
    "4.4.13": "DURABILITÀ",
    "4.4.14": "RESISTENZA AL FUOCO",
    "4.4.15": "REGOLE PER L’ESECUZIONE",
    "4.4.16": "VERIFICHE PER SITUAZIONI TRANSITORIE, CONTROLLI E PROVE DI CARICO",
    "4.4.17": "VERIFICHE PER SITUAZIONI PROGETTUALI ECCEZIONALI",
    "4.4.18": "PROGETTAZIONE INTEGRATA DA PROVE E VERIFICA MEDIANTE PROVE",
};

async function main() {
    await mkdir(unitDirectory, { recursive: true });
    await mkdir(assetDirectory, { recursive: true });
    const figureBytes = await readFile(figurePath);
    const figure = {
        id: figure1,
        unitId: unitId("4.4.8.1"),
        officialNumber: "4.4.1",
        pdfPage: 140,
        caption: "Fig. 4.4.1 – Assi dell’elemento",
        alt: "Fig. 4.4.1 – Assi dell’elemento",
        imagePath: "figures/ntc2018/fig4.4.1.png",
        region: { coordinateSystem: "pdf-points-top-left", x: 80, y: 160, width: 350, height: 122 },
        sha256: sha256(figureBytes),
    };
    for (const [number, blocks] of Object.entries(blocksByUnit)) {
        await writeFile(join(unitDirectory, `${number}.json`), `${JSON.stringify(makeUnit(number, titles[number]!, blocks), null, 2)}\n`, "utf8");
    }
    const manifest = {
        $schema: "urn:structural-codes:schema:asset-manifest:v2",
        schemaVersion: "2.0.0-alpha.1",
        recordType: "asset-manifest",
        document: "ntc2018",
        section: "4.4-step1",
        sourceId,
        status: "transcribed-unreviewed",
        formulas: formulaDefs.map(formulaAsset),
        tables,
        figures: [figure],
    };
    await writeFile(join(assetDirectory, "4.4-step1.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
    console.log(`ntc44: scritte ${Object.keys(blocksByUnit).length} unità e ${formulaDefs.length} formule`);
}

await main();
