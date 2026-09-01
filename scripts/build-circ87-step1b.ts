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
const scopedPages274To276 = process.argv.includes("--pages-274-276");
const scopedPages277To279 = process.argv.includes("--pages-277-279");
const scopedUnits = new Set([
  "C8.7.1.2.1.3", "C8.7.1.2.1.4", "C8.7.1.2.1.5",
  "C8.7.1.2.1.6", "C8.7.1.2.1.7", "C8.7.1.2.1.8",
]);
const scopedUnits277To279 = new Set([
  "C8.7.1.2.1.8", "C8.7.1.2.1.9", "C8.7.1.3", "C8.7.1.3.1", "C8.7.1.3.1.1",
]);

type Range = { page: number; start: number; end: number };
type Inline = { kind: "text" | "math"; value: string; latex?: string };
type Block = Record<string, unknown>;
const pages = new Map<number, string[]>();
function lines(page: number): string[] {
  let value = pages.get(page);
  if (!value) {
    value = readFileSync(join(EVIDENCE, "page-" + String(page).padStart(4, "0") + ".raw.txt"), "utf8").replace(/\r\n/g, "\n").split("\n");
    pages.set(page, value);
  }
  return value;
}
function raw(ranges: Range[]): string {
  return ranges.map(({ page, start, end }) => lines(page).slice(start - 1, end).join("\n")).join("\n");
}
function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}
function clean(ranges: Range[]): string {
  return raw(ranges).replace(/\u0003/gu, "-").replace(/[ \t]*\n[ \t]*/gu, " ").replace(/[\u0000-\u001f\u007f]/gu, "").replace(/\s+/gu, " ").trim();
}
function printedPage(page: number): string {
  return String(page - 4);
}
const mathMap: Record<string, string> = {
  "a_{g,SLV}": "a_{g,SLV}", "a_{g,SLC}": "a_{g,SLC}", "a_{g,SLD}": "a_{g,SLD}",
  "a_{z,SLD}": "a_{Z,SLD}", "a_g": "a_g", "a_0": "a_0", "a_y": "a_y", "ξ_1": "\\xi_1",
  "d_{SLV}": "d_{SLV}", "d_{SLC}": "d_{SLC}",
  "S_{eZ,SLD}": "S_{eZ,SLD}", "S_{De}(T)": "S_{De}(T)", "T_{SLV}": "T_{SLV}", "T_{SLC}": "T_{SLC}",
  "T_0": "T_0", "T_1": "T_1", "b_T": "b_T", "d_C": "d_C", "d_0": "d_0",
  "ξ_k": "\\xi_k", "T_k": "T_k", "δ_Cx": "\\delta_{Cx}", "δ_{PQ_x,k}": "\\delta_{PQ_x,k}",
  "e*": "e^*", "a(d)": "a(d)", "q=2": "q=2", "ξ=5%": "\\xi=5\\%",
  "6,2": "6{,}2", "2,2": "2{,}2", "T²/4π²": "T^2/(4\\pi^2)", "8%": "8\\%", "10%": "10\\%", "80%": "80\\%", "¾": "3/4", "3/4": "3/4", "2/3": "2/3", "q*≤3": "q^*\\le3", "q*≤4": "q^*\\le4",
  "f_{v,lim}": "f_{v,lim}", "f_{v0}": "f_{v0}", "f_b": "f_b", "θ_i": "\\theta_i", "θ_j": "\\theta_j",
  "φ_i": "\\varphi_i", "φ_j": "\\varphi_j", "α_0": "\\alpha_0", "α": "\\alpha", "q": "q",
  "FC": "\\mathrm{FC}",
  "ξ": "\\xi", "κ": "\\kappa", "λ": "\\lambda", "μ": "\\mu", "φ": "\\varphi",
  "W": "W", "T": "T", "a": "a", "d": "d",
};
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^$()|[\]\\]/gu, "\\$&").replace(/[{}]/gu, "\\$&");
}
const fixedMathTokens = Object.keys(mathMap).filter((token) => token.length > 1).sort((a, b) => b.length - a.length).map(escapeRegExp);
const inlinePattern = new RegExp(fixedMathTokens.concat(["(?<![\\p{L}\\p{N}_])W(?![\\p{L}\\p{N}_])", "(?<![\\p{L}\\p{N}_])T(?![\\p{L}\\p{N}_])"]).join("|"), "gu");
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
function inlineTerms(text: string, terms: Array<[string, string]>): Inline[] {
  const segments: Inline[] = [];
  let cursor = 0;
  while (cursor < text.length) {
    let next: { index: number; value: string; latex: string } | undefined;
    for (const [value, latex] of terms) {
      let index = text.indexOf(value, cursor);
      while (index >= 0 && value.length === 1 && /[A-Za-z]/u.test(value)) {
        const before = index > 0 ? text[index - 1]! : "";
        const after = text[index + 1] ?? "";
        if (!/[\p{L}\p{N}_]/u.test(before) && !/[\p{L}\p{N}_]/u.test(after)) break;
        index = text.indexOf(value, index + 1);
      }
      if (index >= 0 && (!next || index < next.index || (index === next.index && value.length > next.value.length))) next = { index, value, latex };
    }
    if (!next) { segments.push({ kind: "text", value: text.slice(cursor) }); break; }
    if (next.index > cursor) segments.push({ kind: "text", value: text.slice(cursor, next.index) });
    segments.push({ kind: "math", value: next.value, latex: next.latex });
    cursor = next.index + next.value.length;
  }
  return segments.filter(({ value }) => value.length > 0);
}
function transformations(rawText: string, normalized: string) {
  return [
    ...(rawText.includes("\n") ? [{ operation: "join-line-wrap", ruleVersion: VERSION, note: "Rimossi gli a capo introdotti dall’impaginazione, conservando il capoverso." }] : []),
    ...(/[\u0000-\u001f\u007f]/u.test(rawText) ? [{ operation: "remove-control-character", ruleVersion: VERSION, note: "Rimossi i caratteri di controllo introdotti dall’estrazione del PDF." }] : []),
    ...(rawText !== normalized ? [{ operation: "manual-correction", ruleVersion: VERSION, note: "Ripristinati accenti, apostrofi, numerazione, glifi matematici e punteggiatura verificati sul render ufficiale." }] : []),
    { operation: "unicode-nfc", ruleVersion: VERSION, note: "Testo normalizzato in Unicode NFC." },
  ];
}
function evidence(ranges: Range[], normalized: string, method: "pdf-text" | "manual-transcription" = "manual-transcription") {
  const first = ranges[0];
  if (!first) throw new Error("Evidence senza pagina");
  const rawText = raw(ranges);
  return {
    sourceId: SOURCE_ID, pdfPage: first.page, printedPage: printedPage(first.page), region: null,
    extraction: { method, tool: method === "manual-transcription" ? "codex-render-transcription" : "pdfjs-dist", toolVersion: VERSION },
    transformations: transformations(rawText, normalized), rawSha256: sha256(rawText), normalizedSha256: sha256(normalized),
  };
}
function unitId(official: string): string {
  return "urn:structural-codes:it:unit:circ2019:" + official.toLowerCase();
}
function formulaId(official: string): string {
  return "urn:structural-codes:it:asset:formula:circ2019:" + official.toLowerCase();
}
function relation(official: string, headingBlockId: string) {
  const parts = official.slice(1).toLowerCase().split(".");
  while (parts.length > 0 && !existsSync(join(ROOT, "corpus", "units", "ntc2018", parts.join(".") + ".json"))) parts.pop();
  return [{
    relationId: unitId(official) + "#relation-001", type: "clarifies",
    targetUnitId: "urn:structural-codes:it:unit:ntc2018:" + parts.join("."), basis: "editorial",
    evidenceBlockIds: [headingBlockId],
    rationale: "Corrispondenza proposta tra numerazione omologa della Circolare e delle NTC; richiede conferma umana sul contenuto completo.",
    review: { status: "proposed", reviewedBy: null, reviewedAt: null },
  }];
}
let currentUnit = "";
function addText(blocks: Block[], ranges: Range[], normalized: string, kind: "heading" | "paragraph" | "list-item" = "paragraph") {
  const blockId = currentUnit + "#block-" + (blocks.length === 0 ? "heading" : String(blocks.length).padStart(3, "0"));
  const text: Record<string, unknown> = { raw: raw(ranges), normalized, normalizationVersion: VERSION };
  const segments = kind === "heading" ? undefined : inline(normalized);
  if (segments) text.inline = segments;
  blocks.push({ blockId, kind, origin: "official", text, evidence: evidence(ranges, normalized) });
  return blockId;
}
function setLastInline(blocks: Block[], segments: Inline[]) {
  const block = blocks[blocks.length - 1];
  if (!block) throw new Error("Blocco mancante per la matematica inline");
  (block.text as Record<string, unknown>).inline = segments;
}
function setLastInlineTerms(blocks: Block[], terms: Array<[string, string]>) {
  const block = blocks[blocks.length - 1];
  if (!block?.text) throw new Error("Blocco mancante per la matematica inline");
  const text = block.text as Record<string, unknown>;
  text.inline = inlineTerms(text.normalized as string, terms);
}
function addProse(blocks: Block[], ranges: Range[], kind: "paragraph" | "list-item" = "paragraph") {
  return addText(blocks, ranges, clean(ranges), kind);
}
function addFormulaRef(blocks: Block[], ranges: Range[], official: string) {
  const id = formulaId(official);
  const blockId = currentUnit + "#block-" + String(blocks.length).padStart(3, "0");
  blocks.push({ blockId, kind: "formula-ref", origin: "official", assetId: id, evidence: evidence(ranges, "[" + official + "]", "pdf-text") });
  return id;
}
function makeUnit(official: string, title: string, parent: string, ancestors: string[], position: number, build: (blocks: Block[]) => void, formulaIds: string[] = []) {
  if (scopedPages274To276 && !scopedUnits.has(official)) return;
  if (scopedPages277To279 && !scopedUnits277To279.has(official)) return;
  currentUnit = unitId(official);
  const blocks: Block[] = [];
  const headingBlockId = addText(blocks, headingRanges[official]!, official + " " + title, "heading");
  build(blocks);
  const record = {
    $schema: "urn:structural-codes:schema:canonical-unit:v2", schemaVersion: "2.0.0-alpha.2", recordType: "canonical-unit",
    id: currentUnit, workId: WORK_ID, expressionId: EXPRESSION_ID, kind: "paragraph",
    numbering: { official, sortKey: official.slice(1).split(".").map((x) => x.padStart(3, "0")).join(".") },
    title, titleBlockId: headingBlockId,
    hierarchy: { parentId: unitId(parent), ancestorIds: ancestors.map(unitId), position },
    validity: { from: null, to: null, status: "unknown", asOf: TODAY }, blocks, citations: [],
    relations: relation(official, headingBlockId), assets: { formulaIds, tableIds: [], figureIds: [] },
    workflow: {
      status: "extracted", createdBy: { actorId: "generator:circ87:step1b", kind: "script", toolVersion: VERSION }, createdAt: CREATED_AT, reviews: [],
      openIssues: [
        { issueId: "circ2019-" + official.toLowerCase() + "-source-review", type: "normalization-review", severity: "blocking", note: "Trascrizione confrontata con il render ufficiale; resta obbligatoria la revisione umana indipendente." },
        { issueId: "circ2019-" + official.toLowerCase() + "-relation", type: "relation-review", severity: "blocking", note: "Il collegamento Circolare-NTC per numerazione omologa richiede conferma umana." },
        ...(formulaIds.length > 0 ? [{ issueId: "circ2019-" + official.toLowerCase() + "-formula-review", type: "asset-review", severity: "blocking", note: "Le formule devono essere sottoposte a verifica umana, glifo per glifo, sul render ufficiale." }] : []),
      ],
    },
  };
  writeFileSync(join(UNITS, official.toLowerCase() + ".json"), JSON.stringify(record, null, 2) + "\n", "utf8");
}
const r = (page: number, start: number, end = start): Range[] => [{ page, start, end }];
const headingRanges: Record<string, Range[]> = {
  "C8.7.1.2.1.3": r(274, 20), "C8.7.1.2.1.4": r(275, 15), "C8.7.1.2.1.5": r(275, 34),
  "C8.7.1.2.1.6": r(275, 59), "C8.7.1.2.1.7": r(276, 20), "C8.7.1.2.1.8": r(276, 33),
  "C8.7.1.2.1.9": r(277, 26), "C8.7.1.3": r(277, 63), "C8.7.1.3.1": r(277, 64), "C8.7.1.3.1.1": r(279, 13),
};
const F3 = formulaId("C8.7.1.3");
const F4 = formulaId("C8.7.1.4");
const F5 = formulaId("C8.7.1.5");
const F6 = formulaId("C8.7.1.6");
const F7 = formulaId("C8.7.1.7");
const F8 = formulaId("C8.7.1.8");
const F9 = formulaId("C8.7.1.9");
const F10 = formulaId("C8.7.1.10");
const F11 = formulaId("C8.7.1.11");
const F12 = formulaId("C8.7.1.12");
const F13 = formulaId("C8.7.1.13");
const F14 = formulaId("C8.7.1.14");

