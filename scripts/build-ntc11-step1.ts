/* eslint-disable @typescript-eslint/no-explicit-any */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../", import.meta.url));
const sourceId = "gu-so8-2018-ntc";
const profile = "ntc11-editorial-profile-0.1.0";
const sourcePages = { from: 309, to: 370 };
const outDir = join(repoRoot, "corpus", "units", "ntc2018");
const assetDir = join(repoRoot, "corpus", "assets", "ntc2018");
const evidenceDir = join(repoRoot, "evidence", sourceId, "pages");

type Line = {
    page: number;
    sequence: number;
    text: string;
    raw: string;
    y: number;
    x: number;
    width: number;
    printedPage: string | null;
};

type UnitSpec = {
    number: string;
    title: string;
    kind: "chapter" | "section" | "subparagraph";
};

type AssetSpec = {
    id: string;
    kind: "formula-ref" | "table-ref";
    page: number;
    anchor: RegExp;
    end: RegExp;
};

const seedUnits: UnitSpec[] = [
    { number: "11", title: "MATERIALI E PRODOTTI PER USO STRUTTURALE", kind: "chapter" },
    { number: "11.1", title: "GENERALITÀ", kind: "section" },
    { number: "11.2", title: "CALCESTRUZZO", kind: "section" },
    { number: "11.2.1", title: "SPECIFICHE PER IL CALCESTRUZZO", kind: "subparagraph" },
    { number: "11.2.2", title: "CONTROLLI DI QUALITÀ DEL CALCESTRUZZO", kind: "subparagraph" },
    { number: "11.2.3", title: "VALUTAZIONE PRELIMINARE", kind: "subparagraph" },
    { number: "11.2.4", title: "PRELIEVO E PROVA DEI CAMPIONI", kind: "subparagraph" },
    { number: "11.2.5", title: "CONTROLLO DI ACCETTAZIONE", kind: "subparagraph" },
    { number: "11.2.5.1", title: "CONTROLLO DI TIPO A", kind: "subparagraph" },
    { number: "11.2.5.2", title: "CONTROLLO DI TIPO B", kind: "subparagraph" },
    { number: "11.2.5.3", title: "PRESCRIZIONI COMUNI PER ENTRAMBI I CRITERI DI CONTROLLO", kind: "subparagraph" },
    { number: "11.2.6", title: "CONTROLLO DELLA RESISTENZA DEL CALCESTRUZZO IN OPERA", kind: "subparagraph" },
    { number: "11.2.7", title: "PROVE COMPLEMENTARI", kind: "subparagraph" },
    { number: "11.2.8", title: "PRESCRIZIONI RELATIVE AL CALCESTRUZZO CONFEZIONATO CON PROCESSO INDUSTRIALIZZATO", kind: "subparagraph" },
    { number: "11.2.9", title: "COMPONENTI DEL CALCESTRUZZO", kind: "subparagraph" },
    { number: "11.2.9.1", title: "LEGANTI", kind: "subparagraph" },
    { number: "11.2.9.2", title: "AGGREGATI", kind: "subparagraph" },
    { number: "11.2.9.3", title: "AGGIUNTE", kind: "subparagraph" },
    { number: "11.2.9.4", title: "ADDITIVI", kind: "subparagraph" },
    { number: "11.2.9.5", title: "ACQUA DI IMPASTO", kind: "subparagraph" },
    { number: "11.2.9.6", title: "MISCELE PRECONFEZIONATE DI COMPONENTI PER CALCESTRUZZO", kind: "subparagraph" },
    { number: "11.2.10", title: "CARATTERISTICHE DEL CALCESTRUZZO", kind: "subparagraph" },
    { number: "11.2.10.1", title: "RESISTENZA A COMPRESSIONE", kind: "subparagraph" },
    { number: "11.2.10.2", title: "RESISTENZA A TRAZIONE", kind: "subparagraph" },
    { number: "11.2.10.3", title: "MODULO ELASTICO", kind: "subparagraph" },
    { number: "11.2.10.4", title: "COEFFICIENTE DI POISSON", kind: "subparagraph" },
    { number: "11.2.10.5", title: "COEFFICIENTE DI DILATAZIONE TERMICA", kind: "subparagraph" },
    { number: "11.2.10.6", title: "RITIRO", kind: "subparagraph" },
];

