import canonicalize from "canonicalize";
import { sha256OfText } from "../../src/lib/hash.ts";

export const EVIDENCE_PIPELINE_VERSION = "0.1.2";

export interface EvidenceTextItem {
    sequence: number;
    text: string;
    direction: string;
    fontName: string;
    hasEol: boolean;
    transform: [number, number, number, number, number, number];
    region: {
        coordinateSystem: "pdf-points-top-left";
        x: number;
        y: number;
        width: number;
        height: number;
    };
    angleDegrees: number;
}

export function canonicalJson(value: unknown): string {
    const result = canonicalize(value);
    if (result === undefined) throw new Error("valore non serializzabile in JCS");
    return result;
}

export function sha256OfCanonicalJson(value: unknown): string {
    return sha256OfText(canonicalJson(value));
}

export function roundCoordinate(value: number): number {
    return Math.round(value * 1000) / 1000;
}

export function parsePageRange(
    value: string | undefined,
): { from: number; to: number } | null {
    if (value === undefined) return null;
    const match = /^([1-9]\d*)-([1-9]\d*)$/.exec(value);
    if (match === null) throw new Error(`intervallo pagine non valido: ${value}`);
    const from = Number(match[1]);
    const to = Number(match[2]);
    if (from > to) throw new Error(`intervallo pagine invertito: ${value}`);
    return { from, to };
}

export function reconstructRawText(items: EvidenceTextItem[]): string {
    let result = "";
    let previous: EvidenceTextItem | undefined;
    for (const item of items) {
        if (previous !== undefined) {
            const newLine =
                previous.hasEol ||
                (item.region.x <= previous.region.x + 0.5 &&
                    Math.abs(item.region.y - previous.region.y) >
                        Math.max(2, previous.region.height * 0.6));
            if (newLine) {
                if (!result.endsWith("\n")) result += "\n";
            } else {
                const previousEnd = previous.region.x + previous.region.width;
                const gap = item.region.x - previousEnd;
                const needsSpace =
                    gap > Math.max(0.5, previous.region.height * 0.08) &&
                    !/\s$/u.test(result) &&
                    !/^[,.;:!?)\]}]/u.test(item.text);
                if (needsSpace) result += " ";
            }
        }
        result += item.text;
        previous = item;
    }
    if (previous?.hasEol && !result.endsWith("\n")) result += "\n";
    return result;
}

export function detectPrintedPage(rawText: string): string | null {
    const match = /(?:—|-)\s*(\d{1,4})\s*(?:—|-)/u.exec(rawText);
    return match?.[1] ?? null;
}

export function detectEvidenceAnomalies(
    items: EvidenceTextItem[],
    rawText: string,
    pageHeight: number,
) {
    const controlCharacters = items.flatMap((item) => {
        const codePoints = [...item.text]
            .map((character) => character.codePointAt(0)!)
            .filter(
                (codePoint) =>
                    (codePoint >= 0 && codePoint <= 8) ||
                    codePoint === 11 ||
                    codePoint === 12 ||
                    (codePoint >= 14 && codePoint <= 31) ||
                    codePoint === 127,
            )
            .map((codePoint) => `U+${codePoint.toString(16).toUpperCase().padStart(4, "0")}`);
        return codePoints.length === 0
            ? []
            : [{ sequence: item.sequence, codePoints }];
    });
    const possibleHeaderSequences = items
        .filter((item) => item.region.y < pageHeight * 0.08)
        .map((item) => item.sequence);
    const possibleFooterSequences = items
        .filter(
            (item) =>
                item.region.y + item.region.height > pageHeight * 0.92,
        )
        .map((item) => item.sequence);

    return {
        controlCharacters,
        replacementCharacterCount: [...rawText].filter(
            (character) => character === "\uFFFD",
        ).length,
        softHyphenCount: [...rawText].filter(
            (character) => character === "\u00AD",
        ).length,
        lineEndHyphenCount: (rawText.match(/-\n/gu) ?? []).length,
        rotatedItemSequences: items
            .filter((item) => Math.abs(item.angleDegrees) > 0.1)
            .map((item) => item.sequence),
        possibleHeaderSequences,
        possibleFooterSequences,
    };
}
