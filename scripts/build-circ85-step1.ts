import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const EVIDENCE = join(ROOT, "evidence", "circ-7-2019", "pages");
const UNITS = join(ROOT, "corpus", "units", "circ2019");
const ASSETS = join(ROOT, "corpus", "assets", "circ2019");
const SOURCE_ID = "circ-7-2019";
const WORK_ID = "it-mit:circ:2019-01-21:7-csllpp";
const EXPRESSION_ID = `${WORK_ID}:original-it`;
const TODAY = "2026-08-09";
const CREATED_AT = "2026-08-09T12:00:00Z";
const VERSION = "circ8-editorial-profile-0.2.0";

type Range = { page: number; start: number; end: number };
type Inline = { kind: "text" | "math"; value: string; latex?: string };

const pageLines = new Map<number, string[]>();
function lines(page: number): string[] {
  let value = pageLines.get(page);
  if (!value) {
    const path = join(EVIDENCE, `page-${String(page).padStart(4, "0")}.raw.txt`);
    value = readFileSync(path, "utf8").replace(/\r\n/g, "\n").split("\n");
    pageLines.set(page, value);
  }
  return value;
}

function raw(ranges: Range[]): string {
  return ranges.map(({ page, start, end }) => {
    const pageText = lines(page).slice(start - 1, end);
    if (pageText.length !== end - start + 1) {
      throw new Error(`Evidence range fuori pagina ${page}:${start}-${end}`);
    }
    return pageText.join("\n");
  }).join("\n");
}

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

const mathMap: Record<string, string> = {
  "N/mm²": "\\mathrm{N/mm^2}",
  "> 70 cm": ">70\\,\\mathrm{cm}",
  "≤40%": "\\le40\\%",
  "γ_M": "\\gamma_M",
  "f_m": "f_m",
  "fᵥ₀": "f_{v0}",
  "τ₀": "\\tau_0",
  "f": "f",
  "E": "E",
  "G": "G",
  "w": "w",
};

const inlinePattern = /N\/mm²|> 70 cm|≤40%|γ_M|f_m|fᵥ₀|τ₀|(?<![\p{L}\p{N}_])f(?![\p{L}\p{N}_])|(?<![\p{L}\p{N}_])E(?![\p{L}\p{N}_])|(?<![\p{L}\p{N}_])G(?![\p{L}\p{N}_])|(?<![\p{L}\p{N}_])w(?![\p{L}\p{N}_])/gu;

function inline(text: string): Inline[] | undefined {
  const result: Inline[] = [];
  let last = 0;
  for (const match of text.matchAll(inlinePattern)) {
    const start = match.index ?? 0;
    const value = match[0];
    if (start > last) result.push({ kind: "text", value: text.slice(last, start) });
    result.push({ kind: "math", value, latex: mathMap[value] });
    last = start + value.length;
  }
  if (last < text.length) result.push({ kind: "text", value: text.slice(last) });
  return result.some((part) => part.kind === "math") ? result : undefined;
}

function printedPage(page: number): string {
  return String(page - 4);
}

function transformations(rawText: string, normalized: string) {
  const result: Array<{ operation: string; ruleVersion: string; note: string }> = [];
  if (rawText.includes("\n")) {
    result.push({
      operation: "join-line-wrap",
      ruleVersion: VERSION,
      note: "Rimossi gli a capo introdotti dall’impaginazione, conservando il capoverso.",
    });
  }
  if (/[\u0000-\u001f\u007f]/u.test(rawText)) {
    result.push({
      operation: "remove-control-character",
      ruleVersion: VERSION,
      note: "Rimossi i caratteri di controllo introdotti dall’estrazione del PDF per i marcatori di elenco e i glifi matematici.",
    });
  }
  if (rawText !== normalized) {
    result.push({
      operation: "manual-correction",
      ruleVersion: VERSION,
      note: "Ripristinati accenti, apostrofi, numerazione, glifi matematici e punteggiatura verificati sul render ufficiale.",
    });
  }
  result.push({
    operation: "unicode-nfc",
    ruleVersion: VERSION,
    note: "Testo normalizzato in Unicode NFC.",
  });
  return result;
}

function evidence(ranges: Range[], normalized: string, method: "pdf-text" | "manual-transcription" = "manual-transcription") {
  const firstRange = ranges[0];
  if (!firstRange) throw new Error("Evidence senza intervallo di pagina");
  const rawText = raw(ranges);
  return {
    sourceId: SOURCE_ID,
    pdfPage: firstRange.page,
    printedPage: printedPage(firstRange.page),
    region: null,
    extraction: {
      method,
      tool: method === "manual-transcription" ? "codex-render-transcription" : "pdfjs-dist",
      toolVersion: VERSION,
    },
    transformations: transformations(rawText, normalized),
    rawSha256: sha256(rawText),
    normalizedSha256: sha256(normalized),
  };
}

function assetEvidence(ranges: Range[], normalized: string) {
  return evidence(ranges, normalized, "pdf-text");
}

type Block = Record<string, unknown>;

function addText(blocks: Block[], ranges: Range[], normalized: string, kind: "heading" | "paragraph" | "list-item" | "footnote" = "paragraph") {
  const unitId = currentUnitId;
  const blockId = `${unitId}#block-${blocks.length === 0 ? "heading" : String(blocks.length).padStart(3, "0")}`;
  const text: Record<string, unknown> = {
    raw: raw(ranges),
    normalized,
    normalizationVersion: VERSION,
  };
  const segments = inline(normalized);
  if (segments) text.inline = segments;
  blocks.push({
    blockId,
    kind,
    origin: "official",
    text,
    evidence: evidence(ranges, normalized),
  });
  return blockId;
}

function addAssetRef(blocks: Block[], ranges: Range[], assetId: string, caption: string) {
  const unitId = currentUnitId;
  const blockId = `${unitId}#block-${String(blocks.length).padStart(3, "0")}`;
  blocks.push({
    blockId,
    kind: "table-ref",
    origin: "official",
    assetId,
    evidence: assetEvidence(ranges, caption),
  });
  return blockId;
}

let currentUnitId = "";

function unitId(official: string): string {
  return `urn:structural-codes:it:unit:circ2019:${official.toLowerCase()}`;
}

function sortKey(official: string): string {
  return official.slice(1).split(".").map((part) => part.padStart(3, "0")).join(".");
}

function tableId(official: string): string {
  return `urn:structural-codes:it:asset:table:circ2019:${official.toLowerCase().replace(/\./g, ".")}`;
}

function relation(official: string, headingBlockId: string) {
  const parts = official.slice(1).toLowerCase().split(".");
  while (parts.length > 0 && !existsSync(join(ROOT, "corpus", "units", "ntc2018", `${parts.join(".")}.json`))) parts.pop();
  const target = `urn:structural-codes:it:unit:ntc2018:${parts.join(".")}`;
  return [{
    relationId: `${currentUnitId}#relation-001`,
    type: "clarifies",
    targetUnitId: target,
    basis: "editorial",
    evidenceBlockIds: [headingBlockId],
    rationale: "Corrispondenza proposta tra numerazione omologa della Circolare e delle NTC; richiede conferma umana sul contenuto completo.",
    review: { status: "proposed", reviewedBy: null, reviewedAt: null },
  }];
}