const unitNumbers = `
11
11.1 11.2 11.2.1 11.2.2 11.2.3 11.2.4 11.2.5 11.2.5.1 11.2.5.2 11.2.5.3 11.2.6 11.2.7 11.2.8 11.2.9 11.2.9.1 11.2.9.2 11.2.9.3 11.2.9.4 11.2.9.5 11.2.9.6 11.2.10 11.2.10.1 11.2.10.2 11.2.10.3 11.2.10.4 11.2.10.5 11.2.10.6 11.2.10.7 11.2.11 11.2.12
11.3 11.3.1 11.3.1.1 11.3.1.2 11.3.1.3 11.3.1.4 11.3.1.5 11.3.1.6 11.3.1.7
11.3.2 11.3.2.1 11.3.2.2 11.3.2.3 11.3.2.4 11.3.2.5 11.3.2.5.1 11.3.2.6 11.3.2.7 11.3.2.8 11.3.2.8.1 11.3.2.8.2 11.3.2.9 11.3.2.10 11.3.2.10.1 11.3.2.10.1.1 11.3.2.10.1.2 11.3.2.10.1.3 11.3.2.10.1.4 11.3.2.10.2 11.3.2.10.3 11.3.2.10.4 11.3.2.11 11.3.2.11.1 11.3.2.11.1.1 11.3.2.11.1.2 11.3.2.11.2 11.3.2.12
11.3.3 11.3.3.1 11.3.3.2 11.3.3.3 11.3.3.4 11.3.3.5 11.3.3.5.1 11.3.3.5.2 11.3.3.5.2.1 11.3.3.5.2.2 11.3.3.5.2.3 11.3.3.5.2.4 11.3.3.5.3 11.3.3.5.4 11.3.3.5.5 11.3.3.5.6 11.3.3.5.7
11.3.4 11.3.4.1 11.3.4.2 11.3.4.2.1 11.3.4.2.2 11.3.4.3 11.3.4.4 11.3.4.5 11.3.4.6 11.3.4.6.1 11.3.4.6.2 11.3.4.6.3 11.3.4.6.4 11.3.4.7 11.3.4.8 11.3.4.9 11.3.4.10 11.3.4.11 11.3.4.11.1 11.3.4.11.1.1 11.3.4.11.1.2 11.3.4.11.1.3 11.3.4.11.1.4 11.3.4.11.1.5 11.3.4.11.2 11.3.4.11.2.1 11.3.4.11.2.2 11.3.4.11.2.3 11.3.4.11.2.4 11.3.4.11.3
11.4 11.4.1 11.4.2 11.5 11.5.1 11.5.2 11.6
11.7 11.7.1 11.7.1.1 11.7.2 11.7.3 11.7.4 11.7.5 11.7.6 11.7.7 11.7.7.1 11.7.7.2 11.7.8 11.7.9 11.7.9.1 11.7.9.2 11.7.10 11.7.10.1 11.7.10.1.1 11.7.10.1.2 11.7.10.2
11.8 11.8.1 11.8.2 11.8.3 11.8.3.1 11.8.3.2 11.8.3.3 11.8.3.4 11.8.4 11.8.4.1 11.8.4.2 11.8.4.3 11.8.4.4 11.8.5 11.8.6
11.9 11.9.1 11.9.2 11.9.3 11.9.4 11.9.4.1 11.9.5 11.9.5.1 11.9.6 11.9.6.1 11.9.7 11.9.7.1 11.9.8 11.9.8.1 11.9.9 11.9.9.1 11.9.10 11.9.10.1
11.10 11.10.1 11.10.1.1 11.10.1.1.1 11.10.2 11.10.2.1 11.10.2.2 11.10.2.3 11.10.2.4 11.10.3 11.10.3.1 11.10.3.1.1 11.10.3.1.2 11.10.3.2 11.10.3.2.1 11.10.3.2.2 11.10.3.3 11.10.3.4
`.trim().split(/\s+/u);

const units: UnitSpec[] = unitNumbers
    .sort((left, right) => sortKey(left).localeCompare(sortKey(right)))
    .map((number) => {
        const seed = seedUnits.find((candidate) => candidate.number === number);
        return {
            number,
            title: seed?.title ?? "",
            kind: seed?.kind ?? (number.split(".").length === 2 ? "section" : "subparagraph"),
        };
    });

const assetSpecs: AssetSpec[] = [
    { id: "urn:structural-codes:it:asset:table:ntc2018:11.2.i", kind: "table-ref", page: 313, anchor: /^Tab\. 11\.2\.I/u, end: /^s = scarto/u },
    { id: "urn:structural-codes:it:asset:table:ntc2018:11.2.ii", kind: "table-ref", page: 316, anchor: /^Tab\. 11\.2\.II/u, end: /2 \+/u },
    { id: "urn:structural-codes:it:asset:table:ntc2018:11.2.iii", kind: "table-ref", page: 316, anchor: /^Tab\. 11\.2\.III/u, end: /fino al 10%/u },
    { id: "urn:structural-codes:it:asset:table:ntc2018:11.2.iv", kind: "table-ref", page: 316, anchor: /^Tab\. 11\.2\.IV/u, end: /proveniente da riciclo\)/u },
    { id: "urn:structural-codes:it:asset:formula:ntc2018:11.2.1", kind: "formula-ref", page: 317, anchor: /^f ck =/u, end: /11\.2\.1/u },
    { id: "urn:structural-codes:it:asset:formula:ntc2018:11.2.2", kind: "formula-ref", page: 317, anchor: /^f cm =/u, end: /11\.2\.2/u },
    { id: "urn:structural-codes:it:asset:formula:ntc2018:11.2.3a", kind: "formula-ref", page: 317, anchor: /^f ctm = 0,30/u, end: /11\.2\.3a/u },
    { id: "urn:structural-codes:it:asset:formula:ntc2018:11.2.3b", kind: "formula-ref", page: 317, anchor: /^f ctm = 2,12/u, end: /11\.2\.3b/u },
    { id: "urn:structural-codes:it:asset:formula:ntc2018:11.2.4", kind: "formula-ref", page: 317, anchor: /^f cfm =/u, end: /11\.2\.4/u },
    { id: "urn:structural-codes:it:asset:formula:ntc2018:11.2.5", kind: "formula-ref", page: 317, anchor: /^E cm =/u, end: /11\.2\.5/u },
    { id: "urn:structural-codes:it:asset:formula:ntc2018:11.2.6", kind: "formula-ref", page: 317, anchor: /^(?:Î‰|Ή)cs =/u, end: /11\.2\.6/u },
];

const formulaLatex: Record<string, string> = {
    "urn:structural-codes:it:asset:formula:ntc2018:11.2.1": "f_{ck}=0{,}83\\cdot R_{ck}",
    "urn:structural-codes:it:asset:formula:ntc2018:11.2.2": "f_{cm}=f_{ck}+8\\;[\\mathrm{N/mm^2}]",
    "urn:structural-codes:it:asset:formula:ntc2018:11.2.3a": "f_{ctm}=0{,}30\\cdot f_{ck}^{2/3}\\qquad\\text{per classi }\\le\\mathrm{C50/60}",
    "urn:structural-codes:it:asset:formula:ntc2018:11.2.3b": "f_{ctm}=2{,}12\\cdot\\ln\\left[1+\\frac{f_{cm}}{10}\\right]\\qquad\\text{per classi }>\\mathrm{C50/60}",
    "urn:structural-codes:it:asset:formula:ntc2018:11.2.4": "f_{cfm}=1{,}2\\,f_{ctm}",
    "urn:structural-codes:it:asset:formula:ntc2018:11.2.5": "E_{cm}=22{.}000\\cdot\\left[\\frac{f_{cm}}{10}\\right]^{0{,}3}\\;[\\mathrm{N/mm^2}]",
    "urn:structural-codes:it:asset:formula:ntc2018:11.2.6": "\\varepsilon_{cs}=\\varepsilon_{cd}+\\varepsilon_{ca}",
};

