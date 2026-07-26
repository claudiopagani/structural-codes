import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
    buildInlineSegments,
    type InlineSegment,
} from "./lib/inline-math.ts";

const repoRoot = fileURLToPath(new URL("../", import.meta.url));
const unitsDir = join(repoRoot, "corpus", "units", "ntc2018");
const manifestFile = join(repoRoot, "corpus", "assets", "ntc2018", "4.1.json");
const sourceSnapshotFile = join(
    repoRoot,
    "migration",
    "source-snapshots",
    "ntc2018-4.1-text-blocks.json",
);
const normalizationVersion = "ntc41-editorial-profile-0.2.0";

type Evidence = {
    sourceId: string;
    pdfPage: number;
    printedPage: string | null;
    region: unknown;
    extraction: {
        method: "pdf-text" | "ocr" | "manual-transcription";
        tool: string;
        toolVersion: string;
    };
    transformations: Array<{
        operation: string;
        ruleVersion: string;
        note: string;
    }>;
    rawSha256: string;
    normalizedSha256: string;
};

type TextBlock = {
    blockId: string;
    kind: "heading" | "paragraph" | "list-item" | "footnote";
    origin: "official";
    text: {
        raw: string;
        normalized: string;
        normalizationVersion: string;
        inline?: InlineSegment[];
    };
    evidence: Evidence;
};

type AssetBlock = {
    blockId: string;
    kind: "formula-ref" | "table-ref" | "figure-ref";
    origin: "official";
    assetId: string;
    evidence: Evidence;
};

type CanonicalUnit = {
    id: string;
    title: string;
    titleBlockId: string;
    numbering: { official: string };
    blocks: Array<TextBlock | AssetBlock>;
    assets: {
        formulaIds: string[];
        tableIds: string[];
        figureIds: string[];
    };
    workflow: {
        openIssues: Array<{
            issueId: string;
            type: string;
            severity: string;
            note: string;
        }>;
    };
};

type Asset = {
    id: string;
    unitId: string;
    officialNumber: string | null;
    pdfPage: number;
};

type AssetManifest = {
    formulas: Asset[];
    tables: Asset[];
    figures: Array<Asset & { region: unknown }>;
};

type Placement = {
    start: number;
    end: number;
    assetId: string;
};

type LineToken = {
    type: "line";
    raw: string;
    normalized: string;
    evidence: Evidence;
};

type AssetToken = {
    type: "asset";
    asset: Asset;
    evidence: Evidence;
};

type Token = LineToken | AssetToken;

type SourceSnapshot = {
    formatVersion: 1;
    normalizationProfile: string;
    units: Record<string, TextBlock[]>;
};

const formulaId = (number: string) =>
    `urn:structural-codes:it:asset:formula:ntc2018:${number}`;
const tableId = (number: string) =>
    `urn:structural-codes:it:asset:table:ntc2018:${number}`;
const figureId = (number: string) =>
    `urn:structural-codes:it:asset:figure:ntc2018:${number}`;
const unitAssetId = (kind: "formula" | "table", suffix: string) =>
    `urn:structural-codes:it:asset:${kind}:ntc2018:${suffix}`;

/**
 * Posizioni verificate sul render ufficiale. Gli indici sono riferiti alle
 * righe raw dei blocchi di estrazione, non alle righe visuali del viewer.
 */