function makeUnit(official: string, title: string, parentOfficial: string, ancestors: string[], position: number, build: (blocks: Block[]) => void, tableIds: string[] = []) {
  currentUnitId = unitId(official);
  const blocks: Block[] = [];
  const headingBlockId = addText(blocks, headingRanges[official]!, `${official} ${title}`, "heading");
  build(blocks);
  const record = {
    $schema: "urn:structural-codes:schema:canonical-unit:v2",
    schemaVersion: "2.0.0-alpha.2",
    recordType: "canonical-unit",
    id: currentUnitId,
    workId: WORK_ID,
    expressionId: EXPRESSION_ID,
    kind: "paragraph",
    numbering: { official, sortKey: sortKey(official) },
    title,
    titleBlockId: headingBlockId,
    hierarchy: {
      parentId: unitId(parentOfficial),
      ancestorIds: ancestors.map(unitId),
      position,
    },
    validity: { from: null, to: null, status: "unknown", asOf: TODAY },
    blocks,
    citations: [],
    relations: relation(official, headingBlockId),
    assets: { formulaIds: [], tableIds, figureIds: [] },
    workflow: {
      status: "extracted",
      createdBy: { actorId: "generator:circ85:step1", kind: "script", toolVersion: VERSION },
      createdAt: CREATED_AT,
      reviews: [],
      openIssues: [
        {
          issueId: `circ2019-${official.toLowerCase()}-source-review`,
          type: "normalization-review",
          severity: "blocking",
          note: "Trascrizione confrontata con il render ufficiale; resta obbligatoria la revisione umana indipendente.",
        },
        {
          issueId: `circ2019-${official.toLowerCase()}-relation`,
          type: "relation-review",
          severity: "blocking",
          note: "Il collegamento Circolare-NTC per numerazione omologa richiede conferma umana.",
        },
        ...(tableIds.length > 0 ? [{
          issueId: `circ2019-${official.toLowerCase()}-asset-review`,
          type: "asset-review",
          severity: "blocking",
          note: "Le tabelle devono essere sottoposte a verifica umana cella per cella e nel loro punto del flusso editoriale.",
        }] : []),
      ],
    },
  };
  writeFileSync(join(UNITS, `${official.toLowerCase()}.json`), `${JSON.stringify(record, null, 2)}\n`, "utf8");
}

const headingRanges: Record<string, Range[]> = {
  "C8.5": [{ page: 257, start: 33, end: 33 }],
  "C8.5.1": [{ page: 258, start: 3, end: 3 }],
  "C8.5.2": [{ page: 258, start: 24, end: 24 }],
  "C8.5.2.1": [{ page: 258, start: 25, end: 25 }],
  "C8.5.2.2": [{ page: 258, start: 43, end: 43 }],
  "C8.5.2.3": [{ page: 260, start: 5, end: 5 }],
  "C8.5.3": [{ page: 260, start: 16, end: 16 }],
  "C8.5.3.1": [{ page: 260, start: 28, end: 28 }],
  "C8.5.3.2": [{ page: 264, start: 6, end: 6 }],
  "C8.5.3.3": [{ page: 264, start: 47, end: 47 }],
};

const r = (page: number, start: number, end = start): Range[] => [{ page, start, end }];
const cross = (...ranges: Range[]): Range[] => ranges;

const TABLE_I = tableId("C8.5.I");
const TABLE_II = tableId("C8.5.II");

const captionI = "Tabella C8.5.I - Valori di riferimento dei parametri meccanici della muratura, da usarsi nei criteri di resistenza di seguito specificati (comportamento a tempi brevi), e peso specifico medio per diverse tipologie di muratura. I valori si riferiscono a: f = resistenza media a compressione, τ₀ = resistenza media a taglio in assenza di tensioni normali (con riferimento alla formula riportata, a proposito dei modelli di capacità, nel §C8.7.1.3), fᵥ₀ = resistenza media a taglio in assenza di tensioni normali (con riferimento alla formula riportata, a proposito dei modelli di capacità, nel §C8.7.1.3), E = valore medio del modulo di elasticità normale, G = valore medio del modulo di elasticità tangenziale, w = peso specifico medio.";
const captionII = "Tabella C8.5.II - Coefficienti correttivi massimi da applicarsi in presenza di: malta di caratteristiche buone; ricorsi o listature; sistematiche connessioni trasversali; consolidamento con iniezioni di malta; consolidamento con intonaco armato; ristilatura armata con connessione dei paramenti.";

function cell(text: string, latex?: string, extra: Record<string, number> = {}) {
  return { text, ...(latex ? { latex } : {}), ...extra };
}

const tableI = {
  id: TABLE_I,
  unitId: unitId("C8.5.3.1"),
  officialNumber: "C8.5.I",
  pdfPage: 261,
  caption: captionI,
  columnCount: 7,
  headers: [[
    cell("Tipologia di muratura"),
    cell("f (N/mm²), min-max", "f\\,\\left(\\mathrm{N/mm^2}\\right)\\;\\text{min-max}"),
    cell("τ₀ (N/mm²), min-max", "\\tau_0\\,\\left(\\mathrm{N/mm^2}\\right)\\;\\text{min-max}"),
    cell("fᵥ₀ (N/mm²)", "f_{v0}\\,\\left(\\mathrm{N/mm^2}\\right)"),
    cell("E (N/mm²), min-max", "E\\,\\left(\\mathrm{N/mm^2}\\right)\\;\\text{min-max}"),
    cell("G (N/mm²), min-max", "G\\,\\left(\\mathrm{N/mm^2}\\right)\\;\\text{min-max}"),
    cell("w (kN/m³)", "w\\,\\left(\\mathrm{kN/m^3}\\right)"),
  ]],
  rows: [
    [cell("Muratura in pietrame disordinata (ciottoli, pietre erratiche e irregolari)"), cell("1,0-2,0"), cell("0,018-0,032"), cell("-"), cell("690-1050"), cell("230-350"), cell("19")],
    [cell("Muratura a conci sbozzati, con paramenti di spessore disomogeneo (*)"), cell("2,0"), cell("0,035-0,051"), cell("-"), cell("1020-1440"), cell("340-480"), cell("20")],
    [cell("Muratura in pietre a spacco con buona tessitura"), cell("2,6-3,8"), cell("0,056-0,074"), cell("-"), cell("1500-1980"), cell("500-660"), cell("21")],
    [cell("Muratura irregolare di pietra tenera (tufo, calcarenite, ecc.,)"), cell("1,4-2,2"), cell("0,028-0,042"), cell("-"), cell("900-1260"), cell("300-420"), cell("13 ÷ 16(**)", undefined, { rowSpan: 2 })],
    [cell("Muratura a conci regolari di pietra tenera (tufo, calcarenite, ecc.,) (**)"), cell("2,0-3,2"), cell("0,04-0,08"), cell("0,10-0,19"), cell("1200-1620"), cell("400-500")],
    [cell("Muratura a blocchi lapidei squadrati"), cell("5,8-8,2"), cell("0,09-0,12"), cell("0,18-0,28"), cell("2400-3300"), cell("800-1100"), cell("22")],
    [cell("Muratura in mattoni pieni e malta di calce (***)"), cell("2,6-4,3"), cell("0,05-0,13"), cell("0,13-0,27"), cell("1200-1800"), cell("400-600"), cell("18")],
    [cell("Muratura in mattoni semipieni con malta cementizia (es.: doppio UNI foratura ≤40%)", undefined), cell("5,0-8,0"), cell("0,08-0,17"), cell("0,20-0,36"), cell("3500-5600"), cell("875-1400"), cell("15")],
  ],
  notes: [
    "(*) Nella muratura a conci sbozzati i valori di resistenza tabellati si possono incrementare se si riscontra la sistematica presenza di zeppe profonde in pietra che migliorano i contatti e aumentano l’ammorsamento tra gli elementi lapidei; in assenza di valutazioni più precise, si utilizzi un coefficiente pari a 1,2.",
    "(**) Data la varietà litologica della pietra tenera, il peso specifico è molto variabile ma può essere facilmente stimato con prove dirette. Nel caso di muratura a conci regolari di pietra tenera, in presenza di una caratterizzazione diretta della resistenza a compressione degli elementi costituenti, la resistenza a compressione f può essere valutata attraverso le indicazioni del § 11.10 delle NTC.",
    "(***) Nella muratura a mattoni pieni è opportuno ridurre i valori tabellati nel caso di giunti con spessore superiore a 13 mm; in assenza di valutazioni più precise, si utilizzi un coefficiente riduttivo pari a 0,7 per le resistenze e 0,8 per i moduli elastici.",
  ],
};