makeUnit("C8.7.1.2.1.3", "Definizione dell’oscillatore non lineare equivalente", "C8.7.1.2.1", ["C8", "C8.7", "C8.7.1", "C8.7.1.2", "C8.7.1.2.1"], 3, (blocks) => {
  addText(blocks, r(274, 21, 23), "Al fine di valutare la domanda sismica di spostamento, è necessario determinare la “curva di capacità” del meccanismo locale, ovvero ricondursi alla risposta (a meno dell’accelerazione di gravità g) di un oscillatore equivalente non lineare a un grado di libertà descritta in termini accelerazione-spostamento come α(d):");
  setLastInlineTerms(blocks, [["α(d)", "\\alpha(d)"], ["g", "g"]]);
  addFormulaRef(blocks, r(274, 24, 25), "C8.7.1.3"); addFormulaRef(blocks, r(274, 26, 33), "C8.7.1.4");
  addText(blocks, r(274, 34), "dove:");
  addText(blocks, r(274, 35), "g è l’accelerazione di gravità;");
  setLastInlineTerms(blocks, [["g", "g"]]);
  addText(blocks, r(274, 36, 38), "FC è il Fattore di Confidenza, che in questo caso si applica direttamente alla capacità in termini di resistenza (nel caso in cui, per la valutazione del moltiplicatore α, non si tenga conto della resistenza a compressione della muratura, il fattore di confidenza da utilizzare sarà comunque quello relativo al livello di conoscenza LC1);");
  addText(blocks, r(274, 39, 41), "δ_Cx è lo spostamento virtuale orizzontale del punto di controllo valutato, così come gli spostamenti virtuali δ_{PQ_x,k}, a partire dalla configurazione indeformata iniziale;");
  addText(blocks, r(274, 42, 44), "e* è la frazione di massa partecipante che, in prima approssimazione, può essere valutata considerando gli spostamenti virtuali relativi al cinematismo (misurati a partire dalla configurazione indeformata iniziale) come rappresentativi del modo di vibrazione del meccanismo locale.");
  addFormulaRef(blocks, r(274, 45, 53), "C8.7.1.5");
  addText(blocks, r(274, 54, 57), "La curva di capacità così ottenuta presuppone che il comportamento del meccanismo, prima della sua attivazione, sia infinitamente rigido; questa assunzione è ammissibile nel caso di meccanismi fuori dal piano di pareti murarie inizialmente vincolate con continuità alle pareti trasversali, in quanto le prime, precedentemente all’attivazione del meccanismo stesso, non sono caratterizzate da un comportamento dinamico autonomo.");
  addText(blocks, r(274, 58, 61), "Nel caso invece di elementi liberi di vibrare (quali parapetti, porzioni svettanti di facciate, pinnacoli o merlature, ecc.) è necessario considerare che la loro risposta, prima che si verifichino le condizioni di attivazione del cinematismo, è dinamica elastica, anche se spesso caratterizzata da un basso periodo di vibrazione; è quindi necessario introdurre un ramo elastico iniziale nella curva di capacità, legando l’accelerazione a allo spostamento d mediante il periodo T_0 attraverso la equazione [C8.7.1.6].");
  addFormulaRef(blocks, r(274, 62, 64), "C8.7.1.6");
  addText(blocks, r(274, 65), "Il periodo T_0, a sua volta, può essere stimato, a partire dalla soluzione della trave con massa distribuita, con la formula:");
  addFormulaRef(blocks, r(274, 66, 67), "C8.7.1.7");
  addText(blocks, r(275, 3), "dove:");
  addText(blocks, r(275, 4), "g è l’accelerazione di gravità;");
  setLastInlineTerms(blocks, [["g", "g"]]);
  addText(blocks, r(275, 5, 6), "κ è un coefficiente che vale 6,2 per elementi svettanti (mensola) e 2,2 per meccanismi flessionali verticali (trave appoggiata);");
  addText(blocks, r(275, 7), "L è la lunghezza dell’elemento;");
  setLastInlineTerms(blocks, [["L", "L"]]);
  addText(blocks, r(275, 8), "λ è la snellezza dell’elemento (rapporto tra la lunghezza L e lo spessore t);");
  setLastInlineTerms(blocks, [["λ", "\\lambda"], ["L", "L"], ["t", "t"]]);
  addText(blocks, r(275, 9), "W è il peso specifico della muratura;");
  addText(blocks, r(275, 10, 11), "E è il modulo elastico della muratura (valori sono suggeriti nella Tabella C8.5.I); si suggerisce di introdurre un valore ridotto per considerare condizioni fessurate.");
  setLastInlineTerms(blocks, [["E", "E"]]);
  addProse(blocks, r(275, 12, 14));
}, [F3, F4, F5, F6, F7]);