const placements: Record<string, Placement[]> = {
    "4.1@74": [
        { start: 15, end: 30, assetId: tableId("4.1.i") },
        { start: 39, end: 42, assetId: tableId("4.1.ii") },
    ],
    "4.1.1.1@75": [
        { start: 22, end: 22, assetId: formulaId("4.1.1") },
        { start: 23, end: 23, assetId: formulaId("4.1.2") },
    ],
    "4.1.11.1@94": [
        {
            start: 3,
            end: 3,
            assetId: unitAssetId("formula", "4.1.50:4.1.11.1"),
        },
    ],
    "4.1.11.1@95": [
        {
            start: 2,
            end: 14,
            assetId: unitAssetId("formula", "4.1.11.1:shear"),
        },
    ],
    "4.1.12.1@95": [
        {
            start: 2,
            end: 3,
            assetId: unitAssetId("formula", "4.1.50:4.1.12.1"),
        },
    ],
    "4.1.2.1.1.1@76": [
        { start: 1, end: 1, assetId: formulaId("4.1.3") },
    ],
    "4.1.2.1.1.2@76": [
        { start: 1, end: 2, assetId: formulaId("4.1.4") },
    ],
    "4.1.2.1.1.3@76": [
        { start: 1, end: 2, assetId: formulaId("4.1.5") },
    ],
    "4.1.2.1.1.4@77": [
        { start: 1, end: 2, assetId: formulaId("4.1.6") },
        { start: 5, end: 5, assetId: formulaId("4.1.7") },
    ],
    "4.1.2.1.2.1@77": [
        { start: 2, end: 15, assetId: figureId("4.1.1") },
        {
            start: 19,
            end: 20,
            assetId: unitAssetId(
                "formula",
                "4.1.2.1.2.1:material-parameters-up-to-c50-60",
            ),
        },
        {
            start: 22,
            end: 24,
            assetId: unitAssetId(
                "formula",
                "4.1.2.1.2.1:material-parameters-over-c50-60",
            ),
        },
    ],
    "4.1.2.1.2.1@78": [
        { start: 3, end: 4, assetId: formulaId("4.1.8") },
        { start: 5, end: 7, assetId: formulaId("4.1.9") },
        { start: 8, end: 10, assetId: formulaId("4.1.10") },
        { start: 11, end: 12, assetId: formulaId("4.1.11") },
        { start: 13, end: 14, assetId: formulaId("4.1.12") },
        { start: 16, end: 28, assetId: figureId("4.1.2") },
        { start: 30, end: 31, assetId: formulaId("4.1.12.a") },
        { start: 39, end: 53, assetId: formulaId("4.1.12.b") },
        { start: 58, end: 59, assetId: formulaId("4.1.12.c") },
        { start: 61, end: 67, assetId: formulaId("4.1.12.d") },
        { start: 71, end: 71, assetId: formulaId("4.1.12.e") },
        { start: 73, end: 76, assetId: formulaId("4.1.12.f") },
        { start: 77, end: 78, assetId: formulaId("4.1.12.g") },
    ],
    "4.1.2.1.2.1@79": [
        { start: 2, end: 2, assetId: formulaId("4.1.12.h") },
        { start: 3, end: 5, assetId: formulaId("4.1.12.i") },
    ],
    "4.1.2.1.2.2@79": [
        { start: 8, end: 8, assetId: figureId("4.1.3") },
    ],
    "4.1.2.2.4@80": [
        { start: 3, end: 6, assetId: formulaId("4.1.13") },
        {
            start: 10,
            end: 10,
            assetId: unitAssetId("formula", "4.1.2.2.4:crack-widths"),
        },
    ],
    "4.1.2.2.4.2@80": [
        { start: 4, end: 8, assetId: tableId("4.1.iii") },
    ],
    "4.1.2.2.4.4@80": [
        { start: 1, end: 18, assetId: tableId("4.1.iv") },
    ],
    "4.1.2.2.4.5@81": [
        { start: 6, end: 6, assetId: formulaId("4.1.14") },
    ],
    "4.1.2.2.5.1@81": [
        { start: 1, end: 1, assetId: formulaId("4.1.15") },
        { start: 2, end: 2, assetId: formulaId("4.1.16") },
    ],
    "4.1.2.2.5.2@81": [
        { start: 1, end: 1, assetId: formulaId("4.1.17") },
    ],
    "4.1.2.3.4.2@82": [
        { start: 2, end: 2, assetId: figureId("4.1.4") },
        { start: 5, end: 5, assetId: formulaId("4.1.18a") },
        { start: 6, end: 6, assetId: formulaId("4.1.18b") },
        { start: 16, end: 44, assetId: formulaId("4.1.19") },
        { start: 51, end: 51, assetId: formulaId("4.1.20") },
        { start: 52, end: 52, assetId: formulaId("4.1.21") },
        {
            start: 53,
            end: 53,
            assetId: unitAssetId("formula", "4.1.2.3.4.2:n-rcd"),
        },
        {
            start: 55,
            end: 56,
            assetId: unitAssetId("table", "4.1.2.3.4.2:alpha"),
        },
    ],
    "4.1.2.3.4.2@83": [
        {
            start: 4,
            end: 5,
            assetId: unitAssetId("formula", "4.1.2.3.4.2:phi-yd"),
        },
    ],
    "4.1.2.3.5.1@83": [
        { start: 4, end: 4, assetId: formulaId("4.1.22") },
        { start: 6, end: 11, assetId: formulaId("4.1.23") },
        {
            start: 14,
            end: 16,
            assetId: unitAssetId("formula", "4.1.2.3.5.1:parameters"),
        },
        { start: 25, end: 27, assetId: formulaId("4.1.24") },
    ],
    "4.1.2.3.5.2@84": [
        { start: 2, end: 2, assetId: formulaId("4.1.25") },
        { start: 4, end: 4, assetId: formulaId("4.1.26") },
        { start: 6, end: 11, assetId: formulaId("4.1.27") },
        { start: 13, end: 13, assetId: formulaId("4.1.28") },
        { start: 15, end: 15, assetId: formulaId("4.1.29") },
        {
            start: 21,
            end: 24,
            assetId: unitAssetId("formula", "4.1.2.3.5.2:alpha-c"),
        },
        { start: 27, end: 27, assetId: formulaId("4.1.30") },
    ],
    "4.1.2.3.5.3@84": [
        { start: 2, end: 2, assetId: formulaId("4.1.31") },
        { start: 17, end: 17, assetId: formulaId("4.1.32") },
    ],
    "4.1.2.3.5.3@85": [
        { start: 2, end: 2, assetId: formulaId("4.1.33") },
    ],
    "4.1.2.3.6@85": [
        { start: 4, end: 4, assetId: formulaId("4.1.34") },
        { start: 10, end: 10, assetId: formulaId("4.1.35") },
        { start: 16, end: 21, assetId: formulaId("4.1.36") },
        { start: 22, end: 28, assetId: formulaId("4.1.37") },
    ],
    "4.1.2.3.6@86": [
        { start: 0, end: 0, assetId: formulaId("4.1.38") },
        {
            start: 2,
            end: 2,
            assetId: unitAssetId("formula", "4.1.2.3.6:reinforcement-ratios"),
        },
        { start: 4, end: 4, assetId: formulaId("4.1.39") },
        { start: 20, end: 28, assetId: formulaId("4.1.40") },
    ],
    "4.1.2.3.9.2@87": [
        { start: 8, end: 10, assetId: formulaId("4.1.41") },
        { start: 14, end: 14, assetId: formulaId("4.1.42") },
        { start: 20, end: 27, assetId: formulaId("4.1.43") },
    ],
    "4.1.2.3.9.3@87": [
        { start: 7, end: 9, assetId: formulaId("4.1.44") },
    ],
    "4.1.6.1.1@88": [
        { start: 1, end: 3, assetId: formulaId("4.1.45") },
    ],
    "4.1.6.1.2@89": [
        { start: 2, end: 2, assetId: formulaId("4.1.46") },
    ],
    "4.1.8.1.4@91": [
        { start: 0, end: 0, assetId: formulaId("4.1.47") },
        { start: 5, end: 5, assetId: formulaId("4.1.48") },
    ],
    "4.1.8.1.5@91": [
        { start: 2, end: 2, assetId: formulaId("4.1.49") },
    ],
};