const tableII = {
  id: TABLE_II,
  unitId: unitId("C8.5.3.1"),
  officialNumber: "C8.5.II",
  pdfPage: 262,
  caption: captionII,
  columnCount: 8,
  headers: [
    [cell("Tipologia di muratura", undefined, { rowSpan: 2 }), cell("Stato di fatto", undefined, { colSpan: 3 }), cell("Interventi di consolidamento", undefined, { colSpan: 4 })],
    [cell("Malta buona"), cell("Ricorsi o listature"), cell("Connessione trasversale"), cell("Iniezione di miscele leganti (*)"), cell("Intonaco armato (**)"), cell("Ristilatura armata con connessione dei paramenti (**)") , cell("Massimo coefficiente complessivo")],
  ],
  rows: [
    [cell("Muratura in pietrame disordinata (ciottoli, pietre erratiche e irregolari)"), cell("1,5"), cell("1,3"), cell("1,5"), cell("2"), cell("2,5"), cell("1,6"), cell("3,5")],
    [cell("Muratura a conci sbozzati, con paramenti di spessore disomogeneo"), cell("1,4"), cell("1,2"), cell("1,5"), cell("1,7"), cell("2,0"), cell("1,5"), cell("3,0")],
    [cell("Muratura in pietre a spacco con buona tessitura"), cell("1,3"), cell("1,1"), cell("1,3"), cell("1,5"), cell("1,5"), cell("1,4"), cell("2,4")],
    [cell("Muratura irregolare di pietra tenera (tufo, calcarenite, ecc.,)"), cell("1,5"), cell("1,2"), cell("1,3"), cell("1,4"), cell("1,7"), cell("1,1"), cell("2,0")],
    [cell("Muratura a conci regolari di pietra tenera (tufo, calcarenite, ecc.,)"), cell("1,6"), cell("-"), cell("1,2"), cell("1,2"), cell("1,5"), cell("1,2"), cell("1,8")],
    [cell("Muratura a blocchi lapidei squadrati"), cell("1,2"), cell("-"), cell("1,2"), cell("1,2"), cell("1,2"), cell("-"), cell("1,4")],
    [cell("Muratura in mattoni pieni e malta di calce"), cell("(***)"), cell("-"), cell("1,3 (****)"), cell("1,2"), cell("1,5"), cell("1,2"), cell("1,8")],
    [cell("Muratura in mattoni semipieni con malta cementizia (es.: doppio UNI foratura ≤40%)"), cell("1,2"), cell("-"), cell("-"), cell("-"), cell("1,3"), cell("-"), cell("1,3")],
  ],
  notes: [
    "(*) I coefficienti correttivi relativi alle iniezioni di miscele leganti devono essere commisurati all’effettivo beneficio apportato alla muratura, riscontrabile con verifiche sia nella fase di esecuzione (iniettabilità) sia a-posteriori (riscontri sperimentali attraverso prove soniche o similari).",
    "(**) Valori da ridurre convenientemente nel caso di pareti di notevole spessore (p.es. > 70 cm).",
    "(***) Nel caso di muratura di mattoni si intende come “malta buona” una malta con resistenza media a compressione f_m superiore a 2 N/mm². In tal caso il coefficiente correttivo può essere posto pari a f_m^0,35 (f_m in N/mm²).",
    "(****) Nel caso di muratura di mattoni si intende come muratura trasversalmente connessa quella apparecchiata a regola d’arte.",
  ],
};

mkdirSync(UNITS, { recursive: true });
mkdirSync(ASSETS, { recursive: true });

makeUnit("C8.5", "DEFINIZIONE DEL MODELLO DI RIFERIMENTO PER LE ANALISI", "C8", ["C8"], 5, (blocks) => {
  addText(blocks, r(257, 34, 39), "La definizione di modelli di riferimento che descrivano il comportamento dell’edificio costituisce certamente una delle fasi più complesse dell’intera procedura di analisi. Infatti, considerando la grande varietà di costruzioni esistenti, non è possibile indicare procedure di modellazione. Tali problematiche diventano, poi, particolarmente rilevanti per le costruzioni in muratura, anche a causa delle numerose incertezze relative agli stati di sollecitazione in atto, ai tipi di materiale impiegati e al loro comportamento meccanico, al grado di connessione tra gli elementi strutturali e alla loro morfologia interna, oltre che agli eventuali interventi di trasformazione, riparazione o consolidamento già attuati in passato.");
  addText(blocks, r(257, 40, 41), "L’adeguata conoscenza del manufatto è presupposto fondamentale e fase imprescindibile per la comprensione di singole criticità e del comportamento strutturale; l’attendibilità dei risultati, dunque, è strettamente legata al livello di conoscenza.");
  addText(blocks, r(257, 42), "È opportuno sottolineare che le fasi della conoscenza e dell’analisi non sono sequenziali, ma strettamente connesse.");
  addText(blocks, r(257, 43, 47), "Il piano delle indagini, ad esempio, può essere efficacemente indirizzato, in relazione sia alla tipologia delle prove, sia alla loro localizzazione, da un’analisi basata su dati preliminari relativi alle caratteristiche geometriche, costruttive e dei materiali. In tal modo è possibile identificare le zone critiche nei riguardi degli stati limite ultimi, investigando eventualmente la sensibilità della risposta alle incertezze sui principali parametri, e quindi razionalizzare il piano delle indagini sperimentali, anche in considerazione della loro onerosità ed invasività.");
  addText(blocks, r(257, 48, 50), "Per gli edifici in muratura, anche considerate le conoscenze acquisibili, le verifiche nei riguardi di tutte le azioni possono essere eseguite utilizzando, quando previsto, un coefficiente γ_M non inferiore a 2 (Tab. 4.5.II in § 4.5.6.1 e §7.8.1.1 delle NTC).");
  addText(blocks, r(257, 51, 54), "In relazione al livello di conoscenza, le NTC definiscono opportuni fattori di confidenza, da intendersi come indici del livello di approfondimento raggiunto dalle indagini; è attraverso di essi che si possono ridurre i valori attribuiti ai parametri meccanici dei materiali. In determinate circostanze, i valori dei fattori di confidenza possono essere differenziati per i diversi materiali o per specifici elementi strutturali, nel modo illustrato nel seguito.");
  addText(blocks, r(257, 55, 56), "Indicazioni specifiche riguardanti le modalità di svolgimento delle analisi strutturali per la valutazione della sicurezza, sia nello stato di fatto, sia a seguito della realizzazione di interventi, sono riportate nel § 8.7 delle NTC.");
});

makeUnit("C8.5.1", "ANALISI STORICO-CRITICA", "C8.5", ["C8", "C8.5"], 1, (blocks) => {
  addText(blocks, r(258, 4, 5), "La conoscenza della storia di un fabbricato è elemento indispensabile, sia per la valutazione della sicurezza attuale, sia per la definizione degli interventi e la previsione della loro efficacia.");
  addText(blocks, r(258, 6, 9), "L’analisi storica deve essere finalizzata a comprendere le vicende costruttive, i dissesti, i fenomeni di degrado, i cimenti subiti dall’edificio e, particolarmente frequenti nelle costruzioni in muratura, le trasformazioni operate dall’uomo che possono aver prodotto cambiamenti nell’assetto statico originario. In tal senso l’indagine storica diventa indagine critica e fonte, per eccellenza, di documentazione e conoscenza finalizzate all’interpretazione del comportamento strutturale.");
  addText(blocks, r(258, 10, 12), "L’analisi inizia con il reperire tutti i documenti disponibili sulle origini del fabbricato quali, ad esempio, elaborati e relazioni progettuali della prima realizzazione della costruzione e di eventuali successivi interventi, elaborati e rilievi già prodotti, eventuali relazioni di collaudo e riguarda:");
  addText(blocks, r(258, 13), "l’epoca di costruzione;", "list-item");
  addText(blocks, r(258, 14), "le tecniche, le regole costruttive e, se esistenti, le norme tecniche dell’epoca di costruzione;", "list-item");
  addText(blocks, r(258, 15), "la forma originaria e le successive modifiche;", "list-item");
  addText(blocks, r(258, 16), "i traumi subiti e le alterazioni delle condizioni al contorno;", "list-item");
  addText(blocks, r(258, 17), "le deformazioni, i dissesti e i quadri fessurativi, con indicazioni, ove possibile, della loro evoluzione nel tempo;", "list-item");
  addText(blocks, r(258, 18), "gli interventi di consolidamento pregressi;", "list-item");
  addText(blocks, r(258, 19), "gli aspetti urbanistici e storici che hanno regolato lo sviluppo dell’aggregato edilizio di cui l’edificio è parte.", "list-item");
  addText(blocks, r(258, 20, 21), "Risulta, in generale, utile anche la conoscenza delle patologie o delle carenze costruttive evidenziate da edifici simili per tipologia ed epoca di costruzione.");
  addText(blocks, r(258, 22, 23), "In definitiva, questa fase deve permettere di interpretare la condizione attuale dell’edificio come risultato di una serie di vicende statiche e di trasformazioni che si sono sovrapposte nel tempo.");
});

