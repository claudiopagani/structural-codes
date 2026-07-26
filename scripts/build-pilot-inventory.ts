import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

interface PilotDocument {
    document: "ntc2018" | "circ2019";
    sourceId: string;
    pages: { from: number; to: number };
    expectedHeadings: string[];
    expectedNumberedAssets: {
        formulaLabels: string[];
        tableLabels: string[];
        figureLabels: string[];
        includeUnnumberedFormulas: boolean;
    };
    manualHeadingConfirmations?: Array<{
        numbering: string;
        title: string;
        pdfPage: number;
        method: "visual-render";
        renderSha256: string;
        confirmedBy: string;
        confirmedAt: string;
        note: string;
    }>;
}

interface PilotConfig {
    pilotVersion: number;
    status: string;
    asOf: string;
    documents: PilotDocument[];
    proposedTopLevelMappings: Array<[string, string]>;
    notes: string[];
}

interface PageRecord {
    pipelineVersion: string;
    sourceId: string;
    pdfPage: number;
    printedPage: string | null;
    pageRecordSha256: string;
    rawText: string;
    anomalies: {
        controlCharacters: unknown[];
        replacementCharacterCount: number;
        softHyphenCount: number;
        lineEndHyphenCount: number;
        rotatedItemSequences: number[];
    };
}

const repoRoot = fileURLToPath(new URL("../", import.meta.url));
const config = JSON.parse(
    await readFile(
        join(repoRoot, "pilot", "section-3.3.config.json"),
        "utf8",
    ),
) as PilotConfig;

function candidateHeading(
    line: string,
    document: PilotDocument["document"],
): { numbering: string; title: string } | null {
    const cleaned = line
        .replace(/[\u0000-\u001F\u007F]/gu, " ")
        .replace(/\s+/gu, " ")
        .trim();
    const pattern =
        document === "ntc2018"
            ? /^(?:3)?(3\.3(?:\.\d+)*)(?:\.)?\s+(.+)$/u
            : /^(C3\.3(?:\.\d+)*)\s+(.+)$/u;
    const match = pattern.exec(cleaned);
    if (match === null) return null;
    return { numbering: match[1]!, title: match[2]!.trim() };
}

