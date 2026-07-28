import { sha256OfText } from "../../src/lib/hash.ts";

export const NORMALIZATION_RULE_VERSION = "normalization-0.1";

export const NORMALIZATION_OPERATIONS = [
    "unicode-nfc",
    "normalize-line-endings",
    "normalize-whitespace",
    "remove-control-character",
    "remove-discretionary-hyphen",
] as const;

export type NormalizationOperation = (typeof NORMALIZATION_OPERATIONS)[number];

export interface AppliedNormalization {
    operation: NormalizationOperation;
    ruleVersion: string;
    note: string;
    changed: boolean;
    beforeSha256: string;
    afterSha256: string;
}

function applyOperation(
    text: string,
    operation: NormalizationOperation,
): string {
    switch (operation) {
        case "unicode-nfc":
            return text.normalize("NFC");
        case "normalize-line-endings":
            return text.replace(/\r\n?/gu, "\n");
        case "normalize-whitespace":
            return text.replace(/[\u00A0\u202F]/gu, " ");
        case "remove-control-character":
            return text.replace(
                /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/gu,
                "",
            );
        case "remove-discretionary-hyphen":
            return text.replace(/\u00AD/gu, "");
    }
}

export function normalizeText(
    raw: string,
    operations: readonly NormalizationOperation[],
    note: string,
): { normalized: string; transformations: AppliedNormalization[] } {
    if (new Set(operations).size !== operations.length) {
        throw new Error("operazioni di normalizzazione duplicate");
    }
    let normalized = raw;
    const transformations: AppliedNormalization[] = [];
    for (const operation of operations) {
        const before = normalized;
        normalized = applyOperation(before, operation);
        transformations.push({
            operation,
            ruleVersion: NORMALIZATION_RULE_VERSION,
            note,
            changed: before !== normalized,
            beforeSha256: sha256OfText(before),
            afterSha256: sha256OfText(normalized),
        });
    }
    return { normalized, transformations };
}

export function assertNormalizationOperation(
    value: string,
): asserts value is NormalizationOperation {
    if (!(NORMALIZATION_OPERATIONS as readonly string[]).includes(value)) {
        throw new Error(`operazione non ammessa: ${value}`);
    }
}