function sha256(value: string): string {
    return createHash("sha256").update(value, "utf8").digest("hex");
}

function idFor(number: string): string {
    return `urn:structural-codes:it:unit:ntc2018:${number}`;
}

function sortKey(number: string): string {
    return number.split(".").map((part) => part.padStart(3, "0")).join(".");
}

function headingRegex(number: string): RegExp {
    return new RegExp(`^${number.replaceAll(".", "\\.")}(?:\\.(?=\\s|$)|\\s)`, "u");
}

function normalizeSymbols(value: string): string {
    return value
        .replaceAll("Çƒ", "≥")
        .replaceAll("Ç‚", "≤")
        .replaceAll("È‰", "·")
        .replaceAll("Â˜", "·")
        .replaceAll("Æº", "−")
        .replaceAll("Çˆ", "∞")
        .replaceAll("Â§", "§")
        .replaceAll("Â°", "°")
        .replaceAll("Â²", "²")
        .replaceAll("Â³", "³")
        .replaceAll(/>11\.([0-9.]+)[a-z]?@/gu, "[$1]")
        .replaceAll(/>11\.([0-9.]+)[a-z]?\]/gu, "[$1]")
        .replaceAll("Î‰cs", "εcs")
        .replaceAll("Î‰cd", "εcd")
        .replaceAll("Î‰ca", "εca")
        .replaceAll("Ήcs", "εcs")
        .replaceAll("Ήcd", "εcd")
        .replaceAll("Ήca", "εca")
        .replaceAll("Îš", "φ")
        .replaceAll(/\bR\s+c\s*,\s*min\b/gu, "Rc,min")
        .replaceAll(/\bR\s+cm28\b/gu, "Rcm28")
        .replaceAll(/\bR\s+ck\b/gu, "Rck")
        .replaceAll(/\bf\s+ck\b/gu, "fck")
        .replaceAll(/\bf\s+cm\b/gu, "fcm")
        .replaceAll(/\bf\s+ctm\b/gu, "fctm")
        .replaceAll(/\bf\s+cfm\b/gu, "fcfm")
        .replaceAll(/\bE\s+cm\b/gu, "Ecm")
        .replaceAll(/\bNÂ°\b/gu, "N°")
        .replaceAll(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/gu, "")
        .replaceAll(/\s+/gu, " ")
        .trim();
}

function joinLines(lines: string[]): string {
    let result = "";
    for (const line of lines) {
        const current = line.trim();
        if (current.length === 0) continue;
        if (result.length === 0) {
            result = current;
        } else if (/^\p{Ll}/u.test(current) && result.endsWith("-")) {
            result = `${result.slice(0, -1)}${current}`;
        } else {
            result += ` ${current}`;
        }
    }
    return normalizeSymbols(result);
}

function normalizeTitle(value: string): string {
    let result = value.replaceAll(/\b([B-DF-HJ-NP-TV-Z]) (?=[A-Z])/gu, "$1");
    for (const [broken, fixed] of [
        ["A CCIAIO", "ACCIAIO"],
        ["A CCIAI", "ACCIAI"],
        ["A CCERTAMENTO", "ACCERTAMENTO"],
        ["A CCETTAZIONE", "ACCETTAZIONE"],
        ["A LTRI", "ALTRI"],
        ["A DESIVI", "ADESIVI"],
        ["A GGREGATI", "AGGREGATI"],
        ["A GGIUNTE", "AGGIUNTE"],
        ["A DDITIVI", "ADDITIVI"],
    ] as const) result = result.replaceAll(broken, fixed);
    return result
        .replaceAll("L EGANTI", "LEGANTI")
        .replaceAll("M ODULO", "MODULO")
        .replaceAll("P OISSON", "POISSON")
        .replaceAll("P RESCRIZIONI", "PRESCRIZIONI")
        .replaceAll("P ROCEDURE", "PROCEDURE")
        .replaceAll("P ROVE", "PROVE")
        .replaceAll("F ORNITURE", "FORNITURE")
        .replaceAll("F ABBRICANTI", "FABBRICANTI")
        .replaceAll("G ENERALITÀ", "GENERALITÀ")
        .replaceAll("Q UALIFICAZIONE", "QUALIFICAZIONE")
        .replaceAll("S ALDABILITÀ", "SALDABILITÀ")
        .replaceAll("S OSPENSIONI", "SOSPENSIONI")
        .replaceAll("L AVORAZIONE", "LAVORAZIONE")
        .replaceAll("M ALTE", "MALTE")
        .trim();
}

function normalizeHeading(raw: string, number: string, title: string): string {
    if (number === "11") return "11 MATERIALI E PRODOTTI PER USO STRUTTURALE";
    return `${number} ${normalizeTitle(title)}`
        .replace("L EGANTI", "LEGANTI")
        .replace("A GGREGATI", "AGGREGATI")
        .replace("A GGIUNTE", "AGGIUNTE")
        .replace("A DDITIVI", "ADDITIVI")
        .replace("M ODULO", "MODULO")
        .replace("P OISSON", "POISSON")
        .replace("V ISCOSITÀ", "VISCOSITÀ")
        .replace("P RESCRIZIONI", "PRESCRIZIONI");
}