const results = [];
for (const document of config.documents) {
    const expected = new Set(document.expectedHeadings);
    const detected = new Map<
        string,
        {
            numbering: string;
            title: string;
            pdfPage: number;
            printedPage: string | null;
            pageRecordSha256: string;
            detection: "text-extraction" | "visual-confirmation";
            visualConfirmation?: {
                method: "visual-render";
                renderSha256: string;
                confirmedBy: string;
                confirmedAt: string;
                note: string;
            };
        }
    >();
    const pagesByNumber = new Map<number, PageRecord>();
    const pageSummaries = [];
    const assetCandidates = {
        formulaLabels: new Set<string>(),
        tableLabels: new Set<string>(),
        figureLabels: new Set<string>(),
    };
    for (
        let pageNumber = document.pages.from;
        pageNumber <= document.pages.to;
        pageNumber += 1
    ) {
        const pageFile = join(
            repoRoot,
            "evidence",
            document.sourceId,
            "pages",
            `page-${String(pageNumber).padStart(4, "0")}.json`,
        );
        let page: PageRecord;
        try {
            page = JSON.parse(await readFile(pageFile, "utf8")) as PageRecord;
        } catch {
            throw new Error(
                `evidence mancante: ${document.sourceId} pagina ${pageNumber}; eseguire extract:evidence sul range del pilota`,
            );
        }
        pagesByNumber.set(page.pdfPage, page);
        for (const line of page.rawText.split(/\r?\n/gu)) {
            const heading = candidateHeading(line, document.document);
            if (
                heading !== null &&
                expected.has(heading.numbering) &&
                !detected.has(heading.numbering)
            ) {
                detected.set(heading.numbering, {
                    ...heading,
                    pdfPage: page.pdfPage,
                    printedPage: page.printedPage,
                    pageRecordSha256: page.pageRecordSha256,
                    detection: "text-extraction",
                });
            }
        }
        for (const match of page.rawText.matchAll(
            /(?:\[|>)(C?3\.3(?:\.\d+)+(?:\.[a-z])?)(?:\]|@)/gu,
        )) {
            assetCandidates.formulaLabels.add(match[1]!);
        }
        for (const match of page.rawText.matchAll(
            /(?:Tab\.|Tabella)\s+(C?3\.3\.[IVX]+|3\.3\.[IVX]+)/giu,
        )) {
            assetCandidates.tableLabels.add(match[1]!);
        }
        for (const match of page.rawText.matchAll(
            /(?:Fig\.|Figura)\s+(C?3\.3\.\d+)/giu,
        )) {
            assetCandidates.figureLabels.add(match[1]!);
        }
        pageSummaries.push({
            pdfPage: page.pdfPage,
            printedPage: page.printedPage,
            pageRecordSha256: page.pageRecordSha256,
            anomalyCounts: {
                controls: page.anomalies.controlCharacters.length,
                replacements: page.anomalies.replacementCharacterCount,
                softHyphens: page.anomalies.softHyphenCount,
                lineEndHyphens: page.anomalies.lineEndHyphenCount,
                rotatedItems: page.anomalies.rotatedItemSequences.length,
            },
        });
    }
    const machineDetectedHeadings = detected.size;
    for (const confirmation of document.manualHeadingConfirmations ?? []) {
        if (!expected.has(confirmation.numbering)) {
            throw new Error(
                `conferma visuale inattesa: ${document.document} ${confirmation.numbering}`,
            );
        }
        const page = pagesByNumber.get(confirmation.pdfPage);
        if (page === undefined) {
            throw new Error(
                `pagina della conferma visuale fuori range: ${document.document} ${confirmation.numbering}`,
            );
        }
        if (!/^[a-f0-9]{64}$/u.test(confirmation.renderSha256)) {
            throw new Error(
                `renderSha256 non valido: ${document.document} ${confirmation.numbering}`,
            );
        }
        detected.set(confirmation.numbering, {
            numbering: confirmation.numbering,
            title: confirmation.title,
            pdfPage: confirmation.pdfPage,
            printedPage: page.printedPage,
            pageRecordSha256: page.pageRecordSha256,
            detection: "visual-confirmation",
            visualConfirmation: {
                method: confirmation.method,
                renderSha256: confirmation.renderSha256,
                confirmedBy: confirmation.confirmedBy,
                confirmedAt: confirmation.confirmedAt,
                note: confirmation.note,
            },
        });
    }
    const missingHeadings = document.expectedHeadings.filter(
        (numbering) => !detected.has(numbering),
    );
    const visuallyConfirmedHeadings = [...detected.values()].filter(
        (heading) => heading.detection === "visual-confirmation",
    ).length;
    const mechanicallyDetectedAssets = {
        formulaLabels: document.expectedNumberedAssets.formulaLabels.filter((label) =>
            assetCandidates.formulaLabels.has(label),
        ),
        tableLabels: document.expectedNumberedAssets.tableLabels.filter((label) =>
            assetCandidates.tableLabels.has(label),
        ),
        figureLabels: document.expectedNumberedAssets.figureLabels.filter((label) =>
            assetCandidates.figureLabels.has(label),
        ),
    };
    const notMechanicallyDetectedAssets = {
        formulaLabels: document.expectedNumberedAssets.formulaLabels.filter(
            (label) => !assetCandidates.formulaLabels.has(label),
        ),
        tableLabels: document.expectedNumberedAssets.tableLabels.filter(
            (label) => !assetCandidates.tableLabels.has(label),
        ),
        figureLabels: document.expectedNumberedAssets.figureLabels.filter(
            (label) => !assetCandidates.figureLabels.has(label),
        ),
    };
    results.push({
        document: document.document,
        sourceId: document.sourceId,
        range: document.pages,
        coverage: {
            expectedHeadings: document.expectedHeadings.length,
            machineDetectedHeadings,
            visuallyConfirmedHeadings,
            coveredHeadings: detected.size,
            missingHeadings,
            complete: missingHeadings.length === 0,
        },
        headings: document.expectedHeadings.flatMap((numbering) => {
            const heading = detected.get(numbering);
            return heading === undefined ? [] : [heading];
        }),
        assetCandidates: {
            formulaLabels: [...assetCandidates.formulaLabels].sort(),
            tableLabels: [...assetCandidates.tableLabels].sort(),
            figureLabels: [...assetCandidates.figureLabels].sort(),
            disclaimer:
                "Candidati rilevati per pattern: non sono asset verificati né un conteggio definitivo.",
        },
        expectedNumberedAssets: {
            ...document.expectedNumberedAssets,
            source: "visual-range-inventory",
            status: "inventory-only",
            mechanicallyDetected: mechanicallyDetectedAssets,
            notMechanicallyDetected: notMechanicallyDetectedAssets,
            disclaimer:
                "Le etichette attese derivano dall'inventario visuale del range. Non attestano ancora trascrizione, regione o hash del singolo asset.",
        },
        pages: pageSummaries,
    });
}