makeUnit("C8.5.2", "RILIEVO", "C8.5", ["C8", "C8.5"], 2, () => {});

makeUnit("C8.5.2.1", "COSTRUZIONI DI MURATURA", "C8.5.2", ["C8", "C8.5", "C8.5.2"], 1, (blocks) => {
  addText(blocks, r(258, 26, 29), "Nelle costruzioni di muratura, vista la grande varietà di materiali e tecniche costruttive impiegate, riveste un ruolo di primaria importanza la conoscenza della composizione degli elementi costruttivi e delle caratteristiche dei collegamenti, a partire dalla tipologia e disposizione dei materiali e dalla presenza di discontinuità; in questo ambito, la verifica dell’efficacia degli incatenamenti, siano essi lignei o metallici, merita una particolare attenzione.");
  addText(blocks, r(258, 30), "Nel rilievo si possono individuare tre livelli di indagine, in relazione al loro grado di approfondimento.");
  addText(blocks, r(258, 31, 34), "Indagini limitate: sono generalmente basate su indagini di tipo visivo che, al rilievo geometrico delle superfici esterne degli elementi costruttivi, uniscono saggi che consentano di esaminare, almeno localmente, le caratteristiche della muratura sotto intonaco e nello spessore, caratterizzando così la sezione muraria, il grado di ammorsamento tra pareti ortogonali e le zone di appoggio dei solai, i dispositivi di collegamento e di eliminazione delle spinte.");
  addText(blocks, r(258, 35, 37), "Indagini estese: i rilievi e le indagini in-situ indicati al punto precedente, sono accompagnati da saggi più estesi e diffusi così da ottenere tipizzazioni delle caratteristiche dei materiali e costruttive e una aderenza delle indicazioni fedele alla reale varietà della costruzione.");
  addText(blocks, r(258, 38, 42), "Indagini esaustive: oltre a quanto indicato al punto precedente, le indagini sono estese in modo sistematico con il ricorso a saggi che consentano al tecnico di formarsi un’opinione chiara sulla morfologia e qualità delle murature, sul rispetto della regola dell’arte nella disposizione dei materiali, sia in superficie che nello spessore murario, sull’efficacia dell’ammorsamento tra le pareti e dei dispositivi di collegamento e di eliminazione delle spinte, oltre che sulle caratteristiche degli appoggi degli elementi orizzontali.");
});

makeUnit("C8.5.2.2", "COSTRUZIONI DI CALCESTRUZZO ARMATO O ACCIAIO", "C8.5.2", ["C8", "C8.5", "C8.5.2"], 2, (blocks) => {
  addText(blocks, r(258, 44, 49), "Il rilievo è finalizzato alla definizione sia della geometria esterna, sia dei dettagli di tutti gli elementi costruttivi effettivamente raggiungibili, con funzione strutturale o meno. Per gli elementi aventi funzione strutturale la geometria esterna deve essere sempre descritta in maniera la più completa possibile, allo scopo di ottenere un modello di calcolo affidabile, mentre i dettagli, spesso occultati alla vista (ad esempio la disposizione delle armature), possono essere rilevati a campione, estendendo poi le valutazioni agli altri elementi operando per analogia, anche in forza delle norme vigenti e dei prodotti in commercio all’epoca della costruzione.");
  addText(blocks, r(258, 50, 54), "Il rilievo di manufatti che non hanno funzione strutturale (pareti divisorie, controsoffitti, impianti) deve essere effettuato con l’obiettivo principale di identificare eventuali rischi per la sicurezza degli abitanti, connessi a problemi di stabilità dei manufatti stessi o delle strutture. Particolarmente pericolose si sono rivelate, in occasione di eventi sismici, le pareti di tamponamento formate da più paramenti accostati e privi di adeguati collegamenti tra loro o/e separati da intercapedini isolanti, ancor più quando non sono contenute in riquadri strutturali.");
  addText(blocks, r(259, 3), "Il rilievo geometrico degli elementi deve permettere:");
  addText(blocks, r(259, 4), "l’identificazione dell’organizzazione strutturale;", "list-item");
  addText(blocks, r(259, 5), "l’individuazione della posizione e delle dimensioni di travi, pilastri, scale e setti;", "list-item");
  addText(blocks, r(259, 6), "l’identificazione dei solai e della loro tipologia, orditura, sezione verticale;", "list-item");
  addText(blocks, r(259, 7), "l’individuazione di tipologia e dimensioni degli elementi non strutturali quali tamponamenti, tramezzature, etc.", "list-item");
  addText(blocks, r(259, 8), "In particolare, per le costruzioni in acciaio, i dati raccolti devono includere anche:");
  addText(blocks, r(259, 9), "la forma originale dei profili e le loro dimensioni geometriche;", "list-item");
  addText(blocks, r(259, 10), "la tipologia e morfologia delle unioni.", "list-item");
  addText(blocks, r(259, 11, 12), "Nel caso in cui la geometria della struttura sia nota dai disegni originali, deve essere comunque eseguito il rilievo visivo a campione per verificare l’effettiva corrispondenza del costruito ai disegni di progetto.");
  addText(blocks, r(259, 13, 14), "Nel definire il comportamento della costruzione in presenza di sisma sono di particolare importanza i dettagli costruttivi; le informazioni su di essi possono essere desunte dai disegni originali, da un progetto simulato o da indagini in situ.");
  addText(blocks, r(259, 15, 17), "Il progetto simulato, eseguito sulla base delle norme tecniche in vigore all’epoca della costruzione e della corrispondente pratica costruttiva, è utile per fornire informazioni su quantità e disposizione dell’armatura negli elementi con funzione strutturale e sulle caratteristiche dei collegamenti.");
  addText(blocks, r(259, 18, 20), "Sia che si disponga dei disegni originali, sia che si sia prodotto un progetto simulato, per verificarne la rispondenza alla realtà del costruito in termini di particolari costruttivi occorre effettuare rilievi in situ. Nei rilievi si possono individuare tre livelli di indagine, in relazione al loro grado di approfondimento.");
  addText(blocks, r(259, 21, 22), "Indagini limitate: consentono di valutare, mediante saggi a campione, la corrispondenza tra le caratteristiche dei collegamenti riportate negli elaborati progettuali originali o ottenute attraverso il progetto simulato, e quelle effettivamente presenti.");
  addText(blocks, r(259, 23, 24), "Indagini estese: si effettuano quando non sono disponibili gli elaborati progettuali originali, o come alternativa al progetto simulato seguito da indagini limitate, oppure quando gli elaborati progettuali originali risultano incompleti.");
  addText(blocks, r(259, 25, 26), "Indagini esaustive: si effettuano quando si desidera un livello di conoscenza accurata e non sono disponibili gli elaborati progettuali originali.");
  addText(blocks, r(259, 27, 31), "Le indagini in-situ basate su saggi sono effettuate su una congrua percentuale degli elementi strutturali, privilegiando, tra le tipologie di elementi strutturali (travi, pilastri, pareti…), quelle che rivestono un ruolo di primaria importanza nella struttura. Il quantitativo di indagini in-situ basate su saggi dipende dal livello di conoscenza desiderato in relazione al grado di sicurezza attuale e deve essere accuratamente valutato, anche in vista delle notevoli conseguenze che comporta sulla progettazione degli interventi.");
  addText(blocks, r(259, 32, 33), "Al fine di determinare, in maniera opportuna, il numero e la localizzazione delle indagini in-situ da effettuare, è utile eseguire, a seguito del rilievo geometrico:");
  addText(blocks, r(259, 34), "una campagna preliminare di indagini in-situ volta alla conoscenza dei dettagli costruttivi ritenuti più significativi;", "list-item");
  addText(blocks, r(259, 35, 38), "un’analisi preliminare della sicurezza statica e della vulnerabilità sismica dell’edificio, eseguita estendendo il risultato dei rilievi dei particolari costruttivi (sfruttando anche eventuali simmetrie o situazioni ripetitive della struttura) agli elementi simili per dimensioni e/o impegno statico, eventualmente utilizzando i risultati preliminari delle prove sui materiali come definite al § C8.5.3.2.", "list-item");
  addText(blocks, r(259, 39, 42), "Dall’esito, in termini di impegno statico e ruolo delle diverse membrature nella sicurezza della struttura, fornito dall’analisi preliminare può scaturire la necessità di approfondimenti in termini di numero, tipologia e localizzazione delle indagini in-situ basate su saggi; il progetto delle indagini ne fornisce la misura, consentendo così di graduare quantitativamente il livello di approfondimento.");
  addText(blocks, r(259, 43, 44), "A titolo esemplificativo e quando realmente possibile, il rilievo dei dettagli costruttivi è finalizzato a conseguire le seguenti informazioni:");
  addText(blocks, r(259, 45), "Costruzioni di calcestruzzo armato", "heading");
  addText(blocks, r(259, 46), "quantità di armatura longitudinale in travi, pilastri, pareti e sua disposizione;", "list-item");
  addText(blocks, r(259, 47), "quantità di barre di armatura piegate che contribuiscono alla resistenza a taglio, presenti nelle travi;", "list-item");
  addText(blocks, r(259, 48), "quantità e dettagli di armatura trasversale nelle zone critiche e nei nodi trave-pilastro;", "list-item");
  addText(blocks, r(259, 49), "quantità di armatura longitudinale che contribuisce al momento negativo di travi a T, presente nei solai;", "list-item");
  addText(blocks, r(259, 50), "lunghezze di appoggio e condizioni di vincolo degli elementi orizzontali;", "list-item");
  addText(blocks, r(259, 51), "spessore dei copriferri;", "list-item");
  addText(blocks, r(259, 52), "lunghezza delle zone di sovrapposizione delle barre e dei loro ancoraggi;", "list-item");
  addText(blocks, r(259, 53), "Costruzioni di acciaio:", "heading");
  addText(blocks, r(259, 54), "tipologia e localizzazione dei giunti tra le membrature;", "list-item");
  addText(blocks, r(260, 3), "particolari di appoggio dei solai;", "list-item");
  addText(blocks, r(260, 4), "modalità di collegamento alle fondazioni.", "list-item");
});