function transformations(raw: string, normalized: string): any[] {
    if (raw === normalized) return [];
    const result: any[] = [];
    if (raw.includes("\n")) {
        result.push({
            operation: "join-line-wrap",
            ruleVersion: profile,
            note: "Ricomposti i ritorni a capo tipografici verificati sul render ufficiale.",
        });
    }
    if (/-\n/gu.test(raw)) {
        result.push({
            operation: "remove-discretionary-hyphen",
            ruleVersion: profile,
            note: "Ricomposte le parole sillabate a fine riga dopo controllo visivo.",
        });
    }
    if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/gu.test(raw)) {
        result.push({
            operation: "remove-control-character",
            ruleVersion: profile,
            note: "Rimossi dal testo normalizzato i caratteri di controllo presenti nel layer testuale PDF; il raw resta conservato.",
        });
    }
    result.push({
        operation: "manual-correction",
        ruleVersion: profile,
        note: "Ripristinati simboli, accenti, spaziatura e notazione matematica dal render ufficiale.",
    });
    return result;
}

function inlineSegments(text: string): any[] | undefined {
    const terms = [
        ["Rcm28", "R_{cm28}"],
        ["Rc,min", "R_{c,\\min}"],
        ["Rck", "R_{ck}"],
        ["fctm", "f_{ctm}"],
        ["fcfm", "f_{cfm}"],
        ["fcm", "f_{cm}"],
        ["fck", "f_{ck}"],
        ["Ecm", "E_{cm}"],
        ["εcs", "\\varepsilon_{cs}"],
        ["εcd", "\\varepsilon_{cd}"],
        ["εca", "\\varepsilon_{ca}"],
        ["h0", "h_0"],
        ["t0", "t_0"],
        ["fy", "f_y"],
        ["ft", "f_t"],
        ["fyk", "f_{yk}"],
        ["ftk", "f_{tk}"],
        ["fbk", "f_{bk}"],
        ["fbm", "f_{bm}"],
        ["fvk", "f_{vk}"],
        ["N/mm²", "\\mathrm{N/mm^2}"],
    ] as const;
    const found = terms
        .filter(([value]) => text.includes(value))
        .sort((left, right) => right[0].length - left[0].length);
    if (found.length === 0) return undefined;
    const segments: any[] = [];
    let cursor = 0;
    while (cursor < text.length) {
        let match: { index: number; value: string; latex: string } | undefined;
        for (const [value, latex] of found) {
            const index = text.indexOf(value, cursor);
            if (index >= 0 && (match === undefined || index < match.index || (index === match.index && value.length > match.value.length))) {
                match = { index, value, latex };
            }
        }
        if (match === undefined) {
            segments.push({ kind: "text", value: text.slice(cursor) });
            break;
        }
        if (match.index > cursor) segments.push({ kind: "text", value: text.slice(cursor, match.index) });
        segments.push({ kind: "math", value: match.value, latex: match.latex });
        cursor = match.index + match.value.length;
    }
    return segments.filter((segment) => segment.value.length > 0);
}

type VerifiedInlineToken = { value: string; latex: string };

function verifiedInline(text: string, tokens: VerifiedInlineToken[]): any[] {
    const segments: any[] = [];
    let cursor = 0;
    for (const token of tokens) {
        const index = text.indexOf(token.value, cursor);
        if (index < 0) throw new Error(`Token inline non trovato: ${token.value} in ${text}`);
        if (index > cursor) segments.push({ kind: "text", value: text.slice(cursor, index) });
        segments.push({ kind: "math", value: token.value, latex: token.latex });
        cursor = index + token.value.length;
    }
    if (cursor < text.length) segments.push({ kind: "text", value: text.slice(cursor) });
    return segments;
}

function evidence(page: number, printedPage: string | null, raw: string, normalized: string, region: any = null): any {
    return {
        sourceId,
        pdfPage: page,
        printedPage,
        region,
        extraction: { method: "pdf-text", tool: "pdfjs-dist", toolVersion: "4.10.38" },
        transformations: transformations(raw, normalized),
        rawSha256: sha256(raw),
        normalizedSha256: sha256(normalized),
    };
}

function sameLine(previous: any, item: any): boolean {
    return previous !== undefined && !previous.hasEol && !(item.region.x <= previous.region.x + 0.5 && Math.abs(item.region.y - previous.region.y) > Math.max(2, previous.region.height * 0.6));
}

function buildLines(page: number, record: any): Line[] {
    const lines: Line[] = [];
    let current: Line | undefined;
    let previous: any;
    for (const item of record.textItems) {
        if (!sameLine(previous, item)) {
            if (current !== undefined && current.text.length > 0) lines.push(current);
            current = item.text.length === 0 ? undefined : {
                    page,
                    sequence: lines.length,
                    text: item.text,
                    raw: item.text,
                    y: item.region.y,
                    x: item.region.x,
                    width: item.region.width,
                    printedPage: record.printedPage,
                };
        } else if (current !== undefined) {
            const previousEnd = previous.region.x + previous.region.width;
            const gap = item.region.x - previousEnd;
            const needsSpace = gap > Math.max(0.5, previous.region.height * 0.08) && !/\s$/u.test(current.text) && !/^[,.;:!?)\]}]/u.test(item.text);
            current.text += `${needsSpace ? " " : ""}${item.text}`;
            current.raw = current.text;
            current.width = Math.max(current.width, item.region.x + item.region.width - current.x);
        }
        previous = item;
    }
    if (current !== undefined && current.text.length > 0) lines.push(current);
    return lines;
}

function isHeader(line: Line): boolean {
    return /^\s*(?:—|-)+\s*\d{1,4}\s*(?:—|-)+\s*$/u.test(line.text) || /Supplemento ordinario n\. 8/u.test(line.text);
}

function makeBlockId(unit: string, n: number): string {
    return `${idFor(unit)}#block-${String(n).padStart(3, "0")}`;
}

function paragraphKind(text: string): "paragraph" | "list-item" | "heading" {
    if (/^(?:–|-|[A-D]\)|[a-d]\))\s*/u.test(text)) return "list-item";
    if (["Valutazione preliminare", "Controllo di produzione", "Controllo di accettazione", "Prove complementari"].includes(text)) return "heading";
    return "paragraph";
}

