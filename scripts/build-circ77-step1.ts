/* eslint-disable @typescript-eslint/no-explicit-any */
import { createHash } from "node:crypto";
import { mkdir, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const sourceId = "circ-7-2019";
const profile = "circ77-step1-manual-render-transcription-0.1.0";
const asOf = "2026-08-09";
const unitId = (number: string): string =>
    `urn:structural-codes:it:unit:circ2019:${number.toLowerCase()}`;
const sha256 = (value: string): string =>
    createHash("sha256").update(value, "utf8").digest("hex");

const mathTerms: Array<[string, string]> = [["q dovrà", "q"]];
function inline(text: string): any[] | undefined {
    const terms = mathTerms.filter(([value]) => text.includes(value));
    if (terms.length === 0) return undefined;
    const result: any[] = [];
    let cursor = 0;
    while (cursor < text.length) {
        const next = terms
            .map(([value, latex]) => ({ index: text.indexOf(value, cursor), value, latex }))
            .filter(({ index }) => index >= 0)
            .sort((left, right) => left.index - right.index)[0];
        if (!next) {
            result.push({ kind: "text", value: text.slice(cursor) });
            break;
        }
        if (next.index > cursor) result.push({ kind: "text", value: text.slice(cursor, next.index) });
        result.push({ kind: "math", value: "q", latex: next.latex });
        cursor = next.index + next.value.indexOf("q") + 1;
    }
    return result.filter(({ value }) => value);
}

function evidence(page: number, text: string): any {
    return {
        sourceId,
        pdfPage: page,
        printedPage: String(page - 4),
        region: null,
        extraction: {
            method: "manual-transcription",
            tool: "codex-render-transcription",
            toolVersion: profile,
        },
        transformations: [],
        rawSha256: sha256(text),
        normalizedSha256: sha256(text),
    };
}

type Block = { kind: "heading" | "paragraph" | "list-item"; page: number; text: string };
type Unit = { number: string; title: string; page: number; blocks: Block[] };
const h = (page: number, text: string): Block => ({ kind: "heading", page, text });
const p = (page: number, text: string): Block => ({ kind: "paragraph", page, text });
const li = (page: number, text: string): Block => ({ kind: "list-item", page, text });

const units: Unit[] = [
    {
        number: "C7.7",
        title: "COSTRUZIONI DI LEGNO",
        page: 230,
        blocks: [],
    },
    {
        number: "C7.7.1",
        title: "ASPETTI CONCETTUALI DELLA PROGETTAZIONE",
        page: 230,
        blocks: [
            p(230, "Gli edifici a struttura lignea devono essere progettati in accordo a un comportamento strutturale dissipativo (classe di duttilità “A” o “B”) o non dissipativo."),
            p(230, "Per gli edifici a struttura lignea progettati in accordo a un comportamento strutturale non dissipativo non è necessario adottare i procedimenti tipici della progettazione in capacità, rimanendo comunque valido quanto riportato nelle norme tecniche (Capitolo 4.4 delle NTC) e nel C4.4."),
        ],
    },
    {
        number: "C7.7.2",
        title: "MATERIALI E PROPRIETÀ DELLE ZONE DISSIPATIVE",
        page: 230,
        blocks: [
            p(230, "Le richieste di dissipazione energetica sono concentrate a livello dei singoli collegamenti specificamente individuati e progettati. Conseguentemente tali richieste possono non essere estese agli altri collegamenti strutturali non ritenuti dissipativi purché, applicando i procedimenti tipici della progettazione in capacità, questi siano progettati per essere sovraresistenti rispetto a quei collegamenti individuati come dissipativi, utilizzando le disposizioni del pertinente Capitolo delle NTC (7.2.2)."),
            p(230, "I valori del fattore di sovraresistenza indicati in Tabella 7.2.I per la tipologia strutturale Legno sono utilizzati per incrementare la capacità in resistenza degli elementi/collegamenti/meccanismi duttili al fine di dimensionare, con tale capacità maggiorata, la capacità degli elementi/collegamenti/meccanismi fragili indesiderati."),
            p(230, "Si dovrà controllare che gli elementi meccanici di collegamento utilizzati nelle zone dissipative possiedano un adeguato comportamento oligociclico."),
            p(230, "Con riguardo agli spessori minimi richiesti per i pannelli strutturali di rivestimento di OSB, lo spessore minimo di 12 mm si applica se prevede l’utilizzo di due pannelli, da disporre uno per lato e con la medesima tipologia di chiodatura (tipo e dimensione di chiodo, passo di chiodatura), lo spessore minimo di 15 mm si applica se si prevede l’utilizzo di un solo pannello."),
            p(230, "Nel caso di utilizzo di pannelli realizzati con altri materiali la possibilità del loro utilizzo nelle zone considerate dissipative deve essere valutata sulla base di comprovata documentazione tecnico-scientifica, basata su sperimentazione, in accordo con normative di comprovata validità."),
        ],
    },
    {
        number: "C7.7.3",
        title: "TIPOLOGIE STRUTTURALI E FATTORI DI COMPORTAMENTO",
        page: 230,
        blocks: [
            p(230, "Nella Tab. 7.3.II delle NTC sono riportati i valori massimi del valore del fattore di comportamento per alcuni esempi di tipologie strutturali."),
            p(230, "Relativamente alle tipologie strutturali riportate nella Tabella 7.3.II delle NTC si precisa che con il termine diaframma si intendono solai e coperture. Nella medesima tabella, per diaframmi chiodati si intendono solai e coperture in grado di dissipare energia. Per le tipologie strutturali che adottano tali diaframmi, i fattori di comportamento adottati in CD “A” devono essere giustificati mediante analisi di tipo non lineare tenendo debitamente in conto la dissipazione dei solai. Per diaframmi incollati si intendono solai e coperture non in grado di dissipare energia."),
            p(230, "Qualora più tipologie strutturali, anche di materiali diversi, collaborino nella resistenza sismica (sistemi resistenti in parallelo), è possibile computare il contributo di entrambe le tipologie, purché nell’analisi sia adottato il fattore di comportamento con valore minore. In alternativa dovranno essere utilizzate analisi di tipo non lineare."),
            p(230, "È consentito realizzare una struttura in legno che sormonti una struttura realizzata con altra tipologia di materiale (calcestruzzo armato, muratura, acciaio, ecc.). In particolare, qualora sia presente un piano cantinato o seminterrato con pareti di calcestruzzo armato, esso può essere assimilato a struttura di fondazione dei sovrastanti piani in legno, nel rispetto dei requisiti di continuità delle fondazioni."),
            p(230, "In generale, nel caso in cui la sottostruttura possa essere considerata rigida rispetto alla sovrastruttura in legno, progettata come dissipativa, l’analisi delle azioni sulla sovrastruttura in legno può essere eseguita indipendentemente dalla sottostruttura, utilizzando i fattori di struttura nella Tabella 7.3.II delle NTC relativi alle strutture in legno. In tal caso è necessario progettare la sottostruttura sovraresistente al fine di evitare possibili meccanismi di collasso di piano debole."),
            p(230, "Nel caso di strutture a comportamento dissipativo (classe di duttilità “A” o “B”), il progettista giustifica l’adozione nel progetto del valore dei fattori di comportamento presenti nella Tab. 7.3.II delle NTC, in generale mediante analisi non lineari, nelle quali il comportamento delle zone dissipative è modellato a partire da dati sperimentali. Tale giustificazione può essere omessa se vengono adottate le disposizioni riportate al punto 7.7.3.1 delle NTC."),
            p(231, "Qualora nella Tabella 7.3.II non sia indicato uno specifico valore per la CD “A”, le relative tipologie strutturali possono essere progettate solo in classe di duttilità bassa CD “B”."),
            p(231, "Per edifici a struttura lignea non attribuibili a nessuna delle tipologie strutturali riportate nella Tabella 7.3.II delle NTC, qualora si scelga di adottare un comportamento strutturale dissipativo, il valore appropriato del fattore di comportamento q dovrà essere determinato mediante analisi non lineari, effettuate utilizzando per le zone dissipative i risultati di test sperimentali."),
        ],
    },
    {
        number: "C7.7.4",
        title: "ANALISI STRUTTURALE",
        page: 231,
        blocks: [
            p(231, "Nell’analisi della struttura, sia di tipo lineare sia di tipo non lineare, di edifici lignei realizzati a pareti portanti (pareti intelaiate leggere, pareti di tavole incollate incrociate, ecc.), devono essere considerati i possibili contributi di deformabilità derivanti dal comportamento meccanico delle parete (deformabilità del materiale e dei sistemi di giunzione interni alla parete stessa, tenendo conto delle reali dimensioni di produzione dei pannelli che la costituiscono) e dei collegamenti che la vincolano al sollevamento e alla traslazione."),
            p(231, "Per le tipologie strutturali riconducibili a quella di parete a telaio leggero, qualora gli elementi di parete svolgano anche funzione di controventamento nel loro piano, è necessario escludere dall’analisi nei confronti delle azioni orizzontali il contributo della porzione di parete contenente un’apertura di porta o finestra."),
            p(231, "Le pareti di tamponamento e le pareti strutturali non facenti parte del sistema sismo-resistente (pareti secondarie in accordo con il punto 7.2.3 delle NTC) devono essere progettate con dettagli costruttivi atti a non trasmettere azioni orizzontali nel piano della parete medesima. Nell’analisi della struttura, il contributo in termini di resistenza e rigidezza di tali pareti secondarie nei confronti delle azioni orizzontali deve essere trascurato."),
            p(231, "Negli edifici lignei gli elementi strutturali sismo-resistenti dovranno garantire la continuità della trasmissione delle azioni a partire dal solaio di partenza delle elevazioni in legno; non è quindi ammesso interrompere tali elementi prima del raggiungimento di tale solaio. E’ invece consentito disporre elementi strutturali sismo-resistenti portanti che non raggiungono la sommità dell’edificio."),
            p(231, "Gli impalcati (solai, orizzontamenti, coperture, ecc.), ai fini dell’analisi strutturale, devono essere dotati di opportuna rigidezza e resistenza nel piano e devono altresì essere collegati in maniera efficace agli elementi verticali che li sostengono. La capacità di esplicare la funzione di diaframma deve essere opportunamente verificata, tenendo conto delle modalità di realizzazione, dei materiali impiegati e delle caratteristiche dei mezzi di unione."),
            p(231, "Possono essere considerati rigidi nel proprio piano:"),
            li(231, "gli impalcati lignei realizzati mediante travi ed elementi di rivestimento (pannelli, tavolato, tavoloni, ecc), per i quali il trasferimento delle azioni orizzontali sia affidato al rivestimento, che rispettino tutte le disposizioni competenti riportate al punto 7.7.5.3. delle NTC e al punto C7.7.5.3;"),
            li(231, "gli impalcati lignei realizzati mediante elementi prefabbricati (ad esempio cassoni, pannelli di tavole incollate incrociate, ecc.) che rispettino tutte le disposizioni pertinenti al punto C7.7.5.3."),
        ],
    },
    {
        number: "C7.7.5",
        title: "DISPOSIZIONI COSTRUTTIVE",
        page: 231,
        blocks: [],
    },
    {
        number: "C7.7.5.1",
        title: "GENERALITÀ",
        page: 231,
        blocks: [
            p(231, "Negli edifici lignei realizzati a pareti portanti (pareti intelaiate leggere, pareti di tavole incollate incrociate, ecc.) la giunzione in altezza tra gli elementi di parete dovrà avvenire all’intersezione con i solai. Deve cioè essere evitata la giunzione nelle zone non presidiate dagli impalcati a meno che non venga disposto un opportuno elemento stabilizzante."),
            p(231, "Nel caso di pareti a telaio leggero tutti i bordi dei rivestimenti strutturali devono essere collegati agli elementi del telaio: i rivestimenti che non terminano su elementi del telaio (ad esempio fogli di rivestimento giunti in altezza) devono essere sostenuti e collegati ad appositi elementi di bloccaggio taglio-resistenti. La valutazione della rigidezza della parete dovrà tener conto della cedevolezza di tali connessioni."),
        ],
    },
    {
        number: "C7.7.5.3",
        title: "DISPOSIZIONI COSTRUTTIVE PER GLI IMPALCATI",
        page: 231,
        blocks: [
            p(231, "Negli impalcati (solai, orizzontamenti, coperture, ecc.), realizzati mediante travi ed elementi di rivestimento (pannelli, tavolato, tavoloni, ecc.), gli elementi di rivestimento dovranno essere collegati meccanicamente o mediante incollaggio alle travi del solaio e ad elementi trasversali opportunamente inseriti (elementi di bloccaggio taglio resistenti o a un secondo strato di elementi di rivestimento)."),
            p(231, "Nei solai, specialmente in corrispondenza delle aperture, è necessario che le travi garantiscano la continuità nel trasferimento delle azioni orizzontali, eventualmente mediante elementi di collegamento specificamente progettati e verificati."),
            p(231, "In corrispondenza delle zone nelle quali si attua il trasferimento delle forze orizzontali alle pareti di controvento, il mantenimento della tessitura delle travi può essere evitato purché il dettaglio costruttivo adottato garantisca la trasmissione delle azioni orizzontali tra impalcato e pareti di controvento."),
            p(232, "Negli impalcati (solai, orizzontamenti, coperture, ecc.), realizzati mediante elementi prefabbricati (ad esempio cassoni, pannelli di tavole incrociate incollate) valgono le seguenti prescrizioni:"),
            li(232, "il collegamento reciproco tra gli elementi deve essere progettato e realizzato in modo da assicurare il trasferimento delle forze sismiche di piano;"),
            li(232, "i vincoli tra gli elementi di solaio e i sistemi resistenti a sviluppo verticale devono essere di tipo bilatero."),
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
    const relations = hasNtcTarget
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
        relations,
        assets: { formulaIds: [], tableIds: [], figureIds: [] },
        workflow: {
            status: "extracted",
            createdBy: { actorId: "generator:circ77-step1", kind: "script", toolVersion: profile },
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
    section: "C7.7",
    sourceId,
    status: "transcribed-unreviewed",
    formulas: [],
    tables: [],
    figures: [],
};
await writeFile(join(root, "corpus", "assets", "circ2019", "7.7.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(`circ77-step1: generated ${units.length} units without assets`);
