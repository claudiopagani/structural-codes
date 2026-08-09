import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { sha256OfText } from "../src/lib/hash.ts";

const root = fileURLToPath(new URL("../", import.meta.url));
const unitDirectory = join(root, "corpus", "units", "circ2019");
const assetDirectory = join(root, "corpus", "assets", "circ2019");
const sourceId = "circ-7-2019";
const workId = "it-mit:circ:2019-01-21:7-csllpp";
const expressionId = "it-mit:circ:2019-01-21:7-csllpp:original-it";
const profile = "circ42-editorial-profile-0.1.0";
const createdAt = "2026-08-09T00:00:00Z";

type Region = { coordinateSystem: "pdf-points-top-left"; x: number; y: number; width: number; height: number };
type Inline = { kind: "text" | "math"; value: string; latex?: string };
type Cell = { text: string; latex?: string; rowSpan?: number; colSpan?: number };
type BlockKind = "heading" | "paragraph" | "table-ref";
type GeneratedBlock = { blockId: string; kind: BlockKind; origin: "official"; text?: { raw: string; normalized: string; normalizationVersion: string; inline: Inline[] }; evidence: { rawSha256: string; normalizedSha256: string; [key: string]: unknown }; assetId?: string };

const uid = (number: string) => "urn:structural-codes:it:unit:circ2019:" + number.toLowerCase();
const tableId = (number: string) => "urn:structural-codes:it:asset:table:circ2019:" + number.toLowerCase();
const reg = (x: number, y: number, width: number, height: number): Region => ({ coordinateSystem: "pdf-points-top-left", x, y, width, height });
const text = (value: string): Inline => ({ kind: "text", value });
const c = (value: string, latex?: string): Cell => ({ text: value, ...(latex ? { latex } : {}) });
const hash = (value: string) => sha256OfText(value);

function evidence(page: number, raw: string, normalized: string, region: Region, manual = false) {
  return {
    sourceId,
    pdfPage: page,
    printedPage: String(page - 4),
    region,
    extraction: { method: manual ? "manual-transcription" : "pdf-text", tool: manual ? "codex-source-transcription" : "pdfjs-dist", toolVersion: manual ? profile : "4.10.38" },
    transformations: [
      { operation: "join-line-wrap", ruleVersion: profile, note: "Ricomposte le righe tipografiche appartenenti allo stesso capoverso; la tabella resta un asset strutturato." },
      ...(raw !== normalized ? [{ operation: "manual-correction", ruleVersion: profile, note: "Ripristinati accenti, apostrofi e notazione confrontati con i render ufficiali." }] : []),
      { operation: "unicode-nfc", ruleVersion: profile, note: "Testo normalizzato in Unicode NFC." },
    ],
    rawSha256: hash(raw),
    normalizedSha256: hash(normalized),
  };
}

function block(number: string, suffix: string, kind: Exclude<BlockKind, "table-ref">, page: number, normalized: string, inline: Inline[], region: Region): GeneratedBlock {
  return { blockId: uid(number) + "#block-" + suffix, kind, origin: "official", text: { raw: normalized, normalized, normalizationVersion: profile, inline }, evidence: evidence(page, normalized, normalized, region) };
}

function tableBlock(number: string, suffix: string, page: number, caption: string, region: Region): GeneratedBlock {
  return { blockId: uid(number) + "#block-" + suffix, kind: "table-ref", origin: "official", assetId: tableId("C4.2.XX"), evidence: evidence(page, caption, caption, region, true) };
}

