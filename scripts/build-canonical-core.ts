import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { basename, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { sha256OfText } from "../src/lib/hash.ts";

interface Region {
    coordinateSystem: "pdf-points-top-left";
    x: number;
    y: number;
    width: number;
    height: number;
}

interface TextItem {
    sequence: number;
    text: string;
    hasEol: boolean;
    region: Region;
}

interface PageRecord {
    pipelineVersion: string;
    sourceId: string;
    pdfPage: number;
    printedPage: string | null;
    page: {
        height: number;
    };
    extraction: {
        tool: string;
        toolVersion: string;
    };
    textItems: TextItem[];
}

interface ChapterHeading {
    numbering: string;
    title: string;
    pdfPage: number;
}

interface ManualHeadingAnchor {
    numbering: string;
    title: string;
    pdfPage: number;
    basis: string;
}

interface DocumentConfig {
    document: "ntc2018" | "circ2019";
    sourceId: string;
    workId: string;
    expressionId: string;
    pages: { from: number; to: number };
    legacyRoots: string[];
    chapterHeadings: ChapterHeading[];
    manualHeadingAnchors: ManualHeadingAnchor[];
    stopBefore: string;
    validity: {
        from: string | null;
        to: string | null;
        status: "in-force" | "unknown";
    };
}

interface ScopeConfig {
    scopeVersion: number;
    scopeId: string;
    asOf: string;
    createdAt: string;
    documents: DocumentConfig[];
}

interface EvidenceLine {
    pdfPage: number;
    printedPage: string | null;
    index: number;
    raw: string;
    items: TextItem[];
    region: Region;
    maxHeight: number;
    extraction: {
        tool: string;
        toolVersion: string;
    };
}

interface PageLines {
    page: PageRecord;
    lines: EvidenceLine[];
}

interface LegacyHint {
    numbering: string;
    title: string | null;
    alias: string | null;
    file: string | null;
}

interface Anchor {
    numbering: string;
    title: string;
    pdfPage: number;
    startLine: number;
    endLine: number;
    lines: EvidenceLine[];
    detection: "chapter-title" | "text-extraction" | "visual-anchor";
    note: string;
}

interface Transformation {
    operation:
        | "unicode-nfc"
        | "normalize-line-endings"
        | "join-line-wrap"
        | "remove-discretionary-hyphen"
        | "remove-control-character"
        | "normalize-whitespace"
        | "manual-correction";
    ruleVersion: string;
    note: string;
}

const repoRoot = fileURLToPath(new URL("../", import.meta.url));
const configPath = join(repoRoot, "migration", "core-concrete-scope.json");
const outputRoot = join(repoRoot, "corpus", "units");
const reportRoot = join(repoRoot, "reports", "migration");
const config = JSON.parse(await readFile(configPath, "utf8")) as ScopeConfig;
const RULE_VERSION = "core-concrete-migration-0.1.0";

function round(value: number): number {
    return Math.round(value * 1000) / 1000;
}

function unionRegion(items: TextItem[]): Region {
    const minX = Math.min(...items.map((item) => item.region.x));
    const minY = Math.min(...items.map((item) => item.region.y));
    const maxX = Math.max(
        ...items.map((item) => item.region.x + item.region.width),
    );
    const maxY = Math.max(
        ...items.map((item) => item.region.y + item.region.height),
    );
    return {
        coordinateSystem: "pdf-points-top-left",
        x: round(minX),
        y: round(minY),
        width: round(maxX - minX),
        height: round(maxY - minY),
    };
}

function reconstructLine(items: TextItem[]): string {
    let result = "";
    let previous: TextItem | undefined;
    for (const item of items) {
        if (previous !== undefined) {
            const previousEnd = previous.region.x + previous.region.width;
            const gap = item.region.x - previousEnd;
            const needsSpace =
                gap > Math.max(0.5, previous.region.height * 0.08) &&
                !/\s$/u.test(result) &&
                !/^[,.;:!?)\]}]/u.test(item.text);
            if (needsSpace) result += " ";
        }
        result += item.text;
        previous = item;
    }
    return result;
}

function withoutOverprintedGlyphs(items: TextItem[]): TextItem[] {
    return items.filter((item, index) => {
        const next = items[index + 1];
        return !(
            item.text.length === 1 &&
            next !== undefined &&
            next.text.startsWith(item.text) &&
            Math.abs(item.region.x - next.region.x) <= 0.5 &&
            Math.abs(item.region.y - next.region.y) <= 0.5
        );
    });
}

