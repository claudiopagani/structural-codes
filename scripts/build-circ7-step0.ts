import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { sha256OfText } from "../src/lib/hash.ts";

const root = fileURLToPath(new URL("../", import.meta.url));
const unitDirectory = join(root, "corpus", "units", "circ2019");
const sourceId = "circ-7-2019";
const workId = "it-mit:circ:2019-01-21:7-csllpp";
const expressionId = "it-mit:circ:2019-01-21:7-csllpp:original-it";
const profile = "circ7-raster-blocked-profile-0.1.0";
const createdAt = "2026-08-10T00:00:00Z";

type Region = { coordinateSystem: "pdf-points-top-left"; x: number; y: number; width: number; height: number };
type HeadingSpec = { text: string; page: number; suffix?: string };

const uid = (number: string) => `urn:structural-codes:it:unit:circ2019:${number.toLowerCase()}`;
const hash = (value: string) => sha256OfText(value);
const pageRegion = (): Region => ({ coordinateSystem: "pdf-points-top-left", x: 73.9, y: 55, width: 450, height: 730 });
const pagePrinted = (page: number) => String(page - 4);

function evidence(page: number, value: string) {
    return {
        sourceId,
        pdfPage: page,
        printedPage: pagePrinted(page),
        region: pageRegion(),
        extraction: { method: "manual-transcription", tool: "codex-render-transcription", toolVersion: profile },
        transformations: [{ operation: "manual-correction", ruleVersion: profile, note: "Intestazione trascritta direttamente dal render ufficiale rasterizzato; il layer testuale della pagina contiene soltanto il piè di pagina." }],
        rawSha256: hash(value),
        normalizedSha256: hash(value),
    };
}

function headingBlock(number: string, spec: HeadingSpec, index: number) {
    const suffix = spec.suffix ?? (index === 0 ? "heading" : `heading-${index + 1}`);
    const blockId = `${uid(number)}#block-${suffix}`;
    return {
        blockId,
        kind: "heading",
        origin: "official",
        text: { raw: spec.text, normalized: spec.text, normalizationVersion: profile, inline: [{ kind: "text", value: spec.text }] },
        evidence: evidence(spec.page, spec.text),
    };
}

function parent(number: string) {
    const parts = number.split(".");
    return parts.length === 1 ? null : uid(parts.slice(0, -1).join("."));
}

function ancestors(number: string) {
    const parts = number.split(".");
    return parts.slice(1).map((_, index) => uid(parts.slice(0, index + 1).join(".")));
}

function scanIssue(number: string, pages: readonly number[], missing: string) {
    const pageLabel = pages.length === 1 ? `p. ${pages[0]}` : `pp. ${pages[0]}–${pages.at(-1)}`;
    return {
        issueId: `circ2019-${number.toLowerCase().replaceAll(".", "-")}-raster-blocker`,
        type: "ambiguous-source",
        severity: "blocking",
        note: `Le ${pageLabel} della Circolare sono scansioni prive di un layer testuale utilizzabile: l’evidence locale è in evidence/circ-7-2019/pages e nei render alla stessa directory. Sono state registrate solo le intestazioni leggibili; ${missing} La trascrizione completa richiede verifica umana diretta sul PDF ufficiale prima della pubblicazione.`,
    };
}