const tableRegion = reg(70, 195, 270, 360);
const tableXX = {
  id: tableId("C4.2.XX"),
  unitId: uid("C4.2.12.1.6.1"),
  officialNumber: "C4.2.XX",
  pdfPage: 141,
  caption: "Curve di stabilità per profili sottili compressi",
  columnCount: 3,
  headers: [[c("Tipo di sezione"), c("Inflessione intorno all’asse"), c("Curva")]],
  rows: [
    [c("Disegno di sezione: profilo chiuso con irrigidimenti centrali e assi y-y e z-z."), c("qualsiasi", "qualsiasi"), c("b (se si usa f_yb)\\nc (se si usa f_ya)*", "\\begin{gathered}b\\ (\\text{se si usa }f_{yb})\\\\c\\ (\\text{se si usa }f_{ya})^*\\end{gathered}")],
    [c("Disegni di sezione: profilo a I e profilo aperto irrigidito."), c("y-y\\nz-z", "\\begin{gathered}y-y\\\\z-z\\end{gathered}"), c("a\\nb", "\\begin{gathered}a\\\\b\\end{gathered}")],
    [c("Disegni di sezione: due profili aperti a C, uno semplice e uno con irrigidimento."), c("qualsiasi", "qualsiasi"), c("b", "b")],
    [c("Disegni di sezione: angolari e altri profili aperti; la fonte aggiunge «o altri tipi di sezione»."), c("qualsiasi", "qualsiasi"), c("c", "c")],
  ],
  notes: ["Le figure interne della colonna «Tipo di sezione» sono rappresentate mediante descrizioni strutturate fedeli ai disegni della fonte.", "* f_ya può essere usato soltanto quando A_eff=A_g."],
};

const unitParent = "C4.2.12.1.6";
const unit61 = "C4.2.12.1.6.1";
const unit62 = "C4.2.12.1.6.2";
const unit63 = "C4.2.12.1.6.3";

const blocksParent: GeneratedBlock[] = [
  block(unitParent, "heading", "heading", 140, "C4.2.12.1.6. Verifiche di stabilità", [text("C4.2.12.1.6. Verifiche di stabilità")], reg(73.9, 730, 450, 25)),
];
const blocks61: GeneratedBlock[] = [
  block(unit61, "heading", "heading", 140, "C4.2.12.1.6.1. Verifiche di stabilità di aste compresse", [text("C4.2.12.1.6.1. Verifiche di stabilità di aste compresse")], reg(73.9, 755, 450, 25)),
  block(unit61, "p1", "paragraph", 140, "La resistenza delle aste compresse si valuta con i criteri di cui al § 4.2.4.1.3 delle NTC adottando le curve di stabilità specificate nella Tabella C4.2.XX.", [text("La resistenza delle aste compresse si valuta con i criteri di cui al § 4.2.4.1.3 delle NTC adottando le curve di stabilità specificate nella Tabella C4.2.XX.")], reg(73.9, 785, 450, 35)),
  block(unit61, "p2", "paragraph", 141, "Si richiama l’attenzione sul fatto che per aste con sezione aperta a simmetria polare (profilati a Z e simili) i carichi critici torsionali possono essere inferiori a quelli flessionali; similmente, per aste con sezione aperta con un solo asse di simmetria i carichi critici flessotorsionali possono essere inferiori a quelli puramente flessionali.", [text("Si richiama l’attenzione sul fatto che per aste con sezione aperta a simmetria polare (profilati a Z e simili) i carichi critici torsionali possono essere inferiori a quelli flessionali; similmente, per aste con sezione aperta con un solo asse di simmetria i carichi critici flessotorsionali possono essere inferiori a quelli puramente flessionali.")], reg(73.9, 90, 450, 45)),
  tableBlock(unit61, "table-xx", 141, "Tabella C4.2.XX – Curve di stabilità per profili sottili compressi", tableRegion),
];
const blocks62: GeneratedBlock[] = [
  block(unit62, "heading", "heading", 141, "C4.2.12.1.6.2. Verifiche di stabilità di aste inflesse", [text("C4.2.12.1.6.2. Verifiche di stabilità di aste inflesse")], reg(73.9, 60, 450, 25)),
  block(unit62, "p1", "paragraph", 141, "La verifica di stabilità di una trave inflessa soggetta a fenomeni di instabilità flessotorsionali si effettua con i criteri di cui al § 4.2.4.1.3 delle NTC adottando la curva di stabilità b.", [text("La verifica di stabilità di una trave inflessa soggetta a fenomeni di instabilità flessotorsionali si effettua con i criteri di cui al § 4.2.4.1.3 delle NTC adottando la curva di stabilità b.")], reg(73.9, 90, 450, 35)),
  block(unit62, "p2", "paragraph", 141, "Tuttavia, quando l’area efficace ha assi principali di inerzia sensibilmente discosti da quelli dell’area lorda, quei criteri non sono applicabili e devono essere effettuate specifiche indagini numeriche.", [text("Tuttavia, quando l’area efficace ha assi principali di inerzia sensibilmente discosti da quelli dell’area lorda, quei criteri non sono applicabili e devono essere effettuate specifiche indagini numeriche.")], reg(73.9, 130, 450, 35)),
];
const blocks63: GeneratedBlock[] = [
  block(unit63, "heading", "heading", 141, "C4.2.12.1.6.3. Verifiche di stabilità di aste presso-inflesse", [text("C4.2.12.1.6.3. Verifiche di stabilità di aste presso-inflesse")], reg(73.9, 165, 450, 25)),
  block(unit63, "p1", "paragraph", 141, "Si tratta di problemi specifici per i quali si rinvia alla normativa di comprovata validità.", [text("Si tratta di problemi specifici per i quali si rinvia alla normativa di comprovata validità.")], reg(73.9, 195, 450, 25)),
];