const lineReplacements: Record<string, Record<number, string>> = {
    "4.1.2.1.2.1@78": {
        2: "caratteristica e le deformazioni del calcestruzzo confinato sono valutate secondo le relazioni seguenti:",
        57: "La pressione laterale equivalente σₗ può essere determinata attraverso la relazione:",
        60: "b) Per sezioni circolari",
        70: "nel piano della sezione e di un termine relativo al passo delle staffe, attraverso la relazione:",
        73: "a) per sezioni rettangolari",
    },
    "4.1.2.1.2.1@79": {
        2: "b) per sezioni circolari",
    },
    "4.1.2.1.2.2@79": {
        7: "(a) bilineare finito con incrudimento; (b) elastico-perfettamente plastico indefinito.",
    },
    "4.1.2.2.5.2@81": {
        0: "La tensione massima, σs,max, per effetto delle azioni dovute alla combinazione caratteristica deve rispettare la limitazione seguente:",
    },
    "4.1.2.3.4.2@82": {
        51: "L’esponente α può dedursi in funzione della geometria della sezione e dei parametri:",
        54: "In mancanza di una specifica valutazione, può assumersi:",
    },
    "4.1.2.3.6@85": {
        34: "ΣAₗ è l’area complessiva delle barre longitudinali.",
    },
    "4.1.2.3.6@86": {
        1: "Entro questi limiti, nel caso di torsione pura, può porsi:",
    },
    "4.1.2.3.9.2@87": {
        14: "La snellezza è calcolata come rapporto tra la lunghezza libera di inflessione, l₀, ed il raggio d’inerzia, i, della sezione di calcestruzzo non fessurato:",
    },
    "4.1.2.3.9.3@87": {
        7: "contributi del 2° ordine e una rigidezza flessionale delle sezioni data da:",
    },
    "4.1.6.1.1@88": {
        0: "L’area dell’armatura longitudinale in zona tesa non deve essere inferiore a:",
    },
    "4.1.6.1.1@89": {
        15: "Eventuali armature longitudinali compresse di diametro Φ prese in conto nei calcoli di resistenza devono essere trattenute da",
        16: "armature trasversali con spaziatura non maggiore di 15Φ.",
    },
    "4.1.8.1.4@91": {
        0: "All’atto della precompressione le tensioni di compressione non debbono superare il valore:",
        5: "di ancoraggio pari a:",
    },
    "4.1.8.1.5@91": {
        1: "Le tensioni iniziali devono rispettare le più restrittive delle seguenti limitazioni:",
    },
};