makeUnit("C8.5.2.3", "COSTRUZIONI DI LEGNO", "C8.5.2", ["C8", "C8.5", "C8.5.2"], 3, (blocks) => {
  addText(blocks, r(260, 6, 7), "Per costruzioni di legno si intendono sia opere realizzate interamente con struttura lignea, sia elementi costruttivi all’interno di costruzioni caratterizzate da altre tipologie strutturali.");
  addText(blocks, r(260, 8, 10), "Il rilievo geometrico riguarda le membrature, la disposizione degli elementi nella struttura e i collegamenti (di carpenteria o meccanici); deve essere accuratamente rilevata la morfologia delle membrature, con le variazioni di forma della sezione e i difetti del materiale, in quanto elementi fondamentali per la quantificazione della capacità portante.");
  addText(blocks, r(260, 11, 15), "Per la comprensione dei fenomeni di dissesto, attenzione deve essere rivolta al rilievo delle deformazioni delle singole membrature e della struttura, distinguendo, ove possibile, lo stato deformativo derivante dalle azioni applicate da quello proprio del materiale, causato ad esempio da difettosità anatomiche, di taglio o di lavorazione. A tale scopo devono essere identificate le zone deteriorate, con particolare riferimento alle unioni tra elementi lignei o ai collegamenti di interfaccia tra membrature lignee e altri materiali (ad esempio muratura) o altre parti della costruzione (ad esempio fondazioni).");
});

makeUnit("C8.5.3", "CARATTERIZZAZIONE MECCANICA DEI MATERIALI", "C8.5", ["C8", "C8.5"], 3, (blocks) => {
  addText(blocks, r(260, 17, 18), "Il § 8.5.3 delle NTC tratta della conoscenza delle caratteristiche di resistenza e deformabilità dei materiali con i quali è realizzato un fabbricato.");
  addText(blocks, r(260, 19, 22), "La norma prevede che per le prove di cui alla Circolare 08 settembre 2010, n. 7617/STC o eventuali successive modifiche o integrazioni, il prelievo dei campioni dalla struttura e l’esecuzione delle prove stesse devono essere effettuate a cura di un laboratorio di cui all’articolo 59 del DPR 380/2001. Ciò fa riferimento, esclusivamente, al prelievo dei campioni per le prove distruttive i cui esiti sono soggetti a certificazione ai sensi dello stesso articolo 59 del DPR 380/01.");
  addText(blocks, cross(r(260, 23, 27)[0]!, r(261, 3, 4)[0]!), "In tal senso le NTC hanno voluto ricondurre ad un modello unitario - in termini di qualità e responsabilità - l’intero loro processo costruttivo e, conseguentemente anche l’attività di prelievo, quale ad esempio il carotaggio, giacché le prove comprendono ogni fase: dal prelievo del materiale, alla verifica fisica, chimica e meccanica della carota stessa. Il carotaggio costituisce una prima analisi, almeno qualitativa, di resistenza fisica del campione che si sta prelevando; l’operazione di carotaggio stessa è, inoltre, in grado di influenzare in maniera determinante, essa stessa, la resistenza fisica del campione che si sta prelevando, nel caso di sollecitazioni di trazione permanenti, inoltre, la resistenza a trazione delle murature, non indicata nella tabella, può ridursi significativamente.");
});

