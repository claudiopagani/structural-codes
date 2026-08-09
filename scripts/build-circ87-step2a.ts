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
function printedPage(page: number): string { return String(page - 4); }
const mathMap: Record<string, string> = {
  "f_{ftd}": "f_{ftd}", "f_{btd}": "f_{btd}", "f_{v0d}": "f_{v0d}", "f_{td}": "f_{td}", "f_{v0}": "f_{v0}", "f_{v,lim}": "f_{v,lim}",
  "V_t": "V_t", "V_{t,lim}": "V_{t,lim}", "V_R": "V_R", "V_w": "V_w", "V_{bu}": "V_{bu}", "d_{max}": "d_{max}", "d_{cu}": "d_{cu}",
  "d_0": "d_0", "σ_0": "\\sigma_0", "σ_y": "\\sigma_y", "τ_0": "\\tau_0", "τ_{0d}": "\\tau_{0d}", "μ": "\\mu", "φ": "\\varphi", "ρ": "\\rho", "ω": "\\omega", "ν": "\\nu",
  "FC": "\\mathrm{FC}", "SLC": "\\mathrm{SLC}", "SLV": "\\mathrm{SLV}", "NTC": "\\mathrm{NTC}", "q": "q", "N": "N", "M": "M", "P": "P", "L": "L", "I": "I", "E": "E", "W": "W", "T": "T",
};
function escapeRegExp(value: string): string { return value.replace(/[.*+?^$()|[\]\\]/gu, "\\$&").replace(/[{}]/gu, "\\$&"); }
const fixedMathTokens = Object.keys(mathMap).filter((token) => token.length > 1).sort((a, b) => b.length - a.length).map(escapeRegExp);
const singleMathTokens = ["σ", "τ", "μ", "φ", "ρ", "ω", "ν"];
const inlinePattern = new RegExp(fixedMathTokens.concat(singleMathTokens.map(escapeRegExp)).concat(["(?<![\\p{L}\\p{N}_])E(?![\\p{L}\\p{N}_])", "(?<![\\p{L}\\p{N}_])L(?![\\p{L}\\p{N}_])", "(?<![\\p{L}\\p{N}_])I(?![\\p{L}\\p{N}_])", "(?<![\\p{L}\\p{N}_])N(?![\\p{L}\\p{N}_])", "(?<![\\p{L}\\p{N}_])M(?![\\p{L}\\p{N}_])", "(?<![\\p{L}\\p{N}_])T(?![\\p{L}\\p{N}_])"]).join("|"), "gu");
function inline(text: string): Inline[] | undefined {
  const result: Inline[] = [];
  let last = 0;
  for (const match of text.matchAll(inlinePattern)) {
    const start = match.index ?? 0;
    const value = match[0];
    if (start > last) result.push({ kind: "text", value: text.slice(last, start) });
    result.push({ kind: "math", value, latex: mathMap[value] ?? value });
    last = start + value.length;
  }
  if (last < text.length) result.push({ kind: "text", value: text.slice(last) });
  return result.some((part) => part.kind === "math") ? result : undefined;
}
function transformations(rawText: string, normalized: string, note?: string) {
  return [
    ...(rawText.includes("\n") ? [{ operation: "join-line-wrap", ruleVersion: VERSION, note: "Rimossi gli a capo introdotti dall’impaginazione, conservando il capoverso." }] : []),
    ...(/[\u0000-\u001f\u007f]/u.test(rawText) ? [{ operation: "remove-control-character", ruleVersion: VERSION, note: "Rimossi i caratteri di controllo introdotti dall’estrazione del PDF." }] : []),
    ...(rawText !== normalized ? [{ operation: "manual-correction", ruleVersion: VERSION, note: "Ripristinati accenti, apostrofi, numerazione, glifi matematici e punteggiatura verificati sul render ufficiale." }] : []),
    ...(note ? [{ operation: "manual-correction", ruleVersion: VERSION, note }] : []),
    { operation: "unicode-nfc", ruleVersion: VERSION, note: "Testo normalizzato in Unicode NFC." },
  ];
}
function evidence(ranges: Range[], normalized: string, method: "pdf-text" | "manual-transcription" = "manual-transcription") {
  const first = ranges[0];
  if (!first) throw new Error("Evidence senza pagina");
  const rawText = raw(ranges);
  return { sourceId: SOURCE_ID, pdfPage: first.page, printedPage: printedPage(first.page), region: null, extraction: { method, tool: method === "manual-transcription" ? "codex-render-transcription" : "pdfjs-dist", toolVersion: VERSION }, transformations: transformations(rawText, normalized), rawSha256: sha256(rawText), normalizedSha256: sha256(normalized) };
}
function manualEvidence(page: number, normalized: string) {
  return { sourceId: SOURCE_ID, pdfPage: page, printedPage: printedPage(page), region: null, extraction: { method: "manual-transcription", tool: "codex-render-transcription", toolVersion: VERSION }, transformations: transformations(normalized, normalized, "La pagina PDF è rasterizzata: il testo è stato trascritto direttamente dal render ufficiale ad alta scala."), rawSha256: sha256(normalized), normalizedSha256: sha256(normalized) };
}
function unitId(official: string): string { return "urn:structural-codes:it:unit:circ2019:" + official.toLowerCase(); }
function formulaId(official: string): string { return "urn:structural-codes:it:asset:formula:circ2019:" + official.toLowerCase(); }
function relation(official: string, headingBlockId: string) {
  const parts = official.slice(1).toLowerCase().split(".");
  while (parts.length > 0 && !existsSync(join(ROOT, "corpus", "units", "ntc2018", parts.join(".") + ".json"))) parts.pop();
  return [{ relationId: unitId(official) + "#relation-001", type: "clarifies", targetUnitId: "urn:structural-codes:it:unit:ntc2018:" + parts.join("."), basis: "editorial", evidenceBlockIds: [headingBlockId], rationale: "Corrispondenza proposta tra numerazione omologa della Circolare e delle NTC; richiede conferma umana sul contenuto completo.", review: { status: "proposed", reviewedBy: null, reviewedAt: null } }];
}
let currentUnit = "";
function addBlock(blocks: Block[], normalized: string, kind: "heading" | "paragraph" | "list-item", ev: unknown, rawText = normalized) {
  const blockId = currentUnit + "#block-" + (blocks.length === 0 ? "heading" : String(blocks.length).padStart(3, "0"));
  const text: Record<string, unknown> = { raw: rawText, normalized, normalizationVersion: VERSION };
  const segments = inline(normalized); if (segments) text.inline = segments;
  blocks.push({ blockId, kind, origin: "official", text, evidence: ev }); return blockId;
}
function addText(blocks: Block[], ranges: Range[], normalized: string, kind: "heading" | "paragraph" | "list-item" = "paragraph") {
  return addBlock(blocks, normalized, kind, evidence(ranges, normalized), raw(ranges));
}
function addProse(blocks: Block[], ranges: Range[], kind: "paragraph" | "list-item" = "paragraph") { return addText(blocks, ranges, clean(ranges), kind); }
function addManual(blocks: Block[], page: number, normalized: string, kind: "heading" | "paragraph" | "list-item" = "paragraph") { return addBlock(blocks, normalized, kind, manualEvidence(page, normalized), normalized); }
function addFormulaRef(blocks: Block[], ranges: Range[], official: string) {
  const blockId = currentUnit + "#block-" + String(blocks.length).padStart(3, "0");
  blocks.push({ blockId, kind: "formula-ref", origin: "official", assetId: formulaId(official), evidence: evidence(ranges, "[" + official + "]", "pdf-text") }); return formulaId(official);
}
function addFormulaRefManual(blocks: Block[], page: number, official: string) {
  const blockId = currentUnit + "#block-" + String(blocks.length).padStart(3, "0");
  blocks.push({ blockId, kind: "formula-ref", origin: "official", assetId: formulaId(official), evidence: manualEvidence(page, "[" + official + "]") }); return formulaId(official);
}
const r = (page: number, start: number, end = start): Range[] => [{ page, start, end }];
const headingRanges: Record<string, Range[]> = {
  "C8.7.1.3.1.1": r(279, 13), "C8.7.1.3.1.2": r(281, 27), "C8.7.1.3.2": r(281, 34), "C8.7.1.3.3": r(282, 45), "C8.7.1.4": r(283, 9),
  "C8.7.2": r(283, 25), "C8.7.2.1": r(283, 32), "C8.7.2.1.1": r(283, 33), "C8.7.2.1.2": r(283, 39), "C8.7.2.2": r(283, 42),
  "C8.7.2.2.1": r(284, 8), "C8.7.2.2.2": r(284, 34), "C8.7.2.2.3": r(284, 39),
};
const manualHeadings = new Set(["C8.7.1.3.1.2", "C8.7.1.3.2"]);
function makeUnit(official: string, title: string, parent: string, ancestors: string[], position: number, build: (blocks: Block[]) => void, assets: string[] = []) {
  currentUnit = unitId(official); const blocks: Block[] = [];
  const heading = official + " " + title;
  const headingBlockId = manualHeadings.has(official) ? addManual(blocks, 281, heading, "heading") : addText(blocks, headingRanges[official]!, heading, "heading");
  build(blocks);
  const record = { $schema: "urn:structural-codes:schema:canonical-unit:v2", schemaVersion: "2.0.0-alpha.2", recordType: "canonical-unit", id: currentUnit, workId: WORK_ID, expressionId: EXPRESSION_ID, kind: "paragraph", numbering: { official, sortKey: official.slice(1).split(".").map((x) => x.padStart(3, "0")).join(".") }, title, titleBlockId: headingBlockId, hierarchy: { parentId: unitId(parent), ancestorIds: ancestors.map(unitId), position }, validity: { from: null, to: null, status: "unknown", asOf: TODAY }, blocks, citations: [], relations: relation(official, headingBlockId), assets: { formulaIds: assets, tableIds: [], figureIds: [] }, workflow: { status: "extracted", createdBy: { actorId: "generator:circ87:step2a", kind: "script", toolVersion: VERSION }, createdAt: CREATED_AT, reviews: [], openIssues: [{ issueId: "circ2019-" + official.toLowerCase() + "-source-review", type: "normalization-review", severity: "blocking", note: "Trascrizione confrontata con il render ufficiale; resta obbligatoria la revisione umana indipendente." }, { issueId: "circ2019-" + official.toLowerCase() + "-relation", type: "relation-review", severity: "blocking", note: "Il collegamento Circolare-NTC per numerazione omologa richiede conferma umana." }, ...(assets.length ? [{ issueId: "circ2019-" + official.toLowerCase() + "-formula-review", type: "asset-review", severity: "blocking", note: "Le formule devono essere sottoposte a verifica umana, glifo per glifo, sul render ufficiale." }] : [])] } };
  writeFileSync(join(UNITS, official.toLowerCase() + ".json"), JSON.stringify(record, null, 2) + "\n", "utf8");
}