const dropOnlyRanges: Record<string, Array<[number, number]>> = {
    "4.1.2.3.6@85": [[35, 35]],
};

const unnumberedHeadings = new Set([
    "Calcestruzzo confinato",
    "Stato limite di decompressione e di formazione delle fessure",
    "Stato limite di apertura delle fessure",
    "Componenti trasversali",
    "Carichi in prossimità degli appoggi",
    "Carichi appesi o indiretti",
    "Sollecitazioni composte",
    "Snellezza limite per pilastri singoli",
    "Effetti globali negli edifici",
    "Analisi elastica lineare",
    "Analisi non lineare",
]);

const glyphReplacements: Array<[RegExp, string]> = [
    [/[\u0000-\u001f\u007f-\u009f]/g, ""],
    [/Έ/g, "δ"],
    [/Ή/g, "ε"],
    [/Η/g, "σ"],
    [/ƺ/g, "-"],
    [/ǂ/g, "≤"],
    [/ǃ/g, "≥"],
    [/΅/g, "α"],
    [/·/g, "γ"],
    [/΋/g, "η"],
    [/\u0318/g, "Φ"],
    [/Ν/g, "ω"],
    [/Α/g, "ν"],
    [/Ό/g, "θ"],
    [/Ώ/g, "λ"],
    [/İ/g, "ε"],
    [/Ǌ/g, "Δ"],
    [/Κ/g, "φ"],
    [/Į/g, "α"],
    [/ȭ/g, "–"],
    [//g, "·"],
];

function sha256(value: string): string {
    return createHash("sha256").update(value, "utf8").digest("hex");
}

function isTextBlock(block: TextBlock | AssetBlock): block is TextBlock {
    return "text" in block;
}

function isDropped(key: string, lineNumber: number): boolean {
    return (dropOnlyRanges[key] ?? []).some(
        ([start, end]) => lineNumber >= start && lineNumber <= end,
    );
}

function normalizeGlyphs(value: string, officialNumber: string): string {
    let normalized = value;
    for (const [pattern, replacement] of glyphReplacements) {
        normalized = normalized.replace(pattern, replacement);
    }

    if (officialNumber === "4.1.2.1.2.1") {
        normalized = normalized
            .replace(/\bV2\b/g, "σ₂")
            .replace(/\bVl\b/g, "σₗ")
            .replace(/\bHc2\b/g, "εc2")
            .replace(/\bHcu\b/g, "εcu")
            .replace(/\bD\b/g, "α")
            .replace(/\bE\b/g, "β");
    }
    if (officialNumber === "4.1.2.3.4.2") {
        normalized = normalized
            .replace(/μI/g, "μφ")
            .replace(/\bPEd\b/g, "μEd")
            .replace(/\bcIyd\b/g, "φ'yd")
            .replace(/\bIyd\b/g, "φyd")
            .replace(/\bD\b/g, "α")
            .replace(/\bN EI\b/g, "Nₑd");
    }
    if (officialNumber.startsWith("4.1.2.3.5")) {
        normalized = normalized
            .replace(/\bv min\b/g, "νmin")
            .replace(/\bU1\b/g, "ρₗ")
            .replace(/\bVcp\b/g, "σcp")
            .replace(/\bQ(?=fcd\b)/g, "ν");
    }

    return normalized;
}

function normalizeLine(value: string, officialNumber: string): string {
    return normalizeGlyphs(value, officialNumber)
        .normalize("NFC")
        .replace(/\s+/g, " ")
        .replace(/\s+([,.;:!?])/g, "$1")
        .replace(/\(\s+/g, "(")
        .replace(/\s+\)/g, ")")
        .trim();
}

function textTransformations(
    raw: string,
    normalized: string,
    pages: Set<number>,
): Evidence["transformations"] {
    if (raw === normalized) return [];
    const transformations: Evidence["transformations"] = [
        {
            operation: "remove-control-character",
            ruleVersion: normalizationVersion,
            note: "Rimossi caratteri di controllo C0 privi di resa visuale.",
        },
        {
            operation: "remove-discretionary-hyphen",
            ruleVersion: normalizationVersion,
            note: "Unite le parole divise a fine riga dal trattino tipografico del PDF.",
        },
        {
            operation: "join-line-wrap",
            ruleVersion: normalizationVersion,
            note: "Rimossi solo gli a capo introdotti dall’impaginazione; i capoversi e gli elenchi restano blocchi distinti.",
        },
        {
            operation: "manual-correction",
            ruleVersion: normalizationVersion,
            note: "Corretti glifi greci e simboli matematici verificati sul render ufficiale.",
        },
        {
            operation: "normalize-whitespace",
            ruleVersion: normalizationVersion,
            note: "Uniformati gli spazi dopo la ricomposizione delle righe.",
        },
        {
            operation: "unicode-nfc",
            ruleVersion: normalizationVersion,
            note: "Testo normalizzato in Unicode NFC.",
        },
    ];
    if (pages.size > 1) {
        transformations.push({
            operation: "join-page-break",
            ruleVersion: normalizationVersion,
            note: "Ricomposta una continuazione testuale attraversata da un cambio pagina; il cambio pagina non genera un capoverso.",
        });
    }
    return transformations;
}

function assetKind(assetId: string): AssetBlock["kind"] {
    if (assetId.includes(":asset:formula:")) return "formula-ref";
    if (assetId.includes(":asset:table:")) return "table-ref";
    return "figure-ref";
}

function assetEvidence(sourceEvidence: Evidence, asset: Asset): Evidence {
    const isFigure = asset.id.includes(":asset:figure:");
    return {
        ...sourceEvidence,
        pdfPage: asset.pdfPage,
        region:
            isFigure && "region" in asset
                ? (asset as Asset & { region: unknown }).region
                : sourceEvidence.region,
        extraction: {
            method: "manual-transcription",
            tool: isFigure ? "poppler-pdf-crop" : "codex-source-transcription",
            toolVersion: normalizationVersion,
        },
        transformations: [
            {
                operation: "manual-correction",
                ruleVersion: normalizationVersion,
                note: isFigure
                    ? "Ritaglio ottenuto dalla pagina ufficiale e controllato visivamente."
                    : "Asset trascritto dal render ufficiale e collocato nella posizione normativa originaria; resta da revisionare puntualmente.",
            },
        ],
    };
}

function appendNormalized(current: string, next: string): string {
    if (!current) return next;
    if (/[\p{L}\p{N}]-$/u.test(current) && /^\p{Ll}/u.test(next)) {
        return `${current.slice(0, -1)}${next}`;
    }
    return `${current} ${next}`;
}

function isBulletLine(value: string): boolean {
    return /^(?:[–-]\s+|[a-z]\)\s+)/iu.test(value);
}

