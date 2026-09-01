import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const EVIDENCE = join(ROOT, "evidence", "circ-7-2019", "pages");
const UNITS = join(ROOT, "corpus", "units", "circ2019");
const ASSETS = join(ROOT, "corpus", "assets", "circ2019");
const SOURCE_ID = "circ-7-2019";
const WORK_ID = "it-mit:circ:2019-01-21:7-csllpp";
const EXPRESSION_ID = WORK_ID + ":original-it";
const TODAY = "2026-08-09";
const CREATED_AT = "2026-08-09T12:00:00Z";
const VERSION = "circ8-editorial-profile-0.2.0";
const scopedPages265To266 = process.argv.includes("--pages-265-266");
const scopedPages267To269 = process.argv.includes("--pages-267-269");
const scopedUnits265To266 = new Set(["C8.5.4", "C8.5.4.1"]);
const scopedUnits267To269 = new Set(["C8.5.4.2", "C8.5.4.3", "C8.5.5", "C8.5.5.1", "C8.5.5.2"]);

type Range = { page: number; start: number; end: number };
type Inline = { kind: "text" | "math"; value: string; latex?: string };
type Block = Record<string, unknown>;

const pageLines = new Map<number, string[]>();
function lines(page: number): string[] {
  let value = pageLines.get(page);
  if (!value) {
    const path = join(EVIDENCE, "page-" + String(page).padStart(4, "0") + ".raw.txt");
    value = readFileSync(path, "utf8").replace(/\r\n/g, "\n").split("\n");
    pageLines.set(page, value);
  }
  return value;
}

function raw(ranges: Range[]): string {
  return ranges.map(({ page, start, end }) => {
    const pageText = lines(page).slice(start - 1, end);
    if (pageText.length !== end - start + 1) {
      throw new Error("Evidence range fuori pagina " + page + ":" + start + "-" + end);
    }
    return pageText.join("\n");
  }).join("\n");
}

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

const mathMap: Record<string, string> = {
  "FC=1,35": "\\mathrm{FC}=1{,}35",
  "FC=1,2": "\\mathrm{FC}=1{,}2",
  "FC=1": "\\mathrm{FC}=1",
  "f = 1,25 f_k": "f=1{,}25f_k",
  "μ’’": "\\mu''",
  "μ’": "\\mu'",
  "σ’²": "\\sigma'^2",
  "σ’": "\\sigma'",
  "X̄": "\\bar{X}",
  "α_u/α_1": "\\alpha_u/\\alpha_1",
  "α_u": "\\alpha_u",
  "α_1": "\\alpha_1",
  "fᵥ₀": "f_{v0}",
  "τ₀": "\\tau_0",
  "f_k": "f_k",
  "f_b": "f_b",
  "f_m": "f_m",
  "f_g": "f_g",
  "N/mm²": "\\mathrm{N/mm^2}",
  "m²": "\\mathrm{m^2}",
  ">15%": ">15\\%",
  "95%": "95\\%",
  "FC": "\\mathrm{FC}",
  "κ": "\\kappa",
  "q = 2,0 α_u/α_1": "q=2{,}0\\,\\alpha_u/\\alpha_1",
  "q = 1,75 α_u/α_1": "q=1{,}75\\,\\alpha_u/\\alpha_1",
  "q": "q",
  "E": "E",
  "G": "G",
  "f": "f",
  "n": "n",
  "X": "X",
};

const inlinePattern = /q = 2,0 α_u\/α_1|q = 1,75 α_u\/α_1|FC=1,35|FC=1,2|FC=1|f = 1,25 f_k|μ’’|σ’²|α_u\/α_1|μ’|σ’|X̄|α_u|α_1|fᵥ₀|τ₀|f_k|f_b|f_m|f_g|N\/mm²|m²|>15%|95%|FC|κ|(?<![\p{L}\p{N}_])q(?![\p{L}\p{N}_])|(?<![\p{L}\p{N}_])E(?![\p{L}\p{N}_])|(?<![\p{L}\p{N}_])G(?![\p{L}\p{N}_])|(?<![\p{L}\p{N}_])f(?![\p{L}\p{N}_])|(?<![\p{L}\p{N}_])n(?![\p{L}\p{N}_])|(?<![\p{L}\p{N}_])X(?![\p{L}\p{N}_])/gu;

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
      note: "Rimossi i caratteri di controllo introdotti dall’estrazione del PDF.",
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

let currentUnitId = "";

function unitId(official: string): string {
  return "urn:structural-codes:it:unit:circ2019:" + official.toLowerCase();
}

function sortKey(official: string): string {
  return official.slice(1).split(".").map((part) => part.padStart(3, "0")).join(".");
}

function assetId(kind: "formula" | "table", official: string): string {
  return "urn:structural-codes:it:asset:" + kind + ":circ2019:" + official.toLowerCase();
}