function pageLines(page: PageRecord): PageLines {
    const bodyItems = page.textItems.filter(
        (item) =>
            item.text !== "" &&
            item.region.y >= 80 &&
            item.region.y + item.region.height <= page.page.height * 0.9,
    );
    const groups: TextItem[][] = [];
    let current: TextItem[] = [];
    let previous: TextItem | undefined;
    for (const item of bodyItems) {
        const beginsNewLine =
            previous !== undefined &&
            (previous.hasEol ||
                (item.region.x <= previous.region.x + 0.5 &&
                    Math.abs(item.region.y - previous.region.y) >
                        Math.max(2, previous.region.height * 0.6)));
        if (beginsNewLine && current.length > 0) {
            groups.push(current);
            current = [];
        }
        current.push(item);
        previous = item;
    }
    if (current.length > 0) groups.push(current);

    return {
        page,
        lines: groups.map((items, index) => ({
            pdfPage: page.pdfPage,
            printedPage: page.printedPage,
            index,
            raw: reconstructLine(items),
            items,
            region: unionRegion(items),
            maxHeight: Math.max(...items.map((item) => item.region.height)),
            extraction: {
                tool: page.extraction.tool,
                toolVersion: page.extraction.toolVersion,
            },
        })),
    };
}

function cleanForMatching(value: string): string {
    return value
        .normalize("NFC")
        .replace(/[\u0000-\u001F\u007F]/gu, " ")
        .replace(/\s+/gu, " ")
        .trim();
}

function compact(value: string): string {
    return cleanForMatching(value)
        .normalize("NFD")
        .replace(/\p{M}/gu, "")
        .toLocaleLowerCase("it")
        .replace(/[^a-z0-9]+/gu, "");
}

function cleanHeadingTitle(value: string): string {
    let result = cleanForMatching(value)
        .replace(/\b([A-ZÀ-Ü]) ([A-ZÀ-Ü]{2,})\b/gu, "$1$2")
        .replace(/^([A-ZÀ-Ü])\1(?=[A-ZÀ-Ü])/u, "$1")
        .replace(/\s+([,.;:])/gu, "$1")
        .trim();
    if (result.endsWith(".")) result = result.slice(0, -1).trim();
    return result;
}

function numberParts(numbering: string): number[] {
    return numbering
        .replace(/^C/u, "")
        .split(".")
        .map(Number);
}

function compareNumbering(left: string, right: string): number {
    const leftParts = numberParts(left);
    const rightParts = numberParts(right);
    const length = Math.max(leftParts.length, rightParts.length);
    for (let index = 0; index < length; index += 1) {
        const difference =
            (leftParts[index] ?? -1) - (rightParts[index] ?? -1);
        if (difference !== 0) return difference;
    }
    return left.localeCompare(right);
}

function sortKey(numbering: string): string {
    return numberParts(numbering)
        .map((value) => String(value).padStart(3, "0"))
        .join(".");
}

function unitId(document: DocumentConfig["document"], numbering: string): string {
    return `urn:structural-codes:it:unit:${document}:${numbering.toLocaleLowerCase("it")}`;
}

function issueSlug(document: string, numbering: string): string {
    return `${document}-${numbering.toLocaleLowerCase("it").replaceAll(".", "-")}`;
}

async function walkMdx(directory: string): Promise<string[]> {
    const result: string[] = [];
    async function visit(current: string): Promise<void> {
        let entries;
        try {
            entries = await readdir(current, { withFileTypes: true });
        } catch {
            return;
        }
        for (const entry of entries) {
            const absolutePath = join(current, entry.name);
            if (entry.isDirectory()) await visit(absolutePath);
            else if (entry.isFile() && entry.name.endsWith(".mdx")) {
                result.push(absolutePath);
            }
        }
    }
    await visit(directory);
    return result.sort();
}

function legacyNumbering(
    document: DocumentConfig["document"],
    file: string,
): string | null {
    const name = basename(file, ".mdx");
    const match =
        document === "ntc2018"
            ? /^p(\d+(?:\.\d+)*)$/u.exec(name)
            : /^p-c(\d+(?:\.\d+)*)$/u.exec(name);
    if (match === null) return null;
    return document === "ntc2018" ? match[1]! : `C${match[1]!}`;
}