function withoutBullet(value: string): string {
    return value.replace(/^[–-]\s+/u, "").trim();
}

function lineClosesParagraph(value: string): boolean {
    return /[.!?]$/.test(value);
}

function lineClosesListItem(value: string): boolean {
    return /[;.!?]$/.test(value);
}

function makeTextBlock(
    unitId: string,
    sequence: number,
    kind: TextBlock["kind"],
    rawLines: string[],
    normalized: string,
    evidences: Evidence[],
): TextBlock {
    const raw = rawLines.join("\n");
    const pages = new Set(evidences.map(({ pdfPage }) => pdfPage));
    const evidence = evidences[0];
    if (!evidence) {
        throw new Error(`Evidence assente per il blocco ${unitId}`);
    }
    const inline = buildInlineSegments(normalized);
    return {
        blockId: `${unitId}#block-editorial-${String(sequence).padStart(3, "0")}`,
        kind,
        origin: "official",
        text: {
            raw,
            normalized,
            normalizationVersion,
            ...(inline ? { inline } : {}),
        },
        evidence: {
            ...evidence,
            transformations: textTransformations(raw, normalized, pages),
            rawSha256: sha256(raw),
            normalizedSha256: sha256(normalized),
        },
    };
}

function titleBlock(unit: CanonicalUnit, source: TextBlock): TextBlock {
    const normalized = `${unit.numbering.official} ${unit.title}`;
    const inline = buildInlineSegments(normalized);
    return {
        ...source,
        blockId: unit.titleBlockId,
        kind: "heading",
        text: {
            ...source.text,
            normalized,
            normalizationVersion,
            ...(inline ? { inline } : {}),
        },
        evidence: {
            ...source.evidence,
            transformations: textTransformations(
                source.text.raw,
                normalized,
                new Set([source.evidence.pdfPage]),
            ),
            rawSha256: sha256(source.text.raw),
            normalizedSha256: sha256(normalized),
        },
    };
}

