/**
 * Marcatori di revisione obbligatori (progettazione sezione 3.5).
 * Vietato sostituire un marcatore con contenuto plausibile.
 */
export const REVIEW_MARKERS = [
    "DA_VERIFICARE",
    "FORMULA_NON_LEGGIBILE",
    "TABELLA_DA_REVISIONARE",
    "FIGURA_MANCANTE",
    "RIFERIMENTO_AMBIGUO",
] as const;

export type ReviewMarker = (typeof REVIEW_MARKERS)[number];

const MARKER_PATTERN = /\[(DA_VERIFICARE|FORMULA_NON_LEGGIBILE|TABELLA_DA_REVISIONARE|FIGURA_MANCANTE|RIFERIMENTO_AMBIGUO)\]/g;

/** Trova tutti i marcatori presenti in un testo (anche duplicati). */
export function findMarkers(text: string): ReviewMarker[] {
    const found: ReviewMarker[] = [];
    for (const match of text.matchAll(MARKER_PATTERN)) {
        found.push(match[1] as ReviewMarker);
    }
    return found;
}

/** Marcatori distinti presenti nel testo. */
export function distinctMarkers(text: string): ReviewMarker[] {
    return [...new Set(findMarkers(text))];
}