function frontmatterHint(raw: string, key: "id" | "title"): string | null {
    const match = new RegExp(
        `(?:^|[;\\r\\n])\\s*${key}:\\s*(?:"([^"]*)"|'([^']*)'|([^;\\r\\n]+))`,
        "u",
    ).exec(raw);
    return (match?.[1] ?? match?.[2] ?? match?.[3] ?? "").trim() || null;
}

async function legacyHints(document: DocumentConfig): Promise<Map<string, LegacyHint>> {
    const hints = new Map<string, LegacyHint>();
    for (const root of document.legacyRoots) {
        for (const file of await walkMdx(join(repoRoot, root))) {
            const numbering = legacyNumbering(document.document, file);
            if (numbering === null) continue;
            const raw = await readFile(file, "utf8");
            hints.set(numbering, {
                numbering,
                title: frontmatterHint(raw, "title"),
                alias: frontmatterHint(raw, "id"),
                file: relative(repoRoot, file).replaceAll("\\", "/"),
            });
        }
    }
    for (const chapter of document.chapterHeadings) {
        const previous = hints.get(chapter.numbering);
        hints.set(chapter.numbering, {
            numbering: chapter.numbering,
            title: chapter.title,
            alias: previous?.alias ?? null,
            file: previous?.file ?? null,
        });
    }
    return hints;
}

async function loadPages(document: DocumentConfig): Promise<Map<number, PageLines>> {
    const pages = new Map<number, PageLines>();
    for (
        let pageNumber = document.pages.from;
        pageNumber <= document.pages.to;
        pageNumber += 1
    ) {
        const file = join(
            repoRoot,
            "evidence",
            document.sourceId,
            "pages",
            `page-${String(pageNumber).padStart(4, "0")}.json`,
        );
        let page: PageRecord;
        try {
            page = JSON.parse(await readFile(file, "utf8")) as PageRecord;
        } catch {
            throw new Error(
                `Evidence mancante: ${document.sourceId} pagina ${pageNumber}`,
            );
        }
        pages.set(pageNumber, pageLines(page));
    }
    return pages;
}

function parsedNumberedHeading(
    line: EvidenceLine,
    document: DocumentConfig["document"],
): { numbering: string; title: string } | null {
    let cleaned = cleanForMatching(line.raw);
    if (document === "circ2019" && cleaned.startsWith("CC")) {
        cleaned = cleaned.slice(1);
    }
    const match = /^(C?\d+(?:\.\d+)*)(?:\.)?\s+(.+)$/u.exec(cleaned);
    if (match === null) return null;
    let numbering = match[1]!;
    if (
        document === "ntc2018" &&
        numbering.length > 1 &&
        numbering[0] === numbering[1]
    ) {
        numbering = numbering.slice(1);
    }
    return {
        numbering,
        title: cleanHeadingTitle(match[2]!),
    };
}

function findChapterAnchor(
    document: DocumentConfig,
    pages: Map<number, PageLines>,
    heading: ChapterHeading,
): Anchor {
    const page = pages.get(heading.pdfPage);
    if (page === undefined) throw new Error(`Pagina capitolo mancante: ${heading.pdfPage}`);
    const chapterKey = compact(`CAPITOLO ${heading.numbering}`);
    const start = page.lines.findIndex((line) =>
        compact(line.raw).includes(chapterKey),
    );
    if (start < 0) {
        throw new Error(
            `${document.document} ${heading.numbering}: titolo di capitolo non trovato a pagina ${heading.pdfPage}`,
        );
    }
    const titleKey = compact(heading.title);
    const titleIndex = page.lines.findIndex(
        (line, index) => index >= start && compact(line.raw).includes(titleKey),
    );
    if (titleIndex < start) {
        throw new Error(
            `${document.document} ${heading.numbering}: seconda riga del titolo non trovata`,
        );
    }
    return {
        numbering: heading.numbering,
        title: heading.title,
        pdfPage: heading.pdfPage,
        startLine: start,
        endLine: titleIndex,
        lines: page.lines.slice(start, titleIndex + 1),
        detection: "chapter-title",
        note: "Titolo del capitolo rilevato sulla pagina separatrice ufficiale.",
    };
}