function makeUnit(number: string, title: string, parentId: string | null, ancestors: string[], position: number, blocks: GeneratedBlock[], tableIds: string[]) {
  return {
    $schema: "urn:structural-codes:schema:canonical-unit:v2",
    schemaVersion: "2.0.0-alpha.2",
    recordType: "canonical-unit",
    id: uid(number),
    workId,
    expressionId,
    kind: "subparagraph",
    numbering: { official: number, sortKey: number.replace(/^C/, "").split(".").map((part) => part.padStart(3, "0")).join(".") },
    title,
    titleBlockId: uid(number) + "#block-heading",
    hierarchy: { parentId, ancestorIds: ancestors, position },
    validity: { from: null, to: null, status: "unknown", asOf: "2026-08-09" },
    blocks,
    citations: [],
    relations: [],
    assets: { formulaIds: [], tableIds, figureIds: [] },
    workflow: { status: "extracted", createdBy: { actorId: "codex:circ42-step2x", kind: "automated-agent", toolVersion: profile }, createdAt, reviews: [], openIssues: [{ issueId: "circ2019-" + number.replaceAll(".", "-") + "-source-review", type: "normalization-review", severity: "blocking", note: "Record trascritto dall’evidence ufficiale ma non ancora confrontato integralmente da un revisore umano con i render delle pagine fonte." }, ...(tableIds.length ? [{ issueId: "circ2019-" + number.replaceAll(".", "-") + "-assets-review", type: "asset-review", severity: "blocking", note: "La tabella strutturata richiede revisione umana indipendente rispetto alla fonte." }] : [])] },
  };
}

const records = [
  makeUnit(unitParent, "Verifiche di stabilità", uid("C4.2.12.1"), [uid("C4.2"), uid("C4.2.12"), uid("C4.2.12.1")], 6, blocksParent, []),
  makeUnit(unit61, "Verifiche di stabilità di aste compresse", uid(unitParent), [uid("C4.2"), uid("C4.2.12"), uid("C4.2.12.1"), uid(unitParent)], 1, blocks61, [tableId("C4.2.XX")]),
  makeUnit(unit62, "Verifiche di stabilità di aste inflesse", uid(unitParent), [uid("C4.2"), uid("C4.2.12"), uid("C4.2.12.1"), uid(unitParent)], 2, blocks62, []),
  makeUnit(unit63, "Verifiche di stabilità di aste presso-inflesse", uid(unitParent), [uid("C4.2"), uid("C4.2.12"), uid("C4.2.12.1"), uid(unitParent)], 3, blocks63, []),
];

const manifest = { $schema: "urn:structural-codes:schema:asset-manifest:v2", schemaVersion: "2.0.0-alpha.1", recordType: "asset-manifest", document: "circ2019", section: "C4.2-step2x", sourceId, status: "transcribed-unreviewed", formulas: [], tables: [tableXX], figures: [] };
await mkdir(unitDirectory, { recursive: true });
await mkdir(assetDirectory, { recursive: true });
await Promise.all([...records.map((record) => writeFile(join(unitDirectory, record.numbering.official.toLowerCase() + ".json"), JSON.stringify(record, null, 2) + "\n", "utf8")), writeFile(join(assetDirectory, "C4.2-step2x.json"), JSON.stringify(manifest, null, 2) + "\n", "utf8")]);
console.log("Circolare C4.2 step2x: generate 4 unità e 1 tabella.");
