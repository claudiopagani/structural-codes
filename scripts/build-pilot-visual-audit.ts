import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

interface PilotDocument {
    document: "ntc2018" | "circ2019";
    sourceId: string;
    pages: { from: number; to: number };
    expectedNumberedAssets: {
        formulaLabels: string[];
        tableLabels: string[];
        figureLabels: string[];
        includeUnnumberedFormulas: boolean;
    };
}

interface PilotConfig {
    asOf: string;
    documents: PilotDocument[];
}

interface RenderManifest {
    renderManifestVersion: number;
    pipelineVersion: string;
    sourceId: string;
    sourceSha256: string;
    pdfPage: number;
    region: null | object;
    scale: number;
    output: string;
    pngSha256: string;
}

const repoRoot = fileURLToPath(new URL("../", import.meta.url));
const config = JSON.parse(
    await readFile(join(repoRoot, "pilot", "section-3.3.config.json"), "utf8"),
) as PilotConfig;

const documents = [];
for (const document of config.documents) {
    const pages: RenderManifest[] = [];
    for (
        let pdfPage = document.pages.from;
        pdfPage <= document.pages.to;
        pdfPage += 1
    ) {
        const renderFile = join(
            repoRoot,
            "evidence",
            document.sourceId,
            "renders",
            `page-${String(pdfPage).padStart(4, "0")}-full@2x.json`,
        );
        let manifest: RenderManifest;
        try {
            manifest = JSON.parse(await readFile(renderFile, "utf8")) as RenderManifest;
        } catch {
            throw new Error(
                `render mancante: ${document.sourceId} pagina ${pdfPage}; eseguire render:evidence a scala 2`,
            );
        }
        if (
            manifest.sourceId !== document.sourceId ||
            manifest.pdfPage !== pdfPage ||
            manifest.region !== null ||
            manifest.scale !== 2 ||
            !/^[a-f0-9]{64}$/u.test(manifest.pngSha256)
        ) {
            throw new Error(
                `manifest render incoerente: ${document.sourceId} pagina ${pdfPage}`,
            );
        }
        pages.push(manifest);
    }
    documents.push({
        document: document.document,
        sourceId: document.sourceId,
        range: document.pages,
        reviewedPages: pages.length,
        numberedAssetInventory: {
            formulas: document.expectedNumberedAssets.formulaLabels.length,
            tables: document.expectedNumberedAssets.tableLabels.length,
            figures: document.expectedNumberedAssets.figureLabels.length,
            includeUnnumberedFormulas:
                document.expectedNumberedAssets.includeUnnumberedFormulas,
        },
        pages: pages.map((page) => ({
            pdfPage: page.pdfPage,
            sourceSha256: page.sourceSha256,
            pipelineVersion: page.pipelineVersion,
            scale: page.scale,
            pngSha256: page.pngSha256,
        })),
    });
}

const report = {
    visualAuditVersion: 1,
    asOf: config.asOf,
    scope: "Inventario visuale dell'intero range del pilot §3.3/C3.3",
    result: "accepted-for-inventory",
    reviewer: {
        actorId: "reviewer:internal:001",
        identityDisclosure: "internal-only",
    },
    limitations: [
        "La review conferma perimetro, intestazioni e inventario degli asset numerati.",
        "Non certifica ancora la trascrizione del testo o il payload dei singoli asset.",
        "Le formule non numerate restano incluse nel perimetro e saranno censite durante la segmentazione.",
    ],
    documents,
};

const outputDir = join(repoRoot, "reports", "pilot");
await mkdir(outputDir, { recursive: true });
await writeFile(
    join(outputDir, "section-3.3.visual-audit.json"),
    `${JSON.stringify(report, null, 2)}\n`,
    "utf8",
);

const markdown = [
    "# Audit visuale del pilot §3.3 / C3.3",
    "",
    `> Esito: \`${report.result}\`. Revisore pubblico: \`${report.reviewer.actorId}\`.`,
    "",
    "La review copre tutte le pagine del pilot a scala 2 e registra l'hash di",
    "ogni render. Non certifica ancora la trascrizione o il singolo asset.",
    "",
    "| Documento | Range PDF | Pagine | Formule numerate | Tabelle | Figure |",
    "|---|---:|---:|---:|---:|---:|",
    ...documents.map(
        (document) =>
            `| ${document.document} | ${document.range.from}–${document.range.to} | ${document.reviewedPages} | ${document.numberedAssetInventory.formulas} | ${document.numberedAssetInventory.tables} | ${document.numberedAssetInventory.figures} |`,
    ),
    "",
    "Le formule non numerate sono incluse nel perimetro. I dettagli macchina e",
    "gli SHA-256 dei render sono in `section-3.3.visual-audit.json`.",
    "",
    "## Limiti",
    "",
    ...report.limitations.map((limitation) => `- ${limitation}`),
    "",
];
await writeFile(
    join(outputDir, "section-3.3.visual-audit.md"),
    markdown.join("\n"),
    "utf8",
);
console.log(
    `pilot-visual-audit: ${documents
        .map((document) => `${document.document} ${document.reviewedPages} pagine`)
        .join(", ")}`,
);