function titleSimilarity(candidate: string, hint: string | null): number {
    if (hint === null) return 0;
    const left = compact(candidate);
    const right = compact(hint);
    if (left === right) return 1000;
    if (left.includes(right) || right.includes(left)) return 500;
    const candidateTokens = new Set(
        cleanForMatching(candidate).toLocaleLowerCase("it").split(" "),
    );
    const hintTokens = cleanForMatching(hint).toLocaleLowerCase("it").split(" ");
    return hintTokens.filter((token) => candidateTokens.has(token)).length * 10;
}

function findTextAnchor(
    document: DocumentConfig,
    pages: Map<number, PageLines>,
    hint: LegacyHint,
): Anchor {
    const candidates: Array<{
        line: EvidenceLine;
        parsed: { numbering: string; title: string };
        score: number;
    }> = [];
    for (const page of pages.values()) {
        for (const line of page.lines) {
            const parsed = parsedNumberedHeading(line, document.document);
            if (parsed?.numbering !== hint.numbering) continue;
            candidates.push({
                line,
                parsed,
                score:
                    titleSimilarity(parsed.title, hint.title) +
                    Math.round(line.maxHeight * 10),
            });
        }
    }
    candidates.sort(
        (left, right) =>
            right.score - left.score ||
            left.line.pdfPage - right.line.pdfPage ||
            left.line.index - right.line.index,
    );
    const selected = candidates[0];
    if (selected === undefined) {
        throw new Error(
            `${document.document} ${hint.numbering}: intestazione non trovata nel layer testuale`,
        );
    }
    return {
        numbering: hint.numbering,
        title: selected.parsed.title,
        pdfPage: selected.line.pdfPage,
        startLine: selected.line.index,
        endLine: selected.line.index,
        lines: [selected.line],
        detection: "text-extraction",
        note:
            candidates.length === 1
                ? "Intestazione rilevata univocamente dal layer testuale."
                : `Scelta tra ${candidates.length} occorrenze usando titolo legacy come solo indizio e dimensione tipografica.`,
    };
}

function findManualAnchor(
    document: DocumentConfig,
    pages: Map<number, PageLines>,
    manual: ManualHeadingAnchor,
): Anchor {
    const page = pages.get(manual.pdfPage);
    if (page === undefined) throw new Error(`Pagina manual anchor mancante: ${manual.pdfPage}`);
    const titleKey = compact(manual.title);
    const candidates = page.lines.filter((line) =>
        compact(line.raw).includes(titleKey),
    );
    candidates.sort(
        (left, right) =>
            right.maxHeight - left.maxHeight || left.index - right.index,
    );
    const selected = candidates[0];
    if (selected === undefined) {
        throw new Error(
            `${document.document} ${manual.numbering}: titolo visuale non localizzato nel layer testuale a pagina ${manual.pdfPage}`,
        );
    }
    return {
        numbering: manual.numbering,
        title: manual.title,
        pdfPage: manual.pdfPage,
        startLine: selected.index,
        endLine: selected.index,
        lines: [selected],
        detection: "visual-anchor",
        note: `Numerazione ricostruita dal render ufficiale (${manual.basis}); il layer testuale conserva glyph corrotti.`,
    };
}

function findSentinel(
    document: DocumentConfig,
    pages: Map<number, PageLines>,
): Anchor {
    for (const page of pages.values()) {
        for (const line of page.lines) {
            const parsed = parsedNumberedHeading(line, document.document);
            if (parsed?.numbering === document.stopBefore) {
                return {
                    numbering: document.stopBefore,
                    title: parsed.title,
                    pdfPage: line.pdfPage,
                    startLine: line.index,
                    endLine: line.index,
                    lines: [line],
                    detection: "text-extraction",
                    note: "Sentinella di fine perimetro.",
                };
            }
        }
    }
    throw new Error(
        `${document.document}: sentinella ${document.stopBefore} non trovata`,
    );
}

function anchorOrder(anchor: Anchor): number {
    return anchor.pdfPage * 10000 + anchor.startLine;
}