function relation(official: string, headingBlockId: string) {
  const parts = official.slice(1).toLowerCase().split(".");
  while (parts.length > 0 && !existsSync(join(ROOT, "corpus", "units", "ntc2018", parts.join(".") + ".json"))) {
    parts.pop();
  }
  return [{
    relationId: currentUnitId + "#relation-001",
    type: "clarifies",
    targetUnitId: "urn:structural-codes:it:unit:ntc2018:" + parts.join("."),
    basis: "editorial",
    evidenceBlockIds: [headingBlockId],
    rationale: "Corrispondenza proposta tra numerazione omologa della Circolare e delle NTC; richiede conferma umana sul contenuto completo.",
    review: { status: "proposed", reviewedBy: null, reviewedAt: null },
  }];
}

function addText(blocks: Block[], ranges: Range[], normalized: string, kind: "heading" | "paragraph" | "list-item" | "footnote" = "paragraph") {
  const blockId = currentUnitId + "#block-" + (blocks.length === 0 ? "heading" : String(blocks.length).padStart(3, "0"));
  const text: Record<string, unknown> = {
    raw: raw(ranges),
    normalized,
    normalizationVersion: VERSION,
  };
  const segments = kind === "heading" ? undefined : inline(normalized);
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

function addAssetRef(blocks: Block[], ranges: Range[], kind: "formula-ref" | "table-ref", id: string, label: string) {
  const blockId = currentUnitId + "#block-" + String(blocks.length).padStart(3, "0");
  blocks.push({
    blockId,
    kind,
    origin: "official",
    assetId: id,
    evidence: assetEvidence(ranges, label),
  });
  return blockId;
}

function makeUnit(official: string, title: string, parentOfficial: string, ancestors: string[], position: number, build: (blocks: Block[]) => void, formulaIds: string[] = [], tableIds: string[] = []) {
  if (scopedPages265To266 && !scopedUnits265To266.has(official)) return;
  if (scopedPages267To269 && !scopedUnits267To269.has(official)) return;
  currentUnitId = unitId(official);
  const blocks: Block[] = [];
  const headingBlockId = addText(blocks, headingRanges[official]!, official + " " + title, "heading");
  build(blocks);
  const assetIssues = formulaIds.length + tableIds.length > 0 ? [{
    issueId: "circ2019-" + official.toLowerCase() + "-asset-review",
    type: "asset-review",
    severity: "blocking",
    note: "Formule e tabelle devono essere sottoposte a verifica umana nel loro punto del flusso editoriale; le tabelle vanno controllate cella per cella.",
  }] : [];
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
    assets: { formulaIds, tableIds, figureIds: [] },
    workflow: {
      status: "extracted",
      createdBy: { actorId: "generator:circ85:step2", kind: "script", toolVersion: VERSION },
      createdAt: CREATED_AT,
      reviews: [],
      openIssues: [
        {
          issueId: "circ2019-" + official.toLowerCase() + "-source-review",
          type: "normalization-review",
          severity: "blocking",
          note: "Trascrizione confrontata con il render ufficiale; resta obbligatoria la revisione umana indipendente.",
        },
        {
          issueId: "circ2019-" + official.toLowerCase() + "-relation",
          type: "relation-review",
          severity: "blocking",
          note: "Il collegamento Circolare-NTC per numerazione omologa richiede conferma umana.",
        },
        ...assetIssues,
      ],
    },
  };
  writeFileSync(join(UNITS, official.toLowerCase() + ".json"), JSON.stringify(record, null, 2) + "\n", "utf8");
}

function cell(text: string, latex?: string, extra: Record<string, number> = {}) {
  return { text, ...(latex ? { latex } : {}), ...extra };
}

const r = (page: number, start: number, end = start): Range[] => [{ page, start, end }];
const cross = (...ranges: Range[]): Range[] => ranges;

const headingRanges: Record<string, Range[]> = {
  "C8.5.4": r(265, 20),
  "C8.5.4.1": r(266, 3),
  "C8.5.4.2": r(267, 3),
  "C8.5.4.3": r(268, 65),
  "C8.5.5": r(269, 3),
  "C8.5.5.1": r(269, 12),
  "C8.5.5.2": r(269, 24),
};

const F41 = assetId("formula", "C8.5.4.1");
const F42 = assetId("formula", "C8.5.4.2");
const F43 = assetId("formula", "C8.5.4.3");
const T3 = assetId("table", "C8.5.III");
const T4 = assetId("table", "C8.5.IV");
const T5 = assetId("table", "C8.5.V");
const T6 = assetId("table", "C8.5.VI");

const formulas = [
  { id: F41, unitId: unitId("C8.5.4.1"), officialNumber: "C8.5.4.1", pdfPage: 266, latex: "\\mu'=\\frac{1}{2}\\left(X_{\\min}+X_{\\max}\\right)" },
  { id: F42, unitId: unitId("C8.5.4.1"), officialNumber: "C8.5.4.2", pdfPage: 266, latex: "\\sigma'=\\frac{1}{2}\\left(X_{\\max}-X_{\\min}\\right)" },
  { id: F43, unitId: unitId("C8.5.4.1"), officialNumber: "C8.5.4.3", pdfPage: 266, latex: "\\mu''=\\frac{n\\bar{X}+\\kappa\\mu'}{n+\\kappa}" },
];