makeUnit("C8.5.3.1", "COSTRUZIONI DI MURATURA", "C8.5.3", ["C8", "C8.5", "C8.5.3"], 1, (blocks) => {
  addText(blocks, r(260, 29, 31), "La muratura in una costruzione esistente è il risultato dell’assemblaggio di materiali diversi, in cui la tecnica costruttiva, le modalità di posa in opera, le caratteristiche meccaniche dei materiali costituenti e il loro stato di conservazione, determinano il comportamento meccanico dell’insieme.");
  addText(blocks, r(260, 32, 35), "La misura diretta delle caratteristiche meccaniche della muratura avviene mediante l’esecuzione di prove in-situ su porzioni di muratura, o di prove in laboratorio su elementi indisturbati prelevati in-situ, ove questo sia possibile; le prove possono essere di compressione e di taglio, scelte in relazione alla tipologia muraria e al criterio di resistenza adottato per l’analisi; le modalità di prova e la relativa interpretazione dei risultati devono seguire procedure di riconosciuta validità.");
  addText(blocks, r(260, 36, 37), "Ulteriori informazioni si possono desumere da metodi di prova non distruttivi, utili anche ad estendere all’intero edificio i risultati ottenuti a livello locale con prove distruttive o mediamente distruttive.");
  addText(blocks, r(260, 38, 42), "In relazione al numero delle indagini e alle modalità con cui condurle, la grande varietà tipologica e la frequente presenza di stratificazioni temporalmente successive, come avviene, in particolare, negli edifici storici, rende priva di significato la prescrizione di una precisa quantità e tipologia di indagini, anche in vista del fatto che, talvolta, l’individuazione delle situazioni di vulnerabilità risulta più significativa della stessa caratterizzazione dei materiali. L’esecuzione delle indagini deve seguire protocolli operativi e interpretativi di comprovata validità.");
  addText(blocks, r(260, 43, 50), "La tabella C8.5.I riporta, per il comportamento delle tipologie murarie più ricorrenti, indicazioni, non vincolanti, sui possibili valori dei parametri meccanici, identificati attraverso il rilievo degli aspetti costruttivi (§C8.5.2.1) e relativi, con l’eccezione dell’ultima riga, a precise condizioni: malta di calce di modeste caratteristiche (resistenza media a compressione f_m stimabile tra 0,7 e 1,5 N/mm²), assenza di ricorsi (listature), paramenti semplicemente accostati o mal collegati, tessitura (nel caso di elementi regolari) a regola d’arte, muratura non consolidata. Ai soli fini della verifica sismica, nel caso in cui la malta abbia caratteristiche particolarmente scadenti (resistenza media a compressione f_m stimabile inferiore a 0,7 N/mm²) ai valori della tabella si applica un coefficiente riduttivo pari a 0,7 per le resistenze e 0,8 per i moduli elastici. I parametri indicati in tabella sono principalmente finalizzati alle verifiche nei riguardi delle azioni sismiche.");
  addAssetRef(blocks, r(261, 7, 11), TABLE_I, captionI);
  addText(blocks, r(261, 50, 51), "Le Regioni potranno, tenendo conto delle specificità costruttive del proprio territorio, definire zone omogenee a cui riferirsi a tal fine.");
  addText(blocks, r(261, 52, 53), "Le caratteristiche meccaniche della muratura, in uno stato di fatto migliore di quello indicato nella Tabella C8.5.I, possono ottenersi applicando (indicativamente e salvo più dettagliate valutazioni) i coefficienti migliorativi di Tabella C8.5.II.");
  addText(blocks, r(261, 54), "I coefficienti migliorativi sono funzione dei seguenti fattori:");
  addText(blocks, r(261, 55, 56), "malta di buone caratteristiche: il coefficiente indicato in Tabella C8.5.II, diversificato per le varie tipologie, si può applicare sia ai parametri di resistenza (f, τ₀ e fᵥ₀), sia ai moduli elastici (E e G);", "list-item");
  addText(blocks, r(261, 57, 58), "presenza di ricorsi (o listature): il coefficiente di tabella si può applicare ai soli parametri di resistenza (f e τ₀); tale coefficiente ha significato solo per alcune tipologie murarie, in cui si riscontra tale tecnica costruttiva;", "list-item");
  addText(blocks, r(261, 59, 60), "presenza sistematica di elementi di collegamento trasversale tra i paramenti: il coefficiente indicato in tabella si può applicare ai soli parametri di resistenza (f, τ₀ e fᵥ₀).", "list-item");
  addText(blocks, r(261, 61, 62), "I suddetti coefficienti migliorativi possono essere applicati in combinazione tra loro, in forma moltiplicativa, considerando la concomitanza al più dei due effetti che hanno i coefficienti moltiplicativi più alti.");
  addText(blocks, r(261, 63, 67), "I dati riportati nella Tabella C8.5.I fanno riferimento, ad eccezione dell’ultima riga, a una muratura costituita da due paramenti accostati, con eventuale nucleo interno di limitato spessore (significativamente inferiore a quello dei paramenti). In questi casi è preventivamente necessario valutare se la muratura ha caratteristiche tali da garantire che il pannello murario possa comportarsi unitariamente nei riguardi delle sollecitazioni, sia verticali, sia a taglio; in caso contrario la modellazione con parametri meccanici equivalenti ha poco significato.");
  addText(blocks, r(262, 3, 6), "I muri realizzati con due paramenti semplicemente accostati o con riempimenti “a sacco” di scadenti caratteristiche meccaniche presentano un elevato rischio di instabilità, che può essere accentuato dalla presenza di orizzontamenti appoggiati solo su uno dei paramenti e dall’assenza di efficaci ancoraggi tra i solai e i paramenti esterni dei muri. Il rischio di instabilità, maggiore nei muri in pietrame, è presente anche nei casi di pietre squadrate sulle superfici esterne.");
  addText(blocks, r(262, 7, 8), "Nel caso non sussistano rischi di instabilità dei singoli paramenti si potrà considerare il muro come composto da due pareti tra loro semplicemente accostate, ciascuna di spessore pari alla propria sezione efficace.");
  addText(blocks, r(262, 9, 10), "Dopo avere esclusa la possibilità di meccanismi di distacco tra i paramenti, nel caso in cui il nucleo interno sia ampio rispetto ai paramenti, e in particolare se scadente, è opportuno ridurre i parametri di resistenza e deformabilità propri dei paramenti esterni.");
  addText(blocks, r(262, 11, 13), "Nel caso di nucleo interno di spessore consistente, le proprietà meccaniche equivalenti della muratura, da attribuire all’intero spessore della parete, sono da ottenersi a partire da quelle dei paramenti (Tabella C8.5.I, eventualmente modificata dai coefficienti della Tabella C8.5.II) e del nucleo, attraverso valutazioni opportune.");
  addText(blocks, r(262, 14, 15), "Nel caso particolare di nucleo interno di caratteristiche meccaniche trascurabili, le proprietà equivalenti del pannello murario possono essere ottenute, cautelativamente e in via semplificata, trascurando lo spessore del nucleo.");
  addAssetRef(blocks, r(262, 16, 17), TABLE_II, captionII);
  addText(blocks, r(262, 50, 52), "In presenza di murature consolidate o nel caso in cui si debba progettare un intervento di rinforzo, è possibile incrementare i valori ottenuti con il procedimento suddetto applicando gli ulteriori coefficienti indicati in Tabella C8.5.II, in base alle tecniche di consolidamento previste, secondo le modalità di seguito illustrate");
  addText(blocks, r(262, 53), "Consolidamento con iniezioni di miscele leganti", "heading");
  addText(blocks, r(262, 54, 59), "Il coefficiente indicato in tabella, diversificato per le varie tipologie murarie, può essere applicato ai valori sia dei parametri di resistenza (f, τ₀ e fᵥ₀), sia dei moduli elastici (E e G); i benefici conseguibili dipendono in modo sensibile dalla qualità originaria della malta, risultando tanto maggiori quanto più questa è scadente. È bene ricordare che gli effettivi benefici delle iniezioni sono funzione della reale possibilità delle malte iniettate di riempire lacune esistenti nella trama muraria e di aderire ai materiali esistenti; in ogni caso, è raccomandabile l’esecuzione di saggi, preventivi e di verifica, per valutare i risultati effettivamente conseguiti.");
  addText(blocks, r(262, 60), "Consolidamento con intonaco armato", "heading");
  addText(blocks, r(262, 61, 62), "L’effetto di questa tipologia di consolidamento può essere stimato attraverso opportune valutazioni che considerino gli spessori della parete e dell’intonaco armato, oltre che i relativi parametri meccanici.");
  addText(blocks, r(262, 63, 64), "In assenza di queste è possibile adottare il coefficiente indicato in tabella, diversificato per le varie tipologie, applicabile ai valori sia dei parametri di resistenza (f, τ₀ e fᵥ₀), sia dei moduli elastici (E e G).");
  addText(blocks, r(263, 3, 5), "In tal caso non si applicano i coefficienti relativi alla connessione trasversale della muratura non consolidata e alla ristilatura armata. Si rileva che il consolidamento con intonaco armato non ha alcuna efficacia in assenza di sistematiche connessioni trasversali e la sua efficacia è ridotta quando realizzato su un solo paramento.");
  addText(blocks, r(263, 6, 9), "Nell’adozione degli eventuali coefficienti migliorativi si deve tenere conto delle caratteristiche delle malte utilizzate (cementizie o a calce) e delle armature (metalliche o in fibra). Infine, si segnala la necessità di una preventiva verifica che il paramento non evidenzi un’eccessiva disgregazione o presenza di vuoti, tale da rendere inefficace l’accoppiamento con l’intonaco armato; in questi casi è opportuno accoppiare l’intervento con iniezioni.");
  addText(blocks, r(263, 10), "Consolidamento con diatoni artificiali o tirantini antiespulsivi", "heading");
  addText(blocks, r(263, 11, 14), "Nel caso dell’inserimento di diatoni artificiali dotati di una significativa rigidezza a taglio e sufficientemente diffusi, si può applicare a tutti i parametri di resistenza il coefficiente indicato per le murature originariamente dotate di una buona connessione trasversale; gli elementi di connessione a trazione (tirantini) hanno un effetto significativo solo per la resistenza a compressione (f).");
  addText(blocks, r(263, 15), "Consolidamento con ristilatura armata e connessione dei paramenti", "heading");
  addText(blocks, r(263, 16, 17), "Il coefficiente indicato in tabella, diversificato per le varie tipologie murarie, può essere applicato ai valori sia dei parametri di resistenza (f, τ₀ e fᵥ₀), sia dei moduli elastici (E, G), in quest’ultimo caso in misura ridotta del 50%.");
  addText(blocks, r(263, 18, 20), "Questa tecnica (con i relativi coefficienti migliorativi) può essere applicata anche sostituendo, su uno dei paramenti, la ristilatura armata con un intonaco armato di limitato spessore, realizzato con malta a base calce, purché siano posti in opera gli elementi di connessione trasversale.");
  addText(blocks, r(263, 21, 23), "I valori sopra indicati in tabella per il consolidamento delle murature devono essere considerati essenzialmente un riferimento, in assenza di specifiche valutazioni sui valori da adottare per il caso in esame; nel caso di tecniche diverse da quelle indicate nella tabella, i valori riportati costituiscono un utile riferimento.");
  addText(blocks, r(263, 24, 25), "Nel caso di uso combinato di diverse tecniche di consolidamento, i coefficienti possono essere applicati in forma moltiplicativa; il valore del coefficiente complessivo non può superare il coefficiente massimo indicato nell’ultima colonna della tabella.");
  addText(blocks, r(263, 26, 27), "Nella caratterizzazione meccanica dei materiali si possono distinguere, in relazione al loro grado di approfondimento, tre livelli di prova.");
  addText(blocks, r(263, 28, 33), "Prove limitate: Si tratta di indagini non dettagliate e non estese, basate principalmente su esami visivi delle superfici, che prevedono limitati controlli degli elementi costituenti la muratura. Sono previste rimozioni locali dell’intonaco per identificare i materiali di cui è costituito l’edificio; in particolare, avvalendosi anche dell’analisi storico-critica, è possibile suddividere le pareti murarie in aree considerabili come omogenee. Scopo delle indagini è consentire l’identificazione delle tipologie di muratura alla quale fare riferimento ai fini della determinazione delle proprietà meccaniche; questo prevede il rilievo della tessitura muraria dei paramenti ed una stima della sezione muraria.");
  addText(blocks, r(263, 34, 40), "Prove estese: Si tratta di indagini visive, diffuse e sistematiche, accompagnate da approfondimenti locali. Si prevedono saggi estesi, sia in superficie sia nello spessore murario (anche con endoscopie), mirati alla conoscenza dei materiali e della morfologia interna della muratura, all’individuazione delle zone omogenee per materiali e tessitura muraria, dei dispositivi di collegamento trasversale, oltre che dei fenomeni di degrado. È inoltre prevista l’esecuzione di analisi delle malte e, se significative, degli elementi costituenti, accompagnate da tecniche diagnostiche non distruttive (penetrometriche, sclerometriche, soniche, termografiche, radar, ecc.) ed eventualmente integrate da tecniche moderatamente distruttive (ad esempio martinetti piatti), finalizzate a classificare in modo più accurato la tipologia muraria e la sua qualità.");
  addText(blocks, r(263, 41, 51), "Prove esaustive: In aggiunta alle richieste della categoria precedente, si prevedono prove dirette sui materiali per determinarne i parametri meccanici. Il progettista ne stabilisce tipologia e quantità in base alle esigenze di conoscenza della struttura. Le prove devono essere eseguite o in situ o in laboratorio su elementi indisturbati prelevati in situ; esse possono comprendere, se significative: prove di compressione (ad esempio: su pannelli o tramite martinetti piatti doppi); prove di taglio (ad esempio: compressione e taglio, compressione diagonale, taglio diretto sul giunto), selezionate in relazione alla tipologia muraria e al criterio di resistenza adottato per l’analisi. Le prove devono essere eseguite su tutte le tipologie murarie o comunque su quelle relative agli elementi che, dall’analisi di sensibilità basata sui dati preliminari (§ C8.5), sono risultati significativi per la valutazione della sicurezza. I valori per le verifiche saranno ottenuti, a partire dai valori medi presenti nella Tabella C8.5.I, utilizzando misure sperimentali dirette sull’edificio, tenendo conto dell’attendibilità del metodo di prova. In sostituzione, possono essere considerati i risultati di prove eseguite su altre costruzioni della stessa zona, in presenza di chiara e comprovata corrispondenza tipologica per materiali e morfologia.");
  addText(blocks, r(263, 52, 53), "A seguito delle indagini, è necessario valutare, per ogni prova, il grado di rappresentatività sia della classe tipologica attribuita al materiale, sia dei valori medi delle caratteristiche meccaniche dell’edificio da utilizzare nelle modellazioni.");
  addText(blocks, r(263, 54, 56), "A questo scopo possono essere utili metodi che, avvalendosi della lettura visiva dei paramenti e della sezione, consentano di ottenere delle stime di tali caratteristiche attraverso indicatori di qualità muraria, purché elaborati con procedure di comprovata attendibilità.");
  addText(blocks, cross(r(263, 57)[0]!, r(264, 3)[0]!), "Nelle costruzioni con struttura muraria occorre considerare anche la presenza di elementi realizzati con altri materiali (strutture lignee, solai in c.a., tiranti d’acciaio ecc.), da indagarsi con le metodologie indicate negli specifici Capitoli.");
  addText(blocks, r(264, 4, 5), "Nei casi, previsti dalle NTC, in cui sia necessario eseguire indagini sulle fondazioni, queste saranno volte a determinarne morfologia, profondità e materiali costituenti, a prescindere dai gradi di approfondimento sopra riportati.");
}, [TABLE_I, TABLE_II]);