function normalizedText(
    raw: string,
): { normalized: string; transformations: Transformation[] } {
    let normalized = raw;
    const transformations: Transformation[] = [];
    const nfc = normalized.normalize("NFC");
    if (nfc !== normalized) {
        normalized = nfc;
        transformations.push({
            operation: "unicode-nfc",
            ruleVersion: RULE_VERSION,
            note: "Composizione Unicode NFC.",
        });
    }
    const withoutControls = normalized.replace(
        /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/gu,
        "",
    );
    if (withoutControls !== normalized) {
        normalized = withoutControls;
        transformations.push({
            operation: "remove-control-character",
            ruleVersion: RULE_VERSION,
            note: "Rimossi caratteri di controllo C0 privi di resa visuale.",
        });
    }
    const ordinarySpaces = normalized.replace(/[\u00A0\u202F]/gu, " ");
    if (ordinarySpaces !== normalized) {
        normalized = ordinarySpaces;
        transformations.push({
            operation: "normalize-whitespace",
            ruleVersion: RULE_VERSION,
            note: "NBSP e narrow NBSP convertiti in spazio ordinario.",
        });
    }
    return { normalized, transformations };
}

function evidenceFor(
    sourceId: string,
    line: EvidenceLine,
    raw: string,
    normalized: string,
    transformations: Transformation[],
) {
    return {
        sourceId,
        pdfPage: line.pdfPage,
        printedPage: line.printedPage,
        region: line.region,
        extraction: {
            method: "pdf-text",
            tool: line.extraction.tool,
            toolVersion: line.extraction.toolVersion,
        },
        transformations,
        rawSha256: sha256OfText(raw),
        normalizedSha256: sha256OfText(normalized),
    };
}

function headingBlock(document: DocumentConfig, anchor: Anchor, id: string) {
    const raw = anchor.lines.map((line) => line.raw).join("\n");
    const normalized = `${anchor.numbering} ${anchor.title}`;
    const base = normalizedText(raw);
    const transformations = [...base.transformations];
    if (base.normalized !== normalized) {
        transformations.push({
            operation: "manual-correction" as const,
            ruleVersion: RULE_VERSION,
            note: anchor.note,
        });
    }
    const items = anchor.lines.flatMap((line) => line.items);
    const first = anchor.lines[0]!;
    const evidenceLine: EvidenceLine = {
        ...first,
        region: unionRegion(items),
        items,
    };
    return {
        blockId: `${id}#block-heading`,
        kind: "heading",
        origin: "official",
        text: {
            raw,
            normalized,
            normalizationVersion:
                transformations.length === 0 ? "none" : RULE_VERSION,
        },
        evidence: evidenceFor(
            document.sourceId,
            evidenceLine,
            raw,
            normalized,
            transformations,
        ),
    };
}

function bodyBlocks(
    document: DocumentConfig,
    pages: Map<number, PageLines>,
    anchor: Anchor,
    next: Anchor,
    id: string,
) {
    const blocks = [];
    let blockNumber = 0;
    for (
        let pageNumber = anchor.pdfPage;
        pageNumber <= next.pdfPage;
        pageNumber += 1
    ) {
        const page = pages.get(pageNumber);
        if (page === undefined) continue;
        const lower = pageNumber === anchor.pdfPage ? anchor.endLine + 1 : 0;
        const upper =
            pageNumber === next.pdfPage ? next.startLine : page.lines.length;
        const selected = page.lines
            .slice(lower, upper)
            .filter(
                (line) =>
                    line.raw
                        .replace(/[\u0000-\u001F\u007F]/gu, "")
                        .trim() !== "",
            );
        if (selected.length === 0) continue;
        const raw = selected.map((line) => line.raw).join("\n");
        const withoutOverprints = selected
            .map((line) => reconstructLine(withoutOverprintedGlyphs(line.items)))
            .join("\n");
        const normalized = normalizedText(withoutOverprints);
        if (withoutOverprints !== raw) {
            normalized.transformations.unshift({
                operation: "manual-correction",
                ruleVersion: RULE_VERSION,
                note: "Rimosso un glyph iniziale sovrapposto a una stringa che contiene lo stesso carattere nelle medesime coordinate PDF.",
            });
        }
        blockNumber += 1;
        const items = selected.flatMap((line) => line.items);
        const first = selected[0]!;
        const evidenceLine: EvidenceLine = {
            ...first,
            region: unionRegion(items),
            items,
        };
        blocks.push({
            blockId: `${id}#block-page-${String(blockNumber).padStart(3, "0")}`,
            kind: "paragraph",
            origin: "official",
            text: {
                raw,
                normalized: normalized.normalized,
                normalizationVersion:
                    normalized.transformations.length === 0
                        ? "none"
                        : RULE_VERSION,
            },
            evidence: evidenceFor(
                document.sourceId,
                evidenceLine,
                raw,
                normalized.normalized,
                normalized.transformations,
            ),
        });
    }
    return blocks;
}