const table3 = {
  id: T3,
  unitId: unitId("C8.5.4.1"),
  officialNumber: "C8.5.III",
  pdfPage: 266,
  caption: "Tabella C.8.5.III –Valori del coefficiente κ suggeriti per l’aggiornamento del valore medio dei parametri meccanici, secondo l’equazione [C8.5.4.3], con riferimento ai più diffusi metodi di indagine diretta sulle proprietà meccaniche della muratura.",
  columnCount: 3,
  headers: [[cell("Metodo di prova"), cell("Parametro"), cell("κ", "\\kappa")]],
  rows: [
    [cell("Prova di compressione diretta (su una porzione di parete muraria)", undefined, { rowSpan: 2 }), cell("E", "E"), cell("1,5")],
    [cell("f", "f"), cell("1")],
    [cell("Martinetto piatto doppio", undefined, { rowSpan: 2 }), cell("E", "E"), cell("1,5")],
    [cell("f (*)", "f"), cell("2 (*)")],
    [cell("Prova di compressione e taglio (su un pannello isolato nella parete muraria) – prova tipo Sheppard", undefined, { rowSpan: 2 }), cell("G", "G"), cell("1,5")],
    [cell("τ₀ - fᵥ₀", "\\tau_0-f_{v0}"), cell("1")],
    [cell("Prova di compressione diagonale", undefined, { rowSpan: 2 }), cell("G", "G"), cell("1,5")],
    [cell("τ₀", "\\tau_0"), cell("1")],
    [cell("Prova di taglio diretto sul giunto"), cell("fᵥ₀", "f_{v0}"), cell("2")],
    [cell("Prove in laboratorio sui costituenti (**)"), cell("f_b, f_m, f_g", "f_b, f_m, f_g"), cell("2")],
  ],
  notes: [],
};

const table4 = {
  id: T4,
  unitId: unitId("C8.5.4.2"),
  officialNumber: "C8.5.IV",
  pdfPage: 267,
  caption: "Tabella C8.5.IV – Livelli di conoscenza in funzione dell’informazione disponibile e conseguenti metodi di analisi ammessi e valori dei fattori di confidenza, per edifici in calcestruzzo armato o in acciaio.",
  columnCount: 6,
  headers: [[
    cell("Livello di conoscenza"),
    cell("Geometrie (carpenterie)"),
    cell("Dettagli strutturali"),
    cell("Proprietà dei materiali"),
    cell("Metodi di analisi"),
    cell("FC (*)", "\\mathrm{FC}\\,\\text{(*)}"),
  ]],
  rows: [
    [
      cell("LC1"),
      cell("Da disegni di carpenteria originali con rilievo visivo a campione; in alternativa rilievo completo ex-novo", undefined, { rowSpan: 3 }),
      cell("Progetto simulato in accordo alle norme dell’epoca e indagini limitate in situ"),
      cell("Valori usuali per la pratica costruttiva dell’epoca e prove limitate in situ"),
      cell("Analisi lineare statica o dinamica"),
      cell("1,35", "1{,}35"),
    ],
    [
      cell("LC2"),
      cell("Elaborati progettuali incompleti con indagini limitate in situ; in alternativa indagini estese in situ"),
      cell("Dalle specifiche originali di progetto o dai certificati di prova originali, con prove limitate in situ; in alternativa da prove estese in situ"),
      cell("Tutti"),
      cell("1,20", "1{,}20"),
    ],
    [
      cell("LC3"),
      cell("Elaborati progettuali completi con indagini limitate in situ; in alternativa indagini esaustive in situ"),
      cell("Dai certificati di prova originali o dalle specifiche originali di progetto, con prove estese in situ; in alternativa da prove esaustive in situ"),
      cell("Tutti"),
      cell("1,00", "1{,}00"),
    ],
  ],
  notes: [],
};

const table5 = {
  id: T5,
  unitId: unitId("C8.5.4.2"),
  officialNumber: "C8.5.V",
  pdfPage: 268,
  caption: "Tabella C8.5.V – Definizione orientativa dei livelli di rilievo e prova per edifici di c.a.",
  columnCount: 3,
  headers: [
    [cell("Livello di Indagini e Prove", undefined, { rowSpan: 2 }), cell("Rilievo (dei dettagli costruttivi)(a)"), cell("Prove (sui materiali)(b)(c)(d)")],
    [cell("Per ogni elemento “primario” (trave, pilastro)", undefined, { colSpan: 2 })],
  ],
  rows: [
    [cell("limitato"), cell("La quantità e disposizione dell’armatura è verificata per almeno il 15% degli elementi"), cell("1 provino di cls. per 300 m² di piano dell’edificio, 1 campione di armatura per piano dell’edificio")],
    [cell("esteso"), cell("La quantità e disposizione dell’armatura è verificata per almeno il 35% degli elementi"), cell("2 provini di cls. per 300 m² di piano dell’edificio, 2 campioni di armatura per piano dell’edificio")],
    [cell("esaustivo"), cell("La quantità e disposizione dell’armatura è verificata per almeno il 50% degli elementi"), cell("3 provini di cls. per 300 m² di piano dell’edificio, 3 campioni di armatura per piano dell’edificio")],
  ],
  notes: [],
};

