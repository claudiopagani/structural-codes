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
type Formula = { id: string; unitId: string; officialNumber: string | null; pdfPage: number; latex: string };
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
function clean(rs: Range[]): string { return raw(rs).replace(/\u0003/gu, "-").replace(/[ \t]*\n[ \t]*/gu, " ").replace(/[\u0000-\u001f\u007f]/gu, "").replace(/\s+/gu, " ").trim(); }
function printedPage(page: number): string { return String(page - 4); }
function evidence(rs: Range[], normalized: string) {
  const first = rs[0];
  if (!first) throw new Error("Evidence senza pagina");
  const rawText = raw(rs);
  return { sourceId: SOURCE_ID, pdfPage: first.page, printedPage: printedPage(first.page), region: null, extraction: { method: "manual-transcription", tool: "codex-render-transcription", toolVersion: VERSION }, transformations: [
    ...(rawText.includes("\n") ? [{ operation: "join-line-wrap", ruleVersion: VERSION, note: "Rimossi gli a capo introdotti dall'impaginazione, conservando il capoverso." }] : []),
    ...(/[\u0000-\u001f\u007f]/u.test(rawText) ? [{ operation: "remove-control-character", ruleVersion: VERSION, note: "Rimossi i caratteri di controllo introdotti dall'estrazione del PDF." }] : []),
    ...(rawText !== normalized ? [{ operation: "manual-correction", ruleVersion: VERSION, note: "Ricostruiti i glifi matematici e il testo verificati sul render ufficiale." }] : []),
    { operation: "unicode-nfc", ruleVersion: VERSION, note: "Testo normalizzato in Unicode NFC." },
  ], rawSha256: sha256(rawText), normalizedSha256: sha256(normalized) };
}
function unitId(official: string): string { return `urn:structural-codes:it:unit:circ2019:${official.toLowerCase()}`; }
function formulaId(official: string): string { return `urn:structural-codes:it:asset:formula:circ2019:${official.toLowerCase()}`; }
function relation(official: string, headingBlockId: string) {
  const parts = official.slice(1).toLowerCase().split(".");
  while (parts.length && !existsSync(join(ROOT, "corpus", "units", "ntc2018", `${parts.join(".")}.json`))) parts.pop();
  if (!parts.length) return [];
  return [{ relationId: unitId(official) + "#relation-001", type: "clarifies", targetUnitId: `urn:structural-codes:it:unit:ntc2018:${parts.join(".")}`, basis: "editorial", evidenceBlockIds: [headingBlockId], rationale: "Corrispondenza proposta tra numerazione omologa della Circolare e delle NTC; richiede conferma umana sul contenuto completo.", review: { status: "proposed", reviewedBy: null, reviewedAt: null } }];
}
function mathSegments(parts: Array<string | [string, string]>): Inline[] { return parts.map((part) => Array.isArray(part) ? { kind: "math", value: part[0], latex: part[1] } : { kind: "text", value: part }); }
let currentUnit = "";
function addBlock(blocks: Block[], normalized: string, kind: "heading" | "paragraph" | "list-item", ev: unknown, rawText: string, segments?: Inline[]) {
  const blockId = currentUnit + "#block-" + (blocks.length === 0 ? "heading" : String(blocks.length).padStart(3, "0"));
  const text: Record<string, unknown> = { raw: rawText, normalized, normalizationVersion: VERSION };
  if (segments) text.inline = segments;
  blocks.push({ blockId, kind, origin: "official", text, evidence: ev });
  return blockId;
}
function addText(blocks: Block[], rs: Range[], normalized: string, kind: "heading" | "paragraph" | "list-item" = "paragraph", segments?: Inline[]) { return addBlock(blocks, normalized, kind, evidence(rs, normalized), raw(rs), segments); }
function addProse(blocks: Block[], rs: Range[], kind: "paragraph" | "list-item" = "paragraph") { return addText(blocks, rs, clean(rs), kind); }
function addFormulaRef(blocks: Block[], rs: Range[], official: string) { const blockId = currentUnit + "#block-" + String(blocks.length).padStart(3, "0"); blocks.push({ blockId, kind: "formula-ref", origin: "official", assetId: formulaId(official), evidence: evidence(rs, `[${official}]`) }); return formulaId(official); }
function makeUnit(official: string, title: string, parent: string, ancestors: string[], position: number, location: [number, number], build: (blocks: Block[]) => void, formulas: string[] = []) {
  currentUnit = unitId(official);
  const blocks: Block[] = [];
  const headingBlockId = addText(blocks, [{ page: location[0], start: location[1], end: location[1] }], official + " " + title, "heading");
  build(blocks);
  const record = { $schema: "urn:structural-codes:schema:canonical-unit:v2", schemaVersion: "2.0.0-alpha.2", recordType: "canonical-unit", id: currentUnit, workId: WORK_ID, expressionId: EXPRESSION_ID, kind: "paragraph", numbering: { official, sortKey: official.slice(1).split(".").map((part) => part.padStart(3, "0")).join(".") }, title, titleBlockId: headingBlockId, hierarchy: { parentId: unitId(parent), ancestorIds: ancestors.map(unitId), position }, validity: { from: null, to: null, status: "unknown", asOf: TODAY }, blocks, citations: [], relations: relation(official, headingBlockId), assets: { formulaIds: formulas.map(formulaId), tableIds: [], figureIds: [] }, workflow: { status: "extracted", createdBy: { actorId: "generator:circ87:step3c", kind: "script", toolVersion: VERSION }, createdAt: CREATED_AT, reviews: [], openIssues: [
    { issueId: `circ2019-${official.toLowerCase()}-source-review`, type: "normalization-review", severity: "blocking", note: "Trascrizione confrontata con il render ufficiale; resta obbligatoria la revisione umana indipendente." },
    { issueId: `circ2019-${official.toLowerCase()}-relation`, type: "relation-review", severity: "blocking", note: "Il collegamento Circolare-NTC per numerazione omologa richiede conferma umana." },
    ...(formulas.length ? [{ issueId: `circ2019-${official.toLowerCase()}-formula-review`, type: "asset-review", severity: "blocking", note: "Le formule devono essere sottoposte a verifica umana, glifo per glifo, sul render ufficiale." }] : []),
  ] } };
  writeFileSync(join(UNITS, `${official.toLowerCase()}.json`), JSON.stringify(record, null, 2) + "\n", "utf8");
}
const r = (page: number, start: number, end = start): Range[] => [{ page, start, end }];
const f = (officialNumber: string | null, unit: string, page: number, latex: string): Formula => ({ id: formulaId(officialNumber ?? "C8.8.5.q"), unitId: unitId(officialNumber ? unit : "C8.8.5.3"), officialNumber, pdfPage: page, latex });
const formulas = [
  f("C8.8.5.1", "C8.8.5.3", 301, "\\begin{cases} S_{Di}(T)=S_{De}(T) & T\\ge T_C \\\\ S_{Di}(T)=\\dfrac{S_{De}(T)}{q}\\left[1+(q-1)\\dfrac{T_C}{T}\\right] & T<T_C \\end{cases}"),
  f(null, "C8.8.5.q", 301, "q=\\dfrac{mS_e(T)}{F_y}"),
  f("C8.8.5.2", "C8.8.5.4", 301, "\\theta_y(N)=\\phi_y(N)\\dfrac{L_s}{3}"),
  f("C8.8.5.3", "C8.8.5.4", 301, "\\theta_u(N)=\\theta_y(N)+[\\phi_u(N)-\\phi_y(N)]L_p\\left(1-\\dfrac{0.5L_p}{L_s}\\right)"),
  f("C8.8.5.4", "C8.8.5.4", 302, "\\theta_{SLC}=\\dfrac{1}{\\gamma_{el}}\\theta_u(N)"),
  f("C8.8.5.5", "C8.8.5.5", 302, "V_u=V_c+V_N+V_s\\quad V_c=0.8A_ck\\sqrt{f_c}\\quad V_N=N\\dfrac{h-x}{2L_s}\\quad V_s=\\dfrac{A_{sw}}{s}f_yz"),
];
mkdirSync(ASSETS, { recursive: true });
writeFileSync(join(ASSETS, "C8.8-step1.json"), JSON.stringify({ $schema: "urn:structural-codes:schema:asset-manifest:v2", schemaVersion: "2.0.0-alpha.1", recordType: "asset-manifest", document: "circ2019", section: "C8.8-step1", sourceId: SOURCE_ID, status: "transcribed-unreviewed", formulas, tables: [], figures: [] }, null, 2) + "\n", "utf8");