function parentNumbering(
    numbering: string,
    known: ReadonlySet<string>,
): string | null {
    let candidate = numbering;
    while (candidate.includes(".")) {
        candidate = candidate.slice(0, candidate.lastIndexOf("."));
        if (known.has(candidate)) return candidate;
    }
    return null;
}

function hierarchy(
    document: DocumentConfig,
    numbering: string,
    known: ReadonlySet<string>,
    siblingPositions: ReadonlyMap<string, number>,
) {
    const ancestors: string[] = [];
    let parent = parentNumbering(numbering, known);
    while (parent !== null) {
        ancestors.unshift(unitId(document.document, parent));
        parent = parentNumbering(parent, known);
    }
    return {
        parentId: ancestors.at(-1) ?? null,
        ancestorIds: ancestors,
        position: siblingPositions.get(numbering) ?? 1,
    };
}

function unitKind(numbering: string): "chapter" | "section" | "paragraph" | "subparagraph" {
    const depth = numberParts(numbering).length;
    if (depth === 1) return "chapter";
    if (depth === 2) return "section";
    if (depth === 3) return "paragraph";
    return "subparagraph";
}

function siblingPositionMap(numberings: string[]): Map<string, number> {
    const byParent = new Map<string, string[]>();
    const known = new Set(numberings);
    for (const numbering of numberings) {
        const parent = parentNumbering(numbering, known) ?? "(root)";
        const siblings = byParent.get(parent) ?? [];
        siblings.push(numbering);
        byParent.set(parent, siblings);
    }
    const result = new Map<string, number>();
    for (const siblings of byParent.values()) {
        siblings.sort(compareNumbering);
        siblings.forEach((numbering, index) => result.set(numbering, index + 1));
    }
    return result;
}

function hasAssetCandidate(raw: string): boolean {
    return /(?:\b(?:Tab(?:ella)?|Fig(?:ura)?)\.?\s+[C]?\d|\[[C]?\d+(?:\.\d+)+(?:\.[a-z])?\])/iu.test(
        raw,
    );
}

function containsExtractionAnomaly(raw: string): boolean {
    return /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\uFFFD]/u.test(raw);
}

function sha256OfJson(value: unknown): string {
    return createHash("sha256")
        .update(JSON.stringify(value), "utf8")
        .digest("hex");
}

const allDocumentData: Array<{
    config: DocumentConfig;
    hints: Map<string, LegacyHint>;
    pages: Map<number, PageLines>;
    anchors: Anchor[];
    sentinel: Anchor;
}> = [];

for (const document of config.documents) {
    const [hints, pages] = await Promise.all([
        legacyHints(document),
        loadPages(document),
    ]);
    const chapters = new Map(
        document.chapterHeadings.map((heading) => [
            heading.numbering,
            heading,
        ]),
    );
    const manuals = new Map(
        document.manualHeadingAnchors.map((heading) => [
            heading.numbering,
            heading,
        ]),
    );
    const anchors = [...hints.values()]
        .map((hint) => {
            const chapter = chapters.get(hint.numbering);
            if (chapter !== undefined) {
                return findChapterAnchor(document, pages, chapter);
            }
            const manual = manuals.get(hint.numbering);
            if (manual !== undefined) {
                return findManualAnchor(document, pages, manual);
            }
            return findTextAnchor(document, pages, hint);
        })
        .sort((left, right) => anchorOrder(left) - anchorOrder(right));
    if (new Set(anchors.map((anchor) => anchor.numbering)).size !== hints.size) {
        throw new Error(`${document.document}: anchor duplicati`);
    }
    for (let index = 1; index < anchors.length; index += 1) {
        if (anchorOrder(anchors[index]!) <= anchorOrder(anchors[index - 1]!)) {
            throw new Error(
                `${document.document}: ordine anchor non crescente tra ${anchors[index - 1]!.numbering} e ${anchors[index]!.numbering}`,
            );
        }
    }
    allDocumentData.push({
        config: document,
        hints,
        pages,
        anchors,
        sentinel: findSentinel(document, pages),
    });
}

const allKnownIds = new Set(
    allDocumentData.flatMap(({ config: document, anchors }) =>
        anchors.map((anchor) => unitId(document.document, anchor.numbering)),
    ),
);
const reportDocuments = [];