const table6 = {
  id: T6,
  unitId: unitId("C8.5.4.2"),
  officialNumber: "C8.5.VI",
  pdfPage: 268,
  caption: "Tabella C8.5.VI – Definizione orientativa dei livelli di rilievo e prova per edifici di acciaio.",
  columnCount: 3,
  headers: [
    [cell("Livello di Indagini e Prove", undefined, { rowSpan: 2 }), cell("Rilievo (dei collegamenti)(a)"), cell("Prove (sui materiali) (b)(c)(d)")],
    [cell("Per ogni elemento “primario” (trave, pilastro…)", undefined, { colSpan: 2 })],
  ],
  rows: [
    [cell("limitato"), cell("Le caratteristiche dei collegamenti sono verificate per almeno il 15% degli elementi"), cell("1 provino di acciaio per piano dell’edificio, 1 campione di bullone o chiodo per piano dell’edificio")],
    [cell("esteso"), cell("Le caratteristiche dei collegamenti sono verificate per almeno il 35% degli elementi"), cell("2 provini di acciaio per piano dell’edificio, 2 campioni di bullone o chiodo per piano dell’edificio")],
    [cell("esaustivo"), cell("Le caratteristiche dei collegamenti sono verificate per almeno il 50% degli elementi"), cell("3 provini di acciaio per piano dell’edificio, 3 campioni di bullone o chiodo per piano dell’edificio")],
  ],
  notes: [],
};

mkdirSync(UNITS, { recursive: true });
mkdirSync(ASSETS, { recursive: true });

makeUnit("C8.5.4", "LIVELLI DI CONOSCENZA E FATTORI DI CONFIDENZA", "C8.5", ["C8", "C8.5"], 4, (blocks) => {
  addText(blocks, r(265, 21, 22), "I fattori di confidenza sono utilizzati per la riduzione dei valori dei parametri meccanici dei materiali e devono essere intesi come indicatori del livello di approfondimento raggiunto.");
  addText(blocks, r(265, 23, 25), "Limitatamente al caso di verifiche in condizioni non sismiche di singoli componenti (ad esempio solai sui quali siano state condotte indagini particolarmente accurate) oppure di verifiche sismiche nei riguardi dei meccanismi locali, è possibile adottare livelli di conoscenza differenziati rispetto a quelli impiegati nelle verifiche sismiche globali.");
  addText(blocks, r(265, 26, 27), "Di seguito, con riferimento alle specifiche contenute al § 8.5 delle NTC, è riportata una guida alla stima dei Fattori di Confidenza (FC), definiti con riferimento ai tre Livelli di Conoscenza (LC) crescenti, secondo quanto segue.");
  addText(blocks, r(265, 28, 33), "LC1: si intende raggiunto quando siano stati effettuati, come minimo, l’analisi storico-critica commisurata al livello considerato, con riferimento al § C8.5.1, il rilievo geometrico completo e indagini limitate sui dettagli costruttivi, con riferimento al § C8.5.2, prove limitate sulle caratteristiche meccaniche dei materiali, con riferimento al § C8.5.3; il corrispondente fattore di confidenza è FC=1,35 (nel caso di costruzioni di acciaio, se il livello di conoscenza non è LC2 solo a causa di una non estesa conoscenza sulle proprietà dei materiali, il fattore di confidenza può essere ridotto, giustificandolo con opportune considerazioni anche sulla base dell’epoca di costruzione);");
  addText(blocks, r(265, 34, 39), "LC2: si intende raggiunto quando siano stati effettuati, come minimo, l’analisi storico-critica commisurata al livello considerato, con riferimento al § C8.5.1, il rilievo geometrico completo e indagini estese sui dettagli costruttivi, con riferimento al § C8.5.2, prove estese sulle caratteristiche meccaniche dei materiali, con riferimento al § C8.5.3; il corrispondente fattore di confidenza è FC=1,2 (nel caso di costruzioni di acciaio, se il livello di conoscenza non è LC3 solo a causa di una non esaustiva conoscenza sulle proprietà dei materiali, il fattore di confidenza può essere ridotto, giustificandolo con opportune considerazioni anche sulla base dell’epoca di costruzione);");
  addText(blocks, r(265, 40, 45), "LC3: si intende raggiunto quando siano stati effettuati l’analisi storico-critica commisurata al livello considerato, come descritta al § C8.5.1, il rilievo geometrico, completo ed accurato in ogni sua parte, e indagini esaustive sui dettagli costruttivi, come descritto al § C8.5.2, prove esaustive sulle caratteristiche meccaniche dei materiali, come indicato al § C8.5.3; il corrispondente fattore di confidenza è FC=1 (da applicarsi limitatamente ai valori di quei parametri per i quali sono state eseguite le prove e le indagini su citate, mentre per gli altri parametri meccanici il valore di FC è definito coerentemente con le corrispondenti prove limitate o estese eseguite).");
  addText(blocks, r(265, 46, 48), "Per raggiungere il livello di conoscenza LC3, la disponibilità di un rilievo geometrico completo e l’acquisizione di una conoscenza esaustiva dei dettagli costruttivi sono da considerarsi equivalenti alla disponibilità di documenti progettuali originali, comunque da verificare opportunamente nella loro completezza e rispondenza alla situazione reale.");
  addText(blocks, r(265, 49, 52), "Ci si può riferire alla documentazione in atti, qualora per essa siano stati adempiuti gli obblighi della L. 1086/71 o 64/74 e s.m.i., ma solo dopo adeguata giustificazione eventualmente integrata da indagini in opera. Per la caratterizzazione meccanica dei materiali si possono adottare, motivatamente, i valori caratteristici assunti nel progetto originario o quelli ridotti risultanti dalla documentazione disponibile sui materiali in opera. In questo caso i fattori di confidenza si assumono unitari.");
  addText(blocks, r(265, 53, 54), "La quantità e il tipo di informazioni richieste per conseguire uno dei tre livelli di conoscenza previsti, sono, a titolo esclusivamente orientativo, ulteriormente precisati nel seguito.");
}, [], []);

