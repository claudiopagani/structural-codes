/* eslint-disable @typescript-eslint/no-explicit-any */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../", import.meta.url));
const sourceId = "gu-so8-2018-ntc";
const profile = "ntc77-editorial-profile-0.1.0";
const actor = { actorId: "generator:ntc77:step1", kind: "script", toolVersion: profile };
const createdAt = "2026-08-09T00:00:00Z";

const evidenceFile = join(repoRoot, "evidence", sourceId, "pages", "page-0258.raw.txt");
const pageLines = (await readFile(evidenceFile, "utf8")).replace(/\r\n/gu, "\n").split("\n");

function raw(from: number, to = from): string {
    return pageLines.slice(from - 1, to).join("\n");
}

function sha256(value: string): string {
    return createHash("sha256").update(value, "utf8").digest("hex");
}

function clean(source: string): string {
    return source.replace(/\n/gu, " ").replace(/\s+/gu, " ").trim();
}

function transformations(source: string, normalized: string): any[] {
    if (source === normalized) return [];
    const operations: any[] = [];
    if (source.includes("\n")) {
        operations.push({
            operation: "join-line-wrap",
            ruleVersion: profile,
            note: "Ricomposti i ritorni a capo esclusivamente tipografici verificati sul render ufficiale.",
        });
    }
    if (normalized !== clean(source)) {
        operations.push({
            operation: "manual-correction",
            ruleVersion: profile,
            note: "Rimossi i marcatori tipografici dell’elenco e ricostruiti i capoversi verificati sul render ufficiale.",
        });
    }
    operations.push({ operation: "normalize-whitespace", ruleVersion: profile, note: "Uniformati gli spazi dopo la ricomposizione editoriale." });
    operations.push({ operation: "unicode-nfc", ruleVersion: profile, note: "Testo normalizzato in Unicode NFC." });
    return operations;
}

function evidence(source: string, normalized: string): any {
    return {
        sourceId,
        pdfPage: 258,
        printedPage: "254",
        region: null,
        extraction: { method: "pdf-text", tool: "pdfjs-dist", toolVersion: "4.10.38" },
        transformations: transformations(source, normalized),
        rawSha256: sha256(source),
        normalizedSha256: sha256(normalized),
    };
}

type MathTerm = { value: string; latex: string };
const gammaRd: MathTerm = { value: "γ_Rd", latex: "\\gamma_{Rd}" };
const oneThree: MathTerm = { value: "1,3", latex: "1{,}3" };
const oneOne: MathTerm = { value: "1,1", latex: "1{,}1" };

function inlineSegments(text: string, terms: MathTerm[]): any[] | undefined {
    const unique = [...new Map(terms.map((term) => [term.value, term])).values()];
    if (!unique.some((term) => text.includes(term.value))) return undefined;
    const segments: any[] = [];
    let cursor = 0;
    while (cursor < text.length) {
        let match: { index: number; term: MathTerm } | undefined;
        for (const term of unique) {
            const index = text.indexOf(term.value, cursor);
            if (index >= 0 && (match === undefined || index < match.index)) match = { index, term };
        }
        if (!match) {
            segments.push({ kind: "text", value: text.slice(cursor) });
            break;
        }
        if (match.index > cursor) segments.push({ kind: "text", value: text.slice(cursor, match.index) });
        segments.push({ kind: "math", value: match.term.value, latex: match.term.latex });
        cursor = match.index + match.term.value.length;
    }
    return segments.filter(({ value }) => value.length > 0);
}

type TextSpec = {
    kind: "heading" | "paragraph" | "list-item";
    from: number;
    to?: number;
    normalized?: string;
    math?: MathTerm[];
};
type UnitSpec = {
    number: string;
    title: string;
    heading: TextSpec;
    blocks?: TextSpec[];
    extraIssues?: any[];
};