makeUnit("C8.5.3.2", "COSTRUZIONI DI CALCESTRUZZO ARMATO O ACCIAIO", "C8.5.3", ["C8", "C8.5", "C8.5.3"], 2, (blocks) => {
  addText(blocks, r(264, 7), "I valori delle caratteristiche meccaniche dei materiali prescindono dalle classi discretizzate previste nelle NTC.");
  addText(blocks, r(264, 8), "Per definire le caratteristiche meccaniche dei materiali è possibile riferirsi anche alle norme dell’epoca della costruzione.");
  addText(blocks, r(264, 9, 10), "Calcestruzzo: si fa riferimento alle Linee Guida per la valutazione delle caratteristiche del calcestruzzo in opera, del Consiglio Superiore dei Lavori Pubblici.");
  addText(blocks, r(264, 11, 14), "Acciaio: la misura delle caratteristiche meccaniche si ottiene, in generale, mediante estrazione di campioni ed esecuzione di prove a trazione fino a rottura con determinazione della tensione di snervamento, della resistenza a rottura e dell’allungamento, salvo nel caso in cui siano disponibili certificati di prova conformi a quanto richiesto per le nuove costruzioni nella normativa dell’epoca di costruzione.");
  addText(blocks, r(264, 15, 17), "Unioni di elementi d’acciaio: la misura delle caratteristiche meccaniche si ottiene, ove possibile, mediante estrazione di campioni ed esecuzione di prove a trazione fino a rottura con determinazione delle caratteristiche meccaniche rilevanti, quali la tensione di snervamento, della resistenza a rottura e dell’allungamento.");
  addText(blocks, r(264, 18, 19), "Sono ammessi metodi di indagine non distruttiva di documentata affidabilità, ad integrazione di quelli sopra descritti, purché i risultati siano tarati su quelli ottenuti con prove distruttive.");
  addText(blocks, r(264, 20, 21), "Le prove sui materiali, in analogia a quanto definito per le indagini sui dettagli costruttivi, possono essere eseguite su un numero di elementi diverso, a seconda del livello di conoscenza che si vuole raggiungere.");
  addText(blocks, r(264, 22), "Si possono distinguere, in relazione al loro grado di approfondimento, tre livelli di prova.");
  addText(blocks, r(264, 23, 25), "Prove limitate: prevedono un numero limitato di prove in-situ o su campioni, impiegate per completare le informazioni sulle proprietà dei materiali, siano esse ottenute dalle normative in vigore all’epoca della costruzione, o dalle caratteristiche nominali riportate sui disegni costruttivi o nei certificati originali di prova.");
  addText(blocks, r(264, 26, 28), "Prove estese: prevedono prove in-situ o su campioni più numerose di quelle del caso precedente e finalizzate a fornire informazioni in assenza sia dei disegni costruttivi, sia dei certificati originali di prova o quando i valori ottenuti con le prove limitate risultino inferiori a quelli riportati nei disegni o sui certificati originali.");
  addText(blocks, r(264, 29, 32), "Prove esaustive: prevedono prove in-situ o su campioni più numerose di quelle del caso precedente e finalizzate a ottenere informazioni in mancanza sia dei disegni costruttivi, sia dei certificati originali di prova, o quando i valori ottenuti dalle prove, limitate o estese, risultino inferiori a quelli riportati sui disegni o nei certificati originali, oppure nei casi in cui si desideri una conoscenza particolarmente accurata.");
  addText(blocks, r(264, 33), "Al fine di determinare in maniera opportuna il numero e la localizzazione delle prove sui materiali, è utile:");
  addText(blocks, r(264, 34, 36), "eseguire un numero limitato di indagini preliminari sugli elementi individuati come rappresentativi a seguito dell’analisi storico-critica, della documentazione disponibile e del rilievo geometrico, al fine di definire un modello preliminare della struttura;", "list-item");
  addText(blocks, r(264, 37, 38), "eseguire un’analisi per la verifica preliminare della sicurezza statica e della vulnerabilità sismica, utilizzando i dettagli costruttivi valutati nel corso della campagna di indagini preliminari (§ C8.5.2.2).", "list-item");
  addText(blocks, r(264, 39, 43), "In base all’esito dell’analisi preliminare è valutata la necessità di approfondimenti della campagna di indagini in termini di numero e localizzazione, in relazione all’impegno statico delle diverse membrature, del loro ruolo riguardo alla sicurezza della struttura e del grado di omogeneità dei risultati delle prove preliminari, anche in relazione a quanto previsto dai documenti originari; il progetto delle prove ne fornisce la misura, consentendo così di graduare quantitativamente il livello di approfondimento.");
  addText(blocks, r(264, 44), "Per l’identificazione delle caratteristiche dei materiali, i dati raccolti devono includere le seguenti caratteristiche:");
  addText(blocks, r(264, 45), "resistenza e, ove significativo, il modulo elastico E del calcestruzzo;", "list-item");
  addText(blocks, r(264, 46), "tensione di snervamento, resistenza a rottura e allungamento dell’acciaio.", "list-item");
});