function makeUnit(number: string, title: string, pages: readonly number[], headings: readonly HeadingSpec[], missing: string) {
    const blocks = headings.map((spec, index) => headingBlock(number, spec, index));
    return {
        $schema: "urn:structural-codes:schema:canonical-unit:v2",
        schemaVersion: "2.0.0-alpha.2",
        recordType: "canonical-unit",
        id: uid(number),
        workId,
        expressionId,
        kind: number === "C7" ? "section" : "subparagraph",
        numbering: { official: number, sortKey: number.slice(1).split(".").map((part) => part.padStart(3, "0")).join(".") },
        title,
        titleBlockId: `${uid(number)}#block-heading`,
        hierarchy: { parentId: parent(number), ancestorIds: ancestors(number), position: Number(number.split(".").at(-1)?.replace(/^C/, "") ?? "1") },
        validity: { from: null, to: null, status: "unknown", asOf: "2026-08-10" },
        blocks,
        citations: [],
        relations: [],
        assets: { formulaIds: [], tableIds: [], figureIds: [] },
        workflow: {
            status: "extracted",
            createdBy: { actorId: "codex:circ7:step0", kind: "automated-agent", toolVersion: profile },
            createdAt,
            reviews: [],
            openIssues: [
                { issueId: `circ2019-${number.toLowerCase().replaceAll(".", "-")}-source-review`, type: "normalization-review", severity: "blocking", note: "Le intestazioni sono state confrontate con il render ufficiale; la revisione umana indipendente resta obbligatoria prima della pubblicazione." },
                scanIssue(number, pages, missing),
            ],
        },
    };
}