const idFor = (number: string): string => `urn:structural-codes:it:unit:ntc2018:${number}`;
const sortKey = (number: string): string => number.split(".").map((part) => part.padStart(3, "0")).join(".");
const ancestors = (number: string): string[] => {
    const parts = number.split(".");
    return parts.slice(1).map((_, index) => idFor(parts.slice(0, index + 1).join(".")));
};
const position = (number: string): number => Number(number.split(".").at(-1));
const unitKind = (number: string): string => {
    const depth = number.split(".").length;
    if (depth === 1) return "chapter";
    if (depth === 2) return "section";
    if (depth === 3) return "paragraph";
    return "subparagraph";
};

function textBlock(unitId: string, blockId: string, spec: TextSpec): any {
    const source = raw(spec.from, spec.to);
    const normalized = spec.normalized ?? clean(source);
    const inline = inlineSegments(normalized, spec.math ?? []);
    return {
        blockId: `${unitId}#${blockId}`,
        kind: spec.kind,
        origin: "official",
        text: { raw: source, normalized, normalizationVersion: profile, ...(inline ? { inline } : {}) },
        evidence: evidence(source, normalized),
    };
}

const h = (from: number, normalized: string): TextSpec => ({ kind: "heading", from, normalized });

const units: UnitSpec[] = [
    {
        number: "7.7",
        title: "COSTRUZIONI DI LEGNO",
        heading: h(9, "7.7 COSTRUZIONI DI LEGNO"),
        blocks: [
            { kind: "paragraph", from: 10 },
            { kind: "list-item", from: 11, to: 12, normalized: "duttilità statica: si intende il rapporto tra lo spostamento ultimo e lo spostamento al limite del comportamento elastico, valutati con prove quasi-statiche in accordo alle pertinenti normative sui metodi di prova per le strutture di legno;" },
            { kind: "list-item", from: 13, to: 14, normalized: "nodi semi-rigidi: giunzioni con deformabilità significativa, tale da dovere essere presa in considerazione nelle analisi strutturali e da valutarsi secondo documenti di comprovata validità;" },
            { kind: "list-item", from: 15, to: 16, normalized: "nodi rigidi: giunzioni con deformabilità trascurabile ai fini del comportamento strutturale, da valutarsi secondo documenti di comprovata validità;" },
            { kind: "list-item", from: 17, to: 18, normalized: "unioni con mezzi di unione a gambo cilindrico: unioni realizzate con mezzi meccanici a gambo cilindrico (chiodi, viti, spinotti, bulloni ecc.), sollecitati perpendicolarmente al loro asse;" },
            { kind: "list-item", from: 19, to: 21, normalized: "nodi di carpenteria: collegamenti nei quali le azioni sono trasferite per mezzo di zone di contatto, e senza l’utilizzo di mezzi di unione meccanici; esempi di giunzioni di questo tipo sono: l’incastro a dente semplice, il giunto tenone-mortasa, il giunto a mezzo legno ed altri tipi frequentemente utilizzati nelle costruzioni tradizionali." },
        ],
        extraIssues: [{
            issueId: "ntc2018-7-7-run-in-emphasis",
            type: "other",
            severity: "blocking",
            note: "Le cinque definizioni sono stampate con l’etichetta iniziale in grassetto; lo schema inline v2 rappresenta solo segmenti text/math, quindi l’enfasi tipografica run-in non è conservabile come struttura distinta. Verificare la resa editoriale prima della pubblicazione.",
        }],
    },
    {
        number: "7.7.1",
        title: "ASPETTI CONCETTUALI DELLA PROGETTAZIONE",
        heading: h(22, "7.7.1 ASPETTI CONCETTUALI DELLA PROGETTAZIONE"),
        blocks: [
            { kind: "paragraph", from: 23, to: 24 },
            { kind: "list-item", from: 25 },
            { kind: "list-item", from: 26 },
            { kind: "paragraph", from: 27, to: 28 },
            { kind: "paragraph", from: 29, to: 32 },
            { kind: "paragraph", from: 33, to: 38, math: [gammaRd, oneThree, oneOne], normalized: "Ai fini dell’applicazione dei criteri della progettazione in capacità, per assicurare la plasticizzazione delle zone dissipative (i collegamenti prescelti e/o gli elementi specificatamente progettati), queste devono possedere una capacità almeno pari alla domanda mentre le componenti non dissipative (gli altri collegamenti e gli elementi strutturali) adiacenti, debbono possedere una capacità pari alla capacità della zona dissipativa amplificata del fattore di sovraresistenza γ_Rd, di cui alla Tab. 7.2.I; valori inferiori del fattore di sovraresistenza ed in ogni caso maggiori o uguali a 1,3 per CD “A” e a 1,1 per CD “B” devono essere giustificati sulla base di idonee evidenze teorico-sperimentali." },
            { kind: "paragraph", from: 39, to: 40 },
            { kind: "paragraph", from: 41, to: 42 },
        ],
    },
    {
        number: "7.7.2",
        title: "MATERIALI E PROPRIETÀ DELLE ZONE DISSIPATIVE",
        heading: h(43, "7.7.2 MATERIALI E PROPRIETÀ DELLE ZONE DISSIPATIVE"),
        blocks: [
            { kind: "paragraph", from: 44, to: 45 },
            { kind: "paragraph", from: 46, to: 47 },
            { kind: "list-item", from: 48, to: 49 },
            { kind: "list-item", from: 50, to: 51 },
            { kind: "list-item", from: 52, to: 54 },
        ],
    },
];

