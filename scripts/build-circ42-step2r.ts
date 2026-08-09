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
const unitNumber = "C4.2.4.1.4.6";

type Region = { coordinateSystem: "pdf-points-top-left"; x: number; y: number; width: number; height: number };
type Inline = { kind: "text" | "math"; value: string; latex?: string };
type FormulaRow = { number: string; page: number; latex: string; raw: string; region: Region };
type GeneratedBlock = { blockId: string; kind: string; origin: "official"; text?: { raw: string; normalized: string; normalizationVersion: string; inline: Inline[] }; evidence: { rawSha256: string; normalizedSha256: string; [key: string]: unknown }; assetId?: string };
const uid = (number: string) => `urn:structural-codes:it:unit:circ2019:${number.toLowerCase()}`;
const formulaId = (number: string) => `urn:structural-codes:it:asset:formula:circ2019:${number.toLowerCase()}`;
const reg = (x: number, y: number, width: number, height: number): Region => ({ coordinateSystem: "pdf-points-top-left", x, y, width, height });
const text = (value: string): Inline => ({ kind: "text", value });
const math = (value: string, latex: string): Inline => ({ kind: "math", value, latex });
const hash = (value: string) => sha256OfText(value);
function evidence(page: number, raw: string, normalized: string, region: Region, manual = false) { return { sourceId, pdfPage: page, printedPage: String(page - 4), region, extraction: { method: manual ? "manual-transcription" : "pdf-text", tool: manual ? "codex-source-transcription" : "pdfjs-dist", toolVersion: manual ? profile : "4.10.38" }, transformations: [{ operation: "join-line-wrap", ruleVersion: profile, note: "Ricomposte le righe tipografiche appartenenti allo stesso capoverso; la formula resta un blocco distinto." }, ...(raw !== normalized ? [{ operation: "manual-correction", ruleVersion: profile, note: "Ripristinati accenti, apostrofi, simboli e notazione matematica confrontati con il render ufficiale." }] : []), { operation: "unicode-nfc", ruleVersion: profile, note: "Testo normalizzato in Unicode NFC." }], rawSha256: hash(raw), normalizedSha256: hash(normalized) }; }
function block(suffix: string, kind: "heading" | "paragraph", page: number, normalized: string, inline: Inline[], region: Region): GeneratedBlock { return { blockId: `${uid(unitNumber)}#block-${suffix}`, kind, origin: "official", text: { raw: normalized, normalized, normalizationVersion: profile, inline }, evidence: evidence(page, normalized, normalized, region) }; }
function formulaBlock(suffix: string, formula: FormulaRow): GeneratedBlock { return { blockId: `${uid(unitNumber)}#block-${suffix}`, kind: "formula-ref", origin: "official", assetId: formulaId(formula.number), evidence: evidence(formula.page, formula.raw, formula.raw, formula.region, true) }; }

const formula100: FormulaRow = { number: "C4.2.100", page: 134, latex: "\\Delta\\sigma_{C,\\mathrm{red}}=k_s\\cdot\\Delta\\sigma_C", raw: "Δσ_C,red = k_s · Δσ_C [C4.2.100]", region: reg(175, 310, 250, 45) };
const blocks: GeneratedBlock[] = [
    block("heading", "heading", 134, "C4.2.4.1.4.6. Influenza dello spessore", [text("C4.2.4.1.4.6. Influenza dello spessore")], reg(73.9, 310, 450, 25)),
    block("p1", "paragraph", 134, "Nella valutazione della resistenza a fatica dovrà tenersi conto dello spessore del metallo base nel quale può innescarsi una potenziale lesione.", [text("Nella valutazione della resistenza a fatica dovrà tenersi conto dello spessore del metallo base nel quale può innescarsi una potenziale lesione.")], reg(73.9, 340, 450, 25)),
    block("p2", "paragraph", 134, "Nel caso che l’influenza dello spessore sulla resistenza a fatica non sia trascurabile, la classe del dettaglio deve essere ridotta secondo la formula", [text("Nel caso che l’influenza dello spessore sulla resistenza a fatica non sia trascurabile, la classe del dettaglio deve essere ridotta secondo la formula")], reg(73.9, 370, 450, 25)),
    formulaBlock("formula-100", formula100),
    block("p3", "paragraph", 134, "dove il coefficiente riduttivo k_s dipende dal dettaglio strutturale considerato ed i cui valori indicativi sono indicati, per alcuni dettagli costruttivi, nel documento UNI EN 1993-1-9.", [text("dove il coefficiente riduttivo "), math("k_s", "k_s"), text(" dipende dal dettaglio strutturale considerato ed i cui valori indicativi sono indicati, per alcuni dettagli costruttivi, nel documento UNI EN 1993-1-9.")], reg(73.9, 415, 450, 35)),
];
const parent = uid("C4.2.4.1.4");
const unit = { $schema: "urn:structural-codes:schema:canonical-unit:v2", schemaVersion: "2.0.0-alpha.2", recordType: "canonical-unit", id: uid(unitNumber), workId, expressionId, kind: "subparagraph", numbering: { official: unitNumber, sortKey: unitNumber.replace(/^C/, "").split(".").map((part) => part.padStart(3, "0")).join(".") }, title: "Influenza dello spessore", titleBlockId: `${uid(unitNumber)}#block-heading`, hierarchy: { parentId: parent, ancestorIds: [uid("C4.2"), uid("C4.2.4"), uid("C4.2.4.1"), parent], position: 6 }, validity: { from: null, to: null, status: "unknown", asOf: "2026-08-09" }, blocks, citations: [], relations: [], assets: { formulaIds: [formulaId(formula100.number)], tableIds: [], figureIds: [] }, workflow: { status: "extracted", createdBy: { actorId: "codex:circ42-step2r", kind: "automated-agent", toolVersion: profile }, createdAt, reviews: [], openIssues: [{ issueId: "circ2019-C4-2-4-1-4-6-source-review", type: "normalization-review", severity: "blocking", note: "Record trascritto dall’evidence ufficiale ma non ancora confrontato integralmente da un revisore umano con il render della pagina fonte." }, { issueId: "circ2019-C4-2-4-1-4-6-assets-review", type: "asset-review", severity: "blocking", note: "La formula C4.2.100 richiede revisione umana indipendente." }] } };
const manifest = { $schema: "urn:structural-codes:schema:asset-manifest:v2", schemaVersion: "2.0.0-alpha.1", recordType: "asset-manifest", document: "circ2019", section: "C4.2-step2r", sourceId, status: "transcribed-unreviewed", formulas: [{ id: formulaId(formula100.number), unitId: uid(unitNumber), officialNumber: formula100.number, pdfPage: formula100.page, latex: formula100.latex }], tables: [], figures: [] };
await mkdir(unitDirectory, { recursive: true });
await mkdir(assetDirectory, { recursive: true });
await Promise.all([writeFile(join(unitDirectory, `${unitNumber.toLowerCase()}.json`), `${JSON.stringify(unit, null, 2)}\n`, "utf8"), writeFile(join(assetDirectory, "C4.2-step2r.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8")]);
console.log("Circolare C4.2 step2r: generate 1 unità e 1 formula.");
