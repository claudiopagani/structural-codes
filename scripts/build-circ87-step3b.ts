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
type Range = { page: number; start: number; end: number };
type Inline = { kind: "text" | "math"; value: string; latex?: string };
type Block = Record<string, unknown>;
type Cell = { text: string; latex?: string; colSpan?: number; rowSpan?: number };
const cache = new Map<number, string[]>();
function lines(page: number): string[] {
  let value = cache.get(page);
  if (!value) {
    value = readFileSync(join(EVIDENCE, `page-${String(page).padStart(4, "0")}.raw.txt`), "utf8").replace(/\r\n/g, "\n").split("\n");
    cache.set(page, value);
  }
  return value;
}
function raw(rs: Range[]): string { return rs.map(({ page, start, end }) => lines(page).slice(start - 1, end).join("\n")).join("\n"); }
function sha256(value: string): string { return createHash("sha256").update(value, "utf8").digest("hex"); }
function clean(rs: Range[]): string {
  return raw(rs).replace(/\u0003/gu, "-").replace(/[ \t]*\n[ \t]*/gu, " ").replace(/[\u0000-\u001f\u007f]/gu, "").replace(/\s+/gu, " ").trim();
}
function printedPage(page: number): string { return String(page - 4); }
const mathMap: Record<string, string> = { "q=1": "q=1", "q>1": "q>1", "h_c / x_min": "\\frac{h_c}{x_{\\min}}" };
const inlinePattern = new RegExp(Object.keys(mathMap).sort((a, b) => b.length - a.length).map((value) => value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")).join("|"), "gu");
function inline(text: string): Inline[] | undefined {
  const out: Inline[] = [];
  let last = 0;
  for (const match of text.matchAll(inlinePattern)) {
    const index = match.index ?? 0;
    const value = match[0];
    if (index > last) out.push({ kind: "text", value: text.slice(last, index) });
    out.push({ kind: "math", value, latex: mathMap[value] ?? value });
    last = index + value.length;
  }
  if (last < text.length) out.push({ kind: "text", value: text.slice(last) });
  return out.some((segment) => segment.kind === "math") ? out : undefined;
}
function transformations(rawText: string, normalized: string) {
  return [
    ...(rawText.includes("\n") ? [{ operation: "join-line-wrap", ruleVersion: VERSION, note: "Rimossi gli a capo introdotti dall'impaginazione, conservando il capoverso." }] : []),
    ...(/[\u0000-\u001f\u007f]/u.test(rawText) ? [{ operation: "remove-control-character", ruleVersion: VERSION, note: "Rimossi i caratteri di controllo introdotti dall'estrazione del PDF." }] : []),
    ...(rawText !== normalized ? [{ operation: "manual-correction", ruleVersion: VERSION, note: "Ripristinati accenti, apostrofi, numerazione, glifi matematici e punteggiatura verificati sul render ufficiale." }] : []),
    { operation: "unicode-nfc", ruleVersion: VERSION, note: "Testo normalizzato in Unicode NFC." },
  ];
}
function evidence(rs: Range[], normalized: string) {
  const first = rs[0];
  if (!first) throw new Error("Evidence senza pagina");
  const rawText = raw(rs);
  return {
    sourceId: SOURCE_ID, pdfPage: first.page, printedPage: printedPage(first.page), region: null,
    extraction: { method: "manual-transcription", tool: "codex-render-transcription", toolVersion: VERSION },
    transformations: transformations(rawText, normalized), rawSha256: sha256(rawText), normalizedSha256: sha256(normalized),
  };
}
function unitId(official: string): string { return `urn:structural-codes:it:unit:circ2019:${official.toLowerCase()}`; }
function assetId(official: string): string { return `urn:structural-codes:it:asset:table:circ2019:${official.toLowerCase()}`; }
function relation(official: string, headingBlockId: string) {
  const parts = official.slice(1).toLowerCase().split(".");
  while (parts.length && !existsSync(join(ROOT, "corpus", "units", "ntc2018", `${parts.join(".")}.json`))) parts.pop();
  if (!parts.length) return [];
  return [{ relationId: unitId(official) + "#relation-001", type: "clarifies", targetUnitId: `urn:structural-codes:it:unit:ntc2018:${parts.join(".")}`, basis: "editorial", evidenceBlockIds: [headingBlockId], rationale: "Corrispondenza proposta tra numerazione omologa della Circolare e delle NTC; richiede conferma umana sul contenuto completo.", review: { status: "proposed", reviewedBy: null, reviewedAt: null } }];
}
let currentUnit = "";
function addBlock(blocks: Block[], normalized: string, kind: "heading" | "paragraph" | "list-item", ev: unknown, rawText: string) {
  const blockId = currentUnit + "#block-" + (blocks.length === 0 ? "heading" : String(blocks.length).padStart(3, "0"));
  const text: Record<string, unknown> = { raw: rawText, normalized, normalizationVersion: VERSION };
  const segments = inline(normalized);
  if (segments) text.inline = segments;
  blocks.push({ blockId, kind, origin: "official", text, evidence: ev });
  return blockId;
}
function addText(blocks: Block[], rs: Range[], normalized: string, kind: "heading" | "paragraph" | "list-item" = "paragraph") { return addBlock(blocks, normalized, kind, evidence(rs, normalized), raw(rs)); }
function addProse(blocks: Block[], rs: Range[], kind: "paragraph" | "list-item" = "paragraph") { return addText(blocks, rs, clean(rs), kind); }
function addTableRef(blocks: Block[], rs: Range[], official: string) {
  const blockId = currentUnit + "#block-" + String(blocks.length).padStart(3, "0");
  blocks.push({ blockId, kind: "table-ref", origin: "official", assetId: assetId(official), evidence: evidence(rs, `[Tabella ${official}]`) });
  return assetId(official);
}
function makeUnit(official: string, title: string, parent: string, ancestors: string[], position: number, location: [number, number], build: (blocks: Block[]) => void, tableIds: string[] = []) {
  currentUnit = unitId(official);
  const blocks: Block[] = [];
  const headingBlockId = addText(blocks, [{ page: location[0], start: location[1], end: location[1] }], official + " " + title, "heading");
  build(blocks);
  const record = {
    $schema: "urn:structural-codes:schema:canonical-unit:v2", schemaVersion: "2.0.0-alpha.2", recordType: "canonical-unit", id: currentUnit, workId: WORK_ID, expressionId: EXPRESSION_ID, kind: "paragraph",
    numbering: { official, sortKey: official.slice(1).split(".").map((part) => part.padStart(3, "0")).join(".") }, title, titleBlockId: headingBlockId,
    hierarchy: { parentId: unitId(parent), ancestorIds: ancestors.map(unitId), position }, validity: { from: null, to: null, status: "unknown", asOf: TODAY }, blocks, citations: [], relations: relation(official, headingBlockId),
    assets: { formulaIds: [], tableIds: tableIds.map(assetId), figureIds: [] }, workflow: { status: "extracted", createdBy: { actorId: "generator:circ87:step3b", kind: "script", toolVersion: VERSION }, createdAt: CREATED_AT, reviews: [], openIssues: [
      { issueId: `circ2019-${official.toLowerCase()}-source-review`, type: "normalization-review", severity: "blocking", note: "Trascrizione confrontata con il render ufficiale; resta obbligatoria la revisione umana indipendente." },
      { issueId: `circ2019-${official.toLowerCase()}-relation`, type: "relation-review", severity: "blocking", note: "Il collegamento Circolare-NTC per numerazione omologa richiede conferma umana." },
      ...(tableIds.length ? [{ issueId: `circ2019-${official.toLowerCase()}-table-review`, type: "asset-review", severity: "blocking", note: "Le tabelle devono essere sottoposte a verifica umana, cella per cella, sul render ufficiale." }] : []),
    ] },
  };
  writeFileSync(join(UNITS, `${official.toLowerCase()}.json`), JSON.stringify(record, null, 2) + "\n", "utf8");
}
const r = (page: number, start: number, end = start): Range[] => [{ page, start, end }];
const t = (text: string, extra: Omit<Cell, "text"> = {}): Cell => ({ text, ...extra });
const dataRow = (values: string[]): Cell[] => values.map((value) => value === "" ? t("") : t(value));
const groupRow = (text: string): Cell[] => [t(text, { colSpan: 12 })];
const table1 = {
  id: assetId("C8.7.6.3.I"), unitId: unitId("C8.7.6.3"), officialNumber: "C8.7.6.3.I", pdfPage: 297,
  caption: "Tabella C8.7.6.3.I - Raccomandazioni per la valutazione e l'adeguamento di componenti non strutturali esistenti e per l'ancoraggio di componenti non strutturali di nuova installazione al variare della zona sismica",
  columnCount: 12,
  headers: [
    [t("Componente", { rowSpan: 2 }), t("Vulnerabilità ⁵", { rowSpan: 2 }), t("Importanza", { rowSpan: 2 }), t("Costo & interruzione per l'adeguamento", { rowSpan: 2 }), t("Valutazione / adeguamento se esistenti nelle zone ⁶", { colSpan: 4 }), t("Ancoraggi se nuovi nelle zone ⁷ e ⁸", { colSpan: 4 })],
    ["1", "2", "3", "4", "1", "2", "3", "4"].map((value) => t(value)),
  ],
  rows: [
    groupRow("Gas per uso medico"),
    dataRow(["Serbatoi di ossigeno", "Alta", "Alta", "Basso", "1", "2", "3", "", "1", "2", "3", "4"]),
    dataRow(["Bombole di azoto", "Molto alta", "Alta", "Molto basso", "1", "2", "3", "4", "1", "2", "3", "4"]),
    groupRow("Impianto elettrico d'emergenza"),
    dataRow(["Batterie per la corrente elettrica d'emergenza", "Molto alta", "Alta", "Molto basso", "1", "2", "3", "4", "1", "2", "3", "4"]),
    dataRow(["Generatore della elettrico d'emergenza", "Alta", "Alta", "Basso", "1", "2", "3", "", "1", "2", "3", "4"]),
    dataRow(["Batterie per i generatori di corrente elettrica d'emergenza", "Media", "Alta", "Molto basso", "1", "2", "3", "", "1", "2", "3", ""]),
    groupRow("Ascensori"),
    dataRow(["Guide dell'ascensore", "Molto alta", "Alta", "Medio-alto", "1", "2", "", "", "1", "2", "3", "4"]),
    dataRow(["Motori e generatori dell'ascensore", "Medio-alta", "Alta", "Medio", "1", "", "", "", "1", "2", "3", ""]),
    dataRow(["Pannelli elettrici e di controllo dell'ascensore", "Variabile", "Alta", "Basso", "1", "2", "", "", "1", "2", "3", ""]),
    groupRow("Apparecchiature per la comunicazione"),
    dataRow(["Computer e schermi nei ‘call centers’ d'emergenza", "Medio-alta", "Medio-alta", "Molto basso", "1", "2", "3", "", "1", "2", "3", "4"]),
    dataRow(["Armadietti non ancorati che supportano le apparecchiature telefoniche per i ‘call centers’ d'emergenza", "Alta", "Alta", "Basso", "1", "2", "3", "", "1", "2", "3", "4"]),
    dataRow(["Interruttori e pannelli da muro dell'impianto telefonico dei ‘call centers’ d'emergenza", "Bassa", "Alta", "Medio", "", "", "", "", "1", "2", "3", ""]),
    groupRow("Apparecchiature e rifornimenti medici"),
    dataRow(["Scaffali per stoccaggio di medicinali e altri importanti materiali medici di scorta", "Alta", "Alta", "Basso", "1", "2", "", "", "1", "2", "3", ""]),
    dataRow(["Apparecchiature mediche", "Variabile", "Alta", "Variabile", "1", "2", "", "", "1", "2", "3", ""]),
    groupRow("Componenti fissati al pavimento o sul tetto⁽⁴⁾"),
    dataRow(["Caldaie", "Media", "Medio-alta", "Basso", "1", "2", "", "", "1", "2", "3", ""]),
    dataRow(["Cabine contenenti i trasformatori elettrici", "Bassa", "Alta", "Medio-basso", "1", "", "", "", "1", "2", "3", ""]),
    dataRow(["Tipici componenti da installarsi sul pavimento o sul tetto montati su isolatori per le vibrazioni", "Medio-alta", "Media", "Medio-basso", "1", "2", "", "", "1", "2", "3", ""]),
    dataRow(["Tipici componenti o serbatoi fissati al pavimento o installati sul tetto con un rapporto di ribaltamento >1.6, componenti soggetti al ribaltamento", "Alta", "Media", "Basso", "1", "2", "", "", "1", "2", "3", ""]),
    dataRow(["Tipici componenti o serbatoi fissati al pavimento o installati sul tetto con un rapporto di ribaltamento tra 1 e 1.6.", "Media", "Media", "Basso", "1", "2", "", "", "1", "2", "3", ""]),
    dataRow(["Tipici componenti o serbatoi fissati al pavimento o installati sul tetto con un rapporto di ribaltamento < 1", "Media", "Media", "Basso", "1", "2", "", "", "1", "2", "", ""]),
    dataRow(["Pedane d'appoggio", "Medio-bassa", "Variabile", "Medio-alto", "", "", "", "", "1", "2", "", ""]),
    groupRow("Sistemi di distribuzione"),
    dataRow(["Tubature sospese nei sistemi critici con un diametro nominale >200 mm e su attacchi lunghi più di 500 mm", "Media", "Alta", "Medio", "1", "2", "", "", "1", "2", "3", ""]),
    dataRow(["Tubature sospese di diametro nominale >100 mm e attacchi lunghi più di 300 mm", "Medio-bassa", "Medio-alta", "Medio", "", "", "", "", "1", "2", "", ""]),
    dataRow(["Condotto per gli impianti di riscaldamento, ventilazione, e condizionamento d'aria", "Bassa", "Medio-alta", "Medio", "", "", "", "", "1", "", "", ""]),
    dataRow(["Componenti dell'impianto elettrico come condotti contenenti i cavi e piattaforme di sostegno dei condotti per la distribuzione dell'energia elettrica", "Bassa", "Alta", "Medio", "", "", "", "", "1", "", "", ""]),
    groupRow("Componenti architettonici"),
    dataRow(["Soffitto sospeso o a pannelli", "Bassa", "Medio-bassa", "Medio", "", "", "", "", "1", "", "", ""]),
    dataRow(["Lampadari su controsoffitti", "Bassa", "Media", "Medio-basso", "1", "", "", "", "1", "2", "", ""]),
    dataRow(["Tamponamenti interni non armati in muratura", "Media", "Media", "Molto alto", "", "", "", "", "1", "2", "", ""]),
    dataRow(["Muri esterni di mattoni non rinforzati", "Media", "Media", "Molto alto", "", "", "", "", "1", "2", "", ""]),
    groupRow("Sostanze Pericolose"),
    dataRow(["Tamponamenti e altri componenti in aree con materiale biologico o infettivo", "Variabile", "Alta", "Variabile", "1", "2", "3", "4", "1", "2", "3", "4"]),
    dataRow(["Aree con stoccaggio o uso di materiale pericolosi di tipo chimico, nucleare o biologico", "Variabile", "Alta", "Variabile", "1", "2", "3", "4", "1", "2", "3", "4"]),
  ],
  notes: [
    "La vulnerabilità è quella assunta per alta sismicità.",
    "Le raccomandazioni si basano sulle osservazioni dei danni dei terremoti passati e sull'ipotesi di vulnerabilità, importanza e costi di adeguamento per sistemi tipici.",
    "La colonna ‘Ancoraggi se nuovi nelle zone’ riguarda i componenti o i sistemi di nuova installazione in edifici sia nuovi che esistenti.",
    "Per i componenti fissati sul pavimento o sul tetto il rapporto di ribaltamento è pari a h_c / x_min, dove h_c è l'altezza del baricentro del componente sopra la sua base, e x_min è la distanza orizzontale più breve dal baricentro al bordo della base del componente.",
  ],
};
const table2 = {
  id: assetId("C8.7.6.3.II"), unitId: unitId("C8.7.6.3"), officialNumber: "C8.7.6.3.II", pdfPage: 298,
  caption: "Tabella C8.7.6.3.II - Possibili alternative per la limitazione del rischio di fuoriuscite di gas sotto azioni sismiche", columnCount: 7,
  headers: [["Criterio di confronto", "Valvole ad attivazione manuale", "Valvole sismiche ad attivazione automatica", "Valvole ad eccesso di flusso (istallazione al contatore)", "Valvole ad eccesso di flusso (istallazione all'apparecchio)", "Sensori di metano", "Sistemi ibridi"].map((value) => t(value))],
  rows: [
    ["Principio di funzionamento", "Sono istallate dal fornitore in corrispondenza di ogni contatore", "Interrompono automaticamente il flusso del gas quando avvertono una eccitazione sismica al di sopra di una soglia di taratura", "Interrompono automaticamente il flusso di gas se un danno provoca, a valle del dispositivo, una perdita di entità superiore ad una soglia di taratura", "Interrompono automaticamente il flusso di gas se un danno provoca, a valle del dispositivo, una perdita di entità superiore ad una soglia di taratura", "Individuano la elevata concentrazione di gas metano e producono un segnale di allarme", "Sistema modulare costituito da una unità centrale di controllo, sensori, dispositivi di controllo e di allarme"].map((value) => t(value)),
    ["Requisiti di installazione e manutenzione", "Nessuno, in quanto già previste come parte dell'impianto", "Installazione da parte di personale qualificato", "Installazione da parte di personale qualificato. Devono essere dimensionate per uno specifico carico di lavoro dell'impianto e adeguate in caso di modifiche dell'impianto.", "Installazione anche da parte dell'utente. Devono essere dimensionate per uno specifico carico di lavoro dell'apparecchio e adeguate in caso di modifiche dell'apparecchio", "Installazione anche da parte dell'utente.", "Di solito istallazione da parte di personale qualificato (se in associazione con dispositivi di intercettazione automatica)"].map((value) => t(value)),
    ["Benefici", "Presenti in ogni impianto. Istruzioni per il loro utilizzo di solito sono presenti nelle informazioni divulgate dal fornitore", "Interrompono il flusso quando il livello di eccitazione potrebbe essere sufficiente a danneggiare le tubature del gas. Devono essere certificate in base ad uno standard", "Interrompono il flusso solo quando si verificano condizioni di pericolo dovute ad una perdita di gas. Devono essere certificate in base ad uno standard", "Interrompono il flusso solo quando si verificano condizioni di pericolo dovute ad una perdita di gas. Devono essere certificate in base ad uno standard", "Avvisano l'utente quando si verifica una situazione potenzialmente pericolosa, lasciandogli la scelta su come intervenire.", "Sono modulari e possono essere personalizzati per varie esigenze. Ogni modulo è dotato di funzioni specifiche."].map((value) => t(value)),
    ["Possibili inconvenienti", "Possono essere utilizzate solo se qualcuno è presente, conosce la localizzazione delle valvole e (se richiesta) dispone dell'apposita chiave per la chiusura della valvola", "Si può interrompere il flusso di gas anche se non si verificano condizioni realmente pericolose. Le scosse successive alla prima possono causare l'interruzione del gas anche dopo il ripristino della fornitura. Potrebbero essere attivate da vibrazioni non causate da terremoti.", "Non interrompono il flusso di gas se la perdita è al di sotto della soglia di taratura, anche se si sono verificate condizioni di pericolo. Potrebbero non attivarsi se il carico di lavoro dell'impianto si modifica e le valvole non vengono adeguate.", "Non fornisce protezione per i danni a monte del dispositivo. Non interrompono il flusso di gas se la perdita è al di sotto della soglia di taratura, anche se si sono verificate condizioni di pericolo. Potrebbero non attivarsi se il carico di lavoro dell'impianto si modifica e le valvole non vengono adeguate.", "È necessario che l'utente sia presente per udire il segnale di allarme e porre in essere le misure necessarie. Si potrebbe verificare un allarme a causa di vapori diversi dal gas metano.", ""].map((value) => t(value)),
    ["Altri aspetti", "Le operazioni sulla valvola potrebbero essere difficili quando questa fosse bloccata, oppure impossibili per utenti disabili, feriti o anziani", "Installazioni diffuse sul territorio potrebbero causare interruzioni generalizzate di forniture e ritardi nel ripristino. Eventuale necessità nel post-terremoto di usare il gas per rendere potabile l'acqua. Non sono sensibili ai cambiamenti di flusso o di pressione.", "Disponibili con o senza bypass (consentono il ripristino automatico). Non sono sensibili allo scuotimento sismico.", "Disponibili con o senza bypass (consentono il ripristino automatico). Devono essere efficaci per ogni apparecchio. Non sono sensibili allo scuotimento sismico.", "", ""].map((value) => t(value)),
  ],
  notes: [],
};
mkdirSync(ASSETS, { recursive: true });
writeFileSync(join(ASSETS, "C8.7-step3b.json"), JSON.stringify({ $schema: "urn:structural-codes:schema:asset-manifest:v2", schemaVersion: "2.0.0-alpha.1", recordType: "asset-manifest", document: "circ2019", section: "C8.7-step3b", sourceId: SOURCE_ID, status: "transcribed-unreviewed", formulas: [], tables: [table1, table2], figures: [] }, null, 2) + "\n", "utf8");

makeUnit("C8.7.5", "ELABORATI DEL PROGETTO DELL’INTERVENTO", "C8.7", ["C8", "C8.7"], 5, [295, 46], (blocks) => {
  addProse(blocks, r(295, 47, 48));
  addProse(blocks, r(295, 49), "list-item"); addProse(blocks, r(295, 50), "list-item"); addProse(blocks, r(295, 51), "list-item"); addProse(blocks, r(295, 52), "list-item"); addProse(blocks, r(295, 53), "list-item");
  addProse(blocks, r(296, 3), "list-item"); addProse(blocks, r(296, 4), "list-item"); addProse(blocks, r(296, 5), "list-item"); addProse(blocks, r(296, 6, 7), "list-item");
  addProse(blocks, r(296, 8, 11)); addProse(blocks, r(296, 12, 14)); addProse(blocks, r(296, 15, 16));
});
makeUnit("C8.7.6", "INDICAZIONI AGGIUNTIVE PER GLI ELEMENTI NON STRUTTURALI E GLI IMPIANTI SOGGETTI AD AZIONI SISMICHE", "C8.7", ["C8", "C8.7"], 6, [296, 17], (blocks) => { addProse(blocks, r(296, 18, 23)); addProse(blocks, r(296, 24)); });
makeUnit("C8.7.6.1", "INDIVIDUAZIONE DEI COMPONENTI NON STRUTTURALI CHE RICHIEDONO UNA VALUTAZIONE SISMICA", "C8.7.6", ["C8", "C8.7", "C8.7.6"], 1, [296, 25], (blocks) => { addProse(blocks, r(296, 26)); addProse(blocks, r(296, 27), "list-item"); addProse(blocks, r(296, 28), "list-item"); addProse(blocks, r(296, 29), "list-item"); addProse(blocks, r(296, 30), "list-item"); });
makeUnit("C8.7.6.2", "CRITERI DI PROGETTAZIONE E AZIONI DI VERIFICA", "C8.7.6", ["C8", "C8.7", "C8.7.6"], 2, [296, 31], (blocks) => { addProse(blocks, r(296, 32, 34)); addProse(blocks, r(296, 35, 39)); });
makeUnit("C8.7.6.3", "RACCOMANDAZIONI AGGIUNTIVE PER LA LIMITAZIONE DEL RISCHIO DI FUORIUSCITE INCONTROLLATE DI GAS A CAUSA DEL SISMA", "C8.7.6", ["C8", "C8.7", "C8.7.6"], 3, [296, 40], (blocks) => {
  addProse(blocks, r(296, 42, 46)); addProse(blocks, r(296, 47, 49)); addProse(blocks, [...r(296, 50, 51), ...r(297, 3, 10)]);
  addTableRef(blocks, [...r(297, 11, 70), ...r(298, 3, 68)], "C8.7.6.3.I");
  addTableRef(blocks, [...r(298, 69, 106), ...r(299, 3, 259), ...r(300, 3, 21)], "C8.7.6.3.II");
}, ["C8.7.6.3.I", "C8.7.6.3.II"]);

makeUnit("C8.8", "INDICAZIONI AGGIUNTIVE RELATIVE AI PONTI ESISTENTI", "C8", ["C8"], 8, [300, 22], (blocks) => { addProse(blocks, r(300, 23, 24)); addProse(blocks, r(300, 25, 26)); });
makeUnit("C8.8.1", "AZIONE SISMICA", "C8.8", ["C8", "C8.8"], 1, [300, 27], (blocks) => { addProse(blocks, r(300, 28)); });
makeUnit("C8.8.2", "CRITERI GENERALI", "C8.8", ["C8", "C8.8"], 2, [300, 29], (blocks) => { addProse(blocks, r(300, 30)); addProse(blocks, r(300, 31, 32)); addProse(blocks, r(300, 33, 34)); });
makeUnit("C8.8.3", "LIVELLO DI CONOSCENZA E FATTORE DI CONFIDENZA", "C8.8", ["C8", "C8.8"], 3, [300, 35], (blocks) => { addProse(blocks, r(300, 36, 37)); });
makeUnit("C8.8.4", "MODELLO STRUTTURALE", "C8.8", ["C8", "C8.8"], 4, [300, 38], (blocks) => { addProse(blocks, r(300, 39, 40)); addProse(blocks, r(300, 41)); });
makeUnit("C8.8.5", "METODI DI ANALISI E CRITERI DI VERIFICA", "C8.8", ["C8", "C8.8"], 5, [300, 42], (blocks) => { addProse(blocks, r(300, 43, 46)); addProse(blocks, r(300, 47, 48)); });
makeUnit("C8.8.5.1", "ANALISI LINEARE STATICA", "C8.8.5", ["C8", "C8.8", "C8.8.5"], 1, [300, 49], (blocks) => { addProse(blocks, r(300, 50, 51)); });
makeUnit("C8.8.5.2", "ANALISI LINEARE DINAMICA", "C8.8.5", ["C8", "C8.8", "C8.8.5"], 2, [300, 52], (blocks) => { addProse(blocks, r(300, 53, 55)); });
makeUnit("C8.8.5.3", "ANALISI NON LINEARE STATICA", "C8.8.5", ["C8", "C8.8", "C8.8.5"], 3, [300, 56], (blocks) => { addProse(blocks, r(300, 57, 61)); });

console.log("circ87-step3b: rebuilt C8.7.5-C8.8.5.3 and C8.7.6 tables");