makeUnit("C8.7.1.2.1.4", "Azioni spettrali da applicare nella verifica dei meccanismi locali", "C8.7.1.2.1", ["C8", "C8.7", "C8.7.1", "C8.7.1.2", "C8.7.1.2.1"], 4, (blocks) => {
  addProse(blocks, r(275, 16, 19));
  addText(blocks, r(275, 20, 23), "In particolare, per tener conto delle non linearità della struttura principale, che producono una riduzione dell’amplificazione delle accelerazioni relative ai meccanismi locali, occorre valutare lo smorzamento viscoso equivalente ξ_k e l’incremento del periodo equivalente T_k, da introdurre nelle equazioni suddette.");
  addProse(blocks, r(275, 24, 27));
  setLastInlineTerms(blocks, [["50%", "50\\%"], ["100%", "100\\%"], ["10%", "10\\%"], ["20%", "20\\%"]]);
  addProse(blocks, r(275, 28, 33));
});

makeUnit("C8.7.1.2.1.5", "Verifica dello Stato Limite di Danno del meccanismo locale", "C8.7.1.2.1", ["C8", "C8.7", "C8.7.1", "C8.7.1.2", "C8.7.1.2.1"], 5, (blocks) => {
  addProse(blocks, r(275, 35, 39));
  addText(blocks, r(275, 40, 44), "Nell’ipotesi che la porzione rappresentata dal sistema di corpi rigidi si comporti come infinitamente rigida fino all’attivazione del cinematismo, questo si attiva quando l’accelerazione massima alla quota z (a_{z,SLD}) a cui si colloca il meccanismo locale in esame è uguale all’accelerazione a_0 corrispondente al moltiplicatore di attivazione α_0:");
  addFormulaRef(blocks, r(275, 45, 46), "C8.7.1.8");
  addText(blocks, r(275, 47, 51), "Nel caso invece di meccanismi locali relativi ad elementi liberi di vibrare (quali parapetti, porzioni svettanti di facciate, pinnacoli o merlature, ecc.) è necessario considerare la domanda in accelerazione (alla quota z) corrispondente al periodo caratteristico iniziale T_0 del meccanismo (per uno smorzamento ξ=5%, a meno di più accurate valutazioni da adottare in funzione della geometria e delle condizioni di vincolo) e confrontarla con la capacità a_y (che può in genere essere approssimata da α_0):");
  addFormulaRef(blocks, r(275, 52, 55), "C8.7.1.9");
  addProse(blocks, r(275, 56, 58));
}, [F8, F9]);