const F13 = formulaId("C8.7.1.13"); const F14 = formulaId("C8.7.1.14"); const F15 = formulaId("C8.7.1.15"); const F16 = formulaId("C8.7.1.16"); const F17 = formulaId("C8.7.1.17"); const F18 = formulaId("C8.7.1.18");

makeUnit("C8.7.1.3.1.1", "Pareti murarie", "C8.7.1.3.1", ["C8", "C8.7", "C8.7.1", "C8.7.1.3", "C8.7.1.3.1"], 1, (blocks) => {
  addProse(blocks, r(279, 14, 17)); addProse(blocks, r(279, 18, 23)); addProse(blocks, r(279, 24));
  addProse(blocks, r(279, 25), "list-item"); addProse(blocks, r(279, 26), "list-item"); addProse(blocks, r(279, 27), "list-item"); addProse(blocks, r(279, 28, 29));
  addFormulaRef(blocks, r(279, 30, 38), "C8.7.1.13");
  addText(blocks, r(279, 39, 43), "dove (assumendo nel piano della parete una terna destrorsa): φ_i e φ_j sono le rotazioni, u_j e u_i sono gli spostamenti orizzontali, u_0 è lo spostamento orizzontale del punto di flesso, h_i e h_j sono le luci di taglio (essendo h=h_i+h_j l’altezza dell’elemento). Lo spostamento ultimo a SLC è definito in corrispondenza di una rotazione della corda pari a 0,01.");
  addProse(blocks, r(279, 44, 47)); addFormulaRef(blocks, r(279, 48, 49), "C8.7.1.14"); addProse(blocks, r(279, 50, 51)); addProse(blocks, r(279, 52)); addProse(blocks, r(279, 53)); addProse(blocks, r(279, 54), "list-item"); addProse(blocks, r(279, 55), "list-item"); addProse(blocks, r(279, 56, 60));
  addText(blocks, r(280, 3, 6), "Diversamente dal caso dei maschi, il dominio di resistenza a pressoflessione per le fasce può essere determinato tenendo conto della resistenza a trazione (f_{ftd}) che si genera nelle sezioni di estremità per effetto dell’ingranamento con le porzioni di muratura adiacenti. I meccanismi di rottura possono coinvolgere la resistenza per trazione dei blocchi f_{btd} o avvenire per scorrimento lungo i giunti orizzontali; la resistenza a trazione orizzontale è quindi data dall’espressione:");
  addFormulaRef(blocks, r(280, 7, 10), "C8.7.1.15");
  addText(blocks, r(280, 11, 16), "dove σ_y è la tensione normale media agente sui giunti orizzontali nella sezione d’estremità; f_{v0d} è la resistenza a taglio della muratura in assenza di tensioni normali (che cautelativamente in questo contesto può essere trascurata); μ è il coefficiente d’attrito locale del giunto; φ è il coefficiente di ingranamento murario, già definito nella equazione [C8.7.1.2].");
  addText(blocks, r(280, 17, 23), "In assenza di valutazioni più accurate, σ_y può essere stimata pari a metà della tensione normale media σ_0 agente nei maschi adiacenti. Stimata la resistenza a trazione della fascia f_{ft}, il dominio di resistenza a pressoflessione M-N può essere calcolato ipotizzando la conservazione della sezione piana e un legame tensione-deformazione elastoplastico a compressione ed elasto-fragile a trazione, nel caso di rottura dei blocchi, elastoplastico, eventualmente a duttilità controllata, nel caso di rottura per scorrimento dei giunti. Per la resistenza a compressione occorre valutare quella in direzione orizzontale f_h, usualmente inferiore a quella in direzione verticale. Considerato che per le fasce il modello globale non è usualmente in grado di valutare in modo affidabile l’azione assiale orizzontale, la resistenza per pressoflessione può essere calcolata in via cautelativa assumendo N=0.");
  addText(blocks, r(280, 24, 26), "Lo spostamento ultimo a SLC è valutato calcolando la deformazione angolare nelle due sezioni di estremità del pannello secondo la [C8.7.1.13], eventualmente assumendo che il punto di flesso sia a metà dell’elemento; la soglia limite è pari a 0,02, in presenza di elemento orizzontale resistente a trazione accoppiato alla fascia, 0,015 negli altri casi.");
  addProse(blocks, r(280, 27));
  addProse(blocks, r(280, 28), "list-item"); addProse(blocks, r(280, 29, 31), "list-item");
  addText(blocks, r(280, 32, 34), "La Tabella C8.5.I, fornendo valori di riferimento per τ_0 e f_{v0}, suggerisce quale criterio adottare in funzione della tipologia muraria; per la tipologia “muratura in mattoni pieni e malta di calce” è possibile utilizzare, sulla base delle caratteristiche specifiche rilevate dal progettista, alternativamente uno dei due metodi.");
  addText(blocks, r(280, 35, 36), "Nel caso di muratura irregolare, la resistenza a taglio di calcolo per azioni nel piano del pannello può essere valutata con la relazione seguente:");
  addFormulaRef(blocks, r(280, 37), "C8.7.1.16");
  addText(blocks, r(280, 38), "dove:");
  addText(blocks, r(280, 39), "l è la lunghezza del pannello;"); addText(blocks, r(280, 40), "t è lo spessore del pannello;");
  addText(blocks, r(280, 41, 43), "σ_0 è la tensione normale media, riferita all’area totale della sezione (= P/lt, con P forza assiale agente, positiva se di compressione);");
  addText(blocks, r(280, 44, 49), "f_{td} e τ_{0d} sono, rispettivamente, i valori di calcolo della resistenza a trazione per fessurazione diagonale e della corrispondente resistenza a taglio di riferimento della muratura (f_t = 1,5τ_{0d}); nel caso in cui tale parametro sia desunto da prove di compressione diagonale, la resistenza a trazione per fessurazione diagonale f_t si assume pari al carico diagonale di rottura diviso per due volte la sezione media del pannello sperimentato valutata come t(l+h)/2, con t, l e h rispettivamente spessore, base e altezza del pannello.");
  addText(blocks, r(280, 50, 51), "b è un coefficiente correttivo legato alla distribuzione degli sforzi sulla sezione, dipendente dalla snellezza della parete. Si può assumere b = h/l, comunque non superiore a 1,5 e non inferiore a 1, dove h è l’altezza del pannello.");
  addText(blocks, r(280, 52, 54), "Nel caso dei maschi la soglia limite della deformazione angolare a SLC è pari a 0,005 e, in assenza di più precise formulazioni, la deformazione angolare rappresentativa di un pannello soggetto a taglio per fessurazione diagonale può essere valutata a partire dai valori della rotazione della corda nei due estremi i e j (v. formula [C8.7.1.13]).");
  addText(blocks, r(280, 55, 59), "Nel caso delle fasce di piano, la resistenza a taglio può essere valutata con la formula [C8.7.1.16], nella quale la tensione media di compressione σ_0, che può essere usualmente trascurata, è la maggiore tra quella orizzontale, se nota in maniera affidabile dal modello di calcolo, e quella verticale, valutabile a partire dai carichi eventualmente trasmessi dai solai e dalla diffusione delle tensioni verticali nei maschi murari adiacenti.");
  addText(blocks, r(280, 60, 61), "Raggiunto, allo SLC, il valore limite della deformazione angolare sopra indicato per i maschi, la presenza di un architrave efficace consente di mantenere una resistenza a taglio residua anche per valori di deformazione angolare superiori a 0,015.");
  addProse(blocks, r(280, 62, 63));
  addManual(blocks, 281, "- architrave in calcestruzzo armato o in profilato d’acciaio, purché appoggiato per una significativa estensione nella muratura: 60%;", "list-item");
  addManual(blocks, 281, "- architrave in legno, di buone caratteristiche e ben ammorsato: 40%;", "list-item");
  addManual(blocks, 281, "- arco in muratura: 10%.", "list-item");
  addManual(blocks, 281, "Il contributo della resistenza residua può eventualmente essere messo in conto attraverso un legame costitutivo multilineare, che simula la riduzione di resistenza in corrispondenza di una deformazione angolare pari a 0,005, o ancora con un modello bilineare ma assegnando alla fascia direttamente una resistenza pari a quella residua e assumendo un valore di deformazione angolare ultimo pari a 0,015.");
  addManual(blocks, 281, "Nel caso di muratura regolare, la resistenza a taglio può essere ottenuta dalla relazione semplificata, indicata per la muratura irregolare che risulterà generalmente più cautelativa, oppure dalla relazione più completa riportata nel seguito:");
  addFormulaRefManual(blocks, 281, "C8.7.1.17");
  addManual(blocks, 281, "dove f̃_{v0d} è la resistenza equivalente a taglio della muratura e μ̃ è un coefficiente di attrito equivalente, funzione dei parametri di resistenza locale del giunto (coesione, assunta convenzionalmente pari alla resistenza a taglio della muratura in assenza di tensioni normali f_{v0}, e μ, coefficiente d’attrito) e della tessitura attraverso il coefficiente di ingranamento murario φ, definito come rapporto tra l’altezza del blocco e la lunghezza di sovrapposizione minima dei blocchi di due corsi successivi (tale parametro rappresenta la tangente dell’angolo medio di inclinazione della fessura diagonale “a scaletta” e può essere stimato sulla base del rilievo della tessitura del paramento murario).");
  addManual(blocks, 281, "In assenza di valutazioni più accurate, il coefficiente di attrito locale μ può essere assunto pari a 0,577 (corrispondente ad un angolo di attrito di 30°); ciò porta a valori del coefficiente di attrito equivalente μ̃ variabili da circa 0,4 (per murature con buona tessitura) a 0,2 (per murature con blocchi scarsamente ammorsati). Si noti, a titolo di esempio, che questo criterio di resistenza è in grado di distinguere la diversa vulnerabilità, a parità di malta e di mattoni, di un paramento costruito con mattoni disposti “per lungo” o “di lista”, in quanto presenta normalmente una diversa inclinazione della fessura a scaletta.");
  addManual(blocks, 281, "V_{t,lim} è un valore limite che può essere stimato, in via approssimata, in funzione della rottura a trazione dei blocchi f_{btd} e tenendo conto della geometria del pannello, attraverso l’espressione, ricavata per blocchi di forma standard:");
  addFormulaRefManual(blocks, 281, "C8.7.1.18");
  addManual(blocks, 281, "dove f_{btd} può essere ricavata da dati di letteratura o attraverso prove di caratterizzazione diretta in laboratorio su campioni prelevati in sito, eventualmente stimandola a partire dalla resistenza a compressione del blocco f_b, come f_{bt}=0,1f_b.");
  addManual(blocks, 281, "Lo spostamento ultimo a SLC è definito valutando la deformazione angolare rappresentativa come nel caso della rottura a taglio per trazione diagonale e assumendo per le tipologie murarie riportate in Tabella C8.5.I una soglia limite pari a 0,005. Nel caso invece di murature di tipologia moderna, ovvero costituite da blocchi forati, la soglia limite è pari a 0,004.");
  addManual(blocks, 281, "Nel caso delle fasce di piano valgono le precisazioni riportate per la rottura a taglio per trazione diagonale, relativamente alla valutazione della tensione media di compressione σ_0 e al calcolo della resistenza residua.");
}, [F13, F14, F15, F16, F17, F18]);