makeUnit("C8.5.4.1", "COSTRUZIONI DI MURATURA", "C8.5.4", ["C8", "C8.5", "C8.5.4"], 1, (blocks) => {
  addText(blocks, r(266, 4, 6), "Nel caso in cui la muratura in esame possa essere ricondotta alle tipologie murarie presenti nelle Tabelle C8.5.I e C8.5.II, i valori medi dei parametri meccanici da utilizzare per le verifiche possono essere definiti, con riferimento alla tipologia muraria in considerazione per i diversi livelli di conoscenza, come segue:");
  addText(blocks, r(266, 7), "LC1: -Resistenze: i valori minimi degli intervalli riportati in Tabella C8.5.I.");
  addText(blocks, r(266, 8), "- Moduli elastici: i valori medi degli intervalli riportati nella tabella suddetta.");
  addText(blocks, r(266, 9), "LC2: - Resistenze: i valori medi degli intervalli riportati in Tabella C8.5.I");
  addText(blocks, r(266, 10), "-Moduli elastici: i valori medi degli intervalli riportati nella tabella suddetta.");
  addText(blocks, r(266, 11, 15), "LC3: -I valori delle resistenze e dei moduli elastici riportati in Tabella C.8.5.I individuano una distribuzione a-priori che può essere aggiornata sulla base dei risultati delle misure eseguite in sito. Considerato il generico parametro X, una stima dei parametri μ’ e σ’ della distribuzione a-priori può essere dedotta dai valori minimo e massimo in tabella, con le formule seguenti:");
  addAssetRef(blocks, r(266, 16), "formula-ref", F41, "[C8.5.4.1]");
  addAssetRef(blocks, r(266, 17), "formula-ref", F42, "[C8.5.4.2]");
  addText(blocks, r(266, 18), "Eseguito un numero n di prove dirette, l’aggiornamento del valore medio può essere effettuato come segue:");
  addAssetRef(blocks, r(266, 19, 20), "formula-ref", F43, "[C8.5.4.3]");
  addText(blocks, r(266, 21, 23), "dove X̄ è la media delle n prove dirette e κ è un coefficiente che tiene conto del rapporto tra la dispersione (varianza) della stima effettuata attraverso le prove (combinazione tra incertezza della misurazione sperimentale e dispersione dei parametri meccanici nell’ambito dell’edificio che si sta analizzando) e la varianza σ’² della distribuzione a-priori.");
  addText(blocks, r(266, 24, 25), "Nel determinare la stima aggiornata del valore medio del parametro meccanico, il coefficiente κ rappresenta il peso relativo della distribuzione a-priori (associata ai parametri della tabella C.8.5.I) rispetto alle prove sperimentali³.");
  addText(blocks, r(266, 26, 28), "Qualora la media delle n prove dirette X̄ sia significativamente diversa dal valore μ’ adottato per la distribuzione a-priori, e quindi la differenza tra μ’ e μ’’ risulti rilevante, l’accettabilità del risultato ottenuto applicando l’equazione C8.5.4.3 deve essere adeguatamente motivata.");
  addAssetRef(blocks, r(266, 29, 30), "table-ref", T3, table3.caption);
  addText(blocks, r(266, 49, 54), "(*) La prova con il martinetto piatto doppio consente di ottenere una misura del modulo elastico E della muratura, molto più raramente di misurarne direttamente la resistenza a compressione. Il coefficiente in tabella è quello suggerito quando nella prova viene misurata direttamente la resistenza a compressione. Ricordando che esiste una correlazione empirica approssimata di proporzionalità tra modulo E e la resistenza media a compressione della muratura (desumibile dagli intervalli di variazione dei due parametri nella tabella C8.5.I) il modulo E ottenuto dalla prova con martinetto piatto può fornire una stima indiretta di f utilizzabile nell’equazione [C8.5.4.3] purché si adotti un valore di κ almeno pari a 3.", "footnote");
  addText(blocks, r(266, 55, 57), "(**) Nel caso di muratura in blocchi di pietra squadrati o artificiali pieni o semipieni si ipotizza che, con prove a compressione diretta sugli elementi e sulla malta (i costituenti), si possa stimare la resistenza caratteristica a compressione della muratura f_k tramite i metodi descritti al § 11.10.3.1.2 delle Norme. Nota: f_k, la resistenza a compressione media f della muratura potrà essere quindi stimata come f = 1,25 f_k.", "footnote");
  addText(blocks, r(266, 31, 37), "³Dalla formula emerge che, al crescere del numero di prove, il peso attribuito alla misura sperimentale aumenta, in quanto anche in presenza di una significativa dispersione del parametro nell’edificio la stima del suo valore medio risulta più attendibile. Nella scelta del coefficiente κ è opportuno considerare che l’incertezza legata al metodo di misura sperimentale non si riduce aumentando il numero di prove. Inoltre, l’attendibilità dei diversi metodi di prova cambia in relazione alle diverse tipologie murarie. In assenza di valutazioni specifiche da parte del progettista, la Tabella C.8.5.III suggerisce valori del coefficiente κ per i più diffusi metodi di indagine diretta in sito. Particolare cautela dovrà essere utilizzata nel caso di prove in laboratorio su campioni di muratura estratti in situ, a causa delle difficoltà nell’estrarre, movimentare e trasportare i provini senza arrecare loro danni.", "footnote");
}, [F41, F42, F43], [T3]);