makeUnit("C8.7.1.2.1.6", "Verifica degli Stati Limite Ultimi di Salvaguardia della Vita (SLV) e di prevenzione del Collasso (SLC)", "C8.7.1.2.1", ["C8", "C8.7", "C8.7.1", "C8.7.1.2", "C8.7.1.2.1"], 6, (blocks) => {
  addProse(blocks, r(275, 60, 62));
  addText(blocks, r(276, 3, 4), "- il 40% dello spostamento d_0 per cui si annulla l’accelerazione spettrale a valutata su una curva di capacità in cui si considerino solamente le azioni di cui è verificata la presenza fino al collasso;", "list-item");
  setLastInline(blocks, [
    { kind: "text", value: "- il " }, { kind: "math", value: "40%", latex: "40\\%" }, { kind: "text", value: " dello spostamento " }, { kind: "math", value: "d_0", latex: "d_0" },
    { kind: "text", value: " per cui si annulla l’accelerazione spettrale " }, { kind: "math", value: "a", latex: "a" },
    { kind: "text", value: " valutata su una curva di capacità in cui si considerino solamente le azioni di cui è verificata la presenza fino al collasso;" },
  ]);
  addProse(blocks, r(276, 5, 8), "list-item");
  setLastInlineTerms(blocks, [["50%", "50\\%"], ["SLC", "\\mathrm{SLC}"]]);
  addProse(blocks, r(276, 9));
  addText(blocks, r(276, 10, 11), "- il 60% dello spostamento d_0 per cui si annulla l’accelerazione spettrale a valutata su una curva di capacità in cui si considerino solamente le azioni di cui è verificata la presenza fino al collasso;", "list-item");
  setLastInline(blocks, [
    { kind: "text", value: "- il " }, { kind: "math", value: "60%", latex: "60\\%" }, { kind: "text", value: " dello spostamento " }, { kind: "math", value: "d_0", latex: "d_0" },
    { kind: "text", value: " per cui si annulla l’accelerazione spettrale " }, { kind: "math", value: "a", latex: "a" },
    { kind: "text", value: " valutata su una curva di capacità in cui si considerino solamente le azioni di cui è verificata la presenza fino al collasso;" },
  ]);
  addProse(blocks, r(276, 12, 13), "list-item");
  addProse(blocks, r(276, 14, 16));
  addProse(blocks, r(276, 17, 19));
});