for (const data of allDocumentData) {
    const { config: document, hints, pages, anchors, sentinel } = data;
    const numberings = anchors.map((anchor) => anchor.numbering);
    const knownNumberings = new Set(numberings);
    const positions = siblingPositionMap(numberings);
    const detectionCounts: Record<string, number> = {};
    let blockCount = 0;
    let relationCount = 0;
    let assetIssueCount = 0;
    let anomalyIssueCount = 0;

    for (let index = 0; index < anchors.length; index += 1) {
        const anchor = anchors[index]!;
        const next = anchors[index + 1] ?? sentinel;
        if (anchorOrder(next) <= anchorOrder(anchor)) {
            throw new Error(
                `${document.document} ${anchor.numbering}: perimetro del corpo non positivo`,
            );
        }
        detectionCounts[anchor.detection] =
            (detectionCounts[anchor.detection] ?? 0) + 1;
        const id = unitId(document.document, anchor.numbering);
        const title = anchor.title;
        const heading = headingBlock(document, anchor, id);
        const body = bodyBlocks(document, pages, anchor, next, id);
        const blocks = [heading, ...body];
        blockCount += blocks.length;
        const fullRaw = blocks
            .map((block) => ("text" in block ? block.text.raw : ""))
            .join("\n");
        const slug = issueSlug(document.document, anchor.numbering);
        const openIssues: Array<{
            issueId: string;
            type:
                | "normalization-review"
                | "asset-review"
                | "relation-review"
                | "other";
            severity: "blocking" | "warning";
            note: string;
        }> = [
            {
                issueId: `${slug}-source-review`,
                type: "normalization-review",
                severity: "blocking",
                note: "Record estratto dall'evidence ufficiale ma non ancora confrontato integralmente da un revisore umano con il render della fonte.",
            },
        ];
        if (hasAssetCandidate(fullRaw)) {
            assetIssueCount += 1;
            openIssues.push({
                issueId: `${slug}-assets`,
                type: "asset-review",
                severity: "blocking",
                note: "Il segmento contiene candidati formula, tabella o figura che devono essere separati, trascritti e verificati come asset canonici.",
            });
        }
        if (containsExtractionAnomaly(fullRaw)) {
            anomalyIssueCount += 1;
            openIssues.push({
                issueId: `${slug}-extraction-anomalies`,
                type: "other",
                severity: "warning",
                note: "Il layer testuale contiene caratteri di controllo o glyph anomali; il raw è preservato e la normalizzazione minima è tracciata.",
            });
        }

        const relations = [];
        if (document.document === "circ2019") {
            const targetNumbering = anchor.numbering.replace(/^C/u, "");
            const targetId = unitId("ntc2018", targetNumbering);
            if (allKnownIds.has(targetId)) {
                relationCount += 1;
                relations.push({
                    relationId: `${id}#relation-001`,
                    type: "clarifies",
                    targetUnitId: targetId,
                    basis: "editorial",
                    evidenceBlockIds: [`${id}#block-heading`],
                    rationale: "Corrispondenza proposta tra numerazione omologa della Circolare e delle NTC; non implica ancora equivalenza semantica completa.",
                    review: {
                        status: "proposed",
                        reviewedBy: null,
                        reviewedAt: null,
                    },
                });
                openIssues.push({
                    issueId: `${slug}-relation`,
                    type: "relation-review",
                    severity: "blocking",
                    note: "Il collegamento Circolare-NTC per numerazione omologa richiede conferma umana sul contenuto completo.",
                });
            }
        }

        const record = {
            $schema: "urn:structural-codes:schema:canonical-unit:v2",
            schemaVersion: "2.0.0-alpha.1",
            recordType: "canonical-unit",
            id,
            workId: document.workId,
            expressionId: document.expressionId,
            legacyAliases:
                hints.get(anchor.numbering)?.alias === null ||
                hints.get(anchor.numbering)?.alias === undefined
                    ? []
                    : [hints.get(anchor.numbering)!.alias!],
            kind: unitKind(anchor.numbering),
            numbering: {
                official: anchor.numbering,
                sortKey: sortKey(anchor.numbering),
            },
            title,
            titleBlockId: `${id}#block-heading`,
            hierarchy: hierarchy(
                document,
                anchor.numbering,
                knownNumberings,
                positions,
            ),
            validity: {
                ...document.validity,
                asOf: config.asOf,
            },
            blocks,
            citations: [],
            relations,
            assets: {
                formulaIds: [],
                tableIds: [],
                figureIds: [],
            },
            workflow: {
                status: "extracted",
                createdBy: {
                    actorId: "migration:core-concrete:v1",
                    kind: "script",
                    toolVersion: RULE_VERSION,
                },
                createdAt: config.createdAt,
                reviews: [],
                openIssues,
            },
        };
        const outputDirectory = join(outputRoot, document.document);
        await mkdir(outputDirectory, { recursive: true });
        await writeFile(
            join(
                outputDirectory,
                `${anchor.numbering.toLocaleLowerCase("it")}.json`,
            ),
            `${JSON.stringify(record, null, 2)}\n`,
            "utf8",
        );
    }

    reportDocuments.push({
        document: document.document,
        sourceId: document.sourceId,
        pages: document.pages,
        legacyInventoryHints: hints.size,
        canonicalUnits: anchors.length,
        canonicalBlocks: blockCount,
        detection: detectionCounts,
        proposedRelations: relationCount,
        unitsWithAssetCandidates: assetIssueCount,
        unitsWithExtractionAnomalies: anomalyIssueCount,
        firstUnit: anchors[0]?.numbering ?? null,
        lastUnit: anchors.at(-1)?.numbering ?? null,
        stopBefore: sentinel.numbering,
    });
}