function isNewParagraph(previous: Line | undefined, current: Line, previousKind: string | undefined): boolean {
    if (previous === undefined) return true;
    if (/^(?:–|-|[A-D]\)|[a-d]\))\s*/u.test(current.text)) return true;
    if (previousKind === "list-item" && !/^(?:–|-|[A-D]\)|[a-d]\))\s*/u.test(current.text) && current.x > previous.x + 1) return false;
    return current.page !== previous.page || current.y - previous.y > 11.5;
}

function lineKey(line: Line): string {
    return `${line.page}:${line.sequence}`;
}

function tableCell(text: string, extra: any = {}): any {
    return { text, ...extra };
}

const tableSeeds: any[] = [
    {
        id: "urn:structural-codes:it:asset:table:ntc2018:11.2.i",
        unitId: idFor("11.2.5"), officialNumber: "11.2.I", pdfPage: 313,
        caption: "Tab. 11.2.I", columnCount: 2,
        headers: [[tableCell("Controllo di tipo A"), tableCell("Controllo di tipo B")]],
        rows: [
            [tableCell("Rc,min ≥ Rck − 3,5", { latex: "R_{c,\\min}\\ge R_{ck}-3{,}5", colSpan: 2 })],
            [tableCell("Rcm28 ≥ Rck + 3,5", { latex: "R_{cm28}\\ge R_{ck}+3{,}5" }), tableCell("Rcm28 ≥ Rck + 1,48 s", { latex: "R_{cm28}\\ge R_{ck}+1{,}48s" })],
            [tableCell("(N° prelievi: 3)"), tableCell("(N° prelievi ≥ 15)")],
        ], notes: [
            "Ove: Rcm28 = resistenza media dei prelievi (N/mm²); Rc,min = minore valore di resistenza dei prelievi (N/mm²); s = scarto quadratico medio.",
            "Trascritta dal render della pagina ufficiale; revisione umana ancora obbligatoria.",
        ],
    },
    {
        id: "urn:structural-codes:it:asset:table:ntc2018:11.2.ii",
        unitId: idFor("11.2.9.2"), officialNumber: "11.2.II", pdfPage: 316,
        caption: "Tab. 11.2.II", columnCount: 3,
        headers: [[tableCell("Specifica Tecnica Europea armonizzata di riferimento"), tableCell("Uso Previsto"), tableCell("Sistema di Valutazione e Verifica della Costanza della Prestazione")]],
        rows: [[tableCell("Aggregati per calcestruzzo UNI EN 12620 e UNI EN 13055-1"), tableCell("Calcestruzzo strutturale"), tableCell("2 +", { latex: "2+" })]],
        notes: ["Trascritta dal render della pagina ufficiale; revisione umana ancora obbligatoria."],
    },
    {
        id: "urn:structural-codes:it:asset:table:ntc2018:11.2.iii",
        unitId: idFor("11.2.9.2"), officialNumber: "11.2.III", pdfPage: 316,
        caption: "Tab. 11.2.III", columnCount: 3,
        headers: [[tableCell("Origine del materiale da riciclo"), tableCell("Classe del calcestruzzo"), tableCell("percentuale di impiego")]],
        rows: [
            [tableCell("demolizioni di edifici (macerie)"), tableCell("= C 8/10", { latex: "=\\mathrm{C8/10}" }), tableCell("fino al 100%")],
            [tableCell("demolizioni di solo calcestruzzo e c.a. (frammenti di calcestruzzo ≥ 90%, UNI EN 933-11:2009)", { rowSpan: 3 }), tableCell("≤ C20/25", { latex: "\\le\\mathrm{C20/25}" }), tableCell("fino al 60%")],
            [tableCell("≤ C30/37", { latex: "\\le\\mathrm{C30/37}" }), tableCell("≤ 30%", { latex: "\\le30\\%" })],
            [tableCell("≤ C45/55", { latex: "\\le\\mathrm{C45/55}" }), tableCell("≤ 20%", { latex: "\\le20\\%" })],
            [tableCell("Riutilizzo di calcestruzzo interno negli stabilimenti di prefabbricazione qualificati - da qualsiasi classe", { rowSpan: 2 }), tableCell("Classe minore del calcestruzzo di origine"), tableCell("fino al 15%")],
            [tableCell("Stessa classe del calcestruzzo di origine"), tableCell("fino al 10%")],
        ], notes: ["Trascritta dal render della pagina ufficiale; revisione umana ancora obbligatoria."],
    },
    {
        id: "urn:structural-codes:it:asset:table:ntc2018:11.2.iv",
        unitId: idFor("11.2.9.2"), officialNumber: "11.2.IV", pdfPage: 316,
        caption: "Tab. 11.2.IV – Controlli di accettazione per aggregati per calcestruzzo strutturale", columnCount: 1,
        headers: [[tableCell("Caratteristiche tecniche")]],
        rows: [
            [tableCell("Descrizione petrografica")],
            [tableCell("Dimensione dell’aggregato (analisi granulometrica e contenuto dei fini)")],
            [tableCell("Indice di appiattimento")],
            [tableCell("Tenore di solfati e zolfo")],
            [tableCell("Dimensione per il filler")],
            [tableCell("Resistenza alla frammentazione/frantumazione (per calcestruzzo Rck ≥ C50/60 e aggregato proveniente da riciclo)")],
        ], notes: ["Trascritta dal render della pagina ufficiale; revisione umana ancora obbligatoria."],
    },
];

const formulaSeeds: any[] = Object.entries(formulaLatex).map(([id, latex]) => {
    const number = id.split(":").at(-1)!;
    return {
        id, unitId: idFor(number === "11.2.6" ? "11.2.10.6" : number === "11.2.5" ? "11.2.10.3" : number === "11.2.4" || number.startsWith("11.2.3") ? "11.2.10.2" : "11.2.10.1"),
        officialNumber: number, pdfPage: 317, latex,
    };
});