makeUnit("C8.7.1.2.1.7", "Verifica semplificata dello SLV con fattore di comportamento q (analisi cinematica lineare)", "C8.7.1.2.1", ["C8", "C8.7", "C8.7.1", "C8.7.1.2", "C8.7.1.2.1"], 7, (blocks) => {
  addText(blocks, r(276, 21, 25), "Questo metodo di verifica può essere utilizzato quando non viene calcolata la curva di capacità a(d), ma solo il moltiplicatore α_0 che attiva il meccanismo. Tale semplificazione può essere conveniente, in particolare, per meccanismi complessi, identificati tenendo conto anche del contributo dell’attrito e dell’interazione con altri elementi della costruzione, per i quali l’esecuzione di un’analisi cinematica non lineare risulterebbe problematica.");
  addText(blocks, r(276, 26, 28), "L’accelerazione al suolo a_{g,SLV} può essere calcolata moltiplicando per un fattore di comportamento q l’accelerazione valutata per lo SLD (a_{g,SLD}), attraverso le equazioni [C8.7.1.8] e [C7.2.8], nel caso di meccanismi locali rigidamente vincolati alla struttura principale, o le equazioni [C8.7.1.9] e [C7.2.5], nel caso di elementi liberi di vibrare.");
  addText(blocks, r(276, 29, 30), "In assenza di valutazioni più accurate, che tengano conto del tipo di meccanismo e dello spessore delle pareti, si può assumere q=2.");
  addText(blocks, r(276, 31, 32), "L’accelerazione al suolo a_{g,SLV} deve essere confrontata con l’accelerazione di riferimento al suolo a_g valutata per la probabilità di superamento dello SLV nella vita di riferimento, come definita al § 3.2 delle NTC.");
});