makeUnit("C8.7.1.3.1.2", "Solai e coperture", "C8.7.1.3.1", ["C8", "C8.7", "C8.7.1", "C8.7.1.3", "C8.7.1.3.1"], 2, (blocks) => {
  addManual(blocks, 281, "I solai possono essere considerati infinitamente rigidi e resistenti nel loro piano nei casi in cui esistano effettivi elementi strutturali atti a impedire le deformazioni, così come indicato al § 7.2.6 delle NTC, salvo valutazioni più accurate della reale situazione svolte dal progettista. Le indicazioni del § 7.2.6 costituiscono un utile riferimento comparativo ad altre tipologie al fine di decidere se attribuire al diaframma la condizione di infinita rigidezza nel proprio piano.");
  addManual(blocks, 281, "Le volte, proprio a causa delle incertezze sulla loro capacità di trasferire le sollecitazioni sismiche alle pareti, non possono essere considerate capaci di svolgere la funzione di diaframma di piano, salvo venga dimostrata e quantificata la loro capacità in tal senso.");
});

makeUnit("C8.7.1.3.2", "Edifici in aggregato", "C8.7.1.3", ["C8", "C8.7", "C8.7.1", "C8.7.1.3"], 2, (blocks) => {
  addProse(blocks, r(282, 3, 4)); addProse(blocks, r(282, 5, 6));
  addProse(blocks, r(282, 7), "list-item"); addProse(blocks, r(282, 8), "list-item"); addProse(blocks, r(282, 9), "list-item"); addProse(blocks, r(282, 10), "list-item"); addProse(blocks, r(282, 11, 12), "list-item"); addProse(blocks, r(282, 13, 14), "list-item"); addProse(blocks, r(282, 15, 16), "list-item");
  addProse(blocks, r(282, 17, 19)); addProse(blocks, r(282, 20, 22)); addProse(blocks, r(282, 23, 25)); addProse(blocks, r(282, 26, 28)); addProse(blocks, r(282, 29, 31)); addProse(blocks, r(282, 32, 37)); addProse(blocks, r(282, 38, 44));
});