const outputDirectory = join(repoRoot, "corpus", "units", "ntc2018");
await mkdir(outputDirectory, { recursive: true });

for (const spec of units) {
    const unitId = idFor(spec.number);
    const blocks: any[] = [textBlock(unitId, "block-heading", spec.heading)];
    let counter = 1;
    for (const blockSpec of spec.blocks ?? []) {
        blocks.push(textBlock(unitId, `block-editorial-${String(counter).padStart(3, "0")}`, blockSpec));
        counter += 1;
    }
    const parentParts = spec.number.split(".");
    parentParts.pop();
    const record = {
        $schema: "urn:structural-codes:schema:canonical-unit:v2",
        schemaVersion: "2.0.0-alpha.2",
        recordType: "canonical-unit",
        id: unitId,
        workId: "it-mit:dm:2018-01-17:ntc2018",
        expressionId: "it-mit:dm:2018-01-17:ntc2018:original-it",
        kind: unitKind(spec.number),
        numbering: { official: spec.number, sortKey: sortKey(spec.number) },
        title: spec.title,
        titleBlockId: `${unitId}#block-heading`,
        hierarchy: { parentId: idFor(parentParts.join(".")), ancestorIds: ancestors(spec.number), position: position(spec.number) },
        validity: { from: "2018-03-22", to: null, status: "in-force", asOf: "2026-08-09" },
        blocks,
        citations: [],
        relations: [],
        assets: { formulaIds: [], tableIds: [], figureIds: [] },
        workflow: {
            status: "extracted",
            createdBy: actor,
            createdAt,
            reviews: [],
            openIssues: [
                { issueId: `ntc2018-${spec.number.replaceAll(".", "-")}-source-review`, type: "normalization-review", severity: "blocking", note: "Trascrizione confrontata con il render ufficiale dello step; resta obbligatoria la revisione umana indipendente." },
                ...(spec.extraIssues ?? []),
            ],
        },
    };
    await writeFile(join(outputDirectory, `${spec.number}.json`), `${JSON.stringify(record, null, 2)}\n`, "utf8");
}

const manifest = {
    $schema: "urn:structural-codes:schema:asset-manifest:v2",
    schemaVersion: "2.0.0-alpha.1",
    recordType: "asset-manifest",
    document: "ntc2018",
    section: "7.7-step1",
    sourceId,
    status: "transcribed-unreviewed",
    formulas: [],
    tables: [],
    figures: [],
};
await mkdir(join(repoRoot, "corpus", "assets", "ntc2018"), { recursive: true });
await writeFile(join(repoRoot, "corpus", "assets", "ntc2018", "7.7-step1.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(`ntc77-step1: generate ${units.length} unità senza asset`);