const specs = [
    ["C7", "PROGETTAZIONE PER AZIONI SISMICHE", [197], [{ text: "C7 PROGETTAZIONE PER AZIONI SISMICHE", page: 197 }], "la prosa introduttiva della pagina 197 resta da trascrivere."],
    ["C7.1", "REQUISITI NEI CONFRONTI DEGLI STATI LIMITE", [198], [{ text: "C7.1 REQUISITI NEI CONFRONTI DEGLI STATI LIMITE", page: 198 }], "la prosa e l’elenco puntato della pagina 198 restano da trascrivere."],
    ["C7.2", "CRITERI GENERALI DI PROGETTAZIONE E MODELLAZIONE", [199], [{ text: "C7.2 CRITERI GENERALI DI PROGETTAZIONE E MODELLAZIONE", page: 199 }], "la prosa della pagina 199 resta da trascrivere."],
    ["C7.2.1", "CARATTERISTICHE GENERALI DELLE COSTRUZIONI", [199], [{ text: "C7.2.1 CARATTERISTICHE GENERALI DELLE COSTRUZIONI", page: 199 }, { text: "Regolarità", page: 199 }, { text: "Distanza tra costruzioni contigue", page: 199 }], "la prosa, le Figure C7.2.1–C7.2.2 e le loro relazioni matematiche restano da trascrivere; [FIGURA_MANCANTE] per gli asset non ancora registrati."],
    ["C7.2.2", "CRITERI GENERALI DI PROGETTAZIONE DEI SISTEMI STRUTTURALI", [200, 201], [{ text: "C7.2.2 CRITERI GENERALI DI PROGETTAZIONE DEI SISTEMI STRUTTURALI", page: 200 }], "la prosa, gli elenchi e le note delle pagine 200–201 restano da trascrivere."],
    ["C7.2.3", "CRITERI DI PROGETTAZIONE DI ELEMENTI STRUTTURALI SECONDARI ED ELEMENTI COSTRUTTIVI NON STRUTTURALI", [201, 202, 203, 204], [{ text: "C7.2.3 CRITERI DI PROGETTAZIONE DI ELEMENTI STRUTTURALI SECONDARI ED ELEMENTI COSTRUTTIVI NON STRUTTURALI", page: 201 }, { text: "Elementi Secondari", page: 201 }, { text: "Elementi costruttivi non strutturali", page: 201 }, { text: "Spettri di risposta di piano", page: 201 }, { text: "Formulazione semplificata, a diverse quote, per elementi non strutturali, impianti, eventuali meccanismi locali", page: 202 }, { text: "Formulazione semplificata per costruzioni con struttura a telai", page: 203 }], "la prosa e le formule [C7.2.1]–[C7.2.11] restano da trascrivere; restano da registrare Tabella C7.2.I, Tabella C7.2.II e Figure C7.2.3–C7.2.4; [FIGURA_MANCANTE] per gli asset non ancora registrati."],
    ["C7.2.6", "CRITERI DI MODELLAZIONE DELLA STRUTTURA E DELL' AZIONE SISMICA", [205, 206, 207], [{ text: "C7.2.6 CRITERI DI MODELLAZIONE DELLA STRUTTURA E DELL' AZIONE SISMICA", page: 205 }, { text: "Modellazione della struttura", page: 205 }, { text: "Modellazione dell’azione sismica", page: 206 }], "la prosa e la nota delle pagine 205–207 restano da trascrivere; resta da registrare la Figura C7.2.5; [FIGURA_MANCANTE] per l’asset non ancora registrato."],
    ["C7.3", "METODI DI ANALISI E CRITERI DI VERIFICA", [207], [{ text: "C7.3 METODI DI ANALISI E CRITERI DI VERIFICA", page: 207 }], "la prosa di raccordo della pagina 207 resta da trascrivere."],
    ["C7.3.1", "ANALISI LINEARE O NON LINEARE", [207], [{ text: "C7.3.1 ANALISI LINEARE O NON LINEARE", page: 207 }], "la prosa, la formula [C7.3.1] e la nota della pagina 207 restano da trascrivere."],
    ["C7.3.3", "ANALISI LINEARE DINAMICA O STATICA", [208], [{ text: "C7.3.3 ANALISI LINEARE DINAMICA O STATICA", page: 208 }], "la prosa della pagina 208 resta da trascrivere."],
    ["C7.3.3.1", "ANALISI LINEARE DINAMICA", [208], [{ text: "C7.3.3.1 ANALISI LINEARE DINAMICA", page: 208 }], "la nota e la prosa della pagina 208 restano da trascrivere."],
    ["C7.3.3.2", "ANALISI LINEARE STATICA", [208], [{ text: "C7.3.3.2 ANALISI LINEARE STATICA", page: 208 }], "la prosa, la formula [C7.3.2] e le note della pagina 208 restano da trascrivere."],
    ["C7.3.4", "ANALISI NON LINEARE DINAMICA O STATICA", [209], [{ text: "C7.3.4 ANALISI NON LINEARE DINAMICA O STATICA", page: 209 }], "la prosa introduttiva della pagina 209 resta da trascrivere."],
    ["C7.3.4.1", "ANALISI NON LINEARE DINAMICA", [209], [{ text: "C7.3.4.1 ANALISI NON LINEARE DINAMICA", page: 209 }], "la prosa della pagina 209 resta da trascrivere."],
    ["C7.3.4.2", "ANALISI NON LINEARE STATICA", [209, 210, 211, 212], [{ text: "C7.3.4.2 ANALISI NON LINEARE STATICA", page: 209 }, { text: "Metodo A", page: 210 }, { text: "Metodo B", page: 210 }], "la prosa, le formule [C7.3.3]–[C7.3.10], le liste e le Figure C7.3.1–C7.3.5 delle pagine 209–212 restano da trascrivere; [FIGURA_MANCANTE] per gli asset non ancora registrati."],
    ["C7.3.5", "RISPOSTA ALLE DIVERSE COMPONENTI DELL’AZIONE SISMICA ED ALLA VARIABILITÀ SPAZIALE DEL MOTO", [212, 213], [{ text: "C7.3.5 RISPOSTA ALLE DIVERSE COMPONENTI DELL’AZIONE SISMICA ED ALLA VARIABILITÀ SPAZIALE DEL MOTO", page: 212 }], "la prosa delle pagine 212–213 resta da trascrivere."],
    ["C7.3.6", "RISPETTO DEI REQUISITI NEI CONFRONTI DEGLI STATI LIMITE", [212, 213], [{ text: "C7.3.6 RISPETTO DEI REQUISITI NEI CONFRONTI DEGLI STATI LIMITE", page: 212 }], "la prosa e la Tabella C7.3.I delle pagine 212–213 restano da trascrivere; [TABELLA_MANCANTE] per l’asset non ancora registrato."],
] as const;

await mkdir(unitDirectory, { recursive: true });
await Promise.all(specs.map(([number, title, pages, headings, missing]) => writeFile(join(unitDirectory, `${number.toLowerCase()}.json`), `${JSON.stringify(makeUnit(number, title, pages, headings, missing), null, 2)}\n`, "utf8")));
console.log(`generated ${specs.length} blocked heading units for Circ C7 pp197-213`);
