import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const EVIDENCE = join(ROOT, "evidence", "circ-7-2019", "pages");
const OUT = join(ROOT, "corpus", "units", "circ2019", "c8.6.json");
const SOURCE_ID = "circ-7-2019";
const WORK_ID = "it-mit:circ:2019-01-21:7-csllpp";
const EXPRESSION_ID = WORK_ID + ":original-it";
const TODAY = "2026-08-09";
const CREATED_AT = "2026-08-09T12:00:00Z";
const VERSION = "circ8-editorial-profile-0.2.0";

type Range = { page: number; start: number; end: number };
type Block = Record<string, unknown>;

const page = readFileSync(join(EVIDENCE, "page-0269.raw.txt"), "utf8").replace(/\r\n/g, "\n").split("\n");
function raw(range: Range): string {
  return page.slice(range.start - 1, range.end).join("\n");
}
function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}
function evidence(range: Range, normalized: string) {
  const rawText = raw(range);
  return {
    sourceId: SOURCE_ID,
    pdfPage: 269,
    printedPage: "265",
    region: null,
    extraction: { method: "manual-transcription", tool: "codex-render-transcription", toolVersion: VERSION },
    transformations: [
      ...(rawText.includes("\n") ? [{
        operation: "join-line-wrap",
        ruleVersion: VERSION,
        note: "Rimossi gli a capo introdotti dall’impaginazione, conservando il capoverso.",
      }] : []),
      ...(rawText !== normalized ? [{
        operation: "manual-correction",
        ruleVersion: VERSION,
        note: "Ripristinati accenti, apostrofi, numerazione e punteggiatura verificati sul render ufficiale.",
      }] : []),
      { operation: "unicode-nfc", ruleVersion: VERSION, note: "Testo normalizzato in Unicode NFC." },
    ],
    rawSha256: sha256(rawText),
    normalizedSha256: sha256(normalized),
  };
}
function unitId(official: string): string {
  return "urn:structural-codes:it:unit:circ2019:" + official.toLowerCase();
}
function relation(headingBlockId: string) {
  const target = existsSync(join(ROOT, "corpus", "units", "ntc2018", "8.6.json"))
    ? "urn:structural-codes:it:unit:ntc2018:8.6"
    : "urn:structural-codes:it:unit:ntc2018:8";
  return [{
    relationId: unitId("C8.6") + "#relation-001",
    type: "clarifies",
    targetUnitId: target,
    basis: "editorial",
    evidenceBlockIds: [headingBlockId],
    rationale: "Corrispondenza proposta tra numerazione omologa della Circolare e delle NTC; richiede conferma umana sul contenuto completo.",
    review: { status: "proposed", reviewedBy: null, reviewedAt: null },
  }];
}
function textBlock(blocks: Block[], range: Range, normalized: string, kind: "heading" | "paragraph" = "paragraph") {
  const blockId = unitId("C8.6") + "#block-" + (blocks.length === 0 ? "heading" : String(blocks.length).padStart(3, "0"));
  blocks.push({
    blockId,
    kind,
    origin: "official",
    text: { raw: raw(range), normalized, normalizationVersion: VERSION },
    evidence: evidence(range, normalized),
  });
  return blockId;
}