makeUnit("C8.7.1.2.1.8", "Verifica in spostamento allo SLV e allo SLC (analisi cinematica non lineare)", "C8.7.1.2.1", ["C8", "C8.7", "C8.7.1", "C8.7.1.2", "C8.7.1.2.1"], 8, (blocks) => {
  addProse(blocks, r(276, 34, 36));
  addFormulaRef(blocks, r(276, 37, 38), "C8.7.1.10");
  addFormulaRef(blocks, r(276, 39, 40), "C8.7.1.11");
  addProse(blocks, r(276, 41, 42));
  addText(blocks, r(276, 43, 46), "La domanda di spostamento sul meccanismo locale allo SLV corrisponde al valore massimo dello spostamento spettrale valutato nell’intervallo di periodi [T_0, T_{SLV}]. Questo criterio deve essere seguito nel caso in cui siano stati selezionati accelerogrammi di sito o sia stata svolta un’analisi di risposta sismica locale (spettro di spostamento non strettamente crescente con il periodo T anche per bassi periodi), in quanto i picchi dello spettro sono spesso associati a impulsi particolarmente pericolosi.");
  addText(blocks, r(276, 47, 49), "Nel caso in cui il meccanismo locale che si sta verificando sia collocato a livello del suolo e la verifica sia effettuata tramite gli spettri di norma, la domanda di spostamento è quella calcolata attraverso lo spettro di risposta elastico in spostamento S_{De}(T) (§ 3.2.3.2.3 delle NTC) per i valori caratteristici del periodo corrispondenti ai due stati limite.");
  addText(blocks, r(276, 50, 54), "Per meccanismi ad una quota z dell’edificio è necessario fare riferimento allo spettro in accelerazione alla quota z (v. formula [C7.2.5]), trasformato in spettro in spostamento sempre alla quota z moltiplicandolo per T²/4π². Per la verifica a stato limite ultimo dei meccanismi locali, considerato che i periodi di interesse dello spettro sono in genere lunghi, è sufficiente considerare il solo primo modo di vibrazione, o comunque il primo tra quelli caratterizzati da spostamenti significativi nella zona dove si sviluppa il meccanismo locale.");
  addText(blocks, r(276, 55, 56), "Considerato che la domanda di spostamento deve essere valutata, per quanto sopra detto, su uno spettro di spostamento non decrescente con il periodo T, è possibile riferirsi alle seguenti espressioni per lo SLV:");
  addFormulaRef(blocks, r(277, 3, 12), "C8.7.1.12");
  addText(blocks, r(277, 13, 18), "Dalla espressione [C8.7.1.12] è possibile calcolare l’accelerazione al suolo a_{g,SLV} (nel caso in cui questa risulti minore di a_{g,SLD} calcolata al § C8.7.1.2.1.5, si assume quest’ultima anche per lo SLV). Per la verifica, a_{g,SLV} deve essere confrontata con l’accelerazione di riferimento al suolo a_g valutata per la probabilità di superamento dello SLV nella vita di riferimento, come definita al § 3.2 delle NTC. Un’espressione analoga alla [C8.7.1.12] consente di valutare la domanda di spostamento allo SLC e i corrispondenti valori di a_{g,SLC}.");
  addText(blocks, r(277, 19, 25), "Nel calcolo della domanda di spostamento allo stato limite ultimo è importante considerare l’effetto della dissipazione, sia nel calcolo dello spettro in quota (non linearità della struttura principale), sia nella valutazione della domanda di spostamento (non linearità del meccanismo locale). In assenza di valutazioni più accurate, lo smorzamento viscoso equivalente ξ del meccanismo locale può essere assunto complessivamente pari all’8% per lo SLV e al 10% per lo SLC. È inoltre opportuno che lo smorzamento ξ_1 e il periodo T_1 dell’edificio siano valutati considerando il livello di non linearità raggiunto dalla struttura principale in corrispondenza dei valori a_{g,SLV} e a_{g,SLC}.");
}, [F10, F11, F12]);