makeUnit("C8.8.5.3", "ANALISI NON LINEARE STATICA", "C8.8.5", ["C8", "C8.8", "C8.8.5"], 3, [300, 56], (blocks) => {
  addProse(blocks, r(300, 57, 61)); addFormulaRef(blocks, r(301, 3), "C8.8.5.1"); addText(blocks, r(301, 4), "dove:");
  addFormulaRef(blocks, r(301, 5), "C8.8.5.q");
  addText(blocks, r(301, 6), "con m = ∑ mᵢ Φᵢ e Fᵧ la massa e la resistenza dell’oscillatore equivalente.", "paragraph", mathSegments(["con ", ["m = ∑ mᵢ Φᵢ", "m=\\sum m_i\\Phi_i"], " e ", ["Fᵧ", "F_y"], " la massa e la resistenza dell’oscillatore equivalente."]));
  addProse(blocks, r(301, 7, 8)); addProse(blocks, r(301, 9)); addProse(blocks, r(301, 10, 18), "list-item"); addProse(blocks, r(301, 19, 27), "list-item");
}, ["C8.8.5.1", "C8.8.5.q"]);
makeUnit("C8.8.5.4", "VERIFICA DEI MECCANISMI DUTTILI", "C8.8.5", ["C8", "C8.8", "C8.8.5"], 4, [301, 28], (blocks) => {
  addProse(blocks, r(301, 29, 31)); addFormulaRef(blocks, r(301, 32), "C8.8.5.2"); addFormulaRef(blocks, r(301, 33), "C8.8.5.3");
  addText(blocks, r(301, 34, 44), "Nelle espressioni riportate ϕᵧ(N) e ϕᵤ(N) sono le curvature di snervamento e ultima della sezione trasversale dell’elemento, calcolate mediante una serie di analisi momento-curvatura della stessa effettuate per un numero discreto di valori dello sforzo normale N. Ad ogni livello dello sforzo normale, i valori delle curvature ϕᵧ e ϕᵤ si ottengono approssimando il diagramma M − ϕ con una curva bilineare. La curvatura ultima è quella minima tra la più piccola delle curvature che si ottengono imponendo ai lembi della sezione le deformazioni limite dei materiali, e quella per la quale il momento flettente diminuisce all’85% del valore massimo. Il calcolo delle deformazioni limite viene effettuato per tutti i materiali componenti la sezione dell’elemento adeguato, e cioè acciaio (in trazione) e calcestruzzo (in compressione) delle parti esistenti e di eventuali ampliamenti di sezione. Nel calcolo della deformazione limite del calcestruzzo occorre tenere conto dell’effettivo stato di confinamento. Il limite inferiore per l’acciaio può essere convenzionalmente assunto pari a εₛᵤ = 0.040, indipendentemente dalla qualità dell’acciaio. Le lunghezze Lₛ e Lₚ sono rispettivamente la lunghezza di taglio e quella della cerniera plastica. In assenza di più accurate determinazioni, quest’ultima può essere assunta pari a Lₚ = 0.1Lₛ.", "paragraph", mathSegments(["Nelle espressioni riportate ", ["ϕᵧ(N)", "\\phi_y(N)"], " e ", ["ϕᵤ(N)", "\\phi_u(N)"], " sono le curvature di snervamento e ultima della sezione trasversale dell’elemento, calcolate mediante una serie di analisi momento-curvatura della stessa effettuate per un numero discreto di valori dello sforzo normale ", ["N", "N"], ". Ad ogni livello dello sforzo normale, i valori delle curvature ", ["ϕᵧ", "\\phi_y"], " e ", ["ϕᵤ", "\\phi_u"], " si ottengono approssimando il diagramma ", ["M − ϕ", "M-\\phi"], " con una curva bilineare. La curvatura ultima è quella minima tra la più piccola delle curvature che si ottengono imponendo ai lembi della sezione le deformazioni limite dei materiali, e quella per la quale il momento flettente diminuisce all’85% del valore massimo. Il calcolo delle deformazioni limite viene effettuato per tutti i materiali componenti la sezione dell’elemento adeguato, e cioè acciaio (in trazione) e calcestruzzo (in compressione) delle parti esistenti e di eventuali ampliamenti di sezione. Nel calcolo della deformazione limite del calcestruzzo occorre tenere conto dell’effettivo stato di confinamento. Il limite inferiore per l’acciaio può essere convenzionalmente assunto pari a ", ["εₛᵤ = 0.040", "\\varepsilon_{su}=0.040"], ", indipendentemente dalla qualità dell’acciaio. Le lunghezze ", ["Lₛ", "L_s"], " e ", ["Lₚ", "L_p"], " sono rispettivamente la lunghezza di taglio e quella della cerniera plastica. In assenza di più accurate determinazioni, quest’ultima può essere assunta pari a ", ["Lₚ = 0.1Lₛ", "L_p=0.1L_s"], "."]));
  addProse(blocks, r(301, 45)); addFormulaRef(blocks, r(302, 3), "C8.8.5.4"); addText(blocks, r(302, 4), "con γₑₗ = 1.5. Nel caso di verifica allo SLV la capacità è pari a ¾ di quella per lo SLC.", "paragraph", mathSegments(["con ", ["γₑₗ = 1.5", "\\gamma_{el}=1.5"], ". Nel caso di verifica allo SLV la capacità è pari a ", ["¾", "\\frac{3}{4}"], " di quella per lo SLC."]));
}, ["C8.8.5.2", "C8.8.5.3", "C8.8.5.4"]);
makeUnit("C8.8.5.5", "VERIFICA DEI MECCANISMI FRAGILI", "C8.8.5", ["C8", "C8.8", "C8.8.5"], 5, [302, 5], (blocks) => {
  addProse(blocks, r(302, 6)); addProse(blocks, r(302, 7, 8), "list-item"); addProse(blocks, r(302, 9, 10), "list-item"); addProse(blocks, r(302, 11, 13)); addFormulaRef(blocks, r(302, 14), "C8.8.5.5");
  addText(blocks, r(302, 15, 18), "dove A_c, A_sw sono rispettivamente l’area della sezione di calcestruzzo interna alle staffe e quella dell’armatura trasversale, h, x e z l’altezza efficace della sezione, la profondità dell’asse neutro e il braccio delle forze interne, s il passo delle staffe. Il parametro k = k(μ_Δ) varia in generale tra 0.29 e 0.1 in funzione della duttilità in spostamento dell’elemento tra 1 e 4) e tiene conto del degrado ciclico del contributo del calcestruzzo alla resistenza a taglio.", "paragraph", mathSegments(["dove ", ["A_c", "A_c"], ", ", ["A_sw", "A_{sw}"], " sono rispettivamente l’area della sezione di calcestruzzo interna alle staffe e quella dell’armatura trasversale, ", ["h", "h"], ", ", ["x", "x"], " e ", ["z", "z"], " l’altezza efficace della sezione, la profondità dell’asse neutro e il braccio delle forze interne, ", ["s", "s"], " il passo delle staffe. Il parametro ", ["k = k(μ_Δ)", "k=k(\\mu_\\Delta)"], " varia in generale tra 0.29 e 0.1 in funzione della duttilità in spostamento dell’elemento tra 1 e 4) e tiene conto del degrado ciclico del contributo del calcestruzzo alla resistenza a taglio."]));
  addText(blocks, r(302, 19, 20), "Il valore della resistenza a taglio da impiegare nelle verifiche (SLV e SLC) è quello sopra riportato diviso per un coefficiente di sicurezza pari a γ_el = 1.25.", "paragraph", mathSegments(["Il valore della resistenza a taglio da impiegare nelle verifiche (SLV e SLC) è quello sopra riportato diviso per un coefficiente di sicurezza pari a ", ["γ_el = 1.25", "\\gamma_{el}=1.25"], "."]));
}, ["C8.8.5.5"]);
makeUnit("C8.8.6", "FONDAZIONI E SPALLE", "C8.8", ["C8", "C8.8"], 6, [302, 21], (blocks) => { addProse(blocks, r(302, 22)); });
makeUnit("C8.8.7", "CLASSIFICAZIONE DEGLI INTERVENTI", "C8.8", ["C8", "C8.8"], 7, [302, 23], (blocks) => {
  addProse(blocks, r(302, 24)); addText(blocks, r(302, 25), "Interventi di riparazione o locali", "heading"); addProse(blocks, r(302, 26, 27));
  addProse(blocks, r(302, 28, 29), "list-item"); addProse(blocks, r(302, 30, 33), "list-item"); addProse(blocks, r(302, 34, 38), "list-item"); addProse(blocks, r(302, 39, 40), "list-item");
  addText(blocks, r(302, 41), "Interventi di miglioramento", "heading"); addProse(blocks, r(302, 42)); addProse(blocks, r(302, 43), "list-item"); addProse(blocks, r(302, 44, 47), "list-item"); addProse(blocks, r(303, 3, 4), "list-item");
  addText(blocks, r(303, 5), "Interventi di adeguamento", "heading"); addProse(blocks, r(303, 6, 11)); addProse(blocks, r(303, 12, 14));
});

console.log("circ87-step3c: rebuilt C8.8.5.3-C8.8.7 and formulas");
