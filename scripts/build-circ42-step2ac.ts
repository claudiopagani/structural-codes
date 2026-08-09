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
const unitNumber = "C4.2.12.1.7.5";
type Region = { coordinateSystem: "pdf-points-top-left"; x: number; y: number; width: number; height: number };
type Inline = { kind: "text" | "math"; value: string; latex?: string };
const uid = (number: string) => "urn:structural-codes:it:unit:circ2019:" + number.toLowerCase();
const reg = (x: number, y: number, width: number, height: number): Region => ({ coordinateSystem: "pdf-points-top-left", x, y, width, height });
const text = (value: string): Inline => ({ kind: "text", value });
const hash = (value: string) => sha256OfText(value);
function evidence(raw: string, region: Region) { return { sourceId, pdfPage: 145, printedPage: "141", region, extraction: { method: "pdf-text", tool: "pdfjs-dist", toolVersion: "4.10.38" }, transformations: [{ operation: "join-line-wrap", ruleVersion: profile, note: "Ricomposta la riga tipografica del sottoparagrafo." }, { operation: "unicode-nfc", ruleVersion: profile, note: "Testo normalizzato in Unicode NFC." }], rawSha256: hash(raw), normalizedSha256: hash(raw) }; }
const heading = "C4.2.12.1.7.5. Cordoni d’angolo (per impiego con spessori minori di 4 mm)";
const paragraph = "Vale quanto riportato al § 4.2.8 delle NTC.";
const blocks = [
  { blockId: uid(unitNumber) + "#block-heading", kind: "heading", origin: "official", text: { raw: heading, normalized: heading, normalizationVersion: profile, inline: [text(heading)] }, evidence: evidence(heading, reg(73.9, 300, 450, 25)) },
  { blockId: uid(unitNumber) + "#block-p1", kind: "paragraph", origin: "official", text: { raw: paragraph, normalized: paragraph, normalizationVersion: profile, inline: [text(paragraph)] }, evidence: evidence(paragraph, reg(73.9, 330, 450, 25)) },
];
const unit = { $schema: "urn:structural-codes:schema:canonical-unit:v2", schemaVersion: "2.0.0-alpha.2", recordType: "canonical-unit", id: uid(unitNumber), workId, expressionId, kind: "subparagraph", numbering: { official: unitNumber, sortKey: unitNumber.replace(/^C/, "").split(".").map((part) => part.padStart(3, "0")).join(".") }, title: "Cordoni d’angolo (per impiego con spessori minori di 4 mm)", titleBlockId: uid(unitNumber) + "#block-heading", hierarchy: { parentId: uid("C4.2.12.1.7"), ancestorIds: [uid("C4.2"), uid("C4.2.12"), uid("C4.2.12.1"), uid("C4.2.12.1.7")], position: 5 }, validity: { from: null, to: null, status: "unknown", asOf: "2026-08-09" }, blocks, citations: [], relations: [], assets: { formulaIds: [], tableIds: [], figureIds: [] }, workflow: { status: "extracted", createdBy: { actorId: "codex:circ42-step2ac", kind: "automated-agent", toolVersion: profile }, createdAt, reviews: [], openIssues: [{ issueId: "circ2019-C4-2-12-1-7-5-source-review", type: "normalization-review", severity: "blocking", note: "Record trascritto dall’evidence ufficiale ma non ancora confrontato integralmente da un revisore umano con il render della pagina fonte." }] } };
const manifest = { $schema: "urn:structural-codes:schema:asset-manifest:v2", schemaVersion: "2.0.0-alpha.1", recordType: "asset-manifest", document: "circ2019", section: "C4.2-step2ac", sourceId, status: "transcribed-unreviewed", formulas: [], tables: [], figures: [] };
await mkdir(unitDirectory, { recursive: true });
await mkdir(assetDirectory, { recursive: true });
await Promise.all([writeFile(join(unitDirectory, unitNumber.toLowerCase() + ".json"), JSON.stringify(unit, null, 2) + "\n", "utf8"), writeFile(join(assetDirectory, "C4.2-step2ac.json"), JSON.stringify(manifest, null, 2) + "\n", "utf8")]);
console.log("Circolare C4.2 step2ac: generate 1 unità.");