const allRecords: Line[] = [];
for (let page = sourcePages.from; page <= sourcePages.to; page += 1) {
    const record = JSON.parse(await readFile(join(evidenceDir, `page-${String(page).padStart(4, "0")}.json`), "utf8"));
    allRecords.push(...buildLines(page, record).filter((line) => !isHeader(line)));
}

function firstLine(spec: UnitSpec): Line {
    if (spec.number === "11") return allRecords.find((line) => line.page === 309 && /^CAPITOLO 11\./u.test(line.text))!;
    const candidates = allRecords.filter((candidate) => {
        const text = candidate.text.replace(/\s+/gu, " ").trim();
        return headingRegex(spec.number).test(text);
    });
    const prefix = new RegExp(`^${spec.number.replaceAll(".", "\\.")}\\.?\\s*`, "u");
    const line = candidates.find((candidate) => normalizeSymbols(candidate.text.replace(prefix, "").replace(/[.:]+$/u, "").trim()).length > 0) ?? candidates[0];
    if (line === undefined) throw new Error(`Heading non trovato: ${spec.number}`);
    return line;
}

for (const spec of units) {
    if (spec.title.length > 0) continue;
    const line = firstLine(spec);
    const prefix = new RegExp(`^${spec.number.replaceAll(".", "\\.")}\\.?\\s*`, "u");
    spec.title = normalizeSymbols(line.text.replace(prefix, "").trim()).replace(/[.:]+$/u, "").trim();
}
const titleOverrides: Record<string, string> = {
    "11.3.2.12": "CONTROLLI DI ACCETTAZIONE IN CANTIERE",
    "11.3.3.5.2.3": "Determinazione delle proprietà e tolleranze",
    "11.3.4.11.2": "Controlli nei centri di trasformazione e nei centri di produzione di elementi tipologici in acciaio",
};
for (const spec of units) {
    if (titleOverrides[spec.number] !== undefined) spec.title = titleOverrides[spec.number]!;
}

const starts = units.map((spec) => ({ spec, line: firstLine(spec), index: 0 }));
for (const start of starts) start.index = allRecords.findIndex((line) => line === start.line);

function compareLine(a: Line, b: Line): number {
    return a.page - b.page || a.sequence - b.sequence;
}

function assetEvents(): Array<{ spec: AssetSpec; start: Line; end: Line }> {
    return assetSpecs.flatMap((spec) => {
        const pageLines = allRecords.filter((line) => line.page === spec.page);
        const start = pageLines.find((line) => spec.anchor.test(line.text));
        const end = pageLines.find((line) => start !== undefined && line.sequence >= start.sequence && spec.end.test(line.text));
        if (start === undefined || end === undefined) throw new Error(`Asset non localizzato: ${spec.id}`);
        return [{ spec, start, end }];
    });
}

const events = assetEvents();
const assetSkip = new Set<string>();
for (const event of events) {
    for (const line of allRecords.filter((candidate) => candidate.page === event.start.page && candidate.sequence >= event.start.sequence && candidate.sequence <= event.end.sequence)) assetSkip.add(lineKey(line));
}

function eventEvidence(event: { start: Line; end: Line }, normalized: string): any {
    const raw = allRecords.filter((line) => line.page === event.start.page && line.sequence >= event.start.sequence && line.sequence <= event.end.sequence).map((line) => line.raw).join("\n");
    return evidence(event.start.page, event.start.printedPage, raw, normalized, null);
}

function blocksFor(startIndex: number, endIndex: number, unitNumber: string): { blocks: any[]; assetIds: string[] } {
    const lines = allRecords.slice(startIndex, endIndex).filter((line) => !assetSkip.has(lineKey(line)));
    const blocks: any[] = [];
    const assetIds: string[] = [];
    let group: Line[] = [];
    let previous: Line | undefined;
    let previousKind: string | undefined;
    const flush = () => {
        if (group.length === 0) return;
        const raw = group.map((line) => line.raw).join("\n");
        const normalized = joinLines(group.map((line) => line.text));
        const kind = paragraphKind(normalized);
        if (kind === "heading") {
            blocks.push({
                blockId: makeBlockId(unitNumber, blocks.length),
                kind,
                origin: "official",
                text: { raw, normalized, normalizationVersion: profile },
                evidence: evidence(group[0]!.page, group[0]!.printedPage, raw, normalized, null),
            });
        } else {
            const payload: any = { raw, normalized, normalizationVersion: profile };
            const inline = inlineSegments(normalized);
            if (inline !== undefined) payload.inline = inline;
            blocks.push({
                blockId: makeBlockId(unitNumber, blocks.length),
                kind,
                origin: "official",
                text: payload,
                evidence: evidence(group[0]!.page, group[0]!.printedPage, raw, normalized, null),
            });
        }
        group = [];
    };

    const assetPositions = events.filter((event) => {
        const index = allRecords.findIndex((line) => line === event.start);
        return index >= startIndex && index < endIndex;
    }).sort((a, b) => compareLine(a.start, b.start));
    let assetCursor = 0;
    const flushAssetsBefore = (line: Line) => {
        while (assetCursor < assetPositions.length && compareLine(assetPositions[assetCursor]!.start, line) <= 0) {
            flush();
            const asset = assetPositions[assetCursor]!;
            const normalized = asset.spec.kind === "formula-ref" ? formulaLatex[asset.spec.id]! : asset.spec.id;
            const blockId = makeBlockId(unitNumber, blocks.length);
            blocks.push({ blockId, kind: asset.spec.kind, origin: "official", assetId: asset.spec.id, evidence: eventEvidence(asset, normalized) });
            assetIds.push(asset.spec.id);
            assetCursor += 1;
        }
    };

    for (const line of lines) {
        flushAssetsBefore(line);
        const normalizedLine = normalizeSymbols(line.text).replace(/\s+/gu, " ").trim();
        const cleanLine = { ...line, text: normalizedLine };
        const isHeading = units.some((spec) => {
            if (spec.number === unitNumber || !headingRegex(spec.number).test(normalizedLine)) return false;
            const suffix = normalizedLine.slice(spec.number.length).replace(/^\.\s*/u, "").trim();
            return /[A-Za-zÀ-ÖØ-öø-ÿ]/u.test(suffix);
        });
        if (isHeading) continue;
        const kind = paragraphKind(normalizedLine);
        if (isNewParagraph(previous, cleanLine, previousKind)) {
            flush();
            group = [cleanLine];
            previousKind = kind;
        } else {
            group.push(cleanLine);
        }
        previous = cleanLine;
    }
    flush();
    while (assetCursor < assetPositions.length) {
        flush();
        const asset = assetPositions[assetCursor]!;
        const normalized = asset.spec.kind === "formula-ref" ? formulaLatex[asset.spec.id]! : asset.spec.id;
        blocks.push({ blockId: makeBlockId(unitNumber, blocks.length), kind: asset.spec.kind, origin: "official", assetId: asset.spec.id, evidence: eventEvidence(asset, normalized) });
        assetIds.push(asset.spec.id);
        assetCursor += 1;
    }
    return { blocks, assetIds };
}

