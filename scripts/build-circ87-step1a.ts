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
    value = readFileSync(join(EVIDENCE, "page-" + String(page).padStart(4, "0") + ".raw.txt"), "utf8")
      .replace(/\r\n/g, "\n").split("\n");
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
  return raw(ranges)
    .replace(/\u0003/gu, "-")
    .replace(/[ \t]*\n[ \t]*/gu, " ")
    .replace(/[\u0000-\u001f\u007f]/gu, "")
    .replace(/\s+/gu, " ")
    .trim();
}
function printedPage(page: number): string {
  return String(page - 4);
}

const mathMap: Record<string, string> = {
  "γ_M=2": "\\gamma_M=2",
  "γ_M": "\\gamma_M",
  "α_0": "\\alpha_0",
  "α": "\\alpha",
  "d_C": "d_C",
  "d_C0": "d_{C0}",
  "d_0": "d_0",
  "d_{SLV}": "d_{SLV}",
  "d_{SLC}": "d_{SLC}",
  "a_{g,SLV}": "a_{g,SLV}",
  "a_{g,SLC}": "a_{g,SLC}",
  "a_{g,SLD}": "a_{g,SLD}",
  "a_{z,SLD}": "a_{z,SLD}",
  "S_{eZ,SLD}": "S_{eZ,SLD}",
  "S_{De}(T)": "S_{De}(T)",
  "S_{eZ}": "S_{eZ}",
  "T_{SLV}": "T_{SLV}",
  "T_{SLC}": "T_{SLC}",
  "T_0": "T_0",
  "T_1": "T_1",
  "T_k": "T_k",
  "b_T": "b_T",
  "f_{v,lim}": "f_{v,lim}",
  "f_{v0}": "f_{v0}",
  "f_b": "f_b",
  "e*": "e^*",
  "α=0": "\\alpha=0",
  "α-d_C": "\\alpha-d_C",
  "α(d)": "\\alpha(d)",
  "n=h/h_b": "n=h/h_b",
  "φ=h_b/l": "\\varphi=h_b/l",
  "0,577": "0{,}577",
  "δ_{P_y,k}": "\\delta_{P_y,k}",
  "δ_{F,k}": "\\delta_{F,k}",
  "δ_{PQ_x,k}": "\\delta_{PQ_x,k}",
  "δ_{Cx}": "\\delta_{Cx}",
  "δ_Cx": "\\delta_{Cx}",
  "P_k": "P_k",
  "Q_k": "Q_k",
  "F_k": "F_k",
  "L_i": "L_i",
  "h_b": "h_b",
  "t_s": "t_s",
  "u_i": "u_i",
  "u_j": "u_j",
  "u_0": "u_0",
  "h_i": "h_i",
  "h_j": "h_j",
  "θ_i": "\\theta_i",
  "θ_j": "\\theta_j",
  "φ_i": "\\varphi_i",
  "φ_j": "\\varphi_j",
  "φ": "\\varphi",
  "μ": "\\mu",
  "κ": "\\kappa",
  "ξ": "\\xi",
  "ξ_1": "\\xi_1",
  "λ": "\\lambda",
  "FC": "\\mathrm{FC}",
  "SLV": "\\mathrm{SLV}",
  "SLC": "\\mathrm{SLC}",
  "SLD": "\\mathrm{SLD}",
  "SLO": "\\mathrm{SLO}",
  "q": "q",
  "N": "N",
  "m": "m",
  "n": "n",
  "G": "G",
  "W": "W",
  "w": "w",
};
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^$()|[\]\\]/gu, "\\$&").replace(/[{}]/gu, "\\$&");
}
const fixedMathTokens = Object.keys(mathMap).filter((token) => token.length > 1).sort((a, b) => b.length - a.length).map(escapeRegExp);
const singleMathTokens = ["α", "γ", "φ", "μ", "κ", "ξ", "λ"];
const inlinePattern = new RegExp(
  fixedMathTokens.concat(singleMathTokens.map(escapeRegExp)).concat([
    "(?<![\\p{L}\\p{N}_])N(?![\\p{L}\\p{N}_])",
    "(?<![\\p{L}\\p{N}_])m(?![\\p{L}\\p{N}_])",
    "(?<![\\p{L}\\p{N}_])n(?![\\p{L}\\p{N}_])",
    "(?<![\\p{L}\\p{N}_])G(?![\\p{L}\\p{N}_])",
    "(?<![\\p{L}\\p{N}_])W(?![\\p{L}\\p{N}_])",
    "(?<![\\p{L}\\p{N}_])w(?![\\p{L}\\p{N}_])",
  ]).join("|"), "gu");
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
    ...(rawText.includes("\n") ? [{
      operation: "join-line-wrap",
      ruleVersion: VERSION,
      note: "Rimossi gli a capo introdotti dall’impaginazione, conservando il capoverso.",
    }] : []),
    ...(/[\u0000-\u001f\u007f]/u.test(rawText) ? [{
      operation: "remove-control-character",
      ruleVersion: VERSION,
      note: "Rimossi i caratteri di controllo introdotti dall’estrazione del PDF.",
    }] : []),
    ...(rawText !== normalized ? [{
      operation: "manual-correction",
      ruleVersion: VERSION,
      note: "Ripristinati accenti, apostrofi, numerazione, glifi matematici e punteggiatura verificati sul render ufficiale.",
    }] : []),
    { operation: "unicode-nfc", ruleVersion: VERSION, note: "Testo normalizzato in Unicode NFC." },
  ];
}
function evidence(ranges: Range[], normalized: string, method: "pdf-text" | "manual-transcription" = "manual-transcription") {
  const first = ranges[0];
  if (!first) throw new Error("Evidence senza pagina");
  const rawText = raw(ranges);
  return {
    sourceId: SOURCE_ID,
    pdfPage: first.page,
    printedPage: printedPage(first.page),
    region: null,
    extraction: { method, tool: method === "manual-transcription" ? "codex-render-transcription" : "pdfjs-dist", toolVersion: VERSION },
    transformations: transformations(rawText, normalized),
    rawSha256: sha256(rawText),
    normalizedSha256: sha256(normalized),
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
    relationId: unitId(official) + "#relation-001",
    type: "clarifies",
    targetUnitId: "urn:structural-codes:it:unit:ntc2018:" + parts.join("."),
    basis: "editorial",
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
function addProse(blocks: Block[], ranges: Range[], kind: "paragraph" | "list-item" = "paragraph") {
  return addText(blocks, ranges, clean(ranges), kind);
}
function setLastInlineTerms(blocks: Block[], terms: Array<[string, string]>) {
  const block = blocks[blocks.length - 1];
  if (!block?.text) throw new Error("Blocco mancante per la matematica inline");
  const text = block.text as Record<string, unknown>;
  text.inline = inlineTerms(text.normalized as string, terms);
}
function addFormulaRef(blocks: Block[], ranges: Range[], official: string) {
  const id = formulaId(official);
  const blockId = currentUnit + "#block-" + String(blocks.length).padStart(3, "0");
  blocks.push({
    blockId,
    kind: "formula-ref",
    origin: "official",
    assetId: id,
    evidence: evidence(ranges, "[" + official + "]", "pdf-text"),
  });
  return id;
}
function makeUnit(official: string, title: string, parent: string, ancestors: string[], position: number, build: (blocks: Block[]) => void, formulaIds: string[] = []) {
  currentUnit = unitId(official);
  const blocks: Block[] = [];
  const headingBlockId = addText(blocks, headingRanges[official]!, official + " " + title, "heading");
  build(blocks);
  const record = {
    $schema: "urn:structural-codes:schema:canonical-unit:v2",
    schemaVersion: "2.0.0-alpha.2",
    recordType: "canonical-unit",
    id: currentUnit,
    workId: WORK_ID,
    expressionId: EXPRESSION_ID,
    kind: "paragraph",
    numbering: { official, sortKey: official.slice(1).split(".").map((x) => x.padStart(3, "0")).join(".") },
    title,
    titleBlockId: headingBlockId,
    hierarchy: { parentId: unitId(parent), ancestorIds: ancestors.map(unitId), position },
    validity: { from: null, to: null, status: "unknown", asOf: TODAY },
    blocks,
    citations: [],
    relations: relation(official, headingBlockId),
    assets: { formulaIds, tableIds: [], figureIds: [] },
    workflow: {
      status: "extracted",
      createdBy: { actorId: "generator:circ87:step1a", kind: "script", toolVersion: VERSION },
      createdAt: CREATED_AT,
      reviews: [],
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
const cross = (...ranges: Range[]): Range[] => ranges;
const headingRanges: Record<string, Range[]> = {
  "C8.7": r(269, 52),
  "C8.7.1": r(270, 10),
  "C8.7.1.1": r(271, 24),
  "C8.7.1.2": r(271, 30),
  "C8.7.1.2.1": r(271, 50),
  "C8.7.1.2.1.1": r(272, 50),
  "C8.7.1.2.1.2": r(274, 8),
  "C8.7.1.2.1.3": r(274, 20),
};
const F11 = formulaId("C8.7.1.1");
const F12 = formulaId("C8.7.1.2");
const F13 = formulaId("C8.7.1.3");
const F14 = formulaId("C8.7.1.4");
const F15 = formulaId("C8.7.1.5");
const F16 = formulaId("C8.7.1.6");
const F17 = formulaId("C8.7.1.7");

makeUnit("C8.7", "PROGETTAZIONE DEGLI INTERVENTI", "C8", ["C8"], 7, (blocks) => {
  addText(blocks, cross(r(269, 53, 55)[0]!, r(270, 3, 4)[0]!), "Il § 8.7 contiene indicazioni sia sulle modalità di verifica che sulle caratteristiche dei principali interventi da applicare agli edifici esistenti, in funzione delle specifiche tipologie costruttive, per migliorarne il comportamento strutturale e aumentarne la sicurezza. Tali indicazioni sono anche utili per la valutazione della sicurezza degli edifici nello stato di fatto.");
  addProse(blocks, r(270, 5, 7));
  addProse(blocks, r(270, 8, 9));
});

makeUnit("C8.7.1", "COSTRUZIONI DI MURATURA", "C8.7", ["C8", "C8.7"], 1, (blocks) => {
  addProse(blocks, r(270, 11, 15));
  addText(blocks, r(270, 16, 19), "Per gli edifici in muratura, le verifiche nei riguardi di tutte le azioni, ad esclusione di quelle sismiche sono eseguite utilizzando i coefficienti γ_M definiti in Tab. 4.5.II in § 4.5.6.1 delle NTC; le verifiche nei riguardi delle azioni sismiche sono eseguite utilizzando γ_M=2.");
  addProse(blocks, r(270, 20, 22));
  addProse(blocks, r(270, 23, 26));
  addProse(blocks, r(270, 27, 28));
  addProse(blocks, r(270, 29, 31));
  addProse(blocks, r(270, 32), "list-item");
  addProse(blocks, r(270, 33), "list-item");
  addProse(blocks, r(270, 34), "list-item");
  addProse(blocks, r(270, 35, 36));
  addProse(blocks, r(270, 37, 39));
  addProse(blocks, r(270, 40, 43));
  addProse(blocks, r(270, 45));
  addProse(blocks, r(270, 46, 48));
  addProse(blocks, r(270, 49, 53));
  addProse(blocks, r(270, 54, 55));
  addProse(blocks, cross(r(270, 56)[0]!, r(271, 3, 4)[0]!));
  addProse(blocks, r(271, 5, 7));
  addProse(blocks, r(271, 8));
  addProse(blocks, r(271, 9), "list-item");
  addProse(blocks, r(271, 10), "list-item");
  addProse(blocks, r(271, 11), "list-item");
  addProse(blocks, r(271, 12), "list-item");
  addProse(blocks, r(271, 13, 14), "list-item");
  addProse(blocks, r(271, 15, 16), "list-item");
  addProse(blocks, r(271, 17), "list-item");
  addProse(blocks, r(271, 18), "list-item");
  addProse(blocks, r(271, 19), "list-item");
  addProse(blocks, r(271, 20), "list-item");
  addProse(blocks, r(271, 21, 22), "list-item");
  addProse(blocks, r(271, 23), "list-item");
});

makeUnit("C8.7.1.1", "VERIFICA DELLE PARETI MURARIE ALLE AZIONI NON SISMICHE", "C8.7.1", ["C8", "C8.7", "C8.7.1"], 1, (blocks) => {
  addProse(blocks, r(271, 25, 29));
});

makeUnit("C8.7.1.2", "MECCANISMI LOCALI - METODI DI ANALISI DELLA RISPOSTA SISMICA E CRITERI DI VERIFICA", "C8.7.1", ["C8", "C8.7", "C8.7.1"], 2, (blocks) => {
  addProse(blocks, r(271, 31, 35));
  addProse(blocks, r(271, 36, 38));
  addProse(blocks, r(271, 39, 41));
  addProse(blocks, r(271, 42, 44));
  addProse(blocks, r(271, 45, 49));
});

makeUnit("C8.7.1.2.1", "Analisi dei meccanismi locali di corpo rigido", "C8.7.1.2", ["C8", "C8.7", "C8.7.1", "C8.7.1.2"], 1, (blocks) => {
  addProse(blocks, cross(r(271, 51, 55)[0]!, r(272, 3, 6)[0]!));
  addProse(blocks, r(272, 7));
  addProse(blocks, r(272, 8), "list-item");
  addProse(blocks, r(272, 9), "list-item");
  addProse(blocks, r(272, 10), "list-item");
  addProse(blocks, r(272, 11));
  addProse(blocks, r(272, 12), "list-item");
  addProse(blocks, r(272, 13), "list-item");
  addProse(blocks, r(272, 14), "list-item");
  addProse(blocks, r(272, 15, 16), "list-item");
  addProse(blocks, r(272, 17), "list-item");
  addProse(blocks, r(272, 18, 19));
  addText(blocks, r(272, 20, 22), "Nel caso di analisi statica, l’azione sismica è espressa da forze orizzontali di massa la cui intensità è rappresentata dal moltiplicatore α, pari al rapporto tra le forze orizzontali e i corrispondenti pesi delle masse presenti. La verifica può essere eseguita in termini di accelerazione (approccio cinematico lineare) o di spostamento (approccio cinematico non lineare).");
  addProse(blocks, r(272, 23));
  addProse(blocks, r(272, 24), "list-item");
  addProse(blocks, r(272, 25), "list-item");
  addProse(blocks, r(272, 26, 27), "list-item");
  addProse(blocks, r(272, 28, 29), "list-item");
  addProse(blocks, r(272, 30, 31), "list-item");
  addProse(blocks, r(272, 32, 35));
  addText(blocks, r(272, 36, 41), "L’approccio cinematico non lineare richiede la determinazione dell’azione orizzontale che la struttura è progressivamente in grado di sopportare all’evolversi del meccanismo. La curva che ne rappresenta l’andamento esprime il valore del moltiplicatore α in funzione dello spostamento d_C di un punto di riferimento del sistema, e deve essere tracciata fino all’annullamento di ogni capacità di sopportare azioni orizzontali (α=0).");
  addProse(blocks, r(272, 42, 44));
  addProse(blocks, r(272, 45, 49));
});

makeUnit("C8.7.1.2.1.1", "Analisi con approccio cinematico lineare", "C8.7.1.2.1", ["C8", "C8.7", "C8.7.1", "C8.7.1.2", "C8.7.1.2.1"], 1, (blocks) => {
  addText(blocks, r(272, 51, 54), "L’analisi con approccio cinematico lineare (o cinematica lineare) richiede il calcolo del solo moltiplicatore di attivazione del meccanismo α_0 e può essere utilizzata per eseguire sia la verifica allo Stato Limite di Danno (attivazione del meccanismo locale) sia quella allo SLV, in quest’ultimo caso attraverso il metodo semplificato del fattore di comportamento q.");
  addText(blocks, r(272, 55, 62), "A titolo indicativo, è necessario individuare preliminarmente l’entità ed il punto di applicazione dei pesi propri e di quelli portati da ciascun blocco o elemento della catena cinematica, l’entità delle forze esterne applicate e attritive, nonché di quelle interne agenti negli elementi elastici. L’azione sismica può essere rappresentata da un sistema di forze orizzontali, proporzionali ai pesi attraverso un coefficiente α. Nel calcolo dell’azione sismica è opportuno che siano considerate anche le forze orizzontali indotte dalle eventuali masse che non gravano direttamente sui blocchi, ma la cui azione sismica inerziale andrebbe ad agire sui blocchi del meccanismo (ad esempio, un solaio o una copertura gravano sull’elemento della catena cinematica solo parzialmente ma, se non trattenuti all’altra estremità, possono esercitare un’azione sismica orizzontale proporzionale all’intera massa).");
  addProse(blocks, r(273, 3, 5));
  addFormulaRef(blocks, r(273, 6, 13), "C8.7.1.1");
  addText(blocks, r(273, 14), "dove:");
  addText(blocks, r(273, 15), "N è il numero dei blocchi di cui è costituita la catena cinematica;");
  addText(blocks, r(273, 16), "m è il numero di forze esterne, assunte indipendenti dall’azione sismica, applicate ai diversi blocchi;");
  addText(blocks, r(273, 17, 18), "P_k è la risultante delle forze peso applicate al k-esimo blocco (peso proprio del blocco, applicato nel suo baricentro, sommato agli altri pesi portati);");
  addText(blocks, r(273, 19, 20), "Q_k è la risultante delle forze peso non gravanti sul k-esimo blocco ma la cui massa genera su di esso una forza sismica orizzontale, in quanto non efficacemente trasmessa ad altre parti dell’edificio;");
  addText(blocks, r(273, 21, 23), "F_k è la generica forza esterna applicata ad uno dei blocchi; tali forze possono favorire l’attivazione del meccanismo (ad es. spinte di volte) o ostacolarlo (ad es. archi di contrasto, ovvero forze attritive che si sviluppano in presenza di parti della costruzione non coinvolte nel meccanismo);");
  addText(blocks, r(273, 24, 26), "δ_{P_y,k} è lo spostamento virtuale verticale del baricentro delle forze peso proprie e portate P_k, agenti sul k-esimo blocco, assunto positivo se verso l’alto;");
  addText(blocks, r(273, 27, 29), "δ_{F,k} è lo spostamento virtuale del punto d’applicazione della forza esterna F_k, proiettato nella direzione della stessa (di segno positivo o negativo a seconda che questa favorisca o contrasti il meccanismo);");
  addText(blocks, r(273, 30, 33), "δ_{PQ_x,k} è lo spostamento virtuale orizzontale del baricentro delle forze orizzontali α(P_k+Q_k) agenti sul k-esimo blocco, assumendo come verso positivo quello dell’azione sismica che attiva il meccanismo;");
  addText(blocks, r(273, 34, 36), "L_i è il lavoro totale di eventuali forze interne (allungamento di una catena; scorrimento con attrito in presenza di ammorsamento tra i blocchi del meccanismo, dovuto a moti relativi traslazionali o torsionali; deformazione nel piano di solai o coperture collegate ma non rigide).");
  addProse(blocks, r(273, 37, 45));
  addText(blocks, r(273, 46, 52), "Un caso particolarmente significativo è quello di una parete che, pur essendo collegata alle pareti di spina ortogonali attraverso un ammorsamento murario parzialmente efficace, ribalta fuori dal proprio piano medio (ribaltamento semplice). A meno che non sia già in atto un distacco evidente dalle pareti ortogonali o che queste non siano totalmente prive di ammorsamento, tale meccanismo può considerare il contributo stabilizzante esercitato dalle pareti ortogonali attraverso resistenze attritive. La risultante della forza attritiva che può svilupparsi lungo l’altezza h dell’ammorsamento con una parete ortogonale (lesione verticale a pettine, ipotizzando caratteristiche di ammorsamento pressoché uniformi) può essere ricavata in modo approssimato dalla seguente espressione:");
  setLastInlineTerms(blocks, [["h", "h"]]);
  addFormulaRef(blocks, r(273, 53, 54), "C8.7.1.2");
  addText(blocks, r(273, 55), "dove:");
  addText(blocks, r(273, 56, 57), "n è il numero dei filari interessati dalla lesione verticale (n=h/h_b, dove h_b è l’altezza media degli elementi costituenti la muratura);");
  addText(blocks, r(273, 58), "l è la lunghezza del singolo giunto attritivo, sovrapposizione tra i blocchi di due corsi successivi;");
  setLastInlineTerms(blocks, [["l", "l"]]);
  addText(blocks, r(273, 59, 61), "φ è il coefficiente di ammorsamento, così definito φ=h_b/l; tale parametro è analogamente definito per il criterio di resistenza a taglio per fessurazione diagonale, con rottura “a scaletta” nei giunti di malta, nell’equazione [C8.7.1.17];");
  addText(blocks, r(273, 62), "μ è il coefficiente d’attrito; un valore di riferimento è 0,577, identico a quello indicato per l’equazione [C8.7.1.17];");
  addText(blocks, r(273, 63), "t_s è lo spessore della parete trasversale (opportunamente ridotto nel caso di muratura a tre paramenti);");
  addText(blocks, r(273, 64), "w è il peso specifico della muratura (valori sono suggeriti nella Tabella C8.5.I).");
  addProse(blocks, r(273, 65, 67));
  setLastInlineTerms(blocks, [["1/3h", "\\frac{1}{3}h"], ["h", "h"], ["α_0", "\\alpha_0"]]);
  addProse(blocks, r(274, 3, 7));
}, [F11, F12]);

makeUnit("C8.7.1.2.1.2", "Analisi con approccio cinematico non lineare", "C8.7.1.2.1", ["C8", "C8.7", "C8.7.1", "C8.7.1.2", "C8.7.1.2.1"], 2, (blocks) => {
  addText(blocks, r(274, 9, 15), "L’analisi con approccio cinematico non lineare (o cinematica non lineare) richiede la valutazione del moltiplicatore α non solo per la configurazione iniziale della catena cinematica ma anche per configurazioni variate, rappresentative dell’evoluzione del cinematismo e descritte dallo spostamento orizzontale d_C di un punto C di controllo del sistema, scelto a piacere. In generale il moltiplicatore α si riduce progressivamente, fino ad annullarsi in corrispondenza dello spostamento d_C0.");
  setLastInlineTerms(blocks, [["d_C0", "d_{C0}"], ["d_C", "d_C"], ["α", "\\alpha"], ["C", "C"]]);
  addText(blocks, r(274, 16, 19), "La curva α-d_C, ottenuta attraverso l’analisi cinematica non lineare, rappresenta (a meno dell’accelerazione di gravità g) la curva forza reattiva-spostamento, o curva di spinta, del meccanismo locale. Per la sua determinazione è necessario considerare se, con l’evolversi del cinematismo, le forze interne ed esterne si modificano o si mantengono costanti.");
  setLastInlineTerms(blocks, [["α-d_C", "\\alpha-d_C"], ["g", "g"]]);
});

makeUnit("C8.7.1.2.1.3", "Definizione dell’oscillatore non lineare equivalente", "C8.7.1.2.1", ["C8", "C8.7", "C8.7.1", "C8.7.1.2", "C8.7.1.2.1"], 3, (blocks) => {
  addText(blocks, r(274, 21, 23), "Al fine di valutare la domanda sismica di spostamento, è necessario determinare la “curva di capacità” del meccanismo locale, ovvero ricondursi alla risposta (a meno dell’accelerazione di gravità g) di un oscillatore equivalente non lineare a un grado di libertà descritta in termini accelerazione-spostamento come α(d):");
  addFormulaRef(blocks, r(274, 24, 25), "C8.7.1.3");
  addFormulaRef(blocks, r(274, 26, 33), "C8.7.1.4");
  addText(blocks, r(274, 34), "dove:");
  addText(blocks, r(274, 35), "g è l’accelerazione di gravità;");
  addText(blocks, r(274, 36, 38), "FC è il Fattore di Confidenza, che in questo caso si applica direttamente alla capacità in termini di resistenza (nel caso in cui, per la valutazione del moltiplicatore α, non si tenga conto della resistenza a compressione della muratura, il fattore di confidenza da utilizzare sarà comunque quello relativo al livello di conoscenza LC1);");
  addText(blocks, r(274, 39, 41), "δ_Cx è lo spostamento virtuale orizzontale del punto di controllo valutato, così come gli spostamenti virtuali δ_{PQ_x,k}, a partire dalla configurazione indeformata iniziale;");
  addText(blocks, r(274, 42, 44), "e* è la frazione di massa partecipante che, in prima approssimazione, può essere valutata considerando gli spostamenti virtuali relativi al cinematismo (misurati a partire dalla configurazione indeformata iniziale) come rappresentativi del modo di vibrazione del meccanismo locale.");
  addFormulaRef(blocks, r(274, 45, 53), "C8.7.1.5");
  addText(blocks, r(274, 54, 57), "La curva di capacità così ottenuta presuppone che il comportamento del meccanismo, prima della sua attivazione, sia infinitamente rigido; questa assunzione è ammissibile nel caso di meccanismi fuori dal piano di pareti murarie inizialmente vincolate con continuità alle pareti trasversali, in quanto le prime, precedentemente all’attivazione del meccanismo stesso, non sono caratterizzate da un comportamento dinamico autonomo.");
  addText(blocks, r(274, 58, 61), "Nel caso invece di elementi liberi di vibrare (quali parapetti, porzioni svettanti di facciate, pinnacoli o merlature, ecc.) è necessario considerare che la loro risposta, prima che si verifichino le condizioni di attivazione del cinematismo, è dinamica elastica, anche se spesso caratterizzata da un basso periodo di vibrazione; è quindi necessario introdurre un ramo elastico iniziale nella curva di capacità, legando l’accelerazione a allo spostamento d mediante il periodo T_0 attraverso la equazione [C8.7.1.6].");
  addFormulaRef(blocks, r(274, 62, 64), "C8.7.1.6");
  addText(blocks, r(274, 65), "Il periodo T_0, a sua volta, può essere stimato, a partire dalla soluzione della trave con massa distribuita, con la formula:");
  addFormulaRef(blocks, r(274, 66, 67), "C8.7.1.7");
}, [F13, F14, F15, F16, F17]);

const formulas = [
  { id: F11, unitId: unitId("C8.7.1.2.1.1"), officialNumber: "C8.7.1.1", pdfPage: 273, latex: "\\alpha_0=\\frac{\\sum_{k=1}^{N}P_k\\delta_{P_y,k}-\\sum_{k=1}^{m}F_k\\delta_{F,k}+L_i}{\\sum_{k=1}^{N}(P_k+Q_k)\\delta_{PQ_x,k}}" },
  { id: F12, unitId: unitId("C8.7.1.2.1.1"), officialNumber: "C8.7.1.2", pdfPage: 273, latex: "F=0.4\\,n(n+1)\\,\\Phi\\,\\mu\\,l^2\\,t_s\\,W" },
  { id: F13, unitId: unitId("C8.7.1.2.1.3"), officialNumber: "C8.7.1.3", pdfPage: 274, latex: "a=\\frac{\\alpha(d_C)g}{e^*FC}" },
  { id: F14, unitId: unitId("C8.7.1.2.1.3"), officialNumber: "C8.7.1.4", pdfPage: 274, latex: "d=d_C\\frac{\\sum_{k=1}^{N}(P_k+Q_k)\\delta_{PQ_x,K}^{2}}{\\delta_{Cx}\\sum_{k=1}^{N}(P_k+Q_k)\\delta_{PQ_x,K}}" },
  { id: F15, unitId: unitId("C8.7.1.2.1.3"), officialNumber: "C8.7.1.5", pdfPage: 274, latex: "e^*=\\frac{\\left[\\sum_{k=1}^{N}(P_k+Q_k)\\delta_{PQ_x,k}\\right]^2}{\\left[\\sum_{k=1}^{N}(P_k+Q_k)\\right]\\left[\\sum_{k=1}^{N}(P_k+Q_k)\\delta_{PQ_x,k}^{2}\\right]}" },
  { id: F16, unitId: unitId("C8.7.1.2.1.3"), officialNumber: "C8.7.1.6", pdfPage: 274, latex: "a=\\frac{4\\pi^2}{T_0^2}d" },
  { id: F17, unitId: unitId("C8.7.1.2.1.3"), officialNumber: "C8.7.1.7", pdfPage: 274, latex: "T_0=\\kappa\\lambda L\\sqrt{\\frac{W}{Eg}}" },
];
mkdirSync(UNITS, { recursive: true });
mkdirSync(ASSETS, { recursive: true });
writeFileSync(join(ASSETS, "C8.7-step1a.json"), JSON.stringify({
  $schema: "urn:structural-codes:schema:asset-manifest:v2",
  schemaVersion: "2.0.0-alpha.1",
  recordType: "asset-manifest",
  document: "circ2019",
  section: "C8.7-step1a",
  sourceId: SOURCE_ID,
  status: "transcribed-unreviewed",
  formulas,
  tables: [],
  figures: [],
}, null, 2) + "\n", "utf8");