makeUnit("C8.7.1.2.1.9", "Verifica con analisi dinamica non lineare dello SLV e SLC", "C8.7.1.2.1", ["C8", "C8.7", "C8.7.1", "C8.7.1.2", "C8.7.1.2.1"], 9, (blocks) => {
  addProse(blocks, r(277, 27, 29));
  addProse(blocks, r(277, 30, 39));
  addProse(blocks, r(277, 40, 47));
  addProse(blocks, r(277, 48));
  addProse(blocks, r(277, 49, 50), "list-item");
  addProse(blocks, r(277, 51, 52), "list-item");
  addProse(blocks, r(277, 53, 54), "list-item");
  addProse(blocks, r(277, 55, 57));
  addText(blocks, r(277, 58, 62), "In assenza di valutazioni più accurate, gli stati limite ultimi SLV e SLC si intendono rispettati a condizione che la soglia di spostamento d_0 rappresentativa della crisi della struttura non venga superata per alcuna delle analisi dinamiche effettuate e che la media degli spostamenti massimi ottenuti, per i diversi segnali accelerometrici utilizzati, attraverso l’integrazione delle equazioni del moto non ecceda, per ciascuno dei due stati limite, la rispettiva soglia di spostamento d_{SLV} o d_{SLC} così come definita al § C8.7.1.2.1.6.");
});

makeUnit("C8.7.1.3", "MECCANISMI GLOBALI METODI DI ANALISI DELLA RISPOSTA SISMICA E CRITERI DI VERIFICA", "C8.7.1", ["C8", "C8.7", "C8.7.1"], 3, () => {});

makeUnit("C8.7.1.3.1", "Edifici singoli", "C8.7.1.3", ["C8", "C8.7", "C8.7.1", "C8.7.1.3"], 1, (blocks) => {
  addProse(blocks, r(278, 3, 7));
  addProse(blocks, r(278, 8, 9));
  addProse(blocks, r(278, 10, 13));
  addProse(blocks, r(278, 14, 15));
  addProse(blocks, r(278, 16, 18));
  addProse(blocks, r(278, 19, 22));
  addProse(blocks, r(278, 23, 25));
  addText(blocks, r(278, 26, 32), "Nel caso invece di diaframmi dotati di rigidezza non trascurabile, l’analisi della risposta sismica globale può essere effettuata con uno dei metodi di cui al § 7.3, con le precisazioni e le restrizioni indicate al § 7.8.1.5, delle NTC. In particolare è possibile utilizzare l’analisi statica non lineare assegnando, come distribuzioni principale e secondaria, rispettivamente, la prima distribuzione, sia del Gruppo 1, sia del Gruppo 2, indipendentemente dalla percentuale di massa partecipante sul primo modo. Nel caso di diaframmi di rigidezza finita, non potendosi definire lo spostamento del centro di massa dell’ultimo livello (v. § 7.3.4.2 delle NTC), lo spostamento d_C da assumersi per la curva di capacità può essere coerentemente assunto come lo spostamento medio tra quello delle diverse pareti, pesato con le corrispondenti masse sismiche.");
  addProse(blocks, r(278, 33, 34));
  addProse(blocks, r(278, 35, 36), "list-item");
  addProse(blocks, r(278, 37, 39), "list-item");
  addProse(blocks, r(278, 40, 41));
  addProse(blocks, r(278, 42, 45));
  addProse(blocks, r(278, 46), "list-item");
  addProse(blocks, r(278, 47, 50), "list-item");
  addText(blocks, r(278, 51), "SLV: lo spostamento ultimo a SLV, sulla bilineare equivalente sopra definita, è pari a 3/4 dello spostamento a SLC");
  addProse(blocks, r(278, 52));
  addProse(blocks, r(278, 53), "list-item");
  addText(blocks, r(278, 54, 56), "- quello corrispondente al raggiungimento della resistenza massima a taglio in tutti i maschi murari verticali in un qualunque livello in una qualunque parete ritenuta significativa ai fini dell’uso della costruzione (e comunque non prima dello spostamento per il quale si raggiunge un taglio di base pari a 3/4 del taglio di base massimo).", "list-item");
  addText(blocks, r(278, 57), "SLO: lo spostamento corrispondente è pari a 2/3 di quello allo SLD.");
  addText(blocks, r(279, 3, 5), "La domanda di spostamento, da confrontarsi con le suddette capacità di spostamento ai diversi stati limite, può essere valutata sul sistema bilineare equivalente attraverso le espressioni indicate nel § C.7.3.4.2, valide sia per la risposta in campo non lineare (SLV, con q*≤3, e SLC, con q*≤4) che in campo lineare equivalente (SLO e SLD).");
  addProse(blocks, r(279, 6, 12));
});