makeUnit("C8.5.4.2", "COSTRUZIONI DI CALCESTRUZZO ARMATO O DI ACCIAIO", "C8.5.4", ["C8", "C8.5", "C8.5.4"], 2, (blocks) => {
  addText(blocks, r(267, 4, 9), "I fattori di confidenza, determinati in funzione del livello di conoscenza acquisito, vengono applicati ai valori medi delle resistenze dei materiali ottenuti dai campioni di prove distruttive e non distruttive, per fornire una stima dei valori medi delle resistenze dei materiali della struttura, entro l’intervallo di confidenza considerato (in genere si assume un intervallo di confidenza pari al 95%). Per determinare i fattori di confidenza per i diversi elementi strutturali o loro insiemi si deve tener conto che essi includono, oltre alle incertezze nella stima della resistenza dei materiali, anche le incertezze relative all’individuazione dei dettagli costruttivi.");
  addText(blocks, r(267, 10, 13), "Il livello di conoscenza acquisito in base ai rilievi, alle indagini sui dettagli strutturali e alle prove sui materiali, determina i valori dei fattori di confidenza da applicare alle proprietà dei materiali, anche in maniera differenziata per elementi strutturali o gruppi di elementi, e suggerisce il metodo di analisi più appropriato. In assenza di valutazioni specifiche, ci si può riferire alla Tabella C8.5.IV.");
  addAssetRef(blocks, r(267, 14, 15), "table-ref", T4, table4.caption);
  addText(blocks, r(267, 56), "(*) A meno delle ulteriori precisazioni già fornite nel § C8.5.4.", "footnote");
  addText(blocks, r(267, 57, 58), "La quantità e il tipo di informazioni richieste per conseguire uno dei tre livelli di conoscenza previsti, sono, a titolo esclusivamente orientativo, ulteriormente precisati nel seguito.");
  addText(blocks, r(267, 59, 68), "LC1: si intende raggiunto quando sia stata effettuata l’analisi storico-critica commisurata al livello considerato (con riferimento al § C8.5.1), la geometria della struttura sia nota in base ai disegni originali (effettuando un rilievo visivo a campione per verificare l’effettiva corrispondenza del costruito ai disegni) o a un rilievo, poiché non si dispone dei disegni costruttivi i dettagli costruttivi siano stati ricavati sulla base di un progetto simulato (con riferimento al § C8.5.2) e con indagini limitate in-situ sulle armature e sui collegamenti presenti negli elementi più importanti (i dati raccolti devono essere tali da consentire verifiche locali di resistenza), poiché non si dispone di informazioni sulle caratteristiche meccaniche dei materiali (provenienti dai disegni costruttivi o dai certificati di prova) si siano adottati i valori usuali della pratica costruttiva dell’epoca, convalidati da prove limitate in-situ sugli elementi più importanti (con riferimento al § C8.5.3); il corrispondente fattore di confidenza è FC=1,35. La valutazione della sicurezza è, in genere, eseguita mediante analisi lineare, statica o dinamica; le informazioni raccolte devono consentire la messa a punto di un modello strutturale idoneo.");
  addText(blocks, r(267, 69, 80), "LC2: si intende raggiunto quando sia stata effettuata l’analisi storico-critica commisurata al livello considerato (con riferimento al § C8.5.1), la geometria della struttura sia nota in base ai disegni originali (effettuando un rilievo visivo a campione per verificare l’effettiva corrispondenza del costruito ai disegni) o a un rilievo, i dettagli costruttivi siano noti, o parzialmente dai disegni costruttivi originali integrati da indagini limitate in situ sulle armature e sui collegamenti presenti negli elementi più importanti, o (con riferimento al § C8.5.2) a seguito di una indagine estesa in situ (i dati raccolti devono essere tali da consentire, nel caso si esegua un’analisi lineare, verifiche locali di resistenza, oppure la messa a punto di un modello strutturale non lineare), le caratteristiche meccaniche dei materiali siano note in base ai disegni costruttivi, integrati da prove limitate in situ (se i valori ottenuti dalle prove in situ sono minori dei corrispondenti valori indicati nei disegni di progetto, si eseguono prove estese in situ), o con prove estese in situ (con riferimento al § C8.5.3); il corrispondente fattore di confidenza è FC=1,2. La valutazione della sicurezza è eseguita mediante metodi di analisi lineare o non lineare, statici o dinamici; le informazioni raccolte sulle dimensioni degli elementi strutturali, insieme a quelle riguardanti i dettagli strutturali, devono consentire la messa a punto di un modello strutturale idoneo.");
  addText(blocks, cross(r(267, 81, 86)[0]!, r(268, 3, 8)[0]!), "LC3: si intende raggiunto quando sia stata effettuata l’analisi storico-critica commisurata al livello considerato (con riferimento al § C8.5.1), la geometria della struttura sia nota in base ai disegni originali (effettuando un rilievo visivo a campione per verificare l’effettiva corrispondenza del costruito ai disegni) o a un rilievo, i dettagli costruttivi siano noti, o dai disegni costruttivi originali integrati da indagini limitate in situ sulle armature e sui collegamenti presenti negli elementi più importanti, o (con riferimento al § C8.5.2) a seguito di una indagine esaustiva in situ (i dati raccolti devono essere tali da consentire, nel caso si esegua un’analisi lineare, verifiche locali di resistenza, oppure la messa a punto di un modello strutturale non lineare), le caratteristiche meccaniche dei materiali siano note in base ai disegni costruttivi e ai certificati originali di prova, integrati da prove limitate in situ (se i valori ottenuti dalle prove in situ sono minori dei corrispondenti valori indicati nei certificati originali di prova, si eseguono prove esaustive in situ), o con prove esaustive in situ (con riferimento al § C8.5.3); il corrispondente fattore di confidenza è FC=1. La valutazione della sicurezza è eseguita mediante metodi di analisi lineare o non lineare, statici o dinamici; le informazioni raccolte sulle dimensioni degli elementi strutturali, insieme a quelle riguardanti i dettagli strutturali, devono consentire la messa a punto di un modello strutturale idoneo.");
  addText(blocks, r(268, 9, 10), "Le resistenze dei materiali cui riferirsi nelle formule di capacità degli elementi sono ricavate dalle resistenze medie, ottenute dalle informazioni disponibili e dalle prove in situ aggiuntive, dividendole per gli FC indicati nella Tabella C8.5.IV.");
  addText(blocks, r(268, 11, 12), "Gli FC possono essere valutati anche in modo differenziato per i diversi materiali, sulla base di considerazioni statistiche condotte su un insieme di dati significativo per gli elementi in esame e di metodi di comprovata validità.");
  addText(blocks, r(268, 13, 19), "A titolo esclusivamente orientativo, nelle tabelle C8.5.V e C8.5.VI si lega il livello (limitato, esteso, esaustivo) delle indagini alla quantità di rilievi dei dettagli costruttivi e di prove per la valutazione delle caratteristiche meccaniche dei materiali. Rimane inteso che il piano delle indagini deve essere opportunamente calibrato in funzione dell’analisi preliminare (v. § C8.5.2.2 e C8.5.3.2) e quindi, in relazione al livello di conoscenza da raggiungere, orientato agli approfondimenti necessari nelle zone della costruzione ove risulti opportuno, sia in relazione all’impegno statico delle diverse membrature e al loro ruolo riguardo alla sicurezza della struttura, sia in relazione al grado di omogeneità dei risultati delle prove preliminari e al loro accordo con quanto previsto dai documenti originari.");
  addAssetRef(blocks, r(268, 20), "table-ref", T5, table5.caption);
  addAssetRef(blocks, r(268, 35), "table-ref", T6, table6.caption);
  addText(blocks, r(268, 50), "NOTE ESPLICATIVE ALLE TABELLE C8.5.V E C8.5.VI", "heading");
  addText(blocks, r(268, 51, 52), "Le percentuali di elementi da indagare ed il numero di provini da estrarre e sottoporre a prove di resistenza riportati nelle Tabelle C8.5.V e C8.5.VI hanno valore indicativo e vanno adattati ai singoli casi, tenendo conto dei seguenti aspetti:");
  addText(blocks, r(268, 53, 55), "(a) Nel controllo del raggiungimento delle percentuali di elementi indagati ai fini del rilievo dei dettagli costruttivi si tiene conto delle eventuali situazioni ripetitive, che consentano di estendere ad una più ampia percentuale i controlli effettuati su alcuni elementi strutturali facenti parte di una serie con evidenti caratteristiche di ripetibilità, per geometria e ruolo uguali nello schema strutturale.", "footnote");
  addText(blocks, r(268, 56, 58), "(b) Le prove sugli acciai sono finalizzate all’identificazione della classe dell’acciaio utilizzata con riferimento alla normativa vigente all’epoca di costruzione. Ai fini del raggiungimento del numero di prove sull’acciaio necessario per acquisire il livello di conoscenza desiderato è opportuno tener conto dei diametri (nelle strutture in c.a.) o dei profili (nelle strutture in acciaio) di più diffuso impiego negli elementi principali, con esclusione delle staffe.", "footnote");
  addText(blocks, r(268, 59, 60), "(c) Ai fini delle prove sui materiali è consentito sostituire alcune prove distruttive, non più del 50%, con almeno il triplo di prove non distruttive, singole o combinate, tarate su quelle distruttive.", "footnote");
  addText(blocks, r(268, 61, 64), "(d) Il numero di provini riportato nelle tabelle C8.5.V e C8.5.VI può esser variato, in aumento o in diminuzione, in relazione alle caratteristiche di omogeneità del materiale. Nel caso del calcestruzzo in opera, tali caratteristiche sono spesso legate alle modalità costruttive tipiche dell’epoca di costruzione e del tipo di manufatto, di cui occorrerà tener conto nel pianificare l’indagine. Sarà opportuno, in tal senso, prevedere l’effettuazione di una seconda campagna di prove integrative, nel caso in cui i risultati della prima risultino fortemente disomogenei.", "footnote");
}, [], [T4, T5, T6]);