const result = {
    inventoryVersion: 2,
    status: "heading-inventory-reviewed",
    asOf: config.asOf,
    disclaimer:
        "Inventario del pilota con rilevazione meccanica e conferme visuali esplicite. Non contiene ancora testo canonico né asset verificati.",
    documents: results,
    proposedTopLevelMappings: config.proposedTopLevelMappings.map(
        ([circular, ntc]) => ({
            circular,
            ntc,
            status: "proposed",
            confirmedBy: null,
        }),
    ),
};
const outDir = join(repoRoot, "reports", "pilot");
await mkdir(outDir, { recursive: true });
await writeFile(
    join(outDir, "section-3.3.inventory.json"),
    `${JSON.stringify(result, null, 2)}\n`,
    "utf8",
);

const markdown: string[] = [
    "# Inventario pilota §3.3 / C3.3",
    "",
    "> Inventario delle intestazioni verificato; non è ancora testo normativo canonico.",
    "",
];
for (const document of results) {
    markdown.push(
        `## ${document.document}`,
        "",
        `- Pagine PDF: ${document.range.from}–${document.range.to}`,
        `- Heading coperti: ${document.coverage.coveredHeadings}/${document.coverage.expectedHeadings}`,
        `- Rilevati dal testo: ${document.coverage.machineDetectedHeadings}`,
        `- Confermati visualmente: ${document.coverage.visuallyConfirmedHeadings}`,
        `- Heading mancanti: ${
            document.coverage.missingHeadings.length === 0
                ? "nessuno"
                : document.coverage.missingHeadings.join(", ")
        }`,
        `- Candidati formula: ${document.assetCandidates.formulaLabels.length}`,
        `- Candidati tabella: ${document.assetCandidates.tableLabels.length}`,
        `- Candidati figura: ${document.assetCandidates.figureLabels.length}`,
        `- Formule numerate attese dall'inventario visuale: ${document.expectedNumberedAssets.formulaLabels.length}`,
        `- Tabelle numerate attese dall'inventario visuale: ${document.expectedNumberedAssets.tableLabels.length}`,
        `- Figure numerate attese dall'inventario visuale: ${document.expectedNumberedAssets.figureLabels.length}`,
        `- Formule non numerate: ${document.expectedNumberedAssets.includeUnnumberedFormulas ? "incluse nel perimetro" : "escluse"}`,
        "",
        "| Numero | Titolo | Metodo | PDF | Stampata |",
        "|---|---|---|---:|---:|",
    );
    for (const heading of document.headings) {
        markdown.push(
            `| ${heading.numbering} | ${heading.title.replaceAll("|", "\\|")} | ${heading.detection} | ${heading.pdfPage} | ${heading.printedPage ?? "—"} |`,
        );
    }
    markdown.push("");
}
markdown.push(
    "## Mapping top-level",
    "",
    `Tutti i ${result.proposedTopLevelMappings.length} mapping sono proposti e non confermati.`,
    "",
);
await writeFile(
    join(outDir, "section-3.3.inventory.md"),
    `${markdown.join("\n")}\n`,
    "utf8",
);
console.log(
    `pilot-inventory: ${results
        .map(
            (document) =>
                `${document.document} ${document.coverage.coveredHeadings}/${document.coverage.expectedHeadings}`,
        )
        .join(", ")}`,
);