const blocks: Block[] = [];
const headingBlockId = textBlock(blocks, { page: 269, start: 28, end: 28 }, "C8.6 MATERIALI", "heading");
textBlock(blocks, { page: 269, start: 29, end: 30 }, "In aggiunta a quanto indicato al § 8.5.3 riguardo ai materiali degli edifici esistenti, il § 8.6 delle NTC fornisce indicazioni sui materiali da utilizzare per gli interventi sulle costruzioni esistenti.");
textBlock(blocks, { page: 269, start: 31, end: 32 }, "I casi di incompatibilità più frequentemente riscontrati in merito all’associazione di materiali diversi sono legati alla differente rigidezza di questi, al loro diverso comportamento termico, ai fenomeni di ritiro differenziali e alle reazioni chimiche tra di essi.");
textBlock(blocks, { page: 269, start: 33, end: 35 }, "Le differenze di rigidezza possono essere messe in conto attraverso i moduli di elasticità, peraltro affetti da incertezze nella valutazione. Inoltre il comportamento reologico dei materiali rende ardue queste quantificazioni, in particolare nel caso della muratura, la cui composizione è estremamente variabile.");
textBlock(blocks, { page: 269, start: 36, end: 38 }, "Si ricorda che i valori dei moduli di elasticità riportati nella Tabella C.8.5.I sono riferiti a sollecitazioni a tempi brevi; sotto carichi permanenti le caratteristiche meccaniche delle murature possono subire notevoli variazioni in relazione all’intensità e al tempo di permanenza del carico, con conseguenze rilevanti in termini di deformazioni e sollecitazioni nei materiali.");
textBlock(blocks, { page: 269, start: 39, end: 42 }, "Differenze di comportamento termico tra materiali in contatto possono determinare situazioni patologiche dovute a incrementi delle sollecitazioni. A questo proposito, l’accoppiamento tra murature e materiali metallici, ma anche tra murature e elementi di c.a. o di legno, deve essere valutato con particolare attenzione per evitare lesioni e disarticolazioni della compagine a causa delle variazioni termiche e/o igrometriche.");
textBlock(blocks, { page: 269, start: 43, end: 45 }, "Anche i fenomeni di ritiro dei materiali introdotti nel consolidamento, in particolare il calcestruzzo e il legno, possono compromettere l’efficacia del rinforzo in maniera non prevedibile e determinare nelle strutture situazioni patologiche legate agli stati di coazione.");
textBlock(blocks, { page: 269, start: 46, end: 46 }, "Infine vanno adeguatamente considerate le eventuali incompatibilità chimiche.");
textBlock(blocks, { page: 269, start: 47, end: 48 }, "E’ pertanto necessaria, particolarmente nel caso delle iniezioni, la determinazione della composizione chimica dei materiali esistenti e la verifica della loro compatibilità con i materiali di apporto.");
textBlock(blocks, { page: 269, start: 49, end: 51 }, "Per quanto riguarda gli interventi sulle strutture lignee, gli accoppiamenti con lastre metalliche estese vanno valutati con attenzione perché, in presenza di fenomeni di condensa, possono determinare situazioni termo-igrometriche favorevoli al degrado del legno.");

const record = {
  $schema: "urn:structural-codes:schema:canonical-unit:v2",
  schemaVersion: "2.0.0-alpha.2",
  recordType: "canonical-unit",
  id: unitId("C8.6"),
  workId: WORK_ID,
  expressionId: EXPRESSION_ID,
  kind: "paragraph",
  numbering: { official: "C8.6", sortKey: "008.006" },
  title: "MATERIALI",
  titleBlockId: headingBlockId,
  hierarchy: {
    parentId: unitId("C8"),
    ancestorIds: [unitId("C8")],
    position: 6,
  },
  validity: { from: null, to: null, status: "unknown", asOf: TODAY },
  blocks,
  citations: [],
  relations: relation(headingBlockId),
  assets: { formulaIds: [], tableIds: [], figureIds: [] },
  workflow: {
    status: "extracted",
    createdBy: { actorId: "generator:circ86:step1", kind: "script", toolVersion: VERSION },
    createdAt: CREATED_AT,
    reviews: [],
    openIssues: [
      {
        issueId: "circ2019-c8.6-source-review",
        type: "normalization-review",
        severity: "blocking",
        note: "Trascrizione confrontata con il render ufficiale; resta obbligatoria la revisione umana indipendente.",
      },
      {
        issueId: "circ2019-c8.6-relation",
        type: "relation-review",
        severity: "blocking",
        note: "Il collegamento Circolare-NTC per numerazione omologa richiede conferma umana.",
      },
    ],
  },
};

writeFileSync(OUT, JSON.stringify(record, null, 2) + "\n", "utf8");