makeUnit("C8.5.4.3", "COSTRUZIONI DI LEGNO", "C8.5.4", ["C8", "C8.5", "C8.5.4"], 3, (blocks) => {
  addText(blocks, r(268, 66, 69), "Per le costruzioni di legno, fermo restando quanto indicato nel § 8.5 delle NTC, stante la possibile variabilità del materiale soprattutto nel costruito storico, è opportuno estendere, ove possibile ed in relazione ai livelli di conoscenza che si intende raggiungere, l’indagine ai singoli elementi, soprattutto per valutare il degrado biotico e abiotico. E’ inoltre opportuno verificare le condizioni delle estremità delle membrature (o di struttura lignea), in particolare quando a contatto con altro materiale.");
}, [], []);

makeUnit("C8.5.5", "AZIONI", "C8.5", ["C8", "C8.5"], 5, (blocks) => {
  addText(blocks, r(269, 4, 7), "Le verifiche di sicurezza devono essere effettuate tenendo conto di tutte le azioni presenti, sia non sismiche, sia sismiche. Con riferimento a quanto espresso nel § 8.5 delle NTC si precisa che, nel caso di combinazioni di carico che includano l’azione sismica, ai fini della determinazione dell’entità massima delle azioni sopportabili dalla struttura si considerano i carichi permanenti effettivamente riscontrati e quelli variabili previsti dalle NTC.");
  addText(blocks, r(269, 8, 9), "L’azione sismica è definita, per i diversi stati limite, al § 3.2 delle NTC, tenuto conto del periodo di riferimento definito al § 2.4 delle NTC (v. anche § C8.3).");
  addText(blocks, r(269, 10, 11), "Per la combinazione dell’azione sismica con le altre azioni, valgono i criteri di cui al § 2.5.3 delle NTC. Le diverse componenti dell’azione sismica sono combinate con i criteri riportati al § 7.3.5 delle NTC.");
}, [], []);