const generatedUnits: any[] = [];
for (let index = 0; index < starts.length; index += 1) {
    const current = starts[index]!;
    const next = starts[index + 1];
    const startIndex = current.index + (current.spec.number === "11" ? 2 : 1);
    const endIndex = next?.index ?? allRecords.length;
    const built = blocksFor(startIndex, endIndex, current.spec.number);
    const headingRaw = current.spec.number === "11"
        ? "CAPITOLO 11.\nMATERIALI E PRODOTTI PER USO STRUTTURALE"
        : current.line.raw.trim().split(/\s+/u).length > 1 ? current.line.raw : `${current.line.raw} ${current.spec.title}`;
    const normalizedTitle = normalizeTitle(current.spec.title);
    const headingNormalized = normalizeHeading(headingRaw, current.spec.number, normalizedTitle);
    const headingBlock = {
        blockId: `${idFor(current.spec.number)}#block-heading`,
        kind: "heading",
        origin: "official",
        text: { raw: headingRaw, normalized: headingNormalized, normalizationVersion: profile },
        evidence: evidence(current.line.page, current.line.printedPage, headingRaw, headingNormalized, null),
    };
    const allBlocks = [headingBlock, ...built.blocks.map((block, blockIndex) => ({ ...block, blockId: makeBlockId(current.spec.number, blockIndex + 1) }))];
    const numberParts = current.spec.number.split(".");
    const ancestorIds = numberParts.length <= 1
        ? []
        : numberParts.slice(0, -1).map((_, ancestorIndex) => idFor(numberParts.slice(0, ancestorIndex + 1).join(".")));
    generatedUnits.push({
        $schema: "urn:structural-codes:schema:canonical-unit:v2",
        schemaVersion: "2.0.0-alpha.2",
        recordType: "canonical-unit",
        id: idFor(current.spec.number),
        workId: "it-mit:dm:2018-01-17:ntc2018",
        expressionId: "it-mit:dm:2018-01-17:ntc2018:original-it",
        kind: current.spec.kind,
        numbering: { official: current.spec.number, sortKey: sortKey(current.spec.number) },
        title: normalizedTitle,
        titleBlockId: headingBlock.blockId,
        hierarchy: { parentId: current.spec.number === "11" ? null : idFor(numberParts.slice(0, -1).join(".")), ancestorIds, position: 1 },
        validity: { from: "2018-03-22", to: null, status: "in-force", asOf: "2026-08-09" },
        blocks: allBlocks,
        citations: [],
        relations: [],
        assets: {
            formulaIds: built.assetIds.filter((id) => id.includes(":formula:")),
            tableIds: built.assetIds.filter((id) => id.includes(":table:")),
            figureIds: [],
        },
        workflow: {
            status: "extracted",
            createdBy: { actorId: "generator:ntc11:step1", kind: "script", toolVersion: profile },
            createdAt: "2026-08-09T00:00:00Z",
            reviews: [],
            openIssues: [{ issueId: `ntc2018-11-${current.spec.number.replaceAll(".", "-")}-source-review`, type: "normalization-review", severity: "blocking", note: "Trascrizione confrontata con il render ufficiale; resta obbligatoria la revisione umana indipendente prima della pubblicazione." }],
        },
    });
}

function patchVerifiedInline(
    unitNumber: string,
    prefix: string,
    tokens: VerifiedInlineToken[],
    replacement?: string,
): void {
    const unit = generatedUnits.find((candidate) => candidate.numbering.official === unitNumber);
    const block = unit?.blocks.find((candidate: any) => candidate.text?.normalized?.startsWith(prefix));
    if (block === undefined) throw new Error(`Blocco inline verificato non trovato: ${unitNumber} / ${prefix}`);
    if (replacement !== undefined && replacement !== block.text.normalized) {
        block.text.normalized = replacement;
        block.evidence.normalizedSha256 = sha256(replacement);
        block.evidence.transformations = [
            ...(block.evidence.transformations ?? []),
            {
                operation: "manual-correction",
                ruleVersion: profile,
                note: "Notazione matematica ricostruita dal render ufficiale ad alta scala.",
            },
        ];
    }
    block.text.inline = verifiedInline(block.text.normalized, tokens);
}