makeUnit("C8.7.1.3.3", "Edifici semplici", "C8.7.1.3", ["C8", "C8.7", "C8.7.1", "C8.7.1.3"], 3, (blocks) => {
  addProse(blocks, r(282, 46, 49));
  addProse(blocks, r(282, 50, 51), "list-item"); addProse(blocks, r(282, 52), "list-item"); addProse(blocks, r(282, 53, 55), "list-item"); addProse(blocks, r(282, 56), "list-item"); addProse(blocks, r(283, 3, 4), "list-item"); addProse(blocks, r(283, 5, 6), "list-item");
  addProse(blocks, r(283, 7, 8));
});

makeUnit("C8.7.1.4", "ELEMENTI STRUTTURALI IN LEGNO", "C8.7.1", ["C8", "C8.7", "C8.7.1"], 4, (blocks) => {
  addProse(blocks, r(283, 10, 11)); addProse(blocks, r(283, 12, 15)); addProse(blocks, r(283, 16, 18)); addProse(blocks, r(283, 19, 24));
});

makeUnit("C8.7.2", "COSTRUZIONI DI CALCESTRUZZO ARMATO O DI ACCIAIO", "C8.7", ["C8", "C8.7"], 2, (blocks) => { addProse(blocks, r(283, 26, 28)); addProse(blocks, r(283, 29, 31)); });
makeUnit("C8.7.2.1", "REQUISITI DI SICUREZZA", "C8.7.2", ["C8", "C8.7", "C8.7.2"], 1, () => {});
makeUnit("C8.7.2.1.1", "Stato Limite di prevenzione del collasso (SLC)", "C8.7.2.1", ["C8", "C8.7", "C8.7.2", "C8.7.2.1"], 1, (blocks) => { addProse(blocks, r(283, 34, 36)); addProse(blocks, r(283, 37, 38)); });
makeUnit("C8.7.2.1.2", "Stati Limite di esercizio", "C8.7.2.1", ["C8", "C8.7", "C8.7.2", "C8.7.2.1"], 2, (blocks) => { addProse(blocks, r(283, 40, 41)); });
makeUnit("C8.7.2.2", "METODI DI ANALISI E CRITERI DI VERIFICA", "C8.7.2", ["C8", "C8.7", "C8.7.2"], 2, (blocks) => { addProse(blocks, r(283, 43, 46)); addProse(blocks, r(283, 47, 51)); addProse(blocks, r(283, 52, 53)); addProse(blocks, r(284, 3, 7)); });
makeUnit("C8.7.2.2.1", "Analisi statica lineare", "C8.7.2.2", ["C8", "C8.7", "C8.7.2", "C8.7.2.2"], 1, (blocks) => {
  addProse(blocks, r(284, 9, 10)); addProse(blocks, r(284, 11, 14), "list-item"); addProse(blocks, r(284, 15, 17), "list-item");
  addText(blocks, r(284, 18), "Analisi statica lineare con spettro elastico", "heading"); addProse(blocks, r(284, 19, 20));
  addText(blocks, r(284, 21), "Analisi statica lineare con fattore di comportamento q", "heading"); addProse(blocks, r(284, 22, 27)); addProse(blocks, r(284, 28, 29)); addProse(blocks, r(284, 30, 33));
});
makeUnit("C8.7.2.2.2", "Analisi dinamica modale con spettro di risposta elastico o con fattore di comportamento q", "C8.7.2.2", ["C8", "C8.7", "C8.7.2", "C8.7.2.2"], 2, (blocks) => { addProse(blocks, r(284, 35, 38)); });
makeUnit("C8.7.2.2.3", "Analisi statica non lineare", "C8.7.2.2", ["C8", "C8.7", "C8.7.2", "C8.7.2.2"], 3, (blocks) => {
  addProse(blocks, r(284, 40, 42)); addProse(blocks, r(284, 43, 45)); addProse(blocks, r(284, 46, 50)); addProse(blocks, r(284, 51)); addProse(blocks, r(284, 52)); addProse(blocks, r(284, 53, 54));
});

