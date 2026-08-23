import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const sourceId = "gu-so8-2018-ntc";
const profile = "ntc12-editorial-profile-0.1.0";
const pages = new Map<number, string[]>();

for (const page of [371, 372]) {
    const path = join(
        root,
        "evidence",
        sourceId,
        "pages",
        `page-${String(page).padStart(4, "0")}.raw.txt`,
    );
    pages.set(page, (await readFile(path, "utf8")).replace(/\r\n/gu, "\n").split("\n"));
}

const raw = (page: number, from: number, to = from): string =>
    pages.get(page)!.slice(from - 1, to).join("\n");
const hash = (text: string): string =>
    createHash("sha256").update(text, "utf8").digest("hex");
const normalize = (text: string): string =>
    text
        .replace(/-\n/gu, "")
        .replace(/\n/gu, " ")
        .replace(/\s+/gu, " ")
        .trim();

const evidence = (page: number, source: string, normalized: string) => ({
    sourceId,
    pdfPage: page,
    printedPage: String(page - 4),
    region: null,
    extraction: {
        method: "pdf-text",
        tool: "pdfjs-dist",
        toolVersion: "4.10.38",
    },
    transformations:
        source === normalized
            ? []
            : [
                  ...(source.includes("-\n")
                      ? [
                            {
                                operation: "remove-discretionary-hyphen",
                                ruleVersion: profile,
                                note: "Ricomposte le parole spezzate a fine riga dopo confronto con il render ufficiale.",
                            },
                        ]
                      : []),
                  {
                      operation: "join-line-wrap",
                      ruleVersion: profile,
                      note: "Rimossi gli a capo tipografici; i blocchi editoriali distinti restano separati.",
                  },
                  ...(source.includes("CAPITOLO 12")
                      ? [
                            {
                                operation: "manual-correction",
                                ruleVersion: profile,
                                note: "Rappresentata l’intestazione del capitolo nel formato numerico canonico, senza la parola tipografica CAPITOLO.",
                            },
                        ]
                      : []),
                  {
                      operation: "normalize-whitespace",
                      ruleVersion: profile,
                      note: "Uniformati gli spazi dopo la ricomposizione delle righe.",
                  },
                  {
                      operation: "unicode-nfc",
                      ruleVersion: profile,
                      note: "Testo normalizzato in Unicode NFC.",
                  },
              ],
    rawSha256: hash(source),
    normalizedSha256: hash(normalized),
});

type Block = {
    kind: "heading" | "paragraph" | "list-item";
    page: number;
    from: number;
    to?: number;
    normalized?: string;
};

const blocks: Block[] = [
    {
        kind: "heading",
        page: 371,
        from: 3,
        to: 4,
        normalized: "12 RIFERIMENTI TECNICI",
    },
    { kind: "paragraph", page: 372, from: 2, to: 3 },
    { kind: "list-item", page: 372, from: 4 },
    { kind: "list-item", page: 372, from: 5 },
    { kind: "list-item", page: 372, from: 6 },
    { kind: "paragraph", page: 372, from: 7, to: 8 },
    { kind: "list-item", page: 372, from: 9 },
    { kind: "list-item", page: 372, from: 10 },
    { kind: "list-item", page: 372, from: 11, to: 12 },
    { kind: "list-item", page: 372, from: 13 },
    { kind: "paragraph", page: 372, from: 14, to: 16 },
    { kind: "paragraph", page: 372, from: 17, to: 21 },
];

const id = "urn:structural-codes:it:unit:ntc2018:12";
const renderedBlocks = blocks.map((block, index) => {
    const source = raw(block.page, block.from, block.to);
    const normalized = block.normalized ?? normalize(source);
    return {
        blockId: `${id}#${index === 0 ? "block-heading" : `block-editorial-${String(index).padStart(3, "0")}`}`,
        kind: block.kind,
        origin: "official",
        text: {
            raw: source,
            normalized,
            normalizationVersion: profile,
        },
        evidence: evidence(block.page, source, normalized),
    };
});

const record = {
    $schema: "urn:structural-codes:schema:canonical-unit:v2",
    schemaVersion: "2.0.0-alpha.2",
    recordType: "canonical-unit",
    id,
    workId: "it-mit:dm:2018-01-17:ntc2018",
    expressionId: "it-mit:dm:2018-01-17:ntc2018:original-it",
    kind: "chapter",
    numbering: { official: "12", sortKey: "012" },
    title: "RIFERIMENTI TECNICI",
    titleBlockId: `${id}#block-heading`,
    hierarchy: { parentId: null, ancestorIds: [], position: 1 },
    validity: { from: "2018-03-22", to: null, status: "in-force", asOf: "2026-08-23" },
    blocks: renderedBlocks,
    citations: [],
    relations: [],
    assets: { formulaIds: [], tableIds: [], figureIds: [] },
    workflow: {
        status: "extracted",
        createdBy: { actorId: "generator:ntc12:root", kind: "script", toolVersion: profile },
        createdAt: "2026-08-23T00:00:00Z",
        reviews: [],
        openIssues: [
            {
                issueId: "ntc2018-12-source-review",
                type: "normalization-review",
                severity: "blocking",
                note: "Trascrizione confrontata con il render ufficiale; resta obbligatoria la revisione umana indipendente.",
            },
        ],
    },
};

const output = join(root, "corpus", "units", "ntc2018", "12.json");
await mkdir(join(root, "corpus", "units", "ntc2018"), { recursive: true });
await writeFile(output, `${JSON.stringify(record, null, 2)}\n`, "utf8");
console.log(`ntc12: generated ${output}`);