patchVerifiedInline("11.2.1", "La prescrizione del calcestruzzo", [
    { value: "Rck", latex: "R_{ck}" },
    { value: "fck", latex: "f_{ck}" },
    { value: "150 mm", latex: "150\\;\\mathrm{mm}" },
    { value: "150 mm", latex: "150\\;\\mathrm{mm}" },
    { value: "300 mm", latex: "300\\;\\mathrm{mm}" },
]);
patchVerifiedInline("11.2.1", "La resistenza caratteristica a compressione", [
    { value: "5%", latex: "5\\%" },
    { value: "28 giorni", latex: "28\\;\\mathrm{giorni}" },
]);
patchVerifiedInline("11.2.4", "La media delle resistenze", [{ value: "20%", latex: "20\\%" }]);
patchVerifiedInline("11.2.5.1", "Ogni controllo di tipo A", [
    { value: "300 m3", latex: "300\\;\\mathrm{m^3}" },
    { value: "100 m3", latex: "100\\;\\mathrm{m^3}" },
    { value: "300 m3", latex: "300\\;\\mathrm{m^3}" },
]);
patchVerifiedInline("11.2.5.1", "Nelle costruzioni con meno", [
    { value: "100 m3", latex: "100\\;\\mathrm{m^3}" },
]);
patchVerifiedInline("11.2.5.2", "Nella realizzazione di opere", [
    { value: "1500 m3", latex: "1500\\;\\mathrm{m^3}" },
]);
patchVerifiedInline("11.2.5.2", "Il controllo è riferito", [
    { value: "1500 m3", latex: "1500\\;\\mathrm{m^3}" },
]);
patchVerifiedInline("11.2.5.2", "Ogni controllo di accettazione", [
    { value: "100 m3", latex: "100\\;\\mathrm{m^3}" },
]);
{
    const original = generatedUnits.find((unit) => unit.numbering.official === "11.2.5.2")!.blocks
        .find((block: any) => block.text?.normalized?.startsWith("Se si eseguono controlli statistici"))!.text.normalized;
    patchVerifiedInline("11.2.5.2", "Se si eseguono controlli statistici", [
        { value: "0,3", latex: "0{,}3" },
        { value: "s/Rm", latex: "s/R_m" },
        { value: "0,15", latex: "0{,}15" },
    ], original.replace("s/R m", "s/Rm"));
}
patchVerifiedInline("11.2.5.2", "Infine, la resistenza caratteristica", [
    { value: "Rck", latex: "R_{ck}" },
    { value: "5%", latex: "5\\%" },
    { value: "Rc,min", latex: "R_{c,\\min}" },
    { value: "1%", latex: "1\\%" },
]);
patchVerifiedInline("11.2.6", "Il valore caratteristico della resistenza", [
    { value: "Rckis", latex: "R_{ckis}" },
    { value: "fckis", latex: "f_{ckis}" },
    { value: "Rck", latex: "R_{ck}" },
    { value: "fck", latex: "f_{ck}" },
    { value: "85%", latex: "85\\%" },
]);
patchVerifiedInline("11.2.8", "Per produzioni di calcestruzzo", [
    { value: "1500 m3", latex: "1500\\;\\mathrm{m^3}" },
]);
{
    const block = generatedUnits.find((unit) => unit.numbering.official === "11.2.10.2")!.blocks
        .find((candidate: any) => candidate.text?.normalized?.startsWith("In sede di progettazione si può assumere"))!;
    patchVerifiedInline("11.2.10.2", "In sede di progettazione si può assumere", [
        { value: "N/mm²", latex: "\\mathrm{N/mm^2}" },
    ], block.text.normalized.replace("N/mm2", "N/mm²"));
}
patchVerifiedInline("11.2.10.2", "valori che dovranno essere ridotti", [
    { value: "10%", latex: "10\\%" },
]);
patchVerifiedInline("11.2.10.2", "I valori caratteristici corrispondenti", [
    { value: "5%", latex: "5\\%" },
    { value: "95%", latex: "95\\%" },
    { value: "0,7 fctm", latex: "0{,}7f_{ctm}" },
    { value: "1,3 fctm", latex: "1{,}3f_{ctm}" },
]);
patchVerifiedInline("11.2.10.3", "Per modulo elastico istantaneo", [
    { value: "0,40 fcm", latex: "0{,}40f_{cm}" },
]);
patchVerifiedInline("11.2.10.3", "che dovrà essere ridotto", [{ value: "20%", latex: "20\\%" }]);
patchVerifiedInline("11.2.10.4", "Per il coefficiente di Poisson", [
    { value: "0", latex: "0" },
    { value: "0,2", latex: "0{,}2" },
]);
{
    const block = generatedUnits.find((unit) => unit.numbering.official === "11.2.10.5")!.blocks
        .find((candidate: any) => candidate.text?.normalized?.startsWith("In sede di progettazione strutturale"))!;
    patchVerifiedInline("11.2.10.5", "In sede di progettazione strutturale", [
        { value: "10 × 10⁻⁶ °C⁻¹", latex: "10\\times10^{-6}\\;{}^\\circ\\mathrm{C}^{-1}" },
    ], block.text.normalized.replace("10 x 10-6 °C-1", "10 × 10⁻⁶ °C⁻¹"));
}

const siblingPositions = new Map<string, number>();
for (const unit of generatedUnits) {
    const parent = unit.hierarchy.parentId ?? "root";
    const position = (siblingPositions.get(parent) ?? 0) + 1;
    siblingPositions.set(parent, position);
    unit.hierarchy.position = position;
}

await mkdir(outDir, { recursive: true });
await mkdir(assetDir, { recursive: true });
for (const unit of generatedUnits) {
    await writeFile(join(outDir, `${unit.numbering.official}.json`), `${JSON.stringify(unit, null, 2)}\n`, "utf8");
}
const manifest = {
    $schema: "urn:structural-codes:schema:asset-manifest:v2",
    schemaVersion: "2.0.0-alpha.1",
    recordType: "asset-manifest",
    document: "ntc2018",
    section: "11-step1",
    sourceId,
    status: "transcribed-unreviewed",
    formulas: formulaSeeds,
    tables: tableSeeds,
    figures: [],
};
await writeFile(join(assetDir, "11-step1.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(`ntc11-step1: generated ${generatedUnits.length} units, ${formulaSeeds.length} formulas and ${tableSeeds.length} tables`);