const formulas = [
  { id: F15, unitId: unitId("C8.7.1.3.1.1"), officialNumber: "C8.7.1.15", pdfPage: 280, latex: "f_{ftd}=\\min\\left(\\frac{f_{btd}}{2};f_{v0d}+\\frac{\\mu\\sigma_y}{\\varphi}\\right)" },
  { id: F16, unitId: unitId("C8.7.1.3.1.1"), officialNumber: "C8.7.1.16", pdfPage: 280, latex: "V_t=l\\,t\\,\\frac{1.5\\tau_{0d}}{b}\\sqrt{1+\\frac{\\sigma_0}{1.5\\tau_{0d}}}=l\\,t\\,\\frac{f_{td}}{b}\\sqrt{1+\\frac{\\sigma_0}{f_{td}}}" },
  { id: F17, unitId: unitId("C8.7.1.3.1.1"), officialNumber: "C8.7.1.17", pdfPage: 281, latex: "V_t=\\frac{lt}{b}\\left(\\widetilde{f}_{v0d}+\\widetilde{\\mu}\\sigma_0\\right)=\\frac{lt}{b}\\left(\\frac{f_{v0d}}{1+\\mu\\varphi}+\\frac{\\mu}{1+\\mu\\varphi}\\sigma_0\\right)\\le V_{t,lim}" },
  { id: F18, unitId: unitId("C8.7.1.3.1.1"), officialNumber: "C8.7.1.18", pdfPage: 281, latex: "V_{t,lim}=\\frac{ltf_{btd}}{2.3b}\\sqrt{1+\\frac{\\sigma_0}{f_{btd}}}" },
];
mkdirSync(UNITS, { recursive: true }); mkdirSync(ASSETS, { recursive: true });
writeFileSync(join(ASSETS, "C8.7-step2a.json"), JSON.stringify({ $schema: "urn:structural-codes:schema:asset-manifest:v2", schemaVersion: "2.0.0-alpha.1", recordType: "asset-manifest", document: "circ2019", section: "C8.7-step2a", sourceId: SOURCE_ID, status: "transcribed-unreviewed", formulas, tables: [], figures: [] }, null, 2) + "\n", "utf8");