makeUnit("C8.5.5.1", "COSTRUZIONI IN MURATURA", "C8.5.5", ["C8", "C8.5", "C8.5.5"], 1, (blocks) => {
  addText(blocks, r(269, 13), "Per la verifica di edifici con analisi lineare e impiego del fattore q, si possono utilizzare per quest’ultimo i seguenti valori:");
  addText(blocks, r(269, 14, 16), "q = 2,0 α_u/α_1 per edifici regolari in elevazione, nel caso di muratura in pietra e/o mattoni pieni;", "list-item");
  addText(blocks, r(269, 17, 19), "q = 1,75 α_u/α_1 per edifici regolari in elevazione, nel caso di muratura in blocchi artificiali con percentuale di foratura >15% (elementi semipieni, forati…).", "list-item");
  addText(blocks, r(269, 20, 21), "in cui α_u e α_1 sono definiti al § 7.8.1.3 delle NTC. In assenza di più precise valutazioni, non può essere assunto un rapporto α_u/α_1 superiore a 1,5.");
  addText(blocks, r(269, 22, 23), "Nel caso di edificio non regolare in elevazione i valori di q sono ridotti del 25%. La definizione di regolarità per un edificio esistente in muratura è quella indicata al § 7.2.1 delle NTC.");
}, [], []);

makeUnit("C8.5.5.2", "COSTRUZIONI DI CALCESTRUZZO ARMATO O ACCIAIO", "C8.5.5", ["C8", "C8.5", "C8.5.5"], 2, (blocks) => {
  addText(blocks, r(269, 25, 27), "Il fattore di comportamento q è scelto nel campo fra 1,5 e 3,0, sulla base della regolarità nonché dei tassi di lavoro dei materiali (quando soggetti alle azioni non sismiche). Valori di q superiori a quelli sopra indicati devono essere adeguatamente giustificati con riferimento alla duttilità disponibile a livello locale e globale.");
}, [], []);

const manifest = {
  $schema: "urn:structural-codes:schema:asset-manifest:v2",
  schemaVersion: "2.0.0-alpha.1",
  recordType: "asset-manifest",
  document: "circ2019",
  section: "C8.5-step2",
  sourceId: SOURCE_ID,
  status: "transcribed-unreviewed",
  formulas,
  tables: [table3, table4, table5, table6],
  figures: [],
};

writeFileSync(join(ASSETS, "C8.5-step2.json"), JSON.stringify(manifest, null, 2) + "\n", "utf8");