const report = {
    reportVersion: 1,
    scopeId: config.scopeId,
    asOf: config.asOf,
    status: "canonical-extracted-not-reviewed",
    disclaimer:
        "Le unità derivano dall'evidence ufficiale e superano i controlli strutturali, ma non sono source-checked, double-reviewed o pubblicabili. Gli asset restano da segmentare.",
    documents: reportDocuments,
    totals: {
        canonicalUnits: reportDocuments.reduce(
            (sum, document) => sum + document.canonicalUnits,
            0,
        ),
        canonicalBlocks: reportDocuments.reduce(
            (sum, document) => sum + document.canonicalBlocks,
            0,
        ),
        proposedRelations: reportDocuments.reduce(
            (sum, document) => sum + document.proposedRelations,
            0,
        ),
    },
};
const reportWithFingerprint = {
    ...report,
    fingerprintSha256: sha256OfJson(report),
};
await mkdir(reportRoot, { recursive: true });
await writeFile(
    join(reportRoot, "core-concrete-corpus.json"),
    `${JSON.stringify(reportWithFingerprint, null, 2)}\n`,
    "utf8",
);

const markdown = [
    "# Migrazione canonica — capitoli strutturali prioritari",
    "",
    `> Stato: **${report.status}**. ${report.disclaimer}`,
    "",
    `- Unità canoniche estratte: ${report.totals.canonicalUnits}`,
    `- Blocchi con evidence di regione: ${report.totals.canonicalBlocks}`,
    `- Relazioni Circolare → NTC proposte: ${report.totals.proposedRelations}`,
    `- Fingerprint report: \`${reportWithFingerprint.fingerprintSha256}\``,
    "",
    "| Documento | Pagine PDF | Unità | Blocchi | Anchor testo | Anchor visuali | Relazioni | Unità con asset candidati |",
    "|---|---:|---:|---:|---:|---:|---:|---:|",
    ...reportDocuments.map(
        (document) =>
            `| ${document.document} | ${document.pages.from}–${document.pages.to} | ${document.canonicalUnits} | ${document.canonicalBlocks} | ${document.detection["text-extraction"] ?? 0} | ${document.detection["visual-anchor"] ?? 0} | ${document.proposedRelations} | ${document.unitsWithAssetCandidates} |`,
    ),
    "",
    "## Limiti aperti",
    "",
    "- Ogni unità resta in stato `extracted` con review della fonte bloccante.",
    "- Formule, tabelle e figure sono solo rilevate come candidati e non ancora modellate come asset canonici.",
    "- Le relazioni per numerazione omologa sono proposte editoriali, non confermate.",
    "- Il testo legacy non è stato copiato: è stato usato soltanto per numerazioni e alias di migrazione.",
    "",
].join("\n");
await writeFile(
    join(reportRoot, "core-concrete-corpus.md"),
    markdown,
    "utf8",
);

console.log(
    `canonical-core: ${report.totals.canonicalUnits} unità, ${report.totals.canonicalBlocks} blocchi, ${report.totals.proposedRelations} relazioni proposte`,
);