makeUnit("C8.5.3.3", "COSTRUZIONI DI LEGNO", "C8.5.3", ["C8", "C8.5", "C8.5.3"], 3, (blocks) => {
  addText(blocks, r(264, 48, 49), "L’esame degli elementi costruttivi prevede indagini volte alla conoscenza del materiale, in particolare nei riguardi della specie, dello stato di conservazione e delle caratteristiche meccaniche.");
  addText(blocks, r(264, 50, 51), "Riguardo alla caratterizzazione del materiale, per l’identificazione della specie legnosa si può fare riferimento alla norma UNI 11118 e, per la valutazione dello stato di conservazione e del profilo resistente degli elementi in opera, alla norma UNI 11119.");
  addText(blocks, r(264, 52, 53), "Date le incertezze delle conoscenze, qualora si ricorra a metodi indiretti di prova, è opportuno confrontare le misure ottenute con metodi diversi, tenendo presente che la variabilità dei singoli parametri è in genere ampia.");
  addText(blocks, cross(r(264, 54, 55)[0]!, r(265, 3, 4)[0]!), "Occorre identificare l’eventuale degrado materico di tipo biotico, anche in relazione alle condizioni ambientali di conservazione. Particolare attenzione deve quindi essere rivolta all’analisi del microclima nell’intorno di un elemento ligneo o di una sua parte che si è instaurato in particolari condizioni di posa in opera (ad esempio testate di travi e capriate inserite nella muratura o elementi nascosti da controsoffitti, elementi lignei che appoggiano in fondazione).");
  addText(blocks, r(265, 5), "Si possono distinguere, in relazione al loro grado di approfondimento, tre livelli di prova.");
  addText(blocks, r(265, 6, 9), "Prove limitate: si tratta di indagini basate principalmente su esami visivi delle superfici, che comprendano almeno tre facce e una testata di ogni elemento dell’orditura primaria e secondaria e che prevedano limitati controlli degli elementi costruttivi e delle connessioni; sono previste rimozioni locali dello strato di protezione per procedere a una valutazione dello stato di conservazione, ad esempio in accordo alla norma UNI 11119.");
  addText(blocks, r(265, 10, 13), "Prove estese: si tratta di indagini visive diffuse sulle superfici degli elementi, accompagnate da alcuni controlli strumentali a supporto, nonché sulle condizioni dei collegamenti. Sono previste rimozioni locali dello strato di protezione per procedere a una valutazione dello stato di conservazione, ad esempio in accordo alla norma UNI 11119. Come controlli strumentali, sono almeno da prevedere alcuni controlli dell’umidità del materiale in zone specificatamente individuate come particolarmente sensibili.");
  addText(blocks, r(265, 14, 19), "Prove esaustive: si tratta di indagini visive diffuse e sistematiche, accompagnate da approfondimenti strumentali, eventualmente di tipo resistografico. Si prevedono analisi per l’identificazione della specie, la misura dell’umidità nel materiale e nelle zone di interfaccia con materiali diversi e l’analisi dei collegamenti, con valutazione dei fenomeni di degrado degli elementi di connessione. Tali analisi possono anche richiedere attività di laboratorio. È opportuno l’impiego di tecniche non distruttive o parzialmente invasive per valutare le caratteristiche meccaniche del materiale o individuare zone degradate al di sotto della superficie.");
});

const assetManifest = {
  $schema: "urn:structural-codes:schema:asset-manifest:v2",
  schemaVersion: "2.0.0-alpha.1",
  recordType: "asset-manifest",
  document: "circ2019",
  section: "C8.5-step1",
  sourceId: SOURCE_ID,
  status: "transcribed-unreviewed",
  formulas: [],
  tables: [tableI, tableII],
  figures: [],
};

writeFileSync(join(ASSETS, "C8.5-step1.json"), `${JSON.stringify(assetManifest, null, 2)}\n`, "utf8");
