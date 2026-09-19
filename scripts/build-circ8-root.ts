import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { sha256OfText } from "../src/lib/hash.ts";

const root = fileURLToPath(new URL("../", import.meta.url));
const unitDirectory = join(root, "corpus", "units", "circ2019");
const sourceId = "circ-7-2019";
const workId = "it-mit:circ:2019-01-21:7-csllpp";
const expressionId = "it-mit:circ:2019-01-21:7-csllpp:original-it";
const profile = "circ8-root-editorial-profile-0.2.0";
const value = "C8 COSTRUZIONI ESISTENTI";

const id = "urn:structural-codes:it:unit:circ2019:c8";
const evidence = {
    sourceId,
    pdfPage: 253,
    printedPage: "249",
    region: { coordinateSystem: "pdf-points-top-left", x: 73.9, y: 55, width: 450, height: 730 },
    extraction: { method: "manual-transcription", tool: "codex-render-transcription", toolVersion: profile },
    transformations: [{ operation: "manual-correction", ruleVersion: profile, note: "Titolo del capitolo trascritto direttamente dal render ufficiale rasterizzato; il layer testuale della pagina non contiene il titolo." }],
    rawSha256: sha256OfText(value),
    normalizedSha256: sha256OfText(value),
};

const introductoryParagraphs = [
    {
        raw: "Le costruzioni esistenti rappresentano certamente argomento particolarmente significativo nell’ambito dell’applicazione delle\nNTC. Rispetto al D.M.14 gennaio 2008 la norma riporta alcune modifiche la cui portata concettuale assume però particolare\nrilievo.",
        normalized: "Le costruzioni esistenti rappresentano certamente argomento particolarmente significativo nell’ambito dell’applicazione delle NTC. Rispetto al D.M.14 gennaio 2008 la norma riporta alcune modifiche la cui portata concettuale assume però particolare rilievo.",
    },
    {
        raw: "L’importanza che le criticità locali assumono negli edifici esistenti, in termini di danni a persone e cose, ha portato, fra l’altro, a\nconsiderare con maggiore attenzione gli interventi locali di rafforzamento e gli interventi di miglioramento.",
        normalized: "L’importanza che le criticità locali assumono negli edifici esistenti, in termini di danni a persone e cose, ha portato, fra l’altro, a considerare con maggiore attenzione gli interventi locali di rafforzamento e gli interventi di miglioramento.",
    },
    {
        raw: "Tale maggiore attenzione si è anche tradotta in un diverso ordine di presentazione (le varie forme d’intervento sono ora elencate\ndalla meno alla più importante, dalla riparazione e rafforzamento locale all’adeguamento), nella diversa definizione\ndell’intervento di adeguamento e nell’ampia considerazione dedicata alla valutazione e riduzione del rischio sismico e, in special\nmodo, nella maggiore attenzione prestata agli interventi finalizzati a ridurre la vulnerabilità delle costruzioni esistenti.",
        normalized: "Tale maggiore attenzione si è anche tradotta in un diverso ordine di presentazione (le varie forme d’intervento sono ora elencate dalla meno alla più importante, dalla riparazione e rafforzamento locale all’adeguamento), nella diversa definizione dell’intervento di adeguamento e nell’ampia considerazione dedicata alla valutazione e riduzione del rischio sismico e, in special modo, nella maggiore attenzione prestata agli interventi finalizzati a ridurre la vulnerabilità delle costruzioni esistenti.",
    },
    {
        raw: "La presente Circolare, quindi, fornisce istruzioni operative per la corretta ed uniforme applicazione dei principi riportati nel\nCapitolo 8 delle NTC. Si osserva, in particolare, come molti dei contenuti delle Appendici della Circolare 617 C.S.LL.PP. del 2\nfebbraio 2009, sono ora ricondotti a questo testo.",
        normalized: "La presente Circolare, quindi, fornisce istruzioni operative per la corretta ed uniforme applicazione dei principi riportati nel Capitolo 8 delle NTC. Si osserva, in particolare, come molti dei contenuti delle Appendici della Circolare 617 C.S.LL.PP. del 2 febbraio 2009, sono ora ricondotti a questo testo.",
    },
].map((paragraph, index) => ({
    blockId: `${id}#block-intro-${String(index + 1).padStart(3, "0")}`,
    kind: "paragraph",
    origin: "official",
    text: { raw: paragraph.raw, normalized: paragraph.normalized, normalizationVersion: profile },
    evidence: {
        sourceId,
        pdfPage: 254,
        printedPage: "250",
        region: null,
        extraction: { method: "manual-transcription", tool: "codex-render-transcription", toolVersion: profile },
        transformations: [
            { operation: "join-line-wrap", ruleVersion: profile, note: "Rimossi gli a capo introdotti dall’impaginazione, conservando i quattro capoversi reali dell’introduzione." },
            { operation: "unicode-nfc", ruleVersion: profile, note: "Testo normalizzato in Unicode NFC." },
        ],
        rawSha256: sha256OfText(paragraph.raw),
        normalizedSha256: sha256OfText(paragraph.normalized),
    },
}));

const unit = {
    $schema: "urn:structural-codes:schema:canonical-unit:v2",
    schemaVersion: "2.0.0-alpha.2",
    recordType: "canonical-unit",
    id,
    workId,
    expressionId,
    kind: "section",
    numbering: { official: "C8", sortKey: "008" },
    title: "COSTRUZIONI ESISTENTI",
    titleBlockId: `${id}#block-heading`,
    hierarchy: { parentId: null, ancestorIds: [], position: 8 },
    validity: { from: null, to: null, status: "unknown", asOf: "2026-08-10" },
    blocks: [{ blockId: `${id}#block-heading`, kind: "heading", origin: "official", text: { raw: value, normalized: value, normalizationVersion: profile, inline: [{ kind: "text", value }] }, evidence }, ...introductoryParagraphs],
    citations: [],
    relations: [],
    assets: { formulaIds: [], tableIds: [], figureIds: [] },
    workflow: {
        status: "extracted",
        createdBy: { actorId: "codex:circ8:root", kind: "automated-agent", toolVersion: profile },
        createdAt: "2026-08-10T00:00:00Z",
        reviews: [],
        openIssues: [
            { issueId: "circ2019-c8-source-review", type: "normalization-review", severity: "blocking", note: "Titolo e introduzione confrontati con il render ufficiale; la revisione umana indipendente resta obbligatoria prima della pubblicazione." },
        ],
    },
};

await mkdir(unitDirectory, { recursive: true });
await writeFile(join(unitDirectory, "c8.json"), `${JSON.stringify(unit, null, 2)}\n`, "utf8");
console.log("generated Circ C8 root unit for PDF page 253");