makeUnit("C8.7.1.3.1.1", "Pareti murarie", "C8.7.1.3.1", ["C8", "C8.7", "C8.7.1", "C8.7.1.3", "C8.7.1.3.1"], 1, (blocks) => {
  addProse(blocks, r(279, 14, 17));
  addProse(blocks, r(279, 18, 23));
  addProse(blocks, r(279, 24));
  addProse(blocks, r(279, 25), "list-item");
  addProse(blocks, r(279, 26), "list-item");
  addProse(blocks, r(279, 27), "list-item");
  addProse(blocks, r(279, 28, 29));
  addFormulaRef(blocks, r(279, 30, 38), "C8.7.1.13");
  addText(blocks, r(279, 39, 43), "dove (assumendo nel piano della parete una terna destrorsa): φ_i e φ_j sono le rotazioni, u_j e u_i sono gli spostamenti orizzontali, u_0 è lo spostamento orizzontale del punto di flesso, h_i e h_j sono le luci di taglio (essendo h=h_i+h_j l’altezza dell’elemento). Lo spostamento ultimo a SLC è definito in corrispondenza di una rotazione della corda pari a 0,01.");
  addProse(blocks, r(279, 44, 47));
  addFormulaRef(blocks, r(279, 48, 49), "C8.7.1.14");
  addProse(blocks, r(279, 50, 51));
  addProse(blocks, r(279, 52));
  addProse(blocks, r(279, 53));
  addProse(blocks, r(279, 54), "list-item");
  addProse(blocks, r(279, 55), "list-item");
  addProse(blocks, r(279, 56, 60));
}, [F13, F14]);

const formulas = [
  { id: F8, unitId: unitId("C8.7.1.2.1.5"), officialNumber: "C8.7.1.8", pdfPage: 275, latex: "a_{Z,SLD}=\\frac{\\alpha_0g}{e^*FC}" },
  { id: F9, unitId: unitId("C8.7.1.2.1.5"), officialNumber: "C8.7.1.9", pdfPage: 275, latex: "S_{eZ,SLD}(T_0)=\\frac{a_y}{FC}\\simeq\\frac{\\alpha_0g}{e^*FC}" },
  { id: F10, unitId: unitId("C8.7.1.2.1.8"), officialNumber: "C8.7.1.10", pdfPage: 276, latex: "T_{SLV}=1{,}68\\pi\\sqrt{\\frac{d_{SLV}}{a(d_{SLV})}}" },
  { id: F11, unitId: unitId("C8.7.1.2.1.8"), officialNumber: "C8.7.1.11", pdfPage: 276, latex: "T_{SLC}=1{,}56\\pi\\sqrt{\\frac{d_{SLC}}{a(d_{SLC})}}" },
  { id: F12, unitId: unitId("C8.7.1.2.1.8"), officialNumber: "C8.7.1.12", pdfPage: 277, latex: "d_{SLV}=S_{eZ}(T_{SLV},\\xi,z)\\frac{T_{SLV}^{2}}{4\\pi^{2}}\\left(\\ge S_{eZ}(T_1,\\xi,z)\\frac{b^{2}T_1^{2}}{4\\pi^{2}}\\quad\\mathrm{per}\\ T_{SLV}>bT_1\\right)" },
  { id: F13, unitId: unitId("C8.7.1.3.1.1"), officialNumber: "C8.7.1.13", pdfPage: 279, latex: "\\theta_i=\\left|\\varphi_i-\\frac{u_i-u_0}{h_i}\\right|,\\quad\\theta_j=\\left|\\varphi_j-\\frac{u_0-u_j}{h_j}\\right|" },
  { id: F14, unitId: unitId("C8.7.1.3.1.1"), officialNumber: "C8.7.1.14", pdfPage: 279, latex: "f_{v,lim}=\\frac{0.065f_b}{0.7}" },
];
mkdirSync(UNITS, { recursive: true }); mkdirSync(ASSETS, { recursive: true });
writeFileSync(join(ASSETS, "C8.7-step1b.json"), JSON.stringify({
  $schema: "urn:structural-codes:schema:asset-manifest:v2", schemaVersion: "2.0.0-alpha.1", recordType: "asset-manifest",
  document: "circ2019", section: "C8.7-step1b", sourceId: SOURCE_ID, status: "transcribed-unreviewed",
  formulas, tables: [], figures: [],
}, null, 2) + "\n", "utf8");