function tokenizeUnit(
    unit: CanonicalUnit,
    sourceBlocks: TextBlock[],
    assetsById: Map<string, Asset>,
): Token[] {
    const tokens: Token[] = [];
    for (const source of sourceBlocks.filter((block) => block.kind !== "heading")) {
        const key = `${unit.numbering.official}@${source.evidence.pdfPage}`;
        const replacements = lineReplacements[key] ?? {};
        const pagePlacements = placements[key] ?? [];
        const placementsByStart = new Map(
            pagePlacements.map((placement) => [placement.start, placement]),
        );
        const lines = source.text.raw.split(/\r?\n/u);

        for (let lineNumber = 0; lineNumber < lines.length; lineNumber += 1) {
            const placement = placementsByStart.get(lineNumber);
            if (placement) {
                if (Object.hasOwn(replacements, lineNumber)) {
                    const replacement = replacements[lineNumber]!;
                    tokens.push({
                        type: "line",
                        raw: lines
                            .slice(placement.start, placement.end + 1)
                            .join("\n"),
                        normalized: normalizeLine(
                            replacement,
                            unit.numbering.official,
                        ),
                        evidence: source.evidence,
                    });
                }
                const asset = assetsById.get(placement.assetId);
                if (!asset) {
                    throw new Error(`Asset non trovato per ${key}: ${placement.assetId}`);
                }
                tokens.push({
                    type: "asset",
                    asset,
                    evidence: source.evidence,
                });
                lineNumber = placement.end;
                continue;
            }

            if (isDropped(key, lineNumber)) continue;
            const raw = lines[lineNumber]!;
            const replacement = Object.hasOwn(replacements, lineNumber)
                ? replacements[lineNumber]!
                : raw;
            const normalized = normalizeLine(replacement, unit.numbering.official);
            if (!normalized) continue;
            tokens.push({
                type: "line",
                raw,
                normalized:
                    key === "4.1.2.1.2.1@78"
                        ? normalized.replace("(d 1)", "(≤ 1)")
                        : normalized,
                evidence: source.evidence,
            });
        }
    }
    return tokens;
}

