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
const unitNumber = "C4.2.4.1.4";

type Region = { coordinateSystem: "pdf-points-top-left"; x: number; y: number; width: number; height: number };
type Inline = { kind: "text" | "math"; value: string; latex?: string };
type GeneratedBlock = {
    blockId: string;
    kind: "heading" | "paragraph";
    origin: "official";
    text: { raw: string; normalized: string; normalizationVersion: string; inline: Inline[] };
    evidence: { rawSha256: string; normalizedSha256: string; [key: string]: unknown };
};

const uid = (number: string) => `urn:structural-codes:it:unit:circ2019:${number.toLowerCase()}`;
const reg = (x: number, y: number, width: number, height: number): Region => ({ coordinateSystem: "pdf-points-top-left", x, y, width, height });
const text = (value: string): Inline => ({ kind: "text", value });
const hash = (value: string) => sha256OfText(value);

function evidence(raw: string, normalized: string, region: Region) {
    return {
        sourceId,
        pdfPage: 123,
        printedPage: "119",
        region,
        extraction: { method: "pdf-text", tool: "pdfjs-dist", toolVersion: "4.10.38" },
        transformations: [
            { operation: "join-line-wrap", ruleVersion: profile, note: "Ricomposte le righe tipografiche appartenenti allo stesso capoverso; il titolo successivo resta escluso." },
            ...(raw !== normalized ? [{ operation: "manual-correction", ruleVersion: profile, note: "Ripristinati accenti e apostrofi confrontati con il render ufficiale." }] : []),
            { operation: "unicode-nfc", ruleVersion: profile, note: "Testo normalizzato in Unicode NFC." },
        ],
        rawSha256: hash(raw),
        normalizedSha256: hash(normalized),
    };
}

function block(suffix: string, kind: "heading" | "paragraph", normalized: string, region: Region): GeneratedBlock {
    return { blockId: `${uid(unitNumber)}#block-${suffix}`, kind, origin: "official", text: { raw: normalized, normalized, normalizationVersion: profile, inline: [text(normalized)] }, evidence: evidence(normalized, normalized, region) };
}

const blocks: GeneratedBlock[] = [
    block("heading", "heading", "C4.2.4.1.4 Stato limite di fatica", reg(73.9, 350, 450, 25)),
    block("p1", "paragraph", "Per le strutture soggette a carichi ciclici deve essere verificata la resistenza a fatica, considerando una distribuzione temporale delle azioni coerente con la tipologia strutturale in esame e con il regime d’impegno previsto nel corso della vita nominale.", reg(73.9, 325, 450, 45)),
];

const parent = uid("C4.2.4.1");
const unit = {
    $schema: "urn:structural-codes:schema:canonical-unit:v2",
    schemaVersion: "2.0.0-alpha.2",
    recordType: "canonical-unit",
    id: uid(unitNumber),
    workId,
    expressionId,
    kind: "subparagraph",
    numbering: { official: unitNumber, sortKey: unitNumber.replace(/^C/, "").split(".").map((part) => part.padStart(3, "0")).join(".") },
    title: "Stato limite di fatica",
    titleBlockId: `${uid(unitNumber)}#block-heading`,
    hierarchy: { parentId: parent, ancestorIds: [uid("C4.2"), uid("C4.2.4"), parent], position: 4 },
    validity: { from: null, to: null, status: "unknown", asOf: "2026-08-09" },
    blocks,
    citations: [],
    relations: [],
    assets: { formulaIds: [], tableIds: [], figureIds: [] },
    workflow: {
        status: "extracted",
        createdBy: { actorId: "codex:circ42-step2l", kind: "automated-agent", toolVersion: profile },
        createdAt,
        reviews: [],
        openIssues: [
            { issueId: "circ2019-C4-2-4-1-4-source-review", type: "normalization-review", severity: "blocking", note: "Record trascritto dall’evidence ufficiale ma non ancora confrontato integralmente da un revisore umano con il render della fonte." },
        ],
    },
};

const manifest = {
    $schema: "urn:structural-codes:schema:asset-manifest:v2",
    schemaVersion: "2.0.0-alpha.1",
    recordType: "asset-manifest",
    document: "circ2019",
    section: "C4.2-step2l",
    sourceId,
    status: "transcribed-unreviewed",
    formulas: [],
    tables: [],
    figures: [],
};

await mkdir(unitDirectory, { recursive: true });
await mkdir(assetDirectory, { recursive: true });
await Promise.all([
    writeFile(join(unitDirectory, `${unitNumber.toLowerCase()}.json`), `${JSON.stringify(unit, null, 2)}\n`, "utf8"),
    writeFile(join(assetDirectory, "C4.2-step2l.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8"),
]);
console.log("Circolare C4.2 step2l: generate 1 unità senza asset display.");
