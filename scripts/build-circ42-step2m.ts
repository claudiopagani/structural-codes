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
const unitNumber = "C4.2.4.1.4.1";

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
const math = (value: string, latex: string): Inline => ({ kind: "math", value, latex });
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
            ...(raw !== normalized ? [{ operation: "manual-correction", ruleVersion: profile, note: "Ripristinati accenti, apostrofi e la grandezza matematica confrontati con il render ufficiale." }] : []),
            { operation: "unicode-nfc", ruleVersion: profile, note: "Testo normalizzato in Unicode NFC." },
        ],
        rawSha256: hash(raw),
        normalizedSha256: hash(normalized),
    };
}

function block(suffix: string, kind: "heading" | "paragraph", normalized: string, inline: Inline[], region: Region): GeneratedBlock {
    return { blockId: `${uid(unitNumber)}#block-${suffix}`, kind, origin: "official", text: { raw: normalized, normalized, normalizationVersion: profile, inline }, evidence: evidence(normalized, normalized, region) };
}

const blocks: GeneratedBlock[] = [
    block("heading", "heading", "C4.2.4.1.4.1. Spettri di carico", [text("C4.2.4.1.4.1. Spettri di carico")], reg(73.9, 300, 450, 25)),
    block("p1", "paragraph", "La distribuzione temporale delle ampiezze delle azioni nel corso della vita della struttura è assegnata mediante il cosiddetto spettro di carico, che fornisce il numero di ripetizioni di ciascun livello delle azioni di progetto in un intervallo di tempo di riferimento, in funzione della destinazione d’uso della struttura e dell’intensità dell’utilizzazione. Quando lo spettro di carico effettivo è complesso al punto da non poter essere impiegato direttamente nelle verifiche, esso può essere sostituito da spettri convenzionali, in grado di riprodurre il danneggiamento a fatica e/o il livello massimo di escursione delle tensioni Δσ_max prodotti dallo spettro effettivo.", [text("La distribuzione temporale delle ampiezze delle azioni nel corso della vita della struttura è assegnata mediante il cosiddetto spettro di carico, che fornisce il numero di ripetizioni di ciascun livello delle azioni di progetto in un intervallo di tempo di riferimento, in funzione della destinazione d’uso della struttura e dell’intensità dell’utilizzazione. Quando lo spettro di carico effettivo è complesso al punto da non poter essere impiegato direttamente nelle verifiche, esso può essere sostituito da spettri convenzionali, in grado di riprodurre il danneggiamento a fatica e/o il livello massimo di escursione delle tensioni "), math("Δσ_max", "\\Delta\\sigma_{\\max}"), text(" prodotti dallo spettro effettivo.")], reg(73.9, 270, 450, 70)),
    block("p2", "paragraph", "Nel caso degli edifici la verifica a fatica non è generalmente necessaria, salvo che per membrature che sostengono macchine vibranti o dispositivi di sollevamento e trasporto dei carichi.", [text("Nel caso degli edifici la verifica a fatica non è generalmente necessaria, salvo che per membrature che sostengono macchine vibranti o dispositivi di sollevamento e trasporto dei carichi.")], reg(73.9, 225, 450, 35)),
    block("p3", "paragraph", "Gli spettri di carico da impiegare nelle verifiche possono essere determinati mediante studi specifici o anche dedotti da normative di comprovata validità. Gli spettri di carico da impiegare per le verifiche a fatica dei ponti stradali e ferroviari sono assegnati nel § 5.1.4.3 delle NTC.", [text("Gli spettri di carico da impiegare nelle verifiche possono essere determinati mediante studi specifici o anche dedotti da normative di comprovata validità. Gli spettri di carico da impiegare per le verifiche a fatica dei ponti stradali e ferroviari sono assegnati nel § 5.1.4.3 delle NTC.")], reg(73.9, 175, 450, 45)),
    block("p4", "paragraph", "Nella verifica dei dettagli strutturali metallici, caratterizzati dalla presenza di limite di fatica ad ampiezza costante, spesso è necessario considerare spettri di carico convenzionali differenziati, a seconda che si tratti di verifiche a fatica a vita illimitata o di verifiche a danneggiamento.", [text("Nella verifica dei dettagli strutturali metallici, caratterizzati dalla presenza di limite di fatica ad ampiezza costante, spesso è necessario considerare spettri di carico convenzionali differenziati, a seconda che si tratti di verifiche a fatica a vita illimitata o di verifiche a danneggiamento.")], reg(73.9, 125, 450, 45)),
];

const parent = uid("C4.2.4.1.4");
const unit = {
    $schema: "urn:structural-codes:schema:canonical-unit:v2",
    schemaVersion: "2.0.0-alpha.2",
    recordType: "canonical-unit",
    id: uid(unitNumber),
    workId,
    expressionId,
    kind: "subparagraph",
    numbering: { official: unitNumber, sortKey: unitNumber.replace(/^C/, "").split(".").map((part) => part.padStart(3, "0")).join(".") },
    title: "Spettri di carico",
    titleBlockId: `${uid(unitNumber)}#block-heading`,
    hierarchy: { parentId: parent, ancestorIds: [uid("C4.2"), uid("C4.2.4"), uid("C4.2.4.1"), parent], position: 1 },
    validity: { from: null, to: null, status: "unknown", asOf: "2026-08-09" },
    blocks,
    citations: [],
    relations: [],
    assets: { formulaIds: [], tableIds: [], figureIds: [] },
    workflow: {
        status: "extracted",
        createdBy: { actorId: "codex:circ42-step2m", kind: "automated-agent", toolVersion: profile },
        createdAt,
        reviews: [],
        openIssues: [
            { issueId: "circ2019-C4-2-4-1-4-1-source-review", type: "normalization-review", severity: "blocking", note: "Record trascritto dall’evidence ufficiale ma non ancora confrontato integralmente da un revisore umano con il render della fonte." },
        ],
    },
};

const manifest = {
    $schema: "urn:structural-codes:schema:asset-manifest:v2",
    schemaVersion: "2.0.0-alpha.1",
    recordType: "asset-manifest",
    document: "circ2019",
    section: "C4.2-step2m",
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
    writeFile(join(assetDirectory, "C4.2-step2m.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8"),
]);
console.log("Circolare C4.2 step2m: generate 1 unità e 1 matematica inline.");