function composeBlocks(
    unit: CanonicalUnit,
    sourceBlocks: TextBlock[],
    assetsById: Map<string, Asset>,
): Array<TextBlock | AssetBlock> {
    const sourceHeading =
        sourceBlocks.find((block) => block.blockId === unit.titleBlockId) ??
        sourceBlocks.find((block) => block.kind === "heading");
    if (!sourceHeading) {
        throw new Error(`Titolo sorgente assente: ${unit.id}`);
    }

    const blocks: Array<TextBlock | AssetBlock> = [
        titleBlock(unit, sourceHeading),
    ];
    const tokens = tokenizeUnit(unit, sourceBlocks, assetsById);
    let sequence = 0;
    let pendingList = false;
    let accumulator:
        | {
              kind: "paragraph" | "list-item";
              rawLines: string[];
              normalized: string;
              evidences: Evidence[];
          }
        | undefined;

    const flush = () => {
        if (!accumulator?.normalized) {
            accumulator = undefined;
            return;
        }
        sequence += 1;
        blocks.push(
            makeTextBlock(
                unit.id,
                sequence,
                accumulator.kind,
                accumulator.rawLines,
                accumulator.normalized,
                accumulator.evidences,
            ),
        );
        accumulator = undefined;
    };

    for (const token of tokens) {
        if (token.type === "asset") {
            flush();
            pendingList = false;
            sequence += 1;
            blocks.push({
                blockId: `${unit.id}#block-editorial-${String(sequence).padStart(3, "0")}`,
                kind: assetKind(token.asset.id),
                origin: "official",
                assetId: token.asset.id,
                evidence: assetEvidence(token.evidence, token.asset),
            });
            continue;
        }

        if (unnumberedHeadings.has(token.normalized)) {
            flush();
            pendingList = false;
            sequence += 1;
            blocks.push(
                makeTextBlock(
                    unit.id,
                    sequence,
                    "heading",
                    [token.raw],
                    token.normalized,
                    [token.evidence],
                ),
            );
            continue;
        }

        const bullet = isBulletLine(token.normalized);
        const kind: "paragraph" | "list-item" =
            bullet || pendingList ? "list-item" : "paragraph";
        const normalized =
            kind === "list-item" ? withoutBullet(token.normalized) : token.normalized;

        if (accumulator && accumulator.kind !== kind) flush();
        if (kind === "list-item" && bullet && accumulator) flush();
        accumulator ??= {
            kind,
            rawLines: [],
            normalized: "",
            evidences: [],
        };
        accumulator.rawLines.push(token.raw);
        accumulator.normalized = appendNormalized(
            accumulator.normalized,
            normalized,
        );
        accumulator.evidences.push(token.evidence);

        if (kind === "list-item" && lineClosesListItem(normalized)) {
            const continues = /;$/.test(normalized);
            flush();
            pendingList = continues;
            continue;
        }

        if (kind === "paragraph" && /:$/.test(normalized)) {
            flush();
            pendingList = true;
            continue;
        }

        if (kind === "paragraph" && lineClosesParagraph(normalized)) {
            flush();
            pendingList = false;
        }
    }
    flush();
    return blocks;
}

const manifest = JSON.parse(await readFile(manifestFile, "utf8")) as AssetManifest;
const allAssets: Asset[] = [
    ...manifest.formulas,
    ...manifest.tables,
    ...manifest.figures,
];
const assetsById = new Map(allAssets.map((asset) => [asset.id, asset]));

const filenames = (await readdir(unitsDir))
    .filter((filename) => /^4\.1(?:\.|\.json$)/u.test(filename))
    .sort((left, right) =>
        left.localeCompare(right, "it", { numeric: true }),
    );
const units = await Promise.all(
    filenames.map(async (filename) => {
        const filePath = join(unitsDir, filename);
        const unit = JSON.parse(await readFile(filePath, "utf8")) as CanonicalUnit;
        return { filePath, unit };
    }),
);

let snapshot: SourceSnapshot;
try {
    snapshot = JSON.parse(
        await readFile(sourceSnapshotFile, "utf8"),
    ) as SourceSnapshot;
} catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    snapshot = {
        formatVersion: 1,
        normalizationProfile: "canonical-extraction-before-ntc41-editorial-split",
        units: Object.fromEntries(
            units.map(({ unit }) => [
                unit.id,
                unit.blocks.filter(isTextBlock),
            ]),
        ),
    };
    await mkdir(dirname(sourceSnapshotFile), { recursive: true });
    await writeFile(
        sourceSnapshotFile,
        `${JSON.stringify(snapshot, null, 2)}\n`,
        "utf8",
    );
}

let changedUnits = 0;
let textBlocks = 0;
let insertedAssets = 0;

for (const { filePath, unit } of units) {
    if (
        !(
            unit.numbering.official === "4.1" ||
            unit.numbering.official.startsWith("4.1.")
        )
    ) {
        continue;
    }
    if (unit.numbering.official === "4.1.1.3") {
        unit.title = "Analisi non lineare";
    }
    const sourceBlocks = snapshot.units[unit.id];
    if (!sourceBlocks) {
        throw new Error(`Snapshot sorgente assente: ${unit.id}`);
    }

    unit.blocks = composeBlocks(unit, sourceBlocks, assetsById);
    const unitAssets = allAssets.filter((asset) => asset.unitId === unit.id);
    unit.assets = {
        formulaIds: unitAssets
            .filter((asset) => asset.id.includes(":asset:formula:"))
            .map((asset) => asset.id),
        tableIds: unitAssets
            .filter((asset) => asset.id.includes(":asset:table:"))
            .map((asset) => asset.id),
        figureIds: unitAssets
            .filter((asset) => asset.id.includes(":asset:figure:"))
            .map((asset) => asset.id),
    };
    unit.workflow.openIssues = unit.workflow.openIssues.map((issue) =>
        issue.type === "asset-review"
            ? {
                  ...issue,
                  note: "Formule, tabelle e figure sono separate, trascritte e collocate nel punto normativo originario; resta obbligatorio il confronto umano puntuale con la fonte ufficiale.",
              }
            : issue,
    );

    textBlocks += unit.blocks.filter(isTextBlock).length;
    insertedAssets += unit.blocks.filter((block) => !isTextBlock(block)).length;
    await writeFile(filePath, `${JSON.stringify(unit, null, 2)}\n`, "utf8");
    changedUnits += 1;
}

console.log(
    `apply-ntc41-editorial-profile: ${changedUnits} unità, ${textBlocks} blocchi testuali logici, ${insertedAssets} riferimenti asset`,
);
